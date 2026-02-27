"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MapPin,
  FileText,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Zap,
  X,
  RefreshCw,
  Mail,
  ChevronDown,
  ChevronUp,
  Check,
  Trash2,
} from "lucide-react";

type Call = {
  id: string;
  direction: string;
  callerPhone: string | null;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  outcome: string | null;
  recordingUrl: string | null;
  startedAt: string;
  contactName: string;
  contactCompany: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

type Lead = {
  id: string;
  propertyAddress: string;
  parcelNumber: string | null;
  surveyType: string;
  source: string;
  status: string;
  urgency: string;
  notes: string | null;
  callerEmail: string | null;
  callerPhone: string | null;
  specialRequests: string | null;
  lostReason: string | null;
  createdAt: string;
  contactName: string;
  contactCompany: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

import {
  SURVEY_LABELS as surveyLabel,
  SURVEY_COLORS as surveyColor,
  URGENCY_COLORS as urgencyColor,
  LEAD_STATUS_COLORS,
  CALL_OUTCOME_COLORS,
  DEFAULT_BADGE,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_COLORS,
} from "@/lib/constants";

const statusColor: Record<string, string> = { ...LEAD_STATUS_COLORS, ...CALL_OUTCOME_COLORS };

/**
 * Parse structured notes written by the AI agent.
 * Format: "KEY: value" on each line.
 */
function parseStructuredNotes(notes: string | null): {
  timeline?: string;
  reason?: string;
  propertyOwner?: string;
  callerType?: string;
  lotSize?: string;
  freeformNotes?: string;
} {
  if (!notes) return {};
  const result: Record<string, string> = {};
  const freeform: string[] = [];

  for (const line of notes.split("\n")) {
    const match = line.match(/^(TIMELINE|REASON|PROPERTY OWNER|CALLER TYPE|LOT SIZE|NOTES):\s*(.+)/i);
    if (match) {
      const key = match[1].toUpperCase();
      const val = match[2].trim();
      if (key === "TIMELINE") result.timeline = val;
      else if (key === "REASON") result.reason = val;
      else if (key === "PROPERTY OWNER") result.propertyOwner = val;
      else if (key === "CALLER TYPE") result.callerType = val;
      else if (key === "LOT SIZE") result.lotSize = val;
      else if (key === "NOTES") freeform.push(val);
    } else if (line.trim()) {
      freeform.push(line.trim());
    }
  }

  if (freeform.length > 0) result.freeformNotes = freeform.join("\n");
  return result;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>{children}</span>;
}

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "expired", label: "Expired" },
];

function StatusDropdown({
  leadId,
  currentStatus,
  onStatusChange,
}: {
  leadId: string;
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");

  async function handleSelect(status: string) {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    if (status === "lost") {
      setOpen(false);
      setShowLostModal(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onStatusChange(status);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  async function handleLostConfirm() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lost", lostReason }),
      });
      if (res.ok) onStatusChange("lost");
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setShowLostModal(false);
      setLostReason("");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all ${statusColor[currentStatus] || "bg-gray-50 text-gray-600 border-gray-200"} ${saving ? "opacity-50" : ""}`}
      >
        {currentStatus.replace("_", " ")}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${(statusColor[opt.value] || "bg-gray-200").split(" ")[0]}`} />
                  {opt.label}
                </span>
                {opt.value === currentStatus && <Check size={12} className="text-gray-500" />}
              </button>
            ))}
          </div>
        </>
      )}
      {showLostModal && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => { setShowLostModal(false); setLostReason(""); }} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]">
            <div className="text-sm font-medium text-gray-900 mb-2">Mark as Lost</div>
            <p className="text-xs text-gray-500 mb-3">Why was this lead lost?</p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g., Went with competitor, budget too high..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setShowLostModal(false); setLostReason(""); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleLostConfirm}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark Lost"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function IntakeClient({ calls, leads: initialLeads }: { calls: Call[]; leads: Lead[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "leads" ? "leads" : "calls";
  const [tab, setTab] = useState<"calls" | "leads">(defaultTab);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filteredLeads = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    return true;
  });

  function handleLeadStatusChange(leadId: string, newStatus: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/retell/sync?limit=20");
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error || "sync failed"}`);
      } else if (data.synced === 0) {
        setSyncResult("No new calls to import");
      } else {
        setSyncResult(`Synced ${data.synced} new call${data.synced > 1 ? "s" : ""}`);
        router.refresh();
      }
    } catch {
      setSyncResult("Network error");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  }

  async function handleDeleteLead(leadId: string) {
    if (!window.confirm("Delete this lead? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
        return;
      }
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelectedLead(null);
    } catch {
      alert("Network error");
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Intake</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI voice agent call log and lead management.</p>
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className={`text-xs font-medium ${syncResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {syncResult}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Calls"}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
            <Phone size={12} />
            <span>AI Agent Active</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit mb-5">
        {(["calls", "leads"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedCall(null); setSelectedLead(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "calls" ? "Call Log" : "Leads"}
            {t === "leads" && <span className="ml-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{leads.length}</span>}
          </button>
        ))}
      </div>

      {tab === "calls" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-1">
            {calls.map((call) => {
              const Icon = call.direction === "inbound" ? PhoneIncoming : call.direction === "outbound" ? PhoneOutgoing : PhoneMissed;
              const iconColor = call.direction === "missed" ? "text-red-400" : call.direction === "inbound" ? "text-green-500" : "text-blue-400";
              return (
                <div key={call.id} onClick={() => { setSelectedCall(call); setTranscriptExpanded(false); }}
                  className={`bg-white rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${selectedCall?.id === call.id ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200 hover:border-gray-300 hover:shadow"}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon size={15} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{call.contactName || "Unknown"}</span>
                        <span className="text-[10px] text-gray-400">{formatTime(call.startedAt)}</span>
                      </div>
                      {call.contactCompany && <div className="text-xs text-gray-400">{call.contactCompany}</div>}
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{call.summary || "No summary"}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={statusColor[call.outcome || ""] || "bg-gray-50 text-gray-600 border-gray-200"}>
                          {(call.outcome || "unknown").replace("_", " ")}
                        </Badge>
                        <span className="text-[10px] text-gray-400">{formatDuration(call.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {calls.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No calls logged yet</div>}
          </div>
          <div className="col-span-3">
            {selectedCall ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selectedCall.contactName || "Unknown"}</h3>
                    {selectedCall.contactCompany && <div className="text-sm text-gray-500">{selectedCall.contactCompany}</div>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {selectedCall.contactPhone && <span>{selectedCall.contactPhone}</span>}
                      {selectedCall.contactEmail && <span>{selectedCall.contactEmail}</span>}
                    </div>
                  </div>
                  <Badge className={statusColor[selectedCall.outcome || ""] || "bg-gray-50 text-gray-600 border-gray-200"}>
                    {(selectedCall.outcome || "unknown").replace("_", " ")}
                  </Badge>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AI Summary</div>
                  <p className="text-sm text-gray-700">{selectedCall.summary || "No summary available"}</p>
                </div>
                {selectedCall.transcript && (
                  <div className="mb-4">
                    <button
                      onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 transition-colors"
                    >
                      Transcript
                      {transcriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {transcriptExpanded ? (
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCall.transcript}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic cursor-pointer" onClick={() => setTranscriptExpanded(true)}>
                        &ldquo;{selectedCall.transcript.slice(0, 300)}{selectedCall.transcript.length > 300 ? "..." : ""}&rdquo;
                        {selectedCall.transcript.length > 300 && (
                          <span className="text-blue-500 text-xs ml-1 not-italic">Show full transcript</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {selectedCall.recordingUrl && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recording</div>
                    <audio controls src={selectedCall.recordingUrl} className="w-full h-10" preload="none" />
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{formatDate(selectedCall.startedAt)}</span>
                  <span>{formatTime(selectedCall.startedAt)}</span>
                  <span>Duration: {formatDuration(selectedCall.duration)}</span>
                  <span className="capitalize">{selectedCall.direction}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center justify-center py-12 text-center">
                <Phone size={24} className="text-gray-300 mb-2" />
                <div className="text-sm text-gray-500">Select a call to view details</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "leads" && (
        <div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {[{ value: "all", label: "All" }, ...LEAD_STATUS_OPTIONS].map((opt) => {
              const count = opt.value === "all" ? leads.length : leads.filter((l) => l.status === opt.value).length;
              if (opt.value !== "all" && count === 0) return null;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === opt.value
                      ? opt.value === "all"
                        ? "bg-gray-900 text-white border-gray-900"
                        : statusColor[opt.value] || "bg-gray-100 text-gray-700 border-gray-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">Source:</span>
            {[{ value: "all", label: "All" }, ...Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))].map((opt) => {
              const count = opt.value === "all" ? leads.length : leads.filter((l) => l.source === opt.value).length;
              if (opt.value !== "all" && count === 0) return null;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSourceFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    sourceFilter === opt.value
                      ? opt.value === "all"
                        ? "bg-gray-900 text-white border-gray-900"
                        : LEAD_SOURCE_COLORS[opt.value] || "bg-gray-100 text-gray-700 border-gray-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-1">
            {filteredLeads.map((lead) => (
              <div key={lead.id} onClick={() => setSelectedLead(lead)}
                className={`bg-white rounded-xl border shadow-sm p-3 cursor-pointer transition-all ${selectedLead?.id === lead.id ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200 hover:border-gray-300 hover:shadow"}`}>
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">{lead.contactName || "Unknown"}</span>
                  <Badge className={urgencyColor[lead.urgency] || ""}>{lead.urgency}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <MapPin size={11} /><span className="truncate">{lead.propertyAddress}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={surveyColor[lead.surveyType] || "bg-gray-50 text-gray-600 border-gray-200"}>
                    {surveyLabel[lead.surveyType] || lead.surveyType}
                  </Badge>
                  <Badge className={statusColor[lead.status] || "bg-gray-50 text-gray-600 border-gray-200"}>
                    {lead.status.replace("_", " ")}
                  </Badge>
                  <Badge className={LEAD_SOURCE_COLORS[lead.source] || "bg-gray-50 text-gray-600 border-gray-200"}>
                    {LEAD_SOURCE_LABELS[lead.source] || lead.source.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400">{formatDate(lead.createdAt)}, {formatTime(lead.createdAt)}</span>
                  {(lead.callerPhone || lead.contactPhone) && <Phone size={9} className="text-gray-300" />}
                  {(lead.callerEmail || lead.contactEmail) && <Mail size={9} className="text-gray-300" />}
                  {lead.specialRequests && <AlertCircle size={9} className="text-purple-300" />}
                </div>
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                {statusFilter === "all" ? "No leads yet" : `No ${statusFilter.replace("_", " ")} leads`}
              </div>
            )}
          </div>
          <div className="col-span-3">
            {selectedLead ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selectedLead.contactName}</h3>
                    {selectedLead.contactCompany && <div className="text-sm text-gray-500">{selectedLead.contactCompany}</div>}
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="flex items-center gap-1">
                        <Phone size={10} className={selectedLead.callerPhone || selectedLead.contactPhone ? "text-gray-400" : "text-gray-300"} />
                        {selectedLead.callerPhone || selectedLead.contactPhone ? (
                          <span className="text-gray-500">{selectedLead.callerPhone || selectedLead.contactPhone}</span>
                        ) : (
                          <span className="text-gray-300 italic">No phone</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail size={10} className={selectedLead.callerEmail || selectedLead.contactEmail ? "text-gray-400" : "text-gray-300"} />
                        {selectedLead.callerEmail || selectedLead.contactEmail ? (
                          <span className="text-gray-500">{selectedLead.callerEmail || selectedLead.contactEmail}</span>
                        ) : (
                          <span className="text-gray-300 italic">No email</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={urgencyColor[selectedLead.urgency] || ""}>{selectedLead.urgency}</Badge>
                    <StatusDropdown
                      leadId={selectedLead.id}
                      currentStatus={selectedLead.status}
                      onStatusChange={(s) => handleLeadStatusChange(selectedLead.id, s)}
                    />
                  </div>
                </div>
                {(() => {
                  const parsed = parseStructuredNotes(selectedLead.notes);
                  return (
                    <>
                      {/* Top row: Property + Survey Type */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Property</div>
                          <div className="text-sm text-gray-700 mt-1">{selectedLead.propertyAddress}</div>
                          {selectedLead.parcelNumber && <div className="text-xs text-gray-400 mt-0.5">Parcel: {selectedLead.parcelNumber}</div>}
                          {parsed.propertyOwner && <div className="text-xs text-gray-500 mt-0.5">Owner: {parsed.propertyOwner}</div>}
                          {parsed.lotSize && <div className="text-xs text-gray-500 mt-0.5">Lot size: {parsed.lotSize}</div>}
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Survey Type</div>
                          <div className="mt-1">
                            <Badge className={surveyColor[selectedLead.surveyType] || ""}>{surveyLabel[selectedLead.surveyType] || selectedLead.surveyType}</Badge>
                          </div>
                          {parsed.reason && <div className="text-xs text-gray-500 mt-1">Reason: {parsed.reason.replace("_", " ")}</div>}
                          <div className="text-xs text-gray-400 mt-0.5">Source: {selectedLead.source.replace("_", " ")}</div>
                        </div>
                      </div>

                      {/* Second row: Timeline + Caller info (only if we have structured data) */}
                      {(parsed.timeline || parsed.callerType) && (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {parsed.timeline && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                              <div className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">Timeline</div>
                              <div className="text-sm text-blue-800 mt-1">{parsed.timeline}</div>
                            </div>
                          )}
                          {parsed.callerType && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Caller Type</div>
                              <div className="text-sm text-gray-700 mt-1 capitalize">{parsed.callerType}</div>
                              {selectedLead.contactCompany && <div className="text-xs text-gray-400 mt-0.5">{selectedLead.contactCompany}</div>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Special Requests */}
                      {selectedLead.specialRequests && (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
                          <div className="text-[10px] font-medium text-purple-600 uppercase tracking-wide">Special Requests / Access</div>
                          <p className="text-sm text-purple-800 mt-1">{selectedLead.specialRequests}</p>
                        </div>
                      )}

                      {/* Lost Reason */}
                      {selectedLead.status === "lost" && selectedLead.lostReason && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                          <div className="text-[10px] font-medium text-red-600 uppercase tracking-wide">Lost Reason</div>
                          <p className="text-sm text-red-800 mt-1">{selectedLead.lostReason}</p>
                        </div>
                      )}

                      {/* Freeform notes (anything that wasn't parsed as structured) */}
                      {parsed.freeformNotes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
                          <div className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Notes</div>
                          <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">{parsed.freeformNotes}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/proposals/new?leadId=${selectedLead.id}`)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                  >
                    <FileText size={14} />Create Proposal
                  </button>
                  {(selectedLead.callerPhone || selectedLead.contactPhone) && (
                    <a
                      href={`tel:${selectedLead.callerPhone || selectedLead.contactPhone}`}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                    >
                      <Phone size={14} />Call Client
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Trash2 size={14} />Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center justify-center py-12 text-center">
                <Zap size={24} className="text-gray-300 mb-2" />
                <div className="text-sm text-gray-500">Select a lead to view details</div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
