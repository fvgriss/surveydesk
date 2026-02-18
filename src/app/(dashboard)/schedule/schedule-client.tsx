"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronLeft, ChevronRight, Calendar, Grid3X3, Map, Clock, CalendarPlus, Users } from "lucide-react";
import { type Visit } from "./visit-card";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { MapView } from "./map-view";
import { AddVisitModal } from "./add-visit-modal";
import { WeatherWidget } from "./weather-widget";

type Crew = { id: string; name: string; chiefName: string | null };
type ViewMode = "week" | "month" | "map";

type UnscheduledProject = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  contractValue: string;
  contactName: string;
  createdAt: Date;
};

type ScheduleClientProps = {
  days: string[];
  crews: Crew[];
  visits: Visit[];
  unscheduledVisits: Visit[];
  unscheduledProjects: UnscheduledProject[];
  initialView: ViewMode;
  currentDate: string; // YYYY-MM-DD reference date
};

function getWeekLabel(days: string[]) {
  if (days.length < 2) return "";
  const s = new Date(days[0] + "T12:00:00");
  const e = new Date(days[days.length - 1] + "T12:00:00");
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ScheduleClient({ days, crews, visits: initialVisits, unscheduledVisits, unscheduledProjects, initialView, currentDate }: ScheduleClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [scheduledVisitIds, setScheduledVisitIds] = useState<Set<string>>(new Set());
  const [unscheduledFromCalendar, setUnscheduledFromCalendar] = useState<Visit[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [preselectedProjectId, setPreselectedProjectId] = useState<string | undefined>();

  const year = new Date(currentDate + "T12:00:00").getFullYear();
  const month = new Date(currentDate + "T12:00:00").getMonth();

  // Navigate to new date/view
  function navigate(newDate: string, view?: ViewMode) {
    const v = view || viewMode;
    router.push(`/schedule?view=${v}&date=${newDate}`);
  }

  function switchView(v: ViewMode) {
    setViewMode(v);
    router.push(`/schedule?view=${v}&date=${currentDate}`);
  }

  // Prev/Next navigation
  function goPrev() {
    const d = new Date(currentDate + "T12:00:00");
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    navigate(d.toISOString().split("T")[0]);
  }

  function goNext() {
    const d = new Date(currentDate + "T12:00:00");
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    navigate(d.toISOString().split("T")[0]);
  }

  function goToday() {
    const today = new Date().toISOString().split("T")[0];
    navigate(today);
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, visitId: string) {
    e.dataTransfer.setData("visitId", visitId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(visitId);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  const handleDrop = useCallback(
    async (visitId: string, newDate: string, newCrewId: string) => {
      // Check all sources for the visit being dragged
      const existingVisit = visits.find((v) => v.id === visitId);
      const unscheduledVisit = unscheduledVisits.find((v) => v.id === visitId);
      const returnedVisit = unscheduledFromCalendar.find((v) => v.id === visitId);
      const visit = existingVisit || returnedVisit || unscheduledVisit;
      if (!visit) return;

      if (existingVisit) {
        // Regular rescheduling within calendar
        if (existingVisit.scheduledDate === newDate && existingVisit.crewId === newCrewId) return;

        // Optimistic update
        setVisits((prev) =>
          prev.map((v) =>
            v.id === visitId
              ? {
                  ...v,
                  scheduledDate: newDate,
                  crewId: newCrewId || v.crewId,
                  crewName: newCrewId
                    ? crews.find((c) => c.id === newCrewId)?.name || v.crewName
                    : v.crewName,
                }
              : v
          )
        );
      } else if (returnedVisit || unscheduledVisit) {
        // Moving from unscheduled panel → calendar
        const src = returnedVisit || unscheduledVisit!;
        setVisits((prev) => [
          ...prev,
          {
            ...src,
            scheduledDate: newDate,
            crewId: newCrewId || src.crewId,
            crewName: newCrewId
              ? crews.find((c) => c.id === newCrewId)?.name || src.crewName
              : src.crewName,
          },
        ]);
        // Remove from unscheduledFromCalendar if it was there
        if (returnedVisit) {
          setUnscheduledFromCalendar((prev) => prev.filter((v) => v.id !== visitId));
        }
        setScheduledVisitIds((prev) => new Set(prev).add(visitId));
      }

      // API call
      try {
        const body: Record<string, string> = {};
        body.scheduledDate = newDate;
        if (newCrewId) body.crewId = newCrewId;

        const res = await fetch(`/api/schedule/field-visits/${visitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          console.error("Failed to reschedule visit");
          // Refresh to get clean state
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to reschedule visit:", err);
        router.refresh();
      }

      setDraggingId(null);
    },
    [visits, unscheduledVisits, unscheduledFromCalendar, crews, router]
  );

  // Filter out visits that were dragged to the calendar this session, plus add back visits dragged from calendar
  // Use a Set to prevent any duplicate keys
  const seenIds = new Set<string>();
  const visibleUnscheduledVisits = [
    ...unscheduledVisits.filter((v) => !scheduledVisitIds.has(v.id)),
    ...unscheduledFromCalendar,
  ].filter((v) => {
    if (seenIds.has(v.id)) return false;
    seenIds.add(v.id);
    return true;
  });

  const [dropZoneActive, setDropZoneActive] = useState(false);

  // Drop a visit back to the unscheduled panel
  const handleDropToUnscheduled = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDropZoneActive(false);
      const visitId = e.dataTransfer.getData("visitId");
      if (!visitId) return;

      const visit = visits.find((v) => v.id === visitId);
      if (!visit) return;

      // Optimistically move from calendar to unscheduled
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
      setUnscheduledFromCalendar((prev) => [
        ...prev,
        { ...visit, scheduledDate: "1970-01-01" },
      ]);

      // API call — set sentinel date to unschedule
      try {
        const res = await fetch(`/api/schedule/field-visits/${visitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledDate: "1970-01-01" }),
        });
        if (!res.ok) {
          console.error("Failed to unschedule visit");
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to unschedule visit:", err);
        router.refresh();
      }

      setDraggingId(null);
    },
    [visits, router]
  );

  const navLabel = viewMode === "month" ? getMonthLabel(currentDate) : getWeekLabel(days);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Field Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crew assignments and field visit calendar.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status legend */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mr-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-500 rounded" /> Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-400 rounded" /> Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-amber-400 rounded" /> Tentative
            </span>
          </div>
          <button
            onClick={() => setShowAddVisit(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Visit
          </button>
        </div>
      </div>

      {/* Navigation + View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[180px] text-center">{navLabel}</span>
          <button
            onClick={goNext}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToday}
            className="ml-2 px-3 py-1 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => switchView("week")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Grid3X3 size={14} />
            Week
          </button>
          <button
            onClick={() => switchView("month")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar size={14} />
            Month
          </button>
          <button
            onClick={() => switchView("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Map size={14} />
            Map
          </button>
        </div>
      </div>

      {/* Weather widget */}
      <WeatherWidget days={days} />

      {/* Needs Scheduling panel — always visible, drop target for unscheduling */}
      <div
        className={`border rounded-xl p-4 mb-4 transition-colors ${
          dropZoneActive
            ? "border-amber-400 bg-amber-100/70 ring-2 ring-amber-300"
            : "border-amber-200 bg-amber-50/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropZoneActive(true);
        }}
        onDragLeave={(e) => {
          // Only deactivate when leaving the panel itself, not its children
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropZoneActive(false);
          }
        }}
        onDrop={handleDropToUnscheduled}
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-amber-600" />
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Needs Scheduling ({unscheduledProjects.length + visibleUnscheduledVisits.length})
          </h3>
        </div>

        {visibleUnscheduledVisits.length === 0 && unscheduledProjects.length === 0 ? (
          <div className={`text-center py-3 rounded-lg border-2 border-dashed transition-colors ${
            dropZoneActive ? "border-amber-400 text-amber-700" : "border-amber-200/60 text-gray-400"
          }`}>
            <p className="text-xs">
              {dropZoneActive ? "Drop here to unschedule" : "All visits scheduled — drag a visit here to unschedule it"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dropZoneActive && (
              <div className="text-center py-2 rounded-lg border-2 border-dashed border-amber-400 text-amber-700">
                <p className="text-xs font-medium">Drop here to unschedule</p>
              </div>
            )}

            {/* Unscheduled visits (created via "Schedule later") — draggable to calendar */}
            {visibleUnscheduledVisits.map((visit) => (
              <div
                key={visit.id}
                draggable
                onDragStart={(e) => handleDragStart(e, visit.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between bg-white rounded-lg border border-amber-100 px-3 py-2 cursor-grab active:cursor-grabbing transition-opacity ${
                  draggingId === visit.id ? "opacity-40" : ""
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {visit.projectAddress}
                  </div>
                  <div className="text-xs text-gray-500">
                    {visit.surveyType.replace("_", " ")} · {visit.contactName}
                    {visit.crewName ? (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600">
                        <Users size={10} />
                        {visit.crewName}
                      </span>
                    ) : (
                      <span className="ml-1.5 text-red-500 font-medium">· No crew</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 mr-2 select-none">
                  drag to calendar →
                </span>
              </div>
            ))}

            {/* Unscheduled projects (no visits created yet) */}
            {unscheduledProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-3 py-2"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {project.propertyAddress}
                  </div>
                  <div className="text-xs text-gray-500">
                    {project.surveyType.replace("_", " ")} · {project.contactName}
                    {project.contractValue && project.contractValue !== "0" && (
                      <span className="ml-1 text-gray-400">
                        · ${Number(project.contractValue).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPreselectedProjectId(project.id);
                    setShowAddVisit(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap"
                >
                  <CalendarPlus size={12} />
                  Schedule
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View content */}
      {viewMode === "week" && (
        <WeekView
          days={days}
          crews={crews}
          visits={visits}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      )}

      {viewMode === "month" && (
        <MonthView
          year={year}
          month={month}
          visits={visits}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      )}

      {viewMode === "map" && (
        <MapView
          days={days}
          visits={visits}
          crews={crews}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {/* Add Visit Modal */}
      <AddVisitModal
        open={showAddVisit}
        onClose={() => { setShowAddVisit(false); setPreselectedProjectId(undefined); }}
        crews={crews}
        preselectedProjectId={preselectedProjectId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
