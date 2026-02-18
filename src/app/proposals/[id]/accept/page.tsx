import { notFound } from "next/navigation";
import { db } from "@/db";
import { proposals, contacts, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import AcceptClientComponent from "./accept-client";

export const dynamic = "force-dynamic";

const SURVEY_TYPE_LABELS: Record<string, string> = {
  boundary: "Boundary Survey",
  alta: "ALTA/NSPS Land Title Survey",
  topographic: "Topographic Survey",
  as_built: "As-Built Survey",
  subdivision: "Subdivision Survey",
  construction: "Construction Survey",
  elevation_cert: "Elevation Certificate",
  route: "Route Survey",
  other: "Survey",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptProposalPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  // Fetch proposal
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, id))
    .limit(1);

  if (
    !proposal ||
    proposal.acceptanceToken !== token ||
    (proposal.status !== "sent" && proposal.status !== "viewed" && proposal.status !== "accepted")
  ) {
    notFound();
  }

  // Fetch contact
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, proposal.contactId))
    .limit(1);

  if (!contact) {
    notFound();
  }

  // Fetch tenant
  const [tenantData] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, proposal.tenantId))
    .limit(1);

  if (!tenantData) {
    notFound();
  }

  // Update viewed status if currently sent
  if (proposal.status === "sent") {
    await db
      .update(proposals)
      .set({
        status: "viewed",
        viewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id));
  }

  const surveyTypeLabel =
    SURVEY_TYPE_LABELS[proposal.surveyType] || proposal.surveyType;

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const tenantAddress = [
    tenantData.address,
    tenantData.city && tenantData.state
      ? `${tenantData.city}, ${tenantData.state} ${tenantData.zip || ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Tenant Header */}
        <div className="bg-white border-b-4 border-blue-600 p-8 mb-8 rounded-t-lg">
          <div className="mb-4">
            <h1 className="text-4xl font-bold text-gray-900">
              {tenantData.name}
            </h1>
          </div>

          <div className="text-sm text-gray-600 whitespace-pre-line mb-4">
            {tenantAddress}
          </div>

          <div className="text-sm text-gray-600">
            {[
              tenantData.phone,
              tenantData.email,
              tenantData.plsLicenseNumber
                ? `PLS License: ${tenantData.plsLicenseNumber}${tenantData.plsLicenseState ? ` (${tenantData.plsLicenseState})` : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(" | ")}
          </div>
        </div>

        {/* Proposal Title */}
        <div className="bg-white border-b border-gray-200 p-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                SURVEY PROPOSAL
              </h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Proposal Date: {formatDate(proposal.createdAt.toISOString())}</p>
                <p>Valid Until: {formatDate(proposal.validUntil)}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <p className="text-xs text-gray-600 mb-1">Proposal #</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {proposal.id.substring(0, 8)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Info Section */}
        <div className="bg-white border-b border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Client Information
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            {contact.firstName && (
              <p>
                {contact.firstName} {contact.lastName}
              </p>
            )}
            {contact.companyName && <p>{contact.companyName}</p>}
            {contact.email && <p>Email: {contact.email}</p>}
          </div>
        </div>

        {/* Property Info */}
        <div className="bg-white border-b border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Property Information
          </h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <span className="font-semibold text-gray-900">Address:</span> {proposal.propertyAddress}
            </p>
            <p>
              <span className="font-semibold text-gray-900">Survey Type:</span> {surveyTypeLabel}
            </p>
          </div>
        </div>

        {/* Scope of Work */}
        <div className="bg-white border-b border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">
            Scope of Work
          </h3>
          <div className="space-y-6">
            {proposal.scopeItems.filter((item) => item.included).length > 0 ? (
              proposal.scopeItems
                .filter((item) => item.included)
                .map((item, index) => (
                  <div key={index}>
                    <h4 className="font-bold text-gray-900 mb-2">
                      {index + 1}. {item.task}
                    </h4>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                ))
            ) : (
              <p className="text-sm text-gray-600">
                Standard scope items as described herein
              </p>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white border-b border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Pricing</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-900">
                    Description
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-gray-900">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-gray-900">
                    Unit Price
                  </th>
                  <th className="text-right px-4 py-3 font-bold text-gray-900">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {proposal.lineItems.map((item, index) => (
                  <tr key={index} className="border border-gray-200">
                    <td className="px-4 py-3 text-gray-600">
                      {item.description}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 space-y-3 text-right">
            <div className="flex justify-end gap-4 text-sm">
              <span className="font-semibold text-gray-900">Subtotal:</span>
              <span className="text-gray-600">{formatCurrency(proposal.subtotal)}</span>
            </div>

            <div className="flex justify-end gap-4 text-lg">
              <span className="font-bold text-gray-900">TOTAL:</span>
              <span className="font-bold text-blue-600">
                {formatCurrency(proposal.total)}
              </span>
            </div>

            {proposal.depositRequired && proposal.depositPercent && (
              <div className="flex justify-end gap-4 text-sm mt-4 pt-4 border-t border-gray-200">
                <span className="font-semibold text-gray-900">
                  Deposit Required ({proposal.depositPercent}%):
                </span>
                <span className="text-gray-600">
                  {formatCurrency(
                    (parseFloat(proposal.total) * proposal.depositPercent) / 100
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="bg-white border-b border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Terms & Conditions
          </h3>
          <div className="text-sm text-gray-600 whitespace-pre-wrap">
            {proposal.termsAndConditions ||
              "Standard terms and conditions apply. Payment due upon receipt of invoice. All work subject to site conditions and customer approval."}
          </div>
        </div>

        {/* Acceptance Form */}
        <div className="bg-white rounded-b-lg p-8">
          {proposal.status === "accepted" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-900 mb-2">
                Proposal Accepted
              </h3>
              <p className="text-sm text-green-700">
                This proposal was accepted on{" "}
                {proposal.acceptedAt
                  ? formatDate(proposal.acceptedAt.toISOString())
                  : "recently"}{" "}
                {proposal.acceptedByName ? `by ${proposal.acceptedByName}` : ""}.
              </p>
            </div>
          ) : (
            <AcceptClientComponent
              proposalId={proposal.id}
              token={token}
              contactEmail={contact.email}
              contactName={
                contact.firstName ? `${contact.firstName}` : undefined
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
