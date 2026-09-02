"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";

export const BORDER = "1px solid var(--gray-200)";
// Every control that can sit on a toolbar row — search input, FilterSelect, pill buttons, the
// table/grid segmented toggle — is this tall, so a row of them lines up regardless of padding
// or font size. Set the height, not the vertical padding.
export const CONTROL_HEIGHT = "36px";
export const PANEL_SHADOW = "none";

export const TYPE_META: Record<ProjectType, { label: string; bg: string; color: string }> = {
  smart_city: { label: "Smart City", bg: "white", color: "var(--primary-400)" },
  smart_school: { label: "Smart School", bg: "white", color: "var(--success-400)" },
};

// One global switcher lives in PortalShell's top bar — every Portal screen reads the same
// usePortalLanguage() subscription, so switching here takes effect everywhere without a reload.
export function LanguageSwitcher() {
  const [lang, setLang] = usePortalLanguage();
  return (
    <div style={{ display: "flex", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "999px", padding: "3px", flexShrink: 0 }}>
      {(["en", "ko"] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          style={{
            padding: "5px 11px", borderRadius: "999px", border: "none", cursor: "pointer",
            backgroundColor: lang === l ? "white" : "transparent", boxShadow: lang === l ? PANEL_SHADOW : "none",
            fontSize: "12px", fontWeight: 700, color: lang === l ? "var(--gray-900)" : "var(--gray-400)",
          }}>
          {l === "en" ? "EN" : "한국어"}
        </button>
      ))}
    </div>
  );
}

interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /**
   * Shown greyed out and unclickable, with `reason` explaining why. Kept in the menu rather than
   * removed: an action that quietly disappears looks like a missing feature, and the administrator
   * goes looking for it elsewhere. Present-but-refused says the system decided.
   *
   * Keep `reason` to a sentence or two. It renders as a footnote at the foot of the menu, not as a
   * paragraph under the item — see RowActionsMenu.
   */
  disabled?: boolean;
  reason?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// Custom dropdown for filter selects — a native <select>'s popup is positioned by the browser,
// and inside this app's nested-scroll shell (PortalShell's outer overflow:hidden + inner
// overflow:auto content area) that positioning can land the popup far from its trigger. Ported
// from the main VCA app's SimpleSelect (DataPage.tsx) to match its exact look and behavior.
export function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          width: "100%", boxSizing: "border-box",
          height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "10px",
          border: hovered ? "1px solid var(--gray-400)" : BORDER,
          backgroundColor: "white", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{selected?.label ?? "Select"}</span>
        <span style={{ display: "flex", color: "var(--gray-600)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: "4px", zIndex: 50,
          // Same radius and shadow as RowActionsMenu's dropdown — Portal has two menus and they
          // should not be two designs.
          backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
          minWidth: "160px", maxHeight: "220px", overflowY: "auto",
        }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={() => setHoveredOption(o.value)}
                onMouseLeave={() => setHoveredOption(null)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px", width: "100%", textAlign: "left", padding: "8px 12px",
                  border: "none", cursor: "pointer",
                  backgroundColor: active ? "var(--gray-100)" : hoveredOption === o.value ? "var(--gray-50)" : "white",
                  fontSize: "12px", fontWeight: active ? 700 : 500, color: active ? "var(--gray-900)" : "var(--gray-700)",
                }}
              >
                <span style={{ display: "flex", width: "12px", flexShrink: 0 }}>
                  {active && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shared "..." overflow menu for table/list row actions (edit/remove/etc.) — replaces a row of
// always-visible icon buttons with one trigger, matching how Vimeo (and most SaaS admin tables)
// keep row actions compact and consistent as more of them get added over time.
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const disabledReasons = Array.from(
    new Set(actions.filter(a => a.disabled && a.reason).map(a => a.reason as string))
  );
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", justifySelf: "end" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="More actions"
        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "4px", borderRadius: "6px" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3.3" r="1.3" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.3" fill="currentColor"/>
          <circle cx="8" cy="12.7" r="1.3" fill="currentColor"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 50,
          backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
          // Sized to the longest label rather than to a guess. At 140px every label of more than
          // two words wrapped, and the menu came out as a column of stacked half-sentences that
          // looked like nothing else in the app. maxWidth only bounds the footnote below, which is
          // the one thing in here that is meant to wrap.
          minWidth: "180px", maxWidth: "280px", padding: "4px",
        }}>
          {actions.map(a => (
            <button
              key={a.label}
              disabled={a.disabled}
              onClick={() => { if (a.disabled) return; a.onClick(); setOpen(false); }}
              onMouseEnter={() => setHovered(a.label)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: "6px",
                border: "none", whiteSpace: "nowrap",
                // Hover used to be a `.portal-menu-item:hover` rule in a <style> tag, which never
                // once fired: every item also carried an inline `background: none`, and an inline
                // declaration outranks a class selector. Held in state instead, the same way
                // FilterSelect's options below already do it.
                backgroundColor: !a.disabled && hovered === a.label
                  ? (a.danger ? "var(--danger-100)" : "var(--gray-100)")
                  : "transparent",
                cursor: a.disabled ? "default" : "pointer",
                fontSize: "12px", fontWeight: 600,
                color: a.disabled ? "var(--gray-400)" : a.danger ? "var(--danger-500)" : "var(--gray-600)",
              }}
            >
              {a.label}
            </button>
          ))}
          {/* Why the greyed items are greyed, once at the foot of the menu — not repeated under
              each one. Two actions refused for the same reason used to print the same paragraph
              twice, which made a five-item menu taller than the table behind it. Deduplicated, so
              a shared reason is stated once and genuinely different reasons still both appear.
              Kept in the menu rather than moved to a title attribute: a tooltip on a disabled
              control is unreliable across browsers, and this one has to be read. */}
          {disabledReasons.length > 0 && (
            <div style={{ borderTop: BORDER, marginTop: "4px", padding: "8px 10px 4px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {disabledReasons.map(reason => (
                <div key={reason} style={{ display: "flex", gap: "6px" }}>
                  <span style={{ flexShrink: 0, display: "flex", color: "var(--gray-400)", marginTop: "1px" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.6v4.2M8 10.9v.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </span>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.6 }}>{reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
