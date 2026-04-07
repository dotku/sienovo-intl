import { prisma } from "@/lib/prisma";
import ProductsList from "./ProductsList";

export default async function AdminPage() {
  const rawProducts = await prisma.product.findMany({
    include: {
      specGroups: {
        include: { items: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const products = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    active: p.active,
    specGroupCount: p.specGroups.length,
    specCount: p.specGroups.reduce((acc, g) => acc + g.items.length, 0),
  }));

  return <ProductsList products={products} />;
}
