"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, User, Loader2, Check } from "lucide-react";

export default function CreateTenantPage() {
  return (
    <Suspense>
      <CreateTenantForm />
    </Suspense>
  );
}

function CreateTenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firmName: searchParams.get("firmName") || "",
    firmEmail: searchParams.get("firmEmail") || "",
    firmPhone: searchParams.get("firmPhone") || "",
    firmAddress: "",
    firmCity: "",
    firmState: "",
    firmZip: "",
    ownerName: searchParams.get("ownerName") || "",
    ownerEmail: searchParams.get("ownerEmail") || "",
    ownerPassword: "",
  });

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create tenant");
        setSaving(false);
        return;
      }

      router.push(`/admin/tenants/${data.tenant.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/admin/tenants"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Back to Tenants
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Create New Tenant
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Set up a new firm and their owner account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Firm Details */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900">Firm Details</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firm Name *
              </label>
              <input
                type="text"
                required
                value={form.firmName}
                onChange={(e) => update("firmName", e.target.value)}
                placeholder="e.g. Precision Land Surveying"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.firmEmail}
                  onChange={(e) => update("firmEmail", e.target.value)}
                  placeholder="office@example.com"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.firmPhone}
                  onChange={(e) => update("firmPhone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={form.firmAddress}
                onChange={(e) => update("firmAddress", e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.firmCity}
                  onChange={(e) => update("firmCity", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.firmState}
                  onChange={(e) =>
                    update("firmState", e.target.value.toUpperCase())
                  }
                  placeholder="AZ"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={form.firmZip}
                  onChange={(e) => update("firmZip", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Owner Details */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Owner Account</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            This creates the login credentials for the firm owner.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={form.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => update("ownerEmail", e.target.value)}
                placeholder="john@example.com"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password *
              </label>
              <input
                type="text"
                required
                minLength={8}
                value={form.ownerPassword}
                onChange={(e) => update("ownerPassword", e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Share this with the owner so they can log in. They can change it
                later.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check size={16} />
              Create Tenant
            </>
          )}
        </button>
      </form>
    </div>
  );
}
