import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

// POST /api/admin/tenants/[id]/impersonate
// Sets a cookie to override the current tenant context so the super admin
// sees the target tenant's dashboard without switching auth sessions.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkSuperAdmin();
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: tenantId } = await params;

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Set impersonation cookie — getCurrentTenant() will check this first
    const cookieStore = await cookies();
    cookieStore.set("impersonate_tenant", tenantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    console.log(`[admin] ${admin.email} impersonating tenant ${tenant.name} (${tenantId})`);

    return NextResponse.json({ success: true, tenantName: tenant.name });
  } catch (error) {
    console.error("Error impersonating tenant:", error);
    return NextResponse.json(
      { error: "Failed to impersonate tenant" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tenants/[id]/impersonate
// Clears the impersonation cookie
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("impersonate_tenant");
  return NextResponse.json({ success: true });
}
