import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;

  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      emails: {
        include: { contact: true, step: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  const body = await req.json();

  const campaign = await prisma.outreachCampaign.update({
    where: { id },
    data: {
      name: body.name,
      status: body.status,
      targetIndustries: body.targetIndustries,
      targetTitles: body.targetTitles,
      targetCountries: body.targetCountries,
      targetDomains: body.targetDomains,
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      productFocus: body.productFocus,
      aiContext: body.aiContext,
    },
  });

  return NextResponse.json(campaign);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  await prisma.outreachCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
