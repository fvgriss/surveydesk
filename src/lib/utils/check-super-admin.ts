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
    return {
      isSuperAdmin: false,
      authId: authUser.id,
      email: authUser.email || "",
    };
  }

  return {
    isSuperAdmin: true,
    authId: admin.authId,
    email: admin.email,
  };
}
