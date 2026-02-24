import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, invoices, projects } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { notifyTeamPaymentReceived } from "@/lib/services/notify-owner";

// POST /api/payments — record a payment against an invoice
export async function POST(req: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["owner", "office_manager"].includes(tenant.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { invoiceId, amount, method, receivedAt, checkNumber, notes } = body as {
      invoiceId: string;
      amount: number;
      method: string;
      receivedAt: string;
      checkNumber?: string;
      notes?: string;
    };

    if (!invoiceId || !amount || !method || !receivedAt) {
      return NextResponse.json(
        { error: "invoiceId, amount, method, and receivedAt are required" },
        { status: 400 }
      );
    }

    const validMethods = ["credit_card", "ach", "check", "cash", "other"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify invoice belongs to tenant
    const [invoice] = await db
      .select({ id: invoices.id, total: invoices.total, projectId: invoices.projectId })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenant.tenantId)))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Insert payment
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId: tenant.tenantId,
        invoiceId,
        amount: String(amount),
        method: method as any,
        receivedAt: new Date(receivedAt),
        checkNumber: checkNumber || null,
        notes: notes || null,
      })
      .returning();

    // Update invoice amountPaid (sum of all payments for this invoice)
    const [totals] = await db
      .select({
        totalPaid: sql<string>`coalesce(sum(${payments.amount}), '0')`,
      })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const amountPaid = parseFloat(totals.totalPaid);
    const invoiceTotal = parseFloat(invoice.total);
    const newStatus = amountPaid >= invoiceTotal ? "paid" : "partially_paid";

    await db
      .update(invoices)
      .set({
        amountPaid: totals.totalPaid,
        status: newStatus,
        paidAt: newStatus === "paid" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // Notify team about payment
    const [invoiceForNotif] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    notifyTeamPaymentReceived(tenant.tenantId, {
      invoiceNumber: invoiceForNotif?.invoiceNumber || "?",
      amount: String(amount),
      method,
      status: newStatus,
    });

    // Update project totalPaid if linked
    if (invoice.projectId) {
      await db
        .update(projects)
        .set({
          totalPaid: sql`(
            select coalesce(sum(i.amount_paid::numeric), 0)
            from invoices i
            where i.project_id = ${invoice.projectId}
            and i.status != 'void'
          )`,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, invoice.projectId));
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
