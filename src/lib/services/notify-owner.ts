import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";
import twilio from "twilio";

const resend = new Resend(process.env.RESEND_API_KEY);

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return null;
  return { client: twilio(sid, token), from };
}

interface NewLeadData {
  callerName?: string | null;
  propertyAddress?: string | null;
  surveyType?: string | null;
  urgency?: string | null;
  source?: string | null;
}

/**
 * Notify all active team members (via email and/or SMS) when a new lead is created.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyOwnerNewLead(
  tenantId: string,
  lead: NewLeadData
): Promise<void> {
  try {
    // Get all active users who may want notifications
    const notifyUsers = await db
      .select({
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true)
        )
      );

    if (notifyUsers.length === 0) return;

    // Get firm name for branding
    const [tenant] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const firmName = tenant?.name || "SurveyDesk";
    const name = lead.callerName || "Unknown caller";
    const address = lead.propertyAddress || "Address TBD";
    const surveyLabel = (lead.surveyType || "survey").replace(/_/g, " ");
    const urgencyLabel = lead.urgency ? ` (${lead.urgency} urgency)` : "";
    const sourceLabel = lead.source === "email" ? " via email" : " via phone";

    // Send email notifications in parallel
    const emailPromises = notifyUsers
      .filter((u) => u.emailNotifications && u.email && process.env.RESEND_API_KEY)
      .map(async (user) => {
        try {
          await resend.emails.send({
            from: "SurveyOS <onboarding@resend.dev>",
            to: user.email,
            subject: `New lead: ${surveyLabel} survey at ${address}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px;">
                <p>Hi ${user.fullName?.split(" ")[0] || "there"},</p>
                <p>A new lead just came in${sourceLabel}:</p>
                <table style="border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Contact</td><td style="padding: 4px 0; font-size: 14px;">${name}</td></tr>
                  <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Survey</td><td style="padding: 4px 0; font-size: 14px;">${surveyLabel}</td></tr>
                  <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Address</td><td style="padding: 4px 0; font-size: 14px;">${address}</td></tr>
                  ${lead.urgency ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Urgency</td><td style="padding: 4px 0; font-size: 14px;">${lead.urgency}</td></tr>` : ""}
                </table>
                <p style="margin-top: 16px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app"}/intake" style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View in Dashboard</a>
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${firmName} — powered by SurveyOS</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.warn(`[notify-team] Email to ${user.email} failed:`, emailErr);
        }
      });

    // Send SMS notifications in parallel
    const smsPromises = notifyUsers
      .filter((u) => u.smsNotifications && u.phone)
      .map(async (user) => {
        const tw = getTwilioClient();
        if (!tw) return;
        try {
          const digits = user.phone!.replace(/\D/g, "");
          const to = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+${digits}`;

          await tw.client.messages.create({
            body: `New lead${sourceLabel}: ${name} needs a ${surveyLabel} at ${address}${urgencyLabel}. — ${firmName}`,
            to,
            from: tw.from,
          });
        } catch (smsErr) {
          console.warn(`[notify-team] SMS to ${user.phone} failed:`, smsErr);
        }
      });

    await Promise.allSettled([...emailPromises, ...smsPromises]);
  } catch (err) {
    console.warn("[notify-team] Notification failed (non-blocking):", err);
  }
}
