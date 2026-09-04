"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
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
  /**
   * One line under the label, shown only in the open list. Roles are the case this exists for:
   * an administrator does not memorise what "Auditor" means, they read the sentence at the moment
   * they pick it. Jira, StackAI and Vanta all put the sentence in the dropdown for the same reason.
   */
  description?: string;
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
                  display: "flex", alignItems: o.description ? "flex-start" : "center", gap: "6px", width: "100%", textAlign: "left", padding: "8px 12px",
                  border: "none", cursor: "pointer",
                  backgroundColor: active ? "var(--gray-100)" : hoveredOption === o.value ? "var(--gray-50)" : "white",
                  fontSize: "12px", fontWeight: active ? 700 : 500, color: active ? "var(--gray-900)" : "var(--gray-700)",
                }}
              >
                <span style={{ display: "flex", width: "12px", flexShrink: 0, marginTop: o.description ? "2px" : 0 }}>
                  {active && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                {o.description ? (
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span>{o.label}</span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--gray-500)", lineHeight: 1.5, whiteSpace: "normal" }}>{o.description}</span>
                  </span>
                ) : o.label}
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

/**
 * How many filters are narrowing what you are looking at, shown next to the filter controls.
 *
 * A toolbar of selects reading "All zones / Offline / All AI engines" states the same thing, but it
 * states it in three places and only if you read them; the failure it prevents is the one where
 * somebody filters to Offline, scrolls away, comes back later and reports that their cameras have
 * disappeared. Renders nothing at zero — a badge saying "0" is chrome.
 *
 * Clicking it clears every filter, because the count is exactly the thing you want undone once you
 * have noticed it.
 */
export function ActiveFilterCount({ count, onClear, label }: { count: number; onClear: () => void; label: string }) {
  const [hovered, setHovered] = useState(false);
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
        height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "999px", cursor: "pointer",
        border: "none", backgroundColor: hovered ? "var(--gray-200)" : "var(--gray-100)",
        fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit",
      }}
    >
      {label}
      <span style={{ display: "flex", color: "var(--gray-500)" }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </span>
    </button>
  );
}

/**
 * An on/off switch. Portal had none — every boolean was a checkbox, which is the right control for
 * "tick this to agree" but the wrong one for a setting that is in one of two named states right
 * now. A switch shows its current state at a glance; a checkbox makes you read its label to work
 * out what unticked means.
 */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Announced to screen readers. The visible label lives next to the switch, in the caller. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", flexShrink: 0, width: "38px", height: "22px", borderRadius: "999px",
        border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: checked ? "var(--gray-900)" : "var(--gray-200)",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: "3px", left: checked ? "19px" : "3px",
        width: "16px", height: "16px", borderRadius: "999px", backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(14,22,42,0.3)", transition: "left 0.15s",
      }} />
    </button>
  );
}

/**
 * The "this one is selected" tick. It existed three times — in the license tab, the project switcher
 * and the team switcher — at three sizes and two colours, which meant the same idea looked slightly
 * different depending on which menu you were in. One definition, size passed in because a tick in a
 * 12px feature list and a tick in a switcher row genuinely are different sizes; colour is inherited
 * so a caller can tint it.
 */
export function SelectedCheckIcon({ size = 14 }: { size?: number }) {
  return <Check size={size} strokeWidth={1.8} />;
}

/**
 * The metric card used above the Overview and the Input Sources tables: an eyebrow label, a tinted
 * icon badge, then whatever figure the caller puts under it.
 *
 * It lives here rather than in one of those pages because they are the same card and were briefly
 * two — the Input Sources strip was a single bordered box with three columns divided by rules,
 * which read as a different component doing the same job one screen over.
 */
export function MetricCard({ label, iconBg, iconColor, icon, accentBorder, dense, value, children }: {
  label: string;
  /** Optional. Input Sources drops the badge: its cards sit directly above a long table, so the
   *  32px badge was spending a sixth of the card's height on decoration that the value and the
   *  bar already colour-code. Overview keeps it — there the cards ARE the page. */
  iconBg?: string;
  iconColor?: string;
  icon?: () => React.JSX.Element;
  /** Overrides the (absent) card edge — used to put a red rim on a card that is over its limit. */
  accentBorder?: string;
  /**
   * Compact form for cards that sit directly above a table (Input Sources). The label and the
   * figure share one line instead of stacking, padding drops to 12/14, and the card keeps only a
   * thin bottom row — roughly half the height of the dashboard form. Overview stays un-dense: its
   * cards are the page, not a header above one.
   */
  dense?: boolean;
  /** Dense only: the figure, placed on the label's line. */
  value?: React.ReactNode;
  children: React.ReactNode;
}) {
  const Icon = icon;
  return (
    // The card's own gap is the space between the big value and the bar under it — 6, because the
    // number and the bar are one statement and 12 read as two. The eyebrow above and the footer
    // below each add 6 back, so those gaps stay where they were. Doing it here rather than per card
    // is what keeps every card on both pages identical.
    <div style={{
      backgroundColor: "white", border: accentBorder ?? CARD_BORDER, borderRadius: dense ? "12px" : "16px",
      boxShadow: PANEL_SHADOW, padding: dense ? "12px 14px" : "16px",
      display: "flex", flexDirection: "column", gap: dense ? "8px" : "6px", flex: 1, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: dense ? "baseline" : "center", justifyContent: "space-between", gap: "10px", marginBottom: dense ? 0 : (Icon ? "6px" : "2px") }}>
        {/* Sentence case, not caps. The label carries multi-word names ("Portal Accounts &
            Permissions"), which all-caps at 10px turns into a block to decode rather than read —
            and toUpperCase() did nothing at all to the Korean strings, so the two languages were
            drawing two different headings. Same 12px/600/gray-500 as every other secondary line
            on these cards. */}
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>{label}</p>
        {dense
          ? value
          : Icon && (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: iconBg, color: iconColor, flexShrink: 0 }}>
              <Icon />
            </span>
          )}
      </div>
      {children}
    </div>
  );
}

/** A dot-and-label pair for a metric card's footer — "56 online", "3 offline". */
export function SubStat({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ── Sortable table headings ──────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Column sorting for the Portal tables. None of them could be sorted at all, so questions an
 * administrator actually asks — who has not signed in for longest, which cameras have been offline
 * the longest — meant reading every row.
 *
 * Held here rather than per table so the five tables behave identically: first click on a new
 * column sorts ascending, clicking the active column flips it, and there is always a sort (no
 * third "unsorted" click, which only ever returns you to an order nobody chose).
 */
export function useTableSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K) =>
    setSort(prev => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  return { sort, toggle };
}

/**
 * Sorts by the value `valueOf` returns for each row. Strings compare with localeCompare so Korean
 * and English names both land where a reader expects; everything else compares numerically.
 * Undefined always sinks to the bottom regardless of direction — a camera with no last-seen time is
 * missing data, not the oldest one, and letting it win "oldest first" would be a wrong answer.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  valueOf: (row: T, key: K) => string | number | undefined,
): T[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = valueOf(a, sort.key);
    const bv = valueOf(b, sort.key);
    if (av === undefined && bv === undefined) return 0;
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * factor;
    return (Number(av) - Number(bv)) * factor;
  });
}

/**
 * A column heading that sorts. Columns without a `sortKey` render as plain headings, so a table can
 * mix the two — an actions column or a thumbnail has nothing to sort by.
 *
 * The arrow shows only on the active column. Showing a faint one on every sortable column is the
 * other common choice, but it puts a piece of chrome in every heading to say "you could", and the
 * hover already says that.
 */
export function SortableHeader<K extends string>({ label, sortKey, sort, onToggle, align }: {
  label: string;
  sortKey?: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  /** Right for a column whose cells are right-aligned — a heading that stays left while its data
   *  sits at the other end of the cell reads as two different columns. */
  align?: "left" | "right";
}) {
  const [hovered, setHovered] = useState(false);
  const headingStyle = { fontSize: "10px", fontWeight: 600, letterSpacing: "0.4px" } as const;
  const justify = align === "right" ? "flex-end" : "flex-start";

  if (!sortKey) return <span style={{ ...headingStyle, color: TABLE_HEADER_COLOR, display: "flex", justifyContent: justify }}>{label.toUpperCase()}</span>;

  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...headingStyle,
        display: "flex", alignItems: "center", justifyContent: justify, gap: "3px", padding: 0, border: "none", background: "none",
        cursor: "pointer", textAlign: align === "right" ? "right" : "left", fontFamily: "inherit",
        color: active || hovered ? "var(--gray-900)" : TABLE_HEADER_COLOR,
      }}
    >
      {label.toUpperCase()}
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: sort.direction === "desc" ? "rotate(180deg)" : "none" }}>
          <path d="M5 8V2M5 2L2.4 4.6M5 2l2.6 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

/**
 * Confirmation step for a row action that changes someone's access.
 *
 * The Users table's account actions live behind a kebab menu, which is exactly the shape of control
 * a misclick lands on — and suspending, reactivating or removing an account takes effect against a
 * real person the moment the item is clicked. So the menu item now asks first.
 *
 * Deliberately not applied to every action on that menu: a confirmation that appears for everything
 * is one people learn to click through, which costs the two that matter. Actions that only produce
 * something to hand over (a reset code, a resend) stay one click.
 *
 * The three older bespoke copies of this dialog (ProjectRosterTab's Issue/Remove, ProjectVipTab's
 * Remove) predate it and still carry their own markup — worth folding in here, but not while they
 * are untouched by the change that needed this.
 */
export function ConfirmModal({ title, body, confirmLabel, cancelLabel, danger, onConfirm, onClose }: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button — for the ones that take access away or cannot be undone from the menu. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.6 }}>{body}</p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {cancelLabel}
          </button>
          {/* Non-danger confirms are gray-900, not primary: restoring an account is a normal
              administrative act, and primary-400 here would spend the page's accent on a dialog
              nobody is meant to linger in. */}
          <button onClick={onConfirm}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: danger ? "var(--danger-400)" : "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
