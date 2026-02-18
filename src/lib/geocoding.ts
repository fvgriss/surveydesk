// In-memory geocode cache (persists within a single serverless deployment)
const geocodeCache = new Map<string, { lat: number; lng: number }>();

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Nominatim requires a User-Agent and has a 1 req/sec rate limit
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  const cached = geocodeCache.get(address);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "us",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "SurveyOS/1.0 (survey-scheduling-app)",
      },
    });

    if (!res.ok) {
      console.error(`Nominatim returned ${res.status} for: ${address}`);
      return null;
    }

    const data = await res.json();
    if (data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      geocodeCache.set(address, result);
      return result;
    }
  } catch (err) {
    console.error("Geocoding error for", address, err);
  }

  return null;
}

export async function geocodeBatch(
  addresses: string[]
): Promise<Record<string, { lat: number; lng: number }>> {
  const results: Record<string, { lat: number; lng: number }> = {};

  for (const addr of addresses) {
    const result = await geocodeAddress(addr);
    if (result) {
      results[addr] = result;
    }
    // Nominatim rate limit: 1 request/sec (skip delay if cached)
    if (!geocodeCache.has(addr)) {
      await delay(1100);
    }
  }

  return results;
}
