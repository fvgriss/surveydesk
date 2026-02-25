"use client";

import { Plus, Send, Eye, CheckCircle2, XCircle, MoreVertical, FileText, TrendingUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Proposal = {
  id: string;
  propertyAddress: string;
  surveyType: string;
  status: string;
  total: number;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  validUntil: string;
  createdAt: string;
  contactName: string;
  contactCompany: string | null;
};

import {
  SURVEY_LABELS as surveyLabel,
  SURVEY_COLORS as surveyColor,
  PROPOSAL_STATUS_COLORS as statusColor,
  DEFAULT_BADGE,
} from "@/lib/constants";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || "bg-gray-50 text-gray-600 border-gray-200"}`}>{children}</span>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProposalsClient({ proposals }: { proposals: Proposal[] }) {
  const router = useRouter();

  async function handleDeleteProposal(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm("Delete this draft proposal?")) return;
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("Failed to delete proposal");
    } catch {
      alert("Network error");
    }
  }
  const drafts = proposals.filter((p) => p.status === "draft");
  const sent = proposals.filter((p) => p.status === "sent" || p.status === "viewed");
  const accepted = proposals.filter((p) => p.status === "accepted");
  const sentValue = sent.reduce((s, p) => s + p.total, 0);
  const acceptedValue = accepted.reduce((s, p) => s + p.total, 0);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Proposals &amp; Bids</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create, send, and track survey proposals.</p>
        </div>
        <Link href="/proposals/new" className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
          <Plus size={14} />New Proposal
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { icon: FileText, label: "Draft", value: String(drafts.length), sub: `$${drafts.reduce((s, p) => s + p.total, 0).toLocaleString()}` },
          { icon: Send, label: "Out for Review", value: String(sent.length), sub: `$${sentValue.toLocaleString()}` },
          { icon: CheckCircle2, label: "Accepted", value: String(accepted.length), sub: `$${acceptedValue.toLocaleString()}` },
          { icon: TrendingUp, label: "Win Rate", value: proposals.length ? `${Math.round((accepted.length / proposals.length) * 100)}%` : "0%", sub: `${accepted.length} of ${proposals.length}` },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="p-2 rounded-lg bg-gray-50 w-fit"><stat.icon size={18} className="text-gray-500" /></div>
            <div className="mt-3">
              <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Client", "Property", "Type", "Total", "Status", "Sent", ""].map((h) => (
                <th key={h} className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposals.map((prop) => (
                <tr key={prop.id} onClick={() => router.push(`/proposals/${prop.id}`)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-800">{prop.contactName}</div>
                    {prop.contactCompany && <div className="text-xs text-gray-400">{prop.contactCompany}</div>}
                  </td>
                  <td className="px-4 py-3"><div className="text-sm text-gray-600 max-w-48 truncate">{prop.propertyAddress}</div></td>
                  <td className="px-4 py-3">
                    <Badge className={surveyColor[prop.surveyType] || ""}>{surveyLabel[prop.surveyType] || prop.surveyType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">${prop.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusColor[prop.status] || ""}>{prop.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(prop.sentAt)}</td>
                  <td className="px-4 py-3">
                    {prop.status === "draft" && (
                      <button
                        onClick={(e) => handleDeleteProposal(e, prop.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
