import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/inbox/[emailId]/dismiss
 *
 * Marks an inbox email as dismissed (not relevant).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["owner", "office_manager"].includes(tenant.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { emailId } = await params;

    const [email] = await db
      .select({ id: emailLog.id })
      .from(emailLog)
      .where(and(eq(emailLog.id, emailId), eq(emailLog.tenantId, tenant.tenantId)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    await db
      .update(emailLog)
      .set({ emailStatus: "dismissed" })
      .where(eq(emailLog.id, emailId));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[inbox/dismiss] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
