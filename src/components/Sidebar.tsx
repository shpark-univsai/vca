"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, Crown } from "lucide-react";
import { Device, DeviceStatus, FilterType, SidebarTab, LiveEvent, TrackingHop, getFacePhoto, formatTimeAgo, nearestDistrict } from "@/lib/mockData";
import {
  useVcaStore, vcaEventsToLiveEvents, todaysDetectionHits,
  useActiveProjectId, useProjectEvents, useProjectPersons, useProjectCameras,
} from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useApiData } from "@/hooks/useApiData";
import { getDashboardStats, getDevices, getDistricts } from "@/lib/api/dashboard";

import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. Camera names, zone names and device names are the
// customer's own labels and stay as entered — the operator matches them against a rack, not a
// dictionary.
const T = {
  en: {
    live: "LIVE",
    out: "OUT",
    registeredVips: "Registered VIP targets",
    noVips: "No VIP targets registered.",
    registeredOn: (date: string) => `Registered ${date}`,
    close: "Close",
    vipDetections: "VIP detections",
    todaysDetections: "Today's detections",
    selectLocation: "Select location",
    allLocations: "All locations",
    liveAnalytics: "Live analytics",
    all: "All",
    vipOnly: "VIP only",
    seenAtCameras: (n: number) => `Seen at ${n} different camera${n === 1 ? "" : "s"}`,
    stopsOnTrail: (n: number) => `${n} stops on this trail`,
    stops: (n: number) => `${n} stops`,
    stopsAcross: (stops: number, cams: number) => `${stops} stops across ${cams} camera${cams === 1 ? "" : "s"}`,
    sameCameraEarlier: "Same camera as earlier in this trail",
    return: "RETURN",
    tracking: "Tracking",
    filterAll: "All",
    filterVip: "VIP Detection",
    filterTracking: "Tracking",
    noEvents: "No events detected currently.",
    rangeOf: (from: number, to: number, total: number) => `${from} – ${to} of ${total}`,
    goToPage: "Go to page",
    prevPage: "Previous page",
    nextPage: "Next page",
    infrastructure: "Infrastructure & debug",
    linkedCams: "Linked cams",
    outCams: "Out cams",
    availability: "Availability",
    searchDevices: "Search devices",
    columns: { name: "NAME", status: "STATUS", type: "TYPE", info: "INFO", pin: "PIN" },
    devicesLoadFailed: "Couldn’t load devices.",
    retry: "Retry",
    noDevices: "No devices found.",
    unknownZone: "Unknown",
    today: "TODAY",
    avail: "AVAIL",
    tabEvents: "EVENTS",
    tabSystem: "SYSTEM",
    events: "Events",
    system: "System",
  },
  ko: {
    live: "정상",
    out: "중단",
    registeredVips: "등록된 VIP 대상",
    noVips: "등록된 VIP 대상이 없습니다.",
    registeredOn: (date: string) => `${date} 등록`,
    close: "닫기",
    vipDetections: "VIP 검출",
    todaysDetections: "오늘 검출",
    selectLocation: "장소 선택",
    allLocations: "전체 장소",
    liveAnalytics: "실시간 분석",
    all: "전체",
    vipOnly: "VIP만",
    seenAtCameras: (n: number) => `서로 다른 카메라 ${n}대에서 검출`,
    stopsOnTrail: (n: number) => `이 이동 경로에서 ${n}곳 경유`,
    stops: (n: number) => `${n}곳 경유`,
    stopsAcross: (stops: number, cams: number) => `카메라 ${cams}대에서 ${stops}곳 경유`,
    sameCameraEarlier: "이 경로에서 앞서 지나간 카메라입니다",
    return: "재방문",
    tracking: "동선 추적",
    filterAll: "전체",
    filterVip: "VIP 검출",
    filterTracking: "동선 추적",
    noEvents: "현재 검출된 이벤트가 없습니다.",
    rangeOf: (from: number, to: number, total: number) => `${total}건 중 ${from} – ${to}`,
    goToPage: "페이지 이동",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    infrastructure: "인프라 및 진단",
    linkedCams: "연결된 카메라",
    outCams: "중단된 카메라",
    availability: "가동률",
    searchDevices: "장비 검색",
    columns: { name: "이름", status: "상태", type: "종류", info: "정보", pin: "고정" },
    devicesLoadFailed: "장비 목록을 불러오지 못했습니다.",
    retry: "다시 시도",
    noDevices: "장비가 없습니다.",
    unknownZone: "미확인",
    today: "오늘",
    avail: "가동률",
    tabEvents: "이벤트",
    tabSystem: "시스템",
    events: "이벤트",
    system: "시스템",
  },
} as const;

// The console's one hairline value — see --line in globals.css, which was defined for exactly
// this and then never reached the app: eight files each declared their own gray-200 rule instead,
// so Portal and the app drew different lines.
const BORDER = "1px solid var(--line)";
const PAGE_SIZE = 12;
const SIDEBAR_TAB_STORAGE_KEY = "vca:sidebarTab";
const SIDEBAR_TAB_CHANGE_EVENT = "vca:sidebarTabChange";

function subscribeToSidebarTab(callback: () => void) {
  window.addEventListener(SIDEBAR_TAB_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SIDEBAR_TAB_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getSidebarTabSnapshot(): SidebarTab {
  return localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY) === "SYSTEM" ? "SYSTEM" : "EVENTS";
}
function getSidebarTabServerSnapshot(): SidebarTab {
  return "EVENTS";
}

// A page refresh lands back on whichever tab was active, via localStorage — useSyncExternalStore
// keeps server/client hydration in agreement on first paint, then picks up the real value.
function usePersistedSidebarTab(): [SidebarTab, (tab: SidebarTab) => void] {
  const tab = useSyncExternalStore(subscribeToSidebarTab, getSidebarTabSnapshot, getSidebarTabServerSnapshot);
  const setTab = (next: SidebarTab) => {
    localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, next);
    window.dispatchEvent(new Event(SIDEBAR_TAB_CHANGE_EVENT));
  };
  return [tab, setTab];
}

const PAGE_BTN: React.CSSProperties = {
  width:"26px", height:"26px", borderRadius:"7px",
  border:"1px solid var(--gray-200)", background:"white",
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  padding:0,
};

/* ── Shared subcomponents ── */
// Compares against the same time yesterday. Detection-count trend direction isn't clearly
// "good" or "bad" here, so this stays neutral gray rather than red/green — the ▲/▼ arrow
// alone (driven by `down`) conveys the up/down, no color needed.
function DeltaBadge({ delta, deltaPct, down }: { delta: number; deltaPct: number; down: boolean }) {
  return (
    <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
      <svg width="8" height="7" viewBox="0 0 8 7" style={{ flexShrink:0, transform: down ? "none" : "rotate(180deg)" }}>
        <path d="M4 7L0 0H8L4 7Z" fill="var(--gray-600)"/>
      </svg>
      <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", lineHeight:"16px" }}>{delta} ({deltaPct}%)</span>
    </div>
  );
}

// Per Figma (node 154:23572): 6px between the label row and the count block, then 4px
// *inside* that block between the count and the delta — not one flat gap across all three,
// which over-tallens the row and throws off the divider line's height next to it.
function StatCol({ icon, label, labelColor = "var(--gray-600)", labelFontSize = 12, count, delta, deltaPct, down }: { icon?: React.ReactNode; label:string; labelColor?:string; labelFontSize?:number; count:number; delta:number; deltaPct:number; down:boolean }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
        {icon}
        <span style={{ fontSize:`${labelFontSize}px`, fontWeight:600, color:labelColor }}>{label}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
        <span style={{ fontSize:"24px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.4px", lineHeight:"30px" }}>{count}</span>
        <DeltaBadge delta={delta} deltaPct={deltaPct} down={down} />
      </div>
    </div>
  );
}

function WatchlistStatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M1 10.5C0.999958 9.73016 1.22207 8.97667 1.63967 8.32994C2.05728 7.68322 2.65264 7.17074 3.3543 6.85401C4.05596 6.53728 4.83412 6.42975 5.59538 6.54434C6.35664 6.65893 7.06866 6.99075 7.646 7.5" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 6.5C6.38071 6.5 7.5 5.38071 7.5 4C7.5 2.61929 6.38071 1.5 5 1.5C3.61929 1.5 2.5 2.61929 2.5 4C2.5 5.38071 3.61929 6.5 5 6.5Z" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 9.5L9 10.5L11 8.5" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EventsTodayStatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M4 1V3" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 1V3" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 2H2.5C1.94772 2 1.5 2.44772 1.5 3V10C1.5 10.5523 1.94772 11 2.5 11H9.5C10.0523 11 10.5 10.5523 10.5 10V3C10.5 2.44772 10.0523 2 9.5 2Z" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.5 5H10.5" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 8L5.5 9L7.5 7" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LocationPinIcon({ color = "var(--gray-700)" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M6.3005 10.8995C7.2305 10.0965 10 7.4965 10 5C10 3.93913 9.57857 2.92172 8.82843 2.17157C8.07828 1.42143 7.06087 1 6 1C4.93913 1 3.92172 1.42143 3.17157 2.17157C2.42143 2.92172 2 3.93913 2 5C2 7.4965 4.7695 10.0965 5.6995 10.8995C5.78614 10.9646 5.8916 10.9999 6 10.9999C6.1084 10.9999 6.21386 10.9646 6.3005 10.8995Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6.5C6.82843 6.5 7.5 5.82843 7.5 5C7.5 4.17157 6.82843 3.5 6 3.5C5.17157 3.5 4.5 4.17157 4.5 5C4.5 5.82843 5.17157 6.5 6 6.5Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * The faces of up to three people actually on this site's watchlist.
 *
 * It used to draw three photos from a stock pool with no connection to the registry at all, so a
 * site with nobody enrolled showed three faces beside the number 0. A face is not decoration:
 * anyone reading it takes it for somebody who is being watched here.
 */
function AvatarStack({ faces }: { faces: string[] }) {
  if (faces.length === 0) return null;
  return (
    <div style={{ display:"flex", alignItems:"center" }}>
      {faces.slice(0, 3).map((url, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i, width:24, height:24, borderRadius:"50%", border:"1px solid white", overflow:"hidden", flexShrink:0 }}>
          <img src={url} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />
        </div>
      ))}
    </div>
  );
}

// photoUrl is optional now: a person imported from a CSV has no enrolled face (see Person in
// vcaStore). Nothing in this app can show a face it does not have, so the tile stays empty rather
// than drawing a broken image.
function PersonThumb({ isSelected, photoUrl }: { isSelected:boolean; photoUrl?:string }) {
  return (
    <div style={{ width:54, height:54, borderRadius:8, flexShrink:0, overflow:"hidden", outline: isSelected ? "2px solid var(--primary-400)" : "none", outlineOffset:2 }}>
      {photoUrl && <img src={photoUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />}
    </div>
  );
}

function VipBadge() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px", flexShrink:0 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
        <path d="M5.781 1.633C5.80258 1.5938 5.83429 1.56112 5.87281 1.53835C5.91133 1.51559 5.95525 1.50358 6 1.50358C6.04475 1.50358 6.08867 1.51559 6.12719 1.53835C6.16571 1.56112 6.19742 1.5938 6.219 1.633L7.695 4.435C7.7302 4.49988 7.77933 4.55617 7.83885 4.59981C7.89838 4.64345 7.96684 4.67338 8.0393 4.68743C8.11176 4.70148 8.18644 4.69932 8.25797 4.68109C8.3295 4.66286 8.3961 4.62902 8.453 4.582L10.5915 2.75C10.6326 2.71661 10.6831 2.69711 10.736 2.6943C10.7888 2.69149 10.8412 2.70552 10.8855 2.73437C10.9299 2.76322 10.964 2.8054 10.9828 2.85485C11.0017 2.90429 11.0044 2.95844 10.9905 3.0095L9.5735 8.1325C9.54458 8.23733 9.48226 8.32988 9.396 8.39611C9.30975 8.46233 9.20425 8.49863 9.0955 8.4995H2.905C2.79617 8.49874 2.69055 8.46249 2.6042 8.39626C2.51784 8.33002 2.45545 8.23742 2.4265 8.1325L1.01 3.01C0.996125 2.95894 0.998811 2.90479 1.01767 2.85535C1.03653 2.8059 1.07059 2.76372 1.11495 2.73487C1.15931 2.70602 1.21168 2.69199 1.26452 2.6948C1.31736 2.69761 1.36795 2.71711 1.409 2.7505L3.547 4.5825C3.6039 4.62952 3.6705 4.66336 3.74203 4.68159C3.81356 4.69982 3.88824 4.70198 3.9607 4.68793C4.03316 4.67388 4.10162 4.64395 4.16115 4.60031C4.22067 4.55666 4.2698 4.50038 4.305 4.4355L5.781 1.633Z" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.5 10.5H9.5" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontSize:"10px", fontWeight:600, color:"var(--primary-400)" }}>VIP</span>
    </div>
  );
}

function PawTrackIcon({ color = "var(--type-tracking)", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <path d="M2.33333 9.33333V7.945C2.33333 6.70833 1.7325 6.125 1.75 4.66667C1.7675 3.08 2.61917 1.16667 4.375 1.16667C5.46583 1.16667 5.83333 2.21667 5.83333 3.20833C5.83333 5.0225 4.66667 6.51 4.66667 8.27167V9.33333C4.66667 9.64275 4.54375 9.9395 4.32496 10.1583C4.10617 10.3771 3.80942 10.5 3.5 10.5C3.19058 10.5 2.89383 10.3771 2.67504 10.1583C2.45625 9.9395 2.33333 9.64275 2.33333 9.33333Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.6667 11.6667V10.2783C11.6667 9.04167 12.2675 8.45833 12.25 7C12.2325 5.41333 11.3808 3.5 9.625 3.5C8.53417 3.5 8.16667 4.55 8.16667 5.54167C8.16667 7.35583 9.33333 8.84333 9.33333 10.605V11.6667C9.33333 11.9761 9.45625 12.2728 9.67504 12.4916C9.89383 12.7104 10.1906 12.8333 10.5 12.8333C10.8094 12.8333 11.1062 12.7104 11.325 12.4916C11.5437 12.2728 11.6667 11.9761 11.6667 11.6667Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.33333 9.91667H11.6667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.33333 7.58333H4.66667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FilterPillIcon({ id, color }: { id: FilterType; color:string }) {
  if (id === "VIP Detection") return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.781 1.633C5.80258 1.5938 5.83429 1.56112 5.87281 1.53835C5.91133 1.51559 5.95525 1.50358 6 1.50358C6.04475 1.50358 6.08867 1.51559 6.12719 1.53835C6.16571 1.56112 6.19742 1.5938 6.219 1.633L7.695 4.435C7.7302 4.49988 7.77933 4.55617 7.83885 4.59981C7.89838 4.64345 7.96684 4.67338 8.0393 4.68743C8.11176 4.70148 8.18644 4.69932 8.25797 4.68109C8.3295 4.66286 8.3961 4.62902 8.453 4.582L10.5915 2.75C10.6326 2.71661 10.6831 2.69711 10.736 2.6943C10.7888 2.69149 10.8412 2.70552 10.8855 2.73437C10.9299 2.76322 10.964 2.8054 10.9828 2.85485C11.0017 2.90429 11.0044 2.95844 10.9905 3.0095L9.5735 8.1325C9.54458 8.23733 9.48226 8.32988 9.396 8.39611C9.30975 8.46233 9.20425 8.49863 9.0955 8.4995H2.905C2.79617 8.49874 2.69055 8.46249 2.6042 8.39626C2.51784 8.33002 2.45545 8.23742 2.4265 8.1325L1.01 3.01C0.996125 2.95894 0.998811 2.90479 1.01767 2.85535C1.03653 2.8059 1.07059 2.76372 1.11495 2.73487C1.15931 2.70602 1.21168 2.69199 1.26452 2.6948C1.31736 2.69761 1.36795 2.71711 1.409 2.7505L3.547 4.5825C3.6039 4.62952 3.6705 4.66336 3.74203 4.68159C3.81356 4.69982 3.88824 4.70198 3.9607 4.68793C4.03316 4.67388 4.10162 4.64395 4.16115 4.60031C4.22067 4.55666 4.2698 4.50038 4.305 4.4355L5.781 1.633Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (id === "Tracking") return <PawTrackIcon color={color} size={14} />;
  return null;
}

// angleDeg: 0 = top (12 o'clock), increasing clockwise — 90 = right, 180 = bottom, 270 = left.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (endAngle <= startAngle) return "";
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

// A real gauge: the filled arc's sweep is proportional to `pct` (0% = no arc, 100% = the full
// half-circle). The previous version drew 3 fixed decorative paths that never changed shape
// regardless of `pct` — the gauge looked identical whether availability was 19% or 90%, which is
// why it always read as "not filling in."
function AvailabilityDonut({ pct, size = 92, hasCameras }: { pct: number; size?: number; hasCameras: boolean }) {
  const height = size * (40 / 92);
  // Neutral gray by default; only shift to a semantic signal color when availability is
  // genuinely low (matches the red/green convention already used elsewhere in this file for
  // LIVE/OUT status). A site with no cameras registered is not a site at 0% — nothing is down
  // there, there is nothing there — so it reads as a dash in gray rather than an alarm.
  const ringColor = hasCameras && pct < 50 ? "var(--danger-400)" : "var(--gray-400)";
  const cx = 46, cy = 40, r = 34, strokeWidth = 10;
  const sweep = 180 * (Math.max(0, Math.min(100, pct)) / 100);
  const trackPath = describeArc(cx, cy, r, 270, 450);
  const fillPath = describeArc(cx, cy, r, 270, 270 + sweep);
  return (
    <div style={{ position:"relative", width:size, height, flexShrink:0 }}>
      <svg width={size} height={height} viewBox="0 0 92 40" fill="none">
        <path d={trackPath} stroke={ringColor} strokeOpacity={0.15} strokeWidth={strokeWidth} strokeLinecap="round" fill="none"/>
        {fillPath && <path d={fillPath} stroke={ringColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none"/>}
        <text x="46" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill={ringColor} fontFamily="SUIT, sans-serif">{hasCameras ? `${pct}%` : "—"}</text>
      </svg>
    </div>
  );
}

function TablePinIcon({ active }: { active: boolean }) {
  const c = active ? "var(--primary-400)" : "var(--gray-500)";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <g clipPath="url(#tpin)">
        <path d="M8.40467 11.1973C9.42067 10.2867 12 7.74265 12 5.33398C12 4.27312 11.5786 3.2557 10.8284 2.50556C10.0783 1.75541 9.06087 1.33398 8 1.33398C6.93913 1.33398 5.92172 1.75541 5.17157 2.50556C4.42143 3.2557 4 4.27312 4 5.33398C4 7.74265 6.58 10.2867 7.59533 11.1973C7.71156 11.2861 7.85375 11.3342 8 11.3342C8.14625 11.3342 8.28844 11.2861 8.40467 11.1973Z" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7.99984 6.66667C8.73622 6.66667 9.33317 6.06971 9.33317 5.33333C9.33317 4.59695 8.73622 4 7.99984 4C7.26346 4 6.6665 4.59695 6.6665 5.33333C6.6665 6.06971 7.26346 6.66667 7.99984 6.66667Z" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.80921 9.33398H3.33588C3.1961 9.33404 3.05987 9.37804 2.94646 9.45975C2.83305 9.54146 2.74819 9.65675 2.70388 9.78932L1.36788 13.7893C1.33439 13.8895 1.32519 13.9963 1.34105 14.1007C1.35691 14.2052 1.39737 14.3044 1.45909 14.3901C1.52082 14.4759 1.60204 14.5457 1.69607 14.5939C1.79009 14.6421 1.89422 14.6673 1.99988 14.6673H13.9999C14.1055 14.6672 14.2095 14.6421 14.3035 14.5939C14.3974 14.5458 14.4786 14.476 14.5403 14.3903C14.602 14.3047 14.6425 14.2056 14.6584 14.1012C14.6743 13.9968 14.6652 13.8902 14.6319 13.79L13.2985 9.78998C13.2543 9.65718 13.1694 9.54167 13.0558 9.45982C12.9423 9.37798 12.8059 9.33395 12.6659 9.33398H10.1912" stroke={c} strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="tpin"><rect width="16" height="16" fill="white"/></clipPath>
      </defs>
    </svg>
  );
}

function SystemHeaderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0 }}>
      <path d="M16.6667 11.6667H3.33333C2.41286 11.6667 1.66667 12.4129 1.66667 13.3333V16.6667C1.66667 17.5871 2.41286 18.3333 3.33333 18.3333H16.6667C17.5871 18.3333 18.3333 17.5871 18.3333 16.6667V13.3333C18.3333 12.4129 17.5871 11.6667 16.6667 11.6667Z" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.00833 15H5" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.34167 15H8.33333" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 8.33333V11.6667" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.8667 5.975C14.5571 5.66508 14.1895 5.41922 13.7848 5.25147C13.3801 5.08372 12.9464 4.99738 12.5083 4.99738C12.0703 4.99738 11.6365 5.08372 11.2319 5.25147C10.8272 5.41922 10.4596 5.66508 10.15 5.975" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.2167 3.61667C15.9665 2.36737 14.2715 1.66559 12.5042 1.66559C10.7368 1.66559 9.04178 2.36737 7.79167 3.61667" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LinkedCamsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.41165 6.47011C5.61374 6.74029 5.87158 6.96385 6.16767 7.12561C6.46376 7.28738 6.79118 7.38358 7.12772 7.40768C7.46426 7.43178 7.80204 7.38323 8.11817 7.2653C8.43429 7.14738 8.72135 6.96285 8.95989 6.72423L10.3717 5.31247C10.8003 4.8687 11.0374 4.27434 11.0321 3.6574C11.0267 3.04047 10.7792 2.45032 10.343 2.01407C9.90673 1.57781 9.31659 1.33036 8.69965 1.325C8.08272 1.31964 7.48836 1.5568 7.04459 1.98541L6.23518 2.79011" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.32638 5.53182C6.12429 5.26164 5.86645 5.03808 5.57036 4.87631C5.27427 4.71455 4.94685 4.61835 4.61031 4.59425C4.27377 4.57014 3.93599 4.6187 3.61987 4.73662C3.30374 4.85455 3.01668 5.03908 2.77815 5.2777L1.36638 6.68946C0.937774 7.13323 0.70061 7.72759 0.705971 8.34452C0.711332 8.96146 0.958789 9.55161 1.39504 9.98786C1.8313 10.4241 2.42144 10.6716 3.03838 10.6769C3.65531 10.6823 4.24967 10.4451 4.69344 10.0165L5.49815 9.21182" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function OfflineCamsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.33 3H7C7.26522 3 7.51957 3.10536 7.70711 3.29289C7.89464 3.48043 8 3.73478 8 4V5.25L10.624 3.719C10.662 3.69683 10.7052 3.68508 10.7492 3.68493C10.7931 3.68478 10.8364 3.69624 10.8745 3.71815C10.9127 3.74006 10.9444 3.77165 10.9664 3.80972C10.9884 3.8478 11 3.89101 11 3.935V8.033" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 8C8 8.26522 7.89464 8.51957 7.70711 8.70711C7.51957 8.89464 7.26522 9 7 9H2C1.73478 9 1.48043 8.89464 1.29289 8.70711C1.10536 8.51957 1 8.26522 1 8V4C1 3.73478 1.10536 3.48043 1.29289 3.29289C1.48043 3.10536 1.73478 3 2 3H3" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 1L11 11" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AvailabilityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M11 6H9.76C9.54148 5.99953 9.32883 6.07065 9.15456 6.20248C8.98029 6.33431 8.854 6.5196 8.795 6.73L7.62 10.91C7.61243 10.936 7.59664 10.9588 7.575 10.975C7.55336 10.9912 7.52705 11 7.5 11C7.47295 11 7.44664 10.9912 7.425 10.975C7.40336 10.9588 7.38757 10.936 7.38 10.91L4.62 1.09C4.61243 1.06404 4.59664 1.04123 4.575 1.025C4.55336 1.00877 4.52705 1 4.5 1C4.47295 1 4.44664 1.00877 4.425 1.025C4.40336 1.04123 4.38757 1.06404 4.38 1.09L3.205 5.27C3.14623 5.47958 3.02069 5.66426 2.84743 5.79601C2.67417 5.92776 2.46266 5.99938 2.245 6H1" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const isLive = status === "Live";
  return (
    <div style={{
      display:"inline-flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"4px 8px", borderRadius:"12px", backgroundColor:"white",
      border: isLive ? "1px solid rgba(22,163,74,0.3)" : "1px solid var(--danger-100)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
        <div style={{ width: isLive ? 2 : 5, height: isLive ? 2 : 5, borderRadius:"50%", backgroundColor: isLive ? "var(--success-400)" : "var(--danger-400)", flexShrink:0 }} />
        <span style={{ fontSize:"10px", fontWeight:800, color: isLive ? "var(--success-400)" : "var(--danger-400)", letterSpacing:"-0.2px" }}>{isLive ? t.live : t.out}</span>
      </div>
    </div>
  );
}

// Same counts EventsSummary/CollapsedSidebar both show — derived from vcaStore so a live
// detection added anywhere (e.g. the Data tab's monitoring feed) updates them everywhere.
function useEventCounts() {
  // Scoped to the site the header is pointed at — see useProjectEvents. These counts sit above a
  // list of that site's detections, so counting every site's would make the number disagree with
  // the rows under it.
  const storeEvents = useProjectEvents();
  const detections = vcaEventsToLiveEvents(storeEvents);
  const persons = useProjectPersons();
  // delta/deltaPct/down (yesterday-comparison fields) come from the future-backend stub rather
  // than importing the mock object directly — see lib/api/dashboard.ts. Falls back to a flat
  // (no change) delta for the brief window before the fetch resolves.
  // Scoped like everything else here. Only the delta fields are read from it, but an unscoped
  // request is an unscoped request — the one call in this file that was still asking about every
  // site at once.
  const countsProjectId = useActiveProjectId();
  const { data: dashboardStats } = useApiData(() => getDashboardStats(countsProjectId), [countsProjectId]);
  const flatDelta = { delta: 0, deltaPct: 0, down: false };
  // "Today's detections" opens the Dashboard's detection-activity chart (see EventsSummary's
  // onToggleDetectionChart below), so it needs to count the same way that chart does — every
  // individual hit today, unrolling a Tracking row's whole multi-camera history — not
  // `detections.length` (one per row, so a person tracked across 10 cameras only counted as 1).
  // Otherwise this number and the chart it opens visibly don't add up to each other.
  const todaysHitCount = todaysDetectionHits(storeEvents).length;
  return {
    vipTargets: persons.filter(p => p.type === "VIP").length,
    watchlistMatch: { ...(dashboardStats?.watchlistMatch ?? flatDelta), count: detections.filter(e => e.type === "VIP").length },
    tracking: { ...(dashboardStats?.tracking ?? flatDelta), count: detections.filter(e => e.type === "Tracking").length },
    eventsToday: { ...(dashboardStats?.eventsToday ?? flatDelta), count: todaysHitCount },
  };
}

/* ── VIP list modal ── */
function VipListModal({ onClose, onPersonSelect }: { onClose: () => void; onPersonSelect: (name: string) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const persons = useProjectPersons().filter(p => p.type === "VIP");
  useEscapeKey(onClose);

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"360px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"80vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding:"14px 16px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <Crown size={16} color="var(--primary-400)" />
            <p style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)" }}>{t.registeredVips}</p>
            <span style={{ fontSize:"14px", fontWeight:800, color:"var(--primary-400)" }}>{persons.length}</span>
          </div>
          <button onClick={onClose} aria-label={t.close} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"var(--gray-400)", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {persons.length === 0 && (
            <div style={{ padding:"32px 16px", textAlign:"center", color:"var(--gray-400)", fontSize:"13px" }}>{t.noVips}</div>
          )}
          {persons.map((p, i) => {
            const registeredLabel = new Date(p.registeredAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year:"numeric", month:"short", day:"numeric" });
            return (
              <div key={p.id}>
                <button
                  onClick={() => { onPersonSelect(p.name); onClose(); }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 16px", width:"100%", border:"none", background:"none", cursor:"pointer", textAlign:"left", transition:"background-color 0.1s" }}
                >
                  <PersonThumb isSelected={false} photoUrl={p.photoUrl} />
                  <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:"3px" }}>
                    <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-900)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                    {p.description && (
                      <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</span>
                    )}
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.registeredOn(registeredLabel)}</span>
                  </div>
                  <VipBadge />
                </button>
                {i < persons.length - 1 && <div style={{ height:"1px", backgroundColor:"var(--gray-200)", margin:"0 16px" }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── EVENTS summary section (always shown) ── */
function EventsSummary({ onPersonSelect, onToggleDetectionChart }: { onPersonSelect: (name: string) => void; onToggleDetectionChart?: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const { vipTargets, watchlistMatch, eventsToday } = useEventCounts();
  // Real enrolled faces from this site's registry — see AvatarStack. A person imported from a CSV
  // has no photo, so they contribute no avatar rather than a placeholder one.
  const vipFaces = useProjectPersons()
    .filter(p => p.type === "VIP" && !!p.photoUrl)
    .slice(0, 3)
    .map(p => p.photoUrl!);
  const [showVipList, setShowVipList] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDetectionsHovered, setIsDetectionsHovered] = useState(false);
  return (
    <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"16px" }}>
        <AvatarStack faces={vipFaces} />
        <button
          onClick={() => setShowVipList(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display:"flex", alignItems:"center", gap:"8px", background: isHovered ? "var(--gray-50)" : "none",
            border:"none", cursor:"pointer", padding:"4px 8px", margin:"-4px -8px", borderRadius:"8px",
            transition:"background-color 0.15s",
          }}
        >
          <span style={{ fontSize:"16px", fontWeight:700, color:"var(--gray-700)", letterSpacing:"-0.32px" }}>{t.registeredVips}</span>
          <span style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.32px" }}>{vipTargets}</span>
        </button>
      </div>
      {showVipList && (
        <VipListModal
          onClose={() => setShowVipList(false)}
          onPersonSelect={(name) => onPersonSelect(name)}
        />
      )}
      <div style={{ display:"flex", alignItems:"center", gap:"16px", borderTop:BORDER, borderBottom:BORDER, padding:"12px 0", minHeight:"78px", boxSizing:"border-box" }}>
        {/* This one opens the chart below, not "Today's detections" — the chart is specifically
            about VIP detection volume over the day, so the click target should be the stat that
            actually names what it's showing. */}
        <div
          onClick={onToggleDetectionChart}
          onMouseEnter={() => setIsDetectionsHovered(true)}
          onMouseLeave={() => setIsDetectionsHovered(false)}
          style={{
            flex:1, minWidth:0, cursor: onToggleDetectionChart ? "pointer" : undefined,
            backgroundColor: isDetectionsHovered ? "var(--gray-50)" : "transparent",
            borderRadius:"8px", padding:"4px", margin:"-4px", transition:"background-color 0.15s",
          }}
        >
          <StatCol icon={<WatchlistStatIcon />} label={t.vipDetections} labelColor="var(--gray-700)" labelFontSize={13} count={watchlistMatch.count} delta={watchlistMatch.delta} deltaPct={watchlistMatch.deltaPct} down={watchlistMatch.down} />
        </div>
        <div style={{ width:"1px", backgroundColor:"var(--gray-200)", alignSelf:"stretch", flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <StatCol icon={<EventsTodayStatIcon />} label={t.todaysDetections} labelColor="var(--gray-600)" labelFontSize={13} count={eventsToday.count} delta={eventsToday.delta} deltaPct={eventsToday.deltaPct} down={eventsToday.down} />
        </div>
      </div>
    </div>
  );
}

/* ── Location picker modal ── */
function LocationPickerModal({ current, onSelect, onClose }: { current: string | null; onSelect: (location: string | null) => void; onClose: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const cameras = useProjectCameras();
  const locations = Array.from(new Set(cameras.map(c => c.name)));
  useEscapeKey(onClose);
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"320px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"70vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding:"14px 16px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <p style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)" }}>{t.selectLocation}</p>
          <button onClick={onClose} aria-label={t.close} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"var(--gray-400)", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
          <button onClick={() => onSelect(null)}
            onMouseEnter={e => { if (current) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = !current ? "var(--gray-100)" : "transparent"; }}
            style={{
              display:"flex", alignItems:"center", gap:"8px", width:"100%", textAlign:"left",
              padding:"9px 10px", borderRadius:"8px", border:"none", cursor:"pointer",
              // Chosen, not purple — see the note on the event row above.
              backgroundColor: !current ? "var(--gray-100)" : "transparent",
              fontSize:"13px", fontWeight:700, color: !current ? "var(--gray-900)" : "var(--gray-700)", transition:"background-color 0.1s",
            }}>{t.allLocations}</button>
          {locations.map(loc => {
            const active = current === loc;
            return (
              <button key={loc} onClick={() => onSelect(loc)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = active ? "var(--gray-100)" : "transparent"; }}
                style={{
                  display:"flex", alignItems:"center", gap:"8px", width:"100%", textAlign:"left",
                  padding:"9px 10px", borderRadius:"8px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "var(--gray-100)" : "transparent",
                  fontSize:"13px", fontWeight: active ? 700 : 600, color: active ? "var(--gray-900)" : "var(--gray-700)", transition:"background-color 0.1s",
                }}>
                <LocationPinIcon color={active ? "var(--gray-700)" : "var(--gray-500)"} />
                {loc}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Same drawing as CameraTrailIcon, in a colour that works on a light background — the trail
 *  version is stroked white because it sits inside a dark pill. */
function CameraCountIcon({ color = "var(--gray-500)" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8 6.5L10.6115 8.241C10.6491 8.26605 10.6929 8.28042 10.7381 8.28258C10.7832 8.28474 10.8281 8.27461 10.868 8.25327C10.9079 8.23192 10.9412 8.20013 10.9645 8.16135C10.9878 8.12256 11.0001 8.07822 11 8.033V3.967C11.0001 3.92178 10.9878 3.87744 10.9645 3.83865C10.9412 3.79987 10.9079 3.76808 10.868 3.74673C10.8281 3.72539 10.7832 3.71526 10.7381 3.71742C10.6929 3.71958 10.6491 3.73395 10.6115 3.759L8 5.5V6.5Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 3H2C1.44772 3 1 3.44772 1 4V8C1 8.55228 1.44772 9 2 9H7C7.55228 9 8 8.55228 8 8V4C8 3.44772 7.55228 3 7 3Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CameraTrailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8 6.5L10.6115 8.241C10.6491 8.26605 10.6929 8.28042 10.7381 8.28258C10.7832 8.28474 10.8281 8.27461 10.868 8.25327C10.9079 8.23192 10.9412 8.20016 10.9644 8.16137C10.9877 8.12258 11 8.07822 11 8.033V3.935C11 3.89101 10.9884 3.84779 10.9664 3.80972C10.9444 3.77164 10.9127 3.74006 10.8745 3.71814C10.8364 3.69623 10.7931 3.68477 10.7492 3.68492C10.7052 3.68507 10.662 3.69683 10.624 3.719L8 5.25" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 3H2C1.44772 3 1 3.44772 1 4V8C1 8.55228 1.44772 9 2 9H7C7.55228 9 8 8.55228 8 8V4C8 3.44772 7.55228 3 7 3Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// A vertical dashed connector between stacked hops in the expanded view — same fixed-interval
// repeating-gradient trick as before (a plain CSS dashed border restretches to each element's own
// height, so it needs a fixed pixel tile to look consistent from hop to hop).
const HOP_DASH_STYLE_VERTICAL: React.CSSProperties = {
  width:"1.5px",
  backgroundImage:"repeating-linear-gradient(to bottom, var(--gray-600) 0, var(--gray-600) 3px, transparent 3px, transparent 6px)",
};

function ChevronDownIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: rotated ? "rotate(180deg)" : "none", transition:"transform 0.15s", flexShrink:0 }}>
      <path d="M4 6L8 10L12 6" stroke="var(--gray-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Tracking events are anonymous multi-camera re-id trails rather than a single photo+name
// detection. A collapsed row summarizes the trail as "N cameras" plus a truncated route string
// (never a horizontal scroller — long routes just ellipsize, same as any other single-line label
// in this list) so every row stays a fixed, predictable height. Clicking a row expands a
// hop-by-hop timeline stacked VERTICALLY underneath it — full detail with zero horizontal
// scrolling, since the sidebar's width is fixed but its height can grow per row.
function hopCameraKey(hop: TrackingHop): string {
  return `${hop.location}::${hop.cameraLabel ?? ""}`;
}

function TrackingEventRow({ event, isSelected, onClick }: { event: LiveEvent; isSelected: boolean; onClick: () => void }) {
  const photoUrl = getFacePhoto(event.id);
  // event.path is stored oldest-first, but the most-recently-seen camera is what an operator
  // cares about first — reverse once here so both the collapsed route line and the expanded
  // timeline read newest-first (leftmost / topmost = just now), and everything downstream can
  // just take hops[0] as "the latest hop".
  const hops = [...(event.path ?? [])].reverse();
  const lastHop = hops[0];
  // "N cameras" must count DISTINCT cameras, not raw hits — a person re-visiting their same
  // regular camera many times over the day is still a single camera in that count.
  const distinctCameraCount = new Set(hops.map(hopCameraKey)).size;
  // Same collapsing idea for the expanded timeline below — a camera the person sat in front of
  // for hours (many repeat hits, none 2 minutes apart) would otherwise render as a wall of
  // identical-looking rows that makes "3 cameras" look wrong at a glance. Each group keeps its
  // most recent hit's time (hops[0] of the run, since hops is newest-first) and a ×N visit count.
  const visitGroups = hops.reduce<{ hop: TrackingHop; count: number }[]>((groups, hop) => {
    const prevGroup = groups[groups.length - 1];
    if (prevGroup && hopCameraKey(prevGroup.hop) === hopCameraKey(hop)) {
      prevGroup.count++;
    } else {
      groups.push({ hop, count: 1 });
    }
    return groups;
  }, []);
  const [isHovered, setIsHovered] = useState(false);
  const [lang] = useLanguage();
  const t = T[lang];
  return (
    <div>
      <div
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 16px", cursor:"pointer",
          // Selection is grey, and a grey that can actually be seen. primary-50 (#fafaff) sat two
          // channels from gray-50 (#f8fafc), so "selected" and "hovered" were the same colour —
          // and the purple was spent on a row state either way. See the note in BestFramePage's
          // CameraItem: purple in this product means a person, not a click.
          backgroundColor: isSelected ? "var(--gray-100)" : isHovered ? "var(--gray-50)" : "transparent",
          transition:"background-color 0.15s",
        }}
      >
        <div style={{ display:"flex", gap:"10px", alignItems:"center", flex:1, minWidth:0 }}>
          <PersonThumb isSelected={isSelected} photoUrl={photoUrl} />
          <div style={{ display:"flex", flexDirection:"column", gap:"5px", flex:1, minWidth:0 }}>
            <div style={{ display:"flex", gap:"6px", alignItems:"baseline" }}>
              <span title={event.name} style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-900)", letterSpacing:"-0.26px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {event.name}
              </span>
              {/* A bare number in a circle said nothing — a first-time reader had no way to tell
                  whether 4 meant cameras, sightings, or minutes. The camera glyph carries the unit
                  without spending the width a word would, and it is the same drawing that marks
                  every row of the trail below, so the association is already established by the
                  time anyone expands the row. */}
              <span title={t.seenAtCameras(distinctCameraCount)} style={{
                flexShrink:0, display:"flex", alignItems:"center", gap:"3px",
                fontSize:"10px", fontWeight:700, color:"var(--gray-500)",
                backgroundColor:"var(--gray-100)", padding:"1px 6px 1px 5px", borderRadius:"999px",
              }}>
                <CameraCountIcon />{distinctCameraCount}
              </span>
              {/* Only when the two differ, i.e. the person doubled back. Without it a collapsed row
                  says "4 cameras" and expands into seven rows, which is the same surprise the
                  expanded caption had to explain after the fact. */}
              {visitGroups.length !== distinctCameraCount && (
                <span title={t.stopsOnTrail(visitGroups.length)} style={{
                  flexShrink:0, fontSize:"10px", fontWeight:600, color:"var(--gray-400)", whiteSpace:"nowrap",
                }}>
                  {t.stops(visitGroups.length)}
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:"5px", alignItems:"center", minWidth:0 }}>
              <LocationPinIcon color="var(--gray-700)" />
              {/* Just the camera captured most recently — expanding the row already shows the
                  full hop-by-hop history below, so cramming a route chain into this collapsed
                  line was redundant (and its directional arrow kept reading as ambiguous/
                  backwards no matter which way it pointed). The "· time ago" that used to trail
                  this got dropped too — a real camera code (e.g. "Geylang 9 CAM-SIM-51314") plus
                  a timestamp genuinely doesn't fit next to the "N cameras"/"Tracking" badges on
                  the right in a 380px sidebar, so time lost out to showing the full camera name —
                  the exact time is still one click away in the expanded timeline below. The
                  name itself is never truncated (wraps instead) now that it isn't sharing this
                  line with a chevron. */}
              {lastHop && (
                <span style={{ minWidth:0, fontSize:"12px", fontWeight:600, color:"var(--gray-700)", wordBreak:"break-word" }}>
                  {lastHop.location}{lastHop.cameraLabel ? ` ${lastHop.cameraLabel}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Right-side column: "Tracking" label on top, expand/collapse chevron directly under
            it — alignItems:"flex-end" keeps the chevron flush with wherever "Tracking" happens
            to end, instead of the chevron living on the left side lining up with nothing above
            it. */}
        <div style={{ marginLeft:"8px", flexShrink:0, alignSelf:"flex-start", marginTop:"10px", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <PawTrackIcon size={14} />
            <span style={{ fontSize:"12px", fontWeight:600, color:"var(--type-tracking)", letterSpacing:"-0.24px", whiteSpace:"nowrap" }}>{t.tracking}</span>
          </div>
          <ChevronDownIcon rotated={isSelected} />
        </div>
      </div>
      {isSelected && (
        <div style={{ display:"flex", flexDirection:"column", padding:"0 16px 12px 60px" }}>
          {/* The badge counts cameras, this list counts stops, and the two differ whenever someone
              doubles back — three cameras can produce four rows with one name appearing twice,
              which reads as a miscount unless the timeline says which number it is showing. The
              ×N inside a row already collapses consecutive hits; it cannot collapse a return
              visit, because that IS the interesting part of a trail. */}
          {visitGroups.length !== distinctCameraCount && (
            <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"-0.2px" }}>
              {t.stopsAcross(visitGroups.length, distinctCameraCount)}
            </p>
          )}
          {visitGroups.map(({ hop, count }, i) => {
            const isLast = i === visitGroups.length - 1;
            return (
              <div key={i} style={{ display:"flex", gap:"8px", alignItems: isLast ? "center" : "stretch" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"20px", flexShrink:0 }}>
                  <div style={{ width:"20px", height:"16px", backgroundColor:"var(--gray-700)", borderRadius:"7px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <CameraTrailIcon />
                  </div>
                  {!isLast && <div style={{ ...HOP_DASH_STYLE_VERTICAL, flex:1, minHeight:"14px", marginTop:"2px" }} />}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"2px", paddingBottom: isLast ? 0 : "10px" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                    <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-900)", letterSpacing:"-0.24px" }}>
                      {hop.location}{hop.cameraLabel ? ` ${hop.cameraLabel}` : ""}
                    </span>
                    {count > 1 && (
                      <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>×{count}</span>
                    )}
                    {/* Marks the row as the same camera seen earlier in the trail, so a repeated
                        name reads as "came back here" rather than a duplicated row. */}
                    {visitGroups.slice(0, i).some(g => hopCameraKey(g.hop) === hopCameraKey(hop)) && (
                      <span title={t.sameCameraEarlier} style={{
                        fontSize:"9px", fontWeight:800, color:"var(--gray-500)", backgroundColor:"var(--gray-100)",
                        padding:"1px 5px", borderRadius:"999px", letterSpacing:"0.2px", whiteSpace:"nowrap",
                      }}>{t.return}</span>
                    )}
                  </span>
                  <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-500)", letterSpacing:"-0.2px" }}>
                    {formatTimeAgo(hop.timestamp, lang)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VipEventRow({ event, isSelected, photoUrl, onClick, locationFilter }: { event: LiveEvent; isSelected: boolean; photoUrl: string; onClick: () => void; locationFilter?: string | null }) {
  // Already scoped to one location (the "Live Analytics · Tampines" header above says so) —
  // repeating that same location on every row just to append the camera label pushed long labels
  // (e.g. "CAM-SIM-513...") into ellipsis. Only the camera name is new information here.
  const secondLine = locationFilter ? (event.cameraLabel ?? event.location) : `${event.location}${event.cameraLabel ? ` · ${event.cameraLabel}` : ""}`;
  const [isHovered, setIsHovered] = useState(false);
  const [lang] = useLanguage();
  return (
    <div
      onClick={onClick}
      // Selecting a detection moves the map to it — the main thing this panel is for, and it was
      // a div with an onClick, so a keyboard could not reach it at all.
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      aria-pressed={isSelected}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px", cursor:"pointer",
        backgroundColor: isSelected ? "var(--gray-100)" : isHovered ? "var(--gray-50)" : "transparent",
        transition:"background-color 0.15s",
      }}
    >
      <div style={{ display:"flex", gap:"10px", alignItems:"center", flex:1, minWidth:0 }}>
        <PersonThumb isSelected={isSelected} photoUrl={photoUrl} />
        <div style={{ display:"flex", flexDirection:"column", gap:"5px", flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:"6px", alignItems:"baseline" }}>
            <span title={event.name} style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-900)", letterSpacing:"-0.26px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {event.name}
            </span>
            <span style={{
              fontSize:"10px", fontWeight:600, color:"var(--gray-500)", flexShrink:0,
              border:"1px solid var(--gray-300)", borderRadius:"999px", padding:"1px 8px",
            }}>{event.confidence}%</span>
          </div>
          <div style={{ display:"flex", gap:"5px", alignItems:"center" }}>
            <LocationPinIcon color="var(--gray-700)" />
            <span title={secondLine} style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-700)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {secondLine}
            </span>
            <span style={{ color:"var(--gray-300)", fontSize:"11px", flexShrink:0 }}>·</span>
            <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-500)", flexShrink:0 }}>{formatTimeAgo(event.timestamp, lang)}</span>
          </div>
        </div>
      </div>
      <div style={{ marginLeft:"8px", flexShrink:0, alignSelf:"flex-start", marginTop:"10px" }}>
        <VipBadge />
      </div>
    </div>
  );
}

/* ── EVENTS list section ── */
interface EventsListProps {
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  locationFilter?: string | null;
  onLocationClear?: () => void;
  onLocationSelect?: (location: string) => void;
  districtFilter?: string | null;
  onDistrictClear?: () => void;
  personFilter?: string | null;
  onPersonClear?: () => void;
}

function EventsList({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, districtFilter, onDistrictClear, personFilter, onPersonClear }: EventsListProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [filter, setFilter] = useState<FilterType>("All");
  const [page, setPage] = useState(1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const FILTERS: FilterType[] = ["All", "VIP Detection", "Tracking"];
  const liveEvents = vcaEventsToLiveEvents(useProjectEvents());
  // Routed through the future-backend stub instead of importing the mock array directly — see
  // lib/api/dashboard.ts. Falls back to the raw district id (still a valid, if less pretty,
  // label) for the brief pre-fetch window.
  const { data: districts } = useApiData(() => getDistricts(), []);
  const districtLabel = districtFilter ? districts?.find(d => d.id === districtFilter)?.label ?? districtFilter : null;

  const byType = filter === "All" ? liveEvents
    : liveEvents.filter(e => {
        if (filter === "VIP Detection") return e.type === "VIP";
        return e.type === filter;
      });
  // A district groups several sites by geographic proximity (map-pill click), so it filters by
  // nearest-district-to-lat/lng rather than locationFilter's plain name-substring match — the
  // two are mutually exclusive (ClientLayout clears one whenever the other is set).
  const byLocation = districtFilter
    ? byType.filter(e => e.type === "VIP" && nearestDistrict(e.lat, e.lng).id === districtFilter)
    : locationFilter
      ? byType.filter(e => e.location.toLowerCase().includes(locationFilter.toLowerCase()))
      : byType;
  const unsorted = personFilter
    ? byLocation.filter(e => e.name.toLowerCase() === personFilter.toLowerCase())
    : byLocation;
  // Newest first — the store's own insertion order isn't a reliable proxy for this: a person
  // with several past (non-Tracking) hits gets their whole row cluster reinserted together
  // oldest-first within that cluster whenever any one of their hits changes, so relying on
  // insertion order alone could show an older hit above a newer one from someone else.
  const filtered = [...unsorted].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      {/* Live Analytics + filter */}
      <div style={{ padding:"20px 20px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <span style={{ fontSize:"16px", fontWeight:700, color:"var(--gray-700)", letterSpacing:"-0.32px" }}>{t.liveAnalytics}</span>
          <button
            onClick={() => setShowLocationPicker(true)}
            style={{ display:"flex", alignItems:"center", gap:"4px", background:"none", border:"none", cursor:"pointer", padding:0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
              <path d="M8.40075 14.5333C9.64075 13.4627 13.3334 9.99599 13.3334 6.66732C13.3334 5.25283 12.7715 3.89628 11.7713 2.89608C10.7711 1.89589 9.41457 1.33398 8.00008 1.33398C6.58559 1.33398 5.22904 1.89589 4.22885 2.89608C3.22865 3.89628 2.66675 5.25283 2.66675 6.66732C2.66675 9.99599 6.35941 13.4627 7.59941 14.5333C7.71493 14.6202 7.85555 14.6672 8.00008 14.6672C8.14461 14.6672 8.28523 14.6202 8.40075 14.5333Z" stroke="var(--primary-400)" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 8.66602C9.10457 8.66602 10 7.77059 10 6.66602C10 5.56145 9.10457 4.66602 8 4.66602C6.89543 4.66602 6 5.56145 6 6.66602C6 7.77059 6.89543 8.66602 8 8.66602Z" stroke="var(--primary-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize:"13px", fontWeight:700, color:"var(--primary-400)", letterSpacing:"-0.26px" }}>
              {locationFilter || t.all}
            </span>
          </button>
        </div>
        {personFilter && (
          <button
            onClick={onPersonClear}
            style={{ display:"flex", alignItems:"center", gap:"5px", background:"var(--primary-50)", border:"none", borderRadius:"999px", padding:"5px 10px", cursor:"pointer", marginBottom:"12px" }}
          >
            <Crown size={11} color="var(--primary-400)" />
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--primary-400)" }}>{personFilter}</span>
            <span style={{ fontSize:"12px", color:"var(--primary-400)", fontWeight:700 }}>✕</span>
          </button>
        )}
        {/* A district is a place, so the chip below is grey — where the person-filter chip above
            names a person and keeps the purple. That is the whole rule: purple marks somebody, and
            everything else on this panel is a filter the operator set. */}
        {districtLabel && (
          <button
            onClick={onDistrictClear}
            style={{ display:"flex", alignItems:"center", gap:"5px", background:"var(--gray-100)", border:"none", borderRadius:"999px", padding:"5px 10px", cursor:"pointer", marginBottom:"12px" }}
          >
            <LocationPinIcon color="var(--gray-600)" />
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-800)" }}>{districtLabel} · {t.vipOnly}</span>
            <span style={{ fontSize:"12px", color:"var(--gray-600)", fontWeight:700 }}>✕</span>
          </button>
        )}
        <div style={{ display:"flex", gap:"6px" }}>
          {FILTERS.map(id => {
            const active = filter === id;
            const color  = active ? "white" : "var(--gray-700)";
            return (
              <button key={id} onClick={() => { setFilter(id); setPage(1); }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-200)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-100)"; }}
                style={{
                  display:"flex", alignItems:"center", gap:"4px",
                  padding:"4px 8px", borderRadius:"999px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "var(--primary-400)" : "var(--gray-100)",
                  color, fontSize:"12px", fontWeight:600, letterSpacing:"-0.24px", transition:"all 0.15s",
                }}>
                <FilterPillIcon id={id} color={color} />
                {id === "All" ? t.filterAll : id === "VIP Detection" ? t.filterVip : t.filterTracking}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {paginated.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 20px" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-400)", textAlign:"center", letterSpacing:"-0.26px" }}>
              {t.noEvents}
            </span>
          </div>
        )}
        {paginated.map((event, i) => {
          const isSelected = event.id === selectedEventId;
          const photoUrl = getFacePhoto(event.id);
          return (
            <div key={`${event.type}-${event.id}-${i}`}>
              {event.type === "Tracking" ? (
                <TrackingEventRow event={event} isSelected={isSelected} onClick={() => onEventSelect?.(isSelected ? null : event)} />
              ) : (
                <VipEventRow event={event} isSelected={isSelected} photoUrl={photoUrl} onClick={() => onEventSelect?.(isSelected ? null : event)} locationFilter={locationFilter} />
              )}
              {i < paginated.length - 1 && <div style={{ height:"1px", backgroundColor:"var(--gray-200)", margin:"0 16px" }} />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ padding:"10px 16px", borderTop:BORDER, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center", backgroundColor:"white" }}>
        <span style={{ fontSize:"10px", color:"var(--gray-400)", fontWeight:600 }}>{t.rangeOf(rangeStart, rangeEnd, filtered.length)}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"11px", color:"var(--gray-400)" }}>{t.goToPage}</span>
          <input type="number" min={1} max={totalPages} value={safePage}
            onChange={e => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
            style={{ width:"32px", textAlign:"center", fontSize:"12px", fontWeight:700, border:"1px solid var(--gray-200)", borderRadius:"6px", padding:"2px 0", outline:"none", color:"var(--gray-900)" }} />
          <span style={{ fontSize:"11px", color:"var(--gray-400)" }}>/ {totalPages}</span>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage===1} aria-label={t.prevPage} style={{ ...PAGE_BTN, opacity: safePage===1 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="var(--gray-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage===totalPages} aria-label={t.nextPage} style={{ ...PAGE_BTN, opacity: safePage===totalPages ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="var(--gray-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          current={locationFilter ?? null}
          onSelect={(loc) => {
            if (loc) onLocationSelect?.(loc);
            else onLocationClear?.();
            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </>
  );
}

/* ── SYSTEM tab ── */
interface SystemTabProps {
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
}

const SYSTEM_STATUS_FILTERS: ("All" | DeviceStatus)[] = ["All", "Live", "Off"];

function SystemTab({ onPinDevice, pinnedDeviceId: externalPinnedId }: SystemTabProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | DeviceStatus>("All");
  const [page,   setPage]   = useState(1);
  const [localPinnedId, setLocalPinnedId] = useState<string | null>(null);
  const pinnedDeviceId = externalPinnedId ?? localPinnedId;
  // This site's cameras only — both for the zone names below and as the fetch dependency, so
  // switching sites in the header re-reads the list instead of leaving the previous site's rows.
  const activeProjectId = useActiveProjectId();
  const cameras = useProjectCameras();
  // Routed through the future-backend stubs instead of importing the mock array/object directly
  // — see lib/api/dashboard.ts. `devices` defaults to [] for the brief pre-fetch window, which
  // the existing "No devices found." empty state already covers.
  //
  // `cameras` is a dependency because the device list is now projected from it: register or
  // remove a camera in Portal, or take one offline, and this list re-reads instead of showing
  // what was true when the tab first mounted. A real backend needs the same trigger — a poll or
  // a socket signal — so the dependency is not mock scaffolding.
  const { data: dashboardStats } = useApiData(() => getDashboardStats(activeProjectId), [cameras, activeProjectId]);
  const { data: devicesData, error: devicesError, refetch: refetchDevices } = useApiData(() => getDevices(activeProjectId), [cameras, activeProjectId]);
  const devices = devicesData ?? [];
  const linkedCams = dashboardStats?.linkedCams ?? { count: 0, delta: 0, deltaPct: 0, down: false };
  const offlineCams = dashboardStats?.offlineCams ?? { count: 0, delta: 0, deltaPct: 0, down: false };
  const availability = dashboardStats?.availability ?? 0;
  const linkedCount  = devices.filter(d => d.status === "Live").length;
  const offlineCount = devices.filter(d => d.status === "Off").length;

  // The list has 1000 rows to draw from, so there's no reason a page should ever look emptier
  // than the space available for it — measure how tall the list container actually is and how
  // tall one row actually renders at, and fill the page with exactly that many rows instead of
  // a fixed guess. Only the true last page (1000 not evenly divisible) can ever come up short.
  const listRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // `devices` comes from useApiData and starts empty until the fetch resolves, so on first mount
  // there's no row to measure yet — the initial recalc() below silently no-ops (guarded by
  // `!row`), and without devices.length in the deps here, nothing ever asks it to try again once
  // real rows actually exist. That's why pageSize was permanently stuck at the PAGE_SIZE default
  // regardless of how tall the sidebar actually was — this re-runs recalc once real data (and a
  // real first row to measure) arrives.
  useEffect(() => {
    const recalc = () => {
      const container = listRef.current;
      const row = firstRowRef.current;
      if (!container || !row || row.offsetHeight === 0) return;
      setPageSize(Math.max(1, Math.floor(container.clientHeight / row.offsetHeight)));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [devices.length]);

  const filtered = devices.filter(d =>
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.ip.includes(search)) &&
    (statusFilter === "All" || d.status === statusFilter)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd   = Math.min(safePage * pageSize, filtered.length);

  return (
    <>
      {/* Infrastructure & Debug header + stats */}
      <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
          <SystemHeaderIcon />
          <p style={{ fontSize:"16px", fontWeight:700, color:"var(--gray-700)", letterSpacing:"-0.32px" }}>
            {t.infrastructure}
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", borderTop:BORDER, borderBottom:BORDER, padding:"12px 0", minHeight:"78px", boxSizing:"border-box" }}>
          <div style={{ flex:1 }}>
            <StatCol icon={<LinkedCamsIcon />} label={t.linkedCams} labelFontSize={13} count={linkedCount} delta={linkedCams.delta} deltaPct={linkedCams.deltaPct} down={linkedCams.down} />
          </div>
          <div style={{ width:"1px", backgroundColor:"var(--gray-200)", alignSelf:"stretch", flexShrink:0 }} />
          <div style={{ flex:1, paddingLeft:"14px" }}>
            <StatCol icon={<OfflineCamsIcon />} label={t.outCams} labelFontSize={13} count={offlineCount} delta={offlineCams.delta} deltaPct={offlineCams.deltaPct} down={offlineCams.down} />
          </div>
          <div style={{ width:"1px", backgroundColor:"var(--gray-200)", alignSelf:"stretch", flexShrink:0 }} />
          <div style={{ flex:1, paddingLeft:"14px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", alignSelf:"flex-start", marginBottom:"6px" }}>
              <AvailabilityIcon />
              <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-600)" }}>{t.availability}</span>
            </div>
            <AvailabilityDonut pct={availability} hasCameras={devices.length > 0} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding:"20px 20px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", border:BORDER, borderRadius:"8px", padding:"9px 18px", backgroundColor:"white" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t.searchDevices}
            style={{ flex:1, border:"none", background:"none", outline:"none", fontSize:"12px", fontWeight:600, color:"var(--gray-700)" }} />
          <Search size={18} color="var(--gray-600)" />
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display:"flex", gap:"6px", padding:"0 20px 16px", flexShrink:0 }}>
        {SYSTEM_STATUS_FILTERS.map(id => {
          const active = statusFilter === id;
          return (
            <button key={id} onClick={() => { setStatusFilter(id); setPage(1); }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-200)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--gray-100)"; }}
              // No status dot. These are filters, not statuses — the dot said "green means live"
              // beside a word that already said Live, and the same colours mean "this row is live"
              // in the list below, so a filter wearing them read as a row that had been selected.
              style={{
                display:"flex", alignItems:"center",
                padding:"4px 10px", borderRadius:"999px", border:"none", cursor:"pointer",
                backgroundColor: active ? "var(--primary-400)" : "var(--gray-100)",
                color: active ? "white" : "var(--gray-700)", fontSize:"12px", fontWeight:600, letterSpacing:"-0.24px", transition:"all 0.15s",
              }}>
              {id === "All" ? t.all : id === "Live" ? t.live : t.out}
            </button>
          );
        })}
      </div>

      {/* Table header */}
      <div style={{ display:"grid", gridTemplateColumns:"76px 60px 40px 1fr 32px", padding:"6px 20px", flexShrink:0, gap:"4px" }}>
        {([
          ["name", "left"], ["status", "left"], ["type", "center"], ["info", "right"], ["pin", "center"],
        ] as const).map(([key, align]) => (
          <span key={key} style={{
            fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.24px",
            textAlign: align,
          }}>{t.columns[key]}</span>
        ))}
      </div>

      {/* Device list — flex:1 so pagination stays pinned to the sidebar's bottom (the standard
          pattern), but pageSize is measured from the actual available height (see the
          ResizeObserver below) so the page is filled with real rows instead of leaving a gap
          above the pagination bar. Only the true last page (e.g. 1000 not divisible by pageSize)
          can ever be short — that's unavoidable, not a bug. */}
      <div ref={listRef} style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {/* A failed fetch and a genuinely-empty filter used to look identical ("No devices
            found."), which reads as "your search matched nothing" when the real problem is the
            list never loaded at all — distinguish the two so a real fetch failure is visible
            and recoverable instead of silently indistinguishable from zero results. */}
        {devicesError ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 20px", gap:"10px" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--danger-400)", textAlign:"center", letterSpacing:"-0.26px" }}>
              {t.devicesLoadFailed}
            </span>
            <button onClick={refetchDevices} style={{ fontSize:"12px", fontWeight:700, color:"var(--primary-400)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {t.retry}
            </button>
          </div>
        ) : filtered.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 20px" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-400)", textAlign:"center", letterSpacing:"-0.26px" }}>
              {t.noDevices}
            </span>
          </div>
        )}
        {paginated.map((device, i) => {
          const isPinned = device.id === pinnedDeviceId;
          const zone = nearestZoneName(device.lat, device.lng, cameras, t.unknownZone);
          return (
            <div key={device.id} ref={i === 0 ? firstRowRef : undefined}>
            <div
              onClick={() => {
                const next = isPinned ? null : device;
                setLocalPinnedId(next?.id ?? null);
                onPinDevice?.(next);
              }}
              onMouseEnter={e => { if (!isPinned) e.currentTarget.style.backgroundColor = "var(--gray-50)"; }}
              onMouseLeave={e => { if (!isPinned) e.currentTarget.style.backgroundColor = "transparent"; }}
              style={{
                display:"grid", gridTemplateColumns:"76px 60px 40px 1fr 32px",
                alignItems:"center", padding:"10px 20px", gap:"4px", cursor:"pointer",
                backgroundColor: isPinned ? "var(--gray-100)" : "transparent", transition:"background-color 0.1s",
              }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"1px", overflow:"hidden" }}>
                <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.24px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{device.name}</span>
                <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-400)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{zone}</span>
              </div>
              <div><StatusBadge status={device.status} /></div>
              <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{device.type}</span>
              <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{device.ip}</span>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"2px" }}>
                <TablePinIcon active={isPinned} />
              </div>
            </div>
            {i < paginated.length - 1 && <div style={{ height:"1px", backgroundColor:"var(--gray-200)", margin:"0 20px" }} />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ padding:"10px 16px", borderTop:BORDER, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"10px", color:"var(--gray-400)", fontWeight:600 }}>{t.rangeOf(rangeStart, rangeEnd, filtered.length)}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"11px", color:"var(--gray-400)" }}>{t.goToPage}</span>
          <input type="number" min={1} max={totalPages} value={safePage}
            onChange={e => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
            style={{ width:"32px", textAlign:"center", fontSize:"12px", fontWeight:700, border:"1px solid var(--gray-200)", borderRadius:"6px", padding:"2px 0", outline:"none", color:"var(--gray-900)" }} />
          <span style={{ fontSize:"11px", color:"var(--gray-400)" }}>/ {totalPages}</span>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage===1} aria-label={t.prevPage} style={{ ...PAGE_BTN, opacity: safePage===1 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="var(--gray-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage===totalPages} aria-label={t.nextPage} style={{ ...PAGE_BTN, opacity: safePage===totalPages ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="var(--gray-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Collapsed sidebar (60px) ── */
// Devices only carry lat/lng, not a location name — approximate one from the nearest
// registered camera zone rather than inventing a label with no data behind it.
function nearestZoneName(lat: number, lng: number, cameras: { name: string; lat: number; lng: number }[], unknown = "Unknown"): string {
  let best = cameras[0];
  let bestDist = Infinity;
  for (const c of cameras) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best?.name ?? unknown;
}

function CollapsedSidebar({ position = "left", onEventSelect, selectedEventId, onPinDevice, pinnedDeviceId }: {
  position?: "left" | "right";
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [tab, setTab] = usePersistedSidebarTab();
  const [hovered, setHovered] = useState<{ id: string; top: number; item: LiveEvent | Device } | null>(null);
  const { vipTargets, eventsToday } = useEventCounts();
  const activeProjectId = useActiveProjectId();
  const { data: dashboardStats } = useApiData(() => getDashboardStats(activeProjectId), [activeProjectId]);
  const availability = dashboardStats?.availability ?? 0;
  // The same figure the expanded sidebar shows under "today's detections", not a sum of the two
  // row counts. Those count ROWS, with no date filter at all — a Tracking row is one row and
  // several hits, and yesterday's rows are still in the list — so the collapsed badge and the
  // expanded one disagreed under the same word.
  const todayTotal = eventsToday.count;
  const liveEvents = vcaEventsToLiveEvents(useProjectEvents());
  const cameras = useProjectCameras();
  const { data: devicesData } = useApiData(() => getDevices(activeProjectId), [cameras, activeProjectId]);
  const devices = devicesData ?? [];

  const handleMouseEnter = (e: React.MouseEvent, id: string, item: LiveEvent | Device) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHovered({ id, top: rect.top, item });
  };

  return (
    <div onMouseLeave={() => setHovered(null)} style={{ width:"60px", flexShrink:0, height:"100%", backgroundColor:"white", ...(position === "right" ? { borderLeft: BORDER } : { borderRight: BORDER }), display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 0", overflow:"hidden", position:"relative" }}>
      {/* Tab toggle */}
      <div style={{ width:"44px", backgroundColor:"var(--gray-100)", borderRadius:"12px", padding:"4px", display:"flex", flexDirection:"column", gap:"4px", flexShrink:0 }}>
        <button onClick={() => setTab("EVENTS")} aria-label={t.events} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="EVENTS" ? "var(--primary-400)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25" stroke={tab==="EVENTS" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.083 5.25L8.16634 8.16667L5.83301 5.83333L4.08301 7.58333" stroke={tab==="EVENTS" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button onClick={() => setTab("SYSTEM")} aria-label={t.system} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="SYSTEM" ? "var(--primary-400)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9.87887 7.82031H12.0651C12.1677 7.82037 12.2685 7.84663 12.3581 7.89661C12.4477 7.94658 12.523 8.01862 12.5769 8.10587C12.6308 8.19313 12.6615 8.29271 12.6661 8.39517C12.6708 8.49764 12.6491 8.59958 12.6033 8.69133L11.3789 11.1406C11.3325 11.2334 11.2629 11.3127 11.1768 11.3706C11.0907 11.4286 10.9911 11.4633 10.8876 11.4714C10.7842 11.4796 10.6804 11.4608 10.5863 11.417C10.4923 11.3731 10.4111 11.3057 10.3508 11.2213L9.07227 9.43352" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.0928 6.04789C10.2354 6.11931 10.3439 6.24445 10.3944 6.39581C10.4448 6.54717 10.4331 6.71236 10.3618 6.8551L8.49219 10.5938C8.45683 10.6645 8.40788 10.7276 8.34814 10.7793C8.28841 10.8311 8.21905 10.8707 8.14403 10.8957C8.06901 10.9206 7.98981 10.9306 7.91094 10.925C7.83208 10.9193 7.75509 10.8982 7.68438 10.8628L1.96893 8.0024C1.55379 7.7933 1.23838 7.42826 1.09173 6.98717C0.945073 6.54608 0.979114 6.06486 1.1864 5.6488L2.01708 3.96938C2.12062 3.76305 2.26378 3.57913 2.43841 3.42813C2.61303 3.27713 2.81568 3.16202 3.0348 3.08935C3.25392 3.01668 3.48521 2.98789 3.71545 3.00462C3.9457 3.02135 4.17039 3.08327 4.3767 3.18685L10.0928 6.04789Z" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 12.0347H3.26331C3.48767 12.0363 3.70801 11.9751 3.89945 11.8581C4.0909 11.7411 4.24585 11.573 4.34681 11.3726L5.21361 9.62695" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 13.2398V10.832" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.00977 6.01562H4.01458" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Summary badges */}
      <div style={{ width:"100%", borderTop:"1px solid var(--gray-100)", borderBottom:"1px solid var(--gray-100)", padding:"12px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", margin:"12px 0", flexShrink:0 }}>
        {tab === "EVENTS" ? (
          <>
            {/* Purple only when there are actual registered VIP targets — not a fixed default. */}
            <div style={{
              width:"38px", height:"38px", borderRadius:"10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              backgroundColor: vipTargets > 0 ? "var(--primary-100)" : "var(--gray-100)", border: vipTargets > 0 ? "1px solid var(--primary-200)" : "1px solid var(--gray-200)",
            }}>
              <span style={{ fontSize:"10px", fontWeight:600, color: vipTargets > 0 ? "var(--primary-400)" : "var(--gray-400)", letterSpacing:"0.5px" }}>VIP</span>
              <span style={{ fontSize:"13px", fontWeight:700, color: vipTargets > 0 ? "var(--primary-400)" : "var(--gray-400)", lineHeight:1 }}>{vipTargets}</span>
            </div>
            {/* This is just today's detection count, not an alert — plain gray, no red. */}
            <div style={{ width:"38px", height:"38px", borderRadius:"10px", backgroundColor:"var(--gray-100)", border:"1px solid var(--gray-200)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", letterSpacing:"0.3px" }}>{t.today}</span>
              <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-700)", lineHeight:1 }}>{todayTotal}</span>
            </div>
          </>
        ) : (
          // Same neutral-by-default rule as AvailabilityDonut: gray unless availability is
          // genuinely low (<50%), not a fixed purple regardless of value — and no alarm at a site
          // with no cameras registered, where nothing is down because nothing is there.
          (() => {
            const low = cameras.length > 0 && availability < 50;
            return (
              <div style={{
                width:"38px", height:"38px", borderRadius:"10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                backgroundColor: low ? "var(--danger-100)" : "var(--gray-100)", border: low ? "1px solid var(--danger-200)" : "1px solid var(--gray-200)",
              }}>
                <span style={{ fontSize:"10px", fontWeight:600, color: low ? "var(--danger-400)" : "var(--gray-400)", letterSpacing:"0.3px" }}>{t.avail}</span>
                <span style={{ fontSize:"13px", fontWeight:700, color: low ? "var(--danger-400)" : "var(--gray-400)", lineHeight:1 }}>{cameras.length > 0 ? `${availability}%` : "—"}</span>
              </div>
            );
          })()
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex:1, overflowY:"auto", width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", paddingBottom:"8px" }}>
        {tab === "EVENTS"
          ? liveEvents.map(event => {
              const photoUrl = getFacePhoto(event.id);
              const isSelected = event.id === selectedEventId;
              return (
                <div key={event.id}
                  onMouseEnter={e => handleMouseEnter(e, event.id, event)}
                  onClick={() => onEventSelect?.(isSelected ? null : event)}
                  style={{ width:"40px", height:"40px", borderRadius:"10px", overflow:"hidden", flexShrink:0, cursor:"pointer", position:"relative",
                    // The purple border says VIP — a fact about the person. The selection ring is
                    // grey, because a selected Tracking tile used to be indistinguishable from a
                    // VIP one: the same purple said two different things on the same 40px tile.
                    border: event.type==="VIP" ? "2px solid var(--primary-400)" : "1.5px solid var(--gray-200)",
                    boxShadow: isSelected ? "0 0 0 2px var(--gray-900)" : "none" }}>
                  <img src={photoUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} alt="" />
                  {event.type === "VIP" && (
                    <div style={{ position:"absolute", top:"1px", right:"1px", width:"15px", height:"15px", borderRadius:"50%", backgroundColor:"var(--primary-400)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Crown size={9} color="white" />
                    </div>
                  )}
                </div>
              );
            })
          : devices.map(device => {
              const isLive = device.status === "Live";
              const isPinned = device.id === pinnedDeviceId;
              return (
                <div key={device.id}
                  onMouseEnter={e => handleMouseEnter(e, device.id, device)}
                  onClick={() => onPinDevice?.(isPinned ? null : device)}
                  style={{ width:"40px", height:"40px", borderRadius:"10px", backgroundColor: isLive ? "var(--gray-900)" : "var(--gray-50)", border: isLive ? "1px solid var(--gray-700)" : "1px solid var(--danger-200)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative", flexShrink:0,
                    boxShadow: isPinned ? "0 0 0 2px var(--primary-400)" : "none" }}>
                  <span style={{ fontSize:"10px", fontWeight:600, color: isLive ? "white" : "var(--danger-400)", fontFamily:"monospace", textAlign:"center" }}>{device.name}</span>
                  <div style={{ position:"absolute", bottom:"3px", right:"3px", width:"6px", height:"6px", borderRadius:"50%", backgroundColor: isLive ? "var(--success-400)" : "var(--danger-400)" }} />
                </div>
              );
            })
        }
      </div>

      {/* Hover flyout (fixed) */}
      {hovered && (() => {
        const isDevice = "status" in hovered.item;
        // Clamp to the viewport so hovering an item near the bottom of the scrollable list
        // doesn't push the flyout off-screen.
        const estimatedHeight = isDevice ? 76 : 132;
        const clampedTop = Math.min(Math.max(8, hovered.top), (typeof window !== "undefined" ? window.innerHeight : 1080) - estimatedHeight - 8);
        if (!isDevice) {
          const event = hovered.item as LiveEvent;
          const photoUrl = getFacePhoto(event.id);
          return (
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"210px", backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(14, 22, 42,0.12)", pointerEvents:"none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:"8px", marginBottom:"8px", borderBottom:"1px solid var(--gray-100)" }}>
                <span style={{ fontSize:"10px", fontWeight:800, color: event.type==="VIP" ? "var(--primary-400)" : "var(--type-tracking)", backgroundColor: event.type==="VIP" ? "var(--primary-100)" : "var(--type-tracking-100)", padding:"2px 6px", borderRadius:"4px" }}>
                  {event.type==="VIP" ? `VIP · ${event.confidence}%` : "TRACKING"}
                </span>
                <span style={{ fontSize:"10px", color:"var(--gray-400)" }}>{formatTimeAgo(event.timestamp)}</span>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <img src={photoUrl} style={{ width:"36px", height:"48px", borderRadius:"6px", objectFit:"cover", flexShrink:0 }} alt="" />
                <div>
                  <div style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-900)" }}>{event.name}</div>
                  <div style={{ fontSize:"10px", color:"var(--gray-500)", marginTop:"3px" }}>{event.location}</div>
                </div>
              </div>
            </div>
          );
        } else {
          const device = hovered.item as Device;
          const isLive = device.status === "Live";
          const zone = nearestZoneName(device.lat, device.lng, cameras, t.unknownZone);
          return (
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"180px", backgroundColor:"var(--gray-900)", border:"1px solid var(--gray-700)", borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(14, 22, 42,0.2)", pointerEvents:"none" }}>
              <div style={{ fontSize:"10px", color:"var(--gray-400)", marginBottom:"3px" }}>{zone}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", fontWeight:800, color:"white" }}>{device.name}</span>
                <span style={{ fontSize:"10px", fontWeight:600, color: isLive ? "var(--success-400)" : "var(--danger-400)", backgroundColor: isLive ? "rgba(22, 163, 74,0.1)" : "rgba(244,63,94,0.1)", padding:"2px 6px", borderRadius:"4px" }}>
                  {isLive ? "● LIVE" : "○ OFF"}
                </span>
              </div>
            </div>
          );
        }
      })()}
    </div>
  );
}

/* ── Main sidebar ── */
interface SidebarProps {
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  locationFilter?: string | null;
  onLocationClear?: () => void;
  onLocationSelect?: (location: string) => void;
  districtFilter?: string | null;
  onDistrictClear?: () => void;
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
  isCollapsed?: boolean;
  onToggleDetectionChart?: () => void;
  /** Which side of the map this sidebar sits on — flips which edge carries the border. */
  position?: "left" | "right";
}

export default function Sidebar({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, districtFilter, onDistrictClear, onPinDevice, pinnedDeviceId, isCollapsed, onToggleDetectionChart, position = "left" }: SidebarProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [activeTab, setActiveTab] = usePersistedSidebarTab();
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // A person filter names one person at one site. Left standing through a site switch it filtered
  // this site's list by a name that is not in it, so the list read as empty with a purple chip on
  // top explaining why in terms of somebody who was never here.
  const sidebarProjectId = useActiveProjectId();
  const firstSidebarSiteRef = useRef(true);
  useEffect(() => {
    if (firstSidebarSiteRef.current) { firstSidebarSiteRef.current = false; return; }
    setPersonFilter(null);
  }, [sidebarProjectId]);

  if (isCollapsed) return (
    <CollapsedSidebar
      position={position}
      onEventSelect={onEventSelect}
      selectedEventId={selectedEventId}
      onPinDevice={onPinDevice}
      pinnedDeviceId={pinnedDeviceId}
    />
  );

  return (
    <div style={{ width:"380px", flexShrink:0, height:"100%", backgroundColor:"white", ...(position === "right" ? { borderLeft: BORDER } : { borderRight: BORDER }), display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Tab toggle */}
      <div style={{ padding:"12px 20px 6px", flexShrink:0 }}>
        <div style={{ display:"flex", backgroundColor:"var(--gray-100)", borderRadius:"12px", padding:"4px", gap:"4px" }}>
          {(["EVENTS","SYSTEM"] as SidebarTab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex:1, padding:"8px 0", borderRadius:"10px", border:"none", cursor:"pointer",
                backgroundColor: active ? "var(--primary-400)" : "transparent",
                color: active ? "white" : "var(--gray-500)",
                fontSize:"13px", fontWeight:700, letterSpacing:"-0.26px",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                transition:"background-color 0.15s",
              }}>
                {tab === "EVENTS" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.083 5.25L8.16634 8.16667L5.83301 5.83333L4.08301 7.58333" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M9.87887 7.82031H12.0651C12.1677 7.82037 12.2685 7.84663 12.3581 7.89661C12.4477 7.94658 12.523 8.01862 12.5769 8.10587C12.6308 8.19313 12.6615 8.29271 12.6661 8.39517C12.6708 8.49764 12.6491 8.59958 12.6033 8.69133L11.3789 11.1406C11.3325 11.2334 11.2629 11.3127 11.1768 11.3706C11.0907 11.4286 10.9911 11.4633 10.8876 11.4714C10.7842 11.4796 10.6804 11.4608 10.5863 11.417C10.4923 11.3731 10.4111 11.3057 10.3508 11.2213L9.07227 9.43352" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.0928 6.04789C10.2354 6.11931 10.3439 6.24445 10.3944 6.39581C10.4448 6.54717 10.4331 6.71236 10.3618 6.8551L8.49219 10.5938C8.45683 10.6645 8.40788 10.7276 8.34814 10.7793C8.28841 10.8311 8.21905 10.8707 8.14403 10.8957C8.06901 10.9206 7.98981 10.9306 7.91094 10.925C7.83208 10.9193 7.75509 10.8982 7.68438 10.8628L1.96893 8.0024C1.55379 7.7933 1.23838 7.42826 1.09173 6.98717C0.945073 6.54608 0.979114 6.06486 1.1864 5.6488L2.01708 3.96938C2.12062 3.76305 2.26378 3.57913 2.43841 3.42813C2.61303 3.27713 2.81568 3.16202 3.0348 3.08935C3.25392 3.01668 3.48521 2.98789 3.71545 3.00462C3.9457 3.02135 4.17039 3.08327 4.3767 3.18685L10.0928 6.04789Z" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 12.0347H3.26331C3.48767 12.0363 3.70801 11.9751 3.89945 11.8581C4.0909 11.7411 4.24585 11.573 4.34681 11.3726L5.21361 9.62695" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 13.2398V10.832" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.00977 6.01562H4.01458" stroke={active ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {tab === "EVENTS" ? t.tabEvents : t.tabSystem}
              </button>
            );
          })}
        </div>
      </div>

      {/* EVENTS tab */}
      {activeTab === "EVENTS" && (
        <>
          <EventsSummary onPersonSelect={setPersonFilter} onToggleDetectionChart={onToggleDetectionChart} />
          <EventsList
            onEventSelect={onEventSelect}
            selectedEventId={selectedEventId}
            locationFilter={locationFilter}
            onLocationClear={onLocationClear}
            onLocationSelect={onLocationSelect}
            districtFilter={districtFilter}
            onDistrictClear={onDistrictClear}
            personFilter={personFilter}
            onPersonClear={() => setPersonFilter(null)}
          />
        </>
      )}

      {/* SYSTEM tab */}
      {activeTab === "SYSTEM" && (
        <SystemTab onPinDevice={onPinDevice} pinnedDeviceId={pinnedDeviceId} />
      )}
    </div>
  );
}
