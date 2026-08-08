"use client";

import { BaseSidebar } from "./BaseSidebar";
import { signOutCustomerAction } from "@/lib/actions/auth";
import { VENUE } from "@/config/venue.config";

const NAV_LINKS = [
  { href: "/dashboard/overview", label: "Overview", exact: true },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: `/venues/${VENUE.slug}/book`, label: "Book Again" },
];

export function AppSidebar({ session }) {
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
