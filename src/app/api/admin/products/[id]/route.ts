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
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      specGroups: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  const body = await req.json();
  const { name, slug, description, image, active, specGroups } = body;

  // Update product fields
  const product = await prisma.product.update({
    where: { id },
    data: { name, slug, description, image, active },
  });

  // Replace spec groups if provided
  if (specGroups) {
    // Delete existing
    await prisma.specGroup.deleteMany({ where: { productId: id } });

    // Create new
    for (let i = 0; i < specGroups.length; i++) {
      const group = specGroups[i];
      await prisma.specGroup.create({
        data: {
          category: group.category,
          sortOrder: i,
          productId: id,
          items: {
            create: (group.items || []).map(
              (item: { label: string; value: string }, j: number) => ({
                label: item.label,
                value: item.value,
                sortOrder: j,
              })
            ),
          },
        },
      });
    }
  }

  const updated = await prisma.product.findUnique({
    where: { id },
    include: {
      specGroups: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
