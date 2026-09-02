"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, BREADCRUMB_TEAM_MAX_WIDTH, TEAM_INDUSTRIES } from "./PortalShared";

const T = {
  en: {
    noTeam: "No Team",
    switchTeam: "Switch team",
    teamsHeading: "TEAMS",
    newTeam: "New team",
    projectCount: (n: number) => (n === 1 ? "1 project" : `${n} projects`),

    // New team modal
    modalTitle: "New team",
    nameLabel: "Team name",
    namePlaceholder: "e.g. Northgate Education Trust",
    industryLabel: "Primary industry",
    cancel: "Cancel",
    create: "Create team",
  },
  ko: {
    noTeam: "팀 없음",
    switchTeam: "팀 전환",
    teamsHeading: "팀",
    newTeam: "새 팀",
    projectCount: (n: number) => `프로젝트 ${n}개`,

    // New team modal
    modalTitle: "새 팀",
    nameLabel: "팀 이름",
    namePlaceholder: "예: Northgate Education Trust",
    industryLabel: "주요 산업",
    cancel: "취소",
    create: "팀 만들기",
  },
} as const;

function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--gray-900)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface TeamSwitcherProps {
  currentTeamId: string;
  /** Called with the team to move to. The shell owns what switching means (it lives in the URL). */
  onSelect: (teamId: string) => void;
}

/**
 * The team half of the breadcrumb. This used to be a plain <span> printing the first team's name,
 * which was fine while the store only ever held one — but the store has always been able to hold
 * several (signup calls addTeam every time), and Users & Permissions has been asking which team to
 * file an invite under all along. So a label that named one of several teams and could not be
 * changed was showing a choice that existed everywhere except here.
 *
 * Shaped like the row-actions menu rather than like ProjectSwitcher's full-screen picker: teams are
 * a short list a person knows by heart, projects are a searchable table. Overusing the big modal
 * for two rows would make switching feel heavier than it is.
 */
export default function TeamSwitcher({ currentTeamId, onSelect }: TeamSwitcherProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = teams.find(o => o.id === currentTeamId) ?? teams[0];

  return (
    <>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(o => !o)}
          title={t.switchTeam}
          onMouseEnter={() => setHovered("__trigger")}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "6px 10px",
            backgroundColor: hovered === "__trigger" ? "var(--gray-50)" : "white",
            cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", whiteSpace: "nowrap",
          }}
        >
          {/* Its own title, so hovering the name reveals the name in full while hovering the rest
              of the button still explains what the button does. */}
          <span
            title={current?.name}
            style={{ maxWidth: BREADCRUMB_TEAM_MAX_WIDTH, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {current?.name ?? t.noTeam}
          </span>
          <span style={{ display: "flex", color: "var(--gray-400)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <ChevronDown />
          </span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: "4px", zIndex: 200,
            backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
            minWidth: "280px", maxWidth: "360px", padding: "4px",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px", padding: "8px 10px 4px" }}>
              {t.teamsHeading}
            </p>
            {teams.map(team => {
              const isCurrent = team.id === current?.id;
              // Counted here rather than stored: a team's projects are simply the projects filed
              // under it, and a cached count is one more thing that can disagree with the list.
              const count = projects.filter(p => p.teamId === team.id).length;
              return (
                <button
                  key={team.id}
                  onClick={() => { setOpen(false); if (!isCurrent) onSelect(team.id); }}
                  onMouseEnter={() => setHovered(team.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
                    padding: "8px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                    backgroundColor: hovered === team.id ? "var(--gray-100)" : "transparent",
                  }}
                >
                  <span style={{ display: "flex", width: "14px", flexShrink: 0 }}>{isCurrent && <CheckIcon />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: isCurrent ? 700 : 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {team.name}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--gray-400)", marginTop: "1px" }}>
                      {t.projectCount(count)}
                    </span>
                  </span>
                </button>
              );
            })}

            <div style={{ borderTop: BORDER, marginTop: "4px", paddingTop: "4px" }}>
              <button
                onClick={() => { setOpen(false); setShowNewTeam(true); }}
                onMouseEnter={() => setHovered("__new")}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
                  padding: "8px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                  backgroundColor: hovered === "__new" ? "var(--gray-100)" : "transparent",
                  fontSize: "12px", fontWeight: 700, color: "var(--primary-400)",
                }}
              >
                <span style={{ display: "flex", width: "14px", flexShrink: 0, justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </span>
                {t.newTeam}
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewTeam && (
        <NewTeamModal onClose={() => setShowNewTeam(false)} onCreated={onSelect} />
      )}
    </>
  );
}

/**
 * Creating a team was only possible at signup, so an installation was stuck with whatever it was
 * named on day one.
 *
 * Two required fields and nothing else. It started out asking for a region and a mail domain too,
 * and carried a paragraph explaining what a team is — the heaviest create-a-team box of any console
 * we looked at, where the usual shape (Devin, Framer, Miro, Tally, Mistral, PandaDoc, Notion) is a
 * name and at most a couple of extras, because at the moment a team is created most of its settings
 * are not yet knowable. Region went because nothing in the app ever reads Team.region. Mail domain
 * went because it is already editable, with far better context, in the project's Server & API tab —
 * and the hint under it here literally said "leave it empty if you are not sure yet", which is the
 * field telling you it does not belong on this screen. The prose went because two labelled required
 * fields already say what this makes; Framer's is exactly this bare and reads fine.
 *
 * On success the shell switches to the new team, which has no projects yet and therefore lands on
 * the empty state inviting the first one. That is the intended next step, not a dead end.
 */
function NewTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (teamId: string) => void }) {
  useEscapeKey(onClose);
  const addTeam = useVcaStore(s => s.addTeam);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");

  // Both required. Industry is not a nicety: it decides which of the two solution templates this
  // team's projects start from, and an unanswered one would just quietly mean Smart City.
  const canSubmit = name.trim().length > 0 && industry.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    // region is left empty the same way signup leaves it — the field exists on Team but no screen
    // reads it, so asking for it would collect something nobody ever sees.
    const id = addTeam({ name: name.trim(), region: "", industry });
    onClose();
    onCreated(id);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.modalTitle}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
              {t.nameLabel} <span style={{ color: "var(--danger-400)" }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
              {t.industryLabel} <span style={{ color: "var(--danger-400)" }}>*</span>
            </label>
            {/* Two buttons, not a dropdown. A required choice between exactly two things should be
                answerable in one click with both answers on screen; a closed select hides half the
                question and adds a click to a question that cannot be skipped. */}
            <div style={{ display: "flex", gap: "8px" }}>
              {TEAM_INDUSTRIES.map(option => {
                const active = industry === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setIndustry(option.value)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                      border: active ? "1px solid var(--gray-900)" : BORDER,
                      backgroundColor: active ? "var(--gray-100)" : "white",
                      color: active ? "var(--gray-900)" : "var(--gray-600)",
                      fontSize: "13px", fontWeight: 700,
                    }}
                  >
                    {option.label[lang]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={submit} disabled={!canSubmit}
            style={{
              padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.5,
            }}>
            {t.create}
          </button>
        </div>
      </div>
    </div>
  );
}
