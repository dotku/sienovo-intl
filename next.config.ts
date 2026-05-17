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
