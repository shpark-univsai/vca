/**
 * The type scale, and the tracking that comes with each step.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────────────────────
 *
 * The colour library holds the line on colour: 41 tokens in globals.css, and a screen that wants a
 * shade it does not have is expected to add it there rather than invent a hex. Type and spacing
 * had no equivalent — not one token, not one shared constant — and 602 inline `fontSize`
 * declarations grew into thirteen sizes, with 12px and 13px doing the same job in the same rows
 * and orphan values (10.5, 15, 20, 24) living in one or two places each.
 *
 * That is not a discipline problem. Nobody can keep a scale that was never written down.
 *
 * ── The tracking rule was already there ──────────────────────────────────────────────────────
 *
 * Letter-spacing in this codebase follows size × -0.02em, and it does so in 170 of 209 places:
 * 26 → -0.52, 18 → -0.36, 16 → -0.32, 14 → -0.28, 13 → -0.26, 12 → -0.24, 10 → -0.2. That rule
 * was discovered, not invented here — it is what the screens already do. So it is derived below
 * rather than listed, which is the only version of it that cannot drift again.
 *
 * ── How to use it ────────────────────────────────────────────────────────────────────────────
 *
 *   style={{ ...type(13), fontWeight: 700, color: "var(--gray-900)" }}
 *
 * Shorter than writing the pair by hand, which is the only enforcement that actually works in a
 * codebase styled inline. There is no lint rule for this; there is a shorter path.
 *
 * HANDOFF: these steps belong in the Figma library as text styles, under the same names, the way
 * --line's note asks for the hairline. Until they are there, this file is the draft and Figma is
 * still the authority — if the two disagree, Figma wins and this changes.
 */

/** The steps this product actually uses, by the job each does. */
export const FONT_SIZE = {
  /** Badges, units, counters inside pills. Smallest size that survives a control-room monitor. */
  micro: 10,
  /** A row's second line: time, place, status words. */
  sub: 12,
  /** A row's first line: names, camera codes, tab labels. The workhorse. */
  body: 13,
  /** Panel and modal sub-headings. */
  panel: 14,
  /** Panel and modal titles. */
  title: 16,
  /** A screen's own title, and empty/permission states. */
  page: 18,
  /** Auth screens only — the one place a page is a single task. */
  auth: 26,
} as const;

export type FontSizeStep = keyof typeof FONT_SIZE;

/**
 * A size step, with its tracking already attached.
 *
 * Takes either a step name (`type("body")`) or the px value itself (`type(13)`), because most
 * call sites are being converted from a literal and reading `type(13)` next to the value it
 * replaces is easier to check than a name lookup.
 */
export function type(step: FontSizeStep | (typeof FONT_SIZE)[FontSizeStep]): {
  fontSize: string;
  letterSpacing: string;
} {
  const px = typeof step === "number" ? step : FONT_SIZE[step];
  // -0.02em, rounded to the hundredth — the same values the screens already carry.
  return { fontSize: `${px}px`, letterSpacing: `${(px * -0.02).toFixed(2)}px` };
}

/**
 * Tracking for a run of uppercase Latin, which needs the opposite treatment: letters set in caps
 * have no descenders or x-height variation to separate them, so they want air rather than less.
 *
 * Korean does NOT. A Hangul syllable already carries space inside its own square, so positive
 * tracking pushes a three-character label apart until it reads as two words. Several labels in
 * this app are bilingual through one style and got the Latin value in both, which is why this
 * takes the language.
 */
export function capsTracking(lang: "en" | "ko"): string {
  return lang === "ko" ? "-0.2px" : "0.3px";
}

/**
 * The spacing steps, in px.
 *
 * 6 is the base unit, not 4 — `gap: 6px` appears 125 times, more than any other value, and it is
 * the right one for this product's pairings: a 12–13px label beside a 14–16px icon is cramped at
 * 4 and loose at 8. The 4px grid is a convention, not a law, and the screens already voted.
 */
export const SPACE = { xs: 2, sm: 4, base: 6, md: 8, lg: 12, xl: 16, xxl: 20, gutter: 24 } as const;

/** The page gutter every module, the header and the skeletons already share. */
export const PAGE_GUTTER = SPACE.gutter;

/** Fixed-width digits. For anything that ticks, or that sits in a column with other numbers. */
export const FIGURES = { fontVariantNumeric: "tabular-nums" } as const;
