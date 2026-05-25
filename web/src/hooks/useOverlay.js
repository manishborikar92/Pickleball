"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * A custom React hook that standardizes dialog overlay behaviors, scroll locking, 
 * Escape key dismissing, click-outside handling, and keyboard focus trapping.
 * 
 * @param {Object} params - Hook configurations.
 * @param {boolean} [params.isOpen=true] - State flag controlling active dialog render.
 * @param {Function} params.onClose - Dismiss callback triggered on backdrop clicks or Escape key.
 * @returns {Object} Returns refs and event handler callbacks.
 * @property {React.RefObject<HTMLDivElement>} containerRef - Ref targeting the outer backdrop overlay frame.
 * @property {React.RefObject<HTMLDivElement>} contentRef - Ref targeting the inner modal container.
 * @property {Function} handleBackdropClick - Event callback to trigger onClose when clicking backdrop directly.
 */
export function useOverlay({ isOpen = true, onClose }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;

    // 1. Capture currently focused element to restore it on cleanup
    previousFocusRef.current = document.activeElement;

    // 2. Prevent body scrolling to freeze viewport interaction behind modal
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Queries list of focusable nodes inside modal to manage Tab index loop
    const getFocusableElements = () => {
      if (!contentRef.current) return [];
      return Array.from(
        contentRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex^="-"]), [contenteditable]'
        )
      );
    };

    // 3. Push focus to first element when component mounts
    const initFocus = setTimeout(() => {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (contentRef.current) {
        contentRef.current.focus();
      }
    }, 50);

    // 4. Capture keyboard loops
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
          if (document.activeElement === firstEl) {
            lastEl.focus();
            event.preventDefault();
          }
        } else {
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

      // Safely restore focus to previous trigger element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        const prevEl = previousFocusRef.current;
        setTimeout(() => prevEl.focus(), 0);
      }
    };
  }, [isOpen, onClose]);

  // Memoized backdrop click handler to prevent callback recreation
  const handleBackdropClick = useCallback((event) => {
    if (containerRef.current && event.target === containerRef.current) {
      onClose?.();
    }
  }, [onClose]);

  return {
    containerRef,
    contentRef,
    handleBackdropClick,
  };
}

