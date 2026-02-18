import { db } from "@/db";
import { proposals, contacts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { ProposalsClient } from "./proposals-client";

export default async function ProposalsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  const tid = tenant.tenantId;

  const rows = await db
    .select({
      id: proposals.id,
      propertyAddress: proposals.propertyAddress,
      surveyType: proposals.surveyType,
      status: proposals.status,
      total: proposals.total,
      sentAt: proposals.sentAt,
      viewedAt: proposals.viewedAt,
      acceptedAt: proposals.acceptedAt,
      validUntil: proposals.validUntil,
      createdAt: proposals.createdAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompany: contacts.companyName,
    })
    .from(proposals)
    .leftJoin(contacts, eq(proposals.contactId, contacts.id))
    .where(eq(proposals.tenantId, tid))
    .orderBy(desc(proposals.createdAt));

  return (
    <ProposalsClient
      proposals={rows.map((p) => ({
        id: p.id,
        propertyAddress: p.propertyAddress,
        surveyType: p.surveyType,
        status: p.status,
        total: Number(p.total),
        sentAt: p.sentAt?.toISOString() || null,
        viewedAt: p.viewedAt?.toISOString() || null,
        acceptedAt: p.acceptedAt?.toISOString() || null,
        validUntil: p.validUntil,
        createdAt: p.createdAt.toISOString(),
        contactName: [p.contactFirstName, p.contactLastName].filter(Boolean).join(" "),
        contactCompany: p.contactCompany,
      }))}
    />
  );
}
