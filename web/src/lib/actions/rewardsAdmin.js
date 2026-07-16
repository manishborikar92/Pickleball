"use server";

/**
 * lib/actions/rewardsAdmin.js — Admin reward mutations (route-independent,
 * ADR-W009).
 *
 * Every action gates on a real session + frontend permission (CR-3) before
 * calling the backend, which independently re-authorizes per route
 * (`edit_pricing` for mechanisms, `manage_bookings` for instances) — a stale
 * client role can never over-write. Mechanism input is validated
 * authoritatively with the shared `rewardMechanismSchema` (HI-2). All reads
 * these actions affect are uncached DAL reads, so consumers refresh the route
 * after a success instead of tag revalidation.
 */

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { hasPermission } from "@/lib/rbac";
import {
  normalizeModerationInstance,
  normalizeRewardMechanism,
} from "@/lib/normalizers";
import { rewardMechanismSchema, redemptionNoteSchema } from "@/lib/schemas";
import { ok, fail } from "@/lib/actions/result";
import { COOKIE_NAMES } from "@/config/auth.config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readTokens() {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };
}

async function requireActionPermission(permission) {
  const session = await verifySession();
  if (!session?.user) {
    return fail(null, {
      code: "unauthorized",
      status: 401,
      message: "Your session has expired. Please sign in again.",
    });
  }
  if (!hasPermission(session.role, permission)) {
    return fail(null, {
      code: "forbidden",
      status: 403,
      message: "You do not have permission to perform this action.",
    });
  }
  return null;
}

/** Builds the backend mechanism payload from validated form input. */
function toMechanismBody(parsed) {
  return {
    name: parsed.name,
    instance_expiry_days: parsed.instance_expiry_days,
    is_active: parsed.is_active,
    config: {
      prizes: parsed.prizes.map((prize) => ({
        id: prize.id,
        label: prize.label,
        type: prize.type,
        probability: prize.probability,
        ...(prize.type === "voucher" && prize.terms ? { terms: prize.terms } : {}),
        ...(prize.type === "voucher" && prize.validity_days !== undefined
          ? { validity_days: prize.validity_days }
          : {}),
      })),
    },
  };
}

/**
 * Creates a reward mechanism for the venue. `edit_pricing`.
 * @param {string} venueId
 * @param {object} input - Unvalidated editor state.
 */
export async function createRewardMechanismAction(venueId, input) {
  const denied = await requireActionPermission("edit_pricing");
  if (denied) return denied;

  if (typeof venueId !== "string" || !UUID_PATTERN.test(venueId)) {
    return fail(null, { code: "bad_request", message: "Invalid venue reference." });
  }
  const parsed = rewardMechanismSchema.safeParse(input);
  if (!parsed.success) {
    return fail(null, {
      code: "bad_request",
      message: parsed.error.issues[0]?.message || "Please complete the mechanism form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest("/api/v1/rewards/mechanisms", {
      method: "POST",
      body: {
        venue_id: venueId,
        type: parsed.data.type,
        trigger_event: "booking_confirmed",
        ...toMechanismBody(parsed.data),
      },
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok(normalizeRewardMechanism(payload.data));
  } catch (error) {
    if (error?.code === "bad_request") {
      return fail(error);
    }
    return fail(error, { message: "We couldn't create the mechanism. Please try again." });
  }
}

/**
 * Updates a mechanism (name, prize pool, expiry, active state). `edit_pricing`.
 * @param {string} mechanismId
 * @param {object} input - Unvalidated editor state.
 */
export async function updateRewardMechanismAction(mechanismId, input) {
  const denied = await requireActionPermission("edit_pricing");
  if (denied) return denied;

  if (typeof mechanismId !== "string" || !UUID_PATTERN.test(mechanismId)) {
    return fail(null, { code: "bad_request", message: "Invalid mechanism reference." });
  }
  const parsed = rewardMechanismSchema.safeParse(input);
  if (!parsed.success) {
    return fail(null, {
      code: "bad_request",
      message: parsed.error.issues[0]?.message || "Please complete the mechanism form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest(`/api/v1/rewards/mechanisms/${mechanismId}`, {
      method: "PATCH",
      body: toMechanismBody(parsed.data),
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok(normalizeRewardMechanism(payload.data));
  } catch (error) {
    if (error?.code === "not_found") {
      return fail(error, { message: "This mechanism no longer exists." });
    }
    if (error?.code === "bad_request") {
      return fail(error);
    }
    return fail(error, { message: "We couldn't save the mechanism. Please try again." });
  }
}

/**
 * Toggles a mechanism's active state without touching its config. `edit_pricing`.
 * @param {string} mechanismId
 * @param {boolean} isActive
 */
export async function setRewardMechanismActiveAction(mechanismId, isActive) {
  const denied = await requireActionPermission("edit_pricing");
  if (denied) return denied;

  if (typeof mechanismId !== "string" || !UUID_PATTERN.test(mechanismId)) {
    return fail(null, { code: "bad_request", message: "Invalid mechanism reference." });
  }

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest(`/api/v1/rewards/mechanisms/${mechanismId}`, {
      method: "PATCH",
      body: { is_active: Boolean(isActive) },
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok(normalizeRewardMechanism(payload.data));
  } catch (error) {
    if (error?.code === "not_found") {
      return fail(error, { message: "This mechanism no longer exists." });
    }
    return fail(error, { message: "We couldn't update the mechanism. Please try again." });
  }
}

/**
 * Marks a revealed voucher redeemed at the stall. `manage_bookings`.
 * First redemption wins — a concurrent scan gets the backend's 409.
 * @param {string} instanceId
 * @param {string} [note]
 */
export async function redeemVoucherAction(instanceId, note = "") {
  const denied = await requireActionPermission("manage_bookings");
  if (denied) return denied;

  if (typeof instanceId !== "string" || !UUID_PATTERN.test(instanceId)) {
    return fail(null, { code: "bad_request", message: "Invalid reward reference." });
  }
  const parsedNote = redemptionNoteSchema.parse(note);

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest(`/api/v1/rewards/instances/${instanceId}/redeem`, {
      method: "PATCH",
      body: parsedNote ? { note: parsedNote } : {},
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok({
      instanceId: payload.data.instance_id,
      voucherCode: payload.data.voucher_code,
      redeemedAt: payload.data.redeemed_at,
      redemptionNote: payload.data.redemption_note || "",
    });
  } catch (error) {
    if (error?.status === 410) {
      return fail(error, { code: "gone", message: "This voucher's validity period has passed." });
    }
    if (error?.code === "conflict") {
      // VOUCHER_ALREADY_REDEEMED and VOUCHER_NOT_REDEEMABLE both surface the
      // backend message — it is specific and actionable at the counter.
      return fail(error);
    }
    if (error?.code === "not_found") {
      return fail(error, { message: "We couldn't find this reward." });
    }
    return fail(error, { message: "We couldn't redeem the voucher. Please try again." });
  }
}

/**
 * Manually expires a pending (unrevealed) instance. `manage_bookings`.
 * @param {string} instanceId
 */
export async function expireRewardInstanceAction(instanceId) {
  const denied = await requireActionPermission("manage_bookings");
  if (denied) return denied;

  if (typeof instanceId !== "string" || !UUID_PATTERN.test(instanceId)) {
    return fail(null, { code: "bad_request", message: "Invalid reward reference." });
  }

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest(`/api/v1/rewards/instances/${instanceId}/expire`, {
      method: "PATCH",
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok({ instanceId: payload.data.instance_id, status: payload.data.status });
  } catch (error) {
    if (error?.code === "conflict") {
      return fail(error, { message: "Only pending rewards can be expired." });
    }
    if (error?.code === "not_found") {
      return fail(error, { message: "We couldn't find this reward." });
    }
    return fail(error, { message: "We couldn't expire the reward. Please try again." });
  }
}

/**
 * Looks up instances by voucher code (exact) for the redemption desk.
 * `manage_bookings`. A thin action wrapper over the moderation listing so the
 * client lookup box can query without a page reload.
 * @param {string} venueId
 * @param {string} voucherCode
 */
export async function lookupVoucherAction(venueId, voucherCode) {
  const denied = await requireActionPermission("manage_bookings");
  if (denied) return denied;

  if (typeof venueId !== "string" || !UUID_PATTERN.test(venueId)) {
    return fail(null, { code: "bad_request", message: "Invalid venue reference." });
  }
  const code = String(voucherCode || "").trim().toUpperCase();
  if (!code || code.length > 20) {
    return fail(null, { code: "bad_request", message: "Enter a voucher code to look up." });
  }

  try {
    const tokens = await readTokens();
    const params = new URLSearchParams({ venue_id: venueId, voucher_code: code, page: "1", limit: "5" });
    const { payload } = await apiRequest(`/api/v1/rewards/instances/moderation?${params}`, {
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok((payload.data || []).map(normalizeModerationInstance));
  } catch (error) {
    return fail(error, { message: "We couldn't look up that voucher. Please try again." });
  }
}
