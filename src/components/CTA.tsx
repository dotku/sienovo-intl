"use client";

export default function CTA() {
  return (
    <section
      id="contact"
      className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Deploy Edge AI?
        </h2>
        <p className="text-lg text-gray-300 mb-8">
          Contact our sales team for pricing, bulk orders, or custom algorithm
          requirements. We offer exclusive global distribution through Sienovo.
        </p>
        <div className="bg-gray-800 rounded-lg p-8 text-left max-w-md mx-auto">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Name
              </label>
              <input
                type="text"
                id="name"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Message
              </label>
              <textarea
                id="message"
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder="Tell us about your project requirements..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-accent hover:bg-red-700 text-white py-3 rounded font-medium transition-colors"
            >
              Send Inquiry
            </button>
          </form>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://calendly.com/sienovoleo"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-gray-900 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors text-sm"
          >
            Schedule a Demo Call
          </a>
          <span className="text-gray-500 text-sm">or</span>
          <a
            href="mailto:leo.liu@jytech.us"
            className="text-accent hover:underline text-sm"
          >
            leo.liu@jytech.us
          </a>
        </div>
      </div>
    </section>
  );
}
