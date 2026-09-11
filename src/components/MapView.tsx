"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveEvent, Device, TrackingHop, nearestDistrict, getFacePhoto, formatTimeAgo,
  DISTRICT_ALERT_THRESHOLD_KEY, DISTRICT_MODERATE_THRESHOLD_KEY,
  DEFAULT_DISTRICT_ALERT_THRESHOLD, DEFAULT_DISTRICT_MODERATE_THRESHOLD } from "@/lib/mockData";
import {
  vcaEventsToLiveEvents,
  useProjectEvents, useProjectCameras, todaysDetectionHits, type Camera,
} from "@/lib/vcaStore";
import { useCameraStatus, runStateOf } from "@/lib/realtime/cameraStatus";
import { useApiData } from "@/hooks/useApiData";
import { getDistricts } from "@/lib/api/dashboard";
import { isTodaySgt } from "@/lib/time";
import { MAP_TILE_URL, MAP_TILE_FILTER, tileLayerOptions } from "@/lib/mapTiles";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. Most of this screen's words live inside popup
// markup built as HTML strings, which is why the builders below take the language as an argument
// rather than reading a hook: they run outside React, inside Leaflet.
const T = {
  en: {
    // The district pill's denominator and its no-coverage wording. Kept short: this is a label on
    // a map, and the full sentence lives in the tooltip below it.
    camerasShort: (n: number) => `${n} cam${n === 1 ? "" : "s"}`,
    /**
     * How each language marks this figure as a COUNT OF SIGHTINGS rather than of people.
     *
     * It has to be marked. This number is normally larger than the hit pin's, which counts
     * people — and an unlabelled larger number beside a labelled one ("5 cams") gets read as the
     * people count. In a control room twelve people and four are different situations.
     *
     * One character in each language, because seventeen of these pills share one map and the
     * English word for it ("12 hits") crowded the very figure it was labelling. English takes the
     * multiplication sign, which reads as "twelve times"; Korean has a counter for exactly this
     * and puts it behind the number.
     */
    hitsMark: () => "×",
    hitsUnit: () => "",
    noCamera: "no camera",
    camerasDown: "all down",
    spotSummary: (people: number, hits: number) =>
      `Here today: ${people} ${people === 1 ? "person" : "people"} · ${hits} detection${hits === 1 ? "" : "s"}`,
    live: "LIVE",
    out: "OUT",
    offline: "OFFLINE",
    captured: "Captured",
    registered: "Registered",
    capturedFrame: "CAPTURED FRAME",
    analyzeFrame: "Analyze Frame",
    outSince: (when: string) => `Out since ${when}`,
    viewLive: "View Live in Best Frame",
    lastSeen: "LAST SEEN",
    fullTrace: "View Full Trace on Redmap",
    unknownZone: "Unknown",
  },
  ko: {
    camerasShort: (n: number) => `${n}대`,
    hitsMark: () => "",
    hitsUnit: () => "건",
    noCamera: "카메라 없음",
    camerasDown: "전부 중단",
    spotSummary: (people: number, hits: number) => `이 지점 오늘 ${people}명 · ${hits}건`,
    live: "정상",
    out: "중단",
    offline: "중단",
    captured: "검출 이미지",
    registered: "등록 이미지",
    capturedFrame: "검출된 프레임",
    analyzeFrame: "프레임 분석",
    outSince: (when: string) => `${when}부터 중단`,
    viewLive: "베스트 프레임에서 실시간 보기",
    lastSeen: "마지막 검출",
    fullTrace: "레드맵에서 전체 경로 보기",
    unknownZone: "미확인",
  },
} as const;

// Leaflet popups are raw HTML strings, not React — values dropped into an inline onclick="...('...')"
// attribute need their quotes escaped so a name/label containing one can't break the attribute.
function escapeAttr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Recent-activity ping — a fixed-size dot with an expanding/fading ring around it (same visual
// as the old 100+-count zone alert), shown at every location with an actual live/tracked
// detection. Replaces the old always-on, hardcoded zone-count pills so the default map only
// ever shows where something was really just found.
const VIP_PING_COLOR = "var(--primary-400)";

// Both camera-dot variants below share a bigger invisible "vca-camera-dot-hit" box around the
// actual small visible dot ("vca-camera-dot-visual") — a 10px circle is a tiny target to hit
// exactly, and the wrapper (translate-centered on the marker's real lat/lng, same as before)
// gives click/hover a more forgiving area without changing how big the dot looks. The hover
// scale-up itself is a plain CSS rule in globals.css (.vca-camera-dot-hit:hover ...).
function recentPingHtml(color: string): string {
  return `
    <div class="vca-camera-dot-hit" style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;transform:translateX(-50%) translateY(-50%)">
      <div class="vca-camera-dot-visual" style="position:relative;width:14px;height:14px;transition:transform 0.15s ease">
        <span class="vca-alert-ping" style="position:absolute;inset:0;border-radius:50%;background:${color};"></span>
        <div class="vca-map-dot" style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};"></div>
      </div>
    </div>`;
}

// The box is 14px, not the 10px it reads as: box-sizing is border-box globally, so the 2px white
// casing eats into the width and the visible fill lands back at 10px. Fill is gray-700 rather than
// gray-600 — still quiet next to a colour ping, but it survives a light basemap.
// Same footprint as recentPingHtml (so both anchor identically) but no expanding ring and a
// muted dark-gray fill — every camera's location still gets marked when zoomed in, but only the
// ones with a recent VIP hit get the attention-grabbing pulse.
function quietCameraDotHtml(): string {
  return `
    <div class="vca-camera-dot-hit" style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;transform:translateX(-50%) translateY(-50%)">
      <div class="vca-camera-dot-visual vca-map-dot" style="position:relative;width:14px;height:14px;border-radius:50%;background:var(--gray-700);transition:transform 0.15s ease"></div>
    </div>`;
}

// Hover tooltip for a zoomed-in camera dot — same name+status-badge+zone shape as the System
// panel's device pin popup (getDevicePopupHTML above), just triggered on hover instead of click
// and sourced from Camera's own fields (a Camera and a System-panel Device are separate mock
// pools in this app, not joinable by anything reliable — see the camera-data-pool-consolidation
// notes elsewhere — so this reads Camera's own status/zone rather than trying to cross-reference).
function cameraDotTooltipHtml(cam: Camera, lang: AppLanguage): string {
  const t = T[lang];
  const isLive = runStateOf(cam.status) === "running";
  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:120px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;white-space:nowrap">${cam.name}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:999px;flex-shrink:0;color:${isLive ? "var(--success-400)" : "var(--danger-400)"};background:${isLive ? "rgba(22, 163, 74,0.12)" : "rgba(244,63,94,0.12)"}">
          ${isLive ? t.live : t.offline}
        </span>
      </div>
      <span style="font-size:10px;font-weight:600;color:var(--gray-500);white-space:nowrap">${cam.zone || cam.location}</span>
    </div>`;
}

// Zoomed out (zoom <= breakpoint) shows district cluster pills (real counts, computed below);
// zoomed in past it shows the per-camera recent-activity dots instead — the same breakpoint
// idea as RedmapMap's tracking-route decluttering, just gating which layer draws at all.
const CLUSTER_ZOOM_BREAKPOINT = 14;
/** Where a district pill flies you to. One past the cluster breakpoint, so the pills give way to
 *  the per-camera layer as part of the same movement rather than needing a second zoom. */
const DISTRICT_FOCUS_ZOOM = 15;
/** The whole-island view a district selection returns to when it is cleared. Matches the map's
 *  own init above, so clearing puts the map back exactly where it started. */
const OVERVIEW_CENTER: [number, number] = [1.3521, 103.8198];
const OVERVIEW_ZOOM = 12;

// Ported from RedmapMap.tsx's statusMarkerHtml() — same colors/dashed-camera-icon — but driven by
// real computed { count, hasCamera } instead of RedmapMap's hardcoded STATUS_ZONES, and by
// user-configurable thresholds instead of hardcoded ones.
/**
 * A district's pill.
 *
 * The count carries weight beyond this screen: customers submit it upward as the evidence for
 * where to install more cameras. So it never travels alone.
 *
 * What the figure counts is DETECTIONS today, not distinct people — so it carries that unit, and
 * the word VIP in front of it. Without both, "1 / 5 cams" was a bare number next to a camera
 * count: nothing on the pill said a person had been detected at all, which is the one thing it
 * exists to say.
 *
 * `cameraCount` is beside it because 29 hits from 3 cameras and 29 from 40 are opposite findings,
 * and the raw number reads identically. And a district with no camera at all is called that
 * outright rather than showing 0 — 0 reads as "nothing happens here" when it means "nothing can
 * be seen here", which is exactly the district a coverage decision should be looking at.
 */
function districtPillHtml(
  label: string,
  count: number,
  cameraCount: number,
  hasOnlineCamera: boolean,
  alertThreshold: number,
  moderateThreshold: number,
  t: (typeof T)[AppLanguage],
): string {
  const isAlert = count >= alertThreshold;
  const isDark = !isAlert && count >= moderateThreshold;
  // No camera registered here at all — a coverage gap, not a quiet district.
  const isUncovered = cameraCount === 0;
  // Dashed = this district's camera(s) are offline, not "no camera was ever installed here".
  const isDashed = !isUncovered && !hasOnlineCamera;
  let bg: string, textColor: string, border: string;
  if (isAlert)      { bg = "var(--danger-400)"; textColor = "white";   border = ""; }
  else if (isDark)  { bg = "var(--gray-900)"; textColor = "white";   border = ""; }
  // Offline cameras aren't as urgent a signal as a real, nonzero VIP count — purple is reserved
  // for things that actually need attention, so this stays a neutral gray instead.
  else if (isDashed || isUncovered) { bg = "white"; textColor = "var(--gray-500)"; border = "border:1.5px dashed var(--gray-300);"; }
  else              { bg = "white";   textColor = "var(--gray-700)"; border = "border:1.5px solid var(--primary-400);"; }
  const camSvg = (isDashed || isUncovered)
    ? `<svg width="12" height="12" viewBox="0 0 18 18" fill="none" style="flex-shrink:0">
        <path d="M7.99512 4.5H10.5001C10.8979 4.5 11.2795 4.65804 11.5608 4.93934C11.8421 5.22064 12.0001 5.60218 12.0001 6V7.875L15.9361 5.5785C15.9931 5.54524 16.0579 5.52762 16.1238 5.52739C16.1898 5.52717 16.2547 5.54436 16.3119 5.57722C16.3691 5.61009 16.4167 5.65747 16.4497 5.71459C16.4827 5.7717 16.5001 5.83652 16.5001 5.9025V12.0495"
              stroke="var(--gray-500)" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12C12 12.3978 11.842 12.7794 11.5607 13.0607C11.2794 13.342 10.8978 13.5 10.5 13.5H3C2.60218 13.5 2.22064 13.342 1.93934 13.0607C1.65804 12.7794 1.5 12.3978 1.5 12V6C1.5 5.60218 1.65804 5.22064 1.93934 4.93934C2.22064 4.65804 2.60218 4.5 3 4.5H4.5"
              stroke="var(--gray-500)" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M1.5 1.5L16.5 16.5" stroke="var(--gray-500)" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    : "";

  // Two lines, not one. Seventeen of these sit on one map and the horizontal form collided with
  // its neighbours as soon as the count gained a denominator — a stacked box is narrower where
  // the crowding actually happens. It also puts the figure where the eye lands: you find a
  // district by position, then read its number; the name only confirms which one you are looking
  // at, so it sits above as the smaller line.
  //
  // Same two-line shape in all three states, so a map of these reads as one kind of object. Only
  // the second line changes — figures, "all down", or "no camera".
  const secondLine = isUncovered
    ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;opacity:0.85">${camSvg}${t.noCamera}</span>`
    : isDashed
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;opacity:0.85">${camSvg}${t.camerasDown}</span>`
      // Named, and no longer a fraction. It used to read "1 / 5 cams", which says neither what
      // the 1 is nor what it is 1 of — and a slash between two figures reads as "1 OF 5 cameras",
      // a different and wrong claim. So: the word VIP in front, the unit behind the number, and a
      // middot instead of the slash, because the camera count sits beside this figure rather than
      // under it. The figure stays the biggest thing on the pill — you find a district by
      // position and then read its number.
      // The mark hugs the figure (no space between them) — it is part of reading the number, not
      // a separate word. "VIP" keeps its own gap in front.
      : `<span style="font-size:10px;font-weight:700;opacity:0.82;letter-spacing:0.2px;margin-right:3px">VIP</span>` +
        (t.hitsMark() ? `<span style="font-size:11px;font-weight:600;opacity:0.62">${t.hitsMark()}</span>` : "") +
        `<span style="font-size:14px;font-weight:800;letter-spacing:-0.3px">${count}</span>` +
        `<span style="font-size:11px;font-weight:500;opacity:0.62">${t.hitsUnit()}&nbsp;·&nbsp;${t.camerasShort(cameraCount)}</span>`;

  const shadow = isDark || isAlert ? "0 2px 10px rgba(14, 22, 42,0.2)" : "0 2px 6px rgba(14, 22, 42,0.08)";
  return `<div style="transform:translateX(-50%) translateY(-50%);display:inline-flex;flex-direction:column;
      align-items:center;gap:1px;background:${bg};${border}border-radius:10px;padding:5px 10px;
      font-family:'SUIT',system-ui,sans-serif;color:${textColor};box-shadow:${shadow};
      white-space:nowrap;letter-spacing:-0.2px">
    <span style="font-size:11px;font-weight:600;opacity:0.78">${label}</span>
    <span style="display:inline-flex;align-items:baseline">${secondLine}</span>
  </div>`;
}

function getPopupHTML(event: LiveEvent, lang: AppLanguage): string {
  const t = T[lang];
  const typeColor = event.type === "VIP" ? "var(--primary-400)" : "var(--type-tracking)";
  const typeBg = event.type === "VIP" ? "var(--primary-50)" : "var(--type-tracking-100)";
  const photoUrl = getFacePhoto(event.id);
  const vipBadge = event.type === "VIP"
    ? `<div style="background:var(--primary-50);border-radius:10px;padding:2px 8px;display:flex;align-items:center;gap:3px;flex-shrink:0">
         <span style="font-size:9px;font-weight:700;color:var(--primary-400)">VIP</span>
       </div>`
    : `<div style="background:${typeBg};border-radius:10px;padding:2px 8px;flex-shrink:0">
         <span style="font-size:9px;font-weight:700;color:${typeColor}">${event.type.toUpperCase()}</span>
       </div>`;

  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;width:256px;padding:14px 14px 12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-right:18px;gap:8px">
        <div style="display:flex;align-items:flex-start;gap:5px;min-width:0">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-top:1px">
            <path d="M12.5625 9.00781H15.2865C15.4143 9.00788 15.5399 9.0406 15.6515 9.10287C15.7631 9.16514 15.857 9.25489 15.9241 9.36361C15.9913 9.47233 16.0296 9.5964 16.0353 9.72407C16.0411 9.85173 16.0141 9.97875 15.957 10.0931L14.4315 13.1448C14.3737 13.2605 14.2869 13.3592 14.1796 13.4314C14.0724 13.5036 13.9483 13.5469 13.8194 13.557C13.6905 13.5671 13.5612 13.5437 13.444 13.4891C13.3268 13.4345 13.2257 13.3505 13.1505 13.2453L11.5575 11.0178" stroke="var(--gray-600)" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12.8295 6.79756C13.0073 6.88655 13.1424 7.04246 13.2053 7.23105C13.2681 7.41964 13.2536 7.62547 13.1647 7.80331L10.8352 12.4616C10.7912 12.5497 10.7302 12.6282 10.6558 12.6928C10.5813 12.7573 10.4949 12.8066 10.4015 12.8377C10.308 12.8688 10.2093 12.8812 10.111 12.8742C10.0128 12.8672 9.91685 12.8409 9.82875 12.7968L2.7075 9.23281C2.19025 8.97227 1.79727 8.51745 1.61454 7.96786C1.43181 7.41828 1.47423 6.8187 1.7325 6.30031L2.7675 4.20781C2.8965 3.95073 3.07488 3.72157 3.29245 3.53344C3.51003 3.3453 3.76253 3.20187 4.03554 3.11133C4.30855 3.02079 4.59673 2.98491 4.8836 3.00576C5.17048 3.0266 5.45044 3.10376 5.7075 3.23281L12.8295 6.79756Z" stroke="var(--gray-600)" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1.5 14.2578H4.32C4.59955 14.2598 4.87408 14.1835 5.11261 14.0378C5.35115 13.892 5.54421 13.6825 5.67 13.4328L6.75 11.2578" stroke="var(--gray-600)" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1.5 15.7578V12.7578" stroke="var(--gray-600)" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.25 7H5.25729" stroke="var(--gray-600)" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;line-height:1.3">${event.location}${event.cameraLabel ? ` · ${event.cameraLabel}` : ""}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin-top:1px">
          ${/* The green dot means "this is happening now", so it only belongs on a sighting that
                is. It was hardcoded, which put a live indicator next to a timestamp from hours
                ago. Under a minute is the only case where "now" is true. */ ""}
          ${Date.now() - new Date(event.timestamp).getTime() < 60_000
            ? `<div style="width:6px;height:6px;background:var(--success-400);border-radius:50%"></div>`
            : ""}
          <span style="font-size:11px;color:var(--gray-500);letter-spacing:-0.22px">${formatTimeAgo(event.timestamp, lang)}</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        ${vipBadge}
        <span style="font-size:13px;font-weight:700;color:var(--gray-900);letter-spacing:-0.26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${event.name}</span>
      </div>

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:8px;background:var(--gray-100);overflow:hidden">
            <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
          </div>
          <span style="font-size:10px;color:var(--gray-400);display:block;margin-top:4px;letter-spacing:-0.2px">${t.captured}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:20px">
          <div style="width:44px;border-top:1.5px dashed var(--gray-300)"></div>
          <span style="font-size:11px;font-weight:700;color:var(--gray-500);letter-spacing:-0.22px">${event.confidence}%</span>
          <div style="width:44px;border-top:1.5px dashed var(--gray-300)"></div>
        </div>
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:8px;background:var(--info-200);display:flex;align-items:center;justify-content:center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="var(--primary-300)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="var(--primary-300)" stroke-width="2"/></svg>
          </div>
          <span style="font-size:10px;color:var(--gray-400);display:block;margin-top:4px;letter-spacing:-0.2px">${t.registered}</span>
        </div>
      </div>

      <div style="background:var(--gray-900);border-radius:8px;height:96px;overflow:hidden;position:relative">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(14,22,42,0.8), rgba(14,22,42,0) 55%)"></div>
        <span style="position:absolute;bottom:8px;left:10px;font-size:9px;color:rgba(255,255,255,0.85);font-weight:700;letter-spacing:0.5px">${t.capturedFrame}</span>
      </div>

      <button onclick="window.__vcaGoAnalyzeFrame && window.__vcaGoAnalyzeFrame('${escapeAttr(event.location)}')"
        style="margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:var(--gray-900);color:white;border:none;border-radius:6px;padding:8px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        ${t.analyzeFrame}
      </button>
    </div>
  `;
}

function getMarkerHTML(type: string, photoUrl: string): string {
  const color = type === "VIP" ? "var(--primary-400)" : "var(--type-tracking)";
  // VIP arrivals get a flashing glow around the pin so they're easy to spot on the map at a
  // glance — other event types keep the plain static halo.
  const flashClass = type === "VIP" ? "vca-vip-flash" : "";
  return `
    <div style="width:42px;height:56px;position:relative;display:flex;flex-direction:column;align-items:center">
      <div class="${flashClass}" style="position:absolute;left:50%;bottom:0;width:92px;height:92px;border-radius:50%;background:${color}14;transform:translate(-50%,50%);z-index:0"></div>
      <div class="${flashClass}" style="position:absolute;left:50%;bottom:0;width:60px;height:60px;border-radius:50%;background:${color}26;transform:translate(-50%,50%);z-index:0"></div>
      <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid ${color};background:var(--gray-100);overflow:hidden;position:relative;z-index:2">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
      </div>
      <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:18px solid ${color};margin-top:-12px;z-index:1"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:-4px;z-index:1"></div>
    </div>
  `;
}

function nearestZoneName(lat: number, lng: number, cameras: { name: string; lat: number; lng: number }[], unknown = "Unknown"): string {
  let best = cameras[0];
  let bestDist = Infinity;
  for (const c of cameras) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best?.name ?? unknown;
}

function getDevicePopupHTML(device: Device, zoneName: string, lang: AppLanguage): string {
  const t = T[lang];
  const isLive = device.status === "Live";
  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;width:200px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-right:18px;gap:8px">
        <span style="font-size:13px;font-weight:800;color:var(--gray-900);letter-spacing:-0.26px">${device.name}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;color:${isLive ? "var(--success-400)" : "var(--danger-400)"};background:${isLive ? "rgba(22, 163, 74,0.12)" : "rgba(244,63,94,0.12)"};flex-shrink:0">
          ${isLive ? t.live : t.out}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.3 10.9C7.23 10.1 10 7.5 10 5c0-2.21-1.79-4-4-4S2 2.79 2 5c0 2.5 2.77 5.1 3.7 5.9.09.06.19.1.3.1s.21-.04.3-.1Z" stroke="var(--gray-500)" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="5" r="1.5" stroke="var(--gray-500)"/></svg>
        <span style="font-size:11px;font-weight:600;color:var(--gray-600)">${zoneName}</span>
      </div>
      ${!isLive ? `
      <div style="display:flex;align-items:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--danger-400)" stroke-linecap="round"/><path d="M6 3v3l2 1.5" stroke="var(--danger-400)" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span style="font-size:11px;font-weight:600;color:var(--danger-400)">${t.outSince(device.lastSeen)}</span>
      </div>` : `
      <button onclick="window.__vcaGoLiveCam && window.__vcaGoLiveCam('${escapeAttr(zoneName)}')"
        style="margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:var(--gray-900);color:white;border:none;border-radius:6px;padding:7px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        ${t.viewLive}
      </button>`}
    </div>
  `;
}

function getDeviceMarkerHTML(name: string, isLive: boolean): string {
  const color = isLive ? "var(--success-400)" : "var(--danger-400)";
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:5px;background:var(--gray-900);border-radius:999px;padding:5px 10px;box-shadow:0 2px 10px rgba(14, 22, 42,0.2);white-space:nowrap">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <span style="font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:800;color:white;letter-spacing:-0.2px">${name}</span>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid var(--gray-900);margin-top:-1px"></div>
    </div>
  `;
}

// Ported from RedmapMap.tsx's tracking-route rendering — reused here so a Tracking event
// selected on the Dashboard draws the same numbered-node route instead of a single pin, since
// the whole point of "Tracking" is the multi-camera path, not just one last-known point.
type CameraRef = { name: string; lat: number; lng: number };

// A TrackingHop only carries a location name (+ optional camera label), not lat/lng — resolve it
// against the registered camera list the same way the badge label is built ("Geylang" + "NC1").
function hopToLatLng(hop: TrackingHop, cameras: CameraRef[]): { lat: number; lng: number } {
  const fullName = hop.cameraLabel ? `${hop.location} ${hop.cameraLabel}` : hop.location;
  const exact = cameras.find(c => c.name === fullName) ?? cameras.find(c => c.name === hop.location);
  if (exact) return { lat: exact.lat, lng: exact.lng };
  const firstWord = hop.location.split(" ")[0];
  const partial = cameras.find(c => c.name.includes(firstWord));
  if (!partial) return { lat: cameras[0]?.lat ?? 1.3521, lng: cameras[0]?.lng ?? 103.8198 };
  // No dedicated coordinate for this specific camera label (e.g. a second camera at the same
  // site) — nudge deterministically off the site's own point so it doesn't sit exactly on top.
  const seed = hop.cameraLabel ? hop.cameraLabel.charCodeAt(hop.cameraLabel.length - 1) : 0;
  return { lat: partial.lat + (seed % 5) * 0.0015, lng: partial.lng + (seed % 3) * 0.0015 };
}

function routeBubbleTailHtml(centerY: number, fillColor: string, borderColor: string): string {
  return `<div style="position:absolute;left:-9px;top:${centerY - 8}px;width:0;height:0;
        border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:9px solid ${borderColor};"></div>
     <div style="position:absolute;left:-8px;top:${centerY - 7}px;width:0;height:0;
        border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:8px solid ${fillColor};"></div>`;
}

interface MapViewProps {
  selectedEvent?: LiveEvent | null;
  onCameraSelect?: (label: string | null) => void;
  onDistrictSelect?: (districtId: string) => void;
  /** The district currently filtered to, if any. Drives both the flyTo below and which markers
   *  the pill/dot layer draws — selecting a district is meant to leave only that district's VIP
   *  hits on the map, not merely tint the list beside it. */
  districtFilter?: string | null;
  pinnedDevice?: Device | null;
  onGoLiveCam?: (location: string) => void;
  onGoRedmapTrace?: (personName: string) => void;
  onAnalyzeFrame?: (location: string) => void;
}

export default function MapView({ selectedEvent, onCameraSelect, onDistrictSelect, districtFilter = null, pinnedDevice, onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame }: MapViewProps) {
  // Every effect that builds popup or tooltip markup lists `lang` in its deps, so switching the
  // language redraws what is already on the map instead of leaving the open popup in the old one.
  const [lang] = useLanguage();
  const t = T[lang];
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const popupRef = useRef<unknown>(null);
  // Flips once Leaflet's async init resolves — the selectedEvent/pinnedDevice/district-cluster
  // effects below read mapInstanceRef synchronously and bail if it's still null, so without this
  // they silently no-op when data arrives on the very first mount (init hasn't resolved yet) and
  // never retry.
  const [mapReady, setMapReady] = useState(false);
  // Mirrors the map's own zoom level — read by the district-cluster/recent-activity effect to
  // decide whether to draw the zoomed-out cluster pills or the zoomed-in per-camera dots.
  const [zoom, setZoom] = useState(12);
  // Routed through the future-backend stub instead of importing the mock array directly — see
  // lib/api/dashboard.ts. No pills draw during the brief pre-fetch window (empty array default),
  // same as before mapReady flips true.
  const { data: districtsData } = useApiData(() => getDistricts(), []);
  const districts = useMemo(() => districtsData ?? [], [districtsData]);
  // User-configurable (My Page → Map Alert Thresholds). Default on the server-rendered pass so
  // hydration never mismatches; a client-only effect then applies whatever's saved.
  const [alertThreshold, setAlertThreshold] = useState(DEFAULT_DISTRICT_ALERT_THRESHOLD);
  const [moderateThreshold, setModerateThreshold] = useState(DEFAULT_DISTRICT_MODERATE_THRESHOLD);
  useEffect(() => {
    queueMicrotask(() => {
      const savedAlert = Number(localStorage.getItem(DISTRICT_ALERT_THRESHOLD_KEY));
      const savedModerate = Number(localStorage.getItem(DISTRICT_MODERATE_THRESHOLD_KEY));
      if (Number.isFinite(savedAlert) && savedAlert > 0) setAlertThreshold(savedAlert);
      if (Number.isFinite(savedModerate) && savedModerate > 0) setModerateThreshold(savedModerate);
    });
  }, []);

  // Bridge for clicks inside Leaflet's raw-HTML popups (they aren't React, so they can't call
  // these handlers directly) — the popup markup calls window.__vcaGoLiveCam(...) / __vcaGoRedmapTrace(...).
  useEffect(() => {
    (window as unknown as { __vcaGoLiveCam?: (location: string) => void }).__vcaGoLiveCam = onGoLiveCam;
    (window as unknown as { __vcaGoRedmapTrace?: (name: string) => void }).__vcaGoRedmapTrace = onGoRedmapTrace;
    (window as unknown as { __vcaGoAnalyzeFrame?: (location: string) => void }).__vcaGoAnalyzeFrame = onAnalyzeFrame;
    return () => {
      delete (window as unknown as { __vcaGoLiveCam?: (location: string) => void }).__vcaGoLiveCam;
      delete (window as unknown as { __vcaGoRedmapTrace?: (name: string) => void }).__vcaGoRedmapTrace;
      delete (window as unknown as { __vcaGoAnalyzeFrame?: (location: string) => void }).__vcaGoAnalyzeFrame;
    };
  }, [onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame]);
  const pinMarkerRef = useRef<unknown>(null);
  const deviceMarkerRef = useRef<unknown>(null);
  const devicePopupRef = useRef<unknown>(null);
  const zoneLayerRef = useRef<unknown>(null);
  const trackingRouteLayersRef = useRef<unknown[]>([]);
  const onCameraSelectRef = useRef(onCameraSelect);
  useEffect(() => { onCameraSelectRef.current = onCameraSelect; }, [onCameraSelect]);
  const onDistrictSelectRef = useRef(onDistrictSelect);
  useEffect(() => { onDistrictSelectRef.current = onDistrictSelect; }, [onDistrictSelect]);

  // Registered cameras' real lat/lng — the exact CCTV install point, distinct from a zone
  // marker's own (approximate, district-level) coordinate.
  const cameras = useProjectCameras();
  // Camera run state comes from one place — see lib/realtime/cameraStatus.ts. The backend owns the
  // realtime layer and replaces that module's body at intake; nothing here changes.
  const cameraStatus = useCameraStatus();
  const camerasRef = useRef(cameras);
  useEffect(() => { camerasRef.current = cameras; }, [cameras]);

  // Recently-detected locations — feeds the district-cluster/recent-activity effect below
  // directly (no ref needed there since that effect already re-runs on every change).
  // This site's detections only. A map is the one screen where mixing two sites is worst: the
  // pins would sit in two cities and "respond to this" would point at the wrong one.
  const projectEvents = useProjectEvents();
  const recentEvents = vcaEventsToLiveEvents(projectEvents);
  /**
   * Today's VIP detections at this site, one entry per sighting, with where each happened.
   *
   * The same derivation the sidebar's "detections today" and the activity chart already share
   * (todaysDetectionHits) — the district pills are the third screen asking this question, and
   * they were answering it themselves by counting `type === "VIP"` rows. That silently dropped
   * every VIP who had been picked up by two or more cameras, because those collapse into one
   * "Tracking" row: the most active people in a district counted zero there.
   */
  const todaysHits = useMemo(() => todaysDetectionHits(projectEvents), [projectEvents]);

  // ── Map initialization ───────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const container = mapRef.current as any;
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

      // The usual Next.js/Leaflet fix for broken default marker icons used to sit here, pointing at
      // unpkg. Removed: every L.marker in this file and in RedmapMap passes its own divIcon, so
      // L.Icon.Default is never constructed — and the deployment target is a network with no
      // internet, where those three URLs are unreachable anyway.

      const map = L.map(mapRef.current!, {
        center: OVERVIEW_CENTER,
        zoom: OVERVIEW_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      if (cancelled) {
        map.remove();
        return;
      }

      L.tileLayer(MAP_TILE_URL, tileLayerOptions()).addTo(map);

      map.zoomControl.setPosition("topright");
      map.on("zoomend", () => setZoom(map.getZoom()));
      mapInstanceRef.current = map;
      setZoom(map.getZoom());
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── District cluster pills (zoomed out) / per-camera activity pings (zoomed in) ─
  // Zoom <= CLUSTER_ZOOM_BREAKPOINT: aggregate into district pill badges — camera counts and
  // today's VIP-hit counts, real computed data rather than the old hardcoded RedmapMap mock.
  // Zoom > breakpoint: fall back to the original per-location recent-activity dots so individual
  // detections are still identifiable once zoomed in far enough to tell sites apart.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    if (zoneLayerRef.current) {
      (zoneLayerRef.current as { remove: () => void }).remove();
      zoneLayerRef.current = null;
    }

    // import("leaflet") is async, so by the time it resolves the map may already have been torn
    // down (tab switch unmounting this component) or this effect may have re-fired with newer
    // deps — either way `map` is stale and .addTo(map) on a removed Leaflet map throws
    // ("Cannot read properties of undefined (reading 'appendChild')"). Bail out instead.
    let cancelled = false;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !mapInstanceRef.current) return;
      const group = L.layerGroup();

      if (districtFilter) {
        // ── A district was picked: only what was found there ──
        // Not the camera layer with a filter on it. That layer marks camera POSITIONS and pings
        // the ones whose coordinates match a recent hit exactly — which the hand-authored seed
        // hits never do, so filtering it would fly you into an empty district. These are the hits
        // themselves, drawn at their own coordinates with the same face pin a selected VIP gets.
        //
        // Today, matching what the pill counted. An hour would be the honest window for "recent",
        // but the number that was just clicked says today, and a pill reading 7 that opens onto
        // two pins is a pill that lied.
        const now = new Date();
        const hits = recentEvents
          .filter(ev => ev.type === "VIP"
            && isTodaySgt(new Date(ev.timestamp), now)
            && nearestDistrict(ev.lat, ev.lng).id === districtFilter)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Several hits at one camera would stack into an unreadable pile of identical pins, so
        // one pin per spot carries the newest hit. The full list is in the sidebar, which this
        // same click has already filtered to this district.
        const bySpot = new Map<string, typeof hits>();
        hits.forEach(ev => {
          const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
          const at = bySpot.get(key);
          if (at) at.push(ev); else bySpot.set(key, [ev]);
        });

        bySpot.forEach(spot => {
          const newest = spot[0];
          // The badge counts PEOPLE, not detections.
          //
          // It used to count detections, and next to a single face that reads as "this person was
          // caught 13 times" — when 13 people caught once each looks identical, because the face
          // shown is only the newest hit's. Those are opposite findings: one is about a person who
          // keeps passing here, the other about a place a lot of people pass. They point at
          // different decisions, so the map must not render them the same.
          //
          // LiveEvent.id is the person id (vcaEventsToLiveEvents resolves personId into it), so
          // repeat sightings of one person collapse here the way they should.
          const people = new Set(spot.map(ev => ev.id)).size;
          const badge = people > 1
            ? `<div style="position:absolute;top:-2px;right:-2px;z-index:3;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;
                  border-radius:999px;background:var(--gray-900);border:1.5px solid white;display:flex;align-items:center;justify-content:center;
                  font-family:'SUIT',sans-serif;font-size:10px;font-weight:800;color:white">${people}</div>`
            : "";
          const icon = L.divIcon({
            html: `<div style="position:relative;width:42px;height:56px">${getMarkerHTML("VIP", getFacePhoto(newest.id))}${badge}</div>`,
            iconSize: [42, 56],
            iconAnchor: [21, 50],
            className: "",
          });
          // Both figures in the popup, where there is room for words. The pin can carry one number
          // and no label; a person reading "3명 · 13건" cannot mistake which is which. Only shown
          // when there is more than one of anything — a single sighting needs no summary.
          const spotSummary = spot.length > 1
            ? `<div style="padding:8px 12px;border-top:1px solid var(--line);font-family:'SUIT',system-ui,sans-serif;
                  font-size:11px;font-weight:600;color:var(--gray-500);letter-spacing:-0.2px">
                 ${t.spotSummary(people, spot.length)}
               </div>`
            : "";
          L.marker([newest.lat, newest.lng], { icon })
            .addTo(group)
            .bindPopup(getPopupHTML(newest, lang) + spotSummary, {
              offset: [0, -50], className: "vca-custom-popup", closeButton: true, autoPan: false, maxWidth: 280,
            });
        });

        // The district's own pill stays, at its centre, and clicking it again clears the filter.
        // Without it the way back out lives only on the sidebar chip: the pill you pressed has
        // vanished, and pressing something to make it disappear and then hunting elsewhere to
        // undo it is the one move a map should never ask for.
        const home = districts?.find(d => d.id === districtFilter);
        if (home) {
          const camerasHere = cameras.filter(c => nearestDistrict(c.lat, c.lng).id === home.id);
          const icon = L.divIcon({
            html: districtPillHtml(
              home.label, hits.length, camerasHere.length,
              camerasHere.some(c => cameraStatus.byId(c.id) === "running"),
              alertThreshold, moderateThreshold, t,
            ),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          L.marker([home.lat, home.lng], { icon })
            .addTo(group)
            .on("click", () => onDistrictSelectRef.current?.(home.id));
        }
      } else if (zoom <= CLUSTER_ZOOM_BREAKPOINT) {
        // ── Zoomed out: one pill per district ──
        districts.forEach((district) => {
          const camerasInDistrict = cameras.filter(c => nearestDistrict(c.lat, c.lng).id === district.id);
          // The dashed pill means "this district's cameras are all down right now" — a coverage
          // gap, which is worth a pin even with nothing to report. Checking run state rather than
          // array length is what captures that.
          const hasOnlineCamera = camerasInDistrict.some(c => cameraStatus.byId(c.id) === "running");
          // Already today-only and already VIP-only (Tracking is a VIP view, not a category) —
          // so this filters on place alone. A hit with no coordinate cannot be placed in a
          // district and is left out rather than guessed at.
          const count = todaysHits.filter(h =>
            h.lat !== undefined && h.lng !== undefined &&
            nearestDistrict(h.lat, h.lng).id === district.id
          ).length;
          // A district with a working camera but zero detections is pure noise ("nothing happened
          // here") — maps that show location pins/badges (Airbnb, Kayak, Expedia, Zillow — checked
          // via Mobbin) only ever put a pin where there's actually something to report, never a
          // "$0"/"0 results" pin. An offline district is a different, still-worth-seeing signal (a
          // coverage gap, not "quiet"), so that dashed pill stays regardless of count.
          // A district with a working camera but zero detections is pure noise ("nothing happened
          // here"). So is a district this site has no cameras in at all: when the header points at
          // a school campus, whose cameras sit inside one district, the other sixteen were drawing
          // "no camera" pins across a city nobody here watches — a coverage gap where there is no
          // coverage to expect, and the one district actually covered was the only pin missing.
          if (camerasInDistrict.length === 0 && count === 0) return;
          if (hasOnlineCamera && count === 0) return;

          const icon = L.divIcon({
            html: districtPillHtml(
              district.label, count, camerasInDistrict.length, hasOnlineCamera,
              alertThreshold, moderateThreshold, t,
            ),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          // No tooltip. `vca-camera-tooltip` sets padding:0 because the camera-dot tooltip supplies
          // its own padded inner box — plain text through the same class renders edge-to-edge and
          // reads as a broken element. Detections-per-camera is worth showing, but not badly, and
          // this map has no tooltip component to host a sentence. The pill's two figures stand on
          // their own until there is one.
          L.marker([district.lat, district.lng], { icon })
            .addTo(group)
            .on("click", () => onDistrictSelectRef.current?.(district.id));
        });
      } else {
        // ── Zoomed in: one dot per camera ──
        // Every camera's location is marked, not just the ones with something to report — a
        // pulsing VIP ping for a hit within the last hour (real elapsed time; "today" was too
        // coarse here — a hit from 9 hours ago is not "recent" even if it's still today), a
        // plain quiet marker everywhere else so the map still reads as "here's where the
        // cameras are," not just "here's where something happened."
        //
        // The site's registered cameras — the same list the device table, the district pills and
        // the availability figure read. This used to iterate a separate ~1,000-entry simulation
        // pool, which put another site's cameras on the map (every entry in it belongs to the
        // smart-city project) and made the zoomed-in map disagree with every other count on
        // screen. The VIP ticker now stamps its detections onto register cameras too, so ping
        // coordinates line up here without a second pool to match against.
        const RECENT_VIP_WINDOW_MS = 60 * 60 * 1000;
        const nowMs = Date.now();
        const recentVipKeys = new Set<string>();
        recentEvents.forEach(ev => {
          if (ev.type !== "VIP") return;
          if (nowMs - new Date(ev.timestamp).getTime() > RECENT_VIP_WINDOW_MS) return;
          recentVipKeys.add(`${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`);
        });

        cameras.forEach(cam => {
          const key = `${cam.lat.toFixed(4)},${cam.lng.toFixed(4)}`;
          const icon = L.divIcon({
            html: recentVipKeys.has(key) ? recentPingHtml(VIP_PING_COLOR) : quietCameraDotHtml(),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          L.marker([cam.lat, cam.lng], { icon })
            .addTo(group)
            .bindTooltip(cameraDotTooltipHtml(cam, lang), { direction: "top", offset: [0, -14], className: "vca-camera-tooltip", opacity: 1 })
            .on("click", () => onCameraSelectRef.current?.(cam.location));
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      group.addTo(mapInstanceRef.current as any);
      zoneLayerRef.current = group;
    });

    return () => { cancelled = true; };
  }, [recentEvents, todaysHits, cameras, zoom, mapReady, alertThreshold, moderateThreshold, districts, lang, districtFilter, cameraStatus, t]);

  // ── District selection → zoom into that district ───────────────
  // Clicking a pill was a list filter and nothing more: the map stayed at island zoom with every
  // other district's pill still on it, so "show me this district" left the map showing everything.
  // Now the same click flies in past the cluster breakpoint, which also swaps the pills for the
  // per-camera layer — and that layer is filtered to this district's VIP pings (see above).
  //
  // Skips the very first pass so an already-set filter on mount does not yank the map before the
  // operator has looked at it; only an actual change moves the view.
  const lastDistrictRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!mapReady) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;
    const previous = lastDistrictRef.current;
    lastDistrictRef.current = districtFilter;
    if (previous === undefined || previous === districtFilter) return;

    if (districtFilter) {
      const district = districts?.find(d => d.id === districtFilter);
      if (district) map.flyTo([district.lat, district.lng], DISTRICT_FOCUS_ZOOM, { duration: 0.8, easeLinearity: 0.5 });
    } else {
      // Cleared — back to the island. Returning to a remembered pre-click view sounds kinder but
      // reads as arbitrary: by then the operator may have panned and zoomed several times, and
      // "back out" landing somewhere they never chose is worse than landing where the map starts.
      map.flyTo(OVERVIEW_CENTER, OVERVIEW_ZOOM, { duration: 0.8, easeLinearity: 0.5 });
    }
  }, [districtFilter, districts, mapReady]);

  // ── Keep the map's internal canvas in sync with its container ───
  // Leaflet only measures its container once on init, so collapsing/expanding the sidebar
  // (which resizes this container without remounting it) leaves stale, cut-off tiles unless
  // told to re-measure.
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;
    const observer = new ResizeObserver(() => {
      (mapInstanceRef.current as { invalidateSize: () => void } | null)?.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Event selection → flyTo + popup (or full route, for Tracking) ─
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    // Remove existing popup / pin marker / route
    if (popupRef.current) {
      (popupRef.current as { remove: () => void }).remove();
      popupRef.current = null;
    }
    if (pinMarkerRef.current) {
      (pinMarkerRef.current as { remove: () => void }).remove();
      pinMarkerRef.current = null;
    }
    trackingRouteLayersRef.current.forEach(l => { try { (l as { remove: () => void }).remove(); } catch { /* noop */ } });
    trackingRouteLayersRef.current = [];

    if (!selectedEvent) return;

    const hops = selectedEvent.type === "Tracking" ? selectedEvent.path : undefined;

    // Dynamically import Leaflet
    import("leaflet").then(({ default: L }) => {
      // ── Tracking: draw the full multi-camera route instead of a single pin ──
      if (hops && hops.length > 0) {
        const nodes = hops.map(h => ({ ...hopToLatLng(h, camerasRef.current), label: h.location + (h.cameraLabel ? ` ${h.cameraLabel}` : ""), time: formatTimeAgo(h.timestamp, lang) }));

        map.flyTo([nodes[nodes.length - 1].lat, nodes[nodes.length - 1].lng], 14, { duration: 0.8, easeLinearity: 0.5 });

        const line = L.polyline(nodes.map(n => [n.lat, n.lng]), {
          color: "var(--primary-400)", weight: 2, opacity: 1, lineJoin: "round", className: "vca-route-line",
        }).addTo(map);
        trackingRouteLayersRef.current.push(line);

        if (nodes.length >= 2) {
          const a = nodes[nodes.length - 2];
          const b = nodes[nodes.length - 1];
          const t = 0.35;
          const arrowLat = a.lat + (b.lat - a.lat) * t;
          const arrowLng = a.lng + (b.lng - a.lng) * t;
          const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
          const arrowIcon = L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;transform:rotate(${bearing}deg)"><path d="M7 1L12.5 12H1.5Z" fill="var(--primary-400)"/></svg>`,
            iconSize: [14, 14], iconAnchor: [7, 7], className: "",
          });
          const arrowMarker = L.marker([arrowLat, arrowLng], { icon: arrowIcon, interactive: false }).addTo(map);
          arrowMarker.setZIndexOffset(50);
          trackingRouteLayersRef.current.push(arrowMarker);
        }

        nodes.forEach((node, i) => {
          const num = String(i + 1).padStart(2, "0");
          const isLast = i === nodes.length - 1;
          const size = isLast ? 44 : 36;

          const circleHtml = isLast
            ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--primary-400);display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:14px;font-weight:700;color:white;box-shadow:0 0 0 10px rgba(90,61,251,0.15)">${num}</div>`
            : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:white;border:2px solid var(--primary-400);display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:13px;font-weight:700;color:var(--primary-400);box-shadow:0 2px 6px rgba(14, 22, 42,0.12)">${num}</div>`;

          const tailCenterY = size / 2;
          const tailHtml = isLast
            ? routeBubbleTailHtml(tailCenterY, "var(--primary-400)", "var(--primary-400)")
            : routeBubbleTailHtml(tailCenterY, "white", "var(--gray-200)");

          const cardHtml = isLast
            ? `<div style="position:relative;font-family:'SUIT',sans-serif;filter:drop-shadow(0 4px 10px rgba(90,61,251,0.25))">
                 ${tailHtml}
                 <div style="position:relative;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1.5px solid var(--primary-400)">
                   <div style="background:var(--primary-400);color:white;font-size:11px;font-weight:800;padding:6px 12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
                     <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M6 0.5L1.5 6.5H5L4.5 10.5L9.5 4.5H6L6 0.5Z" fill="white"/></svg>
                     ${t.lastSeen}
                   </div>
                   <div style="background:white;padding:8px 12px 10px;white-space:nowrap">
                     <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${node.label}</div>
                     <div style="font-size:13px;color:var(--gray-500);margin-top:2px">${node.time}</div>
                     <div onclick="window.__vcaGoRedmapTrace && window.__vcaGoRedmapTrace('${escapeAttr(selectedEvent.name)}')"
                       style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-100);display:flex;align-items:center;gap:4px;
                       font-size:12px;font-weight:700;color:var(--primary-400);cursor:pointer">
                       ${t.fullTrace}
                       <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="var(--primary-400)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                     </div>
                   </div>
                 </div>
               </div>`
            : `<div style="position:relative;background:white;border:1px solid var(--gray-200);border-radius:16px;padding:10px 14px;white-space:nowrap;
                          font-family:'SUIT',sans-serif;box-shadow:0 4px 10px rgba(14, 22, 42,0.08)">
                 ${tailHtml}
                 <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${node.label}</div>
                 <div style="font-size:13px;color:var(--gray-500);margin-top:2px">${node.time}</div>
               </div>`;

          const html = `<div style="display:inline-flex;align-items:flex-start;gap:10px">${circleHtml}${cardHtml}</div>`;
          const icon = L.divIcon({ html, iconSize: [1, 1], iconAnchor: [size / 2, size / 2], className: "" });
          const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
          marker.setZIndexOffset(i * 100);
          trackingRouteLayersRef.current.push(marker);
        });
        return;
      }

      // ── VIP (or Tracking with no path data): single pin + detail popup ──
      const { lat, lng } = selectedEvent;

      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const pinIcon = L.divIcon({
        html: getMarkerHTML(selectedEvent.type, getFacePhoto(selectedEvent.id)),
        iconSize: [42, 56],
        iconAnchor: [21, 50],
        className: "",
      });
      const pinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      pinMarkerRef.current = pinMarker;

      const popup = L.popup({
        offset: [0, -58],
        className: "vca-custom-popup",
        closeButton: true,
        autoPan: false,
        maxWidth: 280,
      })
        .setLatLng([lat, lng])
        .setContent(getPopupHTML(selectedEvent, lang))
        .openOn(map);
      popupRef.current = popup;

      popup.on("remove", () => {
        if (pinMarkerRef.current) {
          (pinMarkerRef.current as { remove: () => void }).remove();
          pinMarkerRef.current = null;
        }
      });
    });
  }, [selectedEvent, mapReady, lang, t.lastSeen, t.fullTrace]);

  // ── Pinned device (SYSTEM tab) → flyTo + marker ────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    if (deviceMarkerRef.current) {
      (deviceMarkerRef.current as { remove: () => void }).remove();
      deviceMarkerRef.current = null;
    }
    if (devicePopupRef.current) {
      (devicePopupRef.current as { remove: () => void }).remove();
      devicePopupRef.current = null;
    }

    if (!pinnedDevice) return;

    import("leaflet").then(({ default: L }) => {
      const { lat, lng } = pinnedDevice;
      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const icon = L.divIcon({
        html: getDeviceMarkerHTML(pinnedDevice.name, pinnedDevice.status === "Live"),
        iconSize: [1, 1],
        iconAnchor: [0, 24],
        className: "",
      });
      deviceMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);

      const zoneName = nearestZoneName(lat, lng, camerasRef.current, t.unknownZone);
      const popup = L.popup({
        offset: [0, -30], className: "vca-custom-popup", closeButton: true, autoPan: false, maxWidth: 220,
      })
        .setLatLng([lat, lng])
        .setContent(getDevicePopupHTML(pinnedDevice, zoneName, lang))
        .openOn(map);
      devicePopupRef.current = popup;
    });
  }, [pinnedDevice, mapReady, lang, t.unknownZone]);

  return (
    <div
      ref={mapRef}
      style={{
        // Read by .leaflet-tile-pane in globals.css. Set here rather than in the stylesheet so an
        // installation can change it through the environment without editing CSS.
        ["--map-tile-filter" as string]: MAP_TILE_FILTER,
        width: "100%",
        height: "100%",
        position: "relative",
        // Matches SkeletonDashboard's MapSkeleton background — avoids a flash of blank white
        // during the brief window between mount and Leaflet's async init finishing.
        backgroundColor: "var(--gray-100)",
      }}
    />
  );
}
