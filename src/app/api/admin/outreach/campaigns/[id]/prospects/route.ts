import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;

  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const firstStep = campaign.steps[0];
  if (!firstStep) {
    return NextResponse.json({ error: "Add at least one step first" }, { status: 400 });
  }

  const body = await req.json();
  const { prospects } = body as {
    prospects: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      jobTitle?: string;
      industry?: string;
      city?: string;
      country?: string;
      companySize?: string;
      companyWebsite?: string;
      linkedinUrl?: string;
    }[];
  };

  let added = 0;
  for (const p of prospects) {
    if (!p.email) continue;

    // Upsert contact
    const contact = await prisma.contact.upsert({
      where: { email: p.email },
      update: {
        firstName: p.firstName || undefined,
        lastName: p.lastName || undefined,
        company: p.company || undefined,
        jobTitle: p.jobTitle || undefined,
        industry: p.industry || undefined,
        city: p.city || undefined,
        country: p.country || undefined,
        companySize: p.companySize || undefined,
        companyWebsite: p.companyWebsite || undefined,
        linkedinUrl: p.linkedinUrl || undefined,
        isLead: true,
      },
      create: {
        email: p.email,
        firstName: p.firstName || null,
        lastName: p.lastName || null,
        company: p.company || null,
        jobTitle: p.jobTitle || null,
        industry: p.industry || null,
        city: p.city || null,
        country: p.country || null,
        companySize: p.companySize || null,
        companyWebsite: p.companyWebsite || null,
        linkedinUrl: p.linkedinUrl || null,
        source: "outreach",
        isLead: true,
      },
    });

    // Check if email already exists for this campaign + contact
    const existing = await prisma.outreachEmail.findFirst({
      where: { campaignId: id, contactId: contact.id },
    });
    if (existing) continue;

    // Create email record for step 1
    await prisma.outreachEmail.create({
      data: {
        campaignId: id,
        stepId: firstStep.id,
        contactId: contact.id,
        status: "pending",
      },
    });
    added++;
  }

  return NextResponse.json({ added });
}
