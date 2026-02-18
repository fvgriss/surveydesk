import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fieldVisits, projects, crews, contacts, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { sendVisitScheduledSMS } from "@/lib/services/sms";

// POST /api/schedule/field-visits — create a new field visit
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { projectId, crewId, scheduledDate, timeWindow, estimatedDurationHours, accessNotes } =
    body as {
      projectId: string;
      crewId: string | null;
      scheduledDate: string;
      timeWindow?: string;
      estimatedDurationHours?: string;
      accessNotes?: string;
    };

  if (!projectId || !scheduledDate) {
    return NextResponse.json(
      { error: "projectId and scheduledDate are required" },
      { status: 400 }
    );
  }

  // Verify project belongs to tenant
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify crew belongs to tenant (if provided)
  if (crewId) {
    const [crew] = await db
      .select({ id: crews.id })
      .from(crews)
      .where(and(eq(crews.id, crewId), eq(crews.tenantId, tenant.tenantId)))
      .limit(1);

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }
  }

  const [newVisit] = await db
    .insert(fieldVisits)
    .values({
      tenantId: tenant.tenantId,
      projectId,
      crewId: crewId || null,
      scheduledDate,
      timeWindow: (timeWindow as "morning" | "afternoon" | "full_day" | "multi_day") || "full_day",
      estimatedDurationHours: estimatedDurationHours || null,
      accessNotes: accessNotes || null,
      status: "scheduled",
    })
    .returning();

  // Send SMS notification if real date (not sentinel) and contact has phone
  if (scheduledDate && scheduledDate !== "1970-01-01") {
    try {
      const [projectData] = await db
        .select({
          propertyAddress: projects.propertyAddress,
          surveyType: projects.surveyType,
          contactId: projects.contactId,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
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
          const result = await sendVisitScheduledSMS({
            contactPhone: contact.phone,
            contactFirstName: contact.firstName,
            surveyType: projectData.surveyType,
            propertyAddress: projectData.propertyAddress,
            scheduledDate,
            timeWindow: newVisit.timeWindow,
            tenantName: tenantData.name,
          });

          if (result.success) {
            await db
              .update(fieldVisits)
              .set({ clientNotifiedAt: new Date() })
              .where(eq(fieldVisits.id, newVisit.id));
          }
        }
      }
    } catch (smsErr) {
      console.warn("SMS notification failed (non-blocking):", smsErr);
    }
  }

  return NextResponse.json(newVisit, { status: 201 });
}
