import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/tenants/[id]/release-phone
 *
 * Releases the Retell phone number for a tenant (stops billing)
 * without deleting the tenant record.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkSuperAdmin();
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
    }

    const { id } = await params;

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        retellPhoneNumber: tenants.retellPhoneNumber,
        retellAgentId: tenants.retellAgentId,
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!tenant.retellPhoneNumber) {
      return NextResponse.json({ error: "No phone number to release" }, { status: 400 });
    }

    const retell = new Retell({ apiKey });
    await retell.phoneNumber.delete(tenant.retellPhoneNumber);

    // Clear phone number from tenant (keep agentId for potential re-provisioning)
    await db
      .update(tenants)
      .set({ retellPhoneNumber: null, updatedAt: new Date() })
      .where(eq(tenants.id, id));

    console.log(`[release-phone] Released ${tenant.retellPhoneNumber} for ${tenant.name}`);

    return NextResponse.json({ success: true, released: tenant.retellPhoneNumber });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[release-phone] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
