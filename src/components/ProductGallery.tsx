"use client";

import Image from "next/image";
import { useState } from "react";

const views = [
  {
    id: "3d",
    label: "3D View",
    src: "/images/pptx/aibox-sg8.png",
    alt: "INT-AIBOX-P-8 3D product view",
    description:
      "Compact fanless design with heatsink fins for passive cooling",
  },
  {
    id: "front",
    label: "Front Panel",
    src: "/images/pptx/aibox-lineup.png",
    alt: "INT-AIBOX-P-8 front panel with interfaces",
    description:
      "SSD/STAT/PWR LEDs, LAN/WAN ports, HDMI, USB 3.0, Type-C, microSD, SIM card slot",
  },
  {
    id: "16ch",
    label: "16-Channel Model",
    src: "/images/pptx/aibox-sg16.png",
    alt: "INT-AIBOX-SG-16 16-channel model",
    description:
      "Higher-capacity 16-channel variant for larger deployments",
  },
];

export default function ProductGallery() {
  const [active, setActive] = useState(0);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Product Design
          </h2>
          <p className="text-lg text-gray-500">
            219.8mm x 200mm x 46.8mm — only 1.93 kg
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative aspect-[16/9] bg-gray-50 rounded-lg overflow-hidden mb-4">
            <Image
              src={views[active].src}
              alt={views[active].alt}
              fill
              className="object-contain p-8"
            />
          </div>

          <p className="text-center text-sm text-gray-500 mb-6">
            {views[active].description}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {views.map((view, index) => (
              <button
                key={view.id}
                onClick={() => setActive(index)}
                className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors ${
                  active === index
                    ? "border-accent"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <Image
                  src={view.src}
                  alt={view.label}
                  fill
                  className="object-contain p-2"
                />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-1 text-center">
                  {view.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
