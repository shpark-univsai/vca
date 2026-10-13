"use client";

import { useLanguage } from "@/lib/i18n";

/*
 * WHAT THIS STANDS IN FOR, MEASURED (1512x950, 2026-10-13).
 *
 * Data resolves to Live Monitoring with the search panel shut and no search run — that is the
 * screen this skeleton hands over to, so it is the only screen it is allowed to draw. It used to
 * draw a status line and three horizontal carousels, a layout the tab has not had for some time:
 * every block in the body was in the wrong place, and the handover moved all of it.
 *
 * The real screen, element by element:
 *   sub-nav      1512x46 white, three tabs from x=20, each `0 18px` around a 15px glyph
 *   page body    gray-100, padding 20/24/12
 *   panel        x24 y128, 1464x810, white, 12px corner, padding 20/24
 *   control row  x48 y148, 36px tall: the Smart search button (129px) + the camera picker (152px)
 *   the wall     from y196, flex-wrap, 12px gap, cards `1 1 136px` capped at 160 and 254 tall
 *                — nine to a row at 146.7px wide on this viewport
 *
 * The card follows the real flex rule rather than a fixed width on purpose: that way the column
 * count is resolved by the same arithmetic at every viewport, instead of being right at 1512 and
 * wrong everywhere else. The count below just has to overflow the panel at any size.
 *
 * NOT DRAWN, and why: the search results grid (minmax(156px, 1fr), six to a row) is never what
 * loading hands over to — a search has to be run first, and the screen is already loaded by then.
 */
/** Region shape and copy: see the note at the top of SkeletonDashboard.tsx. */
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

/**
 * The two places where a block's width is a word's width, measured in both languages.
 *
 * The tab labels are 모니터링 / Re-ID 분석 / RedFace against Live Monitoring / Re-ID Analysis /
 * RedFace, so the three tab boxes land 45px apart between the two — one set of numbers would be
 * right on one console and visibly wrong on the other. Everything else on this screen is a
 * measurement, not a word, and is shared.
 */
const SHAPE = {
  en: { tabs: ["89px", "86px", "49px"], toggle: "129px" },
  ko: { tabs: ["44px", "60px", "49px"], toggle: "111px" },
} as const;

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function SubNavSkeleton({ tabs }: { tabs: readonly string[] }) {
  return (
    <div aria-hidden="true" style={{ backgroundColor: "white", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", padding: "0 20px", height: "46px", flexShrink: 0 }}>
      {tabs.map((w, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", height: "100%", padding: "0 18px", borderBottom: i === 0 ? "2px solid var(--gray-300)" : "2px solid transparent" }}>
          <Bone w="15px" h="15px" color={i === 0 ? "var(--gray-300)" : "var(--gray-100)"} radius="3px" />
          <Bone w={w} h="12px" color={i === 0 ? "var(--gray-300)" : "var(--gray-100)"} />
        </div>
      ))}
    </div>
  );
}

/** The Smart search button and the camera picker, on the one row they share. */
function ControlRowSkeleton({ toggleW }: { toggleW: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexShrink: 0 }}>
      <Bone w={toggleW} h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
      {/* The camera picker is a fixed 152 in both languages. */}
      <Bone w="152px" h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
    </div>
  );
}

function WallCardSkeleton() {
  return (
    <div style={{
      flex: "1 1 136px", maxWidth: "160px", height: "254px",
      borderRadius: "var(--radius-card)", overflow: "hidden", backgroundColor: "white",
      boxShadow: "var(--shadow-raised)", display: "flex", flexDirection: "column",
    }}>
      {/* The capture, down to where the white plate starts. The real plate is 76 tall hung 2px
          below the card and clipped, so it begins at 180. */}
      <Bone w="100%" h="180px" color="var(--gray-200)" radius="0px" />
      {/* The padding is not the plate's own (7/11/10) — these blocks are shorter than the text
          rows they stand for, so they are set on those rows' centres instead: the card's three
          lines sit at 196 / 216 / 238.5 from its top, and so do these. */}
      <div style={{ flex: 1, padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <Bone w="34px" h="12px" color="var(--gray-300)" />
        <Bone w="62px" h="12px" color="var(--gray-200)" />
        {/* The time sits on the plate's own floor, as it does on the card. */}
        <div style={{ marginTop: "auto", display: "flex" }}>
          <Bone w="54px" h="10px" color="var(--gray-100)" />
        </div>
      </div>
    </div>
  );
}

export default function SkeletonData() {
  const [lang] = useLanguage();
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--gray-50)", position: "relative" }}>
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SubNavSkeleton tabs={SHAPE[lang].tabs} />
      <div aria-hidden="true" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", backgroundColor: "var(--gray-100)", padding: "20px 24px 12px", boxSizing: "border-box" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "white", borderRadius: "var(--radius-panel)", padding: "20px 24px", boxSizing: "border-box" }}>
          <ControlRowSkeleton toggleW={SHAPE[lang].toggle} />
          {/* More cards than any viewport can show, so the last visible row is always a full one
              — the wall itself holds thousands, and a short final row would be the skeleton's own
              invention. The surplus is clipped by the panel above. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignContent: "flex-start" }}>
            {Array.from({ length: 54 }).map((_, i) => <WallCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
