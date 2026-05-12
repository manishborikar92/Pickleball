import Link from "next/link";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { signOutDemo } from "@/app/actions/auth-actions";

const adminLinks = [
  ["/admin", "Overview"],
  ["/admin/bookings", "Bookings"],
  ["/admin/schedule", "Schedule"],
  ["/admin/pricing", "Pricing"],
  ["/admin/courts", "Courts"],
  ["/admin/users", "Users"],
  ["/admin/analytics", "Analytics"],
  ["/admin/settings", "Settings"],
];

export function AdminShell({ session, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="border-b border-line bg-surface md:min-h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="sticky top-0 p-6">
          <Link href="/" className="text-xl font-black text-accent">Pro-Tech Ops</Link>
          <div className="mt-5 rounded-lg border border-line bg-surface-panel p-4">
            <Badge tone="accent">{session.role.replace("_", " ")}</Badge>
            <p className="mt-3 font-bold">{session.user.name}</p>
            <p className="text-sm text-muted">Besa venue command center</p>
          </div>
          <nav className="mt-6 grid gap-2">
            {adminLinks.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-high hover:text-accent"
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={signOutDemo} className="mt-6">
            <Button variant="secondary" className="w-full" type="submit">Sign Out</Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
    </div>
  );
}
