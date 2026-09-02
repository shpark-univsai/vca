"use client";

import { useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { formatCode, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, TABLE_COLUMN_GAP, PANEL_SHADOW, FilterSelect, RowActionsMenu, TABLE_HEADER_COLOR } from "./PortalShared";

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

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8S4 3 8 3s6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
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
        <span style={{ display: "flex", color: "var(--gray-400)" }}><EyeIcon /></span>
      </button>
    );
  }
  return (
    <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
      {formatCode(entry.code ?? "")}
    </span>
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
  const [issuingEntry, setIssuingEntry] = useState<RosterEntry | null>(null);
  const [removingEntry, setRemovingEntry] = useState<RosterEntry | null>(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  const projectName = project?.name ?? projectId;
  const projectRoster = staffRoster.filter(r => r.projectId === projectId);
  const visibleRoster = projectRoster.filter(r => statusFilter === "ALL" || r.status === statusFilter);
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
            {[t.colName, t.colEmployeeId, t.colDepartment, t.colPermission, t.colStatus, t.colCode, ""].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: TABLE_HEADER_COLOR, letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
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
                  { label: entry.code ? t.reissueCodeAction : t.issueCodeAction, onClick: () => setIssuingEntry(entry) },
                  { label: t.removeFromRoster, onClick: () => setRemovingEntry(entry), danger: true },
                ]} />
              </div>
            );
          })}
        </div>
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
