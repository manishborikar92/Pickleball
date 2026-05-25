"use client";

import { BaseSidebar } from "./BaseSidebar";
import { signOutCustomerAction } from "@/app/actions/auth-actions";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/venues/besa-nagpur/book", label: "Book Again" },
];

export function AppSidebar({ session: propSession }) {
  const { session: hookSession } = useAuth();
  const session = hookSession || propSession;

  return (
    <BaseSidebar
      title="Baseline Arena"
      logoSrc="/baseline-logo.svg"
      navLinks={NAV_LINKS}
      session={session}
      signOutAction={signOutCustomerAction}
    />
  );
}