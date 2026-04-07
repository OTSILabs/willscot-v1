import type { NextConfig } from "next";

// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    // middlewareClientMaxBodySize: "50mb",
    proxyClientMaxBodySize: "50mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ws-s3-unit-attribute-capture-nova.s3-accelerate.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "ws-s3-unit-attribute-capture-nova.s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
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
