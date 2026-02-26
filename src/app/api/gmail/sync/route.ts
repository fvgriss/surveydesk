import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { getGmailClient } from "@/lib/gmail/client";
import { db } from "@/db";
import { emailLog, contacts, projects, integrations } from "@/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { classifyEmail } from "@/lib/services/classify-email";

/**
 * GET /api/gmail/sync
 *
 * Pulls recent inbound emails from Gmail and stores them in the Inbox.
 * AI classification runs async after storage.
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
    const newEmailIds: string[] = [];

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

      // Try matching sender to existing contact
      let contactId: string | null = null;
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

      // --- Store the email (no auto lead creation) ---
      const [inserted] = await db
        .insert(emailLog)
        .values({
          tenantId: tenant.tenantId,
          gmailMessageId: msg.id,
          threadId: fullMsg.data.threadId || null,
          from: fromEmail,
          fromName: fromName || null,
          to,
          subject,
          bodyPreview: body.slice(0, 500),
          bodyFull: body.slice(0, 10000),
          emailStatus: "new",
          contactId,
          receivedAt,
        })
        .returning({ id: emailLog.id });

      newEmailIds.push(inserted.id);
      synced++;
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

    // --- Trigger AI classification async (non-blocking) ---
    if (newEmailIds.length > 0) {
      classifyNewEmails(tenant.tenantId, newEmailIds).catch((err) =>
        console.error("[Gmail sync] Classification error:", err)
      );
    }

    return NextResponse.json({
      synced,
      checked: messages.length,
      alreadyProcessed: existingIds.size,
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
 * Classify newly synced emails using Claude AI.
 * Runs after the sync response is already sent.
 */
async function classifyNewEmails(tenantId: string, emailIds: string[]) {
  // Fetch active projects for matching
  const activeProjects = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
    })
    .from(projects)
    .where(
      and(
        eq(projects.tenantId, tenantId),
        notInArray(projects.status, ["closed"])
      )
    );

  for (const emailId of emailIds) {
    try {
      const [email] = await db
        .select()
        .from(emailLog)
        .where(eq(emailLog.id, emailId))
        .limit(1);

      if (!email) continue;

      const result = await classifyEmail({
        subject: email.subject || "",
        bodyPreview: email.bodyPreview || "",
        bodyFull: email.bodyFull || "",
        fromEmail: email.from || "",
        fromName: email.fromName || "",
        activeProjects: activeProjects.map((p) => ({
          id: p.id,
          propertyAddress: p.propertyAddress,
          surveyType: p.surveyType,
        })),
      });

      if (result) {
        await db
          .update(emailLog)
          .set({
            aiClassification: result.classification,
            aiSuggestion: result,
          })
          .where(eq(emailLog.id, emailId));

        console.log(
          `[Gmail sync] Classified email "${email.subject}" as ${result.classification} (${Math.round(result.confidence * 100)}%)`
        );
      }
    } catch (err) {
      console.error(`[Gmail sync] Failed to classify email ${emailId}:`, err);
    }
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
