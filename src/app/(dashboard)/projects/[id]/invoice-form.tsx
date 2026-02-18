"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Send, Save } from "lucide-react";

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

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type InvoiceFormProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectAddress: string;
  surveyType: string;
  contractValue: number;
  contactName: string;
  onCreated: () => void;
};

const fmt = (v: number) =>
  "$" +
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function InvoiceForm({
  open,
  onClose,
  projectId,
  projectAddress,
  surveyType,
  contractValue,
  contactName,
  onCreated,
}: InvoiceFormProps) {
  const surveyLabel =
    SURVEY_TYPE_LABELS[surveyType] || surveyType.replace(/_/g, " ");

  const [type, setType] = useState<string>("final");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      description: `${surveyLabel} - ${projectAddress}`,
      quantity: 1,
      unitPrice: contractValue,
      total: contractValue,
    },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setType("final");
      setLineItems([
        {
          description: `${surveyLabel} - ${projectAddress}`,
          quantity: 1,
          unitPrice: contractValue,
          total: contractValue,
        },
      ]);
      setTaxRate(0);
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split("T")[0]);
      setNotes("");
      setInternalNotes("");
      setError(null);
    }
  }, [open, surveyLabel, projectAddress, contractValue]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  function updateLineItem(
    index: number,
    field: keyof LineItem,
    value: string | number
  ) {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value) || 0;
        item.total = item.quantity * item.unitPrice;
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value) || 0;
        item.total = item.quantity * item.unitPrice;
      }
      updated[index] = item;
      return updated;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, total: 0 },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(sendNow: boolean) {
    setSubmitting(true);
    setError(null);

    try {
      // First create the invoice
      const createRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          contactId: "", // Will be resolved server-side from project
          type,
          lineItems,
          taxRate,
          dueDate,
          notes: notes || undefined,
          internalNotes: internalNotes || undefined,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create invoice");
      }

      const invoice = await createRes.json();

      // If sendNow, send the invoice
      if (sendNow) {
        const sendRes = await fetch(`/api/invoices/${invoice.id}/send`, {
          method: "POST",
        });

        if (!sendRes.ok) {
          const err = await sendRes.json();
          throw new Error(err.error || "Invoice created but failed to send");
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Invoice
            </h2>
            <p className="text-xs text-gray-500">
              {contactName} · {projectAddress}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Invoice Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="deposit">Deposit</option>
                <option value="progress">Progress</option>
                <option value="final">Final</option>
                <option value="retainer">Retainer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Line Items
            </label>
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(idx, "description", e.target.value)
                    }
                    placeholder="Description"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(idx, "quantity", e.target.value)
                    }
                    min={1}
                    className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateLineItem(idx, "unitPrice", e.target.value)
                    }
                    min={0}
                    step={0.01}
                    className="w-28 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  />
                  <div className="w-24 px-2 py-2 text-sm text-gray-600 text-right font-medium">
                    {fmt(item.total)}
                  </div>
                  <button
                    onClick={() => removeLineItem(idx)}
                    disabled={lineItems.length <= 1}
                    className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addLineItem}
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Plus size={12} /> Add line item
            </button>
          </div>

          {/* Tax Rate */}
          <div className="flex items-center gap-4">
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.1}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1" />
            <div className="text-right space-y-1">
              <div className="text-xs text-gray-500">
                Subtotal: <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="text-xs text-gray-500">
                  Tax: <span className="font-medium">{fmt(taxAmount)}</span>
                </div>
              )}
              <div className="text-sm font-bold text-gray-900">
                Total: {fmt(total)}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes (shown on invoice)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment instructions, thank you message, etc."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Internal Notes (not shown to client)
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal tracking notes..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || lineItems.every((li) => li.total === 0)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {submitting ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting || lineItems.every((li) => li.total === 0)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              {submitting ? "Sending..." : "Save & Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
