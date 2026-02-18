import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import Link from "next/link";
import { Building2, Users, Plus } from "lucide-react";

export default async function AdminDashboard() {
  // Get counts
  const [tenantCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants);

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  // Get recent tenants
  const recentTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      email: tenants.email,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(5);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Platform overview and management
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Building2 size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Number(tenantCount.count)}
              </p>
              <p className="text-sm text-gray-500">Total Tenants</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Number(userCount.count)}
              </p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Tenants</h2>
          <Link
            href="/admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentTenants.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No tenants yet. Create your first one!
            </div>
          ) : (
            recentTenants.map((t) => (
              <Link
                key={t.id}
                href={`/admin/tenants/${t.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.email || "No email"}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
