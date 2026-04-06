import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const specs = [
  {
    category: "Processor",
    items: [
      { label: "TPU", value: "CV186AH" },
      { label: "CPU", value: "ARM Cortex-A53, 6-core, 1.6GHz" },
    ],
  },
  {
    category: "AI Computing Power",
    items: [
      { label: "INT8", value: "7.2 TOPS" },
      { label: "INT4", value: "12 TOPS" },
      { label: "FP16 / BF16", value: "1.5T FLOPS" },
    ],
  },
  {
    category: "Video Codec",
    items: [
      { label: "Decode", value: "H.264/H.265: 8CH 1080P@30fps, max 8192×8192" },
      { label: "Encode", value: "H.264/H.265: 8CH 1080P@30fps, max 8192×8192" },
      { label: "Image", value: "JPEG codec 8CH 1920×1080@30fps" },
    ],
  },
  {
    category: "Memory & Storage",
    items: [
      { label: "RAM", value: "8 GB" },
      { label: "eMMC", value: "32 GB" },
      { label: "Expansion", value: "microSD ×1, M.2 SSD ×1, SATA 3.0 (up to 2TB)" },
    ],
  },
  {
    category: "Interfaces",
    items: [
      { label: "Ethernet", value: "10/100/1000Mbps ×2" },
      { label: "HDMI", value: "HDMI 2.0 ×1, 4096×2160@60fps" },
      { label: "USB", value: "USB 3.0 ×2" },
      { label: "Serial", value: "RS-232 ×1, RS-485 ×1, UART Type-C ×1" },
      { label: "Other", value: "GPIO ×4, Relay ×1, CAN ×1" },
    ],
  },
  {
    category: "Protocols",
    items: [
      { label: "Northbound", value: "HTTP, MQTT, GB28181" },
      { label: "Southbound", value: "GB28181, ONVIF, RTSP, RTMP" },
    ],
  },
  {
    category: "Environment",
    items: [
      { label: "Operating Temp", value: "-20°C to +60°C" },
      { label: "Storage Temp", value: "-40°C to +85°C" },
      { label: "Protection", value: "IP41, Fanless Passive Cooling" },
      { label: "Power", value: "12.5W typical, AC 100-240V / DC 12V" },
    ],
  },
  {
    category: "Physical",
    items: [
      { label: "Dimensions", value: "219.8mm × 200mm × 46.8mm" },
      { label: "Weight", value: "1.93 kg" },
      { label: "Mounting", value: 'Desktop, Wall, 19" Rack, Outdoor Enclosure' },
    ],
  },
];

async function main() {
  // Clear existing data
  await prisma.specItem.deleteMany();
  await prisma.specGroup.deleteMany();
  await prisma.product.deleteMany();

  // Create the INT-AIBOX-P-8 product
  const product = await prisma.product.create({
    data: {
      name: "INT-AIBOX-P-8",
      slug: "int-aibox-p-8",
      description:
        "Enterprise-grade edge AI computing box with 8-channel video analytics, fanless design, and industrial-grade reliability.",
      image: "/images/products/3d-view.png",
    },
  });

  // Create spec groups and items
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    await prisma.specGroup.create({
      data: {
        category: spec.category,
        sortOrder: i,
        productId: product.id,
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

  console.log(`Seeded product: ${product.name} (${product.id})`);
  console.log(`Seeded ${specs.length} spec groups`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
