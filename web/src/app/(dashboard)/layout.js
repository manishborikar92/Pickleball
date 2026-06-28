import { connection } from "next/server";
import { AppSidebar } from "@/components/layout";
import { requireRouteAccess } from "@/lib/session";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CustomerLayout({ children }) {
  await connection();
  const session = await requireRouteAccess("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <AppSidebar session={session} />
      <main className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
    </div>
  );
}
