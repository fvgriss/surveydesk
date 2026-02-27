import { db } from "@/db";
import { prospects, callLog } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { Phone } from "lucide-react";
import { formatPhone } from "@/lib/utils/format-phone";
import { ProspectsClient } from "./prospects-client";

export default async function ProspectsPage() {
  const salesPhoneNumber = process.env.SUPERADMIN_RETELL_PHONE_NUMBER || null;
  const salesAgentId = process.env.SUPERADMIN_RETELL_AGENT_ID || null;
  const configured = salesPhoneNumber && salesPhoneNumber !== "+1XXXXXXXXXX";

  const allProspects = await db
    .select()
    .from(prospects)
    .orderBy(desc(prospects.createdAt));

  // Fetch call logs for prospects that have a callId
  const callIds = allProspects
    .map((p) => p.callId)
    .filter((id): id is string => !!id);

  const calls = callIds.length > 0
    ? await db
        .select({
          retellCallId: callLog.retellCallId,
          summary: callLog.summary,
          transcript: callLog.transcript,
          recordingUrl: callLog.recordingUrl,
          duration: callLog.duration,
          callerPhone: callLog.callerPhone,
          startedAt: callLog.startedAt,
        })
        .from(callLog)
        .where(inArray(callLog.retellCallId, callIds))
    : [];

  console.log(`[prospects] ${allProspects.length} prospects, ${callIds.length} with callId, ${calls.length} call logs found`);
  if (callIds.length > 0) console.log(`[prospects] callIds:`, callIds);

  const callMap = new Map(calls.map((c) => [c.retellCallId, c]));

  const serialized = allProspects.map((p) => {
    const call = p.callId ? callMap.get(p.callId) : null;
    return {
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      followUpSentAt: p.followUpSentAt?.toISOString() || null,
      smsSentAt: p.smsSentAt?.toISOString() || null,
      call: call ? {
        summary: call.summary,
        transcript: call.transcript,
        recordingUrl: call.recordingUrl,
        duration: call.duration,
        callerPhone: call.callerPhone,
        startedAt: call.startedAt.toISOString(),
      } : null,
    };
  });

  return (
    <>
      {configured && (
        <div className="mx-6 mt-6 mb-0 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
          <Phone size={14} className="text-indigo-600" />
          <p className="text-sm text-indigo-800">
            Sales line: <span className="font-medium">{formatPhone(salesPhoneNumber!)}</span>
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
