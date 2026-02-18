import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/utils/get-tenant";
import { createOAuth2Client, GMAIL_SCOPES } from "@/lib/gmail/client";

/**
 * GET /api/gmail/auth
 *
 * Redirects the user to Google's OAuth consent screen.
 * After authorization, Google redirects back to /api/gmail/callback.
 */
export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    const oauth2Client = createOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // get refresh token
      prompt: "consent", // always show consent to get refresh token
      scope: GMAIL_SCOPES,
      state: tenant.tenantId, // pass tenant ID through OAuth flow
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Gmail auth GET /api/gmail/auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Gmail authentication" },
      { status: 500 }
    );
  }
}
