import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Shared utility to dynamically merge Tailwind classes, resolving conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
