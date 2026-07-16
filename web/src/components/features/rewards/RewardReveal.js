"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Gift, PartyPopper, Sparkles } from "lucide-react";

import { Button } from "@/components/shared";
import { revealRewardAction } from "@/lib/actions/rewards";
import { daysUntil, formatRewardDateShort } from "@/lib/rewardDates";

/**
 * Inline reward reveal — the single scratch + outcome view, always rendered
 * in context (inside RewardExperience's overlay or directly on My Rewards),
 * never on a standalone route.
 *
 * Interaction design (researched against Google Pay-style scratch cards):
 *  - Foil is a painted canvas layer: gradient base, diagonal pattern,
 *    sparkles, and "SCRATCH & WIN" branding, with a sheen sweep inviting touch.
 *  - Scratching erases interpolated line strokes (destination-out), so fast
 *    swipes leave a continuous groove rather than dotted circles.
 *  - Crossing ~55% coverage auto-clears the rest (foil fades out) and asks the
 *    server for the pre-computed outcome — the reveal renders a fact, never
 *    requests a draw.
 *  - Wins celebrate with a confetti burst (canvas-confetti,
 *    disableForReducedMotion) and light haptics where supported.
 *  - The scratch gesture is cosmetic: an explicit "Reveal without scratching"
 *    button serves keyboard/AT/reduced-motion users.
 *
 * State machine (self-contained):
 *   pending + unexpired → scratch surface
 *   revealed            → outcome + voucher (identical whether revealed just
 *                         now or on a previous visit — ADR-W004)
 *   expired             → non-interactive expired chip
 *
 * Reveal-once and concurrency rules live server-side; a conflict (revealed in
 * another tab) resolves by refreshing the route into the revealed state.
 *
 * @param {Object}   props
 * @param {Object}   props.instance - Normalized reward instance.
 * @param {Function} [props.onRevealed] - Notified with the reveal payload so a
 *   host component (RewardExperience) can lift the revealed state.
 */
export function RewardReveal({ instance, onRevealed }) {
  const [revealed, setRevealed] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  // Server-known outcome (revisit) or client reveal result — same view.
  if (instance.status === "revealed" || revealed) {
    return (
      <OutcomePanel
        instance={revealed ? { ...instance, ...revealed } : instance}
        animated={celebrate}
      />
    );
  }

  const isExpired = instance.status === "expired"
    || (instance.expiresAt && new Date(instance.expiresAt) <= new Date());
  if (isExpired) {
    return <ExpiredPanel />;
  }

  return (
    <ScratchPanel
      instance={instance}
      onRevealed={(data) => {
        setCelebrate(true);
        setRevealed(data);
        onRevealed?.(data);
      }}
    />
  );
}

/* ── Scratch surface ────────────────────────────── */

// ~55% scratched auto-clears the rest — the sweet spot found in payment-app
// scratch cards: enough effort to feel earned, not enough to become a chore.
const REVEAL_COVERAGE = 0.55;
const BRUSH_RADIUS = 26;
const SAMPLE_STEP = 12;
// Coverage sampling reads the whole canvas — throttle it to every Nth stroke.
const COVERAGE_CHECK_EVERY = 4;

function ScratchPanel({ instance, onRevealed }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scratchingRef = useRef(false);
  const lastPointRef = useRef(null);
  const moveCountRef = useRef(0);
  const revealRequestedRef = useRef(false);

  // "idle" → "revealing" (foil cleared, action in flight) → parent swaps to
  // the outcome | "conflict" | "expired" | "error"
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [scratched, setScratched] = useState(false);

  useEffect(() => {
    paintFoil(canvasRef.current, containerRef.current);
  }, []);

  const requestReveal = useCallback(async () => {
    if (revealRequestedRef.current) return;
    revealRequestedRef.current = true;
    setPhase("revealing");

    const result = await revealRewardAction(instance.id);
    if (result.ok) {
      const won = result.data.outcome?.type === "voucher";
      if (won) {
        celebrateWin(containerRef.current);
      }
      onRevealed(result.data);
      return;
    }

    // Revealed in another tab/session — re-resolve server-side into the
    // revealed state (same pattern as the review form's conflict handling).
    if (result.error.code === "conflict") {
      setError(result.error);
      setPhase("conflict");
      setTimeout(() => router.refresh(), 1200);
      return;
    }
    if (result.error.code === "gone") {
      setError(result.error);
      setPhase("expired");
      return;
    }
    // Transient failure (including session expiry) — allow retry; the
    // instance is still pending server-side.
    revealRequestedRef.current = false;
    setError(result.error);
    setPhase("error");
  }, [instance.id, onRevealed, router]);

  const erasedCoverage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sampled = 0;
    let erased = 0;
    const step = SAMPLE_STEP * 4;
    for (let i = 3; i < data.length; i += step) {
      sampled++;
      if (data[i] === 0) erased++;
    }
    return sampled === 0 ? 0 : erased / sampled;
  }, []);

  /** Erases a round-capped stroke from the last pointer position (or a dot). */
  const scratchTo = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    const last = lastPointRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.lineWidth = BRUSH_RADIUS * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    lastPointRef.current = { x, y };
  }, []);

  const maybeAutoReveal = useCallback(() => {
    if (revealRequestedRef.current) return;
    if (erasedCoverage() >= REVEAL_COVERAGE) {
      vibrate([12, 40, 24]);
      requestReveal();
    }
  }, [erasedCoverage, requestReveal]);

  const handlePointerDown = useCallback((event) => {
    if (revealRequestedRef.current) return;
    scratchingRef.current = true;
    lastPointRef.current = null;
    setScratched(true);
    vibrate(8);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scratchTo(event.clientX, event.clientY);
  }, [scratchTo]);

  const handlePointerMove = useCallback((event) => {
    if (!scratchingRef.current || revealRequestedRef.current) return;
    // Coalesced events give the full pointer path on high-frequency digitizers.
    const points = event.nativeEvent.getCoalescedEvents?.() || [event];
    for (const point of points) {
      scratchTo(point.clientX, point.clientY);
    }
    moveCountRef.current += 1;
    if (moveCountRef.current % COVERAGE_CHECK_EVERY === 0) {
      maybeAutoReveal();
    }
  }, [scratchTo, maybeAutoReveal]);

  const handlePointerUp = useCallback(() => {
    scratchingRef.current = false;
    lastPointRef.current = null;
    // Lifting the pointer also checks — covers a stroke ending at coverage.
    maybeAutoReveal();
  }, [maybeAutoReveal]);

  if (phase === "expired") {
    return <ExpiredPanel message={error?.message} />;
  }

  const remaining = daysUntil(instance.expiresAt);
  const busy = phase === "revealing" || phase === "conflict";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted" aria-live="polite">
          {busy ? "Revealing…" : scratched ? "Keep scratching!" : "Scratch to reveal your prize"}
        </p>
        <p className="shrink-0 text-xs font-semibold text-amber-400">
          {remaining === 0 ? "Expires today" : `${remaining} day${remaining === 1 ? "" : "s"} left`}
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-accent/25 bg-surface-panel shadow-[0_8px_40px_rgba(202,255,0,0.08)]"
      >
        {/* Teaser layer under the foil — the actual outcome is unknown to the
            client until the reveal action returns. */}
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(202,255,0,0.10),transparent_65%)]" aria-hidden="true">
          <div className="flex flex-col items-center gap-2 text-muted">
            <Sparkles className={`h-8 w-8 text-accent ${busy ? "animate-pulse" : ""}`} />
            <span className="text-sm font-bold">{busy ? "Revealing your prize…" : "Your prize awaits"}</span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
          role="img"
          aria-label="Scratch surface — drag across the card to reveal your prize"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Sheen sweep inviting touch — pure decoration, gone once scratching
            starts, hidden entirely under reduced motion. */}
        {!scratched && !busy && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
            <div className="absolute inset-y-[-40%] w-1/4 -skew-x-12 animate-reward-sheen bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
        )}
      </div>

      {phase === "error" && error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
        >
          <span aria-hidden="true">⚠</span>
          <p>{error.message}</p>
        </div>
      )}
      {phase === "conflict" && error && (
        <p className="text-sm text-muted" role="status">
          {error.message} Loading your prize…
        </p>
      )}

      {/* Keyboard / assistive-tech / reduced-motion path: the scratch gesture
          is cosmetic, so an explicit button performs the same reveal. */}
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-center text-xs"
        disabled={busy}
        onClick={requestReveal}
      >
        {busy ? "Revealing…" : "Reveal without scratching"}
      </Button>
    </div>
  );
}

/**
 * Paints the scratch foil: court-green gradient base, diagonal stripe
 * pattern, sparkles, and centered "SCRATCH & WIN" branding — the layered
 * look payment-app scratch cards use instead of a flat fill.
 */
function paintFoil(canvas, container) {
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = container.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // 1. Metallic base.
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#31371f");
  base.addColorStop(0.45, "#414a28");
  base.addColorStop(0.55, "#4a5430");
  base.addColorStop(1, "#272c17");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // 2. Diagonal stripes.
  ctx.save();
  ctx.strokeStyle = "rgba(202, 255, 0, 0.05)";
  ctx.lineWidth = 10;
  for (let x = -height; x < width + height; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Scattered sparkles (deterministic positions — no Math.random so the
  //    foil looks identical across re-mounts).
  ctx.save();
  ctx.fillStyle = "rgba(247, 247, 239, 0.16)";
  const sparkles = [
    [0.12, 0.22], [0.3, 0.72], [0.44, 0.16], [0.58, 0.82], [0.72, 0.28],
    [0.86, 0.66], [0.2, 0.5], [0.66, 0.55], [0.9, 0.14], [0.08, 0.86],
  ];
  for (const [fx, fy] of sparkles) {
    drawSparkle(ctx, fx * width, fy * height, 5);
  }
  ctx.restore();

  // 4. Center branding plate.
  const cx = width / 2;
  const cy = height / 2;
  ctx.save();
  ctx.fillStyle = "rgba(13, 15, 4, 0.35)";
  roundRect(ctx, cx - 92, cy - 34, 184, 68, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(202, 255, 0, 0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, cx - 92, cy - 34, 184, 68, 14);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = "rgba(247, 247, 239, 0.9)";
  ctx.fillText("🎁", cx, cy - 2);
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(202, 255, 0, 0.85)";
  ctx.letterSpacing = "3px";
  ctx.fillText("SCRATCH & WIN", cx, cy + 22);
  ctx.restore();

  // 5. Top sheen.
  const sheen = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height * 0.5);
}

function drawSparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Light haptic tap where the platform supports it. */
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics unavailable — purely progressive enhancement.
  }
}

/**
 * Confetti burst anchored to the card (canvas-confetti). Dynamically imported
 * so the celebration never weighs down the initial bundle;
 * disableForReducedMotion respects the user's motion preference.
 */
function celebrateWin(container) {
  import("canvas-confetti")
    .then(({ default: confetti }) => {
      let origin = { x: 0.5, y: 0.5 };
      if (container) {
        const rect = container.getBoundingClientRect();
        origin = {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        };
      }
      const defaults = {
        origin,
        disableForReducedMotion: true,
        colors: ["#caff00", "#a9d800", "#f7f7ef", "#ffd166"],
        zIndex: 60,
      };
      confetti({ ...defaults, particleCount: 70, spread: 75, startVelocity: 32 });
      setTimeout(() => {
        confetti({ ...defaults, particleCount: 40, spread: 110, startVelocity: 24, scalar: 0.8 });
      }, 180);
    })
    .catch(() => {
      // Celebration is optional — the prize view already communicates the win.
    });
}

/* ── Outcome (identical revisit/just-revealed) ──── */

function OutcomePanel({ instance, animated = false }) {
  const outcome = instance.outcome;
  if (!outcome) return null;
  const isWin = outcome.type === "voucher";

  return (
    <div className={`flex flex-col items-center gap-3 text-center ${animated ? "animate-reward-pop motion-reduce:animate-none" : ""}`}>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          isWin ? "bg-accent/10 text-accent" : "bg-surface-high text-muted"
        }`}
      >
        {isWin
          ? <PartyPopper className="h-6 w-6" aria-hidden="true" />
          : <Gift className="h-6 w-6" aria-hidden="true" />}
      </div>

      {isWin ? (
        <>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">You won!</p>
            <p className="mt-1 text-lg font-black leading-tight text-foreground sm:text-xl">{outcome.label}</p>
          </div>
          {outcome.terms && (
            <p className="text-xs leading-relaxed text-muted">{outcome.terms}</p>
          )}
          {instance.voucher && <VoucherChip voucher={instance.voucher} />}
        </>
      ) : (
        <>
          <p className="text-lg font-black leading-tight text-foreground sm:text-xl">{outcome.label}</p>
          <p className="text-xs text-muted">
            Every confirmed booking earns a fresh scratch card — better luck on the next one!
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The voucher chip: code, validity, redemption state, and tap-to-copy
 * ("Copied!" feedback per UX spec §3.4).
 */
function VoucherChip({ voucher }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(voucher.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is still visible to copy manually.
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={copyCode}
        aria-label={`Copy voucher code ${voucher.code}`}
        className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 font-mono text-base font-black tracking-[0.14em] text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {voucher.code}
        {copied
          ? <Check className="h-4 w-4" aria-hidden="true" />
          : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
      <p className="min-h-4 text-xs font-semibold text-muted" aria-live="polite">
        {copied ? "Copied!" : "Tap to copy — show this code at the venue counter"}
      </p>
      {voucher.redeemed ? (
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          Redeemed{voucher.redeemedAt ? ` on ${formatRewardDateShort(voucher.redeemedAt)}` : ""}
        </p>
      ) : voucher.validUntil ? (
        <p className="text-xs font-semibold text-muted">
          Valid until {formatRewardDateShort(voucher.validUntil)}
        </p>
      ) : null}
    </div>
  );
}

/* ── Expired ────────────────────────────────────── */

function ExpiredPanel({ message }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-high text-muted">
        <Gift className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-muted">{message || "This reward has expired."}</p>
      <p className="text-xs text-muted">
        Rewards stay scratchable for a limited time — every confirmed booking earns a fresh one.
      </p>
    </div>
  );
}
