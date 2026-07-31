/**
 * Shared presentation formatters for UI components across the application.
 */

/**
 * Formats a 24-hour time string (e.g. "07:00", "13:30", "00:00", "24:00") into a 12-hour AM/PM
 * string (e.g. "7:00 AM", "1:30 PM", "12:00 AM"). Safe for null, undefined, or
 * invalid time strings. Idempotent for already-formatted 12-hour strings.
 *
 * @param {string} timeStr - "HH:MM" or "HH:MM:SS" format string
 * @returns {string} Formatted 12-hour time string (e.g. "7:00 AM") or original string if invalid
 */
export function formatTime12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return timeStr || "";
  const trimmed = timeStr.trim();
  if (/\b(AM|PM|am|pm)\b/i.test(trimmed)) return trimmed;

  const parts = trimmed.split(":");
  if (parts.length < 2) return timeStr;

  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return timeStr;
  }

  // Treat 24:00 as 00:00 (12:00 AM)
  if (hours === 24) hours = 0;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = String(minutes).padStart(2, "0");

  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Formats a date value/string into a readable local date string (e.g. "Monday, 15 Jul 2026").
 *
 * @param {string|Date} dateVal - ISO date string or Date object
 * @returns {string} Formatted date string
 */
export function formatDate(dateVal) {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

/**
 * Formats a date-time value into a 12-hour date-time string (e.g. "15 Jul, 7:00 AM").
 *
 * @param {string|Date} dateVal - ISO date-time string or Date object
 * @returns {string} Formatted 12-hour date-time string
 */
export function formatDateTime(dateVal) {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateVal);
  }
}
