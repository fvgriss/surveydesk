"use client";

import { useState } from "react";
import { VisitCard, type Visit } from "./visit-card";

type MonthViewProps = {
  year: number;
  month: number; // 0-indexed (0 = Jan)
  visits: Visit[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  draggingId: string | null;
  onDragStart: (e: React.DragEvent, visitId: string) => void;
  onDrop: (visitId: string, newDate: string, newCrewId: string) => void;
  onDragEnd: () => void;
};

// crew colors for compact dots
const crewColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
];

function getMonthCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const days: { date: string; dayOfMonth: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
  const today = new Date().toISOString().split("T")[0];

  // Previous month padding
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: d.toISOString().split("T")[0],
      dayOfMonth: d.getDate(),
      isCurrentMonth: false,
      isToday: d.toISOString().split("T")[0] === today,
    });
  }

  // Current month
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      dayOfMonth: i,
      isCurrentMonth: true,
      isToday: dateStr === today,
    });
  }

  // Next month padding to fill last row
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d.toISOString().split("T")[0],
        dayOfMonth: i,
        isCurrentMonth: false,
        isToday: d.toISOString().split("T")[0] === today,
      });
    }
  }

  return days;
}

export function MonthView({
  year,
  month,
  visits,
  selectedDate,
  onSelectDate,
  draggingId,
  onDragStart,
  onDrop,
  onDragEnd,
}: MonthViewProps) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const calendarDays = getMonthCalendarDays(year, month);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Map crewId to a color index
  const crewColorMap = new Map<string, number>();
  visits.forEach((v) => {
    const key = v.crewId || "unassigned";
    if (!crewColorMap.has(key)) {
      crewColorMap.set(key, crewColorMap.size);
    }
  });

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDropOnCell(e: React.DragEvent, date: string) {
    e.preventDefault();
    setDropTarget(null);
    const visitId = e.dataTransfer.getData("visitId");
    if (visitId) {
      // Keep the same crew when dropping in month view (pass "" if not found — e.g. from unscheduled panel)
      const visit = visits.find((v) => v.id === visitId);
      onDrop(visitId, date, visit?.crewId || "");
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white" onDragEnd={onDragEnd}>
      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {weekdays.map((wd) => (
          <div key={wd} className="bg-gray-50 border-b border-r border-gray-200 p-2 text-center last:border-r-0">
            <span className="text-xs font-semibold text-gray-500">{wd}</span>
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayVisits = visits.filter((v) => v.scheduledDate === day.date);
          const isOver = dropTarget === day.date && draggingId !== null;
          const isSelected = selectedDate === day.date;
          const maxShow = 2;
          const overflow = dayVisits.length - maxShow;

          return (
            <div
              key={day.date}
              className={`border-b border-r border-gray-200 p-1.5 min-h-[100px] last:border-r-0 cursor-pointer transition-colors ${
                !day.isCurrentMonth ? "bg-gray-50/70" : ""
              } ${isOver ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : ""} ${
                isSelected ? "ring-2 ring-inset ring-blue-500 bg-blue-50/30" : ""
              }`}
              onClick={() => onSelectDate(day.date)}
              onDragOver={handleDragOver}
              onDragEnter={() => setDropTarget(day.date)}
              onDragLeave={(e) => {
                const related = e.relatedTarget as HTMLElement | null;
                const current = e.currentTarget as HTMLElement;
                if (!related || !current.contains(related)) {
                  if (dropTarget === day.date) setDropTarget(null);
                }
              }}
              onDrop={(e) => handleDropOnCell(e, day.date)}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium ${
                    day.isToday
                      ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                      : day.isCurrentMonth
                        ? "text-gray-700"
                        : "text-gray-300"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
                {/* Crew color dots */}
                {dayVisits.length > 0 && (
                  <div className="flex gap-0.5">
                    {[...new Set(dayVisits.map((v) => v.crewId || "unassigned"))].map((cid) => (
                      <span
                        key={cid}
                        className={`w-1.5 h-1.5 rounded-full ${
                          cid === "unassigned"
                            ? "bg-red-400"
                            : crewColors[crewColorMap.get(cid)! % crewColors.length]
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Visit cards (compact) */}
              <div className="space-y-0.5">
                {dayVisits.slice(0, maxShow).map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    compact
                    isDragging={draggingId === visit.id}
                    onDragStart={onDragStart}
                  />
                ))}
                {overflow > 0 && (
                  <div className="text-[10px] text-gray-400 pl-1.5">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
