import { prisma } from "@/lib/prisma";
import CompaniesList from "./CompaniesList";

export default async function CompaniesPage() {
  const rawCompanies = await prisma.company.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { contacts: true } } },
  });

  const companies = rawCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    industry: c.industry,
    size: c.size,
    city: c.city,
    country: c.country,
    linkedinUrl: c.linkedinUrl,
    _count: c._count,
  }));

  return <CompaniesList companies={companies} />;
}
