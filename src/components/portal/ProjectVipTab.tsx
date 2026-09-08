"use client";

import { useRef, useState } from "react";
// 2.4, not 1.4: lucide draws in a 24-unit box and this renders at 14px — see ICON_STROKE_PX.
import { AlertTriangle, ArrowDownWideNarrow, Eye, ImageOff, Users } from "lucide-react";
import { registryHealth, useVcaStore, type Person, type PersonGroup } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { TABLE_HEADER_COLOR, ActiveFilterCount, TextField, FIELD_STYLE, FIELD_FOCUS, BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, ConfirmModal, FilterSelect, RowActionsMenu, SortableHeader, SummaryStrip, Tooltip, sortRows, useTableSort } from "./PortalShared";

type VipSortKey = "name" | "priority" | "registered";

// 36px for the actions column, the width RowActionsMenu gets in every other table.
const VIP_GRID = "48px 1.5fr 0.7fr 0.8fr 1.6fr 36px";
/** The All tab adds a Group column; the Individuals tab would print "Individual" on every row. */
const VIP_GRID_WITH_GROUP = "48px 1.3fr 0.9fr 0.7fr 0.75fr 1.3fr 36px";
const GROUP_GRID = "1.5fr 0.6fr 0.8fr 1.6fr 36px";

const PRIORITY_LABELS: NonNullable<Person["priorityLabel"]>[] = ["normal", "high", "very_high"];
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
  registered: (date: string) => string;
  viewGrid: string;
  viewTable: string;
  colName: string;
  colPriority: string;
  healthMissingPhoto: string;
  healthEmbeddingFailed: string;
  healthDuplicates: string;
  healthShowOnly: string;
  healthClear: string;
  healthPeopleUnit: string;
  healthOfTotal: (total: number) => string;
  healthReachLabel: string;
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
    registered: (date: string) => `Registered ${date}`,
    viewGrid: "Grid",
    viewTable: "Table",
    colName: "Name",
    colPriority: "Priority",
    healthMissingPhoto: "no photo",
    healthEmbeddingFailed: "photo unreadable",
    healthDuplicates: "possible duplicates",
    healthShowOnly: "Show only these",
    healthClear: "Show everyone again",
    healthPeopleUnit: "people",
    healthOfTotal: (total: number) => `of ${total}`,
    healthReachLabel: "seen in the last 7 days",
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
    registered: (date: string) => `등록일 ${date}`,
    viewGrid: "그리드",
    viewTable: "테이블",
    colName: "이름",
    colPriority: "우선순위",
    healthMissingPhoto: "사진 없음",
    healthEmbeddingFailed: "사진 인식 실패",
    healthDuplicates: "중복 의심",
    healthShowOnly: "이 항목만 보기",
    healthClear: "전체 다시 보기",
    healthPeopleUnit: "명",
    healthOfTotal: (total: number) => `/ ${total}명`,
    healthReachLabel: "지난 7일 탐지",
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
function RegisterVipModal({ t, person, groups, projectId, onClose, onSubmit }: {
  t: VipDict;
  /** Absent = registering. Present = editing that person. */
  person?: Person;
  groups: PersonGroup[];
  projectId: string;
  onClose: () => void;
  onSubmit: (values: RegisterValues) => void;
}) {
  const editing = person !== undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [priorityLabel, setPriorityLabel] = useState<NonNullable<Person["priorityLabel"]>>(person?.priorityLabel ?? "normal");
  const [description, setDescription] = useState(person?.description ?? "");
  const [groupId, setGroupId] = useState(person?.groupId ?? "");
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
  useEscapeKey(onClose);

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
  const photoInputRef = useRef<HTMLInputElement>(null);
  /**
   * A photo is required to register and not to edit.
   *
   * Registering somebody with no face is registering nothing: the enrolled image is the whole
   * thing the cameras match against, and a row without one is a name that will never be detected.
   * Editing is the other case — that person already has an enrolled face, and demanding a fresh
   * upload to fix a spelling would be asking for the expensive half of the work again.
   */
  const valid = name.trim().length > 0 && (editing || photoPreview !== null);

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
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary"
            onClick={() => valid && onSubmit({
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
            { label: t.editPerson, onClick: onEdit },
            { label: t.removeAction, onClick: onRemove, danger: true },
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
  const removePersonGroup = useVcaStore(s => s.removePersonGroup);
  const setPersonGroup = useVcaStore(s => s.setPersonGroup);
  const addPerson = useVcaStore(s => s.addPerson);
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
  const [healthFilter, setHealthFilter] = useState<"missingPhoto" | "embeddingFailed" | "duplicates" | null>(null);
  /**
   * All / Individuals / Groups. Same underlined tab row Input Sources and Users & Permissions use.
   *
   * "All" is a real answer here in a way it was not on the Users page: a group's members are
   * people, so the combined tab is a list of people with a Group column — every row fills every
   * column. Individuals is the same list minus anyone in a group; Groups is the parties themselves.
   */
  const [vipTab, setVipTab] = useState<"all" | "individuals" | "groups">("all");
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
  const { sort, toggle: toggleSort } = useTableSort<VipSortKey>({ key: "registered", direction: "desc" });
  const [searchFocused, setSearchFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = search.trim().toLowerCase();
  const allProjectPersons = persons.filter(p => p.projectId === projectId);
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
  const health = registryHealth(projectId, persons);
  const duplicateIds = new Set(health.duplicates.flat());
  const healthIds = {
    missingPhoto: new Set(health.missingPhoto),
    embeddingFailed: new Set(health.embeddingFailed),
    duplicates: duplicateIds,
  } as const;
  const detectedCount = health.detectedLast7d.length;

  const matchingPersons = allProjectPersons
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
    }
  };
  // The table sorts from its headings. The grid has one order it can offer, because it has a
  // control that says so — see gridPriorityFirst.
  const projectPersons = view === "table"
    ? sortRows(matchingPersons, sort, sortValue)
    : gridPriorityFirst
      ? sortRows(matchingPersons, { key: "priority", direction: "desc" }, sortValue)
      : matchingPersons;

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
      let count = 0;
      dataRows.forEach(row => {
        const [name, description] = row.split(",").map(v => v?.trim());
        if (!name) return;
        addPerson({
          // No photoUrl. A CSV of names contains no faces, and the import used to hand each row a
          // stock portrait from the mock pool — which made every bulk-imported person look
          // registered and matchable when in fact nothing had been enrolled. Those rows are what
          // the "no photo" figure above the list counts, and the count is only true if the rows
          // are.
          name, type: "VIP",
          registeredAt: new Date().toISOString(),
          description: description || undefined,
          projectId,
        });
        count++;
      });
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
          { id: "all", label: t.tabAll, count: allProjectPersons.length, hint: t.tabAllHint },
          { id: "individuals", label: t.tabIndividuals, count: allProjectPersons.filter(p => !p.groupId).length, hint: t.tabIndividualsHint },
          { id: "groups", label: t.tabGroups, count: personGroups.filter(g => g.projectId === projectId).length, hint: t.tabGroupsHint },
        ] as { id: "all" | "individuals" | "groups"; label: string; count: number; hint: string }[]).map(tab => {
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
          { key: "missingPhoto" as const, count: health.missingPhoto.length, label: t.healthMissingPhoto, icon: <ImageOff size={14} strokeWidth={2.4} /> },
          { key: "embeddingFailed" as const, count: health.embeddingFailed.length, label: t.healthEmbeddingFailed, icon: <AlertTriangle size={14} strokeWidth={2.4} /> },
          { key: "duplicates" as const, count: health.duplicates.length, label: t.healthDuplicates, icon: <Users size={14} strokeWidth={2.4} /> },
        ].filter(item => item.count > 0).map(item => ({
          key: item.key,
          icon: item.icon,
          figure: item.count,
          unit: t.healthPeopleUnit,
          label: item.label,
          tone: "warning" as const,
          active: healthFilter === item.key,
          title: healthFilter === item.key ? t.healthClear : t.healthShowOnly,
          onClick: () => setHealthFilter(healthFilter === item.key ? null : item.key),
        }))),
        {
          key: "reach",
          icon: <Eye size={14} strokeWidth={2.4} />,
          figure: detectedCount,
          unit: t.healthOfTotal(allProjectPersons.length),
          label: t.healthReachLabel,
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
            className={gridPriorityFirst ? undefined : "portal-btn-outline"}
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
            <button className="portal-btn-primary" onClick={() => setGroupModalFor({ group: null })}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addGroup}
            </button>
          ) : (<>
          <button className="portal-btn-outline" onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9.33V1.75M7 1.75 4.08 4.67M7 1.75 9.92 4.67M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.22" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.bulkUpload}
          </button>
          <button className="portal-btn-primary" onClick={() => setShowRegister(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
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
                    { label: t.editGroup, onClick: () => setGroupModalFor({ group }) },
                    { label: t.removeGroup, onClick: () => setConfirmingGroupRemove(group), danger: true },
                  ]} />
                </div>
              );
            })}
          </div>
        )
      ) : projectPersons.length === 0 ? (
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {q ? t.noSearchResults : vipTab === "individuals" ? t.noIndividuals : t.noVips}
          </p>
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
              { label: t.colPriority, key: "priority", indent: true },
              { label: t.colRegistered, key: "registered" },
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
                  /* Fills the column rather than its label, so the boxes line up down the table
                     instead of each row drawing a different width. */
                  <FilterSelect
                    value={person.groupId ?? ""}
                    onChange={v => setPersonGroup(person.id, v || undefined)}
                    options={[
                      { value: "", label: t.groupNone },
                      ...personGroups.filter(g => g.projectId === projectId).map(g => ({ value: g.id, label: g.name })),
                    ]}
                  />
                )}
                <span>{person.priorityLabel ? <PriorityTag priority={person.priorityLabel} text={t.priorityText[person.priorityLabel]} /> : <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{person.registeredAt.slice(0, 10)}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.description || "—"}</span>
                {/* The same overflow menu the roster, users and camera tables use. A lone trash
                    icon was the only row action this table had, which is also why there was no way
                    to edit a VIP from the table at all. */}
                <div style={{ justifySelf: "end" }}>
                  <RowActionsMenu actions={[
                    { label: t.editPerson, onClick: () => setEditingPerson(person) },
                    { label: t.removeAction, onClick: () => setConfirmingRemove(person), danger: true },
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
                    <PriorityTag priority={person.priorityLabel ?? "normal"} text={t.priorityText[person.priorityLabel ?? "normal"]} />
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

      {showRegister && <RegisterVipModal t={t} groups={projectGroupsAll} projectId={projectId} onClose={() => setShowRegister(false)} onSubmit={register} />}
      {editingPerson && (
        <RegisterVipModal t={t} person={editingPerson} groups={projectGroupsAll} projectId={projectId} onClose={() => setEditingPerson(null)} onSubmit={saveEdit} />
      )}
      {confirmingRemove && (
        <RemoveVipConfirmModal t={t} person={confirmingRemove} onClose={() => setConfirmingRemove(null)} onConfirm={confirmRemove} />
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
