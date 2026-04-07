import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { email: true, name: true, companyName: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(tickets);
}
