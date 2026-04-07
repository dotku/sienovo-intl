import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ProductSeed {
  name: string;
  slug: string;
  description: string;
  image: string;
  specs: { category: string; items: { label: string; value: string }[] }[];
}

const products: ProductSeed[] = [
  {
    name: "INT-AIBOX-P-8",
    slug: "int-aibox-p-8",
    description:
      "Enterprise-grade edge AI computing box with 8-channel video analytics, fanless design, and industrial-grade reliability.",
    image: "/images/products/3d-view.png",
    specs: [
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
    ],
  },
  {
    name: "INT-AIBOX-RK-4",
    slug: "int-aibox-rk-4",
    description:
      "High-performance, low-power edge AI computing box with RK3588 NPU, 4-channel HD video analytics, 30+ built-in AI algorithms, and fanless industrial design.",
    image: "/images/products/int-aibox-rk4.png",
    specs: [
      {
        category: "Processor",
        items: [
          { label: "NPU", value: "RK3588, 6 TOPS" },
          { label: "CPU", value: "Cortex-A76 + Cortex-A55, 8-core, 2.4GHz" },
        ],
      },
      {
        category: "AI Computing Power",
        items: [
          { label: "INT8", value: "6 TOPS" },
          { label: "Video Channels", value: "4CH 1080P full pipeline" },
          { label: "AI Tasks", value: "Up to 3 per channel, 4 concurrent" },
        ],
      },
      {
        category: "Video Codec",
        items: [
          { label: "Decode", value: "H.265/H.264/AV1/VP9/AVS2, max 8K@60fps" },
          { label: "Encode", value: "H.264/H.265, max 8K@30fps" },
          { label: "Image", value: "JPEG 1080P@800fps" },
        ],
      },
      {
        category: "Memory & Storage",
        items: [
          { label: "RAM", value: "8 GB LPDDR4X (optional 16/32 GB)" },
          { label: "eMMC", value: "128 GB (optional 64/256 GB)" },
          { label: "Expansion", value: "microSD ×1, SIM ×1" },
        ],
      },
      {
        category: "Interfaces",
        items: [
          { label: "Ethernet", value: "10/100/1000Mbps ×1" },
          { label: "HDMI", value: "HDMI ×1" },
          { label: "USB", value: "USB 3.0 ×2, USB 2.0 ×5" },
          { label: "Serial", value: "RS-232 ×2, RS-485 ×2" },
          { label: "Other", value: "GPIO ×4, Relay ×1, 3.5mm Audio ×1" },
        ],
      },
      {
        category: "Protocols",
        items: [
          { label: "Northbound", value: "HTTP, MQTT, GB28281" },
          { label: "Southbound", value: "GB28281, ONVIF, RTSP" },
        ],
      },
      {
        category: "Environment",
        items: [
          { label: "Operating Temp", value: "-20°C to +60°C" },
          { label: "Protection", value: "IP40, Fanless Passive Cooling" },
          { label: "Power", value: "~8W typical, DC 12V/2A" },
        ],
      },
      {
        category: "Physical",
        items: [
          { label: "Dimensions", value: "177.5mm × 120mm × 48.75mm" },
          { label: "Mounting", value: "Desktop, Wall, Outdoor Enclosure" },
        ],
      },
    ],
  },
  {
    name: "XM3588-GW01",
    slug: "xm3588-gw01",
    description:
      "Industrial IoT gateway powered by RK3588 with 4×RJ45 (2×2.5G + 2×GbE), multi-USB, HDMI in/out, 4G/5G & Wi-Fi/BT support. Fanless aluminum alloy design for IoT and industrial control.",
    image: "/images/products/xm3588-gw01.png",
    specs: [
      {
        category: "Processor",
        items: [
          { label: "CPU", value: "RK3588, Cortex-A76 + Cortex-A55, 8-core, 2.4GHz" },
          { label: "GPU", value: "ARM Mali-G610 MP4" },
          { label: "NPU", value: "6.0 TOPS (INT8)" },
        ],
      },
      {
        category: "Video Codec",
        items: [
          { label: "Decode", value: "16×1080P@30fps H.264/H.265" },
          { label: "Encode", value: "8×1080P@30fps H.264/H.265" },
          { label: "Image", value: "JPEG 1080P@800fps" },
        ],
      },
      {
        category: "Memory & Storage",
        items: [
          { label: "RAM", value: "8 GB LPDDR4X (optional 16/32 GB)" },
          { label: "eMMC", value: "128 GB (optional 64/256 GB)" },
        ],
      },
      {
        category: "Expansion Slots",
        items: [
          { label: "M.2 Key-B", value: "2042/2052, PCIe×1/USB3.0+USB2.0 (4G/5G)" },
          { label: "M.2 E-Key", value: "2230, PCIe×1+USB2.0 (Wi-Fi/BT)" },
        ],
      },
      {
        category: "Rear I/O",
        items: [
          { label: "DC IN", value: "DC 12V (2.1/5.5 Power Jack)" },
          { label: "LAN", value: "4×RJ45 (2×2.5G + 2×GbE)" },
          { label: "USB", value: "USB 2.0 ×2" },
          { label: "Console", value: "RJ45 ×1 (Debug)" },
        ],
      },
      {
        category: "Front I/O",
        items: [
          { label: "HDMI Out", value: "2×HDMI 2.0 (4K)" },
          { label: "HDMI In", value: "HDMI ×1" },
          { label: "USB", value: "USB 2.0 ×2" },
          { label: "Serial", value: "RS-485 ×2" },
          { label: "Other", value: "TF ×1, SIM ×1, Audio (Line+MIC)" },
        ],
      },
      {
        category: "Environment",
        items: [
          { label: "Operating Temp", value: "-20°C to +60°C" },
          { label: "Storage Temp", value: "-20°C to +85°C" },
          { label: "Humidity", value: "5%~95%, non-condensing" },
        ],
      },
      {
        category: "Physical",
        items: [
          { label: "Dimensions", value: "180mm × 128.5mm × 42mm" },
          { label: "Weight", value: "~0.4 kg" },
          { label: "Material", value: "Aluminum alloy + SGCC sheet metal" },
          { label: "Cooling", value: "Fanless passive cooling" },
        ],
      },
    ],
  },
  {
    name: "SE10-U0",
    slug: "se10-u0",
    description:
      "High-density edge AI server with BM1688 processor, up to 192 TOPS INT8 computing power, 12 compute nodes, 192-channel HD video analytics. Standard 1U rack-mount form factor for large-scale deployments.",
    image: "/images/products/se10-u0.png",
    specs: [
      {
        category: "Processor",
        items: [
          { label: "Compute Node", value: "BM1688 (A53×8), 64-bit, 1.6GHz ×12" },
          { label: "Control Node", value: "RK3588 (A76+A55), 8-core, 2.4GHz ×1" },
        ],
      },
      {
        category: "AI Computing Power",
        items: [
          { label: "INT8", value: "192 TOPS peak" },
          { label: "NPU Utilization", value: ">70% average" },
          { label: "Compute Nodes", value: "12 (up to 96 ARM cores)" },
        ],
      },
      {
        category: "Video Codec",
        items: [
          { label: "Decode", value: "H.264/H.265: 192CH 1080P@30fps (hardware)" },
          { label: "Encode", value: "H.264/H.265: 120CH 1080P@30fps (hardware)" },
          { label: "Resolution", value: "Up to 8K/4K/1080P/720P/D1/CIF" },
        ],
      },
      {
        category: "Memory & Storage",
        items: [
          { label: "RAM", value: "8 GB LPDDR4 ×12 (per compute node)" },
          { label: "eMMC", value: "32 GB ×8 (per compute node)" },
          { label: "HDD", value: "2.5\" SATA 3.0 ×2" },
        ],
      },
      {
        category: "Interfaces",
        items: [
          { label: "Ethernet", value: "GbE RJ45 ×5 + SFP+ ×2 (10G)" },
          { label: "HDMI", value: "HDMI 2.0, 4K@60Hz ×1" },
          { label: "USB", value: "USB 3.0 ×1, USB 2.0 ×1, Type-C ×1" },
          { label: "Wireless", value: "4G/LTE/5G (optional)" },
        ],
      },
      {
        category: "Management",
        items: [
          { label: "BMC", value: "Linux BMC with web management interface" },
          { label: "Cooling", value: "5 high-speed fans" },
          { label: "AI Frameworks", value: "TensorFlow, PyTorch, Paddle, Caffe, ONNX, MXNet, DarkNet" },
        ],
      },
      {
        category: "Environment",
        items: [
          { label: "Operating Temp", value: "0°C to +50°C" },
          { label: "Humidity", value: "10%~90% RH, non-condensing" },
          { label: "Power", value: "300W AC (100V~240V AC), <12W per node" },
        ],
      },
      {
        category: "Physical",
        items: [
          { label: "Form Factor", value: "Standard 1U Rack Server" },
          { label: "Dimensions", value: "490mm × 390mm × 44.4mm" },
          { label: "Mounting", value: '19" Rack Mount' },
        ],
      },
    ],
  },
  {
    name: "XM9691",
    slug: "xm9691",
    description:
      "1U rack-mount industrial controller powered by Intel Core i3-1115G4 with 6×GbE, 6×RS485 serial ports, VGA+HDMI display, and EMC Class A power grid compliance. Ideal for power grid communication and industrial control.",
    image: "/images/products/xm9691.png",
    specs: [
      {
        category: "Processor",
        items: [
          { label: "CPU", value: "Intel Core i3-1115G4, 4.1GHz, TDP 28W" },
          { label: "BIOS", value: "AMI BIOS" },
        ],
      },
      {
        category: "Memory & Storage",
        items: [
          { label: "RAM", value: "1×SO-DIMM DDR4 3200MHz (up to 32 GB)" },
          { label: "Storage", value: "1×mSATA + 1×SATA 2.5\"" },
        ],
      },
      {
        category: "Interfaces",
        items: [
          { label: "Ethernet", value: "2×Intel I210 GbE + 4×RTL8111 GbE (6 total)" },
          { label: "USB", value: "USB 3.0 Type-A ×3, USB 2.0 Type-A ×1" },
          { label: "Serial", value: "RS-485 ×6 (expandable to 12), 2×9-PIN, 3.81mm phoenix" },
          { label: "Display", value: "VGA DB15 ×1, HDMI 2.0 ×1" },
        ],
      },
      {
        category: "Expansion",
        items: [
          { label: "M.2 B-Key", value: "NGFF, PCIe+USB (4G/5G)" },
          { label: "M.2 E-Key", value: "NGFF, PCIe+USB (Wi-Fi/BT, 4× antenna)" },
          { label: "DI/DO", value: "Optional 8×DI + 8×DO" },
        ],
      },
      {
        category: "Power",
        items: [
          { label: "Input", value: "AC/DC 110-220V 50~60Hz" },
          { label: "Max Load", value: "60W" },
          { label: "Redundancy", value: "Optional dual PSU" },
        ],
      },
      {
        category: "Environment",
        items: [
          { label: "Operating Temp", value: "-20°C to +55°C" },
          { label: "Storage Temp", value: "-40°C to +85°C" },
          { label: "Humidity", value: "5%~95%, non-condensing" },
          { label: "EMC", value: "Power Grid Class A" },
        ],
      },
      {
        category: "Physical",
        items: [
          { label: "Form Factor", value: "Standard 1U Rack Mount" },
          { label: "Dimensions", value: "427.93mm × 301.5mm × 44.5mm" },
          { label: "Weight", value: "4.2 kg" },
          { label: "Material", value: "Sheet metal" },
        ],
      },
      {
        category: "Software",
        items: [
          { label: "OS", value: "Linux, Windows" },
          { label: "Monitoring", value: "Watchdog (ITE8786E), auto/manual fan control" },
        ],
      },
    ],
  },
];

async function main() {
  // Clear existing data
  await prisma.specItem.deleteMany();
  await prisma.specGroup.deleteMany();
  await prisma.product.deleteMany();

  for (const p of products) {
    const product = await prisma.product.create({
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
  }

  console.log(`\nSeeded ${products.length} products total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
