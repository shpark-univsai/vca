"use client";

import { usePortalLanguage } from "@/lib/i18n";
import { BORDER } from "./PortalShared";

const T = {
  en: {
    eyebrow: "Projects",
    title: "Deploy AI Monitoring for Any Environment",
    subtitle: "Create your first project, connect a camera stream, and start monitoring in minutes.",
    newProject: "New Project",
    // Shown when the installation has no team yet. A project has to live in a team, so the first
    // ask is the team — offering "New Project" here would open a wizard with nowhere to file it.
    noTeamSubtitle: "Start with a team — projects live inside one. A team usually maps to one customer or site.",
    createTeam: "Create team",
    gallery: {
      vip: "VIP / watchlist detection",
      tracking: "Cross-camera tracking",
      vehicle: "Vehicle recognition",
      attendance: "Campus attendance (face recognition)",
      blindSpot: "Blind-spot monitoring",
      crowd: "Public area crowd monitoring",
    },
  },
  ko: {
    eyebrow: "프로젝트",
    title: "모든 환경에 AI 모니터링을 적용하세요",
    subtitle: "첫 프로젝트를 생성하고 카메라 스트림을 연결하면 몇 분 안에 모니터링을 시작할 수 있습니다.",
    newProject: "새 프로젝트",
    noTeamSubtitle: "먼저 팀을 만드세요 — 프로젝트는 팀 안에 들어갑니다. 팀은 보통 고객사나 사이트 하나에 해당합니다.",
    createTeam: "팀 만들기",
    gallery: {
      vip: "VIP / 관심인물 탐지",
      tracking: "교차 카메라 추적",
      vehicle: "차량 인식",
      attendance: "캠퍼스 출결 관리 (얼굴 인식)",
      blindSpot: "사각지대 모니터링",
      crowd: "공공장소 인파 모니터링",
    },
  },
} as const;

// Drop matching image files into public/portal/gallery/ using these exact filenames — each
// card wires up automatically once the file exists. Until then the card just shows its label on
// a plain placeholder background (the <img> hides itself via onError, no broken-image icon).
const GALLERY_ITEMS: { key: keyof typeof T["en"]["gallery"]; file: string; height: number }[] = [
  { key: "vip", file: "vip-detection.jpg", height: 150 },
  { key: "tracking", file: "cross-camera-tracking.jpg", height: 190 },
  { key: "vehicle", file: "vehicle-recognition.jpg", height: 170 },
  { key: "attendance", file: "campus-attendance.jpg", height: 210 },
  { key: "blindSpot", file: "blind-spot-monitoring.jpg", height: 150 },
  { key: "crowd", file: "crowd-monitoring.jpg", height: 180 },
];

function GalleryCard({ label, file, height }: { label: string; file: string; height: number }) {
  return (
    <div style={{
      backgroundColor: "white", border: BORDER, borderRadius: "14px", overflow: "hidden",
      breakInside: "avoid", marginBottom: "16px",
    }}>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", textAlign: "center", padding: "10px 12px 8px" }}>{label}</p>
      <div style={{ height: `${height}px`, backgroundColor: "var(--gray-100)" }}>
        <img
          src={`/portal/gallery/${file}`}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      </div>
    </div>
  );
}

interface PortalEmptyStateProps {
  onNewProject: () => void;
  /** No team exists yet in this installation — ask for the team first. The gallery and the rest of
   *  the page stay identical: this is the same landing, one step earlier. */
  noTeam?: boolean;
  onCreateTeam?: () => void;
}

export default function PortalEmptyState({ onNewProject, noTeam = false, onCreateTeam }: PortalEmptyStateProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const askTeam = noTeam && !!onCreateTeam;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", marginBottom: "12px" }}>{t.eyebrow}</p>
        <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "40px" }}>
          {t.title}
        </p>
        <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "12px", lineHeight: "22px" }}>
          {askTeam ? t.noTeamSubtitle : t.subtitle}
        </p>
        <button onClick={askTeam ? onCreateTeam : onNewProject}
          style={{
            display: "flex", alignItems: "center", gap: "6px", marginTop: "24px",
            padding: "12px 20px", borderRadius: "999px", border: "none",
            backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer",
          }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          {askTeam ? t.createTeam : t.newProject}
        </button>
      </div>

      <div style={{ columnCount: 2, columnGap: "16px" }}>
        {GALLERY_ITEMS.map(item => <GalleryCard key={item.file} label={t.gallery[item.key]} file={item.file} height={item.height} />)}
      </div>
    </div>
  );
}
