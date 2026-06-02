"use client";

import { useState } from "react";
import { Button } from "@/components/shared";
import { Input, FormAlert } from "@/components/shared";
import { validateOtp } from "@/lib/validation";

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
        <p className="mt-2 text-sm text-muted font-medium">
          Sent to {phone}.
        </p>
      </div>

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

      <button
        type="button"
        onClick={handleResendCode}
        disabled={loading}
        className="mx-auto block p-2 text-sm font-bold text-accent hover:underline active:opacity-70 disabled:opacity-50"
      >
        Resend Code
      </button>

      <FormAlert type="error" message={error} />

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
