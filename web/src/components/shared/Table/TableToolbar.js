"use client";

import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/shared/Form";
import { Button } from "@/components/shared";
import { cn } from "@/lib/utils";

/**
 * TableToolbar component.
 * Bundles search query text boxes, drop-down filters, and bulk actions.
 */
export function TableToolbar({
  searchQuery,
  onSearchChange,
  columns = [],
  filters = {},
  onFilterChange,
  onResetFilters,
  selectedCount = 0,
  bulkActions = [],
  searchPlaceholder = "Search records...",
}) {
  const searchableCols = columns.filter((col) => col.searchable);
  const filterableCols = columns.filter((col) => col.filterable && col.filterOptions);

  const hasSearch = searchableCols.length > 0;
  const hasFilter = filterableCols.length > 0;
  const hasActiveFilters = searchQuery || Object.keys(filters).length > 0;

  if (!hasSearch && !hasFilter && selectedCount === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4 border-b border-line bg-surface/10 p-5 sm:flex-row sm:items-center sm:justify-between")}>
      {/* 1. Selection & Bulk Operations Banner */}
      {selectedCount > 0 ? (
        <div className={cn("flex w-full items-center justify-between rounded-lg bg-accent/10 px-4 py-2 border border-accent/20")}>
          <p className="text-xs font-semibold text-accent sm:text-sm">
            {selectedCount} row{selectedCount > 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                variant={action.variant || "secondary"}
                className="py-1 px-3 text-xs min-h-[2rem]"
              >
                {action.icon && <action.icon className="h-3.5 w-3.5 mr-1" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        /* 2. Standard Search & Filter Controls */
        <div className={cn("flex flex-1 flex-wrap items-center gap-3")}>
          {/* Search bar */}
          {hasSearch && (
            <div className="relative w-full max-w-sm">
              <Input
                icon={Search}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="py-2.5 text-sm"
              />
            </div>
          )}

          {/* Filtering Select dropdowns */}
          {filterableCols.map((col) => (
            <div key={col.key} className="w-full max-w-[160px] sm:w-auto">
              <Select
                value={filters[col.key] || ""}
                onChange={(e) => onFilterChange(col.key, e.target.value)}
                className="py-2 text-xs font-bold text-muted border-line/60 bg-surface-panel/40"
              >
                <option value="">All {col.label || col.key}</option>
                {col.filterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          ))}

          {/* Clear Trigger */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs font-bold text-accent hover:underline focus-visible:outline-none"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
