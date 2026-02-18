import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

// POST /api/admin/tenants/[id]/impersonate
// Signs in as the tenant's owner user so the super admin can view their dashboard
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

    // Find the owner user for this tenant
    const [owner] = await db
      .select({
        id: users.id,
        authId: users.authId,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "owner")))
      .limit(1);

    if (!owner) {
      return NextResponse.json(
        { error: "No owner user found for this tenant" },
        { status: 404 }
      );
    }

    // Use admin API to generate a magic link / sign in as this user
    const supabaseAdmin = createAdminClient();

    // Generate a session for the owner user
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: owner.email,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: `Failed to generate session: ${error?.message}` },
        { status: 500 }
      );
    }

    // Store the original admin auth ID in a cookie so we can "exit impersonation" later
    const cookieStore = await cookies();
    cookieStore.set("admin_impersonating", admin.authId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 30, // 30 minutes
      path: "/",
    });

    // Use the token to sign in — redirect to the verification endpoint
    // The hashed_token from generateLink can be used to verify and create a session
    const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${data.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")}/dashboard`;

    return NextResponse.json({ redirectUrl: verifyUrl });
  } catch (error) {
    console.error("Error impersonating tenant POST /api/admin/tenants/[id]/impersonate:", error);
    return NextResponse.json(
      { error: "Failed to impersonate tenant" },
      { status: 500 }
    );
  }
}
