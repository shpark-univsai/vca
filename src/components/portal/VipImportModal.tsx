"use client";

import { useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER } from "./PortalShared";
import {
  buildVipImportRows, decodeSpreadsheetBytes, importableRows, isBlocking, looksLikeXlsx, parseDelimited,
  type ParsedVipRow, type VipImportIssue,
} from "@/lib/vipImport";

/**
 * A spreadsheet of names, previewed before it is registered.
 *
 * The bulk upload was one click and a toast: the file input wrote straight through addPersons, and
 * the first thing anybody saw was "VIP 214명이 등록되었습니다 · 6행 건너뜀" — six rows gone, with no
 * way to learn which six without diffing the list against the spreadsheet by hand. The camera
 * import solved this shape already, so this is the same three steps for the same reason: give us
 * the file, read back what it says, see what happened. Same names, same order, same standard of
 * refusal, so somebody who has imported cameras has already learnt this screen.
 *
 * What it does NOT borrow is the camera importer's mode question and its channel allowance. There
 * is one thing a file of names can mean — add these people — and no licence counts listings.
 */

const T = {
  en: {
    title: "Import VIPs",
    subtitle: "One person per row. Nothing is replaced — every row is added to this project.",
    dropHere: "Drop a CSV file here",
    orBrowse: "or choose a file",
    formatNote: "CSV. In Excel: File → Save As → CSV UTF-8.",
    columnsNote: "A name is all that is required. A memo column is read if the file has one, and a file of bare names with no header row works too.",
    noPhotoNote: "A CSV carries no faces. Imported rows are registered without a photo, and no camera can match them until one is enrolled.",
    downloadTemplate: "Download template",
    xlsxTitle: "That is an Excel file",
    xlsxBody: "Save it as CSV UTF-8 first — in Excel, File → Save As → CSV UTF-8 — and drop that.",
    emptyFileTitle: "Nothing to import",
    emptyFileBody: "The file has no rows under its header.",
    missingColumnsTitle: "Wrong file, or missing columns",
    missingColumnsBody: "This file names its columns and none of them is a name. Head the column of names 이름 or Name, or remove the header row and the first column will be read as the name.",
    colLine: "Line", colName: "Name", colMemo: "Memo", colReason: "Reason",
    readyCount: (n: number) => `${n} ready`,
    errorCount: (n: number) => `${n} with errors`,
    warnCount: (n: number) => `${n} already on the list`,
    allRowsBad: "No row in this file can be imported.",
    errorsSkippedNote: "Rows with errors are skipped; the rest still import.",
    unmappedNote: (cols: string) => `Ignored columns: ${cols}`,
    noHeaderNote: "No header row was recognised, so the first line is being read as a person and the first column as the name.",
    importN: (n: number) => (n === 1 ? "Import 1 person" : `Import ${n} people`),
    cancel: "Cancel", close: "Close",
    doneTitle: "Import finished",
    doneAdded: (n: number) => (n === 1 ? "1 person registered" : `${n} people registered`),
    doneSkipped: (n: number) => `${n} row${n === 1 ? "" : "s"} skipped`,
    doneNoPhotoNote: (n: number) => `${n === 1 ? "This row is" : `All ${n} are`} in the registry's "no photo" count until a face is enrolled.`,
    skippedHeading: "Skipped rows",
    downloadErrors: "Download skipped rows",
    toastTitle: "VIPs imported",
    toastNothing: "No rows imported",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added} added · ${skipped} skipped` : `${added} added`),
    issue: {
      "missing-name": "No name",
      "duplicate-in-file": "Same name twice in this file — only the first row is imported",
      "duplicate-in-registry": "Already on this project's list — imported anyway",
    } as Record<string, string>,
  },
  ko: {
    title: "VIP 가져오기",
    subtitle: "한 사람이 한 행입니다. 무엇도 대체하지 않고, 모든 행이 이 프로젝트에 추가됩니다.",
    dropHere: "CSV 파일을 여기에 놓으세요",
    orBrowse: "또는 파일 선택",
    formatNote: "CSV 파일. 엑셀에서: 파일 → 다른 이름으로 저장 → CSV UTF-8.",
    columnsNote: "이름만 있으면 됩니다. 메모 열은 파일에 있으면 함께 읽고, 머리글 없이 이름만 적힌 파일도 됩니다.",
    noPhotoNote: "CSV에는 얼굴이 없습니다. 가져온 행은 사진 없이 등록되고, 사진을 등록하기 전에는 어느 카메라도 이 사람을 찾지 못합니다.",
    downloadTemplate: "서식 내려받기",
    xlsxTitle: "엑셀 파일입니다",
    xlsxBody: "CSV UTF-8로 먼저 저장해 주세요 — 엑셀에서 파일 → 다른 이름으로 저장 → CSV UTF-8 — 그 파일을 놓으시면 됩니다.",
    emptyFileTitle: "가져올 것이 없습니다",
    emptyFileBody: "머리글 아래에 행이 없습니다.",
    missingColumnsTitle: "다른 파일이거나 열이 빠졌습니다",
    missingColumnsBody: "이 파일은 열 이름을 적어 두었는데 그중 이름 열이 없습니다. 이름이 든 열의 머리글을 이름 또는 Name으로 달거나, 머리글 줄을 지우면 첫 열을 이름으로 읽습니다.",
    colLine: "행", colName: "이름", colMemo: "메모", colReason: "사유",
    readyCount: (n: number) => `${n}명 준비됨`,
    errorCount: (n: number) => `${n}행 오류`,
    warnCount: (n: number) => `${n}명은 이미 명단에 있음`,
    allRowsBad: "이 파일에서 가져올 수 있는 행이 없습니다.",
    errorsSkippedNote: "오류가 있는 행은 건너뛰고 나머지는 그대로 들어갑니다.",
    unmappedNote: (cols: string) => `무시한 열: ${cols}`,
    noHeaderNote: "머리글로 읽을 줄이 없어서 첫 줄도 사람으로, 첫 열을 이름으로 읽었습니다.",
    importN: (n: number) => `${n}명 가져오기`,
    cancel: "취소", close: "닫기",
    doneTitle: "가져오기 완료",
    doneAdded: (n: number) => `VIP ${n}명 등록됨`,
    doneSkipped: (n: number) => `${n}행 건너뜀`,
    doneNoPhotoNote: (n: number) => `${n}명 모두 사진을 등록하기 전까지는 명단의 '사진 없음'에 들어 있습니다.`,
    skippedHeading: "건너뛴 행",
    downloadErrors: "건너뛴 행 내려받기",
    toastTitle: "VIP를 가져왔습니다",
    toastNothing: "가져온 행이 없습니다",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added}명 추가 · ${skipped}행 건너뜀` : `${added}명 추가`),
    issue: {
      "missing-name": "이름 없음",
      "duplicate-in-file": "이 파일 안에서 이름 중복 — 먼저 나온 행만 가져옵니다",
      "duplicate-in-registry": "이미 이 프로젝트 명단에 있는 이름 — 그래도 가져옵니다",
    } as Record<string, string>,
  },
};

type Dict = typeof T.en;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(fileName: string, rows: string[][]) {
  // BOM, for the same reason every other export in Portal carries one: without it Excel opens a
  // UTF-8 CSV in the system codepage and every Korean name comes back as mojibake.
  const csv = "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface SkippedRow { row: ParsedVipRow; reasons: string[] }
interface FileError { title: string; body: string }

export default function VipImportModal({
  projectId, onClose, onDownloadTemplate,
}: {
  projectId: string;
  onClose: () => void;
  /** The same template the toolbar's 서식 button writes, handed in rather than rebuilt here: two
   *  copies of one sample file is two files that drift apart, and the toolbar's copy has to stay
   *  where it is — it is the one door a read-only account can open, since the button that opens
   *  this modal is disabled for them. */
  onDownloadTemplate: () => void;
}) {
  const persons = useVcaStore(s => s.persons);
  const addPersons = useVcaStore(s => s.addPersons);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  useEscapeKey(onClose);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [parsed, setParsed] = useState<{ rows: ParsedVipRow[]; unmapped: string[]; headerDetected: boolean; fileName: string } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: SkippedRow[] } | null>(null);

  const issueText = (issue: VipImportIssue) => t.issue[issue] ?? issue;

  const readFile = async (file: File) => {
    setFileError(null);
    setParsed(null);
    const buffer = await file.arrayBuffer();
    if (looksLikeXlsx(file.name, new Uint8Array(buffer.slice(0, 2)))) {
      setFileError({ title: t.xlsxTitle, body: t.xlsxBody });
      return;
    }
    const table = parseDelimited(decodeSpreadsheetBytes(buffer));
    // Names are checked against this project's listings only, and released listings are left out:
    // the note this raises says "already on this project's list", and somebody released from it is
    // not on it. Scoped the way watchedPersonsInProject scopes, so the preview agrees with the
    // list the reader is looking at.
    const existingNames = persons.filter(p => p.projectId === projectId && !p.releasedAt).map(p => p.name);
    const { rows, missingColumns, unmappedHeaders, headerDetected } = buildVipImportRows(table, existingNames);
    if (missingColumns.length > 0) {
      setFileError(table.length === 0
        ? { title: t.emptyFileTitle, body: t.emptyFileBody }
        : { title: t.missingColumnsTitle, body: t.missingColumnsBody });
      return;
    }
    if (rows.length === 0) {
      setFileError({ title: t.emptyFileTitle, body: t.emptyFileBody });
      return;
    }
    setParsed({ rows, unmapped: unmappedHeaders, headerDetected, fileName: file.name });
  };

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void readFile(file);
  };

  const okRows = parsed ? importableRows(parsed.rows) : [];
  const badRows = parsed?.rows.filter(r => r.issues.some(isBlocking)) ?? [];
  // Rows that import and still have something to say — here that is only the already-listed name.
  // Counted separately from the errors because the two ask for different things: an error is a
  // file to fix, a warning is a decision to make (see WARNINGS in vipImport.ts).
  const warnRows = okRows.filter(r => r.issues.length > 0);

  const commit = () => {
    if (!parsed) return;
    const skipped: SkippedRow[] = parsed.rows
      .map(row => ({ row, reasons: row.issues.filter(isBlocking).map(issueText) }))
      .filter(s => s.reasons.length > 0);

    const at = new Date().toISOString();
    // One store call, so the import is one line in the Activity log instead of two hundred that
    // evict everything before them. See addPersons.
    const added = addPersons(okRows.map(row => ({
      // No photoUrl. A CSV of names contains no faces, and this path used to hand each row a stock
      // portrait from the mock pool — which made every bulk-imported person look enrolled and
      // matchable when nothing had been enrolled at all. Those rows are what the registry's "no
      // photo" figure counts, and the count is only true if the rows are.
      name: row.name,
      type: "VIP" as const,
      registeredAt: at,
      description: row.description || undefined,
      projectId,
    })), parsed.fileName);

    // addPersons refuses nothing — it returns the length of what it was handed (vcaStore.ts) — so
    // unlike the camera import there is no second, store-side skip list to fold in here. If it ever
    // grows one, it belongs on this line.
    setResult({ added, skipped });
    showToast({
      variant: added > 0 ? "success" : "warning",
      title: added > 0 ? t.toastTitle : t.toastNothing,
      desc: t.toastDesc(added, skipped.length),
    });
  };

  const downloadSkipped = () => {
    if (!result) return;
    downloadCsv("vip-import-skipped.csv", [
      [t.colLine, t.colName, t.colMemo, t.colReason],
      ...result.skipped.map(s => [String(s.row.line), s.row.name, s.row.description, s.reasons.join("; ")]),
    ]);
  };

  const GRID = "40px 1.2fr 1.4fr 1.4fr";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{
        backgroundColor: "white", borderRadius: "16px", border: BORDER, width: "100%",
        maxWidth: parsed || result ? "760px" : "460px",
        maxHeight: "86vh", display: "flex", flexDirection: "column",
        boxShadow: "var(--shadow-modal)",
      }}>
        <div style={{ padding: "20px", borderBottom: parsed || result ? BORDER : "none", flexShrink: 0 }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{result ? t.doneTitle : t.title}</p>
          {!result && <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.5 }}>{t.subtitle}</p>}
        </div>

        {result ? (
          <>
            <div style={{ padding: "20px", overflowY: "auto", minHeight: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.doneAdded(result.added)}</p>
              {result.skipped.length > 0 && (
                <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "2px" }}>{t.doneSkipped(result.skipped.length)}</p>
              )}
              {/* Where those people now are, said once and in the registry's own words: the rows
                  went in without a face, so the 사진 없음 figure above the list just moved by this
                  many and nothing will match them until somebody uploads photos. */}
              {result.added > 0 && (
                <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "10px", lineHeight: 1.5 }}>{t.doneNoPhotoNote(result.added)}</p>
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
                          {s.row.name || s.row.description || "—"}
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
          <>
            <div style={{ padding: "12px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flexShrink: 0 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-400)" }}>{t.readyCount(okRows.length)}</span>
              {badRows.length > 0 && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger-400)" }}>{t.errorCount(badRows.length)}</span>}
              {warnRows.length > 0 && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--warning-500)" }}>{t.warnCount(warnRows.length)}</span>}
              <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                {okRows.length === 0 ? t.allRowsBad : badRows.length > 0 ? t.errorsSkippedNote : ""}
              </span>
              {parsed.unmapped.length > 0 && (
                <span style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%" }}>{t.unmappedNote(parsed.unmapped.join(", "))}</span>
              )}
              {/* Said only when it happened, and it is not visible in the table otherwise: a file
                  headed in words we do not know shows its heading as row one, and a reader who is
                  not told imports a person called 피보호자. */}
              {!parsed.headerDetected && (
                <span style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%", lineHeight: 1.5 }}>{t.noHeaderNote}</span>
              )}
              {/* The faces, before the button rather than after. Every row in this preview is
                  about to become a listing no camera can match. */}
              <span style={{ width: "100%", fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.noPhotoNote}</span>
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "10px", padding: "8px 20px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, position: "sticky", top: 0 }}>
                {[t.colLine, t.colName, t.colMemo, t.colReason].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
                ))}
              </div>
              {parsed.rows.map((r, i) => {
                const bad = r.issues.some(isBlocking);
                const warn = !bad && r.issues.length > 0;
                return (
                  <div key={`${r.line}-${i}`} style={{
                    display: "grid", gridTemplateColumns: GRID, columnGap: "10px",
                    padding: "8px 20px", borderBottom: BORDER,
                    backgroundColor: bad ? "var(--danger-100)" : "transparent",
                  }}>
                    <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{r.line}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description || "—"}</span>
                    {/* The reason column holds the reason, and stays empty when there is none —
                        unlike the camera preview, which reuses its last column for 위치 when the
                        row is clean. Here there is no third field to fall back to, and a memo
                        printed under a heading that says 사유 would read as the reason. */}
                    <span style={{ fontSize: "12px", color: bad ? "var(--danger-500)" : warn ? "var(--warning-500)" : "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.issues.map(issueText).join(" · ")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0 }}>
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
          </>
        ) : (
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
              {/* Still .csv only, as the toolbar's input was. The parser underneath reads TSV as
                  well — parseDelimited sniffs the delimiter — but the picker is not told so and
                  neither is the format note above: the template is a CSV, and the one instruction
                  that gets an Excel user out of trouble is which Save As option to pick. A dropped
                  .tsv is still read; it simply is not advertised. */}
              <input ref={inputRef} type="file" accept=".csv,text/csv"
                onChange={e => { onPick(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

              {fileError && (
                <div style={{ marginTop: "12px", padding: "12px", borderRadius: "12px", backgroundColor: "var(--danger-100)" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger-500)" }}>{fileError.title}</p>
                  <p style={{ fontSize: "12px", color: "var(--danger-500)", marginTop: "4px", lineHeight: 1.5 }}>{fileError.body}</p>
                </div>
              )}

              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "14px", lineHeight: 1.5 }}>{t.columnsNote}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px", lineHeight: 1.5 }}>{t.formatNote}</p>
              {/* The one consequence of this whole flow that the file cannot show and the list
                  will: no photo means no match. Said before a file is chosen, because somebody
                  about to export two hundred names should know what they are getting. */}
              <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "10px", lineHeight: 1.5 }}>{t.noPhotoNote}</p>
              <button onClick={onDownloadTemplate}
                style={{ marginTop: "10px", border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit" }}>
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
