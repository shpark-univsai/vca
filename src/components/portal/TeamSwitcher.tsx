"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Building2 } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, BREADCRUMB_TEAM_MAX_WIDTH, SelectedCheckIcon } from "./PortalShared";

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
    namePlaceholder: "Northgate Education Trust",
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
    namePlaceholder: "Northgate Education Trust",
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

interface TeamSwitcherProps {
  /**
   * Rendered on the sidebar's gray-900 rail rather than a white bar: the trigger inverts, the
   * open list does not. A floating panel belongs to the page it covers, not to the surface its
   * button sits on — every console with a dark rail drops a light menu out of it.
   */
  dark?: boolean;
  /**
   * Collapsed rail: the trigger becomes a square with the team's initial in it. 60px cannot hold a
   * team name, but the row has to stay — the nav below it lines up with the expanded rail's nav
   * only if what sits above it occupies the same height in both states.
   */
  compact?: boolean;
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
export default function TeamSwitcher({ dark, compact, currentTeamId, onSelect }: TeamSwitcherProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const [open, setOpen] = useState(false);
  /**
   * Whether the list opens upward, decided from the room under the trigger when it opens.
   *
   * The rail's team row is pinned to the bottom of the window, so a menu that always dropped down
   * dropped off the screen — the same fix FilterSelect needed for the bulk bar. Measured rather
   * than declared: this component is also a header crumb, where down is right.
   */
  const [dropUp, setDropUp] = useState(false);
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
          onClick={e => {
            if (!open) {
              const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const below = window.innerHeight - box.bottom;
              // 280 is the menu at its tallest (its own max plus the "new team" footer).
              setDropUp(below < 280 && box.top > below);
            }
            setOpen(o => !o);
          }}
          title={t.switchTeam}
          onMouseEnter={() => setHovered("__trigger")}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            borderRadius: "8px", padding: "6px 10px",
            // No edge of its own in the rail: it is one row of a bordered box that holds both
            // switchers, and a border inside a border is two boxes for one thing.
            border: dark ? "none" : "1px solid var(--line)",
            backgroundColor: dark
              ? (hovered === "__trigger" ? "var(--gray-800)" : "transparent")
              : (hovered === "__trigger" ? "var(--gray-50)" : "white"),
            cursor: "pointer", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap",
            // gray-200 in the rail, a step up from gray-300: the team's name is one of the two
            // things the rail exists to state, and at 12px on gray-900 the lower step read as a
            // caption on the project card rather than as a name of its own.
            color: dark ? "var(--gray-200)" : "var(--gray-600)",
            // Fills the rail there, hugs its label in the header. The height is pinned rather than
            // left to the padding: the collapsed rail has to reserve exactly this much for its
            // stand-in, and a row whose height depends on a font's metrics cannot be matched.
            ...(dark ? { width: "100%", minHeight: "34px", padding: "6px 12px", borderRadius: 0, boxSizing: "border-box" as const, alignItems: "center" } : null),
            ...(compact ? {
              width: "34px", height: "34px", padding: 0, borderRadius: "8px", justifyContent: "center",
              backgroundColor: hovered === "__trigger" ? "var(--gray-700)" : "var(--gray-800)",
            } : null),
          }}
        >
          {/* The mark the project card used to carry, moved up here with the team it actually
              describes: a building is an organisation, and the card below it navigates one site
              of that organisation. Bare, not in a filled square — this is the quiet row of the
              two, and a 34px tile on it would outweigh the card under it. */}
          {dark && !compact && (
            /*
              Fixed at 16px and centred on the name, however many lines it takes.

              It grew with the name for a while — the wrapper stretched and the SVG filled it — and
              that fixed the top-heavy look, but a scaled SVG scales its strokes with it: the same
              glyph drew a 0.8px line at one line of text and 1.75px at two, against the 1.2px
              every other icon in this rail draws. One weight beats one height. 1.8 at 16px is that
              1.2px (stroke × size / 24), and centring handles the two-line case.
            */
            <span style={{ display: "flex", alignItems: "center", alignSelf: "stretch", color: "var(--gray-400)", flexShrink: 0 }}>
              <Building2 size={16} strokeWidth={1.8} />
            </span>
          )}
          {/* Collapsed, the name has nowhere to go, so the initial stands for it and the button's
              own tooltip carries the rest. */}
          {compact ? (
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-300)" }}>
              {(current?.name ?? "?").trim().charAt(0).toUpperCase()}
            </span>
          ) : (<>
          {/* Its own title, so hovering the name reveals the name in full while hovering the rest
              of the button still explains what the button does. */}
          <span
            title={current?.name}
            style={{
              overflow: "hidden", textOverflow: "ellipsis",
              // In the rail the name takes whatever the 212px column leaves and ellipsises there;
              // a fixed 360px cap belongs to a header that is as wide as the window, and inside
              // the rail it let "City of Singapore — Smart Infrastructure Office" run out past the
              // edge of the sidebar and over the page.
              /* Two lines in the rail, like the project card under it. A team is a proper noun
               nobody can shorten — "City of Singapore — Smart Infrastructure Office" — and one
               line of a 220px column ended it after three words. In the header it stays one line:
               a crumb is a line by definition. */
            ...(dark
              ? {
                flex: 1, minWidth: 0, textAlign: "left" as const, whiteSpace: "normal" as const,
                lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
              }
              : { maxWidth: BREADCRUMB_TEAM_MAX_WIDTH }),
            }}
          >
            {current?.name ?? t.noTeam}
          </span>
          <span style={{ display: "flex", color: "var(--gray-400)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
            <ChevronDown />
          </span>
          </>)}
        </button>

        {open && (
          <div style={{
            position: "absolute", left: 0, zIndex: 200,
            ...(dropUp ? { bottom: "100%", marginBottom: "6px" } : { top: "100%", marginTop: "4px" }),
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
                  <span style={{ display: "flex", width: "14px", flexShrink: 0 }}>{isCurrent && <span style={{ display: "flex", color: "var(--gray-900)" }}><SelectedCheckIcon size={14} /></span>}</span>
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
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.63" strokeLinecap="round"/></svg>
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
export function NewTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (teamId: string) => void }) {
  useEscapeKey(onClose);
  const addTeam = useVcaStore(s => s.addTeam);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [name, setName] = useState("");

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    // Name only. Industry is not asked here — the solution template belongs to a PROJECT and the
    // project wizard's first step asks it with both options on screen as cards, so putting it on
    // the team asked the same question one screen earlier. A team also legitimately holds both
    // kinds: the seeded City of Singapore team has a Smart City project and a Smart School one, so
    // any single answer at team level would have been contradicted by its own data. The field is
    // gone from Team altogether now, along with the signup step that set it.
    const id = addTeam({ name: name.trim(), region: "" });
    onClose();
    onCreated(id);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.modalTitle}</p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
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
              // 14px, a step up from the 13px the Portal's other form inputs use. This is the one
              // field the whole box exists for, and it is what the team will be called everywhere
              // afterwards — worth reading at the size you would read a title at.
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "14px", fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!canSubmit}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-200)", color: canSubmit ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", 
            }}>
            {t.create}
          </button>
        </div>
      </div>
    </div>
  );
}
