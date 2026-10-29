import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `next dev` only: lets a phone on the same Wi-Fi load the dev server through this PC's
  // address (Next blocks its dev scripts for other origins by default). No effect in production.
  allowedDevOrigins: ['192.168.1.11'],
};

export default nextConfig;
