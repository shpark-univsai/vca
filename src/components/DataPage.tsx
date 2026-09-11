"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MatchItem, ReIDStatus } from "@/types/reid";
import {
  CAMERA_CODES, canSearchInApp, judgementFor, type DetectionVerdict,
  useActiveProjectId, useProjectCameras, useVcaStore, type Camera,
} from "@/lib/vcaStore";
import { useCameraStatus, getCameraStatus, runStateOf } from "@/lib/realtime/cameraStatus";
import { formatElapsed, parseSgtStamp, recentSgtStamp, sgtClockTime, sgtDateKey } from "@/lib/time";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePopoverDismiss } from "@/hooks/usePopoverDismiss";
import RemoveImageButton from "./RemoveImageButton";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

/**
 * See the per-file pattern note in lib/i18n.ts.
 *
 * Two kinds of words live on this screen and only one of them is in here. Camera codes, plate
 * numbers, VIP names and the seeded target labels are the install's own data and never change.
 * The attribute VALUES ("Male", "Short Sleeve", "Backpack/Bag") are a third thing: they are what
 * the model reports and what the filter state holds, so they stay English in state and get
 * translated only where they are drawn — see ATTR below.
 */
const T = {
  en: {
    scrollToTop: "Scroll to top",
    smartSearch: "Smart search",
    collapse: "Collapse",
    tabPhoto: "Photo",
    tabFilter: "Filter",
    tabVip: "VIP",
    tabVehicle: "Vehicle",
    dateRange: "Date range",
    last7days: "Last 7 days",
    recentTargets: "Recent targets",
    targetFace: "Target face",
    targetBody: "Target body",
    face: "Face",
    body: "Body",
    similarity: "Similarity",
    labelGender: "Gender",
    labelHat: "Hat",
    labelSleeve: "Sleeve length",
    labelBottoms: "Bottoms",
    labelBackpack: "Backpack",
    labelEmotion: "Emotion",
    labelEthnic: "Ethnic group",
    topColors: "Top colors",
    bottomColors: "Bottom colors",
    shoesColors: "Shoes colors",
    all: "All",
    chooseVip: "Choose a VIP",
    selectedVip: (name: string) => `Selected: ${name}`,
    licensePlate: "License plate",
    reset: "Reset",
    search: "Search",
    noSearchPermission: "You do not have permission to search people — ask an administrator",
    allCameras: "All cameras",
    labelType: "Type",
    confirmed: "Confirmed",
    excluded: "Excluded",
    confirmAssociate: "Same person — confirm this associate",
    excludeAssociate: "Not the same person — mark as a false positive",
    undoJudgement: "Undo",
    judgedBy: (actor: string, at: string) => `${actor} · ${at}`,
    thresholdCost: (kept: number, total: number) => `${kept} of ${total} candidates`,
    thresholdCostNone: (total: number) => `none of ${total} candidates`,
    associatesCount: (n: number) => `${n} ${n === 1 ? "ASSOCIATE" : "ASSOCIATES"}`,
    associateNo: (n: string) => `Associate #${n}`,
    noTiersSelected: "No tiers selected",
    switchPrimary: "Switch primary target",
    framesCount: (n: number) => `${n} ${n === 1 ? "FRAME" : "FRAMES"}`,
    pageRange: (a: number, b: number, n: number) => `${a}–${b} of ${n}`,
    colCoCaptures: "Co-captures",
    analyzeFrame: "Analyze frame",
    agoOf: (d: string) => `${d} ago`,
    reidObject: (id: string) => `Re-ID object #REC-${id}`,
    attrClassification: "Attribute classification",
    genderAge: "Gender / age",
    belongings: "Belongings",
    trackOnMap: "Track on map",
    clickCandidate: "Click a candidate below to select",
    setPrimaryTarget: "Set as primary target",
    vipQuickSelect: "VIP quick select",
    selectedLabel: "Selected",
    targetNo: (id: string) => `Target #TS${id}`,
    todayAt: (time: string) => `today ${time}`,
    peakLocationTip: (here: number, total: number) => `${here} of ${total} shared frames were captured here — click to show only those`,
    peakTimeTip: (here: number, total: number, pct: number, bucket: string) => `${here} of ${total} shared frames (${pct}%) were captured in the ${bucket} — click to show only those`,
    sortByCoCaptures: (asc: boolean) => `Sort by co-captures, ${asc ? "low to high" : "high to low"}`,
    primaryBadge: "PRIMARY",
    plate: "Plate",
    labelCamera: "Camera",
    refineSearch: "Refine search",
    refresh: "Refresh",
    matchesFound: (n: number) => `${n} ${n === 1 ? "match" : "matches"}`,
    aboveSimilarity: (n: number) => `Showing targets above ${n}% similarity`,
    vehicleSearchResult: "Vehicle search result",
    searchResultTitle: "Search result",
    noVipMatch: (q: string) => `No VIPs match “${q}”`,
    filterAll: "All",
    camOnline: "ONLINE",
    camOffline: "OFFLINE",
    rtspConnected: "RTSP connected",
    noFeedTitle: "No feed to show",
    noFeedBody: "This camera is not running, so there is nothing being captured. The device list shows when it was last seen.",
    noReidTitle: "Person search permission required",
    noReidBody: "Re-ID Analysis answers where one person has been seen across the site's cameras, which is a person search. An administrator can grant the permission in the Portal, under Users & Permissions.",
    noRedFaceTitle: "Person search permission required",
    noRedFaceBody: "RedFace matches a face against the registry and builds an association network from it, so with no search permission there is nothing it can show. An administrator can grant it in the Portal, under Users & Permissions.",
    searchVips: "Search VIPs",
    clearSearch: "Clear search",
    sortRegistered: "Registered",
    sortAbc: "A–Z",
    cancel: "Cancel",
    apply: "Apply",
    startDate: "Start date",
    endDate: "End date",
    allDates: "All dates",
    person: "Person",
    similarityAtLeast: (n: number) => `≥ ${n}% similarity`,
    similarTo: "Similar to",
    resetFilters: "Reset filters",
    searchResults: "Search results",
    noMatches: "No matches for the current filters.",
    matchedOn: (reasons: string) => `Matched on: ${reasons}`,
    resultsAsOf: (time: string) => `Results updated as of ${time}`,
    clickToChange: "Click to change",
    removeFaceImage: "Remove face image",
    removeBodyImage: "Remove body image",
    removeImage: (what: string) => `Remove ${what} image`,
    noCandidatesMatch: "No candidates match the current filters",
    chooseTargetOrFilter: "Choose a target or set a filter to see candidates",
    close: "Close",
    prevPage: "Previous page",
    nextPage: "Next page",
    sharedFramesTitle: "Every frame holding both the primary target and this associate",
    relationshipAnalytics: "Relationship analytics",
    sharedFrames: "Shared frames",
    sharedFramesHint: "Frames the two appear in together, newest first",
    showEveryFrame: "Show every shared frame again",
    openFrameFull: "Open this frame full size",
    colRank: "Rank",
    colAssociate: "Associate target",
    colTier: "Tier",
    colStatus: "Status",
    colLocations: "Locations",
    colPeakLocation: "Peak location",
    colPeakTime: "Peak time",
    colSpan: "Span",
    colAction: "Action",
    fullBody: "Full-body",
    selectPrimaryTarget: "Select primary target",
    selectPrimarySub: "Search and select a new target to rebuild RedFace relationship graph",
    searchByImage: "Search by image",
    clickToUpload: "Click to upload",
    labelApparel: "Apparel",
    labelProps: "Props",
    topColor: "Top color",
    bottomColor: "Bottom color",
    shoesColor: "Shoes color",
    coCaptureEvidence: "Co-capture evidence",
    whereWhenCluster: "Where and when the shared frames cluster",
    first: "First",
    last: "Last",
    primaryTarget: "PRIMARY TARGET",
    primaryTargetHint: "The person everything here is measured against — associates are whoever shares frames with them",
    prevFrame: "Previous frame",
    nextFrame: "Next frame",
    coCaptures: (n: number) => `${n} co-captures`,
    viewFrames: "View frames",
    tier: (n: number) => `Tier ${n} link`,
    lastSeenAt: (when: string, place: string) => `Last seen ${when} · ${place}`,
    viewPyramid: "See associates laid out by tier",
    viewGrid: "See associates as a sortable table",
    pyramidAndZone: "Pyramid & zone",
    dataGrid: "Data grid",
    tabLiveMonitoring: "Live Monitoring",
    tabReid: "Re-ID Analysis",
    tabRedface: "RedFace",
    redfaceTooltip: "Finds who shares camera frames with a chosen person, across every camera",
  },
  ko: {
    scrollToTop: "맨 위로",
    smartSearch: "스마트 검색",
    collapse: "접기",
    tabPhoto: "사진",
    tabFilter: "속성",
    tabVip: "VIP",
    tabVehicle: "차량",
    dateRange: "기간",
    last7days: "최근 7일",
    recentTargets: "최근 검색 대상",
    targetFace: "대상 얼굴",
    targetBody: "대상 전신",
    face: "얼굴",
    body: "전신",
    similarity: "유사도",
    labelGender: "성별",
    labelHat: "모자",
    labelSleeve: "소매 길이",
    labelBottoms: "하의",
    labelBackpack: "가방",
    labelEmotion: "표정",
    labelEthnic: "인종",
    topColors: "상의 색상",
    bottomColors: "하의 색상",
    shoesColors: "신발 색상",
    all: "전체",
    chooseVip: "VIP를 선택해주세요",
    selectedVip: (name: string) => `선택: ${name}`,
    licensePlate: "차량 번호",
    reset: "초기화",
    search: "검색",
    noSearchPermission: "인물 검색 권한이 없습니다 — 관리자에게 요청하세요",
    allCameras: "전체 카메라",
    labelType: "종류",
    confirmed: "확인됨",
    excluded: "제외됨",
    confirmAssociate: "같은 사람입니다 — 이 동행을 확인",
    excludeAssociate: "같은 사람이 아닙니다 — 오탐으로 표시",
    undoJudgement: "되돌리기",
    judgedBy: (actor: string, at: string) => `${actor} · ${at}`,
    thresholdCost: (kept: number, total: number) => `후보 ${total}건 중 ${kept}건`,
    thresholdCostNone: (total: number) => `후보 ${total}건 중 0건`,
    associatesCount: (n: number) => `동행 ${n}명`,
    associateNo: (n: string) => `동행 #${n}`,
    noTiersSelected: "선택된 단계가 없습니다",
    switchPrimary: "대상 바꾸기",
    framesCount: (n: number) => `프레임 ${n}장`,
    pageRange: (a: number, b: number, n: number) => `${n}건 중 ${a}–${b}`,
    colCoCaptures: "동반검출",
    analyzeFrame: "프레임 분석",
    agoOf: (d: string) => `${d} 전`,
    reidObject: (id: string) => `Re-ID 객체 #REC-${id}`,
    attrClassification: "속성 분류",
    genderAge: "성별 / 나이",
    belongings: "소지품",
    trackOnMap: "지도에서 추적",
    clickCandidate: "아래에서 후보를 눌러 고르세요",
    setPrimaryTarget: "이 대상으로 확정",
    vipQuickSelect: "VIP 빠른 선택",
    selectedLabel: "선택됨",
    targetNo: (id: string) => `대상 #TS${id}`,
    todayAt: (time: string) => `오늘 ${time}`,
    peakLocationTip: (here: number, total: number) => `같이 찍힌 ${total}장 중 ${here}장이 이곳에서 촬영됐습니다 — 누르면 그 장면만 봅니다`,
    peakTimeTip: (here: number, total: number, pct: number, bucket: string) => `같이 찍힌 ${total}장 중 ${here}장(${pct}%)이 ${bucket}에 촬영됐습니다 — 누르면 그 장면만 봅니다`,
    sortByCoCaptures: (asc: boolean) => `동반검출 ${asc ? "적은 순" : "많은 순"}으로 정렬`,
    primaryBadge: "대상",
    plate: "번호판",
    labelCamera: "카메라",
    refineSearch: "조건 다시 설정",
    refresh: "새로 고침",
    matchesFound: (n: number) => `${n}건`,
    aboveSimilarity: (n: number) => `유사도 ${n}% 이상만 표시`,
    vehicleSearchResult: "차량 검색 결과",
    searchResultTitle: "검색 결과",
    noVipMatch: (q: string) => `“${q}”에 해당하는 VIP가 없습니다`,
    filterAll: "전체",
    camOnline: "정상",
    camOffline: "중단",
    rtspConnected: "RTSP 연결됨",
    noFeedTitle: "표시할 화면이 없습니다",
    noFeedBody: "이 카메라는 가동 중이 아니라 촬영되는 것이 없습니다. 마지막 신호 시각은 장비 목록에서 볼 수 있습니다.",
    noReidTitle: "인물 검색 권한이 필요합니다",
    noReidBody: "Re-ID 분석은 한 사람이 이 현장의 카메라들에서 언제 어디서 보였는지를 답하는 화면입니다. 인물 검색에 해당하므로 권한이 필요합니다. 관리자에게 요청하면 포털의 사용자 및 권한에서 열어 줄 수 있습니다.",
    noRedFaceTitle: "인물 검색 권한이 필요합니다",
    noRedFaceBody: "RedFace는 얼굴을 등록부와 대조해 동행 관계를 만드는 화면이라, 검색 권한 없이는 보여줄 것이 없습니다. 관리자에게 요청하면 포털의 사용자 및 권한에서 열어 줄 수 있습니다.",
    searchVips: "VIP 검색",
    clearSearch: "검색어 지우기",
    sortRegistered: "등록순",
    sortAbc: "가나다순",
    cancel: "취소",
    apply: "적용",
    startDate: "시작일",
    endDate: "종료일",
    allDates: "전체 기간",
    person: "사람",
    similarityAtLeast: (n: number) => `유사도 ${n}% 이상`,
    similarTo: "유사한 대상:",
    resetFilters: "조건 초기화",
    searchResults: "검색 결과",
    noMatches: "현재 조건에 맞는 결과가 없습니다.",
    matchedOn: (reasons: string) => `일치한 조건: ${reasons}`,
    resultsAsOf: (time: string) => `${time} 기준 결과입니다`,
    clickToChange: "눌러서 변경",
    removeFaceImage: "얼굴 이미지 삭제",
    removeBodyImage: "전신 이미지 삭제",
    removeImage: (what: string) => `${what} 이미지 삭제`,
    noCandidatesMatch: "현재 조건에 맞는 후보가 없습니다",
    chooseTargetOrFilter: "대상을 고르거나 조건을 설정하면 후보가 나타납니다",
    close: "닫기",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    sharedFramesTitle: "기준 대상과 이 동행자가 함께 잡힌 모든 프레임",
    relationshipAnalytics: "관계 분석",
    sharedFrames: "함께 잡힌 프레임",
    sharedFramesHint: "두 사람이 함께 나온 프레임, 최신순",
    showEveryFrame: "함께 잡힌 프레임 전체 다시 보기",
    openFrameFull: "이 프레임 원본 크기로 보기",
    colRank: "순위",
    colAssociate: "동행 대상",
    colTier: "단계",
    colStatus: "상태",
    colLocations: "장소 수",
    colPeakLocation: "최다 검출 장소",
    colPeakTime: "최다 검출 시간",
    colSpan: "검출 기간",
    colAction: "동작",
    fullBody: "전신",
    selectPrimaryTarget: "기준 대상 선택",
    selectPrimarySub: "새 대상을 검색해 선택하면 RedFace 관계도를 다시 만듭니다",
    searchByImage: "이미지로 검색",
    clickToUpload: "눌러서 업로드",
    labelApparel: "옷차림",
    labelProps: "소지품",
    topColor: "상의 색상",
    bottomColor: "하의 색상",
    shoesColor: "신발 색상",
    coCaptureEvidence: "함께 잡힌 근거",
    whereWhenCluster: "함께 잡힌 프레임이 몰린 곳과 시간",
    first: "처음",
    last: "마지막",
    primaryTarget: "기준 대상",
    primaryTargetHint: "여기의 모든 수치가 이 사람을 기준으로 계산됩니다. 동행자는 이 사람과 같은 프레임에 잡힌 사람입니다",
    prevFrame: "이전 프레임",
    nextFrame: "다음 프레임",
    coCaptures: (n: number) => `함께 잡힘 ${n}회`,
    viewFrames: "프레임 보기",
    tier: (n: number) => `${n}단계 연결`,
    lastSeenAt: (when: string, place: string) => `마지막 검출 ${when} · ${place}`,
    viewPyramid: "단계별로 배치해서 보기",
    viewGrid: "정렬 가능한 표로 보기",
    pyramidAndZone: "단계 · 구역",
    dataGrid: "표로 보기",
    tabLiveMonitoring: "실시간 관제",
    tabReid: "Re-ID 분석",
    tabRedface: "RedFace",
    redfaceTooltip: "선택한 사람과 같은 프레임에 잡힌 사람을 모든 카메라에서 찾습니다",
  },
} as const;

/**
 * Attribute values the model reports. The state and the search payload keep the English value —
 * these are what a backend will match on — and this only decides how one is drawn. Anything not
 * listed falls through unchanged, which is what camera codes and plate numbers rely on.
 */
const ATTR_KO: Record<string, string> = {
  Male: "남성", Female: "여성",
  Hat: "모자", None: "없음", Exists: "있음",
  Short: "반팔", Long: "긴팔",
  "Short Sleeve": "반팔", "Long Sleeve": "긴팔",
  Trousers: "긴바지", Shorts: "반바지", Skirts: "치마",
  "Backpack/Bag": "가방", "Wearing Glasses": "안경 착용",
  Anger: "화남", Disgust: "혐오", Neutral: "무표정", Fear: "두려움",
  Happiness: "기쁨", Sadness: "슬픔", Surprised: "놀람",
  "African American": "아프리카계", Indian: "인도계", Asian: "아시아계", Caucasian: "백인계",
  Person: "사람", Vehicle: "차량",
  VIP: "VIP", Unknown: "미확인", Suspect: "의심", RedFace: "RedFace",
};
function attr(value: string, lang: AppLanguage): string {
  return lang === "ko" ? (ATTR_KO[value] ?? value) : value;
}

// The console's one hairline value — see --line in globals.css, which was defined for exactly
// this and then never reached the app: eight files each declared their own gray-200 rule instead,
// so Portal and the app drew different lines.
const BORDER = "1px solid var(--line)";
/**
 * The Data screen's sub-tabs.
 *
 * "Smart Search" was a fourth one until 2026-09-10. It was merged into Live Monitoring's own
 * collapsible sidebar long before that, so nothing rendered for it — and the only code that still
 * named it was a dead deep-link that seeded attribute filters from a card and threw the card's
 * crop away. A card now goes to Re-ID with the crop as the target, which is what
 * re-identification is, so the name has nothing left to refer to.
 */
export type DataTab = "Live Monitoring" | "Re-ID Analysis" | "RedFace";

// The sub-tab rides the URL the way the top-level tab already does (?tab=DATA), so a reload lands
// back where the user was rather than on Live Monitoring. Short slugs rather than the tab labels:
// the labels contain spaces and a hyphen, and "?sub=Re-ID%20Analysis" is not worth reading.
const DATA_TAB_SLUGS: Record<DataTab, string> = {
  "Live Monitoring": "live",
  "Re-ID Analysis": "reid",
  "RedFace": "redface",
};
const DATA_TAB_BY_SLUG = Object.fromEntries(
  Object.entries(DATA_TAB_SLUGS).map(([tab, slug]) => [slug, tab as DataTab]),
) as Record<string, DataTab>;

export const MATCH_DATA: MatchItem[] = [
  { id:1, face:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=80", cam:"NC-1", date:"2026-07-23", time:"13:40:43", similarity:96, gender:"F", age:"28", status:"Unknown" },
  { id:2, face:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80", cam:"NC-1", date:"2026-07-23", time:"13:40:45", similarity:94, gender:"M", age:"35", status:"Unknown" },
  { id:3, face:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80", cam:"NC-2", date:"2026-07-23", time:"13:41:02", similarity:89, gender:"F", age:"24", status:"Unknown" },
  { id:4, face:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80", cam:"NC-1", date:"2026-07-23", time:"13:41:15", similarity:88, gender:"M", age:"42", status:"Unknown" },
  { id:5, face:"https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80", cam:"NC-3", date:"2026-07-23", time:"13:41:30", similarity:85, gender:"F", age:"31", status:"Unknown" },
  { id:6, face:"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=200&q=80", cam:"NC-2", date:"2026-07-23", time:"13:42:01", similarity:83, gender:"M", age:"29", status:"Unknown" },
  { id:7, face:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=200&q=80", cam:"NC-4", date:"2026-07-23", time:"13:42:19", similarity:81, gender:"F", age:"37", status:"Unknown" },
  { id:8, face:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80", cam:"NC-1", date:"2026-07-23", time:"13:42:45", similarity:80, gender:"M", age:"33", status:"Unknown" },
];

const RECENT_TARGETS = [
  { face:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=80", label:"Suspect A (Female/20s)", time:"Today 13:40" },
  { face:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80", label:"Target #4012 (Male)",    time:"Today 11:15" },
  { face:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80", label:"Unidentified Trace #092",    time:"Yesterday 18:30" },
  { face:"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80", body:"https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=150&q=80" },
];

// ── Re-ID grid data ────────────────────────────────────────────
const PHOTO_POOL = [
  "1507003211169-0a1dd7228f2d","1494790108377-be9c29b29330","1519085360753-af0119f7cbe7",
  "1534528741775-53994a69daeb","1544005313-94ddf0286df2","1531746020798-e6953c6e8e04",
  "1552374196-1ab2a1c593e8","1472099645785-5658abf4ff4e","1573497019236-17f8177b81e8",
  "1548142813-c348350df52b","1524504388940-b1c1722653e1","1529626455594-4ff0802cfb7e",
  "1487222477894-8943e31ef7b2","1578632767115-351597cf2477","1500648767791-00dcc994a43e",
  "1517841905240-472988babdf9","1506794778202-cad84cf45f1d","1438761681033-6461ffad8d80",
];
// "HH:MM:SS" 24h, matching REID_DATA's own time format everywhere else — this mixed 12h ("9:38
// AM") and bare 24h ("12:35") in the same array, which stood out once shown next to a date.
const TIMES_P = ["09:38:00","09:38:00","09:38:00","12:35:00","12:35:00","08:22:00","10:14:00","11:03:00"];
const BADGES_P: (number|null)[] = [null,null,7,null,null,4,null,11,null,null,null,3,null,null,8,null,null,5];
const PERSONS = Array.from({length:72},(_,i) => ({
  id: i,
  url: `https://images.unsplash.com/photo-${PHOTO_POOL[i%PHOTO_POOL.length]}?auto=format&fit=crop&w=160&q=80`,
  time: TIMES_P[i%TIMES_P.length],
  badge: BADGES_P[i%BADGES_P.length],
}));

// ── Score Badge ────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const high = score >= 90, mid = score >= 85;
  return (
    <span style={{ fontSize:"10px", fontWeight:800, fontFamily:"monospace",
      color: high?"var(--success-400)":mid?"var(--gray-600)":"var(--gray-500)",
      backgroundColor: high?"var(--success-100)":"var(--gray-100)",
      padding:"2px 6px", borderRadius:"999px" }}>
      {score}%
    </span>
  );
}

// ── Person Detail Modal ────────────────────────────────────────
function DetailModal({ item, onClose, onGoRedmap, onGoAnalyzeFrame }: { item:MatchItem; onClose:()=>void; onGoRedmap?:()=>void; onGoAnalyzeFrame?:(location:string)=>void }) {
  const [lang] = useLanguage();
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.4)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, maxWidth:"560px", width:"100%", display:"flex", flexDirection:"column", maxHeight:"90vh", overflow:"hidden", boxShadow:"0 20px 60px rgba(14,22,42,0.18)" }}>

        {/* Header */}
        <div style={{ padding:"14px 16px", borderBottom:BORDER, backgroundColor:"var(--gray-50)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"10px", height:"10px", borderRadius:"50%", backgroundColor:"var(--success-400)", flexShrink:0 }} />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <p style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{T[lang].reidObject(String(item.id).padStart(4,"0"))}</p>
                <ScoreBadge score={item.similarity} />
                <span style={{ fontSize:"10px", fontWeight:700, color:"var(--gray-600)", backgroundColor:"var(--gray-100)", padding:"2px 7px", borderRadius:"999px" }}>{item.cam}</span>
                <span style={{ fontSize:"10px", fontWeight:800, color:REID_STATUS_STYLE[item.status].text, backgroundColor:`${REID_STATUS_STYLE[item.status].text}1a`, padding:"2px 7px", borderRadius:"999px" }}>{attr(item.status, lang)}</span>
              </div>
              <p style={{ fontSize:"10px", color:"var(--gray-400)", marginTop:"1px" }}>{item.time}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:"4px", border:"none", background:"none", cursor:"pointer", color:"var(--gray-400)", display:"flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Face/Body */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            <div style={{ border:BORDER, borderRadius:"12px", padding:"10px", backgroundColor:"var(--gray-50)", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <img src={item.face} alt="" style={{ width:"156px", height:"156px", objectFit:"cover", borderRadius:"12px", border:"2px solid var(--primary-400)" }} />
              <p style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"0.5px" }}>{T[lang].face}</p>
            </div>
            <div style={{ border:BORDER, borderRadius:"12px", padding:"10px", backgroundColor:"var(--gray-50)", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
              <img src={item.body} alt="" style={{ width:"124px", height:"186px", objectFit:"cover", borderRadius:"12px", border:"2px solid var(--primary-400)" }} />
              <p style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"0.5px" }}>{T[lang].fullBody}</p>
            </div>
          </div>

          {/* AI attrs */}
          <div>
            <p style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-900)", marginBottom:"8px" }}>{T[lang].attrClassification}</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px" }}>
              {([
                [T[lang].genderAge, `${attr(item.gender==="F"?"Female":"Male", lang)} | ${item.age}`, item.gender==="F"?"#ec4899":"var(--primary-400)"],
                [T[lang].topColor, attr("White Jacket", lang), "var(--gray-700)"],
                [T[lang].bottomColor, attr("Dark Accent", lang), "var(--gray-700)"],
                [T[lang].belongings, attr("Black Handbag", lang), "var(--gray-700)"],
              ] as [string,string,string][]).map(([label,val,color]) => (
                <div key={label} style={{ padding:"8px 10px", borderRadius:"10px", backgroundColor:"var(--gray-50)", border:BORDER }}>
                  <p style={{ fontSize:"10px", color:"var(--gray-400)", fontWeight:600, marginBottom:"2px" }}>{label}</p>
                  <p style={{ fontSize:"10px", fontWeight:600, color }}>{val}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer — Watchlist registration is a Portal(admin) function, not a VCA operator
            screen action, so it doesn't live here; Analyze Frame (same wording as Best Frame's
            own popup button) deep-links to that camera's Inspection Detail instead. */}
        <div style={{ padding:"12px 16px", borderTop:BORDER, backgroundColor:"var(--gray-50)", display:"flex", justifyContent:"flex-end", gap:"8px", flexShrink:0 }}>
          <button
            onClick={() => onGoAnalyzeFrame?.(item.cam)}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", border:BORDER, backgroundColor:"white", fontSize:"12px", fontWeight:600, color:"var(--gray-500)", cursor:"pointer" }}
          >
            {T[lang].analyzeFrame}
          </button>
          <button onClick={onGoRedmap} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", backgroundColor:"var(--gray-900)", border:"none", color:"white", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {T[lang].trackOnMap}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Monitor Card (Live Monitoring landing / detail) ─────────────
function RedFaceIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M13.5609 4.32275C14.2801 5.40986 14.6649 6.68395 14.6676 7.98743C14.6703 9.2909 14.2908 10.5666 13.5761 11.6566C12.8613 12.7467 11.8427 13.6033 10.6463 14.1206C9.4498 14.6378 8.12795 14.7929 6.84424 14.5668" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.43921 11.6774C1.72001 10.59 1.33541 9.31562 1.33302 8.01191C1.33063 6.7082 1.71054 5.4324 2.42575 4.34238C3.14096 3.25236 4.16008 2.39597 5.35698 1.87917C6.55389 1.36237 7.87606 1.20786 9.15988 1.43474" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6668 4.66667C13.4032 4.66667 14.0002 4.06971 14.0002 3.33333C14.0002 2.59695 13.4032 2 12.6668 2C11.9304 2 11.3335 2.59695 11.3335 3.33333C11.3335 4.06971 11.9304 4.66667 12.6668 4.66667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14.0002C4.06971 14.0002 4.66667 13.4032 4.66667 12.6668C4.66667 11.9304 4.06971 11.3335 3.33333 11.3335C2.59695 11.3335 2 11.9304 2 12.6668C2 13.4032 2.59695 14.0002 3.33333 14.0002Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function RedMapIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="9.5" cy="2.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.9 5.2L8.1 3.3M3.9 6.8L8.1 8.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SearchIconSm({ size = 12 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M13.9998 13.9998L11.1064 11.1064" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ReidIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.6665 4H10.6665C11.0201 4 11.3593 4.14048 11.6093 4.39052C11.8594 4.64057 11.9998 4.97971 11.9998 5.33333V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12H5.33333C4.97971 12 4.64057 11.8595 4.39052 11.6095C4.14048 11.3594 4 11.0203 4 10.6667V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function HoverActionBtn({ label, icon, color, onClick }:
  { label:string; icon:React.ReactNode; color:string; onClick:(e:React.MouseEvent)=>void }) {
  // These sit inside a card that's already showing its OWN hover state (the action row only
  // appears on card-hover in the first place) — without their own distinct feedback, mousing over
  // one specific button among the four felt identical to just hovering the card underneath it.
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
      width:"108px", height:"28px", borderRadius:"999px", cursor:"pointer",
      backgroundColor: hovered ? color : "white", border:`1.5px solid ${color}`, color: hovered ? "white" : color,
      fontSize:"12px", fontWeight:700, letterSpacing:"-0.22px",
      boxShadow: hovered ? "0 2px 8px rgba(14,22,42,0.28)" : "0 2px 6px rgba(14,22,42,0.18)",
      transform: hovered ? "scale(1.04)" : "scale(1)",
      transition:"background-color 0.12s, color 0.12s, transform 0.12s, box-shadow 0.12s",
    }}>
      {icon}{label}
    </button>
  );
}

function MonitorCard({ p, onClick, showCam = false, fill = false, onNavigateTab, onGoRedmap, onGoRedmapFrame }: { p: (typeof REID_DATA)[number]; onClick: () => void; showCam?: boolean; fill?: boolean; onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number]) => void; onGoRedmap?: () => void; onGoRedmapFrame?: (url: string, label: string) => void }) {
  const [lang] = useLanguage();
  const status = REID_STATUS_STYLE[p.status];
  // Shown on hover AND on keyboard focus. The three actions on this card were the only way to
  // send a detection to Re-ID, RedFace or Redmap, and they were rendered only while the pointer
  // was over the card — so for anyone on a keyboard, or on a touch screen, they did not exist.
  // The card itself takes focus for the same reason: it was a div with an onClick.
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const showActions = hovered || focusWithin;
  return (
    <div onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onFocus={() => setFocusWithin(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false); }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      position:"relative", height:"254px",
      // Capped flex-grow — absorbs the common case (a trailing row that's nearly full) without
      // letting a row with only 1-2 leftover cards balloon into an oversized full-width photo.
      ...(fill ? { flex:"1 1 136px", maxWidth:"160px" } : { width:"136px", flexShrink:0 }),
      borderRadius:"8px", overflow:"hidden", backgroundColor:"white", cursor:"pointer",
      border:"none", borderBottom:0,
      boxShadow:"0 3px 8px -2px rgba(14, 22, 42, 0.12)",
      transform:"translateZ(0)",
    }}>
      <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", left:0, right:0, bottom:"46px", height:"72px",
        background:"linear-gradient(to top, rgba(14,22,42,0.72), rgba(14,22,42,0))", pointerEvents:"none" }} />
      {/* Only shown in the flat "All Cameras" view — grouped-by-camera carousels already
          show the camera name in their section header, so this would be a duplicate there. */}
      {showCam && (
        <div style={{ position:"absolute", top:7, left:8, fontSize:"10px", fontWeight:800, color:"white",
          backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 6px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
          {p.cam}
        </div>
      )}
      {p.status === "RedFace" && (
        <div style={{ position:"absolute", bottom:"52px", left:8, fontSize:"10px", fontWeight:800, color:"white",
          backgroundColor:"var(--danger-400)", padding:"1px 5px", borderRadius:"2px", letterSpacing:"0.3px" }}>
          REDFACE
        </div>
      )}
      {showActions && (
        <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(14,22,42,0.6)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", zIndex:20 }}>
          <HoverActionBtn label="Re-ID" icon={<ReidIconSm />} color="var(--primary-400)" onClick={e => { e.stopPropagation(); onNavigateTab?.("Re-ID Analysis", p); }} />
          <HoverActionBtn label="RedFace" icon={<RedFaceIconSm />} color="var(--warning-500)" onClick={e => { e.stopPropagation(); onNavigateTab?.("RedFace", p); }} />
          {/* Carries this detection's frame across as the search target. It used to call
              onGoRedmap() with nothing — a card that knows exactly who it is showing, opening an
              empty form and asking the operator to describe them from memory. There is no name
              on these records to pass, so the frame is what goes. */}
          <HoverActionBtn label="Redmap" icon={<RedMapIconSm />} color="var(--success-400)"
            onClick={e => {
              e.stopPropagation();
              if (onGoRedmapFrame) onGoRedmapFrame(p.url, [p.cam, p.time].filter(Boolean).join(" · "));
              else onGoRedmap?.();
            }} />
        </div>
      )}
      <div style={{ position:"absolute", left:"-1px", right:"-1px", bottom:"-2px", height:"72px", backgroundColor:"white",
        border:"none", borderTop:"none", boxShadow:"none", margin:0, marginBottom:0,
        padding:"7px 11px 24px", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:"2px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"3px" }}>
          <span style={{ fontSize:"12px", fontWeight:800, color:status.text, letterSpacing:"-0.2px" }}>{attr(p.status, lang)}</span>
          {p.status === "VIP" && p.score !== null && <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-600)" }}>{p.score}%</span>}
        </div>
        <div style={{ display:"flex", gap:"4px", fontSize:"12px", fontWeight:600, color:"var(--gray-900)" }}>
          <span>{p.gender}</span><span>{p.age}</span>
        </div>
        <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.2px", marginBottom:"6px" }}>{cardTimestamp(p.date, p.time)}</span>
      </div>
      <div style={{ position:"absolute", right:"6px", bottom:"40px", width:"60px", height:"60px",
        borderRadius:"8px", overflow:"hidden", transform:"translateZ(0)",
        // Only VIP gets a ring (brand purple) — Unknown has nothing to call out, and RedFace
        // already gets its own dedicated "REDFACE" badge on this card (below).
        boxShadow: p.status === "VIP" ? "0 0 0 2px var(--primary-400)" : "none" }}>
        {/* Zoomed-in crop of the same big photo's face area, not a separate unrelated image —
            anchored a bit below the very top edge (most head-and-shoulders stock photos frame
            the face around 15-25% down, not flush at 0%) and zoomed less aggressively than a
            tight face-only crop so a slightly-off guess still leaves the face in frame. */}
        <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"50% 20%", display:"block", transform:"scale(1.8)", transformOrigin:"50% 20%" }} />
      </div>
    </div>
  );
}

function CameraGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M13.9585 10H16.9851C17.1271 10.0001 17.2667 10.0364 17.3907 10.1056C17.5147 10.1748 17.619 10.2745 17.6936 10.3953C17.7683 10.5161 17.8108 10.654 17.8172 10.7958C17.8236 10.9377 17.7936 11.0788 17.7301 11.2058L16.0351 14.5967C15.9709 14.7252 15.8745 14.8348 15.7553 14.9151C15.6361 14.9953 15.4982 15.0434 15.355 15.0546C15.2118 15.0659 15.0681 15.0399 14.9379 14.9792C14.8076 14.9185 14.6953 14.8252 14.6118 14.7083L12.8418 12.2333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.2553 7.54373C14.4528 7.6426 14.603 7.81584 14.6728 8.02539C14.7427 8.23493 14.7265 8.46363 14.6278 8.66123L12.0394 13.8371C11.9905 13.935 11.9227 14.0223 11.84 14.094C11.7573 14.1657 11.6613 14.2204 11.5574 14.255C11.4536 14.2896 11.3439 14.3034 11.2348 14.2956C11.1256 14.2878 11.019 14.2586 10.9211 14.2096L3.0086 10.2496C2.43388 9.96007 1.99723 9.45471 1.7942 8.84407C1.59118 8.23342 1.6383 7.56722 1.92527 6.99123L3.07527 4.66623C3.21861 4.38058 3.41681 4.12597 3.65855 3.91693C3.9003 3.70788 4.18086 3.54851 4.48421 3.44791C4.78755 3.34731 5.10775 3.30746 5.4265 3.33062C5.74525 3.35378 6.05632 3.4395 6.34194 3.5829L14.2553 7.54373Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.6665 15.8333H4.79984C5.11045 15.8355 5.41548 15.7508 5.68052 15.5888C5.94556 15.4269 6.16007 15.1941 6.29984 14.9167L7.49984 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66699 17.4993V14.166" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.8335 7.5H5.84079" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
// Landing always shows the by-camera carousel stack — the old By Camera/All Cameras toggle was
// redundant with the camera-select dropdown inside CameraDetailView, which now offers
// "All Cameras" as one of its own options (see ALL_CAMERAS_ID) instead of a separate top-level
// switch.
// Sentinel camId meaning "no single camera — the flattened feed of every online camera."
// Lets the camera-select dropdown itself offer "All Cameras" as one of its options instead of
// a separate top-level By Camera/All Cameras toggle (the two were redundant) and a separate
// horizontal-scrolling per-camera carousel landing (removed — replaced by this one screen).
const ALL_CAMERAS_ID = "__ALL__";

function ScrollUpIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// A floating "back to top" button for long, independently-scrolling result lists (Live
// Monitoring's camera grid, Re-ID Analysis' cluster list) — appears once scrolled a page or so
// down, so getting back to the top after scanning through results doesn't mean scrolling back up
// by hand. `containerRef` must point at the actual scrolling element, not a non-scrolling wrapper.
function ScrollToTopButton({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [lang] = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 400);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef]);
  if (!visible) return null;
  return (
    <button
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      title={T[lang].scrollToTop}
      style={{ position:"absolute", right:"20px", bottom:"20px", width:"40px", height:"40px", borderRadius:"50%",
        backgroundColor:"var(--gray-900)", color:"white", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 4px 14px rgba(14,22,42,0.3)", zIndex:20 }}
    >
      <ScrollUpIconSm />
    </button>
  );
}

// ── Camera Detail View (Figma: "Live monitoring detail") — now the ONLY Live Monitoring
// screen; the camera-select dropdown's "All Cameras" option covers what the old separate
// landing page (horizontal per-camera carousels) used to show. ───────────
function CameraDetailView({ camId, items, onSwitchCam, onCardClick, onNavigateTab, onGoRedmap, onGoRedmapFrame }:
  { camId:string; items:(typeof REID_DATA); onSwitchCam:(camId:string)=>void; onCardClick:(id:number)=>void; onNavigateTab?:(tab:DataTab, card:(typeof REID_DATA)[number])=>void; onGoRedmap?:()=>void; onGoRedmapFrame?: (url: string, label: string) => void; }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [pickerOpen, setPickerOpen] = useState(false);
  // Escape and click-outside, like the app's other popovers. Without them this one could only be
  // closed by clicking its trigger again — and its 320px-tall list sits over the camera wall.
  const pickerRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(pickerRef, pickerOpen, () => setPickerOpen(false));
  const cameras = useProjectCameras();
  const camera = cameras.find(c => c.code === camId);
  const isAll = camId === ALL_CAMERAS_ID;
  // The camera code itself is data and stays as it is; only the "everything" option is wording.
  const pickerLabel = isAll ? t.allCameras : camId;
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
    <div ref={scrollRef} className="vca-hide-scrollbar" style={{ position:"absolute", inset:0, overflowY:"auto", padding:"20px 24px", backgroundColor:"white", borderRadius:"12px", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px" }}>
        <div ref={pickerRef} style={{ position:"relative", width:"152px" }}>
          <button onClick={() => setPickerOpen(o => !o)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
            padding:"8px 12px", borderRadius:"8px", backgroundColor:"white", border:"1px solid var(--primary-400)",
            cursor:"pointer",
          }}>
            <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"14px", fontWeight:700, color:"var(--primary-400)",
              minWidth:0, overflow:"hidden" }}>
              <CameraGlyph />
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pickerLabel}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, transform: pickerOpen?"rotate(180deg)":"none", transition:"transform 0.15s" }}>
              <path d="M4 6l4 4 4-4" stroke="var(--primary-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {pickerOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, width:"100%", backgroundColor:"white",
              border:BORDER, borderRadius:"8px", boxShadow:"0 8px 20px rgba(14,22,42,0.12)", zIndex:10, overflow:"hidden",
              maxHeight:"320px", display:"flex", flexDirection:"column" }}>
              <button className="vca-picker-option" data-on={isAll}
                onClick={() => { onSwitchCam(ALL_CAMERAS_ID); setPickerOpen(false); }} style={{
                display:"flex", alignItems:"center", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer", flexShrink:0,
                fontSize:"13px", fontWeight: isAll ? 700:500, color: isAll ? "var(--primary-400)":"var(--gray-700)",
              }}>
                {t.allCameras}
              </button>
              <div style={{ height:"1px", backgroundColor:"var(--gray-200)", flexShrink:0 }} />
              {/* The camera roster can run to dozens of entries — without its own scroll region
                  this list just kept growing past the bottom of the screen instead of scrolling. */}
              <div className="vca-thin-scrollbar" style={{ overflowY:"auto" }}>
                {cameras.map(cam => (
                  <button key={cam.id} className="vca-picker-option" data-on={cam.code===camId}
                    onClick={() => { onSwitchCam(cam.code); setPickerOpen(false); }} style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer",
                    fontSize:"13px", fontWeight: cam.code===camId ? 700:500, color: cam.code===camId ? "var(--primary-400)":"var(--gray-700)",
                  }}>
                    {cam.code}
                    <span style={{ fontSize:"10px", fontWeight:800, color: runStateOf(cam.status)==="running" ? "var(--success-400)" : "var(--gray-400)" }}>
                      {runStateOf(cam.status)==="running" ? "ON" : "OFF"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {camera && (
          <>
            <span style={{ fontSize:"10px", fontWeight:800, color: runStateOf(camera.status)==="running" ? "var(--success-400)" : "var(--gray-400)",
              backgroundColor: runStateOf(camera.status)==="running" ? "var(--success-100)" : "var(--gray-100)", padding:"4px 10px", borderRadius:"999px" }}>
              {runStateOf(camera.status)==="running" ? t.camOnline : t.camOffline}
            </span>
            <span style={{ fontSize:"12px", color:"var(--gray-400)" }}>IP {camera.ip} · {t.rtspConnected}</span>
          </>
        )}
      </div>

      {/* flex-wrap + flex-grow (not CSS grid) — see the "All Cameras" grid above for why. */}
      {items.length === 0 ? (
        // Nothing captured, which happens for a real reason: this camera is not running, or the
        // whole site is stopped. The wall used to render a header over blank white and leave the
        // operator to guess whether the screen had failed.
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"72px 24px", gap:"6px" }}>
          <p style={{ margin:0, fontSize:"14px", fontWeight:700, color:"var(--gray-600)" }}>{t.noFeedTitle}</p>
          <p style={{ margin:0, fontSize:"13px", fontWeight:500, color:"var(--gray-400)", textAlign:"center", maxWidth:"360px", lineHeight:1.6 }}>{t.noFeedBody}</p>
        </div>
      ) : (
      <div style={{ display:"flex", flexWrap:"wrap", gap:"12px" }}>
        {items.map(p => <MonitorCard key={p.id} p={p} onClick={() => onCardClick(p.id)} showCam={isAll} fill onNavigateTab={onNavigateTab} onGoRedmap={onGoRedmap} onGoRedmapFrame={onGoRedmapFrame} />)}
      </div>
      )}
    </div>
    <ScrollToTopButton containerRef={scrollRef} />
    </div>
  );
}

function reidToMatchItem(p: (typeof REID_DATA)[number]): MatchItem {
  // face:p.url (not p.face) — p.face cycles through an unrelated stock-photo pool independent of
  // the person's own photo, so DetailModal's "Face Detection Crop" would show a different
  // person's face than the "Full-Body Object Crop" (body:p.url) right next to it.
  // similarity:p.similarity (not p.score) — `.score` is the VIP-confidence field (only meaningful
  // when status==="VIP"; buildTargetResultRows always sets it null), `.similarity` is the actual
  // Re-ID match confidence every row carries. Reading `.score` used to silently produce 0% for
  // any caller that didn't separately re-patch `.similarity` back in afterward.
  return { id:p.id, face:p.url, body:p.url, cam:p.cam, date:p.date, time:p.time, similarity:p.similarity, gender:p.gender as "M"|"F", age:p.age, plate:p.plate, status:p.status };
}

const LIVE_FEED_STATUS_CYCLE: ReIDStatus[] = ["VIP","Unknown","Unknown"];

// Same "YYYY-MM-DD" / "HH:MM:SS" split every other date+time pair in this file uses (REID_DATE_CYCLE,
// RedFace's cooccurrence dates, Smart Search) — this used to bundle both into one "Aug 06,14:16:29"
// `time` string while a separate, unrelated `date` field cycled through REID_DATE_CYCLE independently,
// so showing both together (to match everywhere else) produced a nonsense double date.
//
// The SITE's clock, not the machine's. These stamp a live capture, and everything that reads them
// back measures against the site: cardTimestamp compares the date to the site's today, and the
// activity chart buckets by the site's hour. Written with getFullYear()/getHours() they were the
// viewer's own clock, so on this machine (Asia/Seoul) against a Singapore site a frame captured
// at 00:30 was stamped "Sep 9 16:30" — the wrong day AND the wrong time, on a card that had just
// appeared.
function formatCapturedDate(d: Date): string {
  return sgtDateKey(d);
}
function formatCapturedTime(d: Date): string {
  return sgtClockTime(d);
}

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Narrow photo-tile cards (MonitorCard, ClusterMatchCard, SearchResultCard) don't have room for a
// full "2026-08-06 14:16:29" — the underlying `date` field stays "YYYY-MM-DD" everywhere (RedFace's
// table views sort on it as a plain string, e.g. `a.date + a.time`), this only reformats it for
// display in those tight spots, to the "Aug 6" style the wider views don't need.
function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d}`;
}
// Time alone is unambiguous for something that happened today — the date only earns its keep
// when the record is from a DIFFERENT day, which is most of what these mock cards show (only
// Live Monitoring's feed is genuinely "just now"; the rest cycle through REID_DATE_CYCLE's spread
// of past dates). Comparing against today's real Singapore-time date, same as every other
// "today" check in this app (isTodaySgt).
function cardTimestamp(isoDate: string, time: string): string {
  return isoDate === sgtDateKey(new Date()) ? time : `${shortDate(isoDate)} ${time}`;
}
const LIVE_FEED_CAPTURE_INTERVAL_MS = 45_000;

function makeLiveItem(seed: number, camId: string, index: number): (typeof REID_DATA)[number] {
  const person = PERSONS[seed % PERSONS.length];
  const status = LIVE_FEED_STATUS_CYCLE[seed % LIVE_FEED_STATUS_CYCLE.length];
  // Leftmost card in the feed is the most recent capture — later positions step further back in
  // time. date/time both come from this SAME instant now, instead of date cycling independently.
  const capturedAt = new Date(Date.now() - index * LIVE_FEED_CAPTURE_INTERVAL_MS);
  return {
    ...person,
    id: 100000 + seed,
    date: formatCapturedDate(capturedAt),
    time: formatCapturedTime(capturedAt),
    status,
    gender: REID_GENDER_CYCLE[seed % REID_GENDER_CYCLE.length],
    age: REID_AGE_CYCLE[seed % REID_AGE_CYCLE.length],
    score: status === "VIP" ? 87.8 : null,
    cam: camId,
    face: REID_FACE_POOL[seed % REID_FACE_POOL.length],
    apparel: REID_APPAREL_CYCLE[seed % REID_APPAREL_CYCLE.length],
    prop: REID_PROP_CYCLE[seed % REID_PROP_CYCLE.length],
    similarity: REID_SIMILARITY_CYCLE[seed % REID_SIMILARITY_CYCLE.length],
    topColor: REID_TOP_COLOR_CYCLE[seed % REID_TOP_COLOR_CYCLE.length],
    bottomColor: REID_BOTTOM_COLOR_CYCLE[seed % REID_BOTTOM_COLOR_CYCLE.length],
    shoesColor: REID_SHOES_COLOR_CYCLE[seed % REID_SHOES_COLOR_CYCLE.length],
    emotion: REID_EMOTION_CYCLE[seed % REID_EMOTION_CYCLE.length],
    ethnicGroup: REID_ETHNIC_GROUP_CYCLE[seed % REID_ETHNIC_GROUP_CYCLE.length],
    plate: null as string | null,
  };
}

function seedLiveFeed(): Record<string, (typeof REID_DATA)> {
  const feed: Record<string, (typeof REID_DATA)> = {};
  // This site's RUNNING cameras only. Seeding every site's meant the wall showed feeds from
  // cameras that are not on this screen's site, and the "All Cameras" view counted them — and
  // seeding stopped ones meant a camera that is dark had 120 captures under its name, a third of
  // them badged "VIP · 87.8%". The picker offers stopped cameras (with an OFF badge), so that
  // wall was one click away, while the "All Cameras" view already excluded them: the two views
  // of the same site disagreed. A camera that is not running captured nothing.
  getCameraStatus().running.forEach((cam, camIndex) => {
    feed[cam.code] = Array.from({ length: 120 }, (_, i) => makeLiveItem(500000 + camIndex * 1000 + i, cam.code, i));
  });
  return feed;
}

// A labeled "All | option | option…" segmented row — Gender/Hat/Sleeve length/Bottoms/Backpack
// all share this exact shape (one active choice, "All" meaning "don't filter on this").
// The option strings are the values the filter state holds; `attr()` decides how each is drawn.
function AllOptionRow({ label, options, value, onChange }: { label:string; options:string[]; value:string; onChange:(v:string)=>void }) {
  const [lang] = useLanguage();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>{label}</span>
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
        <AttrChip label={T[lang].all} active={value === ""} onClick={() => onChange("")} size="sm" />
        {options.map(o => <AttrChip key={o} label={attr(o, lang)} active={value === o} onClick={() => onChange(o)} size="sm" />)}
      </div>
    </div>
  );
}

// Fixed option list reads as a real selector rather than a free-text field, even though (like
// Emotion/Ethnic group below) nothing in the mock detection data actually carries these
// attributes to filter on.
const EMOTION_OPTIONS = ["Anger","Disgust","Neutral","Fear","Happiness","Sadness","Surprised"];
const ETHNIC_GROUP_OPTIONS = ["African American","Indian","Asian","Caucasian"];
// Same trigger+panel shape as the "Sort associates by" dropdown in RedFace's Associate filter —
// a custom-built open panel (checkmark + light-purple highlight on the selected row) instead of
// a native <select>'s browser/OS-drawn list, so it looks identical everywhere rather than however
// the current OS happens to render native selects.
function SimpleSelect({ value, options, onChange }: { value:string; options:string[]; onChange:(v:string)=>void }) {
  // The values stay English in state — they are what the model reports and what the filter holds
  // — and are translated here, where they are drawn. Its sibling AllOptionRow already did this;
  // this widget did not, so the two rows above it read Korean while Emotion and Ethnic group
  // stayed "All / Neutral / Caucasian" with translations sitting unused in ATTR_KO.
  const [lang] = useLanguage();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position:"relative", width:"100%" }}>
      <style>{`
        .vca-simple-select-trigger:hover { border-color:var(--primary-300) !important; }
        /* The option rows set their own background inline (selected vs not), and an inline
           declaration outranks a plain selector — so this rule did nothing until it carried
           !important like its neighbours. The selected row keeps its purple on hover: it is
           already the current value, and graying it would read as losing the selection. */
        .vca-simple-select-option:hover { background-color:var(--gray-50) !important; }
        .vca-simple-select-option[data-on="true"]:hover { background-color:var(--primary-100) !important; }
      `}</style>
      <button onClick={() => setOpen(o => !o)} className="vca-simple-select-trigger" style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
        height:"32px", padding:"0 10px", borderRadius:"8px", border:BORDER, backgroundColor:"white", cursor:"pointer",
      }}>
        <span style={{ fontSize:"12px", fontWeight:600, color: value ? "var(--gray-900)" : "var(--gray-400)" }}>{value ? attr(value, lang) : t.filterAll}</span>
        <span style={{ display:"flex", color:"var(--gray-600)", transform: open ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>
      {open && (
        <div className="vca-hide-scrollbar" style={{ position:"absolute", top:"100%", left:0, marginTop:"4px", width:"100%", maxHeight:"220px", overflowY:"auto",
          backgroundColor:"white", border:BORDER, borderRadius:"8px", boxShadow:"0 8px 20px rgba(14,22,42,0.12)", zIndex:10 }}>
          {["", ...options].map(o => {
            const active = value === o;
            return (
              <button key={o || "__all__"} onClick={() => { onChange(o); setOpen(false); }} className="vca-simple-select-option" data-on={active} style={{
                display:"flex", alignItems:"center", gap:"6px", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer",
                backgroundColor: active ? "var(--primary-100)" : "white",
                fontSize:"12px", fontWeight: active ? 700 : 500, color: active ? "var(--primary-400)" : "var(--gray-700)",
              }}>
                <span style={{ display:"flex", width:"12px", flexShrink:0 }}>
                  {active && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                {o ? attr(o, lang) : t.filterAll}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type LiveSearchTab = "Photo" | "Filter" | "VIP" | "Car";

// Collapsed search icon <-> full sidebar used to be a hard swap (button unmounted, sidebar
// mounted, in the same render) — every filter/tab/upload the operator had set was gone the moment
// they collapsed it, and the cut was instant enough to read as a glitch rather than a UI choice.
// This keeps the sidebar permanently mounted (so its state survives collapsing) and animates the
// wrapper's width instead, revealing/hiding it like a drawer — the sidebar's own width never
// changes, only how much of it the wrapper's overflow:hidden currently exposes.
function SlidingSearchPanel({ expanded, onExpand, sidebar }: { expanded: boolean; onExpand: () => void; sidebar: React.ReactNode }) {
  const [lang] = useLanguage();
  return (
    <div style={{
      position:"relative", width: expanded ? "320px" : "48px", height:"100%", flexShrink:0,
      transition:"width 0.28s cubic-bezier(0.32, 0.72, 0, 1)", overflow:"hidden", borderRadius:"12px",
    }}>
      <div style={{ position:"absolute", inset:0, width:"320px" }}>
        {sidebar}
      </div>
      {/* Covers the full column height, not just the button's own 48x48 square — the sidebar
          underneath is only clipped to 48px wide when collapsed, not hidden, so anything below
          the button's height (its header text, tab icons, etc.) would otherwise still show through
          as a sliver instead of a clean collapsed rail. */}
      <div style={{
        position:"absolute", top:0, left:0, bottom:0, width:"48px", backgroundColor:"var(--gray-100)",
        display:"flex", flexDirection:"column", alignItems:"center",
        opacity: expanded ? 0 : 1, pointerEvents: expanded ? "none" : "auto",
        transition:"opacity 0.15s ease",
      }}>
        <button
          onClick={onExpand}
          title={T[lang].smartSearch}
          style={{
            width:"48px", height:"48px", borderRadius:"16px",
            backgroundColor:"white", border:"none", display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", color:"var(--gray-600)", flexShrink:0,
          }}
        >
          <SearchIconSm size={20} />
        </button>
      </div>
    </div>
  );
}

// The Smart Search sidebar embedded in Live Monitoring, specifically — Re-ID Analysis/RedFace
// keep their own existing single-scroll SearchPanel/attribute-filter layouts unchanged. This one
// splits into Photo/Filter/VIP/Car tabs instead of one long list, since Live Monitoring's version
// grew enough fields (Hat/Sleeve length/Bottoms/Backpack/Emotion/Ethnic group on top of the usual
// set) that a single scrolling column stopped being the clearest shape for it.
function LiveSearchSidebar({
  state, tab, onTabChange,
  hatFilter, onHatChange, sleeveFilter, onSleeveChange, bottomsFilter, onBottomsChange, backpackFilter, onBackpackChange,
  emotion, onEmotionChange, ethnicGroup, onEthnicGroupChange,
  onSearch, onCollapse,
}: {
  state: SearchFilterState;
  tab: LiveSearchTab; onTabChange: (t: LiveSearchTab) => void;
  hatFilter: ""|"Hat"|"None"; onHatChange: (v: ""|"Hat"|"None") => void;
  sleeveFilter: ""|"Short"|"Long"; onSleeveChange: (v: ""|"Short"|"Long") => void;
  bottomsFilter: ""|"Trousers"|"Shorts"|"Skirts"; onBottomsChange: (v: ""|"Trousers"|"Shorts"|"Skirts") => void;
  backpackFilter: ""|"Exists"|"None"; onBackpackChange: (v: ""|"Exists"|"None") => void;
  emotion: string; onEmotionChange: (v: string) => void;
  ethnicGroup: string; onEthnicGroupChange: (v: string) => void;
  // Seeds the Photo tab's preview from a camera card's own photo (via the "Search" hover
  // button) — optional since the other tab that reuses this sidebar has no such card to seed from.
  onSearch: () => void; onCollapse: () => void;
}) {
  // Read from the store rather than threaded through props: this is the only place in Data that
  // starts a search, so the check belongs next to the button, not in every caller.
  const portalUsers = useVcaStore(state => state.portalUsers);
  const searchAllowed = canSearchInApp(portalUsers);
  const [lang] = useLanguage();
  const t = T[lang];
  const {
    setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender,
    topColors, toggleTopColor, bottomColors, toggleBottomColor, shoesColors, toggleShoesColor,
    dateRange, setDateRange, licensePlate, setLicensePlate, reset,
  } = state;
  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : null;
  const vipName = activeVIP >= 0 ? VIP_QUICK[activeVIP].name : null;
  // Selected target first, same as RedFace's picker and the compact VIP row: this list scrolls
  // horizontally, so a pick made further along leaves the viewport and then nothing on screen
  // says which target the search is loaded with. Recency order is kept for the rest — original
  // indices ride along because selectRecentTarget and selectedTarget are index-based.
  const recentOrder = RECENT_TARGETS_EN.map((t, i) => ({ t, i }));
  const recentActiveAt = recentOrder.findIndex(o => o.i === selectedTarget);
  if (recentActiveAt > 0) recentOrder.unshift(...recentOrder.splice(recentActiveAt, 1));

  // A real, user-supplied reference photo — not a recent-target/VIP pick — takes over the
  // preview the same way `target` does, and clears itself if the operator picks a target after
  // uploading (so the two "who am I searching for" sources never fight over the same box).
  const [uploadedFace, setUploadedFace] = useState<string | null>(null);
  const [uploadedBody, setUploadedBody] = useState<string | null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  // e.target.value is cleared so picking the SAME file again still fires onChange — without it,
  // detaching an image and re-attaching the identical file silently did nothing. The previous
  // blob is revoked on both replace and detach so it isn't held for the rest of the session.
  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (uploadedFace) URL.revokeObjectURL(uploadedFace);
    setUploadedFace(URL.createObjectURL(file));
  };
  const handleBodyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (uploadedBody) URL.revokeObjectURL(uploadedBody);
    setUploadedBody(URL.createObjectURL(file));
  };
  const clearUploadedFace = () => {
    if (uploadedFace) URL.revokeObjectURL(uploadedFace);
    setUploadedFace(null);
  };
  const clearUploadedBody = () => {
    if (uploadedBody) URL.revokeObjectURL(uploadedBody);
    setUploadedBody(null);
  };
  const faceSrc = uploadedFace ?? target?.face;
  const bodySrc = uploadedBody ?? target?.body;
  // Picking a Recent target/VIP after uploading a photo should switch the preview to THAT
  // person, not keep showing the stale upload underneath it. Compared during render rather than
  // reset from an effect — compare during render instead. An effect would paint one
  // frame with the new selection and the old upload still on top of it, then paint again.
  const targetKey = `${selectedTarget}|${activeVIP}`;
  const [prevTargetKey, setPrevTargetKey] = useState(targetKey);
  if (targetKey !== prevTargetKey) {
    setPrevTargetKey(targetKey);
    setUploadedFace(null);
    setUploadedBody(null);
  }

  const TABS: { id: LiveSearchTab; label:string; icon:React.ReactNode }[] = [
    { id:"Photo",  label: t.tabPhoto,   icon:<ImageIconSm size={16} /> },
    { id:"Filter", label: t.tabFilter,  icon:<SlidersIconSm size={16} /> },
    { id:"VIP",    label: t.tabVip,     icon:<StarIconSm size={16} /> },
    { id:"Car",    label: t.tabVehicle, icon:<VehicleIconSm size={19} /> },
  ];
  const changeTab = (t: LiveSearchTab) => { onTabChange(t); setSearchType(t === "Car" ? "VEHICLE" : "PERSON"); };
  // Same size/weight/color as the "Date range" section label above — was smaller, muted-gray,
  // and all-caps, which read as a visually distinct (and unintentionally lower-priority) label
  // style from the rest of the sidebar's section titles.
  const filterLabelStyle: React.CSSProperties = { fontSize:"12px", fontWeight:700, color:"var(--gray-700)" };

  return (
    <div style={{ width:"320px", flexShrink:0, backgroundColor:"white", borderRadius:"12px",
      display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", boxSizing:"border-box" }}>
      <div style={{ padding:"20px 16px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"var(--gray-900)" }}>
          <SearchIconSm size={16} />
          <span style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px" }}>{t.smartSearch}</span>
        </div>
        <button onClick={onCollapse} aria-label={t.collapse} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-400)", display:"flex" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div style={{ display:"flex", padding:"0 12px", gap:"4px", flexShrink:0, borderBottom:BORDER }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => changeTab(t.id)} style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", padding:"8px 0 10px",
              background:"none", border:"none", cursor:"pointer",
              borderBottom: active ? "2px solid var(--primary-400)" : "2px solid transparent",
              color: active ? "var(--primary-400)" : "var(--gray-400)", marginBottom:"-1px",
            }}>
              {/* Fixed-height slot regardless of each icon's own rendered size — the Vehicle
                  icon renders a couple px taller than the others (see VehicleIconSm) since it's
                  a naturally wide/short silhouette that needs the extra size to not look small,
                  and without this wrapper that taller box pushed just its own label down out of
                  line with the other three. */}
              <div style={{ height:"18px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {t.icon}
              </div>
              <span style={{ fontSize:"10px", fontWeight:700 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:"18px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", color:"var(--gray-700)" }}>
            <CalendarIconSm size={12} color="var(--gray-700)" />
            <span style={{ fontSize:"12px", fontWeight:700 }}>{t.dateRange}</span>
          </div>
          <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="split" size="sm" emptyText={t.last7days} showIcon={false} />
        </div>

        {tab === "Photo" && (
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", color:"var(--gray-700)" }}>
                <HistoryIconSm />
                <span style={{ fontSize:"12px", fontWeight:700 }}>{t.recentTargets}</span>
              </div>
              {/* Same card, scrollbar and selected-first ordering as RedFace's target picker —
                  two places offering the same list were reading as two different features, one
                  showing when each target was used and one not. */}
              <div className="vca-thin-scrollbar" style={{ display:"flex", flexWrap:"nowrap", gap:"8px", overflowX:"auto", paddingBottom:"6px" }}>
                {recentOrder.map(({ t, i }) => (
                  <button key={i} onClick={() => selectRecentTarget(i)} style={{
                    flexShrink:0, display:"flex", alignItems:"center", gap:"8px", padding:"8px", borderRadius:"8px", cursor:"pointer",
                    backgroundColor:"white",
                    border: selectedTarget === i ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)",
                    boxShadow: selectedTarget === i ? "0 2px 2px rgba(90,61,251,0.1)" : "none",
                  }}>
                    <img src={t.face} alt="" style={{ width:"32px", height:"32px", borderRadius:"4px", objectFit:"cover" }} />
                    <div style={{ textAlign:"left" }}>
                      <p style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", margin:0 }}>{t.label}</p>
                      <p style={{ fontSize:"10px", color:"var(--gray-400)", margin:0 }}>{t.time}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>{t.targetFace}</span>
              {/* Three sources feed these previews: an upload, a chosen Recent target, or the card
                  this sidebar opened from. Only the first two are the user's to remove — clearing a
                  chosen target reuses its own toggle rather than a second code path, and the card
                  photo is the context, not a selection. */}
              <ImageDropzoneBox icon={<DefaultFaceIconSm />} label={t.face} previewSrc={faceSrc} aspect="square"
                onClick={() => faceInputRef.current?.click()}
                onClear={uploadedFace ? clearUploadedFace
                  : selectedTarget >= 0 ? () => selectRecentTarget(selectedTarget)
                  : undefined} />
              <input ref={faceInputRef} type="file" accept="image/*" onChange={handleFaceUpload} style={{ display:"none" }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>{t.targetBody}</span>
              <ImageDropzoneBox icon={<FullBodyIconSm />} label={t.body} previewSrc={bodySrc} aspect="portrait"
                onClick={() => bodyInputRef.current?.click()}
                onClear={uploadedBody ? clearUploadedBody
                  : selectedTarget >= 0 ? () => selectRecentTarget(selectedTarget)
                  : undefined} />
              <input ref={bodyInputRef} type="file" accept="image/*" onChange={handleBodyUpload} style={{ display:"none" }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>{t.similarity}</span>
              <SimilarityControl value={threshold} onChange={setThreshold} height={32} cost={state.thresholdCost} />
            </div>
          </>
        )}

        {tab === "Filter" && (
          <>
            <AllOptionRow label={t.labelGender} options={["Male","Female"]} value={gender} onChange={setGender} />
            <AllOptionRow label={t.labelHat} options={["Hat","None"]} value={hatFilter} onChange={(v) => onHatChange(v as ""|"Hat"|"None")} />
            <AllOptionRow label={t.labelSleeve} options={["Short","Long"]} value={sleeveFilter} onChange={(v) => onSleeveChange(v as ""|"Short"|"Long")} />
            <AllOptionRow label={t.labelBottoms} options={["Trousers","Shorts","Skirts"]} value={bottomsFilter} onChange={(v) => onBottomsChange(v as ""|"Trousers"|"Shorts"|"Skirts")} />
            <AllOptionRow label={t.labelBackpack} options={["Exists","None"]} value={backpackFilter} onChange={(v) => onBackpackChange(v as ""|"Exists"|"None")} />
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <span style={filterLabelStyle}>{t.labelEmotion}</span>
              <SimpleSelect value={emotion} options={EMOTION_OPTIONS} onChange={onEmotionChange} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <span style={filterLabelStyle}>{t.labelEthnic}</span>
              <SimpleSelect value={ethnicGroup} options={ETHNIC_GROUP_OPTIONS} onChange={onEthnicGroupChange} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <span style={filterLabelStyle}>{t.topColors}</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {APPAREL_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={topColors.includes(c.id)} onClick={() => toggleTopColor(c.id)} size={18} />)}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <span style={filterLabelStyle}>{t.bottomColors}</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {APPAREL_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={bottomColors.includes(c.id)} onClick={() => toggleBottomColor(c.id)} size={18} />)}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              <span style={filterLabelStyle}>{t.shoesColors}</span>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {SHOE_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={shoesColors.includes(c.id)} onClick={() => toggleShoesColor(c.id)} size={18} />)}
              </div>
            </div>
          </>
        )}

        {tab === "VIP" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>
              {vipName ? t.selectedVip(vipName) : t.chooseVip}
            </span>
            <VipQuickSelectRow activeVIP={activeVIP} onSelect={selectVIP} />
          </div>
        )}

        {tab === "Car" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-700)" }}>{t.licensePlate}</span>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", height:"34px", padding:"0 10px",
              borderRadius:"8px", border:BORDER, backgroundColor:"white" }}>
              <LicensePlateIconSm />
              <input
                value={licensePlate}
                onChange={e => setLicensePlate(e.target.value)}
                placeholder="SGA 1234 X"
                style={{ flex:1, border:"none", outline:"none", background:"none", fontFamily:"monospace", fontSize:"12px",
                  fontWeight:500, color:"var(--gray-900)", letterSpacing:"-0.22px" }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:"12px 16px 16px", display:"flex", gap:"8px", flexShrink:0 }}>
        <button onClick={() => { reset(); setUploadedFace(null); setUploadedBody(null); }} aria-label={t.reset} style={{ padding:"0 14px", height:"38px", borderRadius:"8px", border:"1px solid var(--gray-300)", backgroundColor:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <ResetIconSm />
        </button>
        {/* Person search is granted per account (PortalUser.appSearch) — reconstructing where
            someone went is the app's most invasive action. Disabled with the reason attached rather
            than hidden: an operator who cannot search should know that the capability exists and
            who to ask, not conclude the product cannot do it. */}
        <button
          onClick={() => { if (searchAllowed) onSearch(); }}
          // Not `disabled`: a disabled button takes no focus, so the one place that says WHY —
          // the tooltip — could not be reached by keyboard, screen reader or touch, which is
          // every way of using this screen except a mouse. aria-disabled states the same fact
          // to assistive tech while leaving the control reachable, and the sentence below says
          // it in text for everyone else.
          aria-disabled={!searchAllowed}
          title={searchAllowed ? undefined : t.noSearchPermission}
          style={{ flex:1, height:"38px", borderRadius:"8px", border:"none", backgroundColor: searchAllowed ? "var(--gray-900)" : "var(--gray-100)", color: searchAllowed ? "white" : "var(--gray-400)", fontSize:"13px", fontWeight:700, cursor: searchAllowed ? "pointer" : "not-allowed" }}>
          {t.search}
        </button>
      </div>
      {!searchAllowed && (
        <p style={{ margin:"8px 0 0", fontSize:"11px", fontWeight:600, color:"var(--gray-500)", lineHeight:1.6 }}>
          {t.noSearchPermission}
        </p>
      )}
    </div>
  );
}

// ── Live Monitoring Tab (wrapper: landing ↔ per-camera detail) ──
function LiveMonitoringTab({ openCam, onOpenCamChange, onNavigateTab, onGoRedmap, onGoRedmapFrame, onGoAnalyzeFrame }: {
  openCam: string; onOpenCamChange: (v: string) => void;
  onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number]) => void; onGoRedmap?: () => void; onGoRedmapFrame?: (url: string, label: string) => void; onGoAnalyzeFrame?: (location: string) => void;
}) {
  const [detailId, setDetailId] = useState<number|null>(null);
  const [feed, setFeed]         = useState(seedLiveFeed);
  const seedRef = useRef(1);
  // Re-seed when the header switches site. Without this the wall keeps the previous site's cards
  // — the seed runs once at mount, and nothing else would clear them.
  const scopedProjectId = useActiveProjectId();
  // Every search on this screen is answerable only from this site's cameras — see
  // useSiteCameraCodes.
  const siteCameras = useSiteCameraCodes();
  const firstFeedRef = useRef(true);
  useEffect(() => {
    if (firstFeedRef.current) { firstFeedRef.current = false; return; }
    setFeed(seedLiveFeed());
  }, [scopedProjectId]);

  // Smart Search used to be its own top-level Data tab, disconnected from the camera view it was
  // actually meant to search from. Every other Data tab keeps its search filters in a collapsible
  // sidebar right next to whatever it's already showing (e.g. Re-ID Analysis's live clusters)
  // instead of swapping the whole screen out — this reuses that exact SearchPanel/collapse
  // pattern so the live camera grid stays visible (and collapsible-around) instead of disappearing
  // behind a full-page search form.
  const [searchExpanded, setSearchExpanded]     = useState(false);
  const [searchTab, setSearchTab]               = useState<"Photo"|"Filter"|"VIP"|"Car">("Photo");
  const [searched, setSearched]                 = useState(false);
  const [searchDetailId, setSearchDetailId]     = useState<number|null>(null);
  const [searchType, setSearchType]             = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget]     = useState(-1);
  const [activeVIP, setActiveVIP]               = useState(-1);
  // The specific REID_DATA row a camera card's "Search" button was clicked on — its own face/
  // body photos become the search target, same as picking a Recent target or VIP, rather than
  // landing on a blank Photo tab that only filters by camera/gender/date.
  const [threshold, setThreshold]               = useState(70);
  const [gender, setGender]                     = useState("");
  // These four are broken out into their own ALL/one-of-N segmented controls (matching the
  // reference layout) instead of the multi-select Apparel/Props chip lists used elsewhere in
  // Data — they still resolve down into the same apparel/props shape filterReidData expects,
  // just derived rather than stored directly (see derivedApparel/derivedProps below).
  const [hatFilter, setHatFilter]               = useState<""|"Hat"|"None">("");
  const [sleeveFilter, setSleeveFilter]         = useState<""|"Short"|"Long">("");
  const [bottomsFilter, setBottomsFilter]       = useState<""|"Trousers"|"Shorts"|"Skirts">("");
  const [backpackFilter, setBackpackFilter]     = useState<""|"Exists"|"None">("");
  const [emotion, setEmotion]                   = useState("");
  const [ethnicGroup, setEthnicGroup]           = useState("");
  const [topColors, setTopColors]               = useState<string[]>([]);
  const [bottomColors, setBottomColors]         = useState<string[]>([]);
  const [shoesColors, setShoesColors]           = useState<string[]>([]);
  const [searchDateRange, setSearchDateRange]   = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate]         = useState("");
  const [searchCamera, setSearchCamera]         = useState("");

  // The search outcome goes when the header switches site, for the same reason the wall is
  // re-seeded above — declared here rather than beside that effect only because these states are
  // declared below it.
  const firstSearchSiteRef = useRef(true);
  useEffect(() => {
    if (firstSearchSiteRef.current) { firstSearchSiteRef.current = false; return; }
    // The results too, not just the wall. Results are derived from the target and this site's
    // cameras, so leaving the screen in its searched state re-answered the previous site's
    // question with this site's cameras: the same person, suddenly "seen" twenty times at a
    // school he has never been to. The query itself (target, attributes, dates) is the
    // operator's own and survives, ready to be run again here — same rule as Redmap.
    setSearched(false);
    setSearchDetailId(null);
    // A camera code belongs to one site, so this one cannot mean anything here.
    setSearchCamera("");
  }, [scopedProjectId]);

  const toggleTopColor    = (c: string) => setTopColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleBottomColor = (c: string) => setBottomColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleShoesColor  = (c: string) => setShoesColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const clearAttrFilters = () => {
    setHatFilter(""); setSleeveFilter(""); setBottomsFilter(""); setBackpackFilter("");
    setEmotion(""); setEthnicGroup("");
  };
  const searchReset = () => {
    setSearchType("PERSON"); setThreshold(70); setGender(""); clearAttrFilters();
    setTopColors([]); setBottomColors([]); setShoesColors([]);
    setSelectedTarget(-1); setActiveVIP(-1); setSearchDateRange({ start:null, end:null });
    setLicensePlate(""); setSearchCamera(""); setSearched(false); setSearchTab("Photo");
  };
  const selectRecentTarget = (i: number) => {
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); clearAttrFilters(); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender);
    if (t.apparel === "Short Sleeve" || t.apparel === "Long Sleeve") {
      setSleeveFilter(t.apparel === "Short Sleeve" ? "Short" : "Long");
      setBottomsFilter("");
    } else {
      setBottomsFilter(t.apparel as "Trousers"|"Shorts"|"Skirts");
      setSleeveFilter("");
    }
    setHatFilter(t.props.includes("Hat") ? "Hat" : "");
    setBackpackFilter(t.props.includes("Backpack/Bag") ? "Exists" : "");
  };
  const selectVIP = (i: number) => {
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1);
  };
  const handleNavigate = (tab: DataTab, card: (typeof REID_DATA)[number]) => {
    onNavigateTab?.(tab, card);
  };

  // Resolved down into the same apparel/props shape filterReidData and SmartSearchResults expect
  // — the segmented Hat/Sleeve/Bottoms/Backpack controls are a different UI over the same data,
  // not a parallel filtering concept.
  // Memoised: these feed the threshold-cost memo below, and a fresh array on every render would
  // make it recompute every render instead of when the query actually changes.
  const derivedApparel = useMemo(() => [
    sleeveFilter === "Short" ? "Short Sleeve" : sleeveFilter === "Long" ? "Long Sleeve" : null,
    bottomsFilter || null,
  ].filter((v): v is string => !!v), [sleeveFilter, bottomsFilter]);
  const derivedProps = useMemo(() => [
    hatFilter === "Hat" ? "Hat" : null,
    backpackFilter === "Exists" ? "Backpack/Bag" : null,
  ].filter((v): v is string => !!v), [hatFilter, backpackFilter]);

  // Who these results are about — see SearchFilterState.activeTarget. This panel has the two
  // pickers; a crop off the wall goes to Re-ID, which is the screen for "where else has this
  // person been".
  const activeTarget = activeVIP >= 0
    ? { face: VIP_QUICK[activeVIP].face, label: VIP_QUICK[activeVIP].name }
    : selectedTarget >= 0
      ? { face: RECENT_TARGETS_EN[selectedTarget].face, label: RECENT_TARGETS_EN[selectedTarget].label }
      : null;
  const clearActiveTarget = () => {
    if (activeVIP >= 0) selectVIP(activeVIP);
    else if (selectedTarget >= 0) selectRecentTarget(selectedTarget);
  };
  const searchTarget = activeVIP >= 0 ? VIP_QUICK[activeVIP]
    : selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget]
    // REID_DATA's own gender is "M"/"F"; buildTargetResultRows and the rest of this shape expect
    // "Male"/"Female", the same format VIP_QUICK/RECENT_TARGETS_EN already use.
    : null;

  /**
   * What this threshold costs, counted against the pool this query actually has — see
   * SimilarityControl. Null with no query: the unfiltered pool is the whole mock, and a count of
   * that would describe a question nobody asked.
   */
  const thresholdCost = useMemo(() => {
    if (searchType !== "PERSON") return null;
    const hasAttributeQuery = !!gender || derivedApparel.length > 0 || derivedProps.length > 0
      || topColors.length > 0 || bottomColors.length > 0 || shoesColors.length > 0
      || !!emotion || !!ethnicGroup;
    if (!searchTarget && !hasAttributeQuery) return null;
    const pool = searchTarget
      ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20, siteCameras)
      : filterReidData({ searchType, gender, apparel: derivedApparel, props: derivedProps, dateRange: searchDateRange, threshold: 0, topColors, bottomColors, shoesColors, emotion, ethnicGroup, siteCameras });
    if (!pool.length) return null;
    return { kept: pool.filter(r => r.similarity >= threshold).length, total: pool.length };
  }, [searchType, searchTarget, gender, derivedApparel, derivedProps, topColors, bottomColors, shoesColors, emotion, ethnicGroup, searchDateRange, threshold, siteCameras]);

  const searchState: SearchFilterState = {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender,
    apparel: derivedApparel, toggleApparel: () => {}, props: derivedProps, toggleProps: () => {},
    topColors, toggleTopColor, bottomColors, toggleBottomColor, shoesColors, toggleShoesColor,
    dateRange: searchDateRange, setDateRange: setSearchDateRange, licensePlate, setLicensePlate,
    camera: searchCamera, setCamera: setSearchCamera,
    activeTarget, clearActiveTarget, thresholdCost,
    reset: searchReset,
  };

  const searchResults = searchType === "PERSON" && searchTarget
    ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20, siteCameras)
        .filter(r => r.similarity >= threshold)
    : filterReidData({ searchType, gender, apparel: derivedApparel, props: derivedProps, dateRange: searchDateRange, threshold, licensePlate, camera: searchCamera, topColors, bottomColors, shoesColors, emotion, ethnicGroup, siteCameras });
  const searchResultDetailItem = searchDetailId !== null ? searchResults.find(p => p.id===searchDetailId) ?? null : null;



  useEffect(() => {
    const interval = setInterval(() => {
      // This tile-churn simulation is LOCAL to this tab (`feed` state below) on purpose — it's a
      // decorative "camera wall keeps scrolling" effect, not real VIP/Tracking activity, so it
      // must never touch the shared vcaStore. It used to also call addEvent({cameraId, type,
      // severity, timestamp}) with no personName/location — vcaStore.addEvent's early-return path
      // for exactly that shape prepends it as a bare, unclassified entry and caps `events` at 500
      // total. With every online camera (~50-60) re-firing every 4s, that flooded and evicted the
      // shared 500-slot history in under a minute — silently wiping out the Sidebar/Dashboard's
      // real VIP/Tracking rows any time this tab happened to be mounted. The ONE real event
      // producer is VipAlertTicker in ClientLayout.tsx, which calls addEvent with full person
      // fields — a future live video/detection feed for this specific tab should replace `feed`
      // wholesale, not feed into that same classification pipeline.
      //
      // Only a random subset of online cameras refreshes each tick (instead of all of them every
      // 4s) — every camera's "newest" card changing in the same instant read as the whole wall
      // updating in lockstep rather than a live feed where different cameras detect faces at
      // different times. A ~1s tick over ~1/4 of cameras keeps each one's own average refresh
      // cadence close to the old 4s, just staggered instead of synchronized.
      // Run state through the seam — see lib/realtime/cameraStatus.ts.
      const onlineCams = getCameraStatus().running;
      if (onlineCams.length === 0) return;
      const batchSize = Math.max(1, Math.round(onlineCams.length / 4));
      const batch = [...onlineCams].sort(() => Math.random() - 0.5).slice(0, batchSize);
      const newItems = batch.map(cam => ({ cam, item: makeLiveItem(seedRef.current++, cam.code, 0) }));

      setFeed(prev => {
        const next = { ...prev };
        newItems.forEach(({ cam, item }) => {
          next[cam.code] = [item, ...(prev[cam.code] ?? [])].slice(0, 300);
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const allItems = Object.values(feed).flat();
  const detailItem = detailId !== null ? allItems.find(p => p.id===detailId) ?? null : null;
  const onlineCameraCodes = useCameraStatus().running.map(c => c.code);
  const camDetailItems = openCam === ALL_CAMERAS_ID
    ? onlineCameraCodes.flatMap(code => feed[code] ?? [])
    : feed[openCam] ?? [];

  return (
    <div style={{ flex:1, display:"flex", gap:"12px", overflow:"hidden", padding:"20px 24px 12px", backgroundColor:"var(--gray-100)", boxSizing:"border-box" }}>
      <SlidingSearchPanel
        expanded={searchExpanded}
        onExpand={() => setSearchExpanded(true)}
        sidebar={
          <LiveSearchSidebar
            state={searchState}
            tab={searchTab} onTabChange={setSearchTab}
            hatFilter={hatFilter} onHatChange={setHatFilter}
            sleeveFilter={sleeveFilter} onSleeveChange={setSleeveFilter}
            bottomsFilter={bottomsFilter} onBottomsChange={setBottomsFilter}
            backpackFilter={backpackFilter} onBackpackChange={setBackpackFilter}
            emotion={emotion} onEmotionChange={setEmotion}
            ethnicGroup={ethnicGroup} onEthnicGroupChange={setEthnicGroup}
            onSearch={() => setSearched(true)} onCollapse={() => setSearchExpanded(false)}
          />
        }
      />
      {/* Matches the search sidebar's own rounding — this wide section had none at all before,
          so it sat as a sharp-cornered block next to the sidebar's 12px-rounded card. */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", backgroundColor:"white", borderRadius:"12px" }}>
        {searched
          ? <SmartSearchResults state={searchState} results={searchResults} onCardClick={setSearchDetailId}
              onRefine={() => setSearched(false)} onReset={searchReset}
              topColors={topColors} bottomColors={bottomColors} shoesColors={shoesColors}
              emotion={emotion} ethnicGroup={ethnicGroup} />
          : <CameraDetailView camId={openCam} items={camDetailItems} onSwitchCam={onOpenCamChange} onCardClick={setDetailId} onNavigateTab={handleNavigate} onGoRedmap={onGoRedmap} onGoRedmapFrame={onGoRedmapFrame} />
        }
      </div>
      {detailItem && <DetailModal item={reidToMatchItem(detailItem)} onClose={() => setDetailId(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {searchResultDetailItem && <DetailModal item={reidToMatchItem(searchResultDetailItem)} onClose={() => setSearchDetailId(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </div>
  );
}

// ── Smart Search Tab ─────────────────────────────────────────────
const GENDER_CHIPS = ["Male","Female"];
const APPAREL_CHIPS = ["Trousers","Shorts","Skirts","Short Sleeve","Long Sleeve"];
const PROPS_CHIPS = ["Backpack/Bag","Hat","Wearing Glasses"];

function RefreshIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13.5 3.5v3.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Shared Date Range Picker ─────────────────────────────────────
type DateRangeValue = { start: Date | null; end: Date | null };

// The range bounds are Date objects at LOCAL midnight, while every stored date is a "YYYY-MM-DD"
// string that `new Date()` parses as UTC midnight. Comparing the two directly pushed the newest
// day out of its own range: east of UTC, today-as-UTC-midnight lands after today-as-local-midnight.
// Comparing the calendar days as strings has no timezone in it at all.
const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateWithinRange = (date: string, range: DateRangeValue) =>
  (!range.start || date >= dateKeyOf(range.start)) && (!range.end || date <= dateKeyOf(range.end));

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const numDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= numDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// "All time" used to resolve to {start:null, end:null} — identical to a date range nobody has
// touched yet. filterReidData() treats THAT untouched shape as "default to last 7 days" (so a
// Search click before the operator picks anything doesn't scan all-time by accident), which
// meant clicking "All time" silently got downgraded to last-7-days too — same silent-no-results
// bug for every REID_DATA date (they're fixed at 2026-07-27~08-10 and drift further outside any
// real "last 7 days" window every day this demo runs). A real, non-null sentinel range lets "All
// time" mean what it says while leaving the untouched/default-fallback case alone.
const ALL_TIME_START = new Date(2000, 0, 1);
const ALL_TIME_END = new Date(2100, 0, 1);
const QUICK_RANGES: { label: Record<AppLanguage, string>; range: () => DateRangeValue }[] = [
  { label: { en: "Today", ko: "오늘" }, range: () => { const t = new Date(); t.setHours(0,0,0,0); return { start: t, end: t }; } },
  { label: { en: "Last 7 days", ko: "최근 7일" }, range: () => { const t = new Date(); t.setHours(0,0,0,0); const s = new Date(t); s.setDate(s.getDate() - 6); return { start: s, end: t }; } },
  { label: { en: "This month", ko: "이번 달" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "Last 3 months", ko: "최근 3개월" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 3, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "Last 6 months", ko: "최근 6개월" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 6, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "This year", ko: "올해" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31) }; } },
  { label: { en: "All dates", ko: "전체 기간" }, range: () => ({ start: ALL_TIME_START, end: ALL_TIME_END }) },
];

const WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  en: ["Su","Mo","Tu","We","Th","Fr","Sa"],
  ko: ["일","월","화","수","목","금","토"],
};

function DateMonthCalendar({ year, month, tempStart, tempEnd, onPick, onPrev, onNext, showPrev, showNext }: {
  year: number; month: number; tempStart: Date|null; tempEnd: Date|null;
  onPick: (d: Date) => void; onPrev?: () => void; onNext?: () => void; showPrev: boolean; showNext: boolean;
}) {
  const [lang] = useLanguage();
  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "numeric" });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"224px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"24px" }}>
        <button onClick={onPrev} disabled={!showPrev} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showPrev ? "pointer" : "default", visibility: showPrev ? "visible" : "hidden", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{monthLabel}</span>
        <button onClick={onNext} disabled={!showNext} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showNext ? "pointer" : "default", visibility: showNext ? "visible" : "hidden", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center" }}>
        {WEEKDAY_LABELS[lang].map(w => <span key={w} style={{ fontSize:"10px", color:"var(--gray-400)", height:"24px", display:"flex", alignItems:"center" }}>{w}</span>)}
      </div>
      {/* Ring instead of a background swap for hover — a background would have to fight (and look
          different depending on) whichever state color is already showing (selected/in-range/
          plain), where an inset ring reads the same "you're pointing at this one" way regardless. */}
      <style>{`.vca-daterange-day:hover { box-shadow: inset 0 0 0 1.5px var(--gray-400); }`}</style>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center", rowGap:"2px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ width:"28px", height:"28px" }} />;
          const isStart = !!tempStart && isSameDay(d, tempStart);
          const isEnd = !!tempEnd && isSameDay(d, tempEnd);
          const inRange = !!tempStart && !!tempEnd && d > tempStart && d < tempEnd;
          const today = isSameDay(d, new Date());
          return (
            <button key={i} onClick={() => onPick(d)} className="vca-daterange-day" style={{
              width:"28px", height:"28px", borderRadius:"50%", border: today && !isStart && !isEnd ? "1px solid var(--primary-400)" : "none",
              backgroundColor: isStart || isEnd ? "var(--primary-400)" : inRange ? "var(--primary-100)" : "transparent",
              color: isStart || isEnd ? "white" : "var(--gray-900)",
              fontSize:"12px", fontWeight: isStart || isEnd ? 700 : 500, cursor:"pointer",
              boxSizing:"border-box",
            }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePopover({ anchorRef, value, onApply, onClose }: {
  anchorRef: React.RefObject<HTMLElement | null>; value: DateRangeValue;
  onApply: (v: DateRangeValue) => void; onClose: () => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const base = value.start ?? new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [tempStart, setTempStart] = useState<Date|null>(value.start);
  const [tempEnd, setTempEnd] = useState<Date|null>(value.end);
  const [pos, setPos] = useState<{ top:number; left:number } | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
  }, [anchorRef]);

  const pick = (d: Date) => {
    if (!tempStart || tempEnd) { setTempStart(d); setTempEnd(null); }
    else if (d < tempStart) { setTempStart(d); setTempEnd(null); }
    else { setTempEnd(d); }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  if (!pos) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:999 }} />
      <div style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:1000, backgroundColor:"white",
        border:BORDER, borderRadius:"12px", boxShadow:"0 8px 24px rgba(14,22,42,0.16)",
        padding:"12px", display:"flex", gap:"16px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"4px", width:"140px", borderRight:BORDER, paddingRight:"12px" }}>
          {/* Shared by every date filter in the app (Live Monitoring, Re-ID Analysis, RedFace) —
              this popover is the one place they all render QUICK_RANGES from, so a hover state
              added here shows up everywhere at once instead of needing to be repeated per screen. */}
          <style>{`.vca-daterange-preset:hover { background-color:var(--gray-100) !important; }`}</style>
          {QUICK_RANGES.map(q => (
            <button key={q.label.en} className="vca-daterange-preset" onClick={() => {
              const r = q.range();
              setTempStart(r.start); setTempEnd(r.end);
              if (r.start) { setViewYear(r.start.getFullYear()); setViewMonth(r.start.getMonth()); }
            }} style={{ textAlign:"left", padding:"8px", borderRadius:"8px", border:"none", backgroundColor:"transparent", cursor:"pointer",
              fontSize:"13px", color:"var(--gray-900)", fontWeight:600, transition:"background-color 0.15s" }}>
              {q.label[lang]}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ display:"flex", gap:"24px" }}>
            <DateMonthCalendar year={viewYear} month={viewMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              showPrev={true} showNext={false} onPrev={prevMonth} />
            <DateMonthCalendar year={secondYear} month={secondMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              showPrev={false} showNext={true} onNext={nextMonth} />
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"8px" }}>
            <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:"8px", border:BORDER,
              backgroundColor:"white", color:"var(--gray-900)", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>{t.cancel}</button>
            <button onClick={() => onApply({ start: tempStart, end: tempEnd })} style={{ padding:"8px 16px", borderRadius:"8px", border:"none",
              backgroundColor:"var(--primary-400)", color:"white", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>{t.apply}</button>
          </div>
        </div>
      </div>
    </>
  );
}

function DateRangeTrigger({ value, onApply, mode = "merged", size = "md", emptyText, showIcon = true }: {
  value: DateRangeValue; onApply: (v: DateRangeValue) => void; mode?: "split"|"merged"; size?: "md"|"sm"; emptyText?: string; showIcon?: boolean;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const compact = size === "sm";
  const isEmpty = !value.start && !value.end;
  // The "All time" preset resolves to a real (non-null) sentinel range now, not {null,null} — see
  // the comment on QUICK_RANGES — so it needs its own check here to still collapse to a plain
  // "All time" label instead of falling through to the raw "2000.01.01 – 2100.01.01" dates.
  const isAllTime = !!value.start && !!value.end
    && value.start.getTime() === ALL_TIME_START.getTime() && value.end.getTime() === ALL_TIME_END.getTime();

  // Same shape as CameraSelect (white fill, always-visible border, fixed height) so the two
  // sit as one consistent "filter control" language instead of two different-looking pickers
  // side by side in the same form.
  const boxStyle: React.CSSProperties = compact
    ? { flex:1, display:"flex", alignItems:"center", gap:"6px", height:"34px", padding:"0 8px", border: open ? "1px solid var(--primary-300)" : BORDER, borderRadius:"6px", backgroundColor:"white", cursor:"pointer" }
    : { flex:1, display:"flex", alignItems:"center", gap:"8px", height:"36px", padding:"0 12px", border: open ? "1px solid var(--primary-300)" : BORDER, borderRadius:"8px", backgroundColor:"white", cursor:"pointer" };
  const textStyle = (has: boolean): React.CSSProperties => ({
    fontSize: compact ? "12px" : "13px", fontWeight:600, color: has ? "var(--primary-400)" : "var(--gray-400)",
  });
  // The collapsed emptyText state ("Last 7 days") is a REAL default already in effect on the
  // search, not an unfilled placeholder like "Start date" — so it shouldn't read in the same
  // muted placeholder gray as an actually-empty field. Dark, same as any other active value.
  const emptyTextStyle: React.CSSProperties = { fontSize: compact ? "12px" : "13px", fontWeight:600, color:"var(--gray-900)" };

  const startLabel = value.start ? fmtDate(value.start) : t.startDate;
  const endLabel = value.end ? fmtDate(value.end) : t.endDate;
  const toggle = () => setOpen(o => !o);

  return (
    <div ref={ref} style={{ position:"relative", display:"flex", gap:"8px", width:"100%" }}>
      {(isEmpty && emptyText) || isAllTime ? (
        // Collapses to one box regardless of split/merged — always show the chevron here, since
        // without it this reads as a plain label instead of something clickable.
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            {showIcon && <CalendarIconSm size={compact ? 12 : 14} />}
            <span style={emptyTextStyle}>{isAllTime ? t.allDates : emptyText}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--gray-600)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      ) : mode === "split" ? (
        <>
          <div onClick={toggle} style={boxStyle}>{showIcon && <CalendarIconSm size={compact ? 12 : 14} />}<span style={textStyle(!!value.start)}>{startLabel}</span></div>
          <div onClick={toggle} style={boxStyle}>{showIcon && <CalendarIconSm size={compact ? 12 : 14} />}<span style={textStyle(!!value.end)}>{endLabel}</span></div>
        </>
      ) : (
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            {showIcon && <CalendarIconSm size={compact ? 12 : 14} />}
            <span style={textStyle(!!value.start)}>{startLabel}</span>
            <span style={{ color:"var(--gray-400)", fontSize: compact ? "10px" : "13px" }}>–</span>
            <span style={textStyle(!!value.end)}>{endLabel}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--gray-600)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {open && <DateRangePopover anchorRef={ref} value={value} onApply={(v) => { onApply(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function VipQuickSelectRow({ activeVIP, onSelect, compact = false }: { activeVIP:number; onSelect:(i:number)=>void; compact?:boolean }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const avatarSize = compact ? 28 : 24;
  const fontSize = compact ? "11px" : "12px";
  // Search + sort so this stays usable once VIP_QUICK grows well past what fits on screen at
  // once — "registration" order is just VIP_QUICK's own original array order (the order each VIP
  // was added), so no extra data field is needed to support it.
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"reg" | "abc">("reg");

  // Two different shapes on purpose: in the Live Monitoring/Re-ID sidebar (not compact) this list
  // IS the whole tab's content, so it's a fixed 3-column grid — chips stretch to fill the row
  // (natural-width flex-wrap chips left a ragged, mostly-empty-looking 2-per-row layout with the
  // sidebar's spare width unused) and the sidebar's own vertical scroll carries the rest. In
  // RedFace's target picker (compact) it's one of many stacked fields in a fixed-height modal, so
  // it keeps its original single-row horizontal scroll instead.
  if (compact) {
    // The picked chip is pulled to the front. This row scrolls horizontally in a fixed-width
    // modal, so a selection made in the middle of the list scrolls out of sight the moment the
    // panel narrows or the list is scrolled back — and then nothing on screen says which VIP is
    // loaded. Leading with it means the answer is always at the row's start. Original indices
    // ride along because onSelect and activeVIP are index-based.
    // A-Z, then the picked chip lifted out of that order to the front. VIP_QUICK's own order is
    // registration order, which tells you nothing when you are hunting for a name — the sidebar
    // version of this list offers both orders behind a toggle, but this row has no room for one
    // and scanning for a name is the only thing it is used for.
    const compactOrder = VIP_QUICK.map((v, i) => ({ v, i }))
      .sort((a, b) => a.v.name.localeCompare(b.v.name));
    const activeAt = compactOrder.findIndex(o => o.i === activeVIP);
    if (activeAt > 0) compactOrder.unshift(...compactOrder.splice(activeAt, 1));
    return (
      <div className="vca-thin-scrollbar" style={{ display:"flex", flexWrap:"nowrap", gap:"8px", width:"100%", overflowX:"auto", paddingBottom:"6px" }}>
        {compactOrder.map(({ v, i }) => {
          const active = activeVIP === i;
          return (
            <button key={v.name} onClick={() => onSelect(i)} title={v.name} style={{
              display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px 4px 4px", borderRadius:"999px",
              backgroundColor: active ? "var(--primary-100)" : "white",
              border: active ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)", cursor:"pointer", flexShrink:0,
            }}>
              <img src={v.face} alt="" style={{ width:avatarSize, height:avatarSize, borderRadius:"50%", objectFit:"cover" }} />
              <span style={{ fontSize, fontWeight:600, color:"var(--gray-900)", whiteSpace:"nowrap" }}>{v.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const indexed = VIP_QUICK.map((v, i) => ({ v, i }))
    .filter(({ v }) => v.name.toLowerCase().includes(query.toLowerCase()));
  if (sortMode === "abc") indexed.sort((a, b) => a.v.name.localeCompare(b.v.name));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:"6px", height:"30px", padding:"0 8px", borderRadius:"6px", border:BORDER, backgroundColor:"white" }}>
          <SearchIconSm />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchVips}
            style={{ flex:1, border:"none", outline:"none", background:"none", fontSize:"12px", fontWeight:500, color:"var(--gray-900)", minWidth:0 }}
          />
          {/* Picking a VIP doesn't clear this on its own — without a quick way to blank it out,
              searching for someone else means selecting the old query and retyping over it. */}
          {query && (
            <button onClick={() => setQuery("")} aria-label={t.clearSearch} style={{
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              width:"16px", height:"16px", borderRadius:"999px", border:"none", backgroundColor:"var(--gray-300)", cursor:"pointer", padding:0,
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div style={{ display:"flex", gap:"2px", backgroundColor:"var(--gray-100)", borderRadius:"999px", padding:"2px", flexShrink:0 }}>
          {([["reg", t.sortRegistered], ["abc", t.sortAbc]] as const).map(([id, label]) => {
            const active = sortMode === id;
            return (
              <button key={id} onClick={() => setSortMode(id)} style={{
                padding:"4px 8px", borderRadius:"999px", border:"none", cursor:"pointer",
                backgroundColor: active ? "white" : "transparent",
                color: active ? "var(--gray-900)" : "var(--gray-400)", fontWeight: active ? 700 : 600, fontSize:"10px",
                boxShadow: active ? "0 1px 3px rgba(14,22,42,0.12)" : "none",
              }}>{label}</button>
            );
          })}
        </div>
      </div>
      {indexed.length === 0 ? (
        <div style={{ padding:"16px 0", textAlign:"center", color:"var(--gray-400)", fontSize:"12px" }}>{T[lang].noVipMatch(query)}</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:"8px", width:"100%" }}>
          {indexed.map(({ v, i }) => {
            const active = activeVIP === i;
            return (
              <button key={v.name} onClick={() => onSelect(i)} title={v.name} style={{
                display:"flex", alignItems:"center", gap:"6px", padding:"5px 8px", borderRadius:"999px",
                backgroundColor: active ? "var(--primary-100)" : "white", minWidth:0, boxSizing:"border-box",
                border: active ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)", cursor:"pointer",
              }}>
                <img src={v.face} alt="" style={{ width:avatarSize, height:avatarSize, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                <span style={{ fontSize, fontWeight:600, color:"var(--gray-900)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0 }}>{v.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shared by Top/Bottom color filters — Shoes uses its own smaller palette below, since footwear
// in the mock data only ever comes in a handful of colors.
const APPAREL_COLORS: { id:string; hex:string }[] = [
  { id:"black",  hex:"#0f172a" },
  { id:"blue",   hex:"#2563eb" },
  { id:"green",  hex:"#16a34a" },
  { id:"gray",   hex:"#94a3b8" },
  { id:"orange", hex:"#f97316" },
  { id:"purple", hex:"#7c3aed" },
  { id:"red",    hex:"#ef4444" },
  { id:"white",  hex:"#ffffff" },
  { id:"gold",   hex:"#eab308" },
  { id:"pink",   hex:"#ec4899" },
  { id:"maroon", hex:"#7f1d1d" },
  { id:"tan",    hex:"#d4b896" },
  { id:"olive",  hex:"#78716c" },
  { id:"sage",   hex:"#6b7c93" },
];
const SHOE_COLORS: { id:string; hex:string }[] = [
  { id:"white",     hex:"#ffffff" },
  { id:"lightgray", hex:"#e2e8f0" },
  { id:"black",     hex:"#0f172a" },
  { id:"gray",      hex:"#94a3b8" },
];
/**
 * Whether a swatch needs its own outline to stay visible against the filter panel behind it.
 *
 * The test is CONTRAST AGAINST THE PANEL, at 3:1 — the threshold WCAG sets for a non-text
 * interface component, which is what a colour swatch is. Not "is this colour light": a first
 * pass here used perceived lightness and caught only white and light grey, while tan (1.89:1),
 * gold (1.92:1), grey (2.56:1) and orange (2.80:1) stayed outline-less on a white panel. Six of
 * the eighteen swatches fail, not two.
 *
 * The list this replaces held design-token strings ("var(--gray-0)") while the swatches carry
 * real hex, so it never matched anything at all and no swatch was ever outlined.
 *
 * The swatch hexes stay raw on purpose: they are DATA, not theme. A white shirt is white whatever
 * the palette does, and tokenising them would let a design change repaint the clothing an
 * operator is searching for.
 */
const SWATCH_PANEL_LUMINANCE = 1; // white — every panel these sit on is --gray-0
function isLightSwatch(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  // sRGB relative luminance, per WCAG — not a channel average. The gamma curve is why gold and
  // orange read as far lighter than their raw numbers suggest.
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const contrast = (SWATCH_PANEL_LUMINANCE + 0.05) / (lum + 0.05);
  return contrast < 3;
}

function ColorSwatch({ hex, active, onClick, size = 22 }: { hex:string; active:boolean; onClick:()=>void; size?:number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        width:size, height:size, borderRadius:"50%", flexShrink:0, cursor:"pointer", padding:0,
        backgroundColor:hex, border:"none",
        boxShadow: active
          ? "0 0 0 2px white, 0 0 0 4px var(--primary-400)"
          : isLightSwatch(hex) ? "inset 0 0 0 1px var(--gray-300)" : "none",
      }}
    />
  );
}

// Quick presets (60/70/80/90) for the common thresholds, plus a slider underneath for anything
// in between — the presets used to be the only way in, which meant landing on e.g. 65% wasn't
// possible at all, not just less convenient.
// Resets the browser's native range-input chrome (Chrome/Safari/Firefox each draw their own
// track/thumb border by default, which read as an unwanted outline around the control) down to a
// flat gray track + solid purple thumb, matching the rest of the app's controls.
function SimilaritySliderStyleTag() {
  return (
    <style>{`
      .vca-similarity-slider { -webkit-appearance:none; appearance:none; background:transparent; outline:none; border:none; }
      .vca-similarity-slider::-webkit-slider-runnable-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
      .vca-similarity-slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; margin-top:-5px; cursor:pointer; }
      .vca-similarity-slider::-moz-range-track { height:4px; border-radius:999px; background:var(--gray-200); border:none; }
      .vca-similarity-slider::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:var(--primary-400); border:none; cursor:pointer; }
    `}</style>
  );
}
/**
 * The threshold, and what the current setting costs.
 *
 * This control decides which matches an operator ever sees, and moving it used to tell you
 * nothing until after the search — you turned the dial with your eyes shut and found out
 * afterwards, by which time the number you had before was gone.
 *
 * `cost` is resolved by the owner, because only the owner knows what the current query's
 * candidate pool is; null means there is no query to count against. Same wording and the same
 * amber-only-at-zero rule as Redmap's slider (see RedmapPage's thresholdCost) — the same control
 * explaining its cost two different ways on two screens would be worse than not explaining it.
 */
function SimilarityControl({ value, onChange, height = 36, cost }: { value:number; onChange:(v:number)=>void; height?:number; cost?: { kept:number; total:number } | null }) {
  const [lang] = useLanguage();
  const t = T[lang];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      <SimilaritySliderStyleTag />
      <div style={{ display:"flex", gap:"2px", backgroundColor:"var(--gray-100)", borderRadius:"999px", padding:"2px", height }}>
        {[60,70,80,90].map(v => {
          const active = value === v;
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex:1, borderRadius:"999px", border:"none", cursor:"pointer",
              backgroundColor: active ? "white" : "transparent",
              color: active ? "var(--primary-400)" : "var(--gray-400)", fontWeight: active ? 700 : 600, fontSize:"12px",
            }}>{v}%</button>
          );
        })}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <input
          className="vca-similarity-slider"
          type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex:1, cursor:"pointer" }}
        />
        <span style={{ fontSize:"12px", fontWeight:700, color:"var(--primary-400)", width:"32px", textAlign:"right", flexShrink:0 }}>{value}%</span>
      </div>
      {cost && (
        // Its own line: this column has the room the toolbar's slider did not, so the cost sits
        // under the control it belongs to instead of squeezing beside the number.
        <span style={{
          fontSize:"11px", fontWeight:600, marginTop:"-6px",
          // Amber only when the setting leaves nothing. Colouring every reduction would paint the
          // normal case as a problem — dropping weak candidates is this control's job.
          color: cost.kept === 0 ? "var(--warning-500)" : "var(--gray-500)",
        }}>
          {cost.kept === 0 ? t.thresholdCostNone(cost.total) : t.thresholdCost(cost.kept, cost.total)}
        </span>
      )}
    </div>
  );
}

function AttrChip({ label, active, onClick, size = "md" }: { label:string; active:boolean; onClick:()=>void; size?:"md"|"sm" }) {
  const compact = size === "sm";
  return (
    <button onClick={onClick} style={{
      padding: compact ? "5px 12px" : "6px 16px", borderRadius:"100px", cursor:"pointer",
      fontSize: compact ? "12px" : "13px", whiteSpace:"nowrap",
      fontWeight: active ? 700 : 600,
      color: active ? "var(--primary-400)" : "var(--gray-700)",
      backgroundColor: active ? "var(--primary-100)" : "white",
      border: active ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)",
    }}>{label}</button>
  );
}

// One shape for "this is a criterion currently shaping the results below" — whether that's a
// picked target (photo + remove) or a plain attribute chip. Two different-looking chips for the
// same kind of information (what's actually driving these results) read as two different things.
function FilterChip({ children, icon, avatar, onRemove }: { children:React.ReactNode; icon?:React.ReactNode; avatar?:string; onRemove?:()=>void }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", padding: avatar ? "4px 8px 4px 4px" : "6px 16px", borderRadius:"100px",
      backgroundColor:"var(--primary-100)", border:"1px solid var(--primary-400)", fontSize:"12px", fontWeight:700, color:"var(--primary-400)", whiteSpace:"nowrap", flexShrink:0 }}>
      {avatar && <img src={avatar} alt="" style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover" }} />}
      {icon}{children}
      {onRemove && (
        <button onClick={onRemove} style={{ background:"none", border:"none", cursor:"pointer", padding:"2px", display:"flex", color:"var(--primary-400)" }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      )}
    </div>
  );
}

// Shared by Re-ID Analysis, Smart Search, and RedFace's picker — lets a search start from
// "who/what was captured on this specific camera" instead of only attribute/image matching.

function SearchResultCard({ p, onClick, matchReasons = [] }: { p: (typeof REID_DATA)[number]; onClick: () => void; matchReasons?: string[] }) {
  const [lang] = useLanguage();
  const status = REID_STATUS_STYLE[p.status];
  return (
    <div onClick={onClick} style={{
      position:"relative", width:"100%", height:"259px",
      borderRadius:"8px", overflow:"hidden", backgroundColor:"var(--gray-900)", cursor:"pointer",
      transform:"translateZ(0)",
    }}>
      <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", left:0, right:0, bottom:"64px", height:"80px",
        background:"linear-gradient(to top, rgba(14,22,42,0.72), rgba(14,22,42,0))", pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:8, left:8, fontSize:"10px", fontWeight:800, color:"white",
        backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 8px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
        {p.cam}
      </div>
      {/* Similarity is a property of the match itself (how well this result answers the search),
          not of the identity label next to it — a precise-looking % right beside "Unknown" read as
          if there were some specific certainty about an unidentified person. Off the status line,
          onto the photo, matching the badge ClusterMatchCard/CandidateCard already use for this
          same number. */}
      <div style={{ position:"absolute", top:8, right:8, fontSize:"10px", fontWeight:800, color:"white",
        backgroundColor:"rgba(14,22,42,0.7)", padding:"4px 8px", borderRadius:"12px", letterSpacing:"-0.2px" }}>
        {p.similarity}%
      </div>
      {/* Same REDFACE badge Live Monitoring's MonitorCard uses — a search shouldn't quietly hide
          that one of its hits is already flagged. */}
      {p.status === "RedFace" && (
        <div style={{ position:"absolute", bottom:"60px", left:8, fontSize:"10px", fontWeight:800, color:"white",
          backgroundColor:"var(--danger-400)", padding:"1px 5px", borderRadius:"2px", letterSpacing:"0.3px" }}>
          REDFACE
        </div>
      )}
      <div style={{ position:"absolute", left:"-1px", right:"-1px", bottom:"-2px", height:"66px", backgroundColor:"white",
        padding:"10px 11px 7px", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:"2px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"6px" }}>
          {p.plate
            ? <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-900)", fontFamily:"monospace", letterSpacing:"-0.24px" }}>{p.plate}</span>
            : <span style={{ fontSize:"12px", fontWeight:800, color:status.text, letterSpacing:"-0.24px" }}>{attr(p.status, lang)}</span>}
          {matchReasons.length > 0 && (
            <span title={T[lang].matchedOn(matchReasons.map(r => attr(r, lang)).join(", "))} style={{ fontSize:"10px", fontWeight:800, color:"var(--success-400)", cursor:"help" }}>
              ✓{matchReasons.length}
            </span>
          )}
        </div>
        <span style={{ fontSize:"10px", color:"var(--gray-400)", fontFamily:"monospace" }}>{cardTimestamp(p.date, p.time)}</span>
      </div>
      {/* Crop of the same big photo (p.url), not p.face — that field cycles through an unrelated
          stock-photo pool, which would show a different person's face here than the body photo
          filling the rest of the card. objectPosition "top" favors the head/shoulders area. */}
      {!p.plate && <img src={p.url} alt="" style={{ position:"absolute", right:"10px", bottom:"38px", width:"56px", height:"56px",
        borderRadius:"8px", boxShadow:"0 0 0 2px white", transform:"translateZ(0)",
        objectFit:"cover", objectPosition:"top", display:"block", backgroundColor:"white" }} />}
    </div>
  );
}

function SmartSearchResults({ state, results, onCardClick, onRefine, onReset, topColors, bottomColors, shoesColors, emotion, ethnicGroup }:
  { state: SearchFilterState; results:(typeof REID_DATA); onCardClick:(id:number)=>void; onRefine:()=>void; onReset:()=>void;
    topColors: string[]; bottomColors: string[]; shoesColors: string[]; emotion: string; ethnicGroup: string }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const { searchType, threshold, gender, apparel, props, dateRange, licensePlate, camera, activeTarget, clearActiveTarget } = state;
  // Captured once when results first land, not read live on every render — otherwise "as of"
  // would silently keep advancing on any unrelated re-render, making the Refresh button's job
  // (bump this to "now") indistinguishable from doing nothing.
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  // A named target (VIP Quick Select / Recent Targets) shouldn't disappear once you're looking at
  // results — otherwise there's no way to tell "who am I even looking for" without going back to
  // the form. Reuse the same toggle-off logic the picker rows use, so clearing it here is
  // identical to clicking it again in the form.
  const target = activeTarget;
  const clearTarget = clearActiveTarget;
  // What each card in the grid actually satisfied to be included — filterReidData() already hard-
  // filters on these, so every result matches all of them; surfacing that here turns the bare
  // similarity % into "matched because of X, Y, Z" instead of an unexplained number. None of this
  // applies once a target is picked, though: those results come from buildTargetResultRows (the
  // target re-appearing), which never looks at gender/apparel/props/camera/date at all — showing
  // them as if they're "active filters" on results they don't actually filter is exactly the kind
  // of disconnect between the filter bar and the results that shouldn't happen.
  const matchReasons = target ? [] : [
    ...(gender ? [gender] : []),
    ...(apparel.length ? [apparel.join("/")] : []),
    ...(props.length ? [props.join("/")] : []),
    ...(camera ? [camera] : []),
  ];
  const activeChips = target
    ? [searchType === "PERSON" ? t.person : t.tabVehicle, t.similarityAtLeast(threshold)]
    : [
        searchType === "PERSON" ? t.person : t.tabVehicle,
        ...(dateRange.start || dateRange.end
          ? [`${dateRange.start ? fmtDate(dateRange.start) : "…"} ~ ${dateRange.end ? fmtDate(dateRange.end) : "…"}`]
          : [t.last7days]),
        ...(camera ? [camera] : []),
        ...(searchType === "VEHICLE"
          ? (licensePlate ? [licensePlate] : [])
          : [
              ...(gender ? [gender] : []), ...apparel, ...props,
              ...[...topColors, ...bottomColors, ...shoesColors].map(c => c[0].toUpperCase() + c.slice(1)),
              ...(emotion ? [emotion] : []), ...(ethnicGroup ? [ethnicGroup] : []),
            ]),
      ];

  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
    <div ref={scrollRef} className="vca-hide-scrollbar" style={{ position:"absolute", inset:0, overflowY:"auto", backgroundColor:"var(--gray-50)" }}>
      <div style={{ padding:"16px 24px", backgroundColor:"white", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div className="vca-hide-scrollbar" style={{ display:"flex", alignItems:"center", gap:"8px", overflowX:"auto" }}>
          {target && (
            <FilterChip avatar={target.face} onRemove={clearTarget}>
              {t.similarTo} {target.label}
            </FilterChip>
          )}
          {activeChips.map((c, i) => <FilterChip key={i}>{c}</FilterChip>)}
          <button onClick={onReset} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer",
            fontSize:"13px", fontWeight:600, color:"var(--gray-600)", flexShrink:0, padding:"0 4px" }}>
            <ResetIconSm /> {t.resetFilters}
          </button>
        </div>
        <button onClick={onRefine} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer",
          fontSize:"13px", fontWeight:700, color:"var(--gray-900)", flexShrink:0 }}>
          <SlidersIconSm size={14} /> {t.refineSearch}
        </button>
      </div>

      <div style={{ padding:"16px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <span style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)" }}>{t.searchResults}</span>
            <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-500)" }}>{t.matchesFound(results.length)}</span>
            <div style={{ width:"1px", height:"12px", backgroundColor:"var(--gray-200)" }} />
            <span style={{ fontSize:"13px", color:"var(--gray-400)" }}>{t.aboveSimilarity(threshold)}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <span style={{ fontSize:"12px", color:"var(--gray-400)" }}>{t.resultsAsOf(refreshedAt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour12:false }))}</span>
            <button onClick={() => setRefreshedAt(new Date())} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, color:"var(--gray-600)" }}>
              <RefreshIconSm /> {t.refresh}
            </button>
          </div>
        </div>
        {results.length === 0 ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"64px 0", color:"var(--gray-400)", fontSize:"13px", fontWeight:600 }}>
            {t.noMatches}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(133px, 1fr))", gap:"16px", paddingBottom:"24px" }}>
            {results.map(p => <SearchResultCard key={p.id} p={p} onClick={() => onCardClick(p.id)} matchReasons={matchReasons} />)}
          </div>
        )}
      </div>
    </div>
    <ScrollToTopButton containerRef={scrollRef} />
    </div>
  );
}

interface SearchFilterState {
  searchType: "PERSON"|"VEHICLE"; setSearchType:(v:"PERSON"|"VEHICLE")=>void;
  // selectedTarget/activeVIP are read-only here (for active-state styling) — selection always
  // goes through selectRecentTarget/selectVIP so the gender/apparel/props cascade and the
  // mutual-exclusivity between the two pickers stay consistent everywhere they're used.
  selectedTarget: number; selectRecentTarget:(i:number)=>void;
  activeVIP: number; selectVIP:(i:number)=>void;
  threshold: number; setThreshold:(v:number)=>void;
  gender: string; setGender:(v:string)=>void;
  apparel: string[]; toggleApparel:(v:string)=>void;
  props: string[]; toggleProps:(v:string)=>void;
  topColors: string[]; toggleTopColor:(v:string)=>void;
  bottomColors: string[]; toggleBottomColor:(v:string)=>void;
  shoesColors: string[]; toggleShoesColor:(v:string)=>void;
  dateRange: DateRangeValue; setDateRange:(v:DateRangeValue)=>void;
  licensePlate: string; setLicensePlate:(v:string)=>void;
  camera: string; setCamera:(v:string)=>void;
  /**
   * The person the results are actually about, however they were picked.
   *
   * Resolved by the owner, because only the owner knows about the third way in: a camera card's
   * own Search button (cardSearchTarget). The results panel used to re-derive this from
   * selectedTarget/activeVIP alone, so on that third path it saw no target and drew the whole
   * attribute filter bar — date, colours, emotion — as the reasons those results matched, while
   * the rows came from buildTargetResultRows, which reads none of them.
   */
  activeTarget: { face: string; label: string } | null;
  clearActiveTarget: () => void;
  /**
   * What the current threshold keeps, out of the current query's candidate pool. Null when there
   * is no query to count against — see SimilarityControl. Resolved by the owner for the same
   * reason activeTarget is: only the owner knows which dataset this query draws from.
   */
  thresholdCost: { kept: number; total: number } | null;
  reset: () => void;
}

// ── Re-ID Analysis Tab ─────────────────────────────────────────
const REID_STATUS_STYLE: Record<ReIDStatus, { text: string; border: string; glow?: string }> = {
  VIP:     { text:"var(--primary-400)", border:"var(--primary-400)" },
  Unknown: { text:"var(--gray-500)", border:"var(--gray-500)" },
  RedFace: { text:"var(--danger-400)", border:"var(--danger-400)", glow:"0 0 0 2px var(--danger-400), 0 0 10px rgba(244, 63, 94,0.38)" },
};

const REID_STATUS_CYCLE: ReIDStatus[] = [
  "VIP","Unknown","Unknown","Unknown","VIP","Unknown","Unknown","VIP",
  "Unknown","Unknown","RedFace","Unknown","VIP","Unknown","Unknown","Unknown","VIP","RedFace",
];
const REID_GENDER_CYCLE  = ["F","M","F","F","M","F","M","F","F","M","M","F","F","M","F","M","F","M"];
const REID_AGE_CYCLE     = ["28yo","28yo","28yo","35yo","28yo","42yo","28yo","28yo","31yo","28yo","35yo","28yo","28yo","29yo","28yo","37yo","28yo","33yo"];
const REID_SCORE_CYCLE   = [null,null,87.8,null,null,null,87.8,null,null,null,null,87.8,null,null,null,null,87.8,null];


/**
 * The codes of the cameras registered at the site on screen — what every search on this page is
 * allowed to return, and what its camera picker lists.
 *
 * Read live from the store, so a camera the Portal adds or renames shows up here. Memoized
 * because the array is a useMemo dependency below and a fresh array on every render would re-run
 * every search that depends on it.
 */
function useSiteCameraCodes(): string[] {
  const cameras = useProjectCameras();
  return useMemo(() => cameras.map(c => c.code), [cameras]);
}
const REID_FACE_POOL     = MATCH_DATA.map(m => m.face);
// Attribute/date/similarity fields backing the Re-ID / Smart Search filter forms — added so
// Gender/Apparel/Props/Search Period/Similarity actually narrow the result set instead of the
// filters being purely cosmetic. Fixed cycles (not Math.random/Date.now) to stay deterministic
// across server render and client hydration.
const REID_APPAREL_CYCLE = APPAREL_CHIPS;
const REID_PROP_CYCLE: (string | null)[] = [null, "Backpack/Bag", null, "Hat", null, "Wearing Glasses", null, "Backpack/Bag"];
const REID_DATE_CYCLE = [
  "2026-07-27", "2026-07-29", "2026-07-31", "2026-08-02", "2026-08-04",
  "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10",
];
const REID_SIMILARITY_CYCLE = Array.from({ length: 24 }, (_, i) => 62 + ((i * 11) % 38)); // 62–99
// Backs the Top/Bottom/Shoes color swatches in the Filter tab and RedFace's target picker — those
// swatches used to toggle "active" with nothing behind them; filterReidData() never received the
// selection, and REID_DATA had nothing to check it against even if it had. Bottom reuses the same
// palette as top but rotated, so the two don't always land on the same color for a given person.
const REID_TOP_COLOR_CYCLE = APPAREL_COLORS.map(c => c.id);
const REID_BOTTOM_COLOR_CYCLE = [...REID_TOP_COLOR_CYCLE.slice(6), ...REID_TOP_COLOR_CYCLE.slice(0, 6)];
const REID_SHOES_COLOR_CYCLE = SHOE_COLORS.map(c => c.id);
// Same story as the colors above — Emotion/Ethnic group used to be plain inputs with nothing on
// REID_DATA to check them against (see the "no backing field" comment that used to sit on their
// state in LiveMonitoringTab/ReIDContent). Ethnic group is rotated by one relative to
// ETHNIC_GROUP_OPTIONS so it doesn't always land in lockstep with shoesColor (both cycle length 4).
const REID_EMOTION_CYCLE = EMOTION_OPTIONS;
const REID_ETHNIC_GROUP_CYCLE = [...ETHNIC_GROUP_OPTIONS.slice(1), ...ETHNIC_GROUP_OPTIONS.slice(0, 1)];

export const REID_DATA = PERSONS.map((p, i) => ({
  ...p,
  status:      REID_STATUS_CYCLE[i % REID_STATUS_CYCLE.length] as ReIDStatus,
  gender:      REID_GENDER_CYCLE[i % REID_GENDER_CYCLE.length],
  age:         REID_AGE_CYCLE[i % REID_AGE_CYCLE.length],
  score:       REID_SCORE_CYCLE[i % REID_SCORE_CYCLE.length],
  // Cycled over the whole register, which spans every site — each site then gets the rows its
  // own cameras captured through the siteCameras filter below. This used to be a private
  // REID_CAM_CYCLE of "NC-1".."NC-4", a code space that existed nowhere else in the app: the
  // camera picker beside the grid lists the register's real codes, so picking any camera
  // compared "NC-2" against a real code and returned nothing at all, every time.
  cam:         CAMERA_CODES[i % CAMERA_CODES.length],
  face:        REID_FACE_POOL[i % REID_FACE_POOL.length],
  apparel:     REID_APPAREL_CYCLE[i % REID_APPAREL_CYCLE.length],
  prop:        REID_PROP_CYCLE[i % REID_PROP_CYCLE.length],
  date:        REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
  similarity:  REID_SIMILARITY_CYCLE[i % REID_SIMILARITY_CYCLE.length],
  topColor:    REID_TOP_COLOR_CYCLE[i % REID_TOP_COLOR_CYCLE.length],
  bottomColor: REID_BOTTOM_COLOR_CYCLE[i % REID_BOTTOM_COLOR_CYCLE.length],
  shoesColor:  REID_SHOES_COLOR_CYCLE[i % REID_SHOES_COLOR_CYCLE.length],
  emotion:     REID_EMOTION_CYCLE[i % REID_EMOTION_CYCLE.length],
  ethnicGroup: REID_ETHNIC_GROUP_CYCLE[i % REID_ETHNIC_GROUP_CYCLE.length],
  plate:       null as string | null,
}));

// ── Vehicle search dataset (Figma node 182:14807 — VEHICLE mode filter is License plate only,
// no gender/apparel/props) ──────────────────────────────────────────────────────────────────
// No real vehicle photography in this mock app — a simple tinted car glyph stands in for a
// photo (deterministic per plate, not a fabricated stock photo pretending to be real footage).
const VEHICLE_COLOR_CYCLE = ["#475469", "#5a3dfb", "#0e162a", "#94a3b8", "#1d4ed8", "#b91c1c"];
function carSvgDataUri(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>`
    + `<rect width='200' height='200' fill='${color}'/>`
    + `<g transform='translate(30,70)' fill='white' fill-opacity='0.9'>`
    + `<path d='M8 40 L20 10 Q26 0 40 0 H100 Q114 0 120 10 L132 40 H140 Q146 40 146 46 V60 Q146 66 140 66 H8 Q2 66 2 60 V46 Q2 40 8 40 Z'/>`
    + `<circle cx='30' cy='66' r='12' fill='${color}'/><circle cx='118' cy='66' r='12' fill='${color}'/>`
    + `</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const VEHICLE_PLATES = [
  "SGA 1234 X", "SBC 5821 K", "SJT 9042 M", "SKL 3317 P", "SMN 7605 T",
  "SGX 2298 B", "SHV 6110 Q", "SFY 4483 W", "SDP 8827 R", "SLQ 1956 H",
  "SGA 3390 Z", "SBC 7712 N", "SJT 4488 J", "SKL 9931 E", "SMN 2264 Y",
];
export const VEHICLE_DATA = VEHICLE_PLATES.map((plate, i) => {
  const color = VEHICLE_COLOR_CYCLE[i % VEHICLE_COLOR_CYCLE.length];
  const img = carSvgDataUri(color);
  return {
    id: 900000 + i,
    url: img, face: img,
    time: TIMES_P[i % TIMES_P.length],
    badge: null as number | null,
    status: "Unknown" as ReIDStatus,
    gender: "", age: "",
    score: null as number | null,
    cam: CAMERA_CODES[i % CAMERA_CODES.length],
    apparel: "", prop: null as string | null,
    date: REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
    similarity: REID_SIMILARITY_CYCLE[i % REID_SIMILARITY_CYCLE.length],
    topColor: "", bottomColor: "", shoesColor: "", emotion: "", ethnicGroup: "",
    plate: plate as string | null,
  };
});

// Shared by Re-ID Analysis and Smart Search — applies every filter the two forms expose
// (type/gender/apparel/props/date range/similarity threshold) against the same dataset, so
// "Search" actually narrows results instead of always returning the same fixed slice.
function filterReidData(f: {
  searchType: "PERSON" | "VEHICLE"; gender: string; apparel: string[]; props: string[];
  dateRange: DateRangeValue; threshold: number; licensePlate?: string; camera?: string;
  topColors?: string[]; bottomColors?: string[]; shoesColors?: string[];
  emotion?: string; ethnicGroup?: string;
  /**
   * The camera codes of the site on screen. Rows captured anywhere else are not results here.
   *
   * The header switches sites and the camera picker above the grid lists only that site's
   * cameras — but the grid was reading the whole mock, so switching site changed the picker and
   * nothing else. Left undefined the search is unscoped, which is what the seeded module-level
   * datasets below want.
   */
  siteCameras?: string[];
}): typeof REID_DATA {
  // An untouched date range isn't "any time ever" — it defaults to the last 7 days, same as the
  // trigger's "Last 7 days" placeholder implies.
  let { start, end } = f.dateRange;
  if (!start && !end) {
    end = new Date();
    start = new Date(end);
    start.setDate(start.getDate() - 7);
  }
  const inDateRange = (date: string) => dateWithinRange(date, { start, end });

  if (f.searchType === "VEHICLE") {
    const plateQuery = (f.licensePlate ?? "").trim().toLowerCase().replace(/\s+/g, "");
    return VEHICLE_DATA
      .filter(v => !plateQuery || (v.plate ?? "").toLowerCase().replace(/\s+/g, "").includes(plateQuery))
      .filter(v => !f.siteCameras || f.siteCameras.includes(v.cam))
      .filter(v => !f.camera || v.cam === f.camera)
      .filter(v => v.similarity >= f.threshold)
      .filter(v => inDateRange(v.date))
      .sort((a, b) => b.similarity - a.similarity);
  }

  // RedFace hits used to be dropped from every attribute search entirely — surfacing them (with
  // the same REDFACE badge Live Monitoring/SearchResultCard already use) is exactly the point:
  // if a search happens to turn up someone already flagged, that's worth knowing, not hiding.
  const genderAbbrev = f.gender === "Male" ? "M" : f.gender === "Female" ? "F" : null;
  return REID_DATA
    .filter(p => !genderAbbrev || p.gender === genderAbbrev)
    .filter(p => f.apparel.length === 0 || f.apparel.includes(p.apparel))
    .filter(p => f.props.length === 0 || (p.prop !== null && f.props.includes(p.prop)))
    .filter(p => !f.siteCameras || f.siteCameras.includes(p.cam))
    .filter(p => !f.camera || p.cam === f.camera)
    .filter(p => p.similarity >= f.threshold)
    .filter(p => inDateRange(p.date))
    .filter(p => !f.topColors?.length || f.topColors.includes(p.topColor))
    .filter(p => !f.bottomColors?.length || f.bottomColors.includes(p.bottomColor))
    .filter(p => !f.shoesColors?.length || f.shoesColors.includes(p.shoesColor))
    .filter(p => !f.emotion || p.emotion === f.emotion)
    .filter(p => !f.ethnicGroup || p.ethnicGroup === f.ethnicGroup)
    .sort((a, b) => b.similarity - a.similarity);
}

interface ReidCluster {
  id: string;
  thumbnail: string;
  title: string;
  /**
   * The person this cluster is about, in REID_DATA's shape. The RedFace button needs an actual
   * person to hand over: without it that button only switched tabs, so RedFace opened its target
   * picker and asked you to find — by hand — the person whose row you had just clicked.
   */
  subject: (typeof REID_DATA)[number];
  meta: { label: string; value: string }[];
  action: string;
  matches: MatchItem[];
  /** VIP identity (real name, from VIP_QUICK) vs. an Unknown sighting (arbitrary target label) —
   * see generateNewRecognition() below. Drives the crown badge next to the title. */
  isVip?: boolean;
}

// Unsplash serves images through imgix, so appending its query params re-renders the same
// source photo with a slightly different blur/exposure/saturation per tile — enough that a
// declining similarity score (97%, 96%, ... not literally the same file at every rank) reads as
// "same person, progressively worse camera conditions" instead of a pixel-identical repeat.
const MATCH_VARIATION_EXPOSURE = [0, -6, 5, -4, 7, -3, 4, -7, 3, -5, 6, -2];
function withMatchVariation(url: string, i: number): string {
  const blur = 1 + Math.min(i, 7);
  const sat = -(2 + Math.min(i * 2, 22));
  const exp = MATCH_VARIATION_EXPOSURE[i % MATCH_VARIATION_EXPOSURE.length];
  return `${url}&blur=${blur}&sat=${sat}&exp=${exp}`;
}

// A Re-ID match list should show ONE identity re-appearing across cameras, not a mix of
// different-looking people who merely share a gender. The mock photo pool has no multi-angle
// shots of a single real identity, so each synthesized appearance reuses the target's own photo
// across different cameras/times — the same convention the derived Tracking trail already uses
// for one person crossing multiple cameras.
function buildSuspectMatches(person: (typeof REID_DATA)[number], count: number, cams: string[] = CAMERA_CODES): MatchItem[] {
  const base = reidToMatchItem(person);
  // A person cannot have been captured by a camera that isn't installed at the site being looked
  // at, so the appearances are spread over that site's cameras — and a site with no cameras
  // registered has no appearances to show rather than fabricated ones.
  if (cams.length === 0) return [];
  // Spans 97% down to ~32% across the whole batch (not a fixed 0.8/step, which used to compress
  // every match into a narrow 82-97% band regardless of `count`) — a "Min Similarity: 30%" filter
  // elsewhere in the app only means something if results actually exist down near that floor.
  const step = count > 1 ? 65 / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    ...base,
    id: person.id * 1000 + i,
    face: withMatchVariation(base.face, i),
    body: withMatchVariation(base.body, i),
    cam: cams[i % cams.length],
    time: TIMES_P[i % TIMES_P.length],
    similarity: Math.round((97 - i * step) * 10) / 10,
  }));
}

// Same idea as buildSuspectMatches, but for a live search target (VIP Quick Select / Recent
// Targets) whose face/body photos come from a different pool than REID_DATA, so it can't reuse a
// REID_DATA row directly. Returns REID_DATA-shaped rows (not MatchItem[]) so every search surface
// — Smart Search's grid, Re-ID Analysis's cluster (via reidToMatchItem), RedFace's candidate list
// — can reuse the same generator instead of each hitting filterReidData() with the target's
// cascaded gender/apparel/props and risking zero real hits: REID_DATA's attribute cycles are
// independent of what a named target's profile actually is, so a specific gender+apparel+props+
// date combination can easily have no real overlap at all — the target is a person we already
// have a photo of, not a filter that might come up empty.
function buildTargetResultRows(face: string, body: string, genderAbbrev: "M" | "F", count: number, cams: string[] = CAMERA_CODES): typeof REID_DATA {
  // Same rule as buildSuspectMatches: the site's own cameras, and nothing at all from a site with
  // none registered.
  if (cams.length === 0) return [];
  // Same reasoning as buildSuspectMatches: span 97% down to ~32% across the batch instead of a
  // fixed 0.8/step that compressed every result into a narrow 82-97% band no matter how low a
  // "Min Similarity" threshold was actually set to.
  const step = count > 1 ? 65 / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    id: 700000 + i,
    url: withMatchVariation(body, i),
    face: withMatchVariation(face, i),
    time: TIMES_P[i % TIMES_P.length],
    badge: null as number | null,
    status: "Unknown" as ReIDStatus,
    cam: cams[i % cams.length],
    similarity: Math.round((97 - i * step) * 10) / 10,
    gender: genderAbbrev,
    age: "--",
    score: null as number | null,
    apparel: "",
    prop: null as string | null,
    date: REID_DATE_CYCLE[i % REID_DATE_CYCLE.length],
    topColor: REID_TOP_COLOR_CYCLE[i % REID_TOP_COLOR_CYCLE.length],
    bottomColor: REID_BOTTOM_COLOR_CYCLE[i % REID_BOTTOM_COLOR_CYCLE.length],
    shoesColor: REID_SHOES_COLOR_CYCLE[i % REID_SHOES_COLOR_CYCLE.length],
    emotion: REID_EMOTION_CYCLE[i % REID_EMOTION_CYCLE.length],
    ethnicGroup: REID_ETHNIC_GROUP_CYCLE[i % REID_ETHNIC_GROUP_CYCLE.length],
    plate: null as string | null,
  }));
}

const SUSPECT_1 = REID_DATA[0]; // gender F, matches REID_GENDER_CYCLE[0]
const SUSPECT_2 = REID_DATA[1]; // gender M, matches REID_GENDER_CYCLE[1]

/**
 * The two clusters the Re-ID landing view starts with, built for one site.
 *
 * A function rather than a module constant because every match in them names a camera: built once
 * at module load they named cameras from whichever site happened to come first in the register,
 * and switching site in the header left them on screen unchanged.
 */
function buildSeedClusters(cams: string[]): ReidCluster[] {
  // A site with no cameras registered has nothing to have recognized anyone with. Returning the
  // two shells anyway put a card on screen with another site's face as its thumbnail, hardcoded
  // metadata and zero sightings — and its RedFace button handed that person on as a target.
  if (cams.length === 0) return [];
  return [
  {
    id: "c1",
    thumbnail: SUSPECT_1.url,
    subject: SUSPECT_1,
    title: "TS017323",
    meta: [
      { label:"Gender", value:"F" },
      { label:"Age", value:"20s" },
      { label:"Apparel", value:"Skirts" },
      { label:"Props", value:"None" },
    ],
    action: "RedFace",
    matches: buildSuspectMatches(SUSPECT_1, 20, cams),
  },
  {
    id: "c2",
    thumbnail: SUSPECT_2.url,
    subject: SUSPECT_2,
    title: "TS015942",
    meta: [
      { label:"Gender", value:"M" },
      { label:"Age", value:"30s" },
      { label:"Apparel", value:"Short Sleeve" },
      { label:"Props", value:"Backpack/Bag" },
    ],
    action: "RedFace",
    matches: buildSuspectMatches(SUSPECT_2, 20, cams),
  },
  ];
}

function MetaField({ label, value }: { label:string; value:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
      <span style={{ fontSize:"12px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"-0.24px" }}>{label}:</span>
      <span style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-600)", letterSpacing:"-0.24px" }}>{value}</span>
    </div>
  );
}
function MetaDivider() {
  return <div style={{ width:"1px", height:"8px", backgroundColor:"var(--gray-200)", flexShrink:0 }} />;
}

function ClusterMatchCard({ item, onClick }: { item: MatchItem; onClick?: () => void }) {
  const badgeColor = item.similarity >= 85 ? "var(--gray-700)" : item.similarity >= 80 ? "var(--warning-400)" : "var(--gray-500)";
  return (
    <div onClick={onClick} style={{ backgroundColor:"white", borderRadius:"8px", overflow:"hidden", width:"133px", flexShrink:0, display:"flex", flexDirection:"column", gap:"8px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ position:"relative", height:"160px", overflow:"hidden" }}>
        <img src={item.body} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        <span style={{ position:"absolute", top:6, left:6, backgroundColor:badgeColor, color:"white", fontSize:"10px", fontWeight:600, padding:"2px 6px", borderRadius:"4px", letterSpacing:"-0.2px" }}>{item.similarity}%</span>
      </div>
      <div style={{ padding:"0 8px 8px", display:"flex", flexDirection:"column", gap:"2px" }}>
        <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-900)", letterSpacing:"-0.2px", fontFamily: item.plate ? "monospace" : undefined }}>
          {item.plate ?? item.cam}
        </span>
        <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", letterSpacing:"-0.2px" }}>{cardTimestamp(item.date, item.time)}</span>
      </div>
    </div>
  );
}

function ClusterCard({ cluster, onNavigateTab, onMatchClick }: { cluster: ReidCluster; onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number], label?: string) => void; onMatchClick?: (id: number) => void }) {
  return (
    <div style={{ backgroundColor:"white", borderRadius:"12px", padding:"12px 24px", display:"flex", flexDirection:"column", gap:"16px", width:"100%", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"16px", minWidth:0 }}>
          <img src={cluster.thumbnail} alt="" style={{ width:"48px", height:"48px", borderRadius:"8px", objectFit:"cover", flexShrink:0 }} />
          <div style={{ display:"flex", flexDirection:"column", gap:"4px", minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px", whiteSpace:"nowrap" }}>{cluster.title}</span>
              {cluster.isVip && (
                <span style={{ fontSize:"10px", fontWeight:800, color:"var(--primary-400)", backgroundColor:"var(--primary-100)", padding:"2px 7px", borderRadius:"999px", letterSpacing:"-0.2px" }}>VIP</span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
              {cluster.meta.map((m, i) => (
                <React.Fragment key={m.label}>
                  <MetaField label={m.label} value={m.value} />
                  {i < cluster.meta.length - 1 && <MetaDivider />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => onNavigateTab?.(cluster.action as DataTab, cluster.subject, cluster.title)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"8px",
          backgroundColor:"var(--gray-100)", border:"none", cursor:"pointer", flexShrink:0 }}>
          <RedFaceIconSm />
          <span style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-600)", letterSpacing:"-0.26px", whiteSpace:"nowrap" }}>{cluster.action}</span>
        </button>
      </div>
      <div className="vca-hide-scrollbar" style={{ display:"flex", gap:"12px", overflowX:"auto" }}>
        {cluster.matches.map(m => <ClusterMatchCard key={m.id} item={m} onClick={() => onMatchClick?.(m.id)} />)}
      </div>
    </div>
  );
}

export const VIP_QUICK = [
  { name:"Mina", face: MATCH_DATA[0].face, body: MATCH_DATA[0].body, gender:"Female" },
  { name:"Joon", face: MATCH_DATA[1].face, body: MATCH_DATA[1].body, gender:"Male" },
  { name:"Taeho", face: MATCH_DATA[3].face, body: MATCH_DATA[3].body, gender:"Male" },
  { name:"Yuna", face: MATCH_DATA[2].face, body: MATCH_DATA[2].body, gender:"Female" },
  { name:"Minho", face: MATCH_DATA[4].face, body: MATCH_DATA[4].body, gender:"Male" },
  { name:"Seoyeon", face: MATCH_DATA[5].face, body: MATCH_DATA[5].body, gender:"Female" },
  { name:"Jihoon", face: MATCH_DATA[6].face, body: MATCH_DATA[6].body, gender:"Male" },
  { name:"Areum", face: MATCH_DATA[7].face, body: MATCH_DATA[7].body, gender:"Female" },
  { name:"Doyoon", face: MATCH_DATA[0].face, body: MATCH_DATA[0].body, gender:"Male" },
  { name:"Haeun", face: MATCH_DATA[1].face, body: MATCH_DATA[1].body, gender:"Female" },
  { name:"Junseo", face: MATCH_DATA[2].face, body: MATCH_DATA[2].body, gender:"Male" },
  { name:"Somin", face: MATCH_DATA[3].face, body: MATCH_DATA[3].body, gender:"Female" },
  { name:"Yejun", face: MATCH_DATA[4].face, body: MATCH_DATA[4].body, gender:"Male" },
  { name:"Chaewon", face: MATCH_DATA[5].face, body: MATCH_DATA[5].body, gender:"Female" },
  { name:"Hyunwoo", face: MATCH_DATA[6].face, body: MATCH_DATA[6].body, gender:"Male" },
];

// The Re-ID Analysis landing view used to be two permanently-fixed example clusters — this
// simulates Live Monitoring actually recognizing someone: most sightings (~70%) are an unnamed
// passerby (an arbitrary target label, since there's no real identity behind them), the rest are
// one of VIP_QUICK's registered VIPs. A VIP who's *already* in the visible list gets this new
// sighting ADDED to their existing cluster (so "everywhere they've been captured" actually grows)
// and bumped to the top, instead of splitting into a second, disconnected cluster for the same
// person.
function randomTargetName(): string {
  return `Target #${Math.floor(1000 + Math.random() * 9000)}`;
}
function generateNewRecognition(existingClusters: ReidCluster[], cams: string[] = CAMERA_CODES): ReidCluster[] {
  // Nothing is recognized at a site with no cameras registered.
  if (cams.length === 0) return existingClusters;
  const now = new Date();
  const date = formatCapturedDate(now);
  const time = formatCapturedTime(now);
  const cam = cams[Math.floor(Math.random() * cams.length)];
  const similarity = Math.round((80 + Math.random() * 18) * 10) / 10;
  const matchId = Date.now() + Math.floor(Math.random() * 1000);

  if (Math.random() < 0.3) {
    const vip = VIP_QUICK[Math.floor(Math.random() * VIP_QUICK.length)];
    const genderAbbrev = vip.gender === "Male" ? "M" : "F";
    const newMatch: MatchItem = { id:matchId, face:vip.face, body:vip.body, cam, date, time, similarity, gender:genderAbbrev, age:"--", plate:null, status:"VIP" };
    const existing = existingClusters.find(c => c.id === `vip-${vip.name}`);
    if (existing) {
      const bumped: ReidCluster = { ...existing, matches: [newMatch, ...existing.matches] };
      return [bumped, ...existingClusters.filter(c => c.id !== existing.id)];
    }
    // A brand-new cluster starts with a full re-id history (20 past appearances), not just this
    // one fresh hit — a single photo doesn't read as "this identity has been re-identified
    // across cameras," which is the whole point of a Re-ID cluster (same generator Recent
    // Targets/VIP Quick Select search results already use for exactly this).
    const historyRows = buildTargetResultRows(vip.face, vip.body, genderAbbrev, 20, cams);
    const fresh: ReidCluster = {
      id: `vip-${vip.name}`, thumbnail: vip.face, title: vip.name,
      // status forced to VIP: the generator marks its rows Unknown, but this cluster IS a
      // registered VIP and RedFace reads the status to label the primary target.
      subject: { ...historyRows[0], status: "VIP" as ReIDStatus },
      meta: [{ label:"Gender", value:genderAbbrev }],
      action: "RedFace", matches: [newMatch, ...historyRows.map(reidToMatchItem)], isVip: true,
    };
    return [fresh, ...existingClusters];
  }

  const genderAbbrev = Math.random() < 0.5 ? "M" : "F";
  const age = `${20 + Math.floor(Math.random() * 4) * 10}s`;
  const photo = MATCH_DATA[Math.floor(Math.random() * MATCH_DATA.length)];
  const newMatch: MatchItem = { id:matchId, face:photo.face, body:photo.body, cam, date, time, similarity, gender:genderAbbrev, age, plate:null, status:"Unknown" };
  const historyRows = buildTargetResultRows(photo.face, photo.body, genderAbbrev, 20, cams);
  const fresh: ReidCluster = {
    id: `unk-${matchId}`, thumbnail: photo.face, title: randomTargetName(),
    subject: historyRows[0],
    meta: [{ label:"Gender", value:genderAbbrev }, { label:"Age", value:age }],
    action: "RedFace", matches: [newMatch, ...historyRows.map(reidToMatchItem)], isVip: false,
  };
  return [fresh, ...existingClusters];
}
const LIVE_RECOGNITION_FEED_CAP = 8;

// gender/apparel/props here are what picking this target cascades onto the rest of the filter
// form — a recent target isn't just a photo, it's "search for someone matching this profile".
export const RECENT_TARGETS_EN = [
  { face: RECENT_TARGETS[0].face, body: RECENT_TARGETS[0].body, label:"Target #1024", time:"today 12:50", gender:"Female", apparel:"Skirts", props: [] as string[] },
  { face: RECENT_TARGETS[1].face, body: RECENT_TARGETS[1].body, label:"Target #254",  time:"today 13:21", gender:"Male", apparel:"Trousers", props: ["Backpack/Bag"] },
  { face: RECENT_TARGETS[2].face, body: RECENT_TARGETS[2].body, label:"Target #092",  time:"yesterday 18:30", gender:"Female", apparel:"Long Sleeve", props: ["Hat"] },
  { face: RECENT_TARGETS[3].face, body: RECENT_TARGETS[3].body, label:"Target #417",  time:"yesterday 09:12", gender:"Male", apparel:"Short Sleeve", props: ["Backpack/Bag"] },
];

function PersonIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 13.5C3 11.015 5.239 9 8 9C10.761 9 13 11.015 13 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function VehicleIconSm({ size = 16 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M12.6672 11.3327H14.0007C14.4007 11.3327 14.6674 11.066 14.6674 10.666V8.66585C14.6674 8.0658 14.2007 7.53242 13.6673 7.39908C12.4672 7.06572 10.6671 6.66569 10.6671 6.66569C10.6671 6.66569 9.80035 5.73228 9.2003 5.13223C8.86694 4.86554 8.46691 4.66553 8.00021 4.66553H3.33317C2.93314 4.66553 2.59978 4.93222 2.39976 5.26558L1.46635 7.19906C1.37806 7.45657 1.33301 7.72691 1.33301 7.99913V10.666C1.33301 11.066 1.5997 11.3327 1.99973 11.3327H3.33317" stroke="currentColor" strokeLinecap="round"/>
      <path d="M4.66634 12.6667C5.40272 12.6667 5.99967 12.0697 5.99967 11.3333C5.99967 10.597 5.40272 10 4.66634 10C3.92996 10 3.33301 10.597 3.33301 11.3333C3.33301 12.0697 3.92996 12.6667 4.66634 12.6667Z" stroke="currentColor" strokeLinecap="round"/>
      <path d="M6 11.334H10" stroke="currentColor" strokeLinecap="round"/>
      <path d="M11.3333 12.6667C12.0697 12.6667 12.6667 12.0697 12.6667 11.3333C12.6667 10.597 12.0697 10 11.3333 10C10.597 10 10 10.597 10 11.3333C10 12.0697 10.597 12.6667 11.3333 12.6667Z" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
}
function HistoryIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6C1.5 6.89002 1.76392 7.76005 2.25839 8.50007C2.75285 9.24009 3.45566 9.81686 4.27792 10.1575C5.10019 10.4981 6.00499 10.5872 6.87791 10.4135C7.75082 10.2399 8.55264 9.81132 9.18198 9.18198C9.81132 8.55264 10.2399 7.75082 10.4135 6.87791C10.5872 6.00499 10.4981 5.10019 10.1575 4.27792C9.81686 3.45566 9.24009 2.75285 8.50007 2.25839C7.76005 1.76392 6.89002 1.5 6 1.5C4.74198 1.50473 3.53448 1.99561 2.63 2.87L1.5 4M4 4H1.5V1.5M6 3.5V6L8 7" stroke="currentColor" strokeLinecap="round"/>
    </svg>
  );
}
function ImageIconSm({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}
function StarIconSm({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M5.78072 1.63235C5.80231 1.59316 5.83401 1.56047 5.87253 1.5377C5.91105 1.51494 5.95498 1.50293 5.99972 1.50293C6.04447 1.50293 6.0884 1.51494 6.12692 1.5377C6.16544 1.56047 6.19714 1.59316 6.21872 1.63235L7.69472 4.43435C7.72992 4.49923 7.77905 4.55552 7.83858 4.59916C7.89811 4.64281 7.96656 4.67273 8.03902 4.68678C8.11149 4.70083 8.18616 4.69867 8.25769 4.68044C8.32922 4.66221 8.39583 4.62837 8.45272 4.58135L10.5912 2.74935C10.6323 2.71596 10.6829 2.69646 10.7357 2.69365C10.7885 2.69084 10.8409 2.70487 10.8853 2.73373C10.9296 2.76258 10.9637 2.80476 10.9826 2.8542C11.0014 2.90364 11.0041 2.95779 10.9902 3.00885L9.57322 8.13185C9.5443 8.23669 9.48199 8.32923 9.39573 8.39546C9.30947 8.46169 9.20397 8.49799 9.09522 8.49885H2.90472C2.79589 8.49809 2.69028 8.46184 2.60392 8.39561C2.51756 8.32937 2.45517 8.23677 2.42622 8.13185L1.00972 3.00935C0.995849 2.95829 0.998535 2.90414 1.01739 2.8547C1.03625 2.80526 1.07032 2.76308 1.11467 2.73423C1.15903 2.70537 1.2114 2.69134 1.26424 2.69415C1.31708 2.69696 1.36767 2.71646 1.40872 2.74985L3.54672 4.58185C3.60362 4.62887 3.67023 4.66271 3.74176 4.68094C3.81328 4.69917 3.88796 4.70134 3.96042 4.68728C4.03289 4.67323 4.10134 4.64331 4.16087 4.59966C4.2204 4.55602 4.26953 4.49973 4.30472 4.43485L5.78072 1.63235Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10.5H9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
// Color/size match DefaultFaceIconSm/FullBodyIconSm (the "Search by image" icons directly above
// this in RedFace's target picker) so the filter icons below read as the same icon language —
// size defaults to that same var(--gray-400) muted tone; callers pass a bigger size where they sit near
// those larger icons.
function CalendarIconSm({ size = 14, color = "var(--gray-400)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="21 14 14 14" fill="none">
      <path d="M31.2 14.5107C31.2495 14.5109 31.2897 14.5511 31.2898 14.6006V15.5771H33.3328C33.9713 15.5771 34.4888 16.0949 34.489 16.7334V26.333C34.489 26.9717 33.9715 27.4893 33.3328 27.4893H22.6667C22.0281 27.4891 21.5105 26.9716 21.5105 26.333V16.7334C21.5107 16.095 22.0283 15.5773 22.6667 15.5771H24.7107V14.6006C24.7107 14.551 24.7509 14.5107 24.8005 14.5107C24.85 14.5109 24.8903 14.5511 24.8904 14.6006V15.5771H31.1101V14.6006C31.1102 14.551 31.1503 14.5107 31.2 14.5107ZM21.6902 26.333C21.6902 26.8722 22.1275 27.3094 22.6667 27.3096H33.3328C33.8721 27.3096 34.3093 26.8723 34.3093 26.333V18.957H21.6902V26.333ZM23.7332 25.1768C23.7828 25.1768 23.824 25.217 23.824 25.2666C23.8239 25.3162 23.7828 25.3564 23.7332 25.3564C23.6837 25.3562 23.6434 25.3161 23.6433 25.2666C23.6433 25.2171 23.6837 25.177 23.7332 25.1768ZM25.8669 25.1768C25.9165 25.1769 25.9568 25.217 25.9568 25.2666C25.9567 25.3162 25.9165 25.3564 25.8669 25.3564C25.8173 25.3564 25.7771 25.3162 25.7771 25.2666C25.7771 25.217 25.8173 25.1768 25.8669 25.1768ZM27.9998 25.1768C28.0494 25.1768 28.0896 25.217 28.0896 25.2666C28.0896 25.3162 28.0494 25.3564 27.9998 25.3564C27.9502 25.3563 27.91 25.3162 27.9099 25.2666C27.9099 25.217 27.9502 25.1769 27.9998 25.1768ZM30.1335 25.1768C30.183 25.177 30.2234 25.2171 30.2234 25.2666C30.2233 25.3161 30.183 25.3562 30.1335 25.3564C30.0839 25.3564 30.0428 25.3162 30.0427 25.2666C30.0427 25.217 30.0839 25.1768 30.1335 25.1768ZM23.7332 23.043C23.7828 23.043 23.824 23.0841 23.824 23.1338C23.8237 23.1833 23.7827 23.2236 23.7332 23.2236C23.6838 23.2234 23.6435 23.1831 23.6433 23.1338C23.6433 23.0843 23.6837 23.0432 23.7332 23.043ZM25.8669 23.043C25.9165 23.0431 25.9568 23.0842 25.9568 23.1338C25.9566 23.1832 25.9164 23.2235 25.8669 23.2236C25.8174 23.2236 25.7773 23.1833 25.7771 23.1338C25.7771 23.0841 25.8173 23.043 25.8669 23.043ZM27.9998 23.043C28.0494 23.043 28.0896 23.0841 28.0896 23.1338C28.0894 23.1833 28.0493 23.2236 27.9998 23.2236C27.9503 23.2235 27.9101 23.1832 27.9099 23.1338C27.9099 23.0842 27.9502 23.0431 27.9998 23.043ZM30.1335 23.043C30.183 23.0432 30.2234 23.0843 30.2234 23.1338C30.2232 23.1831 30.1829 23.2234 30.1335 23.2236C30.084 23.2236 30.043 23.1833 30.0427 23.1338C30.0427 23.0841 30.0839 23.043 30.1335 23.043ZM32.2664 23.043C32.316 23.043 32.3562 23.0842 32.3562 23.1338C32.356 23.1832 32.3158 23.2236 32.2664 23.2236C32.2169 23.2236 32.1768 23.1832 32.1765 23.1338C32.1765 23.0841 32.2167 23.043 32.2664 23.043ZM27.9998 20.9102C28.0494 20.9102 28.0895 20.9504 28.0896 21C28.0896 21.0497 28.0494 21.0898 27.9998 21.0898C27.9502 21.0897 27.9099 21.0496 27.9099 21C27.91 20.9505 27.9502 20.9103 27.9998 20.9102ZM30.1335 20.9102C30.183 20.9104 30.2233 20.9506 30.2234 21C30.2234 21.0495 30.183 21.0896 30.1335 21.0898C30.0839 21.0898 30.0427 21.0497 30.0427 21C30.0428 20.9504 30.0839 20.9102 30.1335 20.9102ZM32.2664 20.9102C32.3159 20.9102 32.3561 20.9505 32.3562 21C32.3562 21.0496 32.316 21.0898 32.2664 21.0898C32.2167 21.0898 32.1765 21.0496 32.1765 21C32.1766 20.9504 32.2168 20.9102 32.2664 20.9102ZM22.6667 15.7568C22.1276 15.757 21.6904 16.1943 21.6902 16.7334V18.7773H34.3093V16.7334C34.3091 16.1942 33.8719 15.7568 33.3328 15.7568H31.2898V16.7334C31.2898 16.783 31.2495 16.8241 31.2 16.8242C31.1503 16.8242 31.1101 16.783 31.1101 16.7334V15.7568H24.8904V16.7334C24.8904 16.783 24.85 16.824 24.8005 16.8242C24.7509 16.8242 24.7107 16.7831 24.7107 16.7334V15.7568H22.6667Z" fill={color} stroke={color} strokeWidth="0.8867"/>
    </svg>
  );
}
// Figma node 182:14807 ("Container" — vehicle-mode search bar) — exact vector data.
function LicensePlateIconSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 5.33333L12.6667 6.66667L11.6667 4.2C11.5724 3.94756 11.4038 3.72962 11.1831 3.5749C10.9625 3.42019 10.7001 3.33597 10.4307 3.33333H5.6C5.32834 3.32709 5.06125 3.40401 4.83451 3.55378C4.60778 3.70355 4.43221 3.91902 4.33133 4.17133L3.33333 6.66667L2 5.33333" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.66667 9.33333H4.67333" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3333 9.33333H11.34" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 6.66667H3.33333C2.59695 6.66667 2 7.26362 2 8V10.6667C2 11.403 2.59695 12 3.33333 12H12.6667C13.403 12 14 11.403 14 10.6667V8C14 7.26362 13.403 6.66667 12.6667 6.66667Z" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 12V13.3333" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6667 12V13.3333" stroke="var(--gray-500)" strokeLinecap="round" strokeLinejoin="round"/>
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
function DefaultFaceIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M19.3125 11.5C19.3125 7.46055 16.0395 4.1875 12 4.1875C7.96055 4.1875 4.6875 7.46055 4.6875 11.5C4.6875 15.5395 7.96055 18.8125 12 18.8125C16.0395 18.8125 19.3125 15.5395 19.3125 11.5ZM3 11.5C3 6.52891 7.02891 2.5 12 2.5C16.9711 2.5 21 6.52891 21 11.5C21 16.4711 16.9711 20.5 12 20.5C7.02891 20.5 3 16.4711 3 11.5ZM9.2332 13.7289C9.76055 14.2773 10.6781 14.875 12 14.875C13.3219 14.875 14.2395 14.2773 14.7668 13.7289C15.0902 13.3914 15.6246 13.3809 15.9586 13.7043C16.2926 14.0277 16.3066 14.5621 15.9832 14.8961C15.2062 15.7047 13.8738 16.5625 12 16.5625C10.1262 16.5625 8.79375 15.7047 8.0168 14.8961C7.69336 14.5586 7.70391 14.0242 8.04141 13.7043C8.37891 13.3844 8.91328 13.3914 9.2332 13.7289ZM8.0625 9.8125C8.0625 9.19023 8.56523 8.6875 9.1875 8.6875C9.80977 8.6875 10.3125 9.19023 10.3125 9.8125C10.3125 10.4348 9.80977 10.9375 9.1875 10.9375C8.56523 10.9375 8.0625 10.4348 8.0625 9.8125ZM14.8125 8.6875C15.4348 8.6875 15.9375 9.19023 15.9375 9.8125C15.9375 10.4348 15.4348 10.9375 14.8125 10.9375C14.1902 10.9375 13.6875 10.4348 13.6875 9.8125C13.6875 9.19023 14.1902 8.6875 14.8125 8.6875Z" fill="var(--gray-400)"/>
    </svg>
  );
}
function FullBodyIconSm() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14.4001 4.80039C14.4001 3.47664 13.3239 2.40039 12.0001 2.40039C10.6764 2.40039 9.60014 3.47664 9.60014 4.80039C9.60014 6.12414 10.6764 7.20039 12.0001 7.20039C13.3239 7.20039 14.4001 6.12414 14.4001 4.80039ZM10.5339 8.74914C9.64514 8.43414 8.86514 7.83789 8.32889 7.03164L7.59764 5.93289C7.23014 5.38164 6.48764 5.23539 5.93639 5.60289C5.38514 5.97039 5.23514 6.71289 5.60264 7.26789L6.33389 8.36289C7.01264 9.37914 7.93889 10.1779 9.00014 10.7029V20.4004C9.00014 21.0641 9.53639 21.6004 10.2001 21.6004C10.8639 21.6004 11.4001 21.0641 11.4001 20.4004V16.8004H12.6001V20.4004C12.6001 21.0641 13.1364 21.6004 13.8001 21.6004C14.4639 21.6004 15.0001 21.0641 15.0001 20.4004V10.7104C16.0914 10.1779 17.0401 9.35289 17.7264 8.30289L18.4089 7.25664C18.7689 6.70164 18.6114 5.95914 18.0564 5.59539C17.5014 5.23164 16.7589 5.38914 16.3951 5.94789L15.7126 6.99039C14.8951 8.24289 13.5039 9.00039 12.0076 9.00039C11.5351 9.00039 11.0739 8.92539 10.6351 8.78289C10.6014 8.77164 10.5676 8.75664 10.5339 8.74914Z" fill="white" stroke="var(--gray-400)"/>
    </svg>
  );
}

// Shared "empty" look for a Search-by-image slot — one flavor, reused by Smart Search, Re-ID
// Analysis, and RedFace's target picker (which previously each drew their own differently-sized,
// differently-colored dropzone). previewSrc is a decorative low-opacity watermark for panels that
// only preview a selected target's photo (no real upload); RedFace's own picker keeps its bespoke
// full-opacity uploaded-photo state since only it has actual file-upload wiring.
// Only rendered (and only has any effect) when the box is actually clickable — a box with no
// onClick stays plain/decorative rather than inviting a click that does nothing.
function ImageDropzoneHoverStyleTag() {
  // !important is required here — the box's border/background come from an inline `style`
  // (needed since they're computed per-instance), and inline styles always beat a plain
  // stylesheet selector, hover or not.
  return (
    <style>{`
      .vca-image-dropzone-clickable { cursor:pointer; transition:border-color 0.15s, background-color 0.15s; }
      .vca-image-dropzone-clickable:hover { border-color:var(--primary-400) !important; background-color:var(--primary-50) !important; }
      .vca-image-dropzone-clickable:hover .vca-dropzone-label { color:var(--primary-400) !important; }
      .vca-image-dropzone-clickable:hover .vca-dropzone-hint { opacity:1 !important; }
    `}</style>
  );
}
function ImageDropzoneBox({ icon, label, previewSrc, onClick, onClear, aspect }: {
  icon: React.ReactNode; label: string; previewSrc?: string; onClick?: () => void;
  /** Only passed when the preview is an image the USER attached — previewSrc also covers the
   *  selected target's own photo, which there's nothing to detach from. */
  onClear?: () => void;
  aspect?: "square"|"portrait";
}) {
  const [lang] = useLanguage();
  // aspect is opt-in (Live Monitoring's Photo tab, where face/body previews sit one above the
  // other and read clearer at their real proportions) — callers that don't pass it keep the
  // original flex-filled box unchanged (e.g. Re-ID Analysis's side-by-side pair).
  const sizeStyle: React.CSSProperties = aspect
    ? { width:"132px", aspectRatio: aspect === "square" ? "1 / 1" : "3 / 4", flex:"0 0 auto" }
    : { flex:1, minHeight:"120px" };
  // The hint has to be mounted/unmounted (not just opacity-toggled) — an always-present but
  // invisible line still reserves its row of height in this flex column, which pushed the
  // icon+label group above true center any time the box wasn't hovered.
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={onClick ? "vca-image-dropzone-clickable" : undefined} style={{
      ...sizeStyle, borderRadius:"8px", border:"1px dashed var(--gray-300)", backgroundColor:"white",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"12px", overflow:"hidden", position:"relative",
      padding:"20px 12px", boxSizing:"border-box" }}>
      {onClick && <ImageDropzoneHoverStyleTag />}
      {previewSrc && <img src={previewSrc} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.15 }} />}
      <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:"8px" }}>
        {icon}
        <span className="vca-dropzone-label" style={{ fontSize:"11px", color:"var(--gray-400)" }}>{label}</span>
        {onClick && hovered && <span style={{ fontSize:"10px", fontWeight:700, color:"var(--primary-400)" }}>{previewSrc ? T[lang].clickToChange : T[lang].clickToUpload}</span>}
      </div>
      {onClear && hovered && (
        <RemoveImageButton label={T[lang].removeImage(label.toLowerCase())} onRemove={onClear} />
      )}
    </div>
  );
}
function SlidersIconSm({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6.667 5.333H9.333M8 14V8M8 5.333V2M11.333 10.667H14M12.667 8V2M12.667 14V10.667M2 9.333H4.667M3.333 6.667V2M3.333 14V9.333" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/>
    </svg>
  );
}
// "Co-occurrence frequency (high → low)" ran on as one line in a 280px-wide sidebar — breaks it
// onto a second line starting at the "(" instead of wrapping wherever the text box happens to run
// out of room (mid-word) or truncating with an ellipsis.

// Same picker look as Live Monitoring's "All Cameras ▾" (CameraDetailView above) — Re-ID's
// `camera` search filter (already wired into filterReidData) had no UI to actually set it from,
// same gap the Associate filter's search box used to have. A plain string, not tied to the
// ALL_CAMERAS_ID sentinel CameraDetailView uses, since this sets a filter value, not which live
// feed is being browsed — "" just means "no camera filter", same as every other cleared filter.
// Lists the same cameras Live Monitoring's picker does, with the same codes and the same
// online/offline read. Both used to be true at once: this listed "NC-1".."NC-4" because that is
// what REID_DATA's `cam` field held, so the two tabs showed different names for the same estate
// and neither could hand a selection to the other. REID_DATA draws from CAMERA_CODES now.
function ReidCameraPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, open, () => setOpen(false));
  const cameraStatus = useCameraStatus();
  const statusOf = (code: string) => cameraStatus.byCode(code);
  // The register, scoped to the site on screen — not the module-level CAMERA_OPTIONS this used to
  // list. That constant is every camera in the mock, so switching site in the header left the
  // picker naming another site's cameras and the switch was decoration in this tab.
  const options = useSiteCameraCodes();
  const label = value || t.allCameras;
  return (
    /* 152px fitted "NC-1"; a real code plus its ON/OFF needs more, and the label was ellipsing. */
    <div ref={ref} style={{ position:"relative", width:"186px" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
        padding:"8px 12px", borderRadius:"8px", backgroundColor:"white", border:"1px solid var(--primary-400)",
        cursor:"pointer",
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"14px", fontWeight:700, color:"var(--primary-400)",
          minWidth:0, overflow:"hidden" }}>
          <CameraGlyph />
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, transform: open?"rotate(180deg)":"none", transition:"transform 0.15s" }}>
          <path d="M4 6l4 4 4-4" stroke="var(--primary-400)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, width:"100%", backgroundColor:"white",
          border:BORDER, borderRadius:"8px", boxShadow:"0 8px 20px rgba(14,22,42,0.12)", zIndex:10, overflow:"hidden",
          maxHeight:"320px", display:"flex", flexDirection:"column" }}>
          <button className="vca-picker-option" data-on={!value} onClick={() => { onChange(""); setOpen(false); }} style={{
            display:"flex", alignItems:"center", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer", flexShrink:0,
            fontSize:"13px", fontWeight: !value ? 700:500, color: !value ? "var(--primary-400)":"var(--gray-700)",
          }}>
            {t.allCameras}
          </button>
          <div style={{ height:"1px", backgroundColor:"var(--gray-200)", flexShrink:0 }} />
          {/* Same scroll region Live Monitoring's picker has. This list was 4 fixed entries and fit
              in the panel; now it follows the real roster, which grows, and overflow:hidden on the
              panel meant the extra entries were simply unreachable. "All Cameras" stays pinned
              above it — it is the reset, not one of the cameras. */}
          <div className="vca-thin-scrollbar" style={{ overflowY:"auto" }}>
          {options.map(code => (
            <button key={code} className="vca-picker-option" data-on={code===value}
              onClick={() => { onChange(code); setOpen(false); }} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", textAlign:"left", padding:"8px 12px", border:"none", cursor:"pointer",
              fontSize:"13px", fontWeight: code===value ? 700:500, color: code===value ? "var(--primary-400)":"var(--gray-700)",
            }}>
              {code}
              {/* Same ON/OFF read as Live Monitoring's picker. Whether a camera is up is part of
                  what "pick this camera" means, and only one of the two lists was saying it. */}
              <span style={{ fontSize:"10px", fontWeight:800, color: statusOf(code)==="running" ? "var(--success-400)" : "var(--gray-400)" }}>
                {statusOf(code)==="running" ? "ON" : "OFF"}
              </span>
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReIDContent({ camera, onCameraChange, seedCard, onSeedConsumed, onNavigateTab, onGoRedmap, onGoAnalyzeFrame }: {
  camera: string; onCameraChange: (v: string) => void;
  seedCard?: (typeof REID_DATA)[number] | null; onSeedConsumed?: () => void; onNavigateTab?: (tab: DataTab, card: (typeof REID_DATA)[number], label?: string) => void; onGoRedmap?: () => void; onGoAnalyzeFrame?: (location: string) => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [expanded, setExpanded]         = useState(false);
  // Re-ID is a person search: its answer is one identity's appearances across the site's cameras.
  // Redmap and RedFace were gated and this was not, and a Live Monitoring card's "Re-ID" button
  // walks straight in — setting hasSearched during render, so the twenty matches were on screen
  // without the Search button ever being pressed. One door was locked and the other stood open.
  const portalUsers = useVcaStore(state => state.portalUsers);
  const searchAllowed = canSearchInApp(portalUsers);
  const siteProjectId = useActiveProjectId();
  const siteCameras = useSiteCameraCodes();
  // Same collapsible tabbed sidebar as Live Monitoring's Photo/Filter/VIP/Car search (see
  // LiveSearchSidebar) — was its own separate SearchPanel layout before, which meant the two
  // screens' search UIs could drift out of sync every time one of them changed.
  const [searchTab, setSearchTab]       = useState<"Photo"|"Filter"|"VIP"|"Car">("Photo");
  const [hasSearched, setHasSearched]   = useState(false);
  const [detailId, setDetailId]         = useState<number | null>(null);
  const [searchType, setSearchType]     = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget] = useState(-1);
  const [activeVIP, setActiveVIP]       = useState(-1);
  // A crop handed over from a camera card — the third way a person becomes the subject here, and
  // the one an operator reaches for most: they are looking at the person already.
  const [cardTarget, setCardTarget] = useState<(typeof REID_DATA)[number] | null>(null);
  const [threshold, setThreshold]       = useState(70);
  const [gender, setGender]             = useState("");
  const [hatFilter, setHatFilter]             = useState<""|"Hat"|"None">("");
  const [sleeveFilter, setSleeveFilter]       = useState<""|"Short"|"Long">("");
  const [bottomsFilter, setBottomsFilter]     = useState<""|"Trousers"|"Shorts"|"Skirts">("");
  const [backpackFilter, setBackpackFilter]   = useState<""|"Exists"|"None">("");
  const [emotion, setEmotion]           = useState("");
  const [ethnicGroup, setEthnicGroup]   = useState("");
  const [topColors, setTopColors]       = useState<string[]>([]);
  const [bottomColors, setBottomColors] = useState<string[]>([]);
  const [shoesColors, setShoesColors]   = useState<string[]>([]);
  const [dateRange, setDateRange]       = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate] = useState("");
  // "UNSET" (not seedCard's own initial value) so the block below still fires on this
  // component's very first render even when seedCard is ALREADY set at mount time — this tab
  // mounts fresh on every deep-link (it doesn't exist until activeTab switches to it), so
  // seeding it from "the previous seedCard" would just equal the incoming one and never fire.
  const [prevSeedCard, setPrevSeedCard] = useState<typeof seedCard | "UNSET">("UNSET");
  // The landing view (before any search) — continuously "recognizes" someone new every so often,
  // newest at top, instead of sitting on two permanently-fixed example clusters forever.
  const [liveClusters, setLiveClusters] = useState<ReidCluster[]>(() => buildSeedClusters(siteCameras));
  // Re-seed when the header switches site. Every match in a cluster names a camera, so the
  // clusters left over from the previous site are sightings that did not happen here — the same
  // reason Live Monitoring re-seeds its wall.
  const firstClusterRef = useRef(true);
  useEffect(() => {
    if (firstClusterRef.current) { firstClusterRef.current = false; return; }
    setLiveClusters(buildSeedClusters(siteCameras));
  }, [siteCameras]);
  // And the search outcome, for the reason given in Live Monitoring's effect above: a completed
  // search left on screen through a site switch gets re-answered with the new site's cameras.
  const firstReidSiteRef = useRef(true);
  useEffect(() => {
    if (firstReidSiteRef.current) { firstReidSiteRef.current = false; return; }
    setHasSearched(false);
    setDetailId(null);
  }, [siteProjectId]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 15000 + Math.random() * 15000;
      timer = setTimeout(() => {
        setLiveClusters(prev => generateNewRecognition(prev, siteCameras).slice(0, LIVE_RECOGNITION_FEED_CAP));
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [siteCameras]);

  const toggleTopColor    = (c: string) => setTopColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleBottomColor = (c: string) => setBottomColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleShoesColor  = (c: string) => setShoesColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const clearAttrFilters = () => {
    setHatFilter(""); setSleeveFilter(""); setBottomsFilter(""); setBackpackFilter("");
    setEmotion(""); setEthnicGroup("");
  };
  const reset = () => {
    setSearchType("PERSON"); setThreshold(70); setGender(""); clearAttrFilters();
    setTopColors([]); setBottomColors([]); setShoesColors([]);
    setSelectedTarget(-1); setActiveVIP(-1); setDateRange({ start:null, end:null });
    setLicensePlate(""); onCameraChange(""); setHasSearched(false); setSearchTab("Photo");
  };

  // Deep-link from a Live Monitoring card's "Re-ID" hover button: the crop on that card becomes
  // the TARGET, which is what re-identification means — find this identity on other cameras.
  //
  // It used to seed camera, gender and that day's date instead and throw the crop away, so
  // "this person" turned into "any woman that camera saw that day". That is the weaker query of
  // the two: putting a description into words loses most of what the photo already carries. It
  // also produced the filter-bar disconnect twice over — chips claiming to be the reason for
  // results that a target search never reads.
  //
  // The attribute filters are deliberately NOT touched. A target search ignores them, so
  // pre-filling them would only put words on screen that are not narrowing anything.
  if (seedCard !== prevSeedCard) {
    setPrevSeedCard(seedCard);
    if (seedCard) {
      setExpanded(true); setSearchTab("Photo");
      setSelectedTarget(-1); setActiveVIP(-1);
      setCardTarget(seedCard);
      setHasSearched(true);
    }
  }
  useEffect(() => {
    if (seedCard) onSeedConsumed?.();
  }, [seedCard, onSeedConsumed]);

  const selectRecentTarget = (i: number) => {
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); clearAttrFilters(); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender);
    if (t.apparel === "Short Sleeve" || t.apparel === "Long Sleeve") {
      setSleeveFilter(t.apparel === "Short Sleeve" ? "Short" : "Long");
      setBottomsFilter("");
    } else {
      setBottomsFilter(t.apparel as "Trousers"|"Shorts"|"Skirts");
      setSleeveFilter("");
    }
    setHatFilter(t.props.includes("Hat") ? "Hat" : "");
    setBackpackFilter(t.props.includes("Backpack/Bag") ? "Exists" : "");
  };
  const selectVIP = (i: number) => {
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1); setCardTarget(null);
  };

  // Resolved down into the same apparel/props shape filterReidData/the results cluster expect —
  // the segmented Hat/Sleeve/Bottoms/Backpack controls are a different UI over the same data,
  // not a parallel filtering concept. Same derivation as Live Monitoring's LiveSearchSidebar.
  // Memoised: these feed the threshold-cost memo below, and a fresh array on every render would
  // make it recompute every render instead of when the query actually changes.
  const derivedApparel = useMemo(() => [
    sleeveFilter === "Short" ? "Short Sleeve" : sleeveFilter === "Long" ? "Long Sleeve" : null,
    bottomsFilter || null,
  ].filter((v): v is string => !!v), [sleeveFilter, bottomsFilter]);
  const derivedProps = useMemo(() => [
    hatFilter === "Hat" ? "Hat" : null,
    backpackFilter === "Exists" ? "Backpack/Bag" : null,
  ].filter((v): v is string => !!v), [hatFilter, backpackFilter]);

  // Before a search runs, show the two illustrative example clusters (unchanged from before).
  // Once Search is clicked, replace them with one real cluster built from the actual filter
  // state and the live-filtered dataset — the target's face if one was picked, else a generic
  // "Search Result" placeholder.
  // REID_DATA's own gender is "M"/"F"; this shape wants "Male"/"Female", the format VIP_QUICK and
  // RECENT_TARGETS_EN already use. `url` is the body crop, `face` the face crop.
  // Memoised because the card branch builds an object: a new one every render would make the
  // threshold-cost memo below recompute on every render.
  const searchTarget = useMemo(() => activeVIP >= 0 ? VIP_QUICK[activeVIP]
    : selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget]
    : cardTarget ? { face: cardTarget.face, body: cardTarget.url, gender: cardTarget.gender === "M" ? "Male" : "Female" }
    : null, [activeVIP, selectedTarget, cardTarget]);

  /**
   * What this threshold costs, counted against the pool this query actually has — see
   * SimilarityControl. Null with no query: the unfiltered pool is the whole mock, and a count of
   * that would describe a question nobody asked.
   */
  const thresholdCost = useMemo(() => {
    if (searchType !== "PERSON") return null;
    const hasAttributeQuery = !!gender || derivedApparel.length > 0 || derivedProps.length > 0
      || topColors.length > 0 || bottomColors.length > 0 || shoesColors.length > 0
      || !!emotion || !!ethnicGroup;
    if (!searchTarget && !hasAttributeQuery) return null;
    const pool = searchTarget
      ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20, siteCameras)
      : filterReidData({ searchType, gender, apparel: derivedApparel, props: derivedProps, dateRange: dateRange, threshold: 0, topColors, bottomColors, shoesColors, emotion, ethnicGroup, siteCameras });
    if (!pool.length) return null;
    return { kept: pool.filter(r => r.similarity >= threshold).length, total: pool.length };
  }, [searchType, searchTarget, gender, derivedApparel, derivedProps, topColors, bottomColors, shoesColors, emotion, ethnicGroup, dateRange, threshold, siteCameras]);

  const state: SearchFilterState = {
    searchType, setSearchType, selectedTarget, selectRecentTarget, activeVIP, selectVIP,
    threshold, setThreshold, gender, setGender,
    apparel: derivedApparel, toggleApparel: () => {}, props: derivedProps, toggleProps: () => {},
    topColors, toggleTopColor, bottomColors, toggleBottomColor, shoesColors, toggleShoesColor,
    dateRange, setDateRange, licensePlate, setLicensePlate, camera, setCamera: onCameraChange,
    // This tab has only the two pickers; a seeded card becomes the RedFace primary target rather
    // than this panel's subject.
    activeTarget: activeVIP >= 0
      ? { face: VIP_QUICK[activeVIP].face, label: VIP_QUICK[activeVIP].name }
      : selectedTarget >= 0
        ? { face: RECENT_TARGETS_EN[selectedTarget].face, label: RECENT_TARGETS_EN[selectedTarget].label }
        : cardTarget
          // A crop off the wall has no name, only its object id — the designation the rest of
          // this screen already calls it by. Nothing here invents one.
          ? { face: cardTarget.face, label: t.targetNo(String(cardTarget.id).padStart(6, "0")) }
          : null,
    clearActiveTarget: () => {
      if (activeVIP >= 0) selectVIP(activeVIP);
      else if (selectedTarget >= 0) selectRecentTarget(selectedTarget);
      else setCardTarget(null);
    },
    thresholdCost,
    reset,
  };


  // A named target (VIP Quick Select / Recent Targets) means "find this specific person
  // elsewhere" — the results should be that one identity re-appearing, not just anyone who shares
  // the filter attributes. Only the attribute-only search (no target picked) falls back to
  // filterReidData, where a spread of different people genuinely matching the criteria is the
  // correct result. buildTargetResultRows never looks at camera/gender/apparel/props/date, so once
  // a target's picked those stop being real filters — the meta line below only lists what's
  // actually driving the results, same reasoning as Smart Search's results-bar chips.
  const targetRows = searchType === "PERSON" && searchTarget
    ? buildTargetResultRows(searchTarget.face, searchTarget.body, searchTarget.gender === "Male" ? "M" : "F", 20, siteCameras)
        .filter(r => r.similarity >= threshold)
    : null;
  const targetMatches = targetRows?.map(reidToMatchItem) ?? null;
  // The attribute-only search's own rows, computed here rather than inline below so the cluster's
  // `subject` can come from them. It used to fall back to REID_DATA[0] whenever there was no row
  // to take — which is a person from whichever site happens to come first in the mock, put on
  // screen as the subject of a search that found nobody, and handed to RedFace as the target if
  // that button was pressed. A search that found nobody has no subject.
  const attributeRows = targetRows
    ? null
    : filterReidData({ searchType, gender, apparel: derivedApparel, props: derivedProps, dateRange, threshold, licensePlate, camera, topColors, bottomColors, shoesColors, emotion, ethnicGroup, siteCameras }).slice(0, 20);
  const subject = targetRows?.[0] ?? attributeRows?.[0] ?? null;
  const searchResultCluster: ReidCluster | null = hasSearched && subject ? {
    id: "search-result",
    // Top row of the same generated set, so this cluster's RedFace button hands over the person
    // that was searched for rather than switching tabs empty-handed. For an attribute-only
    // search that is the best-scoring row it actually returned.
    subject,
    thumbnail: searchType === "VEHICLE" ? carSvgDataUri(VEHICLE_COLOR_CYCLE[0]) : (searchTarget?.face ?? MATCH_DATA[0].face),
    // Whichever way the subject was picked, it is named by what we actually know it as: a VIP's
    // name, a recent target's label, or — for a crop off the wall — its object id.
    title: searchType === "VEHICLE" ? t.vehicleSearchResult
      : searchTarget && "label" in searchTarget ? searchTarget.label
      : searchTarget && "name" in searchTarget ? searchTarget.name
      : cardTarget ? t.targetNo(String(cardTarget.id).padStart(6, "0"))
      : t.searchResultTitle,
    // Labels are wording and go through T; the values are what the model reports and what the
    // filter state holds, so they translate only where they are drawn (attr()) — see the note at
    // the top of this file.
    meta: targetMatches ? [
      { label:t.labelType, value: attr(searchType === "PERSON" ? "Person" : "Vehicle", lang) },
      { label:t.similarity, value:`${threshold}%` },
    ] : searchType === "VEHICLE" ? [
      { label:t.labelType, value: attr("Vehicle", lang) },
      ...(camera ? [{ label:t.labelCamera, value:camera }] : []),
      ...(licensePlate ? [{ label:t.plate, value:licensePlate }] : []),
      { label:t.similarity, value:`${threshold}%` },
    ] : [
      { label:t.labelType, value: attr("Person", lang) },
      ...(camera ? [{ label:t.labelCamera, value:camera }] : []),
      ...(gender ? [{ label:t.labelGender, value:attr(gender, lang) }] : []),
      ...(derivedApparel.length ? [{ label:t.labelApparel, value:derivedApparel.map(v => attr(v, lang)).join(", ") }] : []),
      ...(derivedProps.length ? [{ label:t.labelProps, value:derivedProps.map(v => attr(v, lang)).join(", ") }] : []),
      ...(topColors.length ? [{ label:t.topColor, value:topColors.map(v => attr(v, lang)).join(", ") }] : []),
      ...(bottomColors.length ? [{ label:t.bottomColor, value:bottomColors.map(v => attr(v, lang)).join(", ") }] : []),
      ...(shoesColors.length ? [{ label:t.shoesColor, value:shoesColors.map(v => attr(v, lang)).join(", ") }] : []),
      ...(emotion ? [{ label:t.labelEmotion, value:attr(emotion, lang) }] : []),
      ...(ethnicGroup ? [{ label:t.labelEthnic, value:attr(ethnicGroup, lang) }] : []),
      { label:t.similarity, value:`${threshold}%` },
    ],
    action: "RedFace",
    matches: targetMatches ?? (attributeRows ?? []).map(p => ({ ...reidToMatchItem(p), similarity: p.similarity })),
  } : null;
  const clusters = hasSearched ? (searchResultCluster ? [searchResultCluster] : []) : liveClusters;
  const detailItem = detailId !== null ? clusters.flatMap(c => c.matches).find(m => m.id === detailId) ?? null : null;
  const scrollRef = useRef<HTMLDivElement>(null);

  // After the hooks, so the rule stays a rule no matter which way this tab was entered — the tab
  // bar, a deep-link, or a card's Re-ID button.
  if (!searchAllowed) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", backgroundColor: "var(--gray-50)" }}>
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.36px" }}>
            {t.noReidTitle}
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", lineHeight: 1.7 }}>
            {t.noReidBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", gap:"12px", overflow:"hidden", padding:"20px 24px 12px", backgroundColor:"var(--gray-100)", boxSizing:"border-box" }}>
      <SlidingSearchPanel
        expanded={expanded}
        onExpand={() => setExpanded(true)}
        sidebar={
          <LiveSearchSidebar
            state={state}
            tab={searchTab} onTabChange={setSearchTab}
            hatFilter={hatFilter} onHatChange={setHatFilter}
            sleeveFilter={sleeveFilter} onSleeveChange={setSleeveFilter}
            bottomsFilter={bottomsFilter} onBottomsChange={setBottomsFilter}
            backpackFilter={backpackFilter} onBackpackChange={setBackpackFilter}
            emotion={emotion} onEmotionChange={setEmotion}
            ethnicGroup={ethnicGroup} onEthnicGroupChange={setEthnicGroup}
            onSearch={() => setHasSearched(true)} onCollapse={() => setExpanded(false)}
          />
        }
      />
      <div style={{ position:"relative", flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px", flexShrink:0 }}>
        <ReidCameraPicker value={camera} onChange={onCameraChange} />
      </div>
      <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
      <div ref={scrollRef} className="vca-hide-scrollbar" style={{ position:"absolute", inset:0, overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px" }}>
        {clusters.length > 0
          ? clusters.map(c => <ClusterCard key={c.id} cluster={c} onNavigateTab={onNavigateTab} onMatchClick={setDetailId} />)
          : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gray-400)", fontSize:"13px", fontWeight:600 }}>
              {t.noMatches}
            </div>
          )
        }
      </div>
      <ScrollToTopButton containerRef={scrollRef} />
      </div>
      </div>
      {detailItem && <DetailModal item={detailItem} onClose={() => setDetailId(null)} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </div>
  );
}

// ── RedFace Placeholder ────────────────────────────────────────
function UserCogIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M2 12v-.5A3.5 3.5 0 0 1 5.5 8h.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="10.3" cy="10.3" r="1.6" stroke="currentColor" strokeWidth="1"/>
      <path d="M10.3 8.1v.8M10.3 11.7v.8M8.4 9.2l.7.4M12.5 11.4l.7.4M8.4 11.4l.7-.4M12.5 9.2l.7-.4" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  );
}
function XCircleIconSm() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
      <rect width="37.0607" height="37.0607" rx="8" fill="var(--gray-100)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 24L24 12L25.0607 13.0607L13.0607 25.0607L12 24Z" fill="var(--gray-700)"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.0607 12L25.0607 24L24 25.0607L12 13.0607L13.0607 12Z" fill="var(--gray-700)"/>
    </svg>
  );
}
function CheckIconSm() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface RedfaceCandidate {
  id:number; url:string; cam:string; time:string; similarity:number; plate?: string | null;
  /**
   * Set only when the person is already named — a Recent target or a VIP. Candidate crops from the
   * grid have no identity beyond their object id, so they leave this empty and get called by that
   * id. Nothing here invents a designation for them.
   */
  label?: string;
}

function candidatesFromFilters(f: {
  searchType: "PERSON" | "VEHICLE"; gender: string; apparel: string[]; props: string[];
  dateRange: DateRangeValue; threshold: number; licensePlate?: string; camera?: string;
  topColors?: string[]; bottomColors?: string[]; shoesColors?: string[];
  emotion?: string; ethnicGroup?: string;
  siteCameras?: string[];
}): RedfaceCandidate[] {
  return filterReidData(f).slice(0, 12)
    .map(p => ({ id:p.id, url:p.url, cam:p.cam, time:p.time, similarity:p.similarity, plate:p.plate }));
}

function CandidateCard({ c, selected, onClick }:
  { c: RedfaceCandidate; selected:boolean; onClick:()=>void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  return (
    <div onClick={onClick}
      // Choosing the primary target is what this modal exists to do, and the only other way in
      // (the VIP chips) does not cover a crop picked out of the grid.
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      aria-pressed={selected}
      style={{
      position:"relative", width:"144px", backgroundColor:"white",
      border: selected ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)",
      borderRadius:"10px", padding:"8px", cursor:"pointer", display:"flex", flexDirection:"column", gap:"8px",
      boxShadow: selected ? "0 4px 8px rgba(90,61,251,0.11)" : "none",
    }}>
      <div style={{ position:"relative", width:"128px", height:"133px", borderRadius:"6px", overflow:"hidden" }}>
        <img src={c.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        <span style={{ position:"absolute", top:6, right:6, fontSize:"10px", fontWeight:600, color:"var(--gray-900)",
          backgroundColor:"rgba(255,255,255,0.8)", padding:"2px 6px", borderRadius:"4px" }}>{c.similarity}%</span>
        <span style={{ position:"absolute", bottom:6, left:6, fontSize:"10px", fontWeight:600, color:"white",
          fontFamily: c.plate ? "monospace" : undefined,
          backgroundColor:"rgba(14,22,42,0.5)", border:"1px solid white", padding:"2px 6px", borderRadius:"4px" }}>{c.plate ?? c.cam}</span>
        {selected && (
          <span style={{ position:"absolute", top:6, left:6, display:"flex", alignItems:"center", gap:"3px",
            backgroundColor:"var(--primary-400)", color:"white", fontSize:"10px", fontWeight:800, padding:"2px 6px", borderRadius:"4px" }}>
            <CheckIconSm /> {t.selectedLabel}
          </span>
        )}
      </div>
      <div>
        <p style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", margin:0 }}>{c.label ?? t.targetNo(String(c.id).padStart(6,"0"))}</p>
        <p style={{ fontSize:"10px", color:"var(--gray-700)", margin:0 }}>{t.todayAt(c.time)}</p>
      </div>
    </div>
  );
}

function ChevronDownIconSm() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function LayersIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L1 3.5L6 6L11 3.5L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      <path d="M1 6L6 8.5L11 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 8.5L6 11L11 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function TableIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1"/>
      <path d="M1 4.3h10M4.3 4.3v6.7" stroke="currentColor" strokeWidth="1"/>
    </svg>
  );
}

function PrimaryTargetPickerModal({ onConfirm, onCancel }:
  { onConfirm:(c:RedfaceCandidate)=>void; onCancel:()=>void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  useEscapeKey(onCancel);
  const siteCameras = useSiteCameraCodes();
  const [searchType, setSearchType]         = useState<"PERSON"|"VEHICLE">("PERSON");
  const [selectedTarget, setSelectedTarget] = useState(-1);
  const [activeVIP, setActiveVIP]           = useState(-1);
  const [threshold, setThreshold]           = useState(70);
  const [gender, setGender]                 = useState("");
  const [apparel, setApparel]               = useState<string[]>([]);
  const [props, setProps]                   = useState<string[]>([]);
  const [topColors, setTopColors]           = useState<string[]>([]);
  const [bottomColors, setBottomColors]     = useState<string[]>([]);
  const [shoesColors, setShoesColors]       = useState<string[]>([]);
  const [attrOpen, setAttrOpen]             = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<number|null>(null);
  const [dateRange, setDateRange]           = useState<DateRangeValue>({ start:null, end:null });
  const [licensePlate, setLicensePlate]     = useState("");
  const [uploadedFace, setUploadedFace]     = useState<string|null>(null);
  const [uploadedBody, setUploadedBody]     = useState<string|null>(null);
  // A chosen target fills BOTH slots from one selection, but the two slots are searched
  // separately — face-only and body-only are different queries — so dropping one has to be
  // possible without dropping the other. These suppress the target's photo for one slot; picking
  // a target (or a different one) clears them, since a fresh choice means both of its photos.
  const [faceCleared, setFaceCleared] = useState(false);
  const [bodyCleared, setBodyCleared] = useState(false);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  // e.target.value is cleared so picking the SAME file again still fires onChange — without it,
  // detaching an image and re-attaching the identical file silently did nothing. The previous
  // blob is revoked on both replace and detach so it isn't held for the rest of the session.
  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (uploadedFace) URL.revokeObjectURL(uploadedFace);
    setUploadedFace(URL.createObjectURL(file));
  };
  const handleBodyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (uploadedBody) URL.revokeObjectURL(uploadedBody);
    setUploadedBody(URL.createObjectURL(file));
  };
  const clearUploadedFace = () => {
    if (uploadedFace) URL.revokeObjectURL(uploadedFace);
    setUploadedFace(null);
  };
  const clearUploadedBody = () => {
    if (uploadedBody) URL.revokeObjectURL(uploadedBody);
    setUploadedBody(null);
  };
  // These boxes fade their "click to change" hint in with CSS, but the detach button can't ride
  // that: an opacity-0 button still swallows clicks, so it's mounted on hover instead of faded.
  const [hoverImageBox, setHoverImageBox] = useState<"face"|"body"|null>(null);

  // Same cascade/toggle/mutual-exclusivity behavior as Re-ID Analysis and Smart Search — see
  // those for the rationale.
  const selectRecentTarget = (i: number) => {
    setFaceCleared(false); setBodyCleared(false);
    // A stale candidate id from the previous search would otherwise win over the new pick's own
    // top row and leave the grid selecting someone unrelated.
    setSelectedCandidate(null);
    if (selectedTarget === i) { setSelectedTarget(-1); setGender(""); setApparel([]); setProps([]); return; }
    setSelectedTarget(i); setActiveVIP(-1);
    const t = RECENT_TARGETS_EN[i];
    setGender(t.gender); setApparel([t.apparel]); setProps(t.props);
  };
  const selectVIP = (i: number) => {
    setFaceCleared(false); setBodyCleared(false);
    setSelectedCandidate(null);
    if (activeVIP === i) { setActiveVIP(-1); return; }
    setActiveVIP(i); setSelectedTarget(-1);
  };

  const target = selectedTarget >= 0 ? RECENT_TARGETS_EN[selectedTarget] : activeVIP >= 0 ? VIP_QUICK[activeVIP] : null;
  // faceCleared/bodyCleared are consulted here, which is the whole point of them: the ✕ on one
  // preview sets the flag, and without reading it back the image never went away — the control
  // looked functional and did nothing. An upload still wins over a cleared target photo, since
  // uploading is a fresh choice for that slot.
  const hasFace = !!uploadedFace || (!!target && !faceCleared);
  const faceSrc = uploadedFace ?? (faceCleared ? undefined : target?.face);
  const hasBody = !!uploadedBody || (!!target && !bodyCleared);
  const bodySrc = uploadedBody ?? (bodyCleared ? undefined : target?.body);
  // Selected recent target first — same reason as VipQuickSelectRow's compact ordering. Original
  // indices ride along because selectRecentTarget and selectedTarget are index-based.
  const recentOrder = RECENT_TARGETS_EN.map((t, i) => ({ t, i }));
  const recentActiveAt = recentOrder.findIndex(o => o.i === selectedTarget);
  if (recentActiveAt > 0) recentOrder.unshift(...recentOrder.splice(recentActiveAt, 1));
  const toggleApparel     = (a: string) => setApparel(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const toggleProps       = (a: string) => setProps(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const toggleTopColor    = (c: string) => setTopColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleBottomColor = (c: string) => setBottomColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleShoesColor  = (c: string) => setShoesColors(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const reset = () => {
    setSearchType("PERSON"); setThreshold(70); setGender(""); setApparel([]); setProps([]);
    setTopColors([]); setBottomColors([]); setShoesColors([]);
    setSelectedTarget(-1); setActiveVIP(-1); setUploadedFace(null); setUploadedBody(null);
    setFaceCleared(false); setBodyCleared(false);
    setDateRange({ start:null, end:null }); setLicensePlate("");
  };
  // Same reasoning as Smart Search / Re-ID Analysis: a named target's cascaded gender/apparel/
  // props/date can coincidentally match nothing in REID_DATA, even though we already have a photo
  // of exactly who we're looking for — reuse that photo instead of risking an empty result. This
  // also covers a manually uploaded face/body with no target picked — faceSrc/bodySrc already
  // fall back to uploadedFace/uploadedBody, so uploading a photo drives results the same way
  // picking a Recent target or VIP does, instead of the upload being purely cosmetic.
  const targetCandidates: RedfaceCandidate[] | null = searchType === "PERSON" && (faceSrc || bodySrc)
    ? buildTargetResultRows(faceSrc ?? bodySrc!, bodySrc ?? faceSrc!, target?.gender === "Male" ? "M" : gender === "Male" ? "M" : "F", 20, siteCameras)
        .filter(r => r.similarity >= threshold)
        .map(p => ({ id: p.id, url: p.url, cam: p.cam, time: p.time, similarity: p.similarity, plate: p.plate }))
    : null;
  // Live — recomputes on every filter change instead of staying empty until a "Search" click, so
  // the results panel never sits disconnected from the filters actually driving it.
  const candidates = targetCandidates ?? candidatesFromFilters({ searchType, gender, apparel, props, dateRange, threshold, licensePlate, topColors, bottomColors, shoesColors, siteCameras });
  /**
   * What the threshold is costing right now — see SimilarityControl.
   *
   * Counted against the SAME pool the grid below draws from, just without the threshold applied,
   * so the two numbers can never disagree. Only when a query exists: with nothing attached and no
   * attribute set, the pool is the whole mock and a count of it would describe a question nobody
   * asked.
   */
  const thresholdCost = useMemo(() => {
    if (searchType !== "PERSON") return null;
    const hasQuery = !!faceSrc || !!bodySrc || !!gender || apparel.length > 0 || props.length > 0
      || topColors.length > 0 || bottomColors.length > 0 || shoesColors.length > 0;
    if (!hasQuery) return null;
    const pool = (faceSrc || bodySrc)
      ? buildTargetResultRows(faceSrc ?? bodySrc!, bodySrc ?? faceSrc!, target?.gender === "Male" ? "M" : gender === "Male" ? "M" : "F", 20, siteCameras)
      : filterReidData({ searchType, gender, apparel, props, dateRange, threshold: 0, licensePlate, topColors, bottomColors, shoesColors, siteCameras });
    if (!pool.length) return null;
    return { kept: pool.filter(r => r.similarity >= threshold).length, total: pool.length };
  }, [searchType, faceSrc, bodySrc, gender, apparel, props, topColors, bottomColors, shoesColors, dateRange, licensePlate, threshold, siteCameras, target]);
  // Picking a Recent target or a VIP already names one specific person, so its top candidate row
  // starts selected. That row is not a lookalike: buildTargetResultRows builds it FROM the picked
  // face at 97%, so it is the same photo — clicking it could only ever choose the same person.
  // Leaving it unselected meant the grid showed the pick but nothing in it was chosen, and the
  // confirm button sat disabled over a person already named.
  const autoSelectId = target && targetCandidates && targetCandidates.length > 0 ? targetCandidates[0].id : null;
  const effectiveSelected = selectedCandidate ?? autoSelectId;
  const selectedRow = candidates.find(c => c.id === effectiveSelected) ?? null;
  // The picked target's own name rides along, so confirming keeps "Mina" or "Target #1024" rather
  // than falling back to the row's object id.
  const selectedObj: RedfaceCandidate | null = selectedRow && selectedRow.id === autoSelectId && target
    ? { ...selectedRow, label: "label" in target ? target.label : target.name }
    : selectedRow;
  const isVehicle = searchType === "VEHICLE";
  // Distinguishes a genuinely blank slate (nothing chosen yet) from an active search that
  // happens to match nothing — the two deserve different empty-state wording.
  const hasAnyFilter = !!target || !!uploadedFace || !!uploadedBody || gender !== "" || apparel.length > 0 || props.length > 0
    || topColors.length > 0 || bottomColors.length > 0 || shoesColors.length > 0
    || !!dateRange.start || !!dateRange.end || licensePlate.trim() !== "" || threshold !== 70;

  return (
    <div style={{ backgroundColor:"white", border:BORDER, borderRadius:"16px", boxShadow:"0 12px 24px rgba(14, 22, 42,0.1)",
      width:"1092px", maxWidth:"100%", display:"flex", flexDirection:"column", maxHeight:"92vh", overflow:"hidden" }}>

      <div style={{ padding:"16px 24px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ width:"34px", height:"34px", borderRadius:"8px", backgroundColor:"var(--primary-100)",
            display:"flex", alignItems:"center", justifyContent:"center", color:"var(--primary-400)", flexShrink:0 }}>
            <UserCogIconSm />
          </div>
          <div>
            <p style={{ fontSize:"16px", fontWeight:800, color:"var(--gray-800)", margin:0, letterSpacing:"-0.32px" }}>{t.selectPrimaryTarget}</p>
            <p style={{ fontSize:"13px", fontWeight:600, color:"var(--gray-500)", margin:0 }}>{t.selectPrimarySub}</p>
          </div>
        </div>
        <button onClick={onCancel} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", flexShrink:0 }}>
          <XCircleIconSm />
        </button>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* The "Search Candidates" button used to sit inside the same scrolling column as the
            filters above it — expanding the Filter accordion could grow that content past the
            column's height, and with the button just being the last flex child (no fixed slot of
            its own) it got squeezed down to a sliver instead of staying a normal button. Now the
            filters scroll in their own flex:1 area and the button lives in a sibling footer row
            that's never part of that scroll, so it always renders at full size. */}
        {/* Before anything's picked, the results panel on the right has nothing to show yet — that
            empty space is put to use widening this panel instead (VIP/filter grids get more room
            per row). Once a target or filter is actually set, results are the thing worth
            focusing on, so this narrows back down and gives that space back to them. */}
        <div style={{ width: hasAnyFilter ? "340px" : "480px", flexShrink:0, backgroundColor:"var(--gray-50)", borderRight:BORDER,
          display:"flex", flexDirection:"column", overflow:"hidden", transition:"width 0.25s ease" }}>
        <div className="vca-hide-scrollbar" style={{ flex:1, minHeight:0,
          padding:"20px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Same fix as Smart Search's toggle: var(--gray-100) on this panel's own var(--gray-50) background is
              two near-identical light grays, so the whole well (and VEHICLE's inactive state)
              barely registered against the page at all. */}
          <div style={{ display:"flex", backgroundColor:"var(--gray-200)", border:"1px solid var(--gray-300)", borderRadius:"10px", padding:"1px", width:"100%" }}>
            {(["PERSON","VEHICLE"] as const).map(t => {
              const active = searchType === t;
              return (
                <button key={t} onClick={() => setSearchType(t)} style={{
                  flex:1, borderRadius:"9px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent",
                  color: active ? "var(--primary-400)" : "var(--gray-600)", fontWeight: active ? 700 : 600,
                  fontSize:"13px", letterSpacing:"-0.2px", padding:"6px 0",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
                }}>
                  {t === "PERSON" ? <PersonIconSm/> : <VehicleIconSm/>} {t}
                </button>
              );
            })}
          </div>

          {!isVehicle && (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"4px", color:"var(--gray-700)" }}>
                  <HistoryIconSm />
                  <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.recentTargets}</span>
                </div>
                {/* One scrolling row, same as VIP quick select right below it — the picker used to
                    show the first two of the list and silently drop the rest, so a target used an
                    hour ago wasn't reachable from here at all. Scrolling holds however many the
                    list grows to without the field getting taller.

                    Selected card pulled to the front for the same reason it is in VIP quick
                    select: in a horizontal scroller, a pick made further along leaves the screen
                    and then nothing says which target is loaded. */}
                <div className="vca-thin-scrollbar" style={{ display:"flex", flexWrap:"nowrap", gap:"8px", overflowX:"auto", paddingBottom:"6px" }}>
                  {recentOrder.map(({ t, i }) => (
                    <button key={i} onClick={() => selectRecentTarget(i)} style={{
                      flexShrink:0, display:"flex", alignItems:"center", gap:"8px", padding:"8px", borderRadius:"8px", cursor:"pointer",
                      backgroundColor:"white",
                      border: selectedTarget === i ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)",
                      boxShadow: selectedTarget === i ? "0 2px 2px rgba(90,61,251,0.1)" : "none",
                    }}>
                      <img src={t.face} alt="" style={{ width:"32px", height:"32px", borderRadius:"4px", objectFit:"cover" }} />
                      <div style={{ textAlign:"left" }}>
                        <p style={{ fontSize:"12px", fontWeight:700, color:"var(--gray-900)", margin:0 }}>{t.label}</p>
                        <p style={{ fontSize:"10px", color:"var(--gray-400)", margin:0 }}>{t.time}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"4px", color:"var(--gray-700)" }}>
                  <StarIconSm />
                  <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.vipQuickSelect}</span>
                </div>
                <VipQuickSelectRow activeVIP={activeVIP} onSelect={selectVIP} compact />
              </div>

              <div style={{ height:"1px", backgroundColor:"var(--gray-200)" }} />

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.searchByImage}</span>
                <ImageDropzoneHoverStyleTag />
                <div style={{ display:"flex", gap:"10px" }}>
                  <div onClick={() => faceInputRef.current?.click()} className="vca-image-dropzone-clickable"
                    onMouseEnter={() => setHoverImageBox("face")} onMouseLeave={() => setHoverImageBox(null)} style={hasFace
                    ? { flex:1, height:"84px", borderRadius:"8px", border:"1px solid var(--primary-300)", backgroundColor:"var(--primary-100)", overflow:"hidden", position:"relative", cursor:"pointer" }
                    : { flex:1, height:"84px", borderRadius:"8px", border:"1px dashed var(--gray-300)", backgroundColor:"white", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", color:"var(--gray-400)" }
                  }>
                    {hasFace ? (
                      <>
                        <img src={faceSrc} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        {!uploadedFace && <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(90,61,251,0.15)" }} />}
                        <div className="vca-dropzone-hint" style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                          backgroundColor:"rgba(14,22,42,0.55)", opacity:0 }}>
                          <span style={{ fontSize:"11px", fontWeight:700, color:"white" }}>{t.clickToChange}</span>
                        </div>
                        {hoverImageBox === "face" && (
                          <RemoveImageButton
                            label={t.removeFaceImage}
                            onRemove={uploadedFace ? clearUploadedFace : () => setFaceCleared(true)}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <DefaultFaceIconSm />
                        <span className="vca-dropzone-label" style={{ fontSize:"10px", color:"var(--gray-400)" }}>Face</span>
                        <span className="vca-dropzone-hint" style={{ fontSize:"10px", fontWeight:700, color:"var(--primary-400)", opacity:0 }}>{t.clickToUpload}</span>
                      </>
                    )}
                    <input ref={faceInputRef} type="file" accept="image/*" onChange={handleFaceUpload} style={{ display:"none" }} />
                  </div>
                  <div onClick={() => bodyInputRef.current?.click()} className="vca-image-dropzone-clickable"
                    onMouseEnter={() => setHoverImageBox("body")} onMouseLeave={() => setHoverImageBox(null)} style={hasBody
                    ? { flex:1, height:"84px", borderRadius:"8px", border:"1px solid var(--primary-300)", backgroundColor:"var(--primary-100)", overflow:"hidden", position:"relative", cursor:"pointer" }
                    : { flex:1, height:"84px", borderRadius:"8px", border:"1px dashed var(--gray-300)", backgroundColor:"white", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"6px", color:"var(--gray-400)" }
                  }>
                    {hasBody ? (
                      <>
                        <img src={bodySrc} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        {!uploadedBody && <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(90,61,251,0.15)" }} />}
                        <div className="vca-dropzone-hint" style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                          backgroundColor:"rgba(14,22,42,0.55)", opacity:0 }}>
                          <span style={{ fontSize:"11px", fontWeight:700, color:"white" }}>{t.clickToChange}</span>
                        </div>
                        {hoverImageBox === "body" && (
                          <RemoveImageButton
                            label={t.removeBodyImage}
                            onRemove={uploadedBody ? clearUploadedBody : () => setBodyCleared(true)}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <FullBodyIconSm />
                        <span className="vca-dropzone-label" style={{ fontSize:"10px", color:"var(--gray-400)" }}>Body</span>
                        <span className="vca-dropzone-hint" style={{ fontSize:"10px", fontWeight:700, color:"var(--primary-400)", opacity:0 }}>{t.clickToUpload}</span>
                      </>
                    )}
                    <input ref={bodyInputRef} type="file" accept="image/*" onChange={handleBodyUpload} style={{ display:"none" }} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.dateRange}</span>
            <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="split" size="sm" emptyText="Last 7 days" />
          </div>

          {isVehicle && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.licensePlate}</span>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", height:"34px", padding:"0 10px",
                borderRadius:"8px", border:BORDER, backgroundColor:"white" }}>
                <LicensePlateIconSm />
                <input
                  value={licensePlate}
                  onChange={e => setLicensePlate(e.target.value)}
                  placeholder="SGA 1234 X"
                  style={{ flex:1, border:"none", outline:"none", fontFamily:"monospace", fontSize:"12px",
                    fontWeight:500, color:"var(--gray-900)", letterSpacing:"-0.22px" }}
                />
              </div>
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.similarity}</span>
            <SimilarityControl value={threshold} onChange={setThreshold} height={34} cost={thresholdCost} />
          </div>

          {!isVehicle && (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <button onClick={() => setAttrOpen(o => !o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                width:"100%", background:"none", border:"none", padding:"0 8px 0 0", cursor:"pointer" }}>
                <span style={{ fontSize:"12px", fontWeight:800, color:"var(--gray-700)", letterSpacing:"-0.2px" }}>{t.tabFilter}</span>
                <span style={{ display:"flex", color:"var(--gray-400)", transform: attrOpen ? "rotate(180deg)" : "none" }}>
                  <ChevronDownIconSm />
                </span>
              </button>
              {attrOpen && (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.labelGender}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {GENDER_CHIPS.map(g => <AttrChip key={g} label={g} active={gender===g} onClick={() => setGender(gender===g ? "" : g)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.labelApparel}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {APPAREL_CHIPS.map(a => <AttrChip key={a} label={a} active={apparel.includes(a)} onClick={() => toggleApparel(a)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.labelProps}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {PROPS_CHIPS.map(p => <AttrChip key={p} label={p} active={props.includes(p)} onClick={() => toggleProps(p)} size="sm" />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.topColor}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {APPAREL_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={topColors.includes(c.id)} onClick={() => toggleTopColor(c.id)} size={18} />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.bottomColor}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {APPAREL_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={bottomColors.includes(c.id)} onClick={() => toggleBottomColor(c.id)} size={18} />)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)" }}>{t.shoesColor}</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                      {SHOE_COLORS.map(c => <ColorSwatch key={c.id} hex={c.hex} active={shoesColors.includes(c.id)} onClick={() => toggleShoesColor(c.id)} size={18} />)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </div>

        <div style={{ flex:1, padding:"20px", display:"flex", flexDirection:"column", gap:"16px", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-800)" }}>{t.searchResults}</span>
              <span style={{ fontSize:"10px", fontWeight:800, color:"var(--primary-400)", backgroundColor:"var(--primary-100)", padding:"2px 6px", borderRadius:"4px" }}>{candidates.length}</span>
            </div>
            {/* A muted, easy-to-miss line read as an afterthought — once candidates actually
                exist, picking one is the ONE thing left to do, so it gets a filled, colored
                callout instead until a card's actually clicked. */}
            {candidates.length > 0 && effectiveSelected === null && (
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--primary-400)", backgroundColor:"var(--primary-100)", padding:"4px 10px", borderRadius:"999px" }}>
                ↓ {t.clickCandidate}
              </span>
            )}
          </div>
          <div className="vca-hide-scrollbar" style={{ flex:1, overflowY:"auto" }}>
            {candidates.length === 0 ? (
              <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", color:"var(--gray-400)" }}>
                {/* One glyph, not two. The line used to open with a literal "←" pointing at the
                    left panel, which sat directly under the magnifier and read as a second icon
                    competing with it. The controls it pointed at are the only controls on the
                    screen, so naming the action is enough. */}
                <SearchIconSm />
                <span style={{ fontSize:"13px", fontWeight:600 }}>
                  {hasAnyFilter ? t.noCandidatesMatch : t.chooseTargetOrFilter}
                </span>
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"16px" }}>
                {candidates.map(c => (
                  <CandidateCard key={c.id} c={c} selected={effectiveSelected === c.id} onClick={() => setSelectedCandidate(c.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding:"16px 24px", borderTop:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:600, color:"var(--gray-900)" }}>
          <ResetIconSm /> {t.resetFilters}
        </button>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={onCancel} style={{ padding:"8px 12px", borderRadius:"8px", border:"1px solid var(--gray-300)", backgroundColor:"white", fontSize:"13px", fontWeight:700, color:"var(--gray-600)", cursor:"pointer" }}>{t.cancel}</button>
          <button disabled={!selectedObj} onClick={() => selectedObj && onConfirm(selectedObj)} style={{ padding:"8px 12px", borderRadius:"8px", border:"none",
            backgroundColor: selectedObj ? "var(--primary-400)" : "var(--primary-200)", color:"white", fontSize:"13px", fontWeight:700,
            cursor: selectedObj ? "pointer" : "default" }}>
            {t.setPrimaryTarget}
          </button>
        </div>
      </div>
    </div>
  );
}

const REDFACE_FACES = MATCH_DATA.map(m => m.face);
const faceAt = (i: number) => REDFACE_FACES[i % REDFACE_FACES.length];

// Deterministic pseudo-random in [0,1) — same formula as vcaStore.ts's own seededRandom.
function redfaceSeededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Stable numeric seed from a target's name — same person always reproduces the same associate
// graph, but a DIFFERENT target actually produces a different one (previously REDFACE_TIER1/2/3
// were fixed arrays, so switching Primary Target changed the header photo/name but the entire
// pyramid/grid underneath never moved).
function redfaceSeedFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000;
  return h + 1;
}

// Same tier shape/sizes as the original hand-authored arrays (2 / 6 / 15 nodes, roughly
// >100 / 10-99 / <10 co-occurrence counts per tier) — only the actual counts and faces vary
// per seed, each tier still sorted descending like the originals were.
function buildRedfaceTiers(seed: number) {
  const tier1Counts = [Math.round(300 + redfaceSeededRandom(seed * 1.1) * 300), Math.round(100 + redfaceSeededRandom(seed * 1.3) * 150)]
    .sort((a, b) => b - a);
  const tier2Counts = Array.from({ length: 6 }, (_, i) => Math.round(10 + redfaceSeededRandom(seed * 2.1 + i) * 89))
    .sort((a, b) => b - a);
  const tier3Counts = Array.from({ length: 15 }, (_, i) => Math.round(1 + redfaceSeededRandom(seed * 3.1 + i) * 9))
    .sort((a, b) => b - a);
  // Status is a coarse mock watchlist read: mostly Unknown, a handful of VIP/Suspect, matching how
  // registered/flagged people are actually a minority of any associate list.
  const statusAt = (r: number): RedfaceNode["status"] => r > 0.88 ? "VIP" : r > 0.7 ? "Suspect" : "Unknown";
  const tier1 = tier1Counts.map((count, i) => ({ id: i, face: faceAt(Math.floor(redfaceSeededRandom(seed * 4 + i) * REDFACE_FACES.length)), count, status: statusAt(redfaceSeededRandom(seed * 10 + i)) }));
  const tier2 = tier2Counts.map((count, i) => ({ id: i + 2, face: faceAt(Math.floor(redfaceSeededRandom(seed * 5 + i) * REDFACE_FACES.length)), count, status: statusAt(redfaceSeededRandom(seed * 11 + i)) }));
  const tier3 = tier3Counts.map((count, i) => ({ id: i + 8, face: faceAt(Math.floor(redfaceSeededRandom(seed * 6 + i) * REDFACE_FACES.length)), count, status: statusAt(redfaceSeededRandom(seed * 12 + i)) }));
  return { tier1, tier2, tier3 };
}

type RedfaceNode = { id:number; face:string; count:number; status:"VIP"|"Suspect"|"Unknown" };
type TierMeta = {
  bg:string; labelBg:string; labelColor:string;
  // Bilingual like TIER_LINK_META below: these are the pyramid's own words, not data.
  label:Record<AppLanguage, string>; sublabel:Record<AppLanguage, string>;
  nodeSize:number; nodeBorder:number; nodeColor:string; step:number; lineWidth:number;
  dashed?:boolean; dashFlow?:boolean; lineOpacity:number; stagger?:boolean;
};
type PyramidRow = { key:string; weight:number; nodes:RedfaceNode[]; meta: TierMeta|null };

// Zone fills land between the library's 100 and 200 steps: 100 put all four bands within a few RGB
// steps of white (one pale surface, connector lines with nothing to be seen against), and 200 was
// heavier than a full-width band wants to be. 70% of the 200 token over white is the step in
// between — written as a mix of the token rather than a new hex, so there is exactly one place to
// change if the library gains a real 150 step. Resulting values, if it does:
//   danger #fdd6dd · warning #fef7d9 · gray #ecf0f5 · primary #d9d7ff
// The label chips go white in exchange — a danger-100 chip on a danger-100 field was invisible.
const ZONE_TINT = (token: string) => `color-mix(in srgb, var(${token}) 70%, white)`;
const PYRAMID_TIER_META: Record<"tier1"|"tier2"|"tier3", TierMeta> = {
  tier1: { bg:ZONE_TINT("--danger-200"), labelBg:"rgba(255,255,255,0.85)", labelColor:"var(--danger-500)", label:{ en:"TIER 1 · RED ZONE", ko:"1단계 · 적색 구간" }, sublabel:{ en:">100 CO-CAPTURES", ko:"동반검출 100건 초과" },
    nodeSize:52, nodeBorder:3, nodeColor:"var(--danger-400)", step:16, lineWidth:1.4, dashFlow:true, lineOpacity:0.85 },
  tier2: { bg:ZONE_TINT("--warning-200"), labelBg:"rgba(255,255,255,0.85)", labelColor:"var(--warning-500)", label:{ en:"TIER 2 · ORANGE ZONE", ko:"2단계 · 주황 구간" }, sublabel:{ en:"10-99 CO-CAPTURES", ko:"동반검출 10~99건" },
    nodeSize:52, nodeBorder:2, nodeColor:"var(--warning-400)", step:11, lineWidth:1, dashed:true, lineOpacity:0.7 },
  tier3: { bg:ZONE_TINT("--gray-200"), labelBg:"rgba(255,255,255,0.85)", labelColor:"var(--gray-700)", label:{ en:"TIER 3 · SLATE ZONE", ko:"3단계 · 회색 구간" }, sublabel:{ en:"<10 CO-CAPTURES", ko:"동반검출 10건 미만" },
    // Same 52px as Tier 2. Tier 3 was drawn smaller to signal a weaker link, but the faces here
    // will be low-resolution CCTV crops in practice, and 42px left too little of them to tell
    // people apart — which is the one thing these nodes are for.
    nodeSize:52, nodeBorder:2, nodeColor:"var(--gray-400)", step:6.5, lineWidth:0.6, lineOpacity:0.45, stagger:true },
};

function xAt(i: number, count: number, step: number) {
  if (count <= 1) return 50;
  return 50 - ((count - 1) * step) / 2 + i * step;
}

function PyramidCanvas({ primaryTarget, rows, onNodeClick, selectedNodeId, dateRange }: { primaryTarget:{ name:string; face:string } | null; rows: PyramidRow[]; onNodeClick:(tier:string, node:RedfaceNode)=>void; selectedNodeId:number|null; dateRange: DateRangeValue }) {
  const cooccurCams = useCooccurCameras();
  const verdictOf = useRedfaceVerdicts();
  const [lang] = useLanguage();
  const t = T[lang];
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0) || 1;
  const positioned = rows.reduce<{ list: Array<PyramidRow & { top:number; bottom:number; center:number }>; acc:number }>((state, r) => {
    const top = (state.acc / totalWeight) * 100;
    const nextAcc = state.acc + r.weight;
    const bottom = (nextAcc / totalWeight) * 100;
    return { list: [...state.list, { ...r, top, bottom, center: (top + bottom) / 2 }], acc: nextAcc };
  }, { list: [], acc: 0 }).list;
  const apexRow = positioned.find(r => r.key === "apex")!;
  const tierRows = positioned.filter(r => r.key !== "apex");
  const assocTotal = tierRows.reduce((sum, r) => sum + r.nodes.length, 0);

  const nodeY = (r: (typeof positioned)[number], i: number) => {
    if (!r.meta?.stagger) return r.center;
    const band = r.bottom - r.top;
    return r.top + band * (i % 2 === 0 ? 0.32 : 0.72);
  };

  return (
    <div style={{ position:"relative", flex:1, minHeight:0, overflow:"hidden" }}>
      <style>{`
        @keyframes redfaceDashFlow { to { stroke-dashoffset: -20; } }
        .redface-dash-flow { stroke-dasharray: 6; animation: redfaceDashFlow 1.2s linear infinite; }
        .redface-avatar-hover { transition: transform 0.15s ease; cursor: pointer; }
        .redface-avatar-hover:hover { transform: scale(2.2); z-index: 30; }
      `}</style>

      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column" }}>
        {positioned.map(r => (
          /* flexBasis:0, not auto. With auto every band started at its own content height (label
             + 24px padding, ~50px) and only the leftover was split by weight, which both flattened
             the differences the weights are there to create AND — worse — put the coloured bands
             somewhere other than where `positioned` says they are. Node dots and connector lines
             are placed from those pure weight percentages, so they were drawing up to 30px above
             the band they belong to. Zeroing the basis makes one calculation govern both. */
          <div key={r.key} style={{ flexGrow:r.weight, flexShrink:0, flexBasis:0, position:"relative",
            backgroundColor: r.meta?.bg ?? ZONE_TINT("--primary-200"), borderBottom: r.key !== tierRows[tierRows.length-1]?.key ? "1px solid rgba(14, 22, 42,0.05)" : "none",
            display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", boxSizing:"border-box" }}>
            <span style={{ fontSize:"10px", fontWeight:800, letterSpacing:"0.4px",
              backgroundColor: r.meta?.labelBg ?? "rgba(255,255,255,0.85)", color: r.meta?.labelColor ?? "var(--primary-400)",
              padding:"4px 8px", borderRadius:"4px" }}>
              {/* Was "APEX · PRIMARY TARGET ZONE". "Apex" only named the tip of the pyramid shape
                  — geometry, not information — and the words after it already said what the band
                  holds. The tier bands name a tier because there are three of them to tell apart;
                  there is one of these. */}
              {r.meta?.label[lang] ?? t.primaryTarget}
            </span>
            <span style={{ fontSize:"10px", fontWeight:800, letterSpacing:"0.4px",
              backgroundColor: r.meta?.labelBg ?? "rgba(255,255,255,0.85)", color: r.meta?.labelColor ?? "var(--primary-400)",
              padding:"4px 8px", borderRadius:"4px" }}>
              {/* Was "CENTRAL TARGET PROFILE", which restated the label opposite it. The tier
                  bands put their co-capture range here, so the parallel fact for this band is how
                  many associates the graph below it found. */}
              {r.meta?.sublabel[lang] ?? t.associatesCount(assocTotal)}
            </span>
          </div>
        ))}
      </div>

      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
        {tierRows.map(r => r.nodes.map((n, i) => {
          const x = xAt(i, r.nodes.length, r.meta!.step);
          const y = nodeY(r, i);
          return (
            <line key={`${r.key}-${n.id}`} x1="50" y1={apexRow.center} x2={x} y2={y}
              stroke={r.meta!.nodeColor} strokeWidth={r.meta!.lineWidth}
              strokeDasharray={r.meta!.dashed ? "3,3" : undefined}
              className={r.meta!.dashFlow ? "redface-dash-flow" : undefined}
              opacity={r.meta!.lineOpacity} vectorEffect="non-scaling-stroke" />
          );
        }))}
      </svg>

      {primaryTarget && (
        <div style={{ position:"absolute", left:"50%", top:`${apexRow.center}%`, transform:"translate(-50%,-50%)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", zIndex:5 }}>
          <div className="redface-avatar-hover" style={{ width:64, height:64, borderRadius:"12px", border:"3px solid var(--primary-400)", backgroundColor:"white",
            boxSizing:"border-box", boxShadow:"0 8px 20px rgba(90,61,251,0.25)" }}>
            <img src={primaryTarget.face} alt="" style={{ width:"100%", height:"100%", borderRadius:"9px", objectFit:"cover", display:"block" }} />
          </div>
          <span style={{ fontSize:"10px", fontWeight:800, color:"white", backgroundColor:"var(--primary-400)", padding:"2px 8px", borderRadius:"999px", letterSpacing:"0.4px" }}>{t.primaryBadge}</span>
        </div>
      )}

      {tierRows.map(r => r.nodes.map((n, i) => {
        const x = xAt(i, r.nodes.length, r.meta!.step);
        const y = nodeY(r, i);
        // Same buildCooccurEvents sample the Joint Evidence panel uses for this node — reused
        // here only for a lightweight last-seen/location tooltip, not to duplicate the panel.
        const nodeEvents = cooccurEventsInRange(n, cooccurCams, dateRange);
        const nodeTopGroup = groupCooccurEvents(nodeEvents)[0];
        const nodeLastSeen = [...nodeEvents].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).pop()!;
        return (
          <div key={`${r.key}-node-${n.id}`} title={T[lang].lastSeenAt(`${nodeLastSeen.date} ${nodeLastSeen.time}`, nodeTopGroup.location)}
            style={{ position:"absolute", left:`${x}%`, top:`${y}%`, transform:"translate(-50%,-50%)",
            display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", zIndex: r.key === "tier1" ? 4 : r.key === "tier2" ? 3 : 2,
            // Judged a false positive: still drawn, and dimmed. Removing it would take the
            // judgement off the screen with it — the next shift would find a graph that simply
            // never had this person in it, and no way to see that somebody already looked.
            opacity: verdictOf(n.id) === "false_positive" ? 0.4 : 1 }}>
            <div className="redface-avatar-hover" onClick={() => onNodeClick(r.key, n)} style={{ position:"relative", width:r.meta!.nodeSize, height:r.meta!.nodeSize, borderRadius:"10px",
              border:`${r.meta!.nodeBorder}px solid ${r.meta!.nodeColor}`, backgroundColor:"white", boxSizing:"border-box",
              boxShadow: n.id === selectedNodeId ? "0 0 0 3px rgba(90,61,251,0.45), 0 2px 8px rgba(14, 22, 42,0.15)" : "0 2px 8px rgba(14, 22, 42,0.15)" }}>
              <img src={n.face} alt="" style={{ width:"100%", height:"100%", borderRadius:`${10 - r.meta!.nodeBorder}px`, objectFit:"cover", display:"block" }} />
            </div>
            {/* The co-captures in the range on screen — the same rows the Joint Evidence panel
                pages through when this node is opened. n.count is the pair's whole history, which
                is what puts them in this tier but not what the date filter left. */}
            <span style={{ fontSize:"10px", fontWeight:800, color:"white", backgroundColor:r.meta!.nodeColor, padding:"3px 7px", borderRadius:"999px" }}>{nodeEvents.length}</span>
          </div>
        );
      }))}
    </div>
  );
}



function SunIconSm({ size = 12 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1" />
      <path d="M6 0.8V2M6 10V11.2M1.5 6H0.3M11.7 6H10.5M2.8 2.8L2 2M10 10L9.2 9.2M9.2 2.8L10 2M2 10L2.8 9.2"
            stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
function MoonIconSm({ size = 12 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink:0 }}>
      <path d="M9.5 7.4A4.2 4.2 0 0 1 4.6 2.5 4.2 4.2 0 1 0 9.5 7.4Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
function MapPinIconSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 14.5s5-4.4 5-8.2A5 5 0 003 6.3c0 3.8 5 8.2 5 8.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <circle cx="8" cy="6.2" r="1.6" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function SwapIconSm() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 5.5h9l-2.2-2.2M13.5 10.5h-9l2.2 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Strong/Moderate/Weak "correlation" used to sit under the link icon, but it only restated the
// tier printed directly above it and named a statistic nothing computes. The co-capture count is
// what the tier is derived FROM, so it says more in the same space.
const TIER_LINK_META: Record<string, { label: Record<AppLanguage, string> }> = {
  tier1: { label:{ en:"Tier 1 link", ko:"1단계 연결" } },
  tier2: { label:{ en:"Tier 2 link", ko:"2단계 연결" } },
  tier3: { label:{ en:"Tier 3 link", ko:"3단계 연결" } },
};

// One scene per camera. Until the backend serves the actual still behind each detection, every
// row shared a single image, so paging through 15 pages of frames looked like the same moment
// listed over and over — the scene is what tells you these are different places. Remote stills
// come from the same source as the face crops; the first keeps the local CCTV asset.
const CO_SCENE = (id: string) => `https://images.unsplash.com/${id}?w=640&h=368&fit=crop&q=70`;
const CO_SCENES = [
  "/cctv-sample.png",
  CO_SCENE("photo-1449824913935-59a10b8d2000"),
  CO_SCENE("photo-1519501025264-65ba15a82390"),
  CO_SCENE("photo-1493780474015-ba834fd0ce2f"),
];

/** A camera a pair can be co-captured by: the register's own code and place, plus a stand-in still. */
type CooccurCamera = { code: string; location: string; scene: string };

/**
 * The cameras this site's co-captures can have happened at.
 *
 * These were four hardcoded entries naming Bugis MRT, Orchard Central, Tampines Hub and Clarke
 * Quay — and RedFace took no site argument at all, so a school campus was shown MRT stations as
 * the evidence for who its people associate with. Their codes were in no register either, the
 * same private-code-space problem that made Re-ID's camera filter always return nothing.
 *
 * Four of them, spread across the roster rather than the first four: "Peak location" only means
 * something if the co-captures cluster, and one camera out of fifty-nine collects too few rows to
 * cluster. Four is also what the scene pool can dress.
 */
function cooccurCamerasForSite(cams: Camera[]): CooccurCamera[] {
  if (cams.length === 0) return [];
  const stride = Math.max(1, Math.floor(cams.length / CO_SCENES.length));
  const picked: CooccurCamera[] = [];
  for (let i = 0; i < CO_SCENES.length; i++) {
    const cam = cams[(i * stride) % cams.length];
    if (picked.some(p => p.code === cam.code)) continue;
    picked.push({ code: cam.code, location: cam.location, scene: CO_SCENES[i] });
  }
  return picked;
}

/**
 * This site's operators' calls on RedFace associates, as a lookup.
 *
 * Read in three places — the pyramid, the grid and the evidence panel — because a judgement that
 * only shows on the screen where it was made does not survive a shift change, which is half of
 * what recording it is for.
 */
function useRedfaceVerdicts(): (nodeId: number) => DetectionVerdict | undefined {
  const judgements = useVcaStore(state => state.detectionJudgements);
  return useMemo(() => {
    const byId = new Map(
      judgements.filter(j => j.surface === "redface").map(j => [j.subjectId, j.verdict] as const),
    );
    return (nodeId: number) => byId.get(String(nodeId));
  }, [judgements]);
}

/** Memoised so the four RedFace views that need this list all get the same one. */
function useCooccurCameras(): CooccurCamera[] {
  const cams = useProjectCameras();
  return useMemo(() => cooccurCamerasForSite(cams), [cams]);
}

function assocId(n: RedfaceNode) {
  return `AS${String((100000 + n.id * 6421) % 900000 + 100000).padStart(6,"0")}`;
}

// An associate co-appearance is ONE FRAME with both people in it. Not "passed the same camera
// within N seconds": at a busy station 90 seconds is several hundred people, so a time-gap window
// makes the whole foot traffic of that camera an associate and a count of 148 means nothing. Same
// frame is a fact the footage can be held to, and it is what the row below draws.
//
// This puts a hard requirement on the backend: per-frame detections carrying every person found in
// that frame. Without them there is no honest version of this feature — a gap-based stand-in would
// only look like one.
type CooccurEvent = {
  location: string;
  camCode: string;
  date: string;
  time: string;
  /** Left edge of the Primary's box, as a % of frame width; the associate's sits beside it. */
  boxLeft: number;
  /** Scene still for this camera — stands in for the actual frame the detection came from. */
  scene: string;
};

// Relative to now, like Redmap's sightings. A fixed July pool drifted further from today every
// week, and once the date filter defaults to a 7-day window it would have matched nothing at all.
// The window the RedFace filter opens with — the same seven days the search tabs default to, so
// the two don't disagree about what "recent" means. Computed once at module scope: dates only, so
// a server pass and the client agree except across a midnight, and only on a default the user can
// see and change.
const DEFAULT_REDFACE_RANGE: DateRangeValue = (() => {
  // Anchored on the clock the co-capture dates are WRITTEN on, not the machine's. dateKeyOf reads
  // a bound's local calendar day, so from the machine's own midnight the end bound named yesterday
  // on any machine behind the mock clock — and the newest day of co-captures fell out of the very
  // window the screen opens with, silently.
  const [y, m, d] = recentSgtStamp(0).date.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  const start = new Date(y, m - 1, d - 6);
  return { start, end };
})();

const COOCCUR_DATES = Array.from({ length: 8 }, (_, i) => recentSgtStamp(i * 24 * 60).date);
// Hours a pair actually gets seen together on a street camera — commute, lunch, evening.
const COOCCUR_HOURS = [7, 8, 8, 12, 14, 18, 19, 21];

// Every co-capture the pair has, not a sample of it: the timeline pages through them instead of
// truncating, so a count of 148 in the grid means 148 rows here.
function buildCooccurEvents(node: RedfaceNode, cams: CooccurCamera[]): CooccurEvent[] {
  // No cameras registered at this site means no frame either of them could have been captured in.
  if (cams.length === 0) return [];
  const primaryIdx = node.id % cams.length;
  return Array.from({ length: node.count }, (_, i) => {
    // 3 in 5 at the pair's usual camera, the rest scattered — that skew is what makes "Peak
    // location" mean anything rather than just naming whichever camera came first.
    const isPrimary = i % 5 < 3;
    const idx = cams.length === 1 ? 0
      : isPrimary ? primaryIdx
      : (primaryIdx + 1 + (i % (cams.length - 1))) % cams.length;
    const cam = cams[idx];
    // Dates cycle, so `seq` is the nth capture on that one date. Minutes step by 7 (coprime with
    // 60) against seq, which keeps timestamps distinct up to 60 captures a day — no two rows in
    // the timeline can collide and read as one frame counted twice.
    const date = COOCCUR_DATES[i % COOCCUR_DATES.length];
    const seq = Math.floor(i / COOCCUR_DATES.length);
    const hh = COOCCUR_HOURS[(node.id + seq * 3) % COOCCUR_HOURS.length];
    const mm = (node.id * 11 + seq * 7) % 60;
    const ss = (node.id + seq * 13) % 60;
    const two = (n: number) => String(n).padStart(2, "0");
    // Stand-in for the box coordinates a per-frame detection would carry.
    const boxLeft = 22 + ((node.id + i * 13) % 18);
    return { location: cam.location, camCode: cam.code, scene: cam.scene, date, time: `${two(hh)}:${two(mm)}:${two(ss)}`, boxLeft };
  });
}

/**
 * A pair's co-captures inside the date range on screen.
 *
 * The range used to decide only whether a NODE was drawn at all. Everything inside it — the
 * timeline, the peak location, the co-capture figure — kept reading the pair's whole history, so
 * narrowing the range to today left a node claiming 148 co-captures and paging through eight days
 * of frames to prove it. What a screen reports has to be what it filtered.
 *
 * Tier membership is deliberately NOT recomputed from this: the tiers are >100 / 10-99 / <10
 * co-captures over the whole relationship, which is a property of the pair and not of the window
 * being looked at.
 */
function cooccurEventsInRange(node: RedfaceNode, cams: CooccurCamera[], range: DateRangeValue): CooccurEvent[] {
  const all = buildCooccurEvents(node, cams);
  if (!range.start && !range.end) return all;
  return all.filter(e => dateWithinRange(e.date, range));
}

function groupCooccurEvents(events: CooccurEvent[]) {
  const groups: Array<{ location:string; camCode:string; events:CooccurEvent[] }> = [];
  events.forEach(e => {
    const g = groups.find(g => g.location === e.location);
    if (g) g.events.push(e); else groups.push({ location:e.location, camCode:e.camCode, events:[e] });
  });
  return groups.sort((a, b) => b.events.length - a.events.length);
}

function timeBucket(time: string) {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function dominantTimeBucket(events: CooccurEvent[]) {
  const counts: Record<string, number> = {};
  events.forEach(e => { const b = timeBucket(e.time); counts[b] = (counts[b] ?? 0) + 1; });
  const [bucket, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { bucket, count, pct: Math.round((count / events.length) * 100) };
}

const STATUS_BADGE_META: Record<RedfaceNode["status"], { bg:string; text:string }> = {
  VIP: { bg:"var(--primary-100)", text:"var(--primary-400)" },
  Suspect: { bg:"var(--warning-200)", text:"var(--warning-500)" },
  Unknown: { bg:"var(--gray-100)", text:"var(--gray-500)" },
};

/**
 * Same sparkle Best Frame's detail panel puts beside "Analysis results" — the app's mark for
 * "this block is derived, not recorded". fill:currentColor rather than a fixed hex so it takes
 * the heading's colour and cannot drift from it.
 */
function AnalysisSparkleIcon({ size = 13 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8.00195 1.33301C8.1574 1.33309 8.30814 1.38798 8.42773 1.4873C8.54731 1.58669 8.62868 1.72508 8.65723 1.87793L9.35742 5.58301C9.40718 5.84636 9.53512 6.08878 9.72461 6.27832C9.9141 6.46781 10.1566 6.5957 10.4199 6.64551L14.126 7.34668C14.2785 7.37528 14.4164 7.45589 14.5156 7.5752C14.615 7.69488 14.6699 7.84638 14.6699 8.00195C14.6698 8.1574 14.6149 8.30814 14.5156 8.42773C14.4163 8.54716 14.2786 8.62864 14.126 8.65723L10.4199 9.35742C10.1566 9.40723 9.91411 9.53511 9.72461 9.72461C9.53511 9.91411 9.40723 10.1566 9.35742 10.4199L8.65723 14.126C8.62864 14.2786 8.54716 14.4163 8.42773 14.5156C8.30814 14.6149 8.1574 14.6698 8.00195 14.6699C7.84638 14.6699 7.69488 14.615 7.5752 14.5156C7.45589 14.4164 7.37528 14.2785 7.34668 14.126L6.64551 10.4199C6.5957 10.1566 6.46781 9.9141 6.27832 9.72461C6.08878 9.53512 5.84636 9.40718 5.58301 9.35742L1.87793 8.65723C1.72508 8.62868 1.58669 8.54731 1.4873 8.42773C1.38798 8.30814 1.33309 8.1574 1.33301 8.00195C1.33301 7.84638 1.38791 7.69488 1.4873 7.5752C1.58668 7.45571 1.72515 7.37522 1.87793 7.34668L5.58301 6.64551C5.8464 6.59573 6.08877 6.46787 6.27832 6.27832C6.46787 6.08877 6.59573 5.8464 6.64551 5.58301L7.34668 1.87793C7.37522 1.72515 7.45571 1.58668 7.5752 1.4873C7.69488 1.38791 7.84638 1.33301 8.00195 1.33301ZM2.66699 12C3.40311 12.0002 3.99982 12.5969 4 13.333C4 14.0693 3.40322 14.6668 2.66699 14.667C1.93061 14.667 1.33301 14.0694 1.33301 13.333C1.33318 12.5968 1.93072 12 2.66699 12ZM13.333 0.833008C13.609 0.833008 13.8328 1.05702 13.833 1.33301V2.16699H14.667C14.943 2.16717 15.167 2.39096 15.167 2.66699C15.1668 2.94288 14.9429 3.16682 14.667 3.16699H13.833V4C13.8328 4.27599 13.609 4.5 13.333 4.5C13.0571 4.49982 12.8332 4.27588 12.833 4V3.16699H12C11.724 3.16699 11.5002 2.94298 11.5 2.66699C11.5 2.39085 11.7239 2.16699 12 2.16699H12.833V1.33301C12.8332 1.05712 13.0571 0.833183 13.333 0.833008Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Section heading inside a right-hand panel. 13px/700 with -0.26px tracking is what the other
 * panels in the app already use ("Analysis results", "Also captured in this frame" in Best Frame
 * detail), so this panel reads as the same product rather than a screen borrowed from a CRM — the
 * 10px uppercase micro-label that briefly lived here appears nowhere else in the service.
 */
function PanelHeading({ children, title, color = "var(--gray-900)", icon }: {
  children: React.ReactNode; title?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <p style={{ margin:0, display:"flex", alignItems:"center", gap:"6px",
      fontSize:"13px", fontWeight:700, color,
      letterSpacing:"-0.26px", cursor: title ? "help" : "default" }} title={title}>
      {icon}
      {children}
    </p>
  );
}

// How many frames a page holds is measured, not fixed: the list band fills whatever height the
// window leaves it, and a fixed count either overflows it on a laptop or wastes half of a tall
// monitor. This is only the count used for the first paint, before the ResizeObserver reports in.
const TIMELINE_PAGE_GUESS = 3;
/** The scene stills are all this shape, so a row's height follows from the cell's width. */
const FRAME_ASPECT = 1194 / 685;
/**
 * Two frames a row. One-up read best but put three frames on a page, which turned 129 co-captures
 * into 43 pages — a summary bought at the cost of making the evidence unscannable. Halving the
 * width quarters nothing: it drops each row to ~117px, so a page holds 8-12 and the pager becomes
 * something you use a few times instead of forty. The box labels don't survive at this size (two
 * 8px labels 34px apart overlap), so they move into a legend baked into the frame's own caption.
 */
const LIST_COLS = 2;
/** A page never grows past this, however tall the window gets. */
const TIMELINE_PAGE_MAX = 16;
/** Gap between rows and between columns, and the band's own vertical/horizontal padding. */
const FRAME_ROW_GAP = 12;
const LIST_COL_GAP = 12;
const LIST_PAD_Y = 32;
const LIST_PAD_X = 40;

/**
 * Page numbers with gaps: first, last, and a window around the current page. A tier-1 pair can
 * have 150+ co-captures, i.e. 15+ pages — printing every number would wrap to three lines inside
 * a 460px panel, and the numbers nobody can act on are the ones far from where they are.
 */
function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const near = [current - 1, current, current + 1].filter(n => n > 1 && n < total);
  const out: Array<number | "gap"> = [1];
  if (near[0] > 2) out.push("gap");
  out.push(...near);
  if (near[near.length - 1] < total - 1) out.push("gap");
  out.push(total);
  return out;
}

function PagerArrow({ dir }: { dir: -1 | 1 }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: dir === 1 ? "none" : "rotate(180deg)" }}>
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimelinePager({ page, pageCount, onPage }: {
  page: number; pageCount: number; onPage: (p: number) => void;
}) {
  const [lang] = useLanguage();
  const cell = (active: boolean, disabled: boolean) => ({
    minWidth: "24px", height: "24px", padding: "0 5px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: active ? 800 : 600,
    color: disabled ? "var(--gray-300)" : active ? "white" : "var(--gray-600)",
    backgroundColor: active ? "var(--gray-800)" : "transparent",
    border: active ? "none" : BORDER, borderRadius: "6px",
    cursor: disabled ? "default" : "pointer",
  });
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", paddingTop:"4px" }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} aria-label={T[lang].prevPage}
        style={cell(false, page === 1)}><PagerArrow dir={-1} /></button>
      {pageWindow(page, pageCount).map((n, i) =>
        n === "gap"
          ? <span key={`gap${i}`} style={{ ...cell(false, true), border:"none" }}>…</span>
          : <button key={n} onClick={() => onPage(n)} style={cell(n === page, false)}>{n}</button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === pageCount} aria-label={T[lang].nextPage}
        style={cell(false, page === pageCount)}><PagerArrow dir={1} /></button>
    </div>
  );
}

/**
 * Full-size view of one shared frame. The grid cell is ~203px wide, which is enough to see THAT
 * two people were boxed together and not much else — no faces, no read of what either was doing.
 * This is where the frame is actually looked at, so it also carries the one onward action the
 * frame supports: hand this camera and moment to Best Frame's inspection view.
 */
function SharedFrameLightbox({ event, assocLabel, index, total, onStep, onClose, onAnalyze }: {
  event: CooccurEvent; assocLabel: string; index: number; total: number;
  onStep: (delta: number) => void; onClose: () => void;
  onAnalyze?: (location: string, at: { date: string; time: string }) => void;
}) {
  const [lang] = useLanguage();
  useEscapeKey(onClose);
  const step = (delta: number, label: string) => (
    <button onClick={() => onStep(delta)} aria-label={label} title={label}
      disabled={delta < 0 ? index === 0 : index === total - 1}
      style={{ width:"32px", height:"32px", borderRadius:"8px", border:"none", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        backgroundColor:"var(--gray-100)", cursor:"pointer",
        color: (delta < 0 ? index === 0 : index === total - 1) ? "var(--gray-300)" : "var(--gray-600)" }}>
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ transform: delta > 0 ? "none" : "rotate(180deg)" }}>
        <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, backgroundColor:"rgba(14,22,42,0.55)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ backgroundColor:"white", borderRadius:"16px", border:BORDER, width:"100%", maxWidth:"920px",
        display:"flex", flexDirection:"column", overflow:"hidden" }}>

        <div style={{ padding:"12px 16px", borderBottom:BORDER, display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
          <div style={{ minWidth:0 }}>
            <p style={{ margin:0, fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px" }}>{event.location}</p>
            <p style={{ margin:"2px 0 0", fontSize:"11px", color:"var(--gray-500)" }}>{event.camCode} · {event.date} {event.time}</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
            <span style={{ fontSize:"11px", fontWeight:600, color:"var(--gray-400)", whiteSpace:"nowrap" }}>{index + 1} / {total}</span>
            {step(-1, T[lang].prevFrame)}
            {step(1, T[lang].nextFrame)}
            <button onClick={onClose} aria-label={T[lang].close} style={{ width:"32px", height:"32px", padding:0, border:"none",
              backgroundColor:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gray-400)" }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Labels come back onto the boxes here — at this width they have the room the grid cell
            denied them, and a label on the box is more direct than a legend to cross-reference. */}
        <div style={{ position:"relative", backgroundColor:"var(--gray-900)" }}>
          <img src={event.scene} alt="" style={{ width:"100%", aspectRatio:"1194 / 685", objectFit:"cover", display:"block" }} />
          {[
            { label:"TARGET", color:"var(--primary-300)", left:event.boxLeft },
            { label:assocLabel, color:"var(--danger-400)", left:event.boxLeft + 17 },
          ].map(box => (
            <div key={box.label} style={{ position:"absolute", left:`${box.left}%`, top:"30%", width:"14%", height:"40%",
              border:`2px solid ${box.color}`, borderRadius:"3px" }}>
              <span style={{ position:"absolute", bottom:"100%", left:-2, marginBottom:"3px", whiteSpace:"nowrap",
                fontSize:"11px", fontWeight:800, color:"white", backgroundColor:box.color, padding:"2px 6px", borderRadius:"4px" }}>
                {box.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 16px", borderTop:BORDER, backgroundColor:"var(--gray-50)", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"12px" }}>
          {/* Same wording and destination as Re-ID's detail popup — this deep-links the camera to
              Best Frame's inspection view rather than duplicating that screen here. */}
          {/* Carries the frame's own date and time, not just its camera: without them Best Frame
              opened on that camera's live position, which is a different frame entirely. */}
          <button onClick={() => onAnalyze?.(event.location, { date: event.date, time: event.time })} disabled={!onAnalyze}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px",
              border:"none", backgroundColor: onAnalyze ? "var(--gray-900)" : "var(--gray-300)", color:"white",
              fontSize:"12px", fontWeight:800, cursor: onAnalyze ? "pointer" : "default", whiteSpace:"nowrap" }}>
            {T[lang].analyzeFrame}
          </button>
        </div>
      </div>
    </div>
  );
}

function JointEvidencePanel({ primary, tier, node, onClose, onAnalyzeFrame, dateRange }: {
  primary: { name:string; face:string }; tier: "tier1"|"tier2"|"tier3"; node: RedfaceNode;
  dateRange: DateRangeValue;
  onClose: () => void;
  onAnalyzeFrame?: (location: string, at: { date: string; time: string }) => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const meta = TIER_LINK_META[tier];
  const statusBadge = STATUS_BADGE_META[node.status];
  /**
   * The operator's own call on this associate, in the store rather than in this component.
   *
   * RedFace had an exclude action once and it was a Set that lived until the primary target
   * changed — so a judgement disappeared the moment the screen moved on, and was never attributed
   * to anybody. Both verdicts, because "nobody has looked at this pair yet" and "somebody looked
   * and they really are together" are different states, and a screen with only an exclude button
   * cannot tell them apart.
   *
   * The subject is the node id: it is seeded and stable, so the same associate keeps its verdict
   * across searches. Redmap writes the same record for its sightings — see DetectionJudgement.
   */
  const judgements = useVcaStore(state => state.detectionJudgements);
  const recordJudgement = useVcaStore(state => state.recordJudgement);
  const clearJudgement = useVcaStore(state => state.clearJudgement);
  const judgement = judgementFor(judgements, "redface", String(node.id));
  // Names arrive either bare ("TS700005", "Mina") or with the id in parentheses; take the id when
  // it is there, otherwise the name itself is the identifier.
  const primaryId = primary.name.match(/\(([^)]+)\)/)?.[1] ?? primary.name;
  const cooccurCams = useCooccurCameras();
  const events = cooccurEventsInRange(node, cooccurCams, dateRange);
  const groups = groupCooccurEvents(events);
  const topGroup = groups[0];
  const { bucket, count: bucketCount, pct } = dominantTimeBucket(events);
  const sortedByDate = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const firstSeen = sortedByDate[0];
  const lastSeen = sortedByDate[sortedByDate.length - 1];
  const newestFirst = [...sortedByDate].reverse();

  const [page, setPage] = useState(1);
  // Clicking a Peak card narrows the frame list to the frames that produced that number. The two
  // are mutually exclusive rather than combinable: "Orchard Rd Junction AND evening" is a third
  // claim the cards never made, and an empty result from crossing them would read as a bug.
  const [focus, setFocus] = useState<null | "location" | "time">(null);
  // Index into `shown`, so stepping through the lightbox follows whatever filter is active rather
  // than jumping back into the unfiltered list.
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const toggleFocus = (next: "location" | "time") => {
    setFocus(f => (f === next ? null : next));
    setPage(1);
    setZoomIdx(null);
  };
  // Picking a different associate keeps this panel mounted, so page 7 of the last pair's timeline
  // would carry over into a pair that may only have one page. Compare during render rather than in
  // an effect so the first paint is already page 1.
  const [pagedNodeId, setPagedNodeId] = useState(node.id);
  if (pagedNodeId !== node.id) {
    setPagedNodeId(node.id);
    setPage(1);
    setFocus(null);
    setZoomIdx(null);
  }

  // Measured from the list band itself. Reading its own box is safe rather than circular: the
  // band is flex:1 with its own scroll, so its height comes from the window, never from how many
  // rows we decide to put in it.
  const listRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(TIMELINE_PAGE_GUESS);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // ResizeObserver fires once on observe, so this covers the initial measure too.
    const ro = new ResizeObserver(() => {
      const cellW = (el.clientWidth - LIST_PAD_X - LIST_COL_GAP * (LIST_COLS - 1)) / LIST_COLS;
      const rowH = cellW / FRAME_ASPECT + FRAME_ROW_GAP;
      // Padding out, then the gap the last row doesn't have back in.
      const usable = el.clientHeight - LIST_PAD_Y + FRAME_ROW_GAP;
      const fits = usable / rowH;
      // Flooring left up to a full frame's worth of dead white at the bottom — two frames and a
      // 170px blank where a third obviously belonged. A part-visible frame at the fold is the
      // better end: it says there is more below, and the band scrolls. So anything past a third
      // of a row earns that row.
      const rows = Math.floor(fits) + (fits % 1 >= 0.3 ? 1 : 0);
      setPerPage(Math.max(LIST_COLS, Math.min(TIMELINE_PAGE_MAX, rows * LIST_COLS)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = focus === "location" ? newestFirst.filter(e => e.location === topGroup.location)
    : focus === "time" ? newestFirst.filter(e => timeBucket(e.time) === bucket)
    : newestFirst;
  const focusLabel = focus === "location" ? topGroup.location : focus === "time" ? bucket : null;

  const pageCount = Math.max(1, Math.ceil(shown.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * perPage;
  const pageRows = shown.slice(pageStart, pageStart + perPage);

  return (
    /* Three bands instead of one long scroll: the summary blocks stay put, only the frame list
       scrolls, and the pager is pinned to the bottom edge. Scrolling the whole panel meant the
       pager sat below five 241px frames — on a 1080p screen you had to scroll ~1400px past the
       evidence to reach the control that pages through it, and on a shorter window it was simply
       off-screen. Same shape as the paginated lists in the sidebar. */
    <div style={{ width:"460px", flexShrink:0, backgroundColor:"white", borderLeft:BORDER,
      display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ flexShrink:0, padding:"20px 20px 0", display:"flex", flexDirection:"column", gap:"18px" }}>

        {/* Panel title, then the subject — the shape Route history (Redmap) and Inspection detail
            (Best Frame) already use: a 16px/800 title row with its one control on the right. Dropping
            this row made the panel quieter but also made it the only right-hand panel in the app
            without a name. The ✕ stays a bare glyph, which is what Best Frame's own close control
            is; the 37px filled square was the outlier. */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px" }}>
          <p title={t.sharedFramesTitle} style={{ margin:0, fontSize:"16px", fontWeight:800,
            color:"var(--gray-900)", letterSpacing:"-0.32px", cursor:"help" }}>{t.coCaptureEvidence}</p>
          <button onClick={onClose} aria-label={t.close} style={{
            width:"26px", height:"26px", flexShrink:0, padding:0,
            backgroundColor:"transparent", border:"none", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gray-400)",
          }}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* The pair, left-aligned. What was here — two faces mirrored around a chain icon in a
            circle, with TIER 2 LINK above it and a correlation line below — was a relationship
            *diagram*, and no monitoring tool draws one for two rows of data. Every record panel that
            does this for real (Clay, folk, Attio) puts the subject top-left, the faces at reading
            size, and the rest below. The status badge rides the line under the names. */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ display:"flex", gap:"3px", flexShrink:0 }}>
            <img src={primary.face} alt="" style={{ width:"40px", height:"40px", borderRadius:"5px", objectFit:"cover" }} />
            <img src={node.face} alt="" style={{ width:"40px", height:"40px", borderRadius:"5px", objectFit:"cover" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"2px", minWidth:0 }}>
            {/* "+" not an arrow: appearing in one frame together is symmetric, and an arrow would
                read as a movement from one to the other. */}
            <span style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", letterSpacing:"-0.28px" }}>
              {primaryId} + {assocId(node)}
            </span>
            {/* Status rides this line now that the analytics block is back to two stat cards —
                it has nowhere else to sit, and it belongs to the associate, not to the pattern. */}
            <span style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", color:"var(--gray-500)" }}>
              {meta.label[lang]} · {t.coCaptures(events.length)}
              <span style={{ fontSize:"9px", fontWeight:800, color:statusBadge.text, backgroundColor:statusBadge.bg,
                padding:"2px 6px", borderRadius:"4px", letterSpacing:"0.2px" }}>{lang === "ko" ? attr(node.status, lang) : node.status.toUpperCase()}</span>
            </span>
          </div>
          {/* The call, at the top of the panel that holds the evidence for it — not buried under
              the frames. Two buttons until somebody decides, then what was decided plus a way
              back. Who and when come from the record, because "a human checked this" is only a
              defence if it says which human. */}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
            {judgement ? (
              <>
                <span style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"1px" }}>
                  <span style={{ fontSize:"10px", fontWeight:800,
                    color: judgement.verdict === "confirmed" ? "var(--success-400)" : "var(--danger-400)" }}>
                    {judgement.verdict === "confirmed" ? t.confirmed : t.excluded}
                  </span>
                  <span style={{ fontSize:"9px", fontWeight:600, color:"var(--gray-400)", whiteSpace:"nowrap" }}>
                    {t.judgedBy(judgement.actor, sgtClockTime(new Date(judgement.at)))}
                  </span>
                </span>
                <button onClick={() => clearJudgement("redface", String(node.id))} title={t.undoJudgement}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:"10px", fontWeight:700, color:"var(--gray-500)", padding:"2px 4px" }}>
                  {t.undoJudgement}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => recordJudgement({ surface:"redface", subjectId:String(node.id), targetLabel:primary.name, verdict:"confirmed" })}
                  title={t.confirmAssociate}
                  style={{ display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px", borderRadius:"6px",
                    border:"1px solid var(--success-400)", backgroundColor:"white", cursor:"pointer",
                    fontSize:"11px", fontWeight:700, color:"var(--success-400)", whiteSpace:"nowrap" }}>
                  <CheckIconSm /> {t.confirmed}
                </button>
                <button
                  onClick={() => recordJudgement({ surface:"redface", subjectId:String(node.id), targetLabel:primary.name, verdict:"false_positive" })}
                  title={t.excludeAssociate}
                  style={{ display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px", borderRadius:"6px",
                    border:"1px solid var(--gray-300)", backgroundColor:"white", cursor:"pointer",
                    fontSize:"11px", fontWeight:700, color:"var(--danger-400)", whiteSpace:"nowrap" }}>
                  <XCircleIconSm /> {t.excluded}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Where and when the two were captured together most, plus the span they cover. That is the
            whole of what detection times at a camera can support: a gap-based "companion
            probability" also lived here, but a time gap cannot separate walking side by side from
            passing three seconds and several metres apart. "Peak" rather than "Time of day" because
            the label has to say the value is the commonest one. */}
        {/* Filled instead of ruled. A fill already says "these belong together", so the 1px rules
            that used to bracket this block went with it — a tinted box between two rules was the
            same boundary drawn twice. 2px of margin on top of the column's 18px gap keeps the 20px
            of air the block had when the rules were doing the separating. */}
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", margin:"2px 0",
          backgroundColor:"var(--gray-50)", borderRadius:"8px", padding:"10px 12px" }}>
          <PanelHeading title={t.whereWhenCluster} color="var(--primary-400)"
            icon={<AnalysisSparkleIcon />}>{t.relationshipAnalytics}</PanelHeading>
          {/* Border and fill live in the class, not inline: an inline declaration outranks any
              stylesheet selector, so setting them here would silently kill :hover and [data-on]. */}
          <style>{`
            .vca-peak-card{border:1px solid var(--gray-200);background-color:#fff;transition:border-color .15s}
            .vca-peak-card:hover{border-color:var(--primary-300)}
            .vca-peak-card[data-on="true"]{border-color:var(--primary-400)}
            .vca-peak-card[data-on="true"] .vca-peak-label{color:var(--primary-400)}
          `}</style>
          <div style={{ display:"flex", gap:"10px" }}>
            <button className="vca-peak-card" data-on={focus === "location"}
              onClick={() => toggleFocus("location")}
              title={t.peakLocationTip(topGroup.events.length, events.length)}
              style={{ flex:1, minWidth:0, borderRadius:"8px", padding:"6px 10px", textAlign:"left", cursor:"pointer" }}>
              <p className="vca-peak-label" style={{ margin:0, fontSize:"10px", color:"var(--gray-400)" }}>{t.colPeakLocation}</p>
              {/* The glyph belongs on the value, not the label — a pin next to the words "Peak
                  location" only restates them, next to "Novena" it marks what kind of thing that is. */}
              <p style={{ margin:"3px 0 0", fontSize:"12px", fontWeight:700, color:"var(--gray-900)", display:"flex", alignItems:"center", gap:"4px" }}>
                {/* The count is the point of calling it "peak" — without it the card names a
                    place and leaves you to guess whether it won by 60 frames or by one. */}
                <MapPinIconSm /> {topGroup.location}
                <span style={{ marginLeft:"auto", fontWeight:800, color:"var(--primary-400)" }}>{topGroup.events.length}</span>
              </p>
            </button>
            <button className="vca-peak-card" data-on={focus === "time"}
              onClick={() => toggleFocus("time")}
              title={t.peakTimeTip(bucketCount, events.length, pct, attr(bucket, lang))}
              style={{ flex:1, minWidth:0, borderRadius:"8px", padding:"6px 10px", textAlign:"left", cursor:"pointer" }}>
              <p className="vca-peak-label" style={{ margin:0, fontSize:"10px", color:"var(--gray-400)" }}>{t.colPeakTime}</p>
              {/* Sun or moon by the bucket itself — a sun beside "night" would be worse than no
                  glyph at all. */}
              <p style={{ margin:"3px 0 0", fontSize:"12px", fontWeight:700, color:"var(--gray-900)", textTransform:"capitalize", display:"flex", alignItems:"center", gap:"4px" }}>
                {/* Count, not the percentage that used to sit here: the two cards now say the same
                    kind of thing, and the total they are out of is the badge two rows down. The
                    percentage moved into this card's tooltip. */}
                {bucket === "evening" || bucket === "night" ? <MoonIconSm /> : <SunIconSm />} {bucket}
                <span style={{ marginLeft:"auto", fontWeight:800, color:"var(--primary-400)" }}>{bucketCount}</span>
              </p>
            </button>
          </div>
          {/* Dashed rules run from each timestamp to the badge, so the count reads as belonging to
              the span between them rather than as a third, unrelated statistic parked in the
              middle. "129 FRAMES" on its own didn't say 129 of what, over what.

              Seconds are dropped from these two stamps to buy the rules room — at 460px the words,
              two full timestamps and the badge left nothing between them. The exact second of the
              first sighting isn't a summary-level fact anyway; the frame rows below carry it. */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px" }}>
            <span style={{ color:"var(--gray-400)", whiteSpace:"nowrap" }}>{t.first} <strong style={{ color:"var(--gray-900)", fontWeight:700 }}>{firstSeen.date} {firstSeen.time.slice(0, 5)}</strong></span>
            <span style={{ flex:1, minWidth:"12px", height:0, borderTop:"1px dashed var(--gray-300)" }} />
            {/* gray-700, not the link colour. This is a plain count of what falls between the two
                dates — nothing to click — and purple here competed with the heading and the two
                Peak counts that ARE clickable. (Set once already and lost when this row was
                rewritten for the dashed rules; don't reintroduce it.) */}
            <span style={{ flexShrink:0, fontSize:"9px", fontWeight:800, color:"var(--gray-700)", backgroundColor:"white",
              padding:"2px 8px", borderRadius:"999px", letterSpacing:"0.2px", whiteSpace:"nowrap" }}>
              {t.framesCount(events.length)}
            </span>
            <span style={{ flex:1, minWidth:"12px", height:0, borderTop:"1px dashed var(--gray-300)" }} />
            <span style={{ color:"var(--gray-400)", whiteSpace:"nowrap" }}>{t.last} <strong style={{ color:"var(--gray-900)", fontWeight:700 }}>{lastSeen.date} {lastSeen.time.slice(0, 5)}</strong></span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:"8px" }}>
          {/* "Event timeline" named the shape of the list, not its contents — every row here is
              one frame with both people in it, which is the whole reason the row exists. */}
          <span style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
            <PanelHeading title={t.sharedFramesHint}>{t.sharedFrames}</PanelHeading>
            {/* One legend for the whole list. It was burned into every frame, which put twelve
                identical copies of the same two words on a page — the colour-to-person mapping
                only needs stating once, and the box colours carry it from there. Out here on white
                it also stops costing the frames a corner. */}
            <span style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              {[
                { label:"TARGET", color:"var(--primary-300)" },
                { label:assocId(node), color:"var(--danger-400)" },
              ].map(l => (
                <span key={l.label} style={{ display:"flex", alignItems:"center", gap:"4px",
                  fontSize:"9px", fontWeight:800, color:"var(--gray-500)", letterSpacing:"0.2px", whiteSpace:"nowrap" }}>
                  <span style={{ width:"7px", height:"7px", borderRadius:"2px", backgroundColor:l.color, flexShrink:0 }} />
                  {l.label}
                </span>
              ))}
            </span>
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
            {/* Names the active filter and clears it. The lit card says which one is on, but not
                from down here where the count it changed is — and a count that dropped from 110
                to 66 with no label on it reads as a bug. */}
            {focusLabel && (
              <button onClick={() => { setFocus(null); setPage(1); }}
                title={t.showEveryFrame}
                style={{ display:"flex", alignItems:"center", gap:"4px", border:"none", cursor:"pointer",
                  fontSize:"9px", fontWeight:800, color:"var(--primary-400)", backgroundColor:"var(--primary-100)",
                  padding:"2px 6px", borderRadius:"999px", textTransform:"capitalize", whiteSpace:"nowrap" }}>
                {focusLabel}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <span style={{ fontSize:"10px", fontWeight:600, color:"var(--gray-400)", whiteSpace:"nowrap" }}>{t.pageRange(pageStart + 1, pageStart + pageRows.length, shown.length)}</span>
          </span>
        </div>
      </div>

      {/* The band that actually scrolls. minHeight:0 is what lets it: without it a flex child
          refuses to shrink below its content, so the frames would push the pager off the panel
          again no matter what overflow says. */}
      <div ref={listRef} className="vca-hide-scrollbar" style={{ flex:1, minHeight:0, overflowY:"auto",
        padding:"12px 20px 20px", display:"grid", gridTemplateColumns:`repeat(${LIST_COLS}, 1fr)`,
        columnGap:`${LIST_COL_GAP}px`, rowGap:`${FRAME_ROW_GAP}px`, alignContent:"start" }}>
        {pageRows.map((e, i) => {
          const rowIdx = pageStart + i;
          return (
            /* The cell IS the frame — no accordion, no card, no rule between cells. An associate
               co-appearance is a shared frame, so there is always one to show; the boxes are the
               only thing that says where each person stood, and the frames are already the
               strongest edges on the page, so any border drawn around them is a second one.
               Scene still is the one Best Frame uses for its camera feeds. */
            <button key={rowIdx} onClick={() => setZoomIdx(rowIdx)}
              title={t.openFrameFull}
              style={{ position:"relative", padding:0, border:"none", borderRadius:"6px", overflow:"hidden",
                backgroundColor:"var(--gray-900)", cursor:"zoom-in", display:"block", width:"100%" }}>
              <img src={e.scene} alt="" style={{ width:"100%", aspectRatio:"1194 / 685", objectFit:"cover", display:"block" }} />
              {/* Burned into the frame, the way a camera stamps its own still — the caption
                  belongs to the image, and pulling it out left every cell with a line of text
                  that only described the picture under it. The camera code is gone from here: at
                  a two-up cell it pushed the place name off the chip, and the place is the part
                  an operator reads. Date is trimmed to MM-DD for the same reason. */}
              <span style={{ position:"absolute", top:4, left:4, display:"flex", alignItems:"center", gap:"4px",
                maxWidth:"calc(100% - 8px)", fontSize:"9px", fontWeight:700, color:"white",
                backgroundColor:"rgba(14,22,42,0.65)", padding:"2px 5px", borderRadius:"3px",
                overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                <CameraGlyph size={10} /> {e.location}
              </span>
              {/* Bottom-LEFT now that the legend has moved out to the section heading — the two
                  chips read as one column down the frame's left edge instead of straddling it. */}
              <span style={{ position:"absolute", bottom:4, left:4, fontSize:"9px", fontWeight:700, color:"white",
                backgroundColor:"rgba(14,22,42,0.65)", padding:"2px 5px", borderRadius:"3px", whiteSpace:"nowrap" }}>
                {e.date.slice(5)} {e.time.slice(0, 5)}
              </span>
              {[
                { key:"target", color:"var(--primary-300)", left:e.boxLeft },
                { key:"assoc", color:"var(--danger-400)", left:e.boxLeft + 17 },
              ].map(box => (
                <div key={box.key} style={{ position:"absolute", left:`${box.left}%`, top:"30%", width:"14%", height:"40%",
                  border:`2px solid ${box.color}`, borderRadius:"2px" }} />
              ))}
            </button>
          );
        })}
      </div>

      {zoomIdx !== null && shown[zoomIdx] && (
        <SharedFrameLightbox
          event={shown[zoomIdx]}
          assocLabel={assocId(node)}
          index={zoomIdx}
          total={shown.length}
          onStep={d => setZoomIdx(i => Math.min(shown.length - 1, Math.max(0, (i ?? 0) + d)))}
          onClose={() => setZoomIdx(null)}
          onAnalyze={onAnalyzeFrame}
        />
      )}

      {/* Only when there is somewhere to go — a pair whose co-captures all fit on one page would
          get a lone "1" button and a border for nothing. */}
      {pageCount > 1 && (
        <div style={{ flexShrink:0, padding:"10px 20px", borderTop:BORDER }}>
          <TimelinePager page={safePage} pageCount={pageCount} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

const TIER_BADGE_META: Record<"tier1"|"tier2"|"tier3", { bg:string; text:string; label:Record<AppLanguage, string> }> = {
  tier1: { bg:"var(--danger-100)", text:"var(--danger-400)", label:{ en:"Tier 1 (red zone)", ko:"1단계 (적색 구간)" } },
  tier2: { bg:"var(--warning-200)", text:"var(--warning-500)", label:{ en:"Tier 2 (orange zone)", ko:"2단계 (주황 구간)" } },
  tier3: { bg:"var(--gray-100)", text:"var(--gray-600)", label:{ en:"Tier 3 (slate zone)", ko:"3단계 (회색 구간)" } },
};
const COCAPTURE_COLOR: Record<"tier1"|"tier2"|"tier3", string> = {
  tier1:"var(--danger-400)", tier2:"var(--gray-500)", tier3:"var(--gray-500)",
};

function DataGridView({ rows, onInspect, selectedNodeId, sortDir, onToggleSort, dateRange }: {
  rows: Array<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode }>;
  onInspect: (tier:string, node:RedfaceNode) => void;
  selectedNodeId: number|null;
  dateRange: DateRangeValue;
  /** Sorting lives on the column it sorts. It used to be a "Sort associates by" select in the
   *  filter column, offering the two directions of this one field as if they were a list of
   *  options — which is what a column header already is. */
  sortDir: "desc"|"asc";
  onToggleSort: () => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const cooccurCams = useCooccurCameras();
  const verdictOf = useRedfaceVerdicts();
  // Read after mount, not during render: same reason the portal's license countdown does it this
  // way — the clock isn't a pure input, and rendering it during the server pass would mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  return (
    /* Scrolls sideways rather than being clipped. The ten columns need 1092px (880 of fixed widths
       + 72 of gaps + 140 minimum for the name column) before the 40px of row padding, and the
       Co-capture evidence panel takes 460 of the window: at 1512 that leaves 1012 and the Action
       button — the only control in the row — was being cut off the right edge by the page's own
       overflow:hidden, exactly the way Redmap's Search button was. A table is the one place
       horizontal scrolling reads as normal, and the alternative here is hiding columns of data.
       At 1600px and up nothing scrolls. */
    <div className="vca-thin-scrollbar" style={{ width:"100%", overflowX:"auto" }}>
    <div style={{ display:"flex", flexDirection:"column", minWidth:"1132px" }}>
      <div style={{ backgroundColor:"var(--gray-50)", borderTop:"1px solid var(--gray-100)", padding:"12px 20px",
        display:"flex", gap:"8px", fontSize:"12px", fontWeight:800, color:"var(--gray-600)" }}>
        <span style={{ width:"50px", flexShrink:0 }}>{t.colRank}</span>
        <span style={{ flex:1, minWidth:"140px" }}>{t.colAssociate}</span>
        {/* Tier is derived from the co-capture count sitting right next to it, so it doesn't need
            180px and the words "Hierarchy tier & zone" to say it — a coloured number does, and the
            space it gives back pays for the three columns after it. */}
        <span style={{ width:"44px", flexShrink:0 }}>{t.colTier}</span>
        <button onClick={onToggleSort} title={t.sortByCoCaptures(sortDir === "desc")}
          style={{ width:"92px", flexShrink:0, display:"flex", alignItems:"center", gap:"4px", padding:0,
            background:"none", border:"none", cursor:"pointer", font:"inherit", color:"var(--primary-400)", textAlign:"left" }}>
          {t.colCoCaptures}
          <span style={{ display:"flex", transform: sortDir === "asc" ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
            <ChevronDownIconSm />
          </span>
        </button>
        {/* The associate's own watchlist standing. It decides which row an operator opens first,
            and it was only visible after opening one. */}
        <span style={{ width:"76px", flexShrink:0 }}>{t.colStatus}</span>
        {/* How many distinct cameras the pair was ever framed at. The most discriminating fact
            after the count itself: 12 co-captures at one camera is a shared stop or workplace, 12
            spread over six cameras is two people moving around together. Peak location alone
            can't tell those apart. */}
        <span style={{ width:"76px", flexShrink:0 }}>{t.colLocations}</span>
        {/* "Top camera node" borrowed "node" from the pyramid view, where nodes are people, not
            cameras — and "top" didn't say top by what. This is the same number the inspector panel
            calls Peak location, so it uses that name. */}
        <span style={{ width:"160px", flexShrink:0 }}>{t.colPeakLocation}</span>
        <span style={{ width:"118px", flexShrink:0 }}>{t.colPeakTime}</span>
        {/* First and Last were two 150px columns of full timestamps to state one range. Dates
            alone carry the span, and what the two dates never said out loud was how long ago the
            last one was — which is the part that decides whether this pairing is live. */}
        <span style={{ width:"168px", flexShrink:0 }}>{t.colSpan}</span>
        <span style={{ width:"96px", flexShrink:0, textAlign:"center" }}>{t.colAction}</span>
      </div>
      {rows.map((r, i) => {
        const badge = TIER_BADGE_META[r.tier];
        // Derived from the exact same buildCooccurEvents/groupCooccurEvents call the Joint
        // Evidence Inspector panel uses for this node — previously this row pulled its dates from
        // an unrelated 3-entry JOINT_EVENT_DATES pool (keyed only by node.id % 3) while the panel
        // computed its own independently-seeded sample, so the two views could show different
        // "Last detected" dates for the SAME associate.
        const events = cooccurEventsInRange(r.node, cooccurCams, dateRange);
        const groups = groupCooccurEvents(events);
        const topGroup = groups[0];
        const sortedByDate = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        const firstSeen = sortedByDate[0];
        const lastSeen = sortedByDate[sortedByDate.length - 1];
        const statusBadge = STATUS_BADGE_META[r.node.status];
        const { bucket, count: bucketCount } = dominantTimeBucket(events);
        return (
          <div key={`${r.tier}-${r.node.id}`} style={{ backgroundColor: i === 0 ? "var(--primary-100)" : "white", borderTop:BORDER,
            // Same rule as the pyramid: a false positive stays in the list, dimmed. See the note
            // there for why it is not removed.
            opacity: verdictOf(r.node.id) === "false_positive" ? 0.45 : 1,
            padding:"10px 20px", display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ width:"50px", flexShrink:0, fontSize:"12px", fontWeight:700, color:"var(--gray-500)" }}>{`#${String(i+1).padStart(2,"0")}`}</span>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
              <img src={r.node.face} alt="" style={{ width:"28px", height:"28px", borderRadius:"999px", objectFit:"cover", flexShrink:0 }} />
              <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)", whiteSpace:"nowrap" }}>{t.associateNo(String(i+1).padStart(2,"0"))}</span>
              {/* Somebody's call, where the row is read — so a shift arriving at this list can see
                  what has already been decided without opening each pair's evidence. */}
              {verdictOf(r.node.id) && (
                <span style={{ fontSize:"9px", fontWeight:800, whiteSpace:"nowrap", padding:"2px 6px", borderRadius:"4px",
                  color: verdictOf(r.node.id) === "confirmed" ? "var(--success-400)" : "var(--danger-400)",
                  backgroundColor: verdictOf(r.node.id) === "confirmed" ? "var(--success-100)" : "var(--danger-100)" }}>
                  {verdictOf(r.node.id) === "confirmed" ? t.confirmed : t.excluded}
                </span>
              )}
            </div>
            <div style={{ width:"44px", flexShrink:0 }}>
              <span title={badge.label[lang]} style={{ fontSize:"11px", fontWeight:800, color:badge.text, backgroundColor:badge.bg,
                padding:"2px 8px", borderRadius:"999px", cursor:"help" }}>{r.tier.slice(-1)}</span>
            </div>
            {/* Same rule as the pyramid badge: what the filter left, not the whole history. */}
            <span style={{ width:"92px", flexShrink:0, fontSize:"13px", fontWeight:700, color:COCAPTURE_COLOR[r.tier] }}>{events.length}</span>
            <div style={{ width:"76px", flexShrink:0 }}>
              <span style={{ fontSize:"10px", fontWeight:800, color:statusBadge.text, backgroundColor:statusBadge.bg,
                padding:"2px 6px", borderRadius:"4px", letterSpacing:"0.2px" }}>{lang === "ko" ? attr(r.node.status, lang) : r.node.status.toUpperCase()}</span>
            </div>
            <span style={{ width:"76px", flexShrink:0, fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{groups.length}</span>
            <span style={{ width:"160px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"var(--gray-900)" }}>{`${topGroup.location} · ${topGroup.events.length}`}</span>
            <span style={{ width:"118px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"var(--gray-900)", textTransform:"capitalize" }}>{`${bucket} · ${bucketCount}`}</span>
            <span style={{ width:"168px", flexShrink:0, fontSize:"12px", fontWeight:600, color:"var(--gray-500)", display:"flex", gap:"6px", whiteSpace:"nowrap" }}>
              {firstSeen.date.slice(5)} → {lastSeen.date.slice(5)}
              {/* Elapsed is blank until mounted rather than computed during render — the clock is
                  not a pure input, and a server/client mismatch here would flip the one value on
                  the row that changes by itself. */}
              {nowMs !== null && (
                <span style={{ color:"var(--gray-400)" }}>({t.agoOf(formatElapsed(nowMs - parseSgtStamp(lastSeen.date, lastSeen.time).getTime(), lang))})</span>
              )}
            </span>
            {/* "Inspect" named an activity, not a destination — it opens the Co-capture evidence
                panel, whose content is this pair's shared frames, so that is what it says. The
                button also toggles that panel shut, and the old label read the same either way:
                only its fill changed, which tells you a state exists but not which one. */}
            <div style={{ width:"96px", flexShrink:0, display:"flex", justifyContent:"center" }}>
              <button onClick={() => onInspect(r.tier, r.node)} style={{ padding:"4px 10px", borderRadius:"6px", border:"none",
                backgroundColor: r.node.id === selectedNodeId ? "var(--primary-400)" : "var(--gray-900)", color:"white", cursor:"pointer",
                fontSize:"12px", fontWeight:700, whiteSpace:"nowrap" }}>
                {r.node.id === selectedNodeId ? t.close : t.viewFrames}
              </button>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
function AssociateGraphView({ primaryTarget, onSwitchTarget, onGoAnalyzeFrame }: {
  primaryTarget:{ name:string; face:string } | null; onSwitchTarget:()=>void;
  onGoAnalyzeFrame?: (location: string, at?: { date: string; time: string }) => void;
}) {
  const [lang] = useLanguage();
  const t = T[lang];
  const cooccurCams = useCooccurCameras();
  const [tier1On, setTier1On] = useState(true);
  const [tier2On, setTier2On] = useState(true);
  const [tier3On, setTier3On] = useState(true);
  const [view, setView] = useState<"pyramid"|"grid">("pyramid");
  const [selectedNode, setSelectedNode] = useState<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode } | null>(null);
  const toggleSelectedNode = (tier: string, node: RedfaceNode) =>
    setSelectedNode(prev => prev && prev.node.id === node.id ? null : { tier: tier as "tier1"|"tier2"|"tier3", node });
  /**
   * Removed 2026-09-10: a Set of excluded node ids that nothing wrote to.
   *
   * It backed an "Exclude false positive" action in the joint-evidence panel, and that panel's
   * exclude entry point is gone — so the state, its reset, and the filter that read it were all
   * running for nobody. Dead state is worse than no state: the next person reads it as a working
   * feature and threads new code through it.
   *
   * When RedFace gets a judgement action back, it should not come back here. Redmap's calls now
   * live in the store as DetectionJudgement records with a verdict, an operator and a timestamp —
   * pass `surface: "redface"` and the node id and the same slice holds these too. Component state
   * is what made the Redmap version worthless: it vanished on the next search and named nobody.
   */
  // Compared during render, not reset from an effect: an effect would render one frame of the new
  // target's graph still carrying the previous target's open panel.
  const [prevPrimaryName, setPrevPrimaryName] = useState(primaryTarget?.name);
  if (primaryTarget?.name !== prevPrimaryName) {
    setPrevPrimaryName(primaryTarget?.name);
    setSelectedNode(null);
  }
  // Recomputed only when the Primary Target actually changes — same person always reproduces the
  // same associate graph, but switching to someone else now genuinely changes who's in it instead
  // of only updating the header photo/name above a graph that never moved.
  // Only the name actually feeds the seed — depending on the whole primaryTarget object would
  // recompute (and reshuffle every associate's face/count) on every parent re-render, since it's
  // passed down as a fresh object literal each time even when the same person is still selected.
  const { tier1: REDFACE_TIER1, tier2: REDFACE_TIER2, tier3: REDFACE_TIER3 } = useMemo(
    () => buildRedfaceTiers(primaryTarget ? redfaceSeedFromName(primaryTarget.name) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryTarget?.name]
  );

  const [sortDir, setSortDir] = useState<"desc"|"asc">("desc");


  // Reuses buildCooccurEvents' own dates rather than a separate fabricated "last activity" field —
  // a node passes the filter if ANY of its sampled co-capture events fall inside the range.
  const [dateRange, setDateRange] = useState<DateRangeValue>(DEFAULT_REDFACE_RANGE);
  const inDateRange = (n: RedfaceNode) => cooccurEventsInRange(n, cooccurCams, dateRange).length > 0;
  const sortNodes = (nodes: RedfaceNode[]) => [...nodes].sort((a, b) => sortDir === "desc" ? b.count - a.count : a.count - b.count);

  const tier1 = sortNodes(REDFACE_TIER1.filter(inDateRange));
  const tier2 = sortNodes(REDFACE_TIER2.filter(inDateRange));
  const tier3 = sortNodes(REDFACE_TIER3.filter(inDateRange));
  const reset = () => { setTier1On(true); setTier2On(true); setTier3On(true); setSortDir("desc"); setDateRange(DEFAULT_REDFACE_RANGE); };

  // No primary target yet means there's nobody to compute co-occurrence against — the tier
  // filter counts/toggles in the sidebar still describe the dataset, but the canvas itself has
  // nothing real to plot, so it renders the same empty zone bands as the Figma "before search"
  // landing state instead of dots that don't actually belong to anyone.
  // Once a primary target is set, Min. co-occurrences (or Date range/Exclude) can filter a tier
  // down to zero nodes — that tier's zone band used to keep rendering at full weighted height
  // with nothing in it, reading as broken empty space rather than "nothing here anymore." Only
  // the pre-search landing state (no primaryTarget) still shows every toggled-on tier as an empty
  // band on purpose (see comment above) — that placeholder case is left alone.
  // Zone height follows how many ROWS of nodes a zone actually draws — not how many nodes it
  // holds, and not the fixed 2.2/2.6/3.4 the tiers used to carry. Two nodes and six nodes both lay
  // out as one horizontal row, so they need identical height; weighting by count made Tier 2 half
  // again as tall as Tier 1 with nothing on screen to justify it, just more empty band above and
  // below a single row of faces. Only the staggered tier splits its nodes over two lines, and that
  // is the one that needs the room. Recomputed per render, so it keeps tracking as tiers are
  // toggled or the date range narrows a tier down to a single node.
  const zoneRows = (count: number, stagger: boolean) => (stagger && count > 1 ? 2 : 1);
  // Base covers the zone label and its padding; the per-row term covers a 52px node plus its
  // count badge and breathing room.
  const zoneWeight = (count: number, meta: TierMeta) => 1 + zoneRows(count, !!meta.stagger) * 0.9;
  const visibleRows: PyramidRow[] = [
    { key:"apex", weight:1.3, nodes:[], meta:null },
    ...(tier1On && (!primaryTarget || tier1.length > 0) ? [{ key:"tier1", weight:zoneWeight(primaryTarget ? tier1.length : 0, PYRAMID_TIER_META.tier1), nodes: primaryTarget ? tier1 : [], meta:PYRAMID_TIER_META.tier1 }] : []),
    ...(tier2On && (!primaryTarget || tier2.length > 0) ? [{ key:"tier2", weight:zoneWeight(primaryTarget ? tier2.length : 0, PYRAMID_TIER_META.tier2), nodes: primaryTarget ? tier2 : [], meta:PYRAMID_TIER_META.tier2 }] : []),
    ...(tier3On && (!primaryTarget || tier3.length > 0) ? [{ key:"tier3", weight:zoneWeight(primaryTarget ? tier3.length : 0, PYRAMID_TIER_META.tier3), nodes: primaryTarget ? tier3 : [], meta:PYRAMID_TIER_META.tier3 }] : []),
  ];
  const hasVisibleTier = tier1On || tier2On || tier3On;
  const gridRows: Array<{ tier:"tier1"|"tier2"|"tier3"; node:RedfaceNode }> = !primaryTarget ? [] : [
    ...(tier1On ? tier1.map(node => ({ tier:"tier1" as const, node })) : []),
    ...(tier2On ? tier2.map(node => ({ tier:"tier2" as const, node })) : []),
    ...(tier3On ? tier3.map(node => ({ tier:"tier3" as const, node })) : []),
  ];

  const tierRows = [
    { on:tier1On, toggle:() => setTier1On(o => !o), bg:"var(--danger-100)", text:"var(--danger-400)", short:"Tier 1", label:"Tier 1 red zone (>100)", count:REDFACE_TIER1.length, badgeBg:"var(--danger-400)" },
    { on:tier2On, toggle:() => setTier2On(o => !o), bg:"var(--warning-100)", text:"var(--warning-500)", short:"Tier 2", label:"Tier 2 orange zone (10~99)", count:REDFACE_TIER2.length, badgeBg:"var(--warning-400)" },
    { on:tier3On, toggle:() => setTier3On(o => !o), bg:"var(--gray-100)", text:"var(--gray-700)", short:"Tier 3", label:"Tier 3 slate zone (<10)", count:REDFACE_TIER3.length, badgeBg:"var(--gray-600)" },
  ];

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

      <div className="vca-hide-scrollbar" style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto" }}>
        <div style={{ backgroundColor:"white", borderBottom:BORDER, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            {primaryTarget && (
              <>
                <img src={primaryTarget.face} alt="" style={{ width:"44px", height:"44px", borderRadius:"6px", objectFit:"cover", border:"2px solid var(--primary-400)" }} />
                <div>
                  <span title={t.primaryTargetHint} style={{ display:"inline-flex", fontSize:"10px", fontWeight:800, color:"white", backgroundColor:"var(--primary-400)", padding:"2px 6px", borderRadius:"4px", letterSpacing:"-0.2px", cursor:"help" }}>{t.primaryTarget}</span>
                  <p style={{ fontSize:"14px", fontWeight:800, color:"var(--gray-900)", margin:"4px 0 0", letterSpacing:"-0.28px" }}>{primaryTarget.name}</p>
                </div>
                <button onClick={onSwitchTarget} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 12px",
                  borderRadius:"6px", backgroundColor:"var(--gray-100)", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:600, color:"var(--gray-600)" }}>
                  <SwapIconSm /> {t.switchPrimary}
                </button>
              </>
            )}
          </div>
          {/* Filters share the target's row rather than taking one of their own — a second bar cost
              the graph another 50px of height, and this row had space to spare once the 280px
              filter column came out. These were four controls in that column, three of which
              belonged elsewhere: sorting on the grid's own column header, the date range on a
              toolbar like every other tab's, and a "min co-captures" stepper that duplicated the
              tier cutoffs it sat under (>100 / 10-99 / <10). The tiers are the one filter this
              screen genuinely needs — 15 of 23 associates are Tier 3 — so they stay, as chips. */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
            {tierRows.map(row => (
              <button key={row.short} onClick={row.toggle} title={row.label} style={{
                display:"flex", alignItems:"center", gap:"6px", height:"30px", padding:"0 10px", borderRadius:"999px",
                backgroundColor: row.on ? row.bg : "white", border: row.on ? "none" : BORDER, cursor:"pointer", flexShrink:0,
              }}>
                <span style={{ fontSize:"12px", fontWeight:700, color: row.on ? row.text : "var(--gray-400)", whiteSpace:"nowrap" }}>{row.short}</span>
                <span style={{ fontSize:"10px", fontWeight:800, color:"white", backgroundColor: row.on ? row.badgeBg : "var(--gray-300)", padding:"1px 6px", borderRadius:"999px" }}>{row.count}</span>
              </button>
            ))}
            {/* Boxed to a fixed width: the trigger's own style is flex:1, which in a row of chips
                grows it to the full line and pushes everything after it onto the next one. 212px
                fits a full "2026.09.29 – 2026.10.19" — at 172px the text ran past the box and over
                the reset button beside it. */}
            <div style={{ width:"212px", display:"flex", flexShrink:0 }}>
              <DateRangeTrigger value={dateRange} onApply={setDateRange} mode="merged" size="sm" emptyText={t.allDates} />
            </div>
            <button onClick={reset} title={t.resetFilters} style={{ display:"flex", alignItems:"center", gap:"6px",
              height:"30px", padding:"0 10px", borderRadius:"6px", border:BORDER, backgroundColor:"white", cursor:"pointer",
              fontSize:"12px", fontWeight:600, color:"var(--gray-600)", flexShrink:0, whiteSpace:"nowrap" }}>
              <ResetIconSm /> Reset
            </button>
          </div>
          <div style={{ display:"flex", gap:"2px", backgroundColor:"var(--gray-100)", borderRadius:"8px", padding:"4px" }}>
            {(["pyramid","grid"] as const).map(v => {
              const active = view === v;
              return (
                <button key={v} onClick={() => setView(v)} title={v === "pyramid" ? t.viewPyramid : t.viewGrid} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px",
                  borderRadius:"6px", border:"none", cursor:"pointer",
                  backgroundColor: active ? "white" : "transparent", color: active ? "var(--gray-900)" : "var(--gray-500)",
                  fontSize:"12px", fontWeight: active ? 700 : 600 }}>
                  {v === "pyramid" ? <LayersIconSm/> : <TableIconSm/>} {v === "pyramid" ? t.pyramidAndZone : t.dataGrid}
                </button>
              );
            })}
          </div>
        </div>

        {view === "pyramid" ? (
          hasVisibleTier ? (
            <PyramidCanvas primaryTarget={primaryTarget} rows={visibleRows}
              selectedNodeId={selectedNode?.node.id ?? null}
              dateRange={dateRange}
              onNodeClick={toggleSelectedNode} />
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gray-400)", fontSize:"13px", fontWeight:600 }}>
              {t.noTiersSelected}
            </div>
          )
        ) : (
          hasVisibleTier ? (
            <DataGridView rows={gridRows} selectedNodeId={selectedNode?.node.id ?? null} onInspect={toggleSelectedNode}
              dateRange={dateRange}
              sortDir={sortDir} onToggleSort={() => setSortDir(d => d === "desc" ? "asc" : "desc")} />
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--gray-400)", fontSize:"13px", fontWeight:600 }}>
              {t.noTiersSelected}
            </div>
          )
        )}
      </div>

      {/* selectedNode can only be set by clicking a rendered node, and nodes only render once a
          primaryTarget exists (see visibleRows above), so primaryTarget is guaranteed here too. */}
      {selectedNode && primaryTarget && (
        <JointEvidencePanel primary={primaryTarget} tier={selectedNode.tier} node={selectedNode.node}
          dateRange={dateRange}
          onAnalyzeFrame={onGoAnalyzeFrame}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function RedFaceContent({ seedCard, seedLabel, onSeedConsumed, onGoAnalyzeFrame }: {
  seedCard?: (typeof REID_DATA)[number] | null; seedLabel?: string | null; onSeedConsumed?: () => void;
  onGoAnalyzeFrame?: (location: string, at?: { date: string; time: string }) => void;
} = {}) {
  const [lang] = useLanguage();
  const t = T[lang];
  // RedFace is face search, so the whole tab is gated rather than a button inside it.
  //
  // The search sidebar checked this and disabled its Search button; this tab never did, and its
  // target picker opens on mount — so an account with search taken away could still pick a face
  // here and get an association network out of it. Gating the button was gating one of two doors.
  // Same reading as Redmap: a screen that only exists to show search results has nothing to show
  // without the permission.
  const portalUsers = useVcaStore(state => state.portalUsers);
  const searchAllowed = canSearchInApp(portalUsers);
  const [primaryTarget, setPrimaryTarget] = useState<{ name:string; face:string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);
  // "UNSET" (not seedCard's own initial value) so the block below still fires on this
  // component's very first render even when seedCard is ALREADY set at mount time — this tab
  // mounts fresh on every deep-link (it doesn't exist until activeTab switches to it), so
  // seeding it from "the previous seedCard" would just equal the incoming one and never fire.
  const [prevSeedCard, setPrevSeedCard] = useState<typeof seedCard | "UNSET">("UNSET");

  // Named by what is actually known: a Recent target or VIP pick brings its own name, and a crop
  // chosen from the candidate grid is called by its object id. Every primary target used to be
  // labelled "Suspect #1" regardless — a designation nothing in the app supports, applied to
  // whoever happened to be searched for.
  const handleConfirm = (c: RedfaceCandidate) => {
    setPrimaryTarget({ name: c.label ?? `TS${String(c.id).padStart(6, "0")}`, face:c.url });
    setPickerOpen(false);
  };

  // "Make primary" from the Joint Evidence panel — promotes the associate node itself into the
  // new Primary Target, so the whole graph recomputes around them instead of just relabeling the
  // header photo. Reuses the same assocId() the panel already displays for that node, so the
  // person the investigator just saw stays the same identifier after the switch.
  // Deep-link from a Live Monitoring card's "RedFace" hover button — skip the picker and go
  // straight to this person as the confirmed primary target. Uses the card's full photo (url),
  // not its unrelated `face` stock-photo field, so the "same person" stays visually consistent.
  if (seedCard !== prevSeedCard) {
    setPrevSeedCard(seedCard);
    if (seedCard) {
      // The caller's own name for this person wins. Only when it has none do we fall back to the
      // row's status/id, which is all this component can see on its own.
      const label = seedLabel ?? (seedCard.status === "VIP" ? "VIP Match" : `TS${String(seedCard.id).padStart(6, "0")}`);
      setPrimaryTarget({ name: label, face: seedCard.url });
      setPickerOpen(false);
    }
  }
  useEffect(() => {
    if (seedCard) onSeedConsumed?.();
  }, [seedCard, onSeedConsumed]);

  if (!searchAllowed) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", backgroundColor: "var(--gray-50)" }}>
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.36px" }}>
            {t.noRedFaceTitle}
          </p>
          <p style={{ margin: "10px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", lineHeight: 1.7 }}>
            {t.noRedFaceBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", backgroundColor:"var(--gray-50)", overflow:"hidden" }}>
      {/* Renders even before a target is picked — this is the "before search" landing state
          (empty zone bands, filter sidebar, no primary-target header) that sits behind the blur
          while the picker is open, instead of a bare empty page. */}
      <AssociateGraphView primaryTarget={primaryTarget} onSwitchTarget={() => setPickerOpen(true)}
        onGoAnalyzeFrame={onGoAnalyzeFrame} />
      {pickerOpen && (
        // backdropFilter/backgroundColor live on the scrolling container itself now, not on a
        // separate inset:0 sibling sized to just one screen's height — that sibling stayed pinned
        // to the wrapper's own fixed box while the modal+padding below it (6vh top + up to 92vh
        // modal + 24px bottom, which alone already exceeds 100vh) pushed the wrapper into
        // scrolling, so scrolling down ran past the tinted/blurred box into plain page background.
        // A background-color painted on the scrolling element itself extends across its full
        // scrollable content, however tall that turns out to be.
        <div
          onClick={e => { if (e.target === e.currentTarget && primaryTarget) setPickerOpen(false); }}
          style={{ position:"absolute", inset:0, zIndex:50, overflow:"auto",
            backdropFilter:"blur(9px)", backgroundColor:"rgba(14, 22, 42,0.4)" }}
        >
          <div style={{ minHeight:"100%", boxSizing:"border-box", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px", paddingTop:"6vh" }}>
            <PrimaryTargetPickerModal onConfirm={handleConfirm} onCancel={() => primaryTarget && setPickerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab icons ──────────────────────────────────────────────────
export const TAB_ICONS: Record<DataTab, React.ReactNode> = {
  "Live Monitoring": (
    // viewBox is 24 units (lucide's native size) while the sibling tab icons below use a 16-unit
    // viewBox at the same 15px render size — same nominal strokeWidth=1 would end up ~35% thinner
    // here once scaled (15/24 vs 15/16), so this compensates to land on the same rendered
    // thickness as the others instead of just copying their "1".
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  "Re-ID Analysis": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.6665 4H10.6665C11.0201 4 11.3593 4.14048 11.6093 4.39052C11.8594 4.64057 11.9998 4.97971 11.9998 5.33333V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12H5.33333C4.97971 12 4.64057 11.8595 4.39052 11.6095C4.14048 11.3594 4 11.0203 4 10.6667V6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "RedFace": (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13.5609 4.32275C14.2801 5.40986 14.6649 6.68395 14.6676 7.98743C14.6703 9.2909 14.2908 10.5666 13.5761 11.6566C12.8613 12.7467 11.8427 13.6033 10.6463 14.1206C9.4498 14.6378 8.12795 14.7929 6.84424 14.5668" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.43921 11.6774C1.72001 10.59 1.33541 9.31562 1.33302 8.01191C1.33063 6.7082 1.71054 5.4324 2.42575 4.34238C3.14096 3.25236 4.16008 2.39597 5.35698 1.87917C6.55389 1.36237 7.87606 1.20786 9.15988 1.43474" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6668 4.66667C13.4032 4.66667 14.0002 4.06971 14.0002 3.33333C14.0002 2.59695 13.4032 2 12.6668 2C11.9304 2 11.3335 2.59695 11.3335 3.33333C11.3335 4.06971 11.9304 4.66667 12.6668 4.66667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.33333 14.0002C4.06971 14.0002 4.66667 13.4032 4.66667 12.6668C4.66667 11.9304 4.06971 11.3335 3.33333 11.3335C2.59695 11.3335 2 11.9304 2 12.6668C2 13.4032 2.59695 14.0002 3.33333 14.0002Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Main DataPage ──────────────────────────────────────────────
// Smart Search isn't its own top-level tab anymore — it lives inside Live Monitoring (see
// LiveMonitoringTab), matching how Re-ID Analysis/RedFace each keep their own search UI embedded
// in place rather than sending the operator to a separate destination to search from.
const DATA_TABS: DataTab[] = ["Live Monitoring", "Re-ID Analysis", "RedFace"];
// "RedFace" doesn't say what it does on its own — a first-time viewer has no way to guess this
// is a co-occurrence/associate-finder feature just from the tab label.
const DATA_TAB_TOOLTIPS: Partial<Record<DataTab, keyof typeof T.en>> = {
  "RedFace": "redfaceTooltip",
};
// The tab ids are route slugs and store values, so only the label changes.
const DATA_TAB_LABEL: Partial<Record<DataTab, keyof typeof T.en>> = {
  "Live Monitoring": "tabLiveMonitoring",
  "Re-ID Analysis": "tabReid",
  "RedFace": "tabRedface",
};
export default function DataPage({ onGoRedmap, onGoRedmapFrame, onGoAnalyzeFrame }: { onGoRedmap?: () => void; onGoRedmapFrame?: (url: string, label: string) => void; onGoAnalyzeFrame?: (location: string, at?: { date: string; time: string }) => void } = {}) {
  const [lang] = useLanguage();
  const t = T[lang];
  // Always lands on Live Monitoring — deliberately not persisted, unlike Best Frame's
  // camera selection. Switching sub-tabs while on this screen is normal component state;
  // leaving Data and coming back should start fresh at Live Monitoring.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DataTab>(() => {
    // A slug this screen does not render is not a destination. Kept as a guard rather than
    // trusting the slug table to stay in step with DATA_TABS: when they disagreed, ?sub=search
    // selected a tab that renders nothing — three inactive tab buttons over a blank body, and the
    // URL was left alone because the mirror effect below saw it as already correct.
    const fromSlug = DATA_TAB_BY_SLUG[searchParams.get("sub") ?? ""];
    return fromSlug && DATA_TABS.includes(fromSlug) ? fromSlug : "Live Monitoring";
  });
  // Mirrored into the URL from an effect rather than from inside the setter: one caller runs
  // DURING render (a seeded card's tab jump compares during render), and a router.replace() from
  // there is a side effect in the wrong phase. The guard means this only
  // fires when the two actually disagree, so it can't loop on its own href change.
  useEffect(() => {
    const slug = DATA_TAB_SLUGS[activeTab];
    if (searchParams.get("sub") === slug) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("sub", slug);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [activeTab, searchParams, pathname, router]);
  // Carries a Live Monitoring card's data into whichever tab its hover-action button targets,
  // so that tab lands on real results for that person instead of a bare, empty search form.
  const [seedCard, setSeedCard] = useState<(typeof REID_DATA)[number] | null>(null);
  // The name the source screen already knows for that person ("Mina", "TS017323"). Without it
  // RedFace can only re-derive a label from the row's status and id, which throws away a real
  // identity the Re-ID cluster was already displaying.
  const [seedLabel, setSeedLabel] = useState<string | null>(null);
  const handleNavigateFromCard = (tab: DataTab, card: (typeof REID_DATA)[number], label?: string) => {
    setSeedCard(card);
    setSeedLabel(label ?? null);
    setActiveTab(tab);
  };

  // Both pickers now name the same cameras (CAMERA_CODES), so a specific code IS meaningful in
  // either tab. What still differs is only the "no filter" sentinel — Live Monitoring uses
  // ALL_CAMERAS_ID for "show every feed", Re-ID uses "" for "no camera filter" — so that one state
  // is translated between them. A specific pick stays local on purpose: switching tabs to compare
  // the same camera is a deliberate act, and silently carrying a filter across would change what
  // the other tab was showing without being asked.
  const [liveCam, setLiveCamRaw] = useState<string>(ALL_CAMERAS_ID);
  const [reidCam, setReidCamRaw] = useState<string>("");
  const setLiveCam = (v: string) => { setLiveCamRaw(v); if (v === ALL_CAMERAS_ID) setReidCamRaw(""); };
  const setReidCam = (v: string) => { setReidCamRaw(v); if (v === "") setLiveCamRaw(ALL_CAMERAS_ID); };
  // Back to "every camera" when the header switches site. A code names a camera at one site, so
  // the code held here after a switch names nothing: the picker went on showing CAM-NOV-001 as
  // the open feed while the ONLINE badge, the IP line and every card were gone, with nothing on
  // screen to say why.
  const siteProjectId = useActiveProjectId();
  const firstCamSiteRef = useRef(true);
  useEffect(() => {
    if (firstCamSiteRef.current) { firstCamSiteRef.current = false; return; }
    setLiveCamRaw(ALL_CAMERAS_ID);
    setReidCamRaw("");
  }, [siteProjectId]);



  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor:"var(--gray-50)" }}>

      {/* Sub-nav tabs */}
      <div style={{ backgroundColor:"white", borderBottom:BORDER, display:"flex", alignItems:"center", padding:"0 20px", height:"46px", flexShrink:0 }}>
        {DATA_TABS.map(tab => {
          const active = activeTab===tab;
          const tipKey = DATA_TAB_TOOLTIPS[tab];
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} title={tipKey ? (t[tipKey] as string) : undefined} style={{ height:"100%", padding:"0 18px", background:"none", border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", gap:"6px",
              borderBottom: active?"2px solid var(--gray-900)":"2px solid transparent",
              color: active?"var(--gray-900)":"var(--gray-500)",
              fontWeight: 600,
              fontSize:"13px", letterSpacing:"-0.26px", transition:"color 0.15s" }}>
              {TAB_ICONS[tab]}
              {(t[DATA_TAB_LABEL[tab] ?? "tabLiveMonitoring"] as string)}
            </button>
          );
        })}
      </div>

      {activeTab==="Live Monitoring" && <LiveMonitoringTab openCam={liveCam} onOpenCamChange={setLiveCam} onNavigateTab={handleNavigateFromCard} onGoRedmap={onGoRedmap} onGoRedmapFrame={onGoRedmapFrame} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {activeTab==="Re-ID Analysis"   && <ReIDContent camera={reidCam} onCameraChange={setReidCam} seedCard={seedCard} onSeedConsumed={() => setSeedCard(null)} onNavigateTab={handleNavigateFromCard} onGoRedmap={onGoRedmap} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
      {activeTab==="RedFace"          && <RedFaceContent seedCard={seedCard} seedLabel={seedLabel} onSeedConsumed={() => { setSeedCard(null); setSeedLabel(null); }} onGoAnalyzeFrame={onGoAnalyzeFrame} />}
    </div>
  );
}
