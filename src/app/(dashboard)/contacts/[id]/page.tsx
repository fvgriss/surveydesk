import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { contacts, projects, invoices, leads } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { ContactDetailClient } from "./contact-detail-client";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)))
    .limit(1);

  if (!contact) notFound();

  // Projects for this contact
  const projectRows = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      status: projects.status,
      contractValue: projects.contractValue,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(
      and(
        eq(projects.contactId, id),
        eq(projects.tenantId, tenant.tenantId)
      )
    )
    .orderBy(desc(projects.createdAt));

  // Invoices for this contact
  const invoiceRows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      type: invoices.type,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.contactId, id),
        eq(invoices.tenantId, tenant.tenantId)
      )
    )
    .orderBy(desc(invoices.createdAt));

  // Leads for this contact
  const leadRows = await db
    .select({
      id: leads.id,
      propertyAddress: leads.propertyAddress,
      surveyType: leads.surveyType,
      status: leads.status,
      source: leads.source,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.contactId, id),
        eq(leads.tenantId, tenant.tenantId)
      )
    )
    .orderBy(desc(leads.createdAt));

  return (
    <ContactDetailClient
      contact={{
        ...contact,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      }}
      projects={projectRows.map((p) => ({
        ...p,
        contractValue: p.contractValue || "0",
        createdAt: p.createdAt.toISOString(),
      }))}
      invoices={invoiceRows.map((i) => ({
        ...i,
        total: i.total || "0",
        dueDate: i.dueDate || "",
        createdAt: i.createdAt.toISOString(),
      }))}
      leads={leadRows.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
