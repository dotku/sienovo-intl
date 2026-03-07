"use client";

import { useState } from "react";

const NAV_ITEMS = [
  { href: "#features", label: "Features" },
  { href: "#scenarios", label: "Scenarios" },
  { href: "#cases", label: "Cases" },
  { href: "#specs", label: "Specifications" },
  { href: "#platform", label: "Platform" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

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
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ))}
            <a
              href="https://calendly.com/sienovoleo"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
            >
              Book a Demo
            </a>
            <a
              href="#contact"
              className="bg-accent text-white px-5 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Contact Sales
            </a>
          </nav>
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block py-2 text-sm font-medium text-gray-600 hover:text-accent"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              href="https://calendly.com/sienovoleo"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-center border border-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-100 transition-colors text-sm font-medium"
              onClick={() => setOpen(false)}
            >
              Book a Demo
            </a>
            <a
              href="#contact"
              className="block text-center bg-accent text-white px-5 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
              onClick={() => setOpen(false)}
            >
              Contact Sales
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
