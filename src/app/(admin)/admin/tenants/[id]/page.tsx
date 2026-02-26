"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  Loader2,
  Check,
  Save,
  LogIn,
  RotateCcw,
  Phone,
} from "lucide-react";

type TenantUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type TenantData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  plsLicenseNumber: string | null;
  plsLicenseState: string | null;
  onboardingComplete: boolean;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  retellPhoneNumber: string | null;
  createdAt: string;
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [stats, setStats] = useState({ projectCount: 0, invoiceCount: 0 });

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/tenants/${id}`);
      if (!res.ok) {
        setError("Failed to load tenant");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);
      setTenantUsers(data.users);
      setStats(data.stats);
      setForm({
        name: data.tenant.name || "",
        email: data.tenant.email || "",
        phone: data.tenant.phone || "",
        address: data.tenant.address || "",
        city: data.tenant.city || "",
        state: data.tenant.state || "",
        zip: data.tenant.zip || "",
      });
      setLoading(false);
    }
    load();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const handleResetOnboarding = async () => {
    if (!confirm("Reset onboarding? The tenant owner will see the onboarding wizard on next login.")) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to reset");
      } else {
        setTenant((t) => t ? { ...t, onboardingComplete: false } : t);
      }
    } catch {
      setError("Network error");
    }
  };

  const handleImpersonate = async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/impersonate`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Cookie is set — navigate to dashboard which will now show the impersonated tenant
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Failed to impersonate");
      }
    } catch {
      setError("Failed to impersonate");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        Loading...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || "Tenant not found"}</p>
        <Link href="/admin/tenants" className="text-sm text-blue-600 mt-2">
          Back to Tenants
        </Link>
      </div>
    );
  }

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/admin/tenants"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Back to Tenants
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleImpersonate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
        >
          <LogIn size={14} />
          Login as Tenant
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-gray-900">
            {tenantUsers.length}
          </p>
          <p className="text-xs text-gray-500">Users</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-gray-900">
            {stats.projectCount}
          </p>
          <p className="text-xs text-gray-500">Projects</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xl font-bold text-gray-900">
            {stats.invoiceCount}
          </p>
          <p className="text-xs text-gray-500">Invoices</p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Status: </span>
              <span className={`font-medium capitalize ${
                tenant.subscriptionStatus === "active" ? "text-green-700" :
                tenant.subscriptionStatus === "trialing" ? "text-amber-700" :
                tenant.subscriptionStatus === "past_due" ? "text-red-700" :
                "text-gray-600"
              }`}>
                {tenant.subscriptionStatus || "trialing"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Plan: </span>
              <span className="font-medium text-gray-800 capitalize">
                {tenant.subscriptionPlan || "starter"}
              </span>
            </div>
            {tenant.retellPhoneNumber && (
              <div className="flex items-center gap-1">
                <Phone size={12} className="text-gray-400" />
                <span className="font-mono text-xs text-gray-600">
                  {tenant.retellPhoneNumber}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Onboarding: </span>
              <span className={`font-medium ${tenant.onboardingComplete ? "text-green-700" : "text-amber-700"}`}>
                {tenant.onboardingComplete ? "Complete" : "Incomplete"}
              </span>
            </div>
          </div>
          {tenant.onboardingComplete && (
            <button
              onClick={handleResetOnboarding}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RotateCcw size={12} />
              Reset Onboarding
            </button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-amber-600" />
          <h2 className="font-semibold text-gray-900">Firm Details</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Firm Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
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
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
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
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
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
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
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
                value={form.state}
                onChange={(e) => update("state", e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP
              </label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check size={14} className="text-green-400" />
                Saved
              </>
            ) : saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Users */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <User size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Users</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {tenantUsers.length === 0 ? (
            <div className="px-6 py-6 text-center text-gray-400 text-sm">
              No users
            </div>
          ) : (
            tenantUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {u.fullName}
                  </p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {u.role.replace("_", " ")}
                  </span>
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
