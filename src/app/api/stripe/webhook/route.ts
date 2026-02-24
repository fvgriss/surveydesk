import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Must be public (no auth) — Stripe sends events directly here.
 */
export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get("stripe-signature");

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "not configured" }, { status: 500 });
    }

    if (!signature) {
      console.error("[Stripe webhook] Missing stripe-signature header");
      return NextResponse.json({ error: "missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error("[Stripe webhook] Signature verification failed:", msg);
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }

    console.log(`[Stripe webhook] event=${event.type}, id=${event.id}`);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] Error:", error);
    return NextResponse.json(
      { error: "webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * checkout.session.completed
 * Fired when a customer completes the Stripe Checkout flow.
 * Activates their subscription in our DB.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) {
    console.error("[Stripe webhook] checkout.session.completed missing tenantId in metadata");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.error("[Stripe webhook] checkout.session.completed missing subscription ID");
    return;
  }

  // Fetch the subscription to get the price → plan mapping
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : "starter";

  // Map Stripe subscription status to our status
  const status = mapStripeStatus(subscription.status);

  // Fetch tenant to check if Retell is already provisioned
  const [tenant] = await db
    .select({
      name: tenants.name,
      state: tenants.state,
      retellAgentId: tenants.retellAgentId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: status,
      subscriptionPlan: plan,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(
    `[Stripe webhook] Activated subscription for tenant ${tenantId}: plan=${plan}, status=${status}`
  );

  // Auto-provision Retell if not already set up (non-blocking)
  if (tenant && !tenant.retellAgentId) {
    try {
      const { provisionRetellAgent } = await import("@/lib/retell/provision");
      const provision = await provisionRetellAgent({
        firmName: tenant.name,
        state: tenant.state || undefined,
        tenantId,
      });

      await db
        .update(tenants)
        .set({
          retellAgentId: provision.agentId,
          retellPhoneNumber: provision.phoneNumber,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      console.log(
        `[Stripe webhook] Auto-provisioned Retell for ${tenant.name}: phone=${provision.phoneNumber}`
      );
    } catch (retellErr) {
      console.error(
        "[Stripe webhook] Retell auto-provision failed (non-fatal):",
        retellErr instanceof Error ? retellErr.message : retellErr
      );
    }
  }
}

/**
 * customer.subscription.updated
 * Fired when a subscription changes (plan change, status change, renewal, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  // Look up tenant by subscription ID
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeSubscriptionId, subscriptionId))
    .limit(1);

  // Fallback: check metadata
  const tenantId = tenant?.id || subscription.metadata?.tenantId;
  if (!tenantId) {
    console.error(`[Stripe webhook] subscription.updated — no tenant for sub ${subscriptionId}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : undefined;
  const status = mapStripeStatus(subscription.status);

  await db
    .update(tenants)
    .set({
      subscriptionStatus: status,
      ...(plan ? { subscriptionPlan: plan } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(
    `[Stripe webhook] Updated subscription for tenant ${tenantId}: status=${status}${plan ? `, plan=${plan}` : ""}`
  );
}

/**
 * customer.subscription.deleted
 * Fired when a subscription is canceled (immediately or at period end).
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeSubscriptionId, subscriptionId))
    .limit(1);

  const tenantId = tenant?.id || subscription.metadata?.tenantId;
  if (!tenantId) {
    console.error(`[Stripe webhook] subscription.deleted — no tenant for sub ${subscriptionId}`);
    return;
  }

  await db
    .update(tenants)
    .set({
      subscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  console.log(`[Stripe webhook] Canceled subscription for tenant ${tenantId}`);
}

/**
 * invoice.payment_failed
 * Fired when a recurring payment fails.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!tenant) {
    console.error(`[Stripe webhook] payment_failed — no tenant for sub ${subscriptionId}`);
    return;
  }

  await db
    .update(tenants)
    .set({
      subscriptionStatus: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  console.log(`[Stripe webhook] Payment failed for tenant ${tenant.id} — marked past_due`);
}

/**
 * Map Stripe's subscription status to our internal status.
 * Stripe statuses: incomplete, incomplete_expired, trialing, active,
 * past_due, canceled, unpaid, paused
 */
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active"; // incomplete, paused → treat as active for now
  }
}
