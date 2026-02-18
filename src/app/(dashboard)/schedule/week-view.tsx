"use client";

import { Fragment, useState } from "react";
import { VisitCard, type Visit } from "./visit-card";

type Crew = { id: string; name: string; chiefName: string | null };

type WeekViewProps = {
  days: string[];
  crews: Crew[];
  visits: Visit[];
  draggingId: string | null;
  onDragStart: (e: React.DragEvent, visitId: string) => void;
  onDrop: (visitId: string, newDate: string, newCrewId: string) => void;
  onDragEnd: () => void;
};

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export function WeekView({ days, crews, visits, draggingId, onDragStart, onDrop, onDragEnd }: WeekViewProps) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(cellKey: string) {
    setDropTarget(cellKey);
  }

  function handleDragLeave(e: React.DragEvent, cellKey: string) {
    const related = e.relatedTarget as HTMLElement | null;
    const current = e.currentTarget as HTMLElement;
    if (!related || !current.contains(related)) {
      if (dropTarget === cellKey) setDropTarget(null);
    }
  }

  function handleDropOnCell(e: React.DragEvent, day: string, crewId: string) {
    e.preventDefault();
    setDropTarget(null);
    const visitId = e.dataTransfer.getData("visitId");
    if (visitId) {
      onDrop(visitId, day, crewId);
    }
  }

  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden bg-white"
      style={{ display: "grid", gridTemplateColumns: `140px repeat(${days.length}, 1fr)` }}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="bg-gray-50 border-b border-r border-gray-200 p-3">
        <div className="text-xs font-medium text-gray-400">Crew</div>
      </div>
      {days.map((day, i) => (
        <div key={i} className="bg-gray-50 border-b border-r border-gray-200 p-3 last:border-r-0">
          <span className="text-xs font-semibold text-gray-700">{formatDay(day)}</span>
        </div>
      ))}

      {/* Crew rows */}
      {crews.map((crew) => (
        <Fragment key={crew.id}>
          <div className="border-b border-r border-gray-200 p-3 bg-gray-50/50">
            <div className="text-sm font-semibold text-gray-800">{crew.name}</div>
            <div className="text-xs text-gray-400">{crew.chiefName}</div>
          </div>
          {days.map((day) => {
            const cellKey = `${crew.id}-${day}`;
            const dayVisits = visits.filter((v) => v.crewId === crew.id && v.scheduledDate === day);
            const isOver = dropTarget === cellKey && draggingId !== null;

            return (
              <div
                key={cellKey}
                className={`border-b border-r border-gray-200 p-1.5 last:border-r-0 min-h-[90px] transition-colors ${
                  isOver ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : ""
                }`}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(cellKey)}
                onDragLeave={(e) => handleDragLeave(e, cellKey)}
                onDrop={(e) => handleDropOnCell(e, day, crew.id)}
              >
                {dayVisits.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    isDragging={draggingId === visit.id}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            );
          })}
        </Fragment>
      ))}

      {/* Unassigned row — visits with no crew */}
      {visits.some((v) => !v.crewId) && (
        <Fragment>
          <div className="border-b border-r border-gray-200 p-3 bg-red-50/50">
            <div className="text-sm font-semibold text-red-700">Unassigned</div>
            <div className="text-xs text-red-400">No crew</div>
          </div>
          {days.map((day) => {
            const cellKey = `unassigned-${day}`;
            const dayVisits = visits.filter((v) => !v.crewId && v.scheduledDate === day);
            const isOver = dropTarget === cellKey && draggingId !== null;

            return (
              <div
                key={cellKey}
                className={`border-b border-r border-gray-200 p-1.5 last:border-r-0 min-h-[90px] transition-colors ${
                  isOver ? "bg-red-50 ring-2 ring-inset ring-red-200" : ""
                }`}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(cellKey)}
                onDragLeave={(e) => handleDragLeave(e, cellKey)}
                onDrop={(e) => handleDropOnCell(e, day, "")}
              >
                {dayVisits.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    isDragging={draggingId === visit.id}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            );
          })}
        </Fragment>
      )}
    </div>
  );
}
