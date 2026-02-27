"use client";

import { useState, useEffect } from "react";
import { formatPhone } from "@/lib/utils/format-phone";

type Tenant = {
  id: string;
  name: string;
  retellPhoneNumber: string | null;
  retellAgentId: string | null;
};

export default function ReassignPhonePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("+15203958211");
  const [toTenantId, setToTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch tenants to populate the dropdown
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTenants(data);
        else if (data.tenants) setTenants(data.tenants);
      })
      .catch(() => {});
  }, []);

  async function handleReassign() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/reassign-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, toTenantId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.message);
      } else {
        setError(data.error || "Failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Reassign Phone Number</h1>
      <p className="text-sm text-gray-500 mb-6">
        Move a Retell phone number from one tenant to another. Calls to this number will route to the new tenant's AI agent.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (E.164)</label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15203958211"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Must include country code, e.g. +15203958211</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Route calls to</label>
          <select
            value={toTenantId}
            onChange={(e) => setToTenantId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.retellPhoneNumber ? `(${formatPhone(t.retellPhoneNumber)})` : "(no phone)"} {!t.retellAgentId ? "⚠️ no agent" : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleReassign}
          disabled={loading || !toTenantId || !phoneNumber}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Reassigning..." : "Reassign Phone Number"}
        </button>

        {result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            {result}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
