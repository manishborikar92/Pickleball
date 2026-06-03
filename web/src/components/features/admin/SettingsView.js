import { Card, FormField, Input, Textarea } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";



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
