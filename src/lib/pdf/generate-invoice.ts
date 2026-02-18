import PDFDocument from "pdfkit";

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

const INVOICE_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit Invoice",
  progress: "Progress Invoice",
  final: "Final Invoice",
  retainer: "Retainer Invoice",
};

export async function generateInvoicePdf(data: {
  tenant: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    phone?: string | null;
    email?: string | null;
    plsLicenseNumber?: string | null;
    plsLicenseState?: string | null;
    invoiceNotes?: string | null;
  };
  invoice: {
    invoiceNumber: string;
    type: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: string;
    taxRate: string;
    taxAmount: string;
    total: string;
    dueDate: string;
    notes?: string | null;
    createdAt: string;
  };
  project: {
    propertyAddress: string;
    surveyType: string;
  };
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "letter",
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = 612;
      const contentWidth = pageWidth - 100;

      const fmt = (value: string | number): string => {
        const num = typeof value === "string" ? parseFloat(value) : value;
        return (
          "$" +
          num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      };

      const fmtDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      };

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > 700) {
          doc.addPage();
        }
      };

      // ── HEADER ──
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#1f2937")
        .text(data.tenant.name);

      doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
      const addrParts = [
        data.tenant.address,
        [data.tenant.city, data.tenant.state, data.tenant.zip]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean);
      if (addrParts.length) doc.text(addrParts.join(" | "));

      const contactParts = [
        data.tenant.phone,
        data.tenant.email,
        data.tenant.plsLicenseNumber
          ? `PLS #${data.tenant.plsLicenseNumber}${
              data.tenant.plsLicenseState
                ? ` (${data.tenant.plsLicenseState})`
                : ""
            }`
          : null,
      ].filter(Boolean);
      if (contactParts.length) doc.text(contactParts.join(" | "));

      doc.moveDown(0.5);
      doc
        .strokeColor("#2563eb")
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(pageWidth - 50, doc.y)
        .stroke();
      doc.moveDown(0.8);

      // ── TITLE ──
      const typeLabel =
        INVOICE_TYPE_LABELS[data.invoice.type] || "INVOICE";
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#1f2937")
        .text(typeLabel.toUpperCase());
      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6b7280")
        .text(
          `Invoice #: ${data.invoice.invoiceNumber}    |    Date: ${fmtDate(data.invoice.createdAt)}    |    Due: ${fmtDate(data.invoice.dueDate)}`
        );
      doc.moveDown(1);

      // ── BILL TO ──
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1f2937")
        .text("Bill To");
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(10).fillColor("#374151");
      const clientName = [data.contact.firstName, data.contact.lastName]
        .filter(Boolean)
        .join(" ");
      if (clientName) doc.text(clientName);
      if (data.contact.companyName) doc.text(data.contact.companyName);
      if (data.contact.email) doc.text(data.contact.email);
      const clientAddr = [
        data.contact.address,
        [data.contact.city, data.contact.state, data.contact.zip]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean);
      if (clientAddr.length) doc.text(clientAddr.join(", "));
      doc.moveDown(0.8);

      // ── PROJECT INFO ──
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1f2937")
        .text("Project");
      doc.moveDown(0.3);

      const surveyTypeLabel =
        SURVEY_TYPE_LABELS[data.project.surveyType] ||
        data.project.surveyType;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(`Property: ${data.project.propertyAddress}`)
        .text(`Survey Type: ${surveyTypeLabel}`);
      doc.moveDown(0.8);

      // ── Divider ──
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(pageWidth - 50, doc.y)
        .stroke();
      doc.moveDown(0.8);

      // ── LINE ITEMS ──
      ensureSpace(80);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1f2937")
        .text("Line Items");
      doc.moveDown(0.5);

      const tableLeft = 50;
      const colDesc = tableLeft;
      const colQty = 340;
      const colUnit = 400;
      const colTotal = 480;
      const headerY = doc.y;

      doc.rect(tableLeft, headerY, contentWidth, 18).fill("#f3f4f6");
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151");
      doc.text("Description", colDesc + 5, headerY + 4, { width: 280 });
      doc.text("Qty", colQty, headerY + 4, { width: 50 });
      doc.text("Unit Price", colUnit, headerY + 4, { width: 70 });
      doc.text("Total", colTotal, headerY + 4, { width: 70 });
      doc.y = headerY + 22;
      doc.x = tableLeft;

      data.invoice.lineItems.forEach((item) => {
        ensureSpace(25);
        const rowY = doc.y;
        doc.font("Helvetica").fontSize(9).fillColor("#374151");
        doc.text(item.description, colDesc + 5, rowY, { width: 280 });
        doc.text(String(item.quantity), colQty, rowY, { width: 50 });
        doc.text(fmt(item.unitPrice), colUnit, rowY, { width: 70 });
        doc.text(fmt(item.total), colTotal, rowY, { width: 70 });
        if (doc.y < rowY + 16) doc.y = rowY + 16;
        doc.x = tableLeft;
      });

      doc.moveDown(0.5);

      // Subtotal
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .moveTo(colQty, doc.y)
        .lineTo(pageWidth - 50, doc.y)
        .stroke();
      doc.moveDown(0.3);

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151");
      let rowY = doc.y;
      doc.text("Subtotal:", colUnit - 60, rowY);
      doc.text(fmt(data.invoice.subtotal), colTotal, rowY);
      doc.y = rowY + 16;
      doc.x = tableLeft;

      // Tax
      const taxRateNum = parseFloat(data.invoice.taxRate) * 100;
      if (taxRateNum > 0) {
        rowY = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor("#6b7280");
        doc.text(`Tax (${taxRateNum.toFixed(1)}%):`, colUnit - 60, rowY);
        doc.text(fmt(data.invoice.taxAmount), colTotal, rowY);
        doc.y = rowY + 16;
        doc.x = tableLeft;
      }

      // Total
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#2563eb");
      rowY = doc.y;
      doc.text("TOTAL DUE:", colUnit - 60, rowY);
      doc.text(fmt(data.invoice.total), colTotal, rowY);
      doc.y = rowY + 22;
      doc.x = tableLeft;

      doc.moveDown(1);

      // ── NOTES ──
      if (data.invoice.notes) {
        ensureSpace(60);
        doc
          .strokeColor("#e5e7eb")
          .lineWidth(0.5)
          .moveTo(50, doc.y)
          .lineTo(pageWidth - 50, doc.y)
          .stroke();
        doc.moveDown(0.8);

        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#1f2937")
          .text("Notes");
        doc.moveDown(0.3);
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#6b7280")
          .text(data.invoice.notes, { width: contentWidth, lineGap: 2 });
        doc.moveDown(1);
      }

      // ── PAYMENT INSTRUCTIONS ──
      ensureSpace(60);
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(pageWidth - 50, doc.y)
        .stroke();
      doc.moveDown(0.8);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1f2937")
        .text("Payment Instructions");
      doc.moveDown(0.3);

      const paymentText =
        data.tenant.invoiceNotes ||
        "Payment is due upon receipt. Please make checks payable to the company name listed above. For wire transfer or ACH payment, please contact us for details.";
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6b7280")
        .text(paymentText, { width: contentWidth, lineGap: 2 });

      doc.moveDown(1.5);

      // ── FOOTER ──
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#9ca3af")
        .text("Invoice generated by SurveyOS", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
