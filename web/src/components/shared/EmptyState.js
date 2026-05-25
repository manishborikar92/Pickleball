"use client";

import { Button } from "@/components/shared";
import { cn } from "@/lib/utils";

/**
 * Standardized EmptyState component.
 * Used when tables, lists, or queries return no results.
 */
export function EmptyState({
  title = "No results found",
  description = "Try adjusting your search query or filters.",
  icon: Icon,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}) {
  return (
    <div 
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-high/30 p-8 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-panel text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-sm font-bold text-foreground sm:text-base">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs text-muted max-w-sm sm:text-sm">
          {description}
        </p>
      )}
      {(actionLabel && (onAction || actionHref)) && (
        <div className="mt-4">
          <Button
            type={onAction ? "button" : undefined}
            onClick={onAction}
            href={actionHref}
            variant="secondary"
            className="py-1.5 px-4 text-xs"
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
