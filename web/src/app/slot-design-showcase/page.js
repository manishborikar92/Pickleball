"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Lock,
  Ban,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

/* ── CONSTANTS & MOCK DATA ────────────────────────────────────────────── */

const EMOJI_MORPH_SEQUENCE = ["⏳", "🏓"];

const QUICK_JUMP_LINKS = [
  { id: "sec-1", label: "1. Production Baseline" },
  { id: "sec-2", label: "2. Naming (Hold)" },
  { id: "sec-3", label: "3. Animations" },
  { id: "sec-4", label: "4. Layout Concept" },
  { id: "sec-5", label: "5. Surface Styles" },
  { id: "sec-6", label: "6. Typography" },
  { id: "sec-7", label: "7. Benchmarks" },
  { id: "sec-8", label: "8. Complete Recommendation ⭐" },
];

const PRODUCTION_STATUS_STYLES = {
  available:
    "border-line bg-surface-high text-foreground hover:border-accent hover:bg-accent/10 cursor-pointer rounded-lg",
  selected:
    "border-accent bg-accent text-black shadow-sm ring-2 ring-accent ring-offset-1 ring-offset-background rounded-lg",
  pending:
    "border-accent/20 bg-accent/5 text-muted/40 cursor-not-allowed rounded-lg",
  booked:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed line-through rounded-lg",
  blocked:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed rounded-lg",
  past:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed rounded-lg",
  disabled:
    "border-line/30 bg-surface/10 text-muted/30 cursor-not-allowed rounded-lg",
  loading:
    "border-line/40 bg-surface/40 animate-pulse rounded-lg",
};

const PRODUCTION_STATUS_LABELS = {
  booked: "Taken",
  pending: "Hold",
  blocked: "Closed",
  past: "Past",
};

const INDUSTRY_BENCHMARKS = [
  {
    product: "Playtomic (Padel & Sports)",
    pattern: "Clean surface + Top-Right Signifier",
    detail:
      "Available slots show crisp start times. Temporary holds use a subtle yellow/amber background tint with a small top-right clock. Fully booked slots recede with a quiet gray strike.",
  },
  {
    product: "CourtReserve (Tennis & Pickleball)",
    pattern: "High-Contrast Grid + Status Badging",
    detail:
      "Uses high-contrast color pills for available slots. Held/pending sessions display 'In Reservation' with a countdown timer to create clear user awareness.",
  },
  {
    product: "OpenTable & Resy (Dining)",
    pattern: "Available-Only Spotlight",
    detail:
      "Displays only bookable time pills prominently. Unavailable slots are softly disabled or hidden, keeping visual focus 100% on bookable windows.",
  },
  {
    product: "Calendly & Google Calendar",
    pattern: "Time-First Clean Grid",
    detail:
      "100% time-dominant cards. Unavailable slots are simply grayed out without heavy text badges to keep the calendar grid clean and easy to scan.",
  },
  {
    product: "AirAsia & Airline Seat Selection",
    pattern: "Real-Time Hold Indicators",
    detail:
      "Seats in another user's cart turn amber with a mini clock icon, letting users know the seat may free up in a few minutes if checkout is abandoned.",
  },
  {
    product: "Movie Tickets (Fandango / BookMyShow)",
    pattern: "Color Legend (Green / Yellow / Red)",
    detail:
      "Green = Available, Yellow = Filling Fast / Held, Red = Sold Out. Instant color recognition before reading any text.",
  },
];

const RECOMMENDATION_POINTS = [
  {
    num: "1",
    title: "Wording",
    value: '"Hold"',
    desc: "Explicit indicator for active checkout reservation.",
  },
  {
    num: "2",
    title: "Iconography",
    value: "Top-Right Clock Icon",
    desc: "Positioned at `absolute top-0.5 right-0.5` as a non-intrusive visual signifier.",
  },
  {
    num: "3",
    title: "Visual Signifier",
    value: "Static Lucide Clock",
    desc: "Clean static Lucide Clock icon for Hold state, Lock for Booked, Ban for Closed.",
  },
  {
    num: "4",
    title: "Dual-Zone Layout",
    value: "Time Dominant + Bottom Status",
    desc: "Times remain centered in the card body with status label at bottom.",
  },
  {
    num: "5",
    title: "Surface Color Language",
    value: "Contextual Tints",
    desc: "Available (Dark Slate Glow), Selected (Solid Neon Accent), Reserved (Soft Amber Fill `bg-amber-500/10`).",
  },
  {
    num: "6",
    title: "Typography Scale",
    value: "12-Hour AM/PM + Title Case",
    desc: "Start time (`text-xs sm:text-sm font-bold`), End time (`text-[10px] sm:text-[11px] font-medium`), Label (`text-[10px] font-semibold`).",
  },
];

/* ── MAIN SHOWCASE PAGE COMPONENT ─────────────────────────────────────── */

/**
 * Internal Slot Card Design Showcase Page.
 * Section 1 faithfully mirrors the current production SlotGrid baseline.
 * Sections 2-7 evaluate specific design variables.
 * Section 8 presents the complete 8-state recommended design system.
 */
export default function SlotDesignShowcasePage() {
  const [timeFormat, setTimeFormat] = useState("12h");
  const [morphIdx, setMorphIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMorphIdx((prev) => (prev + 1) % EMOJI_MORPH_SEQUENCE.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const safeMorphIdx = morphIdx % EMOJI_MORPH_SEQUENCE.length;
  const morphEmoji = EMOJI_MORPH_SEQUENCE[safeMorphIdx] || "⏳";

  const sampleStart = timeFormat === "12h" ? "7:00 AM" : "07:00";
  const sampleEnd = timeFormat === "12h" ? "8:00 AM" : "08:00";

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <style jsx global>{`
        @keyframes paddleSwing {
          0%, 100% {
            transform: rotate(-20deg);
          }
          50% {
            transform: rotate(20deg);
          }
        }
        .animate-paddle-swing {
          animation: paddleSwing 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Header Navigation */}
      <ShowcaseHeader timeFormat={timeFormat} setTimeFormat={setTimeFormat} />

      {/* Hero Sub-header */}
      <ShowcaseHero />

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6">

        {/* ── SECTION 1: PRODUCTION BASELINE ────────────────────────── */}
        <ShowcaseSection
          id="sec-1"
          title="Section 1 — Every Booking State (Current Production Baseline)"
          description="Exact visual representation of the current production booking page (SlotGrid.js) as it exists today."
        >
          <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
            <ShowcaseItem label="1. Available" sub="Current Production">
              <ProductionBaselineSlotCard status="available" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="2. Selected" sub="Current Production">
              <ProductionBaselineSlotCard status="selected" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="3. Reserved (Pending)" sub="Current Production">
              <ProductionBaselineSlotCard status="pending" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="4. Booked (Taken)" sub="Current Production">
              <ProductionBaselineSlotCard status="booked" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="5. Closed (Blocked)" sub="Current Production">
              <ProductionBaselineSlotCard status="blocked" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="6. Past" sub="Current Production">
              <ProductionBaselineSlotCard status="past" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="7. Disabled" sub="Current Production">
              <ProductionBaselineSlotCard status="disabled" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="8. Loading" sub="Current Production">
              <ProductionBaselineSlotCard status="loading" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 2: NAMING VARIATIONS (ONLY HOLD) ───────────────── */}
        <ShowcaseSection
          id="sec-2"
          title='Section 2 — Naming Option ("Hold")'
          description='Filtered evaluation for the "Hold" naming label.'
        >
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
            <ShowcaseItem label="Hold" sub="Legacy / Technical">
              <SlotCard variant="reserved" startTime={sampleStart} endTime={sampleEnd} label="Hold" icon={<Clock className="h-3 w-3" />} />
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 3: ANIMATED VARIATIONS ────────────────────────── */}
        <ShowcaseSection
          id="sec-3"
          title="Section 3 — Animated Micro-Interactions & Real Clock Hands"
          description="Comparing real clock hands rotating vs whole-icon rotation."
        >
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
            {/* 1. Real Clock (Smooth Rotating Hands) */}
            <ShowcaseItem label="Real Analog Clock" sub="Rotating Hour & Minute Hands">
              <SlotCard variant="reserved" startTime={sampleStart} endTime={sampleEnd} label="Hold" customIcon={<RealAnalogClock />} />
            </ShowcaseItem>

            {/* 3. Emoji Morphing Sequence (⏳ Flip ➔ 🏓 Court Swing) */}
            <ShowcaseItem label="Emoji Morphing Cycle" sub="⏳ (Flip) ➔ 🏓 (Swing)">
              <SlotCard
                variant="reserved"
                startTime={sampleStart}
                endTime={sampleEnd}
                label="Hold"
                customIcon={
                  <span
                    key={morphEmoji}
                    className={`text-xs inline-block ${
                      morphEmoji === "⏳"
                        ? "animate-[spin_3s_ease-in-out_infinite]"
                        : "animate-paddle-swing"
                    }`}
                  >
                    {morphEmoji}
                  </span>
                }
              />
            </ShowcaseItem>

            {/* 4. Hourglass 180° Flip */}
            <ShowcaseItem label="Hourglass Flip ⏳" sub="180° Flip Pulse">
              <SlotCard
                variant="reserved"
                startTime={sampleStart}
                endTime={sampleEnd}
                label="Hold"
                customIcon={<span className="text-xs inline-block animate-[spin_3s_ease-in-out_infinite]">⏳</span>}
              />
            </ShowcaseItem>

            {/* 5. Player Paddle Swing 🏓 */}
            <ShowcaseItem label="Player Paddle Swing 🏓" sub="Real Forehand Swing">
              <SlotCard
                variant="reserved"
                startTime={sampleStart}
                endTime={sampleEnd}
                label="Hold"
                customIcon={<span className="text-xs inline-block animate-paddle-swing">🏓</span>}
              />
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 4: LAYOUT CONCEPTS ────────────────────────────── */}
        <ShowcaseSection
          id="sec-4"
          title='Section 4 — Layout Concept ("Top-Right Icon + Bottom Label")'
          description="Filtered evaluation for the Top-Right Icon + Bottom Label card structure."
        >
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
            <ShowcaseItem label="Top-Right Icon + Bottom Label" sub="Production Card Structure">
              <SlotCard variant="reserved" startTime={sampleStart} endTime={sampleEnd} label="Hold" icon={<Clock className="h-3 w-3" />} />
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 5: SURFACE STYLING ────────────────────────────── */}
        <ShowcaseSection
          id="sec-5"
          title="Section 5 — Surface Styling Variations"
          description="Comparing backdrop surfaces, borders, shadows, and glassmorphism."
        >
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
            <ShowcaseItem label="Muted Flat Gray" sub="Quiet Surface">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/40 bg-surface/30 p-3 sm:p-3.5 text-center">
                <span className="block text-xs sm:text-sm font-bold text-muted leading-none">{sampleStart}</span>
                <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted/70 leading-none">{sampleEnd}</span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Amber Hold Tint" sub="Soft Reservation Tint">
              <SlotCard variant="reserved" startTime={sampleStart} endTime={sampleEnd} />
            </ShowcaseItem>

            <ShowcaseItem label="Glassmorphism" sub="Backdrop Blur">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3 sm:p-3.5 text-center backdrop-blur-md">
                <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{sampleEnd}</span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Subtle Gradient" sub="Soft Radial Fill">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-500/5 p-3 sm:p-3.5 text-center">
                <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{sampleEnd}</span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Elevated Card" sub="Deep Shadow">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 sm:p-3.5 text-center shadow-lg">
                <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{sampleEnd}</span>
              </div>
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 6: TYPOGRAPHY ─────────────────────────────────── */}
        <ShowcaseSection
          id="sec-6"
          title="Section 6 — Typography Comparison"
          description="Comparing case (UPPERCASE vs Title Case), font weight, and size."
        >
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
            <ShowcaseItem label="UPPERCASE" sub="TRACKING WIDE">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-2 text-[9px] font-black uppercase tracking-wider text-amber-400 leading-none">
                  HOLD
                </span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Title Case" sub="Standard">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-2 text-[10px] font-semibold text-amber-400 leading-none">
                  Hold
                </span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Sentence case" sub="Soft">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs font-bold text-foreground leading-none">{sampleStart}</span>
                <span className="mt-2 text-[10px] font-medium text-amber-400 leading-none">
                  Hold
                </span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Font-Bold (700)" sub="Strong Weight">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{sampleStart}</span>
              </div>
            </ShowcaseItem>

            <ShowcaseItem label="Font-Black (900)" sub="Ultra Heavy">
              <div className="flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-xs sm:text-sm font-black text-foreground leading-none">{sampleStart}</span>
              </div>
            </ShowcaseItem>
          </div>
        </ShowcaseSection>

        {/* ── SECTION 7: INDUSTRY BENCHMARKS ───────────────────────── */}
        <ShowcaseSection
          id="sec-7"
          title="Section 7 — Industry Benchmark Analysis"
          description="Summary of interaction patterns used by leading consumer booking products."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {INDUSTRY_BENCHMARKS.map((item) => (
              <article
                key={item.product}
                className="rounded-xl border border-line/60 bg-surface/50 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">{item.product}</span>
                  <span className="text-[10px] font-semibold text-muted bg-surface px-2 py-0.5 rounded border border-line/40">
                    {item.pattern}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{item.detail}</p>
              </article>
            ))}
          </div>
        </ShowcaseSection>

        {/* ── SECTION 8: COMPLETE RECOMMENDED DESIGN SYSTEM ⭐ ──────── */}
        <ShowcaseSection
          id="sec-8"
          title="Section 8 — Complete Recommended Design System ⭐"
          description="Full suite of every slot state rendered inside the exact production CourtSlots grid using the recommended design language."
        >
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-surface to-surface p-6 space-y-8 shadow-xl">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/40 pb-4">
              <div>
                <h3 className="text-base font-black text-foreground sm:text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <span>Production Design System Suite</span>
                </h3>
                <p className="text-xs text-muted mt-0.5 max-w-2xl">
                  Demonstrating how <strong>every slot state</strong> looks when adopting the recommended Top-Right Icon + Bottom Label structure with dual-zone centered times.
                </p>
              </div>
              <span className="shrink-0 self-start sm:self-auto rounded-full bg-amber-500/20 px-3 py-1 text-xs font-extrabold text-amber-300 border border-amber-500/30">
                8 Complete States
              </span>
            </div>

            {/* Complete 8-State Grid in Production Dimensions */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-accent">
                Production CourtSlots Grid Matrix (Recommended Design System)
              </h4>

              <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5">
                <ShowcaseItem label="1. Available" sub="Primary Clickable State">
                  <SlotCard variant="available" startTime={sampleStart} endTime={sampleEnd} />
                </ShowcaseItem>

                <ShowcaseItem label="2. Selected" sub="Active User Range">
                  <SlotCard variant="selected" startTime={sampleStart} endTime={sampleEnd} />
                </ShowcaseItem>

                <ShowcaseItem label="3. Reserved / Hold" sub="Active Checkout Hold">
                  <SlotCard variant="reserved" startTime={sampleStart} endTime={sampleEnd} label="Hold" icon={<Clock className="h-3 w-3" />} />
                </ShowcaseItem>

                <ShowcaseItem label="4. Booked" sub="Confirmed Session">
                  <SlotCard variant="booked" startTime={sampleStart} endTime={sampleEnd} label="Booked" icon={<Lock className="h-3 w-3" />} />
                </ShowcaseItem>

                <ShowcaseItem label="5. Closed" sub="Venue Maintenance">
                  <SlotCard variant="closed" startTime={sampleStart} endTime={sampleEnd} label="Closed" icon={<Ban className="h-3 w-3" />} />
                </ShowcaseItem>

                <ShowcaseItem label="6. Past" sub="Elapsed Window Today">
                  <SlotCard variant="past" startTime={sampleStart} endTime={sampleEnd} label="Past" />
                </ShowcaseItem>

                <ShowcaseItem label="7. Disabled" sub="Rule / Advance Window">
                  <SlotCard variant="disabled" startTime={sampleStart} endTime={sampleEnd} />
                </ShowcaseItem>

                <ShowcaseItem label="8. Loading" sub="Skeleton Shimmer">
                  <SlotCard variant="loading" startTime={sampleStart} endTime={sampleEnd} />
                </ShowcaseItem>
              </div>
            </div>

            {/* Recommended Design Principles Breakdown */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-accent">
                Design System Specification Summary
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {RECOMMENDATION_POINTS.map((pt) => (
                  <div key={pt.num} className="rounded-xl bg-surface/60 border border-line/40 p-4 space-y-1">
                    <span className="font-bold text-accent uppercase tracking-wider text-[10px]">{pt.num}. {pt.title}</span>
                    <p className="font-semibold text-foreground text-sm">{pt.value}</p>
                    <p className="text-muted leading-relaxed">{pt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </ShowcaseSection>

      </main>
    </div>
  );
}

/* ── SUB-COMPONENTS ──────────────────────────────────────────────────── */

/**
 * ProductionBaselineSlotCard: Faithful 100% replica of current production SlotGrid.js.
 */
function ProductionBaselineSlotCard({ status = "available", startTime, endTime }) {
  const isAvailable = status === "available";
  const label = PRODUCTION_STATUS_LABELS[status];
  const styleClass = PRODUCTION_STATUS_STYLES[status] || PRODUCTION_STATUS_STYLES.available;

  return (
    <div
      className={`relative flex min-h-[64px] w-full flex-col items-center justify-center border p-2 text-center text-xs font-bold transition-all sm:min-h-[72px] sm:p-3 ${styleClass}`}
    >
      <span className="block text-[12px] font-bold sm:text-xs leading-tight">
        {startTime}
      </span>
      <span className="mt-0.5 block text-[10px] font-medium opacity-75 sm:text-[11px] leading-tight">
        {endTime}
      </span>
      {!isAvailable && label && (
        <span className="absolute inset-x-0 bottom-1.5 text-[9px] font-black uppercase tracking-wider opacity-60">
          {label}
        </span>
      )}
    </div>
  );
}

function ShowcaseHeader({ timeFormat, setTimeFormat }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition-colors shrink-0"
            aria-label="Back to venue booking"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </Link>
          <span className="h-4 w-px bg-line/60 shrink-0" aria-hidden="true" />
          <h1 className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
            Slot Design Showcase
          </h1>
          <span className="hidden sm:inline-block shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent border border-accent/20 whitespace-nowrap">
            Internal Evaluation
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-lg bg-surface border border-line p-1 text-xs font-semibold shrink-0" role="group" aria-label="Time Format Selection">
            <button
              type="button"
              onClick={() => setTimeFormat("12h")}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                timeFormat === "12h"
                  ? "bg-accent text-black font-bold shadow-2xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              12-Hour
            </button>
            <button
              type="button"
              onClick={() => setTimeFormat("24h")}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                timeFormat === "24h"
                  ? "bg-accent text-black font-bold shadow-2xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              24-Hour
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ShowcaseHero() {
  return (
    <div className="border-b border-line/50 bg-surface/30 py-5 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs text-muted sm:text-sm max-w-3xl leading-relaxed">
          Evaluation gallery. <strong>Section 1 mirrors current production SlotGrid.js</strong>. Sections 2–7 isolate specific design variables. <strong>Section 8 demonstrates the complete recommended design system</strong> across all 8 states inside production CourtSlots dimensions (<code className="text-accent text-[11px]">grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5; min-h-[72px] sm:min-h-[80px] w-full p-3 sm:p-3.5</code>).
        </p>

        {/* Quick Jump Links */}
        <nav className="mt-4 flex flex-wrap gap-2 text-xs font-semibold" aria-label="Showcase Sections">
          {QUICK_JUMP_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="rounded-lg bg-surface border border-line px-3 py-1.5 text-muted hover:text-accent hover:border-accent/40 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ShowcaseSection({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="border-b border-line pb-3">
        <h2 className="text-lg font-black tracking-tight text-foreground">
          {title}
        </h2>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ShowcaseItem({ label, sub, children }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-line/50 bg-surface/30 p-2.5 space-y-2">
      <div className="space-y-0.5">
        <span className="block text-xs font-bold text-foreground truncate">{label}</span>
        {sub && <span className="block text-[10px] font-medium text-muted truncate">{sub}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Standardized SlotCard presenter matching 100% of production CourtSlots dimensions.
 */
function SlotCard({ variant = "available", startTime, endTime, label, icon, customIcon }) {
  if (variant === "loading") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/40 bg-surface/40 p-3 sm:p-3.5 text-center animate-pulse">
        <div className="h-3.5 w-12 rounded bg-muted/20" />
        <div className="mt-1.5 h-2.5 w-10 rounded bg-muted/20" />
        <div className="mt-2 h-2 w-8 rounded bg-muted/20" />
      </div>
    );
  }

  if (variant === "selected") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-accent bg-accent p-3 sm:p-3.5 text-center text-black shadow-md ring-2 ring-accent ring-offset-1 ring-offset-background">
        <span className="block text-xs sm:text-sm font-bold leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-black/80 leading-none">{endTime}</span>
      </div>
    );
  }

  if (variant === "booked") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/40 bg-surface/20 p-3 sm:p-3.5 text-center opacity-60">
        <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-muted/60">
          {icon || <Lock className="h-3 w-3" />}
        </span>
        <span className="block text-xs sm:text-sm font-bold text-foreground/60 line-through leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted/50 leading-none">{endTime}</span>
        {label && <span className="mt-2 text-[10px] font-semibold text-muted/60 leading-none">{label}</span>}
      </div>
    );
  }

  if (variant === "closed") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/40 bg-surface/20 p-3 sm:p-3.5 text-center opacity-50">
        <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-muted/60">
          {icon || <Ban className="h-3 w-3" />}
        </span>
        <span className="block text-xs sm:text-sm font-bold text-foreground/50 leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted/40 leading-none">{endTime}</span>
        {label && <span className="mt-2 text-[10px] font-semibold text-muted/60 leading-none">{label}</span>}
      </div>
    );
  }

  if (variant === "past") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/30 bg-surface/10 p-3 sm:p-3.5 text-center opacity-30">
        <span className="block text-xs sm:text-sm font-bold text-muted line-through leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{endTime}</span>
        {label && <span className="mt-2 text-[10px] font-semibold text-muted leading-none">{label}</span>}
      </div>
    );
  }

  if (variant === "disabled") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line/20 bg-surface/10 p-3 sm:p-3.5 text-center opacity-40 cursor-not-allowed">
        <span className="block text-xs sm:text-sm font-bold text-muted leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{endTime}</span>
      </div>
    );
  }

  if (variant === "reserved") {
    return (
      <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-3.5 text-center">
        {(customIcon || icon) && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-amber-400">
            {customIcon || icon}
          </span>
        )}
        <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{startTime}</span>
        <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{endTime}</span>
        {label && <span className="mt-2 text-[10px] font-semibold text-amber-300 leading-none">{label}</span>}
      </div>
    );
  }

  // Default: available
  return (
    <div className="relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface-high p-3 sm:p-3.5 text-center transition-all hover:border-accent hover:bg-accent/10 cursor-pointer shadow-2xs">
      <span className="block text-xs sm:text-sm font-bold text-foreground leading-none">{startTime}</span>
      <span className="mt-1 block text-[10px] sm:text-[11px] font-medium text-muted leading-none">{endTime}</span>
    </div>
  );
}

function RealAnalogClock({ className = "h-3.5 w-3.5 text-amber-400" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" className="stroke-amber-400/80" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" className="text-amber-300" />
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="7"
        className="origin-[12px_12px] animate-[spin_24s_linear_infinite]"
        strokeWidth="2"
      />
      <line
        x1="12"
        y1="12"
        x2="12"
        y2="5"
        className="origin-[12px_12px] animate-[spin_6s_linear_infinite]"
        strokeWidth="1.5"
      />
    </svg>
  );
}
