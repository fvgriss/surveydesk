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
      if (!tw) {
        console.log("[prospect-follow-up] Twilio not configured (missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER)");
      }
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
      (row, i) =>
        `<tr>
          <td style="padding: 12px 16px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; vertical-align: top; border-bottom: 1px solid ${i < dataRows.length - 1 ? '#f1f5f9' : 'transparent'};">${row.label}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #f8fafc; border-bottom: 1px solid ${i < dataRows.length - 1 ? '#334155' : 'transparent'};">${row.value}</td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <!-- Hero -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 48px 20px 32px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom: 32px;">
              <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Survey</span><span style="font-size: 28px; font-weight: 800; color: #3b82f6; letter-spacing: -0.5px;">Desk</span>
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="margin: 0 0 12px; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.2; letter-spacing: -0.5px;">
                Your call, captured.
              </h1>
              <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                ${firstName}, you just spoke with our AI phone agent about ${firmName}. Here's everything it extracted — automatically, in real time.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Data Card -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 0 20px 32px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
          <tr>
            <td style="padding: 16px 16px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 4px;">From your call</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${dataTableHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 16px;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-style: italic;">
                This is exactly what your clients' intake calls would look like in SurveyDesk.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Body Content -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 48px 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.8;">
                No manual data entry. No sticky notes. No missed details. Every call to ${firmName} would be captured the same way — leads created automatically and ready for your team to act on.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.8;">
                Beyond the AI phone agent, SurveyDesk gives you:
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Feature Grid -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 0 20px 40px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding: 0 8px 16px 0; vertical-align: top;">
              <table cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; width: 100%;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">&#128222;</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">AI Phone Agent</div>
                    <div style="font-size: 12px; color: #64748b; line-height: 1.5;">Every call answered, every lead captured automatically</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" style="padding: 0 0 16px 8px; vertical-align: top;">
              <table cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; width: 100%;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">&#128203;</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Proposals</div>
                    <div style="font-size: 12px; color: #64748b; line-height: 1.5;">Professional proposals with online accept &amp; e-sign</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding: 0 8px 0 0; vertical-align: top;">
              <table cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; width: 100%;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">&#128197;</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Scheduling</div>
                    <div style="font-size: 12px; color: #64748b; line-height: 1.5;">Crew dispatch, field visits, and job tracking</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" style="padding: 0 0 0 8px; vertical-align: top;">
              <table cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; width: 100%;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">&#128176;</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Invoicing</div>
                    <div style="font-size: 12px; color: #64748b; line-height: 1.5;">Online payments, AR tracking, and auto reminders</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 0 20px 48px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 32px; background-color: #f0f9ff; border-radius: 12px; border: 1px solid #bae6fd;">
              <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #0f172a;">
                Let's get ${firmName} set up
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">
                20 minutes — I'll get you live on a free 14-day trial during the call.
              </p>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${bookingUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" fillcolor="#2563eb" stroke="f">
                <v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Book Your Setup Call</center></v:textbox>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${bookingUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; letter-spacing: -0.2px;">Book Your Setup Call &rarr;</a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Sign-off -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 0 20px 48px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin: 0 0 16px; font-size: 14px; color: #64748b; line-height: 1.7;">
                Questions? Just reply to this email or call me at <strong style="color: #1e293b;">(512) 487-7511</strong>.
              </p>
              <p style="margin: 0; font-size: 14px; color: #374151;">
                Talk soon,<br>
                <strong>Vance</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
    <tr>
      <td align="center" style="padding: 24px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size: 16px; font-weight: 800; color: #1e293b;">Survey</span><span style="font-size: 16px; font-weight: 800; color: #3b82f6;">Desk</span>
              <span style="font-size: 12px; color: #94a3b8; margin-left: 12px;">The all-in-one platform for land surveyors</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 8px;">
              <span style="font-size: 12px; color: #94a3b8;">vance@terrainplot.com</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}
