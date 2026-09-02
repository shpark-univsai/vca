"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER } from "./PortalShared";

const T = {
  en: {
    noTeam: "No Team",
    switchTeam: "Switch team",
    teamsHeading: "TEAMS",
    newTeam: "New team",
    projectCount: (n: number) => (n === 1 ? "1 project" : `${n} projects`),

    // New team modal
    modalTitle: "New team",
    modalIntro: "A team owns its own projects, users and mail settings. Nothing is shared with the teams already here.",
    nameLabel: "Team name",
    namePlaceholder: "e.g. Northgate Education Trust",
    regionLabel: "Region",
    regionPlaceholder: "e.g. Singapore",
    mailDomainLabel: "Mail domain",
    mailDomainPlaceholder: "e.g. northgate.edu.sg",
    mailDomainHint: "Invites and access requests are refused for addresses outside this domain. Leave it empty if you are not sure yet.",
    industryLabel: "Primary industry",
    industryNone: "Not set",
    cancel: "Cancel",
    create: "Create team",
    createdTitle: "Team created",
    createdDesc: (name: string) => `${name} — create its first project next`,
  },
  ko: {
    noTeam: "팀 없음",
    switchTeam: "팀 전환",
    teamsHeading: "팀",
    newTeam: "새 팀",
    projectCount: (n: number) => `프로젝트 ${n}개`,

    // New team modal
    modalTitle: "새 팀",
    modalIntro: "팀은 각자의 프로젝트, 사용자, 메일 설정을 따로 가집니다. 기존 팀과 공유되는 것은 없습니다.",
    nameLabel: "팀 이름",
    namePlaceholder: "예: Northgate Education Trust",
    regionLabel: "지역",
    regionPlaceholder: "예: Singapore",
    mailDomainLabel: "메일 도메인",
    mailDomainPlaceholder: "예: northgate.edu.sg",
    mailDomainHint: "이 도메인 밖의 주소로는 초대와 접근 요청이 거절됩니다. 아직 정해지지 않았다면 비워두세요.",
    industryLabel: "주요 산업",
    industryNone: "미설정",
    cancel: "취소",
    create: "팀 만들기",
    createdTitle: "팀이 생성됨",
    createdDesc: (name: string) => `${name} — 이어서 첫 프로젝트를 만드세요`,
  },
} as const;

/** Same list the signup wizard offers, so a team created here and a team created at signup carry
 *  values from the same vocabulary rather than two overlapping ones. */
const INDUSTRIES = ["Smart City", "Smart School", "Public Safety", "Transport", "Retail", "Other"];

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
          <span style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis" }}>
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
 * named on day one. Same fields the signup wizard collects, plus the two that only become
 * answerable later — region and the mail domain invites are checked against.
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
  const [region, setRegion] = useState("");
  const [mailDomain, setMailDomain] = useState("");
  const [industry, setIndustry] = useState("");

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const id = addTeam({
      name: name.trim(),
      region: region.trim(),
      // Empty stays undefined rather than "": resolveMailConfig and the invite forms test for a
      // domain being set at all, and an empty string is a domain nothing can match.
      mailDomain: mailDomain.trim() || undefined,
      industry: industry || undefined,
    });
    onClose();
    onCreated(id);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string, hint?: string) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }}
      />
      {hint && <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "6px", lineHeight: 1.6 }}>{hint}</p>}
    </div>
  );

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

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
          <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7 }}>{t.modalIntro}</p>
          {field(t.nameLabel, name, setName, t.namePlaceholder)}
          {field(t.regionLabel, region, setRegion, t.regionPlaceholder)}
          {field(t.mailDomainLabel, mailDomain, setMailDomain, t.mailDomainPlaceholder, t.mailDomainHint)}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.industryLabel}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {["", ...INDUSTRIES].map(value => {
                const active = industry === value;
                return (
                  <button
                    key={value || "__none"}
                    onClick={() => setIndustry(value)}
                    style={{
                      padding: "6px 10px", borderRadius: "999px", cursor: "pointer",
                      border: active ? "1px solid var(--gray-900)" : BORDER,
                      backgroundColor: active ? "var(--gray-100)" : "white",
                      color: active ? "var(--gray-900)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}
                  >
                    {value || t.industryNone}
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
