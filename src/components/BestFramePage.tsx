"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Search } from "lucide-react";
import { useVcaStore, type UploadedMedia } from "@/lib/vcaStore";
import BestFrameDetailPage from "./BestFrameDetailPage";
import { useToast } from "./Toast";
import type { DetType, MonitorState, Camera, Detection, CamData, HUDState } from "@/types/detection";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { VIP_SIMULATION_CAMERAS } from "@/lib/vcaStore";
import { recentSgtClockTime, sgtHour, sgtMinute } from "@/lib/time";
import SidebarToggleIcon from "./SidebarToggleIcon";

import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. Camera codes ("CAM_WestGate_BS1"), site names and
// the seeded detection groups are the install's own data and stay as they are.
const T = {
  en: {
    filterAll: "All",
    close: "Close",
    liveSnapshot: "LIVE SNAPSHOT",
    liveSnapshotHint: "Frame the camera just captured",
    noDbMatch: "NO DB MATCH",
    noDbMatchHint: "No match for this face in the enrolled database",
    enrolledDb: "ENROLLED DB",
    enrolledDbHint: "Reference photo from the enrolled database",
    liveCamera: "Live camera",
    typeNetwork: "Network",
    typeFile: "File",
    noDetections: "No detections",
    unknownTarget: "Unknown target",
    detail: (n: number) => `DETAIL ${n}`,
    group: "GROUP",
    camera: "CAMERA",
    trackOnMap: "Track on Map",
    analyzeFrame: "Analyze Frame",
    active: (n: number) => `${n} Active`,
    expandAndSearch: "Expand sidebar and search cameras",
    showLiveList: "Show live camera list",
    showVideoList: "Show video list",
    showImageList: "Show image list",
    searchCameras: "Search cameras",
    normalNetwork: "Normal network",
    videoList: "Video list",
    imageList: "Image list",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    selectCamera: "Select a camera",
    liveFeed: "Live Feed",
    awaitingCamera: "Awaiting camera",
    noMatchTitle: "No matching camera",
    noMatchDesc: (place: string) => `No Best Frame camera is set up yet for "${place}".`,
    unavailableTitle: "Camera unavailable",
    unavailableDesc: (name: string) => `${name} is offline and can't be added to the view.`,
    limitTitle: "Camera limit reached",
    limitDesc: (max: number) => `You can only view up to ${max} cameras at once.`,
  },
  ko: {
    filterAll: "전체",
    close: "닫기",
    liveSnapshot: "실시간 검출",
    liveSnapshotHint: "카메라가 방금 잡은 프레임입니다",
    noDbMatch: "등록 DB 없음",
    noDbMatchHint: "이 얼굴은 등록 데이터베이스에서 찾을 수 없습니다",
    enrolledDb: "등록 DB",
    enrolledDbHint: "등록 데이터베이스의 기준 사진입니다",
    liveCamera: "실시간 카메라",
    typeNetwork: "네트워크",
    typeFile: "파일",
    noDetections: "검출 없음",
    unknownTarget: "미확인 대상",
    detail: (n: number) => `속성 ${n}`,
    group: "그룹",
    camera: "카메라",
    trackOnMap: "지도에서 추적",
    analyzeFrame: "프레임 분석",
    active: (n: number) => `${n}대 사용 중`,
    expandAndSearch: "사이드바 펼쳐 카메라 검색",
    showLiveList: "실시간 카메라 목록 보기",
    showVideoList: "영상 목록 보기",
    showImageList: "이미지 목록 보기",
    searchCameras: "카메라 검색",
    normalNetwork: "네트워크 카메라",
    videoList: "영상 목록",
    imageList: "이미지 목록",
    expandSidebar: "사이드바 펼치기",
    collapseSidebar: "사이드바 접기",
    selectCamera: "카메라를 선택해주세요",
    liveFeed: "실시간 영상",
    awaitingCamera: "카메라 대기 중",
    noMatchTitle: "일치하는 카메라가 없습니다",
    noMatchDesc: (place: string) => `"${place}"에 설정된 베스트 프레임 카메라가 아직 없습니다.`,
    unavailableTitle: "카메라를 쓸 수 없습니다",
    unavailableDesc: (name: string) => `${name}이(가) 중단 상태여서 화면에 추가할 수 없습니다.`,
    limitTitle: "카메라 개수 상한",
    limitDesc: (max: number) => `한 번에 최대 ${max}대까지만 볼 수 있습니다.`,
  },
} as const;

const BORDER = "1px solid var(--gray-200)";

function FilterIcon({ type, color, active, size = 14 }: { type: DetType; color: string; active?: boolean; size?: number }) {
  if (type === "VIP") return active ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M7.70796 2.17647C7.73673 2.12421 7.77901 2.08062 7.83037 2.05027C7.88173 2.01992 7.9403 2.00391 7.99996 2.00391C8.05962 2.00391 8.11819 2.01992 8.16955 2.05027C8.22091 2.08062 8.26318 2.12421 8.29196 2.17647L10.26 5.91247C10.3069 5.99898 10.3724 6.07402 10.4518 6.13222C10.5311 6.19041 10.6224 6.23031 10.719 6.24904C10.8156 6.26778 10.9152 6.26489 11.0106 6.24059C11.106 6.21628 11.1948 6.17116 11.2706 6.10847L14.122 3.6658C14.1767 3.62128 14.2441 3.59528 14.3146 3.59154C14.3851 3.58779 14.4549 3.6065 14.514 3.64497C14.5732 3.68343 14.6186 3.73968 14.6437 3.8056C14.6689 3.87152 14.6725 3.94372 14.654 4.0118L12.7646 10.8425C12.7261 10.9822 12.643 11.1056 12.528 11.1939C12.413 11.2822 12.2723 11.3306 12.1273 11.3318H3.87329C3.72818 11.3308 3.58736 11.2825 3.47222 11.1941C3.35707 11.1058 3.27389 10.9824 3.23529 10.8425L1.34662 4.01247C1.32812 3.94438 1.3317 3.87218 1.35685 3.80626C1.382 3.74034 1.42741 3.6841 1.48656 3.64563C1.5457 3.60717 1.61553 3.58846 1.68598 3.5922C1.75644 3.59595 1.82389 3.62195 1.87862 3.66647L4.72929 6.10914C4.80516 6.17183 4.89396 6.21695 4.98933 6.24125C5.0847 6.26556 5.18427 6.26845 5.28089 6.24971C5.37751 6.23097 5.46878 6.19107 5.54815 6.13288C5.62752 6.07469 5.69303 5.99965 5.73996 5.91314L7.70796 2.17647Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14H12.6667" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M7.70796 2.17647C7.73673 2.12421 7.77901 2.08062 7.83037 2.05027C7.88173 2.01992 7.9403 2.00391 7.99996 2.00391C8.05962 2.00391 8.11819 2.01992 8.16955 2.05027C8.22091 2.08062 8.26318 2.12421 8.29196 2.17647L10.26 5.91247C10.3069 5.99898 10.3724 6.07402 10.4518 6.13222C10.5311 6.19041 10.6224 6.23031 10.719 6.24904C10.8156 6.26778 10.9152 6.26489 11.0106 6.24059C11.106 6.21628 11.1948 6.17116 11.2706 6.10847L14.122 3.6658C14.1767 3.62128 14.2441 3.59528 14.3146 3.59154C14.3851 3.58779 14.4549 3.6065 14.514 3.64497C14.5732 3.68343 14.6186 3.73968 14.6437 3.8056C14.6689 3.87152 14.6725 3.94372 14.654 4.0118L12.7646 10.8425C12.7261 10.9822 12.643 11.1056 12.528 11.1939C12.413 11.2822 12.2723 11.3306 12.1273 11.3318H3.87329C3.72818 11.3308 3.58736 11.2825 3.47222 11.1941C3.35707 11.1058 3.27389 10.9824 3.23529 10.8425L1.34662 4.01247C1.32812 3.94438 1.3317 3.87218 1.35685 3.80626C1.382 3.74034 1.42741 3.6841 1.48656 3.64563C1.5457 3.60717 1.61553 3.58846 1.68598 3.5922C1.75644 3.59595 1.82389 3.62195 1.87862 3.66647L4.72929 6.10914C4.80516 6.17183 4.89396 6.21695 4.98933 6.24125C5.0847 6.26556 5.18427 6.26845 5.28089 6.24971C5.37751 6.23097 5.46878 6.19107 5.54815 6.13288C5.62752 6.07469 5.69303 5.99965 5.73996 5.91314L7.70796 2.17647Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14H12.6667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "Vehicle") return active ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M12.6667 6.66602H3.33333C2.59695 6.66602 2 7.26297 2 7.99935V10.666C2 11.4024 2.59695 11.9993 3.33333 11.9993H12.6667C13.403 11.9993 14 11.4024 14 10.666V7.99935C14 7.26297 13.403 6.66602 12.6667 6.66602Z" fill="white" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 5.33238L12.6667 6.66572L11.6667 4.19905C11.5724 3.94661 11.4038 3.72867 11.1831 3.57395C10.9625 3.41924 10.7001 3.33502 10.4307 3.33238H5.6C5.32834 3.32614 5.06125 3.40306 4.83451 3.55283C4.60778 3.70259 4.43221 3.91807 4.33133 4.17038L3.33333 6.66572L2 5.33238" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66675 9.33398H4.67425" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3333 9.33398H11.3408" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33325 12V13.3333" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 12V13.3333" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <path d="M14 5.33333L12.6667 6.66667L11.6667 4.2C11.5724 3.94756 11.4038 3.72962 11.1831 3.5749C10.9625 3.42019 10.7001 3.33597 10.4307 3.33333H5.6C5.32834 3.32709 5.06125 3.40401 4.83451 3.55378C4.60778 3.70355 4.43221 3.91902 4.33133 4.17133L3.33333 6.66667L2 5.33333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66667 9.33333H4.67417" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3333 9.33333H11.3408" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 6.66667H3.33333C2.59695 6.66667 2 7.26362 2 8V10.6667C2 11.403 2.59695 12 3.33333 12H12.6667C13.403 12 14 11.403 14 10.6667V8C14 7.26362 13.403 6.66667 12.6667 6.66667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 12V13.3333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 12V13.3333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  // type === "Unknown"
  return active ? (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <g clipPath="url(#filterIconUnknownClipActive)">
        <path d="M2.24583 5.02833C2.16069 4.64481 2.17376 4.24599 2.28384 3.86886C2.39392 3.49174 2.59744 3.14851 2.87552 2.871C3.15361 2.5935 3.49726 2.3907 3.87462 2.28141C4.25198 2.17213 4.65082 2.15989 5.03417 2.24583C5.24516 1.91584 5.53584 1.64428 5.87939 1.45617C6.22294 1.26806 6.60832 1.16946 7 1.16946C7.39168 1.16946 7.77706 1.26806 8.12061 1.45617C8.46416 1.64428 8.75484 1.91584 8.96583 2.24583C9.34976 2.15951 9.74929 2.1717 10.1272 2.28125C10.5052 2.3908 10.8493 2.59417 11.1276 2.87242C11.4058 3.15068 11.6092 3.49479 11.7188 3.87275C11.8283 4.25071 11.8405 4.65024 11.7542 5.03417C12.0842 5.24516 12.3557 5.53583 12.5438 5.87939C12.7319 6.22294 12.8305 6.60832 12.8305 7C12.8305 7.39168 12.7319 7.77706 12.5438 8.12061C12.3557 8.46416 12.0842 8.75484 11.7542 8.96583C11.8401 9.34918 11.8279 9.74802 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4026 10.5083 11.6061 10.1311 11.7162C9.75401 11.8262 9.35519 11.8393 8.97167 11.7542C8.76094 12.0854 8.47005 12.3582 8.12591 12.5471C7.78177 12.7361 7.39552 12.8351 7.00292 12.8351C6.61032 12.8351 6.22407 12.7361 5.87993 12.5471C5.53579 12.3582 5.24489 12.0854 5.03417 11.7542C4.65082 11.8401 4.25198 11.8279 3.87462 11.7186C3.49726 11.6093 3.15361 11.4065 2.87552 11.129C2.59744 10.8515 2.39392 10.5083 2.28384 10.1311C2.17376 9.75401 2.16069 9.35519 2.24583 8.97167C1.91331 8.76122 1.63941 8.4701 1.44961 8.12537C1.25982 7.78065 1.16029 7.39352 1.16029 7C1.16029 6.60648 1.25982 6.21935 1.44961 5.87462C1.63941 5.5299 1.91331 5.23877 2.24583 5.02833Z" fill="var(--warning-200)" stroke="var(--warning-200)" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.3025 5.25C5.43964 4.86014 5.71034 4.5314 6.06664 4.32199C6.42294 4.11259 6.84186 4.03605 7.24919 4.10592C7.65652 4.17578 8.02598 4.38756 8.29213 4.70372C8.55828 5.01989 8.70395 5.42005 8.70333 5.83333C8.70333 7 6.95333 7.58333 6.95333 7.58333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 9.91667H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="filterIconUnknownClipActive"><rect width="14" height="14" fill="white"/></clipPath>
      </defs>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <g clipPath="url(#filterIconUnknownClip)">
        <path d="M2.24583 5.02833C2.16069 4.64481 2.17376 4.24599 2.28384 3.86886C2.39392 3.49174 2.59744 3.14851 2.87552 2.871C3.15361 2.5935 3.49726 2.3907 3.87462 2.28141C4.25198 2.17213 4.65082 2.15989 5.03417 2.24583C5.24516 1.91584 5.53584 1.64428 5.87939 1.45617C6.22294 1.26806 6.60832 1.16946 7 1.16946C7.39168 1.16946 7.77706 1.26806 8.12061 1.45617C8.46416 1.64428 8.75484 1.91584 8.96583 2.24583C9.34976 2.15951 9.74929 2.1717 10.1272 2.28125C10.5052 2.3908 10.8493 2.59417 11.1276 2.87242C11.4058 3.15068 11.6092 3.49479 11.7188 3.87275C11.8283 4.25071 11.8405 4.65024 11.7542 5.03417C12.0842 5.24516 12.3557 5.53583 12.5438 5.87939C12.7319 6.22294 12.8305 6.60832 12.8305 7C12.8305 7.39168 12.7319 7.77706 12.5438 8.12061C12.3557 8.46416 12.0842 8.75484 11.7542 8.96583C11.8401 9.34918 11.8279 9.74802 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4026 10.5083 11.6061 10.1311 11.7162C9.75401 11.8262 9.35519 11.8393 8.97167 11.7542C8.76094 12.0854 8.47005 12.3582 8.12591 12.5471C7.78177 12.7361 7.39552 12.8351 7.00292 12.8351C6.61032 12.8351 6.22407 12.7361 5.87993 12.5471C5.53579 12.3582 5.24489 12.0854 5.03417 11.7542C4.65082 11.8401 4.25198 11.8279 3.87462 11.7186C3.49726 11.6093 3.15361 11.4065 2.87552 11.129C2.59744 10.8515 2.39392 10.5083 2.28384 10.1311C2.17376 9.75401 2.16069 9.35519 2.24583 8.97167C1.91331 8.76122 1.63941 8.4701 1.44961 8.12537C1.25982 7.78065 1.16029 7.39352 1.16029 7C1.16029 6.60648 1.25982 6.21935 1.44961 5.87462C1.63941 5.5299 1.91331 5.23877 2.24583 5.02833Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.3025 5.25C5.43964 4.86014 5.71034 4.5314 6.06664 4.32199C6.42294 4.11259 6.84186 4.03605 7.24919 4.10592C7.65652 4.17578 8.02598 4.38756 8.29213 4.70372C8.55828 5.01989 8.70395 5.42005 8.70333 5.83333C8.70333 7 6.95333 7.58333 6.95333 7.58333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 9.91667H7.00583" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="filterIconUnknownClip"><rect width="14" height="14" fill="white"/></clipPath>
      </defs>
    </svg>
  );
}

/* ── Colors ────────────────────────────────────────────────────── */
// VIP is brand purple everywhere else in the app (Sidebar's VIP badges, watchlist icons) —
// matches that instead of the sky-blue this page used to use on its own.
const DET_COLOR: Record<DetType, string> = { VIP: "var(--primary-400)", Vehicle: "var(--type-vehicle)", Unknown: "var(--type-unknown)" };

// How long the sidebar's "VIP detected now" pulsing dot stays lit after a hit — long enough not
// to be missed on a glance, short enough that it still means "just now" rather than "at some
// point today." (Also cleared immediately if the operator checks the camera first — see
// ackedVipCamIds below — so it never lingers past the point someone's actually looked.)
const VIP_DOT_TIMEOUT_MIN = 2;

function toMinutesSinceMidnight(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

const PURPLE_FILTER = "invert(28%) sepia(64%) saturate(3086%) hue-rotate(237deg) brightness(0.92)";

// Sidebar camera-list filter chips. "Network" shows the Normal network section (its chip label
// used to say "Live", which didn't match the section title it revealed — renamed to agree with
// it). "File" merges what used to be separate Video and Image chips into one filter, since
// they're both saved footage as opposed to a live feed; the Video list / Image list sections
// still render as their own distinct groups underneath it.
type CamTypeFilter = "All" | "Network" | "File";
const CAM_TYPE_FILTERS: CamTypeFilter[] = ["All", "Network", "File"];

/* ── Camera data ──────────────────────────────────────────── */
const BG = [
  "/cctv-sample.png",
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=80",
];
const AVATAR = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=80&q=80",
];
const CAR_IMG = "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=80&q=80";

// Detection `time` values are computed relative to the actual current time (recentSgtClockTime),
// not literal hardcoded clock strings — a fixed string like "16:31:50" inevitably drifts into
// looking like a FUTURE detection as real time passes the current SGT clock (Navbar's header
// keeps advancing live). Offsets below are chosen so each camera's own cluster keeps roughly the
// same relative spacing/story it always had, just re-anchored to "now" — and each entry is
// listed newest-first within its camera, matching how CameraCard renders the list (also enforced
// defensively by a sort in CameraCard itself, in case this ordering ever drifts).
export const CAM_DATA: Record<string, CamData> = {
  bs1a: { camLabel: "CAM_WestGate_BS1", location: "Main Intake Road", bgUrl: BG[0], detections: [
    { id:"d3", type:"VIP",          name:"Dr. Alex Wong",          group:"VIP group",       confidence:98.4, time:recentSgtClockTime(86), top:"18%", left:"68%", width:"12%", height:"36%" },
    { id:"d1", type:"VIP",          name:"Sarah Lin",              group:"Staff (Finance)", confidence:98.4, time:recentSgtClockTime(87), top:"15%", left:"10%", width:"12%", height:"38%" },
    { id:"d4", type:"Unknown", name:"Blue shirts • Man • Bag",group:"Unknown",    confidence:0,    time:recentSgtClockTime(88), top:"25%", left:"32%", width:"11%", height:"35%" },
    { id:"d2", type:"Vehicle",      name:"Vehicle SGX411",         group:"Navy",            confidence:92.8, time:recentSgtClockTime(89), top:"20%", left:"48%", width:"18%", height:"28%" },
    { id:"d21", type:"VIP",     name:"Michelle Tan",       group:"VIP group",     confidence:95.7, time:recentSgtClockTime(90), top:"17%", left:"22%", width:"12%", height:"37%" },
    { id:"d22", type:"Unknown", name:"Red cap • Male",     group:"Unknown",       confidence:0,    time:recentSgtClockTime(91), top:"24%", left:"58%", width:"11%", height:"34%" },
    { id:"d23", type:"Vehicle", name:"Vehicle YW2281",     group:"Logistics",     confidence:87.4, time:recentSgtClockTime(92), top:"19%", left:"5%",  width:"17%", height:"27%" },
    { id:"d24", type:"VIP",     name:"James Kwek",         group:"Staff (Security)", confidence:90.1, time:recentSgtClockTime(93), top:"16%", left:"78%", width:"12%", height:"37%" },
    { id:"d25", type:"Unknown", name:"Grey hoodie • Female", group:"Unknown",     confidence:0,    time:recentSgtClockTime(94), top:"23%", left:"42%", width:"11%", height:"34%" },
  ]},
  bs3: { camLabel: "CAM_EastGate_BS3", location: "Annex 2F Hall", bgUrl: BG[1], detections: [
    { id:"d6", type:"Unknown", name:"Unknown Person",group:"Unknown", confidence:0,    time:recentSgtClockTime(0), top:"24%", left:"55%", width:"11%", height:"34%" },
    { id:"d5", type:"VIP",          name:"hong gildong", group:"VIP group",    confidence:72.6, time:recentSgtClockTime(1), top:"22%", left:"25%", width:"13%", height:"37%" },
  ]},
  bs2: { camLabel: "CAM_NorthGate_BS2", location: "Orchard MRT Gate", bgUrl: BG[0], detections: [
    { id:"d7", type:"Vehicle", name:"Vehicle XB3291", group:"Logistics", confidence:81.3, time:recentSgtClockTime(1), top:"20%", left:"40%", width:"18%", height:"28%" },
  ]},
  ca2: { camLabel: "CAM_CentralA_CA2", location: "CA2 Sub Station", bgUrl: BG[1], detections: [
    { id:"d8", type:"Unknown", name:"Red jacket • Female", group:"Unknown", confidence:0, time:recentSgtClockTime(2), top:"26%", left:"52%", width:"12%", height:"34%" },
  ]},
  bs1b: { camLabel: "CAM_WestGate_BS1B", location: "Bugis MRT", bgUrl: BG[0], detections: [
    { id:"d9",  type:"VIP",     name:"hong gildong", group:"VIP group",  confidence:76.9, time:recentSgtClockTime(1), top:"20%", left:"18%", width:"13%", height:"36%" },
    { id:"d10", type:"Vehicle", name:"Vehicle XC112", group:"Security",  confidence:64.2, time:recentSgtClockTime(4), top:"22%", left:"60%", width:"16%", height:"26%" },
  ]},
  hb4:  { camLabel: "CAM_HarbourB_HB4", location: "HB4 Terminal",  bgUrl: BG[1], detections: [
    { id:"d11", type:"Unknown", name:"Blue cap • Male", group:"Unknown", confidence:0, time:recentSgtClockTime(5), top:"22%", left:"36%", width:"12%", height:"36%" },
  ]},
  nc1:  { camLabel: "CAM_NorthC_NC1",   location: "NC 1 West",      bgUrl: BG[0], detections: [
    { id:"d12", type:"VIP", name:"hong gildong", group:"Staff (HR)", confidence:77.8, time:recentSgtClockTime(6), top:"19%", left:"48%", width:"13%", height:"38%" },
  ]},
  or2:  { camLabel: "CAM_OrchardC_OR2",    location: "Orchard Central",       bgUrl: BG[0], detections: [
    { id:"d13", type:"VIP", name:"hong gildong", group:"VIP group", confidence:74.2, time:recentSgtClockTime(12), top:"20%", left:"30%", width:"12%", height:"36%" },
  ]},
  tp1:  { camLabel: "CAM_TampinesH_TP1",   location: "Tampines Hub",          bgUrl: BG[1], detections: [
    { id:"d14", type:"Vehicle", name:"Vehicle TJ8821", group:"Logistics", confidence:88.1, time:recentSgtClockTime(13), top:"22%", left:"45%", width:"16%", height:"26%" },
  ]},
  jr1:  { camLabel: "CAM_JurongG_JR1",     location: "Jurong Gateway",        bgUrl: BG[0], detections: [
    { id:"d15", type:"Unknown", name:"Grey hoodie • Male", group:"Unknown", confidence:0, time:recentSgtClockTime(14), top:"24%", left:"38%", width:"11%", height:"34%" },
  ]},
  sg1:  { camLabel: "CAM_SengkangR_SG1",   location: "Sengkang Riverside",    bgUrl: BG[1], detections: [
    { id:"d16", type:"VIP", name:"Dr. Alex Wong", group:"VIP group", confidence:91.5, time:recentSgtClockTime(15), top:"18%", left:"55%", width:"12%", height:"37%" },
  ]},
  cq1:  { camLabel: "CAM_ClarkeQ_CQ1",     location: "Clarke Quay",           bgUrl: BG[0], detections: [
    { id:"d17", type:"Vehicle", name:"Vehicle CQ4471", group:"Navy", confidence:79.6, time:recentSgtClockTime(16), top:"20%", left:"40%", width:"17%", height:"27%" },
  ]},
  wd1:  { camLabel: "CAM_WoodlandsCP_WD1", location: "Woodlands Checkpoint",  bgUrl: BG[1], detections: [
    { id:"d18", type:"Unknown", name:"Unknown", group:"Unknown", confidence:0, time:recentSgtClockTime(17), top:"23%", left:"50%", width:"12%", height:"35%" },
  ]},
  ak1:  { camLabel: "CAM_AngMoKioH_AK1",   location: "Ang Mo Kio Hub",        bgUrl: BG[0], detections: [
    { id:"d19", type:"VIP", name:"hong gildong", group:"Staff (HR)", confidence:68.9, time:recentSgtClockTime(18), top:"19%", left:"33%", width:"13%", height:"38%" },
  ]},
  kl1:  { camLabel: "CAM_KallangW_KL1",    location: "Kallang Wave",          bgUrl: BG[1], detections: [] },
  py1:  { camLabel: "CAM_PayaLebarS_PY1",  location: "Paya Lebar Square",     bgUrl: BG[0], detections: [
    { id:"d20", type:"Vehicle", name:"Vehicle PL9012", group:"Logistics", confidence:83.0, time:recentSgtClockTime(20), top:"21%", left:"48%", width:"18%", height:"28%" },
  ]},
  // Saved recordings/snapshots (Video list / Image list in the sidebar) — clicking one of these
  // opens its analysis directly (see openFileDetail) rather than toggling it into the live grid,
  // so each needs its own real detection to land on instead of DEFAULT_DATA's empty feed.
  v1: { camLabel: "CAM_WestGate_BS1_REC1", location: "Main Intake Road", bgUrl: BG[0], detections: [
    { id:"dv1", type:"VIP", name:"Dr. Alex Wong", group:"VIP group", confidence:95.1, time:recentSgtClockTime(40), top:"18%", left:"40%", width:"12%", height:"36%" },
  ]},
  v2: { camLabel: "CAM_WestGate_BS1_REC2", location: "Main Intake Road", bgUrl: BG[0], detections: [
    { id:"dv2", type:"Vehicle", name:"Vehicle SGX411", group:"Navy", confidence:88.2, time:recentSgtClockTime(50), top:"20%", left:"45%", width:"18%", height:"28%" },
  ]},
  v3: { camLabel: "CAM_WestGate_BS1_REC3", location: "Main Intake Road", bgUrl: BG[0], detections: [
    { id:"dv3", type:"Unknown", name:"Grey hoodie • Male", group:"Unknown", confidence:0, time:recentSgtClockTime(60), top:"24%", left:"38%", width:"11%", height:"34%" },
  ]},
  i1: { camLabel: "CAM_WestGate_BS1_SNAP1", location: "Main Intake Road", bgUrl: BG[0], sourceType:"image", detections: [
    { id:"di1", type:"VIP", name:"Sarah Lin", group:"Staff (Finance)", confidence:93.5, time:recentSgtClockTime(70), top:"15%", left:"20%", width:"12%", height:"38%" },
  ]},
};
export const DEFAULT_DATA: CamData = { camLabel:"CAM_Unknown", location:"Unknown", bgUrl:BG[0], detections:[] };

/* ── Sidebar initial data ─────────────────────────────────────── */
export const NORMAL_CAMS_INIT: Camera[] = [
  { id:"bs1a", name:"BS1",          checked:true,  monitor:"active" },
  { id:"bs3",  name:"BS3",          checked:false, monitor:"alert"  },
  { id:"bs2",  name:"BS2",          checked:true,  monitor:"normal" },
  // 4 cameras checked by default so the landing grid opens onto a clean 2x2 view.
  { id:"ca2",  name:"CA2 Sub",      checked:true,  monitor:"normal" },
  { id:"bs1b", name:"BS1",          checked:true,  monitor:"normal" },
  { id:"hb4",  name:"HB4 Terminal", checked:false, monitor:"alert"  },
  { id:"nc1",  name:"NC 1 West",    checked:false, monitor:"normal" },
  { id:"or2",  name:"OR2",          checked:false, monitor:"normal" },
  { id:"tp1",  name:"TP1",          checked:false, monitor:"normal" },
  { id:"jr1",  name:"JR1",          checked:false, monitor:"normal" },
  { id:"sg1",  name:"SG1",          checked:false, monitor:"normal" },
  { id:"cq1",  name:"CQ1",          checked:false, monitor:"normal" },
  { id:"wd1",  name:"WD1",          checked:false, monitor:"normal" },
  { id:"ak1",  name:"AK1",          checked:false, monitor:"normal" },
  { id:"kl1",  name:"KL1",          checked:false, monitor:"normal" },
  { id:"py1",  name:"PY1",          checked:false, monitor:"normal" },
  // Drawn from the SAME shared camera pool the Dashboard's live VIP simulation uses
  // (VIP_SIMULATION_CAMERAS in vcaStore.ts), not a separately-generated, unrelated ~1,000-camera
  // list with its own "CAM-0017"-style ids. Before this, BestFrame's camera list and the rest of
  // the app's simulated cameras were two disjoint id-spaces — nothing here could ever correspond
  // to a real detection event elsewhere in the app. A real camera-registry fetch has exactly one
  // place to plug in (VIP_SIMULATION_CAMERAS' source) and both this list and the live simulation
  // pick it up. Ids not present in CAM_DATA fall back to DEFAULT_DATA (generic feed), by design —
  // there's no curated detection footage behind these, so a generic placeholder is honest rather
  // than fabricated.
  ...VIP_SIMULATION_CAMERAS.map(cam => ({
    id: cam.id,
    name: cam.name,
    checked: false,
    monitor: (cam.status === "online" ? "normal" : "alert") as MonitorState,
  })),
];
/**
 * The sidebar's Video list / Image list, built from the project's uploads.
 *
 * These used to be two hardcoded arrays (v1-v3, i1, all named "BS1") with no way to add to them, so
 * anything uploaded in Portal could never show up here — two id spaces that never met, the failure
 * Live Monitoring and Re-ID already hit once. The store now holds one list; Portal's Input Sources
 * tab writes it and this reads it, which is what makes an upload's id the id CAM_DATA is keyed by.
 *
 * Only analysed uploads are listed. A file still queued has no detections, and a row that opens
 * onto nothing is worse than no row.
 *
 * `checked` is carried over from the previous list rather than reset, so adding one upload does not
 * clear the selection the operator had built up.
 */
function uploadsToCams(uploads: UploadedMedia[], kind: "video" | "image", prev: Camera[]): Camera[] {
  return uploads
    .filter(u => u.kind === kind && u.status === "done")
    .map(u => ({ id: u.id, name: u.fileName, checked: prev.find(c => c.id === u.id)?.checked ?? false, monitor: "normal" as const }));
}

/* ── Checkbox icon ────────────────────────────────────────── */
function CheckboxIcon({ checked }: { checked: boolean }) {
  if (checked) return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M15.75 7.992V14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V3.75C2.25 3.35218 2.40804 2.97064 2.68934 2.68934C2.97064 2.40804 3.35218 2.25 3.75 2.25H13.008M6.75 8.25L9 10.5L16.5 3" stroke="var(--primary-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14.25 2.25H3.75C2.92157 2.25 2.25 2.92157 2.25 3.75V14.25C2.25 15.0784 2.92157 15.75 3.75 15.75H14.25C15.0784 15.75 15.75 15.0784 15.75 14.25V3.75C15.75 2.92157 15.0784 2.25 14.25 2.25Z" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function MonitorIcon({ purple }: { purple: boolean }) {
  if (purple) return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.022 6.29339C10.0874 6.33127 10.1418 6.38571 10.1796 6.45124C10.2174 6.51676 10.2373 6.59108 10.2373 6.66672C10.2373 6.74236 10.2174 6.81667 10.1796 6.8822C10.1418 6.94773 10.0874 7.00217 10.022 7.04005L7.31196 8.60805C7.24652 8.64592 7.17224 8.66585 7.09663 8.66586C7.02102 8.66586 6.94675 8.64592 6.8813 8.60806C6.81585 8.5702 6.76155 8.51575 6.72386 8.4502C6.68617 8.38465 6.66643 8.31033 6.66663 8.23472V5.09872C6.6665 5.02321 6.68625 4.94899 6.72391 4.88354C6.76156 4.81809 6.81579 4.7637 6.88114 4.72586C6.94648 4.68802 7.02064 4.66805 7.09615 4.66797C7.17166 4.66789 7.24587 4.68769 7.31129 4.72539L10.022 6.29339Z" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 11.334V14.0007" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.33337 14H10.6667" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.3334 2H2.66671C1.93033 2 1.33337 2.59695 1.33337 3.33333V10C1.33337 10.7364 1.93033 11.3333 2.66671 11.3333H13.3334C14.0698 11.3333 14.6667 10.7364 14.6667 10V3.33333C14.6667 2.59695 14.0698 2 13.3334 2Z" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M13.3334 2H2.66671C1.93033 2 1.33337 2.59695 1.33337 3.33333V10C1.33337 10.7364 1.93033 11.3333 2.66671 11.3333H13.3334C14.0698 11.3333 14.6667 10.7364 14.6667 10V3.33333C14.6667 2.59695 14.0698 2 13.3334 2Z" stroke="var(--gray-200)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.33337 14H10.6667" stroke="var(--gray-200)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 11.666L8 13.666" stroke="var(--gray-200)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 9.3334L5 7.40006C5.10871 7.18416 5.27408 7.00187 5.47841 6.8727C5.68273 6.74352 5.91833 6.67233 6.16 6.66673H13.3333M13.3333 6.66673C13.537 6.66637 13.7381 6.71269 13.9211 6.80212C14.1041 6.89155 14.2642 7.02172 14.389 7.18264C14.5139 7.34356 14.6003 7.53095 14.6415 7.73043C14.6826 7.92991 14.6776 8.13618 14.6267 8.3334L13.6 12.3334C13.5257 12.6211 13.3575 12.8758 13.1219 13.0569C12.8864 13.2381 12.5971 13.3354 12.3 13.3334H2.66667C2.31304 13.3334 1.9739 13.1929 1.72386 12.9429C1.47381 12.6928 1.33333 12.3537 1.33333 12.0001V3.3334C1.33333 2.97978 1.47381 2.64064 1.72386 2.39059C1.9739 2.14054 2.31304 2.00006 2.66667 2.00006H5.26667C5.48966 1.99788 5.70963 2.05166 5.90647 2.15648C6.1033 2.2613 6.27069 2.41381 6.39333 2.60006L6.93333 3.40006C7.05474 3.58442 7.22002 3.73574 7.41433 3.84047C7.60865 3.94519 7.82593 4.00003 8.04667 4.00006H12C12.3536 4.00006 12.6928 4.14054 12.9428 4.39059C13.1929 4.64064 13.3333 4.97978 13.3333 5.3334V6.66673Z" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14.2766 12.9423C14.0265 13.1923 13.6874 13.3328 13.3337 13.3328H2.6662C2.31255 13.3328 1.97339 13.1923 1.72332 12.9423C1.47325 12.6923 1.33276 12.3531 1.33276 11.9995V3.33327C1.33276 2.97967 1.47325 2.64054 1.72332 2.39051C1.97339 2.14047 2.31255 2 2.6662 2H5.28641C5.50717 2.00004 5.72446 2.05487 5.9188 2.15959C6.11313 2.26431 6.27842 2.41563 6.39984 2.59997L6.93988 3.39993C7.06253 3.58618 7.22994 3.73868 7.42679 3.8435C7.62363 3.94832 7.84363 4.00209 8.06664 3.99991H13.3337C13.6874 3.99991 14.0265 4.14038 14.2766 4.39041C14.5267 4.64045 14.6672 4.97957 14.6672 5.33318V11.9995C14.6672 12.3531 14.5267 12.6923 14.2766 12.9423Z" stroke="var(--gray-500)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function VideoFileIcon({ color = "var(--gray-500)" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4.00008 14.6673C3.64646 14.6673 3.30732 14.5268 3.05727 14.2768C2.80722 14.0267 2.66675 13.6876 2.66675 13.334V2.66732C2.66675 2.3137 2.80722 1.97456 3.05727 1.72451C3.30732 1.47446 3.64646 1.33399 4.00008 1.33399H9.33341C9.54445 1.33364 9.75347 1.37505 9.94843 1.45583C10.1434 1.53661 10.3205 1.65516 10.4694 1.80465L12.8614 4.19665C13.0113 4.34566 13.1302 4.52288 13.2112 4.71809C13.2922 4.91331 13.3338 5.12263 13.3334 5.33399V13.334C13.3334 13.6876 13.1929 14.0267 12.9429 14.2768C12.6928 14.5268 12.3537 14.6673 12.0001 14.6673H4.00008Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.33325 1.33398V4.66732C9.33325 4.84413 9.40349 5.0137 9.52851 5.13872C9.65354 5.26375 9.82311 5.33398 9.99992 5.33398H13.3333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.0221 8.9594C10.0876 8.99729 10.1419 9.05172 10.1797 9.11725C10.2175 9.18278 10.2374 9.25709 10.2374 9.33273C10.2374 9.40838 10.2175 9.48269 10.1797 9.54822C10.1419 9.61374 10.0876 9.66818 10.0221 9.70607L7.31208 11.2741C7.24664 11.3119 7.17236 11.3319 7.09675 11.3319C7.02114 11.3319 6.94687 11.3119 6.88142 11.2741C6.81598 11.2362 6.76167 11.1818 6.72398 11.1162C6.68629 11.0507 6.66655 10.9763 6.66675 10.9007V7.76473C6.66662 7.68922 6.68637 7.61501 6.72403 7.54956C6.76168 7.4841 6.81591 7.42972 6.88126 7.39188C6.9466 7.35403 7.02076 7.33407 7.09627 7.33398C7.17178 7.3339 7.24599 7.3537 7.31142 7.3914L10.0221 8.9594Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ImageFileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12.6667 2H3.33333C2.59695 2 2 2.59695 2 3.33333V12.6667C2 13.403 2.59695 14 3.33333 14H12.6667C13.403 14 14 13.403 14 12.6667V3.33333C14 2.59695 13.403 2 12.6667 2Z" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.00008 7.33268C6.73646 7.33268 7.33341 6.73573 7.33341 5.99935C7.33341 5.26297 6.73646 4.66602 6.00008 4.66602C5.2637 4.66602 4.66675 5.26297 4.66675 5.99935C4.66675 6.73573 5.2637 7.33268 6.00008 7.33268Z" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 10.0004L11.9427 7.94312C11.6926 7.69315 11.3536 7.55273 11 7.55273C10.6464 7.55273 10.3074 7.69315 10.0573 7.94312L4 14.0004" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PinIcon({ active }: { active: boolean }) {
  const color = active ? "var(--primary-400)" : "var(--gray-400)";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 8.5V11" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 5.38C4.4999 5.56604 4.44791 5.74837 4.34986 5.90648C4.25181 6.06459 4.11161 6.19221 3.945 6.275L3.055 6.725C2.88839 6.80779 2.74819 6.93541 2.65014 7.09352C2.55209 7.25163 2.5001 7.43396 2.5 7.62V8C2.5 8.13261 2.55268 8.25979 2.64645 8.35355C2.74021 8.44732 2.86739 8.5 3 8.5H9C9.13261 8.5 9.25979 8.44732 9.35355 8.35355C9.44732 8.25979 9.5 8.13261 9.5 8V7.62C9.4999 7.43396 9.44791 7.25163 9.34986 7.09352C9.25181 6.93541 9.11161 6.80779 8.945 6.725L8.055 6.275C7.88839 6.19221 7.74819 6.06459 7.65014 5.90648C7.55209 5.74837 7.5001 5.56604 7.5 5.38V3.5C7.5 3.36739 7.55268 3.24021 7.64645 3.14645C7.74021 3.05268 7.86739 3 8 3C8.26522 3 8.51957 2.89464 8.70711 2.70711C8.89464 2.51957 9 2.26522 9 2C9 1.73478 8.89464 1.48043 8.70711 1.29289C8.51957 1.10536 8.26522 1 8 1H4C3.73478 1 3.48043 1.10536 3.29289 1.29289C3.10536 1.48043 3 1.73478 3 2C3 2.26522 3.10536 2.51957 3.29289 2.70711C3.48043 2.89464 3.73478 3 4 3C4.13261 3 4.25979 3.05268 4.35355 3.14645C4.44732 3.24021 4.5 3.36739 4.5 3.5V5.38Z"
        fill={active ? color : "none"} stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Camera feed card ─────────────────────────────────────────── */
function CameraCard({
  cam, data, onDetClick, onHeaderArrowClick, filterType, style, sidePanelOnHover,
}: {
  cam: Camera; data: CamData; filterType: DetType | "All";
  onDetClick: (det: Detection, data: CamData, camId: string, e: React.MouseEvent) => void;
  onHeaderArrowClick?: () => void;
  style?: React.CSSProperties;
  sidePanelOnHover?: boolean;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  // Newest first — "time" is an "HH:MM:SS" string within the same day, so a plain descending
  // string sort already gives correct chronological order without needing to parse it.
  const dets = (filterType === "All" ? data.detections : data.detections.filter(d => d.type === filterType))
    .slice().sort((a, b) => b.time.localeCompare(a.time));
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [feedHovered, setFeedHovered] = useState(false);
  const panelRevealed = !sidePanelOnHover || hovered || pinned;
  const canAnalyze = data.detections.length > 0 && !!onHeaderArrowClick;
  const hasVip = data.detections.some(d => d.type === "VIP");

  return (
    <div
      onMouseEnter={() => sidePanelOnHover && setHovered(true)}
      onMouseLeave={() => sidePanelOnHover && setHovered(false)}
      style={{ display:"flex", backgroundColor:"white", overflow:"hidden", height:"100%", minHeight:0, position:"relative", ...style }}
    >

      {/* ── Camera feed ── */}
      <div
        onMouseEnter={() => setFeedHovered(true)}
        onMouseLeave={() => setFeedHovered(false)}
        style={{ flex:1, position:"relative", overflow:"hidden", backgroundColor:"var(--gray-900)", minWidth:0, minHeight:0 }}
      >
        <img src={data.bgUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", opacity:0.9 }} />
        {feedHovered && canAnalyze && (
          <button
            onClick={onHeaderArrowClick}
            style={{
              position:"absolute", top:"50%", left:"50%", transform:"translate(-50%, -50%)", zIndex:20,
              display:"flex", alignItems:"center", gap:"6px",
              padding:"10px 20px", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.15)",
              backgroundColor:"rgba(14,22,42,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
              color:"white", fontSize:"13px", fontWeight:700,
              cursor:"pointer", boxShadow:"0 4px 12px rgba(14, 22, 42,0.25)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M15.2701 1.77009L16.2301 2.73009C16.3163 2.81396 16.3848 2.91425 16.4315 3.02503C16.4783 3.13581 16.5024 3.25484 16.5024 3.37509C16.5024 3.49535 16.4783 3.61438 16.4315 3.72516C16.3848 3.83594 16.3163 3.93623 16.2301 4.02009L4.02009 16.2301C3.93623 16.3163 3.83594 16.3848 3.72516 16.4315C3.61438 16.4783 3.49535 16.5024 3.37509 16.5024C3.25484 16.5024 3.13581 16.4783 3.02503 16.4315C2.91425 16.3848 2.81396 16.3163 2.73009 16.2301L1.77009 15.2701C1.68483 15.1857 1.61715 15.0853 1.57095 14.9745C1.52476 14.8638 1.50098 14.7451 1.50098 14.6251C1.50098 14.5051 1.52476 14.3864 1.57095 14.2757C1.61715 14.1649 1.68483 14.0645 1.77009 13.9801L13.9801 1.77009C14.0645 1.68483 14.1649 1.61715 14.2757 1.57095C14.3864 1.52476 14.5051 1.50098 14.6251 1.50098C14.7451 1.50098 14.8638 1.52476 14.9745 1.57095C15.0853 1.61715 15.1857 1.68483 15.2701 1.77009Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 5.25L12.75 7.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.75 4.5V7.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.25 10.5V13.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.5 1.5V3" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.25 6H2.25" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.75 12H12.75" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.25 2.25H6.75" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Analyze Frame
          </button>
        )}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(to bottom,rgba(14, 22, 42,0) 50%,rgba(14, 22, 42,0.04) 50%)", backgroundSize:"100% 4px" }} />
        <div
          className={hasVip ? "vca-cam-label-glow" : undefined}
          style={{ position:"absolute", top:10, left:10, display:"flex", alignItems:"center", gap:"5px", zIndex:10, backgroundColor:"rgba(14,22,42,0.55)", padding:"4px 8px", border:"1.5px solid transparent" }}
        >
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", backgroundColor:"var(--success-400)", flexShrink:0 }} />
          <span style={{ fontSize:"10px", fontWeight:600, color:"white", letterSpacing:"-0.2px" }}>
            {data.camLabel} • {data.location}
          </span>
        </div>
      </div>

      {/* ── Detection list — a fixed column normally; past 6 cameras it collapses to a compact
          top-anchored "peek card" on hover (not a full-height panel) so most of the feed stays
          visible underneath, matching the dense-grid hover reference design ── */}
      <div style={sidePanelOnHover ? {
        position:"absolute", right:0, top:0, width:"50%", maxHeight:"100%",
        display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor:"white",
        boxShadow: panelRevealed ? "-4px 4px 16px rgba(14, 22, 42,0.12)" : "none",
        transform: panelRevealed ? "translateX(0)" : "translateX(100%)",
        transition:"transform 0.15s ease",
      } : { flex:"0 0 240px", display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor:"white" }}>
        {/* Header */}
        <div style={{ padding:"12px 16px 10px", borderBottom:BORDER, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.24px" }}>{data.location}</span>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {sidePanelOnHover && (
              <button
                onClick={e => { e.stopPropagation(); setPinned(p => !p); }}
                aria-label={pinned ? "Unpin panel" : "Pin panel"}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}
              >
                <PinIcon active={pinned} />
              </button>
            )}
            <div
              onClick={data.detections.length > 0 ? onHeaderArrowClick : undefined}
              style={{ display:"flex", alignItems:"center", gap:"4px", cursor: data.detections.length > 0 ? "pointer" : "default" }}
            >
            <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{data.detections.length} target</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10.5 6.5V9.5C10.5 9.76522 10.3946 10.0196 10.2071 10.2071C10.0196 10.3946 9.76522 10.5 9.5 10.5H2.5C2.23478 10.5 1.98043 10.3946 1.79289 10.2071C1.60536 10.0196 1.5 9.76522 1.5 9.5V2.5C1.5 2.23478 1.60536 1.98043 1.79289 1.79289C1.98043 1.60536 2.23478 1.5 2.5 1.5H5.5" stroke="var(--gray-700)" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 1.5L6 6" stroke="var(--gray-700)" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.5 1.5H10.5V4.5" stroke="var(--gray-700)" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            </div>
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {dets.length === 0 ? (
            <div style={{ padding:"20px", textAlign:"center", color:"var(--gray-400)", fontSize:"11px" }}>{t.noDetections}</div>
          ) : dets.map((det, i) => {
            const avatarSrc = det.type === "Vehicle" ? CAR_IMG : AVATAR[i % AVATAR.length];
            const showConfidence = det.type === "VIP";
            return (
              <div key={det.id}
                onClick={e => onDetClick(det, data, cam.id, e)}
                style={{
                  display:"flex", alignItems:"center", gap:"8px",
                  padding:"8px 16px", cursor:"pointer",
                  borderBottom: i < dets.length - 1 ? "1px solid var(--gray-200)" : "none",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--gray-50)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Avatar + status dot — rounded-square (8px), not a circle, per Figma */}
                <div style={{ position:"relative", flexShrink:0, width:"42px", height:"42px" }}>
                  <img src={avatarSrc} alt=""
                    style={{ width:"42px", height:"42px", borderRadius:"8px", objectFit:"cover", display:"block" }} />
                  <div style={{
                    position:"absolute", top:"-2px", right:"-3px", width:"10px", height:"10px", borderRadius:"50%", border:"1px solid white",
                    backgroundColor: DET_COLOR[det.type],
                  }} />
                </div>

                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"6px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"4px" }}>
                    <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.24px" }}>
                      {det.name}
                    </span>
                    {showConfidence && (
                      <span style={{ fontSize:"10px", fontWeight:800, color:"var(--primary-400)", flexShrink:0, letterSpacing:"-0.2px" }}>
                        {det.confidence}%
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"4px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"4px", overflow:"hidden" }}>
                      <FilterIcon type={det.type} color="var(--gray-600)" size={14} />
                      <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {/* VIP and Vehicle rows read just "VIP"/"Vehicle" here — the specific
                            group (Staff/VIP group, Navy/Logistics/Security fleet, etc.) varied
                            row to row and read as inconsistent; that detail is still available
                            in the HUD popup / Inspection Detail view. */}
                        {det.type === "VIP" ? "VIP" : det.type === "Vehicle" ? "Vehicle" : det.group}
                      </span>
                    </div>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", fontFamily:"monospace", flexShrink:0 }}>
                      {det.time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── HUD popup ─────────────────────────────────────────────────── */
function DetectionHUD({ hud, onClose, onAnalyze, onTrackOnMap }: { hud: HUDState; onClose: () => void; onAnalyze: () => void; onTrackOnMap?: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  useEscapeKey(onClose);
  const { det } = hud;
  const isUnknown = det.type === "Unknown";
  const c = DET_COLOR[det.type];
  // Unknown names are already a bullet-separated physical description (e.g. "Blue shirts • Man •
  // Bag") — that's the closest real data to "attributes" we have; VIP/Vehicle detections don't
  // carry wardrobe data, so they show group/location instead of fabricating it.
  const attributes = isUnknown ? det.name.split("•").map(s => s.trim()).filter(Boolean) : [];

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position:"fixed", zIndex:200, left:hud.x, top:hud.y,
      width:"320px", backgroundColor:"white", borderRadius:"24px",
      boxShadow:"-3px 3px 8px rgba(14, 22, 42,0.12)", padding:"20px",
      display:"flex", flexDirection:"column", gap:"16px",
    }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <FilterIcon type={det.type} color={c} size={16} />
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-700)" }}>{det.type}</span>
          </div>
          {det.type === "VIP" && (
            <div style={{ backgroundColor:"var(--primary-100)", borderRadius:"12px", padding:"2px 6px" }}>
              <span style={{ fontSize:"12px", fontWeight:800, color:"var(--primary-400)" }}>{det.confidence}%</span>
            </div>
          )}
        </div>
        <button onClick={onClose} aria-label={t.close} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-500)", padding:0, display:"flex" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12" stroke="var(--gray-500)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 4L4 12" stroke="var(--gray-500)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Photo comparison */}
      <div style={{ display:"flex", gap:"12px", backgroundColor:"var(--gray-50)", borderRadius:"16px", padding:"12px" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", width:"96px", flexShrink:0 }}>
          <img src={det.type === "Vehicle" ? CAR_IMG : AVATAR[0]} alt="" style={{ width:"100%", aspectRatio: det.type === "Vehicle" ? "1/1" : "77/177", objectFit:"cover", borderRadius:"8px", display:"block" }} />
          <span title={t.liveSnapshotHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", cursor:"help" }}>{t.liveSnapshot}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", flex:1, minWidth:0 }}>
          {isUnknown ? (
            <div style={{ width:"100%", aspectRatio:"1/1", borderRadius:"10px", border:"2px dashed var(--warning-500)", backgroundColor:"var(--warning-100)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span title={t.noDbMatchHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--warning-500)", textAlign:"center", cursor:"help" }}>{t.noDbMatch}</span>
            </div>
          ) : (
            <img src={det.type === "Vehicle" ? CAR_IMG : AVATAR[0]} alt="" style={{ width:"100%", aspectRatio:"1/1", objectFit:"cover", borderRadius:"10px", display:"block", filter:"sepia(0.2)" }} />
          )}
          <span title={t.enrolledDbHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", cursor:"help" }}>{t.enrolledDb}</span>
        </div>
      </div>

      {/* Profile */}
      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <FilterIcon type={det.type} color={c} size={20} />
          <span style={{ fontSize:"18px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.36px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {isUnknown ? t.unknownTarget : det.name}
          </span>
        </div>
        <p style={{ fontSize:"13px", fontWeight:400, color:"var(--gray-600)" }}>{hud.location} &nbsp;•&nbsp; {det.time}</p>
      </div>

      {/* Attributes / details */}
      <div style={{ backgroundColor:"var(--gray-50)", borderRadius:"16px", padding:"14px 16px", display:"flex", flexDirection:"column", gap:"8px" }}>
        {attributes.length > 0 ? attributes.map((attr, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>{t.detail(i + 1)}</span>
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)" }}>{attr}</span>
          </div>
        )) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>{t.group}</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)" }}>{det.group}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>{t.camera}</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)" }}>{hud.camLabel}</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:"8px" }}>
        <button onClick={onTrackOnMap} style={{ flex:1, padding:"12px 0", borderRadius:"12px", border:"1px solid var(--gray-900)", backgroundColor:"white", color:"var(--gray-900)", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M16.6667 8.33333C16.6667 13.3333 10 18.3333 10 18.3333C10 18.3333 3.33333 13.3333 3.33333 8.33333C3.33333 6.56522 4.03571 4.86953 5.28596 3.61929C6.5362 2.36905 8.23189 1.66667 10 1.66667C11.7681 1.66667 13.4638 2.36905 14.714 3.61929C15.9643 4.86953 16.6667 6.56522 16.6667 8.33333Z" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 10.8333C11.3807 10.8333 12.5 9.71404 12.5 8.33333C12.5 6.95262 11.3807 5.83333 10 5.83333C8.61929 5.83333 7.5 6.95262 7.5 8.33333C7.5 9.71404 8.61929 10.8333 10 10.8333Z" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.trackOnMap}
        </button>
        <button onClick={onAnalyze} style={{ flex:1, padding:"12px 0", borderRadius:"12px", border:"none", backgroundColor:"var(--gray-900)", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M15.2701 1.77009L16.2301 2.73009C16.3163 2.81396 16.3848 2.91425 16.4315 3.02503C16.4783 3.13581 16.5024 3.25484 16.5024 3.37509C16.5024 3.49535 16.4783 3.61438 16.4315 3.72516C16.3848 3.83594 16.3163 3.93623 16.2301 4.02009L4.02009 16.2301C3.93623 16.3163 3.83594 16.3848 3.72516 16.4315C3.61438 16.4783 3.49535 16.5024 3.37509 16.5024C3.25484 16.5024 3.13581 16.4783 3.02503 16.4315C2.91425 16.3848 2.81396 16.3163 2.73009 16.2301L1.77009 15.2701C1.68483 15.1857 1.61715 15.0853 1.57095 14.9745C1.52476 14.8638 1.50098 14.7451 1.50098 14.6251C1.50098 14.5051 1.52476 14.3864 1.57095 14.2757C1.61715 14.1649 1.68483 14.0645 1.77009 13.9801L13.9801 1.77009C14.0645 1.68483 14.1649 1.61715 14.2757 1.57095C14.3864 1.52476 14.5051 1.50098 14.6251 1.50098C14.7451 1.50098 14.8638 1.52476 14.9745 1.57095C15.0853 1.61715 15.1857 1.68483 15.2701 1.77009Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.5 5.25L12.75 7.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.75 4.5V7.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.25 10.5V13.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 1.5V3" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.25 6H2.25" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15.75 12H12.75" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.25 2.25H6.75" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.analyzeFrame}
        </button>
      </div>
    </div>
  );
}

/* ── Sidebar item ──────────────────────────────────────────── */
// Used to also draw its own status dot (green/gray/red for active/normal/alert) baked into the
// icon — combined with CameraItem's own activity-rank dot overlaid on top (see below), that put
// two colored dots on one 20px icon. "alert" is already obvious from the row's dimmed/disabled
// styling, and "active" vs "normal" wasn't distinguishing anything else in the row, so that dot
// was pure redundant clutter — removed, keeping just the one dot that carries unique information
// (whether this camera has a detection right now).
function BulletCameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13.9583 10H16.985C17.127 10.0001 17.2666 10.0364 17.3906 10.1056C17.5146 10.1748 17.6189 10.2745 17.6935 10.3953C17.7681 10.5161 17.8107 10.654 17.8171 10.7958C17.8234 10.9377 17.7935 11.0788 17.73 11.2058L16.035 14.5967C15.9707 14.7252 15.8743 14.8348 15.7552 14.9151C15.636 14.9953 15.4981 15.0434 15.3549 15.0546C15.2117 15.0659 15.068 15.0399 14.9377 14.9792C14.8075 14.9185 14.6952 14.8252 14.6117 14.7083L12.8417 12.2333" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.255 7.54373C14.4525 7.6426 14.6027 7.81584 14.6726 8.02539C14.7424 8.23493 14.7262 8.46363 14.6275 8.66123L12.0392 13.8371C11.9902 13.935 11.9225 14.0223 11.8398 14.094C11.7571 14.1657 11.661 14.2204 11.5572 14.255C11.4533 14.2896 11.3437 14.3034 11.2345 14.2956C11.1253 14.2878 11.0187 14.2586 10.9209 14.2096L3.00836 10.2496C2.43364 9.96007 1.99699 9.45471 1.79396 8.84407C1.59093 8.23342 1.63806 7.56722 1.92503 6.99123L3.07503 4.66623C3.21836 4.38058 3.41656 4.12597 3.65831 3.91693C3.90006 3.70788 4.18061 3.54851 4.48396 3.44791C4.78731 3.34731 5.1075 3.30746 5.42625 3.33062C5.74501 3.35378 6.05608 3.4395 6.34169 3.5829L14.255 7.54373Z" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66663 15.8333H4.79996C5.11057 15.8355 5.4156 15.7508 5.68064 15.5888C5.94568 15.4269 6.16019 15.1941 6.29996 14.9167L7.49996 12.5" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66675 17.4993V14.166" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83337 7.5H5.84171" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CameraItem({ cam, onToggle, type = "camera", disabled = false, activityRank }: { cam: Camera; onToggle: () => void; type?: "camera" | "video" | "image"; disabled?: boolean; activityRank?: number }) {
  const isAlert = cam.monitor === "alert";
  const isChecked = !isAlert && cam.checked;
  // Both alert cameras and (unchecked items at) the 16-camera grid cap are dimmed and stay
  // unselectable in effect, but the click must still reach toggle() — that's what shows the
  // "offline" / "limit reached" toast instead of the click silently doing nothing.
  const isCapped = disabled && !cam.checked;
  const iconColor = isChecked ? "var(--primary-400)" : "var(--gray-500)";
  const [hovered, setHovered] = useState(false);
  // Only a VIP hit gets a dot now — the second color (green, for Vehicle/Unknown) read as a
  // tracking indicator elsewhere in the app and was confusing here, so it's gone; VIP is the one
  // signal worth interrupting a scan of the list for. Pulses (see .vca-vip-dot-pulse) since it
  // means "detected right now," not just "has a record."
  const isVipActive = !isAlert && activityRank === 0;
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 12px", borderRadius:"10px", width:"100%", border:"none", cursor: isAlert ? "default" : "pointer", backgroundColor: isChecked ? "var(--primary-100)" : hovered && !isAlert && !isCapped ? "var(--gray-50)" : "transparent", flexShrink:0, opacity: isAlert || isCapped ? 0.4 : 1 }}
    >
      {/* Video/Image rows navigate straight to their analysis screen on click — there's nothing
          for a checkbox to toggle there, so it's replaced with a plain spacer to keep alignment. */}
      {type !== "camera" || isAlert ? <div style={{ width:"18px", height:"18px", flexShrink:0 }} /> : <CheckboxIcon checked={cam.checked} />}
      <div style={{ flexShrink:0, position:"relative" }}>
        {type === "camera"
          ? <BulletCameraIcon />
          : type === "video"
          ? <VideoFileIcon color={iconColor} />
          : <ImageFileIcon />}
        {isVipActive && (
          <div title="VIP detected now" className="vca-vip-dot-pulse" style={{ position:"absolute", top:-2, right:-2, width:"7px", height:"7px", borderRadius:"50%", backgroundColor:"var(--primary-400)", border:"1.5px solid white" }} />
        )}
      </div>
      <span style={{ flex:1, textAlign:"left", fontSize:"13px", fontWeight: isChecked ? 700 : 400, color: isChecked ? "var(--primary-400)" : "var(--gray-500)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {cam.name}
      </span>
      <MonitorIcon purple={isChecked} />
    </button>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, transform: expanded ? "none" : "rotate(-90deg)", transition:"transform 0.15s" }}>
      <path d="M3 5l4 4 4-4" stroke="var(--gray-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SidebarSection({ label, count, badge, expanded, onToggle, activeLabel }: { label:string; count?:number; badge?:number; expanded:boolean; onToggle:()=>void; activeLabel?: (n: number) => string }) {
  return (
    <button onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"10px 12px", width:"100%", border:"none", background:"none", cursor:"pointer" }}>
      <Chevron expanded={expanded} />
      <FolderIcon open={expanded} />
      <span style={{ flex:1, fontSize:"14px", fontWeight:800, color:"var(--gray-800)", letterSpacing:"-0.28px", whiteSpace:"nowrap", textAlign:"left" }}>{label}</span>
      {count !== undefined && <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", flexShrink:0 }}>{activeLabel ? activeLabel(count) : count}</span>}
      {badge !== undefined && (
        <div style={{ backgroundColor:"var(--gray-100)", borderRadius:"999px", minWidth:"18px", height:"18px", padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-700)" }}>{badge}</span>
        </div>
      )}
    </button>
  );
}

function CollapsedIcon({ type, badge, purple=false }: { type:"camera"|"video"|"image"|"search"; badge?:number; purple?:boolean }) {
  const camColor = purple ? "var(--primary-400)" : "var(--gray-500)";
  const hasBg = type === "search" || type === "camera" || purple;
  return (
    <div style={{ position:"relative" }}>
      <div style={{ width:"40px", height:"40px", borderRadius:"10px", backgroundColor: hasBg ? (purple ? "var(--primary-100)" : "var(--gray-100)") : "transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {type === "search" && (
          <svg width="18" height="18" viewBox="6.5 6.5 16.5 16.5" fill="none">
            <path d="M21.7501 21.7501L18.4951 18.4951M20.25 14.25C20.25 17.5637 17.5637 20.25 14.25 20.25C10.9363 20.25 8.25 17.5637 8.25 14.25C8.25 10.9363 10.9363 8.25 14.25 8.25C17.5637 8.25 20.25 10.9363 20.25 14.25Z" stroke="var(--gray-500)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        )}
        {type === "camera" && (
          <svg width="18" height="18" viewBox="20 11 20 17" fill="none">
            <path d="M37.0612 25.5601C36.7799 25.8414 36.3983 25.9994 36.0005 25.9994H23.9995C23.6017 25.9994 23.2201 25.8414 22.9388 25.5601C22.6574 25.2788 22.4994 24.8973 22.4994 24.4995V14.7499C22.4994 14.3521 22.6574 13.9706 22.9388 13.6893C23.2201 13.408 23.6017 13.25 23.9995 13.25H26.9473C27.1956 13.25 27.4401 13.3117 27.6587 13.4295C27.8773 13.5473 28.0633 13.7176 28.1999 13.925L28.8074 14.8249C28.9454 15.0344 29.1337 15.206 29.3552 15.3239C29.5766 15.4419 29.8241 15.5024 30.075 15.4999H36.0005C36.3983 15.4999 36.7799 15.6579 37.0612 15.9392C37.3426 16.2205 37.5006 16.602 37.5006 16.9998V24.4995C37.5006 24.8973 37.3426 25.2788 37.0612 25.5601Z" stroke={camColor} strokeWidth="1" strokeLinecap="round"/>
          </svg>
        )}
        {type === "video" && (
          <svg width="18" height="18" viewBox="22 61 16 18" fill="none">
            <path d="M25.5 77.5C25.1022 77.5 24.7206 77.342 24.4393 77.0607C24.158 76.7794 24 76.3978 24 76V64C24 63.6022 24.158 63.2206 24.4393 62.9393C24.7206 62.658 25.1022 62.5 25.5 62.5H31.5C31.7374 62.4996 31.9726 62.5462 32.1919 62.6371C32.4112 62.728 32.6104 62.8613 32.778 63.0295L35.469 65.7205C35.6376 65.8881 35.7714 66.0875 35.8625 66.3071C35.9537 66.5267 36.0004 66.7622 36 67V76C36 76.3978 35.842 76.7794 35.5607 77.0607C35.2794 77.342 34.8978 77.5 34.5 77.5H25.5Z" stroke={camColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M31.5 62.5V66.25C31.5 66.4489 31.579 66.6397 31.7197 66.7803C31.8603 66.921 32.0511 67 32.25 67H36" stroke={camColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M32.2748 71.0786C32.3484 71.1212 32.4096 71.1825 32.4521 71.2562C32.4946 71.3299 32.517 71.4135 32.517 71.4986C32.517 71.5837 32.4946 71.6673 32.4521 71.741C32.4096 71.8147 32.3484 71.876 32.2748 71.9186L29.226 73.6826C29.1524 73.7252 29.0688 73.7476 28.9838 73.7476C28.8987 73.7476 28.8151 73.7252 28.7415 73.6826C28.6679 73.64 28.6068 73.5788 28.5644 73.505C28.522 73.4313 28.4998 73.3477 28.5 73.2626V69.7346C28.4999 69.6496 28.5221 69.5662 28.5644 69.4925C28.6068 69.4189 28.6678 69.3577 28.7413 69.3151C28.8148 69.2726 28.8983 69.2501 28.9832 69.25C29.0682 69.2499 29.1516 69.2722 29.2253 69.3146L32.2748 71.0786Z" stroke={camColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {type === "image" && (
          <svg width="18" height="18" viewBox="21 105 18 18" fill="none">
            <path d="M36.75 116.25L34.4355 113.935C34.1542 113.654 33.7727 113.496 33.375 113.496C32.9773 113.496 32.5958 113.654 32.3145 113.935L25.5 120.75M24.75 107.25H35.25C36.0784 107.25 36.75 107.922 36.75 108.75V119.25C36.75 120.078 36.0784 120.75 35.25 120.75H24.75C23.9216 120.75 23.25 120.078 23.25 119.25V108.75C23.25 107.922 23.9216 107.25 24.75 107.25ZM29.25 111.75C29.25 112.578 28.5784 113.25 27.75 113.25C26.9216 113.25 26.25 112.578 26.25 111.75C26.25 110.922 26.9216 110.25 27.75 110.25C28.5784 110.25 29.25 110.922 29.25 111.75Z" stroke={camColor} strokeWidth="1" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      {badge !== undefined && (
        <div style={{ position:"absolute", top:"-4px", right:"-4px", backgroundColor: purple ? "var(--primary-400)" : "var(--gray-400)", borderRadius:"999px", minWidth:"16px", height:"16px", padding:"0 3px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:"10px", fontWeight:600, color:"white", lineHeight:"16px" }}>{badge}</span>
        </div>
      )}
    </div>
  );
}

// Adaptive grid mapping — keeps the grid's aspect ratio sane at every camera count instead of
// letting it stretch into an arbitrary N-column strip. Side panel (per-camera event list) stays
// always-on through 6 cameras; past that it collapses to hover-reveal so the video feeds don't
// get crowded out.
function getGridLayout(n: number): { cols: number; rows: number; sidePanelOnHover: boolean } {
  if (n <= 1) return { cols: 1, rows: 1, sidePanelOnHover: false };
  if (n === 2) return { cols: 2, rows: 1, sidePanelOnHover: false };
  if (n <= 4) return { cols: 2, rows: 2, sidePanelOnHover: false };
  if (n <= 6) return { cols: 2, rows: 3, sidePanelOnHover: false };
  if (n <= 9) return { cols: 3, rows: 3, sidePanelOnHover: true };
  return { cols: 4, rows: 4, sidePanelOnHover: true };
}

/* ── Main component ──────────────────────────────────────────── */
export default function BestFramePage({ focusLocation, onFocusConsumed, onGoRedmapTrace, analyzeFrameLocation, analyzeFrameAt, onAnalyzeFrameConsumed }: { focusLocation?: string | null; onFocusConsumed?: () => void; onGoRedmapTrace?: (name: string) => void; analyzeFrameLocation?: string | null; analyzeFrameAt?: { date: string; time: string } | null; onAnalyzeFrameConsumed?: () => void } = {}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [normalCams, setNormalCams] = useState<Camera[]>(NORMAL_CAMS_INIT);
  // The File lists are the project's uploads, from the store — Portal's Input Sources tab is what
  // adds to them. They were two hardcoded arrays here, so anything uploaded in Portal could never
  // appear on this page: two id spaces that never met, the same failure Live Monitoring and Re-ID
  // hit once already.
  //
  // Still local state, because `checked` is this page's business and not the store's. The effect
  // below reconciles the list when an upload is added or removed and keeps whatever was ticked.
  const storeUploads = useVcaStore(s => s.uploads);
  const [videoCams,  setVideoCams]  = useState<Camera[]>(() => uploadsToCams(storeUploads, "video", []));
  const [imageCams,  setImageCams]  = useState<Camera[]>(() => uploadsToCams(storeUploads, "image", []));

  // Reconciled during render against the previous store value, not from an effect — an effect
  // paints the stale list once before correcting it, and the lint rule reads the synchronous
  // setState inside one as cascading renders. Same idiom ProjectServerTab uses for its own resets.
  const [prevUploads, setPrevUploads] = useState(storeUploads);
  if (prevUploads !== storeUploads) {
    setPrevUploads(storeUploads);
    setVideoCams(prev => uploadsToCams(storeUploads, "video", prev));
    setImageCams(prev => uploadsToCams(storeUploads, "image", prev));
  }
  const [camSearch, setCamSearch] = useState("");
  const [camTypeFilter, setCamTypeFilter] = useState<CamTypeFilter>("All");
  const [expanded, setExpanded] = useState({ normal:true, video:true, image:true });
  const [collapsed, setCollapsed] = useState(false);
  const [filterType, setFilterType] = useState<DetType | "All">("All");
  const [hud, setHud] = useState<HUDState | null>(null);
  const [detailView, setDetailView] = useState<{ camId: string; data: CamData; det: Detection; autoOpenDetail?: boolean; date?: string; time?: string } | null>(null);
  const [highlightCamId, setHighlightCamId] = useState<string | null>(null);
  // Tracks the last `focusLocation` value already processed, following React's "adjusting
  // state when a prop changes" pattern (state, not a ref, so it's safe to read during render).
  const [prevFocusLocation, setPrevFocusLocation] = useState(focusLocation ?? null);
  const [prevAnalyzeFrameLocation, setPrevAnalyzeFrameLocation] = useState(analyzeFrameLocation ?? null);
  // Grid tile priority order (camera ids). Independent from gridCams (which is just "whatever's
  // currently checked") so a fresh VIP hit can jump a tile to the front — top-left, since CSS
  // grid auto-placement lays out children row-major — without that position resetting back to
  // insertion order on every render.
  const [gridOrder, setGridOrder] = useState<string[]>([]);
  const [prevGridKey, setPrevGridKey] = useState("");
  // Sidebar "VIP detected now" dot: cleared once VIP_DOT_TIMEOUT_MIN passes OR once the operator
  // checks that camera (adds it to the grid) — whichever comes first. Nothing else in this
  // component reads real wall-clock time on its own timer, so a periodic re-render tick is needed
  // for the timeout half to actually take effect instead of only updating on the next unrelated
  // render.
  const [ackedVipCamIds, setAckedVipCamIds] = useState<Set<string>>(new Set());
  const [, setVipDotTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setVipDotTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);
  const hasRecentUnackedVip = (camId: string): boolean => {
    if (ackedVipCamIds.has(camId)) return false;
    const vipDets = (CAM_DATA[camId] ?? DEFAULT_DATA).detections.filter(d => d.type === "VIP");
    if (vipDets.length === 0) return false;
    const latestMin = Math.max(...vipDets.map(d => toMinutesSinceMidnight(d.time)));
    const now = new Date();
    const nowMin = sgtHour(now) * 60 + sgtMinute(now);
    const diff = nowMin - latestMin;
    return diff >= 0 && diff <= VIP_DOT_TIMEOUT_MIN;
  };
  // FLIP animation for grid reordering — CSS Grid can't transition a child moving from one
  // cell to another (row/column assignment isn't an animatable property), so instead: measure
  // each tile's actual screen position before the reorder, let React re-render into the new
  // order, then measure again and animate FROM the old delta back to identity via `transform`.
  // That's what actually makes a VIP hit's jump to top-left visible as a slide instead of a
  // silent teleport.
  const gridTileRefs = useRef(new Map<string, HTMLDivElement>());
  const gridTileRectsRef = useRef(new Map<string, DOMRect>());
  // Clicking the collapsed sidebar's search icon needs to both expand the sidebar AND focus the
  // now-just-mounted input — the ref isn't there yet at click time (sidebar is still collapsed),
  // so the actual focus() happens in an effect once `collapsed` flips. A plain ref (not state) for
  // the "pending focus" flag, since clearing it is a side-effect cleanup, not something a render
  // needs to react to.
  const wantsSearchFocusRef = useRef(false);
  const camSearchInputRef = useRef<HTMLInputElement>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Deep-link from Dashboard's device popup ("View Live in Best Frame") — find the camera
  // whose location best matches the hint and isolate it as the ONLY checked camera, so the
  // grid collapses to a single full-size tile instead of that camera just being one of several.
  if ((focusLocation ?? null) !== prevFocusLocation) {
    setPrevFocusLocation(focusLocation ?? null);
    if (focusLocation) {
      const hint = focusLocation.toLowerCase();
      const match = normalCams.find(c => {
        // Cameras with no real CAM_DATA entry (the bulk-generated ~1000) fall back to "" here —
        // "" is a substring of every string, so without this guard the very first such camera
        // would silently "match" any unmatched hint instead of correctly falling through to no-match.
        const loc = CAM_DATA[c.id]?.location.toLowerCase();
        return !!loc && (loc.includes(hint) || hint.includes(loc));
      });
      if (match) {
        setNormalCams(prev => prev.map(c => ({ ...c, checked: c.id === match.id })));
        setVideoCams(prev => prev.map(c => ({ ...c, checked: false })));
        setImageCams(prev => prev.map(c => ({ ...c, checked: false })));
        setHighlightCamId(match.id);
      } else {
        // The hint came from the System tab's own device list, whose zone names (e.g. "Bishan
        // 3") are drawn from a completely different bulk-generated pool than this page's 16
        // curated CAM_DATA locations — they were never going to substring-match. Rather than
        // silently doing nothing (the previous behavior), isolate to a synthesized tile named
        // after the actual device so "View Live" always shows *a* single matching camera. It
        // falls back to DEFAULT_DATA (generic feed, no detections) same as any other
        // bulk-generated camera with no real footage behind it — honest, not fabricated.
        const focusId = `focus-${hint.replace(/[^a-z0-9]+/g, "-")}`;
        setNormalCams(prev => {
          const withFocusCam = prev.some(c => c.id === focusId)
            ? prev
            : [...prev, { id: focusId, name: focusLocation, checked: false, monitor: "normal" as MonitorState }];
          return withFocusCam.map(c => ({ ...c, checked: c.id === focusId }));
        });
        setVideoCams(prev => prev.map(c => ({ ...c, checked: false })));
        setImageCams(prev => prev.map(c => ({ ...c, checked: false })));
        setHighlightCamId(focusId);
      }
    }
  }

  // Tell the parent its deep-link hint has been consumed — a real side effect (notifying an
  // external callback), so it belongs in an effect rather than the render-phase block above.
  useEffect(() => {
    if (focusLocation) onFocusConsumed?.();
  }, [focusLocation, onFocusConsumed]);

  // Deep-link from Dashboard's map popup ("Analyze Frame") — same camera-isolate as above, but
  // also jumps straight to that camera's Inspection Detail (its first detection) instead of just
  // maximizing the live tile, since the whole point of this entry point is to land on analysis.
  if ((analyzeFrameLocation ?? null) !== prevAnalyzeFrameLocation) {
    setPrevAnalyzeFrameLocation(analyzeFrameLocation ?? null);
    if (analyzeFrameLocation) {
      const hint = analyzeFrameLocation.toLowerCase();
      const match = normalCams.find(c => {
        // Cameras with no real CAM_DATA entry (the bulk-generated ~1000) fall back to "" here —
        // "" is a substring of every string, so without this guard the very first such camera
        // would silently "match" any unmatched hint instead of correctly falling through to no-match.
        const loc = CAM_DATA[c.id]?.location.toLowerCase();
        return !!loc && (loc.includes(hint) || hint.includes(loc));
      });
      if (match) {
        setNormalCams(prev => prev.map(c => ({ ...c, checked: c.id === match.id })));
        setVideoCams(prev => prev.map(c => ({ ...c, checked: false })));
        setImageCams(prev => prev.map(c => ({ ...c, checked: false })));
        setHighlightCamId(match.id);
        const data = CAM_DATA[match.id] ?? DEFAULT_DATA;
        if (data.detections[0]) setDetailView({
          camId: match.id, data, det: data.detections[0],
          // A request that names a moment lands on that moment's frame; the inspection panel is
          // left closed because the detection it would open is whoever happened to be first in
          // this camera's list, not the pair the caller was looking at. A request with no
          // timestamp (Dashboard's map popup) keeps opening the panel as before.
          autoOpenDetail: !analyzeFrameAt,
          date: analyzeFrameAt?.date, time: analyzeFrameAt?.time,
        });
      } else {
        showToast({ variant:"warning", title: t.noMatchTitle, desc: t.noMatchDesc(analyzeFrameLocation) });
      }
    }
  }

  useEffect(() => {
    if (analyzeFrameLocation) onAnalyzeFrameConsumed?.();
  }, [analyzeFrameLocation, onAnalyzeFrameConsumed]);

  useEffect(() => {
    if (!collapsed && wantsSearchFocusRef.current) {
      camSearchInputRef.current?.focus();
      wantsSearchFocusRef.current = false;
    }
  }, [collapsed]);

  // Auto-clear the highlight a few seconds after it's set (setState inside the timer's
  // callback, not synchronously in the effect body, so this is the sanctioned effect pattern).
  useEffect(() => {
    if (!highlightCamId) return;
    const timer = setTimeout(() => setHighlightCamId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightCamId]);

  // Grid layout tops out at a 4x4 (16-tile) arrangement, so selecting more than that has
  // nowhere sane to go — block new checks once the cap is hit, unchecking always still works.
  const MAX_GRID_CAMS = 16;
  // The blocked-click checks (and their toasts) run BEFORE calling setState, not inside the
  // updater callback — React Strict Mode double-invokes updater functions in dev to check for
  // impurity, so a showToast() placed inside one fires twice per click.
  const toggle = (list: Camera[], setter: React.Dispatch<React.SetStateAction<Camera[]>>, id: string) => {
    const cam = list.find(c => c.id === id);
    if (!cam) return;
    if (cam.monitor === "alert") {
      showToast({ variant:"error", title: t.unavailableTitle, desc: t.unavailableDesc(cam.name) });
      return;
    }
    if (!cam.checked && gridCams.length >= MAX_GRID_CAMS) {
      showToast({ variant:"warning", title: t.limitTitle, desc: t.limitDesc(MAX_GRID_CAMS) });
      return;
    }
    setter(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
    // Checking a camera means the operator looked at it — acknowledge its VIP dot right away
    // rather than making them wait out the timeout.
    setAckedVipCamIds(prev => prev.has(id) ? prev : new Set(prev).add(id));
  };

  // Alert cameras are shown disabled (no checkbox affordance) in the sidebar, so they must
  // never count toward "Active" or render in the grid even if their checked flag is stale.
  const activeCams = normalCams.filter(c => c.checked && c.monitor !== "alert");
  const checkedVideoCams = videoCams.filter(c => c.checked && c.monitor !== "alert");
  const checkedImageCams = imageCams.filter(c => c.checked && c.monitor !== "alert");
  // Video list / Image list entries feed the SAME grid as Normal network — checking any of
  // them should put a tile on screen, not just tick a box with no visible effect.
  const gridCams = [...activeCams, ...checkedVideoCams, ...checkedImageCams];

  // Reconcile gridOrder against whatever's actually checked right now: keep existing tiles in
  // their current position, append newly-checked ones at the end, drop unchecked ones. Runs
  // during render (not an effect) since it's adjusting state in response to a change that
  // already happened this render, same pattern as the focusLocation handling above.
  const gridKey = gridCams.map(c => c.id).join(",");
  if (gridKey !== prevGridKey) {
    setPrevGridKey(gridKey);
    const currentIds = new Set(gridCams.map(c => c.id));
    setGridOrder(prev => {
      const kept = prev.filter(id => currentIds.has(id));
      const added = gridCams.map(c => c.id).filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  }
  const gridCamsById = new Map(gridCams.map(c => [c.id, c]));
  const orderedIds = gridOrder.filter(id => gridCamsById.has(id));
  const missingIds = gridCams.map(c => c.id).filter(id => !orderedIds.includes(id));
  const rawOrderedGridCams = [...orderedIds, ...missingIds].map(id => gridCamsById.get(id)!);
  // Standing priority, not just a one-off reaction to the live ticker below: any currently-checked
  // camera that actually has a VIP detection sits ahead of the quiet ones, every render — a VIP
  // hit shouldn't stay wherever it happened to land in the grid (e.g. one top-left, one
  // bottom-right) just because that's the order its checkbox got ticked in. Array.sort is stable,
  // so within "has VIP" / "doesn't" it keeps gridOrder's own sequence (insertion order + whatever
  // the ticker below has already promoted).
  const orderedGridCams = [...rawOrderedGridCams].sort((a, b) => {
    const aVip = (CAM_DATA[a.id] ?? DEFAULT_DATA).detections.some(d => d.type === "VIP") ? 1 : 0;
    const bVip = (CAM_DATA[b.id] ?? DEFAULT_DATA).detections.some(d => d.type === "VIP") ? 1 : 0;
    return bVip - aVip;
  });
  const orderedGridIdsKey = orderedGridCams.map(c => c.id).join(",");
  useLayoutEffect(() => {
    const prevRects = gridTileRectsRef.current;
    const nextRects = new Map<string, DOMRect>();
    gridTileRefs.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));
    nextRects.forEach((nextRect, id) => {
      const prevRect = prevRects.get(id);
      if (!prevRect) return;
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (!dx && !dy) return;
      const el = gridTileRefs.current.get(id);
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force layout so the browser registers the starting transform before we clear it —
      // otherwise both style writes coalesce into one paint and nothing appears to move.
      el.getBoundingClientRect();
      el.style.transition = "transform 0.4s ease";
      el.style.transform = "";
    });
    gridTileRectsRef.current = nextRects;
  }, [orderedGridIdsKey]);
  // The live ticker below fires on its own timer, so its callback would otherwise close over
  // whichever gridCams array existed when the effect was set up — a ref keeps it reading the
  // current one every tick without re-subscribing the timer on every grid change.
  const gridCamsRef = useRef(gridCams);
  useEffect(() => {
    gridCamsRef.current = gridCams;
  }, [gridCams]);

  // Simulates a fresh VIP hit landing on one of the currently-gridded cameras every so often —
  // it jumps to the front of gridOrder (top-left, since CSS grid lays children out row-major),
  // then right, then the row below, exactly matching where the rest of the tiles get pushed to.
  // (No highlight ring on the surfaced tile — that looked off, so this only reorders for now.)
  // This reads CAM_DATA (this page's own static, hand-authored detection set) rather than the
  // shared vcaStore — this page's camera ids (NORMAL_CAMS_INIT, "CAM-0017" etc.) are a completely
  // separate id-space from the store's `cameras`/VIP_SIMULATION_CAMERAS, so there's no real
  // camera to join a shared VIP event against yet. VipAlertTicker in ClientLayout.tsx is the one
  // real event producer in the app; once this page's camera ids are unified with the store's (see
  // the camera-data-pool consolidation), this should pick its "has a fresh VIP hit" candidates
  // from real vcaStore events instead of the static CAM_DATA lookup below.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 20000;
      timer = setTimeout(() => {
        const vipCandidates = gridCamsRef.current.filter(c => (CAM_DATA[c.id] ?? DEFAULT_DATA).detections.some(d => d.type === "VIP"));
        if (vipCandidates.length > 0) {
          const chosen = vipCandidates[Math.floor(Math.random() * vipCandidates.length)];
          setGridOrder(prev => [chosen.id, ...prev.filter(id => id !== chosen.id)]);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, []);
  const atGridCap = gridCams.length >= MAX_GRID_CAMS;
  // Sidebar "Enter source" search — filters each list's visible rows only; the counts/badges
  // above (activeCams.length etc.) stay based on the full unfiltered lists.
  const camNameMatches = (c: Camera) => c.name.toLowerCase().includes(camSearch.trim().toLowerCase());
  // With ~1,000 cameras, scrolling to find "whatever's happening right now" isn't realistic —
  // cameras with an actual detection float to the top of the list instead of sitting wherever
  // they land alphabetically/by-id among a sea of quiet ones. Rank 0 (VIP, sorts highest) tracks
  // the same "recent and not yet checked" window as the pulsing dot itself — once that clears,
  // the camera settles down to rank 1 with the other has-some-detection cameras rather than
  // staying pinned at the top forever. Offline (alert) cameras always rank last, below even the
  // quiet-but-online ones — they can't be selected or have a live detection, so there's nothing
  // "active" about their position mixed in with real cameras.
  const activityRank = (c: Camera) => {
    if (c.monitor === "alert") return 3;
    if (hasRecentUnackedVip(c.id)) return 0;
    const dets = (CAM_DATA[c.id] ?? DEFAULT_DATA).detections;
    if (dets.length > 0) return 1;
    return 2;
  };
  const visibleNormalCams = (camSearch ? normalCams.filter(camNameMatches) : normalCams)
    .slice()
    .sort((a, b) => activityRank(a) - activityRank(b));
  const visibleVideoCams  = camSearch ? videoCams.filter(camNameMatches)  : videoCams;
  const visibleImageCams  = camSearch ? imageCams.filter(camNameMatches)  : imageCams;
  const showNormalSection = camTypeFilter === "All" || camTypeFilter === "Network";
  const showVideoSection  = camTypeFilter === "All" || camTypeFilter === "File";
  const showImageSection  = camTypeFilter === "All" || camTypeFilter === "File";
  const clearAllCams = () => {
    setNormalCams(prev => prev.map(c => ({ ...c, checked:false })));
    setVideoCams(prev => prev.map(c => ({ ...c, checked:false })));
    setImageCams(prev => prev.map(c => ({ ...c, checked:false })));
  };

  // Video/Image list items open straight into their own analysis screen instead of toggling into
  // the live grid — a saved recording/snapshot isn't something you "add to the live feed," it's
  // something you go inspect. The live grid's own selection is left untouched by this.
  function openFileDetail(c: Camera) {
    const data = CAM_DATA[c.id] ?? DEFAULT_DATA;
    if (!data.detections[0]) return;
    setDetailView({ camId: c.id, data, det: data.detections[0] });
  }

  function handleDetClick(det: Detection, data: CamData, camId: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Clamp against the actual browser viewport (not the scrollable grid container) so the
    // popup always renders fully on-screen — no horizontal/vertical scrolling ever required,
    // regardless of where in the feed was clicked or whether the grid itself is scrolled.
    const margin = 12;
    const x = Math.max(margin, Math.min(e.clientX + margin, window.innerWidth - 320 - margin));
    const y = Math.max(margin, Math.min(e.clientY + margin, window.innerHeight - 600 - margin));
    setHud({ det, camId, location: data.location, camLabel: data.camLabel, x, y });
  }

  function handleAnalyze() {
    if (!hud) return;
    setDetailView({ camId: hud.camId, data: CAM_DATA[hud.camId] ?? DEFAULT_DATA, det: hud.det });
    setHud(null);
  }

  if (detailView) {
    return (
      <BestFrameDetailPage
        camLabel={detailView.data.camLabel}
        data={detailView.data}
        initialDet={detailView.det}
        initialDate={detailView.date}
        initialTime={detailView.time}
        onBack={() => setDetailView(null)}
        onGoRedmapTrace={onGoRedmapTrace}
        autoOpenDetail={detailView.autoOpenDetail}
      />
    );
  }

  // "VIP" and "Vehicle" are the detection classes the model reports and read the same in both
  // languages here; only "All" and "Unknown" get translated.
  const FILTER_CFG: { id: DetType | "All"; label: string; color?: string }[] = [
    { id:"All",     label: t.filterAll },
    { id:"VIP",     label:"VIP",              color: DET_COLOR.VIP },
    { id:"Vehicle", label: lang === "ko" ? "차량" : "Vehicle", color: DET_COLOR.Vehicle },
    { id:"Unknown", label: lang === "ko" ? "미확인" : "Unknown", color: DET_COLOR.Unknown },
  ];

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden", backgroundColor:"white", minHeight:0, minWidth:0 }}>

      {/* Collapsed sidebar */}
      {collapsed && (
        <div style={{ width:"64px", flexShrink:0, backgroundColor:"white", borderRight:BORDER, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:"16px", paddingBottom:"16px", gap:"10px" }}>
          <button
            onClick={() => { setCollapsed(false); wantsSearchFocusRef.current = true; }}
            aria-label={t.expandAndSearch}
            style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}
          >
            <CollapsedIcon type="search" />
          </button>
          <button
            onClick={() => { setCollapsed(false); setCamTypeFilter("Network"); setExpanded(p => ({ ...p, normal:true })); }}
            aria-label={t.showLiveList}
            style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}
          >
            <CollapsedIcon type="camera" badge={activeCams.length} purple={activeCams.length > 0} />
          </button>
          <button
            onClick={() => { setCollapsed(false); setCamTypeFilter("File"); setExpanded(p => ({ ...p, video:true })); }}
            aria-label={t.showVideoList}
            style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}
          >
            <CollapsedIcon type="video"  badge={checkedVideoCams.length} purple={checkedVideoCams.length > 0} />
          </button>
          <button
            onClick={() => { setCollapsed(false); setCamTypeFilter("File"); setExpanded(p => ({ ...p, image:true })); }}
            aria-label={t.showImageList}
            style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex" }}
          >
            <CollapsedIcon type="image"  badge={checkedImageCams.length} purple={checkedImageCams.length > 0} />
          </button>
        </div>
      )}

      {/* Expanded sidebar */}
      {!collapsed && (
        <div style={{ width:"240px", flexShrink:0, backgroundColor:"white", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"24px 12px 10px" }}>
            <p style={{ fontSize:"20px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.4px" }}>{t.liveCamera}</p>
          </div>
          <div style={{ padding:"0 12px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", backgroundColor:"var(--gray-100)", borderRadius:"8px", height:"36px", padding:"0 14px", gap:"8px" }}>
              <input
                ref={camSearchInputRef}
                value={camSearch}
                onChange={e => setCamSearch(e.target.value)}
                placeholder={t.searchCameras}
                style={{ flex:1, border:"none", background:"none", outline:"none", fontSize:"13px", color:"var(--gray-900)" }}
              />
              <Search size={14} color="var(--gray-600)" />
            </div>
          </div>
          <div style={{ padding:"0 12px 10px", display:"flex", gap:"6px" }}>
            {CAM_TYPE_FILTERS.map(id => {
              const active = camTypeFilter === id;
              return (
                <button key={id} onClick={() => setCamTypeFilter(id)} style={{
                  padding:"6px 14px", borderRadius:"999px", cursor:"pointer",
                  border: active ? "1px solid var(--gray-700)" : "1px solid var(--gray-300)",
                  backgroundColor: active ? "var(--gray-100)" : "white",
                  color:"var(--gray-700)", fontSize:"12px", fontWeight: active ? 700 : 600,
                }}>
                  {id === "All" ? t.filterAll : id === "Network" ? t.typeNetwork : t.typeFile}
                </button>
              );
            })}
          </div>
          <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
            {showNormalSection && (
              <>
                <SidebarSection label={t.normalNetwork} count={activeCams.length} activeLabel={t.active} expanded={expanded.normal} onToggle={() => setExpanded(p => ({ ...p, normal:!p.normal }))} />
                {expanded.normal && visibleNormalCams.map(c => (
                  <CameraItem key={c.id} cam={c} type="camera" onToggle={() => toggle(normalCams, setNormalCams, c.id)} disabled={atGridCap} activityRank={activityRank(c)} />
                ))}
              </>
            )}
            {showVideoSection && (
              <>
                <SidebarSection label={t.videoList} badge={videoCams.length} expanded={expanded.video} onToggle={() => setExpanded(p => ({ ...p, video:!p.video }))} />
                {expanded.video && visibleVideoCams.map(c => (
                  <CameraItem key={c.id} cam={c} type="video" onToggle={() => openFileDetail(c)} />
                ))}
              </>
            )}
            {showImageSection && (
              <>
                <SidebarSection label={t.imageList} badge={imageCams.length} expanded={expanded.image} onToggle={() => setExpanded(p => ({ ...p, image:!p.image }))} />
                {expanded.image && visibleImageCams.map(c => (
                  <CameraItem key={c.id} cam={c} type="image" onToggle={() => openFileDetail(c)} />
                ))}
              </>
            )}
            {camSearch
              && (!showNormalSection || visibleNormalCams.length === 0)
              && (!showVideoSection || visibleVideoCams.length === 0)
              && (!showImageSection || visibleImageCams.length === 0) && (
              <div style={{ padding:"24px 16px", textAlign:"center", fontSize:"12px", fontWeight:600, color:"var(--gray-400)" }}>
                No cameras match &quot;{camSearch}&quot;.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main area */}
      <div ref={mainRef} style={{ flex:1, overflow:"auto", position:"relative", display:"flex", flexDirection:"column", minHeight:0, minWidth:0 }} onClick={() => setHud(null)}>

        {/* Collapse toggle — floats over the camera grid instead of taking its own flex column,
            matching the Dashboard's map toggle. Shifted -3px for the same reason as there: the
            icon's pill shape starts at x=3 within its own 34px-wide viewBox. */}
        <div
          onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
          role="button"
          tabIndex={0}
          aria-label={collapsed ? t.expandSidebar : t.collapseSidebar}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setCollapsed(!collapsed); } }}
          style={{
            position:"absolute", top:"50%", left:"-3px", transform:"translateY(-50%)",
            zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}
        >
          <SidebarToggleIcon collapsed={collapsed} />
        </div>

        {/* Top: filter */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px 12px", flexShrink:0, borderBottom:BORDER }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
            <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.24px" }}>
              {gridCams.length} / {MAX_GRID_CAMS} selected
            </span>
            {gridCams.length > 0 && (
              <button
                onClick={clearAllCams}
                style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"none", cursor:"pointer", padding:0, fontSize:"12px", fontWeight:600, color:"var(--primary-400)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" stroke="var(--primary-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 3v5h5" stroke="var(--primary-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Reset
              </button>
            )}
          </div>
          <div style={{ display:"flex", gap:"6px" }}>
            {FILTER_CFG.map(f => {
              const active = filterType === f.id;
              if (f.id === "All") {
                return (
                  <button key="All" onClick={() => setFilterType("All")} style={{
                    padding:"6px 16px", borderRadius:"999px", cursor:"pointer",
                    border: active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)",
                    backgroundColor: active ? "var(--gray-900)" : "white",
                    color: active ? "white" : "var(--gray-700)",
                    fontSize:"13px", fontWeight: active ? 700 : 600,
                  }}>All</button>
                );
              }
              const c = f.color!;
              return (
                <button key={f.id} onClick={() => setFilterType(f.id)} style={{
                  display:"flex", alignItems:"center", gap:"6px",
                  padding:"6px 12px", borderRadius:"999px", cursor:"pointer",
                  border: active ? `1px solid ${c}` : "1px solid var(--gray-300)",
                  backgroundColor: active ? c : "white",
                  color: active ? "white" : "var(--gray-700)",
                  fontSize:"13px", fontWeight: active ? 700 : 600,
                }}>
                  <FilterIcon type={f.id as DetType} color={c} active={active} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Camera grid */}
        {gridCams.length === 0 ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", color:"var(--gray-400)" }}>
            <BulletCameraIcon />
            <span style={{ fontSize:"14px", fontWeight:600 }}>{t.selectCamera}</span>
          </div>
        ) : (() => {
          const layout = getGridLayout(gridCams.length);
          const emptySlots = layout.cols * layout.rows - gridCams.length;
          return (
            <div style={{
              display:"grid",
              gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
              gap:"1px", backgroundColor:"var(--gray-200)", flex:1, minHeight:0,
            }}>
              {orderedGridCams.map((cam) => {
                // Synthesized deep-link tiles (see focusLocation handling above) have no CAM_DATA
                // entry — label them with the actual device name instead of the generic
                // "CAM_Unknown • Unknown" DEFAULT_DATA fallback.
                const camData = CAM_DATA[cam.id] ?? (cam.id.startsWith("focus-")
                  ? { ...DEFAULT_DATA, camLabel: t.liveFeed, location: cam.name }
                  : DEFAULT_DATA);
                // A VIP hit on a gridded tile used to also flash the whole tile's edge in purple
                // (vca-cam-alert-glow) — surfacing "VIP here" a different way now (the pulsing
                // dot in the sidebar list), so this tile-wide flash is gone; the corner label's
                // own quieter glow (vca-cam-label-glow, in CameraCard) still marks the tile itself.
                return (
                  <div
                    key={cam.id}
                    // React's documented "map of refs" pattern (react.dev/learn/manipulating-the-dom-with-refs)
                    // for tracking each grid tile's DOM node for the FLIP reorder animation below —
                    // this ref callback only stores nodes for a later effect, never affects rendering.
                    // eslint-disable-next-line react-hooks/refs
                    ref={el => { if (el) gridTileRefs.current.set(cam.id, el); else gridTileRefs.current.delete(cam.id); }}
                    style={{ height:"100%", minHeight:0 }}
                  >
                    <CameraCard
                      cam={cam}
                      data={camData}
                      filterType={filterType}
                      onDetClick={handleDetClick}
                      onHeaderArrowClick={() => setDetailView({ camId: cam.id, data: camData, det: camData.detections[0] })}
                      sidePanelOnHover={layout.sidePanelOnHover}
                      style={cam.id === highlightCamId ? { boxShadow: "inset 0 0 0 3px var(--primary-400)", transition: "box-shadow 0.3s" } : undefined}
                    />
                  </div>
                );
              })}
              {/* Odd counts don't fill the grid evenly (e.g. 3 cams in a 2x2) — leave the
                  remainder as a plain placeholder slot rather than stretching a real feed. */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} style={{ backgroundColor:"var(--gray-50)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"6px", color:"var(--gray-300)" }}>
                  <BulletCameraIcon />
                  <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.awaitingCamera}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* HUD */}
        {hud && <DetectionHUD hud={hud} onClose={() => setHud(null)} onAnalyze={handleAnalyze} onTrackOnMap={() => onGoRedmapTrace?.(hud.det.name)} />}
      </div>
    </div>
  );
}
