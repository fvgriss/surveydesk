import { NextRequest, NextResponse } from "next/server";

// POST /api/stripe/webhook — Stripe webhook handler (stub)
// This will process subscription events from Stripe once integrated.
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // TODO: Verify Stripe webhook signature
    // const sig = req.headers.get("stripe-signature");
    // const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    // TODO: Handle events:
    // - checkout.session.completed → activate subscription
    // - customer.subscription.updated → update status
    // - customer.subscription.deleted → mark canceled
    // - invoice.payment_failed → mark past_due

    console.log("[Stripe Webhook] Received event (stub handler)", body.slice(0, 100));

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
