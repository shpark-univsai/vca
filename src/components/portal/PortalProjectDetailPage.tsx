"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Key, LogOut, Plus, Settings, Shield, UserPlus, Users, Video } from "lucide-react";
import { canEnterApp, canEnterPortal, currentPortalUser, useVcaStore, projectChannelLimit, UNLIMITED_EXPIRY } from "@/lib/vcaStore";
import { formatElapsed } from "@/lib/time";
import { BORDER, CARD_BORDER, PANEL_SHADOW, TYPE_META, CARD_GAP, OVERVIEW_PANEL_MAX_HEIGHT, TABLE_HEADER_COLOR, MetricCard } from "./PortalShared";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { getAuthConfig } from "@/lib/authConfig";
import { PROJECT_TABS, type DetailTab } from "./ProjectSidebar";
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
    licenseSubscription: "License Subscription",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit} channels used`,
    manage: "Manage →",
    vipTargetDb: "VIP / Target DB",
    todayBadge: (n: number) => `${n} today`,
    highPriorityLabel: (n: number) => `High priority: ${n}`,
    portalAccounts: "Portal Accounts & Permissions",
    accountsSuffix: "accounts",
    noPendingAccessRequests: "No pending access requests.",
    attentionTitle: "Things to do",
    attnOffline: (n: number) => `${n} camera${n === 1 ? " is" : "s are"} offline`,
    attnInvites: (n: number) => `${n} invitation${n === 1 ? "" : "s"} not yet accepted`,
    attnRequests: (n: number) => `${n} access request${n === 1 ? "" : "s"} waiting`,
    attnOverLimit: (used: number, limit: number) => `Over the licensed channels — ${used} of ${limit}`,
    attnExpiringSoon: (d: number) => `License expires in ${d} day${d === 1 ? "" : "s"}`,
    attnExpired: "License has expired",
    attnNoCameras: "No source connected yet",
    attnNoVips: "No one registered in the watchlist yet",
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
    licenseSubscription: "라이선스 구독",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit}채널 사용`,
    manage: "관리 →",
    vipTargetDb: "VIP / 관심대상 DB",
    todayBadge: (n: number) => `오늘 ${n}건`,
    highPriorityLabel: (n: number) => `우선순위 높음: ${n}`,
    portalAccounts: "포털 계정 및 권한",
    accountsSuffix: "개 계정",
    noPendingAccessRequests: "대기 중인 접근 요청이 없습니다.",
    attentionTitle: "할 일",
    attnOffline: (n: number) => `오프라인 카메라 ${n}대`,
    attnInvites: (n: number) => `수락하지 않은 초대 ${n}건`,
    attnRequests: (n: number) => `대기 중인 접근 요청 ${n}건`,
    attnOverLimit: (used: number, limit: number) => `라이선스 채널 초과 — ${limit}개 중 ${used}개`,
    attnExpiringSoon: (d: number) => `라이선스 ${d}일 후 만료`,
    attnExpired: "라이선스가 만료되었습니다",
    attnNoCameras: "연결된 소스가 없습니다",
    attnNoVips: "등록된 관심대상이 없습니다",
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


  /**
   * What this project needs a person to do, ahead of everything that merely reports.
   *
   * The four cards below answer "how are things" — but three of their four numbers only ever move
   * because an administrator moved them, and the one signal worth acting on (cameras that dropped)
   * was a small sub-line inside the first card, weighed the same as an account count. This is the
   * arrangement Remote, Shopify, Deel and Zendesk all open their console with: what needs you,
   * then the trackers.
   *
   * Nothing here is a new fact — every row is a figure already on this page or the tab it links to.
   * Named "Things to do", which is what the consoles that open this way call it — Remote and
   * Shopify both use exactly that, Cloudflare "Next steps", Deel "For you today". "Needs
   * attention" was a phrase from nowhere.
   *
   * Ordered by how bad it is: what is broken, then what is waiting on someone, then what was never
   * set up. The card renders only when the list is non-empty: a panel whose whole job is to
   * interrupt you says nothing when it has nothing, and "all clear" in a permanent box is the kind
   * of line this screen has been shedding.
   */
  const attentionItems: { key: string; text: string; color: string; tab: DetailTab }[] = [
    ...(offlineCount > 0 ? [{ key: "offline", text: t.attnOffline(offlineCount), color: "var(--danger-400)", tab: "cameras" as DetailTab }] : []),
    ...(licenseExpired ? [{ key: "expired", text: t.attnExpired, color: "var(--danger-400)", tab: "license" as DetailTab }] : []),
    ...(overChannelLimit && channelLimit ? [{ key: "overlimit", text: t.attnOverLimit(projectCameras.length, channelLimit), color: "var(--danger-400)", tab: "license" as DetailTab }] : []),
    ...(licenseExpiringSoon && daysUntilExpiry !== null ? [{ key: "expiring", text: t.attnExpiringSoon(daysUntilExpiry), color: "var(--warning-500)", tab: "license" as DetailTab }] : []),
    ...(showAccessRequests && projectAccessRequests.length > 0 ? [{ key: "requests", text: t.attnRequests(projectAccessRequests.length), color: "var(--warning-500)", tab: "users" as DetailTab }] : []),
    ...(pendingInviteCount > 0 ? [{ key: "invites", text: t.attnInvites(pendingInviteCount), color: "var(--warning-500)", tab: "users" as DetailTab }] : []),
    ...(projectCameras.length === 0 ? [{ key: "nocams", text: t.attnNoCameras, color: "var(--gray-400)", tab: "cameras" as DetailTab }] : []),
    ...(projectPersons.length === 0 ? [{ key: "novips", text: t.attnNoVips, color: "var(--gray-400)", tab: "vip" as DetailTab }] : []),
  ];

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

          {/* One line, not a stack.
              The list is short by construction — most projects raise one or two of these, and the
              worst case is six — so a stacked panel spent a card's worth of height on two
              sentences before the reader reached anything else. On one row it reads as a status
              strip: the label, then the errands, each its own button. It wraps rather than
              scrolling or truncating, so a project in real trouble gets a second line instead of
              a hidden sixth item.
              The destination tab name is gone with the stack (it doubled each item's width); the
              hover box says the item is clickable, and the text already says where it goes.

              The one tinted card on the page. Everything else here is white on white separated by
              a hairline, which is right for the panels — they are all the same kind of thing. This
              strip is not: it is the only card that appears because something is wrong, and it is
              gone when nothing is. A different ground says that before the words do, and gray-50
              is quiet enough to say it without becoming a banner. */}
          {attentionItems.length > 0 && (
            <div style={{
              // No outline: the tint is the edge. This is the same rule the white cards followed
              // back when the page itself was grey — a fill that differs from its ground does not
              // need a line around it as well, and the line was drawing a box around the one thing
              // on the page that should read as a strip.
              backgroundColor: "var(--gray-50)", border: "none", borderRadius: "16px", boxShadow: "none",
              padding: "10px 20px", marginBottom: CARD_GAP,
              display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", flexShrink: 0, marginRight: "2px" }}>
                {t.attentionTitle}
              </p>
              {attentionItems.map(item => (
                <button
                  key={item.key}
                  className="portal-attention-row"
                  onClick={() => onTabChange(item.tab)}
                  title={PROJECT_TABS.find(pt => pt.id === item.tab)?.label[lang]}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    border: "none", background: "none", borderRadius: "8px",
                    padding: "6px 8px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", whiteSpace: "nowrap" }}>{item.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Metric cards — camera connectivity / license usage / VIP DB / accounts & permissions,
              each grounded in real store data (no fabricated failure-reason breakdowns the data
              model doesn't have).

              All four icon badges are the same grey. They were green, blue, purple and amber, which
              is four colours carrying nothing: the icon already says which card this is, and the
              hues were the same ones the bars below use to mean online, over-limit, high-priority
              and invited. Spending them on decoration is what made the state colours stop reading
              as state. Colour on this screen now means something or is grey. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: CARD_GAP, marginBottom: CARD_GAP }}>
            <MetricCard label={t.cameraConnectivity} icon={VideoIcon} iconBg="var(--gray-100)" iconColor="var(--gray-500)">
              {/* Figure left, bar right, one line.
                  Stacked, the bar cost the card a whole row for something 8px tall, and the right
                  half of the card sat empty on a wide monitor.
                  Fixed 88px, not the leftover space: the figures beside it are different lengths
                  ("59 / 100 channels used" against "51 / 59 connected"), so a flexible bar came out
                  a different size in each card, and two proportions you cannot compare are worse
                  than no bars. It shrinks only when the column gets too narrow to hold both. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "4px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{onlineCount}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.connectedSuffix(projectCameras.length)}</span>
                </span>
                <div style={{ flex: "0 1 88px", minWidth: 0, height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                  <div style={{ height: "100%", width: `${projectCameras.length ? (onlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--success-400)" }} />
                  <div style={{ height: "100%", width: `${projectCameras.length ? (offlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--danger-400)" }} />
                </div>
              </div>
              {/* The online/offline legend that used to sit under a rule here is gone: "51 / 59
                  connected" already gives both numbers, the bar's red segment shows the share, and
                  a non-zero offline count is a line in the "things to do" strip above. */}
            </MetricCard>

            <MetricCard label={t.licenseSubscription} icon={KeyIcon} iconBg="var(--gray-100)" iconColor="var(--gray-500)">
              {/* Figure left, bar right, one line.
                  Stacked, the bar cost the card a whole row for something 8px tall, and the right
                  half of the card sat empty on a wide monitor.
                  Fixed 88px, not the leftover space: the figures beside it are different lengths
                  ("59 / 100 channels used" against "51 / 59 connected"), so a flexible bar came out
                  a different size in each card, and two proportions you cannot compare are worse
                  than no bars. It shrinks only when the column gets too narrow to hold both. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "4px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectCameras.length}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.channelsUsedSuffix(channelLimit ?? "∞")}</span>
                </span>
                <div style={{ flex: "0 1 88px", minWidth: 0, height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${channelLimit ? Math.min(100, (projectCameras.length / channelLimit) * 100) : 0}%`, backgroundColor: overChannelLimit ? "var(--danger-400)" : "var(--info-500)" }} />
                </div>
              </div>
              {/* Plan name, "Manage" and the expiry chip are gone from here. This card answers one
                  question — how much of the licence is in use — and the rest of the contract is a
                  whole tab away, one click down the rail. An expiry that is actually close raises a
                  line in the "things to do" strip instead of wearing a chip on a card all year. */}
            </MetricCard>

            <MetricCard label={t.vipTargetDb} icon={UsersGroupIcon} iconBg="var(--gray-100)" iconColor="var(--gray-500)">
              {/* One row, no bar and no footer rule.
                  A bar needs a denominator that means something. The two cards to the left have
                  one — cameras installed, channels licensed — and these two do not: nobody manages
                  "half the watchlist is high priority" or "60% of accounts are active". A
                  proportion invented to fill a slot is worse than an empty slot, so with the bar
                  gone the detail that was under the rule moved up beside the figure instead: the
                  right of this row was empty and the rule was separating a number from its own
                  description. Counts worth acting on live in the "things to do" strip up top. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "8px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectPersons.length}</span>
                  {todayVipCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 600, color: "var(--success-400)" }}>
                      <ArrowUpIcon /> {t.todayBadge(todayVipCount)}
                    </span>
                  )}
                </span>
                {/* "Registered today: 0" is not here any more: the green ↑ beside the figure says
                    the same thing when there is anything to say, and said nothing the rest of the
                    time. */}
                <p style={{ fontSize: "12px", color: "var(--primary-400)", fontWeight: 600, flexShrink: 0 }}>{t.highPriorityLabel(highPriorityVipCount)}</p>
              </div>
            </MetricCard>

            <MetricCard label={t.portalAccounts} icon={SettingsIcon} iconBg="var(--gray-100)" iconColor="var(--gray-500)">
              {/* One row, no bar and no footer rule.
                  A bar needs a denominator that means something. The two cards to the left have
                  one — cameras installed, channels licensed — and these two do not: nobody manages
                  "half the watchlist is high priority" or "60% of accounts are active". A
                  proportion invented to fill a slot is worse than an empty slot, so with the bar
                  gone the detail that was under the rule moved up beside the figure instead: the
                  right of this row was empty and the rule was separating a number from its own
                  description. Counts worth acting on live in the "things to do" strip up top. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "4px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectUsers.length}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.accountsSuffix}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", marginLeft: "4px" }}>{t.accessSplitLabel(portalUserCount, appUserCount)}</span>
                </span>
                <button onClick={() => onTabChange("users")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", flexShrink: 0 }}>{t.manage}</button>
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
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.recentVipsTitle}</p>
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
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.accessRequestsTitle}</p>
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
                {/* Plain title, no icon chip.
                    All four panels down here wore a 28px coloured square — video blue, VIP purple,
                    requests amber, this one grey. Four of them in one row is decoration: the panels
                    are told apart by what is inside them, the metric cards above already carry
                    coloured badges, and spending purple on a heading is spending the accent on
                    something that was never the point of the screen. */}
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "14px", flexShrink: 0 }}>{t.recentAdminActivity}</p>
                {recentActivity.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noAdminActivity}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {recentActivity.map((a, i) => (
                      <div key={a.id} style={{ display: "flex", gap: "10px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "8px", flexShrink: 0 }}>
                          {/* Grey, not primary: every entry gets the same dot, so the colour was
                              never distinguishing one from another — it was a purple column down
                              the side of an audit log. */}
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--gray-300)", flexShrink: 0 }} />
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
