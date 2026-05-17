import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Keep gRPC-based packages out of the bundle — Turbopack can't load their
  // native bindings, causing runReport() to surface as the cryptic
  // "Error: undefined undefined: undefined" from google-gax.
  serverExternalPackages: [
    "@google-analytics/data",
    "google-gax",
    "@grpc/grpc-js",
  ],
  // Vercel's serverless function bundler doesn't auto-trace files that
  // are read via `fs.readdirSync(process.cwd() + "/content/...")` at
  // request time — they're outside the import graph. Without this, the
  // sitemap, blog list and post detail routes see empty content/ in
  // production and silently render zero entries.
  outputFileTracingIncludes: {
    "/sitemap.xml/route": ["./content/blog/**", "./content/blog-en/**"],
    "/sitemap/[__metadata_id__]/route": [
      "./content/blog/**",
      "./content/blog-en/**",
    ],
    "/blog/page": ["./content/blog/**", "./content/blog-en/**"],
    "/blog/[slug]/page": ["./content/blog/**", "./content/blog-en/**"],
    "/blog/all/page": ["./content/blog/**", "./content/blog-en/**"],
    "/zh/blog/page": ["./content/blog/**", "./content/blog-en/**"],
    "/zh/blog/[slug]/page": ["./content/blog/**", "./content/blog-en/**"],
    "/zh/blog/all/page": ["./content/blog/**", "./content/blog-en/**"],
    "/rss.xml/route": ["./content/blog/**", "./content/blog-en/**"],
    "/zh/rss.xml/route": ["./content/blog/**", "./content/blog-en/**"],
  },
  async redirects() {
    return [
      {
        source: "/en/blog",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/en/blog/:slug*",
        destination: "/blog/:slug*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "sienovo-intl.vercel.app" }],
        destination: "https://sienovo.jytech.us/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
