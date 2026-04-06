import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const stepId = searchParams.get("stepId");

  const where: Record<string, unknown> = {};
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;
  if (stepId) where.stepId = stepId;

  const emails = await prisma.outreachEmail.findMany({
    where,
    include: {
      contact: true,
      step: true,
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(emails);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const body = await req.json();

  // Single email edit
  if (body.emailId && (body.subject || body.htmlContent)) {
    const updated = await prisma.outreachEmail.update({
      where: { id: body.emailId },
      data: {
        subject: body.subject,
        htmlContent: body.htmlContent,
        status: body.status || undefined,
      },
    });
    return NextResponse.json(updated);
  }

  // Bulk action
  const { emailIds, action } = body as { emailIds: string[]; action: string };
  if (!emailIds?.length || !action) {
    return NextResponse.json({ error: "emailIds and action required" }, { status: 400 });
  }

  if (action === "approve") {
    await prisma.outreachEmail.updateMany({
      where: { id: { in: emailIds }, status: { in: ["draft"] } },
      data: { status: "approved" },
    });
  } else if (action === "skip") {
    await prisma.outreachEmail.updateMany({
      where: { id: { in: emailIds } },
      data: { status: "skipped" },
    });
  } else if (action === "regenerate") {
    await prisma.outreachEmail.updateMany({
      where: { id: { in: emailIds } },
      data: { status: "pending", subject: "", htmlContent: "" },
    });
  }

  return NextResponse.json({ success: true, count: emailIds.length });
}
