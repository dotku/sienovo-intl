import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { enrichContact } from "@/lib/apollo";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email") || undefined;
  const firstName = req.nextUrl.searchParams.get("firstName") || undefined;
  const lastName = req.nextUrl.searchParams.get("lastName") || undefined;
  const company = req.nextUrl.searchParams.get("company") || undefined;

  if (!email && !firstName && !lastName) {
    return NextResponse.json(
      { error: "Email or name is required" },
      { status: 400 }
    );
  }

  const data = await enrichContact({ email, firstName, lastName, company });
  if (!data) {
    return NextResponse.json({ enrichment: null });
  }

  return NextResponse.json({
    enrichment: {
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company,
      jobTitle: data.title,
      industry: data.industry,
      linkedinUrl: data.linkedinUrl,
      city: data.city,
      country: data.country,
      companySize: data.companySize,
      companyWebsite: data.companyWebsite,
    },
  });
}
