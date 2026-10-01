"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, Crown } from "lucide-react";
import { Device, DeviceStatus, FilterType, SidebarTab, LiveEvent, TrackingHop, getFacePhoto, formatTimeAgo, districtIdAt } from "@/lib/mockData";
import {
  vcaEventsToLiveEvents, todaysDetectionHits, useDashboardPanels, holdsAppAction, useVcaStore,
  useActiveProjectId, useProjectEvents, useProjectPersons, useProjectCameras, currentPortalUser, scopedCameraIds, type Camera,
  handlingFor, SIGNED_IN_USER, type DetectionHandling,
} from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useOnValueChange } from "@/hooks/useOnValueChange";
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
    /**
     * The left half of the pair below: this one counts PEOPLE, "Today's detections" counts hits.
     *
     * KOREAN CARRIES THE UNIT AND ENGLISH DOES NOT, on purpose (owner's call, 2026-09-17).
     * The tiles print a bare number with no unit beside it, and these two count the SAME people
     * two ways — 19 people, 65 sightings of them. English is safe because "detections" is a
     * plural count noun: the label already says what is being counted. `감지` is not — `오늘 감지`
     * over `65` beside `오늘 감지된 VIP` over `19` reads as 65 more of something, so the Korean
     * says `건수`. A candidate that was rejected for exactly this: `오늘 감지된 얼굴`, which reads
     * as 65 distinct faces and would have made the pair say "19 VIPs plus 46 other people".
     *
     * The word itself changed from `검출` to `감지` on the same call, everywhere in the app (56
     * sites) rather than in these two tiles — the event rows right underneath say
     * `카메라 3대에서 감지`, and one screen with two words for one thing is worse than either
     * word. Portal keeps `자동 감지` (server ping) and `화재 감지` (a license feature): those are
     * the machine sensing its own world, not a camera catching a person.
     * Both say "today" out loud because both are windowed to it (todaysDetectionHits), and on a
     * live-monitoring screen an unstated window is read as "now" — the same reason districtTally
     * below states its own.
     *
     * It said "VIP detections" until 2026-09-17, over a count of un-collapsed VIP rows — a label
     * naming detections over a figure that was neither all the detections nor all the people.
     */
    vipsSeenToday: "VIPs seen today",
    todaysDetections: "Today's detections",
    selectLocation: "Select location",
    allLocations: "All locations",
    liveAnalytics: "Live analytics",
    all: "All",
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
    /* The site's own total is deliberately absent (owner's call, 2026-10-01). What the operator
       needs to know is that these figures are not the whole site; how big the site is is not
       theirs to be told. */
    scopedToYou: (n: number) => `Only the ${n} camera${n === 1 ? "" : "s"} assigned to this account`,
    scopedToNone: "No cameras are assigned to this account",
    searchDevices: "Search devices",
    columns: { name: "NAME", status: "STATUS", info: "INFO", pin: "PIN" },
    devicesLoadFailed: "Couldn’t load devices.",
    retry: "Retry",
    noDevices: "No devices found.",
    today: "TODAY",
    avail: "AVAIL",
    tabEvents: "EVENTS",
    tabSystem: "SYSTEM",
    events: "Events",
    system: "System",
    /**
     * WHAT THE SHIFT DID about a detection — not whether the match is right.
     *
     * The two are separate questions and this list answers only the second one (see
     * DetectionHandlingState in vcaStore). So nothing here says "confirm", "correct", "wrong" or
     * "false positive": an operator acknowledging a row is claiming they looked at it, not that
     * the face was matched properly. The words were chosen to be unable to mean the other thing.
     */
    handling: {
      acknowledge: "Acknowledge",
      /** Ellipsis because it opens the note field rather than closing anything yet. */
      closeOut: "Close…",
      /**
       * NAMES WHAT IS BEING CLOSED, because "Close" is already taken on this screen — it is the
       * label on the dismiss X (`close` above), and a button that commits a closure must not share
       * a word with one that just puts a panel away. Korean has no clash (닫기 vs 종결) and says the
       * same thing anyway.
       */
      closeConfirm: "Close detection",
      cancel: "Cancel",
      reopen: "Reopen",
      assign: "Assign",
      /** Placeholder, not a label above the box — the button beside it already says what it is for. */
      notePlaceholder: "What was done",
      unhandled: "Unhandled",
      noUnhandled: "Nothing left unhandled.",
      acknowledgedBy: (actor: string, when: string) => `Acknowledged by ${actor} · ${when}`,
      assignedTo: (assignee: string, actor: string, when: string) => `Assigned to ${assignee} by ${actor} · ${when}`,
      closedBy: (actor: string, when: string) => `Closed by ${actor} · ${when}`,
    },
  },
  ko: {
    live: "정상",
    out: "중단",
    registeredVips: "등록된 VIP 대상",
    noVips: "등록된 VIP 대상이 없습니다.",
    registeredOn: (date: string) => `${date} 등록`,
    close: "닫기",
    vipsSeenToday: "오늘 감지된 VIP",
    todaysDetections: "오늘 감지 건수",
    selectLocation: "장소 선택",
    allLocations: "전체 장소",
    liveAnalytics: "실시간 분석",
    all: "전체",
    seenAtCameras: (n: number) => `서로 다른 카메라 ${n}대에서 감지`,
    stopsOnTrail: (n: number) => `이 이동 경로에서 ${n}곳 경유`,
    stops: (n: number) => `${n}곳 경유`,
    stopsAcross: (stops: number, cams: number) => `카메라 ${cams}대에서 ${stops}곳 경유`,
    sameCameraEarlier: "이 경로에서 앞서 지나간 카메라입니다",
    return: "재방문",
    tracking: "동선 추적",
    filterAll: "전체",
    filterVip: "VIP 감지",
    filterTracking: "동선 추적",
    noEvents: "현재 감지된 이벤트가 없습니다.",
    rangeOf: (from: number, to: number, total: number) => `${total}건 중 ${from} – ${to}`,
    goToPage: "페이지 이동",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    infrastructure: "인프라 및 진단",
    linkedCams: "연결된 카메라",
    outCams: "중단된 카메라",
    availability: "가동률",
    scopedToYou: (n: number) => `이 계정에 지정된 ${n}대만 보입니다`,
    scopedToNone: "이 계정에 지정된 카메라가 없습니다",
    searchDevices: "장비 검색",
    columns: { name: "이름", status: "상태", info: "정보", pin: "고정" },
    devicesLoadFailed: "장비 목록을 불러오지 못했습니다.",
    retry: "다시 시도",
    noDevices: "장비가 없습니다.",
    today: "오늘",
    avail: "가동률",
    tabEvents: "이벤트",
    tabSystem: "시스템",
    events: "이벤트",
    system: "시스템",
    handling: {
      acknowledge: "확인",
      closeOut: "종결…",
      closeConfirm: "감지 종결",
      cancel: "취소",
      reopen: "다시 열기",
      assign: "담당 지정",
      notePlaceholder: "어떻게 처리했는지",
      unhandled: "미처리",
      noUnhandled: "처리 안 된 건이 없습니다.",
      acknowledgedBy: (actor: string, when: string) => `${actor} 확인 · ${when}`,
      assignedTo: (assignee: string, actor: string, when: string) => `${assignee} 담당 (${actor} 지정) · ${when}`,
      closedBy: (actor: string, when: string) => `${actor} 종결 · ${when}`,
    },
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
/**
 * The comparison against the same time yesterday, when there is one.
 *
 * Detection-count trend direction isn't clearly "good" or "bad" here, so this stays neutral gray
 * rather than red/green — the ▲/▼ arrow alone (driven by `down`) conveys the up/down, no color
 * needed.
 *
 * Rendered only once the figure has arrived. It used to fall back to `{delta:0,deltaPct:0}` for
 * the window before the request resolves, and a zero is not a missing figure: measured on every
 * mount and every site switch, both tiles read "▲ 0 (0%)" for 250ms — the screen stating that
 * nothing has changed since yesterday, which is a comparison it had not made. Same rule as
 * AvailabilityDonut three hundred lines down, which spells out why absent is not zero, and the
 * same shape as the `?? 0` this codebase bans for coordinates.
 *
 * NO PERCENTAGE, since 2026-09-17. It read "4 (1.5%)": both figures come from the seed in
 * mockData, while the count above them is derived from the store — so the three numbers on one
 * tile failed arithmetic the reader does in their head. 4 under 48 is 8.3%, not 1.5%.
 *
 * The percentage is the part that could not be saved. Deriving it from the shown count (4/48 →
 * 8.3%) would have been honest arithmetic over a placeholder delta, which is worse here than no
 * arithmetic: the reader checks the division, it checks out, and the conclusion they draw is that
 * the comparison was measured — so the one invented number becomes the one they stop questioning.
 * The bare delta claims less, and less is what the mock can support. The percentage comes back
 * when the backend's daily series arrives, computed from the figures it is shown beside.
 */
interface StatTrend { delta: number; down: boolean }
function DeltaBadge({ delta, down }: StatTrend) {
  return (
    <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
      <svg width="8" height="7" viewBox="0 0 8 7" style={{ flexShrink:0, transform: down ? "none" : "rotate(180deg)" }}>
        <path d="M4 7L0 0H8L4 7Z" fill="var(--gray-600)"/>
      </svg>
      <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", lineHeight:"16px" }}>{delta}</span>
    </div>
  );
}

// Per Figma (node 154:23572): 6px between the label row and the count block, then 4px
// *inside* that block between the count and the delta — not one flat gap across all three,
// which over-tallens the row and throws off the divider line's height next to it.
// `count` is optional for the same reason `trend` is: the Infrastructure tiles read a figure that
// arrives from a request, and a zero drawn while it is in flight says every camera on the site is
// unlinked. Measured on mount: "Linked cams 0 / Out cams 0" for 250ms at a site with 52 linked.
// A dash, like the availability gauge beside them.
function StatCol({ icon, label, labelColor = "var(--gray-600)", labelFontSize = 12, count, trend }: { icon?: React.ReactNode; label:string; labelColor?:string; labelFontSize?:number; count?:number; trend?: StatTrend }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
        {icon}
        <span style={{ fontSize:`${labelFontSize}px`, fontWeight:600, color:labelColor }}>{label}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
        <span style={{ fontSize:"24px", fontWeight:800, color: count === undefined ? "var(--gray-400)" : "var(--gray-900)", letterSpacing:"-0.4px", lineHeight:"30px" }}>{count === undefined ? "—" : count}</span>
        {trend && <DeltaBadge delta={trend.delta} down={trend.down} />}
      </div>
    </div>
  );
}

function VipStatIcon() {
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
 * The faces of up to three people actually on this site's VIP registry.
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
function AvailabilityDonut({ pct, size = 92, hasCameras }: { pct?: number; size?: number; hasCameras: boolean }) {
  const height = size * (40 / 92);
  // `pct` is optional because the figure arrives from a request. Absent is not zero: an arc drawn
  // at 0 and a label reading "0%" are a measurement saying every camera is down, and the gauge
  // would say it in the window before the answer comes back. No figure, no arc, and a dash.
  const known = pct !== undefined && hasCameras;
  // Neutral gray by default; only shift to a semantic signal color when availability is
  // genuinely low (matches the red/green convention already used elsewhere in this file for
  // LIVE/OUT status). A site with no cameras registered is not a site at 0% — nothing is down
  // there, there is nothing there — so it reads as a dash in gray rather than an alarm.
  const ringColor = known && pct < 50 ? "var(--danger-400)" : "var(--gray-400)";
  const cx = 46, cy = 40, r = 34, strokeWidth = 10;
  const sweep = known ? 180 * (Math.max(0, Math.min(100, pct)) / 100) : 0;
  const trackPath = describeArc(cx, cy, r, 270, 450);
  const fillPath = describeArc(cx, cy, r, 270, 270 + sweep);
  return (
    <div style={{ position:"relative", width:size, height, flexShrink:0 }}>
      <svg width={size} height={height} viewBox="0 0 92 40" fill="none">
        <path d={trackPath} stroke={ringColor} strokeOpacity={0.15} strokeWidth={strokeWidth} strokeLinecap="round" fill="none"/>
        {fillPath && <path d={fillPath} stroke={ringColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none"/>}
        <text x="46" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill={ringColor} fontFamily="SUIT, sans-serif">{known ? `${pct}%` : "—"}</text>
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
      border: isLive ? "1px solid var(--success-200)" : "1px solid var(--danger-100)",
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
  const persons = useProjectPersons();
  // delta/down (the yesterday-comparison fields) come from the future-backend stub rather
  // than importing the mock object directly — see lib/api/dashboard.ts. Falls back to a flat
  // (no change) delta for the brief window before the fetch resolves.
  // Scoped like everything else here. Only the delta fields are read from it, but an unscoped
  // request is an unscoped request — the one call in this file that was still asking about every
  // site at once.
  const countsProjectId = useActiveProjectId();
  const { data: dashboardStats } = useApiData(() => getDashboardStats(countsProjectId), [countsProjectId]);
  // "Today's detections" opens the Dashboard's detection-activity chart (see EventsSummary's
  // onToggleDetectionChart below), so it needs to count the same way that chart does — every
  // individual hit today, unrolling a Tracking row's whole multi-camera history — not the row
  // count (one per row, so a person tracked across 10 cameras only counted as 1).
  // Otherwise this number and the chart it opens visibly don't add up to each other.
  const todaysHits = todaysDetectionHits(storeEvents);
  return {
    vipTargets: persons.filter(p => p.type === "VIP").length,
    /**
     * PEOPLE, beside a count of DETECTIONS. Renamed and re-derived 2026-09-17.
     *
     * It was `detections.filter(e => e.type === "VIP").length` under a label reading "VIP
     * detections", and that counts the rows which were NOT collapsed into a Tracking row — so
     * every VIP who walked between two cameras was missing from a tile naming VIP detections.
     * Measured at 10:21 that morning: the tile read 48 while 58 VIP detections had been recorded
     * today, and as the live ticker promoted people to Tracking it fell to 41 against 62 — the
     * gap widens the longer the screen is left open. It was the last `type === "VIP"` count on
     * this screen; the same filter had already come out of the map's district pill and out of
     * this file's district chip, both times because a trail IS a VIP who moved.
     *
     * Counting every VIP hit here instead would have made this tile a second copy of "Today's
     * detections" beside it. So the pair carries two facts: how many VIPs were seen (here) and
     * how many detections happened (there). It is the same number districtTally already puts on
     * the district chip for one district, so one figure means one thing on both surfaces.
     *
     * `h.person` is the person's NAME — todaysDetectionHits fills it from `personName`, and NOT
     * from `personId`, which holds the SIGHTING's id (unique per detection). A Set over
     * `personId` would return detections wearing the word "people", which is what the first
     * district pill shipped. See DetectionHit.person for that, and for the server contract that
     * has to replace a name with a stable per-person id.
     *
     * `?? h.id` is deliberate and stays: an unidentified hit counts as ONE person, instead of
     * every unidentified hit in the site merging into a single nameless person.
     *
     * It also states its window now. The old count took whatever was in the store, and only the
     * seeds all being same-day made that read as "today" — it would have mixed days across
     * midnight. todaysDetectionHits filters on the site's own clock.
     */
    vipsToday: { count: new Set(todaysHits.map(h => h.person ?? h.id)).size, trend: dashboardStats?.vipsToday },
    eventsToday: { count: todaysHits.length, trend: dashboardStats?.eventsToday },
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
      style={{ position:"fixed", inset:0, backgroundColor:"var(--scrim)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"360px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"80vh", overflow:"hidden", boxShadow:"var(--shadow-modal)" }}>
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
  const { vipTargets, vipsToday, eventsToday } = useEventCounts();
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
        <div style={{ flex:1, minWidth:0 }}>
          <StatCol icon={<VipStatIcon />} label={t.vipsSeenToday} labelColor="var(--gray-700)" labelFontSize={13} count={vipsToday.count} trend={vipsToday.trend} />
        </div>
        <div style={{ width:"1px", backgroundColor:"var(--gray-200)", alignSelf:"stretch", flexShrink:0 }} />
        {/* The chart opens from THIS tile, the one whose figure it plots.
            It hung off the VIP tile before, and the two are not the same question: that tile
            counts people, the chart plots every hit today (both go through todaysDetectionHits —
            see useEventCounts). Measured at 10:21 on 2026-09-17: pressing a tile that read 41
            opened a panel titled "VIP detections today" drawing 62 dots. A number that changes
            when you click it reads as one of the two being wrong, and the reader cannot tell
            which. */}
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
          <StatCol icon={<EventsTodayStatIcon />} label={t.todaysDetections} labelColor="var(--gray-600)" labelFontSize={13} count={eventsToday.count} trend={eventsToday.trend} />
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
      style={{ position:"fixed", inset:0, backgroundColor:"var(--scrim)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"320px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"70vh", overflow:"hidden", boxShadow:"var(--shadow-modal)" }}>
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

/**
 * `districtHopFilter` — the district this list is filtered to, or null.
 *
 * A trail is in this list if ANY of its hops is in that district, so the newest hop can easily be
 * somewhere else: "Michael Tan · Jurong East" appeared under a Novena filter, because his trail
 * passed through Novena and ended in Jurong East. The map draws a pin at the Novena hop, so the
 * row and the map were describing different sightings of the same person — the mismatch this
 * list's district filter was just fixed to avoid, coming back as a line of text.
 *
 * So while a district is picked, the collapsed line names the newest hop THAT IS IN IT. The
 * expanded timeline below is unchanged and still shows the whole trail, which is where "he
 * carried on to Jurong East" belongs.
 */
function TrackingEventRow({ event, isSelected, onClick, districtHopFilter = null, handling, onAcknowledge }: { event: LiveEvent; isSelected: boolean; onClick: () => void; districtHopFilter?: string | null; handling?: DetectionHandling; onAcknowledge: () => void }) {
  const photoUrl = getFacePhoto(event.id);
  // event.path is stored oldest-first, but the most-recently-seen camera is what an operator
  // cares about first — reverse once here so both the collapsed route line and the expanded
  // timeline read newest-first (leftmost / topmost = just now), and everything downstream can
  // just take hops[0] as "the latest hop".
  const hops = [...(event.path ?? [])].reverse();
  // Newest-first already, so the first hop inside the picked district IS the newest one there.
  // Falls back to the trail's own newest when nothing matches — that can happen for a row that
  // got here by its event coordinate rather than by a hop (a Tracking row whose path is empty),
  // and a row with no location line at all would be worse than one naming the wrong district.
  const lastHop = (districtHopFilter
    // No substitution — see personHitHistory. A hop with no coordinate is in no district.
    ? hops.find(h => districtIdAt(h.lat, h.lng) === districtHopFilter)
    : undefined) ?? hops[0];
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
  // Keyboard focus reveals the acknowledge tick the same way the pointer does — without this the
  // one-click path is pointer-only. The relatedTarget test keeps it open while focus moves INTO
  // the tick itself: a plain onBlur unmounts the button the moment it is tabbed to.
  const [isFocused, setIsFocused] = useState(false);
  const [lang] = useLanguage();
  const t = T[lang];
  return (
    <div>
      <div
        onClick={onClick}
        onFocus={() => setIsFocused(true)}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsFocused(false); }}
        // Same treatment as VipEventRow, for the reason written there: selecting a row moves the
        // map to it, and this was a div with an onClick that no keyboard could reach. A trail row
        // needed it more than a VIP row does — it is the row that opens a person's whole
        // multi-camera history, and it was the one row type left out, so a sweep for rows by
        // [aria-pressed] returned only the VIP ones. That is the hole assistive tech falls into.
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        // Two states, because one click does two things. They move together here, but they are
        // different facts and a VIP row can only make the first one:
        //   aria-pressed  — "this is the selected event", i.e. the map has moved to it. Same
        //                   meaning and same attribute as VipEventRow, so both kinds of row in
        //                   this list announce their selection the same way. Clicking a selected
        //                   row clears the selection (see the onClick EventsList passes in), so
        //                   it is a toggle rather than a radio and "pressed" is the right word.
        //   aria-expanded — "the hop-by-hop timeline below is showing". Only a trail row
        //                   discloses anything, and without this, pressing one inserts a list of
        //                   stops after it in reading order with nothing announced.
        // No aria-controls: the timeline is only mounted while expanded, and an IDREF that points
        // at nothing for the whole collapsed life of the row is worse than no IDREF.
        aria-pressed={isSelected}
        aria-expanded={isSelected}
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
          {/* The handling slot sits on the chevron's line rather than under it: a third stacked
              item would push the right column taller than the row's own 54px photo. */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", minHeight:"22px" }}>
            {handling
              ? <HandlingMark handling={handling} />
              : (isHovered || isFocused) && <AckButton onAck={onAcknowledge} />}
            <ChevronDownIcon rotated={isSelected} />
          </div>
        </div>
      </div>
      {isSelected && (
        /* 10px of top padding, not 0: the selected row above this carries a grey fill, and at 0
           the first stop's camera chip sat flush against its bottom edge — the trail read as part
           of that block rather than as the list it opens. 10 matches the row's own vertical
           padding, so the gap above the first stop equals the gap inside the row. */
        <div style={{ display:"flex", flexDirection:"column", padding:"10px 16px 12px 60px" }}>
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

function VipEventRow({ event, isSelected, photoUrl, onClick, locationFilter, handling, onAcknowledge }: { event: LiveEvent; isSelected: boolean; photoUrl: string; onClick: () => void; locationFilter?: string | null; handling?: DetectionHandling; onAcknowledge: () => void }) {
  // Already scoped to one location (the "Live Analytics · Tampines" header above says so) —
  // repeating that same location on every row just to append the camera label pushed long labels
  // (e.g. "CAM-SIM-513...") into ellipsis. Only the camera name is new information here.
  const secondLine = locationFilter ? (event.cameraLabel ?? event.location) : `${event.location}${event.cameraLabel ? ` · ${event.cameraLabel}` : ""}`;
  const [isHovered, setIsHovered] = useState(false);
  // See the note on the same pair in TrackingEventRow.
  const [isFocused, setIsFocused] = useState(false);
  const [lang] = useLanguage();
  return (
    <div
      onClick={onClick}
      onFocus={() => setIsFocused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsFocused(false); }}
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
      {/* The type badge says what this is; the slot under it says what was done about it. Empty
          while nobody has touched it — a mark on every row would have no glance value left. */}
      <div style={{ marginLeft:"8px", flexShrink:0, alignSelf:"flex-start", marginTop:"10px", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px", minHeight:"38px" }}>
        <VipBadge />
        {handling
          ? <HandlingMark handling={handling} />
          : (isHovered || isFocused) && <AckButton onAck={onAcknowledge} />}
      </div>
    </div>
  );
}

/* ── Detection handling ─────────────────────────────────────────────────────
 *
 * "이건 누가 봤나" — the question a handover opens with, which this list could not answer.
 *
 * A DIFFERENT AXIS FROM THE JUDGEMENT, and the screen must not blur them (see
 * DetectionHandlingState in vcaStore). A judgement says whether the match is right; this says
 * whether anybody dealt with it. A correct match still needs somebody to walk over, and a false
 * positive still needs closing so the next shift does not re-open it. So no control here says
 * confirm / correct / wrong, and this never appears on the same control as a verdict.
 *
 * WHERE THE CONTROLS LIVE, and why not in the row.
 *
 * The row is 380px wide and 74px tall, twelve to a page, watched for a whole shift. Four controls
 * on every row would double its height and bury the two things it is read for — the name and the
 * camera. Measured against what the row already carries: the top-right corner is spent on the
 * type badge (VIP / Tracking), the second line on place and time, and both already ellipsize.
 *
 * So the row carries ONE thing and it is the answer, not a control: a mark saying what state this
 * detection got to, in the right column under the type badge. Nothing is drawn while a detection
 * is untouched — an untouched detection is not an error, and a list where every row carries a
 * badge has no glance value left. A marked row is one somebody touched.
 *
 * The one gesture that has to be fast sits in the same slot, revealed on hover or keyboard focus:
 * a 22px tick that acknowledges in one click, without opening anything. Acknowledging on a busy
 * night cannot cost three clicks or the log stays empty. Its slot is the mark's slot, so the row
 * never reflows between "hover" and "acknowledged".
 *
 * Everything that needs words — assign, close with a note, reopen, and who last moved it — is in
 * the panel the row already opens. Clicking a row still selects it on the map, which is what it
 * always did; the strip is the last thing in what it opens, under the trail for a Tracking row,
 * directly under the row for a VIP one.
 *
 * NO BULK ACKNOWLEDGE, deliberately. Every state change has to carry the account that made it —
 * that actor field is the evidence that a person was in the loop — and a sweep over a page is a
 * gesture nobody can honestly claim they looked at. One row, one person, one look.
 */

function TickIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <path d="M2.6 7.4L5.4 10.2L11.4 3.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AssigneeIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <path d="M11.5 12.25V11.083C11.5 10.465 11.254 9.871 10.817 9.433C10.379 8.996 9.786 8.75 9.167 8.75H4.833C4.214 8.75 3.621 8.996 3.183 9.433C2.746 9.871 2.5 10.465 2.5 11.083V12.25" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 6.417C8.289 6.417 9.333 5.372 9.333 4.083C9.333 2.795 8.289 1.75 7 1.75C5.711 1.75 4.667 2.795 4.667 4.083C4.667 5.372 5.711 6.417 7 6.417Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * The sentence saying who last moved this and when — the whole point of the record.
 *
 * Typed structurally rather than as T["en"]["handling"]: `as const` makes every string in the
 * dictionary its own literal type, so the English shape and the Korean one are not assignable to
 * each other and naming either of them here would have rejected the other language.
 */
interface HandlingWords {
  acknowledgedBy: (actor: string, when: string) => string;
  assignedTo: (assignee: string, actor: string, when: string) => string;
  closedBy: (actor: string, when: string) => string;
}
function handlingLine(h: DetectionHandling, t: HandlingWords, when: string): string {
  if (h.state === "closed") return t.closedBy(h.actor, when);
  if (h.state === "assigned") return t.assignedTo(h.assignee ?? h.actor, h.actor, when);
  return t.acknowledgedBy(h.actor, when);
}

/**
 * The mark in the row's right column. Three states, told apart by shape first and colour second,
 * because this is read at a glance across a room rather than inspected.
 *
 * Only "closed" carries a colour, and it is the one state where a colour claims something true
 * and useful — the work is finished. Acknowledged and assigned stay grey: somebody looked, which
 * is not an outcome. The assignee's name is printed because "누가" is the question; the full
 * sentence, with who marked it and when, is in the title and in the strip the row opens.
 */
function HandlingMark({ handling }: { handling: DetectionHandling }) {
  const [lang] = useLanguage();
  const t = T[lang].handling;
  const line = handlingLine(handling, t, formatTimeAgo(handling.at, lang));
  if (handling.state === "closed") return (
    <span title={line} style={{ width:"15px", height:"15px", borderRadius:"50%", backgroundColor:"var(--success-400)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <TickIcon color="white" size={9} />
    </span>
  );
  if (handling.state === "assigned") return (
    <span title={line} style={{ display:"flex", alignItems:"center", gap:"3px", maxWidth:"78px" }}>
      <AssigneeIcon color="var(--gray-500)" />
      <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-600)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {handling.assignee ?? handling.actor}
      </span>
    </span>
  );
  return (
    // gray-600, the weight of the row's own secondary text — not gray-400. Measured on screen at
    // 14px it was the faintest thing on the row, and this is the mark the list is scanned for.
    <span title={line} style={{ display:"flex", flexShrink:0 }}>
      <TickIcon color="var(--gray-600)" size={15} />
    </span>
  );
}

/**
 * Acknowledge, in one click, from the row.
 *
 * A tick with no word beside it: the slot is 22px and a labelled button here would take the width
 * the camera name is already short of. The labelled button exists — in the strip the row opens —
 * so this is the shortcut for somebody who already knows the screen, not the only door to it.
 *
 * stopPropagation on both click and keydown: the row around it is a role="button" that selects
 * the event on the map, and acknowledging must not also move the map.
 */
function AckButton({ onAck }: { onAck: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang].handling;
  const [hot, setHot] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onAck(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      title={t.acknowledge}
      aria-label={t.acknowledge}
      style={{
        width:"22px", height:"22px", borderRadius:"7px", padding:0, cursor:"pointer",
        border:"1px solid var(--line-control)",
        backgroundColor: hot ? "var(--gray-200)" : "white",
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        transition:"background-color 0.15s",
      }}
    >
      <TickIcon color="var(--gray-600)" size={12} />
    </button>
  );
}

const STRIP_BTN: React.CSSProperties = {
  padding:"5px 10px", borderRadius:"8px", cursor:"pointer",
  border:"1px solid var(--line-control)", backgroundColor:"white",
  fontSize:"12px", fontWeight:600, color:"var(--gray-700)", letterSpacing:"-0.24px",
  whiteSpace:"nowrap",
};

/**
 * The handling panel, the last thing in what a row opens.
 *
 * Reading order down the opened row: who and where (the row) → where they went (a trail's
 * timeline) → what we did about it (this). The strip closes the panel the way a form's footer
 * closes a form, and it sits outside the row's own click target, so nothing in here can
 * accidentally move the map.
 *
 * CLOSING TAKES A NOTE AND ACKNOWLEDGING DOES NOT, because the two claim different things:
 * acknowledging claims somebody looked, closing claims it was handled. The Close button stays
 * disabled on an empty box rather than silently writing a closure with nothing in it.
 */
function HandlingStrip({ event, handling }: { event: LiveEvent; handling?: DetectionHandling }) {
  const [lang] = useLanguage();
  const t = T[lang].handling;
  const setDetectionHandling = useVcaStore(st => st.setDetectionHandling);
  const clearDetectionHandling = useVcaStore(st => st.clearDetectionHandling);
  const portalUsers = useVcaStore(st => st.portalUsers);
  const activeProjectId = useActiveProjectId();
  /**
   * ONE IDIOM FOR THE WHOLE STRIP: a control that needs more than a click replaces the button
   * row in place rather than opening something over the list. Assigning and closing both work
   * that way, so there is one thing to learn, and neither has to be positioned against a panel
   * that scrolls.
   *
   * No native <select> for the assignee, per the house rule beside DataPage's SimpleSelect: the
   * console draws its own lists so they look the same on every OS. Names as pills needs no popup
   * at all, which is also why this is cheaper than a select.
   */
  const [mode, setMode] = useState<null | "assign" | "note">(null);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (mode === "note") noteRef.current?.focus(); }, [mode]);

  /**
   * Who this can be handed to: the accounts with a way into the app at THIS site. An account
   * with no app actions cannot open the screen the detection is on, so naming it as the person
   * on their way over would be a promise the install cannot keep. The signed-in account sits
   * first, because taking it yourself is the common move.
   */
  const candidates = portalUsers
    .filter(u => u.projectIds.includes(activeProjectId) && (u.appActions?.length ?? 0) > 0)
    .map(u => u.name)
    .sort((a, b) =>
      a === SIGNED_IN_USER.name ? -1 : b === SIGNED_IN_USER.name ? 1 : a.localeCompare(b));

  const write = (state: DetectionHandling["state"], extra?: { assignee?: string; note?: string }) =>
    // No actor and no timestamp passed: the store takes both from the session. An operator
    // typing their own name onto a closure is not a record anybody can rely on.
    setDetectionHandling({ eventId: event.id, subject: event.name, state, ...extra });

  const closed = handling?.state === "closed";

  return (
    <div style={{ padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:"8px" }}>
      {handling && (
        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
          <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.2px" }}>
            {handlingLine(handling, t, formatTimeAgo(handling.at, lang))}
          </span>
          {handling.note && (
            <span style={{ fontSize:"12px", fontWeight:400, color:"var(--gray-700)", letterSpacing:"-0.2px", wordBreak:"break-word" }}>
              {handling.note}
            </span>
          )}
        </div>
      )}

      {mode === "note" ? (
        <>
          <textarea
            ref={noteRef}
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            style={{
              width:"100%", resize:"none", padding:"7px 9px", borderRadius:"8px",
              border:"1px solid var(--line-control)", outline:"none",
              fontSize:"12px", fontWeight:500, color:"var(--gray-900)", fontFamily:"inherit",
              letterSpacing:"-0.2px", lineHeight:1.45, boxSizing:"border-box",
            }}
          />
          <div style={{ display:"flex", gap:"6px" }}>
            <button
              disabled={note.trim().length === 0}
              onClick={() => { write("closed", { note: note.trim(), assignee: handling?.assignee }); setNote(""); setMode(null); }}
              style={{
                ...STRIP_BTN,
                border:"none", backgroundColor: note.trim() ? "var(--gray-900)" : "var(--gray-200)",
                color: note.trim() ? "white" : "var(--gray-400)",
                cursor: note.trim() ? "pointer" : "not-allowed",
              }}
            >{t.closeConfirm}</button>
            <button onClick={() => { setNote(""); setMode(null); }} style={STRIP_BTN}>{t.cancel}</button>
          </div>
        </>
      ) : mode === "assign" ? (
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {candidates.map(name => (
            <button
              key={name}
              onClick={() => { write("assigned", { assignee: name }); setMode(null); }}
              style={{
                ...STRIP_BTN, borderRadius:"999px",
                backgroundColor: name === handling?.assignee ? "var(--gray-100)" : "white",
              }}
            >{name}</button>
          ))}
          <button onClick={() => setMode(null)} style={{ ...STRIP_BTN, borderRadius:"999px", color:"var(--gray-500)" }}>{t.cancel}</button>
        </div>
      ) : closed ? (
        <div style={{ display:"flex", gap:"6px" }}>
          {/* Reopening drops the row back to untouched — it does not stack a stage on top of the
              closure, because the store keeps one row per event (see DetectionHandling). So the
              closure it replaces stops being readable here, and the server that owns these has to
              keep the history this mock cannot. Written down rather than worked around. */}
          <button onClick={() => clearDetectionHandling(event.id)} style={STRIP_BTN}>{t.reopen}</button>
        </div>
      ) : (
        <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
          {!handling && (
            <button onClick={() => write("acknowledged")} style={STRIP_BTN}>{t.acknowledge}</button>
          )}
          {/* Not drawn when there is nobody to hand it to: an account with no way into the app
              cannot be on its way over, so a picker of nobody would be a promise the install
              cannot keep. */}
          {candidates.length > 0 && (
            <button onClick={() => setMode("assign")} style={STRIP_BTN}>{t.assign}</button>
          )}
          <button onClick={() => setMode("note")} style={STRIP_BTN}>{t.closeOut}</button>
        </div>
      )}
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
  personFilter?: string | null;
  onPersonClear?: () => void;
}

function EventsList({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, districtFilter, personFilter, onPersonClear }: EventsListProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [filter, setFilter] = useState<FilterType>("All");
  const [page, setPage] = useState(1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  /**
   * A SECOND AXIS, NOT A FOURTH TYPE PILL.
   *
   * The pills beside it narrow by WHAT a detection is; this narrows by whether anybody has dealt
   * with it. Folding it in as a fourth pill would have made "VIP" and "Unhandled" look mutually
   * exclusive when they are not, so it sits apart, right-aligned, and fills dark grey rather than
   * purple when it is on — the purple belongs to the axis it is not part of.
   *
   * OFF BY DEFAULT, and that is the point: a closed detection stays in the list where the shift
   * that closed it can show its work. This hides nothing permanently, which is why it carries the
   * count — with twelve rows to a page the backlog is otherwise unknowable.
   */
  const [unhandledOnly, setUnhandledOnly] = useState(false);
  const detectionHandlings = useVcaStore(st => st.detectionHandlings);
  const setDetectionHandling = useVcaStore(st => st.setDetectionHandling);
  /*
   * TRACKING IS THE MAP'S CAPABILITY, WEARING THE DASHBOARD'S CLOTHES (2026-09-23, owner:
   * 대시보드에서 이벤트에 VIP 감지뿐 아니라 지금 트레킹도 있긴 하거든 · 못 보게 할 거면 같이
   * 꺼야 할 것 같아, 레드맵 기능과 같거든).
   *
   * A Tracking row is one person joined across two or more cameras — the same answer 레드맵 draws
   * on a map, and `trail` is the grant for it. So an account without `trail` was seeing, in the
   * dashboard's own panel, the thing the map permission exists to withhold: where somebody went.
   * The rows go, and the filter chip with them — a chip that can only ever return an empty list is
   * a control that lies about what the panel holds.
   */
  const portalUsers = useVcaStore(st => st.portalUsers);
  /* THE DASHBOARD'S OWN GRANT, NOT REDMAP'S (2026-09-28). These rows used to ride on `trail`, so
     taking them off the landing screen meant taking the map away too and the permission list said
     nothing about the dashboard. `dashboardTrail` is a child of `liveView` — the panel has to be
     open for its rows to be in it — and the store keeps that true (APP_ACTION_PARENT). */
  const maySeeTrails = holdsAppAction(portalUsers, "dashboardTrail");
  const FILTERS: FilterType[] = maySeeTrails
    ? ["All", "VIP Detection", "Tracking"]
    : ["All", "VIP Detection"];
  const districtEvents = useProjectEvents();
  const allLiveEvents = vcaEventsToLiveEvents(districtEvents);
  const liveEvents = maySeeTrails ? allLiveEvents : allLiveEvents.filter(e => e.type !== "Tracking");
  // Routed through the future-backend stub instead of importing the mock array directly — see
  // lib/api/dashboard.ts. Falls back to the raw district id (still a valid, if less pretty,
  // label) for the brief pre-fetch window.
  const { data: districts } = useApiData(() => getDistricts(), []);

  const byType = filter === "All" ? liveEvents
    : liveEvents.filter(e => {
        if (filter === "VIP Detection") return e.type === "VIP";
        return e.type === filter;
      });
  // A district groups several sites by geographic proximity (map-pill click), so it filters by
  // nearest-district-to-lat/lng rather than locationFilter's plain name-substring match — the
  // two are mutually exclusive (ClientLayout clears one whenever the other is set).
  // `e.type === "VIP"` used to be part of this and dropped every trail: a VIP matched across two
  // cameras collapses into one "Tracking" row (see addEvent), so the filter kept only the people
  // who never moved — and a district pill is largely there to surface the ones who did. A trail
  // counts if ANY of its hops is in this district, not just its newest: the map draws a pin at
  // every hop inside the district, and a list that only tested the last one disagreed with it for
  // anyone who left.
  const byLocation = districtFilter
    ? byType.filter(e =>
        districtIdAt(e.lat, e.lng) === districtFilter
        || !!e.path?.some(hop => districtIdAt(hop.lat, hop.lng) === districtFilter))
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

  /*
   * THE PLACE CONTROL NAMES THE FILTER ON THE LIST BELOW — ALL OF IT, NOT HALF.
   *
   * It read `locationFilter || t.all` and nothing else, so a district picked from the map left it
   * reading "All" over a list that was anything but. Measured 2026-09-29 by clicking the Geylang
   * pill on the running dashboard: the pagination went from "1 – 12 of 80" to "1 – 12 of 15" and
   * this control said "All" on both sides of the click. The note further down says this was left
   * as it is on purpose; what it was defending is that the two filters are mutually exclusive and
   * this line reads only one of them, which explains the behaviour without excusing it. A control
   * that reads "All" beside a filtered list is not a small inaccuracy — it is the one thing on
   * the panel that could tell you why the list is short, saying there is no reason.
   *
   * The district id is the fallback because a name is what the reader can act on and the id is
   * not — but an id is still true, and it only shows in the brief window before getDistricts()
   * resolves.
   */
  const districtLabel = districtFilter
    ? (districts?.find(d => d.id === districtFilter)?.label ?? districtFilter)
    : null;
  const placeLabel = districtLabel || locationFilter || t.all;

  // Counted over the list the other filters already narrowed, so the figure answers "how many
  // are left in what I am looking at" rather than site-wide — the pill sits in that filter row.
  const unhandled = filtered.filter(e => !handlingFor(detectionHandlings, e.id));
  const visible = unhandledOnly ? unhandled : filtered;

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, visible.length);

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
              {placeLabel}
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
        {/* DELETED (2026-09-17, asked for): the grey district chip that sat here —
            "📍 Novena · Today: 8 people · 3 cameras · ✕". Its figures came from districtTally and
            its two dictionary entries went with it.

            THREE THINGS WENT WITH IT, on purpose, and none of them was replaced:

            1. The district's figures are no longer anywhere once you are zoomed in. They had
               moved here FROM a map pill that was deleted for being a leftover; the pill that
               still carries them (districtPillHtml) only draws while zoomed out past
               CLUSTER_ZOOM_BREAKPOINT, which picking a district zooms past.
            2. There is no way to clear a district filter from this panel. The place control above
               opens the CAMERA picker and does not clear a district — choosing a camera swaps one
               filter for the other. The remaining exits are zooming back out to the district pill
               and pressing it again, or switching project/tab.
            3. The row above still reads "All" while a district filter is active, because it reads
               `locationFilter` only and the two filters are mutually exclusive. That was the
               original complaint about this area and it was deliberately left as it is.
               NO LONGER TRUE (2026-09-29): it reads the district's name now — see placeLabel
               above. (2) still stands, and it is now the only half left: the panel names the
               district it is filtered to and still cannot let go of it. The one line that would
               finish it is in ClientLayout, where `onLocationClear` is `setLocationFilter(null)`
               and would have to clear `districtFilter` too; the "All locations" row in the picker
               below already calls it, so that one line is the whole clear affordance.

            `onDistrictClear` went too, all the way back to ClientLayout: with no consumer it was
            a prop chain across two files that lint flagged and that the next reader would have
            taken for a live wiring. `setDistrictFilter(null)` is still there if a clear is wanted
            back — that is the one line to re-expose.

            The person-filter chip above STAYS — it names a PERSON, a different axis, and keeps the
            purple. This one named a place. */}
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
          <button
            onClick={() => { setUnhandledOnly(v => !v); setPage(1); }}
            aria-pressed={unhandledOnly}
            style={{
              marginLeft:"auto", display:"flex", alignItems:"center", gap:"5px",
              padding:"4px 9px", borderRadius:"999px", cursor:"pointer",
              border: unhandledOnly ? "1px solid var(--gray-900)" : "1px solid var(--line-control)",
              backgroundColor: unhandledOnly ? "var(--gray-900)" : "white",
              color: unhandledOnly ? "white" : "var(--gray-600)",
              fontSize:"12px", fontWeight:600, letterSpacing:"-0.24px", whiteSpace:"nowrap",
              transition:"all 0.15s",
            }}>
            {t.handling.unhandled}
            <span style={{ fontWeight:700, color: unhandledOnly ? "white" : "var(--gray-900)" }}>{unhandled.length}</span>
          </button>
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {paginated.length === 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", padding:"32px 20px" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-400)", textAlign:"center", letterSpacing:"-0.26px" }}>
              {/* "No events detected currently." would be a false statement with the pill on and
                  every event handled — there ARE events, they are just all dealt with. */}
              {unhandledOnly && filtered.length > 0 ? t.handling.noUnhandled : t.noEvents}
            </span>
          </div>
        )}
        {paginated.map((event, i) => {
          const isSelected = event.id === selectedEventId;
          const photoUrl = getFacePhoto(event.id);
          const handling = handlingFor(detectionHandlings, event.id);
          // The one-gesture path. No actor and no timestamp passed — the store takes both from
          // the session, which is what makes the row evidence that a person was in the loop.
          const acknowledge = () => setDetectionHandling({ eventId: event.id, subject: event.name, state: "acknowledged" });
          return (
            <div key={`${event.type}-${event.id}-${i}`}>
              {event.type === "Tracking" ? (
                <TrackingEventRow event={event} isSelected={isSelected} onClick={() => onEventSelect?.(isSelected ? null : event)}
                  districtHopFilter={districtFilter} handling={handling} onAcknowledge={acknowledge} />
              ) : (
                <VipEventRow event={event} isSelected={isSelected} photoUrl={photoUrl} onClick={() => onEventSelect?.(isSelected ? null : event)} locationFilter={locationFilter} handling={handling} onAcknowledge={acknowledge} />
              )}
              {/* The last thing in what the row opens — under a trail's timeline for a Tracking
                  row, directly under the row for a VIP one. Rendered here rather than inside the
                  rows so it is outside their click target: the row selects the event on the map,
                  and nothing in here should move the map. */}
              {isSelected && <HandlingStrip event={event} handling={handling} />}
              {i < paginated.length - 1 && <div style={{ height:"1px", backgroundColor:"var(--gray-200)", margin:"0 16px" }} />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ padding:"10px 16px", borderTop:BORDER, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center", backgroundColor:"white" }}>
        <span style={{ fontSize:"10px", color:"var(--gray-400)", fontWeight:600 }}>{t.rangeOf(rangeStart, rangeEnd, visible.length)}</span>
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
          /* A district filter is a place filter, so "All locations" must not sit here looking
             chosen. Passing the district's name means no row in this list matches it and none is
             marked — which is the truth: the list is narrowed, and not by anything on this menu.
             Picking a camera here still swaps the district out (ClientLayout's onLocationSelect
             clears it); "All locations" still does not — see the note beside the deleted chip. */
          current={districtLabel || locationFilter || null}
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
  /*
   * WHETHER THESE FIGURES ARE THE WHOLE SITE.
   *
   * Every count on this tab is computed from the cameras this ACCOUNT can see — the app has
   * always filtered them (`useProjectCameras` → `camerasVisibleTo`, which resolves the account's
   * camera groups through their current membership) and has never said so anywhere. An operator
   * holding twelve of a site's cameras read 「12대」 with no way to tell whether the site has
   * twelve (owner, 2026-10-01).
   *
   * `null` is "every camera", and then nothing is drawn: a notice that is always on is furniture,
   * and this one has to mean something on the screens where it appears.
   */
  const scopeGroups = useVcaStore(st => st.cameraGroups);
  const scopeMe = useVcaStore(st => currentPortalUser(st.portalUsers));
  const cameraScope = scopeMe ? scopedCameraIds(scopeMe, scopeGroups) : null;
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
  // Undefined until fetched, like `availability` below — the tile draws no trend rather than a
  // "0 (0%)" that claims yesterday's figure was the same. See DeltaBadge.
  const linkedCams = dashboardStats?.linkedCams;
  const offlineCams = dashboardStats?.offlineCams;
  // Undefined until the figure has been fetched, NOT `?? 0` — see AvailabilityDonut.
  const availability = dashboardStats?.availability;
  // Undefined until the list has arrived — see StatCol. `devices` keeps its [] for the rows.
  const linkedCount  = devicesData ? devicesData.filter(d => d.status === "Live").length : undefined;
  const offlineCount = devicesData ? devicesData.filter(d => d.status === "Off").length : undefined;

  // No reason a page should ever look emptier than the space available for it — measure how tall
  // the list container actually is and how tall one row actually renders at, and fill the page
  // with exactly that many rows instead of a fixed guess. Only the true last page (the register's
  // count not dividing evenly) can ever come up short.
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
            <StatCol icon={<LinkedCamsIcon />} label={t.linkedCams} labelFontSize={13} count={linkedCount} trend={linkedCams} />
          </div>
          <div style={{ width:"1px", backgroundColor:"var(--gray-200)", alignSelf:"stretch", flexShrink:0 }} />
          <div style={{ flex:1, paddingLeft:"14px" }}>
            <StatCol icon={<OfflineCamsIcon />} label={t.outCams} labelFontSize={13} count={offlineCount} trend={offlineCams} />
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
        {/* Under the figures it qualifies, not above them: the numbers are what the reader came
            for, and this is the footnote saying what they were counted over. */}
        {cameraScope !== null && (
          <p style={{ fontSize:"11px", fontWeight:600, color: cameras.length === 0 ? "var(--danger-500)" : "var(--gray-400)", padding:"8px 0 0", lineHeight:1.5 }}>
            {cameras.length === 0 ? t.scopedToNone : t.scopedToYou(cameras.length)}
          </p>
        )}
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
      {/* HANDOFF NOTE: there was a TYPE column here, and every row of it said "Normal".
          `Device.type` is a constant in lib/api/dashboard's cameraToDevice ("The store carries no
          equivalent"), because the register has no camera type at all — not fixed/dome/PTZ, not
          a channel kind, nothing. So the column was 61 identical cells presented as a per-camera
          attribute, which is the shape SESSIONS rules out: a column nothing can fill is a promise
          the screen cannot keep, and a reader who sees it never asks again what type a camera is.
          It comes back when the register carries the field — the server must send a per-camera
          type on the camera record, alongside maker/model/resolution which it already has room
          for. Until then the width belongs to the name and the address, which are real. */}
      <div style={{ display:"grid", gridTemplateColumns:"76px 60px 1fr 32px", padding:"6px 20px", flexShrink:0, gap:"4px" }}>
        {([
          ["name", "left"], ["status", "left"], ["info", "right"], ["pin", "center"],
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
          above the pagination bar. Only the true last page (the register's count not divisible by
          pageSize) can ever be short — that's unavoidable, not a bug. */}
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
          const zone = zoneOfDevice(device.id, cameras);
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
                display:"grid", gridTemplateColumns:"76px 60px 1fr 32px",
                alignItems:"center", padding:"10px 20px", gap:"4px", cursor:"pointer",
                backgroundColor: isPinned ? "var(--gray-100)" : "transparent", transition:"background-color 0.1s",
              }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"1px", overflow:"hidden" }}>
                <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.24px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{device.name}</span>
                {/* Only when the register holds one — see zoneOfDevice. The row is the camera's
                    name and, under it, where the register says that camera is; with no zone on
                    record there is no second line rather than a guessed one. */}
                {zone && <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-400)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{zone}</span>}
              </div>
              <div><StatusBadge status={device.status} /></div>
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

/**
 * A device's zone, off the register, by id.
 *
 * REPLACES nearestZoneName, which measured to the closest camera in the register and returned
 * that camera's NAME. Its own comment said devices "only carry lat/lng, not a location name", and
 * that premise stopped being true when the device list became a projection of the register (one
 * camera population, 2026-09-10): `cameraToDevice` in lib/api/dashboard copies the camera's id
 * straight through, so `device.id === camera.id` and the zone is a lookup.
 *
 * What the old approximation actually produced:
 *   - a camera NAME under a heading that means zone — and since the nearest camera to a device is
 *     normally itself (the device's coordinates ARE the camera's), the row printed its own name
 *     twice. Measured in the browser before this change: "Geylang NC1 / Geylang NC1",
 *     "Orchard MRT / Orchard MRT", every row of the table; after: "Geylang NC1 / Geylang",
 *     "Orchard MRT / Orchard";
 *   - "Unknown" for a camera nobody has surveyed, e.g. "Depot Bay 2", whose zone the register
 *     records as Kallang. No coordinate is not no zone.
 *
 * Absent zone (the new-project wizard registers cameras with an empty one) answers undefined, and
 * the caller draws nothing. A blank is a blank; it is not a place called "Unknown".
 */
function zoneOfDevice(deviceId: string, cameras: Camera[]): string | undefined {
  const zone = cameras.find(c => c.id === deviceId)?.zone;
  return zone?.trim() ? zone : undefined;
}

/* ── Collapsed sidebar (60px) ── */
function CollapsedSidebar({ position = "left", onEventSelect, selectedEventId, onPinDevice, pinnedDeviceId }: {
  position?: "left" | "right";
  onEventSelect?: (event: LiveEvent | null) => void;
  selectedEventId?: string;
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [storedTab, setTab] = usePersistedSidebarTab();
  /**
   * THE TWO PANELS ARE TWO GRANTS (owner, 2026-09-21: 시스템 현황패널만 볼수있는 쪽일수도있고).
   *
   * EVENTS is detections — a person, a place, a time. SYSTEM is cameras and servers, with nobody's
   * data in it, which is why an IT operator can be given the second and not the first. The tab
   * button for a panel this account does not hold is not drawn, and a stored preference for it is
   * corrected here rather than in an effect: the panel would paint once before an effect could
   * move it, and that one frame is the whole thing being gated.
   */
  const panels = useDashboardPanels();
  const tab: SidebarTab = panels[storedTab === "SYSTEM" ? "system" : "events"]
    ? storedTab
    : (panels.events ? "EVENTS" : "SYSTEM");
  const [hovered, setHovered] = useState<{ id: string; top: number; item: LiveEvent | Device } | null>(null);
  const { vipTargets, eventsToday } = useEventCounts();
  const activeProjectId = useActiveProjectId();
  const { data: dashboardStats } = useApiData(() => getDashboardStats(activeProjectId), [activeProjectId]);
  // Undefined until the figure has been fetched, NOT `?? 0` — see AvailabilityDonut.
  const availability = dashboardStats?.availability;
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
        {panels.events && (
        <button onClick={() => setTab("EVENTS")} aria-label={t.events} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="EVENTS" ? "var(--primary-400)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25" stroke={tab==="EVENTS" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.083 5.25L8.16634 8.16667L5.83301 5.83333L4.08301 7.58333" stroke={tab==="EVENTS" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        )}
        {panels.system && (
        <button onClick={() => setTab("SYSTEM")} aria-label={t.system} style={{ width:"36px", height:"32px", borderRadius:"8px", border:"none", cursor:"pointer", backgroundColor: tab==="SYSTEM" ? "var(--primary-400)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9.87887 7.82031H12.0651C12.1677 7.82037 12.2685 7.84663 12.3581 7.89661C12.4477 7.94658 12.523 8.01862 12.5769 8.10587C12.6308 8.19313 12.6615 8.29271 12.6661 8.39517C12.6708 8.49764 12.6491 8.59958 12.6033 8.69133L11.3789 11.1406C11.3325 11.2334 11.2629 11.3127 11.1768 11.3706C11.0907 11.4286 10.9911 11.4633 10.8876 11.4714C10.7842 11.4796 10.6804 11.4608 10.5863 11.417C10.4923 11.3731 10.4111 11.3057 10.3508 11.2213L9.07227 9.43352" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.0928 6.04789C10.2354 6.11931 10.3439 6.24445 10.3944 6.39581C10.4448 6.54717 10.4331 6.71236 10.3618 6.8551L8.49219 10.5938C8.45683 10.6645 8.40788 10.7276 8.34814 10.7793C8.28841 10.8311 8.21905 10.8707 8.14403 10.8957C8.06901 10.9206 7.98981 10.9306 7.91094 10.925C7.83208 10.9193 7.75509 10.8982 7.68438 10.8628L1.96893 8.0024C1.55379 7.7933 1.23838 7.42826 1.09173 6.98717C0.945073 6.54608 0.979114 6.06486 1.1864 5.6488L2.01708 3.96938C2.12062 3.76305 2.26378 3.57913 2.43841 3.42813C2.61303 3.27713 2.81568 3.16202 3.0348 3.08935C3.25392 3.01668 3.48521 2.98789 3.71545 3.00462C3.9457 3.02135 4.17039 3.08327 4.3767 3.18685L10.0928 6.04789Z" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 12.0347H3.26331C3.48767 12.0363 3.70801 11.9751 3.89945 11.8581C4.0909 11.7411 4.24585 11.573 4.34681 11.3726L5.21361 9.62695" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 13.2398V10.832" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.00977 6.01562H4.01458" stroke={tab==="SYSTEM" ? "white" : "var(--gray-500)"} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        )}
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
            // Only once there is a figure to judge; no figure is not a low figure. `cameras`
            // comes from the store and is populated on the first render while `availability`
            // comes from a request that resolves a moment later, so with `?? 0` this test was
            // true for that window on every mount: the panel opened with a red AVAIL 0% — every
            // camera on the site is down — and then corrected itself to 96%.
            const low = availability !== undefined && cameras.length > 0 && availability < 50;
            const shown = availability !== undefined && cameras.length > 0 ? `${availability}%` : "—";
            return (
              <div style={{
                width:"38px", height:"38px", borderRadius:"10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                backgroundColor: low ? "var(--danger-100)" : "var(--gray-100)", border: low ? "1px solid var(--danger-200)" : "1px solid var(--gray-200)",
              }}>
                <span style={{ fontSize:"10px", fontWeight:600, color: low ? "var(--danger-400)" : "var(--gray-400)", letterSpacing:"0.3px" }}>{t.avail}</span>
                <span style={{ fontSize:"13px", fontWeight:700, color: low ? "var(--danger-400)" : "var(--gray-400)", lineHeight:1 }}>{shown}</span>
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
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"210px", backgroundColor:"white", border:BORDER, borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(24, 17, 39,0.12)", pointerEvents:"none" }}>
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
          const zone = zoneOfDevice(device.id, cameras);
          return (
            <div style={{ position:"fixed", ...(position === "right" ? { right:"64px" } : { left:"64px" }), top: clampedTop, zIndex:1000, width:"180px", backgroundColor:"var(--gray-900)", border:"1px solid var(--gray-700)", borderRadius:"12px", padding:"10px", boxShadow:"0 4px 20px rgba(24, 17, 39,0.2)", pointerEvents:"none" }}>
              {zone && <div style={{ fontSize:"10px", color:"var(--gray-400)", marginBottom:"3px" }}>{zone}</div>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", fontWeight:800, color:"white" }}>{device.name}</span>
                <span style={{ fontSize:"10px", fontWeight:600, color: isLive ? "var(--success-400)" : "var(--danger-400)", backgroundColor: "var(--gray-800)", padding:"2px 6px", borderRadius:"4px" }}>
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
  onPinDevice?: (device: Device | null) => void;
  pinnedDeviceId?: string | null;
  isCollapsed?: boolean;
  onToggleDetectionChart?: () => void;
  /** Which side of the map this sidebar sits on — flips which edge carries the border. */
  position?: "left" | "right";
}

export default function Sidebar({ onEventSelect, selectedEventId, locationFilter, onLocationClear, onLocationSelect, districtFilter, onPinDevice, pinnedDeviceId, isCollapsed, onToggleDetectionChart, position = "left" }: SidebarProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [storedTab, setActiveTab] = usePersistedSidebarTab();
  /*
   * THE EXPANDED RAIL GATES ITS PANELS TOO (2026-09-30).
   *
   * CollapsedSidebar has read `useDashboardPanels()` since the two-panel cut was made and draws
   * only the tabs the account holds. This one — the 380px rail, the one that is open by default —
   * hardcoded both tabs and never asked. So an account granted `systemStatus` and nothing else,
   * which is the case the owner asked for on 2026-09-21 (an IT operator who watches cameras, not
   * people), still got an EVENTS tab, and behind it the detection feed with people's names and
   * match scores on it. The grant existed, the screen just did not read it.
   *
   * Same shape as the collapsed twin, deliberately: a stored preference for a panel this account
   * does not hold is corrected HERE rather than in an effect, because an effect lets the panel
   * paint one frame first and that frame is the whole thing being gated.
   */
  const panels = useDashboardPanels();
  const activeTab: SidebarTab = panels[storedTab === "SYSTEM" ? "system" : "events"]
    ? storedTab
    : (panels.events ? "EVENTS" : "SYSTEM");
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // A person filter names one person at one site. Left standing through a site switch it filtered
  // this site's list by a name that is not in it, so the list read as empty with a purple chip on
  // top explaining why in terms of somebody who was never here.
  const sidebarProjectId = useActiveProjectId();
  useOnValueChange(sidebarProjectId, () => setPersonFilter(null));

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
          {/* Only the panels this account holds. Both when it holds both, which is every ordinary
              account — the filter changes nothing for them and removes a door for the one case it
              is there for. */}
          {(["EVENTS","SYSTEM"] as SidebarTab[]).filter(tab => panels[tab === "SYSTEM" ? "system" : "events"]).map(tab => {
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
