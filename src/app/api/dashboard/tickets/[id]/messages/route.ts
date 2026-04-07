import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Verify ticket belongs to user
  const ticket = await prisma.ticket.findFirst({ where: { id, userId: user.id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, userId: user.id, content: content.trim() },
  });

  // Reopen if closed/resolved
  if (ticket.status === "closed" || ticket.status === "resolved") {
    await prisma.ticket.update({ where: { id }, data: { status: "open" } });
  } else {
    await prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  return NextResponse.json(message);
}
