import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, contacts, tenants, projects } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice";
import { eq, and, sql } from "drizzle-orm";
import { Resend } from "resend";
import { stripe } from "@/lib/stripe";

const resend = new Resend(process.env.RESEND_API_KEY);

const SURVEY_TYPE_LABELS: Record<string, string> = {
  boundary: "Boundary Survey",
  alta: "ALTA/NSPS Land Title Survey",
  topographic: "Topographic Survey",
  as_built: "As-Built Survey",
  subdivision: "Subdivision Survey",
  construction: "Construction Survey",
  elevation_cert: "Elevation Certificate",
  route: "Route Survey",
  other: "Survey",
};

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

    // Fetch invoice
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

    // Fetch contact
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, invoice.contactId))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    // Fetch tenant data
    const [tenantData] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenant.tenantId))
      .limit(1);

    if (!tenantData) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch project
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

    // Generate PDF
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

    // Build email
    const surveyTypeLabel =
      SURVEY_TYPE_LABELS[projectData.surveyType] || projectData.surveyType;

    // Create Stripe Checkout Session for online payment
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const amountDueCents = Math.round(parseFloat(invoice.total) * 100);
    let payNowUrl: string | null = null;

    if (amountDueCents > 0) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amountDueCents,
                product_data: {
                  name: `Invoice ${invoice.invoiceNumber}`,
                  description: `${surveyTypeLabel} - ${projectData.propertyAddress}`,
                },
              },
              quantity: 1,
            },
          ],
          metadata: {
            invoiceId: invoice.id,
            tenantId: tenant.tenantId,
          },
          success_url: `${appUrl}/invoices/${invoice.id}/paid?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/invoices/${invoice.id}/paid?canceled=true`,
        });

        payNowUrl = session.url;

        // Save the payment link URL on the invoice
        await db
          .update(invoices)
          .set({
            stripePaymentLinkUrl: session.url,
            stripePaymentLinkId: session.id,
          })
          .where(eq(invoices.id, id));
      } catch (stripeErr) {
        console.warn("[invoice send] Stripe checkout creation failed (non-blocking):", stripeErr);
      }
    }

    const contactName = contact.firstName
      ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`
      : "Valued Client";

    const dueDateLabel = new Date(invoice.dueDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const totalFormatted = parseFloat(invoice.total).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #374151;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto;
    }
    .container { background-color: #ffffff; padding: 40px 20px; }
    .header { border-bottom: 3px solid #2563eb; margin-bottom: 30px; padding-bottom: 20px; }
    .company-name { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
    .greeting { font-size: 16px; margin-bottom: 20px; color: #1f2937; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
    .section-content { font-size: 14px; color: #6b7280; line-height: 1.8; }
    .amount-box {
      background-color: #eff6ff;
      border: 2px solid #2563eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-label { font-size: 14px; color: #6b7280; }
    .amount-value { font-size: 28px; font-weight: bold; color: #2563eb; }
    .amount-due { font-size: 12px; color: #9ca3af; margin-top: 5px; }
    .pay-btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 8px;
      margin-top: 10px;
    }
    .pay-section { text-align: center; margin: 25px 0; }
    .footer {
      border-top: 1px solid #e5e7eb;
      margin-top: 30px;
      padding-top: 20px;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer-content { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">${tenantData.name}</div>
    </div>

    <div class="greeting">
      Hi ${contactName},
    </div>

    <div class="section">
      <div class="section-content">
        Please find attached invoice <strong>${invoice.invoiceNumber}</strong> for the ${surveyTypeLabel} at <strong>${projectData.propertyAddress}</strong>.
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-label">Amount Due</div>
      <div class="amount-value">$${totalFormatted}</div>
      <div class="amount-due">Due by ${dueDateLabel}</div>
    </div>

    ${payNowUrl ? `
    <div class="pay-section">
      <a href="${payNowUrl}" class="pay-btn">Pay Now &rarr;</a>
    </div>
    ` : ""}

    <div class="section">
      <div class="section-content">
        ${payNowUrl
          ? "You can pay online using the button above, or find the invoice PDF attached to this email."
          : "The invoice PDF is attached to this email."
        } If you have any questions about this invoice, please don&rsquo;t hesitate to reach out.
      </div>
    </div>

    <div class="footer">
      <div class="footer-content">
        <strong>${tenantData.name}</strong><br>
        ${tenantData.phone ? `Phone: ${tenantData.phone}<br>` : ""}
        ${tenantData.email ? `Email: ${tenantData.email}<br>` : ""}
        ${tenantData.address ? `${tenantData.address}` : ""}
        ${tenantData.city ? `${tenantData.city}, ${tenantData.state} ${tenantData.zip}` : ""}
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email
    let emailResponse;
    try {
      emailResponse = await resend.emails.send({
        from: "SurveyDesk <invoices@updates.surveydesk.app>",
        to: contact.email,
        subject: `Invoice ${invoice.invoiceNumber} from ${tenantData.name} - ${projectData.propertyAddress}`,
        html: emailHtml,
        attachments: [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
        ],
      });
    } catch (emailErr) {
      console.error("Resend send error:", emailErr);
      return NextResponse.json(
        { error: "Email delivery failed", detail: String(emailErr) },
        { status: 500 }
      );
    }

    if (emailResponse.error) {
      console.error("Resend error:", JSON.stringify(emailResponse.error));
      return NextResponse.json(
        {
          error: "Failed to send email",
          detail:
            emailResponse.error.message ||
            JSON.stringify(emailResponse.error),
        },
        { status: 500 }
      );
    }

    // Update invoice status
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id))
      .returning();

    // Update project totalInvoiced
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

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      emailId: emailResponse.data?.id,
    });
  } catch (error) {
    console.error("Error sending invoice:", error);
    return NextResponse.json(
      { error: "Failed to send invoice", detail: String(error) },
      { status: 500 }
    );
  }
}
