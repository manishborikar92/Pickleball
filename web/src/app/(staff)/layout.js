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
  return <AdminShell session={session}>{children}</AdminShell>;
}
