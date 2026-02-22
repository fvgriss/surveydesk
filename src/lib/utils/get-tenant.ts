import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users, superAdmins } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

/**
 * Get the current tenant ID from the authenticated user.
 * Use this in API routes and server components.
 *
 * If the user is a super admin with an active impersonation cookie,
 * returns the impersonated tenant's context instead.
 *
 * Returns null if the user is not authenticated or has no tenant.
 */
export async function getCurrentTenant(): Promise<{
  tenantId: string;
  userId: string;
  role: string;
  impersonating?: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  // Check for impersonation cookie (super admin viewing another tenant)
  const cookieStore = await cookies();
  const impersonateTenant = cookieStore.get("impersonate_tenant")?.value;

  if (impersonateTenant) {
    // Verify this user is actually a super admin before honoring the cookie
    const [admin] = await db
      .select({ id: superAdmins.id })
      .from(superAdmins)
      .where(
        and(
          eq(superAdmins.authId, authUser.id),
          eq(superAdmins.isActive, true)
        )
      )
      .limit(1);

    if (admin) {
      // Find the admin's own user record (for the userId)
      const [adminUser] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.authId, authUser.id))
        .limit(1);

      return {
        tenantId: impersonateTenant,
        userId: adminUser?.id || authUser.id,
        role: adminUser?.role || "owner",
        impersonating: true,
      };
    }
  }

  // Normal flow: look up user's own tenant
  const [dbUser] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      role: users.role,
    })
    .from(users)
    .where(eq(users.authId, authUser.id))
    .limit(1);

  if (!dbUser) return null;

  return {
    tenantId: dbUser.tenantId,
    userId: dbUser.id,
    role: dbUser.role,
  };
}
