"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
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
      boxShadow: "0 12px 32px rgba(14, 22, 42, 0.28)",
      minWidth: "240px", maxWidth: "420px", flexShrink: 0,
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
      {item.actionLabel ? (
        <button
          onClick={() => { item.onAction?.(); onDismiss(item.id); }}
          style={{
            padding: "5px 10px", fontSize: "12px", fontWeight: 700, letterSpacing: "-0.2px",
            color: "var(--gray-900)", backgroundColor: "white",
            border: "none", borderRadius: "8px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          {item.actionLabel}
        </button>
      ) : (
        <button
          onClick={() => onDismiss(item.id)}
          aria-label={lang === "ko" ? "닫기" : "Dismiss"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, display: "flex" }}
        >
          <CloseIcon color="var(--gray-400)" />
        </button>
      )}
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { ...opts, id }]);
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
        position: "fixed", bottom: "24px", right: "24px", zIndex: 10000,
        display: "flex", flexDirection: "column-reverse", alignItems: "flex-end", gap: "10px",
      }}>
        {toasts.map(t => <Toast key={t.id} item={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
