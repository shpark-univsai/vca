"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVcaStore, type Project } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, BREADCRUMB_PROJECT_MAX_WIDTH, TABLE_HEADER_COLOR, SelectedCheckIcon, useTypeLabel } from "./PortalShared";
import { Building2, Check, ChevronRight, Mail, MapPin } from "lucide-react";

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
  /** Switch the whole picker — and the shell behind it — to another team. */
  onSwitchTeam?: (teamId: string) => void;
  currentProjectId: string;
  onSelect: (projectId: string) => void;
  /** Opens the "how do I get another project" notice. Not a create action — see the header. */
  onRequestProject: () => void;
  /**
   * Changes when the shell wants this picker open again.
   *
   * "New project" is reached from inside this dropdown, and the dropdown closes to make way for
   * the dialog. Cancelling the dialog therefore left the reader nowhere — back on the console
   * with the list they had been choosing from closed, and a second click needed to get back to
   * where they already were. Cancel should undo the step it cancels, not two of them.
   *
   * A counter rather than a boolean: the same request can be made twice in a row, and a boolean
   * that is already true does not fire an effect.
   */
  reopenSignal?: number;
}

type Tab = "recent" | "starred" | "all";
const TAB_IDS: Tab[] = ["recent", "starred", "all"];

/**
 * What this picker remembers between visits: which projects are starred, and when each was
 * last opened.
 *
 * Both were missing and both were visible as bugs. Stars were plain component state, so they
 * vanished on refresh — the Starred tab said "No starred projects yet" about projects starred
 * a minute earlier. And nothing recorded recency at all, so "Recent" and "All" rendered
 * byte-identical lists: a tab that is a copy of the tab beside it.
 *
 * Per browser, not per account, and deliberately so: this is which sites THIS person keeps
 * coming back to on THIS machine, which is a convenience and not a setting anybody else should
 * inherit. Every read and write is guarded — a private window, cleared site data or a browser
 * set to block storage all throw here, and none of them should break a switcher.
 */
const SWITCHER_MEMORY_KEY = "vca:portalSwitcher";

interface SwitcherMemory {
  starred: string[];
  /** projectId -> epoch ms of the last time it was picked from this list. */
  opened: Record<string, number>;
}

function readMemory(): SwitcherMemory {
  try {
    const raw = window.localStorage.getItem(SWITCHER_MEMORY_KEY);
    if (!raw) return { starred: [], opened: {} };
    const parsed = JSON.parse(raw) as Partial<SwitcherMemory>;
    return {
      starred: Array.isArray(parsed.starred) ? parsed.starred.filter(v => typeof v === "string") : [],
      opened: parsed.opened && typeof parsed.opened === "object" ? parsed.opened : {},
    };
  } catch {
    return { starred: [], opened: {} };
  }
}

/** Wall-clock, read at the moment of a click. Out here rather than inline in the handler so
 *  the component body stays free of impure calls. */
function stamp(): number {
  return Date.now();
}

function writeMemory(memory: SwitcherMemory): void {
  try {
    window.localStorage.setItem(SWITCHER_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Nothing to do and nothing to say: a switcher that cannot remember still switches.
  }
}

const T = {
  en: {
    selectProject: "Select project",
    requestProject: "Add a project",
    noTeam: "No Team",
    // "folders" came from the GCP picker this borrowed its shape from. Portal has no folders,
    // and a placeholder naming something the product does not have is a promise it cannot keep.
    searchPlaceholder: "Search projects",
    tabRecent: "Recent",
    tabStarred: "Starred",
    tabAll: "All",
    colName: "Name",
    colId: "ID",
    switchTeam: "Switch team",
    noStarredProjects: "No starred projects yet.",
    noResultsFor: (query: string) => `No results for "${query}".`,
    cancel: "Cancel",
  },
  ko: {
    selectProject: "프로젝트 선택",
    requestProject: "프로젝트 추가",
    noTeam: "팀 없음",
    searchPlaceholder: "프로젝트 검색",
    tabRecent: "최근",
    tabStarred: "즐겨찾기",
    tabAll: "전체",
    colName: "이름",
    colId: "ID",
    switchTeam: "팀 변경",
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

/** The building the rail's team foot wears. It was four squares here and a building there, for
 *  the same thing on the same screen. One mark per idea. */
function TeamIcon() {
  return <Building2 size={16} strokeWidth={1.8} color="var(--gray-400)" />;
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

export default function ProjectSwitcher({ dark, compact, teamId, currentProjectId, onSelect, onRequestProject, onSwitchTeam, reopenSignal }: ProjectSwitcherProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const typeLabel = useTypeLabel();
  const TAB_LABELS: Record<Tab, string> = { recent: t.tabRecent, starred: t.tabStarred, all: t.tabAll };
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  /*
   * Read after mount, never during render: localStorage is not available on the server, and a
   * first paint that disagreed with the second is the hydration mismatch this codebase avoids
   * everywhere else. Until it is read the list behaves as if nothing is remembered, which is
   * the same thing a first-time visitor sees.
   */
  const [memory, setMemory] = useState<SwitcherMemory>({ starred: [], opened: {} });
  useEffect(() => { queueMicrotask(() => setMemory(readMemory())); }, []);
  const starred = useMemo(() => new Set(memory.starred), [memory.starred]);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const teamMenuRef = useRef<HTMLDivElement>(null);
  // Not on mount — only when the shell raises the signal. See reopenSignal.
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) { firstSignal.current = false; return; }
    setOpen(true);
  }, [reopenSignal]);
  // Same outside-click close every other menu in Portal uses.
  useEffect(() => {
    if (!teamMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target as Node)) setTeamMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [teamMenuOpen]);

  const current = projects.find(p => p.id === currentProjectId);
  /**
   * The card's second line: where the project is and what kind it is — "Singapore · Smart City".
   * Both are real fields (the team's region, the project's type) and both are things the tabs
   * below cannot say. A missing half is dropped rather than printing a separator with nothing on
   * one side of it.
   */
  const subtitle = [teams.find(tm => tm.id === current?.teamId)?.region, current ? typeLabel(current.type) : undefined]
    .filter(Boolean)
    .join(" · ");
  const team = teams.find(o => o.id === teamId) ?? teams[0];
  useEscapeKey(() => setOpen(false), open);

  const q = query.toLowerCase();
  const visibleProjects = projects
    .filter(p => p.teamId === team?.id)
    .filter(p => p.name.toLowerCase().includes(q))
    .filter(p => tab !== "starred" || starred.has(p.id))
    // Recent means recently opened FROM HERE, so a project never picked is not in it. That
    // makes the tab empty on a first visit, which is the truth — it used to be a duplicate of
    // All, which was not.
    .filter(p => tab !== "recent" || memory.opened[p.id] !== undefined)
    .sort((a, b) => (tab === "recent" ? (memory.opened[b.id] ?? 0) - (memory.opened[a.id] ?? 0) : 0));

  const remember = (next: SwitcherMemory) => { setMemory(next); writeMemory(next); };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    remember({
      ...memory,
      starred: memory.starred.includes(id) ? memory.starred.filter(x => x !== id) : [...memory.starred, id],
    });
  };

  const selectProject = (p: Project) => {
    // Recording the pick is what makes the Recent tab a real answer rather than a copy of All.
    remember({ ...memory, opened: { ...memory.opened, [p.id]: stamp() } });
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
            backgroundColor: "color-mix(in srgb, var(--primary-300) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--primary-300) 34%, transparent)",
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
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.selectProject}</p>
              {/* Not "New Project" any more, and not because of permissions.
                  A project is a licensed site: its channels and term come from the contract, the
                  Licence screen says so in as many words, and the store has no writer for a
                  licence at all. A create button here produced a project nobody could put a camera
                  in. On-premise there is nothing lost by the vendor doing it instead — a new
                  site means hardware going in, so an engineer is on site anyway. */}
              <button
                className="portal-btn-quiet"
                onClick={() => { setOpen(false); onRequestProject(); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--gray-500)", fontSize: "12px", fontWeight: 600, fontFamily: "inherit" }}
              >
                <Mail size={13} strokeWidth={2.2} />
                {t.requestProject}
              </button>
            </div>

            <div style={{ padding: "14px 20px 0" }}>
              {/*
                Which team's projects are listed — and, when there is more than one team, the way
                to change that.

                This line has been a chip with a chevron that opened nothing, then a plain
                statement. Neither was right: the list below is scoped to one team, so somebody
                looking for a project that is not there has no way forward from the screen they
                are on, and the only door was the breadcrumb behind the modal they would first
                have to close.

                Still plain text on a single-team installation. A menu with one item in it is a
                control that lies about having a choice.
              */}
              <div ref={teamMenuRef} style={{ position: "relative", marginBottom: "12px", width: "fit-content" }}>
                {teams.length > 1 ? (
                  <button onClick={() => setTeamMenuOpen(o => !o)} title={t.switchTeam}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      background: "none", border: "none", padding: "2px 4px", marginLeft: "-4px", borderRadius: "6px",
                      cursor: "pointer", fontFamily: "inherit",
                      fontSize: "12px", fontWeight: 700, color: "var(--gray-600)",
                    }}>
                    <TeamIcon />
                    {team?.name ?? t.noTeam}
                    <span style={{ display: "flex", color: "var(--gray-400)" }}><ChevronDown size={12} /></span>
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>
                    <TeamIcon />
                    {team?.name ?? t.noTeam}
                  </div>
                )}
                {teamMenuOpen && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: "4px", zIndex: 20,
                    minWidth: "260px", backgroundColor: "white", border: BORDER, borderRadius: "10px",
                    boxShadow: "0 12px 28px rgba(14,22,42,0.16)", padding: "4px", overflow: "hidden",
                  }}>
                    {teams.map(tm => (
                      <button key={tm.id} className="portal-navmenu-item"
                        onClick={() => {
                          setTeamMenuOpen(false);
                          if (tm.id === team?.id) return;
                          setQuery("");
                          setOpen(false);
                          onSwitchTeam?.(tm.id);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "8px", width: "100%",
                          padding: "8px 10px", borderRadius: "8px", border: "none", background: "none",
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          fontSize: "13px", fontWeight: tm.id === team?.id ? 700 : 500,
                          color: "var(--gray-900)",
                        }}>
                        <span style={{ display: "flex", width: "14px", flexShrink: 0, color: "var(--gray-900)" }}>
                          {tm.id === team?.id ? <Check size={14} strokeWidth={2.6} /> : null}
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</span>
                      </button>
                    ))}
                  </div>
                )}
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
              {/* Name, id, star. No TYPE column: with the team row gone every row is a project,
                  so the column was the same word repeated down the list.

                  The name takes the width the others were not using — an id is a slug, and at
                  1.3fr it held a column of empty space while "Marina Bay & CBD Surveillance
                  Network" was cut mid-word beside it. The name is what somebody is reading this
                  table to find. */}
              <div style={{ display: "grid", gridTemplateColumns: "28px 2.6fr 0.9fr 32px", padding: "8px 20px", gap: "8px" }}>
                <span />
                {[t.colName, t.colId, ""].map((h, i) => (
                  <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                ))}
              </div>

              {/*
                No team row.
               
                It was a row in a list whose entire purpose is picking one thing — and it was
                the only row that could not be picked: a plain div with no onClick, no pointer
                cursor and no hover, drawn identically to the clickable projects under it. That
                is what made the list feel like two kinds of thing mixed together.
               
                Nothing is lost. The team is named in the selector directly above the search
                box, and switching team is offered there and again in the rail's own team
                switcher — a third route through an unclickable row was never one of them.
              */}
              {visibleProjects.length === 0 && (
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
                      display: "grid", gridTemplateColumns: "28px 2.6fr 0.9fr 32px", padding: "8px 20px", gap: "8px",
                      alignItems: "center", cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", color: "var(--gray-900)" }}>{isCurrent && <span style={{ display: "flex", color: "var(--gray-900)" }}><SelectedCheckIcon size={16} /></span>}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <ProjectIcon /> {p.name}
                    </span>
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
