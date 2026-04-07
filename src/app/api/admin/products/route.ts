import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const products = await prisma.product.findMany({
    include: {
      specGroups: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const body = await req.json();
  const { name, slug, description, image, price, currency, specGroups } = body;

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      image,
      price: price != null ? parseFloat(price) : null,
      currency: currency || "USD",
      specGroups: {
        create: (specGroups || []).map(
          (
            group: {
              category: string;
              items: { label: string; value: string }[];
            },
            i: number
          ) => ({
            category: group.category,
            sortOrder: i,
            items: {
              create: (group.items || []).map(
                (item: { label: string; value: string }, j: number) => ({
                  label: item.label,
                  value: item.value,
                  sortOrder: j,
                })
              ),
            },
          })
        ),
      },
    },
    include: {
      specGroups: { include: { items: true } },
    },
  });

  return NextResponse.json(product, { status: 201 });
}
