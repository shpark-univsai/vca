"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";

export const BORDER = "1px solid var(--gray-200)";
/**
 * Cards on the Portal's gray-100 surface carry no outline of their own — white against that ground
 * is the whole separation. Every card used to draw a gray-200 border as well, and with dividers
 * inside them, a bordered table header, bordered rows and bordered controls all stacking up, the
 * page was mostly lines. Removing the outermost of them costs nothing legible and takes a whole
 * layer of ruling out.
 *
 * Written as a named constant rather than by deleting the property, so a card still declares what
 * its edge is and one edit brings the outline back everywhere if it turns out to be needed.
 */
export const CARD_BORDER = "none";
// Every control that can sit on a toolbar row — search input, FilterSelect, pill buttons, the
// table/grid segmented toggle — is this tall, so a row of them lines up regardless of padding
// or font size. Set the height, not the vertical padding.
export const CONTROL_HEIGHT = "36px";
/**
 * Column gap for the Portal tables. They were all built with no gap at all, which is merely tight
 * for columns of plain text but actually collides once a cell holds a bordered control — the Users
 * table's Permission select ran straight into the MFA badge next to it. One value so the four
 * tables stay the same table.
 */
export const TABLE_COLUMN_GAP = "12px";
/**
 * How wide each breadcrumb name may get before it is ellipsised. They were 260px and 220px, which
 * cut perfectly ordinary names ("City of Singapore — Smart Infrastructure Office", "Marina Bay &
 * CBD Surveillance Network") in half while about a thousand pixels of header sat empty to the right
 * of them. Truncating is for the name that genuinely does not fit, not for the one we declined to
 * give room to.
 *
 * A viewport term as well as a pixel cap, because the pixel cap alone is only generous on a wide
 * window: on a narrow one two long names plus the language switcher and the exit button add up to
 * more than the bar, and a flex row with nothing to give pushes the right-hand buttons off the
 * edge. min() lets the names take the room when it exists and hands it back when it does not.
 *
 * Team gets more than project because the team name is the one that is usually a full legal
 * organisation name. Both crumbs' render sites read these, so a name clips at one width rather than
 * at whichever number that particular component happened to be written with.
 */
/**
 * One gap between cards, in both directions. The Overview was built with the grid's own gap at 12px
 * and every vertical space between cards at 16px, so the same nominal "space between two cards"
 * measured differently depending on whether they sat side by side or stacked — which shows up as
 * columns that look tighter than the rows they line up with.
 */
export const CARD_GAP = "12px";
/**
 * Colour of a table's column headings, everywhere in Portal. gray-400 was a step too light: set
 * against gray-50 header bands it read as disabled text rather than as the labels for the columns
 * under it. gray-500 keeps them clearly quieter than the data without making them look switched off.
 * Named so the six tables that draw a heading row cannot drift apart again.
 */
export const TABLE_HEADER_COLOR = "var(--gray-500)";

/**
 * Ceiling for the Overview's three list panels — Camera Status, Recently Registered VIPs, Recent
 * Admin Activity. They sit side by side in one grid row, and each was free to be as tall as its own
 * content, so the row's bottom edge was a staircase and a busy project pushed everything below it
 * off the fold.
 *
 * The row stretches its three panels to a common height and stops at this one; anything longer
 * scrolls inside its own panel instead of growing the page. 380px is a little above what the
 * fullest of them needs today (Camera Status at its five-row cap is ~340px), so in the normal case
 * nothing scrolls and the three simply line up — the cap is there for the project that outgrows
 * that, not as the everyday layout.
 */
export const OVERVIEW_PANEL_MAX_HEIGHT = "380px";

export const BREADCRUMB_TEAM_MAX_WIDTH = "min(360px, 26vw)";
export const BREADCRUMB_PROJECT_MAX_WIDTH = "min(320px, 22vw)";
export const PANEL_SHADOW = "none";

/**
 * What a team can say it does. Exactly two entries, because the product ships exactly two solution
 * templates (ProjectType) and this field's only job is to pre-select one of them.
 *
 * It used to list Utilities and Other as well, and the New team modal invented Public Safety,
 * Transport and Retail on top of that — six choices leading to two outcomes, with everything that
 * was not "Smart School" silently becoming a Smart City project. A menu that quietly collapses
 * four of its options into one is worse than a short menu: the person picks Transport, believes
 * they told us something, and gets a Smart City template with no explanation.
 *
 * Both places that ask (signup's Step 2 and the New team modal) read this, so the question has one
 * answer set. Values stay in English — they are stored on team.industry and compared against
 * directly by industryToProjectType; only the label is translated.
 */
export const TEAM_INDUSTRIES: { value: string; label: { en: string; ko: string } }[] = [
  { value: "Smart City", label: { en: "Smart City", ko: "스마트시티" } },
  { value: "Smart School", label: { en: "Smart School", ko: "스마트스쿨" } },
];

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
export function FilterSelect({ value, onChange, options, fitContent }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /**
   * Size the trigger to its label instead of filling the space it is given. For a select sitting in
   * a table cell, where the answers are a word long ("Admin", "Operator") and the column is as wide
   * as the columns beside it — a full-width control there draws a box several times the length of
   * the word inside it. Forms want the opposite (fields line up on a shared edge), so this is
   * opt-in and full width stays the default.
   */
  fitContent?: boolean;
}) {
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
          ...(fitContent ? {} : { width: "100%" }), boxSizing: "border-box",
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
