"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, RefreshCw } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  trialEndsAt: string | null;
  retellPhoneNumber: string | null;
  onboardingComplete: boolean | null;
  createdAt: string;
  userCount: number;
};

type FilterTab = "all" | "trialing" | "active" | "expired";

function getDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status, daysLeft }: { status: string; daysLeft: number | null }) {
  const expired = status === "trialing" && daysLeft !== null && daysLeft <= 0;

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Active
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Expired
      </span>
    );
  }
  if (status === "trialing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Trial
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Past Due
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Canceled
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-500">{status}</span>
  );
}

export function TenantsClient({ tenants: initialTenants }: { tenants: Tenant[] }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [tenantList, setTenantList] = useState(initialTenants);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [updatingAgents, setUpdatingAgents] = useState(false);
  const [agentUpdateResult, setAgentUpdateResult] = useState<{ updated: number; failed: number } | null>(null);

  const tenants = tenantList;

  async function handleProvision(tenantId: string) {
    setProvisioning(tenantId);
    setProvisionError(null);
    try {
      const res = await fetch("/api/admin/provision-retell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Provisioning failed");

      // Update the tenant in our local state
      setTenantList((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? { ...t, retellPhoneNumber: data.phoneNumber }
            : t
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setProvisionError(`Failed for tenant ${tenantId}: ${msg}`);
    } finally {
      setProvisioning(null);
    }
  }

  async function handleUpdateAllAgents() {
    setUpdatingAgents(true);
    setAgentUpdateResult(null);
    try {
      const res = await fetch("/api/admin/update-agents", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setAgentUpdateResult({ updated: data.updated, failed: data.failed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setProvisionError(`Agent update failed: ${msg}`);
    } finally {
      setUpdatingAgents(false);
    }
  }

  const filtered = tenants.filter((t) => {
    // Search filter
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(search.toLowerCase())) ||
      (t.city && t.city.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    // Tab filter
    const daysLeft = getDaysLeft(t.trialEndsAt);
    const status = t.subscriptionStatus || "trialing";

    if (tab === "trialing") return status === "trialing" && (daysLeft === null || daysLeft > 0);
    if (tab === "active") return status === "active";
    if (tab === "expired") return status === "trialing" && daysLeft !== null && daysLeft <= 0;
    return true;
  });

  // Counts for tabs
  const counts = {
    all: tenants.length,
    trialing: tenants.filter((t) => {
      const dl = getDaysLeft(t.trialEndsAt);
      return (t.subscriptionStatus || "trialing") === "trialing" && (dl === null || dl > 0);
    }).length,
    active: tenants.filter((t) => t.subscriptionStatus === "active").length,
    expired: tenants.filter((t) => {
      const dl = getDaysLeft(t.trialEndsAt);
      return (t.subscriptionStatus || "trialing") === "trialing" && dl !== null && dl <= 0;
    }).length,
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "trialing", label: `Trialing (${counts.trialing})` },
    { key: "active", label: `Paid (${counts.active})` },
    { key: "expired", label: `Expired (${counts.expired})` },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenants.length} firm{tenants.length !== 1 ? "s" : ""} on the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdateAllAgents}
            disabled={updatingAgents}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              updatingAgents
                ? "bg-gray-100 text-gray-400 cursor-wait"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <RefreshCw size={16} className={updatingAgents ? "animate-spin" : ""} />
            {updatingAgents ? "Updating..." : "Update All Agents"}
          </button>
          <Link
            href="/admin/tenants/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <Plus size={16} />
            New Tenant
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search by name, email, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Provision error */}
      {provisionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-800">{provisionError}</p>
          <button onClick={() => setProvisionError(null)} className="text-red-500 hover:text-red-700 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Agent update result */}
      {agentUpdateResult && (
        <div className={`mb-4 rounded-lg px-4 py-3 flex items-center justify-between ${
          agentUpdateResult.failed > 0
            ? "bg-yellow-50 border border-yellow-200"
            : "bg-green-50 border border-green-200"
        }`}>
          <p className={`text-sm ${agentUpdateResult.failed > 0 ? "text-yellow-800" : "text-green-800"}`}>
            Updated {agentUpdateResult.updated} agent{agentUpdateResult.updated !== 1 ? "s" : ""}
            {agentUpdateResult.failed > 0 && `, ${agentUpdateResult.failed} failed`}
          </p>
          <button onClick={() => setAgentUpdateResult(null)} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Firm Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Plan
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Trial / Renewal
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Retell Phone
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Location
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                Users
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Signed Up
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {search || tab !== "all"
                    ? "No tenants match your filters."
                    : "No tenants yet."}
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const daysLeft = getDaysLeft(t.trialEndsAt);
                const status = t.subscriptionStatus || "trialing";
                const trialExpired = status === "trialing" && daysLeft !== null && daysLeft <= 0;

                return (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-slate-500" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">
                            {t.name}
                          </span>
                          {!t.onboardingComplete && (
                            <span className="ml-1.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                              ONBOARDING
                            </span>
                          )}
                          <p className="text-xs text-gray-400">{t.email || "—"}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} daysLeft={daysLeft} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                      {t.subscriptionPlan || "starter"}
                    </td>
                    <td className="px-4 py-3">
                      {status === "active" && t.trialEndsAt ? (
                        <span className="text-xs text-gray-600">
                          Renews {new Date(t.trialEndsAt).toLocaleDateString()}
                        </span>
                      ) : daysLeft !== null ? (
                        <span
                          className={`text-xs font-medium ${
                            trialExpired
                              ? "text-red-600"
                              : daysLeft <= 3
                              ? "text-orange-600"
                              : "text-gray-600"
                          }`}
                        >
                          {trialExpired ? "Expired" : `${daysLeft}d left`}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.retellPhoneNumber ? (
                        <span className="text-xs text-gray-600 font-mono">
                          {t.retellPhoneNumber}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleProvision(t.id)}
                          disabled={provisioning !== null}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                            provisioning === t.id
                              ? "bg-blue-100 text-blue-500 cursor-wait"
                              : provisioning !== null
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                          }`}
                        >
                          {provisioning === t.id ? "Provisioning..." : "Provision"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.city && t.state
                        ? `${t.city}, ${t.state}`
                        : t.state || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {t.userCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
