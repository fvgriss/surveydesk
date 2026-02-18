import { db } from "@/db";
import { callLog, leads, contacts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { IntakeClient } from "./intake-client";

export default async function IntakePage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const calls = await db
    .select({
      id: callLog.id,
      direction: callLog.direction,
      callerPhone: callLog.callerPhone,
      duration: callLog.duration,
      summary: callLog.summary,
      transcript: callLog.transcript,
      outcome: callLog.outcome,
      startedAt: callLog.startedAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
      contactPhone: contacts.phone,
      contactEmail: contacts.email,
    })
    .from(callLog)
    .leftJoin(contacts, eq(callLog.contactId, contacts.id))
    .where(eq(callLog.tenantId, tid))
    .orderBy(desc(callLog.startedAt))
    .limit(20);

  const leadRows = await db
    .select({
      id: leads.id,
      propertyAddress: leads.propertyAddress,
      parcelNumber: leads.parcelNumber,
      surveyType: leads.surveyType,
      source: leads.source,
      status: leads.status,
      urgency: leads.urgency,
      notes: leads.notes,
      callerEmail: leads.callerEmail,
      callerPhone: leads.callerPhone,
      specialRequests: leads.specialRequests,
      createdAt: leads.createdAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
      contactPhone: contacts.phone,
      contactEmail: contacts.email,
    })
    .from(leads)
    .leftJoin(contacts, eq(leads.contactId, contacts.id))
    .where(eq(leads.tenantId, tid))
    .orderBy(desc(leads.createdAt))
    .limit(20);

  return (
    <IntakeClient
      calls={calls.map((c) => ({
        id: c.id,
        direction: c.direction,
        callerPhone: c.callerPhone,
        duration: c.duration,
        summary: c.summary,
        transcript: c.transcript,
        outcome: c.outcome,
        startedAt: c.startedAt.toISOString(),
        contactName: [c.contactFirstName, c.contactLastName].filter(Boolean).join(" "),
        contactCompany: c.contactCompany,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
      }))}
      leads={leadRows.map((l) => ({
        ...l,
        contactName: [l.contactFirstName, l.contactLastName].filter(Boolean).join(" "),
        contactPhone: l.contactPhone,
        contactEmail: l.contactEmail,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
