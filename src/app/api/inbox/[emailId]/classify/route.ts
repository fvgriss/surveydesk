import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { db } from "@/db";
import { emailLog, projects } from "@/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import { classifyEmail } from "@/lib/services/classify-email";

/**
 * POST /api/inbox/[emailId]/classify
 *
 * Re-runs AI classification on a single email (manual retry).
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
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.id, emailId), eq(emailLog.tenantId, tenant.tenantId)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Fetch active projects for matching
    const activeProjects = await db
      .select({
        id: projects.id,
        propertyAddress: projects.propertyAddress,
        surveyType: projects.surveyType,
      })
      .from(projects)
      .where(
        and(
          eq(projects.tenantId, tenant.tenantId),
          notInArray(projects.status, ["closed"])
        )
      );

    const result = await classifyEmail({
      subject: email.subject || "",
      bodyPreview: email.bodyPreview || "",
      bodyFull: email.bodyFull || "",
      fromEmail: email.from || "",
      fromName: email.fromName || "",
      activeProjects: activeProjects.map((p) => ({
        id: p.id,
        propertyAddress: p.propertyAddress,
        surveyType: p.surveyType,
      })),
    });

    if (!result) {
      return NextResponse.json({ error: "Classification failed" }, { status: 500 });
    }

    await db
      .update(emailLog)
      .set({
        aiClassification: result.classification,
        aiSuggestion: result,
      })
      .where(eq(emailLog.id, emailId));

    return NextResponse.json({ success: true, classification: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[inbox/classify] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
