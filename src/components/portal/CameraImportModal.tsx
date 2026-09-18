"use client";

import { useRef, useState } from "react";
import { useVcaStore, projectChannelLimit } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER } from "./PortalShared";
import {
  buildCameraImportRows, decodeSpreadsheetBytes, importableRows, isBlocking, looksLikeXlsx, parseDelimited,
  type CameraImportIssue, type CameraImportMode, type ParsedCameraRow,
} from "@/lib/cameraImport";

/**
 * Installation day, from the installer's own spreadsheet.
 *
 * Same three steps as the roster import — give us the file, read it back, see what happened —
 * because it is the same job and a second shape for it would be a second thing to learn. What
 * this one adds is the channel allowance: a licence is a count, and a file can exceed it, so the
 * number of cameras that will actually be registered is stated before the button is pressed
 * rather than discovered in the result.
 */

const T = {
  en: {
    title: "Import cameras",
    subtitle: "One row per camera. Nothing is replaced — every row is added to this project.",
    modeQuestion: "What is this file for?",
    modeAdd: "Register new cameras",
    modeAddWhy: "Every row becomes a camera. A code already in the register is refused as a collision.",
    modeFill: "Fill in coordinates",
    modeFillWhy: "For cameras already registered. Export the register, put the surveyed latitude and longitude in those two columns, and drop it back — only the position changes. Rows whose code matches nothing are refused.",
    columnsNoteFill: "Code, Latitude and Longitude are required. Everything else in the file is ignored — this mode changes nothing but the position.",
    dropHere: "Drop a CSV file here",
    orBrowse: "or choose a file",
    formatNote: "CSV or TSV. In Excel: File → Save As → CSV UTF-8.",
    columnsNote: "Name, Code, RTSP URL, Latitude and Longitude are required. Zone, Location, IP and MAC are used if the file has them.",
    downloadTemplate: "Download template",
    xlsxTitle: "That is an Excel file",
    xlsxBody: "Save it as CSV UTF-8 first — in Excel, File → Save As → CSV UTF-8 — and drop that.",
    emptyFileTitle: "Nothing to import",
    emptyFileBody: "The file has no rows under its header.",
    missingColumnsTitle: "Wrong file, or missing columns",
    missingColumnsBody: (names: string) => `No column matched: ${names}. A camera needs a name, a code, a stream URL and a position — without the last one its detections count toward no district.`,
    colLine: "Line", colName: "Name", colCode: "Code", colRtsp: "RTSP URL", colZone: "Zone", colLocation: "Location",
    colLat: "Latitude", colLng: "Longitude", colIp: "IP", colMac: "MAC", colReason: "Reason",
    readyCount: (n: number) => `${n} ready`,
    errorCount: (n: number) => `${n} with errors`,
    allRowsBad: "No row in this file can be imported.",
    errorsSkippedNote: "Rows with errors are skipped; the rest still import.",
    unmappedNote: (cols: string) => `Ignored columns: ${cols}`,
    importN: (n: number) => (n === 1 ? "Import 1 camera" : `Import ${n} cameras`),
    cancel: "Cancel", close: "Close",
    // Channel allowance
    allowanceNone: "This project has no licensed channel count recorded, so no camera can be registered. The count arrives with the licence.",
    allowanceFull: (limit: number) => `All ${limit} licensed channels are in use. Nothing can be imported until channels are freed or the licence is raised.`,
    allowanceLeft: (left: number) => `${left} channel${left === 1 ? "" : "s"} left on this licence.`,
    allowanceCut: (left: number, ready: number) => `The file has ${ready} importable rows and the licence has ${left} channels left — the first ${left} will be registered and the rest refused.`,
    doneTitle: "Import finished",
    doneAdded: (n: number) => (n === 1 ? "1 camera registered" : `${n} cameras registered`),
    doneFilled: (n: number) => (n === 1 ? "1 camera positioned" : `${n} cameras positioned`),
    importFillN: (n: number) => (n === 1 ? "Fill 1 camera" : `Fill ${n} cameras`),
    doneSkipped: (n: number) => `${n} row${n === 1 ? "" : "s"} skipped`,
    skippedHeading: "Skipped rows",
    downloadErrors: "Download skipped rows",
    toastTitle: "Cameras imported",
    toastNothing: "No rows imported",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added} added · ${skipped} skipped` : `${added} added`),
    issue: {
      "missing-name": "No name",
      "missing-code": "No code",
      "missing-rtsp": "No RTSP URL",
      "duplicate-in-file": "Duplicate code in this file",
      "duplicate-in-register": "Code already registered",
      "bad-coordinates": "Coordinates are not readable",
      "no-coordinates": "No coordinates — not on the map, not in any district figure",
      "over-limit": "No channel left on the licence",
      rejected: "Refused by the register",
    } as Record<string, string>,
  },
  ko: {
    title: "카메라 가져오기",
    subtitle: "카메라 한 대가 한 행입니다. 무엇도 대체하지 않고, 모든 행이 이 프로젝트에 추가됩니다.",
    modeQuestion: "이 파일은 무엇을 하려는 건가요?",
    modeAdd: "새 카메라 등록",
    modeAddWhy: "한 행이 카메라 한 대가 됩니다. 이미 등록된 코드는 중복으로 거절합니다.",
    modeFill: "좌표 채우기",
    modeFillWhy: "이미 등록된 카메라용입니다. 등록부를 내보내 측량한 위도·경도를 그 두 열에 채워 다시 올리면 위치만 바뀝니다. 코드가 어느 카메라와도 맞지 않는 행은 거절합니다.",
    columnsNoteFill: "코드·위도·경도가 필수입니다. 파일의 나머지는 읽지 않습니다 — 이 모드는 위치 말고 아무것도 바꾸지 않습니다.",
    dropHere: "CSV 파일을 여기에 놓으세요",
    orBrowse: "또는 파일 선택",
    formatNote: "CSV 또는 TSV. 엑셀에서: 파일 → 다른 이름으로 저장 → CSV UTF-8.",
    columnsNote: "이름·코드·RTSP URL·위도·경도가 필수입니다. 구역·위치·IP·MAC은 파일에 있으면 함께 읽습니다.",
    downloadTemplate: "서식 내려받기",
    xlsxTitle: "엑셀 파일입니다",
    xlsxBody: "CSV UTF-8로 먼저 저장해 주세요 — 엑셀에서 파일 → 다른 이름으로 저장 → CSV UTF-8 — 그 파일을 놓으시면 됩니다.",
    emptyFileTitle: "가져올 것이 없습니다",
    emptyFileBody: "머리글 아래에 행이 없습니다.",
    missingColumnsTitle: "다른 파일이거나 열이 빠졌습니다",
    missingColumnsBody: (names: string) => `일치하는 열이 없습니다: ${names}. 카메라에는 이름·코드·스트림 주소·위치가 필요합니다 — 위치가 없으면 그 카메라의 탐지가 어느 구역 숫자에도 들어가지 않습니다.`,
    colLine: "행", colName: "이름", colCode: "코드", colRtsp: "RTSP URL", colZone: "구역", colLocation: "위치",
    colLat: "위도", colLng: "경도", colIp: "IP", colMac: "MAC", colReason: "사유",
    readyCount: (n: number) => `${n}대 준비됨`,
    errorCount: (n: number) => `${n}행 오류`,
    allRowsBad: "이 파일에서 가져올 수 있는 행이 없습니다.",
    errorsSkippedNote: "오류가 있는 행은 건너뛰고 나머지는 그대로 들어갑니다.",
    unmappedNote: (cols: string) => `무시한 열: ${cols}`,
    importN: (n: number) => `${n}대 가져오기`,
    cancel: "취소", close: "닫기",
    allowanceNone: "이 프로젝트에는 라이선스 채널 수가 기록되어 있지 않아 카메라를 등록할 수 없습니다. 그 수는 라이선스와 함께 들어옵니다.",
    allowanceFull: (limit: number) => `라이선스 채널 ${limit}개를 모두 쓰고 있습니다. 채널을 비우거나 한도를 올리기 전에는 가져올 수 없습니다.`,
    allowanceLeft: (left: number) => `이 라이선스에 남은 채널 ${left}개.`,
    allowanceCut: (left: number, ready: number) => `파일에 가져올 수 있는 행이 ${ready}개인데 라이선스에 남은 채널은 ${left}개입니다 — 앞의 ${left}대만 등록되고 나머지는 거부됩니다.`,
    doneTitle: "가져오기 완료",
    doneAdded: (n: number) => `카메라 ${n}대 등록됨`,
    doneFilled: (n: number) => `카메라 ${n}대 좌표 채움`,
    importFillN: (n: number) => `${n}대 좌표 채우기`,
    doneSkipped: (n: number) => `${n}행 건너뜀`,
    skippedHeading: "건너뛴 행",
    downloadErrors: "건너뛴 행 내려받기",
    toastTitle: "카메라를 가져왔습니다",
    toastNothing: "가져온 행이 없습니다",
    toastDesc: (added: number, skipped: number) => (skipped > 0 ? `${added}대 추가 · ${skipped}행 건너뜀` : `${added}대 추가`),
    issue: {
      "missing-name": "이름 없음",
      "missing-code": "코드 없음",
      "missing-rtsp": "RTSP 주소 없음",
      "duplicate-in-file": "이 파일 안에서 코드 중복",
      "duplicate-in-register": "이미 등록된 코드",
      "bad-coordinates": "좌표를 읽을 수 없음",
      "no-coordinates": "좌표 없음 — 지도에 없고, 구역 집계에도 안 들어감",
      "over-limit": "라이선스에 남은 채널 없음",
      rejected: "등록부가 거부함",
    } as Record<string, string>,
  },
};

type Dict = typeof T.en;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(fileName: string, rows: string[][]) {
  // BOM, for the same reason the roster export carries one: without it Excel opens a UTF-8 CSV
  // in the system codepage and every Korean zone name comes back as mojibake.
  const csv = "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface SkippedRow { row: ParsedCameraRow; reasons: string[] }
interface FileError { title: string; body: string }

export default function CameraImportModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const cameras = useVcaStore(s => s.cameras);
  const projects = useVcaStore(s => s.projects);
  const addCameras = useVcaStore(s => s.addCameras);
  const fillCameraPositions = useVcaStore(s => s.fillCameraPositions);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  useEscapeKey(onClose);

  const inputRef = useRef<HTMLInputElement>(null);
  // What the file is for. Explicit, because "update if the code exists" would let a file meant to
  // add twelve cameras rewrite the stream config of everything already registered — see
  // CameraImportMode.
  const [mode, setMode] = useState<CameraImportMode>("add");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [parsed, setParsed] = useState<{ rows: ParsedCameraRow[]; unmapped: string[]; fileName: string } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: SkippedRow[] } | null>(null);

  const project = projects.find(p => p.id === projectId);
  const limit = project ? projectChannelLimit(project) : undefined;
  const used = cameras.filter(c => c.projectId === projectId).length;
  // Same reading as the Cameras tab: no recorded count is "not licensed", not "unlimited".
  const allowance = limit === undefined ? 0 : Math.max(0, limit - used);

  const issueText = (issue: CameraImportIssue | "over-limit" | "rejected") => t.issue[issue] ?? issue;

  const readFile = async (file: File) => {
    setFileError(null);
    setParsed(null);
    const buffer = await file.arrayBuffer();
    if (looksLikeXlsx(file.name, new Uint8Array(buffer.slice(0, 2)))) {
      setFileError({ title: t.xlsxTitle, body: t.xlsxBody });
      return;
    }
    const table = parseDelimited(decodeSpreadsheetBytes(buffer));
    // Codes are checked against every camera in the store, not just this project's: the register
    // is one id space, and a code reused on another site is how a detection lands on the wrong
    // street. addCameras applies the same rule, so a project-scoped check here would show green
    // for rows it then refuses.
    const { rows, missingColumns, unmappedHeaders } = buildCameraImportRows(table, cameras.map(c => c.code), mode);
    if (missingColumns.length > 0) {
      const label: Record<string, string> = { name: t.colName, code: t.colCode, rtspUrl: t.colRtsp, lat: t.colLat, lng: t.colLng };
      setFileError(table.length === 0
        ? { title: t.emptyFileTitle, body: t.emptyFileBody }
        : { title: t.missingColumnsTitle, body: t.missingColumnsBody(missingColumns.map(c => label[c] ?? c).join(", ")) });
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

  const downloadTemplate = () => downloadCsv("camera-import-template.csv", [
    [t.colName, t.colCode, t.colZone, t.colLocation, t.colRtsp, t.colIp, t.colMac, t.colLat, t.colLng],
    [
      lang === "ko" ? "정문 카메라" : "Main Gate Camera", "CAM-001",
      lang === "ko" ? "정문" : "Main Gate",
      lang === "ko" ? "1층 로비 입구" : "Level 1 lobby entrance",
      "rtsp://192.168.0.21:554/stream1", "192.168.0.21", "00:1A:2B:3C:4D:5E", "1.3521", "103.8198",
    ],
  ]);

  const okRows = parsed ? importableRows(parsed.rows, mode) : [];
  // Arrows, not a bare `isBlocking` reference: Array.prototype passes the index as the second
  // argument, which would land in the `mode` parameter.
  const badRows = parsed?.rows.filter(r => r.issues.some(i => isBlocking(i, mode))) ?? [];
  /* There is no such thing as a non-blocking issue any more — in both modes every issue refuses
     its row (see WARNINGS_BY_MODE), so the amber "imported with a caveat" tally this used to feed
     described a case the screen can no longer produce. Kept as a comment rather than a variable:
     if a real warning is ever added back, this is where its count belongs. */
  // What will actually be registered, after the licence has its say. Stated before the button is
  // pressed: a file of 300 rows against 40 free channels is a fact the reader should meet here,
  // not in the result screen.
  const willImport = Math.min(okRows.length, allowance);

  const commit = () => {
    if (!parsed) return;
    const skipped: SkippedRow[] = [];
    parsed.rows.forEach(row => {
      const blocking = row.issues.filter(i => isBlocking(i, mode));
      if (blocking.length > 0) skipped.push({ row, reasons: blocking.map(issueText) });
    });

    /*
     * FILL MODE WRITES POSITIONS, IT DOES NOT REGISTER ANYTHING.
     *
     * This called addCameras whichever mode was chosen, so a coordinate file — every row naming a
     * camera that is already registered — came back with every row refused as a code collision.
     * The mode was parsed and then thrown away at the last step, which is the worst place to lose
     * it: the screen had already said what it was going to do.
     */
    if (mode === "fill-coordinates") {
      const notFound = new Set(fillCameraPositions(
        projectId,
        okRows.map(row => ({ code: row.code, lat: row.lat as number, lng: row.lng as number })),
        parsed.fileName,
      ));
      okRows.forEach(row => {
        if (notFound.has(row.code)) skipped.push({ row, reasons: [issueText("not-in-register")] });
      });
      const filled = okRows.length - notFound.size;
      setResult({ added: filled, skipped });
      showToast({
        variant: filled > 0 ? "success" : "warning",
        title: filled > 0 ? t.toastTitle : t.toastNothing,
        desc: t.toastDesc(filled, skipped.length),
      });
      return;
    }

    const refused = new Set(addCameras(
      okRows.map(row => ({
        projectId,
        code: row.code, name: row.name, rtspUrl: row.rtspUrl,
        zone: row.zone, location: row.location,
        ip: row.ip, mac: row.mac,
        // Zero is a real coordinate, so "not surveyed" cannot be written as 0,0 — that is a point
        // in the Gulf of Guinea, and the maps drew a pin there. The Add form's own comment warned
        // about exactly this and then this line did it for every row an installer had no survey
        // for. Camera.lat is optional now, so absence is written as absence; the result screen
        // still says these will not appear until a position is set (doneNoCoordsNote).
        ...(row.lat !== undefined && row.lng !== undefined ? { lat: row.lat, lng: row.lng } : {}),
        status: "offline" as const,
        thumbnail: "",
      })),
      parsed.fileName,
    ));
    okRows.forEach(row => {
      if (refused.has(row.code)) {
        // The store refuses for two reasons and they read differently to the person holding the
        // file: a code collision is a row to fix, a channel shortfall is a licence to raise.
        skipped.push({ row, reasons: [issueText(okRows.indexOf(row) >= allowance ? "over-limit" : "rejected")] });
      }
    });
    const added = okRows.length - refused.size;
    setResult({ added, skipped });
    showToast({
      variant: added > 0 ? "success" : "warning",
      title: added > 0 ? t.toastTitle : t.toastNothing,
      desc: t.toastDesc(added, skipped.length),
    });
  };

  const downloadSkipped = () => {
    if (!result) return;
    downloadCsv("camera-import-skipped.csv", [
      [t.colLine, t.colName, t.colCode, t.colRtsp, t.colZone, t.colLocation, t.colReason],
      ...result.skipped.map(s => [
        String(s.row.line), s.row.name, s.row.code, s.row.rtspUrl, s.row.zone, s.row.location, s.reasons.join("; "),
      ]),
    ]);
  };

  const GRID = "40px 1.2fr 0.9fr 1.6fr 0.9fr 1fr";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{
        backgroundColor: "white", borderRadius: "16px", border: BORDER, width: "100%",
        maxWidth: parsed || result ? "820px" : "460px",
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
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{mode === "fill-coordinates" ? t.doneFilled(result.added) : t.doneAdded(result.added)}</p>
              {result.skipped.length > 0 && (
                <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "2px" }}>{t.doneSkipped(result.skipped.length)}</p>
              )}
              {/* The "registered but not on the map" note is gone with the state it described:
                  nothing imports without coordinates any more (see WARNINGS_BY_MODE), so a line
                  explaining what happens to those rows would describe a case this screen can no
                  longer produce. */}
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
                          {s.row.name || s.row.code || "—"}
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
              {/* No amber "N without coordinates" tally either — in both modes a row without a
                  position is an error now, and it is counted with the rest of them. */}
              <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                {okRows.length === 0 ? t.allRowsBad : badRows.length > 0 ? t.errorsSkippedNote : ""}
              </span>
              {parsed.unmapped.length > 0 && (
                <span style={{ fontSize: "12px", color: "var(--gray-400)", width: "100%" }}>{t.unmappedNote(parsed.unmapped.join(", "))}</span>
              )}
              {/* The licence, before the button rather than after. A file of 300 rows against 40
                  free channels is the single most likely surprise in this flow. */}
              <span style={{
                width: "100%", fontSize: "12px", lineHeight: 1.5,
                color: allowance === 0 || okRows.length > allowance ? "var(--warning-500)" : "var(--gray-500)",
              }}>
                {limit === undefined ? t.allowanceNone
                  : allowance === 0 ? t.allowanceFull(limit)
                  : okRows.length > allowance ? t.allowanceCut(allowance, okRows.length)
                  : t.allowanceLeft(allowance)}
              </span>
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "10px", padding: "8px 20px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, position: "sticky", top: 0 }}>
                {[t.colLine, t.colName, t.colCode, t.colRtsp, t.colZone, t.colLocation].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
                ))}
              </div>
              {parsed.rows.map((r, i) => {
                const blocking = r.issues.filter(i => isBlocking(i, mode));
                const bad = blocking.length > 0;
                const warn = !bad && r.issues.length > 0;
                return (
                  <div key={`${r.line}-${i}`} style={{
                    display: "grid", gridTemplateColumns: GRID, columnGap: "10px",
                    padding: "8px 20px", borderBottom: BORDER,
                    backgroundColor: bad ? "var(--danger-100)" : "transparent",
                  }}>
                    <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{r.line}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.code || "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.rtspUrl || "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.zone || "—"}</span>
                    <span style={{ fontSize: "12px", color: bad ? "var(--danger-500)" : warn ? "var(--warning-500)" : "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.issues.length > 0 ? r.issues.map(issueText).join(" · ") : (r.location || "—")}
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
              <button onClick={commit} disabled={willImport === 0}
                style={{
                  padding: "10px 16px", borderRadius: "8px", border: "none",
                  backgroundColor: willImport === 0 ? "var(--gray-200)" : "var(--primary-400)",
                  color: willImport === 0 ? "var(--gray-400)" : "white",
                  fontSize: "13px", fontWeight: 700, cursor: willImport === 0 ? "not-allowed" : "pointer",
                }}>
                {mode === "fill-coordinates" ? t.importFillN(willImport) : t.importN(willImport)}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "0 20px 20px" }}>
              {/*
                THE MODE, ASKED BEFORE THE FILE.
                
                It existed in the library and in this component's state and had no control at all —
                setMode was never called, so the round trip the coordinate decision leans on ("put
                the survey in later") was reachable from code and from nobody's hands. Recorded in
                HANDOFF-SERVER §9-2 as the way back from a deferred survey, which made writing this
                overdue rather than optional.
                
                Two boxes rather than a select, and asked first: the same file means two different
                things depending on the answer, and "update the row if the code exists" as a silent
                default is destructive — a file meant to add twelve cameras would rewrite the name,
                stream URL and credentials of everything already registered under a matching code.
                See CameraImportMode.
              */}
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>{t.modeQuestion}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                {([
                  { value: "add" as CameraImportMode, label: t.modeAdd, why: t.modeAddWhy },
                  { value: "fill-coordinates" as CameraImportMode, label: t.modeFill, why: t.modeFillWhy },
                ]).map(option => {
                  const on = mode === option.value;
                  return (
                    <button key={option.value} type="button"
                      /* The parse is mode-dependent, so a mode change after a file is chosen has to
                         drop what was parsed rather than reinterpret it silently. */
                      onClick={() => { setMode(option.value); setParsed(null); setFileError(null); }}
                      style={{
                        textAlign: "left", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                        border: on ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)",
                        backgroundColor: on ? "var(--primary-50)" : "white",
                      }}>
                      <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: on ? "var(--primary-400)" : "var(--gray-900)" }}>{option.label}</span>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--gray-500)", marginTop: "3px", lineHeight: 1.45 }}>{option.why}</span>
                    </button>
                  );
                })}
              </div>
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
                  <p style={{ fontSize: "12px", color: "var(--danger-500)", marginTop: "4px", lineHeight: 1.5 }}>{fileError.body}</p>
                </div>
              )}

              {/* Said before a file is chosen, not after it is parsed: somebody about to export
                  300 rows out of a survey should know the ceiling first. */}
              <p style={{ fontSize: "12px", marginTop: "14px", lineHeight: 1.5, color: allowance === 0 ? "var(--warning-500)" : "var(--gray-500)" }}>
                {limit === undefined ? t.allowanceNone : allowance === 0 ? t.allowanceFull(limit) : t.allowanceLeft(allowance)}
              </p>
              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.5 }}>
                {mode === "fill-coordinates" ? t.columnsNoteFill : t.columnsNote}
              </p>
              <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px", lineHeight: 1.5 }}>{t.formatNote}</p>
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
