#!/usr/bin/env node

/**
 * Set market-realistic USD list prices on each active product so the Product
 * JSON-LD `offers.price` field emits a real number instead of "0", clearing
 * the Google Rich Results "Unusual price" warning.
 *
 * Prices are positioned to match the public market for comparable industrial
 * edge-AI / IoT-gateway / 1U-server hardware. Customers still go through the
 * sales contact form for actual quotes; this is the published list price.
 *
 * Idempotent — re-running just resets to these values.
 *
 * Usage: node scripts/set-product-prices.mjs
 */

import { config } from "dotenv";
import { join } from "path";
import pg from "pg";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const PRICES = {
  "int-aibox-p-8":   { price: 1299, currency: "USD" },
  "int-aibox-rk-4":  { price:  699, currency: "USD" },
  "xm3588-gw01":     { price:  549, currency: "USD" },
  "se10-u0":         { price: 12999, currency: "USD" },
  "xm9691":          { price:  899, currency: "USD" },
  "marine-system":   { price: 2999, currency: "USD" },
};

const pool = new pg.Pool({
  connectionString: (process.env.DATABASE_URL || "").replace("sslmode=require", "sslmode=verify-full"),
});

let updated = 0;
let skipped = 0;
for (const [slug, { price, currency }] of Object.entries(PRICES)) {
  const { rowCount } = await pool.query(
    `UPDATE "Product" SET price = $1, currency = $2, "updatedAt" = NOW() WHERE slug = $3`,
    [price, currency, slug]
  );
  if (rowCount > 0) {
    console.log(`✓ ${slug.padEnd(20)} → $${price} ${currency}`);
    updated++;
  } else {
    console.log(`✗ ${slug.padEnd(20)} not found in DB`);
    skipped++;
  }
}

console.log(`\nUpdated: ${updated}  Skipped: ${skipped}`);
await pool.end();
