import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/team/[id] — update a team member
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (tenant.role !== "owner") {
      return NextResponse.json(
        { error: "Only the account owner can manage team members" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Fetch the target user first
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenant.tenantId)))
      .limit(1);

    if (!targetUser)
      return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Protect the owner
    if (targetUser.role === "owner") {
      if (body.role && body.role !== "owner") {
        return NextResponse.json(
          { error: "Cannot change the owner's role" },
          { status: 400 }
        );
      }
      if (body.isActive === false) {
        return NextResponse.json(
          { error: "Cannot deactivate the owner" },
          { status: 400 }
        );
      }
    }

    // Validate role if provided
    if (body.role && !["office_manager", "crew_chief", "instrument_person"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const allowedFields = ["fullName", "phone", "role", "isActive", "emailNotifications", "smsNotifications"] as const;
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
      .update(users)
      .set(updateFields)
      .where(and(eq(users.id, id), eq(users.tenantId, tenant.tenantId)))
      .returning();

    if (!updated)
      return NextResponse.json({ error: "Member not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating team member PATCH /api/team/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/team/[id] — remove a team member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (tenant.role !== "owner") {
      return NextResponse.json(
        { error: "Only the account owner can remove team members" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Fetch target to verify and get authId
    const [targetUser] = await db
      .select({ authId: users.authId, role: users.role })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenant.tenantId)))
      .limit(1);

    if (!targetUser)
      return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (targetUser.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the account owner" },
        { status: 400 }
      );
    }

    // Delete from DB
    await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenant.tenantId)));

    // Delete from Supabase auth
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.deleteUser(targetUser.authId);
    } catch (authErr) {
      console.warn("[team-delete] Failed to delete auth user:", authErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting team member DELETE /api/team/[id]:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
