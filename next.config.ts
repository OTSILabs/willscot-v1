import type { NextConfig } from "next";

// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    // middlewareClientMaxBodySize: "50mb",
    proxyClientMaxBodySize: "50mb",
  },
};
export default nextConfig;
