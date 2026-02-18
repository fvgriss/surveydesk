import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/gmail/disconnect
 *
 * Deactivates the Gmail integration for the current tenant.
 */
export async function POST() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .update(integrations)
      .set({
        isActive: false,
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrations.tenantId, tenant.tenantId),
          eq(integrations.provider, "gmail")
        )
      );

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error("Error disconnecting Gmail POST /api/gmail/disconnect:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}
