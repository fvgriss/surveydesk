import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { emailLog, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/inbox/[emailId]/assign-project
 *
 * Links an inbox email to an existing project.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["owner", "office_manager"].includes(tenant.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { emailId } = await params;
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify email ownership
    const [email] = await db
      .select({ id: emailLog.id })
      .from(emailLog)
      .where(and(eq(emailLog.id, emailId), eq(emailLog.tenantId, tenant.tenantId)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify project ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenant.tenantId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db
      .update(emailLog)
      .set({ emailStatus: "assigned", projectId })
      .where(eq(emailLog.id, emailId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[inbox/assign-project] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
