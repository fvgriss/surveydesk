import { NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/utils/check-super-admin";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const admin = await checkSuperAdmin();
  if (!admin?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allProspects = await db
    .select()
    .from(prospects)
    .orderBy(desc(prospects.createdAt));

  return NextResponse.json({ prospects: allProspects });
}
