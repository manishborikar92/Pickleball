"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable accessible toggle switch control.
 *
 * @param {Object} props
 * @param {boolean} props.checked - Current toggle state.
 * @param {Function} props.onChange - Callback fired when toggle state changes `(nextChecked) => void`.
 * @param {boolean} [props.disabled=false] - Whether switch interaction is disabled.
 * @param {boolean} [props.loading=false] - Shows loading spinner inside the thumb.
 * @param {string} [props.label] - Accessible label (`aria-label`).
 * @param {string} [props.className] - Additional class names for the container.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  className = "",
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-accent" : "bg-surface-high",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5.5" : "translate-x-0.5"
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-accent" aria-hidden="true" />
        ) : null}
      </span>
    </button>
  );
}
