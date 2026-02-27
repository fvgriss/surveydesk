"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Loader2, Plus, X, UserPlus, Check } from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const ROLE_OPTIONS = [
  { value: "office_manager", label: "Office Manager" },
  { value: "crew_chief", label: "Crew Chief" },
  { value: "instrument_person", label: "Instrument Person" },
];

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

interface TeamInvite {
  email: string;
  role: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

interface Props {
  ownerName: string;
  retellPhoneNumber: string | null;
  subscriptionStatus: string;
  firmName: string;
  tenant: TenantData;
}

export function OnboardingClient({ ownerName, retellPhoneNumber: initialPhone, subscriptionStatus, firmName, tenant }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TenantData>(tenant);

  // Phone provisioning state
  const [phoneNumber, setPhoneNumber] = useState<string | null>(initialPhone);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState("");

  // Team invite state
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("crew_chief");

  const firstName = ownerName.split(" ")[0] || ownerName;
  const totalSteps = 4; // welcome, address, credentials, team

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
      const settingsRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!settingsRes.ok) throw new Error("Failed to save settings");

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

  const provisionPhone = async () => {
    setProvisioning(true);
    setProvisionError("");
    try {
      const res = await fetch("/api/provision-phone", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision phone");
      setPhoneNumber(data.phoneNumber);
    } catch (err: unknown) {
      setProvisionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setProvisioning(false);
    }
  };

  const addInvite = () => {
    if (!newEmail.trim()) return;
    if (invites.some((i) => i.email.toLowerCase() === newEmail.toLowerCase().trim())) return;
    setInvites((prev) => [...prev, { email: newEmail.trim(), role: newRole, status: "pending" }]);
    setNewEmail("");
  };

  const removeInvite = (email: string) => {
    setInvites((prev) => prev.filter((i) => i.email !== email));
  };

  const sendInvites = async () => {
    const pending = invites.filter((i) => i.status === "pending");
    if (pending.length === 0) return;

    for (const invite of pending) {
      setInvites((prev) =>
        prev.map((i) => (i.email === invite.email ? { ...i, status: "sending" } : i))
      );

      try {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: invite.email,
            fullName: invite.email.split("@")[0],
            role: invite.role,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to invite");
        }
        setInvites((prev) =>
          prev.map((i) => (i.email === invite.email ? { ...i, status: "sent" } : i))
        );
      } catch (err) {
        setInvites((prev) =>
          prev.map((i) =>
            i.email === invite.email
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : i
          )
        );
      }
    }
  };

  const canProvision = subscriptionStatus === "trialing" || subscriptionStatus === "active";

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
                Let&apos;s get your AI phone agent set up.
              </p>

              {/* Phone number display */}
              {phoneNumber ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                      Your SurveyDesk Number
                    </p>
                    <p className="text-2xl font-bold text-blue-900 tracking-tight">
                      {formatPhone(phoneNumber)}
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
                      Call <span className="font-semibold">{formatPhone(phoneNumber)}</span> from your cell phone. Pretend you&apos;re a homeowner who needs a boundary survey. The AI will handle the call, and you&apos;ll see the lead appear in your dashboard in about 30 seconds.
                    </p>
                  </div>
                </>
              ) : canProvision ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Phone size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 mb-1">
                        AI Phone Agent
                      </p>
                      <p className="text-sm text-blue-700 mb-3">
                        Every inbound call gets answered, qualified, and turned into a lead automatically. Activate your phone number to try it.
                      </p>
                      <button
                        onClick={provisionPhone}
                        disabled={provisioning}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                      >
                        {provisioning ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Setting up your number...
                          </>
                        ) : (
                          <>
                            <Phone size={14} />
                            Activate Your AI Phone Agent
                          </>
                        )}
                      </button>
                      {provisionError && (
                        <p className="text-sm text-red-600 mt-2">{provisionError}</p>
                      )}
                    </div>
                  </div>
                </div>
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
              {phoneNumber && (
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
              )}

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

          {/* Step 3: Invite Team */}
          {step === 3 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Invite your team
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Add office staff and field crew so they can access {firmName}&apos;s dashboard. You can always add more from Settings.
              </p>

              {/* Add invite form */}
              <div className="flex gap-2 mb-4">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                  placeholder="colleague@email.com"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <button
                  onClick={addInvite}
                  disabled={!newEmail.trim()}
                  className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Invite list */}
              {invites.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {invites.map((invite) => (
                    <div
                      key={invite.email}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <UserPlus size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{invite.email}</p>
                          <p className="text-xs text-gray-400">
                            {ROLE_OPTIONS.find((r) => r.value === invite.role)?.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {invite.status === "sent" && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check size={12} /> Sent
                          </span>
                        )}
                        {invite.status === "sending" && (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        )}
                        {invite.status === "error" && (
                          <span className="text-xs text-red-500">{invite.error}</span>
                        )}
                        {invite.status === "pending" && (
                          <button
                            onClick={() => removeInvite(invite.email)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No team members added yet. Add emails above or skip this step.
                </div>
              )}

              {/* Send invites button */}
              {invites.some((i) => i.status === "pending") && (
                <button
                  onClick={sendInvites}
                  className="w-full bg-blue-50 text-blue-700 font-medium py-2 px-4 rounded-lg hover:bg-blue-100 transition-colors text-sm border border-blue-200"
                >
                  Send {invites.filter((i) => i.status === "pending").length} Invite{invites.filter((i) => i.status === "pending").length !== 1 ? "s" : ""}
                </button>
              )}
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

        {/* Skip link — show on credentials and team invite steps */}
        {(step === 2 || step === 3) && (
          <div className="text-center mt-4">
            <button
              onClick={step === totalSteps - 1 ? completeOnboarding : () => setStep((s) => s + 1)}
              className="text-xs text-gray-400 hover:text-gray-500"
            >
              Skip for now — I&apos;ll do this later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
