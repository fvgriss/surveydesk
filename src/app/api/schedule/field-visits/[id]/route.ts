import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldVisits, crews, projects, contacts, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { sendVisitRescheduledSMS } from "@/lib/services/sms";
import { notifyTeamFieldVisitCompleted } from "@/lib/services/notify-owner";

// PATCH /api/schedule/field-visits/[id] — reschedule or reassign a visit
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { scheduledDate, crewId, status, fieldNotes, utilityLocateStatus } = body as {
      scheduledDate?: string;
      crewId?: string;
      status?: string;
      fieldNotes?: string;
      utilityLocateStatus?: string;
    };

    if (!scheduledDate && !crewId && !status && fieldNotes === undefined && utilityLocateStatus === undefined) {
      return NextResponse.json(
        { error: "Must provide scheduledDate, crewId, status, fieldNotes, or utilityLocateStatus" },
        { status: 400 }
      );
    }

    // Verify the visit belongs to this tenant
    const [existing] = await db
      .select({ id: fieldVisits.id, tenantId: fieldVisits.tenantId })
      .from(fieldVisits)
      .where(
        and(eq(fieldVisits.id, id), eq(fieldVisits.tenantId, tenant.tenantId))
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // If reassigning crew, verify crew belongs to tenant
    if (crewId) {
      const [crew] = await db
        .select({ id: crews.id })
        .from(crews)
        .where(and(eq(crews.id, crewId), eq(crews.tenantId, tenant.tenantId)))
        .limit(1);

      if (!crew) {
        return NextResponse.json({ error: "Crew not found" }, { status: 400 });
      }
    }

    // Build update fields
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (scheduledDate) updateFields.scheduledDate = scheduledDate;
    if (crewId) updateFields.crewId = crewId;
    if (fieldNotes !== undefined) updateFields.fieldNotes = fieldNotes;
    if (utilityLocateStatus !== undefined) updateFields.utilityLocateStatus = utilityLocateStatus;
    if (status) {
      const validStatuses = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "rescheduled"];
      if (validStatuses.includes(status)) {
        updateFields.status = status;
        if (status === "in_progress") updateFields.actualArrival = new Date();
        if (status === "completed") updateFields.actualDeparture = new Date();
      }
    }

    const [updated] = await db
      .update(fieldVisits)
      .set(updateFields)
      .where(eq(fieldVisits.id, id))
      .returning();

    // Notify team when field visit is completed
    if (status === "completed" && updated) {
      try {
        const [projectData] = await db
          .select({
            propertyAddress: projects.propertyAddress,
            surveyType: projects.surveyType,
          })
          .from(projects)
          .where(eq(projects.id, updated.projectId))
          .limit(1);

        let crewName: string | null = null;
        if (updated.crewId) {
          const [crewData] = await db
            .select({ name: crews.name })
            .from(crews)
            .where(eq(crews.id, updated.crewId))
            .limit(1);
          crewName = crewData?.name || null;
        }

        if (projectData) {
          notifyTeamFieldVisitCompleted(tenant.tenantId, {
            propertyAddress: projectData.propertyAddress,
            surveyType: projectData.surveyType,
            crewName,
          });
        }
      } catch (notifErr) {
        console.warn("Field visit notification failed (non-blocking):", notifErr);
      }
    }

    // Send SMS if scheduledDate changed (not just crew reassignment)
    if (scheduledDate && scheduledDate !== "1970-01-01") {
      try {
        const [visitWithProject] = await db
          .select({
            projectId: fieldVisits.projectId,
            timeWindow: fieldVisits.timeWindow,
          })
          .from(fieldVisits)
          .where(eq(fieldVisits.id, id))
          .limit(1);

        if (visitWithProject) {
          const [projectData] = await db
            .select({
              propertyAddress: projects.propertyAddress,
              surveyType: projects.surveyType,
              contactId: projects.contactId,
            })
            .from(projects)
            .where(eq(projects.id, visitWithProject.projectId))
            .limit(1);

          if (projectData) {
            const [contact] = await db
              .select({ firstName: contacts.firstName, phone: contacts.phone })
              .from(contacts)
              .where(eq(contacts.id, projectData.contactId))
              .limit(1);

            const [tenantData] = await db
              .select({ name: tenants.name })
              .from(tenants)
              .where(eq(tenants.id, tenant.tenantId))
              .limit(1);

            if (contact?.phone && tenantData) {
              const result = await sendVisitRescheduledSMS({
                contactPhone: contact.phone,
                contactFirstName: contact.firstName,
                surveyType: projectData.surveyType,
                propertyAddress: projectData.propertyAddress,
                scheduledDate,
                timeWindow: visitWithProject.timeWindow,
                tenantName: tenantData.name,
              });

              if (result.success) {
                await db
                  .update(fieldVisits)
                  .set({ clientNotifiedAt: new Date() })
                  .where(eq(fieldVisits.id, id));
              }
            }
          }
        }
      } catch (smsErr) {
        console.warn("SMS notification failed (non-blocking):", smsErr);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating field visit PATCH /api/schedule/field-visits/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update field visit" },
      { status: 500 }
    );
  }
}
