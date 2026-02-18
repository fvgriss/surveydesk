import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { geocodeBatch } from "@/lib/geocoding";

// POST /api/schedule/geocode — geocode a batch of addresses
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { addresses } = body as { addresses: string[] };

  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json(
      { error: "Must provide addresses array" },
      { status: 400 }
    );
  }

  // Cap at 20 addresses per request to avoid long-running requests
  const capped = addresses.slice(0, 20);

  const results = await geocodeBatch(capped);

  return NextResponse.json(results);
}
