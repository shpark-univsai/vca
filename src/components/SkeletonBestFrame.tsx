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

function Circle({ size, color = "var(--gray-300)" }: { size: string; color?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

function CameraRowSkeleton({ nameW }: { nameW: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px" }}>
      <Bone w="14px" h="14px" color="var(--gray-200)" radius="3px" />
      <Circle size="18px" color="var(--gray-300)" />
      <Bone w={nameW} h="12px" color="var(--gray-200)" />
    </div>
  );
}

function SidebarSectionSkeleton({ labelW, rows }: { labelW: string; rows: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Bone w="10px" h="10px" color="var(--gray-300)" radius="2px" />
          <Bone w={labelW} h="12px" color="var(--gray-300)" />
        </div>
        <Bone w="20px" h="14px" color="var(--gray-100)" radius="8px" />
      </div>
      {rows.map((w, i) => <CameraRowSkeleton key={i} nameW={w} />)}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div aria-hidden="true" style={{ width: "240px", flexShrink: 0, backgroundColor: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "24px 12px 10px" }}>
        <Bone w="110px" h="20px" color="var(--gray-300)" />
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--gray-100)", borderRadius: "8px", height: "36px", padding: "0 14px" }}>
          <Bone w="70px" h="10px" color="var(--gray-300)" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <SidebarSectionSkeleton labelW="100px" rows={["90px", "110px", "80px", "100px"]} />
        <SidebarSectionSkeleton labelW="80px" rows={["95px", "70px"]} />
        <SidebarSectionSkeleton labelW="85px" rows={["100px", "85px", "90px"]} />
      </div>
    </div>
  );
}

function FilterRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", flexShrink: 0, borderBottom: "1px solid var(--gray-200)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Bone w="90px" h="14px" color="var(--gray-300)" />
        <Bone w="46px" h="12px" color="var(--gray-100)" />
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <Bone w="48px" h="28px" color="var(--gray-100)" radius="999px" />
        <Bone w="72px" h="28px" color="var(--gray-50)" radius="999px" />
        <Bone w="82px" h="28px" color="var(--gray-50)" radius="999px" />
        <Bone w="86px" h="28px" color="var(--gray-50)" radius="999px" />
      </div>
    </div>
  );
}

function CameraTileSkeleton() {
  return (
    <div style={{ backgroundColor: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Bone w="36px" h="36px" color="var(--gray-200)" radius="8px" />
    </div>
  );
}

function CameraGridSkeleton() {
  const tiles = Array.from({ length: 16 });
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gridTemplateRows: "repeat(4, minmax(0, 1fr))",
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
