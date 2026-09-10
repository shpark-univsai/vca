"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { SUPPORT_CONTACT, canEditPortal, currentPortalUser, useVcaStore, type ProjectType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";

/**
 * Whether the person at this console may change anything on it, and the sentence to show when
 * they may not.
 *
 * The Auditor role was advertised as read-only and enforced nowhere. The Access-and-roles modal
 * printed "Cameras, VIP, roster, license, server — View only" for Auditor, derived from
 * canEditPortal so the table could not lie — and canEditPortal had exactly that one call site.
 * No tab checked it. An auditor could delete cameras, delete enrolled faces and rewrite the
 * roster, having just read a screen promising they could not. A security officer is given that
 * account precisely because of the promise.
 *
 * Fails OPEN when the stand-in identity matches no account, the same as every other gate in
 * Portal: there is no session yet, and a lock keyed on "we could not identify you" would shut
 * the demo out of its own console. See currentPortalUser.
 *
 * HANDOFF NOTE: this decides what to show and what to disable, nothing more. Every mutating
 * endpoint checks the caller's role again — auth-flow doc, section 07.
 */
export function usePortalEditAccess(): { mayEdit: boolean; reason: string | undefined } {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const [lang] = usePortalLanguage();
  const me = currentPortalUser(portalUsers);
  const mayEdit = me ? canEditPortal(me.permission) : true;
  return { mayEdit, reason: mayEdit ? undefined : READ_ONLY_REASON[lang] };
}

/**
 * The handful of strings the shared components own.
 *
 * They had none: the kebab menu's only label was a hardcoded `title="More actions"` — untranslated
 * in Korean, and the single thing a screen reader had to go on for an icon-only button used in six
 * Portal tables — and FilterSelect fell back to an English "Select" whenever its value matched no
 * option (reachable, e.g. a camera whose assigned server was deleted).
 */
const SHARED_LABELS = {
  en: { moreActions: "More actions", select: "Select", typeSmartCity: "Smart City", typeSmartSchool: "Smart School" },
  ko: { moreActions: "더 보기", select: "선택", typeSmartCity: "스마트시티", typeSmartSchool: "스마트스쿨" },
} as const;

/** Why a control is disabled, said in the role's own words rather than "no permission". */
const READ_ONLY_REASON = {
  en: "Auditor accounts have view-only access to this console.",
  ko: "감사자 계정은 이 콘솔을 보기만 할 수 있습니다.",
} as const;

/**
 * Every hairline in Portal — card edges, table rules, row dividers, field borders.
 *
 * --line, a grey with a little primary in it, rather than a step of either ramp. It has been
 * gray-200 (invisible once the canvas went white), then gray-300 (legible, but a neutral rule laid
 * over a tinted page). A line belongs to the surface it is drawn on, and this surface is
 * primary-50 with white cards on it.
 */
export const BORDER = "1px solid var(--line)";
/** A card's edge is the same hairline as everything else. One line colour, one weight. */
export const CARD_BORDER = BORDER;
/**
 * A card's corner. One number, because two was the whole problem.
 *
 * Content panels and the boxes a table lives in were split between 12 and 16 with nothing
 * distinguishing them — the VIP registry's table card at 16 and the Users page's request panel
 * at 12, the VIP grid tile at 16 and the camera grid tile at 12, doing the same job side by
 * side on screens a reader moves between.
 *
 * The summary strip keeps its own 12 deliberately: it is a band of cells, not a card, and it
 * sits directly above one — a strip as round as the card under it reads as a second card.
 */
export const CARD_RADIUS = "16px";
// Every control that can sit on a toolbar row — search input, FilterSelect, pill buttons, the
// table/grid segmented toggle — is this tall, so a row of them lines up regardless of padding
// or font size. Set the height, not the vertical padding.
export const CONTROL_HEIGHT = "36px";
/**
 * Every icon in Portal renders a 1.4px stroke. The NUMBER in the markup is rarely 1.4.
 *
 * stroke-width is in the icon's own coordinate system, so what reaches the screen is
 * `strokeWidth × renderedSize / viewBoxUnits`. Setting every icon's attribute to the same 1.4 —
 * which is what a first pass did — produced strokes from 0.58px to 1.75px, because a lucide glyph
 * is a 24-unit box drawn at 14 or 16px while the hand-drawn paths here are 14- or 16-unit boxes
 * drawn at their own size. The lucide ones came out thin, which is what made the sidebar's crown
 * (lucide) look wrong beside the seven inline icons around it.
 *
 * So: pick the attribute from the ratio.
 *
 *     strokeWidth = 1.4 × viewBoxUnits / renderedPx
 *
 *     lucide  size={14}                → 2.4      lucide  size={16}                → 2.1
 *     <svg width="16" viewBox="0 0 16"> → 1.4      <svg width="16" viewBox="0 0 14"> → 1.22
 *
 * Not a constant, because the answer differs per call site — but this is the arithmetic to redo
 * for anything new.
 */
export const ICON_STROKE_PX = 1.4;
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
 * Colour of a table's column headings, everywhere in Portal. It has walked up the ramp twice:
 * gray-400 read as disabled text against the gray-50 header band, gray-500 was legible but still
 * receded at 10px with letter-spacing on it. gray-600 is the step where the headings read as
 * labels for the columns rather than as a watermark, and they stay clearly quieter than the
 * gray-900 data under them. Named so the six tables that draw a heading row cannot drift apart.
 */
export const TABLE_HEADER_COLOR = "var(--gray-700)";

/**
 * Ceiling for the Overview's three list panels — Camera Status, Recently Registered VIPs, Recent
 * Admin Activity. They sit side by side in one grid row, and each was free to be as tall as its own
 * content, so the row's bottom edge was a staircase and a busy project pushed everything below it
 * off the fold.
 *
 * The row stretches its three panels to a common height and stops at this one; anything longer
 * scrolls inside its own panel instead of growing the page.
 *
 * Measured against the window rather than fixed, because what this number is really for is "the
 * page ends where the screen ends". A fixed 680px did fill nicely on a tall monitor and ran the
 * camera list off the bottom of a shorter one, which is the one thing the cap exists to prevent.
 *
 * 500px is the chrome above and below the row on the Overview: the 52px top bar, the content's
 * 12px top padding, the greeting block, the attention strip, the metric cards, the weekly
 * detections card, their gaps, and the 32px the page keeps under its last card. Whatever the window leaves after that is the
 * panels' height, and the lists inside them scroll to fit it. The 360px floor is there so a very
 * short window gets a usable panel instead of a sliver.
 */
export const OVERVIEW_PANEL_MAX_HEIGHT = "max(360px, calc(100vh - 500px))";

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
export const PANEL_SHADOW = "0 1px 2px rgba(14,22,42,0.03), 0 1px 3px rgba(14,22,42,0.03)";

/**
 * What kind of project it is, as a chip.
 *
 * The ground was `white`, which was right while the only place this chip appeared was the licence
 * page's gray-900 hero. That head is gone (2026-09-09) and a white chip on a white card is a
 * coloured word floating between two chips that have grounds, so each type now carries its own
 * tint — the same 100 step every other status chip in Portal sits on.
 */
/**
 * The two project types, and how a chip for one is coloured.
 *
 * `label` stays English here because it is also a data value shared with screens that do not
 * localise; `useTypeLabel()` below is what a rendered chip should use. Three Portal screens were
 * printing TYPE_META.label straight into a Korean UI while the project wizard translated the
 * same two words correctly, so the console showed both spellings.
 */
export const TYPE_META: Record<ProjectType, { label: string; bg: string; color: string }> = {
  smart_city: { label: "Smart City", bg: "var(--primary-100)", color: "var(--primary-400)" },
  smart_school: { label: "Smart School", bg: "var(--success-100)", color: "var(--success-400)" },
};

/** The project type's name in the reader's language. */
export function useTypeLabel(): (type: ProjectType) => string {
  const [lang] = usePortalLanguage();
  return type => (type === "smart_city" ? SHARED_LABELS[lang].typeSmartCity : SHARED_LABELS[lang].typeSmartSchool);
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
  const [lang] = usePortalLanguage();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  /**
   * Whether the list opens upward. Decided when it opens, from how much room is left under the
   * trigger — the bulk-action bar on Input Sources is fixed to the bottom of the window, so its
   * "Move to zone" list dropped straight off the screen and showed one row of itself.
   *
   * Measured rather than declared: a caller cannot know whether a select 300px down a scrolling
   * page has room beneath it, and the same select can have room one moment and not the next.
   */
  const [dropUp, setDropUp] = useState(false);
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
    /*
     * inline-GRID when the trigger sizes to itself, so it can be as wide as the list it opens.
     *
     * It used to hug the selected label, which meant "All groups" was narrow and the open list —
     * sized to its longest option — was wider, so the thing jumped sideways on every click. The
     * fix is the oldest one in the book: a hidden copy of every option stacked in the same grid
     * cell as the trigger. The cell is as wide as the widest of them, the trigger fills the cell,
     * and neither the label nor the list decides the width alone.
     *
     * Block otherwise, where the trigger already fills its row and 100% is the same number either
     * way.
     */
    <div ref={ref} style={{
      position: "relative",
      ...(fitContent
        ? { display: "inline-grid", maxWidth: "min(340px, 90vw)" }
        : { display: "block" }),
    }}>
      {fitContent && (
        <div aria-hidden style={{ gridArea: "1 / 1", visibility: "hidden", height: 0, overflow: "hidden", pointerEvents: "none" }}>
          {options.map(o => (
            /* The trigger's own type, plus its box: 12 left padding, then 12 right padding + 8 gap
               + 12 chevron on the other side. Same numbers as the button below — if those change,
               these do. It measured 13/600 while the trigger drew 10/700, so every fitContent
               select reserved room for a label it was not drawing. */
            <div key={o.value} style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", padding: "0 32px 0 12px" }}>{o.label}</div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={e => {
          if (!open) {
            const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
            // 260px is the tallest this list gets (maxHeight below plus its padding). If that will
            // not fit under the trigger but does fit over it, flip.
            const below = window.innerHeight - box.bottom;
            setDropUp(below < 260 && box.top > below);
          }
          setOpen(o => !o);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          ...(fitContent ? { gridArea: "1 / 1", width: "100%" } : { width: "100%" }), boxSizing: "border-box",
          height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "10px",
          backgroundColor: "white", cursor: "pointer", whiteSpace: "nowrap", outline: "none",
          // Open is this control's focused state, and it now looks like one — the same ring a text
          // field gets. Hover keeps its lighter cue underneath.
          ...(open ? FIELD_FOCUS : { border: hovered ? "1px solid var(--gray-400)" : BORDER }),
        }}
      >
        {/* 12px, the size the action buttons in the same toolbar use, and the size of the options
            this trigger opens — at 10 the control was smaller than its own list. The typed content
            of a text field stays at 13: that is the reader's own text and it has to be
            comfortable, but a select shows a label we wrote. */}
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis" }}>{selected?.label ?? SHARED_LABELS[lang].select}</span>
        <span style={{ display: "flex", color: "var(--gray-600)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.87" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>
      {open && (
        <div style={{
          position: "absolute", left: 0, zIndex: 50,
          ...(dropUp ? { bottom: "100%", marginBottom: "4px" } : { top: "100%", marginTop: "4px" }),
          // Same radius and shadow as RowActionsMenu's dropdown — Portal has two menus and they
          // should not be two designs.
          backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
          // The trigger's width is the FLOOR, not the width. It was a flat 160px plus whatever the
          // widest option needed, so a full-width field in a form got a list narrower than itself
          // and a narrow filter in a toolbar got one wider — every select in Portal drew a
          // different relationship between the two.
          //
          // Above that floor the list takes what its longest option needs (max-content) and stops
          // at 340px. A fitContent trigger is only as wide as its own label — "All groups" — so at
          // exactly 100% every option longer than that wrapped onto a second line, which in a menu
          // reads as two options rather than one long one. Past 340px the label truncates instead;
          // by then it is a sentence, and a menu is not where sentences are read.
          minWidth: "100%", width: "max-content", maxWidth: "min(340px, 90vw)",
          maxHeight: "220px", overflowY: "auto",
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
                  // gray-100 on hover, gray-200 on the current one. Hover was gray-50 — three per
                  // cent of tone against white, which is not a hover so much as a rumour — and it
                  // had to stay under the selected row's own gray-100. Moving both up a step keeps
                  // that order and makes the pointer's position legible; the tick and the bold
                  // label say which one is selected either way.
                  backgroundColor: active ? "var(--gray-200)" : hoveredOption === o.value ? "var(--gray-100)" : "white",
                  fontSize: "12px", fontWeight: active ? 700 : 500, color: active ? "var(--gray-900)" : "var(--gray-700)",
                }}
              >
                <span style={{ display: "flex", width: "12px", flexShrink: 0, marginTop: o.description ? "2px" : 0 }}>
                  {active && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.87" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                {/* One line. Without this the option box grew a second line for a long label and
                    the list read as more options than it has. */}
                {o.description ? (
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span>{o.label}</span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--gray-500)", lineHeight: 1.5, whiteSpace: "normal" }}>{o.description}</span>
                  </span>
                ) : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>}
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
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.63" strokeLinecap="round"/></svg>
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
  const [lang] = usePortalLanguage();
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
        title={SHARED_LABELS[lang].moreActions}
        aria-label={SHARED_LABELS[lang].moreActions}
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
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.87"/><path d="M8 4.6v4.2M8 10.9v.9" stroke="currentColor" strokeWidth="1.87" strokeLinecap="round"/></svg>
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
/**
 * A row of figures above a list — the shape Portal uses for a page's own summary.
 *
 * One cell per figure: the number and its unit, the label under it, and the mark that says which
 * figure it is at the cell's right edge. Cells share the width equally and are divided by
 * hairlines, so the row reads as one measured surface rather than as a set of small cards; the
 * whole thing is about 44px tall, which is the most a summary can cost on a page whose job is the
 * list beneath it.
 *
 * A cell with an onClick is a filter: pressing it narrows the list to the rows it counted and
 * pressing it again clears that, with the active cell tinted. A cell without one is a statement —
 * no hover, no pointer, and that difference is the only thing marking it, because a greyed-out
 * cell in a row of live ones reads as disabled rather than as "not a filter".
 *
 * Cells whose figure is zero are dropped by the caller, not here: whether "0 of them" is worth a
 * column is a question about the number, and only the page knows. (The VIP registry hides them —
 * a filter that returns an empty table is not worth a click.)
 *
 * First used by the VIP registry's registry-health row; Input Sources and Server & API are meant
 * to take the same shape when they get summaries, which is why this lives here.
 */
export interface SummaryCell {
  key: string;
  /** 14px lucide icon at stroke 2.4 — the 1.4px Portal draws everywhere. */
  icon: React.ReactNode;
  figure: React.ReactNode;
  /** The small word after the figure: "people", "of 104", "cameras". */
  unit?: string;
  /**
   * How the figure compares with the window before it, drawn after the unit.
   *
   * Grey and un-tinted whichever way it points, like the Overview's detection trend: more or fewer
   * is neither good news nor bad, and colouring it would send the reader hunting for a fault
   * nobody reported. `text` is the whole phrase so the caller keeps its own wording and its own
   * language; this only supplies the arrow and the colour.
   */
  trend?: { direction: "up" | "down" | "flat"; text: string };
  label: string;
  /** warning (amber) for a defect somebody has to fix, neutral (plain black) for a fact. */
  tone?: "warning" | "neutral";
  onClick?: () => void;
  active?: boolean;
  /** Tooltip — say what pressing it does, since the cell itself is a number. */
  title?: string;
  /**
   * A sentence explaining what the label means, shown on hover with the dotted underline that
   * advertises it.
   *
   * For cells whose label names a state rather than a thing — "invited", "suspended", "on the
   * roster" — where the word is the whole question and this is the answer.
   *
   * Our own Tooltip, not the browser's `title`: that one waits about a second with the pointer
   * held still, so an underline promising an explanation delivered nothing to anybody moving at
   * normal speed. It was `explain: true` plus a `title`, which is exactly that mistake.
   */
  explanation?: string;
}

export function SummaryStrip({ cells }: { cells: SummaryCell[] }) {
  if (cells.length === 0) return null;
  return (
    /* No overflow:hidden. It kept the cells' active tint inside the rounded corners, and clipped
       the one thing that has to escape — the explanation tooltip, which hangs below its label. The
       corners are handled by rounding the end cells instead. */
    <div style={{
      display: "flex", alignItems: "stretch", flexWrap: "wrap",
      backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px",
      marginBottom: "12px",
    }}>
      {cells.map((cell, i) => {
        // A defect is amber. Anything else is the plain text colour: these cells state a fact
        // rather than raise one, and a coloured figure asks to be acted on. The mark beside it
        // stays grey — with a gray-900 figure next to it there is no risk of the cell reading as
        // switched off, which is what a grey figure did.
        const accent = cell.tone === "warning" ? "var(--warning-500)" : "var(--gray-900)";
        const markColor = cell.tone === "warning" ? "var(--warning-500)" : "var(--gray-400)";
        const body = (
          <>
            <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span style={{ fontSize: "20px", fontWeight: 800, color: accent, lineHeight: "22px" }}>{cell.figure}</span>
                {cell.unit && <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{cell.unit}</span>}
                {cell.trend && (
                  /* alignItems center rather than the row's baseline: the arrow is a glyph-sized
                     box with no text baseline of its own, and on the baseline it hangs low. */
                  <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "11px", color: "var(--gray-500)", whiteSpace: "nowrap" }}>
                    {cell.trend.direction === "up" && <ArrowUp size={11} strokeWidth={2.6} />}
                    {cell.trend.direction === "down" && <ArrowDown size={11} strokeWidth={2.6} />}
                    {cell.trend.text}
                  </span>
                )}
              </span>
              {cell.explanation ? (
                <Tooltip text={cell.explanation}>
                  <span style={{
                    fontSize: "11px", lineHeight: "14px", fontWeight: 600, color: "var(--gray-600)", whiteSpace: "nowrap",
                    borderBottom: "1px dotted var(--gray-400)", cursor: "help",
                  }}>{cell.label}</span>
                </Tooltip>
              ) : (
                <span style={{ fontSize: "11px", lineHeight: "14px", fontWeight: 600, color: "var(--gray-600)", whiteSpace: "nowrap" }}>
                  {cell.label}
                </span>
              )}
            </span>
            {/* marginTop 4 puts the mark's centre on the figure's line rather than at the top of
                the cell's padding. */}
            <span style={{ display: "flex", color: markColor, flexShrink: 0, marginTop: "4px" }}>{cell.icon}</span>
          </>
        );
        const shared: React.CSSProperties = {
          flex: 1, minWidth: "128px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px",
          padding: "10px 18px",
          // gray-200, not the --line hairline every card edge uses: this rule sits inside a white
          // panel with nothing else to separate the cells, and at #e7e7f1 on white the middle
          // divider was there in the markup and invisible on the screen.
          borderLeft: i === 0 ? "none" : "1px solid var(--gray-200)",
          // The end cells carry the strip's own corners, so a tinted cell does not square them off
          // now that the container no longer clips.
          ...(i === 0 ? { borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" } : null),
          ...(i === cells.length - 1 ? { borderTopRightRadius: "12px", borderBottomRightRadius: "12px" } : null),
        };
        return cell.onClick ? (
          <button
            key={cell.key}
            onClick={cell.onClick}
            title={cell.title}
            className="portal-attention-row"
            style={{
              ...shared,
              // Three sides, not `border: "none"`. A button carries a UA border and has to lose it,
              // but writing the shorthand here resets the left edge too — and it resets it *after*
              // the spread has set it, because re-assigning a key in an object literal keeps the
              // key's original position: borderLeft came from `shared` and `border` came later, so
              // the divider between two clickable cells was being erased at the last moment. That
              // is why the strip lost the line between its first two cells and kept the one before
              // the cell that is a span.
              borderTop: "none", borderRight: "none", borderBottom: "none",
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              // The selected cell is tinted rather than outlined: on a panel, "this filter is on"
              // is a state of the cell, not an annotation on its label. The tint follows the tone
              // — an amber wash under a cell that is not raising a defect would report a fault the
              // cell never claimed.
              backgroundColor: cell.active
                ? (cell.tone === "warning" ? "var(--warning-100)" : "var(--gray-100)")
                : "transparent",
            }}
          >
            {body}
          </button>
        ) : (
          <span key={cell.key} style={shared}>{body}</span>
        );
      })}
    </div>
  );
}

/**
 * One band of the card, headed the way the licence card heads INCLUDED FEATURES.
 *
 * 10px small caps rather than the 13px bold each of these had as a card title of its own: a
 * heading inside a card is furniture, and at 13px bold it competed with the values under it for
 * the same weight. The hairline above does the separating that three floating cards used to.
 */
/**
 * One section of the settings card: what it is on the left, what you can do on the right.
 *
 * It was a full-width stack under a 10px small-caps label, and two things were wrong with that.
 * The label was the smallest, lightest text in its own section — under the 12px pair captions
 * and the 14px values it was meant to govern — so a section never announced itself; and on the
 * 1600px shell the content under it ran the whole width, which put a value an arm's length from
 * the word naming it and set every paragraph on a measure nobody can track back to.
 *
 * The rail fixes both at once. A heading with the room to be one (15px above the 14px values it
 * governs, which is the order they should have been in), the section's own explanation under it
 * rather than as a paragraph the controls have to be read past, and a content column that stops
 * at 520px however wide the window gets. Time2book, ClickUp and Later's settings all converge on
 * this shape, and for the same reason: a settings page is read one section at a time.
 *
 * `desc` is optional because not every section has something to explain — Account is five facts
 * about you, and a sentence saying so would be furniture.
 *
 * The icon belongs here and nowhere else on this page. Nine of them once sat beside the 12px
 * field captions, where each one repeated a word that was already written ("Name", with a person
 * beside it) and put a second mark on every row. Six beside the 15px headings do the opposite
 * job: they mark where a section starts, which is what the eye looks for when it comes back to a
 * settings page for one thing. One rank carries a mark, and it is the rank that leads.
 */
export function CardSection({ heading, icon, subheading, desc, first, children }: { heading: string; icon?: React.ReactNode; subheading?: string; desc?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className="portal-settings-section" style={{ padding: "22px 24px", borderTop: first ? "none" : BORDER }}>
      <div>
        {/* <p>, not <h2>: nothing in Portal uses heading elements yet, and one lone h2 under no h1
            is not an outline. Giving Portal a real heading order is its own pass. */}
        <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "20px" }}>
          {icon && <span style={{ display: "flex", flexShrink: 0, color: "var(--gray-400)" }}>{icon}</span>}
          {heading}
        </p>
        {/* Whose settings these are, when that is not the same answer as the project on screen.
            Part of the title block rather than the sentence below it — a reader who mistakes the
            owner of a setting will not be saved by prose — but on its own line, because a 240px
            rail turns a 50-character institution name into three lines of 15px/800. */}
        {subheading && (
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.45, marginTop: "4px" }}>{subheading}</p>
        )}
        {desc && (
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.65, marginTop: "6px" }}>{desc}</p>
        )}
      </div>
      {/* 520px, not 1fr. The rail alone would still let a four-column grid of pairs open up on a
          wide screen — the cap is the half of this that holds at 1600px. */}
      <div style={{ minWidth: 0, maxWidth: "520px" }}>{children}</div>
    </div>
  );
}

/**
 * Two columns of label-above-value pairs, the shape the camera sheet uses.
 *
 * It was one ruled row per fact, label left and value right — five rules in the first card alone,
 * and on a 720px column the value ended up a hand's width from the word naming it. Stacking the
 * pair puts the two together, and two columns halve the height, so the rules have nothing left to
 * separate: whitespace does it.
 */
export function PairGrid({ children }: { children: React.ReactNode }) {
  return (
    /* Two columns, at 250px tracks.
   
       It went to one column when the page felt dense, and that was treating the symptom: the
       density was nine icons and a wall of 700-weight values, both now gone. What one column
       cost was height — six facts became six rows, and the page turned into a scroll for
       content that fits on a screen.
   
       250px rather than the old 220px, so the tracks are wider than the values that used to
       wrap into two lines at 240. A long team name still wraps; that is one pair wrapping, not
       a reason to halve the page's density. */
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "18px 20px" }}>
      {children}
    </div>
  );
}

/**
 * One fact, or one setting.
 *
 * A step larger than the camera sheet this pattern comes from — 12px caption over a 14px value,
 * where the sheet runs 11 over 13. The sheet is a dense popup read at a glance with a dozen facts
 * competing; this is a settings page with five, on a column with room to spare, and at 11px the
 * captions read as fine print on a page that has no fine print.
 *
 * No icon, and no bold on the value. Every pair used to carry a 12px glyph beside its 12px
 * caption, which put a second mark on a row whose first mark was already the word "Name" — nine
 * of them in the top two sections, none of them telling you anything the caption did not. With
 * every value at 700 on top of that, a page of six plain facts arrived looking like a form to be
 * filled in. 600 is still unmistakably the value against a grey caption; the weight above it now
 * belongs to the section heading, which is the thing that should be leading.
 *
 * None of the settings pages this was checked against (Later, Airtable, Lindy, Flodesk,
 * Time2book) puts an icon on a field label.
 */
export function PairItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: "12px", lineHeight: "16px", color: "var(--gray-500)" }}>{label}</p>
      {typeof children === "string"
        ? <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-900)", marginTop: "3px", wordBreak: "break-word" }}>{children}</p>
        : (
          /* flex, not a plain block: FilterSelect's trigger is inline-grid, so in a block it sits
             on a text baseline and inherits this column's 24px line height — about twenty pixels
             of leading above it that read as the control having drifted away from its own label.
             A flex container has no line box, so the gap is the 6px written here and nothing else. */
          <div style={{ display: "flex", marginTop: "6px" }}>{children}</div>
        )}
    </div>
  );
}


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
        /* 12px, matching the table below and the buttons beside it. A filter keeps its border —
           it is an input, and an input with no edge does not read as somewhere you can type or
           choose — but it should not be the smallest text on the screen while doing it. */
        fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit",
      }}
    >
      {label}
      <span style={{ display: "flex", color: "var(--gray-500)" }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.87" strokeLinecap="round"/></svg>
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
  return <Check size={size} strokeWidth={1.4} />;
}

/**
 * The metric card used above the Overview and the Input Sources tables: an eyebrow label, a tinted
 * icon badge, then whatever figure the caller puts under it.
 *
 * It lives here rather than in one of those pages because they are the same card and were briefly
 * two — the Input Sources strip was a single bordered box with three columns divided by rules,
 * which read as a different component doing the same job one screen over.
 */
export function MetricCard({ label, iconBg, iconColor, icon, accentBorder, dense, bare, value, chip, onClick, children }: {
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
   * No card at all: no ground, no edge, no shadow, no padding — just the label, the figure and
   * whatever is under them, sitting on the page.
   *
   * For metrics that are a header for the thing below rather than an object in their own right.
   * The Input Sources pair is that: two figures about the table underneath, which were wearing a
   * white box on a white page, so the only thing the box added was two more rectangles above a
   * screen that already has a toolbar and a table.
   */
  bare?: boolean;
  /**
   * Compact form for cards that sit directly above a table (Input Sources): the label and the
   * figure share one line, the bar sits under them, and padding drops to 12/14 — about half the
   * height of the dashboard form. What keeps these from eating the fold is their width, capped by
   * the caller, not the number of rows. Overview stays un-dense: its cards are the page, not a
   * header above one.
   */
  dense?: boolean;
  /** Dense only: the figure, placed on the label's line. */
  value?: React.ReactNode;
  /**
   * Makes the whole card the target.
   *
   * Each Overview card is a summary of exactly one tab, and it used to carry a small "Manage" link
   * in its corner to get there — a 40px target inside a 300px card that is entirely about that one
   * destination. With the card itself clickable the link is redundant, and the cards that never had
   * one become reachable too. Omitted by the Input Sources cards, which summarise the table
   * directly beneath them: there is nowhere to go.
   */
  onClick?: () => void;
  /**
   * A word for the state, beside the icon — "Healthy", "+12 this month", "2 portal · 4 app".
   *
   * The un-dense card leads with a number, and a number alone makes the reader do the judging:
   * 51 of 59 is good, 5 of 5 accounts is neither. The chip says which, in the place the eye lands
   * first. Only where there is something true to say; a card without one just has an icon there.
   */
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  const Icon = icon;
  const Tag = onClick ? "button" : "div";
  return (
    // The card's own gap is the space between the big value and the bar under it — 6, because the
    // number and the bar are one statement and 12 read as two. The eyebrow above and the footer
    // below each add 6 back, so those gaps stay where they were. Doing it here rather than per card
    // is what keeps every card on both pages identical.
    <Tag
      onClick={onClick}
      className={onClick ? "portal-card-clickable" : undefined}
      style={{
        ...(bare
          ? { backgroundColor: "transparent", border: accentBorder ?? "none", padding: 0 }
          : {
              backgroundColor: "white", border: accentBorder ?? CARD_BORDER,
              borderRadius: dense ? "12px" : "16px",
              // 12px top and bottom, 16 at the sides. These cards are five short lines — icon row,
              // label, figure, bar, captions — and every px of vertical padding is a px the panels
              // below lose. The sides keep 16 so text still starts where the card's own hairline
              // suggests it should.
              boxShadow: PANEL_SHADOW, padding: dense ? "12px 14px" : "12px 16px",
            }),
        display: "flex", flexDirection: "column", gap: dense ? "8px" : "4px", flex: 1, minWidth: 0,
        // A <button> brings its own centring, font and cursor; undo them so the clickable card is
        // pixel-identical to the static one.
        ...(onClick ? { textAlign: "left" as const, font: "inherit", cursor: "pointer", width: "100%" } : null),
      }}
    >
      {/* Dense keeps label and figure on one line. Un-dense opens with the icon at the left edge
          and the chip at the right one — the card's two ends. The chip used to sit against the
          icon, which read as a caption on it; at the far edge the four cards' chips line up in a
          column of their own, so "how is each of these doing" is one downward glance instead of
          four separate reads. */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between", marginBottom: dense ? 0 : (Icon || chip ? "8px" : "2px") }}>
        {!dense && Icon && (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: iconBg, color: iconColor, flexShrink: 0 }}>
            <Icon />
          </span>
        )}
        {!dense && chip}
        {/* Sentence case, not caps. The label carries multi-word names ("Portal Accounts &
            Permissions"), which all-caps at 10px turns into a block to decode rather than read —
            and toUpperCase() did nothing at all to the Korean strings, so the two languages were
            drawing two different headings. Same 12px/600/gray-500 as every other secondary line
            on these cards. */}
        {dense && <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</p>}
        {dense ? value : null}
      </div>
      {!dense && (
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "2px" }}>{label}</p>
      )}
      {/* Dense keeps the bar on its own line under the label and figure. It shared their line for
          a while, which was one row shorter but left the bar as long as whatever space the figure
          did not take — and the two cards' figures are different lengths, so the two bars came out
          different sizes. Under the text each one is the full width of its own card. */}
      {children}
    </Tag>
  );
}

// ── Sortable table headings ──────────────────────────────────────────────────

type SortDirection = "asc" | "desc";
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
          <path d="M5 8V2M5 2L2.4 4.6M5 2l2.6 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
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
export function ConfirmModal({ title, body, confirmLabel, cancelLabel, danger, confirmDisabled, altAction, onConfirm, onClose, children }: {
  title: string;
  body: string;
  /**
   * One field the confirmation needs, under the body.
   *
   * For the confirmations that are not purely yes/no — releasing somebody from the watchlist has to
   * record why, and a second dialog stacked on this one to ask a single question is a stack nobody
   * wants to be two deep in.
   */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button — for the ones that take access away or cannot be undone from the menu. */
  danger?: boolean;
  /**
   * Holds the confirm button shut until the `children` field says otherwise.
   *
   * For the one class of dialog where "are you sure" is not enough: deleting a project takes a
   * city's cameras and a watchlist of named people at once, and a red button is still one click.
   * The caller decides what unlocks it — typing the name back, in that case.
   */
  confirmDisabled?: boolean;
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
          {children}
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
          <button onClick={onConfirm} disabled={confirmDisabled}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none",
              backgroundColor: confirmDisabled ? "var(--gray-200)" : danger ? "var(--danger-400)" : "var(--gray-900)",
              color: confirmDisabled ? "var(--gray-400)" : "white",
              fontSize: "13px", fontWeight: 700, cursor: confirmDisabled ? "not-allowed" : "pointer",
            }}>
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
          {/* Only the rows this desk actually has. A missing number is dropped, not printed as a
              dash: a dash in a contact sheet reads as "there is one and we lost it", and the
              reader spends a moment looking for it. */}
          {SUPPORT_CONTACT.phone && row(t.phone, SUPPORT_CONTACT.phone)}
          {SUPPORT_CONTACT.hours && row(t.hours, SUPPORT_CONTACT.hours[lang])}
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
