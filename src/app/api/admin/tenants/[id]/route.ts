import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { db } from "@/db";
import { tenants, users, projects, invoices } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// GET /api/admin/tenants/[id] — single tenant with details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkSuperAdmin();
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get users for this tenant
    const tenantUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, id));

    // Get project and invoice counts
    const [stats] = await db
      .select({
        projectCount: sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.tenant_id = ${id})`,
        invoiceCount: sql<number>`(SELECT COUNT(*) FROM invoices WHERE invoices.tenant_id = ${id})`,
      })
      .from(sql`(SELECT 1) as dummy`);

    return NextResponse.json({
      tenant,
      users: tenantUsers,
      stats: {
        projectCount: Number(stats?.projectCount || 0),
        invoiceCount: Number(stats?.invoiceCount || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching tenant GET /api/admin/tenants/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant details" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/tenants/[id] — update tenant fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkSuperAdmin();
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const allowedFields = [
      "name", "phone", "email", "address", "city", "state", "zip",
      "plsLicenseNumber", "plsLicenseState", "insuranceInfo",
      "serviceAreaCounties", "logoUrl",
      "defaultSurveyTypes", "proposalTerms", "invoiceNotes",
      "retellAgentId", "retellPhoneNumber",
      "onboardingComplete",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ tenant: updated });
  } catch (error) {
    console.error("Error updating tenant PATCH /api/admin/tenants/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 }
    );
  }
}
