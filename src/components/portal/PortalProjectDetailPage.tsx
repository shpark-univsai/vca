"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Clock, Key, LogOut, Plus, Settings, Shield, UserPlus, Users, Video } from "lucide-react";
import { canEnterApp, canEnterPortal, currentPortalUser, useVcaStore, projectChannelLimit, UNLIMITED_EXPIRY } from "@/lib/vcaStore";
import { formatElapsed } from "@/lib/time";
import { BORDER, CARD_BORDER, PANEL_SHADOW, TYPE_META, CARD_GAP, OVERVIEW_PANEL_MAX_HEIGHT, TABLE_HEADER_COLOR, MetricCard, SubStat } from "./PortalShared";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { getAuthConfig } from "@/lib/authConfig";
import type { DetailTab } from "./ProjectSidebar";
import ProjectCamerasTab from "./ProjectCamerasTab";
import ProjectVipTab from "./ProjectVipTab";
import ProjectLicenseTab from "./ProjectLicenseTab";
import ProjectServerTab from "./ProjectServerTab";
import PortalUsersPage from "./PortalUsersPage";

const T = {
  en: {
    projectNotFound: "Project not found.",
    addCamera: "Add Camera",
    registerVip: "Register VIP",
    goToApp: "Go to app",
    approveAccessRequests: "Approve Access Requests",
    cameraConnectivity: "Camera Connectivity",
    connectedSuffix: (n: number) => `/ ${n} connected`,
    online: "Online",
    offline: "Offline",
    onlineCount: (n: number) => `Online ${n}`,
    offlineCount: (n: number) => `Offline ${n}`,
    licenseSubscription: "License Subscription",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit} channels used`,
    planNotSet: "Plan not set",
    manage: "Manage →",
    unlimited: "Unlimited",
    expired: "Expired",
    notSet: "Not set",
    // Same phrasing the License page uses, so the two screens agree about the same licence.
    yrRemaining: (n: number) => `${n}yr left`,
    vipTargetDb: "VIP / Target DB",
    todayBadge: (n: number) => `${n} today`,
    highPriorityLabel: (n: number) => `High priority: ${n}`,
    registeredTodayLabel: (n: number) => `Registered today: ${n}`,
    portalAccounts: "Portal Accounts & Permissions",
    accountsSuffix: "accounts",
    pendingAccessRequest: (n: number) => `${n} pending access request${n === 1 ? "" : "s"}`,
    noPendingAccessRequests: "No pending access requests.",
    pendingInvites: (n: number) => `${n} invitation${n === 1 ? "" : "s"} not yet accepted`,
    allAccountsActive: "All accounts active",
    accessSplitLabel: (portal: number, app: number) => `Portal: ${portal} | App: ${app}`,
    cameraStatusTitle: "Camera Status",
    // This card is the page's answer to "is this deployment working". Deliberately not joined by a
    // "last detection" line: every event in this system is a VIP match (EventType is VIP |
    // Tracking, and Tracking is derived from VIP hits across cameras), so days with none are the
    // normal case — an elapsed-time readout would show a healthy site as stale. Whether cameras are
    // streaming is the health question; who walked past is not.
    cameraStatusSubtitle: "Streaming status for cameras connected to this project",
    filterAll: (n: number) => `All (${n})`,
    filterOffline: (n: number) => `Offline (${n})`,
    colCamera: "Camera",
    colZone: "Zone",
    colStreamUrl: "Stream URL",
    colStatus: "Status",
    noOfflineCameras: "No offline cameras — everything is connected.",
    noCamerasYet: "No cameras connected to this project yet.",
    view: "View →",
    viewAllCameras: (n: number) => `View all ${n} cameras →`,
    recentVipsTitle: "Recently Registered VIPs",
    registerVipLink: "Register VIP →",
    noVipsYet: "No VIPs registered yet.",
    accessRequestsTitle: "Access Requests",
    approve: "Approve",
    dismiss: "Dismiss",
    viewMore: (n: number) => `View ${n} more →`,
    recentAdminActivity: "Recent Admin Activity",
    noAdminActivity: "No admin activity yet.",
    agoSuffix: " ago",
    toastApprovedTitle: "Access approved — invite sent",
    toastDismissedTitle: "Request dismissed",
  },
  ko: {
    projectNotFound: "프로젝트를 찾을 수 없습니다.",
    addCamera: "카메라 추가",
    registerVip: "VIP 등록",
    goToApp: "앱으로 이동",
    approveAccessRequests: "접근 요청 승인",
    cameraConnectivity: "카메라 연결 상태",
    connectedSuffix: (n: number) => `/ ${n}대 연결됨`,
    online: "온라인",
    offline: "오프라인",
    onlineCount: (n: number) => `온라인 ${n}`,
    offlineCount: (n: number) => `오프라인 ${n}`,
    licenseSubscription: "라이선스 구독",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit}채널 사용`,
    planNotSet: "요금제 미설정",
    manage: "관리 →",
    unlimited: "무제한",
    expired: "만료됨",
    notSet: "미설정",
    yrRemaining: (n: number) => `${n}년 남음`,
    vipTargetDb: "VIP / 관심대상 DB",
    todayBadge: (n: number) => `오늘 ${n}건`,
    highPriorityLabel: (n: number) => `우선순위 높음: ${n}`,
    registeredTodayLabel: (n: number) => `오늘 등록: ${n}`,
    portalAccounts: "포털 계정 및 권한",
    accountsSuffix: "개 계정",
    pendingAccessRequest: (n: number) => `대기 중인 접근 요청 ${n}건`,
    noPendingAccessRequests: "대기 중인 접근 요청이 없습니다.",
    pendingInvites: (n: number) => `수락하지 않은 초대 ${n}건`,
    allAccountsActive: "모든 계정 활성",
    accessSplitLabel: (portal: number, app: number) => `포털: ${portal} | 앱: ${app}`,
    cameraStatusTitle: "카메라 상태",
    cameraStatusSubtitle: "이 프로젝트에 연결된 카메라의 스트리밍 상태",
    filterAll: (n: number) => `전체 (${n})`,
    filterOffline: (n: number) => `오프라인 (${n})`,
    colCamera: "카메라",
    colZone: "구역",
    colStreamUrl: "스트림 URL",
    colStatus: "상태",
    noOfflineCameras: "오프라인 카메라가 없습니다 — 모두 연결되어 있습니다.",
    noCamerasYet: "이 프로젝트에 연결된 카메라가 아직 없습니다.",
    view: "보기 →",
    viewAllCameras: (n: number) => `카메라 ${n}대 전체 보기 →`,
    recentVipsTitle: "최근 등록된 VIP",
    registerVipLink: "VIP 등록 →",
    noVipsYet: "등록된 VIP가 아직 없습니다.",
    accessRequestsTitle: "접근 요청",
    approve: "승인",
    dismiss: "거절",
    viewMore: (n: number) => `${n}건 더 보기 →`,
    recentAdminActivity: "최근 관리자 활동",
    noAdminActivity: "아직 관리자 활동이 없습니다.",
    agoSuffix: " 전",
    toastApprovedTitle: "접근 승인됨 — 초대장 발송됨",
    toastDismissedTitle: "요청 거절됨",
  },
} as const;

/**
 * Lucide, wrapped one-to-one under the names this file already used.
 *
 * These were nine hand-drawn SVGs, and hand-drawn is how a set stops being a set: the two people
 * icons carried 1.1 strokes while the shield beside them carried 1.2, and "the same icon" was three
 * different drawings in three files. Lucide is already a dependency (Sidebar, BestFramePage, the
 * password toggles) and is bundled rather than fetched, which is what makes it usable on an
 * installation with no route out.
 *
 * Each keeps its original pixel size and stroke weight rather than taking Lucide's default 2, so
 * this swaps the drawing without redrawing the page. Wrappers rather than imports at the call
 * sites, because MetricCard takes `icon: () => JSX.Element` and because one definition per icon is
 * the whole point.
 */
function VideoIcon() { return <Video size={16} strokeWidth={1.2} />; }
function KeyIcon() { return <Key size={16} strokeWidth={1.2} />; }
function UsersGroupIcon() { return <Users size={16} strokeWidth={1.1} />; }
function SettingsIcon() { return <Settings size={16} strokeWidth={1.2} />; }
function ShieldIcon() { return <Shield size={16} strokeWidth={1.2} />; }
function ClockIcon() { return <Clock size={16} strokeWidth={1.2} />; }
function PlusIcon() { return <Plus size={14} strokeWidth={1.4} />; }
function UserPlusIcon() { return <UserPlus size={14} strokeWidth={1.2} />; }
function ArrowUpIcon() { return <ArrowUp size={10} strokeWidth={1.4} />; }
function ExitIcon() { return <LogOut size={14} strokeWidth={1.2} />; }

// Shared shell for the four Overview metric cards — header (eyebrow label + icon badge), then
// whatever body content each card needs (big value, progress bar, footer stats) as children.
interface PortalProjectDetailPageProps {
  projectId: string;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

export default function PortalProjectDetailPage({ projectId, tab, onTabChange }: PortalProjectDetailPageProps) {
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const cameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const persons = useVcaStore(s => s.persons);
  const auditLog = useVcaStore(s => s.auditLog);
  const accessRequests = useVcaStore(s => s.accessRequests);
  const approveAccessRequests = useVcaStore(s => s.approveAccessRequests);
  const dismissAccessRequest = useVcaStore(s => s.dismissAccessRequest);
  const { showToast } = useToast();
  const router = useRouter();
  // Same rule the sidebar's account menu uses: no app, no door to it. Undefined identity is the
  // demo default and fails open, or the console would hide its own way out of itself.
  const meUser = currentPortalUser(portalUsers);
  const appAccess = !meUser || canEnterApp(meUser);
  const [lang] = usePortalLanguage();
  const t = T[lang];

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
    return <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>{t.projectNotFound}</p>;
  }

  const meta = TYPE_META[project.type];
  const orgName = teams.find(o => o.id === project.teamId)?.name ?? project.teamId;
  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  const offlineCount = projectCameras.length - onlineCount;
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));
  // Counted by door, not by role. "Admin: n | Operator: n" filed owners and read-only admins under
  // "operator" simply because they were not the literal string "admin", so the second figure was
  // never the number of anything.
  const portalUserCount = projectUsers.filter(u => canEnterPortal(u.permission)).length;
  const appUserCount = projectUsers.filter(u => u.appAccess).length;

  const channelLimit = projectChannelLimit(project);
  const isUnlimitedExpiry = project.licenseExpiresAt === UNLIMITED_EXPIRY;
  const daysUntilExpiry = project.licenseExpiresAt && !isUnlimitedExpiry && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    : null;
  const licenseExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const licenseExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  /**
   * Days while days matter, years after that.
   *
   * The badge printed daysUntilExpiry raw, so a three-year licence read "D-1004" — a number nobody
   * can hold, and one the License page states as "3yr left" for the same licence. Inside the
   * expiring-soon window a day count is the useful unit; past it, a year count is.
   */
  const yearsUntilExpiry = daysUntilExpiry !== null && daysUntilExpiry > 30
    ? Math.max(1, Math.round(daysUntilExpiry / 365))
    : null;
  const overChannelLimit = !!channelLimit && projectCameras.length > channelLimit;
  const projectAccessRequests = accessRequests.filter(r => r.projectId === projectId);
  // Whether this Overview says anything about access requests at all. Off for on-premise (see
  // authConfig's accessRequest), where no request can ever be made — but still on while real
  // requests exist, so flipping the flag off later cannot bury someone who already asked.
  const showAccessRequests = getAuthConfig().accessRequest || projectAccessRequests.length > 0;
  const pendingInviteCount = projectUsers.filter(u => u.status === "invited").length;

  const recentActivity = auditLog
    .filter(a => a.projectId === projectId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  const projectPersons = persons.filter(p => p.projectId === projectId);
  const recentVips = [...projectPersons].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 3);
  // nowMs-derived, not new Date() directly, so this stays in sync with the same not-yet-mounted ->
  // mounted correction every other clock-reading value on this page already follows.
  const todayStr = nowMs !== null ? new Date(nowMs).toISOString().slice(0, 10) : null;
  // startsWith, not equality: registeredAt is a date on the seeded rows and a full ISO instant on
  // anything registered through Portal now, and "===" quietly counted none of the new ones.
  const todayVipCount = todayStr ? projectPersons.filter(p => p.registeredAt.startsWith(todayStr)).length : 0;
  const highPriorityVipCount = projectPersons.filter(p => p.priorityLabel === "high" || p.priorityLabel === "very_high").length;

  const filteredCameraRows = (cameraStatusFilter === "offline" ? projectCameras.filter(c => c.status === "offline") : projectCameras)
    .slice()
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "offline" ? -1 : 1));
  // Overview is a summary, not the full fleet manager — capped so this one card doesn't grow to
  // however many cameras the project has. "View all" below covers the rest.
  const visibleCameraRows = filteredCameraRows.slice(0, 5);


  const approveRequest = (id: string, name: string) => {
    approveAccessRequests([id]);
    showToast({ variant: "success", title: t.toastApprovedTitle, desc: name });
  };
  const dismissRequest = (id: string, name: string) => {
    dismissAccessRequest(id);
    showToast({ variant: "warning", title: t.toastDismissedTitle, desc: name });
  };

  return (
    <div>
      {tab === "overview" && (
        <>
          {/* Welcome banner — plain page background, not a card (no single button here is "the"
              primary action, so all three stay in the same bordered/white tier rather than
              competing for primary-400). */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{project.name}</p>
                <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: "4px 8px", borderRadius: "999px" }}>{meta.label}</span>
                <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{project.id}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{orgName}</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => onTabChange("cameras")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                <PlusIcon /> {t.addCamera}
              </button>
              <button onClick={() => onTabChange("vip")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                <UserPlusIcon /> {t.registerVip}
              </button>
              {/*
                The visible way out, next to the other things you might do from this screen.
                The header pill is gone (the door lives in the sidebar's account menu now, matching
                how the app puts Portal in its own account menu) — but a door only reachable by
                clicking your own name is a door a first-time admin does not find. This is the same
                outlined tier as its neighbours: leaving is not the primary action here.
                Hidden for a Portal-only account, which would land on a screen it cannot use.
              */}
              {appAccess && (
                <button onClick={() => router.push("/")}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  <ExitIcon /> {t.goToApp}
                </button>
              )}
              {showAccessRequests && (
                <button onClick={() => onTabChange("users")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  <ShieldIcon /> {t.approveAccessRequests}
                  {projectAccessRequests.length > 0 && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)", backgroundColor: "var(--warning-200)", padding: "2px 8px", borderRadius: "999px" }}>
                      {projectAccessRequests.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Metric cards — camera connectivity / license usage / VIP DB / accounts & permissions,
              each grounded in real store data (no fabricated failure-reason breakdowns the data
              model doesn't have). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: CARD_GAP, marginBottom: CARD_GAP }}>
            <MetricCard label={t.cameraConnectivity} icon={VideoIcon} iconBg="var(--success-100)" iconColor="var(--success-400)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{onlineCount}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.connectedSuffix(projectCameras.length)}</p>
              </div>
              {/* Fixed-height row so the footer divider below lands at the same y across all 4 cards —
                  the other two cards fill this slot with a text line instead of a bar, and text's
                  natural height doesn't match an 8px bar without this. */}
              <div style={{ height: "18px", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                  <div style={{ height: "100%", width: `${projectCameras.length ? (onlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--success-400)" }} />
                  <div style={{ height: "100%", width: `${projectCameras.length ? (offlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--danger-400)" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px", marginTop: "6px" }}>
                <SubStat color="var(--success-400)" label={t.onlineCount(onlineCount)} />
                <SubStat color="var(--danger-400)" label={t.offlineCount(offlineCount)} />
              </div>
            </MetricCard>

            <MetricCard label={t.licenseSubscription} icon={KeyIcon} iconBg="var(--info-100)" iconColor="var(--info-500)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectCameras.length}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.channelsUsedSuffix(channelLimit ?? "∞")}</p>
              </div>
              <div style={{ height: "18px", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${channelLimit ? Math.min(100, (projectCameras.length / channelLimit) * 100) : 0}%`, backgroundColor: overChannelLimit ? "var(--danger-400)" : "var(--info-500)" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px", marginTop: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{project.licensePlan ?? t.planNotSet}</p>
                  <button onClick={() => onTabChange("license")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
                    {t.manage}
                  </button>
                </div>
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                  backgroundColor: licenseExpired ? "var(--danger-100)" : licenseExpiringSoon ? "var(--warning-200)" : "var(--info-100)",
                  color: licenseExpired ? "var(--danger-500)" : licenseExpiringSoon ? "var(--warning-500)" : "var(--info-500)",
                }}>
                  {isUnlimitedExpiry ? t.unlimited
                    : licenseExpired ? t.expired
                    : yearsUntilExpiry !== null ? t.yrRemaining(yearsUntilExpiry)
                    : daysUntilExpiry !== null ? `D-${daysUntilExpiry}`
                    : t.notSet}
                </span>
              </div>
            </MetricCard>

            <MetricCard label={t.vipTargetDb} icon={UsersGroupIcon} iconBg="var(--primary-100)" iconColor="var(--primary-400)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectPersons.length}</p>
                {todayVipCount > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 600, color: "var(--success-400)" }}>
                    <ArrowUpIcon /> {t.todayBadge(todayVipCount)}
                  </span>
                )}
              </div>
              {/* Empty on purpose, and still 18px tall.
                  The other three cards put something real in this slot — two progress bars and an
                  account-state line — and it is what keeps all four footer dividers on one line.
                  This card had a sentence describing what the card is ("Registered watchlist
                  individuals for this project"), which the label above it already says. There is no
                  second figure here worth the room, so the slot holds the space and nothing else. */}
              <div style={{ height: "18px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px", marginTop: "6px" }}>
                <p style={{ fontSize: "12px", color: "var(--primary-400)", fontWeight: 600 }}>{t.highPriorityLabel(highPriorityVipCount)}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.registeredTodayLabel(todayVipCount)}</p>
              </div>
            </MetricCard>

            <MetricCard label={t.portalAccounts} icon={SettingsIcon} iconBg="var(--warning-100)" iconColor="var(--warning-500)">
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectUsers.length}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.accountsSuffix}</p>
              </div>
              {/* This card stays — it counts accounts, which has nothing to do with access requests.
                  Only its middle line changes: with requests switched off, "No pending access
                  requests" would be a permanent non-answer, so the slot reports the one account
                  state an administrator here can actually act on instead. The 18px is load-bearing
                  (it keeps all four cards' footer dividers on the same line), so the slot is
                  refilled, never emptied. */}
              <div style={{ height: "18px", display: "flex", alignItems: "center" }}>
                {projectAccessRequests.length > 0 ? (
                  <button onClick={() => onTabChange("users")} style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%", overflow: "hidden", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "var(--warning-500)" }}>
                    <ShieldIcon />
                    <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.pendingAccessRequest(projectAccessRequests.length)}</span>
                  </button>
                ) : showAccessRequests ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.noPendingAccessRequests}</p>
                ) : pendingInviteCount > 0 ? (
                  <button onClick={() => onTabChange("users")} style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%", overflow: "hidden", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", color: "var(--warning-500)" }}>
                    <ShieldIcon />
                    <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.pendingInvites(pendingInviteCount)}</span>
                  </button>
                ) : (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.allAccountsActive}</p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: BORDER, paddingTop: "10px", marginTop: "6px" }}>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.accessSplitLabel(portalUserCount, appUserCount)}</p>
                <button onClick={() => onTabChange("users")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.manage}</button>
              </div>
            </MetricCard>
          </div>

          {/* Same 4-column grid + gap as the metrics row above, so the left column's right edge
              lands exactly on the boundary between card 2 (License Subscription) and card 3 —
              a flex-basis split couldn't guarantee that alignment across viewport widths the way
              sharing the grid's own column lines does. */}
          {/* alignItems stretch, not start: the three panels below are a row, and a row whose
              members each stop wherever their own content happens to end reads as three unrelated
              boxes. Capped at OVERVIEW_PANEL_MAX_HEIGHT so a project with a lot of activity cannot
              push the rest of the page off the fold — past that, each panel scrolls its own list. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: CARD_GAP, alignItems: "stretch", maxHeight: OVERVIEW_PANEL_MAX_HEIGHT, marginBottom: CARD_GAP }}>
            <div style={{ gridColumn: "1 / span 2", display: "flex", flexDirection: "column", gap: CARD_GAP, minWidth: 0, minHeight: 0 }}>
              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: BORDER, flexWrap: "wrap", gap: "10px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--info-100)", color: "var(--info-500)", flexShrink: 0 }}><VideoIcon /></span>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.cameraStatusTitle}</p>
                      <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.cameraStatusSubtitle}</p>
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
                        {f === "all" ? t.filterAll(projectCameras.length) : t.filterOffline(offlineCount)}
                      </button>
                    ))}
                  </div>
                </div>
                {visibleCameraRows.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--gray-400)", padding: "24px", textAlign: "center" }}>
                    {cameraStatusFilter === "offline" ? t.noOfflineCameras : t.noCamerasYet}
                  </p>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 0.7fr 60px", padding: "8px 20px", backgroundColor: "var(--gray-50)", gap: "8px", flexShrink: 0 }}>
                      {[t.colCamera, t.colZone, t.colStreamUrl, t.colStatus, ""].map(h => (
                        <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                      ))}
                    </div>
                    {/* Only the rows scroll. The column headings above and the "view all" below are
                        the two things you need while scrolling, so they stay put. */}
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
                            fontSize: "12px", fontWeight: 600, padding: "4px 8px", borderRadius: "6px", width: "fit-content",
                            backgroundColor: online ? "var(--success-100)" : "var(--danger-100)", color: online ? "var(--success-400)" : "var(--danger-400)",
                          }}>
                            {online ? t.online : t.offline}
                          </span>
                          <button onClick={() => onTabChange("cameras")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.view}</button>
                        </div>
                      );
                    })}
                    </div>
                    {filteredCameraRows.length > visibleCameraRows.length && (
                      <button onClick={() => onTabChange("cameras")}
                        style={{ display: "block", width: "100%", textAlign: "center", border: "none", borderTop: BORDER, background: "none", padding: "10px 20px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", flexShrink: 0 }}>
                        {t.viewAllCameras(filteredCameraRows.length)}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Same width as the VIP / Target DB metric card above it (grid column 3 only, not
                spanning) — sits directly underneath rather than sharing a row with Camera Status. */}
            <div style={{ gridColumn: "3 / span 1", display: "flex", flexDirection: "column", gap: CARD_GAP, minWidth: 0, minHeight: 0 }}>
              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--primary-100)", color: "var(--primary-400)", flexShrink: 0 }}><UsersGroupIcon /></span>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.recentVipsTitle}</p>
                  </div>
                  <button onClick={() => onTabChange("vip")} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{t.registerVipLink}</button>
                </div>
                {recentVips.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noVipsYet}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {recentVips.map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", border: BORDER, borderRadius: "12px", padding: "10px" }}>
                        <img src={p.photoUrl} alt="" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                          <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{p.registeredAt.slice(0, 10)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Same width as the Portal Accounts & Permissions metric card above it. The Access
                Requests card inside is hidden along with the flow it reports on — with accessRequest
                off nothing can ever land there, and a permanently empty "Access Requests · none
                pending" describes a door this deployment does not have. Only that card: Recent
                Activity shares this column and is unrelated. Still shown while real requests exist,
                so turning the flag off later cannot strand someone who already asked. */}
            <div style={{ gridColumn: "4 / span 1", display: "flex", flexDirection: "column", gap: CARD_GAP, minWidth: 0, minHeight: 0 }}>
              {showAccessRequests && (
              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--warning-100)", color: "var(--warning-500)", flexShrink: 0 }}><ShieldIcon /></span>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.accessRequestsTitle}</p>
                  </div>
                  {projectAccessRequests.length > 0 && (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)", backgroundColor: "var(--warning-200)", padding: "2px 8px", borderRadius: "999px" }}>
                      {projectAccessRequests.length}
                    </span>
                  )}
                </div>
                {projectAccessRequests.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noPendingAccessRequests}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {projectAccessRequests.slice(0, 2).map(r => (
                      <div key={r.id} style={{ border: BORDER, borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{r.name}</p>
                        {r.reason && <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>&quot;{r.reason}&quot;</p>}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => approveRequest(r.id, r.name)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                            {t.approve}
                          </button>
                          <button className="portal-btn-outline" onClick={() => dismissRequest(r.id, r.name)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                            {t.dismiss}
                          </button>
                        </div>
                      </div>
                    ))}
                    {projectAccessRequests.length > 2 && (
                      <button onClick={() => onTabChange("users")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", textAlign: "left" }}>
                        {t.viewMore(projectAccessRequests.length - 2)}
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}

              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexShrink: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)", flexShrink: 0 }}><ClockIcon /></span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.recentAdminActivity}</p>
                </div>
                {recentActivity.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noAdminActivity}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {recentActivity.map((a, i) => (
                      <div key={a.id} style={{ display: "flex", gap: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "8px", flexShrink: 0 }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--primary-400)", flexShrink: 0 }} />
                          {i < recentActivity.length - 1 && <span style={{ width: "1px", flex: 1, backgroundColor: "var(--gray-200)", marginTop: "2px" }} />}
                        </div>
                        <div style={{ paddingBottom: "14px", minWidth: 0 }}>
                          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)" }}>{a.message}</p>
                          <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>
                            {a.actor}{nowMs !== null ? ` · ${formatElapsed(nowMs - new Date(a.at).getTime())}${t.agoSuffix}` : ""}
                          </p>
                        </div>
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
