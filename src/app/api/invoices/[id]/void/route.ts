import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, projects } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { eq, and, sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenant.tenantId)))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "Cannot void a paid invoice" },
        { status: 400 }
      );
    }

    if (invoice.status === "void") {
      return NextResponse.json(
        { error: "Invoice is already voided" },
        { status: 400 }
      );
    }

    await db
      .update(invoices)
      .set({ status: "void", updatedAt: new Date() })
      .where(eq(invoices.id, id));

    // Recalculate project totalInvoiced
    if (invoice.projectId) {
      await db
        .update(projects)
        .set({
          totalInvoiced: sql`(
            select coalesce(sum(total::numeric), 0)
            from ${invoices}
            where ${invoices.projectId} = ${invoice.projectId}
            and ${invoices.status} != 'void'
          )`,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, invoice.projectId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error voiding invoice:", error);
    return NextResponse.json(
      { error: "Failed to void invoice" },
      { status: 500 }
    );
  }
}
