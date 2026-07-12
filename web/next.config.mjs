import { buildContentSecurityPolicy } from "./src/lib/csp.js";

/**
 * Security response headers applied to every route.
 *
 * CSP: a single static, SRI-backed policy is applied uniformly (see src/lib/csp.js
 * for why nonces are not used — they are incompatible with this app's PPR output).
 * `experimental.sri` below adds integrity hashes to every emitted script so the
 * policy is enforced without sacrificing static generation / CDN caching.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  experimental: {
    // Subresource Integrity for build-output scripts — defense-in-depth for the
    // public, statically-served pages that cannot carry a per-request nonce.
    sri: { algorithm: "sha256" },
    // Restrict Server Action invocation to trusted origins when deployed behind
    // a proxy domain (comma-separated env, e.g. "app.baselinearena.in").
    ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
      ? {
          serverActions: {
            allowedOrigins: process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(",")
              .map((origin) => origin.trim())
              .filter(Boolean),
          },
        }
      : {}),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/court-*.png" },
      { pathname: "/baseline-*.svg" },
      { pathname: "/canteen-beverages.png" },
    ],
    remotePatterns: [],
  },
  logging: {
    fetches: { fullUrl: process.env.NODE_ENV === "development" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
