import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { updateAgentPrompt } from "@/lib/retell/provision";

/**
 * POST /api/admin/update-agents
 *
 * Admin-only: push the latest prompt template to every tenant's Retell LLM.
 * Use this after updating agent-prompt-template.ts to sync all agents.
 */
export async function POST() {
  try {
    const auth = await getCurrentTenant();
    if (!auth || auth.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all tenants with a Retell agent
    const agentTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        retellAgentId: tenants.retellAgentId,
      })
      .from(tenants)
      .where(isNotNull(tenants.retellAgentId));

    const results: { tenantId: string; name: string; success: boolean; error?: string }[] = [];

    for (const tenant of agentTenants) {
      try {
        await updateAgentPrompt({
          agentId: tenant.retellAgentId!,
          firmName: tenant.name,
        });
        results.push({ tenantId: tenant.id, name: tenant.name, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[admin] Failed to update agent for ${tenant.name}:`, message);
        results.push({ tenantId: tenant.id, name: tenant.name, success: false, error: message });
      }
    }

    const updated = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[admin] Update all agents: ${updated} updated, ${failed} failed`);

    return NextResponse.json({ updated, failed, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin] Update agents failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
