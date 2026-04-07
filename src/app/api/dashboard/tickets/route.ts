import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, type, message } = await req.json();
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject: subject.trim(),
      type: type || "inquiry",
      userId: user.id,
      messages: {
        create: { content: message.trim(), userId: user.id },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json(ticket);
}
