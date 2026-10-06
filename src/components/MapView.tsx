"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveEvent, Device, TrackingHop, getFacePhoto, formatTimeAgo,
  DISTRICT_ALERT_THRESHOLD_KEY, DISTRICT_MODERATE_THRESHOLD_KEY,
  DEFAULT_DISTRICT_ALERT_THRESHOLD, DEFAULT_DISTRICT_MODERATE_THRESHOLD, districtIdAt,
  districtIdForCameraZone } from "@/lib/mockData";
import {
  vcaEventsToLiveEvents,
  useProjectEvents, useProjectCameras, todaysDetectionHits, useDashboardPanels, hasPosition, type Camera,
} from "@/lib/vcaStore";
import { useCameraStatus, runStateOf } from "@/lib/realtime/cameraStatus";
import { useApiData } from "@/hooks/useApiData";
import { getDistricts } from "@/lib/api/dashboard";
import { isTodaySgt } from "@/lib/time";
import { MAP_TILE_URL, MAP_TILE_FILTER, tileLayerOptions } from "@/lib/mapTiles";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

/**
 * THE SHAPE SCALE IN THIS FILE IS WRITTEN AS `var(--radius-*)`, NOT `RADIUS.*`.
 *
 * Everything below builds its markup as HTML strings handed to Leaflet (divIcon / bindPopup), so
 * there is no style object for a TypeScript constant to reach — a template literal would have to
 * interpolate it into every rule. globals.css publishes the same five values as custom properties
 * for exactly this case; the two definitions are kept in step by hand (src/components/shared/
 * controls.ts carries the reasoning for the scale itself).
 *
 * Custom properties DO resolve here, because these are CSS declarations inside a style attribute.
 * The one place in this app where `var()` silently fails is an SVG presentation attribute
 * (fill="var(...)"), which is why the markers below still pass colours into `stroke`/`fill` as
 * plain tokens rather than through a property.
 */

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
    /**
     * Heading for the other people caught at this camera, listed under the newest one's card.
     *
     * The pin stacks their faces, so the map already promises more than one person. The popup
     * used to answer that with a single summary line — a count, and a card about one of them,
     * which reads as "here is the person" over a pin that had just said there were four.
     */
    alsoHere: (n: number) => `${n} more here today`,
    /**
     * The headcount beside a camera dot or a district spot.
     *
     * Carries its noun. The figure sat on a portrait before and was read as being about that
     * face ("caught 3 times"); beside a dot it is about the dot, and the word removes the last
     * bit of guessing about what is being counted.
     *
     * That part is not negotiable: "3" alone among camera dots is a bare "3 what?".
     *
     * BUT NOT ITS WINDOW, any more. It read "3 people today" and the word came off by decision —
     * it was repeated on every pill on the screen (measured: nine at once on one view), and
     * "today" is a property of this whole LAYER, not of each dot. A fact that is true of every
     * mark on a layer is one the layer states once, not once per mark.
     *
     * NOT because it crowded. That was claimed and then measured, and the claim was false: with
     * the word, this pill was 81.6px in English and 48.5px in Korean, against 103.4–109.6px for
     * the district pills sitting beside it on the same map. The crowding recorded in `hitsMark`
     * above is real, but that is a COMPOSITE pill — label, figure, unit and camera count
     * competing in one box — and its history was carried onto this one-figure pill without being
     * re-measured. Do not re-justify this on width.
     *
     * THE WINDOW STILL HAS TO BE SAID SOMEWHERE, because a bare number beside a pulsing ring
     * reads as "now", and the ring means the LAST HOUR while the figure means TODAY (see
     * `peopleByCamera`, which defends running two windows on one dot on exactly that ground). It
     * moved to the camera dot's own hover, as `peopleToday` below: the glance gets the count, the
     * hover gets the whole statement.
     *
     * AND ITS KNOWN COST, which this change does not fix: a hover cannot fix a glance — the
     * people who misread the figure are the people who never hover. That objection was put
     * against this move and it is accepted, not answered. If it bites, the answer is a stated
     * window for the layer, one line and once, not the word back on every dot.
     *
     * Both layers count today only — the camera layer from `todaysDetectionHits`, the district
     * layer through `inDistrictToday` — so the window is true wherever it is shown. Only the
     * camera layer has a hover to show it in: the district-spot marker binds a POPUP, whose
     * `spotSummary` line already says "today" with both figures — though only above one
     * detection, which is that line's own gate. At exactly one, the window on that layer is the
     * card's "LAST SEEN <time ago>" and nothing else. Left as it is rather than printing "here
     * today: 1 person · 1 detection" under a card that has just said both.
     *
     * The plural branch is not politeness. The camera layer draws this at `people > 0`, not
     * `> 1`, so "1 people" was on screen — measured on one map: 3 of 11 pills. A figure that is
     * visibly broken is a figure an operator stops trusting, and that discredits the correct
     * ones beside it. `spotSummary` below already had the ternary; this site just never got it.
     */
    peopleAt: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    /** The same headcount with the window the pill no longer carries — see peopleAt. Hover only. */
    peopleToday: (n: number) => `${n} ${n === 1 ? "person" : "people"} today`,
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
    /**
     * The chip sitting on a stretch of trail whose stops could not be drawn.
     *
     * It carries the stops' NUMBERS, because the numbers are the only handle anyone has on them:
     * the trail keeps its gap in the numbering (see placedNodes below), and this chip is what
     * says the gap is a stop rather than a counting mistake. A dashed line on its own would not —
     * a dashed segment on a map already means "estimated route", so without the label the reader
     * is told the opposite of the truth: that we know the path, not that we are missing a stop.
     *
     * No warning colour. A missing coordinate is a blank in the camera register, not a camera
     * fault, and in a control room yellow gets a fault reported that nobody can find.
     *
     * AND NO COUNT, in either language. The many-stop form used to end in a bare `· 3` in English
     * and a `3곳` in Korean, and the figure was wrong in both for the same reason: the missing
     * numbers inside one gap are always CONTIGUOUS — the call site builds them with
     * `for (n = prev.num + 1; n < cur.num; n++)` — so `01–03` already says there are three of
     * them, and the chip's own tooltip then names each one with its time. Three statements of one
     * fact, of which the range and the names are the two anybody asked for.
     *
     * The English figure was also unitless, which is the defect `hitsMark` and `peopleAt` above
     * exist to avoid. Deleting it answers that without adding a word, so the question was never
     * "what unit should the 3 get".
     *
     * The two forms now differ only in what the numbers are — one stop, or a range of them — which
     * is what keeps two chips on one map from counting differently. A trail-wide figure does still
     * exist and it is a DIFFERENT quantity: `noCoordsSummary` counts every unplaced stop on the
     * trail, including a missing first or last one, which has no chip at all. Adding chips up
     * could therefore never have matched it; now there is nothing to add up.
     */
    noCoordsChipOne: (num: string) => `${num} No coordinates`,
    noCoordsChipMany: (from: string, to: string) => `${from}–${to} No coordinates`,
    noCoordsWhy: "No coordinates on record, so it cannot be drawn",
    /**
     * The one line over the map, shown only when the chips can't carry the message on their own —
     * three or more gaps, or a missing end. See the call site for why those two cases and no others.
     */
    noCoordsSummary: (missing: number, total: number) => `${missing} of ${total} points have no coordinates`,
  },
  ko: {
    camerasShort: (n: number) => `${n}대`,
    hitsMark: () => "",
    hitsUnit: () => "건",
    noCamera: "카메라 없음",
    camerasDown: "전부 중단",
    spotSummary: (people: number, hits: number) => `이 지점 오늘 ${people}명 · ${hits}건`,
    alsoHere: (n: number) => `이 지점의 다른 ${n}명`,
    // 알약에서 "오늘"을 뗍니다 — 이유는 영어 peopleAt 주석에 적힌 그것 그대로이고, 한국어만
    // 다를 이유가 없습니다(폭은 상관이 없었습니다 — 48.5px이었습니다). 세는 말 `명`은 남습니다:
    // 점 옆의 숫자가 무엇을 센 것인지는 한국어에서도 이 한 글자가 말합니다.
    peopleAt: (n: number) => `${n}명`,
    // 호버로 옮긴 온전한 문장. 범위를 앞에 둡니다 — 위 spotSummary("이 지점 오늘 …")가 이미
    // 세운 어순이고, 한국어는 이 자리에서 수를 세는 조사가 따로 없어 1명도 그대로 맞습니다.
    peopleToday: (n: number) => `오늘 ${n}명`,
    live: "정상",
    out: "중단",
    offline: "중단",
    captured: "감지 이미지",
    registered: "등록 이미지",
    capturedFrame: "감지된 프레임",
    analyzeFrame: "프레임 분석",
    outSince: (when: string) => `${when}부터 중단`,
    viewLive: "베스트 프레임에서 실시간 보기",
    lastSeen: "마지막 감지",
    fullTrace: "레드맵에서 전체 경로 보기",
    noCoordsChipOne: (num: string) => `${num} 좌표 없음`,
    // 개수를 뺀 이유는 영어와 다릅니다. 이쪽은 단위가 없던 적이 없습니다 — `3곳`은 세는 말을 달고
    // 있었습니다. 뺀 이유는 번호가 연속이라 `01–03`이 이미 "세 곳"이라고 말한다는 것 하나입니다.
    // 영어만 고치고 여기를 두면 한 지도의 알약 둘 중 한쪽만 개수를 셉니다.
    noCoordsChipMany: (from: string, to: string) => `${from}–${to} 좌표 없음`,
    noCoordsWhy: "좌표가 등록되지 않아 지도에 표시할 수 없습니다",
    noCoordsSummary: (missing: number, total: number) => `${total}곳 중 ${missing}곳은 좌표가 없어 지도에 없습니다`,
  },
} as const;

/**
 * TWO ESCAPES, BECAUSE THERE ARE TWO CONTEXTS. Everything Leaflet draws here is a raw HTML string
 * rather than React, so every value this file interpolates is being handed to a parser.
 *
 * `escapeHtml` is for a value that becomes TEXT — a person's name, a camera's name, a zone, a
 * district's label. It is the entity encoding, and it is what keeps `<`, `&` and a quote from
 * being read as markup instead of as characters.
 *
 * `escapeAttr` below is for the argument of an inline `onclick="f('…')"`, and it is a different
 * problem with a different answer: it backslash-escapes for a JAVASCRIPT STRING LITERAL. A value
 * there passes through two decoders — the HTML attribute parser first, the JS parser second — so
 * entity-encoding alone does not protect it (`&#39;` is decoded back to `'` before the JS is ever
 * parsed, and the literal then ends early), and backslash-escaping alone does not protect the
 * attribute (a `"` in the value still closes it). The onclick sites therefore compose both, in
 * that order: JS-escape, then entity-encode what that produced.
 *
 * WHY THIS MATTERS ON MOCK DATA. Nothing here is exploitable today, because these names are seeds.
 * But they are the fields the server and the CSV import fill, and a camera register is typed by
 * people — so "the values happen to be safe" is a property of this week's fixture, not of the
 * code. A single escaped site is also worse than none: it is how the next reader concludes the
 * pattern is already handled (which is why the `onclick` argument was escaped and the fourteen
 * text sites were not).
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;");
}

function escapeAttr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** The onclick-argument treatment: a JS string literal, then the attribute that carries it. */
function escapeOnclickArg(s: string): string {
  return escapeHtml(escapeAttr(s));
}

/**
 * A match confidence as a printable figure, or nothing at all.
 *
 * THE HONEST FALLBACK FOR A MISSING CONFIDENCE IS NO FIGURE, NOT A ZERO. This is the same rule as
 * the coordinates: `?? 0` on a lat/lng put a pin in the Gulf of Guinea, and `?? 0` on a confidence
 * prints "0%", which is not an absence — it is a specific claim that the system recognised this
 * face at no confidence whatsoever. The popup printed `${event.confidence}%` unguarded.
 *
 * ZERO IS HOW AN ABSENCE ARRIVES HERE, which is why the test is on the value rather than on a flag.
 * `LiveEvent.confidence` is a required `number` (mockData.ts), so nothing upstream can hand this
 * function `undefined` even when that is the truth: the absent case reaches it as a 0 written by
 * one of the fills — `vcaEventsToLiveEvents`'s `?? 0` at the store boundary, or the placeholder 0
 * both producers write on a Tracking row (deriveLiveEvents and addEvent), where the real figures
 * live one per hop and the trail as a whole has no confidence to state. No detector reports a 0%
 * match AS a match, so there is no reading of 0 here that is a measurement.
 *
 * AND IT IS NOT UNIVERSALLY TRUE, so it is scoped. A 0 would be a real value for a detection with
 * nothing to match against — a vehicle, an unidentified person — and `EventType` here is
 * "VIP" | "Tracking" only (mockData.ts:241), so that case cannot reach this map; Best Frame's own
 * detection type is where Vehicle/Unknown live, and it renders its own figures. The day those
 * types join LiveEvent, the value stops being able to carry the distinction and the field has to
 * become optional — which is a change to mockData.ts and to every consumer of it (Sidebar, Navbar,
 * BestFrame), not to this file.
 */
function confidenceFigure(confidence: number): string | null {
  return Number.isFinite(confidence) && confidence > 0 ? `${confidence}%` : null;
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

// Same 22px hit box as recentPingHtml (so both anchor identically), but everything visible is
// dialled down: no expanding ring, a 12px box against the ping's 14px, a 1.5px casing against
// 2px, and gray-600 rather than gray-700. box-sizing is border-box globally, so the casing eats
// into the width and the visible fill lands at 9px.
//
// It was drawn at the ping's own weight, with the same double-ring casing, fifty-nine times over.
// That is louder than a camera with nothing to report should ever be, and a field of identical
// ringed dots reads as a texture rather than as places — see .vca-map-dot-quiet in globals.css.
function quietCameraDotHtml(): string {
  return `
    <div class="vca-camera-dot-hit" style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;transform:translateX(-50%) translateY(-50%)">
      <div class="vca-camera-dot-visual vca-map-dot-quiet" style="position:relative;width:12px;height:12px;border-radius:50%;background:var(--gray-600);transition:transform 0.15s ease"></div>
    </div>`;
}

// Hover tooltip for a zoomed-in camera dot — same name+status-badge+zone shape as the System
// panel's device pin popup (getDevicePopupHTML above), just triggered on hover instead of click
// and sourced from Camera's own fields (a Camera and a System-panel Device are separate mock
// pools in this app, not joinable by anything reliable — see the camera-data-pool-consolidation
// notes elsewhere — so this reads Camera's own status/zone rather than trying to cross-reference).
function cameraDotTooltipHtml(cam: Camera, lang: AppLanguage, people: number): string {
  const t = T[lang];
  const isLive = runStateOf(cam.status) === "running";
  /**
   * TODAY'S HEADCOUNT, WITH ITS WINDOW. The pill on the dot carries the bare figure now (see
   * peopleAt), so this hover is where the sentence is completed — and the tooltip had no figure
   * at all before, only name, status and zone.
   *
   * Hidden at zero rather than shown as "0 people today". A camera with nobody at it is already
   * saying that by wearing the quiet dot and no pill; a written zero reads as a measurement,
   * which for a camera whose hits attach by neither label nor coordinate would be a false one.
   * The no-detection call site below passes 0 for exactly that reason.
   *
   * Above the zone, not below it: name and zone are the camera's identity and belong together,
   * and the hairline marks that what follows is a finding rather than a field. `--line` is the
   * same rule the popups' own dividers use.
   */
  const peopleLine = people > 0
    ? `<span style="font-size:11px;font-weight:700;color:var(--gray-700);white-space:nowrap;
          border-top:1px solid var(--line);margin-top:2px;padding-top:4px">${t.peopleToday(people)}</span>`
    : "";
  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:120px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;white-space:nowrap">${escapeHtml(cam.name)}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:var(--radius-pill);flex-shrink:0;color:${isLive ? "var(--success-400)" : "var(--warning-500)"};background:${isLive ? "var(--success-100)" : "var(--warning-100)"}">
          ${isLive ? t.live : t.offline}
        </span>
      </div>
      <span style="font-size:10px;font-weight:600;color:var(--gray-500);white-space:nowrap">${escapeHtml(cam.zone || cam.location)}</span>
      ${peopleLine}
    </div>`;
}

// Zoomed out (zoom <= breakpoint) shows district cluster pills (real counts, computed below);
// zoomed in past it shows the per-camera recent-activity dots instead — the same breakpoint
// idea as RedmapMap's tracking-route decluttering, just gating which layer draws at all.
const CLUSTER_ZOOM_BREAKPOINT = 14;
/**
 * How recent a detection has to be for its dot to PULSE.
 *
 * Motion means "recently" everywhere in this product, so the ring is the one mark on this map
 * that makes a claim about now — and it has to be a claim the data supports. "Today" is too
 * coarse: a hit from nine hours ago is not recent even though it is still today.
 *
 * Module scope because BOTH dot layers answer to it. It used to live inside the zoomed-in camera
 * branch, and the picked-district branch — which draws the same `recentPingHtml` ring — had no
 * time gate at all, so every hit spot in a selected district pulsed however old it was.
 */
const RECENT_VIP_WINDOW_MS = 60 * 60 * 1000;
/** Where a district pill flies you to. One past the cluster breakpoint, so the pills give way to
 *  the per-camera layer as part of the same movement rather than needing a second zoom. */
const DISTRICT_FOCUS_ZOOM = 15;
/**
 * Where a trail with nothing to fit lands.
 *
 * A Tracking selection used to fly to its newest stop at a bare `14` — no constant, no comment —
 * and that one number failed in both directions. Measured at 1600x1000, map container x 380-1600:
 * Dr. Sarah Chen's two stops put node 01's centre at x=1995, 395px past the right edge, with the
 * trail line running off that edge and nothing saying it continued; Michael Tan's three stops left
 * TWO centres outside the frame (x=2021 and x=2300) and drew one stop out of three. At the other
 * end, James Wilson's two Geylang cameras (NC1 -> NC2, 221m apart) landed 22.7px apart while the
 * circles are 44px and 36px across — the two stops sat on top of each other, the 15x17px of line
 * between them was underneath them, and their two cards overlapped across 6,798px².
 *
 * Fitting the trail's own bounds answers both, and in OPPOSITE directions: a wide trail is pulled
 * back until every stop is in the frame, and a trail whose stops are one street apart is pushed IN
 * until they separate, because every zoom level roughly doubles the pixels between them. Which is
 * why the ceiling below is a ceiling on the fit and not the fix for the crowding — the crowding is
 * fixed where it is caused, by the stop cards (see the node loop: one card per trail now, the rest
 * hover). A cap chosen to "stop two dots zooming to street level" would have been the one change
 * guaranteed to keep them on top of each other.
 *
 * WHY THERE IS STILL A CEILING. Past a point the extra levels separate nothing that was still
 * colliding. What the fit has to clear is the trail-end card: 187px wide, opening 32px to the
 * right of its node, so a neighbouring stop is covered when it lands within ~219px of it. For the
 * closest genuine pair in the register — Geylang NC1/NC2, 221m apart — 18 puts 242px between the
 * centres, which clears that; 19 puts 740px there (measured), which buys nothing and spends the
 * street context that says WHICH part of Geylang this is. Above that the tile source's own maximum
 * applies anyway (MAP_MAX_ZOOM, handed to the map by the tile layer), and that is the right home
 * for that kind of limit: an installation serving its own GIS tiles knows how far in it can draw.
 *
 * AND A ZOOM FOR NOTHING-TO-FIT: one drawable stop, or every stop on one coordinate (two camera
 * labels on one pole). There the bounds are a point, `getBoundsZoom` computes a scale from a
 * zero-sized rectangle and returns Infinity, and leaflet 1.9.4 hands that to `setView` unless a
 * `maxZoom` clamps it with `Math.min(options.maxZoom, zoom)` (_getBoundsCenterZoom) — so this is
 * also the guard against a blank map in the case with the least information. 15 rather than the
 * ceiling because "one place" already has an answer twice in this file: DISTRICT_FOCUS_ZOOM, and
 * the zoom a selected VIP pin flies to. One stop of a trail is that same picture.
 *
 * WHAT NEITHER NUMBER CAN DO: two cameras metres apart. The fit would need a zoom no tile source
 * has, and their 36px circles touch whatever it does. That case is a card-and-marker problem, not
 * a framing one.
 */
const TRAIL_FIT_MAX_ZOOM = 18;
const TRAIL_ONE_SPOT_ZOOM = 15;
/**
 * The band each edge keeps to itself while a trail is fitted into the map.
 *
 * Asymmetric because the furniture is. Measured at 1600x1000, relative to the map container:
 *  - LEFT: the sidebar collapse toggle overhangs the map's left edge by 31px (34px wide at
 *    left:-3px, vertically centred), and a stop's circle reaches 22px left of the point it is
 *    anchored to -> 53, rounded to 56.
 *  - TOP: the zoom control's box is 90px deep (80px tall at a 10px inset), plus the same 22px of
 *    circle -> 112.
 *  - RIGHT: the stop cards open to the RIGHT of their node. The trail-end card measures 187x124
 *    and starts 32px right of the node's centre (22px of circle + a 10px gap), so it ends at
 *    +219 -> 232 with a little air for its shadow.
 *  - BOTTOM: the collapsed "Today's detections by hour" pill occupies the bottom 60px (36px tall
 *    at a 24px inset) and the trail-end card hangs 102px below its node -> 162, rounded to 164.
 *
 * NOT the sidebar itself: it sits beside this container, not over it (measured — the map starts at
 * x=380 and the sidebar ends at 379), and collapsing it resizes the container instead.
 *
 * WHAT THIS DOES NOT COVER, stated. The detection chart EXPANDED measures 1172x270 at a 24px
 * inset, covering the bottom 294px of the map across its full width; no bounds padding can reserve
 * that without spending a third of the frame on a panel that is usually shut. And a long name
 * widens the trail-end card past the 187px above (248px at 28 characters, 292px at 33), so the
 * reservation runs out exactly where the name is long. Anchoring that card on whichever side has
 * room is the fix for both, and it is a decision about the card rather than about this flight.
 */
const TRAIL_FIT_PADDING_TOP_LEFT: [number, number] = [56, 112];
const TRAIL_FIT_PADDING_BOTTOM_RIGHT: [number, number] = [232, 164];
/**
 * Those two, capped against the container they have to fit inside.
 *
 * `getBoundsZoom` subtracts the padding from the container size and divides the bounds by what is
 * left — so padding wider than the map makes that scale negative, `getScaleZoom` returns NaN, and
 * nothing in Leaflet catches it: `setView(center, NaN)` leaves a blank map. Not theoretical. This
 * container is the window minus the 380px sidebar (measured: 1600 -> 1220, 1280 -> 900, 1024 ->
 * 644, 900 -> 520, 640 -> 260), so a narrow window really does drop below the 288px reserved
 * across. A third of the axis is the cap: past that the number has stopped being furniture
 * clearance, and a frame that is slightly tight beats one that is blank.
 */
function trailFitPadding(size: { x: number; y: number }): {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
} {
  const cap = (want: number, available: number) => Math.min(want, Math.max(0, Math.floor(available / 3)));
  return {
    paddingTopLeft: [cap(TRAIL_FIT_PADDING_TOP_LEFT[0], size.x), cap(TRAIL_FIT_PADDING_TOP_LEFT[1], size.y)],
    paddingBottomRight: [cap(TRAIL_FIT_PADDING_BOTTOM_RIGHT[0], size.x), cap(TRAIL_FIT_PADDING_BOTTOM_RIGHT[1], size.y)],
  };
}
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
  // null = this pill may not make a camera claim at all. See sayableCameraCount at the call
  // sites: under a district name the list holds more than once, "no camera" and "6 cams" are
  // both assertions the app cannot stand behind.
  cameraCount: number | null,
  hasOnlineCamera: boolean,
  alertThreshold: number,
  moderateThreshold: number,
  t: (typeof T)[AppLanguage],
): string {
  const isAlert = count >= alertThreshold;
  const isDark = !isAlert && count >= moderateThreshold;
  // No camera registered here at all — a coverage gap, not a quiet district. An unsayable count
  // (null) is NOT this: it is "we cannot tell", and drawing it as a coverage gap is the false
  // claim this parameter exists to stop.
  const isUncovered = cameraCount === 0;
  // Dashed = this district's camera(s) are offline, not "no camera was ever installed here".
  const isDashed = cameraCount !== null && !isUncovered && !hasOnlineCamera;
  let bg: string, textColor: string, border: string;
  if (isAlert)      { bg = "var(--danger-400)"; textColor = "white";   border = ""; }
  else if (isDark)  { bg = "var(--gray-900)"; textColor = "white";   border = ""; }
  // Offline cameras aren't as urgent a signal as a real, nonzero VIP count — purple is reserved
  // for things that actually need attention, so this stays a neutral gray instead.
  else if (isDashed || isUncovered) { bg = "white"; textColor = "var(--gray-500)"; border = "border:1.5px dashed var(--gray-300);"; }
  // The quiet state is the hairline, not purple. Most of the seventeen districts are quiet at any
  // moment, so a purple border here meant a map of a dozen purple pills — and purple ended up
  // meaning "normal", which is the opposite of what the line above reserves it for. Solid vs
  // dashed still separates "has cameras" from "has none".
  else              { bg = "white";   textColor = "var(--gray-700)"; border = "border:1.5px solid var(--line);"; }
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
  // TWO HALVES, EACH DRAWN ONLY WHEN IT CAN BE SAID.
  //
  // This used to be a three-way choice — "no camera", OR "all down", OR the figures — and the
  // first two branches replaced the detection count rather than sitting beside it. So the one
  // pill a coverage decision is looking for was the one pill with no number on it: an uncovered
  // district is only ever DRAWN because count > 0 (see the skip rules at the call site), which
  // means "no camera" always covered up a real, nonzero figure. Measured 2026-09-29 on the
  // running dashboard: the Geylang pill read "no camera" and nothing else while clicking it
  // filtered the events list from 80 rows to 15.
  //
  // So: the figure when there is one, the camera note when there is one, and a middot only when
  // both are there. The figure is still withheld at zero — a dashed "all down" pill draws
  // whatever its count, and "VIP ×0" reads as "nothing happens here" when it means "nothing
  // could be seen here", which is the sentence this pill exists to avoid.
  const sep = `<span style="font-size:11px;font-weight:500;opacity:0.62">&nbsp;·&nbsp;</span>`;
  // Named, and no longer a fraction. It used to read "1 / 5 cams", which says neither what
  // the 1 is nor what it is 1 of — and a slash between two figures reads as "1 OF 5 cameras",
  // a different and wrong claim. So: the word VIP in front, the unit behind the number, and a
  // middot instead of the slash, because the camera count sits beside this figure rather than
  // under it. The figure stays the biggest thing on the pill — you find a district by
  // position and then read its number.
  // The mark reads with the figure rather than as a separate word, so it stays close — but
  // not touching. Set flush it collided with the number: a 10px × has almost no side bearing
  // and the 14px 800-weight digit starts immediately, so the two glyphs ran together. 2px is
  // the smallest gap that separates them without turning the mark into its own token.
  const vipFigure = count > 0
    ? `<span style="font-size:10px;font-weight:700;opacity:0.82;letter-spacing:0.2px;margin-right:3px">VIP</span>` +
      (t.hitsMark() ? `<span style="font-size:10px;font-weight:600;opacity:0.62;margin-right:2px">${t.hitsMark()}</span>` : "") +
      `<span style="font-size:14px;font-weight:800;letter-spacing:-0.3px">${count}</span>` +
      // The unit gets its own 2px, for the same reason the mark in front of the figure does: a
      // 14px 800-weight digit carrying -0.3px tracking runs straight into an 11px glyph set
      // flush against it, and "3건" came out as one crowded shape. Split from the separator so
      // only the languages that HAVE a unit pay for it — English's is empty, and a margin there
      // would push the middot instead.
      (t.hitsUnit() ? `<span style="font-size:11px;font-weight:500;opacity:0.62;margin-left:2px">${t.hitsUnit()}</span>` : "")
    : "";

  // cameraCount IS THE INSTALLED COUNT, DELIBERATELY. It was nearly changed to "cameras that
  // actually caught someone", which is a different and much worse pill. Two reasons, both
  // load-bearing: 29 hits from 3 cameras and 29 from 40 are opposite findings, and this
  // figure is what a customer takes upstairs to argue for more cameras (see
  // project_vca_district_vip_count) — that comparison only holds if the denominator is what
  // is installed. And `isUncovered` is `cameraCount === 0`: fed a detecting count, a district
  // with six working cameras and a quiet morning would draw itself as "no camera", turning a
  // coverage gap into something indistinguishable from silence. The people-and-cameras figure
  // the operator asked for lives on the line below, in the picked-district pill, where there
  // is room to label both.
  //
  // NOTHING AT ALL when the count is null. Silence is the whole point: see sayableCameraCount.
  const cameraNote = cameraCount === null
    ? ""
    : isUncovered
      ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;opacity:0.85">${camSvg}${t.noCamera}</span>`
      : isDashed
        ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;opacity:0.85">${camSvg}${t.camerasDown}</span>`
        : `<span style="font-size:11px;font-weight:500;opacity:0.62">${t.camerasShort(cameraCount)}</span>`;

  const secondLine = [vipFigure, cameraNote].filter(Boolean).join(sep);

  /* The quiet plate is a chip sitting just off the surface, which is exactly what
     --shadow-raised is for (globals.css, the three-token note) — it was the one hand-mixed
     rgba() in this file that already had a token waiting for it.

     THE DARK/ALERT BRANCH KEEPS ITS LITERAL. There is no token at that weight, and the weight is
     doing a job: this plate lands on the customer's own GIS tiles, which may be anything from
     near-white to a dense colour map, and a --gray-900 plate under a 0.12 shadow does not read as
     sitting on top of anything (the same argument globals.css makes for .vca-map-dot). Inventing
     a step for it would be the thing we are not allowed to do — see the handover note. */
  const shadow = isDark || isAlert ? "0 2px 10px rgba(24, 17, 39,0.2)" : "var(--shadow-raised)";
  return `<div style="transform:translateX(-50%) translateY(-50%);display:inline-flex;flex-direction:column;
      align-items:center;gap:1px;background:${bg};${border}border-radius:var(--radius-panel);padding:5px 10px;
      font-family:'SUIT',system-ui,sans-serif;color:${textColor};box-shadow:${shadow};
      white-space:nowrap;letter-spacing:-0.2px">
    <span style="font-size:11px;font-weight:600;opacity:0.78">${escapeHtml(label)}</span>
    <span style="display:inline-flex;align-items:baseline">${secondLine}</span>
  </div>`;
}

function getPopupHTML(event: LiveEvent, lang: AppLanguage): string {
  const t = T[lang];
  const typeColor = event.type === "VIP" ? "var(--primary-400)" : "var(--type-tracking)";
  const typeBg = event.type === "VIP" ? "var(--primary-50)" : "var(--type-tracking-100)";
  const photoUrl = getFacePhoto(event.id);
  const confidence = confidenceFigure(event.confidence);
  const vipBadge = event.type === "VIP"
    ? `<div style="background:var(--primary-50);border-radius:var(--radius-pill);padding:2px 8px;display:flex;align-items:center;gap:3px;flex-shrink:0">
         <span style="font-size:9px;font-weight:700;color:var(--primary-400)">VIP</span>
       </div>`
    : `<div style="background:${typeBg};border-radius:var(--radius-pill);padding:2px 8px;flex-shrink:0">
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
          <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;line-height:1.3">${escapeHtml(event.location)}${event.cameraLabel ? ` · ${escapeHtml(event.cameraLabel)}` : ""}</span>
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
        <span style="font-size:13px;font-weight:700;color:var(--gray-900);letter-spacing:-0.26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(event.name)}</span>
      </div>

      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:var(--radius-inner);background:var(--gray-100);overflow:hidden">
            <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
          </div>
          <span style="font-size:10px;color:var(--gray-400);display:block;margin-top:4px;letter-spacing:-0.2px">${t.captured}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:20px">
          ${confidence === null
            // No figure: the two rules become one, and the card still shows that these two
            // pictures are the same match. A "0%" here would say the system matched this face at
            // no confidence at all, which is a specific claim and a false one.
            //
            // NOT the shared ScoreBadge, and a design audit flagged it as one (2026-10-02). The
            // badge is a chip that sits on a row among other chips; this is a LABEL ON A
            // CONNECTOR — a dashed rule, the figure, another dashed rule — and the three together
            // are what say "these two faces are one match". Dropping a filled pill into the
            // middle of that breaks the device and leaves the rules pointing at nothing. The
            // tooltip figure elsewhere in this file is not a score at all; it is a count of
            // people seen today.
            ? `<div style="width:44px;border-top:1.5px dashed var(--gray-300)"></div>`
            : `<div style="width:44px;border-top:1.5px dashed var(--gray-300)"></div>
               <span style="font-size:11px;font-weight:700;color:var(--gray-500);letter-spacing:-0.22px">${confidence}</span>
               <div style="width:44px;border-top:1.5px dashed var(--gray-300)"></div>`}
        </div>
        <div style="text-align:center">
          <div style="width:60px;height:60px;border-radius:var(--radius-inner);background:var(--info-200);display:flex;align-items:center;justify-content:center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="var(--primary-300)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="var(--primary-300)" stroke-width="2"/></svg>
          </div>
          <span style="font-size:10px;color:var(--gray-400);display:block;margin-top:4px;letter-spacing:-0.2px">${t.registered}</span>
        </div>
      </div>

      <div style="background:var(--gray-900);border-radius:var(--radius-inner);height:96px;overflow:hidden;position:relative">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(24, 17, 39,0.8), rgba(24, 17, 39,0) 55%)"></div>
        <span style="position:absolute;bottom:8px;left:10px;font-size:9px;color:rgba(255,255,255,0.85);font-weight:700;letter-spacing:0.5px">${t.capturedFrame}</span>
      </div>

      <button onclick="window.__vcaGoAnalyzeFrame && window.__vcaGoAnalyzeFrame('${escapeOnclickArg(event.location)}')"
        style="margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:var(--gray-900);color:white;border:none;border-radius:var(--radius-control);padding:8px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        ${t.analyzeFrame}
      </button>
    </div>
  `;
}

/**
 * The pin for the selected detection: face photo, coloured casing, tail, dot.
 *
 * DELETED: two halo circles behind the photo and the `.vca-vip-flash` keyframes that pulsed
 * them. They never rendered. The fill was built as `${color}14` / `${color}26` — a hex alpha
 * suffix appended to the colour — which works for a literal (`#5a3dfb` + `14`) and stopped
 * working the day the palette became tokens (`975248e`, 2026-08-25), because the declaration
 * then resolved to `background: var(--primary-400)14`. `var()` substitution is not string
 * concatenation: the suffix invalidates the whole declaration and the browser drops it. Measured
 * in Chrome — `rgba(0, 0, 0, 0)`. So the halo worked for the 15 days between `218ba1f` and
 * `975248e`, and animated two fully transparent circles for the 23 after.
 *
 * (NOT the same trap as var() inside an SVG attribute, which does work here — 202 places rely
 * on it. This one was about concatenating onto a var() in a CSS value.)
 *
 * NOT RESTORED, AND NO TRANSLUCENT TOKEN WAS REQUESTED. Three reasons, none of them the missing
 * token:
 *
 * 1. A pulse here would claim liveness about a record. This pin is drawn for a SELECTED past
 *    detection carrying a wall-clock timestamp, and every other pulse in the product is gated on
 *    a fact about now (`.vca-alert-ping` on RECENT_VIP_WINDOW_MS, Best Frame's dot and label glow
 *    on a VIP still in frame). This one had no time gate at all — only `type === "VIP"`.
 * 2. Worse, the pixel was already taken. The pin lands on its camera's own coordinate and the
 *    flyTo goes to zoom 15, past CLUSTER_ZOOM_BREAKPOINT, so the camera-dot layer is live and its
 *    `.vca-alert-ping` is running on the same point in the same `--primary-400` — saying
 *    "somebody was seen at this camera in the last hour", which for a morning selection is a
 *    different detection. Two purple pulses on one point at 0.9s and 1.6s, one of them unfounded,
 *    and no way to tell which meant what. `globals.css`'s `.vca-auth-pulse` note already wrote
 *    the rule: borrowing the blink vocabulary costs the real blinks their meaning.
 * 3. The original rationale never matched this screen. `218ba1f` sold it as making VIP arrivals
 *    "easy to spot on the map at a glance" — but this function had exactly one call site in that
 *    same commit, the selected event, as it still does. There was never a scanning problem here:
 *    the selection is the operator's own click, the map flies to it, and it is the only face
 *    among ~60 markers with a detail card opening over it.
 *
 * The `type` parameter went with them. It only ever arrived as "VIP": a Tracking LiveEvent always
 * carries a path of 2+ hops (both producers gate on `distinctCameras.size >= 2` — mockData's
 * deriveLiveEvents and vcaStore's addEvent — and vcaEventsToLiveEvents passes `personPath`
 * straight through), and the hops branch at the call site returns before reaching this pin. So
 * `var(--type-tracking)` was unreachable here and a dead token-coloured branch is how the next
 * reader concludes there is a live design decision to honour.
 *
 * STILL MISSING, and deliberately not fixed here because it is a different question: every other
 * map object gets a white casing and a soft shadow so it survives a customer's own basemap (see
 * `.vca-map-dot` and the note above it — delivered tiles "may be anything from near-white to a
 * dense colour map"). This pin has neither. That needs no new token, and it is contrast rather
 * than emphasis, which is why it is not a replacement for the halo.
 */
function getMarkerHTML(photoUrl: string): string {
  const color = "var(--primary-400)";
  return `
    <div style="width:42px;height:56px;position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid ${color};background:var(--gray-100);overflow:hidden;position:relative;z-index:2">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
      </div>
      <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:18px solid ${color};margin-top:-12px;z-index:1"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:-4px;z-index:1"></div>
    </div>
  `;
}

/**
 * DELETED: nearestZoneName, which answered "which zone is this device in?" by measuring to the
 * closest camera in the register and printing THAT CAMERA'S NAME.
 *
 * Three things were wrong with it, and none of them showed up as an error.
 *
 *   - It was a name, not a zone. The register carries `Camera.zone` ("Kallang", "Perimeter"),
 *     and this printed `Camera.name` ("Geylang NC1") under a location pin, so the popup's second
 *     line was the same string as the title above it — a device's row said its own name twice.
 *   - It was a guess where an id join was available. A Device IS a register camera projected
 *     into display shape (lib/api/dashboard's cameraToDevice, one register since 2026-09-10), so
 *     `device.id === camera.id` and the camera's own zone can simply be read. Recovering an
 *     entity by proximity is the coordinate version of recovering it by name, which this repo
 *     bans for the reason SESSIONS records: the join key is the id.
 *   - Its fallback erased a fact instead of inventing one. A camera nobody has surveyed has no
 *     nearest anything, so it answered "Unknown" — for "Depot Bay 2", whose zone the register
 *     knows perfectly well ("Kallang"). Absent coordinates are not an absent zone.
 *
 * And the wrong-camera name did not stay on the popup: it was passed to __vcaGoLiveCam as the
 * deep-link hint, which BestFramePage resolves as a camera NAME (see cameraForLocationHint). So
 * "View Live" on one device could open another camera's feed — the exact failure that helper's
 * own comment was written about. The hint is now the pinned camera's own name.
 */

/**
 * `canGoLive` decides whether the "view live" button is in the markup at all.
 *
 * Passed in rather than read off `window.__vcaGoLiveCam`: the bridge is installed by an effect and
 * this string is built during render, so asking the window here would sometimes draw the button
 * and sometimes not for the same account. A button whose handler is missing does nothing when
 * pressed, which is the one outcome worth ruling out.
 *
 * `cam` is the register entry this device is a projection of, found by id. Everything the popup
 * says beyond name and status comes from it — the zone, the last signal, and the deep link — and
 * each of those is drawn only when the register actually holds it.
 */
function getDevicePopupHTML(device: Device, cam: Camera | undefined, lang: AppLanguage, canGoLive: boolean): string {
  const t = T[lang];
  const isLive = device.status === "Live";
  // Blank in the register (the new-project wizard registers cameras without one) reads as absent,
  // not as a zone called "". No row rather than an empty row under a location pin.
  const zone = cam?.zone?.trim() ? cam.zone : null;
  /**
   * "Out since 14:02" needs a time that exists. `Camera.lastSeenAt` is absent until a camera has
   * reported in at all, and the projection this popup used to read fills that absence with an em
   * dash — so an offline camera that has never once been reachable said "Out since —".
   *
   * The OUT badge above already carries the fact that it is down; this row only adds the moment,
   * and where there is no moment it is not drawn. (The register can tell "dropped" from "never
   * contacted" — isAwaitingFirstContact in vcaStore — but that is a sentence this popup does not
   * have, and a wrong one is worse than a missing one.)
   */
  const outSince = !isLive && cam?.lastSeenAt ? formatTimeAgo(cam.lastSeenAt, lang) : null;
  return `
    <div style="font-family:'SUIT',system-ui,sans-serif;width:200px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-right:18px;gap:8px">
        <span style="font-size:13px;font-weight:800;color:var(--gray-900);letter-spacing:-0.26px">${escapeHtml(device.name)}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:var(--radius-pill);color:${isLive ? "var(--success-400)" : "var(--warning-500)"};background:${isLive ? "var(--success-100)" : "var(--warning-100)"};flex-shrink:0">
          ${isLive ? t.live : t.out}
        </span>
      </div>
      ${zone === null ? "" : `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.3 10.9C7.23 10.1 10 7.5 10 5c0-2.21-1.79-4-4-4S2 2.79 2 5c0 2.5 2.77 5.1 3.7 5.9.09.06.19.1.3.1s.21-.04.3-.1Z" stroke="var(--gray-500)" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="5" r="1.5" stroke="var(--gray-500)"/></svg>
        <span style="font-size:11px;font-weight:600;color:var(--gray-600)">${escapeHtml(zone)}</span>
      </div>`}
      ${outSince !== null ? `
      <div style="display:flex;align-items:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--warning-500)" stroke-linecap="round"/><path d="M6 3v3l2 1.5" stroke="var(--warning-500)" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span style="font-size:11px;font-weight:600;color:var(--warning-500)">${t.outSince(outSince)}</span>
      </div>` : !isLive || !canGoLive || !cam ? "" : `
      <button onclick="window.__vcaGoLiveCam && window.__vcaGoLiveCam('${escapeOnclickArg(cam.name)}')"
        style="margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
        background:var(--gray-900);color:white;border:none;border-radius:var(--radius-control);padding:7px 0;
        font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3.5L8.5 6L4.5 8.5V3.5Z" fill="white"/></svg>
        ${t.viewLive}
      </button>`}
    </div>
  `;
}

function getDeviceMarkerHTML(name: string, isLive: boolean): string {
  const color = isLive ? "var(--success-400)" : "var(--warning-400)";
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:5px;background:var(--gray-900);border-radius:var(--radius-pill);padding:5px 10px;box-shadow:0 2px 10px rgba(24, 17, 39,0.2);white-space:nowrap">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <span style="font-family:'SUIT',system-ui,sans-serif;font-size:11px;font-weight:800;color:white;letter-spacing:-0.2px">${escapeHtml(name)}</span>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid var(--gray-900);margin-top:-1px"></div>
    </div>
  `;
}

// Ported from RedmapMap.tsx's tracking-route rendering — reused here so a Tracking event
// selected on the Dashboard draws the same numbered-node route instead of a single pin, since
// the whole point of "Tracking" is the multi-camera path, not just one last-known point.

/**
 * DELETED: hopToLatLng, which resolved a hop's position by matching `location` against camera
 * NAMES and, failing that, invented one.
 *
 * It was never needed. A TrackingHop carries its own coordinate (mockData's TrackingHop.lat,
 * added in 57b7282), every producer fills it, and RedmapPage reads it directly — this file was
 * the one reader still working back from the name. The field's own comment had already recorded
 * why not to: "falls back to the first camera when a name does not resolve, and silently puts a
 * sighting in a district kilometres away." Four branches deep, the failures were:
 *
 *   - partial name match  → the site's point plus (seed % 5) * 0.0015, up to ~600m off. This was
 *                           the common one, and the quiet one: a plausible point, no error.
 *   - no match at all     → the project's first camera, or 1.3521/103.8198 (central Singapore).
 *
 * `hasPosition` replaces all of it. A hop with no coordinate is drawn nowhere and counted
 * nowhere, and the route says so — see the gap handling below.
 */

function routeBubbleTailHtml(centerY: number, fillColor: string, borderColor: string): string {
  return `<div style="position:absolute;left:-9px;top:${centerY - 8}px;width:0;height:0;
        border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:9px solid ${borderColor};"></div>
     <div style="position:absolute;left:-8px;top:${centerY - 7}px;width:0;height:0;
        border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:8px solid ${fillColor};"></div>`;
}

/**
 * Brings a just-opened popup fully inside the map, centred — but only when it does not already
 * fit.
 *
 * A popup here is anchored below its own content and grows upward (the detail card is up to
 * ~470px tall), so a dot near the top edge opened a card that ran off the map: measured 310px of
 * card with 270px of it above the container's top, leaving about 40px readable. The popup had
 * nowhere to go and nothing moved.
 *
 * WHY NOT `autoPan: true`. Leaflet's own auto-pan does the MINIMUM move that fits the popup, so
 * a card clipped at the top ends up flush against the top with its close button in the corner —
 * technically visible, still the worst place on the map to read something. Centred was what was
 * asked for, and centred is also what makes the pan legible: the map moved, and the thing you
 * pressed is now in the middle. (`autoPan: false` was never a decision, for the record — it
 * arrived uncommented with the first commit, `218ba1f`, and the district-spot popup copied it in
 * `9f42874`. It stays false now because this function does the job instead, and two things
 * panning the same map would fight.)
 *
 * WHY NOT `keepInView`. That one re-pans whenever the popup drifts out as the map is DRAGGED,
 * which takes the map away from the operator mid-gesture. Bringing a popup in when it opens is a
 * response to a click; pulling it back while somebody is dragging is the map overriding them.
 *
 * WHY CONDITIONAL. Centring unconditionally would jerk the map on every dot click, including the
 * dozens that open in clear space — and this file has a standing objection to the map moving on
 * its own (see the flyTo notes and the viewport-anchored no-coordinates control, which exists
 * precisely so one line of text does not travel with the tiles). So: if it fits with a margin,
 * nothing happens. This also means the two flyTo cases below, which already centre their own
 * marker and normally have room, are untouched until a short viewport actually clips them.
 *
 * THE WHOLE POPUP, not the marker. Centring the marker leaves a tall card still hanging over the
 * top edge — the card is what has to be read, so the card's own box is what gets centred.
 */
function centerPopupIfClipped(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  popup: any,
): void {
  // Absent when the popup was closed again before this ran (the flyTo callers below are one
  // animation late), and the popup element is only measurable once Leaflet has attached it.
  const el: HTMLElement | undefined = popup?.getElement?.();
  if (!el || !el.isConnected) return;
  const container: HTMLElement | undefined = map?.getContainer?.();
  if (!container) return;
  const box = el.getBoundingClientRect();
  const view = container.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  // Enough that the card does not read as touching the edge. The map's own furniture is in the
  // corners (zoom control top-right, the detections button bottom-left) and a centred popup
  // clears both, so this margin is about the edge and nothing else.
  const MARGIN = 12;
  const fits = box.top >= view.top + MARGIN && box.bottom <= view.bottom - MARGIN
    && box.left >= view.left + MARGIN && box.right <= view.right - MARGIN;
  if (fits) return;
  // panBy moves the map BY this offset, which moves the content the other way — so handing it
  // the popup's own distance from centre is what lands the popup on the centre.
  const dx = (box.left + box.width / 2) - (view.left + view.width / 2);
  const dy = (box.top + box.height / 2) - (view.top + view.height / 2);
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  map.panBy([dx, dy], { animate: true, duration: 0.3 });
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
    const saved = (key: string, fallback: number) => {
      const v = Number(localStorage.getItem(key));
      // Also the path back to the default when the value is cleared, not just when it's absent.
      return Number.isFinite(v) && v > 0 ? v : fallback;
    };
    const apply = () => {
      setAlertThreshold(saved(DISTRICT_ALERT_THRESHOLD_KEY, DEFAULT_DISTRICT_ALERT_THRESHOLD));
      setModerateThreshold(saved(DISTRICT_MODERATE_THRESHOLD_KEY, DEFAULT_DISTRICT_MODERATE_THRESHOLD));
    };
    queueMicrotask(apply);
    // Saving on My Page in one tab used to leave a dashboard open in another tab drawing its
    // pills against the old numbers until someone reloaded it — two windows disagreeing about
    // what counts as an alert. `storage` fires in every OTHER tab of this origin, which is
    // exactly the set that needs telling; the saving tab comes back through the route change.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === DISTRICT_ALERT_THRESHOLD_KEY || e.key === DISTRICT_MODERATE_THRESHOLD_KEY) apply();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
  // Only the ones that have a place. A camera whose position nobody has surveyed is a real
  // registered camera (Camera.lat says why) but there is no honest pin for it — the old required
  // fields meant it arrived as 0,0 and was drawn in the Atlantic. Everything geographic on this
  // screen reads this list; the device list and the register still read the full one.
  const allCameras = useProjectCameras();
  const cameras = useMemo(() => allCameras.filter(hasPosition), [allCameras]);
  // Camera run state comes from one place — see lib/realtime/cameraStatus.ts. The backend owns the
  // realtime layer and replaces that module's body at intake; nothing here changes.
  const cameraStatus = useCameraStatus();
  // The FULL register, position or not — the pinned-device popup looks its camera up by id to
  // read the zone and the last signal off the register entry, and neither of those facts depends
  // on anybody having surveyed where the camera stands. (This replaces a ref over the
  // position-filtered list, whose only reader was the nearest-camera guess that is now gone.)
  const allCamerasRef = useRef(allCameras);
  useEffect(() => { allCamerasRef.current = allCameras; }, [allCameras]);

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
  /*
   * AND NOTHING AT ALL FOR AN ACCOUNT WITHOUT THE EVENTS GRANT (2026-10-01).
   *
   * The dashboard is two panels and they are granted apart: EVENTS is detections, SYSTEM is
   * cameras and servers with nobody's data in it (dashboardPanelsFor). The tab strip and the app's
   * tab list both honour that now — but the MAP did not, so an account granted `systemStatus`
   * alone opened the dashboard, saw the SYSTEM panel it is entitled to, and behind it a district
   * pill reading 「Serangoon · VIP × 1 · 3 cams」. Reported from the running screen.
   *
   * Gated here rather than at each pill: every detection figure on this map — the district counts,
   * the per-camera people counts, the hover rows — is derived from this one list, so emptying it
   * removes the layer in one place and cannot be forgotten at a fourth call site. The camera
   * layer is untouched: that is the half this account holds.
   */
  const mapPanels = useDashboardPanels();
  const todaysHits = useMemo(
    () => (mapPanels.events ? todaysDetectionHits(projectEvents) : []),
    [projectEvents, mapPanels.events],
  );

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

      /**
       * A district's camera figure, or null when this pill must not print one.
       *
       * DISTRICTS holds seventeen points under fourteen names — "Geylang" three times, "Kallang"
       * twice. A camera's district comes from the register's `zone` (districtIdForCameraZone),
       * and a zone of "Geylang" names all three points, so geometry picks which one: the
       * register's Geylang NC1 lands on one of them, NC2 on another, and the third is left
       * holding zero cameras. Measured 2026-09-29 on the running dashboard — that third pill
       * read "Geylang · no camera" while the same screen's list showed Ryan Ng at Geylang NC1
       * and James Wilson at Geylang NC2, and clicking the pill filtered the list from 80 rows
       * to 15. The screen contradicted itself inside one glance.
       *
       * "no camera" is this pill's strongest claim — it is the one a customer takes upstairs to
       * argue for cameras — and under a duplicated name the app cannot make it. What it knows is
       * "three cameras are zoned Geylang"; which of three Geylangs each sits in is a coordinate
       * guess, and re-guessing camera attribution from coordinates is the wrong turn this file
       * already refuses (see districtIdForCameraZone, and project_vca_district_vip_count).
       * Printing "3 cams" on all three pills instead would count three cameras nine times.
       *
       * So the pill drops the camera half and keeps the detections, which is the half it can
       * stand behind. SAYING LESS, NOT SAYING SOMETHING ELSE: no "unknown" badge, no dashed
       * border, no zero. Five of the seventeen points are affected (three Geylang, two Kallang).
       *
       * The repair is not a better guess here. It is one district list in the register's own
       * zone namespace, delivered by the server — contract sentence 8.
       */
      const sayableCameraCount = (label: string, installed: number): number | null =>
        districts.filter(d => d.label === label).length > 1 ? null : installed;

      if (districtFilter && zoom <= CLUSTER_ZOOM_BREAKPOINT) {
        // ── A district is picked, but the map is pulled back out ──
        //
        // The filtered branch used to ignore zoom entirely and draw camera dots at every
        // distance. Pull back to the whole island and you got three 12px dots on it and no label
        // anywhere — nothing saying which district you were in or what it held. The unfiltered
        // map already answers this: boxes when far, dots when close, at the same breakpoint. The
        // filter had simply opted out of that rule.
        //
        // So at this distance the picked district gets its box back, and only its own. Clicking
        // it clears the filter, the way the collapsed pills work — the sidebar chip does that too,
        // but a map you are looking at should not require looking away to undo.
        const home = districts?.find(d => d.id === districtFilter);
        if (home) {
          // Cameras by the register's own zone, not re-guessed from coordinates — see
          // districtIdForCameraZone. Detections below stay geometric because a hit carries no
          // camera id.
          const camerasHere = allCameras.filter(c => districtIdForCameraZone(c.zone, c.lat, c.lng) === home.id);
          const count = todaysHits.filter(h => districtIdAt(h.lat, h.lng) === home.id).length;
          const icon = L.divIcon({
            html: districtPillHtml(
              home.label, count, sayableCameraCount(home.label, camerasHere.length),
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
      } else if (districtFilter) {
        // ── A district was picked, close enough to see its cameras ──
        // Not the camera layer with a filter on it. That layer marks camera POSITIONS and pings
        // the ones whose coordinates match a recent hit exactly — which the hand-authored seed
        // hits never do, so filtering it would fly you into an empty district. These are the hits
        // themselves, drawn at their own coordinates with the same face pin a selected VIP gets.
        //
        // Today, matching what the pill counted. An hour would be the honest window for "recent",
        // but the number that was just clicked says today, and a pill reading 7 that opens onto
        // two pins is a pill that lied.
        // A TRACKING ROW IS A VIP WHO MOVED, and this used to drop every one of them.
        //
        // The filter was `ev.type === "VIP"`, which is the same mistake the zoomed-out pill was
        // fixed for this morning: once someone is matched across two cameras their sightings
        // collapse into one "Tracking" row (see addEvent), so `type === "VIP"` keeps only the
        // people who never moved. Multi-camera sightings — the thing a district pill exists to
        // surface — were exactly what it excluded. Clicking a pill that counted them opened onto
        // pins that did not.
        //
        // So each hop becomes its own sighting, at its own camera: the same rule
        // todaysDetectionHits applies, against the same events. A trail through three cameras in
        // this district is three pins here, not none.
        const now = new Date();
        // Takes the point as possibly-absent and answers no. A sighting on a camera with no
        // surveyed position belongs to no district — measuring from 0,0 put it in whichever
        // district happens to be nearest the equator, silently, and the count read as real.
        const inDistrictToday = (lat: number | undefined, lng: number | undefined, timestamp: string) =>
          lat !== undefined && lng !== undefined
          && isTodaySgt(new Date(timestamp), now) && districtIdAt(lat, lng) === districtFilter;
        const hits: LiveEvent[] = recentEvents
          .flatMap(ev => {
            if (ev.type === "Tracking" && ev.path?.length) {
              // The hop's own coordinate (carried since 57b7282). Falling back to the event's
              // would put an earlier stop at the newest sighting's camera, which is the bug that
              // fix was for.
              return ev.path
                .filter(hop => inDistrictToday(hop.lat, hop.lng, hop.timestamp))
                .map(hop => ({
                  ...ev,
                  lat: hop.lat,
                  lng: hop.lng,
                  timestamp: hop.timestamp,
                  location: hop.location,
                  cameraLabel: hop.cameraLabel,
                  confidence: hop.confidence ?? ev.confidence,
                  // The trail is dropped from the per-hop copy on purpose: this pin is ONE
                  // sighting, and a popup offering "the whole trail" from a single stop is the
                  // trail view's job, not this one's.
                  path: undefined,
                }));
            }
            return inDistrictToday(ev.lat, ev.lng, ev.timestamp) ? [ev] : [];
          })
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Several hits at one camera would stack into an unreadable pile of identical pins, so
        // one pin per spot carries the newest hit. The full list is in the sidebar, which this
        // same click has already filtered to this district.
        // inDistrictToday already dropped the unplaced ones, but the type cannot know that, and
        // asserting it with `!` would be the same lie in a shorter form. One filter, and every
        // reader below (spot keys, marker positions, the quiet-dot overlap test) is narrowed.
        const placedHits = hits.filter(hasPosition);
        const bySpot = new Map<string, typeof placedHits>();
        placedHits.forEach(ev => {
          const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
          const at = bySpot.get(key);
          if (at) at.push(ev); else bySpot.set(key, [ev]);
        });

        // ── What a picked district draws: CAMERAS, not portraits ──
        //
        // This drew a face pin per spot, with a second portrait tucked behind it and a "+2" for
        // the rest. Every question this screen produced came from that: "does the badge mean this
        // person was caught several times?", "it says 4 people but shows two", "I clicked a pin
        // with several people and the popup shows one". A portrait is a claim about a PERSON, and
        // what a picked district has to answer is about PLACES — which of its cameras caught
        // anybody, and how many. Two different questions were riding one marker.
        //
        // So the marker is the camera dot this map already uses when zoomed in (recentPingHtml /
        // quietCameraDotHtml), with the headcount beside it. Faces belong to picking a person —
        // a row in the sidebar list, or this dot's own popup — where the answer really is "this
        // person".
        //
        // The gain is not only fewer questions. Drawing the district's QUIET cameras too makes
        // the coverage claim checkable: eight dots, three of them ringed, is "3 of its 8 cameras
        // caught somebody" in a form the eye can count. The old view drew only the three, so
        // "how many of how many" was not on the map at all.
        bySpot.forEach(spot => {
          const newest = spot[0];
          // PEOPLE, not detections. `new Set(ev.id)` would count sightings — LiveEvent.id is
          // `personId ?? id` and personId holds the SIGHTING's id (see DetectionHit.person), so
          // "one person seen 13 times" and "13 people seen once" came out identical. A name is a
          // weaker identity than an id and the only one an event carries; the server contract for
          // fixing that is in HANDOFF.md.
          const people = new Set(spot.map(ev => ev.name)).size;
          // FIRST occurrence per name, not `new Map(spot.map(...))`.
          //
          // `new Map(entries)` lets a repeated key overwrite the value while keeping the position
          // of its FIRST appearance. Fed a newest-first list, every person ended up sitting where
          // their newest sighting was and displaying their OLDEST — so this popup listed
          // "11분 전 / 20분 전 / 01:47:00 / 29분 전", with a 13-hour-old time wedged between two
          // recent ones. The times were each real; the row they were attached to was not.
          //
          // The name is the identity here, and a weak one — see DetectionHit.person and the
          // server contract in HANDOFF.md.
          const newestPerPerson = [...spot
            .reduce((m, ev) => (m.has(ev.name) ? m : m.set(ev.name, ev)), new Map<string, typeof spot[number]>())
            .values()];
          // The count rides beside the dot, not on it. It is a number about a place now, so there
          // is no portrait for it to be misread as being about.
          //
          // `> 0`, not `> 1`, and that matters now that the ring has a time gate above. A spot
          // whose newest sighting is older than the hour draws the quiet grey dot, and a quiet
          // grey dot with no figure beside it is exactly what a camera with nothing to report all
          // day looks like — so without a figure on it, "one person here this morning" and "nobody
          // here at all" became the same marker. It is also the threshold the camera layer has
          // always used (see peopleAt, whose singular branch exists for this), so one figure now
          // appears under the same rule on both layers of this map.
          const countPill = people > 0
            ? `<div style="position:absolute;left:13px;top:-11px;padding:1px 6px;border-radius:var(--radius-pill);
                  background:var(--gray-900);border:1.5px solid white;font-family:'SUIT',sans-serif;
                  font-size:10px;font-weight:800;color:white;letter-spacing:-0.2px;white-space:nowrap">
                 ${t.peopleAt(people)}
               </div>`
            : "";
          /**
           * THE RING IS A CLAIM ABOUT NOW, so it is gated on the same hour the camera layer uses.
           *
           * Every spot here pulsed before, and the set of spots is deliberately TODAY's (see the
           * filter above — a pill reading 7 that opens onto two pins is a pill that lied). Those
           * two facts together had the map running an expanding ring, which means "just now"
           * everywhere in this product, over a detection that could be nine hours old. The
           * zoomed-in camera layer had got this right all along; this branch had no time gate at
           * all, and `globals.css`'s own note on the deleted VIP flash leans on the claim that
           * this ring carries "a real one-hour window" — which was true of one of the two layers
           * drawing it.
           *
           * The spot keeps its count pill either way: "somebody was here today" and "somebody is
           * here now" are both worth drawing, and separating them is exactly what the quiet dot
           * plus a figure already says on the camera layer.
           */
          const isRecent = now.getTime() - new Date(newest.timestamp).getTime() <= RECENT_VIP_WINDOW_MS;
          const icon = L.divIcon({
            html: `<div style="position:relative">${isRecent ? recentPingHtml(VIP_PING_COLOR) : quietCameraDotHtml()}${countPill}</div>`,
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          // The others, by name and face — the popup is where "who" is a fair question.
          const others = newestPerPerson.slice(1);
          const othersHtml = others.length > 0
            ? `<div style="padding:8px 12px 10px;border-top:1px solid var(--line);font-family:'SUIT',system-ui,sans-serif">
                 <div style="font-size:10px;font-weight:700;color:var(--gray-400);letter-spacing:-0.2px;margin-bottom:6px">
                   ${t.alsoHere(others.length)}
                 </div>
                 ${others.map(ev => `
                   <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
                     <div style="width:26px;height:26px;border-radius:50%;overflow:hidden;background:var(--gray-100);flex-shrink:0">
                       <img src="${getFacePhoto(ev.id)}" style="width:100%;height:100%;object-fit:cover;display:block" alt="" />
                     </div>
                     <span style="font-size:12px;font-weight:700;color:var(--gray-900);letter-spacing:-0.24px;
                                  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${escapeHtml(ev.name)}</span>
                     ${/* Dropped entirely where no confidence was recorded, rather than printed as
                          "0%" — see confidenceFigure. The name and the time are the two things
                          this row is for, and they carry it on their own. */ ""}
                     ${confidenceFigure(ev.confidence) === null ? "" : `<span style="font-size:11px;font-weight:600;color:var(--gray-500);flex-shrink:0">${confidenceFigure(ev.confidence)}</span>`}
                     <span style="font-size:10px;color:var(--gray-400);flex-shrink:0;white-space:nowrap">${formatTimeAgo(ev.timestamp, lang)}</span>
                   </div>`).join("")}
               </div>`
            : "";
          const spotSummary = spot.length > 1
            ? `<div style="padding:8px 12px;border-top:1px solid var(--line);font-family:'SUIT',system-ui,sans-serif;
                  font-size:11px;font-weight:600;color:var(--gray-500);letter-spacing:-0.2px">
                 ${t.spotSummary(people, spot.length)}
               </div>`
            : "";
          L.marker([newest.lat, newest.lng], { icon })
            .addTo(group)
            .bindPopup(getPopupHTML(newest, lang) + spotSummary + othersHtml, {
              offset: [0, -14], className: "vca-custom-popup", closeButton: true, autoPan: false, maxWidth: 280,
            })
            // This is the case that was reported: the dots sit wherever their cameras are, so one
            // near the top edge opened a card with no room above it. Nothing flies here — the
            // click only opens a popup — so there is no animation for the pan to fight.
            .on("popupopen", (e: { popup: unknown }) => centerPopupIfClipped(mapInstanceRef.current, e.popup));
        });

        // The district's cameras with nothing to report today — the denominator, drawn.
        //
        // Skipped where a hit is already drawn, and the test is DISTANCE, not identity. That
        // looks like the "nearest camera" shortcut this file bans, and it is not: it decides only
        // whether to add a second marker on top of one already there, never which camera a
        // sighting belongs to. It has to be a distance because a hand-authored seed hit does not
        // land exactly on a register camera (the live ticker's do — it writes camera.lat/lng), so
        // matching by coordinate equality would draw a grey "nothing here" dot on top of a ping.
        //
        // And where it is unsure it stays quiet in the other direction: a camera near a hit is
        // left undrawn rather than asserted to have caught nobody.
        const SAME_SPOT_DEGREES = 0.0006; // ~65m at this latitude
        const hitSpots = [...bySpot.values()].map(spot => spot[0]);
        // WHICH district a camera belongs to comes from the register, not from its coordinates —
        // districtIdForCameraZone, the same question the pill above answered when it counted this
        // district's cameras. It was asked two different ways here: the pill by zone, these dots
        // by nearest centre, and the two disagree on five of proj-sg's ten named cameras (Geylang
        // NC1/NC2 read as Kallang by geometry, Orchard MRT as Novena — see
        // project_vca_district_vip_count). So the pill said "5 cams" and the map drew a different
        // five, which is the denominator contradicting itself inside one click.
        //
        // Read off the positioned list: a camera the register places in this district but nobody
        // has surveyed has no dot to draw, and it is left out of the drawing rather than given a
        // guessed one. Detections stay geometric (districtIdAt) — a hit carries no camera id.
        cameras
          .filter(c => districtIdForCameraZone(c.zone, c.lat, c.lng) === districtFilter)
          .filter(c => !hitSpots.some(h =>
            Math.abs(h.lat - c.lat) < SAME_SPOT_DEGREES && Math.abs(h.lng - c.lng) < SAME_SPOT_DEGREES))
          .forEach(cam => {
            const icon = L.divIcon({
              html: quietCameraDotHtml(),
              iconSize: [1, 1],
              iconAnchor: [0, 0],
              className: "vca-zone-icon",
            });
            L.marker([cam.lat, cam.lng], { icon })
              .addTo(group)
              // 0, and not a count this branch could look up: these are the district's cameras
              // that caught NOBODY today — that is the filter directly above, and the whole
              // reason they are drawn. See cameraDotTooltipHtml on why zero stays unwritten.
              .bindTooltip(cameraDotTooltipHtml(cam, lang, 0), {
                direction: "top", offset: [0, -10], className: "vca-camera-tooltip", opacity: 1,
              });
          });

        // The district's own pill used to stay here, at the district's centre, so the thing you
        // had just pressed was still sitting on the map looking pressable. It was justified as the
        // way back out — but the sidebar's chip ("Angmokio · VIP only ✕") is right there and does
        // that job, so the pill was a leftover, and it read as one.
        //
        // Its two figures moved to that chip, where they sit beside the list they describe
        // (see Sidebar's EventsList). Same derivation — districtTally in vcaStore — so the map and
        // the list cannot come to disagree about one district.
      } else if (zoom <= CLUSTER_ZOOM_BREAKPOINT) {
        // ── Zoomed out: one pill per district — unless a row is selected ──
        //
        // A SELECTED ROW AND THE PILL LAYER ARE TWO DIFFERENT QUESTIONS, and they were being
        // drawn on top of each other. "How busy is each district today" is the ambient one; "where
        // did this one person go" is the one the operator just asked by clicking. Only the second
        // was asked for, and it lost.
        //
        // Lost literally, and still lost in the common case. This paragraph used to say that a
        // Tracking selection's flyTo goes to zoom 14 and this layer draws at
        // `zoom <= CLUSTER_ZOOM_BREAKPOINT`, which IS 14, so EVERY trail lands exactly on the zoom
        // where the pills are still on. That was true of the fixed `14` the selection used to fly
        // to, and it is not true any more: the zoom now comes from the trail's own spread (see
        // TRAIL_FIT_MAX_ZOOM). What the measurements say instead is that it is no longer
        // guaranteed but is still where most trails land — of the four seed trails, Dr. Sarah Chen
        // and Michael Tan land at 13, Priya Nair at 14, and only the two-cameras-in-one-street
        // James Wilson goes past, to 18. So three of four still land under the breakpoint, and the
        // collision is the ordinary case rather than a certainty. And the
        // pills win the paint: their stacking offset is `count * 2000` (measured at 32427 for
        // Novena, 20529 for Geylang) against a trail node's `1000 + i * 100` (1519). Measured on
        // one selection: the trail-end "last seen" card had 1709px² of itself under the Novena
        // pill and another 1238px² under Geylang's, and the Bedok stop 1527px² under Bedok's. The
        // covered part is the card's own text.
        //
        // HIDDEN, NOT DIMMED. Lowering the pill layer's opacity would fix the emphasis and not the
        // collision — two overlapping labels at any opacity are two labels in the same pixels, and
        // it is the trail card's words that were being painted over.
        //
        // THE COST, STATED: a district with no camera at all draws its own pill ("no camera"), and
        // that pill is the one a coverage decision is looking for — see districtPillHtml. While a
        // row is selected it is not on the map. It comes back on the same click that clears the
        // selection (this effect lists selectedEvent, so deselecting redraws immediately), and a
        // selection is a thing the operator is holding open on purpose, not a state the map gets
        // stuck in.
        //
        // ONLY THIS BRANCH. The picked-district branch above keeps its single home pill even with
        // a row selected: there it is the only thing naming which district you are in and the way
        // back out, and blanking it would put back the "zoomed out with a district picked and no
        // label anywhere on the map" bug that a158c1f fixed.
        if (!selectedEvent) districts.forEach((district) => {
          // The register answers this, not the geometry — districtIdForCameraZone. Read from
          // allCameras rather than the hasPosition-filtered list: a camera's district comes from
          // its zone, so one that was never surveyed still belongs to the district it was
          // registered in ("Depot Bay 2", zone Kallang).
          const camerasInDistrict = allCameras.filter(c => districtIdForCameraZone(c.zone, c.lat, c.lng) === district.id);
          // The dashed pill means "this district's cameras are all down right now" — a coverage
          // gap, which is worth a pin even with nothing to report. Checking run state rather than
          // array length is what captures that.
          const hasOnlineCamera = camerasInDistrict.some(c => cameraStatus.byId(c.id) === "running");
          // Already today-only and already VIP-only (Tracking is a VIP view, not a category) —
          // so this filters on place alone. A hit with no coordinate cannot be placed in a
          // district and is left out rather than guessed at.
          const count = todaysHits.filter(h => districtIdAt(h.lat, h.lng) === district.id).length;
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
          // And a third way to have nothing to report. Under a duplicated district name the pill
          // prints no camera note at all (sayableCameraCount), and it withholds the figure at
          // zero — so a quiet one of those would draw a box with a name and an empty line under
          // it. An empty line is not a smaller claim, it is a broken pill.
          const cameraCount = sayableCameraCount(district.label, camerasInDistrict.length);
          if (cameraCount === null && count === 0) return;

          const icon = L.divIcon({
            html: districtPillHtml(
              district.label, count, cameraCount, hasOnlineCamera,
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
          const marker = L.marker([district.lat, district.lng], { icon }).addTo(group);
          // Seventeen of these on one island overlap, and until now which one covered which was
          // decided by latitude — Leaflet's default marker stacking. So a southern district's
          // pill sat on top of a northern one's for no reason connected to the map's job, and the
          // covered pill was as likely to be the one worth reading as not. Measured on the
          // overview: each pill paints about 103x51px while its own marker box is 1x1 (the icon
          // is content-sized by transform), and two of the seven had their centre covered by a
          // neighbour.
          //
          // Stacking by count instead. It does not stop the overlap — that needs the pills to be
          // placed apart, which is a layout decision, not a z-index — but it settles WHICH pill
          // loses: the quiet district goes under the busy one, never the reverse. The number a
          // coverage decision hangs on is then always the readable one.
          // Scaled, because Leaflet's base z-index for a marker is its PIXEL Y — a few hundred —
          // and zIndexOffset is added to it. A bare `count` of 15 or 31 is lost in that, which is
          // how the first attempt at this changed nothing: Geylang (15) still covered Novena (31).
          // The factor only has to exceed the map's pixel height for the count to be what decides.
          marker.setZIndexOffset(count * 2000);
          marker.on("click", () => onDistrictSelectRef.current?.(district.id));
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
        const nowMs = Date.now();
        const coordKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
        // A TRACKING ROW IS A VIP WHO MOVED, and `ev.type !== "VIP"` dropped every one of them —
        // the third place in this file to have had that filter. A camera that only ever saw people
        // who went on to another camera never pinged at all. Each hop is its own sighting, at its
        // own coordinate, which is the rule todaysDetectionHits already applies.
        const recentVipKeys = new Set<string>();
        recentEvents.forEach(ev => {
          const stamps = ev.type === "Tracking" && ev.path?.length
            ? ev.path.map(hop => ({ t: hop.timestamp, lat: hop.lat, lng: hop.lng }))
            : [{ t: ev.timestamp, lat: ev.lat, lng: ev.lng }];
          stamps.forEach(({ t: at, lat, lng }) => {
            if (nowMs - new Date(at).getTime() > RECENT_VIP_WINDOW_MS) return;
            // No coordinate, no key. A camera is marked "recently pinged" by matching its own
            // position against these, so a 0,0 key would have marked whatever camera sits
            // closest to 0,0 — or nothing, which is the same thing said less honestly.
            if (lat === undefined || lng === undefined) return;
            recentVipKeys.add(coordKey(lat, lng));
          });
        });

        /**
         * Today's headcount per camera — the same figure the picked-district view puts beside its
         * dots, so one number means one thing on every layer of this map.
         *
         * The number is TODAY while the ping is the LAST HOUR, and those do not collide because
         * they are different channels: the ping is a moving thing and says "just now", the figure
         * is a written thing. A second number would collide; an animation does not. So a camera
         * that was busy this morning and quiet since keeps its figure on a quiet dot, which is the
         * state the old view could not express at all — it drew that camera exactly like one that
         * has seen nobody all day.
         *
         * THE FIGURE NO LONGER SAYS "today" ON THE DOT. It reads "3 people", and the window moved
         * to this dot's hover — `peopleAt` carries that decision and the objection it accepts. So
         * read the paragraph above as it now stands: the two channels are still different, but
         * only the ring states its window at a glance, and the figure's window is one hover away.
         *
         * Attached by the camera's own label, or by an exact coordinate, and by nothing else. A
         * seeded hit that carries neither attaches to no camera and is left out of every figure
         * rather than credited to the nearest one — the live ticker writes both (camera.code and
         * camera.lat/lng), so real detections attach; the hand-authored seeds are the gap, and a
         * gap is the honest shape for "we cannot say which camera this was".
         */
        const peopleByCamera = new Map<string, Set<string>>();
        todaysHits.forEach(h => {
          const keys = [h.camera, h.lat !== undefined && h.lng !== undefined ? coordKey(h.lat, h.lng) : undefined];
          keys.forEach(k => {
            if (!k) return;
            const at = peopleByCamera.get(k) ?? new Set<string>();
            at.add(h.person ?? h.id);
            peopleByCamera.set(k, at);
          });
        });

        cameras.forEach(cam => {
          const key = coordKey(cam.lat, cam.lng);
          const people = (peopleByCamera.get(cam.code) ?? peopleByCamera.get(key) ?? new Set()).size;
          const countPill = people > 0
            ? `<div style="position:absolute;left:13px;top:-11px;padding:1px 6px;border-radius:var(--radius-pill);
                  background:var(--gray-900);border:1.5px solid white;font-family:'SUIT',sans-serif;
                  font-size:10px;font-weight:800;color:white;letter-spacing:-0.2px;white-space:nowrap">
                 ${t.peopleAt(people)}
               </div>`
            : "";
          const icon = L.divIcon({
            html: `<div style="position:relative">${recentVipKeys.has(key) ? recentPingHtml(VIP_PING_COLOR) : quietCameraDotHtml()}${countPill}</div>`,
            iconSize: [1, 1],
            iconAnchor: [0, 0],
            className: "vca-zone-icon",
          });
          L.marker([cam.lat, cam.lng], { icon })
            .addTo(group)
            .bindTooltip(cameraDotTooltipHtml(cam, lang, people), { direction: "top", offset: [0, -14], className: "vca-camera-tooltip", opacity: 1 })
            /**
             * `cam.name`, NOT `cam.location` — two fields with the same name in different value
             * spaces, and the wrong one emptied this filter on every camera in the register.
             *
             * What this hands over becomes `locationFilter`, and the events list tests it as
             * `e.location.toLowerCase().includes(locationFilter.toLowerCase())`. A camera's
             * `location` is the site-qualified form ("Orchard MRT, Singapore"); an event's is the
             * bare one ("Orchard MRT"). So the containment ran the wrong way — it needs the filter
             * to be the SHORTER string — and `"orchard mrt".includes("orchard mrt, singapore")` is
             * false. Every one of proj-sg's cameras carries the ", Singapore" suffix, so clicking
             * any dot opened a list of nothing, directly under a pill saying "4 people today".
             *
             * A REGRESSION, not an original gap: `ce97923` rewrote this layer from event markers
             * to register markers and carried `.location` across with it (`ev.location` →
             * `cam.location`). Both types have the field, so it compiled and nothing errored.
             *
             * `cam.name` is the canonical space for this filter, not a guess: the sidebar's own
             * location picker is built from exactly this (`Sidebar.tsx`, `cameras.map(c => c.name)`),
             * so the two ways of setting the filter now agree.
             *
             * STILL A STRING MATCH, and that is the remaining weakness. Two cameras whose names
             * share a prefix ("Geylang NC1" / "Geylang NC2") make substring containment ambiguous
             * — the same trap `ad81437` fixed on Best Frame by matching exactly and refusing when
             * ambiguous. The real fix is a camera id on the hit, which the contract does not carry
             * yet (HANDOFF: TrackingHop.cameraId).
             */
            .on("click", () => onCameraSelectRef.current?.(cam.name));
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      group.addTo(mapInstanceRef.current as any);
      zoneLayerRef.current = group;
    });

    return () => { cancelled = true; };
    // selectedEvent is here so that clearing the selection puts the district pills back on the
    // same tick the trail comes off. Without it this layer would keep whatever it drew when it
    // last ran, and a map that stays stripped after a deselect is worse than the overlap was.
  }, [recentEvents, todaysHits, cameras, zoom, mapReady, alertThreshold, moderateThreshold, districts, lang, districtFilter, cameraStatus, t, selectedEvent]);

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
      if (!district) return;
      // FIT TO THE SIGHTINGS, NOT TO THE DISTRICT'S CENTRE.
      //
      // This flew to the centre at a fixed zoom, which framed the district and not what was found
      // in it. Those are different rectangles, and the difference was visible: pressing Angmokio
      // listed three sightings in the sidebar and showed ONE pin, because the other camera (Yishun
      // MRT) sits well north of Ang Mo Kio's centre and fell outside a zoom-15 window. A district
      // here is a nearest-centre bucket within DISTRICT_REACH_KM, not a drawn boundary, so members can
      // be much further from the centre than any real boundary would allow — the mismatch is built
      // into the attribution, not an occasional accident.
      //
      // So the bounds come from the hits themselves. maxZoom keeps a single sighting from filling
      // the screen at street level, and the padding leaves room for the pin's own height (the
      // marker is anchored at its tip, so its face and chip extend above and below the point).
      const spots = todaysHits.filter(h => districtIdAt(h.lat, h.lng) === districtFilter).filter(hasPosition);
      if (spots.length > 0) {
        map.flyToBounds(spots.map(h => [h.lat as number, h.lng as number]), {
          maxZoom: DISTRICT_FOCUS_ZOOM,
          // Asymmetric, because the map has furniture on three sides: the zoom control top-right,
          // and the "Today's VIP detections" button bottom-left. A marker fitted flush to the
          // bounds landed under that button — the count pill sits above-right of its dot, so the
          // bottom needs the most room of all.
          paddingTopLeft: [48, 90],
          paddingBottomRight: [48, 120],
          duration: 0.8,
          easeLinearity: 0.5,
        });
      } else {
        // Nothing to frame — the district was pinned for a coverage reason (all cameras down), so
        // the centre at the usual zoom is the only honest answer.
        map.flyTo([district.lat, district.lng], DISTRICT_FOCUS_ZOOM, { duration: 0.8, easeLinearity: 0.5 });
      }
    } else {
      // Cleared — back to the island. Returning to a remembered pre-click view sounds kinder but
      // reads as arbitrary: by then the operator may have panned and zoomed several times, and
      // "back out" landing somewhere they never chose is worse than landing where the map starts.
      map.flyTo(OVERVIEW_CENTER, OVERVIEW_ZOOM, { duration: 0.8, easeLinearity: 0.5 });
    }
  }, [districtFilter, districts, mapReady, todaysHits]);

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
        /**
         * THE NUMBER IS THE HOP'S PLACE IN THE WHOLE TRAIL, not its place among the drawable ones.
         *
         * Renumbering after the filter would make the map say "03" about a stop the list calls
         * "04", and these numbers are spoken out loud — "check point three" over the radio has to
         * mean one stop. A missing number is also the only thing on the map that says a stop is
         * missing, so keeping the gap is the signal, not an artefact.
         */
        const placedNodes = hops
          .map((h, i) => ({ hop: h, num: i + 1, isTrailEnd: i === hops.length - 1 }))
          .filter((n): n is typeof n & { hop: TrackingHop & { lat: number; lng: number } } => hasPosition(n.hop))
          .map(n => ({
            lat: n.hop.lat, lng: n.hop.lng, num: n.num, isTrailEnd: n.isTrailEnd,
            label: n.hop.location + (n.hop.cameraLabel ? ` ${n.hop.cameraLabel}` : ""),
            time: formatTimeAgo(n.hop.timestamp, lang),
          }));
        const unplacedCount = hops.length - placedNodes.length;
        // Nothing placeable: no route, no flyTo (an empty array would have thrown on
        // nodes[nodes.length - 1]). The sidebar's timeline still carries every stop.
        if (placedNodes.length === 0) return;
        const nodes = placedNodes;

        // FIT THE WHOLE TRAIL, not its newest stop at a fixed zoom.
        //
        // This flew to `nodes[last]` at a bare 14, which framed one stop and let the rest of the
        // trail fall where it fell: measured at 1600x1000, Dr. Sarah Chen's stop 01 sat at x=1995
        // against a map ending at 1600, and Michael Tan's 01 and 02 at x=2021 and x=2300 — one
        // drawn stop out of three, the line leaving the frame with nothing saying it continued.
        // The district branch above had this same bug for this same reason, and this is the answer
        // it already reached (see "FIT TO THE SIGHTINGS, NOT TO THE DISTRICT'S CENTRE"): bounds
        // over what was actually found, a maxZoom so the degenerate case does not fill the screen
        // with two dots, and asymmetric padding for the map's furniture.
        //
        // The bounds are the DRAWABLE stops, which is what `nodes` already holds. A stop with no
        // coordinate belongs to no rectangle — its gap chip and the bottom-left summary are what
        // say it exists — and stretching the frame toward a place we do not have would be the same
        // invention as the `?? 0` coordinates were.
        // Two different ceilings for two different situations — see TRAIL_FIT_MAX_ZOOM. A trail
        // with any spread at all is fitted and only stopped at 18; a trail with none has nothing
        // to fit and lands at the "one place" zoom instead of at the fit's ceiling.
        const oneSpot = nodes.every(n => n.lat === nodes[0].lat && n.lng === nodes[0].lng);
        map.flyToBounds(nodes.map(n => [n.lat, n.lng]), {
          maxZoom: oneSpot ? TRAIL_ONE_SPOT_ZOOM : TRAIL_FIT_MAX_ZOOM,
          ...trailFitPadding(map.getSize()),
          duration: 0.8,
          easeLinearity: 0.5,
        });

        /**
         * Split the trail into RUNS of stops that really are next to each other, and GAPS.
         *
         * Two consecutive drawable stops whose numbers are not consecutive have at least one
         * undrawable stop between them, so the straight line joining them is not a stretch of the
         * route — it is the two ends of a stretch we cannot draw. Drawing it like the rest says
         * the person went from one to the other, which is a claim about a path nobody observed.
         *
         * Runs are kept whole rather than split per segment: one polyline per run keeps
         * `lineJoin: "round"` doing its job at the corners and keeps `.vca-route-line`'s flowing
         * dash on a single phase along the whole run. With no gaps there is exactly one run
         * holding every node, which is byte-for-byte the single polyline this used to draw.
         */
        const runs: (typeof nodes)[] = [];
        const gaps: { prev: typeof nodes[number]; next: typeof nodes[number]; missing: number[] }[] = [];
        let run: typeof nodes = [nodes[0]];
        for (let i = 1; i < nodes.length; i++) {
          const prev = nodes[i - 1];
          const cur = nodes[i];
          if (cur.num - prev.num > 1) {
            const missing: number[] = [];
            for (let n = prev.num + 1; n < cur.num; n++) missing.push(n);
            gaps.push({ prev, next: cur, missing });
            runs.push(run);
            run = [cur];
          } else {
            run.push(cur);
          }
        }
        runs.push(run);

        runs.forEach(runNodes => {
          const line = L.polyline(runNodes.map(n => [n.lat, n.lng]), {
            // The trail is drawn in the Tracking colour, the same one the sidebar list and the map's
            // own event pins already use for a Tracking row (see typeColor above). It was purple,
            // so one event was olive in the list and purple on the map — and a long trail painted
            // the map purple in proportion to how many hops it had.
            color: "var(--type-tracking)", weight: 2, opacity: 1, lineJoin: "round", className: "vca-route-line",
          }).addTo(map);
          trackingRouteLayersRef.current.push(line);
        });

        gaps.forEach(gap => {
          /**
           * Quiet grey, tight dots, and NO arrow. The arrow is the one mark on this map that
           * asserts a direction of travel, and across a gap there is nothing to assert it from:
           * the stops in between are unplaced, so which way the line bends between them is
           * unknown. Grey rather than the trail colour so the eye reads it as absent data;
           * `--gray-400` and not `--warning-500`, for the reason on noCoordsChipOne above.
           *
           * No `vca-route-line` class either: that stylesheet rule sets its own
           * `stroke-dasharray` and animates it, and CSS beats the presentation attribute — the
           * gap would end up wearing the travelling dash of a route we are saying we don't have.
           */
          const gapLine = L.polyline([[gap.prev.lat, gap.prev.lng], [gap.next.lat, gap.next.lng]], {
            color: "var(--gray-400)", weight: 2, opacity: 1, lineJoin: "round", dashArray: "2 5",
          }).addTo(map);
          trackingRouteLayersRef.current.push(gapLine);

          const nums = gap.missing.map(n => String(n).padStart(2, "0"));
          const chipText = nums.length === 1
            ? t.noCoordsChipOne(nums[0])
            : t.noCoordsChipMany(nums[0], nums[nums.length - 1]);
          // Content-sized icon, the same shape the district pills use: a 1x1 marker box with the
          // real width coming from the chip's own `white-space:nowrap`, centred by its transform.
          const chipIcon = L.divIcon({
            html: `<div style="transform:translate(-50%,-50%);display:inline-block;background:var(--gray-0);border:1px solid var(--gray-200);
                        border-radius:var(--radius-inner);padding:3px 8px;font-family:'SUIT',sans-serif;font-size:11px;font-weight:600;
                        color:var(--gray-500);white-space:nowrap">${chipText}</div>`,
            iconSize: [1, 1], iconAnchor: [0, 0], className: "",
          });
          const chip = L.marker(
            [(gap.prev.lat + gap.next.lat) / 2, (gap.prev.lng + gap.next.lng) / 2],
            { icon: chipIcon, interactive: true },
          )
            // The stops themselves, named, so the chip's numbers lead somewhere. Camera names are
            // data and stay in their own language. One name·time line per missing stop — with a
            // single one that is exactly the two lines this tooltip is meant to be.
            .bindTooltip(
              `<div style="font-family:'SUIT',system-ui,sans-serif;padding:8px 10px;display:flex;flex-direction:column;gap:3px">
                 ${gap.missing.map(n => {
                   const hop = hops[n - 1];
                   const name = hop.location + (hop.cameraLabel ? ` ${hop.cameraLabel}` : "");
                   const prefix = gap.missing.length > 1 ? `${String(n).padStart(2, "0")} ` : "";
                   return `<span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;white-space:nowrap">${prefix}${escapeHtml(name)} · ${formatTimeAgo(hop.timestamp, lang)}</span>`;
                 }).join("")}
                 <span style="font-size:10px;font-weight:600;color:var(--gray-500);white-space:nowrap">${t.noCoordsWhy}</span>
               </div>`,
              { direction: "top", offset: [0, -16], className: "vca-camera-tooltip", opacity: 1 },
            )
            .addTo(map);
          // Above the route lines and the arrow, below the numbered stop cards (1000+).
          chip.setZIndexOffset(500);
          trackingRouteLayersRef.current.push(chip);
        });

        /**
         * The arrow goes on the last OBSERVED segment only. It marks the direction of the most
         * recent leg; sitting on a dashed gap it would be pointing along a line that exists
         * because a stop in between is missing, not because anyone saw that leg travelled.
         */
        const lastSegmentIsGap = nodes.length >= 2
          && nodes[nodes.length - 1].num - nodes[nodes.length - 2].num > 1;
        if (nodes.length >= 2 && !lastSegmentIsGap) {
          const a = nodes[nodes.length - 2];
          const b = nodes[nodes.length - 1];
          // NOT `t`. That is the translation dictionary in every other line of this component,
          // and a local `t` holding 0.35 shadows it for the rest of this block — so the next
          // person to add a label here gets `0.35.somethingOrOther` and a runtime error, or
          // worse, reaches for a different name and splits the dictionary.
          const along = 0.35;
          const arrowLat = a.lat + (b.lat - a.lat) * along;
          const arrowLng = a.lng + (b.lng - a.lng) * along;
          const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
          const arrowIcon = L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;transform:rotate(${bearing}deg)"><path d="M7 1L12.5 12H1.5Z" fill="var(--type-tracking)"/></svg>`,
            iconSize: [14, 14], iconAnchor: [7, 7], className: "",
          });
          const arrowMarker = L.marker([arrowLat, arrowLng], { icon: arrowIcon, interactive: false }).addTo(map);
          arrowMarker.setZIndexOffset(50);
          trackingRouteLayersRef.current.push(arrowMarker);
        }

        nodes.forEach((node, i) => {
          const num = String(node.num).padStart(2, "0");
          /**
           * The filled "latest detection" card is a claim about now, so it only goes on the hop
           * that actually is the latest. When the newest stop has no coordinate the card is not
           * drawn at all rather than sliding onto the one before it — a map asserting "latest ·
           * Geylang 3 · 11 minutes ago" while the real newest sighting was two minutes ago
           * somewhere else is the one wrong line here that a reader would act on.
           */
          const isLast = node.isTrailEnd;
          const size = isLast ? 44 : 36;

          /**
           * ON PALETTE, AND KEPT — the palette owner answered this (2026-09-17). Do not delete it,
           * and do not "tidy" it into a token that does not exist.
           *
           * Two literals below are `--type-tracking` (#6d9300) at an opacity:
           * `box-shadow: 0 0 0 10px rgba(109,147,0,0.15)` on the trail-end circle and
           * `drop-shadow(0 4px 10px rgba(109,147,0,0.25))` on its card. They RENDER — measured in
           * Chrome as `rgba(109, 147, 0, 0.15) 0px 0px 0px 10px` — so unlike the deleted VIP halo
           * this is a layer that has really been on screen all along, not a dead declaration.
           *
           * IT WAS RAISED AS PALETTE DEBT AND THAT WAS THE WRONG READING. The owner's reason,
           * in their words: this is *an existing colour with an opacity applied* — so it is not a
           * new colour, and the rule it was filed under ("do not invent a step; the library
           * decides") does not reach it. An alpha on a token that is already in the 32 is a use
           * of that token. What the rule forbids is a hue or a step that is not derived from one.
           *
           * The second reason, and why it is here at all: the glow is part of how the map says
           * WHICH STOP IS THE LATEST. That is the reason it stays and the reason it is not decoration: the trail end
           * is marked three ways (filled circle, white numeral, the card anchored to it) and this
           * is the fourth, the one that reads before any of them at a glance across the map.
           * Anyone removing it is removing an emphasis, not a flourish, and owes the screen a
           * replacement for it.
           *
           * The VIP halo went the other way this morning and the two are not in conflict — that
           * one was deleted because it rendered NOTHING for 23 days, so there was no layer to keep
           * and nothing on screen changed. Here something would.
           *
           * WHERE THE LINE IS — it is not the property, it is the source of the colour. The
           * shipped shadow tokens (`--shadow-modal` / `--shadow-popover` / `--shadow-raised`) are
           * themselves gray-900 at an alpha, and globals.css says shadows with bespoke offsets
           * "stay written out; there are four and they are not a scale". Same recipe here, green
           * instead of grey. What still goes to the library first is a colour that is NOT one of
           * the 32 — a different hue, or a lightness step between two of them. Reaching for a
           * token and turning it down is allowed; making a colour up is not.
           */

          const circleHtml = isLast
            ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--type-tracking);display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:14px;font-weight:700;color:white;box-shadow:0 0 0 10px rgba(109,147,0,0.15)">${num}</div>`
            : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:white;border:2px solid var(--type-tracking);display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:13px;font-weight:700;color:var(--type-tracking);box-shadow:0 2px 6px rgba(24, 17, 39,0.12)">${num}</div>`;

          const tailHtml = routeBubbleTailHtml(size / 2, "var(--type-tracking)", "var(--type-tracking)");

          /**
           * ONE CARD PER TRAIL, ON THE STOP THAT HAS TO BE READABLE. THE OTHERS ARE JUST NUMBERS.
           *
           * Every stop used to carry a card, and the cards covered each other. Measured at
           * 1600x1000 on the old fixed zoom 14: on the James Wilson trail the trail-end card lay
           * over stop 01's card across 6,798px² — 84% of that card's own 122x66 — so all that was
           * readable of stop 01 was the words "Geylang" and a time sticking out from behind. Once
           * the flight fits the trail's bounds (see TRAIL_ONE_SPOT_ZOOM) that particular pair
           * comes 185px apart and stops colliding, but framing is only half of it: a divIcon is a
           * FIXED SIZE and does not shrink as the map zooms in, so any trail whose spread forces a
           * wider frame brings its cards back together. Measured after the fit: the Michael Tan
           * trail lands at zoom 13 with stops 01 and 02 142px apart, and stop 01's card covered
           * stop 02's numbered CIRCLE across 1,116px² — hiding the one mark on this map that gets
           * spoken out loud ("check point two" over the radio).
           *
           * So the intermediate stops keep the number and give up the card. Their place and time
           * move to a hover tooltip — the same `.vca-camera-tooltip` the camera dots and the
           * no-coordinates chips on this map already use, so it is a pattern already learnt here
           * rather than a new one — and they are ALSO already on screen without a hover: the same
           * click that drew this trail expanded the sidebar row's timeline, which lists every stop
           * with its camera and its time. The cards were repeating that list in a place where they
           * could collide; the numbers are the part the list cannot give you, because the number's
           * whole job is to say WHERE on the map that stop is.
           *
           * WHAT THIS COSTS, stated: you can no longer read the intermediate stops' names straight
           * off the map. Two things that were weighed against it — the sidebar timeline above, and
           * that a trail of five stops drew five cards, which is a pile rather than a reading.
           *
           * NOT SOLVED BY ZOOM, and it cannot be. Two cameras on one pole are metres apart; the
           * fit runs out at the tile source's own maximum zoom and their circles still touch.
           * Flipping a card to the side away from its neighbour was the other candidate and it is
           * a smaller fix than it looks: it needs the tail mirrored, it needs each node to know
           * where the others landed in pixels (which is only knowable after the flight), and two
           * stops at almost the same point overlap whichever side they open.
           *
           * THE TRAIL-END CARD NAMES THE PERSON. Nothing else on this map did.
           *
           * Selecting a Tracking row drew a trail and no identity: no popup at all, no face, no
           * figure, and the name present only as an argument inside the Redmap link's `onclick`
           * — measured, "Dr. Sarah Chen" was in the markup and in no pixel. So the map said
           * "somebody was last seen at Novena a minute ago". Selecting a VIP row, meanwhile,
           * opens a card with name, badge, portraits and a confidence. A Tracking row is a VIP
           * who MOVED, which is the more urgent of the two.
           *
           * This node and no other. `isTrailEnd` is the one place where "this is who, and this is
           * where they were last seen" is a single true statement: the other nodes are earlier
           * sightings, and repeating the name on each of them would put four copies of one person
           * on the map — the same mistake the district view made with portraits (see the
           * "CAMERAS, not portraits" note above) in a different medium.
           *
           * THE RESIDUAL, STATED: when the newest hop has no coordinate this card is not drawn at
           * all (see `isLast` above), so such a trail still has no name anywhere on the map. The
           * fix is not to slide the name onto the last DRAWN stop — that stop is not where the
           * person was last seen, and a name over it would say it was. Somewhere viewport-anchored
           * (beside the "N of M points have no coordinates" control, which is already the only
           * thing on screen for this case) is the honest place for it, and that is a decision
           * about that control rather than about this card.
           *
           * NO FACE, and that is not an omission to be tidied up later. A portrait is a claim
           * about a PERSON, this file has twice decided what such a claim costs on a map, and
           * Best Frame removed its stock portraits outright because they were being dealt out by
           * list position. The name is the half that is cheap and certain.
           *
           * NO `%`. A Tracking event's own `confidence` is 0 — written by both producers
           * (mockData's deriveLiveEvents and vcaStore's addEvent), not measured — and the real
           * numbers live one per hop, on the individual sightings. There is therefore no such
           * thing as "the trail's confidence": the newest hop's number is a fact about that one
           * frame, and printing it under the person's name would make it a fact about the person.
           * Per-hop figures on the per-hop nodes would be honest and are a decision for the
           * product, not a gap to fill here.
           *
           * The location was this line and moves down beside the time rather than making way:
           * "<place> · <time ago>" is one sighting's circumstances and belongs together, so the
           * card gains an identity without gaining a line. Names are DATA — never translated,
           * and never truncated either. The card is `white-space:nowrap`, so a long name widens
           * it rather than wrapping — measured: 187x124 unchanged up to 16 characters, because
           * the "View Full Trace on Redmap" line below is still the widest thing in the card;
           * 248px at 28 characters, 292px at 33. The HEIGHT never moves, which is the property
           * worth keeping: the card grows sideways from the stop it is anchored to and no name
           * pushes the time or the link onto another line.
           */
          const cardHtml = !isLast
            ? ""
            : `<div style="position:relative;font-family:'SUIT',sans-serif;filter:drop-shadow(0 4px 10px rgba(109,147,0,0.25))">
                 ${tailHtml}
                 <div style="position:relative;display:flex;flex-direction:column;border-radius:var(--radius-panel);overflow:hidden;border:1.5px solid var(--type-tracking)">
                   <div style="background:var(--type-tracking);color:white;font-size:11px;font-weight:800;padding:6px 12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
                     <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M6 0.5L1.5 6.5H5L4.5 10.5L9.5 4.5H6L6 0.5Z" fill="white"/></svg>
                     ${t.lastSeen}
                   </div>
                   <div style="background:white;padding:8px 12px 10px;white-space:nowrap">
                     <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${escapeHtml(selectedEvent.name)}</div>
                     <div style="font-size:13px;color:var(--gray-500);margin-top:2px"><span style="font-weight:600;color:var(--gray-700)">${escapeHtml(node.label)}</span> · ${node.time}</div>
                     ${onGoRedmapTrace === undefined ? "" : `<div onclick="window.__vcaGoRedmapTrace && window.__vcaGoRedmapTrace('${escapeOnclickArg(selectedEvent.name)}')"
                       style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gray-100);display:flex;align-items:center;gap:4px;
                       font-size:12px;font-weight:700;color:var(--type-tracking);cursor:pointer">
                       ${t.fullTrace}
                       <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="var(--type-tracking)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                     </div>`}
                   </div>
                 </div>
               </div>`;

          const html = isLast
            ? `<div style="display:inline-flex;align-items:flex-start;gap:10px">${circleHtml}${cardHtml}</div>`
            : circleHtml;
          const icon = L.divIcon({ html, iconSize: [1, 1], iconAnchor: [size / 2, size / 2], className: "" });
          const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
          if (!isLast) {
            // Where and when, on hover. Two lines, the same shape as this map's camera tooltip —
            // the camera name in the reading weight and the time under it in the quiet one. Names
            // are data and stay in their own language. The offset clears the circle's own radius,
            // since the icon is anchored at the circle's centre.
            marker.bindTooltip(
              `<div style="font-family:'SUIT',system-ui,sans-serif;padding:8px 10px;display:flex;flex-direction:column;gap:3px">
                 <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.24px;white-space:nowrap">${escapeHtml(node.label)}</span>
                 <span style="font-size:10px;font-weight:600;color:var(--gray-500);white-space:nowrap">${node.time}</span>
               </div>`,
              { direction: "top", offset: [0, -(size / 2 + 4)], className: "vca-camera-tooltip", opacity: 1 },
            );
          }
          // Above the camera dots. Every hop now sits exactly on the camera that captured it
          // (hops carry their own coordinates since 57b7282 — before that they all shared the
          // event's, so only one node ever coincided with a dot). The dot is 12px and drawn on
          // top: it covered the node's step number and turned each stop into a dot inside a ring,
          // which is the bullseye pattern the quiet dots were redrawn to avoid. The node circle
          // is opaque and larger, so putting it above hides the dot it is standing on.
          marker.setZIndexOffset(1000 + i * 100);
          trackingRouteLayersRef.current.push(marker);
        });

        /**
         * One line over the map, and only when the chips cannot carry the message themselves.
         *
         * A chip sits between the two stops it is about, which is the honest place for it and
         * enough on its own for one or two gaps — repeating the same fact in a banner above them
         * would just be the map saying it twice. Two cases the chips genuinely cannot cover:
         *
         *  - three or more gaps, where the reader is no longer counting chips but needs the shape
         *    of it ("most of this trail isn't here");
         *  - a missing FIRST or LAST stop, which has no chip at all. A gap chip needs a drawable
         *    stop on each side, so an unplaced end leaves the trail simply starting or stopping
         *    short — and the most recent stop missing is the one omission that changes what the
         *    map means, because the trail's visible end then isn't where the person was last seen.
         *
         * A Leaflet control rather than another divIcon: this line is about the trail as a whole, so it
         * has no latlng — any coordinate picked for it would be the map asserting a place for
         * stops whose whole problem is having none, and it would pan away with the tiles. A
         * control is anchored to the viewport, stays put, and its `.remove()` is the same method
         * the teardown above already calls on everything in trackingRouteLayersRef. Bottom-left:
         * the zoom control took topright and the attribution bottomright. Not the legend — people
         * looking at a map do not look at the legend.
         */
        const endMissing = nodes[0].num !== 1 || !nodes[nodes.length - 1].isTrailEnd;
        if (unplacedCount > 0 && (gaps.length >= 3 || endMissing)) {
          const summary = new L.Control({ position: "bottomleft" });
          summary.onAdd = () => {
            // `leaflet-control` is what gives a control its inset from the map edge — the corner
            // containers carry none of their own, so without the class this sits flush in the
            // corner and reads as clipped. `pointer-events:none` gives back what the class turns
            // on: it is a line of text, and it must not swallow a drag of the map under it.
            const el = L.DomUtil.create("div", "leaflet-control");
            el.style.cssText = "background:var(--gray-0);border:1px solid var(--gray-200);border-radius:var(--radius-inner);padding:5px 10px;"
              + "font-family:'SUIT',sans-serif;font-size:11px;font-weight:600;color:var(--gray-500);"
              + "white-space:nowrap;box-shadow:var(--shadow-popover);pointer-events:none";
            el.textContent = t.noCoordsSummary(unplacedCount, hops.length);
            return el;
          };
          summary.addTo(map);
          trackingRouteLayersRef.current.push(summary);
        }
        return;
      }

      // ── VIP: single pin + detail popup ──
      // Only VIP reaches here. A Tracking row always carries 2+ hops (see getMarkerHTML's note),
      // so the branch above has already returned — this used to say "or Tracking with no path
      // data", describing a state no producer can make.
      // Nowhere to fly to, and nowhere to put the pin. The row still opens in the list — this
      // effect is only the map half, and the previous pin is already cleared by its teardown.
      if (!hasPosition(selectedEvent)) return;
      const { lat, lng } = selectedEvent;

      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const pinIcon = L.divIcon({
        html: getMarkerHTML(getFacePhoto(selectedEvent.id)),
        iconSize: [42, 56],
        iconAnchor: [21, 50],
        className: "",
      });
      const pinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      // THE SELECTION WINS WHERE IT TOUCHES A CAMERA DOT.
      //
      // Neither this pin nor the camera dots asked for an offset, and Leaflet's base z-index for
      // a marker is its pixel Y — so both landed on the same number (measured: a dot at 440 is
      // its own y) and which one covered the other was DOM insertion order. The pin lands on its
      // camera's own coordinate whenever the detection came off the live ticker, which is exactly
      // where the dot is, so the two touch in the ordinary case rather than a rare one.
      //
      // Small enough not to enter the district pills' band (`count * 2000`): those draw at a zoom
      // this pin's flyTo leaves behind, and their count-ordered stacking is a decision of its own.
      pinMarker.setZIndexOffset(600);
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
      // AFTER the flight, not during it. The popup opens while the flyTo above is still running,
      // and panning a map mid-flyTo fights the animation that is already moving it. The flight
      // centres the marker, which usually leaves the card room — so on a normal viewport this is
      // a no-op, and on a short one it rescues the same clipping the dot popups had.
      map.once("moveend", () => centerPopupIfClipped(mapInstanceRef.current, popup));

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
      // A device the register has no position for cannot be pinned: there is nowhere to fly to.
      // Returning leaves the previous marker cleared by this effect's own teardown, which is the
      // honest outcome — the alternative was flying to 0,0 and dropping a pin off West Africa.
      if (!hasPosition(pinnedDevice)) return;
      const { lat, lng } = pinnedDevice;
      map.flyTo([lat, lng], 15, { duration: 0.8, easeLinearity: 0.5 });

      const icon = L.divIcon({
        html: getDeviceMarkerHTML(pinnedDevice.name, pinnedDevice.status === "Live"),
        iconSize: [1, 1],
        iconAnchor: [0, 24],
        className: "",
      });
      deviceMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);

      // By id. A pinned device IS a register camera (cameraToDevice in lib/api/dashboard projects
      // one into the other), so the entry behind it is a lookup rather than a measurement.
      const cam = allCamerasRef.current.find(c => c.id === pinnedDevice.id);
      const popup = L.popup({
        offset: [0, -30], className: "vca-custom-popup", closeButton: true, autoPan: false, maxWidth: 220,
      })
        .setLatLng([lat, lng])
        .setContent(getDevicePopupHTML(pinnedDevice, cam, lang, onGoLiveCam !== undefined))
        .openOn(map);
      devicePopupRef.current = popup;
      // Same rule for the third popup, so all three behave alike. This one is ~90px tall and its
      // flyTo centres the pin, so it has never actually clipped — the call is here because the
      // next person to shorten this map's container should not have to find out which popups were
      // wired up and which were missed.
      map.once("moveend", () => centerPopupIfClipped(mapInstanceRef.current, popup));
    });
  }, [pinnedDevice, mapReady, lang]);

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
        // Leaflet numbers its own panes 200 to 700 — tiles 200, markers 600, popups 700 — on the
        // assumption that it owns a box. Without this it owns nothing: those seven numbers end up
        // ranked against the whole page, so anything the app floats over the map has to out-bid a
        // map tile, and the top bar was carrying 5000 to do it. `isolate` makes this element the
        // world they rank inside. Same line, same reason, in RedmapMap and portal/CameraMapView.
        isolation: "isolate",
        // Matches SkeletonDashboard's MapSkeleton background — avoids a flash of blank white
        // during the brief window between mount and Leaflet's async init finishing.
        backgroundColor: "var(--gray-100)",
      }}
    />
  );
}
