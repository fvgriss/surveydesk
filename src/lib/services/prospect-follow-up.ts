import { db } from "@/db";
import { contacts, leads, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const BOOKING_URL = "https://calendly.com/vance-terrainplot/intro";

export type ProspectCallData = {
  firmName: string;
  contactName: string;
  firmSize: string | null;
  currentTools: string | null;
  painPoints: string | null;
  interestLevel: string | null;
};

/**
 * Send a branded follow-up email to a SurveyDesk sales prospect
 * after qualify_prospect creates their lead. Shows the structured
 * data extracted from the AI call as a "look what we captured" moment,
 * then CTA to book a 20-min onboarding call.
 *
 * Non-blocking — called with .catch(console.error) from the tool-call handler.
 */
export async function sendProspectFollowUp(
  tenantId: string,
  leadId: string,
  contactId: string,
  callData: ProspectCallData
): Promise<void> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!contact || !tenant) {
    console.error("[prospect-follow-up] Missing data:", {
      contact: !!contact,
      tenant: !!tenant,
    });
    return;
  }

  const email = contact.email;
  if (!email) {
    console.log("[prospect-follow-up] No email for contact, skipping");
    return;
  }

  const firstName = contact.firstName || "there";
  const contactName = contact.firstName
    ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`
    : "there";

  const emailHtml = buildFollowUpEmail({
    tenantName: tenant.name,
    contactName,
    firstName,
    callData,
    tenantPhone: tenant.phone,
    tenantEmail: tenant.email,
    bookingUrl: BOOKING_URL,
  });

  try {
    await resend.emails.send({
      from: "SurveyDesk <proposals@updates.surveydesk.app>",
      to: email,
      subject: `${firstName}, let's get ${callData.firmName} set up on SurveyDesk`,
      html: emailHtml,
    });

    console.log(`[prospect-follow-up] Follow-up email sent to ${email}`);

    // Move lead to "qualifying" — follow-up sent, awaiting booking
    await db
      .update(leads)
      .set({ status: "qualifying", updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  } catch (err) {
    console.error("[prospect-follow-up] Failed to send follow-up email:", err);
  }
}

function buildFollowUpEmail(params: {
  tenantName: string;
  contactName: string;
  firstName: string;
  callData: ProspectCallData;
  tenantPhone: string | null;
  tenantEmail: string | null;
  bookingUrl: string;
}): string {
  const {
    tenantName,
    contactName,
    firstName,
    callData,
    tenantPhone,
    tenantEmail,
    bookingUrl,
  } = params;

  // Build the extracted-data rows — only show fields that were captured
  const dataRows: { label: string; value: string }[] = [
    { label: "Firm", value: callData.firmName },
    { label: "Contact", value: callData.contactName },
  ];
  if (callData.firmSize)
    dataRows.push({ label: "Team Size", value: callData.firmSize });
  if (callData.currentTools)
    dataRows.push({ label: "Current Tools", value: callData.currentTools });
  if (callData.painPoints)
    dataRows.push({ label: "Pain Points", value: callData.painPoints });
  if (callData.interestLevel)
    dataRows.push({
      label: "Interest",
      value: callData.interestLevel.charAt(0).toUpperCase() + callData.interestLevel.slice(1),
    });

  const dataTableHtml = dataRows
    .map(
      (row) =>
        `<tr>
          <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; vertical-align: top;">${row.label}</td>
          <td style="padding: 8px 12px; font-size: 14px; color: #1f2937;">${row.value}</td>
        </tr>`
    )
    .join("");

  return `
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
    .company-name { font-size: 24px; font-weight: bold; color: #1f2937; }
    .greeting { font-size: 16px; margin-bottom: 20px; color: #1f2937; }
    .section { margin-bottom: 25px; }
    .section-content { font-size: 14px; color: #6b7280; line-height: 1.8; }
    .data-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin: 20px 0; }
    .data-card-header { background-color: #1e293b; padding: 12px 16px; }
    .data-card-title { font-size: 13px; font-weight: 600; color: #ffffff; margin: 0; }
    .data-card-subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .features { margin: 20px 0; }
    .feature-item { font-size: 14px; color: #374151; padding: 6px 0 6px 24px; position: relative; }
    .feature-item::before { content: "\\2713"; position: absolute; left: 0; color: #2563eb; font-weight: bold; }
    .cta-wrapper { text-align: center; margin: 30px 0; }
    .cta-button { display: inline-block; background-color: #2563eb; color: white !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; }
    .trial-note { text-align: center; font-size: 13px; color: #9ca3af; margin-top: 8px; }
    .footer { border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #9ca3af; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">${tenantName}</div>
    </div>

    <div class="greeting">Hi ${contactName},</div>

    <div class="section">
      <div class="section-content">
        Thanks for chatting with us about ${callData.firmName}. You just spoke with our AI phone agent — and here's what it captured from your call, automatically:
      </div>
    </div>

    <div class="data-card">
      <div class="data-card-header">
        <div class="data-card-title">Extracted from your call</div>
        <div class="data-card-subtitle">This is what your clients' intake calls would look like in SurveyDesk</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${dataTableHtml}
      </table>
    </div>

    <div class="section">
      <div class="section-content">
        That happened in real time — no manual data entry, no sticky notes, no missed details. Every call to your firm would be captured the same way, with leads automatically created and ready for your team to act on.
      </div>
    </div>

    <div class="section">
      <div class="section-content">
        Beyond the AI phone agent, SurveyDesk gives you:
      </div>
      <div class="features">
        <div class="feature-item">Professional proposals with online accept/decline</div>
        <div class="feature-item">Crew scheduling, field visit tracking, and job management</div>
        <div class="feature-item">Invoicing with online payments and accounts receivable</div>
        <div class="feature-item">Everything connected — from the first call to the final invoice</div>
      </div>
    </div>

    <div class="section">
      <div class="section-content">
        I'd love to spend 20 minutes getting ${callData.firmName} set up so you can see it in action with your own data:
      </div>
    </div>

    <div class="cta-wrapper">
      <a href="${bookingUrl}" class="cta-button">Book Your Setup Call</a>
      <div class="trial-note">20 minutes &middot; I'll get you live on a free 14-day trial during the call</div>
    </div>

    <div class="section">
      <div class="section-content">
        If you have any questions in the meantime, just reply to this email${tenantPhone ? ` or call me at ${tenantPhone}` : ""}.
      </div>
    </div>

    <div class="section">
      <div class="section-content" style="color: #374151;">
        Talk soon,<br>
        <strong>Vance</strong>
      </div>
    </div>

    <div class="footer">
      <strong>${tenantName}</strong><br>
      ${tenantPhone ? `Phone: ${tenantPhone}<br>` : ""}
      ${tenantEmail ? `Email: ${tenantEmail}<br>` : ""}
    </div>
  </div>
</body>
</html>`.trim();
}
