import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;

  const steps = await prisma.outreachStep.findMany({
    where: { campaignId: id },
    orderBy: { stepOrder: "asc" },
  });

  if (steps.length < 2) {
    return NextResponse.json({ error: "Need at least 2 steps" }, { status: 400 });
  }

  let created = 0;

  for (let i = 1; i < steps.length; i++) {
    const prevStep = steps[i - 1];
    const nextStep = steps[i];

    // Find contacts who completed previous step and are past the delay
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - nextStep.delayDays);

    const sentEmails = await prisma.outreachEmail.findMany({
      where: {
        campaignId: id,
        stepId: prevStep.id,
        status: "sent",
        sentAt: { lte: cutoff },
      },
      select: { contactId: true },
    });

    for (const sent of sentEmails) {
      // Check if next step email already exists
      const exists = await prisma.outreachEmail.findFirst({
        where: {
          campaignId: id,
          stepId: nextStep.id,
          contactId: sent.contactId,
        },
      });
      if (exists) continue;

      // Also skip if contact was skipped in previous steps
      const skipped = await prisma.outreachEmail.findFirst({
        where: {
          campaignId: id,
          contactId: sent.contactId,
          status: "skipped",
        },
      });
      if (skipped) continue;

      await prisma.outreachEmail.create({
        data: {
          campaignId: id,
          stepId: nextStep.id,
          contactId: sent.contactId,
          status: "pending",
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created });
}
