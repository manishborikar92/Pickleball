"use client";

import { Gift, PartyPopper } from "lucide-react";

import { Badge, Card, EmptyState, SectionHeader } from "@/components/shared";
import { formatRewardDateShort } from "@/lib/rewardDates";
import { RewardExperience } from "./RewardExperience";
import { RewardReveal } from "./RewardReveal";

/**
 * My Rewards (UX spec §3.3): instances grouped into Pending and Past. Pending
 * cards are foil teasers — tapping one opens the scratch overlay, the same
 * experience as the booking-confirmation page. Past cards show the prize or
 * an expired/grey state.
 *
 * @param {Object} props
 * @param {object[]} props.rewards - Normalized reward instances (newest first).
 */
export function RewardsView({ rewards = [] }) {
  const pending = rewards.filter((reward) => reward.status === "pending");
  const past = rewards.filter((reward) => reward.status !== "pending");

  return (
    <div className="space-y-8 sm:space-y-10 flex flex-col md:h-full md:min-h-0 md:overflow-y-auto">
      <div className="shrink-0">
        <SectionHeader align="left" title="My Rewards">
          Every confirmed booking earns a scratch card. Reveal it before it expires to win venue offers.
        </SectionHeader>
      </div>

      <section aria-labelledby="pending-rewards-heading" className="space-y-4">
        <h2 id="pending-rewards-heading" className="text-xl font-black sm:text-2xl">
          Ready to Scratch
        </h2>
        {pending.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((reward) => (
              <RewardExperience key={reward.id} instance={reward} />
            ))}
          </div>
        ) : (
          <Card className="p-5 sm:p-6">
            <EmptyState
              title="No rewards waiting"
              description="Book and play a session — a scratch card lands here as soon as your booking is confirmed."
            />
          </Card>
        )}
      </section>

      <section aria-labelledby="past-rewards-heading" className="space-y-4">
        <h2 id="past-rewards-heading" className="text-xl font-black sm:text-2xl">
          Past
        </h2>
        {past.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((reward) => (
              <PastRewardCard key={reward.id} reward={reward} />
            ))}
          </div>
        ) : (
          <Card className="p-5 sm:p-6">
            <EmptyState
              title="Nothing here yet"
              description="Rewards you've revealed (or let expire) will show up here."
            />
          </Card>
        )}
      </section>
    </div>
  );
}

function PastRewardCard({ reward }) {
  const isExpired = reward.status === "expired";
  const won = reward.outcome?.type === "voucher";

  if (isExpired) {
    return (
      <Card className="flex h-full flex-col gap-4 p-5 opacity-60 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-high text-muted">
            <Gift className="h-6 w-6" aria-hidden="true" />
          </div>
          <Badge tone="neutral">Expired</Badge>
        </div>
        <div>
          <p className="font-bold text-muted">Unscratched card</p>
          <p className="mt-1 text-xs text-muted">
            From your booking on {formatRewardDateShort(reward.bookingSlotDate) || "—"}
          </p>
        </div>
      </Card>
    );
  }

  // Revealed voucher: the outcome view with the voucher chip and its live
  // redemption state — the same RewardReveal the pending path settles on.
  if (won) {
    return (
      <Card className="h-full p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Revealed {formatRewardDateShort(reward.revealedAt) || "—"}</p>
          <Badge tone="accent">Won</Badge>
        </div>
        <RewardReveal instance={reward} />
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-high text-muted">
          <PartyPopper className="h-6 w-6" aria-hidden="true" />
        </div>
        <Badge tone="neutral">No prize</Badge>
      </div>
      <div>
        <p className="font-bold text-muted">{reward.outcome?.label || "Revealed"}</p>
        <p className="mt-1 text-xs text-muted">
          Revealed {formatRewardDateShort(reward.revealedAt) || "—"}
        </p>
      </div>
    </Card>
  );
}
