import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, leads } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { token, reason } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);

    if (
      !proposal ||
      proposal.acceptanceToken !== token ||
      (proposal.status !== "sent" && proposal.status !== "viewed")
    ) {
      return NextResponse.json(
        { error: "Invalid proposal or token" },
        { status: 401 }
      );
    }

    await db
      .update(proposals)
      .set({
        status: "declined",
        declinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id));

    // Mark linked lead as lost
    if (proposal.leadId) {
      await db
        .update(leads)
        .set({
          status: "lost",
          lostReason: reason || "Proposal declined by client",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, proposal.leadId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error declining proposal:", error);
    return NextResponse.json(
      { error: "Failed to decline proposal" },
      { status: 500 }
    );
  }
}
