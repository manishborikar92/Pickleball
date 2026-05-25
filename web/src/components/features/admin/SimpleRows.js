"use client";

import { Button } from "@/components/shared";
import { DataTable, StatusBadge } from "@/components/shared/Table";
import { useTable } from "@/hooks/useTable";

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (val, row) => (
      <div className="min-w-0 flex flex-col">
        <strong className="truncate text-base font-bold text-foreground">{val}</strong>
        <span className="md:hidden mt-0.5 text-xs font-medium text-muted">{row.scope}</span>
      </div>
    ),
  },
  {
    key: "scope",
    label: "Scope",
    className: "hidden md:table-cell text-muted",
  },
  {
    key: "value",
    label: "Value",
  },
  {
    key: "status",
    label: "Status",
    render: (val) => <StatusBadge value={val} />,
  },
  {
    key: "action",
    label: "",
    className: "text-right md:w-[120px]",
    render: (_, row) => {
      if (!row.action) return null;
      return (
        <Button
          type="button"
          variant="secondary"
          onClick={row.action}
          className="py-1.5 px-3 text-xs min-h-[2rem] w-full md:w-auto"
        >
          {row.actionLabel || "Toggle"}
        </Button>
      );
    },
  },
];

export function SimpleRows({ rows = [] }) {
  const table = useTable(rows, {
    columns: COLUMNS,
    defaultPageSize: 100, // Show all since search/pagination are disabled
  });

  return (
    <DataTable
      {...table}
      columns={COLUMNS}
      enableSearch={false}
      enableFiltering={false}
      enablePagination={false}
      mobileCardRenderer={MobileCardRow}
    />
  );
}

function MobileCardRow(row) {
  return (
    <div className="flex flex-col gap-3 p-5 hover:bg-surface-high/10 transition-colors">
      <div className="min-w-0 flex flex-col">
        <strong className="truncate text-base font-bold text-foreground">{row.name}</strong>
        <span className="mt-0.5 text-xs font-medium text-muted">{row.scope}</span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{row.value}</span>
        <StatusBadge value={row.status} />
      </div>

      {row.action && (
        <Button
          type="button"
          variant="secondary"
          onClick={row.action}
          className="mt-2 w-full py-2.5 text-sm"
        >
          {row.actionLabel || "Toggle"}
        </Button>
      )}
    </div>
  );
}