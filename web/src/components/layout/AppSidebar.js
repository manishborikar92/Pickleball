"use client";

import { BaseSidebar } from "./BaseSidebar";
import { signOutCustomerAction } from "@/app/actions/auth-actions";
import { useAuth } from "@/hooks/useAuth";
import { VENUE } from "@/config/venue.config";

const NAV_LINKS = [
  { href: "/dashboard/overview", label: "Overview", exact: true },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: `/venues/${VENUE.slug}/book`, label: "Book Again" },
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