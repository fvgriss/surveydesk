import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "project-documents";

type DocEntry = {
  name: string;
  type: string;
  uploadedAt: string;
  storagePath: string;
};

// GET /api/projects/[id]/documents?index=0 — generate a signed download URL
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const index = parseInt(req.nextUrl.searchParams.get("index") || "-1");

    const [project] = await db
      .select({ id: projects.id, documents: projects.documents })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenant.tenantId)))
      .limit(1);

    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const docs = (project.documents || []) as unknown as DocEntry[];
    if (index < 0 || index >= docs.length)
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(docs[index].storagePath, 60 * 60); // 1 hour

    if (error || !data?.signedUrl)
      return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/projects/[id]/documents — upload a document
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [project] = await db
      .select({ id: projects.id, documents: projects.documents })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenant.tenantId)))
      .limit(1);

    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const supabase = createAdminClient();
    const filePath = `${tenant.tenantId}/${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Upload failed", detail: uploadError.message },
        { status: 500 }
      );
    }

    const docEntry: DocEntry = {
      name: file.name,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      storagePath: filePath,
    };

    const currentDocs = (project.documents || []) as unknown as DocEntry[];

    const [updated] = await db
      .update(projects)
      .set({
        documents: [...currentDocs, docEntry],
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning({ documents: projects.documents });

    return NextResponse.json({ success: true, documents: updated.documents });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/documents — remove a document by index
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { index } = await req.json();

    const [project] = await db
      .select({ id: projects.id, documents: projects.documents })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, tenant.tenantId)))
      .limit(1);

    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const currentDocs = (project.documents || []) as unknown as DocEntry[];
    if (index < 0 || index >= currentDocs.length)
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });

    const supabase = createAdminClient();
    await supabase.storage.from(BUCKET).remove([currentDocs[index].storagePath]);

    const newDocs = currentDocs.filter((_, i) => i !== index);

    const [updated] = await db
      .update(projects)
      .set({ documents: newDocs, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning({ documents: projects.documents });

    return NextResponse.json({ success: true, documents: updated.documents });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
