import { db } from "@/db";
import { proposals, contacts, leads, proposalTemplates, tenants } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import ProposalForm from "../new/proposal-form";

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");

  const { id } = await params;
  const tid = tenant.tenantId;

  // Fetch the proposal
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.tenantId, tid)))
    .limit(1);

  if (!proposal) redirect("/proposals");

  // Fetch all contacts
  const allContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, tid));

  // Fetch leads with status "new" or "qualifying"
  const allLeads = await db
    .select()
    .from(leads)
    .where(and(eq(leads.tenantId, tid)));

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

  // Transform proposal data for form
  const proposalData = {
    id: proposal.id,
    contactId: proposal.contactId,
    leadId: proposal.leadId,
    propertyAddress: proposal.propertyAddress,
    surveyType: proposal.surveyType,
    scopeItems: proposal.scopeItems || [],
    lineItems: proposal.lineItems || [],
    pricingMode: proposal.pricingMode,
    termsAndConditions: proposal.termsAndConditions || "",
    validUntil: proposal.validUntil,
    depositRequired: proposal.depositRequired,
    depositPercent: proposal.depositPercent || 50,
  };

  return (
    <ProposalForm
      proposal={proposalData}
      contacts={allContacts}
      leads={allLeads}
      templates={allTemplates}
      tenantTerms={tenantData?.proposalTerms || ""}
    />
  );
}
