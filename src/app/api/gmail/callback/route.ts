import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createOAuth2Client } from "@/lib/gmail/client";

/**
 * GET /api/gmail/callback
 *
 * Google redirects here after the user authorizes.
 * Exchanges the auth code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tenantId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/settings?gmail=denied", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  if (!code || !tenantId) {
    return NextResponse.redirect(
      new URL("/settings?gmail=error", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's email address
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const accountEmail = userInfo.email || "unknown";

    // Upsert the integration record
    const [existing] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, "gmail")
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: tokens.access_token || null,
          refreshToken: tokens.refresh_token || null,
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          accountEmail,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        provider: "gmail",
        accessToken: tokens.access_token || null,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountEmail,
        isActive: true,
      });
    }

    console.log(`[Gmail] Connected account ${accountEmail} for tenant ${tenantId}`);

    return NextResponse.redirect(
      new URL("/settings?gmail=connected", process.env.NEXT_PUBLIC_APP_URL!)
    );
  } catch (err) {
    console.error("[Gmail callback] Error:", err);
    return NextResponse.redirect(
      new URL("/settings?gmail=error", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
