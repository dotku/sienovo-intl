import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { enrichCompany } from "@/lib/apollo";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const name = req.nextUrl.searchParams.get("name");
  const website = req.nextUrl.searchParams.get("website");

  if (!name && !website) {
    return NextResponse.json({ error: "Name or website is required" }, { status: 400 });
  }

  const enrichment = await enrichCompany({
    name: name || undefined,
    website: website || undefined,
  });

  return NextResponse.json({ enrichment: enrichment || null });
}
