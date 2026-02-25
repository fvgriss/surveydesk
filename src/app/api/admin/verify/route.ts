import { NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";

export async function GET() {
  const admin = await checkSuperAdmin();

  if (!admin) {
    return NextResponse.json({ isSuperAdmin: false });
  }

  return NextResponse.json({ isSuperAdmin: admin.isSuperAdmin });
}
