"use client";

import { useState, useId } from "react";
import { Badge, Button, Card } from "@/components/shared";
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

export function ScheduleManager() {
  const [exceptions, setExceptions] = useState(INITIAL_EXCEPTIONS);
  const [note, setNote] = useState("");

  function handleAddException(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setExceptions((prev) => [
      { id: `exc-${Date.now()}`, date: "2026-05-20", court: "Court 1", type: "blocked", note },
      ...prev,
    ]);
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
      <ExceptionsTable exceptions={exceptions} />
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
  const inputId = useId();
  
  return (
    <Card className="flex flex-col p-5 sm:p-6 h-full">
      <h3 className="text-lg font-black tracking-tight sm:text-xl">Add Exception</h3>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">Reason for exception</label>
        <input
          id={inputId}
          value={note}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Reason for exception..."
          className="min-w-0 flex-1 rounded-lg border border-line bg-background px-4 py-3 text-base placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent md:text-sm"
        />
        <Button type="submit" className="shrink-0 py-3 sm:py-2">
          Add Rule
        </Button>
      </form>
    </Card>
  );
}

function ExceptionsTable({ exceptions }) {
  return (
    <Card className="divide-y divide-line overflow-hidden mt-5 sm:mt-6">
      {exceptions.map((item) => (
        <div
          key={item.id}
          className="grid gap-3 p-5 sm:grid-cols-[120px_1fr_auto_1fr] sm:items-center sm:gap-4 sm:px-6"
        >
          <span className="font-bold text-foreground">{item.date}</span>
          <span className="text-sm font-medium text-muted">{item.court}</span>
          <Badge tone="accent" className="w-fit text-[10px] sm:text-xs">{item.type.replace("_", " ")}</Badge>
          <span className="text-sm text-muted sm:text-right truncate" title={item.note}>{item.note}</span>
        </div>
      ))}
    </Card>
  );
}