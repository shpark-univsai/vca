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
function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8L14.6 13.4H1.4L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="8" cy="11.5" r="0.9" fill="currentColor"/>
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
function ComputeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 4V2M10 4V2M6 14V12M10 14V12M4 6H2M4 10H2M14 6H12M14 10H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function ModelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="11" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="11" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6.5 7.5L7 9.5M9.5 7.5L9 9.5M7 5.3H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
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
function MigrationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 5L8 2L13 5L8 8L3 5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
      <path d="M3 8L8 11L13 8M3 11L8 14L13 11" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}
function BackupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 2.5V6H11V2.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <rect x="5.5" y="9" width="5" height="3.5" stroke="currentColor" strokeWidth="1.1"/>
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
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "70px", paddingBottom: "1px", minWidth: "32px" }}>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>{max.toLocaleString()}</span>
        <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1 }}>0</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "3px", height: "70px", borderLeft: "1px solid var(--gray-200)", paddingLeft: "6px" }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, height: `${Math.max(2, (v / max) * 70)}px`, backgroundColor: color, borderRadius: "2px" }} />
        ))}
      </div>
    </div>
  );
}

function MetricTrendCard({ label, values, color }: { label: string; values: number[]; color: string }) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px", marginBottom: "12px" }}>{total.toLocaleString()}</p>
      <MiniBarChart values={values} color={color} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", marginLeft: "38px" }}>
        <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{trendDayLabel(METRIC_TREND_DAYS - 1)}</span>
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

  // What a project manager actually needs to act on, surfaced above everything else — see the
  // "20-year PM" discussion this was built from: exception-based, not buried under analytics.
  const attentionItems: { message: string; severity: "danger" | "warning"; onClick: () => void }[] = [];
  if (offlineCount > 0) {
    attentionItems.push({ message: `${offlineCount} camera${offlineCount > 1 ? "s" : ""} offline`, severity: "danger", onClick: () => onTabChange("cameras") });
  }
  if (overChannelLimit) {
    attentionItems.push({ message: `Over camera channel limit (${projectCameras.length} / ${channelLimit})`, severity: "danger", onClick: () => onTabChange("license") });
  }
  if (licenseExpired) {
    attentionItems.push({ message: `License expired ${project.licenseExpiresAt}`, severity: "danger", onClick: () => onTabChange("license") });
  } else if (licenseExpiringSoon) {
    attentionItems.push({ message: `License expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`, severity: "warning", onClick: () => onTabChange("license") });
  }
  if (pendingInviteCount > 0) {
    attentionItems.push({ message: `${pendingInviteCount} user invite${pendingInviteCount > 1 ? "s" : ""} pending`, severity: "warning", onClick: () => onTabChange("users") });
  }
  if (suspendedUserCount > 0) {
    attentionItems.push({ message: `${suspendedUserCount} user${suspendedUserCount > 1 ? "s" : ""} suspended`, severity: "warning", onClick: () => onTabChange("users") });
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
  const cpuPercent = Math.round(20 + seededRandom(seed + 11) * 60);
  const gpuPercent = Math.round(20 + seededRandom(seed + 22) * 60);
  const ramPercent = Math.round(20 + seededRandom(seed + 33) * 60);
  const networkMbps = Math.round(50 + seededRandom(seed + 44) * 200);

  const channelYearlyCost = (channelLimit ?? projectCameras.length) * PRICE_PER_CHANNEL_PER_YEAR;

  const apiRequestsDaily = metricDailySeries(seed + 101, 4000, 13000);
  const aiDetectionsDaily = metricDailySeries(seed + 202, 3000, 11000);
  const alertsDaily = metricDailySeries(seed + 303, 2, 35, true);
  const recordingsDaily = metricDailySeries(seed + 404, 10, 18);

  const SYSTEM_CELLS = [
    { label: "STATUS", value: systemAllLive ? "All Live" : "Degraded", icon: LiveStatusIcon, color: systemAllLive ? "var(--success-400)" : "var(--danger-400)" },
    { label: "COMPUTE", value: `${project.computeInstance ?? "—"} · GPU×${project.gpuCount ?? 0}`, icon: ComputeIcon, color: "var(--gray-900)" },
    { label: "MODEL VERSION", value: project.modelVersion ?? "Not set", icon: ModelIcon, color: "var(--gray-900)" },
    { label: "CHANNELS", value: `${channelLimit ?? projectCameras.length} channels · $${channelYearlyCost.toLocaleString()}/yr`, icon: ChannelsIcon, color: "var(--gray-900)" },
    { label: "LAST MIGRATION", value: project.lastMigration ?? "Not set", icon: MigrationIcon, color: "var(--gray-900)" },
    { label: "LAST BACKUP", value: nowMs !== null && project.lastBackupAt ? `${formatElapsed(nowMs - new Date(project.lastBackupAt).getTime())} ago` : "—", icon: BackupIcon, color: "var(--gray-900)" },
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

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "stretch" }}>
            <div style={{ flex: 1.6, backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}>
                {SYSTEM_CELLS.map((c, i) => {
                  const Icon = c.icon;
                  const rightBorder = i % 2 === 0;
                  const bottomBorder = i < 4;
                  return (
                    <div key={c.label} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "16px",
                      borderRight: rightBorder ? "1px solid var(--gray-300)" : "none",
                      borderBottom: bottomBorder ? "1px solid var(--gray-300)" : "none",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}>
                        <Icon />
                      </span>
                      <div style={{ overflow: "hidden" }}>
                        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>{c.label}</p>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--success-100)", color: "var(--success-400)", flexShrink: 0 }}>
                  <RegionIcon />
                </span>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>Primary Region</p>
                  <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
                    {project.regionName ?? "Not set"} {project.regionOnPrem ? "(On-prem)" : "(Cloud)"} {project.regionFlag}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "10px" }}>
                center ×{project.regionCenterCount ?? 0} · subcenter ×{project.regionSubcenterCount ?? 0}
              </p>
              <div style={{ display: "flex", gap: "14px", marginTop: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "10px", color: "var(--gray-500)" }}>CPU <span style={{ fontWeight: 700, color: "var(--gray-900)" }}>{cpuPercent}%</span></span>
                <span style={{ fontSize: "10px", color: "var(--gray-500)" }}>GPU <span style={{ fontWeight: 700, color: "var(--gray-900)" }}>{gpuPercent}%</span></span>
                <span style={{ fontSize: "10px", color: "var(--gray-500)" }}>RAM <span style={{ fontWeight: 700, color: "var(--gray-900)" }}>{ramPercent}%</span></span>
                <span style={{ fontSize: "10px", color: "var(--gray-500)" }}>{networkMbps} Mbps</span>
              </div>
            </div>
          </div>


          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px", alignItems: "start" }}>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Recently Registered VIPs</p>
                <button onClick={() => onTabChange("vip")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}>Register VIP →</button>
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
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>To-do</p>
              {attentionItems.length === 0 ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ display: "flex", color: "var(--success-400)", flexShrink: 0 }}><CheckCircleIcon /></span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>All systems operational — no action needed.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {attentionItems.map((item, i) => {
                    const color = item.severity === "danger" ? "var(--danger-400)" : "var(--warning-500)";
                    return (
                      <button
                        key={item.message}
                        onClick={item.onClick}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "8px", width: "100%", padding: "10px 6px",
                          border: "none", borderTop: i > 0 ? BORDER : "none", borderRadius: 0, backgroundColor: "transparent",
                          textAlign: "left", cursor: "pointer", font: "inherit",
                        }}
                      >
                        <span style={{ display: "flex", color, flexShrink: 0, marginTop: "1px" }}><WarningIcon /></span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{item.message}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>License Info</p>
                <button onClick={() => onTabChange("license")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "10px", fontWeight: 600, color: "var(--primary-400)" }}>Manage →</button>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{project.licensePlan ?? "Not set"}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "6px" }}>Channels: {projectCameras.length} / {channelLimit ?? "∞"}</p>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <MetricTrendCard label="API Requests" values={apiRequestsDaily} color="var(--primary-400)" />
            <MetricTrendCard label="AI Detections" values={aiDetectionsDaily} color="var(--success-400)" />
            <MetricTrendCard label="Alerts" values={alertsDaily} color="var(--danger-400)" />
            <MetricTrendCard label="Recordings" values={recordingsDaily} color="var(--gray-600)" />
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
