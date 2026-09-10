"use client";

import { Fragment, useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n";

interface Props {
  /** One string per box. Length of this array is the length of the code. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Paints every box in the error colour. The message itself belongs to the caller. */
  error?: boolean;
  /** Enter pressed on any box — the caller normally submits. */
  onSubmit?: () => void;
  /** Change this number to send focus back to the first box, e.g. after a resend. */
  focusSignal?: number;
  autoFocus?: boolean;
  /** "digits" for a mailed one-time code, "alnum" for a registration code handed over on paper.
   *  Alphanumeric codes are upper-cased on entry so the boxes never disagree with the printout. */
  charset?: "digits" | "alnum";
  /** Draws a dash after this many boxes, the way a printed code is grouped (KNVB-CLVC). Purely
   *  visual — the value stays one flat array. */
  groupAfter?: number;
}

/**
 * The boxed code entry used by both the password reset and the sign-up flows. Separate boxes rather
 * than one field because the code arrives as N glyphs to copy across, and boxed digits are far
 * easier to check against the mail.
 *
 * Shared so the two screens cannot drift: the paste-spilling and backspace-walking below are the
 * whole reason this widget is more than an input, and a second copy of them would eventually
 * disagree with this one.
 */
export default function VerificationCodeInput({
  value, onChange, error, onSubmit, focusSignal, autoFocus, charset = "digits", groupAfter,
}: Props) {
  // Only a screen reader ever hears this component's own words, so the label is inline rather
  // than in a file dictionary.
  const [lang] = useLanguage();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const length = value.length;

  useEffect(() => {
    if (focusSignal === undefined) return;
    boxes.current[0]?.focus();
  }, [focusSignal]);

  /** Handles a pasted or autofilled run of digits by spilling it across the boxes from here
   *  rightwards, which is how people actually move a code between two windows.
   *
   *  Returns whether anything was accepted, so the caller can put a rejected character back —
   *  see the onChange handler below. */
  const setDigitAt = (index: number, raw: string): boolean => {
    const typed = charset === "alnum"
      // Drops the characters a printed code should never contain anyway, so a misread O or I does
      // not silently enter a character that can never match.
      ? raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "")
      : raw.replace(/\D/g, "");
    if (!typed) return false;
    const next = [...value];
    for (let i = 0; i < typed.length && index + i < length; i++) {
      next[index + i] = typed[i];
    }
    onChange(next);
    boxes.current[Math.min(index + typed.length, length - 1)]?.focus();
    return true;
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...value];
      if (next[index]) {
        // Clear this box and stay put.
        next[index] = "";
      } else if (index > 0) {
        // Already empty — step back and clear that one, so held backspace walks the code out.
        next[index - 1] = "";
        boxes.current[index - 1]?.focus();
      }
      onChange(next);
      return;
    }
    // Delete was not handled at all, and onFocus selects the box's contents — so clicking a
    // filled box and pressing Delete emptied it on screen while the value behind it kept the
    // digit. The code then read as complete with a blank box in it.
    if (e.key === "Delete") {
      e.preventDefault();
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      boxes.current[index + 1]?.focus();
    }
    if (e.key === "Enter") onSubmit?.();
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      {value.map((digit, i) => (
        <Fragment key={i}>
        {groupAfter !== undefined && i === groupAfter && (
          <span aria-hidden style={{ color: "var(--gray-400)", fontWeight: 700, padding: "0 2px" }}>–</span>
        )}
        <input
          ref={el => { boxes.current[i] = el; }}
          value={digit}
          onChange={e => {
            // A controlled input whose state does not change is not re-rendered, so a rejected
            // character stayed visible in the box while `value` said that box was empty: typing
            // "ㄱ" through a Korean IME, or a letter into a digits-only code, filled the row on
            // screen while Continue stayed disabled with no way to see why. Put the box back.
            if (!setDigitAt(i, e.target.value)) e.currentTarget.value = digit;
          }}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.currentTarget.select()}
          inputMode={charset === "digits" ? "numeric" : "text"}
          autoComplete="one-time-code"
          spellCheck={false}
          aria-label={lang === "ko" ? `${length}자리 중 ${i + 1}번째` : `Digit ${i + 1} of ${length}`}
          autoFocus={autoFocus && i === 0}
          style={{
            width: charset === "alnum" ? "40px" : "44px", height: "52px", textAlign: "center",
            border: error
              ? "1px solid var(--danger-400)"
              : digit ? "1px solid var(--primary-300)" : "1px solid var(--gray-300)",
            // No `outline: none` here on purpose. These boxes had no focus style of their own —
            // the border only marks whether a digit is filled — so suppressing the outline left a
            // keyboard user with no way to see which of the eight they were typing into. The app's
            // shared focus ring (globals.css) draws it now.
            borderRadius: "8px",
            fontSize: "18px", fontWeight: 700,
            color: "var(--gray-800)",
            transition: "border-color 0.12s",
          }}
        />
        </Fragment>
      ))}
    </div>
  );
}
