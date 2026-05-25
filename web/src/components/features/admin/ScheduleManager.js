"use client";

import { useState, useId } from "react";
import { Button, Card, FormField, Input } from "@/components/shared";
import { DataTable, StatusBadge, DateTime } from "@/components/shared/Table";
import { useTable } from "@/hooks/useTable";
import { ManagerSurface } from "./ManagerSurface";

const INITIAL_EXCEPTIONS = [
  {
    id: "exc-1",
    date: "2026-05-18",
    court: "All Courts",
    type: "modified_hours",
    note: "Tournament setup",
  },
];

const COLUMNS = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    render: (val) => <DateTime date={val} />,
  },
  {
    key: "court",
    label: "Court",
    sortable: true,
    filterable: true,
    filterOptions: ["Court 1", "Court 2", "All Courts"],
  },
  {
    key: "type",
    label: "Type",
    render: (val) => <StatusBadge value={val} />,
  },
  {
    key: "note",
    label: "Note",
    className: "text-right md:pr-4",
  },
];

export function ScheduleManager() {
  const [exceptions, setExceptions] = useState(INITIAL_EXCEPTIONS);
  const [note, setNote] = useState("");

  const table = useTable(exceptions, {
    columns: COLUMNS,
    defaultSortBy: "date",
    defaultSortOrder: "desc",
    defaultPageSize: 5,
  });

  function handleAddException(event) {
    event.preventDefault();
    if (!note.trim()) return;
    const newException = {
      id: `exc-${Date.now()}`,
      date: "2026-05-20",
      court: "Court 1",
      type: "blocked",
      note: note.trim(),
    };
    
    setExceptions((prev) => [newException, ...prev]);
    setNote("");
  }

  return (
    <ManagerSurface
      title="Schedule Manager"
      description="Standard hours, slot duration, and daily exceptions stay venue-scoped."
    >
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <OperatingTemplate />
        <AddExceptionForm
          note={note}
          onChange={setNote}
          onSubmit={handleAddException}
        />
      </div>

      <div className="mt-5 sm:mt-6">
        <DataTable
          {...table}
          columns={COLUMNS}
          enableSearch={false}
          emptyTitle="No schedule exceptions"
          emptyDescription="There are currently no active blocks or modified hours."
          mobileCardRenderer={MobileExceptionCard}
        />
      </div>
    </ManagerSurface>
  );
}

function OperatingTemplate() {
  return (
    <Card className="flex flex-col p-5 sm:p-6 h-full">
      <h3 className="text-lg font-black tracking-tight sm:text-xl">Operating Template</h3>
      <dl className="mt-4 grid gap-3 text-sm text-muted">
        <div className="flex justify-between border-b border-line pb-2">
          <dt className="font-bold">Mon–Sun</dt>
          <dd>06:00–23:00</dd>
        </div>
        <div className="flex justify-between border-b border-line pb-2">
          <dt className="font-bold">Slot duration</dt>
          <dd>60 minutes</dd>
        </div>
        <div className="flex justify-between pb-2">
          <dt className="font-bold">Rollover</dt>
          <dd>08:00 Asia/Kolkata</dd>
        </div>
      </dl>
    </Card>
  );
}

function AddExceptionForm({ note, onChange, onSubmit }) {
  return (
    <Card className="flex flex-col p-5 sm:p-6 h-full">
      <h3 className="text-lg font-black tracking-tight sm:text-xl">Add Exception</h3>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField label="Reason for exception" className="flex-1">
          <Input
            value={note}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Reason for exception..."
            className="py-2.5 text-sm"
          />
        </FormField>
        <Button type="submit" className="shrink-0 py-3 sm:py-2.5">
          Add Rule
        </Button>
      </form>
    </Card>
  );
}

function MobileExceptionCard(row) {
  return (
    <div className="flex flex-col gap-2 p-5 hover:bg-surface-high/10 transition-colors">
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground">
          <DateTime date={row.date} />
        </span>
        <StatusBadge value={row.type} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{row.court}</span>
        <span className="truncate max-w-[200px]" title={row.note}>{row.note}</span>
      </div>
    </div>
  );
}