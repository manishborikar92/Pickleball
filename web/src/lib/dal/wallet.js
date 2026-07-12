/**
 * dal/wallet.js — User-scoped wallet read with authorization.
 *
 * Per-user, balance-sensitive → uncached, session-verified at the boundary.
 */

import "server-only";
import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { normalizeWalletResponse } from "@/lib/normalizers";
import { COOKIE_NAMES } from "@/config/auth.config";

/**
 * The current user's wallet (balance + transactions).
 * @returns {Promise<object>}
 */
export async function getWallet() {
  const session = await verifySession();
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }

  const store = await cookies();
  const { payload } = await apiRequest("/api/v1/users/me/wallet", {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
    retryOnUnauthorized: true,
  });
  return normalizeWalletResponse(payload.data);
}
