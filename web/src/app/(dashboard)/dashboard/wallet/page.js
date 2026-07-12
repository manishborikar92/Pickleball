import { Suspense } from "react";
import { WalletView } from "@/components/features/dashboard";
import { getWallet } from "@/lib/dal/wallet";

export const metadata = { title: "Wallet" };

async function WalletContent() {
  const wallet = await getWallet();
  return <WalletView wallet={wallet} />;
}

function WalletSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 rounded-xl bg-surface-panel" />
      <div className="h-64 rounded-xl bg-surface-panel" />
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletSkeleton />}>
      <WalletContent />
    </Suspense>
  );
}
