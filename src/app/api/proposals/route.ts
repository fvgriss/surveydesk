import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { proposals, leads } from "@/db/schema";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["owner", "office_manager"].includes(tenant.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      contactId,
      leadId,
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

    // Validate required fields
    if (!contactId || !propertyAddress || !surveyType || !validUntil) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Calculate totals from lineItems
    const subtotal = lineItems.reduce(
      (sum: number, item: any) => sum + (item.total || 0),
      0
    );
    const total = subtotal;

    const [newProposal] = await db
      .insert(proposals)
      .values({
        tenantId: tenant.tenantId,
        contactId,
        leadId: leadId || undefined,
        propertyAddress,
        surveyType,
        scopeItems: scopeItems || [],
        lineItems: lineItems || [],
        pricingMode: pricingMode || "fixed",
        subtotal: subtotal.toString(),
        total: total.toString(),
        termsAndConditions: termsAndConditions || null,
        validUntil,
        depositRequired: depositRequired || false,
        depositPercent: depositPercent || 50,
        status: "draft",
      })
      .returning();

    return NextResponse.json(newProposal, { status: 201 });
  } catch (error) {
    console.error("Error creating proposal:", error);
    return NextResponse.json(
      { error: "Failed to create proposal" },
      { status: 500 }
    );
  }
}
