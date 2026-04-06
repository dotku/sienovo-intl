import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const returnTo = req.nextUrl.searchParams.get("state") || "/admin/crm";

  if (!code) {
    return NextResponse.redirect(new URL(`${returnTo}?error=no_code`, req.url));
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/admin/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=token_failed`, req.url)
    );
  }

  const tokens = await tokenRes.json();

  // Store tokens in database
  await prisma.setting.upsert({
    where: { key: "google_access_token" },
    update: { value: tokens.access_token },
    create: { key: "google_access_token", value: tokens.access_token },
  });

  if (tokens.refresh_token) {
    await prisma.setting.upsert({
      where: { key: "google_refresh_token" },
      update: { value: tokens.refresh_token },
      create: { key: "google_refresh_token", value: tokens.refresh_token },
    });
  }

  return NextResponse.redirect(
    new URL(`${returnTo}?google=connected`, req.url)
  );
}
