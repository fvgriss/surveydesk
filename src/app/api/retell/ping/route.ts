import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/retell/ping — simple health check (no auth, no DB)
 */
export async function GET() {
  return NextResponse.json({ pong: true, ts: Date.now() });
}

/**
 * POST /api/retell/ping — echoes back the body so you can test
 * that POST requests actually reach Vercel.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  console.log("[Retell ping] POST received, body length:", body.length);
  return NextResponse.json({
    received: true,
    bodyLength: body.length,
    ts: Date.now(),
  });
}
