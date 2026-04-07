import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // List all users (so owner can promote anyone). Order: team members first, then customers.
  const users = await prisma.user.findMany({
    orderBy: [
      { role: "asc" }, // null (customers) sorts last when DESC; we want team first
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyName: true,
      createdAt: true,
    },
  });

  // Manually sort: team members (role != null) first, then customers
  users.sort((a, b) => {
    if (a.role && !b.role) return -1;
    if (!a.role && b.role) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json(users);
}
