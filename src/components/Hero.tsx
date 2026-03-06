import Image from "next/image";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-accent font-semibold text-sm uppercase tracking-wider mb-4">
              Intelligent Edge AI Analytics
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              INT-AIBOX-P-8
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
              High-performance, low-power edge computing device with{" "}
              <span className="text-white font-semibold">7.2 TOPS</span> INT8
              AI computing power. Process{" "}
              <span className="text-white font-semibold">
                8 channels of HD video
              </span>{" "}
              simultaneously with 40+ built-in AI algorithms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#contact"
                className="bg-accent hover:bg-red-700 text-white px-8 py-3 rounded font-medium text-center transition-colors"
              >
                Request a Quote
              </a>
              <a
                href="#specs"
                className="border border-gray-500 hover:border-white text-white px-8 py-3 rounded font-medium text-center transition-colors"
              >
                View Specifications
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
          {[
            { value: "7.2", unit: "TOPS", label: "INT8 AI Computing Power" },
            { value: "8", unit: "CH", label: "HD Video Channels" },
            { value: "40+", unit: "", label: "Built-in AI Algorithms" },
            { value: "12.5", unit: "W", label: "Typical Power Consumption" },
          ].map((stat) => (
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
