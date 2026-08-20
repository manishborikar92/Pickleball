/**
 * Reads Set-Cookie headers in both undici/Next server runtimes. Some server
 * Headers implementations expose Set-Cookie only through getSetCookie().
 */
export function getSetCookieHeader(headers) {
  if (!headers) return "";
  if (typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length > 0) return values.join(", ");
  }
  return headers.get?.("set-cookie") || "";
}
