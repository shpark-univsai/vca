"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore, type Camera, type CameraAiFeature, type CameraStatus, projectChannelLimit } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, TABLE_COLUMN_GAP, CONTROL_HEIGHT, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

const T = {
  en: {
    pageTitle: "Cameras",
    pageDesc: "Connect and manage this project's camera streams and AI engine mapping.",
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
    metricAiCoverage: "AI Engine Coverage",
    aiMappedSuffix: (total: number) => `/ ${total} mapped`,
    metricZoneCoverage: "Zone Coverage",
    zonesSuffix: "zones",
    searchPlaceholder: "Search by camera name, code, RTSP URL, or IP address",
    filterAllZones: "All zones",
    filterAllStatus: "All status",
    filterAllAiEngines: "All AI engines",
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
    pageTitle: "카메라",
    pageDesc: "이 프로젝트의 카메라 스트림과 AI 엔진 연결을 관리합니다.",
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
    metricAiCoverage: "AI 엔진 커버리지",
    aiMappedSuffix: (total: number) => `/ ${total} 매핑됨`,
    metricZoneCoverage: "구역 커버리지",
    zonesSuffix: "구역",
    searchPlaceholder: "카메라 이름, 코드, RTSP URL, IP 주소로 검색",
    filterAllZones: "전체 구역",
    filterAllStatus: "전체 상태",
    filterAllAiEngines: "전체 AI 엔진",
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

const AI_FEATURES: CameraAiFeature[] = ["Re-ID Analysis", "License Plate Recognition", "Intrusion Detection"];
const MAKERS = ["Hanwha", "Hikvision", "Dahua"];
const RESOLUTIONS = ["FHD (1920×1080)", "4K (3840×2160)"];
const INPUT_KINDS = ["CCTV", "AI Camera"] as const;
type InputKind = typeof INPUT_KINDS[number];

interface CameraFormValues {
  name: string;
  location: string;
  zone: string;
  rtspUrl: string;
  resolution: string;
  maker: string;
  inputKind: InputKind;
  aiFeatures: CameraAiFeature[];
  status: CameraStatus;
}

const EMPTY_FORM: CameraFormValues = {
  name: "", location: "", zone: "", rtspUrl: "",
  resolution: RESOLUTIONS[0], maker: MAKERS[0], inputKind: "CCTV", aiFeatures: [], status: "offline",
};

// Camera codes are an internal identifier (shown in the table, used in mock RTSP paths) — the
// reference popup this modal now matches doesn't surface a code field, so it's derived from the
// name instead of typed in by the operator.
function generateCameraCode(name: string, existingCount: number): string {
  const prefix = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CAM";
  return `CAM-${prefix}-${String(existingCount + 1).padStart(3, "0")}`;
}

function CameraFormModal({
  title, initial, isEdit, onClose, onSubmit, t,
}: {
  title: string;
  initial: CameraFormValues;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (values: CameraFormValues) => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  useEscapeKey(onClose);
  const [form, setForm] = useState<CameraFormValues>(initial);
  const valid = form.name.trim().length > 0 && form.rtspUrl.trim().length > 0;

  const field = (key: "name" | "location" | "zone" | "rtspUrl", label: string, placeholder: string) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
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
          {field("name", t.fieldDeviceName, t.fieldDeviceNamePlaceholder)}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("location", t.fieldLocation, t.fieldLocationPlaceholder)}
            {field("zone", t.fieldZone, t.fieldZonePlaceholder)}
          </div>

          {field("rtspUrl", t.fieldRtspUrl, "rtsp://10.20.4.11:554/stream1")}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField(t.fieldResolution, form.resolution, RESOLUTIONS.map(r => ({ value: r, label: r })), v => setForm(f => ({ ...f, resolution: v })))}
            {selectField(t.fieldMaker, form.maker, MAKERS.map(m => ({ value: m, label: m })), v => setForm(f => ({ ...f, maker: v })))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField(t.fieldInputKind, form.inputKind, INPUT_KINDS.map(k => ({ value: k, label: k === "AI Camera" ? t.aiCameraOption : t.cctvOption })), v => setInputKind(v as InputKind))}
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function ProjectCamerasTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const addCamera = useVcaStore(s => s.addCamera);
  const updateCamera = useVcaStore(s => s.updateCamera);
  const removeCamera = useVcaStore(s => s.removeCamera);
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
  const [hoveredAction, setHoveredAction] = useState<"reconnect" | "export" | "add" | null>(null);

  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const zones = Array.from(new Set(projectCameras.map(c => c.zone).filter(Boolean)));
  const { sort, toggle: toggleSort } = useTableSort<CameraSortKey>({ key: "status", direction: "asc" });

  const q = search.trim().toLowerCase();
  const matchingCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesAi = aiFilter === "ALL" || (c.aiFeatures ?? []).includes(aiFilter);
    return matchesSearch && matchesZone && matchesStatus && matchesAi;
  });
  // Offline first by default. The table's job here is "what needs attention", and a fleet sorted
  // alphabetically buries the three cameras that are down among the ninety-seven that are not.
  // "desc" on status because the values sort "offline" < "online" alphabetically.
  const visibleCameras = sortRows(matchingCameras, sort, (c, key) => {
    switch (key) {
      case "name": return c.name.toLowerCase();
      case "maker": return c.maker?.toLowerCase();
      case "resolution": return c.resolution?.toLowerCase();
      case "zone": return c.zone?.toLowerCase();
      case "status": return c.status;
    }
  });

  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const offlineCount = projectCameras.length - onlineCount;
  const aiMappedCount = projectCameras.filter(c => (c.aiFeatures ?? []).length > 0).length;
  const zoneCounts = zones
    .map(zone => ({ zone, count: projectCameras.filter(c => c.zone === zone).length }))
    .sort((a, b) => b.count - a.count);

  const limit = project ? projectChannelLimit(project) : undefined;
  const overLimit = !!limit && projectCameras.length > limit;

  const createCamera = (values: CameraFormValues) => {
    addCamera({
      projectId, name: values.name.trim(), code: generateCameraCode(values.name.trim(), projectCameras.length), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, resolution: values.resolution, aiFeatures: values.aiFeatures,
      ip: "", mac: "", status: values.status, thumbnail: DEFAULT_THUMBNAIL, lat: 0, lng: 0,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: t.toastCameraAddedTitle, desc: t.toastCameraAddedDesc(values.name.trim()) });
  };

  const saveEdit = (values: CameraFormValues) => {
    if (!editingCamera) return;
    updateCamera(editingCamera.id, {
      name: values.name.trim(), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, resolution: values.resolution, aiFeatures: values.aiFeatures,
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
          <button onClick={() => setShowAdd(true)}
            onMouseEnter={() => setHoveredAction("add")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, filter: hoveredAction === "add" ? "brightness(0.92)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {t.addCamera}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
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
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{t.metricAiCoverage.toUpperCase()}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{aiMappedCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>{t.aiMappedSuffix(projectCameras.length)}</span></p>
          </div>
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{t.metricZoneCoverage.toUpperCase()}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{zones.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>{t.zonesSuffix}</span></p>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {zoneCounts.slice(0, 3).map(z => `${z.zone} (${z.count})`).join(" · ") || "—"}
            </p>
          </div>
        </div>
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
      </div>

      {/* Table's own column header stays fixed with everything above it — only the data rows
          scroll underneath. Rendered here (still inside the fixed/sticky block) as the top half of
          the card; the data rows below are the bottom half, in normal flow, meeting it with no
          border between them so the two halves read as one continuous card. */}
      {view === "table" && visibleCameras.length > 0 && (
        <div style={{ backgroundColor: "white", border: BORDER, borderBottom: "none", borderTopLeftRadius: "12px", borderTopRightRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 0.7fr 0.7fr 0.7fr 1.1fr 1fr 0.8fr 70px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {/* The thumbnail, RTSP URL and AI-engine columns carry no sortKey — a picture has no
                order, a stream URL sorts by whatever the IP happens to start with, and AI engines
                is a set per camera rather than one value. */}
            {([
              { label: "" },
              { label: t.colCamera, key: "name" },
              { label: t.colMaker, key: "maker" },
              { label: t.colResolution, key: "resolution" },
              { label: t.colZone, key: "zone" },
              { label: t.colRtspStream },
              { label: t.colAiEngines },
              { label: t.colStatus, key: "status" },
              { label: "" },
            ] as { label: string; key?: CameraSortKey }[]).map((h, i) => (
              <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
            ))}
          </div>
        </div>
      )}
      </div>

      {visibleCameras.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {projectCameras.length === 0 ? t.emptyAll : t.emptyFiltered}
          </p>
        </div>
      ) : view === "table" ? (
        // No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that opens
        // past the bottom edge (the last row's menu becomes invisible, not just cut off).
        // Header/last-row corners are radiused directly instead. Top border/radius omitted — the
        // fixed column-header block above already draws that edge, and the two must read as one card.
        <div style={{ backgroundColor: "white", borderLeft: BORDER, borderRight: BORDER, borderBottom: BORDER, boxShadow: PANEL_SHADOW }}>
          {visibleCameras.map((cam, i) => {
            const online = cam.status === "online";
            const isAiCamera = (cam.aiFeatures ?? []).length > 0;
            const isLast = i === visibleCameras.length - 1;
            return (
              <div key={cam.id} style={{
                display: "grid", gridTemplateColumns: "56px 1.3fr 0.7fr 0.7fr 0.7fr 1.1fr 1fr 0.8fr 70px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                borderBottom: isLast ? "none" : BORDER,
                borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
              }}>
                <button onClick={() => setInspectingCameraId(cam.id)} style={{ width: "40px", height: "40px", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--gray-100)", border: "none", cursor: "pointer", padding: 0 }}>
                  <img src={cam.thumbnail || DEFAULT_THUMBNAIL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{cam.name}</p>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: isAiCamera ? "var(--gray-900)" : "var(--gray-500)", backgroundColor: isAiCamera ? "var(--gray-200)" : "var(--gray-100)", padding: "1px 5px", borderRadius: "999px" }}>
                      {isAiCamera ? t.aiCameraBadge : t.cctvBadge}
                    </span>
                  </div>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.maker ?? "—"}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-600)" }}>{cam.resolution ?? "—"}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.zone}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.rtspUrl}</span>
                <AiFeatureBadges features={cam.aiFeatures} t={t} />
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
      )}

      {showAdd && (
        <CameraFormModal title={t.addModalTitle} initial={EMPTY_FORM} isEdit={false} onClose={() => setShowAdd(false)} onSubmit={createCamera} t={t} />
      )}
      {editingCamera && (
        <CameraFormModal
          title={t.editModalTitle}
          isEdit
          initial={{
            name: editingCamera.name, rtspUrl: editingCamera.rtspUrl,
            location: editingCamera.location, zone: editingCamera.zone,
            maker: editingCamera.maker ?? MAKERS[0], resolution: editingCamera.resolution ?? RESOLUTIONS[0],
            inputKind: (editingCamera.aiFeatures ?? []).length > 0 ? "AI Camera" : "CCTV",
            aiFeatures: editingCamera.aiFeatures ?? [],
            status: editingCamera.status,
          }}
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
    </div>
  );
}
