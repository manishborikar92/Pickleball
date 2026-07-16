import { Suspense } from "react";
import { RewardsView } from "@/components/features/rewards";
import { getMyRewards } from "@/lib/dal/rewards";

export const metadata = { title: "My Rewards" };

async function RewardsContent() {
  const rewards = await getMyRewards();
  return <RewardsView rewards={rewards} />;
}

function RewardsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 rounded-xl bg-surface-panel" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-44 rounded-xl bg-surface-panel" />
        <div className="h-44 rounded-xl bg-surface-panel" />
      </div>
    </div>
  );
}

export default function RewardsPage() {
  return (
    <Suspense fallback={<RewardsSkeleton />}>
      <RewardsContent />
    </Suspense>
  );
}
