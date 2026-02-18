import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

// GET /api/crews — list all crews
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: crews.id,
      name: crews.name,
      chiefName: crews.chiefName,
      isActive: crews.isActive,
      notes: crews.notes,
      createdAt: crews.createdAt,
    })
    .from(crews)
    .where(eq(crews.tenantId, tenant.tenantId))
    .orderBy(desc(crews.createdAt));

  return NextResponse.json(rows);
}

// POST /api/crews — create a new crew
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, chiefName, notes } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [crew] = await db
    .insert(crews)
    .values({
      tenantId: tenant.tenantId,
      name,
      chiefName: chiefName || null,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(crew, { status: 201 });
}
