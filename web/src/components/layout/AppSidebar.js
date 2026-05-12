import Link from "next/link";

import { Button } from "@/components/shared/Button";
import { signOutDemo } from "@/app/actions/auth-actions";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/venues/besa-nagpur/book", label: "Book Again" },
];

export function AppSidebar({ session }) {
  return (
    <aside className="border-b border-line bg-surface md:min-h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="sticky top-0 flex flex-col gap-6 p-6">
        <Link href="/" className="text-xl font-black text-accent">Pro-Tech Courts</Link>
        <div className="rounded-lg border border-line bg-surface-panel p-4">
          <p className="font-bold text-foreground">{session.user.name}</p>
          <p className="mt-1 text-sm text-muted">{session.role.replace("_", " ")}</p>
        </div>
        <nav className="grid gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-high hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={signOutDemo}>
          <Button variant="secondary" className="w-full" type="submit">Sign Out</Button>
        </form>
      </div>
    </aside>
  );
}
