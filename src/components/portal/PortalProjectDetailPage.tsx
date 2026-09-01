"use client";

import { useMemo, useState, useEffect } from "react";
import { useVcaStore, seededRandom, projectChannelLimit, UNLIMITED_EXPIRY, PRICE_PER_CHANNEL_PER_YEAR } from "@/lib/vcaStore";
import { formatElapsed } from "@/lib/time";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import ProjectServerTab from "./ProjectServerTab";
import PortalUsersPage from "./PortalUsersPage";

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.3 8.2L7.2 10.1L10.7 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function LiveStatusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="8" cy="8" r="2" fill="currentColor"/>
    </svg>
  );
}
function ChannelsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 13.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function RegionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 14S13 9.5 13 6A5 5 0 1 0 3 6C3 9.5 8 14 8 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}
function CameraOfflineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5V11.5C2 12.0523 2.44772 12.5 3 12.5H10C10.5523 12.5 11 12.0523 11 11.5V9.5L14 11V5L11 6.5V4.5C11 3.94772 10.5523 3.5 10 3.5H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.5 1.5L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function LicenseClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function InviteMailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2.5 4.5L8 9L13.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function UserBlockedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3 13.5C3.5 10.5 5.5 9.5 8 9.5C10.5 9.5 12.5 10.5 13 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M2.5 2.5L13.5 13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function AccessRequestIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 13.5C2.4 10.8 4 9.5 6.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M11.5 7V13M8.5 10H14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
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

interface AttentionItemT {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  tag: string;
  severity: "danger" | "warning";
  icon: () => React.JSX.Element;
  onClick: () => void;
}

function AttentionKpiCard({ item }: { item: AttentionItemT }) {
  const Icon = item.icon;
  const palette = item.severity === "danger"
    ? { badgeBg: "var(--danger-100)", badgeFg: "var(--danger-400)", tagBg: "var(--danger-100)", tagFg: "var(--danger-400)" }
    : { badgeBg: "var(--warning-200)", badgeFg: "var(--warning-500)", tagBg: "var(--warning-200)", tagFg: "var(--warning-500)" };
  return (
    <button onClick={item.onClick} style={{
      textAlign: "left", cursor: "pointer", font: "inherit",
      border: BORDER, borderRadius: "12px", backgroundColor: "white", boxShadow: PANEL_SHADOW, padding: "16px",
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{item.label}</p>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: palette.badgeBg, color: palette.badgeFg, flexShrink: 0 }}>
          <Icon />
        </span>
      </div>
      <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>
        {item.value}
        {item.unit && <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", marginLeft: "4px" }}>{item.unit}</span>}
      </p>
      <span style={{ alignSelf: "flex-start", fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", backgroundColor: palette.tagBg, color: palette.tagFg }}>
        {item.tag}
      </span>
    </button>
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
          <button onClick={onViewMore} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)" }}>
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
  const servers = useVcaStore(s => s.servers);
  const accessRequests = useVcaStore(s => s.accessRequests);

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
  const pendingInviteCount = projectUsers.filter(u => u.status === "invited").length;
  const suspendedUserCount = projectUsers.filter(u => u.status === "suspended").length;

  const channelLimit = projectChannelLimit(project);
  const isUnlimitedExpiry = project.licenseExpiresAt === UNLIMITED_EXPIRY;
  const daysUntilExpiry = project.licenseExpiresAt && !isUnlimitedExpiry && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const licenseExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const licenseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  const overChannelLimit = !!channelLimit && projectCameras.length > channelLimit;
  const pendingAccessRequestCount = accessRequests.filter(r => r.projectId === projectId).length;

  // What a project manager actually needs to act on, surfaced above everything else — see the
  // "20-year PM" discussion this was built from: exception-based, not buried under analytics.
  const attentionItems: AttentionItemT[] = [];
  if (offlineCount > 0) {
    attentionItems.push({
      key: "offline-cameras", label: "OFFLINE CAMERAS", value: offlineCount, unit: offlineCount === 1 ? "camera" : "cameras",
      tag: "Needs attention", severity: "danger", icon: CameraOfflineIcon, onClick: () => onTabChange("cameras"),
    });
  }
  if (overChannelLimit) {
    attentionItems.push({
      key: "over-channel-limit", label: "OVER CHANNEL LIMIT", value: `${projectCameras.length}/${channelLimit}`,
      tag: "Upgrade required", severity: "danger", icon: ChannelsIcon, onClick: () => onTabChange("license"),
    });
  }
  if (licenseExpired) {
    attentionItems.push({
      key: "license-expired", label: "LICENSE STATUS", value: "Expired",
      tag: "Contact billing", severity: "danger", icon: LicenseClockIcon, onClick: () => onTabChange("license"),
    });
  } else if (licenseExpiringSoon) {
    attentionItems.push({
      key: "license-expiring", label: "LICENSE EXPIRES IN", value: daysUntilExpiry, unit: daysUntilExpiry === 1 ? "day" : "days",
      tag: "Renew soon", severity: "warning", icon: LicenseClockIcon, onClick: () => onTabChange("license"),
    });
  }
  if (pendingAccessRequestCount > 0) {
    attentionItems.push({
      key: "access-requests", label: "ACCESS REQUESTS", value: pendingAccessRequestCount, unit: pendingAccessRequestCount === 1 ? "request" : "requests",
      tag: "Awaiting approval", severity: "warning", icon: AccessRequestIcon, onClick: () => onTabChange("users"),
    });
  }
  if (pendingInviteCount > 0) {
    attentionItems.push({
      key: "pending-invites", label: "PENDING INVITES", value: pendingInviteCount, unit: pendingInviteCount === 1 ? "invite" : "invites",
      tag: "Awaiting signup", severity: "warning", icon: InviteMailIcon, onClick: () => onTabChange("users"),
    });
  }
  if (suspendedUserCount > 0) {
    attentionItems.push({
      key: "suspended-users", label: "SUSPENDED USERS", value: suspendedUserCount, unit: suspendedUserCount === 1 ? "user" : "users",
      tag: "Review needed", severity: "warning", icon: UserBlockedIcon, onClick: () => onTabChange("users"),
    });
  }

  const recentActivity = auditLog
    .filter(a => a.projectId === projectId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  const projectPersons = persons.filter(p => p.projectId === projectId);
  const recentVips = [...projectPersons].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 4);

  const projectServers = servers.filter(s => s.projectId === projectId);
  const allServersLive = projectServers.every(s => s.status === "success");
  const systemAllLive = offlineCount === 0 && allServersLive;

  const seed = strSeed(projectId);
  const channelYearlyCost = (channelLimit ?? projectCameras.length) * PRICE_PER_CHANNEL_PER_YEAR;

  const aiDetectionsDaily = metricDailySeries(seed + 202, 3000, 11000);
  const alertsDaily = metricDailySeries(seed + 303, 2, 35, true);

  const SYSTEM_CELLS = [
    { label: "STATUS", value: systemAllLive ? "All Live" : "Degraded", icon: LiveStatusIcon, color: systemAllLive ? "var(--success-400)" : "var(--danger-400)" },
    { label: "CHANNELS", value: `${channelLimit ?? projectCameras.length} channels · $${channelYearlyCost.toLocaleString()}/yr`, icon: ChannelsIcon, color: "var(--gray-900)" },
    { label: "PRIMARY REGION", value: `${project.regionName ?? "Not set"} (${project.regionOnPrem ? "On-prem" : "Cloud"}) ${project.regionFlag ?? ""} · center ×${project.regionCenterCount ?? 0} · subcenter ×${project.regionSubcenterCount ?? 0}`, icon: RegionIcon, color: "var(--gray-900)" },
  ];

  return (
    <div>
      {tab === "overview" && (
        <>
          <div style={{ marginBottom: "16px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: "3px 8px", borderRadius: "999px", boxShadow: PANEL_SHADOW }}>
              {meta.label}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginTop: "8px" }}>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{project.name}</p>
              <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", flexShrink: 0 }}>
                {project.id}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>{orgName}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
            {SYSTEM_CELLS.map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "16px",
                  backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW,
                }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}>
                    <Icon />
                  </span>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{c.label}</p>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {attentionItems.length === 0 ? (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "flex", color: "var(--success-400)", flexShrink: 0 }}><CheckCircleIcon /></span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-600)" }}>All systems operational — no action needed.</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 260px))", gap: "12px", marginBottom: "16px" }}>
              {attentionItems.map(item => <AttentionKpiCard key={item.key} item={item} />)}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px", alignItems: "start" }}>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>Recently Registered VIPs</p>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", backgroundColor: "var(--gray-100)", padding: "2px 7px", borderRadius: "999px" }}>
                    {projectPersons.length} total
                  </span>
                </div>
                <button onClick={() => onTabChange("vip")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)" }}>Register VIP →</button>
              </div>
              {recentVips.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No VIPs registered yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentVips.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", border: BORDER, borderRadius: "10px", padding: "8px" }}>
                      <img src={p.photoUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                        <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>{p.registeredAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>License Info</p>
                <button onClick={() => onTabChange("license")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)" }}>Manage →</button>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{project.licensePlan ?? "Not set"}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "6px" }}>Channels: {projectCameras.length} / {channelLimit ?? "∞"}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "2px" }}>Cameras online: {onlineCount} / {projectCameras.length}</p>
              <p style={{ fontSize: "10px", color: licenseExpired ? "var(--danger-400)" : "var(--gray-500)", marginTop: "2px" }}>
                {licenseExpired ? "Expired" : "Expires"} {project.licenseExpiresAt ?? "Not set"}
              </p>
            </div>

            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>Recent Activity</p>
              {recentActivity.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No admin activity yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recentActivity.map((a, i) => (
                    <div key={a.id} style={{ padding: "8px 0", borderTop: i > 0 ? BORDER : "none" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "var(--primary-300)", flexShrink: 0, marginTop: "5px" }} />
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{a.message}</p>
                      </div>
                      <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "2px", marginLeft: "11px" }}>
                        {a.actor}{nowMs !== null ? ` · ${formatElapsed(nowMs - new Date(a.at).getTime())} ago` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
      {tab === "users" && <PortalUsersPage projectId={projectId} />}
    </div>
  );
}
