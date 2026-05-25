"use client";

import { useState, useId } from "react";
import { Button, Card, FormField, Input, Select, FormAlert } from "@/components/shared";
import { AdminTable } from "./AdminTable";
import { validatePhone } from "@/lib/validation";

const INITIAL_FORM = {
  player: "",
  phone: "",
  court: "Court 1",
  time: "21:00",
  amount: "650",
};

const TEXT_FIELDS = [
  { key: "player", label: "Player name", inputMode: "text", type: "text" },
  { key: "phone", label: "Phone", inputMode: "tel", type: "tel" },
  { key: "time", label: "Start time", inputMode: "text", type: "time" },
  { key: "amount", label: "Amount paid", inputMode: "numeric", type: "number" },
];

export function AdminBookings({ initialRows }) {
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState({ type: "", text: "" });

  function handleFieldChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (message.text) setMessage({ type: "", text: "" });
  }

  function handleCreateWalkIn(event) {
    event.preventDefault();
    const phone = validatePhone(form.phone);
    if (!form.player.trim() || !phone.ok) {
      setMessage({ type: "error", text: "Enter a player name and valid Indian mobile number." });
      return;
    }
    
    setRows((prev) => [
      {
        id: `WI-${prev.length + 1}`,
        player: form.player.trim(),
        court: form.court,
        time: form.time,
        status: "walk_in",
        amount: Number(form.amount || 0),
      },
      ...prev,
    ]);
    
    setForm(INITIAL_FORM);
    setMessage({ type: "success", text: "Walk-in booking created locally." });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
      <WalkInForm
        form={form}
        message={message}
        onChange={handleFieldChange}
        onSubmit={handleCreateWalkIn}
      />
      <div className="min-w-0">
        <AdminTable title="Bookings" rows={rows} />
      </div>
    </div>
  );
}

function WalkInForm({ form, message, onChange, onSubmit }) {
  return (
    <Card className="p-5 sm:p-6 lg:sticky lg:top-6">
      <h2 className="text-xl font-black tracking-tight sm:text-2xl">Create Walk-in</h2>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        {TEXT_FIELDS.map(({ key, label, inputMode, type }) => (
          <FormField key={key} label={label}>
            <Input
              type={type}
              value={form[key]}
              inputMode={inputMode}
              onChange={(e) => onChange(key, e.target.value)}
              error={message.type === "error" && !form[key]}
            />
          </FormField>
        ))}

        <FormField label="Court">
          <Select
            value={form.court}
            onChange={(e) => onChange("court", e.target.value)}
          >
            <option>Court 1</option>
            <option>Court 2</option>
          </Select>
        </FormField>

        <Button type="submit" className="mt-2 w-full py-3">
          Create Booking
        </Button>
        
        <FormAlert type={message.type} message={message.text} className="mt-2" />
      </form>
    </Card>
  );
}