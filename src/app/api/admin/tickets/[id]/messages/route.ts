import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, isAdmin: true, content: content.trim() },
  });

  // Update ticket status to in_progress if it was open
  await prisma.ticket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(message);
}
