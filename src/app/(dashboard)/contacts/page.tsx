import { redirect } from "next/navigation";
import { db } from "@/db";
import { contacts, projects, leads } from "@/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  if (tenant.role === "instrument_person") redirect("/schedule");

  // Fetch all contacts with project counts
  const contactRows = await db
    .select({
      id: contacts.id,
      type: contacts.type,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyName: contacts.companyName,
      email: contacts.email,
      phone: contacts.phone,
      city: contacts.city,
      state: contacts.state,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      projectCount: sql<number>`(
        SELECT COUNT(*)::int FROM projects
        WHERE projects.contact_id = contacts.id
      )`,
      totalRevenue: sql<string>`COALESCE((
        SELECT SUM(p.amount)::text FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.contact_id = contacts.id
      ), '0')`,
      openInvoices: sql<number>`(
        SELECT COUNT(*)::int FROM invoices
        WHERE invoices.contact_id = contacts.id
        AND invoices.status NOT IN ('paid', 'void')
      )`,
    })
    .from(contacts)
    .where(eq(contacts.tenantId, tenant.tenantId))
    .orderBy(desc(contacts.createdAt));

  // Type stats
  const typeStats = await db
    .select({
      type: contacts.type,
      count: count(),
    })
    .from(contacts)
    .where(eq(contacts.tenantId, tenant.tenantId))
    .groupBy(contacts.type);

  const statsMap: Record<string, number> = {};
  for (const row of typeStats) {
    statsMap[row.type] = row.count;
  }

  const serialized = contactRows.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    projectCount: Number(c.projectCount),
    totalRevenue: c.totalRevenue || "0",
    openInvoices: Number(c.openInvoices),
  }));

  return (
    <ContactsClient
      contacts={serialized}
      totalCount={contactRows.length}
      typeStats={statsMap}
    />
  );
}
