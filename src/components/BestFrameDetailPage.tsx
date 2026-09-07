"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DetType, Detection, CamData } from "@/types/detection";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { sgtClockTime, sgtDateKey } from "@/lib/time";

import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. Attribute tags, the enrolled-database names and
// camera codes come from the detection data and stay as they are.
const T = {
  en: {
    all: "All",
    noDetections: "No detections",
    multiTrackHistory: "Multi-track event history",
    multiTrackHint: "Events from this camera across every track it has detected",
    vehicle: "Vehicle",
    unknown: "Unknown",
    reelTitle: "Best frame reel",
    reelSub: "Objects captured in current frame",
    inspectionDetail: "Inspection detail",
    close: "Close",
    liveCapture: "LIVE Capture",
    liveCaptureHint: "Frame the camera just captured",
    enrolledDb: "ENROLLED DB",
    enrolledDbHint: "Reference photo from the enrolled database",
    registeredAs: "Registered:",
    cameraName: "Camera name",
    eventTime: "Event time",
    analysisResults: "Analysis results",
    attrBasic: "Basic",
    attrTop: "Top",
    attrBottom: "Bottom",
    attrAddons: "Add-ons",
    alsoCaptured: "Also captured in this frame",
    back: "Back",
    trackOnMap: "Track on Map",
    bestFrame: "Best frame",
    jumpTo: "Jump to",
    pickTime: "Pick hour and minute",
    hour: "Hour",
    minute: "Min",
    weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  },
  ko: {
    all: "전체",
    noDetections: "검출 없음",
    multiTrackHistory: "다중 트랙 이벤트 기록",
    multiTrackHint: "이 카메라가 검출한 모든 트랙의 이벤트입니다",
    vehicle: "차량",
    unknown: "미확인",
    reelTitle: "베스트 프레임 목록",
    reelSub: "현재 프레임에서 검출된 대상",
    inspectionDetail: "검출 상세",
    close: "닫기",
    liveCapture: "실시간 검출",
    liveCaptureHint: "카메라가 방금 잡은 프레임입니다",
    enrolledDb: "등록 DB",
    enrolledDbHint: "등록 데이터베이스의 기준 사진입니다",
    registeredAs: "등록 정보:",
    cameraName: "카메라",
    eventTime: "검출 시각",
    analysisResults: "분석 결과",
    attrBasic: "기본",
    attrTop: "상의",
    attrBottom: "하의",
    attrAddons: "소지품",
    alsoCaptured: "같은 프레임에서 함께 검출됨",
    back: "돌아가기",
    trackOnMap: "지도에서 추적",
    bestFrame: "베스트 프레임",
    jumpTo: "시각 이동",
    pickTime: "시·분 선택",
    hour: "시",
    minute: "분",
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
  },
} as const;

const BORDER = "1px solid var(--gray-200)";
const STEP_BTN_STYLE: CSSProperties = {
  padding:"6px 12px", borderRadius:"999px", border:"1px solid var(--gray-300)", backgroundColor:"white",
  color:"var(--gray-700)", fontSize:"12px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
};

export interface DetailProps {
  camLabel: string;
  data: CamData;
  initialDet: Detection;
  onBack: () => void;
  /** Date (YYYY-MM-DD) and time (HH:MM:SS) to open on, for deep links that name a specific frame
   *  rather than a camera. Without them the view opens on today at the current second. */
  initialDate?: string;
  initialTime?: string;
  onGoRedmapTrace?: (name: string) => void;
  /** Opens the AI Inspection Detail panel immediately instead of requiring a bounding-box click
   *  first — for deep links (e.g. Dashboard's "Analyze Frame") whose whole point is landing on
   *  the analysis itself, not the plain camera view. */
  autoOpenDetail?: boolean;
}

const DET_COLOR: Record<DetType, string> = { VIP: "var(--primary-400)", Vehicle: "var(--type-vehicle)", Unknown: "var(--type-unknown)" };

const AVATAR = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
];
// A Vehicle-type detection is a car, not a person — it needs its own photo rather than cycling
// through the same face-portrait AVATAR set everything else uses.
const VEHICLE_PHOTO = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=200&q=80";
const DB_PHOTO = "/enrolled-db-sample.png";
const LIVE_CAPTURE_PHOTO = "/live-capture-sample.png";

const ATTRS: Record<DetType, { basic: string[]; top: string[]; bottom: string[]; addons: string[] }> = {
  VIP:     { basic:["ASIAN","MALE","34YR"],  top:["WHITE TOP","LONG SLEEVE"],   bottom:["BROWN BOTTOM","TROUSERS"], addons:["NO BACKPACK"] },
  Unknown: { basic:["ASIAN","MALE","28YR"],  top:["RED JACKET","SHORT SLEEVE"], bottom:["BLACK JEANS"],             addons:["BACKPACK"] },
  Vehicle: { basic:["SEDAN","WHITE","2020"], top:["SGX411"],                    bottom:[],                          addons:["REGISTERED"] },
};

const REGISTERED: Record<DetType, string> = {
  VIP:     "Admin_Staff (Parking Zone F)",
  Unknown: "N/A — No registration found",
  Vehicle: "Navy Fleet Registry",
};

// ── Timeline time model ─────────────────────────────────────────
// Everything below works in "seconds since midnight" so stepping/ticking is plain arithmetic —
// the frame strip is generated fresh each render from whatever instant is currently selected,
// rather than indexing into one fixed hardcoded list the way the old FRAMES array did.
//
// Coarse navigation is a two-tier hour/minute picker (see the Hour bar / Minute bar below)
// instead of a Zoom preset toggle — you pick an hour, then a minute within it, rather than
// zooming a single axis in and out. The thumbnail strip below always shows a fixed, tight
// 2-second-per-frame span around wherever that lands, for precise second-level scrubbing.
const THUMB_COUNT = 60; // more than fits on screen at once — the strip scrolls to reveal the rest
const THUMB_STEP_SEC = 2;
// (COUNT - 1), not COUNT — the thumbnails sit edge-to-edge at fractions i/(COUNT-1), so there
// are only COUNT-1 gaps between them. Using COUNT here made 40/19 the real gap size, which
// rounds to 2s most of the time but occasionally drifts to 3s — a visible uneven/clustered look.
const AXIS_SPAN_SEC = THUMB_STEP_SEC * (THUMB_COUNT - 1);
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
// Shared by the thumbnail strip and the guide-line's height so the line stops exactly at the
// strip's top edge instead of running down through the thumbnail images themselves.
const THUMB_STRIP_HEIGHT = 126;

function pad2(n: number) { return String(Math.floor(n)).padStart(2, "0"); }
function secToHHMMSS(sec: number): string {
  const s = ((sec % 86400) + 86400) % 86400;
  return `${pad2(s / 3600)}:${pad2((s % 3600) / 60)}:${pad2(s % 60)}`;
}
// "HH:MM:SS" -> seconds since midnight, the inverse of secToHHMMSS — lets a real Detection.time
// be compared against a thumbnail's own sec value.
function hhmmssToSec(time: string): number {
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}
// Deterministic pseudo-random in [0,1) — same shape as the seeded-mock-data helpers used
// elsewhere in the app (e.g. RedFace's associate graph). There's no real per-second detection
// feed in this mock data model, so the timeline's "AI detection" window is a stable, camera-
// dependent pattern rather than a fabricated-but-changing-on-every-render one.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function seedFromLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 100000;
  return h + 1;
}
// How many people are visible in a given thumbnail's frame — there's no real per-frame headcount
// in this mock data model, so this is a deterministic, camera+time-seeded stand-in, in a
// plausible 4–28 range.
function personCountFor(seed: number): number {
  // Squared so the distribution skews toward the low end — most frames are ordinary foot
  // traffic, with only occasional crowded spikes. A flat 4–28 range put ~75% of frames over the
  // 10-person "crowded" alert threshold, which made the alert dot fire on almost every thumbnail
  // and stop meaning anything.
  return Math.round(3 + seededRandom(seed) ** 2 * 27);
}

/* ── Solid type icon ───────────────────────────────────────── */
function TypeIcon({ type, color, size = 11, active = false }: { type: DetType; color: string; size?: number; active?: boolean }) {
  if (type === "VIP") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.78072 1.63333C5.80231 1.59413 5.83401 1.56145 5.87253 1.53868C5.91105 1.51592 5.95498 1.50391 5.99972 1.50391C6.04447 1.50391 6.0884 1.51592 6.12692 1.53868C6.16544 1.56145 6.19714 1.59413 6.21872 1.63333L7.69472 4.43533C7.72992 4.50021 7.77905 4.55649 7.83858 4.60014C7.89811 4.64378 7.96656 4.67371 8.03902 4.68776C8.11149 4.70181 8.18616 4.69965 8.25769 4.68142C8.32922 4.66319 8.39583 4.62935 8.45272 4.58233L10.5912 2.75033C10.6323 2.71694 10.6829 2.69744 10.7357 2.69463C10.7885 2.69182 10.8409 2.70585 10.8853 2.7347C10.9296 2.76355 10.9637 2.80573 10.9826 2.85517C11.0014 2.90461 11.0041 2.95876 10.9902 3.00983L9.57322 8.13283C9.5443 8.23766 9.48199 8.33021 9.39573 8.39644C9.30947 8.46266 9.20397 8.49896 9.09522 8.49983H2.90472C2.79589 8.49907 2.69028 8.46282 2.60392 8.39658C2.51756 8.33035 2.45517 8.23774 2.42622 8.13283L1.00972 3.01033C0.995849 2.95926 0.998535 2.90511 1.01739 2.85567C1.03625 2.80623 1.07032 2.76405 1.11467 2.7352C1.15903 2.70635 1.2114 2.69232 1.26424 2.69513C1.31708 2.69794 1.36767 2.71744 1.40872 2.75083L3.54672 4.58283C3.60362 4.62985 3.67023 4.66369 3.74176 4.68192C3.81328 4.70015 3.88796 4.70231 3.96042 4.68826C4.03289 4.67421 4.10134 4.64428 4.16087 4.60064C4.2204 4.55699 4.26953 4.50071 4.30472 4.43583L5.78072 1.63333Z" fill={active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "Unknown") return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <g clipPath="url(#typeIconUnknownClip)">
        <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" fill={active ? "var(--warning-200)" : "none"} stroke={active ? "var(--warning-200)" : color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.30249 5.25009C5.43963 4.86023 5.71033 4.53148 6.06663 4.32208C6.42293 4.11268 6.84185 4.03614 7.24918 4.106C7.65651 4.17587 8.02597 4.38764 8.29212 4.70381C8.55827 5.01998 8.70394 5.42014 8.70332 5.83342C8.70332 7.00009 6.95332 7.58342 6.95332 7.58342" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 9.91675H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="typeIconUnknownClip"><rect width="14" height="14" fill="white"/></clipPath>
      </defs>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M14 5.33336L12.6667 6.66669L11.6667 4.20003C11.5724 3.94758 11.4038 3.72964 11.1831 3.57493C10.9625 3.42022 10.7001 3.33599 10.4307 3.33336H5.6C5.32834 3.32712 5.06125 3.40403 4.83451 3.5538C4.60778 3.70357 4.43221 3.91904 4.33133 4.17136L3.33333 6.66669L2 5.33336" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66663 9.33325H4.67413" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3334 9.33325H11.3409" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" fill={active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33337 12V13.3333" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6666 12V13.3333" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Person-count glyph, for the thumbnail headcount chip ─────── */
function PersonCountIcon({ size = 10, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <circle cx="6" cy="4" r="2.25" stroke={color} strokeWidth="1.1"/>
      <path d="M1.75 10.5C1.75 8.15279 3.65279 6.25 6 6.25C8.34721 6.25 10.25 8.15279 10.25 10.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Small alert badge — a crowded frame (10+ people) worth flagging at a glance ─ */
function AlertDot({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* White outline around the red triangle — against a busy/light photo background the red
          edge alone barely read as a shape. */}
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" fill="var(--danger-400)" stroke="white" strokeWidth="2"/>
      <path d="M12 9v4" stroke="white" strokeWidth="2"/>
      <path d="M12 17h.01" stroke="white" strokeWidth="2"/>
    </svg>
  );
}

/* ── Reel filter chips ────────────────────────────────────────── */
type ReelFilter = DetType | "All";

function ReelFilterIcon({ type, color, active = false }: { type: DetType; color: string; active?: boolean }) {
  if (type === "Unknown") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
        <g clipPath="url(#reelUnknownClip)">
          <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" fill={active ? "var(--warning-200)" : "none"} stroke={active ? "var(--warning-200)" : color} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.30249 5.25009C5.43963 4.86023 5.71033 4.53148 6.06663 4.32208C6.42293 4.11268 6.84185 4.03614 7.24918 4.106C7.65651 4.17587 8.02597 4.38764 8.29212 4.70381C8.55827 5.01998 8.70394 5.42014 8.70332 5.83342C8.70332 7.00009 6.95332 7.58342 6.95332 7.58342" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 9.91675H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <defs>
          <clipPath id="reelUnknownClip"><rect width="14" height="14" fill="white"/></clipPath>
        </defs>
      </svg>
    );
  }
  return <TypeIcon type={type} color={color} size={14} active={active} />;
}

function ReelFilterBar({ filter, onChange }: { filter: ReelFilter; onChange: (f: ReelFilter) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  // "VIP" is the same word in both languages; the other three get translated.
  const REEL_FILTER_CFG: { id: ReelFilter; label: string; color?: string }[] = [
    { id:"All",     label: t.all },
    { id:"VIP",     label:"VIP",       color: DET_COLOR.VIP },
    { id:"Vehicle", label: t.vehicle,  color: DET_COLOR.Vehicle },
    { id:"Unknown", label: t.unknown,  color: DET_COLOR.Unknown },
  ];
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
      {REEL_FILTER_CFG.map(f => {
        const active = filter === f.id;
        if (f.id === "All") {
          return (
            <button key="All" onClick={() => onChange("All")} style={{
              padding:"6px 14px", borderRadius:"999px", cursor:"pointer",
              border: active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)",
              backgroundColor: active ? "var(--gray-900)" : "white",
              color: active ? "white" : "var(--gray-700)", fontSize:"12px", fontWeight: active ? 700 : 600,
            }}>All</button>
          );
        }
        const c = f.color!;
        return (
          <button key={f.id} onClick={() => onChange(f.id)} style={{
            display:"flex", alignItems:"center", gap:"5px",
            padding:"6px 10px", borderRadius:"999px", cursor:"pointer",
            border: active ? `1px solid ${c}` : "1px solid var(--gray-300)",
            backgroundColor: active ? c : "white",
            color: active ? "white" : "var(--gray-700)", fontSize:"12px", fontWeight: active ? 700 : 600,
          }}>
            <ReelFilterIcon type={f.id as DetType} color={c} active={active} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tag chip ─────────────────────────────────────────────────── */
function Tag({ label }: { label: string }) {
  return (
    <span style={{ backgroundColor:"var(--gray-100)", borderRadius:"999px", padding:"3px 9px", fontSize:"12px", fontWeight:600, color:"var(--gray-600)", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

/* ── Also-captured card — same visual design as Live Monitoring's grid card
   (MonitorCard in DataPage.tsx): full-bleed photo, bottom gradient, an
   overlapping rounded-square face-crop bubble (VIP gets a purple ring), and a
   white footer with the status/score row and a timestamp row. There's only
   one real photo per detection here (no separate face crop), so the bubble
   reuses it with a scaled-up, top-weighted crop to fake a face-zoom. ─────── */
// Same face-crop-on-top/full-body-below stack the Best Frame Reel cards use, but purely a
// read-only "who else is in this frame" listing — nothing to click through to, unlike the reel
// cards. A plain div, not a button.
function AlsoCapturedCard({ det, index }: { det: Detection; index: number }) {
  const photo = det.type === "Vehicle" ? VEHICLE_PHOTO : AVATAR[index % AVATAR.length];
  const c = DET_COLOR[det.type];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"5px", width:"64px", flexShrink:0 }}>
      <div style={{ width:"100%", aspectRatio:"1/1", borderRadius:"6px", overflow:"hidden", backgroundColor:"var(--gray-900)" }}>
        <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 20%", display:"block", transform:"scale(1.8)", transformOrigin:"50% 20%" }} />
      </div>
      <div style={{ width:"100%", aspectRatio:"1/2", borderRadius:"6px", overflow:"hidden", backgroundColor:"var(--gray-900)" }}>
        <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
      <p style={{ fontSize:"11px", fontWeight:700, color:"var(--gray-900)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", margin:0 }}>
        {det.name}
      </p>
      <span style={{ display:"flex", alignItems:"baseline", gap:"3px" }}>
        <span style={{ fontSize:"10px", fontWeight:800, color:c, letterSpacing:"-0.2px" }}>{det.type}</span>
        {det.type === "VIP" && <span style={{ fontSize:"9px", fontWeight:600, color:"var(--gray-600)" }}>{det.confidence}%</span>}
      </span>
    </div>
  );
}

/* ── Reel card ────────────────────────────────────────────────── */
function ReelCard({ det, index, isFocused, onClick }: { det: Detection; index: number; isFocused: boolean; onClick: () => void }) {
  const c = DET_COLOR[det.type];
  const photo = det.type === "Vehicle" ? VEHICLE_PHOTO : AVATAR[index % AVATAR.length];
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth:0, display:"flex", flexDirection:"column", gap:"6px", cursor:"pointer",
        padding:"8px", margin:"-8px", boxSizing:"border-box", borderRadius:"12px",
        // Mirrors whichever detection is focused on the camera feed — clicking a box there (or
        // this card) keeps the two in sync, matching each other's "focused" outline rather than
        // this being its own independent selection state.
        outline: isFocused ? "2px solid var(--primary-400)" : hovered ? "1px solid var(--gray-300)" : "none",
        backgroundColor: hovered && !isFocused ? "var(--gray-50)" : "transparent",
        transition: "background-color 0.15s ease",
      }}
    >
      {/* Face crop on top, full-body capture below — stacked, not overlapping. The overlapping-
          bubble style (borrowed from Live Monitoring's wider grid cards) didn't hold up at this
          card's narrower width: the bubble scaled up disproportionately large relative to the
          card and read as broken rather than intentional. A plain stack has no such scaling
          issue at any card width. */}
      <div style={{ position:"relative", width:"100%", aspectRatio:"1/1", borderRadius:"10px", overflow:"hidden", backgroundColor:"var(--gray-900)" }}>
        <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 20%", display:"block", transform:"scale(1.8)", transformOrigin:"50% 20%" }} />
        <div style={{ position:"absolute", top:6, left:6, backgroundColor:"rgba(14,22,42,0.75)", borderRadius:"4px", padding:"2px 6px", fontSize:"10px", fontWeight:600, color:"white" }}>
          P-0{index + 1}
        </div>
      </div>
      <div style={{ width:"100%", aspectRatio:"1/2", borderRadius:"10px", overflow:"hidden", backgroundColor:"var(--gray-900)" }}>
        <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        {/* Icon + colored text, no pill background — matches the Dashboard/Sidebar event
            panel's VIP/Tracking badge style (VipBadge/Tracking row in Sidebar.tsx) rather than
            the solid-fill pill this used before. */}
        <span style={{ display:"flex", alignItems:"center", gap:"4px" }}>
          <TypeIcon type={det.type} color={c} size={12} />
          <span style={{ fontSize:"11px", fontWeight:600, color:c }}>{det.type}</span>
        </span>
        {/* Confidence is a match-against-registry score — only meaningful for VIP, since
            Vehicle/Unknown have nothing registered to match against. */}
        {det.type === "VIP" && (
          <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>{det.confidence}%</span>
        )}
      </div>
      {/* Attribute chips (gender, apparel) used to sit here — with a reel that can grow to a
          lot of cards, that's more detail than a scanning glance needs; clicking through to
          Inspection Detail already shows the full attribute breakdown. */}
      {/* Negative margin pulls this closer to the type/confidence row above — the outer gap that
          spaces every child evenly was wider than this specific pair needed. */}
      <p style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.24px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:"-3px" }}>
        {det.name}
      </p>
    </div>
  );
}

/* ── Best Frame Reel panel ─────────────────────────────────────── */
function BestFrameReel({ data, focusedId, onFocus, onSelect, filter, onFilterChange }: {
  data: CamData;
  focusedId: string;
  onFocus: (det: Detection) => void;
  onSelect: (det: Detection) => void;
  filter: ReelFilter;
  onFilterChange: (f: ReelFilter) => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const dets = filter === "All" ? data.detections : data.detections.filter(d => d.type === filter);
  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", flexShrink:0, display:"flex", flexDirection:"column", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px" }}>{t.reelTitle}</p>
          <p style={{ fontSize:"11px", color:"var(--gray-400)", marginTop:"2px" }}>{t.reelSub}</p>
        </div>
        <ReelFilterBar filter={filter} onChange={onFilterChange} />
      </div>
      {/* alignItems:"start" — grid's default "stretch" was forcing every card to match the
          tallest card in its row, which showed up as a huge blank gap inside whichever card
          happened to have the focus outline (the only one where the stretched box was visible
          against the white background). Each card should just size to its own content. */}
      {/* Padding is bigger than the 8px the columnGap/rowGap alone would suggest, on purpose:
          each ReelCard's focus outline is drawn via padding:8px + margin:-8px (so hovering/
          focusing doesn't shift layout), which pushes the outline 8px past the card's own box in
          every direction. Anything less than 8px of clearance on a given side lands the outline
          right on that boundary with no gap — happened first on top (flush against the filter
          chips), then on the sides (flush against the panel edge) — so all four sides carry at
          least 8px clearance now. */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", columnGap:"14px", rowGap:"16px", alignItems:"start" }}>
        {dets.length === 0 && (
          <div style={{ gridColumn:"1 / -1", padding:"24px 0", textAlign:"center", color:"var(--gray-400)", fontSize:"12px" }}>{t.noDetections}</div>
        )}
        {dets.map((det, i) => (
          <ReelCard key={det.id} det={det} index={i} isFocused={det.id === focusedId} onClick={() => { onFocus(det); onSelect(det); }} />
        ))}
      </div>
    </div>
  );
}

/* ── AI Inspection Detail panel ───────────────────────────────── */
function AIInspectionDetail({ det, data, onClose, onGoRedmapTrace }: { det: Detection; data: CamData; onClose: () => void; onGoRedmapTrace?: (name: string) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const attrs = ATTRS[det.type];
  const c = DET_COLOR[det.type];

  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Padding tuned so this header's own bottom border lands at the exact same y as the page
          header's bottom border to its left (both act as one continuous line across the screen,
          not two independently-sized bars that happen to sit side by side) */}
      <div style={{ padding:"12px 16px 10px", borderBottom:BORDER, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontSize:"16px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.32px" }}>{t.inspectionDetail}</p>
        <button onClick={onClose} aria-label={t.close} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-400)", fontSize:"16px", lineHeight:1, padding:"0 2px" }}>✕</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
        {/* Photo comparison */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", marginBottom:"14px" }}>
          <div style={{ flex:"0 0 77px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            <img src={LIVE_CAPTURE_PHOTO} alt="" style={{ width:"77px", height:"177px", objectFit:"cover", objectPosition:"top", borderRadius:"8px", display:"block" }} />
            <p title={t.liveCaptureHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--primary-400)", letterSpacing:"-0.2px", cursor:"help" }}>{t.liveCapture}</p>
          </div>
          <div style={{ flex:1, alignSelf:"flex-end", height:"177px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px" }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M5 4L3 6L5 8" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H13" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 12L13 10L11 8" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 10H3" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{det.confidence || 0}%</span>
          </div>
          <div style={{ flex:"0 0 176px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            <img src={DB_PHOTO} alt="" style={{ width:"176px", height:"177px", objectFit:"cover", objectPosition:"top", borderRadius:"10px", display:"block" }} />
            <p title={t.enrolledDbHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", letterSpacing:"-0.2px", cursor:"help" }}>{t.enrolledDb}</p>
          </div>
        </div>

        {/* Name */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
          <TypeIcon type={det.type} color={c} size={15} />
          <span style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.32px" }}>{det.name}</span>
        </div>
        <p style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-500)", marginBottom:"14px" }}>{t.registeredAs} {REGISTERED[det.type]}</p>

        {/* Divider — info below is separated by rules, not a boxed container */}
        <div style={{ height:"1px", backgroundColor:"var(--gray-200)", marginBottom:"14px" }} />

        {/* Meta */}
        <div style={{ marginBottom:"14px" }}>
          {[[t.cameraName, data.location], [t.eventTime, `${sgtDateKey(new Date())} ${det.time}`]].map(([k, v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", padding:"3px 0" }}>
              <span style={{ fontSize:"12px", color:"var(--gray-500)", fontWeight:600, width:"88px", flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:"13px", color:"var(--gray-900)", fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height:"1px", backgroundColor:"var(--gray-200)", marginBottom:"22px" }} />

        {/* AI Analysis Results */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"10px" }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8.00195 1.33301C8.1574 1.33309 8.30814 1.38798 8.42773 1.4873C8.54731 1.58669 8.62868 1.72508 8.65723 1.87793L9.35742 5.58301C9.40718 5.84636 9.53512 6.08878 9.72461 6.27832C9.9141 6.46781 10.1566 6.5957 10.4199 6.64551L14.126 7.34668C14.2785 7.37528 14.4164 7.45589 14.5156 7.5752C14.615 7.69488 14.6699 7.84638 14.6699 8.00195C14.6698 8.1574 14.6149 8.30814 14.5156 8.42773C14.4163 8.54716 14.2786 8.62864 14.126 8.65723L10.4199 9.35742C10.1566 9.40723 9.91411 9.53511 9.72461 9.72461C9.53511 9.91411 9.40723 10.1566 9.35742 10.4199L8.65723 14.126C8.62864 14.2786 8.54716 14.4163 8.42773 14.5156C8.30814 14.6149 8.1574 14.6698 8.00195 14.6699C7.84638 14.6699 7.69488 14.615 7.5752 14.5156C7.45589 14.4164 7.37528 14.2785 7.34668 14.126L6.64551 10.4199C6.5957 10.1566 6.46781 9.9141 6.27832 9.72461C6.08878 9.53512 5.84636 9.40718 5.58301 9.35742L1.87793 8.65723C1.72508 8.62868 1.58669 8.54731 1.4873 8.42773C1.38798 8.30814 1.33309 8.1574 1.33301 8.00195C1.33301 7.84638 1.38791 7.69488 1.4873 7.5752C1.58668 7.45571 1.72515 7.37522 1.87793 7.34668L5.58301 6.64551C5.8464 6.59573 6.08877 6.46787 6.27832 6.27832C6.46787 6.08877 6.59573 5.8464 6.64551 5.58301L7.34668 1.87793C7.37522 1.72515 7.45571 1.58668 7.5752 1.4873C7.69488 1.38791 7.84638 1.33301 8.00195 1.33301ZM2.66699 12C3.40311 12.0002 3.99982 12.5969 4 13.333C4 14.0693 3.40322 14.6668 2.66699 14.667C1.93061 14.667 1.33301 14.0694 1.33301 13.333C1.33318 12.5968 1.93072 12 2.66699 12ZM13.333 0.833008C13.609 0.833008 13.8328 1.05702 13.833 1.33301V2.16699H14.667C14.943 2.16717 15.167 2.39096 15.167 2.66699C15.1668 2.94288 14.9429 3.16682 14.667 3.16699H13.833V4C13.8328 4.27599 13.609 4.5 13.333 4.5C13.0571 4.49982 12.8332 4.27588 12.833 4V3.16699H12C11.724 3.16699 11.5002 2.94298 11.5 2.66699C11.5 2.39085 11.7239 2.16699 12 2.16699H12.833V1.33301C12.8332 1.05712 13.0571 0.833183 13.333 0.833008Z" fill="var(--gray-900)"/>
          </svg>
          <p style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.26px" }}>{t.analysisResults}</p>
        </div>
        {[[t.attrBasic, attrs.basic], [t.attrTop, attrs.top], [t.attrBottom, attrs.bottom], [t.attrAddons, attrs.addons]]
          .filter(([, v]) => (v as string[]).length > 0)
          .map(([label, tags]) => (
            <div key={label as string} style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"8px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-600)", width:"52px", flexShrink:0, paddingTop:"2px" }}>{label as string}</span>
              <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                {(tags as string[]).map(t => <Tag key={t} label={t} />)}
              </div>
            </div>
          ))}

        {/* Also captured in this frame */}
        {data.detections.filter(d => d.id !== det.id).length > 0 && (
          <>
            <p style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.26px", marginTop:"22px", marginBottom:"12px" }}>{t.alsoCaptured}</p>
            {/* This row scrolls independently of the panel around it, so the panel's own padding
                stops giving the last card any clearance once you've scrolled past it — its
                box-shadow was getting clipped flush against this row's own right/bottom edge.
                Padding directly on the scrollable row itself fixes that at every scroll position. */}
            <div style={{ display:"flex", gap:"8px", overflowX:"auto", padding:"2px 10px 8px 2px" }}>
              {data.detections.filter(d => d.id !== det.id).map((d, i) => (
                <AlsoCapturedCard key={d.id} det={d} index={i} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", flexShrink:0 }}>
        <button onClick={onClose} style={{ padding:"9px 0", borderRadius:"8px", border:BORDER, backgroundColor:"white", color:"var(--gray-700)", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          {t.back}
        </button>
        <button onClick={() => onGoRedmapTrace?.(det.name)} style={{ padding:"9px 0", borderRadius:"8px", border:"none", backgroundColor:"var(--gray-900)", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M16.6667 8.33333C16.6667 13.3333 10 18.3333 10 18.3333C10 18.3333 3.33333 13.3333 3.33333 8.33333C3.33333 6.56522 4.03571 4.86953 5.28596 3.61929C6.5362 2.36905 8.23189 1.66667 10 1.66667C11.7681 1.66667 13.4638 2.36905 14.714 3.61929C15.9643 4.86953 16.6667 6.56522 16.6667 8.33333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 10.8333C11.3807 10.8333 12.5 9.71404 12.5 8.33333C12.5 6.95262 11.3807 5.83333 10 5.83333C8.61929 5.83333 7.5 6.95262 7.5 8.33333C7.5 9.71404 8.61929 10.8333 10 10.8333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.trackOnMap}
        </button>
      </div>
    </div>
  );
}

/* ── Track date calendar ─────────────────────────────────────── */


function buildMonthGrid(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= numDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Builds the "YYYY-MM-DD" key straight from the calendar-grid's own year/month/day numbers —
// NOT by constructing a local-midnight Date and re-deriving it through sgtDateKey, which would
// re-interpret that instant under Singapore's offset and could shift the identified day by one
// whenever the browser's local timezone isn't SGT.
function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function TrackDateCalendar({ selected, onPick }: { selected: string; onPick: (dateKey: string) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [selYear, selMonth] = selected.split("-").map(Number);
  const todayKey = sgtDateKey(new Date());
  const [viewYear, setViewYear] = useState(selYear);
  const [viewMonth, setViewMonth] = useState(selMonth - 1);
  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "numeric" });
  const isCurrentMonth = dateKey(viewYear, viewMonth, 1).slice(0, 7) === todayKey.slice(0, 7);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"224px", padding:"12px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"24px" }}>
        <button onClick={prevMonth} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{monthLabel}</span>
        <button onClick={nextMonth} disabled={isCurrentMonth} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor: isCurrentMonth ? "default" : "pointer", visibility: isCurrentMonth ? "hidden" : "visible", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center" }}>
        {t.weekdays.map(w => <span key={w} style={{ fontSize:"10px", color:"var(--gray-400)", height:"22px", display:"flex", alignItems:"center" }}>{w}</span>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center", rowGap:"2px" }}>
        {cells.map((day, i) => {
          if (day == null) return <div key={i} style={{ width:"28px", height:"28px" }} />;
          const key = dateKey(viewYear, viewMonth, day);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          return (
            <button key={i} disabled={isFuture} onClick={() => onPick(key)} style={{
              width:"28px", height:"28px", borderRadius:"50%", border: isToday && !isSelected ? "1px solid var(--primary-400)" : "none",
              backgroundColor: isSelected ? "var(--primary-400)" : "transparent",
              color: isSelected ? "white" : isFuture ? "var(--gray-300)" : "var(--gray-900)",
              fontSize:"12px", fontWeight: isSelected ? 700 : 500, cursor: isFuture ? "default" : "pointer",
            }}>{day}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function BestFrameDetailPage({ data, initialDet, onBack, onGoRedmapTrace, autoOpenDetail, initialDate, initialTime }: DetailProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [selectedPerson, setSelectedPerson] = useState<Detection | null>(autoOpenDetail ? initialDet : null);
  const [focusedDet, setFocusedDet] = useState<Detection>(initialDet);
  const [trackDate, setTrackDate] = useState(() => initialDate ?? sgtDateKey(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [cameraHovered, setCameraHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reelFilter, setReelFilter] = useState<ReelFilter>("All");
  // The scrub position, in seconds-since-midnight — continuous, not snapped to the thumbnail
  // grid, so the 1s/10s step controls and arrow keys move by exactly that much regardless of
  // where the sampled thumbnails happen to fall within the fixed 10-minute view.
  const [selectedSec, setSelectedSec] = useState(() => {
    if (initialTime) {
      const [h, m, sec] = initialTime.split(":").map(Number);
      return h * 3600 + m * 60 + (sec || 0);
    }
    // Singapore time, not the machine's. Every detection's `time` is an SGT clock string
    // (recentSgtClockTime), the date button beside this reads sgtDateKey, and the header clock is
    // SGT — but this one seed used getHours()/getMinutes() on local time. On any machine that
    // isn't UTC+8 the strip therefore opened hours away from the data it is supposed to be
    // scrubbing: the timestamps under the thumbnails disagreed with the detection list, and the
    // VIP crown (a ±1s test against those same detection times) could match on frames it had no
    // business marking, or never match at all.
    return hhmmssToSec(sgtClockTime(new Date()));
  });
  // The thumbnail strip's own center — deliberately separate from selectedSec. Clicking a
  // thumbnail only needs to move the selection onto whatever's already on screen; recomputing
  // the window around it too made the whole strip re-lay-out under a click that clearly landed
  // on a specific spot, which read as "did that even register?" rather than a real selection.
  // Only explicit navigation (step/arrow keys, Jump to, the hour/minute bars) re-centers the
  // window — see jumpTo() below.
  const [windowCenterSec, setWindowCenterSec] = useState(selectedSec);
  const [hoveredThumbIdx, setHoveredThumbIdx] = useState<number | null>(null);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);

  const axisSpanSec = AXIS_SPAN_SEC;
  const axisStartSec = windowCenterSec - axisSpanSec / 2;
  const currentHour = Math.floor(selectedSec / 3600) % HOURS_IN_DAY;
  const currentMinute = Math.floor((selectedSec % 3600) / 60);
  const camSeed = seedFromLabel(data.camLabel);
  // Sample frame points evenly spread across the visible span — the thumbnails ARE these points
  // (each one is "the frame at this instant"). Real per-second timestamps don't exist for every
  // visible span (a camera might have zero real hits in the current window), so this is a
  // deterministic, evenly-spaced sample set rather than a jittered one.
  // Edge-to-edge (0%..100%), not centered-with-margins, so the first/last thumbnail lines up
  // exactly with the hour/minute bars' own left/right edges below instead of floating inset.
  const thumbFrames = Array.from({ length: THUMB_COUNT }, (_, i) => {
    const frac = i / (THUMB_COUNT - 1);
    return Math.round(axisStartSec + frac * axisSpanSec);
  });
  const centerThumbIdx = thumbFrames.reduce(
    (bestI, t, i) => (Math.abs(t - selectedSec) < Math.abs(thumbFrames[bestI] - selectedSec) ? i : bestI), 0,
  );

  // Explicit navigation — moves the selection AND re-centers the window on it. Clicking a
  // thumbnail deliberately does not go through this (see setSelectedSec calls below).
  const jumpTo = (sec: number) => { setSelectedSec(sec); setWindowCenterSec(sec); };
  const stepBy = (deltaSec: number) => { setSelectedSec(s => s + deltaSec); setWindowCenterSec(s => s + deltaSec); };

  useEscapeKey(() => setDateOpen(false), dateOpen);
  useEscapeKey(() => setTimeOpen(false), timeOpen);
  useEffect(() => {
    if (!dateOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) setDateOpen(false);
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) setTimeOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dateOpen]);

  // "Play" advances the scrub position on a timer — without this, pressing Play only flipped its
  // own icon with nothing else visibly happening.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => stepBy(THUMB_STEP_SEC), 700);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Arrow-key seeking — plain arrows step 1s, Shift+arrow steps 10s, matching the on-screen step
  // buttons. Skipped while the date picker or AI Inspection Detail panel is open so the keys
  // don't fight with whatever's focused there.
  useEffect(() => {
    if (dateOpen || selectedPerson) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") stepBy(e.shiftKey ? -10 : -1);
      else if (e.key === "ArrowRight") stepBy(e.shiftKey ? 10 : 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dateOpen, selectedPerson]);

  // Keeps the selected thumbnail in view as it changes — mainly for step/jump navigation, which
  // can land on a frame that's scrolled off to either side of the now-scrollable strip. A plain
  // thumbnail click never needs this since whatever was clicked is already on screen.
  useEffect(() => {
    thumbRefs.current[centerThumbIdx]?.scrollIntoView({ inline:"center", block:"nearest", behavior:"smooth" });
  }, [centerThumbIdx]);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor:"white" }}>

      {/* ── Top row: camera feed + right panel, side by side. Multi-track event history lives
          BELOW this row (full page width) rather than inside it, so the right panel's height is
          only as tall as the camera feed area — not the full page — and the timeline isn't
          squeezed into the space left over next to a 380px sidebar. ──────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

      {/* ── Main area ─────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

        {/* Breadcrumb */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px", borderBottom:BORDER, backgroundColor:"white", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", color:"var(--gray-500)", fontSize:"13px", fontWeight:600 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t.bestFrame}
            </button>
            {/* Vertical divider — "Best frame" is the only real navigable step here, so it gets
                a back button; the location/date pair to its right is read-only context, not
                another hierarchy level, so it doesn't share the back button's "›" chevron. */}
            <div style={{ width:"1px", height:"14px", backgroundColor:"var(--gray-200)" }} />
            <div style={{ display:"flex", alignItems:"center", gap:"6px", color:"var(--gray-700)", fontSize:"13px", fontWeight:600 }}>
              <svg width="16" height="16" viewBox="1 1 22 22" fill="none">
                <path d="M16 13L21.223 16.482C21.2983 16.5321 21.3858 16.5608 21.4761 16.5652C21.5664 16.5695 21.6563 16.5492 21.736 16.5065C21.8157 16.4639 21.8824 16.4003 21.9289 16.3228C21.9754 16.2452 22 16.1564 22 16.066V7.87C22 7.78202 21.9768 7.6956 21.9328 7.61945C21.8887 7.5433 21.8253 7.48012 21.7491 7.4363C21.6728 7.39248 21.5863 7.36956 21.4983 7.36985C21.4103 7.37015 21.324 7.39366 21.248 7.438L16 10.5" stroke="var(--gray-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 6H4C2.89543 6 2 6.89543 2 8V16C2 17.1046 2.89543 18 4 18H14C15.1046 18 16 17.1046 16 16V8C16 6.89543 15.1046 6 14 6Z" stroke="var(--gray-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {data.location}
            </div>
            <span style={{ color:"var(--gray-500)" }}>·</span>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", color:"var(--gray-700)", fontSize:"13px", fontWeight:600 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="var(--gray-500)" strokeWidth="1.4"/>
                <path d="M8 5v3l2 2" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {sgtDateKey(new Date())}
            </div>
          </div>
          <div style={{ padding:"4px 10px", fontSize:"12px", fontWeight:700, color:"var(--gray-500)" }}>
            AI engine v5.22.2
          </div>
        </div>

        {/* Camera feed — a real CCTV stream has a fixed aspect ratio, so this doesn't stretch
            edge-to-edge on a wide window the way a full-bleed background would; it's capped at a
            realistic width/height and centered on a neutral surface, same idea as the original
            design mockup this was built from. */}
        <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", overflow:"auto", backgroundColor:"var(--gray-100)", minHeight:0, padding:"20px", boxSizing:"border-box" }}>
          <div
            onMouseEnter={() => setCameraHovered(true)}
            onMouseLeave={() => setCameraHovered(false)}
            style={{
              position:"relative", width:"100%",
              // On the Inspection Detail screen (one specific detection focused, boxes for
              // everything else hidden) there's no reason to hold the frame back at the same
              // cap used for the multi-target Best Frame Reel view — let it grow to fill the
              // space, still governed by maxHeight + aspectRatio so it never distorts. A single
              // uploaded image has no timeline eating vertical space either, so it gets the same
              // treatment.
              maxWidth: (selectedPerson || data.sourceType === "image") ? "100%" : "1400px",
              maxHeight:"100%", aspectRatio:"16/9", flexShrink:0, borderRadius:"12px", overflow:"hidden", backgroundColor:"var(--gray-900)",
            }}
          >
            <img src={data.bgUrl ?? ""} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", opacity:0.9 }} />
            <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(to bottom,rgba(14, 22, 42,0) 50%,rgba(14, 22, 42,0.04) 50%)", backgroundSize:"100% 4px" }} />
            <div style={{ position:"absolute", top:12, right:14, backgroundColor:"rgba(14,22,42,0.65)", padding:"3px 8px", fontSize:"10px", fontWeight:600, color:"rgba(255,255,255,0.8)", letterSpacing:"0.5px" }}>
              {sgtDateKey(new Date()).split("-").reverse().join("-")} {focusedDet.time}
            </div>

            {data.detections.map((det, i) => {
              const isFocused = det.id === focusedDet.id;
              if (selectedPerson && !isFocused) return null;
              const isDash = det.type === "Unknown";
              // Every box stays clearly visible (not just the focused one) — focus is conveyed by
              // border width/label opacity below, not by switching to a second, off-palette blue.
              // VIP boxes always render in the primary purple — a VIP hit is an identity signal,
              // not just a focus state, so it stays purple whether focused or not.
              const borderColor = det.type === "VIP" ? "var(--primary-400)" : "var(--type-vehicle)";
              return (
                <div key={det.id}
                  // Just focuses — the same "highlight, don't commit" action as clicking this
                  // detection's card in the reel on the right. Opening Inspection Detail is a
                  // separate, deliberate step (the reel card itself, or "Analyze Frame" on the
                  // HUD elsewhere) rather than something a single click on the box already did.
                  onClick={() => setFocusedDet(det)}
                  style={{
                    position:"absolute", zIndex:10, cursor:"pointer",
                    top:det.top, left:det.left, width:det.width, height:det.height,
                    border:`2px ${isDash ? "dashed" : "solid"} ${borderColor}`,
                    // A separate purple ring for "this is the focused one" — independent of the
                    // box's own type color (VIP purple / Vehicle-Unknown blue) — is what actually
                    // matches the reel card's purple focus outline on the right. Reusing the
                    // type color for focus meant a blue (non-VIP) box and its purple-outlined
                    // card didn't read as the same linked item.
                    boxShadow: isFocused ? "0 0 0 3px var(--primary-400)" : "none",
                    borderRadius:"3px", boxSizing:"border-box",
                    transition:"border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{
                    position:"absolute", bottom:"calc(100% + 4px)", left:0,
                    backgroundColor:"white", padding:"3px 8px",
                    display:"flex", alignItems:"center", gap:"5px", whiteSpace:"nowrap",
                    boxShadow:"0 1px 6px rgba(14,22,42,0.12)",
                    opacity: isFocused ? 1 : 0.85,
                  }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>P-0{i + 1}</span>
                    {det.type === "VIP" && <TypeIcon type="VIP" color="var(--primary-400)" size={10} />}
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-900)" }}>{det.name}</span>
                  </div>
                </div>
              );
            })}

            {/* Play bar (shown on hover) — just Play/Pause now. It used to duplicate skip-back/
                prev/next/skip-forward too, which is exactly what the step-control row below the
                thumbnails does (and does more precisely, in exact 1s/10s amounts) — having both
                was two seek UIs doing the same job. Hidden entirely for a single uploaded image —
                there's no footage behind it to play. Also hidden once Inspection Detail is open —
                that view is inspecting one specific captured instant (boxes for everyone else are
                hidden too), not scrubbing through footage, so "play" has nothing to mean there. */}
            {cameraHovered && data.sourceType !== "image" && !selectedPerson && (
              <button onClick={() => setIsPlaying(p => !p)} style={{
                position:"absolute", bottom:"20px", left:"50%", transform:"translateX(-50%)",
                zIndex:20, background:"none", border:"none", cursor:"pointer", padding:0,
              }}>
                {isPlaying ? (
                  <svg width="52" height="52" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="20" fill="var(--primary-400)"/>
                    <rect x="14" y="13" width="4" height="14" rx="1.5" fill="white"/>
                    <rect x="22" y="13" width="4" height="14" rx="1.5" fill="white"/>
                  </svg>
                ) : (
                  <svg width="52" height="52" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="20" fill="var(--primary-400)"/>
                    <path d="M14.9511 13.9987C14.8189 14.2272 14.7493 14.4864 14.7494 14.7503V25.2497C14.7493 25.5136 14.8189 25.7728 14.9511 26.0013C15.0833 26.2297 15.2734 26.4192 15.5023 26.5507C15.7312 26.6821 15.9907 26.7509 16.2547 26.75C16.5186 26.7491 16.7777 26.6786 17.0057 26.5456L26.0068 21.2959C26.2336 21.1638 26.4219 20.9744 26.5526 20.7468C26.6833 20.5191 26.752 20.2611 26.7518 19.9986C26.7516 19.7361 26.6824 19.4782 26.5513 19.2508C26.4202 19.0234 26.2316 18.8343 26.0045 18.7026L17.0057 13.4544C16.7777 13.3214 16.5186 13.2509 16.2547 13.25C15.9907 13.2491 15.7312 13.3179 15.5023 13.4493C15.2734 13.5808 15.0833 13.7703 14.9511 13.9987Z" fill="white" stroke="white" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel — shares the top row's height with the camera feed, so it's shorter
          than the full page (cut off where the timeline row begins below), not full-height. */}
      {selectedPerson ? (
        <AIInspectionDetail det={selectedPerson} data={data} onClose={() => setSelectedPerson(null)} onGoRedmapTrace={onGoRedmapTrace} />
      ) : (
        <BestFrameReel data={data} focusedId={focusedDet.id} onFocus={setFocusedDet} onSelect={setSelectedPerson} filter={reelFilter} onFilterChange={setReelFilter} />
      )}
      </div>

        {/* ── Timeline (hidden when AI Inspection Detail is open, or when this camera's source is
            a single uploaded image — there are no other real frames to fill it with) — full page
            width, below the camera-feed/right-panel row rather than sharing space with the 380px
            sidebar. ──── */}
        <div style={{ backgroundColor:"white", borderTop:BORDER, flexShrink:0, display: (selectedPerson || data.sourceType === "image") ? "none" : "block" }}>
          {/* Header — title, step controls, and date/jump-to all share this one line (grid, not
              flex, so the step controls stay truly centered regardless of how wide the title or
              the date/jump-to group are). */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", padding:"12px 16px 16px", columnGap:"12px" }}>
            <span title={t.multiTrackHint} style={{ fontSize:"14px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.26px", cursor:"help" }}>{t.multiTrackHistory}</span>
            {/* Step controls — precise ±1s/±10s seeking for when dragging the axis by hand is too
                coarse. Arrow keys do the same (see the keydown effect above); Shift+arrow mirrors
                the ±10s buttons. */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
              <button onClick={() => stepBy(-10)} style={STEP_BTN_STYLE}>◀ 10s</button>
              <button onClick={() => stepBy(-1)} style={STEP_BTN_STYLE}>◀ 1s</button>
              <span style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.3px", minWidth:"92px", textAlign:"center", fontFamily:"monospace" }}>
                {secToHHMMSS(selectedSec)}
              </span>
              <button onClick={() => stepBy(1)} style={STEP_BTN_STYLE}>1s ▶</button>
              <button onClick={() => stepBy(10)} style={STEP_BTN_STYLE}>10s ▶</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"10px" }}>
              {/* Date first, then time — picking the day is the coarser, usually-first choice;
                  the clock icon belongs on the time control below, not here, so this button now
                  gets its own calendar glyph instead of a clock face that made it read as a
                  time control at a glance. */}
              <div ref={dateDropdownRef} style={{ position:"relative" }}>
                <button onClick={() => setDateOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:"8px", padding:"6px 12px", border:"1px solid var(--gray-300)", cursor:"pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="var(--gray-900)" strokeWidth="1.4"/>
                    <path d="M2 6.5H14" stroke="var(--gray-900)" strokeWidth="1.4"/>
                    <path d="M5 2V4.5M11 2V4.5" stroke="var(--gray-900)" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)" }}>{trackDate}</span>
                  <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                    <path d="M2 3L4 5L6 3" stroke="var(--gray-900)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {dateOpen && (
                  <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", backgroundColor:"white", borderRadius:"8px", boxShadow:"0 4px 16px rgba(14, 22, 42,0.12)", border:"1px solid var(--gray-200)", overflow:"hidden", zIndex:50 }}>
                    <TrackDateCalendar selected={trackDate} onPick={(d) => { setTrackDate(d); setDateOpen(false); }} />
                  </div>
                )}
              </div>
              {/* Jump to time — the hour/minute bars and step buttons below are for picking a
                  spot visually; this is the "type 09:00 and go" escape hatch for when you already
                  know the exact instant. A plain text
                  input (not <input type="time">) on purpose — the native time picker renders its
                  AM/PM text and its own little icon in whatever locale the OS is set to (e.g.
                  Korean "오후"), which broke the all-English UI here and came with an accent
                  color that didn't match anything else in the app; this instead matches the
                  date button beside it. The clock icon (moved here from the date button, where
                  it misleadingly looked like a time indicator) now marks the control that's
                  actually about time. */}
              <div ref={timeDropdownRef} style={{ position:"relative" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:"8px", padding:"6px 12px", border:"1px solid var(--gray-300)" }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="var(--gray-500)" strokeWidth="1.4"/>
                    <path d="M8 5v3l2 2" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-500)" }}>{t.jumpTo}</span>
                  {/* key={selectedSec} remounts the field whenever the time moves from anywhere
                      else (the list below, the step buttons, a thumbnail), so an uncontrolled
                      input can't sit there showing a stale time. */}
                  <input
                    key={selectedSec}
                    type="text" inputMode="numeric" placeholder="HH:MM:SS" defaultValue={secToHHMMSS(selectedSec)}
                    onFocus={() => setTimeOpen(false)}
                    onKeyDown={e => {
                      if (e.key !== "Enter") return;
                      const match = e.currentTarget.value.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
                      if (match) jumpTo(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0));
                    }}
                    // Committing on blur too: typing a time and then clicking the strip used to
                    // discard what was typed, with nothing to say Enter was required.
                    onBlur={e => {
                      const match = e.currentTarget.value.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
                      if (match) jumpTo(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0));
                    }}
                    style={{ width:"66px", border:"none", outline:"none", fontSize:"12px", fontWeight:700, color:"var(--gray-900)", fontFamily:"monospace" }}
                  />
                  {/* This control used to be <input type="time">, whose native dropdown is where
                      the hour/minute list came from. That input was dropped because the browser
                      draws its AM/PM in the OS locale (Korean "오후") with an accent colour from
                      nowhere in this app — but typing-only left the control looking like the date
                      dropdown beside it while doing nothing when clicked. This is the same list,
                      drawn here, so it stays in English and the typed path still works. */}
                  <button onClick={() => setTimeOpen(o => !o)} aria-label={t.pickTime}
                    style={{ display:"flex", padding:0, border:"none", background:"none", cursor:"pointer" }}>
                    <svg width="9" height="9" viewBox="0 0 8 8" fill="none" style={{ transform: timeOpen ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                      <path d="M2 3L4 5L6 3" stroke="var(--gray-900)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {timeOpen && (
                  <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:20, display:"flex",
                    backgroundColor:"white", borderRadius:"8px", border:"1px solid var(--gray-200)",
                    boxShadow:"0 4px 16px rgba(14, 22, 42,0.12)", overflow:"hidden" }}>
                    {([
                      { label: t.hour, values: Array.from({ length: HOURS_IN_DAY }, (_, h) => h), current: currentHour,
                        pick: (h: number) => jumpTo(h * 3600 + currentMinute * 60) },
                      { label: t.minute, values: Array.from({ length: 60 }, (_, m) => m), current: currentMinute,
                        pick: (m: number) => jumpTo(currentHour * 3600 + m * 60) },
                    ]).map(col => (
                      <div key={col.label} style={{ display:"flex", flexDirection:"column", borderLeft: col.label === "Min" ? "1px solid var(--gray-200)" : "none" }}>
                        <span style={{ fontSize:"9px", fontWeight:800, color:"var(--gray-400)", letterSpacing:"0.4px",
                          padding:"6px 12px 4px", textTransform:"uppercase" }}>{col.label}</span>
                        <div className="vca-thin-scrollbar" style={{ maxHeight:"188px", overflowY:"auto" }}>
                          {col.values.map(v => (
                            <button key={v} className="vca-picker-option" data-on={v === col.current}
                              onClick={() => { col.pick(v); setTimeOpen(false); }}
                              style={{ display:"block", width:"100%", padding:"5px 16px", border:"none", cursor:"pointer",
                                fontSize:"12px", fontWeight: v === col.current ? 800 : 600, fontFamily:"monospace",
                                color: v === col.current ? "var(--primary-400)" : "var(--gray-700)" }}>
                              {String(v).padStart(2, "0")}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding:"8px 16px 0", position:"relative" }}>
            {/* Thumbnail strip — horizontally scrollable. There are more sampled frames
                (THUMB_COUNT) than fit on screen at once, each a fixed width rather than a
                flex:1 cell, so the row overflows and scrolls instead of shrinking every
                thumbnail to cram them all in — lets you look forward/back along the strip by
                scrolling instead of only through the step/jump controls. */}
            <div className="vca-thin-scrollbar" style={{ position:"relative", height:`${THUMB_STRIP_HEIGHT}px`, zIndex:2, display:"flex", alignItems:"flex-end", gap:"4px", overflowX:"auto" }}>
              {thumbFrames.map((sec, i) => {
                const isSelected = i === centerThumbIdx;
                const personCount = personCountFor(camSeed + sec);
                const crowded = personCount >= 10;
                // Real per-thumbnail VIP presence — each Detection already carries its own real
                // time, so "did a VIP detection fall within this thumbnail's slice of the axis"
                // is genuine data, not a fabricated pattern. One crown per hit, not confined to
                // a single flagged window.
                // Rounded up so a detection sitting exactly at a slice boundary (a common case,
                // since sec is itself rounded) isn't dropped by float rounding on the raw half.
                const halfWindow = Math.ceil(axisSpanSec / THUMB_COUNT / 2);
                const hasVip = data.detections.some(d => d.type === "VIP" && Math.abs(hhmmssToSec(d.time) - sec) <= halfWindow);
                return (
                  <div key={i} ref={el => { thumbRefs.current[i] = el; }} onClick={() => setSelectedSec(sec)}
                    onMouseEnter={() => setHoveredThumbIdx(i)}
                    onMouseLeave={() => setHoveredThumbIdx(prev => (prev === i ? null : prev))}
                    style={{
                    position:"relative", width:"128px", flexShrink:0,
                    display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", cursor:"pointer",
                  }}>
                    {isSelected && (
                      // Positioned out of the flex flow (not conditionally mounted) so toggling
                      // visibility on hover doesn't shift the thumbnail below it up and down.
                      // Shows selectedSec (the precise scrub position), not this thumbnail's own
                      // grid time — otherwise this badge and the step-controls readout could
                      // disagree by up to half a sample interval.
                      <div style={{
                        position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)",
                        display:"flex", flexDirection:"column", alignItems:"center",
                        opacity: hoveredThumbIdx === i ? 1 : 0, pointerEvents:"none", transition:"opacity 0.12s", zIndex:5,
                      }}>
                        <span style={{ fontSize:"12px", fontWeight:800, color:"white", backgroundColor:"var(--primary-400)", padding:"4px 10px", borderRadius:"999px", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                          {secToHHMMSS(selectedSec)}
                        </span>
                        <span style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:"6px solid var(--primary-400)", marginTop:"-2px" }} />
                      </div>
                    )}
                    <div style={{
                      width:"100%", aspectRatio:"8/5", boxSizing:"border-box",
                      border: isSelected ? "3px solid var(--primary-400)" : "1.5px solid var(--gray-200)",
                      borderRadius:"8px",
                    }}>
                      <div style={{ width:"100%", height:"100%", overflow:"hidden", borderRadius: isSelected ? "6px" : "7px", position:"relative", backgroundColor:"var(--gray-800)" }}>
                        <img src={data.bgUrl ?? ""} alt=""
                          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", filter: isSelected ? "none" : "grayscale(100%)", opacity: isSelected ? 1 : 0.75 }} />
                        {/* Headcount chip — see personCountFor()'s comment: a deterministic mock
                            stand-in, not a real per-frame count. 10+ people gets a red alert dot
                            (top-right) so a crowded frame is spottable without reading every
                            number in the strip. */}
                        <div style={{ position:"absolute", left:4, bottom:3, display:"flex", alignItems:"center", gap:"3px", backgroundColor:"rgba(14,22,42,0.72)", padding:"1px 6px", borderRadius:"999px" }}>
                          <PersonCountIcon size={9} />
                          <span style={{ fontSize:"10px", fontWeight:700, color:"white", fontFamily:"monospace" }}>{personCount}</span>
                        </div>
                        {crowded && (
                          <div style={{ position:"absolute", top:3, right:3 }}>
                            <AlertDot size={15} />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Full absolute HH:MM:SS per thumbnail — clearer than a relative offset
                        when frames are only 2 seconds apart, where "+2s"/"+4s" all look alike. */}
                    <span style={{ fontSize:"10px", fontWeight:600, color: isSelected ? "var(--primary-400)" : "var(--gray-500)", fontFamily:"monospace" }}>
                      {secToHHMMSS(sec)}
                    </span>
                    {/* Crown — present/absent only, one per frame that actually had a real VIP
                        hit. Reserves its height even when absent so the label row above doesn't
                        jump around from frame to frame. */}
                    <div style={{ height:"12px" }}>
                      {hasVip && <TypeIcon type="VIP" color="var(--primary-400)" size={12} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour bar / Minute bar — a two-tier coarse navigator (pick the hour, then pick the
              minute within it), moved below the thumbnail strip. Both reuse the same purple
              highlight as the rest of this timeline (bg var(--primary-100) / border var(--primary-400)), not a
              separate accent color. No persistent "Hour 14"/"active number" label sitting on
              the bar itself — instead, hovering any segment pops the same pill+pointer tooltip
              used for the selected thumbnail's time badge above, which already reads clearly on
              first sight there. */}
          <div style={{ padding:"0 16px 10px" }}>
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex", gap:"2px" }}>
                {Array.from({ length: HOURS_IN_DAY }, (_, h) => {
                  const active = h === currentHour;
                  return (
                    <button key={h} onClick={() => jumpTo(h * 3600 + (selectedSec % 3600))}
                      onMouseEnter={() => setHoveredHour(h)}
                      onMouseLeave={() => setHoveredHour(prev => (prev === h ? null : prev))}
                      style={{
                      flex:1, height:"22px", padding:0, border: active ? "1px solid var(--primary-400)" : "none",
                      borderRadius:"4px", backgroundColor: active ? "var(--primary-100)" : "var(--gray-200)", cursor:"pointer",
                      boxSizing:"border-box",
                    }} />
                  );
                })}
              </div>
              {hoveredHour !== null && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 6px)", left:`${((hoveredHour + 0.5) / HOURS_IN_DAY) * 100}%`, transform:"translateX(-50%)",
                  display:"flex", flexDirection:"column", alignItems:"center", pointerEvents:"none", zIndex:5,
                }}>
                  <span style={{ fontSize:"12px", fontWeight:800, color:"white", backgroundColor:"var(--primary-400)", padding:"4px 10px", borderRadius:"999px", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                    Hour {pad2(hoveredHour)}
                  </span>
                  <span style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:"6px solid var(--primary-400)", marginTop:"-2px" }} />
                </div>
              )}
            </div>
            <div style={{ position:"relative", height:"16px", marginTop:"2px" }}>
              {[0, 6, 12, 18].map(h => (
                <span key={h} style={{ position:"absolute", left:`${(h / HOURS_IN_DAY) * 100}%`, fontSize:"11px", fontWeight:600, color:"var(--gray-400)" }}>
                  {pad2(h)}
                </span>
              ))}
            </div>
            <div style={{ position:"relative", marginTop:"8px" }}>
              <div style={{ display:"flex", gap:"1px" }}>
                {Array.from({ length: MINUTES_IN_HOUR }, (_, m) => {
                  const active = m === currentMinute;
                  return (
                    <button key={m} onClick={() => jumpTo(currentHour * 3600 + m * 60 + (selectedSec % 60))}
                      onMouseEnter={() => setHoveredMinute(m)}
                      onMouseLeave={() => setHoveredMinute(prev => (prev === m ? null : prev))}
                      style={{
                      flex:1, height:"14px", padding:0, border: active ? "1px solid var(--primary-400)" : "none",
                      borderRadius:"2px", backgroundColor: active ? "var(--primary-100)" : "var(--gray-200)", cursor:"pointer",
                      boxSizing:"border-box",
                    }} />
                  );
                })}
              </div>
              {hoveredMinute !== null && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 6px)", left:`${((hoveredMinute + 0.5) / MINUTES_IN_HOUR) * 100}%`, transform:"translateX(-50%)",
                  display:"flex", flexDirection:"column", alignItems:"center", pointerEvents:"none", zIndex:5,
                }}>
                  <span style={{ fontSize:"12px", fontWeight:800, color:"white", backgroundColor:"var(--primary-400)", padding:"4px 10px", borderRadius:"999px", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                    Min {pad2(hoveredMinute)}
                  </span>
                  <span style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:"6px solid var(--primary-400)", marginTop:"-2px" }} />
                </div>
              )}
            </div>
            <div style={{ position:"relative", height:"16px", marginTop:"2px" }}>
              {[0, 15, 30, 45].map(m => (
                <span key={m} style={{ position:"absolute", left:`${(m / MINUTES_IN_HOUR) * 100}%`, fontSize:"11px", fontWeight:600, color:"var(--gray-400)" }}>
                  {pad2(m)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
