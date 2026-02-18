import { db } from "@/db";
import {
  projects,
  contacts,
  invoices,
  fieldVisits,
  crews,
  proposals,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;
  const { id } = await params;

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, tid)))
    .limit(1);

  if (!project) redirect("/projects");

  // Fetch contact
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, project.contactId))
    .limit(1);

  // Fetch invoices for this project
  const projectInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      dueDate: invoices.dueDate,
      sentAt: invoices.sentAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(eq(invoices.projectId, id), eq(invoices.tenantId, tid))
    )
    .orderBy(invoices.createdAt);

  // Fetch field visits for this project
  const projectVisits = await db
    .select({
      id: fieldVisits.id,
      scheduledDate: fieldVisits.scheduledDate,
      timeWindow: fieldVisits.timeWindow,
      status: fieldVisits.status,
      crewName: crews.name,
      crewChiefName: crews.chiefName,
    })
    .from(fieldVisits)
    .leftJoin(crews, eq(fieldVisits.crewId, crews.id))
    .where(
      and(eq(fieldVisits.projectId, id), eq(fieldVisits.tenantId, tid))
    )
    .orderBy(fieldVisits.scheduledDate);

  // Fetch crew list for invoice form
  const crewList = await db
    .select({ id: crews.id, name: crews.name })
    .from(crews)
    .where(eq(crews.tenantId, tid));

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        propertyAddress: project.propertyAddress,
        parcelNumber: project.parcelNumber,
        surveyType: project.surveyType,
        status: project.status,
        contractValue: Number(project.contractValue),
        totalInvoiced: Number(project.totalInvoiced),
        totalPaid: Number(project.totalPaid),
        taskChecklist: (project.taskChecklist || []) as Array<{
          task: string;
          description: string;
          completed: boolean;
          completedAt?: string;
        }>,
        notes: project.notes,
        createdAt: project.createdAt.toISOString(),
        startedAt: project.startedAt?.toISOString() || null,
        fieldCompletedAt: project.fieldCompletedAt?.toISOString() || null,
        deliveredAt: project.deliveredAt?.toISOString() || null,
      }}
      contact={{
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        company: contact.companyName,
        email: contact.email,
        phone: contact.phone,
      }}
      invoices={projectInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        status: inv.status,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        dueDate: inv.dueDate,
        sentAt: inv.sentAt?.toISOString() || null,
      }))}
      visits={projectVisits
        .filter((v) => v.scheduledDate !== "1970-01-01")
        .map((v) => ({
          id: v.id,
          scheduledDate: v.scheduledDate,
          timeWindow: v.timeWindow,
          status: v.status,
          crewName: v.crewName,
          crewChiefName: v.crewChiefName,
        }))}
    />
  );
}
