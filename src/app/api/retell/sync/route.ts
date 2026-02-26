import { NextResponse } from "next/server";
import Retell from "retell-sdk";
import { db } from "@/db";
import { callLog, leads, contacts } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { parseCallSummary } from "@/lib/utils/parse-call-summary";

/**
 * Normalize phone to digits-only for comparison.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * GET /api/retell/sync
 *
 * Pulls recent calls from Retell's API and imports any that aren't
 * already in our call_log table. Works as both a manual sync trigger
 * and a fallback when webhooks aren't firing.
 *
 * Query params:
 *   ?limit=10  — how many recent Retell calls to check (default 10, max 50)
 */
export async function GET(request: Request) {
  try {
    const apiKey = process.env.RETELL_API_KEY;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!apiKey || !tenantId) {
      return NextResponse.json(
        { error: "RETELL_API_KEY or DEFAULT_TENANT_ID not set" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    // --- Fetch recent calls from Retell ---
    let retellCalls;
    try {
      const retell = new Retell({ apiKey });
      retellCalls = await retell.call.list({
        limit,
        sort_order: "descending",
      });
    } catch (retellError: unknown) {
      const msg = retellError instanceof Error ? retellError.message : String(retellError);
      console.error("[Retell sync] Retell API error:", msg);
      return NextResponse.json(
        { error: "Retell API call failed", detail: msg },
        { status: 502 }
      );
    }

    if (!retellCalls || retellCalls.length === 0) {
      return NextResponse.json({ synced: 0, message: "No calls found in Retell" });
    }

    console.log(`[Retell sync] Found ${retellCalls.length} calls in Retell`);

    // --- Check which ones we already have ---
    const existingCallIds = new Set<string>();
    for (const rc of retellCalls) {
      const callId = rc.call_id;
      const [existing] = await db
        .select({ id: callLog.id })
        .from(callLog)
        .where(eq(callLog.retellCallId, callId))
        .limit(1);

      if (existing) {
        existingCallIds.add(callId);
      }
    }

    // --- Import missing calls ---
    let synced = 0;
    const results: Array<{ callId: string; outcome: string; leadId: string | null }> = [];

    for (const call of retellCalls) {
      if (existingCallIds.has(call.call_id)) continue;

      // Only process completed calls (not in-progress)
      if (call.call_status !== "ended" && call.call_status !== "error") continue;

      // Cast to generic record for flexible field access across call types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = call as any;

      // Determine direction (only exists on phone calls)
      const rawDir = (c.direction as string) || "";
      const direction: "inbound" | "outbound" | "missed" =
        rawDir === "inbound"
          ? "inbound"
          : rawDir === "outbound"
            ? "outbound"
            : "inbound"; // default

      const callerPhone =
        call.call_type === "phone_call"
          ? (c.from_number as string) || null
          : null;

      const durationSeconds = call.duration_ms
        ? Math.round(call.duration_ms / 1000)
        : 0;

      const summary = call.call_analysis?.call_summary || null;
      const transcript = call.transcript || null;

      // --- Match contact by phone ---
      let matchedContactId: string | null = null;
      if (callerPhone) {
        const digits = normalizePhone(callerPhone);
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

          if (match) matchedContactId = match.id;
        }
      }

      // --- Check for existing lead ---
      let linkedLeadId: string | null = null;
      const fiveMinWindow = call.start_timestamp
        ? new Date(call.start_timestamp - 5 * 60 * 1000)
        : new Date(Date.now() - 60 * 60 * 1000);

      // Strategy 1: Direct match by Retell call_id stored in callLogId
      if (call.call_id) {
        const [found] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(and(eq(leads.callLogId, call.call_id), eq(leads.tenantId, tenantId)))
          .limit(1);
        if (found) linkedLeadId = found.id;
      }

      // Strategy 2: Match by contact + source + recency
      if (!linkedLeadId && matchedContactId) {
        const [recentLead] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.tenantId, tenantId),
              eq(leads.contactId, matchedContactId),
              eq(leads.source, "phone_intake"),
              gte(leads.createdAt, fiveMinWindow)
            )
          )
          .orderBy(desc(leads.createdAt))
          .limit(1);

        if (recentLead) linkedLeadId = recentLead.id;
      }

      // Strategy 3: Match by callerPhone + source + recency
      if (!linkedLeadId && callerPhone) {
        const [recentLead] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.tenantId, tenantId),
              eq(leads.callerPhone, callerPhone),
              eq(leads.source, "phone_intake"),
              gte(leads.createdAt, fiveMinWindow)
            )
          )
          .orderBy(desc(leads.createdAt))
          .limit(1);

        if (recentLead) linkedLeadId = recentLead.id;
      }

      // --- Fallback lead creation for inbound calls with no lead ---
      if (!linkedLeadId && direction === "inbound" && durationSeconds > 15) {
        // Parse the AI summary for structured data
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
          console.log(`[Retell sync] Created contact: ${parsed.callerName || callerPhone}`);
        }

        // If we matched an existing contact but have a better name from the call, update it
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
        if (noteParts.length === 0) noteParts.push("Auto-created via sync — review transcript.");

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
        console.log(`[Retell sync] Created lead: ${newLead.id} — ${parsed.callerName || "unknown"} at ${parsed.propertyAddress || "TBD"}`);
      }

      // --- Determine outcome ---
      const outcome = linkedLeadId
        ? "lead_created"
        : summary?.toLowerCase().includes("status")
          ? "status_update"
          : "general";

      // --- Insert call log ---
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

      // Link lead to call log
      if (linkedLeadId) {
        await db
          .update(leads)
          .set({ callLogId: newCall.id })
          .where(eq(leads.id, linkedLeadId));
      }

      synced++;
      results.push({
        callId: call.call_id,
        outcome,
        leadId: linkedLeadId,
      });

      console.log(`[Retell sync] Imported call ${call.call_id} → ${outcome}`);
    }

    return NextResponse.json({
      synced,
      checked: retellCalls.length,
      alreadyImported: existingCallIds.size,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Retell sync] Error:", msg, stack);
    return NextResponse.json(
      { error: "sync failed", detail: msg },
      { status: 500 }
    );
  }
}
