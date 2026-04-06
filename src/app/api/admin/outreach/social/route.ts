import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { searchSocialPlatform, type Platform, type SearchType } from "@/lib/social-search";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const body = await req.json();
  const { keywords, platform = "all", type = "keyword", num = 10 } = body as {
    keywords: string;
    platform?: Platform;
    type?: SearchType;
    num?: number;
  };

  if (!keywords) {
    return NextResponse.json({ error: "keywords required" }, { status: 400 });
  }

  const results = await searchSocialPlatform(platform, keywords, type, num);
  return NextResponse.json({ results, total: results.length });
}
