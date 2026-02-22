import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST /api/admin/exit-impersonation
// Clears the impersonation cookie
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("impersonate_tenant");
  return NextResponse.json({ success: true });
}
