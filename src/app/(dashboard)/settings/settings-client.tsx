"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  FileText,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Shield,
  Link,
  Mail,
  Unlink,
  Phone,
  Bell,
  BellOff,
  UserPlus,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";

type Firm = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  plsLicenseNumber: string | null;
  plsLicenseState: string | null;
  insuranceInfo: string | null;
  serviceAreaCounties: string | null;
  logoUrl: string | null;
  defaultSurveyTypes: string[] | null;
  proposalTerms: string | null;
  invoiceNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Crew = {
  id: string;
  name: string;
  chiefName: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
};

type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  createdAt: string;
};

const SURVEY_TYPES = [
  { value: "boundary", label: "Boundary" },
  { value: "alta", label: "ALTA/NSPS" },
  { value: "topographic", label: "Topographic" },
  { value: "as_built", label: "As-Built" },
  { value: "subdivision", label: "Subdivision" },
  { value: "construction", label: "Construction" },
  { value: "elevation_cert", label: "Elevation Certificate" },
  { value: "route", label: "Route" },
  { value: "other", label: "Other" },
];

type GmailStatus = {
  accountEmail: string;
  isActive: boolean;
  lastSyncAt: string | null;
} | null;

const TABS = [
  { id: "firm", label: "Firm Profile", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "defaults", label: "Defaults & Templates", icon: FileText },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Link },
];

type NotificationPrefs = {
  smsNotifications: boolean;
  emailNotifications: boolean;
};

export function SettingsClient({
  firm,
  crews: initialCrews,
  teamMembers: initialMembers,
  userRole,
  gmail,
  retellPhone,
  subscriptionStatus,
  notificationPrefs,
}: {
  firm: Firm;
  crews: Crew[];
  teamMembers: TeamMember[];
  userRole: string;
  gmail: GmailStatus;
  retellPhone: string | null;
  subscriptionStatus: string;
  notificationPrefs: NotificationPrefs;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("firm");

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your firm profile, crews, and default templates.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "firm" && <FirmProfileTab firm={firm} />}
      {activeTab === "team" && (
        <TeamTab members={initialMembers} crews={initialCrews} userRole={userRole} />
      )}
      {activeTab === "defaults" && <DefaultsTab firm={firm} />}
      {activeTab === "notifications" && <NotificationsTab prefs={notificationPrefs} />}
      {activeTab === "integrations" && <IntegrationsTab gmail={gmail} retellPhone={retellPhone} subscriptionStatus={subscriptionStatus} />}
    </div>
  );
}

// ─── Firm Profile Tab ───────────────────────────────────────────

function FirmProfileTab({ firm }: { firm: Firm }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: firm.name || "",
    phone: firm.phone || "",
    email: firm.email || "",
    address: firm.address || "",
    city: firm.city || "",
    state: firm.state || "",
    zip: firm.zip || "",
    plsLicenseNumber: firm.plsLicenseNumber || "",
    plsLicenseState: firm.plsLicenseState || "",
    insuranceInfo: firm.insuranceInfo || "",
    serviceAreaCounties: firm.serviceAreaCounties || "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Business info */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Business Information</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Firm Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">ZIP</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Professional info */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Professional Credentials</h2>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PLS License Number</label>
              <input
                type="text"
                value={form.plsLicenseNumber}
                onChange={(e) => update("plsLicenseNumber", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">License State</label>
              <input
                type="text"
                value={form.plsLicenseState}
                onChange={(e) => update("plsLicenseState", e.target.value)}
                maxLength={2}
                placeholder="TX"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Insurance Info</label>
            <textarea
              value={form.insuranceInfo}
              onChange={(e) => update("insuranceInfo", e.target.value)}
              rows={2}
              placeholder="e.g. E&O policy number, provider"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Area Counties</label>
            <input
              type="text"
              value={form.serviceAreaCounties}
              onChange={(e) => update("serviceAreaCounties", e.target.value)}
              placeholder="e.g. Travis, Williamson, Hays"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saved ? (
            <>
              <Check size={14} />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <Save size={14} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Team Tab ───────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  office_manager: "Office Manager",
  crew_chief: "Crew Chief",
  instrument_person: "Instrument Person",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-blue-50 text-blue-700",
  office_manager: "bg-purple-50 text-purple-700",
  crew_chief: "bg-emerald-50 text-emerald-700",
  instrument_person: "bg-amber-50 text-amber-700",
};

function TeamTab({
  members,
  crews,
  userRole,
}: {
  members: TeamMember[];
  crews: Crew[];
  userRole: string;
}) {
  return (
    <div className="space-y-8">
      <MembersSection members={members} userRole={userRole} />
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Crews</h2>
        <CrewsSection crews={crews} />
      </div>
    </div>
  );
}

// ─── Members Section ────────────────────────────────────────────

function MembersSection({
  members,
  userRole,
}: {
  members: TeamMember[];
  userRole: string;
}) {
  const router = useRouter();
  const isOwner = userRole === "owner";
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("instrument_person");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRole) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite");
      }
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("instrument_person");
      router.refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setInviting(false);
    }
  }

  function startEdit(member: TeamMember) {
    setEditingId(member.id);
    setEditName(member.fullName);
    setEditPhone(member.phone || "");
    setEditRole(member.role);
  }

  async function handleSaveEdit(id: string) {
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: editName.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    }
  }

  const [optimisticNotifs, setOptimisticNotifs] = useState<Record<string, boolean>>({});

  async function handleToggleNotifications(member: TeamMember) {
    const newValue = !(optimisticNotifs[member.id] ?? member.emailNotifications);
    setOptimisticNotifs((prev) => ({ ...prev, [member.id]: newValue }));
    await fetch(`/api/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailNotifications: newValue,
        smsNotifications: newValue,
      }),
    });
    router.refresh();
  }

  async function handleToggleActive(member: TeamMember) {
    await fetch(`/api/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !member.isActive }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this team member? This will delete their account.")) return;
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Members</h2>
          <p className="text-xs text-gray-500 mt-0.5">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Invite Team Member</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="office_manager">Office Manager</option>
                <option value="crew_chief">Crew Chief</option>
                <option value="instrument_person">Instrument Person</option>
              </select>
            </div>
            {inviteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowInvite(false); setInviteName(""); setInviteEmail(""); setInviteRole("instrument_person"); setInviteError(null); }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteName.trim() || !inviteEmail.trim() || inviting}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {inviting ? "Sending Invite..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="space-y-2">
        {members.map((member) => {
          const isEditing = editingId === member.id;
          const isSelf = member.role === "owner";

          return (
            <div
              key={member.id}
              className={`bg-white border rounded-xl px-4 py-3 ${
                member.isActive ? "border-gray-100" : "border-gray-100 opacity-60"
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        disabled={member.role === "owner"}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50"
                      >
                        {member.role === "owner" && <option value="owner">Owner</option>}
                        <option value="office_manager">Office Manager</option>
                        <option value="crew_chief">Crew Chief</option>
                        <option value="instrument_person">Instrument Person</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={() => handleSaveEdit(member.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{member.fullName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_BADGE[member.role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABEL[member.role] || member.role}
                      </span>
                      {!member.isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{member.email}{member.phone ? ` · ${formatPhone(member.phone)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwner && (() => {
                      const notifOn = optimisticNotifs[member.id] ?? member.emailNotifications;
                      return (
                        <button
                          onClick={() => handleToggleNotifications(member)}
                          title={notifOn ? "Receiving lead notifications" : "Not receiving lead notifications"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            notifOn
                              ? "text-blue-500 hover:bg-blue-50"
                              : "text-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          {notifOn ? <Bell size={13} /> : <BellOff size={13} />}
                        </button>
                      );
                    })()}
                    {isOwner && !isSelf && (
                      <>
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                          member.isActive
                            ? "text-amber-600 hover:bg-amber-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {member.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => startEdit(member)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Crews Section ──────────────────────────────────────────────

function CrewsSection({
  crews,
}: {
  crews: Crew[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newChiefName, setNewChiefName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editName, setEditName] = useState("");
  const [editChiefName, setEditChiefName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  async function handleAddCrew() {
    if (!newName.trim()) return;
    const res = await fetch("/api/crews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        chiefName: newChiefName.trim() || null,
        notes: newNotes || null,
      }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewName("");
      setNewChiefName("");
      setNewNotes("");
      router.refresh();
    }
  }

  function startEdit(crew: Crew) {
    setEditingId(crew.id);
    setEditName(crew.name);
    setEditChiefName(crew.chiefName || "");
    setEditNotes(crew.notes || "");
  }

  async function handleSaveEdit(id: string) {
    const res = await fetch(`/api/crews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        chiefName: editChiefName.trim() || null,
        notes: editNotes || null,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    }
  }

  async function handleToggleActive(crew: Crew) {
    await fetch(`/api/crews/${crew.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !crew.isActive }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this crew? This cannot be undone.")) return;
    await fetch(`/api/crews/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{crews.length} crew{crews.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Crew
        </button>
      </div>

      {/* Add crew form */}
      {showAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Crew</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Crew Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='e.g. "Crew A"'
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Crew Chief</label>
                <input
                  type="text"
                  value={newChiefName}
                  onChange={(e) => setNewChiefName(e.target.value)}
                  placeholder="e.g. Mike Rodriguez"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAdd(false); setNewName(""); setNewChiefName(""); setNewNotes(""); }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCrew}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Add Crew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crew list */}
      {crews.length === 0 && !showAdd ? (
        <div className="text-center py-10 text-gray-400">
          <Users size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No crews yet — add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {crews.map((crew) => {
            const isEditing = editingId === crew.id;

            return (
              <div
                key={crew.id}
                className={`bg-white border rounded-xl px-4 py-3 ${
                  crew.isActive ? "border-gray-100" : "border-gray-100 opacity-60"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Crew Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Crew Chief</label>
                        <input
                          type="text"
                          value={editChiefName}
                          onChange={(e) => setEditChiefName(e.target.value)}
                          placeholder="e.g. Mike Rodriguez"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                      <button onClick={() => handleSaveEdit(crew.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{crew.name}</span>
                        {!crew.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {crew.chiefName ? `Chief: ${crew.chiefName}` : "No chief assigned"}
                        {crew.notes && <span className="ml-2 text-gray-400">· {crew.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(crew)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                          crew.isActive
                            ? "text-amber-600 hover:bg-amber-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {crew.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => startEdit(crew)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(crew.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Defaults & Templates Tab ───────────────────────────────────

function DefaultsTab({ firm }: { firm: Firm }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    firm.defaultSurveyTypes || []
  );
  const [proposalTerms, setProposalTerms] = useState(firm.proposalTerms || "");
  const [invoiceNotes, setInvoiceNotes] = useState(firm.invoiceNotes || "");

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultSurveyTypes: selectedTypes,
          proposalTerms,
          invoiceNotes,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Survey types */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Default Survey Types</h2>
        <p className="text-xs text-gray-500 mb-4">
          Select the survey types your firm offers. These appear in proposals and intake.
        </p>
        <div className="flex flex-wrap gap-2">
          {SURVEY_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => toggleType(st.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedTypes.includes(st.value)
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {selectedTypes.includes(st.value) && <Check size={10} className="inline mr-1" />}
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Proposal terms */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Default Proposal Terms</h2>
        <p className="text-xs text-gray-500 mb-3">
          These terms appear at the bottom of every proposal you send.
        </p>
        <textarea
          value={proposalTerms}
          onChange={(e) => { setProposalTerms(e.target.value); setSaved(false); }}
          rows={5}
          placeholder="e.g. Payment is due upon receipt. Survey is valid for 90 days..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Invoice notes */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Default Invoice Footer</h2>
        <p className="text-xs text-gray-500 mb-3">
          This text appears at the bottom of every invoice.
        </p>
        <textarea
          value={invoiceNotes}
          onChange={(e) => { setInvoiceNotes(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="e.g. Thank you for your business. Please make checks payable to..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saved ? (
            <>
              <Check size={14} />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <Save size={14} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Notifications Tab ──────────────────────────────────────────

function NotificationsTab({ prefs }: { prefs: NotificationPrefs }) {
  const router = useRouter();
  const [emailOn, setEmailOn] = useState(prefs.emailNotifications);
  const [smsOn, setSmsOn] = useState(prefs.smsNotifications);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleToggle(field: "emailNotifications" | "smsNotifications", value: boolean) {
    if (field === "emailNotifications") setEmailOn(value);
    else setSmsOn(value);
    setSaved(false);

    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Lead Notifications</h2>
        <p className="text-xs text-gray-500 mb-5">
          Get notified when a new lead comes in from a phone call or email.
        </p>

        <div className="space-y-4">
          {/* Email toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Mail size={16} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Email notifications</p>
                <p className="text-xs text-gray-500">Receive an email for each new lead</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("emailNotifications", !emailOn)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailOn ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailOn ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* SMS toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Phone size={16} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">SMS notifications</p>
                <p className="text-xs text-gray-500">Receive a text message for each new lead</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("smsNotifications", !smsOn)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                smsOn ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  smsOn ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {saved && (
          <p className="text-xs text-green-600 mt-4 flex items-center gap-1">
            <Check size={12} /> Saved
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Weekly Digest</h2>
        <p className="text-xs text-gray-500">
          A summary of your week&rsquo;s activity is sent every Monday morning when email notifications are enabled.
        </p>
      </div>
    </div>
  );
}

// ─── Integrations Tab ───────────────────────────────────────────

function IntegrationsTab({ gmail, retellPhone, subscriptionStatus }: { gmail: GmailStatus; retellPhone: string | null; subscriptionStatus: string }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleProvisionPhone() {
    setProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch("/api/provision-phone", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Provisioning failed");
      router.refresh();
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Retell AI Phone */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Phone size={20} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Phone Agent</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                AI-powered phone number that answers calls and captures leads.
              </p>
            </div>
          </div>

          {retellPhone ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          ) : subscriptionStatus === "active" ? (
            <button
              onClick={handleProvisionPhone}
              disabled={provisioning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Phone size={12} />
              {provisioning ? "Activating..." : "Activate Phone"}
            </button>
          ) : (
            <span className="text-xs text-gray-400">Requires subscription</span>
          )}
        </div>

        {retellPhone && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Phone Number</span>
            <p className="text-lg font-semibold text-gray-900 mt-0.5 font-mono">{formatPhone(retellPhone)}</p>
          </div>
        )}

        {provisionError && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {provisionError}
          </div>
        )}
      </div>

      {/* Gmail */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <Mail size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Gmail</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Sync your Gmail inbox and use AI to triage survey requests.
              </p>
            </div>
          </div>

          {gmail?.isActive ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Unlink size={12} />
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/gmail/auth"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Link size={12} />
              Connect Gmail
            </a>
          )}
        </div>

        {gmail?.isActive && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Account</span>
                <p className="text-gray-700 mt-0.5">{gmail.accountEmail}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Synced</span>
                <p className="text-gray-700 mt-0.5">
                  {gmail.lastSyncAt ? new Date(gmail.lastSyncAt).toLocaleString() : "Never"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Go to the Inbox page and click &ldquo;Sync Now&rdquo; to pull in recent emails.
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 text-center">
        <p className="text-sm text-gray-400">
          More integrations coming soon — QuickBooks, Google Calendar, and more.
        </p>
      </div>
    </div>
  );
}
