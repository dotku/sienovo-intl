import { NextRequest, NextResponse } from "next/server";
import { isOwner, getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { isValidRole } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();

  // Allow null (demote to customer) or a valid role
  if (role !== null && (typeof role !== "string" || !isValidRole(role))) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent owner from demoting themselves
  const me = await getUser();
  if (me?.id === id && role !== "owner") {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user);
}
