"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2 } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  userCount: number;
};

export function TenantsClient({ tenants }: { tenants: Tenant[] }) {
  const [search, setSearch] = useState("");

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(search.toLowerCase())) ||
      (t.city && t.city.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenants.length} firm{tenants.length !== 1 ? "s" : ""} on the
            platform
          </p>
        </div>
        <Link
          href="/admin/tenants/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus size={16} />
          New Tenant
        </Link>
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Firm Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Email
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Location
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                Users
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {search ? "No tenants match your search." : "No tenants yet."}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-slate-500" />
                      </div>
                      <span className="font-medium text-gray-900">
                        {t.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.city && t.state
                      ? `${t.city}, ${t.state}`
                      : t.state || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      {t.userCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
