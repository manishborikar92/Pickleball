"use client";

import { useState } from "react";
import { Button } from "@/components/shared";
import { validateName } from "@/lib/validation";
import { User, AlertCircle } from "lucide-react";

/**
 * NameForm - Step 3: Collect full name for onboarding.
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationResult = validateName(name);
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
          <User className="h-7 w-7" />
        </div>
        <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
        <p className="mt-2 text-sm text-muted sm:text-base">{subtitle}</p>
      </div>

      <label className="block text-xs font-bold uppercase tracking-widest text-muted">
        Full Name
        <input
          value={name}
          onChange={handleChange}
          placeholder="Enter your full name"
          autoFocus
          disabled={loading}
          className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3.5 text-[16px] normal-case tracking-normal text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>

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
        disabled={loading || name.trim().length < 2}
      >
        {loading ? "Completing..." : "Complete Onboarding →"}
      </Button>
    </form>
  );
}
