/**
 * lib/rewardDates.js — Pure date helpers for the rewards surface. Kept free of
 * component imports so `node:test` can exercise them directly (same reasoning
 * as the services/ modules).
 */

/** "Sunday, 13 Jul 2026" — same locale/format family as the booking receipt. */
export function formatRewardDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short form: "13 Jul 2026" — for compact card rows and voucher validity. */
export function formatRewardDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole days until a timestamp, clamped at 0 — drives "Expires in N days". */
export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 0;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
