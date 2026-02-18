"use client";

import Link from "next/link";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  FileText,
  Calendar,
  DollarSign,
  ChevronRight,
  MapPin,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  FolderOpen,
  Sunrise,
} from "lucide-react";

type Pipeline = {
  newLeads: number;
  qualifying: number;
  proposalsOut: number;
  proposalsValue: number;
  activeProjects: number;
  activeValue: number;
};

type Visit = {
  id: string;
  timeWindow: string;
  status: string;
  projectAddress: string;
  surveyType: string;
  contactName: string;
  crewName: string | null;
  crewChiefName: string | null;
};

type UpcomingVisit = {
  id: string;
  scheduledDate: string;
  timeWindow: string;
  status: string;
  projectAddress: string;
  surveyType: string;
  crewName: string | null;
};

type OutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  dueDate: string;
  contactName: string;
};

type RecentProject = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  contractValue: number;
  contactName: string;
};

type Call = {
  id: string;
  direction: string;
  duration: number | null;
  summary: string | null;
  outcome: string | null;
  startedAt: string;
  contactName: string;
  contactCompany: string | null;
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SURVEY_LABELS: Record<string, string> = {
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

const SURVEY_COLORS: Record<string, string> = {
  boundary: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-purple-50 text-purple-700 border-purple-200",
  topographic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  as_built: "bg-amber-50 text-amber-700 border-amber-200",
  subdivision: "bg-cyan-50 text-cyan-700 border-cyan-200",
  construction: "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  field_complete: "bg-indigo-50 text-indigo-700 border-indigo-200",
  drafting: "bg-purple-50 text-purple-700 border-purple-200",
  review: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-50 text-gray-500 border-gray-200",
};

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {children}
    </span>
  );
}

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isDueSoon(dueDate: string) {
  const due = new Date(dueDate + "T23:59:59");
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
}

export function DashboardClient({
  pipeline,
  ar,
  revenueMonth,
  todayVisits,
  upcomingVisits,
  outstandingInvoices,
  recentProjects,
  recentCalls,
}: {
  pipeline: Pipeline;
  ar: { outstanding: number; count: number };
  revenueMonth: { total: number; count: number };
  todayVisits: Visit[];
  upcomingVisits: UpcomingVisit[];
  outstandingInvoices: OutstandingInvoice[];
  recentProjects: RecentProject[];
  recentCalls: Call[];
}) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50"><Calendar size={14} className="text-blue-500" /></div>
            <span className="text-xs font-medium text-gray-400">Today</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{todayVisits.length}</div>
          <div className="text-xs text-gray-400">field visits</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50"><FolderOpen size={14} className="text-emerald-500" /></div>
            <span className="text-xs font-medium text-gray-400">Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{pipeline.activeProjects}</div>
          <div className="text-xs text-gray-400">{fmt(pipeline.activeValue)} in projects</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50"><FileText size={14} className="text-purple-500" /></div>
            <span className="text-xs font-medium text-gray-400">Proposals</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{pipeline.proposalsOut}</div>
          <div className="text-xs text-gray-400">{fmt(pipeline.proposalsValue)} pending</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50"><DollarSign size={14} className="text-amber-500" /></div>
            <span className="text-xs font-medium text-gray-400">Outstanding</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{fmt(ar.outstanding)}</div>
          <div className="text-xs text-gray-400">{ar.count} unpaid invoices</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50"><TrendingUp size={14} className="text-green-500" /></div>
            <span className="text-xs font-medium text-gray-400">This Month</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{fmt(revenueMonth.total)}</div>
          <div className="text-xs text-gray-400">{revenueMonth.count} payments</div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
          <Link href="/intake" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Manage leads <ChevronRight size={12} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: "New Leads", count: pipeline.newLeads, color: "bg-blue-100 text-blue-700 border-blue-200" },
            { label: "Qualifying", count: pipeline.qualifying, color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Proposals Out", count: pipeline.proposalsOut, value: fmt(pipeline.proposalsValue), color: "bg-purple-50 text-purple-700 border-purple-200" },
            { label: "Active Projects", count: pipeline.activeProjects, value: fmt(pipeline.activeValue), color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          ].map((stage, i) => (
            <div key={i} className="flex-1 relative">
              <div className={`rounded-xl border p-3 ${stage.color}`}>
                <div className="text-xl font-bold">{stage.count}</div>
                <div className="text-xs font-medium mt-0.5">{stage.label}</div>
                {stage.value && <div className="text-xs opacity-70 mt-0.5">{stage.value}</div>}
              </div>
              {i < 3 && <ChevronRight size={14} className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-gray-300 z-10" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left 2/3: Schedule */}
        <div className="col-span-2 space-y-5">
          {/* Today's Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Sunrise size={14} className="text-amber-500" />
                Today&apos;s Schedule
              </h2>
              <Link href="/schedule" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Full calendar <ChevronRight size={12} />
              </Link>
            </div>
            {todayVisits.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Calendar size={20} className="mx-auto mb-1.5 opacity-40" />
                No field visits scheduled for today
              </div>
            ) : (
              <div className="space-y-1">
                {todayVisits.map((visit) => (
                  <div key={visit.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="text-xs text-gray-400 w-20 flex-shrink-0 capitalize">{visit.timeWindow.replace("_", " ")}</div>
                    <Badge className={SURVEY_COLORS[visit.surveyType] || "bg-gray-50 text-gray-600 border-gray-200"}>
                      {SURVEY_LABELS[visit.surveyType] || visit.surveyType}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{visit.projectAddress}</div>
                      <div className="text-xs text-gray-400">
                        {visit.crewName ? (
                          <span className="flex items-center gap-1"><Users size={10} />{visit.crewName} — {visit.contactName}</span>
                        ) : (
                          <span className="text-red-400">{visit.contactName} · No crew assigned</span>
                        )}
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[visit.status] || "bg-gray-50 text-gray-600 border-gray-200"}>
                      {visit.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming This Week */}
          {upcomingVisits.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" />
                Upcoming This Week
              </h2>
              <div className="space-y-1">
                {upcomingVisits.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="text-xs font-medium text-gray-500 w-24 flex-shrink-0">{fmtDay(v.scheduledDate)}</div>
                    <Badge className={SURVEY_COLORS[v.surveyType] || "bg-gray-50 text-gray-600 border-gray-200"}>
                      {SURVEY_LABELS[v.surveyType] || v.surveyType}
                    </Badge>
                    <div className="flex-1 min-w-0 text-sm text-gray-700 truncate">{v.projectAddress}</div>
                    {v.crewName ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Users size={10} />{v.crewName}</span>
                    ) : (
                      <span className="text-xs text-red-400">Unassigned</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <FolderOpen size={14} className="text-gray-400" />
                  Recent Projects
                </h2>
                <Link href="/projects" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              <div className="space-y-1">
                {recentProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <MapPin size={12} className="text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{p.propertyAddress}</div>
                      <div className="text-xs text-gray-400">{p.contactName}</div>
                    </div>
                    <Badge className={PROJECT_STATUS_COLORS[p.status] || "bg-gray-50 text-gray-600 border-gray-200"}>
                      {p.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs font-medium text-gray-500">{fmt(p.contractValue)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-5">
          {/* Outstanding Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <DollarSign size={14} className="text-amber-500" />
                Unpaid Invoices
              </h2>
              <Link href="/billing" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {outstandingInvoices.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <DollarSign size={18} className="mx-auto mb-1 opacity-40" />
                All caught up!
              </div>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.map((inv) => {
                  const owed = inv.total - inv.amountPaid;
                  const overdue = inv.status === "overdue";
                  const dueSoon = !overdue && isDueSoon(inv.dueDate);
                  return (
                    <div key={inv.id} className={`px-3 py-2.5 rounded-lg ${overdue ? "bg-red-50/50" : dueSoon ? "bg-amber-50/50" : "bg-gray-50/50"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-500">{inv.invoiceNumber}</span>
                        <span className={`text-sm font-semibold ${overdue ? "text-red-600" : "text-gray-800"}`}>
                          {fmtFull(owed)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">{inv.contactName}</span>
                        <span className={`text-[10px] flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : dueSoon ? "text-amber-600" : "text-gray-400"}`}>
                          {overdue && <AlertCircle size={10} />}
                          {dueSoon && <Clock size={10} />}
                          Due {fmtDate(inv.dueDate)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Calls */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent Calls</h2>
              <Link href="/intake" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            {recentCalls.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No calls logged yet</div>
            ) : (
              <div className="space-y-1">
                {recentCalls.map((call) => {
                  const IconComp =
                    call.direction === "inbound"
                      ? PhoneIncoming
                      : call.direction === "outbound"
                      ? PhoneOutgoing
                      : PhoneMissed;
                  const iconColor =
                    call.direction === "missed"
                      ? "text-red-400"
                      : call.direction === "inbound"
                      ? "text-green-500"
                      : "text-blue-400";
                  return (
                    <div key={call.id} className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-gray-50">
                      <IconComp size={14} className={`mt-0.5 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700">
                          {call.contactName || "Unknown"}
                        </div>
                        {call.contactCompany && (
                          <div className="text-xs text-gray-400">{call.contactCompany}</div>
                        )}
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {call.summary || "No summary"}
                        </div>
                        <div className="text-[10px] text-gray-300 mt-0.5">
                          {formatTime(call.startedAt)} &middot; {formatDuration(call.duration)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
