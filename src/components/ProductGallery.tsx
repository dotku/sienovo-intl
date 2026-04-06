"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

const VIEW_IMAGES = [
  { src: "/images/pptx/aibox-sg8.png", alt: "INT-AIBOX-P-8 3D product view" },
  { src: "/images/pptx/aibox-lineup.png", alt: "INT-AIBOX-P-8 front panel with interfaces" },
  { src: "/images/pptx/aibox-sg16.png", alt: "INT-AIBOX-SG-16 16-channel model" },
];

export default function ProductGallery() {
  const [active, setActive] = useState(0);
  const { dict } = useI18n();
  const t = dict.gallery;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.title}</h2>
          <p className="text-lg text-gray-500">{t.subtitle}</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="relative aspect-[16/9] bg-gray-50 rounded-lg overflow-hidden mb-4">
            <Image
              src={VIEW_IMAGES[active].src}
              alt={VIEW_IMAGES[active].alt}
              fill
              className="object-contain p-8"
            />
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            {t.views[active].description}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {VIEW_IMAGES.map((view, index) => (
              <button
                key={index}
                onClick={() => setActive(index)}
                className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors ${
                  active === index ? "border-accent" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <Image src={view.src} alt={t.views[index].label} fill className="object-contain p-2" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-1 text-center">
                  {t.views[index].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
