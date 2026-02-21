import Stripe from "stripe";

/**
 * Stripe client singleton.
 * Only usable server-side — requires STRIPE_SECRET_KEY env var.
 */
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}

export const stripe = getStripeClient();

/**
 * Map our plan names to Stripe Price IDs from env vars.
 */
export function getPriceId(plan: "starter" | "pro"): string {
  if (plan === "starter") {
    const id = process.env.STRIPE_STARTER_PRICE_ID;
    if (!id) throw new Error("STRIPE_STARTER_PRICE_ID is not set");
    return id;
  }
  if (plan === "pro") {
    const id = process.env.STRIPE_PRO_PRICE_ID;
    if (!id) throw new Error("STRIPE_PRO_PRICE_ID is not set");
    return id;
  }
  throw new Error(`Unknown plan: ${plan}`);
}

/**
 * Reverse lookup: given a Stripe Price ID, return our plan name.
 */
export function getPlanFromPriceId(priceId: string): "starter" | "pro" {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "starter"; // default fallback
}
