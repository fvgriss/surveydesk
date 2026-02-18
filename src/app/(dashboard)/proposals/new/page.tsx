import { db } from "@/db";
import { contacts, leads, proposalTemplates, tenants } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import ProposalForm from "./proposal-form";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  const { leadId } = await searchParams;
  const tid = tenant.tenantId;

  // Fetch all contacts
  const allContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, tid));

  // Fetch leads with status "new" or "qualifying"
  const allLeads = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tid),
        inArray(leads.status, ["new", "qualifying"])
      )
    );

  // Fetch proposal templates
  const allTemplates = await db
    .select()
    .from(proposalTemplates)
    .where(eq(proposalTemplates.tenantId, tid));

  // Fetch tenant's default terms
  const [tenantData] = await db
    .select({
      proposalTerms: tenants.proposalTerms,
    })
    .from(tenants)
    .where(eq(tenants.id, tid));

  const selectedLeadId = leadId || null;

  return (
    <ProposalForm
      contacts={allContacts}
      leads={allLeads}
      templates={allTemplates}
      tenantTerms={tenantData?.proposalTerms || ""}
      selectedLeadId={selectedLeadId}
    />
  );
}
