"use client";

import { useState } from "react";
import { Building2, Clock, Globe, KeyRound, Languages, LayoutGrid, LogIn, Mail, MapPin, Shield, User } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/lib/i18n";
import { useVcaStore, currentPortalUser, canEnterApp, SIGNED_IN_USER } from "@/lib/vcaStore";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, CardSection, FilterSelect, PairGrid, PairItem, TextField, TYPE_META } from "./PortalShared";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "@/components/Toast";
import { PROJECT_TIME_ZONE } from "@/lib/time";

const T = {
  en: {
    accountTitle: "Account",
    name: "Name",
    email: "Email address",
    portalRole: "Portal role",
    appAccess: "App access",
    appYes: "Has the monitoring app",
    appNo: "Portal only",
    team: "Team",
    projectTitle: "Project",
    projectName: "Name",
    projectType: "Type",
    projectTeam: "Team",
    projectRegion: "Region",
    projectTimeZone: "Time zone",
    timeZoneNote: "Days, hours and \"today\" on every screen are counted in this zone — for everyone who opens this project, wherever they are.",
    displayTitle: "Display",
    language: "Interface language",
    password: "Password",
    passwordSetAgo: "Set 3 months ago",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords do not match. Please try again.",
    cancel: "Cancel",
    updatePassword: "Update password",
    passwordChanged: "Password changed",
    passwordChangedBody: "Sign in with the new password next time.",
    roles: { owner: "Owner", admin: "Admin", auditor: "Auditor", none: "No portal access" } as Record<string, string>,
  },
  ko: {
    accountTitle: "계정",
    name: "이름",
    email: "이메일",
    portalRole: "포털 역할",
    appAccess: "앱 접근",
    appYes: "모니터링 앱 사용",
    appNo: "포털만",
    team: "팀",
    projectTitle: "프로젝트",
    projectName: "이름",
    projectType: "유형",
    projectTeam: "팀",
    projectRegion: "지역",
    projectTimeZone: "시간대",
    timeZoneNote: "모든 화면의 날짜와 시각, \"오늘\"의 기준이 이 시간대로 계산됩니다 — 어디서 열든, 누가 열든 이 프로젝트에 대해서는 같습니다.",
    displayTitle: "표시",
    language: "화면 언어",
    password: "비밀번호",
    passwordSetAgo: "3개월 전 설정",
    changePassword: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
    cancel: "취소",
    updatePassword: "비밀번호 변경",
    passwordChanged: "비밀번호가 변경되었습니다",
    passwordChangedBody: "다음 로그인부터 새 비밀번호를 사용하세요.",
    roles: { owner: "최고관리자", admin: "관리자", auditor: "감사자", none: "포털 접근 없음" } as Record<string, string>,
  },
} as const;

/**
 * The zones this product is actually deployed in, not every zone the browser knows.
 *
 * A list of 400 IANA names is a search problem; these are the countries VCA sells into plus UTC as
 * the escape hatch for a site that reports in it. Each label carries the offset because "Asia/
 * Jakarta" means nothing to somebody choosing between it and "Asia/Bangkok" — they are the same
 * clock, and a reader picking a timezone is picking an offset with a city's name on it.
 * Add to this list rather than switching to a full picker; a wrong timezone here is silently wrong
 * data everywhere, so a short list of the right answers beats a long list of all of them.
 */
const TIME_ZONE_OPTIONS = [
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Jakarta", label: "Jakarta (UTC+7)" },
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (UTC+8)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "UTC", label: "UTC" },
];

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
];

/**
 * Portal's own account screen.
 *
 * Not the app's My page. The app has one at /mypage, and it is about the app — map alert
 * thresholds, sign-in sessions. This is the same idea for the console: who you are HERE, what this
 * console lets you do, and the one preference that is genuinely a preference.
 *
 * Everything on it is either read off the store or actually writes it. What an administrator sets
 * (name, address, role, doors) is plain read-only text, never a field that looks editable and then
 * is not — which is also why it carries no note explaining that: the rows have no controls on
 * them, so there is nothing to explain.
 */
export default function PortalSettingsPage({ projectId }: { projectId: string }) {
  const [lang, setLang] = useLanguage();
  const [changingPassword, setChangingPassword] = useState(false);
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const setProjectTimeZone = useVcaStore(s => s.setProjectTimeZone);
  const project = projects.find(p => p.id === projectId);
  const projectTeam = project ? teams.find(tm => tm.id === project.teamId) : undefined;
  const me = currentPortalUser(portalUsers);
  const myTeam = me ? teams.find(tm => tm.id === me.teamId) : undefined;

  const accountPairs: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: t.name, value: me?.name ?? SIGNED_IN_USER.name, icon: <User size={12} strokeWidth={2.2} /> },
    { label: t.email, value: me?.email ?? SIGNED_IN_USER.email, icon: <Mail size={12} strokeWidth={2.2} /> },
    ...(me ? [
      { label: t.portalRole, value: t.roles[me.permission] ?? me.permission, icon: <Shield size={12} strokeWidth={2.2} /> },
      { label: t.appAccess, value: canEnterApp(me) ? t.appYes : t.appNo, icon: <LogIn size={12} strokeWidth={2.2} /> },
      ...(myTeam ? [{ label: t.team, value: myTeam.name, icon: <Building2 size={12} strokeWidth={2.2} /> }] : []),
    ] : []),
  ];

  return (
    /**
     * Full content width, and one card — the shape the licence page uses, which is this page's
     * nearest neighbour: both are read-only facts with a control or two rather than a table.
     *
     * It was capped at 720px and centred, on a comment claiming that matched the licence page. It
     * does not: the licence page runs the full width like every other tab. So this was the one
     * screen in Portal indented from the left edge, and the three separate cards floating in that
     * narrow column read as a different product from the tab beside it.
     *
     * Sections inside one card, divided by the same hairline and headed by the same small-caps
     * label the licence card uses for INCLUDED FEATURES — one contract is one card there, one
     * account is one card here.
     */
    <div>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, overflow: "hidden", marginBottom: "20px" }}>
      {/* Which pairs exist depends on whether the signed-in address matches an account: with no
          match there is nothing to say about a role or a door, so those are absent rather than
          filled with a disclaimer. */}
      <CardSection heading={t.accountTitle} first>
        <PairGrid>
          {accountPairs.map(r => <PairItem key={r.label} label={r.label} icon={r.icon}>{r.value}</PairItem>)}
          {/* A pair like the others, whose value is a button rather than a fact: the sentence
              under "Password" is the only thing this page can honestly say about one — never the
              password itself, and not a row of dots pretending to be its length. */}
          <PairItem label={t.password} icon={<KeyRound size={12} strokeWidth={2.2} />}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{t.passwordSetAgo}</span>
              <button className="portal-btn-outline" onClick={() => setChangingPassword(true)}
                style={{ height: "28px", padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.changePassword}
              </button>
            </div>
          </PairItem>
        </PairGrid>
      </CardSection>

      {changingPassword && (
        <ChangePasswordModal t={t} lang={lang} onClose={() => setChangingPassword(false)} />
      )}

      {/*
        The project, and the one setting that belongs to it.

        This card is on the account screen because Portal has no project-settings screen yet, and
        it is fenced off as "Project" so nobody reads a site's timezone as a personal preference —
        it is not one. A timezone belongs to the place: the site sits in one country and its "today"
        is that country's, whoever is looking and from where. That is also why the note under the
        select says so out loud, and why this changing is written to the audit log.

        HANDOFF: when a project-settings screen exists (its natural home, alongside retention and
        the licence), this card moves there whole and Settings goes back to being the account only.
      */}
      {project && (
        <CardSection heading={t.projectTitle}>
          <PairGrid>
            <PairItem label={t.projectName} icon={<MapPin size={12} strokeWidth={2.2} />}>{project.name}</PairItem>
            <PairItem label={t.projectType} icon={<LayoutGrid size={12} strokeWidth={2.2} />}>{TYPE_META[project.type].label}</PairItem>
            {projectTeam && <PairItem label={t.projectTeam} icon={<Building2 size={12} strokeWidth={2.2} />}>{projectTeam.name}</PairItem>}
            {projectTeam?.region && <PairItem label={t.projectRegion} icon={<Globe size={12} strokeWidth={2.2} />}>{projectTeam.region}</PairItem>}
            {/* The one editable pair on the card, in the same shape as the four above it: the
                control sits where a value would, rather than being pushed to the far right of a
                ruled row. A setting is a value you can change, and it should look like the values
                it sits with. */}
            <PairItem label={t.projectTimeZone} icon={<Clock size={12} strokeWidth={2.2} />}>
              <FilterSelect
                value={project.timeZone ?? PROJECT_TIME_ZONE}
                onChange={zone => setProjectTimeZone(project.id, zone)}
                options={TIME_ZONE_OPTIONS}
                fitContent
              />
            </PairItem>
          </PairGrid>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "14px" }}>{t.timeZoneNote}</p>
        </CardSection>
      )}

      <CardSection heading={t.displayTitle}>
        <PairGrid>
          <PairItem label={t.language} icon={<Languages size={12} strokeWidth={2.2} />}>
            {/* Each language named in its own script — the one label a person who cannot read the
                current interface still recognises. */}
            <FilterSelect
              value={lang}
              onChange={v => setLang(v as AppLanguage)}
              options={LANGUAGE_OPTIONS}
              fitContent
            />
          </PairItem>
        </PairGrid>
      </CardSection>
      </div>
    </div>
  );
}

/**
 * Changing your own password.
 *
 * Same three fields, same rule line and the same wording as the app's own password screen — one
 * rule stated two ways reads as two rules, and a person who has seen it there should recognise it
 * here.
 *
 * HANDOFF NOTE: submits nowhere. The real call posts the current and new password together and the
 * server rejects the pair if the current one is wrong — which is why the current-password field
 * gets no validation of its own here: the front end cannot check it, and a field that says "wrong
 * password" from a guess would be inventing an answer only the server has. Everything the front end
 * *can* judge is judged: the format rule, and the two new entries matching.
 */
function ChangePasswordModal({ t, lang, onClose }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  lang: "en" | "ko";
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { showToast } = useToast();
  useEscapeKey(onClose, true);

  const formatValid = isPasswordFormatValid(next);
  // Only once something has been typed in the confirm box. A mismatch warning that appears on an
  // empty field is telling somebody off for not having finished.
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && formatValid && confirm.length > 0 && !mismatch;

  const submit = () => {
    if (!canSubmit) return;
    onClose();
    showToast({ variant: "success", title: t.passwordChanged, desc: t.passwordChangedBody });
  };

  const field = (label: string, value: string, onChange: (v: string) => void, autoComplete: string, hint?: React.ReactNode) => (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{label}</label>
      <TextField value={value} onChange={onChange} type="password" autoComplete={autoComplete} />
      {hint}
    </div>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.changePassword}</p>
        </div>
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {field(t.currentPassword, current, setCurrent, "current-password")}
          {field(t.newPassword, next, setNext, "new-password",
            /* The rule under the field, not in a tooltip: it should be readable before it is
               broken rather than after. Amber only once what is typed breaks it. */
            <p style={{ marginTop: "6px", fontSize: "11px", lineHeight: 1.6, color: next.length > 0 && !formatValid ? "var(--warning-500)" : "var(--gray-400)" }}>
              {PASSWORD_RULE_TEXT[lang]}
            </p>)}
          {field(t.confirmPassword, confirm, setConfirm, "new-password",
            mismatch ? <p style={{ marginTop: "6px", fontSize: "11px", lineHeight: 1.6, color: "var(--warning-500)" }}>{t.mismatch}</p> : undefined)}
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!canSubmit}
            style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-200)", color: canSubmit ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.updatePassword}
          </button>
        </div>
      </div>
    </div>
  );
}
