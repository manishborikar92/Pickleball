"use client";

import { useState } from "react";
import { Button, Input, FormField } from "@/components/shared";
import { otpSchema } from "@/lib/schemas";

/**
 * OtpForm - Step 2: Verification of the 6-digit OTP code.
 * Validation uses the shared `otpSchema` (reused server-side by the verify action).
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

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Enter the 6-digit verification code.");
      return;
    }

    onSubmit(parsed.data);
  }

  function handleResendCode() {
    setOtp("");
    setError("Verification code has been resent.");
    if (onResend) {
      onResend();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="text-center">
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted font-medium">
          Sent to {phone}.
        </p>
      </div>

      <FormField error={error}>
        <Input
          value={otp}
          onChange={handleChange}
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          disabled={loading}
          error={!!error}
          className="py-4 text-center text-3xl md:text-3xl font-black tracking-[0.35em] rounded-xl"
        />
      </FormField>

      <button
        type="button"
        onClick={handleResendCode}
        disabled={loading}
        className="mx-auto block p-2 text-sm font-bold text-accent hover:underline active:opacity-70 disabled:opacity-50"
      >
        Resend Code
      </button>

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
