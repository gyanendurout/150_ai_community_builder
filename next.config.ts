import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the "N" Next.js dev indicator in the corner — distracting in screenshots.
  devIndicators: false,
  // Produces a self-contained build in .next/standalone — required for the Dockerfile.
  output: 'standalone',
};

export default nextConfig;
