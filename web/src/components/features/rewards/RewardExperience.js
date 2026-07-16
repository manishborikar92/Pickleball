"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, Gift, X } from "lucide-react";

import { Card, Portal } from "@/components/shared";
import { useOverlay } from "@/hooks/useOverlay";
import { daysUntil, formatRewardDateShort } from "@/lib/rewardDates";
import { RewardReveal } from "./RewardReveal";

// Let the confirmation page settle before the overlay takes the stage — an
// instant modal on redirect feels like an interruption, a short beat feels
// like a gift being handed over.
const AUTO_OPEN_DELAY_MS = 650;

/**
 * The complete reward experience for one instance: a foil teaser card that
 * lives in the host page (booking confirmation right panel, My Rewards) and
 * a scratch overlay it opens.
 *
 * Flow (UX spec §3.4 revision):
 *  - `autoOpen` (booking confirmation): the overlay presents itself once,
 *    shortly after mount. Closing it unscratched leaves the teaser card;
 *    tapping the card reopens the overlay — the reward is never lost.
 *  - Revealed instances render the outcome/voucher card directly (no modal,
 *    no canvas); expired ones render the muted expired card.
 *
 * Exactly one scratch canvas ever exists (inside the overlay) — the teaser
 * card is purely presentational.
 *
 * @param {Object}  props
 * @param {Object}  props.instance - Normalized reward instance.
 * @param {boolean} [props.autoOpen] - Present the overlay on mount (pending only).
 */
export function RewardExperience({ instance, autoOpen = false }) {
  const [current, setCurrent] = useState(instance);
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const isExpired = current.status === "expired"
    || (current.status === "pending" && current.expiresAt && new Date(current.expiresAt) <= new Date());
  const isScratchable = current.status === "pending" && !isExpired;

  useEffect(() => {
    if (!autoOpen || !isScratchable || autoOpenedRef.current) return undefined;
    autoOpenedRef.current = true;
    const timer = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoOpen, isScratchable]);

  return (
    <>
      {/* In-page slot: foil teaser while scratchable, the outcome/expired
          card otherwise. After a reveal inside the overlay this switches
          behind the modal, so closing it lands on the prize. */}
      {isScratchable ? (
        <RewardTeaserCard instance={current} onOpen={() => setOpen(true)} />
      ) : (
        <Card className="border-t-4 border-t-accent p-5 sm:p-6">
          <RewardReveal instance={current} />
        </Card>
      )}

      {/* The overlay outlives the reveal — it closes only on user intent
          (X, Escape, backdrop), never by the state flip mid-celebration. */}
      {open && (
        <Portal>
          <RewardScratchOverlay
            instance={current}
            onRevealed={(data) => setCurrent((prev) => ({ ...prev, ...data }))}
            onClose={() => setOpen(false)}
          />
        </Portal>
      )}
    </>
  );
}

/* ── Teaser card (in-page) ──────────────────────── */

/**
 * The unscratched reward as a tappable foil card — same metallic court-green
 * family as the canvas foil so the overlay feels like a zoom-in of this card.
 */
function RewardTeaserCard({ instance, onOpen }) {
  const remaining = daysUntil(instance.expiresAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Scratch card waiting — ${remaining === 0 ? "expires today" : `${remaining} day${remaining === 1 ? "" : "s"} left`}. Tap to scratch and reveal your reward.`}
      className="group relative block w-full overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-[#31371f] via-[#414a28] to-[#272c17] p-5 text-left shadow-[0_8px_40px_rgba(202,255,0,0.08)] transition-all duration-300 hover:scale-[1.015] hover:border-accent/50 hover:shadow-[0_10px_50px_rgba(202,255,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] sm:p-6"
    >
      {/* Sheen sweep — the same invitation cue as the canvas foil. */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
        <span className="absolute inset-y-[-40%] w-1/4 -skew-x-12 animate-reward-sheen bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </span>

      <span className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30 transition-transform duration-300 group-hover:scale-105" aria-hidden="true">
          <Gift className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Scratch &amp; Win
          </span>
          <span className="mt-0.5 block text-base font-black leading-tight text-foreground sm:text-lg">
            You&apos;ve earned a reward!
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {remaining === 0 ? "Expires today" : `${remaining} day${remaining === 1 ? "" : "s"} left to scratch`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted transition-colors group-hover:text-accent" aria-hidden="true">
          <span className="hidden sm:inline">Scratch</span>
          <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

/* ── Scratch overlay ────────────────────────────── */

/**
 * Bottom sheet on mobile, centered dialog on desktop — the same overlay
 * grammar as the checkout AuthFlow (backdrop blur, Escape/backdrop/X close,
 * focus trap via useOverlay). The reveal itself is RewardReveal; a reveal
 * that already happened stays visible until the user closes.
 */
function RewardScratchOverlay({ instance, onRevealed, onClose }) {
  const { containerRef, contentRef, handleBackdropClick } = useOverlay({
    isOpen: true,
    onClose,
  });

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-md animate-overlay-fade-in md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Scratch card reward"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-line bg-surface-high shadow-2xl animate-modal-slide-up focus:outline-none md:max-h-[85vh] md:max-w-md md:rounded-3xl md:border md:animate-modal-scale-in"
      >
        {/* Close icon — top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-foreground focus-visible:bg-surface-panel focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close scratch card"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Drag handle — mobile only */}
        <div className="flex shrink-0 items-center justify-center pb-2 pt-4 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-1.5 w-12 rounded-full bg-muted/30 transition-colors hover:bg-muted/50"
            aria-label="Close scratch card"
          />
        </div>

        <div className="overflow-y-auto hide-scrollbar p-5 pb-safe pt-10 sm:p-6 sm:pt-12">
          <div className="mb-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Scratch &amp; Win
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Your booking earned a reward
            </h2>
            {instance.bookingSlotDate && (
              <p className="mt-1 text-xs text-muted">
                From your session on {formatRewardDateShort(instance.bookingSlotDate)}
              </p>
            )}
          </div>

          <RewardReveal instance={instance} onRevealed={onRevealed} />
        </div>
      </div>
    </div>
  );
}
