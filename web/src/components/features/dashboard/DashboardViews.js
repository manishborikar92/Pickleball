import Link from "next/link";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card, SectionHeader } from "@/components/shared/Card";
import { formatCurrency } from "@/lib/booking-engine";

export function DashboardOverview({ bookings, wallet }) {
  const upcoming = bookings.filter((booking) => booking.status === "confirmed").slice(0, 2);
  return (
    <div className="space-y-6">
      <SectionHeader align="left" title="Player Dashboard">
        Review upcoming games, wallet credits, and booking history from one
        account surface.
      </SectionHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Upcoming" value={String(upcoming.length)} />
        <Metric label="Wallet Credits" value={formatCurrency(wallet.balance)} />
        <Metric label="Past Sessions" value={String(bookings.length)} />
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Upcoming Bookings</h2>
          <Button href="/venues/besa-nagpur/book">Book Again</Button>
        </div>
        <BookingList bookings={upcoming} />
      </Card>
    </div>
  );
}

export function BookingsView({ bookings }) {
  return (
    <div className="space-y-6">
      <SectionHeader align="left" title="My Bookings">
        Bookings are grouped by status and ready for future pagination from the API.
      </SectionHeader>
      <Card className="p-5">
        <BookingList bookings={bookings} />
      </Card>
    </div>
  );
}

export function WalletView({ wallet }) {
  return (
    <div className="space-y-6">
      <SectionHeader align="left" title="Wallet & Credits">
        Credits from business-initiated cancellations are auditable and applied
        during the pricing waterfall.
      </SectionHeader>
      <Metric label="Available Balance" value={formatCurrency(wallet.balance)} />
      <Card className="divide-y divide-line">
        {wallet.transactions.map((transaction) => (
          <div key={transaction.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-bold">{transaction.reason}</p>
              <p className="text-sm text-muted">{transaction.type} - {transaction.createdAt}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-accent">{formatCurrency(transaction.amount)}</p>
              <p className="text-xs text-muted">Balance {formatCurrency(transaction.balanceAfter)}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black text-accent">{value}</p>
    </Card>
  );
}

function BookingList({ bookings }) {
  if (!bookings.length) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-line p-8 text-center text-muted">
        No bookings in this group yet.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {bookings.map((booking) => (
        <div key={booking.id} className="grid gap-3 rounded-lg border border-line bg-surface-soft p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-black">{booking.courtName} - {booking.venueName}</p>
            <p className="mt-1 text-sm text-muted">{booking.date} / {booking.time}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Badge tone={booking.status === "cancelled" ? "danger" : "neutral"}>{booking.status}</Badge>
            <strong>{formatCurrency(booking.amount)}</strong>
            {!booking.hasReview && booking.status === "confirmed" ? (
              <Link href={`/review/${booking.id}`} className="text-sm font-bold text-accent">Rate Session</Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
