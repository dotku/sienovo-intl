import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const products = [
  {
    name: "INT-CAH-1",
    slug: "int-cah-1",
    description:
      "AI-powered classroom hub with 7-microphone far-field array, ultrawide-dispersion speakers, and a built-in voice assistant tuned for K-12 instruction. Hands-free control of the teacher's computer, browser, lesson materials, and connected display from anywhere in the room. In-room audio is transcribed locally for student-data privacy.",
    image: "/images/products/int-cah-1.png",
    specs: [
      {
        category: "Audio",
        items: [
          { label: "Microphones", value: "7-mic far-field array with on-device DSP" },
          { label: "Speakers", value: "92 dB SPL, 180° ultrawide dispersion, low-distortion" },
        ],
      },
      {
        category: "Connectivity",
        items: [
          { label: "HDMI", value: "HDMI 2.0 ×4 (teacher source switching)" },
          { label: "USB", value: "USB ×4" },
          { label: "Ethernet", value: "10/100/1000Mbps RJ-45 ×1" },
          { label: "Wireless", value: "Wi-Fi, Bluetooth 5.0 (BR/EDR/LE)" },
        ],
      },
      {
        category: "Compute",
        items: [
          { label: "OS", value: "Android 9 onboard" },
          { label: "On-device", value: "DSP for audio + far-field beamforming" },
        ],
      },
      {
        category: "Accessory",
        items: [
          { label: "Remote", value: "RF wireless air-mouse remote with built-in microphone, lanyard included" },
        ],
      },
      {
        category: "AI Software",
        items: [
          { label: "Voice Control", value: "Natural-language control of computer, browser, apps, timers, volume, HDMI inputs" },
          { label: "AI Chat", value: "K-12-safe generative answers with source attribution and follow-up questions" },
          { label: "Lesson Tools", value: "Lesson plan + rubric generation aligned to teacher inputs" },
          { label: "Privacy", value: "In-room audio transcribed locally and deleted; voice does not leave the room" },
        ],
      },
      {
        category: "Physical",
        items: [
          { label: "Mounting", value: "Above-monitor bracket, desktop, cart, or wall mount" },
          { label: "Build", value: "Die-cast metal legs, classroom-durable enclosure" },
        ],
      },
      {
        category: "Use Case",
        items: [
          { label: "Target Room", value: "K-12 classroom up to large lecture hall" },
          { label: "Primary User", value: "K-12 teacher (front-of-class instruction)" },
        ],
      },
    ],
  },
];

async function main() {
for (const p of products) {
  const existing = await prisma.product.findUnique({ where: { slug: p.slug } });

  if (existing) {
    await prisma.specGroup.deleteMany({ where: { productId: existing.id } });
    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: { name: p.name, description: p.description, image: p.image },
    });
    for (let i = 0; i < p.specs.length; i++) {
      const spec = p.specs[i];
      await prisma.specGroup.create({
        data: {
          category: spec.category,
          sortOrder: i,
          productId: updated.id,
          items: {
            create: spec.items.map((item, j) => ({
              label: item.label,
              value: item.value,
              sortOrder: j,
            })),
          },
        },
      });
    }
    console.log(`Updated existing product: ${updated.name} (${updated.id})`);
  } else {
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        image: p.image,
      },
    });
    for (let i = 0; i < p.specs.length; i++) {
      const spec = p.specs[i];
      await prisma.specGroup.create({
        data: {
          category: spec.category,
          sortOrder: i,
          productId: created.id,
          items: {
            create: spec.items.map((item, j) => ({
              label: item.label,
              value: item.value,
              sortOrder: j,
            })),
          },
        },
      });
    }
    console.log(`Created new product: ${created.name} (${created.id})`);
  }
}
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
