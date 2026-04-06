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

  const steps = await prisma.outreachStep.findMany({
    where: { campaignId: id },
    orderBy: { stepOrder: "asc" },
  });

  return NextResponse.json(steps);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  const body = await req.json();

  const step = await prisma.outreachStep.create({
    data: {
      campaignId: id,
      stepOrder: body.stepOrder ?? 1,
      delayDays: body.delayDays ?? 0,
      subject: body.subject || null,
      promptHint: body.promptHint || null,
    },
  });

  return NextResponse.json(step, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  const body = await req.json();
  const { steps } = body as {
    steps: { id: string; stepOrder: number; delayDays: number; subject?: string; promptHint?: string }[];
  };

  // Delete removed steps
  const stepIds = steps.filter((s) => s.id).map((s) => s.id);
  await prisma.outreachStep.deleteMany({
    where: { campaignId: id, id: { notIn: stepIds } },
  });

  // Upsert each step
  for (const s of steps) {
    if (s.id) {
      await prisma.outreachStep.update({
        where: { id: s.id },
        data: {
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          subject: s.subject || null,
          promptHint: s.promptHint || null,
        },
      });
    } else {
      await prisma.outreachStep.create({
        data: {
          campaignId: id,
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          subject: s.subject || null,
          promptHint: s.promptHint || null,
        },
      });
    }
  }

  const updated = await prisma.outreachStep.findMany({
    where: { campaignId: id },
    orderBy: { stepOrder: "asc" },
  });

  return NextResponse.json(updated);
}
