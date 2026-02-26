import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import twilio from "twilio";

const resend = new Resend(process.env.RESEND_API_KEY);

const BOOKING_URL = "https://calendly.com/vance-terrainplot/intro";

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return null;
  return { client: twilio(sid, token), from };
}

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

type Prospect = {
  id: string;
  firmName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  firmSize: string | null;
  currentTools: string | null;
  painPoints: string | null;
  interestLevel: string | null;
};

/**
 * Send a branded follow-up email + SMS to a SurveyDesk sales prospect.
 * Shows the structured data extracted from the AI call, then CTA to
 * book a 20-min onboarding call.
 *
 * Non-blocking — called with .catch() from the tool-call handler.
 */
export async function sendProspectFollowUp(prospect: Prospect): Promise<void> {
  const firstName = prospect.contactName.split(" ")[0] || "there";

  // Send email (only if we have an email address)
  if (prospect.email) {
    try {
      const emailHtml = buildFollowUpEmail({
        contactName: prospect.contactName,
        firstName,
        firmName: prospect.firmName,
        firmSize: prospect.firmSize,
        currentTools: prospect.currentTools,
        painPoints: prospect.painPoints,
        interestLevel: prospect.interestLevel,
        bookingUrl: BOOKING_URL,
      });

      await resend.emails.send({
        from: "SurveyDesk <proposals@updates.surveydesk.app>",
        to: prospect.email,
        cc: "vance@terrainplot.com",
        subject: `${firstName}, let's get ${prospect.firmName} set up on SurveyDesk`,
        html: emailHtml,
      });

      await db
        .update(prospects)
        .set({ followUpSentAt: new Date(), updatedAt: new Date() })
        .where(eq(prospects.id, prospect.id));

      console.log(`[prospect-follow-up] Email sent to ${prospect.email}`);
    } catch (err) {
      console.error("[prospect-follow-up] Email failed:", err);
    }
  } else {
    console.log("[prospect-follow-up] No email, skipping email");
  }

  // Send SMS (independent of email — fires if phone is available)
  if (prospect.phone) {
    try {
      const tw = getTwilioClient();
      if (tw) {
        await tw.client.messages.create({
          body: `Hi ${firstName}, this is Vance from SurveyDesk. Thanks for chatting with us about ${prospect.firmName}! I'd love to get you set up with a free 14-day trial. Book a quick 20-min call here: ${BOOKING_URL}`,
          to: cleanPhone(prospect.phone),
          from: tw.from,
        });

        await db
          .update(prospects)
          .set({ smsSentAt: new Date(), updatedAt: new Date() })
          .where(eq(prospects.id, prospect.id));

        console.log(`[prospect-follow-up] SMS sent to ${prospect.phone}`);
      }
    } catch (err) {
      console.error("[prospect-follow-up] SMS failed:", err);
    }
  }

  // Update status to contacted
  try {
    await db
      .update(prospects)
      .set({ status: "contacted", updatedAt: new Date() })
      .where(eq(prospects.id, prospect.id));
  } catch (err) {
    console.error("[prospect-follow-up] Status update failed:", err);
  }
}

function buildFollowUpEmail(params: {
  contactName: string;
  firstName: string;
  firmName: string;
  firmSize: string | null;
  currentTools: string | null;
  painPoints: string | null;
  interestLevel: string | null;
  bookingUrl: string;
}): string {
  const {
    contactName,
    firstName,
    firmName,
    firmSize,
    currentTools,
    painPoints,
    interestLevel,
    bookingUrl,
  } = params;

  // Build extracted-data rows — only show fields that were captured
  const dataRows: { label: string; value: string }[] = [
    { label: "Firm", value: firmName },
    { label: "Contact", value: contactName },
  ];
  if (firmSize) dataRows.push({ label: "Team Size", value: firmSize });
  if (currentTools) dataRows.push({ label: "Current Tools", value: currentTools });
  if (painPoints) dataRows.push({ label: "Pain Points", value: painPoints });
  if (interestLevel)
    dataRows.push({
      label: "Interest",
      value: interestLevel.charAt(0).toUpperCase() + interestLevel.slice(1),
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
      <div class="company-name">SurveyDesk</div>
    </div>

    <div class="greeting">Hi ${contactName},</div>

    <div class="section">
      <div class="section-content">
        Thanks for chatting with us about ${firmName}. You just spoke with our AI phone agent — and here's what it captured from your call, automatically:
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
        I'd love to spend 20 minutes getting ${firmName} set up so you can see it in action with your own data:
      </div>
    </div>

    <div class="cta-wrapper">
      <a href="${bookingUrl}" class="cta-button">Book Your Setup Call</a>
      <div class="trial-note">20 minutes &middot; I'll get you live on a free 14-day trial during the call</div>
    </div>

    <div class="section">
      <div class="section-content">
        If you have any questions in the meantime, just reply to this email or call me at (512) 487-7511.
      </div>
    </div>

    <div class="section">
      <div class="section-content" style="color: #374151;">
        Talk soon,<br>
        <strong>Vance</strong>
      </div>
    </div>

    <div class="footer">
      <strong>SurveyDesk</strong><br>
      Email: vance@terrainplot.com<br>
    </div>
  </div>
</body>
</html>`.trim();
}
