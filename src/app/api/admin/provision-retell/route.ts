import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { provisionRetellAgent } from "@/lib/retell/provision";

/**
 * POST /api/admin/provision-retell
 *
 * Admin-only: manually trigger Retell provisioning for a tenant.
 * Body: { tenantId: string }
 * Returns the agentId and phone number, or a detailed error.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify caller is admin
    const auth = await getCurrentTenant();
    if (!auth || auth.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenantId } = await req.json();
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    // Look up the tenant
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        state: tenants.state,
        retellAgentId: tenants.retellAgentId,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.retellAgentId && tenant.retellPhoneNumber) {
      return NextResponse.json({
        message: "Retell already provisioned",
        agentId: tenant.retellAgentId,
        phoneNumber: tenant.retellPhoneNumber,
      });
    }

    // Attempt provisioning
    console.log(`[admin] Manually provisioning Retell for tenant ${tenant.id} (${tenant.name})`);

    const provision = await provisionRetellAgent({
      firmName: tenant.name,
      state: tenant.state || undefined,
      tenantId: tenant.id,
    });

    // Update tenant
    await db
      .update(tenants)
      .set({
        retellAgentId: provision.agentId,
        retellPhoneNumber: provision.phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));

    console.log(
      `[admin] Provisioned Retell for ${tenant.name}: agent=${provision.agentId}, phone=${provision.phoneNumber}`
    );

    return NextResponse.json({
      success: true,
      agentId: provision.agentId,
      phoneNumber: provision.phoneNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[admin] Retell provisioning failed:", message, stack);

    return NextResponse.json(
      {
        error: `Retell provisioning failed: ${message}`,
        details: stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    );
  }
}
