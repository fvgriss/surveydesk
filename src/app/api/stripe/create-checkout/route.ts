import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { stripe, getPriceId } from "@/lib/stripe";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/stripe/create-checkout
 *
 * Creates a Stripe Checkout session for subscribing to a plan.
 * Body: { plan: "starter" | "pro" }
 * Returns: { url: string } — redirect the user to this Stripe-hosted page.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentTenant();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();
    if (plan !== "starter" && plan !== "pro") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Look up tenant
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
        stripeCustomerId: tenants.stripeCustomerId,
        subscriptionStatus: tenants.subscriptionStatus,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = tenant.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.email || undefined,
        metadata: { tenantId: tenant.id },
      });

      customerId = customer.id;

      // Save to DB
      await db
        .update(tenants)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));

      console.log(`[Stripe] Created customer ${customerId} for tenant ${tenant.id}`);
    }

    // Resolve price ID
    const priceId = getPriceId(plan);

    // Build checkout session params
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app";

    // No trial_end — when they click Subscribe, charge immediately.
    // They already have a free trial with us; Stripe should collect payment right away.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/subscription?success=true`,
      cancel_url: `${appUrl}/subscription`,
      metadata: { tenantId: tenant.id },
      subscription_data: {
        metadata: { tenantId: tenant.id },
      },
    });

    console.log(`[Stripe] Created checkout session ${session.id} for tenant ${tenant.id} (${plan})`);

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe] Checkout error:", message);

    // If Stripe isn't configured, return a friendly error
    if (message.includes("STRIPE_SECRET_KEY") || message.includes("STRIPE_")) {
      return NextResponse.json(
        { error: "Stripe billing is not configured yet. Contact support." },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 }
    );
  }
}
