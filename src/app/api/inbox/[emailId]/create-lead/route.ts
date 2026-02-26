import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { emailLog, contacts, leads } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/inbox/[emailId]/create-lead
 *
 * Creates a lead from an inbox email. Uses AI-extracted data as defaults,
 * with optional overrides from the request body.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["owner", "office_manager"].includes(tenant.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { emailId } = await params;
    const body = await request.json().catch(() => ({}));

    // Fetch the email and verify ownership
    const [email] = await db
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.id, emailId), eq(emailLog.tenantId, tenant.tenantId)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (email.emailStatus === "lead_created" && email.leadId) {
      return NextResponse.json({ error: "Lead already created for this email", leadId: email.leadId }, { status: 400 });
    }

    // Use body overrides, then AI suggestion, then defaults
    const ai = (email.aiSuggestion as Record<string, unknown>) || {};
    const propertyAddress = body.propertyAddress || ai.extractedAddress || "Address TBD — from email";
    const surveyType = body.surveyType || ai.extractedSurveyType || "boundary";
    const urgency = body.urgency || ai.extractedUrgency || "low";
    const contactName = body.contactName || ai.extractedContactName || email.fromName || "";
    const contactEmail = body.contactEmail || email.from || "";
    const contactPhone = body.contactPhone || ai.extractedContactPhone || null;

    // Find or create contact
    let contactId = email.contactId;

    if (!contactId && contactEmail) {
      const allContacts = await db
        .select({ id: contacts.id, email: contacts.email })
        .from(contacts)
        .where(eq(contacts.tenantId, tenant.tenantId));

      const match = allContacts.find(
        (c) => c.email?.toLowerCase() === contactEmail.toLowerCase()
      );

      if (match) {
        contactId = match.id;
      } else {
        const nameParts = contactName.split(" ");
        const [newContact] = await db
          .insert(contacts)
          .values({
            tenantId: tenant.tenantId,
            type: "homeowner",
            firstName: nameParts[0] || "Unknown",
            lastName: nameParts.slice(1).join(" ") || null,
            email: contactEmail,
            phone: contactPhone,
          })
          .returning();
        contactId = newContact.id;
      }
    }

    // Create lead
    const validSurveyTypes = [
      "boundary", "alta", "topographic", "as_built",
      "subdivision", "construction", "elevation_cert", "route", "other",
    ];
    const safeSurveyType = validSurveyTypes.includes(surveyType) ? surveyType : "boundary";

    const noteParts: string[] = [];
    if (email.subject) noteParts.push(`Subject: ${email.subject}`);
    if (email.bodyPreview) {
      noteParts.push(`Email preview: ${email.bodyPreview.slice(0, 300)}${(email.bodyPreview?.length || 0) > 300 ? "..." : ""}`);
    }

    const [newLead] = await db
      .insert(leads)
      .values({
        tenantId: tenant.tenantId,
        contactId,
        propertyAddress,
        surveyType: safeSurveyType as any,
        source: "email",
        status: "new",
        urgency: urgency as any,
        notes: noteParts.join("\n\n"),
      })
      .returning();

    // Update email status
    await db
      .update(emailLog)
      .set({
        emailStatus: "lead_created",
        leadId: newLead.id,
        contactId,
        outcome: "lead_created",
      })
      .where(eq(emailLog.id, emailId));

    // Notify owner (non-blocking)
    import("@/lib/services/notify-owner").then(({ notifyOwnerNewLead }) => {
      notifyOwnerNewLead(tenant.tenantId, {
        callerName: contactName || contactEmail,
        propertyAddress,
        surveyType: safeSurveyType,
        urgency,
        source: "email",
      }).catch(() => {});
    });

    return NextResponse.json({ success: true, leadId: newLead.id, contactId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[inbox/create-lead] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
