import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Disabled for local development - enable for static deployment
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
