import { Card, FormField, Input, Textarea } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";

/* ── Analytics ──────────────────────────────────── */

const ANALYTICS_STATS = [
  { label: "Peak Hour", value: "No data" },
  { label: "Avg Rating", value: "No data" },
  { label: "Coupon Use", value: "No data" },
];

export function AnalyticsView() {
  return (
    <ManagerSurface
      title="Analytics"
      description="Read-only BI surfaces can expand into heatmaps, cohorts, and pricing recommendations."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ANALYTICS_STATS.map(({ label, value }) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
    </ManagerSurface>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="flex flex-col p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-accent sm:mt-3">
        {value}
      </p>
    </Card>
  );
}

/* ── Settings ───────────────────────────────────── */

export function SettingsView() {
  return (
    <ManagerSurface
      title="Settings"
      description="Venue-level configuration is centralized and ready for super-admin governance."
    >
      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Advance booking days">
            <Input
              defaultValue="7"
              type="number"
              inputMode="numeric"
              readOnly
            />
          </FormField>
          <FormField label="Rollover time">
            <Input
              defaultValue="08:00"
              type="time"
              readOnly
            />
          </FormField>
          <FormField label="Notification template" className="sm:col-span-2">
            <Textarea
              defaultValue="You are booked for {{court}} at {{time}}."
              rows={3}
              readOnly
            />
          </FormField>
        </div>
      </Card>
    </ManagerSurface>
  );
}
