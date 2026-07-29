"use server";

/**
 * lib/actions/notificationsAdmin.js — Admin notification-settings mutations
 * (route-independent, ADR-W009).
 *
 * Gates on a real session + frontend permission (CR-3) before calling the
 * backend, which independently enforces `manage_venues` on the route — a stale
 * client role can never over-write. Input is validated authoritatively with the
 * shared `notificationSettingsSchema` (HI-2). The settings read these actions
 * affect is an uncached DAL read, so consumers refresh the route on success.
 */

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { hasPermission } from "@/lib/rbac";
import { normalizeNotificationSettings } from "@/lib/normalizers";
import { notificationSettingsSchema } from "@/lib/schemas";
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

/**
 * Upserts a venue's notification toggles (reminders and/or review requests).
 * `manage_venues`. Delivery stays dry-run until Meta WhatsApp is configured.
 * @param {string} venueId
 * @param {object} input - Unvalidated toggles ({ reminders_enabled?, review_requests_enabled? }).
 */
export async function updateNotificationSettingsAction(venueId, input) {
  const denied = await requireActionPermission("manage_venues");
  if (denied) return denied;

  if (typeof venueId !== "string" || !UUID_PATTERN.test(venueId)) {
    return fail(null, { code: "bad_request", message: "Invalid venue reference." });
  }
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(null, {
      code: "bad_request",
      message: parsed.error.issues[0]?.message || "Please change at least one setting.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const tokens = await readTokens();
    const { payload } = await apiRequest("/api/v1/notifications/settings", {
      method: "PATCH",
      body: { venue_id: venueId, ...parsed.data },
      ...tokens,
      retryOnUnauthorized: true,
    });
    return ok(normalizeNotificationSettings(payload.data));
  } catch (error) {
    if (error?.code === "bad_request") {
      return fail(error);
    }
    if (error?.code === "forbidden" || error?.code === "not_found") {
      return fail(error, { message: "You cannot change notification settings for this venue." });
    }
    return fail(error, { message: "We couldn't save the notification settings. Please try again." });
  }
}
