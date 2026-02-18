import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, projects, leads } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/contacts — list all contacts for tenant
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, tenant.tenantId))
    .orderBy(desc(contacts.createdAt));

  return NextResponse.json(rows);
}

// POST /api/contacts — create a new contact
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const {
    type,
    firstName,
    lastName,
    companyName,
    email,
    phone,
    address,
    city,
    state,
    zip,
    referralSource,
    notes,
    defaultPaymentTermsDays,
  } = body;

  if (!firstName && !lastName && !companyName) {
    return NextResponse.json(
      { error: "At least a name or company name is required" },
      { status: 400 }
    );
  }

  const [contact] = await db
    .insert(contacts)
    .values({
      tenantId: tenant.tenantId,
      type: type || "homeowner",
      firstName: firstName || null,
      lastName: lastName || null,
      companyName: companyName || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      referralSource: referralSource || null,
      notes: notes || null,
      defaultPaymentTermsDays: defaultPaymentTermsDays ?? 0,
    })
    .returning();

  return NextResponse.json(contact, { status: 201 });
}
