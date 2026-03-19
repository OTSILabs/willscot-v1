import type { NextConfig } from "next";

// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    // middlewareClientMaxBodySize: "50mb",
    proxyClientMaxBodySize: "50mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "X-Frame-Options",
            value: "", // Remove SAMEORIGIN restriction
          },
        ],
      },
    ];
  },
};
export default nextConfig;
