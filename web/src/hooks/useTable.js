"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * useTable hook.
 * Manages search, sort, filter, pagination, and selection state for a dataset.
 * Designed to support client-side computation out-of-the-box,
 * and structured to easily bridge to server-side query generation.
 */
export function useTable(
  initialData = [],
  {
    columns = [],
    defaultPage = 1,
    defaultPageSize = 5,
    defaultSortBy = "",
    defaultSortOrder = "asc",
  } = {}
) {
  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // 1. Reset selection helper
  const resetSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  // 2. State controls
  const handleSetSearchQuery = useCallback((query) => {
    setSearchQuery(query);
    setPage(1); // Reset to page 1 on search
    resetSelection();
  }, [resetSelection]);

  const handleSetFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined || value === null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1); // Reset to page 1 on filter
    resetSelection();
  }, [resetSelection]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
    setPage(1);
    resetSelection();
  }, [resetSelection]);

  const handleToggleSort = useCallback((columnKey) => {
    setSortBy((currentSortBy) => {
      if (currentSortBy === columnKey) {
        setSortOrder((currentOrder) => (currentOrder === "asc" ? "desc" : "asc"));
      } else {
        setSortOrder("asc");
      }
      return columnKey;
    });
    setPage(1);
  }, []);

  const handleToggleRowSelection = useCallback((rowId) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleToggleAllSelection = useCallback((rowIds = []) => {
    setSelectedRowIds((prev) => {
      const allSelected = rowIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        rowIds.forEach((id) => next.delete(id));
      } else {
        rowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  // 3. Client-side evaluation (Search, Filter, Sort, Paginate)
  const processedDataResult = useMemo(() => {
    let result = [...initialData];

    // Search filter: check columns marked as searchable
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchableKeys = columns
        .filter((col) => col.searchable)
        .map((col) => col.key);

      if (searchableKeys.length > 0) {
        result = result.filter((row) =>
          searchableKeys.some((key) => {
            const val = row[key];
            return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
          })
        );
      }
    }

    // Explicit field filter matching
    const activeFilterEntries = Object.entries(filters);
    if (activeFilterEntries.length > 0) {
      result = result.filter((row) =>
        activeFilterEntries.every(([key, filterVal]) => {
          const rowVal = row[key];
          if (rowVal === undefined || rowVal === null) return false;
          return String(rowVal).toLowerCase() === String(filterVal).toLowerCase();
        })
      );
    }

    // Sort order evaluation
    if (sortBy) {
      result.sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        let comparison = 0;
        if (typeof valA === "number" && typeof valB === "number") {
          comparison = valA - valB;
        } else {
          comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    // Compute raw count before paging slice
    const rawCount = result.length;

    // Slicing page window
    const startIndex = (page - 1) * pageSize;
    const pageData = result.slice(startIndex, startIndex + pageSize);

    return {
      pageData,
      rawCount,
    };
  }, [initialData, columns, searchQuery, filters, sortBy, sortOrder, page, pageSize]);

  return {
    // States
    page,
    pageSize,
    sortBy,
    sortOrder,
    searchQuery,
    filters,
    selectedRowIds,
    data: processedDataResult.pageData,
    rawCount: processedDataResult.rawCount,

    // Controls
    setPage,
    setPageSize,
    toggleSort: handleToggleSort,
    setSearchQuery: handleSetSearchQuery,
    setFilter: handleSetFilter,
    resetFilters: handleResetFilters,
    toggleRowSelection: handleToggleRowSelection,
    toggleAllSelection: handleToggleAllSelection,
    resetSelection,
  };
}
