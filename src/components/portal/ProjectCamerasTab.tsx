"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore, type Camera, type CameraAiFeature, type CameraStatus, projectChannelLimit } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, RowActionsMenu, FilterSelect } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

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
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
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
      setHeight(el.offsetHeight);
      setStuck(sp.scrollTop >= naturalTop);
      setRect({ left: spRect.left + padLeft, top: spRect.top, width: spRect.width - padLeft - padRight });
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
  title, initial, isEdit, onClose, onSubmit,
}: {
  title: string;
  initial: CameraFormValues;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (values: CameraFormValues) => void;
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

  const selectField = (label: string, value: string, options: string[], onChange: (v: string) => void) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <FilterSelect value={value} onChange={onChange} options={options.map(o => ({ value: o, label: o }))} />
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
          {field("name", "Device name *", "e.g. Novena")}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("location", "Location", "e.g. Entrance")}
            {field("zone", "Zone", "e.g. Front Gate")}
          </div>

          {field("rtspUrl", "Connection — RTSP URL *", "rtsp://10.20.4.11:554/stream1")}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField("Resolution", form.resolution, RESOLUTIONS, v => setForm(f => ({ ...f, resolution: v })))}
            {selectField("Maker", form.maker, MAKERS, v => setForm(f => ({ ...f, maker: v })))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {selectField("Input kind", form.inputKind, [...INPUT_KINDS], v => setInputKind(v as InputKind))}
            {!isEdit && selectField("Status", form.status === "online" ? "Online" : "Offline", ["Online", "Offline"], v => setForm(f => ({ ...f, status: v === "Online" ? "online" : "offline" })))}
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {isEdit ? "Save changes" : "Add device"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStatusModal({
  camera, nextStatus, onClose, onConfirm,
}: {
  camera: Camera;
  nextStatus: "online" | "offline";
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onClose);
  const goingOffline = nextStatus === "offline";
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {goingOffline ? "Mark camera offline?" : "Reconnect camera?"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px" }}>
            {goingOffline
              ? `${camera.name} will show as offline for everyone monitoring this project — make sure the stream is actually down before confirming.`
              : `This attempts to reconnect ${camera.name} and marks it online. It doesn't verify the actual hardware, so if it's really still down, someone will need to mark it offline again.`}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{
              padding: "9px 16px", borderRadius: "999px", border: "none",
              backgroundColor: goingOffline ? "var(--danger-400)" : "var(--gray-900)", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
            }}>
            {goingOffline ? "Mark offline" : "Reconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AiFeatureBadges({ features }: { features?: CameraAiFeature[] }) {
  if (!features || features.length === 0) return <span style={{ fontSize: "10px", color: "var(--gray-300)" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {features.map(f => (
        <span key={f} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-700)", backgroundColor: "var(--gray-100)", padding: "2px 6px", borderRadius: "999px" }}>{f}</span>
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

  const q = search.trim().toLowerCase();
  const visibleCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesAi = aiFilter === "ALL" || (c.aiFeatures ?? []).includes(aiFilter);
    return matchesSearch && matchesZone && matchesStatus && matchesAi;
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
    showToast({ variant: "success", title: "Camera added", desc: `${values.name.trim()} connected to this project.` });
  };

  const saveEdit = (values: CameraFormValues) => {
    if (!editingCamera) return;
    updateCamera(editingCamera.id, {
      name: values.name.trim(), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, resolution: values.resolution, aiFeatures: values.aiFeatures,
    });
    setEditingCamera(null);
    showToast({ variant: "success", title: "Camera updated", desc: values.name.trim() });
  };

  const toggleStatus = (cam: Camera) => {
    const next = cam.status === "online" ? "offline" : "online";
    setCameraStatus(cam.id, next);
    showToast({ variant: next === "online" ? "success" : "default", title: next === "online" ? "Reconnected" : "Disconnected", desc: cam.name });
  };

  const handleDelete = (cam: Camera) => {
    removeCamera(cam.id);
    showToast({ variant: "warning", title: "Camera removed", desc: cam.name });
  };

  const batchReconnect = () => {
    const offline = projectCameras.filter(c => c.status === "offline");
    offline.forEach(c => setCameraStatus(c.id, "online"));
    showToast({ variant: "success", title: "Batch reconnect complete", desc: `${offline.length} camera(s) reconnected.` });
  };

  const exportCsv = () => {
    const header = ["Name", "Code", "Zone", "Location", "RTSP URL", "Status", "AI Features"];
    const rows = projectCameras.map(c => [
      c.name, c.code, c.zone, c.location, c.rtspUrl, c.status, (c.aiFeatures ?? []).join("; "),
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "project"}-cameras.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: "Export complete", desc: `${projectCameras.length} camera(s) exported to CSV.` });
  };

  return (
    <div>
      {/* Spacer holds the scroll height the fixed header vacates once stuck — sized to the
          header's own measured height, so this tab's top spacing matches every other tab exactly
          (unlike the earlier CSS sticky attempt, which reserved a taller padded box). */}
      {stuck && <div style={{ height: stickyHeight }} />}
      <div ref={stickyRef} style={stuck && rect ? {
        position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 20,
        backgroundColor: "var(--gray-100)", paddingBottom: "16px",
      } : undefined}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Cameras</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>Connect and manage this project&apos;s camera streams and AI engine mapping.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={batchReconnect}
            onMouseEnter={() => setHoveredAction("reconnect")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: hoveredAction === "reconnect" ? "var(--gray-50)" : "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Reconnect All
          </button>
          <button onClick={exportCsv}
            onMouseEnter={() => setHoveredAction("export")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: hoveredAction === "export" ? "var(--gray-50)" : "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.75V9.33M7 9.33 4.08 6.42M7 9.33 9.92 6.42M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export CSV
          </button>
          <button onClick={() => setShowAdd(true)}
            onMouseEnter={() => setHoveredAction("add")} onMouseLeave={() => setHoveredAction(null)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, filter: hoveredAction === "add" ? "brightness(0.92)" : "none" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Add camera
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>CHANNEL USAGE</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: overLimit ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>
              {projectCameras.length}{limit ? ` / ${limit}` : ""}
            </p>
            {limit ? (
              <div style={{ height: "4px", backgroundColor: "var(--gray-100)", borderRadius: "2px", marginTop: "8px" }}>
                <div style={{ height: "4px", width: `${Math.min(100, (projectCameras.length / limit) * 100)}%`, backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)", borderRadius: "2px" }} />
              </div>
            ) : <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>No license limit set</p>}
          </div>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>STREAM HEALTH</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-400)", marginTop: "6px" }}>{onlineCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>online</span></p>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px" }}>{offlineCount} offline</p>
          </div>
          <div style={{ padding: "16px", borderRight: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>AI ENGINE COVERAGE</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{aiMappedCount} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>/ {projectCameras.length} mapped</span></p>
          </div>
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>ZONE COVERAGE</p>
            <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{zones.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>zones</span></p>
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
            placeholder="Search name, code, RTSP URL, IP…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px",
              border: searchFocused ? "1px solid var(--gray-400)" : BORDER, outline: "none",
              boxShadow: searchFocused ? "0 0 0 3px var(--gray-100)" : "none",
              fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
            }}
          />
        </div>
        <FilterSelect
          value={zoneFilter}
          onChange={setZoneFilter}
          options={[{ value: "ALL", label: "All zones" }, ...zones.map(z => ({ value: z, label: z }))]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          options={[{ value: "ALL", label: "All status" }, { value: "online", label: "Online" }, { value: "offline", label: "Offline" }]}
        />
        <FilterSelect
          value={aiFilter}
          onChange={v => setAiFilter(v as typeof aiFilter)}
          options={[{ value: "ALL", label: "All AI engines" }, ...AI_FEATURES.map(f => ({ value: f, label: f }))]}
        />
        <div style={{ display: "flex", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "3px" }}>
          {(["table", "grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: "6px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                fontSize: "12px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
              }}>
              {v === "table" ? "Table" : "Grid"}
            </button>
          ))}
        </div>
      </div>
      </div>

      {visibleCameras.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {projectCameras.length === 0 ? "No cameras connected to this project yet." : "No cameras match these filters."}
          </p>
        </div>
      ) : view === "table" ? (
        // No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that opens
        // past the bottom edge (the last row's menu becomes invisible, not just cut off).
        // Header/last-row corners are radiused directly instead.
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 0.7fr 0.7fr 0.7fr 1.1fr 1fr 0.8fr 70px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {["", "Camera", "Maker", "Resolution", "Zone", "RTSP Stream", "AI Engines", "Status", ""].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
            ))}
          </div>
          {visibleCameras.map((cam, i) => {
            const online = cam.status === "online";
            const isAiCamera = (cam.aiFeatures ?? []).length > 0;
            const isLast = i === visibleCameras.length - 1;
            return (
              <div key={cam.id} style={{
                display: "grid", gridTemplateColumns: "56px 1.3fr 0.7fr 0.7fr 0.7fr 1.1fr 1fr 0.8fr 70px", padding: "10px 16px", alignItems: "center",
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
                      {isAiCamera ? "AI CAMERA" : "CCTV"}
                    </span>
                  </div>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.maker ?? "—"}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-600)" }}>{cam.resolution ?? "—"}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.zone}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.rtspUrl}</span>
                <AiFeatureBadges features={cam.aiFeatures} />
                <button onClick={() => setConfirmingStatusCam(cam)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--gray-400)", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: online ? "var(--success-400)" : "var(--gray-400)" }}>{online ? "Online" : "Offline"}</span>
                </button>
                <RowActionsMenu actions={[
                  { label: "Edit", onClick: () => setEditingCamera(cam) },
                  { label: "Remove", onClick: () => handleDelete(cam), danger: true },
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
                    {online ? "ONLINE" : "OFFLINE"}
                  </span>
                </button>
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "monospace" }}>{cam.code}</p>
                    <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{cam.zone}</span>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", marginTop: "2px" }}>{cam.name}</p>
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <AiFeatureBadges features={cam.aiFeatures} />
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setConfirmingStatusCam(cam)} title="Toggle status" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "2px" }}>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={() => handleDelete(cam)} title="Remove camera" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "2px" }}>
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
        <CameraFormModal title="Add Input Device" initial={EMPTY_FORM} isEdit={false} onClose={() => setShowAdd(false)} onSubmit={createCamera} />
      )}
      {editingCamera && (
        <CameraFormModal
          title="Edit Input Device"
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
        />
      )}
    </div>
  );
}
