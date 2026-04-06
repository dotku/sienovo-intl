import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { trackApiUsage } from "@/lib/api-usage";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const body = await req.json();
  const { campaignId } = body;

  // Gather business context
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { name: true, description: true },
  });

  const existingCompanies = await prisma.company.findMany({
    select: { name: true, website: true, industry: true, country: true },
    take: 20,
  });

  const contactCompanies = await prisma.contact.findMany({
    where: { company: { not: null } },
    select: { company: true, companyWebsite: true, industry: true, country: true },
    distinct: ["company"],
    take: 30,
  });

  // Get campaign context if provided
  let campaignContext = "";
  if (campaignId) {
    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id: campaignId },
      select: { targetIndustries: true, targetTitles: true, targetCountries: true, productFocus: true },
    });
    if (campaign) {
      const parts = [];
      if (campaign.targetIndustries) parts.push(`Target industries: ${campaign.targetIndustries}`);
      if (campaign.targetTitles) parts.push(`Target titles: ${campaign.targetTitles}`);
      if (campaign.targetCountries) parts.push(`Target countries: ${campaign.targetCountries}`);
      if (campaign.productFocus) parts.push(`Product focus: ${campaign.productFocus}`);
      campaignContext = parts.join("\n");
    }
  }

  const productInfo = products.map((p) => `${p.name}: ${p.description}`).join("\n");

  const companyEntries = existingCompanies.map((c) => ({
    name: c.name,
    website: c.website,
    industry: c.industry,
    country: c.country,
  }));
  const contactEntries = contactCompanies.map((c) => ({
    name: c.company || "",
    website: c.companyWebsite,
    industry: c.industry,
    country: c.country,
  }));
  const existingInfo = [...companyEntries, ...contactEntries]
    .filter((c) => c.name)
    .map((c) => `${c.name} (${c.website || "no website"}, ${c.industry || "unknown industry"}, ${c.country || ""})`)
    .slice(0, 30)
    .join("\n");

  const prompt = `You are a B2B sales strategist for Sienovo, a company that sells industrial edge AI products.

Our products:
${productInfo}

Our existing clients/contacts:
${existingInfo}

${campaignContext ? `Campaign targeting:\n${campaignContext}\n` : ""}

Based on our product (edge AI for video analytics in industrial settings), recommend 15 specific companies that would be ideal prospects. Focus on:
- Manufacturing companies that need quality control / defect detection
- Warehouses and logistics companies that need safety monitoring
- Smart retail companies that need customer analytics
- Companies in industrial automation, factory management
- Mid-to-large companies (500+ employees) that can afford edge AI solutions
- Avoid companies we already have as contacts

For each company, provide the website domain.

Return ONLY a JSON array:
[{"name": "Company Name", "domain": "company.com", "industry": "Manufacturing", "reason": "Why they're a good fit in 10 words or less"}]`;

  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cerebrasKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen-3-235b-a22b-instruct-2507",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      await trackApiUsage("cerebras", "recommend_domains", false);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse recommendations" }, { status: 500 });
    }

    const recommendations = JSON.parse(match[0]);
    await trackApiUsage("cerebras", "recommend_domains", true);

    return NextResponse.json({ recommendations });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
