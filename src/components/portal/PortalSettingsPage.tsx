"use client";

import { useState } from "react";
import { ClipboardList, Mail, MapPin, Monitor, Pencil, Plus, Tag, Trash2, User } from "lucide-react";
import { usePortalLanguage, type AppLanguage } from "@/lib/i18n";
import { useVcaStore, currentPortalUser, canEnterApp, canManageAccess, canSetPolicy, SIGNED_IN_USER, type SearchPurpose } from "@/lib/vcaStore";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { portProblem, FIELD_CHECK_T } from "@/lib/fieldChecks";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, CardSection, FilterSelect, PairGrid, PairItem, TextField, ConfirmModal, FieldError, Drawer, PanelCancel, PanelPrimary, Switch, usePortalEditAccess, useTypeLabel } from "./PortalShared";
import { VipCategoryModal } from "./VipCategories";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { useToast } from "@/components/Toast";
import ProjectMailPanel from "./ProjectMailPanel";
import { PROJECT_TIME_ZONE } from "@/lib/time";

/**
 * The settings rail: one section at a time.
 *
 * It was a scrollspy over a single tall card — the titles listed, the one you had scrolled to
 * marked. That still made the reader scroll past four sections to reach the fifth, and it made
 * every section share a page with the ones around it, so nothing on it had a shape of its own.
 *
 * These are tabs now (asked for 2026-09-11): clicking one shows that section and only that
 * section. Settings is not read top to bottom — you arrive knowing which one thing you came to
 * change — so a table of contents that also hides everything else is the more useful of the two.
 * It also means the heaviest section on this page, deleting the project, is somewhere you have to
 * choose to go rather than somewhere scrolling takes you.
 */

/* The settings label, as PairShared's PairItem draws it (11px / 600 / 0.2px).
 *
 * The team-mail fields were hand-rolled `<label>`s at 12px/400 while every other label in the same
 * card came from PairItem — measured in the browser after the owner asked (인터넷 연결 이거랑 발신
 * 주소 폰트가 다른거 맞지?): 12px weight 400 against 11px weight 600, letter-spacing 0 against
 * 0.2px. One card, two label vocabularies. These fields need their own grid, so they cannot simply
 * become PairItems — they borrow its type instead, and the two halves read as one form. */
const PAIR_LABEL: React.CSSProperties = { fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px", lineHeight: "15px", color: "var(--gray-500)" };

/**
 * When this setting was last changed, beside the control that changes it.
 *
 * The Project tab applies every value the moment you pick it (owner, 2026-09-29: 이부분도 변경하면
 * 뭐 그냥 자동 저장되는건가? / 변경되었다는게 안보여서) — a form with no save button and no
 * acknowledgement, so picking a new retention looked exactly like picking the wrong one by
 * accident. A toast says it happened; this line says it is still true tomorrow.
 *
 * READ FROM THE AUDIT LOG, not from a new field per setting. Every one of these writes a row
 * there already, keyed by the same `target` string, so the log IS when it changed — a second copy
 * on the project object could only ever drift from it. Nothing is drawn until there is a row.
 */
function LastChanged({ projectId, target, lang, t }: {
  projectId: string; target: string; lang: "en" | "ko"; t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  const auditLog = useVcaStore(s => s.auditLog);
  const row = auditLog.find(a => a.projectId === projectId && a.area === "settings" && a.target === target);
  if (!row) return null;
  const when = new Date(row.at).toLocaleString(lang === "ko" ? "ko-KR" : "en-US",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return <span style={{ fontSize: "11px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.lastChanged(when)}</span>;
}

const T = {
  en: {
    accountTitle: "Account",
    name: "Name",
    nameEdit: "Change",
    nameSave: "Save",
    nameCancel: "Cancel",
    nameSavedToast: "Name changed",
    email: "Email address",
    emailElsewhere: "Changed by an owner from Users · the account's panel.",
    portalRole: "Portal role",
    appAccess: "App access",
    appYes: "Has the monitoring app",
    appNo: "Portal only",
    team: "Team",
    teamMailTitle: "Team mail",
    mailRailLabel: "Mail",
    teamMailIntro: "Every project on this team uses these unless it sets its own below.",
    teamMailDomain: "Mail domain",
    teamMailDomainHint: "Accounts must have an address on this domain. Requests and invites to anything else are refused.",
    teamMailHost: "SMTP host",
    teamMailUser: "SMTP username",
    teamMailUserHint: "Leave both this and the password empty for a relay that takes no credentials.",
    teamMailPass: "SMTP password",
    teamMailPassSet: "A password is on file. Type a new one to replace it; leave it empty to keep it.",
    teamMailPassNone: "Not set.",
    teamMailPort: "Port",
    teamMailFrom: "From address",
    teamMailTls: "Use TLS",
    teamMailSave: "Save mail settings",
    teamMailSaveScoped: "Save team default",
    teamMailSaved: "Team mail settings saved",
    teamMailFromMismatch: (d: string) => `The from address has to be on @${d}, or the receiving server rejects it.`,
    teamMailUnverified: "Saved, not tested — this screen never reaches the relay. A wrong host loses invitations silently.",
    categoryTitle: "VIP categories",
    categoryCount: (n: number) => (n === 1 ? "1 category in use" : `${n} categories in use`),
    categoryManage: "Manage categories",
    categoryNone: "No categories yet.",
    // "New category", the word the modal this button opens already uses for the same move
    // (VipCategories.catNew), and the word the two sections below it use — New purpose, New
    // preset. A category is something an institution writes, not a device somebody adds.
    categoryAdd: "New category",
    projectTitle: "Project",
    saveFixFields: "Fix the fields marked above",
    projectName: "Name",
    rename: "Rename",
    renameSave: "Save",
    renameCancel: "Cancel",
    renamedToast: "Project renamed",
    dangerTitle: "Delete project",
    deleteProject: "Delete this project",
    deleteProjectHint: "The project and everything filed under it. The activity log survives, re-filed under the team.",
    deleteConfirmTitle: (name: string) => `Delete ${name}?`,
    deleteConfirmBody: "This cannot be undone. Type the project's name to confirm.",
    deleteConfirmCounts: (cameras: number, vips: number, staff: number) =>
      `${cameras} input source(s), ${vips} VIP record(s) and ${staff} roster row(s) go with it. Accounts stay — this project is removed from their list.`,
    deleteConfirmLabel: "Delete project",
    deletedToast: "Project deleted",
    deleteLastProject: "This is the team's only project. A team with none shows the setup screen instead.",
    projectType: "Type",
    projectTeam: "Team",
    projectRegion: "Region",
    projectTimeZone: "Time zone",
    timeZoneNote: "Every screen uses this zone, whoever opens it and from where.",
    settingSaved: "Saved",
    lastChanged: (when: string) => `Changed ${when}`,
    retention: "Recording retention",
    retentionUnset: "Not decided",
    retentionDaysLabel: (n: number) => `${n} days`,
    retentionNote: "This console deletes nothing. Saving writes the number down here; it does not reach the recorder or the server.",
    vipRetention: "VIP listing period",
    vipRetentionNote: "How long a new VIP listing lasts here. It fills the end date on registration, and an expired listing stops raising detections. Listings already on the list keep the date they were given.",
    vipRetentionInherited: (n: number) => `${n} days — deployment default`,
    watermark: "Viewer watermark",
    watermarkOn: "Stamped with name and time",
    watermarkOff: "Not stamped",
    watermarkNote: "The frame carries the account looking at it and the minute it was on screen, so a still that leaves here says which session it came from. It cannot stop a capture — nothing in a browser can. A wall display watched by a whole shift is the case for turning it off: the name on it would be the wrong person's.",
    watermarkOffNote: "Captures taken at this site name no viewer. The access log still records who looked, but a still on its own cannot be traced to a session.",
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
    presetTitle: "App access presets",
    presetIntro: "Named sets of app grants, so the same job can be given the same screens twice. Editing one reaches every account following it — accounts set individually are not touched.",
    presetEmpty: "No presets yet. Until one exists, every invitation has to pick screens one by one.",
    presetNew: "New preset",
    presetLabelField: "Name",
    presetLabelPlaceholder: "Operator \u00b7 Investigator \u00b7 Supervisor",
    presetDescField: "What it is for",
    presetDescPlaceholder: "One line. Somebody chooses between these by reading it.",
    presetGrantsField: "What it grants",
    presetNoScreens: "Tick at least one screen \u2014 an account following a preset with none cannot open the app",
    presetFollowers: (n: number) => `${n} account${n === 1 ? "" : "s"} follow this`,
    presetFollowersNone: "No accounts follow this yet",
    presetEditReach: (n: number) => `Saving changes what these ${n} can open, at once.`,
    presetEdit: "Edit",
    presetRetire: "Retire",
    presetRetireAsk: "Retire this preset?",
    presetRetireBody: (n: number) => n === 0
      ? "It stops being offered on the invite form. Nothing else changes."
      : `It stops being offered, and the ${n} account${n === 1 ? "" : "s"} following it become individual \u2014 holding exactly what they hold now. Nobody gains or loses access.`,
    presetRetireConfirm: "Retire",
    presetSave: "Save",
    presetCancel: "Cancel",
    presetCreate: "Create",
    presetOwnerOnly: "Only an owner can change presets.",
    presetSavedToast: "Preset saved",
    presetCreatedToast: "Preset created",
    presetRetiredToast: "Preset retired",
    purposeOwnerOnly: "Only the owner can change this list.",
    displayTitle: "Language",
    language: "Portal language",
    languageNote: "Portal only. The monitoring app keeps its own, set from My Page there.",
    password: "Password",
    // No figure. This was "Set 3 months ago" — the same words for every account, unchanged the
    // moment after you press 비밀번호 변경 beside it, in a value slot whose neighbours are all real
    // (name, e-mail, role, team). A reader deciding whether they are inside a 90-day rotation has
    // nothing else to go on. PortalUser carries no passwordSetAt, so absence is the honest answer.
    passwordSetAgo: "Last set: not recorded",
    changePassword: "Change password",
    currentPassword: "Current password",
    verifyStep: "Confirm it is you",
    verify: "Continue",
    changeStep: "Choose a new password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords do not match. Please try again.",
    cancel: "Cancel",
    updatePassword: "Update password",
    // Nothing here changes a password yet — see the HANDOFF NOTE on ChangePasswordModal. The
    // notice is what the modal says up front; the toast is what it says to somebody who typed one
    // anyway. Neither is a success: the old pair ("Password changed" / "Sign in with the new
    // password next time") sent a person away believing the old one no longer worked, and the one
    // way to find out otherwise was to be locked out of a console they now had two passwords for.
    passwordNotWired: "Not connected yet. A password typed here is not saved.",
    passwordNotSaved: "Password not changed",
    passwordNotSavedBody: "Ask whoever runs your installation to change it for now.",
    roles: { owner: "Owner", admin: "Admin", auditor: "Read-only admin", none: "No Portal access" } as Record<string, string>,
  },
  ko: {
    accountTitle: "계정",
    name: "이름",
    nameEdit: "변경",
    nameSave: "저장",
    nameCancel: "취소",
    nameSavedToast: "이름이 바뀌었습니다",
    email: "이메일",
    emailElsewhere: "사용자 화면에서 계정을 열면 최고관리자가 바꿉니다.",
    portalRole: "Portal 역할",
    appAccess: "앱 접근",
    appYes: "모니터링 앱 사용",
    appNo: "Portal만",
    team: "팀",
    teamMailTitle: "팀 메일",
    mailRailLabel: "메일",
    teamMailIntro: "이 팀의 프로젝트는 아래에서 따로 정하지 않는 한 이 설정을 씁니다.",
    teamMailDomain: "메일 도메인",
    teamMailDomainHint: "계정은 반드시 이 도메인의 주소여야 합니다. 그 외 주소로의 요청과 초대는 거부됩니다.",
    teamMailHost: "SMTP 호스트",
    teamMailUser: "SMTP 사용자",
    teamMailUserHint: "자격증명을 요구하지 않는 릴레이라면 이 칸과 비밀번호를 모두 버려 두세요.",
    teamMailPass: "SMTP 비밀번호",
    teamMailPassSet: "비밀번호가 있습니다. 바꾸려면 새로 입력하고, 그대로 두려면 비워 두면 됩니다.",
    teamMailPassNone: "없습니다.",
    teamMailPort: "포트",
    teamMailFrom: "발신 주소",
    teamMailTls: "TLS 사용",
    teamMailSave: "메일 설정 저장",
    teamMailSaveScoped: "팀 기본값 저장",
    teamMailSaved: "팀 메일 설정이 저장되었습니다",
    teamMailFromMismatch: (d: string) => `발신 주소는 @${d} 도메인이어야 합니다. 아니면 받는 쪽 서버가 거부합니다.`,
    teamMailUnverified: "저장만 할 뿐 연결을 시험하지는 않습니다. 호스트가 틀리면 초대장이 아무 표시 없이 사라집니다.",
    categoryTitle: "VIP 분류",
    categoryCount: (n: number) => `사용 중인 분류 ${n}개`,
    categoryManage: "분류 관리",
    categoryNone: "아직 만든 분류가 없습니다.",
    categoryAdd: "분류 만들기",
    projectTitle: "프로젝트",
    saveFixFields: "위에 표시된 항목을 고쳐주세요",
    projectName: "이름",
    rename: "이름 변경",
    renameSave: "저장",
    renameCancel: "취소",
    renamedToast: "프로젝트 이름이 바뀌었습니다",
    dangerTitle: "프로젝트 삭제",
    deleteProject: "이 프로젝트 삭제",
    deleteProjectHint: "프로젝트와 그 아래 모든 것이 지워집니다. 변경 기록은 팀 밑으로 옮겨져 남습니다.",
    deleteConfirmTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    deleteConfirmBody: "되돌릴 수 없습니다. 확인을 위해 프로젝트 이름을 입력하세요.",
    deleteConfirmCounts: (cameras: number, vips: number, staff: number) =>
      `입력 소스 ${cameras}개, VIP ${vips}건, 직원 명부 ${staff}행이 함께 지워집니다. 계정은 남고, 이 프로젝트만 목록에서 빠집니다.`,
    deleteConfirmLabel: "프로젝트 삭제",
    deletedToast: "프로젝트가 삭제되었습니다",
    deleteLastProject: "팀의 마지막 프로젝트입니다. 프로젝트가 없는 팀은 설정 화면이 대신 열립니다.",
    projectType: "유형",
    projectTeam: "팀",
    projectRegion: "지역",
    projectTimeZone: "시간대",
    timeZoneNote: "누가 어디서 열든 모든 화면이 이 시간대를 씁니다.",
    settingSaved: "변경되었습니다",
    lastChanged: (when: string) => `${when}에 변경`,
    retention: "영상 보관기간",
    retentionUnset: "미정",
    retentionDaysLabel: (n: number) => `${n}일`,
    retentionNote: "이 콘솔은 영상을 지우지 않습니다. 저장하면 이 숫자가 여기에 기록될 뿐, 레코더와 서버에는 전달되지 않습니다.",
    vipRetention: "VIP 등록 유효기간",
    vipRetentionNote: "이 현장에서 새 VIP 등록이 얼마나 유지되는지입니다. 등록할 때 만료일을 채우고, 만료된 등록은 검출 알림을 올리지 않습니다. 이미 명단에 있는 사람의 날짜는 그대로 둡니다.",
    vipRetentionInherited: (n: number) => `${n}일 · 배포 기본값`,
    watermark: "열람자 워터마크",
    watermarkOn: "이름과 시각을 찍음",
    watermarkOff: "찍지 않음",
    watermarkNote: "영상 위에 지금 보고 있는 계정과 그때의 시각이 함께 찍혀, 밖으로 나간 화면이 어느 세션에서 나왔는지 드러납니다. 캡처 자체를 막지는 못합니다 — 브라우저에는 그럴 방법이 없습니다. 교대로 함께 보는 관제 벽처럼 화면 앞에 있는 사람과 계정이 다른 경우에 끕니다.",
    watermarkOffNote: "이 현장에서 캡처한 화면에는 열람자가 남지 않습니다. 조회 기록은 그대로 남지만, 화면 한 장만으로는 어느 세션에서 나왔는지 알 수 없습니다.",
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
    presetTitle: "앱 권한 프리셋",
    presetIntro: "앱 권한을 이름으로 묶어 둔 것입니다. 같은 직무에 같은 화면을 두 번 줄 수 있게 합니다. 하나를 고치면 그것을 따르는 계정 전부에 닿고, 따로 지정한 계정은 건드리지 않습니다.",
    presetEmpty: "아직 프리셋이 없습니다. 하나도 없으면 초대할 때마다 화면을 하나씩 골라야 합니다.",
    // 만들기, like 사유 만들기 two sections up and 팀 만들기 · 프로젝트 만들기 elsewhere: 추가 is for
    // putting a thing that exists into a list (카메라 추가, 서버 추가), and a preset is authored here.
    presetNew: "프리셋 만들기",
    presetLabelField: "이름",
    presetLabelPlaceholder: "운영자 · 조사자 · 감독자",
    presetDescField: "무엇을 위한 것인가",
    presetDescPlaceholder: "한 줄. 사람은 이걸 읽고 고릅니다.",
    presetGrantsField: "무엇을 켜는가",
    presetNoScreens: "화면을 하나 이상 골라주세요 — 화면이 없는 프리셋을 따르는 계정은 앱을 열 수 없습니다",
    presetFollowers: (n: number) => `이 프리셋을 따르는 계정 ${n}개`,
    presetFollowersNone: "이 프리셋을 따르는 계정이 아직 없습니다",
    presetEditReach: (n: number) => `저장하면 이 ${n}명이 열 수 있는 화면이 한 번에 바뀝니다.`,
    presetEdit: "편집",
    presetRetire: "폐기",
    presetRetireAsk: "이 프리셋을 폐기할까요?",
    presetRetireBody: (n: number) => n === 0
      ? "초대 폼에서 더 이상 제시되지 않습니다. 그 밖에 바뀌는 것은 없습니다."
      : `초대 폼에서 더 이상 제시되지 않고, 이것을 따르던 계정 ${n}개는 지금 가진 것을 그대로 들고 개별 지정으로 바뀝니다. 권한을 얻거나 잃는 사람은 없습니다.`,
    presetRetireConfirm: "폐기",
    presetSave: "저장",
    presetCancel: "취소",
    presetCreate: "만들기",
    presetOwnerOnly: "프리셋은 최고관리자만 바꿀 수 있습니다.",
    presetSavedToast: "프리셋을 저장했습니다",
    presetCreatedToast: "프리셋을 만들었습니다",
    presetRetiredToast: "프리셋을 폐기했습니다",
    purposeOwnerOnly: "이 목록은 최고관리자만 바꿀 수 있습니다.",
    displayTitle: "언어",
    language: "Portal 화면 언어",
    languageNote: "Portal에만 적용됩니다. 모니터링 앱은 별도이고, 앱의 마이페이지에서 정합니다.",
    password: "비밀번호",
    passwordSetAgo: "마지막 변경 시점 기록 없음",
    changePassword: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    verifyStep: "본인 확인",
    verify: "확인",
    changeStep: "새 비밀번호 정하기",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
    cancel: "취소",
    updatePassword: "비밀번호 변경",
    passwordNotWired: "아직 서버에 연결되지 않아, 여기서 입력한 비밀번호는 저장되지 않습니다.",
    passwordNotSaved: "비밀번호는 바뀌지 않았습니다",
    passwordNotSavedBody: "변경은 설치를 담당한 곳으로 요청하세요.",
    roles: { owner: "최고관리자", admin: "관리자", auditor: "읽기 전용 관리자", none: "Portal 접근 없음" } as Record<string, string>,
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
/**
 * Retention choices, with "not decided" first and selected by default for a site nobody has
 * configured.
 *
 * No preselected number. 30 days is the figure everyone reaches for and it is a guess — a
 * guessed retention is either an over-hold the customer cannot justify or a deletion nobody
 * agreed to. The steps are the ones that appear in practice; anything else is a contract term
 * and reaches the site through whoever writes the contract, not through a dropdown.
 */
const RETENTION_OPTIONS = (t: (typeof T)["en"] | (typeof T)["ko"]) => [
  { value: "", label: t.retentionUnset },
  ...[7, 14, 30, 60, 90, 180, 365].map(d => ({ value: String(d), label: t.retentionDaysLabel(d) })),
];

/**
 * The same steps, but the empty choice names the number it falls back to.
 *
 * A VIP period is never absent in effect: leave the site unset and the deployment default fills
 * every registration. So the blank option says which number that is, and only reads as "미정"
 * where the deployment has no rule either.
 */
const VIP_RETENTION_OPTIONS = (t: (typeof T)["en"] | (typeof T)["ko"]) => {
  const fallback = getComplianceConfig().vipDefaultValidDays;
  return [
    { value: "", label: fallback === null ? t.retentionUnset : t.vipRetentionInherited(fallback) },
    ...[7, 14, 30, 60, 90, 180, 365].map(d => ({ value: String(d), label: t.retentionDaysLabel(d) })),
  ];
};

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
  const [section, setSection] = useState("account");
  const [changingPassword, setChangingPassword] = useState(false);
  /* The name being typed, or null when nothing is being edited. Not keyed to anything the way the
     rename and mail drafts are — this one belongs to the signed-in person, who does not change
     while the page is open. */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const renamePortalUser = useVcaStore(s => s.renamePortalUser);
  const searchPurposes = useVcaStore(s => s.searchPurposes);
  const requirePurpose = getComplianceConfig().requireSearchPurpose;
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const setProjectTimeZone = useVcaStore(s => s.setProjectTimeZone);
  const setProjectRetention = useVcaStore(s => s.setProjectRetention);
  const setProjectVipRetention = useVcaStore(s => s.setProjectVipRetention);
  const setEvidenceWatermark = useVcaStore(s => s.setEvidenceWatermark);
  /* What the row shows for a site that has not set its own — the deployment's number, not a blank.
     See the note on the VIP period row. */
  const vipFallbackDays = getComplianceConfig().vipDefaultValidDays;
  const inheritedVipRetentionLabel = vipFallbackDays === null ? t.retentionUnset : t.vipRetentionInherited(vipFallbackDays);
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
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const typeLabel = useTypeLabel();
  const vipCategories = useVcaStore(s => s.vipCategories);
  const [managingCategories, setManagingCategories] = useState(false);
  const project = projects.find(p => p.id === projectId);
  const projectTeam = project ? teams.find(tm => tm.id === project.teamId) : undefined;
  const me = currentPortalUser(portalUsers);
  // Owner only, deliberately narrower than mayEdit. Deleting a site takes away every camera,
  // every listed person and every roster row at once — that is role-granting weight, not
  // settings weight. See canManageAccess.
  // Two gates, and they answer different questions: the permission asks whether THIS PERSON may
  // end a project, the switch asks whether THIS DEPLOYMENT offers it at all. Off for the first
  // release because the server's cascade is undecided — see complianceConfig.projectDelete.
  const mayDeleteProject = getComplianceConfig().projectDelete && (me ? canManageAccess(me.permission) : true);
  const isLastProjectInTeam = project ? projects.filter(p => p.teamId === project.teamId).length === 1 : false;
  /*
   * THE TEAM ON SCREEN, NOT THE TEAM I BELONG TO.
   *
   * This read `me.teamId`, so after switching teams in the header the page went on showing — and
   * SAVING — the signed-in administrator's own team. Reproduced: switch to Northgate, open
   * Settings, the header says Northgate while the card says 「Team mail · City of Singapore」, type
   * a relay host, press 저장 — the toast says saved, Northgate is unchanged, and City of
   * Singapore's mail settings have quietly been rewritten from a screen that never named them.
   * Northgate's relay could not be set here at all.
   *
   * An installation holds several teams (project_vca_multi_team_per_install), so "my team" was
   * never the same question as "the team I am looking at". The project on screen answers the
   * second one; `me.teamId` stays as the fallback for the case with no project.
   */
  const viewedTeam = projectTeam ?? (me ? teams.find(tm => tm.id === me.teamId) : undefined);
  const myTeam = viewedTeam;
  /*
   * The team's mail settings, held as a draft so the form does not write on every keystroke.
   * Keyed to the team for the same reason the rename draft is keyed to the project — this
   * screen is not remounted when the team behind it changes.
   */
  const updateTeamMail = useVcaStore(s => s.updateTeamMail);
  const [mailDraft, setMailDraft] = useState<{ teamId: string; domain: string; host: string; port: string; from: string; user: string; pass: string; tls: boolean } | null>(null);
  const liveMail = mailDraft && mailDraft.teamId === myTeam?.id ? mailDraft : null;
  const mailDomain = liveMail?.domain ?? myTeam?.mailDomain ?? "";
  const mailHost = liveMail?.host ?? myTeam?.smtp?.host ?? "";
  const mailPort = liveMail?.port ?? (myTeam?.smtp?.port ? String(myTeam.smtp.port) : "");
  const mailFrom = liveMail?.from ?? myTeam?.smtp?.fromAddress ?? "";
  const mailUser = liveMail?.user ?? myTeam?.smtp?.username ?? "";
  /* The password field starts EMPTY even when one is on file — see SmtpConfig.hasPassword. There
     is nothing to prefill it with: the console is never given the secret. Empty on save means
     「변경 없음」. */
  const mailPass = liveMail?.pass ?? "";
  const mailHasPass = myTeam?.smtp?.hasPassword ?? false;
  const mailTls = liveMail?.tls ?? myTeam?.smtp?.useTls ?? true;
  const editMail = (patch: Partial<{ domain: string; host: string; port: string; from: string; user: string; pass: string; tls: boolean }>) =>
    setMailDraft({ teamId: myTeam?.id ?? "", domain: mailDomain, host: mailHost, port: mailPort, from: mailFrom, user: mailUser, pass: mailPass, tls: mailTls, ...patch });
  const setMailDomain = (v: string) => editMail({ domain: v });
  const setMailHost = (v: string) => editMail({ host: v });
  const setMailPort = (v: string) => editMail({ port: v });
  const setMailFrom = (v: string) => editMail({ from: v });
  const setMailUser = (v: string) => editMail({ user: v });
  const setMailPass = (v: string) => editMail({ pass: v });
  const setMailTls = (v: boolean) => editMail({ tls: v });
  // The from-address has to live on the configured domain or the receiving server rejects it —
  // the same rule the project screen already applies, stated once per screen rather than once.
  const mailFromMismatch = mailDomain.trim() !== "" && mailFrom.trim() !== ""
    && !mailFrom.trim().toLowerCase().endsWith(`@${mailDomain.trim().toLowerCase()}`);
  const mailPortNum = Number(mailPort);
  // Same rule as the project screen's SMTP port, from the one place it is written.
  const mailPortIssue = portProblem(mailPort);
  const mailPortValid = mailPortIssue === null;
  const canSaveTeamMail = mayEdit && liveMail !== null && !mailFromMismatch && mailPortValid;
  /* Which of the three it is, in the reader's words. `liveMail === null` is already "nothing has
     been typed for this team" — the draft is only created by an edit — so it is the no-change
     case rather than a separate one. Same three reasons, same order, as the project block below. */
  /* Only what the screen cannot already show (owner, 2026-09-29: 설명이 너무 투머치해서
     지저분해보이는뎅). A grey save button next to fields you have not touched says "nothing
     changed" by itself, and a line repeating it was a caption on an obvious thing. What stays is
     what you cannot see: that this account may not edit, and that a field above is refusing. */
  const teamMailBlockedReason = !mayEdit ? readOnlyReason
    : (mailFromMismatch || !mailPortValid) ? t.saveFixFields
    : null;
  const saveTeamMail = () => {
    if (!canSaveTeamMail || !myTeam) return;
    updateTeamMail(myTeam.id, {
      mailDomain: mailDomain.trim() || undefined,
      smtp: mailHost.trim() === "" ? undefined : {
        host: mailHost.trim(),
        port: mailPort.trim() === "" ? 587 : mailPortNum,
        fromAddress: mailFrom.trim(),
        username: mailUser.trim() || undefined,
        /* A typed password sets the flag; an empty field leaves whatever is on file. The secret
           itself never comes back here, so there is nothing else this screen can carry — see
           SmtpConfig.hasPassword. */
        hasPassword: mailPass.trim() !== "" ? true : mailHasPass,
        useTls: mailTls,
      },
    });
    setMailDraft(null);
    showToast({ variant: "success", title: t.teamMailSaved, desc: mailDomain.trim() });
  };
  // The team whose policy this screen edits. Falls back to the open project's team, because the
  // stand-in identity belongs to no account list and would otherwise see no list at all.
  /* Same correction as viewedTeam: the search purposes and VIP categories listed here belong to
     the team being looked at. Reading `me.teamId` first showed one team's policy while the header
     named another. */
  const myTeamId = viewedTeam?.id ?? project?.teamId;
  const teamPurposes = searchPurposes.filter(sp => sp.teamId === myTeamId);
  const teamCategories = vipCategories.filter(c => c.teamId === myTeamId);
  const activePurposes = teamPurposes.filter(sp => !sp.archived);
  // Owner only — see canSetPolicy. With no matching account the stand-in identity is treated as
  // the owner it stands in for, the same assumption the rest of Portal makes about it.
  const maySetPolicy = me ? canSetPolicy(me.permission) : true;

  /* Name and e-mail are drawn by hand below now — one is editable here and the other says where
     it is edited — so the list starts at the role. */
  const accountPairs: { label: string; value: string }[] = [
    ...(me ? [
      { label: t.portalRole, value: t.roles[me.permission] ?? me.permission },
      { label: t.appAccess, value: canEnterApp(me) ? t.appYes : t.appNo },
      ...(myTeam ? [{ label: t.team, value: myTeam.name }] : []),
    ] : []),
  ];

  /* Same conditions as the sections themselves, in the same order. Written out rather than derived
     from what rendered: a rail offering a section the page does not have would be a click that
     silently does nothing. */
  const sections = [
    { id: "account", label: t.accountTitle, icon: <User size={15} strokeWidth={2.2} /> },
    ...(project ? [{ id: "project", label: t.projectTitle, icon: <MapPin size={15} strokeWidth={2.2} /> }] : []),
    /* "메일" rather than "팀 메일": the section holds the team default and, under it, this
       project's own override and network state. */
    ...(myTeam ? [{ id: "mail", label: t.mailRailLabel, icon: <Mail size={15} strokeWidth={2.2} /> }] : []),
    ...(getComplianceConfig().vipCategories && myTeamId ? [{ id: "categories", label: t.categoryTitle, icon: <Tag size={15} strokeWidth={2.2} /> }] : []),
    ...(requirePurpose && myTeamId ? [{ id: "purposes", label: t.purposeTitle, icon: <ClipboardList size={15} strokeWidth={2.2} /> }] : []),
    /* PRESETS ARE NOT HERE ANY MORE. They moved to 사용자 및 권한, beside the camera groups
       (2026-09-21): a preset answers "which screens" and a group answers "which cameras", the
       invite form asks both, and an owner handing out access does not come to Settings to find
       them (owner: 아 설정에 있었구나). Moved rather than mirrored — two editors for living
       inheritance would change other people's access from a stale screen. */
    { id: "display", label: t.displayTitle, icon: <Monitor size={15} strokeWidth={2.2} /> },
  ];
  /* Derived, not stored. The conditions above can stop holding while the page is open — a project
     gets deleted, the search-purpose flag is read again — and a stored id would leave the card
     blank with the rail marking a tab that no longer exists. */
  const active = sections.some(sec => sec.id === section) ? section : sections[0].id;

  return (
    /**
     * TABS ON TOP, LIKE EVERY OTHER SCREEN IN THE CONSOLE (owner, 2026-09-30: 다 위로 올려줘).
     *
     * This page used to carry its own SECOND left rail — 계정 / 프로젝트 / 메일 / 언어 in a 208px
     * column — with the card capped at 880px and centred in what was left. Measured at 1440: every
     * other screen runs its content 264 → 1408; this one ran 604 → 1276 and did not move when the
     * window changed. So Settings was the only page in Portal whose content started somewhere
     * else, with a rail on the left of a rail, and about 700px of that inner column empty below
     * 「언어」.
     *
     * The earlier note here argued for the capped centred card, and it was right about the thing
     * it was solving: at the full width the pairs fanned out and the paragraphs ran to a measure
     * nobody returns from. That is still true, and it is why the card is still capped — what
     * changed is WHERE the leftover room goes. With the sections on a strip above, the cap no
     * longer has to buy its narrowness with a column of navigation, and the card starts on the
     * same line as the tables one tab over.
     *
     * CAPPED AND CENTRED (owner, 2026-09-30, in this order: 다른 화면처럼 채우는 게 나을 것
     * 같은데 → 오른쪽으로 늘려준 거 다시 좁혀주고, 정중앙으로 오게 해줘).
     *
     * Full width was tried and turned down. What it gave was a bordered box as wide as the tables
     * holding a 760px form, so the emptiness moved from the page into the card, which is worse —
     * a card draws an edge, and an edge around air reads as a mistake.
     *
     * So the cap comes back, and this time the leftover room is split either side instead of all
     * of it on the right. That is what the settings pages this was checked against do (Later,
     * Lindy, Flodesk, Runway) and what the earlier note on this page argued for — the part of that
     * note that stays true. What does not come back is the second left rail: the sections are a
     * strip above the card now, so the narrowness costs no navigation column.
     *
     * 960 leaves the widest thing inside — the mail form's two columns at 760 — room either side
     * without the card growing to where a form field would stretch. The project tab went back to
     * one column (owner, 2026-09-30: 2열인데 1열로 바꿔도 될 것 같아), so height is no longer what
     * this width is buying; it can be narrowed further if the page ever reads wide.
     */
    <div style={{ maxWidth: "960px", marginInline: "auto", marginBottom: "20px" }}>
      {/* Same strip the Users page draws, for the same reason its tabs are up there: which part of
          a screen you are looking at is a different question from what you are doing in it, and
          both pages answer it in the same place now. No counts — a settings section is not a list
          with a length. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {sections.map(sec => {
          const on = sec.id === active;
          return (
            <button key={sec.id} type="button" onClick={() => setSection(sec.id)}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: on ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: on ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}>
              {/* The icon comes along from the rail. It was the only thing telling 프로젝트 from
                  메일 at a glance while scanning, and a strip of four bare words loses that. */}
              <span style={{ display: "inline-flex", flexShrink: 0, color: on ? "var(--gray-600)" : "var(--gray-400)" }}>{sec.icon}</span>
              {sec.label}
            </button>
          );
        })}
      </div>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      {/* No overflow:hidden. It was there to keep the section rules inside the rounded corners,
          which they never reach — the first section has no top rule and the last no bottom one —
          and it clipped the one thing that has to escape this box: the language select sits in the
          final section, so its list opened straight into the card's bottom edge and was cut off. */}
      <div className="portal-settings-card" style={{ minWidth: 0, backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
      {/* Which pairs exist depends on whether the signed-in address matches an account: with no
          match there is nothing to say about a role or a door, so those are absent rather than
          filled with a disclaimer. */}
      {active === "account" && (
      <CardSection heading={t.accountTitle} icon={<User size={15} strokeWidth={2.2} />}>
        {/* One rhythm across every Settings tab — see PairGrid's `spaced`. */}
        <PairGrid spaced>
          {/*
            YOUR OWN NAME, AT LAST — AND STILL NOT YOUR OWN E-MAIL (policy settled 2026-09-29).

            The only button this panel had was 비밀번호 변경. Nobody could correct a misspelt name
            anywhere in Portal, and nobody could change an e-mail address anywhere at all — so a
            typo in the name a customer was invited under was permanent, and a person whose
            department renamed its domain had to be given a second account.

            The two fields got different answers on purpose, and the reasons are the whole point:

              NAME is a display value. It keys nothing, and the audit rows it already appears in
              keep the name that was true when they were written (see renamePortalUser). Getting
              it wrong costs a wrong label; making somebody file a ticket to fix their own label
              costs more. So the person changes it, here.

              E-MAIL is the login ID and the address a password reset is sent to. Self-service on
              that field is precisely the move somebody who has taken over an account makes to
              lock the real owner out: change the address, ask for a reset, and the recovery mail
              goes to the attacker. It is also the key 조회 기록 identifies a searcher by
              (actorEmail), so the person an audit is about must not be the one who can move it.
              Owner only, from 사용자 → the account's panel — which is where this row points
              rather than staying silent, because a field with no control and no explanation reads
              as a product that forgot it.
          */}
          <PairItem label={t.name}>
            {me && nameDraft !== null ? (
              /* The same inline shape as the project rename two tabs over: a field where the
                 value was, and the two buttons beside it. A second pattern for the same move
                 would be this screen inventing a third way to save something. */
              <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ minWidth: "180px", flex: 1 }}>
                  <TextField value={nameDraft} onChange={setNameDraft} autoFocus />
                </span>
                <button className="portal-btn-primary" disabled={!nameDraft.trim() || nameDraft.trim() === me.name}
                  onClick={() => {
                    const next = nameDraft.trim();
                    if (!next || next === me.name) return;
                    renamePortalUser(me.id, next);
                    setNameDraft(null);
                    showToast({ variant: "success", title: t.nameSavedToast, desc: next });
                  }}
                  style={{ height: "30px", padding: "0 12px", borderRadius: "8px", border: "none", backgroundColor: (nameDraft.trim() && nameDraft.trim() !== me.name) ? "var(--primary-400)" : "var(--gray-200)", color: (nameDraft.trim() && nameDraft.trim() !== me.name) ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: (nameDraft.trim() && nameDraft.trim() !== me.name) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {t.nameSave}
                </button>
                <button className="portal-btn-quiet" onClick={() => setNameDraft(null)}
                  style={{ height: "30px", padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.nameCancel}
                </button>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)", wordBreak: "break-word" }}>{me?.name ?? SIGNED_IN_USER.name}</span>
                {/* Only when the signed-in address matches a real account. With no match there is
                    no record to write to, and a button that edits nothing is worse than none. */}
                {me && (
                  <button className="portal-btn-outline" onClick={() => setNameDraft(me.name)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0, height: "24px", padding: "0 9px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <Pencil size={11} strokeWidth={2.2} />
                    {t.nameEdit}
                  </button>
                )}
              </span>
            )}
          </PairItem>
          <PairItem label={t.email}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)", wordBreak: "break-word" }}>{me?.email ?? SIGNED_IN_USER.email}</span>
              {/* One line, and only the half a reader cannot see: that it changes somewhere, and
                  where. Not a paragraph about why — the reasoning belongs in the comment above
                  and in the panel that does the changing. */}
              <span style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.emailElsewhere}</span>
            </div>
          </PairItem>
          {accountPairs.map(r => <PairItem key={r.label} label={r.label}>{r.value}</PairItem>)}
          {/* A pair like the others, whose value is a button rather than a fact: the sentence
              under "Password" is the only thing this page can honestly say about one — never the
              password itself, and not a row of dots pretending to be its length. */}
          <PairItem label={t.password}>
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
      )}

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
      {/*
        WHEN A CHANGE TAKES EFFECT, SAID ONCE PER TAB (2026-09-29).

        One Settings screen was teaching three rules: this tab applied every dropdown and switch
        the moment it moved and said nothing; the Mail tab had 「팀 기본값 저장」 dark from the
        start with no reason given, beside 「이 프로젝트만 저장」 lit before a single field had
        been touched. Three behaviours, none of them stated.

        The rule settled on is one rule with two shapes, which is what the controls themselves
        already are: A SINGLE VALUE APPLIES AS YOU SET IT, A FORM OF SEVERAL FIELDS IS SAVED. A
        timezone, a retention, a watermark and the network override are each one decision with one
        answer and nothing to review before committing; an SMTP relay is five fields that are wrong
        in every intermediate state, so saving it half-typed would break invitations. What is gone
        is the third behaviour: no button on this screen is lit before something has changed, and
        no dark button is silent about why.

        `desc` rather than `hint`, deliberately — CardSection's own note reserves desc for what has
        to be read without asking, and whether a screen has already saved your change is exactly
        that. It is also the one thing here a reader cannot learn by looking.
      */}
      {active === "project" && project && (
        <CardSection heading={t.projectTitle} icon={<MapPin size={15} strokeWidth={2.2} />}>
          <PairGrid spaced>
            {/* Editable, at last. Every handover starts with a test project and a typo, and
                there was no renameProject anywhere in the codebase — the first name a project
                was given was the only one it would ever have. */}
            <PairItem label={t.projectName}>
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
            <PairItem label={t.projectType}>{typeLabel(project.type)}</PairItem>
            {projectTeam && <PairItem label={t.projectTeam}>{projectTeam.name}</PairItem>}
            {projectTeam?.region && <PairItem label={t.projectRegion}>{projectTeam.region}</PairItem>}
            {/* The one editable pair on the card, in the same shape as the four above it: the
                control sits where a value would, rather than being pushed to the far right of a
                ruled row. A setting is a value you can change, and it should look like the values
                it sits with. */}
            {/* A select that opens and then refuses is worse than a value that never looked
                editable — the same rule the Users table's permission cell follows. */}
            <PairItem label={t.projectTimeZone} hint={t.timeZoneNote}>
              {mayEdit ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <FilterSelect
                  value={project.timeZone ?? PROJECT_TIME_ZONE}
                  onChange={zone => { setProjectTimeZone(project.id, zone); showToast({ variant: "success", title: t.settingSaved, desc: t.projectTimeZone }); }}
                  options={TIME_ZONE_OPTIONS}
                  fitContent
                />
                <LastChanged projectId={project.id} target="Time zone" lang={lang} t={t} />
                </span>
              ) : (
                TIME_ZONE_OPTIONS.find(o => o.value === (project.timeZone ?? PROJECT_TIME_ZONE))?.label
                  ?? (project.timeZone ?? PROJECT_TIME_ZONE)
              )}
            </PairItem>
            {/* The number that ends up in an ordinance, a contract and a privacy notice — and
                until now the product had nowhere to put it, so it lived in whoever set up the
                recorder. Beside the timezone because it is the same kind of value: it belongs to
                the site rather than to the person looking, and changing it is audited.

                Owner only. This is closer to a policy than a preference — the same gate the
                search purposes and VIP categories sit behind.

                The note under it used to end "the recorder and the server delete on this number",
                which was a claim about machines nothing here talks to. setProjectRetention writes
                the project object and an audit line and stops; no request leaves the browser. The
                store's own note on retentionDays says recording the policy is NOT enforcing it and
                that the screen has to say so out loud — that sentence said the opposite. It is not
                a harmless overstatement either: the erasure-request screen quotes this value back
                as the schedule footage is deleted on, so a wrong answer here is repeated to the
                person asking to be erased.

                HANDOFF: the sentence becomes true when saving carries the number out of the
                console — PUT /api/portal/projects/:id/retention, or whatever the deletion job
                reads, called from setProjectRetention (or from a caller that can report a
                failure, since a retention the recorder rejected must not read as saved). Until
                then the note describes what saving does, which is to write it down. When that
                call exists, restore the second sentence and delete this paragraph. */}
            <PairItem label={t.retention} hint={t.retentionNote}>
              {maySetPolicy ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <FilterSelect
                  value={project.retentionDays === undefined ? "" : String(project.retentionDays)}
                  onChange={v => { setProjectRetention(project.id, v === "" ? null : Number(v)); showToast({ variant: "success", title: t.settingSaved, desc: t.retention }); }}
                  options={RETENTION_OPTIONS(t)}
                  fitContent
                />
                <LastChanged projectId={project.id} target="Retention period" lang={lang} t={t} />
                </span>
              ) : (
                project.retentionDays === undefined ? t.retentionUnset : t.retentionDaysLabel(project.retentionDays)
              )}
            </PairItem>
            {/* Beside recording retention because it is the same kind of value — the site's, not the
                viewer's, and audited when it changes — but it is NOT the same promise, and the two
                notes have to differ. Recording retention is written down and nothing here acts on
                it. This one acts: it fills the end date on every registration, and an expired
                listing stops raising detections in the app.

                Why it exists at all: the number was a deploy-time constant, so the console filled
                every registration's end date from a rule the administrator could not see or
                change. Verkada has no expiry on a person of interest and removes them by hand;
                Avigilon keeps retention as a system setting with a days figure. Ours is the second
                shape, and this row is the setting that shape needs — with manual removal still
                there in the row menu for the case that cannot wait for a date.

                Owner only, like the rest of this grid. A period is closer to a policy than a
                preference: it decides how long a face is kept. */}
            {/* "미정" WOULD BE A LIE HERE, and that is the one difference from the row above.
                Recording retention genuinely has no value until somebody sets it — nothing applies
                and nothing deletes. This one always has a value: with the site unset, the
                deployment default fills every registration's end date, and the registration form
                says so out loud ("기본 보유기간 — 오늘부터 365일"). So the empty choice is labelled
                with the number it inherits, and reads as a fallback rather than a blank. */}
            <PairItem label={t.vipRetention} hint={t.vipRetentionNote}>
              {maySetPolicy ? (
                <span style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <FilterSelect
                  value={project.vipRetentionDays === undefined ? "" : String(project.vipRetentionDays)}
                  onChange={v => { setProjectVipRetention(project.id, v === "" ? null : Number(v)); showToast({ variant: "success", title: t.settingSaved, desc: t.vipRetention }); }}
                  options={VIP_RETENTION_OPTIONS(t)}
                  fitContent
                />
                <LastChanged projectId={project.id} target="VIP listing period" lang={lang} t={t} />
                </span>
              ) : (
                project.vipRetentionDays === undefined ? inheritedVipRetentionLabel : t.retentionDaysLabel(project.vipRetentionDays)
              )}
            </PairItem>
            {/* WHETHER FRAMES CARRY THE NAME OF WHOEVER IS LOOKING. In this grid because it is the
                same kind of value as the three above it: the site's rather than the viewer's, and
                audited when it changes — turning it off is somebody removing a traceability
                control, and setEvidenceWatermark writes that line either way.

                Owner only, the same gate as the two retention rows: this is a policy, not a
                preference, and a switch that flips and then refuses is worse than a value that
                never looked editable.

                THE NOTE SAYS WHAT IS LOST, NOT WHAT IS PREVENTED. A watermark stops no
                screenshot — no browser can, and a phone pointed at the monitor beats every native
                trick — so nothing here may read as protection. What it buys is attribution, which
                is why the off state carries the consequence in the open rather than in the tip:
                from then on a still on its own cannot be tied back to a session. The access log is
                named in the same breath because it is NOT affected, and an administrator reading
                "no viewer recorded" would otherwise reasonably fear it was. */}
            <PairItem label={t.watermark} hint={t.watermarkNote}>
              {maySetPolicy ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Absent means on — see Project.evidenceWatermark. */}
                    <Switch
                      checked={project.evidenceWatermark !== false}
                      onChange={on => { setEvidenceWatermark(project.id, on); showToast({ variant: "success", title: t.settingSaved, desc: t.watermark }); }}
                      label={t.watermark}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                      {project.evidenceWatermark !== false ? t.watermarkOn : t.watermarkOff}
                    </span>
                    <LastChanged projectId={project.id} target="Viewer watermark" lang={lang} t={t} />
                  </div>
                  {project.evidenceWatermark === false && (
                    <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.watermarkOffNote}</p>
                  )}
                </div>
              ) : (
                project.evidenceWatermark !== false ? t.watermarkOn : t.watermarkOff
              )}
            </PairItem>
          </PairGrid>

          {/* Deleting the site belongs to the project, so it lives in the project's tab — but at
              the foot of it, behind a rule, after everything anybody actually comes here to change.
              It had its own tab for a while, and that was the wrong kind of quiet: a tab is a
              standing entry in the rail, so the heaviest thing on this screen was the one item
              always on display. Down here it is found by whoever is already dealing with the
              project and passed over by everybody else.

              Owner only. This belongs with granting roles, not with changing a timezone. */}
          {mayDeleteProject && (
            <div style={{ marginTop: "26px", paddingTop: "20px", borderTop: BORDER }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.dangerTitle}</p>
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "4px" }}>{t.deleteProjectHint}</p>
              {/* Under its own words, flush with them. space-between held the button at the far
                  edge of the column, so the sentence explaining it and the thing it explains were
                  half a column apart and the hover tint landed nowhere near the text — read as a
                  stray control rather than the end of this paragraph. */}
              <button className="portal-btn-outline-danger" onClick={() => { setDeleteEcho(""); setConfirmingDelete(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 12px", marginTop: "12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Trash2 size={13} strokeWidth={2.2} />
                {t.deleteProject}
              </button>
            </div>
          )}

        </CardSection>
      )}

      {confirmingDelete && project && (
        /* Type the name back. A red button on a dialog is a click; a project holds a city's
           cameras and a VIP registry of named people, and the count of what goes is printed above
           the field so the number is read before the name is typed. */
        <ConfirmModal
          title={t.deleteConfirmTitle(project.name)}
          body={t.deleteConfirmBody}
          confirmLabel={t.deleteConfirmLabel}
          cancelLabel={t.renameCancel}
          danger
          // 본문이 길다: 문단 둘 + 마지막 프로젝트 경고 + 이름 되쓰기 칸. 짧은 화면에서 이
          // 확인창이 자기 버튼을 밖으로 밀어냈다. 본문에 드롭다운이 없으므로 스크롤이
          // 잘라낼 목록도 없다 — 그게 이 prop이 옵트인인 이유다(PortalShared 참조).
          bodyScrolls
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
            <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>
              {t.deleteConfirmCounts(
                cameras.filter(c => c.projectId === project.id).length,
                persons.filter(pp => pp.projectId === project.id).length,
                staffRoster.filter(r => r.projectId === project.id).length,
              )}
            </p>
            {isLastProjectInTeam && (
              <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.deleteLastProject}</p>
            )}
            <TextField value={deleteEcho} onChange={setDeleteEcho} placeholder={project.name} autoFocus />
          </div>
        </ConfirmModal>
      )}

      {/*
        Search purposes — the institution's own list, and the reason the app's purpose gate can be
        satisfied at all.

        Here rather than on the VIP screen (where VIP categories are managed) because a
        purpose is not a project's: it belongs to the institution, and the operator declaring one is
        in the monitoring app, not in this console. Settings is where the things that govern every
        site live.
      */}
      {/*
        VIP categories, alongside the purposes for the same reason: both are the team's
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
      {active === "mail" && myTeam && (
        <CardSection heading={t.mailRailLabel} icon={<Mail size={15} strokeWidth={2.2} />} subheading={`${t.teamMailTitle} · ${myTeam.name}`} hint={t.teamMailIntro}>
          {/* No maxWidth of its own any more — the section's content column is the cap, and two
              of these grids with two different ones is how columns stop lining up between
              sections. */}
          {/* Row gap 28, column gap 14 (owner, 2026-09-29: 위에도 동일하게 사이 공간 여백).
              The project block below now separates its subjects at 28 and this half was still at
              the form gap, so the same card read at two rhythms. The columns stay tight — a pair
              side by side is one line of the form, and pushing those apart would separate the
              wrong thing. */}
          {/* TWO COLUMNS, CAPPED — not auto-fit (2026-09-30).
              auto-fit was sized for the 880px card this page used to have, where it settled on two.
              With the sections moved to a strip above, the card is 1040 and the same rule opened it
              to FOUR: 메일 도메인 · SMTP 호스트 · 사용자 · 비밀번호 all on one line, each field
              232px with its hint crushed into three lines, and the username/password pair no longer
              reading as a pair. A form does not get better by getting wider — the values here are a
              hostname, a port and an address. So the COUNT stays at two — but the block is no
              longer capped inside the card (owner, 2026-09-30: 큰 박스 안에 오른쪽 여백 없게
              채워줘). A capped form inside a bordered card left a band of white down the right of
              the box, which reads as a section that stopped rather than one sized on purpose. The
              card holds the measure now, and the two tracks divide it. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "28px 24px" }}>
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailDomain}</label>
              <TextField value={mailDomain} onChange={setMailDomain} placeholder="company.local" />
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "6px" }}>{t.teamMailDomainHint}</p>
            </div>
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailHost}</label>
              <TextField value={mailHost} onChange={setMailHost} placeholder="mail.company.local" />
            </div>
            {/* THE RELAY'S CREDENTIALS (2026-09-30). The form took a host, a port and a from-address
                and stopped, so it described a relay that needs no account — which left whoever builds
                the server to guess between "unauthenticated relay" and "credentials go in somewhere
                else". Most relays want an account, so the form asks for one, and both fields empty
                still says the honest thing: this one does not. */}
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailUser}</label>
              <TextField value={mailUser} onChange={setMailUser} placeholder="vca@company.local" autoComplete="off" />
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "6px" }}>{t.teamMailUserHint}</p>
            </div>
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailPass}</label>
              <TextField value={mailPass} onChange={setMailPass} type="password" autoComplete="new-password" />
              {/* Says whether one is on file, never what it is. */}
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "6px" }}>
                {mailHasPass ? t.teamMailPassSet : t.teamMailPassNone}
              </p>
            </div>
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailPort}</label>
              <TextField value={mailPort} onChange={v => setMailPort(v.replace(/[^0-9]/g, ""))} placeholder="587" inputMode="numeric" />
              {/* Said, not merely enforced. The save button already greyed itself out for a bad
                  port and gave no reason anywhere on the screen. */}
              {mailPortIssue && <FieldError>{FIELD_CHECK_T[lang][mailPortIssue]}</FieldError>}
              {/* TLS BELONGS TO THE PORT (owner, 2026-09-29: TLS 사용 체크는 포트에 붙여야하는
                  내용이야? / 그럼 더 가까이 둬). It does: 587 is STARTTLS, 465 is implicit TLS,
                  25 is plain, and the two answers are set together or one of them is wrong. It sat
                  on its own line under the whole grid, which read as a fifth setting rather than
                  as the other half of this one. Inside the port's cell the relationship is the
                  layout, not a gap somebody has to read meaning into. */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-600)", marginTop: "8px" }}>
                <input type="checkbox" checked={mailTls} onChange={e => setMailTls(e.target.checked)} disabled={!mayEdit} />
                {t.teamMailTls}
              </label>
            </div>
            <div>
              <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.teamMailFrom}</label>
              <TextField value={mailFrom} onChange={setMailFrom} placeholder="vca-noreply@company.local" />
              {mailFromMismatch && (
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.45, marginTop: "6px" }}>{t.teamMailFromMismatch(mailDomain.trim())}</p>
              )}
            </div>
          </div>
          {/* ONE LINE BESIDE THE BUTTON, never a paragraph of its own above it (owner,
              2026-09-29: 이거는 버튼 옆에 놔도될것같은데).
              
              「저장만 할 뿐 연결을 시험하지는 않습니다」 is about what PRESSING SAVE does, so it
              belongs where the pressing happens. And it takes turns with the blocked reason rather
              than stacking under it: while saving is refused there is no save to qualify, so the
              screen says why it is refused; once it is allowed, it says what saving will and will
              not do. The reason sits beside the button rather than in a `title` because a disabled
              button gets no hover in some browsers and none at all on touch. */}
          {/* THE BUTTON ARRIVES WITH THE CHANGE, AND SITS AT THE RIGHT END (owner, 2026-09-30:
              액션버튼 2개를 오른쪽으로 보내줘 · 변경사항이 있을 때 버튼이 생기게 하면 어때).

              A save button on a settled form is a control with nothing to do, sitting under every
              field on every visit and asking to be pressed. `liveMail` is already exactly the
              answer — it is null until somebody types, and saveTeamMail sets it back to null — so
              the button is drawn only while there is something to write.

              The sentence stays put, which is what keeps the row from jumping: it holds the line's
              height whether or not the button is there, so the block below does not move when the
              first keystroke lands. And it reads better on the left now — the note explains what
              pressing will do, so it comes before the thing you press. */}
          <div style={{ marginTop: "28px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap", minHeight: CONTROL_HEIGHT }}>
            <span style={{ flex: 1, minWidth: "200px", fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>
              {teamMailBlockedReason ?? t.teamMailUnverified}
            </span>
            {liveMail !== null && (
              <button className="portal-btn-primary" onClick={saveTeamMail} disabled={!canSaveTeamMail}
                style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: canSaveTeamMail ? "var(--primary-400)" : "var(--gray-200)", color: canSaveTeamMail ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSaveTeamMail ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0 }}>
                {t.teamMailSaveScoped}
              </button>
            )}
          </div>
          {/*
            THE PROJECT'S EXCEPTION, IN THE SAME CARD.

            This whole block was a tab of the Server & API screen, which filed "where do
            invitations leave from" among the recording and analytics nodes; Milestone and Genetec
            both keep mail in system settings and their servers elsewhere. Brought here it first
            became a second section, which gave one rail entry two headings over the same four
            field names — two records reading as one thing duplicated. It is a named scope under
            the team default now, with its own save, because saving one must not write the other.
          */}
          {project && <ProjectMailPanel projectId={project.id} />}
        </CardSection>
      )}

      {active === "categories" && myTeamId && (
        <CardSection heading={t.categoryTitle} icon={<Tag size={15} strokeWidth={2.2} />}>
          {/* Nothing to manage yet, so the button offers to make the first one.
              "Manage categories" beside "0 categories in use" offered to administer an empty list,
              which reads as a dead end — and the count said the same nothing twice. The dashed box
              is the shape the rest of Portal uses for "this is empty on purpose, not broken", and
              the button inside it names the only move there is.

              Both buttons are bordered now. The quiet borderless one sat beside a count and read
              as part of the sentence rather than as something to press — the same thing that was
              wrong with the licence install button. */}
          {teamCategories.filter(c => !c.archived).length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px",
              padding: "22px", borderRadius: "12px", border: "1px dashed var(--gray-300)",
            }}>
              <p style={{ fontSize: "13px", color: "var(--gray-500)" }}>{t.categoryNone}</p>
              <button className="portal-btn-outline" onClick={() => setManagingCategories(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Plus size={14} strokeWidth={2.4} />
                {t.categoryAdd}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>
                {t.categoryCount(teamCategories.filter(c => !c.archived).length)}
              </span>
              <button className="portal-btn-outline" onClick={() => setManagingCategories(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Tag size={13} strokeWidth={2.4} />
                {t.categoryManage}
              </button>
            </div>
          )}
        </CardSection>
      )}

      {managingCategories && myTeamId && (
        <VipCategoryModal
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
      {active === "purposes" && requirePurpose && myTeamId && (
        <CardSection heading={t.purposeTitle} icon={<ClipboardList size={15} strokeWidth={2.2} />}>
          {/* What the empty list actually costs, said here rather than only in the app. An
              administrator who has not built this list needs to know that the requirement is on and
              unmet — otherwise the console looks configured and the gate quietly waves everyone
              through. */}
          {requirePurpose && activePurposes.length === 0 && (
            <p style={{
              padding: "10px 12px", marginBottom: "12px", borderRadius: "8px", maxWidth: "fit-content",
              backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
              fontSize: "12px", fontWeight: 700, lineHeight: 1.5,
            }}>{t.purposeRequirementOn}</p>
          )}
          <SearchPurposeList t={t} teamId={myTeamId} purposes={teamPurposes} canEdit={maySetPolicy} />
        </CardSection>
      )}

      {active === "display" && (
      <CardSection heading={t.displayTitle} icon={<Monitor size={15} strokeWidth={2.2} />}>
        <PairGrid>
          <PairItem label={t.language} hint={t.languageNote}>
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
      )}

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
 * Two steps: prove it is you, then choose. All three fields used to sit on one form, so the only
 * moment you learned the current password was wrong was after composing a new one and typing it
 * twice — and the answer threw that work away. The check belongs before the writing, not after.
 *
 * HANDOFF NOTE: submits nowhere, and neither step is real yet.
 *
 *   Step 1  POST /api/portal/account/password/verify  — the ONLY thing that can answer this. The
 *           front end must never guess: a field that says "wrong password" without asking the
 *           server is inventing an answer. **It needs login's throttling** — this is a password
 *           oracle sitting behind an authenticated session, so the same 5-attempts-in-15-minutes
 *           lockout the backend already applies to sign-in applies here, or this endpoint becomes
 *           the cheapest way to brute-force a password that sign-in refuses to.
 *   Step 2  POST .../password — send the verified current password with the new one anyway. A
 *           server that trusts step 1's say-so trusts the client; and between the two steps the
 *           session can be revoked, so step 2 re-checks or the revocation did nothing.
 *
 * Everything the front end *can* judge is still judged here: the format rule, and the two new
 * entries matching. Everything it cannot, it says out loud instead of miming: the modal carries a
 * standing "not connected yet" line and the last step closes on a toast saying the password was
 * not changed. Those two are the copy half of this note — restore success wording when the two
 * endpoints above answer, and not one release earlier.
 */
function ChangePasswordModal({ t, lang, onClose }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  lang: "en" | "ko";
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"verify" | "change">("verify");
  const { showToast } = useToast();

  const formatValid = isPasswordFormatValid(next);
  // Only once something has been typed in the confirm box. A mismatch warning that appears on an
  // empty field is telling somebody off for not having finished.
  const mismatch = confirm.length > 0 && confirm !== next;
  const canVerify = current.length > 0;
  const canSubmit = formatValid && confirm.length > 0 && !mismatch;
  /* Handed to the shared panel's discard guard. Once anything has been typed, a stray scrim click
     or an Escape asks first rather than dropping a password that was composed once and typed
     twice; ✕ and 취소 stay immediate, because those are aimed. */
  const dirty = current.length > 0 || next.length > 0 || confirm.length > 0;

  /* Advances on any non-empty entry, because there is nothing here that could disagree. That is
     the mock, not the design — see the HANDOFF NOTE. The screen deliberately says nothing like
     "correct", only that the step is done, so the day it is wired the wrong-password path is an
     addition rather than a contradiction. */
  const verify = () => {
    if (!canVerify) return;
    setStep("change");
  };

  const submit = () => {
    if (!canSubmit) return;
    onClose();
    /* Not a success toast, because nothing succeeded. The form validates what a browser can
       validate and then has nowhere to send it; a green "Password changed" over that is the exact
       failure this codebase keeps finding — a plausible answer nobody can tell from a real one.
       The person is told what did not happen and what to do instead, and the day the endpoint
       below exists this goes back to being a success line. */
    showToast({ variant: "info", title: t.passwordNotSaved, desc: t.passwordNotSavedBody });
  };

  /*
   * Enter submits, on both steps (owner, 2026-09-29: 엔터키로도 확인버튼 눌리게 해주면 좋겠어
   * 이게 다 pc(데스크톱)기반일거라서).
   *
   * Hands stay on the keyboard through a password form — you type it, and on a one-field step
   * reaching for the mouse to press the only button on screen is the kind of thing that reads as
   * a form that has not finished loading. Guarded by the same `canVerify`/`canSubmit` the buttons
   * use, so Enter can never do what the button would refuse to do.
   */
  const onEnter = (run: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); run(); }
  };

  /** `trailing` puts a control on the field's own line — see the verify step. */
  const field = (label: string, value: string, onChange: (v: string) => void, autoComplete: string, hint?: React.ReactNode, onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>, trailing?: React.ReactNode) => (
    <div>
      <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{label}</label>
      {trailing ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField value={value} onChange={onChange} onKeyDown={onKeyDown} type="password" autoComplete={autoComplete} autoFocus />
          </div>
          {trailing}
        </div>
      ) : (
        <TextField value={value} onChange={onChange} onKeyDown={onKeyDown} type="password" autoComplete={autoComplete} />
      )}
      {hint}
    </div>
  );

  return (
    /* THE SHARED RIGHT-HAND PANEL NOW (owner, 2026-09-22: 중앙 모달로 뜨는 폼은 전부 공용 오른쪽
       패널로). The scrim, the full-height panel, the header with its ✕, Escape, the discard
       confirmation and the footer row that stays put are all the `Drawer`'s, so nothing here draws
       them by hand any more — and it draws no rule under the header or over the footer, which is
       why there is none to put back. Both steps are exactly the steps that were here before: the
       container moved, the form did not. */
    <Drawer title={t.changePassword} onClose={onClose} dirty={dirty}
      /* The verify step's button is NOT here any more — it sits against the field it acts on, so
         the footer carries the way out alone. Moved rather than duplicated: two buttons doing one
         thing on a two-line panel was the thing this console already decided against. */
      footer={step === "verify" ? (
        <PanelCancel onClick={onClose} label={t.cancel} />
      ) : (
        <>
          <PanelCancel onClick={onClose} label={t.cancel} />
          <PanelPrimary onClick={submit} label={t.updatePassword} disabled={!canSubmit} />
        </>
      )}>
      <>
        <div style={{ padding: "0 20px" }}>
          {/* Which of the two steps you are on. Named, not numbered: "1 / 2" tells you where you
              are, "Confirm it is you" tells you what is being asked. */}
          <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>
            {step === "verify" ? t.verifyStep : t.changeStep}
          </p>
          {/* Said before the typing rather than after it, on both steps, for the same reason the
              current-password check was split off into its own: a person should learn that this
              goes nowhere before composing a password and entering it twice, not in the toast that
              follows. Amber, because a quiet grey line is not enough weight to stop somebody
              believing a form that otherwise behaves exactly like a working one. */}
          <p style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--warning-500)", marginTop: "8px" }}>
            {t.passwordNotWired}
          </p>
        </div>
        {step === "verify" ? (
          /* THE BUTTON AGAINST THE FIELD (owner, 2026-09-29: 확인버튼이 인풋창 바로옆에 붙어서
             클릭하기 쉽게해줬으면 좋겠어). One field and one answer: the button was at the far
             bottom of a full-height panel, so confirming a password you had just typed meant
             crossing the whole panel to reach the only thing that could act on it. */
          <div style={{ padding: "16px 20px 20px" }}>
            {field(t.currentPassword, current, setCurrent, "current-password", undefined, onEnter(verify),
              <PanelPrimary onClick={verify} label={t.verify} disabled={!canVerify} />)}
          </div>
        ) : (
          /* Nothing here restates step 1.
   
             It briefly had a "current password confirmed" box, and a button in it to go back.
             The button went first — once the server answers step 1, a wrong password never
             reaches this screen, so it only existed because the mock lets anything through. The
             box followed for the same kind of reason: the subtitle above already says "choose a
             new password", and being on this step IS the confirmation. A panel repeating it was
             height spent on a fact the reader already has. Cancel is the way out. */
          <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {field(t.newPassword, next, setNext, "new-password",
              /* The rule under the field, not in a tooltip: it should be readable before it is
                 broken rather than after. Amber only once what is typed breaks it. */
              <p style={{ marginTop: "6px", fontSize: "11px", lineHeight: 1.45, color: next.length > 0 && !formatValid ? "var(--warning-500)" : "var(--gray-400)" }}>
                {PASSWORD_RULE_TEXT[lang]}
              </p>, onEnter(submit))}
            {field(t.confirmPassword, confirm, setConfirm, "new-password",
              mismatch ? <p style={{ marginTop: "6px", fontSize: "11px", lineHeight: 1.45, color: "var(--warning-500)" }}>{t.mismatch}</p> : undefined, onEnter(submit))}
          </div>
        )}
      </>
    </Drawer>
  );
}

/**
 * The institution's list of search purposes: what is on it, and how to add to it.
 *
 * Opens empty and says so. No example row, for the same reason the VIP registry categories have none
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
        <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.purposeEmpty}</p>
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
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.purposeOwnerOnly}</p>
      ) : creating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", border: BORDER, borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
          <div>
            <label style={{ ...PAIR_LABEL, display: "block", marginBottom: "6px" }}>{t.purposeLabelField}</label>
            <TextField value={label} onChange={setLabel} placeholder={t.purposeLabelPlaceholder} autoFocus />
          </div>
          {/* Off by default, unlike the VIP registry category's basis. A purpose is declared once a
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
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.purposeRetireNote}</p>
      )}
    </div>
  );
}
