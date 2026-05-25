"use client";

import { useEffect, useRef } from "react";

/**
 * Reusable hook for overlay and modal closing, scroll locking, and focus accessibility.
 * 
 * @param {Object} params
 * @param {boolean} [params.isOpen=true] - Whether the overlay is currently visible.
 * @param {Function} params.onClose - Callback triggered when requesting to close the overlay.
 * @returns {Object} { containerRef, contentRef, handleBackdropClick }
 */
export function useOverlay({ isOpen = true, onClose }) {
  const containerRef = useRef(null); // Ref to the outer overlay backdrop wrapper
  const contentRef = useRef(null);   // Ref to the inner modal card/dialog container
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;

    // 1. Store the active element to restore focus when overlay unmounts
    previousFocusRef.current = document.activeElement;

    // 2. Lock document body scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Dynamic fetch of focusable descendants inside the content ref container
    const getFocusableElements = () => {
      if (!contentRef.current) return [];
      return Array.from(
        contentRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex^="-"]), [contenteditable]'
        )
      );
    };

    // 3. Focus the first focusable element inside the modal card
    const initFocus = setTimeout(() => {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (contentRef.current) {
        contentRef.current.focus();
      }
    }, 50);

    // 4. Bind keyboard event listeners
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === "Tab") {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (event.shiftKey) {
          // Cycle to last if on first element
          if (document.activeElement === firstEl) {
            lastEl.focus();
            event.preventDefault();
          }
        } else {
          // Cycle to first if on last element
          if (document.activeElement === lastEl) {
            firstEl.focus();
            event.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(initFocus);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus to original trigger element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        const prevEl = previousFocusRef.current;
        setTimeout(() => prevEl.focus(), 0);
      }
    };
  }, [isOpen, onClose]);

  // Click outside backdrop handler
  const handleBackdropClick = (event) => {
    // Dismiss only if the click target is the backdrop wrapper itself
    if (containerRef.current && event.target === containerRef.current) {
      onClose?.();
    }
  };

  return {
    containerRef,
    contentRef,
    handleBackdropClick,
  };
}
