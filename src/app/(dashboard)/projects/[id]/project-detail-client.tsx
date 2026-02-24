"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Calendar,
  DollarSign,
  FileText,
  Users,
  MapPin,
  Phone,
  Mail,
  Building2,
  Save,
  Plus,
  Download,
} from "lucide-react";
import { InvoiceForm } from "./invoice-form";
import { PaymentForm } from "./payment-form";

import {
  SURVEY_LABELS_FULL as SURVEY_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS as STATUS_COLORS,
  VISIT_STATUS_COLORS,
  INVOICE_STATUS_COLORS,
  DEFAULT_BADGE,
} from "@/lib/constants";

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

type TaskItem = {
  task: string;
  description: string;
  completed: boolean;
  completedAt?: string;
};

type ProjectData = {
  id: string;
  propertyAddress: string;
  parcelNumber: string | null;
  surveyType: string;
  status: string;
  contractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  taskChecklist: TaskItem[];
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  fieldCompletedAt: string | null;
  deliveredAt: string | null;
};

type ContactData = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

type InvoiceData = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  total: number;
  amountPaid: number;
  dueDate: string;
  sentAt: string | null;
};

type VisitData = {
  id: string;
  scheduledDate: string;
  timeWindow: string;
  status: string;
  crewName: string | null;
  crewChiefName: string | null;
};

const fmt = (v: number) =>
  "$" +
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectDetailClient({
  project: initialProject,
  contact,
  invoices,
  visits,
}: {
  project: ProjectData;
  contact: ContactData;
  invoices: InvoiceData[];
  visits: VisitData[];
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [notes, setNotes] = useState(project.notes || "");
  const [saving, setSaving] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceData | null>(null);

  const completedTasks = project.taskChecklist.filter((t) => t.completed).length;
  const totalTasks = project.taskChecklist.length;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const balance = project.contractValue - project.totalPaid;

  async function updateStatus(newStatus: string) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject((prev) => ({ ...prev, status: updated.status }));
      router.refresh();
    }
  }

  async function toggleTask(index: number) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleTaskIndex: index }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject((prev) => ({
        ...prev,
        taskChecklist: updated.taskChecklist || [],
      }));
    }
  }

  async function saveNotes() {
    setSaving(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject((prev) => ({ ...prev, notes: updated.notes }));
    }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} /> Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin size={18} className="text-blue-500" />
            {project.propertyAddress}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {SURVEY_TYPE_LABELS[project.surveyType] || project.surveyType}
            {project.parcelNumber && ` · Parcel ${project.parcelNumber}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={project.status}
            onChange={(e) => updateStatus(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer ${
              STATUS_COLORS[project.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-5">
          {/* Task Checklist */}
          {totalTasks > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Task Checklist
                </h2>
                <span className="text-xs text-gray-400">
                  {completedTasks} of {totalTasks} complete
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3">
                <div
                  className="h-1.5 bg-blue-500 rounded-full transition-all"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {project.taskChecklist.map((task, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleTask(idx)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2
                        size={16}
                        className="text-emerald-500 mt-0.5 flex-shrink-0"
                      />
                    ) : (
                      <Circle
                        size={16}
                        className="text-gray-300 mt-0.5 flex-shrink-0"
                      />
                    )}
                    <div>
                      <div
                        className={`text-sm ${
                          task.completed
                            ? "text-gray-400 line-through"
                            : "text-gray-800"
                        }`}
                      >
                        {task.task}
                      </div>
                      {task.description && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Field Visits */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                Field Visits
              </h2>
              <Link
                href="/schedule"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View Schedule
              </Link>
            </div>
            {visits.length === 0 ? (
              <p className="text-sm text-gray-400">
                No field visits scheduled yet.
              </p>
            ) : (
              <div className="space-y-2">
                {visits.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {fmtDate(v.scheduledDate)}
                        <span className="text-xs text-gray-400 ml-1.5">
                          ({v.timeWindow.replace("_", " ")})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {v.crewName ? (
                          <span className="flex items-center gap-1">
                            <Users size={10} /> {v.crewName}
                            {v.crewChiefName && ` · ${v.crewChiefName}`}
                          </span>
                        ) : (
                          <span className="text-red-500">No crew assigned</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        VISIT_STATUS_COLORS[v.status] || "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" />
                Invoices
              </h2>
              <button
                onClick={() => setShowInvoiceForm(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={12} />
                Create Invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-400">
                No invoices created yet.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left font-medium pb-2">Invoice #</th>
                    <th className="text-left font-medium pb-2">Type</th>
                    <th className="text-left font-medium pb-2">Status</th>
                    <th className="text-right font-medium pb-2">Total</th>
                    <th className="text-right font-medium pb-2">Due</th>
                    <th className="font-medium pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-gray-100"
                    >
                      <td className="py-2 text-sm font-medium text-gray-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2 text-sm text-gray-500 capitalize">
                        {inv.type}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            INVOICE_STATUS_COLORS[inv.status] ||
                            "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-gray-800 text-right font-medium">
                        {fmt(inv.total)}
                      </td>
                      <td className="py-2 text-xs text-gray-400 text-right">
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="py-2 text-right flex items-center justify-end gap-1">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Download PDF"
                        >
                          <Download size={14} />
                        </a>
                        {["sent", "overdue", "partially_paid", "viewed"].includes(inv.status) && (
                          <button
                            onClick={() => setPaymentInvoice(inv)}
                            className="inline-flex px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add project notes..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">
          {/* Contact card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Client
            </h2>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-800">
                {contact.name}
              </div>
              {contact.company && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Building2 size={12} />
                  {contact.company}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone size={12} />
                  {contact.phone}
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Mail size={12} />
                  {contact.email}
                </div>
              )}
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <DollarSign size={14} className="text-gray-400" />
              Financial Summary
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Contract Value</span>
                <span className="text-sm font-semibold text-gray-900">
                  {fmt(project.contractValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Invoiced</span>
                <span className="text-sm text-gray-600">
                  {fmt(project.totalInvoiced)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Paid</span>
                <span className="text-sm text-emerald-600 font-medium">
                  {fmt(project.totalPaid)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  Balance
                </span>
                <span
                  className={`text-sm font-bold ${
                    balance > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {fmt(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Timeline
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-700">
                  {new Date(project.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {project.startedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Started</span>
                  <span className="text-gray-700">
                    {new Date(project.startedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {project.fieldCompletedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Field Complete</span>
                  <span className="text-gray-700">
                    {new Date(
                      project.fieldCompletedAt
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {project.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivered</span>
                  <span className="text-gray-700">
                    {new Date(project.deliveredAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Form Modal */}
      <InvoiceForm
        open={showInvoiceForm}
        onClose={() => setShowInvoiceForm(false)}
        projectId={project.id}
        projectAddress={project.propertyAddress}
        surveyType={project.surveyType}
        contractValue={project.contractValue}
        contactName={contact.name}
        onCreated={() => router.refresh()}
      />

      {/* Payment Form Modal */}
      {paymentInvoice && (
        <PaymentForm
          open={true}
          onClose={() => setPaymentInvoice(null)}
          invoiceId={paymentInvoice.id}
          invoiceNumber={paymentInvoice.invoiceNumber}
          amountDue={paymentInvoice.total - paymentInvoice.amountPaid}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
