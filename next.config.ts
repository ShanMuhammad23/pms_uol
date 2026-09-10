import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  // Runtime uploads must never be file-traced into the server bundle.
  outputFileTracingExcludes: {
    "/*": ["./uploads/**/*"],
  },
};

export default nextConfig;
