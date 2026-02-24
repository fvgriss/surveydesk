import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, leads, projects, contacts } from "@/db/schema";
import { notifyTeamProposalAccepted } from "@/lib/services/notify-owner";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { token, name, email } = body;

    if (!token || !name || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch proposal and validate token
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

    // Get client IP address
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Update proposal status to accepted
    const [updatedProposal] = await db
      .update(proposals)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByName: name,
        acceptedByEmail: email,
        acceptedByIp: ip,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    // Update linked lead status to "won" if applicable
    if (proposal.leadId) {
      await db
        .update(leads)
        .set({
          status: "won",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, proposal.leadId));
    }

    // Auto-create project from accepted proposal
    const taskChecklist = (proposal.scopeItems || []).map(
      (item: { task: string; description: string; included: boolean }) => ({
        task: item.task,
        description: item.description,
        completed: false,
      })
    );

    const [newProject] = await db
      .insert(projects)
      .values({
        tenantId: proposal.tenantId,
        proposalId: proposal.id,
        leadId: proposal.leadId,
        contactId: proposal.contactId,
        propertyAddress: proposal.propertyAddress,
        parcelNumber: proposal.parcelNumber,
        surveyType: proposal.surveyType,
        status: "pending",
        contractValue: proposal.total,
        taskChecklist,
        documents: [],
      })
      .returning();

    console.log(
      `[accept] Created project ${newProject.id} from proposal ${proposal.id}`
    );

    // Notify team about accepted proposal
    const [contact] = await db
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, proposal.contactId))
      .limit(1);

    notifyTeamProposalAccepted(proposal.tenantId, {
      clientName: [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || name,
      propertyAddress: proposal.propertyAddress,
      surveyType: proposal.surveyType,
      contractValue: proposal.total,
    });

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      project: newProject,
    });
  } catch (error) {
    console.error("Error accepting proposal:", error);
    return NextResponse.json(
      { error: "Failed to accept proposal" },
      { status: 500 }
    );
  }
}
