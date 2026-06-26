"use client";

import Link from "next/link";
import { Badge, Button, Card, SectionHeader } from "@/components/shared";
import { DataTable, StatusBadge, Currency, DateTime, TransactionType, TransactionDate } from "@/components/shared/Table";
import { useTable } from "@/hooks/useTable";
import { formatCurrency } from "@/lib/booking-engine";


/* ── Column Definitions ─────────────────────────── */

const BOOKING_COLUMNS = [
  {
    key: "courtNames",
    label: "Court / Venue",
    sortable: true,
    render: (val, row) => (
      <div>
        <strong className="text-sm font-bold text-foreground sm:text-base">
          {Array.isArray(val) ? val.join(", ") : val || "Court"}
        </strong>
        <span className="mx-1 text-muted/50 font-normal">&mdash;</span>
        <span className="text-xs sm:text-sm text-muted">{row.venueName}</span>
      </div>
    ),
  },
  {
    key: "date",
    label: "Reservation Date",
    sortable: true,
    render: (val, row) => <DateTime date={val} time={row.time} />,
  },
  {
    key: "status",
    label: "Status",
    filterable: true,
    filterOptions: ["confirmed", "completed", "cancelled"],
    render: (val) => <StatusBadge value={val} />,
  },
  {
    key: "amount",
    label: "Paid",
    sortable: true,
    render: (val) => <Currency value={val} />,
  },
  {
    key: "actions",
    label: "",
    className: "text-right",
    render: (_, row) => {
      if (!row.hasReview && row.status === "completed") {
        return (
          <Link
            href={`/review/${row.id}`}
            className="text-xs font-bold text-accent transition-colors hover:text-accent-dim focus-visible:outline-none focus-visible:underline"
          >
            Rate Session
          </Link>
        );
      }
      return null;
    },
  },
];

const TRANSACTION_COLUMNS = [
  {
    key: "reason",
    label: "Description",
    sortable: true,
    searchable: true,
    render: (val, row) => (
      <div>
        <p className="font-bold text-foreground">{val}</p>
        <div className="mt-1 text-xs text-muted md:hidden flex items-center gap-1.5">
          <TransactionType value={row.type} />
          <span className="text-muted/40">&bull;</span>
          <TransactionDate value={row.createdAt} />
        </div>
      </div>
    ),
  },
  {
    key: "type",
    label: "Type",
    className: "hidden md:table-cell text-muted",
    render: (val) => <TransactionType value={val} />,
  },
  {
    key: "createdAt",
    label: "Date",
    className: "hidden md:table-cell text-muted",
    render: (val) => <TransactionDate value={val} />,
  },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (val) => (
      <span className="font-black text-accent">{formatCurrency(val)}</span>
    ),
  },
  {
    key: "balanceAfter",
    label: "Balance After",
    className: "text-right md:pr-4",
    render: (val) => <Currency value={val} />,
  },
];

/* ── Main View Components ────────────────────────── */

export function DashboardOverview({ bookings = [], wallet }) {
  const upcoming = bookings.filter((booking) => booking.status === "confirmed").slice(0, 2);

  const table = useTable(upcoming, {
    columns: BOOKING_COLUMNS,
    defaultPageSize: 5,
  });

  const lastBooking = bookings.find((b) => b.venueSlug);
  const ctaHref = lastBooking ? `/venues/${lastBooking.venueSlug}/book` : "/";
  const ctaLabel = lastBooking ? "Book Again" : "Book Court";

  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="Player Dashboard">
        Review upcoming games, wallet credits, and booking history from one account surface.
      </SectionHeader>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Upcoming" value={String(bookings.filter((booking) => booking.status === "confirmed").length)} />
        <Metric label="Wallet Credits" value={formatCurrency(wallet.balance)} />
        <Metric label="Past Sessions" value={String(bookings.filter((booking) => booking.status === "completed").length)} className="sm:col-span-2 lg:col-span-1" />
      </div>
      
      <Card className="flex flex-col p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl font-black sm:text-2xl">Upcoming Bookings</h2>
          <Button href={ctaHref} className="w-full sm:w-auto">
            {ctaLabel}
          </Button>
        </div>
        
        <DataTable
          {...table}
          columns={BOOKING_COLUMNS}
          enableSearch={false}
          enableFiltering={false}
          enablePagination={false}
          emptyTitle="No upcoming bookings"
          emptyDescription="You have no confirmed sessions scheduled."
          mobileCardRenderer={MobileBookingCard}
        />
      </Card>
    </div>
  );
}

export function BookingsView({ bookings = [] }) {
  const table = useTable(bookings, {
    columns: BOOKING_COLUMNS,
    defaultPageSize: 5,
  });

  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="My Bookings">
        Bookings are grouped by status and ready for future pagination from the API.
      </SectionHeader>
      
      <DataTable
        {...table}
        columns={BOOKING_COLUMNS}
        enableSearch={false}
        emptyTitle="No bookings in this group yet"
        emptyDescription="Once you complete court reservations, they will show up here."
        mobileCardRenderer={MobileBookingCard}
      />
    </div>
  );
}

export function WalletView({ wallet }) {
  const table = useTable(wallet.transactions, {
    columns: TRANSACTION_COLUMNS,
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
    defaultPageSize: 5,
  });

  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeader align="left" title="Wallet & Credits">
        Credits from cancellations are applied during checkout automatically.
      </SectionHeader>
      
      <Metric label="Available Balance" value={formatCurrency(wallet.balance)} />
      
      <DataTable
        {...table}
        columns={TRANSACTION_COLUMNS}
        emptyTitle="No transactions found"
        emptyDescription="There is no credit or debit transaction history associated with this wallet."
        mobileCardRenderer={MobileTransactionCard}
      />
    </div>
  );
}

/* ── Metric Box Helper ──────────────────────────── */

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

/* ── Custom Mobile Layout Renderers ─────────────── */

function MobileBookingCard(row) {
  return (
    <div className="flex flex-col gap-3 p-5 hover:bg-surface-high/10 transition-colors">
      <div className="flex flex-col">
        <p className="font-bold text-foreground">
          {row.courtNames?.join(", ") || "Court"} <span className="text-muted/65 font-normal mx-1">&mdash;</span> {row.venueName}
        </p>
        <div className="mt-1">
          <DateTime date={row.date} time={row.time} />
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-line/40 pt-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge value={row.status} />
          <Currency value={row.amount} />
        </div>
        
        {!row.hasReview && row.status === "completed" && (
          <Link
            href={`/review/${row.id}`}
            className="text-xs font-bold text-accent transition-colors hover:text-accent-dim"
          >
            Rate Session
          </Link>
        )}
      </div>
    </div>
  );
}

function MobileTransactionCard(row) {
  return (
    <div className="flex flex-col gap-3 p-5 hover:bg-surface-high/10 transition-colors">
      <div>
        <p className="font-bold text-foreground">{row.reason}</p>
        <div className="mt-0.5 text-xs text-muted flex items-center gap-1.5">
          <TransactionType value={row.type} />
          <span className="text-muted/40">&bull;</span>
          <TransactionDate value={row.createdAt} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line/40 pt-2.5">
        <span className="text-xs text-muted">
          Balance {formatCurrency(row.balanceAfter)}
        </span>
        <strong className="text-sm font-black text-accent">
          {formatCurrency(row.amount)}
        </strong>
      </div>
    </div>
  );
}