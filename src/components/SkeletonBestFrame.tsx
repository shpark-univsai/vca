"use client";

import { useLanguage } from "@/lib/i18n";

/** Region shape and copy: see the note at the top of SkeletonDashboard.tsx. */
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

/*
 * Every measurement below was read off the real Best Frame screen at 1512×950 (Chrome, dev), not
 * guessed: the sidebar's blocks are 61 / 46 / 42 px tall, its section header 41 and each camera
 * row 40; the filter rule is 61 including its hairline; the wall is the default FOUR cameras
 * (DEFAULT_GRID_CAMS in BestFramePage), so 2×2 cells of 636×413, each split into a feed and a
 * 240px target panel. A skeleton whose boxes are a different size is worse than none — the
 * moment the data lands the whole screen jumps.
 *
 * This stands in for the CAMERA WALL only. The detail view (frame reel, minute bars, thumbnail
 * strip) has no loading state at all: it opens from a press inside an already-loaded page and
 * lives in component state, so a reload always comes back to the wall. Verified 2026-10-13 —
 * opening the detail leaves no [aria-busy] element on the page.
 */

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function Circle({ size, color = "var(--gray-300)" }: { size: string; color?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

/* ── Sidebar ───────────────────────────────────────────────────── */

/** 40px tall: 10px of padding over and under a 20px line — the real row's exact box. */
function CameraRowSkeleton({ nameW }: { nameW: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px" }}>
      <Bone w="18px" h="18px" color="var(--gray-200)" radius="4px" />
      <Circle size="20px" color="var(--gray-300)" />
      <Bone w={nameW} h="12px" color="var(--gray-200)" />
      <div style={{ flex: 1 }} />
      <Bone w="16px" h="16px" color="var(--gray-100)" radius="4px" />
    </div>
  );
}

/** The real header is 41px; its tallest child is only 16, so the height is stated. */
function SidebarSectionHeaderSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", height: "41px", boxSizing: "border-box" }}>
      <Bone w="14px" h="14px" color="var(--gray-300)" radius="3px" />
      <Bone w="16px" h="16px" color="var(--gray-300)" radius="3px" />
      <Bone w="104px" h="14px" color="var(--gray-300)" />
      <div style={{ flex: 1 }} />
      <Bone w="37px" h="12px" color="var(--gray-100)" />
    </div>
  );
}

/* One flat run, the way the real list reads: a section heading and then its cameras, back to
   back. The second and third headings (video files, image files) sit far below the fold — this
   site has 60-odd cameras — so drawing them here would be inventing a screen nobody sees. */
const SIDEBAR_ROWS = ["84px", "56px", "78px", "64px", "82px", "88px", "62px", "66px", "72px", "60px", "92px", "96px", "74px", "86px", "70px", "80px", "68px", "90px"];

function SidebarSkeleton() {
  return (
    <div aria-hidden="true" style={{ width: "240px", flexShrink: 0, backgroundColor: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Title — 18px/27px text in a 61px block. */}
      <div style={{ padding: "24px 12px 10px", height: "61px", boxSizing: "border-box" }}>
        <Bone w="100px" h="20px" color="var(--gray-300)" />
      </div>
      {/* Search field */}
      <div style={{ padding: "0 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--gray-100)", borderRadius: "8px", height: "36px", padding: "0 14px" }}>
          <Bone w="70px" h="10px" color="var(--gray-300)" />
        </div>
      </div>
      {/* Source filter — All / Network / File */}
      <div style={{ display: "flex", gap: "6px", padding: "0 12px 10px" }}>
        <Bone w="45px" h="32px" color="var(--gray-100)" radius="999px" />
        <Bone w="75px" h="32px" color="var(--gray-50)" radius="999px" />
        <Bone w="49px" h="32px" color="var(--gray-50)" radius="999px" />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <SidebarSectionHeaderSkeleton />
        {SIDEBAR_ROWS.map((w, i) => <CameraRowSkeleton key={i} nameW={w} />)}
      </div>
    </div>
  );
}

/* ── Camera wall ───────────────────────────────────────────────── */

function FilterRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", flexShrink: 0, borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Bone w="81px" h="14px" color="var(--gray-300)" />
        <Bone w="47px" h="12px" color="var(--gray-100)" />
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <Bone w="50px" h="34px" color="var(--gray-100)" radius="999px" />
        <Bone w="68px" h="34px" color="var(--gray-50)" radius="999px" />
        <Bone w="88px" h="34px" color="var(--gray-50)" radius="999px" />
        <Bone w="100px" h="34px" color="var(--gray-50)" radius="999px" />
      </div>
    </div>
  );
}

/** A target row in a tile's side panel: 42px thumbnail, two lines, 59px tall with its rule. */
function TargetRowSkeleton({ titleW }: { titleW: string }) {
  return (
    <div style={{ display: "flex", gap: "8px", padding: "8px 16px", borderBottom: "1px solid var(--gray-200)" }}>
      <Bone w="42px" h="42px" color="var(--gray-200)" radius="6px" />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px" }}>
        <Bone w={titleW} h="12px" color="var(--gray-200)" />
        <Bone w="86px" h="11px" color="var(--gray-100)" />
      </div>
    </div>
  );
}

const TARGET_ROWS = ["96px", "70px", "120px", "92px", "78px", "110px"];

function CameraTileSkeleton() {
  return (
    <div style={{ display: "flex", minWidth: 0, minHeight: 0, backgroundColor: "white", overflow: "hidden" }}>
      {/* Live feed */}
      <div style={{ flex: 1, minWidth: 0, backgroundColor: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bone w="36px" h="36px" color="var(--gray-200)" radius="8px" />
      </div>
      {/* Target panel */}
      <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 10px", height: "41px", boxSizing: "border-box", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <Bone w="99px" h="12px" color="var(--gray-300)" />
          <Bone w="54px" h="11px" color="var(--gray-100)" />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {TARGET_ROWS.map((w, i) => <TargetRowSkeleton key={i} titleW={w} />)}
        </div>
      </div>
    </div>
  );
}

/* Four cameras open on arrival (DEFAULT_GRID_CAMS), and getGridLayout puts four in a 2×2. */
function CameraGridSkeleton() {
  const tiles = Array.from({ length: 4 });
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      gap: "1px", backgroundColor: "var(--gray-200)", flex: 1, minHeight: 0,
    }}>
      {tiles.map((_, i) => <CameraTileSkeleton key={i} />)}
    </div>
  );
}

export default function SkeletonBestFrame() {
  const [lang] = useLanguage();
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", overflow: "hidden", backgroundColor: "white", minHeight: 0, minWidth: 0, position: "relative" }}>
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SidebarSkeleton />
      <div aria-hidden="true" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <FilterRowSkeleton />
        <CameraGridSkeleton />
      </div>
    </div>
  );
}
