"use server";

/**
 * lib/actions/rewards.js — Reward reveal mutation action (route-independent,
 * ADR-W009).
 *
 * Gates on a real session (CR-3) and returns the typed result contract (ME-1):
 * the scratch screen branches on `error.code` — conflict → already revealed
 * (refresh to the revealed view), gone (410 → `api_error` with status 410) →
 * expired state — never on message strings.
 */

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { normalizeRevealResponse } from "@/lib/normalizers";
import { ok, fail } from "@/lib/actions/result";
import { COOKIE_NAMES } from "@/config/auth.config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function revealRewardAction(instanceId) {
  const session = await verifySession();
  if (!session?.user) {
    return fail(null, {
      code: "unauthorized",
      status: 401,
      message: "Your session has expired. Please sign in to reveal your reward.",
    });
  }

  if (typeof instanceId !== "string" || !UUID_PATTERN.test(instanceId)) {
    return fail(null, { code: "bad_request", message: "Invalid reward reference." });
  }

  try {
    // Both tokens are required: the refresh token is what lets
    // `retryOnUnauthorized` recover from a mid-session access-token expiry (HI-9).
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
    const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

    const { payload } = await apiRequest(`/api/v1/rewards/instances/${instanceId}/reveal`, {
      method: "POST",
      accessToken,
      refreshToken,
      retryOnUnauthorized: true,
    });

    return ok(normalizeRevealResponse(payload.data));
  } catch (error) {
    if (error?.status === 410) {
      return fail(error, { code: "gone", message: "This reward has expired." });
    }
    if (error?.code === "conflict") {
      return fail(error, { message: "This reward has already been revealed." });
    }
    if (error?.code === "not_found") {
      return fail(error, { message: "We couldn't find this reward." });
    }
    if (error?.code === "unauthorized") {
      return fail(error, { message: "Your session has expired. Please sign in to reveal your reward." });
    }
    return fail(error, { message: "We couldn't reveal your reward. Please try again." });
  }
}
