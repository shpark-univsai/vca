"use client";

import { useEffect, useState } from "react";
import { Asterisk, ClipboardList, MailQuestion, Users2, UserX, ClipboardPlus, Download, KeyRound, Printer, Upload} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, isNetworkIsolated, isLastActiveAdmin, canManageAccess, canEditPortal, canEnterPortal, currentPortalRole, type PortalPermission, type PortalUser, type PortalUserStatus } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { RESET_CODE_TTL_MIN, TEMP_PASSWORD_VALIDITY_HOURS } from "@/lib/password";
import { SETUP_CODE_TTL_DAYS, codeDaysRemaining } from "@/lib/staffRoster";
import { getAuthConfig, hasOutboundMail } from "@/lib/authConfig";
import { useToast } from "../Toast";
import { SummaryStrip, TABLE_HEADER_COLOR, TextField, FIELD_STYLE, FIELD_FOCUS, BORDER, CARD_BORDER, TABLE_COLUMN_GAP, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, ConfirmModal, Tooltip } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";
import { withEffectiveStatus, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import RosterImportModal from "./RosterImportModal";
import {
  ROSTER_T, RosterCodeCell, RosterEntryModal, IssueConfirmModal, RemoveConfirmModal, PrintSheet,
  exportRosterCsv,
} from "./ProjectRosterTab";

const T = {
  en: {
    // Page header
    inviteUser: "Invite user",
    searchPlaceholder: "Search by user name or email address",

    // Role/status summary strip
    countOwners: "Owners",
    countAdmins: "Admins",
    countAuditors: "Read-only",
    countAppOnly: "App only",
    whatRolesMean: "What the roles mean",
    guideTitle: "Access and roles",
    guideLead: "Access decides which doors an account has. The role decides what it may do once inside Portal.",
    guideRolesHeading: "Portal roles — where they differ",
    guideRowGrant: "Users and granting access",
    guideRowSettings: "Cameras, VIP, roster, license, server",
    guideRowAudit: "Audit log",
    guideEdit: "Change",
    guideViewOnly: "View only",
    guideView: "View",
    guideNone: "No access",
    guideSameNote: "Every other Portal screen behaves like the settings row — there is one difference between Owner and Admin, and it is the first row.",
    guideAppHeading: "Inside the app",
    guideAppSearchNote: "Person search is granted per account and has nothing to do with the Portal role — an app-only operator can have it and a Portal admin can be without it.",
    guideClose: "Close",
    peopleTabAccounts: "Accounts",
    peopleTabRoster: "On the roster",
    // On the tabs themselves. The Accounts one answers the thing this table is most often read
    // wrongly for: an invited account is already here, before anybody has signed in with it.
    peopleTabAccountsHint: "Accounts that can reach this project — including people who have been invited and have not signed in yet.",
    peopleTabRosterHint: "On the staff roster with no account yet. Issue a registration code and hand it over on paper — they sign up without mail.",
    colPlannedPermission: "Permission on signup",
    colCode: "Registration code",
    countRosterWaiting: "On the roster",
    rosterWaitingHint: "On the staff roster with no account yet — they sign up with a registration code, no mail needed.",
    stageRosterListed: "Listed",
    stageCodeIssued: "Code issued",
    stageCodeExpired: "Code expired",
    // Roster tools, moved here with the rows they act on.
    addToRoster: "Add to roster",
    importRoster: "Import CSV",
    bulkIssue: (n: number) => `Issue ${n} code${n === 1 ? "" : "s"}`,
    printHandout: "Print code slips",
    exportRoster: "Export CSV",
    toastRosterExported: (n: number) => `${n} roster row(s) exported`,
    rosterEmpty: "Nobody is waiting on the roster.",
    toastBulkIssued: (n: number) => `${n} registration code(s) issued`,
    countPortalOnly: "Portal only",
    countInvited: "Invited",
    countSuspended: "Suspended",
    countTotal: "on this project",
    countPeopleUnit: "people",
    invitedHint: "Invited but has not set a password yet — they cannot sign in until they do.",
    suspendedHint: "Kept on the list but blocked from signing in.",

    // Toolbar filters

    // Table
    colUser: "User",
    colOtherProjects: "Other projects",
    otherProjectsNone: "This project only",
    colPermission: "Permission",
    colAccess: "Access",
    colAppSearch: "Person Search",
    colLastLogin: "Last Login",
    colStatus: "Status",
    emptySearch: "No users match this search.",
    emptyNoUsers: "No users have access to this project yet.",

    // Permission / status / MFA display labels
    permOwner: "Owner",
    permAdmin: "Admin",
    permAuditor: "Read-only admin",
    permNone: "No Portal role",
    permOwnerDesc: "Grants and revokes access, and removes people. The only role that can.",
    permAdminDesc: "Changes cameras, VIP registry, roster and license — but not who has access.",
    permAuditorDesc: "Sees every Portal screen and the audit log. Changes nothing.",
    permNoneDesc: "Does not open Portal at all.",
    // Access — where the person may sign in. Independent of the Portal role above: a role says what
    // they may do once inside Portal, this says whether Portal is one of the doors they have.
    accessBoth: "Portal + App",
    accessAppOnly: "App only",
    accessPortalOnly: "Portal only",
    accessBothDesc: "Both the settings console and the monitoring app.",
    accessAppOnlyDesc: "Signs straight into the monitoring app. No Portal.",
    accessPortalOnlyDesc: "Settings console only — no monitoring app.",
    accessGainsRoleNote: (role: string) => `Given the ${role} role, which changes nothing until you raise it.`,
    reasonNotOwner: "Only an owner can change access.",
    appSearchOn: "On",
    appSearchGrant: "Allow person search in the app",
    appSearchRevoke: "Block person search in the app",
    appSearchToastOn: "Person search allowed",
    appSearchToastOff: "Person search blocked",
    appSearchToastDesc: (name: string) => `${name} — Data and Redmap searches`,
    reasonReadOnly: "Read-only admins cannot change settings.",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",

    // Row actions
    resendInvite: "Resend invite",
    generateTempPassword: "Generate temporary password",
    // "user" is redundant in a menu that opens from a user's own row — the row already says who.
    reactivateUser: "Reactivate",
    suspendUser: "Suspend",
    removeUser: "Remove",

    // Confirmation dialogs for the account actions above. Each body says what changes for the
    // person, not what the button does — "Suspend this user?" tells an administrator nothing they
    // did not already read in the menu item they just clicked.
    confirmSuspendTitle: (name: string) => `Suspend ${name}?`,
    confirmSuspendBody: "They are signed out and cannot sign in again until an owner reactivates the account. Nothing they registered is deleted.",
    confirmReactivateTitle: (name: string) => `Reactivate ${name}?`,
    confirmReactivateBody: "They can sign in again immediately, with the permissions the account had before it was suspended.",
    confirmRemoveTitle: (name: string) => `Remove ${name}?`,
    confirmRemoveBody: "The account and its permissions are deleted. This cannot be undone from this menu — getting this person back in means inviting them again.",
    confirmSearchGrantTitle: (name: string) => `Allow ${name} to search for people?`,
    confirmSearchGrantBody: "They will be able to look up any registered individual in the app's Data and Redmap searches.",
    confirmSearchRevokeTitle: (name: string) => `Block ${name} from searching for people?`,
    confirmSearchRevokeBody: "Person search in the app stops working for them. Their console permission is unchanged.",

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
    mailConsequenceSend: (email: string) => `A reset code is sent to ${email}. You never see it.`,
    mailConsequenceUserSets: "They set their own password with it, so nobody else knows what they choose.",
    mailConsequenceTtl: (min: number) => `The code stops working after ${min} minutes.`,
    mailConsequenceInvalidates: "Any reset code already on its way to them stops working.",
    tempConsequenceInvalidate: "Their current password stops working the moment you generate this.",
    tempConsequenceOnce: "The new password is shown once, on the next screen. It is never stored and cannot be looked up again.",
    tempConsequenceMustChange: "They must set a password of their own the first time they log in with it.",
    tempConsequenceExpiry: (hours: number) => `It stops working after ${hours} hours, used or not.`,
    tempConsequenceExpiryDays: (days: number) => `It stops working after ${days} days, used or not.`,
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
    setupBadgeTitle: (days: number) => `Issued — not yet used. Stops working in ${days} days`,
    setupBadgeExpired: "Setup code expired",
    viewSetupCode: "View setup code",
    setupExpires: (days: number) => `Expires in ${days} days`,
    soleAdminTitle: "Only one administrator can sign in",
    soleAdminBody: "Granting permissions is an administrator-only power, and there is no supplier account behind this installation. If this one account is locked out, nobody can grant anything and there is no way back in. Make a second person an administrator.",
    // Two sentences, because this renders as a footnote inside a dropdown. The reasoning behind the
    // rule — with nobody in this role no one can grant permissions and there is no way back in —
    // belongs in isLastActiveAdmin's comment, not in a 280px menu.
    lastAdminReason: "The only administrator who can sign in. Make someone else an administrator first.",
    lastAdminRoleFixed: "The only owner — the role cannot be changed until there is another one.",
    tempExpires: (hours: number) => `Expires in ${hours} hours`,
    tempDone: "Done",

    // Recovery-mode notice (deployment with no outbound mail)
    recoveryNoticeTitle: "Self-service password reset is off for this installation",
    recoveryNoticeBody: "There is no outbound mail here, so no reset code can be sent to anyone. A locked-out user calls the contact below, and an administrator hands them a way back in from the row actions — a temporary password read out on the line, or a setup code on paper.",
    recoveryNoticeContactLabel: "THEY CALL",
    recoveryNoticeContactFallback: "Your security operations team",

    // Invite modal
    modalTitle: "Invite user",
    nameLabel: "Name",
    namePlaceholder: "Full name",
    emailLabel: "Email",
    teamLabel: "Team",
    accessLabel: "Where they sign in",
    permissionLabel: "Portal role",
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
    inviteUser: "사용자 초대",
    searchPlaceholder: "사용자 이름 또는 이메일 주소로 검색",

    // Role/status summary strip
    countOwners: "최고관리자",
    countAdmins: "관리자",
    countAuditors: "읽기 전용",
    countAppOnly: "앱 전용",
    whatRolesMean: "권한 안내",
    guideTitle: "접근과 역할",
    guideLead: "접근은 계정에 열리는 문을 정하고, 역할은 포털 안에서 할 수 있는 일을 정합니다.",
    guideRolesHeading: "포털 역할 — 서로 다른 것만",
    guideRowGrant: "사용자 · 권한 부여",
    guideRowSettings: "카메라 · VIP · 명부 · 라이선스 · 서버",
    guideRowAudit: "감사 로그",
    guideEdit: "변경",
    guideViewOnly: "보기만",
    guideView: "보기",
    guideNone: "접근 없음",
    guideSameNote: "나머지 포털 화면은 모두 설정 행과 똑같이 동작합니다 — 소유자와 관리자의 차이는 하나뿐이고, 그게 첫 줄입니다.",
    guideAppHeading: "앱 안에서",
    guideAppSearchNote: "인물 검색은 계정마다 따로 부여하며 포털 역할과 무관합니다 — 앱 전용 운영자가 가질 수도 있고, 포털 관리자가 없을 수도 있습니다.",
    guideClose: "닫기",
    peopleTabAccounts: "계정",
    peopleTabRoster: "명부 대기",
    peopleTabAccountsHint: "이 프로젝트에 닿을 수 있는 계정입니다 — 초대만 받고 아직 로그인하지 않은 사람도 포함합니다.",
    peopleTabRosterHint: "명부에 있고 아직 계정이 없는 사람입니다. 등록 코드를 발급해 종이로 건네면 메일 없이 가입합니다.",
    colPlannedPermission: "가입 시 권한",
    colCode: "등록 코드",
    countRosterWaiting: "명부 대기",
    rosterWaitingHint: "직원 명부에 있고 아직 계정이 없습니다 — 등록 코드로 가입하며 메일이 필요 없습니다.",
    stageRosterListed: "명부 등록",
    stageCodeIssued: "코드 발급",
    stageCodeExpired: "코드 만료",
    addToRoster: "명부에 추가",
    importRoster: "CSV 가져오기",
    bulkIssue: (n: number) => `코드 ${n}개 발급`,
    printHandout: "코드 슬립 인쇄",
    exportRoster: "CSV 내보내기",
    toastRosterExported: (n: number) => `명부 ${n}개 행을 내보냈습니다`,
    rosterEmpty: "명부에서 기다리는 사람이 없습니다.",
    toastBulkIssued: (n: number) => `등록 코드 ${n}개를 발급했습니다`,
    countPortalOnly: "포털 전용",
    countInvited: "초대됨",
    countSuspended: "정지됨",
    countTotal: "이 프로젝트 인원",
    countPeopleUnit: "명",
    invitedHint: "초대는 됐지만 아직 비밀번호를 설정하지 않았습니다 — 설정 전까지 로그인할 수 없습니다.",
    suspendedHint: "명단에는 남아 있지만 로그인이 차단된 상태입니다.",

    // Toolbar filters

    // Table
    colUser: "사용자",
    colOtherProjects: "다른 프로젝트",
    otherProjectsNone: "이 프로젝트만",
    colPermission: "권한",
    colAccess: "접근",
    colAppSearch: "인물 검색",
    colLastLogin: "마지막 로그인",
    colStatus: "상태",
    emptySearch: "검색 결과와 일치하는 사용자가 없습니다.",
    emptyNoUsers: "이 프로젝트에 접근 권한이 있는 사용자가 아직 없습니다.",

    // Permission / status / MFA display labels
    permOwner: "최고관리자",
    permAdmin: "관리자",
    permAuditor: "읽기 전용 관리자",
    permNone: "포털 역할 없음",
    permOwnerDesc: "권한을 주고 회수하고, 사람을 지웁니다. 이걸 할 수 있는 유일한 역할입니다.",
    permAdminDesc: "카메라·VIP 등록·명부·라이선스를 바꿉니다. 누가 접근하는지는 못 바꿉니다.",
    permAuditorDesc: "Portal의 모든 화면과 감사 로그를 봅니다. 아무것도 바꾸지 않습니다.",
    permNoneDesc: "Portal에는 들어오지 않습니다.",
    accessBoth: "포털 + 앱",
    accessAppOnly: "앱만",
    accessPortalOnly: "포털만",
    accessBothDesc: "설정 콘솔과 관제 앱 둘 다.",
    accessAppOnlyDesc: "로그인하면 바로 관제 앱. Portal은 못 봅니다.",
    accessPortalOnlyDesc: "설정 콘솔만 — 관제 앱은 못 씁니다.",
    accessGainsRoleNote: (role: string) => `${role} 역할로 들어갑니다. 올리기 전까지는 바꾸는 게 없습니다.`,
    reasonNotOwner: "권한 변경은 최고관리자만 할 수 있습니다.",
    appSearchOn: "허용",
    appSearchGrant: "앱에서 인물 검색 허용",
    appSearchRevoke: "앱에서 인물 검색 차단",
    appSearchToastOn: "인물 검색을 허용했습니다",
    appSearchToastOff: "인물 검색을 차단했습니다",
    appSearchToastDesc: (name: string) => `${name} — Data · Redmap 검색`,
    reasonReadOnly: "읽기 전용 관리자는 설정을 바꿀 수 없습니다.",
    statusActive: "활성",
    statusInvited: "초대됨",
    statusSuspended: "정지됨",

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
    setupBadgeTitle: (days: number) => `발급됨 · 아직 사용되지 않음 — ${days}일 후 만료`,
    setupBadgeExpired: "설치 코드 만료",
    viewSetupCode: "설치 코드 보기",
    setupExpires: (days: number) => `${days}일 후 만료`,
    soleAdminTitle: "로그인 가능한 관리자가 한 명입니다",
    soleAdminBody: "권한 부여는 관리자만 할 수 있고, 이 설치에는 공급사 계정이 없습니다. 이 한 계정이 잠기면 아무도 권한을 부여할 수 없고 되돌릴 방법도 없습니다. 두 번째 관리자를 지정하세요.",
    lastAdminReason: "로그인할 수 있는 유일한 관리자입니다. 다른 사람을 먼저 관리자로 지정하세요.",
    lastAdminRoleFixed: "유일한 소유자입니다 — 다른 소유자가 생기기 전까지 역할을 바꿀 수 없습니다.",
    reactivateUser: "재활성화",
    suspendUser: "정지",
    removeUser: "제거",

    confirmSuspendTitle: (name: string) => `${name} 님을 정지할까요?`,
    confirmSuspendBody: "즉시 로그아웃되며, 소유자가 다시 활성화하기 전까지 로그인할 수 없습니다. 등록한 내용은 삭제되지 않습니다.",
    confirmReactivateTitle: (name: string) => `${name} 님을 재활성화할까요?`,
    confirmReactivateBody: "바로 다시 로그인할 수 있게 되며, 정지 전에 가지고 있던 권한이 그대로 복구됩니다.",
    confirmRemoveTitle: (name: string) => `${name} 님을 제거할까요?`,
    confirmRemoveBody: "계정과 권한이 삭제됩니다. 이 메뉴로는 되돌릴 수 없고, 다시 들어오게 하려면 새로 초대해야 합니다.",
    confirmSearchGrantTitle: (name: string) => `${name} 님에게 인물 검색을 허용할까요?`,
    confirmSearchGrantBody: "앱의 Data · Redmap 검색에서 등록된 인물을 모두 조회할 수 있게 됩니다.",
    confirmSearchRevokeTitle: (name: string) => `${name} 님의 인물 검색을 차단할까요?`,
    confirmSearchRevokeBody: "앱에서 인물 검색이 동작하지 않게 됩니다. 콘솔 권한은 그대로입니다.",

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
    mailConsequenceSend: (email: string) => `재설정 코드가 ${email} 로 발송됩니다. 관리자는 코드를 보지 않습니다.`,
    mailConsequenceUserSets: "사용자가 그 코드로 본인 비밀번호를 직접 정하므로, 아무도 그 비밀번호를 알지 못합니다.",
    mailConsequenceTtl: (min: number) => `코드는 ${min}분 후 만료됩니다.`,
    mailConsequenceInvalidates: "이미 발송된 재설정 코드가 있으면 그 코드는 사용할 수 없게 됩니다.",
    tempConsequenceInvalidate: "생성하는 즉시 기존 비밀번호는 사용할 수 없게 됩니다.",
    tempConsequenceOnce: "새 비밀번호는 다음 화면에 한 번만 표시됩니다. 저장되지 않으며 다시 확인할 수 없습니다.",
    tempConsequenceMustChange: "사용자는 이 비밀번호로 처음 로그인할 때 반드시 본인 비밀번호를 새로 설정해야 합니다.",
    tempConsequenceExpiry: (hours: number) => `사용 여부와 관계없이 ${hours}시간 후 만료됩니다.`,
    tempConsequenceExpiryDays: (days: number) => `사용 여부와 관계없이 ${days}일 후 만료됩니다.`,
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
    recoveryNoticeBody: "외부로 나가는 메일이 없어 재설정 코드를 보낼 수 없습니다. 로그인하지 못하는 사용자는 아래 연락처로 문의하고, 관리자가 행 메뉴에서 다시 들어올 수단을 발급합니다 — 내선으로 읽어주는 임시 비밀번호, 또는 종이로 전달하는 설치 코드.",
    recoveryNoticeContactLabel: "문의처",
    recoveryNoticeContactFallback: "관제 센터 보안 관리자",

    // Invite modal
    modalTitle: "사용자 초대",
    nameLabel: "이름",
    namePlaceholder: "전체 이름",
    emailLabel: "이메일",
    teamLabel: "팀",
    accessLabel: "어디로 로그인하나",
    permissionLabel: "포털 역할",
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
  const issueInviteToken = useVcaStore(s => s.issueInviteToken);
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
  // Access first, role second — the same order the table now reads in, and the order the questions
  // actually come in: whether this person opens Portal at all, then what they may do there.
  const [accessMode, setAccessMode] = useState<AccessMode>("appOnly");
  const [permission, setPermission] = useState<PortalPermission>("admin");
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
    const resolved = applyAccessMode(accessMode, permission);
    const id = addPortalUser({
      name: name.trim(), email: email.trim(), teamId, projectIds,
      permission: resolved.permission, appAccess: resolved.appAccess, status: "invited",
    });
    // The link carries a minted token, not the account id it used to carry — see PortalUser.
    // inviteToken. The toast stands in for the mail nobody can send yet.
    const token = issueInviteToken(id);
    showToast({ variant: "success", title: t.inviteSentTitle, desc: `/password-setup?token=${token}` });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      {/* margin auto, not just centring: with the scroll on the backdrop, a form taller than the
          window has its top cut off under plain align-items centre. */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", margin: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.modalTitle}</p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={MODAL_BODY_WITH_SELECT}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
            <TextField value={name} onChange={setName} placeholder={t.namePlaceholder} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.emailLabel}</label>
            <TextField value={email} onChange={setEmail} placeholder="name@univs.ai" type="email" />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.teamLabel}</label>
            <FilterSelect value={teamId} onChange={changeTeam} options={teams.map(o => ({ value: o.id, label: o.name }))} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.accessLabel}</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["both", "appOnly", "portalOnly"] as AccessMode[]).map(mode => (
                <button key={mode} onClick={() => setAccessMode(mode)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: "10px", cursor: "pointer",
                    border: accessMode === mode ? "1px solid var(--gray-900)" : BORDER,
                    backgroundColor: accessMode === mode ? "var(--gray-100)" : "white",
                    color: accessMode === mode ? "var(--gray-900)" : "var(--gray-600)",
                    fontSize: "12px", fontWeight: 700,
                  }}>
                  {accessLabel(t, mode)}
                </button>
              ))}
            </div>
          </div>
          {/* Only asked once Portal is one of the doors. An app-only invite has no Portal role to
              set, and a disabled select there would be a question with no answer. */}
          {accessMode !== "appOnly" && (
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.permissionLabel}</label>
              <FilterSelect
                value={permission}
                onChange={v => setPermission(v as PortalPermission)}
                options={consoleRoleOptions(t)}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.projectsLabel}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {teamProjects.map(p => {
                const active = projectIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleProject(p.id)}
                    style={{
                      padding: "6px 10px", borderRadius: "8px", cursor: "pointer",
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
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!name.trim() || !email.trim()}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: (name.trim() && email.trim()) ? "pointer" : "not-allowed", opacity: (name.trim() && email.trim()) ? 1 : 0.5 }}>
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
function TempPasswordModal({ user, mailAvailable, initialCode, onClose }: { user: PortalUser; mailAvailable: boolean; initialCode?: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const issueTemporaryPassword = useVcaStore(s => s.issueTemporaryPassword);
  const issueSetupCode = useVcaStore(s => s.issueSetupCode);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  // Non-null from the start when an existing setup code is being looked up again rather than
  // issued — the result step is the whole point of that visit, so it opens straight into it.
  const [password, setPassword] = useState<string | null>(initialCode ?? null);
  const [copied, setCopied] = useState(false);
  /* Chosen here rather than in the row menu. Both paths do the same job — hand this person a way
     in — so two menu entries made the administrator learn the difference between a temporary
     password and a setup code before they could pick one. Asked as a question about their own
     situation instead: can you tell this person a password, or can you only pass them a slip of
     paper? The mechanism follows from the answer. */
  // Mail first where it exists, and the default: it is the only path on which the administrator
  // never learns the person's password.
  const [kind, setKind] = useState<CredentialKind>(initialCode ? "code" : mailAvailable ? "mail" : "password");

  /* The two credentials share this box because the careful parts are identical — a confirm step
     before an irreversible action, a result shown once, a clipboard write that only claims success
     once it resolves. Only the words and the store call differ, and duplicating the box would let
     the two drift. */
  const c = kind === "mail"
    ? {
        modalTitle: t.resetPassword, intro: undefined as string | undefined, generate: t.sendCode,
        resultTitle: t.resetCodeSentTitle, note: "",
        handoverTitle: "", handover: "",
        // This branch used to carry no rules at all, and it is the one the modal OPENS on wherever
        // mail works — so the box looked as though the button had nothing to warn about until the
        // administrator picked one of the other two. Sending a code is not consequence-free: it
        // retires whatever code is already in that mailbox, and it puts the account behind a
        // ten-minute window. An empty block also reads as "we forgot", which is worse than either.
        consequences: [
          t.mailConsequenceSend(user.email),
          t.mailConsequenceUserSets,
          t.mailConsequenceTtl(RESET_CODE_TTL_MIN),
          t.mailConsequenceInvalidates,
        ],
        showExpiry: false, expiryLabel: "",
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
        showExpiry: true, expiryLabel: t.tempExpires(TEMP_PASSWORD_VALIDITY_HOURS),
      }
    : {
        modalTitle: t.setupModalTitle, intro: t.setupConfirmIntro, generate: t.setupGenerate,
        resultTitle: t.setupResultTitle, note: t.setupShownOnce,
        handoverTitle: t.setupHandoverTitle, handover: t.setupHandover,
        consequences: [
          t.setupConsequenceReplace, t.setupConsequenceNoLogin, t.setupConsequenceWhere,
          t.tempConsequenceExpiryDays(SETUP_CODE_TTL_DAYS),
        ],
        // The expiry line is real now: a code carries an issue date and /register refuses it past
        // SETUP_CODE_TTL_DAYS. It stays in the neutral tone rather than the warning one — unlike a
        // temporary password, a code cannot sign in, so the clock is information, not a hazard.
        // HANDOFF NOTE: the backend has to enforce the same number.
        showExpiry: false,
        expiryLabel: t.setupExpires(
          codeDaysRemaining(user.setupCodeIssuedAt, SETUP_CODE_TTL_DAYS) ?? SETUP_CODE_TTL_DAYS,
        ),
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

  /* Was a <li> relying on the default disc marker, which renders as empty indent here, so the
     lines arrived as one unlabelled block. Drawn rather than inherited, and the same marker on
     every line: these four are the rules of the action about to be taken, not four different kinds
     of thing. An asterisk is the mark those already carry in print. A wrapped line stays hanging
     off it instead of sliding under it. */
  const bullet = (text: string) => (
    <li key={text} style={{ display: "flex", gap: "6px", alignItems: "flex-start", listStyle: "none" }}>
      <Asterisk
        size={14}
        strokeWidth={2.4}
        aria-hidden
        style={{ flexShrink: 0, marginTop: "2px", color: "var(--gray-400)" }}
      />
      <span style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.6 }}>{text}</span>
    </li>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {password ? c.resultTitle : c.modalTitle}
          </p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        {password === null ? (
          <>
            <div style={MODAL_BODY}>
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
                        border: on ? "1px solid var(--primary-300)" : "1px solid var(--line)",
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

            </div>
            {/* Outside the scrolling body, deliberately. These are the rules of the button below
                them, so they have to be on screen at the moment it is pressed — reachable by
                scrolling is not the same as read, and this action cannot be undone. The choice
                above can scroll; what the choice commits you to cannot. */}
            {c.consequences.length > 0 && (
              <div style={{ padding: "14px 20px", borderTop: BORDER, backgroundColor: "var(--gray-50)" }}>
                <ul style={{ display: "flex", flexDirection: "column", gap: "6px", margin: 0, padding: 0, listStyle: "none" }}>
                  {c.consequences.map(line => bullet(line))}
                </ul>
              </div>
            )}
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
              <button className="portal-btn-primary" onClick={generate}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {c.generate}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={MODAL_BODY}>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.tempResultFor(user.name)}</p>

              {/* Monospace and letter-spaced because this string gets read aloud a character at a
                  time. user-select stays on: the copy button is a convenience, not the only way
                  to get it out of the box. */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--gray-50)" }}>
                <code style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "18px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "1px", wordBreak: "break-all" }}>
                  {password}
                </code>
                <button onClick={copy}
                  style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: copied ? "var(--success-400)" : "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                  {copied ? t.tempCopied : t.tempCopy}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: c.showExpiry ? "var(--warning-500)" : "var(--gray-600)" }}>{c.note}</p>
                {c.expiryLabel && <span style={{ flexShrink: 0, fontSize: "12px", color: "var(--gray-500)" }}>{c.expiryLabel}</span>}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: c.showExpiry ? "var(--warning-100)" : "var(--info-100)" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: c.showExpiry ? "var(--warning-500)" : "var(--info-500)", letterSpacing: "0.4px" }}>{c.handoverTitle}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.7, marginTop: "4px" }}>{c.handover}</p>
              </div>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button className="portal-btn-primary" onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.tempDone}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The recovery modal's body. Capped and scrollable, because the confirm step grows with its copy:
 * three delivery cards plus four consequence lines is taller than a short laptop window once the
 * text wraps — and the English strings wrap where the Korean ones do not, so the same box fit in
 * one language and had its bottom (the consequence list, then the buttons) cut off in the other,
 * with no scrollbar to reach it. The header and footer stay put; only the middle scrolls.
 * InviteUserModal already did this — the two boxes now agree.
 */
const MODAL_BODY: React.CSSProperties = {
  padding: "20px", display: "flex", flexDirection: "column", gap: "16px",
  maxHeight: "60vh", overflowY: "auto",
};

/**
 * The same body for a modal that contains a FilterSelect.
 *
 * overflow-y makes a clipping context, and FilterSelect opens as an absolutely positioned list —
 * inside one, the list is cut off at the body's edge, which is how the invite modal's Team and Role
 * options were half-invisible. The scroll moves to the backdrop instead (see the invite modal's own
 * shell), where it clips nothing the viewport would not. The trade is that a long form scrolls its
 * header away too; a select you cannot read is the worse of the two.
 */
const MODAL_BODY_WITH_SELECT: React.CSSProperties = {
  padding: "20px", display: "flex", flexDirection: "column", gap: "16px",
};

/**
 * The four console roles, with the sentence that explains each. One definition, used by the row
 * select, the filter and the invite modal — three lists of roles would drift the first time one
 * changes. Order is the ladder: owner → admin → read-only → no console.
 */
interface RoleCopy {
  permOwner: string; permAdmin: string; permAuditor: string; permNone: string;
  permOwnerDesc: string; permAdminDesc: string; permAuditorDesc: string; permNoneDesc: string;
}

interface AccessCopy {
  accessBoth: string; accessAppOnly: string; accessPortalOnly: string;
  accessBothDesc: string; accessAppOnlyDesc: string; accessPortalOnlyDesc: string;
}

/** The roles that mean something inside Portal. "none" is not offered here — it is not a role a
 *  person is given, it is what they have when Access says they do not open Portal. */
function consoleRoleOptions(t: RoleCopy) {
  return [
    { value: "owner", label: t.permOwner, description: t.permOwnerDesc },
    { value: "admin", label: t.permAdmin, description: t.permAdminDesc },
    { value: "auditor", label: t.permAuditor, description: t.permAuditorDesc },
  ];
}

/** Short label for a role, for table cells and toasts. */
function roleLabel(t: RoleCopy, p: PortalPermission): string {
  return p === "owner" ? t.permOwner : p === "admin" ? t.permAdmin : p === "auditor" ? t.permAuditor : t.permNone;
}

/**
 * The three combinations of (Portal role, app access) that an account can usefully be in. The
 * fourth — no role and no app — is an account that can reach nothing, so it is not a mode anything
 * can select; see hasSomeAccess in the store.
 */
type AccessMode = "both" | "appOnly" | "portalOnly";

/** The console role an account picks up when Access first lets it into Portal. Read-only on
 *  purpose: granting Portal and granting the power to change things are two decisions, and this
 *  control is only making the first one. */
const DEFAULT_ROLE_ON_PORTAL_GRANT: PortalPermission = "auditor";

function accessModeOf(u: Pick<PortalUser, "permission" | "appAccess">): AccessMode {
  if (!canEnterPortal(u.permission)) return "appOnly";
  return u.appAccess ? "both" : "portalOnly";
}

/** What (role, appAccess) a mode resolves to, given the role the account already has. */
function applyAccessMode(mode: AccessMode, current: PortalPermission): { permission: PortalPermission; appAccess: boolean } {
  if (mode === "appOnly") return { permission: "none", appAccess: true };
  const permission = canEnterPortal(current) ? current : DEFAULT_ROLE_ON_PORTAL_GRANT;
  return { permission, appAccess: mode === "both" };
}

function accessOptions(t: AccessCopy) {
  return [
    { value: "both", label: t.accessBoth, description: t.accessBothDesc },
    { value: "appOnly", label: t.accessAppOnly, description: t.accessAppOnlyDesc },
    { value: "portalOnly", label: t.accessPortalOnly, description: t.accessPortalOnlyDesc },
  ];
}

function accessLabel(t: AccessCopy, mode: AccessMode): string {
  return mode === "both" ? t.accessBoth : mode === "appOnly" ? t.accessAppOnly : t.accessPortalOnly;
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
      fontSize: "12px", fontWeight: 600, padding: "4px 8px", borderRadius: "999px", textTransform: "capitalize",
      backgroundColor: bg, color,
    }}>
      {label}
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
/**
 * An issued setup code nobody has redeemed yet. Same job as the temporary-password badge: the table
 * should say, without opening anything, who is still holding a slip of paper that gets them in.
 * Neutral tone rather than warning — a code cannot sign in, so an outstanding one is a loose end,
 * not a shared credential.
 */
function SetupCodeBadge({ issuedAt }: { issuedAt?: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  // After mount, for the reason TempPasswordBadge documents below.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const days = nowMs === null ? null : codeDaysRemaining(issuedAt, SETUP_CODE_TTL_DAYS, nowMs);
  const expired = days === 0;
  const tone = expired
    ? { bg: "var(--danger-100)", color: "var(--danger-500)" }
    : { bg: "var(--info-100)", color: "var(--info-500)" };

  return (
    <span
      title={days === null ? undefined : t.setupBadgeTitle(days)}
      style={{
        display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "999px",
        backgroundColor: tone.bg, color: tone.color, fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap",
      }}
    >
      {expired ? t.setupBadgeExpired : t.setupBadge}
    </span>
  );
}

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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7.2v4M8 5.1v.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
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
  const issueInviteToken = useVcaStore(s => s.issueInviteToken);
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
      showToast({ variant: "success", title: t.accessApprovedTitle, desc: `/password-setup?token=${issueInviteToken(newUserIds[0])}` });
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
            style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
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
              <button className="portal-btn-outline" onClick={() => dismissAccessRequest(r.id)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                {t.dismiss}
              </button>
              <button onClick={() => approve([r.id])}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--gray-900)", backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
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
/**
 * Where a person is between "on the list" and "using the system".
 *
 * The Staff Roster used to be its own tab, which split one lifecycle down the middle: the roster
 * answered "who has not joined yet" (its own page description said so) and this page answered who
 * had. Somebody checking whether a named person was in yet had to look in two places and know which
 * one to look in first. It is one ladder, so it is one table — see the roster group below.
 *
 * Ordered as the funnel runs, so the value doubles as a sort key.
 */
const SECONDARY_BTN: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px",
  border: BORDER, backgroundColor: "white", color: "var(--gray-600)",
  fontSize: "10px", fontWeight: 700, cursor: "pointer", flexShrink: 0,
};

const STAGES = ["rosterListed", "codeIssued", "codeExpired", "invited", "active", "suspended"] as const;
type Stage = (typeof STAGES)[number];

function stageOfRosterEntry(status: RosterCodeStatus): Stage {
  // "used" never reaches here — a used row's person has an account, and the account is their row.
  return status === "unused" ? "codeIssued" : status === "expired" ? "codeExpired" : "rosterListed";
}

/**
 * What the two axes mean, as a reference an owner can open while deciding.
 *
 * Deliberately NOT the role x capability matrix the big consoles draw (Vanta, StackAI, Workable).
 * Those carry five to eight roles, custom ones included, over dozens of capabilities. This
 * installation has three roles, and six of the seven rows such a matrix would have are identical
 * between Owner and Admin — it would be a wall of "Change / Change / View only" restating three
 * sentences. Only the row that differs is worth a table.
 *
 * Every cell is derived from the same helpers the app enforces with (canManageAccess,
 * canEditPortal, canEnterPortal) rather than typed out. A hand-written permissions table is a
 * document that starts telling the truth and stops the first time one of those functions changes.
 */
function AccessGuideModal({ t, onClose }: { t: (typeof T)["en"] | (typeof T)["ko"]; onClose: () => void }) {
  const roles: PortalPermission[] = ["owner", "admin", "auditor"];
  const cell = (allowed: boolean, yes: string, no: string) => ({
    label: allowed ? yes : no,
    color: allowed ? "var(--gray-900)" : "var(--gray-500)",
    weight: allowed ? 700 : 400,
  });
  const rows = [
    { label: t.guideRowGrant, of: (r: PortalPermission) => cell(canManageAccess(r), t.guideEdit, t.guideViewOnly) },
    { label: t.guideRowSettings, of: (r: PortalPermission) => cell(canEditPortal(r), t.guideEdit, t.guideViewOnly) },
    { label: t.guideRowAudit, of: (r: PortalPermission) => cell(canEnterPortal(r), t.guideView, t.guideNone) },
  ];
  const GUIDE_GRID = "1.6fr repeat(3, 1fr)";
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "560px", width: "100%", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.guideTitle}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.6 }}>{t.guideLead}</p>
        </div>

        {/* The doors. This is the half people actually get wrong — the roles read fine on their own,
            it is their relationship to app access that needs saying. */}
        <div style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
          {([
            { label: t.accessBoth, desc: t.accessBothDesc },
            { label: t.accessAppOnly, desc: t.accessAppOnlyDesc },
            { label: t.accessPortalOnly, desc: t.accessPortalOnlyDesc },
          ]).map(a => (
            <div key={a.label} style={{ display: "flex", gap: "10px", alignItems: "baseline", border: BORDER, borderRadius: "10px", padding: "10px 12px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", whiteSpace: "nowrap", minWidth: "88px" }}>{a.label}</span>
              <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{a.desc}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>{t.guideRolesHeading}</p>
          <div style={{ border: BORDER, borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: GUIDE_GRID, gap: "8px", padding: "8px 12px", backgroundColor: "var(--gray-50)", borderBottom: BORDER }}>
              <span />
              {roles.map(r => (
                <span key={r} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>
                  {roleLabel(t, r).toUpperCase()}
                </span>
              ))}
            </div>
            {rows.map((row, i) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: GUIDE_GRID, gap: "8px", padding: "10px 12px", borderBottom: i === rows.length - 1 ? "none" : BORDER, alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.4 }}>{row.label}</span>
                {roles.map(r => {
                  const c = row.of(r);
                  return <span key={r} style={{ fontSize: "12px", fontWeight: c.weight, color: c.color }}>{c.label}</span>;
                })}
              </div>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "8px", lineHeight: 1.6 }}>{t.guideSameNote}</p>
        </div>

        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>{t.guideAppHeading}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6 }}>{t.guideAppSearchNote}</p>
        </div>

        <div style={{ padding: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button className="portal-btn-primary" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.guideClose}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One badge for every rung of the ladder, so a reader compares like with like down the column. */
function StageBadge({ stage, t }: { stage: Stage; t: { stageRosterListed: string; stageCodeIssued: string; stageCodeExpired: string } }) {
  const meta: Record<"rosterListed" | "codeIssued" | "codeExpired", { label: string; bg: string; color: string }> = {
    rosterListed: { label: t.stageRosterListed, bg: "var(--gray-100)", color: "var(--gray-500)" },
    codeIssued: { label: t.stageCodeIssued, bg: "var(--info-100)", color: "var(--info-500)" },
    codeExpired: { label: t.stageCodeExpired, bg: "var(--warning-200)", color: "var(--warning-500)" },
  };
  const m = meta[stage as "rosterListed" | "codeIssued" | "codeExpired"];
  if (!m) return null;
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 8px", borderRadius: "999px", backgroundColor: m.bg, color: m.color, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

/**
 * The page's summary, in the shared SummaryStrip — the same row Input Sources, the VIP registry and
 * Server & API carry.
 *
 * It used to be nine figures in one line, grouped by rules: a total, five roles, three pipeline
 * states. Two things were wrong with that. The five roles are a distribution, not something to act
 * on, and the table's own Role column already carries them (sortable, one row per person) — so
 * they were a chart of a column six inches below them. And none of the nine could be pressed: you
 * read "1 suspended" and then went looking for that person by eye.
 *
 * So the strip states what somebody comes here to act on — who is stuck on the way in — and each
 * of those cells filters the table to its own rows. The total closes the row as the one figure
 * that is a fact rather than an errand. The role split moves to a caption under it, which is all
 * the weight a distribution needs.
 */
function UserCountStrip({
  users, rosterWaiting, statusFilter, onFilter, onShowGuide,
}: {
  users: PortalUser[];
  rosterWaiting: number;
  statusFilter: "invited" | "suspended" | "roster" | null;
  onFilter: (next: "invited" | "suspended" | "roster" | null) => void;
  onShowGuide: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const invited = users.filter(u => u.status === "invited").length;
  const suspended = users.filter(u => u.status === "suspended").length;
  const roleCounts: [string, number][] = [
    [t.countOwners, users.filter(u => u.permission === "owner").length],
    [t.countAdmins, users.filter(u => u.permission === "admin").length],
    [t.countAuditors, users.filter(u => u.permission === "auditor").length],
    [t.countAppOnly, users.filter(u => accessModeOf(u) === "appOnly").length],
    [t.countPortalOnly, users.filter(u => accessModeOf(u) === "portalOnly").length],
  ];

  return (
    <>
      <SummaryStrip cells={[
        {
          key: "total",
          icon: <Users2 size={14} strokeWidth={2.4} />,
          figure: users.length + rosterWaiting,
          unit: t.countPeopleUnit,
          label: t.countTotal,
        },
        // Only the states that exist. "0 suspended" is a column spent on nothing happening, and
        // pressing it would empty the table.
        ...([
          { key: "invited" as const, count: invited, label: t.countInvited, hint: t.invitedHint, icon: <MailQuestion size={14} strokeWidth={2.4} /> },
          { key: "suspended" as const, count: suspended, label: t.countSuspended, hint: t.suspendedHint, icon: <UserX size={14} strokeWidth={2.4} /> },
          { key: "roster" as const, count: rosterWaiting, label: t.countRosterWaiting, hint: t.rosterWaitingHint, icon: <ClipboardList size={14} strokeWidth={2.4} /> },
        ].filter(item => item.count > 0).map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          unit: t.countPeopleUnit,
          label: item.label,
          tone: "warning" as const,
          active: statusFilter === item.key,
          // The tooltip explains the state, which is the whole point of these three labels — an
          // invitation nobody accepted and a suspended account are not self-explanatory words —
          // and the dotted underline is what tells the reader the explanation is there.
          title: item.hint,
          explain: true,
          onClick: () => onFilter(statusFilter === item.key ? null : item.key),
        }))),
      ]} />
      {/* The distribution, and the way to what those words mean — at the end of the sentence that
          uses them. A guide link is worth having (the role descriptions otherwise live inside a
          select an auditor may not be allowed to open), but it needs something to be attached to,
          and this line is the only place on the page that says all five names in a row. */}
      <p style={{ fontSize: "11px", color: "var(--gray-500)", margin: "-4px 0 16px" }}>
        {roleCounts.map(([label, count]) => `${label} ${count}`).join(" · ")}
        <span style={{ color: "var(--gray-300)" }}>{"  ·  "}</span>
        <button
          onClick={onShowGuide}
          style={{
            border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: "11px", color: "var(--gray-500)",
            // Dotted, not solid: this is the same "there is an explanation behind this" cue the
            // page's own hint labels use, and a solid underline in a grey caption reads as a link
            // to another page.
            borderBottom: "1px dotted var(--gray-300)",
          }}
        >
          {t.whatRolesMean}
        </button>
      </p>
    </>
  );
}

type UserSortKey = "name" | "permission" | "lastLogin" | "status";

interface PortalUsersPageProps {
  /** Scopes the table to users who have access to this project — mirrors Clerk's per-application Users tab. */
  projectId: string;
}

export default function PortalUsersPage({ projectId }: PortalUsersPageProps) {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const projects = useVcaStore(s => s.projects);
  const updatePortalUserPermission = useVcaStore(s => s.updatePortalUserPermission);
  const updatePortalUserAccess = useVcaStore(s => s.updatePortalUserAccess);
  const staffRoster = useVcaStore(s => s.staffRoster);
  const issueRegistrationCodes = useVcaStore(s => s.issueRegistrationCodes);
  const reissueRegistrationCode = useVcaStore(s => s.reissueRegistrationCode);
  const removeRosterEntry = useVcaStore(s => s.removeRosterEntry);
  const logRosterCodeViewed = useVcaStore(s => s.logRosterCodeViewed);
  const updatePortalUserStatus = useVcaStore(s => s.updatePortalUserStatus);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const setAppSearch = useVcaStore(s => s.setAppSearch);
  const issueInviteToken = useVcaStore(s => s.issueInviteToken);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [showInvite, setShowInvite] = useState(false);
  // What this visitor may do here. Granting access is the owner's alone — an admin changes the
  // installation's settings, not who can get in. See PortalPermission in vcaStore.
  const myRole = currentPortalRole(portalUsers);
  const manageAccess = canManageAccess(myRole);
  // The user whose already-issued setup code is being looked up again, or null.
  const [viewingCodeFor, setViewingCodeFor] = useState<PortalUser | null>(null);
  // The user a temporary password is being issued for, or null. Held as the user rather than an id
  // so the modal keeps rendering the right name even if the row scrolls out from under it.
  const [credentialFor, setCredentialFor] = useState<PortalUser | null>(null);
  /**
   * The account action waiting on a yes. One piece of state rather than a flag per action: the
   * dialog is the same dialog every time and only its wording and its callback differ, and four
   * booleans would let two of them be open at once.
   */
  const [confirming, setConfirming] = useState<{
    title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
  } | null>(null);
  // Roster-side dialogs. They are the roster tab's own components, imported rather than rebuilt —
  // the tab is gone, the work it did is not.
  const [issuingEntry, setIssuingEntry] = useState<RosterEntry | null>(null);
  const [removingEntry, setRemovingEntry] = useState<RosterEntry | null>(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  /** null = closed, { entry: null } = add, { entry } = edit. */
  const [rosterEditorFor, setRosterEditorFor] = useState<{ entry: RosterEntry | null } | null>(null);
  /**
   * Top-level cut of the list. Same arrangement Input Sources uses for its kinds, for the same
   * reason: which half of the lifecycle you are looking at is a different question from how you are
   * narrowing it, and the columns and the tools that make sense differ per half — five of the ten
   * columns can only ever be blank for somebody with no account, and the roster's bulk tools have
   * nothing to act on among people who already have one.
   *
   * There is deliberately no combined tab. It existed briefly and every roster row in it spent five
   * columns printing a dash, which is the cost of a list whose rows cannot answer the same
   * questions. What the two halves needed to share was never one row list — it was one page, one
   * ladder of stages, one search and one set of counts, and they still do.
   */
  const [peopleTab, setPeopleTab] = useState<"accounts" | "roster">("accounts");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // Name ascending to start: the only order that is stable and that a reader can predict before
  // they have looked. The sortable columns are the ones an administrator asks questions about —
  // who, which team, what permission, when they last signed in, what state they are in.
  const { sort, toggle: toggleSort } = useTableSort<UserSortKey>({ key: "name", direction: "asc" });

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

  // The roster modals speak their own dictionary — they were written for the tab that used to own
  // them and take it as a prop, which is exactly why they could be shared instead of rewritten.
  const rt = ROSTER_T[lang];

  // The account-only columns: role, access, person search, MFA, last login. Dropped on the roster
  // tab rather than printed as five dashes per row.
  const showAccountColumns = peopleTab === "accounts";
  /**
   * The User column was the widest share of the table (1.3fr, 1.5fr on the roster tab) for content
   * that is a name over an address — both short. Everything it was holding in reserve was width the
   * two long-name columns beside it were wrapping for. Narrowed, with a floor rather than a bare
   * fraction so it cannot collapse to nothing on a small window, and the two lines inside it now
   * ellipsise instead of pushing the row taller.
   */
  const GRID = showAccountColumns
    ? "minmax(160px, 1.15fr) 1.15fr 0.85fr 0.8fr 0.55fr 0.95fr 0.6fr 36px"
    : "minmax(180px, 1.4fr) 1fr 1.2fr 0.7fr 36px";

  const bulkIssueCodes = () => {
    if (notIssuedIds.length === 0) return;
    issueRegistrationCodes(notIssuedIds);
    showToast({ variant: "success", title: t.toastBulkIssued(notIssuedIds.length) });
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const currentProject = projects.find(p => p.id === projectId);
  /**
   * Which of the "on the way in, or stopped" states the table is narrowed to, if any — set by the
   * summary strip above it.
   *
   * This page dropped its permission and status selects a while back on the grounds that the counts
   * strip answered what they were for. It answered, but it could not act: reading "1 suspended" and
   * then finding that person meant scanning the table. The strip's cells are the filter now, which
   * is what the numbers were being read for.
   */
  const [statusFilter, setStatusFilter] = useState<"invited" | "suspended" | "roster" | null>(null);
  const q = search.trim().toLowerCase();
  // Split in two: the strip above the table counts everyone on the project, the table shows what is
  // left after the search. Counting the searched set instead would make the summary agree with the
  // table and stop being a summary.
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));
  const filteredUsers = projectUsers
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    // "roster" narrows to people who have no account at all, so no account row can match it.
    .filter(u => statusFilter === null || u.status === statusFilter);
  /**
   * Roster rows for this project that are still waiting — matched against accounts by employee
   * number, which is the roster's own key. Status "used" is not enough on its own: an account can
   * also arrive by invitation and later be matched to a roster row, and the person should appear
   * once, as the account, not twice.
   */
  const accountEmployeeIds = new Set(
    portalUsers.map(u => u.employeeId?.toLowerCase()).filter(Boolean) as string[]
  );
  const projectRosterAll = withEffectiveStatus(staffRoster.filter(r => r.projectId === projectId));
  const rosterWaiting = projectRosterAll
    .filter(r => r.status !== "used" && !accountEmployeeIds.has(r.employeeId.toLowerCase()))
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q))
    .sort((a, b) => STAGES.indexOf(stageOfRosterEntry(a.status)) - STAGES.indexOf(stageOfRosterEntry(b.status)) || a.name.localeCompare(b.name));
  /**
   * The roster rows the table shows. Separate from rosterWaiting, which the tab count and the
   * summary strip read: a summary that shrinks when you filter to part of it has stopped being a
   * summary (the note above filteredUsers makes the same point about accounts).
   */
  const visibleRoster = rosterWaiting.filter(() => statusFilter === null || statusFilter === "roster");
  const notIssuedIds = rosterWaiting.filter(r => r.status === "not-issued").map(r => r.employeeId);
  const printableEntries = rosterWaiting.filter(r => r.status === "unused" && r.code);

  const scopedUsers = sortRows(filteredUsers, sort, (u, key) => {
    switch (key) {
      case "name": return u.name.toLowerCase();
      case "permission": return u.permission;
      // Undefined, not "" — someone who has never signed in has no date, and sortRows sinks
      // undefined to the bottom either way rather than letting it win "oldest first".
      case "lastLogin": return u.lastLoginAt;
      case "status": return u.status;
    }
  });

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
              <path d="M8 1.8 1.5 13.2h13L8 1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8 6v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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

      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice.

          The "what the roles mean" link used to sit here, alone on the left of the buttons, and it
          belonged to nothing — a lone underlined phrase at the top of a page reads as a warning or
          a leftover. It moved to the end of the role-distribution caption below, where the roles
          are being named one by one and the question arises on its own. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginBottom: "20px" }}>
        {/* Tools follow the tab. Six buttons in one row was every tool for both halves of the
            lifecycle competing at once, and four of them could not act on what the reader was
            looking at. The two ways of adding a person stay on the combined tab; the roster's bulk
            work lives with the roster rows. */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {peopleTab !== "roster" && (
        /* Disabled with the reason on it rather than hidden: a control that vanishes reads as a
           missing feature and sends the admin looking elsewhere for it. */
        <button
          onClick={() => manageAccess && setShowInvite(true)}
          disabled={!manageAccess}
          title={manageAccess ? undefined : t.reasonNotOwner}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: manageAccess ? "var(--primary-400)" : "var(--gray-100)", color: manageAccess ? "white" : "var(--gray-400)", fontSize: "10px", fontWeight: 700, cursor: manageAccess ? "pointer" : "not-allowed", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke={manageAccess ? "white" : "var(--gray-400)"} strokeWidth="1.22" strokeLinecap="round"/></svg>
          {t.inviteUser}
        </button>
        )}
        {/* Icons on the secondary tools too. Only the invite button had one, so on a page whose
            neighbours put a mark on every action these five read as unfinished — and a row of five
            identical grey pills is a row you have to read word by word. 14px at stroke 2.4 is the
            1.4px Portal draws (see ICON_STROKE_PX). */}
        {/* Filled on the roster tab, outlined on the combined one. Every page in Portal has one
            coloured action, and on this tab the invite button — the coloured one — is hidden,
            which left five grey pills and no answer to "what is the thing to do here". Adding a
            name to the roster is that thing. */}
        {/* On both tabs. The note above says the two ways of adding a person stay together on the
            combined tab, and the condition said the opposite — `!== "accounts"` hid it exactly
            there, leaving that tab with one button and no way to put a name on the roster without
            switching tabs first. Adding a person is the page's subject on either tab. */}
        <button
          onClick={() => setRosterEditorFor({ entry: null })}
          style={peopleTab === "roster"
            ? { ...SECONDARY_BTN, backgroundColor: "var(--primary-400)", border: "none", color: "white" }
            : SECONDARY_BTN}
        >
          <ClipboardPlus size={14} strokeWidth={2.4} />
          {t.addToRoster}
        </button>
        {peopleTab === "roster" && (<>
        <button onClick={() => setShowRosterImport(true)} style={SECONDARY_BTN}>
          <Upload size={14} strokeWidth={2.4} />
          {t.importRoster}
        </button>
        <button onClick={bulkIssueCodes} disabled={notIssuedIds.length === 0}
          style={{ ...SECONDARY_BTN, color: notIssuedIds.length === 0 ? "var(--gray-300)" : "var(--gray-600)", cursor: notIssuedIds.length === 0 ? "not-allowed" : "pointer" }}>
          <KeyRound size={14} strokeWidth={2.4} />
          {t.bulkIssue(notIssuedIds.length)}
        </button>
        <button onClick={() => {
            const n = exportRosterCsv(projectRosterAll, currentProject?.name ?? projectId, rt);
            showToast({ variant: "success", title: t.toastRosterExported(n) });
          }}
          disabled={projectRosterAll.length === 0}
          style={{ ...SECONDARY_BTN, color: projectRosterAll.length === 0 ? "var(--gray-300)" : "var(--gray-600)", cursor: projectRosterAll.length === 0 ? "not-allowed" : "pointer" }}>
          <Download size={14} strokeWidth={2.4} />
          {t.exportRoster}
        </button>
        <button onClick={() => setShowPrintSheet(true)} disabled={printableEntries.length === 0}
          style={{ ...SECONDARY_BTN, color: printableEntries.length === 0 ? "var(--gray-300)" : "var(--gray-600)", cursor: printableEntries.length === 0 ? "not-allowed" : "pointer" }}>
          <Printer size={14} strokeWidth={2.4} />
          {t.printHandout}
        </button>
        </>)}
        </div>
      </div>

      {/* Top-level cut of the list, with counts on the tabs — the same underlined row Input Sources
          uses for its kinds. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {([
          { id: "accounts", label: t.peopleTabAccounts, count: projectUsers.length, hint: t.peopleTabAccountsHint },
          { id: "roster", label: t.peopleTabRoster, count: rosterWaiting.length, hint: t.peopleTabRosterHint },
        ] as { id: "accounts" | "roster"; label: string; count: number; hint: string }[]).map(tab => {
          const active = peopleTab === tab.id;
          return (
            /* On the tab rather than a line under it. The tab name is a state ("On the roster"),
               which is the right name for what the tab holds but says nothing about what you came
               here to do; a permanent sentence answering that would be clutter for everybody who
               already knows. Our own Tooltip, not the browser's `title` — that one wants the
               pointer held still for over a second and this hint has to be findable. */
            <Tooltip key={tab.id} text={tab.hint}>
            <button onClick={() => setPeopleTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}>
              {tab.label}
              <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>{tab.count}</span>
            </button>
            </Tooltip>
          );
        })}
      </div>

      {!mailAvailable && <RecoveryModeNotice supportContact={authConfig.supportContact} />}

      <UserCountStrip users={projectUsers} rosterWaiting={rosterWaiting.length} statusFilter={statusFilter} onFilter={setStatusFilter} onShowGuide={() => setShowGuide(true)} />

      <AccessRequestsPanel projectId={projectId} />

      {/* Search alone. The permission and status filters that used to sit on the right are gone: the
          counts strip directly above already answers what they were for (how many owners, how many
          invited, how many suspended), the columns they filtered on are sortable, and a project's
          account list is short enough to read. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
      <div style={{ position: "relative", flex: 1, minWidth: "220px", maxWidth: "320px" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            // The shared control shape, with room on the left for the icon that sits at 12px:
            // 12 + 14 (icon) + 6 = 32, which keeps that gap on the spacing scale too.
            ...FIELD_STYLE, padding: "0 12px 0 32px",
            ...(searchFocused ? FIELD_FOCUS : null),
          }}
        />
      </div>

      </div>

      {/* No overflow:hidden here — it used to clip the header row's flat corners to match the
          card's rounded ones, but that also clips any row's RowActionsMenu dropdown that opens
          past the container's bottom edge (invisible, not just cut off). Radius the header row
          itself instead. */}
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
        {/* Column widths, and why they are these: the two columns that are usually "—" (Person
            Search, MFA) and Status, whose badge is a word, were each wider than their content, and
            the width had to come from somewhere — it came from Team and Projects, which are the
            long names, so on a narrow window they wrapped to three lines while Status sat in a
            cell with a hand's width of nothing to its right. Narrowing those three moves Status
            right, up against the actions menu where it belongs, and gives the names their room
            back. */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
          {/* Projects and MFA carry no sortKey: a user belongs to several projects, so there is no
              single value to order by, and MFA is display-only mock data it would be misleading to
              let anyone rank people with. */}
          {((showAccountColumns ? [
            { label: t.colUser, key: "name" },
            { label: t.colOtherProjects },
            { label: t.colPermission, key: "permission" },
            { label: t.colAccess },
            { label: t.colAppSearch },
            { label: t.colLastLogin, key: "lastLogin" },
            { label: t.colStatus, key: "status", align: "right" as const },
            { label: "" },
          ] : [
            // The roster tab's own set. "Permission on signup" is not the same column as an
            // account's Permission and does not pretend to be — it is what this person will be
            // granted when they redeem their code, which is the roster's own field.
            { label: t.colUser, key: "name" },
            { label: t.colPlannedPermission, key: "permission" },
            { label: t.colCode },
            { label: t.colStatus, key: "status", align: "right" as const },
            { label: "" },
          ]) as { label: string; key?: UserSortKey; align?: "left" | "right" }[]).map((h, i) => (
            <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} align={h.align} />
          ))}
        </div>
        {/* Per tab: each half answers for itself, and neither can speak for the other's rows. */}
        {(peopleTab === "accounts" ? scopedUsers.length : visibleRoster.length) === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
              {q ? t.emptySearch : peopleTab === "accounts" ? t.emptyNoUsers : t.rosterEmpty}
            </p>
          </div>
        )}
        {(peopleTab === "accounts" ? scopedUsers : []).map((u, i) => {
          const isLast = i === scopedUsers.length - 1;
          // Computed against the whole user list, not the filtered view: a project filter can hide
          // the other administrators, and "last one visible" is not "last one there is".
          const lastAdmin = isLastActiveAdmin(portalUsers, u.id);
          return (
          <div key={u.id} style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
            borderBottom: isLast ? "none" : BORDER,
            borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
          }}>
            <div style={{ minWidth: 0 }}>
              <p title={u.name} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
              <p title={u.email} style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
            </div>
            {/* The project this page is scoped to is on every row by definition, so listing it is
                a column of the same name repeated. What is not known is whether this person has
                anywhere else — which is the question behind removing them from here. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", minWidth: 0 }}>
              {(() => {
                const others = u.projectIds.filter(pid => pid !== projectId);
                if (others.length === 0) {
                  return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>{t.otherProjectsNone}</span>;
                }
                return others.map((pid, i) => (
                  <span key={pid} style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                    {i > 0 && <span style={{ color: "var(--gray-300)" }}>, </span>}
                    {projectName(pid)}
                  </span>
                ));
              })()}
            </div>
            {/* Only an owner may change this. For everyone else the cell reads as text — a select
                that opens and then refuses is worse than a value that never looked editable.

                An account with no Portal access has no role to pick, and offering one would imply
                a Portal role can be held without Portal. The cell says so and the Access select
                next to it is where that changes. */}
            {!canEnterPortal(u.permission) ? (
              <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
            ) : lastAdmin ? (
              /* The last owner's role is the one the store refuses to change (isLastActiveAdmin) —
                 demoting them locks the customer out of their own installation. As a select it
                 opened, offered three roles and then did nothing with the answer. Plain text with
                 the reason on it says the same thing without the dead end. */
              <span title={t.lastAdminRoleFixed} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{roleLabel(t, u.permission)}</span>
            ) : manageAccess ? (
              <FilterSelect
                fitContent
                value={u.permission}
                onChange={v => updatePortalUserPermission(u.id, v as PortalPermission)}
                options={consoleRoleOptions(t)}
              />
            ) : (
              <span title={t.reasonNotOwner} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{roleLabel(t, u.permission)}</span>
            )}
            {/* Where this person may sign in. Its own control rather than a fourth role, because it
                is a second question — see PortalPermission's doc. */}
            {manageAccess ? (
              <FilterSelect
                fitContent
                value={accessModeOf(u)}
                onChange={v => {
                  const next = applyAccessMode(v as AccessMode, u.permission);
                  updatePortalUserAccess(u.id, next.permission, next.appAccess);
                  // Say it when the change quietly hands out a Portal role the owner did not pick.
                  if (!canEnterPortal(u.permission) && canEnterPortal(next.permission)) {
                    showToast({ variant: "info", title: accessLabel(t, v as AccessMode), desc: t.accessGainsRoleNote(roleLabel(t, next.permission)) });
                  }
                }}
                /* App-only would strip Portal from the last owner, which the store refuses on the
                   same guard — so it is not offered on that row rather than offered and ignored.
                   Portal-only stays: taking the app away from an owner locks nobody out. */
                options={lastAdmin ? accessOptions(t).filter(o => o.value !== "appOnly") : accessOptions(t)}
              />
            ) : (
              <span title={t.reasonNotOwner} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{accessLabel(t, accessModeOf(u))}</span>
            )}
            {/* Search is a separate grant from the console role, so it gets its own column rather
                than being folded into the role label — the two answer different questions. The cell
                is always emitted, "—" included: this is a grid, so a conditional cell does not
                leave a hole, it slides every cell after it one column left and pushes the row's
                actions menu onto a second line. */}
            <span>
              {u.appSearch ? (
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "999px", backgroundColor: "var(--info-100)", color: "var(--info-500)", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {t.appSearchOn}
                </span>
              ) : (
                <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
              )}
            </span>
            <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{u.lastLoginAt ?? "—"}</span>
            {/* Right-aligned. Left-aligned, the badge sat at the near edge of its cell with a
                hand's width of nothing between it and the actions menu — most visible once the
                window narrows, which is when the columns to the left need that space most. */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <StatusBadge status={u.status} />
              {u.tempPasswordIssuedAt && <TempPasswordBadge issuedAt={u.tempPasswordIssuedAt} />}
              {u.setupCode && <SetupCodeBadge issuedAt={u.setupCodeIssuedAt} />}
            </div>
            {/* Two mail actions, because the two ways a person gets locked out need different
                messages: an invite that never arrived is resent, an account whose password is
                forgotten gets a reset. Resend only shows for users still sitting at "invited" —
                offering it for an active account would send a link that sets up an account which
                already exists. Both disappear entirely where there is no mail to send them with;
                that deployment recovers people through the temporary password below instead. */}
            {/* Every action in this menu grants or takes away a way in, so the whole menu is the
                owner's. A non-owner still sees the items with the reason attached — knowing the
                action exists and who can do it beats a menu that quietly has three fewer rows. */}
            <RowActionsMenu actions={[
              ...(mailAvailable && u.status === "invited" ? [{
                label: t.resendInvite,
                disabled: !manageAccess,
                reason: manageAccess ? undefined : t.reasonNotOwner,
                // A resend is a reissue: the previous link stops working, which is the point when
                // the first one has been sitting in a forwarded mail thread for a week.
                onClick: () => showToast({ variant: "success", title: t.inviteResentTitle, desc: `/password-setup?token=${issueInviteToken(u.id)}` }),
              }] : []),
              {
                // All three recovery paths behind one entry. Mailing a code, reading out a temporary
                // password and handing over a setup code do the same job — give this person a way
                // back in — and differ only in how it reaches them. Three menu items made the
                // administrator choose a mechanism; one item asks how they can reach the person and
                // derives the mechanism from that.
                label: t.resetPassword,
                onClick: () => setCredentialFor(u),
                disabled: !manageAccess,
                reason: manageAccess ? undefined : t.reasonNotOwner,
              },
              // The code's result screen says it can be looked up again from this menu while it is
              // unused — and until now it could not, so the modal was promising a menu item that
              // did not exist. Unlike a temporary password there is nothing wrong with showing it
              // twice: it is stored, because it has to be verifiable, and it cannot sign in.
              ...(u.setupCode ? [{
                label: t.viewSetupCode,
                onClick: () => setViewingCodeFor(u),
                disabled: !manageAccess,
                reason: manageAccess ? undefined : t.reasonNotOwner,
              }] : []),
              {
                label: u.appSearch ? t.appSearchRevoke : t.appSearchGrant,
                disabled: !manageAccess,
                reason: manageAccess ? undefined : t.reasonNotOwner,
                onClick: () => {
                  const next = !u.appSearch;
                  setConfirming({
                    title: next ? t.confirmSearchGrantTitle(u.name) : t.confirmSearchRevokeTitle(u.name),
                    body: next ? t.confirmSearchGrantBody : t.confirmSearchRevokeBody,
                    confirmLabel: next ? t.appSearchGrant : t.appSearchRevoke,
                    danger: !next,
                    onConfirm: () => {
                      setAppSearch(u.id, next);
                      showToast({
                        variant: next ? "success" : "warning",
                        title: next ? t.appSearchToastOn : t.appSearchToastOff,
                        desc: t.appSearchToastDesc(u.name),
                      });
                    },
                  });
                },
              },
              u.status === "suspended"
                ? {
                    label: t.reactivateUser,
                    disabled: !manageAccess,
                    reason: manageAccess ? undefined : t.reasonNotOwner,
                    onClick: () => setConfirming({
                      title: t.confirmReactivateTitle(u.name),
                      body: t.confirmReactivateBody,
                      confirmLabel: t.reactivateUser,
                      onConfirm: () => {
                        updatePortalUserStatus(u.id, "active");
                        showToast({ variant: "success", title: t.userReactivatedTitle, desc: u.name });
                      },
                    }),
                  }
                : {
                    label: t.suspendUser,
                    onClick: () => setConfirming({
                      title: t.confirmSuspendTitle(u.name),
                      body: t.confirmSuspendBody,
                      confirmLabel: t.suspendUser,
                      danger: true,
                      onConfirm: () => {
                        updatePortalUserStatus(u.id, "suspended");
                        showToast({ variant: "warning", title: t.userSuspendedTitle, desc: t.userSuspendedDesc(u.name) });
                      },
                    }),
                    danger: true,
                    // Refused, not warned about: this deployment is on-premise with the top
                    // administrator on the customer's side, so there is no supplier account to
                    // undo it with. The store refuses these too — see isLastActiveAdmin.
                    disabled: lastAdmin || !manageAccess,
                    reason: lastAdmin ? t.lastAdminReason : manageAccess ? undefined : t.reasonNotOwner,
                  },
              {
                label: t.removeUser, danger: true,
                onClick: () => setConfirming({
                  title: t.confirmRemoveTitle(u.name),
                  body: t.confirmRemoveBody,
                  confirmLabel: t.removeUser,
                  danger: true,
                  onConfirm: () => removePortalUser(u.id),
                }),
                disabled: lastAdmin || !manageAccess,
                reason: lastAdmin ? t.lastAdminReason : manageAccess ? undefined : t.reasonNotOwner,
              },
            ]} />
          </div>
          );
        })}

        {(peopleTab === "roster" ? visibleRoster : []).map((entry, i) => {
          const isLast = i === visibleRoster.length - 1;
          const stage = stageOfRosterEntry(entry.status);
          return (
            <div key={entry.employeeId} style={{
              display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
              borderBottom: isLast ? "none" : BORDER,
              borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
            }}>
              {/* The second line is the employee number, not an address: a roster row often has no
                  address at all (that is the reason this path exists), and the number is what the
                  code is handed over against. */}
              <div style={{ minWidth: 0 }}>
                <p title={entry.name} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</p>
                <p title={entry.email || entry.employeeId} style={{ fontSize: "12px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.email || entry.employeeId}</p>
              </div>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                    {entry.permission === "admin" ? rt.admin : rt.operator}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <RosterCodeCell entry={entry} onReveal={() => logRosterCodeViewed(entry.employeeId)} />
                  </div>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <StageBadge stage={stage} t={t} />
              </div>
              <RowActionsMenu actions={[
                { label: rt.editEntry, onClick: () => setRosterEditorFor({ entry }) },
                {
                  label: entry.code ? rt.reissueConfirm : rt.issueConfirm,
                  onClick: () => setIssuingEntry(entry),
                },
                { label: rt.remove, onClick: () => setRemovingEntry(entry), danger: true },
              ]} />
            </div>
          );
        })}
      </div>

      {rosterEditorFor && (
        <RosterEntryModal entry={rosterEditorFor.entry} projectId={projectId} onClose={() => setRosterEditorFor(null)} t={rt} />
      )}
      {issuingEntry && (
        <IssueConfirmModal entry={issuingEntry} t={rt}
          onClose={() => setIssuingEntry(null)}
          onConfirm={() => {
            if (issuingEntry.code) {
              reissueRegistrationCode(issuingEntry.employeeId);
              showToast({ variant: "success", title: rt.toastCodeReissuedTitle, desc: rt.toastCodeReissuedDesc(issuingEntry.name) });
            } else {
              issueRegistrationCodes([issuingEntry.employeeId]);
              showToast({ variant: "success", title: rt.toastCodeIssuedTitle, desc: issuingEntry.name });
            }
            setIssuingEntry(null);
          }} />
      )}
      {removingEntry && (
        <RemoveConfirmModal entry={removingEntry} t={rt}
          onClose={() => setRemovingEntry(null)}
          onConfirm={() => {
            removeRosterEntry(removingEntry.employeeId);
            showToast({ variant: "warning", title: rt.toastRemovedTitle, desc: removingEntry.name });
            setRemovingEntry(null);
          }} />
      )}
      {showGuide && <AccessGuideModal t={t} onClose={() => setShowGuide(false)} />}
      {showRosterImport && <RosterImportModal projectId={projectId} onClose={() => setShowRosterImport(false)} />}
      {showPrintSheet && (
        <PrintSheet entries={printableEntries} projectName={currentProject?.name ?? projectId} onClose={() => setShowPrintSheet(false)} t={rt} />
      )}

      {confirming && (
        <ConfirmModal
          title={confirming.title}
          body={confirming.body}
          confirmLabel={confirming.confirmLabel}
          cancelLabel={t.cancel}
          danger={confirming.danger}
          onConfirm={() => { confirming.onConfirm(); setConfirming(null); }}
          onClose={() => setConfirming(null)}
        />
      )}
      {showInvite && <InviteUserModal defaultProjectId={projectId} onClose={() => setShowInvite(false)} />}
      {credentialFor && (
        <TempPasswordModal user={credentialFor} mailAvailable={mailAvailable} onClose={() => setCredentialFor(null)} />
      )}
      {viewingCodeFor?.setupCode && (
        <TempPasswordModal
          user={viewingCodeFor}
          mailAvailable={mailAvailable}
          initialCode={viewingCodeFor.setupCode}
          onClose={() => setViewingCodeFor(null)}
        />
      )}
    </div>
  );
}
