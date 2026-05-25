import { WalletView } from "@/components/features/dashboard";
import { getWallet } from "@/lib/api";

export const metadata = {
  title: "Wallet",
};

export default async function WalletPage() {
  const wallet = await getWallet();
  return <WalletView wallet={wallet} />;
}
