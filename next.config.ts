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
  // Vercel's serverless function bundler doesn't auto-trace files read
  // via `fs.readdirSync(process.cwd() + "/content/...")` at request time
  // — they're outside the import graph. Glob-include every content path
  // for every route that reads them via getAllPosts/getPostBySlug.
  // Wildcard key catches future routes too without per-path bookkeeping.
  outputFileTracingIncludes: {
    // blog content for getAllPosts / sitemap; data/* for the bot-reports
    // page which reads SEO snapshots and devto state from disk.
    "**/*": [
      "./content/blog/**/*.mdx",
      "./content/blog-en/**/*.mdx",
      "./data/seo-reports/*.json",
      "./data/devto-published.jsonl",
    ],
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
