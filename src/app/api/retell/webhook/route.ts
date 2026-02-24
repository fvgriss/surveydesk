import { NextRequest, NextResponse } from "next/server";
import { Retell } from "retell-sdk";
import { db } from "@/db";
import { callLog, leads, contacts, tenants } from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { parseCallSummary } from "@/lib/utils/parse-call-summary";

/**
 * Normalize phone to digits-only for comparison.
 * "+1 (555) 867-5309" → "15558675309"
 * "555-867-5309"       → "5558675309"
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * GET /api/retell/webhook — health-check so you can verify the URL
 * is reachable by visiting it in a browser.
 */
export async function GET() {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  let tenantExists = false;

  if (tenantId) {
    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    tenantExists = !!row;
  }

  return NextResponse.json({
    status: "ok",
    route: "/api/retell/webhook",
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.RETELL_API_KEY,
    hasTenantId: !!tenantId,
    tenantExists,
    tenantIdValue: tenantId || null,
  });
}

/**
 * POST /api/retell/webhook
 *
 * Receives call events from Retell AI after a call ends.
 * Creates call log entries and links them to leads/contacts.
 *
 * If the tool-call route didn't fire during the call (i.e. no lead
 * was created live), this webhook creates a fallback lead from the
 * call summary/transcript so nothing falls through the cracks.
 */
export async function POST(request: NextRequest) {
  try {
    // --- Verify webhook signature ---
    const bodyText = await request.text();
    const apiKey = process.env.RETELL_API_KEY;

    if (!apiKey) {
      console.error("RETELL_API_KEY not set");
      return NextResponse.json({ error: "not configured" }, { status: 500 });
    }

    const valid = Retell.verify(
      bodyText,
      apiKey,
      request.headers.get("x-retell-signature") || ""
    );

    if (!valid) {
      console.error("Retell webhook: invalid signature");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const { event, call } = body;

    console.log(`[Retell webhook] event=${event}, call_id=${call?.call_id}, call_type=${call?.call_type}, direction=${call?.direction}`);

    // We only care about call_ended or call_analyzed events
    if (event !== "call_ended" && event !== "call_analyzed") {
      return NextResponse.json({ received: true });
    }

    // --- Determine tenant (by agent ID → tenant mapping, fallback to DEFAULT_TENANT_ID) ---
    const { resolveTenantId } = await import("@/lib/retell/resolve-tenant");
    const tenantId = await resolveTenantId(call?.agent_id);
    if (!tenantId) {
      console.error("Could not determine tenant for agent:", call?.agent_id);
      return NextResponse.json({ error: "no tenant" }, { status: 500 });
    }

    // --- Extract call data ---
    const callerPhone = call.from_number || call.metadata?.caller_phone || null;

    // Retell sends call_type as "phone_call", "web_call", etc.
    // and direction as "inbound" or "outbound". Check both fields.
    const rawDirection = call.direction || call.call_type || "";
    const direction: "inbound" | "outbound" | "missed" =
      rawDirection === "inbound" || rawDirection === "phone_call"
        ? "inbound"
        : rawDirection === "outbound"
          ? "outbound"
          : durationMs(call) === 0
            ? "missed"
            : "inbound"; // default to inbound for Retell calls

    const durationSeconds = Math.round(durationMs(call) / 1000);
    const summary = call.call_analysis?.call_summary || null;
    const transcript = call.transcript || call.call_analysis?.transcript || null;

    // --- Try to match an existing contact by phone (normalized) ---
    let matchedContactId: string | null = null;
    if (callerPhone) {
      const digits = normalizePhone(callerPhone);
      // Match on last 10 digits to handle +1 prefix differences
      const last10 = digits.slice(-10);

      if (last10.length === 10) {
        const allContacts = await db
          .select({ id: contacts.id, phone: contacts.phone })
          .from(contacts)
          .where(eq(contacts.tenantId, tenantId));

        const match = allContacts.find((c) => {
          if (!c.phone) return false;
          return normalizePhone(c.phone).slice(-10) === last10;
        });

        if (match) {
          matchedContactId = match.id;
        }
      }
    }

    // --- Check if a lead was already created during this call (via tool-call route) ---
    let linkedLeadId: string | null = null;
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (matchedContactId) {
      const [recentLead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.contactId, matchedContactId),
            eq(leads.source, "phone_intake"),
            gte(leads.createdAt, fiveMinAgo),
          )
        )
        .orderBy(desc(leads.createdAt))
        .limit(1);

      if (recentLead) {
        linkedLeadId = recentLead.id;
      }
    }

    // Also try matching by retell call_id in case the tool-call created a lead
    // but contact phone didn't match
    if (!linkedLeadId) {
      const [recentLead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, tenantId),
            eq(leads.source, "phone_intake"),
            gte(leads.createdAt, fiveMinAgo),
          )
        )
        .orderBy(desc(leads.createdAt))
        .limit(1);

      if (recentLead) {
        linkedLeadId = recentLead.id;
      }
    }

    // --- Fallback: create lead from transcript if tool-call didn't fire ---
    if (!linkedLeadId && direction === "inbound" && durationSeconds > 15) {
      // The call lasted long enough to be a real conversation but no lead was created.
      // Parse the AI summary for structured data.
      const parsed = parseCallSummary(summary, transcript);

      const validSurveyTypes = [
        "boundary", "alta", "topographic", "as_built",
        "subdivision", "construction", "elevation_cert", "route", "other",
      ];
      const surveyType = validSurveyTypes.includes(parsed.surveyType || "")
        ? parsed.surveyType!
        : "boundary";

      let contactId = matchedContactId;

      // Create contact if we don't have one
      if (!contactId && (callerPhone || parsed.callerName)) {
        const [newContact] = await db
          .insert(contacts)
          .values({
            tenantId,
            type: "homeowner",
            firstName: parsed.firstName || "Unknown",
            lastName: parsed.lastName || "Caller",
            phone: callerPhone,
            email: parsed.email || null,
          })
          .returning();
        contactId = newContact.id;
        matchedContactId = newContact.id;
        console.log(`[Retell webhook] Created contact: ${parsed.callerName || callerPhone}`);
      }

      // If we matched an existing contact but have a better name, update it
      if (contactId && parsed.callerName) {
        await db
          .update(contacts)
          .set({
            firstName: parsed.firstName || undefined,
            lastName: parsed.lastName || undefined,
            email: parsed.email || undefined,
          })
          .where(eq(contacts.id, contactId));
      }

      // Build notes with timeline and summary
      const noteParts: string[] = [];
      if (parsed.timeline) noteParts.push(`Timeline: ${parsed.timeline}`);
      if (summary) noteParts.push(`AI Summary: ${summary}`);
      if (noteParts.length === 0) noteParts.push("Auto-created from phone call — review transcript.");

      const [newLead] = await db
        .insert(leads)
        .values({
          tenantId,
          contactId,
          propertyAddress: parsed.propertyAddress || "Address TBD — from phone intake",
          surveyType: surveyType as any,
          source: "phone_intake",
          status: "new",
          urgency: parsed.urgency as any,
          callerEmail: parsed.email || null,
          callerPhone: callerPhone || parsed.phone || null,
          specialRequests: parsed.specialRequests || null,
          notes: noteParts.join("\n\n"),
        })
        .returning();

      linkedLeadId = newLead.id;
      console.log(`[Retell webhook] Created fallback lead: ${newLead.id}`);

      // Notify the tenant owner (non-blocking)
      const { notifyOwnerNewLead } = await import("@/lib/services/notify-owner");
      notifyOwnerNewLead(tenantId, {
        callerName: parsed.callerName,
        propertyAddress: parsed.propertyAddress,
        surveyType,
        urgency: parsed.urgency,
        source: "phone_intake",
      }).catch(() => {});
    }

    // --- Determine outcome ---
    const outcome = linkedLeadId
      ? "lead_created"
      : summary?.toLowerCase().includes("status")
        ? "status_update"
        : "general";

    // --- Insert call log entry ---
    const [newCall] = await db
      .insert(callLog)
      .values({
        tenantId,
        retellCallId: call.call_id,
        retellAgentId: call.agent_id,
        direction,
        callerPhone,
        duration: durationSeconds,
        summary,
        transcript,
        contactId: matchedContactId,
        leadId: linkedLeadId,
        outcome,
        recordingUrl: call.recording_url || null,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
        endedAt: call.end_timestamp ? new Date(call.end_timestamp) : null,
      })
      .returning();

    console.log(`[Retell webhook] Created call log: ${newCall.id}, outcome: ${outcome}, lead: ${linkedLeadId || "none"}`);

    // If we found a lead, update it with the call log reference
    if (linkedLeadId) {
      await db
        .update(leads)
        .set({ callLogId: newCall.id })
        .where(eq(leads.id, linkedLeadId));
    }

    return NextResponse.json({ received: true, callLogId: newCall.id });
  } catch (error) {
    console.error("Retell webhook error:", error);
    return NextResponse.json(
      { error: "webhook processing failed" },
      { status: 500 }
    );
  }
}

/** Extract duration in ms from various Retell payload shapes */
function durationMs(call: Record<string, unknown>): number {
  if (typeof call.duration_ms === "number") return call.duration_ms;
  if (typeof call.duration === "number") return call.duration * 1000;
  if (call.start_timestamp && call.end_timestamp) {
    return new Date(call.end_timestamp as string).getTime() - new Date(call.start_timestamp as string).getTime();
  }
  return 0;
}
