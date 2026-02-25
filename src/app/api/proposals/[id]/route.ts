import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenant.tenantId)))
      .limit(1);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const {
      propertyAddress,
      surveyType,
      scopeItems,
      lineItems,
      pricingMode,
      termsAndConditions,
      validUntil,
      depositRequired,
      depositPercent,
    } = body;

    // Fetch the existing proposal
    const [existingProposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenant.tenantId)))
      .limit(1);

    if (!existingProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Only allow updates on draft proposals
    if (existingProposal.status !== "draft") {
      return NextResponse.json(
        { error: "Can only update draft proposals" },
        { status: 400 }
      );
    }

    // Calculate totals from lineItems
    const subtotal = lineItems.reduce(
      (sum: number, item: any) => sum + (item.total || 0),
      0
    );
    const total = subtotal;

    const [updatedProposal] = await db
      .update(proposals)
      .set({
        propertyAddress: propertyAddress || existingProposal.propertyAddress,
        surveyType: surveyType || existingProposal.surveyType,
        scopeItems: scopeItems || existingProposal.scopeItems,
        lineItems: lineItems || existingProposal.lineItems,
        pricingMode: pricingMode || existingProposal.pricingMode,
        subtotal: subtotal.toString(),
        total: total.toString(),
        termsAndConditions:
          termsAndConditions || existingProposal.termsAndConditions,
        validUntil: validUntil || existingProposal.validUntil,
        depositRequired:
          depositRequired !== undefined
            ? depositRequired
            : existingProposal.depositRequired,
        depositPercent:
          depositPercent || existingProposal.depositPercent,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    return NextResponse.json(updatedProposal);
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json(
      { error: "Failed to update proposal" },
      { status: 500 }
    );
  }
}

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

    const [proposal] = await db
      .select({ id: proposals.id, status: proposals.status })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.tenantId, tenant.tenantId)))
      .limit(1);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== "draft") {
      return NextResponse.json(
        { error: "Can only delete draft proposals" },
        { status: 400 }
      );
    }

    await db.delete(proposals).where(eq(proposals.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json(
      { error: "Failed to delete proposal" },
      { status: 500 }
    );
  }
}
