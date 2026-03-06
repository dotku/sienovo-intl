"use client";

import Image from "next/image";
import { useState } from "react";

const cases = [
  {
    title: "Construction Site Monitoring",
    description:
      "AI-powered perimeter detection and safety monitoring at construction sites. Real-time alerts for unauthorized entry and safety violations.",
    image: "/images/pptx/case-s31-image166.png",
    video: "/images/pptx/case-s30-image143.mp4",
  },
  {
    title: "Restricted Zone Access Control",
    description:
      "Automated detection of personnel entering restricted areas with instant alert notifications and evidence capture.",
    image: "/images/pptx/case-s32-image163.png",
    video: "/images/pptx/case-s32-image161.mp4",
  },
  {
    title: "Logistics & Warehouse Security",
    description:
      "Intelligent monitoring of loading docks and warehouse areas with vehicle and personnel tracking alerts.",
    image: "/images/pptx/case-s33-image169.png",
    video: "/images/pptx/case-s33-image168.mp4",
  },
  {
    title: "Aquaculture Monitoring",
    description:
      "24/7 automated surveillance of aquaculture facilities with intrusion detection and environmental monitoring.",
    image: "/images/pptx/case-s34-image170.png",
    video: "/images/pptx/case-s34-image171.mp4",
  },
  {
    title: "Mining Safety",
    description:
      "Underground mining safety monitoring with worker detection, PPE compliance, and hazard alerts in challenging environments.",
    image: "/images/pptx/case-s35-image173.png",
    secondImage: "/images/pptx/case-s35-image172.png",
  },
];

export default function Cases() {
  const [activeCase, setActiveCase] = useState(0);
  const current = cases[activeCase];

  return (
    <section id="cases" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Real-World Deployments
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            See the INT-AIBOX in action across diverse industries with live AI
            analytics and real-time alert systems.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Case selector tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {cases.map((c, index) => (
              <button
                key={c.title}
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

          {/* Main content */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Video or primary image */}
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
              {current.video ? (
                <video
                  key={current.video}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src={current.video} type="video/mp4" />
                </video>
              ) : (
                <Image
                  src={current.image}
                  alt={current.title}
                  fill
                  className="object-cover"
                />
              )}
            </div>

            {/* Info + secondary image */}
            <div className="flex flex-col gap-4">
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden shadow">
                <Image
                  src={
                    current.video
                      ? current.image
                      : current.secondImage || current.image
                  }
                  alt={`${current.title} - platform view`}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {current.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {current.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
