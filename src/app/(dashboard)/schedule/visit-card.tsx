"use client";

import React from "react";

export type Visit = {
  id: string;
  scheduledDate: string;
  timeWindow: string;
  status: string;
  estimatedDurationHours: string | null;
  accessNotes: string | null;
  projectAddress: string;
  surveyType: string;
  contactName: string;
  crewId: string | null;
  crewName: string | null;
  crewChiefName: string | null;
};

const surveyLabel: Record<string, string> = {
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

const surveyColor: Record<string, string> = {
  boundary: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-purple-50 text-purple-700 border-purple-200",
  topographic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  as_built: "bg-orange-50 text-orange-700 border-orange-200",
  subdivision: "bg-pink-50 text-pink-700 border-pink-200",
  construction: "bg-amber-50 text-amber-700 border-amber-200",
  elevation_cert: "bg-cyan-50 text-cyan-700 border-cyan-200",
  route: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export const statusBorder: Record<string, string> = {
  confirmed: "border-l-emerald-500 bg-emerald-50/50",
  scheduled: "border-l-blue-400 bg-blue-50/50",
  tentative: "border-l-amber-400 bg-amber-50/50",
  in_progress: "border-l-blue-500 bg-blue-50/50",
  completed: "border-l-emerald-600 bg-emerald-50/50",
  cancelled: "border-l-gray-300 bg-gray-50/50",
};

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {children}
    </span>
  );
}

type VisitCardProps = {
  visit: Visit;
  compact?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, visitId: string) => void;
};

export function VisitCard({ visit, compact, isDragging, onDragStart }: VisitCardProps) {
  const noCrew = !visit.crewId;

  if (compact) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart?.(e, visit.id)}
        className={`border-l-[3px] rounded px-1.5 py-1 text-[10px] cursor-grab active:cursor-grabbing transition-opacity ${
          isDragging ? "opacity-40" : ""
        } ${noCrew ? "border-l-red-400 bg-red-50/50" : statusBorder[visit.status] || "border-l-gray-300 bg-gray-50"}`}
      >
        <div className="font-medium text-gray-700 truncate">{visit.projectAddress}</div>
        <div className="text-gray-400 truncate">
          {noCrew ? (
            <span className="text-red-500 font-medium">⚠ No crew</span>
          ) : (
            visit.crewName
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, visit.id)}
      className={`border-l-[3px] rounded-md p-2 mb-1 text-xs cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${noCrew ? "border-l-red-400 bg-red-50/50" : statusBorder[visit.status] || "border-l-gray-300 bg-gray-50"}`}
    >
      <div className="font-medium text-gray-700 truncate">{visit.projectAddress}</div>
      {noCrew && (
        <div className="mt-1">
          <Badge className="bg-red-50 text-red-600 border-red-200">
            ⚠ No crew assigned
          </Badge>
        </div>
      )}
      <div className="mt-1">
        <Badge className={surveyColor[visit.surveyType] || ""}>
          {surveyLabel[visit.surveyType] || visit.surveyType}
        </Badge>
      </div>
      <div className="text-[10px] text-gray-400 mt-1 capitalize">
        {visit.timeWindow.replace("_", " ")} &middot; {visit.contactName}
      </div>
    </div>
  );
}
