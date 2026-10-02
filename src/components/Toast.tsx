"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

export type ToastVariant = "default" | "success" | "info" | "warning" | "error";

interface ToastOptions {
  variant?: ToastVariant;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

/**
 * One surface for every toast, and colour only in the icon.
 *
 * Each variant used to tint the whole card — a success was a green box with green heading and green
 * body text, an error a red one — which is the look of a validation summary from a decade ago: the
 * message competes with its own background, coloured body text is harder to read than black, and
 * four differently-tinted boxes stacking up in a corner read as a paint chart.
 *
 * The card that replaced them was white, and it was too quiet — a white box on a near-white page
 * is a card the eye skips. So it is dark: gray-900, white heading, the state in a 16px mark. On a
 * light page that is the strongest surface available without tinting anything, and the product
 * already speaks in it — the rail and the bulk-selection bar are the same near-black, and both are
 * furniture that appears over the work rather than part of it.
 *
 * Dark also fixes what the tints were hiding: a green box says "good" before the reader has read
 * anything, and half of these messages are "requested", not "done".
 */
/*
 * The accents, chosen for a dark card.
 *
 * warning takes the 400 rather than the 500 (the 500 is an orange that goes muddy on near-black)
 * and info takes primary-300 rather than primary-400 (the saturated step is barely 2.4:1 against
 * this ground; the lavender step is legible and still the product's colour).
 */
const VARIANT_STYLES: Record<ToastVariant, { accent: string }> = {
  default: { accent: "var(--gray-400)" },
  success: { accent: "var(--success-400)" },
  info:    { accent: "var(--primary-300)" },
  warning: { accent: "var(--warning-400)" },
  error:   { accent: "var(--danger-400)" },
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "default") return null;
  const color = VARIANT_STYLES[variant].accent;
  const common = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (variant === "success") return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M7.5 10L9.16667 11.6667L12.5 8.33333" />
    </svg>
  );
  if (variant === "info") return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M10 13.3333V10M10 6.66667H10.0083" />
    </svg>
  );
  if (variant === "warning") return (
    <svg {...common}>
      <path d="M18.1083 15L11.4417 3.33333C11.2963 3.07684 11.0855 2.86349 10.8308 2.71506C10.576 2.56662 10.2865 2.48842 9.99167 2.48842C9.69684 2.48842 9.4073 2.56662 9.15256 2.71506C8.89783 2.86349 8.68703 3.07684 8.54167 3.33333L1.875 15C1.72807 15.2545 1.65102 15.5433 1.65167 15.8371C1.65232 16.1309 1.73065 16.4194 1.87871 16.6732C2.02676 16.927 2.23929 17.1372 2.49475 17.2824C2.7502 17.4276 3.03951 17.5026 3.33333 17.5H16.6667C16.9591 17.4997 17.2463 17.4225 17.4994 17.2761C17.7525 17.1297 17.9627 16.9192 18.1088 16.6659C18.2548 16.4126 18.3317 16.1253 18.3316 15.8329C18.3315 15.5405 18.2545 15.2532 18.1083 15Z" />
      <path d="M10 7.5V10.8333" />
      <path d="M10 14.1667H10.0083" />
    </svg>
  );
  return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M10 6.66667V10" />
      <path d="M10 13.3333H10.0083" />
    </svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4L12 12" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  // The toast's own text comes from whoever raised it, already in the right language. Only this
  // component's own close label is its to translate, so it stays inline.
  const [lang] = useLanguage();
  const variant = item.variant ?? "default";
  return (
    /*
      Small, the way every toast on Mobbin is small.
      Whop and Pinterest are the closest references to this one — a near-black bar with a coloured
      mark and white text — and both are a single line about 36px tall. Ours was 380×60 with a
      14px/800 heading, which is a card that happens to float: it announced itself at the size of
      the thing it was reporting on. Height is what the text needs (a one-line message is one
      line), the width is a range rather than a number so "Camera removed" does not draw a box
      three times its own length, and the type is a step down.
    */
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 12px 10px 14px", borderRadius: "10px", boxSizing: "border-box",
      backgroundColor: "var(--gray-900)", border: "1px solid rgba(255, 255, 255, 0.08)",
      // Below a dialog, above the page — same step as the selection bar, and for the same reason
      // (see FloatingBulkBar): the old raw 0.28 outweighed --shadow-modal's 0.18.
      boxShadow: "var(--shadow-popover)",
      minWidth: "240px", maxWidth: "420px", flexShrink: 0,
      // The stack around these is pointer-transparent so its empty margins stop swallowing clicks
      // meant for the page; the card itself still has an action and a ✕ to press.
      pointerEvents: "auto",
    }}>
      {variant !== "default" && (
        <div style={{ flexShrink: 0, display: "flex" }}>
          <ToastIcon variant={variant} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, lineHeight: "18px", letterSpacing: "-0.2px", color: "white" }}>{item.title}</div>
        {item.desc && (
          <div style={{ fontSize: "12px", fontWeight: 400, lineHeight: "16px", color: "var(--gray-300)" }}>{item.desc}</div>
        )}
      </div>
      {/* The close button used to be the alternative to an action, so a toast that offered one
          (the VIP alert offers "View on map") could only be waited out — and it sits in the
          corner where it can cover the thing you are trying to look at. Both now, action first. */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {item.actionLabel && (
          <button
            onClick={() => { item.onAction?.(); onDismiss(item.id); }}
            style={{
              padding: "5px 10px", fontSize: "12px", fontWeight: 700, letterSpacing: "-0.2px",
              color: "var(--gray-900)", backgroundColor: "white",
              border: "none", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {item.actionLabel}
          </button>
        )}
        <button
          onClick={() => onDismiss(item.id)}
          aria-label={lang === "ko" ? "닫기" : "Dismiss"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
        >
          <CloseIcon color="var(--gray-400)" />
        </button>
      </div>
    </div>
  );
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/**
 * How many toasts may stand at once.
 *
 * There was no ceiling, and at the normal pace there did not need to be: a toast clears itself
 * after 5s and the detection ticker fires every 15-30s, so one is on screen at a time. The pile
 * only appears when detections arrive faster than they clear — which a real installation does
 * whenever a camera catches several people at once, and which was reproduced here by speeding the
 * clock up to verify the alert's wording. Twelve cards stacked off the top of the window, the
 * oldest unreadable behind the newest.
 *
 * Three, because a toast is a glance and four is a list. The NEWEST are kept and the oldest is
 * dropped: an alert feed is only useful forward, and an operator reading a card from ten seconds
 * ago while three more arrive is reading the wrong one. A dropped card's own dismiss timer still
 * fires later against an id that is gone, which `dismiss` filters out harmlessly.
 */
const MAX_TOASTS = 3;

/**
 * IS A PANEL OR A DIALOG OPEN OVER THE PAGE RIGHT NOW.
 *
 * Every overlay in this product draws the same thing first: one `position: fixed` element pinned
 * to all four edges, carrying the scrim, with the panel or the dialog inside it — Drawer at
 * z-index 320, ConfirmModal at 400, the app's own modals in the same range. So the question can be
 * asked of the DOM without this file knowing any of their names: a fixed box that covers
 * essentially the whole window and sits above the page is a scrim, and nothing else in the product
 * is shaped like one. The toast stack itself is fixed too and is excluded by the same test — it is
 * a 420px card in a corner, not a full-bleed sheet.
 *
 * Deliberately not a MutationObserver: this runs once per change to the toast list, which is the
 * only moment the answer is needed, and the app's detection ticker mutates the tree several times
 * a second.
 */
function scrimIsUp(): boolean {
  if (typeof document === "undefined") return false;
  const vw = window.innerWidth, vh = window.innerHeight;
  // Overlays in this codebase are styled inline (the house style — there are no CSS modules), so
  // the attribute selector narrows thousands of nodes to a handful before anything is measured.
  // getComputedStyle then confirms it rather than trusting the string.
  for (const el of document.querySelectorAll<HTMLElement>('[style*="position: fixed"]')) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    const z = Number.parseInt(cs.zIndex, 10);
    if (!Number.isFinite(z) || z < 100) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) return true;
  }
  return false;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  /*
   * WHICH CORNER, AND WHY IT IS NOT ALWAYS THE SAME ONE.
   *
   * Measured on Portal → Users → a row → 비밀번호 재설정 → 「비밀번호를 알려줄 수 있다」 →
   * 발급: the result panel shows the credential once and its only way out is 완료 at the bottom
   * right of the panel, and the success toast landed on top of that button and ate the clicks for
   * the whole five seconds (covered at t=1s and t=4s, clear at t=7s). The panel is 440px of the
   * right-hand edge and full height, so bottom-right is exactly where its footer is — this is not
   * one modal's bad luck, it is where every Drawer in the product puts its buttons.
   *
   * Three things were tried against it and rejected. Lowering the toast under the overlay hides
   * it completely behind the panel, so the message about what just happened is never seen. Making
   * the stack pointer-transparent leaves the card sitting over the button, which stops a misclick
   * and not the real problem — you still cannot read the label under it. Moving it up the right
   * edge does nothing against a panel that is the height of the window.
   *
   * So it moves to the other corner while an overlay is up. The page behind an overlay is inert —
   * the scrim takes every click — so the left edge has nothing left on it worth not covering, and
   * a dialog is centred and a panel is on the right, which leaves bottom-left the one corner both
   * shapes are guaranteed to leave alone. With nothing open it is the bottom right the comment
   * below argues for, unchanged.
   *
   * Decided when the stack changes rather than continuously: a toast that jumps corners because
   * somebody closed a panel while reading it is worse than one that stays where it landed, and it
   * costs no observer.
   */
  const [dodgeOverlay, setDodgeOverlay] = useState(false);
  useLayoutEffect(() => { setDodgeOverlay(toasts.length > 0 && scrimIsUp()); }, [toasts]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { ...opts, id }].slice(-MAX_TOASTS));
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/*
        Bottom right, newest at the bottom.

        It used to sit at top centre, 76px down — which on Portal is directly under the top bar and
        over the breadcrumb, so a message about what just happened landed on top of the words that
        say where you are. Bottom right is where Whop and Maze put theirs; the corner is out of the
        way of both the rail and the page's own column, and the eye finds it because nothing else
        lives there.

        column-reverse so a new toast pushes the older ones up rather than shifting the one you are
        reading, and align to the right edge so cards of different widths share a margin instead of
        a centre line.
      */}
      <div style={{
        position: "fixed", bottom: "24px", zIndex: 10000,
        ...(dodgeOverlay ? { left: "24px" } : { right: "24px" }),
        display: "flex", flexDirection: "column-reverse", alignItems: dodgeOverlay ? "flex-start" : "flex-end", gap: "10px",
        /* The box is taller and wider than the cards in it whenever they differ in size, and
           those gaps were catching clicks meant for whatever is underneath. The cards take their
           own back. */
        pointerEvents: "none",
      }}>
        {toasts.map(t => <Toast key={t.id} item={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
