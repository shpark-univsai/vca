"use client";

import { useState } from "react";
import { ListChecks, Users } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER } from "./PortalShared";

const T = {
  en: {
    eyebrow: "Projects",
    title: "Deploy AI Monitoring for Any Environment",
    subtitle: "Create your first project, connect a camera stream, and start monitoring in minutes.",
    // A project is a licensed site, and a licence is implanted by contract at installation —
    // so there is nothing to press here. See PortalEmptyState's note on provisioning.
    notProvisionedTitle: "No projects provisioned for this team yet",
    notProvisionedBody: "A project is a licensed site. Its channels and term come from the contract, so it is set up during installation rather than from this console.",
    contactManager: "Your account manager",
    noManager: "Contact whoever handled your installation.",
    prepTitle: "What you can set up before the site arrives",
    prepBody: "These belong to the team, not to a project, so none of them are waiting on hardware.",
    prepCategories: "Watchlist categories",
    prepCategoriesWhy: "What a listing means here, how long it lasts by default, and whether it needs a written basis.",
    prepPurposes: "Search purposes",
    prepPurposesWhy: "The reasons an operator may give for looking somebody up.",
    prepOpen: "Open settings",
    // Shown when the installation has no team yet. A project has to live in a team, so the first
    // ask is the team — offering "New Project" here would open a wizard with nowhere to file it.
    noTeamTitle: "No teams yet",
    noTeamSubtitle: "A team holds this installation's projects, users and mail settings. Create one to get started.",
    teamNameLabel: "Team name",
    teamNamePlaceholder: "Northgate Education Trust",
    createTeam: "Create team",
  },
  ko: {
    eyebrow: "프로젝트",
    title: "모든 환경에 AI 모니터링을 적용하세요",
    subtitle: "첫 프로젝트를 생성하고 카메라 스트림을 연결하면 몇 분 안에 모니터링을 시작할 수 있습니다.",
    notProvisionedTitle: "이 팀에 배정된 프로젝트가 아직 없습니다",
    notProvisionedBody: "프로젝트는 라이선스가 걸린 현장입니다. 채널과 기간이 계약에서 나오기 때문에, 이 콘솔이 아니라 설치 과정에서 세팅됩니다.",
    contactManager: "담당자",
    noManager: "설치를 담당한 곳으로 문의하세요.",
    prepTitle: "현장이 들어오기 전에 해둘 수 있는 것",
    prepBody: "전부 프로젝트가 아니라 팀에 걸린 설정이라, 장비를 기다릴 필요가 없습니다.",
    prepCategories: "관심인물 분류",
    prepCategoriesWhy: "여기서 '등록'이 무엇을 뜻하는지, 기본 유효기간은 얼마인지, 근거를 필수로 할지.",
    prepPurposes: "조회 목적",
    prepPurposesWhy: "관제요원이 인물을 조회할 때 밝힐 수 있는 사유 목록.",
    prepOpen: "설정 열기",
    noTeamTitle: "아직 팀이 없습니다",
    noTeamSubtitle: "팀은 이 설치본의 프로젝트, 사용자, 메일 설정을 담습니다. 하나 만들어 시작하세요.",
    teamNameLabel: "팀 이름",
    teamNamePlaceholder: "Northgate Education Trust",
    createTeam: "팀 만들기",
  },
} as const;

interface PortalEmptyStateProps {
  /** The team's account manager, shown instead of a create button. See the note below. */
  accountManager?: { name: string; email: string };
  /** Opens Settings, where both team-level policy lists live. */
  onOpenSettings?: () => void;
  /**
   * No team exists yet in this installation — ask for the team first, on a centred panel with the
   * name field right there.
   *
   * NOT the gallery landing with the button swapped. That page is a pitch for what the product
   * does, which is the wrong thing to show someone who has already bought it and is trying to
   * finish setup; and a modal over it would darken a page with nothing on it worth preserving.
   * There is one field, so the field goes on the screen.
   */
  noTeam?: boolean;
  /** Receives the typed team name. */
  onCreateTeam?: (name: string) => void;
}

/**
 * Nothing to set up here, and saying so is the screen's job.
 *
 * This page used to open a three-field wizard. A project is a licensed site: its channel count
 * and term come from the contract, `updateProjectLicense` has no caller by design, and the
 * Licence screen says in so many words that channels and term are changed by contract and not
 * from here. A self-serve button therefore produced a project nobody could put a camera in —
 * a contract shell with no contract. And on-premise there is no cost to the vendor doing it
 * instead: a new site means cameras and servers going in, so an engineer is on site regardless.
 *
 * The wizard survives as the provisioning reference (Server & API → API documentation), because
 * the shape it produces is exactly what the backend has to produce.
 */
export default function PortalEmptyState({ accountManager, onOpenSettings, noTeam = false, onCreateTeam }: PortalEmptyStateProps) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [teamName, setTeamName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const askTeam = noTeam && !!onCreateTeam;

  if (askTeam) {
    const canSubmit = teamName.trim().length > 0;
    const submit = () => { if (canSubmit) onCreateTeam(teamName.trim()); };
    return (
      // Centred, because there is exactly one thing to do here.
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "480px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "56px", height: "56px", borderRadius: "16px",
            backgroundColor: "white", border: BORDER, color: "var(--gray-500)",
          }}>
            <Users size={24} strokeWidth={1.4} />
          </span>
          {/* States the situation before the action — "No teams yet", not a product headline. */}
          <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginTop: "20px" }}>{t.noTeamTitle}</p>
          <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "8px", textAlign: "center", lineHeight: 1.6 }}>
            {t.noTeamSubtitle}
          </p>

          <div style={{ width: "100%", marginTop: "28px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
              {t.teamNameLabel} <span style={{ color: "var(--danger-400)" }}>*</span>
            </label>
            <input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder={t.teamNamePlaceholder}
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box", height: "44px", padding: "0 12px", borderRadius: "10px",
                border: nameFocused ? "1px solid var(--gray-900)" : BORDER, outline: "none",
                fontSize: "14px", fontFamily: "inherit", backgroundColor: "white",
              }}
            />
          </div>

          <button className="portal-btn-primary"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              width: "100%", marginTop: "16px", padding: "12px 20px", borderRadius: "8px", border: "none",
              backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-200)", color: canSubmit ? "white" : "var(--gray-400)", fontSize: "14px", fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed", 
            }}
          >
            {t.createTeam}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", marginBottom: "12px" }}>{t.eyebrow}</p>
        <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "40px" }}>
          {t.title}
        </p>
        <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "12px", lineHeight: "22px" }}>
          {t.subtitle}
        </p>
        {/* A named person, not a "contact support" button. Whoever is looking at this screen has
            bought the product and is waiting for a site; the useful thing is the name of the
            person who can tell them when it arrives. Plain text rather than a mailto — the same
            treatment the Licence screen's party block uses. */}
        <div style={{ marginTop: "24px", padding: "16px 18px", backgroundColor: "white", border: BORDER, borderRadius: "12px", maxWidth: "440px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.notProvisionedTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.55, marginTop: "6px" }}>{t.notProvisionedBody}</p>
          <div style={{ borderTop: BORDER, marginTop: "12px", paddingTop: "12px" }}>
            {accountManager ? (<>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{t.contactManager.toUpperCase()}</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "4px" }}>{accountManager.name}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{accountManager.email}</p>
            </>) : (
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.noManager}</p>
            )}
          </div>
        </div>
      </div>

      {/* The gallery is gone from this state.
          It was a pitch for what the product does, shown to somebody who has already bought it
          and is waiting for their site — the wrong thing to read while waiting. What replaces it
          is the work that IS available: both of these are the team's policy, so they can be
          settled before a single camera is mounted, and settling them early is what stops the
          first month's registrations going in unclassified. */}
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "14px", padding: "20px 22px" }}>
        <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)" }}>{t.prepTitle}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.55, marginTop: "6px" }}>{t.prepBody}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "18px" }}>
          {[
            { label: t.prepCategories, why: t.prepCategoriesWhy },
            { label: t.prepPurposes, why: t.prepPurposesWhy },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", gap: "10px" }}>
              <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: "2px" }}>
                <ListChecks size={15} strokeWidth={1.9} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{item.label}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, marginTop: "2px" }}>{item.why}</p>
              </div>
            </div>
          ))}
        </div>
        {onOpenSettings && (
          <button className="portal-btn-primary" onClick={onOpenSettings}
            style={{ marginTop: "20px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.prepOpen}
          </button>
        )}
      </div>
    </div>
  );
}
