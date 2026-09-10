"use client";

import { useEffect, useRef, useState } from "react";
// 2.4, not 1.4: lucide draws in a 24-unit box and this renders at 14px — see ICON_STROKE_PX.
import { AlertTriangle, ArrowDownWideNarrow, Eye, ImageOff, RefreshCw, Users } from "lucide-react";
import { canSetPolicy, currentPortalUser, registryHealth, useVcaStore, type Person, type PersonGroup, type WatchlistCategory } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { TABLE_HEADER_COLOR, ActiveFilterCount, TextField, FIELD_STYLE, FIELD_FOCUS, BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, ConfirmModal, FilterSelect, RowActionsMenu, SortableHeader, SummaryStrip, Tooltip, sortRows, useTableSort, usePortalEditAccess } from "./PortalShared";
import { WatchlistCategoryModal, categoryTint } from "./WatchlistCategories";

type VipSortKey = "name" | "priority" | "registered" | "lastDetected" | "expires";

// 36px for the actions column, the width RowActionsMenu gets in every other table.
const VIP_GRID = "48px 1.2fr 0.8fr 0.6fr 0.7fr 0.7fr 0.8fr 0.8fr 36px";
/** The All tab adds a Group column; the Individuals tab would print "Individual" on every row. */
const VIP_GRID_WITH_GROUP = "48px 1.1fr 0.75fr 0.75fr 0.55fr 0.65fr 0.65fr 0.7fr 0.7fr 36px";
const GROUP_GRID = "1.5fr 0.6fr 0.8fr 1.6fr 36px";

const PRIORITY_LABELS: NonNullable<Person["priorityLabel"]>[] = ["normal", "high", "very_high"];

/* A field is quoted when it holds a comma, a quote or a newline, and inner quotes are doubled.
   TODO: this is the fifth copy in Portal (cameras, roster, roster import, search log) — one
   src/lib/csv.ts, once no other session has those files open. */
function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
const PRIORITY_COLOR: Record<NonNullable<Person["priorityLabel"]>, { bg: string; color: string }> = {
  normal: { bg: "var(--gray-100)", color: "var(--gray-600)" },
  high: { bg: "var(--warning-200)", color: "var(--warning-500)" },
  very_high: { bg: "var(--danger-100)", color: "var(--danger-500)" },
};

// Priority values stored on Person are canonical English identifiers (see PRIORITY_LABELS above
// and the seed data in vcaStore.ts) — kept stable across languages so existing records don't shift
// meaning when the display language changes. T.priorityText below only translates how each
// identifier is *displayed*.
//
// There was a "Role" beside it — Regular / Lead / Captain / Health / Special, asked for on the
// register form and printed in a table column. Nothing read it: no filter, no alert, no camera
// behaviour, and it had already come off the cards. Its vocabulary was not this product's either
// ("Captain" and "Health" are a team's roles, not a watchlist's). A field an administrator is
// asked to fill and nothing acts on is a question with no answer, so it is gone — group and
// priority are what classify a face here.
interface VipDict {
  bulkUpload: string;
  registerVip: string;
  searchPlaceholder: string;
  sortByPriority: string;
  allGroups: string;
  allPriorities: string;
  noGroup: string;
  filtersActive: (n: number) => string;
  noSearchResults: string;
  noVips: string;
  noVipsHint: string;
  registered: (date: string) => string;
  viewGrid: string;
  viewTable: string;
  colName: string;
  exportCsv: string;
  csvRegisteredBy: string;
  csvStatus: string;
  csvNever: string;
  csvUnclassified: string;
  csvStatusActive: string;
  toastVipExportTitle: string;
  toastVipExportDesc: (n: number) => string;
  colPriority: string;
  healthMissingPhoto: string;
  healthMissingPhotoWhy: string;
  healthEmbeddingFailed: string;
  healthEmbeddingFailedWhy: string;
  healthReenrolling: string;
  photoUnreadableHint: string;
  photoReenrollingHint: string;
  healthReenrollingWhy: string;
  healthDuplicates: string;
  healthDuplicatesWhy: string;
  healthShowOnly: string;
  healthClear: string;
  healthPeopleUnit: string;
  healthOfTotal: (total: number) => string;
  colLastDetected: string;
  categoryLabel: string;
  categoryNone: string;
  manageCategories: string;
  basisLabel: string;
  basisPlaceholder: string;
  requiredMark: string;
  optionalMark: string;
  expiresLabel: string;
  expiresNote: string;
  noExpiryWarning: string;
  colCategory: string;
  colExpires: string;
  statusExpired: string;
  statusReleased: string;
  expiringInDays: (n: number) => string;
  noExpiry: string;
  releaseAction: string;
  reinstateAction: string;
  reinstateTitle: (name: string) => string;
  reinstateBody: string;
  reinstateReasonPlaceholder: string;
  reinstateConfirm: string;
  reinstatedToast: string;
  releaseTitle: (name: string) => string;
  releaseBody: string;
  releaseReasonLabel: string;
  releaseReasonPlaceholder: string;
  releaseConfirm: string;
  releasedToast: string;
  catModalTitle: string;
  catEdit: string;
  catModalIntro: string;
  catEmpty: string;
  catNew: string;
  catLabelField: string;
  catLabelPlaceholder: string;
  catValidDays: string;
  catValidDaysNone: string;
  catRequiresBasis: string;
  catColor: string;
  catArchive: string;
  catArchived: string;
  catArchiveNote: string;
  catCreate: string;
  catSave: string;
  catOwnerOnly: string;
  healthReachLabel: string;
  healthReachWhy: string;
  healthReachTrend: (prev: number) => string;
  healthReachFlat: string;
  colRegistered: string;
  colNote: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  removeAction: string;
  vipRemovedTitle: string;
  modalTitle: string;
  editModalTitle: (name: string) => string;
  saveEdit: string;
  noteLabel: string;
  notePlaceholder: string;
  editPerson: string;
  showGroupMembers: (name: string) => string;
  vipUpdatedTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  priorityLabel: string;
  facePhotoLabel: string;
  facePhotoLabelRequired: string;
  changePhoto: string;
  uploadPhoto: string;
  currentPhoto: string;
  cancel: string;
  register: string;
  priorityText: Record<NonNullable<Person["priorityLabel"]>, string>;
  bulkSuccessTitle: string;
  bulkEmptyTitle: string;
  bulkSuccessDesc: (count: number, fileName: string) => string;
  bulkEmptyDesc: string;
  // Tabs and groups
  tabAll: string;
  tabIndividuals: string;
  tabGroups: string;
  tabAllHint: string;
  tabIndividualsHint: string;
  tabGroupsHint: string;
  tabReleased: string;
  tabReleasedHint: string;
  addGroup: string;
  colGroup: string;
  colMembers: string;
  groupNone: string;
  noIndividuals: string;
  noGroups: string;
  groupModalAddTitle: string;
  groupModalEditTitle: string;
  groupNameLabel: string;
  groupNamePlaceholder: string;
  groupDescLabel: string;
  groupDescPlaceholder: string;
  groupSave: string;
  createGroupAction: string;
  editGroup: string;
  removeGroup: string;
  groupAddedTitle: string;
  groupUpdatedTitle: string;
  groupRemovedTitle: string;
  confirmRemoveGroupTitle: (name: string) => string;
  confirmRemoveGroupBody: (members: number) => string;
  groupKeepMembers: (members: number) => string;
  groupDeleteMembers: (members: number) => string;
  groupRemovedWithMembersTitle: (members: number) => string;
  close: string;
  detailNoNote: string;
}

const T: Record<"en" | "ko", VipDict> = {
  en: {
    bulkUpload: "Bulk Upload",
    registerVip: "Register VIP",
    searchPlaceholder: "Search by VIP name",
    sortByPriority: "Priority first",
    allGroups: "All groups",
    allPriorities: "All priorities",
    noGroup: "No group",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,
    noSearchResults: "No VIPs match this search.",
    noVips: "No VIPs registered for this project yet.",
    noVipsHint: "Register somebody, or import a list — each person becomes a face the cameras on this project match against.",
    registered: (date: string) => `Registered ${date}`,
    viewGrid: "Grid",
    viewTable: "Table",
    colName: "Name",
    exportCsv: "Export CSV",
    csvRegisteredBy: "Registered by",
    csvStatus: "Status",
    csvNever: "never",
    csvUnclassified: "unclassified",
    csvStatusActive: "active",
    toastVipExportTitle: "Export complete",
    toastVipExportDesc: (n: number) => `${n} watchlist record(s) exported to CSV.`,
    colPriority: "Priority",
    healthMissingPhoto: "no photo",
    healthMissingPhotoWhy: "On the watchlist with no face attached. A CSV import can add a name without a photo; these people cannot be matched until one is uploaded.",
    healthEmbeddingFailed: "photo unreadable",
    healthEmbeddingFailedWhy: "A photo is attached, but the model could not read a face out of it — too small, too dark or turned too far. Open the person and replace the photo; that is what clears it.",
    healthReenrolling: "awaiting re-enrolment",
    photoUnreadableHint: "The model could not read a face out of this photo, so this person cannot be matched by any camera. Replace it with a clearer, front-facing picture.",
    photoReenrollingHint: "A replacement photo has been submitted. Until the model answers, this person is still unmatchable.",
    healthReenrollingWhy: "A new photo has been submitted and the model has not answered yet. These people are still unmatchable until it does — a replaced photo is a question re-asked, not a fix confirmed.",
    healthDuplicates: "possible duplicates",
    healthDuplicatesWhy: "Two or more records that share a name. Usually the same person enrolled twice; the watchlist counts them twice either way.",
    healthShowOnly: "Show only these",
    healthClear: "Show everyone again",
    healthPeopleUnit: "people",
    healthOfTotal: (total: number) => `of ${total}`,
    colLastDetected: "Last detected",
    categoryLabel: "Category",
    categoryNone: "Unclassified",
    manageCategories: "Manage categories",
    basisLabel: "Basis for listing",
    basisPlaceholder: "Case or document reference",
    requiredMark: "required",
    optionalMark: "optional",
    expiresLabel: "Listing expires",
    expiresNote: "The listing stops on this date. Expired people stay on the list, marked.",
    noExpiryWarning: "No end date — this person stays on the watchlist until somebody removes them.",
    colCategory: "Category",
    colExpires: "Expires",
    statusExpired: "Expired",
    statusReleased: "Released",
    expiringInDays: (n: number) => `${n}d left`,
    noExpiry: "No end date",
    releaseAction: "Release from watchlist",
    reinstateAction: "Put back on the watchlist",
    reinstateTitle: (name: string) => `Put ${name} back on the watchlist?`,
    reinstateBody: "Cameras start matching them again. The release and this reversal both stay in the activity log.",
    reinstateReasonPlaceholder: "Released in error · Listing renewed",
    reinstateConfirm: "Reinstate",
    reinstatedToast: "Back on the watchlist",
    releaseTitle: (name: string) => `Release ${name}?`,
    releaseBody: "They come off the watchlist and cameras stop matching them. The row stays, marked as released, so the history survives.",
    releaseReasonLabel: "Reason",
    releaseReasonPlaceholder: "Found · Arrested · Listed in error",
    releaseConfirm: "Release",
    releasedToast: "Released from watchlist",
    catModalTitle: "Watchlist categories",
    catEdit: "Edit",
    catModalIntro: "Your own classification. Nothing is set up in advance — the words are yours, not ours.",
    catEmpty: "No categories yet. People can still be registered; they are listed as unclassified.",
    catNew: "New category",
    catLabelField: "Name",
    catLabelPlaceholder: "What your organisation calls it",
    catValidDays: "Default duration (days)",
    catValidDaysNone: "No default end date",
    catRequiresBasis: "Require a basis when listing under this",
    catColor: "Colour",
    catArchive: "Retire",
    catArchived: "Retired",
    catArchiveNote: "Retired categories cannot be chosen again. People already listed under them keep the label.",
    catCreate: "Create",
    catSave: "Save",
    catOwnerOnly: "Only the owner can change this list.",
    healthReachLabel: "people detected · 7 days",
    healthReachWhy: "How many people on the watchlist were seen at least once in the last 7 days — people, not detections. One person passing a camera twenty times counts once here.",
    healthReachTrend: (prev: number) => `vs ${prev} people last week`,
    healthReachFlat: "same as last week",
    colRegistered: "Registered",
    colNote: "Note",
    confirmRemoveTitle: "Remove this VIP?",
    confirmRemoveBody: "They will be removed from this project's watchlist. Cameras will no longer detect them as a registered VIP.",
    removeAction: "Remove",
    vipRemovedTitle: "VIP removed",
    modalTitle: "Add new person",
    editModalTitle: (name: string) => `Edit — ${name}`,
    saveEdit: "Save",
    noteLabel: "Note",
    notePlaceholder: "Corporate Security — Executive Protection",
    editPerson: "Edit",
    showGroupMembers: (name: string) => `Show the people in ${name}`,
    vipUpdatedTitle: "VIP updated",
    nameLabel: "Name *",
    namePlaceholder: "Alexander Wright",
    priorityLabel: "Priority",
    facePhotoLabel: "Face photo",
    facePhotoLabelRequired: "Face photo *",
    changePhoto: "Change",
    uploadPhoto: "Upload photo",
    currentPhoto: "Current photo",
    cancel: "Cancel",
    register: "Register",
    priorityText: { normal: "Normal", high: "High", very_high: "Very High" } as Record<NonNullable<Person["priorityLabel"]>, string>,
    bulkSuccessTitle: "Bulk upload complete",
    bulkEmptyTitle: "No rows imported",
    bulkSuccessDesc: (count: number, fileName: string) => `${count} VIP(s) registered from ${fileName}.`,
    tabAll: "All",
    tabIndividuals: "Individuals",
    tabGroups: "Groups",
    tabAllHint: "Every person registered for this project, whether or not they belong to a group.",
    tabIndividualsHint: "People registered on their own — nobody in a group.",
    tabGroupsHint: "Parties registered together: a visiting delegation, a protection detail. Removing a group keeps its members registered.",
    tabReleased: "Released",
    tabReleasedHint: "Taken off the watchlist, with a record of who did it and why. Cameras no longer match them — and nothing here has been deleted.",
    addGroup: "Add group",
    colGroup: "Group",
    colMembers: "Members",
    groupNone: "Individual",
    noIndividuals: "Everybody registered here belongs to a group.",
    noGroups: "No groups yet.",
    groupModalAddTitle: "Add group",
    groupModalEditTitle: "Edit group",
    groupNameLabel: "Group name *",
    groupNamePlaceholder: "City Hall delegation",
    groupDescLabel: "Note",
    groupDescPlaceholder: "Quarterly inspection visit",
    groupSave: "Save",
    createGroupAction: "Create",
    editGroup: "Edit",
    removeGroup: "Remove group",
    groupAddedTitle: "Group added",
    groupUpdatedTitle: "Group updated",
    groupRemovedTitle: "Group removed",
    confirmRemoveGroupTitle: (name: string) => `Remove ${name}?`,
    confirmRemoveGroupBody: (members: number) => members === 0
      ? "The group has no members. Nothing else changes."
      : `Choose what happens to its ${members} member(s). Kept, their faces stay enrolled and still match — only the party goes.`,
    groupKeepMembers: (members: number) => `Keep ${members}`,
    groupDeleteMembers: (members: number) => `Delete ${members} too`,
    groupRemovedWithMembersTitle: (members: number) => `Group and ${members} member(s) removed`,
    close: "Close",
    detailNoNote: "No note",
    bulkEmptyDesc: "Expected CSV rows as \"name,description\".",
  },
  ko: {
    bulkUpload: "일괄 업로드",
    registerVip: "VIP 등록하기",
    searchPlaceholder: "VIP 이름으로 검색",
    sortByPriority: "우선순위순",
    allGroups: "전체 그룹",
    allPriorities: "전체 우선순위",
    noGroup: "그룹 없음",
    filtersActive: (n: number) => `필터 ${n}개`,
    noSearchResults: "검색 결과와 일치하는 VIP가 없습니다.",
    noVips: "이 프로젝트에 등록된 VIP가 아직 없습니다.",
    noVipsHint: "인물을 등록하거나 명단을 가져오면 됩니다 — 등록된 한 사람이 이 프로젝트의 카메라가 대조하는 얼굴 하나가 됩니다.",
    registered: (date: string) => `등록일 ${date}`,
    viewGrid: "그리드",
    viewTable: "테이블",
    colName: "이름",
    exportCsv: "CSV 내보내기",
    csvRegisteredBy: "등록자",
    csvStatus: "상태",
    csvNever: "없음",
    csvUnclassified: "미분류",
    csvStatusActive: "유효",
    toastVipExportTitle: "내보내기 완료",
    toastVipExportDesc: (n: number) => `명단 ${n}건이 CSV로 내보내졌습니다.`,
    colPriority: "우선순위",
    healthMissingPhoto: "사진 없음",
    healthMissingPhotoWhy: "명단에는 있지만 얼굴 사진이 없습니다. CSV로 가져오면 사진 없이 이름만 등록될 수 있고, 사진을 올리기 전까지는 매칭되지 않습니다.",
    healthEmbeddingFailed: "사진 인식 실패",
    healthEmbeddingFailedWhy: "사진은 있지만 모델이 얼굴을 읽어내지 못했습니다. 너무 작거나 어둡거나 옆을 봤을 때 생깁니다. 해당 인물을 열어 사진을 교체하면 풀립니다.",
    healthReenrolling: "재등록 대기",
    photoUnreadableHint: "이 사진에서 얼굴을 읽어내지 못했습니다. 어느 카메라에서도 이 인물은 매칭되지 않습니다. 정면이 선명한 사진으로 교체하세요.",
    photoReenrollingHint: "교체할 사진이 접수되었습니다. 모델의 답이 오기 전까지는 여전히 매칭되지 않습니다.",
    healthReenrollingWhy: "새 사진을 올렸고 모델의 답을 기다리는 중입니다. 답이 오기 전까지는 여전히 매칭되지 않습니다 — 사진 교체는 다시 물어본 것이지, 해결이 확인된 게 아닙니다.",
    healthDuplicates: "중복 의심",
    healthDuplicatesWhy: "이름이 같은 기록이 둘 이상입니다. 대개 같은 사람을 두 번 등록한 경우이고, 어느 쪽이든 명단에서는 두 명으로 셉니다.",
    healthShowOnly: "이 항목만 보기",
    healthClear: "전체 다시 보기",
    healthPeopleUnit: "명",
    healthOfTotal: (total: number) => `/ ${total}명`,
    colLastDetected: "마지막 탐지",
    categoryLabel: "분류",
    categoryNone: "미분류",
    manageCategories: "분류 관리",
    basisLabel: "등록 근거",
    basisPlaceholder: "사건번호 · 공문번호 등",
    requiredMark: "필수",
    optionalMark: "선택",
    expiresLabel: "등록 만료일",
    expiresNote: "이 날짜에 등록이 끝납니다. 만료된 사람은 목록에 표시된 채로 남습니다.",
    noExpiryWarning: "만료일 없음 — 누군가 내리기 전까지 계속 추적 대상입니다.",
    colCategory: "분류",
    colExpires: "만료",
    statusExpired: "만료됨",
    statusReleased: "해제됨",
    expiringInDays: (n: number) => `${n}일 남음`,
    noExpiry: "무기한",
    releaseAction: "명단에서 해제",
    reinstateAction: "명단에 다시 올리기",
    reinstateTitle: (name: string) => `${name}을(를) 명단에 다시 올릴까요?`,
    reinstateBody: "카메라가 다시 이 사람을 매칭합니다. 해제와 이번 복구 둘 다 변경 기록에 남습니다.",
    reinstateReasonPlaceholder: "잘못 해제함 · 등록 연장",
    reinstateConfirm: "다시 올리기",
    reinstatedToast: "명단에 다시 올렸습니다",
    releaseTitle: (name: string) => `${name}을(를) 해제할까요?`,
    releaseBody: "명단에서 내려가고 카메라가 더 이상 대조하지 않습니다. 행은 해제 표시와 함께 남아 이력이 보존됩니다.",
    releaseReasonLabel: "사유",
    releaseReasonPlaceholder: "발견 · 검거 · 착오 등록",
    releaseConfirm: "해제",
    releasedToast: "명단에서 해제했습니다",
    catModalTitle: "관심인물 분류",
    catEdit: "수정",
    catModalIntro: "기관이 직접 정의합니다. 미리 넣어둔 것은 없습니다 — 쓰는 말은 저희 것이 아니라 기관의 것입니다.",
    catEmpty: "아직 분류가 없습니다. 그래도 등록은 됩니다 — 미분류로 올라갑니다.",
    catNew: "분류 만들기",
    catLabelField: "이름",
    catLabelPlaceholder: "기관에서 부르는 이름",
    catValidDays: "기본 유효기간 (일)",
    catValidDaysNone: "기본 만료일 없음",
    catRequiresBasis: "이 분류로 등록할 때 근거를 필수로",
    catColor: "색",
    catArchive: "사용 중지",
    catArchived: "중지됨",
    catArchiveNote: "중지한 분류는 다시 고를 수 없습니다. 이미 등록된 사람의 표시는 그대로 남습니다.",
    catCreate: "만들기",
    catSave: "저장",
    catOwnerOnly: "이 목록은 최고관리자만 바꿀 수 있습니다.",
    healthReachLabel: "지난 7일간 탐지된 인원",
    healthReachWhy: "명단에 있는 사람 중 최근 7일 안에 한 번이라도 잡힌 인원 수입니다. 탐지 건수가 아니라 사람 수라서, 한 사람이 카메라 앞을 스무 번 지나가도 1로 셉니다.",
    healthReachTrend: (prev: number) => `지난주 ${prev}명`,
    healthReachFlat: "지난주와 같음",
    colRegistered: "등록일",
    colNote: "메모",
    confirmRemoveTitle: "정말 삭제하시겠습니까?",
    confirmRemoveBody: "이 프로젝트의 관심인물 목록에서 삭제됩니다. 이후 카메라는 이 인물을 등록된 VIP로 탐지하지 않습니다.",
    removeAction: "삭제",
    vipRemovedTitle: "VIP 삭제됨",
    modalTitle: "새 인물 추가",
    editModalTitle: (name: string) => `${name} 편집`,
    saveEdit: "저장",
    noteLabel: "메모",
    notePlaceholder: "기업 보안 — 임원 경호",
    editPerson: "편집",
    showGroupMembers: (name: string) => `${name} 소속 인원 보기`,
    vipUpdatedTitle: "VIP 정보를 수정했습니다",
    nameLabel: "이름 *",
    namePlaceholder: "홍길동",
    priorityLabel: "우선순위",
    facePhotoLabel: "얼굴 사진",
    facePhotoLabelRequired: "얼굴 사진 *",
    changePhoto: "변경",
    uploadPhoto: "사진 업로드",
    currentPhoto: "현재 사진",
    cancel: "취소",
    register: "등록",
    priorityText: { normal: "일반", high: "높음", very_high: "매우 높음" } as Record<NonNullable<Person["priorityLabel"]>, string>,
    bulkSuccessTitle: "일괄 업로드 완료",
    bulkEmptyTitle: "가져온 행이 없습니다",
    bulkSuccessDesc: (count: number, fileName: string) => `${fileName}에서 VIP ${count}명이 등록되었습니다.`,
    tabAll: "전체",
    tabIndividuals: "개인",
    tabGroups: "그룹",
    tabAllHint: "이 프로젝트에 등록된 사람 전부입니다. 그룹에 속했는지와 무관합니다.",
    tabIndividualsHint: "혼자 등록된 사람입니다 — 그룹에 속한 사람은 빠집니다.",
    tabGroupsHint: "함께 등록된 일행입니다: 방문단, 경호 대상. 그룹을 지워도 소속된 사람은 등록된 채로 남습니다.",
    tabReleased: "해제됨",
    tabReleasedHint: "명단에서 내려온 사람입니다. 누가 언제 왜 내렸는지가 함께 남습니다. 카메라는 더 이상 대조하지 않고, 삭제된 것은 아무것도 없습니다.",
    addGroup: "그룹 추가",
    colGroup: "그룹",
    colMembers: "인원",
    groupNone: "개인",
    noIndividuals: "여기 등록된 사람은 모두 그룹에 속해 있습니다.",
    noGroups: "아직 그룹이 없습니다.",
    groupModalAddTitle: "그룹 추가",
    groupModalEditTitle: "그룹 편집",
    groupNameLabel: "그룹 이름 *",
    groupNamePlaceholder: "시청 방문단",
    groupDescLabel: "메모",
    groupDescPlaceholder: "분기 정기 시찰",
    groupSave: "저장",
    createGroupAction: "만들기",
    editGroup: "편집",
    removeGroup: "그룹 삭제",
    groupAddedTitle: "그룹을 추가했습니다",
    groupUpdatedTitle: "그룹을 수정했습니다",
    groupRemovedTitle: "그룹을 삭제했습니다",
    confirmRemoveGroupTitle: (name: string) => `${name}을 삭제할까요?`,
    confirmRemoveGroupBody: (members: number) => members === 0
      ? "소속된 사람이 없습니다. 달라지는 것이 없습니다."
      : `소속된 ${members}명을 어떻게 할지 고르세요. 남기면 얼굴은 그대로 등록돼 있고 계속 인식됩니다 — 묶음만 사라집니다.`,
    groupKeepMembers: (members: number) => `${members}명은 남기기`,
    groupDeleteMembers: (members: number) => `${members}명도 삭제`,
    groupRemovedWithMembersTitle: (members: number) => `그룹과 ${members}명을 삭제했습니다`,
    close: "닫기",
    detailNoNote: "메모 없음",
    bulkEmptyDesc: "CSV 행은 \"이름,설명\" 형식이어야 합니다.",
  },
};

interface RegisterValues {
  name: string;
  /** Undefined = unclassified, which is a real state — see WatchlistCategory in the store. */
  categoryId?: string;
  basis?: string;
  /** Undefined = no expiry. */
  expiresAt?: string;
  priorityLabel: NonNullable<Person["priorityLabel"]>;
  description?: string;
  /** Undefined = an individual, i.e. in no group. */
  groupId?: string;
  photoUrl?: string;
}

/**
 * Register a face, or edit one already registered — the same five fields either way, so the same
 * form. Editing did not exist: a VIP could be registered and removed and nothing in between, so a
 * misspelled name meant deleting the enrolment and redoing it.
 *
 * The Note field is new to this form in both modes. It shows on the detail sheet and in the table,
 * and until now only the bulk CSV import could write it — a note could exist on a row that nobody
 * was able to type.
 */
function RegisterVipModal({ t, person, photoUnreadable, groups, categories, projectId, onClose, onSubmit, onManageCategories, escapeSuspended }: {
  t: VipDict;
  /** Absent = registering. Present = editing that person. */
  person?: Person;
  /** Whether the model could not read the photo on file. From registryHealth, which owns the
   *  predicate — recomputing it here would be a second opinion on the same question. */
  photoUnreadable?: boolean;
  groups: PersonGroup[];
  categories: WatchlistCategory[];
  projectId: string;
  onClose: () => void;
  onSubmit: (values: RegisterValues) => void;
  onManageCategories: () => void;
  /*
   * True while the category manager is stacked on top of this form.
   *
   * useEscapeKey attaches a bare document listener, so with both dialogs mounted one Escape
   * fired both handlers: the manager and the half-filled registration closed together, and the
   * typed name, the basis and the uploaded photo went with them. The hook takes an `enabled`
   * flag for exactly this — the top-most dialog swallows the key.
   */
  escapeSuspended?: boolean;
}) {
  const editing = person !== undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [priorityLabel, setPriorityLabel] = useState<NonNullable<Person["priorityLabel"]>>(person?.priorityLabel ?? "normal");
  const [description, setDescription] = useState(person?.description ?? "");
  const [groupId, setGroupId] = useState(person?.groupId ?? "");
  const [categoryId, setCategoryId] = useState(person?.categoryId ?? "");
  const [basis, setBasis] = useState(person?.basis ?? "");
  const [expiresAt, setExpiresAt] = useState(person?.expiresAt?.slice(0, 10) ?? "");
  const chosenCategory = categories.find(c => c.id === categoryId);
  /**
   * Picking a category fills the expiry from its default, and only then.
   *
   * Not on every keystroke and not on edit: overwriting a date somebody typed, because they
   * happened to change the category afterwards, loses work they will not notice losing. A category
   * with no default (defaultValidDays null) clears the field rather than leaving the previous
   * category's date under a new heading.
   */
  const pickCategory = (nextId: string) => {
    setCategoryId(nextId);
    const next = categories.find(c => c.id === nextId);
    if (!next) return;
    setExpiresAt(next.defaultValidDays === null
      ? ""
      : new Date(Date.now() + next.defaultValidDays * 86_400_000).toISOString().slice(0, 10));
  };
  /**
   * Making a group without leaving this form.
   *
   * It was a dialog on top of this dialog, which is a stack nobody wants to be three deep in — and
   * it had to disable this form's Escape key to stop one keystroke closing both. Instead the select
   * gives way to a name field in the same spot: a group needs a name and nothing else to exist, and
   * its priority and note are set later in the Groups tab where the rest of them live.
   */
  const [newGroupName, setNewGroupName] = useState<string | null>(null);
  const addPersonGroup = useVcaStore(s => s.addPersonGroup);
  useEscapeKey(onClose, !escapeSuspended);

  const createGroup = () => {
    const trimmed = (newGroupName ?? "").trim();
    if (!trimmed) return;
    setGroupId(addPersonGroup({ name: trimmed, projectId, registeredAt: new Date().toISOString().slice(0, 10) }));
    setNewGroupName(null);
  };
  /**
   * The photo shown in the form. On edit it starts as the one the person already has — the field
   * used to open as an empty dropzone reading "Upload photo", which says the registry has no
   * picture of somebody whose picture is on the row behind the modal.
   */
  const [photoPreview, setPhotoPreview] = useState<string | null>(person?.photoUrl ?? null);
  /** True while the pointer is over the photo, so the control can offer to replace it. */
  const [photoHovered, setPhotoHovered] = useState(false);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  /**
   * What the model made of the photo currently on file: nothing wrong reported, unreadable, or
   * re-submitted and unanswered. Passed in rather than recomputed — registryHealth owns the
   * predicate, and a second copy of it here would be a second opinion.
   */
  const photoState: "ok" | "unreadable" | "reenrolling" = !person
    ? "ok"
    : person.reenrolledAt && photoUnreadable ? "reenrolling"
    : photoUnreadable ? "unreadable"
    : "ok";
  const photoInputRef = useRef<HTMLInputElement>(null);
  /**
   * A photo is required to register and not to edit.
   *
   * Registering somebody with no face is registering nothing: the enrolled image is the whole
   * thing the cameras match against, and a row without one is a name that will never be detected.
   * Editing is the other case — that person already has an enrolled face, and demanding a fresh
   * upload to fix a spelling would be asking for the expensive half of the work again.
   */
  const valid = name.trim().length > 0
    && (editing || photoPreview !== null)
    // A category that says a basis is required means it: without one the row has nobody to ask
    // later, and "we will fill it in afterwards" is how a registry ends up with none at all.
    && (!chosenCategory?.requiresBasis || basis.trim().length > 0);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoFileName(file.name);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {editing ? t.editModalTitle(person.name) : t.modalTitle}
          </p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
            <TextField value={name} onChange={setName} placeholder={t.namePlaceholder} />
          </div>
          {/* Classification, then what backs it, then when it ends — the three questions an audit
              asks about a watchlist row, in the order somebody answers them. Above priority
              because a category decides whether the basis is required and what the expiry starts
              at, and a field that changes two others should come before them. */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.categoryLabel}</label>
            <FilterSelect
              value={categoryId}
              onChange={pickCategory}
              options={[
                // Unclassified is a choice, not a blank. An installation that has not built its
                // taxonomy still registers people, and those rows should say so rather than look
                // like somebody forgot.
                { value: "", label: t.categoryNone },
                ...categories.map(c => ({ value: c.id, label: c.label })),
              ]}
              footerAction={{ label: t.manageCategories, onClick: onManageCategories }}
            />
          </div>
          <div>
            <label style={{ display: "flex", alignItems: "baseline", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>
              {t.basisLabel}
              {chosenCategory?.requiresBasis
                ? <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)" }}>{t.requiredMark}</span>
                : <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--gray-400)" }}>{t.optionalMark}</span>}
            </label>
            <TextField value={basis} onChange={setBasis} placeholder={t.basisPlaceholder} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.expiresLabel}</label>
            <TextField value={expiresAt} onChange={setExpiresAt} type="date" />
            {/* Said out loud rather than left to an empty field. A blank expiry is the most
                consequential default on this form and the one nobody notices leaving. */}
            <p style={{ fontSize: "11px", color: expiresAt ? "var(--gray-400)" : "var(--warning-500)", lineHeight: 1.6, marginTop: "6px" }}>
              {expiresAt ? t.expiresNote : t.noExpiryWarning}
            </p>
          </div>
          {/* Priority alone now, full width — it shared a two-column row with the Role select. */}
          <div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.priorityLabel}</label>
              <FilterSelect
                value={priorityLabel}
                onChange={v => setPriorityLabel(v as typeof priorityLabel)}
                options={PRIORITY_LABELS.map(p => ({ value: p, label: t.priorityText[p] }))}
              />
            </div>
          </div>
          {/* Group is set here, with everything else. It used to be a select on the detail sheet
              instead — the one editable thing on a sheet whose other four values were read-only,
              next to an Edit item in the menu, which read as "the group is all you may change". */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.colGroup}</label>
            {newGroupName === null ? (
              <FilterSelect
                value={groupId}
                onChange={setGroupId}
                options={[{ value: "", label: t.groupNone }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
                footerAction={{ label: t.addGroup, onClick: () => setNewGroupName("") }}
              />
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TextField value={newGroupName} onChange={setNewGroupName} placeholder={t.groupNamePlaceholder} autoFocus />
                </div>
                <button className="portal-btn-primary" onClick={createGroup} disabled={!newGroupName.trim()}
                  style={{
                    height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none",
                    backgroundColor: newGroupName.trim() ? "var(--primary-400)" : "var(--gray-200)",
                    color: newGroupName.trim() ? "white" : "var(--gray-400)",
                    fontSize: "12px", fontWeight: 700, cursor: newGroupName.trim() ? "pointer" : "not-allowed", flexShrink: 0,
                  }}>
                  {t.createGroupAction}
                </button>
                <button className="portal-btn-outline" onClick={() => setNewGroupName(null)}
                  style={{ height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.noteLabel}</label>
            <TextField value={description} onChange={setDescription} placeholder={t.notePlaceholder} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
              {editing ? t.facePhotoLabel : t.facePhotoLabelRequired}
            </label>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            {/*
              With a photo: the photo, and "Change photo" over it on hover. Without: the dropzone.

              The whole control is the button either way, so the picture is the target — clicking a
              face to replace it is what every avatar field does, and a separate "Change" link
              beside a thumbnail is a second thing to aim at. The overlay only appears on hover
              because a caption printed permanently across somebody's face is a caption you stop
              reading and a face you cannot see.
            */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              onMouseEnter={() => setPhotoHovered(true)}
              onMouseLeave={() => setPhotoHovered(false)}
              style={{
                width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: photoPreview ? "flex-start" : "center", gap: "12px",
                padding: photoPreview ? "10px" : "24px", borderRadius: "10px",
                border: photoPreview ? BORDER : "1px dashed var(--gray-300)",
                backgroundColor: "var(--gray-50)", cursor: "pointer", textAlign: "left",
              }}>
              {photoPreview ? (
                <>
                  <span style={{ position: "relative", display: "flex", flexShrink: 0, borderRadius: "8px", overflow: "hidden" }}>
                    <img src={photoPreview} alt="" style={{ width: "64px", height: "64px", objectFit: "cover", display: "block" }} />
                    {photoHovered && (
                      <span style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        backgroundColor: "rgba(24, 17, 39, 0.62)", color: "white", fontSize: "10px", fontWeight: 700,
                        textAlign: "center", lineHeight: 1.3, padding: "4px",
                      }}>
                        {t.changePhoto}
                      </span>
                    )}
                  </span>
                  {/* The file name once a new one has been chosen; before that there is no file,
                      only the picture the server already holds. */}
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {photoFileName ?? t.currentPhoto}
                  </span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--gray-500)" strokeWidth="1.22" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>{t.uploadPhoto}</span>
                </>
              )}
            </button>
            {/* The reason this form is open, for the people it is open about.
                An admin who clicked "12 photo unreadable", picked a row and got here saw a
                perfectly ordinary-looking photograph and no hint of what was wrong with it. The
                model's complaint belongs against the picture it could not read. */}
            {photoState === "unreadable" && (
              <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.6, marginTop: "6px" }}>{t.photoUnreadableHint}</p>
            )}
            {photoState === "reenrolling" && (
              <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.6, marginTop: "6px" }}>{t.photoReenrollingHint}</p>
            )}
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary"
            onClick={() => valid && onSubmit({
              categoryId: categoryId || undefined,
              basis: basis.trim() || undefined,
              expiresAt: expiresAt || undefined,
              name: name.trim(), priorityLabel,
              description: description.trim() || undefined,
              groupId: groupId || undefined,
              photoUrl: photoPreview ?? undefined,
            })}
            disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", }}>
            {/* The plus belongs to adding. Saving an edit adds nothing. */}
            {!editing && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
            {editing ? t.saveEdit : t.register}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveVipConfirmModal({ t, person, onClose, onConfirm }: { t: VipDict; person: Person; onClose: () => void; onConfirm: () => void }) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "24px 20px 20px", textAlign: "center" }}>
          <img src={person.photoUrl} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 14px" }} />
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{person.name}</p>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginTop: "12px" }}>{t.confirmRemoveTitle}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px" }}>{t.confirmRemoveBody}</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-danger" onClick={onConfirm}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.removeAction}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pill shared by both tags.
 *
 * nowrap is the whole point: "VERY HIGH" is two words, and inside a card that narrows with the grid
 * it broke across two lines, turning a pill into a lozenge twice the height of the one beside it.
 * A tag is a label, not a paragraph — it keeps its line and the row wraps around it instead.
 */
/**
 * `flexible` lets the tag give up width and end in an ellipsis instead of being cut off.
 *
 * Tags never shrank, and the card's tag row clips what does not fit — so a long group name was
 * sliced through the middle of a letter, which reads as a rendering fault rather than as a name
 * that is longer than the space. Only the group tag needs this: a priority is two words at most
 * and is the one of the two that must stay whole.
 */
function Tag({ label, bg, color, flexible }: { label: string; bg: string; color: string; flexible?: boolean }) {
  return (
    <span
      title={flexible ? label : undefined}
      style={{
        alignItems: "center", height: "18px",
        fontSize: "10px", fontWeight: 600, padding: "0 8px", borderRadius: "999px",
        backgroundColor: bg, color, textTransform: "uppercase", whiteSpace: "nowrap",
        // `block`, not `inline-flex`, when it has to truncate: text-overflow needs a block
        // container to clip against, and lineHeight then does what alignItems was doing.
        ...(flexible
          ? { display: "block", lineHeight: "18px", flexShrink: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }
          : { display: "inline-flex", flexShrink: 0 }),
      }}
    >
      {label}
    </span>
  );
}

function PriorityTag({ priority, text }: { priority: NonNullable<Person["priorityLabel"]>; text: string }) {
  const { bg, color } = PRIORITY_COLOR[priority];
  return <Tag label={text} bg={bg} color={color} />;
}

/** Add or edit a party. Membership is not set here — a person is put in a group from their own row. */
function GroupModal({ t, group, projectId, onClose }: {
  t: VipDict; group: PersonGroup | null; projectId: string; onClose: () => void;
}) {
  useEscapeKey(onClose);
  const addPersonGroup = useVcaStore(s => s.addPersonGroup);
  const updatePersonGroup = useVcaStore(s => s.updatePersonGroup);
  const { showToast } = useToast();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [priority, setPriority] = useState<NonNullable<Person["priorityLabel"]>>(group?.priorityLabel ?? "normal");

  const save = () => {
    if (!name.trim()) return;
    if (group) {
      updatePersonGroup(group.id, { name: name.trim(), description: description.trim() || undefined, priorityLabel: priority });
      showToast({ variant: "success", title: t.groupUpdatedTitle, desc: name.trim() });
    } else {
      addPersonGroup({
        name: name.trim(), description: description.trim() || undefined, priorityLabel: priority,
        // A group is created on a day, not at an instant — nothing shows a time for one, and the
        // rows seeded before this stored a date. (A blanket replace while giving persons a full
        // instant had caught this line too, so new groups were storing an ISO string that the
        // group table then printed raw.)
        projectId, registeredAt: new Date().toISOString().slice(0, 10),
      });
      showToast({ variant: "success", title: t.groupAddedTitle, desc: name.trim() });
    }
    onClose();
  };

  const label = (text: string) => (
    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{text}</label>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {group ? t.groupModalEditTitle : t.groupModalAddTitle}
          </p>
          <div>
            {label(t.groupNameLabel)}
            <TextField value={name} onChange={setName} placeholder={t.groupNamePlaceholder} />
          </div>
          <div>
            {label(t.groupDescLabel)}
            <TextField value={description} onChange={setDescription} placeholder={t.groupDescPlaceholder} />
          </div>
          <div>
            {label(t.priorityLabel)}
            <FilterSelect
              value={priority}
              onChange={v => setPriority(v as NonNullable<Person["priorityLabel"]>)}
              options={PRIORITY_LABELS.map(pl => ({ value: pl, label: t.priorityText[pl] }))}
            />
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={save} disabled={!name.trim()}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none",
              backgroundColor: name.trim() ? "var(--primary-400)" : "var(--gray-200)",
              color: name.trim() ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed",
            }}>
            {t.groupSave}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One registered face, big enough to recognise.
 *
 * The grid's 60px thumbnail is a locator, not a likeness — it says which card is whose, and an
 * operator asking "is this the person I am looking at" cannot answer it from that. This is where
 * the enrolled photo is actually looked at, so the photo is the largest thing on it.
 *
 * It is also the only place a group can be set from the grid: the Group select lives in the table
 * view's row, so without this, switching to cards took the ability away.
 */
/**
 * The registration moment as the detail sheet shows it: the day, plus the time when the stored
 * value carries one. Rows enrolled before Portal recorded instants have only a date, and inventing
 * a time for them would be making up a fact about when somebody was put on a watchlist.
 *
 * Only called from the sheet, which exists after a click, so formatting in the viewer's zone
 * cannot mismatch between server and client render.
 */
function registeredLong(value: string): string {
  const day = value.slice(0, 10);
  if (!value.includes("T")) return day;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return day;
  return `${day} ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function PersonDetailModal({ t, person, groups, onClose, onEdit, onRemove }: {
  t: VipDict;
  person: Person;
  groups: PersonGroup[];
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  useEscapeKey(onClose);
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const group = groups.find(g => g.id === person.groupId);

  /**
   * The gap between rows was already even (8px), but the Group row holds a 30px control and the
   * others hold a line of text, so the rhythm read as uneven — the spacing around Group looked
   * larger because the row itself was. A shared minimum height makes every row the same height
   * whether it carries a control or a sentence, and centring means the label sits level with
   * either.
   */
  /**
   * 22px rows, not 36.
   *
   * These were CONTROL_HEIGHT tall from when the Group row held a select — a row sized for a form
   * control, kept after the control moved into the edit dialog. With an 8px gap that made a 44px
   * pitch for four lines of plain text, so the sheet read as a form with the fields taken out.
   */
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "12px", alignItems: "center", minHeight: "22px" }}>
      <span style={{ fontSize: "12px", color: "var(--gray-500)", minWidth: "72px", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "13px", color: "var(--gray-900)", minWidth: 0 }}>{value}</span>
    </div>
  );

  return (
    // The scroll lives on the backdrop, not on the sheet. On the sheet, overflow-y makes a clipping
    // context, and the Group select below opens as an absolutely positioned list — inside that
    // context the list was cut off at the sheet's edge. The backdrop is the viewport, so scrolling
    // there clips nothing the browser would not clip anyway. `margin: auto` on the sheet is what
    // keeps a tall one scrollable from its top instead of having its head cut off by centring.
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", margin: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        {/* Square, edge to edge, corners rounded only at the top so it reads as the sheet's own
            header rather than a picture sitting inside it. Capped so the sheet does not need to be
            taller than a short window on account of the photo alone. */}
        <img src={person.photoUrl} alt=""
          style={{ width: "100%", aspectRatio: "1 / 1", maxHeight: "320px", objectFit: "cover", display: "block", borderTopLeftRadius: "16px", borderTopRightRadius: "16px", backgroundColor: "var(--gray-100)" }} />
        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>{person.name}</p>
            {/* Priority only. The group used to be a tag here too, two rows above the select that
                sets it — the same fact stated twice, once unchangeable and once not. Priority has
                no control on this sheet, so the tag is the only place it is said. */}
            {person.priorityLabel && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                <PriorityTag priority={person.priorityLabel} text={t.priorityText[person.priorityLabel]} />
              </div>
            )}
          </div>
          {/* Removing a face lives in the overflow menu, not on a button. Every contact-detail
              panel worth copying does it this way (Front, folk, Lightfield, HubSpot): the one thing
              on the sheet that cannot be undone is the one thing that should not be a step away
              from a stray click, and red belongs in the confirmation, not in the furniture. */}
          <RowActionsMenu actions={[
            { label: t.editPerson, onClick: onEdit, disabled: !mayEdit, reason: readOnlyReason },
            { label: t.removeAction, onClick: onRemove, danger: true, disabled: !mayEdit, reason: readOnlyReason },
          ]} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: BORDER, paddingTop: "12px" }}>
            {row(t.colGroup, group
              ? group.name
              : <span style={{ color: "var(--gray-400)" }}>{t.groupNone}</span>)}
            {/* Group first, then what qualifies the person, then the note, then when they were
                enrolled — last because it is the one value nobody comes here to read and the only
                one that never changes. The time is shown as well: this is the detail view, and on
                a watchlist "when was this face put in" is a question an inspection asks by the
                minute, not by the day. Rows enrolled before Portal recorded a time show only the
                date rather than a made-up one. */}
            {row(t.colNote, person.description || <span style={{ color: "var(--gray-400)" }}>{t.detailNoNote}</span>)}
            {row(t.colRegistered, registeredLong(person.registeredAt))}
          </div>
        </div>
        {/* Outlined, not filled. A dark Close next to a red Remove was two saturated blocks
            arguing on a sheet whose job is to show a photograph, and neither of them was the
            action anybody came for. The only filled button here is Save, and only while there is
            something to save. */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectVipTab({ projectId }: { projectId: string }) {
  const persons = useVcaStore(s => s.persons);
  const personGroups = useVcaStore(s => s.personGroups);
  const projects = useVcaStore(s => s.projects);
  const watchlistCategories = useVcaStore(s => s.watchlistCategories);
  const releasePerson = useVcaStore(s => s.releasePerson);
  const reinstatePerson = useVcaStore(s => s.reinstatePerson);
  // Categories belong to the institution, so they are read through the project's team rather than
  // through the project — see WatchlistCategory in the store.
  const teamId = projects.find(pr => pr.id === projectId)?.teamId;
  const teamCategories = watchlistCategories.filter(c => c.teamId === teamId);
  // Archived ones stay readable on rows that still reference them, but cannot be chosen again.
  const activeCategories = teamCategories.filter(c => !c.archived);
  const categoryById = new Map(watchlistCategories.map(c => [c.id, c]));
  // Same gate as the search-purpose list — see canSetPolicy. Both decide what the audit will find,
  // and an administrator able to loosen one and not the other would be a rule nobody could state.
  const me = currentPortalUser(useVcaStore.getState().portalUsers);
  const maySetPolicy = me ? canSetPolicy(me.permission) : true;
  // Registering, editing, releasing and deleting a listed person. Categories keep their own,
  // narrower gate above — an admin may add a person, not redefine what a listing means.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const removePersonGroup = useVcaStore(s => s.removePersonGroup);
  const setPersonGroup = useVcaStore(s => s.setPersonGroup);
  const addPerson = useVcaStore(s => s.addPerson);
  const addPersons = useVcaStore(s => s.addPersons);
  const removePerson = useVcaStore(s => s.removePerson);
  const updatePerson = useVcaStore(s => s.updatePerson);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [showRegister, setShowRegister] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  // Grid by default: a watchlist is looked at face-first, and the photo is the thing an operator
  // recognises. Table is for the other job — comparing role, priority and when someone was added
  // across the whole list, which a wall of cards cannot do.
  /**
   * Table first, grid on request.
   *
   * The grid opened by default because a watchlist is faces and faces are what you recognise — but
   * a hundred of them is a wall, and the job you come to this page with is usually "find this
   * person" or "check who is on the list", which a table answers in one line per person. The grid
   * is the right view for browsing and the wrong one for arriving.
   */
  const [view, setView] = useState<"grid" | "table">("table");
  /**
   * Which registry defect the list is narrowed to, if any — set by clicking one of the three cards
   * above it. A card that only states a number leaves the reader to find the twelve rows it counted;
   * this makes the number the way to them.
   */
  const [healthFilter, setHealthFilter] = useState<"missingPhoto" | "embeddingFailed" | "reenrolling" | "duplicates" | "detected" | null>(null);
  /**
   * All / Individuals / Groups. Same underlined tab row Input Sources and Users & Permissions use.
   *
   * "All" is a real answer here in a way it was not on the Users page: a group's members are
   * people, so the combined tab is a list of people with a Group column — every row fills every
   * column. Individuals is the same list minus anyone in a group; Groups is the parties themselves.
   */
  const [vipTab, setVipTab] = useState<"all" | "individuals" | "groups" | "released">("all");
  /**
   * Narrows the people list to one group. Set by clicking a group's member count, which is the
   * question that number raises — "who are those three?" — and until now had no answer short of
   * reading the Group column down the whole list.
   *
   * Not a fourth tab: it is a filter over the same list, so it clears when a tab is picked by hand
   * and shows as a removable chip while it is on.
   */
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  /**
   * Priority, as its own select beside the group one.
   *
   * Worth a control of its own only now: with four registrations you read the badges, with a
   * hundred "show me just the very-high ones" is the question the screen is for. "__none" is a real
   * answer, not an absence — a person nobody has ranked is exactly who an administrator goes
   * looking for when tidying the list.
   */
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  /**
   * Priority order in the grid, off by default.
   *
   * The table sorts from its column headings; the grid had no order it could state, so it kept
   * registration order and left it at that. A toggle solves the stating problem — while it is on
   * it is visibly on, which is the thing a wall of cards cannot say about itself. Off means newest
   * first, which is what the list arrives in.
   */
  const [gridPriorityFirst, setGridPriorityFirst] = useState(false);
  const showGroupColumn = vipTab === "all";
  const [groupModalFor, setGroupModalFor] = useState<{ group: PersonGroup | null } | null>(null);
  const [confirmingGroupRemove, setConfirmingGroupRemove] = useState<PersonGroup | null>(null);
  const [detailFor, setDetailFor] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [releasing, setReleasing] = useState<Person | null>(null);
  const [reinstating, setReinstating] = useState<Person | null>(null);
  const [reinstateReason, setReinstateReason] = useState("");
  /**
   * The clock, read after mount like everywhere else in Portal.
   *
   * "Expired" and "12 days left" are both answers about today, and a value computed during render
   * differs between the server's HTML and the browser's first pass. Null for one frame, where the
   * cell prints the date without a verdict rather than a verdict that changes in front of the
   * reader.
   */
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  const [releaseReason, setReleaseReason] = useState("");
  const { sort, toggle: toggleSort } = useTableSort<VipSortKey>({ key: "registered", direction: "desc" });
  const [searchFocused, setSearchFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = search.trim().toLowerCase();
  const allProjectPersons = persons.filter(p => p.projectId === projectId);
  /*
   * On the list right now, and taken off it.
   *
   * A release is not a delete: the row stays so that "who was watched, from when, until when,
   * and why it ended" survives, which is the question an audit asks and a deleted row cannot
   * answer. But it does mean the person is no longer being watched — so counting them in
   * "123 records" made that figure mean neither one thing nor the other.
   *
   * Expired rows stay in the active set on purpose. Expiry is a state somebody has to act on
   * and the registry is where they act, so hiding them would hide the work. Release is a
   * decision already taken.
   */
  const activePersons = allProjectPersons.filter(p => !p.releasedAt);
  const releasedPersons = allProjectPersons.filter(p => p.releasedAt);
  const projectGroups = personGroups
    .filter(g => g.projectId === projectId)
    .filter(g => !q || g.name.toLowerCase().includes(q));
  const groupById = new Map(personGroups.map(g => [g.id, g]));
  // Unfiltered by the search box: a picker offers every group, not the ones whose names happen to
  // match what is typed in the list's search.
  const projectGroupsAll = personGroups.filter(g => g.projectId === projectId);
  // Derived, never stored — a stored member count is a number that goes wrong the first time
  // somebody removes a person. See PersonGroup in the store.
  const memberCountOf = (groupId: string) => allProjectPersons.filter(p => p.groupId === groupId).length;

  /**
   * The three defects and the reach figure. Computed from the store's seed — see registryHealth,
   * where the shape is written as the request to the backend.
   */
  // Health is about the list being watched. A released person's unreadable photo is not a
  // defect anybody needs to fix.
  const health = registryHealth(projectId, persons.filter(p => !p.releasedAt));
  const duplicateIds = new Set(health.duplicates.flat());
  const healthIds = {
    missingPhoto: new Set(health.missingPhoto),
    embeddingFailed: new Set(health.embeddingFailed),
    reenrolling: new Set(health.reenrolling),
    duplicates: duplicateIds,
    detected: new Set(health.detectedLast7d),
  } as const;
  const detectedCount = health.detectedLast7d.length;
  // The same count for the seven days before, which is the only thing that tells a quiet week
  // apart from a broken one. See registryHealth, where the two windows are asked for.
  const detectedPrevCount = health.detectedPrev7d.length;
  const reachDelta = detectedCount - detectedPrevCount;

  const matchingPersons = (vipTab === "released" ? releasedPersons : activePersons)
    .filter(p => !healthFilter || healthIds[healthFilter].has(p.id))
    .filter(p => vipTab !== "individuals" || !p.groupId)
    .filter(p => !groupFilter || (groupFilter === "__none" ? !p.groupId : p.groupId === groupFilter))
    .filter(p => priorityFilter === "ALL" || (p.priorityLabel ?? "normal") === priorityFilter)
    .filter(p => !q || p.name.toLowerCase().includes(q));
  // Unset counts as "normal", both here and in the select's counts: the store leaves the field off
  // for anyone registered before priorities existed, and filing them under their own bucket would
  // invent a distinction the registry does not make.
  const activeFilterCount = (groupFilter ? 1 : 0) + (priorityFilter === "ALL" ? 0 : 1) + (healthFilter ? 1 : 0);
  const clearFilters = () => { setGroupFilter(null); setPriorityFilter("ALL"); setHealthFilter(null); };
  const sortValue = (person: Person, key: VipSortKey) => {
    switch (key) {
      case "name": return person.name.toLowerCase();
      // Ranked, not alphabetical: "very_high" has to sit above "high", and alphabetically it would
      // sit below it. Unset reads as normal, the same way the filter and the card do.
      case "priority": return PRIORITY_LABELS.indexOf(person.priorityLabel ?? "normal");
      case "registered": return person.registeredAt;
      // Never-detected rows sort as the empty string, which puts them at the top of the ascending
      // pass — first click on this heading is "who is this list not catching", which is the whole
      // reason the column is here.
      case "lastDetected": return person.lastDetectedAt ?? "";
      // Soonest first on the ascending pass, and rows with no end date sink — a listing that never
      // expires is not "expiring in a very long time", it is a different answer, and it belongs at
      // the far end rather than mixed in among dates.
      case "expires": return person.expiresAt ?? "9999";
    }
  };
  // The table sorts from its headings. The grid has one order it can offer, because it has a
  // control that says so — see gridPriorityFirst.
  const projectPersons = view === "table"
    ? sortRows(matchingPersons, sort, sortValue)
    : gridPriorityFirst
      ? sortRows(matchingPersons, { key: "priority", direction: "desc" }, sortValue)
      : matchingPersons;

  /**
   * The watchlist as a file.
   *
   * Cameras and the staff roster both export; this list — the one a control centre is audited on
   * and the one a shift supervisor is handed on paper — did not, while the seeded audit log
   * carried a line reading "VIP watchlist exported to CSV" and taught the customer the button
   * was there.
   *
   * What is on screen, not the whole registry: the toolbar's filters and search are how somebody
   * says which part of the list they want, and exporting past them would hand back a file they
   * did not ask for. Released rows carry their status and reason rather than being dropped — a
   * removal is exactly what an audit asks about.
   */
  const exportCsv = () => {
    const header = [
      t.colName, t.colGroup, t.colCategory, t.colPriority, t.basisLabel,
      t.colRegistered, t.csvRegisteredBy, t.colExpires, t.colLastDetected, t.csvStatus,
    ];
    const rows = projectPersons.map(person => [
      person.name,
      person.groupId ? groupById.get(person.groupId)?.name ?? "" : "",
      person.categoryId ? categoryById.get(person.categoryId)?.label ?? "" : t.csvUnclassified,
      t.priorityText[person.priorityLabel ?? "normal"],
      person.basis ?? "",
      person.registeredAt.slice(0, 10),
      person.registeredBy ?? "",
      person.expiresAt?.slice(0, 10) ?? "",
      person.lastDetectedAt?.slice(0, 10) ?? t.csvNever,
      person.releasedAt
        ? `${t.statusReleased}${person.releaseReason ? ` — ${person.releaseReason}` : ""}`
        : t.csvStatusActive,
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    // The BOM is what makes Excel read the Korean columns as UTF-8 rather than as the local code
    // page — the same thing the roster import's skipped-rows file does.
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projects.find(pr => pr.id === projectId)?.name ?? "project"}-watchlist.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: t.toastVipExportTitle, desc: t.toastVipExportDesc(rows.length) });
  };

  const register = (values: RegisterValues) => {
    addPerson({
      // The form requires a photo, so values.photoUrl is set here — but it is passed straight
      // through rather than falling back to a stock face, so the one path that can produce a
      // photoless person (the CSV import above) stays the only one.
      name: values.name, type: "VIP", ...(values.photoUrl ? { photoUrl: values.photoUrl } : null),
      registeredAt: new Date().toISOString(),
      priorityLabel: values.priorityLabel,
      description: values.description,
      groupId: values.groupId,
      categoryId: values.categoryId,
      basis: values.basis,
      expiresAt: values.expiresAt,
      projectId,
    });
    setShowRegister(false);
  };

  const saveEdit = (values: RegisterValues) => {
    if (!editingPerson) return;
    updatePerson(editingPerson.id, {
      name: values.name,
      priorityLabel: values.priorityLabel,
      description: values.description,
      groupId: values.groupId,
      categoryId: values.categoryId,
      basis: values.basis,
      expiresAt: values.expiresAt,
      // Only when a new file was picked. Without this, opening the editor and saving without
      // touching the photo would replace the enrolled face with a generated placeholder.
      ...(values.photoUrl ? { photoUrl: values.photoUrl } : null),
    });
    showToast({ variant: "success", title: t.vipUpdatedTitle, desc: values.name });
    setEditingPerson(null);
  };

  const confirmRemove = () => {
    if (!confirmingRemove) return;
    removePerson(confirmingRemove.id);
    showToast({ variant: "warning", title: t.vipRemovedTitle, desc: confirmingRemove.name });
    setConfirmingRemove(null);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then(text => {
      const rows = text.split("\n").map(r => r.trim()).filter(Boolean);
      // Tolerate an optional "name,description" header row from spreadsheet exports.
      const dataRows = rows[0]?.toLowerCase().startsWith("name") ? rows.slice(1) : rows;
      const at = new Date().toISOString();
      const incoming = dataRows
        .map(row => row.split(",").map(v => v?.trim()))
        .filter(([name]) => !!name)
        .map(([name, description]) => ({
          // No photoUrl. A CSV of names contains no faces, and the import used to hand each row a
          // stock portrait from the mock pool — which made every bulk-imported person look
          // registered and matchable when in fact nothing had been enrolled. Those rows are what
          // the "no photo" figure above the list counts, and the count is only true if the rows
          // are.
          name, type: "VIP" as const,
          registeredAt: at,
          description: description || undefined,
          projectId,
        }));
      // One store call, so the import is one line in the Activity log instead of two hundred
      // that evict everything before them. See addPersons.
      const count = addPersons(incoming, file.name);
      showToast({
        variant: count > 0 ? "success" : "warning",
        title: count > 0 ? t.bulkSuccessTitle : t.bulkEmptyTitle,
        desc: count > 0 ? t.bulkSuccessDesc(count, file.name) : t.bulkEmptyDesc,
      });
    });
  };

  return (
    <div>
      {/*
        Registry health, in one line.

        These started as three cards and are a strip instead: the page's job is the list, and a
        summary that costs a hundred pixels of it has to be worth a hundred pixels. As a row of
        figures it costs twenty-eight.

        Each number is the way to the rows it counted — clicking narrows the list, clicking again
        clears it — which is the whole reason to state them here rather than on the Overview. All
        three are the same failure from three causes: a person on the list that no camera can match.
        A photo that was never uploaded, one the model could not read, and a face registered twice
        (which matches, then alerts twice).

        The reach figure on the right is not a defect and is not clickable. It is the question
        nobody else on the page asks — whether this list catches anyone at all.
      */}
      {/* All / Individuals / Groups. Same underlined row as Input Sources and Users & Permissions. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {([
          { id: "all", label: t.tabAll, count: activePersons.length, hint: t.tabAllHint },
          { id: "individuals", label: t.tabIndividuals, count: activePersons.filter(p => !p.groupId).length, hint: t.tabIndividualsHint },
          { id: "groups", label: t.tabGroups, count: personGroups.filter(g => g.projectId === projectId).length, hint: t.tabGroupsHint },
          // Only once there is something in it. A permanently visible "Released 0" invites the
          // question of whether releasing is something you are supposed to be doing.
          ...(releasedPersons.length > 0
            ? [{ id: "released" as const, label: t.tabReleased, count: releasedPersons.length, hint: t.tabReleasedHint }]
            : []),
        ] as { id: "all" | "individuals" | "groups" | "released"; label: string; count: number; hint: string }[]).map(tab => {
          const active = vipTab === tab.id;
          return (
            <Tooltip key={tab.id} text={tab.hint}>
              <button onClick={() => { setVipTab(tab.id); clearFilters(); }}
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

      {/*
        Registry health: three defects and the list's reach, in the shared summary strip.

        Under the tabs, not above them — above, the tabs read as a caption on the summary. The order
        should be: which slice of the registry, then what is wrong with it, then the rows.

        The three are the same failure from three causes — a person on the list that no camera can
        match: a photo that was never uploaded, one the model could not read, and a face registered
        twice (which matches, then alerts twice). Each cell narrows the list to its own rows, which
        is why these figures live here and not on the Overview.

        The reach figure is not a defect and takes no click. It is the question nothing else on the
        page asks: whether this list catches anyone at all.

        Zero-count defects are dropped rather than shown as "0" — a filter that returns an empty
        table is not worth a column. The photo one is normally zero, because the form requires a
        photo; it appears after a CSV import, which is the only path that can enrol a name without
        a face.
      */}
      {/* Not on the Groups tab: every figure here counts people, and a party is not a person —
          under a list of four groups "12 people with an unreadable photo" reads as a fact about
          those four rows. */}
      {vipTab !== "groups" && <SummaryStrip cells={[
        ...([
          { key: "missingPhoto" as const, count: health.missingPhoto.length, label: t.healthMissingPhoto, why: t.healthMissingPhotoWhy, icon: <ImageOff size={14} strokeWidth={2.4} /> },
          { key: "embeddingFailed" as const, count: health.embeddingFailed.length, label: t.healthEmbeddingFailed, why: t.healthEmbeddingFailedWhy, icon: <AlertTriangle size={14} strokeWidth={2.4} /> },
          // Not amber. A photo somebody has already replaced is not an outstanding defect, it is
          // work in progress, and colouring it the same as the untouched ones would mean the
          // strip never rewarded doing anything about them.
          { key: "reenrolling" as const, count: health.reenrolling.length, label: t.healthReenrolling, why: t.healthReenrollingWhy, icon: <RefreshCw size={14} strokeWidth={2.4} />, neutral: true },
          { key: "duplicates" as const, count: health.duplicates.length, label: t.healthDuplicates, why: t.healthDuplicatesWhy, icon: <Users size={14} strokeWidth={2.4} /> },
        ].filter(item => item.count > 0).map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          unit: t.healthPeopleUnit,
          label: item.label,
          // Every label here names a defect in three words. The dotted underline is where the
          // fourth to fortieth live — including, for the two that are fixable, what fixes them.
          explanation: item.why,
          tone: ("neutral" in item && item.neutral ? "neutral" : "warning") as "neutral" | "warning",
          active: healthFilter === item.key,
          title: healthFilter === item.key ? t.healthClear : t.healthShowOnly,
          onClick: () => setHealthFilter(healthFilter === item.key ? null : item.key),
        }))),
        {
          key: "reach",
          icon: <Eye size={14} strokeWidth={2.4} />,
          figure: detectedCount,
          unit: t.healthOfTotal(activePersons.length),
          // "People", not detections. The two are wildly different numbers off the same week — one
          // VIP walking past a camera twenty times is 1 here and 20 there — and the backend read
          // this cell and had to ask which it meant, which is the label's fault, not theirs.
          //
          // The trend is what makes the figure readable: "9 of 104 this week" is a normal week
          // when the VIPs did not come and a dead fleet when it was 40 last week, and nothing else
          // on the page separates those. Grey both ways — this is a comparison, not a verdict.
          trend: reachDelta === 0
            ? { direction: "flat" as const, text: t.healthReachFlat }
            : { direction: (reachDelta > 0 ? "up" : "down") as "up" | "down", text: t.healthReachTrend(detectedPrevCount) },
          label: t.healthReachLabel,
          explanation: t.healthReachWhy,
          // Takes a click like its neighbours. It is not a defect, so it stays neutral rather than
          // amber, but "which of them actually came this week" is a question worth an answer and a
          // cell that filters beside two that do not would be the odd one out.
          active: healthFilter === "detected",
          title: healthFilter === "detected" ? t.healthClear : t.healthShowOnly,
          onClick: () => setHealthFilter(healthFilter === "detected" ? null : "detected"),
        },
      ]} />}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
      <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
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
        {/* Next to the search box, the way Input Sources puts its zone / status / engine selects
            there. Not on the Groups tab: both of these narrow a list of people, and that tab lists
            parties. Each option carries its own count, so the reader knows whether a filter is
            worth applying before applying it. */}
        {vipTab !== "groups" && (
          <>
            <FilterSelect
              value={groupFilter ?? "ALL"}
              onChange={v => setGroupFilter(v === "ALL" ? null : v)}
              options={[
                { value: "ALL", label: t.allGroups },
                { value: "__none", label: `${t.noGroup} (${allProjectPersons.filter(p => !p.groupId).length})` },
                ...projectGroupsAll.map(g => ({ value: g.id, label: `${g.name} (${memberCountOf(g.id)})` })),
              ]}
              fitContent
            />
            <FilterSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: "ALL", label: t.allPriorities },
                ...PRIORITY_LABELS.map(pr => ({
                  value: pr,
                  label: `${t.priorityText[pr]} (${allProjectPersons.filter(p => (p.priorityLabel ?? "normal") === pr).length})`,
                })),
              ]}
              fitContent
            />
            {activeFilterCount > 0 && (
              <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        {/* Grid only. The table already has this in its Priority heading, and a second control
            saying the same thing next to it would be two ways to sort one list. */}
        {vipTab !== "groups" && view === "grid" && (
          <button
            className={gridPriorityFirst ? undefined : "portal-btn-quiet"}
            onClick={() => setGridPriorityFirst(v => !v)}
            aria-pressed={gridPriorityFirst}
            style={{
              display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
              height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", cursor: "pointer",
              fontSize: "10px", fontWeight: 700, fontFamily: "inherit",
              ...(gridPriorityFirst
                ? { border: "1px solid var(--gray-900)", backgroundColor: "var(--gray-900)", color: "white" }
                : { border: BORDER, backgroundColor: "white", color: "var(--gray-600)" }),
            }}
          >
            <ArrowDownWideNarrow size={14} strokeWidth={2.4} />
            {t.sortByPriority}
          </button>
        )}
        {/* Same segmented control the Input Sources tab uses, so the one gesture for "show me this
            differently" looks the same in both places. Not on the Groups tab: a party has no face,
            so a wall of cards would be a wall of empty squares. */}
        {vipTab !== "groups" && (
        <div style={{ display: "flex", alignItems: "center", height: CONTROL_HEIGHT, boxSizing: "border-box", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "4px", flexShrink: 0 }}>
          {(["grid", "table"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                height: "100%", padding: "0 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                fontSize: "10px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
              }}>
              {v === "grid" ? t.viewGrid : t.viewTable}
            </button>
          ))}
        </div>
        )}
        {/* The tools, at the right end of the toolbar — same place Input Sources keeps its own.
            Left of this row is how you narrow and view the list; right of it is what you do to it.
            They were a row of their own above the tabs, which is where they ended up when the page
            title was deleted, and buttons with nothing to their left read as floating chrome. */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleBulkUpload} style={{ display: "none" }} />
          {/* Tools follow the tab: registering a face and creating a party are different jobs, and
              a bulk face upload has nothing to do with the list of parties. */}
          {vipTab === "groups" ? (
            <button className="portal-btn-primary" onClick={() => setGroupModalFor({ group: null })} disabled={!mayEdit} title={readOnlyReason}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addGroup}
            </button>
          ) : (<>
          {/* Export stays open to a read-only account — handing the watchlist to an auditor as a
              file is most of what the role is for. Import is what goes. */}
          <button className="portal-btn-quiet" onClick={() => fileInputRef.current?.click()} disabled={!mayEdit} title={readOnlyReason}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: mayEdit ? "var(--gray-600)" : "var(--gray-300)", fontSize: "12px", fontWeight: 600, cursor: mayEdit ? "pointer" : "not-allowed" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9.33V1.75M7 1.75 4.08 4.67M7 1.75 9.92 4.67M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.22" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.bulkUpload}
          </button>
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={projectPersons.length === 0}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: projectPersons.length === 0 ? "var(--gray-300)" : "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: projectPersons.length === 0 ? "not-allowed" : "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.75V9.33M7 9.33 4.08 6.42M7 9.33 9.92 6.42M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.exportCsv}
          </button>
          <button className="portal-btn-primary" onClick={() => setShowRegister(true)} disabled={!mayEdit} title={readOnlyReason}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
            {t.registerVip}
          </button>
          </>)}
        </div>
      </div>

      {vipTab === "groups" ? (
        projectGroups.length === 0 ? (
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>{q ? t.noSearchResults : t.noGroups}</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GROUP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "16px", borderTopRightRadius: "16px" }}>
              {[t.colGroup, t.colMembers, t.colPriority, t.colNote, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
              ))}
            </div>
            {projectGroups.map((group, i) => {
              const isLast = i === projectGroups.length - 1;
              const members = memberCountOf(group.id);
              return (
                <div key={group.id} style={{
                  display: "grid", gridTemplateColumns: GROUP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                  borderBottom: isLast ? "none" : BORDER,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-400)" }}>{t.registered(group.registeredAt.slice(0, 10))}</p>
                  </div>
                  {/* Derived from Person.groupId, so it cannot disagree with the rows it counts.
                      Clickable when there is anybody to show: the number's own question is who
                      they are, and this answers it by narrowing the people list to them. */}
                  {members === 0 ? (
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-300)" }}>0</span>
                  ) : (
                    <button
                      onClick={() => { setGroupFilter(group.id); setVipTab("all"); }}
                      title={t.showGroupMembers(group.name)}
                      style={{
                        border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
                        fontSize: "13px", fontWeight: 700, color: "var(--gray-900)",
                        textDecoration: "underline", textUnderlineOffset: "3px", justifySelf: "start",
                      }}>
                      {members}
                    </button>
                  )}
                  <span>{group.priorityLabel
                    ? <PriorityTag priority={group.priorityLabel} text={t.priorityText[group.priorityLabel]} />
                    : <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}</span>
                  <span title={group.description} style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {group.description || <span style={{ color: "var(--gray-300)" }}>—</span>}
                  </span>
                  <RowActionsMenu actions={[
                    { label: t.editGroup, onClick: () => setGroupModalFor({ group }), disabled: !mayEdit, reason: readOnlyReason },
                    { label: t.removeGroup, onClick: () => setConfirmingGroupRemove(group), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                  ]} />
                </div>
              );
            })}
          </div>
        )
      ) : projectPersons.length === 0 ? (
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", padding: "32px", textAlign: "center" }}>
          {/* An empty registry and a filter that matched nothing are different situations, and
              the first one deserves to say what would fill it. */}
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {q ? t.noSearchResults : vipTab === "individuals" ? t.noIndividuals : t.noVips}
          </p>
          {!q && vipTab !== "individuals" && (
            <p style={{ fontSize: "12px", color: "var(--gray-300)", lineHeight: 1.55, marginTop: "6px", maxWidth: "46ch", marginInline: "auto" }}>{t.noVipsHint}</p>
          )}
        </div>
      ) : view === "table" ? (
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
          {/* The column headings stay while the rows go under them. position:sticky against the
              shell's scroller, at top:0 — no measuring, no fixed positioning, and it works because
              nothing between here and that scroller clips its overflow. zIndex 2 so rows pass
              beneath rather than over, and the gray-50 fill is what makes "beneath" invisible. */}
          <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: showGroupColumn ? VIP_GRID_WITH_GROUP : VIP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "16px", borderTopRightRadius: "16px" }}>
            {/* The photo and the note carry no sortKey — a face has no order, and a free-text note
                sorted alphabetically answers nothing. */}
            <span />
            {([
              { label: t.colName, key: "name" },
              ...(showGroupColumn ? [{ label: t.colGroup }] : []),
              { label: t.colCategory },
              { label: t.colPriority, key: "priority", indent: true },
              { label: t.colRegistered, key: "registered" },
              { label: t.colLastDetected, key: "lastDetected" },
              { label: t.colExpires, key: "expires" },
              { label: t.colNote },
              { label: "" },
            /* Priority's heading is nudged 8px right — the pill under it carries 8px of its own
               left padding, so a heading flush with the track's edge sat left of every value it
               labels. The other columns are plain text and line up already. */
            ] as { label: string; key?: VipSortKey; indent?: boolean }[]).map((h, i) => (
              <span key={i} style={h.indent ? { paddingLeft: "8px" } : undefined}>
                <SortableHeader label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
              </span>
            ))}
          </div>
          {projectPersons.map((person, i) => {
            const isLast = i === projectPersons.length - 1;
            return (
              <div key={person.id} style={{
                display: "grid", gridTemplateColumns: showGroupColumn ? VIP_GRID_WITH_GROUP : VIP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                borderBottom: isLast ? "none" : BORDER,
                borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
              }}>
                {/* 48px, up from 32. A face at 32 in a table is a thumbnail of a thumbnail, and
                    this column exists so the reader can tell one Michael from another. The row's
                    own padding is untouched — the first grid track grew with the picture, so the
                    row is taller by exactly what the picture needed and by nothing else. */}
                <img src={person.photoUrl} alt="" style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover" }} />
                {/* The name is the way in, as it is in most tables — a narrow target that does not
                    fight the group select two cells over for the same click. */}
                <button className="portal-link" onClick={() => setDetailFor(person)} title={person.name}
                  style={{
                    border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left",
                    fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                  {person.name}
                </button>
                {/* Membership is set from the person, not from the group. Putting a member list in
                    the group editor would mean two places that have to agree about who is in it;
                    one select on the person's own row is the single place that decides. */}
                {showGroupColumn && (
                  /* Padding on the cell, not a narrower column: the boxes still fill their column
                     and line up down the table (a select sized to its own label draws a different
                     width on every row), they just stop short of the edge. Moving the column
                     boundary would not have helped — the gap between the two cells is the grid's
                     columnGap either way, and what looked cramped was the select's border landing
                     12px from the priority tag with nothing between them. */
                  <span style={{ display: "block", minWidth: 0, paddingRight: "16px" }}>
                  <FilterSelect
                    value={person.groupId ?? ""}
                    onChange={v => setPersonGroup(person.id, v || undefined)}
                    options={[
                      { value: "", label: t.groupNone },
                      ...personGroups.filter(g => g.projectId === projectId).map(g => ({ value: g.id, label: g.name })),
                    ]}
                  />
                  </span>
                )}
                {/* The category, in the institution's own word and its own colour. Unclassified
                    says so rather than showing a dash: it is a state somebody chose (or has not
                    got round to), not a missing value. */}
                <span style={{ minWidth: 0 }}>
                  {(() => {
                    const cat = person.categoryId ? categoryById.get(person.categoryId) : undefined;
                    if (!cat) return <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{t.categoryNone}</span>;
                    const tint = categoryTint(cat.color);
                    return (
                      <span style={{
                        display: "inline-block", maxWidth: "100%", padding: "2px 8px", borderRadius: "999px",
                        backgroundColor: tint.bg, color: tint.fg,
                        fontSize: "11px", fontWeight: 700,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{cat.label}</span>
                    );
                  })()}
                </span>
                <span>{person.priorityLabel ? <PriorityTag priority={person.priorityLabel} text={t.priorityText[person.priorityLabel]} /> : <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{person.registeredAt.slice(0, 10)}</span>
                {/* The same em dash every other empty cell in this table uses, in the same grey as
                    the priority column's. It was the word "Never" first, on the grounds that "not
                    recorded" and "never matched" are different answers — but two rows in three have
                    no match, so the word repeated down almost the whole column and buried the dates
                    that are the reason to look. The header names the column and the sort collects
                    these rows together; the dash does not need to carry the sentence. Grey, never
                    amber — never being seen is not a fault (see Person.lastDetectedAt). */}
                <span style={{ fontSize: "12px", color: person.lastDetectedAt ? "var(--gray-600)" : "var(--gray-300)" }}>
                  {person.lastDetectedAt ? person.lastDetectedAt.slice(0, 10) : "—"}
                </span>
                {/* Expiry, and what has already happened to it.
                    Released and expired rows stay in the list — if they vanished, nobody could tell
                    which of the two happened, and "it is gone" is the one answer a watchlist must
                    never give about somebody it used to hold. */}
                <span style={{ fontSize: "12px", minWidth: 0 }}>
                  {(() => {
                    if (person.releasedAt) return <span style={{ fontWeight: 700, color: "var(--gray-500)" }}>{t.statusReleased}</span>;
                    if (!person.expiresAt) return <span style={{ color: "var(--gray-300)" }}>{t.noExpiry}</span>;
                    const daysLeft = nowMs === null ? null : Math.ceil((Date.parse(person.expiresAt) - nowMs) / 86_400_000);
                    if (daysLeft !== null && daysLeft < 0) return <span style={{ fontWeight: 700, color: "var(--danger-500)" }}>{t.statusExpired}</span>;
                    return (
                      <span style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ color: "var(--gray-600)" }}>{person.expiresAt.slice(0, 10)}</span>
                        {daysLeft !== null && daysLeft <= 30 && (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--warning-500)" }}>{t.expiringInDays(daysLeft)}</span>
                        )}
                      </span>
                    );
                  })()}
                </span>
                <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.description || "—"}</span>
                {/* The same overflow menu the roster, users and camera tables use. A lone trash
                    icon was the only row action this table had, which is also why there was no way
                    to edit a VIP from the table at all. */}
                <div style={{ justifySelf: "end" }}>
                  <RowActionsMenu actions={[
                    { label: t.editPerson, onClick: () => setEditingPerson(person), disabled: !mayEdit, reason: readOnlyReason },
                    // Release before delete, and delete stays the destructive one. Taking somebody
                    // off the list is the ordinary end of a listing; erasing the record of it is not.
                    // Released rows got no action at all here, which made release one-way: the
                    // only undo was delete-and-re-register, destroying the registration history
                    // the release was kept to preserve.
                    person.releasedAt
                      ? { label: t.reinstateAction, onClick: () => setReinstating(person), disabled: !mayEdit, reason: readOnlyReason }
                      : { label: t.releaseAction, onClick: () => setReleasing(person), disabled: !mayEdit, reason: readOnlyReason },
                    { label: t.removeAction, onClick: () => setConfirmingRemove(person), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* gridAutoRows 1fr on top of the fixed slots inside each card. The slots are what make the
           heights match; this is the guard that keeps a row level if something in a card ever
           grows anyway. */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gridAutoRows: "1fr", gap: "8px" }}>
          {/* 8px between tiles, down from 12. With the shadow gone the gap is the only thing
              separating one card from the next, and at 12 a hundred of them read as a hundred
              islands — tightening it lets the grid read as one surface with rules through it. */}
          {projectPersons.map(person => {
            return (
            /* Same edge, radius and padding as an Overview metric card. These were 12px and
               borderless while every card one tab over was a 16px card with a hairline, which made
               the registry read as a different product's screen. */
            <div key={person.id}
              className="portal-card-clickable"
              onClick={() => setDetailFor(person)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(person); } }}
              style={{
                // No shadow on these. One card carries it lightly; a hundred of them in a grid
                // put a soft grey edge under every tile and turned the gaps between them into a
                // texture — the wall of faces reads as cluttered before it reads as a list. The
                // hairline is enough to say where a card ends when there are this many of them.
                backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px",
                // 12 top and bottom against 16 at the sides. The card holds three short lines and
                // a 60px thumbnail, and at 16 all round the space above the name read as more
                // than the space between the lines it separates.
                padding: "10px 16px",
                display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer",
              }}>
              {/* 60, not 44. At 44 the thumbnail told you which card was whose and nothing more —
                  a face that small cannot be compared to a person standing in front of you, which
                  is what a watchlist is for. The detail sheet behind the card carries the size that
                  actually answers that; this is the largest the grid can give without the tags and
                  the name losing their line. */}
              <img src={person.photoUrl} alt="" style={{ width: "60px", height: "60px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name first. The tags used to sit above it, which put a pill where the eye goes
                    for the thing a watchlist card is actually scanned for — a face and a name. The
                    group and the priority qualify that name, so they read after it. */}
                {/* Two lines, always — reserved whether the name needs them or not.
                    "Muhammad Rizal bin Hassan" wraps at this width and "David Ho" does not, so a
                    height that follows the name made every card a different card. Clamped rather
                    than ellipsised on one line, because a watchlist that truncates the name has
                    broken the one thing it is for; two lines hold every name in the registry. */}
                <p style={{
                  fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.35,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden", height: "35px",
                }}>{person.name}</p>
                {(
                  /* Priority on every card, "normal" included.
                     It used to appear only when raised, on the grounds that a grey NORMAL pill said
                     nothing — but the absence said nothing either, and worse, it said it in the
                     same silence as "nobody has set this yet". Every face in the registry has a
                     priority; the card states it. Normal stays grey, so the ones that are not
                     normal are still the only colour in the grid.
                     One line and no wrap, and the row is here even when this person has neither
                     tag: it used to appear only when there was something to show and to wrap onto
                     a second line when a group name ran long, which is two more ways for one card
                     to be taller than the one beside it. Reserved space costs 18px on the cards
                     that have nothing to say; a ragged grid costs the reader every card. */
                  <div style={{ display: "flex", gap: "4px", margin: "4px 0 0", height: "18px", overflow: "hidden" }}>
                    {/* Priority first. It is the shorter of the two and the one that decides how
                        hard a detection is chased, so it reads before the party a person happens to
                        be travelling with — and being first means it keeps its full width while the
                        group name behind it is the one that gives way. */}
                    {/* Released reads first and replaces the priority, because it overrides it:
                        a "Very High" pill on somebody nobody is watching any more is the card
                        stating the loudest thing about them and the wrong one. Released rows
                        were marked only in the table's expiry column, so in the grid — the view
                        this screen opens on — they were indistinguishable from active ones. */}
                    {person.releasedAt
                      ? <Tag label={t.statusReleased} bg="var(--gray-100)" color="var(--gray-500)" />
                      : <PriorityTag priority={person.priorityLabel ?? "normal"} text={t.priorityText[person.priorityLabel ?? "normal"]} />}
                    {person.groupId && groupById.has(person.groupId) && (
                      <Tag label={groupById.get(person.groupId)!.name} bg="var(--info-100)" color="var(--info-500)" flexible />
                    )}
                  </div>
                )}
                {/* The note is not on the card.
                    It is free text with no length anybody controls, so on a card it either grew
                    the card or had to be clamped — and a watchlist grid is read at a hundred faces
                    at a time, where a line per card is a screenful. Four of six comparable grids
                    (Qatalog, Cosmos, Rive, and most of Wellfound's) leave it off the card for the
                    same reason; the ones that keep it (Kit) are grids where the prose IS the
                    content. Here the face and the name are.
                    Nothing is lost: it is stated in full on the detail sheet behind this card, and
                    it has its own column in the table view. */}
                {/* The date alone. On a card there is only one date it could be, and "Registered"
                    in front of it was a word repeated on every card to say what the screen it sits
                    on already says. The detail sheet and the table both keep the label, where a
                    date sits next to other labelled values and needs to say which one it is. */}
                <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "4px" }}>{person.registeredAt.slice(0, 10)}</p>
              </div>
              {/* No delete on the card.
                  It was a trash icon in this corner — a third route to the one irreversible action
                  on the screen, next to the two that already exist: the ⋯ on the detail sheet this
                  card opens, and the ⋯ on the table view's row. Same reason the Overview cards lost
                  their "Manage" link: the card is entirely clickable, so a smaller target inside it
                  aimed at the same person is just a worse version of the card.
                  A hundred cards also meant a hundred delete affordances on screen for something
                  done a handful of times a year, and every one of them needed stopPropagation to
                  avoid opening the sheet behind its own confirmation. */}
            </div>
            );
          })}
        </div>
      )}

      {showRegister && <RegisterVipModal t={t} groups={projectGroupsAll} categories={activeCategories} onManageCategories={() => setManagingCategories(true)} escapeSuspended={managingCategories} projectId={projectId} onClose={() => setShowRegister(false)} onSubmit={register} />}
      {editingPerson && (
        <RegisterVipModal t={t} person={editingPerson}
          photoUnreadable={healthIds.embeddingFailed.has(editingPerson.id) || healthIds.reenrolling.has(editingPerson.id)}
          groups={projectGroupsAll} categories={activeCategories} onManageCategories={() => setManagingCategories(true)} escapeSuspended={managingCategories} projectId={projectId} onClose={() => setEditingPerson(null)} onSubmit={saveEdit} />
      )}
      {confirmingRemove && (
        <RemoveVipConfirmModal t={t} person={confirmingRemove} onClose={() => setConfirmingRemove(null)} onConfirm={confirmRemove} />
      )}
      {managingCategories && teamId && (
        <WatchlistCategoryModal teamId={teamId} categories={teamCategories} canEdit={maySetPolicy} onClose={() => setManagingCategories(false)} />
      )}
      {releasing && (
        <ConfirmModal
          title={t.releaseTitle(releasing.name)}
          body={t.releaseBody}
          confirmLabel={t.releaseConfirm}
          cancelLabel={t.cancel}
          // The confirm stays shut until a reason is typed. It used to fall back to the
          // placeholder, so an empty field wrote the EXAMPLE text into the record: the row read
          // "released — Found · Arrested · Listed in error", and so did the audit entry and the
          // CSV. Language-dependent too, which is user data coming out of the UI dictionary.
          confirmDisabled={releaseReason.trim() === ""}
          onConfirm={() => {
            releasePerson(releasing.id, releaseReason.trim());
            showToast({ variant: "success", title: t.releasedToast, desc: releasing.name });
            setReleasing(null);
            setReleaseReason("");
          }}
          onClose={() => { setReleasing(null); setReleaseReason(""); }}
        >
          <div style={{ marginTop: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.releaseReasonLabel}</label>
            <TextField value={releaseReason} onChange={setReleaseReason} placeholder={t.releaseReasonPlaceholder} autoFocus />
          </div>
        </ConfirmModal>
      )}
      {reinstating && (
        <ConfirmModal
          title={t.reinstateTitle(reinstating.name)}
          body={t.reinstateBody}
          confirmLabel={t.reinstateConfirm}
          cancelLabel={t.cancel}
          confirmDisabled={reinstateReason.trim() === ""}
          onConfirm={() => {
            reinstatePerson(reinstating.id, reinstateReason.trim());
            showToast({ variant: "success", title: t.reinstatedToast, desc: reinstating.name });
            setReinstating(null);
            setReinstateReason("");
          }}
          onClose={() => { setReinstating(null); setReinstateReason(""); }}
        >
          {/* A reason, the same as releasing asks for. Putting somebody back under watch is not
              a lighter act than taking them off it. */}
          <div style={{ marginTop: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.releaseReasonLabel}</label>
            <TextField value={reinstateReason} onChange={setReinstateReason} placeholder={t.reinstateReasonPlaceholder} autoFocus />
          </div>
        </ConfirmModal>
      )}
      {detailFor && (
        <PersonDetailModal
          t={t}
          person={persons.find(p => p.id === detailFor.id) ?? detailFor}
          groups={personGroups.filter(g => g.projectId === projectId)}
          onClose={() => setDetailFor(null)}
          onEdit={() => { setEditingPerson(detailFor); setDetailFor(null); }}
          onRemove={() => { setConfirmingRemove(detailFor); setDetailFor(null); }}
        />
      )}
      {groupModalFor && (
        <GroupModal t={t} group={groupModalFor.group} projectId={projectId} onClose={() => setGroupModalFor(null)} />
      )}
      {confirmingGroupRemove && (() => {
        const group = confirmingGroupRemove;
        const members = memberCountOf(group.id);
        const finish = (deleteMembers: boolean) => {
          removePersonGroup(group.id, { deleteMembers });
          showToast({
            variant: "warning",
            title: deleteMembers ? t.groupRemovedWithMembersTitle(members) : t.groupRemovedTitle,
            desc: group.name,
          });
          setConfirmingGroupRemove(null);
        };
        /**
         * Two answers when there is somebody in the group, because "delete the group" reads both
         * ways — a folder whose contents go with it, or a label that comes off. Guessing either way
         * is wrong for half the people who click it, and one of the two guesses destroys enrolled
         * faces. With nobody in it there is nothing to decide, so it stays one button.
         */
        return members === 0 ? (
          <ConfirmModal
            title={t.confirmRemoveGroupTitle(group.name)}
            body={t.confirmRemoveGroupBody(0)}
            confirmLabel={t.removeGroup}
            cancelLabel={t.cancel}
            danger
            onConfirm={() => finish(false)}
            onClose={() => setConfirmingGroupRemove(null)}
          />
        ) : (
          <ConfirmModal
            title={t.confirmRemoveGroupTitle(group.name)}
            body={t.confirmRemoveGroupBody(members)}
            // The recoverable answer is the main button, on the right where a stray Enter lands.
            confirmLabel={t.groupKeepMembers(members)}
            cancelLabel={t.cancel}
            altAction={{ label: t.groupDeleteMembers(members), danger: true, onClick: () => finish(true) }}
            onConfirm={() => finish(false)}
            onClose={() => setConfirmingGroupRemove(null)}
          />
        );
      })()}
    </div>
  );
}

