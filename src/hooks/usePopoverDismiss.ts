"use client";

import { useEffect, type RefObject } from "react";
import { useEscapeKey } from "./useEscapeKey";

/**
 * The two ways a popover has to be dismissable, as one call: Escape, and a click outside it.
 *
 * Written as a hook rather than left to each caller because leaving it to callers is what
 * happened — of the app's seven custom dropdowns, four handled both, and three handled neither.
 * Those three could only be closed by clicking their own trigger again, and one of them covers
 * the camera wall it sits over while open. A popover that traps the pointer is a popover nobody
 * wrote a bug for, because it looks deliberate.
 *
 * `ref` goes on the popover's own positioning container — the element that holds BOTH the trigger
 * and the panel. Putting it on the panel alone makes clicking the trigger count as "outside",
 * which closes and immediately reopens.
 *
 * mousedown, not click: a click that starts inside the panel and ends outside it (a drag on a
 * slider, a text selection) is not a dismissal, and `click` fires on the element the pointer went
 * UP over.
 */
export function usePopoverDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEscapeKey(onClose, open);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ref, open, onClose]);
}
