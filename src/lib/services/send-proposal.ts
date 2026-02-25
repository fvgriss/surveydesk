import { db } from "@/db";
import { proposals, contacts, tenants, leads } from "@/db/schema";
import { generateProposalPdf } from "@/lib/pdf/generate-proposal";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

/**
 * Send a proposal email with PDF attachment and acceptance link.
 * Shared utility used by the send API route and auto-follow-up.
 */
export async function sendProposalEmail(
  proposalId: string,
  overrideEmail?: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  // Fetch proposal
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!proposal) return { success: false, error: "Proposal not found" };

  // Fetch contact
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, proposal.contactId))
    .limit(1);

  if (!contact) return { success: false, error: "Contact not found" };

  // Fetch tenant
  const [tenantData] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, proposal.tenantId))
    .limit(1);

  if (!tenantData) return { success: false, error: "Tenant not found" };

  const email = overrideEmail || contact.email;
  if (!email) return { success: false, error: "No email address" };

  // Generate acceptance token if not present
  let acceptanceToken = proposal.acceptanceToken;
  if (!acceptanceToken) {
    acceptanceToken = randomBytes(32).toString("hex");
  }

  // Generate PDF
  const acceptanceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/proposals/${proposal.id}/accept?token=${acceptanceToken}`;

  const pdfBuffer = await generateProposalPdf({
    tenant: tenantData,
    proposal: {
      ...proposal,
      createdAt: proposal.createdAt.toISOString(),
    },
    contact,
    acceptanceUrl,
  });

  // Prepare email
  const surveyTypeLabel =
    SURVEY_TYPE_LABELS[proposal.surveyType] || proposal.surveyType;

  const contactName = contact.firstName
    ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`
    : "Valued Client";

  const validUntilDate = new Date(proposal.validUntil).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #374151;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto;
    }
    .container { background-color: #ffffff; padding: 40px 20px; }
    .header { border-bottom: 3px solid #2563eb; margin-bottom: 30px; padding-bottom: 20px; }
    .company-name { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
    .greeting { font-size: 16px; margin-bottom: 20px; color: #1f2937; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
    .section-content { font-size: 14px; color: #6b7280; line-height: 1.8; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 14px; }
    .detail-item { color: #6b7280; }
    .detail-label { font-weight: bold; color: #374151; margin-bottom: 3px; }
    .cta-button { display: inline-block; background-color: #2563eb; color: white !important; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 15px; margin-bottom: 25px; }
    .footer { border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #9ca3af; }
    .footer-content { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">${tenantData.name}</div>
    </div>
    <div class="greeting">Hi ${contactName},</div>
    <div class="section">
      <div class="section-content">
        Please find attached your proposal for <strong>${proposal.propertyAddress}</strong>.
      </div>
    </div>
    <div class="section">
      <div class="section-title">Proposal Details</div>
      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Type</div>
          ${surveyTypeLabel}
        </div>
        <div class="detail-item">
          <div class="detail-label">Total Amount</div>
          $${parseFloat(proposal.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="detail-item">
          <div class="detail-label">Valid Until</div>
          ${validUntilDate}
        </div>
        <div class="detail-item">
          <div class="detail-label">Proposal ID</div>
          ${proposal.id.substring(0, 8)}
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Next Steps</div>
      <div class="section-content">
        To review and accept this proposal, click the button below:
      </div>
      <a href="${acceptanceUrl}" class="cta-button">View & Accept Proposal</a>
    </div>
    <div class="section">
      <div class="section-content">
        If you have any questions, please don't hesitate to reach out.
      </div>
    </div>
    <div class="footer">
      <div class="footer-content">
        <strong>${tenantData.name}</strong><br>
        ${tenantData.phone ? `Phone: ${tenantData.phone}<br>` : ""}
        ${tenantData.email ? `Email: ${tenantData.email}<br>` : ""}
        ${tenantData.address ? `${tenantData.address} ` : ""}
        ${tenantData.city ? `${tenantData.city}, ${tenantData.state} ${tenantData.zip}` : ""}
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  // Send email
  const emailResponse = await resend.emails.send({
    from: "SurveyDesk <proposals@updates.surveydesk.app>",
    to: email,
    subject: `Proposal from ${tenantData.name} — ${proposal.propertyAddress}`,
    html: emailHtml,
    attachments: [
      {
        filename: `proposal-${proposal.id}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (emailResponse.error) {
    console.error("Resend error:", JSON.stringify(emailResponse.error));
    return { success: false, error: emailResponse.error.message || "Email failed" };
  }

  // Update proposal status
  await db
    .update(proposals)
    .set({
      status: "sent",
      sentAt: new Date(),
      acceptanceToken,
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId));

  // Update linked lead status
  if (proposal.leadId) {
    await db
      .update(leads)
      .set({ status: "proposal_sent", updatedAt: new Date() })
      .where(eq(leads.id, proposal.leadId));
  }

  return { success: true, emailId: emailResponse.data?.id };
}
