"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { SUPPORT_CONTACT, type ProjectType } from "@/lib/vcaStore";
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
 * PLACEHOLDERS carry the example and not the words "e.g.".
 *
 * Grey text in an empty field already reads as an example, so the prefix restates the thing the
 * styling is already saying, costs four characters of a narrow field, and does get typed in by
 * people who take it for part of the value. Plain-language guidance (GOV.UK's is the blunt one)
 * also tells you not to use Latin abbreviations in interface text, which matters more than usual
 * here: this ships to a Singapore site in English and Korean, so most readers of the English are
 * not reading their first language.
 *
 * PortalSignupWizard reached this on its own and wrote it down; the other sixteen were brought in
 * line 2026-09-04. The Korean keeps "예:" — two characters, not a Latin abbreviation, and it reads
 * naturally where an English prefix does not.
 */

/**
 * SPACING — 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24, then 8s (32 · 40 · 48 …) for page gutters.
 *
 * Not tokens, because there are none: globals.css defines colour and nothing else. This is the set
 * the gaps in Portal had already settled on, and padding had not — it also carried 3, 5, 7, 9, 11,
 * 13, 18, 22, 26, 27, 28, 30, 31, 34 and 60, most of them once or twice and 9px fifty times, none
 * of them for a reason anybody could point at. Normalised 2026-09-04.
 *
 * Written as a comment rather than an exported object because `SPACE[5]` at the call site reads
 * worse than "10px" and hides the number the layout is actually built on. Use the numbers; keep
 * them on this list.
 *
 * One value is deliberately off it: RosterImportModal's 70px left padding, which is not a spacing
 * choice at all but 20 (row padding) + 40 (line-number column) + 10 (columnGap), so a reason line
 * lines up under the name above it. All three of those are on the list.
 */

/**
 * One shape for every control you can type in or pick from — text fields, selects, the search
 * boxes. They had three different answers: the search inputs set CONTROL_HEIGHT and drew their own
 * focus ring, the form inputs set no height at all (padding decided it, so ~38px) and fell through
 * to globals.css's 2px outline, and FilterSelect is a <button>, which a mouse click does not make
 * :focus-visible — so it showed nothing at all when open. Side by side in one form, a 36px select
 * with no active state next to a 38px input with a dark outline reads as two components from two
 * products.
 *
 * The search inputs already had the right treatment, so this is theirs, lifted.
 */
export const FIELD_STYLE: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "10px",
  border: BORDER, backgroundColor: "white",
  fontSize: "13px", fontFamily: "inherit",
};

/**
 * Merged over FIELD_STYLE while the control is focused or open.
 *
 * `outline: none` belongs HERE, not in FIELD_STYLE. An outline only renders while focused, so
 * putting it on the base style bought nothing except a trap: a bare <input> that took FIELD_STYLE
 * and no focus style killed globals.css's outline and kept its box-shadow, so it drew a faint halo
 * around an unchanged grey border — a third focus look, and the one nobody designed. With the
 * opt-out on this object instead, a field either draws this ring or falls through to the global one,
 * and those two are the same picture.
 */
export const FIELD_FOCUS: React.CSSProperties = {
  border: "1px solid var(--gray-900)",
  boxShadow: "0 0 0 3px var(--gray-100)",
  outline: "none",
};
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
/**
 * The lift a resting card gets on the gray-100 ground.
 *
 * It was "none", and with CARD_BORDER also "none" a card had nothing but its own whiteness to
 * separate it from the page — which read as flat rather than calm. The reason those two were
 * removed was that the page had become mostly LINES (see CARD_BORDER's note), and a shadow is not
 * a line: it gives the card an edge without adding another rule to a page that already has table
 * header bands, row dividers and bordered controls.
 *
 * Deliberately far lighter than the modal (0 20px 60px / .18) and the dropdown (0 8px 20px / .12).
 * Those float above the page; a card sits on it. Two very shallow layers rather than one blurry
 * one, so the near edge stays crisp and the card does not look like it is hovering.
 *
 * Also picked up by the small raised pills that use this constant — the active segment of the
 * table/grid toggle and of the language switcher, which is exactly the lift those wanted.
 */
export const PANEL_SHADOW = "0 1px 2px rgba(14,22,42,0.04), 0 2px 6px rgba(14,22,42,0.05)";

export const TYPE_META: Record<ProjectType, { label: string; bg: string; color: string }> = {
  smart_city: { label: "Smart City", bg: "white", color: "var(--primary-400)" },
  smart_school: { label: "Smart School", bg: "white", color: "var(--success-400)" },
};

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
export function FilterSelect({ value, onChange, options, fitContent, footerAction }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /**
   * A pinned item at the foot of the open list — "+ Add group" and the like.
   *
   * Not an option, because it does not pick anything: it opens something else, and a chooser that
   * lets you make the missing choice on the spot beats one that sends you to another screen and
   * back with your form abandoned. Separated by a rule and never shown as selected.
   */
  footerAction?: { label: string; onClick: () => void };
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
    // inline-flex when the trigger sizes to its own label, so this wrapper hugs it and the
    // dropdown's 100% below means the trigger's width and not the whole cell's. Block otherwise,
    // where the trigger already fills the row and 100% is the same number either way.
    <div ref={ref} style={{ position: "relative", display: fitContent ? "inline-flex" : "block" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          ...(fitContent ? {} : { width: "100%" }), boxSizing: "border-box",
          height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "10px",
          backgroundColor: "white", cursor: "pointer", whiteSpace: "nowrap", outline: "none",
          // Open is this control's focused state, and it now looks like one — the same ring a text
          // field gets. Hover keeps its lighter cue underneath.
          ...(open ? FIELD_FOCUS : { border: hovered ? "1px solid var(--gray-400)" : BORDER }),
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)" }}>{selected?.label ?? "Select"}</span>
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
          // Matches the trigger. It was a flat 160px floor plus whatever the widest option needed,
          // so a full-width field in a form got a list narrower than itself and a narrow filter in
          // a toolbar got one wider — every select in Portal drew a different relationship between
          // the two. minWidth (not width) so a long option can still push past a narrow trigger
          // rather than being clipped: matching is the floor, legibility wins above it.
          minWidth: "100%", maxHeight: "220px", overflowY: "auto",
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
          {footerAction && (
            <button
              type="button"
              onClick={() => { setOpen(false); footerAction.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: "6px", width: "100%", boxSizing: "border-box",
                padding: "8px 12px", border: "none", borderTop: BORDER, background: "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                fontSize: "12px", fontWeight: 700, color: "var(--gray-900)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              {footerAction.label}
            </button>
          )}
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
        height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", cursor: "pointer",
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
        position: "relative", flexShrink: 0, width: "38px", height: "22px", borderRadius: "8px",
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
        display: "flex", alignItems: "center", justifyContent: justify, gap: "4px", padding: 0, border: "none", background: "none",
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
export function ConfirmModal({ title, body, confirmLabel, cancelLabel, danger, altAction, onConfirm, onClose }: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button — for the ones that take access away or cannot be undone from the menu. */
  danger?: boolean;
  /**
   * A second answer to the same question, for the dialogs where "yes" has two meanings and neither
   * is safe to guess at — deleting a group of registered faces is the case this exists for: the
   * grouping was a mistake, or the party has left.
   *
   * Sits to the LEFT of the main confirm, so the rightmost button — the one a stray Enter or an
   * impatient click lands on — stays the recoverable one even when this is the destructive answer.
   */
  altAction?: { label: string; onClick: () => void; danger?: boolean };
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
        {/* No rule above the buttons.
            Every modal in Portal drew one, and stacked with the header rule, the card edges, the
            table headings and the row dividers, a dialog was mostly lines — the same reason
            CARD_BORDER above is "none". The padding already separates the buttons from the text,
            and a line that is only ever in the same place carries no information.
            Not kept anywhere, including the two modals whose body scrolls: the footer buttons are
            outlined pills, so a rule directly above them is a line sitting on a row of lines, and
            a scroll region's edge is already told by its scrollbar and by content being cut off. */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {cancelLabel}
          </button>
          {altAction && (
            <button onClick={altAction.onClick}
              style={{
                padding: "10px 16px", borderRadius: "8px",
                border: altAction.danger ? "none" : BORDER,
                backgroundColor: altAction.danger ? "var(--danger-400)" : "white",
                color: altAction.danger ? "white" : "var(--gray-600)",
                fontSize: "13px", fontWeight: 700, cursor: "pointer",
              }}>
              {altAction.label}
            </button>
          )}
          {/* Non-danger confirms are gray-900, not primary: restoring an account is a normal
              administrative act, and primary-400 here would spend the page's accent on a dialog
              nobody is meant to linger in. */}
          <button onClick={onConfirm}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: danger ? "var(--danger-400)" : "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A tooltip that actually appears.
 *
 * The browser's own `title` needs the pointer held still for a second or more and vanishes on the
 * smallest movement, which is fine for a nicety and useless for anything a reader is meant to find.
 * The Users page's tab hints were written to answer "what is in this half of the table" and nobody
 * saw them.
 *
 * Opens after a short delay (long enough that sweeping the mouse across a row of tabs does not
 * flash three of them), closes at once. Keyboard focus opens it too — a hint only a mouse can reach
 * is not a hint for everybody.
 */
export function Tooltip({ text, children, placement = "bottom" }: {
  text: string;
  children: React.ReactNode;
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  // A timer that fires after the component is gone would set state on nothing.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", left: 0, zIndex: 400,
            ...(placement === "bottom" ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }),
            // Wide enough for a sentence, capped so it never becomes a paragraph nobody reads, and
            // pinned to the trigger's left edge rather than centred so a tab near the window edge
            // does not push it off screen.
            width: "max-content", maxWidth: "300px",
            backgroundColor: "var(--gray-900)", color: "white",
            fontSize: "12px", fontWeight: 400, lineHeight: 1.55, textAlign: "left",
            padding: "8px 10px", borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(14,22,42,0.18)",
            pointerEvents: "none", whiteSpace: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}


/**
 * A text field with the shared shape and the shared focus ring.
 *
 * A component rather than an exported style object because the ring needs focus state, and every
 * form in Portal was otherwise going to keep its own useState for it — which is how three
 * different treatments got here in the first place.
 */
export function TextField({ value, onChange, placeholder, type, inputMode, autoComplete, autoFocus, disabled, readOnly, style }: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Merged last — for the odd field that needs a monospace face or a fixed width. */
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const inert = disabled || readOnly;
  return (
    <input
      value={value}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      readOnly={readOnly}
      style={{
        ...FIELD_STYLE,
        ...(focused && !inert ? FIELD_FOCUS : null),
        ...(disabled ? { backgroundColor: "var(--gray-50)", color: "var(--gray-400)", cursor: "not-allowed" } : null),
        ...style,
      }}
    />
  );
}

/**
 * The support desk, one click from anywhere in Portal.
 *
 * A popover rather than a page or a modal: there is nothing to do here, only three facts to read
 * and one address to click, and a dialog for that is a door you have to close again.
 *
 * It names support and the contract separately on purpose. An administrator with a camera that
 * will not connect should not be emailing the person who sells them channels, and until now the
 * only human named anywhere in Portal was the account manager on the licence page — so that is who
 * they would have written to.
 */
/**
 * The support desk's details, as a dialog.
 *
 * Was a pill in the top bar with its own popover. It moved into the account menu — support is not
 * a per-screen action, and the bar had three permanent controls for things taken once a session —
 * and a popover opened from inside another popover has nowhere reliable to sit, so this is a
 * dialog. Text only: there is no ticketing system behind Portal, so an address, a number and the
 * hours are the whole of what can honestly be offered.
 */
export function SupportContactModal({ onClose }: { onClose: () => void }) {
  const [lang] = usePortalLanguage();
  const t = SUPPORT_T[lang];
  useEscapeKey(onClose);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
      <span style={{ fontSize: "12px", color: "var(--gray-500)", minWidth: "56px", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", minWidth: 0 }}>{value}</span>
    </div>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", marginBottom: "2px" }}>{t.heading}</p>
          {row(t.email, (
            <a className="portal-link" href={`mailto:${SUPPORT_CONTACT.email}`} style={{ color: "var(--gray-900)" }}>
              {SUPPORT_CONTACT.email}
            </a>
          ))}
          {row(t.phone, SUPPORT_CONTACT.phone)}
          {row(t.hours, SUPPORT_CONTACT.hours[lang])}
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, marginTop: "4px" }}>
            {t.contractNote}
          </p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

const SUPPORT_T = {
  en: {
    heading: "Support desk",
    email: "Email",
    phone: "Phone",
    hours: "Hours",
    contractNote: "For channels, term or renewal, ask the account manager named on the License page instead.",
    close: "Close",
  },
  ko: {
    heading: "기술 지원",
    email: "메일",
    phone: "전화",
    hours: "운영 시간",
    contractNote: "채널·기간·갱신은 라이선스 화면의 계약 담당자에게 문의하세요.",
    close: "닫기",
  },
} as const;
