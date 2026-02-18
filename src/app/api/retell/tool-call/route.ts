import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, contacts, leads, fieldVisits, crews } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";

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

    const tenantId = process.env.DEFAULT_TENANT_ID;
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
    notes?: string;
    special_requests?: string;
  },
  callData?: { call_id?: string; from_number?: string }
): Promise<string> {
  try {
    const callerPhone = args.caller_phone || callData?.from_number || null;

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

    // Create a new contact if we don't have a match
    if (!contactId && (args.caller_name || callerPhone)) {
      const nameParts = (args.caller_name || "Unknown Caller").split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || null;

      const [newContact] = await db
        .insert(contacts)
        .values({
          tenantId,
          type: "homeowner",
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

    // Create the lead
    const [newLead] = await db
      .insert(leads)
      .values({
        tenantId,
        contactId,
        propertyAddress: args.property_address || "Address TBD",
        surveyType: surveyType as any,
        source: "phone_intake",
        status: "new",
        urgency: urgency as any,
        callerEmail: args.caller_email || null,
        callerPhone: callerPhone || null,
        specialRequests: args.special_requests || args.notes || null,
        notes: args.notes || null,
      })
      .returning();

    console.log(`[create_lead] Created lead: ${newLead.id} at ${args.property_address}`);

    return `Got it. I've created a lead for a ${surveyType.replace("_", " ")} survey at ${args.property_address || "that property"}. Someone from our office will prepare a quote and get back to you within a few hours.`;
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
