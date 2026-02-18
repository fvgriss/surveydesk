import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crews } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// PATCH /api/crews/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const allowedFields = ["name", "chiefName", "isActive", "notes"] as const;
    const updateFields: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(crews)
      .set(updateFields)
      .where(and(eq(crews.id, id), eq(crews.tenantId, tenant.tenantId)))
      .returning();

    if (!updated)
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating crew PATCH /api/crews/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update crew" },
      { status: 500 }
    );
  }
}

// DELETE /api/crews/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await db
      .delete(crews)
      .where(and(eq(crews.id, id), eq(crews.tenantId, tenant.tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting crew DELETE /api/crews/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete crew" },
      { status: 500 }
    );
  }
}
