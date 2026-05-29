import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DJUN_DISABLE_CMS: process.env.DJUN_DISABLE_CMS ?? ""
  },
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
