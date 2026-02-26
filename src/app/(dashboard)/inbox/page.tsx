import { db } from "@/db";
import { emailLog, contacts, projects, integrations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  if (["crew_chief", "instrument_person"].includes(tenant.role)) redirect("/schedule");
  const tid = tenant.tenantId;

  // Check Gmail connection
  const [gmailIntegration] = await db
    .select({ isActive: integrations.isActive, accountEmail: integrations.accountEmail })
    .from(integrations)
    .where(and(eq(integrations.tenantId, tid), eq(integrations.provider, "gmail")))
    .limit(1);

  const gmailConnected = !!gmailIntegration?.isActive;
  const gmailEmail = gmailIntegration?.accountEmail || null;

  // Fetch emails
  const emails = await db
    .select({
      id: emailLog.id,
      gmailMessageId: emailLog.gmailMessageId,
      from: emailLog.from,
      fromName: emailLog.fromName,
      subject: emailLog.subject,
      bodyPreview: emailLog.bodyPreview,
      bodyFull: emailLog.bodyFull,
      emailStatus: emailLog.emailStatus,
      aiClassification: emailLog.aiClassification,
      aiSuggestion: emailLog.aiSuggestion,
      contactId: emailLog.contactId,
      leadId: emailLog.leadId,
      projectId: emailLog.projectId,
      receivedAt: emailLog.receivedAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(emailLog)
    .leftJoin(contacts, eq(emailLog.contactId, contacts.id))
    .where(eq(emailLog.tenantId, tid))
    .orderBy(desc(emailLog.receivedAt))
    .limit(100);

  // Fetch active projects for the assign dropdown
  const activeProjects = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
    })
    .from(projects)
    .where(eq(projects.tenantId, tid))
    .orderBy(desc(projects.createdAt));

  return (
    <InboxClient
      emails={emails.map((e) => ({
        id: e.id,
        from: e.from,
        fromName: e.fromName,
        subject: e.subject,
        bodyPreview: e.bodyPreview,
        bodyFull: e.bodyFull,
        emailStatus: e.emailStatus,
        aiClassification: e.aiClassification,
        aiSuggestion: e.aiSuggestion as any,
        contactId: e.contactId,
        leadId: e.leadId,
        projectId: e.projectId,
        receivedAt: e.receivedAt.toISOString(),
        contactName: [e.contactFirstName, e.contactLastName].filter(Boolean).join(" "),
      }))}
      gmailConnected={gmailConnected}
      gmailEmail={gmailEmail}
      projects={activeProjects}
    />
  );
}
