"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Search, Clock, Hammer, CheckCircle, Archive } from "lucide-react";

const SURVEY_TYPE_LABELS: Record<string, string> = {
  boundary: "Boundary",
  alta: "ALTA/NSPS",
  topographic: "Topo",
  as_built: "As-Built",
  subdivision: "Subdivision",
  construction: "Construction",
  elevation_cert: "Elev. Cert",
  route: "Route",
  other: "Other",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  field_complete: { label: "Field Complete", className: "bg-indigo-100 text-indigo-700" },
  drafting: { label: "Drafting", className: "bg-purple-100 text-purple-700" },
  review: { label: "Review", className: "bg-cyan-100 text-cyan-700" },
  delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-500" },
  on_hold: { label: "On Hold", className: "bg-red-100 text-red-700" },
};

type Project = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  contractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  contactName: string;
  contactCompany: string | null;
  createdAt: string;
};

type Stats = {
  pendingCount: number;
  pendingValue: number;
  activeCount: number;
  activeValue: number;
  deliveredCount: number;
  deliveredValue: number;
  closedCount: number;
  closedValue: number;
};

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function ProjectsClient({
  projects,
  stats,
}: {
  projects: Project[];
  stats: Stats;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = projects.filter((p) => {
    const matchSearch =
      !search ||
      p.propertyAddress.toLowerCase().includes(search.toLowerCase()) ||
      p.contactName.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" &&
        ["in_progress", "field_complete", "drafting", "review"].includes(p.status)) ||
      p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All survey projects from accepted proposals.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-gray-500">Pending</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{stats.pendingCount}</div>
          <div className="text-xs text-gray-400">{fmt(stats.pendingValue)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Hammer size={14} className="text-blue-500" />
            <span className="text-xs font-medium text-gray-500">Active</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{stats.activeCount}</div>
          <div className="text-xs text-gray-400">{fmt(stats.activeValue)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-gray-500">Delivered</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{stats.deliveredCount}</div>
          <div className="text-xs text-gray-400">{fmt(stats.deliveredValue)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Archive size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Closed</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{stats.closedCount}</div>
          <div className="text-xs text-gray-400">{fmt(stats.closedValue)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search address or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active (In Progress)</option>
          <option value="field_complete">Field Complete</option>
          <option value="drafting">Drafting</option>
          <option value="review">Review</option>
          <option value="delivered">Delivered</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                Property Address
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                Survey Type
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                Contact
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                Status
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">
                Contract
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">
                Invoiced
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">
                Paid
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  <FolderOpen size={24} className="mx-auto mb-2 opacity-50" />
                  No projects found.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const badge = STATUS_BADGES[p.status] || STATUS_BADGES.pending;
              return (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {p.propertyAddress}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {SURVEY_TYPE_LABELS[p.surveyType] || p.surveyType}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800">{p.contactName}</div>
                    {p.contactCompany && (
                      <div className="text-xs text-gray-400">{p.contactCompany}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">
                    {fmt(p.contractValue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {fmt(p.totalInvoiced)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={p.totalPaid > 0 ? "text-emerald-600 font-medium" : "text-gray-400"}>
                      {fmt(p.totalPaid)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
