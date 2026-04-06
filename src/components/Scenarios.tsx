"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";

const IMAGES = [
  "/images/pptx/scene-community.png",
  "/images/pptx/scene-gasstation.png",
  "/images/pptx/scene-construction.png",
  "/images/pptx/scene-park.png",
  "/images/pptx/scene-liquor.png",
  "/images/pptx/scene-waste.png",
];

export default function Scenarios() {
  const { dict } = useI18n();
  const t = dict.scenarios;

  return (
    <section id="scenarios" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.title}</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t.subtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.items.map((scenario: { name: string; description: string; algorithms: string[] }, i: number) => (
            <div
              key={i}
              className="bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={IMAGES[i]}
                  alt={scenario.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{scenario.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{scenario.description}</p>
                <div className="flex flex-wrap gap-2">
                  {scenario.algorithms.map((algo: string) => (
                    <span key={algo} className="text-xs bg-red-50 text-accent px-2 py-1 rounded">
                      {algo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
