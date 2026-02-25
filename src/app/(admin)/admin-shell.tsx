"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  ArrowLeft,
  LogOut,
  Shield,
} from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/prospects", label: "Sales", icon: Megaphone },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-56 bg-slate-950 text-white z-40 flex flex-col">
        <div className="p-4 flex items-center gap-2.5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block leading-tight">
              SurveyDesk
            </span>
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-amber-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <item.icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className="px-3 py-1.5 text-xs text-slate-500 truncate">
            {email}
          </div>
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xs transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to App</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xs transition-colors"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-56">
        {/* Top bar */}
        <div className="flex items-center justify-between py-3 px-6 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
