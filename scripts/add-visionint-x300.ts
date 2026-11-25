// Upsert the VisionInt X300 4K action camera (new consumer-imaging line, 2026-11).
// Source: VisionInt_X300 product deck. Run: npx tsx scripts/add-visionint-x300.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const p = {
  name: "VisionInt X300",
  slug: "visionint-x300",
  description:
    "Entry-priced true-4K action camera, 52 g, with a 140° wide-angle lens, HDR, and about 150 minutes of recording per charge. The image pipeline is tuned by an engineering team with smartphone ISP experience on Qualcomm and MediaTek platforms. Wi-Fi 6 gives about 180 ms live preview and auto-connects to the Android/iOS app. Available for wholesale, OEM private label, and ODM customization.",
  image: null as string | null,
  specs: [
    { category: "Imaging", items: [
      { label: "Sensor", value: "1/2.7-inch, 8 MP" },
      { label: "Video", value: "True 4K @ 24 fps; 2K @ 50/30 fps; 1080P @ 60/30 fps; 720P @ 120/60/30 fps" },
      { label: "Field of View", value: "140° DFOV wide angle" },
      { label: "Features", value: "HDR, digital zoom, landscape/portrait switching, distortion correction, backlight shooting" },
    ] },
    { category: "Connectivity & App", items: [
      { label: "Wireless", value: "Wi-Fi 6 (2.4 GHz)" },
      { label: "Live Preview", value: "~180 ms latency" },
      { label: "App", value: "Android / iOS, auto-connect after first pairing" },
      { label: "OTA", value: "Camera firmware and app both update over the air" },
    ] },
    { category: "Power", items: [
      { label: "Battery", value: "800 mAh" },
      { label: "Runtime", value: "~150 min (2K @ 30 fps)" },
      { label: "External Power", value: "USB 5V, record while charging" },
    ] },
    { category: "Physical", items: [
      { label: "Weight", value: "52 g" },
      { label: "Dimensions", value: "63 × 32 × 31.5 mm" },
      { label: "Mounts", value: "Compatible with common action-camera mounts and accessories" },
    ] },
    { category: "Use Cases", items: [
      { label: "Scenarios", value: "Cycling & motorcycle POV, vlog, camping & travel, campus, short-video creation, gifting" },
    ] },
    { category: "Business", items: [
      { label: "Supply", value: "Wholesale (made to order)" },
      { label: "OEM", value: "Body logo printing, custom packaging, branded startup sound and app" },
      { label: "ODM", value: "Industrial design and software/hardware customization, evaluated per project" },
    ] },
  ],
};

async function main() {
  const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
  const data = { name: p.name, description: p.description, ...(p.image ? { image: p.image } : {}) };
  const prod = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data: { ...data, slug: p.slug } });
  if (existing) await prisma.specGroup.deleteMany({ where: { productId: prod.id } });
  for (const [i, s] of p.specs.entries()) {
    await prisma.specGroup.create({
      data: {
        category: s.category, sortOrder: i, productId: prod.id,
        items: { create: s.items.map((it, j) => ({ label: it.label, value: it.value, sortOrder: j })) },
      },
    });
  }
  console.log(`${existing ? "Updated" : "Created"} ${prod.name} (${prod.id})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
