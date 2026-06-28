"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, EmptyState, Loader } from "@/components/shared";
import { TableToolbar } from "./TableToolbar";
import { TablePagination } from "./TablePagination";
import { cn } from "@/lib/utils";

/**
 * DataTable Component.
 * The core modular visual representation for tabular data.
 * Supports desktop tables, mobile grid layouts, sorting indicators,
 * filters, loaders, and custom column cell formatting.
 */
export function DataTable({
  // Table Hook State & Controls
  data = [],
  rawCount = 0,
  columns = [],
  page = 1,
  pageSize = 5,
  sortBy = "",
  sortOrder = "asc",
  searchQuery = "",
  filters = {},
  selectedRowIds = new Set(),
  setPage,
  setPageSize,
  toggleSort,
  setSearchQuery,
  setFilter,
  resetFilters,
  toggleRowSelection,
  toggleAllSelection,

  // Feature Toggles & Configurations
  enablePagination = true,
  enableSorting = true,
  enableFiltering = true,
  enableSearch = true,
  enableSelection = false,
  enableStickyHeader = false,
  enableRowClick = null,
  bulkActions = [],
  searchPlaceholder = "Search records...",
  pageSizeOptions = [5, 10, 20, 50],

  // Load / Empty / Error configurations
  loading = false,
  error = "",
  emptyTitle,
  emptyDescription,
  emptyIcon,

  // Custom mobile card renderer
  mobileCardRenderer,

  className,
}) {
  const hasData = data.length > 0;
  const allRowIds = data.map((row) => row.id || row.key);
  const isAllSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedRowIds.has(id));

  // Determine row keys
  function getRowKey(row, index) {
    return row.id || row.key || `row-${index}`;
  }

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {/* 1. Header toolbar (Search / Filter / Bulk Operations) */}
      {(enableSearch || enableFiltering) && (
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={enableSearch ? setSearchQuery : () => {}}
          columns={columns}
          filters={filters}
          onFilterChange={enableFiltering ? setFilter : () => {}}
          onResetFilters={resetFilters}
          selectedCount={selectedRowIds.size}
          bulkActions={bulkActions}
          searchPlaceholder={searchPlaceholder}
        />
      )}

      {/* 2. Loading State overlay / spinner */}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center p-8">
          <Loader variant="spinner" />
        </div>
      ) : error ? (
        /* 3. Error state indicator */
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </div>
      ) : !hasData ? (
        /* 4. Empty state placeholder */
        <div className="p-5 sm:p-8">
          <EmptyState
            title={emptyTitle || "No items found"}
            description={emptyDescription || "Try adjusting your query or click clear to reset active filters."}
            icon={emptyIcon}
            actionLabel="Reset Filters"
            onAction={resetFilters}
          />
        </div>
      ) : (
        /* 5. Main Responsive Grid Listing */
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden overflow-x-auto md:block md:flex-1 md:min-h-0 overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm text-muted">
              <thead className="border-b border-line bg-surface-panel text-xs font-bold uppercase tracking-wider text-foreground sticky top-0 z-10">
                <tr>
                  {/* Global select checkbox header */}
                  {enableSelection && (
                    <th className="w-12 px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={() => toggleAllSelection(allRowIds)}
                        className="h-4 w-4 cursor-pointer rounded border-line accent-accent focus:ring-accent focus:ring-offset-background"
                        aria-label="Select all rows"
                      />
                    </th>
                  )}
                  {columns.map((col) => {
                    const isSorted = sortBy === col.key;
                    const canSort = enableSorting && col.sortable !== false;

                    return (
                      <th
                        key={col.key}
                        className={cn("px-6 py-4 font-extrabold", col.className)}
                      >
                        {canSort ? (
                          <button
                            onClick={() => toggleSort(col.key)}
                            className="flex items-center gap-1.5 hover:text-accent focus-visible:outline-none transition-colors"
                          >
                            <span>{col.label}</span>
                            {isSorted ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-accent" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-accent" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </button>
                        ) : (
                          <span>{col.label}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-transparent">
                {data.map((row, rowIndex) => {
                  const key = getRowKey(row, rowIndex);
                  const isSelected = selectedRowIds.has(key);

                  return (
                    <tr
                      key={key}
                      onClick={() => enableRowClick && enableRowClick(row)}
                      className={cn(
                        "transition-colors hover:bg-surface-high/20",
                        enableRowClick && "cursor-pointer",
                        isSelected && "bg-accent/[0.03]"
                      )}
                    >
                      {enableSelection && (
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(key)}
                            className="h-4 w-4 cursor-pointer rounded border-line accent-accent focus:ring-accent focus:ring-offset-background"
                            aria-label={`Select row ${row.name || key}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => {
                        const cellVal = row[col.key];
                        return (
                          <td
                            key={col.key}
                            className={cn("px-6 py-4 font-medium text-foreground/90 align-middle", col.className)}
                          >
                            {col.render ? col.render(cellVal, row) : cellVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST VIEW */}
          <div className="divide-y divide-line md:hidden flex-1 min-h-0 overflow-y-auto">
            {data.map((row, rowIndex) => {
              const key = getRowKey(row, rowIndex);
              const isSelected = selectedRowIds.has(key);

              if (mobileCardRenderer) {
                return (
                  <div
                    key={key}
                    onClick={() => enableRowClick && enableRowClick(row)}
                    className={cn(enableRowClick && "cursor-pointer")}
                  >
                    {mobileCardRenderer(row, isSelected, () => toggleRowSelection(key))}
                  </div>
                );
              }

              // Default responsive mobile card
              return (
                <div
                  key={key}
                  onClick={() => enableRowClick && enableRowClick(row)}
                  className={cn(
                    "flex flex-col gap-3 p-5 transition-colors",
                    enableRowClick && "cursor-pointer",
                    isSelected && "bg-accent/[0.03]"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* First column as primary label */}
                      <strong className="block truncate text-base font-bold text-foreground">
                        {row[columns[0]?.key]}
                      </strong>
                      {columns[1] && (
                        <span className="block mt-0.5 truncate text-xs text-muted">
                          {row[columns[1]?.key]}
                        </span>
                      )}
                    </div>
                    {/* Render selection check at top-right for mobile selection */}
                    {enableSelection && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(key)}
                          className="h-5 w-5 cursor-pointer rounded border-line accent-accent"
                          aria-label={`Select row ${key}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Render metadata fields */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-line/40 pt-2.5">
                    {columns.slice(2).map((col) => {
                      if (!col.label) return null;
                      return (
                        <div key={col.key} className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {col.label}
                          </span>
                          <div className="mt-0.5 font-semibold text-foreground">
                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 6. Footer Navigation pagination */}
      {enablePagination && hasData && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={rawCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </Card>
  );
}
