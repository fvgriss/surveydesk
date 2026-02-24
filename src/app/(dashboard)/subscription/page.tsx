export const dynamic = "force-dynamic";

import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SubscriptionClient } from "./subscription-client";

export default async function SubscriptionPage() {
  const auth = await getCurrentTenant();
  if (!auth) redirect("/login");
  if (auth.role !== "owner") redirect("/schedule");

  const [tenant] = await db
    .select({
      name: tenants.name,
      subscriptionStatus: tenants.subscriptionStatus,
      subscriptionPlan: tenants.subscriptionPlan,
      trialEndsAt: tenants.trialEndsAt,
      stripeCustomerId: tenants.stripeCustomerId,
    })
    .from(tenants)
    .where(eq(tenants.id, auth.tenantId))
    .limit(1);

  return (
    <SubscriptionClient
      subscription={{
        status: (tenant.subscriptionStatus as string) || "trialing",
        plan: (tenant.subscriptionPlan as string) || "starter",
        trialEndsAt: tenant.trialEndsAt?.toISOString() || null,
        hasStripe: !!tenant.stripeCustomerId,
      }}
      firmName={tenant.name}
      stripeConfigured={!!process.env.STRIPE_SECRET_KEY}
    />
  );
}
