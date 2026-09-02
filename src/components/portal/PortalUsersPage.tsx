"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, isNetworkIsolated, isLastActiveAdmin, type PortalPermission, type PortalUser, type PortalUserStatus } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { TEMP_PASSWORD_VALIDITY_HOURS } from "@/lib/password";
import { getAuthConfig, hasOutboundMail } from "@/lib/authConfig";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, TABLE_COLUMN_GAP, PANEL_SHADOW, RowActionsMenu, FilterSelect, TABLE_HEADER_COLOR } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";

const T = {
  en: {
    // Page header
    title: "Users & Permissions",
    descScopedPrefix: "Showing users with access to",
    descScopedSuffix: "",
    descUnscoped: "Grant Portal (admin) or app (operator) access and scope users to projects.",
    inviteUser: "Invite user",
    searchPlaceholder: "Search by user name or email address",

    // Role/status summary strip
    countAdmins: "Admins",
    countOperators: "Operators",
    countInvited: "Invited",
    countSuspended: "Suspended",
    countTotal: "Total",
    invitedHint: "Invited but has not set a password yet — they cannot sign in until they do.",
    suspendedHint: "Kept on the list but blocked from signing in.",

    // Toolbar filters
    filterBy: "Filter by",
    filterAllPermissions: "All permissions",
    filterAllStatuses: "All statuses",
    emptyFiltered: "No users match these filters.",
    clearFilters: "Clear filters",

    // Table
    colUser: "User",
    colTeam: "Team",
    colProjects: "Projects",
    colPermission: "Permission",
    colMfa: "MFA",
    colLastLogin: "Last Login",
    colStatus: "Status",
    emptySearch: "No users match this search.",
    emptyNoUsers: "No users have access to this project yet.",

    // Permission / status / MFA display labels
    permAdmin: "Admin",
    permOperator: "Operator",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",
    mfaEnabledTitle: "MFA enabled",

    // Row actions
    resendInvite: "Resend invite",
    generateTempPassword: "Generate temporary password",
    // "user" is redundant in a menu that opens from a user's own row — the row already says who.
    reactivateUser: "Reactivate",
    suspendUser: "Suspend",
    removeUser: "Remove",

    // Row action toasts
    inviteResentTitle: "Invite resent",
    resetCodeSentTitle: "Reset code sent",
    resetCodeSentDesc: (email: string) => `To ${email}`,
    tempIssuedTitle: "Temporary password issued",
    tempIssuedDesc: (name: string) => `${name} must set their own password at next login`,
    userReactivatedTitle: "User reactivated",
    userSuspendedTitle: "User suspended",
    userSuspendedDesc: (name: string) => `${name} can no longer sign in`,

    // Temporary password badge (status column)
    tempBadge: "Temp password",
    tempBadgeExpired: "Temp password expired",
    tempBadgeTitle: (when: string) => `Issued ${when} — not yet changed by the user`,

    // Temporary password modal — confirm step
    tempModalTitle: "Generate temporary password",
    tempForLabel: "FOR",
    tempConsequenceInvalidate: "Their current password stops working the moment you generate this.",
    tempConsequenceOnce: "The new password is shown once, on the next screen. It is never stored and cannot be looked up again.",
    tempConsequenceMustChange: "They must set a password of their own the first time they log in with it.",
    tempConsequenceExpiry: (hours: number) => `It stops working after ${hours} hours, used or not.`,
    tempGenerate: "Generate",

    // Temporary password modal — result step
    tempResultTitle: "Temporary password",
    tempResultFor: (name: string) => `For ${name}`,
    tempShownOnce: "This is the only time it is shown. Close this box and it is gone.",
    tempCopy: "Copy",
    tempCopied: "Copied",
    tempHandoverTitle: "HANDING IT OVER",
    tempHandover: "Read it out on the internal line, or hand it over in person or on internal messenger.",
    resetPassword: "Reset password",
    sendCode: "Send code",
    deliveryQuestion: "How will you reach them?",
    deliveryMailTitle: "Send it by email",
    deliveryMailHow: "To their own mailbox",
    deliveryMailResult: "They get a code and set their own password. You see nothing.",
    deliveryMailUnavailable: "This installation has no mail server, so nothing can be sent. Configure one under Server & API, or use one of the paths below.",
    deliveryPasswordTitle: "I can tell them the password",
    deliveryPasswordHow: "Internal line, in person, or internal messenger",
    deliveryPasswordResult: "A temporary password is generated and shown to you once.",
    deliveryCodeTitle: "I can only hand over a code",
    deliveryCodeHow: "On paper, or printed",
    deliveryCodeResult: "They set their own password with it — you never see it.",
    setupModalTitle: "Issue setup code",
    setupConfirmIntro: "Use this when a password cannot be handed over safely — the first administrator at an on-premise handover, or anyone you should not read a password out to.",
    setupConsequenceReplace: "Any setup code issued to them earlier stops working.",
    setupConsequenceNoLogin: "The code cannot sign in. It only opens the set-a-password screen, and it is spent once used.",
    setupConsequenceWhere: "They enter it at /register, then choose their own password — you never see it.",
    setupGenerate: "Issue code",
    setupResultTitle: "Setup code",
    setupShownOnce: "You can look this up again from the row menu while it is unused.",
    setupHandoverTitle: "HANDING IT OVER",
    setupHandover: "Print it or hand it over on paper. It is not a password and cannot be used to sign in — but whoever holds it sets the first password, so treat it like one.",
    setupIssuedTitle: "Setup code issued",
    setupIssuedDesc: (name: string) => `${name} sets their own password with it at /register`,
    setupBadge: "Setup code",
    soleAdminTitle: "Only one administrator can sign in",
    soleAdminBody: "Granting permissions is an administrator-only power, and there is no supplier account behind this installation. If this one account is locked out, nobody can grant anything and there is no way back in. Make a second person an administrator.",
    // Two sentences, because this renders as a footnote inside a dropdown. The reasoning behind the
    // rule — with nobody in this role no one can grant permissions and there is no way back in —
    // belongs in isLastActiveAdmin's comment, not in a 280px menu.
    lastAdminReason: "The only administrator who can sign in. Make someone else an administrator first.",
    tempExpires: (hours: number) => `Expires in ${hours} hours`,
    tempDone: "Done",

    // Recovery-mode notice (deployment with no outbound mail)
    recoveryNoticeTitle: "Self-service password reset is off for this installation",
    recoveryNoticeBody: "There is no outbound mail here, so no reset code can be sent to anyone. A locked-out user calls the contact below, and an administrator issues them a temporary password from the row actions.",
    recoveryNoticeContactLabel: "THEY CALL",
    recoveryNoticeContactFallback: "Your security operations team",

    // Invite modal
    modalTitle: "Invite user",
    nameLabel: "Name",
    namePlaceholder: "Full name",
    emailLabel: "Email",
    teamLabel: "Team",
    permissionLabel: "Permission level",
    projectsLabel: "Projects",
    mailNoteBoth: "Invite will be sent by external email for internet-connected projects, and the internal mailbox for internet-isolated ones.",
    mailNoteIsolated: "This project's site is internet-isolated — invite will be sent through its internal mailbox, not external email.",
    mailNoteReachable: "Invite will be sent by external email.",
    cancel: "Cancel",
    sendInvite: "Send Invite",
    inviteSentTitle: "Invite sent",

    // Access requests panel
    accessRequestsTitle: (count: number) => `Access Requests (${count})`,
    approveSelected: (count: number) => `Approve ${count} selected`,
    dismiss: "Dismiss",
    approve: "Approve",
    requestedAgo: (elapsed: string) => `Requested ${elapsed} ago`,
    requestedLoading: "Requested …",
    accessApprovedTitle: "Access approved — invite sent",
    usersInvitedTitle: (count: number) => `${count} users invited`,
    eachWillReceive: "Each will receive their own invite link.",
  },
  ko: {
    // Page header
    title: "사용자 및 권한",
    descScopedPrefix: "",
    descScopedSuffix: "프로젝트에 접근 권한이 있는 사용자를 표시합니다.",
    descUnscoped: "포털(관리자) 또는 앱(운영자) 접근 권한을 부여하고, 사용자가 이용할 프로젝트를 지정하세요.",
    inviteUser: "사용자 초대",
    searchPlaceholder: "사용자 이름 또는 이메일 주소로 검색",

    // Role/status summary strip
    countAdmins: "관리자",
    countOperators: "운영자",
    countInvited: "초대됨",
    countSuspended: "정지됨",
    countTotal: "전체",
    invitedHint: "초대는 됐지만 아직 비밀번호를 설정하지 않았습니다 — 설정 전까지 로그인할 수 없습니다.",
    suspendedHint: "명단에는 남아 있지만 로그인이 차단된 상태입니다.",

    // Toolbar filters
    filterBy: "필터",
    filterAllPermissions: "전체 권한",
    filterAllStatuses: "전체 상태",
    emptyFiltered: "이 필터에 해당하는 사용자가 없습니다.",
    clearFilters: "필터 지우기",

    // Table
    colUser: "사용자",
    colTeam: "팀",
    colProjects: "프로젝트",
    colPermission: "권한",
    colMfa: "MFA",
    colLastLogin: "마지막 로그인",
    colStatus: "상태",
    emptySearch: "검색 결과와 일치하는 사용자가 없습니다.",
    emptyNoUsers: "이 프로젝트에 접근 권한이 있는 사용자가 아직 없습니다.",

    // Permission / status / MFA display labels
    permAdmin: "관리자",
    permOperator: "운영자",
    statusActive: "활성",
    statusInvited: "초대됨",
    statusSuspended: "정지됨",
    mfaEnabledTitle: "MFA 사용 중",

    // Row actions
    resendInvite: "초대 재전송",
    generateTempPassword: "임시 비밀번호 생성",
    resetPassword: "비밀번호 재설정",
    sendCode: "코드 전송",
    deliveryQuestion: "어떻게 전달하시겠어요?",
    deliveryMailTitle: "이메일로 보낼게요",
    deliveryMailHow: "본인 메일함으로",
    deliveryMailResult: "코드를 받아 본인이 비밀번호를 정합니다. 관리자는 아무것도 보지 않습니다.",
    deliveryMailUnavailable: "이 설치에는 메일 서버가 없어 발송할 수 없습니다. Server & API 에서 설정하거나, 아래 방법을 쓰세요.",
    deliveryPasswordTitle: "비밀번호를 직접 알려줄 수 있어요",
    deliveryPasswordHow: "내선 전화 · 대면 · 사내 메신저",
    deliveryPasswordResult: "임시 비밀번호를 만들어 한 번 보여드립니다.",
    deliveryCodeTitle: "코드만 전달할 수 있어요",
    deliveryCodeHow: "종이 · 인쇄물",
    deliveryCodeResult: "본인이 비밀번호를 직접 정합니다 — 관리자는 그 비밀번호를 모릅니다.",
    setupModalTitle: "설치 코드 발급",
    setupConfirmIntro: "비밀번호를 안전하게 전달할 수 없을 때 씁니다 — 온프레미스 인계의 첫 관리자, 또는 비밀번호를 불러줄 수 없는 상대.",
    setupConsequenceReplace: "이전에 발급한 설치 코드는 즉시 무효가 됩니다.",
    setupConsequenceNoLogin: "코드로는 로그인할 수 없습니다. 비밀번호 설정 화면만 열리고, 한 번 쓰면 소진됩니다.",
    setupConsequenceWhere: "/register 에 코드를 넣고 본인이 비밀번호를 정합니다 — 관리자는 그 비밀번호를 모릅니다.",
    setupGenerate: "코드 발급",
    setupResultTitle: "설치 코드",
    setupShownOnce: "사용되기 전까지는 행 메뉴에서 다시 확인할 수 있습니다.",
    setupHandoverTitle: "전달 방법",
    setupHandover: "인쇄하거나 종이로 전달하세요. 비밀번호가 아니어서 로그인은 안 되지만, 이 코드를 가진 사람이 첫 비밀번호를 정합니다 — 비밀번호처럼 다루세요.",
    setupIssuedTitle: "설치 코드 발급됨",
    setupIssuedDesc: (name: string) => `${name} 이 /register 에서 직접 비밀번호를 설정합니다`,
    setupBadge: "설치 코드",
    soleAdminTitle: "로그인 가능한 관리자가 한 명입니다",
    soleAdminBody: "권한 부여는 관리자만 할 수 있고, 이 설치에는 공급사 계정이 없습니다. 이 한 계정이 잠기면 아무도 권한을 부여할 수 없고 되돌릴 방법도 없습니다. 두 번째 관리자를 지정하세요.",
    lastAdminReason: "로그인할 수 있는 유일한 관리자입니다. 다른 사람을 먼저 관리자로 지정하세요.",
    reactivateUser: "재활성화",
    suspendUser: "정지",
    removeUser: "제거",

    // Row action toasts
    inviteResentTitle: "초대 재전송됨",
    resetCodeSentTitle: "재설정 코드 전송됨",
    resetCodeSentDesc: (email: string) => `${email}로 전송됨`,
    tempIssuedTitle: "임시 비밀번호가 발급됨",
    tempIssuedDesc: (name: string) => `${name} 님은 다음 로그인 시 직접 비밀번호를 설정해야 합니다`,
    userReactivatedTitle: "사용자가 재활성화됨",
    userSuspendedTitle: "사용자가 정지됨",
    userSuspendedDesc: (name: string) => `${name} 님은 더 이상 로그인할 수 없습니다`,

    // Temporary password badge (status column)
    tempBadge: "임시 비밀번호",
    tempBadgeExpired: "임시 비밀번호 만료됨",
    tempBadgeTitle: (when: string) => `${when} 발급 — 사용자가 아직 변경하지 않음`,

    // Temporary password modal — confirm step
    tempModalTitle: "임시 비밀번호 생성",
    tempForLabel: "대상",
    tempConsequenceInvalidate: "생성하는 즉시 기존 비밀번호는 사용할 수 없게 됩니다.",
    tempConsequenceOnce: "새 비밀번호는 다음 화면에 한 번만 표시됩니다. 저장되지 않으며 다시 확인할 수 없습니다.",
    tempConsequenceMustChange: "사용자는 이 비밀번호로 처음 로그인할 때 반드시 본인 비밀번호를 새로 설정해야 합니다.",
    tempConsequenceExpiry: (hours: number) => `사용 여부와 관계없이 ${hours}시간 후 만료됩니다.`,
    tempGenerate: "생성",

    // Temporary password modal — result step
    tempResultTitle: "임시 비밀번호",
    tempResultFor: (name: string) => `${name} 님`,
    tempShownOnce: "지금 한 번만 표시됩니다. 이 창을 닫으면 다시 볼 수 없습니다.",
    tempCopy: "복사",
    tempCopied: "복사됨",
    tempHandoverTitle: "전달 방법",
    tempHandover: "내선 전화로 불러주거나, 대면 또는 사내 메신저로 전달하세요.",
    tempExpires: (hours: number) => `${hours}시간 후 만료`,
    tempDone: "완료",

    // Recovery-mode notice (deployment with no outbound mail)
    recoveryNoticeTitle: "이 설치 환경에서는 셀프 비밀번호 재설정이 꺼져 있습니다",
    recoveryNoticeBody: "외부로 나가는 메일이 없어 재설정 코드를 보낼 수 없습니다. 로그인하지 못하는 사용자는 아래 연락처로 문의하고, 관리자가 행 메뉴에서 임시 비밀번호를 발급해 전달합니다.",
    recoveryNoticeContactLabel: "문의처",
    recoveryNoticeContactFallback: "관제 센터 보안 관리자",

    // Invite modal
    modalTitle: "사용자 초대",
    nameLabel: "이름",
    namePlaceholder: "전체 이름",
    emailLabel: "이메일",
    teamLabel: "팀",
    permissionLabel: "권한 수준",
    projectsLabel: "프로젝트",
    mailNoteBoth: "인터넷에 연결된 프로젝트에는 외부 이메일로, 인터넷이 차단된 프로젝트에는 내부 메일함으로 초대장이 발송됩니다.",
    mailNoteIsolated: "이 프로젝트의 사이트는 인터넷이 차단되어 있습니다 — 초대장은 외부 이메일이 아닌 내부 메일함으로 발송됩니다.",
    mailNoteReachable: "초대장이 외부 이메일로 발송됩니다.",
    cancel: "취소",
    sendInvite: "초대 보내기",
    inviteSentTitle: "초대장 발송됨",

    // Access requests panel
    accessRequestsTitle: (count: number) => `접근 요청 (${count}건)`,
    approveSelected: (count: number) => `선택한 ${count}건 승인`,
    dismiss: "무시",
    approve: "승인",
    requestedAgo: (elapsed: string) => `${elapsed} 전 요청됨`,
    requestedLoading: "요청됨 …",
    accessApprovedTitle: "접근 승인됨 — 초대장 발송됨",
    usersInvitedTitle: (count: number) => `${count}명의 사용자 초대됨`,
    eachWillReceive: "각자 개별 초대 링크를 받게 됩니다.",
  },
} as const;

function InviteUserModal({ defaultProjectId, onClose }: { defaultProjectId: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const addPortalUser = useVcaStore(s => s.addPortalUser);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Defaults to the team that owns the project this page is scoped to — not teams[0]. With more
  // than one team in the installation those are different answers, and the first one silently
  // filed an invite under a team the admin was not even looking at.
  const [teamId, setOrgId] = useState(
    () => projects.find(p => p.id === defaultProjectId)?.teamId ?? teams[0]?.id ?? ""
  );
  const [permission, setPermission] = useState<PortalPermission>("operator");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);

  const toggleProject = (id: string) =>
    setProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  // Only the chosen team's projects can be ticked. A project belongs to exactly one team, so
  // granting access to another team's project would file the user under one team and let them into
  // another. Changing the team therefore also drops any tick that no longer belongs.
  const teamProjects = projects.filter(p => p.teamId === teamId);
  const changeTeam = (nextTeamId: string) => {
    setOrgId(nextTeamId);
    setProjectIds(prev => prev.filter(id => projects.find(p => p.id === id)?.teamId === nextTeamId));
  };

  // Every invite goes through the same flow (admin sets no password — the user verifies by email
  // and sets their own) regardless of deployment — every deployment is on-premise (see
  // getAuthConfig()'s doc comment) — only the mail transport changes. A project on an
  // internet-isolated site can't reach an external mail provider, so that one routes through the
  // project's internal mailbox instead. See the 2026-08-28 backend-meeting decision this mirrors.
  const selectedProjects = teamProjects.filter(p => projectIds.includes(p.id));
  const hasIsolated = selectedProjects.some(isNetworkIsolated);
  const hasReachable = selectedProjects.some(p => !isNetworkIsolated(p));
  const mailTransportNote = selectedProjects.length === 0
    ? null
    : hasIsolated && hasReachable
      ? t.mailNoteBoth
      : hasIsolated
        ? t.mailNoteIsolated
        : t.mailNoteReachable;

  const submit = () => {
    if (!name.trim() || !email.trim() || !teamId) return;
    const id = addPortalUser({ name: name.trim(), email: email.trim(), teamId, projectIds, permission, status: "invited" });
    showToast({ variant: "success", title: t.inviteSentTitle, desc: `/password-setup?token=${id}` });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.modalTitle}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t.namePlaceholder}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.emailLabel}</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@univs.ai" type="email"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.teamLabel}</label>
            <FilterSelect value={teamId} onChange={changeTeam} options={teams.map(o => ({ value: o.id, label: o.name }))} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.permissionLabel}</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["admin", "operator"] as PortalPermission[]).map(perm => (
                <button key={perm} onClick={() => setPermission(perm)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer", textTransform: "capitalize",
                    border: permission === perm ? "1px solid var(--gray-900)" : BORDER,
                    backgroundColor: permission === perm ? "var(--gray-100)" : "white",
                    color: permission === perm ? "var(--gray-900)" : "var(--gray-600)",
                    fontSize: "13px", fontWeight: 700,
                  }}>
                  {perm === "admin" ? t.permAdmin : t.permOperator}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.projectsLabel}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {teamProjects.map(p => {
                const active = projectIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleProject(p.id)}
                    style={{
                      padding: "6px 10px", borderRadius: "999px", cursor: "pointer",
                      border: active ? "1px solid var(--gray-900)" : BORDER,
                      backgroundColor: active ? "var(--gray-100)" : "white",
                      color: active ? "var(--gray-900)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {p.name}
                  </button>
                );
              })}
            </div>
            {mailTransportNote && (
              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "8px" }}>{mailTransportNote}</p>
            )}
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={submit} disabled={!name.trim() || !email.trim()}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: (name.trim() && email.trim()) ? "pointer" : "not-allowed", opacity: (name.trim() && email.trim()) ? 1 : 0.5 }}>
            {t.sendInvite}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The administrator half of the no-mail recovery path (authConfig's passwordRecovery: "adminOnly"):
 * the operator telephones the security desk, and the desk sets a password for them and reads it
 * back down the line. It is also the escape hatch in a mail-enabled deployment for the person who
 * can no longer open their own mailbox — which is why the action is not hidden when mail works.
 *
 * Two steps in one box, and the split is the point. Setting someone else's credential is not
 * undoable and cuts them off from their current password immediately, so the first step states
 * what is about to happen while there is still a Cancel; the second shows the result, once. There
 * is no route back to step one, because a second look at the same password does not exist — a
 * lost password is reissued, not recovered.
 */
function TempPasswordModal({ user, mailAvailable, onClose }: { user: PortalUser; mailAvailable: boolean; onClose: () => void }) {
  useEscapeKey(onClose);
  const issueTemporaryPassword = useVcaStore(s => s.issueTemporaryPassword);
  const issueSetupCode = useVcaStore(s => s.issueSetupCode);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /* Chosen here rather than in the row menu. Both paths do the same job — hand this person a way
     in — so two menu entries made the administrator learn the difference between a temporary
     password and a setup code before they could pick one. Asked as a question about their own
     situation instead: can you tell this person a password, or can you only pass them a slip of
     paper? The mechanism follows from the answer. */
  // Mail first where it exists, and the default: it is the only path on which the administrator
  // never learns the person's password.
  const [kind, setKind] = useState<CredentialKind>(mailAvailable ? "mail" : "password");

  /* The two credentials share this box because the careful parts are identical — a confirm step
     before an irreversible action, a result shown once, a clipboard write that only claims success
     once it resolves. Only the words and the store call differ, and duplicating the box would let
     the two drift. */
  const c = kind === "mail"
    ? {
        modalTitle: t.resetPassword, intro: undefined as string | undefined, generate: t.sendCode,
        resultTitle: t.resetCodeSentTitle, note: "",
        handoverTitle: "", handover: "",
        consequences: [] as string[],
        showExpiry: false,
      }
    : kind === "password"
    ? {
        // No intro line: the consequence list below says the same thing more precisely, and a
        // sentence that only restates the bullets pushes them further from the button.
        modalTitle: t.tempModalTitle, intro: undefined as string | undefined, generate: t.tempGenerate,
        resultTitle: t.tempResultTitle, note: t.tempShownOnce,
        handoverTitle: t.tempHandoverTitle, handover: t.tempHandover,
        consequences: [
          t.tempConsequenceInvalidate, t.tempConsequenceOnce,
          t.tempConsequenceMustChange, t.tempConsequenceExpiry(TEMP_PASSWORD_VALIDITY_HOURS),
        ],
        showExpiry: true,
      }
    : {
        modalTitle: t.setupModalTitle, intro: t.setupConfirmIntro, generate: t.setupGenerate,
        resultTitle: t.setupResultTitle, note: t.setupShownOnce,
        handoverTitle: t.setupHandoverTitle, handover: t.setupHandover,
        consequences: [
          t.setupConsequenceReplace, t.setupConsequenceNoLogin, t.setupConsequenceWhere,
        ],
        // No expiry line: nothing here expires setup codes yet, and stating a lifetime the system
        // does not enforce would be worse than saying nothing. HANDOFF NOTE: the backend should
        // expire them, and then this becomes true and can be shown.
        showExpiry: false,
      };

  const generate = () => {
    // Mail has no second step: nothing is shown to the administrator, which is the whole point of
    // that path. Confirm, send, close.
    if (kind === "mail") {
      // HANDOFF NOTE: posts nowhere. The real call asks the backend to mail a reset code, and the
      // OPEN QUESTION from before still stands — if the person then uses "Forgot password?"
      // themselves they request a second code, invalidating this one.
      showToast({ variant: "success", title: t.resetCodeSentTitle, desc: t.resetCodeSentDesc(user.email) });
      onClose();
      return;
    }
    const issued = kind === "password" ? issueTemporaryPassword(user.id) : issueSetupCode(user.id);
    if (!issued) return;
    setPassword(issued);
    showToast({
      variant: "success",
      title: kind === "password" ? t.tempIssuedTitle : t.setupIssuedTitle,
      desc: kind === "password" ? t.tempIssuedDesc(user.name) : t.setupIssuedDesc(user.name),
    });
  };

  // Clipboard write can be refused (an insecure origin, or the browser's permission), and a "Copied"
  // label over a clipboard that did not take is how a password gets pasted as whatever was there
  // before. Only flip the label once the write actually resolved; on failure the password is still
  // on screen to read off.
  const copy = () => {
    if (!password) return;
    navigator.clipboard?.writeText(password).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => setCopied(false),
    );
  };

  const bullet = (text: string) => (
    <li style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7 }}>{text}</li>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {password ? c.resultTitle : c.modalTitle}
          </p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {password === null ? (
          <>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{t.tempForLabel}</p>
                <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)", marginTop: "4px" }}>{user.name}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{user.email}</p>
              </div>
              {c.intro && (
                <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7 }}>{c.intro}</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-700)" }}>{t.deliveryQuestion}</p>
                {([
                  // Kept in the list when unavailable rather than dropped, with the reason on the
                  // card: an option that vanishes reads as a missing feature, and the administrator
                  // goes hunting for it. "Exists, not here" is the accurate thing to say.
                  { value: "mail" as CredentialKind, title: t.deliveryMailTitle, how: t.deliveryMailHow, result: t.deliveryMailResult, unavailable: !mailAvailable, why: t.deliveryMailUnavailable },
                  { value: "password" as CredentialKind, title: t.deliveryPasswordTitle, how: t.deliveryPasswordHow, result: t.deliveryPasswordResult, unavailable: false, why: "" },
                  { value: "code" as CredentialKind, title: t.deliveryCodeTitle, how: t.deliveryCodeHow, result: t.deliveryCodeResult, unavailable: false, why: "" },
                ]).map(opt => {
                  const on = kind === opt.value && !opt.unavailable;
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex", gap: "10px", alignItems: "flex-start",
                        cursor: opt.unavailable ? "default" : "pointer",
                        padding: "12px 14px", borderRadius: "10px",
                        border: on ? "1px solid var(--primary-300)" : "1px solid var(--gray-300)",
                        backgroundColor: on ? "var(--primary-50)" : opt.unavailable ? "var(--gray-50)" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="credential-kind"
                        checked={on}
                        disabled={opt.unavailable}
                        onChange={() => setKind(opt.value)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--primary-400)", cursor: opt.unavailable ? "default" : "pointer", marginTop: "1px", flexShrink: 0 }}
                      />
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: opt.unavailable ? "var(--gray-400)" : "var(--gray-900)" }}>{opt.title}</p>
                        <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{opt.how}</p>
                        {/* What happens if you pick this, on the card itself. Deciding then finding
                            out is how an administrator ends up reading a password down a phone line
                            they meant to avoid. */}
                        <p style={{ fontSize: "12px", color: opt.unavailable ? "var(--gray-400)" : "var(--gray-700)", marginTop: "5px", lineHeight: 1.6 }}>
                          {opt.unavailable ? opt.why : opt.result}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <ul style={{ display: "flex", flexDirection: "column", gap: "6px", margin: 0, paddingLeft: "18px" }}>
                {c.consequences.map(line => bullet(line))}
              </ul>
            </div>
            <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
              <button onClick={generate}
                style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {c.generate}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.tempResultFor(user.name)}</p>

              {/* Monospace and letter-spaced because this string gets read aloud a character at a
                  time. user-select stays on: the copy button is a convenience, not the only way
                  to get it out of the box. */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "10px", border: "1px solid var(--gray-300)", backgroundColor: "var(--gray-50)" }}>
                <code style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "18px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "1px", wordBreak: "break-all" }}>
                  {password}
                </code>
                <button onClick={copy}
                  style={{ flexShrink: 0, padding: "7px 12px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: copied ? "var(--success-400)" : "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                  {copied ? t.tempCopied : t.tempCopy}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: c.showExpiry ? "var(--warning-500)" : "var(--gray-600)" }}>{c.note}</p>
                {c.showExpiry && <span style={{ flexShrink: 0, fontSize: "12px", color: "var(--gray-500)" }}>{t.tempExpires(TEMP_PASSWORD_VALIDITY_HOURS)}</span>}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: c.showExpiry ? "var(--warning-100)" : "var(--info-100)" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: c.showExpiry ? "var(--warning-500)" : "var(--info-500)", letterSpacing: "0.4px" }}>{c.handoverTitle}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.7, marginTop: "4px" }}>{c.handover}</p>
              </div>
            </div>
            <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose}
                style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.tempDone}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** How the way-back-in reaches the person. Mail sends a code they redeem themselves; password is
 *  read out; code is handed over on paper. */
type CredentialKind = "mail" | "password" | "code";

const STATUS_COLORS: Record<PortalUserStatus, { bg: string; color: string }> = {
  active: { bg: "var(--gray-100)", color: "var(--success-400)" },
  invited: { bg: "var(--warning-200)", color: "var(--warning-500)" },
  suspended: { bg: "var(--danger-100)", color: "var(--danger-500)" },
};

function StatusBadge({ status }: { status: PortalUserStatus }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const { bg, color } = STATUS_COLORS[status];
  const label = status === "active" ? t.statusActive : status === "invited" ? t.statusInvited : t.statusSuspended;
  return (
    <span style={{
      fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", textTransform: "capitalize",
      backgroundColor: bg, color,
    }}>
      {label}
    </span>
  );
}

function MfaBadge({ enabled }: { enabled?: boolean }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  if (!enabled) return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>;
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "5px", backgroundColor: "var(--success-100)" }} title={t.mfaEnabledTitle}>
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--success-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}

/**
 * Shows in the status column while an account is still on a password an administrator handed over.
 * That state is worth seeing at a glance: for as long as it lasts, two people know the password,
 * and the account is only as private as the phone call it travelled on. It disappears the moment
 * the user sets their own.
 *
 * Once past the expiry the wording changes rather than the badge vanishing — an expired temporary
 * password means the person never used it and is still locked out, which is precisely when an
 * administrator needs to notice them.
 */
function TempPasswordBadge({ issuedAt }: { issuedAt: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  // Read after mount for the same reason as AccessRequestsPanel: expiry is a comparison against
  // the clock, and doing it during render makes the server's frame disagree with the browser's.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const issuedMs = new Date(issuedAt).getTime();
  const expiresMs = issuedMs + TEMP_PASSWORD_VALIDITY_HOURS * 60 * 60 * 1000;
  const expired = nowMs !== null && nowMs > expiresMs;
  const tone = expired
    ? { bg: "var(--danger-100)", color: "var(--danger-500)" }
    : { bg: "var(--warning-200)", color: "var(--warning-500)" };

  return (
    <span
      title={t.tempBadgeTitle(new Date(issuedAt).toLocaleString())}
      style={{
        display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "999px",
        backgroundColor: tone.bg, color: tone.color, fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap",
      }}
    >
      {expired ? t.tempBadgeExpired : t.tempBadge}
    </span>
  );
}

/**
 * Standing explanation of why this page's mail actions are missing, shown only where they are.
 * Without it the absence reads as a bug, and an administrator hunting for "send password reset"
 * has no way to learn that the temporary-password action IS the reset here.
 */
function RecoveryModeNotice({ supportContact }: { supportContact: string | null }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  return (
    <div style={{ display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "12px", backgroundColor: "var(--info-100)", border: "1px solid var(--info-200)", marginBottom: "16px" }}>
      <span style={{ flexShrink: 0, display: "flex", color: "var(--info-500)", marginTop: "1px" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7.2v4M8 5.1v.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </span>
      <div>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.recoveryNoticeTitle}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7, marginTop: "4px" }}>{t.recoveryNoticeBody}</p>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px", marginTop: "10px" }}>{t.recoveryNoticeContactLabel}</p>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-800)", marginTop: "2px" }}>
          {supportContact ?? t.recoveryNoticeContactFallback}
        </p>
      </div>
    </div>
  );
}

/**
 * The master's inbox for /request-access. Renders nothing unless the deployment actually offers
 * that way in — with it off (the on-premise default, see authConfig's accessRequest) no request can
 * ever arrive, and an empty queue titled "Access Requests" implies a door that is not there.
 */
function AccessRequestsPanel({ projectId }: { projectId: string }) {
  const accessRequests = useVcaStore(s => s.accessRequests);
  const approveAccessRequests = useVcaStore(s => s.approveAccessRequests);
  const dismissAccessRequest = useVcaStore(s => s.dismissAccessRequest);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [selected, setSelected] = useState<string[]>([]);
  // Read after mount, not during render — see ProjectLicenseTab for the same pattern. Only used
  // for the "requested Xm ago" label, so a first-frame mismatch here would just be cosmetic, but
  // staying consistent avoids surprises.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const requests = accessRequests.filter(r => r.projectId === projectId);
  // Requests already in flight still show if the flag is turned off later — abandoning people who
  // asked while the door was open would be worse than the inconsistency.
  if (!getAuthConfig().accessRequest && requests.length === 0) return null;
  if (requests.length === 0) return null;

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = requests.length > 0 && requests.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allSelected ? [] : requests.map(r => r.id));

  const approve = (ids: string[]) => {
    const newUserIds = approveAccessRequests(ids);
    setSelected(prev => prev.filter(id => !ids.includes(id)));
    if (newUserIds.length === 1) {
      showToast({ variant: "success", title: t.accessApprovedTitle, desc: `/password-setup?token=${newUserIds[0]}` });
    } else if (newUserIds.length > 1) {
      showToast({ variant: "success", title: t.usersInvitedTitle(newUserIds.length), desc: t.eachWillReceive });
    }
  };

  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: BORDER, backgroundColor: "var(--gray-50)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "var(--gray-900)" }} />
          </label>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.accessRequestsTitle(requests.length)}</p>
        </div>
        {selected.length > 0 && (
          <button onClick={() => approve(selected)}
            style={{ padding: "7px 14px", borderRadius: "999px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            {t.approveSelected(selected.length)}
          </button>
        )}
      </div>
      <div>
        {requests.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 16px", borderTop: i > 0 ? BORDER : "none" }}>
            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)}
              style={{ accentColor: "var(--gray-900)", marginTop: "3px" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{r.name}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{r.email}</p>
              </div>
              {r.reason && <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{r.reason}</p>}
              <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px" }}>
                {nowMs !== null ? t.requestedAgo(formatElapsed(nowMs - new Date(r.requestedAt).getTime())) : t.requestedLoading}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button onClick={() => dismissAccessRequest(r.id)}
                style={{ padding: "7px 12px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                {t.dismiss}
              </button>
              <button onClick={() => approve([r.id])}
                style={{ padding: "7px 12px", borderRadius: "999px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                {t.approve}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Who is on this project, broken out by role and by the two states that need an administrator to do
 * something about them. Modelled on Vimeo's Members header, which puts the same strip above its
 * table — the point is that you learn whether there is anything to act on before you read a single
 * row, which a table alone cannot tell you.
 *
 * Plain figures on the page rather than four more cards: this sits directly above a table and a row
 * of boxes there would compete with it. The two actionable counts carry a title explaining what the
 * state means, because "Invited: 3" only reads as a to-do if you know an invited account cannot
 * sign in yet.
 */
function UserCountStrip({ users }: { users: PortalUser[] }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const counts = [
    { label: t.countAdmins, value: users.filter(u => u.permission === "admin").length },
    { label: t.countOperators, value: users.filter(u => u.permission === "operator").length },
    { label: t.countInvited, value: users.filter(u => u.status === "invited").length, hint: t.invitedHint, actionable: true },
    { label: t.countSuspended, value: users.filter(u => u.status === "suspended").length, hint: t.suspendedHint, actionable: true },
    { label: t.countTotal, value: users.length },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "32px", marginBottom: "16px" }}>
      {counts.map(c => (
        <div key={c.label} title={c.hint}>
          <p style={{
            fontSize: "20px", fontWeight: 800,
            // A zero here is good news (nobody stuck, nobody blocked), so it is not worth the same
            // ink as a number you have to do something about.
            color: c.actionable && c.value > 0 ? "var(--warning-500)" : c.value === 0 ? "var(--gray-300)" : "var(--gray-900)",
          }}>
            {c.value}
          </p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{c.label}</p>
        </div>
      ))}
    </div>
  );
}

interface PortalUsersPageProps {
  /** Scopes the table to users who have access to this project — mirrors Clerk's per-application Users tab. */
  projectId: string;
}

export default function PortalUsersPage({ projectId }: PortalUsersPageProps) {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const updatePortalUserPermission = useVcaStore(s => s.updatePortalUserPermission);
  const updatePortalUserStatus = useVcaStore(s => s.updatePortalUserStatus);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [showInvite, setShowInvite] = useState(false);
  // The user a temporary password is being issued for, or null. Held as the user rather than an id
  // so the modal keeps rendering the right name even if the row scrolls out from under it.
  const [credentialFor, setCredentialFor] = useState<PortalUser | null>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [permissionFilter, setPermissionFilter] = useState<PortalPermission | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<PortalUserStatus | "ALL">("ALL");

  // Which recovery path this installation actually has. Everything mail-dependent on this page is
  // gated on it, because a "Send password reset" that quietly posts to nowhere is worse than no
  // button: the administrator hangs up believing the operator has a code coming.
  //
  // HANDOFF NOTE — the ?recovery=adminOnly override goes away with the hardcoded config.
  // getAuthConfig() is fixed at "emailCode", so the no-mail half of this page cannot be reached by
  // using the app; open /portal?...&recovery=adminOnly to see what a site with no SMTP relay gets.
  // Same convention as /forgot-password?demo=adminOnly, which is the login-side half of it.
  const authConfig = getAuthConfig();
  const recoveryOverride = useSearchParams().get("recovery");
  const mailAvailable = recoveryOverride === "adminOnly" ? false : hasOutboundMail(authConfig);

  const orgName = (teamId: string) => teams.find(o => o.id === teamId)?.name ?? teamId;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const currentProject = projects.find(p => p.id === projectId);
  const q = search.trim().toLowerCase();
  // Split in two: the strip above the table counts everyone on the project, the table shows what is
  // left after filtering. Counting the filtered set instead would make the summary agree with the
  // table and stop being a summary — filter to "Suspended" and it would proudly report zero admins.
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));
  const filtersActive = permissionFilter !== "ALL" || statusFilter !== "ALL";
  const scopedUsers = projectUsers
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .filter(u => permissionFilter === "ALL" || u.permission === permissionFilter)
    .filter(u => statusFilter === "ALL" || u.status === statusFilter);

  return (
    <div>
      {/* Stays up until a second administrator exists. Not dismissible: it is not a tip, it is a
          single point of failure with no recovery path — the supplier has no account here, so
          losing the one administrator ends the customer's ability to grant anything. Counted across
          all users, not the filtered view. */}
      {portalUsers.filter(u => u.permission === "admin" && u.status === "active").length <= 1 && (
        <div style={{
          display: "flex", gap: "12px", alignItems: "flex-start",
          padding: "14px 16px", borderRadius: "12px", marginBottom: "16px",
          backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-200)",
        }}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: "1px", color: "var(--warning-500)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.8 1.5 13.2h13L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M8 6v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="8" cy="11.2" r="0.75" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--gray-900)" }}>{t.soleAdminTitle}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.7, marginTop: "3px" }}>
              {t.soleAdminBody}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "4px" }}>
            {currentProject
              ? (lang === "ko"
                ? <><strong style={{ color: "var(--gray-600)" }}>{currentProject.name}</strong> {t.descScopedSuffix}</>
                : <>{t.descScopedPrefix} <strong style={{ color: "var(--gray-600)" }}>{currentProject.name}</strong>.</>)
              : t.descUnscoped}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          {t.inviteUser}
        </button>
      </div>

      {!mailAvailable && <RecoveryModeNotice supportContact={authConfig.supportContact} />}

      <UserCountStrip users={projectUsers} />

      <AccessRequestsPanel projectId={projectId} />

      {/* Search on the left, filters on the right — the Vimeo Members arrangement, and the same one
          the Cameras tab already uses, so the two toolbars in Portal finally read the same way. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
      <div style={{ position: "relative", flex: 1, minWidth: "220px", maxWidth: "320px" }}>
        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: "100%", boxSizing: "border-box", height: CONTROL_HEIGHT, padding: "0 10px 0 30px", borderRadius: "10px",
            border: searchFocused ? "1px solid var(--gray-900)" : BORDER, outline: "none",
            boxShadow: searchFocused ? "0 0 0 3px var(--gray-100)" : "none",
            fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
          }}
        />
      </div>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", flexShrink: 0 }}>{t.filterBy}</span>
        <FilterSelect
          value={permissionFilter}
          onChange={v => setPermissionFilter(v as PortalPermission | "ALL")}
          options={[
            { value: "ALL", label: t.filterAllPermissions },
            { value: "admin", label: t.permAdmin },
            { value: "operator", label: t.permOperator },
          ]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as PortalUserStatus | "ALL")}
          options={[
            { value: "ALL", label: t.filterAllStatuses },
            { value: "active", label: t.statusActive },
            { value: "invited", label: t.statusInvited },
            { value: "suspended", label: t.statusSuspended },
          ]}
        />
      </div>

      {/* No overflow:hidden here — it used to clip the header row's flat corners to match the
          card's rounded ones, but that also clips any row's RowActionsMenu dropdown that opens
          past the container's bottom edge (invisible, not just cut off). Radius the header row
          itself instead. */}
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.4fr 0.6fr 0.5fr 0.9fr 0.8fr 36px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
          {[t.colUser, t.colTeam, t.colProjects, t.colPermission, t.colMfa, t.colLastLogin, t.colStatus, ""].map((h, i) => (
            <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
          ))}
        </div>
        {scopedUsers.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
              {q ? t.emptySearch : filtersActive ? t.emptyFiltered : t.emptyNoUsers}
            </p>
            {/* A filter that hides everyone looks identical to a project with no users, and the way
                out is not discoverable from the empty table. Offer it here. */}
            {filtersActive && (
              <button
                onClick={() => { setPermissionFilter("ALL"); setStatusFilter("ALL"); }}
                style={{ marginTop: "10px", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}
              >
                {t.clearFilters}
              </button>
            )}
          </div>
        )}
        {scopedUsers.map((u, i) => {
          const isLast = i === scopedUsers.length - 1;
          // Computed against the whole user list, not the filtered view: a project filter can hide
          // the other administrators, and "last one visible" is not "last one there is".
          const lastAdmin = isLastActiveAdmin(portalUsers, u.id);
          return (
          <div key={u.id} style={{
            display: "grid", gridTemplateColumns: "1.5fr 1fr 1.4fr 0.6fr 0.5fr 0.9fr 0.8fr 36px", columnGap: TABLE_COLUMN_GAP, padding: "12px 16px", alignItems: "center",
            borderBottom: isLast ? "none" : BORDER,
            borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
          }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{u.name}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{u.email}</p>
            </div>
            <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{orgName(u.teamId)}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {u.projectIds.length === 0
                ? <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
                : u.projectIds.map((pid, i) => (
                  <span key={pid} style={{
                    fontSize: "12px",
                    fontWeight: pid === projectId ? 700 : 400,
                    color: pid === projectId ? "var(--gray-900)" : "var(--gray-500)",
                  }}>
                    {i > 0 && <span style={{ color: "var(--gray-300)" }}>, </span>}
                    {projectName(pid)}
                  </span>
                ))}
            </div>
            <FilterSelect
              fitContent
              value={u.permission}
              onChange={v => updatePortalUserPermission(u.id, v as PortalPermission)}
              options={[{ value: "admin", label: t.permAdmin }, { value: "operator", label: t.permOperator }]}
            />
            <MfaBadge enabled={u.mfaEnabled} />
            <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{u.lastLoginAt ?? "—"}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
              <StatusBadge status={u.status} />
              {u.tempPasswordIssuedAt && <TempPasswordBadge issuedAt={u.tempPasswordIssuedAt} />}
            </div>
            {/* Two mail actions, because the two ways a person gets locked out need different
                messages: an invite that never arrived is resent, an account whose password is
                forgotten gets a reset. Resend only shows for users still sitting at "invited" —
                offering it for an active account would send a link that sets up an account which
                already exists. Both disappear entirely where there is no mail to send them with;
                that deployment recovers people through the temporary password below instead. */}
            <RowActionsMenu actions={[
              ...(mailAvailable && u.status === "invited" ? [{
                label: t.resendInvite,
                onClick: () => showToast({ variant: "success", title: t.inviteResentTitle, desc: `/password-setup?token=${u.id}` }),
              }] : []),
              {
                // All three recovery paths behind one entry. Mailing a code, reading out a temporary
                // password and handing over a setup code do the same job — give this person a way
                // back in — and differ only in how it reaches them. Three menu items made the
                // administrator choose a mechanism; one item asks how they can reach the person and
                // derives the mechanism from that.
                label: t.resetPassword,
                onClick: () => setCredentialFor(u),
              },
              u.status === "suspended"
                ? {
                    label: t.reactivateUser,
                    onClick: () => {
                      updatePortalUserStatus(u.id, "active");
                      showToast({ variant: "success", title: t.userReactivatedTitle, desc: u.name });
                    },
                  }
                : {
                    label: t.suspendUser,
                    onClick: () => {
                      updatePortalUserStatus(u.id, "suspended");
                      showToast({ variant: "warning", title: t.userSuspendedTitle, desc: t.userSuspendedDesc(u.name) });
                    },
                    danger: true,
                    // Refused, not warned about: this deployment is on-premise with the top
                    // administrator on the customer's side, so there is no supplier account to
                    // undo it with. The store refuses these too — see isLastActiveAdmin.
                    disabled: lastAdmin,
                    reason: lastAdmin ? t.lastAdminReason : undefined,
                  },
              {
                label: t.removeUser, onClick: () => removePortalUser(u.id), danger: true,
                disabled: lastAdmin,
                reason: lastAdmin ? t.lastAdminReason : undefined,
              },
            ]} />
          </div>
          );
        })}
      </div>

      {showInvite && <InviteUserModal defaultProjectId={projectId} onClose={() => setShowInvite(false)} />}
      {credentialFor && (
        <TempPasswordModal user={credentialFor} mailAvailable={mailAvailable} onClose={() => setCredentialFor(null)} />
      )}
    </div>
  );
}
