"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useVcaStore } from "@/lib/vcaStore";
import { REGISTRATION_CODE_TTL_DAYS, formatCode, withEffectiveStatus, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, TABLE_COLUMN_GAP, PANEL_SHADOW, FilterSelect, RowActionsMenu, SortableHeader, sortRows, useTableSort } from "./PortalShared";

const T = {
  en: {
    statusNotIssued: "Not issued",
    statusIssued: "Issued",
    statusUsed: "Used",
    statusExpired: "Expired",
    reissueTitle: "Reissue registration code?",
    issueTitle: "Issue registration code?",
    reissueBody: (name: string) => `${name}'s current code will stop working immediately. Anyone still holding the old printout will need the new one instead.`,
    issueBody: (name: string) => `A new registration code will be generated for ${name}.`,
    codeExpiryNote: (days: number) => `It stops working after ${days} days, used or not — write the date on the printout.`,
    cancel: "Cancel",
    reissueConfirm: "Reissue code",
    issueConfirm: "Issue code",
    removeTitle: (name: string) => `Remove ${name} from the roster?`,
    removeBodyWithCode: "Their unused registration code is removed with them and can no longer be used to sign up.",
    removeBodyNoCode: "This only removes the roster row — it does not affect an account that already signed up.",
    remove: "Remove",
    handoutPreviewTitle: "Handout sheet preview",
    handoutSlipCount: (n: number) => `${n} slip(s) — cut along the dashed lines.`,
    close: "Close",
    print: "Print",
    handoutInstruction: "Go to the registration page and enter this code to set up your account.",
    filterAllStatuses: "All statuses",
    pageTitle: "Staff Roster",
    pageDesc: "Issue registration codes for offline sign-up — no mail required. See who hasn't joined yet.",
    importExcel: "Import from Excel",
    comingSoon: "Coming soon",
    addPerson: "Add person",
    editEntry: "Edit",
    modalAddTitle: "Add to roster",
    modalEditTitle: "Edit roster entry",
    fieldName: "Name",
    fieldNamePlaceholder: "Full name",
    fieldEmployeeId: "Employee number",
    fieldEmployeeIdPlaceholder: "e.g. EMP-3021",
    fieldEmployeeIdLocked: "Cannot be changed — remove and add again instead.",
    fieldDepartment: "Department",
    fieldDepartmentPlaceholder: "e.g. Control Room",
    fieldEmail: "Email",
    fieldEmailOptional: "Optional",
    fieldEmailPlaceholder: "Leave empty where there is no mail",
    fieldPermission: "Permission",
    duplicateId: "That employee number is already on a roster.",
    save: "Save",
    addNote: "Adding someone here does not give them a way in — issue their code afterwards.",
    toastAddedTitle: "Added to roster",
    toastUpdatedTitle: "Roster entry updated",
    exportCsv: "Export CSV",
    printHandout: "Print handout sheet",
    issueCodesTo: (n: number) => `Issue codes to ${n} unassigned`,
    emptyAll: "No staff in this project's roster yet.",
    emptyFiltered: "No staff match this filter.",
    colName: "Name",
    colEmployeeId: "Employee ID",
    colDepartment: "Department",
    colPermission: "Permission",
    colStatus: "Status",
    colCode: "Code",
    admin: "Admin",
    operator: "Operator",
    reissueCodeAction: "Reissue code",
    issueCodeAction: "Issue code",
    removeFromRoster: "Remove from roster",
    toastCodesIssuedTitle: "Codes issued",
    toastCodesIssuedDesc: (n: number) => `${n} registration code(s) issued.`,
    toastCodeReissuedTitle: "Code reissued",
    toastCodeReissuedDesc: (name: string) => `${name}'s previous code is no longer valid.`,
    toastCodeIssuedTitle: "Code issued",
    toastRemovedTitle: "Removed from roster",
    toastExportTitle: "Export complete",
    toastExportDesc: (n: number) => `${n} row(s) exported to CSV.`,
    csvHeaderName: "Name",
    csvHeaderEmployeeId: "Employee ID",
    csvHeaderDepartment: "Department",
    csvHeaderPermission: "Permission",
    csvHeaderStatus: "Status",
    csvHeaderCode: "Code",
  },
  ko: {
    statusNotIssued: "미발급",
    statusIssued: "발급됨",
    statusUsed: "사용됨",
    statusExpired: "만료됨",
    reissueTitle: "등록 코드를 재발급하시겠습니까?",
    issueTitle: "등록 코드를 발급하시겠습니까?",
    reissueBody: (name: string) => `${name}님의 현재 코드는 즉시 사용할 수 없게 됩니다. 이전 출력물을 가지고 있는 사람은 새 코드가 필요합니다.`,
    issueBody: (name: string) => `${name}님을 위한 새 등록 코드가 생성됩니다.`,
    codeExpiryNote: (days: number) => `사용 여부와 관계없이 ${days}일 후 만료됩니다 — 출력물에 날짜를 적어 두세요.`,
    cancel: "취소",
    reissueConfirm: "코드 재발급",
    issueConfirm: "코드 발급",
    removeTitle: (name: string) => `${name}님을 명부에서 삭제하시겠습니까?`,
    removeBodyWithCode: "미사용 등록 코드도 함께 삭제되며, 더 이상 가입에 사용할 수 없습니다.",
    removeBodyNoCode: "명부 항목만 삭제되며, 이미 가입된 계정에는 영향을 주지 않습니다.",
    remove: "삭제",
    handoutPreviewTitle: "배포용 시트 미리보기",
    handoutSlipCount: (n: number) => `${n}장 — 점선을 따라 잘라주세요.`,
    close: "닫기",
    print: "인쇄",
    handoutInstruction: "등록 페이지로 이동하여 이 코드를 입력하면 계정을 설정할 수 있습니다.",
    filterAllStatuses: "전체 상태",
    pageTitle: "직원 명부",
    pageDesc: "메일 없이 오프라인 가입을 위한 등록 코드를 발급합니다. 아직 가입하지 않은 직원을 확인하세요.",
    importExcel: "엑셀로 가져오기",
    addPerson: "사람 추가",
    editEntry: "편집",
    modalAddTitle: "명부에 추가",
    modalEditTitle: "명부 수정",
    fieldName: "이름",
    fieldNamePlaceholder: "전체 이름",
    fieldEmployeeId: "사번",
    fieldEmployeeIdPlaceholder: "예: EMP-3021",
    fieldEmployeeIdLocked: "사번은 바꿀 수 없습니다 — 지우고 다시 추가하세요.",
    fieldDepartment: "부서",
    fieldDepartmentPlaceholder: "예: 관제실",
    fieldEmail: "이메일",
    fieldEmailOptional: "선택",
    fieldEmailPlaceholder: "메일이 없는 곳은 비워 두세요",
    fieldPermission: "권한",
    duplicateId: "이미 명부에 있는 사번입니다.",
    save: "저장",
    addNote: "여기에 추가한다고 들어올 수 있게 되지는 않습니다 — 코드는 그다음에 발급합니다.",
    toastAddedTitle: "명부에 추가했습니다",
    toastUpdatedTitle: "명부를 수정했습니다",
    comingSoon: "준비 중",
    exportCsv: "CSV 내보내기",
    printHandout: "배포용 시트 인쇄",
    issueCodesTo: (n: number) => `미발급 ${n}명에게 코드 발급`,
    emptyAll: "이 프로젝트의 명부에 등록된 직원이 없습니다.",
    emptyFiltered: "이 필터와 일치하는 직원이 없습니다.",
    colName: "이름",
    colEmployeeId: "사번",
    colDepartment: "부서",
    colPermission: "권한",
    colStatus: "상태",
    colCode: "코드",
    admin: "관리자",
    operator: "운영자",
    reissueCodeAction: "코드 재발급",
    issueCodeAction: "코드 발급",
    removeFromRoster: "명부에서 삭제",
    toastCodesIssuedTitle: "코드 발급 완료",
    toastCodesIssuedDesc: (n: number) => `등록 코드 ${n}개가 발급되었습니다.`,
    toastCodeReissuedTitle: "코드 재발급 완료",
    toastCodeReissuedDesc: (name: string) => `${name}님의 이전 코드는 더 이상 사용할 수 없습니다.`,
    toastCodeIssuedTitle: "코드 발급 완료",
    toastRemovedTitle: "명부에서 삭제됨",
    toastExportTitle: "내보내기 완료",
    toastExportDesc: (n: number) => `${n}개 행이 CSV로 내보내졌습니다.`,
    csvHeaderName: "이름",
    csvHeaderEmployeeId: "사번",
    csvHeaderDepartment: "부서",
    csvHeaderPermission: "권한",
    csvHeaderStatus: "상태",
    csvHeaderCode: "코드",
  },
} as const;

// Both branches of T carry identical keys with only the literal string values differing between
// languages, so `T[lang]` widens to a union of the two — components take that union rather than
// pinning to the "en" branch specifically, or TS rejects passing a "ko"-selected value in.
type Translations = (typeof T)["en"] | (typeof T)["ko"];

// "Issued" is shown to admins for what the type calls "unused" — from an admin's point of view the
// interesting fact is "I handed this out, nobody's used it yet," not the code's own internal state.
function getStatusMeta(t: Translations): Record<RosterCodeStatus, { label: string; bg: string; color: string }> {
  return {
    "not-issued": { label: t.statusNotIssued, bg: "var(--gray-100)", color: "var(--gray-500)" },
    unused: { label: t.statusIssued, bg: "var(--warning-200)", color: "var(--warning-500)" },
    used: { label: t.statusUsed, bg: "var(--gray-100)", color: "var(--success-400)" },
    expired: { label: t.statusExpired, bg: "var(--danger-100)", color: "var(--danger-500)" },
  };
}

function StatusBadge({ status, meta }: { status: RosterCodeStatus; meta: Record<RosterCodeStatus, { label: string; bg: string; color: string }> }) {
  const m = meta[status];
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", backgroundColor: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Masked until clicked, and clicking is what's worth an audit trail — an admin who can see a still-
// live code is an admin who can hand it to the wrong person. Used/expired codes never get a reveal
// control at all: they're dead values, so there's nothing left to protect or show (see PROMPT's
// "사용된 코드는 영구히 숨긴다" — extended here to expired for the same reason, not just used).
function RosterCodeCell({ entry, onReveal }: { entry: RosterEntry; onReveal: () => void }) {
  const [revealed, setRevealed] = useState(false);

  if (entry.status === "not-issued") {
    return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>;
  }
  if (entry.status !== "unused") {
    return <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--gray-300)" }}>••••-••••</span>;
  }
  if (!revealed) {
    return (
      <button
        onClick={() => { setRevealed(true); onReveal(); }}
        style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: "monospace", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}
      >
        ••••-••••
        {/* Lucide, like the password fields' show/hide toggle — this is the same "reveal a hidden
            value" affordance, and it was a second hand-drawn eye that happened to be a slightly
            different shape from that one. Colour comes from the wrapper so the button can tint it. */}
        <span style={{ display: "flex", color: "var(--gray-400)" }}><Eye size={14} strokeWidth={1.5} /></span>
      </button>
    );
  }
  return (
    <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
      {formatCode(entry.code ?? "")}
    </span>
  );
}

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
function RosterEntryModal({ entry, projectId, onClose, t }: {
  entry: RosterEntry | null;
  projectId: string;
  onClose: () => void;
  t: Translations;
}) {
  useEscapeKey(onClose);
  const addRosterEntry = useVcaStore(s => s.addRosterEntry);
  const updateRosterEntry = useVcaStore(s => s.updateRosterEntry);
  const { showToast } = useToast();
  const editing = !!entry;

  const [name, setName] = useState(entry?.name ?? "");
  const [employeeId, setEmployeeId] = useState(entry?.employeeId ?? "");
  const [department, setDepartment] = useState(entry?.department ?? "");
  const [email, setEmail] = useState(entry?.email ?? "");
  const [permission, setPermission] = useState<"admin" | "operator">(entry?.permission ?? "operator");
  const [duplicate, setDuplicate] = useState(false);

  const canSubmit = name.trim().length > 0 && employeeId.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      updateRosterEntry(entry.employeeId, {
        name: name.trim(),
        department: department.trim() || undefined,
        email: email.trim() || undefined,
        permission,
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
      projectId,
      permission,
    });
    if (!ok) { setDuplicate(true); return; }
    showToast({ variant: "success", title: t.toastAddedTitle, desc: `${name.trim()} (${employeeId.trim()})` });
    onClose();
  };

  const label = (text: string, hint?: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>
      {text}
      {hint && <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)" }}>{hint}</span>}
    </label>
  );
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px",
    border: BORDER, fontSize: "13px", fontFamily: "inherit",
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{editing ? t.modalEditTitle : t.modalAddTitle}</p>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
          <div>
            {label(t.fieldName)}
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t.fieldNamePlaceholder} autoFocus style={inputStyle} />
          </div>
          <div>
            {label(t.fieldEmployeeId)}
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
            {label(t.fieldDepartment, t.fieldEmailOptional)}
            <input value={department} onChange={e => setDepartment(e.target.value)} placeholder={t.fieldDepartmentPlaceholder} style={inputStyle} />
          </div>
          <div>
            {label(t.fieldEmail, t.fieldEmailOptional)}
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.fieldEmailPlaceholder} style={inputStyle} />
          </div>
          <div>
            {label(t.fieldPermission)}
            {/* Two buttons rather than a select: the answer is one of two and both fit on screen. */}
            <div style={{ display: "flex", gap: "8px" }}>
              {(["operator", "admin"] as const).map(p => {
                const active = permission === p;
                return (
                  <button key={p} onClick={() => setPermission(p)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                      border: active ? "1px solid var(--gray-900)" : BORDER,
                      backgroundColor: active ? "var(--gray-100)" : "white",
                      color: active ? "var(--gray-900)" : "var(--gray-600)",
                      fontSize: "13px", fontWeight: 700,
                    }}>
                    {p === "admin" ? t.admin : t.operator}
                  </button>
                );
              })}
            </div>
          </div>
          {!editing && <p style={{ margin: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.6 }}>{t.addNote}</p>}
        </div>

        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={submit} disabled={!canSubmit}
            style={{
              padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.5,
            }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueConfirmModal({
  entry, onClose, onConfirm, t,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
  t: Translations;
}) {
  useEscapeKey(onClose);
  const hasCode = !!entry.code;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {hasCode ? t.reissueTitle : t.issueTitle}
          </p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.6 }}>
            {hasCode ? t.reissueBody(entry.name) : t.issueBody(entry.name)}
          </p>
          {/* Said before the code exists, not after: the administrator is about to print this and
              hand it over, and the deadline is only useful while they still have the paper. */}
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.6 }}>
            {t.codeExpiryNote(REGISTRATION_CODE_TTL_DAYS)}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {hasCode ? t.reissueConfirm : t.issueConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({
  entry, onClose, onConfirm, t,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
  t: Translations;
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.removeTitle(entry.name)}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.6 }}>
            {entry.code && entry.status === "unused" ? t.removeBodyWithCode : t.removeBodyNoCode}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.remove}
          </button>
        </div>
      </div>
    </div>
  );
}

// Print-only handout sheet — the actual deliverable of this screen. The `visibility` flip (rather
// than `display:none` on everything else) is the standard trick for "print just this one subtree
// regardless of what else the page layout is" — it works without this component needing to know
// anything about PortalShell's chrome outside it.
function PrintSheet({ entries, projectName, onClose, t }: { entries: RosterEntry[]; projectName: string; onClose: () => void; t: Translations }) {
  useEscapeKey(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "white", zIndex: 500, overflowY: "auto" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #roster-print-sheet, #roster-print-sheet * { visibility: visible; }
          #roster-print-sheet { position: absolute; top: 0; left: 0; width: 100%; }
          .roster-print-toolbar { display: none; }
          .roster-print-slip { break-inside: avoid; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>
      <div className="roster-print-toolbar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
        borderBottom: BORDER, position: "sticky", top: 0, backgroundColor: "white", zIndex: 1,
      }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.handoutPreviewTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{t.handoutSlipCount(entries.length)}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.close}
          </button>
          <button onClick={() => window.print()} style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.print}
          </button>
        </div>
      </div>
      <div id="roster-print-sheet" style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
        {entries.map(entry => (
          <div key={entry.employeeId} className="roster-print-slip" style={{ border: "1px dashed var(--gray-300)", borderRadius: "10px", padding: "18px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{projectName}</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "4px" }}>{entry.name}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace", color: "var(--gray-900)", marginTop: "10px", letterSpacing: "1px" }}>
              {formatCode(entry.code ?? "")}
            </p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px", lineHeight: 1.6 }}>
              {t.handoutInstruction}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusFilterOptions(t: Translations): { value: "ALL" | RosterCodeStatus; label: string }[] {
  return [
    { value: "ALL", label: t.filterAllStatuses },
    { value: "not-issued", label: t.statusNotIssued },
    { value: "unused", label: t.statusIssued },
    { value: "used", label: t.statusUsed },
    { value: "expired", label: t.statusExpired },
  ];
}

type RosterSortKey = "name" | "employeeId" | "department" | "permission" | "status";

export default function ProjectRosterTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const statusMeta = getStatusMeta(t);
  const statusFilterOptions = getStatusFilterOptions(t);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const staffRoster = useVcaStore(s => s.staffRoster);
  const issueRegistrationCodes = useVcaStore(s => s.issueRegistrationCodes);
  const reissueRegistrationCode = useVcaStore(s => s.reissueRegistrationCode);
  const removeRosterEntry = useVcaStore(s => s.removeRosterEntry);
  const logRosterCodeViewed = useVcaStore(s => s.logRosterCodeViewed);
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<"ALL" | RosterCodeStatus>("ALL");
  const { sort, toggle: toggleSort } = useTableSort<RosterSortKey>({ key: "status", direction: "asc" });
  const [issuingEntry, setIssuingEntry] = useState<RosterEntry | null>(null);
  const [removingEntry, setRemovingEntry] = useState<RosterEntry | null>(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  // null = 닫힘, { entry: null } = 추가, { entry } = 편집
  const [editorFor, setEditorFor] = useState<{ entry: RosterEntry | null } | null>(null);

  const projectName = project?.name ?? projectId;
  // Read through withEffectiveStatus so a code that outlived REGISTRATION_CODE_TTL_DAYS reads as
  // expired everywhere below at once — the badge, the status filter, the reveal control, the CSV
  // and the printable handout. Before this, expiry was a value somebody typed into the seed data.
  const projectRoster = withEffectiveStatus(staffRoster.filter(r => r.projectId === projectId));
  // Not-issued first by default: the roster exists so somebody can work out who still needs a code,
  // and "not-issued" sorts before "unused"/"used" alphabetically.
  const visibleRoster = sortRows(
    projectRoster.filter(r => statusFilter === "ALL" || r.status === statusFilter),
    sort,
    (r, key) => {
      switch (key) {
        case "name": return r.name.toLowerCase();
        case "employeeId": return r.employeeId.toLowerCase();
        case "department": return r.department?.toLowerCase();
        case "permission": return r.permission;
        case "status": return r.status;
      }
    },
  );
  const notIssuedCount = projectRoster.filter(r => r.status === "not-issued").length;
  const printableEntries = projectRoster.filter(r => r.status === "unused" && r.code);

  const bulkIssue = () => {
    const employeeIds = projectRoster.filter(r => r.status === "not-issued").map(r => r.employeeId);
    if (employeeIds.length === 0) return;
    issueRegistrationCodes(employeeIds);
    showToast({ variant: "success", title: t.toastCodesIssuedTitle, desc: t.toastCodesIssuedDesc(employeeIds.length) });
  };

  const confirmIssueOrReissue = () => {
    if (!issuingEntry) return;
    if (issuingEntry.code) {
      reissueRegistrationCode(issuingEntry.employeeId);
      showToast({ variant: "success", title: t.toastCodeReissuedTitle, desc: t.toastCodeReissuedDesc(issuingEntry.name) });
    } else {
      issueRegistrationCodes([issuingEntry.employeeId]);
      showToast({ variant: "success", title: t.toastCodeIssuedTitle, desc: issuingEntry.name });
    }
    setIssuingEntry(null);
  };

  const confirmRemove = () => {
    if (!removingEntry) return;
    removeRosterEntry(removingEntry.employeeId);
    showToast({ variant: "warning", title: t.toastRemovedTitle, desc: removingEntry.name });
    setRemovingEntry(null);
  };

  const exportCsv = () => {
    const header = [t.csvHeaderName, t.csvHeaderEmployeeId, t.csvHeaderDepartment, t.csvHeaderPermission, t.csvHeaderStatus, t.csvHeaderCode];
    const rows = projectRoster.map(r => [
      r.name, r.employeeId, r.department ?? "", r.permission === "admin" ? t.admin : t.operator,
      statusMeta[r.status].label,
      // Only a still-usable code is worth exporting — a used/expired one can't get anyone signed up.
      r.status === "unused" && r.code ? formatCode(r.code) : "",
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-staff-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: t.toastExportTitle, desc: t.toastExportDesc(projectRoster.length) });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.pageTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>
            {t.pageDesc}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
          {/* 한 명씩 넣는 길이 기본이고, 엑셀은 그걸 여러 번 반복하지 않으려고 있는 지름길이다.
              그래서 추가 버튼이 먼저 오고 가져오기가 그 옆에 선다. */}
          <button onClick={() => setEditorFor({ entry: null })}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {t.addPerson}
          </button>
          <button disabled title={t.comingSoon}
            style={{ padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: "not-allowed" }}>
            {t.importExcel}
          </button>
          <button onClick={exportCsv}
            style={{ padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            {t.exportCsv}
          </button>
          <button onClick={() => setShowPrintSheet(true)} disabled={printableEntries.length === 0}
            style={{
              padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white",
              color: printableEntries.length === 0 ? "var(--gray-300)" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 700, cursor: printableEntries.length === 0 ? "not-allowed" : "pointer",
            }}>
            {t.printHandout}
          </button>
          <button onClick={bulkIssue} disabled={notIssuedCount === 0}
            style={{
              padding: "10px 16px", borderRadius: "999px", border: "none",
              backgroundColor: notIssuedCount === 0 ? "var(--gray-200)" : "var(--primary-400)",
              color: notIssuedCount === 0 ? "var(--gray-400)" : "white",
              fontSize: "12px", fontWeight: 700, cursor: notIssuedCount === 0 ? "not-allowed" : "pointer",
            }}>
            {t.issueCodesTo(notIssuedCount)}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "16px", maxWidth: "220px" }}>
        <FilterSelect value={statusFilter} onChange={v => setStatusFilter(v as typeof statusFilter)} options={statusFilterOptions} />
      </div>

      {visibleRoster.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {statusFilter === "ALL" ? t.emptyAll : t.emptyFiltered}
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 0.8fr 1fr 1.1fr 36px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {/* The code column has no sortKey: ordering people by a random 8-character code answers
                no question anybody has. */}
            {([
              { label: t.colName, key: "name" },
              { label: t.colEmployeeId, key: "employeeId" },
              { label: t.colDepartment, key: "department" },
              { label: t.colPermission, key: "permission" },
              { label: t.colStatus, key: "status" },
              { label: t.colCode },
              { label: "" },
            ] as { label: string; key?: RosterSortKey }[]).map((h, i) => (
              <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
            ))}
          </div>
          {visibleRoster.map((entry, i) => {
            const isLast = i === visibleRoster.length - 1;
            return (
              <div key={entry.employeeId} style={{
                display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 0.8fr 1fr 1.1fr 36px", columnGap: TABLE_COLUMN_GAP, padding: "12px 16px", alignItems: "center",
                borderBottom: isLast ? "none" : BORDER,
                borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
              }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{entry.name}</p>
                <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{entry.employeeId}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{entry.department ?? "—"}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{entry.permission === "admin" ? t.admin : t.operator}</span>
                <div><StatusBadge status={entry.status} meta={statusMeta} /></div>
                <RosterCodeCell entry={entry} onReveal={() => logRosterCodeViewed(entry.employeeId)} />
                <RowActionsMenu actions={[
                  { label: t.editEntry, onClick: () => setEditorFor({ entry }) },
                  { label: entry.code ? t.reissueCodeAction : t.issueCodeAction, onClick: () => setIssuingEntry(entry) },
                  { label: t.removeFromRoster, onClick: () => setRemovingEntry(entry), danger: true },
                ]} />
              </div>
            );
          })}
        </div>
      )}

      {editorFor && (
        <RosterEntryModal entry={editorFor.entry} projectId={projectId} onClose={() => setEditorFor(null)} t={t} />
      )}

      {issuingEntry && (
        <IssueConfirmModal entry={issuingEntry} onClose={() => setIssuingEntry(null)} onConfirm={confirmIssueOrReissue} t={t} />
      )}
      {removingEntry && (
        <RemoveConfirmModal entry={removingEntry} onClose={() => setRemovingEntry(null)} onConfirm={confirmRemove} t={t} />
      )}
      {showPrintSheet && (
        <PrintSheet entries={printableEntries} projectName={projectName} onClose={() => setShowPrintSheet(false)} t={t} />
      )}
    </div>
  );
}
