"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTimeAgo, LiveEvent } from "@/lib/mockData";
import { SIGNED_IN_USER, projectsVisibleInApp, useVcaStore, vcaEventsToLiveEvents } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useApiData } from "@/hooks/useApiData";
import { getDashboardStats } from "@/lib/api/dashboard";
import { useLanguage } from "@/lib/i18n";

const BORDER = "1px solid var(--gray-200)";
/** Shared by both forms of the site chip below — the switchable one and the plain label — so the
 *  name reads identically whether or not there is anything to switch to. */
const PROJECT_NAME_STYLE: React.CSSProperties = {
  fontSize: "13px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.26px",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
export type NavTab = "DASHBOARD" | "BEST FRAME" | "DATA" | "REDMAP";

// The ids stay English — they are route keys (?tab=) and a store value, and translating them would
// break every link. Only the labels change. Best Frame and Redmap are feature names rather than
// descriptions, so Korean transliterates them the way the market names any product feature.
export const TABS: { id: NavTab; label: { en: string; ko: string }; icon: string }[] = [
  { id: "DASHBOARD",  label: { en: "DASHBOARD",  ko: "대시보드" },     icon: "/icons/nav-dashboard.svg" },
  { id: "BEST FRAME", label: { en: "BEST FRAME", ko: "베스트 프레임" }, icon: "/icons/nav-bestframe.svg" },
  { id: "DATA",       label: { en: "DATA",       ko: "데이터" },        icon: "/icons/nav-data.svg" },
  { id: "REDMAP",     label: { en: "REDMAP",     ko: "레드맵" },        icon: "/icons/nav-redmap.svg" },
];

// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    goToDashboard: "Go to Dashboard",
    running: (n: number | string) => `${n} running`,
    stopped: (n: number | string) => `${n} stopped`,
    vipDetections: "VIP detections",
    noneInWindow: "No VIP detections in the last hour",
    notifWindow: "last hour",
    showingOf: (shown: number, total: number, window: string) => `Showing ${shown} of ${total} · ${window}`,
    allOf: (total: number, window: string) => `All ${total} · ${window}`,
    settings: "Settings",
    portal: "Portal",
    myPage: "My page",
    sidebar: "Sidebar",
    left: "Left",
    right: "Right",
    logOut: "Log out",
  },
  ko: {
    goToDashboard: "대시보드로 이동",
    running: (n: number | string) => `분석 중 ${n}대`,
    stopped: (n: number | string) => `중지 ${n}대`,
    vipDetections: "VIP 검출",
    noneInWindow: "최근 1시간 동안 VIP 검출이 없습니다",
    notifWindow: "최근 1시간",
    showingOf: (shown: number, total: number, window: string) => `${total}건 중 ${shown}건 표시 · ${window}`,
    allOf: (total: number, window: string) => `전체 ${total}건 · ${window}`,
    settings: "설정",
    portal: "포털",
    myPage: "마이페이지",
    sidebar: "사이드바",
    left: "왼쪽",
    right: "오른쪽",
    logOut: "로그아웃",
  },
} as const;

interface NavbarProps {
  /** If null, none of the 4 tabs is active (e.g. screens outside the tabs, like My Page) */
  activeTab?: NavTab | null;
  onTabChange?: (tab: NavTab) => void;
  onNotificationSelect?: (event: LiveEvent) => void;
  sidebarPosition?: "left" | "right";
  onSidebarPositionChange?: (position: "left" | "right") => void;
  /** Opens the global command palette (also reachable via Cmd/Ctrl+K from anywhere). */
}

export default function Navbar({ activeTab: externalTab, onTabChange, onNotificationSelect, sidebarPosition, onSidebarPositionChange }: NavbarProps) {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  const [internalTab, setInternalTab] = useState<NavTab>("DASHBOARD");
  const activeTab = externalTab === undefined ? internalTab : externalTab;
  const setActiveTab = (tab: NavTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  // Routed through the future-backend stub (`lib/api/dashboard.ts`) instead of importing the mock
  // constant directly, so wiring in the real endpoint later is a one-file change. Falls back to 0/
  // blank for the brief window before the (currently mock-delayed) fetch resolves.
  // `error` matters here even though the mock fetch never actually fails today: without checking
  // it, a real failed request would render "0 Running" / "0 Stopped" indistinguishable from a
  // genuinely-empty fleet — showing "—" instead makes a load failure visibly different from a
  // real zero.
  const { data: dashboardStats, error: dashboardStatsError } = useApiData(() => getDashboardStats(), []);
  // Which site this wall is showing. Only the account's own projects are offered — a team's
  // cameras have no business on another team's screen — so a one-project account sees a plain
  // label with nothing to open.
  const projects = useVcaStore(s => s.projects);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const activeProjectId = useVcaStore(s => s.activeProjectId);
  const setActiveProjectId = useVcaStore(s => s.setActiveProjectId);
  const myProjects = projectsVisibleInApp(portalUsers, projects);
  const activeProject = myProjects.find(p => p.id === activeProjectId) ?? myProjects[0] ?? null;
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const canSwitchProject = myProjects.length > 1;
  useEscapeKey(() => setProjectMenuOpen(false), projectMenuOpen);

  const aiRunning = dashboardStatsError ? "—" : dashboardStats?.aiRunning ?? 0;
  const aiStopped = dashboardStatsError ? "—" : dashboardStats?.aiStopped ?? 0;
  const location = dashboardStats?.location ?? "Singapore";

  const [sgNow, setSgNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setSgNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  const sgDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" });
  const sgTimeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const currentDate = sgNow ? sgDateFmt.format(sgNow) : dashboardStats?.currentDate ?? "";
  const currentTime = sgNow ? sgTimeFmt.format(sgNow) : dashboardStats?.currentTime ?? "";

  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const events = useVcaStore(s => s.events);
  const lastReadNotifAt = useVcaStore(s => s.lastReadNotifAt);
  const markNotificationsRead = useVcaStore(s => s.markNotificationsRead);
  // Scoped to the last hour, and the footer says so. The store keeps events by COUNT (500), not by
  // age, so an unscoped total was really "however long this tab has been open" — it starts at the
  // 13 seeded hits and climbs by one every 15-30s from the simulator, resetting on reload. A
  // denominator nobody can interpret is worse than none. Riding sgNow, the header clock that
  // already ticks every second, so the window moves with it rather than freezing at mount.
  const NOTIF_WINDOW_LABEL = t.notifWindow;
  // null until the clock's first tick — no Date.now() fallback, since reading the clock during
  // render is exactly the impurity sgNow exists to avoid. Unfiltered for that one frame.
  const notifWindowStart = sgNow ? sgNow.getTime() - 3600_000 : null;
  const vipEvents = events.filter(e => e.personType === "VIP"
    && (notifWindowStart === null || new Date(e.timestamp).getTime() >= notifWindowStart));
  // 8 loaded against a 320px scroll box, so the sixth row sits half-cut and the list reads as
  // having more below it — the same cue Dovetail and Air use rather than a scrollbar nobody looks
  // for. The count is a constant because the footer below states it: a hardcoded "8" in the copy
  // and a different slice here is the kind of pair that drifts.
  const NOTIF_LIMIT = 8;
  const notifications = vcaEventsToLiveEvents(vipEvents)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, NOTIF_LIMIT);
  const unreadCount = vipEvents.filter(e => e.timestamp > lastReadNotifAt).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEscapeKey(() => { setNotifOpen(false); setSettingsOpen(false); }, notifOpen || settingsOpen);

  return (
    <>
    <style>{`
      @keyframes live-ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}
      @keyframes run-icon{0%,100%{transform:translateY(-1px) translateX(0) rotate(0deg)}30%{transform:translateY(-3px) translateX(1px) rotate(-4deg)}60%{transform:translateY(0px) translateX(-1px) rotate(2deg)}}
      @keyframes stop-flicker{0%,100%{opacity:1}15%{opacity:.15}20%{opacity:.85}35%{opacity:.1}40%{opacity:.7}55%{opacity:1}75%{opacity:.2}80%{opacity:.9}}
      @keyframes dropdown-in{from{opacity:0;transform:scale(0.96) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
      /* Hover lands on the label and icon, not on a background. A tinted block filling the whole
         62px height of the bar was a bigger object than anything else the header highlights, and it
         had no counterpart anywhere in the app — nothing else paints a full-height band on hover.
         Colouring what you are actually pointing at says the same thing at the size of the thing.
         primary-300, not 400: 400 is the active tab's colour, and hover must not be mistakable
         for "you are here". The active tab is excluded so pointing at it can't lighten it. 200 was
         tried and is too faint — around 1.7:1 against white, so the label dimmed while pointed at
         and read as disabled rather than as reachable.

         Every colour here lives in CSS rather than the element's style attribute. Inline
         declarations beat any stylesheet selector short of !important, which is exactly why the
         earlier background:"none" on the button silently cancelled its own :hover rule. */
      .navbar-tab{background-color:transparent}
      .navbar-tab-icon{background-color:var(--gray-800);transition:background-color .15s}
      .navbar-tab-label{color:var(--gray-800);transition:color .15s}
      .navbar-tab[data-active="true"] .navbar-tab-icon{background-color:var(--primary-400)}
      .navbar-tab[data-active="true"] .navbar-tab-label{color:var(--primary-400)}
      .navbar-tab:not([data-active="true"]):hover .navbar-tab-icon{background-color:var(--primary-300)}
      .navbar-tab:not([data-active="true"]):hover .navbar-tab-label{color:var(--primary-300)}
      .navbar-icon-btn{transition:background-color .15s;border-radius:8px;position:relative;background-color:transparent}
      .navbar-icon-btn:hover{background-color:var(--gray-100)}
      .navbar-dropdown-item{position:relative;background-color:transparent;color:var(--gray-800);transition:background-color .12s, color .12s}
      .navbar-dropdown-item:hover{background-color:var(--primary-100);color:var(--primary-400)}
      .navbar-dropdown-item:hover::before{
        content:""; position:absolute; left:-4px; top:0;
        width:5px; height:100%;
        border-radius:4px; background-color:var(--primary-400);
      }
      .navbar-dropdown-item--danger:hover{background-color:var(--danger-100)}
      .navbar-dropdown-item--danger:hover::before{background-color:var(--danger-400)}
      .navbar-logo-btn{transition:opacity .15s}
      @media (max-width: 1400px){ .navbar-ai-status{display:none} }
      .navbar-logo-btn:hover{opacity:.8}
    `}</style>
    <nav style={{
      height: "62px", backgroundColor: "white", borderBottom: BORDER,
      display: "flex", alignItems: "center", padding: "0 24px",
      flexShrink: 0, zIndex: 5000, position: "relative",
    }}>
      {/* ── Left: logo + AI status ── */}
      {/* Hard ceiling rather than hope: the tab row is absolutely centred, so a left group that
          grows past half-the-window-minus-half-the-tabs would slide under it. 236px is half the
          tab row plus a margin; the project name truncates inside whatever is left. */}
      <div className="navbar-left" style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, maxWidth: "calc(50% - 236px)", overflow: "hidden" }}>
        {/* Logo — click returns to the Dashboard, same convention as any app's home button */}
        <button
          className="navbar-logo-btn"
          onClick={() => setActiveTab("DASHBOARD")}
          aria-label={t.goToDashboard}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "none", border: "none", padding: 0, cursor: "pointer",
          }}
        >
          <svg width="173" height="26" viewBox="0 0 173 26" fill="none" style={{ flexShrink: 0 }}>
            <rect width="44" height="26" rx="8" fill="var(--gray-900)"/>
            <path d="M18.678 8.2L16.69 18H14.058L12.07 8.2H14.086L14.856 12.736L15.332 15.676H15.416L15.892 12.736L16.662 8.2H18.678ZM22.0052 16.376H24.4692V18H20.9132C20.2972 17.4213 19.8305 16.6887 19.5132 15.802C19.1959 14.9153 19.0372 14.0053 19.0372 13.072C19.0372 12.1293 19.2145 11.224 19.5692 10.356C19.9239 9.488 20.4512 8.76933 21.1512 8.2H24.4692V9.88H22.0052C21.7532 10.1693 21.5339 10.636 21.3472 11.28C21.1699 11.924 21.0812 12.54 21.0812 13.128C21.0812 13.716 21.1699 14.332 21.3472 14.976C21.5339 15.62 21.7532 16.0867 22.0052 16.376ZM29.6682 18L29.3742 16.446H27.1622L26.8682 18H24.9642L26.8542 8.2H29.7522L31.5442 18H29.6682ZM28.2402 10.02L27.6942 13.282L27.3862 14.948H29.1362L28.8142 13.282L28.2682 10.02H28.2402Z" fill="white"/>
            <path d="M54.978 17.912H56.49C56.754 17.624 56.94 17.336 57.048 17.048C57.168 16.748 57.228 16.31 57.228 15.734V7.4H59.694V14.834C59.694 15.446 59.676 15.926 59.64 16.274C59.616 16.61 59.544 17.024 59.424 17.516C59.22 18.392 58.656 19.22 57.732 20H53.736C52.812 19.244 52.248 18.416 52.044 17.516C51.864 16.784 51.774 15.89 51.774 14.834V7.4H54.24V15.734C54.24 16.31 54.294 16.748 54.402 17.048C54.522 17.336 54.714 17.624 54.978 17.912ZM67.3146 20L63.9486 13.034L63.8586 13.07L63.9666 15.194V20H61.6986V7.4H63.5166L66.8286 14.636L66.9186 14.6L66.7206 12.386V7.4H68.9886V20H67.3146ZM71.0762 20V7.4H73.5422V20H71.0762ZM83.3594 7.4L80.8034 20H77.4194L74.8634 7.4H77.4554L78.4454 13.232L79.0574 17.012H79.1654L79.7774 13.232L80.7674 7.4H83.3594ZM85.6572 7.4H89.9772V9.56H86.5212L86.4672 9.668L89.3472 14.924C89.9352 15.98 90.2292 16.784 90.2292 17.336C90.2292 18.548 89.8272 19.436 89.0232 20H84.2532V17.912H87.9792L88.0332 17.804L84.7932 11.99C84.3252 11.15 84.0912 10.466 84.0912 9.938C84.0912 8.69 84.6132 7.844 85.6572 7.4ZM96.2385 7.4H100.559V9.56H97.1025L97.0485 9.668L99.9285 14.924C100.517 15.98 100.811 16.784 100.811 17.336C100.811 18.548 100.409 19.436 99.6045 20H94.8345V17.912H98.5605L98.6145 17.804L95.3745 11.99C94.9065 11.15 94.6725 10.466 94.6725 9.938C94.6725 8.69 95.1945 7.844 96.2385 7.4ZM107.015 14.24H106.943H107.015L107.969 10.298L108.743 7.4H110.993L111.803 20H109.445L109.103 13.124H109.013L107.717 18.2H106.241L104.945 13.124H104.855L104.513 20H102.155L102.965 7.4H105.215L105.989 10.298L106.943 14.24H107.015ZM118.977 20L118.599 18.002H115.755L115.377 20H112.929L115.359 7.4H119.085L121.389 20H118.977ZM117.141 9.74L116.439 13.934L116.043 16.076H118.293L117.879 13.934L117.177 9.74H117.141ZM122.797 7.4H127.585C128.341 7.652 128.983 8.12 129.511 8.804C130.051 9.476 130.321 10.304 130.321 11.288C130.321 12.896 129.685 14.078 128.413 14.834L130.231 20H127.711L126.181 15.41H125.227V20H122.797V7.4ZM125.227 9.56V13.394H126.775C126.979 13.346 127.201 13.142 127.441 12.782C127.693 12.41 127.819 11.978 127.819 11.486C127.819 10.994 127.711 10.562 127.495 10.19C127.291 9.818 127.087 9.608 126.883 9.56H125.227ZM133.84 9.56H131.122V7.4H139.006V9.56H136.288V20H133.84V9.56ZM147.145 17.912H150.313V20H145.741C144.949 19.256 144.349 18.314 143.941 17.174C143.533 16.034 143.329 14.864 143.329 13.664C143.329 12.452 143.557 11.288 144.013 10.172C144.469 9.056 145.147 8.132 146.047 7.4H150.313V9.56H147.145C146.821 9.932 146.539 10.532 146.299 11.36C146.071 12.188 145.957 12.98 145.957 13.736C145.957 14.492 146.071 15.284 146.299 16.112C146.539 16.94 146.821 17.54 147.145 17.912ZM151.993 20V7.4H154.459V20H151.993ZM158.588 9.56H155.87V7.4H163.754V9.56H161.036V20H158.588V9.56ZM169.587 20H166.959V15.806L164.295 7.4H166.743L167.859 11.234L168.237 13.448H168.309L168.687 11.234L169.803 7.4H172.251L169.587 15.806V20Z" fill="var(--gray-900)"/>
          </svg>
        </button>

        {/* Which site — read before the numbers beside it, which are this site's cameras. Long
            names are cut rather than wrapped: the header is one line and the full name is a
            hover away. */}
        {activeProject && (
          <div style={{ position: "relative", flexShrink: 1, minWidth: 0 }}>
            {/* One project is the common case, and then this is a label, not a control: no
                chevron, no button element, no hover cursor. A caret over a menu holding the one
                thing already on screen promises a choice that does not exist. */}
            {canSwitchProject ? (
              <button
                onClick={() => setProjectMenuOpen(o => !o)}
                title={activeProject.name}
                aria-haspopup="menu"
                aria-expanded={projectMenuOpen}
                style={{
                  display: "flex", alignItems: "center", gap: "6px", maxWidth: "260px",
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                }}
              >
                <span style={PROJECT_NAME_STYLE}>{activeProject.name}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <span title={activeProject.name} style={{ display: "flex", maxWidth: "260px" }}>
                <span style={PROJECT_NAME_STYLE}>{activeProject.name}</span>
              </span>
            )}

            {projectMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "240px",
                backgroundColor: "white", border: BORDER, borderRadius: "12px",
                boxShadow: "0 12px 32px rgba(14,22,42,0.14)", padding: "6px", zIndex: 6000,
              }}>
                {myProjects.map(p => (
                  <button
                    key={p.id}
                    className="navbar-dropdown-item"
                    onClick={() => { setActiveProjectId(p.id); setProjectMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
                      padding: "9px 10px", border: "none", borderRadius: "8px", cursor: "pointer",
                      fontSize: "13px", fontWeight: p.id === activeProject.id ? 800 : 600,
                    }}
                  >
                    <span style={{ display: "flex", width: "12px", flexShrink: 0 }}>
                      {p.id === activeProject.id && (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI status — folded away under 1400px so the site name keeps its room. The same two
            numbers are on the Dashboard, which is where someone goes when they want to act on
            them; up here they are a glance, and a glance is what gets sacrificed first. */}
        <div className="navbar-ai-status" style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Running icon */}
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0, animation:"run-icon 1.8s ease-in-out infinite" }}>
            <path d="M13.9583 10H16.985C17.127 10.0001 17.2666 10.0364 17.3906 10.1056C17.5146 10.1748 17.6189 10.2745 17.6935 10.3953C17.7681 10.5161 17.8107 10.654 17.8171 10.7958C17.8234 10.9377 17.7935 11.0788 17.73 11.2058L16.035 14.5967C15.9707 14.7252 15.8743 14.8348 15.7552 14.9151C15.636 14.9953 15.4981 15.0434 15.3549 15.0546C15.2117 15.0659 15.068 15.0399 14.9377 14.9792C14.8075 14.9185 14.6952 14.8252 14.6117 14.7083L12.8417 12.2333" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.255 7.54373C14.4525 7.6426 14.6027 7.81584 14.6726 8.02539C14.7424 8.23493 14.7262 8.46363 14.6275 8.66123L12.0392 13.8371C11.9902 13.935 11.9225 14.0223 11.8398 14.094C11.7571 14.1657 11.661 14.2204 11.5572 14.255C11.4533 14.2896 11.3437 14.3034 11.2345 14.2956C11.1253 14.2878 11.0187 14.2586 10.9209 14.2096L3.00836 10.2496C2.43364 9.96007 1.99699 9.45471 1.79396 8.84407C1.59093 8.23342 1.63806 7.56722 1.92503 6.99123L3.07503 4.66623C3.21836 4.38058 3.41656 4.12597 3.65831 3.91693C3.90006 3.70788 4.18061 3.54851 4.48396 3.44791C4.78731 3.34731 5.1075 3.30746 5.42625 3.33062C5.74501 3.35378 6.05608 3.4395 6.34169 3.5829L14.255 7.54373Z" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1.66663 15.8333H4.79996C5.11057 15.8355 5.4156 15.7508 5.68064 15.5888C5.94568 15.4269 6.16019 15.1941 6.29996 14.9167L7.49996 12.5" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1.66675 17.4993V14.166" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.83337 7.5H5.84067" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* Number only: the icon beside it already says which, and the words were costing the
              header the width the project name now needs. The word survives as a tooltip. */}
          <span title={t.running(aiRunning)} style={{ fontWeight: 800, fontSize: "13px", color: "var(--gray-800)", letterSpacing: "-0.26px", lineHeight: "16px" }}>
            {aiRunning}
          </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Stopped icon */}
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0, animation:"stop-flicker 3s ease-in-out infinite" }}>
            <g clipPath="url(#clip0_253_6684)">
              <path d="M5.83337 15.0007V10.0007C5.83337 8.89558 6.27236 7.83577 7.05376 7.05437C7.83516 6.27297 8.89497 5.83398 10 5.83398C11.1051 5.83398 12.1649 6.27297 12.9463 7.05437C13.7277 7.83577 14.1667 8.89558 14.1667 10.0007V15.0007" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.16669 17.5C4.16669 17.721 4.25448 17.933 4.41076 18.0893C4.56705 18.2455 4.77901 18.3333 5.00002 18.3333H15C15.221 18.3333 15.433 18.2455 15.5893 18.0893C15.7456 17.933 15.8334 17.721 15.8334 17.5V16.6667C15.8334 16.2246 15.6578 15.8007 15.3452 15.4882C15.0326 15.1756 14.6087 15 14.1667 15H5.83335C5.39133 15 4.9674 15.1756 4.65484 15.4882C4.34228 15.8007 4.16669 16.2246 4.16669 16.6667V17.5Z" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17.5 10H18.3333" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.4167 3.75L15 4.16667" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.66669 10H2.50002" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 1.66602V2.49935" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.10748 4.10742L4.69665 4.69659" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 10V15" stroke="var(--danger-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <defs>
              <clipPath id="clip0_253_6684">
                <rect width="20" height="20" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          <span title={t.stopped(aiStopped)} style={{ fontWeight: 800, fontSize: "13px", color: "var(--danger-400)", letterSpacing: "-0.26px", lineHeight: "16px" }}>
            {aiStopped}
          </span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Center: tabs (absolute center) ── */}
      <div style={{
        position: "absolute", left: "50%", top: 0,
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", height: "62px",
      }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="navbar-tab"
              data-active={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "62px", padding: "0 20px", gap: "8px",
                position: "relative", cursor: "pointer",
                border: "none",
              }}
            >
              <div className="navbar-tab-icon" style={{
                width: "18px", height: "18px", flexShrink: 0,
                maskImage: `url(${tab.icon})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskImage: `url(${tab.icon})`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
              } as React.CSSProperties} />
              <span className="navbar-tab-label" style={{
                fontSize: "13px", fontWeight: 700,
                letterSpacing: "-0.26px", whiteSpace: "nowrap",
              }}>{tab.label[lang]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Right: location + date/time + icons ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
        {/* Location */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink:0 }}>
            <path d="M9.45075 16.3492C10.8457 15.1447 15 11.2448 15 7.5C15 5.9087 14.3679 4.38258 13.2426 3.25736C12.1174 2.13214 10.5913 1.5 9 1.5C7.4087 1.5 5.88258 2.13214 4.75736 3.25736C3.63214 4.38258 3 5.9087 3 7.5C3 11.2448 7.15425 15.1447 8.54925 16.3492C8.67921 16.447 8.8374 16.4998 9 16.4998C9.1626 16.4998 9.32079 16.447 9.45075 16.3492Z" stroke="var(--gray-800)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 9.75C10.2426 9.75 11.25 8.74264 11.25 7.5C11.25 6.25736 10.2426 5.25 9 5.25C7.75736 5.25 6.75 6.25736 6.75 7.5C6.75 8.74264 7.75736 9.75 9 9.75Z" stroke="var(--gray-800)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: "13px", color: "var(--gray-800)", letterSpacing: "-0.26px", lineHeight: 1 }}>
            {location}
          </span>
        </div>

        {/* Date/time */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0 }}>
            <g clipPath="url(#clip0_253_9638)">
              <path d="M9.99999 18.3327C14.6024 18.3327 18.3333 14.6017 18.3333 9.99935C18.3333 5.39698 14.6024 1.66602 9.99999 1.66602C5.39762 1.66602 1.66666 5.39698 1.66666 9.99935C1.66666 14.6017 5.39762 18.3327 9.99999 18.3327Z" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 5V10L13.3333 11.6667" stroke="var(--gray-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <defs>
              <clipPath id="clip0_253_9638">
                <rect width="20" height="20" fill="white"/>
              </clipPath>
            </defs>
          </svg>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--gray-900)", letterSpacing: "-0.26px", lineHeight: 1 }}>{currentDate}</span>
          {/* No timezone label here on purpose. "SGT" isn't a widely-read abbreviation, and the
              location chip to the left already says Singapore — which is the timezone, since
              Singapore has exactly one. If this ever serves a second city, the fix is to make the
              clock itself follow that city (see lib/time.ts, currently Asia/Singapore for every
              date/hour bucket in the app) — not to re-add a label the clock doesn't honor. */}
          <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--gray-900)", letterSpacing: "-0.26px", lineHeight: 1 }}>{currentTime}</span>
        </div>

        {/* Bell + Settings */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              className="navbar-icon-btn"
              aria-label={t.vipDetections}
              onClick={() => {
                setNotifOpen(o => {
                  const next = !o;
                  if (next) markNotificationsRead();
                  return next;
                });
                setSettingsOpen(false);
              }}
              style={{ border: "none", cursor: "pointer", display: "flex", padding: "8px" }}
            >
              <img src="/icons/nav-bell.svg" width={20} height={20} alt="" style={{ display: "block" }} />
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: "4px", right: "4px",
                  minWidth: "15px", height: "15px", padding: unreadCount > 9 ? "0 3px" : 0,
                  borderRadius: "999px", backgroundColor: "var(--danger-400)", border: "1.5px solid white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontWeight: 600, color: "white", lineHeight: 1,
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: "300px", backgroundColor: "white",
                border: "1px solid var(--gray-200)", borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(14,22,42,0.12)",
                animation: "dropdown-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
                transformOrigin: "top right",
                zIndex: 200,
                overflow: "hidden",
              }}>
                {/* "VIP detections", not "Notifications": this list is filtered to
                    personType === "VIP", so Tracking events, offline cameras and expiring licences
                    never reach it. Under the broader title an operator whose camera just dropped
                    would open the bell, find nothing, and have no way to tell whether there was no
                    alert or whether that kind of alert simply doesn't arrive here. If other kinds
                    are added later the right shape is this title back as the container with tabs
                    beneath it (All / VIP / Cameras), the way Air and Qatalog do it. */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--gray-200)" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.vipDetections}</span>
                </div>
                {notifications.length === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: "8px", padding: "28px 16px",
                  }}>
                    <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                      <path d="M10 18.3327C14.6024 18.3327 18.3333 14.6017 18.3333 9.99935C18.3333 5.39698 14.6024 1.66602 10 1.66602C5.39762 1.66602 1.66666 5.39698 1.66666 9.99935C1.66666 14.6017 5.39762 18.3327 10 18.3327Z" stroke="var(--gray-300)" strokeWidth="1.4"/>
                      <path d="M10 6.66602V9.99935" stroke="var(--gray-300)" strokeWidth="1.4" strokeLinecap="round"/>
                      <path d="M10 13.334H10.0083" stroke="var(--gray-300)" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>{t.noneInWindow}</span>
                  </div>
                ) : (
                  <>
                  <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                    {notifications.map((ev) => (
                      <button
                        key={ev.id}
                        className="navbar-dropdown-item"
                        onClick={() => { setNotifOpen(false); onNotificationSelect?.(ev); }}
                        style={{
                          display: "flex", flexDirection: "column", gap: "3px", width: "100%",
                          padding: "10px 16px", border: "none", borderBottom: "1px solid var(--gray-100)",
                          cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                          {/* Every row here is a VIP hit, so a "VIP" label would say nothing —
                              the match confidence is what separates one alert from the next and
                              decides whether it is worth opening. */}
                          <span style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0 }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.name}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-400)", flexShrink: 0 }}>{ev.confidence}%</span>
                          </span>
                          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", flexShrink: 0 }}>{formatTimeAgo(ev.timestamp, lang)}</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>
                          {ev.location}{ev.cameraLabel ? ` · ${ev.cameraLabel}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Says what the list is, the way Slite's "those were all your notifications in
                      the last month" and folk's unread count do. Without it a badge reading 23 over
                      a list of 8 leaves the operator wondering what they can't see — which in a
                      monitoring tool is the wrong thing to leave them wondering. */}
                  <div style={{ padding: "9px 16px", borderTop: "1px solid var(--gray-200)", backgroundColor: "var(--gray-50)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)" }}>
                      {vipEvents.length > NOTIF_LIMIT
                        ? t.showingOf(NOTIF_LIMIT, vipEvents.length, NOTIF_WINDOW_LABEL)
                        : t.allOf(vipEvents.length, NOTIF_WINDOW_LABEL)}
                    </span>
                  </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div ref={settingsRef} style={{ position: "relative" }}>
            <button
              className="navbar-icon-btn"
              aria-label={t.settings}
              onClick={() => { setSettingsOpen(o => !o); setNotifOpen(false); }}
              style={{ border: "none", cursor: "pointer", display: "flex", padding: "8px" }}
            >
              <img src="/icons/nav-settings.svg" width={20} height={20} alt="" style={{ display: "block" }} />
            </button>
            {settingsOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: "200px", backgroundColor: "white",
                border: "1px solid var(--gray-200)", borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(14,22,42,0.12)",
                animation: "dropdown-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
                transformOrigin: "top right",
                zIndex: 200,
                overflow: "hidden", padding: "8px",
              }}>
                <div style={{ padding: "8px 8px 12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{SIGNED_IN_USER.name}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", marginTop: "2px" }}>{SIGNED_IN_USER.email}</div>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "0 4px 6px" }} />
                <button
                  className="navbar-dropdown-item"
                  onClick={() => { setSettingsOpen(false); router.push("/portal"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "9px 8px", borderRadius: "10px", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 12.8333C10.2217 12.8333 12.8333 10.2217 12.8333 7C12.8333 3.77834 10.2217 1.16667 7 1.16667C3.77834 1.16667 1.16667 3.77834 1.16667 7C1.16667 10.2217 3.77834 12.8333 7 12.8333Z" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1.16667 7H12.8333" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M7 1.16667C8.45964 2.76353 9.28481 4.83629 9.33333 7C9.28481 9.16371 8.45964 11.2365 7 12.8333C5.54036 11.2365 4.71519 9.16371 4.66667 7C4.71519 4.83629 5.54036 2.76353 7 1.16667Z" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{t.portal}</span>
                </button>
                <button
                  className="navbar-dropdown-item"
                  onClick={() => { setSettingsOpen(false); router.push("/mypage"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "9px 8px", borderRadius: "10px", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M12.25 12.25V11.0833C12.25 10.4645 12.0042 9.871 11.5666 9.43342C11.129 8.99583 10.5355 8.75 9.91667 8.75H4.08333C3.46449 8.75 2.871 8.99583 2.43342 9.43342C1.99583 9.871 1.75 10.4645 1.75 11.0833V12.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <path d="M7 6.41667C8.28866 6.41667 9.33333 5.37199 9.33333 4.08333C9.33333 2.79467 8.28866 1.75 7 1.75C5.71133 1.75 4.66666 2.79467 4.66666 4.08333C4.66666 5.37199 5.71133 6.41667 7 6.41667Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{t.myPage}</span>
                </button>
                {onSidebarPositionChange && (
                  <>
                    <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "6px 4px" }} />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)" }}>{t.sidebar}</span>
                      <div style={{ display: "flex", backgroundColor: "var(--gray-100)", borderRadius: "7px", padding: "2px", gap: "2px" }}>
                        {(["left", "right"] as const).map((pos) => {
                          const active = sidebarPosition === pos;
                          return (
                            <button
                              key={pos}
                              onClick={() => onSidebarPositionChange(pos)}
                              style={{
                                padding: "3px 9px", borderRadius: "5px", border: "none", cursor: "pointer",
                                backgroundColor: active ? "white" : "transparent",
                                boxShadow: active ? "0 1px 2px rgba(14,22,42,0.1)" : "none",
                                color: active ? "var(--gray-600)" : "var(--gray-400)",
                                fontSize: "10px", fontWeight: 600, letterSpacing: "-0.1px",
                                transition: "background-color 0.15s",
                              }}
                            >
                              {pos === "left" ? t.left : t.right}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "6px 4px" }} />
                <button
                  className="navbar-dropdown-item navbar-dropdown-item--danger"
                  onClick={() => { setSettingsOpen(false); router.push("/login"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "9px 8px", borderRadius: "10px", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.25 12.25H2.91667C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833V2.91667C1.75 2.60725 1.87292 2.3105 2.09171 2.09171C2.3105 1.87292 2.60725 1.75 2.91667 1.75H5.25" stroke="var(--danger-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.33334 9.91667L12.25 7L9.33334 4.08333" stroke="var(--danger-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12.25 7H5.25" stroke="var(--danger-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger-400)" }}>{t.logOut}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
