"use client";

import { useEffect, useRef } from "react";

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
  value, onChange, error, onSubmit, focusSignal, autoFocus,
}: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const length = value.length;

  useEffect(() => {
    if (focusSignal === undefined) return;
    boxes.current[0]?.focus();
  }, [focusSignal]);

  /** Handles a pasted or autofilled run of digits by spilling it across the boxes from here
   *  rightwards, which is how people actually move a code between two windows. */
  const setDigitAt = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    const next = [...value];
    for (let i = 0; i < typed.length && index + i < length; i++) {
      next[index + i] = typed[i];
    }
    onChange(next);
    boxes.current[Math.min(index + typed.length, length - 1)]?.focus();
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
    <div style={{ display: "flex", gap: "8px" }}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={el => { boxes.current[i] = el; }}
          value={digit}
          onChange={e => setDigitAt(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.currentTarget.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1} of ${length}`}
          autoFocus={autoFocus && i === 0}
          style={{
            width: "44px", height: "52px", textAlign: "center",
            border: error
              ? "1px solid var(--danger-400)"
              : digit ? "1px solid var(--primary-300)" : "1px solid var(--gray-300)",
            borderRadius: "8px", outline: "none",
            fontSize: "18px", fontWeight: 700,
            color: "var(--gray-800)",
            transition: "border-color 0.12s",
          }}
        />
      ))}
    </div>
  );
}
