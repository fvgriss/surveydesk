"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Home,
  Phone,
  FileText,
  Calendar,
  Mail,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Bell,
  LogOut,
  FolderOpen,
  Users,
  Settings,
  CreditCard,
} from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";

const ADMIN_ROLES = ["owner", "office_manager"];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Home, roles: ADMIN_ROLES },
  { href: "/intake", label: "Intake", icon: Phone, roles: ADMIN_ROLES },
  { href: "/inbox", label: "Inbox", icon: Mail, roles: ADMIN_ROLES },
  { href: "/proposals", label: "Proposals", icon: FileText, roles: ADMIN_ROLES },
  { href: "/projects", label: "Projects", icon: FolderOpen, roles: ["owner", "office_manager", "crew_chief", "instrument_person"] },
  { href: "/schedule", label: "Schedule", icon: Calendar, roles: ["owner", "office_manager", "crew_chief", "instrument_person"] },
  { href: "/contacts", label: "Contacts", icon: Users, roles: [...ADMIN_ROLES, "crew_chief"] },
  { href: "/billing", label: "Billing", icon: DollarSign, roles: ADMIN_ROLES },
];

const BOTTOM_NAV_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings, roles: ADMIN_ROLES },
  { href: "/subscription", label: "Subscription", icon: CreditCard, roles: ["owner", "office_manager"] },
];


export function DashboardShell({
  user,
  children,
  firmName,
  retellPhoneNumber,
  isImpersonating,
  role = "owner",
}: {
  user: User;
  children: React.ReactNode;
  firmName?: string | null;
  isImpersonating?: boolean;
  retellPhoneNumber?: string | null;
  role?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleExitImpersonation = async () => {
    await fetch("/api/admin/exit-impersonation", { method: "POST" });
    window.location.href = "/admin/tenants";
  };

  const initials = user.email
    ? user.email
        .split("@")[0]
        .split(".")
        .map((p) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 bottom-0 bg-gray-900 text-white transition-all duration-200 z-40 flex flex-col ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-white" />
            </div>
            {!collapsed && (
              <span className="font-bold text-base tracking-tight">
                SurveyDesk
              </span>
            )}
          </div>
          {!collapsed && (firmName || retellPhoneNumber) && (
            <div className="mt-2.5 pl-[42px]">
              {firmName && (
                <p className="text-sm font-medium text-gray-300 truncate">
                  {firmName}
                </p>
              )}
              {retellPhoneNumber && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Phone size={11} className="flex-shrink-0" />
                  {formatPhone(retellPhoneNumber)}
                </p>
              )}
            </div>
          )}
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 pb-1 border-t border-gray-800 pt-2 space-y-0.5">
          {BOTTOM_NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-sm transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-xs transition-colors"
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-200 ${
          collapsed ? "ml-16" : "ml-56"
        }`}
      >
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              Viewing as: {firmName || "Unknown tenant"}
            </span>
            <button
              onClick={handleExitImpersonation}
              className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-3 py-1 rounded transition-colors"
            >
              Exit impersonation
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-end py-3 px-6 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
              {initials}
            </div>
          </div>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
