"use client";

import { DataTable, StatusBadge, Currency } from "@/components/shared/Table";
import { useTable } from "@/hooks/useTable";

const COLUMNS = [
  {
    key: "player",
    label: "Player",
    sortable: true,
    searchable: true,
    render: (val, row) => (
      <div className="min-w-0">
        <p className="truncate font-bold text-foreground">{val}</p>
        <p className="truncate text-xs text-muted">{row.id}</p>
      </div>
    ),
  },
  {
    key: "court",
    label: "Court",
    sortable: true,
    filterable: true,
    filterOptions: ["Court 1", "Court 2"],
  },
  {
    key: "time",
    label: "Time",
    sortable: true,
  },
  {
    key: "status",
    label: "Status",
    filterable: true,
    filterOptions: ["walk_in", "confirmed", "completed", "cancelled"],
    render: (val) => <StatusBadge value={val} />,
  },
  {
    key: "amount",
    label: "Amount Paid",
    sortable: true,
    className: "text-right md:pr-4",
    render: (val) => <Currency value={val} />,
  },
];

export function AdminTable({ title, rows = [], className }) {
  const table = useTable(rows, {
    columns: COLUMNS,
    defaultSortBy: "id",
    defaultSortOrder: "desc",
    defaultPageSize: 5,
  });

  return (
    <DataTable
      {...table}
      columns={COLUMNS}
      emptyTitle={`No records in ${title}`}
      emptyDescription="Try clearing your search query or adjusting options."
      searchPlaceholder="Search by player name..."
      mobileCardRenderer={MobileCardRow}
      className={className}
    />
  );
}

function MobileCardRow(row) {
  return (
    <div className="flex items-start justify-between gap-4 p-5 hover:bg-surface-high/10 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-foreground">{row.player}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{row.id}</p>
        <p className="mt-2 text-sm font-medium text-muted">
          {row.court} <span className="mx-1 opacity-50">•</span> {row.time}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Currency value={row.amount} />
        <StatusBadge value={row.status} />
      </div>
    </div>
  );
}