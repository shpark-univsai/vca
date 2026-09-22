"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, EyeOff } from "lucide-react";
import { APP_ACTIONS, SUPPORT_CONTACT, canEditPortal, canSetPolicy, canViewFaces, currentPortalUser, useVcaStore, type AppAction, type AppScreen, type ProjectType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { APP_GRANT_LABELS } from "@/lib/appGrants";

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
 * The narrower gate: the handful of things an administrator may look at but not change.
 *
 * Separate hook rather than a flag on the one above, because the refusal is a different sentence.
 * "Read-only admins are view-only" is wrong on a screen an ADMIN is being turned away from, and a
 * control that greys out with no reason, or with the wrong one, reads as a bug.
 */
export function usePortalPolicyAccess(): { maySetPolicy: boolean; reason: string | undefined } {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const [lang] = usePortalLanguage();
  const me = currentPortalUser(portalUsers);
  const maySetPolicy = me ? canSetPolicy(me.permission) : true;
  if (maySetPolicy) return { maySetPolicy, reason: undefined };
  // An auditor cannot change anything at all, and hearing "owner only" invites them to go and ask
  // for the owner's help with something they would still not be allowed to do.
  const auditor = me ? !canEditPortal(me.permission) : false;
  return { maySetPolicy, reason: auditor ? READ_ONLY_REASON[lang] : OWNER_ONLY_REASON[lang] };
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
  en: { moreActions: "More actions", select: "Select", back: "Back", typeSmartCity: "Smart City", typeSmartSchool: "Smart School" },
  ko: { moreActions: "더 보기", select: "선택", back: "뒤로", typeSmartCity: "스마트시티", typeSmartSchool: "스마트스쿨" },
} as const;

/** Why a control is disabled, said in the role's own words rather than "no permission". */
const READ_ONLY_REASON = {
  en: "Read-only admin accounts have view-only access to this console.",
  ko: "읽기 전용 관리자 계정은 이 콘솔을 보기만 할 수 있습니다.",
} as const;

/** Why an ADMINISTRATOR — who may change almost everything here — is refused this one. */
const OWNER_ONLY_REASON = {
  en: "Only the owner can do this. It changes what this installation is contracted to, not how it is configured.",
  ko: "최고관리자만 할 수 있습니다. 설정이 아니라 이 설치본의 계약 내용을 바꾸는 일입니다.",
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
 * The gap between a toolbar and the table it narrows.
 *
 * SMALL ON PURPOSE. A search box, some filters and the list they act on are one thing, and the
 * distance that carries meaning on these pages is the one ABOVE the toolbar — where the summary
 * cards end and the list begins. Seven tabs had picked 16, 12 and 10 independently, so the same
 * three-part page attached itself slightly differently every time a reader moved between them.
 */
export const TOOLBAR_GAP = "10px";

/**
 * The search field at the left end of a toolbar.
 *
 * One rule, because five had grown: two tabs let it stretch with no ceiling, one capped it with no
 * floor, and two more picked different floors. A field that starts at a different width on every
 * screen makes the toolbar look re-laid-out each time rather than the same row doing the same job.
 *
 * The cap matters more than the floor. Unbounded, the field ate the empty middle of the row and
 * left the actions stranded at the far edge; a search box wider than the longest thing anybody
 * types is width spent on nothing.
 */
export const SEARCH_FIELD: React.CSSProperties = { flex: 1, minWidth: "200px", maxWidth: "320px" };

/**
 * THE SEARCH BOX, ONCE.
 *
 * Six screens had their own: four hand-rolled the magnifier and the focus ring, two used a bare
 * TextField with no icon at all, and NONE of them could be cleared without selecting the text and
 * deleting it. The only way back to the whole list was the Servers page's own 초기화 button —
 * one screen out of six (owner, 2026-09-18: 초기화가 서버 페이지에만 있거든).
 *
 * THE × LIVES IN THE FIELD, which is the owner's other suggestion and the better of the two: it
 * clears the thing it sits inside, it appears only when there is something to clear, and it needs
 * no space in a toolbar that already holds nine controls. A separate 초기화 button has to decide
 * what it resets — this box, or the filters too — and the filters already carry their own clear
 * (see ActiveFilterCount).
 *
 * Escape clears it too, because a search box that has swallowed the key everywhere else in the
 * product is a search box people press Escape in.
 */
const CLEAR_T = { en: "Clear", ko: "지우기" } as const;

export function SearchInput({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Merged over SEARCH_FIELD, for the odd screen that needs a different width. */
  style?: React.CSSProperties;
}) {
  const [lang] = usePortalLanguage();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", ...SEARCH_FIELD, ...style }}>
      <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex", pointerEvents: "none" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === "Escape" && value !== "") { e.stopPropagation(); onChange(""); } }}
        style={{
          // 12 + 14 (icon) + 6 = 32 on the left, so the icon's gap is on the spacing scale too;
          // the same on the right while the clear button is there, and 12 when it is not — a
          // permanent 32px gutter on the right makes every empty field look indented.
          ...FIELD_STYLE, padding: value === "" ? "0 12px 0 32px" : "0 30px 0 32px",
          ...(focused ? FIELD_FOCUS : null),
        }}
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={CLEAR_T[lang]}
          title={CLEAR_T[lang]}
          style={{
            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "18px", height: "18px", borderRadius: "50%", border: "none",
            backgroundColor: "var(--gray-100)", color: "var(--gray-500)", cursor: "pointer", padding: 0,
          }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </button>
      )}
    </div>
  );
}

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
/**
 * How wide a paragraph is allowed to get before the eye loses the line.
 *
 * In `em`, not `ch`, and that is the whole point. `ch` is the width of "0" — a Latin measure —
 * so `maxWidth: MEASURE` asks for 62 Latin characters and gets about 31 Korean ones, because a
 * Hangul syllable is roughly twice that box. Every capped paragraph in Portal was therefore half
 * as long in Korean as it was meant to be, wrapping early and leaving the space beside it empty.
 *
 * `em` lands near the right answer in both: one em is about one Hangul syllable and about 1.8
 * Latin characters, so 38em reads as ~38 Korean characters or ~68 Latin ones. It also tracks the
 * element's own font size, which `ch` does too but a px cap would not — an 11px hint and a 13px
 * lead get the same number of characters rather than the same number of pixels.
 *
 * Two values, not seven. The caps in place ranged 46–80ch, and that spread was drift rather than
 * seven decisions: they are all either a paragraph somebody reads or a note somebody glances at.
 */
/**
 * The body of a table that has no rows to show.
 *
 * INSIDE the table card, under its column headings — not a separate card standing where the table
 * would be. The two read as different situations: a card of its own says "there is no table here",
 * which is wrong, because the headings above it are the table and they are still true.
 *
 * ONE LINE. A second line under an empty state is a rule this product settled on, and four tables
 * were breaking it with a hint nobody needed — the heading already says what is missing, and the
 * toolbar above says what would change it.
 *
 * `reason` is for the case that is genuinely a different sentence: nothing matched the filters, as
 * opposed to nothing exists. A reader who has narrowed a list and sees "nothing registered yet"
 * concludes the registry is empty rather than that their filter is.
 */
export function TableEmpty({ text }: { text: string }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-500)" }}>{text}</p>
    </div>
  );
}

/**
 * The pager every long list uses.
 *
 * Extracted from Server & API, where it was forty lines of inline JSX, because the VIP registry
 * needed the same thing (owner's ask, 2026-09-18: "vip 등록화면에 무한스크롤인데, 페이지네비가
 * 있어야할것같아") and two copies of a pager is two places that drift.
 *
 * WINDOWED, unlike the copy it came from. That one printed a button per page, which is fine for
 * six servers and wrong for a hundred and twenty-two people — thirteen buttons is a second
 * toolbar. First and last are always reachable, the current page keeps a neighbour on each side,
 * and the gaps say so with an ellipsis.
 *
 * Client-side paging, and that is not the same as the server paging the handover asks for: the
 * rows are all in memory either way. When the API starts returning pages, this component stays
 * and the caller changes what it slices — see HANDOFF-SERVER §9.
 */
/** Nearest ancestor that actually scrolls — what "the first screen" is measured against. */
function scrollingAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Picks the starting rows-per-page so the pager is ON THE FIRST SCREEN.
 *
 * Owner's ask (2026-09-18): somebody opening the registry for the first time should SEE the pager
 * without scrolling, so they learn that the list is paged and that the page size is theirs to
 * change. A default of 25 buries it — 25 rows is 1700px of table on a screen that has ~600px for
 * rows.
 *
 * MEASURED AGAINST THE SCROLLER, AND THEN CHECKED. The first version read the window's height in
 * a microtask after mount and trusted the answer. Both halves were wrong: the microtask runs
 * before the tabs, the summary cards and the toolbar have taken their places, so the list's top
 * measured ~150px higher than where it ends up, and the window is not what scrolls — the shell's
 * own scroll box is, and it has padding of its own under the pager. The two errors compounded to
 * about two and a half rows, so the pager it was supposed to reveal sat just off the bottom and
 * scrolling to reach it dragged rows under the pinned header (owner's report: "스크롤하면 이렇게
 * 되네").
 *
 * So: wait two frames for layout to settle, measure the gap between the list's top and the
 * scroller's, and then VERIFY — if the scroller still overflows, take off exactly as many rows as
 * the overflow is worth and look again. At most three passes, and the check is what makes the
 * promise true rather than approximately true.
 *
 * It stops the moment the reader picks a size: a default that keeps recomputing would move the
 * ground under somebody who has already chosen. It does not follow window resizes either.
 */
export function useFitRowsPerPage(rowHeight: number, steps: number[] = [25, 50, 100]) {
  const listRef = useRef<HTMLDivElement>(null);
  const [rowsPerPage, setRows] = useState(steps[0]);
  const [fitted, setFitted] = useState<number | null>(null);
  const chosen = useRef(false);
  /* 0 = nothing measured yet, 1-2 = correcting, 3 = settled. Caps the loop: a list that cannot be
     made to fit (a short window, a tall toolbar) stops at the floor instead of shrinking forever. */
  const pass = useRef(0);

  /* A page of three rows on a tiny window is not a list — under this the reader is better off
     scrolling a little. Above, never more than the first step: past that the pager is off screen
     again and the point of measuring is lost.
     It was eight, which is two rows more than a 800px window can hold with the tabs, the cards
     and the toolbar above the table — so the floor itself pushed the pager off screen, which is
     the one thing this hook exists to prevent. */
  const MIN_ROWS = 5;

  useEffect(() => {
    if (chosen.current || pass.current >= 3) return;
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    let frames = 0;
    const measure = () => {
      if (chosen.current) return;
      // Two frames, not a microtask: the microtask runs inside the same commit that mounted the
      // tree, before the rows above this one have been laid out.
      if (frames < 2) { frames += 1; raf = requestAnimationFrame(measure); return; }
      const sp = scrollingAncestor(el);
      if (!sp) { pass.current = 3; return; }
      if (pass.current === 0) {
        // What is left under the list's top edge, inside the box that scrolls: minus the card's
        // own heading strip and minus everything below the rows — the pager's row and the
        // scroller's bottom padding.
        const gap = el.getBoundingClientRect().top - sp.getBoundingClientRect().top;
        const HEAD = 36, PAGER_ROW = 44, BOTTOM_PAD = parseFloat(getComputedStyle(sp).paddingBottom) || 32;
        const room = sp.clientHeight - gap - HEAD - PAGER_ROW - BOTTOM_PAD;
        const fits = Math.max(MIN_ROWS, Math.min(steps[0], Math.floor(room / rowHeight)));
        pass.current = 1;
        setFitted(fits);
        setRows(fits);
        return;
      }
      /* WHAT HAS TO BE ON SCREEN IS THE PAGER, NOT THE LAST PIXEL OF THE PAGE. Below the pager
         sit its own bottom margin and the scroller's bottom padding — empty ground. Counting
         those as overflow costs a whole row to reveal nothing, so they are slack. */
      const slack = (parseFloat(getComputedStyle(sp).paddingBottom) || 32) + 8;
      const over = sp.scrollHeight - sp.clientHeight - slack;
      if (over > 1 && rowsPerPage > MIN_ROWS) {
        pass.current += 1;
        const next = Math.max(MIN_ROWS, rowsPerPage - Math.ceil(over / rowHeight));
        setFitted(next);
        setRows(next);
        return;
      }
      pass.current = 3;
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [rowHeight, steps, rowsPerPage]);

  /** Wrap the caller's setter so the reader's choice wins from then on. */
  const setRowsPerPage = (n: number) => { chosen.current = true; pass.current = 3; setRows(n); };
  /* The fitted number joins the menu, because it is the default: a select whose current value is
     not one of its options reads as broken. Deduplicated and sorted, so a window that happens to
     fit exactly 25 does not list 25 twice. */
  const perPageOptions = [...new Set([...(fitted === null ? [] : [fitted]), ...steps])].sort((a, b) => a - b);
  return { listRef, rowsPerPage, setRowsPerPage, perPageOptions };
}

export function TablePagination({ total, page, rowsPerPage, onPage, onRowsPerPage, perPageOptions = [10, 25, 50, 100] }: {
  total: number;
  page: number;
  rowsPerPage: number;
  onPage: (page: number) => void;
  onRowsPerPage: (rows: number) => void;
  perPageOptions?: number[];
}) {
  const [lang] = usePortalLanguage();
  const t = PAGER_T[lang];
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const current = Math.min(page, totalPages);
  const rangeStart = (current - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(total, current * rowsPerPage);

  // Every page while they fit, and only then a window. At five pages the windowed form printed
  // "1 2 … 5", which hides two pages to save nothing — the ellipsis has to be earning its place.
  const pages: (number | null)[] = [];
  const wanted = totalPages <= 7
    ? new Set<number>(Array.from({ length: totalPages }, (_, i) => i + 1))
    : new Set<number>([1, totalPages, current - 1, current, current + 1]);
  for (let n = 1; n <= totalPages; n++) {
    if (!wanted.has(n)) continue;
    if (pages.length > 0 && n - (pages[pages.length - 1] as number) > 1) pages.push(null);
    pages.push(n);
  }

  const arrow = (dir: "prev" | "next") => {
    const disabled = dir === "prev" ? current === 1 : current === totalPages;
    return (
      <button
        onClick={() => onPage(dir === "prev" ? Math.max(1, current - 1) : Math.min(totalPages, current + 1))}
        disabled={disabled}
        title={dir === "prev" ? t.prev : t.next}
        style={{
          width: "28px", height: "28px", borderRadius: "8px", border: BORDER, backgroundColor: "white",
          color: disabled ? "var(--gray-300)" : "var(--gray-600)", cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d={dir === "prev" ? "M9 2.9L4.5 7l4.5 4.1" : "M5 2.9L9.5 7l-4.5 4.1"} stroke="currentColor" strokeWidth="1.63" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    );
  };

  return (
    /*
     * Space over it, less under it, and the row aligned to its BOTTOM edge.
     *
     * Two notes from the owner pulled in opposite directions and both were right: the page buttons
     * needed room under them ("바로아래 공간이 너무 좁아") and the range text needed less
     * ("이거는 아래 표랑 지금보다 더 가까워도될것같을"). They are in one row, so a single margin
     * cannot do both — `flex-end` can. The 28px controls and the 16px line now share a bottom
     * edge, which lifts the text's own gap to the table by the difference and leaves the buttons
     * where they were. The text then reads as the table's caption, sitting just above it.
     */
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "12px 0 8px", flexWrap: "wrap", gap: "10px" }}>
      <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.showing(rangeStart, rangeEnd, total)}</p>
      {/*
       * ONE CONTROL AT THE RIGHT END, after Employment Hero's table footer — `‹ 1 › 20 / page`.
       * (Owner's ask, 2026-09-18: find the combined pattern rather than putting two next to each
       * other.) Mobbin was read for this: Vapi keeps `Previous · Page 1 of 1 · Next` apart from
       * `Rows per page: 25`, Navattic splits them to opposite corners, Xero writes the whole thing
       * as a sentence, Neon compresses it to `1-6 of 6 ‹ › [1]`. Employment Hero's is the one that
       * merges them, and the merge is the LABEL: the unit moves inside the select, so `25 / 페이지`
       * needs no "Rows per page:" beside it and the two controls read as one group.
       *
       * The numbered buttons stay — Employment Hero shows one page box because its list is short;
       * at five pages the numbers are worth having, and they window past seven.
       */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {arrow("prev")}
        {pages.map((n, i) => (n === null ? (
          <span key={`gap-${i}`} style={{ width: "20px", textAlign: "center", fontSize: "12px", color: "var(--gray-300)" }}>…</span>
        ) : (
          <button key={n} onClick={() => onPage(n)}
            style={{
              minWidth: "28px", height: "28px", padding: "0 6px", borderRadius: "8px", border: "none", cursor: "pointer",
              backgroundColor: n === current ? "var(--gray-900)" : "transparent",
              color: n === current ? "white" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
            }}>
            {n}
          </button>
        )))}
        {arrow("next")}
      </div>
      <FilterSelect value={String(rowsPerPage)} onChange={v => { onRowsPerPage(Number(v)); onPage(1); }}
        options={perPageOptions.map(n => ({ value: String(n), label: t.perPage(n) }))} fitContent />
      </div>
    </div>
  );
}

const PAGER_T = {
  en: {
    showing: (a: number, b: number, total: number) => `Showing ${a}–${b} of ${total}`,
    perPage: (n: number) => `${n} / page`,
    prev: "Previous page",
    next: "Next page",
  },
  ko: {
    showing: (a: number, b: number, total: number) => `전체 ${total}건 중 ${a}–${b}건 표시`,
    perPage: (n: number) => `${n} / 페이지`,
    prev: "이전 페이지",
    next: "다음 페이지",
  },
} as const;

export const MEASURE = "38em";
export const MEASURE_TIGHT = "30em";

export const PANEL_SHADOW = "0 1px 2px rgba(24,17,39,0.03), 0 1px 3px rgba(24,17,39,0.03)";

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

export interface RowAction {
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
   * an administrator does not memorise what "Read-only admin" grants, they read the sentence at the moment
   * they pick it. Jira, StackAI and Vanta all put the sentence in the dropdown for the same reason.
   */
  description?: string;
}

// Custom dropdown for filter selects — a native <select>'s popup is positioned by the browser,
// and inside this app's nested-scroll shell (PortalShell's outer overflow:hidden + inner
// overflow:auto content area) that positioning can land the popup far from its trigger. Ported
// from the main VCA app's SimpleSelect (DataPage.tsx) to match its exact look and behavior.
export function FilterSelect({ value, onChange, options, fitContent, footerAction, onOpenChange, active }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /**
   * Told when the list opens and closes, for a parent that also listens for Escape.
   *
   * Both this and a dialog around it bind Escape, and both fire on the same keypress — so closing
   * the list took the dialog with it. Reproduced in the browser: open Portal 역할 변경, open the
   * list, press Escape, and the whole dialog goes. The parent suspends its own handler while this
   * is open; see ConfirmModal's escapeSuspended.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * True while this control is NARROWING something (owner: 위에 필터 선택했을때 약간 달라져야
   * 할것같아).
   *
   * A prop rather than a guess: this component is also a form field — 권한, 서버 유형, 부서 —
   * where every value is an answer and none of them is "off". Only the caller knows whether its
   * current value means "not filtering", so only the caller can say when the control is on.
   *
   * Grey, not purple: the page's exception chips already mark "this filter is applied" with the
   * gray-900 vocabulary, and purple is kept for what asks to be pressed.
   */
  active?: boolean;
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
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

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
          ...(open
            ? FIELD_FOCUS
            /* A filter that is on holds the darker edge and a tinted ground, so a toolbar tells you
               the table is narrowed without reading every label. Hover still lightens on top. */
            : active
            ? { border: PICKED_LINE, backgroundColor: PICKED_FILL }
            : { border: hovered ? "1px solid var(--gray-400)" : BORDER }),
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
          backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "var(--shadow-popover)",
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
export function RowActionsMenu({ actions, variant = "row", label }: {
  actions: RowAction[];
  /**
   * Where the trigger is standing, which is the only thing that differs.
   *
   * "row" is the bare kebab a table row carries. "toolbar" is the same menu behind a control that
   * has to line up with the buttons beside it — same height, same quiet chrome — because a 16px
   * dot column next to 34px buttons reads as a rendering fault rather than a control.
   *
   * One component, two triggers, rather than a second menu: the panel, the hover state, the
   * escape and click-outside handling and the footnote that explains greyed items are the parts
   * worth not writing twice.
   */
  variant?: "row" | "toolbar";
  /** Toolbar only, and optional: a word beside the dots where the menu needs naming. */
  label?: string;
}) {
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

  const toolbar = variant === "toolbar";
  return (
    <div ref={ref} style={{ position: "relative", justifySelf: toolbar ? undefined : "end", flexShrink: 0 }}>
      <button
        className={toolbar ? "portal-btn-quiet" : undefined}
        onClick={() => setOpen(o => !o)}
        title={SHARED_LABELS[lang].moreActions}
        aria-label={SHARED_LABELS[lang].moreActions}
        style={toolbar
          // Padding, not a fixed height, and an 18px glyph below rather than the row's 16: the
          // buttons this sits beside are sized by their own padding around 18px of content, so
          // 10 + 18 + 10 lands on their 38px exactly. CONTROL_HEIGHT (36) and a 16px glyph both
          // came up two pixels short.
          ? { display: "flex", alignItems: "center", gap: "6px", padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }
          : { border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "4px", borderRadius: "6px" }}
      >
        <svg width={toolbar ? 18 : 16} height={toolbar ? 18 : 16} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3.3" r="1.3" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.3" fill="currentColor"/>
          <circle cx="8" cy="12.7" r="1.3" fill="currentColor"/>
        </svg>
        {toolbar && label}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 50,
          backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "var(--shadow-popover)",
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
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{reason}</p>
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
    /*
      SEPARATE CARDS, not one slab with dividers between the cells.
      
      Fused, the four numbers read as one object — a strip of the page rather than four facts, and
      nothing in it could be weighted differently from anything else. Every comparable console
      draws them apart (Deel, Clerk, Mixpanel, StackAI), and the gap is what lets a cell carry its
      own state: an amber cell now tints a card instead of staining part of a shared panel.
      
      No overflow:hidden anywhere. It used to clip the one thing that has to escape — the
      explanation tooltip, which hangs below its label.
    */
    <div style={{
      display: "flex", alignItems: "stretch", flexWrap: "wrap", gap: "10px",
      marginBottom: "20px",
    }}>
      {cells.map(cell => {
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
                <span style={{ fontSize: "24px", fontWeight: 800, color: accent, lineHeight: "26px", letterSpacing: "-0.5px" }}>{cell.figure}</span>
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
          </>
        );
        /*
          The mark, on the left in a tinted square — the same shape the Overview cards use.
          
          It used to be pushed to the far right by space-between, which was invisible while the
          cells were narrow slices of one strip. As separate cards each one is ~320px wide holding
          ~100px of text, so the icon ended up stranded against the right edge with a void between
          it and the number it belongs to. Beside the figure it reads as part of it.
        */
        const mark = (
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            width: "30px", height: "30px", borderRadius: "9px", color: markColor,
            backgroundColor: cell.tone === "warning" ? "var(--warning-100)" : "var(--gray-100)",
          }}>{cell.icon}</span>
        );
        const shared: React.CSSProperties = {
          /* Grows to share a row with its neighbours, but a LONE cell stops at what it holds —
             a 1,144px card around one figure reads as a panel that failed to load its other
             three. `flex: 1` with no siblings did exactly that on the users page once the
             exception counts left the strip for a line of chips. */
          flex: "1 1 auto", maxWidth: "min(100%, 420px)", minWidth: "148px",
          display: "flex", alignItems: "center", gap: "12px",
          // Roomier than it was (10px 18px). These are the page's headline numbers and they were
          // wearing the padding of a table row.
          padding: "14px 18px",
          backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px",
          // No dividers and no end-cap corners any more: the gap between the cards separates them,
          // and every card carries all four of its own corners.
        };
        return cell.onClick ? (
          <button
            key={cell.key}
            onClick={cell.onClick}
            title={cell.title}
            className="portal-attention-row"
            style={{
              ...shared,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              // The selected cell is tinted rather than outlined: "this filter is on" is a state
              // of the card, not an annotation on its label. The tint follows the tone — an amber
              // wash under a cell that is not raising a defect would report a fault it never
              // claimed. Unselected keeps the card's own white; it used to be `transparent`, which
              // was invisible while the cells were fused inside one white panel and is a hole in
              // the row now that each one is its own card.
              backgroundColor: cell.active
                ? (cell.tone === "warning" ? "var(--warning-100)" : "var(--gray-100)")
                : "white",
            }}
          >
            {mark}
            {body}
          </button>
        ) : (
          <span key={cell.key} style={shared}>{mark}{body}</span>
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
export function CardSection({ heading, icon, subheading, desc, hint, children }: { heading: string; icon?: React.ReactNode; subheading?: string; desc?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="portal-settings-section" style={{ padding: "26px 28px 28px" }}>
      <div>
        {/* <p>, not <h2>: nothing in Portal uses heading elements yet, and one lone h2 under no h1
            is not an outline. Giving Portal a real heading order is its own pass.
        
            18px against the 15px values under it. It was 15/800 over 15/600 — two weights of the
            same size, which is not a rank, and the page read as one long even list with no idea
            where it began. The heading is now the only thing on the card at this size, which is
            what makes the rest of it settle into place under it.
        
            The icon sits in a tinted square rather than loose beside the words: a 15px glyph next
            to 18px text is a speck, and the square gives the section a mark the eye can find from
            the rail it was clicked in. */}
        <p style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "24px", letterSpacing: "-0.2px" }}>
          {icon && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              width: "28px", height: "28px", borderRadius: "9px",
              backgroundColor: "var(--gray-50)", border: BORDER, color: "var(--gray-600)",
            }}>{icon}</span>
          )}
          {heading}
          {/* `hint` rather than `desc` for the explanatory half — the sentence worth having but
              not worth a line of the page on every visit. `desc` stays for what has to be read
              without asking: a warning, or a sentence about what the screen does NOT do. */}
          {hint && <HelpTip text={hint} />}
        </p>
        {/* Indented to the heading's own text, past the icon. Flush left, these ran under the
            icon square and the three lines had no shared edge — a title, a name and a sentence
            all starting in different places, which is what made the block read as crowded rather
            than as one heading with two lines under it. The square now marks the whole block.

            The steps matter as much as the space: 18 / 13 / 12 with 8px and 10px between them.
            It was 15 / 12 / 12 at 4px and 6px, where the second and third lines were the same
            size and the two gaps were the same gap, so all three collapsed into one paragraph. */}
        {(subheading || desc) && (
          <div style={{ paddingLeft: icon ? "38px" : 0 }}>
            {/* Whose settings these are, when that is not the same answer as the project on
                screen. Part of the title block rather than the sentence below it — a reader who
                mistakes the owner of a setting will not be saved by prose — but on its own line,
                because a 50-character institution name beside an 18px/800 heading wraps. */}
            {subheading && (
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.45, marginTop: "8px" }}>{subheading}</p>
            )}
            {desc && (
              <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: subheading ? "10px" : "8px" }}>{desc}</p>
            )}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/**
 * A column of label-above-value pairs, the shape the camera sheet uses.
 *
 * It was one ruled row per fact, label left and value right — five rules in the first card alone,
 * and on a 720px column the value ended up a hand's width from the word naming it. Stacking the
 * pair puts the two together, so the rules have nothing left to separate: whitespace does it.
 */
export function PairGrid({ children }: { children: React.ReactNode }) {
  return (
    /* One column (2026-09-11).
   
       It was two 250px tracks, which was the right call while the card was the page and height
       was the scarce thing. It is not any more: the section titles moved to a rail of their own,
       so the card is narrower and a section is arrived at deliberately rather than scrolled past.
       Two tracks in that column put the second pair where the eye does not go, and a settings
       page with six facts was never short of room — it was short of a reading order.
   
       One column gives it one: label, value, next. Height it costs is height the rail already
       made navigable. */
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "16px" }}>
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
export function PairItem({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      {/* Three tones down the pair, not two: gray-500 name, gray-900 value, gray-400 note.
          The label and the note were both 11px gray-400, sitting above and below the same control
          — the same size and the same colour doing two different jobs, so neither said which it
          was. The name of a field is something you read to find the control; the sentence under
          it is something you read once. Now the name is the darker of the two and carries the
          weight, and the note is the lightest thing in the pair. */}
      <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px", lineHeight: "15px", color: "var(--gray-500)" }}>
        {label}
        {/* The sentence about this field, on the mark rather than under the control. It was a
            line of 11px grey below the input, which put a second caption in the pair — the name
            above and an explanation below, the same size, doing different jobs. The mark keeps
            the sentence reachable without letting it take a line of the page on every visit. */}
        {hint && <HelpTip text={hint} size={13} />}
      </p>
      {typeof children === "string"
        ? <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)", marginTop: "4px", wordBreak: "break-word" }}>{children}</p>
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
        /* A PILL, not an 8px box (owner, 2026-09-21: 켜고 끄는 토글이 약간 각진데). The knob
           inside has always been a full circle, so a track with 8px corners put a round thing in a
           squarish slot — which is what read as angular. 999px makes the track's ends the same
           curve as the knob that travels between them. 8px is this console's BUTTON radius; a
           switch is not a button, and nothing else in Portal draws one. */
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
        boxShadow: "0 1px 3px rgba(24,17,39,0.3)", transition: "left 0.15s",
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
  // The stroke attribute has to be derived, not typed: `Check` is a lucide glyph, so its 24-unit
  // box is scaled down to whatever px the caller asks for and a literal 1.4 arrived on screen at
  // 0.8-0.9px — a tick visibly lighter than the FilterSelect tick that means the same thing.
  // ICON_STROKE_PX above carries the arithmetic; doing it here means every caller's size is right,
  // including ones added later.
  return <Check size={size} strokeWidth={(ICON_STROKE_PX * 24) / size} />;
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
 * One collator for every sorted table in Portal.
 *
 * `"ko"` is pinned, and the locale matters less than the pinning. `localeCompare()` with no
 * locale asks the runtime for its default — Node takes it from its ICU build, a browser takes it
 * from the operating system — so the server and the machine that hydrates it can disagree about
 * the order of the same rows, and React then reconciles a list it rendered in one order against
 * a list it is being told is in another. The names are what make it real: ASCII dates sort the
 * same under every locale, which is why this has been quiet, and it activates the first time a
 * Korean name lands in a table. The roster and camera imports built today are exactly that path.
 *
 * `numeric` so CAM-2 comes before CAM-10, which is the order a person reading a camera register
 * means. `sensitivity: "base"` so case and accents do not split a name away from its neighbours.
 */
const TABLE_COLLATOR = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/**
 * Sorts by the value `valueOf` returns for each row. Strings compare through TABLE_COLLATOR so
 * Korean and English names both land where a reader expects; everything else compares numerically.
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
    if (typeof av === "string" && typeof bv === "string") return TABLE_COLLATOR.compare(av, bv) * factor;
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
  /** Both optional, because a heading with no sortKey never reads them — a table whose columns do
   *  not sort at all had to invent a sort state to render its headings, and an invented one is a
   *  value somebody will eventually believe. */
  sort?: SortState<K>;
  onToggle?: (key: K) => void;
  /** Right for a column whose cells are right-aligned — a heading that stays left while its data
   *  sits at the other end of the cell reads as two different columns. */
  align?: "left" | "right";
}) {
  const [hovered, setHovered] = useState(false);
  // Sentence case and no tracking, for the reason written out on MetricCard's label above: caps and
  // letter-spacing are a Latin-only device. toUpperCase() leaves a Korean heading untouched while
  // the 0.4px still spreads the syllables apart, so one component was drawing two different
  // headings depending on the language — and loose Hangul reads as unfinished, not as an eyebrow.
  // The colour and the 10px already separate a heading from its rows; the caps were never what did.
  const headingStyle = { fontSize: "10px", fontWeight: 600 } as const;
  const justify = align === "right" ? "flex-end" : "flex-start";

  // A heading is plain when it has no key to sort by — and also when the table gave it no sort
  // state to read, which is how a table with no sorting at all uses this.
  if (!sortKey || !sort || !onToggle) {
    return <span style={{ ...headingStyle, color: TABLE_HEADER_COLOR, display: "flex", justifyContent: justify }}>{label}</span>;
  }

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
      {label}
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
 * EVERY CONFIRMATION IN PORTAL IS THIS ONE NOW (2026-09-22). Five used to be hand-drawn copies —
 * ProjectRosterTab's Issue and Remove, ProjectVipTab's Remove, ProjectCamerasTab's offline-mark and
 * bulk-delete — and they proved why that costs: when this component's confirm button changed
 * colour, none of the five followed, and two of them had no Escape key at all. A confirmation that
 * needs one extra element takes `children`; that is what the slot is for (the VIP one puts the
 * person's photo there, the roster one its expiry line). If a sixth is ever written by hand, this
 * paragraph is the reason not to.
 */
export function ConfirmModal({ title, body, confirmLabel, cancelLabel, danger, confirmDisabled, altAction, onConfirm, onClose, escapeSuspended, bodyScrolls, children }: {
  title: string;
  body: string;
  /**
   * One field the confirmation needs, under the body.
   *
   * For the confirmations that are not purely yes/no — releasing somebody from the VIP registry has to
   * record why, and a second dialog stacked on this one to ask a single question is a stack nobody
   * wants to be two deep in.
   */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Red confirm button — for the ones that CANNOT BE UNDONE. Not for the ones that merely weigh a
   * lot.
   *
   * The "or takes access away" half of this sentence used to be here, and it let a suspend dialog
   * go red while its own body said 삭제되는 것은 없습니다 … 되돌릴 수 있습니다 — the colour and the
   * words disagreeing inside one card. Checked against every call site: each remaining red confirm
   * destroys something (project, camera, category, server, VIP group, team, account). Suspension is
   * reversible from the very menu row it was started from, so it is not one of them.
   *
   * A dialog that is red for weight rather than for permanence spends the colour, and then the one
   * that really cannot be undone arrives looking the same.
   */
  danger?: boolean;
  /**
   * Holds the confirm button shut until the `children` field says otherwise.
   *
   * For the one class of dialog where "are you sure" is not enough: deleting a project takes a
   * city's cameras and a VIP registry of named people at once, and a red button is still one click.
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
  /**
   * Hold Escape while something inside this dialog is using it — an open select, say.
   *
   * Escape handlers stack: the select's and this one both fire on one keypress, so dismissing the
   * list dismissed the whole dialog and the administrator lost the change they were part-way
   * through. Same shape as the category-retire and team-switch confirmations fixed earlier today;
   * this is the third, and it is the generic one every ConfirmModal caller inherits.
   */
  escapeSuspended?: boolean;
  /**
   * Cap the card at the window and scroll the middle — the buttons stay on screen.
   *
   * OPT-IN, and it has to stay opt-in. overflow-y makes a clipping context, and a FilterSelect
   * inside the body opens as an absolutely positioned list, so a body that scrolls cuts the list
   * off at its own edge — the same trap MODAL_BODY_WITH_SELECT exists to keep the invite modal out
   * of. AccessChangeModal's picker is exactly that case and says so, so this is off unless a
   * caller asks.
   *
   * Who asks: the dialogs whose `children` grow past a short laptop window. Deleting a project
   * stacks a body, three counts, a warning about the team's last project and a field to type the
   * name back into — taller than 600px of viewport once the English wraps, and what goes off the
   * bottom is the Cancel button and the red one. A dialog you can neither finish nor call off is
   * worse than either answer.
   */
  bodyScrolls?: boolean;
}) {
  useEscapeKey(onClose, !escapeSuspended);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      {/* The cap is on the CARD and the scroll is on the body, so the footer is outside the scroll
          region and cannot leave the screen. Both halves are spread in only when asked: with the
          prop off the card and the body carry exactly the styles they always did, which is what
          keeps every existing caller's layout where it was. 32px is the backdrop's own padding. */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "var(--shadow-modal)",
        ...(bodyScrolls ? { maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column" } : null) }}>
        {/* minHeight 0 alongside the overflow: a column flex item's default min-height is its
            content, so without it the body refuses to shrink and the cap above does nothing. */}
        <div style={{ padding: "20px", ...(bodyScrolls ? { overflowY: "auto", minHeight: 0 } : null) }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.5 }}>{body}</p>
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
        {/* flexShrink 0 so the row of buttons keeps its full height when the card is capped. Inert
            with `bodyScrolls` off — the card is not a flex container then, and flex-shrink means
            nothing outside one — so it costs the other callers nothing. */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0 }}>
          {/* The same ghost cancel the panels use — two bordered buttons side by side read as two
              equal choices, which is the one thing a confirmation must not say. */}
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
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
              /* PURPLE, LIKE EVERY OTHER COMMITTING ACTION (owner: 중앙모달에만 엑션버튼들이
                 검정색이야?). It was gray-900 while the panels' primary is primary-400 — the same
                 weight of decision wearing two colours depending on which container it landed in.
                 Danger stays red: that one is not a colour choice, it is the warning. */
              backgroundColor: confirmDisabled ? "var(--gray-200)" : danger ? "var(--danger-400)" : "var(--primary-400)",
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
 * The question mark that carries a sentence the screen does not need to keep saying.
 *
 * For the intro paragraph a tab wants available but not permanently in the way — the kind that is
 * read once, on the first visit, and then costs a line of vertical space and a line of attention
 * on every visit after. Hiding it behind a mark keeps it reachable without letting it compete with
 * the controls beside it.
 *
 * Not for anything a reader has to see: a warning, or a sentence about what the screen does NOT
 * do, has to be on the screen. This is for the explanatory half.
 *
 * A <button>, not a span with a cursor — it takes keyboard focus, which is what makes Tooltip's
 * onFocus path reachable at all.
 */
export function HelpTip({ text, placement = "bottom", size = 18 }: { text: string; placement?: "top" | "bottom"; size?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Tooltip text={text} placement={placement}>
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={e => e.preventDefault()}
        style={{
          // Sized to what it sits beside. 18 beside an 18px heading, 13 beside an 11px field
          // label — a mark bigger than the words it belongs to stops being a mark and becomes a
          // control, and the eye goes to it before the label it is annotating.
          width: `${size}px`, height: `${size}px`, borderRadius: "999px", flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${hover ? "var(--gray-400)" : "var(--gray-300)"}`,
          backgroundColor: "transparent",
          color: hover ? "var(--gray-600)" : "var(--gray-400)",
          fontSize: `${Math.round(size * 0.62)}px`, fontWeight: 700, fontFamily: "inherit", lineHeight: 1,
          cursor: "help", padding: 0,
        }}
      >
        ?
      </button>
    </Tooltip>
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
            boxShadow: "var(--shadow-popover)",
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
 * The line under a field that says why what is in it will not do.
 *
 * Its own component because the alternative is what was here: the same eleven-pixel red paragraph
 * written inline in each form that grew one, already at two weights and two reds. A disabled save
 * button with no line under any field is a form that has stopped talking to you, so wherever a
 * check can refuse a value, this is what says so.
 */
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.5, marginTop: "6px" }}>
      {children}
    </p>
  );
}

/** Whether this account may look at registered faces. See canViewFaces(). */
export function usePortalFaceAccess(): { mayViewFaces: boolean; reason: string } {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const [lang] = usePortalLanguage();
  const me = currentPortalUser(portalUsers);
  return { mayViewFaces: me ? canViewFaces(me.permission) : true, reason: FACE_HIDDEN_REASON[lang] };
}

const FACE_HIDDEN_REASON = {
  en: "Photo hidden from read-only admin accounts",
  ko: "읽기 전용 관리자 계정에는 사진이 보이지 않습니다",
} as const;

/**
 * A registered face, or the space where one is.
 *
 * One component rather than a check at each of the six <img> tags, because the six are in two
 * files and the seventh would have been written without it. It draws the placeholder at the same
 * size and radius as the picture it stands in for: a row that shrinks when the photo is withheld
 * tells a reader something is missing from the DATA, which is a different and wrong message.
 *
 * Marked, not blank. A grey square with no explanation reads as a failed image — the reader
 * reloads, then files a bug. The title says who cannot see it and why, in one line.
 */
export function FacePhoto({ src, alt = "", size, radius, style, hiddenStyle }: {
  /** Optional because Person.photoUrl is — a CSV import registers a name with no face. Passed
   *  straight through, so a person with no photo renders exactly what it rendered before this
   *  component existed: that is a different state from "withheld" and is not this gate's business. */
  src?: string;
  alt?: string;
  /** Omitted for the detail sheet's full-bleed picture, which sizes itself from `style`. */
  size?: number;
  radius: string;
  style?: React.CSSProperties;
  /** Extra styling for the withheld tile only, where the picture's own rules do not apply. */
  hiddenStyle?: React.CSSProperties;
}) {
  const { mayViewFaces, reason } = usePortalFaceAccess();
  const box: React.CSSProperties = {
    ...(size ? { width: `${size}px`, height: `${size}px` } : null),
    borderRadius: radius,
    ...style,
  };
  if (mayViewFaces) {
    return <img src={src} alt={alt} style={{ objectFit: "cover", display: "block", ...box }} />;
  }
  return (
    <span
      title={reason}
      aria-label={reason}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        backgroundColor: "var(--gray-100)", color: "var(--gray-400)",
        border: "1px solid var(--gray-200)", boxSizing: "border-box",
        ...box, ...hiddenStyle,
      }}
    >
      <EyeOff size={size ? Math.max(12, Math.min(28, Math.round(size * 0.38))) : 28} strokeWidth={2} />
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
  /** Drawn by globals.css's input::placeholder — light, heavy, and gone on focus. That rule is on
   *  the element, not on this component, because half of Portal's fields are bare <input>s. */
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
/*
 * CENTRED ON PURPOSE, AND IT STAYS THAT WAY (2026-09-22, when Portal's forms all moved to
 * right-side panels). Four rows and a 닫기: an address, a number, the hours, and who to ask. There
 * is nothing to fill in, so nothing to lose to a stray click, and nothing on the page behind it to
 * check against — which is what the panels are for. A full-height panel for a contact card would
 * be a panel arguing with its own contents.
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
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "var(--shadow-modal)" }}>
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
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "4px" }}>
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


/**
 * The seven things an app account can be given, drawn once.
 *
 * ONE COPY OF THE WORDS, because two screens now ask this question — the invite form and the
 * per-account editor in Users, and the preset editor in Settings. Two lists would drift, and what
 * they would drift about is what "Redmap" lets somebody do. A person granting access reads the
 * description, not the screen name.
 *
 * Locked renders the rows greyed rather than hidden: a preset is a name until you can see what it
 * switches on, and hiding the list answers "what does this preset do?" with silence.
 */
const GRANT_T = APP_GRANT_LABELS;

function GrantRow({ label, desc, on, locked, onToggle }: {
  label: string; desc: string; on: boolean; locked: boolean; onToggle: () => void;
}) {
  return (
    /* type="button": a grant row renders inside the invite <form>, and a button with no type
       submits it — a tick on "인물 검색" would have mailed the invite. */
    <button type="button" onClick={locked ? undefined : onToggle} disabled={locked} aria-pressed={on}
      style={{
        width: "100%", display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left",
        padding: "9px 10px", borderRadius: "8px", border: "none", fontFamily: "inherit",
        backgroundColor: on && !locked ? "var(--gray-50)" : "transparent",
        cursor: locked ? "default" : "pointer",
        opacity: locked && !on ? 0.5 : 1,
      }}>
      <span style={{
        width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0, marginTop: "1px",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: on ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)",
        backgroundColor: on ? "var(--gray-900)" : "white",
      }}>
        {on && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</span>
        <span style={{ display: "block", fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45, marginTop: "1px" }}>{desc}</span>
      </span>
    </button>
  );
}

/** The five screens over the two actions, with one source for both sets of words. */
export function AppGrantList({ actions, locked, onToggle }: {
  actions: AppAction[];
  locked: boolean;
  onToggle: (action: AppAction) => void;
}) {
  const [lang] = usePortalLanguage();
  const g = GRANT_T[lang];
  /**
   * LOCKED IS A SUMMARY, NOT FIVE DEAD ROWS.
   *
   * Measured before changing it (owner: ui를 저렇게 보여주는게 좋을까?): with a preset selected
   * the sheet stood at 792px on a 900px viewport and the inner scroller hid 89px, so 증거
   * 내보내기 — the one row that separates 감독자 from 조사자 — was below the fold. Five rows of
   * 70px each, none of them clickable, to say what a one-line name already implies.
   *
   * So a preset shows its grants as five marks: filled for held, outlined for not. Complete (a
   * summary that dropped the ungranted ones would answer "what does this NOT give" with silence)
   * and about a fifth of the height. The full rows, with what each action does and which screens
   * it opens, are for the mode where somebody is actually choosing — custom.
   */
  if (locked) {
    return (
      <>
        {/* NO SIDE INSET (owner, 2026-09-22: 정렬이 이상해). The row carried 10px of left
            padding from the days when it sat inside a bordered fold whose own content was inset
            by that much. In a plain column the pills started 10px right of the preset buttons and
            the line of prose above them — three left edges, three different places. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "2px" }}>
          {APP_ACTIONS.map(action => {
            const on = actions.includes(action);
            return (
              <span key={action} style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                height: "24px", padding: "0 9px", borderRadius: "999px",
                fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
                backgroundColor: on ? "var(--gray-900)" : "transparent",
                color: on ? "white" : "var(--gray-400)",
                border: on ? "1px solid var(--gray-900)" : "1px dashed var(--gray-300)",
              }}>
                {on && (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {g.actionName[action]}
              </span>
            );
          })}
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {APP_ACTIONS.map(action => (
          /* THE TITLE IS THE PLACE AND THE LINE UNDER IT IS THE CAPABILITY (owner, 2026-09-22:
             전에는 앱 화면 메뉴명으로 선택하고 구분했었거든, 그것보다 불명확한 거 아닌가).
             There used to be a third part — 「위치: 대시보드 → SYSTEM」 appended to the
             description — because the title said only what somebody may DO and the place had to be
             spelled out somewhere. Now the title IS the place, in the app's own words, so the
             appended line was the same answer twice on one row. See APP_GRANT_LABELS. */
          <GrantRow key={action} label={g.actionName[action]}
            desc={g.actionDesc[action]}
            on={actions.includes(action)} locked={locked} onToggle={() => onToggle(action)} />
        ))}
      </div>
    </>
  );
}

/** The action names alone, for places that list a preset's grants without offering to change them. */
export function useGrantNames(): { action: Record<AppAction, string>; screen: Record<AppScreen, string> } {
  const [lang] = usePortalLanguage();
  const g = GRANT_T[lang];
  return { action: g.actionName, screen: g.screenName };
}

/**
 * A SECOND-LEVEL RAIL, SHARED (moved out of PortalSettingsPage 2026-09-22).
 *
 * It was the settings page's own component until the users page needed the same thing: the owner
 * asked for 카메라 그룹 and 앱 권한 프리셋 to sit in 「설정페이지처럼 왼쪽에 작은사이드바」 rather
 * than beside 계정 and 명부 대기 on one tab row. Two rails that look alike but drift apart is the
 * usual cost of copying one, so it lives here and both read from it.
 *
 * The reasoning inside is the settings rail's, kept verbatim — it is measured, not preference.
 */
export function SectionNav({ sections, active, onSelect }: {
  /** `count` is optional: a figure at the row's right edge, the way the product's own left rail
   *  carries VIP 등록 122 and 입력 소스 62. Omit it where the section counts nothing.
   *
   *  `group` is optional too: a caption over the first row of each run of rows that share it.
   *  Rows are rendered in the order given, so a group's rows have to be adjacent — the caption
   *  is drawn when the value CHANGES, which is also what makes a rail with no groups draw none. */
  sections: { id: string; label: string; icon: React.ReactNode; count?: number; group?: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <nav style={{ flexShrink: 0, width: "180px", display: "flex", flexDirection: "column", gap: "2px" }}>
      {sections.map((sec, i) => {
        const on = sec.id === active;
        const warm = on || hovered === sec.id;
        /* THE CAPTION IS A DIFFERENT KIND OF LINE FROM A ROW, and it says so by not being one:
           uppercase, 10.5px, grey, no icon and no hit area. The product's own left rail captions
           작업 공간 and 관리 exactly this way, so a reader who has used that rail already knows
           what this line is. First row of the run only, and the run is the order given. */
        const caption = sec.group && sec.group !== sections[i - 1]?.group ? sec.group : null;
        return (
          <React.Fragment key={`g-${sec.id}`}>
          {caption && (
            <span style={{
              fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--gray-400)", padding: i === 0 ? "2px 10px 6px 16px" : "14px 10px 6px 16px",
            }}>
              {caption}
            </span>
          )}
          <button
            onClick={() => onSelect(sec.id)}
            onMouseEnter={() => setHovered(sec.id)}
            onMouseLeave={() => setHovered(null)}
            aria-current={on ? "page" : undefined}
            style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: "9px",
              // Extra left padding leaves room for the bar, and every row carries it so the labels
              // stay on one line whether or not the bar is drawn.
              padding: "9px 10px 9px 16px", borderRadius: "8px", border: "none",
              // Grey, not purple. Purple is reserved for things that need attention, and "where
              // you are" is not one — see the colour note in globals.css.
              //
              // A fill alone said it too quietly: gray-100 on the page's near-white ground is
              // barely a shade, so the only real signal was the weight of the text. The pattern
              // that carries at a glance is a mark at the leading edge — komoot and Pinterest
              // both mark the active row that way rather than tinting it harder, and the mark
              // works at any fill strength because it is a different KIND of difference.
              // White, lifted — not a tint.
              //
              // Two tints were tried and both read as dusty: gray-100 (slate, 96%) and --line
              // (purple, 93%). That is not a wrong token, it is the lightness band itself. Any
              // saturated colour at 93-96% against this page's near-white ground has too little
              // room left to be a colour, so it lands as grey with something in it.
              //
              // No fill on the selected row at all. Three were tried and each failed for its own
              // reason, which together say the row should not be a surface:
              //
              //   gray-100 (slate, 96%)  dusty — at that lightness a hue has no room to be a hue
              //   --line   (purple, 93%) dusty for the same reason, in the other family
              //   white                  clean, but it is the panel's colour: a white pill beside
              //                          a white card reads as the same object in two places
              //
              // So the mark carries it instead. This is Pinterest's settings rail: a bar at the
              // leading edge, the label in full weight and colour, and no plate under either. The
              // row stops competing with the card for what "a white box" means, and the signal is
              // if anything stronger — a 3px rule against nothing is more definite than a 3%
              // difference in ground.
              backgroundColor: hovered === sec.id && !on ? "var(--gray-50)" : "transparent",
              color: warm ? "var(--gray-900)" : "var(--gray-500)",
              fontSize: "13px", fontWeight: on ? 700 : 600, fontFamily: "inherit",
              textAlign: "left", cursor: "pointer", width: "100%",
              transition: "background-color .12s ease, color .12s ease",
            }}
          >
            {on && (
              <span aria-hidden="true" style={{
                position: "absolute", left: "5px", top: "50%", transform: "translateY(-50%)",
                width: "3px", height: "16px", borderRadius: "999px", backgroundColor: "var(--gray-900)",
              }} />
            )}
            <span style={{ display: "flex", flexShrink: 0, color: on ? "var(--gray-900)" : warm ? "var(--gray-600)" : "var(--gray-400)" }}>{sec.icon}</span>
            <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.label}</span>
            {sec.count !== undefined && (
              <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 600, color: warm ? "var(--gray-500)" : "var(--gray-400)", fontVariantNumeric: "tabular-nums" }}>
                {sec.count}
              </span>
            )}
          </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * A PANEL OFF THE RIGHT EDGE, FOR WORK YOU DO WHILE LOOKING AT THE PAGE.
 *
 * The owner's decision (2026-09-22): 지금 포탈에 팝업이랑 방금 처음 만든 오른쪽 패널창이랑
 * 두가지 컴포넌트로 쓰고있는데 하나로 가능한한 통일하는게 좋을것같아 오른쪽패널로.
 *
 * WHICH DIALOGS BECOME THIS ONE, AND WHICH DO NOT. Editors, forms and detail panels move here:
 * they are work, and work wants the screen it came from still visible — the accounts table behind
 * the invite panel is the list you are adding to. Confirmations stay centred (ConfirmModal): a
 * delete is a question, not a workspace, and the two containers behave in OPPOSITE ways about the
 * scrim. A confirm should dismiss on a scrim click, because the answer is "no" and no work is
 * lost; a half-built form must NOT, because the same gesture would throw the work away with no
 * undo. One component cannot hold both rules without being wrong for one of them.
 *
 * THE SCRIM CLOSES IT (owner, 2026-09-22: 패널 닫을때 왼쪽 딤드된 부분 클릭해도 닫을수있게
 * 해줘야할것같은데). This file argued the other way an hour earlier — that a stray click would
 * throw away a half-built form — and the owner's call is the convention: a dimmed area is a
 * dismiss target everywhere else, and a panel that ignores it reads as stuck. The cost is real and
 * stated rather than designed around: a form with answers in it is discarded by that click, with
 * no undo. If that turns out to bite, the fix is a confirm on a dirty panel, not a dead scrim.
 *
 * Escape closes it too, for the same reason and not in spite of it: once the scrim dismisses, the
 * keyboard needs the same gesture or the panel is mouse-only. The earlier note here argued Escape
 * was "the same loss with none of the affordance", which was true while the scrim did not close
 * either — a key that silently discarded work nothing else discarded. It is not true now.
 *
 * WHAT THE PANEL OWNS AND WHAT THE CALLER OWNS. The panel owns the shell: the scrim, the width,
 * the full height, the header with its title and ✕, and a footer that keeps its height while the
 * body between them scrolls — which is the layout the invite dialog needed a measured exception
 * for as a centred sheet (its buttons opened 16px below the fold on a 912px window). Here it is
 * the ordinary case, because a panel is as tall as the window by definition.
 *
 * `width` exists because these are not all the same kind of work: a form is one column (520px is
 * the width the invite form was measured to), while a picker with a map beside it wants 672px.
 */
/**
 * THE ONE REQUIRED MARKER (owner, 2026-09-22: 빨간 표시로 할 거면 다 빨간 표시로 필수임을
 * 알려줬으면 해).
 *
 * The invite panel had both kinds on one screen: 권한 and 현장 drew a red star from their section
 * component, while 이메일, 이름 and 프로젝트 carried a grey one baked into the label string. Two
 * marks for one meaning, and the grey one reads as decoration — so a reader cannot tell whether
 * the grey-starred fields are optional. Every required label in Portal takes this.
 */
/*
 * A PICKED BOX: THE LINE AND THE FILL, IN ONE PLACE.
 *
 * Every picker in Portal draws the same two things for "this one is chosen" — a chip, a preset, a
 * project, a segmented option, an applied filter — so they are tokens rather than a literal
 * repeated per file. Owner's decisions, 2026-09-22, in the order they were made:
 *
 *  · dark line + neutral fill rather than a purple line and a purple fill. Twenty reference
 *    screens: WRITER fills the chosen chip BLACK and spends its brand purple on 「Next」 and
 *    「Apply」; Railway, Klaviyo and Juicebox keep selection neutral too. This console needs that
 *    discipline more than most — one panel can show a picked project, a picked preset, N picked
 *    groups and six action pills at once, and in brand purple they would swamp the one purple
 *    thing that matters, the button that sends.
 *  · the FILL carries a purple tint: primary-100 (#f0f0ff) is the same lightness as the gray-100
 *    (#f1f5f9) it replaced and differs only in hue, so nothing got louder.
 *  · the LINE came down in three steps — gray-900, gray-800, gray-700, and finally primary-300
 *    (#8c85ff). Each grey step was still near-black: 「너무 눈에 확 띄게 됐는데」, and it was true —
 *    a picked chip had the darkest ink on the screen around it, darker than the text. Once the
 *    fill carried a purple tint the grey ramp was the wrong family anyway, so the line joined it.
 *    primary-300, not the brand's primary-400: 400 is the colour of the button that acts, and a
 *    selected box is a state. At 1px on a #f0f0ff ground it still draws a readable edge.
 *
 * NOT for the 16px tick marks. There the border and the fill are the same colour, and lightening
 * them softens the tick itself — which is the thing being read.
 */
export const PICKED_LINE = "1px solid var(--primary-300)";
export const PICKED_FILL = "var(--primary-100)";

export function RequiredMark() {
  return <span style={{ color: "var(--danger-500)", marginLeft: "3px", fontWeight: 700 }}>*</span>;
}

const DRAWER_DISCARD_T = {
  en: {
    title: "You have unsaved changes",
    body: "Close this panel and what you have typed is gone.",
    confirm: "Close without saving",
    cancel: "Keep editing",
  },
  ko: {
    title: "작성 중인 내용이 있습니다",
    body: "닫으면 입력한 내용은 저장되지 않습니다.",
    confirm: "저장하지 않고 닫기",
    cancel: "계속 작성",
  },
} as const;

export function Drawer({ title, onClose, onBack, footer, width = "520px", escapeEnabled = true, dirty = false, children }: {
  title: React.ReactNode;
  onClose: () => void;
  /**
   * Set only when this panel opened OVER another one, and it draws a ← before the title.
   *
   * A stacked panel replaces what the reader was looking at, in the same place, at the same size —
   * so without a way back the screen has silently become a different screen. ✕ does return to the
   * panel underneath, but ✕ everywhere else in Portal means "done with this, back to the page";
   * the arrow is what says "there is something behind this".
   */
  onBack?: () => void;
  /** The row of buttons. Kept out of the scrolling body, so it cannot fall off the bottom. */
  footer?: React.ReactNode;
  width?: string;
  /**
   * False while ANOTHER panel is open over this one — a group being edited from inside the invite
   * panel, say. Escape closes the top panel only; left on, one keypress would shut both, throwing
   * away the half-written form underneath as well as the thing the reader meant to dismiss.
   */
  escapeEnabled?: boolean;
  /**
   * TRUE ONCE THE READER HAS PUT SOMETHING IN (owner, 2026-09-22: 패널 공통 컴포넌트로 작성 중일
   * 때 왼쪽 딤드 클릭해도 바로 삭제돼서 입력하던 데이터를 황당하게 잃어버리는 일이 없게 장치를
   * 만들어줘).
   *
   * The scrim is an ambient target — it is most of the window, and a click meant for the page
   * behind lands on it — so with work in the panel it asks instead of closing. Escape is guarded
   * the same way: one keypress should not be able to delete six answers.
   *
   * ✕ and the footer's 취소 are NOT guarded. Those are aimed: they are labelled "close this", the
   * reader pressed the thing that says so, and a confirmation on a deliberate cancel is the dialog
   * arguing with a decision already made. Guard the accidents, not the choices.
   *
   * A panel that leaves this false keeps the old behaviour, which is right for the ones that only
   * show things.
   */
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const [lang] = usePortalLanguage();
  const dt = DRAWER_DISCARD_T[lang];
  const [confirmingClose, setConfirmingClose] = useState(false);
  /** The two ambient ways out. Deliberate ones call `onClose` straight. */
  const requestClose = () => {
    if (dirty) { setConfirmingClose(true); return; }
    onClose();
  };
  /* Off while the confirmation is up, or one Escape would be handled twice — by that dialog and
     by this panel — and close both, which is the loss this guard exists to prevent. */
  useEscapeKey(requestClose, escapeEnabled && !confirmingClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) requestClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 320, display: "flex", justifyContent: "flex-end" }}>
      {/* `e.target === e.currentTarget`, not a bare handler: a click that started inside the panel
          bubbles out to here, and closing on that would make every button in the panel also a
          close button. */}
      <div style={{
        backgroundColor: "white", width: `min(${width}, 100%)`, height: "100%",
        borderLeft: BORDER, boxShadow: "var(--shadow-modal)",
        display: "flex", flexDirection: "column",
      }}>
        {/* NO RULE UNDER THE TITLE EITHER (owner, 2026-09-22: 타이틀 바로 아래 라인도 없어도
            될 것 같은데). Of the twenty panels checked for the footer rule below, Whop, Vapi,
            Posh and Julienne drop this one too, and the title carries itself: 15px/800 against
            13px body is the separation, and the padding is the gap. What the line was for —
            marking the edge when the body scrolls under it — is a scroll shadow's job, not a
            rule that is drawn whether anything scrolls or not. */}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px" }}>
          {onBack && (
            <button type="button" onClick={onBack} className="portal-icon-btn"
              aria-label={SHARED_LABELS[lang].back} title={SHARED_LABELS[lang].back}
              style={{ flexShrink: 0, display: "flex", padding: "2px", marginLeft: "-4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-500)" }}>
              <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1, fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          <button type="button" onClick={onClose} className="portal-icon-btn"
            style={{ flexShrink: 0, padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        {/* minHeight 0, or a flex child will not shrink below its content and the panel grows past
            the window instead of scrolling — the bug that put the invite buttons off screen. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
        {/*
          NO RULE OVER THE FOOTER (owner, 2026-09-22: 이런 오른쪽패널 디자인 모빈에서 찾아서
          엑션버튼이랑 라인이 많은것같은데).
         
          Checked against twenty right-hand panels: Airwallex, Peec AI and Rox draw no footer rule
          at all, and their bodies scroll too; Whop, Vapi, Posh and Julienne go further and drop the
          header rule as well. The panels that DO rule their footer (Supabase, Customer.io, Gorgias)
          are the minority, and ours was stacking that rule under a bordered cancel button and over
          a bordered picker — three lines within 60px.
         
          What a rule here was for is the boundary when content scrolls under the buttons. If that
          turns out to matter the answer is a shadow that appears on scroll, the way several of
          those products do it — not this line back.
        */}
        {footer && (
          <div style={{ flexShrink: 0, padding: "16px 20px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            {footer}
          </div>
        )}
      </div>
      {confirmingClose && (
        /* Not danger-red: nothing here is irreversible in the way a deletion is, and the red
           button is spent on the ones that cannot be undone. The cancel is the wide one by
           position — it is the second button and the panel stays open behind it. */
        <ConfirmModal
          title={dt.title} body={dt.body}
          confirmLabel={dt.confirm} cancelLabel={dt.cancel}
          onConfirm={() => { setConfirmingClose(false); onClose(); }}
          onClose={() => setConfirmingClose(false)}
        />
      )}
    </div>
  );
}

/**
 * THE TWO BUTTONS A PANEL ENDS WITH, SO THEY CANNOT DRIFT APART.
 *
 * Checked against twenty right-hand panels (owner, 2026-09-22: 이런 오른쪽패널 디자인 모빈에서
 * 찾아서 엑션버튼이랑 라인이 많은것같은데 이부분도 한번 비교해서 수정해줘): Airwallex, Neon,
 * Supabase, Vapi, Peec AI, Rox, Cloudflare and Customer.io all end with a bordered-nothing cancel
 * and one filled primary, bottom right. Ours gave cancel a 1px border, which read as two equal
 * choices and also made the pair 42px and 40px tall — one had a line the other did not.
 *
 * They are components rather than a style object because every panel in this product was writing
 * the same twelve properties by hand and no two of them agreed: three paddings, two font sizes and
 * two different disabled greys were in the file at once.
 */
export function PanelCancel({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: "10px 14px", borderRadius: "8px", border: "none", backgroundColor: "transparent",
        color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>
      {label}
    </button>
  );
}

/**
 * The committing action. Purple, which is the one thing this product spends primary colour on —
 * see the ratio note in globals.css: a grey fill beside a grey cancel gave the reader two equals.
 *
 * `disabled` keeps the button on screen and says so, rather than hiding it: a panel whose action
 * disappears while it is not yet valid is a panel that looks broken. The reason it is dead belongs
 * beside it, which is the caller's job — the footer is a column for exactly that.
 */
export function PanelPrimary({ onClick, label, disabled, danger }: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  /** For an action that cannot be undone. Red, and only where deleting is the point. */
  danger?: boolean;
}) {
  const fill = danger ? "var(--danger-500)" : "var(--primary-400)";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        padding: "10px 18px", borderRadius: "8px", border: "none",
        backgroundColor: disabled ? "var(--gray-200)" : fill,
        color: disabled ? "var(--gray-400)" : "white",
        fontSize: "13px", fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
      }}>
      {label}
    </button>
  );
}
