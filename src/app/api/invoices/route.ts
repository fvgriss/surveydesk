import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, projects } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// POST /api/invoices — create a new invoice
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    projectId,
    contactId,
    type,
    lineItems,
    taxRate,
    dueDate,
    notes,
    internalNotes,
  } = body as {
    projectId: string;
    contactId: string;
    type: "deposit" | "progress" | "final" | "retainer";
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    taxRate: number;
    dueDate: string;
    notes?: string;
    internalNotes?: string;
  };

  if (!projectId || !dueDate || !lineItems?.length) {
    return NextResponse.json(
      { error: "projectId, dueDate, and lineItems are required" },
      { status: 400 }
    );
  }

  // Verify project belongs to tenant and get contactId
  const [project] = await db
    .select({ id: projects.id, contactId: projects.contactId })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.tenantId, tenant.tenantId))
    )
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Use provided contactId or resolve from project
  const resolvedContactId = contactId || project.contactId;

  // Generate sequential invoice number
  const [lastInvoice] = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(eq(invoices.tenantId, tenant.tenantId))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const invoiceNumber = `INV-${String(nextNum).padStart(3, "0")}`;

  // Calculate totals
  const subtotal = lineItems.reduce(
    (sum: number, item: { total: number }) => sum + item.total,
    0
  );
  const taxAmount = subtotal * ((taxRate || 0) / 100);
  const total = subtotal + taxAmount;

  const [newInvoice] = await db
    .insert(invoices)
    .values({
      tenantId: tenant.tenantId,
      projectId,
      contactId: resolvedContactId,
      invoiceNumber,
      type: type || "final",
      status: "draft",
      lineItems,
      subtotal: subtotal.toFixed(2),
      taxRate: ((taxRate || 0) / 100).toFixed(4),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      dueDate,
      notes: notes || null,
      internalNotes: internalNotes || null,
    })
    .returning();

  return NextResponse.json(newInvoice, { status: 201 });
}
