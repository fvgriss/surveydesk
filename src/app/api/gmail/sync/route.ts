import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { getGmailClient } from "@/lib/gmail/client";
import { db } from "@/db";
import { emailLog, contacts, leads, integrations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseEmail } from "@/lib/utils/parse-email";

/**
 * GET /api/gmail/sync
 *
 * Pulls recent inbound emails from Gmail and processes them for leads.
 * Only processes emails that haven't been seen before (tracked by gmailMessageId).
 *
 * Query params:
 *   ?limit=20 — how many recent messages to check (default 20, max 50)
 */
export async function GET(request: Request) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gmail = await getGmailClient(tenant.tenantId);
    if (!gmail) {
      return NextResponse.json(
        { error: "Gmail not connected. Go to Settings to connect." },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    // --- Fetch recent inbound messages ---
    // Only get messages in INBOX, skip sent/drafts
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit,
      labelIds: ["INBOX"],
      q: "is:inbox -category:promotions -category:social -category:updates",
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ synced: 0, message: "No new emails" });
    }

    // --- Check which messages we've already processed ---
    const existingIds = new Set<string>();
    for (const msg of messages) {
      if (!msg.id) continue;
      const [existing] = await db
        .select({ id: emailLog.id })
        .from(emailLog)
        .where(eq(emailLog.gmailMessageId, msg.id))
        .limit(1);
      if (existing) existingIds.add(msg.id);
    }

    // --- Process new messages ---
    let synced = 0;
    let leadsCreated = 0;
    const results: Array<{
      messageId: string;
      subject: string;
      from: string;
      isLead: boolean;
      leadId: string | null;
    }> = [];

    for (const msg of messages) {
      if (!msg.id || existingIds.has(msg.id)) continue;

      // Fetch full message
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || "";

      const from = getHeader("From");
      const to = getHeader("To");
      const subject = getHeader("Subject");
      const dateStr = getHeader("Date");
      const receivedAt = dateStr ? new Date(dateStr) : new Date();

      // Extract sender name and email
      const fromMatch = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?/);
      const fromName = fromMatch?.[1]?.trim() || "";
      const fromEmail = fromMatch?.[2]?.trim() || from;

      // Extract body text
      const body = extractTextBody(fullMsg.data.payload);

      // Parse the email for lead info
      const parsed = parseEmail(subject, body, fromEmail);

      // --- Match or create contact ---
      let contactId: string | null = null;

      // Try matching by email
      if (fromEmail) {
        const allContacts = await db
          .select({ id: contacts.id, email: contacts.email })
          .from(contacts)
          .where(eq(contacts.tenantId, tenant.tenantId));

        const match = allContacts.find(
          (c) => c.email?.toLowerCase() === fromEmail.toLowerCase()
        );
        if (match) contactId = match.id;
      }

      let linkedLeadId: string | null = null;

      if (parsed.isLeadRequest) {
        // Create contact if needed
        if (!contactId) {
          const [newContact] = await db
            .insert(contacts)
            .values({
              tenantId: tenant.tenantId,
              type: "homeowner",
              firstName: parsed.firstName || fromName.split(" ")[0] || "Unknown",
              lastName:
                parsed.lastName ||
                fromName.split(" ").slice(1).join(" ") ||
                null,
              email: fromEmail || null,
              phone: parsed.phone || null,
            })
            .returning();
          contactId = newContact.id;
        } else if (parsed.phone) {
          // Update contact with phone if we found one
          await db
            .update(contacts)
            .set({ phone: parsed.phone })
            .where(eq(contacts.id, contactId));
        }

        // Build notes
        const noteParts: string[] = [];
        if (parsed.timeline)
          noteParts.push(`Timeline: ${parsed.timeline}`);
        noteParts.push(`Subject: ${subject}`);
        noteParts.push(
          `Email preview: ${body.slice(0, 300)}${body.length > 300 ? "..." : ""}`
        );

        // Create lead
        const validSurveyTypes = [
          "boundary", "alta", "topographic", "as_built",
          "subdivision", "construction", "elevation_cert", "route", "other",
        ];
        const surveyType = validSurveyTypes.includes(parsed.surveyType || "")
          ? parsed.surveyType!
          : "boundary";

        const [newLead] = await db
          .insert(leads)
          .values({
            tenantId: tenant.tenantId,
            contactId,
            propertyAddress:
              parsed.propertyAddress || "Address TBD — from email",
            surveyType: surveyType as any,
            source: "email",
            status: "new",
            urgency: parsed.urgency,
            notes: noteParts.join("\n\n"),
          })
          .returning();

        linkedLeadId = newLead.id;
        leadsCreated++;
        console.log(
          `[Gmail sync] Created lead from email: ${subject} → ${newLead.id}`
        );

        // Notify the tenant owner (non-blocking)
        const { notifyOwnerNewLead } = await import("@/lib/services/notify-owner");
        notifyOwnerNewLead(tenant.tenantId, {
          callerName: fromName || fromEmail,
          propertyAddress: parsed.propertyAddress,
          surveyType,
          urgency: parsed.urgency,
          source: "email",
        }).catch(() => {});
      }

      // --- Log the email ---
      await db.insert(emailLog).values({
        tenantId: tenant.tenantId,
        gmailMessageId: msg.id,
        threadId: fullMsg.data.threadId || null,
        from: fromEmail,
        fromName: fromName || null,
        to,
        subject,
        bodyPreview: body.slice(0, 500),
        contactId,
        leadId: linkedLeadId,
        outcome: parsed.isLeadRequest ? "lead_created" : "ignored",
        receivedAt,
      });

      synced++;
      results.push({
        messageId: msg.id,
        subject,
        from: fromEmail,
        isLead: parsed.isLeadRequest,
        leadId: linkedLeadId,
      });
    }

    // Update last sync timestamp
    await db
      .update(integrations)
      .set({ lastSyncAt: new Date() })
      .where(
        and(
          eq(integrations.tenantId, tenant.tenantId),
          eq(integrations.provider, "gmail")
        )
      );

    return NextResponse.json({
      synced,
      leadsCreated,
      checked: messages.length,
      alreadyProcessed: existingIds.size,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Gmail sync] Error:", msg);
    return NextResponse.json(
      { error: "email sync failed", detail: msg },
      { status: 500 }
    );
  }
}

/**
 * Recursively extracts plain text from a Gmail message payload.
 */
function extractTextBody(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): string {
  if (!payload) return "";

  // Direct body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — recurse
  if (payload.parts) {
    // Prefer text/plain over text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    // Fallback to html (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64").toString("utf-8");
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    // Nested multipart
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return "";
}
