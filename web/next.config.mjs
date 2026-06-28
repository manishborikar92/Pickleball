/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  images: {
    localPatterns: [
      { pathname: '/court-*.png' },
      { pathname: '/baseline-*.svg' },
      { pathname: '/canteen-beverages.png' },
    ],
    remotePatterns: [],
  },
  logging: {
    fetches: { fullUrl: process.env.NODE_ENV === 'development' },
  },
  async headers() {
    // Auth pages get a stricter CSP. The admin login lives at /admin/login (two
    // segments), so it needs its own source rule alongside the single-segment pages.
    const authCsp = [
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'none'; object-src 'none';",
      },
    ];
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/(login|onboarding)',
        headers: authCsp,
      },
      {
        source: '/admin/login',
        headers: authCsp,
      },
    ];
  },
};

export default nextConfig;
