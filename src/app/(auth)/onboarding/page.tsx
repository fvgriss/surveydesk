export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must be logged in
  if (!user) {
    redirect("/login");
  }

  // Look up tenant
  const [dbUser] = await db
    .select({ tenantId: users.tenantId, fullName: users.fullName })
    .from(users)
    .where(eq(users.authId, user.id))
    .limit(1);

  if (!dbUser) {
    redirect("/login");
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      phone: tenants.phone,
      email: tenants.email,
      address: tenants.address,
      city: tenants.city,
      state: tenants.state,
      zip: tenants.zip,
      plsLicenseNumber: tenants.plsLicenseNumber,
      plsLicenseState: tenants.plsLicenseState,
      serviceAreaCounties: tenants.serviceAreaCounties,
      onboardingComplete: tenants.onboardingComplete,
      retellPhoneNumber: tenants.retellPhoneNumber,
      subscriptionStatus: tenants.subscriptionStatus,
    })
    .from(tenants)
    .where(eq(tenants.id, dbUser.tenantId))
    .limit(1);

  // Already onboarded — go to dashboard
  if (tenant?.onboardingComplete) {
    redirect("/dashboard");
  }

  return (
    <OnboardingClient
      ownerName={dbUser.fullName}
      retellPhoneNumber={tenant.retellPhoneNumber || null}
      subscriptionStatus={tenant.subscriptionStatus || "trialing"}
      firmName={tenant.name}
      tenant={{
        name: tenant.name,
        phone: tenant.phone || "",
        email: tenant.email || "",
        address: tenant.address || "",
        city: tenant.city || "",
        state: tenant.state || "",
        zip: tenant.zip || "",
        plsLicenseNumber: tenant.plsLicenseNumber || "",
        plsLicenseState: tenant.plsLicenseState || "",
        serviceAreaCounties: tenant.serviceAreaCounties || "",
      }}
    />
  );
}
