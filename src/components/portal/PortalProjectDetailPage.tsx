"use client";

import { useMemo, useState, useEffect } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { formatElapsed } from "@/lib/time";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import ProjectServerTab from "./ProjectServerTab";
import PortalUsersPage from "./PortalUsersPage";

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5.5 4.5L6.3 3H9.7L10.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8L9.8 5.6L14 6.15L11 9.1L11.75 13.3L8 11.3L4.25 13.3L5 9.1L2 6.15L6.2 5.6L8 1.8Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L9.3 6.7L14 8L9.3 9.3L8 14L6.7 9.3L2 8L6.7 6.7L8 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1.8 13.5c0-2.3 1.9-4 4.2-4s4.2 1.7 4.2 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M10.5 3.3c1.2.3 2.1 1.4 2.1 2.7 0 1.2-.7 2.2-1.7 2.6M12 9.6c1.5.4 2.6 1.7 2.6 3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
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
  const setCameraStatus = useVcaStore(s => s.setCameraStatus);

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
  const userCount = projectUsers.length;
  const pendingInviteCount = projectUsers.filter(u => u.status === "invited").length;
  const suspendedUserCount = projectUsers.filter(u => u.status === "suspended").length;
  const vipCount = persons.filter(p => p.projectId === projectId).length;
  const zoneCount = new Set(projectCameras.map(c => c.zone).filter(Boolean)).size;
  const aiEngineCount = new Set(projectCameras.flatMap(c => c.aiFeatures ?? [])).size;

  const daysUntilExpiry = project.licenseExpiresAt && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const licenseExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const licenseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  const overChannelLimit = !!project.licenseChannelLimit && projectCameras.length > project.licenseChannelLimit;

  // What a project manager actually needs to act on, surfaced above everything else — see the
  // "20-year PM" discussion this was built from: exception-based, not buried under analytics.
  const attentionItems: { message: string; severity: "danger" | "warning"; onClick: () => void }[] = [];
  if (offlineCount > 0) {
    attentionItems.push({ message: `${offlineCount} camera${offlineCount > 1 ? "s" : ""} offline`, severity: "danger", onClick: () => onTabChange("cameras") });
  }
  if (overChannelLimit) {
    attentionItems.push({ message: `Over camera channel limit (${projectCameras.length} / ${project.licenseChannelLimit})`, severity: "danger", onClick: () => onTabChange("license") });
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
  const highPriorityVipCount = projectPersons.filter(p => p.priorityLabel === "high" || p.priorityLabel === "very_high").length;
  const recentVips = [...projectPersons].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 4);
  const camerasForStatusTable = [...projectCameras]
    .sort((a, b) => (a.status === "offline" ? 0 : 1) - (b.status === "offline" ? 0 : 1))
    .slice(0, 5);

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}><CameraIcon /></span>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Camera Connectivity</p>
              </div>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>
                {onlineCount} <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>/ {projectCameras.length}</span>
              </p>
              <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
                <div style={{ height: "5px", width: `${projectCameras.length ? (onlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--success-400)", borderRadius: "3px" }} />
              </div>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "8px" }}>
                <span style={{ color: "var(--success-400)" }}>●</span> Online {onlineCount} &nbsp; <span style={{ color: "var(--gray-400)" }}>●</span> Offline {offlineCount}
              </p>
            </div>

            <div style={{ backgroundColor: "white", border: overChannelLimit ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}><TagIcon /></span>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>License Usage</p>
              </div>
              <p style={{ fontSize: "20px", fontWeight: 800, color: overChannelLimit ? "var(--danger-400)" : "var(--gray-900)", marginTop: "6px" }}>
                {projectCameras.length} <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>/ {project.licenseChannelLimit ?? "∞"}</span>
              </p>
              {project.licenseChannelLimit ? (
                <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
                  <div style={{ height: "5px", width: `${Math.min(100, (projectCameras.length / project.licenseChannelLimit) * 100)}%`, backgroundColor: overChannelLimit ? "var(--danger-400)" : "var(--primary-400)", borderRadius: "3px" }} />
                </div>
              ) : <div style={{ height: "5px", marginTop: "10px" }} />}
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "8px" }}>
                {project.licensePlan ?? "No plan"} · {licenseExpired ? "Expired" : daysUntilExpiry !== null ? `D-${daysUntilExpiry}` : "—"}
              </p>
            </div>

            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}><SparkleIcon /></span>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>VIP / Watchlist DB</p>
              </div>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{vipCount}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "18px" }}>{highPriorityVipCount} high priority</p>
            </div>

            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "var(--gray-50)", color: "var(--gray-500)", flexShrink: 0 }}><UsersIcon /></span>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>Portal Users</p>
              </div>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "6px" }}>{userCount}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "18px" }}>
                {pendingInviteCount > 0 || suspendedUserCount > 0
                  ? [pendingInviteCount > 0 ? `${pendingInviteCount} pending` : null, suspendedUserCount > 0 ? `${suspendedUserCount} suspended` : null].filter(Boolean).join(" · ")
                  : "All active"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 0" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Camera Connection Status</p>
                  <button onClick={() => onTabChange("cameras")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}>View all →</button>
                </div>
                {camerasForStatusTable.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "16px" }}>No cameras connected yet.</p>
                ) : (
                  <div style={{ marginTop: "12px" }}>
                    {camerasForStatusTable.map((cam, i) => {
                      const online = cam.status === "online";
                      return (
                        <div key={cam.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderTop: i > 0 ? BORDER : "none" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--gray-400)", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{cam.name}</p>
                            <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>{cam.zone}</p>
                          </div>
                          {online ? (
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--success-400)" }}>Online</span>
                          ) : (
                            <button onClick={() => setCameraStatus(cam.id, "online")}
                              style={{ border: BORDER, borderRadius: "999px", backgroundColor: "white", padding: "5px 10px", fontSize: "10px", fontWeight: 600, color: "var(--gray-600)", cursor: "pointer" }}>
                              Reconnect
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>Recently Registered VIPs</p>
                  <button onClick={() => onTabChange("vip")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}>Register VIP →</button>
                </div>
                {recentVips.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>No VIPs registered yet.</p>
                ) : (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {recentVips.map(p => (
                      <div key={p.id} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px", border: BORDER, borderRadius: "10px", padding: "8px" }}>
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
            </div>

            <div style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
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
                <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "6px" }}>Channels: {projectCameras.length} / {project.licenseChannelLimit ?? "∞"}</p>
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
