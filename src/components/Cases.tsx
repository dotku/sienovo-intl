"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

const CASE_MEDIA = [
  { image: "/images/pptx/case-s31-image166.png", video: "/images/pptx/case-s30-image143.mp4" },
  { image: "/images/pptx/case-s32-image163.png", video: "/images/pptx/case-s32-image161.mp4" },
  { image: "/images/pptx/case-s33-image169.png", video: "/images/pptx/case-s33-image168.mp4" },
  { image: "/images/pptx/case-s34-image170.png", video: "/images/pptx/case-s34-image171.mp4" },
  { image: "/images/pptx/case-s35-image173.png", secondImage: "/images/pptx/case-s35-image172.png" },
];

export default function Cases() {
  const [activeCase, setActiveCase] = useState(0);
  const { dict } = useI18n();
  const t = dict.cases;
  const current = t.items[activeCase];
  const media = CASE_MEDIA[activeCase];

  return (
    <section id="cases" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.title}</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t.subtitle}</p>
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {t.items.map((c: { title: string }, index: number) => (
              <button
                key={index}
                onClick={() => setActiveCase(index)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeCase === index
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
              {media.video ? (
                <video
                  key={media.video}
                  className="w-full h-full object-cover"
                  autoPlay loop muted playsInline
                >
                  <source src={media.video} type="video/mp4" />
                </video>
              ) : (
                <Image src={media.image} alt={current.title} fill className="object-cover" />
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden shadow">
                <Image
                  src={media.video ? media.image : (media.secondImage || media.image)}
                  alt={`${current.title} - platform view`}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{current.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
