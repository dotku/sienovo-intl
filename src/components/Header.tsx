export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="bg-accent h-1" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              SIENOVO
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-accent transition-colors">
              Features
            </a>
            <a
              href="#scenarios"
              className="hover:text-accent transition-colors"
            >
              Scenarios
            </a>
            <a href="#cases" className="hover:text-accent transition-colors">
              Cases
            </a>
            <a href="#specs" className="hover:text-accent transition-colors">
              Specifications
            </a>
            <a href="#platform" className="hover:text-accent transition-colors">
              Platform
            </a>
            <a
              href="#contact"
              className="bg-accent text-white px-5 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Contact Sales
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
