import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  },
  serverExternalPackages: ["better-sqlite3", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb"
    }
  }
};

export default nextConfig;
