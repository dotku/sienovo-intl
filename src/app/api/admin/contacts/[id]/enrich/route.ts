import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { enrichContact } from "@/lib/apollo";

// GET: Preview enrichment for a single contact (does NOT update)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await enrichContact(contact.email);
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
