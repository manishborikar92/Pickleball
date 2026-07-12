"use client";

import { useState } from "react";
import { Button, Input, FormField } from "@/components/shared";
import { phoneSchema } from "@/lib/schemas";
import { Smartphone } from "lucide-react";

/**
 * PhoneForm - Step 1: Input and validate phone number.
 * Validation uses the shared `phoneSchema` (reused server-side by the OTP action).
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

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Enter a valid phone number.");
      return;
    }

    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Smartphone className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>

      <FormField error={error}>
        <Input
          prefix="IN +91"
          value={phone}
          onChange={handleChange}
          placeholder="98765 43210"
          inputMode="tel"
          maxLength={10}
          autoFocus
          disabled={loading}
          error={!!error}
        />
      </FormField>

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
