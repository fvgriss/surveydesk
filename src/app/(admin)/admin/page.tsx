import { db } from "@/db";
import { tenants, users, prospects } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Building2, Users, Plus, Clock, CreditCard, Zap, Megaphone } from "lucide-react";

export default async function AdminDashboard() {
  // Get counts
  const [tenantCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants);

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  // Subscription breakdown
  const [trialingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(eq(tenants.subscriptionStatus, "trialing"));

  const [activeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(eq(tenants.subscriptionStatus, "active"));

  // New prospects
  const [newProspectCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prospects)
    .where(eq(prospects.status, "new"));

  // Signups in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [recentSignups] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenants)
    .where(sql`${tenants.createdAt} >= ${sevenDaysAgo.toISOString()}`);

  // Get recent tenants with subscription info
  const recentTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      email: tenants.email,
      subscriptionStatus: tenants.subscriptionStatus,
      subscriptionPlan: tenants.subscriptionPlan,
      trialEndsAt: tenants.trialEndsAt,
      retellPhoneNumber: tenants.retellPhoneNumber,
      onboardingComplete: tenants.onboardingComplete,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(10);

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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Building2 size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(tenantCount.count)}
              </p>
              <p className="text-xs text-gray-500">Tenants</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(userCount.count)}
              </p>
              <p className="text-xs text-gray-500">Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Clock size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(trialingCount.count)}
              </p>
              <p className="text-xs text-gray-500">Trialing</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CreditCard size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(activeCount.count)}
              </p>
              <p className="text-xs text-gray-500">Paid</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Zap size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(recentSignups.count)}
              </p>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </div>
          </div>
        </div>
        <Link href="/admin/prospects" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Megaphone size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {Number(newProspectCount.count)}
              </p>
              <p className="text-xs text-gray-500">New Prospects</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Tenants */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Signups</h2>
          <Link
            href="/admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Firm</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Trial / Renewal</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No tenants yet. Create your first one!
                  </td>
                </tr>
              ) : (
                recentTenants.map((t) => {
                  const now = new Date();
                  const trialEnd = t.trialEndsAt ? new Date(t.trialEndsAt) : null;
                  const daysLeft = trialEnd
                    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : null;
                  const trialExpired = daysLeft !== null && daysLeft <= 0;

                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/tenants/${t.id}`} className="hover:underline">
                          <span className="font-medium text-gray-900">{t.name}</span>
                          {!t.onboardingComplete && (
                            <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                              ONBOARDING
                            </span>
                          )}
                        </Link>
                        <p className="text-xs text-gray-400">{t.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.subscriptionStatus || "trialing"} expired={trialExpired} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {t.subscriptionPlan || "starter"}
                      </td>
                      <td className="px-4 py-3">
                        {t.subscriptionStatus === "active" ? (
                          <span className="text-gray-600">
                            {trialEnd ? trialEnd.toLocaleDateString() : "—"}
                          </span>
                        ) : daysLeft !== null ? (
                          <span className={trialExpired ? "text-red-600 font-medium" : daysLeft <= 3 ? "text-orange-600 font-medium" : "text-gray-600"}>
                            {trialExpired ? "Expired" : `${daysLeft}d left`}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {t.retellPhoneNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
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
    </div>
  );
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Active
      </span>
    );
  }
  if (status === "trialing" && expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Expired
      </span>
    );
  }
  if (status === "trialing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-orange-50 text-orange-700">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Trial
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Past Due
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Canceled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
      {status}
    </span>
  );
}
