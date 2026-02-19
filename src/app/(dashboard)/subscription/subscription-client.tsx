"use client";

interface Props {
  subscription: {
    status: string;
    plan: string;
    trialEndsAt: string | null;
    hasStripe: boolean;
  };
  firmName: string;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 299,
    description: "Everything you need to run your surveying firm",
    features: [
      "AI phone intake agent",
      "Unlimited leads & proposals",
      "Project management",
      "Invoicing & payments",
      "Field crew scheduling",
      "Up to 5 team members",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 499,
    description: "For growing firms that need more power",
    features: [
      "Everything in Starter",
      "Unlimited team members",
      "Custom proposal templates",
      "Priority support",
      "API access",
      "Multi-office support",
    ],
  },
];

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  trialing: { label: "Trial", color: "bg-amber-50 text-amber-700 border-amber-200" },
  active: { label: "Active", color: "bg-green-50 text-green-700 border-green-200" },
  past_due: { label: "Past Due", color: "bg-red-50 text-red-700 border-red-200" },
  canceled: { label: "Canceled", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export function SubscriptionClient({ subscription, firmName }: Props) {
  const currentPlan = PLANS.find((p) => p.id === subscription.plan) || PLANS[0];
  const statusBadge = STATUS_BADGES[subscription.status] || STATUS_BADGES.trialing;

  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your plan and billing for {firmName}
        </p>
      </div>

      {/* Trial Banner */}
      {subscription.status === "trialing" && trialDaysLeft !== null && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">
              {trialDaysLeft > 0
                ? `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}`
                : "Your free trial has ended"}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Subscribe to keep using SurveyDesk after your trial.
            </p>
          </div>
          <button
            disabled
            className="bg-amber-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
            title="Stripe integration coming soon"
          >
            Subscribe Now
          </button>
        </div>
      )}

      {/* Past Due Banner */}
      {subscription.status === "past_due" && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Your payment is past due. Please update your payment method to continue using SurveyDesk.
          </p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentPlan.name} Plan
              </h2>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{currentPlan.description}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-gray-900">${currentPlan.price}</span>
            <span className="text-sm text-gray-500">/month</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Included in your plan
          </p>
          <div className="grid grid-cols-2 gap-2">
            {currentPlan.features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === subscription.plan;
          return (
            <div
              key={plan.id}
              className={`border rounded-xl p-5 ${
                isCurrent
                  ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                {isCurrent && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white opacity-50 cursor-not-allowed"
                }`}
                title="Stripe integration coming soon"
              >
                {isCurrent ? "Current Plan" : plan.id === "pro" ? "Upgrade" : "Downgrade"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Billing Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Billing</h2>
        <p className="text-sm text-gray-500 mb-4">
          Manage your payment method and view invoices.
        </p>
        <div className="flex gap-3">
          <button
            disabled
            className="bg-gray-100 text-gray-400 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed"
            title="Stripe integration coming soon"
          >
            Manage Payment Method
          </button>
          <button
            disabled
            className="bg-gray-100 text-gray-400 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed"
            title="Stripe integration coming soon"
          >
            View Invoices
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Stripe billing integration coming soon. Contact support for billing questions.
        </p>
      </div>
    </div>
  );
}
