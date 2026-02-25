import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, proposals } from "@/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [lead] = await db
      .select({ id: leads.id, status: leads.status })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenant.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status !== "lost" && lead.status !== "expired") {
      return NextResponse.json(
        { error: "Can only delete lost or expired leads" },
        { status: 400 }
      );
    }

    // Check for active proposals linked to this lead
    const activeProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.leadId, id),
          notInArray(proposals.status, ["declined", "expired"])
        )
      )
      .limit(1);

    if (activeProposals.length > 0) {
      return NextResponse.json(
        { error: "Lead has active proposals and cannot be deleted" },
        { status: 409 }
      );
    }

    await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenant.tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
