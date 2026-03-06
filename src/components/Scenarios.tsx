import Image from "next/image";

const scenarios = [
  {
    name: "Smart Community",
    description:
      "Enhance residential security with people/vehicle monitoring, access control, and perimeter intrusion detection.",
    algorithms: [
      "Face Recognition",
      "License Plate Recognition",
      "Intrusion Detection",
    ],
    image: "/images/pptx/scene-community.png",
  },
  {
    name: "Smart Gas Station",
    description:
      "Ensure safety compliance with smoking detection, phone usage alerts, fire hazard monitoring, and more.",
    algorithms: ["Phone Usage Detection", "Smoking Detection", "Fire Detection"],
    image: "/images/pptx/scene-gasstation.png",
  },
  {
    name: "Smart Construction",
    description:
      "Construction site safety monitoring with worker PPE compliance, climbing detection, and equipment tracking.",
    algorithms: ["Helmet Detection", "Climbing Detection", "Vehicle Detection"],
    image: "/images/pptx/scene-construction.png",
  },
  {
    name: "Smart Park / Campus",
    description:
      "Protect public areas with perimeter security, people counting, and behavioral analytics.",
    algorithms: ["Perimeter Intrusion", "People Counting", "Abnormal Behavior"],
    image: "/images/pptx/scene-park.png",
  },
  {
    name: "Liquor & Retail Safety",
    description:
      "Monitor store operations including customer flow, safety compliance, and theft prevention.",
    algorithms: ["People Counting", "Abnormal Behavior", "Fire Detection"],
    image: "/images/pptx/scene-liquor.png",
  },
  {
    name: "Waste & Environmental",
    description:
      "Environmental monitoring for waste management, illegal dumping detection, and sanitation compliance.",
    algorithms: ["Object Detection", "Illegal Dumping", "Worker Safety"],
    image: "/images/pptx/scene-waste.png",
  },
];

export default function Scenarios() {
  return (
    <section id="scenarios" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Application Scenarios
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Ready-to-deploy AI analytics for diverse industry verticals. Custom
            algorithm combinations available with 40+ algorithms to choose from.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.name}
              className="bg-white rounded-lg overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={scenario.image}
                  alt={scenario.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {scenario.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {scenario.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {scenario.algorithms.map((algo) => (
                    <span
                      key={algo}
                      className="text-xs bg-red-50 text-accent px-2 py-1 rounded"
                    >
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
