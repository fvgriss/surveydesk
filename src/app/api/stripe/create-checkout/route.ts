import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// POST /api/stripe/create-checkout — Create a Stripe checkout session (stub)
export async function POST() {
  try {
    const auth = await getCurrentTenant();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Implement when Stripe keys are configured
    // 1. Look up or create Stripe customer for this tenant
    // 2. Create a Stripe Checkout session with the selected price
    // 3. Return the checkout URL

    return NextResponse.json(
      { error: "Stripe is not configured yet. Contact support to set up billing." },
      { status: 501 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 }
    );
  }
}
