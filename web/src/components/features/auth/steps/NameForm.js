"use client";

import { useState } from "react";
import { Button, Input, FormField } from "@/components/shared";
import { nameSchema } from "@/lib/schemas";
import { User } from "lucide-react";

/**
 * NameForm - Step 3: Collect full name for onboarding.
 * Validation uses the shared `nameSchema` (reused server-side by the onboarding action).
 */
export function NameForm({
  initialName = "",
  onSubmit,
  loading,
  title = "Almost there!",
  subtitle = "Tell us your name to finish your onboarding profile.",
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");

  function handleChange(e) {
    setName(e.target.value);
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Enter your full name.");
      return;
    }

    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <User className="h-7 w-7" />
        </div>
        <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
        <p className="mt-2 text-sm text-muted sm:text-base">{subtitle}</p>
      </div>

      <FormField label="Full Name" error={error}>
        <Input
          value={name}
          onChange={handleChange}
          placeholder="Enter your full name"
          autoFocus
          disabled={loading}
          error={!!error}
          className="py-3.5 text-base"
        />
      </FormField>

      <Button
        className="w-full py-4 text-base justify-center"
        type="submit"
        disabled={loading || name.trim().length < 2}
      >
        {loading ? "Completing..." : "Complete Onboarding →"}
      </Button>
    </form>
  );
}
