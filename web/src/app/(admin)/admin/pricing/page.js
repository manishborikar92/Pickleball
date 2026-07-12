import { PricingManager } from "@/components/features/admin";
import { requireRouteAccess } from "@/lib/dal/session";

export default async function PricingPage() {
  await requireRouteAccess("/admin/pricing");
  return <PricingManager />;
}
