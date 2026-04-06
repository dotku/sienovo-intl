import { prisma } from "@/lib/prisma";

export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const tokenSetting = await prisma.setting.findUnique({
      where: { key: "google_access_token" },
    });
    if (!tokenSetting) return null;

    const refreshSetting = await prisma.setting.findUnique({
      where: { key: "google_refresh_token" },
    });

    // Check if token is still valid by checking updatedAt
    // Google access tokens expire after 1 hour
    const tokenAge = Date.now() - tokenSetting.updatedAt.getTime();
    const TOKEN_LIFETIME = 50 * 60 * 1000; // 50 minutes (refresh before expiry)

    if (tokenAge < TOKEN_LIFETIME) {
      return tokenSetting.value;
    }

    // Token likely expired — refresh it
    if (!refreshSetting) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshSetting.value,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("Google token refresh failed:", await res.text());
      return null;
    }

    const data = await res.json();
    await prisma.setting.upsert({
      where: { key: "google_access_token" },
      update: { value: data.access_token },
      create: { key: "google_access_token", value: data.access_token },
    });

    return data.access_token;
  } catch (err) {
    console.error("getGoogleAccessToken error:", err);
    return null;
  }
}
