/**
 * csp.js — Content-Security-Policy construction (ADR-W006).
 *
 * Framework-free (no next/* imports) so it can be imported by next.config.mjs
 * (relative) and by any runtime module (@/lib).
 *
 * ── Why a single STATIC CSP (SRI-backed), not per-request nonces ──
 * This app runs `cacheComponents: true`, so every route is Partial-Prerendered
 * or fully static — there are no fully-dynamic routes. Per the official Next.js
 * CSP guide, **nonce-based CSP requires dynamic rendering and is incompatible
 * with PPR** ("static shell scripts won't have access to the nonce"). Injecting
 * a per-request nonce from the proxy would therefore break the prebuilt PPR
 * shells at runtime. ADR-W006 lists SRI as the mechanism that *preserves*
 * SSG/PPR, and ADR-W004/Phase 3 depend on that PPR output — so we adopt the
 * SRI path uniformly (`experimental.sri` adds integrity hashes to every emitted
 * script) and set one static CSP for all routes.
 *
 * `'unsafe-inline'` remains on `script-src` only because Next.js emits inline
 * RSC-streaming/bootstrap scripts into the prerendered HTML whose hashes vary
 * per stream and cannot be enumerated at config time. Its risk is bounded by
 * (a) SRI integrity on all external scripts and (b) the strict `connect-src`
 * allowlist below, which blocks XSS exfiltration regardless of inline execution.
 */

/** Third-party origins the app legitimately talks to. */
export const MAPTILER_ORIGIN = "https://api.maptiler.com";
export const PHONEPE_ORIGINS = [
  "https://mercury.phonepe.com",
  "https://mercury-uat.phonepe.com",
];

/**
 * Resolves the backend API origin (scheme + host) for the `connect-src` allowlist.
 * @returns {string}
 */
export function getApiOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:5000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:5000";
  }
}

/**
 * Builds the application Content-Security-Policy header value.
 * @returns {string}
 */
export function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV === "development";
  const api = getApiOrigin();
  const phonepe = PHONEPE_ORIGINS.join(" ");

  // Inline RSC bootstrap scripts require 'unsafe-inline' on static/PPR output.
  // Dev additionally needs 'unsafe-eval' for React Refresh / error overlays.
  const scriptSrc = `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAPTILER_ORIGIN}`,
    "font-src 'self' data:",
    `connect-src 'self' ${api} ${MAPTILER_ORIGIN} ${phonepe}`,
    `frame-src 'self' ${phonepe}`,
    "worker-src 'self' blob:",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ") + ";";
}
