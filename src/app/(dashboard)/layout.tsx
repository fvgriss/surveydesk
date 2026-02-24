export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use getCurrentTenant which respects impersonation cookie
  const auth = await getCurrentTenant();

  let firmName: string | null = null;
  let retellPhoneNumber: string | null = null;
  let isImpersonating = false;

  if (auth) {
    isImpersonating = !!auth.impersonating;

    const [tenant] = await db
      .select({
        onboardingComplete: tenants.onboardingComplete,
        name: tenants.name,
        retellPhoneNumber: tenants.retellPhoneNumber,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    // Skip onboarding redirect when impersonating
    if (tenant && !tenant.onboardingComplete && !isImpersonating) {
      redirect("/onboarding");
    }

    firmName = tenant?.name || null;
    retellPhoneNumber = tenant?.retellPhoneNumber || null;

    // Check if invited user needs welcome screen
    if (!isImpersonating) {
      const [currentUser] = await db
        .select({ welcomeComplete: users.welcomeComplete })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);

      if (currentUser && !currentUser.welcomeComplete) {
        redirect("/welcome");
      }
    }
  }

  return (
    <DashboardShell
      user={user}
      firmName={firmName}
      retellPhoneNumber={retellPhoneNumber}
      isImpersonating={isImpersonating}
      role={auth?.role || "owner"}
    >
      {children}
    </DashboardShell>
  );
}
