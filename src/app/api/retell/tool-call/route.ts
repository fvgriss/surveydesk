import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, contacts, leads, fieldVisits, crews, prospects } from "@/db/schema";
import { eq, and, ilike, desc, gte } from "drizzle-orm";
import { sanitizePropertyAddress } from "@/lib/utils/parse-call-summary";

/**
 * POST /api/retell/tool-call?fn=create_lead
 *
 * Handles real-time function calls FROM the Retell voice agent
 * during an active call. Each Retell Custom Function node sends
 * its args to this endpoint. We use the ?fn= query param to
 * route to the right handler.
 *
 * Conversation Flow format: { args: {...}, call: {...} }
 * Single Prompt format:     { name: "...", arguments: {...} }
 * Both are supported.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json();

    // Support both Conversation Flow (?fn= + body.args)
    // and Single Prompt (body.name + body.arguments) formats
    const fnName = searchParams.get("fn") || body.name;
    const args = body.args || body.arguments || {};

    // Resolve tenant by agent ID (from call data), fallback to DEFAULT_TENANT_ID
    const { resolveTenantId } = await import("@/lib/retell/resolve-tenant");
    const agentId = body.call?.agent_id || body.agent_id;
    const tenantId = await resolveTenantId(agentId);
    if (!tenantId) {
      return NextResponse.json({ result: "System unavailable" });
    }

    console.log(`[Retell tool-call] fn=${fnName}`, JSON.stringify(args));

    let result: string;

    switch (fnName) {
      case "create_lead":
        result = await createLead(tenantId, args, body.call);
        break;
      case "lookup_project":
        result = await lookupProject(tenantId, args);
        break;
      case "check_schedule":
        result = await checkSchedule(tenantId, args);
        break;
      case "qualify_prospect":
        result = await qualifyProspect(args, body.call);
        break;
      default:
        result = "I'm not able to help with that right now. Let me transfer you to our office.";
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Tool call error:", error);
    return NextResponse.json({
      result:
        "I'm having a little trouble looking that up. Let me have someone from the office call you back.",
    });
  }
}

/**
 * Create a lead (and contact if needed) in the DB during the live call.
 * This way the lead shows up in the intake page immediately.
 */
async function createLead(
  tenantId: string,
  args: {
    caller_name?: string;
    caller_phone?: string;
    caller_email?: string;
    company_name?: string;
    property_address?: string;
    survey_type?: string;
    urgency?: string;
    timeline?: string;
    property_owner?: string;
    referral_type?: string;
    reason?: string;
    lot_size?: string;
    notes?: string;
    special_requests?: string;
  },
  callData?: { call_id?: string; from_number?: string }
): Promise<string> {
  try {
    // Prefer the actual caller ID (from_number) so we always capture it,
    // even if the caller doesn't verbally provide a phone number.
    const callerPhone = callData?.from_number || args.caller_phone || null;

    // Try to find existing contact by phone (normalized last-10-digit match)
    let contactId: string | null = null;
    if (callerPhone) {
      const digits = callerPhone.replace(/\D/g, "");
      const last10 = digits.slice(-10);

      if (last10.length === 10) {
        const allContacts = await db
          .select({ id: contacts.id, phone: contacts.phone })
          .from(contacts)
          .where(eq(contacts.tenantId, tenantId));

        const match = allContacts.find((c) => {
          if (!c.phone) return false;
          return c.phone.replace(/\D/g, "").slice(-10) === last10;
        });
        if (match) contactId = match.id;
      }
    }

    // Map referral_type to contact type
    const contactTypeMap: Record<string, string> = {
      homeowner: "homeowner",
      title_company: "title_company",
      realtor: "realtor",
      attorney: "attorney",
      contractor: "contractor",
      lender: "lender",
    };
    const contactType = contactTypeMap[args.referral_type || ""] || "homeowner";

    // Create a new contact if we don't have a match
    if (!contactId && (args.caller_name || callerPhone)) {
      const nameParts = (args.caller_name || "Unknown Caller").split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || null;

      const [newContact] = await db
        .insert(contacts)
        .values({
          tenantId,
          type: contactType as any,
          firstName,
          lastName,
          companyName: args.company_name || null,
          phone: callerPhone,
          email: args.caller_email || null,
        })
        .returning();

      contactId = newContact.id;
      console.log(`[create_lead] Created contact: ${firstName} ${lastName || ""}`);
    }

    // Validate survey type against enum
    const validSurveyTypes = [
      "boundary", "alta", "topographic", "as_built",
      "subdivision", "construction", "elevation_cert", "route", "other",
    ];
    const surveyType = validSurveyTypes.includes(args.survey_type || "")
      ? args.survey_type!
      : "boundary";

    // Validate urgency
    const validUrgency = ["low", "medium", "high"];
    const urgency = validUrgency.includes(args.urgency || "")
      ? args.urgency!
      : "medium";

    // Build structured notes with all the extra details
    const noteParts: string[] = [];
    if (args.timeline) noteParts.push(`TIMELINE: ${args.timeline}`);
    if (args.reason) noteParts.push(`REASON: ${args.reason}`);
    if (args.property_owner) noteParts.push(`PROPERTY OWNER: ${args.property_owner}`);
    if (args.referral_type) noteParts.push(`CALLER TYPE: ${args.referral_type.replace("_", " ")}`);
    if (args.lot_size) noteParts.push(`LOT SIZE: ${args.lot_size}`);
    if (args.notes) noteParts.push(`NOTES: ${args.notes}`);

    const structuredNotes = noteParts.length > 0 ? noteParts.join("\n") : null;

    // Deduplicate: if the agent already saved a lead for this call, update it
    const callId = callData?.call_id || null;
    let existingLead: { id: string } | null = null;

    // Strategy 1: Match by Retell call_id stored in callLogId
    if (callId) {
      const [found] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.callLogId, callId), eq(leads.tenantId, tenantId)))
        .limit(1);
      existingLead = found || null;
    }

    // Strategy 2: Match by contact + source + recency (handles missing call_id
    // or callLogId overwritten by webhook)
    if (!existingLead) {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
      const phoneConditions = [
        eq(leads.tenantId, tenantId),
        eq(leads.source, "phone_intake"),
        gte(leads.createdAt, twoMinAgo),
      ];

      if (contactId) {
        phoneConditions.push(eq(leads.contactId, contactId));
      } else if (callerPhone) {
        phoneConditions.push(eq(leads.callerPhone, callerPhone));
      }

      if (contactId || callerPhone) {
        const [found] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(and(...phoneConditions))
          .orderBy(desc(leads.createdAt))
          .limit(1);
        existingLead = found || null;
      }
    }

    const cleanAddress = args.property_address
      ? sanitizePropertyAddress(args.property_address)
      : "Address TBD";

    let leadId: string;

    if (existingLead) {
      // Update the existing lead with corrected info
      const [updated] = await db
        .update(leads)
        .set({
          contactId,
          propertyAddress: cleanAddress,
          surveyType: surveyType as any,
          urgency: urgency as any,
          callerEmail: args.caller_email || null,
          callerPhone: callerPhone || null,
          specialRequests: args.special_requests || null,
          notes: structuredNotes,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existingLead.id))
        .returning();
      leadId = updated.id;
      console.log(`[create_lead] Updated existing lead: ${leadId} at ${cleanAddress}`);
    } else {
      // Create a new lead
      const [newLead] = await db
        .insert(leads)
        .values({
          tenantId,
          contactId,
          propertyAddress: cleanAddress,
          surveyType: surveyType as any,
          source: "phone_intake",
          status: "new",
          urgency: urgency as any,
          callerEmail: args.caller_email || null,
          callerPhone: callerPhone || null,
          specialRequests: args.special_requests || null,
          notes: structuredNotes,
          callLogId: callId,
        })
        .returning();
      leadId = newLead.id;
      console.log(`[create_lead] Created lead: ${leadId} at ${args.property_address}`);

      // Notify the tenant owner (non-blocking)
      const { notifyOwnerNewLead } = await import("@/lib/services/notify-owner");
      notifyOwnerNewLead(tenantId, {
        callerName: args.caller_name,
        propertyAddress: cleanAddress,
        surveyType,
        urgency,
        source: "phone_intake",
      }).catch(() => {});
    }

    return `Got it. I've created a lead for a ${surveyType.replace("_", " ")} survey at ${cleanAddress}. Someone from our office will prepare a quote and get back to you within a few hours.`;
  } catch (error) {
    console.error("[create_lead] Error creating lead:", error);
    return `Got it. I'll have someone from our office prepare a quote for that ${args.survey_type || "survey"} and get back to you shortly.`;
  }
}

/**
 * Look up a project by address or client name and return a
 * plain-English status the agent can read to the caller.
 */
async function lookupProject(
  tenantId: string,
  args: { address?: string; client_name?: string }
): Promise<string> {
  const conditions = [eq(projects.tenantId, tenantId)];

  if (args.address) {
    conditions.push(ilike(projects.propertyAddress, `%${args.address}%`));
  }

  const results = await db
    .select({
      address: projects.propertyAddress,
      status: projects.status,
      surveyType: projects.surveyType,
    })
    .from(projects)
    .where(and(...conditions))
    .limit(1);

  if (results.length === 0) {
    return "I wasn't able to find a project matching that address in our system. Let me have someone from the office look into it and call you back.";
  }

  const p = results[0];
  const statusDescriptions: Record<string, string> = {
    pending: "is scheduled and we'll be starting work soon",
    in_progress: "is currently in progress. Our crew is working on the field survey",
    field_complete:
      "has completed the field work and our office is now working on the plat and calculations",
    drafting: "is in the drafting phase. We're preparing the survey plat",
    review: "is under review by our licensed surveyor",
    delivered:
      "has been completed and the deliverables have been sent to you",
    closed: "is complete and closed",
    on_hold: "is currently on hold. Someone from our office can give you more details",
  };

  const desc =
    statusDescriptions[p.status] || "is in our system and being worked on";

  return `I found your ${p.surveyType.replace("_", " ")} survey at ${p.address}. That project ${desc}.`;
}

/**
 * Check crew availability for a date range.
 */
async function checkSchedule(
  tenantId: string,
  args: { date?: string; date_start?: string; date_end?: string }
): Promise<string> {
  const targetDate = args.date || args.date_start;
  if (!targetDate) {
    return "Our earliest availability is usually within a week or two. Someone from the office will follow up with exact dates when they prepare your quote.";
  }

  // Count how many visits each crew has on that date
  const crewList = await db
    .select({ id: crews.id, name: crews.name })
    .from(crews)
    .where(eq(crews.tenantId, tenantId));

  const visitCounts = await Promise.all(
    crewList.map(async (crew) => {
      const visits = await db
        .select({ id: fieldVisits.id })
        .from(fieldVisits)
        .where(
          and(
            eq(fieldVisits.crewId, crew.id),
            eq(fieldVisits.scheduledDate, targetDate)
          )
        );
      return { crew: crew.name, count: visits.length };
    })
  );

  const availableCrews = visitCounts.filter((c) => c.count === 0);

  if (availableCrews.length > 0) {
    return `It looks like we have availability on that date. I'll have the office confirm the exact time when they send over the quote.`;
  } else {
    return `That date looks pretty full for our crews, but let me have the office check and see if we can fit it in. They'll reach out with available times.`;
  }
}

/**
 * Qualify a SurveyDesk sales prospect during a live call.
 * Creates a contact + lead in the DB so the prospect shows up
 * in SurveyDesk's own intake dashboard.
 */
async function qualifyProspect(
  args: {
    firm_name?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    firm_size?: string;
    current_tools?: string;
    pain_points?: string;
    interest_level?: string;
  },
  callData?: { call_id?: string; from_number?: string }
): Promise<string> {
  try {
    const callerPhone = args.contact_phone || callData?.from_number || null;
    const firmName = args.firm_name || "Unknown Firm";
    const contactName = args.contact_name || "Unknown";

    // Deduplicate: if the agent already saved a prospect for this call, update it
    const callId = callData?.call_id || null;
    let prospect;
    let isNew = false;

    if (callId) {
      const [existing] = await db
        .select()
        .from(prospects)
        .where(eq(prospects.callId, callId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(prospects)
          .set({
            firmName,
            contactName,
            email: args.contact_email || null,
            phone: callerPhone,
            firmSize: args.firm_size || null,
            currentTools: args.current_tools || null,
            painPoints: args.pain_points || null,
            interestLevel: args.interest_level || null,
            updatedAt: new Date(),
          })
          .where(eq(prospects.id, existing.id))
          .returning();
        prospect = updated;
        console.log(`[qualify_prospect] Updated prospect: ${prospect.id} — ${firmName}`);
      }
    }

    if (!prospect) {
      const [created] = await db
        .insert(prospects)
        .values({
          firmName,
          contactName,
          email: args.contact_email || null,
          phone: callerPhone,
          firmSize: args.firm_size || null,
          currentTools: args.current_tools || null,
          painPoints: args.pain_points || null,
          interestLevel: args.interest_level || null,
          status: "new",
          callId,
        })
        .returning();
      prospect = created;
      isNew = true;
      console.log(`[qualify_prospect] Created prospect: ${prospect.id} — ${firmName} (${args.interest_level || "unknown"})`);
    }

    // Send follow-up email + SMS only for new prospects (not updates)
    if (isNew && (args.contact_email || callerPhone)) {
      const { sendProspectFollowUp } = await import(
        "@/lib/services/prospect-follow-up"
      );
      sendProspectFollowUp(prospect).catch((err) =>
        console.error("[qualify_prospect] Follow-up error:", err)
      );
    }

    return `I've saved ${contactName}'s information for ${firmName}. Someone from our team will follow up shortly.`;
  } catch (error) {
    console.error("[qualify_prospect] Error:", error);
    return `I've made a note of your information. Someone from our team will reach out to you shortly.`;
  }
}
