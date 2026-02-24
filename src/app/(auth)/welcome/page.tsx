export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WelcomeClient } from "./welcome-client";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [dbUser] = await db
    .select({
      fullName: users.fullName,
      role: users.role,
      tenantId: users.tenantId,
      welcomeComplete: users.welcomeComplete,
    })
    .from(users)
    .where(eq(users.authId, user.id))
    .limit(1);

  if (!dbUser) {
    redirect("/login");
  }

  // Already welcomed — go to dashboard
  if (dbUser.welcomeComplete) {
    redirect("/dashboard");
  }

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, dbUser.tenantId))
    .limit(1);

  return (
    <WelcomeClient
      firstName={dbUser.fullName.split(" ")[0]}
      role={dbUser.role}
      firmName={tenant?.name || "your firm"}
    />
  );
}
