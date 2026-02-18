import { db } from "@/db";
import { tenants } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { TenantsClient } from "./tenants-client";

export default async function TenantsPage() {
  const allTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      email: tenants.email,
      phone: tenants.phone,
      city: tenants.city,
      state: tenants.state,
      createdAt: tenants.createdAt,
      userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.tenant_id = ${tenants.id})`.as("user_count"),
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  // Serialize dates
  const serialized = allTenants.map((t) => ({
    ...t,
    userCount: Number(t.userCount),
    createdAt: t.createdAt.toISOString(),
  }));

  return <TenantsClient tenants={serialized} />;
}
