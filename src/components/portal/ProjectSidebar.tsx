"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER } from "./PortalShared";

export type DetailTab = "overview" | "cameras" | "vip" | "license" | "server" | "users";

interface IconProps {
  color: string;
}

function OverviewIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1"/>
    </svg>
  );
}

function CamerasIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H5L5.8 2.8C5.98 2.53 6.28 2.37 6.6 2.37H9.4C9.72 2.37 10.02 2.53 10.2 2.8L11 4H12.5C13.33 4 14 4.67 14 5.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V5.5Z" stroke={color} strokeWidth="1"/>
      <circle cx="8" cy="8.3" r="2.3" stroke={color} strokeWidth="1"/>
    </svg>
  );
}

/**
 * The crown the app already uses for VIP — Sidebar, the map pins and the detection chips all draw
 * lucide's Crown at this size. This was a hand-drawn five-pointed star, which matched neither the
 * app's icon nor the idea: a star is a favourite or a rating, and the registry is a watchlist of
 * specific people.
 *
 * strokeWidth 1 rather than Lucide's default 2, so it sits at the same weight as the other seven
 * icons in this rail.
 */
function VipIcon({ color }: IconProps) {
  return <Crown size={16} strokeWidth={1} color={color} />;
}

function LicenseIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5C4 2.22 4.22 2 4.5 2H9.5L12 4.5V13.5C12 13.78 11.78 14 11.5 14H4.5C4.22 14 4 13.78 4 13.5V2.5Z" stroke={color} strokeWidth="1" strokeLinejoin="round"/>
      <path d="M9.5 2V4.5H12" stroke={color} strokeWidth="1" strokeLinejoin="round"/>
      <path d="M6 8.7H10M6 10.7H10" stroke={color} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function ServerIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1"/>
      <rect x="2" y="9" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1"/>
      <circle cx="4.3" cy="4.75" r="0.7" fill={color}/>
      <circle cx="4.3" cy="11.25" r="0.7" fill={color}/>
    </svg>
  );
}

function UsersIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.2" stroke={color} strokeWidth="1"/>
      <path d="M1.8 13c0-2.21 1.88-4 4.2-4s4.2 1.79 4.2 4" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      <circle cx="11.6" cy="6" r="1.7" stroke={color} strokeWidth="1"/>
      <path d="M9.9 13c0.1-1.76 1.6-3.1 3.3-3.1 1.02 0 1.94 0.46 2.55 1.18" stroke={color} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

const MENU_ITEM: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", width: "100%",
  padding: "9px 10px", borderRadius: "8px", border: "none", background: "none",
  cursor: "pointer", textAlign: "left",
  fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

function ExitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5.25 12.25H2.9167C2.6072 12.25 2.31005 12.1271 2.09032 11.9074C1.87059 11.6877 1.75 11.3905 1.75 11.0833V2.91667C1.75 2.60942 1.87059 2.31227 2.09032 2.09254C2.31005 1.87281 2.6072 1.75 2.9167 1.75H5.25" stroke="var(--gray-500)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.75 9.91667L12.25 6.41667L8.75 2.91667" stroke="var(--gray-500)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.25 6.41667H5.25" stroke="var(--gray-500)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12.25 12.25V11.0833C12.25 10.4645 12.0042 9.871 11.5666 9.43342C11.129 8.99583 10.5355 8.75 9.91667 8.75H4.08333C3.46449 8.75 2.871 8.99583 2.43342 9.43342C1.99583 9.871 1.75 10.4645 1.75 11.0833V12.25" stroke="var(--gray-500)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7 6.41667C8.28866 6.41667 9.33333 5.37199 9.33333 4.08333C9.33333 2.79467 8.28866 1.75 7 1.75C5.71133 1.75 4.66666 2.79467 4.66666 4.08333C4.66666 5.37199 5.71133 6.41667 7 6.41667Z" stroke="var(--gray-500)" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

/** The two-way chevron every account switcher uses — it says "this opens", not "this navigates". */
function ChevronUpDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3.5 7.5L6 10L8.5 7.5M3.5 4.5L6 2L8.5 4.5" stroke="var(--gray-400)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export const PROJECT_TABS: { id: DetailTab; label: { en: string; ko: string }; icon: ComponentType<IconProps> }[] = [
  { id: "overview", label: { en: "Overview", ko: "개요" }, icon: OverviewIcon },
  // VIP above the sources (asked for 2026-09-03): what the project watches FOR is the list an
  // operator maintains day to day; the camera and upload list is the plumbing under it.
  { id: "vip", label: { en: "VIP Registry", ko: "VIP 등록" }, icon: VipIcon },
  // The id stays "cameras" — it is a route key, and renaming it would only churn every call site.
  // The label changed because the tab now lists uploaded footage alongside cameras.
  { id: "cameras", label: { en: "Input Sources", ko: "입력 소스" }, icon: CamerasIcon },
  { id: "server", label: { en: "Server & API", ko: "서버 및 API" }, icon: ServerIcon },
  { id: "license", label: { en: "License", ko: "라이선스" }, icon: LicenseIcon },
  { id: "users", label: { en: "Users & Permissions", ko: "사용자 및 권한" }, icon: UsersIcon },
];

const ACCOUNT_T = {
  en: { toApp: "Go to app", myPage: "My page" },
  ko: { toApp: "앱으로 이동", myPage: "마이페이지" },
} as const;

interface ProjectSidebarProps {
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  collapsed: boolean;
  admin: { name: string; email: string } | null;
  /**
   * Whether this account has the monitoring app. False hides the way out — a Portal-only account
   * (the customer's security officer reading the audit trail) would land on a screen it cannot
   * use, and the item would be the console advertising a locked door.
   */
  appAccess: boolean;
  /** Opens Portal's own account screen. Not the app's /mypage — see PortalMyPage. */
  onMyPage: () => void;
  /** True while that screen is showing, so no nav tab looks current. */
  myPageOpen: boolean;
}

export default function ProjectSidebar({ tab, onTabChange, collapsed, admin, appAccess, onMyPage, myPageOpen }: ProjectSidebarProps) {
  const [lang] = usePortalLanguage();
  const router = useRouter();
  const at = ACCOUNT_T[lang];
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);
  return (
    <div
      style={{
        width: collapsed ? "60px" : "212px",
        flexShrink: 0,
        display: "flex", flexDirection: "column",
        backgroundColor: "var(--gray-100)",
        padding: collapsed ? "16px 8px" : "16px 12px",
        transition: "width .15s ease",
      }}
    >
      <style>{`
        .portal-navitem{transition:background-color .12s}
        .portal-navitem:hover{background-color:var(--gray-200)}
        .portal-navmenu-item{transition:background-color .12s}
        .portal-navmenu-item:hover{background-color:var(--gray-100)}
      `}</style>
      {/* The scroller is the nav list, not the whole rail: the account block below has a popover,
          and an `overflow: auto` ancestor clips it (overflow-y:auto forces the x axis to clip too).
          The list is what could ever be long enough to need scrolling anyway. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
        {PROJECT_TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id && !myPageOpen;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              title={collapsed ? t.label[lang] : undefined}
              className="portal-navitem"
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                justifyContent: collapsed ? "center" : "flex-start",
                border: "none", cursor: "pointer", borderRadius: "12px",
                padding: collapsed ? "12px 0" : "11px 14px",
                backgroundColor: active ? "var(--gray-900)" : undefined,
                color: active ? "white" : "var(--gray-600)",
                fontSize: "13px", fontWeight: active ? 700 : 600,
                whiteSpace: "nowrap", width: "100%",
              }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}><Icon color={active ? "white" : "var(--gray-600)"} /></span>
              {!collapsed && t.label[lang]}
            </button>
          );
        })}
      </div>

      {/* Who you are, pinned to the foot of the rail. No divider above it: the rail has room to
          spare, so the gap already separates it, and a line here would be the third horizontal
          rule on the screen. The avatar is the one primary-coloured thing in the sidebar —
          a 28px dot, which is the whole of the purple budget spent on identity. */}
      {admin && (
        <div ref={accountRef} style={{ position: "relative", paddingTop: "16px", marginTop: "8px" }}>
          {/*
            The account menu, where the way out of Portal now lives.
            "Exit to App" used to be a pill in the top bar, permanently, for something taken once a
            session — and the app puts the same door in ITS account menu (Navbar's avatar dropdown
            → Portal), so one direction was a persistent button and the other a menu item. This
            makes the pair symmetrical. The Overview banner carries a visible "Go to app" button so
            the door is not only discoverable by clicking your own name.
          */}
          {menuOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% - 4px)", left: 0,
              minWidth: collapsed ? "180px" : "100%",
              backgroundColor: "white", border: BORDER, borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(14,22,42,0.12)",
              padding: "6px", zIndex: 40,
            }}>
              {appAccess && (
                <button className="portal-navmenu-item" onClick={() => { setMenuOpen(false); router.push("/"); }} style={MENU_ITEM}>
                  <ExitIcon /> {at.toApp}
                </button>
              )}
              <button className="portal-navmenu-item" onClick={() => { setMenuOpen(false); onMyPage(); }} style={MENU_ITEM}>
                <PersonIcon /> {at.myPage}
              </button>
            </div>
          )}
          <button
            onClick={() => setMenuOpen(o => !o)}
            title={collapsed ? `${admin.name} · ${admin.email}` : undefined}
            aria-expanded={menuOpen}
            className="portal-navitem"
            style={{
              display: "flex", alignItems: "center", gap: "10px", width: "100%",
              justifyContent: collapsed ? "center" : "flex-start",
              border: "none", background: menuOpen ? "var(--gray-200)" : "none",
              cursor: "pointer", borderRadius: "12px",
              padding: collapsed ? "6px 0" : "6px 8px", textAlign: "left",
            }}
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
              backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700,
            }}>
              {admin.name.charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <>
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.email}</div>
                </div>
                <ChevronUpDownIcon />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
