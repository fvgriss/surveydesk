import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { provisionRetellAgent } from "@/lib/retell/provision";

// POST /api/signup — self-service signup: creates auth user + tenant + user + Retell agent
export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, firmName, phone, state, firmSize } =
      await req.json();

    if (!fullName || !email || !password || !firmName) {
      return NextResponse.json(
        { error: "Name, email, password, and firm name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // 1. Create Supabase auth user
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email verification for now
      });

    if (authError || !authData.user) {
      // Handle duplicate email gracefully
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Try signing in." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 400 }
      );
    }

    // 2. Create tenant with 14-day trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: firmName,
        phone: phone || null,
        email: email,
        state: state || null,
        subscriptionStatus: "trialing",
        subscriptionPlan: "starter",
        trialEndsAt: trialEnd,
        onboardingComplete: false,
      })
      .returning();

    // 3. Create user record
    await db.insert(users).values({
      tenantId: newTenant.id,
      authId: authData.user.id,
      email,
      fullName,
      phone: phone || null,
      role: "owner",
    });

    // 4. Auto-provision Retell agent + phone number (non-blocking — don't fail signup if this errors)
    let retellPhoneNumber: string | null = null;
    let retellAgentId: string | null = null;

    try {
      const provision = await provisionRetellAgent({
        firmName,
        state: state || undefined,
        tenantId: newTenant.id,
      });

      retellAgentId = provision.agentId;
      retellPhoneNumber = provision.phoneNumber;

      // Update tenant with Retell info
      const { eq } = await import("drizzle-orm");
      await db
        .update(tenants)
        .set({
          retellAgentId,
          retellPhoneNumber,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, newTenant.id));

      console.log(
        `[signup] Provisioned Retell for ${firmName}: agent=${retellAgentId}, phone=${retellPhoneNumber}`
      );
    } catch (retellErr) {
      // Log but don't fail the signup — they can set up Retell later
      console.error(
        "[signup] Retell provisioning failed (non-fatal):",
        retellErr instanceof Error ? retellErr.message : retellErr
      );
    }

    return NextResponse.json({
      success: true,
      retellPhoneNumber,
      firmSize: firmSize || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Signup failed: ${message}` },
      { status: 500 }
    );
  }
}
