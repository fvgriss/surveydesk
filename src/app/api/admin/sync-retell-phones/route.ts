import { NextResponse } from "next/server";
import Retell from "retell-sdk";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";

/**
 * POST /api/admin/sync-retell-phones
 *
 * Pulls the latest phone→agent mappings from Retell and updates any
 * tenant records whose retellPhoneNumber has drifted.
 */
export async function POST() {
  try {
    const admin = await checkSuperAdmin();
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
    }

    const retell = new Retell({ apiKey });

    // Fetch all phone numbers from Retell
    const phones = await retell.phoneNumber.list();

    // Build map: agentId → phone number (E.164)
    const agentToPhone = new Map<string, string>();
    for (const p of phones) {
      if (p.inbound_agent_id) {
        agentToPhone.set(p.inbound_agent_id, p.phone_number);
      }
    }

    // Fetch tenants that have a Retell agent
    const tenantsWithAgent = await db
      .select({
        id: tenants.id,
        retellAgentId: tenants.retellAgentId,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(isNotNull(tenants.retellAgentId));

    let synced = 0;

    for (const t of tenantsWithAgent) {
      const retellPhone = agentToPhone.get(t.retellAgentId!);
      if (retellPhone && retellPhone !== t.retellPhoneNumber) {
        await db
          .update(tenants)
          .set({ retellPhoneNumber: retellPhone, updatedAt: new Date() })
          .where(eq(tenants.id, t.id));
        synced++;
        console.log(
          `[sync-retell-phones] Updated tenant ${t.id}: ${t.retellPhoneNumber} → ${retellPhone}`
        );
      }
    }

    return NextResponse.json({
      synced,
      total: tenantsWithAgent.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[sync-retell-phones] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
