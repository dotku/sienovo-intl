import Image from "next/image";

export default function Platform() {
  return (
    <section id="platform" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Intelligent AI Management Platform
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Built-in web-based management platform with visualization dashboard,
            real-time alerts, and comprehensive device management — all
            accessible via browser.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <div className="relative aspect-[16/9] bg-gray-900 rounded-lg overflow-hidden shadow-xl">
            <Image
              src="/images/pptx/platform-overview.png"
              alt="AI Management Platform Dashboard"
              fill
              className="object-contain"
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            Real-time visualization dashboard with map-based device overview,
            alert statistics, and AI analytics.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <div className="relative aspect-[16/10] bg-white rounded-lg overflow-hidden shadow border border-gray-100">
            <Image
              src="/images/pptx/aibox-intro.png"
              alt="System Architecture - Edge AI Analytics"
              fill
              className="object-contain p-4"
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            System architecture: Connect existing cameras (SDC, IPC, NVR) to
            edge AI box for real-time intelligent analysis.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {[
            {
              name: "Smart Monitoring",
              description:
                "Real-time video preview with map-based device overview, system resource monitoring, and alert statistics.",
            },
            {
              name: "Visualization Mode",
              description:
                "Full-screen data visualization with live AI video analysis, device status, and alarm trends.",
            },
            {
              name: "Alert Center",
              description:
                "Centralized alarm management for behavior analysis, vehicle alerts, and personnel alerts with evidence.",
            },
            {
              name: "Intelligent Analysis",
              description:
                "Structured data for personnel and vehicle attributes with search and filtering capabilities.",
            },
            {
              name: "Device Management",
              description:
                "Cascade multiple edge boxes, connect smart cameras, legacy cameras, and IoT devices.",
            },
            {
              name: "System Management",
              description:
                "Network configuration, algorithm updates, platform upgrades, and maintenance tools.",
            },
          ].map((mod) => (
            <div
              key={mod.name}
              className="bg-white rounded-lg p-6 border border-gray-100"
            >
              <h3 className="font-semibold text-gray-900 mb-2">{mod.name}</h3>
              <p className="text-sm text-gray-500">{mod.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <p className="text-gray-300 text-sm mb-2">Northbound API Support</p>
          <div className="flex flex-wrap justify-center gap-4 text-white font-medium">
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">
              HTTP REST API
            </span>
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">
              MQTT Protocol
            </span>
            <span className="bg-gray-800 px-4 py-2 rounded text-sm">
              GB28181
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-4">
            Rich northbound APIs to integrate with your existing business
            platforms and upper-layer applications.
          </p>
        </div>
      </div>
    </section>
  );
}
