import Link from "next/link";
import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";
import { CheckCircle2, X } from "lucide-react";
import { CustomerCheckoutAuthGate } from "@/components/features/auth";
import { useOverlay } from "@/hooks/useOverlay";

export function AuthFlow({
  auth,
  setAuth,
  hold,
  fullTime,
  quote,
  waiver,
  setWaiver,
  onAuthSuccess,
  confirmPayment,
  onClose,
}) {
  const { containerRef, contentRef, handleBackdropClick } = useOverlay({
    isOpen: auth.step !== "closed",
    onClose,
  });

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-md animate-overlay-fade-in md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Booking checkout"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-line bg-surface-high shadow-2xl animate-modal-slide-up focus:outline-none md:max-h-[85vh] md:max-w-md md:rounded-3xl md:border md:animate-modal-scale-in"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-foreground focus-visible:bg-surface-panel focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close checkout"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Drag handle (mobile only, visual / clickable secondary option) */}
        <div className="flex shrink-0 items-center justify-center pb-2 pt-4 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-1.5 w-12 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors"
            aria-label="Close checkout"
          />
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto p-5 pb-safe pt-12 sm:p-6 sm:pt-14">
          {["phone", "otp", "name"].includes(auth.step) && (
            <CustomerCheckoutAuthGate
              inline={true}
              onSuccess={onAuthSuccess}
              showStaffLoginLink={false}
              initialPhone={auth.phone}
              initialStep={auth.step}
            />
          )}
          {auth.step === "waiver" && (
            <WaiverStep
              hold={hold}
              fullTime={fullTime}
              quote={quote}
              waiver={waiver}
              setWaiver={setWaiver}
              onConfirm={confirmPayment}
            />
          )}
          {auth.step === "success" && <SuccessStep quote={quote} />}
        </div>
      </div>
    </div>
  );
}

/* ── Individual Steps ─────────────────────────────── */

function WaiverStep({ hold, fullTime, quote, waiver, setWaiver, onConfirm }) {
  const allChecked = waiver.time && waiver.policy;
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-black sm:text-3xl">Confirm &amp; Pay</h2>
      <Card className="border-line/50 bg-surface/50 p-5 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-bold text-foreground">Booking hold active</p>
          <p className="text-xs font-semibold text-accent">
            Expires {new Date(hold.expiresAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <p className="mt-4 font-medium text-muted sm:text-base">{fullTime}</p>
        <div className="mt-4 border-t border-line/50 pt-4">
          <p className="text-sm text-muted">Total Amount</p>
          <p className="text-2xl font-black text-foreground">
            {formatCurrency(quote.totalAmount)}
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        <WaiverCheckbox
          checked={waiver.time}
          onChange={(v) => setWaiver((w) => ({ ...w, time: v }))}
          label={
            <span>
              I confirm this booking is for {fullTime} and understand it is{" "}
              <Link
                href="/refund"
                target="_blank"
                className="text-accent underline font-semibold focus-visible:outline-none hover:text-accent-dim"
              >
                non-refundable
              </Link>
              .
            </span>
          }
        />
        <WaiverCheckbox
          checked={waiver.policy}
          onChange={(v) => setWaiver((w) => ({ ...w, policy: v }))}
          label={
            <span>
              I accept the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-accent underline font-semibold focus-visible:outline-none hover:text-accent-dim"
              >
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/terms#waiver"
                target="_blank"
                className="text-accent underline font-semibold focus-visible:outline-none hover:text-accent-dim"
              >
                Liability Waiver / Rules
              </Link>
              .
            </span>
          }
        />
      </div>

      <Button
        type="button"
        disabled={!allChecked}
        onClick={onConfirm}
        className="w-full py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
      >
        Pay {formatCurrency(quote.totalAmount)}
      </Button>
    </div>
  );
}

function SuccessStep() {
  return (
    <div className="space-y-5 py-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent text-black">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <h2 className="text-3xl font-black sm:text-4xl">You are booked!</h2>
      <p className="text-sm leading-relaxed text-muted sm:text-base">
        A WhatsApp confirmation and receipt will be sent after the payment
        webhook confirms the transaction.
      </p>
      <Button href="/booking/confirmed" className="mt-2 w-full py-4 text-base">
        View Confirmation
      </Button>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────── */

function WaiverCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-line accent-accent focus:ring-accent focus:ring-offset-background"
      />
      <span className="text-sm leading-snug text-muted">{label}</span>
    </label>
  );
}