#!/usr/bin/env node

/**
 * Generate AI product imagery for the Product table via Gemini Imagen.
 *
 * For each active product we build 3 prompts tuned to the product's
 * description + category, generate one image per prompt, upload to R2
 * under `ai-products/{slug}/{variant}-{ts}.png`, and write a manifest
 * to `data/ai-images/{slug}.json` so the admin gallery page can list
 * them without re-hitting Gemini.
 *
 * Why generate instead of stock-photo lookup: industrial edge-AI boxes
 * are too niche for stock libraries — generic stock returns rack
 * servers or unrelated electronics. Imagen handles the "fanless metal
 * heatsink box in industrial setting" cue better than search.
 *
 * Usage:
 *   node scripts/generate-product-ai-images.mjs --slug int-aibox-p-8     # one
 *   node scripts/generate-product-ai-images.mjs                          # all active
 *   node scripts/generate-product-ai-images.mjs --variants hero          # 1 variant only
 *   node scripts/generate-product-ai-images.mjs --dry-run                # prompts only
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

config({ path: join(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const SLUG = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
const VARIANT_FILTER = args.includes("--variants") ? args[args.indexOf("--variants") + 1] : null;
const DRY = args.includes("--dry-run");

// ── Image generation providers ─────────────────────────────────────────────
// Falls through the chain in order; first one to succeed wins. Gemini's
// free tier has aggressive image-gen quotas (often 429s after a few
// requests), so Z.AI CogView is the practical default for batch jobs.
//
// Provider keys (in priority order):
//   zai     — Z.AI CogView-3 Flash. Free tier is generous, OpenAI-compatible.
//   gemini  — Imagen 4 (paid) / gemini-*-image-preview (free, low quota).
//
// Override default with --provider <name>.
const PROVIDER_FILTER = args.includes("--provider") ? args[args.indexOf("--provider") + 1] : null;

const PROVIDERS = {
  zai: {
    name: "Z.AI CogView",
    available: !!process.env.ZAI_API_KEY,
    async generate(prompt) {
      const res = await fetch(
        "https://open.bigmodel.cn/api/paas/v4/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "cogview-3-flash",
            prompt,
            size: "1024x1024",
            n: 1,
          }),
        }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(`Z.AI ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const item = data.data?.[0];
      if (!item) throw new Error(`Z.AI: no data in response: ${text.slice(0, 200)}`);
      if (item.b64_json) return Buffer.from(item.b64_json, "base64");
      if (item.url) {
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) throw new Error(`Z.AI image fetch ${imgRes.status}`);
        return Buffer.from(await imgRes.arrayBuffer());
      }
      throw new Error(`Z.AI: no b64 or url`);
    },
  },
  gemini: {
    name: process.env.IMAGEN_MODEL || "gemini-2.5-flash-image",
    available: !!process.env.GEMINI_API_KEY,
    async generate(prompt) {
      const model = process.env.IMAGEN_MODEL || "gemini-2.5-flash-image";
      const endpoint = model.startsWith("imagen-") ? "predict" : "generateContent";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${process.env.GEMINI_API_KEY}`;
      const body =
        endpoint === "predict"
          ? {
              instances: [{ prompt }],
              parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "DONT_ALLOW" },
            }
          : {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["IMAGE"] },
            };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${model} ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const predB64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (predB64) return Buffer.from(predB64, "base64");
      for (const cand of data.candidates || []) {
        for (const part of cand.content?.parts || []) {
          const inline = part.inlineData || part.inline_data;
          if (inline?.data) return Buffer.from(inline.data, "base64");
        }
      }
      throw new Error(`No image in response`);
    },
  },
};

const activeProviders = Object.entries(PROVIDERS)
  .filter(([id, p]) => p.available && (!PROVIDER_FILTER || id === PROVIDER_FILTER))
  .map(([id, p]) => ({ id, ...p }));

if (activeProviders.length === 0) {
  console.error(
    `No image provider available. Set ZAI_API_KEY or GEMINI_API_KEY${PROVIDER_FILTER ? ` (or drop --provider ${PROVIDER_FILTER})` : ""}.`
  );
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC = process.env.R2_PUBLIC_URL;

// Prompt templates per variant. Each is a function so we can interpolate
// the product's name + description.
const VARIANTS = {
  hero: (p) =>
    `Professional product photography of a ${p.name}, an industrial edge AI computing device. ` +
    `Clean white seamless studio background, soft three-point lighting, slight 3/4 isometric angle. ` +
    `Compact rectangular metal chassis with prominent finned heatsink, dark anthracite color, ` +
    `visible I/O ports on the back. Photorealistic, ultra-sharp focus, no text or watermarks. ` +
    `${p.description ? "Context: " + p.description.slice(0, 200) : ""}`,
  scene: (p) =>
    `Industrial deployment scene of a ${p.name} edge AI device installed in a real-world environment. ` +
    `${typeForScene(p.name)} setting, the device mounted on a wall or shelf, network cables connected. ` +
    `Wide-angle environmental shot, natural lighting, depth of field. Photorealistic, no text, no logos.`,
  feature: (p) =>
    `Cut-away technical illustration of a ${p.name}, showing internal NPU chip, memory modules, ` +
    `cooling fins, and PCB layout. Industrial design rendering style on a dark gradient background, ` +
    `subtle annotation lines highlighting key components but NO TEXT. Cinematic lighting.`,
};

function typeForScene(name) {
  if (/marine/i.test(name)) return "Marine vessel deck, navigation console";
  if (/gw|gateway/i.test(name)) return "Factory floor control cabinet";
  if (/se10|server|9691/i.test(name)) return "Server room rack";
  return "Industrial site (e.g. gas station, construction site, smart-park gatehouse)";
}

// ── DB ────────────────────────────────────────────────────────────────────
async function getProducts() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL.replace("sslmode=require", "sslmode=verify-full"),
  });
  await client.connect();
  const where = SLUG ? "WHERE slug = $1 AND active = true" : "WHERE active = true";
  const params = SLUG ? [SLUG] : [];
  const r = await client.query(
    `SELECT id, slug, name, description FROM "Product" ${where} ORDER BY "createdAt" ASC`,
    params
  );
  await client.end();
  return r.rows;
}

// ── Gemini call ───────────────────────────────────────────────────────────
async function generateImage(prompt) {
  let lastErr;
  for (const p of activeProviders) {
    try {
      const buf = await p.generate(prompt);
      return { buf, provider: p.name };
    } catch (err) {
      lastErr = err;
      if (activeProviders.length > 1) {
        process.stdout.write(`[${p.name} → ${String(err.message).slice(0, 60)}; next] `);
      }
    }
  }
  throw lastErr;
}

// ── Main ──────────────────────────────────────────────────────────────────
const products = await getProducts();
if (products.length === 0) {
  console.error(SLUG ? `Product "${SLUG}" not found` : "No active products");
  process.exit(1);
}

mkdirSync(join(process.cwd(), "data/ai-images"), { recursive: true });

console.log(`Generating AI images for ${products.length} product(s)`);
console.log(`Provider chain: ${activeProviders.map((p) => p.name).join(" → ")}`);
if (DRY) console.log("(dry-run — printing prompts only)");

const variantNames = VARIANT_FILTER
  ? VARIANT_FILTER.split(",").map((s) => s.trim())
  : Object.keys(VARIANTS);

for (const p of products) {
  console.log(`\n=== ${p.name} (${p.slug}) ===`);
  const manifest = {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    generatedAt: new Date().toISOString(),
    providerChain: activeProviders.map((p) => p.name),
    images: [],
  };
  for (const v of variantNames) {
    const promptFn = VARIANTS[v];
    if (!promptFn) {
      console.log(`  skip unknown variant "${v}"`);
      continue;
    }
    const prompt = promptFn(p);
    console.log(`  [${v}] prompt: ${prompt.slice(0, 110)}…`);
    if (DRY) continue;

    try {
      const { buf: img, provider } = await generateImage(prompt);
      const ts = Date.now();
      const key = `ai-products/${p.slug}/${v}-${ts}.png`;
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: img,
          ContentType: "image/png",
        })
      );
      const url = `${R2_PUBLIC}/${key}`;
      manifest.images.push({ variant: v, key, url, prompt, provider });
      console.log(`  ✓ ${v} (${provider}): ${url}`);
    } catch (err) {
      console.log(`  ✗ ${v}: ${String(err.message).slice(0, 200)}`);
      manifest.images.push({ variant: v, error: String(err.message).slice(0, 300) });
    }
  }
  if (!DRY && manifest.images.length > 0) {
    const path = join(process.cwd(), `data/ai-images/${p.slug}.json`);
    writeFileSync(path, JSON.stringify(manifest, null, 2));
    console.log(`  manifest → ${path}`);
  }
}
