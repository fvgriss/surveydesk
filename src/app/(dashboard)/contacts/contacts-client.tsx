"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  FolderOpen,
  DollarSign,
  X,
  ChevronRight,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";

type Contact = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  projectCount: number;
  totalRevenue: string;
  openInvoices: number;
};

import { CONTACT_TYPES } from "@/lib/constants";

function getTypeBadge(type: string) {
  const ct = CONTACT_TYPES.find((t) => t.value === type);
  return ct || { value: type, label: type, color: "bg-gray-50 text-gray-700" };
}

function displayName(c: Contact) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  if (name && c.companyName) return `${name} (${c.companyName})`;
  return name || c.companyName || "Unnamed";
}

type ContactsClientProps = {
  contacts: Contact[];
  totalCount: number;
  typeStats: Record<string, number>;
};

export function ContactsClient({ contacts, totalCount, typeStats }: ContactsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      displayName(c).toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.city?.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || c.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} total contact{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Contact
        </button>
      </div>

      {/* Type stat pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTypeFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            typeFilter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({totalCount})
        </button>
        {CONTACT_TYPES.filter((t) => typeStats[t.value]).map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(typeFilter === t.value ? "all" : t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === t.value
                ? "bg-gray-900 text-white"
                : `${t.color} hover:opacity-80`
            }`}
          >
            {t.label} ({typeStats[t.value]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, phone, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {search || typeFilter !== "all" ? "No contacts match your filters" : "No contacts yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const badge = getTypeBadge(contact.type);
            return (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {contact.companyName && !contact.firstName ? (
                    <Building2 size={18} className="text-gray-400" />
                  ) : (
                    <span className="text-sm font-semibold text-gray-500">
                      {(contact.firstName?.[0] || "").toUpperCase()}
                      {(contact.lastName?.[0] || "").toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {displayName(contact)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    {contact.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail size={10} />
                        {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {formatPhone(contact.phone)}
                      </span>
                    )}
                    {(contact.city || contact.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {[contact.city, contact.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Projects</div>
                    <div className="text-sm font-semibold text-gray-700">{contact.projectCount}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Revenue</div>
                    <div className="text-sm font-semibold text-gray-700">
                      ${Number(contact.totalRevenue).toLocaleString()}
                    </div>
                  </div>
                  {contact.openInvoices > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Open</div>
                      <div className="text-sm font-semibold text-amber-600">
                        {contact.openInvoices} inv
                      </div>
                    </div>
                  )}
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Add Contact Modal ──────────────────────────────────────────

function AddContactModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "homeowner",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    referralSource: "",
    notes: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.firstName && !form.lastName && !form.companyName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Contact</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Optional for homeowners"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                maxLength={2}
                placeholder="TX"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Referral */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referral Source</label>
            <input
              type="text"
              value={form.referralSource}
              onChange={(e) => update("referralSource", e.target.value)}
              placeholder="e.g. Google, Jane Smith, repeat client"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!form.firstName && !form.lastName && !form.companyName)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
