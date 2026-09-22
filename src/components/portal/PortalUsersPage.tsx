"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Asterisk, Boxes, CircleHelp, ClipboardList, ClipboardPlus, KeyRound, KeySquare, MailQuestion, MonitorOff, MoreVertical, Pencil, Plus, UserMinus, UserX, Users as UsersIcon, Users2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, isNetworkIsolated, isLastActiveAdmin, canManageAccess, canEditPortal, canEnterPortal, currentPortalRole, currentPortalUser, resolveMailConfig, isMailDeliverable, presetsForTeam, grantsOfPreset, presetLabel, presetDescription, scopedCameraIds, cameraGroupsInProject, APP_ACTIONS, type AccessPreset, type AppAction, type Camera, type CameraGroup, type GrantMode, type PortalPermission, type PortalUser, type PortalUserStatus } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { RESET_CODE_TTL_MIN, TEMP_PASSWORD_VALIDITY_HOURS } from "@/lib/password";
import { SETUP_CODE_TTL_DAYS, codeDaysRemaining } from "@/lib/staffRoster";
import { getAuthConfig, hasOutboundMail } from "@/lib/authConfig";
import { useToast } from "../Toast";
import { SummaryStrip, TABLE_HEADER_COLOR, TextField, BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, TABLE_COLUMN_GAP, TOOLBAR_GAP, SearchInput, TableEmpty, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, ConfirmModal, Drawer, SectionNav, Tooltip, usePortalEditAccess, AppGrantList, useGrantNames, RequiredMark, PICKED_LINE, PICKED_FILL } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";
import CameraGroupsTab, { CameraGroupEditor } from "./CameraGroupsTab";
import AccessPresetsTab from "./AccessPresetsTab";
import { withEffectiveStatus, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import RosterImportModal from "./RosterImportModal";
import CameraScopePicker from "./CameraScopePicker";
import {
  ROSTER_T, RosterCodeCell, RosterEntryModal, IssueConfirmModal, RemoveConfirmModal, PrintSheet,
  exportRosterCsv,
} from "./ProjectRosterTab";

const T = {
  en: {
    // Page header
    inviteUser: "Invite user",
    searchPlaceholder: "Search by user name or email address",
    rosterSearchPlaceholder: "Search by name or employee ID",
    rosterFilterAll: "All states",
    rosterFilterNotIssued: "No code yet",
    rosterFilterIssued: "Code issued",
    rosterFilterExpired: "Code expired",
    scopeFilterAll: "Any camera scope",
    scopeFilterEvery: "Every camera",
    scopeFilterNarrowed: "Narrowed",
    scopeFilterNone: "No app access",

    // Role/status summary strip
    axisConsoleRole: "Console",
    axisDoor: "Signs in to",
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
    railPeople: "Users",
    railGrants: "Permissions",
    peopleTabAccounts: "Accounts",
    peopleTabRoster: "On the roster",
    // On the tabs themselves. The Accounts one answers the thing this table is most often read
    // wrongly for: an invited account is already here, before anybody has signed in with it.
    peopleTabAccountsHint: "Accounts that can reach this project — including people who have been invited and have not signed in yet.",
    peopleTabRosterHint: "On the staff roster with no account yet. Issue a registration code and hand it over on paper — they sign up without mail.",
    peopleTabPresets: "App presets",
    peopleTabPresetsHint: "Editing one reaches every account following it.",
    peopleTabGroups: "Camera groups",
    peopleTabGroupsFor: "for granting",
    peopleTabGroupsHint: "Named sets of cameras, handed out as one when granting camera access.",
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
    nothingToExport: "The roster is empty — there is nothing to export yet.",
    nothingToPrint: "No unused codes to print. A slip is printed once, for a code nobody has redeemed.",
    toastRosterExported: (n: number) => `${n} roster row(s) exported`,
    rosterEmpty: "Nobody is waiting on the roster.",
    toastBulkIssued: (n: number) => `${n} registration code(s) issued`,
    countPortalOnly: "Portal only",
    // WHAT THE FIGURE COUNTS, NOT THE NAME OF A STATE. "Invited 1" and "Suspended 1" read as a
    // status with a number stuck to it — the same figure the row's own badge already carries — and
    // the reader has to supply the sentence themselves. These say who is in the pile, so the
    // number has something to be a number OF. The tooltip stays: it explains the consequence,
    // which is a different job from naming the set.
    countInvited: "Invite not accepted",
    countSuspended: "Blocked from signing in",
    countTotal: "on this project",
    countPeopleUnit: "people",
    invitedHint: "Invited but has not set a password yet — they cannot sign in until they do.",
    suspendedHint: "Kept on the list but blocked from signing in.",
    countDormant: "No sign-in for 90 days",
    bulkSuspendTitle: (n: number) => (n === 1 ? "Suspend 1 account?" : `Suspend these ${n} accounts?`),
    bulkSuspendBody: "They stop being able to sign in immediately and stay on the list, so any of them can be restored without a new invitation. Nothing is deleted.",
    bulkSuspendCta: (n: number) => `Suspend ${n}`,
    bulkSuspendBar: (n: number) => (n === 1 ? "1 account shown" : `${n} accounts shown`),
    bulkSuspendAction: "Suspend all shown",
    bulkSuspendKept: (n: number) => `${n} left active — the last administrator cannot be suspended, and neither can your own account from here.`,
    bulkSuspendedToast: (n: number) => `${n} account${n === 1 ? "" : "s"} suspended`,
    // ONLY THE HALF THAT IS COUNTED. It promised "and accounts invited over 90 days ago that never
    // signed in" as well, and isDormant counts no such thing — PortalUser records no invitedAt, so
    // the age of an open invitation cannot be judged here (its own comment says so). The sentence
    // was describing an intention as if it were a figure. HANDOFF: the second half comes back the
    // day the server reports when an invitation was issued, not before.
    dormantHint: "Active accounts that have not signed in for 90 days. On a site whose staff rotate, these are the accounts nobody remembers to close.",

    // Toolbar filters

    // Table
    colUser: "User",
    colOtherProjects: "Other projects",
    alsoOn: (where: string) => `Also on: ${where}`,
    colProjects: "Projects",
    projectsCount: (n: number) => `${n}`,
    projectsOnlyThis: "This project only",
    otherProjectsNone: "This project only",
    colPermission: "Permission",
    colAccess: "Access",
    colAppSearch: "Person Search",
    colCameras: "Cameras",
    camerasAll: "All",
    camerasSome: (n: number, total: number) => `${n} / ${total}`,
    camerasFromGroups: (n: number) => `${n} group${n === 1 ? "" : "s"}`,
    camerasFromGroupsTitle: "Part of this scope comes from camera groups, so it grows when a group does. Individually picked cameras do not.",
    camerasNarrowedTitle: (n: number, total: number) => `Sees ${n} of the ${total} cameras on their projects, in the app.`,
    camerasAllTitle: "Sees every camera on their projects, including ones added later.",
    colLastLogin: "Last Login",
    colStatus: "Status",
    emptyNoUsers: "No users have access to this project yet.",
    emptyFiltered: "Nothing matches the current filter.",

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
    reasonNoApp: "This account has no app access — there are no screens to grant or to search on.",
    reasonNoPortal: "This account does not open Portal — change where they sign in first.",
    manageAccount: "Manage account",
    panelWhereSection: "Where they get in",
    panelWhatSection: "What they may do",
    panelAccountSection: "Getting back in",
    panelStatusSection: "Account status",
    panelGrants: "App screens",
    panelNoPortal: "No Portal",
    panelNoApp: "No app",
    panelProjectCount: (n: number) => `${n}`,
    reasonNotOwner: "Only an owner can change access.",
    appSearchOn: "On",
    appSearchGrant: "Allow person search",
    appSearchRevoke: "Block person search",
    appSearchToastOn: "Person search allowed",
    appSearchToastOff: "Person search blocked",
    appSearchToastDesc: (name: string) => `${name} — Data and Redmap searches`,
    reasonReadOnly: "Read-only admins cannot change settings.",
    statusActive: "Active",
    statusInvited: "Invited",
    statusSuspended: "Suspended",

    // Row actions
    // Not "Resend": nothing is posted anywhere (see InviteLinkPanel). This mints a fresh token
    // and puts the link on screen, which is a different act and has to read as one.
    // NO TRAILING ELLIPSIS ON ANY OF THESE, and that is the product's rule rather than this
    // menu's exception. The desktop convention (… means "this asks you something first") was
    // carried by exactly four labels here and by nothing else in the product: 카메라 추가,
    // 사용자 초대, CSV 가져오기, 편집, 프리셋 추가, 팀 만들기 and eleven more all open a form and
    // none of them carry one. A convention with four users is not a convention, and adding it to
    // the other seventeen would import a desktop-menu habit into a console that never used it.
    resendInvite: "New invite link",
    // The two cells that used to be a select on every row — see AccessChangeModal.
    changeRole: "Change Portal role",
    changeAccess: "Change where they sign in",
    changeGrants: "Change app permissions",
    changeScope: "Change which cameras",
    reasonNoScopeWithoutApp: "This account cannot reach the app, so there are no cameras to narrow.",
    reasonNoCamerasToScope: "No cameras are registered on this account's projects yet.",
    reasonNoAppScreens: "This account has no app access — there are no screens to grant or to search on.",
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
    // The reversal is in the sentence now, not just in the code: the red button used to carry the
    // weight of this dialog, and taking it away (red is for what cannot be undone) left a body
    // that said only what stops working. Nothing is deleted here — the grant is one menu item
    // away, for as long as the account still has the app to search in.
    confirmSearchRevokeBody: "Person search in the app stops working for them. Nothing is deleted and their console permission is unchanged — the same menu allows it again while they still have app access.",
    confirmRoleTitle: (name: string) => `Change ${name}'s Portal role?`,
    confirmRoleBody: "Takes effect at once. A higher role can hand out and take away other people's access; a lower one closes Portal screens this person may be working in.",
    confirmAccessTitle: (name: string) => `Change where ${name} signs in?`,
    // True as of faedeb5 and not before: updatePortalUserAccess used to empty appScreens, so the
    // old sentence's "everything they registered stays" was false about app grants. It writes the
    // two doors now and touches nothing behind them.
    confirmAccessBody: "Takes effect at once. Closing a door stops them signing in through it. The account, everything they registered and their app screens stay — reopen the door and the same screens come back.",
    // The confirm on every dialog that changes what one account holds — role, sign-in doors,
    // projects, app screens. Three of them are the same decision at the same weight, and two used
    // to say "Save": a form saves, an access change takes effect on somebody who is signed in, and
    // the button that does the second should not borrow the word for the first.
    changeApply: "Change",

    // Row action toasts
    inviteLinkRemadeTitle: "New invite link",
    // "Sent" was a lie: this path posts nowhere (see the note on generate()). The title says what
    // the administrator did, and the second line says what did NOT happen — the same shape
    // ProjectServerTab's mail-settings toast uses, for the same reason.
    resetCodeRequestedTitle: "Reset code requested",
    resetCodeRequestedDesc: (email: string) => `For ${email}. Nothing has gone out through the mail relay yet.`,
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
    // Not "is sent" — nothing leaves the building yet (see the HANDOFF note in `generate`), and
    // the toast that follows already says so. The console asks the relay; the relay delivers.
    mailConsequenceSend: (email: string) => `A reset code is requested for ${email}. You never see it.`,
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
    sendCode: "Request code",
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
    // OWNER, not "administrator". The condition behind this banner counts canManageAccess — the
    // owner role — and the copy said administrator, which is a DIFFERENT role in the same picker
    // (permOwner vs permAdmin). Somebody following the instruction promotes an Admin, the count
    // does not move, the banner stays, and the product reads as broken. The comment over the
    // condition already recorded that the COUNT was fixed to owners; the sentence was not.
    // Korean was worse: this family called one role 관리자, 최고관리자 and 소유자 in four strings.
    /* Was "there is no way back in", which is no longer true and was arguably never quite true:
       the server promotes its seed account to owner on boot when no active owner is left. What IS
       true is that the way back is not in Portal — it needs somebody with access to the machine,
       which on an isolated site may be a different company and a scheduled visit. The named
       recovery command is deliberately absent until it exists; naming it now would be a promise
       this console cannot keep. */
    // Two sentences, because this renders as a footnote inside a dropdown. The reasoning behind the
    // rule — with nobody in this role no one can grant permissions and there is no way back in —
    // belongs in isLastActiveAdmin's comment, not in a 280px menu.
    lastAdminReason: "The only owner who can sign in. Make someone else an owner first.",
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
    // THE MARKERS MATCH THE BUTTON'S OWN TEST, which is the only thing that makes them worth
    // printing. Name, the address and at least one project each hold the Invite button disabled
    // (see canInvite) and carried no mark, while "App grants" on the right carried the only one on
    // the form — so the form marked the field the reader cannot leave blank and said nothing about
    // the three they can. Team is deliberately unmarked: canInvite tests it, and the select is
    // seeded with the team that owns this page's project and has no empty option, so it is not a
    // field anybody can fail. Cameras is unmarked because it does not block — an unanswered scope
    // means every camera on the ticked projects, which is the row's own sentence.
    nameLabel: "Name",
    namePlaceholder: "Full name",
    emailLabel: "Email",
    teamLabel: "Team",
    accessLabel: "Sign-in scope",
    permissionLabel: "Portal role",
    projectsLabel: "Projects",
    sectionWho: "Who",
    sectionWhere: "Where",
    foldGrant: "Permissions",
    foldTeam: "Team",
    scopeLabel: "Cameras",
    scopeNoProject: "Tick a project to see how many cameras that is.",
    scopeNoCameras: "No cameras are registered on the ticked projects yet.",
    scopeGroupsNone: "No camera groups on these projects yet.",
    scopeAll: "All cameras",
    scopeLater: "Cameras added later are included too.",
    scopeNewGroup: "New group",
    scopeEditGroup: (label: string) => `Edit ${label}`,
    scopeGroupCount: (n: number) => `${n}`,
    scopeHeldAll: (n: number) => `Every camera on their projects — ${n} today, and any added later.`,
    scopeHeldSome: (n: number, total: number) => `${n} of ${total} cameras.`,
    scopePick: "Choose cameras",
    // WHAT THE SITE CAN REACH, NOT A SEND THAT DOES NOT HAPPEN. These three lines used to read
    // "Invite will be sent by external email…" — a future-tense promise made one button before the
    // panel that says, in as many words, that nothing has been sent and the link is handed over by
    // hand. The address still matters (it is the account's identity, and errDomain refuses one this
    // installation cannot deliver to), so the constraint stays and only the promise goes.
    // HANDOFF NOTE: the 2026-08-28 decision is that the backend mails the invite. When it does,
    // this is where the transport sentence comes back — with the send actually behind it.
    mailNoteIsolated: (names: string) => `${names} has no external internet. Only an address on that site's own mailbox can be reached.`,
    cancel: "Cancel",
    errEmail: "That is not an email address.",
    errDuplicate: "An account already uses this address.",
    errDomain: (d: string) => `Accounts must be on @${d} — mail to anything else is not deliverable from this installation.`,
    editProjects: "Change projects",
    projectsModalTitle: "Projects",
    projectsPickedCount: (n: number, total: number) => `${n} of ${total} selected`,
    projectsModalIntro: (name: string) => `Which of this team's projects ${name} may open. A project they are not given stops appearing in their app.`,
    projectsModalNoneWarning: "At least one project. An account with no projects signs in to an empty app with no sign that anything was taken away — suspend the account instead.",
    projectsUpdatedTitle: "Projects updated",
    sendInvite: "Create invite link",
    inviteCreatedTitle: "Account created",
    // On the panel that carries the link, in all three places one is made.
    // No longer "from the row menu": that item is offered only while the installation has outbound
    // mail (see the resendInvite entry's condition), so on a site without it the sentence named a
    // control the reader could not find. What is true everywhere is the token — one per account, so
    // whichever screen mints the next one kills this link.
    inviteLinkNote: "Nothing has been sent — hand this link over yourself. It is not shown again, and a later link for the same person retires this one.",

    // Access requests panel
    accessRequestsTitle: (count: number) => `Access Requests (${count})`,
    approveSelected: (count: number) => `Approve ${count} selected`,
    dismiss: "Dismiss",
    approve: "Approve",
    requestedAgo: (elapsed: string) => `Requested ${elapsed} ago`,
    requestedLoading: "Requested …",
    accessApprovedTitle: "Access approved — account created",
    accountsCreatedTitle: (count: number) => `${count} accounts created`,
    grantLabel: "App grants",
    grantCustom: "Custom",
    grantCustomDesc: "Pick what they may do, one action at a time",
    customDiff: (preset: string, plus: string, minus: string) =>
      `${preset}${plus ? ` + ${plus}` : ""}${minus ? ` − ${minus}` : ""}`,
    customSameAsPreset: (preset: string) =>
      `This is exactly ${preset}'s set. Following the preset instead keeps them in step with it when it changes.`,
    grantNotChosen: "Choose how this account's grants are decided",
    grantNoScreens: "Tick at least one screen — an account with none cannot open the app",
    grantsHeading: "What this grants",
    grantsLocked: "Follows the preset. Choose Custom to change individual items.",
    grantsModalTitle: "App permissions",
    grantsModalIntro: (name: string) => `${name} — what they may do in the monitoring app`,
    // Named before it happens, not reported after. Following a preset means holding its grants, so
    // anything tuned by hand since goes — and the person doing it is usually the person who tuned it.
    grantsOverwriteWarning: "This account has grants set by hand. Following this preset replaces them.",
    grantsUnchanged: "Nothing changed yet.",
    // Names the missing thing rather than reporting an absence — "No screens" in a cell about app
    // access could be read as "this account has no app". It is an amber badge in the row now, so
    // it has to say what is not set.
    grantsHeldNone: "No app screens",
    fixGrants: "Choose screens",
    countNoScreens: "No app screens set",
    // "Once nothing else stops them" earns its clause: the gate tests suspended and invited first,
    // so this is the refusal waiting behind those, not necessarily the one they meet today.
    noScreensHint: "The app is one of their doors and not one screen is granted, so there is nothing for them to open. Once nothing else stops them, sign-in turns them away with \"no screens have been assigned to this account\" — set the screens here and it clears.",
    grantsSavedTitle: "App screens updated",
    grantsSavedDesc: (name: string) => `${name}'s grants take effect the next time they open the app.`,
    grantsPortalOnly: "A Portal-only account has no app screens to grant.",
  },
  ko: {
    // Page header
    inviteUser: "사용자 초대",
    searchPlaceholder: "사용자 이름 또는 이메일 주소로 검색",
    rosterSearchPlaceholder: "이름 또는 사번으로 검색",
    /* 「모든 코드 상태」였다 (사용자: 표현이 어색해 · 그냥 상태 전체 이런게 나을것같아). 필터의
       기본값은 무엇으로 거르는지를 설명할 자리가 아니다 — 거르지 않는다는 말이면 된다. */
    rosterFilterAll: "상태 전체",
    rosterFilterNotIssued: "미발급",
    rosterFilterIssued: "발급됨",
    rosterFilterExpired: "만료됨",
    scopeFilterAll: "모든 카메라 범위",
    scopeFilterEvery: "전체 카메라",
    scopeFilterNarrowed: "좁혀진 범위",
    scopeFilterNone: "앱 접근 없음",

    // Role/status summary strip
    axisConsoleRole: "포털 역할",
    axisDoor: "로그인",
    countOwners: "최고관리자",
    countAdmins: "관리자",
    countAuditors: "읽기 전용",
    countAppOnly: "앱 전용",
    whatRolesMean: "권한 안내",
    guideTitle: "접근과 역할",
    guideLead: "접근은 계정에 열리는 문을 정하고, 역할은 Portal 안에서 할 수 있는 일을 정합니다.",
    guideRolesHeading: "Portal 역할 — 서로 다른 것만",
    guideRowGrant: "사용자 · 권한 부여",
    guideRowSettings: "카메라 · VIP · 명부 · 라이선스 · 서버",
    guideRowAudit: "감사 로그",
    guideEdit: "변경",
    guideViewOnly: "보기만",
    guideView: "보기",
    guideNone: "접근 없음",
    guideSameNote: "나머지 Portal 화면은 모두 설정 행과 똑같이 동작합니다 — 최고관리자와 관리자의 차이는 하나뿐이고, 그게 첫 줄입니다.",
    guideAppHeading: "앱 안에서",
    guideAppSearchNote: "인물 검색은 계정마다 따로 부여하며 Portal 역할과 무관합니다 — 앱 전용 운영자가 가질 수도 있고, Portal 관리자가 없을 수도 있습니다.",
    guideClose: "닫기",
    railPeople: "사용자",
    railGrants: "권한",
    peopleTabAccounts: "계정",
    peopleTabRoster: "명부 대기",
    peopleTabAccountsHint: "이 프로젝트에 닿을 수 있는 계정입니다 — 초대만 받고 아직 로그인하지 않은 사람도 포함합니다.",
    peopleTabRosterHint: "명부에 있고 아직 계정이 없는 사람입니다. 등록 코드를 발급해 종이로 건네면 메일 없이 가입합니다.",
    peopleTabPresets: "앱 권한 프리셋",
    peopleTabPresetsHint: "하나를 고치면 그것을 따르는 계정 전부에 닿습니다.",
    peopleTabGroups: "카메라 그룹",
    peopleTabGroupsFor: "권한용 묶음",
    peopleTabGroupsHint: "이름 붙인 카메라 묶음입니다. 카메라 권한을 줄 때 한 덩어리로 줍니다.",
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
    nothingToExport: "명부가 비어 있어 내보낼 것이 없습니다.",
    nothingToPrint: "인쇄할 미사용 코드가 없습니다. 슬립은 아직 아무도 쓰지 않은 코드에 대해 한 번 찍습니다.",
    toastRosterExported: (n: number) => `명부 ${n}개 행을 내보냈습니다`,
    rosterEmpty: "명부에서 기다리는 사람이 없습니다.",
    toastBulkIssued: (n: number) => `등록 코드 ${n}개를 발급했습니다`,
    countPortalOnly: "Portal 전용",
    countInvited: "초대 수락 안 함",
    countSuspended: "로그인 차단됨",
    countTotal: "이 프로젝트 인원",
    countPeopleUnit: "명",
    invitedHint: "초대는 됐지만 아직 비밀번호를 설정하지 않았습니다 — 설정 전까지 로그인할 수 없습니다.",
    suspendedHint: "목록에는 남아 있지만 로그인이 차단된 상태입니다.",
    countDormant: "90일 이상 미접속",
    bulkSuspendTitle: (n: number) => `계정 ${n}개를 정지할까요?`,
    bulkSuspendBody: "즉시 로그인이 막히고 목록에는 그대로 남습니다. 그래서 다시 필요해지면 새로 초대하지 않고 되돌릴 수 있습니다. 삭제되는 것은 없습니다.",
    bulkSuspendCta: (n: number) => `${n}개 정지`,
    bulkSuspendBar: (n: number) => `표시된 계정 ${n}개`,
    bulkSuspendAction: "표시된 계정 모두 정지",
    bulkSuspendKept: (n: number) => `${n}개는 활성으로 남습니다 — 마지막 관리자와 본인 계정은 여기서 정지할 수 없습니다.`,
    bulkSuspendedToast: (n: number) => `계정 ${n}개를 정지했습니다`,
    dormantHint: "90일 넘게 로그인하지 않은 활성 계정입니다. 인력이 도는 현장에서 아무도 닫는 것을 기억하지 못하는 계정이 이것입니다.",

    // Toolbar filters

    // Table
    colUser: "사용자",
    colOtherProjects: "다른 프로젝트",
    alsoOn: (where: string) => `이곳에도 있음: ${where}`,
    colProjects: "관리 프로젝트",
    projectsCount: (n: number) => `${n}`,
    projectsOnlyThis: "이 프로젝트만",
    otherProjectsNone: "이 프로젝트만",
    colPermission: "권한",
    colAccess: "접근",
    colAppSearch: "인물 검색",
    colCameras: "카메라",
    camerasAll: "전체",
    camerasSome: (n: number, total: number) => `${n} / ${total}`,
    camerasFromGroups: (n: number) => `그룹 ${n}`,
    camerasFromGroupsTitle: "이 범위의 일부가 카메라 그룹에서 나옵니다. 그룹이 커지면 이 범위도 같이 커집니다. 개별로 고른 카메라는 그렇지 않습니다.",
    camerasNarrowedTitle: (n: number, total: number) => `앱에서 담당 프로젝트 카메라 ${total}대 중 ${n}대만 봅니다.`,
    camerasAllTitle: "담당 프로젝트의 카메라를 전부 봅니다. 나중에 추가되는 것도 포함합니다.",
    colLastLogin: "마지막 로그인",
    colStatus: "상태",
    emptyNoUsers: "이 프로젝트에 접근 권한이 있는 사용자가 아직 없습니다.",
    emptyFiltered: "지금 조건에 맞는 항목이 없습니다.",

    // Permission / status / MFA display labels
    permOwner: "최고관리자",
    permAdmin: "관리자",
    permAuditor: "읽기 전용 관리자",
    permNone: "Portal 역할 없음",
    permOwnerDesc: "권한을 주고 회수하고, 사람을 지웁니다. 이걸 할 수 있는 유일한 역할입니다.",
    permAdminDesc: "카메라·VIP 등록·명부·라이선스를 바꿉니다. 누가 접근하는지는 못 바꿉니다.",
    permAuditorDesc: "Portal의 모든 화면과 감사 로그를 봅니다. 아무것도 바꾸지 않습니다.",
    permNoneDesc: "Portal에는 들어오지 않습니다.",
    accessBoth: "Portal + 앱",
    accessAppOnly: "앱만",
    accessPortalOnly: "Portal만",
    accessBothDesc: "설정 콘솔과 관제 앱 둘 다.",
    accessAppOnlyDesc: "로그인하면 바로 관제 앱. Portal은 못 봅니다.",
    accessPortalOnlyDesc: "설정 콘솔만 — 관제 앱은 못 씁니다.",
    accessGainsRoleNote: (role: string) => `${role} 역할로 들어갑니다. 올리기 전까지는 바꾸는 게 없습니다.`,
    reasonNoApp: "앱 접근이 없는 계정입니다 — 지정하거나 검색할 화면이 없습니다.",
    reasonNoPortal: "Portal을 열지 않는 계정입니다 — 로그인 위치를 먼저 바꾸세요.",
    manageAccount: "계정 관리",
    panelWhereSection: "들어가는 곳",
    panelWhatSection: "할 수 있는 일",
    panelAccountSection: "다시 들어가게 하기",
    panelStatusSection: "계정 상태",
    panelGrants: "앱 화면",
    panelNoPortal: "Portal 없음",
    panelNoApp: "앱 없음",
    panelProjectCount: (n: number) => `${n}곳`,
    reasonNotOwner: "권한 변경은 최고관리자만 할 수 있습니다.",
    appSearchOn: "허용",
    appSearchGrant: "인물 검색 허용",
    appSearchRevoke: "인물 검색 차단",
    appSearchToastOn: "인물 검색을 허용했습니다",
    appSearchToastOff: "인물 검색을 차단했습니다",
    appSearchToastDesc: (name: string) => `${name} — Data · Redmap 검색`,
    reasonReadOnly: "읽기 전용 관리자는 설정을 바꿀 수 없습니다.",
    statusActive: "활성",
    statusInvited: "초대됨",
    statusSuspended: "정지됨",

    // Row actions
    resendInvite: "초대 링크 다시 만들기",
    changeRole: "Portal 역할 변경",
    changeAccess: "로그인 위치 변경",
    changeGrants: "앱 권한 변경",
    changeScope: "볼 수 있는 카메라 변경",
    reasonNoScopeWithoutApp: "앱에 접근할 수 없는 계정이라 좁힐 카메라가 없습니다.",
    reasonNoCamerasToScope: "이 계정의 프로젝트에 등록된 카메라가 아직 없습니다.",
    reasonNoAppScreens: "앱 접근이 없는 계정입니다 — 지정하거나 검색할 화면이 없습니다.",
    generateTempPassword: "임시 비밀번호 생성",
    resetPassword: "비밀번호 재설정",
    sendCode: "코드 요청",
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
    lastAdminReason: "로그인할 수 있는 유일한 최고관리자입니다. 다른 사람을 먼저 최고관리자로 지정하세요.",
    lastAdminRoleFixed: "유일한 최고관리자입니다 — 다른 최고관리자가 생기기 전까지 역할을 바꿀 수 없습니다.",
    reactivateUser: "재활성화",
    suspendUser: "정지",
    removeUser: "제거",

    confirmSuspendTitle: (name: string) => `${name} 님을 정지할까요?`,
    confirmSuspendBody: "즉시 로그아웃되며, 최고관리자가 다시 활성화하기 전까지 로그인할 수 없습니다. 등록한 내용은 삭제되지 않습니다.",
    confirmReactivateTitle: (name: string) => `${name} 님을 재활성화할까요?`,
    confirmReactivateBody: "바로 다시 로그인할 수 있게 되며, 정지 전에 가지고 있던 권한이 그대로 복구됩니다.",
    confirmRemoveTitle: (name: string) => `${name} 님을 제거할까요?`,
    confirmRemoveBody: "계정과 권한이 삭제됩니다. 이 메뉴로는 되돌릴 수 없고, 다시 들어오게 하려면 새로 초대해야 합니다.",
    confirmSearchGrantTitle: (name: string) => `${name} 님에게 인물 검색을 허용할까요?`,
    confirmSearchGrantBody: "앱의 Data · Redmap 검색에서 등록된 인물을 모두 조회할 수 있게 됩니다.",
    confirmSearchRevokeTitle: (name: string) => `${name} 님의 인물 검색을 차단할까요?`,
    confirmSearchRevokeBody: "앱에서 인물 검색이 동작하지 않게 됩니다. 삭제되는 것은 없고 콘솔 권한도 그대로이며, 앱 접근이 남아 있는 동안에는 같은 메뉴에서 다시 허용할 수 있습니다.",
    confirmRoleTitle: (name: string) => `${name} 님의 Portal 역할을 바꿀까요?`,
    confirmRoleBody: "즉시 적용됩니다. 역할을 올리면 다른 사람의 접근까지 주고 뺏을 수 있게 되고, 내리면 지금 보고 있던 Portal 화면이 닫힙니다.",
    confirmAccessTitle: (name: string) => `${name} 님이 로그인하는 곳을 바꿀까요?`,
    confirmAccessBody: "즉시 적용됩니다. 문을 닫으면 그쪽으로는 로그인할 수 없게 되고, 계정·등록한 내용·앱 화면 권한은 그대로 남습니다 — 문을 다시 열면 같은 화면이 돌아옵니다.",
    changeApply: "변경",

    // Row action toasts
    inviteLinkRemadeTitle: "새 초대 링크",
    resetCodeRequestedTitle: "재설정 코드 요청됨",
    resetCodeRequestedDesc: (email: string) => `${email} 앞. 아직 메일 릴레이로 나간 것은 없습니다.`,
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
    mailConsequenceSend: (email: string) => `${email} 앞으로 재설정 코드를 요청합니다. 관리자는 코드를 보지 않습니다.`,
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
    /* A NOUN, LIKE EVERY OTHER LABEL ON THIS FORM (owner, 2026-09-22: 어디로 로그인하나 이건
       단어가 어색해, 통일감 있게 명사형으로). Its neighbours are 이메일 · 이름 · 프로젝트 ·
       Portal 역할 · 권한 · 카메라 범위 · 팀, and one label phrased as a question read as a
       different kind of thing. 「범위」 rather than 「위치」 or 「대상」 because it pairs with the
       카메라 범위 below it: both answer "how far does this account reach". */
    accessLabel: "로그인 범위",
    permissionLabel: "Portal 역할",
    projectsLabel: "프로젝트",
    sectionWho: "누구를",
    sectionWhere: "어디에",
    foldGrant: "권한",
    foldTeam: "팀",
    scopeLabel: "카메라 범위",
    scopeNoProject: "프로젝트를 고르면 몇 대인지 나옵니다.",
    scopeNoCameras: "고른 프로젝트에 등록된 카메라가 아직 없습니다.",
    scopeGroupsNone: "이 프로젝트에 카메라 그룹이 아직 없습니다.",
    scopeAll: "전체 카메라",
    scopeLater: "나중에 추가되는 카메라도 포함됩니다.",
    scopeNewGroup: "새 그룹",
    scopeEditGroup: (label: string) => `${label} 편집`,
    scopeGroupCount: (n: number) => `${n}`,
    scopeHeldAll: (n: number) => `담당 프로젝트의 카메라 전부 — 지금 ${n}대, 나중에 추가되는 것도 포함합니다.`,
    scopeHeldSome: (n: number, total: number) => `${total}대 중 ${n}대.`,
    scopePick: "카메라 고르기",
    /* 「…에는」 rather than 「…는」: a project's name can end in either a vowel or a consonant —
       and half of them are English — so no single subject particle is correct for all of them.
       This is the same trap the camera scope sentence was rewritten to avoid. */
    mailNoteIsolated: (names: string) => `${names}에는 외부 인터넷이 없습니다. 사이트 안의 메일 주소로만 초대가 닿습니다.`,
    cancel: "취소",
    errEmail: "이메일 주소 형식이 아닙니다.",
    errDuplicate: "이미 이 주소를 쓰는 계정이 있습니다.",
    errDomain: (d: string) => `계정은 @${d} 주소여야 합니다 — 이 설치본에서 다른 주소로는 메일이 나가지 않습니다.`,
    editProjects: "담당 프로젝트 변경",
    projectsModalTitle: "프로젝트",
    projectsPickedCount: (n: number, total: number) => `${total}곳 중 ${n}곳 선택`,
    projectsModalIntro: (name: string) => `${name} 님이 열 수 있는 이 팀의 프로젝트입니다. 주지 않은 프로젝트는 앱에서 보이지 않습니다.`,
    projectsModalNoneWarning: "최소 한 개는 있어야 합니다. 프로젝트가 없는 계정은 아무것도 없는 앱에 로그인하게 되고, 무엇이 회수됐는지 알 방법이 없습니다. 그럴 땐 계정을 정지하세요.",
    projectsUpdatedTitle: "프로젝트가 변경되었습니다",
    sendInvite: "초대 링크 만들기",
    inviteCreatedTitle: "계정이 만들어졌습니다",
    inviteLinkNote: "발송된 것은 없습니다 — 이 링크를 직접 전달하세요. 다시 볼 수 없고, 같은 사람에게 링크를 새로 만들면 이 링크는 못 쓰게 됩니다.",

    // Access requests panel
    accessRequestsTitle: (count: number) => `접근 요청 (${count}건)`,
    approveSelected: (count: number) => `선택한 ${count}건 승인`,
    dismiss: "무시",
    approve: "승인",
    requestedAgo: (elapsed: string) => `${elapsed} 전 요청됨`,
    requestedLoading: "요청됨 …",
    accessApprovedTitle: "접근 승인됨 — 계정이 만들어졌습니다",
    accountsCreatedTitle: (count: number) => `계정 ${count}개가 만들어졌습니다`,
    grantLabel: "권한 부여 방식",
    grantCustom: "커스텀",
    /* No full stop: it sits in the same place as the three preset lines, which have none. */
    grantCustomDesc: "할 수 있는 일을 하나씩 고릅니다",
    customDiff: (preset: string, plus: string, minus: string) =>
      `${preset}${plus ? ` + ${plus}` : ""}${minus ? ` − ${minus}` : ""}`,
    customSameAsPreset: (preset: string) =>
      `${preset} 프리셋과 똑같은 조합입니다. 프리셋을 따르게 두면 그 프리셋이 바뀔 때 함께 바뀝니다.`,
    grantNotChosen: "권한 부여 방식을 선택해주세요",
    grantNoScreens: "화면을 하나 이상 골라주세요 — 하나도 없으면 앱을 열 수 없습니다",
    grantsHeading: "이 방식이 켜는 것",
    grantsLocked: "프리셋을 따릅니다. 하나씩 바꾸려면 커스텀을 고르세요.",
    grantsModalTitle: "앱 권한",
    grantsModalIntro: (name: string) => `${name} — 관제 앱에서 할 수 있는 일`,
    grantsOverwriteWarning: "이 계정은 손으로 조정한 권한을 갖고 있습니다. 이 프리셋을 따르면 그것이 대체됩니다.",
    grantsUnchanged: "아직 바뀐 것이 없습니다.",
    grantsHeldNone: "앱 화면 미지정",
    fixGrants: "화면 지정",
    countNoScreens: "앱 화면 미지정",
    noScreensHint: "앱이 이 계정의 문 중 하나인데 볼 화면이 하나도 지정되지 않았습니다. 다른 이유로 막히는 것이 없어지는 순간, 로그인 단계에서 「볼 화면이 지정되지 않은 계정입니다」로 되돌려보냅니다. 여기서 화면을 지정하면 풀립니다.",
    grantsSavedTitle: "앱 화면 권한을 바꿨습니다",
    grantsSavedDesc: (name: string) => `${name}이(가) 다음에 앱을 열 때부터 적용됩니다.`,
    grantsPortalOnly: "Portal만 쓰는 계정에는 부여할 앱 화면이 없습니다.",
  },
} as const;

/** A checkbox that reads as a chip. Used where a handful of flags sit in one row. */
/**
 * One grant, as a row: what it is, what it lets somebody do, and whether this account has it.
 *
 * This replaced a row of pills. Seven pills side by side read as one control with seven states —
 * you could not tell at a glance which were on, and nothing said what any of them meant. A grant
 * is a sentence about what a person may do, so it needs the width of a sentence. Stripe, Whop and
 * Grok all put these in a list beside the role rather than as chips under it, for the same reason.
 *
 * `locked` is not `disabled` in the cosmetic sense — a preset-mode account genuinely holds these
 * and the reader has to be able to see which, so the row stays legible and only stops responding.
 * Hiding them would answer "what does this preset do?" with silence.
 */
/**
 * The two questions that decide an account's app grants: how they are decided, and what they are.
 *
 * ONE COMPONENT BECAUSE IT HAS TO READ THE SAME IN BOTH PLACES. An administrator learns this pair
 * once, at invite time, and meets it again a month later when somebody changes jobs. Two separate
 * arrangements of the same question would make the second one a new thing to learn, and the answer
 * it collects is who may look at what.
 *
 * It holds no state. The caller owns the draft, because the two callers resolve it differently —
 * an invite starts with nothing chosen, an edit starts from what the account already holds.
 */
function GrantPicker({ presets, choice, onChoice, actions, onToggleAction, hideTitle, t }: {
  presets: AccessPreset[];
  choice: string | null;
  onChoice: (id: string) => void;
  /**
   * Drop the "how grants are decided" heading, for the caller whose own row already says it.
   *
   * Display only — the pair of questions and every answer stays identical in both callers, which
   * is this component's whole reason to exist. The invite dialog folds this list under a row
   * labelled 권한, and a heading repeating that word inside the fold is the same word twice.
   */
  hideTitle?: boolean;
  /** What the list shows — already resolved by the caller, which is not always the custom draft. */
  actions: AppAction[];
  onToggleAction: (action: AppAction) => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  const isCustom = choice === "custom";
  /* The three presets we ship carry a key and are printed as product strings; a preset the
     customer made is printed as they typed it. Without this the English console showed 운영자 /
     조사자 / 감독자 in a list of English rows. See AccessPreset.builtinKey. */
  const [lang] = usePortalLanguage();
  const grantNames = useGrantNames();
  const grantOptions = [
    ...presets.map(pr => ({ id: pr.id, label: presetLabel(pr, lang), desc: presetDescription(pr, lang) })),
    { id: "custom", label: t.grantCustom, desc: t.grantCustomDesc },
  ];
  const chosenOption = grantOptions.find(o => o.id === choice);
  return (
    <>
      <div>
        {/* THE COLUMN'S TITLE, IN THE STYLE THE OTHER TWO USE. It was a 12px field label like the
            nine above it, which made the right half look like a tenth field rather than the
            second question. Promoted rather than topped with new copy: a head reading "what they
            may do" above a list already labelled 할 수 있는 일 is the same words twice. Both
            callers get it — the edit modal's column starts here too, and the pair reading the
            same in both places is this component's whole reason to exist. */}
        {!hideTitle && <label style={{ ...SECTION_HEAD, display: "block", marginBottom: "10px" }}>{t.grantLabel}<RequiredMark /></label>}
        {/*
          ACROSS, NOT DOWN (owner, 2026-09-22: 권한 프리셋들은 가로로 버튼 정렬 바꿔주고 커스텀은
          누르면 그 아래로 또 공간 필요하니까).

          Four full-width cards, each with a radio and a line of prose, ran 4×56px down the middle
          of a 520px panel — and then 커스텀 needed the action list under them, so the one question
          took most of the panel before the cameras had been asked about. As a row of names it is
          one 32px line, and the space it gives back is what 커스텀 opens into.

          The descriptions do not disappear, they MOVE: the chosen one is printed in the block
          below, where the actions it switches on are already listed. Four descriptions at once
          were there to choose BY; one description is there to check what you chose. The names
          alone carry the choosing — 운영자 · 조사자 · 감독자 are this product's own ladder, and
          the block below says what each rung means the moment it is picked.
        */}
        <div style={{ display: "flex", gap: "6px" }}>
          {/* Custom is the LAST ITEM OF THE SAME LIST rather than a separate switch — it is one
              more way of answering "how are this person's grants decided", and a toggle beside the
              list would make it a second question people answer before the first. */}
          {grantOptions.map(opt => {
            const picked = choice === opt.id;
            return (
              /* type="button": this list renders inside the invite <form>, where a button with
                 no type submits — pressing a preset created the account. */
              <button key={opt.id} type="button" onClick={() => onChoice(opt.id)}
                style={{
                  /* EQUAL QUARTERS ACROSS THE COLUMN (owner: 가로폭 꽉 차게 넓혀줘 일정한 크기로).
                     Four names of two to three syllables came out four different widths, which
                     made the row read as a sentence rather than a set of four equal choices —
                     and left a ragged gap at the right end of a full-width panel. `flex: 1` with
                     no wrap: there are exactly four, they are short, and 520px divides. */
                  flex: 1, minWidth: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: CONTROL_HEIGHT, padding: "0 6px", borderRadius: "9px", cursor: "pointer",
                  border: picked ? PICKED_LINE : BORDER,
                  backgroundColor: picked ? PICKED_FILL : "white", fontFamily: "inherit",
                  fontSize: "12px", fontWeight: 700,
                  color: picked ? "var(--gray-900)" : "var(--gray-600)",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* THE LIST IS HERE FOR EVERY ANSWER — AND NOTHING BEFORE THE FIRST ONE.
          A preset is a name until you can see what it switches on, so in preset mode the rows are
          locked rather than hidden: hiding them answers "what does this preset do?" with silence.
          But BEFORE anything is picked there is nothing to describe (owner, 2026-09-21: 프리셋을
          선택 안한상태일땐, 아래 이 방식이 켜는것을 안보여줘도될것같아). Six outlined pills under a
          heading that says "what this switches on" describe a grant nobody chose — and the only
          words there were an instruction to go back up, which the reader is already looking at. */}
      {choice !== null && (
      /*
        ONE SENTENCE AND THE MARKS (owner, 2026-09-22: 너무 복잡해..).
       
        This block had four layers of text under the row of names: a rule, the heading 「이 방식이
        켜는 것」, the note 「프리셋을 따릅니다. 하나씩 바꾸려면 커스텀을 고르세요」, the chosen
        option's own line, and then the marks. The heading names what the marks obviously are, and
        the note tells the reader to do something they have just done — 커스텀 is the fourth button
        directly above it. Both gone, and the rule with them.
       
        What is left is what cannot be worked out by looking: which option this is (its one line)
        and exactly what it switches on (the marks, filled and outlined).
      */
      <div style={{ minWidth: 0 }}>
        {/* The chosen option's own line, moved down here from the button it used to sit in — see
            the note on the row above. Printed for 커스텀 too: 「할 수 있는 일을 하나씩 고릅니다」
            is what the list underneath is for. */}
        {chosenOption && (
          /* 12px clear of the row of names above it (owner: 위에 버튼이랑 너무 붙어 있어). It
             describes the button that was pressed, so it has to sit closer to the marks it
             introduces than to the row it came from — 12 above, 8 below. */
          <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "12px", marginBottom: "8px" }}>{chosenOption.desc}</p>
        )}
        <AppGrantList actions={actions} locked={!isCustom} onToggle={onToggleAction} />
        {/* WHAT THIS ONE-OFF IS, IN THE WORDS OF THE LADDER. A custom set of five ticks is not
            something an access review can read: "조사자 − 동선 추적" is. Computed against the
            closest preset by how many actions differ, and when it matches one exactly the line
            says so — a custom account holding exactly a preset's set is an account that will not
            follow that preset when it changes, which is usually not what somebody meant. */}
        {isCustom && actions.length > 0 && (() => {
          const nearest = presets
            .map(pr => {
              const held = grantsOfPreset(pr).appActions ?? [];
              const plus = actions.filter(a => !held.includes(a));
              const minus = held.filter(a => !actions.includes(a));
              return { pr, plus, minus, distance: plus.length + minus.length };
            })
            .sort((a, b) => a.distance - b.distance)[0];
          if (!nearest) return null;
          const name = presetLabel(nearest.pr, lang);
          const names = (list: AppAction[]) => list.map(a => grantNames.action[a]).join(", ");
          return (
            <p style={{ fontSize: "11px", color: nearest.distance === 0 ? "var(--warning-500)" : "var(--gray-500)", lineHeight: 1.5, marginTop: "8px" }}>
              {nearest.distance === 0
                ? t.customSameAsPreset(name)
                : t.customDiff(name, nearest.plus.length ? names(nearest.plus) : "", nearest.minus.length ? names(nearest.minus) : "")}
            </p>
          );
        })()}
      </div>
      )}
    </>
  );
}

/** One account and the one link that reaches it, before anybody has signed in as it. */
type InviteLink = { name: string; email: string; url: string };

/**
 * One account and the link that reaches it. Its own component only for the copied flag, which is
 * per row: the bulk panel below can hold five of these and one shared flag would light them all.
 */
function InviteLinkRow({ name, email, url }: { name: string; email: string; url: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [copied, setCopied] = useState(false);
  // Same rule as the temporary password's copy button: the write can be refused (insecure origin,
  // browser permission), and a "Copied" label over a clipboard that did not take is how somebody
  // pastes whatever was there before. Flip the label only once the write resolves — on failure the
  // link is still on screen to read off.
  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => setCopied(false),
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--gray-50)" }}>
      {/* Who this one is for. The bulk case hands over several at once, and a column of tokens
          that differ in the last six characters cannot be told apart by eye. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", flexShrink: 0 }}>{name}</span>
        <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* user-select stays on: the button is a convenience, not the only way out of the box. */}
        <code style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", color: "var(--gray-700)", wordBreak: "break-all", lineHeight: 1.5 }}>
          {url}
        </code>
        <button onClick={copy}
          style={{ flexShrink: 0, padding: "7px 11px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: copied ? "var(--success-400)" : "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {copied ? t.tempCopied : t.tempCopy}
        </button>
      </div>
    </div>
  );
}

/**
 * The only artefact of creating an account, held on screen until it is dismissed.
 *
 * A /password-setup link used to be the `desc` of a toast — and ToastProvider drops every toast
 * five seconds after it appears, with no copy button and no way to pin it. Nothing in this build
 * mails that link (the relay is not wired up; the invite flow's other notes say the same), so
 * those five seconds were the entire life of the only route into an account that had just been
 * made. Look away and the account was unreachable: the token is stored on the user and never
 * rendered again, and the only repair was to mint another one.
 *
 * Shaped after the temporary-password result step above, deliberately — it is the same problem.
 * A value that has to leave the screen by hand, a clipboard write that only claims success once
 * it resolves, and a box the reader closes when they are done rather than one that closes itself.
 *
 * DO NOT PUT THIS BACK IN A TOAST. A toast is for something that happened; this is something the
 * administrator still has to carry somewhere.
 */
function InviteLinkPanel({ title, links, onClose, children }: {
  title: string;
  links: InviteLink[];
  onClose: () => void;
  /**
   * Anything the account still needs before the administrator walks away, under the link.
   *
   * Only the single invite passes one (the camera scope row). The bulk approval above hands over
   * five links at once and has no account in particular to say it about, so it passes nothing and
   * the panel is what it always was.
   */
  children?: React.ReactNode;
}) {
  /* Escape is the Drawer's, like every other panel on this page. */
  const [lang] = usePortalLanguage();
  const t = T[lang];
  return (
    /* A panel, so the account list this link belongs to stays behind it — and so the scope picker
       that opens over this one has something to come back to.
       The z-index note this box carried (310 rather than 300, because it holds the only copy of
       the link) is the Drawer's 320 now: every panel is above every centred confirm, which is the
       same ordering said once instead of per dialog. */
    <Drawer title={title} onClose={onClose}
      footer={
        <button className="portal-btn-primary" onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {t.tempDone}
        </button>
      }>
        <div style={MODAL_BODY}>
          <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>{t.inviteLinkNote}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {links.map(l => <InviteLinkRow key={l.url} name={l.name} email={l.email} url={l.url} />)}
          </div>
          {children}
        </div>
    </Drawer>
  );
}

/**
 * The cameras a scope may name: the ones in the projects the account holds (or, on the invite
 * form, the projects that have been ticked for it).
 *
 * Not `camerasInProject(activeProjectId)`: an account can hold several projects, and a scope that
 * only ever listed the project the administrator happens to be looking at would silently drop the
 * account's cameras on every other site the moment it was saved.
 *
 * Not `camerasVisibleTo` either. That reads the SIGNED-IN user's own scope, so an administrator
 * who is themselves narrowed could only grant a subset of their own view — the register is the
 * unrestricted answer for Portal, which is the rule stated on that function.
 *
 * At module scope because three places ask it now — the row menu, the invite form's summary and
 * the invite result step — and three copies of one filter drift the first time one is corrected.
 */
function scopableCameras(cameras: Camera[], projectIds: string[]): Camera[] {
  return cameras.filter(c => projectIds.includes(c.projectId));
}

function InviteUserModal({ defaultProjectId, onClose }: { defaultProjectId: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const allUsers = useVcaStore(s => s.portalUsers);
  const addPortalUser = useVcaStore(s => s.addPortalUser);
  const issueInviteToken = useVcaStore(s => s.issueInviteToken);
  const allCameras = useVcaStore(s => s.cameras);
  const allGroups = useVcaStore(s => s.cameraGroups);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  /** The account this form just made, or null while it is still a form. Holding it here rather
   *  than closing on submit is what keeps the link reachable — see InviteLinkPanel. */
  const [issued, setIssued] = useState<InviteLink | null>(null);
  /** Its id, kept beside the link so the result step can name the account to the scope picker.
   *  Not folded into InviteLink: the bulk panel shares that type and has no use for an id. */
  const [issuedId, setIssuedId] = useState<string | null>(null);
  const [scoping, setScoping] = useState(false);
  const [name, setName] = useState("");
  /** Once somebody types in the name field it is theirs, and the address stops suggesting. */
  const [nameTouched, setNameTouched] = useState(false);
  const [email, setEmail] = useState("");
  /**
   * A name out of an address, or nothing.
   *
   * Only the shapes that really carry a name: `marcus.lee`, `marcus_lee`, `marcus-lee`. A local
   * part with no separator ("ops", "control") is a mailbox rather than a person, and initials
   * ("k.h.j") would come out as "K H J" — both suggest nothing instead of something wrong.
   */
  const nameFromEmail = (address: string): string => {
    const local = address.split("@")[0]?.trim() ?? "";
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length < 2 || parts.some(part => part.length < 2 || /\d/.test(part))) return "";
    return parts.map(part => part[0].toUpperCase() + part.slice(1).toLowerCase()).join(" ");
  };
  const changeEmail = (next: string) => {
    setEmail(next);
    if (nameTouched) return;
    const suggestion = nameFromEmail(next);
    // Only ever writes a suggestion or clears one it wrote itself — never blanks a typed name.
    setName(suggestion);
  };
  // Defaults to the team that owns the project this page is scoped to — not teams[0]. With more
  // than one team in the installation those are different answers, and the first one silently
  // filed an invite under a team the admin was not even looking at.
  const [teamId, setOrgId] = useState(
    () => projects.find(p => p.id === defaultProjectId)?.teamId ?? teams[0]?.id ?? ""
  );
  // Access first, role second — the same order the table now reads in, and the order the questions
  // actually come in: whether this person opens Portal at all, then what they may do there.
  const [accessMode, setAccessMode] = useState<AccessMode>("appOnly");
  /**
   * How this account's app grants are decided. NOTHING IS PRE-SELECTED.
   *
   * A pre-ticked narrowest option looks harmless and is not: whatever sits first becomes the de
   * facto answer for every administrator in a hurry, and the record afterwards cannot tell a
   * decision from a default. AWS IAM Identity Center does not pre-pick a permission set either.
   *
   * Nothing chosen costs something, and three things pay for it: every option carries a line
   * saying what it is for, the check happens once when Invite is pressed rather than while
   * anybody types, and the disabled button says why instead of just sitting there.
   */
  // Same rule as the two above: the store slice comes out of the selector, the filtering happens
  // in a memo. presetsForTeam() returns a new array every call.
  const allPresets = useVcaStore(st => st.accessPresets);
  const presets = useMemo(() => presetsForTeam(allPresets, teamId), [allPresets, teamId]);
  const [grantChoice, setGrantChoice] = useState<string | null>(null);
  const [customActions, setCustomActions] = useState<AppAction[]>([]);
  /** Shown only after Invite has been pressed once — see the note on grantChoice. */
  const [submitted, setSubmitted] = useState(false);
  const toggleCustomAction = (action: AppAction) =>
    setCustomActions(prev => prev.includes(action) ? prev.filter(x => x !== action) : [...prev, action]);
  /**
   * An installation with no presets starts on custom, because there is nothing else to offer.
   * No guard forbidding that: the emptiness check below already covers where it leads.
   */
  const effectiveChoice = presets.length === 0 ? "custom" : grantChoice;
  const isCustom = effectiveChoice === "custom";
  /**
   * PICKING A RADIO IS NOT PICKING GRANTS, and this used to treat them as the same thing.
   *
   * Custom with nothing ticked passed every check and saved an empty grant — an account that
   * signs in, is refused by the gate's `noScreens`, and reads as a broken product to the person
   * it was created for. The comment above this line claimed "zero screens is already refused at
   * save"; nothing refused it. The gate was catching it hours later, at the one moment nobody
   * who could fix it is watching.
   *
   * One question now rather than two, which is what the five actions bought: the grant IS the
   * list of actions, so "did they choose anything" is a single count. A preset cannot be empty —
   * `addAccessPreset` refuses it — so this asks only of custom.
   */
  const grantsChosen = accessMode === "portalOnly"
    || (effectiveChoice !== null && !(isCustom && customActions.length === 0));
  /**
   * What the grant list shows, which is not always what the custom checkboxes hold.
   *
   * The list is on screen before anything is chosen and while a preset is chosen, so it needs a
   * source in all three states: nothing yet (everything off — an honest empty, not a guess), a
   * preset (that preset's grants, read-only), custom (the checkboxes themselves). Reading
   * customScreens in preset mode would show the wrong list, and it is the same list the
   * administrator is about to believe.
   */
  const pickedPreset = presets.find(pr => pr.id === effectiveChoice);
  const shown = pickedPreset ? grantsOfPreset(pickedPreset) : null;
  const shownActions = isCustom ? customActions : (shown?.appActions ?? []);
  const [permission, setPermission] = useState<PortalPermission>("admin");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);
  /** Which fold is open, or none. One at a time: two open folds is the tall form again. */
  /* Only the team folds now, so the state is that one row's. It was an accordion over three. */
  /** Camera groups the invite hands over. Empty means every camera — see the note on draftGroups. */
  const [scopeGroupIds, setScopeGroupIds] = useState<string[]>([]);
  /** The group being written from inside this panel — `{ group: null }` while making a new one. */
  const [groupEditorFor, setGroupEditorFor] = useState<{ group: CameraGroup | null; projectId: string } | null>(null);
  const toggleScopeGroup = (id: string) =>
    setScopeGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
  /** What the ticked projects hold today — the number the scope row says out loud. */
  const draftScopable = scopableCameras(allCameras, projectIds);
  /*
   * CAMERAS ARE GRANTED BY GROUP AT INVITE TIME, AND ONLY BY GROUP.
   *
   * The owner's constraint (2026-09-21): 실제 현장에서는 연결된 카메라 대수가 1000대이상일 수
   * 있어서. That settles a question the references disagree on. Eagle Eye Networks is the one
   * product that puts the camera list inside the add-user dialog — drag and drop, or "Add All" —
   * and a list of a thousand rows is not a thing anybody drags. Verkada, Milestone and Rhombus all
   * hand out cameras by site, role or group and never one at a time on this screen, which is the
   * shape that survives the scale.
   *
   * NOTHING PICKED IS NOT AN UNANSWERED QUESTION, it is the answer "every camera on the ticked
   * projects" — the same rule the data model already states on scopedCameraIds, where absent-and-
   * absent is the only "everything". So there is no All/Some switch to set and no fifth way to
   * fail: an empty pick sends the account through with the whole register, exactly as it did
   * before this control existed, and every chip pressed narrows it. An empty ARRAY would mean
   * "narrowed to nothing", which is why submit omits the field rather than sending [].
   *
   * Derived, not filtered into state: unticking a project must drop its groups, and a useEffect
   * doing that would fight the render it is triggered by.
   */
  const draftGroups = allGroups.filter(g => projectIds.includes(g.projectId));
  const pickedGroups = draftGroups.filter(g => scopeGroupIds.includes(g.id));

  /* The two closed-fold summaries went with the folds: 권한 and 현장 are open sections now, so
     nothing reads them from the outside and a summary of a section you can see is the section
     said twice. The 팀 fold prints its own answer inline — it is one name. */
  // Only when a site constrains the address. The all-connected case had a line of its own
  // ("Invite will be sent by external email"), which told the reader nothing they could act on
  // and, since nothing is sent from here, was not true either. Silence is the accurate default;
  // the note is for the exception.
  /*
   * IT NAMES THE SITE (owner, 2026-09-22: 인터넷이 차단된 사이트가 뭔지 명확히 알려줘 · 사이에
   * - 없애주고, 설명을 심플하게).
   *
   * It used to say 「선택한 프로젝트 중 인터넷이 차단된 사이트가 있습니다」 — which one, out of
   * the ticked projects, the reader had to work out for themselves, and the only thing they can do
   * about this note is type a different address for a particular site. Naming it also retires the
   * second copy of the sentence: with the project named, "one of these" and "this one" say the
   * same thing, so there is one string instead of two.
   */
  const isolatedProjects = selectedProjects.filter(isNetworkIsolated);
  const mailTransportNote = isolatedProjects.length === 0
    ? null
    : t.mailNoteIsolated(isolatedProjects.map(p => p.name).join(", "));

  /*
   * The same three checks /request-access already makes, for the reason resolveMailConfig's own
   * note predicted: "the invite modal would refuse an address the request form accepted." It was
   * the other way round — the request form validated and this one took anything.
   *
   * Duplicate matters more than it looks. currentPortalUser resolves the signed-in identity BY
   * EMAIL, so a second account on an existing address silently shadows the first one's role.
   */
  const typed = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed);
  const { mailDomain } = resolveMailConfig(projectIds[0] ?? "", projects, teams);
  const undeliverable = emailValid && !isMailDeliverable(typed, mailDomain);
  const duplicate = typed !== "" && allUsers.some(u => u.email.toLowerCase() === typed.toLowerCase());
  const emailError = typed === "" ? ""
    : !emailValid ? t.errEmail
    : duplicate ? t.errDuplicate
    : undeliverable && mailDomain ? t.errDomain(mailDomain)
    : "";
  const canInvite = name.trim() !== "" && emailValid && !duplicate && !undeliverable
    && teamId !== "" && projectIds.length > 0 && grantsChosen;
  /*
   * HAS THE READER PUT ANYTHING IN? What the scrim guard asks about (see Drawer's `dirty`).
   *
   * Not `canInvite`: a form that is only half valid is exactly the one worth protecting, and the
   * cost of losing it is the same. Only the answers somebody had to GIVE count — the project the
   * page arrived with, the team it belongs to and the default access mode were all filled in by
   * this dialog, so a panel opened and closed untouched still closes on one click.
   */
  const inviteStarted = email.trim() !== "" || name.trim() !== ""
    || grantChoice !== null || scopeGroupIds.length > 0
    || accessMode !== "appOnly"
    || projectIds.join() !== (defaultProjectId ? defaultProjectId : "");
  const submit = () => {
    setSubmitted(true);
    /* Nothing to open any more. This used to push the failing fold open — a refused invite whose
       reason sat beside the button while the field it was about was off screen — and both of those
       fields are now sections that were open the whole time. */
    // A project is required, the same as it is when the assignment is changed later: an account
    // invited with nothing ticked signs into an empty app and reads it as a broken product.
    if (!name.trim() || !email.trim() || !teamId || projectIds.length === 0) return;
    const resolved = applyAccessMode(accessMode, permission);
    if (resolved.appAccess && !grantsChosen) return;
    // A Portal-only account carries no app grants at all rather than empty ones: there is no
    // surface for them, and an empty screen list on an account with no app door reads as a
    // revocation somebody performed.
    const chosen = presets.find(pr => pr.id === effectiveChoice);
    const grants = !resolved.appAccess ? {}
      : chosen ? grantsOfPreset(chosen)
      : { appActions: customActions };
    // NO `cameraIds` HERE, DELIBERATELY. Absent is not "unanswered" — it is the answer "every
    // camera on this account's projects", and it is the only answer that keeps including cameras
    // installed next month. Handing over today's full list instead would look identical on the
    // day it was saved and quietly exclude every camera added after it. Narrowing is the explicit
    // act on the result step below, against the account that by then exists.
    const id = addPortalUser({
      name: name.trim(), email: email.trim(), teamId, projectIds,
      permission: resolved.permission, appAccess: resolved.appAccess, status: "invited",
      // The groups picked above, and the field is OMITTED when none were: an empty array is the
      // answer "narrowed to nothing" (scopedCameraIds), which would sign the account into an app
      // with no cameras at all. Groups only — a thousand-camera site is not granted one row at a
      // time, see the note on draftGroups. Not sent for a Portal-only account either: it has no
      // app to watch cameras in, and a scope on it would come back the day the app door opens.
      ...(resolved.appAccess && pickedGroups.length > 0 ? { cameraGroupIds: pickedGroups.map(g => g.id) } : {}),
      ...grants,
      ...(resolved.appAccess ? { grantMode: (chosen ? "preset" : "custom") as GrantMode, presetId: chosen?.id } : {}),
    });
    // The link carries a minted token, not the account id it used to carry — see PortalUser.
    // inviteToken. NO TOAST AND NO CLOSE HERE: nothing mails this link, so it is the entire
    // result of pressing the button, and a toast would take it away five seconds later. The
    // result panel replaces the form and the reader dismisses it themselves.
    const token = issueInviteToken(id);
    // Cannot be null — the account was created on the line above — but a "?token=null" link would
    // look like a working one and reach nothing, which is worse than no link at all.
    if (!token) return;
    // Set with the link, not before it: these two are what the result step is, and an id left
    // behind by a return that never produced a link would outlive the attempt it came from.
    setIssuedId(id);
    setIssued({ name: name.trim(), email: email.trim(), url: `/password-setup?token=${token}` });
  };

  if (issued) {
    /**
     * WHY THE SCOPE IS NARROWED HERE AND NOT ON THE FORM.
     *
     * `CameraScopePicker` writes its own answer: it calls `setCameraScope(user.id, …)`, and that
     * action looks the account up by id and returns the state untouched when it finds nothing.
     * A draft has no id, so reusing the picker on the form would have produced a control that
     * ticks, saves, toasts and changes nothing — the one outcome worse than not offering it.
     * The alternative was a second picker with its own list, grouping and empty rule, drifting
     * from the real one the day either is corrected. So the form states where the account starts
     * (see the row in the left column) and the answer is collected one step later, against the
     * account that now exists, by the same picker the row menu opens. The person inviting never
     * has to find the row in the table, which is what they were doing before.
     *
     * The audit log comes along for free: `setCameraScope` writes an entry, and a scope handed to
     * `addPortalUser` would have been a narrowing with no record of who narrowed it.
     */
    const created = issuedId ? allUsers.find(u => u.id === issuedId) ?? null : null;
    const scopable = created ? scopableCameras(allCameras, created.projectIds) : [];
    return (
      <>
        <InviteLinkPanel title={t.inviteCreatedTitle} links={[issued]} onClose={onClose}>
          {/* Same two conditions as the row menu item, for the same reasons: no app door means no
              cameras to narrow, and an empty picker would let somebody save the empty set on a
              site that simply has not been provisioned yet. */}
          {created && created.appAccess && scopable.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", border: BORDER }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{t.scopeLabel}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "2px" }}>
                  {/* READ THROUGH THE RESOLVER, NOT OFF `cameraIds`. The invite can now hand over
                      camera GROUPS, which leaves cameraIds undefined on an account that is
                      narrowed — this line used to test that one field and would have told the
                      reader "every camera on their projects" about somebody who got one group.
                      scopedCameraIds is the one place that resolves both fields (its own doc says
                      so), and it resolves groups through their current membership, so the number
                      here is the number the account actually sees. */}
                  {(() => {
                    const ids = scopedCameraIds(created, allGroups);
                    return ids === null
                      ? t.scopeHeldAll(scopable.length)
                      : t.scopeHeldSome([...ids].filter(id => scopable.some(c => c.id === id)).length, scopable.length);
                  })()}
                </p>
              </div>
              <button onClick={() => setScoping(true)}
                style={{ flexShrink: 0, padding: "7px 11px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.scopePick}
              </button>
            </div>
          )}
        </InviteLinkPanel>
        {/* Over the link panel rather than instead of it (320 against its 310), so closing the
            picker puts the reader back on the only copy of the link. */}
        {scoping && created && (
          <CameraScopePicker user={created} cameras={scopable} onClose={() => setScoping(false)} />
        )}
      </>
    );
  }

  return (
    /*
     * THE INVITE FORM IS A PANEL OFF THE RIGHT EDGE NOW (owner, 2026-09-22: 사용자초대 중앙팝업도
     * 오른쪽 패널로 바꾸는게 낫지않을까 · 하나로 가능한한 통일하는게 좋을것같아 오른쪽패널로).
     *
     * Inviting somebody is work done against the account list: the table you are adding a row to
     * stays on screen behind the panel, which a centred sheet covered.
     *
     * IT ALSO RETIRES A MEASURED EXCEPTION. As a centred sheet this dialog had to cap itself at
     * the window less its gutters and lay itself out as a column, because at a 912px window it
     * came out 928px tall and opened with 취소 and 초대 보내기 sixteen pixels below the fold. A
     * panel is the height of the window by definition, so the header and the footer keep their
     * places and the body between them scrolls — the shared Drawer does that for every panel
     * rather than this one file arguing for itself.
     *
     * A stray click on the scrim used to throw the whole form away with no undo — this one holds
     * up to six answers. It now asks first, and only once something has been entered: see the
     * shared Drawer's `dirty`, which this panel sets from the fields below.
     */
    <>
    <Drawer title={t.modalTitle} onClose={onClose} width="520px" escapeEnabled={groupEditorFor === null} dirty={inviteStarted}
      footer={<>
          {/* The reason sits beside the button rather than leaving it dead and silent. Shown only
              once Invite has been pressed: nothing on this form goes red while somebody is still
              filling it in, because a form that argues during typing is a form people fight. */}
          {/* `grantsChosen` is already true for a Portal-only invite — there are no screens to
              pick — so this cannot fire on one. */}
          {submitted && !grantsChosen && (
            <span style={{ flex: 1, fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.45 }}>
              {/* Two different mistakes, two different sentences. "Pick a way" does not help
                  somebody who already picked Custom and is looking at seven empty rows. */}
              {effectiveChoice === null ? t.grantNotChosen : t.grantNoScreens}
            </span>
          )}
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!canInvite}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: canInvite ? "pointer" : "not-allowed", opacity: canInvite ? 1 : 0.5 }}>
            {t.sendInvite}
          </button>
      </>}>
        {/* A REAL FORM, so Enter sends it. Every reference dialog is one field and a button away
            from done, and ours was six fields where the keyboard could not finish the job: the
            primary button was the only way, and the pointer had to travel past a grant list to
            reach it. `requestSubmit` runs the same validation path as the button — no second
            code path that could diverge. */}
        <form
          onSubmit={e => { e.preventDefault(); if (canInvite) submit(); }}
          /* The Drawer's body is the scrolling box now, so the form keeps only its padding and
             its gap — `overflowY: auto` here as well would be a scroll inside a scroll, and the
             inner one is the one the reader's wheel would not reach. */
          style={MODAL_BODY_WITH_SELECT}>
          {/*
            THE ADDRESS FIRST (2026-09-21, after eight invite dialogs on Mobbin: Stripe,
            Productboard, Dub, Whop, Emergent, Zapier, Wellfound, Tana — every one of them opens
            with the email and nothing else).

            It is not just convention. On this installation the address decides whether the rest
            of the form can be filled at all: accounts must be on the site's mail domain, and a
            name typed before an address that gets refused is work thrown away. It is also the
            one field nobody can guess for you — the name, this form can.
          */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.emailLabel}<RequiredMark /></label>
            {/* THE PLACEHOLDER HAS TO BE AN ADDRESS THIS FORM WOULD ACCEPT. It was a fixed
                "name@univs.ai" — our own domain, not the customer's — while the field below it
                refuses anything off the installation's domain. Same mailDomain the validation
                reads, so the example and the rule cannot drift apart. Left generic when no domain
                is configured — then nothing is refused and there is no domain to suggest. */}
            <TextField value={email} onChange={changeEmail} placeholder={mailDomain ? `name@${mailDomain}` : "name@example.com"} type="email" autoFocus />
            {/* Under the field, not on submit. The three ways this address can be wrong are all
                knowable while it is being typed, and finding out after pressing Send is finding
                out after an account was nearly created. */}
            {emailError && (
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.5, marginTop: "6px" }}>{emailError}</p>
            )}
          </div>
          {/* FILLED IN FROM THE ADDRESS, AND STILL A FIELD. `marcus.lee@smartcity.gov.sg` becomes
              "Marcus Lee" — a suggestion, not a value: the moment somebody edits the name it is
              theirs and no later change to the address touches it (`nameTouched`). Addresses that
              carry no name (`ops@`, `k.h.j@`) suggest nothing rather than something wrong, which
              is the same rule the camera importer follows about guessing.
              NO "filled in from the address" LINE ANY MORE (owner, 2026-09-21: 필드 밑 회색
              설명줄 다 없앤다) — the name appearing as the address is typed says it by happening. */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}<RequiredMark /></label>
            <TextField value={name} onChange={v => { setNameTouched(true); setName(v); }} placeholder={t.namePlaceholder} />
          </div>

          {/*
            THE TWO REQUIRED ANSWERS ARE OPEN; ONLY THE OPTIONAL ONE IS FOLDED (owner, 2026-09-22:
            사용자 초대에 권한이랑 현장이 필수값인데, 선택해서 선택해야하는게 비효율적이야).

            Folding all three was right for the container it was built in and wrong for this one.
            The reasoning then: the two-column sheet stood 880×859 on a 900px window — 95% of the
            screen for seven questions — so it became one 520px column with the answerable things
            folded to a line that STATES the answer. Two things have changed since.
            
            It is a PANEL now, as tall as the window, so height is no longer the thing being
            rationed. And the folds were an ACCORDION — `openFold` holds one id — so filling the
            two required sections meant opening 권한, answering, opening 현장, which closed 권한,
            and going back if you wanted to check it. Two required answers behind a control that
            only shows one at a time is a round trip for every invite.
            
            So nothing here folds except 팀: every question is open, in the order the answers
            depend on each other (project → how they get in → what they may do → which cameras).
            팀 keeps its fold because it has an answer already — the project's owning team — and
            nobody normally changes it, which is the case folding was for. Folded rather than
            dropped, because an account CAN be filed under another team and a form that never shows
            the team would put somebody in the wrong one silently.
            
            The grant still starts unanswered on purpose (see grantChoice: no preset is chosen for
            you), and pressing Invite still says which one is missing.
          */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/*
              NO 「현장」 HEADING OVER IT (owner, 2026-09-22: 현장 아래는 아무것도 없는 것 같은데?).
             
              It was a FormSection, so it drew a labelled row — 「현장 *」 — and the next thing
              under it was another label, 「프로젝트 *」. A label with a label under it reads as a
              field somebody forgot to fill, and the star made it look required and empty. The
              questions inside it already say what they are (프로젝트 · 어디로 로그인하나 · 권한 ·
              카메라 범위), and 프로젝트 carries the star that actually stops the button. So the
              wrapper keeps the column and drops the heading.
            */}
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.projectsLabel}<RequiredMark /></label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {teamProjects.map(p => {
                      const active = projectIds.includes(p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => toggleProject(p.id)}
                          style={{
                            /* ONE HEIGHT FOR EVERY BOX IN THIS FORM (owner, 2026-09-22: 인풋이랑
                               셀렉박스들 높이가 다 제각각인데, 한 가지로 통일시켜줘). Measured
                               before: fields 36, selects 36, preset buttons 36 — but the chips came
                               out 32 and 30, because they were sized by padding while everything
                               else used CONTROL_HEIGHT. A column of boxes at four heights reads as
                               four kinds of control when it is one. */
                            display: "flex", alignItems: "center",
                            height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", cursor: "pointer",
                            border: active ? PICKED_LINE : BORDER,
                            backgroundColor: active ? PICKED_FILL : "white",
                            color: active ? "var(--gray-900)" : "var(--gray-600)",
                            fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
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
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.accessLabel}</label>
                  {/* type="button" ON EVERY CONTROL INSIDE THE FORM. A <button> in a form is a
                      SUBMIT button unless it says otherwise, and this dialog is a real <form> so
                      Enter sends it (c0f5747). Measured after that change: filling the address and
                      pressing a preset MAILED THE INVITE on the spot. Every picker in here needs
                      the attribute, and a new one added without it does the same thing silently,
                      because the form only submits when the invite happens to be valid. */}
                  {/*
                    ONE LINE, LIKE EVERY REFERENCE (owner, 2026-09-22: 이 부분 너무 복잡해 보이는데,
                    조금 더 심플하게 바꿔줘 모빈 참고해서).
                   
                    Ten invite forms on Mobbin — Melio, Copilot, Sentry, Webflow, Toggl Track,
                    Buffer, Productboard, Grok, Zapier, Sweatpals — and every one of them asks the
                    role-shaped question with a SELECT. Ours spent a full 10px-padded row of three
                    equal buttons on it, directly under another row of project chips and above two
                    more blocks, so four stacked answers all shouted at the same volume. A select
                    says the same thing in one line and reads as "already answered", which it is:
                    this one always has a value.
                   
                    type="button" is not needed on FilterSelect — it renders one itself — but every
                    hand-written control in this form still needs it (a <button> in a <form> is a
                    submit button, and this dialog really submits).
                  */}
                  <FilterSelect
                    value={accessMode}
                    onChange={v => setAccessMode(v as AccessMode)}
                    options={(["both", "appOnly", "portalOnly"] as AccessMode[]).map(mode => ({ value: mode, label: accessLabel(t, mode) }))}
                  />
                </div>
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
                {/*
                  WHAT THEY MAY DO COMES AFTER WHERE AND HOW THEY GET IN (owner, 2026-09-22:
                  프로젝트랑 어디로 로그인하는지 먼저 선택하고 권한을 선택하게 해야 하는 거 아닌가?).

                  Yes, and not only for reading order: the two questions above DECIDE this one.
                  Portal-only invites have no app to grant screens in, so this block turns into a
                  sentence saying so; app-only invites have no Portal role, so that select is not
                  drawn at all. Asked first, it was a question whose own answer could be taken away
                  by an answer given below it.

                  One thing the model does NOT support, and the form should not pretend to: a role
                  is ONE value per account (PortalUser.permission) next to a LIST of projects, so
                  an account is the same role on every project it holds. Per-project roles would be
                  a new row in the data, not a new control here — worth raising with the backend
                  before anybody draws it.
                */}
                <FormSection label={t.foldGrant} required>
                  {accessMode !== "portalOnly" ? (
                    <GrantPicker
                      presets={presets} choice={effectiveChoice} onChoice={setGrantChoice}
                      actions={shownActions} onToggleAction={toggleCustomAction}
                      hideTitle t={t} />
                  ) : (
                    /* Portal-only: there is no app to grant screens in, and the row says so rather
                       than opening onto an empty list. */
                    <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.grantsPortalOnly}</p>
                  )}
                </FormSection>
                {/* CAMERAS — groups only, and nothing picked means every camera on the ticked
                    projects, the same rule the data model states on scopedCameraIds. A thousand-
                    camera site is not granted one row at a time: Verkada, Milestone and Rhombus
                    hand cameras out by site, role or group, and Eagle Eye — the one product with
                    the camera list inside the add-user dialog — is the one that would not survive
                    the scale. Not asked of a Portal-only account: no app to watch them in. */}
                {accessMode !== "portalOnly" && (
                  <div>
                    {/* THE DOOR SITS ON THE LABEL ROW (owner, 2026-09-22: 카메라 범위 옆에 그룹
                        수정/추가 버튼 만들어서 편집해서 추가할 수 있게). Toggl Track puts
                        「+ Create a new project」 inside its project picker and Buffer puts
                        「Apply to All」 on the label row — the action that changes what you can pick
                        belongs beside the picking, not on another tab. Only with ONE project
                        ticked: a group belongs to exactly one project, and with two ticked there
                        is no answer to which one a new group would be made in. */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{t.scopeLabel}</label>
                      <span style={{ flex: 1 }} />
                      {projectIds.length === 1 && (
                        <button type="button" onClick={() => setGroupEditorFor({ group: null, projectId: projectIds[0] })}
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>
                          <Plus size={12} strokeWidth={2.6} aria-hidden="true" />
                          {t.scopeNewGroup}
                        </button>
                      )}
                    </div>
                    {/*
                      「전체 카메라」 IS A CHIP, NOT A SENTENCE (owner, 2026-09-22: 이 문구보다 아래
                      버튼에 전체 카메라 라고 해서 선택되어 있는 게 더 나을 것 같아).

                      The default used to be explained in prose — 「그룹을 고르지 않으면 이 프로젝트의
                      카메라 전부입니다. 지금 68대…」 — above a row of group chips whose numbers added
                      up to five. Two true statements that read as arithmetic that does not work,
                      because nothing showed that they were ALTERNATIVES. As the first chip in the
                      same row, ticked until a group is ticked, the choice is the thing you see:
                      one of these is on, and the number on it is the number that applies.

                      Picking it clears the groups; picking a group clears it, because an empty
                      group list IS "all cameras" in the data model (see scopedCameraIds) — the
                      chip does not add a state, it shows the one that was always there.
                    */}
                    {projectIds.length === 0 || draftScopable.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>
                        {projectIds.length === 0 ? t.scopeNoProject : t.scopeNoCameras}
                      </p>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {(() => {
                            const on = pickedGroups.length === 0;
                            return (
                              <button type="button" onClick={() => setScopeGroupIds([])}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px",
                                  height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", cursor: "pointer",
                                  border: on ? PICKED_LINE : BORDER,
                                  backgroundColor: on ? PICKED_FILL : "white",
                                  color: on ? "var(--gray-900)" : "var(--gray-600)",
                                  fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
                                }}>
                                {t.scopeAll}
                                <span style={{ fontSize: "10px", fontWeight: 600, color: on ? "var(--gray-500)" : "var(--gray-400)" }}>
                                  {t.scopeGroupCount(draftScopable.length)}
                                </span>
                              </button>
                            );
                          })()}
                          {draftGroups.map(g => {
                            const on = scopeGroupIds.includes(g.id);
                            return (
                              /* A span holding two buttons, not a button holding one: nesting
                                 buttons is invalid and the browser drops the inner one. The chip's
                                 border and fill live here so the pair reads as one object. */
                              <span key={g.id}
                                style={{
                                  display: "flex", alignItems: "center", height: CONTROL_HEIGHT, borderRadius: "8px",
                                  border: on ? PICKED_LINE : BORDER,
                                  backgroundColor: on ? PICKED_FILL : "white",
                                }}>
                                <button type="button" onClick={() => toggleScopeGroup(g.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "6px", height: "100%",
                                    padding: "0 6px 0 12px", border: "none", background: "none", cursor: "pointer",
                                    color: on ? "var(--gray-900)" : "var(--gray-600)",
                                    fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
                                  }}>
                                  {g.label}
                                  {/* The size, because two groups can carry the same name's worth of
                                      weight and a very different number of cameras. */}
                                  <span style={{ fontSize: "10px", fontWeight: 600, color: on ? "var(--gray-500)" : "var(--gray-400)" }}>
                                    {t.scopeGroupCount(g.cameraIds.length)}
                                  </span>
                                </button>
                                {/* Changing what is IN the group, from the form that hands it out —
                                    the other half of the owner's 수정/추가. Always drawn rather than
                                    shown on hover: a control nobody can see is a control nobody
                                    finds, and this panel is read on a screenshot as often as it is
                                    used with a pointer. */}
                                <button type="button" onClick={() => setGroupEditorFor({ group: g, projectId: g.projectId })}
                                  title={t.scopeEditGroup(g.label)} aria-label={t.scopeEditGroup(g.label)}
                                  style={{ display: "flex", alignItems: "center", height: "100%", padding: "0 10px 0 4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)" }}>
                                  <Pencil size={11} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        {/* The one fact the chips cannot carry: a scope is a rule, not a list, so
                            it keeps applying to cameras nobody has registered yet. True of both
                            answers — the project's whole register, or a group — so it is said once
                            under the row rather than twice inside it. */}
                        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5, marginTop: "8px" }}>
                          {draftGroups.length === 0 ? `${t.scopeGroupsNone} ${t.scopeLater}` : t.scopeLater}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/*
              THE LAST QUESTION LOOKS LIKE THE OTHERS (owner, 2026-09-22: 맨 아래 팀도 위에 것들과
              동일하게 바닥에 뿌려줘).

              It was the one fold left — a bordered row that said 팀 on the left and the answer on
              the right, opening onto the select. That shape was earning its keep when three
              questions were folded and this was the third; alone at the bottom of six plain
              labelled blocks it just read as a different KIND of thing, and it hid a control
              behind a click for no saving in height: the select it opens is one line, which is
              what the fold itself cost.

              It stays last and it stays shown. An account CAN be filed under another team, and a
              form that never shows the team would put somebody in the wrong one silently.
            */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.foldTeam}</label>
              <FilterSelect value={teamId} onChange={changeTeam} options={teams.map(o => ({ value: o.id, label: o.name }))} />
            </div>
          </div>
        </form>
    </Drawer>
    {/* OVER THIS PANEL, NOT INSTEAD OF IT. The invite keeps every answer already typed while the
        group is written, and Escape closes this editor only — see Drawer's escapeEnabled. */}
    {groupEditorFor && (
      <CameraGroupEditor
        nested
        projectId={groupEditorFor.projectId}
        group={groupEditorFor.group}
        onClose={() => setGroupEditorFor(null)}
        onSaved={id => setScopeGroupIds(prev => prev.includes(id) ? prev : [...prev, id])}
      />
    )}
    </>
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
  // Post-mount, like every other clock read in Portal — see TempPasswordBadge.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
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
        resultTitle: t.resetCodeRequestedTitle, note: "",
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
        // nowMs, not codeDaysRemaining's Date.now() default — the same post-mount clock the
        // badge below reads. Until it is known this prints the full TTL, which is what a code
        // issued this second has left.
        expiryLabel: t.setupExpires(
          (nowMs === null ? null : codeDaysRemaining(user.setupCodeIssuedAt, SETUP_CODE_TTL_DAYS, nowMs))
            ?? SETUP_CODE_TTL_DAYS,
        ),
      };

  const generate = () => {
    // Mail has no second step: nothing is shown to the administrator, which is the whole point of
    // that path. Confirm, send, close.
    if (kind === "mail") {
      // HANDOFF NOTE: posts nowhere. The real call asks the backend to mail a reset code, and the
      // OPEN QUESTION from before still stands — if the person then uses "Forgot password?"
      // themselves they request a second code, invalidating this one.
      // "success" would be a claim: nothing left the building. info, and the second line says so.
      showToast({ variant: "info", title: t.resetCodeRequestedTitle, desc: t.resetCodeRequestedDesc(user.email) });
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
      <span style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>{text}</span>
    </li>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "var(--shadow-modal)" }}>
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
                <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>{c.intro}</p>
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
                        <p style={{ fontSize: "12px", color: opt.unavailable ? "var(--gray-400)" : "var(--gray-700)", marginTop: "5px", lineHeight: 1.5 }}>
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
                <p style={{ fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.5, marginTop: "4px" }}>{c.handover}</p>
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

/*
 * 20px BETWEEN EVERY BLOCK, NOT 16 THEN 14 (owner, 2026-09-22: 이름이랑 권한 사이만큼 공간
 * 공통으로 다 띄어줘서 구분을 확실히 해줘, 지금 프로젝트랑 너무 다 붙어있어).
 *
 * The form used to nest: 16px between the top-level blocks, 8px inside the wrapper, 14px between
 * the four questions in the site column. So 이름 → 권한 read as a break and 프로젝트 → 어디로
 * 로그인하나 read as one block with two labels in it, although both are whole questions. Same
 * number at every level, and the nesting stops being visible.
 */
const MODAL_BODY_WITH_SELECT: React.CSSProperties = {
  padding: "20px", display: "flex", flexDirection: "column", gap: "20px",
};

/**
 * A COLUMN TITLE, so the two halves of the invite dialog read as two questions.
 *
 * The owner's doubt (2026-09-21): 초대팝업 UI 레이아웃을 조금 바꾸고싶은데, 아니면 이 단계를
 * 쪼개야하나싶기도하고. The answer from the references is: do not split it into steps, title the
 * parts. Everything that splits an invite into numbered steps does it because the permission
 * surface is enormous — HubSpot's permission tree, Docusign's profile + security + permission
 * profile + groups, Navan's per-user role table. Ours is six checkboxes and one select, and the
 * cost of a wizard is exactly what Verkada pays: after the invite, an administrator must re-open
 * "Manage Roles" to find out which sites somebody actually got.
 *
 * What was missing was not fewer fields, it was the grouping. The dialog was one flat form with a
 * rule down the middle, so the address and the camera scope looked equally weighty. Customer.io's
 * add-user page is the reference that titles its parts (User details / Account level permissions /
 * Workspace level permissions), and Eagle Eye — the one VMS that keeps everything in one dialog —
 * tabs them for the same reason.
 *
 * WHAT IS LEFT OF IT. The two column heads this was built for are gone with the two columns
 * (the dialog is one folded column now, see the form); the style stays because the grant list's
 * own first label uses it, and the edit modal still shows that label.
 */
const SECTION_HEAD: React.CSSProperties = {
  fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--gray-400)",
};

/**
 * A REQUIRED ANSWER, ALWAYS OPEN.
 *
 * The label with its star, and the thing being answered directly under it — the ordinary shape of
 * a form field, which is what these are. It exists as a component rather than a bare div so the
 * star and the label sit at the same size and weight in both sections, and so the next required
 * section added to this form cannot drift from them.
 *
 * The fold below is its opposite number, for the answers that are already filled in.
 */
function FormSection({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "8px" }}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
    </div>
  );
}


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
      title={t.tempBadgeTitle(new Date(issuedAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US"))}
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
        <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5, marginTop: "4px" }}>{t.recoveryNoticeBody}</p>
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
/**
 * Approving one of these creates an account with a working sign-in link, which is the same
 * power as inviting somebody — and it sat directly under an Invite button disabled with "Only
 * an owner can change access", fully live for an admin or an auditor. Dismiss destroyed a
 * pending request with no gate and no confirmation.
 */
function AccessRequestsPanel({ projectId, onLinksMade }: {
  projectId: string;
  /** Approving hands back links that have to outlive this panel: approving the last request
   *  empties the queue and the early returns below unmount the whole card. The page holds them. */
  onLinksMade: (panel: { title: string; links: InviteLink[] }) => void;
}) {
  const accessRequests = useVcaStore(s => s.accessRequests);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const approveAccessRequests = useVcaStore(s => s.approveAccessRequests);
  const issueInviteToken = useVcaStore(s => s.issueInviteToken);
  const dismissAccessRequest = useVcaStore(s => s.dismissAccessRequest);
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
  // Same gate as Invite, because it is the same act: an approval mints an account and hands out
  // a /password-setup link. Fails open with no session, like every other gate in Portal.
  const me = currentPortalUser(portalUsers);
  const manageAccess = me ? canManageAccess(me.permission) : true;
  const allSelected = requests.length > 0 && requests.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allSelected ? [] : requests.map(r => r.id));

  const approve = (ids: string[]) => {
    if (!manageAccess) return;
    const newUserIds = approveAccessRequests(ids);
    setSelected(prev => prev.filter(id => !ids.includes(id)));
    /*
     * A LINK PER ACCOUNT, NOT A SENTENCE ABOUT LINKS.
     *
     * Approving five used to raise "5 users invited — each will receive their own invite link",
     * which was two untruths in one card: nobody receives anything (no mail goes out of this
     * build), and the links themselves were never shown, so five accounts existed that nothing
     * could reach. Approving one showed a link and then dropped it after five seconds.
     *
     * approveAccessRequests walks the requests in store order and returns the new ids in that
     * same order, and this list is a filtered subsequence of the same array — so index i here is
     * the person index i was created from. Their name and address come off the request rather
     * than out of the store, which this closure would only see a stale copy of.
     */
    const from = requests.filter(r => ids.includes(r.id));
    const links = newUserIds.flatMap((userId, i) => {
      const token = issueInviteToken(userId);
      const who = from[i];
      return token && who ? [{ name: who.name, email: who.email, url: `/password-setup?token=${token}` }] : [];
    });
    if (links.length > 0) {
      onLinksMade({
        title: links.length === 1 ? t.accessApprovedTitle : t.accountsCreatedTitle(links.length),
        links,
      });
    }
  };

  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: BORDER, backgroundColor: "var(--gray-50)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "var(--gray-900)" }} />
          </label>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.accessRequestsTitle(requests.length)}</p>
        </div>
        {selected.length > 0 && (
          <button onClick={() => approve(selected)}
            disabled={!manageAccess} title={manageAccess ? undefined : t.reasonNotOwner}
            style={{ padding: "8px 14px", borderRadius: "8px", border: manageAccess ? "1px solid var(--gray-900)" : BORDER, backgroundColor: "white", color: manageAccess ? "var(--gray-900)" : "var(--gray-300)", fontSize: "12px", fontWeight: 700, cursor: manageAccess ? "pointer" : "not-allowed" }}>
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
                {nowMs !== null ? t.requestedAgo(formatElapsed(nowMs - new Date(r.requestedAt).getTime(), lang)) : t.requestedLoading}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button className="portal-btn-outline" onClick={() => manageAccess && dismissAccessRequest(r.id)}
                disabled={!manageAccess} title={manageAccess ? undefined : t.reasonNotOwner}
                style={{ padding: "8px 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: manageAccess ? "var(--gray-600)" : "var(--gray-300)", fontSize: "12px", fontWeight: 700, cursor: manageAccess ? "pointer" : "not-allowed" }}>
                {t.dismiss}
              </button>
              <button onClick={() => approve([r.id])}
                disabled={!manageAccess} title={manageAccess ? undefined : t.reasonNotOwner}
                style={{ padding: "8px 12px", borderRadius: "8px", border: manageAccess ? "1px solid var(--gray-900)" : BORDER, backgroundColor: "white", color: manageAccess ? "var(--gray-900)" : "var(--gray-300)", fontSize: "12px", fontWeight: 700, cursor: manageAccess ? "pointer" : "not-allowed" }}>
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
/**
 * The tools that are not this page's one primary action.
 *
 * No border and no fill: what makes a control loud is the box, not the letters, so this row of
 * five recedes by losing its boxes rather than by shrinking its type — which was tried first and
 * only made them hard to read while leaving them just as visible. Same treatment as Input Sources,
 * same reference (Zapier's borderless table tools).
 *
 * The roster tab drops a fill on top of this for its own primary, which is why the fill lives at
 * the call site rather than here.
 *
 * The hover tint is portal-btn-quiet, added at each call site. A borderless control with no hover
 * is the one version of this treatment that fails — nothing at rest and nothing on pointing is
 * not a quiet button, it is text.
 */
const SECONDARY_BTN: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px", padding: "10px", borderRadius: "8px",
  border: "none", backgroundColor: "transparent", color: "var(--gray-600)",
  fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
};

/**
 * Which of the team's projects an existing account may open.
 *
 * It was set once, at invite, and never again: updatePortalUserProjects sat in the store with no
 * caller, and the table's projects cell was plain text whose own comment described "removing them
 * from here" as the question behind it — an action that did not exist. In a control centre staff
 * rotate between sites, and the only fix was to delete the account and invite it again, which
 * loses everything the account is.
 *
 * Team is not editable here. A project belongs to exactly one team, so moving somebody between
 * teams is a different act with different consequences (their whole roster history, their role,
 * the mail domain their invite came from) and it does not belong behind a checkbox list.
 */
function UserProjectsModal({ user, teamProjects, onClose, onSave }: {
  user: PortalUser;
  teamProjects: { id: string; name: string }[];
  onClose: () => void;
  onSave: (projectIds: string[]) => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [picked, setPicked] = useState<string[]>(user.projectIds);
  useEscapeKey(onClose);
  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  // Zero is refused rather than warned about. An account with no projects signs into an app with
  // nothing in it and no way to tell that something was taken away — suspending the account is
  // how you stop somebody, and it says so.
  const canSave = picked.length > 0;

  return (
    /* A panel, like the rest of this page's editors. Which sites a person may open is a decision
       taken against the row that shows what they hold now. */
    <Drawer title={t.projectsModalTitle} onClose={onClose}
      footer={
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {!canSave && (
            <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.projectsModalNoneWarning}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button className="portal-btn-outline" onClick={onClose}
              style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.cancel}
            </button>
            <button className="portal-btn-primary" onClick={() => { onSave(picked); onClose(); }} disabled={!canSave}
              style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {t.changeApply}
            </button>
          </div>
        </div>
      }>
        <div style={{ padding: "16px 20px 0" }}>
          {/* Who this is about. The title is the panel header's now. */}
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.projectsModalIntro(user.name)}</p>
        </div>
        {/*
          CHECKBOX ROWS, NOT CHIPS (owner, 2026-09-22: 이거 선택 가능한거라는 느낌이 안들고
          프로젝트 권한을 주는 중요한 팝업인데 너무 약해).

          A chip that changes only its border when picked is a filter's idiom, and it was carrying
          a decision about which sites a person may watch. Every product that asks this question
          asks it with a ticked list: Customer.io's workspace permissions, Buffer's channel access,
          Wix's roles, Teachable's course access, HubSpot's access groups. The box is the part that
          says "you choose these", and the row — full width, one per site — is what makes a list of
          two read the same as a list of twenty.

          The count under it is the same device the camera picker uses: the one number that says
          what is about to be saved, beside the button that saves it.
        */}
        <div style={{ padding: "16px 20px 6px" }}>
          <div style={{ border: BORDER, borderRadius: "10px", overflow: "hidden" }}>
            {teamProjects.map((p, i) => {
              const active = picked.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px", textAlign: "left",
                    padding: "11px 12px", cursor: "pointer", fontFamily: "inherit",
                    border: "none", borderTop: i === 0 ? "none" : "1px solid var(--gray-200)",
                    /* NO FILL ON THE PICKED ROW (owner: 헤더같아보여). A grey row with bold text is
                       what this product's tables use for their HEADER, so the first row of the
                       list read as a column heading and the second as its only data. The tick is
                       the state — Customer.io, Wix and Teachable all leave the row itself
                       untouched and let the box carry it. */
                    backgroundColor: "white",
                  }}>
                  <span style={{
                    width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)",
                    backgroundColor: active ? "var(--gray-900)" : "white",
                  }}>
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span style={{ minWidth: 0, fontSize: "12.5px", fontWeight: 500, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ padding: "0 20px", display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>{t.projectsPickedCount(picked.length, teamProjects.length)}</span>
        </div>
    </Drawer>
  );
}

/**
 * Change one account's app grants after the invite.
 *
 * WITHOUT THIS, GRANTS FREEZE AT INVITE TIME. Role, app access, person search, projects and status
 * were all editable from the row menu; the five screens, evidence export and preset membership
 * were not. The only way to move somebody between jobs was to delete the account and invite them
 * again, which throws away the audit continuity the account exists to carry and makes somebody
 * hand out a fresh setup link. The workaround was worse than the gap.
 *
 * It starts from what the account holds, unlike the invite form, which pre-selects nothing. The
 * difference is not an inconsistency: there is a decision on file here, and showing it is
 * reporting rather than defaulting.
 */
function AppGrantModal({ user, onClose }: { user: PortalUser; onClose: () => void }) {
  useEscapeKey(onClose);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const { showToast } = useToast();
  // Same rule as the invite form: the raw slice comes out of the selector and the filtering
  // happens in a memo, because presetsForTeam() returns a new array every call.
  const allPresets = useVcaStore(st => st.accessPresets);
  const presets = useMemo(() => presetsForTeam(allPresets, user.teamId), [allPresets, user.teamId]);
  const applyGrantPreset = useVcaStore(st => st.applyGrantPreset);
  const startCustomGrants = useVcaStore(st => st.startCustomGrants);
  const setAppGrant = useVcaStore(st => st.setAppGrant);

  /** What this account holds right now — the thing every comparison below is against. */
  const held = useMemo(() => user.appActions ?? [], [user.appActions]);

  const [choice, setChoice] = useState<string | null>(() => {
    // A preset that is no longer offered cannot be shown as selected — the radio would sit on
    // nothing and the locked list below would show an empty grant set for an account that holds
    // five screens. archiveAccessPreset already moves followers to custom, so this is a guard
    // against a state that should not arrive, not a case being handled.
    const following = user.grantMode === "preset" && user.presetId
      && presetsForTeam(allPresets, user.teamId).some(pr => pr.id === user.presetId);
    return following ? user.presetId ?? "custom" : "custom";
  });
  const [customActions, setCustomActions] = useState<AppAction[]>(held);
  const toggleCustomAction = (action: AppAction) =>
    setCustomActions(prev => prev.includes(action) ? prev.filter(x => x !== action) : [...prev, action]);

  const isCustom = choice === "custom";
  const pickedPreset = presets.find(pr => pr.id === choice);
  const shown = pickedPreset ? grantsOfPreset(pickedPreset) : null;
  const actions = isCustom ? customActions : (shown?.appActions ?? []);

  /** Order-independent: the toggle appends, the store stores in APP_ACTIONS order. */
  const sameActions = (a: AppAction[], b: AppAction[]) =>
    APP_ACTIONS.filter(x => a.includes(x)).join() === APP_ACTIONS.filter(x => b.includes(x)).join();

  const dirty = isCustom
    ? user.grantMode !== "custom" || !sameActions(customActions, held)
    : user.grantMode !== "preset" || user.presetId !== choice;
  /* Same refusal as the invite form, for the same reason: custom with nothing ticked saves an
     account that signs in and is turned away by the gate's noScreens. */
  const canSave = dirty && (isCustom ? customActions.length > 0 : choice !== null);
  /* Said before it happens rather than reported after. Following a preset means holding its
     grants, so hand-tuned values go — and only when they actually differ, or the warning becomes
     wallpaper on every preset switch. */
  const willOverwrite = !isCustom && shown != null && user.grantMode === "custom"
    && !sameActions(shown.appActions ?? [], held);

  const save = () => {
    if (!canSave) return;
    if (!isCustom && choice) {
      applyGrantPreset(user.id, choice);
    } else {
      // Detach first: setAppGrant writes values and says nothing about where they come from, so
      // tuning an account that still reads as "follows the preset" is the silent mismatch this
      // screen exists to end.
      // NOT REDUNDANT WITH THE STORE'S OWN DETACH, though it looks it. setAppGrant detaches on
      // its way through, but it is only called for grants that actually changed — so "switch this
      // account to custom and change nothing else", which is a real thing an administrator does
      // to stop a preset edit reaching them, would save nothing at all while the toast said it
      // saved. Reproduced with this line removed before keeping it: the row still read "감독자".
      if (user.grantMode !== "custom") startCustomGrants(user.id);
      // ONE AUDIT LINE PER CHANGE, which is what the store's comment asks for — a preset name
      // alone swallows the manual tuning that came after it, and that is the half an access
      // review is actually asking about.
      APP_ACTIONS.forEach(action => {
        const next = customActions.includes(action);
        if (next !== held.includes(action)) setAppGrant(user.id, action, next);
      });
    }
    // The app reads its grants when it loads, so this is what actually happens — not "revoked".
    showToast({ variant: "success", title: t.grantsSavedTitle, desc: t.grantsSavedDesc(user.name) });
    onClose();
  };

  return (
    /* A panel. The 92vh cap and the column layout this dialog needed to keep a seven-row grant
       list and its footer on screen are the Drawer's job now. */
    <Drawer title={t.grantsModalTitle} onClose={onClose}
      footer={
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {willOverwrite && (
            <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.grantsOverwriteWarning}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          {/* The button says why it is dead instead of sitting there. Two states, two sentences:
              nothing has moved yet, or custom is on with no screen ticked. */}
          {!canSave && (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>
              {!dirty ? t.grantsUnchanged : t.grantNoScreens}
            </span>
          )}
          <button className="portal-btn-outline" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={save} disabled={!canSave}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.changeApply}
          </button>
          </div>
        </div>
      }>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
        {/* Who this is about; the title is the panel header's. */}
        <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.grantsModalIntro(user.name)}</p>
        <GrantPicker
          presets={presets} choice={choice} onChoice={setChoice}
          actions={actions} onToggleAction={toggleCustomAction}
          t={t} />
      </div>
    </Drawer>
  );
}

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
 *
 * Deriving it was only half the guarantee, and for a while it was the wrong half: canEditPortal
 * had exactly one call site — the row below — so the table read from a function nothing else
 * consulted, and every tab let an auditor change whatever it liked. It is now read through
 * usePortalEditAccess by Input Sources, the VIP registry, servers, mail and the project card in
 * Settings. A derived table is honest only while the thing it derives from is enforced.
 */
function AccessGuideModal({ t, onClose }: { t: (typeof T)["en"] | (typeof T)["ko"]; onClose: () => void }) {
  useEscapeKey(onClose);
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
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "560px", width: "100%", maxHeight: "86vh", overflowY: "auto", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.guideTitle}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.5 }}>{t.guideLead}</p>
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
          <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "8px", lineHeight: 1.5 }}>{t.guideSameNote}</p>
        </div>

        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>{t.guideAppHeading}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.guideAppSearchNote}</p>
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
 * An account that holds the app door and no screen behind it.
 *
 * AccessGate decides the same thing with the same pair of fields — `denialFor` returns
 * "noScreens" for `appAccess && (appActions ?? []).length === 0` — and its refusal screen tells
 * the person to have an administrator assign screens "in Portal, under Users & Permissions",
 * which is this page. So this screen is where the state has to be findable, and until now it was
 * an 11px grey line in one cell.
 *
 * NOT A CLAIM THAT THE GATE IS REFUSING THEM TODAY. The gate tests suspended and invited BEFORE
 * this, so a suspended or still-invited account is turned away with those reasons instead — the
 * two seeded rows in this state are exactly those. What is true of all of them is what the badge
 * says: no screen is granted, so the day the account becomes usable it arrives at nothing. That
 * is a grant to repair now, not an incident, and the wording stays on the grant.
 */
/** Whether this account holds the person-search action. See APP_ACTIONS. */
function holdsSearch(u: PortalUser): boolean {
  return (u.appActions ?? []).includes("personSearch");
}

function lacksAppScreens(u: PortalUser): boolean {
  return u.appAccess && (u.appActions ?? []).length === 0;
}

/** The cuts the summary strip can put on the table. One name, because four signatures repeating
 *  the same union is how the fifth one gets forgotten. */
type UserFilterKey = "invited" | "suspended" | "roster" | "dormant" | "noScreens";

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
  users, onShowGuide, exceptions, statusFilter, onFilter,
}: {
  users: PortalUser[];
  /** The exception counts, drawn as cells beside the headcount. Empty on the other tabs. */
  exceptions: { key: UserFilterKey; count: number; label: string; hint: string; icon: React.ReactNode }[];
  statusFilter: UserFilterKey | null;
  onFilter: (next: UserFilterKey | null) => void;
  /* The exception counts and their filter left for the toolbar, where a table's filters belong —
     so this component is the headcount and its breakdown, and nothing else. */
  onShowGuide: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];

  /*
   * TWO AXES, AND THE LINE HAS TO SHOW THEM AS TWO.
   *
   * These five figures were one comma list, which reads as one partition of the accounts — and it
   * does not add up: on the seeded project it printed 최고관리자 1 · 관리자 0 · 읽기 전용 1 ·
   * 앱 전용 3 · Portal 전용 1 for FIVE accounts, because Aaron Sim is counted twice (he is the
   * read-only console role AND the Portal-only door). A reader who adds a list of counts and gets
   * six for five people stops trusting the rest of the numbers.
   *
   * They are two different questions — which console role, and which door — which is exactly the
   * split the permission model made deliberately (portal role vs appAccess). So the line names
   * each group. The door side does not list "Portal + 앱" because it is the ordinary answer and
   * the two named ones are the exceptions worth counting.
   */
  const roleGroups: { name: string; counts: [string, number][] }[] = [
    { name: t.axisConsoleRole, counts: [
      [t.countOwners, users.filter(u => u.permission === "owner").length],
      [t.countAdmins, users.filter(u => u.permission === "admin").length],
      [t.countAuditors, users.filter(u => u.permission === "auditor").length],
    ] },
    { name: t.axisDoor, counts: [
      [t.countAppOnly, users.filter(u => accessModeOf(u) === "appOnly").length],
      [t.countPortalOnly, users.filter(u => accessModeOf(u) === "portalOnly").length],
    ] },
  ];



  return (
    <>
      {/* ONE CARD, for the number the page is about. */}
      <SummaryStrip cells={[
        {
          key: "total",
          icon: <Users2 size={14} strokeWidth={2.4} />,
          /* ACCOUNTS ONLY (owner, 2026-09-22: 계정만). It was users.length + rosterWaiting, so the
             headline read 13 on a screen that also printed 계정 5 and 명부 대기 8 separately and a
             table with five rows in it — one number made of two that are both already on screen,
             agreeing with neither. The card now says the same thing the tab and the table say. */
          figure: users.length,
          unit: t.countPeopleUnit,
          label: t.countTotal,
        },
        /* NEUTRAL, EVERY ONE. `tone: "warning"` is what they carried when they were cells before,
           and three amber cards in a row beside the headcount is the thing that made them awkward
           there. A defect still has to be noticed, and the figure is what does that. */
        ...exceptions.map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          label: item.label,
          title: item.hint,
          active: statusFilter === item.key,
          onClick: () => onFilter(statusFilter === item.key ? null : item.key),
        })),
      ]} />
      {/*
        THE BREAKDOWN GOES WITH THE FIGURE IT BREAKS DOWN (owner, 2026-09-22: 위치를 조금
        조정하는게 좋을것같아).
        
        It used to sit directly under the cards, and it still says the same thing — how the
        headcount above it divides. Once the exception counts left the strip for a line of
        chips, that line landed between the two and the breakdown read as a footnote of the
        chips instead. Order now: the count, what it divides into, then the filters — and the
        filters are last because they act on the table, which is what follows them.
      */}
      {/* The distribution, and the way to what those words mean — at the end of the sentence that
          uses them. A guide link is worth having (the role descriptions otherwise live inside a
          select an auditor may not be allowed to open), but it needs something to be attached to,
          and this line is the only place on the page that says all five names in a row. */}
      {/* Pulled up against the cards and pushed away from what follows. This line is a breakdown
          OF those numbers, so it belongs to them — and the gap after it is where the page's next
          section starts. Equal gaps everywhere is what made this page read as one flat column:
          hierarchy here is spacing, not another heading. */}
      <p style={{ fontSize: "11px", color: "var(--gray-500)", margin: "-12px 0 14px" }}>
        {/* A REAL GAP, not three spaces — HTML folds those, and the line came out as
            "읽기 전용 1 로그인 앱 전용 3", which is the two groups run together and unreadable at
            exactly the place the split was supposed to be. inline-block so the margin applies. */}
        {roleGroups.map((g, i) => (
          <span key={g.name} style={{ display: "inline-block", marginLeft: i > 0 ? "18px" : 0 }}>
            <span style={{ color: "var(--gray-400)" }}>{g.name}&nbsp;</span>
            {g.counts.map(([label, count]) => `${label} ${count}`).join(" · ")}
          </span>
        ))}
        {/* The guide belongs to the whole line, not to the 로그인 group it used to sit behind a
            "·" from — a dot there read it as a third figure in that group. Same 18px as between
            the groups. */}
        <button
          onClick={onShowGuide}
          style={{
            border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: "11px", color: "var(--gray-500)",
            // Dotted, not solid: this is the same "there is an explanation behind this" cue the
            // page's own hint labels use, and a solid underline in a grey caption reads as a link
            // to another page.
            borderBottom: "1px dotted var(--gray-300)",
            marginLeft: "18px",
          }}
        >
          {t.whatRolesMean}
        </button>
      </p>
    </>
  );
}

type UserSortKey = "name" | "projects" | "permission" | "lastLogin" | "status" | "cameras";

interface PortalUsersPageProps {
  /** Scopes the table to users who have access to this project — mirrors Clerk's per-application Users tab. */
  projectId: string;
  /** Sends the reader to Input Sources, where cameras are selected. Optional so this page still
   *  renders anywhere it is mounted without the detail page's tab switcher around it. */
  onGoToCameras?: () => void;
}

/**
 * An account nobody is using, on a site where nobody would notice.
 *
 * The reason this needs a name: contractor staff rotate, and the account that leaves with them
 * is the one nobody closes. It is not suspended, not invited, not anything the console already
 * counts — it is active and quiet, which looks exactly like an account in good standing until
 * somebody signs in with it.
 *
 * ONE SHAPE TODAY, not the two this comment used to claim: an active account that has not signed
 * in for 90 days. An unaccepted invitation older than 90 days is a live credential too and belongs
 * in the same pile, but `PortalUser` carries no invitedAt (see isDormant), so its age cannot be
 * judged in the browser — and the tile's own tooltip was promising that half to the reader while
 * nothing counted it. It comes back when the server reports when an invitation was issued.
 *
 * 90 days is a threshold, not a policy. It is long enough that leave, secondment and a quiet
 * season do not fill this list with people who are simply not on shift, and short enough to
 * catch a rotation. Nothing is done automatically on it: this only makes the accounts visible,
 * and an administrator decides one at a time.
 */
const DORMANT_AFTER_DAYS = 90;

/**
 * Changing a row's Portal role, or which doors that account opens, asked as a question.
 *
 * Both of these were a 36px FilterSelect ON EVERY ROW, and that is what the table looked like:
 * two columns of bordered white boxes with chevrons running down the middle of it, heavier than
 * the names beside them, most of them repeating the same word — while the actions somebody came
 * to this table for (suspend, remove) sat quietly behind the kebab. A list of accounts read as a
 * permissions form. ProjectVipTab made the same call on its group column and states the rule this
 * follows: every other table in Portal shows values and sends changes to a form.
 *
 * It also fixes something the selects hid. A viewer who could not change these saw plain text in
 * the same cells, so the table's density depended on who was reading it — the same screen was two
 * different screens, and neither was the one anybody had designed.
 *
 * CONFIRMED, NOT APPLIED ON PICK. A select commits the moment it changes and offers nothing to
 * cancel with, and neither of these is cheap to walk back: a demoted owner may no longer have the
 * power to restore themselves, and closing a door signs the person out of it. ConfirmModal already
 * carries every other access change on this page, and the picker is its one field — the same way
 * the VIP release dialog asks its one question rather than stacking a second box on top.
 */
function AccessChangeModal({ title, body, options, current, onApply, onClose }: {
  title: string;
  body: string;
  options: { value: string; label: string; description?: string }[];
  /** The value the row already holds. Also the guard on the confirm button: a dialog that has
   *  been opened and not answered should not be able to write the answer it started with. */
  current: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [value, setValue] = useState(current);
  /* While the list below is open it owns Escape. Without this, one keypress closed the list AND
     this dialog — reproduced in the browser before fixing. */
  const [selectOpen, setSelectOpen] = useState(false);
  return (
    <ConfirmModal
      title={title}
      body={body}
      confirmLabel={t.changeApply}
      cancelLabel={t.cancel}
      confirmDisabled={value === current}
      onConfirm={() => { onApply(value); onClose(); }}
      onClose={onClose}
      escapeSuspended={selectOpen}
    >
      {/* ConfirmModal's body does not scroll unless a caller asks it to, and this one must never
          ask: the list below hangs past the body's edge, and `bodyScrolls` would make the
          clipping context that cuts it off — the same trap MODAL_BODY_WITH_SELECT exists for. */}
      <div style={{ marginTop: "14px" }}>
        <FilterSelect value={value} onChange={setValue} options={options} onOpenChange={setSelectOpen} />
      </div>
    </ConfirmModal>
  );
}

function isDormant(u: PortalUser, nowMs: number): boolean {
  const cutoff = nowMs - DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000;
  if (u.status === "active") {
    // Never signed in and still active: the account exists and has never been used.
    if (!u.lastLoginAt) return true;
    return new Date(u.lastLoginAt).getTime() < cutoff;
  }
  // Active only. An unaccepted invitation is a live credential too, but PortalUser records no
  // issue date, so its age cannot be judged — counting every open invitation as dormant would
  // put yesterday's new hire on this list. That needs an `invitedAt`, not a guess. Suspended
  // accounts are already counted as suspended: they are closed, which is the outcome this tile
  // exists to push somebody toward.
  return false;
}

export default function PortalUsersPage({ projectId, onGoToCameras }: PortalUsersPageProps) {
  // Post-mount, like every other clock read in Portal — see TempPasswordBadge. Dormancy is a
  // judgement about elapsed time, so it cannot be decided during a server render.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
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
  const updatePortalUserProjects = useVcaStore(s => s.updatePortalUserProjects);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const suspendPortalUsers = useVcaStore(s => s.suspendPortalUsers);
  const [confirmingBulkSuspend, setConfirmingBulkSuspend] = useState(false);
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
  const recordListExport = useVcaStore(s => s.recordListExport);
  // The roster is in the guide's "cameras, VIP, roster, license, server" row, so it takes the
  // wider gate — an admin maintains it, an auditor reads it. Everything about ACCOUNTS above
  // stays owner-only under manageAccess.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  // The user whose already-issued setup code is being looked up again, or null.
  const [viewingCodeFor, setViewingCodeFor] = useState<PortalUser | null>(null);
  // The user a temporary password is being issued for, or null. Held as the user rather than an id
  // so the modal keeps rendering the right name even if the row scrolls out from under it.
  const [credentialFor, setCredentialFor] = useState<PortalUser | null>(null);
  /** The invite links waiting to be handed over, or null. Held by the page, not by whatever made
   *  them: approving the last access request unmounts that panel. See InviteLinkPanel. */
  const [invitePanel, setInvitePanel] = useState<{ title: string; links: InviteLink[] } | null>(null);
  // The row whose Portal role, or whose doors, are being changed. Same reason as credentialFor:
  // the user, not an id.
  const [changingRoleFor, setChangingRoleFor] = useState<PortalUser | null>(null);
  const [changingAccessFor, setChangingAccessFor] = useState<PortalUser | null>(null);
  const [changingGrantsFor, setChangingGrantsFor] = useState<PortalUser | null>(null);
  const [scopingFor, setScopingFor] = useState<PortalUser | null>(null);
  const allCameras = useVcaStore(s => s.cameras);
  const cameraGroups = useVcaStore(s => s.cameraGroups);
  /** The cameras a scope for this account may name — the rule is on `scopableCameras`. */
  const scopableCamerasFor = (u: PortalUser) => scopableCameras(allCameras, u.projectIds);
  /* How many cameras the account resolves to, or null for "every camera". Groups are resolved
     through their current membership, so this number moves when a group does — which is the point
     of a group (see CameraGroup). Intersected with what the account may be scoped to, so a group
     from a project they were removed from cannot inflate the figure. */
  const scopeCountFor = (u: PortalUser) => {
    const ids = scopedCameraIds(u, cameraGroups);
    if (ids === null) return null;
    const scopable = new Set(scopableCamerasFor(u).map(c => c.id));
    return [...ids].filter(id => scopable.has(id)).length;
  };
  const groupNamesFor = (u: PortalUser) => (u.cameraGroupIds ?? [])
    .map(id => cameraGroups.find(g => g.id === id)?.label)
    .filter(Boolean).join(", ");
  // Raw slice out of the selector, lookup built in a memo — a selector that returns a new object
  // every call re-renders forever, which is how this page last broke.
  const allPresetsHere = useVcaStore(s => s.accessPresets);
  /* `lang` is a dependency because the three presets we ship are printed as product strings:
     without it the map keeps whichever language was current when it was first built, and the
     Korean table showed "Investigator" in the access cell while the same preset read 조사자 in
     every dialog. The language hook settles after mount (it reads localStorage), so the first
     build is always the wrong one. */
  const presetLabelById = useMemo(
    () => new Map(allPresetsHere.map(pr => [pr.id, presetLabel(pr, lang)])),
    [allPresetsHere, lang]
  );
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
  /*
   * WHOSE CODE WAS MINTED A MOMENT AGO (owner: 재발급 방금받았다는 표시에 표에 있어야할것같아).
   *
   * Session state, deliberately not stored: "just" is about what happened on this screen while
   * the reader was watching, and a flag the record carried would still be claiming 방금 tomorrow
   * morning. It survives no reload, which is the honest lifetime for that word.
   *
   * It does two things at once, and they are the same fact: the row says the code is new, and the
   * cell opens it revealed instead of masked.
   */
  const [justIssuedFor, setJustIssuedFor] = useState<string | null>(null);
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
  const [peopleTab, setPeopleTab] = useState<"accounts" | "roster" | "groups" | "presets">("accounts");
  const [search, setSearch] = useState("");
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
  /*
   * SEVEN TRACKS, DOWN FROM NINE (owner, 2026-09-22: 비는 열 지우고 쓸 열 넓힌다).
   *
   * Measured on the seeded project: 「다른 프로젝트」 held a grey "이 프로젝트만" on four rows of
   * five and 「인물 검색」 held "—" on three, together spending 247px of the row — while 「접근」,
   * at 123px, was stacking four things in one cell (the door, the preset name, an 앱 화면 미지정
   * badge and a 화면 지정 link). The widest columns were the empty ones.
   *
   * Neither value is dropped, both move to where they belong. Another project is a fact about the
   * PERSON, so it goes under their address, and only when there is one — this page is scoped to a
   * project, so "only this one" is the ordinary case and silence is the right way to say it.
   * Person search is one of the six app actions, so it goes on the line that already names the
   * grant, as a mark beside the preset rather than a column asking the same question twice.
   */
  const GRID = showAccountColumns
    ? "minmax(160px, 1.2fr) 0.6fr 0.75fr 0.6fr 1.12fr 0.6fr 0.8fr 36px"
    : "minmax(180px, 1.4fr) 1fr 1.2fr 0.7fr 36px";

  const bulkIssueCodes = () => {
    if (notIssuedIds.length === 0) return;
    issueRegistrationCodes(notIssuedIds);
    showToast({ variant: "success", title: t.toastBulkIssued(notIssuedIds.length) });
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  // The team this page's project belongs to — the only projects an account here may be given.
  // See UserProjectsModal on why the team itself is not editable from that dialog.
  const pageTeamId = projects.find(p => p.id === projectId)?.teamId;
  const teamProjects = projects.filter(p => p.teamId === pageTeamId);
  /* The presets of this page's team — for the tab's count. In a memo because presetsForTeam
     builds a new array every call, which is what makes a selector never settle. */
  const allPresets = useVcaStore(st => st.accessPresets);
  const pagePresets = useMemo(() => presetsForTeam(allPresets, pageTeamId ?? ""), [allPresets, pageTeamId]);
  const [editingProjectsFor, setEditingProjectsFor] = useState<PortalUser | null>(null);
  /** The account whose card is open. One card replaced the row's nine-item menu. */
  const [managing, setManaging] = useState<PortalUser | null>(null);
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
  const [statusFilter, setStatusFilter] = useState<UserFilterKey | null>(null);
  /*
   * FILTER BY HOW MUCH OF THE SITE AN ACCOUNT SEES (owner's mockup, 2026-09-22: 모든 카메라
   * 접근 범위 select). The camera column now says 「3 / 62」 with 「그룹 1」 under it, and a column
   * that carries a fact this specific has to be filterable by it — "who can watch everything" is
   * the first question an access review asks and it was answerable only by reading 62 rows.
   *
   * Three values because the data has three states and no more: every camera on their projects,
   * a narrowed set, and no app at all (the column's own 「—」). A fourth for "narrowed to nothing"
   * would be a filter for a state the scope dialog refuses to save.
   */
  const [scopeFilter, setScopeFilter] = useState<"all" | "every" | "narrowed" | "none">("all");
  /*
   * THE ROSTER'S OWN FILTER, so its toolbar answers a question instead of holding one control.
   *
   * Three values and no more, because 명부 대기 shows exactly three states: a row with no code
   * yet, one whose code is out and unused, and one whose code ran out of time. "used" is the
   * fourth state of the underlying record and it is never here — a used code has become an
   * account, which is the other tab.
   */
  const [rosterFilter, setRosterFilter] = useState<"all" | "not-issued" | "unused" | "expired">("all");
  /** True when the list is empty only because something is filtering it. The two empty states
   *  send the reader to different places, and one message for both sends half of them wrong. */
  const narrowed = statusFilter !== null || search.trim() !== "";
  // The page's clock, read after mount. See projectRosterAll.
  const [pageNowMs, setPageNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setPageNowMs(Date.now())); }, []);
  const q = search.trim().toLowerCase();
  // Split in two: the strip above the table counts everyone on the project, the table shows what is
  // left after the search. Counting the searched set instead would make the summary agree with the
  // table and stop being a summary.
  const projectUsers = portalUsers.filter(u => u.projectIds.includes(projectId));

  /*
   * THE EXCEPTIONS LEAVE THE CARDS (owner, 2026-09-22: 큰 카드를 벗기고).
   *
   * They were already hidden at zero, so the fault was never that they showed — it was their
   * WEIGHT: 초대 수락 안 함 1, 로그인 차단됨 1 and 앱 화면 미지정 2 each took the same card as the
   * headcount, so a figure of 1 shouted as loudly as the number the page is about, and five cards
   * across one row pushed the table itself out of the first glance.
   *
   * Same numbers, same filters, same explanations — one line of chips instead. A chip fills when
   * its filter is on, which is the state a card was spending a whole panel to show.
   */
  const exceptions = [
    { key: "invited" as const, count: projectUsers.filter(u => u.status === "invited").length, label: t.countInvited, hint: t.invitedHint, icon: <MailQuestion size={13} strokeWidth={2.4} /> },
    { key: "suspended" as const, count: projectUsers.filter(u => u.status === "suspended").length, label: t.countSuspended, hint: t.suspendedHint, icon: <UserX size={13} strokeWidth={2.4} /> },
    /* NO ROSTER CHIP. It sat directly under the 명부 대기 tab, with the same label and the same
       count, and pressing either did the same thing — switch to that tab. Two controls for one
       errand, twelve pixels apart. The tab is the one that was already there. */
    /* Counted over every account with the app door and no screens, suspended and invited
       included — the badge is on their rows, and a figure that disagrees with the badges under it
       stops being a figure anybody trusts. */
    { key: "noScreens" as const, count: projectUsers.filter(lacksAppScreens).length, label: t.countNoScreens, hint: t.noScreensHint, icon: <MonitorOff size={13} strokeWidth={2.4} /> },
    // Last, because it is the only one that is not a state the console set — it is a state that
    // accumulated while nobody looked.
    { key: "dormant" as const, count: nowMs === null ? 0 : projectUsers.filter(u => isDormant(u, nowMs)).length, label: t.countDormant, hint: t.dormantHint, icon: <UserMinus size={13} strokeWidth={2.4} /> },
  ].filter(item => item.count > 0);
  /** Setting a filter also puts the reader on the tab that can show it. */
  const onFilter = (next: UserFilterKey | null) => {
    setStatusFilter(next);
    if (next !== null) setPeopleTab("accounts");
  };
  const filteredUsers = projectUsers
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    // "roster" narrows to people who have no account at all, so no account row can match it.
    // "dormant" is not a status the record carries — it is a judgement about time, so it cannot
    // be compared against u.status like the other three.
    // "noScreens" is not a status either — it is a pair of grant fields, the same pair the gate
    // reads (see lacksAppScreens).
    .filter(u => statusFilter === null
      || (statusFilter === "dormant" ? nowMs !== null && isDormant(u, nowMs)
        : statusFilter === "noScreens" ? lacksAppScreens(u)
        : u.status === statusFilter))
    /* Read through the same helper the column draws from, not from the raw fields: a scope is a
       union of groups and individual cameras and only `scopedCameraIds` resolves both. A filter
       that re-derived it would drift from the cell it claims to filter. */
    .filter(u => {
      if (scopeFilter === "all") return true;
      if (!u.appAccess) return scopeFilter === "none";
      return scopeFilter === "every"
        ? scopedCameraIds(u, cameraGroups) === null
        : scopeFilter === "narrowed" && scopedCameraIds(u, cameraGroups) !== null;
    });
  /**
   * Roster rows for this project that are still waiting — matched against accounts by employee
   * number, which is the roster's own key. Status "used" is not enough on its own: an account can
   * also arrive by invitation and later be matched to a roster row, and the person should appear
   * once, as the account, not twice.
   */
  const accountEmployeeIds = new Set(
    portalUsers.map(u => u.employeeId?.toLowerCase()).filter(Boolean) as string[]
  );
  /**
   * Roster rows with the code TTL applied.
   *
   * Through the page's post-mount clock, not withEffectiveStatus's Date.now() default. A row
   * whose code was issued near the 14-day boundary is "unused" in the server's HTML and
   * "expired" in the browser's first pass, and React would have rendered one over the other —
   * which is exactly the hydration hazard every other clock read on this page already avoids.
   * Before the clock is known the stored status stands, which is the value the server sent.
   *
   * rosterWaiting, the tab count and the summary strip all hang off this, so the correction
   * reaches all three at once.
   */
  const projectRoster = staffRoster.filter(r => r.projectId === projectId);
  const projectRosterAll = pageNowMs === null
    ? projectRoster
    : withEffectiveStatus(projectRoster, pageNowMs);
  const rosterWaiting = projectRosterAll
    .filter(r => r.status !== "used" && !accountEmployeeIds.has(r.employeeId.toLowerCase()))
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q))
    .sort((a, b) => STAGES.indexOf(stageOfRosterEntry(a.status)) - STAGES.indexOf(stageOfRosterEntry(b.status)) || a.name.localeCompare(b.name));
  /**
   * The roster rows the table shows. Separate from rosterWaiting, which the tab count and the
   * summary strip read: a summary that shrinks when you filter to part of it has stopped being a
   * summary (the note above filteredUsers makes the same point about accounts).
   */
  /*
   * Sorted by whatever heading was clicked, which the headings have always drawn an arrow for
   * and never actually done — visibleRoster came straight off rosterWaiting's fixed stage-then-
   * name order, so the arrow moved and the rows did not.
   *
   * Stage order stays the tiebreaker under every key, because the funnel is what the tab is for.
   */
  const visibleRoster = sortRows(
    rosterWaiting
      .filter(() => statusFilter === null || statusFilter === "roster")
      /* On the table's rows only. Filtering `rosterWaiting` would shrink the rail's 명부 대기 count
         and the summary with it, and a count that moves when you narrow the view has stopped
         counting the thing it names — the same rule the accounts side follows. */
      .filter(r => rosterFilter === "all" || r.status === rosterFilter),
    sort,
    (r, key) => {
      switch (key) {
        case "name": return r.name.toLowerCase();
        case "permission": return r.permission;
        case "status": return STAGES.indexOf(stageOfRosterEntry(r.status));
        // The roster has no last-login column; the shared sort state can still carry the key
        // from the accounts tab, and falling back to the funnel is the honest answer.
        default: return STAGES.indexOf(stageOfRosterEntry(r.status));
      }
    },
  );
  const notIssuedIds = rosterWaiting.filter(r => r.status === "not-issued").map(r => r.employeeId);
  const printableEntries = rosterWaiting.filter(r => r.status === "unused" && r.code);

  /**
   * Who a "suspend everything shown" would actually touch.
   *
   * Deliberately not a checkbox column. This table's grid is already conditional on which tab is
   * open, and a selection model would need its own answers (select across a filter? across the
   * roster tab?) for a job that is really "these people left" — which the filter and the search
   * box already express. So the action rides on the narrowed set, and the confirm dialog lists
   * every name as the review step.
   *
   * Only offered while something IS narrowing the list. On an unfiltered table this would read
   * as "suspend everyone", which is not an errand anybody has.
   *
   * AND NOT UNDER THE GRANT-GAP CUT. "App screens not set" narrows to accounts that are missing a
   * grant, and the errand there is the repair link in their rows, not closing them — a bar reading
   * "suspend all shown" over two accounts whose only fault is an unfinished setup offers the one
   * action that makes the gap permanent. Every other cut on this strip does mean "this person is
   * on the way out or already stopped", which is what the bar is for.
   */
  const bulkSuspendOffered = narrowed && statusFilter !== "noScreens";
  const bulkSuspendTargets = peopleTab === "accounts" && bulkSuspendOffered
    ? filteredUsers.filter(u => u.status !== "suspended"
        // Your own account, excluded here rather than refused later: locking yourself out mid
        // clear-out is a mistake the screen should not offer, and the store cannot know which
        // session is asking.
        && u.id !== currentPortalUser(portalUsers)?.id
        && !isLastActiveAdmin(portalUsers, u.id))
    : [];
  const bulkSuspendKept = peopleTab === "accounts" && bulkSuspendOffered
    ? filteredUsers.filter(u => u.status !== "suspended").length - bulkSuspendTargets.length
    : 0;

  const scopedUsers = sortRows(filteredUsers, sort, (u, key) => {
    switch (key) {
      case "name": return u.name.toLowerCase();
      case "permission": return u.permission;
      // Undefined, not "" — someone who has never signed in has no date, and sortRows sinks
      // undefined to the bottom either way rather than letting it win "oldest first".
      case "lastLogin": return u.lastLoginAt;
      case "status": return u.status;
      /* A number, so ascending puts the narrowest first — which is the whole reason this column
         is sortable. "Every camera" is not a count, and taking the project's total for it keeps
         it at the top of the descending order where it belongs, above any narrowed account. */
      case "cameras": return scopeCountFor(u) ?? scopableCamerasFor(u).length;
      /* How many sites this account holds. Descending is the useful direction — the people spread
         across the installation come to the top — which is what this column is for. */
      case "projects": return u.projectIds.length;
    }
  });

  return (
    <div>
      {/* THE SOLE-OWNER WARNING WAS HERE AND IS GONE (2026-09-17, owner's call).
          Do not bring it back, and do not write another one.

          It told the administrator to "make a second person an owner", which is a proposal this
          project already REJECTED — forcing two owners was decided against, and this banner was
          the last place still asking for it. Its reasoning had also gone stale: it said recovery
          "takes someone with access to the server itself, not Portal", and that is no longer
          true. The answer, decided the same day: a locked owner phones the supplier who installed
          the system and is issued a temporary password (HANDOFF contract 12). The customer needs
          no second owner, and the vendor needs no account here.

          A banner that names a single point of failure with no remedy is worth its space. One that
          names a remedy the project has ruled out is worse than nothing: it asks for a change that
          will be refused, and every admin who reads it distrusts the next warning too.

          The GUARD is a different thing and stays: `isLastActiveAdmin` still refuses to demote,
          suspend or delete the last owner, and `removeTeam` refuses to reach the same end by
          deleting the container — Team settings -> Delete this team, which is also greyed out
          there with the reason on it (TeamSwitcher mirrors the same test).

          It is not guarding against a state this product can reach. An installation is handed over
          with its first owner already in it (`/signup` is off on-premise, decided 2026-09-02), and
          no path removes the last one — those refusals ARE why. What the guard is for is narrower
          and concrete: the demote, suspend and delete controls exist in this screen's row menu, so
          something has to answer when one of them is aimed at the only owner. A reissued password
          brings back an owner who is locked out; it cannot appoint one. */}


      {/* THE THIRD TAB REPLACES THE LIST, it does not sit above it. Camera groups are not people:
          the count strip, the search toolbar and the account/roster table all answer questions
          about accounts, and leaving them on screen under a table of groups would have the page
          showing two subjects at once with one set of filters over both. */}
      {/*
        ALL FOUR IN THE RAIL, AND NO TAB ROW AT ALL (owner, 2026-09-22: 계정이랑 명부대기도 왼쪽
        사이드바로 옮겨야할것같아).
       
        The fourth answer to one objection, and the last one, because it stops splitting the
        difference. The three before it each kept a tab row and argued about what belonged in it:
        a 1px rule inside the row (93d1c02), a second row under it, a 「권한용 묶음」 qualifier on
        one label (3eb3ded), then two in the row and two in a rail (38b19ea). That last one left
        BOTH navs half-lit — on 계정 the rail marked nothing, on 카메라 그룹 the tabs marked
        nothing — which was honest but is two controls where one will do.
       
        One rail, four rows, exactly one of them current. The kinds are still two and the rail
        still says so, by order and by the icons: the two people views first, then the two objects
        those people are given. Same component as the settings page (SectionNav), so this page and
        that one now navigate the same way.
       
        The counts move into the rows. 계정 5 · 명부 대기 8 were on the tabs and are the numbers
        somebody opens this page to see; a rail row has room for a figure at its right edge, which
        is what the product's own left rail already does with VIP 등록 122 and 입력 소스 62.
      */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
      <SectionNav
        sections={[
          /* TWO CAPTIONS, WHICH IS WHERE THIS OBJECTION FINALLY LANDS (owner, 2026-09-22: 계정과
             명부대기를 묶어서 그위에 작은글씨로 구분명을 추가해줘). Four rows that are two kinds
             was the whole complaint, and every earlier answer tried to say it with geometry — a
             rule, a second row, a qualifier on one label. A caption says it in a word, and in a
             rail it costs nothing: the product's own left rail already captions 작업 공간 and
             관리, so the line reads as a heading before it is read as text.
             THE TWO WORDS ARE THIS PAGE'S OWN NAME, SPLIT (owner, 2026-09-22: 사람이랑 권한묶음
             이라는 단어 조금 이상해). 「사람」 was bare and 「권한 묶음」 was a term invented for
             the occasion — a reader meets it here and nowhere else. The page is called 사용자 및
             권한, so its two halves are 사용자 and 권한, which is a name the reader has already
             read in the rail one level up. No new vocabulary. */
          { id: "accounts", group: t.railPeople, label: t.peopleTabAccounts, count: projectUsers.length, icon: <UsersIcon size={15} strokeWidth={2} /> },
          { id: "roster", group: t.railPeople, label: t.peopleTabRoster, count: rosterWaiting.length, icon: <ClipboardList size={15} strokeWidth={2} /> },
          /* A group answers "which cameras", a preset answers "which screens", and the invite form
             asks both — so they sit together, in the order the form asks them. Each keeps the icon
             its own screen already used for itself. */
          { id: "groups", group: t.railGrants, label: t.peopleTabGroups, count: cameraGroupsInProject(cameraGroups, projectId).length, icon: <Boxes size={15} strokeWidth={2} /> },
          { id: "presets", group: t.railGrants, label: t.peopleTabPresets, count: pagePresets.length, icon: <KeySquare size={15} strokeWidth={2.2} /> },
        ]}
        active={peopleTab}
        onSelect={id => setPeopleTab(id as "accounts" | "roster" | "groups" | "presets")}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
      {peopleTab === "presets" ? <AccessPresetsTab teamId={pageTeamId ?? ""} canEdit={manageAccess} />
        : peopleTab === "groups" ? <CameraGroupsTab projectId={projectId} onGoToCameras={onGoToCameras} /> : (<>
      {!mailAvailable && <RecoveryModeNotice supportContact={authConfig.supportContact} />}

      {/* The strip drives the tab as well as the filter. Picking "on the roster" from the
          Accounts tab used to set a filter no account's status can equal: the table emptied and
          printed "No users have access to this project yet" with six accounts one click away.
          The mirror case did the same on the other tab. A cell now shows what it counts. */}
      {/*
        THE THREE ARE CARDS AGAIN, THE SAME HEIGHT AS THE HEADCOUNT (owner, 2026-09-22: 카드 높이
        같게 해줘 — 칩을 카드 높이로).

        This closes a loop and it is worth writing down. They began as cards in this strip; the
        owner found them awkward there (초대 수락안함~3가지 좀 위치가 애매해보여) and they became a
        line of chips beside the search box, which is where a table's filters belong. Moving them
        into the strip's leftover room made them short pills beside a 73px card, and short pills
        beside a card read as a different KIND of control rather than a quieter one.

        So: cells of the strip, which is the one thing here that already draws equal-height cards
        with a pressed state. What was actually wrong the first time was the AMBER — three cells
        tinted for defects beside the headcount read as three alarms — and that is fixed by tone:
        every one of them is neutral now (owner: 좀 강조되지않게). The count keeps its size, which
        is the part somebody has to notice; only the colour stood down.

        The hint moves from our own Tooltip to the cell's `title`, which is the browser's. That is
        a real loss — the browser's wants the pointer held still for about a second — and it is the
        price of the shared cell. If these hints turn out to matter, `title` on SummaryCell is the
        thing to upgrade, not a fourth home for these three counts.
      */}
      {/* THE STRIP IS THE ACCOUNTS TAB'S (owner, 2026-09-22: 명부대기 화면에 상단 카드는 없어도
          되지않을까). It counts ACCOUNTS — 5명 이 프로젝트 인원, and under it the five role
          figures — and 명부 대기 lists the people who have none of those yet. A card counting one
          population over a table of another is the same fault the headline had when it printed 13
          for 5 accounts plus 8 roster rows. The count that tab needs is already in the rail
          (명부 대기 8), which is where it was read from to get here. */}
      {peopleTab === "accounts" && (
        <UserCountStrip
          users={projectUsers}
          onShowGuide={() => setShowGuide(true)}
          exceptions={exceptions}
          statusFilter={statusFilter}
          onFilter={onFilter}
        />
      )}

      <AccessRequestsPanel projectId={projectId} onLinksMade={setInvitePanel} />

      {/* Search alone. The permission and status filters that used to sit on the right are gone: the
          counts strip directly above already answers what they were for (how many owners, how many
          invited, how many suspended), the columns they filtered on are sortable, and a project's
          account list is short enough to read. */}
      {/* Search and the tools on one row, the way every other Portal table does it (2026-09-15).
          The tools used to sit in a row of their own, 209px higher and above the tab switcher —
          which put controls that CHANGE WITH THE TAB above the control that changes the tab, with
          the counts, the summary strip and a caption in between. Read top to bottom, they looked
          like page chrome rather than tools for the table underneath them.

          No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice.

          The "what the roles mean" link used to sit beside the buttons and belonged to nothing —
          a lone underlined phrase at the top of a page reads as a warning or a leftover. It moved
          to the end of the role-distribution caption, where the roles are named one by one and the
          question arises on its own. */}
      {/* The toolbar and the table under it are one thing — a list and the controls that narrow it
          — so they sit close. The distance that matters is the one above this row, not the one
          inside the pair. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: TOOLBAR_GAP }}>
      {/*
        THE PLACEHOLDER NAMES WHAT THIS TAB ACTUALLY SEARCHES (owner, 2026-09-22: 검색바에
        플레이스홀더명이 이름이랑 이메일주소로 검색인데, 정작 아래 테이블엔 이메일 주소가 안보여).
       
        One string served both tabs and it was wrong on the roster in both directions: it promised
        an email address the roster neither matches nor prints, and it hid the 사번 it does match —
        the filters are `u.name || u.email` for accounts and `r.name || r.employeeId` for the
        roster. A placeholder that names a field the table has no column for is a promise the
        screen cannot keep.
      */}
      <SearchInput value={search} onChange={setSearch}
        placeholder={peopleTab === "roster" ? t.rosterSearchPlaceholder : t.searchPlaceholder} />
      {/* Beside the search, which is where this table's filters belong — the three exception
          counts stayed in the strip because they are counts as much as filters, and this one is
          only a filter. Accounts tab only: the roster has no camera scope to narrow by. */}
      {peopleTab === "roster" && (
        <FilterSelect
          value={rosterFilter}
          active={rosterFilter !== "all"}
          onChange={v => setRosterFilter(v as typeof rosterFilter)}
          options={[
            { value: "all", label: t.rosterFilterAll },
            { value: "not-issued", label: t.rosterFilterNotIssued },
            { value: "unused", label: t.rosterFilterIssued },
            { value: "expired", label: t.rosterFilterExpired },
          ]}
        />
      )}
      {peopleTab === "accounts" && (
        <FilterSelect
          value={scopeFilter}
          active={scopeFilter !== "all"}
          onChange={v => setScopeFilter(v as typeof scopeFilter)}
          options={[
            { value: "all", label: t.scopeFilterAll },
            { value: "every", label: t.scopeFilterEvery },
            { value: "narrowed", label: t.scopeFilterNarrowed },
            { value: "none", label: t.scopeFilterNone },
          ]}
        />
      )}

          {/* Tools follow the tab. Six buttons in one row was every tool for both halves of the
              lifecycle competing at once, and four of them could not act on what the reader was
              looking at. The two ways of adding a person stay on the combined tab; the roster's bulk
              work lives with the roster rows. */}
          {/* marginLeft auto, not a <span style={{flex:1}}/> spacer beside it. A spacer only pushes
              on the line it is on: once the row wraps — under about 1240px with the roster's six
              controls — the group drops to a line of its own and the spacer stays behind, leaving
              the buttons hugging the left edge with 200px of empty space to their right. An auto margin
              absorbs the free space on whichever line the group lands on, so it stays at the right
              end in both states. */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" }}>
          {peopleTab !== "roster" && (
          /* Disabled with the reason on it rather than hidden: a control that vanishes reads as a
             missing feature and sends the admin looking elsewhere for it. */
          <button
            onClick={() => manageAccess && setShowInvite(true)}
            disabled={!manageAccess}
            title={manageAccess ? undefined : t.reasonNotOwner}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: manageAccess ? "var(--primary-400)" : "var(--gray-100)", color: manageAccess ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: manageAccess ? "pointer" : "not-allowed", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke={manageAccess ? "white" : "var(--gray-400)"} strokeWidth="1.22" strokeLinecap="round"/></svg>
            {t.inviteUser}
          </button>
          )}
          {/* Icons on the secondary tools too. Only the invite button had one, so on a page whose
              neighbours put a mark on every action these five read as unfinished — and a row of five
              identical grey pills is a row you have to read word by word. 14px at stroke 2.4 is the
              1.4px Portal draws (see ICON_STROKE_PX). */}
          {/*
            Roster tab only, and the coloured action there.

            It sat on both tabs for a while, on the reasoning that adding a person is the page's
            subject either way. In practice the Accounts tab then offered two ways to add somebody
            side by side — invite by mail, and put a name on the roster — which are the same goal by
            two delivery mechanisms, and the labels do not carry that difference. The reader has to
            stop and work out which one they want before doing either.

            Accounts is about accounts: the one action there is inviting somebody to make one. The
            roster is one tab away and its own tab's primary.
          */}
          {/* Three controls, not five (2026-09-15). "Add to roster" is the errand; the code
              button carries a COUNT, and that count is nowhere else on the screen — the summary
              strip states invited, suspended and on-the-roster, never how many are still waiting
              for a code — so folding it away would delete the only thing that says four people
              cannot sign in yet. It hides itself at zero instead of greying out, which is the
              same information with nothing to read.

              The other three move behind the menu: putting a file in, taking a file out, printing
              a sheet. None of them changes who is in the roster, and none carries a number.

              LEFT OF 「명부에 추가」 (owner, 2026-09-22: 일괄 버튼은 명부에 추가 왼쪽으로 옮겨서
              넣어줘). It sat to the right of the primary, which put a quiet button between the
              filled one and the ⋮ menu and read as the last thing on the row rather than the
              secondary of the pair. Now the primary ends the strip beside its own menu, and the
              batch action — the one that acts on rows already in the table — sits before it. */}
          {peopleTab === "roster" && notIssuedIds.length > 0 && mayEdit && (
          <button className="portal-btn-quiet" onClick={bulkIssueCodes}
            style={{ ...SECONDARY_BTN, color: "var(--gray-600)", cursor: "pointer" }}>
            <KeyRound size={14} strokeWidth={2.4} />
            {t.bulkIssue(notIssuedIds.length)}
          </button>
          )}
          {peopleTab === "roster" && (
          <button
            onClick={() => mayEdit && setRosterEditorFor({ entry: null })}
            disabled={!mayEdit}
            title={readOnlyReason}
            style={{ ...SECONDARY_BTN, padding: "10px 16px", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-100)", border: "none", color: mayEdit ? "white" : "var(--gray-400)", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed" }}
          >
            <ClipboardPlus size={14} strokeWidth={2.4} />
            {t.addToRoster}
          </button>
          )}
          {peopleTab === "roster" && (
          <RowActionsMenu
            variant="toolbar"
            actions={[
              { label: t.importRoster, onClick: () => setShowRosterImport(true), disabled: !mayEdit, reason: readOnlyReason },
              /* Export and Print stay reachable for a read-only account: handing the roster over
                 as a file or a sheet is reading it, not changing it, and it is most of what that
                 role is for. They grey out only when there is nothing to hand over. */
              { label: t.exportRoster, onClick: () => {
                  const n = exportRosterCsv(projectRosterAll, currentProject?.name ?? projectId, rt);
                  // Recorded here rather than inside exportRosterCsv: that one is a plain function
                  // shared with the print sheet and cannot hold a hook. Not a gate — see
                  // ListExportRecord; reading these is the auditor's job.
                  recordListExport({ projectId, list: "roster", rowCount: n });
                  showToast({ variant: "success", title: t.toastRosterExported(n) });
                }, disabled: projectRosterAll.length === 0, reason: t.nothingToExport },
              { label: t.printHandout, onClick: () => setShowPrintSheet(true),
                disabled: printableEntries.length === 0, reason: t.nothingToPrint },
            ]}
          />
          )}
          </div>
      </div>

      {/* Only while the list is narrowed, and only with somebody to act on. An "act on everything
          shown" control above an unfiltered table is an invitation to a mistake nobody meant to
          make; above a filtered one it is the whole errand — "these people left". */}
      {mayEdit && bulkSuspendTargets.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          padding: "10px 14px", marginBottom: "10px", borderRadius: "10px",
          backgroundColor: "var(--gray-50)", border: BORDER,
        }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
            {t.bulkSuspendBar(bulkSuspendTargets.length)}
          </span>
          {bulkSuspendKept > 0 && (
            <span style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.bulkSuspendKept(bulkSuspendKept)}</span>
          )}
          <button className="portal-btn-outline" onClick={() => setConfirmingBulkSuspend(true)}
            style={{ marginLeft: "auto", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.bulkSuspendAction}
          </button>
        </div>
      )}

      {confirmingBulkSuspend && (
        /* Every name, not a count. The list IS the review step here — there are no checkboxes to
           look back at, so the dialog has to be the place where "wait, not that one" happens. */
        /* NOT `danger`, however many accounts it acts on at once. Red on a confirm is this
           console's mark for what cannot be taken back — everywhere else it appears, something is
           deleted — while this dialog's own body says nothing is deleted and that any of these
           accounts can be restored without a new invitation. A red button under that sentence
           teaches the reader to stop reading the sentence. 제거 keeps it. */
        <ConfirmModal
          title={t.bulkSuspendTitle(bulkSuspendTargets.length)}
          body={t.bulkSuspendBody}
          confirmLabel={t.bulkSuspendCta(bulkSuspendTargets.length)}
          cancelLabel={t.cancel}
          onClose={() => setConfirmingBulkSuspend(false)}
          onConfirm={() => {
            const refused = suspendPortalUsers(bulkSuspendTargets.map(u => u.id));
            const done = bulkSuspendTargets.length - refused.length;
            setConfirmingBulkSuspend(false);
            showToast({ variant: done > 0 ? "success" : "warning", title: t.bulkSuspendedToast(done) });
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "40vh", overflowY: "auto" }}>
            {bulkSuspendTargets.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{u.name}</span>
                <span style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
              </div>
            ))}
          </div>
        </ConfirmModal>
      )}

      {/* No overflow:hidden here — it used to clip the header row's flat corners to match the
          card's rounded ones, but that also clips any row's RowActionsMenu dropdown that opens
          past the container's bottom edge (invisible, not just cut off). Radius the header row
          itself instead. */}
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        {/* Column widths, and why they are these: the two columns that are usually "—" (Person
            Search, MFA) and Status, whose badge is a word, were each wider than their content, and
            the width had to come from somewhere — it came from Team and Projects, which are the
            long names, so on a narrow window they wrapped to three lines while Status sat in a
            cell with a hand's width of nothing to its right. Narrowing those three moves Status
            right, up against the actions menu where it belongs, and gives the names their room
            back. */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
          {/* Projects and MFA carry no sortKey: a user belongs to several projects, so there is no
              single value to order by, and MFA is display-only mock data it would be misleading to
              let anyone rank people with. */}
          {((showAccountColumns ? [
            { label: t.colUser, key: "name" },
            /* Before what they may do: a suspended account makes every grant on the row
               hypothetical, and that has to be known at the name. */
            { label: t.colStatus, key: "status" },
            { label: t.colPermission, key: "permission" },
            /* Sortable: "who is on more than this site" is the question, and it is answered by
               ordering the column, not by reading five rows. */
            { label: t.colProjects, key: "projects" },
            { label: t.colAccess },
            /* Sortable, and "전체" sorts as the largest: the question this column answers is who
               has been narrowed, so the narrowest scopes have to be reachable in one click. */
            { label: t.colCameras, key: "cameras" },
            { label: t.colLastLogin, key: "lastLogin" },
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
        {/* Per tab: each half answers for itself, and neither can speak for the other's rows.
            "Nothing matches what you asked for" and "there is nothing here" send the reader to
            two different places, and one message for both sends half of them wrong. */}
        {(peopleTab === "accounts" ? scopedUsers.length : visibleRoster.length) === 0 && (
          <TableEmpty text={narrowed ? t.emptyFiltered : peopleTab === "accounts" ? t.emptyNoUsers : t.rosterEmpty} />
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
            borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
          }}>
            <div style={{ minWidth: 0 }}>
              <p title={u.name} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
              <p title={u.email} style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
            </div>
            {/*
              THE STATE OF THE ACCOUNT, BESIDE THE ACCOUNT (owner, 2026-09-22: 계정상태는 사용자열
              근처에 있어야할것같아).
              
              It was the last column before the menu, at the far edge of a 1,144px row, so reading
              "is this person active" meant crossing five columns of what they may do. Whether the
              account works at all comes before what it reaches: 정지됨 makes every other cell in
              the row hypothetical, and the reader should know that at the name.
              
              Left-aligned now. The right edge was the reason it used to be pushed away from the
              actions menu, and it is no longer at that edge.
            */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
              <StatusBadge status={u.status} />
              {u.tempPasswordIssuedAt && <TempPasswordBadge issuedAt={u.tempPasswordIssuedAt} />}
              {u.setupCode && <SetupCodeBadge issuedAt={u.setupCodeIssuedAt} />}
            </div>
            {/* A VALUE, NOT A CONTROL — both this cell and Access beside it. They were each a
                bordered 36px select on every row, which made a list of people read as a form for
                editing permissions, and left the row's real actions (suspend, remove) as the
                quietest thing on it. Changing either now goes through the row menu, which is
                where this table's other access changes already live, and through a confirm step,
                because neither is cheap to undo. See AccessChangeModal.

                An account with no Portal access has no role to show, and printing one would imply
                a Portal role can be held without Portal. The dash says so; Access beside it is
                where that changes.

                The dead-end the selects used to have is gone with them: the last owner's role is
                the one the store refuses to change (isLastActiveAdmin), and the menu entry for it
                is disabled with the reason attached rather than opening and doing nothing. */}
            {!canEnterPortal(u.permission) ? (
              <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
            ) : (
              <span title={lastAdmin ? t.lastAdminRoleFixed : undefined} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{roleLabel(t, u.permission)}</span>
            )}
            {/*
              HOW MANY SITES THIS ACCOUNT IS ON — ITS OWN COLUMN, AND A NUMBER (owner, 2026-09-22:
              열을 추가해주는게 맞을것같은데).
              
              Three shapes were tried on the way here and the measurements are why this one won.
              A column of grey "이 프로젝트만" spent 162px saying what the page's own scope already
              says. A sentence under the address — "Riverside International School에도 있음" —
              needed 264px in a 239px cell, so it was clipped on the one row that had it, two
              sites came to 291px and three to 294px, and it made that row 77px tall against 59px
              for the rest. A chip beside the name read as one more PERSON: +1 by a name in a list
              of people is "and one other", not "and one other site".
              
              A number in a column of numbers cannot be misread, does not grow (one more site is
              one more digit), and sorts — which is the question an access review actually asks:
              who is on more than this site. The names are in the hover, and 프로젝트… in the row
              menu is where it changes.
            */}
            {(() => {
              const others = u.projectIds.filter(pid => pid !== projectId);
              const hint = others.length === 0 ? t.projectsOnlyThis : t.alsoOn(others.map(projectName).join(", "));
              const style: React.CSSProperties = {
                fontSize: "12px", fontVariantNumeric: "tabular-nums", textAlign: "left",
                /* A grid child stretches by default, so the button filled the whole 106px track
                   and its dotted underline ran the width of the cell under a single digit
                   (owner: 2 아래 점선이 숫자에 비해 너무 길어). justifySelf is the grid-level
                   property that fixes it — `display: inline-block` loses to stretch. */
                justifySelf: "start",
                /* One site is the ordinary answer and stays quiet; more than one is the row worth
                   finding, so it is the one that gets the ink. */
                color: others.length > 0 ? "var(--gray-900)" : "var(--gray-400)",
                fontWeight: others.length > 0 ? 700 : 500,
              };
              /* THE NUMBER OPENS THE LIST (owner: 프로젝트 권한이 이거말고 또 있는지 보여주긴
                 해야겠지?). Yes — and a hover cannot be the only way to read it: an access review
                 is somebody going down the column, and nobody hovers five rows to find the one
                 that says two. Pressing it opens the same dialog the row menu's 프로젝트… opens,
                 which is where those projects are also changed. Not a button for a reader who
                 cannot change access — then it is a value with its hint, like the cells beside
                 it. The underline only where there is something else to see: a dotted number on
                 every row would make "1" look like it hides something. */
              if (!manageAccess) return <span title={hint} style={style}>{t.projectsCount(u.projectIds.length)}</span>;
              /* THE UNDERLINE GOES ON THE DIGIT, THE HIT AREA ON THE BUTTON. Tightening the
                 button itself made both 7px wide — the dots fit the number and so did the only
                 place you could press. The mark belongs to the character; the padding belongs to
                 the finger. */
              return (
                <button type="button" title={hint} onClick={() => setEditingProjectsFor(u)}
                  style={{
                    ...style, border: "none", background: "none", padding: "2px 7px", margin: "0 -7px",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <span style={{ borderBottom: others.length > 0 ? "1px dotted var(--gray-400)" : "none", paddingBottom: "1px" }}>
                    {t.projectsCount(u.projectIds.length)}
                  </span>
                </button>
              );
            })()}
            {/* Where this person may sign in. Its own value rather than a fourth role, because it
                is a second question — see PortalPermission's doc.

                The second line says where the app grants come from, which was nowhere on this
                screen: an access review could not tell who follows a preset from who was tuned by
                hand, and the preset a person follows is most of the answer to "why can they see
                this". It reads what the account HOLDS first — an account with the app and no
                screens is turned away by the gate, and naming its preset would describe access it
                does not have. */}
            <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{accessLabel(t, accessModeOf(u))}</span>
              {/* THE GAP IS NAMED, NOT WHISPERED. "화면 없음" in 11px gray-400 was the quietest
                  thing in the row, and it is the one line on it that says this account reaches
                  nothing — AccessGate refuses it with "noScreens" and sends the reader to this
                  very screen to repair it. Same three parts Input Sources gave its server gap: an
                  amber badge naming what is missing, the repair directly under it, and a figure
                  in the strip above that filters the table to these rows. */}
              {u.appAccess && (lacksAppScreens(u) ? (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px", minWidth: 0 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0,
                    height: "18px", padding: "0 8px", borderRadius: "999px",
                    backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
                    fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    <MonitorOff size={11} strokeWidth={2.6} />
                    {t.grantsHeldNone}
                  </span>
                  {/* Opens the same dialog as the row menu's 앱 화면 변경, so there is one editor
                      for this and not a second one to keep in step. Behind manageAccess like
                      every other grant on this page: an admin may read the gap and only an owner
                      closes it, and the menu item states that reason for whoever cannot. */}
                  {manageAccess && (
                    <button onClick={() => setChangingGrantsFor(u)}
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)", textDecoration: "underline" }}>
                      {t.fixGrants}
                    </button>
                  )}
                </span>
              ) : (
                /* THE GRANT AND THE ONE ACTION WORTH AUDITING, ON ONE LINE. Person search had a
                   column of its own printing "—" on three rows of five; it is one of the six app
                   actions, so a column for it asked the same question the preset name already
                   answers — except for the one case an access review comes here for: who can turn
                   "somebody was here" into "this person was here". So it stays, as a mark beside
                   the preset, gated on the app door as well as the grant — an On badge on an
                   account that cannot reach a search box is the kind of confident wrong value this
                   console keeps producing. The grant itself is kept in the data when the door
                   shuts and comes back with it; this line just stops claiming it is live. */
                <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(u.grantMode === "preset" && u.presetId && presetLabelById.get(u.presetId)) || t.grantCustom}
                  </span>
                  {holdsSearch(u) && (
                    <span title={t.colAppSearch} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "999px", backgroundColor: "var(--info-100)", color: "var(--info-500)", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {t.colAppSearch}
                    </span>
                  )}
                </span>
              ))}
            </span>
            {/*
              HOW MUCH OF THE SITE THIS ACCOUNT SEES IN THE APP.
             
              A camera scope could be set from the row menu and then read back nowhere: the table
              gave no sign which accounts had been narrowed, so an access review had to open every
              row's menu one at a time. `전체` is the ordinary case and stays quiet; a narrowed
              account is the one worth finding, so it gets the darker, heavier treatment and the
              figures line up column-wise (tabular digits).
             
              Dashed where the app is shut, for the reason the Person Search cell gives: a scope
              describes what the app shows, and an account that cannot reach the app is not seeing
              twelve cameras. The grant is kept in the data and comes back with the door.
            */}
            <span>
              {!u.appAccess ? (
                <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
              ) : scopeCountFor(u) === null ? (
                <span title={t.camerasAllTitle} style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.camerasAll}</span>
              ) : (
                /*
                 * THE NUMBER, AND WHETHER IT WILL GROW BY ITSELF (owner's reference mockup,
                 * 2026-09-22: 「5대 허용」 with a 「2개 그룹」 mark beside it).
                 *
                 * `14 / 68` is the union of groups and individual cameras, and the one thing it
                 * cannot say is which kind it came from. That matters more than the figure: a
                 * scope built from groups takes in every camera added to those groups later, and
                 * a scope built from individual cameras never changes. An access review reading
                 * this column is looking for exactly that difference, and until now it existed
                 * only inside the hover text.
                 *
                 * On its own line rather than beside the figure. Measured at 1180: this column
                 * holds about 88px between 접근 and 마지막 로그인, and 「5 / 68」 plus 「그룹 2」
                 * needs more than that. The rows already stand two lines tall for the 사용자 and
                 * 접근 cells, so the second line here costs no height.
                 */
                <span style={{ display: "flex", flexDirection: "column", gap: "1px", alignItems: "flex-start" }}
                  title={`${t.camerasNarrowedTitle(scopeCountFor(u) ?? 0, scopableCamerasFor(u).length)}${groupNamesFor(u) ? ` · ${groupNamesFor(u)}` : ""}`}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontVariantNumeric: "tabular-nums" }}>
                    {t.camerasSome(scopeCountFor(u) ?? 0, scopableCamerasFor(u).length)}
                  </span>
                  {/* Only when a group is in it. A scope of individual cameras says nothing here,
                      which is the correct silence: nothing about it will move on its own. */}
                  {(u.cameraGroupIds ?? []).length > 0 && (
                    <span title={t.camerasFromGroupsTitle}
                      style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>
                      {t.camerasFromGroups((u.cameraGroupIds ?? []).length)}
                    </span>
                  )}
                </span>
              )}
            </span>
            <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{u.lastLoginAt ?? "—"}</span>
            {/* Two mail actions, because the two ways a person gets locked out need different
                messages: an invite that never arrived is resent, an account whose password is
                forgotten gets a reset. Resend only shows for users still sitting at "invited" —
                offering it for an active account would send a link that sets up an account which
                already exists. Both disappear entirely where there is no mail to send them with;
                that deployment recovers people through the temporary password below instead. */}
            {/* Every action in this menu grants or takes away a way in, so the whole menu is the
                owner's. A non-owner still sees the items with the reason attached — knowing the
                action exists and who can do it beats a menu that quietly has three fewer rows. */}
            {/* ONE DOOR, NOT NINE (owner, 2026-09-22: 점 세개 눌렀을때 너무 버튼이 많이 뜨는데).
                Measured before this change: nine items, 467px tall, bottom edge at 998px on a
                900px window — the menu opened partly off the screen — and three of the nine were
                disabled on this row. The same actions now live in the account card, which says
                what the account holds before offering to change it. */}
            <button className="portal-icon-btn" onClick={() => setManaging(u)} title={t.manageAccount}
              aria-label={t.manageAccount}
              style={{ justifySelf: "end", padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
              <MoreVertical size={16} strokeWidth={2} />
            </button>
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
              borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
            }}>
              {/* The second line is the employee number, not an address: a roster row often has no
                  address at all (that is the reason this path exists), and the number is what the
                  code is handed over against. */}
              <div style={{ minWidth: 0 }}>
                <p title={entry.name} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</p>
                <p title={entry.email || entry.employeeId} style={{ fontSize: "12px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.email || entry.employeeId}</p>
                {/* 「방금 발급」 SITS WITH THE NAME, not with the code. The reader is looking for a
                    person's row; the mark is how they find which one the dialog just acted on, and
                    the code cell beside it is already showing the difference by being unmasked. */}
                {justIssuedFor === entry.employeeId && (
                  <span style={{ display: "inline-block", marginTop: "3px", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)", backgroundColor: "var(--primary-50)", padding: "2px 6px", borderRadius: "999px" }}>
                    {rt.justIssued}
                  </span>
                )}
              </div>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                    {entry.permission === "admin" ? rt.admin : rt.operator}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <RosterCodeCell entry={entry} t={rt}
                      justIssued={justIssuedFor === entry.employeeId}
                      onIssue={mayEdit ? () => setIssuingEntry(entry) : undefined}
                      onReveal={() => logRosterCodeViewed(entry.employeeId)} />
                  </div>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <StageBadge stage={stage} t={t} />
              </div>
              {/* Gated, like the toolbar directly above this table. It was not, and issuing a
                  code is not a small thing to leave open: the code is a live credential that
                  /register turns into an account, so a read-only auditor could mint a way in. */}
              <RowActionsMenu actions={[
                { label: rt.editEntry, onClick: () => setRosterEditorFor({ entry }), disabled: !mayEdit, reason: readOnlyReason },
                /* REISSUE ONLY. Issuing a first code is on the row itself now (the 코드 column's
                   own button — see RosterCodeCell), so listing it here as well would be the same
                   action twice on one row. Reissue has no such home: those rows show a code, and
                   replacing a live one is rarer and more destructive than minting the first. */
                ...(entry.code ? [{
                  label: rt.reissueConfirm,
                  onClick: () => setIssuingEntry(entry),
                  disabled: !mayEdit,
                  reason: readOnlyReason,
                }] : []),
                { label: rt.remove, onClick: () => setRemovingEntry(entry), danger: true, disabled: !mayEdit, reason: readOnlyReason },
              ]} />
            </div>
          );
        })}
      </div>

      </>)}
      </div>
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
            /* The toast says it happened and then leaves; the row is what somebody reads the code
               off. Marking the row is what makes the code visible there (see RosterCodeCell's
               justIssued). */
            setJustIssuedFor(issuingEntry.employeeId);
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
      {/*
        ONE CARD FOR THE ACCOUNT, INSTEAD OF A NINE-ITEM MENU (owner, 2026-09-22: 맨 오른쪽 점
        세개 눌렀을때 너무 버튼이 많이 뜨는데 … 그냥 팝업띄워서 관리하는게 나을것같기두하고).

        Measured on Grace Tan's row: the menu had NINE items, stood 467px tall and its bottom edge
        was at 998px on a 900px window — it opened 98px off the screen — and three of the nine
        were disabled for that row. A menu is a list of verbs with no state in it, so the reader
        had to pick one to find out what the account currently holds.

        This says the state first and offers the change beside it: five rows that each name what
        the account holds now, and the account's own actions under a rule. Every guard and every
        refusal reason is the same one the menu carried — one array still, so a new action cannot
        be added to one and forgotten in the other.

        ONE DIALOG AT A TIME. Pressing a row closes this and opens that editor, rather than
        stacking a second sheet over it — ConfirmModal's own note calls a two-deep stack a place
        nobody wants to be, and the editors this opens are the same ones the menu opened.
      */}
      {managing && (() => {
        const mu = managing;
        const lastAdmin = isLastActiveAdmin(portalUsers, mu.id);
        const close = () => setManaging(null);
        /** Both groups from one list, so the guards cannot drift apart. `value` is what the
         *  account holds right now — the half a menu of verbs could not show. */
        /*
         * TWO GROUPS, BECAUSE THE FIVE ROWS ANSWER TWO QUESTIONS (owner, 2026-09-22: 직관적으로
         * 보고 이해하기 쉽게 그룹핑해줘야해).
         *
         * Flat, the card put 로그인 next to 앱 화면 and hid the causation between them: on a
         * Portal-only account the app rows are grey BECAUSE of the door two rows above, and
         * nothing on screen said so. Grouped, the door comes first and what it opens follows it —
         * the reader sees the cause before the consequence.
         *
         * 들어가는 곳 = which door, which sites. 할 수 있는 일 = the console role, and the app's
         * screens and cameras. The second name is the app's own words for it (see appGrants).
         */
        const rows: {
          key: string; group: "where" | "what"; label: string; value: string;
          disabled?: boolean; reason?: string; onClick: () => void;
        }[] = [
          {
            key: "role", group: "what",
            /* Not colPermission ("권한"): the section above is already called 권한, and the card
               printed the word twice in two lines. This row is the console role specifically —
               the same axis name the count line uses. */
            label: t.axisConsoleRole,
            value: canEnterPortal(mu.permission) ? roleLabel(t, mu.permission) : t.panelNoPortal,
            disabled: !manageAccess || lastAdmin || !canEnterPortal(mu.permission),
            reason: !manageAccess ? t.reasonNotOwner
              : lastAdmin ? t.lastAdminRoleFixed
              : !canEnterPortal(mu.permission) ? t.reasonNoPortal : undefined,
            onClick: () => { close(); setChangingRoleFor(mu); },
          },
          {
            key: "access", group: "where",
            /* The invite form asks it as a question ("어디로 로그인하나"); a card of current
               values states it as a thing. Same axis name as the count line again. */
            label: t.axisDoor,
            value: accessLabel(t, accessModeOf(mu)),
            disabled: !manageAccess,
            reason: manageAccess ? undefined : t.reasonNotOwner,
            onClick: () => { close(); setChangingAccessFor(mu); },
          },
          {
            key: "grants", group: "what",
            label: t.panelGrants,
            value: !mu.appAccess ? t.panelNoApp
              : lacksAppScreens(mu) ? t.grantsHeldNone
              : (mu.grantMode === "preset" && mu.presetId && presetLabelById.get(mu.presetId)) || t.grantCustom,
            disabled: !manageAccess || !mu.appAccess,
            reason: !manageAccess ? t.reasonNotOwner : !mu.appAccess ? t.reasonNoAppScreens : undefined,
            onClick: () => { close(); setChangingGrantsFor(mu); },
          },
          {
            key: "cameras", group: "what",
            label: t.colCameras,
            value: !mu.appAccess ? t.panelNoApp
              : scopeCountFor(mu) === null ? t.camerasAll
              : t.camerasSome(scopeCountFor(mu) ?? 0, scopableCamerasFor(mu).length),
            disabled: !manageAccess || !mu.appAccess || scopableCamerasFor(mu).length === 0,
            reason: !manageAccess ? t.reasonNotOwner
              : !mu.appAccess ? t.reasonNoScopeWithoutApp
              : scopableCamerasFor(mu).length === 0 ? t.reasonNoCamerasToScope : undefined,
            onClick: () => { close(); setScopingFor(mu); },
          },
          {
            key: "projects", group: "where",
            label: t.colProjects,
            value: t.panelProjectCount(mu.projectIds.length),
            disabled: !manageAccess,
            reason: manageAccess ? undefined : t.reasonNotOwner,
            onClick: () => { close(); setEditingProjectsFor(mu); },
          },
        ];
        return (
          /* A PANEL, like every other editor on this page (owner: 하나로 가능한한 통일하는게
             좋을것같아 오른쪽패널로). This card is where an account is read and changed, and the
             row it belongs to stays visible behind it. The name, the address and the status badge
             go in the panel's title — the badge is there for the reason it moved beside the name
             in the table: a suspended account makes everything below it hypothetical. */
          <Drawer
            title={
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mu.name}</span>
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mu.email}</span>
                </span>
                <StatusBadge status={mu.status} />
              </span>
            }
            onClose={close}
          >
              <div style={{ padding: "16px 20px 6px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {([["where", t.panelWhereSection], ["what", t.panelWhatSection]] as const).map(([group, heading]) => (
                <div key={group}>
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)", marginBottom: "8px" }}>{heading}</p>
                <div style={{ border: BORDER, borderRadius: "10px", overflow: "hidden" }}>
                  {rows.filter(r => r.group === group).map((row, i) => {
                    const style: React.CSSProperties = {
                      width: "100%", display: "flex", alignItems: "center", gap: "8px", textAlign: "left",
                      padding: "11px 12px", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--gray-200)",
                      backgroundColor: "white", fontFamily: "inherit",
                    };
                    const label = (
                      <>
                        <span style={{ flexShrink: 0, fontSize: "12px", fontWeight: 700, color: row.disabled ? "var(--gray-400)" : "var(--gray-600)" }}>{row.label}</span>
                        {/*
                          WHY IT CANNOT BE OPENED, BEHIND A MARK (owner, 2026-09-22: 이것도 뭔가
                          어색해 단어옆에 물음표같은아이콘에 숨겨줘).
                          
                          The reasons were printed under the list as "앱 화면 — 앱 접근이 없는
                          계정입니다 — 지정하거나 검색할 화면이 없습니다." — the row's name, then
                          a dash, then a sentence that already had a dash in it, for every refused
                          row. Two lines of grey explaining what two greyed rows had already said.
                          
                          Our own Tooltip, not the browser's `title`: a disabled control gets no
                          hover events in some browsers and none at all on touch, which is why the
                          mark sits OUTSIDE the button — a refused row is not a control anyway, so
                          it is drawn as a value with a question beside it.
                        */}
                        {row.disabled && row.reason && (
                          <Tooltip text={row.reason}>
                            <span style={{ flexShrink: 0, display: "flex", color: "var(--gray-300)", cursor: "help" }}>
                              <CircleHelp size={13} strokeWidth={2.2} />
                            </span>
                          </Tooltip>
                        )}
                      </>
                    );
                    const value = (
                      <span style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: "12px", color: row.disabled ? "var(--gray-400)" : "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                    );
                    if (row.disabled) return <div key={row.key} style={style}>{label}{value}</div>;
                    return (
                      <button key={row.key} type="button" onClick={row.onClick} style={{ ...style, cursor: "pointer" }}>
                        {label}
                        {value}
                        {/* No chevron on a row that cannot be opened — an arrow that leads nowhere
                            is the control this console keeps being asked to stop drawing. */}
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                          <path d="M3 1.5L7 5l-4 3.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    );
                  })}
                </div>
                </div>
                ))}
              </div>

              <div style={{ padding: "14px 20px 20px" }}>
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)", marginBottom: "8px" }}>{t.panelAccountSection}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    /* The two mail-less ways back in, kept apart for the reason the menu gave: a
                       person who never arrived needs the invitation again, a person who is locked
                       out needs a credential. */
                    ...(mu.status === "invited" ? [{
                      key: "resend", label: t.resendInvite,
                      disabled: !manageAccess, reason: manageAccess ? undefined : t.reasonNotOwner,
                      /* A reissue, not a resend: the previous link stops working the moment this
                         mints a new one. The link goes on a panel rather than in a toast —
                         nothing posts it anywhere, so it is the whole result and has to survive
                         longer than five seconds. Verbatim from the menu this replaced. */
                      onClick: () => {
                        const token = issueInviteToken(mu.id);
                        if (!token) return;
                        close();
                        setInvitePanel({ title: t.inviteLinkRemadeTitle, links: [{ name: mu.name, email: mu.email, url: `/password-setup?token=${token}` }] });
                      },
                    }] : []),
                    {
                      key: "credential", label: t.resetPassword,
                      disabled: !manageAccess, reason: manageAccess ? undefined : t.reasonNotOwner,
                      onClick: () => { close(); setCredentialFor(mu); },
                    },
                    ...(mu.setupCode ? [{
                      key: "code", label: t.viewSetupCode,
                      disabled: !manageAccess, reason: manageAccess ? undefined : t.reasonNotOwner,
                      onClick: () => { close(); setViewingCodeFor(mu); },
                    }] : []),
                    {
                      key: "search", label: holdsSearch(mu) ? t.appSearchRevoke : t.appSearchGrant,
                      disabled: !manageAccess || (!holdsSearch(mu) && !mu.appAccess),
                      reason: !manageAccess ? t.reasonNotOwner : (!holdsSearch(mu) && !mu.appAccess) ? t.reasonNoApp : undefined,
                      /* Confirmed, and deliberately NOT danger — red means what cannot be undone,
                         and blocking person search deletes nothing; this same button flips back.
                         Verbatim from the menu, toast and all. */
                      onClick: () => {
                        const next = !holdsSearch(mu);
                        close();
                        setConfirming({
                          title: next ? t.confirmSearchGrantTitle(mu.name) : t.confirmSearchRevokeTitle(mu.name),
                          body: next ? t.confirmSearchGrantBody : t.confirmSearchRevokeBody,
                          confirmLabel: next ? t.appSearchGrant : t.appSearchRevoke,
                          onConfirm: () => {
                            setAppSearch(mu.id, next);
                            showToast({ variant: next ? "success" : "warning", title: next ? t.appSearchToastOn : t.appSearchToastOff, desc: t.appSearchToastDesc(mu.name) });
                          },
                        });
                      },
                    },
                  ].map(a => (
                    <button key={a.key} type="button" onClick={a.disabled ? undefined : a.onClick} disabled={a.disabled}
                      title={a.disabled ? a.reason : undefined}
                      style={{
                        height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                        backgroundColor: "white", color: a.disabled ? "var(--gray-300)" : "var(--gray-700)",
                        fontSize: "12px", fontWeight: 700, cursor: a.disabled ? "default" : "pointer", fontFamily: "inherit",
                      }}>
                      {a.label}
                    </button>
                  ))}
                </div>
                {/* THE TWO THAT TAKE ACCESS AWAY GET THEIR OWN NAME (owner, 2026-09-22: 마지막에
                    버튼 두개도 계정상태관리 뭐 이런걸로 안에 넣어줘).
                    
                    They were the last two entries of a nine-item menu, one keystroke from 인물
                    검색 차단. A rule above them said "these are different" without saying how;
                    a heading says which two they are — the ones that change whether the account
                    works at all, as opposed to the ones that help somebody back in. Same heading
                    style as the groups above, so the card reads as four named parts. */}
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)", margin: "16px 0 8px" }}>{t.panelStatusSection}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <button type="button"
                    disabled={!manageAccess || (mu.status !== "suspended" && lastAdmin)}
                    title={!manageAccess ? t.reasonNotOwner : (mu.status !== "suspended" && lastAdmin) ? t.lastAdminReason : undefined}
                    onClick={() => {
                      const suspended = mu.status === "suspended";
                      close();
                      /* Verbatim from the menu, including what is NOT red: suspending is
                         reversible — 재활성화 takes this very button afterwards — and 제거 beside
                         it is not. Colouring both would make red mean "the bottom two" instead of
                         "think", and the one that cannot be undone would lose its warning. */
                      setConfirming(suspended ? {
                        title: t.confirmReactivateTitle(mu.name),
                        body: t.confirmReactivateBody,
                        confirmLabel: t.reactivateUser,
                        onConfirm: () => {
                          updatePortalUserStatus(mu.id, "active");
                          showToast({ variant: "success", title: t.userReactivatedTitle, desc: mu.name });
                        },
                      } : {
                        title: t.confirmSuspendTitle(mu.name),
                        body: t.confirmSuspendBody,
                        confirmLabel: t.suspendUser,
                        onConfirm: () => {
                          updatePortalUserStatus(mu.id, "suspended");
                          showToast({ variant: "warning", title: t.userSuspendedTitle, desc: t.userSuspendedDesc(mu.name) });
                        },
                      });
                    }}
                    style={{
                      height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                      backgroundColor: "white", color: (!manageAccess || (mu.status !== "suspended" && lastAdmin)) ? "var(--gray-300)" : "var(--gray-700)",
                      fontSize: "12px", fontWeight: 700, cursor: (!manageAccess || (mu.status !== "suspended" && lastAdmin)) ? "default" : "pointer", fontFamily: "inherit",
                    }}>
                    {mu.status === "suspended" ? t.reactivateUser : t.suspendUser}
                  </button>
                  <button type="button"
                    disabled={!manageAccess || lastAdmin}
                    title={lastAdmin ? t.lastAdminReason : manageAccess ? undefined : t.reasonNotOwner}
                    onClick={() => {
                      close();
                      setConfirming({
                        title: t.confirmRemoveTitle(mu.name),
                        body: t.confirmRemoveBody,
                        confirmLabel: t.removeUser,
                        danger: true,
                        onConfirm: () => removePortalUser(mu.id),
                      });
                    }}
                    style={{
                      height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: "1px solid var(--danger-100)",
                      backgroundColor: "white", color: (!manageAccess || lastAdmin) ? "var(--gray-300)" : "var(--danger-500)",
                      fontSize: "12px", fontWeight: 700, cursor: (!manageAccess || lastAdmin) ? "default" : "pointer", fontFamily: "inherit",
                    }}>
                    {t.removeUser}
                  </button>
                </div>
              </div>
          </Drawer>
        );
      })()}
      {editingProjectsFor && (
        <UserProjectsModal
          user={editingProjectsFor}
          teamProjects={teamProjects}
          onClose={() => setEditingProjectsFor(null)}
          onSave={ids => {
            updatePortalUserProjects(editingProjectsFor.id, ids);
            showToast({ variant: "success", title: t.projectsUpdatedTitle, desc: editingProjectsFor.name });
          }}
        />
      )}
      {changingRoleFor && (
        <AccessChangeModal
          title={t.confirmRoleTitle(changingRoleFor.name)}
          body={t.confirmRoleBody}
          options={consoleRoleOptions(t)}
          current={changingRoleFor.permission}
          onApply={v => updatePortalUserPermission(changingRoleFor.id, v as PortalPermission)}
          onClose={() => setChangingRoleFor(null)}
        />
      )}
      {changingGrantsFor && (
        <AppGrantModal user={changingGrantsFor} onClose={() => setChangingGrantsFor(null)} />
      )}
      {scopingFor && (
        <CameraScopePicker
          user={scopingFor}
          cameras={scopableCamerasFor(scopingFor)}
          onClose={() => setScopingFor(null)}
        />
      )}
      {changingAccessFor && (
        <AccessChangeModal
          title={t.confirmAccessTitle(changingAccessFor.name)}
          body={t.confirmAccessBody}
          /* App-only would strip Portal from the last owner, which the store refuses on the same
             guard — so it is not offered rather than offered and ignored. Portal-only stays:
             taking the app away from an owner locks nobody out. */
          options={isLastActiveAdmin(portalUsers, changingAccessFor.id)
            ? accessOptions(t).filter(o => o.value !== "appOnly")
            : accessOptions(t)}
          current={accessModeOf(changingAccessFor)}
          onApply={v => {
            const next = applyAccessMode(v as AccessMode, changingAccessFor.permission);
            updatePortalUserAccess(changingAccessFor.id, next.permission, next.appAccess);
            // Say it when the change quietly hands out a Portal role nobody picked.
            if (!canEnterPortal(changingAccessFor.permission) && canEnterPortal(next.permission)) {
              showToast({ variant: "info", title: accessLabel(t, v as AccessMode), desc: t.accessGainsRoleNote(roleLabel(t, next.permission)) });
            }
          }}
          onClose={() => setChangingAccessFor(null)}
        />
      )}
      {invitePanel && (
        <InviteLinkPanel title={invitePanel.title} links={invitePanel.links} onClose={() => setInvitePanel(null)} />
      )}
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
