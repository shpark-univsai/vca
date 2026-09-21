"use client";

import { useMemo, useRef, useState } from "react";
import { ImageOff, ImagePlus } from "lucide-react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER } from "./PortalShared";
import {
  attachVipPhotos, buildVipImportRows, decodeSpreadsheetBytes, importableRows, isBlocking, looksLikeXlsx,
  parseDelimited, type ParsedVipRow, type VipImportIssue,
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
    photoHowNote: "A CSV cannot hold an image, so the images are picked here and matched by file name. Name each image after the person — hong-gildong.jpg — and picking the files is all it takes. Where a file is named something else, write that name in the sheet's Photo file name column.",
    noPhotoNote: "A row that ends up with no face is still registered, and no camera can match that person until one is enrolled.",
    pickPhotos: "Choose photo files",
    pickMorePhotos: "Choose more photos",
    photosNone: "No photos picked yet — they are matched to these rows by file name.",
    photosMatched: (n: number, total: number) => `${n} of ${total} rows have their photo`,
    photosUnused: (names: string) => `Picked and unused: ${names}`,
    colPhoto: "Photo",
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
    doneWithPhoto: (n: number) => (n === 1 ? "1 came with a photo" : `${n} came with a photo`),
    doneNoPhotoNote: (n: number) => `${n === 1 ? "1 person is" : `${n} people are`} in the registry's "no photo" count until a face is enrolled.`,
    skippedHeading: "Skipped rows",
    downloadErrors: "Download skipped rows",
    toastTitle: "VIPs imported",
    toastNothing: "No rows imported",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added} added · ${skipped} skipped` : `${added} added`),
    issue: {
      "missing-name": "No name",
      "duplicate-in-file": "Same name twice in this file — only the first row is imported",
      "duplicate-in-registry": "Already on this project's list — imported anyway",
      "photo-not-found": "The photo file it names was not picked — imported without a face",
      "photo-used-twice": "An earlier row already used this photo — imported without a face",
    } as Record<string, string>,
  },
  ko: {
    title: "VIP 가져오기",
    subtitle: "한 사람이 한 행입니다. 무엇도 대체하지 않고, 모든 행이 이 프로젝트에 추가됩니다.",
    dropHere: "CSV 파일을 여기에 놓으세요",
    orBrowse: "또는 파일 선택",
    formatNote: "CSV 파일. 엑셀에서: 파일 → 다른 이름으로 저장 → CSV UTF-8.",
    columnsNote: "이름만 있으면 됩니다. 메모 열은 파일에 있으면 함께 읽고, 머리글 없이 이름만 적힌 파일도 됩니다.",
    photoHowNote: "CSV 안에는 이미지가 들어가지 않아서, 사진은 여기서 고르고 파일 이름으로 사람을 찾습니다. 파일 이름을 그 사람 이름으로 해 두면(홍길동.jpg) 고르기만 하면 붙습니다. 파일 이름이 이름과 다를 때만 표의 '사진 파일명' 열에 적으면 됩니다.",
    noPhotoNote: "사진이 붙지 않은 행도 등록은 되지만, 얼굴을 등록하기 전에는 어느 카메라도 그 사람을 찾지 못합니다.",
    pickPhotos: "사진 파일 고르기",
    pickMorePhotos: "사진 더 고르기",
    photosNone: "고른 사진이 아직 없습니다 — 파일 이름으로 이 행들과 맞춰 붙입니다.",
    photosMatched: (n: number, total: number) => `${total}행 중 ${n}행에 사진이 붙었습니다`,
    photosUnused: (names: string) => `고른 사진 중 쓰이지 않은 것: ${names}`,
    colPhoto: "사진",
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
    doneWithPhoto: (n: number) => `${n}명은 사진과 함께 등록됨`,
    doneNoPhotoNote: (n: number) => `${n}명은 얼굴을 등록하기 전까지 명단의 '사진 없음'에 들어 있습니다.`,
    skippedHeading: "건너뛴 행",
    downloadErrors: "건너뛴 행 내려받기",
    toastTitle: "VIP를 가져왔습니다",
    toastNothing: "가져온 행이 없습니다",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added}명 추가 · ${skipped}행 건너뜀` : `${added}명 추가`),
    issue: {
      "missing-name": "이름 없음",
      "duplicate-in-file": "이 파일 안에서 이름 중복 — 먼저 나온 행만 가져옵니다",
      "duplicate-in-registry": "이미 이 프로젝트 명단에 있는 이름 — 그래도 가져옵니다",
      "photo-not-found": "적힌 사진 파일이 고른 파일 중에 없음 — 사진 없이 등록됩니다",
      "photo-used-twice": "같은 사진을 앞의 행이 이미 썼음 — 사진 없이 등록됩니다",
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

/**
 * One object URL per picked image, made once and kept — module-level, not a ref.
 *
 * A thumbnail is drawn while rendering, and a ref may not be read there; a module Map has the same
 * lifetime and no such rule. It is also where lib/uploadBlobs keeps its URLs, for the same reason
 * given there: a blob URL is a pointer into this one document, so it belongs to the module rather
 * than to the store or to a component instance.
 *
 * NOT REVOKED WHEN THIS MODAL CLOSES, deliberately. The URLs of the images that were imported are
 * handed to the store as those people's `photoUrl`, and the registry's table, cards and detail
 * panel draw them afterwards — revoking on unmount would blank every face the import just
 * registered. They die with the document, which is also when a blob URL stops meaning anything.
 *
 * A URL for an image that was picked and never imported does outlive its use: a few kilobytes of
 * pointer for files the operator chose by hand in one sitting, against the bookkeeping of tracking
 * which URL the store took — bookkeeping that disappears the day photos are uploaded to a server.
 */
const objectUrls = new Map<File, string>();
function previewUrl(file: File): string {
  const held = objectUrls.get(file);
  if (held) return held;
  const made = URL.createObjectURL(file);
  objectUrls.set(file, made);
  return made;
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
  const [result, setResult] = useState<{ added: number; withPhoto: number; skipped: SkippedRow[] } | null>(null);
  /**
   * THE IMAGES, PICKED BESIDE THE SHEET.
   *
   * Kept as the files themselves rather than as URLs, because the matching is by file name and
   * re-running it is how this screen answers "did my photos land?" — pick the sheet, see which
   * rows are still missing a face, pick the rest, and the same rows answer again. attachVipPhotos
   * recomputes from scratch each time for that reason.
   */
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);

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

  /* The sheet's rows with the picked images handed out. This, not `parsed.rows`, is what the
     preview shows and what the button commits — `parsed` holds the file as it was read, so adding
     photos never re-parses and never re-checks names against the registry. */
  const attached = useMemo(() => (parsed ? attachVipPhotos(parsed.rows, photos) : null), [parsed, photos]);
  const rows = attached?.rows ?? [];
  /**
   * THE PHOTO STEP IS ON EVERY FILE, including a pasted column of bare names.
   *
   * It used to appear only for a sheet with a photo column, which was right while the column was
   * the only way to name an image. It is not any more: an image called 홍길동.jpg finds 홍길동 with
   * nothing written in the sheet at all, so a file of bare names can arrive here with faces — and
   * hiding the button for exactly that file would hide the easiest path to them.
   *
   * The denominator is every row for the same reason: any row can take a photo now, so "5행 중
   * 2행" is the true fraction rather than a count of the rows that happened to name a file.
   */
  const withPhotoCount = rows.filter(r => r.photo).length;

  const okRows = importableRows(rows);
  const badRows = rows.filter(r => r.issues.some(isBlocking));
  /**
   * Rows that import and still have something to say — and this counts ONE of the three warnings,
   * not all of them, because the figure is labelled "already on the list".
   *
   * It used to be `issues.length > 0`, which was true while the only warning was the repeated name.
   * The two photo warnings arrive in the same field, and counting them here made the strip say
   * "2 already on the list" about two rows whose names were new and whose photos had gone astray.
   * The photos have their own summary a line below, which is where those two belong.
   */
  const warnRows = okRows.filter(r => r.issues.includes("duplicate-in-registry"));

  const onPickPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Added to what is already there, not replacing it: photo sets arrive a folder at a time, and
    // a second pick that emptied the first would be a trap for the reader who is filling gaps.
    // Same file picked twice is dropped by name+size, so re-picking a folder does not double it.
    setPhotos(previous => {
      const seen = new Set(previous.map(f => `${f.name}:${f.size}`));
      return [...previous, ...Array.from(files).filter(f => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const commit = () => {
    if (!parsed) return;
    const skipped: SkippedRow[] = rows
      .map(row => ({ row, reasons: row.issues.filter(isBlocking).map(issueText) }))
      .filter(s => s.reasons.length > 0);

    const at = new Date().toISOString();
    // One store call, so the import is one line in the Activity log instead of two hundred that
    // evict everything before them. See addPersons.
    const added = addPersons(okRows.map(row => ({
      // The face this row actually got, and nothing where it got none. This path used to hand
      // every row a stock portrait from the mock pool, which made bulk-imported people look
      // enrolled and matchable when nothing had been enrolled at all — so a row with no image
      // still gets no photoUrl, and stays in the registry's "no photo" figure where it belongs.
      //
      // The enrolment set gets the same one image rather than being left absent: the register's
      // photo tiles read enrolmentPhotoUrls, and a person whose only face was not in that list
      // would show an empty enrolment beside a portrait that is plainly there.
      name: row.name,
      type: "VIP" as const,
      registeredAt: at,
      description: row.description || undefined,
      ...(row.photo ? { photoUrl: previewUrl(row.photo), enrolmentPhotoUrls: [previewUrl(row.photo)] } : null),
      projectId,
    })), parsed.fileName);

    // addPersons refuses nothing — it returns the length of what it was handed (vcaStore.ts) — so
    // unlike the camera import there is no second, store-side skip list to fold in here. If it ever
    // grows one, it belongs on this line.
    setResult({ added, withPhoto: okRows.filter(r => r.photo).length, skipped });
    showToast({
      variant: added > 0 ? "success" : "warning",
      title: added > 0 ? t.toastTitle : t.toastNothing,
      desc: t.toastDesc(added, skipped.length),
    });
  };

  const downloadSkipped = () => {
    if (!result) return;
    // The photo column comes along, so the fixed file can be re-imported as it stands rather than
    // losing which image each row asked for.
    downloadCsv("vip-import-skipped.csv", [
      [t.colLine, t.colName, t.colMemo, t.colPhoto, t.colReason],
      ...result.skipped.map(s => [String(s.row.line), s.row.name, s.row.description, s.row.photoFile, s.reasons.join("; ")]),
    ]);
  };

  /* Track count and cell count are driven by the one flag, because a grid whose row emits fewer
     cells than it has tracks does not leave a hole — it slides every later cell one column left. */
  const GRID = "34px 1fr 1fr 46px 1.4fr";

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
              {/* Where those people now are, said once and in the registry's own words — and now
                  counted rather than assumed: the import can land faces, so the number in the
                  사진 없음 sentence is the rows that did NOT get one, and the sentence disappears
                  entirely when every row came with a photo. Saying "all of them" over a set that
                  is half enrolled is the kind of confident wrong figure this screen exists to
                  stop producing. */}
              {result.withPhoto > 0 && (
                <p style={{ fontSize: "13px", color: "var(--success-400)", fontWeight: 700, marginTop: "2px" }}>{t.doneWithPhoto(result.withPhoto)}</p>
              )}
              {result.added - result.withPhoto > 0 && (
                <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "10px", lineHeight: 1.5 }}>{t.doneNoPhotoNote(result.added - result.withPhoto)}</p>
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
              {/* THE SECOND HALF OF THE FILE, when the sheet asked for one.
                  A sheet with a photo column has named images this modal does not have yet, so the
                  way to give them to it sits here — beside the counts it changes, before the
                  button, and not as a step of its own: the reader has to be able to pick more and
                  watch the same rows fill in. A file of bare names shows none of this and keeps
                  the sentence it always had. */}
              <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button onClick={() => photoInputRef.current?.click()}
                    style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    <ImagePlus size={13} strokeWidth={2.4} />
                    {photos.length === 0 ? t.pickPhotos : t.pickMorePhotos}
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" multiple
                    onChange={e => { onPickPhotos(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                  {photos.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.photosNone}</span>
                  ) : (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: withPhotoCount === rows.length ? "var(--success-400)" : "var(--warning-500)" }}>
                      {t.photosMatched(withPhotoCount, rows.length)}
                    </span>
                  )}
                  {/* Pictures the reader chose that no row asked for — a misspelt file name in the
                      sheet looks identical from the row's side, and this is the half that names the
                      file so the two can be compared. Four, then a count: a folder of two hundred
                      photos against the wrong sheet would otherwise fill the modal. */}
                  {attached && attached.unusedFiles.length > 0 && (
                    <span style={{ width: "100%", fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>
                      {t.photosUnused(attached.unusedFiles.slice(0, 4).join(", ")
                        + (attached.unusedFiles.length > 4 ? ` +${attached.unusedFiles.length - 4}` : ""))}
                    </span>
                  )}
                {/* The consequence, and only while there is one: it goes as the last row fills. */}
                {withPhotoCount < rows.length && (
                  <span style={{ width: "100%", fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.noPhotoNote}</span>
                )}
              </div>
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "10px", padding: "8px 20px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, position: "sticky", top: 0 }}>
                {[t.colLine, t.colName, t.colMemo, t.colPhoto, t.colReason].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
                ))}
              </div>
              {rows.map((r, i) => {
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
                    {/* THE FACE ITSELF, not a tick. The one thing the reader cannot check from a
                        file name is whether the right person's photo landed on the right row, and a
                        26px thumbnail is that check — the reason the images are picked here rather
                        than uploaded blind after the import. A row whose file was not picked shows
                        the words instead; the reason column says what to do about it. */}
                    {(
                      r.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl(r.photo)} alt="" width={26} height={26}
                          style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--gray-200)" }} />
                      ) : r.photoFile ? (
                        /* A MARK, NOT A SENTENCE. This cell held the words 파일 없음 while the
                           reason column beside it said the same thing at length — one fact twice,
                           in the two columns a reader compares. The glyph marks the row, the file
                           name it was looking for is on the hover, and the sentence stays in the
                           column whose heading is 사유. */
                        <span title={r.photoFile} style={{ display: "flex", color: "var(--warning-500)" }}>
                          <ImageOff size={15} strokeWidth={2.2} />
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>
                      )
                    )}
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
              {/* HOW, THEN WHAT IT COSTS — and only the second one is amber. These were one
                  paragraph in warning colour, which put three lines of plain instruction ("write
                  the file name in this column") under the colour this console keeps for things
                  that are wrong. The instruction is how the feature works; the consequence is the
                  one fact the file cannot show and the list will. */}
              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px", lineHeight: 1.5 }}>{t.photoHowNote}</p>
              <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "6px", lineHeight: 1.5 }}>{t.noPhotoNote}</p>
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
