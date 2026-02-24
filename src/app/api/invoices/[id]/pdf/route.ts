import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, contacts, tenants, projects } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice";
import { eq, and } from "drizzle-orm";

// GET /api/invoices/[id]/pdf — download invoice as PDF
export async function GET(
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

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, invoice.contactId))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [tenantData] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenant.tenantId))
      .limit(1);

    if (!tenantData) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let projectData = { propertyAddress: "N/A", surveyType: "other" };
    if (invoice.projectId) {
      const [proj] = await db
        .select({
          propertyAddress: projects.propertyAddress,
          surveyType: projects.surveyType,
        })
        .from(projects)
        .where(eq(projects.id, invoice.projectId))
        .limit(1);
      if (proj) projectData = proj;
    }

    const pdfBuffer = await generateInvoicePdf({
      tenant: tenantData,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        lineItems: invoice.lineItems as Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }>,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate || "0",
        taxAmount: invoice.taxAmount || "0",
        total: invoice.total,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        createdAt: invoice.createdAt.toISOString(),
      },
      project: projectData,
      contact,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
