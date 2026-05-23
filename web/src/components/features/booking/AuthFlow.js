import Link from "next/link";
import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";
import { CheckCircle2, AlertCircle, Smartphone, User } from "lucide-react";

export function AuthFlow({
  auth,
  setAuth,
  hold,
  fullTime,
  quote,
  waiver,
  setWaiver,
  submitName,
  submitPhone,
  submitOtp,
  confirmPayment,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-background/85 backdrop-blur-md md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Booking checkout"
    >
      <div className="flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-line bg-surface-high shadow-2xl md:max-h-[85vh] md:max-w-md md:rounded-3xl md:border">
        {/* Drag handle (mobile only) */}
        <div className="flex shrink-0 items-center justify-center pb-2 pt-4 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-1.5 w-12 rounded-full bg-muted/30"
            aria-label="Close checkout"
          />
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto p-5 pb-safe sm:p-6">
          {auth.step === "name" && (
            <NameStep auth={auth} setAuth={setAuth} onSubmit={submitName} />
          )}
          {auth.step === "phone" && (
            <PhoneStep auth={auth} setAuth={setAuth} onSubmit={submitPhone} />
          )}
          {auth.step === "otp" && (
            <OtpStep auth={auth} setAuth={setAuth} onSubmit={submitOtp} />
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

function NameStep({ auth, setAuth, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <User className="h-7 w-7" />
        </div>
        <h2 className="text-3xl font-black sm:text-4xl">Almost there!</h2>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Tell us your name to finish your booking.
        </p>
      </div>
      <label className="block text-xs font-bold uppercase tracking-widest text-muted">
        Full Name
        <input
          value={auth.name}
          onChange={(e) =>
            setAuth((prev) => ({ ...prev, name: e.target.value, error: "" }))
          }
          placeholder="Enter your full name"
          autoFocus
          className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3.5 text-[16px] normal-case tracking-normal text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <FlowError message={auth.error} />
      <Button className="w-full py-4 text-base" type="submit">
        Next →
      </Button>
    </form>
  );
}

function PhoneStep({ auth, setAuth, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Smartphone className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black sm:text-3xl">Verify to Book</h2>
        <p className="mt-2 text-sm text-muted">
          Enter your phone to receive a 6-digit code.
        </p>
      </div>
      <div className="flex overflow-hidden rounded-xl border border-line bg-background shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <span className="flex shrink-0 items-center gap-1.5 border-r border-line bg-surface px-4 text-sm font-bold text-muted">
          IN +91
        </span>
        <input
          value={auth.phone}
          onChange={(e) =>
            setAuth((prev) => ({ ...prev, phone: e.target.value, error: "" }))
          }
          placeholder="98765 43210"
          inputMode="tel"
          autoFocus
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[16px] focus:outline-none"
        />
      </div>
      <FlowError message={auth.error} />
      <Button className="w-full py-4 text-base" type="submit">
        Send OTP →
      </Button>
    </form>
  );
}

function OtpStep({ auth, setAuth, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-black sm:text-3xl">Enter Code</h2>
        <p className="mt-2 text-sm text-muted">
          Sent to {auth.phone}.{" "}
          <span className="font-bold">Demo OTP: 482913</span>
        </p>
      </div>
      <input
        value={auth.otp}
        onChange={(e) =>
          setAuth((prev) => ({ ...prev, otp: e.target.value, error: "" }))
        }
        placeholder="482913"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        className="w-full rounded-xl border border-line bg-background px-4 py-4 text-center text-3xl font-black tracking-[0.35em] shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="button"
        onClick={() =>
          setAuth((prev) => ({
            ...prev,
            error: "Code resent. Use 482913.",
          }))
        }
        className="mx-auto block p-2 text-sm font-bold text-accent hover:underline active:opacity-70"
      >
        Resend Code
      </button>
      <FlowError message={auth.error} />
      <Button className="w-full py-4 text-base" type="submit">
        Verify OTP
      </Button>
    </form>
  );
}

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

function FlowError({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}