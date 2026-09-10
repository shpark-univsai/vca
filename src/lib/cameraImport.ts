/**
 * Reading a camera list out of a spreadsheet file.
 *
 * Installation day is hundreds of cameras. The console had one form, one camera at a time, so
 * the real first day happened somewhere else — in a spreadsheet the installer already keeps, and
 * then in our engineer's hands typing it back in. This reads that spreadsheet.
 *
 * It reads exactly what the Cameras tab's Export CSV writes (Name · Code · Zone · Location ·
 * RTSP URL · Status), so the round trip is export → edit in Excel → Save as CSV UTF-8 → import.
 * Extra columns for the things the export cannot carry — IP, MAC, coordinates — are accepted
 * under the headings an installer's own sheet is likely to use.
 *
 * Format and parsing are shared with the roster importer: same delimited-text-only stance, same
 * encoding sniff, same header normalisation. See rosterImport.ts for why .xlsx is out of scope.
 *
 * Nothing here touches the store. It turns a file into rows plus a per-row verdict; committing
 * them is the caller's job, one addCamera at a time — and the caller is also where the licence's
 * channel limit is enforced, because that is a fact about the project rather than about the file.
 */

import { normalizeHeader } from "./rosterImport";

/** Why a row cannot be imported, or needs saying out loud. A row can collect several. */
export type CameraImportIssue =
  | "missing-name"
  | "missing-code"
  | "missing-rtsp"
  | "duplicate-in-file"
  | "duplicate-in-register"
  | "bad-coordinates"
  | "no-coordinates";

/**
 * The one issue that does not block an import.
 *
 * A camera with no coordinates is a real camera that cannot be drawn on the map. Refusing it
 * would mean an installer who has RTSP URLs but not a survey cannot start, which is backwards —
 * the map placement is the thing that gets filled in later, not the camera. So it imports, and
 * it says so, and the row is counted separately so nobody discovers it as an empty map.
 */
export const CAMERA_IMPORT_WARNINGS: CameraImportIssue[] = ["no-coordinates"];

export function isBlocking(issue: CameraImportIssue): boolean {
  return !CAMERA_IMPORT_WARNINGS.includes(issue);
}

export interface ParsedCameraRow {
  /** 1-based line in the source file, header counted, so an error points at something findable. */
  line: number;
  name: string;
  code: string;
  rtspUrl: string;
  zone: string;
  location: string;
  ip: string;
  mac: string;
  /** Undefined when the file carried no usable pair — see "no-coordinates". */
  lat?: number;
  lng?: number;
  issues: CameraImportIssue[];
}

export type CameraColumnKey =
  | "name" | "code" | "rtspUrl" | "zone" | "location" | "ip" | "mac" | "lat" | "lng";

export interface CameraParseResult {
  rows: ParsedCameraRow[];
  /** Required columns the header row did not offer. Non-empty means the file is the wrong file
   *  rather than a right file with bad rows, and the screen should say that instead of listing
   *  every row as broken. */
  missingColumns: CameraColumnKey[];
  /** Headings we could not map, reported so a misspelt column reads as "this was ignored"
   *  rather than silently dropping every camera's zone. */
  unmappedHeaders: string[];
}

/**
 * Header synonyms, per field. Both languages in one list for the same reason the roster does it:
 * the sheet was probably made by the installer, not by the person importing it, so keying this
 * off the console's UI language would guess wrong about half the time.
 */
const HEADER_SYNONYMS: Record<CameraColumnKey, string[]> = {
  name: ["name", "cameraname", "camera", "이름", "카메라명", "카메라이름"],
  code: ["code", "cameracode", "id", "cameraid", "코드", "카메라코드", "관리번호"],
  rtspUrl: ["rtspurl", "rtsp", "url", "streamurl", "stream", "주소", "스트림", "rtsp주소"],
  zone: ["zone", "area", "district", "구역", "지역", "권역"],
  location: ["location", "address", "place", "site", "위치", "주소지", "설치위치"],
  ip: ["ip", "ipaddress", "ipaddr", "아이피", "ip주소"],
  mac: ["mac", "macaddress", "macaddr", "맥", "mac주소"],
  lat: ["lat", "latitude", "위도"],
  lng: ["lng", "lon", "long", "longitude", "경도"],
};

/** Name, code and a stream. Everything else can arrive later; without these three there is no
 *  camera to add — a row with no RTSP URL is a line in a spreadsheet, not a source. */
const REQUIRED: CameraColumnKey[] = ["name", "code", "rtspUrl"];

/** Latitude/longitude, or undefined if the cell is empty or not a usable number. */
function parseCoord(raw: string, max: number): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  // null means "there was something here and it is not a coordinate" — worth flagging, unlike an
  // empty cell which just means the survey has not happened.
  if (!Number.isFinite(n) || Math.abs(n) > max) return null;
  return n;
}

export function buildCameraImportRows(
  table: { cells: string[]; line: number }[],
  existingCodes: string[],
): CameraParseResult {
  if (table.length === 0) return { rows: [], missingColumns: [...REQUIRED], unmappedHeaders: [] };

  const [header, ...body] = table;
  const columnOf: Partial<Record<CameraColumnKey, number>> = {};
  const unmappedHeaders: string[] = [];

  header.cells.forEach((raw, i) => {
    const norm = normalizeHeader(raw);
    const key = (Object.keys(HEADER_SYNONYMS) as CameraColumnKey[])
      .find(k => HEADER_SYNONYMS[k].includes(norm));
    // First column wins a duplicate heading — a second "Name" is a stray column, not a correction.
    if (key && columnOf[key] === undefined) columnOf[key] = i;
    else if (raw.trim() !== "") unmappedHeaders.push(raw.trim());
  });

  const missingColumns = REQUIRED.filter(k => columnOf[k] === undefined);
  if (missingColumns.length > 0) return { rows: [], missingColumns, unmappedHeaders };

  // Codes are the register's key and the id space the app matches detections against, so a
  // collision is not a cosmetic duplicate — two cameras answering to one code is how a sighting
  // ends up attributed to the wrong street.
  const takenInRegister = new Set(existingCodes.map(c => c.trim().toLowerCase()));
  const seenInFile = new Set<string>();

  const rows = body.map(({ cells, line }) => {
    const at = (key: CameraColumnKey) => {
      const i = columnOf[key];
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };

    const name = at("name");
    const code = at("code");
    const rtspUrl = at("rtspUrl");
    const issues: CameraImportIssue[] = [];

    if (!name) issues.push("missing-name");
    if (!code) issues.push("missing-code");
    if (!rtspUrl) issues.push("missing-rtsp");

    const key = code.toLowerCase();
    if (code) {
      if (takenInRegister.has(key)) issues.push("duplicate-in-register");
      else if (seenInFile.has(key)) issues.push("duplicate-in-file");
      else seenInFile.add(key);
    }

    const lat = parseCoord(at("lat"), 90);
    const lng = parseCoord(at("lng"), 180);
    if (lat === null || lng === null) issues.push("bad-coordinates");
    else if (lat === undefined || lng === undefined) issues.push("no-coordinates");

    return {
      line, name, code, rtspUrl,
      zone: at("zone"),
      location: at("location"),
      ip: at("ip"),
      mac: at("mac"),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      issues,
    };
  })
  // A trailing newline in a CSV is one empty row, and reporting it as three missing fields is
  // the importer complaining about its own parsing.
  .filter(r => !(r.name === "" && r.code === "" && r.rtspUrl === ""));

  return { rows, missingColumns: [], unmappedHeaders };
}

/** Rows that can actually be added — nothing blocking. Warnings do not disqualify. */
export function importableRows(rows: ParsedCameraRow[]): ParsedCameraRow[] {
  return rows.filter(r => !r.issues.some(isBlocking));
}

export { decodeSpreadsheetBytes, looksLikeXlsx, parseDelimited } from "./rosterImport";
