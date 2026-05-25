"use client";

import { Badge } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";

/**
 * Renders status value inside standard Badge container with curated tones.
 */
export function StatusBadge({ value }) {
  if (!value) return null;
  const val = String(value).toLowerCase();

  let tone = "neutral";
  if (val === "confirmed" || val === "active" || val === "walk_in") {
    tone = "accent";
  } else if (val === "cancelled" || val === "maintenance" || val === "blocked") {
    tone = "danger";
  }

  return (
    <Badge tone={tone} className="uppercase tracking-wider text-[10px] w-fit font-bold">
      {value.replace("_", " ")}
    </Badge>
  );
}

/**
 * Formats a number to INR currency string.
 */
export function Currency({ value }) {
  const num = Number(value || 0);
  return <span className="font-semibold text-foreground">{formatCurrency(num)}</span>;
}

/**
 * Formats ISO date values.
 */
export function DateTime({ date, time }) {
  if (!date) return null;

  let formattedDate = date;
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  } catch {}

  return (
    <span className="text-xs sm:text-sm text-muted">
      {formattedDate} {time && <span className="text-muted/40 mx-1">&bull;</span>} {time}
    </span>
  );
}
