import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";

// POST /api/signup — self-service signup: creates auth user + tenant + user
export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, firmName } = await req.json();

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
      role: "owner",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Signup failed: ${message}` },
      { status: 500 }
    );
  }
}
