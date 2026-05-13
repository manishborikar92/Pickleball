import { Badge, Card } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";

export function AdminTable({ title, rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-lg font-black tracking-tight sm:text-xl">{title}</h2>
      </div>

      {/* Mobile-optimized card layout */}
      <div className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <MobileBookingRow key={row.id} row={row} />
        ))}
      </div>

      {/* Desktop-optimized tabular layout */}
      <div className="hidden divide-y divide-line md:block">
        {rows.map((row) => (
          <DesktopBookingRow key={row.id} row={row} />
        ))}
      </div>
    </Card>
  );
}

function MobileBookingRow({ row }) {
  return (
    <div className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-foreground">{row.player}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{row.id}</p>
        <p className="mt-2 text-sm font-medium text-muted">
          {row.court} <span className="mx-1 opacity-50">•</span> {row.time}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <strong className="text-sm text-foreground">{formatCurrency(row.amount)}</strong>
        <Badge tone={row.status === "walk_in" ? "accent" : "neutral"} className="text-[10px]">
          {row.status.replace("_", " ")}
        </Badge>
      </div>
    </div>
  );
}

function DesktopBookingRow({ row }) {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 hover:bg-surface-high/30 transition-colors">
      <div className="min-w-0">
        <p className="truncate font-bold text-foreground">{row.player}</p>
        <p className="truncate text-xs text-muted">{row.id}</p>
      </div>
      <span className="truncate text-sm font-medium text-muted">{row.court}</span>
      <span className="truncate text-sm font-medium text-muted">{row.time}</span>
      <div className="flex shrink-0 items-center justify-end gap-4">
        <Badge tone={row.status === "walk_in" ? "accent" : "neutral"}>
          {row.status.replace("_", " ")}
        </Badge>
        <strong className="w-20 text-right text-sm text-foreground">
          {formatCurrency(row.amount)}
        </strong>
      </div>
    </div>
  );
}