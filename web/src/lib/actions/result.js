/**
 * result.js — The single typed result contract for Server Actions (ME-1).
 *
 * Not a `"use server"` module (so it may export non-action helpers). Every
 * mutation action returns one of these shapes; consumers branch on `ok` and, for
 * failures, on `error.code`/`error.status` — never on human-readable messages.
 *
 *   success: { ok: true, data }
 *   failure: { ok: false, error: { code, message, status, fieldErrors? } }
 */

/**
 * @param {*} data
 * @returns {{ ok: true, data: * }}
 */
export function ok(data) {
  return { ok: true, data };
}

/**
 * @param {unknown} error - An ApiError, Zod-flattened errors, or a plain Error.
 * @param {{ code?: string, message?: string, status?: number, fieldErrors?: object }} [override]
 * @returns {{ ok: false, error: { code: string, message: string, status: number, fieldErrors?: object } }}
 */
export function fail(error, override = {}) {
  return {
    ok: false,
    error: {
      code: override.code || error?.code || "api_error",
      message: override.message || error?.message || "Something went wrong. Please try again.",
      status: override.status ?? error?.status ?? 0,
      ...(override.fieldErrors ? { fieldErrors: override.fieldErrors } : {}),
    },
  };
}
