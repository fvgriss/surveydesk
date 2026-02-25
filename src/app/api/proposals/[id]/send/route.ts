import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { eq, and } from "drizzle-orm";
import { sendProposalEmail } from "@/lib/services/send-proposal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const overrideEmail = body.email as string | undefined;

    // Verify the proposal belongs to this tenant
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenant.tenantId)))
      .limit(1);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const result = await sendProposalEmail(id, overrideEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
    });
  } catch (error) {
    console.error("Error sending proposal:", error);
    return NextResponse.json(
      { error: "Failed to send proposal", detail: String(error) },
      { status: 500 }
    );
  }
}
