"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";

export default function Hero() {
  const { dict } = useI18n();
  const t = dict.hero;

  const stats = [
    { value: "7.2", unit: "TOPS", label: t.stat1Label },
    { value: "8", unit: "CH", label: t.stat2Label },
    { value: "40+", unit: "", label: t.stat3Label },
    { value: "12.5", unit: "W", label: t.stat4Label },
  ];

  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-accent font-semibold text-sm uppercase tracking-wider mb-4">
              {t.tagline}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t.title}
            </h1>
            <p
              className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: t.description }}
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#contact"
                className="bg-accent hover:bg-red-700 text-white px-8 py-3 rounded font-medium text-center transition-colors"
              >
                {t.requestQuote}
              </a>
              <a
                href="#specs"
                className="border border-gray-500 hover:border-white text-white px-8 py-3 rounded font-medium text-center transition-colors"
              >
                {t.viewSpecs}
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative w-full max-w-md aspect-[4/3]">
              <Image
                src="/images/pptx/aibox-sg8.png"
                alt="INT-AIBOX-P-8 Intelligent Edge AI Analytics Box"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-12 border-t border-gray-700">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-white">
                {stat.value}
                <span className="text-accent text-lg ml-1">{stat.unit}</span>
              </p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
