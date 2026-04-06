import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { generateOutreachEmail } from "@/lib/outreach-ai";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;

  const campaign = await prisma.outreachCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { emailIds, stepId } = body as { emailIds?: string[]; stepId?: string };

  const where: Record<string, unknown> = {
    campaignId: id,
    status: "pending",
  };
  if (emailIds?.length) where.id = { in: emailIds };
  if (stepId) where.stepId = stepId;

  const emails = await prisma.outreachEmail.findMany({
    where,
    include: { contact: true, step: true },
    take: 50,
  });

  let generated = 0;
  let failed = 0;

  for (const email of emails) {
    // Get previous email for follow-ups
    let prevEmail: { subject: string } | null = null;
    if (email.step.stepOrder > 1) {
      const prev = await prisma.outreachEmail.findFirst({
        where: {
          campaignId: id,
          contactId: email.contactId,
          step: { stepOrder: email.step.stepOrder - 1 },
          status: { in: ["sent", "approved", "draft"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (prev?.subject) prevEmail = { subject: prev.subject };
    }

    const result = await generateOutreachEmail(
      email.contact,
      campaign,
      email.step,
      prevEmail
    );

    if (result) {
      await prisma.outreachEmail.update({
        where: { id: email.id },
        data: {
          subject: result.subject,
          htmlContent: result.html,
          status: "draft",
        },
      });
      generated++;
    } else {
      failed++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ generated, failed, total: emails.length });
}
