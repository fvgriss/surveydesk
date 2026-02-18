import { db } from "@/db";
import { fieldVisits, projects, contacts, crews } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { ScheduleClient } from "./schedule-client";

export const dynamic = "force-dynamic";

type ViewMode = "week" | "month" | "map";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const params = await searchParams;
  const view = (["week", "month", "map"].includes(params.view || "") ? params.view : "week") as ViewMode;
  const refDate = params.date ? new Date(params.date + "T12:00:00") : new Date();

  // Compute date range based on view
  let startDate: string;
  let endDate: string;
  const days: string[] = [];

  if (view === "month") {
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const last = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    startDate = first.toISOString().split("T")[0];
    endDate = last.toISOString().split("T")[0];

    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split("T")[0]);
    }
  } else {
    const day = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - day + (day === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    startDate = monday.toISOString().split("T")[0];
    endDate = friday.toISOString().split("T")[0];

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
  }

  // Shared select columns for visit queries (use fieldVisits.crewId since crewId can be null)
  const visitSelect = {
    id: fieldVisits.id,
    scheduledDate: fieldVisits.scheduledDate,
    timeWindow: fieldVisits.timeWindow,
    status: fieldVisits.status,
    estimatedDurationHours: fieldVisits.estimatedDurationHours,
    accessNotes: fieldVisits.accessNotes,
    projectAddress: projects.propertyAddress,
    surveyType: projects.surveyType,
    contactFirstName: contacts.firstName,
    contactLastName: contacts.lastName,
    crewId: fieldVisits.crewId,
    crewName: crews.name,
    crewChiefName: crews.chiefName,
  };

  // Query scheduled visits (real dates only, exclude sentinel 1970-01-01)
  // leftJoin crews since crewId can be null
  const visits = await db
    .select(visitSelect)
    .from(fieldVisits)
    .innerJoin(projects, eq(fieldVisits.projectId, projects.id))
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .leftJoin(crews, eq(fieldVisits.crewId, crews.id))
    .where(
      and(
        eq(fieldVisits.tenantId, tid),
        gte(fieldVisits.scheduledDate, startDate),
        lte(fieldVisits.scheduledDate, endDate)
      )
    )
    .orderBy(fieldVisits.scheduledDate);

  // Query unscheduled visits (sentinel date 1970-01-01 = "schedule later")
  // Use leftJoin for crews since crewId can be null on unscheduled visits
  const unscheduledVisitRows = await db
    .select({
      id: fieldVisits.id,
      scheduledDate: fieldVisits.scheduledDate,
      timeWindow: fieldVisits.timeWindow,
      status: fieldVisits.status,
      estimatedDurationHours: fieldVisits.estimatedDurationHours,
      accessNotes: fieldVisits.accessNotes,
      projectAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      crewId: fieldVisits.crewId,
      crewName: crews.name,
      crewChiefName: crews.chiefName,
    })
    .from(fieldVisits)
    .innerJoin(projects, eq(fieldVisits.projectId, projects.id))
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .leftJoin(crews, eq(fieldVisits.crewId, crews.id))
    .where(
      and(
        eq(fieldVisits.tenantId, tid),
        eq(fieldVisits.scheduledDate, "1970-01-01")
      )
    );

  const crewList = await db
    .select({ id: crews.id, name: crews.name, chiefName: crews.chiefName })
    .from(crews)
    .where(eq(crews.tenantId, tid));

  // Query unscheduled projects (active projects with no field visits)
  // First get project IDs that DO have visits
  const projectsWithVisits = await db
    .select({ projectId: fieldVisits.projectId })
    .from(fieldVisits)
    .where(eq(fieldVisits.tenantId, tid))
    .groupBy(fieldVisits.projectId);

  const visitedProjectIds = projectsWithVisits.map((r) => r.projectId);

  // Get active projects that are NOT in that list
  let unscheduledProjects: {
    id: string;
    propertyAddress: string;
    surveyType: string;
    status: string;
    contractValue: string;
    contactName: string;
    createdAt: Date;
  }[] = [];

  const allActiveProjects = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      status: projects.status,
      contractValue: projects.contractValue,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .where(
      and(
        eq(projects.tenantId, tid),
        inArray(projects.status, ["pending", "in_progress"])
      )
    )
    .orderBy(projects.createdAt);

  unscheduledProjects = allActiveProjects
    .filter((p) => !visitedProjectIds.includes(p.id))
    .map((p) => ({
      id: p.id,
      propertyAddress: p.propertyAddress,
      surveyType: p.surveyType,
      status: p.status,
      contractValue: p.contractValue,
      contactName: [p.contactFirstName, p.contactLastName].filter(Boolean).join(" "),
      createdAt: p.createdAt,
    }));

  const currentDate = refDate.toISOString().split("T")[0];

  function mapVisit(v: typeof visits[number]) {
    return {
      id: v.id,
      scheduledDate: v.scheduledDate,
      timeWindow: v.timeWindow,
      status: v.status,
      estimatedDurationHours: v.estimatedDurationHours,
      accessNotes: v.accessNotes,
      projectAddress: v.projectAddress,
      surveyType: v.surveyType,
      contactName: [v.contactFirstName, v.contactLastName].filter(Boolean).join(" "),
      crewId: v.crewId,
      crewName: v.crewName,
      crewChiefName: v.crewChiefName,
    };
  }

  return (
    <ScheduleClient
      days={days}
      crews={crewList.map((c) => ({ id: c.id, name: c.name, chiefName: c.chiefName }))}
      visits={visits.map(mapVisit)}
      unscheduledVisits={unscheduledVisitRows.map(mapVisit)}
      unscheduledProjects={unscheduledProjects}
      initialView={view}
      currentDate={currentDate}
    />
  );
}
