"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { CSSProperties } from "react";
import type { DetType, Detection, CamData } from "@/types/detection";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { clockMinutesIn, dateKeyIn, sgtClockTime, sgtDateKey, sgtHour, sgtMinute, siteTimeZone } from "@/lib/time";
import ViewerWatermark, { viewerStampText } from "./ViewerWatermark";
import {
  SIGNED_IN_USER, currentPortalUser, holdsAppAction, useActiveProjectId, useRetentionFloor, useVcaStore,
} from "@/lib/vcaStore";
import type { ExportRecord } from "@/lib/vcaStore";
import { useToast } from "./Toast";
import ScoreBadge from "./shared/ScoreBadge";
import { Photo } from "./shared/Photo";
import { RADIUS } from "./shared/controls";
import { CircleAlert, ImageDown } from "lucide-react";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

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
    noAttributes: "The module does not return appearance attributes for a detection yet.",
    photosNotWired: "Detections do not carry the matched crop or the enrolled photo yet.",
    attrBasic: "Basic",
    noRegistration: "None on record",
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
    exportFrame: "Export frame",
    exportNoGrant: "This account was not given frame export. An administrator grants it in Portal, under Users & Permissions.",
    exportSubject: "Subject",
    exportFootage: "Footage",
    exportFile: "File",
    exportWatermark: "Watermark",
    exportWatermarkOn: "Burned into the file",
    exportWatermarkOff: "Not in the file — off for this site",
    exportRequesterKind: "Request type",
    exportKindSubject: "Data subject",
    exportKindPolice: "Investigating authority",
    exportKindThirdParty: "Other third party",
    exportRecipient: "Recipient",
    exportRecipientHint: "e.g. Central Police Division, Investigation Unit",
    exportPurpose: "Purpose",
    exportPurposeHint: "e.g. Identifying a suspect in case 2026-1138",
    exportLegalBasis: "Legal basis",
    /*
     * An example, not a default — a console must not put a statute in the operator's mouth.
     *
     * It used to be one constant outside T, on the reasoning that a citation reads the same in
     * both languages. It does not read the same to the READER: an operator on the English screen
     * was shown 「개인정보 보호법 제18조제2항제7호」, which is the one field on this dialog they
     * cannot act on without being able to read Korean. The English form is the one the Act's own
     * official translation uses.
     *
     * HANDOFF: this names KOREAN law, and the article is the right one for a criminal
     * investigation here (목적 외 이용·제3자 제공, 제18조제2항제7호). An installation outside
     * Korea is under its own statute and this example is then wrong — it should come from the
     * installation's configuration rather than from this file.
     */
    exportLegalBasisHint: "e.g. Personal Information Protection Act, Art. 18(2)7",
    exportMaskNotice: "Other people appear in this frame. Handing it to the data subject requires their faces to be de-identified first, and this console cannot do that.",
    exportCancel: "Cancel",
    exportGo: "Export",
    exportBusy: "Preparing…",
    exportedTitle: "Frame exported",
    exportedDesc: "A row for it is in the export register.",
    exportFailedTitle: "Frame not exported",
    exportFailedDesc: "The frame could not be read. Nothing left and nothing was recorded.",
  },
  ko: {
    all: "전체",
    noDetections: "감지 없음",
    multiTrackHistory: "다중 트랙 이벤트 기록",
    multiTrackHint: "이 카메라가 감지한 모든 트랙의 이벤트입니다",
    vehicle: "차량",
    unknown: "미확인",
    reelTitle: "베스트 프레임 목록",
    reelSub: "현재 프레임에서 감지된 대상",
    inspectionDetail: "감지 상세",
    close: "닫기",
    liveCapture: "실시간 감지",
    liveCaptureHint: "카메라가 방금 잡은 프레임입니다",
    enrolledDb: "등록 DB",
    enrolledDbHint: "등록 데이터베이스의 기준 사진입니다",
    registeredAs: "등록 정보:",
    cameraName: "카메라",
    eventTime: "감지 시각",
    analysisResults: "분석 결과",
    noAttributes: "감지 기록에 인상착의 속성이 아직 실려 오지 않습니다.",
    photosNotWired: "감지 기록에 대조에 쓴 얼굴과 등록 사진이 아직 실려 오지 않습니다.",
    attrBasic: "기본",
    noRegistration: "등록 정보 없음",
    attrTop: "상의",
    attrBottom: "하의",
    attrAddons: "소지품",
    alsoCaptured: "같은 프레임에서 함께 감지됨",
    back: "돌아가기",
    trackOnMap: "지도에서 추적",
    bestFrame: "베스트 프레임",
    jumpTo: "시각 이동",
    pickTime: "시·분 선택",
    hour: "시",
    minute: "분",
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
    exportFrame: "프레임 반출",
    exportNoGrant: "이 계정에는 프레임 반출 권한이 없습니다. Portal의 사용자 및 권한에서 관리자가 켭니다.",
    exportSubject: "대상",
    exportFootage: "영상 범위",
    exportFile: "파일",
    exportWatermark: "워터마크",
    exportWatermarkOn: "파일에 함께 들어갑니다",
    exportWatermarkOff: "파일에 없습니다 — 이 현장은 꺼져 있습니다",
    exportRequesterKind: "요청 구분",
    exportKindSubject: "본인",
    exportKindPolice: "수사기관",
    exportKindThirdParty: "그 밖의 제3자",
    exportRecipient: "제공받는 자",
    exportLegalBasisHint: "예: 개인정보 보호법 제18조제2항제7호",
    exportRecipientHint: "예: 중앙경찰서 수사과",
    exportPurpose: "목적",
    exportPurposeHint: "예: 2026-1138 사건 피의자 특정",
    exportLegalBasis: "법령상 근거",
    exportMaskNotice: "이 프레임에는 다른 사람도 찍혀 있습니다. 본인에게 줄 때는 그 사람들을 알아볼 수 없게 해야 하고, 이 콘솔은 그 처리를 하지 못합니다.",
    exportCancel: "취소",
    exportGo: "반출",
    exportBusy: "준비 중…",
    exportedTitle: "프레임을 반출했습니다",
    exportedDesc: "반출 기록에 줄이 남았습니다.",
    exportFailedTitle: "반출하지 못했습니다",
    exportFailedDesc: "프레임을 읽을 수 없었습니다. 파일도 나가지 않고 기록도 남지 않았습니다.",
  },
} as const;

// The console's one hairline value — see --line in globals.css, which was defined for exactly
// this and then never reached the app: eight files each declared their own gray-200 rule instead,
// so Portal and the app drew different lines.
const BORDER = "1px solid var(--line)";
/* RADIUS.control, not the pill these were: a pill is this app's shape for a condition you
   switch on and off, and these switch nothing — they move the footage, from a row that also holds
   the date trigger and the time field, both of which are the control step. */
const STEP_BTN_STYLE: CSSProperties = {
  padding:"6px 12px", borderRadius:RADIUS.control, border:"1px solid var(--gray-300)", backgroundColor:"white",
  color:"var(--gray-700)", fontSize:"12px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
};
/* Hover comes from a class, never from a hovered flag per button. There were sixteen
   cursor:pointer targets on this screen and four of them answered the pointer; the rest said
   "clickable" only to a reader who had already found them.
   --gray-100 for a bordered control on white, which is the step this class carries; the --gray-50
   tint stays on list rows, which is what the reel cards already use. The class name says Portal
   because that is the section it was written for, but the behaviour it carries is the console's.

   The rest of this screen uses the five neutral .vca-hover-* classes (row / quiet / outline /
   card / darken) that DataPage and RedmapPage share. Two rules decide which:
     - a control whose SELECTED state is a fill (gray-900, a type colour, SELECTED) gets
       vca-hover-darken in that state, because a neutral tint would paint the selection away;
     - nothing may tint, outline or dim the frame itself, the detection boxes, or their labels —
       a shift anywhere inside the picture is read as something the camera saw. */
const HOVER_QUIET = "portal-btn-quiet";

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
  /** The camera this view was opened from. Only used to fill the hour and minute bars with which
   *  parts of the day actually hold records for THIS camera — without it they are 24 and 60
   *  identical cells, which answers 「몇 시가 어디냐」 (the axis labels already do) but not
   *  「어느 시간대에 뭔가 있었나」, which is the question an operator brings to a day bar.
   *  Optional: deep links that land on a frame rather than a camera pass no id, and the bars then
   *  stay plain rather than claiming an emptiness they did not check. */
  camId?: string;
}

/**
 * The dot, the legend swatch and the HUD accent for a detection's type.
 *
 * UNKNOWN IS GREY, AND THAT IS THE POINT. It was --type-unknown (#976400), a dark gold: on a 10px
 * dot ringed in white it read as a smudge rather than a category, and beside a vivid purple and a
 * vivid sky it was the one colour that looked like a mistake.
 *
 * Grey is also the honest answer. "Unknown" is the ABSENCE of an identification, and it is the
 * majority of what a camera sees — a saturated colour on the common case spends the map's loudest
 * signal on "nothing was established here". Purple marks a person the register knows, sky marks a
 * thing that is not a person, and grey marks neither. Same rule the map's quiet camera dots follow.
 *
 * FIGMA: --type-unknown now has no reader. Drop it from the library rather than leaving a variable
 * nothing points at.
 *
 * ONE COPY, AND IT LIVES HERE. BestFramePage declared this same record with the same three values
 * and a verbatim copy of this note, so the reasoning above was true twice and enforceable in
 * neither place. It is exported from this file rather than the other because the import already
 * runs this way (BestFramePage renders this component) — the reverse would be a cycle.
 * NOT THE FINAL HOME: DataPage draws the same three classes from its own table and has Unknown a
 * step lighter, so the record belongs beside the DetType union it is keyed by (types/detection.ts)
 * or in components/shared. That file is not this task's to open.
 */
export const DET_COLOR: Record<DetType, string> = { VIP: "var(--primary-400)", Vehicle: "var(--type-vehicle)", Unknown: "var(--gray-600)" };

/**
 * SELECTION AND FOCUS: "you are here", never "this is a VIP".
 *
 * Every mark this constant now feeds was --primary-400 — the same purple DET_COLOR.VIP paints a
 * VIP box, the VIP crown and the timeline's VIP count chip with. On a screen whose whole subject
 * is VIP detection that made one colour say two things: the selected timeline thumbnail read as a
 * VIP frame, the focus ring on a Vehicle box read as a VIP hit, and the answer to "but that isn't
 * a VIP detection, is it?" was no. It also spent purple far past the 5-10% this product holds
 * itself to — ten marks on one screen, most of them permanently on.
 *
 * --gray-900 is what the rest of the product already selects with: the All filter chip below, the
 * Track on Map / Redmap buttons, Portal's focus outline in globals.css. Against the timeline's
 * greyscale thumbnails and against white it is the darkest step there is, so it reads harder at
 * 3px than the purple did. One constant, so the reel, the feed and the timeline cannot drift into
 * three different "selected".
 *
 * Purple that stays purple: DET_COLOR.VIP, the VIP boxes and crowns, the VIP filter chip's own
 * fill, and the play button (a primary action, not a selection).
 */
const SELECTED = "var(--gray-900)";

// AVATAR (four stock portraits) and VEHICLE_PHOTO (one stock car) were declared here and dealt
// out to the reel cards and the "caught in this frame together" cards by LIST POSITION. Two lists,
// two positions: the same detection was one stranger in the reel and another in the panel it
// opened, and filtering the reel changed a person's face where they stood. Removed with their call
// sites — a face beside a name on this screen is read as that person.
//
// DB_PHOTO / LIVE_CAPTURE_PHOTO were declared here for the same reason and removed the same way —
// left as names so the next person does not reintroduce them from the files still sitting
// in /public.

/**
 * THE ONE PICTURE ON THIS SCREEN THAT IS NOT A STAND-IN: the region of the frame the detector
 * reported, taken out of the frame it reported it in.
 *
 * Nothing above comes back. There is still no photo OF a person here — no stock portrait, no
 * enrolled photo fetched by name (the join this codebase forbids), no sub-region guessed from a
 * rule about where faces sit in a picture. `CamData.bgUrl` is the still the boxes are drawn on,
 * and a detection's `top/left/width/height` are percentages OF THAT STILL — the very values the
 * overlay boxes on the feed are positioned with, a few hundred lines below. So a card can show
 * the detector's own answer: that frame, at that place.
 *
 * RECONSTRUCTED, NOT RE-CROPPED, so the pixels are the feed's pixels: the inner element IS the
 * frame — the same 16/9 display box with the same `objectFit:"cover"` image inside it — scaled up
 * and slid until the reported region lands in the middle of the card's picture area.
 *
 * The region is FITTED, never filled. The whole box the detector drew stays visible, and whatever
 * room the window has left over shows the real frame around it, which is what a surveillance crop
 * looks like. Filling would crop the region itself, and then something has to decide WHICH part
 * of it to keep — the top, on the theory that a head is up there. That is the guess that put a
 * smudge on every card in Data monitoring (see the inset note in DataPage.tsx's MonitorCard), and
 * it is the same guess the 1.8x "face zoom" removed from this file was making.
 */
const FRAME_ASPECT = 16 / 9;
/** The picture area's own width/height. Keep in step with its `aspectRatio` in ReelCard. */
const CROP_WINDOW_ASPECT = 1;
/** How much of its limiting axis the reported region takes up, leaving real frame as a margin
 *  around it. At 1.0 the region runs edge to edge and the card loses that surrounding context.
 *  Since the card no longer draws the rectangle, this margin is the whole of what says "the thing
 *  this card is about is the one in the middle" — do not raise it to 1. */
const CROP_FIT = 0.86;

function pctOf(value: string): number | null {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n / 100 : null;
}

/**
 * Where to put the reconstructed frame inside the picture area, in percentages of it.
 *
 * null when the detection carries no usable box — the card then keeps its empty frame, the same
 * one a camera with no `bgUrl` gets.
 */
function cropFrameStyle(det: Detection, windowAspect: number): CSSProperties | null {
  const left = pctOf(det.left), top = pctOf(det.top);
  const w = pctOf(det.width), h = pctOf(det.height);
  if (left === null || top === null || !w || !h) return null;
  // The region's aspect in the frame's DISPLAY space (the feed's 16/9 box), not the image file's:
  // that box is the coordinate space the percentages are given in.
  const regionAspect = (w * FRAME_ASPECT) / h;
  // Frame size as a percentage of the picture area, holding the frame's own 16/9 in real pixels —
  // (fw * areaW) / (fh * areaH) === 16/9, i.e. (fw / fh) * windowAspect === 16/9.
  let fw: number, fh: number;
  if (regionAspect >= windowAspect) {
    fw = (100 * CROP_FIT) / w;                 // the region's width is the limiting axis
    fh = (fw * windowAspect) / FRAME_ASPECT;
  } else {
    fh = (100 * CROP_FIT) / h;                 // its height is
    fw = (fh * FRAME_ASPECT) / windowAspect;
  }
  return {
    position: "absolute",
    width: `${fw}%`, height: `${fh}%`,
    // The region's own edge to zero, then half the leftover pushed back, so it sits centred.
    left: `${-left * fw - (w * fw - 100) / 2}%`,
    top: `${-top * fh - (h * fh - 100) / 2}%`,
  };
}

/**
 * The box the detector drew, in the line style the feed draws it in. Only the big analysis frame
 * calls this now — the reel cards stopped drawing their copy on 2026-09-29 (see ReelCard).
 *
 * Every box stays clearly visible (not just the focused one) — focus is a separate ring, not a
 * second colour. VIP always renders in the primary purple: a VIP hit is an identity signal, not a
 * focus state, so it stays purple whether focused or not. Unknown is dashed because it is the
 * absence of an identification.
 */
function detBoxBorder(det: Detection): string {
  const color = det.type === "VIP" ? "var(--primary-400)" : "var(--type-vehicle)";
  return `2px ${det.type === "Unknown" ? "dashed" : "solid"} ${color}`;
}

/**
 * The model's own words for what it saw, translated only where they are drawn — the same rule
 * DataPage's ATTR_KO follows, and the reason the values below stay English in the data.
 *
 * Ages, years and plate numbers are not words and are left alone: "34YR" reads the same either
 * way, and a plate is an identifier.
 */
const ATTR_KO_DETAIL: Record<string, string> = {
  ASIAN: "아시아계", MALE: "남성", FEMALE: "여성",
  "WHITE TOP": "흰 상의", "RED JACKET": "빨간 재킷",
  "LONG SLEEVE": "긴팔", "SHORT SLEEVE": "반팔",
  "BROWN BOTTOM": "갈색 하의", TROUSERS: "긴바지", "BLACK JEANS": "검정 청바지",
  BACKPACK: "가방", "NO BACKPACK": "가방 없음",
  SEDAN: "세단", WHITE: "흰색", REGISTERED: "등록됨",
};
function detailAttr(value: string, lang: AppLanguage): string {
  return lang === "ko" ? ATTR_KO_DETAIL[value] ?? value : value;
}

/**
 * REMOVED — it was keyed on DetType, not on the detection.
 *
 * Every VIP in the product was ASIAN / MALE / 34YR / WHITE TOP / BROWN BOTTOM / NO BACKPACK, under
 * a heading that said 분석 결과 and directly beneath `det.name`. A VIP called Sarah Lin was
 * analysed as male. Every vehicle carried the plate SGX411 while its own name said YW2281.
 *
 * `Detection` carries no attributes, so there was nothing behind these tags and nothing to bind
 * them to. HANDOFF NOTE: when the module returns per-detection attributes, render one tag per
 * attribute that actually arrived — never a table indexed by type.
 */
// REGISTERED stood here — a registry line per TYPE ("Admin_Staff (Parking Zone F)" for every VIP
// in the product). Its one reader now prints det.group instead (see the note at that line), and it
// has been sitting here unread since. Deleted rather than left as furniture: it is exactly the
// shape — a per-entity fact stored per type — that the next person is meant to stop reaching for.

// ── Timeline time model ─────────────────────────────────────────
// Everything below works in "seconds since midnight" so stepping/ticking is plain arithmetic —
// the frame strip is generated fresh each render from whatever instant is currently selected,
// rather than indexing into one fixed hardcoded list the way the old FRAMES array did.
//
// Coarse navigation is a two-tier hour/minute picker (see the Hour bar / Minute bar below)
// instead of a Zoom preset toggle — you pick an hour, then a minute within it, rather than
// zooming a single axis in and out. The thumbnail strip below always shows a fixed, tight
// 2-second-per-frame span around wherever that lands, for precise second-level scrubbing.
// Odd, so the window's centre — the instant you are inspecting — is itself one of the samples.
// With an even count the samples straddle the centre (…c-1, c+1…) and the frame you selected had
// no thumbnail of its own: its detections landed a second either side of every sample.
const THUMB_COUNT = 61; // more than fits on screen at once — the strip scrolls to reveal the rest
const THUMB_STEP_SEC = 2;
// (COUNT - 1), not COUNT — the thumbnails sit edge-to-edge at fractions i/(COUNT-1), so there
// are only COUNT-1 gaps between them. Using COUNT here made 40/19 the real gap size, which
// rounds to 2s most of the time but occasionally drifts to 3s — a visible uneven/clustered look.
const AXIS_SPAN_SEC = THUMB_STEP_SEC * (THUMB_COUNT - 1);
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;

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
// How many VIPs a frame is worth flagging for. Two known faces in one frame is a different
// event from one — it is the thing an operator wants pulled out of a 60-frame strip.
const VIP_CROWD_THRESHOLD = 2;

/* ── Solid type icon ───────────────────────────────────────── */
// `active` fills with white, for an icon sitting on its own colour (a selected filter chip).
// `solid` fills with the colour itself, for an icon on a light plate — at 10-11px the hollow
// outline is a few hairlines and stops reading as a shape at all.
function TypeIcon({ type, color, size = 11, active = false, solid = false }: { type: DetType; color: string; size?: number; active?: boolean; solid?: boolean }) {
  if (type === "VIP") return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M5.78072 1.63333C5.80231 1.59413 5.83401 1.56145 5.87253 1.53868C5.91105 1.51592 5.95498 1.50391 5.99972 1.50391C6.04447 1.50391 6.0884 1.51592 6.12692 1.53868C6.16544 1.56145 6.19714 1.59413 6.21872 1.63333L7.69472 4.43533C7.72992 4.50021 7.77905 4.55649 7.83858 4.60014C7.89811 4.64378 7.96656 4.67371 8.03902 4.68776C8.11149 4.70181 8.18616 4.69965 8.25769 4.68142C8.32922 4.66319 8.39583 4.62935 8.45272 4.58233L10.5912 2.75033C10.6323 2.71694 10.6829 2.69744 10.7357 2.69463C10.7885 2.69182 10.8409 2.70585 10.8853 2.7347C10.9296 2.76355 10.9637 2.80573 10.9826 2.85517C11.0014 2.90461 11.0041 2.95876 10.9902 3.00983L9.57322 8.13283C9.5443 8.23766 9.48199 8.33021 9.39573 8.39644C9.30947 8.46266 9.20397 8.49896 9.09522 8.49983H2.90472C2.79589 8.49907 2.69028 8.46282 2.60392 8.39658C2.51756 8.33035 2.45517 8.23774 2.42622 8.13283L1.00972 3.01033C0.995849 2.95926 0.998535 2.90511 1.01739 2.85567C1.03625 2.80623 1.07032 2.76405 1.11467 2.7352C1.15903 2.70635 1.2114 2.69232 1.26424 2.69513C1.31708 2.69794 1.36767 2.71744 1.40872 2.75083L3.54672 4.58283C3.60362 4.62985 3.67023 4.66369 3.74176 4.68192C3.81328 4.70015 3.88796 4.70231 3.96042 4.68826C4.03289 4.67421 4.10134 4.64428 4.16087 4.60064C4.2204 4.55699 4.26953 4.50071 4.30472 4.43583L5.78072 1.63333Z" fill={solid ? color : active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  // Active fill is white, like VIP's and Vehicle's. It was --warning-200 (#fef3c7), a pale cream,
  // so this chip alone had a warm cast while the other two went white — and nothing about
  // "unknown" is a warning. Same fix as BestFramePage's filter icon.
  if (type === "Unknown") return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink:0 }}>
      <g clipPath="url(#typeIconUnknownClip)">
        <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" fill={solid ? color : active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
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
      <path d="M12.6667 6.66675H3.33333C2.59695 6.66675 2 7.2637 2 8.00008V10.6667C2 11.4031 2.59695 12.0001 3.33333 12.0001H12.6667C13.403 12.0001 14 11.4031 14 10.6667V8.00008C14 7.2637 13.403 6.66675 12.6667 6.66675Z" fill={solid ? color : active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33337 12V13.3333" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6666 12V13.3333" stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Crowded-with-VIPs badge, for a frame over VIP_CROWD_THRESHOLD ─ */
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
          <path d="M2.24582 5.02831C2.16068 4.64478 2.17375 4.24597 2.28383 3.86884C2.39391 3.49171 2.59743 3.14849 2.87551 2.87098C3.1536 2.59347 3.49725 2.39068 3.87461 2.28139C4.25197 2.1721 4.65081 2.15986 5.03416 2.24581C5.24515 1.91582 5.53583 1.64425 5.87938 1.45614C6.22293 1.26803 6.60831 1.16943 6.99999 1.16943C7.39167 1.16943 7.77705 1.26803 8.1206 1.45614C8.46415 1.64425 8.75483 1.91582 8.96582 2.24581C9.34975 2.15949 9.74928 2.17167 10.1272 2.28123C10.5052 2.39078 10.8493 2.59414 11.1276 2.8724C11.4058 3.15066 11.6092 3.49477 11.7187 3.87273C11.8283 4.25068 11.8405 4.65021 11.7542 5.03414C12.0841 5.24514 12.3557 5.53581 12.5438 5.87936C12.7319 6.22292 12.8305 6.60829 12.8305 6.99998C12.8305 7.39166 12.7319 7.77703 12.5438 8.12059C12.3557 8.46414 12.0841 8.75481 11.7542 8.96581C11.8401 9.34916 11.8279 9.748 11.7186 10.1254C11.6093 10.5027 11.4065 10.8464 11.129 11.1245C10.8515 11.4025 10.5083 11.6061 10.1311 11.7161C9.754 11.8262 9.35518 11.8393 8.97166 11.7541C8.76093 12.0854 8.47004 12.3581 8.1259 12.5471C7.78176 12.736 7.39551 12.8351 7.00291 12.8351C6.61031 12.8351 6.22406 12.736 5.87992 12.5471C5.53578 12.3581 5.24488 12.0854 5.03416 11.7541C4.65081 11.8401 4.25197 11.8278 3.87461 11.7186C3.49725 11.6093 3.1536 11.4065 2.87551 11.129C2.59743 10.8515 2.39391 10.5082 2.28383 10.1311C2.17375 9.75398 2.16068 9.35517 2.24582 8.97164C1.9133 8.7612 1.6394 8.47008 1.4496 8.12535C1.25981 7.78062 1.16028 7.3935 1.16028 6.99998C1.16028 6.60645 1.25981 6.21933 1.4496 5.8746C1.6394 5.52987 1.9133 5.23875 2.24582 5.02831Z" fill={active ? "white" : "none"} stroke={active ? "white" : color} strokeLinecap="round" strokeLinejoin="round"/>
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

// The count beside each label — what the frame holds, without having to click each filter to
// find out. Tabular figures so the chips don't jitter in width as the numbers change.
function FilterCount({ n, active }: { n: number; active: boolean }) {
  return (
    <span style={{ fontSize:"11px", fontWeight:700, fontVariantNumeric:"tabular-nums",
      color: active ? "rgba(255,255,255,0.75)" : "var(--gray-400)" }}>{n}</span>
  );
}

function ReelFilterBar({ filter, onChange, counts }: { filter: ReelFilter; onChange: (f: ReelFilter) => void; counts: Record<ReelFilter, number> }) {
  const [lang] = useLanguage();
  const t = T[lang];
  // "VIP" is the same word in both languages; the other three get translated.
  const REEL_FILTER_CFG: { id: ReelFilter; label: string; color?: string }[] = [
    { id:"All",     label: t.all },
    { id:"VIP",     label:"VIP",       color: DET_COLOR.VIP },
    { id:"Vehicle", label: t.vehicle,  color: DET_COLOR.Vehicle },
    { id:"Unknown", label: t.unknown,  color: DET_COLOR.Unknown },
  ];
  // RADIUS.pill on both chips below, the one case the scale keeps that shape for: a label-only
  // chip with no set height, whose width follows its text, switching one condition on.
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
      {REEL_FILTER_CFG.map(f => {
        const active = filter === f.id;
        // A zero chip still shows its count — "no vehicles in this frame" is the answer, not a
        // missing one — but there's nothing behind it to filter to, so it doesn't take a click.
        const n = counts[f.id];
        const empty = n === 0;
        if (f.id === "All") {
          return (
            <button key="All" onClick={() => onChange("All")} disabled={empty}
              // Two classes because the pill has two fills. Unselected it is white inside a
              // gray-300 edge, which the outline hover was written for; selected it is gray-900,
              // and the row/outline tint would paint that selected fill away. Both classes carry
              // :not(:disabled), so a zero chip stays silent under the pointer.
              className={active ? "vca-hover-darken" : "vca-hover-outline"}
              style={{
              display:"flex", alignItems:"center", gap:"5px",
              padding:"6px 14px", borderRadius:RADIUS.pill, cursor: empty ? "default" : "pointer",
              border: active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)",
              backgroundColor: active ? "var(--gray-900)" : "white",
              color: active ? "white" : "var(--gray-700)", fontSize:"12px", fontWeight: active ? 700 : 600,
              opacity: empty ? 0.45 : 1,
            }}>
              {f.label}
              <FilterCount n={n} active={active} />
            </button>
          );
        }
        const c = f.color!;
        return (
          <button key={f.id} onClick={() => onChange(f.id)} disabled={empty}
            // Selected, this pill's fill is the detection type's own colour — purple for VIP —
            // which no neutral tint can sit on top of without changing what the colour says.
            className={active ? "vca-hover-darken" : "vca-hover-outline"}
            style={{
            display:"flex", alignItems:"center", gap:"5px",
            padding:"6px 10px", borderRadius:RADIUS.pill, cursor: empty ? "default" : "pointer",
            border: active ? `1px solid ${c}` : "1px solid var(--gray-300)",
            backgroundColor: active ? c : "white",
            color: active ? "white" : "var(--gray-700)", fontSize:"12px", fontWeight: active ? 700 : 600,
            opacity: empty ? 0.45 : 1,
          }}>
            <ReelFilterIcon type={f.id as DetType} color={c} active={active} />
            {f.label}
            <FilterCount n={n} active={active} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * The target's number within the frame, as "P-01".
 *
 * It belongs to where the detection sits in the FRAME's own list — not to where it landed in
 * whichever list is being drawn. The reel numbered its cards by their index in the FILTERED list,
 * so filtering to VIP renumbered the third target P-01 while the box around that same person on
 * the feed beside it still said P-03: one person, two numbers, one screen.
 *
 * Padded, because the widest frame here holds nine and the next one to hold ten read "P-010".
 */
function targetLabel(n: number) {
  return `P-${String(n).padStart(2, "0")}`;
}

/**
 * The detection class, in the reader's language. "VIP" is the same word in both.
 *
 * t.vehicle / t.unknown have been in T since the reel's filter chips were translated — the cards
 * sitting directly under those chips went on printing the raw English type, so one panel said
 * 차량 on the chip and Vehicle on the card it filtered to.
 */
function typeLabel(type: DetType, t: (typeof T)[AppLanguage]): string {
  return type === "Vehicle" ? t.vehicle : type === "Unknown" ? t.unknown : "VIP";
}

/* ── Tag chip ─────────────────────────────────────────────────────
   RADIUS.pill: nothing to click, no set height, width follows the word — the same shape the
   score badge and the count chips take. ──────────────────────────── */
function Tag({ label }: { label: string }) {
  return (
    <span style={{ backgroundColor:"var(--gray-100)", borderRadius:RADIUS.pill, padding:"3px 9px", fontSize:"12px", fontWeight:600, color:"var(--gray-600)", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

/* ── Also-captured card ───────────────────────────────────────────
   The narrow read-only "who else is in this frame" listing — nothing to click
   through to, unlike the reel cards, so a plain div rather than a button.

   It used to be described here as Live Monitoring's grid card (full-bleed
   photo, gradient, a face-crop bubble faked by scaling one photo 1.8x): that
   description outlived the photos themselves and is not what this draws any
   more. See the note inside. ──────────────────────────────────────────────── */
function AlsoCapturedCard({ det }: { det: Detection }) {
  const [lang] = useLanguage();
  const c = DET_COLOR[det.type];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"5px", width:"64px", flexShrink:0 }}>
      {/* Empty, not a stock face — see the note where AVATAR was removed. This row sat directly
          under the comparison boxes that had already been emptied for the same reason, so the
          panel was denying it had this person's picture at the top and showing one at the bottom.
          HANDOFF NOTE: the crop the module matched on, carried on the detection by id, goes here. */}
      <div style={{ width:"100%", aspectRatio:"1/1", borderRadius:RADIUS.inner, border:"1px dashed var(--gray-300)", backgroundColor:"var(--gray-50)", boxSizing:"border-box" }} />
      <p style={{ fontSize:"11px", fontWeight:700, color:"var(--gray-900)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", margin:0 }}>
        {det.name}
      </p>
      <span style={{ display:"flex", alignItems:"baseline", gap:"3px" }}>
        <span style={{ fontSize:"10px", fontWeight:800, color:c, letterSpacing:"-0.2px" }}>{typeLabel(det.type, T[lang])}</span>
        {det.type === "VIP" && <ScoreBadge score={det.confidence} size={10} />}
      </span>
    </div>
  );
}

/* ── Reel card ──────────────────────────────────────────────────
   Data monitoring's card (MonitorCard in DataPage.tsx): a capture filling the
   card, a white footer under it, one card per detection.

   Two of that card's parts are deliberately not here. The 60x60 enrolled-face
   inset needs the enrolled photo, which `Detection` does not carry and which
   must not be fetched by name. And the footer's third line, the timestamp, is
   one fact repeated nine times on this screen: a frame's detections all share
   its one stamp (see CAMERA_FEEDS in BestFramePage.tsx), and that stamp is
   already on the feed's own plate. ──────────────────────────────── */
function ReelCard({ det, targetNo, frameUrl, isFocused, onClick }: { det: Detection; targetNo: number; frameUrl?: string; isFocused: boolean; onClick: () => void }) {
  const [lang] = useLanguage();
  const c = DET_COLOR[det.type];
  const [hovered, setHovered] = useState(false);
  // No frame, no picture. A camera can arrive without a still, and then the card keeps the empty
  // dashed box below — a missing image has to look like a missing image, not like an empty room.
  const crop = frameUrl ? cropFrameStyle(det, CROP_WINDOW_ASPECT) : null;
  return (
    <div
      onClick={onClick}
      /* KEYBOARD. One stop per card, not a roving group: a frame holds a handful of detections
         (nine in the busiest one measured), they are the only operable things in this panel, and
         each one opens a different panel — a roving group would hide eight of nine behind arrow
         keys that this screen has already given to seeking the footage (see the ArrowLeft/
         ArrowRight listener below). role="button" because it opens Inspection Detail in place;
         the name is the card's own text — 「P-01 VIP 98.4% Dr. Alex Wong」 — so there is no new
         copy and nothing to keep in step with the visible label. */
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          // Space scrolls the reel, which is its own scroll box, before it ever reaches here.
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth:0, display:"flex", flexDirection:"column", gap:"6px", cursor:"pointer",
        // RADIUS.card on the shape that hovers and takes the focus ring; the picture box 8px in
        // from its edge takes 16 − 8 = 8 (RADIUS.control's value, used here as the nested radius
        // rather than as a control). This said RADIUS.inner and was 2px out: 6 is the 8 − 2 nest
        // inside a control, not a general 「inside something」 step.
        padding:"8px", margin:"-8px", boxSizing:"border-box", borderRadius:RADIUS.card,
        // Mirrors whichever detection is focused on the camera feed — clicking a box there (or
        // this card) keeps the two in sync, matching each other's "focused" outline rather than
        // this being its own independent selection state.
        //
        // HOVER DRAWS NO LINE (owner, 2026-09-23: 오른쪽에 카드에 라인이 있는 게 좀 이상해).
        // It used to add `1px solid var(--gray-300)` on the same edge at the same radius as the
        // focus ring, so a reel with one focused card and the pointer resting on another showed
        // TWO outlined cards — measured: P-01 at 2px rgb(24,17,39) and P-02 at 1px rgb(204,213,225),
        // the same radius, same 183x238 box. Two lines on one axis read as two selections, and
        // the weaker one wins the argument about which card is "current" because it is under the
        // pointer. The fill alone says hover, which is what the app's other lists already do
        // (rows: fill for hover, a line only for the selected one) — so a line on this screen now
        // means exactly one thing.
        // `undefined`, not "none": an inline `outline: none` is what silences the shared
        // :focus-visible ring in globals.css (that rule has no !important and inline always
        // wins — measured). Unset here, a card that is merely keyboard-focused draws the app's
        // standard ring (gray-900 hairline + gray-100 halo) and the focused card keeps its
        // 2px SELECTED outline, so the two states stay distinguishable.
        outline: isFocused ? `2px solid ${SELECTED}` : undefined,
        backgroundColor: hovered && !isFocused ? "var(--gray-50)" : "transparent",
        transition: "background-color 0.15s ease",
      }}
    >
      {/* --shadow-raised, the existing token for a surface sitting just off the one behind it. The
          card it is ported from writes its own 0 3px 8px -2px literal, which is one of the values
          the elevation tokens were introduced to replace; not this file's to change. */}
      <div style={{ borderRadius:RADIUS.control, overflow:"hidden", backgroundColor:"white",
        boxShadow:"var(--shadow-raised)" }}>
        {/* A face crop sat on top of a full-body capture here — the same stock portrait twice, the
            top one scaled 1.8x to fake a face zoom, both dealt out by the card's position in the
            list. What draws now is neither: it is this frame at this detection's own coordinates,
            with no box drawn on it. See cropFrameStyle. */}
        <div style={{
          position:"relative", width:"100%", aspectRatio:"1/1", overflow:"hidden", boxSizing:"border-box",
          ...(crop
            ? { backgroundColor:"var(--gray-900)" }
            : { border:"1px dashed var(--gray-300)", backgroundColor:"var(--gray-50)" }),
        }}>
          {crop && (
            <div style={crop}>
              {/* NO BOX ON THE CARD (owner, 2026-09-29). The card used to redraw the detector's
                  rectangle from det.top/left/width/height on top of this crop, the same four
                  percentages the feed uses. It is not what makes the card legible: cropFrameStyle
                  already puts that exact region in the middle at CROP_FIT (86%) of the limiting
                  axis, so the crop itself is the pointer and the line only repeated it — in the
                  measured data a 12%x36% box means the frame is blown up to ~425%, i.e. the card
                  is that person, not a frame with that person somewhere in it. The big analysis
                  frame on the left still draws every box (detBoxBorder, below): there one image
                  holds all the detections and a box is the only way to say which is which. */}
              <Photo kind="frame" src={frameUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            </div>
          )}
          {/* Which box on the feed this card belongs to. On imagery it takes the plate treatment
              every label drawn over footage uses (white on --label-plate); with the empty frame
              there is nothing under it, so it stays plain grey. */}
          <div style={{ position:"absolute", top:crop ? 7 : 6, left:crop ? 8 : 6, fontSize:"10px", letterSpacing:"-0.2px",
            ...(crop
              // RADIUS.pill, which is what the VIP plate down on the timeline strip already
              // drew: one plate treatment over imagery, not one shape here and another there.
              ? { fontWeight:800, color:"white", backgroundColor:"var(--label-plate)", padding:"4px 6px", borderRadius:RADIUS.pill }
              : { fontWeight:600, color:"var(--gray-500)" }),
          }}>
            {targetLabel(targetNo)}
          </div>
        </div>
        {/* The footer, at Data monitoring's padding. Its height is left to the content rather than
            pinned: the 76px there buys room for three lines under a photo the footer overlays, and
            a box pinned too short for its lines is what crushed that card's identity line to zero
            height. Nothing overlays anything here, so there is no number to get wrong. */}
        <div style={{ padding:"7px 11px 10px", display:"flex", flexDirection:"column", gap:"2px" }}>
          {/* Icon + colored text, no pill background — matches the Dashboard/Sidebar event
              panel's VIP/Tracking badge style (VipBadge/Tracking row in Sidebar.tsx) rather than
              the solid-fill pill this used before.
              Confidence is a match-against-registry score — only meaningful for VIP, since
              Vehicle/Unknown have nothing registered to match against. */}
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <TypeIcon type={det.type} color={c} size={12} />
            <span style={{ fontSize:"12px", fontWeight:800, color:c, letterSpacing:"-0.2px" }}>{typeLabel(det.type, T[lang])}</span>
            {det.type === "VIP" && <ScoreBadge score={det.confidence} size={10} />}
          </div>
          {/* The identity line. Attribute chips (gender, apparel) used to sit under it — with a
              reel that can grow to a lot of cards, that's more detail than a scanning glance
              needs; clicking through to Inspection Detail shows the full breakdown. */}
          <p style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.24px",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", margin:0 }}>
            {det.name}
          </p>
        </div>
      </div>
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
  const counts: Record<ReelFilter, number> = {
    All:     data.detections.length,
    VIP:     data.detections.filter(d => d.type === "VIP").length,
    Vehicle: data.detections.filter(d => d.type === "Vehicle").length,
    Unknown: data.detections.filter(d => d.type === "Unknown").length,
  };
  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", flexShrink:0, display:"flex", flexDirection:"column", gap:"12px" }}>
        <div>
          <p style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px" }}>{t.reelTitle}</p>
          <p style={{ fontSize:"11px", color:"var(--gray-400)", marginTop:"2px" }}>{t.reelSub}</p>
        </div>
        <ReelFilterBar filter={filter} onChange={onFilterChange} counts={counts} />
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
      {/* TWO COLUMNS, NOT FOUR. Four of them in this 380px panel made a 76px card: the names
          ellipsed at "Dr. Alex W···" and the picture area was too small to be a picture of
          anything. Two gives 166px, which fits every name in the frame this screen opens on and
          renders the reported region at roughly its own resolution (a 12%-wide box out of a
          900px still is ~108px of real pixels) rather than enlarging it into mush.
          The cost is scrolling, and it is paid by the busiest frame: nine targets are five rows
          of ~235px against ~555px of visible panel, so a little over two panel-heights. Three
          columns would fit them in three rows and put the names back in ellipses, which is the
          thing being fixed. */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"grid", gridTemplateColumns:"repeat(2, 1fr)", columnGap:"14px", rowGap:"16px", alignItems:"start" }}>
        {dets.length === 0 && (
          <div style={{ gridColumn:"1 / -1", padding:"24px 0", textAlign:"center", color:"var(--gray-400)", fontSize:"12px" }}>{t.noDetections}</div>
        )}
        {dets.map(det => (
          <ReelCard key={det.id} det={det} targetNo={data.detections.findIndex(d => d.id === det.id) + 1} frameUrl={data.bgUrl} isFocused={det.id === focusedId} onClick={() => { onFocus(det); onSelect(det); }} />
        ))}
      </div>
    </div>
  );
}

/* ── AI Inspection Detail panel ───────────────────────────────── */
function AIInspectionDetail({ det, data, onClose, onGoRedmapTrace }: { det: Detection; data: CamData; onClose: () => void; onGoRedmapTrace?: (name: string) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const c = DET_COLOR[det.type];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const maySeeEnrolled = holdsAppAction(portalUsers, "bestframeEnrolled");

  return (
    <div style={{ width:"380px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Padding tuned so this header's own bottom border lands at the exact same y as the page
          header's bottom border to its left (both act as one continuous line across the screen,
          not two independently-sized bars that happen to sit side by side) */}
      <div style={{ padding:"12px 16px 10px", borderBottom:BORDER, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontSize:"16px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.32px" }}>{t.inspectionDetail}</p>
        {/* The same drawn path as the export dialog's close below and the eleven others in the
            app. It was a text ✕, which at 16px has the font's own stroke weight and side bearings
            — next to a 1.5px stroked X it reads as a different control. Negative margin so the
            hover box grows without moving the icon off the header's right edge. */}
        <button onClick={onClose} aria-label={t.close} className="portal-icon-btn" style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-400)", padding:"3px", margin:"-3px", display:"flex" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
        {/* Photo comparison */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", marginBottom:"14px" }}>
          {/* NO FACES HERE UNTIL THEY ARE THIS PERSON'S.
              Two fixed image files used to sit on either side of the match percentage, captioned
              실시간 감지 and 등록 DB, with a tooltip calling the right one "the reference photo in
              the enrolled database". They were the same two pictures for every detection in the
              product — press any card and the same stranger appeared, with only the number
              changing. An operator's job at this panel is to confirm an identity by eye, and the
              screen was letting them confirm it against a stock photo.

              `Detection` (src/types/detection.ts) carries no image at all, and the enrolled photo
              lives on `Person.photoUrl`, reachable from here only by matching on name — the one
              join this codebase forbids. So there is nothing honest to draw, and the frame is left
              empty rather than filled.

              HANDOFF NOTE: this panel needs two images per detection — the crop the module matched
              on, and the enrolled photo of the person it matched to, carried by id. Until both
              arrive, no picture goes in these two boxes. */}
          <div style={{ flex:"0 0 77px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            {/* RADIUS.inner, like every other picture box on this screen. These two and the
                also-captured crop below them sat side by side at 8px, 10px and 6px — three
                radii for the same empty box, on one panel. */}
            <div style={{ width:"77px", height:"177px", borderRadius:RADIUS.inner, border:"1px dashed var(--gray-300)", backgroundColor:"var(--gray-50)" }} />
            <p title={t.liveCaptureHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"-0.2px", cursor:"help" }}>{t.liveCapture}</p>
          </div>
          <div style={{ flex:1, alignSelf:"flex-end", height:"177px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px" }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M5 4L3 6L5 8" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H13" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 12L13 10L11 8" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 10H3" stroke="var(--gray-400)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {/* The number this whole panel exists to show, so it is the one that takes 13px. */}
            <ScoreBadge score={det.confidence || 0} size={13} />
          </div>
          {/* ABSENT WITHOUT THE GRANT, not blanked (see AppAction "bestframeEnrolled"). The box
              beside it is the capture — what a camera saw in public — and this one is the
              customer's enrolment photograph, which is a separate thing to be allowed to look at.
              An account without it sees the capture and the match score and nothing where this
              stood; a greyed panel would advertise a photo it may not show. */}
          {maySeeEnrolled && (
          <div style={{ flex:"0 0 176px", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
            <div style={{ width:"176px", height:"177px", borderRadius:RADIUS.inner, border:"1px dashed var(--gray-300)", backgroundColor:"var(--gray-50)", display:"flex", alignItems:"center", justifyContent:"center", padding:"12px" }}>
              <p style={{ fontSize:"11px", color:"var(--gray-400)", textAlign:"center", lineHeight:1.5, margin:0 }}>{t.photosNotWired}</p>
            </div>
            <p title={t.enrolledDbHint} style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)", letterSpacing:"-0.2px", cursor:"help" }}>{t.enrolledDb}</p>
          </div>
          )}
        </div>

        {/* Name */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
          <TypeIcon type={det.type} color={c} size={15} />
          <span style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.32px" }}>{det.name}</span>
        </div>
        {/* det.group, which differs per detection — REGISTERED was keyed on the TYPE, so every
            VIP in the product read "Admin_Staff (Parking Zone F)" while the card beside it showed
            that person's real group. One panel, two answers. */}
        <p style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-500)", marginBottom:"14px" }}>{t.registeredAs} {det.group || t.noRegistration}</p>

        {/* Divider — info below is separated by rules, not a boxed container */}
        <div style={{ height:"1px", backgroundColor:"var(--gray-200)", marginBottom:"14px" }} />

        {/* Meta */}
        <div style={{ marginBottom:"14px" }}>
          {[[t.cameraName, data.location], [t.eventTime, `${det.date} ${det.time}`]].map(([k, v]) => (
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
        {/* The tag rows that stood here are gone with ATTRS — see the note on it. Nothing is
            drawn in their place: a detection that carries no attributes has none to show, and an
            empty row of labels would be the same promise the constants were making. */}
        <p style={{ fontSize:"12px", color:"var(--gray-400)", lineHeight:1.5, margin:0 }}>{t.noAttributes}</p>

        {/* Also captured in this frame */}
        {data.detections.filter(d => d.id !== det.id).length > 0 && (
          <>
            <p style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", letterSpacing:"-0.26px", marginTop:"22px", marginBottom:"12px" }}>{t.alsoCaptured}</p>
            {/* This row scrolls independently of the panel around it, so the panel's own padding
                stops giving the last card any clearance once you've scrolled past it — its
                box-shadow was getting clipped flush against this row's own right/bottom edge.
                Padding directly on the scrollable row itself fixes that at every scroll position. */}
            <div style={{ display:"flex", gap:"8px", overflowX:"auto", padding:"2px 10px 8px 2px" }}>
              {data.detections.filter(d => d.id !== det.id).map(d => (
                <AlsoCapturedCard key={d.id} det={d} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      {/* One column when this account cannot reach Redmap. The button is absent rather than
          disabled: it leads somewhere, and a control that leads nowhere reachable is worse than
          no control — see the note on the jump handlers in ClientLayout. */}
      <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns: onGoRedmapTrace ? "1fr 1fr" : "1fr", gap:"8px", flexShrink:0 }}>
        <button onClick={onClose} className={HOVER_QUIET} style={{ padding:"9px 0", borderRadius:RADIUS.control, border:BORDER, backgroundColor:"white", color:"var(--gray-700)", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          {t.back}
        </button>
        {onGoRedmapTrace && <button onClick={() => onGoRedmapTrace(det.name)} className="portal-btn-primary" style={{ padding:"9px 0", borderRadius:RADIUS.control, border:"none", backgroundColor:"var(--gray-900)", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M16.6667 8.33333C16.6667 13.3333 10 18.3333 10 18.3333C10 18.3333 3.33333 13.3333 3.33333 8.33333C3.33333 6.56522 4.03571 4.86953 5.28596 3.61929C6.5362 2.36905 8.23189 1.66667 10 1.66667C11.7681 1.66667 13.4638 2.36905 14.714 3.61929C15.9643 4.86953 16.6667 6.56522 16.6667 8.33333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 10.8333C11.3807 10.8333 12.5 9.71404 12.5 8.33333C12.5 6.95262 11.3807 5.83333 10 5.83333C8.61929 5.83333 7.5 6.95262 7.5 8.33333C7.5 9.71404 8.61929 10.8333 10 10.8333Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.trackOnMap}
        </button>}
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
  /* The other end of the same rule this calendar already applies to the future. A day the
     recorder no longer holds is not a day with nothing in it, and until now both produced the
     same empty reel — see retentionFloor() in vcaStore. Null where the site has not set a
     retention, and then nothing is barred. */
  const floor = useRetentionFloor();
  const floorKey = floor ? dateKey(floor.getFullYear(), floor.getMonth(), floor.getDate()) : null;
  const [viewYear, setViewYear] = useState(selYear);
  const [viewMonth, setViewMonth] = useState(selMonth - 1);
  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "numeric" });
  const isCurrentMonth = dateKey(viewYear, viewMonth, 1).slice(0, 7) === todayKey.slice(0, 7);
  /* The back arrow stops at the floor's month, the way the forward one stops at this one. */
  const atFloorMonth = !!floorKey && dateKey(viewYear, viewMonth, 1).slice(0, 7) <= floorKey.slice(0, 7);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"224px", padding:"12px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"24px" }}>
        <button onClick={prevMonth} disabled={atFloorMonth} className="vca-hover-quiet" style={{ width:"24px", height:"24px", borderRadius:RADIUS.inner, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor: atFloorMonth ? "default" : "pointer", visibility: atFloorMonth ? "hidden" : "visible", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{monthLabel}</span>
        <button onClick={nextMonth} disabled={isCurrentMonth} className="vca-hover-quiet" style={{ width:"24px", height:"24px", borderRadius:RADIUS.inner, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor: isCurrentMonth ? "default" : "pointer", visibility: isCurrentMonth ? "hidden" : "visible", color:"var(--gray-700)" }}>
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
          const gone = !!floorKey && key < floorKey;
          const barred = isFuture || gone;
          return (
            <button key={i} disabled={barred} onClick={() => onPick(key)}
              // A day is a list item, so the gray-50 tint — except the picked one, whose whole
              // cell is the SELECTED fill the tint would erase. Barred days are disabled, and
              // both classes stop at :not(:disabled), so a day outside retention stays dead.
              className={isSelected ? "vca-hover-darken" : "vca-hover-row"}
              style={{
              // Both marks are positional — the day you picked, and where today is — so both are
              // SELECTED. Purple here would be the third thing on this screen wearing the VIP colour.
              width:"28px", height:"28px", borderRadius:"50%", border: isToday && !isSelected ? `1px solid ${SELECTED}` : "none",
              backgroundColor: isSelected ? SELECTED : "transparent",
              color: isSelected ? "white" : barred ? "var(--gray-300)" : "var(--gray-900)",
              fontSize:"12px", fontWeight: isSelected ? 700 : 500, cursor: barred ? "default" : "pointer",
            }}>{day}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ ONE FRAME, OUT OF THE BUILDING ══════════════════════════════════════════════════════════
 *
 * Until now nothing could leave the operator app — not one still. The only exports in the whole
 * product were the Portal's four CSV buttons, so for a police request an operator's real options
 * were a phone camera or a screenshot, and the institution had no row saying a face had left.
 * 반출은 의무가 시작되는 지점이고, 그 지점이 없었다.
 *
 * WHAT THIS DOES NOT CLAIM, AND WHY THE LAST ATTEMPT WAS DELETED. There was an "증거 내보내기"
 * button here until 3c69916 took it out, and it deserved it: the file it wrote held no frame at
 * all (a manifest of ids and a URL, frame_sha256 null by design), it said in its own text that
 * nothing proved which installation made it, and the log it wrote was read by no screen. This is
 * the opposite on each count — the bytes ARE the frame, the row is read in the Portal's 반출
 * 기록, and the word "evidence" appears nowhere on the screen. A PNG assembled by a browser is a
 * copy of a picture, not a sealed exhibit, so the UI calls it a copy of a frame and stops there.
 * No hash, no signature, no evidence lock: those are claims only the recorder can make.
 *
 * ───── WHAT THE SERVER HAS TO OWN (this is the honest limit of this version) ─────
 *
 * 1. THE EXPORT HAS TO BE A SERVER CALL THAT LOGS BEFORE IT RETURNS BYTES. Everything below runs
 *    in the browser: the canvas is composed here and handed to the user here, so there is no
 *    request for a server to observe, and a client that writes its own audit row is a client that
 *    can skip writing it. `recordListExport` in vcaStore reached exactly this conclusion for the
 *    CSV buttons and points at a planned `src/lib/evidence.ts` — WHICH DOES NOT EXIST in this
 *    repo, so nothing here can lean on it. 고시 제8조제2항 makes it concrete: the monthly review
 *    has to catch a download and ask why, which only works if the download happened where the
 *    system could see it. The frame export belongs behind `POST /exports/frame` → the server
 *    renders, writes the register row, and only then streams the file.
 * 2. THE ACTOR. `SIGNED_IN_USER` is a module constant standing in for a session. The server takes
 *    the operator from the session, never from the body.
 * 3. THE TIME. A browser clock is not evidence of when anything happened.
 * 4. PERMISSION. There is no `AppAction` for exporting — the old `"export"` action went with
 *    3c69916 (17 grants → 16) and re-adding one touches `vcaStore.ts` and `appGrants.ts`, which
 *    this session does not own. So this control is open to anyone who can reach the screen. It is
 *    the biggest hole left here and it is named in the handover.
 * 5. `recordedBy`. `AuditEvent` carries it, `ExportRecord` does not — so the Portal cannot tell a
 *    row the browser wrote from one the server saw. The field belongs on ExportRecord.
 *
 * WHAT IT DOES PROMISE, AND KEEPS: the picture in the file is the picture that was on screen —
 * the same still, cover-cropped the same way, the same detection boxes, the same date-time plate,
 * and the viewer watermark burned in when the site has it on. Two deliberate differences, both
 * because they would make the copy WORSE than the frame the recorder holds: the feed's decorative
 * scanlines and its 0.9 opacity are display chrome and are not baked in, and the 11px VIP crown
 * glyph on a box label is not redrawn (the purple box and the name carry it). Nothing else is
 * added, removed or re-cropped.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A design-system value, resolved for a canvas.
 *
 * `fillStyle` cannot take `var(--gray-900)`, and the rule that only the 32 tokens may be used
 * does not bend for a canvas — so the tokens are read off the document instead of retyped as
 * hex. An unreadable token throws, and the handler below turns that into a refused export with
 * no record, which is the right outcome: if the copy cannot be drawn the way the screen draws it,
 * it must not go out looking almost right.
 */
function cssToken(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) throw new Error(`BestFrameDetailPage: design token ${name} is not defined`);
  return value;
}

/**
 * The still, loaded so its pixels can be read back out again.
 *
 * `crossOrigin` on every request, including the same-origin ones: a same-origin response has no
 * CORS header to fail against, and without it a remote feed taints the canvas so `toBlob` throws.
 * A camera whose still cannot be read with CORS cannot be exported — and that is reported as a
 * failure rather than papered over with a blank frame.
 */
function loadFrameImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("BestFrameDetailPage: the frame image could not be read"));
    img.src = src;
  });
}

interface FrameExportInput {
  bgUrl: string;
  /** Exactly the boxes the screen is drawing right now — the caller filters, not this. */
  boxes: { det: Detection; targetNo: number; focused: boolean }[];
  /** The frame's own date-time plate, in the form the screen already prints it. */
  stamp: string;
  /** The viewer stamp, or null when the site has the watermark switched off. */
  watermark: string | null;
  fontFamily: string;
}

function plate(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, radius: number, fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  // roundRect is the one path primitive here that is not universally old; a square plate is a
  // correct plate, so the fallback draws one rather than skipping the fill.
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/**
 * The frame on screen, as a PNG.
 *
 * Geometry first, because this is where a copy quietly stops being the same picture. The feed is
 * a 16/9 box with `objectFit: cover`, so the export is the centred 16/9 crop of the source at its
 * OWN pixels — never scaled up, never letterboxed. Everything drawn over it is sized through `k`,
 * the ratio of this canvas to the 540px-tall frame the screen's own px values were written for,
 * so a mark keeps its proportion instead of becoming a speck on a large still.
 */
async function composeFrameExport(input: FrameExportInput): Promise<Blob> {
  const img = await loadFrameImage(input.bgUrl);
  const natW = img.naturalWidth, natH = img.naturalHeight;
  if (!natW || !natH) throw new Error("BestFrameDetailPage: the frame image has no pixels");

  let sw: number, sh: number;
  if (natW / natH > FRAME_ASPECT) { sh = natH; sw = Math.round(sh * FRAME_ASPECT); }
  else { sw = natW; sh = Math.round(sw / FRAME_ASPECT); }
  const sx = Math.round((natW - sw) / 2), sy = Math.round((natH - sh) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("BestFrameDetailPage: no 2d context");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const k = sh / 540;
  const white = cssToken("--gray-0");
  ctx.textBaseline = "alphabetic";

  /* The boxes, in the feed's own line language — see detBoxBorder, which this follows value for
     value: VIP purple because identity is not a focus state, dashed for an absent identification,
     and the focused one ringed in SELECTED outside its own border rather than recoloured. */
  for (const { det, targetNo, focused } of input.boxes) {
    const left = pctOf(det.left), top = pctOf(det.top);
    const bw = pctOf(det.width), bh = pctOf(det.height);
    if (left === null || top === null || !bw || !bh) continue;
    const x = left * sw, y = top * sh, w = bw * sw, h = bh * sh;

    ctx.save();
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = cssToken(det.type === "VIP" ? "--primary-400" : "--type-vehicle");
    if (det.type === "Unknown") ctx.setLineDash([6 * k, 4 * k]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    if (focused) {
      ctx.save();
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = cssToken("--gray-900");
      const o = 2.5 * k; // half the box's own 2px border plus half this 3px ring
      ctx.strokeRect(x - o, y - o, w + o * 2, h + o * 2);
      ctx.restore();
    }

    /* The white label plate above the box: "P-01" in grey, the name in near-black, at the feed's
       own 3px/8px padding and 5px gap. An unfocused box's label is at 0.85, as on screen. */
    const labelFont = `600 ${Math.round(10 * k)}px ${input.fontFamily}`;
    ctx.save();
    ctx.globalAlpha = focused ? 1 : 0.85;
    ctx.font = labelFont;
    const no = targetLabel(targetNo);
    const noW = ctx.measureText(no).width;
    const nameW = ctx.measureText(det.name).width;
    const padX = 8 * k, padY = 3 * k, gap = 5 * k;
    const plateH = Math.round(10 * k * 1.25) + padY * 2;
    const plateW = noW + gap + nameW + padX * 2;
    const plateY = y - 4 * k - plateH;
    plate(ctx, x, plateY, plateW, plateH, 0, white);
    const textY = plateY + plateH - padY - 1.5 * k;
    ctx.fillStyle = cssToken("--gray-500");
    ctx.fillText(no, x + padX, textY);
    ctx.fillStyle = cssToken("--gray-900");
    ctx.fillText(det.name, x + padX + noW + gap, textY);
    ctx.restore();
  }

  /* The frame's own date-time plate, top right, where the screen puts it. */
  {
    ctx.save();
    ctx.font = `600 ${Math.round(10 * k)}px ${input.fontFamily}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${0.5 * k}px`;
    const padX = 8 * k, padY = 3 * k;
    const textW = ctx.measureText(input.stamp).width;
    const h = Math.round(10 * k * 1.25) + padY * 2;
    const x = sw - 14 * k - (textW + padX * 2), y = 12 * k;
    plate(ctx, x, y, textW + padX * 2, h, 0, cssToken("--label-plate"));
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = white;
    ctx.fillText(input.stamp, x + padX, y + h - padY - 1.5 * k);
    ctx.restore();
  }

  /* WHO WAS WATCHING, BURNED IN. The overlay on screen is a DOM node anybody can delete, so a
     copy that left without it would carry nothing back to a session. Same corner, same scrim
     plate, same 0.72 — and absent entirely when the site has the watermark off, because a file
     that stamps a name the site chose not to show would be the console inventing attribution.
     HANDOFF NOTE: the stamp string is rebuilt here from the same project, user and zone
     ViewerWatermark reads. Two copies of one sentence can drift — ViewerWatermark should export
     the builder and both should call it. */
  if (input.watermark) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.font = `600 ${Math.round(10 * k)}px ${input.fontFamily}`;
    const padX = 7 * k, padY = 3 * k;
    const textW = ctx.measureText(input.watermark).width;
    const h = Math.round(10 * k * 1.25) + padY * 2;
    const x = 8 * k, y = sh - 8 * k - h;
    plate(ctx, x, y, textW + padX * 2, h, 6 * k, cssToken("--scrim"));
    ctx.fillStyle = white;
    ctx.fillText(input.watermark, x + padX, y + h - padY - 1.5 * k);
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("BestFrameDetailPage: the frame could not be encoded");
  return blob;
}


type RequesterKind = NonNullable<ExportRecord["requesterKind"]>;

const EXPORT_FIELD_STYLE: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: RADIUS.control,
  border: "1px solid var(--gray-300)", outline: "none",
  fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", fontFamily: "inherit",
  backgroundColor: "white",
};

function ExportFieldLabel({ text, required = false }: { text: string; required?: boolean }) {
  return (
    <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", marginBottom: "5px" }}>
      {text}{required && <span style={{ color: "var(--danger-400)", marginLeft: "3px" }}>*</span>}
    </span>
  );
}

/**
 * ASK, THEN EXPORT.
 *
 * A frame of a face leaving the institution is 목적 외 이용 or 제3자 제공 (법 제18조), so a plain
 * "save" button is the wrong shape — the register has to be filled before the file exists, not
 * reconstructed from memory afterwards. Milestone's Smart Client and Genetec Clearance both stop
 * at a dialog before an export for the same reason; what is taken from them is the stop, not
 * their contents (see the reference notes in the handover).
 *
 * FOUR QUESTIONS, NOT SEVEN. The register wants seven items and this screen already knows three
 * of them — which footage (one camera, one instant), the file's name, and that the form is a copy
 * — so it states them and does not ask. Asking an operator to retype what is on the screen above
 * them is how a register fills up with approximations.
 *
 * Only 요청 구분 and 법령상 근거 are required. 제공받는 자 and 목적 are the two an urgent handover
 * genuinely fills in later, and blocking on them would push the operator back to a phone camera,
 * which records nothing at all.
 */
function FrameExportDialog({ subject, footage, fileName, watermarkOn, othersInFrame, onCancel, onConfirm }: {
  subject: string;
  footage: string;
  fileName: string;
  watermarkOn: boolean;
  /** How many people other than the one named are in the picture — decides the masking notice. */
  othersInFrame: number;
  onCancel: () => void;
  onConfirm: (fields: { requesterKind: RequesterKind; recipient: string; reason: string; legalBasis: string }) => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [requesterKind, setRequesterKind] = useState<RequesterKind | null>(null);
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [busy, setBusy] = useState(false);
  useEscapeKey(onCancel, !busy);

  const ready = requesterKind !== null && legalBasis.trim().length > 0;
  const KINDS: { id: RequesterKind; label: string }[] = [
    { id: "subject", label: t.exportKindSubject },
    { id: "police", label: t.exportKindPolice },
    { id: "thirdParty", label: t.exportKindThirdParty },
  ];
  const facts: [string, string][] = [
    [t.exportSubject, subject],
    [t.exportFootage, footage],
    [t.exportFile, fileName],
    [t.exportWatermark, watermarkOn ? t.exportWatermarkOn : t.exportWatermarkOff],
  ];

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: RADIUS.card, border: BORDER, width: "100%", maxWidth: "468px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow-modal)" }}>

        <div style={{ padding: "14px 16px", borderBottom: BORDER, backgroundColor: "var(--gray-50)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.28px" }}>{t.exportFrame}</p>
          {/* Same class as the Inspection Detail close above, which the note there already
              points at — two identical drawn X's answering the pointer two different ways would
              be the thing that note was written to stop. */}
          <button onClick={onCancel} disabled={busy} aria-label={t.exportCancel} className="portal-icon-btn"
            style={{ padding: "4px", border: "none", background: "none", cursor: busy ? "default" : "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* What is already known, stated rather than asked. */}
          {/* RADIUS.control on this block and on the notice below it: they stand in the same
              column as the dialog's fields, which are the control step, and a column with one
              edge is the point. The dialog itself is the card step. */}
          <div style={{ border: BORDER, borderRadius: RADIUS.control, padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {facts.map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", width: "66px", flexShrink: 0 }}>{label}</span>
                {/* break-word, not break-all: break-all split the clock time across two lines as
                    "12:34:0 / 0", and a time that reads as two numbers is the one value on this
                    panel that must not be misread. The file name breaks at its own hyphens. */}
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)", overflowWrap: "break-word", minWidth: 0 }}>{value}</span>
              </div>
            ))}
          </div>

          <div>
            <ExportFieldLabel text={t.exportRequesterKind} required />
            <div role="radiogroup" aria-label={t.exportRequesterKind} style={{ display: "flex", gap: "6px" }}>
              {KINDS.map(kind => {
                const on = requesterKind === kind.id;
                return (
                  <button key={kind.id} role="radio" aria-checked={on} onClick={() => setRequesterKind(kind.id)}
                    // Selected, the chip is the SELECTED fill; a neutral tint on it would read
                    // as the selection letting go.
                    className={on ? "vca-hover-darken" : HOVER_QUIET}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: RADIUS.control, cursor: "pointer",
                      // SELECTED, like every other mark on this screen — see the note on it.
                      border: on ? `1px solid ${SELECTED}` : "1px solid var(--gray-300)",
                      backgroundColor: on ? SELECTED : "white",
                      color: on ? "white" : "var(--gray-700)",
                      fontSize: "12px", fontWeight: on ? 700 : 600, fontFamily: "inherit",
                    }}>
                    {kind.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 표준지침 제46조 binds on ONE of the three paths — footage given to the data subject
              with other identifiable people in it. Said, not fixed: this console has no masking
              and must not imply one is a click away. */}
          {requesterKind === "subject" && othersInFrame > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: RADIUS.control, backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-200)" }}>
              <span style={{ display: "flex", flexShrink: 0, marginTop: "1px", color: "var(--warning-500)" }}>
                <CircleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, lineHeight: 1.5, color: "var(--warning-500)" }}>
                {t.exportMaskNotice}
              </p>
            </div>
          )}

          <div>
            <ExportFieldLabel text={t.exportLegalBasis} required />
            <input value={legalBasis} onChange={e => setLegalBasis(e.target.value)}
              placeholder={t.exportLegalBasisHint} style={EXPORT_FIELD_STYLE} />
          </div>
          <div>
            <ExportFieldLabel text={t.exportRecipient} />
            <input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder={t.exportRecipientHint} style={EXPORT_FIELD_STYLE} />
          </div>
          <div>
            <ExportFieldLabel text={t.exportPurpose} />
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder={t.exportPurposeHint} style={EXPORT_FIELD_STYLE} />
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderTop: BORDER, flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onCancel} disabled={busy} className="vca-hover-outline"
            style={{ padding: "9px 16px", borderRadius: RADIUS.control, border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "13px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
            {t.exportCancel}
          </button>
          <button
            onClick={() => {
              if (!ready || busy) return;
              setBusy(true);
              onConfirm({ requesterKind: requesterKind!, recipient: recipient.trim(), reason: reason.trim(), legalBasis: legalBasis.trim() });
            }}
            disabled={!ready || busy}
            // Only the live button darkens: unfilled and mid-export it is disabled, and the
            // class stops there, so the grey state never pretends it is about to do something.
            className="vca-hover-darken"
            style={{
              padding: "9px 18px", borderRadius: RADIUS.control, border: "none",
              backgroundColor: ready && !busy ? "var(--gray-900)" : "var(--gray-200)",
              color: ready && !busy ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: ready && !busy ? "pointer" : "default", fontFamily: "inherit",
            }}>
            {busy ? t.exportBusy : t.exportGo}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function BestFrameDetailPage({ data, initialDet, onBack, onGoRedmapTrace, autoOpenDetail, initialDate, initialTime, camId }: DetailProps) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [selectedPerson, setSelectedPerson] = useState<Detection | null>(autoOpenDetail ? initialDet : null);
  const [focusedDet, setFocusedDet] = useState<Detection>(initialDet);
  // The day of the detection being inspected, not today — the strip is scrubbing that frame's
  // own footage. A caller that names a moment (Dashboard's "Analyze Frame") overrides both.
  const [trackDate, setTrackDate] = useState(() => initialDate ?? initialDet.date);
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
    // The moment being inspected. This used to seed from the clock — first the machine's, then
    // the site's — which opened the strip wherever "now" happened to be rather than on the frame
    // the operator clicked.
    return hhmmssToSec(initialDet.time);
  });
  // The thumbnail strip's own center — deliberately separate from selectedSec. Clicking a
  // thumbnail only needs to move the selection onto whatever's already on screen; recomputing
  // the window around it too made the whole strip re-lay-out under a click that clearly landed
  // on a specific spot, which read as "did that even register?" rather than a real selection.
  // Only explicit navigation (step/arrow keys, Jump to, the hour/minute bars) re-centers the
  // window — see jumpTo() below.
  const [windowCenterSec, setWindowCenterSec] = useState(selectedSec);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** The previous selection, kept so the strip can tell which way a jump went. Written only from
   *  the scroll effect below, never during render. */
  const prevSelRef = useRef(selectedSec);

  /* ── Frame export ─ see the block above FrameExportDialog ───────────────── */
  const [exportOpen, setExportOpen] = useState(false);
  const projects = useVcaStore(s => s.projects);
  const exportPortalUsers = useVcaStore(s => s.portalUsers);
  /* 프레임 반출 권한 — see the button's own note. No existing account holds it, by design. */
  const mayExport = holdsAppAction(exportPortalUsers, "export");
  const recordFootageExport = useVcaStore(s => s.recordFootageExport);
  const exportProjectId = useActiveProjectId();
  const { showToast } = useToast();
  const exportProject = projects.find(p => p.id === exportProjectId);
  /* Absent means on — the same reading ViewerWatermark gives Project.evidenceWatermark. */
  const watermarkOn = exportProject?.evidenceWatermark !== false;
  const exportZone = exportProject?.timeZone ?? siteTimeZone();

  /* Exactly the boxes the feed below is drawing, with the frame's own numbering: Inspection
     Detail hides every box but the focused one, and the copy has to match the screen. */
  const drawnBoxes = data.detections
    .map((det, i) => ({ det, targetNo: i + 1, focused: det.id === focusedDet.id }))
    .filter(box => !selectedPerson || box.focused);
  /* Whose faces leave besides the one named. Vehicles are not faces and are not counted here —
     the plate is in the picture either way, which is what `period` and the file itself record. */
  const othersInFrame = data.detections.filter(d => d.type !== "Vehicle" && d.id !== focusedDet.id).length;
  /* The register is not translated — the same rule every seeded record in the store follows — so
     the stored subject is built in English and only the dialog's copy of it follows the UI. */
  const exportSubject = othersInFrame > 0
    ? `${focusedDet.name} + ${othersInFrame} other${othersInFrame === 1 ? "" : "s"} in frame`
    : focusedDet.name;
  const exportSubjectShown = othersInFrame === 0
    ? focusedDet.name
    : lang === "ko" ? `${focusedDet.name} · 외 ${othersInFrame}명 함께 촬영` : exportSubject;
  /* ⑤ 영상의 범위: one camera, one instant, and the zone that instant is read in. */
  const exportPeriod = `${data.camLabel} · ${data.location} · ${focusedDet.date} ${focusedDet.time} (${exportZone})`;
  const exportFileName = `${data.camLabel}_${focusedDet.date}_${focusedDet.time.replace(/:/g, "")}.png`;

  const runFrameExport = async (fields: { requesterKind: RequesterKind; recipient: string; reason: string; legalBasis: string }) => {
    try {
      const now = new Date();
      const who = currentPortalUser(exportPortalUsers)?.name ?? SIGNED_IN_USER.name;
      const blob = await composeFrameExport({
        bgUrl: data.bgUrl ?? "",
        boxes: drawnBoxes,
        // The plate the feed prints, character for character.
        stamp: `${focusedDet.date.split("-").reverse().join("-")} ${focusedDet.time}`,
        watermark: watermarkOn ? viewerStampText(who, now, exportZone) : null,
        fontFamily: getComputedStyle(document.body).fontFamily,
      });

      /* BYTES FIRST, THEN THE ROW, and never the other way round: a register that holds an export
         nobody could produce is worse than one row short. The reverse gap is real and is the
         server's to close — once the anchor is clicked the browser owns the download, and a user
         who cancels the save dialog leaves a row for a file that never landed. That disappears the
         moment the bytes come from a server call that logged them (see the handoff note above). */
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Not revoked on this tick — Chrome has cancelled downloads whose blob URL went away while
      // the save was still being set up.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);

      recordFootageExport({
        projectId: exportProjectId,
        kind: "frame",
        surface: "bestframe",
        subject: exportSubject,
        rowCount: 1,
        fileName: exportFileName,
        requesterKind: fields.requesterKind,
        // Written only where the operator wrote something. An empty string in the register reads
        // as an answered question.
        recipient: fields.recipient || undefined,
        reason: fields.reason || undefined,
        legalBasis: fields.legalBasis,
        period: exportPeriod,
        /* ⑥ Always a copy: this screen hands over a file. 출력 and 화면 are the other two the
           register distinguishes and neither is what this button does, so neither is offered. */
        form: "copy",
      });
      setExportOpen(false);
      showToast({ variant: "success", title: t.exportedTitle, desc: t.exportedDesc });
    } catch {
      /* The frame could not be read or drawn — most often a still the browser will not let a
         canvas read back. Nothing left, so nothing is recorded, and the screen says both. */
      setExportOpen(false);
      showToast({ variant: "error", title: t.exportFailedTitle, desc: t.exportFailedDesc });
    }
  };

  const axisSpanSec = AXIS_SPAN_SEC;
  const axisStartSec = windowCenterSec - axisSpanSec / 2;
  /* Wrapped the way the clock wraps. `stepBy` has no floor — 「◀ 10s」 from 00:00:05 puts
     selectedSec at -5 — and a bare `%` leaves that negative: currentHour came out -1, currentMinute
     -1, and no cell in either bar matched. Meanwhile secToHHMMSS normalises the same value and
     prints 23:59:55, so the screen read 「23:59:55」 with NOTHING marked on either bar. Same
     normalisation here, so the bars follow the clock across midnight in both directions. */
  const dayClockSec = ((selectedSec % 86400) + 86400) % 86400;
  const currentHour = Math.floor(dayClockSec / 3600) % HOURS_IN_DAY;
  const currentMinute = Math.floor((dayClockSec % 3600) / 60);

  /* Which hours and minutes of the shown day this camera actually has records in.
     The bars used to draw 24 and 60 cells that were all --gray-200, so the only thing on the row
     was the cell you had just clicked — a slider with 24 notches wearing a timeline's clothes.
     Counted from the store's own events by cameraId and the site's clock, so a day with nothing
     in it looks like a day with nothing in it. Minute counts are for the selected hour only,
     which is what the second bar spans. */
  const dayEvents = useVcaStore(s => s.events);
  const occupancy = useMemo(() => {
    const hours = new Array<number>(HOURS_IN_DAY).fill(0);
    const minutes = new Array<number>(60).fill(0);
    /* The earliest second a record sits at, per hour and per minute. A crown on an hour promises
       「something happened in here」, and the click has to land ON it: before this, clicking hour 1
       kept whatever minute you were already at (jumpTo(h*3600 + selectedSec%3600)), so from 14:54
       it went to 01:54 while the hit was at 01:47 — seven minutes outside the strip's 120-second
       window, which is why the thumbnail it landed on carried no count (owner, 2026-10-12: 아래
       시각에 왕관을 눌렀는데 위에 선택된 썸네일에 왕관 몇명인지 안뜨는건 뭐야). */
    const hourAt = new Array<number | null>(HOURS_IN_DAY).fill(null);
    const minuteAt = new Array<number | null>(60).fill(null);
    const note = (daySec: number) => {
      const h = Math.floor(daySec / 3600) % HOURS_IN_DAY;
      const m = Math.floor((daySec % 3600) / 60);
      if (hourAt[h] == null || daySec < hourAt[h]!) hourAt[h] = daySec;
      if (h === currentHour && (minuteAt[m] == null || daySec < minuteAt[m]!)) minuteAt[m] = daySec;
    };
    if (!camId) return { hours, minutes, hourAt, minuteAt, known: false };
    const zone = siteTimeZone();
    for (const e of dayEvents) {
      if (e.cameraId !== camId) continue;
      // Person hits only. addEvent also takes plain system events with no personType (see the note
      // on VcaEvent), and a device log is not what a crown-coloured cell on a VIP timeline claims.
      if (e.personType == null) continue;
      const when = new Date(e.timestamp);
      if (Number.isNaN(when.getTime())) continue;
      if (dateKeyIn(when, zone) !== trackDate) continue;
      const h = sgtHour(when);
      hours[h] += 1;
      if (h === currentHour) minutes[sgtMinute(when)] += 1;
      note(hhmmssToSec(sgtClockTime(when)));
    }
    /* And the frame that is on screen right now.
       The grid counts the store's events; the feed above draws a curated CamData frame, and the
       two are different sources (see the project note on the app's two data paths). Measured, that
       crack was visible in one screenshot: the minute cell for the selected minute was empty while
       the picture above it showed that minute's detections. A row that says 「nothing here」 under a
       picture of something here is the screen telling a lie, so the frame's own VIP detections are
       folded in. Not a foreign source — the frame IS this camera's record of that moment. VIP only,
       because a purple cell on this row claims a VIP sighting and the store has no vehicle or
       unknown events to balance it with. */
    for (const d of data.detections) {
      if (d.type !== "VIP") continue;
      if (d.date !== trackDate) continue;
      const [hh, mm] = d.time.split(":").map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
      hours[hh % HOURS_IN_DAY] = (hours[hh % HOURS_IN_DAY] ?? 0) + 1;
      if (hh % HOURS_IN_DAY === currentHour) minutes[mm] = (minutes[mm] ?? 0) + 1;
      note(hhmmssToSec(d.time));
    }
    return { hours, minutes, hourAt, minuteAt, known: true };
  }, [dayEvents, camId, trackDate, currentHour, data.detections]);
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
  // Each VIP detection marks exactly one thumbnail — the nearest sample. A per-thumbnail
  // "within half a step" test double-counted: one detection at :00 is a second from both the
  // :59 and the :01 thumbnail, so the same person was drawn as two sightings.
  const vipByThumb = new Map<number, number>();
  const markThumb = (daySec: number) => {
    const i = Math.round((daySec - axisStartSec) / THUMB_STEP_SEC);
    if (i < 0 || i >= THUMB_COUNT) return;
    vipByThumb.set(i, (vipByThumb.get(i) ?? 0) + 1);
  };
  for (const d of data.detections) {
    if (d.type !== "VIP") continue;
    if (d.date !== trackDate) continue;
    markThumb(hhmmssToSec(d.time));
  }
  /* And the store's own hits for this camera, which is where the hour bar's crowns come from.
     This map used to read data.detections alone, so the two rows disagreed: clicking a crown in
     the bar jumped to that hour and the thumbnail that landed there carried no count (owner,
     2026-10-12: 아래 시각에 왕관을 눌렀는데 위에 선택된 썸네일에 왕관 몇명인지 안뜨는건 뭐야).
     Same crack as the one occupancy had, in the other direction — the bar knew about the store and
     the strip did not. Both read both now.

     The badge itself was never gated on selection; it draws wherever the count is above zero. The
     reason it looked like it only appeared on the selected frame is that every detection in a
     curated CamData frame carries ONE timestamp, so exactly one thumbnail in the window could
     ever have a count. With the store's hits folded in, any thumbnail at a time this camera
     actually saw someone carries one. */
  for (const e of dayEvents) {
    if (e.cameraId !== camId) continue;
    if (e.personType == null) continue;
    const when = new Date(e.timestamp);
    if (Number.isNaN(when.getTime())) continue;
    if (dateKeyIn(when, siteTimeZone()) !== trackDate) continue;
    markThumb(hhmmssToSec(sgtClockTime(when)));
  }
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
    if (dateOpen || selectedPerson || exportOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") stepBy(e.shiftKey ? -10 : -1);
      else if (e.key === "ArrowRight") stepBy(e.shiftKey ? 10 : 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // exportOpen is in here because the export dialog is typing room: an arrow key in its Legal
    // basis field was also seeking the footage behind the scrim.
  }, [dateOpen, selectedPerson, exportOpen]);

  /* Keeps the selected thumbnail in view as it changes — but ONLY when it is not already in view.
     The comment here used to say "a plain thumbnail click never needs this since whatever was
     clicked is already on screen", and then scrolled on every change anyway. So every click
     re-centred the strip: the frame you had just aimed at slid to the middle and everything else
     slid under your cursor, which is why the selection always appeared in the centre no matter
     which one you picked (owner, 2026-10-12: 어느시간을 선택해도 모두 가운데에서 시간이 바뀌거든
     … 인터렉션이 어색하다). Now a click leaves the strip where it is and the ring moves to what you
     clicked; stepping or jumping to a frame that is off to one side still brings it in. */
  useEffect(() => {
    const el = thumbRefs.current[centerThumbIdx];
    const strip = el?.parentElement;
    if (!el || !strip) return;
    /* Was this an explicit jump, and which way? Read off the state rather than carried in a
       flag — a one-shot flag has to be cleared, and clearing it from in here is a setState inside
       an effect. Only jumpTo() moves the window onto the selection, so windowCenterSec ===
       selectedSec marks an explicit navigation; a thumbnail click leaves the window where it was,
       and a 1s/10s step lands within the strip's own span. */
    const prev = prevSelRef.current;
    prevSelRef.current = selectedSec;
    const jumped = windowCenterSec === selectedSec && Math.abs(selectedSec - prev) > AXIS_SPAN_SEC / 2;
    const e = el.getBoundingClientRect();
    const s = strip.getBoundingClientRect();
    // A plain click: leave the strip alone if what was clicked is already on screen.
    if (!jumped && e.left >= s.left && e.right <= s.right) return;
    /* AFTER A JUMP THE LANDING FRAME IS NOT CENTRED (owner, 2026-10-12: 시간순서니까 비율에
       맞춰서 오른쪽에 위치해있거나 왼쪽에 선택된 상태로 보여지거나). Jump forward and it lands at
       a quarter in from the left, so the 90 seconds AFTER it — where you are heading — are the
       part you can see; jump back and it lands three quarters over, so what came before it is
       on screen instead. Dead centre says nothing about which way you moved, and that was the
       whole complaint: every jump looked identical.

       What this is NOT is the strip travelling across the intervening hours. It holds
       THUMB_COUNT × THUMB_STEP_SEC = 120 seconds; 06:00 to 20:00 is 14 hours, so there is nothing
       between the two to scroll through — rendering it would be 25,200 thumbnails. The window is
       rebuilt at the new time and the strip scrolls, smoothly, to the off-centre landing spot. */
    const frac = !jumped ? 0.5 : selectedSec > prev ? 0.25 : 0.75;
    const left = strip.scrollLeft + (e.left + e.width / 2 - s.left) - s.width * frac;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [centerThumbIdx, selectedSec, windowCenterSec]);

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
            <button onClick={onBack} className="portal-link" style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", color:"var(--gray-500)", fontSize:"13px", fontWeight:600 }}>
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
              {/* The day of the frame on screen. This was today's date, so a frame captured
                  before midnight was labelled with the wrong day — and, paired with its own
                  clock time, read as a moment that has not happened yet. */}
              {focusedDet.date}
            </div>
          </div>
          {/* THE WAY OUT, ON THE FRAME'S OWN HEADER.
              It sits here and not in a panel because this row is already touching the frame — the
              operator's eye is a couple of centimetres away and nothing has to be covered to
              reach it. A control that opens over the video is a control that hides the thing it
              is about. Grey, like the date and Jump to buttons below the strip: taking a face out
              of the building is consequential, which is what the dialog is for, and it is not an
              emergency, which is what a red or purple button would say.
              Absent with no still — a camera can arrive without one, and there is then no frame
              to copy (the feed above shows the same nothing). */}
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            {/*
              SHOWN AND REFUSED, NOT HIDDEN (grant: `export`, added 2026-10-07 — see its note on
              AppAction). An operator told over the radio to send the file has to be able to learn
              that the grant is missing; a button that is simply absent sends them looking for a
              screen that does not exist, and then asking the wrong person.

              Nobody holds this grant until an administrator ticks it, which is the owner's call
              and the point of adding it: before today, anyone who could reach this page could put
              a face in a file.
            */}
            {data.bgUrl && (
              <button
                onClick={mayExport ? () => { setDateOpen(false); setTimeOpen(false); setExportOpen(true); } : undefined}
                disabled={!mayExport}
                title={mayExport ? undefined : t.exportNoGrant}
                className={mayExport ? HOVER_QUIET : undefined}
                style={{ display:"inline-flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:RADIUS.control, padding:"6px 12px", border:"1px solid var(--gray-300)", cursor: mayExport ? "pointer" : "not-allowed", fontFamily:"inherit", fontSize:"12px", fontWeight:700, color: mayExport ? "var(--gray-900)" : "var(--gray-300)" }}>
                <ImageDown size={14} strokeWidth={2} aria-hidden="true" />
                {t.exportFrame}
              </button>
            )}
            <div style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-500)" }}>
              AI engine v5.22.2
            </div>
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
              // RADIUS.panel — the value this frame has always drawn, now named. It is not a
              // control and not a card in a list: it is the surface the footage is on, and the
              // scale's panel step is where a surface that holds something else sits.
              maxHeight:"100%", aspectRatio:"16/9", flexShrink:0, borderRadius:RADIUS.panel, overflow:"hidden", backgroundColor:"var(--gray-900)",
            }}
          >
            <Photo kind="frame" src={data.bgUrl ?? ""} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", opacity:0.9 }} />
            <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"linear-gradient(to bottom,rgba(24, 17, 39,0) 50%,rgba(24, 17, 39,0.04) 50%)", backgroundSize:"100% 4px" }} />
            {/* Plain white. --label-plate is already the dimming — a 0.8 alpha on top of it was
                the only dimmed white text in the app, and it was on the one plate that carries
                the frame's own timestamp. */}
            <div style={{ position:"absolute", top:12, right:14, backgroundColor:"var(--label-plate)", padding:"3px 8px", fontSize:"10px", fontWeight:600, color:"white", letterSpacing:"0.5px" }}>
              {focusedDet.date.split("-").reverse().join("-")} {focusedDet.time}
            </div>

            {data.detections.map((det, i) => {
              const isFocused = det.id === focusedDet.id;
              if (selectedPerson && !isFocused) return null;
              return (
                <div key={det.id}
                  // Just focuses — the same "highlight, don't commit" action as clicking this
                  // detection's card in the reel on the right. Opening Inspection Detail is a
                  // separate, deliberate step (the reel card itself, or "Analyze Frame" on the
                  // HUD elsewhere) rather than something a single click on the box already did.
                  //
                  // NO TAB STOP, DELIBERATELY (2026-10-02). Every box here is one of the same
                  // `data.detections` the reel on the right draws a card for, and that card is
                  // keyboard-operable and does MORE (it focuses and opens Inspection Detail), so
                  // a stop per box would be a second stop for each detection that leads somewhere
                  // smaller. And focus has to be SHOWN: the only room left is the frame itself,
                  // and nothing may outline, tint or dim the picture. A reader who wants a box
                  // focused takes the card; with the reel filtered to anything but 「전체」 some
                  // boxes have no card, which is the one gap this leaves and the filter undoes.
                  onClick={() => setFocusedDet(det)}
                  style={{
                    position:"absolute", zIndex:10, cursor:"pointer",
                    top:det.top, left:det.left, width:det.width, height:det.height,
                    // detBoxBorder, shared with the box each reel card draws on its own crop.
                    border: detBoxBorder(det),
                    // A ring for "this is the focused one", in the neutral SELECTED rather than
                    // the box's own type colour — reusing the type colour for focus meant a blue
                    // (non-VIP) box and its outlined card didn't read as the same linked item.
                    // It was purple, which on a screen about VIP detection made the focus ring on
                    // a Vehicle box look like a VIP hit. Matches the reel card's outline.
                    boxShadow: isFocused ? `0 0 0 3px ${SELECTED}` : "none",
                    // 3px, and deliberately not from the shape scale: a box drawn on the
                    // picture is the detector's own mark, not a control, and rounding it to a
                    // control's corner would make the camera look like it saw a button.
                    borderRadius:"3px", boxSizing:"border-box",
                    transition:"border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{
                    position:"absolute", bottom:"calc(100% + 4px)", left:0,
                    backgroundColor:"white", padding:"3px 8px",
                    display:"flex", alignItems:"center", gap:"5px", whiteSpace:"nowrap",
                    // --shadow-raised: the plate sits just off the frame behind it, which is
                    // exactly what that token is for. The literal was the same alpha and the same
                    // 1px offset, three pixels blurrier.
                    boxShadow:"var(--shadow-raised)",
                    opacity: isFocused ? 1 : 0.85,
                  }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-500)" }}>{targetLabel(i + 1)}</span>
                    {det.type === "VIP" && <TypeIcon type="VIP" color="var(--primary-400)" size={11} solid />}
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
              /* Darken, not a tint. The button has no box — it is the purple disc itself,
                 sitting on the picture — so any fill a hover added would be a new shape drawn
                 over the frame. brightness() acts on the disc's own paint and leaves the video
                 behind it untouched. */
              <button onClick={() => setIsPlaying(p => !p)} className="vca-hover-darken" style={{
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

            {/* WHO IS WATCHING, ON THE PICTURE. This frame is the one thing on the screen somebody
                photographs or snips: it is the biggest drawing of a face the product has (about
                1020x480 at a 1440 window, and it grows to the full pane once Inspection Detail
                narrows it to one person), and it is the frame the operator was sent here to read.
                So the stamp goes on it and on nothing else here — not on the reel crops in the
                right rail and not on the 128px thumbnails in the timeline strip below. Those are
                a subject listed among dozens; a 10px plate would cover the crop it sits on, and
                the same sentence forty times down one screen stops being read.
                Bottom-left because the frame's own date-time plate has the top-right, the
                detection labels sit above their boxes, and the play control is bottom-centre. */}
            <ViewerWatermark />
          </div>
        </div>

        {exportOpen && (
          <FrameExportDialog
            subject={exportSubjectShown}
            footage={exportPeriod}
            fileName={exportFileName}
            watermarkOn={watermarkOn}
            othersInFrame={othersInFrame}
            onCancel={() => setExportOpen(false)}
            onConfirm={runFrameExport}
          />
        )}
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
              <button onClick={() => stepBy(-10)} className={HOVER_QUIET} style={STEP_BTN_STYLE}>◀ 10s</button>
              <button onClick={() => stepBy(-1)} className={HOVER_QUIET} style={STEP_BTN_STYLE}>◀ 1s</button>
              <span style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.3px", minWidth:"92px", textAlign:"center", fontFamily:"monospace" }}>
                {secToHHMMSS(selectedSec)}
              </span>
              <button onClick={() => stepBy(1)} className={HOVER_QUIET} style={STEP_BTN_STYLE}>1s ▶</button>
              <button onClick={() => stepBy(10)} className={HOVER_QUIET} style={STEP_BTN_STYLE}>10s ▶</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"10px" }}>
              {/* Date first, then time — picking the day is the coarser, usually-first choice;
                  the clock icon belongs on the time control below, not here, so this button now
                  gets its own calendar glyph instead of a clock face that made it read as a
                  time control at a glance. */}
              <div ref={dateDropdownRef} style={{ position:"relative" }}>
                <button onClick={() => setDateOpen(o => !o)} className={HOVER_QUIET} style={{ display:"flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:RADIUS.control, padding:"6px 12px", border:"1px solid var(--gray-300)", cursor:"pointer" }}>
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
                {/* RADIUS.panel: a dropdown panel is a step rounder than the trigger that
                    opens it, which is how every other popover in the app is drawn. Both of these
                    were 8px, the trigger's own value. */}
                {dateOpen && (
                  <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", backgroundColor:"white", borderRadius:RADIUS.panel, boxShadow:"var(--shadow-popover)", border:"1px solid var(--gray-200)", overflow:"hidden", zIndex:50 }}>
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
                <div className="vca-field" style={{ display:"flex", alignItems:"center", gap:"6px", backgroundColor:"white", borderRadius:RADIUS.control, padding:"6px 12px", border:"1px solid var(--gray-300)" }}>
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
                    style={{ width:"66px", border:"none", outline:"none", boxShadow:"none", fontSize:"12px", fontWeight:700, color:"var(--gray-900)", fontFamily:"monospace" }}
                  />
                  {/* This control used to be <input type="time">, whose native dropdown is where
                      the hour/minute list came from. That input was dropped because the browser
                      draws its AM/PM in the OS locale (Korean "오후") with an accent colour from
                      nowhere in this app — but typing-only left the control looking like the date
                      dropdown beside it while doing nothing when clicked. This is the same list,
                      drawn here, so it stays in English and the typed path still works. */}
                  <button onClick={() => setTimeOpen(o => !o)} aria-label={t.pickTime} className="portal-icon-btn"
                    style={{ display:"flex", padding:"3px", margin:"-3px", border:"none", background:"none", cursor:"pointer" }}>
                    <svg width="9" height="9" viewBox="0 0 8 8" fill="none" style={{ transform: timeOpen ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                      <path d="M2 3L4 5L6 3" stroke="var(--gray-900)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {timeOpen && (
                  <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:20, display:"flex",
                    backgroundColor:"white", borderRadius:RADIUS.panel, border:"1px solid var(--gray-200)",
                    boxShadow:"var(--shadow-popover)", overflow:"hidden" }}>
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
                                // SELECTED, like every other mark on this screen. This was the last
                                // purple one, held back because the row's fill comes from
                                // .vca-picker-option[data-on] in globals.css — shared with the
                                // camera dropdowns in Live Monitoring and Re-ID — and grey text on
                                // a purple row would have been half a mark. That class moved with
                                // this line: the fill is --gray-100 under a 3px --gray-900 leading
                                // rule, and the reasoning for the rule (rather than a dark fill)
                                // is written there.
                                color: v === col.current ? SELECTED : "var(--gray-700)" }}>
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

          {/* 4px of top padding, not 8: the thumbnail and its time label move up as a pair so the
              scrollbar below them is not squeezed against the labels. See the paddingBottom note
              on the strip itself — the two numbers are one adjustment. */}
          <div style={{ padding:"0 16px 0", position:"relative" }}>
            {/* Thumbnail strip — horizontally scrollable. There are more sampled frames
                (THUMB_COUNT) than fit on screen at once, each a fixed width rather than a
                flex:1 cell, so the row overflows and scrolls instead of shrinking every
                thumbnail to cram them all in — lets you look forward/back along the strip by
                scrolling instead of only through the step/jump controls. */}
            {/* No fixed height: the cells set it. A pinned height has to be at least as tall as a
                cell renders, and when it isn't, alignItems:flex-end pushes the overflow out the
                TOP of the box, where overflow:auto clips it and no scroll can reach it — the
                thumbnails simply come out with their tops shaved off.
                paddingBottom clears the 6px horizontal scrollbar (.vca-thin-scrollbar), which
                otherwise sits on top of the time labels.

                16px, not 10. The scrollbar is 6px, so 10 left it 4px below the time labels and the
                strip read as if it had no bottom edge — the scrollbar looked like part of the row
                rather than a control under it. 16 gives the same 10px of clearance the labels have
                above them, and with the 4px taken off this block's top padding the thumbnail and
                its label sit slightly higher as a pair, which is what the room comes from. */}
            {/* 4px of top padding so the selected thumbnail's extra height has somewhere to go —
                this box clips (overflow-x:auto makes overflow-y:auto), and without it the grown
                frame's top edge was cut. Taken back off the wrapper's own top padding below, so
                the strip sits exactly where it did. */}
            <div className="vca-thin-scrollbar" style={{ position:"relative", paddingTop:"4px", paddingBottom:"16px", zIndex:2, display:"flex", alignItems:"flex-end", gap:"4px", overflowX:"auto" }}>
              {thumbFrames.map((sec, i) => {
                const isSelected = i === centerThumbIdx;
                const vipCount = vipByThumb.get(i) ?? 0;
                // The frame's border grows when it is the one you are on, and the picture clipped
                // inside it has to give back exactly that much radius or its corner climbs over
                // the border's. One number, read twice — as the border and as what the inner
                // radius subtracts (see shared/controls.ts on nesting, which is the same sum).
                const framePx = isSelected ? 3 : 1.5;
                return (
                  <div key={i} ref={el => { thumbRefs.current[i] = el; }} onClick={() => setSelectedSec(sec)}
                    // An outline around the cell, which is drawn outside its box: the thumbnail
                    // keeps its own 3px SELECTED border as the "you are here" mark, and nothing
                    // lands on the picture — no tint, no dim, no second edge on the image.
                    //
                    // NO TAB STOP, AND NO ROVING GROUP EITHER (2026-10-02). 61 stops would bury
                    // the hour and minute bars behind the strip; a roving group would fix the
                    // count and then fight the ArrowLeft/ArrowRight listener above, which already
                    // seeks from anywhere on this screen — one press would both move the roving
                    // cursor and move the footage. It is not needed: this strip is ALREADY one
                    // tab stop (an overflow:auto box is focusable), those arrows already walk it
                    // at 1s/10s against the thumbnails' 2s, and the effect below scrolls whatever
                    // they land on back into view. Measured: on the untouched screen this strip
                    // was Tab stop 22 of 105 (29 of 114 now that the reel cards are stops), and
                    // ←/→ from there moved the selected frame 11:34:00 → :02 → (Shift) :12.
                    // STILL MISSING, and not inventable from here: the strip has no name, so a
                    // screen reader reaching that stop is told nothing. It needs one word of copy
                    // (and an aria-label on this container) from the owner.
                    /* NO HOVER OUTLINE AT ALL (owner, 2026-10-12: 이거 호버할때 라인 그려지는거
                       지워줘 이상해). .vca-hover-card drew a --gray-400 ring around the whole card
                       — the picture AND its time label — so pointing at a frame boxed a photo and
                       a line of text together, and on the selected one it landed just outside the
                       gradient ring as a second, greyer edge. The strip's affordance is the cursor
                       and the fact that the pictures are plainly a filmstrip; it does not need a
                       box drawn round a piece of evidence. */
                    style={{
                    position:"relative", flexShrink:0,
                    /* GROWN, NOT SCALED — see the note on the hour cell. transform let the lifted
                       thumbnail paint outside the strip, which clips (an overflow-x:auto box
                       computes overflow-y:auto too), so its top edge was cut (오너: 썸네일쪽 위에
                       잘리는거). Real width with matching negative side margins keeps the row's
                       rhythm; aspect-ratio carries the height, and the strip's 4px of top padding
                       is the room it grows into. */
                    ...(isSelected
                      ? { width:"134px", marginLeft:"-3px", marginRight:"-3px" }
                      : { width:"128px" }),
                    display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", cursor:"pointer",
                  }}>
                    <div className={isSelected ? "vca-grad-ring" : undefined} style={{
                      width:"100%", aspectRatio:"8/5", boxSizing:"border-box",
                      // The frame you are on, not a frame with a VIP in it — the crown chip and
                      // the alert marker inside the thumbnail are what say that, in purple and red.
                      // Selected takes --gradient-select (the owner's own draft style) rather than
                      // a flat colour — see the note on that token. The ring's interior is the
                      // --gray-800 the photo sits on, so no white hairline shows if the photo is
                      // still loading. Unselected keeps its plain --gray-200 edge.
                      ...(isSelected
                        ? { ["--ring-w" as string]: `${framePx}px`, ["--ring-fill" as string]: "var(--gray-800)" }
                        : { border: `${framePx}px solid var(--gray-200)` }),
                      borderRadius:RADIUS.inner,
                      /* The one you are on grows instead of the rest dimming (owner, 2026-10-12,
                         choosing this over blurring the others). Blur was the other candidate and
                         it is the wrong tool on a CCTV strip twice over: a blurred frame is a thing
                         cameras actually produce, so it reads as motion blur in the footage rather
                         than as UI — the note on HOVER_QUIET says the same about anything drawn
                         inside the picture — and the strip's whole job is being scanned for the
                         moment, which a blur removes. The others already carry grayscale(100%) and
                         0.75 opacity; this adds nothing to them.

                         Origin at the bottom because the row is aligned flex-end, so the growth
                         goes up into the padding instead of pushing the time labels down. 4% of
                         128x80 is ~5x3px — enough to catch the eye, small enough that the strip's
                         rhythm still reads. zIndex lifts it over its neighbours' edges. */
                      ...(isSelected ? { zIndex:1 } : null),
                      position:"relative",
                    }}>
                      <div style={{ width:"100%", height:"100%", overflow:"hidden", borderRadius:`calc(${RADIUS.inner} - ${framePx}px)`, position:"relative", backgroundColor:"var(--gray-800)" }}>
                        <Photo kind="frame" src={data.bgUrl ?? ""}
                          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", filter: isSelected ? "none" : "grayscale(100%)", opacity: isSelected ? 1 : 0.75 }} />
                        {/* How many VIPs this frame caught — the detections' own timestamps, not
                            a stand-in. This chip used to be a headcount from a seeded mock, which
                            is a number no camera reported and not a VIP hit either way. Absent at
                            zero: a strip of "0" chips is 58 marks saying nothing. */}
                        {vipCount > 0 && (
                          <div style={{ position:"absolute", left:4, bottom:3, display:"flex", alignItems:"center", gap:"3px", backgroundColor:"var(--label-plate)", padding:"1px 6px", borderRadius:RADIUS.pill }}>
                            {/* Solid (active), not the outline the legend uses — at 10px on a
                                photo the hollow crown was a few hairlines and read as noise. */}
                            <TypeIcon type="VIP" color="white" size={10} solid />
                            <span style={{ fontSize:"10px", fontWeight:700, color:"white", fontFamily:"monospace" }}>{vipCount}</span>
                          </div>
                        )}
                        {vipCount >= VIP_CROWD_THRESHOLD && (
                          <div style={{ position:"absolute", top:3, right:3 }}>
                            <AlertDot size={15} />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Full absolute HH:MM:SS per thumbnail — clearer than a relative offset
                        when frames are only 2 seconds apart, where "+2s"/"+4s" all look alike. */}
                    <span style={{ fontSize:"10px", fontWeight:600, color: isSelected ? SELECTED : "var(--gray-500)", fontFamily:"monospace" }}>
                      {secToHHMMSS(sec)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour bar / Minute bar — a two-tier coarse navigator (pick the hour, then pick the
              minute within it), moved below the thumbnail strip. Both carry the same mark as the
              rest of this timeline — SELECTED on a white fill, where they used to reuse the purple
              highlight (bg --primary-100 / border --primary-400) this whole screen was marking
              selection with. No persistent "Hour 14"/"active number" label sitting on
              the bar itself — instead, hovering any segment pops the same pill+pointer tooltip
              used for the selected thumbnail's time badge above, which already reads clearly on
              first sight there. */}
          <div style={{ padding:"0 16px 10px" }}>
            <div style={{ position:"relative" }}>
              {/* HAIRLINE-SEPARATED CELLS, NOT ROUNDED BLOCKS WITH GAPS (owner, 2026-10-12:
                  칸 박스로 있어야 시간이나 분을 선택하기 쉬워지는데 … 그냥 스크롤처럼 해버리면
                  안돼 — after a continuous track was tried and rightly rejected).

                  Each cell used to carry its own 6px radius and a 2px gap, so 24 of them read as a
                  dashed texture and three greys scattered through it read as a stain. Taking the
                  divisions away instead made it a scrollbar: nothing to aim at. Every time-slot
                  grid in the field (SavvyCal, Calendly, Pin, Bonsai, Clockwise, User Interviews)
                  does the same third thing — cells share their edges, divided by a 1px rule, no
                  rounding of their own. The gap IS that rule here: the row's background shows
                  through as the hairline, and the ends round once on the row.

                  The rule is --gray-300, not --line. Once the cells went white, --line measured
                  1.23 against them and the grid stopped being readable — you could not see where
                  one hour ended (owner, 2026-10-12: 라인색을 살짝 더 진하게 해줘야하지않아?).
                  --gray-300 is 1.48 there. NOT --gray-400, which is the fill that means "this hour
                  holds records": a rule in the same value as the content would read as content.
                  The ladder stands — rule 1.48 < record < selected. */}
              {/* No `overflow:hidden` on the row: the selected cell grows past the row's edge
                  (see its transform) and a clip would cut the lift off. The rounded ends come from
                  the first and last cells taking the radius themselves instead. */}
              <div style={{ display:"flex", gap:"1px", backgroundColor:"var(--gray-300)",
                borderRadius:RADIUS.inner, border:"1px solid var(--gray-300)" }}>
                {Array.from({ length: HOURS_IN_DAY }, (_, h) => {
                  const active = h === currentHour;
                  return (
                    <button key={h}
                      // Land on the record this cell is marked for, not on the minute you happened
                      // to be at — see the note on occupancy.hourAt.
                      onClick={() => jumpTo(occupancy.hourAt[h] ?? h * 3600 + (selectedSec % 3600))}
                      /* .vca-hover-quiet, not darken. darken is `filter: brightness(.88)`, which
                         would drag the crown's --primary-400 to a value that is in no palette —
                         and that class's own note says it is for a bare glyph with no box to fill.
                         These cells have a box, so the box tints and the crown keeps its token. */
                      className={active ? "vca-grad-ring vca-hover-quiet" : "vca-hover-quiet"}
                      onMouseEnter={() => setHoveredHour(h)}
                      onMouseLeave={() => setHoveredHour(prev => (prev === h ? null : prev))}
                      style={{
                      // No radius of its own: the cells are panes of one grid, and the row rounds
                      // its own two ends. A radius here is what made 24 of these read as beads.
                      // The ring needs a border box to paint in, and an inline `border` beats the
                      // class, so the transparent band is declared here for the selected cell.
                      flex:1, height:"20px", padding:0, cursor:"pointer",
                      border: active ? "2px solid transparent" : "none",
                      // The row no longer clips, so the two end cells carry its corners.
                      borderRadius: h === 0 ? `${RADIUS.inner} 0 0 ${RADIUS.inner}`
                        : h === HOURS_IN_DAY - 1 ? `0 ${RADIUS.inner} ${RADIUS.inner} 0` : 0,
                      /* Lifted, like the selected thumbnail above it — but by GROWING, not by
                         scaling. A non-uniform transform (it was scale(1.02, 1.4)) stretches
                         everything inside with it: the crown came out squashed and the 2px ring
                         came out 2px across and 2.8px down (owner, 2026-10-12: 억지로 늘려놔서
                         잘리고 왕관모양 이상하고). A real height with matching negative margins
                         grows the box and leaves its contents alone, and the row keeps its own
                         20px so nothing below it moves. zIndex lifts it over its neighbours. */
                      ...(active ? { height:"28px", marginTop:"-4px", marginBottom:"-4px", zIndex:1 } : null),
                      position:"relative",
                      /* Three steps, in order of what the operator needs: --gray-200 nothing
                         happened here, --gray-400 this hour holds records, SELECTED this is the
                         one you are on. Unknown (no camera id) falls back to the plain ground
                         rather than painting every hour as empty. */
                      /* EMPTY IS WHITE, NOT GREY. --gray-100/200 rounded rectangles in a row are
                         this product's own LOADING vocabulary — SkeletonBestFrame's `Bone` is
                         literally that, and the only thing separating it from a real control was
                         the pulse (owner, 2026-10-12: 이건 로딩 안같아보이는거야?). It is also the
                         wrong way round against the field: in every time-slot grid the empty slot
                         is white and the grey or the colour means something is there. So the row
                         is a white grid ruled by hairlines, and ink lands only where there is a
                         record (--gray-400) or where you are (SELECTED). */
                      /* TWO THINGS, TWO CHANNELS. Both used to be a fill, one step darker than
                         the other, so the row read as a density ramp — the owner read the grey as
                         「few VIPs」 and the black as 「many」 (2026-10-12), which is not what either
                         says. It also could not work as a ramp: --gray-400 is slate (hue 215°) and
                         SELECTED is the purple end (259°), two different families of this ramp by
                         deliberate design, so the light one simply looked out of place beside the
                         dark one. Content is the FILL, position is a BORDER (inset, so it cannot
                         push the grid around) — and a selected hour that holds records now shows
                         both at once instead of one hiding the other.

                         THE FILL IS --primary-300, NOT A GREY (owner, 2026-10-12: 그 보라빛 들어간
                         컬러 추가한걸로 바꾸면 어떨까). Measured, this ramp runs slate from gray-50
                         to gray-600 (210-217°) and purple only at 700-900 (258-259°), and the two
                         purple-leaning neutrals that were added for lines (--line, --line-control,
                         240°) sit at 91-93% lightness — too light to be a fill. So there is no
                         mid-tone purple NEUTRAL to reach for, and the honest choice is the purple
                         itself: --primary-300 measures 3.04 on a white cell (--gray-400 was 2.56),
                         2.05 against the --gray-300 rule, 6.02 against the selected outline.
                         --primary-200 was the other candidate and fails — 1.11 against the rule,
                         so the hairlines would vanish inside a filled run.

                         It is also what this product already means by that value: a dropzone that
                         HOLDS a photo takes a --primary-300 edge, and a verification box that HOLDS
                         a digit does the same. 「Something is here」 is the sentence. And purple is
                         allowed to say it, because what is here IS a VIP detection — the 2026-09-17
                         decision on :239 bars purple from SELECTION marks, not from content.
                         Budget: ~11 of 24 cells ≈ 0.8% of the screen. */
                      /* The cell a crown sits in takes --primary-100 behind it (owner, 2026-10-12:
                         왕관이 있는 시간엔 배경색 primary 100을 칠해줘), so a row of 24 reads as
                         bands of activity at a glance and the crown is not a lone mark floating on
                         white. --ring-fill follows it, so a selected cell that holds records keeps
                         the same ground inside its gradient ring. */
                      backgroundColor: occupancy.known && occupancy.hours[h] > 0 ? "var(--primary-100)" : "var(--gray-0)",
                      ["--ring-fill" as string]: occupancy.known && occupancy.hours[h] > 0 ? "var(--primary-100)" : "var(--gray-0)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxSizing:"border-box",
                    }}>
                      {occupancy.known && occupancy.hours[h] > 0 && (
                        <TypeIcon type="VIP" color="var(--primary-400)" size={12} solid />
                      )}
                    </button>
                  );
                })}
              </div>
              {hoveredHour !== null && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 6px)", left:`${((hoveredHour + 0.5) / HOURS_IN_DAY) * 100}%`, transform:"translateX(-50%)",
                  display:"flex", flexDirection:"column", alignItems:"center", pointerEvents:"none", zIndex:5,
                }}>
                  <span style={{ fontSize:"12px", fontWeight:800, color:"white", backgroundColor:SELECTED, padding:"4px 10px", borderRadius:RADIUS.pill, fontFamily:"monospace", whiteSpace:"nowrap" }}>
                    {lang === "ko" ? `${pad2(hoveredHour)}${t.hour}` : `${t.hour} ${pad2(hoveredHour)}`}
                  </span>
                  <span style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:`6px solid ${SELECTED}`, marginTop:"-2px" }} />
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
              {/* Same hairline grid as the hour rule above. */}
              {/* No `overflow:hidden` on the row: the selected cell grows past the row's edge
                  (see its transform) and a clip would cut the lift off. The rounded ends come from
                  the first and last cells taking the radius themselves instead. */}
              <div style={{ display:"flex", gap:"1px", backgroundColor:"var(--gray-300)",
                borderRadius:RADIUS.inner, border:"1px solid var(--gray-300)" }}>
                {Array.from({ length: MINUTES_IN_HOUR }, (_, m) => {
                  const active = m === currentMinute;
                  return (
                    <button key={m}
                      onClick={() => jumpTo(occupancy.minuteAt[m] ?? currentHour * 3600 + m * 60 + (selectedSec % 60))}
                      className={active ? "vca-grad-ring vca-hover-quiet" : "vca-hover-quiet"}
                      onMouseEnter={() => setHoveredMinute(m)}
                      onMouseLeave={() => setHoveredMinute(prev => (prev === m ? null : prev))}
                      style={{
                      flex:1, height:"14px", padding:0, cursor:"pointer",
                      border: active ? "2px solid transparent" : "none",
                      borderRadius: m === 0 ? `${RADIUS.inner} 0 0 ${RADIUS.inner}`
                        : m === MINUTES_IN_HOUR - 1 ? `0 ${RADIUS.inner} ${RADIUS.inner} 0` : 0,
                      // Grown, not scaled — see the note on the hour cell.
                      ...(active ? { height:"22px", marginTop:"-4px", marginBottom:"-4px", zIndex:1 } : null),
                      position:"relative",
                      /* Same two channels as the hour rule, counted inside the selected hour. */
                      /* The cell a crown sits in takes --primary-100 behind it (owner, 2026-10-12:
                         왕관이 있는 시간엔 배경색 primary 100을 칠해줘), so a row of 24 reads as
                         bands of activity at a glance and the crown is not a lone mark floating on
                         white. --ring-fill follows it, so a selected cell that holds records keeps
                         the same ground inside its gradient ring. */
                      backgroundColor: occupancy.known && occupancy.minutes[m] > 0 ? "var(--primary-100)" : "var(--gray-0)",
                      ["--ring-fill" as string]: occupancy.known && occupancy.minutes[m] > 0 ? "var(--primary-100)" : "var(--gray-0)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxSizing:"border-box",
                    }}>
                      {occupancy.known && occupancy.minutes[m] > 0 && (
                        <TypeIcon type="VIP" color="var(--primary-400)" size={10} solid />
                      )}
                    </button>
                  );
                })}
              </div>
              {hoveredMinute !== null && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 6px)", left:`${((hoveredMinute + 0.5) / MINUTES_IN_HOUR) * 100}%`, transform:"translateX(-50%)",
                  display:"flex", flexDirection:"column", alignItems:"center", pointerEvents:"none", zIndex:5,
                }}>
                  <span style={{ fontSize:"12px", fontWeight:800, color:"white", backgroundColor:SELECTED, padding:"4px 10px", borderRadius:RADIUS.pill, fontFamily:"monospace", whiteSpace:"nowrap" }}>
                    {lang === "ko" ? `${pad2(hoveredMinute)}${t.minute}` : `${t.minute} ${pad2(hoveredMinute)}`}
                  </span>
                  <span style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:`6px solid ${SELECTED}`, marginTop:"-2px" }} />
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
