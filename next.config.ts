import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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
