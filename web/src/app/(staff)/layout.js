import AppProviders from "@/providers/AppProviders";
import { AdminShell } from "@/components/layout";
import { requireRouteAccess } from "@/lib/session";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StaffLayout({ children }) {
  const session = await requireRouteAccess("/admin");
  return (
    <AppProviders>
      <AdminShell session={session}>{children}</AdminShell>
    </AppProviders>
  );
}
