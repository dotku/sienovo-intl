/**
 * Durable Google Drive access via the shared service account.
 *
 * Unlike the per-user OAuth flow in `google-token.ts` — whose refresh token
 * expires (7 days while the consent screen is in "Testing"), requiring a
 * human to re-authorize — a service account mints its own short-lived access
 * tokens from a private key indefinitely. No interactive consent, no re-auth.
 *
 * Setup: share the target Drive folder with the service account's
 * `client_email` (Viewer is enough). Reuses the same `GA_SERVICE_ACCOUNT_KEY`
 * JSON already used for Google Analytics.
 *
 * Returns null when the key is unset/invalid so callers can fall back to the
 * user-OAuth path and degrade gracefully.
 */

import { JWT } from "google-auth-library";
import { getGoogleAccessToken } from "@/lib/google-token";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type DriveTokenSource = "service_account" | "oauth";

let cached: { token: string; exp: number } | null = null;

export async function getDriveServiceToken(): Promise<string | null> {
  // Reuse a cached token until ~5 min before expiry to avoid re-signing on
  // every request (tokens are valid ~1h).
  if (cached && cached.exp - Date.now() > 5 * 60 * 1000) return cached.token;

  const raw = process.env.GA_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const credentials = JSON.parse(raw);
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [DRIVE_SCOPE],
    });
    const { access_token } = await client.authorize();
    if (!access_token) return null;

    cached = {
      token: access_token,
      exp: client.credentials.expiry_date || Date.now() + 55 * 60 * 1000,
    };
    return access_token;
  } catch (err) {
    console.error("[drive-sa] failed to mint service-account token:", err);
    return null;
  }
}

/**
 * Unified Drive token: prefer the durable service account (used by the daily
 * cron and any unattended sync), fall back to the per-user OAuth token (used
 * for manual imports where an admin authorized their own account / a folder
 * only shared with them). Returns null when neither is available so the caller
 * can prompt for re-auth.
 */
export async function getDriveAccessToken(): Promise<{
  token: string;
  source: DriveTokenSource;
} | null> {
  const sa = await getDriveServiceToken();
  if (sa) return { token: sa, source: "service_account" };

  const oauth = await getGoogleAccessToken();
  if (oauth) return { token: oauth, source: "oauth" };

  return null;
}
