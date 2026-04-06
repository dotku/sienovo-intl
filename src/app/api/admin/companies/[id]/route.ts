import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          phone: true,
          linkedinUrl: true,
          isLead: true,
          city: true,
          country: true,
        },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { contacts, _count, id: _id, createdAt, updatedAt, ...data } = body;
  void contacts; void _count; void _id; void createdAt; void updatedAt;

  const company = await prisma.company.update({
    where: { id },
    data,
  });

  return NextResponse.json(company);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Unlink contacts first
  await prisma.contact.updateMany({
    where: { companyId: id },
    data: { companyId: null },
  });

  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
