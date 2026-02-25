"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, Mail, MessageSquare } from "lucide-react";

type Prospect = {
  id: string;
  firmName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  firmSize: string | null;
  currentTools: string | null;
  painPoints: string | null;
  interestLevel: string | null;
  status: string;
  notes: string | null;
  followUpSentAt: string | null;
  smsSentAt: string | null;
  callId: string | null;
  createdAt: string;
  updatedAt: string;
};

type FilterTab = "all" | "new" | "contacted" | "booked";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  booked: "bg-green-50 text-green-700 border-green-200",
  converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-gray-100 text-gray-500 border-gray-200",
};

const INTEREST_COLORS: Record<string, string> = {
  hot: "bg-red-50 text-red-700 border-red-200",
  warm: "bg-orange-50 text-orange-700 border-orange-200",
  curious: "bg-blue-50 text-blue-700 border-blue-200",
};

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {children}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ProspectsClient({ prospects: initial }: { prospects: Prospect[] }) {
  const router = useRouter();
  const [prospectList, setProspectList] = useState(initial);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = prospectList.filter((p) => {
    if (tab !== "all" && p.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.firmName.toLowerCase().includes(q) ||
        p.contactName.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: prospectList.length },
    { key: "new", label: "New", count: prospectList.filter((p) => p.status === "new").length },
    { key: "contacted", label: "Contacted", count: prospectList.filter((p) => p.status === "contacted").length },
    { key: "booked", label: "Booked", count: prospectList.filter((p) => p.status === "booked").length },
  ];

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      setProspectList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
    } catch {
      alert("Failed to update status");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Prospects</h1>
        <p className="text-sm text-gray-500 mt-1">
          Inbound leads from surveying firms interested in SurveyDesk.
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-gray-400">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-8" />
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Firm</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Contact</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Interest</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Follow-up</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  {prospectList.length === 0
                    ? "No prospects yet. They'll appear here when someone calls in."
                    : "No matching prospects."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <>
                  <tr
                    key={p.id}
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${p.status === "lost" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expandedId === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.firmName}</div>
                      {p.firmSize && <div className="text-xs text-gray-400">{p.firmSize}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{p.contactName}</div>
                      <div className="text-xs text-gray-400">
                        {p.email || p.phone || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.interestLevel ? (
                        <Badge className={INTEREST_COLORS[p.interestLevel] || ""}>
                          {p.interestLevel}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={p.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border appearance-none cursor-pointer ${STATUS_COLORS[p.status] || ""}`}
                      >
                        {["new", "contacted", "booked", "converted", "lost"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.followUpSentAt && (
                          <span title={`Email sent ${formatDateTime(p.followUpSentAt)}`}>
                            <Mail size={13} className="text-blue-500" />
                          </span>
                        )}
                        {p.smsSentAt && (
                          <span title={`SMS sent ${formatDateTime(p.smsSentAt)}`}>
                            <MessageSquare size={13} className="text-green-500" />
                          </span>
                        )}
                        {!p.followUpSentAt && !p.smsSentAt && (
                          <span className="text-gray-400 text-xs">pending</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.createdAt)}</td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`} className="bg-gray-50/50">
                      <td colSpan={7} className="px-8 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm max-w-2xl">
                          {p.email && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Email</div>
                              <div className="text-gray-800">{p.email}</div>
                            </div>
                          )}
                          {p.phone && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Phone</div>
                              <div className="text-gray-800">{p.phone}</div>
                            </div>
                          )}
                          {p.currentTools && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Current Tools</div>
                              <div className="text-gray-800">{p.currentTools}</div>
                            </div>
                          )}
                          {p.painPoints && (
                            <div className="col-span-2">
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Pain Points</div>
                              <div className="text-gray-800">{p.painPoints}</div>
                            </div>
                          )}
                          {p.notes && (
                            <div className="col-span-2">
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Notes</div>
                              <div className="text-gray-800 whitespace-pre-line">{p.notes}</div>
                            </div>
                          )}
                          {p.followUpSentAt && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Email Sent</div>
                              <div className="text-gray-600">{formatDateTime(p.followUpSentAt)}</div>
                            </div>
                          )}
                          {p.smsSentAt && (
                            <div>
                              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">SMS Sent</div>
                              <div className="text-gray-600">{formatDateTime(p.smsSentAt)}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
