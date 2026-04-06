import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, id: _id, createdAt: _c, updatedAt: _u, contacts: _co, _count, files: _f, ...data } = body;
  void _id; void _c; void _u; void _co; void _count; void _f;

  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const company = await prisma.company.upsert({
    where: { name },
    update: data,
    create: { name, ...data },
  });

  return NextResponse.json(company, { status: 201 });
}
