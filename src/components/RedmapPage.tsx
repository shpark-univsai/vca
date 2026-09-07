"use client";

import { useState, useRef, useEffect } from "react";
import RedmapMap from "./RedmapMap";
import type { RedmapMode as Mode, SimilarityLimit, HitResult, DateRange } from "@/types/redmap";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "./Toast";
import { formatElapsed, parseSgtStamp, recentSgtStamp, sgtDateKey } from "@/lib/time";
import { canSearchInApp, useVcaStore } from "@/lib/vcaStore";
import RemoveImageButton from "./RemoveImageButton";
import SidebarToggleIcon from "./SidebarToggleIcon";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. Site names, camera codes, plate numbers and the
// seeded match labels are data and stay as they are.
const T = {
  en: {
    noPermissionTitle: "Person search permission required",
    noPermissionBody: "Redmap only shows results from a search, so with no search permission there is nothing to show. An administrator can grant it in the Portal, under Users & Permissions.",
    close: "Close",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    dragAndDrop: "Drag and drop an image here",
    searchTargets: "Search targets",
    searchResults: "Search results",
    excluded: "Excluded",
    restore: "Restore",
    modePerson: "PERSON",
    modeVehicle: "VEHICLE",
    licensePlate: "License plate",
    face: "Face",
    body: "Body",
    searchByImage: (what: string) => `${what} — search by image`,
    removeImage: (what: string) => `Remove ${what} image`,
    similarity: "Similarity",
    bodyOnlyHint: "Body-only search: matching on build and clothing alone is looser than a face match, so a low threshold here returns many false positives.",
    searching: "Searching…",
    searchVehicle: "Search vehicle",
    searchPersons: "Search persons",
    clickToUpload: "Click to upload",
    clickToChange: "Click to change",
    emptyQueryTitle: "Enter a search",
    emptyQueryPlate: "Enter a license plate to search.",
    emptyQueryImage: "Upload a face or body image to search.",
    noSightingsTitle: "No matching sightings",
    noPlateOnRecord: "Nothing on record for that plate.",
    noImageOnRecord: "Nothing on record resembling this image.",
    belowThreshold: (n: number, pct: number) => `${n} match${n === 1 ? "" : "es"} below ${pct}%`,
    lowerThreshold: "Lower the similarity threshold to include them.",
    outsideDates: (n: number) => `${n} match${n === 1 ? "" : "es"} outside the date range`,
    widenDates: "Widen the date range to include them.",
    scoredBelow: (n: number, pct: number) => `${n} match${n === 1 ? "" : "es"} scored below ${pct}%.`,
    lowerToSee: "Lower the similarity threshold to see them.",
    fallOutside: (n: number) => `${n} match${n === 1 ? "" : "es"} fall outside the date range.`,
    widenToSee: "Widen the date range to see them.",
    noSightingsFound: "No matching sightings found.",
    tryDifferentPhoto: "Try a different face or body photo.",
    promptPerson: "Upload a face or body image",
    promptPersonAnd: "above and click",
    promptVehicle: "Enter a license plate and click",
    showResults: "Show search results",
    hideResults: "Hide search results",
    newestFirst: "Newest first",
    oldestFirst: "Oldest first",
    hideFrame: "Hide captured frame",
    showFrame: "Show captured frame",
    removedFromTrace: (place: string) => `Removed "${place}" from this trace`,
    undo: "Undo",
    notSamePerson: "Not the same person — remove from this trace",
  },
  ko: {
    noPermissionTitle: "인물 검색 권한이 필요합니다",
    noPermissionBody: "Redmap은 검색으로만 결과를 보여주는 화면이라, 검색 권한 없이는 보여줄 것이 없습니다. 관리자에게 요청하면 포털의 사용자 및 권한에서 열어 줄 수 있습니다.",
    close: "닫기",
    prevMonth: "지난달",
    nextMonth: "다음달",
    dragAndDrop: "이미지를 여기로 끌어다 놓으세요",
    searchTargets: "검색 대상",
    searchResults: "검색 결과",
    excluded: "제외됨",
    restore: "복원",
    modePerson: "사람",
    modeVehicle: "차량",
    licensePlate: "차량 번호",
    face: "얼굴",
    body: "전신",
    searchByImage: (what: string) => `${what} — 이미지로 검색`,
    removeImage: (what: string) => `${what} 이미지 삭제`,
    similarity: "유사도",
    bodyOnlyHint: "전신만으로 검색하면 체형과 옷차림만 비교하므로 얼굴 대조보다 느슨합니다. 기준을 낮추면 다른 사람이 많이 섞입니다.",
    searching: "검색 중…",
    searchVehicle: "차량 검색",
    searchPersons: "인물 검색",
    clickToUpload: "눌러서 업로드",
    clickToChange: "눌러서 변경",
    emptyQueryTitle: "검색할 내용을 입력해주세요",
    emptyQueryPlate: "차량 번호를 입력해주세요.",
    emptyQueryImage: "얼굴 또는 전신 이미지를 올려주세요.",
    noSightingsTitle: "일치하는 검출 기록이 없습니다",
    noPlateOnRecord: "해당 차량 번호의 기록이 없습니다.",
    noImageOnRecord: "이 이미지와 닮은 기록이 없습니다.",
    belowThreshold: (n: number, pct: number) => `${pct}% 미만 ${n}건`,
    lowerThreshold: "유사도 기준을 낮추면 포함됩니다.",
    outsideDates: (n: number) => `기간 밖 ${n}건`,
    widenDates: "기간을 넓히면 포함됩니다.",
    scoredBelow: (n: number, pct: number) => `${n}건이 ${pct}% 미만으로 나왔습니다.`,
    lowerToSee: "유사도 기준을 낮추면 볼 수 있습니다.",
    fallOutside: (n: number) => `${n}건이 선택한 기간 밖에 있습니다.`,
    widenToSee: "기간을 넓히면 볼 수 있습니다.",
    noSightingsFound: "일치하는 검출 기록이 없습니다.",
    tryDifferentPhoto: "다른 얼굴 또는 전신 사진으로 시도해보세요.",
    promptPerson: "얼굴 또는 전신 이미지를 올린 뒤",
    promptPersonAnd: "위에서",
    promptVehicle: "차량 번호를 입력한 뒤",
    showResults: "검색 결과 보기",
    hideResults: "검색 결과 숨기기",
    newestFirst: "최신순",
    oldestFirst: "오래된 순",
    hideFrame: "검출 프레임 숨기기",
    showFrame: "검출 프레임 보기",
    removedFromTrace: (place: string) => `이 경로에서 "${place}"를 제외했습니다`,
    undo: "되돌리기",
    notSamePerson: "같은 사람이 아닙니다 — 이 경로에서 제외",
  },
} as const;

const BORDER = "1px solid var(--gray-200)";

// The search window a screen opens with. An unbounded search — which is what an empty range meant
// — is rarely what an operator wants and gives no clue why a result set is as large or as empty as
// it is; with a window on the toolbar, the answer is visible without asking. Widen it to look
// further back. Dates only, computed once, so a server pass and the client agree except across an
// SGT midnight, and even then only on a default the user can see and change.
const DEFAULT_SEARCH_DAYS = 7;
const DEFAULT_DATE_RANGE: DateRange = {
  start: recentSgtStamp(DEFAULT_SEARCH_DAYS * 24 * 60).date,
  end: recentSgtStamp(0).date,
};

// Unlike BestFramePage's camera list (now sourced from the shared VIP_SIMULATION_CAMERAS pool —
// see vcaStore.ts), these hits are intentionally hand-authored narrative content (specific face/
// body photos, elapsed-time framing, isUnregistered flag) rather than a checkable camera list, so
// there's no real payoff in re-keying them onto shared camera ids the way BestFrame's bulk filler
// was. `location` is the place ("Clarke Quay Riverside"), `camera` the unit that saw them
// ("CQ1"), `mapLabel` a short form for a map pin ("Clarke Quay") — three separate jobs, not
// three spellings of one string as they used to be. None of them corresponds to a real camera id in
// CAMERAS/VIP_SIMULATION_CAMERAS today — that's fine as long as nothing cross-navigates from a
// Redmap hit to another page by name (nothing currently does). If a "View Live"/"Open in Best
// Frame" action ever gets added here, it'll hit the same silent-match-failure bug the Dashboard's
// device popup had (see BestFramePage.tsx's focusLocation handling) unless these are re-keyed
// onto real camera ids first.
export const MOCK_RESULTS: HitResult[] = [
  {
    id: "hit-1",
    camera: "NC 1",
    location: "Novena",
    ...recentSgtStamp(3004, 57),
    score: "99.7%",
    bodyScore: "85.0%",
    isUnregistered: false,
    faceUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Novena",
    lat: 1.3200, lng: 103.8440,
    elapsed: "20m 12s",
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-2",
    camera: "NC 3",
    location: "Geylang",
    ...recentSgtStamp(2974, 25),
    score: "99.4%",
    bodyScore: "78.2%",
    isUnregistered: false,
    faceUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Geylang",
    lat: 1.3131, lng: 103.8600,
    elapsed: "30m 32s",
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-3",
    camera: "NC 2",
    location: "Marine Parade",
    ...recentSgtStamp(1495),
    score: "82.3%",
    bodyScore: "70.1%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Marine Parade",
    lat: 1.3015, lng: 103.9070,
    personId: "p1", personLabel: "Match 1",
  },
];

// A real search doesn't always come back with a full 3-camera trail — sometimes the person only
// shows up once or twice, sometimes not at all. These extra sets let a search "miss" or come back
// thin instead of always returning the same rich trace, which was the whole trace feature reading
// as fake. `RESULT_SETS` is what searches actually pick from; `MOCK_RESULTS` stays as its own
// export (unchanged) since `lib/api/redmap.ts` already imports it as the future-backend stub's
// default payload.
const RESULT_SET_MODERATE: HitResult[] = [
  {
    id: "hit-m1",
    camera: "JR1",
    location: "Jurong Gateway Mall",
    ...recentSgtStamp(1595, 35),
    score: "81.2%",
    bodyScore: "73.5%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Jurong",
    lat: 1.3329, lng: 103.7436,
    elapsed: "1h 40m",
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-m2",
    camera: "CQ1",
    location: "Clarke Quay Riverside",
    ...recentSgtStamp(1495),
    score: "79.8%",
    bodyScore: "71.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Clarke Quay",
    lat: 1.2884, lng: 103.8460,
    personId: "p1", personLabel: "Match 1",
  },
];

const RESULT_SET_SPARSE: HitResult[] = [
  {
    id: "hit-s1",
    camera: "TH1",
    location: "Tampines Concourse",
    ...recentSgtStamp(1495),
    score: "76.4%",
    bodyScore: "68.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Tampines",
    lat: 1.3530, lng: 103.9440,
    personId: "p1", personLabel: "Match 1",
  },
];

// A low-similarity search can genuinely surface more than one distinct person, not just several
// sightings of the same one — this set demonstrates that so the person-filter chips (see
// distinctPersons below) have something real to group/color-code. Two people, two sightings each.
const RESULT_SET_LOOKALIKES: HitResult[] = [
  {
    id: "hit-l1",
    camera: "BM1",
    location: "Bugis MRT Station",
    ...recentSgtStamp(1565, 7),
    score: "58.3%",
    bodyScore: "52.0%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Bugis",
    lat: 1.3006, lng: 103.8559,
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-l2",
    camera: "CH2",
    location: "City Hall Link",
    ...recentSgtStamp(1519, 31),
    score: "55.1%",
    bodyScore: "49.8%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "City Hall",
    lat: 1.2930, lng: 103.8520,
    personId: "p1", personLabel: "Match 1",
  },
  {
    id: "hit-l3",
    camera: "SS1",
    location: "Somerset Skywalk",
    ...recentSgtStamp(1540, 16),
    score: "56.7%",
    bodyScore: "50.2%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Somerset",
    lat: 1.3006, lng: 103.8390,
    personId: "p2", personLabel: "Match 2",
  },
  {
    id: "hit-l4",
    camera: "DG3",
    location: "Dhoby Ghaut Xchange",
    ...recentSgtStamp(1495),
    score: "54.4%",
    bodyScore: "48.1%",
    isUnregistered: true,
    faceUrl: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=100&h=100&q=80",
    bodyUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=200&q=80",
    mapLabel: "Dhoby Ghaut",
    lat: 1.2988, lng: 103.8455,
    personId: "p2", personLabel: "Match 2",
  },
];

const RESULT_SET_EMPTY: HitResult[] = [];

const RESULT_SETS: HitResult[][] = [MOCK_RESULTS, RESULT_SET_MODERATE, RESULT_SET_SPARSE, RESULT_SET_EMPTY, RESULT_SET_LOOKALIKES];

// Deterministic (not random) so re-running the exact same search — same uploaded file, same
// license plate — always lands on the same result set instead of flickering between runs.
// Different inputs will usually (not always — it's a small hash space) land on a different one.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Colors assigned to distinct people in a result set, in first-appearance order — shared by the
// person-filter chips, each result card's person tag, and that person's trail/markers on the map,
// so the same color always means the same person across all three.
const PERSON_COLORS = ["#5a3dfb", "#38bdf8", "#f43f5e", "#16a34a", "#f59e0b"];

/* ── SVG Icons ──────────────────────────────────────────────── */
function PersonIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M9.99992 10.8333C12.3011 10.8333 14.1666 8.96785 14.1666 6.66667C14.1666 4.36548 12.3011 2.5 9.99992 2.5C7.69873 2.5 5.83325 4.36548 5.83325 6.66667C5.83325 8.96785 7.69873 10.8333 9.99992 10.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.6666 17.4987C16.6666 15.7306 15.9642 14.0349 14.714 12.7847C13.4637 11.5344 11.768 10.832 9.99992 10.832C8.23181 10.832 6.53612 11.5344 5.28587 12.7847C4.03563 14.0349 3.33325 15.7306 3.33325 17.4987" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function VehicleIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M15.8334 14.1654H17.5001C18.0001 14.1654 18.3334 13.832 18.3334 13.332V10.832C18.3334 10.082 17.7501 9.41536 17.0834 9.2487C15.5834 8.83203 13.3334 8.33203 13.3334 8.33203C13.3334 8.33203 12.2501 7.16536 11.5001 6.41536C11.0834 6.08203 10.5834 5.83203 10.0001 5.83203H4.16675C3.66675 5.83203 3.25008 6.16536 3.00008 6.58203L1.83341 8.9987C1.72306 9.32055 1.66675 9.65845 1.66675 9.9987V13.332C1.66675 13.832 2.00008 14.1654 2.50008 14.1654H4.16675" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83335 15.8333C6.75383 15.8333 7.50002 15.0871 7.50002 14.1667C7.50002 13.2462 6.75383 12.5 5.83335 12.5C4.91288 12.5 4.16669 13.2462 4.16669 14.1667C4.16669 15.0871 4.91288 15.8333 5.83335 15.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 14.168H12.5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.1667 15.8333C15.0871 15.8333 15.8333 15.0871 15.8333 14.1667C15.8333 13.2462 15.0871 12.5 14.1667 12.5C13.2462 12.5 12.5 13.2462 12.5 14.1667C12.5 15.0871 13.2462 15.8333 14.1667 15.8333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// currentColor, not a hardcoded token: these sit immediately left of a line of text and are
// meant to read as part of it, so they take the colour from the row rather than keeping their own
// that can drift out of step with it. Coordinates land on half-pixels and the stroke is 1.2 —
// a 1.1 stroke on quarter-pixel edges was rendering thinner than a hairline once antialiased.
// The mock face URLs are square 100x100 crops — right for a 64px thumbnail, wrong for a frame:
// a captured video frame is landscape. Re-requesting the same photo as a 16:9 crop at roughly 2x
// keeps the opened frame sharp instead of upscaling a 100px square. Real detection data would
// carry its own frame URL and this would go.
function frameImageSrc(url: string): string {
  return url.replace(/w=\d+&h=\d+/, "w=640&h=360");
}

function ExpandFrameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5.5 1.5H1.5V5.5M8.5 1.5H12.5V5.5M8.5 12.5H12.5V8.5M5.5 12.5H1.5V8.5"
            stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIconXs() {
  // The supplied camera glyph, redrawn on a 12-unit grid instead of scaled down from its original
  // 20. Its coordinates (1.66675, 13.3333, …) land between pixels once multiplied by 0.6, and a
  // 2-wide stroke comes out at 1.2px straddling two of them — the whole thing renders as a smear
  // at this size. Here every edge sits on a half-pixel with a 1-wide stroke, so the viewBox maps
  // 1:1 to device pixels. Same body-plus-lens-wedge shape and roughly the same proportions
  // (body:wedge was 2.33:1, now 2:1).
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="3.5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M7.5 5.5L10.5 3.5V8.5L7.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIconXs() {
  // Best Frame's clock ("Jump to" control) at the same 12-unit grid and 1-wide stroke as the
  // camera beside it — its own 16-unit geometry scales to exactly this (r 6 → 4.5), so nothing
  // about the shape changes, only where it lands on the pixel grid.
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
      <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2.5" width="12" height="10" rx="2" stroke="var(--gray-400)" strokeWidth="1.2" />
      <path d="M1 6.5h12" stroke="var(--gray-400)" strokeWidth="1.2" />
      <path d="M4 1v3M10 1v3" stroke="var(--gray-400)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FaceIcon({ color = "var(--gray-400)" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
      <circle cx="5" cy="6" r="0.8" fill={color} />
      <circle cx="9" cy="6" r="0.8" fill={color} />
      <path d="M5 9.5c.5.7 3.5.7 4 0" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function BodyIcon({ color = "var(--gray-400)" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="3" r="1.8" stroke={color} strokeWidth="1.2" />
      <path d="M4 7h6M7 5v5M5 13l2-3 2 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 5.33336L12.6667 6.66669L11.6667 4.20003C11.5724 3.94758 11.4038 3.72964 11.1831 3.57493C10.9625 3.42022 10.7001 3.33599 10.4307 3.33336H5.6C5.32834 3.32712 5.06125 3.40403 4.83451 3.5538C4.60778 3.70357 4.43221 3.91904 4.33133 4.17136L3.33333 6.66669L2 5.33336" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6665 9.33325H4.67317" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.3335 9.33325H11.3402" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.3335 12V13.3333" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6665 12V13.3333" stroke="var(--gray-400)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8C2 9.18669 2.35189 10.3467 3.01118 11.3334C3.67047 12.3201 4.60754 13.0892 5.7039 13.5433C6.80026 13.9974 8.00666 14.1162 9.17054 13.8847C10.3344 13.6532 11.4035 13.0818 12.2426 12.2426C13.0818 11.4035 13.6532 10.3344 13.8847 9.17054C14.1162 8.00666 13.9974 6.80026 13.5433 5.7039C13.0892 4.60754 12.3201 3.67047 11.3334 3.01118C10.3467 2.35189 9.18669 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 2V5.33333H5.33333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 3H6a3 3 0 0 0-3 3v3M15 3h3a3 3 0 0 1 3 3v3M9 21H6a3 3 0 0 1-3-3v-3M15 21h3a3 3 0 0 0 3-3v-3" stroke="var(--gray-900)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="var(--gray-900)" strokeWidth="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 4L14 14M14 4L4 14" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Deliberately bolder/redder than CloseIcon — this removes a sighting from the trace, not just
// dismisses a panel, so it needs to read as "this one's wrong" at a glance, not as generic chrome.
function RemoveFromTraceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2L4.7 8.4L9.5 3.6" stroke="var(--primary-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIconSm({ color = "var(--gray-600)" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 11S10 7.5 10 4.8A4 4 0 0 0 2 4.8C2 7.5 6 11 6 11Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="6" cy="4.8" r="1.4" stroke={color} strokeWidth="1.1" />
    </svg>
  );
}

/* ── DateRangePicker ──────────────────────────────────────── */
// Korean names its months by number, so the "full" and "short" forms are the same string.
const MONTHS_FULL: Record<AppLanguage, string[]> = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  ko: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
};
const MONTHS_SHORT: Record<AppLanguage, string[]> = {
  en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  ko: MONTHS_FULL.ko,
};
const DAY_HEADS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"start"|"end">("start");
  // Opens on the month being edited, not a hardcoded one. This was pinned to June 2026 back when
  // the mock sightings carried fixed June dates; they are relative to now since, so the calendar
  // was opening three months away from anything it could select.
  const initialView = (value.start ?? value.end ?? recentSgtStamp(0).date).split("-");
  const [viewYear, setViewYear] = useState(parseInt(initialView[0], 10));
  const [viewMonth, setViewMonth] = useState(parseInt(initialView[1], 10) - 1); // 0-indexed
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector("[data-active='true']");
      el?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const toDateStr = (day: number) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

  const formatDisplay = (d: string | null) => {
    if (!d) return null;
    const [y, m, day] = d.split("-");
    return lang === "ko"
      ? `${y}. ${MONTHS_SHORT.ko[parseInt(m)-1]} ${parseInt(day)}일`
      : `${MONTHS_SHORT.en[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
  };

  const handleDayClick = (day: number) => {
    const ds = toDateStr(day);
    if (step === "start") {
      onChange({ start: ds, end: null });
      setStep("end");
    } else {
      if (value.start && ds < value.start) onChange({ start: ds, end: value.start });
      else onChange({ start: value.start, end: ds });
      setStep("start");
      setOpen(false);
    }
  };

  const dayState = (day: number): "start"|"end"|"range"|"none" => {
    const d = toDateStr(day);
    if (d === value.start) return "start";
    if (d === value.end) return "end";
    if (value.start && value.end && d > value.start && d < value.end) return "range";
    return "none";
  };

  const monthList: { year: number; month: number }[] = [];
  for (let y = 2023; y <= 2027; y++) for (let m = 0; m < 12; m++) monthList.push({ year: y, month: m });

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const sd = formatDisplay(value.start);
  const ed = formatDisplay(value.end);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger button */}
      <div
        onClick={() => { setOpen(o=>!o); setStep("start"); }}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          border: `1px solid ${open ? "var(--primary-200)" : "var(--gray-200)"}`,
          borderRadius: "999px", padding: "0 20px", height: "36px",
          backgroundColor: "white", cursor: "pointer", userSelect: "none",
        }}
      >
        <CalendarIcon />
        <span style={{ fontSize: "12px", fontWeight: 600, color: sd ? "var(--gray-800)" : "var(--gray-500)", whiteSpace: "nowrap" }}>
          {sd || "Start date"}
        </span>
        <span style={{ color: "var(--gray-300)", fontSize: "12px" }}>-</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: ed ? "var(--gray-800)" : "var(--gray-500)", whiteSpace: "nowrap" }}>
          {ed || "End date"}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "42px", left: 0, zIndex: 2000,
          backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(14, 22, 42,0.12)", display: "flex", overflow: "hidden", width: "560px",
        }}>
          {/* Left: month list */}
          <div ref={listRef} style={{
            width: "148px", borderRight: "1px solid var(--gray-200)",
            overflowY: "auto", maxHeight: "360px", flexShrink: 0,
            paddingTop: "4px", paddingBottom: "4px",
          }}>
            {monthList.map(({ year, month }) => {
              const active = year === viewYear && month === viewMonth;
              return (
                <div
                  key={`${year}-${month}`}
                  data-active={active ? "true" : undefined}
                  onClick={() => { setViewYear(year); setViewMonth(month); }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                  style={{
                    padding: "9px 16px", fontSize: "13px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--primary-400)" : "var(--gray-900)",
                    backgroundColor: active ? "var(--primary-100)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  {MONTHS_SHORT[lang][month]} {year}
                </div>
              );
            })}
          </div>

          {/* Right: calendar */}
          <div style={{ flex: 1, padding: "16px 20px" }}>
            {/* Step pills */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              {(["start","end"] as const).map(s => (
                <span key={s} style={{
                  fontSize: "12px", padding: "2px 10px", borderRadius: "999px", fontWeight: 600,
                  backgroundColor: step === s ? "var(--primary-100)" : "var(--gray-100)",
                  color: step === s ? "var(--primary-400)" : "var(--gray-400)",
                  border: `1px solid ${step === s ? "var(--primary-200)" : "var(--gray-200)"}`,
                }}>
                  {s === "start" ? `Start${sd ? " · "+sd : " · pick"}` : `End${ed ? " · "+ed : " · pick"}`}
                </span>
              ))}
            </div>

            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <button onClick={prevMonth} aria-label={t.prevMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--gray-900)", padding: "2px 6px", lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{lang === "ko" ? `${viewYear}년 ${MONTHS_FULL.ko[viewMonth]}` : `${MONTHS_FULL.en[viewMonth]} ${viewYear}`}</span>
              <button onClick={nextMonth} aria-label={t.nextMonth} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--gray-900)", padding: "2px 6px", lineHeight: 1 }}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "2px" }}>
              {DAY_HEADS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", padding: "3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
              {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const ds = dayState(day);
                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={e => { if (ds === "none") e.currentTarget.style.backgroundColor = "var(--gray-100)"; }}
                    onMouseLeave={e => { if (ds === "none") e.currentTarget.style.backgroundColor = "transparent"; }}
                    style={{
                      height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: ds === "start" || ds === "end" ? 700 : 400,
                      cursor: "pointer", borderRadius: ds === "start" || ds === "end" ? "50%" : "4px",
                      color: ds === "start" || ds === "end" ? "white" : ds === "range" ? "var(--primary-400)" : "var(--gray-900)",
                      backgroundColor: ds === "start" || ds === "end" ? "var(--primary-400)" : ds === "range" ? "var(--primary-100)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Clear */}
            {(value.start || value.end) && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button
                  onClick={() => { onChange({ start: null, end: null }); setStep("start"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "var(--gray-400)", fontWeight: 600 }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────── */
export default function RedmapPage({ initialSearchName, onInitialSearchConsumed }: { initialSearchName?: string | null; onInitialSearchConsumed?: () => void } = {}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const { showToast } = useToast();
  // Redmap is search and nothing else — with no search there is no map to look at, so the whole
  // screen is gated rather than its button. See PortalUser.appSearch.
  const portalUsers = useVcaStore(state => state.portalUsers);
  const searchAllowed = canSearchInApp(portalUsers);
  const [mode, setMode] = useState<Mode>("person");
  const [similarity, setSimilarity] = useState<SimilarityLimit>(70);
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [licensePlate, setLicensePlate] = useState("");
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  // Identifies the uploaded file's content (name+size) independently of its blob: URL, which is
  // randomly generated per upload and can't be hashed for a reproducible result set — see
  // `handleSearch` below.
  const [faceFileKey, setFaceFileKey] = useState<string | null>(null);
  const [bodyFileKey, setBodyFileKey] = useState<string | null>(null);
  const [results, setResults] = useState<HitResult[]>(MOCK_RESULTS);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeHit, setActiveHit] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [uploadFor, setUploadFor] = useState<"face" | "body" | null>(null);
  const [hoverUpload, setHoverUpload] = useState<"face" | "body" | null>(null);
  // Separate from hoverUpload: that one drives the left panel's preview boxes, and sharing it
  // would make hovering a toolbar chip light up the matching preview across the screen.
  const [hoverChip, setHoverChip] = useState<"face" | "body" | null>(null);
  // One frame open at a time, by node key. A map pin hover preview was tried first and the cards
  // overlapped each other whenever two sightings sat close together; opening in the panel instead
  // means the frame has room and can only ever collide with itself.
  const [openFrameKey, setOpenFrameKey] = useState<string | null>(null);
  const [hoverFrameKey, setHoverFrameKey] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  // Ticks only while a route is on screen. The newest sighting's pill reads "how long since we
  // last saw them", measured against the real clock, so it has to keep counting rather than sit
  // at whatever the gap was when the search ran. Starts null so the server-rendered pass has
  // nothing time-dependent in it.
  const [nowMs, setNowMs] = useState<number | null>(null);
  // Pressing Search has to visibly do something even when the outcome is identical to last time.
  // Two searches that both come back empty used to leave the screen byte-for-byte unchanged, so
  // there was no way to tell "no matches" from "the button didn't register".
  const [searching, setSearching] = useState(false);
  // WHY a search came back with nothing, so the panel can say something the user can act on
  // instead of one catch-all line. Three different causes, three different next moves.
  const [emptyReason, setEmptyReason] = useState<
    { kind: "no-candidates" } | { kind: "similarity"; dropped: number } | { kind: "date"; dropped: number } | null
  >(null);
  const [traceName, setTraceName] = useState<string | null>(null);
  const [timelineNewestFirst, setTimelineNewestFirst] = useState(true);
  // A sighting that's obviously a different person (see the X button on each trace node below)
  // gets pulled out of the route without being deleted from the underlying search results — the
  // left result list still shows it, just dimmed, so excluding is a correction to the trace, not
  // a destructive edit to what was actually found.
  const [excludedHitIds, setExcludedHitIds] = useState<Set<string>>(new Set());
  // Which distinct person(s) the map/route-history panel currently trace — only meaningful (and
  // only shown as chips) when the current results actually contain more than one distinct person.
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Tracks the last `initialSearchName` value already consumed, following React's "adjusting
  // state when a prop changes" pattern (state, not a ref, so it's safe to read during render).
  // Starts at `undefined` — a sentinel no real name/`null` can equal — so a deep-link name
  // present on the very FIRST mount (RedmapPage isn't kept mounted across tab switches, so this
  // is the common case, not an edge case) is still detected as "new" instead of being silently
  // treated as already-consumed because it happened to match the initial state.
  const [consumedSearchName, setConsumedSearchName] = useState<string | null | undefined>(undefined);
  useEscapeKey(() => setUploadFor(null), uploadFor !== null);

  // Compared in Singapore time, not the browser's: on New Year's Eve a device a few hours behind
  // would otherwise decide "same year" differently from the clock the sightings are stamped in.
  const sgtYear = nowMs !== null ? sgtDateKey(new Date(nowMs)).slice(0, 4) : null;
  const routeOnScreen = hasSearched && results.length > 0;
  useEffect(() => {
    if (!routeOnScreen) return;
    // The first reading is deferred to the next tick rather than taken here: reading the clock
    // during the effect would put a time-dependent value into the very first committed render,
    // which is both a purity violation and a hydration hazard. A no-value first frame just falls
    // back to the recorded gap for one frame.
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setNowMs(Date.now());
      timer = setInterval(() => setNowMs(Date.now()), 1000);
    }, 0);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [routeOnScreen]);

  // Deep-link from Dashboard's Tracking route popup ("View Full Trace on RedMap") — jump
  // straight to the completed-search view instead of requiring the user to fill the form.
  // Search results are the same mock set either way; this just labels whose trace it is.
  if (initialSearchName != null && initialSearchName !== consumedSearchName) {
    setConsumedSearchName(initialSearchName);
    setMode("person");
    setResults(MOCK_RESULTS);
    setHasSearched(true);
    setActiveHit(null);
    setActiveNode(null);
    setSelectedPersonIds(new Set([MOCK_RESULTS[MOCK_RESULTS.length - 1].personId]));
    setTraceName(initialSearchName);
  }

  // Tell the parent its deep-link hint has been consumed — a real side effect (notifying an
  // external callback), so it belongs in an effect rather than the render-phase block above.
  useEffect(() => {
    if (initialSearchName) onInitialSearchConsumed?.();
  }, [initialSearchName, onInitialSearchConsumed]);

  // A body-only search has only build and clothing to go on, which matches far more loosely than a
  // face does — the same 70% a face search treats as solid confidence lets in the kind of
  // lookalike-heavy results RESULT_SET_LOOKALIKES demonstrates. That used to be enforced: the
  // threshold was pushed to 75% on a body-only upload and the lower presets were disabled. It is
  // now advice, not a rule — the operator, not the UI, decides how wide to cast the net, and a
  // deliberately loose pass over body-only footage is a legitimate thing to want. The warning
  // lives on the label's tooltip instead.
  const bodyOnly = mode === "person" && !!bodyFileKey && !faceFileKey;

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const key = `${file.name}_${file.size}`;
    // Replacing an image leaks the one it replaces unless the old blob is revoked here.
    const previous = uploadFor === "face" ? faceImage : bodyImage;
    if (previous) URL.revokeObjectURL(previous);
    if (uploadFor === "face") { setFaceImage(url); setFaceFileKey(key); }
    else if (uploadFor === "body") { setBodyImage(url); setBodyFileKey(key); }
    setUploadFor(null);
  };

  // Backs the "Drag and drop an image here" copy in the upload popup — without this the dropzone
  // was decorative (only the "Choose Image" button actually worked).
  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const key = `${file.name}_${file.size}`;
    const previous = uploadFor === "face" ? faceImage : bodyImage;
    if (previous) URL.revokeObjectURL(previous);
    if (uploadFor === "face") { setFaceImage(url); setFaceFileKey(key); }
    else if (uploadFor === "body") { setBodyImage(url); setBodyFileKey(key); }
    setUploadFor(null);
  };

  // Detaching an attached image unsets the query, not just the preview: the file key has to go
  // with it (handleSearch's "did you give me anything to search for" check and the result-set
  // hash both key off the keys, not the preview URL), and the object URL is revoked so the blob
  // isn't held for the rest of the session.
  const clearUpload = (key: "face" | "body") => {
    const url = key === "face" ? faceImage : bodyImage;
    if (url) URL.revokeObjectURL(url);
    if (key === "face") {
      setFaceImage(null);
      setFaceFileKey(null);
    } else {
      setBodyImage(null);
      setBodyFileKey(null);
    }
    // Detaching the LAST image leaves nothing to search for, so the previous run's results and
    // route come down with it — a map still tracing a query the user just withdrew reads as the
    // current answer. Not routed through "0 results" either: that says the search came back
    // empty, when in fact there is no longer a search at all. Back to the landing state.
    const remaining = key === "face" ? bodyImage : faceImage;
    if (!remaining) clearSearchOutcome();
  };

  const handleSearch = () => {
    // An empty query used to still run — hashing down to whichever RESULT_SET the empty key
    // landed on (often RESULT_SET_EMPTY) — and land on "No matching sightings found," reading as
    // a real search that failed rather than a search that was never actually given anything to
    // look for. Block it before it runs and say so instead.
    const hasQuery = mode === "car" ? licensePlate.trim().length > 0 : !!faceFileKey || !!bodyFileKey;
    if (!hasQuery) {
      showToast({ variant:"warning", title: t.emptyQueryTitle, desc: mode === "car"
        ? t.emptyQueryPlate
        : t.emptyQueryImage });
      return;
    }
    // Which result set comes back depends on what was actually searched for — the same
    // face/body/plate always reproduces the same outcome, but a different upload will usually
    // land on a different (or empty) set instead of always showing the same 3-camera trail
    // regardless of input.
    const searchKey = mode === "car"
      ? `car:${licensePlate.trim().toUpperCase()}`
      : `person:${faceFileKey ?? ""}|${bodyFileKey ?? ""}`;
    const picked = RESULT_SETS[hashStr(searchKey) % RESULT_SETS.length];
    // dateRange was collected in the toolbar but never actually consulted here — picking a range
    // that excludes every mock hit's date still returned the exact same results as picking
    // nothing at all. Both fields are already "YYYY-MM-DD" strings, so this is a plain string
    // comparison, no Date parsing needed.
    const inDateRange = (date: string) =>
      (!dateRange.start || date >= dateRange.start) && (!dateRange.end || date <= dateRange.end);
    // The similarity control used to be decorative — this is what actually keeps a low-confidence
    // match out of the results instead of just labeling it low-confidence. Body-only searches
    // compare against bodyScore (see the bodyOnly note above); everything else compares
    // against the face-anchored score.
    const afterSimilarity = mode === "person"
      ? picked.filter(hit => parseFloat(bodyOnly ? hit.bodyScore : hit.score) >= similarity)
      : picked;
    const filtered = afterSimilarity.filter(hit => inDateRange(hit.date));
    // Nothing to show can mean three quite different things, and the fix differs each time:
    // nothing resembled the query at all, matches existed but scored under the threshold, or
    // they scored fine but fall outside the chosen dates. Saying which turns a dead end into a
    // next step.
    const reason = filtered.length > 0 ? null
      : picked.length === 0 ? { kind: "no-candidates" as const }
      : afterSimilarity.length === 0 ? { kind: "similarity" as const, dropped: picked.length }
      : { kind: "date" as const, dropped: afterSimilarity.length };
    setEmptyReason(reason);
    if (reason) {
      showToast(reason.kind === "no-candidates"
        ? { variant: "default", title: t.noSightingsTitle, desc: mode === "car"
            ? t.noPlateOnRecord
            : t.noImageOnRecord }
        : reason.kind === "similarity"
        ? { variant: "warning", title: t.belowThreshold(reason.dropped, similarity),
            desc: t.lowerThreshold }
        : { variant: "warning", title: t.outsideDates(reason.dropped),
            desc: t.widenDates });
    }
    setResults(filtered);
    setExcludedHitIds(new Set());
    setHasSearched(true);
    // Nothing is selected until the user selects something. The route (map line + timeline) shows
    // the whole result set on its own, so pre-selecting the most recent hit added no information —
    // it just put a selected outline on a card nobody had picked, which read as arbitrary.
    setActiveHit(null);
    setActiveNode(null);
    // If these results span more than one distinct person, default the trace to just the most
    // recent hit's person — an empty selection would leave the map/timeline blank, and selecting
    // everyone by default would recreate the exact overlapping-paths confusion the chips exist
    // to prevent.
    setSelectedPersonIds(filtered.length ? new Set([filtered[filtered.length - 1].personId]) : new Set());
    // A manual search is a fresh, untargeted query — clear any "Tracing: <name>" label left over
    // from a Dashboard deep-link, otherwise these generic results stay mislabeled as tracing that
    // earlier person until Reset is clicked.
    setTraceName(null);
    // A short, deliberate busy window. The result itself is already applied; this only holds the
    // results area in a "searching" state long enough to be seen, so pressing the button always
    // reads as having done something — including the case where the outcome is byte-for-byte
    // identical to the previous search.
    setSearching(true);
    window.setTimeout(() => setSearching(false), 450);
  };

  // Everything describing the OUTCOME of a search, as opposed to the query settings
  // (mode / similarity / date range) which are the user's own configuration and survive.
  // Shared by Reset and by detaching the last attached image.
  const clearSearchOutcome = () => {
    setResults(MOCK_RESULTS);
    setHasSearched(false);
    setActiveHit(null);
    setActiveNode(null);
    setSelectedPersonIds(new Set());
    setTraceName(null);
    setExcludedHitIds(new Set());
  };

  const handleReset = () => {
    setMode("person");
    setSimilarity(70);
    setDateRange(DEFAULT_DATE_RANGE);
    setLicensePlate("");
    setFaceImage(null);
    setBodyImage(null);
    setFaceFileKey(null);
    setBodyFileKey(null);
    clearSearchOutcome();
  };

  const handleHitClick = (index: number) => {
    setActiveHit(index);
    setActiveNode(index);
  };

  const handleNodeClick = (index: number) => {
    setActiveNode(index);
  };

  const handleMarkerClick = (index: number) => {
    if (!hasSearched) return;
    setActiveHit(index);
    setActiveNode(index);
  };

  // The tracking route (map line + right panel timeline) reflects the whole set of search
  // results, so it should appear as soon as a search has run — not only once a specific
  // result is clicked. A search that came back with no hits has nothing to trace.
  const trackingActive = hasSearched && results.length > 0;
  // An attached image is enough to open the left panel, before any search has run — otherwise the
  // only handle on an attached image is the toolbar chip, whose hover is delete-only, so swapping
  // one out meant detaching and re-attaching. With the panel open its preview offers
  // click-to-change directly.
  const hasSearchTargets = mode === "person" && !!(faceImage || bodyImage);

  // Distinct people in the CURRENT results, in first-appearance order. Chips only render when
  // there's more than one — a single person's own sightings don't need disambiguating, and
  // showing a one-chip row every search would just be noise.
  const distinctPersons = Array.from(new Map(results.map((h) => [h.personId, h.personLabel])).entries())
    .map(([personId, personLabel], i) => ({ personId, personLabel, color: PERSON_COLORS[i % PERSON_COLORS.length] }));
  const showPersonChips = distinctPersons.length > 1;
  const personColor = (personId: string) => distinctPersons.find((p) => p.personId === personId)?.color ?? PERSON_COLORS[0];
  const togglePerson = (personId: string) => {
    setSelectedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId); else next.add(personId);
      return next;
    });
  };

  const inputBase: React.CSSProperties = {
    background: "none", border: "none", outline: "none",
    fontSize: "13px", fontWeight: 600, color: "var(--gray-800)",
    fontFamily: "'SUIT', sans-serif",
  };

  // Redmap is search and nothing else — with no search there is no map to look at, so the whole
  // screen is gated rather than its button. Portal grants this per account (PortalUser.appSearch).
  if (!searchAllowed) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.36px" }}>
            {t.noPermissionTitle}
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", lineHeight: 1.7 }}>
            {t.noPermissionBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>

      <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleUploadFile} style={{ display: "none" }} />

      {/* ── Image upload popup ── */}
      {uploadFor && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setUploadFor(null); }}
          style={{
            position: "absolute", inset: 0, zIndex: 2000, backgroundColor: "rgba(14,22,42,0.15)",
            display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "24px",
          }}>
          <div style={{
            width: "730px", height: "303px", boxSizing: "border-box", backgroundColor: "white",
            border: "1px solid var(--gray-200)", borderRadius: "8px",
            boxShadow: "0 2px 12px rgba(14, 22, 42,0.08)",
            padding: "12px", display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setUploadFor(null)} aria-label={t.close} style={{
                width: "37px", height: "37px", borderRadius: "8px", backgroundColor: "var(--gray-50)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CloseIcon />
              </button>
            </div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropFile}
              style={{
                flex: 1, borderRadius: "12px", border: "1px dashed var(--gray-300)",
                backgroundColor: "var(--gray-50)", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px 24px",
              }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "var(--gray-100)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FocusIcon />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary-400)" }}>{t.dragAndDrop}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>
                  File types supported: JPG, PNG, GIF, TIFF, HEIC, WebP. Max size 50MB
                </span>
              </div>
              <button
                onClick={() => uploadInputRef.current?.click()}
                style={{
                  padding: "10px 16px", borderRadius: "24px", border: "none", cursor: "pointer",
                  backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700,
                  boxShadow: "0 4px 4px rgba(29,41,59,0.1)",
                }}
              >
                Choose image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search bar ──
          Always one row. The full set of person filters wants ~1710px, and on a 14" laptop
          (1512) the row used to overflow — the page's overflow:hidden then cut Reset and Search
          clean off the right edge, so the primary action of the screen was invisible. Scrolling
          the filters only moved the cut into the middle of the similarity presets, and wrapping to
          a second row cost the map 44px and looked wrong. What gives instead is the controls
          themselves. The 60/70/80/90 presets are gone for good — the slider covers every value
          they did in less width, and the % readout beside it says where you are. Past that, the
          vca-tb-* rules in globals.css drop the "Search by image" hints (the dashed pill and its
          icon already say "attach an image"), then the word "Similarity". */}
      <div style={{
        backgroundColor: "white", borderBottom: BORDER,
        padding: "0 24px", height: "52px",
        display: "flex", alignItems: "center", flexWrap: "nowrap",
        gap: "20px", flexShrink: 0,
      }}>

        {/* Mode toggle */}
        <div style={{
          display: "flex", alignItems: "center", flexShrink: 0,
          backgroundColor: "var(--gray-100)", borderRadius: "999px",
          padding: "2px", gap: "12px", height: "36px", boxSizing: "border-box",
        }}>
          {(["person", "car"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  height: "32px", padding: "0 20px", flexShrink: 0,
                  borderRadius: "999px", border: "none",
                  cursor: "pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "var(--primary-400)" : "var(--gray-500)",
                  fontWeight: active ? 800 : 600, fontSize: "13px", letterSpacing: "-0.26px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  boxShadow: active ? "0 1px 3px rgba(14, 22, 42,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "person"
                  ? <PersonIcon color={active ? "var(--primary-400)" : "var(--gray-400)"} size={18} />
                  : <VehicleIcon color={active ? "var(--primary-400)" : "var(--gray-400)"} size={18} />}
                {m === "person" ? t.modePerson : t.modeVehicle}
              </button>
            );
          })}
        </div>

        {mode === "car" ? (
          /* ── VEHICLE mode fields ── */
          <>
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div style={{ width: "1px", height: "24px", flexShrink: 0, backgroundColor: "var(--gray-200)" }} />

            {/* License plate */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>{t.licensePlate}</span>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                border: BORDER, borderRadius: "999px",
                padding: "0 10px 0 12px", height: "36px", backgroundColor: "white",
                minWidth: "160px",
              }}>
                <PlateIcon />
                <input
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="SGA 1234 X"
                  style={{ ...inputBase, width: "100px" }}
                />
                {licensePlate && (
                  <button
                    onClick={() => setLicensePlate("")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", fontSize: "14px", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ── PERSON mode fields ── */
          <>
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div style={{ width: "1px", height: "24px", flexShrink: 0, backgroundColor: "var(--gray-200)" }} />

            {/* Search by image chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
              {([
                { key: "face" as const, label: t.face, image: faceImage },
                { key: "body" as const, label: t.body, image: bodyImage },
              ]).map(({ key, label, image }) => {
                const active = !!image;
                const uploading = uploadFor === key;
                const highlighted = active || uploading;
                const iconColor = highlighted ? "var(--gray-700)" : "var(--gray-400)";
                return (
                  // A wrapper, not a plain button: in the loaded state a hover overlay sits on
                  // top offering "delete", and that overlay has to be its own button — which can't
                  // nest inside one. The pill's own border/background live out here so the overlay
                  // can clip to the same rounded shape.
                  <div
                    key={key}
                    onMouseEnter={() => setHoverChip(key)}
                    onMouseLeave={() => setHoverChip(null)}
                    style={{
                      position: "relative", height: "36px", borderRadius: "999px", overflow: "hidden",
                      border: `1px dashed ${highlighted ? "var(--primary-400)" : "var(--gray-400)"}`,
                      backgroundColor: highlighted ? "var(--primary-100)" : "white",
                      display: "flex", alignItems: "center", flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => setUploadFor(key)}
                      title={t.searchByImage(label)}
                      style={{
                        height: "100%", padding: "0 12px", background: "none", border: "none",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", whiteSpace: "nowrap" }}>
                        {key === "face" ? <FaceIcon color={iconColor} /> : <BodyIcon color={iconColor} />} {label}
                      </span>
                      {active ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--primary-400)", whiteSpace: "nowrap" }}>
                          <CheckIconSm /> Loaded
                        </span>
                      ) : (
                        <span className="vca-tb-hint" style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                          Search by image
                        </span>
                      )}
                    </button>
                    {/* Loaded state, on hover: the whole pill becomes "delete". Detach is the only
                        action offered here — pairing it with a "change" half made one small chip
                        carry two competing targets. Swapping an image is delete, then attach
                        again; the left panel's preview still offers click-to-change directly once
                        a search has run. */}
                    {active && hoverChip === key && (
                      <button
                        onClick={() => clearUpload(key)}
                        aria-label={t.removeImage(label)}
                        style={{
                          position: "absolute", inset: 0, border: "none", cursor: "pointer",
                          backgroundColor: "rgba(14, 22, 42, 0.55)",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          fontSize: "12px", fontWeight: 700, color: "white",
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M2 2L9 9M9 2L2 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ width: "1px", height: "24px", flexShrink: 0, backgroundColor: "var(--gray-200)" }} />

            {/* Similarity — the slider alone. It used to sit beside 60/70/80/90 preset chips, but
                the two controls set the same one number and the chips cost ~190px in a toolbar that
                could not afford them; the slider reaches every value the chips did, plus the ones
                between. Arrow keys still step it by 1 for anything the drag can't land on. */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <span className="vca-tb-label" style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", whiteSpace: "nowrap" }}
                title={bodyOnly ? t.bodyOnlyHint : undefined}
              >{t.similarity}</span>
              {/* Resets the browser's native range-input chrome (Chrome/Safari/Firefox each draw
                  their own track/thumb border by default) down to a flat gray track + solid
                  purple thumb — same treatment as Data's Smart Search Similarity slider. */}
              <style>{`
                .vca-similarity-slider { -webkit-appearance:none; appearance:none; background:transparent; outline:none; border:none; }
                .vca-similarity-slider::-webkit-slider-runnable-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
                .vca-similarity-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; margin-top:-5px; cursor:pointer; }
                .vca-similarity-slider::-moz-range-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
                .vca-similarity-slider::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; cursor:pointer; }
              `}</style>
              <input
                className="vca-similarity-slider"
                type="range" min={0} max={100} value={similarity}
                onChange={e => setSimilarity(Number(e.target.value))}
                style={{ width: "120px", flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", width: "30px", flexShrink: 0 }}>{similarity}%</span>
            </div>
          </>
        )}

        {/* marginLeft:auto rather than a flex:1 spacer — a spacer is one more flex item to lay out
            and shrink, and this needs nothing but "push the actions to the right edge". */}
        <div style={{ display: "flex", gap: "12px", flexShrink: 0, marginLeft: "auto" }}>
          <button
            onClick={handleReset}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              height: "36px", padding: "0 20px", borderRadius: "8px",
              border: "none", backgroundColor: "transparent", cursor: "pointer",
              color: "var(--gray-600)", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap",
              fontFamily: "'SUIT', sans-serif", flexShrink: 0,
            }}
          >
            <ResetIconSm /> Reset
          </button>
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              height: "36px", padding: "0 20px", borderRadius: "8px",
              border: "none", cursor: searching ? "default" : "pointer",
              backgroundColor: searching ? "var(--gray-600)" : "var(--gray-900)", color: "white",
              fontWeight: 800, fontSize: "14px", letterSpacing: "-0.28px", whiteSpace: "nowrap",
              fontFamily: "'SUIT', sans-serif", flexShrink: 0,
            }}
          >
            {searching ? t.searching : mode === "car" ? t.searchVehicle : t.searchPersons}
          </button>
        </div>
      </div>

      {/* ── Main 3-column area (always visible) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT: Search Targets + Search Results. Mounts as soon as there's an attached image to
            preview, not only after a search — the results half stays hidden until a search runs.
            Originally gated on hasSearched alone;
            the landing state is just the search bar + full-width map, no side panels. */}
        {(hasSearched || hasSearchTargets) && !leftCollapsed && (
        <div style={{
          width: "320px", backgroundColor: "white", borderRight: BORDER,
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>

          {/* vca-thin-scrollbar — the native scrollbar eats into the right padding since it sits
              inside the border-box, on top of the content edge; a thin custom scrollbar shrinks
              that so the left/right padding reads as symmetric instead of the right side looking
              squeezed. */}
          <div className="vca-thin-scrollbar" style={{ flex: 1, overflow: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Search Targets (read-only preview of the uploaded face/body) ── */}
            {hasSearchTargets && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>{t.searchTargets}</h3>
                  <div style={{ display: "flex", gap: "24px" }}>
                    {([
                      { key: "face" as const, image: faceImage, height: "100px" },
                      { key: "body" as const, image: bodyImage, height: "140px" },
                    ]).map(({ key, image, height }) => (
                      <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                        <span style={{
                          fontSize: "12px", fontWeight: 700, color: "var(--primary-400)",
                          backgroundColor: "var(--primary-100)", borderRadius: "6px",
                          padding: "4px 8px", alignSelf: "flex-start",
                        }}>
                          {key === "face" ? t.face : t.body}
                        </span>
                        <div
                          onClick={() => setUploadFor(key)}
                          onMouseEnter={() => setHoverUpload(key)}
                          onMouseLeave={() => setHoverUpload(null)}
                          style={{
                            height, borderRadius: "12px", overflow: "hidden", position: "relative", cursor: "pointer",
                            border: hoverUpload === key ? "1px dashed var(--primary-400)" : "1px dashed var(--gray-300)",
                            backgroundColor: image ? "white" : "var(--gray-100)",
                          }}
                        >
                          {image && (
                            <img src={image} style={{
                              width: "100%", height: "100%", objectFit: "cover", display: "block",
                              opacity: hoverUpload === key ? 0.5 : 1, transition: "opacity 0.15s",
                            }} alt="" />
                          )}
                          {hoverUpload === key && (
                            <div style={{
                              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              backgroundColor: image ? "rgba(14,22,42,0.35)" : "transparent",
                            }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: image ? "white" : "var(--primary-400)" }}>
                                {image ? t.clickToChange : t.clickToUpload}
                              </span>
                            </div>
                          )}
                          {/* Change is the box's own click; detaching needs its own target, so it
                              sits in the corner rather than competing for the same hit area. */}
                          {image && hoverUpload === key && (
                            <RemoveImageButton
                              label={`Remove ${key} image`}
                              onRemove={() => clearUpload(key)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {hasSearched && <div style={{ height: "1px", backgroundColor: "var(--gray-200)" }} />}
              </>
            )}

            {/* The results half — header, person chips, grid. Held back until a search has
                actually run; before that the panel is just the target preview above.
                Left un-indented rather than shifted a hundred-odd lines for one wrapper. */}
            {hasSearched && (<>
            {/* ── Search Results header ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>{t.searchResults}</h3>
              <span style={{
                width: "18px", height: "18px", borderRadius: "999px", backgroundColor: "var(--gray-100)",
                color: "var(--gray-700)", fontSize: "10px", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {hasSearched ? results.length : 0}
              </span>
              {traceName && (
                <span style={{
                  fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", backgroundColor: "var(--primary-100)",
                  borderRadius: "999px", padding: "3px 10px", whiteSpace: "nowrap",
                }}>
                  Tracing: {traceName}
                </span>
              )}
            </div>

            {/* ── Person filter chips — only when these results actually contain more than one
                distinct person. Toggling a chip controls who the map/route-history panel trace;
                the results grid below always keeps showing everyone regardless of selection. */}
            {showPersonChips && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {distinctPersons.map((p) => {
                  const active = selectedPersonIds.has(p.personId);
                  return (
                    <button key={p.personId} onClick={() => togglePerson(p.personId)} style={{
                      display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px",
                      borderRadius: "999px", cursor: "pointer",
                      border: active ? `1px solid ${p.color}` : "1px solid var(--gray-300)",
                      backgroundColor: active ? p.color : "white",
                      fontSize: "12px", fontWeight: active ? 700 : 600,
                      color: active ? "white" : "var(--gray-700)",
                    }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "999px", backgroundColor: active ? "white" : p.color, flexShrink: 0 }} />
                      {p.personLabel}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Search Results grid ── */}
            {!hasSearched ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="var(--gray-200)" strokeWidth="2" />
                  <path d="M18 18L25 25" stroke="var(--gray-200)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "var(--gray-400)" }}>
                  {mode === "person"
                    ? <>{t.promptPerson}<br />{t.promptPersonAnd} <strong style={{ color: "var(--gray-700)" }}>{t.searchPersons}</strong></>
                    : <>{t.promptVehicle}<br /><strong style={{ color: "var(--gray-700)" }}>{t.searchVehicle}</strong></>
                  }
                </p>
              </div>
            ) : searching ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <div className="vca-skeleton-pulse" style={{ width: "28px", height: "28px", borderRadius: "999px", backgroundColor: "var(--primary-200)" }} />
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "var(--gray-500)", fontWeight: 700 }}>
                  Searching…
                </p>
              </div>
            ) : results.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="var(--gray-200)" strokeWidth="2" />
                  <path d="M18 18L25 25" stroke="var(--gray-200)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 9l6 6M15 9l-6 6" stroke="var(--danger-200)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {/* Names the actual cause. "No matching sightings" over a query that DID match but
                    scored under the threshold sends the user back to change the image — the one
                    thing that wasn't the problem. */}
                <p style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.7, color: "var(--gray-400)" }}>
                  {emptyReason?.kind === "similarity" ? (
                    <>
                      <strong style={{ color: "var(--gray-700)" }}>
                        {t.scoredBelow(emptyReason.dropped, similarity)}
                      </strong><br />
                      {t.lowerToSee}
                    </>
                  ) : emptyReason?.kind === "date" ? (
                    <>
                      <strong style={{ color: "var(--gray-700)" }}>
                        {t.fallOutside(emptyReason.dropped)}
                      </strong><br />
                      {t.widenToSee}
                    </>
                  ) : (
                    <>
                      <strong style={{ color: "var(--gray-700)" }}>{t.noSightingsFound}</strong><br />
                      {mode === "car"
                        ? <>{t.noPlateOnRecord}</>
                        : <>{t.noImageOnRecord}<br />{t.tryDifferentPhoto}</>}
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {results.map((hit, index) => {
                  const excluded = excludedHitIds.has(hit.id);
                  return (
                  <div
                    key={hit.id}
                    onClick={() => handleHitClick(index)}
                    onMouseEnter={e => { if (activeHit !== index) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                    onMouseLeave={e => { if (activeHit !== index) e.currentTarget.style.backgroundColor = "transparent"; }}
                    style={{
                      cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px",
                      padding: "4px", borderRadius: "10px",
                      border: activeHit === index ? "2px solid var(--primary-400)" : "2px solid transparent",
                      opacity: excluded ? 0.45 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(14, 22, 42,0.6)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>{t.face}</span>
                      </div>
                      <div style={{ position: "relative", width: "63px", height: "62px", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
                        <img src={hit.bodyUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                        <span style={{ position: "absolute", top: "4px", left: "4px", backgroundColor: "rgba(90,61,251,0.4)", color: "white", fontSize: "10px", fontWeight: 600, padding: "2px 4px", borderRadius: "3px" }}>{t.body}</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: "var(--gray-100)", borderRadius: "6px", padding: "4px 6px", overflow: "hidden" }}>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--gray-700)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Face <span style={{ fontWeight: 800, color: "var(--primary-400)" }}>{hit.score}</span>
                        {/* No body image was searched → bodyScore has nothing real behind it and
                            reads as "0%", not an actual (low) match — show Face alone rather than
                            a body score that isn't measuring anything. */}
                        {parseFloat(hit.bodyScore) > 0 && (
                          <> · Body <span style={{ fontWeight: 800, color: "var(--primary-400)" }}>{hit.bodyScore}</span></>
                        )}
                      </span>
                    </div>
                    {excluded ? (
                      <button
                        onClick={e => { e.stopPropagation(); setExcludedHitIds(prev => { const next = new Set(prev); next.delete(hit.id); return next; }); }}
                        style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", background: "none", padding: 0, cursor: "pointer", width: "fit-content" }}
                      >
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--danger-400)" }}>{t.excluded}</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--primary-400)", textDecoration: "underline" }}>{t.restore}</span>
                      </button>
                    ) : showPersonChips && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "999px", backgroundColor: personColor(hit.personId), flexShrink: 0 }} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: personColor(hit.personId) }}>{hit.personLabel}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <PinIconSm />
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)" }}>{hit.location}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            </>)}
          </div>

          {hasSearched && results.length > 0 && (
            <div style={{ padding: "10px 20px", borderTop: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-800)" }}>1–{results.length} of {results.length}</span>
            </div>
          )}
        </div>
        )}

        {/* CENTER: Leaflet Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Collapse handle for the results panel, floating over the map's left edge exactly as
              the Dashboard's does — it lives here rather than in the panel so it stays reachable
              once the panel is gone. Only offered when there IS a panel to collapse. */}
          {(hasSearched || hasSearchTargets) && (
            <div
              onClick={() => setLeftCollapsed(c => !c)}
              role="button"
              tabIndex={0}
              aria-label={leftCollapsed ? t.showResults : t.hideResults}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLeftCollapsed(c => !c); } }}
              style={{
                position: "absolute", top: "50%", left: "-3px", transform: "translateY(-50%)",
                zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <SidebarToggleIcon collapsed={leftCollapsed} />
            </div>
          )}
          <RedmapMap
            hits={trackingActive ? results.map((h) => ({
              lat: h.lat, lng: h.lng,
              mapLabel: h.mapLabel,
              date: h.date,
              // Full HH:MM:SS, like the timeline, the result cards, and the route's own origin pin
              // (which never went through this truncation) — the map used to be the one place that
              // dropped the seconds, so a route read 06:30:11 → 07:15 → 07:45 across its own pins.
              time: h.time,
              isAlert: h.isUnregistered,
              color: personColor(h.personId),
              groupId: h.personId,
              // Keeps `results` and `hits` the same length/order — see the comment on
              // TrackingHit.hidden in RedmapMap.tsx for why this can't just be a `.filter()`.
              hidden: excludedHitIds.has(h.id),
            })) : []}
            trackingActive={trackingActive}
            showStatus={false}
            activeNode={activeNode}
            onMarkerClick={handleMarkerClick}
            visibleGroupIds={showPersonChips ? Array.from(selectedPersonIds) : null}
          />
        </div>

        {/* RIGHT: Route History Timeline — only mounts when there is an actual route to
            trace. A search that came back empty hides this panel outright rather than
            showing an empty-state next to the left panel's own "no results" message —
            two empty states side by side just restated the same thing. */}
        {trackingActive && (
        <div style={{
          width: "320px", backgroundColor: "white", borderLeft: BORDER,
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
        }}>
          <div style={{
            padding: "12px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
              Route history
            </h3>
            <button onClick={() => setTimelineNewestFirst(v => !v)} style={{
              display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none",
              cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)",
            }}>
              {timelineNewestFirst ? t.newestFirst : t.oldestFirst}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: timelineNewestFirst ? "none" : "rotate(180deg)" }}>
                <path d="M3.5 4L6 1.5L8.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10.5V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: "18px", top: "18px", bottom: "18px", width: "2px", backgroundColor: "var(--gray-200)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {(() => {
                    // Only the currently-traced person(s) get a row here — an untraced lookalike's
                    // sightings would otherwise sit in the same flat list with nothing to show they
                    // don't belong to who's actually being traced.
                    const tracedHits = results
                      .map((hit, hitIndex) => ({ hit, hitIndex }))
                      .filter(({ hit }) => !showPersonChips || selectedPersonIds.has(hit.personId))
                      .filter(({ hit }) => !excludedHitIds.has(hit.id));
                    // Every node is a sighting from the results — no synthetic starting point.
                    // A fixed TRACKING_ORIGIN used to be prepended here, the same hardcoded place,
                    // photo and timestamp for every search regardless of who was being traced. It
                    // was indistinguishable from a real detection, so a one-hit result read as two
                    // and the route appeared to start somewhere nobody had been seen.
                    const nodes = [
                      ...tracedHits.map(({ hit, hitIndex }) => ({
                        key: hit.id, location: hit.mapLabel, fullLocation: hit.location,
                        camera: hit.camera as string | undefined,
                        date: hit.date, time: hit.time, faceUrl: hit.faceUrl,
                        elapsed: hit.elapsed, hitIndex, color: personColor(hit.personId),
                      })),
                    ];
                    const ordered = timelineNewestFirst ? [...nodes].reverse() : nodes;
                    return ordered.map((node, i) => {
                      // Position in the original chronological array (origin=-1..MOCK_RESULTS.length-1),
                      // independent of which direction we're currently displaying it in.
                      const index = timelineNewestFirst ? nodes.length - 1 - i : i;
                      const num = index + 1; // chronological step number — stable regardless of sort direction
                      const isLatest = index === nodes.length - 1;
                      // Nothing precedes the oldest sighting, so it has no gap to report. Enforced
                      // here rather than in the data because person-filter chips and per-hit
                      // exclusions both change which sighting is first at runtime — and because the
                      // values the mock data still carries on its earliest hits were gaps measured
                      // from a synthetic origin node that no longer exists.
                      const isOldest = index === 0;
                      // Two different measurements share one label, which the row makes clear:
                      // every other node shows the gap from the sighting before it (fixed once it
                      // happened), while the newest shows how long it has been since that sighting
                      // — counted against the real clock, next to LAST SEEN. Falls back to the
                      // recorded gap until the clock starts on the client.
                      const elapsedText = isLatest && nowMs !== null
                        ? formatElapsed(nowMs - parseSgtStamp(node.date, node.time).getTime())
                        : isOldest ? undefined : node.elapsed;
                      const isActive = node.hitIndex >= 0 && activeNode === node.hitIndex;
                      return (
                        <div
                          key={node.key}
                          onClick={() => { if (node.hitIndex >= 0) handleNodeClick(node.hitIndex); }}
                          onMouseEnter={e => { if (node.hitIndex >= 0 && !isActive) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          style={{ display: "flex", alignItems: "flex-start", gap: "12px", position: "relative", zIndex: 1, cursor: node.hitIndex >= 0 ? "pointer" : "default", borderRadius: "12px", transition: "background-color 0.15s" }}
                        >
                          <div style={{
                            width: "36px", height: "36px", borderRadius: "999px", flexShrink: 0,
                            // Selection is just this ring — a thicker one in the route's colour.
                            // Filling the circle was tried and read as a different kind of thing
                            // altogether rather than "this row is selected".
                            border: isActive ? `2px solid ${node.color}` : "1px solid var(--gray-300)",
                            backgroundColor: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isActive ? node.color : "var(--gray-400)" }}>
                              {String(num).padStart(2, "0")}
                            </span>
                          </div>
                          {/* No ring on the card. Selection is shown on the numbered circle alone:
                              a ring out here had to sit 8px clear of the content to breathe, which
                              put it straight through the circle and the connector line beside it.
                              The circle is already this row's marker, so it carries the state. */}
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0,
                          }}>
                            {/* relative, and the detach button below is absolute inside it: keeping
                                that button in the flow cost the text column 32px, which was the
                                difference between "Clarke Quay Riverside" fitting and being clipped
                                to "Clarke Quay Riversi…". Centred vertically rather than pinned to a
                                line: level with the timestamp it read as deleting the time, and
                                level with the name it covered the end of a long one. The middle
                                lands beside the short camera line, where nothing is in its way and
                                it reads as the row's action rather than any one line's. */}
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", position: "relative" }}>
                              {/* Every row is the same height on purpose — a photo that grew only on
                                  the rows whose camera name wrapped read as ragged. So the text
                                  block is pinned to a fixed three lines (two for the name, one for
                                  the timestamp) and the photo is pinned to match it. The name gets
                                  two lines rather than one because the panel is 320px wide and most
                                  real camera names ("NC 2 Marine Parade") don't fit on one; a name
                                  longer than two lines clips with an ellipsis and keeps its full
                                  text in the title. */}
                              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", minWidth: 0 }}>
                                {/* The thumbnail is the handle for the captured frame. An expand
                                    glyph, not a play triangle: what opens is a still image, and a
                                    play button on evidence that isn't footage promises the operator
                                    something the record doesn't hold. */}
                                <button
                                  onClick={e => { e.stopPropagation(); setOpenFrameKey(k => k === node.key ? null : node.key); }}
                                  onMouseEnter={() => setHoverFrameKey(node.key)}
                                  onMouseLeave={() => setHoverFrameKey(null)}
                                  aria-label={openFrameKey === node.key ? t.hideFrame : t.showFrame}
                                  aria-expanded={openFrameKey === node.key}
                                  style={{
                                    width: "64px", height: "56px", borderRadius: "8px", overflow: "hidden", flexShrink: 0,
                                    padding: 0, border: "none", position: "relative", cursor: "pointer", display: "block",
                                  }}
                                >
                                  <img src={node.faceUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt="" />
                                  {(hoverFrameKey === node.key || openFrameKey === node.key) && (
                                    <span style={{
                                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                      backgroundColor: "rgba(14, 22, 42, 0.55)",
                                    }}><ExpandFrameIcon /></span>
                                  )}
                                </button>
                                <div style={{ minWidth: 0 }}>
                                  {/* Two lines, two facts — WHERE and WHICH CAMERA — rather than one
                                      name allowed to wrap into the second. Every row is the same
                                      height either way, but this way the reserved line carries
                                      information instead of the tail of a long place name. Each
                                      line clips to one line so the height can't vary. */}
                                  {/* The full site name. This is the detail panel — it's where the
                                      formal name belongs, and the map pin's short label is the
                                      concession to a pin having no room, not the other way round.
                                      Still clipped with an ellipsis as a backstop for a name longer
                                      than any in the data, with the full text on the tooltip. */}
                                  <p title={node.fullLocation} style={{
                                    fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", margin: 0, marginBottom: "2px",
                                    lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                  }}>{node.fullLocation}</p>
                                  {/* Blank when there's no camera (the trace's origin isn't a sighting),
                                      icon included — but the line still takes its 16px so that row
                                      doesn't come out shorter than the rest. */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "16px", marginBottom: "2px", color: "var(--gray-500)" }}>
                                    {node.camera && <CameraIconXs />}
                                    <span title={node.camera} style={{
                                      fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "var(--gray-500)",
                                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>{node.camera ?? ""}</span>
                                  </div>
                                  {/* Date and time share a line so the name can have two, which
                                      leaves no room for a year that is the current one on every row.
                                      So it only appears when it actually distinguishes something —
                                      a sighting from another year. The title always carries the
                                      full stamp regardless. */}
                                  <div title={`${node.date} ${node.time}`}
                                       style={{ display: "flex", alignItems: "center", gap: "4px", height: "16px", color: "var(--gray-500)" }}>
                                    <ClockIconXs />
                                    <span style={{
                                      fontSize: "12px", fontWeight: 600, color: "var(--gray-500)",
                                      whiteSpace: "nowrap",
                                    }}>
                                      {(sgtYear !== null && node.date.slice(0, 4) !== sgtYear ? node.date : node.date.slice(5))} {node.time}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Not this trace's origin (hitIndex -1) — only a real sighting can be
                                  a wrong one. Removing pulls it out of THIS route only; it stays in
                                  the left result list (dimmed, restorable) since it's still a real
                                  search hit, just not this person's. */}
                              {node.hitIndex >= 0 && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setExcludedHitIds(prev => new Set(prev).add(node.key));
                                    // The left list's own "Excluded · Restore" tag is the lasting way
                                    // back, but it's easy to miss right after the click — a toast with
                                    // its own Undo gives an immediate way to reverse a misclick without
                                    // hunting for that hit in the grid.
                                    showToast({
                                      variant: "default", title: t.removedFromTrace(node.fullLocation),
                                      actionLabel: t.undo,
                                      onAction: () => setExcludedHitIds(prev => { const next = new Set(prev); next.delete(node.key); return next; }),
                                    });
                                  }}
                                  title={t.notSamePerson}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = "var(--gray-200)";
                                    e.currentTarget.style.color = "var(--gray-700)";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = "var(--gray-100)";
                                    e.currentTarget.style.color = "var(--gray-500)";
                                  }}
                                  style={{
                                    position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                                    width: "22px", height: "22px", borderRadius: "999px", flexShrink: 0,
                                    // Grey, borderless, and quiet. This is a secondary action on a
                                    // reversible change — it drops a hit from this one route, leaves
                                    // it restorable in the left list, and raises a toast with Undo.
                                    // Red framed it as destructive and made it the loudest thing in
                                    // the row.
                                    border: "none", backgroundColor: "var(--gray-100)", color: "var(--gray-500)",
                                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                  }}
                                >
                                  <RemoveFromTraceIcon />
                                </button>
                              )}
                            </div>
                            {/* The frame itself, 16:9 at the panel's full width. Opening it here
                                rather than navigating to Best Frame keeps the trace alive —
                                RedmapPage unmounts on a tab change, so leaving would discard the
                                upload, the results and the route the operator is working through.
                                Same reason it's an accordion and not a map overlay: one open at a
                                time, with room to be looked at. Pulled left under the
                                numbered-circle column so it gets the panel's full 296px rather than
                                the card's 248px — 20% more of the one thing here that is actual
                                evidence, without taking width off the map. It covers the connector
                                line while open, the same way the circles sit on top of it. */}
                            {openFrameKey === node.key && (
                              <div style={{ marginLeft: "-48px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--gray-200)" }}>
                                <img src={frameImageSrc(node.faceUrl)} alt={`Captured frame — ${node.fullLocation} ${node.date} ${node.time}`}
                                     style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
                              </div>
                            )}
                            {/* Renders for the newest sighting even with no duration to show. The
                                LAST SEEN badge used to live inside this block, so a result set whose
                                newest hit carries no elapsed value dropped the badge along with the
                                pill — the one row that most needs marking was the one that lost its
                                marker. */}
                            {(elapsedText || isLatest) && (
                              <div style={{
                                backgroundColor: "var(--primary-100)", borderRadius: "8px",
                                padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                {/* No alert tint. A hand-set flag in the data turned one row red with
                                    no threshold in the code, no legend, and no tooltip — an operator
                                    had no way to know why that row and not another, and a warning
                                    colour nobody can explain is one they learn to ignore. The number
                                    says how long it was; that's the information.

                                    Duration and label are styled apart: the duration is the number
                                    being read, so it keeps the accent and the monospace figures that
                                    let two rows' times line up. "elapsed" is just the unit — lower
                                    case, body font, no accent, so it doesn't double the emphasis.
                                    Only the duration lives in the data; the word is the UI's. */}
                                {elapsedText ? (
                                  <span style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "var(--primary-400)" }}>
                                      {elapsedText}
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)" }}>
                                      elapsed
                                    </span>
                                  </span>
                                ) : <span />}
                                {isLatest && <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--primary-400)" }}>LAST SEEN</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
