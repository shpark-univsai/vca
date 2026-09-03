"use client";

import { useEffect, useRef, useState } from "react";
import { Film as FilmIcon, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { useVcaStore, type Camera, type CameraAiFeature, type CameraStatus, type UploadedMedia, type UploadStatus, projectChannelLimit, SIGNED_IN_USER } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, TABLE_COLUMN_GAP, CONTROL_HEIGHT, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, ActiveFilterCount } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

const T = {
  en: {
    pageTitle: "Input Sources",
    pageDesc: "Camera streams and uploaded footage — everything this project feeds to analysis.",
    reconnectAll: "Reconnect All",
    exportCsv: "Export CSV",
    addCamera: "Add camera",
    metricChannelUsage: "Channel Usage",
    noLicenseLimit: "No license limit set",
    metricStreamHealth: "Stream Health",
    online: "Online",
    offline: "Offline",
    onlineSuffix: "online",
    offlineSuffix: (n: number) => `${n} offline`,
    searchPlaceholder: "Search by camera name, code, RTSP URL, or IP address",
    filterAllZones: "All zones",
    filterAllStatus: "All status",
    filterAllAiEngines: "All AI engines",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "All",
    kindTabCamera: "Cameras",
    kindTabVideo: "Videos",
    kindTabImage: "Images",
    colSource: "Source",
    sourceCamera: "Camera",
    sourceAiCamera: "AI camera",
    sourceVideo: "Video",
    sourceImage: "Image",
    colAddress: "Address / Resolution",
    uploadsSuffix: (n: number) => `${n} uploaded`,
    metricUploads: "Uploads waiting",
    uploadsWaitingSub: (total: number, done: number) => `${total} total · ${done} analysed`,
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
    uploadPendingNotice: "Analysis runs on the server and is not connected yet — uploads stay queued.",
    toastUploadedTitle: "Uploaded",
    removeUploadAction: "Remove upload",
    toastUploadRemovedTitle: "Upload removed",
    emptyNoSources: "Nothing registered for this project yet.",
    gridCamerasOnly: "Grid shows cameras only — switch to Table to see uploaded footage.",
    fieldIp: "IP address",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "Model",
    fieldModelPlaceholder: "e.g. XNP-6400R",
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
    colMaker: "Maker",
    colResolution: "Resolution",
    colZone: "Zone",
    colRtspStream: "RTSP Stream",
    colAiEngines: "AI Engines",
    colStatus: "Status",
    emptyAll: "No cameras connected to this project yet.",
    emptyFiltered: "No cameras match these filters.",
    aiCameraBadge: "AI Camera",
    cctvBadge: "CCTV",
    toggleStatusTitle: "Toggle status",
    removeCameraTitle: "Remove camera",
    editAction: "Edit",
    removeAction: "Remove",
    addModalTitle: "Add Input Device",
    editModalTitle: "Edit Input Device",
    fieldDeviceName: "Device name *",
    fieldDeviceNamePlaceholder: "e.g. Novena",
    fieldLocation: "Location",
    fieldLocationPlaceholder: "e.g. Entrance",
    fieldZone: "Zone",
    fieldZonePlaceholder: "e.g. Front Gate",
    fieldRtspUrl: "Connection — RTSP URL *",
    fieldResolution: "Resolution",
    fieldMaker: "Maker",
    fieldInputKind: "Input kind",
    fieldStatus: "Status",
    aiCameraOption: "AI Camera",
    cctvOption: "CCTV",
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
    toastBatchReconnectTitle: "Batch reconnect complete",
    toastBatchReconnectDesc: (n: number) => `${n} camera(s) reconnected.`,
    toastExportTitle: "Export complete",
    toastExportDesc: (n: number) => `${n} camera(s) exported to CSV.`,
    csvHeaderName: "Name",
    csvHeaderCode: "Code",
    csvHeaderZone: "Zone",
    csvHeaderLocation: "Location",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "Status",
    csvHeaderAiFeatures: "AI Features",
    aiFeatureLabels: {
      "Re-ID Analysis": "Re-ID Analysis",
      "License Plate Recognition": "License Plate Recognition",
      "Intrusion Detection": "Intrusion Detection",
    } as Record<CameraAiFeature, string>,
  },
  ko: {
    pageTitle: "입력 소스",
    pageDesc: "카메라 스트림과 업로드한 영상 — 이 프로젝트가 분석에 넣는 모든 것.",
    reconnectAll: "전체 재연결",
    exportCsv: "CSV 내보내기",
    addCamera: "카메라 추가",
    metricChannelUsage: "채널 사용량",
    noLicenseLimit: "라이선스 제한 없음",
    metricStreamHealth: "스트림 상태",
    online: "온라인",
    offline: "오프라인",
    onlineSuffix: "온라인",
    offlineSuffix: (n: number) => `${n} 오프라인`,
    searchPlaceholder: "카메라 이름, 코드, RTSP URL, IP 주소로 검색",
    filterAllZones: "전체 구역",
    filterAllStatus: "전체 상태",
    filterAllAiEngines: "전체 AI 엔진",
    filtersActive: (n: number) => `필터 ${n}개`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "전체",
    kindTabCamera: "카메라",
    kindTabVideo: "영상",
    kindTabImage: "이미지",
    colSource: "종류",
    sourceCamera: "카메라",
    sourceAiCamera: "AI 카메라",
    sourceVideo: "영상",
    sourceImage: "이미지",
    colAddress: "주소 / 해상도",
    uploadsSuffix: (n: number) => `업로드 ${n}건`,
    metricUploads: "업로드 대기",
    uploadsWaitingSub: (total: number, done: number) => `전체 ${total}건 · 분석 완료 ${done}건`,
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
    uploadPendingNotice: "분석은 서버에서 돌아가며 아직 연결되지 않았습니다 — 업로드는 대기 상태로 남습니다.",
    toastUploadedTitle: "업로드됨",
    removeUploadAction: "업로드 삭제",
    toastUploadRemovedTitle: "업로드가 삭제됨",
    emptyNoSources: "이 프로젝트에 등록된 소스가 없습니다.",
    gridCamerasOnly: "그리드는 카메라만 보여줍니다 — 업로드한 영상은 테이블에서 볼 수 있습니다.",
    fieldIp: "IP 주소",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "모델",
    fieldModelPlaceholder: "예: XNP-6400R",
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
    colMaker: "제조사",
    colResolution: "해상도",
    colZone: "구역",
    colRtspStream: "RTSP 스트림",
    colAiEngines: "AI 엔진",
    colStatus: "상태",
    emptyAll: "아직 이 프로젝트에 연결된 카메라가 없습니다.",
    emptyFiltered: "이 필터와 일치하는 카메라가 없습니다.",
    aiCameraBadge: "AI 카메라",
    cctvBadge: "CCTV",
    toggleStatusTitle: "상태 전환",
    removeCameraTitle: "카메라 삭제",
    editAction: "수정",
    removeAction: "삭제",
    addModalTitle: "입력 장치 추가",
    editModalTitle: "입력 장치 수정",
    fieldDeviceName: "기기 이름 *",
    fieldDeviceNamePlaceholder: "예: Novena",
    fieldLocation: "위치",
    fieldLocationPlaceholder: "예: 입구",
    fieldZone: "구역",
    fieldZonePlaceholder: "예: 정문 구역",
    fieldRtspUrl: "연결 — RTSP URL *",
    fieldResolution: "해상도",
    fieldMaker: "제조사",
    fieldInputKind: "입력 유형",
    fieldStatus: "상태",
    aiCameraOption: "AI 카메라",
    cctvOption: "CCTV",
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
    toastBatchReconnectTitle: "일괄 재연결 완료",
    toastBatchReconnectDesc: (n: number) => `카메라 ${n}대가 재연결되었습니다.`,
    toastExportTitle: "내보내기 완료",
    toastExportDesc: (n: number) => `카메라 ${n}대가 CSV로 내보내졌습니다.`,
    csvHeaderName: "이름",
    csvHeaderCode: "코드",
    csvHeaderZone: "구역",
    csvHeaderLocation: "위치",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "상태",
    csvHeaderAiFeatures: "AI 기능",
    aiFeatureLabels: {
      "Re-ID Analysis": "Re-ID 분석",
      "License Plate Recognition": "번호판 인식",
      "Intrusion Detection": "침입 감지",
    } as Record<CameraAiFeature, string>,
  },
} as const;

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
    // Where the header naturally sits within the scrollable content, measured once before
    // anything sticks — the scrollTop past which it should switch to fixed.
    const naturalTop = el.getBoundingClientRect().top - sp.getBoundingClientRect().top + sp.scrollTop;

    const update = () => {
      const spRect = sp.getBoundingClientRect();
      const spStyle = getComputedStyle(sp);
      const padLeft = parseFloat(spStyle.paddingLeft) || 0;
      const padRight = parseFloat(spStyle.paddingRight) || 0;
      const padTop = parseFloat(spStyle.paddingTop) || 0;
      setHeight(el.offsetHeight);
      setStuck(sp.scrollTop >= naturalTop);
      // top sits at the container's own border edge (not +padTop) so the fixed box's background
      // covers the container's top-padding strip too — otherwise that strip shows whatever
      // scrolled-content happens to align there once scrolled deep enough to clear it (bleed-
      // through). padTop is applied as inline padding below instead, so the header's own content
      // still visually lands at the same y it occupied in normal flow — no jump when it engages.
      setRect({ left: spRect.left + padLeft, top: spRect.top, width: spRect.width - padLeft - padRight, padTop });
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

const DEFAULT_THUMBNAIL = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80";
type CameraSortKey = "name" | "maker" | "resolution" | "zone" | "status";

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
type SourceKind = "camera" | "video" | "image";
type SourceRow =
  | { kind: "camera"; id: string; name: string; camera: Camera }
  | { kind: "video" | "image"; id: string; name: string; upload: UploadedMedia };

const AI_FEATURES: CameraAiFeature[] = ["Re-ID Analysis", "License Plate Recognition", "Intrusion Detection"];
const MAKERS = ["Hanwha", "Hikvision", "Dahua"];
const RESOLUTIONS = ["FHD (1920×1080)", "4K (3840×2160)"];
const INPUT_KINDS = ["CCTV", "AI Camera"] as const;
type InputKind = typeof INPUT_KINDS[number];

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
  inputKind: InputKind;
  aiFeatures: CameraAiFeature[];
  status: CameraStatus;
}

const EMPTY_FORM: CameraFormValues = {
  name: "", ip: "", location: "", zone: "", rtspUrl: "",
  resolution: RESOLUTIONS[0], maker: MAKERS[0], model: "", username: "", password: "",
  serverId: "", lat: "", lng: "",
  inputKind: "CCTV", aiFeatures: [], status: "offline",
};

// Camera codes are an internal identifier (shown in the table, used in mock RTSP paths) — the
// reference popup this modal now matches doesn't surface a code field, so it's derived from the
// name instead of typed in by the operator.
function generateCameraCode(name: string, existingCount: number): string {
  const prefix = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CAM";
  return `CAM-${prefix}-${String(existingCount + 1).padStart(3, "0")}`;
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
  const valid = form.name.trim().length > 0 && form.rtspUrl.trim().length > 0;

  const field = (
    key: "name" | "ip" | "location" | "zone" | "rtspUrl" | "model" | "username" | "password" | "lat" | "lng",
    label: string,
    placeholder: string,
    opts?: { type?: string; inputMode?: "decimal" },
  ) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        type={opts?.type}
        inputMode={opts?.inputMode}
        autoComplete={key === "password" ? "new-password" : undefined}
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }}
      />
    </div>
  );

  const selectField = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <FilterSelect value={value} onChange={onChange} options={options} />
    </div>
  );

  const setInputKind = (kind: InputKind) => {
    setForm(f => ({
      ...f,
      inputKind: kind,
      // Switching to AI Camera turns on a sensible default engine if none were mapped yet;
      // switching back to CCTV clears them — granular per-engine mapping still lives in the
      // camera detail view, this popup just decides whether any engine runs at all.
      aiFeatures: kind === "AI Camera" ? (f.aiFeatures.length > 0 ? f.aiFeatures : ["Re-ID Analysis"]) : [],
    }));
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "460px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Source type first, as two buttons rather than a select: it is a required choice
              between exactly two things and it changes what the rest of the form means. */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.fieldInputKind}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {INPUT_KINDS.map(kind => {
                const active = form.inputKind === kind;
                return (
                  <button key={kind} onClick={() => setInputKind(kind)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                      border: active ? "1px solid var(--gray-900)" : BORDER,
                      backgroundColor: active ? "var(--gray-100)" : "white",
                      color: active ? "var(--gray-900)" : "var(--gray-600)",
                      fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                    }}>
                    <VideoIcon size={16} strokeWidth={1.4} />
                    {kind === "AI Camera" ? t.aiCameraOption : t.cctvOption}
                  </button>
                );
              })}
            </div>
          </div>

          {field("name", t.fieldDeviceName, t.fieldDeviceNamePlaceholder)}
          {field("ip", t.fieldIp, t.fieldIpPlaceholder)}

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

          {field("rtspUrl", t.fieldRtspUrl, "rtsp://10.20.4.11:554/stream1")}

          {selectField(
            t.fieldServer,
            form.serverId,
            [{ value: "", label: t.fieldServerNone }, ...servers.map(sv => ({ value: sv.id, label: sv.name }))],
            v => setForm(f => ({ ...f, serverId: v })),
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("lat", t.fieldLat, "0.0", { inputMode: "decimal" })}
            {field("lng", t.fieldLng, "0.0", { inputMode: "decimal" })}
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
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
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
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{
              padding: "9px 16px", borderRadius: "999px", border: "none",
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

function AiFeatureBadges({ features, t }: { features?: CameraAiFeature[]; t: (typeof T)["en"] | (typeof T)["ko"] }) {
  if (!features || features.length === 0) return <span style={{ fontSize: "10px", color: "var(--gray-300)" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {features.map(f => (
        <span key={f} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-700)", backgroundColor: "var(--gray-100)", padding: "2px 6px", borderRadius: "999px" }}>{t.aiFeatureLabels[f]}</span>
      ))}
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

export default function ProjectCamerasTab({ projectId }: { projectId: string }) {
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
  const [confirmingStatusCam, setConfirmingStatusCam] = useState<Camera | null>(null);
  const [view, setView] = useState<"table" | "grid">("table");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "online" | "offline">("ALL");
  const [aiFilter, setAiFilter] = useState<"ALL" | CameraAiFeature>("ALL");
  // Which kind of source the table is showing. A tab row, not another select in the filter strip:
  // it is the top-level cut of the list, and the counts belong on it.
  const [kindTab, setKindTab] = useState<"ALL" | SourceKind>("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [hoveredAddItem, setHoveredAddItem] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<"reconnect" | "export" | "add" | null>(null);

  const projectCameras = cameras.filter(c => c.projectId === projectId);
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
  const activeFilterCount = [zoneFilter, statusFilter, aiFilter].filter(v => v !== "ALL").length;
  // Selected camera ids. Held as a Set of ids rather than of rows so a selection survives the list
  // being re-sorted or re-filtered underneath it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const clearFilters = () => { setZoneFilter("ALL"); setStatusFilter("ALL"); setAiFilter("ALL"); };

  const q = search.trim().toLowerCase();
  const matchingCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesAi = aiFilter === "ALL" || (c.aiFeatures ?? []).includes(aiFilter);
    return matchesSearch && matchesZone && matchesStatus && matchesAi;
  });
  const matchingUploads = projectUploads.filter(u => {
    const matchesSearch = !q || u.fileName.toLowerCase().includes(q);
    // Zone and AI-engine are camera properties. A file has neither, so any of those filters being
    // set means the person is looking at cameras and files should drop out — hiding them is the
    // honest answer, not showing them as if they had passed a filter they cannot be judged by.
    const cameraOnlyFilterSet = zoneFilter !== "ALL" || aiFilter !== "ALL";
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
        case "maker": return c.maker?.toLowerCase();
        case "resolution": return c.resolution?.toLowerCase();
        case "zone": return c.zone?.toLowerCase();
        case "status": return c.status;
      }
    }
    // A file has no maker and no zone — undefined sinks it to the bottom of those sorts rather
    // than inventing a value that would put it in a position it has not earned.
    switch (key) {
      case "name": return r.upload.fileName.toLowerCase();
      case "resolution": return undefined;
      case "status": return r.upload.status;
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
  const offlineCount = projectCameras.length - onlineCount;
  // Anything not yet analysed — queued or mid-run. Both are "not done", and an administrator does
  // the same thing about either: wait, or find out why.
  const pendingUploads = projectUploads.filter(u => u.status === "pending" || u.status === "analyzing").length;

  const limit = project ? projectChannelLimit(project) : undefined;
  const overLimit = !!limit && projectCameras.length > limit;

  // `password` is read off the form and dropped here on purpose — see CameraFormValues. Everything
  // else the form collects is stored.
  const createCamera = (values: CameraFormValues) => {
    addCamera({
      projectId, name: values.name.trim(), code: generateCameraCode(values.name.trim(), projectCameras.length), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, model: values.model.trim() || undefined, resolution: values.resolution, aiFeatures: values.aiFeatures,
      username: values.username.trim() || undefined, serverId: values.serverId || undefined,
      ip: values.ip.trim(), mac: "", status: values.status, thumbnail: DEFAULT_THUMBNAIL,
      lat: Number(values.lat) || 0, lng: Number(values.lng) || 0,
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
      lat: Number(values.lat) || 0, lng: Number(values.lng) || 0,
      aiFeatures: values.aiFeatures,
    });
    setEditingCamera(null);
    showToast({ variant: "success", title: t.toastCameraUpdatedTitle, desc: values.name.trim() });
  };

  const toggleStatus = (cam: Camera) => {
    const next = cam.status === "online" ? "offline" : "online";
    setCameraStatus(cam.id, next);
    showToast({ variant: next === "online" ? "success" : "default", title: next === "online" ? t.toastReconnectedTitle : t.toastDisconnectedTitle, desc: cam.name });
  };

  const handleDelete = (cam: Camera) => {
    removeCamera(cam.id);
    showToast({ variant: "warning", title: t.toastCameraRemovedTitle, desc: cam.name });
  };

  const batchReconnect = () => {
    const offline = projectCameras.filter(c => c.status === "offline");
    offline.forEach(c => setCameraStatus(c.id, "online"));
    showToast({ variant: "success", title: t.toastBatchReconnectTitle, desc: t.toastBatchReconnectDesc(offline.length) });
  };

  // Reads only what the browser can tell us without decoding the file: its name, size and whether
  // it is video or image. Duration and resolution come from the server once it has opened the file
  // — guessing them here would put numbers on screen that nothing measured.
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(f => f.type.startsWith("video/") || f.type.startsWith("image/"));
    accepted.forEach(f => addUpload({
      projectId,
      fileName: f.name,
      kind: f.type.startsWith("image/") ? "image" : "video",
      sizeBytes: f.size,
      uploadedBy: SIGNED_IN_USER.name,
    }));
    if (accepted.length === 0) return;
    setShowUpload(false);
    setKindTab("ALL");
    showToast({ variant: "success", title: t.toastUploadedTitle, desc: accepted.map(f => f.name).join(", ") });
  };

  const exportCsv = () => {
    const header = [t.csvHeaderName, t.csvHeaderCode, t.csvHeaderZone, t.csvHeaderLocation, t.csvHeaderRtspUrl, t.csvHeaderStatus, t.csvHeaderAiFeatures];
    const rows = projectCameras.map(c => [
      c.name, c.code, c.zone, c.location, c.rtspUrl, c.status === "online" ? t.online : t.offline,
      (c.aiFeatures ?? []).map(f => t.aiFeatureLabels[f]).join("; "),
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
        position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 20,
        backgroundColor: "var(--gray-100)", paddingTop: rect.padTop, paddingBottom: "16px",
      } : undefined}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.pageTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>{t.pageDesc}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={batchReconnect}
            onMouseEnter={() => setHoveredAction("reconnect")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: hoveredAction === "reconnect" ? "var(--gray-50)" : "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.reconnectAll}
          </button>
          <button onClick={exportCsv}
            onMouseEnter={() => setHoveredAction("export")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: hoveredAction === "export" ? "var(--gray-50)" : "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.75V9.33M7 9.33 4.08 6.42M7 9.33 9.92 6.42M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.exportCsv}
          </button>
          {/* One primary action for both kinds, because "add a source" is one intention with two
              answers — a menu is what keeps the header from growing a second primary button that
              competes with this one. */}
          <div ref={addMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setAddMenuOpen(o => !o)}
              onMouseEnter={() => setHoveredAction("add")} onMouseLeave={() => setHoveredAction(null)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", filter: hoveredAction === "add" ? "brightness(0.92)" : "none" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
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
                  { label: t.uploadFileOption, onClick: () => setShowUpload(true) },
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

      {/* Metrics */}
      <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
        {/* Three, not five. AI coverage and zone coverage were dropped: a ratio is only worth a card
            if there is a number you are trying to reach, and neither has one — most cameras are
            plain CCTV on purpose (AI and normal draw on the same channel quota at the same price),
            and a project having four zones rather than five is neither good nor bad. Channels have
            a hard ceiling, offline has a target of zero, and a queued upload is work not yet done. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{t.metricChannelUsage.toUpperCase()}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: overLimit ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>
              {projectCameras.length}{limit ? ` / ${limit}` : ""}
            </p>
            {limit ? (
              <div style={{ height: "4px", backgroundColor: "var(--gray-100)", borderRadius: "2px", marginTop: "8px" }}>
                <div style={{ height: "4px", width: `${Math.min(100, (projectCameras.length / limit) * 100)}%`, backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)", borderRadius: "2px" }} />
              </div>
            ) : <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>{t.noLicenseLimit}</p>}
          </div>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{t.metricStreamHealth.toUpperCase()}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-400)", marginTop: "6px" }}>{onlineCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>{t.onlineSuffix}</span></p>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>{t.offlineSuffix(offlineCount)}</p>
          </div>
          {/* Counted apart from the channel figure beside it, and led by the number that asks for
              something. The total says nothing to act on; the queue does. A file consumes no
              licensed channel, so it must never join the number measured against the licence —
              which is exactly what the previous product's "TOTAL CAMERAS 4" over seven rows did. */}
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{t.metricUploads.toUpperCase()}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, marginTop: "6px", color: pendingUploads > 0 ? "var(--warning-500)" : "var(--gray-300)" }}>
              {pendingUploads}
            </p>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>
              {t.uploadsWaitingSub(projectUploads.length, projectUploads.filter(u => u.status === "done").length)}
            </p>
          </div>
        </div>
      </div>

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

      {/* Search & filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: "100%", boxSizing: "border-box", height: CONTROL_HEIGHT, padding: "0 10px 0 30px", borderRadius: "10px",
              border: searchFocused ? "1px solid var(--gray-900)" : BORDER, outline: "none",
              boxShadow: searchFocused ? "0 0 0 3px var(--gray-100)" : "none",
              fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
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
          options={[{ value: "ALL", label: t.filterAllStatus }, { value: "online", label: t.online }, { value: "offline", label: t.offline }]}
        />
        <FilterSelect
          value={aiFilter}
          onChange={v => setAiFilter(v as typeof aiFilter)}
          options={[{ value: "ALL", label: t.filterAllAiEngines }, ...AI_FEATURES.map(f => ({ value: f, label: t.aiFeatureLabels[f] }))]}
        />
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
        {/* Bulk actions live in the toolbar rather than in a floating bar over the table: the
            toolbar is where every other thing that acts on the whole list already is, and a
            floating bar covers the rows you are deciding about. Only appears with a selection. */}
        {visibleSelectedIds.length > 0 && (
          <>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", flexShrink: 0 }}>
              {t.selectedCount(visibleSelectedIds.length)}
            </span>
            <FilterSelect
              fitContent
              value=""
              onChange={zone => { if (zone) bulkMoveToZone(zone); }}
              options={[{ value: "", label: t.bulkMoveToZone }, ...zones.map(z => ({ value: z, label: z }))]}
            />
            <button
              onClick={() => setConfirmingBulkDelete(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--danger-500)", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >
              {t.bulkDelete}
            </button>
            <button
              onClick={clearSelection}
              style={{ border: "none", background: "none", padding: "0 4px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", flexShrink: 0 }}
            >
              {t.bulkClearSelection}
            </button>
          </>
        )}
        {/* Grid is a wall of camera thumbnails, and an unanalysed file has no frame to put in one.
            Rather than let file rows vanish the moment someone picks Grid, the toggle is only
            offered on the tabs where both views can show the same rows — and `effectiveView` below
            makes sure a Grid choice made earlier does not silently hide the files. */}
        {showCameraColumns && (
        <div style={{ display: "flex", alignItems: "center", height: CONTROL_HEIGHT, boxSizing: "border-box", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "3px" }}>
          {(["table", "grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                height: "100%", padding: "0 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                fontSize: "12px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
              }}>
              {v === "table" ? t.viewTable : t.viewGrid}
            </button>
          ))}
        </div>
        )}
      </div>

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
              ...(showCameraColumns ? [{ label: t.colMaker, key: "maker" as CameraSortKey }, { label: t.colZone, key: "zone" as CameraSortKey }] : []),
              { label: t.colAddress },
              ...(showCameraColumns ? [{ label: t.colAiEngines }] : []),
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
            const checkbox = (
              <input
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
              return (
                <div key={row.id} style={rowStyle}>
                  {checkbox}
                  {/* A file has no live thumbnail to show, so the tile carries its kind instead of
                      a frame we do not have. Inventing a poster image would imply the analysis had
                      already looked at it. */}
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "8px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)" }}>
                    {u.kind === "image" ? <ImageIcon size={18} strokeWidth={1.4} /> : <FilmIcon size={18} strokeWidth={1.4} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fileName}</p>
                    <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                      {[formatDuration(u.durationSec), formatBytes(u.sizeBytes)].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--gray-600)" }}>
                    {u.kind === "image" ? <ImageIcon size={13} strokeWidth={1.4} /> : <FilmIcon size={13} strokeWidth={1.4} />}
                    {u.kind === "image" ? t.sourceImage : t.sourceVideo}
                  </span>
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  <span style={{ fontSize: "10px", color: "var(--gray-600)", fontFamily: "monospace" }}>{u.resolution ?? "—"}</span>
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: tone.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: tone.text }}>{t[tone.label]}</span>
                    {u.status === "done" && u.detectionCount !== undefined && (
                      <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{t.detectionsFound(u.detectionCount)}</span>
                    )}
                  </span>
                  <RowActionsMenu actions={[
                    { label: t.removeUploadAction, onClick: () => { removeUpload(u.id); showToast({ variant: "warning", title: t.toastUploadRemovedTitle, desc: u.fileName }); }, danger: true },
                  ]} />
                </div>
              );
            }

            const cam = row.camera;
            const online = cam.status === "online";
            const isAiCamera = (cam.aiFeatures ?? []).length > 0;
            return (
              <div key={row.id} style={rowStyle}>
                {checkbox}
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--gray-100)", border: "none", cursor: "pointer", padding: 0 }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.name}</p>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--gray-600)" }}>
                  <VideoIcon size={13} strokeWidth={1.4} />
                  {isAiCamera ? t.sourceAiCamera : t.sourceCamera}
                </span>
                {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.maker ?? "—"}</span>}
                {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.zone}</span>}
                {/* Stream address and resolution in one cell — the same column a file fills with
                    its resolution alone. Two separate columns left one of them blank on every row
                    of the other kind. */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.rtspUrl}</p>
                  <p style={{ fontSize: "10px", color: "var(--gray-600)", fontFamily: "monospace" }}>{cam.resolution ?? "—"}</p>
                </div>
                {showCameraColumns && <AiFeatureBadges features={cam.aiFeatures} t={t} />}
                <button onClick={() => setConfirmingStatusCam(cam)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--gray-400)", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: online ? "var(--success-400)" : "var(--gray-400)" }}>{online ? t.online : t.offline}</span>
                </button>
                <RowActionsMenu actions={[
                  { label: t.editAction, onClick: () => setEditingCamera(cam) },
                  { label: t.removeAction, onClick: () => handleDelete(cam), danger: true },
                ]} />
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
            return (
              <div key={cam.id} style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", border: "none", padding: 0, cursor: "pointer", display: "block", backgroundColor: "var(--gray-900)" }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: online ? 1 : 0.4 }} />
                  <span style={{
                    position: "absolute", top: "8px", left: "8px", fontSize: "10px", fontWeight: 600, padding: "3px 7px", borderRadius: "999px",
                    backgroundColor: online ? "rgba(22,163,74,0.9)" : "rgba(148,163,184,0.9)", color: "white",
                  }}>
                    {online ? t.online.toUpperCase() : t.offline.toUpperCase()}
                  </span>
                </button>
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "monospace" }}>{cam.code}</p>
                    <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{cam.zone}</span>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", marginTop: "2px" }}>{cam.name}</p>
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <AiFeatureBadges features={cam.aiFeatures} t={t} />
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setConfirmingStatusCam(cam)} title={t.toggleStatusTitle} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "2px" }}>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={() => handleDelete(cam)} title={t.removeCameraTitle} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "2px" }}>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                          <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
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
      {showUpload && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowUpload(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", maxWidth: "520px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
            <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.uploadTitle}</p>
              <button onClick={() => setShowUpload(false)} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                  <FilmIcon size={22} strokeWidth={1.3} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>{t.uploadDrop}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6 }}>{t.uploadHint}</span>
                </div>
                <button onClick={() => uploadInputRef.current?.click()}
                  style={{ padding: "9px 16px", borderRadius: "999px", border: "none", cursor: "pointer", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700 }}>
                  {t.uploadChoose}
                </button>
                <input ref={uploadInputRef} type="file" multiple accept="video/*,image/*"
                  onChange={e => { acceptFiles(e.target.files); e.target.value = ""; }}
                  style={{ display: "none" }} />
              </div>
              {/* Says the analysis has not run rather than showing a progress bar that finishes on
                  its own. A file sitting at "Queued" is the truth until the core has an endpoint. */}
              <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.6 }}>{t.uploadPendingNotice}</p>
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
            inputKind: (editingCamera.aiFeatures ?? []).length > 0 ? "AI Camera" : "CCTV",
            aiFeatures: editingCamera.aiFeatures ?? [],
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
      {confirmingBulkDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmingBulkDelete(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)", padding: "20px" }}>
            <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.bulkDeleteConfirm(visibleSelectedIds.length)}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7, marginTop: "8px" }}>{t.bulkDeleteBody}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button onClick={() => setConfirmingBulkDelete(false)}
                style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
              <button onClick={bulkDelete}
                style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--danger-500)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.bulkDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
