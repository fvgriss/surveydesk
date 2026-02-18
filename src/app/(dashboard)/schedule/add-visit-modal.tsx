"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

type Project = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  contactName: string;
  status: string;
};

type Crew = { id: string; name: string; chiefName: string | null };

type AddVisitModalProps = {
  open: boolean;
  onClose: () => void;
  crews: Crew[];
  preselectedProjectId?: string;
  onCreated: () => void;
};

export function AddVisitModal({ open, onClose, crews, preselectedProjectId, onCreated }: AddVisitModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [projectId, setProjectId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [skipDate, setSkipDate] = useState(false);
  const [timeWindow, setTimeWindow] = useState("full_day");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [accessNotes, setAccessNotes] = useState("");

  // Fetch projects when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        if (preselectedProjectId) {
          setProjectId(preselectedProjectId);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, preselectedProjectId]);

  function reset() {
    setProjectId("");
    setCrewId("");
    setScheduledDate("");
    setSkipDate(false);
    setTimeWindow("full_day");
    setEstimatedHours("");
    setAccessNotes("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError("Please select a project.");
      return;
    }
    if (!skipDate && !crewId) {
      setError("Please select a crew.");
      return;
    }
    if (!skipDate && !scheduledDate) {
      setError("Please select a date, or check 'Schedule later'.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/schedule/field-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          crewId: skipDate ? (crewId || null) : crewId,
          scheduledDate: skipDate ? "1970-01-01" : scheduledDate,
          timeWindow: skipDate ? "full_day" : timeWindow,
          estimatedDurationHours: estimatedHours || null,
          accessNotes: accessNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create visit");
        setSaving(false);
        return;
      }

      reset();
      onClose();
      onCreated();
    } catch {
      setError("Failed to create visit");
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Field Visit</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            {loading ? (
              <div className="text-xs text-gray-400">Loading projects...</div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.propertyAddress} — {p.surveyType.replace("_", " ")} ({p.contactName})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date with "schedule later" toggle — moved above crew so toggling hides crew */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Date</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDate}
                  onChange={(e) => {
                    setSkipDate(e.target.checked);
                    if (e.target.checked) setScheduledDate("");
                  }}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-600 font-medium">Schedule later</span>
              </label>
            </div>
            {skipDate ? (
              <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                This visit will appear in "Needs Scheduling" until a date is assigned.
              </div>
            ) : (
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Crew select — hidden when "Schedule later" */}
          {!skipDate && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Crew</label>
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a crew...</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.chiefName ? `(${c.chiefName})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time window + Duration row */}
          {!skipDate && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Time Window</label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="full_day">Full Day</option>
                  <option value="multi_day">Multi-Day</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Est. Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Access notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Access Notes</label>
            <textarea
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              rows={2}
              placeholder="Gate code, contact person, special instructions..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Scheduling..." : skipDate ? "Add to Pipeline" : "Schedule Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
