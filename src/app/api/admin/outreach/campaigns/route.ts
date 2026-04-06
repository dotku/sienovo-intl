import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function GET() {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const campaigns = await prisma.outreachCampaign.findMany({
    include: {
      _count: { select: { steps: true, emails: true } },
      emails: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = campaigns.map((c) => {
    const stats = { pending: 0, draft: 0, approved: 0, sent: 0, failed: 0, skipped: 0 };
    for (const e of c.emails) {
      if (e.status in stats) stats[e.status as keyof typeof stats]++;
    }
    const { emails: _, ...rest } = c;
    return { ...rest, stats };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const body = await req.json();
  const campaign = await prisma.outreachCampaign.create({
    data: {
      name: body.name || "New Campaign",
      targetIndustries: body.targetIndustries || null,
      targetTitles: body.targetTitles || null,
      targetCountries: body.targetCountries || null,
      targetDomains: body.targetDomains || null,
      senderName: body.senderName || "Leo from Sienovo",
      senderEmail: body.senderEmail || "sienovoleo@gmail.com",
      productFocus: body.productFocus || null,
      aiContext: body.aiContext || null,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
