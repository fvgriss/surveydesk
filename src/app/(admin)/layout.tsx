export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await checkSuperAdmin();

  if (!admin || !admin.isSuperAdmin) {
    redirect("/dashboard");
  }

  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
