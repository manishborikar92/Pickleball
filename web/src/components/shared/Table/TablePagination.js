"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/shared/Form";
import { cn } from "@/lib/utils";

/**
 * TablePagination component.
 * Displays limit selectors, range info labels, and previous/next controls.
 */
export function TablePagination({
  page = 1,
  pageSize = 5,
  totalCount = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startEntry = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endEntry = Math.min(totalCount, page * pageSize);

  return (
    <div className={cn("flex flex-col gap-4 border-t border-line bg-surface/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6")}>
      {/* 1. Limit Options & Range indicator */}
      <div className={cn("flex items-center justify-between gap-4 sm:justify-start")}>
        {onPageSizeChange && (
          <div className={cn("flex items-center gap-2")}>
            <span className="text-xs text-muted">Rows</span>
            <Select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="py-1 px-2 text-xs border-line/60 bg-transparent min-h-[2rem] w-16"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </div>
        )}
        <p className="text-xs text-muted">
          Showing <span className="font-semibold text-foreground">{startEntry}</span> to{" "}
          <span className="font-semibold text-foreground">{endEntry}</span> of{" "}
          <span className="font-semibold text-foreground">{totalCount}</span> entries
        </p>
      </div>

      {/* 2. Prev/Next control buttons */}
      <div className={cn("flex items-center justify-center gap-2 sm:justify-end")}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-panel/40 text-muted transition-colors hover:bg-surface-panel hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none")}
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-foreground select-none">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-panel/40 text-muted transition-colors hover:bg-surface-panel hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none")}
          aria-label="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
