import Link from "next/link";
import { Badge, Button, Card, SectionHeader } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";

export function DashboardOverview({ bookings, wallet }) {
  const upcoming = bookings.filter((booking) => booking.status === "confirmed").slice(0, 2);
  
  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="Player Dashboard">
        Review upcoming games, wallet credits, and booking history from one
        account surface.
      </SectionHeader>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Upcoming" value={String(upcoming.length)} />
        <Metric label="Wallet Credits" value={formatCurrency(wallet.balance)} />
        <Metric label="Past Sessions" value={String(bookings.length)} className="sm:col-span-2 lg:col-span-1" />
      </div>
      
      <Card className="flex flex-col p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black sm:text-2xl">Upcoming Bookings</h2>
          <Button href="/venues/besa-nagpur/book" className="w-full sm:w-auto">
            Book Again
          </Button>
        </div>
        <BookingList bookings={upcoming} />
      </Card>
    </div>
  );
}

export function BookingsView({ bookings }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="My Bookings">
        Bookings are grouped by status and ready for future pagination from the API.
      </SectionHeader>
      <Card className="p-5 sm:p-6 lg:p-8">
        <BookingList bookings={bookings} />
      </Card>
    </div>
  );
}

export function WalletView({ wallet }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="Wallet & Credits">
        Credits from business-initiated cancellations are auditable and applied
        during the pricing waterfall.
      </SectionHeader>
      
      <Metric label="Available Balance" value={formatCurrency(wallet.balance)} />
      
      <Card className="divide-y divide-line" as="div">
        {wallet.transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No transactions found.</div>
        ) : (
          wallet.transactions.map((transaction) => (
            <div 
              key={transaction.id} 
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div>
                <p className="font-bold text-foreground">{transaction.reason}</p>
                <p className="mt-1 text-xs text-muted sm:text-sm">
                  {transaction.type} &bull; {transaction.createdAt}
                </p>
              </div>
              <div className="flex items-center justify-between sm:flex-col sm:items-end">
                <p className="font-black text-accent sm:text-lg">{formatCurrency(transaction.amount)}</p>
                <p className="text-xs text-muted mt-0.5">Balance {formatCurrency(transaction.balanceAfter)}</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, className = "" }) {
  return (
    <Card className={`flex flex-col justify-center p-5 sm:p-6 ${className}`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted sm:text-sm">
        {label}
      </h3>
      <p className="mt-2 text-3xl font-black text-accent sm:mt-3 sm:text-4xl">{value}</p>
    </Card>
  );
}

function BookingList({ bookings }) {
  if (!bookings.length) {
    return (
      <div className="mt-6 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-high/50 p-8 text-center">
        <p className="text-sm font-medium text-muted">No bookings in this group yet.</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-4">
      {bookings.map((booking) => (
        <li 
          key={booking.id} 
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface-panel p-4 transition-colors hover:border-line/80 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex flex-col">
            <p className="font-black text-foreground sm:text-lg">
              {booking.courtName} <span className="text-muted/60 font-normal mx-1">&mdash;</span> {booking.venueName}
            </p>
            <p className="mt-1.5 text-sm font-medium text-muted">
              {booking.date} <span className="mx-1.5">&bull;</span> {booking.time}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 border-t border-line/50 pt-3 sm:border-0 sm:pt-0 sm:justify-end">
            <Badge tone={booking.status === "cancelled" ? "danger" : "neutral"}>
              {booking.status}
            </Badge>
            <strong className="text-foreground">{formatCurrency(booking.amount)}</strong>
            
            {!booking.hasReview && booking.status === "confirmed" && (
              <Link 
                href={`/review/${booking.id}`} 
                className="ml-auto text-sm font-bold text-accent transition-colors hover:text-accent-dim focus-visible:outline-none focus-visible:underline sm:ml-2"
              >
                Rate Session
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}