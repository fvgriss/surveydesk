import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Resolve which tenant a Retell call belongs to.
 *
 * Strategy:
 * 1. Look up tenant by retellAgentId matching the call's agent_id
 * 2. Fall back to DEFAULT_TENANT_ID env var (for backward compatibility)
 * 3. Return null if neither works
 */
export async function resolveTenantId(agentId?: string): Promise<string | null> {
  // Try matching by agent ID first
  if (agentId) {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.retellAgentId, agentId))
      .limit(1);

    if (tenant) {
      return tenant.id;
    }
  }

  // Fall back to default tenant
  return process.env.DEFAULT_TENANT_ID || null;
}
