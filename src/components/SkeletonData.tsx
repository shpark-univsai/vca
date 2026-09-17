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

function SubNavSkeleton() {
  const tabs = ["78px", "96px", "90px", "64px"];
  return (
    <div aria-hidden="true" style={{ backgroundColor: "white", borderBottom: "1px solid var(--gray-200)", display: "flex", alignItems: "center", padding: "0 20px", height: "46px", flexShrink: 0, gap: "18px" }}>
      {tabs.map((w, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", height: "100%", borderBottom: i === 0 ? "2px solid var(--gray-300)" : "2px solid transparent" }}>
          <Bone w="14px" h="14px" color={i === 0 ? "var(--gray-300)" : "var(--gray-100)"} radius="3px" />
          <Bone w={w} h="12px" color={i === 0 ? "var(--gray-300)" : "var(--gray-100)"} />
        </div>
      ))}
    </div>
  );
}

function StatusRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <Bone w="120px" h="12px" color="var(--gray-300)" />
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Circle size="8px" color="var(--success-400)" />
        <Bone w="60px" h="12px" color="var(--gray-100)" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Circle size="8px" color="var(--gray-300)" />
        <Bone w="60px" h="12px" color="var(--gray-100)" />
      </div>
    </div>
  );
}

function CarouselCardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <Bone w="140px" h="96px" color="var(--gray-200)" radius="8px" />
      <Bone w="90px" h="10px" color="var(--gray-100)" />
    </div>
  );
}

function CarouselSectionSkeleton({ labelW }: { labelW: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Bone w={labelW} h="14px" color="var(--gray-300)" />
        <Bone w="60px" h="12px" color="var(--gray-100)" />
      </div>
      <div style={{ display: "flex", gap: "12px", overflow: "hidden" }}>
        {Array.from({ length: 5 }).map((_, i) => <CarouselCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export default function SkeletonData() {
  const [lang] = useLanguage();
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--gray-50)", position: "relative" }}>
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SubNavSkeleton />
      <div aria-hidden="true" style={{ flex: 1, overflow: "hidden", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <StatusRowSkeleton />
        <CarouselSectionSkeleton labelW="70px" />
        <CarouselSectionSkeleton labelW="70px" />
        <CarouselSectionSkeleton labelW="70px" />
      </div>
    </div>
  );
}
