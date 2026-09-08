"use client";

import type { ComponentType } from "react";
import { Crown } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";

export type DetailTab = "overview" | "cameras" | "vip" | "license" | "server" | "users";

interface IconProps {
  color: string;
}

function OverviewIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.4"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.4"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.4"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.4"/>
    </svg>
  );
}

function CamerasIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H5L5.8 2.8C5.98 2.53 6.28 2.37 6.6 2.37H9.4C9.72 2.37 10.02 2.53 10.2 2.8L11 4H12.5C13.33 4 14 4.67 14 5.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V5.5Z" stroke={color} strokeWidth="1.4"/>
      <circle cx="8" cy="8.3" r="2.3" stroke={color} strokeWidth="1.4"/>
    </svg>
  );
}

/**
 * The crown the app already uses for VIP — Sidebar, the map pins and the detection chips all draw
 * lucide's Crown at this size. This was a hand-drawn five-pointed star, which matched neither the
 * app's icon nor the idea: a star is a favourite or a rating, and the registry is a watchlist of
 * specific people.
 *
 * strokeWidth 1.4 — the one weight every Portal icon is drawn at, hand-drawn paths and lucide
 * components alike. The rail was at 1, which read as a hairline against 13px bold labels.
 */
function VipIcon({ color }: IconProps) {
  return <Crown size={16} strokeWidth={1.4} color={color} />;
}

function LicenseIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5C4 2.22 4.22 2 4.5 2H9.5L12 4.5V13.5C12 13.78 11.78 14 11.5 14H4.5C4.22 14 4 13.78 4 13.5V2.5Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9.5 2V4.5H12" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6 8.7H10M6 10.7H10" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ServerIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1.4"/>
      <rect x="2" y="9" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1.4"/>
      <circle cx="4.3" cy="4.75" r="0.7" fill={color}/>
      <circle cx="4.3" cy="11.25" r="0.7" fill={color}/>
    </svg>
  );
}

function UsersIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.2" stroke={color} strokeWidth="1.4"/>
      <path d="M1.8 13c0-2.21 1.88-4 4.2-4s4.2 1.79 4.2 4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11.6" cy="6" r="1.7" stroke={color} strokeWidth="1.4"/>
      <path d="M9.9 13c0.1-1.76 1.6-3.1 3.3-3.1 1.02 0 1.94 0.46 2.55 1.18" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
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

interface ProjectSidebarProps {
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  collapsed: boolean;
  /**
   * True while Portal's account screen (PortalMyPage) is showing, so no nav tab looks current —
   * that screen belongs to the account, not to any tab of this project.
   */
  myPageOpen: boolean;
}

export default function ProjectSidebar({ tab, onTabChange, collapsed, myPageOpen }: ProjectSidebarProps) {
  const [lang] = usePortalLanguage();
  return (
    <div
      style={{
        width: collapsed ? "60px" : "212px",
        flexShrink: 0,
        display: "flex", flexDirection: "column",
        // gray-50 against a white canvas is a couple of percent of tone, so the hairline is what
        // actually separates the rail from the content — without it the nav floats in the page.
        backgroundColor: "var(--gray-50)",
        borderRight: "1px solid var(--gray-300)",
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
      {/* The nav list is the scroller, not the rail: it is the only part that could ever be long
          enough to need one, and an `overflow: auto` on the rail itself would clip anything a
          child wanted to float outside it. */}
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

    </div>
  );
}
