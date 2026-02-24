import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const VALID_INVITE_ROLES = ["office_manager", "crew_chief", "instrument_person"];

const ROLE_LABELS: Record<string, string> = {
  office_manager: "an Office Manager",
  crew_chief: "a Crew Chief",
  instrument_person: "an Instrument Person",
};

// GET /api/team — list all team members
export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenant.tenantId))
      .orderBy(asc(users.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching team GET /api/team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

// POST /api/team — invite a new team member
export async function POST(req: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (tenant.role !== "owner") {
      return NextResponse.json(
        { error: "Only the account owner can invite team members" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fullName, email, phone, role } = body;

    if (!fullName || !email || !role) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!VALID_INVITE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // 1. Create Supabase auth user
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth account" },
        { status: 400 }
      );
    }

    // 2. Create DB user record
    let newUser;
    try {
      [newUser] = await db
        .insert(users)
        .values({
          tenantId: tenant.tenantId,
          authId: authData.user.id,
          email,
          fullName,
          phone: phone || null,
          role,
          emailNotifications: false,
          smsNotifications: false,
          welcomeComplete: false,
        })
        .returning();
    } catch (dbError) {
      // Clean up the Supabase auth user if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    // 3. Generate password-set link
    const { data: linkData } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app"}/auth/callback?next=/dashboard`,
        },
      });

    // 4. Send invite email via Resend
    if (linkData?.properties?.action_link && process.env.RESEND_API_KEY) {
      const [tenantRow] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenant.tenantId))
        .limit(1);

      const firmName = tenantRow?.name || "SurveyOS";

      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "SurveyDesk <team@updates.surveydesk.app>",
          to: email,
          subject: `You've been invited to ${firmName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px;">
              <p>Hi ${fullName.split(" ")[0]},</p>
              <p>You've been invited to join <strong>${firmName}</strong> on SurveyOS as ${ROLE_LABELS[role] || role}.</p>
              <p>Click the button below to set your password and access the dashboard:</p>
              <p style="margin: 24px 0;">
                <a href="${linkData.properties.action_link}"
                   style="background: #1e293b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                  Set Password &amp; Sign In
                </a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                ${firmName} — powered by SurveyOS
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn("[team-invite] Invite email failed:", emailErr);
      }
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error inviting team member POST /api/team:", error);
    return NextResponse.json(
      { error: "Failed to invite team member" },
      { status: 500 }
    );
  }
}
