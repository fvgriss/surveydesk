"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

type Call = {
  id: string;
  direction: string;
  callerPhone: string | null;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  outcome: string | null;
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
  createdAt: string;
  contactName: string;
  contactCompany: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

const surveyLabel: Record<string, string> = { boundary: "Boundary", alta: "ALTA/NSPS", topographic: "Topo", as_built: "As-Built" };
const surveyColor: Record<string, string> = { boundary: "bg-blue-50 text-blue-700 border-blue-200", alta: "bg-purple-50 text-purple-700 border-purple-200", topographic: "bg-emerald-50 text-emerald-700 border-emerald-200" };
const urgencyColor: Record<string, string> = { high: "bg-red-50 text-red-700 border-red-200", medium: "bg-amber-50 text-amber-700 border-amber-200", low: "bg-gray-50 text-gray-600 border-gray-200" };
const statusColor: Record<string, string> = { new: "bg-blue-50 text-blue-700 border-blue-200", qualifying: "bg-amber-50 text-amber-700 border-amber-200", proposal_sent: "bg-purple-50 text-purple-700 border-purple-200", won: "bg-emerald-50 text-emerald-700 border-emerald-200", lost: "bg-red-50 text-red-700 border-red-200", lead_created: "bg-emerald-50 text-emerald-700 border-emerald-200", status_update: "bg-blue-50 text-blue-700 border-blue-200", follow_up: "bg-amber-50 text-amber-700 border-amber-200" };

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>{children}</span>;
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

export function IntakeClient({ calls, leads }: { calls: Call[]; leads: Lead[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"calls" | "leads">("calls");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [emailSyncResult, setEmailSyncResult] = useState<string | null>(null);

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

  async function handleEmailSync() {
    setSyncingEmail(true);
    setEmailSyncResult(null);
    try {
      const res = await fetch("/api/gmail/sync?limit=20");
      const data = await res.json();
      if (!res.ok) {
        setEmailSyncResult(`Error: ${data.error || "sync failed"}`);
      } else if (data.leadsCreated === 0 && data.synced === 0) {
        setEmailSyncResult("No new emails");
      } else {
        setEmailSyncResult(
          data.leadsCreated > 0
            ? `${data.leadsCreated} new lead${data.leadsCreated > 1 ? "s" : ""} from email`
            : `Checked ${data.synced} emails — no survey requests`
        );
        if (data.leadsCreated > 0) router.refresh();
      }
    } catch {
      setEmailSyncResult("Network error");
    } finally {
      setSyncingEmail(false);
      setTimeout(() => setEmailSyncResult(null), 4000);
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
          {(syncResult || emailSyncResult) && (
            <span className={`text-xs font-medium ${(syncResult || emailSyncResult)?.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {syncResult || emailSyncResult}
            </span>
          )}
          <button
            onClick={handleEmailSync}
            disabled={syncingEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Mail size={12} className={syncingEmail ? "animate-pulse" : ""} />
            {syncingEmail ? "Syncing..." : "Sync Emails"}
          </button>
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
                <div key={call.id} onClick={() => setSelectedCall(call)}
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
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Transcript Preview</div>
                    <p className="text-sm text-gray-500 italic">&ldquo;{selectedCall.transcript.slice(0, 300)}...&rdquo;</p>
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
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-1">
            {leads.map((lead) => (
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
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400">{formatDate(lead.createdAt)}, {formatTime(lead.createdAt)}</span>
                  {(lead.callerPhone || lead.contactPhone) && <Phone size={9} className="text-gray-300" />}
                  {(lead.callerEmail || lead.contactEmail) && <Mail size={9} className="text-gray-300" />}
                  {lead.specialRequests && <AlertCircle size={9} className="text-purple-300" />}
                </div>
              </div>
            ))}
          </div>
          <div className="col-span-3">
            {selectedLead ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{selectedLead.contactName}</h3>
                    {selectedLead.contactCompany && <div className="text-sm text-gray-500">{selectedLead.contactCompany}</div>}
                    {(selectedLead.callerPhone || selectedLead.contactPhone || selectedLead.callerEmail || selectedLead.contactEmail) && (
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {(selectedLead.callerPhone || selectedLead.contactPhone) && (
                          <span className="flex items-center gap-1"><Phone size={10} />{selectedLead.callerPhone || selectedLead.contactPhone}</span>
                        )}
                        {(selectedLead.callerEmail || selectedLead.contactEmail) && (
                          <span className="flex items-center gap-1"><Mail size={10} />{selectedLead.callerEmail || selectedLead.contactEmail}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={urgencyColor[selectedLead.urgency] || ""}>{selectedLead.urgency}</Badge>
                    <Badge className={statusColor[selectedLead.status] || ""}>{selectedLead.status.replace("_", " ")}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Property</div>
                    <div className="text-sm text-gray-700 mt-1">{selectedLead.propertyAddress}</div>
                    {selectedLead.parcelNumber && <div className="text-xs text-gray-400 mt-0.5">Parcel: {selectedLead.parcelNumber}</div>}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Survey Type</div>
                    <div className="mt-1">
                      <Badge className={surveyColor[selectedLead.surveyType] || ""}>{surveyLabel[selectedLead.surveyType] || selectedLead.surveyType}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Source: {selectedLead.source.replace("_", " ")}</div>
                  </div>
                </div>
                {selectedLead.specialRequests && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-4">
                    <div className="text-[10px] font-medium text-purple-600 uppercase tracking-wide">Special Requests</div>
                    <p className="text-sm text-purple-800 mt-1">{selectedLead.specialRequests}</p>
                  </div>
                )}
                {selectedLead.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
                    <div className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Notes</div>
                    <p className="text-sm text-amber-800 mt-1">{selectedLead.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/proposals/new?leadId=${selectedLead.id}`)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                  >
                    <FileText size={14} />Create Proposal
                  </button>
                  <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5">
                    <Phone size={14} />Call Client
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
      )}
    </div>
  );
}
