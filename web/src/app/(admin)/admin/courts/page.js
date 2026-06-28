import { CourtsManager } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/api";

export default async function CourtsPage() {
  const overview = await getAdminOverview();
  return <CourtsManager courts={overview.courts} />;
}
