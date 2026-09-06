import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@whiskeysockets/baileys", "jimp", "pino", "pino-pretty"],
};

export default nextConfig;
