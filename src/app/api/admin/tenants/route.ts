import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

// GET /api/admin/tenants — list all tenants with user counts
export async function GET() {
  const admin = await checkSuperAdmin();
  if (!admin?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      email: tenants.email,
      phone: tenants.phone,
      city: tenants.city,
      state: tenants.state,
      createdAt: tenants.createdAt,
      userCount: sql<number>`(SELECT COUNT(*) FROM users WHERE users.tenant_id = ${tenants.id})`.as("user_count"),
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  return NextResponse.json({ tenants: allTenants });
}

// POST /api/admin/tenants — create new tenant + owner user
export async function POST(req: NextRequest) {
  const admin = await checkSuperAdmin();
  if (!admin?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    firmName,
    firmEmail,
    firmPhone,
    firmAddress,
    firmCity,
    firmState,
    firmZip,
    ownerName,
    ownerEmail,
    ownerPassword,
  } = body;

  // Validate required fields
  if (!firmName || !ownerName || !ownerEmail || !ownerPassword) {
    return NextResponse.json(
      { error: "Firm name, owner name, owner email, and password are required" },
      { status: 400 }
    );
  }

  try {
    // 1. Create Supabase auth user
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true, // skip email verification for admin-created accounts
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: `Auth user creation failed: ${authError?.message || "Unknown error"}` },
        { status: 400 }
      );
    }

    // 2. Create tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: firmName,
        email: firmEmail || null,
        phone: firmPhone || null,
        address: firmAddress || null,
        city: firmCity || null,
        state: firmState || null,
        zip: firmZip || null,
      })
      .returning();

    // 3. Create user record linking auth user to tenant
    const [newUser] = await db
      .insert(users)
      .values({
        tenantId: newTenant.id,
        authId: authData.user.id,
        email: ownerEmail,
        fullName: ownerName,
        role: "owner",
      })
      .returning();

    return NextResponse.json({
      tenant: newTenant,
      user: newUser,
      message: "Tenant and owner created successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create tenant: ${message}` },
      { status: 500 }
    );
  }
}
