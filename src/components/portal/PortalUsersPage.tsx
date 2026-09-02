"use client";

import { useEffect, useState } from "react";
import { useVcaStore, isNetworkIsolated, type PortalPermission, type PortalUserStatus } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { useToast } from "../Toast";
import { BORDER, CONTROL_HEIGHT, PANEL_SHADOW, RowActionsMenu, FilterSelect } from "./PortalShared";
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
    sendPasswordReset: "Send password reset",
    generateTempPassword: "Generate temporary password",
    reactivateUser: "Reactivate user",
    suspendUser: "Suspend user",
    removeUser: "Remove user",

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
    tempConfirmIntro: "Use this when the person cannot receive a reset code — no mail server here, or they have lost access to their mailbox.",
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
    tempHandover: "Read it out on the internal line, or hand it over in person or on internal messenger. Do not email it — mail is exactly what this path exists to avoid.",
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
    sendPasswordReset: "비밀번호 재설정 코드 전송",
    generateTempPassword: "임시 비밀번호 생성",
    reactivateUser: "사용자 재활성화",
    suspendUser: "사용자 정지",
    removeUser: "사용자 제거",

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
    tempConfirmIntro: "재설정 코드를 받을 수 없는 경우에 사용하세요 — 메일 서버가 없거나, 본인 메일함에 접근할 수 없는 상황입니다.",
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
    tempHandover: "내선 전화로 불러주거나, 대면 또는 사내 메신저로 전달하세요. 이메일로는 보내지 마세요 — 메일을 쓸 수 없어서 존재하는 경로입니다.",
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
  const [teamId, setOrgId] = useState(teams[0]?.id ?? "");
  const [permission, setPermission] = useState<PortalPermission>("operator");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);

  const toggleProject = (id: string) =>
    setProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  // Every invite goes through the same flow (admin sets no password — the user verifies by email
  // and sets their own) regardless of deployment — every deployment is on-premise (see
  // getAuthConfig()'s doc comment) — only the mail transport changes. A project on an
  // internet-isolated site can't reach an external mail provider, so that one routes through the
  // project's internal mailbox instead. See the 2026-08-28 backend-meeting decision this mirrors.
  const selectedProjects = projects.filter(p => projectIds.includes(p.id));
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
            <FilterSelect value={teamId} onChange={setOrgId} options={teams.map(o => ({ value: o.id, label: o.name }))} />
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
              {projects.map(p => {
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
    <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
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
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const orgName = (teamId: string) => teams.find(o => o.id === teamId)?.name ?? teamId;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const currentProject = projects.find(p => p.id === projectId);
  const q = search.trim().toLowerCase();
  const scopedUsers = portalUsers
    .filter(u => u.projectIds.includes(projectId))
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <div>
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

      <AccessRequestsPanel projectId={projectId} />

      <div style={{ position: "relative", marginBottom: "12px", maxWidth: "320px" }}>
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
            border: searchFocused ? "1px solid var(--gray-400)" : BORDER, outline: "none",
            boxShadow: searchFocused ? "0 0 0 3px var(--gray-100)" : "none",
            fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
          }}
        />
      </div>

      {/* No overflow:hidden here — it used to clip the header row's flat corners to match the
          card's rounded ones, but that also clips any row's RowActionsMenu dropdown that opens
          past the container's bottom edge (invisible, not just cut off). Radius the header row
          itself instead. */}
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.3fr 0.9fr 0.5fr 0.9fr 0.8fr 36px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
          {[t.colUser, t.colTeam, t.colProjects, t.colPermission, t.colMfa, t.colLastLogin, t.colStatus, ""].map((h, i) => (
            <span key={i} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
          ))}
        </div>
        {scopedUsers.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
              {q ? t.emptySearch : t.emptyNoUsers}
            </p>
          </div>
        )}
        {scopedUsers.map((u, i) => {
          const isLast = i === scopedUsers.length - 1;
          return (
          <div key={u.id} style={{
            display: "grid", gridTemplateColumns: "1.4fr 1fr 1.3fr 0.9fr 0.5fr 0.9fr 0.8fr 36px", padding: "12px 16px", alignItems: "center",
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
              value={u.permission}
              onChange={v => updatePortalUserPermission(u.id, v as PortalPermission)}
              options={[{ value: "admin", label: t.permAdmin }, { value: "operator", label: t.permOperator }]}
            />
            <MfaBadge enabled={u.mfaEnabled} />
            <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{u.lastLoginAt ?? "—"}</span>
            <StatusBadge status={u.status} />
            {/* Two mail actions, because the two ways a person gets locked out need different
                messages: an invite that never arrived is resent, an account whose password is
                forgotten gets a reset. Resend only shows for users still sitting at "invited" —
                offering it for an active account would send a link that sets up an account which
                already exists. */}
            <RowActionsMenu actions={[
              ...(u.status === "invited" ? [{
                label: t.resendInvite,
                onClick: () => showToast({ variant: "success", title: t.inviteResentTitle, desc: `/password-setup?token=${u.id}` }),
              }] : []),
              {
                label: t.sendPasswordReset,
                // Says "code", not "link": /forgot-password now verifies an 8-digit code instead of
                // following an emailed link. OPEN QUESTION for the backend — if the user then uses
                // "Forgot password?" themselves they request a second code, which invalidates this
                // one. Either this action mails the code and the mail says where to type it, or it
                // does nothing but tell the user to start the flow themselves.
                onClick: () => showToast({ variant: "success", title: t.resetCodeSentTitle, desc: t.resetCodeSentDesc(u.email) }),
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
                  },
              { label: t.removeUser, onClick: () => removePortalUser(u.id), danger: true },
            ]} />
          </div>
          );
        })}
      </div>

      {showInvite && <InviteUserModal defaultProjectId={projectId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
