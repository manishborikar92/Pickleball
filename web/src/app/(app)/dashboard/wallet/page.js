import { WalletView } from "@/components/features/dashboard/DashboardViews";
import { getWallet } from "@/lib/api";
import { requireRouteAccess } from "@/lib/session";

export const metadata = {
  title: "Wallet",
};

export default async function WalletPage() {
  await requireRouteAccess("/dashboard/wallet");
  const wallet = await getWallet();
  return <WalletView wallet={wallet} />;
}
