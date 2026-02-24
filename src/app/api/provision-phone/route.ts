import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { provisionRetellAgent } from "@/lib/retell/provision";

/**
 * POST /api/provision-phone
 *
 * Self-serve: tenant can provision their own Retell phone number.
 * Requires active subscription (not trialing) to prevent cost exposure.
 */
export async function POST() {
  try {
    const auth = await getCurrentTenant();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch tenant details
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        state: tenants.state,
        subscriptionStatus: tenants.subscriptionStatus,
        retellAgentId: tenants.retellAgentId,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Already provisioned
    if (tenant.retellAgentId && tenant.retellPhoneNumber) {
      return NextResponse.json({
        phoneNumber: tenant.retellPhoneNumber,
        alreadyProvisioned: true,
      });
    }

    // Gate: must be a paying customer
    if (tenant.subscriptionStatus !== "active") {
      return NextResponse.json(
        { error: "Phone provisioning requires an active subscription. Please subscribe first." },
        { status: 403 }
      );
    }

    // Provision
    const provision = await provisionRetellAgent({
      firmName: tenant.name,
      state: tenant.state || undefined,
      tenantId: tenant.id,
    });

    await db
      .update(tenants)
      .set({
        retellAgentId: provision.agentId,
        retellPhoneNumber: provision.phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));

    console.log(
      `[provision-phone] Self-serve provisioned for ${tenant.name}: phone=${provision.phoneNumber}`
    );

    return NextResponse.json({
      phoneNumber: provision.phoneNumber,
      alreadyProvisioned: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[provision-phone] Error:", message);
    return NextResponse.json(
      { error: `Provisioning failed: ${message}` },
      { status: 500 }
    );
  }
}
