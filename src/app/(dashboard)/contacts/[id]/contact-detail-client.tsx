"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Pencil,
  Check,
  X,
  FolderOpen,
  FileText,
  DollarSign,
  Clock,
  Trash2,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";

type Contact = {
  id: string;
  tenantId: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  referralSource: string | null;
  notes: string | null;
  defaultPaymentTermsDays: number | null;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  contractValue: string;
  createdAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  total: string;
  status: string;
  type: string;
  dueDate: string;
  createdAt: string;
};

type Lead = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  source: string;
  createdAt: string;
};

import {
  CONTACT_TYPES,
  PROJECT_STATUS_COLORS,
  INVOICE_STATUS_COLORS,
  LEAD_STATUS_COLORS,
  DEFAULT_BADGE,
} from "@/lib/constants";

function getTypeBadge(type: string) {
  return CONTACT_TYPES.find((t) => t.value === type) || { value: type, label: type, color: DEFAULT_BADGE };
}

const STATUS_COLORS: Record<string, string> = {
  ...PROJECT_STATUS_COLORS,
  ...INVOICE_STATUS_COLORS,
  ...LEAD_STATUS_COLORS,
};

function statusBadge(status: string) {
  const color = STATUS_COLORS[status] || DEFAULT_BADGE;
  return `${color} px-2 py-0.5 rounded-full text-[10px] font-medium`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ContactDetailClient({
  contact,
  projects,
  invoices,
  leads,
}: {
  contact: Contact;
  projects: Project[];
  invoices: Invoice[];
  leads: Lead[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: contact.type,
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    companyName: contact.companyName || "",
    email: contact.email || "",
    phone: contact.phone || "",
    address: contact.address || "",
    city: contact.city || "",
    state: contact.state || "",
    zip: contact.zip || "",
    referralSource: contact.referralSource || "",
    notes: contact.notes || "",
    defaultPaymentTermsDays: contact.defaultPaymentTermsDays ?? 0,
  });

  function update(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({
      type: contact.type,
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      companyName: contact.companyName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      address: contact.address || "",
      city: contact.city || "",
      state: contact.state || "",
      zip: contact.zip || "",
      referralSource: contact.referralSource || "",
      notes: contact.notes || "",
      defaultPaymentTermsDays: contact.defaultPaymentTermsDays ?? 0,
    });
    setEditing(false);
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ error: string; blockers?: string[] } | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        router.push("/contacts");
      } else {
        setDeleteError(data);
      }
    } catch {
      setDeleteError({ error: "Network error" });
    } finally {
      setDeleting(false);
    }
  }

  const displayName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.companyName || "Unnamed";
  const badge = getTypeBadge(contact.type);

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total), 0);
  const outstandingAmount = invoices
    .filter((i) => !["paid", "void", "draft"].includes(i.status))
    .reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="p-6 max-w-5xl">
      {/* Back link + header */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} />
        Back to Contacts
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            {contact.companyName && !contact.firstName ? (
              <Building2 size={22} className="text-gray-400" />
            ) : (
              <span className="text-lg font-semibold text-gray-500">
                {(contact.firstName?.[0] || "").toUpperCase()}
                {(contact.lastName?.[0] || "").toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>
                {badge.label}
              </span>
              <span className="text-xs text-gray-400">Added {fmtDate(contact.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteError(null); }}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Delete
              </button>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              >
                <Pencil size={13} />
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <X size={13} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Check size={13} />
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column — contact info */}
        <div className="col-span-2 space-y-6">
          {/* Contact details card */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h2>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => update("type", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CONTACT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                    <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                    <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                  <input type="text" value={form.companyName} onChange={(e) => update("companyName", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={(e) => update("address", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                    <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                    <input type="text" value={form.state} onChange={(e) => update("state", e.target.value)} maxLength={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ZIP</label>
                    <input type="text" value={form.zip} onChange={(e) => update("zip", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Referral Source</label>
                  <input type="text" value={form.referralSource} onChange={(e) => update("referralSource", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment Terms (days, 0 = due on receipt)</label>
                  <input type="number" value={form.defaultPaymentTermsDays} onChange={(e) => update("defaultPaymentTermsDays", parseInt(e.target.value) || 0)}
                    className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {contact.companyName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{contact.companyName}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-gray-400 flex-shrink-0" />
                    <a href={`tel:${contact.phone}`} className="text-gray-700 hover:text-blue-600">{formatPhone(contact.phone)}</a>
                  </div>
                )}
                {(contact.address || contact.city || contact.state) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">
                      {[contact.address, [contact.city, contact.state].filter(Boolean).join(", "), contact.zip]
                        .filter(Boolean)
                        .join("\n")
                        .split("\n")
                        .map((line, i) => (
                          <span key={i}>
                            {line}
                            <br />
                          </span>
                        ))}
                    </span>
                  </div>
                )}
                {contact.referralSource && (
                  <div className="text-sm text-gray-500">
                    <span className="text-xs font-medium text-gray-400">Referral:</span>{" "}
                    {contact.referralSource}
                  </div>
                )}
                {contact.defaultPaymentTermsDays !== null && contact.defaultPaymentTermsDays > 0 && (
                  <div className="text-sm text-gray-500">
                    <span className="text-xs font-medium text-gray-400">Payment terms:</span>{" "}
                    Net {contact.defaultPaymentTermsDays}
                  </div>
                )}
                {contact.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-medium text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
                  </div>
                )}
                {!contact.email && !contact.phone && !contact.address && (
                  <p className="text-sm text-gray-400 italic">No contact details on file</p>
                )}
              </div>
            )}
          </div>

          {/* Projects */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen size={14} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Projects ({projects.length})</h2>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-gray-400">No projects yet</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-50 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{p.propertyAddress}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.surveyType.replace("_", " ")} · {fmtDate(p.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {Number(p.contractValue) > 0 && (
                        <span className="text-sm font-medium text-gray-600">
                          ${Number(p.contractValue).toLocaleString()}
                        </span>
                      )}
                      <span className={statusBadge(p.status)}>
                        {p.status.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Invoices ({invoices.length})</h2>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-400">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {inv.invoiceNumber || "Draft"}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {inv.type} · Due {inv.dueDate ? fmtDate(inv.dueDate) : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        ${Number(inv.total).toLocaleString()}
                      </span>
                      <span className={statusBadge(inv.status)}>
                        {inv.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leads */}
          {leads.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Phone size={14} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Leads ({leads.length})</h2>
              </div>
              <div className="space-y-2">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{lead.propertyAddress}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {lead.surveyType.replace("_", " ")} · {lead.source.replace("_", " ")} · {fmtDate(lead.createdAt)}
                      </div>
                    </div>
                    <span className={statusBadge(lead.status)}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — summary sidebar */}
        <div className="space-y-4">
          {/* Financial summary */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financial Summary</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">Total Revenue</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${totalRevenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Outstanding</div>
                <div className={`text-lg font-semibold ${outstandingAmount > 0 ? "text-amber-600" : "text-gray-300"}`}>
                  ${outstandingAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Projects</div>
                <div className="text-lg font-semibold text-gray-900">{projects.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Invoices</div>
                <div className="text-lg font-semibold text-gray-900">{invoices.length}</div>
              </div>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={11} className="text-gray-300" />
                <span>Created {fmtDate(contact.createdAt)}</span>
              </div>
              {projects.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FolderOpen size={11} className="text-gray-300" />
                  <span>First project {fmtDate(projects[projects.length - 1].createdAt)}</span>
                </div>
              )}
              {projects.length > 1 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FolderOpen size={11} className="text-gray-300" />
                  <span>Latest project {fmtDate(projects[0].createdAt)}</span>
                </div>
              )}
              {invoices.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileText size={11} className="text-gray-300" />
                  <span>Last invoice {fmtDate(invoices[0].createdAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowDeleteModal(false); setDeleteError(null); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Contact</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{displayName}</strong>? This cannot be undone.
            </p>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-red-800 mb-1">{deleteError.error}</p>
                {deleteError.blockers && (
                  <ul className="text-xs text-red-700 list-disc pl-4">
                    {deleteError.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              {!deleteError?.blockers && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Contact"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
