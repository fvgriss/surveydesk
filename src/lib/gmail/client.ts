import { google } from "googleapis";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Create a Gmail OAuth2 client with the app's credentials.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  );
}

/**
 * Get an authenticated Gmail client for a tenant.
 * Handles token refresh automatically.
 */
export async function getGmailClient(tenantId: string) {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.provider, "gmail"),
        eq(integrations.isActive, true)
      )
    )
    .limit(1);

  if (!integration || !integration.accessToken) {
    return null;
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiry?.getTime(),
  });

  // Auto-refresh expired tokens
  oauth2Client.on("tokens", async (tokens) => {
    await db
      .update(integrations)
      .set({
        accessToken: tokens.access_token || integration.accessToken,
        refreshToken: tokens.refresh_token || integration.refreshToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Gmail scopes we need:
 * - readonly: read emails
 * - modify: mark as read (optional)
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];
