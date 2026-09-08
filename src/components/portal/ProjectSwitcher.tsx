"use client";

import { useState } from "react";
import { useVcaStore, type Project } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, BREADCRUMB_PROJECT_MAX_WIDTH, TABLE_HEADER_COLOR, TYPE_META, SelectedCheckIcon } from "./PortalShared";
import { ChevronRight, MapPin } from "lucide-react";

interface ProjectSwitcherProps {
  /**
   * Rendered on the sidebar's gray-900 rail rather than a white bar: the trigger inverts, the
   * open list does not. A floating panel belongs to the page it covers, not to the surface its
   * button sits on — every console with a dark rail drops a light menu out of it.
   */
  dark?: boolean;
  /**
   * Collapsed rail: the card shrinks to the icon square alone. Same reason as TeamSwitcher's —
   * the row still has to occupy the height it does expanded, or the nav below it would sit at a
   * different place on the screen depending on whether the rail is open.
   */
  compact?: boolean;
  /** The team whose projects this picker lists. Projects belong to exactly one team, and the
   *  breadcrumb to the left of this control already says which team you are in — listing every
   *  team's projects here would contradict it. */
  teamId: string;
  currentProjectId: string;
  onSelect: (projectId: string) => void;
  onNewProject: () => void;
}

type Tab = "recent" | "starred" | "all";
const TAB_IDS: Tab[] = ["recent", "starred", "all"];

const T = {
  en: {
    selectProject: "Select project",
    selectResource: "Select a resource",
    newProject: "New Project",
    noTeam: "No Team",
    searchPlaceholder: "Search projects and folders",
    tabRecent: "Recent",
    tabStarred: "Starred",
    tabAll: "All",
    colName: "Name",
    colType: "Type",
    colId: "ID",
    typeTeam: "Team",
    typeProject: "Project",
    noStarredProjects: "No starred projects yet.",
    noResultsFor: (query: string) => `No results for "${query}".`,
    cancel: "Cancel",
  },
  ko: {
    selectProject: "프로젝트 선택",
    selectResource: "리소스 선택",
    newProject: "새 프로젝트",
    noTeam: "팀 없음",
    searchPlaceholder: "프로젝트 및 폴더 검색",
    tabRecent: "최근",
    tabStarred: "즐겨찾기",
    tabAll: "전체",
    colName: "이름",
    colType: "유형",
    colId: "ID",
    typeTeam: "팀",
    typeProject: "프로젝트",
    noStarredProjects: "즐겨찾기한 프로젝트가 없습니다.",
    noResultsFor: (query: string) => `"${query}"에 대한 검색 결과가 없습니다.`,
    cancel: "취소",
  },
} as const;

function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.4"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.4"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.4"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.4"/>
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.5L8 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z" stroke="var(--gray-500)" strokeWidth="1.4"/>
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "var(--warning-400)" : "none"}>
      <path d="M8 1.5L9.85 5.6L14.3 6.15L11 9.25L11.85 13.7L8 11.5L4.15 13.7L5 9.25L1.7 6.15L6.15 5.6L8 1.5Z" stroke={filled ? "var(--warning-400)" : "var(--gray-300)"} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ProjectSwitcher({ dark, compact, teamId, currentProjectId, onSelect, onNewProject }: ProjectSwitcherProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const TAB_LABELS: Record<Tab, string> = { recent: t.tabRecent, starred: t.tabStarred, all: t.tabAll };
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const current = projects.find(p => p.id === currentProjectId);
  /**
   * The card's second line: where the project is and what kind it is — "Singapore · Smart City".
   * Both are real fields (the team's region, the project's type) and both are things the tabs
   * below cannot say. A missing half is dropped rather than printing a separator with nothing on
   * one side of it.
   */
  const subtitle = [teams.find(tm => tm.id === current?.teamId)?.region, current ? TYPE_META[current.type].label : undefined]
    .filter(Boolean)
    .join(" · ");
  const team = teams.find(o => o.id === teamId) ?? teams[0];
  useEscapeKey(() => setOpen(false), open);

  const q = query.toLowerCase();
  const visibleProjects = projects
    .filter(p => p.teamId === team?.id)
    .filter(p => p.name.toLowerCase().includes(q))
    .filter(p => tab !== "starred" || starred.has(p.id));
  const showTeamRow = tab !== "starred" && team && team.name.toLowerCase().includes(q);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectProject = (p: Project) => {
    onSelect(p.id);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={compact ? current?.name : undefined}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          border: "none", background: "none", cursor: "pointer",
          padding: "6px 8px", borderRadius: "8px",
          color: dark ? "white" : "var(--gray-900)",
          /*
             In the rail it is a drawn box, not a bare label: the reference puts the site you are
             looking at in a bordered card with room to breathe, which is what makes it read as the
             thing the navigation below it belongs to rather than as the first row of that
             navigation. Nothing sits above it now but the wordmark — the team moved to the rail's
             foot, because a bare line of text on top of a bordered box read as clutter over the
             one thing the box is for. In the header it stays a bare crumb: there it sits between
             other crumbs and a box around one of them would be a button among plain text.
          */
          ...(dark ? {
            // Height pinned, padding horizontal only: the collapsed rail reserves exactly this
            // 60px for its icon-only stand-in, so the nav starts at the same y in both states.
            width: "100%", minHeight: "60px", boxSizing: "border-box" as const,
            padding: "10px 12px", borderRadius: "12px", gap: "8px", alignItems: "flex-start",
            /* The card wears the accent, the rows around it do not. It was gray-800 inside a
               gray-800 hover and a gray-700 border — a box you had to look for, holding the one
               thing the whole rail is scoped to. primary-400 at 18% with a 40% edge reads as a
               lit panel rather than a slightly different grey, and the pin inside it goes
               primary-300 so the colour starts at the mark and not at the border. */
            backgroundColor: "rgba(140, 133, 255, 0.16)", border: "1px solid rgba(140, 133, 255, 0.34)",
          } : null),
          /* minHeight and alignItems have to be undone here, not just overridden with height and
             gap: the dark branch above sets minHeight 60 and flex-start so the expanded card can
             grow with a two-line name, and a 44px square inheriting those came out 60px tall with
             its pin pinned to the top edge. */
          ...(compact ? { width: "44px", height: "44px", minHeight: "44px", padding: 0, justifyContent: "center", alignItems: "center" } : null),
        }}
      >
        {/* No icon square in the rail's project card. It was a 34px building glyph that said
            "this is a project" to a reader looking at a card in a rail that navigates one
            project — and it took 44px of a 224px column away from the two proper nouns that
            actually need the room. The team row above never had one and did not miss it. */}
        {/* A pin, not a building — the team above wears the building now, and this card names a
            place: the card's own second line reads "Singapore · Smart City". Bare and 15px rather
            than in a filled tile: the tile it used to have cost 44px of a 208px column, and the
            project's name is the one thing in this rail that must not be cut.
            1.8 at 16px, which is 1.2px of rendered stroke — the weight every icon in this rail
            draws at (see the note above the nav icons). At 15/1.7 it came out at 1.06 and read
            thinner than the menu under it. */}
        {/* Also when collapsed, where it is the only thing in the box.
            Moving the building mark up to the team left this card's compact state with nothing in
            it — a 44px empty square in the rail, which reads as a control that failed to load
            rather than as the project. The pin is what names the project now, so it is what the
            collapsed rail shows. */}
        {dark && (
          <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: compact ? 0 : "1px" }}>
            <MapPin size={16} strokeWidth={1.8} color="var(--primary-300)" />
          </span>
        )}
        {compact ? null : dark ? (
          <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1, textAlign: "left" }}>
            {/* Two lines before it gives up. A project name is a place — "Marina Bay & CBD
                Surveillance Network" — and one line of a 200px column cut it after three words,
                which left the rail naming a project you could not identify. -webkit-line-clamp is
                the only thing that ellipsises a wrapped block; every browser we ship to has it. */}
            <span title={current?.name} style={{
              fontSize: "13px", fontWeight: 700, color: "white", lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
            }}>
              {current?.name ?? t.selectProject}
            </span>
            {subtitle && (
              <span style={{ fontSize: "11px", color: "var(--gray-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {subtitle}
              </span>
            )}
          </span>
        ) : (
          <span
            title={current?.name}
            style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", maxWidth: BREADCRUMB_PROJECT_MAX_WIDTH, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {current?.name ?? t.selectProject}
          </span>
        )}
        {!compact && (
          <span style={{ color: dark ? "var(--gray-300)" : "var(--gray-600)", display: "flex", flexShrink: 0, marginTop: dark ? "1px" : 0 }}>
            {dark ? <ChevronRight size={16} strokeWidth={1.8} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div style={{
            backgroundColor: "white", border: BORDER, borderRadius: "16px",
            width: "640px", maxWidth: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(14,22,42,0.18)", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.selectResource}</p>
              <button
                onClick={() => { setOpen(false); onNewProject(); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--primary-400)", fontSize: "12px", fontWeight: 700 }}
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--primary-400)" strokeWidth="1.22" strokeLinecap="round"/></svg>
                {t.newProject}
              </button>
            </div>

            <div style={{ padding: "14px 20px 0" }}>
              {/* Which team's projects are listed. It used to carry a chevron and open nothing —
                  a control that looks like a menu and is not. Switching teams is a real thing now,
                  but it belongs to the breadcrumb behind this modal, so this states the filter and
                  leaves the switching there. */}
              {/* A line of text, not a boxed chip. The box was drawn back when this thing looked
                  like a control; it states which team's projects are listed and nothing more, and
                  a border around a statement invites a click that does nothing. */}
              <div style={{
                display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px",
                fontSize: "12px", fontWeight: 700, color: "var(--gray-600)",
              }}>
                <TeamIcon />
                {team?.name ?? t.noTeam}
              </div>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.22"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
                </span>
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={t.searchPlaceholder}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 32px", borderRadius: "10px",
                    border: searchFocused ? "1px solid var(--gray-900)" : BORDER, outline: "none",
                    fontSize: "13px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "20px", borderBottom: BORDER }}>
                {TAB_IDS.map(id => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: "0 2px 10px", fontSize: "12px", fontWeight: 700,
                      color: tab === id ? "var(--gray-900)" : "var(--gray-400)",
                      borderBottom: tab === id ? "2px solid var(--gray-900)" : "2px solid transparent",
                    }}
                  >
                    {TAB_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* The name takes the width the other two were not using.
                  Type is one word ("Project" / "Team") and an id is a slug — at 0.9fr and 1.3fr
                  they each held a column of empty space while "Marina Bay & CBD Surveillance
                  Network" was cut mid-word two columns to the left. The name is what somebody is
                  reading this table to find. */}
              <div style={{ display: "grid", gridTemplateColumns: "28px 2.6fr 0.7fr 0.9fr 32px", padding: "8px 20px", gap: "8px" }}>
                <span />
                {[t.colName, t.colType, t.colId, ""].map((h, i) => (
                  <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                ))}
              </div>

              {showTeamRow && (
                <div style={{ display: "grid", gridTemplateColumns: "28px 2.6fr 0.7fr 0.9fr 32px", padding: "8px 20px", gap: "8px", alignItems: "center" }}>
                  <span />
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
                    <TeamIcon /> {team?.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.typeTeam}</span>
                  <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{team?.id}</span>
                  <span />
                </div>
              )}

              {visibleProjects.length === 0 && !showTeamRow && (
                <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "20px", textAlign: "center" }}>
                  {tab === "starred" ? t.noStarredProjects : t.noResultsFor(query)}
                </p>
              )}

              {visibleProjects.map(p => {
                const isCurrent = p.id === currentProjectId;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className="portal-switcher-row"
                    style={{
                      display: "grid", gridTemplateColumns: "28px 2.6fr 0.7fr 0.9fr 32px", padding: "8px 20px", gap: "8px",
                      alignItems: "center", cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", color: "var(--gray-900)" }}>{isCurrent && <span style={{ display: "flex", color: "var(--gray-900)" }}><SelectedCheckIcon size={16} /></span>}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <ProjectIcon /> {p.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.typeProject}</span>
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{p.id}</span>
                    <button onClick={e => toggleStar(p.id, e)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      <StarIcon filled={starred.has(p.id)} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button className="portal-btn-outline"
                onClick={() => setOpen(false)}
                style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                {t.cancel}
              </button>
            </div>
          </div>
          <style>{`.portal-switcher-row:hover{background-color:var(--gray-50)}`}</style>
        </div>
      )}
    </>
  );
}
