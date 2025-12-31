import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack is the default in Next.js 16
  // Module resolution should work correctly when running from the project directory
  turbopack: {},
};

export default nextConfig;
