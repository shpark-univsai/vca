"use client";

import { useEffect, useRef, useState } from "react";
import { useVcaStore, type Person, type PersonGroup } from "@/lib/vcaStore";
import { getFacePhoto } from "@/lib/mockData";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { TextField, FIELD_STYLE, FIELD_FOCUS, BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, ConfirmModal, FilterSelect, RowActionsMenu, SelectedCheckIcon, SortableHeader, Tooltip, sortRows, useTableSort } from "./PortalShared";

type VipSortKey = "name" | "role" | "priority" | "registered";

// 36px for the actions column, the width RowActionsMenu gets in every other table.
const VIP_GRID = "40px 1.2fr 0.7fr 0.7fr 0.8fr 1.4fr 36px";
/** The All tab adds a Group column; the Individuals tab would print "Individual" on every row. */
const VIP_GRID_WITH_GROUP = "40px 1.1fr 0.9fr 0.65fr 0.7fr 0.75fr 1.1fr 36px";
const GROUP_GRID = "1.5fr 0.6fr 0.8fr 1.6fr 36px";

const ROLE_LABELS = ["Regular", "Lead", "Captain", "Health", "Special"];
const PRIORITY_LABELS: NonNullable<Person["priorityLabel"]>[] = ["normal", "high", "very_high"];
const PRIORITY_COLOR: Record<NonNullable<Person["priorityLabel"]>, { bg: string; color: string }> = {
  normal: { bg: "var(--gray-100)", color: "var(--gray-600)" },
  high: { bg: "var(--warning-200)", color: "var(--warning-500)" },
  very_high: { bg: "var(--danger-100)", color: "var(--danger-500)" },
};

// Role/priority values stored on Person are canonical English identifiers (see ROLE_LABELS /
// PRIORITY_LABELS above and the seed data in vcaStore.ts) — kept stable across languages so
// existing records don't shift meaning when the display language changes. T.roleText /
// T.priorityText below only translate how each identifier is *displayed*.
interface VipDict {
  pageTitle: string;
  pageDesc: string;
  bulkUpload: string;
  registerVip: string;
  searchPlaceholder: string;
  noSearchResults: string;
  noVips: string;
  registered: (date: string) => string;
  viewGrid: string;
  viewTable: string;
  colVip: string;
  colRole: string;
  colPriority: string;
  colRegistered: string;
  colNote: string;
  removeVip: string;
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
  vipUpdatedTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  tagLabel: string;
  priorityLabel: string;
  facePhotoLabel: string;
  changePhoto: string;
  uploadPhoto: string;
  cancel: string;
  register: string;
  roleText: Record<string, string>;
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
  groupChangedTitle: string;
  savedLabel: string;
}

const T: Record<"en" | "ko", VipDict> = {
  en: {
    pageTitle: "VIP Registry",
    pageDesc: "Register watchlist individuals for this project's cameras to detect.",
    bulkUpload: "Bulk Upload",
    registerVip: "Register VIP",
    searchPlaceholder: "Search by VIP name",
    noSearchResults: "No VIPs match this search.",
    noVips: "No VIPs registered for this project yet.",
    registered: (date: string) => `Registered ${date}`,
    viewGrid: "Grid",
    viewTable: "Table",
    colVip: "VIP",
    colRole: "Role",
    colPriority: "Priority",
    colRegistered: "Registered",
    colNote: "Note",
    removeVip: "Remove VIP",
    confirmRemoveTitle: "Remove this VIP?",
    confirmRemoveBody: "They will be removed from this project's watchlist. Cameras will no longer detect them as a registered VIP.",
    removeAction: "Remove",
    vipRemovedTitle: "VIP removed",
    modalTitle: "Add New Person",
    editModalTitle: (name: string) => `Edit — ${name}`,
    saveEdit: "Save",
    noteLabel: "Note",
    notePlaceholder: "e.g. Corporate Security — Executive Protection",
    editPerson: "Edit",
    vipUpdatedTitle: "VIP updated",
    nameLabel: "Name *",
    namePlaceholder: "e.g. Alexander Wright",
    tagLabel: "Tag",
    priorityLabel: "Priority",
    facePhotoLabel: "Face photo",
    changePhoto: "Change",
    uploadPhoto: "Upload photo",
    cancel: "Cancel",
    register: "Register",
    roleText: { Regular: "Regular", Lead: "Lead", Captain: "Captain", Health: "Health", Special: "Special" } as Record<string, string>,
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
    groupNamePlaceholder: "e.g. City Hall delegation",
    groupDescLabel: "Note",
    groupDescPlaceholder: "e.g. Quarterly inspection visit",
    groupSave: "Save",
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
    groupChangedTitle: "Group changed",
    savedLabel: "Saved",
    bulkEmptyDesc: "Expected CSV rows as \"name,description\".",
  },
  ko: {
    pageTitle: "VIP 등록",
    pageDesc: "이 프로젝트의 카메라가 탐지할 관심인물을 등록하세요.",
    bulkUpload: "일괄 업로드",
    registerVip: "VIP 등록하기",
    searchPlaceholder: "VIP 이름으로 검색",
    noSearchResults: "검색 결과와 일치하는 VIP가 없습니다.",
    noVips: "이 프로젝트에 등록된 VIP가 아직 없습니다.",
    registered: (date: string) => `등록일 ${date}`,
    viewGrid: "그리드",
    viewTable: "테이블",
    colVip: "VIP",
    colRole: "역할",
    colPriority: "우선순위",
    colRegistered: "등록일",
    colNote: "메모",
    removeVip: "VIP 삭제",
    confirmRemoveTitle: "정말 삭제하시겠습니까?",
    confirmRemoveBody: "이 프로젝트의 관심인물 목록에서 삭제됩니다. 이후 카메라는 이 인물을 등록된 VIP로 탐지하지 않습니다.",
    removeAction: "삭제",
    vipRemovedTitle: "VIP 삭제됨",
    modalTitle: "새 인물 추가",
    editModalTitle: (name: string) => `${name} 편집`,
    saveEdit: "저장",
    noteLabel: "메모",
    notePlaceholder: "예: 기업 보안 — 임원 경호",
    editPerson: "편집",
    vipUpdatedTitle: "VIP 정보를 수정했습니다",
    nameLabel: "이름 *",
    namePlaceholder: "예: 홍길동",
    tagLabel: "태그",
    priorityLabel: "우선순위",
    facePhotoLabel: "얼굴 사진",
    changePhoto: "변경",
    uploadPhoto: "사진 업로드",
    cancel: "취소",
    register: "등록",
    roleText: { Regular: "일반", Lead: "팀장", Captain: "주장", Health: "보건", Special: "특별" } as Record<string, string>,
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
    groupNamePlaceholder: "예: 시청 방문단",
    groupDescLabel: "메모",
    groupDescPlaceholder: "예: 분기 정기 시찰",
    groupSave: "저장",
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
    groupChangedTitle: "그룹을 변경했습니다",
    savedLabel: "저장됨",
    bulkEmptyDesc: "CSV 행은 \"이름,설명\" 형식이어야 합니다.",
  },
};

interface RegisterValues {
  name: string;
  roleLabel: string;
  priorityLabel: NonNullable<Person["priorityLabel"]>;
  description?: string;
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
function RegisterVipModal({ t, person, onClose, onSubmit }: {
  t: VipDict;
  /** Absent = registering. Present = editing that person. */
  person?: Person;
  onClose: () => void;
  onSubmit: (values: RegisterValues) => void;
}) {
  useEscapeKey(onClose);
  const editing = person !== undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [roleLabel, setRoleLabel] = useState(person?.roleLabel ?? ROLE_LABELS[0]);
  const [priorityLabel, setPriorityLabel] = useState<NonNullable<Person["priorityLabel"]>>(person?.priorityLabel ?? "normal");
  const [description, setDescription] = useState(person?.description ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const valid = name.trim().length > 0;

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
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {editing ? t.editModalTitle(person.name) : t.modalTitle}
          </p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
            <TextField value={name} onChange={setName} placeholder={t.namePlaceholder} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.tagLabel}</label>
              <FilterSelect value={roleLabel} onChange={setRoleLabel} options={ROLE_LABELS.map(r => ({ value: r, label: t.roleText[r] ?? r }))} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.priorityLabel}</label>
              <FilterSelect
                value={priorityLabel}
                onChange={v => setPriorityLabel(v as typeof priorityLabel)}
                options={PRIORITY_LABELS.map(p => ({ value: p, label: t.priorityText[p] }))}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.noteLabel}</label>
            <TextField value={description} onChange={setDescription} placeholder={t.notePlaceholder} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.facePhotoLabel}</label>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            <button type="button" onClick={() => photoInputRef.current?.click()}
              style={{
                width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: photoPreview ? "10px" : "24px", borderRadius: "10px", border: "1px dashed var(--gray-300)",
                backgroundColor: "var(--gray-50)", cursor: "pointer",
              }}>
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photoFileName}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", flexShrink: 0 }}>{t.changePhoto}</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>{t.uploadPhoto}</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button
            onClick={() => valid && onSubmit({
              name: name.trim(), roleLabel, priorityLabel,
              description: description.trim() || undefined,
              photoUrl: photoPreview ?? undefined,
            })}
            disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            {/* The plus belongs to adding. Saving an edit adds nothing. */}
            {!editing && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>}
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
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{ padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
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
function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: "18px",
      fontSize: "10px", fontWeight: 600, padding: "0 8px", borderRadius: "999px",
      backgroundColor: bg, color, textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function RoleTag({ label }: { label: string }) {
  return <Tag label={label} bg="var(--gray-100)" color="var(--gray-600)" />;
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
        projectId, registeredAt: new Date().toISOString(),
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
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={save} disabled={!name.trim()}
            style={{
              padding: "10px 16px", borderRadius: "999px", border: "none",
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

/** One footprint for Save and Saved, so the row does not move when the state changes. */
const SAVE_PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: "78px", height: "30px", padding: "0 12px", borderRadius: "999px",
  fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
};

function PersonDetailModal({ t, person, groups, onClose, onEdit, onRemove }: {
  t: VipDict;
  person: Person;
  groups: PersonGroup[];
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  useEscapeKey(onClose);
  const setPersonGroup = useVcaStore(s => s.setPersonGroup);
  const { showToast } = useToast();
  /**
   * The picked group, held until it is saved.
   *
   * The table's own group select writes straight through, which is right there — it is the row's
   * control, and every other select in a Portal table behaves that way. Here it is not: this field
   * sits in a column of read-only values (role, registered, note), so a change that took effect the
   * instant the list closed would be the one thing on the sheet that quietly did something. The
   * Save button appears only once the pick differs from what is stored, so it is also the sheet
   * saying there is something unsaved.
   */
  const [draftGroupId, setDraftGroupId] = useState(person.groupId ?? "");
  const dirty = draftGroupId !== (person.groupId ?? "");
  /**
   * Saved a moment ago. The button used to just vanish once the pick matched what was stored, which
   * is what "it saved" looks like from the code's side and looks like nothing from the reader's —
   * the control they clicked disappeared and the value beside it had not moved. A tick in the same
   * spot answers the question the click asked, then gets out of the way.
   */
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  /**
   * The gap between rows was already even (8px), but the Group row holds a 30px control and the
   * others hold a line of text, so the rhythm read as uneven — the spacing around Group looked
   * larger because the row itself was. A shared minimum height makes every row the same height
   * whether it carries a control or a sentence, and centring means the label sits level with
   * either.
   */
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "12px", alignItems: "center", minHeight: "30px" }}>
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
            {row(t.colGroup, (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* Fixed box, not fitContent. Sized to its own label, the control changed width
                    every time the group did — "Individual" and "City Hall delegation" are not the
                    same number of characters — so the row twitched and the Save button beside it
                    moved with it. A field keeps its shape while its value changes. */}
                <span style={{ width: "170px", flexShrink: 0 }}>
                  <FilterSelect
                    value={draftGroupId}
                    onChange={setDraftGroupId}
                    options={[{ value: "", label: t.groupNone }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
                  />
                </span>
                {/* The pill keeps its footprint through both states — Save, then Saved with a
                    tick — so confirming a change does not shove the row sideways, which is the
                    same reason the select beside it stopped sizing to its label. The saved state
                    is a tinted pill rather than a second filled colour: it reports, it does not
                    ask. */}
                {(dirty || justSaved) && (
                  dirty ? (
                    <button
                      onClick={() => {
                        setPersonGroup(person.id, draftGroupId || undefined);
                        showToast({
                          variant: "success", title: t.groupChangedTitle,
                          desc: `${person.name} — ${groups.find(g => g.id === draftGroupId)?.name ?? t.groupNone}`,
                        });
                        setJustSaved(true);
                        if (savedTimer.current) clearTimeout(savedTimer.current);
                        savedTimer.current = setTimeout(() => setJustSaved(false), 2200);
                      }}
                      style={{ ...SAVE_PILL, border: "none", backgroundColor: "var(--primary-400)", color: "white", cursor: "pointer" }}>
                      {t.groupSave}
                    </button>
                  ) : (
                    <span style={{ ...SAVE_PILL, backgroundColor: "var(--success-100)", color: "var(--success-400)", gap: "4px" }}>
                      <SelectedCheckIcon size={13} />
                      {t.savedLabel}
                    </span>
                  )
                )}
              </span>
            ))}
            {/* Group first, then what qualifies the person, then the note, then when they were
                enrolled — last because it is the one value nobody comes here to read and the only
                one that never changes. The time is shown as well: this is the detail view, and on
                a watchlist "when was this face put in" is a question an inspection asks by the
                minute, not by the day. Rows enrolled before Portal recorded a time show only the
                date rather than a made-up one. */}
            {row(t.colRole, person.roleLabel
              ? (t.roleText[person.roleLabel] ?? person.roleLabel)
              : <span style={{ color: "var(--gray-300)" }}>—</span>)}
            {row(t.colNote, person.description || <span style={{ color: "var(--gray-400)" }}>{t.detailNoNote}</span>)}
            {row(t.colRegistered, registeredLong(person.registeredAt))}
          </div>
        </div>
        {/* Outlined, not filled. A dark Close next to a red Remove was two saturated blocks
            arguing on a sheet whose job is to show a photograph, and neither of them was the
            action anybody came for. The only filled button here is Save, and only while there is
            something to save. */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
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
  const [view, setView] = useState<"grid" | "table">("grid");
  /**
   * All / Individuals / Groups. Same underlined tab row Input Sources and Users & Permissions use.
   *
   * "All" is a real answer here in a way it was not on the Users page: a group's members are
   * people, so the combined tab is a list of people with a Group column — every row fills every
   * column. Individuals is the same list minus anyone in a group; Groups is the parties themselves.
   */
  const [vipTab, setVipTab] = useState<"all" | "individuals" | "groups">("all");
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
  // Derived, never stored — a stored member count is a number that goes wrong the first time
  // somebody removes a person. See PersonGroup in the store.
  const memberCountOf = (groupId: string) => allProjectPersons.filter(p => p.groupId === groupId).length;

  const matchingPersons = allProjectPersons
    .filter(p => vipTab !== "individuals" || !p.groupId)
    .filter(p => !q || p.name.toLowerCase().includes(q));
  // Sorting only applies to the table — the grid keeps registration order, because a wall of cards
  // has no column headings to say what it is sorted by.
  const projectPersons = view === "table"
    ? sortRows(matchingPersons, sort, (person, key) => {
        switch (key) {
          case "name": return person.name.toLowerCase();
          case "role": return person.roleLabel;
          // Ranked, not alphabetical: "very_high" has to sit above "high", and alphabetically it
          // would sit below it.
          case "priority": return person.priorityLabel ? PRIORITY_LABELS.indexOf(person.priorityLabel) : undefined;
          case "registered": return person.registeredAt;
        }
      })
    : matchingPersons;

  const register = (values: RegisterValues) => {
    addPerson({
      name: values.name, type: "VIP", photoUrl: values.photoUrl ?? getFacePhoto(values.name),
      registeredAt: new Date().toISOString(),
      roleLabel: values.roleLabel, priorityLabel: values.priorityLabel,
      description: values.description,
      projectId,
    });
    setShowRegister(false);
  };

  const saveEdit = (values: RegisterValues) => {
    if (!editingPerson) return;
    updatePerson(editingPerson.id, {
      name: values.name,
      roleLabel: values.roleLabel,
      priorityLabel: values.priorityLabel,
      description: values.description,
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
          name, type: "VIP", photoUrl: getFacePhoto(name),
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.pageTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>{t.pageDesc}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleBulkUpload} style={{ display: "none" }} />
          {/* Tools follow the tab: registering a face and creating a party are different jobs, and
              a bulk face upload has nothing to do with the list of parties. */}
          {vipTab === "groups" ? (
            <button onClick={() => setGroupModalFor({ group: null })}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
              {t.addGroup}
            </button>
          ) : (<>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9.33V1.75M7 1.75 4.08 4.67M7 1.75 9.92 4.67M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.bulkUpload}
          </button>
          <button onClick={() => setShowRegister(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {t.registerVip}
          </button>
          </>)}
        </div>
      </div>

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
              <button onClick={() => setVipTab(tab.id)}
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

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
      <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
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
        <div style={{ flex: 1 }} />
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
                fontSize: "12px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
              }}>
              {v === "grid" ? t.viewGrid : t.viewTable}
            </button>
          ))}
        </div>
        )}
      </div>

      {vipTab === "groups" ? (
        projectGroups.length === 0 ? (
          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>{q ? t.noSearchResults : t.noGroups}</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
            <div style={{ display: "grid", gridTemplateColumns: GROUP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
              {[t.colGroup, t.colMembers, t.colPriority, t.colNote, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
              ))}
            </div>
            {projectGroups.map((group, i) => {
              const isLast = i === projectGroups.length - 1;
              const members = memberCountOf(group.id);
              return (
                <div key={group.id} style={{
                  display: "grid", gridTemplateColumns: GROUP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "12px 16px", alignItems: "center",
                  borderBottom: isLast ? "none" : BORDER,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-400)" }}>{t.registered(group.registeredAt)}</p>
                  </div>
                  {/* Derived from Person.groupId, so it cannot disagree with the rows it counts. */}
                  <span style={{ fontSize: "13px", fontWeight: 700, color: members === 0 ? "var(--gray-300)" : "var(--gray-900)" }}>{members}</span>
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
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {q ? t.noSearchResults : vipTab === "individuals" ? t.noIndividuals : t.noVips}
          </p>
        </div>
      ) : view === "table" ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: showGroupColumn ? VIP_GRID_WITH_GROUP : VIP_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {/* The photo and the note carry no sortKey — a face has no order, and a free-text note
                sorted alphabetically answers nothing. */}
            <span />
            {([
              { label: t.colVip, key: "name" },
              ...(showGroupColumn ? [{ label: t.colGroup }] : []),
              { label: t.colRole, key: "role" },
              { label: t.colPriority, key: "priority" },
              { label: t.colRegistered, key: "registered" },
              { label: t.colNote },
              { label: "" },
            ] as { label: string; key?: VipSortKey }[]).map((h, i) => (
              <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
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
                <img src={person.photoUrl} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover" }} />
                {/* The name is the way in, as it is in most tables — a narrow target that does not
                    fight the group select two cells over for the same click. */}
                <button onClick={() => setDetailFor(person)} title={person.name}
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
                <span>{person.roleLabel ? <RoleTag label={t.roleText[person.roleLabel] ?? person.roleLabel} /> : <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}</span>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {projectPersons.map(person => {
            const elevated = person.priorityLabel === "high" || person.priorityLabel === "very_high";
            return (
            <div key={person.id}
              onClick={() => setDetailFor(person)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(person); } }}
              style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "14px", display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer" }}>
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
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{person.name}</p>
                {(elevated || person.groupId) && (
                  /* Group, and priority only when it is raised.
                     "Normal" is the register form's default, so a grey NORMAL pill sat on nearly
                     every card and said nothing — and once the role tag came off it was the only
                     tag on an ungrouped card, in the slot where other cards carry a group name,
                     which made it read as "this person is an individual". A tag on a card now
                     means something is true of this person: they are in a party, or they are
                     above normal. The table's Priority column still states it either way.
                     Wraps, so a long group name and the priority beside it stack rather than
                     squeeze each other. */
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "5px 0 0" }}>
                    {person.groupId && groupById.has(person.groupId) && (
                      <Tag label={groupById.get(person.groupId)!.name} bg="var(--info-100)" color="var(--info-500)" />
                    )}
                    {elevated && <PriorityTag priority={person.priorityLabel!} text={t.priorityText[person.priorityLabel!]} />}
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
              {/* stopPropagation, or removing somebody also opens their detail behind the dialog. */}
              <button onClick={e => { e.stopPropagation(); setConfirmingRemove(person); }} title={t.removeVip} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "4px", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            );
          })}
        </div>
      )}

      {showRegister && <RegisterVipModal t={t} onClose={() => setShowRegister(false)} onSubmit={register} />}
      {editingPerson && (
        <RegisterVipModal t={t} person={editingPerson} onClose={() => setEditingPerson(null)} onSubmit={saveEdit} />
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
