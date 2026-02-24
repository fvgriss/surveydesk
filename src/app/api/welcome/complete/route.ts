import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentTenant } from "@/lib/utils/get-tenant";

export async function POST() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db
      .update(users)
      .set({ welcomeComplete: true, updatedAt: new Date() })
      .where(eq(users.id, tenant.userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing welcome:", error);
    return NextResponse.json(
      { error: "Failed to complete welcome" },
      { status: 500 }
    );
  }
}
