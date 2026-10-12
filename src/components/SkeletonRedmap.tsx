"use client";

import { useLanguage } from "@/lib/i18n";

/** Region shape and copy: see the note at the top of SkeletonDashboard.tsx. */
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function SearchBarSkeleton() {
  return (
    <div aria-hidden="true" style={{
      backgroundColor: "white", borderBottom: "1px solid var(--gray-200)",
      padding: "0 24px", height: "52px",
      display: "flex", alignItems: "center", gap: "0", flexShrink: 0,
    }}>
      {/* Mode toggle — 8px track, 6px segments, the shape shared/SegmentedControl draws. It was a
          pill here and a pill there; both moved together. */}
      {/* --gray-200, with the real toggle — otherwise the track darkens a step in the frame the
          skeleton hands over, which is exactly the layout-jump this file exists to avoid.
          The unselected bone goes to --gray-300 for the same reason in reverse: at
          --gray-200 it would dissolve into the track it sits on and the toggle would look
          like one segment while loading and two after. */}
      <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--gray-200)", borderRadius: "var(--radius-control)", padding: "2px", gap: "2px" }}>
        <Bone w="76px" h="32px" color="white" radius="var(--radius-inner)" />
        <Bone w="76px" h="32px" color="var(--gray-300)" radius="var(--radius-inner)" />
      </div>

      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--gray-200)", margin: "0 16px" }} />

      {/* Date range */}
      <Bone w="180px" h="34px" color="var(--gray-100)" radius="var(--radius-control)" />

      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--gray-200)", margin: "0 16px" }} />

      {/* Search-by-image chips */}
      <div style={{ display: "flex", gap: "8px" }}>
        <Bone w="120px" h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
        <Bone w="120px" h="36px" color="var(--gray-100)" radius="var(--radius-control)" />
      </div>

      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--gray-200)", margin: "0 16px" }} />

      {/* Similarity */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Bone w="60px" h="12px" color="var(--gray-100)" />
        <Bone w="120px" h="20px" color="var(--gray-100)" radius="999px" />
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: "12px" }}>
        <Bone w="88px" h="36px" color="var(--gray-50)" radius="8px" />
        <Bone w="112px" h="36px" color="var(--gray-200)" radius="10px" />
      </div>
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
// the only state a fresh page load can actually be in. Redmap's left/right panels only mount
// once a search produces results, so this skeleton matches that: just the search bar and a
// full-width map, no side panels.
export default function SkeletonRedmap() {
  const [lang] = useLanguage();
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SearchBarSkeleton />
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <MapSkeleton />
      </div>
    </div>
  );
}
