import { db } from "@/db";
import { invoices, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function InvoicePaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
}) {
  const { id } = await params;
  const { canceled } = await searchParams;

  // Fetch invoice + tenant name for display
  const [invoice] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      tenantId: invoices.tenantId,
    })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Not Found</h1>
          <p className="mt-2 text-gray-500">This invoice could not be located.</p>
        </div>
      </div>
    );
  }

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, invoice.tenantId))
    .limit(1);

  const totalFormatted = parseFloat(invoice.total).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (canceled === "true") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6">
            <XCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Canceled
          </h1>
          <p className="text-gray-500 mb-4">
            Your payment for invoice <strong>{invoice.invoiceNumber}</strong> was
            not completed.
          </p>
          <p className="text-sm text-gray-400">
            You can use the payment link in your email to try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Received!
        </h1>
        <p className="text-gray-500 mb-6">
          Thank you for your payment of <strong>${totalFormatted}</strong> for
          invoice <strong>{invoice.invoiceNumber}</strong>.
        </p>
        {tenant && (
          <p className="text-sm text-gray-400">
            {tenant.name} has been notified. A receipt will be sent to your email.
          </p>
        )}
      </div>
    </div>
  );
}
