"use client";

import { useMemo, useState, useEffect } from "react";
import { useVcaStore, seededRandom, projectChannelLimit, UNLIMITED_EXPIRY } from "@/lib/vcaStore";
import { formatElapsed } from "@/lib/time";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import { useToast } from "../Toast";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import ProjectServerTab from "./ProjectServerTab";
import ProjectRosterTab from "./ProjectRosterTab";
import PortalUsersPage from "./PortalUsersPage";

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H9.5C10.33 4 11 4.67 11 5.5V10.5C11 11.33 10.33 12 9.5 12H3.5C2.67 12 2 11.33 2 10.5V5.5Z" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M11 6.8L14 5V11L11 9.2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7.6 8.4L13 3M11 5L12.5 6.5M9 7L10.2 8.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function UsersGroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M1.8 13c0-2.21 1.88-4 4.2-4s4.2 1.79 4.2 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="11.6" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M9.9 13c0.1-1.76 1.6-3.1 3.3-3.1 1.02 0 1.94 0.46 2.55 1.18" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 2v1.6M8 12.4V14M14 8h-1.6M3.6 8H2M12.1 3.9l-1.1 1.1M5 10l-1.1 1.1M12.1 12.1L11 11M5 6L3.9 4.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L13.5 4V7.5C13.5 10.9 11.2 13.4 8 14.3C4.8 13.4 2.5 10.9 2.5 7.5V4L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function UserPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1.8 13c0-2.21 1.88-4 4.2-4s4.2 1.79 4.2 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M12 5.5V9.5M10 7.5H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function ArrowUpIcon() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M5 2L2 5M5 2L8 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// Turns a string (e.g. a project id) into a stable numeric seed for seededRandom — the metric
// trend series below need to be deterministic per project (no Math.random(), same reasoning as
// vcaStore's own camera bulk-generator: avoids an SSR/client hydration mismatch) but distinct
// across projects and metrics.
function strSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

const METRIC_TREND_DAYS = 14;

function metricDailySeries(seed: number, min: number, max: number, sparse?: boolean): number[] {
  return Array.from({ length: METRIC_TREND_DAYS }, (_, i) => {
    const r = seededRandom(seed + i * 1.71);
    if (sparse && r < 0.5) return 0;
    // Gentle hill-shaped envelope (low at the edges, tall in the middle) so the bars read like a
    // plausible daily pattern instead of pure noise.
    const envelope = 0.4 + 0.6 * Math.sin((i / (METRIC_TREND_DAYS - 1)) * Math.PI);
    return Math.round(min + (max - min) * envelope * (0.7 + r * 0.5));
  });
}

function trendDayLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const [hovered, setHovered] = useState<number | null>(null);
  // Same split weekOverWeekChange uses — the divider marks exactly the boundary that % badge
  // above is comparing across, instead of leaving that comparison as text with no visual anchor.
  const weekBoundary = Math.floor(values.length / 2);

  return (
    <div style={{ display: "flex", gap: "6px" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "70px", paddingBottom: "1px", minWidth: "32px" }}>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>{max.toLocaleString()}</span>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>0</span>
      </div>
      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "flex-end", gap: "3px", height: "70px", borderLeft: "1px solid var(--gray-200)", paddingLeft: "6px" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `calc(6px + ${(weekBoundary / values.length) * 100}%)`,
          borderLeft: "1px dashed var(--gray-300)", pointerEvents: "none",
        }} />
        {values.map((v, i) => {
          const daysAgo = values.length - 1 - i;
          return (
            <div key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}
            >
              <div style={{
                width: "100%", height: `${Math.max(2, (v / max) * 70)}px`, borderRadius: "2px",
                backgroundColor: color, opacity: hovered === null || hovered === i ? 1 : 0.45,
              }} />
              {hovered === i && (
                <div style={{
                  position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "6px",
                  backgroundColor: "var(--gray-900)", color: "white", fontSize: "10px", fontWeight: 700,
                  padding: "4px 8px", borderRadius: "6px", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
                }}>
                  {trendDayLabel(daysAgo)} · {v.toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Continuous volume (AI Detections) reads better as a line than as bars — bars are for sparse,
// discrete events (Alerts), where "did anything happen this day" matters more than the shape of
// the trend between days. Same y-axis/hover/week-divider treatment as MiniBarChart so the two
// don't feel like different components bolted together.
function MiniLineChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const [hovered, setHovered] = useState<number | null>(null);
  const weekBoundary = Math.floor(values.length / 2);
  const VIEW_W = 100;
  const VIEW_H = 70;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * VIEW_W,
    y: VIEW_H - (v / max) * VIEW_H,
  }));
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${lineD} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`;

  return (
    <div style={{ display: "flex", gap: "6px" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "70px", paddingBottom: "1px", minWidth: "32px" }}>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>{max.toLocaleString()}</span>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>0</span>
      </div>
      <div style={{ position: "relative", flex: 1, height: "70px", borderLeft: "1px solid var(--gray-200)", paddingLeft: "6px" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `calc(6px + ${(weekBoundary / values.length) * 100}%)`,
          borderLeft: "1px dashed var(--gray-300)", pointerEvents: "none",
        }} />
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
          <path d={areaD} fill={color} fillOpacity={0.12} stroke="none" />
          <path d={lineD} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {hovered !== null && (
            <circle cx={points[hovered].x} cy={points[hovered].y} r={2.5} fill={color} stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {values.map((v, i) => {
            const daysAgo = values.length - 1 - i;
            return (
              <div key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ flex: 1, height: "100%", position: "relative" }}
              >
                {hovered === i && (
                  <div style={{
                    position: "absolute", left: "50%", top: `${points[i].y}px`, transform: "translate(-50%, -130%)",
                    backgroundColor: "var(--gray-900)", color: "white", fontSize: "10px", fontWeight: 700,
                    padding: "4px 8px", borderRadius: "6px", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
                  }}>
                    {trendDayLabel(daysAgo)} · {v.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Gives the raw total some context — "+18% vs prior week" instead of a bare number — by comparing
// the average of the most recent half of the window against the older half. Just a direction/magnitude
// signal (up/down), not a judgment on whether that direction is good for this particular metric
// (e.g. Alerts trending up isn't "good") — so it's colored purely by sign, not by metric semantics.
function weekOverWeekChange(values: number[]): number | null {
  const mid = Math.floor(values.length / 2);
  const older = values.slice(0, mid);
  const recent = values.slice(mid);
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (olderAvg === 0) return recentAvg === 0 ? null : 100;
  return Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
}

function TrendChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const flat = pct === 0;
  const up = pct > 0;
  const color = flat ? "var(--gray-400)" : up ? "var(--success-400)" : "var(--danger-400)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 700, color }}>
      {!flat && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: up ? "none" : "rotate(180deg)" }}>
          <path d="M5 8V2M5 2L2 5M5 2L8 5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function MetricTrendCard({ label, values, color, chartType = "bar", onViewMore }: {
  label: string; values: number[]; color: string; chartType?: "bar" | "line"; onViewMore?: () => void;
}) {
  const total = values.reduce((a, b) => a + b, 0);
  const change = weekOverWeekChange(values);
  return (
    <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</p>
        {onViewMore && (
          <button onClick={onViewMore} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, color: "var(--gray-600)" }}>
            View →
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px", marginBottom: "12px" }}>
        <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{total.toLocaleString()}</p>
        <TrendChangeBadge pct={change} />
      </div>
      {chartType === "line" ? <MiniLineChart values={values} color={color} /> : <MiniBarChart values={values} color={color} />}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", marginLeft: "38px" }}>
        <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{trendDayLabel(METRIC_TREND_DAYS - 1)}</span>
        <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{trendDayLabel(Math.ceil(METRIC_TREND_DAYS / 2))}</span>
        <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{trendDayLabel(0)}</span>
      </div>
    </div>
  );
}

// Shared shell for the four Overview metric cards — header (eyebrow label + icon badge), then
// whatever body content each card needs (big value, progress bar, footer stats) as children.
function MetricCard({ label, iconBg, iconColor, icon, children }: {
  label: string; iconBg: string; iconColor: string; icon: () => React.JSX.Element; children: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px" }}>{label.toUpperCase()}</p>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: iconBg, color: iconColor, flexShrink: 0 }}>
          <Icon />
        </span>
      </div>
      {children}
    </div>
  );
}

function SubStat({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

interface PortalProjectDetailPageProps {
  projectId: string;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

export default function PortalProjectDetailPage({ projectId, tab, onTabChange }: PortalProjectDetailPageProps) {
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const cameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const persons = useVcaStore(s => s.persons);
  const auditLog = useVcaStore(s => s.auditLog);
  const accessRequests = useVcaStore(s => s.accessRequests);
  const approveAccessRequests = useVcaStore(s => s.approveAccessRequests);
  const dismissAccessRequest = useVcaStore(s => s.dismissAccessRequest);
  const { showToast } = useToast();

  // Every hook has to run before the "project not found" guard below. They used to sit after it,
  // so a render where the project is missing called seven fewer hooks than a render where it
  // exists — and React does not tolerate that: navigating from a real project to a deleted or
  // not-yet-loaded one throws "Rendered fewer hooks than expected" and takes the page down. None
  // of these depend on `project`, only on projectId/cameras, so hoisting them costs nothing but
  // the reordering.
  const projectCameras = useMemo(
    () => cameras.filter(c => c.projectId === projectId),
    [cameras, projectId]
  );
  // Which rows the Camera Status panel's filter tabs show — declared here (not inside the panel
  // itself) for the same hooks-before-the-guard reason as everything else on this list.
  const [cameraStatusFilter, setCameraStatusFilter] = useState<"all" | "offline">("all");
  // Read after mount, not during render: the clock is not a pure input, and license expiry is
  // the only thing here that needs it — same pattern ProjectLicenseTab uses. Reads as not-expired
  // for the first frame, then corrects itself once mounted (no server/client mismatch).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>Project not found.</p>;
  }

  const meta = TYPE_META[project.type];
  const orgName = organizations.find(o => o.id === project.orgId)?.name ?? project.orgId;
  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const offlineCount = projectCameras.length - onlineCount;
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));
  const adminCount = projectUsers.filter(u => u.permission === "admin").length;
  const operatorCount = projectUsers.length - adminCount;

  const channelLimit = projectChannelLimit(project);
  const isUnlimitedExpiry = project.licenseExpiresAt === UNLIMITED_EXPIRY;
  const daysUntilExpiry = project.licenseExpiresAt && !isUnlimitedExpiry && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const licenseExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const licenseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  const overChannelLimit = !!channelLimit && projectCameras.length > channelLimit;
  const projectAccessRequests = accessRequests.filter(r => r.projectId === projectId);

  const recentActivity = auditLog
    .filter(a => a.projectId === projectId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  const projectPersons = persons.filter(p => p.projectId === projectId);
  const recentVips = [...projectPersons].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 3);
  // nowMs-derived, not new Date() directly, so this stays in sync with the same not-yet-mounted ->
  // mounted correction every other clock-reading value on this page already follows.
  const todayStr = nowMs !== null ? new Date(nowMs).toISOString().slice(0, 10) : null;
  const todayVipCount = todayStr ? projectPersons.filter(p => p.registeredAt === todayStr).length : 0;
  const highPriorityVipCount = projectPersons.filter(p => p.priorityLabel === "high" || p.priorityLabel === "very_high").length;

  const visibleCameraRows = (cameraStatusFilter === "offline" ? projectCameras.filter(c => c.status === "offline") : projectCameras)
    .slice()
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "offline" ? -1 : 1))
    .slice(0, 5);

  const seed = strSeed(projectId);
  const aiDetectionsDaily = metricDailySeries(seed + 202, 3000, 11000);
  const alertsDaily = metricDailySeries(seed + 303, 2, 35, true);

  const approveRequest = (id: string, name: string) => {
    approveAccessRequests([id]);
    showToast({ variant: "success", title: "Access approved — invite sent", desc: name });
  };
  const dismissRequest = (id: string, name: string) => {
    dismissAccessRequest(id);
    showToast({ variant: "warning", title: "Request dismissed", desc: name });
  };

  return (
    <div>
      {tab === "overview" && (
        <>
          {/* Welcome banner — replaces the old plain text header. No single button here is "the"
              primary action (Overview itself doesn't own one the way each tab does), so all three
              stay in the same bordered/white tier rather than competing for primary-400. */}
          <div style={{ position: "relative", overflow: "hidden", backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div style={{ position: "absolute", bottom: "-60px", right: "-60px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, var(--primary-100) 0%, rgba(255,255,255,0) 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{project.name}</p>
                <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: "3px 8px", borderRadius: "999px" }}>{meta.label}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{project.id}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{orgName}</p>
              <p style={{ fontSize: "13px", color: "var(--gray-500)", maxWidth: "480px" }}>
                Review connected camera status, manage the VIP database, approve access requests, and keep an eye on your license — all in one place.
              </p>
            </div>
            <div style={{ position: "relative", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => onTabChange("cameras")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                <PlusIcon /> Add Camera
              </button>
              <button onClick={() => onTabChange("vip")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                <UserPlusIcon /> Register VIP
              </button>
              <button onClick={() => onTabChange("users")}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                <ShieldIcon /> Approve Access Requests
                {projectAccessRequests.length > 0 && (
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)", backgroundColor: "var(--warning-200)", padding: "2px 7px", borderRadius: "999px" }}>
                    {projectAccessRequests.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Metric cards — camera connectivity / license usage / VIP DB / accounts & permissions,
              each grounded in real store data (no fabricated failure-reason breakdowns the data
              model doesn't have). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
            <MetricCard label="Camera Connectivity" icon={VideoIcon} iconBg="var(--success-100)" iconColor="var(--success-400)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{onlineCount}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>/ {projectCameras.length} connected</p>
              </div>
              <div style={{ height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                <div style={{ height: "100%", width: `${projectCameras.length ? (onlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--success-400)" }} />
                <div style={{ height: "100%", width: `${projectCameras.length ? (offlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--danger-400)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px" }}>
                <SubStat color="var(--success-400)" label={`Online ${onlineCount}`} />
                <SubStat color="var(--danger-400)" label={`Offline ${offlineCount}`} />
              </div>
            </MetricCard>

            <MetricCard label="License Subscription" icon={KeyIcon} iconBg="var(--info-100)" iconColor="var(--info-500)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectCameras.length}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>/ {channelLimit ?? "∞"} channels used</p>
              </div>
              <div style={{ height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${channelLimit ? Math.min(100, (projectCameras.length / channelLimit) * 100) : 0}%`, backgroundColor: overChannelLimit ? "var(--danger-400)" : "var(--info-500)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{project.licensePlan ?? "Plan not set"}</p>
                  <button onClick={() => onTabChange("license")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
                    Manage →
                  </button>
                </div>
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px",
                  backgroundColor: licenseExpired ? "var(--danger-100)" : licenseExpiringSoon ? "var(--warning-200)" : "var(--info-100)",
                  color: licenseExpired ? "var(--danger-500)" : licenseExpiringSoon ? "var(--warning-500)" : "var(--info-500)",
                }}>
                  {isUnlimitedExpiry ? "Unlimited" : licenseExpired ? "Expired" : daysUntilExpiry !== null ? `D-${daysUntilExpiry}` : "Not set"}
                </span>
              </div>
            </MetricCard>

            <MetricCard label="VIP / Target DB" icon={UsersGroupIcon} iconBg="var(--primary-100)" iconColor="var(--primary-400)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectPersons.length}</p>
                {todayVipCount > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 600, color: "var(--success-400)" }}>
                    <ArrowUpIcon /> {todayVipCount} today
                  </span>
                )}
              </div>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Registered watchlist individuals for this project.</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px" }}>
                <p style={{ fontSize: "12px", color: "var(--primary-400)", fontWeight: 600 }}>High priority: {highPriorityVipCount}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>Registered today: {todayVipCount}</p>
              </div>
            </MetricCard>

            <MetricCard label="Portal Accounts & Permissions" icon={SettingsIcon} iconBg="var(--warning-100)" iconColor="var(--warning-500)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectUsers.length}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>accounts</p>
              </div>
              {projectAccessRequests.length > 0 ? (
                <button onClick={() => onTabChange("users")} style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "var(--warning-500)" }}>
                  <ShieldIcon /> {projectAccessRequests.length} pending access request{projectAccessRequests.length === 1 ? "" : "s"}
                </button>
              ) : (
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No pending access requests.</p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Admin: {adminCount} | Operator: {operatorCount}</p>
                <button onClick={() => onTabChange("users")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>Manage →</button>
              </div>
            </MetricCard>
          </div>

          {/* Same 4-column grid + gap as the metrics row above, so the left column's right edge
              lands exactly on the boundary between card 2 (License Subscription) and card 3 —
              a flex-basis split couldn't guarantee that alignment across viewport widths the way
              sharing the grid's own column lines does. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", alignItems: "start", marginBottom: "16px" }}>
            <div style={{ gridColumn: "1 / span 2", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: BORDER, flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--info-100)", color: "var(--info-500)", flexShrink: 0 }}><VideoIcon /></span>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Camera Status</p>
                      <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Streaming status for cameras connected to this project</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--gray-50)", padding: "2px", borderRadius: "8px" }}>
                    {(["all", "offline"] as const).map(f => (
                      <button key={f} onClick={() => setCameraStatusFilter(f)}
                        style={{
                          padding: "6px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                          backgroundColor: cameraStatusFilter === f ? "white" : "transparent",
                          color: cameraStatusFilter === f ? "var(--gray-900)" : f === "offline" ? "var(--danger-400)" : "var(--gray-500)",
                        }}>
                        {f === "all" ? `All (${projectCameras.length})` : `Offline (${offlineCount})`}
                      </button>
                    ))}
                  </div>
                </div>
                {visibleCameraRows.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--gray-400)", padding: "24px", textAlign: "center" }}>
                    {cameraStatusFilter === "offline" ? "No offline cameras — everything is connected." : "No cameras connected to this project yet."}
                  </p>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 0.7fr 60px", padding: "8px 20px", backgroundColor: "var(--gray-50)", gap: "8px" }}>
                      {["Camera", "Zone", "Stream URL", "Status", ""].map(h => (
                        <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                      ))}
                    </div>
                    {visibleCameraRows.map((c, i) => {
                      const online = c.status === "online";
                      return (
                        <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 0.7fr 60px", padding: "10px 20px", alignItems: "center", gap: "8px", borderTop: i > 0 ? BORDER : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--danger-400)", flexShrink: 0 }} />
                            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{c.zone}</span>
                          <span style={{ fontSize: "12px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.rtspUrl}</span>
                          <span style={{
                            fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", width: "fit-content",
                            backgroundColor: online ? "var(--success-100)" : "var(--danger-100)", color: online ? "var(--success-400)" : "var(--danger-400)",
                          }}>
                            {online ? "Online" : "Offline"}
                          </span>
                          <button onClick={() => onTabChange("cameras")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>View →</button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Same width as the VIP / Target DB metric card above it (grid column 3 only, not
                spanning) — sits directly underneath rather than sharing a row with Camera Status. */}
            <div style={{ gridColumn: "3 / span 1", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--primary-100)", color: "var(--primary-400)", flexShrink: 0 }}><UsersGroupIcon /></span>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Recently Registered VIPs</p>
                  </div>
                  <button onClick={() => onTabChange("vip")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>Register VIP →</button>
                </div>
                {recentVips.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No VIPs registered yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {recentVips.map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", border: BORDER, borderRadius: "12px", padding: "10px" }}>
                        <img src={p.photoUrl} alt="" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                          <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{p.registeredAt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Same width as the Portal Accounts & Permissions metric card above it. */}
            <div style={{ gridColumn: "4 / span 1", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "flex", color: "var(--warning-500)" }}><ShieldIcon /></span>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Access Requests</p>
                  </div>
                  {projectAccessRequests.length > 0 && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)", backgroundColor: "var(--warning-200)", padding: "2px 8px", borderRadius: "999px" }}>
                      {projectAccessRequests.length}
                    </span>
                  )}
                </div>
                {projectAccessRequests.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No pending access requests.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {projectAccessRequests.slice(0, 2).map(r => (
                      <div key={r.id} style={{ border: BORDER, borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{r.name}</p>
                        {r.reason && <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>&quot;{r.reason}&quot;</p>}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => approveRequest(r.id, r.name)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                            Approve
                          </button>
                          <button onClick={() => dismissRequest(r.id, r.name)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    {projectAccessRequests.length > 2 && (
                      <button onClick={() => onTabChange("users")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", textAlign: "left" }}>
                        View {projectAccessRequests.length - 2} more →
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ display: "flex", color: "var(--gray-500)" }}><ClockIcon /></span>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px" }}>RECENT ADMIN ACTIVITY</p>
                </div>
                {recentActivity.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No admin activity yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {recentActivity.map((a, i) => (
                      <div key={a.id} style={{ display: "flex", gap: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "8px", flexShrink: 0 }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--primary-400)", flexShrink: 0 }} />
                          {i < recentActivity.length - 1 && <span style={{ width: "1px", flex: 1, backgroundColor: "var(--gray-200)", marginTop: "2px" }} />}
                        </div>
                        <div style={{ paddingBottom: "14px", minWidth: 0 }}>
                          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{a.message}</p>
                          <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>
                            {a.actor}{nowMs !== null ? ` · ${formatElapsed(nowMs - new Date(a.at).getTime())} ago` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
            <MetricTrendCard label="AI Detections" values={aiDetectionsDaily} color="var(--success-400)" chartType="line" onViewMore={() => onTabChange("cameras")} />
            <MetricTrendCard label="Alerts" values={alertsDaily} color="var(--danger-400)" chartType="bar" onViewMore={() => onTabChange("vip")} />
          </div>
        </>
      )}
      {tab === "cameras" && <ProjectCamerasTab projectId={projectId} />}
      {tab === "vip" && <ProjectVipTab projectId={projectId} />}
      {tab === "license" && <ProjectLicenseTab projectId={projectId} />}
      {tab === "server" && <ProjectServerTab projectId={projectId} />}
      {tab === "roster" && <ProjectRosterTab projectId={projectId} />}
      {tab === "users" && <PortalUsersPage projectId={projectId} />}
    </div>
  );
}
