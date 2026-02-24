import { db } from "@/db";
import { projects, contacts } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const rows = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      status: projects.status,
      contractValue: projects.contractValue,
      totalInvoiced: projects.totalInvoiced,
      totalPaid: projects.totalPaid,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .where(eq(projects.tenantId, tid))
    .orderBy(projects.createdAt);

  // Status-based stats
  const [stats] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (where ${projects.status} = 'pending')`,
      pendingValue: sql<number>`coalesce(sum(${projects.contractValue}::numeric) filter (where ${projects.status} = 'pending'), 0)`,
      activeCount: sql<number>`count(*) filter (where ${projects.status} in ('in_progress', 'field_complete', 'drafting', 'review'))`,
      activeValue: sql<number>`coalesce(sum(${projects.contractValue}::numeric) filter (where ${projects.status} in ('in_progress', 'field_complete', 'drafting', 'review')), 0)`,
      deliveredCount: sql<number>`count(*) filter (where ${projects.status} = 'delivered')`,
      deliveredValue: sql<number>`coalesce(sum(${projects.contractValue}::numeric) filter (where ${projects.status} = 'delivered'), 0)`,
      closedCount: sql<number>`count(*) filter (where ${projects.status} = 'closed')`,
      closedValue: sql<number>`coalesce(sum(${projects.contractValue}::numeric) filter (where ${projects.status} = 'closed'), 0)`,
    })
    .from(projects)
    .where(eq(projects.tenantId, tid));

  return (
    <ProjectsClient
      role={tenant.role}
      projects={rows.map((p) => ({
        id: p.id,
        propertyAddress: p.propertyAddress,
        surveyType: p.surveyType,
        status: p.status,
        contractValue: Number(p.contractValue),
        totalInvoiced: Number(p.totalInvoiced),
        totalPaid: Number(p.totalPaid),
        contactName: [p.contactFirstName, p.contactLastName]
          .filter(Boolean)
          .join(" "),
        contactCompany: p.contactCompany,
        createdAt: p.createdAt.toISOString(),
      }))}
      stats={{
        pendingCount: Number(stats.pendingCount),
        pendingValue: Number(stats.pendingValue),
        activeCount: Number(stats.activeCount),
        activeValue: Number(stats.activeValue),
        deliveredCount: Number(stats.deliveredCount),
        deliveredValue: Number(stats.deliveredValue),
        closedCount: Number(stats.closedCount),
        closedValue: Number(stats.closedValue),
      }}
    />
  );
}
