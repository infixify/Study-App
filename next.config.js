/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  // Disable Next.js telemetry
  experimental: {
    // For static export
  },
};

module.exports = nextConfig;
