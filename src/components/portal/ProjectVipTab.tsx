"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
// 2.4, not 1.4: lucide draws in a 24-unit box and this renders at 14px — see ICON_STROKE_PX.
import { AlertTriangle, ArrowDownWideNarrow, CalendarX, Eye, FileDown, FileInput, FileOutput, RefreshCw, Users } from "lucide-react";
import { canSetPolicy, currentPortalUser, isExpired, registryHealth, useVcaStore, type Person, type PersonGroup, type VipCategory } from "@/lib/vcaStore";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { usePortalLanguage } from "@/lib/i18n";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn, formatElapsed } from "@/lib/time";
import { useToast } from "../Toast";
import { TABLE_HEADER_COLOR, ActiveFilterCount, TextField, BORDER, CARD_BORDER, CARD_RADIUS, TABLE_RULE, CONTROL_HEIGHT, PANEL_SHADOW, SearchInput, TABLE_COLUMN_GAP, TOOLBAR_GAP, ConfirmModal, Drawer, FilterSelect, RowActionsMenu, SortableHeader, SummaryStrip, TablePagination, TableEmpty, TableSkeleton, TableLoadFailed, useFitRowsPerPage, Tooltip, sortRows, useTableSort, usePortalEditAccess, FacePhoto } from "./PortalShared";
import { VipCategoryModal, categoryTint } from "./VipCategories";
import VipImportModal from "./VipImportModal";
import { DateRangeTrigger, dateKeyOf } from "../shared/DateRangePicker";

type VipSortKey = "name" | "priority" | "registered" | "lastDetected" | "expires";

// 36px for the actions column, the width RowActionsMenu gets in every other table.
/*
 * TRACKS FOLLOW THE HEADER ORDER, and the header was reordered on 2026-09-18 — check both
 * together if you touch either. Order: checkbox · 우선순위 · face · 이름 · [그룹] · [분류] ·
 * 등록 근거 · 마지막 탐지 · 등록일 · actions.
 *
 * 우선순위 LEADS THE ROW, before the face (owner's ask: "그룹이 맨앞에가 애매하면 우선순위를
 * 맨앞에?"). Before rather than after, so the face and the name stay side by side — they are one
 * thing, and a pill between them splits an identity in half. Linear's issue rows are laid out
 * exactly this way: checkbox, priority, then what the row is.
 *
 * 우선순위 is a FIXED 96px, not a fraction: the pill is as wide as its longest label ("매우 높음"
 * plus the three-bar meter, measured at 88px) and never wider, so a fractional track just added
 * empty space beside it — which is what it looked like after the reorder handed it the group
 * column's share (owner's note: "우선순위 가로너비는 지금너무 넓게 잡혀있는것 같아").
 *
 * 등록일 is fixed at 110px: the value is always `2026-09-09`, ten characters. 마지막 탐지 gets
 * 140px because it carries a time as well (`2026-09-08 18:42`) plus the elapsed line under it.
 *
 * 이름 is CAPPED, not a bare fraction: measured across the seeded 101 rows the longest name renders
 * at 200px ("Muhammad Rizal bin Hassan") and the median at 97px, against a 292px track — so most
 * of the column was air (owner's note: "이름 가로폭이 저렇게까지 길어야할까?"). minmax(170px,
 * 220px) fits the longest without an ellipsis and hands the rest to 등록 근거, which holds case
 * numbers of no fixed length.
 */
const VIP_GRID = "28px 96px 48px minmax(170px, 220px) 1fr 1.5fr 140px 110px 36px";
/** The All tab adds a Group column; the Individuals tab would print "Individual" on every row. */
const VIP_GRID_WITH_GROUP = "28px 96px 48px minmax(170px, 220px) 1.1fr 0.9fr 1.3fr 140px 110px 36px";
/** Same two, with the category track dropped — see complianceConfig.vipCategories. The freed
 *  width goes to the name, which is what a reader scans this table by. */
const VIP_GRID_NO_CAT = "28px 96px 48px minmax(170px, 220px) 1fr 140px 110px 36px";
const VIP_GRID_WITH_GROUP_NO_CAT = "28px 96px 48px minmax(170px, 220px) 1fr 1.4fr 140px 110px 36px";
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
// ("Captain" and "Health" are a team's roles, not a VIP registry's). A field an administrator is
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
  /* The chip NAMES the one filter that is on, because "1 filter" left the reader hunting the
     toolbar for which control was set (measured: on 우선순위=Very High the chip read 「1 filter」
     and nothing else on screen said "priority"). Two or more go back to the count — the chip sits
     in a toolbar row that already wraps at 1280px, and three names side by side would push the
     add button onto its own line. The health cells are their own sentence already (「만료일 지남」),
     so they go in unprefixed. */
  filterChipGroup: (name: string) => string;
  filterChipPriority: (label: string) => string;
  /** Under the tab badge when it reads 「6/62」 — what the two numbers are. */
  tabCountNarrowed: (shown: number, total: number) => string;
  noSearchResults: string;
  noVips: string;
  loadFailed: string;
  retry: string;
  registered: (date: string) => string;
  viewGrid: string;
  viewTable: string;
  colName: string;
  exportCsv: string;
  /* Two sentences, because the button dies for two different reasons and they need different
     answers. The export is the list as filtered — see exportCsv() — so an empty registry and a
     filter that happens to match nobody both leave zero rows, and only one of them is fixed by
     touching the toolbar. PortalUsersPage keeps the same pair under `nothingToExport`. */
  nothingToExport: string;
  nothingToExportFiltered: string;
  csvRegisteredBy: string;
  csvStatus: string;
  csvNever: string;
  csvUnclassified: string;
  csvStatusActive: string;
  toastVipExportTitle: string;
  toastVipExportDesc: (n: number) => string;
  colPriority: string;
  healthMissingPhoto: string;
  healthRegistered: string;
  healthRegisteredWhy: string;
  healthShowAll: string;
  healthImportErrors: string;
  healthImportErrorsWhy: string;
  healthExpired: string;
  /** Two shapes, because the way a listing ends depends on a switch. See the pair below. */
  healthExpiredWhy: string;
  healthExpiredWhyNoRelease: string;
  healthExpiryUnanswered: string;
  healthMissingPhotoWhy: string;
  healthEmbeddingFailed: string;
  healthEmbeddingFailedWhy: string;
  healthReenrolling: string;
  photoUnreadableHint: string;
  photoRejectedTitle: string;
  photoRejectedHint: string;
  photoReenrollingHint: string;
  healthReenrollingWhy: string;
  healthDuplicates: string;
  healthDuplicatesWhy: string;
  healthShowOnly: string;
  healthClear: string;
  healthPeopleUnit: (n: number) => string;
  healthOfTotal: (total: number) => string;
  colLastDetected: string;
  categoryLabel: string;
  categoryNone: string;
  manageCategories: string;
  basisLabel: string;
  basisPlaceholder: string;
  basisLabelRequired: string;
  expiresLabel: string;
  expiresNote: string;
  noExpiryWarning: string;
  colCategory: string;
  colExpires: string;
  statusExpired: string;
  statusReleased: string;
  expiringInDays: (n: number) => string;
  /** The nudge on an expired row: how long ago, because "expired" alone does not ask anything. */
  expiredDaysAgo: (n: number) => string;
  /** Wraps formatElapsed for the 마지막 탐지 column: "1일 02시간" → "1일 02시간 전". */
  detectedAgo: (elapsed: string) => string;
  noExpiry: string;
  expiryUnanswered: string;
  expiryUnansweredWhy: string;
  selectAllLabel: string;
  selectedCount: (n: number) => string;
  bulkExpiryLabel: string;
  bulkExpiryPick: string;
  bulkExpiryApply: string;
  bulkExpiryNone: string;
  bulkGroupLabel: string;
  bulkGroupNone: string;
  bulkPriorityLabel: string;
  bulkDelete: string;
  bulkDeletedTitle: (n: number) => string;
  bulkGroupMovedTitle: (n: number) => string;
  bulkPrioritySetTitle: (n: number) => string;
  bulkRestoredTitle: (n: number) => string;
  bulkConfirmDeleteTitle: (n: number) => string;
  bulkConfirmDeleteBody: string;
  bulkExpirySetTitle: (n: number) => string;
  bulkClearSelection: string;
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
  healthReachLabel: string;
  healthReachWhy: string;
  healthReachTrend: (prev: number) => string;
  healthReachFlat: string;
  colRegistered: string;
  colNote: string;
  /* Names the person, the way every other dialog on this screen does — releaseTitle,
     reinstateTitle, confirmRemoveGroupTitle. It used to be a stock "정말 삭제하시겠습니까?" with the
     name printed on a line of its own above it, which is the one shape that reads as a generic
     browser confirm rather than as a decision about somebody. */
  confirmRemoveTitle: (name: string) => string;
  confirmRemoveBody: string;
  removeAction: string;
  vipRemovedTitle: string;
  undoRemove: string;
  vipRestoredTitle: string;
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
  facePhotoLabelRequired: string;
  addPhotos: string;
  representativePhoto: string;
  photoSetHint: string;
  photoSetCount: (n: number) => string;
  removePhoto: string;
  changePhoto: string;
  uploadPhoto: string;
  currentPhoto: string;
  cancel: string;
  register: string;
  priorityText: Record<NonNullable<Person["priorityLabel"]>, string>;
  bulkTemplate: string;
  bulkTemplateHint: string;
  bulkTemplateMemoHeader: string;
  bulkTemplatePhotoHeader: string;
  bulkTemplateName: string;
  bulkTemplateMemo: string;
  bulkTemplatePhotoSample: string;
  // Tabs and groups
  tabAll: string;
  tabGroups: string;
  tabAllHint: string;
  tabGroupsHint: string;
  tabReleased: string;
  tabReleasedHint: string;
  addGroup: string;
  colGroup: string;
  colMembers: string;
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
  moreDetails: string;
  expiryPolicyNote: (days: number) => string;
  expiryCategoryNote: (label: string, days: number) => string;
}

const T: Record<"en" | "ko", VipDict> = {
  en: {
    bulkUpload: "Bulk upload",
    registerVip: "Register VIP",
    searchPlaceholder: "Search by VIP name",
    sortByPriority: "Priority first",
    allGroups: "All groups",
    allPriorities: "All priorities",
    noGroup: "No group",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,
    filterChipGroup: (name: string) => `Group: ${name}`,
    filterChipPriority: (label: string) => `Priority: ${label}`,
    tabCountNarrowed: (shown: number, total: number) => `${shown} of ${total} shown — the search box or a filter is narrowing this tab.`,
    noSearchResults: "No VIPs match these conditions.",
    noVips: "No VIPs registered for this project yet.",
    loadFailed: "Could not load the VIP registry.",
    retry: "Try again",
    registered: (date: string) => `Registered ${date}`,
    viewGrid: "Grid",
    viewTable: "Table",
    colName: "Name",
    exportCsv: "Export CSV",
    nothingToExport: "This list has nothing in it to export.",
    nothingToExportFiltered: "The file is whatever the list is showing, and the filters have left it empty. Clear them and the export comes back.",
    csvRegisteredBy: "Registered by",
    csvStatus: "Status",
    csvNever: "never",
    csvUnclassified: "unclassified",
    csvStatusActive: "active",
    toastVipExportTitle: "Export complete",
    // People, not records: every row of this file is one person on the VIP list, and the Korean
    // side counted them in 건 while the same screen counted them in 명 three lines later.
    // ("vipRegistry" was an identifier that leaked into the sentence.)
    toastVipExportDesc: (n: number) => `${n} VIP(s) exported to CSV.`,
    colPriority: "Priority",
    healthRegistered: "registered",
    healthRegisteredWhy: "Everybody on this project's matching list right now. Released rows are not counted; expired ones are, because they are still being matched.",
    healthShowAll: "Show all",
    healthImportErrors: "import errors",
    healthImportErrorsWhy: "Rows a bulk upload left unusable: no photo at all, a photo the model could not read a face out of, or a suspected duplicate of somebody already listed. Open them and fix the file — except a duplicate, where the file may be right and the call is whether the two records are the same person. A single registration cannot end up here — that form refuses a photo it cannot enrol.",
    healthExpired: "end date passed",
    // These sentences stop at the list on purpose. Expiry and release take a person off the
    // matching list, which is a fact about this registry and true the moment it is saved. Whether
    // the cameras have followed is a fact about the deployment, and nothing here sends the registry
    // anywhere yet — see the HANDOFF note on Person.expiresAt (PUT /v1/provision/vips). Saying
    // "cameras have stopped matching them" is the exact failure that note warns about: the reader
    // believes the person is handled and stops asking.
    healthExpiredWhy: "The end date on these listings has gone by. They are STILL being matched — a date does not take anybody off the list, a person does. Each one is waiting on that decision: extend it, or release the listing.",
    // The same state, said where releasing is not on the menu. Naming an action this screen does
    // not carry sends the reader looking for a control that is not there and teaches them the
    // console is broken — see complianceConfig.personRelease, off for the first release.
    healthExpiredWhyNoRelease: "The end date on these listings has gone by. They are STILL being matched — a date does not take anybody off the list, a person does. Each one is waiting on that decision: extend it, or remove them.",
    healthExpiryUnanswered: "no end date set",
    healthMissingPhoto: "no photo",
    healthMissingPhotoWhy: "On the VIP list with no face attached. A CSV import can add a name without a photo; these people cannot be matched until one is uploaded.",
    healthEmbeddingFailed: "photo unreadable",
    healthEmbeddingFailedWhy: "A photo is attached, but the model could not read a face out of it — too small, too dark or turned too far. Open the person and replace the photo; that is what clears it.",
    healthReenrolling: "awaiting re-enrolment",
    photoUnreadableHint: "The model could not read a face out of this photo, so this person cannot be matched by any camera. Replace it with a clearer, front-facing picture.",
    photoRejectedTitle: "Registration failed — the face could not be enrolled",
    photoRejectedHint: "Nothing was saved. The model could not read a face out of this photo, and a listing without an enrolled face would never match. Replace the photo with a clearer, front-facing picture and register again.",
    photoReenrollingHint: "A replacement photo has been submitted. Until the model answers, this person is still unmatchable.",
    healthReenrollingWhy: "A new photo has been submitted and the model has not answered yet. These people are still unmatchable until it does — a replaced photo is a question re-asked, not a fix confirmed.",
    healthDuplicates: "possible duplicates",
    healthDuplicatesWhy: "Two or more records that share a name. Usually the same person enrolled twice; the VIP list counts them twice either way.",
    healthShowOnly: "Show only these",
    healthClear: "Show everyone again",
    /* A function, because at one it read 「1 people」. Korean has no plural, so only the English
       side branches — the shape every other counter on this screen already uses. */
    healthPeopleUnit: (n: number) => (n === 1 ? "person" : "people"),
    healthOfTotal: (total: number) => `of ${total}`,
    colLastDetected: "Last detected",
    categoryLabel: "Category",
    categoryNone: "Unclassified",
    manageCategories: "Manage categories",
    basisLabel: "Basis for listing",
    basisLabelRequired: "Basis for listing *",
    basisPlaceholder: "Case or document reference",
    expiresLabel: "Listing expires",
    expiresNote: "The listing stops on this date. Expired people stay on the list, marked.",
    noExpiryWarning: "No end date — this person stays a VIP until somebody removes them.",
    colCategory: "Category",
    colExpires: "Expires",
    statusExpired: "Expired",
    statusReleased: "Released",
    expiringInDays: (n: number) => `${n}d left`,
    expiredDaysAgo: (n: number) => `Expired ${n}d ago`,
    detectedAgo: (elapsed: string) => `${elapsed} ago`,
    noExpiry: "No end date",
    // Same words as the cameras table's checkbox, which is the same control doing the same thing —
    // and "shown" stays in both, because both only ever select the rows on screen.
    selectAllLabel: "Select all rows shown",
    selectedCount: (n: number) => `${n} selected`,
    bulkExpiryLabel: "Change end date",
    bulkExpiryPick: "Pick a date",
    bulkExpiryApply: "Apply",
    bulkExpiryNone: "No end date",
    bulkGroupLabel: "Group",
    bulkGroupNone: "No group",
    bulkPriorityLabel: "Priority",
    bulkDelete: "Delete",
    bulkDeletedTitle: (n: number) => `${n} listing(s) deleted`,
    bulkGroupMovedTitle: (n: number) => `${n} listing(s) moved`,
    bulkPrioritySetTitle: (n: number) => `Priority set on ${n} listing(s)`,
    bulkRestoredTitle: (n: number) => `${n} listing(s) restored`,
    bulkConfirmDeleteTitle: (n: number) => `Delete ${n} listing(s)?`,
    bulkConfirmDeleteBody: "They come off this project's VIP list. You can undo this from the toast right after.",
    bulkExpirySetTitle: (n: number) => `End date set on ${n} listing(s)`,
    bulkClearSelection: "Clear",
    expiryUnanswered: "No end date set",
    expiryUnansweredWhy: "Nobody has set an end date on this listing. It is still being matched, and will be until somebody decides otherwise.",
    releaseAction: "Release from VIP",
    reinstateAction: "Put back on the VIP list",
    // "the VIP list", not the store's name for it. Same leak the export toast above records,
    // and the toast this dialog fires already says "Back on the VIP list".
    reinstateTitle: (name: string) => `Put ${name} back on the VIP list?`,
    reinstateBody: "They go back on the matching list. The release and this reversal both stay in the activity log.",
    reinstateReasonPlaceholder: "Released in error · Listing renewed",
    reinstateConfirm: "Reinstate",
    reinstatedToast: "Back on the VIP list",
    releaseTitle: (name: string) => `Release ${name}?`,
    releaseBody: "They come off the VIP list and the matching list. The row stays, marked as released, so the history survives.",
    releaseReasonLabel: "Reason",
    releaseReasonPlaceholder: "Found · Arrested · Listed in error",
    releaseConfirm: "Release",
    releasedToast: "Released from VIP",
    healthReachLabel: "people detected · 7 days",
    healthReachWhy: "How many people on the VIP list were seen at least once in the last 7 days — people, not detections. One person passing a camera twenty times counts once here.",
    healthReachTrend: (prev: number) => `vs ${prev} people last week`,
    healthReachFlat: "same as last week",
    colRegistered: "Registered",
    colNote: "Note",
    confirmRemoveTitle: (name: string) => `Remove ${name}?`,
    confirmRemoveBody: "They will be removed from this project's VIP list, and come off the matching list.",
    removeAction: "Remove",
    vipRemovedTitle: "VIP removed",
    undoRemove: "Undo",
    vipRestoredTitle: "Restored to the registry",
    modalTitle: "Register VIP",
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
    facePhotoLabelRequired: "Face photo *",
    addPhotos: "Add photos",
    representativePhoto: "Shown",
    /* The owner's own sentence, kept word for word (2026-09-18) — it is the whole explanation the
       extra tiles need, and it says the two things that decide whether more pictures help at all:
       clear, and frontal. */
    photoSetHint: "Upload clear frontal face images for best recognition results.",
    photoSetCount: (n: number) => `${n} more`,
    removePhoto: "Remove",
    changePhoto: "Change",
    uploadPhoto: "Upload photo",
    currentPhoto: "Current photo",
    cancel: "Cancel",
    register: "Register",
    priorityText: { normal: "Normal", high: "High", very_high: "Very high" } as Record<NonNullable<Person["priorityLabel"]>, string>,
    bulkTemplate: "Template",
    bulkTemplateHint: "One person per row: a name, and a note if there is one. Photos are picked in the import step and found by file name. Name them after the person, and only fill the photo column where a file is called something else. A file of bare names works too.",
    bulkTemplateMemoHeader: "Memo",
    bulkTemplatePhotoHeader: "Photo file name",
    bulkTemplateName: "Hong Gildong",
    bulkTemplateMemo: "Escorted at all times",
    bulkTemplatePhotoSample: "hong-gildong.jpg",
    tabAll: "All",
    tabGroups: "Groups",
    tabAllHint: "Every person registered for this project, whether or not they belong to a group.",
    tabGroupsHint: "Parties registered together: a visiting delegation, a protection detail. Removing a group keeps its members registered.",
    tabReleased: "Released",
    tabReleasedHint: "Taken off the VIP list, with a record of who did it and why. They are off the matching list — and nothing here has been deleted.",
    addGroup: "Add group",
    colGroup: "Group",
    colMembers: "Members",
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
    moreDetails: "More details",
    expiryPolicyNote: (days: number) => `Default retention — ${days} days from today.`,
    expiryCategoryNote: (label: string, days: number) => `${label} — ${days} days from today.`,
  },
  ko: {
    bulkUpload: "일괄 업로드",
    // The bare noun, the way the sidebar tab and the Overview's button both already say it
    // ("VIP 등록"): three controls that land on this same list were wearing two names. Korean
    // chrome in this product ends in a noun — 저장 · 삭제 · 승인 — and 하기 was the last verb form
    // left in it.
    registerVip: "VIP 등록",
    searchPlaceholder: "VIP 이름으로 검색",
    sortByPriority: "우선순위순",
    allGroups: "전체 그룹",
    allPriorities: "전체 우선순위",
    noGroup: "그룹 없음",
    filtersActive: (n: number) => `필터 ${n}개`,
    filterChipGroup: (name: string) => `그룹: ${name}`,
    filterChipPriority: (label: string) => `우선순위: ${label}`,
    tabCountNarrowed: (shown: number, total: number) => `전체 ${total} 중 ${shown}만 보이는 중 — 검색어나 필터가 걸려 있습니다.`,
    noSearchResults: "조건에 맞는 VIP가 없습니다.",
    noVips: "이 프로젝트에 등록된 VIP가 아직 없습니다.",
    loadFailed: "VIP 명부를 불러오지 못했습니다.",
    retry: "다시 시도",
    registered: (date: string) => `등록일 ${date}`,
    viewGrid: "그리드",
    viewTable: "테이블",
    colName: "이름",
    exportCsv: "CSV 내보내기",
    nothingToExport: "이 목록에 내보낼 것이 없습니다.",
    nothingToExportFiltered: "내보내는 것은 지금 보이는 목록인데, 필터에 걸린 사람이 없습니다. 필터를 지우면 다시 내보낼 수 있습니다.",
    csvRegisteredBy: "등록자",
    csvStatus: "상태",
    csvNever: "없음",
    csvUnclassified: "미분류",
    csvStatusActive: "유효",
    toastVipExportTitle: "내보내기 완료",
    toastVipExportDesc: (n: number) => `VIP ${n}명을 CSV로 내보냈습니다.`,
    colPriority: "우선순위",
    healthRegistered: "등록 인원",
    healthRegisteredWhy: "지금 이 프로젝트의 대조 명단에 있는 사람 전부입니다. 해제된 사람은 빠지고, 만료된 사람은 들어갑니다 — 아직 대조되고 있으니까요.",
    healthShowAll: "전체 보기",
    healthImportErrors: "일괄 업로드 오류",
    healthImportErrorsWhy: "일괄 업로드가 남긴 쓸 수 없는 행입니다: 사진이 아예 없거나, 사진에서 얼굴을 읽어내지 못했거나, 이미 명단에 있는 사람과 중복으로 의심되는 행. 열어서 파일을 고치면 됩니다 — 중복만 예외로, 파일은 맞을 수 있고 두 기록이 같은 사람인지 판단하는 일입니다. 단건 등록은 여기 들어올 수 없습니다 — 그 폼은 등록할 수 없는 사진을 거절합니다.",
    healthExpired: "만료일 지남",
    healthExpiredWhy: "만료일이 지났습니다. 아직 대조되고 있습니다 — 날짜가 사람을 명단에서 내리지는 않습니다. 계속 둘지(만료일 새로 지정) 내릴지(해제) 한 건씩 정해야 합니다.",
    healthExpiredWhyNoRelease: "만료일이 지났습니다. 아직 대조되고 있습니다 — 날짜가 사람을 명단에서 내리지는 않습니다. 계속 둘지(만료일 새로 지정) 내릴지(삭제) 한 건씩 정해야 합니다.",
    healthExpiryUnanswered: "만료일 미지정",
    healthMissingPhoto: "사진 없음",
    healthMissingPhotoWhy: "VIP 목록에는 있지만 얼굴 사진이 없습니다. CSV로 가져오면 사진 없이 이름만 등록될 수 있고, 사진을 올리기 전까지는 매칭되지 않습니다.",
    healthEmbeddingFailed: "사진 인식 실패",
    healthEmbeddingFailedWhy: "사진은 있지만 모델이 얼굴을 읽어내지 못했습니다. 너무 작거나 어둡거나 옆을 봤을 때 생깁니다. 해당 인물을 열어 사진을 교체하면 풀립니다.",
    healthReenrolling: "재등록 대기",
    photoUnreadableHint: "이 사진에서 얼굴을 읽어내지 못했습니다. 어느 카메라에서도 이 인물은 매칭되지 않습니다. 정면이 선명한 사진으로 교체하세요.",
    photoRejectedTitle: "등록 실패 — 얼굴을 등록하지 못했습니다",
    photoRejectedHint: "저장된 것은 없습니다. 이 사진에서 얼굴을 읽어내지 못했고, 얼굴이 등록되지 않은 명단 항목은 어느 카메라에서도 매칭되지 않습니다. 정면이 선명한 사진으로 교체하고 다시 등록해주세요.",
    photoReenrollingHint: "교체할 사진이 접수되었습니다. 모델의 답이 오기 전까지는 여전히 매칭되지 않습니다.",
    healthReenrollingWhy: "새 사진을 올렸고 모델의 답을 기다리는 중입니다. 답이 오기 전까지는 여전히 매칭되지 않습니다 — 사진 교체는 다시 물어본 것이지, 해결이 확인된 게 아닙니다.",
    healthDuplicates: "중복 의심",
    healthDuplicatesWhy: "이름이 같은 기록이 둘 이상입니다. 대개 같은 사람을 두 번 등록한 경우이고, 어느 쪽이든 목록에서는 두 명으로 셉니다.",
    healthShowOnly: "이 항목만 보기",
    healthClear: "전체 다시 보기",
    healthPeopleUnit: () => "명",
    healthOfTotal: (total: number) => `/ ${total}명`,
    colLastDetected: "마지막 탐지",
    categoryLabel: "분류",
    categoryNone: "미분류",
    manageCategories: "분류 관리",
    basisLabel: "등록 근거",
    basisLabelRequired: "등록 근거 *",
    basisPlaceholder: "사건번호 · 공문번호 등",
    expiresLabel: "등록 만료일",
    expiresNote: "이 날짜에 등록이 끝납니다. 만료된 사람은 목록에 표시된 채로 남습니다.",
    noExpiryWarning: "만료일 없음 — 누군가 내리기 전까지 계속 추적 대상입니다.",
    colCategory: "분류",
    colExpires: "만료",
    statusExpired: "만료됨",
    statusReleased: "해제됨",
    expiringInDays: (n: number) => `${n}일 남음`,
    expiredDaysAgo: (n: number) => `만료 ${n}일 지남`,
    detectedAgo: (elapsed: string) => `${elapsed} 전`,
    noExpiry: "무기한",
    selectAllLabel: "보이는 행 전체 선택",
    selectedCount: (n: number) => `${n}명 선택됨`,
    bulkExpiryLabel: "만료일 변경",
    bulkExpiryPick: "날짜 선택",
    bulkExpiryApply: "적용",
    bulkExpiryNone: "무기한으로",
    bulkGroupLabel: "그룹",
    bulkGroupNone: "그룹 없음",
    bulkPriorityLabel: "우선순위",
    bulkDelete: "삭제",
    bulkDeletedTitle: (n: number) => `${n}명 삭제됨`,
    bulkGroupMovedTitle: (n: number) => `${n}명의 그룹을 바꿨습니다`,
    bulkPrioritySetTitle: (n: number) => `${n}명의 우선순위를 바꿨습니다`,
    bulkRestoredTitle: (n: number) => `${n}명 되돌렸습니다`,
    bulkConfirmDeleteTitle: (n: number) => `${n}명을 삭제할까요?`,
    bulkConfirmDeleteBody: "이 프로젝트의 VIP 목록에서 내려갑니다. 바로 뒤 토스트에서 되돌릴 수 있습니다.",
    bulkExpirySetTitle: (n: number) => `${n}명의 만료일을 정했습니다`,
    bulkClearSelection: "선택 해제",
    expiryUnanswered: "만료일 미지정",
    expiryUnansweredWhy: "이 등록에 만료일을 정한 사람이 없습니다. 지금도 대조되고 있고, 누군가 정하기 전까지 계속됩니다.",
    releaseAction: "VIP에서 해제",
    reinstateAction: "VIP로 되돌리기",
    reinstateTitle: (name: string) => `${name}을(를) VIP로 되돌릴까요?`,
    reinstateBody: "대조 명단에 다시 올라갑니다. 해제와 이번 복구 둘 다 변경 기록에 남습니다.",
    reinstateReasonPlaceholder: "잘못 해제함 · 등록 연장",
    reinstateConfirm: "다시 올리기",
    reinstatedToast: "VIP로 되돌렸습니다",
    releaseTitle: (name: string) => `${name}을(를) 해제할까요?`,
    releaseBody: "VIP 목록과 대조 명단에서 내려갑니다. 행은 해제 표시와 함께 남아 이력이 보존됩니다.",
    releaseReasonLabel: "사유",
    releaseReasonPlaceholder: "발견 · 검거 · 착오 등록",
    releaseConfirm: "해제",
    releasedToast: "VIP에서 해제했습니다",
    healthReachLabel: "지난 7일간 탐지된 인원",
    healthReachWhy: "VIP 목록에 있는 사람 중 최근 7일 안에 한 번이라도 잡힌 인원 수입니다. 탐지 건수가 아니라 사람 수라서, 한 사람이 카메라 앞을 스무 번 지나가도 1로 셉니다.",
    healthReachTrend: (prev: number) => `지난주 ${prev}명`,
    healthReachFlat: "지난주와 같음",
    colRegistered: "등록일",
    colNote: "메모",
    confirmRemoveTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    confirmRemoveBody: "이 프로젝트의 VIP 목록에서 삭제되고, 대조 명단에서 내려갑니다.",
    removeAction: "삭제",
    vipRemovedTitle: "VIP 삭제됨",
    undoRemove: "되돌리기",
    vipRestoredTitle: "명단에 되돌렸습니다",
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
    facePhotoLabelRequired: "얼굴 사진 *",
    addPhotos: "사진 추가",
    representativePhoto: "대표",
    photoSetHint: "정면이 선명한 얼굴 사진을 여러 장 올리면 인식률이 좋아집니다.",
    photoSetCount: (n: number) => `${n}장 더`,
    removePhoto: "삭제",
    changePhoto: "변경",
    uploadPhoto: "사진 업로드",
    currentPhoto: "현재 사진",
    cancel: "취소",
    register: "등록",
    priorityText: { normal: "일반", high: "높음", very_high: "매우 높음" } as Record<NonNullable<Person["priorityLabel"]>, string>,
    bulkTemplate: "서식",
    bulkTemplateHint: "한 줄에 한 사람: 이름, 메모가 있으면 메모. 사진은 가져오기 단계에서 고르고 파일 이름으로 찾습니다. 파일 이름을 그 사람 이름으로 해 두면 되고, 다른 이름일 때만 사진 열에 적습니다. 이름만 적힌 파일도 됩니다.",
    bulkTemplateMemoHeader: "메모",
    bulkTemplatePhotoHeader: "사진 파일명",
    bulkTemplateName: "홍길동",
    bulkTemplateMemo: "상시 경호 대상",
    bulkTemplatePhotoSample: "홍길동.jpg",
    tabAll: "전체",
    tabGroups: "그룹",
    tabAllHint: "이 프로젝트에 등록된 사람 전부입니다. 그룹에 속했는지와 무관합니다.",
    tabGroupsHint: "함께 등록된 일행입니다: 방문단, 경호 대상. 그룹을 지워도 소속된 사람은 등록된 채로 남습니다.",
    tabReleased: "해제됨",
    tabReleasedHint: "VIP에서 내려온 사람입니다. 누가 언제 왜 내렸는지가 함께 남습니다. 대조 명단에서 내려갔고, 삭제된 것은 아무것도 없습니다.",
    addGroup: "그룹 추가",
    colGroup: "그룹",
    colMembers: "인원",
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
    moreDetails: "추가 정보",
    expiryPolicyNote: (days: number) => `기본 보유기간 — 오늘부터 ${days}일.`,
    expiryCategoryNote: (label: string, days: number) => `${label} — 오늘부터 ${days}일.`,
  },
};

interface RegisterValues {
  name: string;
  /** Undefined = unclassified, which is a real state — see VipCategory in the store. */
  categoryId?: string;
  basis?: string;
  /** Undefined = no expiry. */
  expiresAt?: string;
  priorityLabel: NonNullable<Person["priorityLabel"]>;
  description?: string;
  /** Undefined = an individual, i.e. in no group. */
  groupId?: string;
  photoUrl?: string;
  /** The rest of the enrolment set, in the order the tiles show it. See Person.enrolmentPhotoUrls. */
  enrolmentPhotoUrls?: string[];
}

/*
 * HOW BIG A FACE HAS TO BE TO JUDGE IT (owner, 2026-10-01: 「사진이 중요한데 사진이 너무 작게
 * 보여 첨부하고 나서」).
 *
 * 72px came over from the previous product without anybody asking what the operator does with
 * the tile. What they do is decide whether the picture is usable — frontal, sharp, the right
 * person — and that is the one decision this form exists to get right: every later screen draws
 * this face, and a photo the model cannot read comes back as 「사진 인식 실패」 days later, once
 * whoever registered it has walked away.
 *
 * EVERY tile grows, not just the first. The hint under the row says a SET improves recognition,
 * so each picture in the set has to be judgeable — a large primary beside five thumbnails would
 * say the opposite of what the sentence says.
 *
 * Sized to the drawer rather than picked, and the drawer was MEASURED rather than assumed: the
 * content column is 479px (the name field spans exactly that, from the same left edge as this
 * row). Three across with the 8px gap the row already used — (479 - 2×8) / 3 = 154 — fills the
 * line exactly, and six photos still make two tidy rows.
 *
 * Four across was the first attempt at 112px and the owner's answer was 「여백 많은데 더 키우면
 * 안돼?」 — correct: with one photo and the add button, four columns left ~240px of the row
 * empty, so the field was paying for columns nothing was going to stand in. Three columns is the
 * largest a face can be here without the set of six turning into a third row.
 *
 * NOT grown to fill when there are fewer photos. A tile that is 235px with one picture and 154px
 * with two would resize the face the operator is looking at, at the moment they add another.
 */
const PHOTO_TILE = 154;
const PHOTO_GAP = 8;

/**
 * Register a face, or edit one already registered — the same five fields either way, so the same
 * form. Editing did not exist: a VIP could be registered and removed and nothing in between, so a
 * misspelled name meant deleting the enrolment and redoing it.
 *
 * The Note field is new to this form in both modes. It shows on the detail sheet and in the table,
 * and until now only the bulk CSV import could write it — a note could exist on a row that nobody
 * was able to type.
 */
function RegisterVipModal({ t, person, photoUnreadable, groups, categories, projectId, onClose, onBack, onSubmit, onManageCategories, escapeSuspended }: {
  t: VipDict;
  /** Absent = registering. Present = editing that person. */
  person?: Person;
  /** Whether the model could not read the photo on file. From registryHealth, which owns the
   *  predicate — recomputing it here would be a second opinion on the same question. */
  photoUnreadable?: boolean;
  groups: PersonGroup[];
  categories: VipCategory[];
  projectId: string;
  onClose: () => void;
  /** Set when this opened over the person's detail panel — see Drawer.onBack. */
  onBack?: () => void;
  onSubmit: (values: RegisterValues) => void;
  onManageCategories: () => void;
  /*
   * True while the category manager is stacked on top of this form.
   *
   * Escape belongs to the panel now, and it closes whatever it is given without asking who else
   * is listening: with both mounted one keystroke closed the manager and the half-filled
   * registration together, and the typed name, the basis and the uploaded photo went with them.
   * So this form withholds its own close while the manager is up — the manager stands over it,
   * ✕ included, for as long as it is open.
   */
  escapeSuspended?: boolean;
}) {
  const editing = person !== undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [priorityLabel, setPriorityLabel] = useState<NonNullable<Person["priorityLabel"]>>(person?.priorityLabel ?? "normal");
  const [description, setDescription] = useState(person?.description ?? "");
  const [groupId, setGroupId] = useState(person?.groupId ?? "");
  const compliance = getComplianceConfig();
  const categoriesEnabled = compliance.vipCategories;
  const [categoryId, setCategoryId] = useState(person?.categoryId ?? "");
  const [basis, setBasis] = useState(person?.basis ?? "");

  /* NO EXPIRY FIELD, AND NO EXPIRY STATE.
     The form used to seed a date from the site's retention rule and let the registrar depart from
     it. How long a face is kept is the institution's rule, not a decision for whoever happens to
     be typing the name (owner's call, 2026-09-18: 등록할 때나 편집할 때 만료일을 설정할 필요도
     없는 거지) — so a new listing submits no date and the store applies the policy (see
     settledExpiry), while an edit keeps the date the row already has. The seeded state, the line
     that explained where the date came from, and the per-category override that went with them
     are all gone: a field nothing reads is a question with no answer.
     Bulk 만료일 변경 is where a date is still set by hand, on purpose — one act, many rows. */
  const chosenCategory = categories.find(c => c.id === categoryId);
  /**
   * The basis is asked for in the open only where a category demands one. Everywhere else it is a
   * reference number somebody may or may not have, which is what the section below is for.
   */
  const basisRequired = !!chosenCategory?.requiresBasis;
  /**
   * Priority, group and note: none of them decide anything the moment a face is registered. They
   * are list furniture — a sort order, a filter, a line on the detail sheet — and every one of
   * them can be set afterwards from the row itself. They were five of the eight fields a person
   * met when registering somebody, at the same weight as the photograph.
   *
   * Open from the start when editing somebody who already has any of them, because a value hidden
   * behind a disclosure is a value the next person will not know is there.
   */
  const [moreOpen, setMoreOpen] = useState(editing && (
    !!person.basis || (person.priorityLabel ?? "normal") !== "normal" || !!person.groupId || !!person.description
  ));
  /**
   * Picking a category fills the expiry from its default, and only then.
   *
   * Not on every keystroke and not on edit: overwriting a date somebody typed, because they
   * happened to change the category afterwards, loses work they will not notice losing. A category
   * with no default (defaultValidDays null) clears the field rather than leaving the previous
   * category's date under a new heading.
   */
  const pickCategory = (nextId: string) => setCategoryId(nextId);
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
  const closeUnlessManagingCategories = () => { if (!escapeSuspended) onClose(); };

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
  /*
   * ONE SET OF FACES, ORDERED, AND THE FIRST ONE IS THE REPRESENTATIVE.
   *
   * It was a single photo and a single dropzone. Several pictures of the same person enrol better
   * than one — one picture is one angle under one light — and the previous product asked for them
   * as a row of tiles under the heading "Face Images" with a + Add tile at the end (owner's
   * screenshot, 2026-09-18). Same shape here.
   *
   * Ordered rather than a bag, because `Person.photoUrl` is the one face the table, the cards, the
   * detail panel and the app all draw: it is photos[0]. The rest go to
   * `Person.enrolmentPhotoUrls`. Removing the first tile promotes the next, so "which face do I
   * see everywhere" is answered by a position the reader can see and change rather than by a flag.
   */
  const [photos, setPhotos] = useState<{ url: string; fileName?: string }[]>(
    person
      ? [
        ...(person.photoUrl ? [{ url: person.photoUrl }] : []),
        ...(person.enrolmentPhotoUrls ?? []).map(url => ({ url })),
      ]
      : [],
  );
  /** Which tile the pointer is over, so it can offer its own remove control. -1 for none. */
  const [photoHoverIndex, setPhotoHoverIndex] = useState(-1);
  /* The rest of this component still asks "is there a face at all?" in one place. */
  const photoPreview = photos[0]?.url ?? null;
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
  /*
   * REGISTRATION CAN FAIL ON THE PHOTO, and it has to say so here rather than succeeding quietly
   * (owner's call, 2026-09-18: "사진 인식을 못하면 등록당시에 등록에 실패했다고 떠야해").
   *
   * Enrolling a face is the server's answer, not something this browser can compute — so the mock
   * cannot decide it, and inventing a rule ("images under 10KB fail") would put a made-up reason
   * behind a real-looking message. The state is therefore reviewable the way this repo reviews its
   * other refusals: open the registry with `?demo=photoRejected` and the next registration is
   * refused once. Same convention as /login?demo= and /gate?demo=.
   *
   * SERVER CONTRACT (HANDOFF-SERVER §5): a registration whose photo produces no face embedding
   * must be REFUSED — do not create the person. The row would look complete and match nothing,
   * which is the failure the "사진 인식 실패" card exists to catch afterwards; at registration
   * there is somebody standing there who can simply take a better picture.
   *
   * The bulk CSV path is the one where this state legitimately arrives late — hundreds of rows
   * processed after the fact, which is what that card is for.
   */
  const [photoRejected, setPhotoRejected] = useState(false);
  const [demoRejects, setDemoRejects] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try { setDemoRejects(new URLSearchParams(window.location.search).get("demo") === "photoRejected"); } catch { /* no window */ }
    });
  }, []);
  /**
   * A photo is required to register and not to edit.
   *
   * Registering somebody with no face is registering nothing: the enrolled image is the whole
   * thing the cameras match against, and a row without one is a name that will never be detected.
   * Editing is the other case — that person already has an enrolled face, and demanding a fresh
   * upload to fix a spelling would be asking for the expensive half of the work again.
   */
  const valid = name.trim().length > 0
    /*
     * The record has to END with a photo, which is not the same as demanding a new upload.
     * `photoPreview` starts as the person's existing photo, so editing a name on somebody already
     * enrolled passes without touching this field — that was the reason the check used to be
     * skipped for edits, and it still holds.
     * What changed: a row that has NO photo (a CSV import, mostly) can no longer be saved without
     * one, because the label now carries a `*` and a form that stars a field it will happily save
     * empty is lying. It is also the same fix the "사진 없음" card is asking for.
     */
    && photoPreview !== null
    // A category that says a basis is required means it: without one the row has nobody to ask
    // later, and "we will fill it in afterwards" is how a registry ends up with none at all.
    && (!basisRequired || basis.trim().length > 0);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // A new picture is a new attempt: the refusal was about the last one.
    setPhotoRejected(false);
    const picked = Array.from(e.target.files ?? []);
    // Cleared so picking the same file twice in a row still fires a change event.
    e.target.value = "";
    if (picked.length === 0) return;
    /* Appended, never replacing: the tiles are a set being built up, and somebody who has already
       chosen three faces and reaches for a fourth is adding, not starting again. */
    setPhotos(previous => [...previous, ...picked.map(file => ({ url: URL.createObjectURL(file), fileName: file.name }))]);
  };
  const removePhoto = (index: number) => {
    setPhotoRejected(false);
    setPhotos(previous => previous.filter((_, i) => i !== index));
  };

  return (
    <Drawer
      title={editing ? t.editModalTitle(person.name) : t.modalTitle}
      onClose={closeUnlessManagingCategories}
      onBack={onBack}
      width="520px"
      footer={
        <>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary"
            onClick={() => {
              if (!valid) return;
              // The refusal belongs before anything is created, and it clears the moment a new
              // photo is chosen (see handlePhotoChange) — a rejection that outlives the picture it
              // was about is just a stuck error.
              if (!editing && demoRejects) { setPhotoRejected(true); return; }
              onSubmit({
              categoryId: categoryId || undefined,
              basis: basis.trim() || undefined,
              // Absent on a new listing, so the store applies the site's policy; on an edit the
              // row keeps the date it already has (the caller spreads onto the existing person).
              expiresAt: editing ? (person?.expiresAt ?? undefined) : undefined,
              name: name.trim(), priorityLabel,
              description: description.trim() || undefined,
              groupId: groupId || undefined,
              /* The first tile is the face the product draws; the rest are the enrolment set.
                 Sent as undefined rather than an empty array when there is only one, so an edit
                 that removed the extras clears the field instead of storing []. */
              photoUrl: photos[0]?.url,
              enrolmentPhotoUrls: photos.length > 1 ? photos.slice(1).map(photo => photo.url) : undefined,
              });
            }}
            disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", }}>
            {/* The plus belongs to adding. Saving an edit adds nothing. */}
            {!editing && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
            {editing ? t.saveEdit : t.register}
          </button>
        </>
      }
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* The face first (2026-09-15). Everything under it describes a person the system has
            to be able to RECOGNISE, and a row with a name and no readable face is a row no
            camera can ever match — this screen already counts those separately as "photo
            unreadable". Asking for the picture last put the one thing the product needs at the
            bottom of a form people fill top to bottom, after four fields that are only useful
            once it works. */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
            {/* Starred when editing too (owner's ask, 2026-09-18: "이름에는 필수표시 있으니까
                사진에도 필수표시가 있어야할것같구"). The mark says what the RECORD needs, not
                what you have to retype right now — the name field carries it over a name that is
                already filled in, and the photo is the same kind of requirement: a row without a
                face is a name no camera can ever match.
                It used to drop the star while editing, which made the one form show a starred
                name beside an unstarred photo and left the reader guessing which rule applied. */}
            {t.facePhotoLabelRequired}
          </label>
          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: "none" }} />
          {/*
            A ROW OF TILES AND A + AT THE END, which is the shape the previous product used for
            exactly this field. Not a wide dropzone: a dropzone is one slot by implication, and
            the whole point here is that there can be several. Wraps, so a set of six does not
            push the form sideways.
          */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: `${PHOTO_GAP}px` }}>
            {photos.map((photo, index) => (
              <span
                key={photo.url}
                onMouseEnter={() => setPhotoHoverIndex(index)}
                onMouseLeave={() => setPhotoHoverIndex(-1)}
                title={photo.fileName}
                style={{ position: "relative", display: "flex", width: `${PHOTO_TILE}px`, height: `${PHOTO_TILE}px`, borderRadius: "10px", overflow: "hidden", border: BORDER, flexShrink: 0 }}>
                <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {/* WHICH ONE THE REST OF THE PRODUCT SHOWS. Marked rather than left to be
                    inferred from position: the table, the cards and the app all draw this face,
                    and a set of five tiles gives no other clue which one that is. */}
                {index === 0 && (
                  <span style={{
                    position: "absolute", left: 0, right: 0, bottom: 0, padding: "2px 0",
                    backgroundColor: "rgba(24,17,39,0.62)", color: "white",
                    fontSize: "10px", fontWeight: 700, textAlign: "center",
                  }}>
                    {t.representativePhoto}
                  </span>
                )}
                {photoHoverIndex === index && (
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    title={t.removePhoto}
                    style={{
                      position: "absolute", top: "3px", right: "3px", display: "flex",
                      width: "20px", height: "20px", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", border: "none", backgroundColor: "rgba(24,17,39,0.72)",
                      color: "white", cursor: "pointer", padding: 0,
                    }}>
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  </button>
                )}
              </span>
            ))}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
                width: `${PHOTO_TILE}px`, height: `${PHOTO_TILE}px`, borderRadius: "10px", flexShrink: 0,
                border: "1px dashed var(--gray-300)", backgroundColor: "var(--gray-50)",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{photos.length === 0 ? t.uploadPhoto : t.addPhotos}</span>
            </button>
          </div>
          {/* The owner's own sentence, under the tiles where the previous product put it. It is
              the whole explanation this field needs: it says why more than one is worth adding
              and what kind of picture is worth adding. */}
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "6px" }}>{t.photoSetHint}</p>
          {/* The reason this form is open, for the people it is open about.
              An admin who clicked "12 photo unreadable", picked a row and got here saw a
              perfectly ordinary-looking photograph and no hint of what was wrong with it. The
              model's complaint belongs against the picture it could not read. */}
          {photoState === "unreadable" && (
            <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.45, marginTop: "6px" }}>{t.photoUnreadableHint}</p>
          )}
          {/* The refusal, against the picture it is about. Danger-toned and above the other two
              hints because this one means NOTHING WAS SAVED — the other two describe a row that
              exists. */}
          {photoRejected && (
            <div style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "var(--danger-100)", border: "1px solid var(--danger-200)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger-500)" }}>{t.photoRejectedTitle}</p>
              <p style={{ fontSize: "11px", color: "var(--gray-600)", lineHeight: 1.45, marginTop: "4px" }}>{t.photoRejectedHint}</p>
            </div>
          )}
          {photoState === "reenrolling" && (
            <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45, marginTop: "6px" }}>{t.photoReenrollingHint}</p>
          )}
        </div>
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
          <TextField value={name} onChange={setName} placeholder={t.namePlaceholder} />
        </div>
        {/* Classification, then what backs it, then when it ends — the three questions an audit
            asks about a registry row, in the order somebody answers them. Above priority
            because a category decides whether the basis is required and what the expiry starts
            at, and a field that changes two others should come before them.
            Behind complianceConfig.vipCategories: with it off the select is gone, `categoryId`
            stays empty, and the basis below is therefore always optional on its own. */}
        {categoriesEnabled && <div>
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
        </div>}
        {/*
         * ALWAYS VISIBLE, AND ABOVE THE FOLD — this is the field an audit asks about first, and
         * it was hidden under "추가 정보" whenever a category did not demand it (2026-09-18).
         *
         * The domain's own products ask for it at creation time, not in an optional drawer:
         * Verkada Command's "Add Person of Interest" flow asks for a name, a face, THE REASON
         * for creating the POI, and which People List it joins — reason is one of four, not an
         * extra. (Verkada's POI has no expiry at all; Avigilon keeps retention as a system-wide
         * "days to retain" setting rather than a field on the person. Ours keeps the date because
         * the deployment's retention rule is a contract item, and a policy default fills it.)
         *
         * It used to exist as TWO copies of the same input — a required one here and an optional
         * one in the drawer — which is two places that had to agree about one value. One block
         * now, and only the label changes.
         */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>
            {basisRequired ? t.basisLabelRequired : t.basisLabel}
          </label>
          <TextField value={basis} onChange={setBasis} placeholder={t.basisPlaceholder} />
        </div>
        {/*
         * NO EXPIRY FIELD, AND THAT IS THE DESIGN (owner's call, 2026-09-18: "등록할때나
         * 편집할때 만료일을 설정할 필요도 없는거지"). Do not add one back per person.
         *
         * One policy decides how long a listing lasts — Settings → 프로젝트 → VIP 등록
         * 유효기간 — and the store stamps it on save (settledExpiry). Avigilon works this way:
         * retention is a system setting with a days figure, not a field on the person. Verkada
         * goes further and has no expiry at all, removing people by hand.
         *
         * The case this used to serve — a delegation here for a week — is the bulk action's:
         * select their rows and use 만료일 지정. That is one deliberate, audited act on a set of
         * people, instead of a date box on every registration that nobody fills in. 118 of 122
         * seeded rows had it unanswered, which is what a field everybody skips looks like.
         */}
        {/* NO RULE ABOVE THIS (owner's ask, 2026-09-18). The toggle is already a break in the
            form — a chevron and a heavier label after a run of fields — and a line drawn right
            above it made the split twice, once with a border and once with the control. Shut by
            default so registering somebody is three fields; everything an audit asks about sits
            above it either way. */}
        <div style={{ paddingTop: "4px" }}>
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: 0, border: "none",
              background: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)",
            }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }}>
              <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.moreDetails}
          </button>
          {moreOpen && <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.priorityLabel}</label>
              <FilterSelect
                value={priorityLabel}
                onChange={v => setPriorityLabel(v as typeof priorityLabel)}
                options={PRIORITY_LABELS.map(p => ({ value: p, label: t.priorityText[p] }))}
              />
            </div>
            {/* Group is set here rather than on the detail sheet, where it used to be the one
                editable thing on a sheet whose other four values were read-only, next to an Edit
                item in the menu — which read as "the group is all you may change". */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.colGroup}</label>
              {newGroupName === null ? (
                <FilterSelect
                  value={groupId}
                  onChange={setGroupId}
                  /* "그룹 없음", the same words the filter uses for the same set. It said
                     "개인", which read as a third kind of registration next to the group names. */
                  options={[{ value: "", label: t.noGroup }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
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
          </div>}
        </div>
      </div>
    </Drawer>
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
function Tag({ label, bg, color, flexible, icon }: { label: string; bg: string; color: string; flexible?: boolean; icon?: React.ReactNode }) {
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
      {icon ? <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{icon}{label}</span> : label}
    </span>
  );
}

/**
 * The three priorities as a flag.
 *
 * Third mark on this column and the one that stays (owner's call, 2026-09-18, naming the pattern:
 * 「깃발(Flag) 스타일 — Flag 아이콘 + 색상 구분 + 텍스트, 가장 표준적인 B2B 방식」). The two
 * before it both said "how much" with their silhouette — three dots, then bars of rising height —
 * and both bought that at the price of reading as something else: the dots as a rating, the bars
 * as signal strength. A flag says "flagged", which is what a priority IS, and the level is carried
 * by the colour and the word beside it, which are the channels this pill already had.
 *
 * Drawn by hand rather than taken from lucide at 10px: the icon set strokes in a 24-unit box, and
 * a 1.5px stroke scaled to 10px turns the pennant into a smudge. A filled pennant holds its shape.
 *
 * `currentColor`, so the mark takes the pill's own colour — grey 600, amber 500, red 500 — and no
 * new colour enters the palette. Same glyph at all three levels on purpose: a flag that changed
 * shape per level would be a second, competing scale beside the colour and the word.
 */
function PriorityMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      {/* The owner's own glyph, path for path. strokeWidth 2.8 rather than its native 1.5: the
          drawing is a 24-unit box rendered at 12px, and 1.5 scaled down that far comes out at
          two-thirds of a pixel — the banner disappears into the pill's background. Same
          correction ICON_STROKE_PX makes everywhere else. */}
      <path strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  );
}

function PriorityTag({ priority, text }: { priority: NonNullable<Person["priorityLabel"]>; text: string }) {
  const { bg, color } = PRIORITY_COLOR[priority];
  return <Tag label={text} bg={bg} color={color} icon={<PriorityMark />} />;
}

/** Add or edit a party. Membership is not set here — a person is put in a group from their own row. */
function GroupModal({ t, group, projectId, onClose }: {
  t: VipDict; group: PersonGroup | null; projectId: string; onClose: () => void;
}) {
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
    <Drawer
      title={group ? t.groupModalEditTitle : t.groupModalAddTitle}
      onClose={onClose}
      width="520px"
      footer={
        <>
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
        </>
      }
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
    </Drawer>
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
 * a time for them would be making up a fact about when somebody was put on a VIP registry.
 *
 * The locale is pinned because the day beside it is an ISO slice: a runtime-default locale would
 * pair 2026-09-11 with whatever clock the viewer's machine happens to prefer.
 *
 * BOTH HALVES IN THE SITE'S ZONE. Pinning the locale was not enough — the day came from slicing
 * the stored string (UTC for anything registered through Portal) while the time came from
 * toLocaleTimeString with no zone at all, so the date could be a day behind the time beside it and
 * the same record read differently depending on where the reader was sitting.
 */
function registeredLong(value: string, zone: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value.slice(0, 10);
  const day = dateKeyIn(at, zone);
  if (!value.includes("T")) return day;
  return `${day} ${clockMinutesIn(at, zone)}`;
}

function PersonDetailModal({ t, person, zone, groups, onClose, onEdit, onRemove }: {
  t: VipDict;
  person: Person;
  /** The site's zone — the registration stamp below is a fact about the site's clock, not the reader's. */
  zone: string;
  groups: PersonGroup[];
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
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
    <Drawer
      title={person.name}
      onClose={onClose}
      width="520px"
      footer={
        /* Outlined, not filled. A dark Close next to a red Remove was two saturated blocks
           arguing on a sheet whose job is to show a photograph, and neither of them was the
           action anybody came for. The only filled button here is Save, and only while there is
           something to save. */
        <button className="portal-btn-outline" onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {t.close}
        </button>
      }
    >
      {/* Square, edge to edge, and square-cornered now that the panel supplies its own header
          above it — rounded corners inside a square panel read as a picture that does not quite
          fit. Capped so the panel does not scroll on account of the photo alone. */}
      <FacePhoto src={person.photoUrl} radius="0"
        style={{ width: "100%", aspectRatio: "1 / 1", maxHeight: "320px", backgroundColor: "var(--gray-100)" }}
        hiddenStyle={{ border: "none", borderBottom: "1px solid var(--gray-200)" }} />
      {/* THE REST OF THE ENROLMENT SET, when there is one. The big photo above is the face
          everything else in the product draws; these are the other pictures this person was
          enrolled from, and "how many angles do we actually have of him" is a question you can
          only answer by seeing them. Absent entirely for a row enrolled from one photograph —
          a strip explaining that there is nothing to show is worse than no strip. */}
      {(person.enrolmentPhotoUrls?.length ?? 0) > 0 && (
        <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)" }}>
            {t.photoSetCount((person.enrolmentPhotoUrls ?? []).length)}
          </span>
          {(person.enrolmentPhotoUrls ?? []).map(url => (
            <FacePhoto key={url} src={url} size={40} radius="8px" />
          ))}
        </div>
      )}
      <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ minWidth: 0 }}>
          {/* The panel's header says who this is, so the name is not repeated here. */}
          {/* Priority only. The group used to be a tag here too, two rows above the select that
              sets it — the same fact stated twice, once unchangeable and once not. Priority has
              no control on this sheet, so the tag is the only place it is said. */}
          {person.priorityLabel && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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
          {/* A dash, not the word "개인". No group is the absence of a value, and this product
              does not dress absences up as values — the same rule that keeps 0,0 out of the
              coordinate fields. */}
          {row(t.colGroup, group
            ? group.name
            : <span style={{ color: "var(--gray-400)" }}>—</span>)}
          {/* Group first, then what qualifies the person, then the note, then when they were
              enrolled — last because it is the one value nobody comes here to read and the only
              one that never changes. The time is shown as well: this is the detail view, and on
              a vipRegistry "when was this face put in" is a question an inspection asks by the
              minute, not by the day. Rows enrolled before Portal recorded a time show only the
              date rather than a made-up one. */}
          {row(t.colNote, person.description || <span style={{ color: "var(--gray-400)" }}>{t.detailNoNote}</span>)}
          {row(t.colRegistered, registeredLong(person.registeredAt, zone))}
        </div>
      </div>
    </Drawer>
  );
}

/**
 * Which registry-health bucket the table can be narrowed to. Exported because the Overview points
 * at one of them: its red "N VIP listings have expired" line used to open this tab unfiltered,
 * leaving the reader to find those rows among a hundred others, and a warning nobody can reach the
 * rows of is a warning nobody can act on.
 */
/**
 * `importErrors` is the union of the three defects a bulk upload leaves behind — no photo, a photo
 * the model could not read, and a suspected duplicate. They are one card on screen (owner's call,
 * 2026-09-18: "인식실패랑 중복은 모두 일괄업로드에 경우에만 뜰것같아서 묶어서 표시") because
 * they arrive together, from the same act, and the reader's next move is the same for all three:
 * open the rows and fix the file. The individual keys stay for the Overview's deep links.
 */
export type VipHealthFilter = "expired" | "expiryUnanswered" | "missingPhoto" | "embeddingFailed" | "reenrolling" | "duplicates" | "detected" | "importErrors";

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * A list has four states (see PortalShared: rows · empty · loading · failed) and this tab can
 * only ever be in two of them today, because it reads the in-memory store synchronously: there
 * is no second where the rows are in the air, and no request that can come back 500.
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

export default function ProjectVipTab({ projectId, openHealthFilter, onHealthFilterOpened }: {
  projectId: string;
  openHealthFilter?: VipHealthFilter | null;
  onHealthFilterOpened?: () => void;
}) {
  const [listState, retryList] = useListState();
  const persons = useVcaStore(s => s.persons);
  const personGroups = useVcaStore(s => s.personGroups);
  const projects = useVcaStore(s => s.projects);
  const vipCategories = useVcaStore(s => s.vipCategories);
  const releasePerson = useVcaStore(s => s.releasePerson);
  const reinstatePerson = useVcaStore(s => s.reinstatePerson);
  // Categories belong to the institution, so they are read through the project's team rather than
  // through the project — see VipCategory in the store.
  const teamId = projects.find(pr => pr.id === projectId)?.teamId;
  const teamCategories = vipCategories.filter(c => c.teamId === teamId);
  // Archived ones stay readable on rows that still reference them, but cannot be chosen again.
  const activeCategories = teamCategories.filter(c => !c.archived);
  const categoryById = new Map(vipCategories.map(c => [c.id, c]));
  // Same gate as the search-purpose list — see canSetPolicy. Both decide what the audit will find,
  // and an administrator able to loosen one and not the other would be a rule nobody could state.
  const me = currentPortalUser(useVcaStore.getState().portalUsers);
  const maySetPolicy = me ? canSetPolicy(me.permission) : true;
  // Registering, editing, releasing and deleting a listed person. Categories keep their own,
  // narrower gate above — an admin may add a person, not redefine what a listing means.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const removePersonGroup = useVcaStore(s => s.removePersonGroup);
  const addPerson = useVcaStore(s => s.addPerson);
  const removePerson = useVcaStore(s => s.removePerson);
  const restorePerson = useVcaStore(s => s.restorePerson);
  const setPersonsGroup = useVcaStore(s => s.setPersonsGroup);
  const setPersonsPriority = useVcaStore(s => s.setPersonsPriority);
  const removePersons = useVcaStore(s => s.removePersons);
  const restorePersons = useVcaStore(s => s.restorePersons);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const updatePerson = useVcaStore(s => s.updatePerson);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [showRegister, setShowRegister] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  // Grid by default: a VIP registry is looked at face-first, and the photo is the thing an operator
  // recognises. Table is for the other job — comparing role, priority and when someone was added
  // across the whole list, which a wall of cards cannot do.
  /**
   * Table first, grid on request.
   *
   * The grid opened by default because a VIP registry is faces and faces are what you recognise — but
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
  const [healthFilter, setHealthFilter] = useState<VipHealthFilter | null>(null);
  /*
   * The Overview's errand, applied on the way in.
   *
   * Handed over as a prop rather than through a query string, the same way the camera one is: it
   * is a handoff between two views one component renders, and a query string would survive a
   * reload and re-narrow a table nobody asked to be narrowed. Cleared through the callback so the
   * next visit to this tab opens on the whole registry.
   *
   * In a microtask rather than straight from the effect body: setting state synchronously there
   * makes React render this tree twice before it paints.
   */
  useEffect(() => {
    if (!openHealthFilter) return;
    const bucket = openHealthFilter;
    queueMicrotask(() => {
      setHealthFilter(bucket);
      onHealthFilterOpened?.();
    });
  }, [openHealthFilter, onHealthFilterOpened]);
  /**
   * All / Individuals / Groups. Same underlined tab row Input Sources and Users & Permissions use.
   *
   * "All" is a real answer here in a way it was not on the Users page: a group's members are
   * people, so the combined tab is a list of people with a Group column — every row fills every
   * column. Individuals is the same list minus anyone in a group; Groups is the parties themselves.
   */
  /*
   * THERE IS NO "INDIVIDUALS" TAB, and that is a decision (owner's call, 2026-09-18). Do not add
   * one back.
   *
   * It used to sit between All and Groups, counting people with no `groupId`. But having no group
   * is not a KIND of person — it is the DEFAULT STATE, the way most of a register looks — and a
   * tab made the absence of a value look like a category. Thirteen products were read for this
   * (Dropbox, Calendly, Twingate, Asana, Circle, Patreon, Whop, …): every one of them keeps ONE
   * list of people and, where groups exist, a SEPARATE list of groups. Where those products do
   * use tabs they split by state or kind — Members / Guests / Invited, Paid / Free — and not one
   * of them has a tab for "people who are not in a group".
   *
   * What replaces it was already here: the group COLUMN on the all-list, and the "그룹 없음"
   * option in the group filter. Anyone who wants only the ungrouped picks that filter.
   */
  const [vipTab, setVipTab] = useState<"all" | "groups" | "released">("all");
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
  const releaseEnabled = getComplianceConfig().personRelease;
  const categoriesEnabled = getComplianceConfig().vipCategories;
  /* The people table's columns, in one place. The expression was written out twice already (the
     heading row and the data row) and the skeleton would have made it three — a grid copied per
     user is a grid that eventually disagrees with itself. */
  const personGrid = categoriesEnabled
    ? (showGroupColumn ? VIP_GRID_WITH_GROUP : VIP_GRID)
    : (showGroupColumn ? VIP_GRID_WITH_GROUP_NO_CAT : VIP_GRID_NO_CAT);
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
  /**
   * The site's zone, and today in it.
   *
   * Expiry is a calendar date, so whether a listing has lapsed is a question about the site's
   * calendar rather than about an instant — and the Overview counts it the same way. Deriving it
   * once here keeps the two screens from drifting apart again.
   */
  const projectZone = useVcaStore(st => st.projects.find(pr => pr.id === projectId)?.timeZone) ?? PROJECT_TIME_ZONE;
  const todayKey = nowMs === null ? null : dateKeyIn(new Date(nowMs), projectZone);
  const [releaseReason, setReleaseReason] = useState("");
  const { sort, toggle: toggleSort } = useTableSort<VipSortKey>({ key: "registered", direction: "desc" });
  /* The bulk upload is a modal now, not a file input hidden behind a toolbar button — see
     VipImportModal for why the write cannot be the first thing that happens. */
  const [showImport, setShowImport] = useState(false);

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
  // todayKey goes in because "expired" is a question about the site's calendar, and the store is
  // where that judgement lives now — see isExpired. Before the clock is read it is null, and the
  // store answers with an empty bucket rather than with a day guessed during render.
  const health = registryHealth(projectId, persons.filter(p => !p.releasedAt), todayKey);
  const duplicateIds = new Set(health.duplicates.flat());
  const healthIds = {
    expired: new Set(health.expired),
    expiryUnanswered: new Set(health.expiryUnanswered),
    missingPhoto: new Set(health.missingPhoto),
    embeddingFailed: new Set(health.embeddingFailed),
    reenrolling: new Set(health.reenrolling),
    duplicates: duplicateIds,
    detected: new Set(health.detectedLast7d),
    importErrors: new Set([...health.missingPhoto, ...health.embeddingFailed, ...duplicateIds]),
  } as const;
  const detectedCount = health.detectedLast7d.length;
  // The same count for the seven days before, which is the only thing that tells a quiet week
  // apart from a broken one. See registryHealth, where the two windows are asked for.
  const detectedPrevCount = health.detectedPrev7d.length;
  const reachDelta = detectedCount - detectedPrevCount;

  const matchingPersons = (vipTab === "released" ? releasedPersons : activePersons)
    .filter(p => !healthFilter || healthIds[healthFilter].has(p.id))
    .filter(p => !groupFilter || (groupFilter === "__none" ? !p.groupId : p.groupId === groupFilter))
    .filter(p => priorityFilter === "ALL" || (p.priorityLabel ?? "normal") === priorityFilter)
    .filter(p => !q || p.name.toLowerCase().includes(q));
  // Unset counts as "normal", both here and in the select's counts: the store leaves the field off
  // for anyone registered before priorities existed, and filing them under their own bucket would
  // invent a distinction the registry does not make.
  /*
   * WHAT IS ON, IN WORDS — the chip is built here because ActiveFilterCount only draws the label
   * it is handed (see PortalShared). It used to say 「1 filter」, which names nothing: with
   * 우선순위=Very High set, the only way to find out which of the two selects was holding the
   * list at 11 rows was to read both of them.
   *
   * The health cells carry their own sentence (「만료일 지남」, 「사진 없음」) and get no prefix —
   * a 「필터: 만료일 지남」 would be a label on a label. 그룹 없음 likewise: prefixing it reads
   * 「그룹: 그룹 없음」.
   */
  const healthFilterLabel: Record<VipHealthFilter, string> = {
    expired: t.healthExpired,
    expiryUnanswered: t.healthExpiryUnanswered,
    missingPhoto: t.healthMissingPhoto,
    embeddingFailed: t.healthEmbeddingFailed,
    reenrolling: t.healthReenrolling,
    duplicates: t.healthDuplicates,
    detected: t.healthReachLabel,
    importErrors: t.healthImportErrors,
  };
  const activeFilterLabels = [
    groupFilter === null ? null
      : groupFilter === "__none" ? t.noGroup
      : t.filterChipGroup(groupById.get(groupFilter)?.name ?? groupFilter),
    priorityFilter === "ALL" ? null
      : t.filterChipPriority(t.priorityText[priorityFilter as NonNullable<Person["priorityLabel"]>]),
    healthFilter === null ? null : healthFilterLabel[healthFilter],
  ].filter((label): label is string => label !== null);
  const activeFilterCount = activeFilterLabels.length;
  /* One filter names itself; two or more go back to a count, because the row wraps. */
  const filterChipLabel = activeFilterLabels.length === 1 ? activeFilterLabels[0] : t.filtersActive(activeFilterCount);
  const clearFilters = () => { setGroupFilter(null); setPriorityFilter("ALL"); setHealthFilter(null); };
  /*
   * A DIFFERENT TAB IS A DIFFERENT LIST, so nothing carries over — filters AND the search box.
   *
   * The round trip 전체 → 그룹 → 전체 used to release the filters and keep the typed text: measured
   * at 우선순위=Very High with "a" in the box, coming back showed 108 rows with the search still
   * reading "a". Two controls in one strip behaving opposite ways on one gesture, and only one of
   * them says on screen that it is still set.
   */
  const switchVipTab = (next: "all" | "groups" | "released") => {
    setVipTab(next);
    clearFilters();
    setSearch("");
  };
  /*
   * What the list says when it has nothing to show.
   *
   * The search box used to decide this on its own, so filtering by group or priority down to an
   * empty intersection printed "no VIPs registered for this project yet" over a registry holding
   * 123 of them — while the chip two inches above it said a filter was on.
   */
  /* Two states now that the Individuals tab is gone — there is no longer a tab that can be empty
     while the register is full. Filtered-to-nothing still has to beat "nothing registered": the
     chip above says a filter is on, and printing "no VIPs registered yet" over a register of 123
     was the defect this branch was written for. */
  const emptyText = q || activeFilterCount > 0 ? t.noSearchResults : t.noVips;
  /* What the pager will say, for the tab badge above — the Groups tab is filtered by the search
     box alone, since the two selects beside it narrow people and that tab lists parties. */
  const tabMatchCount = vipTab === "groups" ? projectGroups.length : matchingPersons.length;
  const tabNarrowed = vipTab === "groups" ? q !== "" : (q !== "" || activeFilterCount > 0);
  /*
   * NOTHING IS REGISTERED ON THIS TAB, and no filter did that.
   *
   * Measured on Northgate, whose lists are all empty: the toolbar still offered a search box, two
   * filter selects, a select-all checkbox and four sort headings, all of them above zero rows and
   * none of them able to change anything. A control that cannot act is a control that has to be
   * ruled out by hand before the reader believes the screen.
   *
   * What stays is what still does something: the tabs, the summary strip (an empty register IS its
   * shape), 일괄 업로드 and 서식 — the two doors out of an empty list — the disabled Export with
   * its reason, and 「VIP 등록」. A screen with nothing but an empty state and no way forward would
   * be the worse trade.
   *
   * Gated on listState so the controls do not blink away under a skeleton: a register still in the
   * air is not an empty one, which is the same rule the empty text below already follows.
   */
  const tabPopulation = vipTab === "groups" ? projectGroupsAll.length
    : vipTab === "released" ? releasedPersons.length
    : activePersons.length;
  const nothingRegistered = listState === "ready" && tabPopulation === 0;
  const sortValue = (person: Person, key: VipSortKey) => {
    switch (key) {
      case "name": return person.name.toLowerCase();
      // Ranked, not alphabetical: "very_high" has to sit above "high", and alphabetically it would
      // sit below it. Unset reads as normal, the same way the filter and the card do.
      case "priority": return PRIORITY_LABELS.indexOf(person.priorityLabel ?? "normal");
      // The instant, not the text. registeredAt arrives as a UTC instant from Portal and as a
      // local one from the seeds, and read as strings those two sort against each other wrongly.
      case "registered": return Date.parse(person.registeredAt);
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
  const sortedPersons = view === "table"
    ? sortRows(matchingPersons, sort, sortValue)
    : gridPriorityFirst
      ? sortRows(matchingPersons, { key: "priority", direction: "desc" }, sortValue)
      : matchingPersons;
  /*
   * PAGED, not an endless scroll (owner's ask, 2026-09-18). 122 people is already a list nobody
   * reaches the end of, and a police roster is thousands — "scroll until you find it" is not a way
   * to work through a register, and there was no way to say where in it you were.
   *
   * Client-side for now: the rows are all in memory either way, so this is the pager the screen
   * needs before the API has pages. The same component runs Server & API's list.
   */
  const [page, setPage] = useState(1);
  /* The starting page size is measured, not fixed at 25 — see useFitRowsPerPage. 69px is this
     table's row height (a 48px face plus the row's own padding), measured in the browser. */
  const { listRef, rowsPerPage, setRowsPerPage, perPageOptions } = useFitRowsPerPage(69);
  /*
   * THE GRID PAGES BY WHOLE ROWS, which the table's measured page size cannot do for it.
   *
   * `useFitRowsPerPage` counts how many 69px ROWS fit the window, and one row is one person in
   * the table. In the grid a row is six people, so the number it returns is an item count that
   * divides into the columns at random: it fitted 7 on a 1440 window, which drew six faces and
   * then one on a line of its own — the orphan this repo's own card rules forbid.
   *
   * 24, 48 and 96 rather than a measurement, because the column count is the browser's to decide
   * (auto-fill) and is not knowable here. All three fill whole rows at one, two, three, four and
   * six columns — every width the grid actually produces except five — so the reader still
   * chooses how long a page is, and every choice comes out square.
   */
  const [gridPageSize, setGridPageSize] = useState(24);
  const pageSize = view === "table" ? rowsPerPage : gridPageSize;
  // Any narrowing changes what page 1 even means, so a filter or a tab switch goes back to it —
  // otherwise searching from page 5 answers with an empty table.
  // Sort belongs in this key too: re-sorting while on page 3 keeps the offset and shows a slice
  // out of the middle of the new order, which reads as "the sort did nothing".
  const pagingKey = `${vipTab}|${q}|${groupFilter ?? ""}|${priorityFilter}|${healthFilter ?? ""}|${view}|${sort.key}|${sort.direction}`;
  const [lastPagingKey, setLastPagingKey] = useState(pagingKey);
  if (lastPagingKey !== pagingKey) { setLastPagingKey(pagingKey); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(sortedPersons.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const projectPersons = sortedPersons.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /**
   * Bulk selection, for the one job this list cannot do a row at a time: answering the expiry
   * question on rows that never had one. Hundreds of them is the realistic number, and a warning
   * that can only be cleared 300 times is a warning people learn to ignore.
   *
   * Only rows actually on screen count as selected, the same rule the cameras table follows —
   * searching for "Tan" while four people from a previous search sit selected, then pressing a
   * bulk action, would change rows the person cannot see.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visibleSelectedIds = projectPersons.filter(p => selectedIds.has(p.id)).map(p => p.id);
  const allVisibleSelected = projectPersons.length > 0 && visibleSelectedIds.length === projectPersons.length;
  const toggleOne = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds(prev => {
    const next = new Set(prev);
    if (allVisibleSelected) projectPersons.forEach(p => next.delete(p.id));
    else projectPersons.forEach(p => next.add(p.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const setPersonsExpiry = useVcaStore(s => s.setPersonsExpiry);
  const recordListExport = useVcaStore(s => s.recordListExport);
  /** The date in the bulk bar's field. Empty means nothing chosen yet, not "no end date". */
  const [bulkExpiry, setBulkExpiry] = useState("");
  /*
   * The selection bar's other three.
   *
   * It offered ONLY the expiry, which read as an odd single errand once the expiry date left the
   * form (owner's question, 2026-09-18: "선택하면 편집이나 삭제가 아니라 만료일변경만 뜨는게
   * 맞아?"). The bar was not wrong, it was unfinished: what belongs in it is whatever the TABLE
   * shows and a set of rows can share — group, priority, expiry — plus deleting them.
   *
   * "편집" is not one of them. A name and a photo are the two things this form edits and neither
   * can be shared by a selection; a bulk edit button would open a form with most of its fields
   * disabled.
   */
  const applyBulkGroup = (groupId: string | null) => {
    const n = visibleSelectedIds.length;
    setPersonsGroup(visibleSelectedIds, groupId);
    showToast({
      variant: "success",
      title: t.bulkGroupMovedTitle(n),
      desc: groupId === null ? t.bulkGroupNone : projectGroupsAll.find(g => g.id === groupId)?.name,
    });
    clearSelection();
  };
  const applyBulkPriority = (priority: NonNullable<Person["priorityLabel"]>) => {
    const n = visibleSelectedIds.length;
    setPersonsPriority(visibleSelectedIds, priority);
    showToast({ variant: "success", title: t.bulkPrioritySetTitle(n), desc: t.priorityText[priority] });
    clearSelection();
  };
  const applyBulkDelete = () => {
    const removed = removePersons(visibleSelectedIds);
    if (removed.length === 0) return;
    showToast({
      variant: "warning",
      title: t.bulkDeletedTitle(removed.length),
      actionLabel: t.undoRemove,
      onAction: () => {
        restorePersons(removed);
        showToast({ variant: "success", title: t.bulkRestoredTitle(removed.length) });
      },
    });
    clearSelection();
    setConfirmingBulkDelete(false);
  };

  const applyBulkExpiry = (value: string | null) => {
    setPersonsExpiry(visibleSelectedIds, value);
    showToast({
      variant: "success",
      title: t.bulkExpirySetTitle(visibleSelectedIds.length),
      desc: value === null ? t.noExpiry : value,
    });
    clearSelection();
    setBulkExpiry("");
  };

  /**
   * The VIP registry as a file.
   *
   * Cameras and the staff roster both export; this list — the one a control centre is audited on
   * and the one a shift supervisor is handed on paper — did not, while the seeded audit log
   * carried a line reading "VIP registry exported to CSV" and taught the customer the button
   * was there.
   *
   * WHAT THE FILTERS SAY, NOT WHAT THE PAGE SHOWS.
   *
   * The toolbar's filters and search are how somebody says which part of the list they want, and
   * exporting past them would hand back a file they did not ask for. Released rows carry their
   * status and reason rather than being dropped — a removal is exactly what an audit asks about.
   *
   * It used to map `projectPersons`, which is `sortedPersons` cut to ONE PAGE — and the page size
   * is not a setting, it is `useFitRowsPerPage` measuring the window. So the window's height
   * decided how many rows left the console: 122 people in the registry, 7 rows in the file, and
   * the toast and the export audit row both reported 7 as if that were the answer. A file that
   * silently holds a fraction of what was asked for is worse than no button, and this one is
   * written down as an extraction in the audit log.
   *
   * `sortedPersons` is the filtered, searched, sorted list — the thing the sentence above always
   * meant.
   */
  const exportCsv = () => {
    const header = [
      t.colName, t.colGroup, ...(categoriesEnabled ? [t.colCategory] : []), t.colPriority, t.basisLabel,
      t.colRegistered, t.csvRegisteredBy, t.colExpires, t.colLastDetected, t.csvStatus,
    ];
    const rows = sortedPersons.map(person => [
      person.name,
      person.groupId ? groupById.get(person.groupId)?.name ?? "" : "",
      ...(categoriesEnabled ? [person.categoryId ? categoryById.get(person.categoryId)?.label ?? "" : t.csvUnclassified] : []),
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
    // The file lands in somebody's downloads folder, so it is named the way the other exports
    // are — -cameras.csv, -staff-roster.csv — rather than after the identifier in the store.
    a.download = `${projects.find(pr => pr.id === projectId)?.name ?? "project"}-vip-registry.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: t.toastVipExportTitle, desc: t.toastVipExportDesc(rows.length) });
    // Written down because a list leaving the console is the part an audit asks about, and until
    // now nothing here knew it had happened. Not a gate — see ListExportRecord.
    recordListExport({ projectId, list: "vips", rowCount: rows.length });
  };

  /**
   * Why the export button is dead, when it is.
   *
   * It greys out on `projectPersons`, which is the list after the search box and the filters — the
   * same set the file would hold. So "there is nothing here" and "your filters have hidden
   * everything" both land on zero, and they are not the same problem: one is answered by
   * registering somebody, the other by clearing a chip two inches to the left. Undefined while the
   * button works, so an enabled control carries no tooltip.
   */
  const exportDisabledReason = projectPersons.length > 0
    ? undefined
    : q || activeFilterCount > 0 ? t.nothingToExportFiltered : t.nothingToExport;

  const register = (values: RegisterValues) => {
    addPerson({
      // The form requires a photo, so values.photoUrl is set here — but it is passed straight
      // through rather than falling back to a stock face, so the one path that can produce a
      // photoless person (the CSV import above) stays the only one.
      name: values.name, type: "VIP", ...(values.photoUrl ? { photoUrl: values.photoUrl } : null),
      ...(values.enrolmentPhotoUrls ? { enrolmentPhotoUrls: values.enrolmentPhotoUrls } : null),
      registeredAt: new Date().toISOString(),
      priorityLabel: values.priorityLabel,
      description: values.description,
      groupId: values.groupId,
      categoryId: values.categoryId,
      basis: values.basis,
      // null, not undefined: the form asked and this is the answer. Undefined would mean nobody
      // was asked, and the store would fill the retention default in over a date the registrar
      // deliberately cleared. See addPerson.
      expiresAt: values.expiresAt ?? null,
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
      /* Written even when undefined, unlike photoUrl above — removing every extra tile has to be
         saveable, and `undefined` is how this field says "only the representative left". The form
         opens with the stored set in it, so what comes back is always the whole answer. */
      enrolmentPhotoUrls: values.enrolmentPhotoUrls,
    });
    showToast({ variant: "success", title: t.vipUpdatedTitle, desc: values.name });
    setEditingPerson(null);
  };

  /*
   * Delete, then offer it back for five seconds.
   *
   * THE SAFEGUARD IS UNDO, NOT A HARDER CONFIRMATION (owner's ask, 2026-09-18: "수동삭제에
   * 실수로 삭제되지않게, 장치가 있었으면 좋겠는뎅"). Eight consoles were read for this —
   * Cloudflare, Clerk, Lindy, Replit, Okta, Relevance AI, PlanetScale, Railway — and every one of
   * them asks you to TYPE THE NAME. Every one of them is also deleting a CONTAINER: a worker, an
   * application, a workspace, a folder, an organization, a service. Not one of them does it for a
   * row in a list, and for good reason: type-to-confirm on a row somebody clears fifty of teaches
   * copy-paste, and a confirmation people have learned to satisfy is not a safeguard.
   *
   * So the row keeps its plain confirmation (with the face on it, which is the check that matters
   * — you see who you are about to erase) and gains an undo. The deletion is real either way:
   * `removePerson` writes its audit line immediately, `restorePerson` writes a second one, and
   * both stay. An undo that hid the first line would be worse than no undo.
   *
   * Project delete is the container case, and that one is switched off entirely for this release
   * (complianceConfig.projectDelete) — when it comes back, type-to-confirm is the pattern for it.
   */
  const confirmRemove = () => {
    if (!confirmingRemove) return;
    const removed = confirmingRemove;
    removePerson(removed.id);
    showToast({
      variant: "warning",
      title: t.vipRemovedTitle,
      desc: removed.name,
      actionLabel: t.undoRemove,
      onAction: () => {
        restorePerson(removed);
        showToast({ variant: "success", title: t.vipRestoredTitle, desc: removed.name });
      },
    });
    setConfirmingRemove(null);
  };

  /** The two columns this import reads, as a file somebody can fill in. Written here and handed to
   *  VipImportModal as well, so the toolbar's 서식 button and the one inside the import modal write
   *  the same file — and so the sample stays reachable for an account that may not import at all. */
  const downloadBulkTemplate = () => {
    /* THREE COLUMNS, and the third one is usually nothing to type.
       A CSV cannot carry a photograph, so images are picked in the import step and found by file
       name (attachVipPhotos in lib/vipImport.ts). The name they are matched against is the
       PERSON'S name by default — which is why the sample value is the sample person's name with an
       extension, demonstrating the convention rather than an override. The column earns its place
       for the folder that came off a camera as IMG_0342.jpg, where there is no convention to lean
       on, and a sheet that leaves it empty loses nothing.

       No instruction row above the header. A comment line in a CSV is a line the parser has to
       read as somebody called "사진은 가져오기 단계에서 고르세요" — the sentence belongs on the
       screen that takes the file, and it is there. */
    const rows = [
      [t.colName, t.bulkTemplateMemoHeader, t.bulkTemplatePhotoHeader],
      [t.bulkTemplateName, t.bulkTemplateMemo, t.bulkTemplatePhotoSample],
    ];
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vip-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      {/*
        The view switch sits at the far end of this row rather than down in the toolbar.

        It answers the same kind of question the tabs do — which shape of this list am I looking at
        — and it is set once and left, while everything in the toolbar below (search, filters, the
        bulk bar) is touched on the way to a particular row. Keeping the two apart stops the
        toolbar from reading as one undifferentiated bank of controls, and leaves the right end of
        that row to the actions.
      */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", borderBottom: BORDER, marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "20px" }}>
        {([
          { id: "all", label: t.tabAll, count: activePersons.length, hint: t.tabAllHint },
          { id: "groups", label: t.tabGroups, count: personGroups.filter(g => g.projectId === projectId).length, hint: t.tabGroupsHint },
          // Only once there is something in it. A permanently visible "Released 0" invites the
          // question of whether releasing is something you are supposed to be doing.
          ...(releaseEnabled && releasedPersons.length > 0
            ? [{ id: "released" as const, label: t.tabReleased, count: releasedPersons.length, hint: t.tabReleasedHint }]
            : []),
        ] as { id: "all" | "groups" | "released"; label: string; count: number; hint: string }[]).map(tab => {
          const active = vipTab === tab.id;
          /*
           * THE BADGE COUNTS WHAT EXISTS, and says so out loud the moment that stops being what
           * the table shows.
           *
           * Measured on Input Sources: a zone filter left the tab reading 「Cameras 62」 over a
           * pager reading "Showing 1–6 of 6" — two numbers in the same eyeful, both looking like
           * the count of one table. The badge is the right number to keep: it is a fact about the
           * tab, it is what lets you tell 그룹 4 from 전체 122 before clicking either, and an
           * inactive tab cannot honestly be filtered by controls that belong to this one.
           * So while something is narrowing the list the ACTIVE tab prints both, 「6/62」 — the
           * pager's number over the tab's — and the rest keep their totals.
           */
          const narrowedHere = active && tabNarrowed && tabMatchCount !== tab.count;
          return (
            <Tooltip key={tab.id} text={narrowedHere ? `${tab.hint} ${t.tabCountNarrowed(tabMatchCount, tab.count)}` : tab.hint}>
              <button onClick={() => switchVipTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                  color: active ? "var(--gray-900)" : "var(--gray-500)",
                  borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
                }}>
                {tab.label}
                <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>
                  {narrowedHere ? `${tabMatchCount}/${tab.count}` : tab.count}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
        {/* Not on the Groups tab: a party has no face, so a wall of cards would be a wall of empty
            squares. Same segmented control Input Sources uses, so the one gesture for "show me
            this differently" looks the same in both places.

            TABLE FIRST (owner, 2026-10-01: 「토글에 테이블을 앞에 두는게 더 좋지않을까?」).
            It was grid-first, from 2026-09-03 when the grid was also the view this screen opened
            on. The default moved to the table and the order never followed, which left the
            segment reading 「그리드 | 테이블」 with the second one selected — and left this
            control the only one in the console that leads with the view you are not in. Input
            Sources is ["table", "map"], so the same gesture now has the same order in both. */}
        {vipTab !== "groups" && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "3px", flexShrink: 0 }}>
            {(["table", "grid"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: "4px 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                  backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                  fontSize: "10px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
                }}>
                {v === "grid" ? t.viewGrid : t.viewTable}
              </button>
            ))}
          </div>
        )}
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
        /*
         * ORDER (owner's call, 2026-09-18): how many are on the list · how many of them were
         * actually seen · what the last import left broken · and only then the one listing that
         * has run out of time.
         *
         * The first two are the register's own shape and are always drawn, even at zero — they
         * answer "what have we got" and "is any of it working", which are the questions somebody
         * opens this screen with. The rest are errands and each one disappears at zero, so a clean
         * register shows two cells and nothing to do.
         */
        {
          key: "registered",
          icon: <Users size={14} strokeWidth={2.4} />,
          figure: activePersons.length,
          unit: t.healthPeopleUnit(activePersons.length),
          label: t.healthRegistered,
          explanation: t.healthRegisteredWhy,
          tone: "neutral" as const,
          /* NEVER DRAWN AS SELECTED. `active` paints the cell (gray-100 here), and keying it on
             "no filter is on" meant the default state of the screen showed this card filled —
             every visit, with nothing chosen (owner's note: "등록인원 왜 회색으로 칠해져있어?").
             A total is not a filter, so it has no selected state to show. It still CLICKS: with a
             cell beside it filtering the list, this is the way back to all of them. */
          active: false,
          title: t.healthShowAll,
          onClick: () => setHealthFilter(null),
        },
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
          tone: "neutral" as const,
          active: healthFilter === "detected",
          title: healthFilter === "detected" ? t.healthClear : t.healthShowOnly,
          onClick: () => setHealthFilter(healthFilter === "detected" ? null : "detected"),
        },
        ...([
          /*
           * THE IMPORT'S LEFTOVERS, AS ONE CELL. No photo, a photo the model could not read, and a
           * suspected duplicate were three amber cells side by side; all three arrive from the same
           * act — a CSV of a few hundred rows — and the next move for all three is the same: open
           * them and fix the file. Single registration cannot produce the first two any more (the
           * form refuses a photo that will not enrol, and requires one at all), so what is left in
           * here really is the import's.
           */
          {
            key: "importErrors" as const,
            count: healthIds.importErrors.size,
            label: t.healthImportErrors,
            why: t.healthImportErrorsWhy,
            icon: <AlertTriangle size={14} strokeWidth={2.4} />,
          },
          // Not amber. A photo somebody has already replaced is not an outstanding defect, it is
          // work in progress, and colouring it the same as the untouched ones would mean the
          // strip never rewarded doing anything about them.
          { key: "reenrolling" as const, count: health.reenrolling.length, label: t.healthReenrolling, why: t.healthReenrollingWhy, icon: <RefreshCw size={14} strokeWidth={2.4} />, neutral: true },
          /* Last, and usually absent: on a register whose period is a year, nothing has run out in
             the first months. It stays because an expired listing is still being matched and needs
             a person to decide (see watchedPersonsInProject). */
          { key: "expired" as const, count: health.expired.length, label: t.healthExpired, why: releaseEnabled ? t.healthExpiredWhy : t.healthExpiredWhyNoRelease, icon: <CalendarX size={14} strokeWidth={2.4} /> },
        ].filter(item => item.count > 0).map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          unit: t.healthPeopleUnit(item.count),
          label: item.label,
          explanation: item.why,
          tone: ("neutral" in item && item.neutral ? "neutral" : "warning") as "neutral" | "warning",
          active: healthFilter === item.key,
          title: healthFilter === item.key ? t.healthClear : t.healthShowOnly,
          onClick: () => setHealthFilter(healthFilter === item.key ? null : item.key),
        }))),
      ]} state={listState} />}

      {/* WRAPS, like Input Sources' toolbar already does. Without it the row kept one line and
          pushed its own primary action off the right edge — measured at 1024: 「VIP 등록」 at
          left 1032, and in grid view 「Export CSV」 too. A toolbar that puts its main button
          off-screen at a size the product is used at is not a toolbar. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: "8px", gap: "8px", marginBottom: TOOLBAR_GAP }}>
      {/* Gone while the tab holds nothing — see nothingRegistered. There is no list to search. */}
      {!nothingRegistered && <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />}
        {/* Next to the search box, the way Input Sources puts its zone / status / engine selects
            there. Not on the Groups tab: both of these narrow a list of people, and that tab lists
            parties. Each option carries its own count, so the reader knows whether a filter is
            worth applying before applying it. */}
        {vipTab !== "groups" && !nothingRegistered && (
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
              <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={filterChipLabel} />
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
        {/* The tools, at the right end of the toolbar — same place Input Sources keeps its own.
            Left of this row is how you narrow and view the list; right of it is what you do to it.
            They were a row of their own above the tabs, which is where they ended up when the page
            title was deleted, and buttons with nothing to their left read as floating chrome. */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {/* Tools follow the tab: registering a face and creating a party are different jobs, and
              a bulk face upload has nothing to do with the list of parties. */}
      {vipTab === "groups" ? (
            <button className="portal-btn-primary" onClick={() => setGroupModalFor({ group: null })} disabled={!mayEdit} title={readOnlyReason}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addGroup}
            </button>
          ) : (<>
          {/* Export stays open to a read-only account — handing the vipRegistry to an auditor as a
              file is most of what the role is for. Import is what goes. */}
          {/* Opens the preview instead of the file picker. Picking a file used to BE the import:
              addPersons ran on the way back from the dialog and the first thing anybody saw was a
              toast with two numbers in it. */}
          <button className="portal-btn-quiet" onClick={() => setShowImport(true)} disabled={!mayEdit} title={readOnlyReason}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: mayEdit ? "var(--gray-600)" : "var(--gray-300)", fontSize: "12px", fontWeight: 600, cursor: mayEdit ? "pointer" : "not-allowed" }}>
            <FileInput size={14} strokeWidth={2.4} />
            {t.bulkUpload}
          </button>
          {/* THE FILE THIS BUTTON WANTS, next to the button that wants it.
              A bulk upload with no stated shape is a guess: somebody with a spreadsheet of two
              hundred names has to find out by trying. Google Workspace's admin console hands out
              a sample CSV for exactly this, and the camera import here already does. The header
              matching is forgiving either way (이름/name, 메모/설명/note, and a file of bare names
              with no header at all), so the template is a help rather than a requirement — which
              is Salesforce's rule too: map what they give you, and let an export be the template.
              Open to a read-only account: downloading a blank file changes nothing. */}
          <button className="portal-btn-quiet" onClick={downloadBulkTemplate} title={t.bulkTemplateHint}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FileDown size={14} strokeWidth={2.4} />
            {t.bulkTemplate}
          </button>
          {/* title, the same way the two buttons on either side of it carry their refusal — a
              toolbar has no room for a sentence under it, and these three have to stay one row. */}
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={projectPersons.length === 0} title={exportDisabledReason}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: projectPersons.length === 0 ? "var(--gray-300)" : "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: projectPersons.length === 0 ? "not-allowed" : "pointer" }}>
            <FileOutput size={14} strokeWidth={2.4} />
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
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>{q ? t.noSearchResults : t.noGroups}</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GROUP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
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
                  borderBottom: isLast ? "none" : TABLE_RULE,
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
      ) : view === "table" ? (
        <div ref={listRef} style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
          {/* Floating over the list rather than pushing it down: the rows being acted on must stay
              where they were when they were picked. A centred pill, not a full-width band — fixed
              positioning is relative to the window and a band would run under the rail. */}
          {visibleSelectedIds.length > 0 && (
            <div style={{ position: "fixed", left: 0, right: 0, bottom: "24px", zIndex: 40, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{
                pointerEvents: "auto", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
                backgroundColor: "var(--gray-900)", borderRadius: "12px", padding: "10px 12px 10px 18px",
                boxShadow: "0 12px 32px rgba(24,17,39,0.28)", maxWidth: "calc(100% - 48px)",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                  {t.selectedCount(visibleSelectedIds.length)}
                </span>
                <span style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--gray-700)" }} />
                {/* Selecting is still allowed for a read-only account — it is how you count a
                    subset. What they lose is the thing that changes rows, and the bar says so
                    rather than showing a dead date field. */}
                {mayEdit ? (<>
                  {/* Group and priority, the other two values a set of rows can share. The bar
                      had only the expiry, which read as a single odd errand — see applyBulkGroup.
                      Selects rather than buttons: the answer is one of a list, and a list of
                      buttons for four groups would be the bar's whole width. */}
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", flexShrink: 0, marginLeft: "4px" }}>{t.bulkGroupLabel}</span>
                  <FilterSelect
                    value=""
                    onChange={v => applyBulkGroup(v === "__none" ? null : v)}
                    options={[
                      { value: "__none", label: t.bulkGroupNone },
                      ...projectGroupsAll.map(g => ({ value: g.id, label: g.name })),
                    ]}
                    fitContent
                  />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", flexShrink: 0 }}>{t.bulkPriorityLabel}</span>
                  <FilterSelect
                    value=""
                    onChange={v => applyBulkPriority(v as NonNullable<Person["priorityLabel"]>)}
                    options={PRIORITY_LABELS.map(pl => ({ value: pl, label: t.priorityText[pl] }))}
                    fitContent
                  />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", flexShrink: 0 }}>{t.bulkExpiryLabel}</span>
                  {/* The app's own picker, not `<input type="date">` — that drew the BROWSER's
                      control, the one white box on this bar that came from somewhere else and
                      looked different in every browser. `single` because an end date is one day,
                      not a span; it hands back {start,end} set to the same day and we keep start. */}
                  <div style={{ width: "150px", flexShrink: 0 }}>
                    <DateRangeTrigger
                      lang={lang}
                      mode="single"
                      size="sm"
                      value={{ start: bulkExpiry ? new Date(bulkExpiry + "T00:00:00") : null, end: null }}
                      onApply={v => setBulkExpiry(v.start ? dateKeyOf(v.start) : "")}
                      emptyText={t.bulkExpiryPick}
                    />
                  </div>
                  <button
                    onClick={() => bulkExpiry && applyBulkExpiry(bulkExpiry)}
                    disabled={!bulkExpiry}
                    style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: bulkExpiry ? "var(--primary-400)" : "var(--gray-700)", color: bulkExpiry ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: bulkExpiry ? "pointer" : "not-allowed", flexShrink: 0 }}
                  >
                    {t.bulkExpiryApply}
                  </button>
                  {/* "No end date" is an answer too, and it has to be reachable here — otherwise
                      the only way to clear the unanswered warning in bulk is to invent a date. */}
                  <button
                    onClick={() => applyBulkExpiry(null)}
                    style={{ height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: "1px solid var(--gray-700)", backgroundColor: "transparent", color: "var(--gray-300)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >
                    {t.bulkExpiryNone}
                  </button>
                </>) : (
                  <span style={{ fontSize: "12px", color: "var(--gray-400)", flexShrink: 0 }}>{readOnlyReason}</span>
                )}
                {/* Delete, at the far end and in danger colour — the one thing on this bar that
                    cannot be re-typed. It asks first and offers an undo afterwards, the same pair
                    the single-row delete uses. */}
                {mayEdit && (
                  <button
                    onClick={() => setConfirmingBulkDelete(true)}
                    style={{ height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: "8px", border: "1px solid var(--danger-400)", backgroundColor: "transparent", color: "var(--danger-400)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >
                    {t.bulkDelete}
                  </button>
                )}
                <button
                  onClick={clearSelection}
                  style={{ border: "none", background: "none", padding: "0 8px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", fontFamily: "inherit", flexShrink: 0 }}
                >
                  {t.bulkClearSelection}
                </button>
              </div>
            </div>
          )}
          {/* The column headings stay while the rows go under them. position:sticky against the
              shell's scroller, at top:0 — no measuring, no fixed positioning, and it works because
              nothing between here and that scroller clips its overflow. zIndex 2 so rows pass
              beneath rather than over, and the gray-50 fill is what makes "beneath" invisible.

              Not drawn over an empty register: the select-all ticks nothing and each heading sorts
              nothing, and a heading strip is what makes a reader expect rows under it. The card
              itself (this div's parent) still draws the box the empty state sits in. */}
          {!nothingRegistered && <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: personGrid, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
            {/* No minHeight on the HEADER's box. The row version sets one because a row is tall
                enough to spare it; here it made the heading strip 49px for a 15px checkbox, which
                reads as a heavier band than the rows under it (owner's note: "테이블 헤더 높이가
                이상하게 두꺼워"). The negative margin still widens the target sideways. */}
            <label style={{ display: "flex", alignItems: "center", margin: "0 -6px", padding: "0 6px", cursor: "pointer" }}>
              <input
                type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label={t.selectAllLabel}
              style={{ accentColor: "var(--gray-900)", cursor: "pointer", justifySelf: "start" }}
              />
            </label>
            {/* Priority leads, then the face (no sortKey — a face has no order). */}
            <span style={{ paddingLeft: "8px" }}>
              <SortableHeader label={t.colPriority} sortKey="priority" sort={sort} onToggle={toggleSort} />
            </span>
            <span />
            {([
              /* ORDER: who · how urgent · why they are listed · who with · since when · last seen.
                 (owner's read, 2026-09-18: "표에 항목들 순서가 좀 어색해보여".)
                 It was name · group · priority · registered · last seen · basis, which put the
                 value an audit asks for FIRST — the basis — in the last column, and a party name
                 ahead of the priority that decides how an operator reacts. Dates go to the right:
                 a column of numbers is the easy one to scan wherever it sits. */
              { label: t.colName, key: "name" },
              /* 그룹 before 등록 근거 (owner's order, 2026-09-18): the group is who this person
                 arrived with, which is the next thing you read after the name; the basis is the
                 paperwork behind the listing and reads better beside it than between it and the
                 name. */
              ...(showGroupColumn ? [{ label: t.colGroup }] : []),
              ...(categoriesEnabled ? [{ label: t.colCategory }] : []),
              { label: t.basisLabel },
              /* 마지막 탐지 before 등록일 (owner's order). Recency is what somebody acts on; the
                 registration date is an audit fact, and audit facts can sit at the end. */
              { label: t.colLastDetected, key: "lastDetected" },
              { label: t.colRegistered, key: "registered" },
              /* 등록 근거, not 메모 (owner's ask, 2026-09-18): "그게 더 중요한거면 표에서도
                 메모가 아니라 등록근거를 보여줘야할것같아". Right — the basis is what an audit
                 asks for, which is why it sits under the name in the form; the note is whatever
                 somebody felt like typing. One column, and it goes to the one that is asked about. */
              { label: "" },
            /* Priority's heading is nudged 8px right — the pill under it carries 8px of its own
               left padding, so a heading flush with the track's edge sat left of every value it
               labels. The other columns are plain text and line up already. */
            ] as { label: string; key?: VipSortKey; indent?: boolean }[]).map((h, i) => (
              <span key={i} style={h.indent ? { paddingLeft: "8px" } : undefined}>
                <SortableHeader label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
              </span>
            ))}
          </div>}
          {/* Only the rows are replaced: the column headings above and the toolbar above them
              stay, because they are still true while the registry is on its way.

              Loading is answered before empty, and that order is the whole guard. "No VIPs
              registered for this project yet" over a list still in the air is the false answer
              this console keeps being bitten by — and on a VIP registry it is the one that gets
              acted on, by registering somebody who is already there. */}
          {listState === "loading" ? <TableSkeleton grid={personGrid} />
            : listState === "failed" ? <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
            : projectPersons.length === 0 ? <TableEmpty text={emptyText} /> : projectPersons.map((person, i) => {
            const isLast = i === projectPersons.length - 1;
            /*
             * WHICH DEFECT THIS ROW HAS, on the row.
             *
             * 사진 없음 · 사진 인식 실패 · 중복 의심 are counted as one cell in the strip above —
             * they arrive from one act and the reader's next move is the same for all three (owner,
             * 2026-09-18) — but pressing that cell gave a list of rows that looked like every other
             * row. The reader had the count and the rows and no way to tell which of the three each
             * row was, so "open them and fix the file" meant opening each one to find out.
             *
             * ALL of them, because a row can be more than one and a photoless row is also a name
             * clash often enough. This used to stop at the first and the photo won, so a row that
             * was both said only 「사진 없음」 — hiding the half the card's instruction does not
             * cover. The photo still comes first in the reading order, because it is the one that
             * stops the person being matched at all; the duplicate is a question about the
             * register, not about whether it works. At most two can land: a row has no photo or an
             * unreadable one, never both.
             */
            const defects = [
              healthIds.missingPhoto.has(person.id) ? t.healthMissingPhoto : null,
              healthIds.embeddingFailed.has(person.id) ? t.healthEmbeddingFailed : null,
              healthIds.duplicates.has(person.id) ? t.healthDuplicates : null,
            ].filter(Boolean);
            return (
              /*
               * THE WHOLE ROW OPENS THE PERSON, and lights up under the pointer — the same
               * interaction Input Sources' rows have (owner's note, 2026-09-18: "입력소스 처럼
               * 호버해서 클릭해서 상세 띄어지게 … 지금은 이름을 클릭해야하더라구").
               *
               * Before this, the only way in was the name — a ~200px target in a 1500px row, with
               * nothing about the row saying it led anywhere. The controls inside stop the event:
               * a checkbox is a selection, not a visit, and the ⋯ menu opening the sheet behind
               * its own dropdown would be absurd.
               */
              <div key={person.id}
                className="portal-attention-row"
                role="button"
                tabIndex={0}
                onClick={() => setDetailFor(person)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(person); } }}
                style={{
                display: "grid", gridTemplateColumns: personGrid, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                borderBottom: isLast ? "none" : TABLE_RULE,
                borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
                cursor: "pointer",
              }}>
                {/* The whole 28px cell is the target, not the 13px box inside it (owner's note,
                    2026-09-18: "선택박스 클릭 영역이 너무 작아"). A label wrapping the input makes
                    the padding clickable without a click handler of its own, and the box itself
                    goes to 15px — the browser default is 13. */}
                <label
                  onClick={e => e.stopPropagation()}
                  style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-start",
                  height: "100%", minHeight: "32px", margin: "0 -6px", padding: "0 6px", cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(person.id)}
                    onChange={() => toggleOne(person.id)}
                    aria-label={person.name}
                    style={{ accentColor: "var(--gray-900)", cursor: "pointer", width: "15px", height: "15px", margin: 0 }}
                  />
                </label>
                {/* `?? "normal"`, because THERE IS NO THIRD STATE and this cell was inventing one.
                    Everything else in the product reads an absent priority as 일반 — the filter, the
                    sort, the CSV export, the registration form's default and the grid card — so a
                    dash here meant filtering by 일반 returned rows whose own cell looked empty
                    (owner's question: "우선순위가 없는 경우도 있어?"). The field is optional only
                    because rows registered before priorities existed carry nothing. */}
                <span><PriorityTag priority={person.priorityLabel ?? "normal"} text={t.priorityText[person.priorityLabel ?? "normal"]} /></span>
                {/* 48px, up from 32. A face at 32 in a table is a thumbnail of a thumbnail, and
                    this column exists so the reader can tell one Michael from another. The row's
                    own padding is untouched — the first grid track grew with the picture, so the
                    row is taller by exactly what the picture needed and by nothing else. */}
                <FacePhoto src={person.photoUrl} size={48} radius="8px" />
                {/* The name is the way in, as it is in most tables — a narrow target that does not
                    fight the group select two cells over for the same click. */}
                {/* Just the name. The expiry tag moved under 등록일, where the other lifecycle
                    date lives (owner's ask: "이름 아래 있는 만료 표시를 등록일 아래로 옮겨줘"). */}
                <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  {/* Text, not a button. The row is the target now, and a button inside it aimed
                      at the same person is a smaller version of the row — the same reason the grid
                      cards carry no controls of their own. */}
                  <span title={person.name}
                    style={{
                      fontSize: "13px", fontWeight: 700, color: "var(--gray-900)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                    {person.name}
                  </span>
                  {/* Under the name, where the expiry tag used to sit: it is a fact about this
                      listing, and the name cell is the only one on the row with a second line to
                      give. Amber like every other outstanding defect in Portal, and 「중복 의심」
                      carries no number — the check is a name match, and a score printed here would
                      be a figure nobody can act on. */}
                  {defects.length > 0 && (
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--warning-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {defects.join(" · ")}
                    </span>
                  )}
                </span>
                {showGroupColumn && (
                  <span style={{ minWidth: 0, fontSize: "12px", color: person.groupId ? "var(--gray-600)" : "var(--gray-300)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {personGroups.find(g => g.id === person.groupId)?.name ?? "—"}
                  </span>
                )}
                {categoriesEnabled && <span style={{ minWidth: 0 }}>
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
                </span>}
                <span title={person.basis || undefined} style={{ fontSize: "12px", color: person.basis ? "var(--gray-600)" : "var(--gray-300)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.basis || "—"}</span>
                {/* A VALUE, NOT A CONTROL. This was a select on every row, so 123 bordered boxes
                    with dropdown arrows ran down the middle of the table — after the faces, the
                    loudest thing on the screen, and most of them reading "Individual".

                    Membership is still set from the person rather than from the group (a member
                    list in the group editor would be a second place that has to agree about who is
                    in it). What changed is where: the edit form, which already carries it, and the
                    bulk selection. Every other table in Portal shows values and sends changes to a
                    form; this column was the one that did not. */}
                {/* The category, in the institution's own word and its own colour. Unclassified
                    says so rather than showing a dash: it is a state somebody chose (or has not
                    got round to), not a missing value. */}
                {/* The same em dash every other empty cell in this table uses, in the same grey as
                    the priority column's. It was the word "Never" first, on the grounds that "not
                    recorded" and "never matched" are different answers — but two rows in three have
                    no match, so the word repeated down almost the whole column and buried the dates
                    that are the reason to look. The header names the column and the sort collects
                    these rows together; the dash does not need to carry the sentence. Grey, never
                    amber — never being seen is not a fault (see Person.lastDetectedAt). */}
                <span style={{ display: "flex", flexDirection: "column", gap: "1px", fontSize: "12px", color: person.lastDetectedAt ? "var(--gray-600)" : "var(--gray-300)" }}>
                  {/* Date AND time, in the site's own zone. A sighting is a moment — "seen on the
                      8th" is the half of it that does not help somebody deciding whether to look at
                      the footage (owner's ask, 2026-09-18). The value carries an instant now; it
                      used to be stored as a bare date, so there was no time to show. */}
                  {person.lastDetectedAt
                    ? `${dateKeyIn(new Date(person.lastDetectedAt), PROJECT_TIME_ZONE)} ${clockMinutesIn(new Date(person.lastDetectedAt), PROJECT_TIME_ZONE)}`
                    : "—"}
                  {/* How long ago, under the date (owner's ask). A date answers "when"; the reader
                      is asking "recently or not", and 2026-09-08 only answers that if you are
                      holding today's date in your head. Null until mounted, like every other clock
                      read on this screen. */}
                  {person.lastDetectedAt && nowMs !== null && (
                    <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>
                      {t.detectedAgo(formatElapsed(nowMs - Date.parse(person.lastDetectedAt), lang))}
                    </span>
                  )}
                </span>
                {/* The registration date, and under it the expiry if it has lapsed. Both are the
                    listing's lifecycle, which is why they belong in one cell — the tag used to sit
                    under the NAME, two columns away from the only other date that describes the
                    same thing. */}
                <span style={{ display: "flex", flexDirection: "column", gap: "1px", fontSize: "12px", color: "var(--gray-600)" }}>
                  {person.registeredAt.slice(0, 10)}
                  {(() => {
                    if (!person.expiresAt || !isExpired(person, todayKey)) return null;
                    const daysAgo = nowMs === null ? null : Math.floor((nowMs - Date.parse(person.expiresAt)) / 86_400_000);
                    return (
                      /* Grey, not red. The listing is still being matched and nothing is broken —
                         it is a question waiting for an answer, and the count in the strip above is
                         where the colour belongs. Red on a row that is working as designed is the
                         same mistake as the amber pill that ran down 119 of 123 rows. */
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>
                        {daysAgo === null ? t.statusExpired : t.expiredDaysAgo(daysAgo)}
                      </span>
                    );
                  })()}
                </span>
                {/* Expiry, and what has already happened to it.
                    Released and expired rows stay in the list — if they vanished, nobody could tell
                    which of the two happened, and "it is gone" is the one answer a vipRegistry must
                    never give about somebody it used to hold. */}
                {/* The same overflow menu the roster, users and camera tables use. A lone trash
                    icon was the only row action this table had, which is also why there was no way
                    to edit a VIP from the table at all. */}
                <div style={{ justifySelf: "end" }} onClick={e => e.stopPropagation()}>
                  <RowActionsMenu actions={[
                    { label: t.editPerson, onClick: () => setEditingPerson(person), disabled: !mayEdit, reason: readOnlyReason },
                    // Release before delete, and delete stays the destructive one. Taking somebody
                    // off the list is the ordinary end of a listing; erasing the record of it is not.
                    // Released rows got no action at all here, which made release one-way: the
                    // only undo was delete-and-re-register, destroying the registration history
                    // the release was kept to preserve.
                    //
                    // Both are behind complianceConfig.personRelease — off for the first release,
                    // where delete is the only way off the list.
                    ...(releaseEnabled
                      ? [person.releasedAt
                          ? { label: t.reinstateAction, onClick: () => setReinstating(person), disabled: !mayEdit, reason: readOnlyReason }
                          : { label: t.releaseAction, onClick: () => setReleasing(person), disabled: !mayEdit, reason: readOnlyReason }]
                      : []),
                    { label: t.removeAction, onClick: () => setConfirmingRemove(person), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      ) : listState !== "ready" ? (
        /* The card view's own copy of the two states. Its skeleton borrows the table's grid on
           purpose — a card grid has no columns to lay bars on, and what is being said here is
           "rows are coming", which is the same sentence either way. */
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS }}>
          {listState === "loading"
            ? <TableSkeleton grid={personGrid} rows={4} />
            : <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />}
        </div>
      ) : projectPersons.length === 0 ? (
        /* The grid's empty state is a card of its own, where the table's sits inside one: a grid
           of faces has no column headings to keep standing. */
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS }}>
          <TableEmpty text={emptyText} />
        </div>
      ) : (
        /*
         * gridAutoRows 1fr IS WHAT MAKES THE HEIGHTS MATCH, and it is now the only thing doing it.
         *
         * It used to sit on top of fixed slots inside each card — a 35px name box and an 18px tag
         * row, reserved whether the card needed them or not. Two mechanisms for one job, and the
         * inner one cost what the owner saw (2026-10-01: 「이름이 두줄되는 사람 때문에 이렇게
         * 적은거지? 여백이 다 카드중간에 있네」): a one-line name left the second line empty, so
         * most cards had a hole between the name and the pill that qualifies it. A gap there does
         * not read as layout, it reads as the tag having come loose from the name.
         *
         * So the slots are gone, the text block fills the card, and the date is pushed to the
         * bottom. The cards in a row are still exactly as tall as each other — the grid sees to
         * that — and the dates line up across the row because they all sit on its floor. The
         * slack that is left is one piece, below the last thing the card says, where slack
         * belongs.
         */
        /*
         * THE FACE IS THE CARD (owner, 2026-10-01: 「vip 등록에 그리드가 꼭 필요할까?」 → ②).
         *
         * It nearly was not needed, and the measurement is why: the card was 240px wide and the
         * face inside it was 60px — twelve pixels more than the table's 48px row. For those
         * twelve pixels the view gave up sortable headings, the per-row group select and every
         * column the table lays side by side. This file's own note on the detail sheet said the
         * quiet part: a 60px thumbnail 「is a locator, not a likeness」, and an operator asking
         * 「is this the person in front of me」 cannot answer it from one. So the view that exists
         * to be read by face could not be.
         *
         * The grid kept its place by becoming what 2026-09-03 said it was for — 「감시 대상
         * 명단은 얼굴부터 보는 화면」 — rather than by being defended. The face now fills the
         * card and the name sits under it.
         *
         * 176px minimum, not 240: the question this view answers is "which of these is the person
         * I am looking at", which wants as many RECOGNISABLE faces on screen as fit. At 176 the
         * portal's content column takes six across, so each face lands near 190px — about three
         * times the old thumbnail — and a screenful still holds two dozen of them.
         */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gridAutoRows: "1fr", gap: "8px" }}>
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
                /* No padding on the card any more, and `overflow: hidden` instead: the picture
                   runs to the card's own edges and is clipped by its radius, so the face is as
                   large as the card can make it. The text block below carries the padding. */
                overflow: "hidden",
                display: "flex", flexDirection: "column", cursor: "pointer",
              }}>
              {/* 4:5, the shape a face is photographed in — a square crops a portrait's chin or
                  its hair, and this picture is the one thing on the card that has to be right.
                  No `size`: FacePhoto sizes itself from `style` when asked to fill (the detail
                  sheet's full-bleed picture does the same), so the face follows the column width
                  instead of a number that would stop matching it. */}
              <FacePhoto src={person.photoUrl} radius="0"
                style={{ width: "100%", aspectRatio: "4 / 5", flexShrink: 0 }}
                hiddenStyle={{ borderWidth: "0 0 1px 0" }} />
              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", padding: "8px 12px 10px" }}>
                {/* Name first. The tags used to sit above it, which put a pill where the eye goes
                    for the thing a vipRegistry card is actually scanned for — a face and a name. The
                    group and the priority qualify that name, so they read after it. */}
                {/* Up to two lines, and only as many as the name uses. Clamped at two rather
                    than ellipsised on one, because a registry that truncates the name has broken
                    the one thing it is for — "Muhammad Rizal bin Hassan" wraps at this width and
                    two lines hold every name in the register. No reserved height: the row's cards
                    are levelled by the grid, so a name that needs one line can have one. */}
                <p style={{
                  fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.35,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>{person.name}</p>
                {(
                  /* Priority on every card, "normal" included.
                     It used to appear only when raised, on the grounds that a grey NORMAL pill said
                     nothing — but the absence said nothing either, and worse, it said it in the
                     same silence as "nobody has set this yet". Every face in the registry has a
                     priority; the card states it. Normal stays grey, so the ones that are not
                     normal are still the only colour in the grid.
                     One line and no wrap. The row is always drawn because the priority is always
                     stated, so there is nothing to reserve for — and clipping it keeps a long
                     group name from wrapping onto a second line. */
                  <div style={{ display: "flex", gap: "4px", margin: "4px 0 0", overflow: "hidden" }}>
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
                    the card or had to be clamped — and a vipRegistry grid is read at a hundred faces
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
                {/* On the card's floor, not under the tags: `marginTop: auto` takes whatever
                    slack the card has, so the dates sit on one line across the row however long
                    the names above them are. */}
                <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "auto", paddingTop: "6px" }}>{person.registeredAt.slice(0, 10)}</p>
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


      {/* UNDER THE LIST, on its own row. It was tried above the table — the range reads as a
         caption there and you do not have to scroll to turn the page — and the owner took it back
         ("위에 있는게 너무 어색하다"): a pager between the toolbar and the column headings puts
         three bands of controls in a row before any data appears. Under the table is where every
         comparable console keeps it (Navattic, Vapi, Xero, Employment Hero, Gusto), and it is
         where the eye already is when it reaches the end of a page.
         Never inside the toolbar: that row then held nine controls on one line. */}
      {/* No pager over rows that have not arrived. */}
      {vipTab !== "groups" && listState === "ready" && (
        <TablePagination
          total={sortedPersons.length}
          page={currentPage}
          rowsPerPage={pageSize}
          onPage={setPage}
          /* The grid keeps the control and changes what it offers: its sizes are the ones that
             divide into the columns, so a longer page is still whole rows. */
          onRowsPerPage={view === "table" ? setRowsPerPage : setGridPageSize}
          perPageOptions={view === "table" ? perPageOptions : [24, 48, 96]}
        />
      )}

      {showRegister && <RegisterVipModal t={t} groups={projectGroupsAll} categories={activeCategories} onManageCategories={() => setManagingCategories(true)} escapeSuspended={managingCategories} projectId={projectId} onClose={() => setShowRegister(false)} onSubmit={register} />}
      {confirmingBulkDelete && (
        <ConfirmModal
          title={t.bulkConfirmDeleteTitle(visibleSelectedIds.length)}
          body={t.bulkConfirmDeleteBody}
          confirmLabel={t.bulkDelete}
          cancelLabel={t.cancel}
          danger
          onClose={() => setConfirmingBulkDelete(false)}
          onConfirm={applyBulkDelete}
        />
      )}
      {/* The face IS the check: this list is people, and the row that was clicked is identified by
          a name that several of them can share. So the photo comes with the question — that is
          what ConfirmModal's `children` is for, and it is why this dialog kept its own markup
          long after the rest of the tab moved over. It no longer has to: the hand-drawn copy had
          stopped matching the shared one's confirm button anyway.
          One heading, not a name on one line and "정말 삭제하시겠습니까?" under it — the second line
          repeated the first without adding anything, and the question it asked was about nobody in
          particular. That is carried by the title string itself.
          The photo sits UNDER the sentence now rather than above the name, because `children` is
          the slot below the body and a centred stack is not worth a second copy of this card. */}
      {confirmingRemove && (
        <ConfirmModal
          title={t.confirmRemoveTitle(confirmingRemove.name)}
          body={t.confirmRemoveBody}
          confirmLabel={t.removeAction}
          cancelLabel={t.cancel}
          danger
          onConfirm={confirmRemove}
          onClose={() => setConfirmingRemove(null)}
        >
          <FacePhoto src={confirmingRemove.photoUrl} size={72} radius="50%" style={{ marginTop: "14px" }} />
        </ConfirmModal>
      )}
      {managingCategories && teamId && (
        <VipCategoryModal teamId={teamId} categories={teamCategories} canEdit={maySetPolicy} onClose={() => setManagingCategories(false)} />
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
          zone={projectZone}
          groups={personGroups.filter(g => g.projectId === projectId)}
          onClose={() => setDetailFor(null)}
          /* The detail panel stays under this (owner, 2026-09-28: 저렇게 열고 뒤로가기가 없는게
             또 있으면 고쳐줘) — 편집 used to close it, so ✕ landed on the table and the record
             you were reading was gone. Now ← comes back to it. */
          onEdit={() => setEditingPerson(detailFor)}
          onRemove={() => { setConfirmingRemove(detailFor); setDetailFor(null); }}
        />
      )}
      {/*
        AFTER the detail panel, not before it (owner, 2026-09-28: 저렇게 열고 뒤로가기가 없는게
        또 있으면 고쳐줘).

        Both are Drawers flush to the right edge, so the LATER one paints on top. This block used
        to sit above PersonDetailModal in the tree, which put the editor UNDER the panel it opens
        from — measured: the ← was at x=937 and elementFromPoint returned the detail panel's box,
        so the arrow was there and unclickable. Stacking order is render order here.
      */}
      {editingPerson && (
        <RegisterVipModal t={t} person={editingPerson}
          photoUnreadable={healthIds.embeddingFailed.has(editingPerson.id) || healthIds.reenrolling.has(editingPerson.id)}
          groups={projectGroupsAll} categories={activeCategories} onManageCategories={() => setManagingCategories(true)} escapeSuspended={managingCategories} projectId={projectId}
          onClose={() => setEditingPerson(null)} onBack={detailFor ? () => setEditingPerson(null) : undefined} onSubmit={saveEdit} />
      )}
      {groupModalFor && (
        <GroupModal t={t} group={groupModalFor.group} projectId={projectId} onClose={() => setGroupModalFor(null)} />
      )}
      {showImport && (
        <VipImportModal projectId={projectId} onClose={() => setShowImport(false)} onDownloadTemplate={downloadBulkTemplate} />
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

