import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the current tenant ID from the authenticated user.
 * Use this in API routes and server components.
 *
 * Returns null if the user is not authenticated or has no tenant.
 */
export async function getCurrentTenant(): Promise<{
  tenantId: string;
  userId: string;
  role: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

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
