/**
 * THE SHAPE SCALE, IN ONE PLACE (owner, 2026-10-06: 셀렉트버튼들이 radius 값이 너무 제각각인데
 * 규칙을 정하고 따라야할것같아 · 제안하는 규칙대로 하고).
 *
 * Measured before writing this: the monitoring app had FIFTEEN distinct radius values on
 * interactive controls — 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 24, 50%, 999px and one written as
 * `isSelected ? "6px" : "7px"` — with no token in globals.css and no shared constant anywhere on
 * the app side. The Portal had CARD_RADIUS and CONTROL_HEIGHT and the app imported neither.
 *
 * THE RULE WAS ALREADY WRITTEN. RedmapPage carried it in a comment — 「8px, like every other
 * --gray-900 button in the app … a pill is this app's shape for a FILTER」 — and PortalShared said
 * the same from its side. It was declared twice, in prose, and enforced nowhere. This file is that
 * same rule in a form a second screen can read.
 *
 * WHAT THE RESEARCH ACTUALLY SAID, because it narrowed the rule rather than confirming it. The
 * idea that a pill MEANS "a filter you switch on and off" is not an industry convention: Material
 * 3 draws its filter chip as an 8dp rounded rectangle while making buttons and search bars pills,
 * Polaris ships a component literally named FilterPill at 8px, Atlassian reserves `full` for
 * avatars and puts "buttons, inputs, text areas, selects" together at one step, and M3 publishes
 * the prohibition outright — 「Avoid making shapes literal or assigning a specific function or
 * meaning to a single shape」. What the systems that publish a rule agree on is that radius tracks
 * HOW DEEPLY A THING IS NESTED, not what it means (Atlassian's ladder, Apple's ConcentricRectangle,
 * M3's "outer radius minus padding").
 *
 * So `pill` survives here for the one case that needs no box at all — a label-only chip whose
 * width follows its text, a count badge, a slider track — and everything with a set height in a
 * toolbar row is `control`, whatever job it does.
 */
export const RADIUS = {
  /** Label-only chips with no fixed width, count badges, slider tracks, status tokens. */
  pill: "999px",
  /** Anything with a set height in a row: input, date trigger, select, segmented track, button. */
  control: "8px",
  /** Nested inside a control: a segment in its track, a thumbnail in a button. 8 − 2px padding. */
  inner: "6px",
  /** Popovers, dropdown panels, drop zones. */
  panel: "12px",
  /** Cards and modals. Same value as PortalShared's CARD_RADIUS, which re-exports this. */
  card: "16px",
} as const;

/**
 * Every control that can sit on a toolbar row is this tall, so a row of them lines up.
 *
 * The Portal has said this since its own shared file was written; the app repeated the number
 * inline six times instead (the mode toggle, the plate field, the image chips, Reset, Search and
 * the date trigger are all 36px by coincidence of everyone typing the same number).
 */
export const CONTROL_HEIGHT = "36px";
