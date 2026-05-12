"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card, SectionHeader } from "@/components/shared/Card";
import { formatCurrency } from "@/lib/booking-engine";
import { validatePhone } from "@/lib/validation";

export function AdminOverview({ overview }) {
  const metrics = [
    ["Revenue Today", formatCurrency(overview.stats.revenueToday)],
    ["Utilization", overview.stats.utilization],
    ["Pending Holds", String(overview.stats.pendingBookings)],
    ["Active Courts", String(overview.stats.activeCourts)],
  ];

  return (
    <div className="space-y-6">
      <SectionHeader align="left" title="Admin Command Center">
        Live operational context for venue managers, staff, and future
        super-admin venue orchestration.
      </SectionHeader>
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className="mt-3 text-2xl font-black text-accent">{value}</p>
          </Card>
        ))}
      </div>
      <AdminTable title="Today" rows={overview.bookings} />
    </div>
  );
}

export function AdminBookings({ initialRows }) {
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState({ player: "", phone: "", court: "Court 1", time: "21:00", amount: "650" });
  const [message, setMessage] = useState("");

  function createWalkIn(event) {
    event.preventDefault();
    const phone = validatePhone(form.phone);
    if (!form.player.trim() || !phone.ok) {
      setMessage("Enter a player name and valid Indian mobile number.");
      return;
    }
    setRows((current) => [
      {
        id: `WI-${current.length + 1}`,
        player: form.player.trim(),
        court: form.court,
        time: form.time,
        status: "walk_in",
        amount: Number(form.amount || 0),
      },
      ...current,
    ]);
    setMessage("Walk-in booking created locally and ready for API integration.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="p-5">
        <h2 className="text-2xl font-black">Create Walk-in</h2>
        <form onSubmit={createWalkIn} className="mt-5 grid gap-3">
          {[
            ["player", "Player name"],
            ["phone", "Phone"],
            ["time", "Start time"],
            ["amount", "Amount paid"],
          ].map(([key, label]) => (
            <label key={key} className="grid gap-2 text-sm font-bold text-muted">
              {label}
              <input
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                className="rounded-lg border border-line bg-background p-3 text-foreground"
              />
            </label>
          ))}
          <label className="grid gap-2 text-sm font-bold text-muted">
            Court
            <select
              value={form.court}
              onChange={(event) => setForm((current) => ({ ...current, court: event.target.value }))}
              className="rounded-lg border border-line bg-background p-3 text-foreground"
            >
              <option>Court 1</option>
              <option>Court 2</option>
            </select>
          </label>
          <Button type="submit" className="mt-2">Create Booking</Button>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </form>
      </Card>
      <AdminTable title="Bookings" rows={rows} />
    </div>
  );
}

export function ScheduleManager() {
  const [exceptions, setExceptions] = useState([
    { date: "2026-05-18", court: "All Courts", type: "modified_hours", note: "Tournament setup" },
  ]);
  const [note, setNote] = useState("");

  return (
    <ManagerSurface title="Schedule Manager" description="Standard hours, slot duration, and daily exceptions stay venue-scoped.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-xl font-black">Operating Template</h3>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <p>Mon-Sun: 06:00 - 23:00</p>
            <p>Slot duration: 60 minutes</p>
            <p>Rollover: 08:00 Asia/Kolkata</p>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-xl font-black">Add Exception</h3>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              setExceptions((current) => [{ date: "2026-05-20", court: "Court 1", type: "blocked", note }, ...current]);
              setNote("");
            }}
          >
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason" className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2" />
            <Button type="submit" className="rounded-lg">Add</Button>
          </form>
        </Card>
      </div>
      <Card className="divide-y divide-line">
        {exceptions.map((item, index) => (
          <div key={`${item.date}-${index}`} className="grid gap-2 p-4 sm:grid-cols-4">
            <span>{item.date}</span><span>{item.court}</span><Badge>{item.type}</Badge><span className="text-muted">{item.note}</span>
          </div>
        ))}
      </Card>
    </ManagerSurface>
  );
}

export function PricingManager() {
  const [rules, setRules] = useState([
    { name: "Weekend Peak", scope: "All courts", value: "+20%", status: "active" },
    { name: "Early Morning", scope: "All courts", value: "-15%", status: "active" },
    { name: "FIRST50", scope: "Coupon", value: "-50 INR", status: "active" },
  ]);

  return (
    <ManagerSurface title="Pricing Manager" description="Rules are modeled as isolated records ready for backend JSONB pricing evaluation.">
      <Card className="p-5">
        <Button type="button" onClick={() => setRules((current) => [{ name: "Flash Sale", scope: "Court 2", value: "-25%", status: "draft" }, ...current])}>
          Add Flash Rule
        </Button>
      </Card>
      <SimpleRows rows={rules} />
    </ManagerSurface>
  );
}

export function CourtsManager({ courts }) {
  const [items, setItems] = useState(courts);
  return (
    <ManagerSurface title="Courts" description="Court metadata and status changes remain isolated to the venue domain.">
      <SimpleRows
        rows={items.map((court) => ({
          name: court.name,
          scope: court.surfaceType,
          value: court.environment,
          status: court.status,
          action: () => setItems((current) => current.map((item) => item.id === court.id ? { ...item, status: item.status === "active" ? "maintenance" : "active" } : item)),
        }))}
      />
    </ManagerSurface>
  );
}

export function UsersManager() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => query ? [{ name: "Asha Mehta", phone: "+919876543210", bookings: 8, wallet: 500 }] : [], [query]);
  return (
    <ManagerSurface title="Users" description="Search by phone and inspect booking history, wallet, and credit activity.">
      <Card className="p-5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search phone" className="w-full rounded-lg border border-line bg-background p-3" />
      </Card>
      <SimpleRows rows={results.map((user) => ({ name: user.name, scope: user.phone, value: `${user.bookings} bookings`, status: formatCurrency(user.wallet) }))} />
    </ManagerSurface>
  );
}

export function AnalyticsView() {
  return (
    <ManagerSurface title="Analytics" description="Read-only BI surfaces can expand into heatmaps, cohorts, and pricing recommendations.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-muted">Peak Hour</p><p className="mt-3 text-3xl font-black text-accent">18:00</p></Card>
        <Card className="p-5"><p className="text-muted">Avg Rating</p><p className="mt-3 text-3xl font-black text-accent">4.8</p></Card>
        <Card className="p-5"><p className="text-muted">Coupon Use</p><p className="mt-3 text-3xl font-black text-accent">31%</p></Card>
      </div>
    </ManagerSurface>
  );
}

export function SettingsView() {
  const [saved, setSaved] = useState(false);
  return (
    <ManagerSurface title="Settings" description="Venue-level configuration is centralized and ready for super-admin governance.">
      <Card className="p-5">
        <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-muted">Advance booking days<input defaultValue="7" className="rounded-lg border border-line bg-background p-3 text-foreground" /></label>
          <label className="grid gap-2 text-sm font-bold text-muted">Rollover time<input defaultValue="08:00" className="rounded-lg border border-line bg-background p-3 text-foreground" /></label>
          <label className="grid gap-2 text-sm font-bold text-muted md:col-span-2">Notification template<textarea defaultValue="You are booked for {{court}} at {{time}}." className="rounded-lg border border-line bg-background p-3 text-foreground" /></label>
          <Button type="submit" className="md:w-fit">Save Settings</Button>
        </form>
        {saved ? <p className="mt-4 text-sm text-accent">Settings saved locally.</p> : null}
      </Card>
    </ManagerSurface>
  );
}

function ManagerSurface({ title, description, children }) {
  return (
    <div className="space-y-6">
      <SectionHeader align="left" title={title}>{description}</SectionHeader>
      {children}
    </div>
  );
}

function AdminTable({ title, rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line p-5">
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <div className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px_120px_150px] md:items-center">
            <div><p className="font-bold">{row.player}</p><p className="text-sm text-muted">{row.id}</p></div>
            <span>{row.court}</span>
            <span>{row.time}</span>
            <div className="flex items-center gap-3 md:justify-end"><Badge>{row.status}</Badge><strong>{formatCurrency(row.amount)}</strong></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SimpleRows({ rows }) {
  return (
    <Card className="divide-y divide-line">
      {rows.map((row, index) => (
        <div key={`${row.name}-${index}`} className="grid gap-3 p-4 md:grid-cols-[1fr_140px_120px_120px_auto] md:items-center">
          <strong>{row.name}</strong>
          <span className="text-muted">{row.scope}</span>
          <span>{row.value}</span>
          <Badge>{row.status}</Badge>
          {row.action ? <Button type="button" variant="secondary" onClick={row.action} className="rounded-lg py-2">Toggle</Button> : null}
        </div>
      ))}
    </Card>
  );
}
