"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

/**
 * Format E.164 phone number (+15205551234) to human-readable ((520) 555-1234)
 */
function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  // Handle +1XXXXXXXXXX
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return e164;
}

interface TenantData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  plsLicenseNumber: string;
  plsLicenseState: string;
  serviceAreaCounties: string;
}

interface Props {
  ownerName: string;
  retellPhoneNumber: string | null;
  tenant: TenantData;
}

export function OnboardingClient({ ownerName, retellPhoneNumber, tenant }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TenantData>(tenant);

  const firstName = ownerName.split(" ")[0] || ownerName;
  const totalSteps = 3; // welcome, address, credentials

  const update = (field: keyof TenantData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveAndContinue = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setStep((s) => s + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    setError("");
    setSaving(true);
    try {
      // Save final step data
      const settingsRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!settingsRes.ok) throw new Error("Failed to save settings");

      // Mark onboarding complete
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? "w-8 bg-blue-600"
                  : i < step
                  ? "w-2 bg-blue-400"
                  : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-gray-900">SurveyDesk</span>
          </div>

          {/* Step 0: Welcome — Your AI Phone Agent */}
          {step === 0 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Welcome, {firstName}!
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Your AI phone agent is ready to go.
              </p>

              {/* Phone number display */}
              {retellPhoneNumber ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                      Your SurveyDesk Number
                    </p>
                    <p className="text-2xl font-bold text-blue-900 tracking-tight">
                      {formatPhone(retellPhoneNumber)}
                    </p>
                    <p className="text-sm text-blue-700 mt-2">
                      Any call to this number gets answered, qualified, and turned into a lead in your dashboard.
                    </p>
                  </div>

                  {/* Try It Now */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5">
                    <p className="font-medium text-green-900 mb-1">
                      Try it now
                    </p>
                    <p className="text-sm text-green-700">
                      Call <span className="font-semibold">{formatPhone(retellPhoneNumber)}</span> from your cell phone. Pretend you&apos;re a homeowner who needs a boundary survey. The AI will handle the call, and you&apos;ll see the lead appear in your dashboard in about 30 seconds.
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
                  <p className="font-medium text-amber-900 mb-1">
                    AI phone agent
                  </p>
                  <p className="text-sm text-amber-700">
                    Your AI phone number will be activated when you subscribe. Once active, every inbound call gets answered, qualified, and turned into a lead automatically.
                  </p>
                </div>
              )}

              {/* Set Up Forwarding */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <p className="font-medium text-gray-900 mb-1">
                  Set up forwarding (optional)
                </p>
                <p className="text-sm text-gray-600">
                  Ready to go live? Forward your office number to your SurveyDesk number so every real call gets answered.{" "}
                  <Link
                    href="/setup-forwarding"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    target="_blank"
                  >
                    View forwarding guide &rarr;
                  </Link>
                </p>
              </div>

              {/* Firm basics (name, phone, email) — pre-filled from signup */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Firm Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Land Surveying"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firm Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(512) 555-1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firm Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="office@yourfirm.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Address */}
          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Where are you located?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Your firm&apos;s address shows up on proposals and invoices.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Austin"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <select
                      value={form.state}
                      onChange={(e) => update("state", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">--</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={(e) => update("zip", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="78701"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Info */}
          {step === 2 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Professional credentials
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Optional but recommended. You can always update this later in Settings.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PLS License #
                    </label>
                    <input
                      type="text"
                      value={form.plsLicenseNumber}
                      onChange={(e) => update("plsLicenseNumber", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <select
                      value={form.plsLicenseState}
                      onChange={(e) => update("plsLicenseState", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">--</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Area Counties
                  </label>
                  <input
                    type="text"
                    value={form.serviceAreaCounties}
                    onChange={(e) => update("serviceAreaCounties", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Travis, Williamson, Hays"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Comma-separated list of counties you serve
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps - 1 ? (
              <button
                onClick={saveAndContinue}
                disabled={saving}
                className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            ) : (
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? "Finishing up..." : "Go to Dashboard"}
              </button>
            )}
          </div>
        </div>

        {/* Skip link */}
        {step === totalSteps - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={completeOnboarding}
              className="text-xs text-gray-400 hover:text-gray-500"
            >
              Skip for now — I&apos;ll fill this in later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
