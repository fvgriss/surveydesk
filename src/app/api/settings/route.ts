import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/settings — fetch current tenant profile
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [firm] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId))
    .limit(1);

  if (!firm)
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json(firm);
}

// PATCH /api/settings — update tenant profile
export async function PATCH(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const allowedFields = [
    "name",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "zip",
    "plsLicenseNumber",
    "plsLicenseState",
    "insuranceInfo",
    "serviceAreaCounties",
    "logoUrl",
    "defaultSurveyTypes",
    "proposalTerms",
    "invoiceNotes",
  ] as const;

  const updateFields: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields[field] = body[field];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updateFields.updatedAt = new Date();

  const [updated] = await db
    .update(tenants)
    .set(updateFields)
    .where(eq(tenants.id, tenant.tenantId))
    .returning();

  return NextResponse.json(updated);
}
