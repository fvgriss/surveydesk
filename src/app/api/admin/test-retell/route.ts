import { NextResponse } from "next/server";
import Retell from "retell-sdk";

/**
 * GET /api/admin/test-retell
 *
 * Quick diagnostic: tests whether the Retell API key is valid
 * by making a simple list-agents call.
 */
export async function GET() {
  const apiKey = process.env.RETELL_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      message: "RETELL_API_KEY is not set",
    });
  }

  // Show first/last few chars of the key for debugging
  const keyPreview = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;

  try {
    const retell = new Retell({ apiKey });

    // Simple test: list agents (should return an array even if empty)
    const agents = await retell.agent.list();

    return NextResponse.json({
      status: "ok",
      keyPreview,
      keyLength: apiKey.length,
      agentCount: agents.length,
      agents: agents.slice(0, 3).map((a) => ({
        id: a.agent_id,
        name: a.agent_name,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.constructor.name : "Unknown";

    return NextResponse.json({
      status: "error",
      keyPreview,
      keyLength: apiKey.length,
      errorType: name,
      message,
    });
  }
}
