/**
 * Shared UI constants for labels, colors, and badge styling.
 * Import from "@/lib/constants" instead of defining locally.
 */

// ============================================================
// SURVEY TYPES
// ============================================================

/** Short labels for list views and badges */
export const SURVEY_LABELS: Record<string, string> = {
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

/** Full labels for detail views and headings */
export const SURVEY_LABELS_FULL: Record<string, string> = {
  boundary: "Boundary Survey",
  alta: "ALTA/NSPS Land Title Survey",
  topographic: "Topographic Survey",
  as_built: "As-Built Survey",
  subdivision: "Subdivision Survey",
  construction: "Construction Survey",
  elevation_cert: "Elevation Certificate",
  route: "Route Survey",
  other: "Survey",
};

export const SURVEY_COLORS: Record<string, string> = {
  boundary: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-purple-50 text-purple-700 border-purple-200",
  topographic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  as_built: "bg-amber-50 text-amber-700 border-amber-200",
  subdivision: "bg-cyan-50 text-cyan-700 border-cyan-200",
  construction: "bg-orange-50 text-orange-700 border-orange-200",
  elevation_cert: "bg-teal-50 text-teal-700 border-teal-200",
  route: "bg-indigo-50 text-indigo-700 border-indigo-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

// ============================================================
// URGENCY
// ============================================================

export const URGENCY_COLORS: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-50 text-gray-600 border-gray-200",
};

// ============================================================
// LEAD STATUS
// ============================================================

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  qualifying: "bg-amber-50 text-amber-700 border-amber-200",
  proposal_sent: "bg-purple-50 text-purple-700 border-purple-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-gray-50 text-gray-500 border-gray-200",
};

// ============================================================
// PROPOSAL STATUS
// ============================================================

export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  viewed: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-gray-50 text-gray-500 border-gray-200",
};

// ============================================================
// PROJECT STATUS
// ============================================================

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  field_complete: "Field Complete",
  drafting: "Drafting",
  review: "Review",
  delivered: "Delivered",
  closed: "Closed",
  on_hold: "On Hold",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  field_complete: "bg-indigo-50 text-indigo-700 border-indigo-200",
  drafting: "bg-purple-50 text-purple-700 border-purple-200",
  review: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-50 text-gray-500 border-gray-200",
  on_hold: "bg-red-50 text-red-700 border-red-200",
};

// ============================================================
// INVOICE STATUS
// ============================================================

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  viewed: "bg-amber-50 text-amber-700 border-amber-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  void: "bg-gray-50 text-gray-500 border-gray-200",
};

// ============================================================
// FIELD VISIT STATUS
// ============================================================

export const VISIT_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  rescheduled: "bg-purple-50 text-purple-700 border-purple-200",
};

// ============================================================
// CONTACT TYPES
// ============================================================

export const CONTACT_TYPES = [
  { value: "homeowner", label: "Homeowner", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "title_company", label: "Title Company", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "realtor", label: "Realtor", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "attorney", label: "Attorney", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "lender", label: "Lender", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "contractor", label: "Contractor", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "government", label: "Government", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "other", label: "Other", color: "bg-gray-50 text-gray-700 border-gray-200" },
] as const;

// ============================================================
// CALL OUTCOME (intake page)
// ============================================================

export const CALL_OUTCOME_COLORS: Record<string, string> = {
  lead_created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  status_update: "bg-blue-50 text-blue-700 border-blue-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  general: "bg-gray-50 text-gray-600 border-gray-200",
};

// ============================================================
// DEFAULT BADGE FALLBACK
// ============================================================

export const DEFAULT_BADGE = "bg-gray-50 text-gray-600 border-gray-200";
