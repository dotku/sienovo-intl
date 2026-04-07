import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, string> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.companyName !== undefined) data.companyName = body.companyName;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.country !== undefined) data.country = body.country;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json(updated);
}
