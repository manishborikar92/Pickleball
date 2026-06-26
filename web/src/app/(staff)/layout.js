import { AdminShell, SessionHydrator } from "@/components/layout";
import { requireRouteAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StaffLayout({ children }) {
  const session = await requireRouteAccess("/admin");
  return (
    <>
      <SessionHydrator session={session} />
      <AdminShell session={session}>{children}</AdminShell>
    </>
  );
}
