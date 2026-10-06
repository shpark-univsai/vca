"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Asterisk, ChevronRight, CircleHelp, Eye, KeyRound, Link2, MailQuestion, MonitorOff, Trash2, UserCheck, UserMinus, UserSearch, UserX, Users2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, isNetworkIsolated, isLastActiveAdmin, canManageAccess, canEditPortal, canEnterPortal, currentPortalRole, currentPortalUser, resolveMailConfig, isMailDeliverable, presetsForTeam, grantsOfPreset, presetLabel, scopedCameraIds, cameraGroupsInProject, withAppActionDeps, APP_ACTIONS, type AccessPreset, type AppAction, type Camera, type GrantMode, type PortalPermission, type PortalUser, type PortalUserStatus } from "@/lib/vcaStore";
import CameraMapView from "./CameraMapView";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { RESET_CODE_TTL_MIN, TEMP_PASSWORD_VALIDITY_HOURS } from "@/lib/password";
import { SETUP_CODE_TTL_DAYS, codeDaysRemaining, formatCode } from "@/lib/staffRoster";
import { getAuthConfig, hasOutboundMail } from "@/lib/authConfig";
import { useToast } from "../Toast";
import { FormLabel, SummaryStrip, TABLE_HEADER_COLOR, TextField, FIELD_STYLE, BORDER, CARD_BORDER, CARD_RADIUS, TABLE_RULE, CONTROL_HEIGHT, TABLE_COLUMN_GAP, TOOLBAR_GAP, SearchInput, TableEmpty, TableSkeleton, TableLoadFailed, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, ConfirmModal, Drawer, Tooltip, usePortalEditAccess, AppGrantList, useGrantNames, presetSummary, StatusBadge, type StatusTone, RequiredMark, PanelCancel, PanelPrimary, PICKED_LINE, PICKED_FILL, ActiveFilterCount } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";
import CameraGroupsTab from "./CameraGroupsTab";
import AccessPresetsTab from "./AccessPresetsTab";
import { withEffectiveStatus, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import RosterImportModal from "./RosterImportModal";
import CameraScopePicker from "./CameraScopePicker";
import {
  ROSTER_T, RosterCodeCell, IssueConfirmModal, RemoveConfirmModal, PrintSheet, type RosterTranslations,
  exportRosterCsv,
} from "./ProjectRosterTab";

const T = {
  en: {
    // Page header
    inviteUser: "Invite user",
    inviteNoMail: "No mail server on this site, so an invitation cannot be delivered. Set one up in Settings › Mail, or hand over a registration code instead.",
    searchPlaceholder: "Search by user name or email address",
    rosterSearchPlaceholder: "Search by name or employee number",
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
    /* The name of the thing, over the button that flips it — see the 권한 group. */
    axisSearch: "Person search",
    countOwners: "Owners",
    countAdmins: "Admins",
    countAuditors: "Read-only",
    countAppOnly: "App only",
    whatRolesMean: "What the roles mean",
    guideTitle: "Access and roles",
    guideLead: "Access decides which doors an account has. The role decides what it may do once inside Portal.",
    guideRolesHeading: "Portal roles — where they differ",
    guideRowGrant: "Users and granting access",
    guideRowSettings: "Cameras, VIP, roster, licence, server",
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
    peopleTabRoster: "Awaiting sign-up",
    // On the tabs themselves. The Accounts one answers the thing this table is most often read
    // wrongly for: an invited account is already here, before anybody has signed in with it.
    peopleTabAccountsHint: "Accounts that can reach this project — including people who have been invited and have not signed in yet.",
    /* THE LADDER, SAID ONCE (owner, 2026-09-23: 명부 대기랑 계정이랑 두 가지 차이를 바로 보고
       모를 수 있을 것 같아). This is the one fact neither list can show: that the rows here BECOME
       accounts. Both hint strings existed and neither was ever rendered, so the tab carried no
       explanation at all. */
    peopleTabRosterHint: "No account yet. Hand over a registration code — signing up with it creates the account.",
    peopleTabPresets: "App presets",
    peopleTabGroups: "Camera groups",
    colPlannedPermission: "Permission on signup",
    /* A roster row that carries no app grants — see the cell that prints it. */
    plannedNoGrants: "No permissions",
    colCode: "Registration code",
    countRosterWaiting: "Awaiting sign-up",
    stageRosterListed: "Written down",
    stageCodeIssued: "Issued",
    stageCodeExpired: "Expired",
    // Roster tools, moved here with the rows they act on.
    addToRoster: "Add with a code",
    addPerson: "Add a user",
    addPersonMail: "Invite by mail",
    addPersonMailWhy: "Sends an invitation to their address.",
    addPersonCode: "Add with a registration code",
    addPersonCodeWhy: "For somebody with no address — you hand the code over on paper.",
    importRoster: "Import CSV",
    bulkIssue: (n: number) => `Issue ${n} code${n === 1 ? "" : "s"}`,
    printHandout: "Print code slips",
    exportRoster: "Export CSV",
    nothingToExport: "Nobody is awaiting sign-up, so there is nothing to export yet.",
    nothingToPrint: "No unused codes to print. A slip is printed once, for a code nobody has redeemed.",
    toastRosterExported: (n: number) => `${n} roster row(s) exported`,
    rosterEmpty: "Nobody is awaiting sign-up.",
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
    /*
     * THE NUMBER THIS BAR NAMES IS THE NUMBER IT ACTS ON (2026-09-30).
     *
     * It printed bulkSuspendTargets.length — how many of the shown accounts COULD be suspended —
     * under the words "accounts shown". Searching "smartcity" put five rows on screen and the bar
     * said 「표시된 계정 3개」: one row was already suspended and one was the last owner, and
     * neither is shown-ness. A reader who trusts the bar is off by two before they press anything,
     * and the button beside it said "Suspend all shown", which was the same claim again.
     *
     * Both numbers, whenever they differ, and the button carries the one it will actually do.
     * The line beside this one still says WHY somebody was left out; this one only has to be
     * arithmetic the reader can check against the rows in front of them.
     */
    bulkSuspendBar: (n: number, shown: number) => n === shown
      ? (shown === 1 ? "1 account shown" : `${shown} accounts shown`)
      : `${n} of the ${shown} shown can be suspended`,
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
    colAppSearch: "Person search",
    colCameras: "Cameras",
    camerasAll: "All",
    camerasSome: (n: number, total: number) => `${n} / ${total}`,
    /* Which groups put them there. The same sentence /mypage shows the account holder about
       themselves, now on the console side too — see the row's own note. */
    camerasVia: (names: string) => `Through ${names}`,
    camerasFromGroups: (n: number) => `${n} group${n === 1 ? "" : "s"}`,
    camerasFromGroupsTitle: "Part of this scope comes from camera groups, so it grows when a group does. Individually picked cameras do not.",
    camerasNarrowedTitle: (n: number, total: number) => `Sees ${n} of the ${total} cameras on their projects, in the app.`,
    camerasAllTitle: "Sees every camera on their projects, including ones added later.",
    colLastLogin: "Last login",
    colStatus: "Status",
    emptyNoUsers: "No users have access to this project yet.",
    loadFailed: "Could not load this list.",
    retry: "Try again",
    emptyFiltered: "Nothing matches the current filter.",

    // Permission / status / MFA display labels
    permOwner: "Owner",
    permAdmin: "Admin",
    permAuditor: "Read-only admin",
    permNone: "No Portal access",
    permOwnerDesc: "Grants and revokes access, and removes people. The only role that can.",
    permAdminDesc: "Changes cameras, VIP registry, roster and licence — but not who has access.",
    permAuditorDesc: "Sees every Portal screen and the audit log. Changes nothing.",
    permNoneDesc: "Does not open Portal at all.",
    // Access — where the person may sign in. Independent of the Portal role above: a role says what
    // they may do once inside Portal, this says whether Portal is one of the doors they have.
    accessBoth: "Portal + app",
    accessAppOnly: "App only",
    accessPortalOnly: "Portal only",
    accessBothDesc: "Both the settings console and the monitoring app.",
    accessAppOnlyDesc: "Signs straight into the monitoring app. No Portal.",
    accessPortalOnlyDesc: "Settings console only — no monitoring app.",
    accessGainsRoleNote: (role: string) => `Given the ${role} role, which changes nothing until you raise it.`,
    reasonNoApp: "This account has no app access — there are no screens to grant or to search on.",
    reasonNoPortal: "This account does not open Portal — change where they sign in first.",
    manageAccount: "Manage account",
    panelWhereSection: "Access",
    panelWhatSection: "Permissions",
    /* Was "Password". The block holds the login address as well now, and a caption naming only
       one of the two would hide the other under it. */
    panelAccountSection: "Sign-in",
    panelStatusSection: "Account",
    /* The row above says HOW MANY; this says WHICH. One without the other is either a number
       nobody can act on or a picture nobody can total. */
    panelScopeMapSection: "Cameras they can see",
    scopeMapVia: (names: string) => `Through ${names}`,
    scopeMapPicked: "Picked for this account on its own",
    scopeMapAnd: " and ",
    scopeMapNotVisible: "Not visible to this account",
    /*
     * THE ONE FACT THAT MAKES THE REST OF THE CARD HYPOTHETICAL, AT THE TOP OF IT.
     *
     * The badge beside the name already says 정지됨, and it was not enough: the card goes on to
     * offer 비밀번호 재설정, 인물 검색 허용 and 앱 권한 변경, all live, all reading as ordinary
     * work — so an owner could mint a temporary password, read it down the phone, and neither
     * they nor the person on the other end would find out until the sign-in was refused. A badge
     * names a state; this names the CONSEQUENCE, above everything the consequence applies to.
     *
     * It says what is kept as well as what is blocked, because the permissions below really are
     * stored and really do come back with 재활성화 — "nothing works" would be the other kind of
     * lie.
     */
    suspendedPanelTitle: "This account cannot sign in",
    suspendedPanelBody: "It is suspended. Permissions set here are kept and come back with the account, but no password and no setup code will let it in until it is reactivated — the button is at the bottom of this card.",
    /* On the two ways back in, which are the ones that would otherwise hand over a credential
       that cannot work. Not on 이메일 변경: correcting an address is real work on a closed
       account, and it is not a way in. */
    reasonSuspended: "The account is suspended, so a new credential could not be used. Reactivate it first — the button is at the bottom of this card.",
    changeEmail: "Change email address",
    emailPanelTitle: "Change email address",
    emailPanelCurrent: "Current address",
    emailPanelNew: "New address",
    /* Three paragraphs of policy stood here, then three short lines, then one (owner, 2026-10-06:
       설명이 너무 길어 → 이게 꼭 필요한 설명인가). The survivor is the only sentence that changes
       what the reader does next. */
    emailPanelNoVerify: "No confirmation can be sent from here, so it applies at once.",
    emailPanelPending: "The new address has to answer first. Until it does, this account signs in with the current one.",
    emailPanelRepeat: "New address again",
    emailPanelMismatch: "The two do not match.",
    emailPanelSend: "Send confirmation",
    emailSentToast: "Confirmation sent",
    emailSentToastDesc: (name: string, email: string) => `${name}'s address changes once ${email} answers.`,
    emailPendingLabel: "Waiting on a new address",
    emailPendingCancel: "Call it off",
    emailPendingCancelled: "Change called off",
    emailPanelApply: "Change address",
    emailPanelDuplicate: "Another account already uses that address.",
    emailPanelSame: "That is the address the account already has.",
    emailPanelInvalid: "That is not an email address.",
    emailPanelUndeliverable: (domain: string) => `Accounts live on @${domain}. Mail to anything else is refused.`,
    emailChangedToast: "Email address changed",
    emailChangedToastDesc: (name: string, addr: string) => `${name} signs in as ${addr} from now on.`,
    panelGrants: "App permissions",
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
    reasonNoAppScreens: "This account has no app access — there are no permissions to grant or to search on.",
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
    tempForLabel: "Recipient",
    // Not "is sent" — nothing leaves the building yet (see the HANDOFF note in `generate`), and
    // the toast that follows already says so. The console asks the relay; the relay delivers.
    mailConsequenceSend: (email: string) => `A reset code is requested for ${email}. You never see it.`,
    mailConsequenceUserSets: "They set their own password with it, so nobody else knows what they choose.",
    mailConsequenceTtl: (min: number) => `The code stops working after ${min} minutes.`,
    mailConsequenceInvalidates: "Any reset code already on its way to them stops working.",
    tempConsequenceInvalidate: "Their current password stops working the moment you generate this.",
    tempConsequenceOnce: "The new password is shown once, on the next screen. It is never stored and cannot be looked up again.",
    tempConsequenceMustChange: "They must set a password of their own the first time they sign in with it.",
    tempConsequenceExpiry: (hours: number) => `It stops working after ${hours} hours, used or not.`,
    tempConsequenceExpiryDays: (days: number) => `It stops working after ${days} days, used or not.`,
    tempGenerate: "Generate",

    // Temporary password modal — result step
    tempResultTitle: "Temporary password",
    tempResultFor: (name: string) => `For ${name}`,
    tempShownOnce: "This is the only time it is shown. Close this box and it is gone.",
    tempCopy: "Copy",
    tempCopied: "Copied",
    tempHandoverTitle: "Handover",
    tempHandover: "Read it out on the internal line, or hand it over in person or on internal messenger.",
    resetPassword: "Reset password",
    sendCode: "Request code",
    deliveryQuestion: "How will you reach them?",
    deliveryMailTitle: "Send it by email",
    deliveryMailHow: "To their own mailbox",
    deliveryMailResult: "They get a code and set their own password. You see nothing.",
    deliveryMailUnavailable: "No mail server on this site, so nothing can be sent. Set one up in Settings › Mail, or use a path below.",
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
    setupHandoverTitle: "Handover",
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
    bulkResultTitle: "Not everything was changed",
    bulkResultBody: (done: number, left: number) => `${done} changed. ${left} left as ${left === 1 ? "it was" : "they were"}:`,
    bulkRefusedLastAdmin: "The last administrator who can still sign in to Portal. Suspending them would lock everyone out of access management.",
    bulkRefusedAlready: "Already suspended, or no longer on this project.",
    tempDone: "Done",
    /* The default this account is holding, said on the button that takes it. See InviteLinkPanel. */
    inviteDoneAll: "Finish \u2014 all cameras",

    // Recovery-mode notice (deployment with no outbound mail)
    recoveryNoticeTitle: "Self-service password reset is off for this installation",
    recoveryNoticeBody: "There is no outbound mail here, so no reset code can be sent to anyone. A locked-out user calls the contact below, and an administrator hands them a way back in from the row actions — a temporary password read out on the line, or a setup code on paper.",
    recoveryNoticeContactLabel: "Who to contact",
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
    scopeHeldAll: (n: number) => `Every camera on their projects — ${n} today, and any added later.`,
    scopeHeldSome: (n: number, total: number) => `${n} of ${total} cameras.`,
    /* The same fact as scopeHeldAll, on the form, plus where it gets answered. One line, not a
       block: the invite panel is 531px of form and this is the only thing it was not saying. */
    inviteScopeStart: (n: number) => `Every camera on their projects — ${n} today, and any added later. You can narrow it in the next step.`,
    /* Names the GROUP too (owner, 2026-09-28: 카메라 그룹 만들고, 만든걸 활용해야하는뎅 지금
       계정 초대에는 그게 없는것같은뎅?). The picker behind this button has led with camera groups
       since it was built, and an account's scope can be nothing but groups — but this button, the
       only door to it on the invite step, said only "cameras". Somebody who had just built a group
       had no reason to think this was where it gets used. */
    scopePick: "Choose groups or cameras",
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
    /* Said BEFORE the save, because afterwards nothing on this page says it: a scope resolves
       through the register when it is read, so a group left behind on another site is not an
       error anywhere — the account simply opens nothing. The save still goes through; see the
       note at the render. */
    projectsZeroCameras: ({ name, groupCount, from, to }: { name: string; groups: string; groupCount: number; from: string; to: string }) =>
      `Saving leaves ${name} with no cameras — the group${groupCount === 1 ? "" : "s"} they hold belong${groupCount === 1 ? "s" : ""} to ${from} and reach${groupCount === 1 ? "es" : ""} nothing on ${to}.`,
    /* The other cause, in its own words. Says 「picked one by one」 so the reader knows where to go
       to undo it — the scope picker, not the group tab. */
    projectsZeroCamerasPicked: ({ name, count, from, to }: { name: string; count: number; from: string; to: string }) =>
      `Saving leaves ${name} with no cameras — ${count === 1 ? "the camera" : `all ${count} cameras`} picked for this account ${count === 1 ? "is" : "are"} on ${from}, and none are on ${to}.`,
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
    accessRequestsTitle: (count: number) => `Access requests (${count})`,
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
    /* THE DOOR UNDER THE ROW OF NAMES, and the line it sits on. Square puts "Edit permission set"
       directly under its preset card rather than beside the field label — the door belongs against
       the thing it opens, not against the required star. */
    grantDetails: "Details",
    grantActionCount: (n: number) => `${n} actions`,
    grantNothingPicked: "Nothing picked",
    /* The nested editor commits to a draft of an account that does not exist yet, so "Change"
       would be a lie about something that has nothing to change. */
    grantApply: "Apply",
    grantBack: "Back",
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
    grantsHeldNone: "No app permissions",
    fixGrants: "Choose permissions",
    countNoScreens: "No app permissions",
    // "Once nothing else stops them" earns its clause: the gate tests suspended and invited first,
    // so this is the refusal waiting behind those, not necessarily the one they meet today.
    /* THE APP'S OWN SENTENCE IS QUOTED, NOT REWORDED. Everything on this page calls these
       things permissions now, but the words in the quotation marks are what AccessGate actually
       prints at sign-in — change them here and the screen would be describing a message nobody
       receives. */
    noScreensHint: "The app is one of their doors and not one permission is granted, so there is nothing for them to open. Once nothing else stops them, sign-in turns them away with \"no screens have been assigned to this account\" — set the permissions here and it clears.",
    grantsSavedTitle: "App permissions updated",
    grantsSavedDesc: (name: string) => `${name}'s grants take effect the next time they open the app.`,
    grantsPortalOnly: "A Portal-only account has no app permissions to grant.",
  },
  ko: {
    // Page header
    inviteUser: "사용자 초대",
    inviteNoMail: "이 현장에는 메일 서버가 없어 초대장이 전달되지 않습니다. 설정 > 메일에서 설정하거나, 등록 코드를 직접 건네주세요.",
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
    /* 「Portal 역할」, not 「포털 역할」 — the console says it the first way in seven other places
       (the row menu, the confirm, the guide, permNone) and this was the only 포털. */
    axisConsoleRole: "Portal 역할",
    axisDoor: "로그인",
    axisSearch: "인물 검색",
    countOwners: "최고관리자",
    countAdmins: "관리자",
    countAuditors: "읽기 전용",
    countAppOnly: "앱 전용",
    whatRolesMean: "권한 안내",
    guideTitle: "접근과 역할",
    guideLead: "접근은 계정에 열리는 문을 정하고, 역할은 Portal 안에서 할 수 있는 일을 정합니다.",
    guideRolesHeading: "Portal 역할 — 서로 다른 것만",
    guideRowGrant: "사용자 · 권한 부여",
    guideRowSettings: "카메라 · VIP · 가입 대기 · 라이선스 · 서버",
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
    peopleTabRoster: "가입 대기",
    peopleTabAccountsHint: "이 프로젝트에 닿을 수 있는 계정입니다 — 초대만 받고 아직 로그인하지 않은 사람도 포함합니다.",
    peopleTabRosterHint: "아직 계정이 없는 사람입니다. 등록 코드를 건네주고, 그 코드로 가입하면 계정이 됩니다.",
    peopleTabPresets: "앱 권한 프리셋",
    peopleTabGroups: "카메라 그룹",
    colPlannedPermission: "가입 시 권한",
    plannedNoGrants: "권한 없음",
    colCode: "등록 코드",
    countRosterWaiting: "가입 대기",
    stageRosterListed: "적어둠",
    stageCodeIssued: "발급됨",
    stageCodeExpired: "만료됨",
    addToRoster: "등록 코드로 추가",
    addPerson: "사용자 추가",
    addPersonMail: "메일로 초대",
    addPersonMailWhy: "그 주소로 초대장을 보냅니다.",
    addPersonCode: "등록 코드로 추가",
    addPersonCodeWhy: "메일 주소가 없는 사람 — 코드를 종이로 건네줍니다.",
    importRoster: "CSV 가져오기",
    bulkIssue: (n: number) => `코드 ${n}개 발급`,
    printHandout: "코드 슬립 인쇄",
    exportRoster: "CSV 내보내기",
    nothingToExport: "등록을 기다리는 사람이 없어 내보낼 것이 없습니다.",
    nothingToPrint: "인쇄할 미사용 코드가 없습니다. 슬립은 아직 아무도 쓰지 않은 코드에 대해 한 번 찍습니다.",
    toastRosterExported: (n: number) => `명부 ${n}개 행을 내보냈습니다`,
    rosterEmpty: "등록을 기다리는 사람이 없습니다.",
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
    /* 영어 쪽 주석 참고 — 「표시된 계정 3개」가 다섯 줄 위에 떠 있던 건이다. */
    bulkSuspendBar: (n: number, shown: number) => n === shown
      ? `표시된 계정 ${shown}개`
      : `표시된 ${shown}개 중 ${n}개를 정지할 수 있습니다`,
    bulkSuspendKept: (n: number) => `${n}개는 활성으로 남습니다 — 마지막 관리자와 본인 계정은 여기서 정지할 수 없습니다.`,
    bulkSuspendedToast: (n: number) => `계정 ${n}개를 정지했습니다`,
    dormantHint: "90일 넘게 로그인하지 않은 활성 계정입니다. 인력이 도는 현장에서 아무도 닫는 것을 기억하지 못하는 계정이 이것입니다.",

    // Toolbar filters

    // Table
    colUser: "사용자",
    colOtherProjects: "다른 프로젝트",
    alsoOn: (where: string) => `이곳에도 있음: ${where}`,
    colProjects: "프로젝트",
    projectsCount: (n: number) => `${n}`,
    projectsOnlyThis: "이 프로젝트만",
    otherProjectsNone: "이 프로젝트만",
    colPermission: "권한",
    colAccess: "접근",
    colAppSearch: "인물 검색",
    colCameras: "카메라",
    camerasAll: "전체",
    camerasSome: (n: number, total: number) => `${n} / ${total}`,
    camerasVia: (names: string) => `${names} 그룹으로`,
    camerasFromGroups: (n: number) => `그룹 ${n}`,
    camerasFromGroupsTitle: "이 범위의 일부가 카메라 그룹에서 나옵니다. 그룹이 커지면 이 범위도 같이 커집니다. 개별로 고른 카메라는 그렇지 않습니다.",
    camerasNarrowedTitle: (n: number, total: number) => `앱에서 담당 프로젝트 카메라 ${total}대 중 ${n}대만 봅니다.`,
    camerasAllTitle: "담당 프로젝트의 카메라를 전부 봅니다. 나중에 추가되는 것도 포함합니다.",
    colLastLogin: "마지막 로그인",
    colStatus: "상태",
    emptyNoUsers: "이 프로젝트에 접근 권한이 있는 사용자가 아직 없습니다.",
    loadFailed: "목록을 불러오지 못했습니다.",
    retry: "다시 시도",
    emptyFiltered: "지금 조건에 맞는 항목이 없습니다.",

    // Permission / status / MFA display labels
    permOwner: "최고관리자",
    permAdmin: "관리자",
    permAuditor: "읽기 전용 관리자",
    permNone: "Portal 역할 없음",
    permOwnerDesc: "권한을 주고 회수하고, 사람을 지웁니다. 이걸 할 수 있는 유일한 역할입니다.",
    permAdminDesc: "카메라·VIP 등록·가입 대기·라이선스를 바꿉니다. 누가 접근하는지는 못 바꿉니다.",
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
    /* THE WORDS THE REST OF THE CONSOLE ALREADY USES (owner, 2026-09-28: 들어가는 곳, 할 수
       있는 일, 다시 들어가게 하기 — 이 단어들이 어색해 보여, 다른 화면들에서 쓰이는 것들 보고
       맞춰줘 직관적이고 쉽게).

       They were descriptions of a category rather than names of one, and none of the three
       appeared anywhere else. The replacements are lifted from screens this reader has already
       used: 「접근」 is what the 등록 코드 panel's own buttons say (접근: 앱만 / 접근: Portal + 앱),
       「권한」 is the invite form's field and the accounts table's column heading, and the third
       section is now named after the two things in it rather than after the reason for using them
       — which is also why 인물 검색 차단 left it (see the 권한 group below). */
    panelWhereSection: "접근",
    panelWhatSection: "권한",
    /*
     * 「로그인」이 한 화면에 두 번 나오던 것 (2026-09-30).
     *
     * 접근 그룹의 첫 줄이 「로그인 · 앱만」(axisDoor, 어느 문으로 들어오나)이고, 이 캡션도
     * 「로그인」이었다. 한 패널 안에 같은 단어가 두 가지 크기의 것을 가리키고 있었던 셈이다 —
     * 하나는 들어오는 문, 하나는 그 문을 여는 열쇠들. 영어는 "Signs in to" / "Sign-in"으로
     * 이미 갈라져 있으니 한국어만 갈라 준다. 「비밀번호와 코드」로 돌아가지 않은 이유는 이
     * 묶음에 이메일 변경이 함께 들어 있기 때문 — 주소도 로그인 수단이다.
     */
    panelAccountSection: "로그인 수단",
    panelStatusSection: "계정",
    /* 위 줄은 몇 대인지를, 이 줄은 어느 대인지를 답한다. */
    panelScopeMapSection: "보이는 카메라",
    scopeMapVia: (names: string) => `${names} 그룹으로 보입니다`,
    scopeMapPicked: "이 계정에 따로 지정된 카메라입니다",
    scopeMapAnd: " · ",
    scopeMapNotVisible: "이 계정에는 보이지 않습니다",
    /* 영어 쪽 주석 참고 — 배지는 상태를 부르고, 이 줄은 그 상태의 결과를 말한다. */
    suspendedPanelTitle: "이 계정은 로그인할 수 없습니다",
    suspendedPanelBody: "정지된 상태입니다. 여기서 정한 권한은 그대로 보관되어 재활성화하면 함께 돌아오지만, 재활성화하기 전에는 어떤 비밀번호도 설치 코드도 이 계정을 들여보내지 못합니다 — 재활성화 버튼은 이 카드 맨 아래에 있습니다.",
    reasonSuspended: "정지된 계정이라 새 인증 수단을 발급해도 쓸 수 없습니다. 이 카드 맨 아래에서 먼저 재활성화하세요.",
    changeEmail: "이메일 변경",
    emailPanelTitle: "이메일 변경",
    emailPanelCurrent: "현재 주소",
    emailPanelNew: "새 주소",
    emailPanelNoVerify: "여기선 확인 메일을 보낼 수 없어 바로 적용됩니다.",
    emailPanelPending: "새 주소가 답해야 바뀝니다. 그 전까지는 지금 주소로 로그인합니다.",
    emailPanelRepeat: "새 주소 다시 입력",
    emailPanelMismatch: "두 주소가 다릅니다.",
    emailPanelSend: "확인 메일 보내기",
    emailSentToast: "확인 메일을 보냈습니다",
    emailSentToastDesc: (name: string, email: string) => `${email}이(가) 답하면 ${name}의 주소가 바뀝니다.`,
    emailPendingLabel: "새 주소 확인 대기",
    emailPendingCancel: "취소하기",
    emailPendingCancelled: "변경을 취소했습니다",
    emailPanelApply: "주소 변경",
    emailPanelDuplicate: "다른 계정이 이미 쓰고 있는 주소입니다.",
    emailPanelSame: "지금 쓰고 있는 주소와 같습니다.",
    emailPanelInvalid: "이메일 주소 형식이 아닙니다.",
    emailPanelUndeliverable: (domain: string) => `계정은 @${domain} 도메인을 씁니다. 그 외 주소로는 메일이 가지 않습니다.`,
    emailChangedToast: "이메일 주소를 바꿨습니다",
    emailChangedToastDesc: (name: string, addr: string) => `${name}은(는) 이제 ${addr}로 로그인합니다.`,
    panelGrants: "앱 권한",
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
    reasonNoAppScreens: "앱 접근이 없는 계정입니다 — 지정하거나 검색할 권한이 없습니다.",
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
    bulkResultTitle: "전부 바뀌지는 않았습니다",
    bulkResultBody: (done: number, left: number) => `${done}명 적용, ${left}명은 그대로 뒀습니다:`,
    bulkRefusedLastAdmin: "Portal에 들어올 수 있는 마지막 관리자입니다. 정지하면 아무도 접근 권한을 관리할 수 없게 됩니다.",
    bulkRefusedAlready: "이미 정지됐거나 이 프로젝트에 없습니다.",
    tempDone: "완료",
    inviteDoneAll: "카메라 전체로 두고 완료",

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
    scopeHeldAll: (n: number) => `담당 프로젝트의 카메라 전부 — 지금 ${n}대, 나중에 추가되는 것도 포함합니다.`,
    scopeHeldSome: (n: number, total: number) => `${total}대 중 ${n}대.`,
    inviteScopeStart: (n: number) => `담당 프로젝트의 카메라 전부 — 지금 ${n}대, 나중에 추가되는 것도 포함합니다. 다음 단계에서 좁힐 수 있습니다.`,
    scopePick: "그룹·카메라 고르기",
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
    projectsZeroCameras: ({ name, groups, from, to }: { name: string; groups: string; groupCount: number; from: string; to: string }) =>
      `저장하면 ${name}가 열 수 있는 카메라가 0대가 됩니다 — 가진 「${groups}」은 ${from}의 그룹이라 ${to}에선 아무것도 안 열립니다.`,
    projectsZeroCamerasPicked: ({ name, count, from, to }: { name: string; count: number; from: string; to: string }) =>
      `저장하면 ${name}가 열 수 있는 카메라가 0대가 됩니다 — 이 계정에 지정된 ${count}대가 모두 ${from}에 있고, ${to}에는 한 대도 없습니다.`,
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
    grantDetails: "세부 설정",
    grantActionCount: (n: number) => `할 수 있는 일 ${n}개`,
    grantNothingPicked: "고른 것 없음",
    grantApply: "적용",
    grantBack: "뒤로",
    grantNoScreens: "화면을 하나 이상 골라주세요 — 하나도 없으면 앱을 열 수 없습니다",
    grantsHeading: "이 방식이 켜는 것",
    grantsLocked: "프리셋을 따릅니다. 하나씩 바꾸려면 커스텀을 고르세요.",
    grantsModalTitle: "앱 권한",
    grantsModalIntro: (name: string) => `${name} — 관제 앱에서 할 수 있는 일`,
    grantsOverwriteWarning: "이 계정은 손으로 조정한 권한을 갖고 있습니다. 이 프리셋을 따르면 그것이 대체됩니다.",
    grantsUnchanged: "아직 바뀐 것이 없습니다.",
    grantsHeldNone: "앱 권한 없음",
    fixGrants: "권한 지정",
    countNoScreens: "앱 권한 없음",
    noScreensHint: "앱이 이 계정의 문 중 하나인데 부여된 권한이 하나도 없습니다. 다른 이유로 막히는 것이 없어지는 순간, 로그인 단계에서 「볼 화면이 지정되지 않은 계정입니다」로 되돌려보냅니다. 여기서 권한을 지정하면 풀립니다.",
    grantsSavedTitle: "앱 권한을 바꿨습니다",
    grantsSavedDesc: (name: string) => `${name}이(가) 다음에 앱을 열 때부터 적용됩니다.`,
    grantsPortalOnly: "Portal만 쓰는 계정에는 부여할 앱 권한이 없습니다.",
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
function GrantPicker({ presets, choice, onChoice, actions, onToggleAction, hideTitle, compact, t }: {
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
  /**
   * THE ROW OF NAMES AND ONE LINE — no action list, and a door to the panel that has one.
   *
   * The invite form's shape, measured: the eight-row list made the 권한 block 667px of a 1212px
   * form, so finishing an invite meant scrolling 445px past the two questions below it. As a row
   * plus one line the block is 90px and every state of the form is the same height.
   *
   * Same component rather than a second row of names in the invite file: there are exactly four
   * answers to this question and they have to be the same four, in the same order, at the same
   * width, wherever it is asked.
   */
  compact?: { onOpenDetails: () => void };
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
    /* The line is read off the preset's ticks, not typed — see presetSummary. */
    ...presets.map(pr => ({ id: pr.id, label: presetLabel(pr, lang), desc: presetSummary(pr.actions, lang) })),
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
        {/*
          ONE LINE UNDER THE ROW: WHAT WAS CHOSEN, AND THE WAY IN (§4 of the invite spec).

          Left is the only thing the four names cannot say — a preset's own sentence, or, for
          커스텀, how many actions are actually ticked behind the door. Right is the door.

          NOTHING HERE BEFORE THE FIRST ANSWER. Before a name is pressed there is no description to
          print and no detail to go into, which is the same rule the action list already follows
          (owner, 2026-09-21: 프리셋을 선택 안한상태일땐, 아래 이 방식이 켜는것을 안보여줘도
          될것같아) — and it is what keeps the untouched form shorter than the answered one by
          exactly this line.
        */}
        {compact && choice !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isCustom
                ? (actions.length > 0 ? t.grantActionCount(actions.length) : t.grantNothingPicked)
                : chosenOption?.desc}
            </span>
            {/* type="button": this renders inside the invite <form>, where a button with no type
                submits — the door would have mailed the invite. One shade darker than the line it
                shares (gray-600 against gray-500), which is how a reader sees that the right end
                of this line is a different kind of thing from the left. */}
            <button type="button" onClick={compact.onOpenDetails} className="portal-btn-quiet"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "2px",
                border: "none", background: "none", padding: "2px 4px", marginRight: "-4px",
                borderRadius: "6px", cursor: "pointer", fontFamily: "inherit",
                fontSize: "11px", fontWeight: 700, color: "var(--gray-600)",
              }}>
              {t.grantDetails}
              <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" style={{ color: "var(--gray-400)" }} />
            </button>
          </div>
        )}
      </div>

      {/* THE LIST IS HERE FOR EVERY ANSWER — AND NOTHING BEFORE THE FIRST ONE.
          A preset is a name until you can see what it switches on, so in preset mode the rows are
          locked rather than hidden: hiding them answers "what does this preset do?" with silence.
          But BEFORE anything is picked there is nothing to describe (owner, 2026-09-21: 프리셋을
          선택 안한상태일땐, 아래 이 방식이 켜는것을 안보여줘도될것같아). Six outlined pills under a
          heading that says "what this switches on" describe a grant nobody chose — and the only
          words there were an instruction to go back up, which the reader is already looking at. */}
      {/* `!compact`: the invite shows the line above instead, and the panel its door opens is
          this same component without the switch. */}
      {choice !== null && !compact && (
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
            the note on the row above.
 
            NOT FOR 커스텀 (2026-09-23). 「할 수 있는 일을 하나씩 고릅니다」 was a description of the
            list directly beneath it, which the reader can see. It earned its place while the whole
            grant list lived inside the invite form and that line was the only thing naming what
            the eight rows were for; now the rows sit in their own panel titled 「앱 권한」, so the
            sentence is the third thing on one screen saying the same job. A preset's line stays —
            「지금 일어나는 일을 본다」 cannot be worked out from a name and a set of marks. */}
        {chosenOption && !isCustom && (
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
function InviteLinkPanel({ title, links, onClose, onBack, doneLabel, children }: {
  title: string;
  links: InviteLink[];
  onClose: () => void;
  /**
   * WHAT THE LAST BUTTON IS AGREEING TO (owner, 2026-10-06: 여기서 카메라를 설정하는게 눈에
   * 안띄어서 그냥 아래 done누르고 그런기능이 있었는지도 모를것같아).
   *
   * The account lands holding every camera on its projects, and this panel is the last place that
   * can be changed without going and finding the row. But the camera block sat under a link that
   * owns the reader's attention — it is shown once and has a Copy button — and the only dark
   * control on the sheet said 「완료」, which is what you press when you are finished rather than
   * when you have decided something. So the default was taken by not reading.
   *
   * The button names it instead. It costs no step and no sentence, and the one thing it makes
   * impossible is pressing it without learning there was a choice. It goes back to 「완료」 the
   * moment the scope is narrowed — a button that keeps announcing a default nobody is taking is
   * the next thing to stop reading.
   */
  doneLabel?: string;
  /** Set when this opened over the account card — see Drawer.onBack. */
  onBack?: () => void;
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
       the link) is the Drawer's 320 now. The ordering flipped on 2026-09-28: a confirm is 400 and
       sits ABOVE every panel, because a confirm opened from inside a panel was rendering under
       that panel's own dim and reading as disabled. Panels stack among themselves; an
       ask-before-you-act is above all of them. */
    <Drawer title={title} onClose={onClose} onBack={onBack}
      footer={
        <button className="portal-btn-primary" onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {doneLabel ?? t.tempDone}
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
/** The map below the account card picks nothing, and a fresh Set each render would re-run it. */
const NO_SELECTION: Set<string> = new Set();
const NO_PICKING = () => {};

function scopableCameras(cameras: Camera[], projectIds: string[]): Camera[] {
  return cameras.filter(c => projectIds.includes(c.projectId));
}

function InviteUserModal({ defaultProjectId, onClose }: { defaultProjectId: string; onClose: () => void }) {
  /* NO useEscapeKey HERE. The Drawer owns Escape and routes it through the same guard as the scrim
     (its `dirty`), and it turns the key off entirely while the details panel is open over this
     one. A second listener on this component did neither: one press threw away a half-written
     invite without asking, and it fired even while the reader was looking at the stacked panel. */
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
  /* CAN THIS SITE SEND AN E-MAIL AT ALL (2026-09-30).
   *
   * Measured on Northgate, whose team has no SMTP: the invite panel opened and asked for an
   * address with nothing said, so an administrator could compose an invitation that can never
   * leave. `mailAvailable` on the page outside is the INSTALLATION's outbound switch and does not
   * know a team has no relay — resolveMailConfig does, because it is the same lookup the mail
   * settings screen reads. */
  const siteSmtp = resolveMailConfig(defaultProjectId, projects, teams).smtp;
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
  /**
   * PRESSING 커스텀 OPENS THE DETAILS PANEL, and carries the set that was on screen into it.
   *
   * 커스텀 is by definition the answer "I will say which ones", so a press that visibly does
   * nothing reads as the eight rows having gone missing. HubSpot's Create users does the same
   * thing — the access step opens as soon as it becomes the question being asked.
   *
   * The set it opens with is the preset's, not an empty list, until the reader has tuned one of
   * their own (customTouched). Every other name just answers the question.
   */
  const chooseGrant = (id: string) => {
    setGrantChoice(id);
    if (id !== "custom") return;
    setGrantEditor({ choice: "custom", actions: customTouched ? customActions : shownActions });
  };
  /** The other door, on the line under the row: opens on whatever is chosen right now. */
  const openGrantDetails = () => setGrantEditor({ choice: effectiveChoice, actions: shownActions });
  /**
   * 「적용」 — into the draft on this form and nowhere else. Nothing is saved and there is no
   * toast: there is no account to save it against yet, which is the whole difference between this
   * door and the one on an account's card.
   */
  const applyGrantDraft = (d: GrantDraft) => {
    const openedWith = grantEditor?.actions ?? [];
    setGrantChoice(d.choice);
    if (d.choice === "custom") {
      setCustomActions(d.actions);
      // Only a set they actually moved makes it theirs. Applying the seeded set unchanged leaves
      // 커스텀 still following whichever preset is showing next time.
      if (!sameActions(d.actions, openedWith)) setCustomTouched(true);
    }
    setGrantEditor(null);
  };
  const [permission, setPermission] = useState<PortalPermission>("admin");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);
  /**
   * THE DETAILS PANEL, AND WHAT IT OPENED WITH — null while it is closed.
   *
   * The pair is kept rather than recomputed on apply, because the invite has to know whether the
   * reader actually moved anything in there (see customTouched).
   */
  const [grantEditor, setGrantEditor] = useState<GrantDraft | null>(null);
  /**
   * Has anybody hand-tuned the custom set on this form yet?
   *
   * Until they have, 커스텀 opens on the actions of the preset that was showing — that preset is
   * what the reader is looking at and wants to adjust. It used to open on an empty list, which
   * made them tick five boxes they had just been reading, and if they did not it walked straight
   * into the "pick at least one" refusal. Once they HAVE tuned it, their set is theirs and
   * pressing 운영자 then 커스텀 again must not overwrite it.
   */
  const [customTouched, setCustomTouched] = useState(false);

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
  /*
   * THE INVITE DOES NOT ASK ABOUT CAMERAS ANY MORE — it asks about permissions and stops.
   *
   * There was a 카메라 범위 block here: a 「전체 카메라 62」 chip, one chip per camera group, a
   * pencil on each that opened the group editor over this panel, a 「+ 새 그룹」 on the label row,
   * and a line saying later cameras are included. 85px of the form, and a second implementation
   * of a decision that already exists — `CameraScopePicker` writes with `setCameraScope(user.id,
   * …)`, which needs an account id, and a draft has none. So the chips could not use the real
   * editor, and two pickers for one rule drift the day either is corrected.
   *
   * Narrowing now happens against an account that exists, in the two places already built for it:
   * the 「카메라 고르기」 button on the result step below (so nobody has to find the row again) and
   * the 카메라 row of the account's card. Both go through `CameraScopePicker`, so both leave an
   * audit line — a scope handed to `addPortalUser` was a narrowing with no record of who did it.
   *
   * What does NOT change: not narrowing still means every camera on the ticked projects, today's
   * and next month's (see scopedCameraIds). That was already what happens when nobody presses a
   * chip, so the default the invite hands out is the same one as before.
   */

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
    || grantChoice !== null || customActions.length > 0
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
      // NO cameraGroupIds EITHER. The invite no longer asks — see the note where the chips were.
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
     * from the real one the day either is corrected. So the form STATES where the account starts
     * — the line under the 프로젝트 chips, counted off the same register as this one — and the
     * answer is collected one step later, against the account that now exists, by the same picker
     * the row menu opens. The person inviting never
     * has to find the row in the table, which is what they were doing before.
     *
     * The audit log comes along for free: `setCameraScope` writes an entry, and a scope handed to
     * `addPortalUser` would have been a narrowing with no record of who narrowed it.
     */
    const created = issuedId ? allUsers.find(u => u.id === issuedId) ?? null : null;
    const scopable = created ? scopableCameras(allCameras, created.projectIds) : [];
    /* Only while the account is still holding everything, and only where there is a scope to
       narrow at all — on a site with no cameras provisioned, naming the default would be naming
       nothing. */
    const holdsEveryCamera = !!created && created.appAccess && scopable.length > 0
      && scopedCameraIds(created, allGroups) === null;
    return (
      <>
        <InviteLinkPanel title={t.inviteCreatedTitle} links={[issued]} onClose={onClose}
          doneLabel={holdsEveryCamera ? t.inviteDoneAll : undefined}>
          {/* Same two conditions as the row menu item, for the same reasons: no app door means no
              cameras to narrow, and an empty picker would let somebody save the empty set on a
              site that simply has not been provisioned yet. */}
          {created && created.appAccess && scopable.length > 0 && (
            /* Filled, not outlined. Above it sits a link block with a Copy button that owns the
               sheet; an outlined row under it read as a footnote to the thing you came for. The
               fill is the same one the panel uses for a value you are meant to take in. */
            <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
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
    <Drawer title={t.modalTitle} onClose={onClose} width="520px" escapeEnabled={grantEditor === null} dirty={inviteStarted}
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
          {/* SAID BEFORE THE ADDRESS IS TYPED, not after Send. A site with no relay cannot deliver
              this, and the form asking for an address anyway is the shape of promise this console
              keeps catching. The other door is still open — a registration code is handed over by
              hand and needs no mail — so this points at it rather than just refusing. */}
          {!siteSmtp && (
            <p style={{ margin: 0, padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--warning-100)", color: "var(--warning-500)", fontSize: "12px", fontWeight: 700, lineHeight: 1.5 }}>
              {t.inviteNoMail}
            </p>
          )}
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
            <FormLabel as="span">{t.emailLabel}<RequiredMark /></FormLabel>
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
            <FormLabel as="span">{t.nameLabel}<RequiredMark /></FormLabel>
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
                  <FormLabel as="span">{t.projectsLabel}<RequiredMark /></FormLabel>
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
                  {/*
                    WHAT THE ACCOUNT WILL BE ABLE TO WATCH, SAID ON THE FORM (the line the slimming
                    took with the chips — see the note above `selectedProjects`).

                    The form asked six questions and none of them was about cameras, so the first
                    time anybody was told that an invite hands over EVERY camera on the ticked
                    projects was a panel that appears after the account exists. A field here would
                    be the wrong fix twice over: it was turned down on 2026-09-23 (초대창이 너무
                    헤비해보여) and again on 2026-09-28, and a required picker makes the answer
                    worse — an administrator in a hurry ticks all of them and freezes the list, so
                    next month's cameras are silently excluded, which is what CameraScopePicker's
                    own freeze warning is for.

                    So: a line, not a block, and it is the sentence the result step already prints
                    (scopeHeldAll) plus where the narrowing happens.

                    The number is counted off the register against the ticked projects — the same
                    `scopableCameras` the result step and the row menu use — so it moves with the
                    chips instead of being a constant that is right on one site only. Drawn only
                    when there is an app door to walk through and at least one project to count.
                  */}
                  {accessMode !== "portalOnly" && projectIds.length > 0 && (
                    <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "8px" }}>
                      {t.inviteScopeStart(scopableCameras(allCameras, projectIds).length)}
                    </p>
                  )}
                  {mailTransportNote && (
                    <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "8px" }}>{mailTransportNote}</p>
                  )}
                </div>
                <div>
                  <FormLabel as="span">{t.accessLabel}</FormLabel>
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
                    <FormLabel as="span">{t.permissionLabel}</FormLabel>
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
                    /* THE ROW OF NAMES AND ONE LINE — the eight-row list lives behind 세부 설정
                       now, which is what makes every state of this form the same height. Same
                       component as the panel that door opens, so the four answers cannot come out
                       in a different order or at a different width in the two places. */
                    <GrantPicker
                      presets={presets} choice={effectiveChoice} onChoice={chooseGrant}
                      actions={shownActions} onToggleAction={toggleCustomAction}
                      compact={{ onOpenDetails: openGrantDetails }}
                      hideTitle t={t} />
                  ) : (
                    /* Portal-only: there is no app to grant screens in, and the row says so rather
                       than opening onto an empty list. */
                    <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.grantsPortalOnly}</p>
                  )}
                </FormSection>
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
              <FormLabel as="span">{t.foldTeam}</FormLabel>
              <FilterSelect value={teamId} onChange={changeTeam} options={teams.map(o => ({ value: o.id, label: o.name }))} />
            </div>
          </div>
        </form>
    </Drawer>
    {/*
      OVER THIS PANEL, NOT INSTEAD OF IT — and OUTSIDE the <form> above.
     
      The invite keeps every answer already typed while the permissions are being detailed, and
      Escape closes this editor only (see the Drawer's escapeEnabled, switched off above while
      this is up). Outside the form matters: inside it, every toggle in the editor would be a
      submit button and the first one pressed would mail the invite.
     
      Its scrim covers the invite too, but it is this panel's scrim — clicking it asks (the
      editor's own `dirty`) and then closes the top panel only. The invite is still there.
    */}
    {grantEditor && (
      <AppGrantEditor
        nested
        presets={presets}
        initial={grantEditor}
        onClose={() => setGrantEditor(null)}
        onApply={applyGrantDraft}
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
/**
 * CHANGING SOMEBODY'S LOGIN ADDRESS — the one identity field that is not self-service.
 *
 * Until now no screen in Portal could change an e-mail at all: a department that renamed its
 * domain, or a person whose address was mistyped on the invitation, could only be given a second
 * account — which splits one person's 조회 기록 and 변경 기록 into two people who never meet.
 *
 * WHY IT LIVES HERE AND NOT IN SETTINGS (decided 2026-09-29). The address is the login ID and the
 * destination of a password reset, so a holder who can move it is a holder who can be impersonated:
 * take the account, change the address, request a reset, and the recovery mail arrives at the
 * attacker. It is also the key the search access log records a searcher by (actorEmail), so the
 * person an audit is about must not hold the pen on that record. Owner only, from the account's
 * own panel, and Settings → 계정 points at this rather than offering a field.
 *
 * NO VERIFICATION ROUND TRIP, on purpose. Confirming an address means sending mail to it, and this
 * product ships on-premises to sites that are deliberately internet-isolated. A confirmation step
 * that cannot complete at half the installations is not a safeguard, it is a lock-out. The owner's
 * change takes effect directly, and the audit row carries both addresses so the swap is readable
 * afterwards — which is the control that replaces the round trip.
 */
function ChangeEmailPanel({ user, mailDomain, mailAvailable, onClose, onBack }: {
  user: PortalUser;
  mailDomain: string | null;
  /** Where mail can go out, the address is parked until it answers; where it cannot, it applies. */
  mailAvailable: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const changePortalUserEmail = useVcaStore(s => s.changePortalUserEmail);
  const requestPortalUserEmailChange = useVcaStore(s => s.requestPortalUserEmailChange);
  const allUsers = useVcaStore(s => s.portalUsers);
  const { showToast } = useToast();
  /* Empty, not pre-filled with the current address. It opened holding the very address it is here
     to replace, which made 「That is the address the account already has.」 the first thing the
     panel said about a field nobody had typed in yet. The current one is stated above it. */
  const [value, setValue] = useState("");
  /* TYPED TWICE (owner, 2026-10-06). The checks in front of this — format, no duplicate, on the
     installation's own domain — all pass for a colleague's address typed by mistake, and that is
     the case where a password reset reaches a real person who is not the account holder. Where
     mail works the confirmation catches it; this catches the ordinary slip everywhere, including
     the isolated sites where nothing can be sent. */
  const [repeat, setRepeat] = useState("");

  const typed = value.trim();
  const formatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed);
  const same = typed.toLowerCase() === user.email.toLowerCase();
  const duplicate = !same && typed !== "" && allUsers.some(u => u.id !== user.id && u.email.toLowerCase() === typed.toLowerCase());
  /* Same gate as the invitation form, from the same helper: an address off the installation's
     domain receives nothing, so a password reset sent there is a reset nobody gets. */
  const undeliverable = formatValid && !isMailDeliverable(typed, mailDomain);
  const error = typed === "" ? ""
    : !formatValid ? t.emailPanelInvalid
    : same ? t.emailPanelSame
    : duplicate ? t.emailPanelDuplicate
    : undeliverable && mailDomain ? t.emailPanelUndeliverable(mailDomain)
    : "";
  const firstOk = formatValid && !same && !duplicate && !undeliverable;
  const mismatch = firstOk && repeat.trim() !== "" && repeat.trim().toLowerCase() !== typed.toLowerCase();
  const canApply = firstOk && repeat.trim().toLowerCase() === typed.toLowerCase();

  const apply = () => {
    if (!canApply) return;
    if (mailAvailable) {
      const refused = requestPortalUserEmailChange(user.id, typed);
      if (refused) {
        showToast({ variant: "warning", title: refused === "duplicate" ? t.emailPanelDuplicate : t.emailPanelSame });
        return;
      }
      showToast({ variant: "success", title: t.emailSentToast, desc: t.emailSentToastDesc(user.name, typed) });
      onClose();
      return;
    }
    const problem = changePortalUserEmail(user.id, typed);
    /* The store is the only thing that can see the whole account list at write time, so a refusal
       coming back from it is reported rather than assumed away — the form's own duplicate check
       is a courtesy, not the guard. */
    if (problem) {
      showToast({ variant: "warning", title: problem === "duplicate" ? t.emailPanelDuplicate : t.emailPanelSame });
      return;
    }
    showToast({ variant: "success", title: t.emailChangedToast, desc: t.emailChangedToastDesc(user.name, typed) });
    onClose();
  };

  return (
    /* NO WIDTH: it takes the Drawer's 520 and covers the account card exactly (owner, 2026-10-06:
       이렇게 패널이 위에 겹쳐서 올라가는게 좀 어색해보여). At 440 over a 520 card it left an 80px
       band of the card showing down the left, so a step inside one flow read as two sheets that
       failed to line up. Same surface, different step, ← to go back. */
    <Drawer title={t.emailPanelTitle} onClose={onClose} onBack={onBack}
      dirty={typed !== "" || repeat !== ""}
      footer={
        <>
          <PanelCancel onClick={onBack ?? onClose} label={t.cancel} />
          <PanelPrimary onClick={apply} label={mailAvailable ? t.emailPanelSend : t.emailPanelApply} disabled={!canApply} />
        </>
      }>
      <div style={{ padding: "4px 20px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <FormLabel as="span">{t.emailPanelCurrent}</FormLabel>
          {/*
            FILLED, LIKE THE RESET PANEL'S OWN VALUE BLOCK (owner, 2026-10-06: 비밀번호 리셋에서
            처럼 바탕색 넣어서 구분해주면 어때).

            The 새 주소 field below it is a white box with an edge, and this was bare text on the
            panel's own ground directly above it — two addresses in the same column, one of which
            looked like nothing in particular. The fill says the same thing the field's edge says,
            in the other direction: this one is a value, that one is a box you type in. Same
            12px/14px and 10px radius the reset sheet uses for its value blocks, so the two panels
            that open over this card wear the same treatment.
          */}
          <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", wordBreak: "break-all" }}>{user.email}</p>
          </div>
        </div>
        <div>
          <FormLabel as="span">{t.emailPanelNew}</FormLabel>
          <TextField value={value} onChange={setValue} type="email" placeholder={mailDomain ? `name@${mailDomain}` : "name@example.com"} autoFocus />
          {error && <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.5, marginTop: "6px" }}>{error}</p>}
        </div>
        {/* Only once the first one is a usable address. Asked for before that, it is a second
            empty box next to an error. */}
        {firstOk && (
          <div>
            <FormLabel as="span">{t.emailPanelRepeat}</FormLabel>
            <TextField value={repeat} onChange={setRepeat} type="email" placeholder={mailDomain ? `name@${mailDomain}` : "name@example.com"} />
            {mismatch && <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.5, marginTop: "6px" }}>{t.emailPanelMismatch}</p>}
          </div>
        )}
        {/* What the screen cannot show: where the address is used, what happens to rows already
            written, and when it takes effect. The last line is the one that changes with the
            installation, so it is the one that carries colour. */}
        {/*
          ONE LINE LEFT (owner, 2026-10-06: 이게 꼭 필요한 설명인가).

          Three stood here and two were answering questions the reader is not asking. 「이 주소가
          로그인이다」 — this panel opens from the 로그인 수단 group, which has already said that.
          「이미 남은 조회 기록은 옛 주소 그대로」 — true, invisible, and it changes nothing about
          whether to proceed; the place that fact has to survive is the record, and the record
          carries both addresses already.

          What is left is the only one the reader cannot see and can act on: the old address keeps
          working until the new one answers. Without it an owner presses 보내기 and tells the person
          their address has changed, which it has not.
        */}
        <p style={{ fontSize: "11px", color: mailAvailable ? "var(--gray-600)" : "var(--warning-500)", lineHeight: 1.6 }}>
          {mailAvailable ? t.emailPanelPending : t.emailPanelNoVerify}
        </p>
      </div>
    </Drawer>
  );
}

function TempPasswordModal({ user, mailAvailable, initialCode, onClose, onBack }: { user: PortalUser; mailAvailable: boolean; initialCode?: string; onClose: () => void; onBack?: () => void }) {
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

  /*
   * A SETUP CODE IS PRINTED 4-4, EVERYWHERE ELSE AND NOW HERE TOO (2026-09-30).
   *
   * This box showed `BZLA6V4F`; the roster tab shows `BPXW-4762` from the same generator through
   * formatCode, and /register's input is four boxes, a break, four boxes. Three spellings of one
   * string, and this is the one that gets copied onto paper by hand and read back over a phone —
   * the place where a run of eight characters is hardest to keep your place in.
   *
   * Only the code. A temporary password is not grouped (it is not 8 characters and the hyphen
   * would be read as part of it), so the branch is on `kind`, not on length.
   *
   * The clipboard gets the hyphen too, deliberately: /register normalises the field with
   * normalizeCode, which strips everything that is not A-Z2-9, so a pasted BPXW-4762 resolves the
   * same as BPXW4762 — and what is copied should be what the reader can see they copied.
   */
  const shownCredential = password !== null && kind === "code" ? formatCode(password) : password;

  // Clipboard write can be refused (an insecure origin, or the browser's permission), and a "Copied"
  // label over a clipboard that did not take is how a password gets pasted as whatever was there
  // before. Only flip the label once the write actually resolved; on failure the password is still
  // on screen to read off.
  const copy = () => {
    if (!shownCredential) return;
    navigator.clipboard?.writeText(shownCredential).then(
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
    /*
      THE SHARED RIGHT-SIDE PANEL (2026-09-22: 나중에 이거 왜 패널로 안 바꼈지? 하고 발견되는
      중앙팝업 없도록). It was a 440px centred card, and it is the console's longest single errand:
      three delivery cards, four consequence lines, and then a credential to read out. Its own
      comment said the box had to cap itself at 60vh and scroll because the English copy wraps
      where the Korean does not — a panel is the height of the window, so the header and the
      footer keep their places and only the middle scrolls, which is what that cap was standing in
      for. `dirty` is not set: nothing here is typed, and the result step must not trap the reader
      behind a confirmation when the code is already minted.
    */
    /*
     * ← WHILE THE ERRAND IS STILL UNDONE (owner, 2026-09-28: 비밀번호 재설정 버튼 누르면
     * 나오는거에서 뒤로가기가 있어야할것같아).
     *
     * This opens from the account card, over it, the same way the projects / app-grant / camera
     * editors do — and those three have carried a ← since the owner asked for one. It did not,
     * because its opener closed the card first, so ✕ landed on the table and the card you were
     * reading was gone.
     *
     * Only until the credential exists. Once it is minted there is nothing to go back to — the
     * code is already issued and the old one already retired — so the footer keeps its single
     * 완료 and the arrow goes away with the step it belonged to.
     */
    /* Same reason as ChangeEmailPanel: it covers the account card, so it is the card's width. */
    <Drawer title={password ? c.resultTitle : c.modalTitle} onClose={onClose} onBack={password === null ? onBack : undefined}
      footer={password === null ? (
        <>
          <PanelCancel onClick={onClose} label={t.cancel} />
          <PanelPrimary onClick={generate} label={c.generate} />
        </>
      ) : (
        <PanelPrimary onClick={onClose} label={t.tempDone} />
      )}>
        {password === null ? (
          <>
            <div style={MODAL_BODY}>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px", textTransform: "uppercase" }}>{t.tempForLabel}</p>
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
                  {shownCredential}
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
                <p style={{ fontSize: "10px", fontWeight: 700, color: c.showExpiry ? "var(--warning-500)" : "var(--info-500)", letterSpacing: "0.4px", textTransform: "uppercase" }}>{c.handoverTitle}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.5, marginTop: "4px" }}>{c.handover}</p>
              </div>
            </div>
          </>
        )}
    </Drawer>
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
      <FormLabel as="span" style={{ marginBottom: "8px" }}>
        {label}
        {required && <RequiredMark />}
      </FormLabel>
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


/*
 * 「초대됨」 IS NOT A FAULT — see StatusBadge in PortalShared for the four tones.
 *
 * It was amber, the same colour Input Sources uses for a camera that has stopped answering, so
 * one colour meant 「something is broken」 on one screen and 「somebody was invited and has not
 * answered yet」 on the next. Waiting on a person is its own kind of news and now has its own
 * tone. 정지 keeps red, because a person did that.
 */
function AccountStatusBadge({ status }: { status: PortalUserStatus }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const tone = status === "active" ? "normal" : status === "invited" ? "waiting" : "stopped";
  const label = status === "active" ? t.statusActive : status === "invited" ? t.statusInvited : t.statusSuspended;
  return <StatusBadge tone={tone} label={label} />;
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
        <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px", marginTop: "10px", textTransform: "uppercase" }}>{t.recoveryNoticeContactLabel}</p>
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
 * The name over a part of the account card.
 *
 * Small, grey and unemphatic on purpose: it is a signpost, not a fact about the person. The four
 * of them are identical so that nothing in the card competes with the person's name at the top or
 * with the values underneath — what separates the parts is what is inside them, tinted cards of
 * current values against bare rows of verbs, not four differently loud headings.
 */
const PANEL_CAPTION: React.CSSProperties = {
  fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--gray-400)", marginBottom: "6px",
};

/**
 * A group of current values inside the account card.
 *
 * A TINT INSTEAD OF A BORDER AND FIVE DIVIDERS (owner, 2026-09-22: 이것도 ui가 너무 라인이 많고
 * 눈에 잘 안들어와 중요한 정보들이 눈에 안들어오는 느낌이야).
 *
 * Measured in the browser before this change, on two accounts: 27 border edges of which 15 were
 * horizontal lines across the reader's path on an active account, 31 and 17 on an invited one —
 * two boxed groups, three dividers between rows, and the four or five bordered buttons under them.
 * Every one was the same 1px grey, so the card read as a stack of identical boxes with nothing
 * leading. Checked against twenty admin consoles on Mobbin: Revolut Business's member
 * panel, Toggl Track's member drawer and Intercom's permission groups all group rows with one
 * filled card and draw no divider between them at all; Neon, Fibery and Canny draw no line
 * anywhere in a user panel. The fill does the grouping the border and the dividers were doing,
 * and it costs no lines.
 */
/*
 * THE FILL CAME OFF (owner, 2026-10-06: 이게 회색 바탕색으로 묶어놔서 … 다른 방법으로 시각적으로
 * 묶으면).
 *
 * This is NOT the 2026-09-22 change coming back. That one took away 27 border edges — two boxed
 * groups, three dividers and five bordered buttons — because the card read as a stack of
 * identical boxes. None of those return here: the group is held by its caption and the space
 * around it, and nothing is drawn at all. The same survey quoted above found consoles that do
 * exactly this — Neon, Fibery and Canny draw no line ANYWHERE in a user panel — so the lighter
 * answer was always on the table; the tint was simply the first step away from the lines.
 *
 * It mattered more once a 261px map moved into the 권한 group: a picture inside a tinted box
 * inside a card is three surfaces deep, and the map had to carry its own edge to stay legible
 * against the tint. With the tint gone the map needs no edge of its own either.
 *
 * Height is NOT the reason, and it is worth writing down so nobody claims it later: the padding
 * was 4px, so this buys 16px across the two groups. The 권한 group measured 572px and the map is
 * 261 of them — that is where the height is, and it is sized on its own merits.
 */
const PANEL_GROUP: React.CSSProperties = {
  display: "flex", flexDirection: "column",
  /*
   * PULLED OUT BY THE ROWS' OWN PADDING (owner, 2026-10-06: 큰 제목있고 그 아래 작은제목들은
   * 들여쓰기 되어있는데 안 들여쓰는게 나은것같은데).
   *
   * MEASURED: captions at x 941, every row label at 953 — the 12px is the row button's own
   * horizontal padding, nothing else. While the group wore a tint that 12px read as the box's
   * inside edge; with the tint gone it is an indent with no reason, and a heading whose items
   * start 12px to its right reads as a list nested under it rather than the group it names.
   *
   * The negative margin, rather than taking the padding off the buttons: the padding is what the
   * pointer tint fills, and a row whose highlight stops at the text is a smaller target that
   * looks like a mistake. So the text lines up and the tint bleeds past it, which is what the
   * 로그인 수단 block below already does with its own buttons.
   */
  margin: "0 -12px",
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
function UserProjectsModal({ user, teamProjects, onClose, onBack, onSave }: {
  user: PortalUser;
  teamProjects: { id: string; name: string }[];
  onClose: () => void;
  /** Opened over the account card: ← in the header and 취소 in the footer both return to it. */
  onBack?: () => void;
  onSave: (projectIds: string[]) => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [picked, setPicked] = useState<string[]>(user.projectIds);
  // Read here rather than passed in: the warning below has to resolve the account's groups through
  // the register, and the register is the store's, not this panel's caller's.
  const allCameras = useVcaStore(s => s.cameras);
  const cameraGroups = useVcaStore(s => s.cameraGroups);
  const projects = useVcaStore(s => s.projects);
  /* NO useEscapeKey HERE — the Drawer owns Escape. A second listener closed this panel AND the
     card behind it with one keypress, which is the same bug the invite form's editor had. */
  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  // Zero is refused rather than warned about. An account with no projects signs into an app with
  // nothing in it and no way to tell that something was taken away — suspending the account is
  // how you stop somebody, and it says so.
  const canSave = picked.length > 0;

  /*
   * THE OTHER WAY TO END UP WITH NOTHING, AND IT IS NOT REFUSED (MEASURED: Marcus Lee holds
   * 「오차드·부기스 라인」, three cameras on Marina Bay; tick Riverside alone and his reach is 0).
   *
   * A camera scope resolves through the register when it is READ, so taking a project away leaves
   * the group ids on the account and the account simply opens nothing. No error, no empty state,
   * nothing on this page — the account looks narrowed and is in fact blind.
   *
   * SAID, NOT BLOCKED, AND NOTHING IS STRIPPED. Moving somebody between sites for a week is
   * ordinary and the groups have to survive it: dropping them here would be an unrecoverable
   * guess about what somebody meant, and refusing the save would stop a legitimate reassignment.
   * --warning-500, not danger: this is a consequence, not a mistake.
   *
   * The count comes from `scopedCameraIds` intersected with what the account could be scoped to
   * after the change — the same pair the table's 카메라 cell uses — so it cannot disagree with the
   * number the row will show the moment this is saved.
   *
   * TWO SENTENCES, BECAUSE THERE ARE TWO CAUSES AND ONLY ONE OF THEM IS A GROUP. The first names
   * the stranded groups. The second is for the account scoped to individual cameras, which used to
   * get NOTHING — the save emptied it just as completely and this panel said so only when a group
   * happened to be involved. A true sentence about the wrong cause is the failure this repo keeps
   * paying for; the fix is a second true sentence, not one sentence stretched over both.
   *
   * AND ONLY WHEN THIS SAVE IS THE CAUSE. An account already at zero — an empty group, cameras
   * deleted last week — reaches nothing before the change and nothing after it, and warning there
   * would blame this save for a state it found.
   */
  const zeroWarning = (() => {
    if (!user.appAccess || picked.length === 0) return null;
    const scoped = scopedCameraIds(user, cameraGroups);
    if (scoped === null) return null; // never narrowed: it picks up the new projects' cameras
    const after = new Set(scopableCameras(allCameras, picked).map(c => c.id));
    if ([...scoped].some(id => after.has(id))) return null; // still reaches something
    const before = scopableCameras(allCameras, user.projectIds).filter(c => scoped.has(c.id));
    if (before.length === 0) return null; // already reached nothing — not this save's doing
    const nameOf = (id: string) => projects.find(pr => pr.id === id)?.name ?? id;
    const to = teamProjects.filter(pr => picked.includes(pr.id)).map(pr => pr.name).join(", ");
    const stranded = (user.cameraGroupIds ?? [])
      .flatMap(id => {
        const g = cameraGroups.find(gr => gr.id === id);
        return g && !picked.includes(g.projectId) ? [g] : [];
      });
    if (stranded.length > 0) {
      return t.projectsZeroCameras({
        name: user.name,
        groups: stranded.map(g => g.label).join(", "),
        groupCount: stranded.length,
        from: [...new Set(stranded.map(g => nameOf(g.projectId)))].join(", "),
        to,
      });
    }
    /* The sites named are the ones being untickED that actually hold the cameras — not every site
       leaving the account, because one of them may hold none of them and naming it would send the
       reader to re-tick the wrong box. */
    return t.projectsZeroCamerasPicked({
      name: user.name,
      count: before.length,
      from: [...new Set(before.map(c => nameOf(c.projectId)))].join(", "),
      to,
    });
  })();

  return (
    /* A panel, like the rest of this page's editors. Which sites a person may open is a decision
       taken against the row that shows what they hold now. */
    <Drawer title={t.projectsModalTitle} onClose={onClose} onBack={onBack} width={onBack ? "520px" : undefined}
      footer={
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {!canSave && (
            <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.projectsModalNoneWarning}</p>
          )}
          {/* Over the button that does it, where the count already sits. The two never show at
              once — no project ticked is the case above. */}
          {zeroWarning && (
            <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{zeroWarning}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            {/* 취소 goes BACK when there is a card behind, not away. */}
            <button className="portal-btn-outline" onClick={onBack ?? onClose}
              style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {onBack ? t.grantBack : t.cancel}
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

/** The pair a grant editor takes in and hands back: how grants are decided, and what they are. */
type GrantDraft = { choice: string | null; actions: AppAction[] };

/**
 * Do these two lists hold the same actions? Order-independent: a toggle appends in the order it
 * was pressed and the store keeps APP_ACTIONS order, so a raw compare calls identical sets dirty.
 *
 * At module scope because three things ask it now — the editor's own "has anything moved", the
 * account wrapper's comparison against what is on file, and the invite's "has the reader
 * hand-tuned the custom set yet".
 */
function sameActions(a: AppAction[], b: AppAction[]) {
  return APP_ACTIONS.filter(x => a.includes(x)).join() === APP_ACTIONS.filter(x => b.includes(x)).join();
}

/**
 * THE ONE PLACE APP PERMISSIONS ARE EDITED. Values in, values out — it saves nothing itself.
 *
 * Two doors open it and they must not be two editors: 「세부 설정」 on the invite form, and the
 * 앱 권한 row of an account's card. A second arrangement of the same question would be a second
 * thing to learn for the same decision, and the decision is who may look at what.
 *
 * WHAT THE CALLER KEEPS. Anything that needs an account: following a preset, detaching to custom,
 * the audit line, the toast, and the warning about overwriting hand-tuned grants. The invite has
 * no account yet — it has a draft — so it keeps none of that and just takes the pair back.
 *
 * `nested` is the only switch between the two, and it decides three things at once: the ← that
 * says there is a panel behind this one, the footer's two words, and whether the title gets a line
 * naming the person (the invite has nobody to name).
 */
function AppGrantEditor({ presets, initial, subtitle, nested, warning, blockedReason, onClose, onApply }: {
  presets: AccessPreset[];
  /** Where this opens: a preset id or "custom", and the actions to start the custom draft from. */
  initial: GrantDraft;
  /** The line under the title, for the caller that has an account to name. */
  subtitle?: string;
  /** Opened OVER another panel. See the class comment. */
  nested?: boolean;
  /** Said before it happens — what the caller knows about the account behind the draft. */
  warning?: (draft: GrantDraft) => string | null;
  /**
   * Why the committing button is dead, beyond the one refusal both callers share.
   *
   * The shared one is custom-with-nothing-ticked, which is checked here because it is a property
   * of the draft rather than of either caller: an account holding zero actions signs in and is
   * turned away by the gate's `noScreens`, whether it was saved or invited.
   */
  blockedReason?: (draft: GrantDraft) => string | null;
  onClose: () => void;
  onApply: (draft: GrantDraft) => void;
}) {
  /* NO useEscapeKey HERE. The Drawer owns Escape, and it routes it through the same guard as the
     scrim — a second listener on this component would close the panel unguarded and throw away
     exactly what the guard exists to keep. */
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [choice, setChoice] = useState<string | null>(initial.choice);
  /* Starts from what came in, which is what makes "preset → custom" carry the preset's set: the
     caller hands over the actions that were on screen, not an empty list. */
  const [customActions, setCustomActions] = useState<AppAction[]>(initial.actions);
  const toggleCustomAction = (action: AppAction) =>
    setCustomActions(prev => prev.includes(action) ? prev.filter(x => x !== action) : [...prev, action]);

  const isCustom = choice === "custom";
  const pickedPreset = presets.find(pr => pr.id === choice);
  const shown = pickedPreset ? grantsOfPreset(pickedPreset) : null;
  const actions = isCustom ? customActions : (shown?.appActions ?? []);
  const draft: GrantDraft = { choice, actions };

  /**
   * HAS THE READER MOVED ANYTHING? What the scrim and Escape ask about (Drawer's `dirty`).
   *
   * This panel had no guard at all: eight toggles pressed on an account's card, then a click on
   * the scrim — which is most of the window — and it vanished without a word. Measured against
   * the draft rather than against the store, because that is the question a scrim click asks.
   */
  const touched = choice !== initial.choice || !sameActions(actions, initial.actions);

  const blocked = choice === null ? t.grantNotChosen
    : isCustom && customActions.length === 0 ? t.grantNoScreens
    : blockedReason?.(draft) ?? null;
  const note = warning?.(draft) ?? null;

  return (
    /* A panel. The 92vh cap and the column layout this dialog needed to keep a long grant list
       and its footer on screen are the Drawer's job now. */
    <Drawer title={t.grantsModalTitle} onClose={onClose} onBack={nested ? onClose : undefined} dirty={touched}
      footer={
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {note && (
            <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{note}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          {/* The button says why it is dead instead of sitting there. */}
          {blocked && (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>
              {blocked}
            </span>
          )}
          {/* 뒤로 when there is a panel behind this one, the same precedent the camera group editor
              set: a stacked panel's cancel returns to what it covered, and saying 취소 there reads
              as cancelling the invite underneath. */}
          <button type="button" className="portal-btn-outline" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {nested ? t.grantBack : t.cancel}
          </button>
          {/* 적용 against 변경: the nested one edits a draft of an account that does not exist, so
              there is nothing yet to have changed. */}
          <button type="button" className="portal-btn-primary" onClick={() => onApply(draft)} disabled={blocked !== null}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: blocked === null ? "var(--primary-400)" : "var(--gray-200)", color: blocked === null ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: blocked === null ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {nested ? t.grantApply : t.changeApply}
          </button>
          </div>
        </div>
      }>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
        {/* Who this is about; the title is the panel header's. Absent on the invite's door —
            there is no account yet, so there is nobody to name. */}
        {subtitle && <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{subtitle}</p>}
        <GrantPicker
          presets={presets} choice={choice} onChoice={setChoice}
          actions={actions} onToggleAction={toggleCustomAction}
          t={t} />
      </div>
    </Drawer>
  );
}

/**
 * Change one account's app grants after the invite — the account half around the editor above.
 *
 * WITHOUT THIS, GRANTS FREEZE AT INVITE TIME. Role, app access, person search, projects and status
 * were all editable from the row menu; the screens, evidence export and preset membership were
 * not. The only way to move somebody between jobs was to delete the account and invite them
 * again, which throws away the audit continuity the account exists to carry and makes somebody
 * hand out a fresh setup link. The workaround was worse than the gap.
 *
 * It starts from what the account holds, unlike the invite form, which pre-selects nothing. The
 * difference is not an inconsistency: there is a decision on file here, and showing it is
 * reporting rather than defaulting.
 */
/**
 * Add or edit one roster row.
 *
 * The roster is a shortcut for setting many people up at once, not the only way in — so a person
 * can be entered here by hand, one at a time, and the Excel import is what saves repeating it.
 * Everything the import would carry is on this form: name, employee number, department, an optional
 * address, and the role the account will get when they register.
 *
 * The employee number is the roster's matching key (a code resolves to exactly one row), so it can
 * be typed when adding and is read-only afterwards — silently rewriting it would point an already
 * printed code at a different person.
 */
function RosterEntryModal({ entry, projectId, onClose, onCreated, t }: {
  entry: RosterEntry | null;
  projectId: string;
  onClose: () => void;
  /**
   * Called with the employee number after a NEW row is written, never on an edit.
   *
   * The caller that opened this through 「등록 코드로 추가」 uses it to mint the code in the same
   * act — see PortalUsersPage. A callback rather than doing it here, because this panel is also
   * the row editor, where issuing a code would be a side effect nobody asked for.
   */
  onCreated?: (employeeId: string) => void;
  t: RosterTranslations;
}) {
  const [lang] = usePortalLanguage();
  const addRosterEntry = useVcaStore(s => s.addRosterEntry);
  const updateRosterEntry = useVcaStore(s => s.updateRosterEntry);
  const { showToast } = useToast();
  const editing = !!entry;

  const [name, setName] = useState(entry?.name ?? "");
  const [employeeId, setEmployeeId] = useState(entry?.employeeId ?? "");
  const [department, setDepartment] = useState(entry?.department ?? "");
  const [email, setEmail] = useState(entry?.email ?? "");
  const [duplicate, setDuplicate] = useState(false);

  /*
   * THE SAME FOUR ANSWERS THE MAIL DOOR COLLECTS (owner, 2026-09-28: 메일로 초대할 때처럼
   * 프로젝트, 로그인 범위, 권한, 팀 선택이 모두 동일하게 들어가야 할 것 같은데?).
   *
   * This panel used to ask one two-way question — 앱 사용자 / Portal 관리자 — which answers only
   * where somebody signs in. Nothing here said WHAT they may do in the app, so the account minted
   * on sign-up held the app door open with no screens behind it and the app turned them away.
   *
   * Same controls as the invite form, in the same order, reading the same copy: a select for the
   * scope, a select for the console role when the scope reaches Portal, and the shared GrantPicker
   * with 세부 설정 behind it. Two doors that ask the same question have to ask it the same way, or
   * an administrator learns the answer twice.
   */
  const ut = T[lang];
  const allProjects = useVcaStore(s2 => s2.projects);
  const teams = useVcaStore(s2 => s2.teams);
  const allPresets = useVcaStore(s2 => s2.accessPresets);
  /* The row's project decides the team unless somebody says otherwise, which is the same rule
     activateRosterEntry applies when the field is absent. */
  const [pickedProject, setPickedProject] = useState(entry?.projectId ?? projectId);
  const projectTeam = allProjects.find(pr => pr.id === pickedProject)?.teamId ?? teams[0]?.id ?? "";
  const [teamId, setTeamId] = useState(entry?.teamId ?? projectTeam);
  const [accessMode, setAccessMode] = useState<AccessMode>(
    entry?.accessMode ?? (entry?.permission === "admin" ? "both" : "appOnly"));
  const [portalRole, setPortalRole] = useState<PortalPermission>(
    entry?.portalRole ?? (entry?.permission === "admin" ? "admin" : "admin"));
  const [grantChoice, setGrantChoice] = useState<string | null>(
    entry?.grantMode === "custom" ? "custom" : entry?.presetId ?? null);
  const [customActions, setCustomActions] = useState<AppAction[]>(entry?.appActions ?? []);
  const [grantEditor, setGrantEditor] = useState<GrantDraft | null>(null);
  const presets = useMemo(() => presetsForTeam(allPresets, teamId), [allPresets, teamId]);
  const chosenPreset = presets.find(pr => pr.id === grantChoice) ?? null;
  const shownActions = grantChoice === "custom" ? customActions : chosenPreset ? chosenPreset.actions : [];
  /* Portal-only rows grant no screens, so the question does not apply and cannot block the save. */
  const grantsNeeded = accessMode !== "portalOnly";
  const grantsChosen = !grantsNeeded || (grantChoice !== null && shownActions.length > 0);

  const canSubmit = name.trim().length > 0 && employeeId.trim().length > 0 && !!pickedProject && grantsChosen;

  /* PRESSING 커스텀 OPENS THE DETAILS PANEL, exactly as the invite form does — a press that
     visibly does nothing reads as the eight rows having gone missing. It carries the set that was
     on screen so switching from a preset starts there rather than at zero. */
  const chooseGrant = (id: string) => {
    setGrantChoice(id);
    if (id !== "custom") return;
    setGrantEditor({ choice: "custom", actions: shownActions });
  };

  /*
   * ONE SHAPE FOR BOTH WRITES, and `permission` DERIVED rather than asked.
   *
   * The two-value field is what the Excel import writes and what /register reads back, so it has
   * to keep meaning something — but this panel now knows the exact answer, so deriving it here is
   * what stops the coarse field and the exact fields from ever disagreeing. See RosterEntry.
   */
  const answers = () => ({
    projectId: pickedProject,
    teamId,
    accessMode,
    portalRole: accessMode === "appOnly" ? undefined : portalRole,
    permission: (accessMode !== "appOnly" && portalRole === "admin" ? "admin" : "operator") as "admin" | "operator",
    appActions: grantsNeeded ? shownActions : undefined,
    grantMode: (grantsNeeded ? (grantChoice === "custom" ? "custom" : "preset") : undefined) as "preset" | "custom" | undefined,
    presetId: grantsNeeded && grantChoice !== "custom" ? grantChoice ?? undefined : undefined,
  });

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      updateRosterEntry(entry.employeeId, {
        name: name.trim(),
        department: department.trim() || undefined,
        email: email.trim() || undefined,
        ...answers(),
      });
      showToast({ variant: "success", title: t.toastUpdatedTitle, desc: name.trim() });
      onClose();
      return;
    }
    const ok = addRosterEntry({
      name: name.trim(),
      employeeId: employeeId.trim(),
      department: department.trim() || undefined,
      email: email.trim() || undefined,
      ...answers(),
    });
    if (!ok) { setDuplicate(true); return; }
    showToast({ variant: "success", title: t.toastAddedTitle, desc: `${name.trim()} (${employeeId.trim()})` });
    onCreated?.(employeeId.trim());
    onClose();
  };

  /*
   * THE FORM MARKS WHAT IS REQUIRED, NOT WHAT IS OPTIONAL (owner, 2026-09-23: 다른 거에는 필수
   * 별표로 넣어 두는데 왜 여기만 선택 항목이라고 알려주고 있어? 공통으로 바꿔줘).
   *
   * This panel was the last one saying 「선택」 beside 부서 and 이메일 while every other panel in
   * Portal puts a red star on the fields that block the button. Two conventions in one console
   * means a reader has to work out which one a panel is using before they can read it — and the
   * two disagree about the same blank field, one calling it allowed and the other saying nothing.
   *
   * Required here is exactly what canSubmit tests: 이름 and 사번. 권한 gets no star either, because
   * it is two buttons with one already chosen — a star on a field that cannot be empty marks
   * nothing.
   */
  /* A BLOCK LABEL WITH THE MARK ADJACENT, like every other one in Portal (owner, 2026-09-23:
     이름 옆에 별표 사이 간격이 너무 넓어). It was a flex row with `gap: 4px` left over from the
     days when it also carried a 「선택」 hint, and the gap ADDED to RequiredMark's own 3px
     marginLeft — 7px where the rest of the console has 3. The mark is part of the label's text,
     not a second item beside it, so it sits in the text flow. */
  const label = (text: string, required?: boolean) => (
    <FormLabel as="span">
      {text}{required && <RequiredMark />}
    </FormLabel>
  );
  const inputStyle = FIELD_STYLE;

  return (
    <>
    <Drawer
      title={editing ? t.modalEditTitle : t.modalAddTitle}
      onClose={onClose}
      width="520px"
      /* While the details panel is up, Escape belongs to IT — the same arrangement the invite
         form uses. Two listeners would close this one out from under the editor. */
      escapeEnabled={grantEditor === null}
      footer={
        <>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!canSubmit}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-200)", color: canSubmit ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
            {t.save}
          </button>
        </>
      }
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          {label(t.fieldName, true)}
          <TextField value={name} onChange={setName} placeholder={t.fieldNamePlaceholder} autoFocus />
        </div>
        <div>
          {label(t.fieldEmployeeId, true)}
          <input
            value={employeeId}
            onChange={e => { setEmployeeId(e.target.value); setDuplicate(false); }}
            placeholder={t.fieldEmployeeIdPlaceholder}
            disabled={editing}
            style={{ ...inputStyle, backgroundColor: editing ? "var(--gray-50)" : "white", color: editing ? "var(--gray-500)" : "var(--gray-900)" }}
          />
          {editing && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--gray-400)" }}>{t.fieldEmployeeIdLocked}</p>}
          {duplicate && <p style={{ margin: "6px 0 0", fontSize: "11px", fontWeight: 700, color: "var(--danger-400)" }}>{t.duplicateId}</p>}
        </div>
        <div>
          {label(t.fieldDepartment)}
          <TextField value={department} onChange={setDepartment} placeholder={t.fieldDepartmentPlaceholder} />
        </div>
        <div>
          {label(t.fieldEmail)}
          <TextField value={email} onChange={setEmail} placeholder={t.fieldEmailPlaceholder} />
        </div>
        {/* WHERE THEY WORK. One project per roster row — the row IS the enrolment onto one site,
            and a code that let somebody into two sites would be a different object. Chips rather
            than a select so the count is visible: an installation with one project shows one chip
            and the answer is already made. */}
        <div>
          {label(ut.projectsLabel, true)}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {allProjects.filter(pr => pr.teamId === teamId).map(pr => {
              const active = pr.id === pickedProject;
              return (
                <button key={pr.id} type="button" onClick={() => setPickedProject(pr.id)}
                  style={{
                    padding: "8px 12px", borderRadius: "999px", cursor: "pointer",
                    border: active ? PICKED_LINE : BORDER,
                    backgroundColor: active ? PICKED_FILL : "white",
                    color: active ? "var(--gray-900)" : "var(--gray-600)",
                    fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
                  }}>
                  {pr.name}
                </button>
              );
            })}
          </div>
        </div>
        {/* HOW THEY GET IN. The same three the invite offers, read from the same copy — two doors
            asking one question have to offer the same answers. */}
        <div>
          {label(ut.accessLabel)}
          <FilterSelect
            value={accessMode}
            onChange={v => setAccessMode(v as AccessMode)}
            options={(["both", "appOnly", "portalOnly"] as AccessMode[]).map(m => ({ value: m, label: accessLabel(ut, m) }))}
          />
        </div>
        {accessMode !== "appOnly" && (
          <div>
            {label(ut.permissionLabel)}
            <FilterSelect value={portalRole} onChange={v => setPortalRole(v as PortalPermission)} options={consoleRoleOptions(ut)} />
          </div>
        )}
        {/* WHAT THEY MAY DO, after where and how — the invite's order, for the same reason: the two
            answers above decide this one. A Portal-only row has no app to grant screens in. */}
        <div>
          {label(ut.foldGrant, grantsNeeded)}
          {grantsNeeded ? (
            <GrantPicker
              presets={presets} choice={grantChoice} onChoice={chooseGrant}
              actions={shownActions}
              onToggleAction={aq => setCustomActions(prev => withAppActionDeps(prev.includes(aq) ? prev.filter(x => x !== aq) : [...prev, aq]))}
              compact={{ onOpenDetails: () => setGrantEditor({ choice: grantChoice, actions: shownActions }) }}
              hideTitle t={ut} />
          ) : (
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.6 }}>{ut.grantsPortalOnly}</p>
          )}
        </div>
        {/* LAST, LIKE THE INVITE. An account CAN be filed under another team, and a form that never
            shows the team would put somebody in the wrong one silently. */}
        <div>
          {label(ut.foldTeam)}
          <FilterSelect
            value={teamId}
            onChange={v => { setTeamId(v); if (allProjects.find(pr => pr.id === pickedProject)?.teamId !== v) { const first = allProjects.find(pr => pr.teamId === v); if (first) setPickedProject(first.id); } }}
            options={teams.map(o => ({ value: o.id, label: o.name }))} />
        </div>
        {!editing && <p style={{ margin: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{t.addNote}</p>}
      </div>
    </Drawer>
    {/* OVER THIS PANEL, NOT INSTEAD OF IT — the same editor the invite form and the account card
        open, so the four answers come out in one order at one width wherever they are asked. */}
    {grantEditor && (
      <AppGrantEditor
        nested
        presets={presets}
        initial={grantEditor}
        onClose={() => setGrantEditor(null)}
        onApply={d => {
          setGrantChoice(d.choice);
          if (d.choice === "custom") setCustomActions(d.actions);
          setGrantEditor(null);
        }}
      />
    )}
    </>
  );
}

function AppGrantModal({ user, onClose, onBack }: { user: PortalUser; onClose: () => void; onBack?: () => void }) {
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

  const initialChoice = useMemo(() => {
    // A preset that is no longer offered cannot be shown as selected — the radio would sit on
    // nothing and the locked list below would show an empty grant set for an account that holds
    // five screens. archiveAccessPreset already moves followers to custom, so this is a guard
    // against a state that should not arrive, not a case being handled.
    const following = user.grantMode === "preset" && user.presetId
      && presets.some(pr => pr.id === user.presetId);
    return following ? user.presetId ?? "custom" : "custom";
  }, [presets, user.grantMode, user.presetId]);

  /**
   * IS THERE ANYTHING TO WRITE? Against what is ON FILE, not against the draft's own start.
   *
   * The two are almost the same question and diverge in one real case: an account whose grants
   * were never marked either way can be switched to custom holding exactly the same actions, and
   * that IS a change — it stops a later preset edit reaching them. The editor's own `touched` is
   * the scrim's question, which is a different one.
   */
  const changed = (d: GrantDraft) => d.choice === "custom"
    ? user.grantMode !== "custom" || !sameActions(d.actions, held)
    : user.grantMode !== "preset" || user.presetId !== d.choice;

  const save = (d: GrantDraft) => {
    if (!changed(d)) return;
    if (d.choice !== "custom" && d.choice) {
      applyGrantPreset(user.id, d.choice);
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
        const next = d.actions.includes(action);
        if (next !== held.includes(action)) setAppGrant(user.id, action, next);
      });
    }
    // The app reads its grants when it loads, so this is what actually happens — not "revoked".
    showToast({ variant: "success", title: t.grantsSavedTitle, desc: t.grantsSavedDesc(user.name) });
    onClose();
  };

  return (
    <AppGrantEditor
      presets={presets}
      initial={{ choice: initialChoice, actions: held }}
      subtitle={t.grantsModalIntro(user.name)}
      /* Said before it happens rather than reported after. Following a preset means holding its
         grants, so hand-tuned values go — and only when they actually differ, or the warning
         becomes wallpaper on every preset switch. */
      warning={d => {
        if (d.choice === "custom" || user.grantMode !== "custom") return null;
        const pr = presets.find(x => x.id === d.choice);
        const set = pr ? grantsOfPreset(pr).appActions ?? [] : null;
        return set && !sameActions(set, held) ? t.grantsOverwriteWarning : null;
      }}
      blockedReason={d => changed(d) ? null : t.grantsUnchanged}
      /* Opened over the account card: `nested` puts ← in the header and turns the footer's first
         button into 뒤로, which lands back on the card instead of closing everything. */
      nested={!!onBack}
      onClose={onClose}
      onApply={save}
    />
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
    /*
      THE SHARED RIGHT-SIDE PANEL (2026-09-22). This is the console's reference table — three roles
      against three doors, plus the lines about app access — and it was read over the very screen
      it explains, a 560px card capped at 86vh with its own scrollbar. A panel keeps the accounts
      table visible beside it, which is the point of reading it at all: you are checking a row
      against the ladder. The Drawer's body is the scroll, so the cap goes with the card.
    */
    <Drawer title={t.guideTitle} onClose={onClose} width="560px"
      footer={<PanelPrimary onClick={onClose} label={t.guideClose} />}>
        <div style={{ padding: "4px 20px 0" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.guideLead}</p>
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

        <div style={{ height: "20px" }} />
    </Drawer>
  );
}

/**
 * The four lists of 사용자 및 권한, in rail order, with the words the rail puts on them.
 *
 * Exported because the header's trail names the open one (PortalShell), and a second copy of these
 * labels there would drift the first time one is renamed — which is exactly what happened to
 * 「명부 대기」 the day it became 「등록 대기」, and 「등록 대기」 the day it became 「가입 대기」.
 */
export type PeopleTab = "accounts" | "roster" | "groups" | "presets";
export const PEOPLE_TABS: { id: PeopleTab; half: PeopleHalf; label: { en: string; ko: string } }[] = [
  { id: "accounts", half: "users", label: { en: "Accounts", ko: "계정" } },
  { id: "roster", half: "users", label: { en: "Awaiting sign-up", ko: "가입 대기" } },
  /* Preset before group, the order the invite form asks them in (owner, 2026-09-23). */
  { id: "presets", half: "grants", label: { en: "App permission presets", ko: "앱 권한 프리셋" } },
  /*
   * 「권한」 IN THE NAME, because its sibling has it (owner, 2026-10-06: 카메라 그룹이라는 탭만
   * 봐도 이해가 바로 될까).
   *
   * Beside 「앱 권한 프리셋」, a tab called 「카메라 그룹」 reads as the other kind of grouping —
   * zones, a tidy-up of the register — and that is the exact misreading this screen has been
   * corrected for twice: the cards described geography while the thing they are for is granting.
   * The word was already chosen once (`peopleTabGroupsFor`: 「권한용 묶음」) and lost when the tab
   * descriptions came off on 2026-09-22. It belongs in the label, not in a line under it.
   */
  { id: "groups", half: "grants", label: { en: "Camera permission groups", ko: "카메라 권한 그룹" } },
];

/** Which rail row this page is standing under. See the note on the tab strip. */
export type PeopleHalf = "users" | "grants";

/**
 * THE ONE DOOR FOR ADDING A PERSON, AND THE TWO WAYS IN.
 *
 * A labelled button with a small menu rather than a panel: it is a two-way choice, and a
 * full-height panel to ask one question and then open another panel is a step the reader has to
 * pay for twice. Each option carries the line that tells them apart — the difference is whether
 * the person has a mail address, which is a fact about the person and not about our data model.
 *
 * An option they may not use stays visible with its reason on it, the way every other gated
 * control on this page does: a control that vanishes reads as a missing feature.
 */
function AddPersonMenu({ t, mayInvite, inviteReason, mayAddCode, codeReason, onMail, onCode }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  mayInvite: boolean;
  inviteReason: string;
  mayAddCode: boolean;
  codeReason?: string;
  onMail: () => void;
  onCode: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);
  /* Closes on a click anywhere else, like the other menus on this page. Pointerdown rather than
     click, so a press that starts outside cannot also land on whatever is underneath. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const option = (title: string, why: string, allowed: boolean, reason: string | undefined, run: () => void) => (
    <button type="button" key={title}
      onClick={() => { if (!allowed) return; setOpen(false); run(); }}
      title={allowed ? undefined : reason}
      style={{
        display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start",
        width: "100%", textAlign: "left", padding: "10px 12px", border: "none",
        background: "none", cursor: allowed ? "pointer" : "not-allowed", fontFamily: "inherit",
      }}>
      <span style={{ fontSize: "12.5px", fontWeight: 700, color: allowed ? "var(--gray-900)" : "var(--gray-400)" }}>{title}</span>
      <span style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{allowed ? why : reason}</span>
    </button>
  );

  return (
    <div ref={wrap} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.22" strokeLinecap="round"/></svg>
        {t.addPerson}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path d="M4 6l4 4 4-4" stroke="white" strokeWidth="1.87" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 50,
          width: "272px", backgroundColor: "white", border: BORDER, borderRadius: "10px",
          boxShadow: "var(--shadow-popover)", padding: "4px", display: "flex", flexDirection: "column",
        }}>
          {option(t.addPersonMail, t.addPersonMailWhy, mayInvite, inviteReason, onMail)}
          {option(t.addPersonCode, t.addPersonCodeWhy, mayAddCode, codeReason, onCode)}
        </div>
      )}
    </div>
  );
}

/**
 * One badge for every rung of the ladder, so a reader compares like with like down the column.
 *
 * THE WORDS ARE STATES, NOT ACTIONS (owner, 2026-09-23: 아직 발급 버튼이랑 코드 발급 버튼이
 * 남아 있는데). This column said 「코드 발급」 for "a code has been issued" — the exact words of
 * the BUTTON two columns to its left, which issues one. So the same phrase was an instruction on
 * one row and a receipt on the next, and the table looked like it was asking to be pressed twice.
 * 적어둠 · 발급됨 · 만료됨: each one is something that has happened.
 */
/* Tones rather than its own three colours — see StatusBadge in PortalShared. 「명부에 있음」 is
   the quiet case, 「코드 발급됨」 is waiting on a person, and an expired code is time passing. */
function StageBadge({ stage, t }: { stage: Stage; t: { stageRosterListed: string; stageCodeIssued: string; stageCodeExpired: string } }) {
  const meta: Record<"rosterListed" | "codeIssued" | "codeExpired", { label: string; tone: StatusTone }> = {
    rosterListed: { label: t.stageRosterListed, tone: "normal" },
    codeIssued: { label: t.stageCodeIssued, tone: "waiting" },
    codeExpired: { label: t.stageCodeExpired, tone: "fault" },
  };
  const m = meta[stage as "rosterListed" | "codeIssued" | "codeExpired"];
  if (!m) return null;
  return <StatusBadge tone={m.tone} label={m.label} />;
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
/**
 * Whether this account may search ANYWHERE in the app.
 *
 * ONE ACTION BECAME FOUR (2026-09-23). Searching used to be a single app-wide grant; it is now a
 * step on each screen that has one, plus the two screens that are nothing but a search. So the
 * row's 인물 검색 차단 menu item — a quick block that does not open the grants panel — asks
 * whether ANY of the four is held, and `setAppSearch(false)` clears all four.
 *
 * Reading only the old `personSearch` here was a silent lie for as long as it lasted: nothing
 * writes that action any more, so the menu would have reported every account as already blocked.
 */
function holdsSearch(u: PortalUser): boolean {
  const held = u.appActions ?? [];
  return (["liveMonitoringSearch", "reidSearch", "redface", "trail"] as AppAction[])
    .some(a => held.includes(a));
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
  users, onShowGuide, exceptions, statusFilter, onFilter, listState,
}: {
  /** Passed down so the figures follow the table under them — see SummaryStrip's `state`. */
  listState: ListState;
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
      ]} state={listState} />
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
        {/* Same rule as the strip above it: these are counts of the list that has not arrived, so
            while it is loading or failed the names stay and the figures go. The words are the part
            that is true either way — they say what the page counts, not how many. */}
        {roleGroups.map((g, i) => (
          <span key={g.name} style={{ display: "inline-block", marginLeft: i > 0 ? "18px" : 0 }}>
            <span style={{ color: "var(--gray-400)" }}>{g.name}&nbsp;</span>
            {g.counts.map(([label, count]) => `${label} ${listState === "ready" ? count : "—"}`).join(" · ")}
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
  /**
   * WHICH RAIL ROW THIS IS STANDING UNDER — 「사용자」 or 「권한」.
   *
   * One component serves both halves because the four lists share the page's data (the accounts
   * table, the roster, the presets and the groups all read the same project and team). Only the
   * strip and the default list differ, which is one prop rather than a second copy of a
   * 4,000-line page.
   */
  half?: PeopleHalf;
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

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * A list has four states (see PortalShared: rows · empty · loading · failed) and this tab can
 * only ever be in two of them today, because it reads the in-memory store synchronously: there
 * is no second where the rows are in the air, and no request that can come back 500.
 *
 * TWO TABLES, ONE SEAM, because 계정 and 가입 대기 are two tabs of one card and only one of
 * them is on screen at a time. When the two GETs land they write the same value from whichever
 * tab is showing; if the two ever have to be in different states at once, this splits per tab.
 *
 * WHAT REPLACES THIS: the GET for this list. `listState` becomes that request's own state —
 * "loading" while it is out, "failed" when it is rejected, "ready" once the rows are in — and
 * `retryList` becomes the refetch the failed state's button calls. Nothing below it changes:
 * the table already branches on these three words.
 *
 * The ?listState= override is the only reason this reads the URL at all. It is here so the two
 * states that are unreachable today can still be opened, seen and reviewed, and it is ONE line
 * to delete when the fetch lands. It is not a setting: nothing in Portal writes this parameter,
 * so nobody arrives at it by accident.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  // Until there is a request there is nothing to ask for again, so retrying can only drop the
  // override and show what the store holds. This call becomes the refetch.
  return [state, () => setState("ready")];
}

export default function PortalUsersPage({ projectId, onGoToCameras, half = "users" }: PortalUsersPageProps) {
  // Post-mount, like every other clock read in Portal — see TempPasswordBadge. Dormancy is a
  // judgement about elapsed time, so it cannot be decided during a server render.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const projects = useVcaStore(s => s.projects);
  const allTeams = useVcaStore(s => s.teams);
  const updatePortalUserPermission = useVcaStore(s => s.updatePortalUserPermission);
  const updatePortalUserAccess = useVcaStore(s => s.updatePortalUserAccess);
  const staffRoster = useVcaStore(s => s.staffRoster);
  const issueRegistrationCodes = useVcaStore(s => s.issueRegistrationCodes);
  const [listState, retryList] = useListState();
  const reissueRegistrationCode = useVcaStore(s => s.reissueRegistrationCode);
  const removeRosterEntry = useVcaStore(s => s.removeRosterEntry);
  const logRosterCodeViewed = useVcaStore(s => s.logRosterCodeViewed);
  const updatePortalUserStatus = useVcaStore(s => s.updatePortalUserStatus);
  const updatePortalUserProjects = useVcaStore(s => s.updatePortalUserProjects);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const suspendPortalUsers = useVcaStore(s => s.suspendPortalUsers);
  const [confirmingBulkSuspend, setConfirmingBulkSuspend] = useState(false);
  /** What a bulk write actually did, when it did not do all of it — see the panel at the end. */
  const [bulkResult, setBulkResult] = useState<{ done: number; refused: { name: string; reason: string }[] } | null>(null);
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
  /* The account whose login address is being changed, or null. Held as the user for the same
     reason as credentialFor. */
  const [changingEmailFor, setChangingEmailFor] = useState<PortalUser | null>(null);
  /** The invite links waiting to be handed over, or null. Held by the page, not by whatever made
   *  them: approving the last access request unmounts that panel. See InviteLinkPanel. */
  const [invitePanel, setInvitePanel] = useState<{ title: string; links: InviteLink[] } | null>(null);
  // The row whose Portal role, or whose doors, are being changed. Same reason as credentialFor:
  // the user, not an id.
  /* 「Portal 역할」과 「로그인」의 다이얼로그는 사라졌습니다 — 두 줄이 카드 안에서 직접
     답하고(select), 결과만 확인창이 묻습니다. See the `select` field on the card's row type. */
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
  /* THE NAMES BESIDE THAT NUMBER, FILTERED THE SAME WAY IT IS.
     This listed every group id the account holds, with no project filter, while `scopeCountFor`
     four lines up intersects — 다른 프로젝트 그룹이 숫자를 부풀리지 못하게. So the hover text
     printed 「0 / 3 · 오차드·부기스 라인」: a correct number next to the name of a group that
     reaches none of it, which reads as the one thing the account CAN open. A group survives here
     only if it contributes a camera the account could actually be scoped to; when none do, this
     is empty and the caller draws nothing. */
  const liveGroupsFor = (u: PortalUser) => {
    const scopable = new Set(scopableCamerasFor(u).map(c => c.id));
    return (u.cameraGroupIds ?? []).flatMap(id => {
      const g = cameraGroups.find(gr => gr.id === id);
      return g && g.cameraIds.some(cid => scopable.has(cid)) ? [g] : [];
    });
  };
  const groupNamesFor = (u: PortalUser) => liveGroupsFor(u).map(g => g.label).join(", ");
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
  /** `issueOnSave` is set only by the 「등록 코드로 추가」 door — see the note at the render. */
  const [rosterEditorFor, setRosterEditorFor] = useState<{ entry: RosterEntry | null; issueOnSave?: boolean } | null>(null);
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
  /*
   * THE SUB-TAB LIVES IN THE URL (owner, 2026-09-23: 헤더에도 사용자 및 권한까지만 표시되고
   * 있는데, 현재 보고 있는 등록 대기까지 표시해 줘야 정확히 인지할 수 있을 것 같아).
   *
   * The header's trail is built in PortalShell from `?tab=`, and it had no way to know which of
   * these four lists was open — so the crumb stopped at 사용자 및 권한 while the reader was two
   * levels down. Putting it in `?sub=` is what lets the bar name it, and it comes with two things
   * we wanted anyway: a reload keeps the list you were on, and the link you paste opens it.
   *
   * replaceState rather than router.replace: this is not a navigation, it is where you already
   * are, and pushing an entry per tab click would make Back walk the rail instead of leaving the
   * page. The `popstate` listener keeps the rail honest when the browser's own Back does move.
   */
  /* The half's first list is the default, and a `sub` naming a list from the OTHER half is
     ignored — the two halves are separate screens now, and honouring it would open 카메라 그룹
     under 「사용자」. See the note on the tab strip. */
  /** Where a grant tab puts its own action button — see the note on the tab strip. */
  const [tabActions, setTabActions] = useState<HTMLDivElement | null>(null);
  const firstOfHalf = PEOPLE_TABS.find(x => x.half === half)!.id;
  const [storedTab, setPeopleTab] = useState<PeopleTab>(() => {
    if (typeof window === "undefined") return firstOfHalf;
    const sub = new URL(window.location.href).searchParams.get("sub");
    return PEOPLE_TABS.some(x => x.id === sub && x.half === half) ? (sub as PeopleTab) : firstOfHalf;
  });
  /* DERIVED, NOT SYNCED. Switching rail rows re-mounts nothing, so a stored tab from the other
     half has to stop counting the moment the half changes — as a computed value rather than an
     effect that writes state back, which would render the wrong list once before correcting. */
  const peopleTab: PeopleTab = PEOPLE_TABS.find(x => x.id === storedTab)?.half === half ? storedTab : firstOfHalf;
  /* ALL FOUR, INCLUDING THE DEFAULT (owner, 2026-09-23: 헤더에 계정, 대기, 그룹, 프리셋 추가로
     옆에 보이게 해주는 건 왜 안 했어?). 계정 was left out of the URL as "the default", which is
     why the header named the other three and went quiet on that one — the bar can only see what
     the URL says. One of these four is always open, so the trail should always end on its name.
     A longer URL for the default view is the price, and it buys a link that says where it goes. */
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("sub", peopleTab);
    if (url.toString() !== window.location.href) window.history.replaceState(null, "", url.toString());
  }, [peopleTab]);
  useEffect(() => {
    const back = () => {
      const sub = new URL(window.location.href).searchParams.get("sub");
      setPeopleTab(PEOPLE_TABS.some(x => x.id === sub && x.half === half) ? (sub as PeopleTab) : firstOfHalf);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
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
  const cancelPortalUserEmailChange = useVcaStore(s => s.cancelPortalUserEmailChange);
  /* The domain accounts on this site live on — the same resolution the invite form makes, from the
     same helper, so a change of address is held to the rule a new address is held to. */
  const panelMailDomain = resolveMailConfig(projectId, projects, allTeams).mailDomain;

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
    /* The roster's own widths, 2026-09-23: the name column takes what 「가입 시 권한」 was spending
       on one word, because the name now carries the employee number beside it instead of under it.
       Measured before: name 268px over two lines, 권한 191px holding 「앱 사용자」, 코드 229px. */
    : "minmax(240px, 1.9fr) 0.62fr 1.3fr 0.7fr 36px";

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
  /* Which account row the pointer is on — the row is a control now and has to look like one. */
  const [hoverRow, setHoverRow] = useState<string | null>(null);
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
  /*
   * The chip that says how many filters are on and clears them (2026-09-29).
   *
   * This page was the one Portal table without it, and it is the one where a filter is hardest to
   * find again: `statusFilter` is set by pressing a CARD in the strip above, and the only way back
   * was to remember which card and press it a second time. The other tables already carry this
   * chip over the same kind of tile filter — the VIP registry's health cells, Input Sources' gap
   * chips, Server & API's. Search is not counted, here or there: the box shows its own text.
   */
  const tabFilterOn = peopleTab === "roster" ? rosterFilter !== "all" : scopeFilter !== "all";
  const activeFilterCount = (statusFilter ? 1 : 0) + (tabFilterOn ? 1 : 0);
  const clearFilters = () => { setStatusFilter(null); setRosterFilter("all"); setScopeFilter("all"); };
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
  /*
   * THE SEARCH IS NOT PART OF THIS COUNT (2026-09-23).
   *
   * It was: typing in the table's search box took the rail's 등록 대기 from 8 to 0, while the
   * status filters beside it deliberately did not — two rules for one idea, and the rail was the
   * one telling the lie. `projectUsers`, which feeds 계정, has never been filtered by either.
   *
   * The rule, stated once for the three readers of these lists: the rail and the summary say how
   * big the section is, so neither the search nor a filter touches them; the table shows what you
   * asked for; and an action that acts on rows acts on exactly the rows you can see (see
   * notIssuedIds below, which moved onto the visible set for that reason).
   */
  const rosterWaiting = projectRosterAll
    .filter(r => r.status !== "used" && !accountEmployeeIds.has(r.employeeId.toLowerCase()))
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
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q))
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
  /* On the VISIBLE rows, not on the section. A search for one person with 「코드 3개 발급」 beside
     it would mint codes for two people who are not on screen — the exact shape of "acts on an
     invisible set" this button was already criticised for. Now the number and the rows agree. */
  /**
   * WHAT 「가입 시 권한」 SAYS FOR ONE ROW — computed once, printed twice.
   *
   * The table and the CSV export were writing different answers about the same row: the table had
   * been taught to name the grant group, while the file still wrote the two-value field, so a row
   * the console marked red as 「권한 없음」 left the building as an ordinary 「앱 사용자」. A file is
   * the copy that gets forwarded, and it was the one telling the older lie.
   *
   * Two facts on one line: what they may do in the app, and whether Portal opens for them. Red
   * only where the app door opens onto nothing — a Portal-only row has no app grants BY DESIGN and
   * must not be marked as a mistake.
   */
  const rosterGrantCell = (entry: RosterEntry): { text: string; missing: boolean } => {
    const mode = entry.accessMode ?? (entry.permission === "admin" ? "both" : "appOnly");
    const pr = entry.presetId ? pagePresets.find(x => x.id === entry.presetId) ?? null : null;
    const grants = mode === "portalOnly" ? null
      : entry.grantMode === "custom" ? t.grantCustom
      : pr ? presetLabel(pr, lang)
      : null;
    /* The role the row actually carries, not the word 「관리자」 every time — a row saved as
       읽기 전용 관리자 used to say 「Portal 관리자」 while the account it creates comes out
       읽기 전용 관리자. The fallback is what activateRosterEntry uses when portalRole is absent. */
    const portalPart = mode === "appOnly" ? null
      : roleLabel(t, entry.portalRole ?? (entry.permission === "admin" ? "admin" : "none"));
    const text = [mode === "portalOnly" ? null : (grants ?? t.plannedNoGrants), portalPart]
      .filter(Boolean).join(" \u00b7 ");
    return { text, missing: mode !== "portalOnly" && !grants };
  };
  const rosterGrantText = (entry: RosterEntry) => rosterGrantCell(entry).text;

  const notIssuedIds = visibleRoster.filter(r => r.status === "not-issued").map(r => r.employeeId);
  const printableEntries = visibleRoster.filter(r => r.status === "unused" && r.code);

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
      {/*
        A TAB STRIP, BECAUSE THE RAIL WAS THE SECOND LIT COLUMN (owner, 2026-09-28: 다른 화면들은
        모두 화면 안에 메뉴 트리 UI가 상단에 나열된 형식인데 여기 권한 쪽만 갑자기 왼쪽 사이드바
        형식인데 갑자기 마우스가 길을 잃을 것 같아).

        What was actually happening, measured: the outer rail lit 「사용자 및 권한」 and 264px to its
        right this rail lit 계정 — two lit columns, which the settings page never produces because
        entering it lights nothing outside. The inner rail also held 204px of table width at all
        times, and below a 940px window the accounts table began to squeeze.

        30 screens on Mobbin: no product raises a rail inside a rail; the ones that mix put the rail
        outside and tabs inside, every time.

        So the four rows became two rail rows one level up (사용자 · 권한 — see ProjectSidebar) and
        each half shows its two lists in the strip 입력 소스 and VIP 등록 already use. The grouping
        the owner asked for on 2026-09-22 is not lost, it is PROMOTED: what was a caption over two
        rows is now a row in the menu, in the same two words.

        The counts come with the labels, where they were before the rail took them.
      */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0" }}>
      {/* STUCK TO THE TOP WHILE THE LIST SCROLLS (owner, 2026-09-29: 표 머리를 스크롤에 붙여두는
          쪽이 맞습니다 / 카메라그룹에서도 동일하게 스크롤에 붙여줘).
          
          This line carries the tab's ACTIONS as well as its names — 편집 and 프리셋 만들기 on one
          tab, 새 그룹 on the other — and both act on the whole list under it. Reading the bottom of
          a long preset table and then having to scroll back up to press 편집 is the complaint; the
          answer is not to move the button into the table (inside it, a control that edits every
          column would read as editing one) but to keep the line it lives on in reach.
          
          The background is opaque on purpose — rows pass underneath it — and it is the PAGE's
          ground, not white (owner, 2026-09-29: 여기 갑자기 배경에 흰색이 깔렸어). White drew a
          band across the page, so making the line sticky also made it visible, which it never
          should have been. MEASURED TWICE: the ground here is --primary-50 (#fafaff), not the
          body's gray-50 — a gray-50 band read as a grey stripe against it (owner: 여기 배경
          회색이 살짝 보이는데?). Sampled with elementFromPoint just above the line. */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "var(--primary-50)", display: "flex", alignItems: "flex-end", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {PEOPLE_TABS.filter(x => x.half === half).map(x => {
          const active = peopleTab === x.id;
          const count = x.id === "accounts" ? projectUsers.length
            : x.id === "roster" ? rosterWaiting.length
            : x.id === "presets" ? pagePresets.length
            : cameraGroupsInProject(cameraGroups, projectId).length;
          return (
            <button key={x.id} type="button" onClick={() => setPeopleTab(x.id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}>
              {x.label[lang]}
              {/* The two people tabs count the list this page loads, so they go quiet with it —
                  same rule as the strip and the caption below. 프리셋 and 카메라 그룹 count their
                  own store and are not part of that request, so their figures stay. */}
              {(x.id === "accounts" || x.id === "roster") && listState !== "ready" ? null : (
                <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>{count}</span>
              )}
            </button>
          );
        })}
        {/*
          THE TAB'S OWN ACTION, AT THE END OF THE TAB LINE (owner, 2026-09-28: 편집이랑
          프리셋만들기 버튼 옆에 아무것도 없어서 빈공간이 덩그러니있는뎅..).
          
          Both grant tabs used to open with a 50px strip of their own holding two right-aligned
          buttons and nothing else — the button sat in mid-air over a wide empty band. The space
          it wanted was already here: this line carries two short tab names and is empty from
          about 400px rightward. Tabs on the left, the action on the right, is what the rest of
          this console's list screens do.
          
          Filled by the tab itself through a portal rather than by lifting `creating`/`editing`
          state up here — the button belongs to the list that owns the panel it opens, and the
          only thing that has to be shared is where it lands.
        */}
        <div ref={setTabActions} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", paddingBottom: "6px" }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
      {peopleTab === "presets" ? <AccessPresetsTab teamId={pageTeamId ?? ""} canEdit={manageAccess} actionsSlot={tabActions} />
        : peopleTab === "groups" ? <CameraGroupsTab projectId={projectId} onGoToCameras={onGoToCameras} actionsSlot={tabActions} /> : (<>
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
          listState={listState}
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
          /* 「미발급」 is offered only if a codeless row is actually here (2026-09-23). The console
             cannot create one any more — both add paths issue on save — so on an ordinary
             installation this choice would narrow the table to nothing, and a filter that can only
             ever return an empty table is a control that lies about what the list holds. It stays
             available for a row the SERVER hands over with no code, which the contract still
             allows. */
          options={[
            { value: "all", label: t.rosterFilterAll },
            ...(rosterWaiting.some(r => r.status === "not-issued")
              ? [{ value: "not-issued", label: t.rosterFilterNotIssued }]
              : []),
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
      <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} />

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
          {/*
            ONE DOOR, AND IT ASKS HOW THEY GET IN (owner, 2026-09-23: 각각 초대하는 게 있는데 그
            차이를 모를 수 있을 것 같아 해결해야 해).

            There were two: 「사용자 초대」 on the accounts tab and 「명부에 추가」 on the other, and
            choosing between them meant already knowing which list a person belongs in — a question
            nobody can answer before they know what the lists are. Ten member screens on Mobbin
            (Upwork, Canva, Clerk, Fiverr, Productboard, User Interviews, Midday, Krea, Juicebox,
            Profound) have exactly ONE invite control between them; not one has two.

            So the choice moves inside, where it can be a question with an answerable answer: does
            this person have an address. Same reasoning as the invite panel's own ordering — the
            answer that decides the others is asked first. Picking the code path also switches to
            the list the row will land in, so the result is never somewhere you were not looking.
          */}
          {/*
            THE DOOR LIVES ON 계정 ONLY (owner, 2026-09-23: 가입 대기라는 타이틀만 봤을 때는
            대기 중인 명단만 있어야 할 것 같거든, 그래서 초대하고 코드 발급 자체는 모두 계정
            화면에서 해야 할 것만 같아).

            Right, and it draws the line in the words themselves: 가입 대기 is a list of people
            waiting, so it holds the things you do TO a row that is already there — issue or reissue
            that person's code, edit them, take them off. Making a person is a different act and it
            belongs where the outcome is administered. Choosing the code path still carries the
            reader to 가입 대기, so the new row is never left on a list they were not looking at.

            It also fixes something that was measured: the same button sat at (1283, 176) on 계정
            and (1123, 64) on 가입 대기, because the two toolbars hold a different number of
            controls and wrapped differently — a primary action that jumps 160px sideways between
            two tabs does not read as the same button.

            The CSV import stays on 가입 대기, in its ⋮ menu: it is a tool of the list it fills,
            not the one-person door, and it is not a primary action there.
          */}
          {peopleTab === "accounts" && (
          <AddPersonMenu
            t={t}
            mayInvite={manageAccess} inviteReason={t.reasonNotOwner}
            mayAddCode={mayEdit} codeReason={readOnlyReason}
            onMail={() => { setPeopleTab("accounts"); setShowInvite(true); }}
            onCode={() => { setPeopleTab("roster"); setRosterEditorFor({ entry: null, issueOnSave: true }); }}
          />
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
          <RowActionsMenu
            variant="toolbar"
            actions={[
              { label: t.importRoster, onClick: () => setShowRosterImport(true), disabled: !mayEdit, reason: readOnlyReason },
              /* Export and Print stay reachable for a read-only account: handing the roster over
                 as a file or a sheet is reading it, not changing it, and it is most of what that
                 role is for. They grey out only when there is nothing to hand over. */
              { label: t.exportRoster, onClick: () => {
                  const n = exportRosterCsv(projectRosterAll, currentProject?.name ?? projectId, rt, rosterGrantText);
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
            {t.bulkSuspendBar(bulkSuspendTargets.length, filteredUsers.length)}
          </span>
          {bulkSuspendKept > 0 && (
            <span style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.bulkSuspendKept(bulkSuspendKept)}</span>
          )}
          <button className="portal-btn-outline" onClick={() => setConfirmingBulkSuspend(true)}
            style={{ marginLeft: "auto", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {/* The count again, not "Suspend all shown": with the bar saying 3 of 5, a button
                offering "all shown" is the discarded claim coming back one control to the right.
                Same string the confirm dialog's own button uses, so the number the reader presses
                here is the number they are asked to confirm. */}
            {t.bulkSuspendCta(bulkSuspendTargets.length)}
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
            /*
             * A PARTIAL RESULT GETS A SCREEN, not a number in a toast.
             *
             * This said 「9명 정지됨」 and dropped the other three on the floor — which three, and
             * why, had nowhere to be. A bulk write against a real server half-succeeds as a matter
             * of course, so the place has to exist before the server does. A toast is wrong for it
             * twice over: it leaves after five seconds, and it cannot hold a list.
             */
            if (refused.length > 0) {
              setBulkResult({
                done,
                refused: refused.map(r => ({
                  name: bulkSuspendTargets.find(u => u.id === r.id)?.name ?? r.id,
                  reason: r.reason === "lastAdmin" ? t.bulkRefusedLastAdmin : t.bulkRefusedAlready,
                })),
              });
              return;
            }
            showToast({ variant: "success", title: t.bulkSuspendedToast(done) });
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

      {/*
        WHAT THIS LIST IS, SAID ONCE (owner, 2026-09-23: 명부 대기랑 계정이랑 두 가지 차이를 바로
        보고 모를 수 있을 것 같아).

        The one fact neither list can show is that these rows BECOME the rows in 계정 — a person
        here has no account until somebody hands them a code and they use it. Two strings for this
        existed in the dictionary and neither had ever been rendered, so the tab explained nothing.
        On the roster tab only: 계정 needs no explanation, its rows are accounts.
      */}
      {peopleTab === "roster" && (
        <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginBottom: "10px" }}>
          {t.peopleTabRosterHint}
        </p>
      )}

      {/* No overflow:hidden here — it used to clip the header row's flat corners to match the
          card's rounded ones, but that also clips any row's RowActionsMenu dropdown that opens
          past the container's bottom edge (invisible, not just cut off). Radius the header row
          itself instead. */}
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        {/* Column widths, and why they are these: the two columns that are usually "—" (Person
            Search, MFA) and Status, whose badge is a word, were each wider than their content, and
            the width had to come from somewhere — it came from Team and Projects, which are the
            long names, so on a narrow window they wrapped to three lines while Status sat in a
            cell with a hand's width of nothing to its right. Narrowing those three moves Status
            right, up against the actions menu where it belongs, and gives the names their room
            back. */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
          {/* Projects and MFA carry no sortKey: a user belongs to several projects, so there is no
              single value to order by, and MFA is display-only mock data it would be misleading to
              let anyone rank people with. */}
          {((showAccountColumns ? [
            { label: t.colUser, key: "name" },
            /* Before what they may do: a suspended account makes every grant on the row
               hypothetical, and that has to be known at the name. */
            { label: t.colStatus, key: "status" },
            /*
             * NOT SETTLED: 「권한」 IS TWO DIFFERENT THINGS ON THIS PAGE.
             *
             * This column header means sign-in scope AND the preset together (it prints both, one
             * per line). The invite form's field labelled 권한 means the preset/custom answer
             * only. Same word, two sizes of thing, on one screen.
             *
             * Left alone deliberately when the invite was thinned out (2026-09-23): renaming the
             * header reaches the count strip above the table and the filter that strip drives, so
             * it is its own change with its own measuring, not a rider on this one.
             */
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
        {/* Only the rows change: the column headings above, the two tabs and the toolbar above
            them all stay, because they are still true while the answer is on its way. */}
        {listState === "loading" && <TableSkeleton grid={GRID} />}
        {listState === "failed" && <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />}
        {/* Per tab: each half answers for itself, and neither can speak for the other's rows.
            "Nothing matches what you asked for" and "there is nothing here" send the reader to
            two different places, and one message for both sends half of them wrong.

            AND NEITHER SPEAKS FOR A LIST THAT HAS NOT ARRIVED — which is why listState is asked
            first. "No users have access to this project yet" is a statement about who may sign
            in; read off a request that has not answered, it gets somebody invited who is already
            here. */}
        {listState === "ready" && (peopleTab === "accounts" ? scopedUsers.length : visibleRoster.length) === 0 && (
          <TableEmpty text={narrowed ? t.emptyFiltered : peopleTab === "accounts" ? t.emptyNoUsers : t.rosterEmpty} />
        )}
        {(listState === "ready" && peopleTab === "accounts" ? scopedUsers : []).map((u, i) => {
          const isLast = i === scopedUsers.length - 1;
          // Computed against the whole user list, not the filtered view: a project filter can hide
          // the other administrators, and "last one visible" is not "last one there is".
          const lastAdmin = isLastActiveAdmin(portalUsers, u.id);
          return (
          /*
           * THE ROW IS THE DOOR (owner, 2026-09-28: 표에 점점점 누르면 바로 열리잖아, 근데 보통
           * 점점점 같은 아이콘은 누르면 드롭다운이 열려야 할 것 같은 느낌이란 말이지? 나만 그래?).
           *
           * Not just them. Counted in this console: ⋯ appears in eleven places and opens a dropdown
           * in ten of them — this table was the one exception. The worst part was next door: 계정
           * and 가입 대기 are the same table one tab apart, their ⋯ buttons are identical and sit at
           * the same x, and one opened a panel while the other opened a menu.
           *
           * 12 products on Mobbin whose table rows carry ⋯ (Ditto, Cal.com, Retool, Whop, Attio,
           * Sprig, Churnkey, Lightfield, ClickUp, Vapi, Zapier, Amplitude): not one opens a panel
           * with it. The ones that offer both split it the same way — the row opens the detail, ⋯
           * lists that row's short actions.
           *
           * Measured before: the row was 1142x59 and inert (no cursor, no hover, no keyboard), and
           * the only way in was a 24px button — 0.85% of the row. Input Sources and VIP Registry
           * already make their rows openable, so the answer was already in the repo.
           *
           * A div with a role rather than a <button>: the row holds its own buttons (the repair
           * link in the 접근 cell), and a button inside a button is not valid HTML.
           */
          <div key={u.id} role="button" tabIndex={0}
            onClick={e => { if (!(e.target as HTMLElement).closest("button,a")) setManaging(u); }}
            onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setManaging(u); } }}
            onMouseEnter={() => setHoverRow(u.id)} onMouseLeave={() => setHoverRow(null)}
            aria-label={t.manageAccount}
            style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
            borderBottom: isLast ? "none" : TABLE_RULE,
            borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
            cursor: "pointer", backgroundColor: hoverRow === u.id ? "var(--gray-50)" : "transparent",
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
              <AccountStatusBadge status={u.status} />
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
                  {/*
                    IT MAY TAKE TWO LINES RATHER THAN LEAVE THE COLUMN (2026-09-30).

                    Measured at 1024x768: this chip wants 119px and the 접근 track gives it 96
                    (David Ong) or 102 (Wei Chen), and it was `flexShrink: 0` with `nowrap` in a
                    cell whose wrapper has `minWidth: 0` — so it simply drew past its own column
                    and over 카메라 next door. On screen that read as one word:
                    「No app permissionsAll」.

                    Not an ellipsis: this is the line that says the account reaches nothing, and
                    「No app permis…」 is the sentence losing the half that carries it. Not a wider
                    column either — the widths are shared with 1280 and 1440, where all of this
                    already fits on one line, and a track sized for the narrowest window is width
                    taken from the names at every other one. The pill wraps instead, which costs
                    a row 12px of height on exactly the rows that have something wrong with them.

                    `alignItems: flex-start` so the mark stays on the FIRST line rather than
                    centring itself against a two-line block, and the radius comes off 999px —
                    a stadium round a two-line label is a lozenge, 9px is a chip either way.
                  */}
                  <span style={{
                    display: "inline-flex", alignItems: "flex-start", gap: "4px",
                    maxWidth: "100%", minHeight: "18px", padding: "2px 8px", borderRadius: "9px",
                    backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
                    fontSize: "10px", fontWeight: 600, lineHeight: "14px",
                  }}>
                    <MonitorOff size={11} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: "1px" }} />
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
                /*
                  THE PRESET NAME GETS THE LINE BEFORE THE CHIP GETS ANY (2026-09-30).

                  Two items on one line, one of them `flexShrink: 0`: at 1024x768 the 접근 track
                  is 103px, 「Investigator」 wants 56 and 「Person Search」 keeps its whole 76, so
                  the preset was squeezed to 20px and rendered 「In…」 — the name of the thing that
                  decides what this person sees, reduced to two letters, while a secondary mark
                  beside it stayed whole.

                  `flexWrap` rather than letting the chip shrink too: the chip is a fixed phrase
                  that means nothing clipped, and the preset name is the one of the two worth
                  reading first. Wrapping puts the chip on its own line only when both will not
                  fit — at 1280 and 1440 they still share one, which is where this was already
                  right.
                */
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 6px", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {(u.grantMode === "preset" && u.presetId && presetLabelById.get(u.presetId)) || t.grantCustom}
                  </span>
                  {holdsSearch(u) && (
                    /* Neutral, not blue. Blue means 「waiting on a person」 in this console since
                       the tones were unified, and this chip is not a state at all — it is a
                       capability the account holds. It was also the only info-blue on the page,
                       which made a secondary fact the loudest thing in the table. */
                    <span title={t.colAppSearch} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "999px", backgroundColor: "var(--gray-100)", color: "var(--gray-600)", fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap" }}>
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
                      which is the correct silence: nothing about it will move on its own.

                      COUNTED THE WAY THE NAMES BESIDE IT ARE (liveGroupsFor), not off the stored
                      ids. It read `cameraGroupIds.length`, which counts a group that reaches
                      nothing this account could be scoped to — another site's group, or one
                      emptied since it was given. So the figure said 「3 / 62」 and the mark under
                      it said 「그룹 1」 about a group contributing none of the three, while the
                      hover text — same account, same cell — listed no group at all, because
                      groupNamesFor had already been corrected to intersect. The mark exists to
                      answer 「이 숫자가 저절로 늘어나는가」, and a group that reaches nothing here
                      is not the channel it will grow through. */}
                  {liveGroupsFor(u).length > 0 && (
                    <span title={t.camerasFromGroupsTitle}
                      style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>
                      {t.camerasFromGroups(liveGroupsFor(u).length)}
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
            {/* A MARK, NOT A BUTTON. The row is the control now, so this says "this opens" and
                takes no click of its own — aria-hidden because the row already carries the label. */}
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true"
              style={{ justifySelf: "end", color: hoverRow === u.id ? "var(--gray-500)" : "var(--gray-300)" }} />
          </div>
          );
        })}

        {(listState === "ready" && peopleTab === "roster" ? visibleRoster : []).map((entry, i) => {
          const isLast = i === visibleRoster.length - 1;
          const stage = stageOfRosterEntry(entry.status);
          return (
            <div key={entry.employeeId} style={{
              display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
              borderBottom: isLast ? "none" : TABLE_RULE,
              borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
            }}>
              {/*
                ONE LINE, NOT TWO (owner, 2026-09-23: 기본 사용자가 두 줄인데 한 줄로 넣으면 안
                되는 거지? 가입 시 권한 가로폭을 좀 좁히면 괜찮을 것 같은데).

                The number sat under the name, so EVERY row was two lines tall — 59px each, with
                the 「가입 시 권한」 column beside it spending 191px on the single word 「앱 사용자」.
                Side by side they fit, and the width comes from that column (see GRID).

                The number is still not an address: a roster row often has no address at all, which
                is the reason this path exists, and the number is what the code is handed over
                against. It keeps its own colour so the pair reads as a name and a receipt rather
                than as one long string.
              */}
              <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: "8px" }}>
                <p title={entry.name} style={{ flexShrink: 0, maxWidth: "58%", fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</p>
                <p title={entry.email || entry.employeeId} style={{ minWidth: 0, fontSize: "12px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.email || entry.employeeId}</p>
              </div>
                  {/*
                    WHAT THEY ACTUALLY ARRIVE WITH (2026-09-28).

                    This cell said 「앱 사용자」 for every row that was not a Portal admin, which is
                    the sign-in scope, not a permission — and it was the only thing on screen
                    describing what the person gets. Meanwhile the account minted on sign-up held
                    the app door open with NO screens behind it, so the row promised an app user
                    and delivered one the app turns away at the door.

                    Now it names the grant group the row carries, because that is the answer to
                    「가입 시 권한」. A row from the Excel import carries none — the spreadsheet has
                    no column for it — and that says so in red rather than pretending: the code can
                    still be handed over, and the administrator can see, before it is used, that
                    this person will arrive at nothing.
                  */}
                  {(() => {
                    const { text, missing } = rosterGrantCell(entry);
                    return (
                      <span title={text} style={{ fontSize: "12px", fontWeight: missing ? 700 : 400, color: missing ? "var(--danger-500)" : "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", minWidth: 0 }}>
                        {text}
                      </span>
                    );
                  })()}
                  <div style={{ minWidth: 0 }}>
                    {/* 「방금 발급」 MOVED HERE FROM THE NAME (owner: 이름 아래 방금 발급이
                        추가되니까 얘만 높이가 너무 두꺼워져서 어색해 보여 · 방금 발급 태그를
                        등록 코드 옆에 놔도 될 것 같고). Under the name it made that one row a third
                        line — 83px against everybody else's 59 — and the row you had just acted on
                        was the one that looked broken. Beside the code it is on the line it is
                        about: the code this mark says is new. */}
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
        /*
          THE CODE COMES WITH THE PERSON (owner, 2026-09-23: 계정에서 코드 발급으로 초대하면
          코드는 자동으로 발급되게 하면 안 돼?).

          Right: choosing 「등록 코드로 추가」 has already said what this person gets. Leaving the
          row at 미발급 meant the administrator finished a panel and then had to find that row and
          press 코드 발급 — a second decision about a question they had answered before they
          started typing. So the door issues it on save and marks the row 「방금 발급」, which is
          what unmasks the code for reading out (see RosterCodeCell's justIssued).

          Only from that door. Opening the same panel from a row's 수정 issues nothing: there, the
          code is not what was asked about, and minting one would be a live credential created as a
          side effect.
        */
        <RosterEntryModal entry={rosterEditorFor.entry} projectId={projectId}
          onCreated={rosterEditorFor.issueOnSave ? id => { issueRegistrationCodes([id]); setJustIssuedFor(id); } : undefined}
          onClose={() => setRosterEditorFor(null)} t={rt} />
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
        /*
         * READ THE ACCOUNT FROM THE STORE, NOT FROM THE CLICK (owner, 2026-09-28: 가운데 팝업이
         * 뜨고 변경 버튼을 누르면 오른쪽 팝업에 정보가 바뀌거나 패널이 닫히고 표에서 정보가
         * 바껴야할것같은뎅).
         *
         * `managing` is the row object as it was when the row was pressed. Every write this panel
         * makes — the Portal role, the login scope, a grant — goes to the store, and the table
         * behind picked those up because it reads the store; this panel kept redrawing the
         * snapshot. So the confirm said "takes effect at once" and the card it was opened from
         * went on showing the old value, which is the screen contradicting its own dialog.
         *
         * Falls back to the snapshot only if the row is gone from the list, which is the removal
         * path — and that one closes the panel itself.
         */
        const mu = portalUsers.find(u => u.id === managing.id) ?? managing;
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
        /*
          WHICH CAMERAS, NOT HOW MANY (owner, 2026-10-06: 지도를 표현해주고싶은데).

          It rides directly under the 카메라 row, because that row says 「3 / 62」 and this is the
          half of that answer a number cannot carry — whether the three sit on one street or on
          three sides of the site. It sat at the foot of the card first, below 계정, and the owner's
          first question on seeing it was where it opens: a picture 300px and one scroll away from
          the line it explains is a second thing to find rather than an answer to the first.

          ONE COLOUR, AND THE REST IN WORDS. Painting a colour per group is the obvious design and
          it breaks for the reason the camera-groups map broke: the ramp has six steps and the
          product does not cap how many groups an account may hold (owner, 2026-10-06: 한 사람한테
          카메라 그룹 하나만 부여된다는 보장은 없어). So the map says the one thing true at any
          number — reachable or not — and a pressed dot names the group that puts it there.

          Only for a NARROWED account: 「전부」 in the row above is already the whole answer, and a
          map with every dot lit is the register's map wearing this panel's heading.
        */
        const scopeMap = mu.appAccess && scopeCountFor(mu) !== null ? (() => {
          const scopable = scopableCamerasFor(mu);
          const allowed = scopedCameraIds(mu, cameraGroups) ?? new Set<string>();
          const held = (mu.cameraGroupIds ?? [])
            .map(id => cameraGroups.find(g => g.id === id))
            .filter((g): g is NonNullable<typeof g> => !!g);
          return (
            <div style={{ padding: "2px 12px 8px" }}>
              {/* 240, down from 300: the frame holds the account's own cameras now, not the site,
                  so the extra height was empty tiles. The edge went with the group's tint — one
                  surface, not three. */}
              <div style={{ height: "240px", borderRadius: CARD_RADIUS, overflow: "hidden" }}>
                <CameraMapView
                  cameras={scopable}
                  fill
                  /* Framed on what the account reaches, not on the whole site. MEASURED when it
                     fitted everything: 61 dots at 12px in a 477px map, 22 of them covered by a
                     neighbour — and one of the three the account could see was underneath a grey
                     one, which is the single dot the picture exists for. */
                  fitTo={[...allowed]}
                  selectedIds={NO_SELECTION}
                  onToggleSelect={NO_PICKING}
                  tintOf={id => (allowed.has(id) ? "var(--primary-400)" : "var(--gray-300)")}
                  noteOf={id => {
                    if (!allowed.has(id)) return t.scopeMapNotVisible;
                    const via = held.filter(g => g.cameraIds.includes(id)).map(g => `\u201c${g.label}\u201d`);
                    const parts: string[] = [];
                    if (via.length) parts.push(t.scopeMapVia(via.join(t.scopeMapAnd)));
                    if ((mu.cameraIds ?? []).includes(id)) parts.push(t.scopeMapPicked);
                    return parts.join(t.scopeMapAnd) || null;
                  }}
                />
              </div>
            </div>
          );
        })() : null;

        const rows: {
          key: string; group: "where" | "what"; label: string; value: string;
          /** The one value printed large. See the door row for why it is that one. */
          hero?: boolean;
          disabled?: boolean; reason?: string; onClick?: () => void;
          /**
           * ANSWERED IN THE CARD, NOT IN A DIALOG ACROSS THE SCREEN (owner, 2026-09-28: 여기에
           * 변경 가능한 버튼들 누르면 중앙에 팝업창이 열리는데 마우스 이동을 크게 해야 해서 너무
           * 불편해, 이 안에서 수정할 수 있게 바꿔줘).
           *
           * For the two rows whose answer is one of three short options, the value IS the control:
           * the row carries a select and changing it asks for confirmation on the spot. The
           * confirmation stays — it is where the consequence sentence lives ("a higher role can
           * hand out and take away other people's access"), and that sentence is the reason those
           * dialogs existed. What is gone is the dialog you had to open just to see the options.
           *
           * Only where the options are few and named. 앱 권한 and 카메라 keep a panel of their own —
           * eight rows with steps, and sixty-two cameras, do not belong inside a 520px card.
           */
          select?: { value: string; options: { value: string; label: string; description?: string }[]; onPick: (v: string) => void };
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
            select: {
              value: mu.permission,
              options: consoleRoleOptions(t),
              onPick: v => setConfirming({
                title: t.confirmRoleTitle(mu.name),
                body: t.confirmRoleBody,
                confirmLabel: t.changeApply,
                onConfirm: () => updatePortalUserPermission(mu.id, v as PortalPermission),
              }),
            },
          },
          {
            key: "access", group: "where",
            /* The invite form asks it as a question ("어디로 로그인하나"); a card of current
               values states it as a thing. Same axis name as the count line again. */
            label: t.axisDoor,
            /*
             * THE ONE VALUE AT 15px, BECAUSE IT IS THE SECOND QUESTION THE CARD ANSWERS.
             *
             * After who this person is, the thing the reader opened the card for is whether they
             * can get in at all — and which door, since every row in 할 수 있는 일 below is
             * hypothetical without one. Printed at the same 12px as the other four it was
             * findable but not first; the status badge beside the name says whether the account
             * works, this says where it works. Same idea as Revolut Business's member panel,
             * where the role sits alone above the rest of the list.
             */
            hero: true,
            value: accessLabel(t, accessModeOf(mu)),
            disabled: !manageAccess,
            reason: manageAccess ? undefined : t.reasonNotOwner,
            select: {
              value: accessModeOf(mu),
              /* App-only would strip Portal from the last owner, which the store refuses on the
                 same guard — so it is not offered rather than offered and ignored. */
              options: lastAdmin ? accessOptions(t).filter(o => o.value !== "appOnly") : accessOptions(t),
              onPick: v => setConfirming({
                title: t.confirmAccessTitle(mu.name),
                body: t.confirmAccessBody,
                confirmLabel: t.changeApply,
                onConfirm: () => {
                  const next = applyAccessMode(v as AccessMode, mu.permission);
                  updatePortalUserAccess(mu.id, next.permission, next.appAccess);
                  /* Say it when the change quietly hands out a Portal role nobody picked. */
                  if (!canEnterPortal(mu.permission) && canEnterPortal(next.permission)) {
                    showToast({ variant: "info", title: accessLabel(t, v as AccessMode), desc: t.accessGainsRoleNote(roleLabel(t, next.permission)) });
                  }
                },
              }),
            },
          },
          {
            key: "grants", group: "what",
            label: t.panelGrants,
            value: !mu.appAccess ? t.panelNoApp
              : lacksAppScreens(mu) ? t.grantsHeldNone
              : (mu.grantMode === "preset" && mu.presetId && presetLabelById.get(mu.presetId)) || t.grantCustom,
            disabled: !manageAccess || !mu.appAccess,
            reason: !manageAccess ? t.reasonNotOwner : !mu.appAccess ? t.reasonNoAppScreens : undefined,
            /* No close() — the editor opens OVER the card so ← 뒤로 and 취소 have somewhere
               to go back to (owner, 2026-09-28: 뒤로가기가 없고 엑스를 누르니까 패널이 아예
               꺼지는데 · 아래 취소 누르면 패널 안에서 뒤로 가게 해 줘). */
            onClick: () => setChangingGrantsFor(mu),
          },
          {
            key: "cameras", group: "what",
            label: t.colCameras,
            /*
             * THE GROUPS BY NAME, NOT ONLY THE NUMBER (owner, 2026-10-06: 유저탭에서 어느 카메라
             * 그룹을 사용하는지 유저상세에서는 볼수있는거지?).
             *
             * It could not be. The name lived in the table row's `title` — a hover, invisible on
             * touch and unreadable at a glance — and this panel said 「3 / 62」 and nothing else.
             * That mattered more the moment the group card stopped naming its holders: the two
             * directions of one fact are "who holds this group" and "which groups does this
             * account hold", and the console now answers the first from the account's own row, so
             * the second has to be on the account's own card. /mypage has shown the holder exactly
             * this sentence about themselves since 6c53ee6; this is the console's side of it.
             *
             * Only groups that actually give this account a camera it can reach — the same
             * intersection the count uses, so the names and the number cannot disagree.
             */
            value: !mu.appAccess ? t.panelNoApp
              : scopeCountFor(mu) === null ? t.camerasAll
              : [t.camerasSome(scopeCountFor(mu) ?? 0, scopableCamerasFor(mu).length),
                 groupNamesFor(mu) ? t.camerasVia(groupNamesFor(mu)) : ""].filter(Boolean).join(" · "),
            disabled: !manageAccess || !mu.appAccess || scopableCamerasFor(mu).length === 0,
            reason: !manageAccess ? t.reasonNotOwner
              : !mu.appAccess ? t.reasonNoScopeWithoutApp
              : scopableCamerasFor(mu).length === 0 ? t.reasonNoCamerasToScope : undefined,
            /* No close() — the editor opens OVER the card so ← 뒤로 and 취소 have somewhere
               to go back to (owner, 2026-09-28: 뒤로가기가 없고 엑스를 누르니까 패널이 아예
               꺼지는데 · 아래 취소 누르면 패널 안에서 뒤로 가게 해 줘). */
            onClick: () => setScopingFor(mu),
          },
          {
            key: "projects", group: "where",
            label: t.colProjects,
            /* THE COUNT AND THE NAMES (owner, 2026-09-28: 1곳 옆에 프로젝트 이름 표시해줘).
               「1곳」 alone answers how many and not which, and on a single-project installation —
               which is most of them — that is the one fact the row could have carried and did not.
               The names fit now that the value has a line of its own (see the stacked row). */
            value: (() => {
              const named = mu.projectIds.map(pid => projects.find(pr => pr.id === pid)?.name).filter(Boolean);
              return named.length
                ? `${t.panelProjectCount(mu.projectIds.length)} \u00b7 ${named.join(", ")}`
                : t.panelProjectCount(mu.projectIds.length);
            })(),
            disabled: !manageAccess,
            reason: manageAccess ? undefined : t.reasonNotOwner,
            /* No close() — the editor opens OVER the card so ← 뒤로 and 취소 have somewhere
               to go back to (owner, 2026-09-28: 뒤로가기가 없고 엑스를 누르니까 패널이 아예
               꺼지는데 · 아래 취소 누르면 패널 안에서 뒤로 가게 해 줘). */
            onClick: () => setEditingProjectsFor(mu),
          },
        ];
        return (
          /* A PANEL, like every other editor on this page (owner: 하나로 가능한한 통일하는게
             좋을것같아 오른쪽패널로). This card is where an account is read and changed, and the
             row it belongs to stays visible behind it. The name, the address and the status badge
             go in the panel's title — the badge is there for the reason it moved beside the name
             in the table: a suspended account makes everything below it hypothetical. */
          <Drawer
            /* While one of its editors is open, Escape belongs to THAT panel — the same
               arrangement the invite form uses. Two listeners meant one keypress closed the editor
               and the card under it. */
            escapeEnabled={!editingProjectsFor && !scopingFor && !changingGrantsFor}
            title={
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* THE PERSON GETS A FACE (owner, 2026-09-22: 중요한 정보들이 눈에 안들어오는
                    느낌이야). A 38px disc of the initial, which is the first thing the eye lands
                    on in every member panel checked — Toggl Track, Churnkey, Clerk, Zoho CRM,
                    Canny — and it costs no line and no new data: the letter is the name's own.
                    Decorative, so the screen reader is left with the name beside it. */}
                <span aria-hidden="true" style={{
                  flexShrink: 0, width: "38px", height: "38px", borderRadius: "50%",
                  backgroundColor: "var(--gray-100)", color: "var(--gray-600)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: 800,
                }}>{[...mu.name.trim()][0] ?? ""}</span>
                <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
                  {/* THE BADGE BESIDE THE NAME, NOT AT THE FAR EDGE (owner, on the table: 계정
                      상태는 사용자열 근처에 있어야할것같아). The same argument holds in a 520px
                      panel: it was 380px away from the name it describes, and 정지됨 makes
                      everything below it hypothetical, so it belongs where the reader is already
                      looking. 17px, up from 15px — the name was only 3px clear of the row labels
                      under it, which is what "important things don't come forward" was. */}
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <span title={mu.name} style={{ minWidth: 0, fontSize: "17px", fontWeight: 800, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mu.name}</span>
                    <span style={{ flexShrink: 0, display: "flex" }}><AccountStatusBadge status={mu.status} /></span>
                  </span>
                  <span title={mu.email} style={{ fontSize: "12px", fontWeight: 400, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mu.email}</span>
                </span>
              </span>
            }
            onClose={close}
          >
              {/*
                THE STATE, BEFORE ANYTHING THE READER MIGHT DO ABOUT IT (2026-09-30).

                Reproduced at 1440: opening 정지됨 David Ong's card showed 비밀번호 재설정 live,
                its drawer opened on 「메일로 보내기」 with all three routes enabled, and nothing
                anywhere in that path said the account is shut. The badge beside the name is the
                only mark, and a badge is read as a label on the person, not as a rule about the
                buttons 300px below it.

                Amber, not red: nothing here is broken and nothing is lost — 재활성화 is one press
                away and it is named in the sentence. Above the groups rather than inside 로그인
                수단, because 인물 검색 허용 and 앱 권한 are in the same position (offered, live,
                and pointless until the door opens) and a notice filed under one section does not
                cover the other.
              */}
              {mu.status === "suspended" && (
                <div style={{
                  margin: "8px 20px 0", padding: "12px 14px", borderRadius: "10px",
                  backgroundColor: "var(--warning-100)",
                  display: "flex", gap: "8px", alignItems: "flex-start",
                }}>
                  <UserX size={14} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0, marginTop: "1px", color: "var(--warning-500)" }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "var(--warning-500)" }}>{t.suspendedPanelTitle}</span>
                    <span style={{ display: "block", fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.5, marginTop: "3px" }}>{t.suspendedPanelBody}</span>
                  </span>
                </div>
              )}
              <div style={{ padding: "8px 20px 4px", display: "flex", flexDirection: "column", gap: "18px" }}>
                {([["where", t.panelWhereSection], ["what", t.panelWhatSection]] as const).map(([group, heading]) => (
                /* NOTHING BETWEEN THE GROUPS — not a tint, not a rule. Both were tried on
                   2026-10-06 at the owner's asking, in that order, and both came off: the tint
                   because it boxed the groups, the hairline because three of them put lines back
                   in a card that had just been cleared of 27. What holds a group is its caption
                   and the space around it, which is what Neon, Fibery and Canny do in a user
                   panel — the same survey the tint came from. */
                <div key={group}>
                <p style={PANEL_CAPTION}>{heading}</p>
                <div style={PANEL_GROUP}>
                  {rows.filter(r => r.group === group).map(row => {
                    /* No borderTop on the second row onwards, and no box round the group: see
                       PANEL_GROUP. What keeps two rows apart now is their own padding. */
                    const style: React.CSSProperties = {
                      width: "100%", display: "flex", alignItems: "center", gap: "8px", textAlign: "left",
                      /* Taller than the one-line version it replaces, because the row is now two
                         lines — see the stacked block below. */
                      padding: row.hero ? "10px 12px" : "9px 12px", border: "none", borderRadius: "8px",
                      backgroundColor: "transparent", fontFamily: "inherit",
                    };
                    /*
                     * STACKED, NOT SIDE BY SIDE (owner, 2026-09-28: 가로로 저렇게 되어 있으니까
                     * 읽기 불편해 · 세로형으로 바꿔줘).
                     *
                     * The label sat left and the value was pushed to the right edge, so reading one
                     * row meant crossing an empty gap that changed width on every row — the eye had
                     * to find where the answer started each time. Stacked, every answer begins on
                     * the same x as the question above it and as every other row's.
                     *
                     * It also stops the values from being truncated for no reason: pushed right
                     * they shared the line with their own label, so 「Portal + 앱」 and 「최고관리자」
                     * were competing for one line's width. On their own line they have the row.
                     */
                    const label = (
                      <>
                        {/* The label gives way to the value: it was 700 in gray-600, the same
                            weight as the thing it names, so a row read as two equals rather than
                            as a question and its answer. */}
                        <span style={{ flexShrink: 0, fontSize: "12px", fontWeight: 500, color: row.disabled ? "var(--gray-400)" : "var(--gray-500)" }}>{row.label}</span>
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
                    const stacked = (
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>{label}</span>
                        <span style={{
                          maxWidth: "100%",
                          fontSize: row.hero ? "15px" : "13px", fontWeight: row.hero ? 800 : 700,
                          color: row.disabled ? "var(--gray-400)" : "var(--gray-900)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{row.value}</span>
                      </span>
                    );
                    if (row.disabled) return <div key={row.key} style={style}>{stacked}</div>;
                    /* The answer IS the control — see `select` on the row type. No chevron and no
                       row click: there is nothing behind this row to go to. */
                    if (row.select) return (
                      <div key={row.key} style={{ ...style, display: "block" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0, marginBottom: "5px" }}>{label}</span>
                        <FilterSelect
                          value={row.select.value}
                          onChange={row.select.onPick}
                          options={row.select.options}
                        />
                      </div>
                    );
                    return (
                      /* portal-btn-quiet, because a row with no border and no fill of its own has
                         nothing but the chevron to say it opens something. The tint on pointing is
                         the rest of that sentence — see the class's own note: nothing at rest and
                         nothing on pointing is not a quiet control, it is text. */
                      <React.Fragment key={row.key}>
                      <button type="button" className="portal-btn-quiet" onClick={() => row.onClick?.()} style={{ ...style, cursor: "pointer" }}>
                        {stacked}
                        {/* No chevron on a row that cannot be opened — an arrow that leads nowhere
                            is the control this console keeps being asked to stop drawing. */}
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                          <path d="M3 1.5L7 5l-4 3.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {row.key === "cameras" && scopeMap}
                      </React.Fragment>
                    );
                  })}
                  {/*
                    인물 검색 차단 MOVED HERE FROM THE ACTIONS BLOCK (2026-09-28).

                    It was filed under the section that is now 「비밀번호와 코드」, next to a
                    password reset and a setup code, because that block used to be called
                    「다시 들어가게 하기」 — and blocking somebody's search is not a way back in, it
                    is a permission. It is a verb rather than a value, so it keeps the quiet-button
                    treatment the other actions use instead of becoming a fifth row with a chevron.
                  */}
                  {/* A LABEL OVER IT, LIKE EVERY OTHER LINE IN THIS GROUP (owner, 2026-09-28:
                      인물검색허용 버튼 위에도 서브 제목이 필요해). The three rows above are
                      label-over-value, so a button arriving with no label of its own broke the
                      column: the eye had nothing to read it against, and 「인물 검색 허용」 had to
                      double as both the name of the thing and the verb. */}
                  {group === "what" && (
                    /* `display: block` (owner, 2026-09-28: 인물 검색 아래로 버튼이 오게
                       수정해줘). The label was a bare span and the button beside it is
                       inline-flex, so the two sat on one line — a label acting as a prefix to its
                       own control instead of a heading over it, which is not how the three rows
                       above this one read. */
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--gray-500)", marginTop: "9px", marginLeft: "12px" }}>
                      {t.axisSearch}
                    </span>
                  )}
                  {group === "what" && (() => {
                    const a = { key: "search", label: holdsSearch(mu) ? t.appSearchRevoke : t.appSearchGrant, icon: <UserSearch size={14} strokeWidth={2.2} />,
                      disabled: !manageAccess || (!holdsSearch(mu) && !mu.appAccess),
                      reason: !manageAccess ? t.reasonNotOwner : (!holdsSearch(mu) && !mu.appAccess) ? t.reasonNoApp : undefined,
                      /* Confirmed, and deliberately NOT danger — red means what cannot be undone,
                         and blocking person search deletes nothing; this same button flips back.
                         Verbatim from the menu, toast and all. */
                      onClick: () => {
                        const next = !holdsSearch(mu);
                        /* The card stays: this account still exists either way, so 취소 has to
                           land back where the reader was rather than on the table. The confirm
                           sits above the card at z-400. 제거 is the one that still closes first —
                           there is no card to come back to once the account is gone. */
                        setConfirming({
                          title: next ? t.confirmSearchGrantTitle(mu.name) : t.confirmSearchRevokeTitle(mu.name),
                          body: next ? t.confirmSearchGrantBody : t.confirmSearchRevokeBody,
                          confirmLabel: next ? t.appSearchGrant : t.appSearchRevoke,
                          onConfirm: () => {
                            setAppSearch(mu.id, next);
                            showToast({ variant: next ? "success" : "warning", title: next ? t.appSearchToastOn : t.appSearchToastOff, desc: t.appSearchToastDesc(mu.name) });
                          },
                        });
                      }, };
                    return (
                      <button type="button" className={a.disabled ? undefined : "portal-btn-quiet"}
                        onClick={a.disabled ? undefined : a.onClick} disabled={a.disabled}
                        title={a.disabled ? a.reason : undefined}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start",
                          height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                          backgroundColor: "white", fontFamily: "inherit", fontSize: "12px",
                          /* marginBottom because this is the LAST thing in the group and the
                             group's own padding is 4px — the button was sitting on the rounded
                             bottom edge (owner, 2026-09-28: 인물 검색 허용 버튼 아래로 공간
                             조금만 더 줘). 8px puts the same air under it as the label has
                             over it. */
                          marginTop: "6px", marginBottom: "8px", marginLeft: "12px",
                          color: a.disabled ? "var(--gray-300)" : "var(--gray-600)",
                          fontWeight: 700, cursor: a.disabled ? "default" : "pointer",
                        }}>
                        {a.icon}{a.label}
                      </button>
                    );
                  })()}
                </div>
                </div>
                ))}
              </div>

              {/*
                BOXES AGAIN, AND THAT IS NOT A LOOP (owner, 2026-09-28: 비밀번호 재설정도 아래
                정지, 제거처럼 버튼이라고 느껴지게 라인을 그려줘).

                They WERE boxes, and the boxes came off on 2026-09-22 for a measured reason: five
                bordered pills under two bordered GROUPS were twenty of the thirty-one border edges
                the card drew, and the loudest thing on it was a row of things you rarely do.

                What changed since is the other half of that count. The groups lost their boxes,
                and then the rows above became label-over-value pairs — so a bare tinting phrase
                sitting in that rhythm reads as one more ANSWER rather than as a verb. The borders
                are no longer competing with anything: they are now the only boxes in the card, and
                they mark exactly the things you press.

                One treatment for all four (인물 검색 차단 · 비밀번호 재설정 · 정지 · 제거), measured
                identical at 36px tall and 8px radius. 제거 keeps its red-on-pointing class as the
                one that cannot be undone.
              */}
              <div style={{ padding: "14px 20px 22px" }}>
                <p style={PANEL_CAPTION}>{t.panelAccountSection}</p>
                {/*
                  A PARKED ADDRESS IS A STATE, so the card carries it.

                  Without this the owner presses 보내기, the panel closes, and the account looks
                  exactly as it did — the same shape as the invitation that shows 「초대됨」 until
                  it is accepted. It says which address is waiting, and gives the way out: nothing
                  has moved yet, so calling it off undoes nothing, it simply stops.
                */}
                {mu.pendingEmail && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)" }}>{t.emailPendingLabel}</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", wordBreak: "break-all" }}>{mu.pendingEmail}</span>
                    <button
                      onClick={() => { cancelPortalUserEmailChange(mu.id); showToast({ variant: "success", title: t.emailPendingCancelled }); }}
                      className="portal-btn-quiet"
                      style={{ border: "none", background: "none", padding: "2px 4px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", textDecoration: "underline" }}>
                      {t.emailPendingCancel}
                    </button>
                  </div>
                )}
                {/* Pulled left by the button's own 10px padding, so the first label starts on the
                    same x as the caption over it and the section reads as one block. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {[
                    /* The two mail-less ways back in, kept apart for the reason the menu gave: a
                       person who never arrived needs the invitation again, a person who is locked
                       out needs a credential. */
                    ...(mu.status === "invited" ? [{
                      key: "resend", label: t.resendInvite, icon: <Link2 size={14} strokeWidth={2.2} />,
                      disabled: !manageAccess, reason: manageAccess ? undefined : t.reasonNotOwner,
                      /* A reissue, not a resend: the previous link stops working the moment this
                         mints a new one. The link goes on a panel rather than in a toast —
                         nothing posts it anywhere, so it is the whole result and has to survive
                         longer than five seconds. Verbatim from the menu this replaced. */
                      onClick: () => {
                        const token = issueInviteToken(mu.id);
                        if (!token) return;
                        /* No close(): same as 비밀번호 재설정 — the card stays under this so the
                           panel has a ← to come back to. */
                        setInvitePanel({ title: t.inviteLinkRemadeTitle, links: [{ name: mu.name, email: mu.email, url: `/password-setup?token=${token}` }] });
                      },
                    }] : []),
                    {
                      /* THE ONE PLACE AN E-MAIL CAN BE CHANGED, and it is here rather than in
                         Settings on purpose — see ChangeEmailPanel's own note. First in the
                         group because it comes before the credential in the reader's order: the
                         address is who the account is, the password is how they prove it. */
                      key: "email", label: t.changeEmail, icon: <MailQuestion size={14} strokeWidth={2.2} />,
                      disabled: !manageAccess, reason: manageAccess ? undefined : t.reasonNotOwner,
                      onClick: () => setChangingEmailFor(mu),
                    },
                    {
                      key: "credential", label: t.resetPassword, icon: <KeyRound size={14} strokeWidth={2.2} />,
                      /*
                       * REFUSED WHILE THE ACCOUNT IS SHUT (2026-09-30).
                       *
                       * This opened a drawer offering three delivery routes, all live, mail
                       * preselected — for an account the gate turns away before it ever looks at
                       * a password. Every one of the three ends the same way: a credential handed
                       * over, a person trying it, and a refusal neither of them can explain. The
                       * mail route is the worst of them, because nothing comes back to the
                       * administrator at all.
                       *
                       * Disabled rather than opened-and-warned: the drawer's own confirm step is
                       * where the consequences are read, and a box you are meant to read and then
                       * not use teaches people to press through it. The reason names 재활성화 and
                       * says where it is; the notice at the top of the card says the same thing
                       * where a disabled control's tooltip cannot reach (touch, and some browsers
                       * on hover).
                       */
                      disabled: !manageAccess || mu.status === "suspended",
                      reason: !manageAccess ? t.reasonNotOwner : mu.status === "suspended" ? t.reasonSuspended : undefined,
                      /* No close(): the card stays under this, which is what gives the panel a
                         ← to come back to. Same as the three editors above. */
                      onClick: () => setCredentialFor(mu),
                    },
                    ...(mu.setupCode ? [{
                      key: "code", label: t.viewSetupCode, icon: <Eye size={14} strokeWidth={2.2} />,
                      /* Same refusal as 비밀번호 재설정 beside it, and for the same reason: this
                         is reading a code back out in order to hand it over, which is a way in.
                         Looking it up is harmless; the errand it exists for is not. */
                      disabled: !manageAccess || mu.status === "suspended",
                      reason: !manageAccess ? t.reasonNotOwner : mu.status === "suspended" ? t.reasonSuspended : undefined,
                      onClick: () => setViewingCodeFor(mu),
                    }] : []),
                  ].map(a => (
                    /* THE SAME BOX 정지 AND 제거 WEAR (owner, 2026-09-28: 비밀번호 재설정도 아래
                       정지, 제거처럼 버튼이라고 느껴지게 라인을 그려줘). Bare text under a caption
                       reads as a value — the card's other sections are label-over-value, so a lone
                       tinting phrase in that rhythm looked like one more answer rather than a verb.
                       Every control in this card now looks like a control. */
                    <button key={a.key} type="button" className={a.disabled ? undefined : "portal-btn-outline"}
                      onClick={a.disabled ? undefined : a.onClick} disabled={a.disabled}
                      title={a.disabled ? a.reason : undefined}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                        backgroundColor: "white", fontFamily: "inherit", fontSize: "12px",
                        color: a.disabled ? "var(--gray-300)" : "var(--gray-600)",
                        fontWeight: 700, cursor: a.disabled ? "default" : "pointer",
                      }}>
                      {/*
                        A MARK ON EACH VERB (the page's own quiet buttons carry one — see the
                        roster's 코드 일괄 발급). Borderless, three Korean phrases in a row read as
                        navigation; the icon is what says each one is a thing you press. The mark
                        is the label's own noun: a link for the link, a key for the password, an
                        eye for 보기, a magnifier over a person for person search.
                      */}
                      {a.icon}
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
                {/* 22px above the heading rather than a rule — the 2026-09-28 reasoning, and it
                    outlived the hairlines that were briefly added beside it: with no boxes left
                    anywhere else, a line here does a job the space already does. */}
                <p style={{ ...PANEL_CAPTION, marginTop: "22px" }}>{t.panelStatusSection}</p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", margin: "0 -10px" }}>
                  <button type="button"
                    disabled={!manageAccess || (mu.status !== "suspended" && lastAdmin)}
                    title={!manageAccess ? t.reasonNotOwner : (mu.status !== "suspended" && lastAdmin) ? t.lastAdminReason : undefined}
                    onClick={() => {
                      const suspended = mu.status === "suspended";
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
                    className={(!manageAccess || (mu.status !== "suspended" && lastAdmin)) ? undefined : "portal-btn-outline"}
                    /*
                     * A BOX, LIKE 제거 BESIDE IT (owner, 2026-09-28: 아래 정지는 현재 상태를
                     * 말하는 것 같은 UI거든? 옆에 제거랑 정지 버튼으로 놔야 할 것 같아).
                     *
                     * It was bare tinting text under a caption that used to read 「계정 상태」, so
                     * the pair said "status: suspended" rather than "you can suspend". The caption
                     * is 「계정」 now and this is a control that looks like one.
                     *
                     * They sit together rather than at opposite edges. The old arrangement pushed
                     * 제거 to the far side so two access-removing controls were not 2px apart —
                     * but the thing that actually protects 제거 is its confirmation, which names
                     * the person and is marked danger, and separating them cost the reader the
                     * ability to see the two choices as one pair. 제거 keeps the red-on-pointing
                     * treatment that tells them apart.
                     */
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                      backgroundColor: "white",
                      color: (!manageAccess || (mu.status !== "suspended" && lastAdmin)) ? "var(--gray-300)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
                      cursor: (!manageAccess || (mu.status !== "suspended" && lastAdmin)) ? "default" : "pointer",
                      marginLeft: "10px",
                    }}>
                    {mu.status === "suspended" ? <UserCheck size={14} strokeWidth={2.2} aria-hidden="true" /> : <UserX size={14} strokeWidth={2.2} aria-hidden="true" />}
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
                    className={(!manageAccess || lastAdmin) ? undefined : "portal-btn-outline-danger"}
                    /*
                     * THE ONLY BOX LEFT IN THE CARD, AND IT IS NOT RED UNTIL YOU POINT AT IT.
                     *
                     * Every other control here lost its border, so the one that cannot be undone
                     * is now the single thing in the panel that looks like a box — which is what
                     * keeps it from being hit on the way past, where before it was one of five
                     * identical pills and told apart only by being red.
                     *
                     * Red at rest is what this repo already decided against for exactly this
                     * button elsewhere (see portal-btn-outline-danger in globals.css: "red at
                     * rest made the one thing on the settings page you almost never want to do
                     * the first thing the eye lands on"). It was doing that here too: opening an
                     * account card, the eye went to 제거 at the bottom. The bin says destructive
                     * at rest, the red arrives with the pointer, and the confirmation behind it
                     * is unchanged — still danger, still naming the person.
                     *
                     * marginLeft auto, so it sits at the far edge with 정지 at the other: two
                     * controls that both take access away should not be 2px apart.
                     */
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER,
                      backgroundColor: "white", color: (!manageAccess || lastAdmin) ? "var(--gray-300)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700, cursor: (!manageAccess || lastAdmin) ? "default" : "pointer", fontFamily: "inherit",
                    }}>
                    <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
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
          onBack={() => setEditingProjectsFor(null)}
          onSave={ids => {
            updatePortalUserProjects(editingProjectsFor.id, ids);
            showToast({ variant: "success", title: t.projectsUpdatedTitle, desc: editingProjectsFor.name });
          }}
        />
      )}
      {changingGrantsFor && (
        <AppGrantModal user={changingGrantsFor} onClose={() => setChangingGrantsFor(null)} onBack={() => setChangingGrantsFor(null)} />
      )}
      {scopingFor && (
        <CameraScopePicker
          user={scopingFor}
          cameras={scopableCamerasFor(scopingFor)}
          onClose={() => setScopingFor(null)}
          onBack={() => setScopingFor(null)}
        />
      )}
      {invitePanel && (
        <InviteLinkPanel title={invitePanel.title} links={invitePanel.links}
          onClose={() => setInvitePanel(null)} onBack={managing ? () => setInvitePanel(null) : undefined} />
      )}
      {/*
        WHAT THE BULK ACTION ACTUALLY DID.
        
        Only when something was refused — a write that did all of it says so in a toast and gets
        out of the way. This one has to stay until it is read: it names every account that was left
        alone and why, which is the half a count cannot carry.
      */}
      {bulkResult && (
        <Drawer title={t.bulkResultTitle} onClose={() => setBulkResult(null)} width="440px"
          footer={<PanelPrimary onClick={() => setBulkResult(null)} label={t.tempDone} />}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-700)", lineHeight: 1.6 }}>
              {t.bulkResultBody(bulkResult.done, bulkResult.refused.length)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bulkResult.refused.map(r => (
                <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "10px 12px", borderRadius: "10px", border: BORDER, backgroundColor: "var(--gray-50)" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{r.name}</span>
                  <span style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5 }}>{r.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {credentialFor && (
        <TempPasswordModal user={credentialFor} mailAvailable={mailAvailable}
          onClose={() => setCredentialFor(null)} onBack={() => setCredentialFor(null)} />
      )}
      {changingEmailFor && (
        /* Opens OVER the account card, like the three editors above it, so ← 뒤로 and 취소 land
           back on the account rather than on the table. */
        <ChangeEmailPanel user={changingEmailFor} mailDomain={panelMailDomain} mailAvailable={mailAvailable}
          onClose={() => setChangingEmailFor(null)} onBack={() => setChangingEmailFor(null)} />
      )}
      {viewingCodeFor?.setupCode && (
        <TempPasswordModal
          user={viewingCodeFor}
          mailAvailable={mailAvailable}
          initialCode={viewingCodeFor.setupCode}
          onClose={() => setViewingCodeFor(null)}
          onBack={() => setViewingCodeFor(null)}
        />
      )}
    </div>
  );
}
