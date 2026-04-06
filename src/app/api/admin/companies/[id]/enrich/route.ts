import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { enrichCompany } from "@/lib/apollo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const enrichment = await enrichCompany({
    name: company.name,
    website: company.website || undefined,
  });

  if (!enrichment) {
    return NextResponse.json({ enrichment: null });
  }

  // Only return fields that differ from current values
  const filtered: Record<string, string> = {};
  const fieldMap: Record<string, keyof typeof company> = {
    name: "name",
    website: "website",
    industry: "industry",
    size: "size",
    linkedinUrl: "linkedinUrl",
    phone: "phone",
    city: "city",
    country: "country",
    description: "description",
  };

  for (const [enrichKey, dbKey] of Object.entries(fieldMap)) {
    const enrichVal = enrichment[enrichKey as keyof typeof enrichment];
    const currentVal = company[dbKey] as string | null;
    if (enrichVal && enrichVal !== currentVal) {
      filtered[enrichKey] = enrichVal;
    }
  }

  return NextResponse.json({
    enrichment: Object.keys(filtered).length > 0 ? filtered : null,
  });
}
