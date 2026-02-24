import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";
import { db } from "@/db";
import { tenants, superAdmins } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/reassign-phone
 *
 * Reassign a Retell phone number from one tenant to another.
 * Updates the inbound_agent_id in Retell and swaps the DB records.
 *
 * Body: { phoneNumber: string, toTenantId: string }
 *   phoneNumber: E.164 format (e.g. "+15203958211")
 *   toTenantId:  UUID of the tenant that should receive calls on this number
 */
export async function POST(req: NextRequest) {
  // Verify super admin
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [admin] = await db
    .select({ id: superAdmins.id })
    .from(superAdmins)
    .where(
      and(eq(superAdmins.authId, authUser.id), eq(superAdmins.isActive, true))
    )
    .limit(1);

  if (!admin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RETELL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { phoneNumber, toTenantId } = await req.json();

    if (!phoneNumber || !toTenantId) {
      return NextResponse.json(
        { error: "phoneNumber and toTenantId are required" },
        { status: 400 }
      );
    }

    // Look up the target tenant
    const [toTenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        retellAgentId: tenants.retellAgentId,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.id, toTenantId))
      .limit(1);

    if (!toTenant) {
      return NextResponse.json(
        { error: "Target tenant not found" },
        { status: 404 }
      );
    }

    if (!toTenant.retellAgentId) {
      return NextResponse.json(
        {
          error: `Tenant "${toTenant.name}" has no Retell agent. Provision one first.`,
        },
        { status: 400 }
      );
    }

    // Find which tenant currently owns this phone number
    const [fromTenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.retellPhoneNumber, phoneNumber))
      .limit(1);

    // Update the phone number in Retell to point to the new agent
    const retell = new Retell({ apiKey });

    await retell.phoneNumber.update(phoneNumber, {
      inbound_agent_id: toTenant.retellAgentId,
      nickname: `${toTenant.name} intake`,
    });

    // Update DB: set the target tenant's phone number
    // Store what was previously the target's number (if any) so we can swap
    const toTenantOldNumber = toTenant.retellPhoneNumber;

    await db
      .update(tenants)
      .set({ retellPhoneNumber: phoneNumber })
      .where(eq(tenants.id, toTenantId));

    // If another tenant had this number, clear it (or give them the target's old number)
    if (fromTenant && fromTenant.id !== toTenantId) {
      await db
        .update(tenants)
        .set({ retellPhoneNumber: toTenantOldNumber || null })
        .where(eq(tenants.id, fromTenant.id));
    }

    return NextResponse.json({
      success: true,
      message: `Phone ${phoneNumber} now routes to "${toTenant.name}" (agent: ${toTenant.retellAgentId})`,
      from: fromTenant
        ? { id: fromTenant.id, name: fromTenant.name }
        : null,
      to: { id: toTenant.id, name: toTenant.name },
    });
  } catch (error: unknown) {
    console.error("Error reassigning phone:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reassign phone: ${message}` },
      { status: 500 }
    );
  }
}
