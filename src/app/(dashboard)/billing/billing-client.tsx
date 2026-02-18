"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, DollarSign, Send, AlertCircle, X, Search, MapPin, FolderOpen } from "lucide-react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  total: number;
  amountPaid: number;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  contactName: string;
  contactCompany: string | null;
  propertyAddress: string | null;
};

type Totals = {
  paidTotal: number;
  paidCount: number;
  outstandingTotal: number;
  outstandingCount: number;
  overdueTotal: number;
  overdueCount: number;
};

import { INVOICE_STATUS_COLORS as statusColor, DEFAULT_BADGE } from "@/lib/constants";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>{children}</span>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ProjectOption = {
  id: string;
  propertyAddress: string;
  contactName: string;
  surveyType: string;
};

export function BillingClient({ invoices, totals, projects }: { invoices: Invoice[]; totals: Totals; projects?: ProjectOption[] }) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const filteredProjects = (projects || []).filter(
    (p) =>
      !pickerSearch ||
      p.propertyAddress.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      p.contactName.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Invoices, payments, and accounts receivable.</p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} />New Invoice
        </button>
      </div>

      {/* Project picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Select a Project</h3>
              <button onClick={() => setShowPicker(false)} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {filteredProjects.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  <FolderOpen size={20} className="mx-auto mb-2 opacity-50" />
                  {projects?.length ? "No matching projects." : "No projects yet. Accept a proposal to create one."}
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setShowPicker(false);
                      router.push(`/projects/${p.id}`);
                    }}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                  >
                    <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{p.propertyAddress}</div>
                      <div className="text-xs text-gray-400">{p.contactName} · {p.surveyType.replace(/_/g, " ")}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { icon: DollarSign, label: "Paid", value: `$${totals.paidTotal.toLocaleString()}`, sub: `${totals.paidCount} invoices`, color: "text-emerald-600" },
          { icon: Send, label: "Outstanding", value: `$${totals.outstandingTotal.toLocaleString()}`, sub: `${totals.outstandingCount} invoices`, color: "text-blue-600" },
          { icon: AlertCircle, label: "Overdue", value: `$${totals.overdueTotal.toLocaleString()}`, sub: `${totals.overdueCount} invoices`, color: "text-red-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="p-2 rounded-lg bg-gray-50 w-fit"><stat.icon size={18} className="text-gray-500" /></div>
            <div className="mt-3">
              <div className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Invoice", "Client", "Property", "Type", "Amount", "Status", "Due"].map((h) => (
                <th key={h} className={`text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3 ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{inv.invoiceNumber}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-800">{inv.contactName}</div>
                  {inv.contactCompany && <div className="text-xs text-gray-400">{inv.contactCompany}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-40 truncate">{inv.propertyAddress || "—"}</td>
                <td className="px-4 py-3 text-sm text-gray-500 capitalize">{inv.type}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800 text-right">${inv.total.toLocaleString()}</td>
                <td className="px-4 py-3"><Badge className={statusColor[inv.status] || ""}>{inv.status.replace("_", " ")}</Badge></td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
