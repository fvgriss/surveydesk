import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/onboarding/complete — mark tenant onboarding as done
export async function POST() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .update(tenants)
      .set({
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.tenantId));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to complete onboarding: ${message}` },
      { status: 500 }
    );
  }
}
