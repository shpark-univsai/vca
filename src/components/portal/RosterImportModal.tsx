"use client";

import { useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER } from "./PortalShared";
import {
  buildImportRows, decodeSpreadsheetBytes, looksLikeXlsx, parseDelimited,
  type ImportIssue, type ParsedRow,
} from "@/lib/rosterImport";

const T = {
  en: {
    title: "Import roster",
    subtitle: "One row per person. The file replaces nothing — every row is added to the roster.",
    dropHere: "Drop a CSV file here",
    orBrowse: "or choose a file",
    formatNote: "CSV or TSV. In Excel: File → Save As → CSV UTF-8.",
    columnsNote: "Columns: Name · Employee ID · Department · Email · Permission. Name and Employee ID are required; the rest may be left out.",
    downloadTemplate: "Download template",
    xlsxTitle: "That is an Excel workbook (.xlsx)",
    xlsxBody: "This importer reads CSV. In Excel, use File → Save As and pick \"CSV UTF-8\", then upload the saved file.",
    emptyFileTitle: "Nothing to read in that file",
    emptyFileBody: "It has no rows below the header.",
    missingColumnsTitle: "That file is missing a required column",
    missingColumnsBody: (cols: string) => `No column for ${cols}. The first row of the file has to name the columns — download the template to see the expected header.`,
    unmappedNote: (cols: string) => `Ignored column(s): ${cols}`,
    // Preview
    readyCount: (n: number) => `${n} to import`,
    errorCount: (n: number) => `${n} with errors`,
    errorsSkippedNote: "Rows with errors are skipped — everything else still imports.",
    allRowsBad: "No row in this file can be imported.",
    colLine: "Line",
    colName: "Name",
    colEmployeeId: "Employee ID",
    colDepartment: "Department",
    colEmail: "Email",
    colPermission: "Permission",
    colReason: "Reason",
    colVerdict: "",
    ok: "OK",
    admin: "Portal admin",
    operator: "App user",
    chooseAnother: "Choose another file",
    cancel: "Cancel",
    importN: (n: number) => `Import ${n}`,
    // Result
    doneTitle: "Import complete",
    doneAdded: (n: number) => `${n} added to the roster.`,
    doneSkipped: (n: number) => `${n} skipped.`,
    doneNoCodeNote: "Nobody imported has a registration code yet — issue codes when you are ready to hand them out.",
    skippedHeading: "Not imported",
    downloadErrors: "Download the skipped rows",
    close: "Close",
    issue: {
      "missing-name": "Name is empty",
      "missing-employee-id": "Employee ID is empty",
      "duplicate-in-file": "This employee ID appears earlier in the file",
      "duplicate-in-roster": "This employee ID is already on a roster",
      "bad-permission": "Permission must be Portal admin or App user",
      "bad-email": "That is not an email address",
      "rejected": "Rejected by the roster",
    } as Record<string, string>,
    toastTitle: "Roster imported",
    toastDesc: (added: number, skipped: number) => skipped > 0 ? `${added} added · ${skipped} skipped` : `${added} added`,
    toastNothing: "Nothing was imported",
  },
  ko: {
    title: "명부 가져오기",
    subtitle: "한 사람당 한 행입니다. 기존 명부를 덮어쓰지 않고 모두 추가합니다.",
    dropHere: "CSV 파일을 여기에 놓으세요",
    orBrowse: "또는 파일 선택",
    formatNote: "CSV 또는 TSV. 엑셀에서 파일 → 다른 이름으로 저장 → CSV UTF-8.",
    columnsNote: "열 구성: 이름 · 사번 · 부서 · 이메일 · 권한. 이름과 사번은 필수, 나머지는 없어도 됩니다.",
    downloadTemplate: "양식 내려받기",
    xlsxTitle: "엑셀 통합 문서(.xlsx)입니다",
    xlsxBody: "이 가져오기는 CSV를 읽습니다. 엑셀에서 파일 → 다른 이름으로 저장 → \"CSV UTF-8\"로 저장한 뒤 그 파일을 올려주세요.",
    emptyFileTitle: "읽을 내용이 없습니다",
    emptyFileBody: "머리글 아래에 행이 없습니다.",
    missingColumnsTitle: "필수 열이 없습니다",
    missingColumnsBody: (cols: string) => `${cols} 열을 찾지 못했습니다. 파일의 첫 행이 열 이름이어야 합니다 — 양식을 내려받아 머리글을 확인해 보세요.`,
    unmappedNote: (cols: string) => `무시한 열: ${cols}`,
    readyCount: (n: number) => `가져올 수 있는 행 ${n}개`,
    errorCount: (n: number) => `오류 ${n}개`,
    errorsSkippedNote: "오류 행은 건너뜁니다 — 나머지는 그대로 들어갑니다.",
    allRowsBad: "이 파일에서 가져올 수 있는 행이 없습니다.",
    colLine: "줄",
    colName: "이름",
    colEmployeeId: "사번",
    colDepartment: "부서",
    colEmail: "이메일",
    colPermission: "권한",
    colReason: "사유",
    colVerdict: "",
    ok: "정상",
    admin: "포털 관리자",
    operator: "앱 사용자",
    chooseAnother: "다른 파일 선택",
    cancel: "취소",
    importN: (n: number) => `${n}개 가져오기`,
    doneTitle: "가져오기 완료",
    doneAdded: (n: number) => `${n}명을 명부에 추가했습니다.`,
    doneSkipped: (n: number) => `${n}개 행을 건너뛰었습니다.`,
    doneNoCodeNote: "가져온 사람에게는 아직 등록 코드가 없습니다 — 나눠줄 때가 되면 코드를 발급하세요.",
    skippedHeading: "가져오지 않은 행",
    downloadErrors: "건너뛴 행 내려받기",
    close: "닫기",
    issue: {
      "missing-name": "이름이 비어 있습니다",
      "missing-employee-id": "사번이 비어 있습니다",
      "duplicate-in-file": "파일 앞쪽에 같은 사번이 있습니다",
      "duplicate-in-roster": "이미 명부에 있는 사번입니다",
      "bad-permission": "권한은 포털 관리자 또는 앱 사용자여야 합니다",
      "bad-email": "이메일 주소 형식이 아닙니다",
      "rejected": "명부가 거부했습니다",
    } as Record<string, string>,
    toastTitle: "명부를 가져왔습니다",
    toastDesc: (added: number, skipped: number) => skipped > 0 ? `${added}명 추가 · ${skipped}행 건너뜀` : `${added}명 추가`,
    toastNothing: "가져온 행이 없습니다",
  },
};

type Dict = typeof T.en;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(fileName: string, rows: string[][]) {
  // The BOM is what makes Excel open a UTF-8 CSV as UTF-8 instead of as the system codepage. Without
  // it every Korean name in the file we just handed back comes up as mojibake — which is exactly the
  // problem this importer's EUC-KR fallback exists to clean up, so it would be poor form to create
  // it here.
  const csv = "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** A row the store refused, or that never got that far. Carries the reason for the result list. */
interface SkippedRow { row: ParsedRow; reasons: string[] }

interface FileError { title: string; body: string }

export default function RosterImportModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const staffRoster = useVcaStore(s => s.staffRoster);
  const addRosterEntries = useVcaStore(s => s.addRosterEntries);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  useEscapeKey(onClose);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; unmapped: string[]; fileName: string } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: SkippedRow[] } | null>(null);

  const issueText = (issue: ImportIssue | "rejected") => t.issue[issue] ?? issue;

  const readFile = async (file: File) => {
    setFileError(null);
    setParsed(null);
    const buffer = await file.arrayBuffer();
    if (looksLikeXlsx(file.name, new Uint8Array(buffer.slice(0, 2)))) {
      setFileError({ title: t.xlsxTitle, body: t.xlsxBody });
      return;
    }
    const table = parseDelimited(decodeSpreadsheetBytes(buffer));
    // Every id in the store, not just this project's — addRosterEntry refuses duplicates across the
    // whole roster, so a project-scoped check would show green for rows it then rejects.
    const { rows, missingColumns, unmappedHeaders } = buildImportRows(table, staffRoster.map(r => r.employeeId));
    if (missingColumns.length > 0) {
      const names = missingColumns.map(c => (c === "name" ? t.colName : t.colEmployeeId)).join(", ");
      setFileError(table.length === 0
        ? { title: t.emptyFileTitle, body: t.emptyFileBody }
        : { title: t.missingColumnsTitle, body: t.missingColumnsBody(names) });
      return;
    }
    if (rows.length === 0) {
      setFileError({ title: t.emptyFileTitle, body: t.emptyFileBody });
      return;
    }
    setParsed({ rows, unmapped: unmappedHeaders, fileName: file.name });
  };

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void readFile(file);
  };

  const downloadTemplate = () => downloadCsv("staff-roster-template.csv", [
    [t.colName, t.colEmployeeId, t.colDepartment, t.colEmail, t.colPermission],
    [lang === "ko" ? "김민준" : "Minjun Kim", "EMP-3021", lang === "ko" ? "관제실" : "Control Room", "minjun.kim@example.com", t.operator],
  ]);

  const commit = () => {
    if (!parsed) return;
    const skipped: SkippedRow[] = [];
    const clean = parsed.rows.filter(row => {
      if (row.issues.length === 0) return true;
      skipped.push({ row, reasons: row.issues.map(issueText) });
      return false;
    });
    // One store call rather than one per row: each addRosterEntry trimmed the audit log, so a
    // file of two hundred names wiped every entry before it. addRosterEntries applies the same
    // duplicate rule — including against rows accepted moments earlier in the same call — and
    // hands back the ids it refused, so the result still adds up to the file's row count.
    const rejected = new Set(addRosterEntries(
      clean.map(row => ({
        name: row.name, employeeId: row.employeeId, department: row.department,
        email: row.email, projectId, permission: row.permission,
      })),
      parsed.fileName,
    ));
    clean.forEach(row => {
      if (rejected.has(row.employeeId)) skipped.push({ row, reasons: [issueText("rejected")] });
    });
    const added = clean.length - rejected.size;
    setResult({ added, skipped });
    showToast({
      variant: added > 0 ? "success" : "warning",
      title: added > 0 ? t.toastTitle : t.toastNothing,
      desc: t.toastDesc(added, skipped.length),
    });
  };

  const downloadSkipped = () => {
    if (!result) return;
    downloadCsv("staff-roster-skipped.csv", [
      [t.colLine, t.colName, t.colEmployeeId, t.colDepartment, t.colEmail, t.colPermission, t.colReason],
      ...result.skipped.map(s => [
        String(s.row.line), s.row.name, s.row.employeeId, s.row.department ?? "", s.row.email ?? "",
        s.row.permission === "admin" ? t.admin : t.operator, s.reasons.join("; "),
      ]),
    ]);
  };

  const okRows = parsed?.rows.filter(r => r.issues.length === 0) ?? [];
  const badRows = parsed?.rows.filter(r => r.issues.length > 0) ?? [];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{
        backgroundColor: "white", borderRadius: "16px", border: BORDER, width: "100%",
        // Wide when there is a table to read, narrow while it is still a drop zone — a 760px box
        // around one "choose a file" line reads as an empty screen.
        maxWidth: parsed || result ? "760px" : "440px",
        maxHeight: "86vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(14,22,42,0.18)",
      }}>
        <div style={{ padding: "20px", borderBottom: parsed || result ? BORDER : "none", flexShrink: 0 }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{result ? t.doneTitle : t.title}</p>
          {!result && <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.6 }}>{t.subtitle}</p>}
        </div>

        {/* ---------- Step 3: what happened ---------- */}
        {result ? (
          <>
            <div style={{ padding: "20px", overflowY: "auto", minHeight: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.doneAdded(result.added)}</p>
              {result.skipped.length > 0 && (
                <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "2px" }}>{t.doneSkipped(result.skipped.length)}</p>
              )}
              {result.added > 0 && (
                <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px", lineHeight: 1.6 }}>{t.doneNoCodeNote}</p>
              )}
              {result.skipped.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>{t.skippedHeading}</p>
                  <div style={{ border: BORDER, borderRadius: "12px", overflow: "hidden" }}>
                    {result.skipped.map((s, i) => (
                      <div key={`${s.row.line}-${i}`} style={{
                        display: "flex", gap: "10px", padding: "8px 12px", alignItems: "baseline",
                        borderBottom: i === result.skipped.length - 1 ? "none" : BORDER,
                      }}>
                        <span style={{ fontSize: "11px", color: "var(--gray-400)", minWidth: "28px", flexShrink: 0 }}>{s.row.line}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", minWidth: 0 }}>
                          {s.row.name || s.row.employeeId || "—"}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--danger-400)", marginLeft: "auto", textAlign: "right" }}>
                          {s.reasons.join(" · ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0 }}>
              {result.skipped.length > 0 && (
                <button className="portal-btn-outline" onClick={downloadSkipped}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  {t.downloadErrors}
                </button>
              )}
              <button className="portal-btn-primary" onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.close}
              </button>
            </div>
          </>
        ) : parsed ? (
          /* ---------- Step 2: read it back before committing ---------- */
          <>
            <div style={{ padding: "12px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flexShrink: 0 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-400)" }}>{t.readyCount(okRows.length)}</span>
              {badRows.length > 0 && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger-400)" }}>{t.errorCount(badRows.length)}</span>}
              <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                {okRows.length === 0 ? t.allRowsBad : badRows.length > 0 ? t.errorsSkippedNote : ""}
              </span>
              {parsed.unmapped.length > 0 && (
                <span style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%" }}>{t.unmappedNote(parsed.unmapped.join(", "))}</span>
              )}
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1.2fr 1fr 1fr 1.4fr 0.8fr", columnGap: "10px", padding: "8px 20px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, position: "sticky", top: 0 }}>
                {[t.colLine, t.colName, t.colEmployeeId, t.colDepartment, t.colEmail, t.colPermission].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
                ))}
              </div>
              {parsed.rows.map((r, i) => {
                const bad = r.issues.length > 0;
                return (
                  <div key={`${r.line}-${i}`} style={{ borderBottom: BORDER, backgroundColor: bad ? "var(--danger-100)" : "white" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1.2fr 1fr 1fr 1.4fr 0.8fr", columnGap: "10px", padding: "8px 20px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{r.line}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "—"}</span>
                      <span style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.employeeId || "—"}</span>
                      <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.department ?? "—"}</span>
                      <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email ?? "—"}</span>
                      <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{r.permission === "admin" ? t.admin : t.operator}</span>
                    </div>
                    {/* The reason sits under its own row rather than in a status column: it is a
                        sentence, and a sentence in a 0.8fr cell is three ellipsised words. */}
                    {bad && (
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", padding: "0 20px 8px 70px" }}>
                        {r.issues.map(issueText).join(" · ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: "8px", flexShrink: 0 }}>
              <button className="portal-btn-outline" onClick={() => { setParsed(null); setFileError(null); }}
                style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.chooseAnother}
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="portal-btn-outline" onClick={onClose}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  {t.cancel}
                </button>
                <button onClick={commit} disabled={okRows.length === 0}
                  style={{
                    padding: "10px 16px", borderRadius: "8px", border: "none",
                    backgroundColor: okRows.length === 0 ? "var(--gray-200)" : "var(--primary-400)",
                    color: okRows.length === 0 ? "var(--gray-400)" : "white",
                    fontSize: "13px", fontWeight: 700, cursor: okRows.length === 0 ? "not-allowed" : "pointer",
                  }}>
                  {t.importN(okRows.length)}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ---------- Step 1: give us the file ---------- */
          <>
            <div style={{ padding: "0 20px 20px" }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); onPick(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `1px dashed ${dragging ? "var(--primary-400)" : "var(--gray-200)"}`,
                  backgroundColor: dragging ? "var(--primary-100)" : "var(--gray-50)",
                  borderRadius: "12px", padding: "24px 20px", textAlign: "center", cursor: "pointer",
                }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.dropHere}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>{t.orBrowse}</p>
              </div>
              <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={e => { onPick(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

              {fileError && (
                <div style={{ marginTop: "12px", padding: "12px", borderRadius: "12px", backgroundColor: "var(--danger-100)" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger-500)" }}>{fileError.title}</p>
                  <p style={{ fontSize: "12px", color: "var(--danger-500)", marginTop: "4px", lineHeight: 1.6 }}>{fileError.body}</p>
                </div>
              )}

              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "14px", lineHeight: 1.6 }}>{t.columnsNote}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px", lineHeight: 1.6 }}>{t.formatNote}</p>
              <button onClick={downloadTemplate}
                style={{ marginTop: "10px", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
                {t.downloadTemplate}
              </button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button className="portal-btn-outline" onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
