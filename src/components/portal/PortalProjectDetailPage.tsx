"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowUpRight, ChevronRight, FileText, LogOut, Plus, Settings, Shield, UserPlus, Users, Video, X, Zap } from "lucide-react";
import { canEnterApp, canEnterPortal, currentPortalUser, SIGNED_IN_USER, useVcaStore, projectChannelLimit, UNLIMITED_EXPIRY } from "@/lib/vcaStore";
import { formatElapsed, sgtClockMinutes } from "@/lib/time";
import { BORDER, CARD_BORDER, PANEL_SHADOW, CARD_GAP, OVERVIEW_PANEL_MAX_HEIGHT, TABLE_HEADER_COLOR, MetricCard } from "./PortalShared";
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
    greetMorning: (name: string) => `Good morning, ${name}`,
    greetAfternoon: (name: string) => `Good afternoon, ${name}`,
    greetEvening: (name: string) => `Good evening, ${name}`,
    liveMonitoring: "LIVE MONITORING",
    chipHealthy: "HEALTHY",
    chipAttention: (n: number) => `${n} OFFLINE`,
    chipNewThisMonth: (n: number) => `+${n} THIS MONTH`,
    chipAccessSplit: (portal: number, app: number) => `${portal} PORTAL · ${app} APP`,
    statAvailable: (n: number) => `${n} available`,
    statOnlineShare: (pct: number) => `${pct}% online`,
    noCamerasOnline: "NO CAMERA ONLINE",
    approveAccessRequests: "Approve Access Requests",
    cameraConnectivity: "Camera connectivity",
    connectedSuffix: (n: number) => `/ ${n} connected`,
    online: "Online",
    offline: "Offline",
    licenseSubscription: "License subscription",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit} channels used`,
    vipTargetDb: "VIP / target database",
    todayBadge: (n: number) => `${n} today`,
    portalAccounts: "Portal accounts",
    accountsSuffix: "active admins",
    recordsSuffix: "records",
    noPendingAccessRequests: "No pending access requests.",
    attentionTitle: "Attention needed",
    dismissBanner: "Dismiss",
    attnOffline: (n: number) => `${n} camera${n === 1 ? " is" : "s are"} offline`,
    attnInvites: (n: number) => `${n} invitation${n === 1 ? "" : "s"} not yet accepted`,
    attnRequests: (n: number) => `${n} access request${n === 1 ? "" : "s"} waiting`,
    attnOverLimit: (used: number, limit: number) => `Over the licensed channels — ${used} of ${limit}`,
    attnExpiringSoon: (d: number) => `License expires in ${d} day${d === 1 ? "" : "s"}`,
    attnExpired: "License has expired",
    attnNoCameras: "No source connected yet",
    attnNoVips: "No one registered in the watchlist yet",
    accessSplitLabel: (portal: number, app: number) => `Portal: ${portal} | App: ${app}`,
    cameraStatusTitle: "Camera status",
    seeAll: "See all",
    colLastSignal: "Last signal",
    totalCameras: (n: number) => `${n} total`,
    registeredOn: (d: string) => `Registered ${d}`,
    activitySubtitle: "Changes across your workspace",
    vipsSubtitle: "Latest profiles added to your target database",
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
    viewAllCameras: (n: number) => `View all ${n} cameras`,
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
    greetMorning: (name: string) => `좋은 아침이에요, ${name}님`,
    greetAfternoon: (name: string) => `안녕하세요, ${name}님`,
    greetEvening: (name: string) => `좋은 저녁이에요, ${name}님`,
    liveMonitoring: "실시간 모니터링",
    chipHealthy: "정상",
    chipAttention: (n: number) => `오프라인 ${n}`,
    chipNewThisMonth: (n: number) => `이번 달 +${n}`,
    chipAccessSplit: (portal: number, app: number) => `포털 ${portal} · 앱 ${app}`,
    statAvailable: (n: number) => `${n} 여유`,
    statOnlineShare: (pct: number) => `온라인 ${pct}%`,
    noCamerasOnline: "온라인 카메라 없음",
    approveAccessRequests: "접근 요청 승인",
    cameraConnectivity: "카메라 연결 상태",
    connectedSuffix: (n: number) => `/ ${n}대 연결됨`,
    online: "온라인",
    offline: "오프라인",
    licenseSubscription: "라이선스 구독",
    channelsUsedSuffix: (limit: number | string) => `/ ${limit}채널 사용`,
    vipTargetDb: "VIP / 관심대상 DB",
    todayBadge: (n: number) => `오늘 ${n}건`,
    portalAccounts: "포털 계정",
    accountsSuffix: "명",
    recordsSuffix: "건",
    noPendingAccessRequests: "대기 중인 접근 요청이 없습니다.",
    attentionTitle: "확인 필요",
    dismissBanner: "닫기",
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
    seeAll: "전체 보기",
    colLastSignal: "마지막 신호",
    totalCameras: (n: number) => `전체 ${n}`,
    registeredOn: (d: string) => `${d} 등록`,
    activitySubtitle: "이 작업 공간에서 일어난 변경",
    vipsSubtitle: "관심대상 목록에 최근 추가된 인물",
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
    viewAllCameras: (n: number) => `카메라 ${n}대 전체 보기`,
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
function VideoIcon() { return <Video size={16} strokeWidth={2.1} />; }
/**
 * A licence is a document, not a key.
 *
 * This was lucide's Key, which in every console means credentials — an API key, an access token,
 * a password. The card is about the contract: how many channels were bought and how many are in
 * use. The rail's own License tab already draws a sheet with two lines on it, and the same
 * destination should carry the same mark in both places.
 */
function LicenseDocIcon() { return <FileText size={16} strokeWidth={2.1} />; }
function UsersGroupIcon() { return <Users size={16} strokeWidth={2.1} />; }
function SettingsIcon() { return <Settings size={16} strokeWidth={2.1} />; }
function ShieldIcon() { return <Shield size={16} strokeWidth={2.1} />; }
function PlusIcon() { return <Plus size={14} strokeWidth={2.4} />; }
function UserPlusIcon() { return <UserPlus size={14} strokeWidth={2.4} />; }
function ArrowUpIcon() { return <ArrowUp size={10} strokeWidth={3.36} />; }
/**
 * The state, in a word, beside the card's icon — in the icon's own colour.
 *
 * Text only, no pill: a filled chip put a second small box next to the badge and made the card
 * open with two shapes before a word. And the colour is the badge's, so the two read as one mark
 * rather than as an icon and an unrelated label that happen to share a line. The card's hue is
 * therefore doing two jobs — saying which card this is, and carrying its state — which is why the
 * camera card turns its badge red as well when something is offline, rather than leaving a green
 * icon beside a red word.
 */
/**
 * "2026-09-01 14:32" when the registration carries a time, "2026-09-01" when it does not.
 *
 * registeredAt is two shapes: a bare day on the seeded rows and a full instant on anything
 * registered through the app. Rather than guess a time for the first kind, this prints what is
 * actually stored.
 */
function registeredStamp(value: string): string {
  const day = value.slice(0, 10);
  if (!value.includes("T")) return day;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? day : `${day} ${sgtClockMinutes(at)}`;
}

function StateChip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.4px", whiteSpace: "nowrap", color }}>
      {text}
    </span>
  );
}

/** The pair of small figures under a card's bar — "86% utilised" on the left, "14 available" on
 *  the right. Only cards with a bar have one: it is the bar's legend, not a footer. */
function BarStats({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "3px" }}>
      <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>{left}</span>
      <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{right}</span>
    </div>
  );
}

/**
 * A panel's head: the title and one line saying what the panel holds. Nothing else.
 *
 * There was a dotted eyebrow above the title — NETWORK OVERVIEW, PEOPLE & ACCESS, AUDIT TRAIL —
 * copied from the reference, where it groups a longer page into named sections. Here there are
 * three panels and each already has a title that says what it is, so the eyebrow was a second
 * heading for the same box.
 *
 * There was also an optional action beside the title. All three panels now put their way out at
 * their foot, in a full-width row, so a head that could also hold one only let the three heads
 * drift apart.
 */
function SectionHead({ title, subtitle }: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>{title}</p>
      {subtitle && <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{subtitle}</p>}
    </div>
  );
}

function ExitIcon() { return <LogOut size={14} strokeWidth={2.4} />; }

/**
 * "Good morning" until noon, "Good afternoon" until six, "Good evening" after.
 *
 * The boundaries are the ones every product that does this uses; there is no cleverer answer, and
 * a greeting that is wrong by an hour costs nothing. Takes the timestamp rather than reading the
 * clock itself, so the caller decides when it is safe to know the time — see nowMs.
 */
function greeting(ms: number, name: string, t: { greetMorning: (n: string) => string; greetAfternoon: (n: string) => string; greetEvening: (n: string) => string }) {
  const h = new Date(ms).getHours();
  if (h < 12) return t.greetMorning(name);
  if (h < 18) return t.greetAfternoon(name);
  return t.greetEvening(name);
}

/** "Tuesday · 08 Sep 2026" / "2026년 9월 8일 화요일" — the viewer's locale does the work. */
function longDate(ms: number, lang: "en" | "ko") {
  const d = new Date(ms);
  return lang === "ko"
    ? d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
    : d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

// Shared shell for the four Overview metric cards — header (eyebrow label + icon badge), then
// whatever body content each card needs (big value, progress bar, footer stats) as children.
interface PortalProjectDetailPageProps {
  projectId: string;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

export default function PortalProjectDetailPage({ projectId, tab, onTabChange }: PortalProjectDetailPageProps) {
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
  // Same fallback the account menu uses: the demo identity is in no account list, and a screen
  // that greets you by name cannot greet you by nobody.
  const admin = meUser ?? SIGNED_IN_USER;
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
  // Session-only, deliberately: see the banner's note. Nothing here is resolved by closing it.
  const [attentionDismissed, setAttentionDismissed] = useState(false);
  // Read after mount, not during render: the clock is not a pure input, and license expiry is
  // the only thing here that needs it — same pattern ProjectLicenseTab uses. Reads as not-expired
  // for the first frame, then corrects itself once mounted (no server/client mismatch).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>{t.projectNotFound}</p>;
  }

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
  // Registered since the first of this month — the chip's "+12 this month". Same startsWith rule
  // the today figure uses: registeredAt is a date on seeded rows and an instant on new ones.
  const monthStr = nowMs !== null ? new Date(nowMs).toISOString().slice(0, 7) : null;
  const newVipsThisMonth = monthStr ? projectPersons.filter(p => p.registeredAt.startsWith(monthStr)).length : 0;
  const onlineShare = projectCameras.length ? Math.round((onlineCount / projectCameras.length) * 100) : 0;

  /**
   * Ordered by last signal, longest silence first.
   *
   * A "last signal" column is read for staleness — a camera that has said nothing for ten hours is
   * an errand, and one that reported nine seconds ago is not news. Newest-first put the least
   * informative rows at the top and buried the useful ones under fifty healthy cameras.
   *
   * This does mostly reproduce the old offline-first order, since a camera that is down is a
   * camera that stopped reporting — but it reproduces it as a consequence of the column the panel
   * is sorted by rather than as a claim that this list is a fault report. A camera with no
   * lastSeenAt sorts last: "unknown" is not "long ago", and guessing would put it at the top of a
   * worklist it may not belong on.
   */
  const filteredCameraRows = (cameraStatusFilter === "offline" ? projectCameras.filter(c => c.status === "offline") : projectCameras)
    .slice()
    .sort((a, b) => {
      if (!a.lastSeenAt || !b.lastSeenAt) return a.lastSeenAt ? -1 : b.lastSeenAt ? 1 : 0;
      return a.lastSeenAt.localeCompare(b.lastSeenAt);
    });
  // Every row the filter selects, not the first five of them. The card is a fixed height and its
  // row area scrolls, so a cap bought nothing — and with offline sorted first it made "All" look
  // exactly like "Offline" on any project with five cameras down. The panel is the same size; the
  // list inside it is now the whole list.
  const visibleCameraRows = filteredCameraRows;


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
          {/*
            The page opens by greeting whoever is reading it, the way the reference dashboard does.
            Three lines: today's date with a live dot, the greeting, then one sentence naming the
            project. It used to open with the project name, a type chip and the raw project id —
            three labels about the record rather than a word to the person, and the id is on the
            Server tab where somebody copying it actually needs it.

            The greeting reads the clock, so it can only be drawn after mount — before that the
            date line and the greeting are absent rather than guessed, the same nowMs gate this
            page already uses for the licence countdown and the audit log's relative times.
          */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minHeight: "14px" }}>
                {nowMs !== null && (
                  <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.4px", color: "var(--gray-500)" }}>
                    {longDate(nowMs, lang)}
                  </span>
                )}
                {/* primary-400, not the success green. "Live monitoring" is not a good outcome,
                    it is what this console is doing right now — the same thing the product's own
                    colour marks everywhere else on the page. Green is left for a state something
                    passed, and there is no test here to pass. Nothing online stays grey. */}
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.4px", color: onlineCount > 0 ? "var(--primary-400)" : "var(--gray-400)" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: onlineCount > 0 ? "var(--primary-400)" : "var(--gray-300)" }} />
                  {onlineCount > 0 ? t.liveMonitoring : t.noCamerasOnline}
                </span>
              </div>
              <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.4px", minHeight: "34px" }}>
                {nowMs !== null ? greeting(nowMs, admin.name, t) : ""}
              </p>
              {/* No line under the greeting. "Here's the current pulse of your … network" told the
                  reader what the page they are already looking at is for, and the project's name
                  is in the rail, in the crumb and in the sentence's own place — three times before
                  this line said it a fourth. */}
            </div>
            {/* 12px, not 13. They sit beside a 26px greeting, and at 13 they were the loudest
                thing in a header whose point is the sentence. 12 is what every other toolbar
                button in Portal is already set at, so it is not a new size either. */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => onTabChange("cameras")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                <PlusIcon /> {t.addCamera}
              </button>
              <button onClick={() => onTabChange("vip")}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
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
              {/* The one filled button on the screen.
                  Three outlined buttons in a row said none of them mattered more than the others,
                  and a header like this one wants a recommendation. This is it: Portal is where a
                  project is set up, and the app is where the watching actually happens — after
                  reading the pulse of the network, going to look at it is the likely next move.
                  Rightmost, because that is where the committing button sits in every dialog and
                  toolbar in this console. */}
              {appAccess && (
                <button
                  className="portal-btn-primary"
                  onClick={() => router.push("/")}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                  <ExitIcon /> {t.goToApp}
                </button>
              )}
              {showAccessRequests && (
                <button onClick={() => onTabChange("users")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
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

          {/*
            The banner the reference opens with: a mark, a bold label, the sentence, then the way
            in and the way out.

            It was a one-line strip of chips, which was compact and read as a filter row — a row of
            small buttons says "narrow this list", not "something is wrong". A tinted band with a
            sentence in it says the second thing, and the sentence is the same content the chips
            carried, joined: every clause is a figure that already exists on this page.

            primary-100 with a primary-200 edge. It was amber, which reads as a warning — but this
            band is a to-do list, not an alarm: the things on it are errands (a camera to reconnect,
            an invitation to chase), and the one genuinely bad state, an offline count, already has
            red on the card below. The product's own colour marks it as the page speaking rather
            than the system alerting. Dismiss hides it for this visit only — nothing is stored, and
            a reload brings it back, because none of these errands go away by being closed.
          */}
          {attentionItems.length > 0 && !attentionDismissed && (
            <div style={{
              display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
              backgroundColor: "var(--primary-100)", border: "1px solid var(--primary-200)",
              borderRadius: "12px", padding: "14px 16px", marginBottom: CARD_GAP,
            }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                // White, not primary-200. primary-200 is a mid-lilac and the icon on it is a
                // strong violet — two neighbouring purples with little between them, which turned
                // the square into a smudge. On the band's primary-100 the white square is the one
                // clean edge in it and the mark reads at full strength.
                backgroundColor: "white", color: "var(--primary-400)",
              }}>
                <Zap size={14} strokeWidth={2.4} />
              </span>
              {/* primary-400, with the errands themselves left in gray-900. The label names the
                  band and the mark beside it is already that colour; the things you can click are
                  what should read as text you act on. */}
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary-400)", flexShrink: 0 }}>{t.attentionTitle}</p>
              {/*
                Each errand is its own link, and there is no "Review issues" button any more.

                That button went to attentionItems[0] — the worst one — so with two errands on the
                strip, clicking it took you to the cameras while the invitation sat there unread,
                and nothing on screen said it would. An offline camera and an unaccepted invitation
                are two different tabs; one control cannot honestly stand for both. The sentence
                already names them, so the names are the links.
              */}
              <p style={{ fontSize: "13px", color: "var(--gray-600)", minWidth: 0 }}>
                {attentionItems.map((item, i) => (
                  <span key={item.key}>
                    {i > 0 && <span style={{ color: "var(--gray-400)" }}>{" · "}</span>}
                    <button
                      onClick={() => onTabChange(item.tab)}
                      style={{
                        border: "none", background: "none", padding: 0, cursor: "pointer",
                        font: "inherit", color: "var(--gray-900)", fontWeight: 600,
                        textDecoration: "underline", textUnderlineOffset: "3px",
                        textDecorationColor: "var(--gray-300)",
                      }}
                    >
                      {item.text}
                    </button>
                  </span>
                ))}
              </p>
              <span style={{ flex: 1 }} />
              <button
                className="portal-icon-btn"
                onClick={() => setAttentionDismissed(true)}
                title={t.dismissBanner}
                style={{ display: "flex", border: "none", background: "none", padding: "4px", cursor: "pointer", color: "var(--gray-500)", flexShrink: 0 }}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          )}

          {/* Metric cards — camera connectivity / license usage / VIP DB / accounts & permissions,
              each grounded in real store data (no fabricated failure-reason breakdowns the data
              model doesn't have).

              The icon badges are tinted, one hue per card, as in the reference. They were grey for
              a while and half the reason still holds — the same hues mean something in the bars
              below — but the badge is the card's own mark rather than a reading of its figure, and
              four grey squares made the row look like one card repeated. What the figure is doing
              is said by the chip beside it, in a word. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: CARD_GAP, marginBottom: CARD_GAP }}>
            {/* All four squares are grey at rest — the icon says which card this is, not how it is
                doing, and four coloured squares in a row made the colour mark nothing. The one
                exception is here: an offline camera turns this square red along with the chip
                beside it and the slice in its bar, so the row has exactly one thing that can go
                coloured and it is the one thing that can go wrong. */}
            <MetricCard
              label={t.cameraConnectivity} icon={VideoIcon}
              iconBg={offlineCount > 0 ? "var(--danger-100)" : "var(--gray-100)"}
              iconColor={offlineCount > 0 ? "var(--danger-400)" : "var(--gray-700)"}
              chip={offlineCount === 0
                ? <StateChip text={t.chipHealthy} color="var(--gray-500)" />
                : <StateChip text={t.chipAttention(offlineCount)} color="var(--danger-400)" />}
              onClick={() => onTabChange("cameras")}
            >
              {/* The figure on its own line, the bar full width at the foot of the card.
                  It was a fixed 88px bar beside the number, which fitted two readings on one row
                  and made the bar too short to show anything but "roughly half". Full width it is
                  a measure again, and pushed to the bottom (marginTop auto on the block below) it
                  lines up across all four cards whatever height the row settles at. */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "4px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {/* The figure is gray-900, the words after it gray-400 — one step lighter than
                      the rest of the card's small print. "51 / 59 connected" is one number with a
                      unit attached, and at the same weight as a caption the unit competed with it. */}
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{onlineCount}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.connectedSuffix(projectCameras.length)}</span>
                </span>
              </div>
              {/* Directly under the figure, not pushed to the card's foot. It used to carry
                  marginTop:auto, which parked the bar on the bottom padding and left a hand's
                  width of nothing between the number and the bar that measures it — two halves of
                  one statement with a gap in the middle. The cards still line up: both bars have
                  the same rows above them, and the grid stretches the cards themselves. */}
              <div style={{ paddingTop: "2px" }}>
                <div style={{ width: "100%", height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                  {/* primary-300 for the healthy share, danger only for the part that is not.
                      It was success-400 against danger-400 — two saturated hues meeting in the
                      middle of a white card, which read as a chart from another product — then
                      gray-900 (the bar became the heaviest thing on the card), then gray-500. The
                      light primary step is the product's own colour at a strength a quantity can
                      carry, and two 8px bars are well inside the tenth of a screen the palette
                      guidance allows purple. Only the red slice is a state, and it stays the one
                      thing that catches. */}
                  <div style={{ height: "100%", width: `${projectCameras.length ? (onlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--primary-300)" }} />
                  <div style={{ height: "100%", width: `${projectCameras.length ? (offlineCount / projectCameras.length) * 100 : 0}%`, backgroundColor: "var(--danger-400)" }} />
                </div>
                {/* Left half only. The right said "8 offline", which the chip above it, the red
                    slice in this very bar and the icon square all already say — the same figure
                    four times inside one card. */}
                <BarStats left={t.statOnlineShare(onlineShare)} right="" />
              </div>
              {/* The online/offline legend that used to sit under a rule here is gone: "51 / 59
                  connected" already gives both numbers, the bar's red segment shows the share, and
                  a non-zero offline count is a line in the "things to do" strip above. */}
            </MetricCard>

            <MetricCard
              label={t.licenseSubscription} icon={LicenseDocIcon} iconBg="var(--gray-100)" iconColor="var(--gray-700)"
              /* No chip. The plan was here as ENTERPRISE beside the icon and it is now the left
                 half of the bar's caption, which is where it belongs: the caption is read with the
                 figure it qualifies, and the same word twice on one card is once too many. This
                 card simply has an icon in that row, like the VIP one when nothing new arrived. */
              onClick={() => onTabChange("license")}
            >
              {/* The figure on its own line, the bar full width at the foot of the card.
                  It was a fixed 88px bar beside the number, which fitted two readings on one row
                  and made the bar too short to show anything but "roughly half". Full width it is
                  a measure again, and pushed to the bottom (marginTop auto on the block below) it
                  lines up across all four cards whatever height the row settles at. */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: "4px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>{projectCameras.length}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.channelsUsedSuffix(channelLimit ?? "∞")}</span>
                </span>
              </div>
              <div style={{ paddingTop: "2px" }}>
                <div style={{ width: "100%", height: "8px", backgroundColor: "var(--gray-100)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${channelLimit ? Math.min(100, (projectCameras.length / channelLimit) * 100) : 0}%`, backgroundColor: overChannelLimit ? "var(--danger-400)" : "var(--primary-300)" }} />
                </div>
                {/* The plan on the left, what is left on the right — and no percentage between
                    them. The figure above already reads "59 / 100 channels used", and on a
                    hundred-channel licence the share is the same digits again; the bar shows the
                    proportion without naming it. Capitalised rather than uppercased: the chip at
                    the top of the card shouts the plan, a caption says it. */}
                {channelLimit ? (
                  <BarStats
                    left={project.licensePlan
                      ? `${project.licensePlan.charAt(0).toUpperCase()}${project.licensePlan.slice(1)}`
                      : ""}
                    right={t.statAvailable(Math.max(0, channelLimit - projectCameras.length))}
                  />
                ) : null}
              </div>
              {/* Plan name, "Manage" and the expiry chip are gone from here. This card answers one
                  question — how much of the licence is in use — and the rest of the contract is a
                  whole tab away, one click down the rail. An expiry that is actually close raises a
                  line in the "things to do" strip instead of wearing a chip on a card all year. */}
            </MetricCard>

            <MetricCard
              /* Grey, not primary. Four purple squares in a row made the colour meaningless — it
                 marked nothing, since everything had it. The two cards that carry a bar keep the
                 product's colour because the bar beside them is that colour too; these two are
                 plain counts, so they are plain. Their chips follow the icon, as every chip on
                 this row does. */
              label={t.vipTargetDb} icon={UsersGroupIcon} iconBg="var(--gray-100)" iconColor="var(--gray-700)"
              chip={newVipsThisMonth > 0 ? <StateChip text={t.chipNewThisMonth(newVipsThisMonth)} color="var(--gray-500)" /> : undefined}
              onClick={() => onTabChange("vip")}
            >
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
                  {/* A suffix, not a second figure — the card states the size of the registry and
                      the tab behind it breaks priorities down. */}
                  <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.recordsSuffix}</span>
                  {todayVipCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 600, color: "var(--success-400)" }}>
                      <ArrowUpIcon /> {t.todayBadge(todayVipCount)}
                    </span>
                  )}
                </span>
              </div>
            </MetricCard>

            <MetricCard
              label={t.portalAccounts} icon={SettingsIcon} iconBg="var(--gray-100)" iconColor="var(--gray-700)"
              chip={<StateChip text={t.chipAccessSplit(portalUserCount, appUserCount)} color="var(--gray-500)" />}
              onClick={() => onTabChange("users")}
            >
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
                  <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.accountsSuffix}</span>
                </span>
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
          {/* Two columns, not three.
              The panels used to take one grid column each so their edges landed on the metric
              cards' boundaries above. That alignment cost the camera table half the width and left
              the two narrow panels side by side, each too thin for the sentences in it. The
              reference does not align them either: the list you read is wide, and the two things
              you glance at stack in a column beside it. 1.75fr against 1fr, which is the ratio
              that gives the table its five columns and still leaves a readable panel. */}
          <div style={{ display: "grid", gridTemplateColumns: "1.75fr 1fr", gap: CARD_GAP, alignItems: "stretch", maxHeight: OVERVIEW_PANEL_MAX_HEIGHT, marginBottom: CARD_GAP }}>
            <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP, minWidth: 0, minHeight: 0 }}>
              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", flexShrink: 0 }}>
                  {/* No "View inventory" action up here. The footer of this same panel is already
                      a full-width row reading "View all 59 cameras · 59 total →", and both went to
                      the same tab — one door per panel, and this panel's door is at its foot like
                      the other two in the row. */}
                  <SectionHead
                    title={t.cameraStatusTitle}
                    subtitle={t.cameraStatusSubtitle}
                  />
                </div>
                {/* The cut on the left, what the cut is made of on the right. Two readings of the
                    same fleet: the segmented control changes the list, the legend just states the
                    split — so the legend is text, not buttons. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "0 20px 14px", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--gray-50)", padding: "2px", borderRadius: "8px" }}>
                    {(["all", "offline"] as const).map(f => (
                      <button key={f} onClick={() => setCameraStatusFilter(f)}
                        style={{
                          padding: "6px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                          backgroundColor: cameraStatusFilter === f ? "white" : "transparent",
                          boxShadow: cameraStatusFilter === f ? PANEL_SHADOW : "none",
                          color: cameraStatusFilter === f ? "var(--gray-900)" : "var(--gray-500)",
                        }}>
                        {f === "all" ? t.filterAll(projectCameras.length) : t.filterOffline(offlineCount)}
                      </button>
                    ))}
                  </div>
                  {/* No legend on the right. It read "51 online · 8 offline" beside tabs already
                      labelled "All (59)" and "Offline (8)" — the same two numbers, twice, 300px
                      apart. The tabs win: they are the control, and a count on a control tells you
                      what you get by pressing it. */}
                </div>
                {visibleCameraRows.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--gray-400)", padding: "24px", textAlign: "center" }}>
                    {cameraStatusFilter === "offline" ? t.noOfflineCameras : t.noCamerasYet}
                  </p>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 1.5fr 0.9fr 0.8fr 56px", padding: "8px 20px", backgroundColor: "var(--gray-50)", borderTop: BORDER, borderBottom: BORDER, gap: "8px", flexShrink: 0 }}>
                      {/* The arrow on Last signal says which way the rows run. The panel has one
                          order and no way to change it, so this is a statement rather than a
                          control — but a list ordered by a column nobody told you about is a list
                          whose order looks arbitrary. */}
                      {[t.colCamera, t.colZone, t.colStreamUrl, t.colLastSignal, t.colStatus, ""].map(h => (
                        <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>
                          {h.toUpperCase()}{h === t.colLastSignal ? " ↑" : ""}
                        </span>
                      ))}
                    </div>
                    {/* Only the rows scroll. The column headings above and the "view all" below are
                        the two things you need while scrolling, so they stay put.

                        Cut at eleven rows — the eight offline cameras plus Novena, Geylang NC1 and
                        Orchard MRT, which is where this was asked to stop. 476px is that count in
                        pixels: a row is 10px of padding either side of a 22px status chip, and ten
                        1px rules between the eleven. The panel's own viewport-relative cap still
                        applies on top of this, so a short window cuts the list earlier rather than
                        running it off the screen. */}
                    <div style={{ flex: 1, minHeight: 0, maxHeight: "476px", overflowY: "auto" }}>
                    {visibleCameraRows.map((c, i) => {
                      const online = c.status === "online";
                      return (
                        <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 1.5fr 0.9fr 0.8fr 56px", padding: "10px 20px", alignItems: "center", gap: "8px", borderTop: i > 0 ? BORDER : "none" }}>
                          {/* No dot before the name. The row already ends in a Online / Offline
                              chip, and a coloured dot at the other end of the same row said the
                              same thing a second time — with eight offline rows on top, the list
                              read as a column of red bullets before it read as a list of cameras. */}
                          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.name}</p>
                          <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{c.zone}</span>
                          <span style={{ fontSize: "12px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.rtspUrl}</span>
                          {/* Only once the clock is known — before mount there is no "ago" to
                              compute, and a guessed one would be corrected a frame later. */}
                          <span style={{ fontSize: "12px", color: "var(--gray-500)", whiteSpace: "nowrap" }}>
                            {nowMs !== null && c.lastSeenAt
                              ? `${formatElapsed(nowMs - new Date(c.lastSeenAt).getTime())}${t.agoSuffix}`
                              : "—"}
                          </span>
                          {/*
                            A dot and a word, no pill.

                            Filled pills are for a column whose values vary — Rox's account table
                            is the closest reference here and it does exactly this: a small dot
                            carries the state and the label stays plain text. Eleven rows of the
                            same two words made pills into texture rather than information.

                            The greys were also the wrong way round. Offline is the exception and
                            it was the fainter of the two, so the rows worth reading were the
                            hardest to read. Now the ordinary case is quiet (grey dot, grey word)
                            and the exception is dark, with the only colour in the column a 5px
                            red dot — enough to find down a scrolling list, too small to shout.
                          */}
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: online ? "var(--gray-500)" : "var(--gray-900)" }}>
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0, backgroundColor: online ? "var(--gray-300)" : "var(--danger-400)" }} />
                            {online ? t.online : t.offline}
                          </span>
                          {/* gray-500 at 600, not gray-900 at 700. It repeats on every row, and
                              at full strength eleven copies of the same word were the darkest
                              column in the panel — heavier than the camera names beside them. */}
                          <button className="portal-link" onClick={() => onTabChange("cameras")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", fontFamily: "inherit" }}>{t.view}</button>
                        </div>
                      );
                    })}
                    </div>
                    {/* Always here, not only when the list is truncated: it is the panel's way out
                        to the tab, and the count on the right says how much is behind it. */}
                    <button onClick={() => onTabChange("cameras")}
                      className="portal-attention-row"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", border: "none", borderTop: BORDER, background: "none", padding: "12px 20px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.viewAllCameras(filteredCameraRows.length)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--gray-400)" }}>
                        {t.totalCameras(projectCameras.length)} <ArrowUpRight size={12} strokeWidth={2.8} />
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* The right column: who was added, then what changed. Both are read at a glance and
                neither needs the width the table beside them does. */}
            <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP, minWidth: 0, minHeight: 0 }}>
              <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ marginBottom: "14px", flexShrink: 0 }}>
                  <SectionHead title={t.recentVipsTitle} subtitle={t.vipsSubtitle} />
                </div>
                {recentVips.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noVipsYet}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {/* The whole row opens the registry, and the chevron says so. It was a card
                        with no target on it at all — a face, a name and a date that looked
                        clickable and was not. */}
                    {recentVips.map(p => (
                      <button key={p.id} onClick={() => onTabChange("vip")}
                        className="portal-attention-row"
                        style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", border: BORDER, borderRadius: "12px", padding: "10px", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                        <img src={p.photoUrl} alt="" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                          {/* Date and hour, where the record has an hour. Seeded rows written as
                              a bare day have none to show, and inventing 00:00 for them would be
                              printing a time nobody recorded. Formatted through Asia/Singapore
                              rather than the machine's own zone, so the server's first paint and
                              the browser's agree. */}
                          <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.registeredOn(registeredStamp(p.registeredAt))}</p>
                        </div>
                        <ChevronRight size={14} strokeWidth={2.4} color="var(--gray-400)" />
                      </button>
                    ))}
                  </div>
                )}
                {/* The panel's own way to add one, at its foot — the reference puts it there and it
                    is the right place: the list above answers "who is in", this answers "and one
                    more". */}
                <button onClick={() => onTabChange("vip")}
                  className="portal-attention-row"
                  /* The rule runs to the card's edges, like the camera panel's footer beside it.
                     This panel carries its 20px padding on the card itself, so a footer inside it
                     drew a rule 20px short at each end while the panel next to it drew one edge to
                     edge — two cards in one row disagreeing about where a card ends. Negative
                     margins on the sides and the bottom put the button on the card's own width and
                     down to its bottom edge, so a hover fills the whole footer rather than a band
                     floating above 20px of white. */
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "calc(100% + 40px)", border: "none", borderTop: BORDER, background: "none", padding: "12px 20px", margin: "12px -20px -20px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.registerVipLink}</span>
                  <Plus size={14} strokeWidth={2.4} color="var(--gray-500)" />
                </button>
              </div>

              {/* The Access Requests card is hidden along with the flow it reports on — with
                  accessRequest off nothing can ever land there, and a permanently empty "Access
                  Requests · none pending" describes a door this deployment does not have. Still
                  shown while real requests exist, so turning the flag off later cannot strand
                  someone who already asked. */}
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
                <div style={{ marginBottom: "14px", flexShrink: 0 }}>
                  {/* The way out is at the foot of this panel now, like the two beside it. It was
                      the only one with its link up here, which made the three panels' heads look
                      like three different components. */}
                  <SectionHead
                    title={t.recentAdminActivity}
                    subtitle={t.activitySubtitle}
                  />
                </div>
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
                          {/* marginTop 5: the dot is 8px and the sentence's line box is 18px, so
                              half the difference puts the dot's centre on the line's centre. It
                              was flush with the top of the row, which left it riding a few px
                              above the words it marks. */}
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--gray-300)", marginTop: "5px", flexShrink: 0 }} />
                          {i < recentActivity.length - 1 && <span style={{ width: "1px", flex: 1, backgroundColor: "var(--line)", marginTop: "2px" }} />}
                        </div>
                        <div style={{ paddingBottom: "14px", minWidth: 0 }}>
                          <p style={{ fontSize: "12px", lineHeight: "18px", fontWeight: 600, color: "var(--gray-900)" }}>{a.message}</p>
                          <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>
                            {a.actor}{nowMs !== null ? ` · ${formatElapsed(nowMs - new Date(a.at).getTime())}${t.agoSuffix}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Full-bleed on all three sides it touches. The card carries its own 20px
                    padding, so the button is pulled out by that much left, right AND bottom —
                    with only the sides pulled out, the hover fill stopped at the text and left a
                    white strip of the card's bottom padding under a grey band, which read as the
                    row being misaligned with the card. The card clips (overflow hidden), so the
                    fill takes the bottom corners' radius. */}
                <button onClick={() => onTabChange("users")}
                  className="portal-attention-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "calc(100% + 40px)", border: "none", borderTop: BORDER, background: "none", padding: "12px 20px", margin: "12px -20px -20px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.seeAll}</span>
                  <ArrowUpRight size={13} strokeWidth={2.6} color="var(--gray-500)" />
                </button>
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
