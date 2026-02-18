"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronDown } from "lucide-react";

interface Contact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
}

interface Lead {
  id: string;
  contactId?: string | null;
  propertyAddress: string;
  surveyType: string;
}

interface ProposalTemplate {
  id: string;
  name: string;
  surveyType: string;
}

interface ScopeItem {
  task: string;
  description: string;
  included: boolean;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ProposalData {
  id?: string;
  contactId: string;
  leadId?: string | null;
  propertyAddress: string;
  surveyType: string;
  scopeItems: ScopeItem[];
  lineItems: LineItem[];
  pricingMode: string;
  termsAndConditions: string;
  validUntil: string;
  depositRequired: boolean;
  depositPercent: number;
}

export default function ProposalForm({
  contacts,
  leads: initialLeads,
  templates,
  tenantTerms,
  selectedLeadId,
  proposal: initialProposal,
}: {
  contacts: Contact[];
  leads: Lead[];
  templates: ProposalTemplate[];
  tenantTerms: string;
  selectedLeadId?: string | null;
  proposal?: ProposalData | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Initialize form state
  const [formData, setFormData] = useState<ProposalData>(
    initialProposal || {
      contactId: "",
      leadId: selectedLeadId || null,
      propertyAddress: "",
      surveyType: "",
      scopeItems: [],
      lineItems: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
      pricingMode: "fixed",
      termsAndConditions: tenantTerms,
      validUntil: "",
      depositRequired: false,
      depositPercent: 50,
    }
  );

  const selectedLead = initialLeads.find((l) => l.id === formData.leadId);
  const filteredLeads = initialLeads.filter(
    (l) => !formData.contactId || l.contactId === formData.contactId
  );

  // Auto-fill property and survey type when lead is selected
  const handleLeadChange = (leadId: string) => {
    const lead = initialLeads.find((l) => l.id === leadId);
    if (lead) {
      setFormData((prev) => ({
        ...prev,
        leadId,
        propertyAddress: lead.propertyAddress,
        surveyType: lead.surveyType,
      }));
    }
  };

  // Handle scope item changes
  const handleScopeItemChange = (
    index: number,
    field: keyof ScopeItem,
    value: any
  ) => {
    const updated = [...formData.scopeItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, scopeItems: updated }));
  };

  // Add scope item
  const addScopeItem = () => {
    setFormData((prev) => ({
      ...prev,
      scopeItems: [
        ...prev.scopeItems,
        { task: "", description: "", included: true },
      ],
    }));
  };

  // Remove scope item
  const removeScopeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      scopeItems: prev.scopeItems.filter((_, i) => i !== index),
    }));
  };

  // Handle line item changes
  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: any
  ) => {
    const updated = [...formData.lineItems];
    const item = { ...updated[index], [field]: value };

    // Auto-calculate total
    if (field === "quantity" || field === "unitPrice") {
      item.total = item.quantity * item.unitPrice;
    }

    updated[index] = item;
    setFormData((prev) => ({ ...prev, lineItems: updated }));
  };

  // Add line item
  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: "", quantity: 1, unitPrice: 0, total: 0 },
      ],
    }));
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals
  const subtotal = formData.lineItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  // Handle save draft
  const handleSaveDraft = async () => {
    if (!formData.contactId || !formData.propertyAddress || !formData.surveyType || !formData.validUntil) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const url = initialProposal?.id
        ? `/api/proposals/${initialProposal.id}`
        : "/api/proposals";
      const method = initialProposal?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save proposal");
      }

      router.push("/proposals");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to save proposal");
    } finally {
      setLoading(false);
    }
  };

  // Handle save and send
  const handleSaveAndSend = async () => {
    if (!formData.contactId || !formData.propertyAddress || !formData.surveyType || !formData.validUntil) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // First save the proposal
      const url = initialProposal?.id
        ? `/api/proposals/${initialProposal.id}`
        : "/api/proposals";
      const method = initialProposal?.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save proposal");
      }

      const proposal = await response.json();

      // Then send it
      const sendResponse = await fetch(`/api/proposals/${proposal.id}/send`, {
        method: "POST",
      });

      if (!sendResponse.ok) {
        const sendErr = await sendResponse.json().catch(() => ({}));
        const msg = typeof sendErr.detail === 'string' ? sendErr.detail : (sendErr.detail?.message || sendErr.error || "Failed to send proposal");
        throw new Error(msg);
      }

      router.push("/proposals");
    } catch (error: any) {
      console.error("Error:", error);
      alert(error.message || "Failed to save and send proposal");
    } finally {
      setLoading(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === formData.contactId);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <Link href="/proposals" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
          &larr; Back to Proposals
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">
          {initialProposal ? "Edit Proposal" : "New Proposal"}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Section 1: Contact & Property */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact &amp; Property</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact *
              </label>
              <select
                value={formData.contactId}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(" ")} {c.companyName ? `(${c.companyName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead (Optional)
              </label>
              <select
                value={formData.leadId || ""}
                onChange={(e) => handleLeadChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select lead</option>
                {filteredLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.propertyAddress}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Address *
              </label>
              <input
                type="text"
                value={formData.propertyAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, propertyAddress: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Survey Type *
              </label>
              <select
                value={formData.surveyType}
                onChange={(e) => setFormData((prev) => ({ ...prev, surveyType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select survey type</option>
                <option value="boundary">Boundary</option>
                <option value="alta">ALTA/NSPS</option>
                <option value="topographic">Topographic</option>
                <option value="as_built">As-Built</option>
                <option value="subdivision">Subdivision</option>
                <option value="construction">Construction</option>
                <option value="elevation_cert">Elevation Certificate</option>
                <option value="route">Route</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Scope of Work */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Scope of Work</h2>
            <button
              onClick={addScopeItem}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {formData.scopeItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Task"
                    value={item.task}
                    onChange={(e) => handleScopeItemChange(idx, "task", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleScopeItemChange(idx, "description", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={(e) => handleScopeItemChange(idx, "included", e.target.checked)}
                      className="w-4 h-4"
                    />
                    Include
                  </label>
                  <button
                    onClick={() => removeScopeItem(idx)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              onClick={addLineItem}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-600 uppercase px-3 py-2">Description</th>
                  <th className="text-right text-xs font-medium text-gray-600 uppercase px-3 py-2 w-20">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-600 uppercase px-3 py-2 w-24">Unit Price</th>
                  <th className="text-right text-xs font-medium text-gray-600 uppercase px-3 py-2 w-24">Total</th>
                  <th className="text-xs font-medium text-gray-600 uppercase px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {formData.lineItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      ${item.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Subtotal</div>
              <div className="text-2xl font-semibold text-gray-900">${subtotal.toFixed(2)}</div>
              <div className="text-sm text-gray-600 mt-3 border-t pt-3">
                <div className="font-semibold">Total: ${total.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Terms */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until *
              </label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData((prev) => ({ ...prev, validUntil: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.depositRequired}
                  onChange={(e) => setFormData((prev) => ({ ...prev, depositRequired: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="font-medium text-gray-700">Deposit Required</span>
              </label>
              {formData.depositRequired && (
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.depositPercent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, depositPercent: parseInt(e.target.value) || 50 }))}
                    className="w-full px-2 py-2 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">%</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms &amp; Conditions
            </label>
            <textarea
              value={formData.termsAndConditions}
              onChange={(e) => setFormData((prev) => ({ ...prev, termsAndConditions: e.target.value }))}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href="/proposals"
            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSaveDraft}
            disabled={loading}
            className="px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={handleSaveAndSend}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save &amp; Send
          </button>
        </div>
      </div>
    </div>
  );
}
