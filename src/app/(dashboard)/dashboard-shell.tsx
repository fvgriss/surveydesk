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
  DollarSign,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Bell,
  LogOut,
  FolderOpen,
  Users,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/intake", label: "Intake", icon: Phone },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/billing", label: "Billing", icon: DollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
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
        <div className="p-4 flex items-center gap-2.5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-base tracking-tight">
              SurveyDesk
            </span>
          )}
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
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
        <div className="p-3 border-t border-gray-800 space-y-1">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 text-xs transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={16} />
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
