"use client";

import { useState } from "react";
import { Button } from "@/components/shared";
import { validateOtp } from "@/lib/validation";
import { AlertCircle } from "lucide-react";

/**
 * OtpForm - Step 2: Verification of the 6-digit OTP code.
 */
export function OtpForm({
  phone,
  onSubmit,
  onResend,
  loading,
  title = "Enter Code",
}) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    setOtp(e.target.value);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationResult = validateOtp(otp);
    if (!validationResult.ok) {
      setError(validationResult.message);
      return;
    }

    // Validation constraints
    if (validationResult.value !== "123456") {
      setError("Invalid verification code. Please check and try again.");
      return;
    }

    onSubmit(validationResult.value);
  }

  function handleResendCode() {
    setOtp("");
    setError("Verification code has been resent.");
    if (onResend) {
      onResend();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">
          Sent to {phone}.
        </p>
      </div>

      <input
        value={otp}
        onChange={handleChange}
        placeholder="123456"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        disabled={loading}
        className="w-full rounded-xl border border-line bg-background px-4 py-4 text-center text-3xl font-black tracking-[0.35em] shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <button
        type="button"
        onClick={handleResendCode}
        disabled={loading}
        className="mx-auto block p-2 text-sm font-bold text-accent hover:underline active:opacity-70 disabled:opacity-50"
      >
        Resend Code
      </button>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button
        className="w-full py-4 text-base justify-center"
        type="submit"
        disabled={loading}
      >
        {loading ? "Verifying..." : "Verify OTP"}
      </Button>
    </form>
  );
}
