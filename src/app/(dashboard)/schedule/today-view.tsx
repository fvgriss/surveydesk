"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Phone, FileText, ChevronRight, Users, Pencil } from "lucide-react";
import { type Visit } from "./visit-card";

type Crew = { id: string; name: string; chiefName: string | null };

const TIME_LABELS: Record<string, string> = {
  morning: "8 AM – 12 PM",
  afternoon: "12 PM – 5 PM",
  full_day: "Full Day",
  multi_day: "Multi-Day",
};

const SURVEY_LABELS: Record<string, string> = {
  boundary: "Boundary",
  alta: "ALTA/NSPS",
  topographic: "Topo",
  as_built: "As-Built",
  subdivision: "Subdivision",
  construction: "Construction",
  elevation_cert: "Elev Cert",
  route: "Route",
  other: "Other",
};

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  { value: "confirmed", label: "Confirmed", color: "bg-emerald-100 text-emerald-700" },
  { value: "in_progress", label: "On Site", color: "bg-amber-100 text-amber-700" },
  { value: "completed", label: "Complete", color: "bg-green-100 text-green-700" },
];

export function TodayView({ visits, crews }: { visits: Visit[]; crews: Crew[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const todayVisits = visits.filter((v) => v.scheduledDate === today);

  // Group by crew
  const grouped: Record<string, { crew: Crew | null; visits: Visit[] }> = {};

  for (const visit of todayVisits) {
    const key = visit.crewId || "unassigned";
    if (!grouped[key]) {
      const crew = crews.find((c) => c.id === visit.crewId) || null;
      grouped[key] = { crew, visits: [] };
    }
    grouped[key].visits.push(visit);
  }

  // Sort crews: assigned crews first (alphabetical), unassigned last
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === "unassigned") return 1;
    if (b === "unassigned") return -1;
    return (grouped[a].crew?.name || "").localeCompare(grouped[b].crew?.name || "");
  });

  async function handleStatusChange(visitId: string, newStatus: string) {
    setUpdatingId(visitId);
    try {
      const body: Record<string, unknown> = {};

      // Use the scheduledDate to keep the visit on the same day
      if (newStatus === "in_progress") {
        body.actualArrival = new Date().toISOString();
      }

      const res = await fetch(`/api/schedule/field-visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...body }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotes(visitId: string) {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/schedule/field-visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldNotes: notesDraft }),
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error("Save notes failed:", err);
    } finally {
      setSavingNotes(false);
      setEditingNotes(null);
    }
  }

  async function handleUtilityLocateChange(visitId: string, newStatus: string) {
    try {
      await fetch(`/api/schedule/field-visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilityLocateStatus: newStatus }),
      });
      router.refresh();
    } catch (err) {
      console.error("Utility locate update failed:", err);
    }
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (todayVisits.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText size={20} className="text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">No visits today</h3>
        <p className="text-xs text-gray-500">{todayLabel}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-gray-500 mb-4">
        {todayLabel} &middot; {todayVisits.length} visit{todayVisits.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-6">
        {sortedGroups.map(([key, group]) => (
          <div key={key}>
            {/* Crew header */}
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                {group.crew?.name || "Unassigned"}
              </h3>
              {group.crew?.chiefName && (
                <span className="text-xs text-gray-400">{group.crew.chiefName}</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {group.visits.length} job{group.visits.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Visit cards */}
            <div className="space-y-3">
              {group.visits.map((visit) => {
                const currentStatus = STATUS_OPTIONS.find((s) => s.value === visit.status) || STATUS_OPTIONS[0];
                const currentIdx = STATUS_OPTIONS.findIndex((s) => s.value === visit.status);
                const nextStatus = currentIdx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[currentIdx + 1] : null;

                return (
                  <div
                    key={visit.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Status bar */}
                    <div className={`px-4 py-2 flex items-center justify-between ${currentStatus.color}`}>
                      <span className="text-xs font-semibold">{currentStatus.label}</span>
                      <span className="text-xs">
                        <Clock size={12} className="inline mr-1" />
                        {TIME_LABELS[visit.timeWindow] || visit.timeWindow}
                      </span>
                    </div>

                    <div className="p-4">
                      {/* Address + survey type */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-gray-900">{visit.projectAddress}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-[22px] mt-0.5">
                            {SURVEY_LABELS[visit.surveyType] || visit.surveyType}
                            {visit.estimatedDurationHours && ` · ${visit.estimatedDurationHours}h est.`}
                          </p>
                        </div>
                      </div>

                      {/* Contact — tap to call on mobile */}
                      <div className="flex items-center gap-2 mb-3">
                        <Phone size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-700">{visit.contactName}</span>
                      </div>

                      {/* Access notes */}
                      {visit.accessNotes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Access: </span>
                            {visit.accessNotes}
                          </p>
                        </div>
                      )}

                      {/* Actual arrival/departure times */}
                      {(visit.actualArrival || visit.actualDeparture) && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                          {visit.actualArrival && (
                            <span>Arrived: {new Date(visit.actualArrival).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          )}
                          {visit.actualDeparture && (
                            <span>Departed: {new Date(visit.actualDeparture).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          )}
                        </div>
                      )}

                      {/* Utility Locate Status */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-gray-500">Utility Locate:</span>
                        <select
                          value={visit.utilityLocateStatus || ""}
                          onChange={(e) => handleUtilityLocateChange(visit.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Not started</option>
                          <option value="requested">Requested</option>
                          <option value="marked">Marked</option>
                          <option value="clear">Clear (no utilities)</option>
                          <option value="not_required">Not Required</option>
                        </select>
                      </div>

                      {/* Field Notes */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">Field Notes</span>
                          {editingNotes !== visit.id && (
                            <button
                              onClick={() => { setEditingNotes(visit.id); setNotesDraft(visit.fieldNotes || ""); }}
                              className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800"
                            >
                              <Pencil size={10} />
                              {visit.fieldNotes ? "Edit" : "Add note"}
                            </button>
                          )}
                        </div>
                        {editingNotes === visit.id ? (
                          <div>
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              placeholder="Field conditions, observations, issues..."
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-1">
                              <button onClick={() => setEditingNotes(null)} className="text-xs text-gray-500">Cancel</button>
                              <button
                                onClick={() => handleSaveNotes(visit.id)}
                                disabled={savingNotes}
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {savingNotes ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : visit.fieldNotes ? (
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{visit.fieldNotes}</p>
                        ) : null}
                      </div>

                      {/* Status progression button */}
                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(visit.id, nextStatus.value)}
                          disabled={updatingId === visit.id}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          {updatingId === visit.id ? (
                            "Updating..."
                          ) : (
                            <>
                              {nextStatus.label}
                              <ChevronRight size={14} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
