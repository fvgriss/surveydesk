export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
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

  // Check if tenant has completed onboarding
  const [dbUser] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.authId, user.id))
    .limit(1);

  if (dbUser) {
    const [tenant] = await db
      .select({ onboardingComplete: tenants.onboardingComplete })
      .from(tenants)
      .where(eq(tenants.id, dbUser.tenantId))
      .limit(1);

    if (tenant && !tenant.onboardingComplete) {
      redirect("/onboarding");
    }
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
