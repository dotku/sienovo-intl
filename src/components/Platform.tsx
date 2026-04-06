"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";

export default function Platform() {
  const { dict } = useI18n();
  const t = dict.platform;

  return (
    <section id="platform" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.title}</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t.subtitle}</p>
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <div className="relative aspect-[16/9] bg-gray-900 rounded-lg overflow-hidden shadow-xl">
            <Image src="/images/pptx/platform-overview.png" alt="AI Management Platform Dashboard" fill className="object-contain" />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">{t.dashboardCaption}</p>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <div className="relative aspect-[16/10] bg-white rounded-lg overflow-hidden shadow border border-gray-100">
            <Image src="/images/pptx/aibox-intro.png" alt="System Architecture" fill className="object-contain p-4" />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">{t.archCaption}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {t.modules.map((mod: { name: string; description: string }) => (
            <div key={mod.name} className="bg-white rounded-lg p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">{mod.name}</h3>
              <p className="text-sm text-gray-500">{mod.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <p className="text-gray-300 text-sm mb-2">{t.apiTitle}</p>
          <div className="flex flex-wrap justify-center gap-4 text-white font-medium">
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">HTTP REST API</span>
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">MQTT Protocol</span>
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">GB28181</span>
          </div>
          <p className="text-gray-400 text-xs mt-4">{t.apiSubtitle}</p>
        </div>
      </div>
    </section>
  );
}
