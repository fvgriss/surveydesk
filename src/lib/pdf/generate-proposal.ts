import PDFDocument from 'pdfkit';

const SURVEY_TYPE_LABELS: Record<string, string> = {
  boundary: 'Boundary Survey',
  alta: 'ALTA/NSPS Land Title Survey',
  topographic: 'Topographic Survey',
  as_built: 'As-Built Survey',
  subdivision: 'Subdivision Survey',
  construction: 'Construction Survey',
  elevation_cert: 'Elevation Certificate',
  route: 'Route Survey',
  other: 'Survey',
};

export async function generateProposalPdf(data: {
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
  };
  proposal: {
    id: string;
    propertyAddress: string;
    surveyType: string;
    scopeItems: Array<{ task: string; description: string; included: boolean }>;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: string;
    total: string;
    termsAndConditions?: string | null;
    validUntil: string;
    depositRequired: boolean;
    depositPercent?: number | null;
    createdAt: string;
  };
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    email?: string | null;
  };
  acceptanceUrl: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 612;
      const contentWidth = pageWidth - 100; // 50 margin each side

      const fmt = (value: string | number): string => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const fmtDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
      };

      // Helper: check if we need a new page (leaving room for footer)
      const ensureSpace = (needed: number) => {
        if (doc.y + needed > 700) {
          doc.addPage();
        }
      };

      // ── HEADER ──
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#1f2937')
        .text(data.tenant.name);

      doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
      const addrParts = [
        data.tenant.address,
        [data.tenant.city, data.tenant.state, data.tenant.zip].filter(Boolean).join(', '),
      ].filter(Boolean);
      if (addrParts.length) doc.text(addrParts.join(' | '));

      const contactParts = [
        data.tenant.phone,
        data.tenant.email,
        data.tenant.plsLicenseNumber
          ? `PLS #${data.tenant.plsLicenseNumber}${data.tenant.plsLicenseState ? ` (${data.tenant.plsLicenseState})` : ''}`
          : null,
      ].filter(Boolean);
      if (contactParts.length) doc.text(contactParts.join(' | '));

      doc.moveDown(0.5);
      doc.strokeColor('#2563eb').lineWidth(2)
        .moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.8);

      // ── TITLE ──
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1f2937')
        .text('SURVEY PROPOSAL');
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
        .text(`Proposal Date: ${fmtDate(data.proposal.createdAt)}    |    Valid Until: ${fmtDate(data.proposal.validUntil)}`);
      doc.moveDown(1);

      // ── CLIENT INFO ──
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('Client Information');
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      const clientName = [data.contact.firstName, data.contact.lastName].filter(Boolean).join(' ');
      if (clientName) doc.text(clientName);
      if (data.contact.companyName) doc.text(data.contact.companyName);
      if (data.contact.email) doc.text(data.contact.email);
      doc.moveDown(0.8);

      // ── PROPERTY INFO ──
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('Property Information');
      doc.moveDown(0.3);

      const surveyTypeLabel = SURVEY_TYPE_LABELS[data.proposal.surveyType] || data.proposal.surveyType;
      doc.font('Helvetica').fontSize(10).fillColor('#374151')
        .text(`Address: ${data.proposal.propertyAddress}`)
        .text(`Survey Type: ${surveyTypeLabel}`);
      doc.moveDown(0.8);

      // ── Divider ──
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.8);

      // ── SCOPE OF WORK ──
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('Scope of Work');
      doc.moveDown(0.4);

      const includedItems = data.proposal.scopeItems.filter((item) => item.included);
      if (includedItems.length > 0) {
        includedItems.forEach((item, index) => {
          ensureSpace(40);
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937')
            .text(`${index + 1}. ${item.task}`);
          if (item.description) {
            doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
              .text(item.description, { indent: 15 });
          }
          doc.moveDown(0.3);
        });
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
          .text('Standard scope of work as described herein.');
      }
      doc.moveDown(0.5);

      // ── Divider ──
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.8);

      // ── PRICING ──
      ensureSpace(80);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('Pricing');
      doc.moveDown(0.5);

      // Table header
      const tableLeft = 50;
      const colDesc = tableLeft;
      const colQty = 340;
      const colUnit = 400;
      const colTotal = 480;
      const headerY = doc.y;

      doc.rect(tableLeft, headerY, contentWidth, 18).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
      doc.text('Description', colDesc + 5, headerY + 4, { width: 280 });
      doc.text('Qty', colQty, headerY + 4, { width: 50 });
      doc.text('Unit Price', colUnit, headerY + 4, { width: 70 });
      doc.text('Total', colTotal, headerY + 4, { width: 70 });
      doc.y = headerY + 22;
      doc.x = tableLeft;

      // Line items
      data.proposal.lineItems.forEach((item) => {
        ensureSpace(25);
        const rowY = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor('#374151');
        doc.text(item.description, colDesc + 5, rowY, { width: 280 });
        doc.text(String(item.quantity), colQty, rowY, { width: 50 });
        doc.text(fmt(item.unitPrice), colUnit, rowY, { width: 70 });
        doc.text(fmt(item.total), colTotal, rowY, { width: 70 });
        // Move Y to at least below this row
        if (doc.y < rowY + 16) doc.y = rowY + 16;
        doc.x = tableLeft;
      });

      doc.moveDown(0.5);

      // Subtotal line
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(colQty, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
      const subY = doc.y;
      doc.text('Subtotal:', colUnit - 60, subY);
      doc.text(fmt(data.proposal.subtotal), colTotal, subY);
      doc.y = subY + 18;
      doc.x = tableLeft;

      // Total
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#2563eb');
      const totY = doc.y;
      doc.text('TOTAL:', colUnit - 60, totY);
      doc.text(fmt(data.proposal.total), colTotal, totY);
      doc.y = totY + 22;
      doc.x = tableLeft;

      // Deposit
      if (data.proposal.depositRequired && data.proposal.depositPercent) {
        const depositAmt = (parseFloat(data.proposal.total) * data.proposal.depositPercent) / 100;
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151')
          .text(`Deposit Required: ${data.proposal.depositPercent}% (${fmt(depositAmt)})`);
      }

      doc.moveDown(1);

      // ── Divider ──
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.8);

      // ── TERMS ──
      ensureSpace(60);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('Terms & Conditions');
      doc.moveDown(0.3);

      const termsText = data.proposal.termsAndConditions ||
        'Standard terms and conditions apply. Payment is due upon receipt of invoice. All work is subject to site conditions and customer approval.';
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text(termsText, { width: contentWidth, lineGap: 2 });
      doc.moveDown(1);

      // ── ACCEPTANCE ──
      ensureSpace(80);
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
      doc.moveDown(0.8);

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937')
        .text('To Accept This Proposal');
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(10).fillColor('#374151')
        .text('Visit the link below to review and accept this proposal:');
      doc.moveDown(0.3);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563eb')
        .text(data.acceptanceUrl, {
          link: data.acceptanceUrl,
          underline: true,
        });

      doc.moveDown(1.5);

      // ── FOOTER ──
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text('Proposal generated by SurveyOS', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
