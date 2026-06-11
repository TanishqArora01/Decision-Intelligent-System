/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' is for Docker/Node deployments only.
  // Netlify uses its own serverless adapter — default output mode required.
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL:       process.env.NEXT_PUBLIC_API_URL       || 'http://localhost:8400',
    NEXT_PUBLIC_FRONTEND_PORT: process.env.NEXT_PUBLIC_FRONTEND_PORT || '3001',
  },
  async rewrites() {
    // In production on Netlify, BACKEND_INTERNAL_URL should be set to your deployed backend URL
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8400';
    return [{ source: '/api/backend/:path*', destination: `${backendUrl}/:path*` }];
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options',        value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options',  value: 'nosniff' },
        { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
module.exports = nextConfig;
