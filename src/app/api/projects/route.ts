import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/projects — list all projects for the tenant
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: projects.id,
      propertyAddress: projects.propertyAddress,
      surveyType: projects.surveyType,
      status: projects.status,
      contractValue: projects.contractValue,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(projects)
    .innerJoin(contacts, eq(projects.contactId, contacts.id))
    .where(eq(projects.tenantId, tenant.tenantId))
    .orderBy(projects.createdAt);

  return NextResponse.json({
    projects: rows.map((r) => ({
      id: r.id,
      propertyAddress: r.propertyAddress,
      surveyType: r.surveyType,
      status: r.status,
      contractValue: r.contractValue,
      contactName: [r.contactFirstName, r.contactLastName]
        .filter(Boolean)
        .join(" "),
    })),
  });
}
