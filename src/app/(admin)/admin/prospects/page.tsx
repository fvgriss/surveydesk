import { db } from "@/db";
import { prospects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Phone } from "lucide-react";
import { ProspectsClient } from "./prospects-client";

export default async function ProspectsPage() {
  const salesPhoneNumber = process.env.SUPERADMIN_RETELL_PHONE_NUMBER || null;
  const salesAgentId = process.env.SUPERADMIN_RETELL_AGENT_ID || null;
  const configured = salesPhoneNumber && salesPhoneNumber !== "+1XXXXXXXXXX";

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

  return (
    <>
      {configured && (
        <div className="mx-6 mt-6 mb-0 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
          <Phone size={14} className="text-indigo-600" />
          <p className="text-sm text-indigo-800">
            Sales line: <span className="font-mono font-medium">{salesPhoneNumber}</span>
            {salesAgentId && salesAgentId !== "agent_..." && (
              <span className="text-indigo-500 ml-3 text-xs">Agent: {salesAgentId}</span>
            )}
          </p>
        </div>
      )}
      <ProspectsClient prospects={serialized} />
    </>
  );
}
