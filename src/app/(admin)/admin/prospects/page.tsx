import { db } from "@/db";
import { prospects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ProspectsClient } from "./prospects-client";

export default async function ProspectsPage() {
  const allProspects = await db
    .select()
    .from(prospects)
    .orderBy(desc(prospects.createdAt));

  const serialized = allProspects.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    followUpSentAt: p.followUpSentAt?.toISOString() || null,
    smsSentAt: p.smsSentAt?.toISOString() || null,
  }));

  return <ProspectsClient prospects={serialized} />;
}
