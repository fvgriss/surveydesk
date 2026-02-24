import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// PATCH /api/settings/notifications — update current user's notification prefs
export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.emailNotifications === "boolean") {
      updateFields.emailNotifications = body.emailNotifications;
    }
    if (typeof body.smsNotifications === "boolean") {
      updateFields.smsNotifications = body.smsNotifications;
    }

    if (Object.keys(updateFields).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, tenant.userId))
      .returning({
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
      });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating notification prefs:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
