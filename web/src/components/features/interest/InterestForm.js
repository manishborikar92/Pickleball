"use client";

import { useState } from "react";
import { CheckCircle2, User, ArrowRight } from "lucide-react";
import { Button, FormField, Input, FormAlert } from "@/components/shared";
import { validateName, validatePhone } from "@/lib/validation";

export function InterestForm() {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nameVal = validateName(form.name);
    if (!nameVal.ok) {
      setErrorMessage(nameVal.message);
      setStatus("error");
      return;
    }

    const phoneVal = validatePhone(form.phone);
    if (!phoneVal.ok) {
      setErrorMessage(phoneVal.message);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const payload = {
        name: nameVal.value,
        phone: phoneVal.value,
      };

      const res = await fetch("/api/interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setStatus("success");
        setForm({ name: "", phone: "" });
      } else {
        throw new Error(data.error || "Submission failed. Please try again.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center sm:py-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground sm:text-3xl">
            You&apos;re on the list!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            We&apos;ll notify you as soon as Baseline Arena opens for bookings.
            Get ready to play!
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm font-bold text-accent hover:underline"
        >
          Register another player
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
      <FormField label="Full Name">
        <Input
          icon={User}
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. Rahul Sharma"
          autoComplete="name"
          required
          error={status === "error" && !validateName(form.name).ok}
        />
      </FormField>

      <FormField label="Phone Number">
        <Input
          prefix="🇮🇳 +91"
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="98765 43210"
          inputMode="tel"
          autoComplete="tel"
          maxLength={10}
          required
          error={status === "error" && !validatePhone(form.phone).ok}
        />
      </FormField>

      <FormAlert type="error" message={status === "error" ? errorMessage : ""} />

      <Button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold transition-transform active:scale-95 disabled:opacity-60 sm:py-3.5 sm:text-base"
      >
        {status === "loading" ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            Submitting…
          </>
        ) : (
          <>
            <span className="sm:hidden">Notify Me</span>
            <span className="hidden sm:inline">Notify Me When Live</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted/65">
        No spam — we only reach out when courts are ready.
      </p>
    </form>
  );
}
