"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";

import { Badge, Card, FormAlert, Switch } from "@/components/shared";
import { StatusBadge } from "@/components/shared/Table";
import { updateNotificationSettingsAction } from "@/lib/actions/notificationsAdmin";
import { formatDateTime } from "@/lib/formatters";
import { ManagerSurface } from "./ManagerSurface";

/* ── Settings ───────────────────────────────────── */

/**
 * /admin/settings — venue-level notification governance (super_admin /
 * manage_venues).
 *
 * Two toggles control the scheduled WhatsApp notification workflows documented
 * in docs/product/02-BUSINESS-LOGIC.md §8:
 *   1. Booking reminders (T-24h + T-2h before a session).
 *   2. Post-session review requests (links /review/{bookingId}).
 *
 * Both are dry-run until Meta WhatsApp is configured (NOTIFICATIONS_TRANSPORT_MODE
 * =live). Mutations run through a route-independent server action; on success the
 * route refreshes so the server-fetched settings stay authoritative. The recent
 * dispatch activity below is visible with manage_bookings.
 *
 * @param {Object} props
 * @param {string} props.venueId
 * @param {object|null} props.settings - Normalized notification settings.
 * @param {object[]} props.activity - Normalized recent notification log rows.
 * @param {object|null} props.summary - Per-status dispatch counts.
 * @param {boolean} props.canViewLog - manage_bookings gate for the activity panel.
 */
export function SettingsView({ venueId, settings, activity = [], summary = null, canViewLog = false }) {
  return (
    <ManagerSurface
      title="Settings"
      description="Venue-level configuration for scheduled WhatsApp notifications. Toggles take effect on the next booking confirmation."
    >
      <div className="space-y-5 sm:space-y-6 md:h-full md:min-h-0 md:overflow-y-auto">
        <NotificationsCard venueId={venueId} settings={settings} />
        {canViewLog && <ActivityCard activity={activity} summary={summary} />}
      </div>
    </ManagerSurface>
  );
}

/* ── 1. Notification toggles ────────────────────── */

const TOGGLES = [
  {
    key: "remindersEnabled",
    field: "reminders_enabled",
    title: "Booking reminders",
    description: "WhatsApp reminders 24 hours and 2 hours before a confirmed session starts.",
  },
  {
    key: "reviewRequestsEnabled",
    field: "review_requests_enabled",
    title: "Post-session review requests",
    description: "WhatsApp review request after a session ends, with a direct link to the review page.",
  },
];

function NotificationsCard({ venueId, settings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState(null);
  const [isPending, startTransition] = useTransition();

  const state = {
    remindersEnabled: Boolean(settings?.remindersEnabled),
    reviewRequestsEnabled: Boolean(settings?.reviewRequestsEnabled),
  };

  function handleToggle(field, next) {
    setError("");
    setPendingKey(field);
    startTransition(async () => {
      const result = await updateNotificationSettingsAction(venueId, { [field]: next });
      setPendingKey(null);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <Card className="p-5 sm:p-6 shrink-0">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-accent" aria-hidden="true" />
        <h3 className="text-lg font-black tracking-tight sm:text-xl">WhatsApp Notifications</h3>
      </div>
      <p className="mt-1 text-sm text-muted">
        Delivery runs in dry-run mode until Meta WhatsApp is connected — enable these now so
        reminders and review requests go live the moment the integration is switched on.
      </p>

      {error && <FormAlert type="error" message={error} className="mt-4" />}

      <ul className="mt-4 divide-y divide-line">
        {TOGGLES.map((toggle) => {
          const enabled = state[toggle.key];
          const busy = isPending && pendingKey === toggle.field;
          return (
            <li key={toggle.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground">{toggle.title}</p>
                  <Badge tone={enabled ? "accent" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted sm:text-sm">{toggle.description}</p>
              </div>
              <Switch
                checked={enabled}
                disabled={isPending}
                loading={busy}
                label={`${enabled ? "Disable" : "Enable"} ${toggle.title}`}
                onChange={(next) => handleToggle(toggle.field, next)}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}


/* ── 2. Recent dispatch activity ────────────────── */

function ActivityCard({ activity, summary }) {
  const counts = summary || {};
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <Card className="p-5 sm:p-6 shrink-0">
      <div className="flex items-center gap-2">
        <BellOff className="h-5 w-5 text-accent" aria-hidden="true" />
        <h3 className="text-lg font-black tracking-tight sm:text-xl">Recent Notification Activity</h3>
      </div>
      <p className="mt-1 text-sm text-muted">
        The latest scheduled notification deliveries. Statuses show scheduled, sent, failed,
        cancelled, and skipped rows.
      </p>

      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <Badge key={status} tone={status === "sent" ? "accent" : status === "failed" ? "danger" : "neutral"} className="capitalize">
              {status.replace("_", " ")}: {count}
            </Badge>
          ))}
        </div>
      )}

      {activity.length === 0 ? (
        <p className="mt-4 rounded-lg border border-line bg-surface-soft/40 p-4 text-sm font-medium text-muted">
          No notification activity yet. Scheduled reminders and review requests appear here once
          bookings are confirmed with the toggles enabled.
        </p>
      ) : (
        <ul className="mt-4 space-y-3" aria-live="polite">
          {activity.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-panel p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground">{formatType(row.type)}</p>
                  <StatusBadge value={row.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted" title={row.customerName || row.customerPhone}>
                  {row.customerName || "Customer"}
                  {row.customerPhone ? ` · ${row.customerPhone}` : ""}
                  {row.scheduledFor ? ` · ${formatDateTime(row.scheduledFor)}` : ""}
                </p>
              </div>
              {row.provider && (
                <Badge tone="neutral" className="shrink-0 font-mono text-[10px]">
                  {row.provider}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatType(type) {
  switch (type) {
    case "reminder_t24":
      return "24h reminder";
    case "reminder_t2h":
      return "2h reminder";
    case "review_request":
      return "Review request";
    default:
      return type || "Notification";
  }
}
