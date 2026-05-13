import { Badge, Button, Card } from "@/components/shared";

/**
 * Reusable responsive data row list.
 * Each row requires an id: { id, name, scope, value, status, action?, actionLabel? }
 */
export function SimpleRows({ rows }) {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {rows.map((row) => (
        <SimpleRow key={row.id} row={row} />
      ))}
    </Card>
  );
}

function SimpleRow({ row }) {
  return (
    <div className="flex flex-col gap-3 p-5 md:grid md:grid-cols-[1.5fr_1fr_1fr_auto_120px] md:items-center md:gap-4 md:px-6 hover:bg-surface-high/30 transition-colors">
      <div className="min-w-0 flex flex-col">
        <strong className="truncate text-base font-bold text-foreground">{row.name}</strong>
        <span className="md:hidden mt-0.5 text-xs font-medium text-muted">{row.scope}</span>
      </div>
      
      <span className="hidden md:block truncate text-sm font-medium text-muted">{row.scope}</span>
      
      <div className="flex items-center justify-between md:contents">
        <span className="text-sm font-medium text-foreground">{row.value}</span>
        <Badge tone={row.status === "active" ? "accent" : "neutral"} className="w-fit">
          {row.status}
        </Badge>
      </div>

      {row.action && (
        <Button
          type="button"
          variant="secondary"
          onClick={row.action}
          className="mt-2 w-full py-2.5 text-sm md:mt-0 md:w-auto md:py-2"
        >
          {row.actionLabel || "Toggle"}
        </Button>
      )}
    </div>
  );
}