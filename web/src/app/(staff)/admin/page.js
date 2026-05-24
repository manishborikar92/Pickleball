import { AdminOverview } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/api";

export const metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const overview = await getAdminOverview();
  return <AdminOverview overview={overview} />;
}
