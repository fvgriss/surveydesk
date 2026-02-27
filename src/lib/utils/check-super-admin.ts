import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Check if the current authenticated user is a super admin.
 * Use this in admin API routes and admin layouts.
 */
export async function checkSuperAdmin(): Promise<{
  isSuperAdmin: boolean;
  authId: string;
  email: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const email = authUser.email || "";

  // Whitelisted domain — all @terrainplot.com users are super admins
  if (email.endsWith("@terrainplot.com")) {
    return { isSuperAdmin: true, authId: authUser.id, email };
  }

  const [admin] = await db
    .select({
      id: superAdmins.id,
      email: superAdmins.email,
      authId: superAdmins.authId,
      isActive: superAdmins.isActive,
    })
    .from(superAdmins)
    .where(
      and(
        eq(superAdmins.authId, authUser.id),
        eq(superAdmins.isActive, true)
      )
    )
    .limit(1);

  if (!admin) {
    return { isSuperAdmin: false, authId: authUser.id, email };
  }

  return {
    isSuperAdmin: true,
    authId: admin.authId,
    email: admin.email,
  };
}
