import { db } from "@/db";
import { invoices, contacts, payments, projects } from "@/db/schema";
import { eq, and, sql, desc, or } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      dueDate: invoices.dueDate,
      sentAt: invoices.sentAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      projectId: invoices.projectId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
      propertyAddress: sql<string>`(select property_address from projects where projects.id = ${invoices.projectId})`,
    })
    .from(invoices)
    .leftJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(eq(invoices.tenantId, tid))
    .orderBy(desc(invoices.createdAt));

  // AR totals
  const [arTotals] = await db
    .select({
      paidTotal: sql<number>`coalesce(sum(${invoices.amountPaid}::numeric) filter (where ${invoices.status} = 'paid'), 0)`,
      paidCount: sql<number>`count(*) filter (where ${invoices.status} = 'paid')`,
      outstandingTotal: sql<number>`coalesce(sum(${invoices.total}::numeric - ${invoices.amountPaid}::numeric) filter (where ${invoices.status} in ('sent', 'overdue')), 0)`,
      outstandingCount: sql<number>`count(*) filter (where ${invoices.status} in ('sent', 'overdue'))`,
      overdueTotal: sql<number>`coalesce(sum(${invoices.total}::numeric - ${invoices.amountPaid}::numeric) filter (where ${invoices.status} = 'overdue'), 0)`,
      overdueCount: sql<number>`count(*) filter (where ${invoices.status} = 'overdue')`,
    })
    .from(invoices)
    .where(eq(invoices.tenantId, tid));

  // Fetch projects for the "New Invoice" picker
  const projectRows = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(projects)
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .where(eq(projects.tenantId, tid))
    .orderBy(desc(projects.createdAt));

  return (
    <BillingClient
      projects={projectRows.map((p) => ({
        id: p.id,
        propertyAddress: p.propertyAddress,
        surveyType: p.surveyType,
        contactName: [p.contactFirstName, p.contactLastName].filter(Boolean).join(" "),
      }))}
      invoices={rows.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        status: inv.status,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        dueDate: inv.dueDate,
        sentAt: inv.sentAt?.toISOString() || null,
        paidAt: inv.paidAt?.toISOString() || null,
        projectId: inv.projectId,
        contactName: [inv.contactFirstName, inv.contactLastName].filter(Boolean).join(" "),
        contactCompany: inv.contactCompany,
        propertyAddress: inv.propertyAddress,
      }))}
      totals={{
        paidTotal: Number(arTotals.paidTotal),
        paidCount: Number(arTotals.paidCount),
        outstandingTotal: Number(arTotals.outstandingTotal),
        outstandingCount: Number(arTotals.outstandingCount),
        overdueTotal: Number(arTotals.overdueTotal),
        overdueCount: Number(arTotals.overdueCount),
      }}
    />
  );
}
