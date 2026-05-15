#!/usr/bin/env node
import { config } from "dotenv";
import { join } from "path";
import pg from "pg";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const pool = new pg.Pool({
  connectionString: (process.env.DATABASE_URL || "").replace("sslmode=require", "sslmode=verify-full"),
});

const { rows: products } = await pool.query(
  `SELECT id, name, slug, description, price, currency
   FROM "Product"
   WHERE active = true
   ORDER BY "createdAt" ASC`
);

for (const p of products) {
  console.log(`\n=== ${p.name} (${p.slug}) ===`);
  console.log(`  price: ${p.price ?? "(unset)"}  ${p.currency}`);
  console.log(`  description: ${(p.description || "").slice(0, 120)}`);

  const { rows: groups } = await pool.query(
    `SELECT id, category FROM "SpecGroup" WHERE "productId" = $1 ORDER BY "sortOrder" ASC`,
    [p.id]
  );
  for (const g of groups) {
    const { rows: items } = await pool.query(
      `SELECT label, value FROM "SpecItem" WHERE "specGroupId" = $1 ORDER BY "sortOrder" ASC`,
      [g.id]
    );
    console.log(`  [${g.category}]`);
    for (const it of items.slice(0, 10)) console.log(`    ${it.label}: ${it.value}`);
  }
}
await pool.end();
