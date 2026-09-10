"use client";

import { useEffect, useRef, useState } from "react";
import CameraImportModal from "./CameraImportModal";
import { CircleAlert, Film as FilmIcon, Image as ImageIcon, RotateCw, ShieldCheck, Video as VideoIcon, VideoOff } from "lucide-react";
import { useVcaStore, projectChannelLimit, type Camera, type CameraStatus, type UploadedMedia, type UploadStatus, SIGNED_IN_USER } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { CARD_BORDER, CARD_RADIUS, BORDER, TABLE_COLUMN_GAP, CONTROL_HEIGHT, PANEL_SHADOW, FIELD_STYLE, FIELD_FOCUS, RowActionsMenu, FilterSelect, TextField, SortableHeader, SummaryStrip, sortRows, useTableSort, ActiveFilterCount, usePortalEditAccess, ConfirmModal } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

const T = {
  en: {
    exportCsv: "Export CSV",
    importCsv: "Import CSV",
    refresh: "Refresh",
    checkedJustNow: "checked just now",
    checkedMinsAgo: (n: number) => `checked ${n} min ago`,
    addCamera: "Add camera",
    online: "Online",
    offline: "Offline",
    statusError: "Error",
    atLimitReason: (limit: number) => `All ${limit} licensed channels are in use. Raising the limit is a contract change — see the Licence screen.`,
    atLimitBanner: (limit: number) => `All ${limit} licensed channels are in use. No further source can be connected until the limit is raised.`,
    noLicenceReason: "No channel count is recorded for this project, so there is nothing to connect against. A channel count arrives with the licence.",
    noLicenceBanner: "This project has no licensed channel count recorded. Sources cannot be connected until it does — the count comes from the contract, not from this console.",
    zeroChannelReason: "This project's licence carries no channels. Connecting a source needs a licence with at least one.",
    zeroChannelBanner: "This project's licence carries zero channels, so no source can be connected. That is a licence to correct rather than a limit to raise.",
    errIp: "That does not look like an address.",
    errRtsp: "A stream address starts with rtsp://",
    errLat: "Latitude runs from -90 to 90.",
    errLng: "Longitude runs from -180 to 180.",
    offlineSuffix: (n: number) => `${n} offline`,
    onlineCountLabel: (n: number) => `${n} online`,
    confirmDeleteCamTitle: (name: string) => `Remove ${name}?`,
    confirmDeleteCamBody: "The camera comes off this project along with its zone, its server assignment and its place on the map. Recorded detections stay.",
    healthConnected: "connected",
    healthConnectedWhy: "Answered the last connection attempt. It says the stream is reachable, not that anything is looking at it.",
    healthOfFleet: (total: number) => `of ${total}`,
    healthOffline: "offline",
    healthOfflineWhy: "No answer at all — the address is unreachable. Usually power, cable or network rather than the camera itself.",
    healthError: "refusing the connection",
    healthErrorWhy: "The camera answered and turned us away. Almost always the wrong credentials or a stream path that has changed.",
    healthShowOnly: "Show only these",
    healthClear: "Show everything again",
    searchPlaceholder: "Search by camera name, code, RTSP URL, or IP address",
    filterAllZones: "All zones",
    filterAllStatus: "All status",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "All",
    kindTabCamera: "Cameras",
    kindTabVideo: "Videos",
    kindTabImage: "Images",
    kindTabDeepfake: "Deepfake",
    sourceDeepfake: "Deepfake check",
    verdictAuthentic: "Authentic",
    verdictManipulated: "Manipulated",
    verdictInconclusive: "Inconclusive",
    verdictScore: (n: number) => `${Math.round(n * 100)}%`,
    deepfakeFileOption: "Check a file for manipulation",
    deepfakeUploadTitle: "Deepfake check",
    deepfakeUploadHint: "MP4, MOV, JPG, PNG. Judged authentic or manipulated — this does not search the file for faces.",
    colSource: "Source",
    sourceCamera: "Camera",
    sourceVideo: "Video",
    sourceImage: "Image",
    colAddress: "Connection info",
    uploadsSuffix: (n: number) => `${n} uploaded`,
    statusPending: "Queued",
    statusAnalyzing: "Analysing",
    statusDone: "Analysed",
    statusFailed: "Failed",
    detectionsFound: (n: number) => `${n} face${n === 1 ? "" : "s"}`,
    addSource: "Add source",
    addCameraOption: "Camera (RTSP)",
    uploadFileOption: "Upload video or image",
    uploadTitle: "Upload footage",
    uploadDrop: "Drag a file here",
    uploadHint: "MP4, MOV, JPG, PNG. Analysed for faces and shown in Best Frame.",
    uploadChoose: "Choose file",
    toastUploadedTitle: "Uploaded",
    removeUploadAction: "Remove upload",
    toastUploadRemovedTitle: "Upload removed",
    emptyNoSources: "Nothing registered for this project yet.",
    gridCamerasOnly: "Grid shows cameras only — switch to Table to see uploaded footage.",
    fieldIp: "IP address",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "Model",
    fieldModelPlaceholder: "XNP-6400R",
    fieldUsername: "User ID",
    fieldUsernamePlaceholder: "Stream account",
    fieldPassword: "Password",
    fieldPasswordPlaceholder: "Stream password",
    fieldPasswordEditHint: "Leave blank to keep the current password.",
    passwordNotStoredHint: "Sent to the server with the camera and never read back — it is not kept in this browser.",
    fieldServer: "Associated server",
    fieldServerNone: "Not assigned",
    fieldLat: "Latitude",
    fieldLng: "Longitude",
    clearFilters: "Clear all filters",
    selectedCount: (n: number) => `${n} selected`,
    bulkClearSelection: "Clear selection",
    bulkMoveToZone: "Move to zone",
    bulkDelete: "Remove",
    bulkDeleteConfirm: (n: number) => `Remove ${n} camera${n === 1 ? "" : "s"}?`,
    bulkDeleteBody: "They stop being monitored immediately and their channels are freed. Recordings already made are not deleted.",
    bulkDeletedTitle: (n: number) => `${n} camera${n === 1 ? "" : "s"} removed`,
    bulkMovedTitle: (n: number, zone: string) => `${n} camera${n === 1 ? "" : "s"} moved to ${zone}`,
    selectAllLabel: "Select all rows",
    viewTable: "Table",
    viewGrid: "Grid",
    colCamera: "Camera",
    colServer: "Server",
    colResolution: "Resolution",
    colZone: "Zone",
    colRtspStream: "RTSP Stream",
    colStatus: "Status",
    emptyAll: "No cameras connected to this project yet.",
    emptyFiltered: "No cameras match these filters.",
    aiCameraBadge: "AI Camera",
    cctvBadge: "CCTV",
    toggleStatusTitle: "Toggle status",
    previewAction: "Preview stream",
    editAction: "Edit",
    removeAction: "Remove",
    addModalTitle: "Add Input Device",
    editModalTitle: "Edit Input Device",
    fieldDeviceName: "Device name *",
    fieldDeviceNamePlaceholder: "Novena",
    fieldLocation: "Location",
    fieldLocationPlaceholder: "Entrance",
    fieldZone: "Zone",
    fieldZonePlaceholder: "Front Gate",
    fieldRtspUrl: "Connection — RTSP URL *",
    fieldResolution: "Resolution",
    fieldMaker: "Maker",
    fieldStatus: "Status",
    cancel: "Cancel",
    saveChanges: "Save changes",
    addDevice: "Add device",
    confirmOfflineTitle: "Mark camera offline?",
    confirmReconnectTitle: "Reconnect camera?",
    confirmOfflineBody: (name: string) => `${name} will show as offline for everyone monitoring this project — make sure the stream is actually down before confirming.`,
    confirmReconnectBody: (name: string) => `This attempts to reconnect ${name} and marks it online. It doesn't verify the actual hardware, so if it's really still down, someone will need to mark it offline again.`,
    markOffline: "Mark offline",
    reconnect: "Reconnect",
    toastCameraAddedTitle: "Camera added",
    toastCameraAddedDesc: (name: string) => `${name} connected to this project.`,
    toastCameraUpdatedTitle: "Camera updated",
    toastReconnectedTitle: "Reconnected",
    toastDisconnectedTitle: "Disconnected",
    toastCameraRemovedTitle: "Camera removed",
    toastExportTitle: "Export complete",
    toastExportDesc: (n: number) => `${n} camera(s) exported to CSV.`,
    csvHeaderName: "Name",
    csvHeaderCode: "Code",
    csvHeaderZone: "Zone",
    csvHeaderLocation: "Location",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "Status",
  },
  ko: {
    exportCsv: "CSV 내보내기",
    importCsv: "CSV 가져오기",
    refresh: "새로고침",
    checkedJustNow: "방금 확인함",
    checkedMinsAgo: (n: number) => `${n}분 전 확인`,
    addCamera: "카메라 추가",
    online: "온라인",
    offline: "오프라인",
    statusError: "오류",
    atLimitReason: (limit: number) => `라이선스 채널 ${limit}개를 모두 쓰고 있습니다. 한도를 올리는 것은 계약 변경입니다 — 라이선스 화면을 보세요.`,
    atLimitBanner: (limit: number) => `라이선스 채널 ${limit}개를 모두 쓰고 있습니다. 한도를 올리기 전에는 소스를 더 연결할 수 없습니다.`,
    noLicenceReason: "이 프로젝트에 기록된 채널 수가 없어서, 연결의 근거가 될 값이 없습니다. 채널 수는 라이선스와 함께 들어옵니다.",
    noLicenceBanner: "이 프로젝트에는 라이선스 채널 수가 기록되어 있지 않습니다. 기록되기 전에는 소스를 연결할 수 없습니다 — 그 수는 계약에서 나오지, 이 콘솔에서 정해지지 않습니다.",
    zeroChannelReason: "이 프로젝트의 라이선스에 채널이 0개입니다. 소스를 연결하려면 채널이 있는 라이선스가 필요합니다.",
    zeroChannelBanner: "이 프로젝트의 라이선스에 채널이 0개라 소스를 연결할 수 없습니다. 한도를 올릴 문제가 아니라 라이선스를 바로잡을 문제입니다.",
    errIp: "주소 형식이 아닙니다.",
    errRtsp: "스트림 주소는 rtsp:// 로 시작합니다.",
    errLat: "위도는 -90에서 90 사이입니다.",
    errLng: "경도는 -180에서 180 사이입니다.",
    offlineSuffix: (n: number) => `${n} 오프라인`,
    onlineCountLabel: (n: number) => `온라인 ${n}`,
    confirmDeleteCamTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    confirmDeleteCamBody: "이 프로젝트에서 카메라가 빠지고, 존·서버 배정·지도 위 위치도 함께 사라집니다. 기록된 탐지는 남습니다.",
    healthConnected: "연결됨",
    healthConnectedWhy: "마지막 연결 시도에 응답했습니다. 스트림에 닿는다는 뜻이지, 누가 보고 있다는 뜻은 아닙니다.",
    healthOfFleet: (total: number) => `/ ${total}대`,
    healthOffline: "오프라인",
    healthOfflineWhy: "응답이 아예 없습니다. 주소에 닿지 않는 상태로, 대개 카메라보다 전원·케이블·네트워크 문제입니다.",
    healthError: "연결 거부",
    healthErrorWhy: "카메라가 응답은 했지만 접속을 거절했습니다. 거의 항상 계정 정보가 틀렸거나 스트림 경로가 바뀐 경우입니다.",
    healthShowOnly: "이 항목만 보기",
    healthClear: "전체 다시 보기",
    searchPlaceholder: "카메라 이름, 코드, RTSP URL, IP 주소로 검색",
    filterAllZones: "전체 구역",
    filterAllStatus: "전체 상태",
    filtersActive: (n: number) => `필터 ${n}개`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "전체",
    kindTabCamera: "카메라",
    kindTabVideo: "영상",
    kindTabImage: "이미지",
    kindTabDeepfake: "딥페이크",
    sourceDeepfake: "딥페이크 검사",
    verdictAuthentic: "진짜",
    verdictManipulated: "조작됨",
    verdictInconclusive: "판정 불가",
    verdictScore: (n: number) => `${Math.round(n * 100)}%`,
    deepfakeFileOption: "딥페이크 검사 의뢰",
    deepfakeUploadTitle: "딥페이크 검사",
    deepfakeUploadHint: "MP4, MOV, JPG, PNG. 진짜인지 조작인지 판정합니다 — 얼굴을 찾지는 않습니다.",
    colSource: "종류",
    sourceCamera: "카메라",
    sourceVideo: "영상",
    sourceImage: "이미지",
    colAddress: "연결 정보",
    uploadsSuffix: (n: number) => `업로드 ${n}건`,
    statusPending: "대기",
    statusAnalyzing: "분석 중",
    statusDone: "분석 완료",
    statusFailed: "실패",
    detectionsFound: (n: number) => `얼굴 ${n}개`,
    addSource: "소스 추가",
    addCameraOption: "카메라 (RTSP)",
    uploadFileOption: "영상·이미지 업로드",
    uploadTitle: "영상 업로드",
    uploadDrop: "여기에 파일을 놓으세요",
    uploadHint: "MP4, MOV, JPG, PNG. 얼굴을 분석해 베스트 프레임에서 볼 수 있습니다.",
    uploadChoose: "파일 선택",
    toastUploadedTitle: "업로드됨",
    removeUploadAction: "업로드 삭제",
    toastUploadRemovedTitle: "업로드가 삭제됨",
    emptyNoSources: "이 프로젝트에 등록된 소스가 없습니다.",
    gridCamerasOnly: "그리드는 카메라만 보여줍니다 — 업로드한 영상은 테이블에서 볼 수 있습니다.",
    fieldIp: "IP 주소",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "모델",
    fieldModelPlaceholder: "XNP-6400R",
    fieldUsername: "사용자 ID",
    fieldUsernamePlaceholder: "스트림 계정",
    fieldPassword: "비밀번호",
    fieldPasswordPlaceholder: "스트림 비밀번호",
    fieldPasswordEditHint: "비워두면 기존 비밀번호를 그대로 사용합니다.",
    passwordNotStoredHint: "카메라와 함께 서버로 전송되며 다시 읽어오지 않습니다 — 브라우저에는 남지 않습니다.",
    fieldServer: "연결 서버",
    fieldServerNone: "미지정",
    fieldLat: "위도",
    fieldLng: "경도",
    clearFilters: "필터 모두 지우기",
    selectedCount: (n: number) => `${n}대 선택됨`,
    bulkClearSelection: "선택 해제",
    bulkMoveToZone: "구역 이동",
    bulkDelete: "삭제",
    bulkDeleteConfirm: (n: number) => `카메라 ${n}대를 삭제할까요?`,
    bulkDeleteBody: "즉시 모니터링이 중단되고 채널이 반환됩니다. 이미 저장된 녹화는 삭제되지 않습니다.",
    bulkDeletedTitle: (n: number) => `카메라 ${n}대가 삭제됨`,
    bulkMovedTitle: (n: number, zone: string) => `카메라 ${n}대를 ${zone}(으)로 이동함`,
    selectAllLabel: "전체 선택",
    viewTable: "테이블",
    viewGrid: "그리드",
    colCamera: "카메라",
    colServer: "서버",
    colResolution: "해상도",
    colZone: "구역",
    colRtspStream: "RTSP 스트림",
    colStatus: "상태",
    emptyAll: "아직 이 프로젝트에 연결된 카메라가 없습니다.",
    emptyFiltered: "이 필터와 일치하는 카메라가 없습니다.",
    aiCameraBadge: "AI 카메라",
    cctvBadge: "CCTV",
    toggleStatusTitle: "상태 전환",
    previewAction: "스트림 미리보기",
    editAction: "수정",
    removeAction: "삭제",
    addModalTitle: "입력 장치 추가",
    editModalTitle: "입력 장치 수정",
    fieldDeviceName: "기기 이름 *",
    fieldDeviceNamePlaceholder: "Novena",
    fieldLocation: "위치",
    fieldLocationPlaceholder: "입구",
    fieldZone: "구역",
    fieldZonePlaceholder: "정문 구역",
    fieldRtspUrl: "연결 — RTSP URL *",
    fieldResolution: "해상도",
    fieldMaker: "제조사",
    fieldStatus: "상태",
    cancel: "취소",
    saveChanges: "변경사항 저장",
    addDevice: "기기 추가",
    confirmOfflineTitle: "카메라를 오프라인으로 표시하시겠습니까?",
    confirmReconnectTitle: "카메라를 재연결하시겠습니까?",
    confirmOfflineBody: (name: string) => `${name} 카메라가 이 프로젝트를 모니터링하는 모든 사용자에게 오프라인으로 표시됩니다. 확인하기 전에 실제로 스트림이 끊겼는지 확인하세요.`,
    confirmReconnectBody: (name: string) => `${name} 카메라의 재연결을 시도하고 온라인으로 표시합니다. 실제 장비 상태까지 확인하지는 않으므로, 여전히 연결이 끊겨 있다면 다시 오프라인으로 표시해야 합니다.`,
    markOffline: "오프라인으로 표시",
    reconnect: "재연결",
    toastCameraAddedTitle: "카메라 추가됨",
    toastCameraAddedDesc: (name: string) => `${name} 카메라가 이 프로젝트에 연결되었습니다.`,
    toastCameraUpdatedTitle: "카메라 정보 수정됨",
    toastReconnectedTitle: "재연결됨",
    toastDisconnectedTitle: "연결 해제됨",
    toastCameraRemovedTitle: "카메라 삭제됨",
    toastExportTitle: "내보내기 완료",
    toastExportDesc: (n: number) => `카메라 ${n}대가 CSV로 내보내졌습니다.`,
    csvHeaderName: "이름",
    csvHeaderCode: "코드",
    csvHeaderZone: "구역",
    csvHeaderLocation: "위치",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "상태",
  },
} as const;

/**
 * How far the stuck header overhangs the content on each side, to swallow the shadow the cards
 * underneath cast outside their own boxes. 8px covers PANEL_SHADOW's 6px blur with a pixel to
 * spare, and lands well inside the shell's 32px gutter.
 */
const EDGE_BLEED = 8;

// CSS position:sticky kept fighting PortalShell's padded scroll container — the header either
// left a gap a scrolled-past row showed through, or (once patched with a negative-margin/padding
// trick to close that gap) sat taller than every other tab's header, since sticky reserves that
// same padded box in normal flow even before it engages. Measuring the real scrolling ancestor in
// JS and switching to position:fixed while "stuck" sidesteps both: no ancestor padding/stacking
// ambiguity (fixed paints in the root stacking context), and the spacer below is sized to the
// header's own actual height, not a padded approximation.
function useStickyHeader<T extends HTMLElement>() {
  const contentRef = useRef<T>(null);
  const [stuck, setStuck] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; padTop: number } | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent) {
      const overflowY = getComputedStyle(scrollParent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;
    const sp = scrollParent;

    const update = () => {
      const spRect = sp.getBoundingClientRect();
      const spStyle = getComputedStyle(sp);
      const padLeft = parseFloat(spStyle.paddingLeft) || 0;
      const padRight = parseFloat(spStyle.paddingRight) || 0;
      const padTop = parseFloat(spStyle.paddingTop) || 0;
      // The fixed box pins the header to where it sits at scrollTop 0, so it must engage on the
      // very first pixel of scroll. Waiting until the header's own offset (the container's
      // top padding) is passed let it scroll up that far and then snap back down when it engaged.
      const nextStuck = sp.scrollTop > 0;
      // Measure the header only while it is still in normal flow. Once fixed, offsetHeight also
      // counts the padTop below, which the container's own padding already provides — a spacer
      // sized to that pushes every row down by that much the moment the header engages.
      if (!nextStuck) setHeight(el.offsetHeight);
      setStuck(nextStuck);
      // top sits at the container's own border edge (not +padTop) so the fixed box's background
      // covers the container's top-padding strip too — otherwise that strip shows whatever
      // scrolled-content happens to align there once scrolled deep enough to clear it (bleed-
      // through). padTop is applied as inline padding below instead, so the header's own content
      // still visually lands at the same y it occupied in normal flow — no jump when it engages.
      // clientWidth, not the bounding rect's width: the rect includes the scrollbar gutter, so the
      // moment this tab's content grew long enough to scroll — which is the moment the header
      // engages — the fixed box became a scrollbar-width wider than the cards below it and its
      // left and right edges stopped lining up with them.
      setRect({ left: spRect.left + padLeft, top: spRect.top, width: sp.clientWidth - padLeft - padRight, padTop });
    };
    update();
    sp.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(sp);
    return () => {
      sp.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return { contentRef, stuck, rect, height };
}

// Badge icons for the metric cards, at the size the Overview's badges use.

const DEFAULT_THUMBNAIL = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80";
type CameraSortKey = "name" | "server" | "resolution" | "zone" | "status";

/**
 * One row type for both kinds of input source.
 *
 * A camera and an uploaded recording are different objects with different fields, but they answer
 * the same question for an administrator — "what is feeding analysis on this project" — so they
 * share a table, the way the previous product's INPUT screen did. What that screen got wrong is
 * worth not repeating: it had a CONNECTION INFO column that was blank on every file row and a
 * RESOLUTION column blank on every camera row, and a "TOTAL CAMERAS 4" header sitting above seven
 * rows. Here the two are one `address` field (an IP for a camera, a resolution for a file — both
 * are "how this source is identified"), and the metrics above the table count the two separately,
 * because only cameras consume a licensed channel.
 */
/**
 * Sort order for the status column, as a rank rather than the raw value.
 *
 * Sorting on the strings put uploads above cameras, because "done" happens to precede "offline"
 * alphabetically — an accident of spelling deciding what an administrator sees first on a tab whose
 * main job is the camera fleet. The rank says what the order is for: cameras before files, and
 * within each group whatever needs attention before whatever does not.
 *
 * The two groups still read as two axes on screen (green/grey for a connection, blue/grey for an
 * analysis); this only settles which row comes first when they share a list.
 */
const STATUS_RANK: Record<CameraStatus | UploadStatus, number> = {
  // An error outranks silence: a camera that refuses a connection is a camera somebody can fix
  // from this screen, and one that has simply stopped answering usually is not.
  error: 0,
  offline: 1,
  online: 2,
  failed: 3,
  pending: 4,
  analyzing: 5,
  done: 6,
};

type SourceKind = "camera" | "video" | "image" | "deepfake";
type SourceRow =
  | { kind: "camera"; id: string; name: string; camera: Camera }
  | { kind: "video" | "image" | "deepfake"; id: string; name: string; upload: UploadedMedia };

const MAKERS = ["Hanwha", "Hikvision", "Dahua"];
const RESOLUTIONS = ["FHD (1920×1080)", "4K (3840×2160)"];
// No Source Type chooser: the v1 contract is plain CCTV only, so there is nothing to choose
// between (backend reply C2, 2026-09-09). See the note above Camera in the store.

interface CameraFormValues {
  name: string;
  ip: string;
  location: string;
  zone: string;
  rtspUrl: string;
  resolution: string;
  maker: string;
  model: string;
  username: string;
  /**
   * Held in the form only. It is never written to the store and never read back into the form on
   * edit — a stream credential in browser state is a credential in every future persistence layer
   * and in any state dump. The real call posts it with the camera and the server keeps only its own
   * copy; editing shows an empty box, which is what "unchanged" looks like everywhere else.
   */
  password: string;
  serverId: string;
  lat: string;
  lng: string;
  status: CameraStatus;
}

const EMPTY_FORM: CameraFormValues = {
  name: "", ip: "", location: "", zone: "", rtspUrl: "",
  resolution: RESOLUTIONS[0], maker: MAKERS[0], model: "", username: "", password: "",
  serverId: "", lat: "", lng: "",
  status: "offline",
};

// Camera codes are an internal identifier (shown in the table, used in mock RTSP paths) — the
// reference popup this modal now matches doesn't surface a code field, so it's derived from the
// name instead of typed in by the operator.
function generateCameraCode(name: string, existing: string[]): string {
  /*
   * No Latin letters in the name means no prefix at all — "CAM-001", not "CAM-CAM-001".
   * The fallback used to be the literal string "CAM", so a Korean-named fleet came out as
   * CAM-CAM-001, CAM-CAM-002 … and the segment that exists to tell cameras apart told you
   * nothing about any of them.
   */
  const letters = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const prefix = letters || null;
  /*
   * The sequence comes from the codes that exist, not from how many cameras there are.
   *
   * Counting produced collisions the moment anything had been deleted: five cameras, add
   * "Alpha Gate" -> CAM-ALP-006, delete an older one, add "Alpine Road" -> CAM-ALP-006 again.
   * Two cameras sharing the code that the table, the CSV export and every audit message
   * identify them by.
   *
   * Scoped to the prefix, so the numbers stay short and readable per family rather than being
   * one global counter.
   */
  const stem = prefix ? `CAM-${prefix}-` : "CAM-";
  const used = new Set(existing);
  let n = existing.filter(c => c.startsWith(stem)).length + 1;
  let code = `${stem}${String(n).padStart(3, "0")}`;
  while (used.has(code)) {
    n += 1;
    code = `${stem}${String(n).padStart(3, "0")}`;
  }
  return code;
}

function CameraFormModal({
  title, initial, isEdit, servers, onClose, onSubmit, t,
}: {
  title: string;
  initial: CameraFormValues;
  isEdit: boolean;
  /** This project's servers, for the Associated server picker. Empty is a valid state — a project
   *  can have cameras before it has anywhere to run them. */
  servers: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (values: CameraFormValues) => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  useEscapeKey(onClose);
  const [form, setForm] = useState<CameraFormValues>(initial);
  /*
   * Coordinates and the address are checked, not swallowed.
   *
   * `Number(values.lat) || 0` turned a typo into 0,0 — a camera silently placed in the Gulf of
   * Guinea rather than a form saying the number is wrong. The IP took any string at all, and
   * the RTSP field took one with no scheme.
   *
   * Deliberately loose where looseness is right: IP is optional (a camera can be registered
   * before its address is known) and only refused when what is typed plainly is not one.
   */
  const latNum = form.lat.trim() === "" ? null : Number(form.lat);
  const lngNum = form.lng.trim() === "" ? null : Number(form.lng);
  const latError = latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90);
  const lngError = lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180);
  const ipError = form.ip.trim() !== "" && !/^[0-9a-zA-Z.:_-]+$/.test(form.ip.trim());
  const rtspError = form.rtspUrl.trim() !== "" && !/^rtsp:\/\/.+/i.test(form.rtspUrl.trim());
  const valid = form.name.trim().length > 0 && form.rtspUrl.trim().length > 0
    && !latError && !lngError && !ipError && !rtspError;

  const field = (
    key: "name" | "ip" | "location" | "zone" | "rtspUrl" | "model" | "username" | "password" | "lat" | "lng",
    label: string,
    placeholder: string,
    opts?: { type?: string; inputMode?: "decimal"; error?: string },
  ) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      {/* TextField, not a bare input: it carries the shared height and the shared focus ring, so a
          field and the select next to it in this same form stop being two different controls. */}
      <TextField
        value={form[key]}
        onChange={v => setForm(f => ({ ...f, [key]: v }))}
        placeholder={placeholder}
        type={opts?.type}
        inputMode={opts?.inputMode}
        autoComplete={key === "password" ? "new-password" : undefined}
      />
      {/* Under the field it belongs to. The submit button greys out either way, but a disabled
          button with no reason is a form that has stopped talking to you. */}
      {opts?.error && (
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.5, marginTop: "6px" }}>{opts.error}</p>
      )}
    </div>
  );

  const selectField = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <FilterSelect value={value} onChange={onChange} options={options} />
    </div>
  );


  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      // Scroll on the backdrop, not the sheet: this form holds FilterSelects, and those open as
      // absolutely positioned lists that an overflow-y on the sheet cuts off at its edge.
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "460px", width: "100%", margin: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>

          {field("name", t.fieldDeviceName, t.fieldDeviceNamePlaceholder)}
          {field("ip", t.fieldIp, t.fieldIpPlaceholder, { error: ipError ? t.errIp : undefined })}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField(t.fieldMaker, form.maker, MAKERS.map(m => ({ value: m, label: m })), v => setForm(f => ({ ...f, maker: v })))}
            {field("model", t.fieldModel, t.fieldModelPlaceholder)}
          </div>

          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {field("username", t.fieldUsername, t.fieldUsernamePlaceholder)}
              {field("password", t.fieldPassword, t.fieldPasswordPlaceholder, { type: "password" })}
            </div>
            {/* Says where the password goes, because an empty box on the edit form otherwise reads
                as "we lost it" rather than "we never had it". */}
            <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "6px", lineHeight: 1.6 }}>
              {isEdit ? `${t.fieldPasswordEditHint} ${t.passwordNotStoredHint}` : t.passwordNotStoredHint}
            </p>
          </div>

          {field("rtspUrl", t.fieldRtspUrl, "rtsp://10.20.4.11:554/stream1", { error: rtspError ? t.errRtsp : undefined })}

          {selectField(
            t.fieldServer,
            form.serverId,
            [{ value: "", label: t.fieldServerNone }, ...servers.map(sv => ({ value: sv.id, label: sv.name }))],
            v => setForm(f => ({ ...f, serverId: v })),
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("lat", t.fieldLat, "0.0", { inputMode: "decimal", error: latError ? t.errLat : undefined })}
            {field("lng", t.fieldLng, "0.0", { inputMode: "decimal", error: lngError ? t.errLng : undefined })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("location", t.fieldLocation, t.fieldLocationPlaceholder)}
            {field("zone", t.fieldZone, t.fieldZonePlaceholder)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField(t.fieldResolution, form.resolution, RESOLUTIONS.map(r => ({ value: r, label: r })), v => setForm(f => ({ ...f, resolution: v })))}
            {!isEdit && selectField(t.fieldStatus, form.status === "online" ? "Online" : "Offline", [{ value: "Online", label: t.online }, { value: "Offline", label: t.offline }], v => setForm(f => ({ ...f, status: v === "Online" ? "online" : "offline" })))}
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {isEdit ? t.saveChanges : t.addDevice}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStatusModal({
  camera, nextStatus, onClose, onConfirm, t,
}: {
  camera: Camera;
  nextStatus: "online" | "offline";
  onClose: () => void;
  onConfirm: () => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  useEscapeKey(onClose);
  const goingOffline = nextStatus === "offline";
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {goingOffline ? t.confirmOfflineTitle : t.confirmReconnectTitle}
          </p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px" }}>
            {goingOffline ? t.confirmOfflineBody(camera.name) : t.confirmReconnectBody(camera.name)}
          </p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none",
              backgroundColor: goingOffline ? "var(--danger-400)" : "var(--gray-900)", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
            }}>
            {goingOffline ? t.markOffline : t.reconnect}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Status colours for an upload. Deliberately not the camera palette: green/grey there means a live
 * connection is up or down, and an analysis that has finished is not the same kind of fact as a
 * stream that is alive. Blue for done, grey for waiting, red for failed — so a glance at the column
 * tells you which of the two questions a row is answering.
 */
const UPLOAD_STATUS_TONE: Record<UploadStatus, { dot: string; text: string; label: "statusPending" | "statusAnalyzing" | "statusDone" | "statusFailed" }> = {
  pending:   { dot: "var(--gray-300)",  text: "var(--gray-500)",  label: "statusPending" },
  analyzing: { dot: "var(--info-500)",  text: "var(--info-500)",  label: "statusAnalyzing" },
  done:      { dot: "var(--info-500)",  text: "var(--info-500)",  label: "statusDone" },
  failed:    { dot: "var(--danger-400)", text: "var(--danger-400)", label: "statusFailed" },
};

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "";
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * @param openCameraId  A camera to open the detail modal on as soon as this tab mounts — set by the
 *   Overview's camera panel, whose rows now open the camera rather than dumping the reader at the
 *   top of this list. Cleared through onCameraOpened so a later visit to the tab opens plain.
 */
export default function ProjectCamerasTab({ projectId, openCameraId, onCameraOpened }: {
  projectId: string;
  openCameraId?: string | null;
  onCameraOpened?: () => void;
}) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const uploads = useVcaStore(s => s.uploads);
  const servers = useVcaStore(s => s.servers);
  const addUpload = useVcaStore(s => s.addUpload);
  const removeUpload = useVcaStore(s => s.removeUpload);
  const addCamera = useVcaStore(s => s.addCamera);
  const updateCamera = useVcaStore(s => s.updateCamera);
  const removeCamera = useVcaStore(s => s.removeCamera);
  const removeCameras = useVcaStore(s => s.removeCameras);
  const setCamerasZone = useVcaStore(s => s.setCamerasZone);
  const setCameraStatus = useVcaStore(s => s.setCameraStatus);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const { contentRef: stickyRef, stuck, rect, height: stickyHeight } = useStickyHeader<HTMLDivElement>();

  const [showAdd, setShowAdd] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  // Holds just the id — the live Camera object is looked up from `cameras` below on every render,
  // so actions taken inside the modal (e.g. Reconnect) are reflected immediately instead of
  // showing a stale snapshot captured at the moment the modal opened.
  const [inspectingCameraId, setInspectingCameraId] = useState<string | null>(null);
  /**
   * Opens the camera the Overview's panel handed over, once, and tells the parent it is done so a
   * later visit to this tab opens plain. Effect rather than initial state: this component stays
   * mounted while the tab is open, so a second click on a second camera has to reach it too.
   */
  useEffect(() => {
    if (!openCameraId) return;
    const id = openCameraId;
    // In a microtask, not straight from the effect body: setting state synchronously there makes
    // React render this tree twice before it paints, and the lint rule that catches cascading
    // renders is right to flag it. The same trick the Overview uses for its post-mount clock.
    queueMicrotask(() => {
      setInspectingCameraId(id);
      onCameraOpened?.();
    });
  }, [openCameraId, onCameraOpened]);
  const [confirmingStatusCam, setConfirmingStatusCam] = useState<Camera | null>(null);
  const [view, setView] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "online" | "offline" | "error">("ALL");
  /**
   * Which "installed but doing nothing" gap the list is narrowed to, if any — set by the summary
   * strip above the table.
   */
  // Which kind of source the table is showing. A tab row, not another select in the filter strip:
  // it is the top-level cut of the list, and the counts belong on it.
  const [kindTab, setKindTab] = useState<"ALL" | SourceKind>("ALL");
  /** Which purpose the upload sheet was opened for: null when closed. The sheet is the same one
   *  either way — the same files go in — and only the question being asked of them differs, which
   *  is what the wording and the resulting row's kind follow. */
  const [uploadPurpose, setUploadPurpose] = useState<"media" | "deepfake" | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // An auditor reads this fleet; they do not add to it, re-point it or delete from it.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const [hoveredAddItem, setHoveredAddItem] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const projectCameras = cameras.filter(c => c.projectId === projectId);
  /*
   * The licensed ceiling, enforced rather than only drawn.
   *
   * The Licence screen states "no further camera can be connected until the limit is raised"
   * and the Overview's bar turns red past it — and nothing checked. A hundred-channel project
   * took a hundred and one cameras, so the one number the customer pays per unit of was the
   * one number the console did not hold.
   *
   * Uploads are not channels and are not counted: a channel is a live stream being processed.
   *
   * HANDOFF NOTE: this is the UI half. The provisioning call has to refuse it too, or a client
   * that never opened Portal is unbounded.
   */
  const channelLimit = project ? projectChannelLimit(project) : undefined;
  const channelsUsed = projectCameras.length;
  /**
   * No recorded limit is "not licensed", not "unlimited".
   *
   * `channelLimit !== undefined && ...` read an absent licence as permission for any number of
   * cameras, and the wizard that creates projects (`addProject`) writes no licence fields at
   * all — so every site made from it accepted an unbounded fleet. The four seeded projects all
   * carry a limit, which is why this never showed.
   *
   * The product already argues the other way everywhere else: a project is a licensed site, and
   * PortalEmptyState says in as many words that a self-serve project is "a contract shell with
   * no contract" that nobody could put a camera in. This makes the code agree with that.
   *
   * HANDOFF NOTE: the front end refusing is the polite half. The provisioning call has to refuse
   * too — a client that never opens Portal is otherwise unbounded, and whether the count belongs
   * to the installation or to each project is still open.
   */
  const channelLimitUnrecorded = channelLimit === undefined;
  const atChannelLimit = !channelLimitUnrecorded && channelsUsed >= channelLimit;
  /**
   * Zero channels is not "the limit is full", even though the arithmetic agrees (0 >= 0).
   *
   * A licence that grants nothing produced "all 0 licensed channels are in use", which invites
   * the wrong fix — nobody can free a channel that was never granted. It should not happen (the
   * issuer refuses a zero-channel licence), but a screen that reads as nonsense on a value the
   * screen itself can receive is worth two strings. Flagged by the session that built the
   * licence-file intake.
   */
  const zeroChannelLicence = channelLimit === 0;
  const cannotAddSource = channelLimitUnrecorded || atChannelLimit;
  const projectUploads = uploads.filter(u => u.projectId === projectId);
  const projectServers = servers.filter(sv => sv.projectId === projectId);

  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addMenuOpen]);
  const zones = Array.from(new Set(projectCameras.map(c => c.zone).filter(Boolean)));
  const { sort, toggle: toggleSort } = useTableSort<CameraSortKey>({ key: "status", direction: "asc" });
  // Search is not counted. It is visible as text in its own box and clearing it is obvious, whereas
  // a select that says "Offline" looks like a heading until you look twice.
  /**
   * Three ways a camera can be on this list and be doing nothing at all.
   *
   * Every one of them is online, thumbnailed and unremarkable in the table — which is exactly why
   * they need stating: a camera with no engine detects nothing, one with no server has no compute
   * to do it on, and one with no coordinates never appears on the app's map, so the control room
   * cannot see it exists. All three are read off fields the table already holds, so the figures
   * and the rows behind them cannot disagree.
   *
   * Offline and error are deliberately not here: the status filter beside the search box already
   * carries both counts, and a summary that repeats a control is a summary the reader learns to
   * skip.
   */

  const activeFilterCount = [zoneFilter, statusFilter].filter(v => v !== "ALL").length;
  // Selected camera ids. Held as a Set of ids rather than of rows so a selection survives the list
  // being re-sorted or re-filtered underneath it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  /*
   * Escape for the two dialogs on this screen that are inline JSX rather than components, so
   * they cannot each call useEscapeKey for themselves. Both had a working backdrop click and a
   * dead Escape key, which is the exact drift the shared hook exists to prevent — and one of
   * the two is the bulk delete.
   */
  useEscapeKey(
    () => { if (confirmingBulkDelete) setConfirmingBulkDelete(false); else setUploadPurpose(null); },
    confirmingBulkDelete || uploadPurpose !== null,
  );

  const clearFilters = () => { setZoneFilter("ALL"); setStatusFilter("ALL"); };

  const q = search.trim().toLowerCase();
  const matchingCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesZone && matchesStatus;
  });
  const matchingUploads = projectUploads.filter(u => {
    const matchesSearch = !q || u.fileName.toLowerCase().includes(q);
    // Zone and AI-engine are camera properties. A file has neither, so any of those filters being
    // set means the person is looking at cameras and files should drop out — hiding them is the
    // honest answer, not showing them as if they had passed a filter they cannot be judged by.
    // A gap filter is a camera question too — a file has no engine, no server and no coordinates,
    // and showing files while one is on would be showing rows that cannot be judged by it.
    const cameraOnlyFilterSet = zoneFilter !== "ALL";
    // Status filter is shared but its values are not: "online"/"offline" describe a connection and
    // a file has none, so the same reasoning applies.
    return matchesSearch && !cameraOnlyFilterSet && statusFilter === "ALL";
  });

  // Cameras and uploads become one row list before sorting, so a sort is a sort of the table and
  // not of two stacked tables.
  const allRows: SourceRow[] = [
    ...matchingCameras.map((c): SourceRow => ({ kind: "camera", id: c.id, name: c.name, camera: c })),
    ...matchingUploads.map((u): SourceRow => ({ kind: u.kind, id: u.id, name: u.fileName, upload: u })),
  ].filter(r => kindTab === "ALL" || r.kind === kindTab);

  // Offline first by default. The table's job here is "what needs attention", and a fleet sorted
  // alphabetically buries the three cameras that are down among the ninety-seven that are not.
  const visibleRows = sortRows(allRows, sort, (r, key) => {
    if (r.kind === "camera") {
      const c = r.camera;
      switch (key) {
        case "name": return c.name.toLowerCase();
        // Unassigned sinks to the bottom of the ascending pass rather than sorting under an
        // empty string at the top — a camera on no server is the interesting row, and the reader
        // reaches it by sorting the other way.
        case "server": return projectServers.find(sv => sv.id === c.serverId)?.name.toLowerCase();
        case "resolution": return c.resolution?.toLowerCase();
        case "zone": return c.zone?.toLowerCase();
        case "status": return STATUS_RANK[c.status];
      }
    }
    // A file has no maker and no zone — undefined sinks it to the bottom of those sorts rather
    // than inventing a value that would put it in a position it has not earned.
    switch (key) {
      case "name": return r.upload.fileName.toLowerCase();
      case "resolution": return undefined;
      case "status": return STATUS_RANK[r.upload.status];
      default: return undefined;
    }
  });
  // The grid view and the camera-only actions (batch reconnect, CSV export) still work on cameras.
  const visibleCameras = visibleRows.filter((r): r is Extract<SourceRow, { kind: "camera" }> => r.kind === "camera").map(r => r.camera);

  // Maker, zone and AI engines are camera facts. On a files-only tab they would be a column of
  // dashes on every row — which is exactly the fault in the screen this replaces — so the tab drops
  // them instead of printing them empty. On the combined tab they stay, because a mixed list has
  // rows that fill them.
  const showCameraColumns = kindTab === "ALL" || kindTab === "camera";
  const effectiveView = showCameraColumns ? view : "table";
  const GRID = showCameraColumns
    ? "28px 56px 1.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 0.8fr 70px"
    : "28px 56px 2fr 0.8fr 1.2fr 0.9fr 70px";

  // Only rows that are actually on screen count as selected. Filtering to Offline while three
  // online cameras are ticked would otherwise leave a delete button armed with rows the person
  // can no longer see.
  const visibleSelectedIds = visibleCameras.filter(c => selectedIds.has(c.id)).map(c => c.id);
  const allVisibleSelected = visibleCameras.length > 0 && visibleSelectedIds.length === visibleCameras.length;
  const toggleRow = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds(prev => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleCameras.forEach(c => next.delete(c.id));
    else visibleCameras.forEach(c => next.add(c.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = () => {
    const count = visibleSelectedIds.length;
    removeCameras(visibleSelectedIds);
    clearSelection();
    setConfirmingBulkDelete(false);
    showToast({ variant: "success", title: t.bulkDeletedTitle(count) });
  };
  const bulkMoveToZone = (zone: string) => {
    const count = visibleSelectedIds.length;
    setCamerasZone(visibleSelectedIds, zone);
    clearSelection();
    showToast({ variant: "success", title: t.bulkMovedTitle(count, zone) });
  };

  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  // Counted, not derived from the total: with a third state, "everything that is not online" is
  // two different errands and one number would hide the smaller one.
  const offlineCount = projectCameras.filter(c => c.status === "offline").length;
  const errorCount = projectCameras.filter(c => c.status === "error").length;
  // Anything not yet analysed — queued or mid-run. Both are "not done", and an administrator does
  // the same thing about either: wait, or find out why.


  // `password` is read off the form and dropped here on purpose — see CameraFormValues. Everything
  // else the form collects is stored.
  const createCamera = (values: CameraFormValues) => {
    // Refused here as well as disabled above: the button is the UI, this is the rule.
    if (cannotAddSource) return;
    addCamera({
      projectId, name: values.name.trim(), code: generateCameraCode(values.name.trim(), cameras.map(c => c.code)), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, model: values.model.trim() || undefined, resolution: values.resolution,
      username: values.username.trim() || undefined, serverId: values.serverId || undefined,
      ip: values.ip.trim(), mac: "", status: values.status, thumbnail: DEFAULT_THUMBNAIL,
      lat: values.lat.trim() === "" ? 0 : Number(values.lat),
      lng: values.lng.trim() === "" ? 0 : Number(values.lng),
    });
    setShowAdd(false);
    showToast({ variant: "success", title: t.toastCameraAddedTitle, desc: t.toastCameraAddedDesc(values.name.trim()) });
  };

  const saveEdit = (values: CameraFormValues) => {
    if (!editingCamera) return;
    updateCamera(editingCamera.id, {
      name: values.name.trim(), rtspUrl: values.rtspUrl.trim(), ip: values.ip.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, model: values.model.trim() || undefined, resolution: values.resolution,
      username: values.username.trim() || undefined, serverId: values.serverId || undefined,
      lat: values.lat.trim() === "" ? 0 : Number(values.lat),
      lng: values.lng.trim() === "" ? 0 : Number(values.lng),
    });
    setEditingCamera(null);
    showToast({ variant: "success", title: t.toastCameraUpdatedTitle, desc: values.name.trim() });
  };

  const toggleStatus = (cam: Camera) => {
    const next = cam.status === "online" ? "offline" : "online";
    setCameraStatus(cam.id, next);
    showToast({ variant: next === "online" ? "success" : "default", title: next === "online" ? t.toastReconnectedTitle : t.toastDisconnectedTitle, desc: cam.name });
  };

  // Confirmed, like the bulk delete beside it. One route to an irreversible action should not
  // be safer than another route to the same action — ticking a row and pressing Delete asked
  // you to confirm, and the row's own ⋯ → Remove did it on the first click.
  const [confirmingDeleteCam, setConfirmingDeleteCam] = useState<Camera | null>(null);
  const handleDelete = (cam: Camera) => setConfirmingDeleteCam(cam);
  const confirmDeleteCam = () => {
    if (!confirmingDeleteCam) return;
    const name = confirmingDeleteCam.name;
    removeCamera(confirmingDeleteCam.id);
    setConfirmingDeleteCam(null);
    showToast({ variant: "warning", title: t.toastCameraRemovedTitle, desc: name });
  };

  /**
   * Asks for a reconnect. Does not claim one happened.
   *
   * This used to write `online` onto every offline camera and say "8 cameras reconnected" — with no
   * RTSP attempt, no server call and nothing checking the result. The screen went 51 → 59 online,
   * the Overview's "things to do" line about offline cameras disappeared, and all eight were still
   * down. A button that reports a success it did not verify is worse than no button.
   *
   * So it reports the request and leaves the status alone. Whether a camera came back is the
   * camera's answer, and the backend that polls it is confirmed as planned — when it lands, this
   * gets a call and the copy already tells the truth.
   */
  // No Refresh button here. It said "Reconnect All" first — a command Portal cannot give — and
  // then "Refresh", which is a thing this page could do but not yet a thing it does: nothing is
  // fetched, so it toasted and stopped. A control worth having comes with a last-updated time
  // beside it ("Updated 12s ago ↻"), and which form it takes depends on how the camera API
  // delivers status: a server that pushes leaves nothing for a button to do, a client that polls
  // wants both halves. Decided with the backend, built then.

  // Reads only what the browser can tell us without decoding the file: its name, size and whether
  // it is video or image. Duration and resolution come from the server once it has opened the file
  // — guessing them here would put numbers on screen that nothing measured.
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(f => f.type.startsWith("video/") || f.type.startsWith("image/"));
    accepted.forEach(f => addUpload({
      projectId,
      fileName: f.name,
      kind: uploadPurpose === "deepfake" ? "deepfake" : f.type.startsWith("image/") ? "image" : "video",
      sizeBytes: f.size,
      uploadedBy: SIGNED_IN_USER.name,
    }));
    if (accepted.length === 0) return;
    // Land on the tab the files went to, not on ALL: the person just asked a question about these
    // files and the answer is on that list.
    setKindTab(uploadPurpose === "deepfake" ? "deepfake" : "ALL");
    setUploadPurpose(null);
    showToast({ variant: "success", title: t.toastUploadedTitle, desc: accepted.map(f => f.name).join(", ") });
  };

  /**
   * When the fleet's status was last fetched, and a clock to say how long ago that was.
   *
   * Portal polls — decided by the backend on 2026-09-09 (reply D1). The module publishes status
   * over MQTT and the server keeps the latest value loaded, so a poll is always the current answer
   * and costs almost nothing; a browser subscription is the fallback plan, not the v1 shape.
   *
   * Both are set after mount, never during render: a timestamp taken while rendering differs
   * between the server's HTML and the browser's first pass, and the two would not match.
   *
   * There is no 30-second interval resetting lastPolledAt. There was, and it fetched nothing:
   * the value the label measures FROM was being pushed forward by the same timer that was
   * supposed to make the label move, so polledMinsAgo could never reach 1 and the toolbar read
   * "checked just now" permanently, over figures that might be hours old. A label that always
   * says the same thing is worse than a stale one — a stale timestamp at least tells you to
   * distrust it. The refresh button is now the only writer, so the words measure a real event.
   *
   * HANDOFF NOTE: pressing refresh is where the fetch goes —
   * GET /api/portal/projects/{id}/camera-connectivity, answer into the store. Until that exists
   * the button only re-stamps the clock, which is why it does not claim the figures changed.
   */
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // queueMicrotask, not a bare call: setting state synchronously inside an effect makes React
    // throw the render away and start again. The same deferral the rest of Portal uses for
    // clock-dependent values.
    queueMicrotask(() => { setLastPolledAt(Date.now()); setNowMs(Date.now()); });
    // Just the label's clock. "3 min ago" does not need per-second accuracy, and a timer that
    // fires every second to redraw two words is a timer nobody asked for.
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(clock);
  }, []);
  const polledMinsAgo = nowMs !== null && lastPolledAt !== null
    ? Math.floor((nowMs - lastPolledAt) / 60_000)
    : null;

  const [showImport, setShowImport] = useState(false);

  const exportCsv = () => {
    const header = [t.csvHeaderName, t.csvHeaderCode, t.csvHeaderZone, t.csvHeaderLocation, t.csvHeaderRtspUrl, t.csvHeaderStatus];
    const rows = projectCameras.map(c => [
      // Three states, not two. A camera refusing the connection is not "a worse offline" —
      // the store's own note says so — and exporting it as Offline hands an auditor a file
      // that disagrees with the screen it came from.
      c.name, c.code, c.zone, c.location, c.rtspUrl,
      c.status === "online" ? t.online : c.status === "error" ? t.statusError : t.offline,
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "project"}-cameras.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: t.toastExportTitle, desc: t.toastExportDesc(projectCameras.length) });
  };

  return (
    <div>
      {/* Spacer holds the scroll height the fixed header vacates once stuck — sized to the
          header's own measured height, so this tab's top spacing matches every other tab exactly
          (unlike the earlier CSS sticky attempt, which reserved a taller padded box). */}
      {stuck && <div style={{ height: stickyHeight }} />}
      <div ref={stickyRef} style={stuck && rect ? {
        position: "fixed", top: rect.top, zIndex: 20,
        // Wider than the content by EDGE_BLEED on each side, and padded back in by the same amount
        // (box-sizing is border-box), so the children still start and end where they do unstuck.
        //
        // That overhang is the fix for a shadow that appeared at both ends of this header the
        // moment the page scrolled: the rows card underneath carries PANEL_SHADOW, whose 6px blur
        // spreads a little outside its own box, and a cover exactly the card's width covered the
        // card but not its bleed — so the scrolled-away card's shadow was still visible as a soft
        // vertical smudge down the left and right edges of the stuck block. The overhang lands in
        // the shell's gutter, which is this same grey, so nothing else changes.
        left: rect.left - EDGE_BLEED, width: rect.width + EDGE_BLEED * 2,
        paddingLeft: EDGE_BLEED, paddingRight: EDGE_BLEED,
        // No paddingBottom: the block's last child is the table's column-header card, so any
        // padding under it paints a grey strip between that header and the rows scrolling behind,
        // splitting the one card in two and stranding a sliver of a half-scrolled row below it.
        // Ending flush at the card's bottom edge lets rows pass directly under the header.
        // Matches the content area behind it: this block's whole job is to hide the rows passing
        // under it, so it has to be the exact colour of the page it covers. It was white, from when
        // the content column was white — against the primary-50 ground the shell uses now, the page
        // appeared to grow a paler band across the top the moment it scrolled.
        backgroundColor: "var(--primary-50)", paddingTop: rect.padTop,
      } : undefined}>

      {/* Metrics — the same MetricCard the Overview uses, rather than the one bordered box with
          internal rules this used to be. Same job one screen over should not be a different
          component.

          Two, not three. The third counted uploaded files — how many analysed, how many queued —
          and neither figure earned a third of this header. The queue is a dead end today: nothing
          in the app moves an upload past "pending", because analysis is the core's work and has no
          endpoint yet, so the figure was a permanent 0 (or, after an upload, a number that never
          cleared). The totals are on the video / image tabs below anyway, with each file's own
          state in its row. */}
      {/* No metric strip here.
          It carried channel usage and the online/offline split — both of which are cards on the
          Overview, one click up the rail, and neither of which is what this screen is for. The
          tabs below already count what the list holds, the status filter is where an offline count
          is acted on rather than read, and a non-zero offline count raises a line in the Overview's
          "things to do". Two figures repeated from the previous screen were pushing the table they
          describe half a fold down. */}
      {/* Top-level cut of the list, with counts on the tabs. An underlined tab row rather than a
          fourth select in the filter strip below: which kind of source you are looking at is a
          different question from how you are narrowing that kind, and the counts belong where the
          choice is made. Same arrangement the previous product's INPUT screen used. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {([
          { id: "ALL", label: t.kindTabAll, count: projectCameras.length + projectUploads.length },
          { id: "camera", label: t.kindTabCamera, count: projectCameras.length },
          { id: "video", label: t.kindTabVideo, count: projectUploads.filter(u => u.kind === "video").length },
          { id: "image", label: t.kindTabImage, count: projectUploads.filter(u => u.kind === "image").length },
          // Its own tab, not a filter inside Videos: a deepfake submission is a different errand
          // with a different answer, and mixed into the footage list its verdict column would be
          // empty on every other row.
          { id: "deepfake", label: t.kindTabDeepfake, count: projectUploads.filter(u => u.kind === "deepfake").length },
        ] as { id: "ALL" | SourceKind; label: string; count: number }[]).map(tab => {
          const active = kindTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setKindTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}
            >
              {tab.label}
              <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/*
        Is the fleet up? — which is the question somebody opens this screen with, and the one the
        list alone takes a scroll to answer.

        It is not the counts the old console put here (TOTAL / NORMAL / AI / INACTIVE, four cards
        directly above tabs that said the same four numbers). Nor is it the gaps it carried until
        2026-09-09: "56 cameras with no server assigned", 56 of 60, is not a fault report, it is a
        description of the deployment, and clicking it filtered away four rows.

        These three figures live nowhere else on the screen. They are in the status filter's list —
        which is a closed dropdown, so the answer to "is anything wrong" cost a click to find, and
        that is exactly why the page read as a bare list. Same numbers, said out loud.

        The cells drive that same filter rather than one of their own, so pressing "8 offline" and
        picking Offline from the dropdown are one state, not two that can disagree.
      */}
      {/* Above the strip, because it changes what the numbers below it mean: at the ceiling the
          fleet count stops being "how many we have" and becomes "how many we may have". A
          disabled button whose tooltip nobody hovers is the same silence as no rule at all. */}
      {(atChannelLimit || channelLimitUnrecorded) && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px",
          padding: "12px 14px", borderRadius: "10px",
          backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-200)",
        }}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: "1px", color: "var(--warning-500)" }}>
            <CircleAlert size={15} strokeWidth={2.2} />
          </span>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--warning-500)", lineHeight: 1.6 }}>
            {channelLimitUnrecorded ? t.noLicenceBanner : zeroChannelLicence ? t.zeroChannelBanner : t.atLimitBanner(channelLimit)}
          </p>
        </div>
      )}
      {(kindTab === "ALL" || kindTab === "camera") && <SummaryStrip cells={[
        {
          key: "online" as const, count: onlineCount, label: t.healthConnected, why: t.healthConnectedWhy,
          unit: t.healthOfFleet(projectCameras.length), tone: "neutral" as const,
          icon: <VideoIcon size={14} strokeWidth={2.4} />,
        },
        {
          key: "offline" as const, count: offlineCount, label: t.healthOffline, why: t.healthOfflineWhy,
          unit: undefined, tone: "warning" as const,
          icon: <VideoOff size={14} strokeWidth={2.4} />,
        },
        {
          key: "error" as const, count: errorCount, label: t.healthError, why: t.healthErrorWhy,
          unit: undefined, tone: "warning" as const,
          icon: <CircleAlert size={14} strokeWidth={2.4} />,
        },
      ]
        // A cell reading "0 refusing the connection" is a click that returns an empty table. The
        // connected cell stays whatever it says: zero of sixty connected is the loudest thing this
        // strip could ever report.
        .filter(item => item.key === "online" || item.count > 0)
        .map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          unit: item.unit,
          label: item.label,
          // Offline and refusing-the-connection are two words apart and two different callouts —
          // one is an electrician, the other is a password. The underline is where that goes.
          explanation: item.why,
          tone: item.tone,
          active: statusFilter === item.key,
          title: statusFilter === item.key ? t.healthClear : t.healthShowOnly,
          onClick: () => setStatusFilter(statusFilter === item.key ? "ALL" : item.key),
        }))} />}
      {/* Search & filters */}
      {/* alignItems center, not the default stretch: every control in this row sets its own height
          (CONTROL_HEIGHT), so stretch looked fine until a bare <span> joined them — the selection
          count stretched to the row's 36px and drew its text at the top of that box, sitting a
          third of a line above the Delete button beside it. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.22"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              // 12 + 14 (icon) + 6 = 32, so the icon's gap is on the spacing scale too.
              ...FIELD_STYLE, padding: "0 12px 0 32px",
              ...(searchFocused ? FIELD_FOCUS : null),
            }}
          />
        </div>
        <FilterSelect
          value={zoneFilter}
          onChange={setZoneFilter}
          options={[{ value: "ALL", label: t.filterAllZones }, ...zones.map(z => ({ value: z, label: z }))]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          /* Counts on the options, the way the VIP registry's filters carry theirs. This is where
             the offline figure earns its place — next to the control that acts on it. */
          options={[
            { value: "ALL", label: t.filterAllStatus },
            { value: "online", label: `${t.online} (${onlineCount})` },
            { value: "offline", label: `${t.offline} (${offlineCount})` },
            // Only when there is one to filter to. An option reading "Error (0)" invites a click
            // that returns an empty table.
            ...(errorCount > 0 ? [{ value: "error", label: `${t.statusError} (${errorCount})` }] : []),
          ]}
        />
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
        {/* Grid is a wall of camera thumbnails, and an unanalysed file has no frame to put in one.
            Rather than let file rows vanish the moment someone picks Grid, the toggle is only
            offered on the tabs where both views can show the same rows — and `effectiveView` below
            makes sure a Grid choice made earlier does not silently hide the files. */}
        {showCameraColumns && (
        <div style={{ display: "flex", alignItems: "center", height: CONTROL_HEIGHT, boxSizing: "border-box", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "4px" }}>
          {(["table", "grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                height: "100%", padding: "0 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                fontSize: "10px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
              }}>
              {v === "table" ? t.viewTable : t.viewGrid}
            </button>
          ))}
        </div>
        )}
        {/*
          The tools, at the right end of the toolbar.

          They were a row of their own above the tabs, which is where they ended up when the page
          title was deleted — and a strip of buttons with nothing to its left reads as chrome that
          happens to be floating there. The toolbar is the anchor: left of it is how you narrow and
          view the list, right of it is what you do to it, which is the arrangement the reference
          uses (search and filters left, Import / Add right) and the one this row already had in
          miniature with its bulk actions.
        */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {/* How stale the status figures are, next to the control that refreshes them. Without it
              a refresh button is a button you press on a hunch — the reader cannot tell whether the
              screen is a minute old or an hour. Rendered only once the clock is known. */}
          {polledMinsAgo !== null && (
            <span style={{ fontSize: "10px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>
              {polledMinsAgo < 1 ? t.checkedJustNow : t.checkedMinsAgo(polledMinsAgo)}
            </span>
          )}
          {/*
            Secondary actions carry no box.

            They were bordered buttons at 10px, which was the wrong fix for the right complaint:
            the toolbar felt loud, so the type was shrunk — but what draws the eye on a control is
            the border and the fill, not the letters, so the row stayed loud and only got harder to
            read. Take the box away and the action recedes on its own; then the label can be the
            same size as the table it sits above.

            Zapier's table footer is the reference — New record / Import / Export / Download as
            borderless icon-and-text, with the one filled button kept for the action that makes
            something. Hover brings a tint back, so the target is still findable by pointing.
          */}
          <button className="portal-btn-quiet" onClick={() => setLastPolledAt(Date.now())} title={t.refresh} aria-label={t.refresh}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RotateCw size={14} strokeWidth={2.4} />
            {t.refresh}
          </button>
          {/* Beside Export, and before it: the first thing a new site does is put a list in,
              and the round trip this reads is the one Export writes. Behind the same edit gate
              as adding a camera — this is the same act, three hundred times. */}
          {mayEdit && (
            <button className="portal-btn-quiet" onClick={() => setShowImport(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9.33V1.75M7 1.75 4.08 4.67M7 1.75 9.92 4.67M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.22" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t.importCsv}
            </button>
          )}
          <button className="portal-btn-quiet" onClick={exportCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.75V9.33M7 9.33 4.08 6.42M7 9.33 9.92 6.42M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.22" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t.exportCsv}
            </button>
          {/* One primary action for both kinds, because "add a source" is one intention with two
              answers — a menu is what keeps the header from growing a second primary button that
              competes with this one. */}
          <div ref={addMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            {/* Export stays. A read-only account still needs the fleet list as a file — that is
                most of what the role is for. Adding is what goes. */}
            <button className="portal-btn-primary" onClick={() => setAddMenuOpen(o => !o)}
              disabled={!mayEdit || cannotAddSource}
              title={!mayEdit ? readOnlyReason : channelLimitUnrecorded ? t.noLicenceReason : zeroChannelLicence ? t.zeroChannelReason : atChannelLimit ? t.atLimitReason(channelLimit ?? 0) : undefined}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: (mayEdit && !cannotAddSource) ? "var(--primary-400)" : "var(--gray-200)", color: (mayEdit && !cannotAddSource) ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: (mayEdit && !cannotAddSource) ? "pointer" : "not-allowed" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addSource}
            </button>
            {addMenuOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 60,
                backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
                minWidth: "200px", padding: "4px",
              }}>
                {[
                  { label: t.addCameraOption, onClick: () => setShowAdd(true) },
                  { label: t.uploadFileOption, onClick: () => setUploadPurpose("media") },
                  { label: t.deepfakeFileOption, onClick: () => setUploadPurpose("deepfake") },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setAddMenuOpen(false); item.onClick(); }}
                    onMouseEnter={() => setHoveredAddItem(item.label)}
                    onMouseLeave={() => setHoveredAddItem(null)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: "6px",
                      border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                      backgroundColor: hoveredAddItem === item.label ? "var(--gray-100)" : "transparent",
                      fontSize: "12px", fontWeight: 600, color: "var(--gray-900)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        What you can do with a selection: a bar that appears at the foot of the window.

        These four controls used to be appended to the toolbar, which meant the row reflowed the
        moment you ticked a box — the filters you had just set jumped left, and on a narrow window
        the whole strip wrapped to two lines. Selection is a mode, and a mode gets its own surface:
        the counts on the left say what you are acting on, the actions sit on the right, and
        nothing above moves. Same pattern as the reference's bottom bar.

        A centred pill rather than a full-width band: `position: fixed` is relative to the window,
        and a band across it would run under the rail, which belongs to no page.
      */}
      {visibleSelectedIds.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "24px", zIndex: 40, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{
            pointerEvents: "auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
            backgroundColor: "var(--gray-900)", borderRadius: "12px", padding: "10px 12px 10px 18px",
            boxShadow: "0 12px 32px rgba(14,22,42,0.28)", maxWidth: "calc(100% - 48px)",
          }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "white", flexShrink: 0 }}>
              {t.selectedCount(visibleSelectedIds.length)}
            </span>
            <span style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--gray-700)" }} />
            {/* Selecting rows is still allowed — it is how you count a subset. The two things
                that change them are what a read-only account loses, and the bar says so rather
                than showing two dead buttons. */}
            {mayEdit ? (<>
              <FilterSelect
                fitContent
                value=""
                onChange={zone => { if (zone) bulkMoveToZone(zone); }}
                options={[{ value: "", label: t.bulkMoveToZone }, ...zones.map(z => ({ value: z, label: z }))]}
              />
              <button
                onClick={() => setConfirmingBulkDelete(true)}
                style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
              >
                {t.bulkDelete}
              </button>
            </>) : (
              <span style={{ fontSize: "12px", color: "var(--gray-400)", flexShrink: 0 }}>{readOnlyReason}</span>
            )}
            {/* The way out of the mode, and the reason the bar can be this assertive: nothing here
                is reachable by accident, and one click puts the page back. */}
            <button
              onClick={clearSelection}
              style={{ border: "none", background: "none", padding: "0 8px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", fontFamily: "inherit", flexShrink: 0 }}
            >
              {t.bulkClearSelection}
            </button>
          </div>
        </div>
      )}

      {/* Table's own column header stays fixed with everything above it — only the data rows
          scroll underneath. Rendered here (still inside the fixed/sticky block) as the top half of
          the card; the data rows below are the bottom half, in normal flow, meeting it with no
          border between them so the two halves read as one continuous card. */}
      {effectiveView === "table" && visibleRows.length > 0 && (
        <div style={{ backgroundColor: "white", border: BORDER, borderBottom: "none", borderTopLeftRadius: "12px", borderTopRightRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {/* The thumbnail, address and AI-engine columns carry no sortKey — a picture has no
                order, an address sorts by whatever the IP happens to start with, and AI engines is
                a set per camera rather than one value. */}
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label={t.selectAllLabel}
              style={{ accentColor: "var(--gray-900)", cursor: "pointer", justifySelf: "start" }}
            />
            {([
              { label: "" },
              { label: t.colCamera, key: "name" },
              { label: t.colSource },
              ...(showCameraColumns ? [{ label: t.colServer, key: "server" as CameraSortKey }, { label: t.colZone, key: "zone" as CameraSortKey }] : []),
              { label: t.colAddress },
              { label: t.colStatus, key: "status" },
              { label: "" },
            ] as { label: string; key?: CameraSortKey }[]).map((h, i) => (
              <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
            ))}
          </div>
        </div>
      )}
      </div>

      {visibleRows.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {projectCameras.length + projectUploads.length === 0 ? t.emptyNoSources : t.emptyFiltered}
          </p>
        </div>
      ) : effectiveView === "table" ? (
        // No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that opens
        // past the bottom edge (the last row's menu becomes invisible, not just cut off).
        // Header/last-row corners are radiused directly instead. Top border/radius omitted — the
        // fixed column-header block above already draws that edge, and the two must read as one card.
        <div style={{ backgroundColor: "white", borderLeft: BORDER, borderRight: BORDER, borderBottom: BORDER, boxShadow: PANEL_SHADOW }}>
          {visibleRows.map((row, i) => {
            const isLast = i === visibleRows.length - 1;
            const rowStyle: React.CSSProperties = {
              display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
              borderBottom: isLast ? "none" : BORDER,
              borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
            };
            /**
             * The whole row opens the camera, and lights up under the pointer.
             *
             * Three separate things in the row already opened it — the thumbnail, the name, the
             * menu's Preview — while the eighty per cent of the row between them did nothing, and
             * nothing about the row said it could be clicked at all. A table whose rows lead
             * somewhere should say so before it is clicked.
             *
             * The controls inside stop the event: a checkbox is a selection, not a visit, and the
             * ⋯ menu opening the camera behind its own dropdown would be absurd.
             */
            const rowInteraction = row.kind === "camera"
              ? {
                className: "portal-attention-row",
                role: "button",
                tabIndex: 0,
                style: { ...rowStyle, cursor: "pointer" },
                onClick: () => setInspectingCameraId(row.camera.id),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInspectingCameraId(row.camera.id); }
                },
              }
              : { style: rowStyle };
            const stopRowClick = { onClick: (e: React.MouseEvent) => e.stopPropagation() };
            const checkbox = (
              <input
                {...stopRowClick}
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleRow(row.id)}
                aria-label={row.name}
                style={{ accentColor: "var(--gray-900)", cursor: "pointer", justifySelf: "start" }}
              />
            );

            if (row.kind !== "camera") {
              const u = row.upload;
              const tone = UPLOAD_STATUS_TONE[u.status];
              // Only once the check has finished — a queued submission has no verdict and keeps the
              // ordinary pipeline word.
              const verdict = u.status === "done" ? u.deepfakeVerdict : undefined;
              // Red for the one answer that is news. Authentic is the expected result and
              // inconclusive is the absence of a result; colouring either would make three
              // verdicts read as three alarms.
              const verdictDot = verdict === "manipulated" ? "var(--danger-400)"
                : verdict === "authentic" ? "var(--gray-900)" : "var(--gray-300)";
              return (
                <div key={row.id} style={rowStyle}>
                  {checkbox}
                  {/* A file has no live thumbnail to show, so the tile carries its kind instead of
                      a frame we do not have. Inventing a poster image would imply the analysis had
                      already looked at it. */}
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "8px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)" }}>
                    {u.kind === "image" ? <ImageIcon size={18} strokeWidth={1.87} />
                      : u.kind === "deepfake" ? <ShieldCheck size={18} strokeWidth={1.87} />
                      : <FilmIcon size={18} strokeWidth={1.87} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fileName}</p>
                    <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                      {[formatDuration(u.durationSec), formatBytes(u.sizeBytes)].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gray-600)" }}>
                    {u.kind === "image" ? <ImageIcon size={13} strokeWidth={2.58} />
                      : u.kind === "deepfake" ? <ShieldCheck size={13} strokeWidth={2.58} />
                      : <FilmIcon size={13} strokeWidth={2.58} />}
                    {u.kind === "image" ? t.sourceImage : u.kind === "deepfake" ? t.sourceDeepfake : t.sourceVideo}
                  </span>
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  <span style={{ fontSize: "10px", color: "var(--gray-600)", fontFamily: "monospace" }}>{u.resolution ?? "—"}</span>
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: verdict ? verdictDot : tone.dot, flexShrink: 0 }} />
                    {/* A finished deepfake row says the verdict here instead of "Analysed". The
                        pipeline word is only news while the answer is missing; once it is there,
                        printing both makes the reader step over "Analysed" to reach it. */}
                    {!verdict && <span style={{ fontSize: "12px", fontWeight: 700, color: tone.text }}>{t[tone.label]}</span>}
                    {u.status === "done" && u.kind !== "deepfake" && u.detectionCount !== undefined && (
                      <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{t.detectionsFound(u.detectionCount)}</span>
                    )}
                    {/* A deepfake row's result is a judgement, not a count — and the score travels
                        with it, because "manipulated" at 41% and at 94% are the same word and very
                        different news. Only "manipulated" is coloured: authentic is the expected
                        answer and inconclusive is an absence of one, and painting either would
                        make three verdicts look like three alarms. */}
                    {verdict && (
                      <>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: verdict === "manipulated" ? "var(--danger-400)" : "var(--gray-900)" }}>
                          {verdict === "manipulated" ? t.verdictManipulated
                            : verdict === "authentic" ? t.verdictAuthentic
                            : t.verdictInconclusive}
                        </span>
                        {u.deepfakeScore !== undefined && (
                          <span style={{ fontSize: "10px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.verdictScore(u.deepfakeScore)}</span>
                        )}
                      </>
                    )}
                  </span>
                  <RowActionsMenu actions={[
                    { label: t.removeUploadAction, onClick: () => { removeUpload(u.id); showToast({ variant: "warning", title: t.toastUploadRemovedTitle, desc: u.fileName }); }, danger: true, disabled: !mayEdit, reason: readOnlyReason },
                  ]} />
                </div>
              );
            }

            const cam = row.camera;
            return (
              <div key={row.id} {...rowInteraction}>
                {checkbox}
                <button {...stopRowClick} onClick={() => setInspectingCameraId(cam.id)} style={{ width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--gray-100)", border: "none", cursor: "pointer", padding: 0 }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.name}</p>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gray-600)" }}>
                  <VideoIcon size={13} strokeWidth={2.58} />
                  {t.sourceCamera}
                </span>
                {/* The server, where the maker used to be. A make is settled at purchase and is
                    not what anybody scans a list for; the server is the answer to "why is this one
                    doing nothing", and until now it appeared on no screen at all — not in this
                    table and not on the camera's own sheet, where it now sits with the maker. */}
                {showCameraColumns && (
                  <span style={{ fontSize: "12px", color: cam.serverId ? "var(--gray-600)" : "var(--gray-300)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {projectServers.find(sv => sv.id === cam.serverId)?.name ?? "—"}
                  </span>
                )}
                {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.zone}</span>}
                {/* The IP, not the RTSP URL — and resolution under it, in the same column a file
                    fills with its resolution alone. (Two separate columns left one of them blank on
                    every row of the other kind.)

                    It printed the full stream address until 2026-09-09, which is forty characters
                    of scheme, host, port and path in a cell narrow enough to cut it after about
                    twenty-five: every row ended in an ellipsis and no two rows differed anywhere
                    you could see. The address that identifies a camera at a glance is the host, so
                    that is what is printed. The full URL is still searchable and still on the
                    camera's own sheet, where there is room to read it. */}
                {/* 11px monospace, not 10. These are the only cells on the page read a character
                    at a time — an address is checked digit by digit against a switch or a label on
                    a wall — and they were the smallest text in the table. Monospace runs narrow, so
                    11 here sits at about the width of the 12px column beside it. */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "11px", color: "var(--gray-500)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.ip}</p>
                  <p style={{ fontSize: "11px", color: "var(--gray-600)", fontFamily: "monospace" }}>{cam.resolution ?? "—"}</p>
                </div>
                {/* The status pill is also the control that changes it. For a reader who cannot
                    change it, it goes back to being a pill. */}
                <button onClick={() => mayEdit && setConfirmingStatusCam(cam)} disabled={!mayEdit} title={readOnlyReason} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: mayEdit ? "pointer" : "default", padding: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, backgroundColor: cam.status === "online" ? "var(--success-400)" : cam.status === "error" ? "var(--danger-400)" : "var(--gray-400)" }} />
                  {/* Three states, three words. Error is the only one in danger red: offline is a
                      camera that stopped talking, which is common and often expected, while an
                      error is the server being refused — something typed wrong that somebody can
                      fix from this screen. */}
                  <span style={{
                    fontSize: "12px", fontWeight: 700,
                    color: cam.status === "online" ? "var(--success-400)" : cam.status === "error" ? "var(--danger-400)" : "var(--gray-400)",
                  }}>
                    {cam.status === "online" ? t.online : cam.status === "error" ? t.statusError : t.offline}
                  </span>
                </button>
                {/* Preview first: it is the item somebody reaches for most and the only one that
                    answers "is this camera actually seeing anything". The thumbnail opens the same
                    modal, but a thumbnail is not a control anyone is told about — a named item in
                    the menu is. */}
                <span {...stopRowClick}>
                {/* Preview stays open to everybody — looking at a camera is the auditor's job.
                    Only the two that change something take the gate. */}
                <RowActionsMenu actions={[
                  { label: t.previewAction, onClick: () => setInspectingCameraId(cam.id) },
                  { label: t.editAction, onClick: () => setEditingCamera(cam), disabled: !mayEdit, reason: readOnlyReason },
                  { label: t.removeAction, onClick: () => handleDelete(cam), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                ]} />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {kindTab === "ALL" && projectUploads.length > 0 && (
            <p style={{ fontSize: "11px", color: "var(--gray-400)" }}>{t.gridCamerasOnly}</p>
          )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {visibleCameras.map(cam => {
            const online = cam.status === "online";
            // The card cannot clip: the ⋯ menu drops out of its top row, and an overflow:hidden
            // card would cut it off at its own edge. The thumbnail rounds its own top corners
            // instead, which is all that hiding was doing.
            return (
              <div key={cam.id} style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", border: "none", padding: 0, cursor: "pointer", display: "block", backgroundColor: "var(--gray-900)", overflow: "hidden", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: online ? 1 : 0.4 }} />
                  <span style={{
                    position: "absolute", top: "8px", left: "8px", fontSize: "10px", fontWeight: 600, padding: "4px 8px", borderRadius: "999px",
                    backgroundColor: cam.status === "online" ? "rgba(22,163,74,0.9)" : cam.status === "error" ? "rgba(244,63,94,0.9)" : "rgba(148,163,184,0.9)", color: "white",
                  }}>
                    {(cam.status === "online" ? t.online : cam.status === "error" ? t.statusError : t.offline).toUpperCase()}
                  </span>
                </button>
                {/* No footer strip. It carried the AI-engine badges — which for a camera with no
                    engine printed a bare em dash, so most cards ended in a rule with a dash under
                    it — and two icon buttons whose meaning you had to hover to learn. The card
                    now ends where its content ends, and everything you can do to it is behind the
                    same ⋯ menu the table rows use: one place per row, named actions, and the
                    destructive one marked. */}
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "monospace", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.code}</p>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", flexShrink: 0 }}>{cam.zone}</span>
                    <RowActionsMenu actions={[
                      { label: t.editAction, onClick: () => setEditingCamera(cam), disabled: !mayEdit, reason: readOnlyReason },
                      { label: t.toggleStatusTitle, onClick: () => setConfirmingStatusCam(cam), disabled: !mayEdit, reason: readOnlyReason },
                      { label: t.removeAction, onClick: () => handleDelete(cam), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                    ]} />
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", marginTop: "2px" }}>{cam.name}</p>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Same drop-zone shape Redmap's image upload already uses — dashed border on a gray-50 field
          with a Choose button — so the two upload surfaces in the product are one pattern. Accepts
          video as well as image, which is the only real difference. */}
      {uploadPurpose && (
        <div onClick={e => { if (e.target === e.currentTarget) setUploadPurpose(null); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "520px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
            <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{uploadPurpose === "deepfake" ? t.deepfakeUploadTitle : t.uploadTitle}</p>
              <button onClick={() => setUploadPurpose(null)} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); acceptFiles(e.dataTransfer.files); }}
                style={{
                  borderRadius: "12px", border: `1px dashed ${dragging ? "var(--gray-900)" : "var(--gray-300)"}`,
                  backgroundColor: dragging ? "var(--gray-100)" : "var(--gray-50)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: "12px", padding: "32px 24px", textAlign: "center",
                }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)" }}>
                  <FilmIcon size={22} strokeWidth={1.53} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>{t.uploadDrop}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6 }}>{uploadPurpose === "deepfake" ? t.deepfakeUploadHint : t.uploadHint}</span>
                </div>
                <button className="portal-btn-primary" onClick={() => uploadInputRef.current?.click()}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700 }}>
                  {t.uploadChoose}
                </button>
                <input ref={uploadInputRef} type="file" multiple accept="video/*,image/*"
                  onChange={e => { acceptFiles(e.target.files); e.target.value = ""; }}
                  style={{ display: "none" }} />
              </div>
              {/* No "the analysis is not connected yet" line here any more (2026-09-09). It was a
                  sentence about the state of the build, printed inside the product — and the row's
                  own status already says "Queued", which is both true now and still true once the
                  endpoint lands and a real job waits its turn. The note would have had to be
                  deleted on the day the backend arrived; the status will not. The dependency is
                  recorded where it belongs, in the HANDOFF note on addUpload in vcaStore. */}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <CameraFormModal title={t.addModalTitle} initial={EMPTY_FORM} isEdit={false} servers={projectServers} onClose={() => setShowAdd(false)} onSubmit={createCamera} t={t} />
      )}
      {editingCamera && (
        <CameraFormModal
          title={t.editModalTitle}
          isEdit
          initial={{
            name: editingCamera.name, ip: editingCamera.ip, rtspUrl: editingCamera.rtspUrl,
            location: editingCamera.location, zone: editingCamera.zone,
            maker: editingCamera.maker ?? MAKERS[0], model: editingCamera.model ?? "",
            resolution: editingCamera.resolution ?? RESOLUTIONS[0],
            username: editingCamera.username ?? "",
            // Always blank. The store has no password to put here, which is the point.
            password: "",
            serverId: editingCamera.serverId ?? "",
            lat: String(editingCamera.lat ?? ""), lng: String(editingCamera.lng ?? ""),
            status: editingCamera.status,
          }}
          servers={projectServers}
          onClose={() => setEditingCamera(null)}
          onSubmit={saveEdit}
          t={t}
        />
      )}
      {inspectingCameraId && cameras.find(c => c.id === inspectingCameraId) && (
        <CameraStreamModal camera={cameras.find(c => c.id === inspectingCameraId) as Camera} onClose={() => setInspectingCameraId(null)} />
      )}
      {confirmingDeleteCam && (
        <ConfirmModal
          title={t.confirmDeleteCamTitle(confirmingDeleteCam.name)}
          body={t.confirmDeleteCamBody}
          confirmLabel={t.removeAction}
          cancelLabel={t.cancel}
          danger
          onConfirm={confirmDeleteCam}
          onClose={() => setConfirmingDeleteCam(null)}
        />
      )}
      {confirmingStatusCam && (
        <ConfirmStatusModal
          camera={confirmingStatusCam}
          nextStatus={confirmingStatusCam.status === "online" ? "offline" : "online"}
          onClose={() => setConfirmingStatusCam(null)}
          onConfirm={() => { toggleStatus(confirmingStatusCam); setConfirmingStatusCam(null); }}
          t={t}
        />
      )}
      {/* Confirmed, not undoable-with-a-toast: removing cameras in bulk takes a whole set of feeds
          off monitoring at once, and there is no restore. Says what actually happens and what does
          not, because "are you sure?" alone leaves people guessing about the recordings. */}
      {showImport && <CameraImportModal projectId={projectId} onClose={() => setShowImport(false)} />}

      {confirmingBulkDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmingBulkDelete(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)", padding: "20px" }}>
            <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.bulkDeleteConfirm(visibleSelectedIds.length)}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7, marginTop: "8px" }}>{t.bulkDeleteBody}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button className="portal-btn-outline" onClick={() => setConfirmingBulkDelete(false)}
                style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
              <button onClick={bulkDelete}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-500)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.bulkDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
