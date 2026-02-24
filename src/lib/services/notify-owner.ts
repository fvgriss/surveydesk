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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+${digits}`;
}

/** Shared helper: fetch active users + firm name, send email+SMS in parallel */
async function notifyTeam(
  tenantId: string,
  build: (firmName: string, appUrl: string) => { subject: string; html: string; smsBody: string }
): Promise<void> {
  try {
    const notifyUsers = await db
      .select({
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        emailNotifications: users.emailNotifications,
        smsNotifications: users.smsNotifications,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

    if (notifyUsers.length === 0) return;

    const [tenant] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const firmName = tenant?.name || "SurveyDesk";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://surveydesk.app";
    const content = build(firmName, appUrl);

    const emailPromises = notifyUsers
      .filter((u) => u.emailNotifications && u.email && process.env.RESEND_API_KEY)
      .map(async (user) => {
        try {
          await resend.emails.send({
            from: "SurveyDesk <notifications@updates.surveydesk.app>",
            to: user.email,
            subject: content.subject,
            html: content.html.replace("{{firstName}}", user.fullName?.split(" ")[0] || "there"),
          });
        } catch (emailErr) {
          console.warn(`[notify-team] Email to ${user.email} failed:`, emailErr);
        }
      });

    const smsPromises = notifyUsers
      .filter((u) => u.smsNotifications && u.phone)
      .map(async (user) => {
        const tw = getTwilioClient();
        if (!tw) return;
        try {
          await tw.client.messages.create({
            body: content.smsBody,
            to: formatPhone(user.phone!),
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

// ─── New Lead ───────────────────────────────────────────────────

interface NewLeadData {
  callerName?: string | null;
  propertyAddress?: string | null;
  surveyType?: string | null;
  urgency?: string | null;
  source?: string | null;
}

export async function notifyOwnerNewLead(
  tenantId: string,
  lead: NewLeadData
): Promise<void> {
  const name = lead.callerName || "Unknown caller";
  const address = lead.propertyAddress || "Address TBD";
  const surveyLabel = (lead.surveyType || "survey").replace(/_/g, " ");
  const urgencyLabel = lead.urgency ? ` (${lead.urgency} urgency)` : "";
  const sourceLabel = lead.source === "email" ? " via email" : " via phone";

  await notifyTeam(tenantId, (firmName, appUrl) => ({
    subject: `New lead: ${surveyLabel} survey at ${address}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>Hi {{firstName}},</p>
        <p>A new lead just came in${sourceLabel}:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Contact</td><td style="padding: 4px 0; font-size: 14px;">${name}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Survey</td><td style="padding: 4px 0; font-size: 14px;">${surveyLabel}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Address</td><td style="padding: 4px 0; font-size: 14px;">${address}</td></tr>
          ${lead.urgency ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Urgency</td><td style="padding: 4px 0; font-size: 14px;">${lead.urgency}</td></tr>` : ""}
        </table>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/intake" style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View in Dashboard</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${firmName} — powered by SurveyOS</p>
      </div>
    `,
    smsBody: `New lead${sourceLabel}: ${name} needs a ${surveyLabel} at ${address}${urgencyLabel}. — ${firmName}`,
  }));
}

// ─── Proposal Accepted ─────────────────────────────────────────

interface ProposalAcceptedData {
  clientName: string;
  propertyAddress: string;
  surveyType: string;
  contractValue: string;
}

export async function notifyTeamProposalAccepted(
  tenantId: string,
  data: ProposalAcceptedData
): Promise<void> {
  const surveyLabel = data.surveyType.replace(/_/g, " ");
  const value = parseFloat(data.contractValue).toLocaleString("en-US", { style: "currency", currency: "USD" });

  await notifyTeam(tenantId, (firmName, appUrl) => ({
    subject: `Proposal accepted: ${surveyLabel} at ${data.propertyAddress}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>Hi {{firstName}},</p>
        <p>Great news — a proposal has been accepted!</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Client</td><td style="padding: 4px 0; font-size: 14px;">${data.clientName}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Survey</td><td style="padding: 4px 0; font-size: 14px;">${surveyLabel}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Address</td><td style="padding: 4px 0; font-size: 14px;">${data.propertyAddress}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Value</td><td style="padding: 4px 0; font-size: 14px;">${value}</td></tr>
        </table>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/projects" style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Projects</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${firmName} — powered by SurveyOS</p>
      </div>
    `,
    smsBody: `Proposal accepted! ${data.clientName} — ${surveyLabel} at ${data.propertyAddress} (${value}). — ${firmName}`,
  }));
}

// ─── Payment Received ──────────────────────────────────────────

interface PaymentReceivedData {
  invoiceNumber: string;
  amount: string;
  method: string;
  status: string;
}

export async function notifyTeamPaymentReceived(
  tenantId: string,
  data: PaymentReceivedData
): Promise<void> {
  const amount = parseFloat(data.amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const statusLabel = data.status === "paid" ? "Paid in full" : "Partial payment";

  await notifyTeam(tenantId, (firmName, appUrl) => ({
    subject: `Payment received: ${amount} for invoice #${data.invoiceNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>Hi {{firstName}},</p>
        <p>A payment has been received:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Invoice</td><td style="padding: 4px 0; font-size: 14px;">#${data.invoiceNumber}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Amount</td><td style="padding: 4px 0; font-size: 14px;">${amount}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Method</td><td style="padding: 4px 0; font-size: 14px;">${data.method.replace(/_/g, " ")}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Status</td><td style="padding: 4px 0; font-size: 14px;">${statusLabel}</td></tr>
        </table>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/billing" style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Billing</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${firmName} — powered by SurveyOS</p>
      </div>
    `,
    smsBody: `Payment received: ${amount} for invoice #${data.invoiceNumber} (${statusLabel}). — ${firmName}`,
  }));
}

// ─── Field Visit Completed ─────────────────────────────────────

interface FieldVisitCompletedData {
  propertyAddress: string;
  surveyType: string;
  crewName?: string | null;
}

export async function notifyTeamFieldVisitCompleted(
  tenantId: string,
  data: FieldVisitCompletedData
): Promise<void> {
  const surveyLabel = data.surveyType.replace(/_/g, " ");
  const crewInfo = data.crewName ? ` by ${data.crewName}` : "";

  await notifyTeam(tenantId, (firmName, appUrl) => ({
    subject: `Field visit completed: ${data.propertyAddress}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <p>Hi {{firstName}},</p>
        <p>A field visit has been completed${crewInfo}:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Address</td><td style="padding: 4px 0; font-size: 14px;">${data.propertyAddress}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Survey</td><td style="padding: 4px 0; font-size: 14px;">${surveyLabel}</td></tr>
          ${data.crewName ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 14px;">Crew</td><td style="padding: 4px 0; font-size: 14px;">${data.crewName}</td></tr>` : ""}
        </table>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/schedule" style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Schedule</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">${firmName} — powered by SurveyOS</p>
      </div>
    `,
    smsBody: `Field visit completed${crewInfo}: ${surveyLabel} at ${data.propertyAddress}. — ${firmName}`,
  }));
}
