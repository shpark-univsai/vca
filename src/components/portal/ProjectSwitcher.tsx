"use client";

import { useState } from "react";
import { useVcaStore, type Project } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER } from "./PortalShared";

interface ProjectSwitcherProps {
  currentProjectId: string;
  onSelect: (projectId: string) => void;
  onNewProject: () => void;
}

type Tab = "recent" | "starred" | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "starred", label: "Starred" },
  { id: "all", label: "All" },
];

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
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.2"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.2"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.2"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="var(--gray-400)" strokeWidth="1.2"/>
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.5L8 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z" stroke="var(--gray-500)" strokeWidth="1.2"/>
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "var(--warning-400)" : "none"}>
      <path d="M8 1.5L9.85 5.6L14.3 6.15L11 9.25L11.85 13.7L8 11.5L4.15 13.7L5 9.25L1.7 6.15L6.15 5.6L8 1.5Z" stroke={filled ? "var(--warning-400)" : "var(--gray-300)"} strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--gray-900)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ProjectSwitcher({ currentProjectId, onSelect, onNewProject }: ProjectSwitcherProps) {
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const current = projects.find(p => p.id === currentProjectId);
  const team = teams[0];
  useEscapeKey(() => setOpen(false), open);

  const q = query.toLowerCase();
  const visibleProjects = projects
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
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          border: "none", background: "none", cursor: "pointer",
          padding: "6px 8px", borderRadius: "999px", color: "var(--gray-900)",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {current?.name ?? "Select project"}
        </span>
        <span style={{ color: "var(--gray-600)", display: "flex" }}><ChevronDown size={14} /></span>
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
            <div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: BORDER }}>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Select a resource</p>
              <button
                onClick={() => { setOpen(false); onNewProject(); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--primary-400)", fontSize: "12px", fontWeight: 700 }}
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--primary-400)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                New Project
              </button>
            </div>

            <div style={{ padding: "14px 20px 0" }}>
              {/* Org filter */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                border: BORDER, borderRadius: "8px", padding: "6px 10px", marginBottom: "12px",
                fontSize: "12px", fontWeight: 700, color: "var(--gray-600)",
              }}>
                {team?.name ?? "No Team"}
                <ChevronDown size={10} />
              </div>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </span>
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search projects and folders"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: "10px",
                    border: searchFocused ? "1px solid var(--gray-400)" : BORDER, outline: "none",
                    fontSize: "13px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "20px", borderBottom: BORDER }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: "0 2px 10px", fontSize: "12px", fontWeight: 700,
                      color: tab === t.id ? "var(--gray-900)" : "var(--gray-400)",
                      borderBottom: tab === t.id ? "2px solid var(--gray-900)" : "2px solid transparent",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "28px 1.6fr 0.9fr 1.3fr 32px", padding: "8px 20px", gap: "8px" }}>
                <span />
                {["Name", "Type", "ID", ""].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                ))}
              </div>

              {showTeamRow && (
                <div style={{ display: "grid", gridTemplateColumns: "28px 1.6fr 0.9fr 1.3fr 32px", padding: "8px 20px", gap: "8px", alignItems: "center" }}>
                  <span />
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
                    <TeamIcon /> {team?.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>Team</span>
                  <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{team?.id}</span>
                  <span />
                </div>
              )}

              {visibleProjects.length === 0 && !showTeamRow && (
                <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "20px", textAlign: "center" }}>
                  {tab === "starred" ? "No starred projects yet." : `No results for "${query}".`}
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
                      display: "grid", gridTemplateColumns: "28px 1.6fr 0.9fr 1.3fr 32px", padding: "8px 20px", gap: "8px",
                      alignItems: "center", cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", color: "var(--gray-900)" }}>{isCurrent && <CheckIcon />}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <ProjectIcon /> {p.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>Project</span>
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{p.id}</span>
                    <button onClick={e => toggleStar(p.id, e)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      <StarIcon filled={starred.has(p.id)} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
          <style>{`.portal-switcher-row:hover{background-color:var(--gray-50)}`}</style>
        </div>
      )}
    </>
  );
}
