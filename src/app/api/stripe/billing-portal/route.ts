import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/stripe/billing-portal
 *
 * Creates a Stripe Billing Portal session so the customer can
 * manage their payment method, view invoices, or cancel.
 */
export async function POST() {
  try {
    const auth = await getCurrentTenant();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [tenant] = await db
      .select({
        id: tenants.id,
        stripeCustomerId: tenants.stripeCustomerId,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!tenant.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app";

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/subscription`,
    });

    console.log(
      `[Stripe] Created billing portal session for tenant ${tenant.id}`
    );

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe] Billing portal error:", message);

    if (message.includes("STRIPE_SECRET_KEY") || message.includes("STRIPE_")) {
      return NextResponse.json(
        { error: "Stripe billing is not configured yet. Contact support." },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: `Portal failed: ${message}` },
      { status: 500 }
    );
  }
}
