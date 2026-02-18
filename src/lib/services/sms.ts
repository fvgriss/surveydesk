import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (!accountSid || !authToken || !fromPhone) return null;
  return twilio(accountSid, authToken);
}

const TIME_WINDOW_LABELS: Record<string, string> = {
  morning: "morning (8 AM – 12 PM)",
  afternoon: "afternoon (12 PM – 5 PM)",
  full_day: "full day",
  multi_day: "multi-day",
};

type SMSParams = {
  contactPhone: string;
  contactFirstName: string | null;
  surveyType: string;
  propertyAddress: string;
  scheduledDate: string; // YYYY-MM-DD
  timeWindow: string;
  tenantName: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendVisitScheduledSMS(
  params: SMSParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getClient();
  if (!client) {
    console.log("SMS: Twilio not configured, skipping notification");
    return { success: true };
  }

  if (!params.contactPhone) {
    return { success: false, error: "No phone number" };
  }

  // Don't send for sentinel date
  if (params.scheduledDate === "1970-01-01") {
    return { success: true };
  }

  const name = params.contactFirstName || "there";
  const dateLabel = formatDate(params.scheduledDate);
  const timeLabel = TIME_WINDOW_LABELS[params.timeWindow] || params.timeWindow;
  const surveyLabel = params.surveyType.replace(/_/g, " ");

  const body = `Hi ${name}, this is ${params.tenantName}. Your ${surveyLabel} survey at ${params.propertyAddress} has been scheduled for ${dateLabel} (${timeLabel}). Please ensure the property is accessible. Reply STOP to opt out.`;

  try {
    const message = await client.messages.create({
      body,
      to: cleanPhone(params.contactPhone),
      from: fromPhone!,
    });
    return { success: true, messageId: message.sid };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendVisitRescheduledSMS(
  params: SMSParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getClient();
  if (!client) {
    console.log("SMS: Twilio not configured, skipping notification");
    return { success: true };
  }

  if (!params.contactPhone) {
    return { success: false, error: "No phone number" };
  }

  if (params.scheduledDate === "1970-01-01") {
    return { success: true };
  }

  const name = params.contactFirstName || "there";
  const dateLabel = formatDate(params.scheduledDate);
  const timeLabel = TIME_WINDOW_LABELS[params.timeWindow] || params.timeWindow;
  const surveyLabel = params.surveyType.replace(/_/g, " ");

  const body = `Hi ${name}, this is ${params.tenantName}. Your ${surveyLabel} survey at ${params.propertyAddress} has been rescheduled to ${dateLabel} (${timeLabel}). Please ensure the property is accessible. Reply STOP to opt out.`;

  try {
    const message = await client.messages.create({
      body,
      to: cleanPhone(params.contactPhone),
      from: fromPhone!,
    });
    return { success: true, messageId: message.sid };
  } catch (err) {
    console.error("SMS send failed:", err);
    return { success: false, error: String(err) };
  }
}
