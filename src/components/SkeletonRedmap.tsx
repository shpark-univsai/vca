"use client";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

/** Region shape and copy: see the note at the top of SkeletonDashboard.tsx. */
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

/* The two image chips are the only thing on this row whose width is set by its own text —
   「얼굴」/「전신」 against "Face"/"Body" — so they are the only thing the skeleton has to ask the
   language about. Measured in the live toolbar at 1512: ko 120/120, en 134/137. Everything else
   here is a fixed px width in RedmapPage and is copied straight across. */
const CHIP_W: Record<AppLanguage, [string, string]> = {
  ko: ["120px", "120px"],
  en: ["134px", "137px"],
};

function SearchBarSkeleton({ lang }: { lang: AppLanguage }) {
  const [faceW, bodyW] = CHIP_W[lang];
  return (
    /* gap:20px and padding:0 24px are the real row's own values — the bones below carry no
       margins of their own, so the spacing comes from the same place in both. */
    <div aria-hidden="true" style={{
      backgroundColor: "white", borderBottom: "1px solid var(--line)",
      padding: "0 24px", height: "52px",
      display: "flex", alignItems: "center", gap: "20px", flexShrink: 0,
    }}>
      {/* Mode toggle — 280px wide, the width the real SegmentedControl is pinned to (it is a
          bigger question than the date span beside it, so it is deliberately wider). 2px track
          padding, 2px between segments, `flex:1` each, which lands both at 137px exactly as the
          real control's `fill` does. */}
      {/* --gray-200, with the real toggle — otherwise the track darkens a step in the frame the
          skeleton hands over, which is exactly the layout-jump this file exists to avoid.
          The unselected bone goes to --gray-300 for the same reason in reverse: at
          --gray-200 it would dissolve into the track it sits on and the toggle would look
          like one segment while loading and two after. */}
      <div style={{
        display: "flex", alignItems: "center", width: "280px", height: "36px",
        backgroundColor: "var(--gray-200)", borderRadius: "var(--radius-control)",
        padding: "2px", gap: "2px", flexShrink: 0,
      }}>
        <div className="vca-skeleton-pulse" style={{ flex: 1, height: "32px", backgroundColor: "white", borderRadius: "var(--radius-inner)" }} />
        <div className="vca-skeleton-pulse" style={{ flex: 1, height: "32px", backgroundColor: "var(--gray-300)", borderRadius: "var(--radius-inner)" }} />
      </div>

      {/* Date range — the trigger's own 232×36 box. */}
      <Bone w="232px" h="36px" color="var(--gray-100)" radius="var(--radius-control)" />

      {/* One rule, 24px, where the real row draws one — this used to be three 20px rules spaced
          by 16px margins, from a version of the toolbar that had a third group. */}
      <div style={{ width: "1px", height: "24px", backgroundColor: "var(--gray-200)", flexShrink: 0 }} />

      {/* Face / Body chips */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
        <Bone w={faceW} h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
        <Bone w={bodyW} h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
      </div>

      {/* Nothing past the chips. Similarity moved into the left panel, Reset only appears once
          there is something to clear, and in 사람 mode the Search button lives in the panel that
          arrives with the photo — so on the state this skeleton stands for (see below) the right
          half of the real row is empty, and drawing bones there would hand over a toolbar that
          loses two buttons and a slider the moment the data lands. */}
    </div>
  );
}

function MapSkeleton() {
  const dots = [
    { left: "20%", top: "24%" }, { left: "35%", top: "46%" }, { left: "50%", top: "28%" },
    { left: "62%", top: "58%" }, { left: "45%", top: "70%" }, { left: "72%", top: "38%" },
  ];
  const pins = [{ left: "50%", top: "50%" }, { left: "68%", top: "62%" }];
  return (
    <div aria-hidden="true" style={{ flex: 1, position: "relative", backgroundColor: "var(--gray-100)", overflow: "hidden" }}>
      {dots.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "8px", height: "8px",
          borderRadius: "50%", backgroundColor: "var(--gray-300)",
        }} />
      ))}
      {pins.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "32px", height: "32px",
          borderRadius: "50%", backgroundColor: "var(--gray-400)", opacity: 0.35,
        }} />
      ))}
    </div>
  );
}

// The loading skeleton always represents the landing state (before any search has run) — that's
// the only state a fresh page load can actually be in: ClientLayout draws this instead of
// RedmapPage while its own `isLoading` is true, which is only ever the first 700ms after mount,
// and RedmapPage comes up with mode=person, no attached photo and hasSearched=false.
// Redmap's left panel only mounts once a photo is attached and the right one only once a search
// produces results, so this skeleton matches that: just the search bar and a full-width map
// (1512 at this size, not the 872 a three-column search result leaves).
export default function SkeletonRedmap() {
  const [lang] = useLanguage();
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SearchBarSkeleton lang={lang} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <MapSkeleton />
      </div>
    </div>
  );
}
