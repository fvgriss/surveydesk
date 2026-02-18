import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// PATCH /api/invoices/[id] — update a draft invoice
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Verify invoice belongs to tenant
  const [existing] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, id), eq(invoices.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updateFields: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.lineItems) {
    updateFields.lineItems = body.lineItems;
    const subtotal = body.lineItems.reduce(
      (sum: number, item: { total: number }) => sum + item.total,
      0
    );
    const taxRate = body.taxRate !== undefined
      ? body.taxRate / 100
      : parseFloat(existing.taxRate || "0");
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    updateFields.subtotal = subtotal.toFixed(2);
    updateFields.taxRate = taxRate.toFixed(4);
    updateFields.taxAmount = taxAmount.toFixed(2);
    updateFields.total = total.toFixed(2);
  }

  if (body.dueDate) updateFields.dueDate = body.dueDate;
  if (body.notes !== undefined) updateFields.notes = body.notes;
  if (body.internalNotes !== undefined) updateFields.internalNotes = body.internalNotes;
  if (body.type) updateFields.type = body.type;

  const [updated] = await db
    .update(invoices)
    .set(updateFields)
    .where(eq(invoices.id, id))
    .returning();

  return NextResponse.json(updated);
}

// GET /api/invoices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, id), eq(invoices.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}
