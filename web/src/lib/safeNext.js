/**
 * safeNext.js — Open-redirect guard for post-auth `next` parameters.
 *
 * Framework-free (no next/* imports) so it is safe to import from ANY context:
 * proxy, server components, server actions, client components, and tests.
 *
 * A value is only considered safe when it is a same-origin, path-absolute URL.
 * We reject:
 *   - protocol-relative URLs (`//evil.com`)          → would navigate off-site
 *   - backslash-escaped variants (`/\evil.com`)      → normalized to `//` by browsers
 *   - anything that does not start with a single `/`  → not a local path
 */

/**
 * Returns `next` when it is a safe same-origin path, otherwise `fallback`.
 *
 * @param {unknown} next - The candidate redirect target (typically from a query param).
 * @param {string} [fallback="/"] - The value to return when `next` is unsafe.
 * @returns {string}
 */
export function safeNext(next, fallback = "/") {
  const value = typeof next === "string" ? next : "";
  const isSafe =
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\");
  return isSafe ? value : fallback;
}
