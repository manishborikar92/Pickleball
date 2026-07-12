import { connection } from "next/server";
import { AppSidebar } from "@/components/layout";
import { requireRouteAccess } from "@/lib/dal/session";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomerLayout({ children }) {
  await connection();
  // Every dashboard route shares one permission (view_own_bookings), so the
  // route check is safe to run here; the DAL reads re-verify per request.
  const session = await requireRouteAccess("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground md:flex md:h-screen md:overflow-hidden">
      <AppSidebar session={session} />
      <main className="min-w-0 flex-1 p-5 sm:p-8 md:h-full md:overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
