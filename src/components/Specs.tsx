const specs = [
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
      { label: "Mounting", value: "Desktop, Wall, 19\" Rack, Outdoor Enclosure" },
    ],
  },
];

export default function Specs() {
  return (
    <section id="specs" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Technical Specifications
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Enterprise-grade hardware in a compact, fanless form factor.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {specs.map((section) => (
            <div
              key={section.category}
              className="border border-gray-100 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-900 text-white px-5 py-3 font-semibold text-sm">
                {section.category}
              </div>
              <div className="divide-y divide-gray-50">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex px-5 py-3 text-sm"
                  >
                    <span className="w-32 shrink-0 font-medium text-gray-500">
                      {item.label}
                    </span>
                    <span className="text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
