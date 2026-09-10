"use client";

import { useState } from "react";
import { Building2, Clock, Globe, KeyRound, Languages, LayoutGrid, LogIn, Mail, MapPin, Pencil, Shield, Trash2, User } from "lucide-react";
import { usePortalLanguage, type AppLanguage } from "@/lib/i18n";
import { useVcaStore, currentPortalUser, canEnterApp, canManageAccess, canSetPolicy, SIGNED_IN_USER, type SearchPurpose } from "@/lib/vcaStore";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, CardSection, FilterSelect, PairGrid, PairItem, TextField, ConfirmModal, usePortalEditAccess, useTypeLabel } from "./PortalShared";
import { WatchlistCategoryModal } from "./WatchlistCategories";
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
    teamMailTitle: "Team mail",
    teamMailIntro: "A project can override this from its Server tab, and most do not — so this is the address staff actually receive mail from.",
    teamMailDomain: "Mail domain",
    teamMailDomainHint: "Accounts must have an address on this domain. Requests and invites to anything else are refused.",
    teamMailHost: "SMTP host",
    teamMailPort: "Port",
    teamMailFrom: "From address",
    teamMailTls: "Use TLS",
    teamMailSave: "Save mail settings",
    teamMailSaved: "Team mail settings saved",
    teamMailFromMismatch: (d: string) => `The from address has to be on @${d}, or the receiving server rejects it.`,
    teamMailUnverified: "Saved, not tested. Nothing here connects to the relay, so a wrong host means invitations vanish with no sign on this screen — send one invite and confirm it arrives.",
    categoryTitle: "Watchlist categories",
    categoryCount: (n: number) => (n === 1 ? "1 category in use" : `${n} categories in use`),
    categoryManage: "Manage categories",
    projectTitle: "Project",
    projectName: "Name",
    rename: "Rename",
    renameSave: "Save",
    renameCancel: "Cancel",
    renamedToast: "Project renamed",
    deleteProject: "Delete this project",
    deleteAction: "Delete",
    deleteProjectHint: "The project and everything filed under it. The activity log survives, re-filed under the team.",
    deleteConfirmTitle: (name: string) => `Delete ${name}?`,
    deleteConfirmBody: "This cannot be undone. Type the project's name to confirm.",
    deleteConfirmCounts: (cameras: number, vips: number, staff: number) =>
      `${cameras} input source(s), ${vips} watchlist record(s) and ${staff} roster row(s) go with it. Accounts stay — this project is removed from their list.`,
    deleteConfirmLabel: "Delete project",
    deletedToast: "Project deleted",
    deleteLastProject: "This is the team's only project. A team with none shows the setup screen instead.",
    projectType: "Type",
    projectTeam: "Team",
    projectRegion: "Region",
    projectTimeZone: "Time zone",
    timeZoneNote: "Days, hours and \"today\" on every screen are counted in this zone — for everyone who opens this project, wherever they are.",
    purposeTitle: "Search purposes",
    purposeEmpty: "No purposes defined.",
    purposeRequirementOn: "Searches are supposed to record a purpose, and there is nothing to choose. Until one exists, operators search without giving a reason.",
    purposeNew: "New purpose",
    purposeLabelField: "Name",
    purposeLabelPlaceholder: "What your organisation calls it",
    purposeRequiresRef: "Require a case or document reference",
    purposeRefShort: "Reference required",
    purposeRetire: "Retire",
    purposeRetired: "Retired",
    purposeRetireNote: "Retired purposes cannot be chosen again. Past searches that name them still resolve.",
    purposeCreate: "Create",
    purposeCancel: "Cancel",
    purposeOwnerOnly: "Only the owner can change this list.",
    displayTitle: "Display",
    language: "Portal language",
    languageNote: "Portal only. The monitoring app keeps its own, set from My Page there.",
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
    teamMailTitle: "팀 메일",
    teamMailIntro: "프로젝트의 서버 탭에서 덮어쓸 수 있지만 대개 그러지 않으므로, 직원이 실제로 받는 주소가 여기입니다.",
    teamMailDomain: "메일 도메인",
    teamMailDomainHint: "계정은 반드시 이 도메인의 주소여야 합니다. 그 외 주소로의 요청과 초대는 거부됩니다.",
    teamMailHost: "SMTP 호스트",
    teamMailPort: "포트",
    teamMailFrom: "발신 주소",
    teamMailTls: "TLS 사용",
    teamMailSave: "메일 설정 저장",
    teamMailSaved: "팀 메일 설정이 저장되었습니다",
    teamMailFromMismatch: (d: string) => `발신 주소는 @${d} 도메인이어야 합니다. 아니면 받는 쪽 서버가 거부합니다.`,
    teamMailUnverified: "저장했을 뿐 테스트하지 않았습니다. 여기서 릴레이에 접속하지 않으므로 호스트가 틀리면 초대장이 이 화면에 아무 표시 없이 사라집니다 — 초대를 한 통 보내 도착하는지 확인하세요.",
    categoryTitle: "관심인물 분류",
    categoryCount: (n: number) => `사용 중인 분류 ${n}개`,
    categoryManage: "분류 관리",
    projectTitle: "프로젝트",
    projectName: "이름",
    rename: "이름 변경",
    renameSave: "저장",
    renameCancel: "취소",
    renamedToast: "프로젝트 이름이 바뀌었습니다",
    deleteProject: "이 프로젝트 삭제",
    deleteAction: "삭제",
    deleteProjectHint: "프로젝트와 그 아래 모든 것이 지워집니다. 변경 기록은 팀 밑으로 옮겨져 남습니다.",
    deleteConfirmTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    deleteConfirmBody: "되돌릴 수 없습니다. 확인을 위해 프로젝트 이름을 입력하세요.",
    deleteConfirmCounts: (cameras: number, vips: number, staff: number) =>
      `입력 소스 ${cameras}개, 명단 ${vips}건, 명부 ${staff}행이 함께 지워집니다. 계정은 남고, 이 프로젝트만 목록에서 빠집니다.`,
    deleteConfirmLabel: "프로젝트 삭제",
    deletedToast: "프로젝트가 삭제되었습니다",
    deleteLastProject: "팀의 마지막 프로젝트입니다. 프로젝트가 없는 팀은 설정 화면이 대신 열립니다.",
    projectType: "유형",
    projectTeam: "팀",
    projectRegion: "지역",
    projectTimeZone: "시간대",
    timeZoneNote: "모든 화면의 날짜와 시각, \"오늘\"의 기준이 이 시간대로 계산됩니다 — 어디서 열든, 누가 열든 이 프로젝트에 대해서는 같습니다.",
    purposeTitle: "조회 목적",
    purposeEmpty: "정의된 사유가 없습니다.",
    purposeRequirementOn: "조회할 때 목적을 기록하도록 되어 있는데 고를 것이 없습니다. 하나라도 만들기 전까지는 사유 없이 조회가 실행됩니다.",
    purposeNew: "사유 만들기",
    purposeLabelField: "이름",
    purposeLabelPlaceholder: "기관에서 부르는 이름",
    purposeRequiresRef: "사건번호·공문번호를 필수로",
    purposeRefShort: "참조번호 필수",
    purposeRetire: "사용 중지",
    purposeRetired: "중지됨",
    purposeRetireNote: "중지한 사유는 다시 고를 수 없습니다. 그 사유로 남은 과거 기록은 그대로 읽힙니다.",
    purposeCreate: "만들기",
    purposeCancel: "취소",
    purposeOwnerOnly: "이 목록은 최고관리자만 바꿀 수 있습니다.",
    displayTitle: "표시",
    language: "포털 화면 언어",
    languageNote: "포털에만 적용됩니다. 모니터링 앱은 별도이고, 앱의 마이페이지에서 정합니다.",
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
  const [lang, setLang] = usePortalLanguage();
  const [changingPassword, setChangingPassword] = useState(false);
  const searchPurposes = useVcaStore(s => s.searchPurposes);
  const requirePurpose = getComplianceConfig().requireSearchPurpose;
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const setProjectTimeZone = useVcaStore(s => s.setProjectTimeZone);
  const renameProject = useVcaStore(s => s.renameProject);
  const removeProject = useVcaStore(s => s.removeProject);
  const cameras = useVcaStore(s => s.cameras);
  const persons = useVcaStore(s => s.persons);
  const staffRoster = useVcaStore(s => s.staffRoster);
  const { showToast } = useToast();
  /*
   * The rename draft, tagged with the project it was typed for.
   *
   * This screen is not remounted by the project switcher, so a plain string stayed on screen
   * after picking a different project — and Save then renamed THAT one, writing
   * "Project renamed: <the other site> → <what you typed for this one>" into the audit log.
   *
   * Tagged rather than cleared in an effect: an effect shows the stale value for one frame
   * before wiping it, and this way the draft simply is not this project's, which is the truth.
   */
  const [renameDraft, setRenameDraft] = useState<{ projectId: string; value: string } | null>(null);
  const renaming = renameDraft && renameDraft.projectId === projectId ? renameDraft.value : null;
  const setRenaming = (value: string | null) =>
    setRenameDraft(value === null ? null : { projectId, value });
  const [confirmingDeleteFor, setConfirmingDeleteFor] = useState<string | null>(null);
  const confirmingDelete = confirmingDeleteFor === projectId;
  const setConfirmingDelete = (open: boolean) => setConfirmingDeleteFor(open ? projectId : null);
  /** Typed back before the delete button arms. See the dialog. */
  const [deleteEcho, setDeleteEcho] = useState("");
  // The project card's one editable pair. Account and display settings below belong to whoever
  // is signed in and stay open to every role — an auditor still sets their own password and
  // their own interface language.
  const { mayEdit } = usePortalEditAccess();
  const typeLabel = useTypeLabel();
  const watchlistCategories = useVcaStore(s => s.watchlistCategories);
  const [managingCategories, setManagingCategories] = useState(false);
  const project = projects.find(p => p.id === projectId);
  const projectTeam = project ? teams.find(tm => tm.id === project.teamId) : undefined;
  const me = currentPortalUser(portalUsers);
  // Owner only, deliberately narrower than mayEdit. Deleting a site takes away every camera,
  // every listed person and every roster row at once — that is role-granting weight, not
  // settings weight. See canManageAccess.
  const mayDeleteProject = me ? canManageAccess(me.permission) : true;
  const isLastProjectInTeam = project ? projects.filter(p => p.teamId === project.teamId).length === 1 : false;
  const myTeam = me ? teams.find(tm => tm.id === me.teamId) : undefined;
  /*
   * The team's mail settings, held as a draft so the form does not write on every keystroke.
   * Keyed to the team for the same reason the rename draft is keyed to the project — this
   * screen is not remounted when the team behind it changes.
   */
  const updateTeamMail = useVcaStore(s => s.updateTeamMail);
  const [mailDraft, setMailDraft] = useState<{ teamId: string; domain: string; host: string; port: string; from: string; tls: boolean } | null>(null);
  const liveMail = mailDraft && mailDraft.teamId === myTeam?.id ? mailDraft : null;
  const mailDomain = liveMail?.domain ?? myTeam?.mailDomain ?? "";
  const mailHost = liveMail?.host ?? myTeam?.smtp?.host ?? "";
  const mailPort = liveMail?.port ?? (myTeam?.smtp?.port ? String(myTeam.smtp.port) : "");
  const mailFrom = liveMail?.from ?? myTeam?.smtp?.fromAddress ?? "";
  const mailTls = liveMail?.tls ?? myTeam?.smtp?.useTls ?? true;
  const editMail = (patch: Partial<{ domain: string; host: string; port: string; from: string; tls: boolean }>) =>
    setMailDraft({ teamId: myTeam?.id ?? "", domain: mailDomain, host: mailHost, port: mailPort, from: mailFrom, tls: mailTls, ...patch });
  const setMailDomain = (v: string) => editMail({ domain: v });
  const setMailHost = (v: string) => editMail({ host: v });
  const setMailPort = (v: string) => editMail({ port: v });
  const setMailFrom = (v: string) => editMail({ from: v });
  const setMailTls = (v: boolean) => editMail({ tls: v });
  // The from-address has to live on the configured domain or the receiving server rejects it —
  // the same rule the project screen already applies, stated once per screen rather than once.
  const mailFromMismatch = mailDomain.trim() !== "" && mailFrom.trim() !== ""
    && !mailFrom.trim().toLowerCase().endsWith(`@${mailDomain.trim().toLowerCase()}`);
  const mailPortNum = Number(mailPort);
  const mailPortValid = mailPort.trim() === "" || (Number.isInteger(mailPortNum) && mailPortNum > 0 && mailPortNum < 65536);
  const canSaveTeamMail = mayEdit && liveMail !== null && !mailFromMismatch && mailPortValid;
  const saveTeamMail = () => {
    if (!canSaveTeamMail || !myTeam) return;
    updateTeamMail(myTeam.id, {
      mailDomain: mailDomain.trim() || undefined,
      smtp: mailHost.trim() === "" ? undefined : {
        host: mailHost.trim(),
        port: mailPort.trim() === "" ? 587 : mailPortNum,
        fromAddress: mailFrom.trim(),
        useTls: mailTls,
      },
    });
    setMailDraft(null);
    showToast({ variant: "success", title: t.teamMailSaved, desc: mailDomain.trim() });
  };
  // The team whose policy this screen edits. Falls back to the open project's team, because the
  // stand-in identity belongs to no account list and would otherwise see no list at all.
  const myTeamId = me?.teamId ?? project?.teamId;
  const teamPurposes = searchPurposes.filter(sp => sp.teamId === myTeamId);
  const teamCategories = watchlistCategories.filter(c => c.teamId === myTeamId);
  const activePurposes = teamPurposes.filter(sp => !sp.archived);
  // Owner only — see canSetPolicy. With no matching account the stand-in identity is treated as
  // the owner it stands in for, the same assumption the rest of Portal makes about it.
  const maySetPolicy = me ? canSetPolicy(me.permission) : true;

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
     * One card, capped, and flush left.
     *
     * The tabs beside this one are tables, and a table earns the full 1600px of the shell: more
     * width is more rows visible at once. This page is the opposite — five facts, a form and two
     * sentences — and at full width the pairs opened into six columns, the paragraphs ran to a
     * measure the eye cannot return from, and the card was mostly air. Both of the settings pages
     * this was checked against (Time2book, ClickUp) hold their content near 850px on any monitor.
     *
     * 880px: a 240px rail, a 520px column and the card's own padding, which is the width the
     * sections actually need rather than a round number.
     *
     * Centred. Left-aligned was tried first, on the reasoning that a card starting where the
     * Users table starts would not read as a different tab — but a capped column pinned to the
     * left edge does not read as aligned, it reads as a page that ran out halfway, with the
     * emptiness collected on one side. Splitting the leftover room puts it either side of the
     * content instead of all of it in one place, which is what every settings page this was
     * checked against does (Later, Lindy, Flodesk, Runway).
     *
     * The tradeoff is real and known: switching from a table tab to this one now shifts the left
     * edge. A settings page is entered deliberately and read on its own, so the shift costs less
     * than the lopsidedness did.
     */
    <div style={{ maxWidth: "880px", marginInline: "auto" }}>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      {/* No overflow:hidden. It was there to keep the section rules inside the rounded corners,
          which they never reach — the first section has no top rule and the last no bottom one —
          and it clipped the one thing that has to escape this box: the language select sits in the
          final section, so its list opened straight into the card's bottom edge and was cut off. */}
      <div className="portal-settings-card" style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, marginBottom: "20px" }}>
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
            {/* Editable, at last. Every handover starts with a test project and a typo, and
                there was no renameProject anywhere in the codebase — the first name a project
                was given was the only one it would ever have. */}
            <PairItem label={t.projectName} icon={<MapPin size={12} strokeWidth={2.2} />}>
              {renaming !== null ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ minWidth: "180px", flex: 1 }}>
                    <TextField value={renaming} onChange={setRenaming} autoFocus />
                  </span>
                  <button className="portal-btn-primary" disabled={!renaming.trim()}
                    onClick={() => {
                      renameProject(project.id, renaming.trim());
                      showToast({ variant: "success", title: t.renamedToast, desc: renaming.trim() });
                      setRenaming(null);
                    }}
                    style={{ height: "30px", padding: "0 12px", borderRadius: "8px", border: "none", backgroundColor: renaming.trim() ? "var(--primary-400)" : "var(--gray-200)", color: renaming.trim() ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: renaming.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                    {t.renameSave}
                  </button>
                  <button className="portal-btn-quiet" onClick={() => setRenaming(null)}
                    style={{ height: "30px", padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.renameCancel}
                  </button>
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Drawn like the four values under it. As a non-string child, PairItem was
                      handing this one straight through, so it skipped their 14px/700 and
                      inherited the card's body text — the one name on the card you can change
                      was also the only one that looked like prose. */}
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", wordBreak: "break-word" }}>{project.name}</span>
                  {mayEdit && (
                    /* Bordered, not quiet. Borderless belongs on a toolbar where six boxes in a
                       row would compete; here one grey word sat against a value in the same grey
                       and read as part of it, until the pointer arrived and a tinted box appeared
                       from nowhere — which is the jump. The border is there before the pointer
                       is, so hover only changes its fill, and the pencil says what the word does
                       before the word is read. */
                    <button className="portal-btn-outline" onClick={() => setRenaming(project.name)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0, height: "24px", padding: "0 9px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      <Pencil size={11} strokeWidth={2.2} />
                      {t.rename}
                    </button>
                  )}
                </span>
              )}
            </PairItem>
            <PairItem label={t.projectType} icon={<LayoutGrid size={12} strokeWidth={2.2} />}>{typeLabel(project.type)}</PairItem>
            {projectTeam && <PairItem label={t.projectTeam} icon={<Building2 size={12} strokeWidth={2.2} />}>{projectTeam.name}</PairItem>}
            {projectTeam?.region && <PairItem label={t.projectRegion} icon={<Globe size={12} strokeWidth={2.2} />}>{projectTeam.region}</PairItem>}
            {/* The one editable pair on the card, in the same shape as the four above it: the
                control sits where a value would, rather than being pushed to the far right of a
                ruled row. A setting is a value you can change, and it should look like the values
                it sits with. */}
            {/* A select that opens and then refuses is worse than a value that never looked
                editable — the same rule the Users table's permission cell follows. */}
            <PairItem label={t.projectTimeZone} icon={<Clock size={12} strokeWidth={2.2} />}>
              {mayEdit ? (
                <FilterSelect
                  value={project.timeZone ?? PROJECT_TIME_ZONE}
                  onChange={zone => setProjectTimeZone(project.id, zone)}
                  options={TIME_ZONE_OPTIONS}
                  fitContent
                />
              ) : (
                TIME_ZONE_OPTIONS.find(o => o.value === (project.timeZone ?? PROJECT_TIME_ZONE))?.label
                  ?? (project.timeZone ?? PROJECT_TIME_ZONE)
              )}
            </PairItem>
          </PairGrid>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "14px" }}>{t.timeZoneNote}</p>

          {/* Deleting a site is not a setting, so it does not sit among them: its own row at the
              foot of the card, after everything you might come here to read. Owner only — this is
              the heaviest thing anybody can do from the console, and it belongs with granting
              roles rather than with changing a timezone. */}
          {mayDeleteProject && (
            <div style={{ borderTop: BORDER, marginTop: "18px", paddingTop: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.deleteProject}</p>
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "2px" }}>{t.deleteProjectHint}</p>
              {/* Under its own words, flush with them. space-between held the button at the far
                  edge of the column, so the sentence explaining it and the thing it explains were
                  half a column apart and the hover tint landed nowhere near the text — read as a
                  stray control rather than the end of this paragraph. Every other control on this
                  page sits under the words naming it; the heaviest one should not be the
                  exception. The word is short because the line above already says which project. */}
              <button className="portal-btn-outline-danger" onClick={() => { setDeleteEcho(""); setConfirmingDelete(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 12px", marginTop: "10px", borderRadius: "8px", border: "1px solid var(--danger-200)", backgroundColor: "white", color: "var(--danger-500)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Trash2 size={13} strokeWidth={2.2} />
                {t.deleteAction}
              </button>
            </div>
          )}
        </CardSection>
      )}

      {confirmingDelete && project && (
        /* Type the name back. A red button on a dialog is a click; a project holds a city's
           cameras and a watchlist of named people, and the count of what goes is printed above
           the field so the number is read before the name is typed. */
        <ConfirmModal
          title={t.deleteConfirmTitle(project.name)}
          body={t.deleteConfirmBody}
          confirmLabel={t.deleteConfirmLabel}
          cancelLabel={t.renameCancel}
          danger
          confirmDisabled={deleteEcho.trim() !== project.name}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={() => {
            const name = project.name;
            removeProject(project.id);
            setConfirmingDelete(false);
            showToast({ variant: "warning", title: t.deletedToast, desc: name });
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7 }}>
              {t.deleteConfirmCounts(
                cameras.filter(c => c.projectId === project.id).length,
                persons.filter(pp => pp.projectId === project.id).length,
                staffRoster.filter(r => r.projectId === project.id).length,
              )}
            </p>
            {isLastProjectInTeam && (
              <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.7 }}>{t.deleteLastProject}</p>
            )}
            <TextField value={deleteEcho} onChange={setDeleteEcho} placeholder={project.name} autoFocus />
          </div>
        </ConfirmModal>
      )}

      {/*
        Search purposes — the institution's own list, and the reason the app's purpose gate can be
        satisfied at all.

        Here rather than on the VIP screen (where watchlist categories are managed) because a
        purpose is not a project's: it belongs to the institution, and the operator declaring one is
        in the monitoring app, not in this console. Settings is where the things that govern every
        site live.
      */}
      {/*
        Watchlist categories, alongside the purposes for the same reason: both are the team's
        policy, not a project's. This one was reachable only from inside the VIP registry, so a
        team waiting for its first site could set up its purposes and not its categories —
        backwards, because deciding what your institution's categories ARE is exactly the
        preparation that does not need a camera. The VIP registry still opens the same dialog
        from its category picker; this is where it lives.
      */}
      {/*
        Team mail, which had no screen at all.
       
        updateTeamMail existed in the store with zero call sites: the project mail screen read
        the team's values and offered to override them, and nothing anywhere could set them.
        On an on-premise site the invite mail is how staff get accounts, so this is the setting
        that decides whether anybody can sign in — and it is a team's, not a project's, which
        is why it sits here beside the other two team policies.
      */}
      {myTeam && (
        <CardSection heading={t.teamMailTitle} desc={t.teamMailIntro}>
          {/* No maxWidth of its own any more — the section's content column is the cap, and two
              of these grids with two different ones is how columns stop lining up between
              sections. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.teamMailDomain}</label>
              <TextField value={mailDomain} onChange={setMailDomain} placeholder="company.local" />
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.55, marginTop: "6px" }}>{t.teamMailDomainHint}</p>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.teamMailHost}</label>
              <TextField value={mailHost} onChange={setMailHost} placeholder="mail.company.local" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.teamMailPort}</label>
              <TextField value={mailPort} onChange={v => setMailPort(v.replace(/[^0-9]/g, ""))} placeholder="587" inputMode="numeric" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.teamMailFrom}</label>
              <TextField value={mailFrom} onChange={setMailFrom} placeholder="vca-noreply@company.local" />
              {mailFromMismatch && (
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.55, marginTop: "6px" }}>{t.teamMailFromMismatch(mailDomain.trim())}</p>
              )}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-600)", marginTop: "14px" }}>
            <input type="checkbox" checked={mailTls} onChange={e => setMailTls(e.target.checked)} disabled={!mayEdit} />
            {t.teamMailTls}
          </label>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "12px" }}>{t.teamMailUnverified}</p>
          <div style={{ marginTop: "14px" }}>
            <button className="portal-btn-primary" onClick={saveTeamMail} disabled={!canSaveTeamMail}
              style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: canSaveTeamMail ? "var(--primary-400)" : "var(--gray-200)", color: canSaveTeamMail ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSaveTeamMail ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {t.teamMailSave}
            </button>
          </div>
        </CardSection>
      )}

      {myTeamId && (
        <CardSection heading={t.categoryTitle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>
              {t.categoryCount(teamCategories.filter(c => !c.archived).length)}
            </span>
            <button className="portal-btn-quiet" onClick={() => setManagingCategories(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {t.categoryManage}
            </button>
          </div>
        </CardSection>
      )}

      {managingCategories && myTeamId && (
        <WatchlistCategoryModal
          teamId={myTeamId}
          categories={teamCategories}
          canEdit={maySetPolicy}
          onClose={() => setManagingCategories(false)}
        />
      )}

      {/* Hidden entirely when the requirement is off, rather than shown with a line explaining
          that nothing asks for it. A settings section for a feature this release does not have is
          a question the reader has to answer ("do I need to fill this in?") about something that
          cannot affect them. The flag is the switch — see complianceConfig. */}
      {requirePurpose && myTeamId && (
        <CardSection heading={t.purposeTitle}>
          {/* What the empty list actually costs, said here rather than only in the app. An
              administrator who has not built this list needs to know that the requirement is on and
              unmet — otherwise the console looks configured and the gate quietly waves everyone
              through. */}
          {requirePurpose && activePurposes.length === 0 && (
            <p style={{
              padding: "10px 12px", marginBottom: "12px", borderRadius: "8px", maxWidth: "fit-content",
              backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
              fontSize: "12px", fontWeight: 700, lineHeight: 1.6,
            }}>{t.purposeRequirementOn}</p>
          )}
          <SearchPurposeList t={t} teamId={myTeamId} purposes={teamPurposes} canEdit={maySetPolicy} />
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
        {/* Said out loud, because the two halves now disagree on purpose. Without it, somebody who
            switches here and walks into the app reads the same words in English and concludes the
            setting is broken. */}
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "12px" }}>{t.languageNote}</p>
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

/**
 * The institution's list of search purposes: what is on it, and how to add to it.
 *
 * Opens empty and says so. No example row, for the same reason the watchlist categories have none
 * — a shipped "Case enquiry" would read as the standard, and the first thing a customer does with
 * somebody else's vocabulary is delete it.
 *
 * Retire, never delete. A recorded search names the purpose by id; remove the row and every past
 * record points at nothing, which is the one thing an audit trail may not do.
 */
function SearchPurposeList({ t, teamId, purposes, canEdit }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  teamId: string;
  purposes: SearchPurpose[];
  canEdit: boolean;
}) {
  const addSearchPurpose = useVcaStore(s => s.addSearchPurpose);
  const archiveSearchPurpose = useVcaStore(s => s.archiveSearchPurpose);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [requiresReference, setRequiresReference] = useState(false);

  const reset = () => { setCreating(false); setLabel(""); setRequiresReference(false); };
  const create = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    addSearchPurpose({ teamId, label: trimmed, requiresReference });
    reset();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {purposes.length === 0 && !creating && (
        <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.7 }}>{t.purposeEmpty}</p>
      )}
      {purposes.map(sp => (
        <div key={sp.id} style={{
          display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
          border: BORDER, borderRadius: "10px", opacity: sp.archived ? 0.55 : 1,
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sp.label}
          </span>
          {sp.requiresReference && (
            <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>{t.purposeRefShort}</span>
          )}
          {sp.archived ? (
            <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 700, color: "var(--gray-400)" }}>{t.purposeRetired}</span>
          ) : canEdit ? (
            <button className="portal-btn-outline" onClick={() => archiveSearchPurpose(sp.id)}
              style={{ flexShrink: 0, height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.purposeRetire}
            </button>
          ) : null}
        </div>
      ))}

      {!canEdit ? (
        // Said, not hidden. A reader who cannot find the Create button should learn that the list
        // has an owner rather than conclude the console is broken.
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.purposeOwnerOnly}</p>
      ) : creating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", border: BORDER, borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
          <div>
            <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.purposeLabelField}</label>
            <TextField value={label} onChange={setLabel} placeholder={t.purposeLabelPlaceholder} autoFocus />
          </div>
          {/* Off by default, unlike the watchlist category's basis. A purpose is declared once a
              sitting and a reference is not always available at that moment; a category is chosen
              per person, where the paperwork already exists. */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-600)" }}>
            <input type="checkbox" checked={requiresReference} onChange={e => setRequiresReference(e.target.checked)} />
            {t.purposeRequiresRef}
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button className="portal-btn-outline" onClick={reset}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.purposeCancel}
            </button>
            <button className="portal-btn-primary" onClick={create} disabled={!label.trim()}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: label.trim() ? "var(--primary-400)" : "var(--gray-200)", color: label.trim() ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: label.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {t.purposeCreate}
            </button>
          </div>
        </div>
      ) : (
        <button className="portal-btn-outline" onClick={() => setCreating(true)}
          style={{ height: CONTROL_HEIGHT, borderRadius: "10px", border: "1px dashed var(--gray-300)", backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + {t.purposeNew}
        </button>
      )}
      {purposes.some(sp => sp.archived) && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.purposeRetireNote}</p>
      )}
    </div>
  );
}
