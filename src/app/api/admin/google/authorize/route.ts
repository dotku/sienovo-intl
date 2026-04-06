import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Capture where the user came from so we can redirect back after auth
  const returnTo = req.nextUrl.searchParams.get("returnTo")
    || req.headers.get("referer")
    || "/admin/crm";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/admin/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
    state: returnTo,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
