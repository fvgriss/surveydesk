import { db } from "@/db";
import {
  leads,
  proposals,
  projects,
  invoices,
  payments,
  fieldVisits,
  callLog,
  contacts,
  crews,
} from "@/db/schema";
import { eq, and, sql, gte, lte, desc, or } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const today = new Date().toISOString().split("T")[0];
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const weekEnd = endOfWeek.toISOString().split("T")[0];

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const monthStart = firstOfMonth.toISOString().split("T")[0];

  // ── Pipeline counts ──
  const [leadCounts] = await db
    .select({
      newCount: sql<number>`count(*) filter (where ${leads.status} = 'new')`,
      qualifyingCount: sql<number>`count(*) filter (where ${leads.status} = 'qualifying')`,
    })
    .from(leads)
    .where(eq(leads.tenantId, tid));

  const [proposalCounts] = await db
    .select({
      openCount: sql<number>`count(*) filter (where ${proposals.status} in ('sent', 'viewed'))`,
      openValue: sql<number>`coalesce(sum(${proposals.total}::numeric) filter (where ${proposals.status} in ('sent', 'viewed')), 0)`,
    })
    .from(proposals)
    .where(eq(proposals.tenantId, tid));

  const [projectCounts] = await db
    .select({
      activeCount: sql<number>`count(*) filter (where ${projects.status} not in ('delivered', 'closed'))`,
      activeValue: sql<number>`coalesce(sum(${projects.contractValue}::numeric) filter (where ${projects.status} not in ('delivered', 'closed')), 0)`,
    })
    .from(projects)
    .where(eq(projects.tenantId, tid));

  // ── AR outstanding ──
  const [arData] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.total}::numeric - ${invoices.amountPaid}::numeric), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tid),
        or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"))
      )
    );

  // ── Revenue this month (payments received) ──
  const [revenueMonth] = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amount}::numeric), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tid),
        gte(payments.receivedAt, new Date(monthStart + "T00:00:00Z"))
      )
    );

  // ── Today's visits (leftJoin crews since crewId nullable) ──
  const todayVisits = await db
    .select({
      id: fieldVisits.id,
      timeWindow: fieldVisits.timeWindow,
      status: fieldVisits.status,
      projectAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
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
        eq(fieldVisits.scheduledDate, today)
      )
    )
    .orderBy(fieldVisits.timeWindow);

  // ── Upcoming visits (next 7 days, excluding today and sentinel) ──
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const upcomingVisits = await db
    .select({
      id: fieldVisits.id,
      scheduledDate: fieldVisits.scheduledDate,
      timeWindow: fieldVisits.timeWindow,
      status: fieldVisits.status,
      projectAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      crewName: crews.name,
    })
    .from(fieldVisits)
    .innerJoin(projects, eq(fieldVisits.projectId, projects.id))
    .leftJoin(crews, eq(fieldVisits.crewId, crews.id))
    .where(
      and(
        eq(fieldVisits.tenantId, tid),
        gte(fieldVisits.scheduledDate, tomorrowStr),
        lte(fieldVisits.scheduledDate, weekEnd)
      )
    )
    .orderBy(fieldVisits.scheduledDate)
    .limit(8);

  // ── Outstanding invoices ──
  const outstandingInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      dueDate: invoices.dueDate,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(
      and(
        eq(invoices.tenantId, tid),
        or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"))
      )
    )
    .orderBy(invoices.dueDate)
    .limit(5);

  // ── Recent projects ──
  const recentProjects = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      status: projects.status,
      contractValue: projects.contractValue,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(projects)
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .where(eq(projects.tenantId, tid))
    .orderBy(desc(projects.createdAt))
    .limit(5);

  // ── Recent calls ──
  const recentCalls = await db
    .select({
      id: callLog.id,
      direction: callLog.direction,
      duration: callLog.duration,
      summary: callLog.summary,
      outcome: callLog.outcome,
      startedAt: callLog.startedAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
    })
    .from(callLog)
    .leftJoin(contacts, eq(callLog.contactId, contacts.id))
    .where(eq(callLog.tenantId, tid))
    .orderBy(desc(callLog.startedAt))
    .limit(5);

  return (
    <DashboardClient
      pipeline={{
        newLeads: Number(leadCounts.newCount),
        qualifying: Number(leadCounts.qualifyingCount),
        proposalsOut: Number(proposalCounts.openCount),
        proposalsValue: Number(proposalCounts.openValue),
        activeProjects: Number(projectCounts.activeCount),
        activeValue: Number(projectCounts.activeValue),
      }}
      ar={{ outstanding: Number(arData.total), count: Number(arData.count) }}
      revenueMonth={{
        total: Number(revenueMonth.total),
        count: Number(revenueMonth.count),
      }}
      todayVisits={todayVisits.map((v) => ({
        id: v.id,
        timeWindow: v.timeWindow,
        status: v.status,
        projectAddress: v.projectAddress,
        surveyType: v.surveyType,
        contactName: [v.contactFirstName, v.contactLastName]
          .filter(Boolean)
          .join(" "),
        crewName: v.crewName,
        crewChiefName: v.crewChiefName,
      }))}
      upcomingVisits={upcomingVisits.map((v) => ({
        id: v.id,
        scheduledDate: v.scheduledDate,
        timeWindow: v.timeWindow,
        status: v.status,
        projectAddress: v.projectAddress,
        surveyType: v.surveyType,
        crewName: v.crewName,
      }))}
      outstandingInvoices={outstandingInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        dueDate: inv.dueDate,
        contactName: [inv.contactFirstName, inv.contactLastName]
          .filter(Boolean)
          .join(" "),
      }))}
      recentProjects={recentProjects.map((p) => ({
        id: p.id,
        propertyAddress: p.propertyAddress,
        surveyType: p.surveyType,
        status: p.status,
        contractValue: Number(p.contractValue),
        contactName: [p.contactFirstName, p.contactLastName]
          .filter(Boolean)
          .join(" "),
      }))}
      recentCalls={recentCalls.map((c) => ({
        id: c.id,
        direction: c.direction,
        duration: c.duration,
        summary: c.summary,
        outcome: c.outcome,
        startedAt: c.startedAt.toISOString(),
        contactName: [c.contactFirstName, c.contactLastName]
          .filter(Boolean)
          .join(" "),
        contactCompany: c.contactCompany,
      }))}
    />
  );
}
