import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Enable for static deployment
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
