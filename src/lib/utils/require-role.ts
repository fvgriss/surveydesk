import { NextResponse } from "next/server";

const ADMIN_ROLES = ["owner", "office_manager"];

/**
 * Returns a 403 response if the user's role is not in the allowed list.
 * Returns null if the role is allowed.
 */
export function requireRole(
  role: string,
  allowed: string[]
): NextResponse | null {
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Check if a role is an admin role (owner or office_manager).
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}
