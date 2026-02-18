import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/contacts/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)))
      .limit(1);

    if (!contact)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error fetching contact GET /api/contacts/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[id] — update contact
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

    // Verify ownership
    const [existing] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)))
      .limit(1);

    if (!existing)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const allowedFields = [
      "type",
      "firstName",
      "lastName",
      "companyName",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "zip",
      "referralSource",
      "notes",
      "defaultPaymentTermsDays",
    ] as const;

    const updateFields: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(contacts)
      .set(updateFields)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating contact PATCH /api/contacts/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)))
      .limit(1);

    if (!existing)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenant.tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact DELETE /api/contacts/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
