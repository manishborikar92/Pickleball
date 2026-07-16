"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Never re-subscribes and never notifies — the store's value simply differs
// between server (false) and client (true) snapshots.
const emptySubscribe = () => () => {};

/**
 * Reusable, SSR-safe, and hydration-safe React Portal component for Next.js.
 * Mounts its children directly under document.body on the client side.
 *
 * `useSyncExternalStore` returns the server snapshot (false) during SSR and
 * the first client render (keeping hydration markup identical), then the
 * client snapshot (true) — without a setState-in-effect cascade.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Elements to project into document.body.
 */
export function Portal({ children }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
