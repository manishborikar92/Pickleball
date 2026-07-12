import { connection } from "next/server";
import { AdminShell } from "@/components/layout";
import { requireUser } from "@/lib/dal/session";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({ children }) {
  await connection();
  // The layout establishes authentication + the session for the shell. Fine-
  // grained per-route permission checks live in each page (requireRouteAccess),
  // because layouts do not re-render on client-side sibling navigation (CR-1).
  const session = await requireUser("/admin");
  return (
    <AdminShell session={session}>{children}</AdminShell>
  );
}
