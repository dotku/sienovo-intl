export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <p className="text-xl font-bold text-white mb-2">SIENOVO</p>
            <p className="text-sm leading-relaxed">
              Exclusive global distributor for intelligent edge AI computing
              solutions. Empowering industries with next-generation video
              analytics.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-3 text-sm">Product</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#scenarios" className="hover:text-white transition-colors">
                  Scenarios
                </a>
              </li>
              <li>
                <a href="#specs" className="hover:text-white transition-colors">
                  Specifications
                </a>
              </li>
              <li>
                <a href="#platform" className="hover:text-white transition-colors">
                  AI Platform
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-3 text-sm">Contact</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:sales@sienovo.com"
                  className="hover:text-white transition-colors"
                >
                  sales@sienovo.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.sienovo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  www.sienovo.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} Sienovo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
