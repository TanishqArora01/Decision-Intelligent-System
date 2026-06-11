/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8400',
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL || 'http://127.0.0.1:8400'}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: '/login', destination: '/sign-in', permanent: false },
      { source: '/dashboard', destination: '/mission-control', permanent: false },
      { source: '/live-feed', destination: '/fraud-guard', permanent: false },
      { source: '/streaming', destination: '/infrastructure', permanent: false },
      { source: '/assistant', destination: '/copilot', permanent: false },
      { source: '/audit', destination: '/audit-trail', permanent: false },
      { source: '/rules', destination: '/rules-engine', permanent: false },
      { source: '/review-queue', destination: '/fraud-guard/review', permanent: false },
    ];
  },
};
module.exports = nextConfig;
