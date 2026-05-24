"use client";

import { useState } from "react";
import { Button } from "@/components/shared";
import { validatePhone } from "@/lib/validation";
import { Smartphone, AlertCircle } from "lucide-react";

/**
 * PhoneForm - Step 1: Input and validate phone number.
 */
export function PhoneForm({
  initialPhone = "",
  onSubmit,
  loading,
  title = "Welcome Back",
  subtitle = "Enter your phone number to receive a 6-digit WhatsApp OTP.",
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");

  function handleChange(e) {
    setPhone(e.target.value);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationResult = validatePhone(phone);
    if (!validationResult.ok) {
      setError(validationResult.message);
      return;
    }

    onSubmit(validationResult.value);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Smartphone className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>

      <div className="flex overflow-hidden rounded-xl border border-line bg-background shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <span className="flex shrink-0 items-center gap-1.5 border-r border-line bg-surface px-4 text-sm font-bold text-muted">
          IN +91
        </span>
        <input
          value={phone}
          onChange={handleChange}
          placeholder="98765 43210"
          inputMode="tel"
          maxLength={10}
          autoFocus
          disabled={loading}
          className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[16px] focus:outline-none"
        />
      </div>

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
        {loading ? "Sending..." : "Send OTP →"}
      </Button>
    </form>
  );
}
