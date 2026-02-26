"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Plus,
  FolderOpen,
  X,
  ExternalLink,
  Settings,
  AlertCircle,
} from "lucide-react";
import {
  EMAIL_CLASSIFICATION_LABELS,
  EMAIL_CLASSIFICATION_COLORS,
  EMAIL_STATUS_LABELS,
  EMAIL_STATUS_COLORS,
  SURVEY_LABELS as SURVEY_TYPE_LABELS,
  DEFAULT_BADGE,
} from "@/lib/constants";

type AiSuggestion = {
  suggestedAction: string;
  extractedAddress?: string;
  extractedSurveyType?: string;
  extractedContactName?: string;
  extractedContactPhone?: string;
  extractedUrgency?: string;
  matchedProjectId?: string;
  matchedProjectAddress?: string;
  confidence: number;
  reasoning?: string;
};

type Email = {
  id: string;
  from: string | null;
  fromName: string | null;
  subject: string | null;
  bodyPreview: string | null;
  bodyFull: string | null;
  emailStatus: string;
  aiClassification: string | null;
  aiSuggestion: AiSuggestion | null;
  contactId: string | null;
  leadId: string | null;
  projectId: string | null;
  receivedAt: string;
  contactName: string;
};

type Project = {
  id: string;
  propertyAddress: string;
  surveyType: string;
};

const STATUS_FILTERS = ["all", "new", "lead_created", "assigned", "dismissed"];

function relativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function InboxClient({
  emails: initialEmails,
  gmailConnected,
  gmailEmail,
  projects,
}: {
  emails: Email[];
  gmailConnected: boolean;
  gmailEmail: string | null;
  projects: Project[];
}) {
  const router = useRouter();
  const [emails, setEmails] = useState(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignDropdown, setAssignDropdown] = useState(false);

  const selected = emails.find((e) => e.id === selectedId) || null;

  const filtered = emails.filter((e) => {
    if (statusFilter !== "all" && e.emailStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (e.subject?.toLowerCase().includes(q)) ||
        (e.fromName?.toLowerCase().includes(q)) ||
        (e.from?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/gmail/sync");
      router.refresh();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateLead = async (emailId: string) => {
    setActionLoading("create-lead");
    try {
      const res = await fetch(`/api/inbox/${emailId}/create-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId
              ? { ...e, emailStatus: "lead_created", leadId: data.leadId }
              : e
          )
        );
        router.refresh();
      }
    } catch (err) {
      console.error("Create lead failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignProject = async (emailId: string, projectId: string) => {
    setActionLoading("assign");
    setAssignDropdown(false);
    try {
      const res = await fetch(`/api/inbox/${emailId}/assign-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId ? { ...e, emailStatus: "assigned", projectId } : e
          )
        );
        router.refresh();
      }
    } catch (err) {
      console.error("Assign failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (emailId: string) => {
    setActionLoading("dismiss");
    try {
      const res = await fetch(`/api/inbox/${emailId}/dismiss`, {
        method: "POST",
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId ? { ...e, emailStatus: "dismissed" } : e
          )
        );
        router.refresh();
      }
    } catch (err) {
      console.error("Dismiss failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReclassify = async (emailId: string) => {
    setActionLoading("classify");
    try {
      const res = await fetch(`/api/inbox/${emailId}/classify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId
              ? {
                  ...e,
                  aiClassification: data.classification.classification,
                  aiSuggestion: data.classification,
                }
              : e
          )
        );
      }
    } catch (err) {
      console.error("Classify failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Gmail not connected state
  if (!gmailConnected) {
    return (
      <div className="p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and triage incoming emails with AI assistance.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Mail size={40} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Gmail Not Connected</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Connect your Gmail account to start syncing emails. SurveyDesk will use AI to identify survey requests and help you triage your inbox.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Settings size={14} />
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {gmailEmail ? `Syncing from ${gmailEmail}` : "Review and triage incoming emails."}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "All" : EMAIL_STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Email list */}
        <div className="w-[420px] flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Mail size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No emails found.</p>
              </div>
            ) : (
              filtered.map((e) => {
                const isSelected = e.id === selectedId;
                const classColors =
                  EMAIL_CLASSIFICATION_COLORS[e.aiClassification || ""] || "";
                const statusColors =
                  EMAIL_STATUS_COLORS[e.emailStatus] || DEFAULT_BADGE;

                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSelectedId(e.id);
                      setAssignDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                      isSelected
                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                        : "hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {e.fromName || e.from || "Unknown"}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {relativeTime(e.receivedAt)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 truncate mb-1.5">
                      {e.subject || "(no subject)"}
                    </div>
                    <div className="text-xs text-gray-400 truncate mb-2">
                      {e.bodyPreview?.slice(0, 80) || ""}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {e.aiClassification && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${classColors}`}
                        >
                          <Sparkles size={10} />
                          {EMAIL_CLASSIFICATION_LABELS[e.aiClassification] ||
                            e.aiClassification}
                        </span>
                      )}
                      {e.emailStatus !== "new" && (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors}`}
                        >
                          {EMAIL_STATUS_LABELS[e.emailStatus] || e.emailStatus}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select an email to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Email header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                      {selected.subject || "(no subject)"}
                    </h2>
                    <p className="text-sm text-gray-600">
                      From: <span className="font-medium">{selected.fromName || "Unknown"}</span>
                      {selected.from && (
                        <span className="text-gray-400"> &lt;{selected.from}&gt;</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(selected.receivedAt).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {selected.emailStatus !== "new" && (
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
                          EMAIL_STATUS_COLORS[selected.emailStatus] || DEFAULT_BADGE
                        }`}
                      >
                        {EMAIL_STATUS_LABELS[selected.emailStatus] || selected.emailStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Suggestion Card */}
              {selected.aiSuggestion && (
                <div className="mx-6 mt-4">
                  <div
                    className={`border rounded-xl p-4 ${
                      EMAIL_CLASSIFICATION_COLORS[selected.aiClassification || ""] ||
                      "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} />
                      <span className="text-sm font-semibold">
                        AI Suggestion:{" "}
                        {EMAIL_CLASSIFICATION_LABELS[selected.aiClassification || ""] ||
                          "Analyzing..."}
                      </span>
                      <span className="text-xs opacity-60">
                        {Math.round(selected.aiSuggestion.confidence * 100)}% confidence
                      </span>
                    </div>

                    {/* Extracted fields */}
                    {(selected.aiSuggestion.extractedAddress ||
                      selected.aiSuggestion.extractedSurveyType ||
                      selected.aiSuggestion.extractedContactName ||
                      selected.aiSuggestion.matchedProjectAddress) && (
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        {selected.aiSuggestion.extractedAddress && (
                          <div>
                            <span className="font-medium">Address:</span>{" "}
                            {selected.aiSuggestion.extractedAddress}
                          </div>
                        )}
                        {selected.aiSuggestion.extractedSurveyType && (
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {SURVEY_TYPE_LABELS[selected.aiSuggestion.extractedSurveyType] ||
                              selected.aiSuggestion.extractedSurveyType}
                          </div>
                        )}
                        {selected.aiSuggestion.extractedContactName && (
                          <div>
                            <span className="font-medium">Contact:</span>{" "}
                            {selected.aiSuggestion.extractedContactName}
                          </div>
                        )}
                        {selected.aiSuggestion.extractedUrgency && (
                          <div>
                            <span className="font-medium">Urgency:</span>{" "}
                            <span className="capitalize">{selected.aiSuggestion.extractedUrgency}</span>
                          </div>
                        )}
                        {selected.aiSuggestion.matchedProjectAddress && (
                          <div className="col-span-2">
                            <span className="font-medium">Matched Project:</span>{" "}
                            {selected.aiSuggestion.matchedProjectAddress}
                          </div>
                        )}
                      </div>
                    )}

                    {selected.aiSuggestion.reasoning && (
                      <p className="text-xs mt-2 opacity-70 italic">
                        {selected.aiSuggestion.reasoning}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* No AI classification yet */}
              {!selected.aiSuggestion && selected.emailStatus === "new" && (
                <div className="mx-6 mt-4">
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <AlertCircle size={14} />
                        <span>AI classification pending...</span>
                      </div>
                      <button
                        onClick={() => handleReclassify(selected.id)}
                        disabled={actionLoading === "classify"}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        {actionLoading === "classify" ? "Classifying..." : "Classify Now"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {selected.emailStatus === "new" && (
                <div className="mx-6 mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleCreateLead(selected.id)}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-medium py-2 px-3 rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
                  >
                    <Plus size={14} />
                    {actionLoading === "create-lead" ? "Creating..." : "Create Lead"}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setAssignDropdown(!assignDropdown)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 bg-purple-600 text-white font-medium py-2 px-3 rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                    >
                      <FolderOpen size={14} />
                      Assign to Project
                    </button>
                    {assignDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                        {projects.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400">No active projects</div>
                        ) : (
                          projects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleAssignProject(selected.id, p.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              <div className="font-medium text-gray-800 truncate">
                                {p.propertyAddress}
                              </div>
                              <div className="text-xs text-gray-400">
                                {SURVEY_TYPE_LABELS[p.surveyType] || p.surveyType}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDismiss(selected.id)}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 font-medium py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                  >
                    <X size={14} />
                    {actionLoading === "dismiss" ? "Dismissing..." : "Dismiss"}
                  </button>
                </div>
              )}

              {/* Status-specific links */}
              {selected.emailStatus === "lead_created" && selected.leadId && (
                <div className="mx-6 mt-4">
                  <Link
                    href="/intake?tab=leads"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    <ExternalLink size={14} />
                    View Lead in Intake
                  </Link>
                </div>
              )}

              {selected.emailStatus === "assigned" && selected.projectId && (
                <div className="mx-6 mt-4">
                  <Link
                    href={`/projects/${selected.projectId}`}
                    className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <ExternalLink size={14} />
                    View Project
                  </Link>
                </div>
              )}

              {/* Email body */}
              <div className="mx-6 mt-4 mb-6">
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.bodyFull || selected.bodyPreview || "No content available."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
