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
  | "no-coordinates"
  | "not-in-register";

/**
 * What the file is FOR. The same spreadsheet means two different things depending on this, and
 * the issues invert between them, so it is a parameter rather than something inferred.
 *
 * "add" — these are new cameras. A code already in the register is a collision and blocks.
 * "fill-coordinates" — these are cameras we already have, and the file carries the survey that
 *   was not available on install day. A code already in the register is the POINT; a code that
 *   matches nothing blocks instead.
 *
 * WHY THIS IS A MODE AND NOT AUTOMATIC. "Update the row if the code already exists" is the
 * obvious shortcut and it is destructive: the file an installer re-drops to add twelve new
 * cameras would silently rewrite the name, RTSP URL, IP and credentials of every camera already
 * registered under a matching code — working streams, reconfigured by a paste. The operator has
 * to say which of the two things they are doing, and then only what that mode promises changes.
 */
export type CameraImportMode = "add" | "fill-coordinates";

/**
 * Issues that do not block, per mode. Everything else blocks.
 *
 * NOTHING IS MERELY A WARNING IN EITHER MODE ANY MORE.
 *
 * A camera with no coordinates is not a camera missing a pin: the coordinates are what put it in a
 * district, and a district's VIP count is the detections of the cameras in it (confirmed
 * 2026-09-18 from a customer already running the service). So its detections fall out of every
 * district figure, with nothing on any screen saying the number was counted short.
 *
 * This door let them through at first, on the argument that a three-hundred-row inventory export
 * is exactly the file that has no survey in it yet — so the rule was "one at a time it is
 * demanded, in bulk it may be deferred", with the deferral visible (the 좌표 미등록 cell) and a
 * way back (the fill-coordinates mode). The owner closed that door too the same day: "csv 가져올
 * 때 위치정보 없으면 등록 안 되게 막아야 할 것 같아." A rule enforced at two of three doors is a
 * rule that leaks at the third, and the third is the one that registers three hundred cameras at
 * once — which is where an invisible undercount scales.
 *
 * So the survey now comes before the import, not after it. The file is refused up front when it
 * has no latitude/longitude COLUMNS (see REQUIRED), and row by row when a row leaves them empty.
 * The fill-coordinates mode stays: it is now for the rows an older install left behind, not for a
 * deferral this screen creates.
 *
 * In "fill-coordinates" the same absence blocks, because a row with no coordinates has nothing to
 * fill and a "no change" row reported as imported is a lie. Name and stream are not read at all
 * in this mode, so their absence is not an issue either — the file only needs code + coordinates,
 * which is what an exported register with two columns filled in looks like.
 */
const WARNINGS_BY_MODE: Record<CameraImportMode, CameraImportIssue[]> = {
  "add": [],
  // Nothing is merely a warning here. A row with no coordinates has nothing to fill, and a row
  // naming no registered camera has nothing to fill it into — both are refusals, not notes.
  "fill-coordinates": [],
};

/** @deprecated Read WARNINGS_BY_MODE through isBlocking — kept so existing callers keep compiling. */
export const CAMERA_IMPORT_WARNINGS: CameraImportIssue[] = WARNINGS_BY_MODE["add"];

export function isBlocking(issue: CameraImportIssue, mode: CameraImportMode = "add"): boolean {
  return !WARNINGS_BY_MODE[mode].includes(issue);
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

/** Name, code, a stream and a position. A row missing any of them is a line in a spreadsheet
 *  rather than a source: without the stream there is nothing to watch, and without the coordinates
 *  the camera's detections count toward no district (see WARNINGS_BY_MODE). Demanded as COLUMNS so
 *  a file that never had a survey in it is refused at the door, with the missing headings named,
 *  instead of three hundred rows each carrying the same error. */
const REQUIRED: CameraColumnKey[] = ["name", "code", "rtspUrl", "lat", "lng"];

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
  mode: CameraImportMode = "add",
): CameraParseResult {
  // "fill-coordinates" reads two things and ignores the rest, so it must not demand the rest. The
  // file this mode is built for is the register exported back out with the survey pasted in, and
  // asking that file for an RTSP URL it already has on record is how a working path gets refused.
  const required = mode === "add" ? REQUIRED : (["code", "lat", "lng"] as CameraColumnKey[]);
  if (table.length === 0) return { rows: [], missingColumns: [...required], unmappedHeaders: [] };

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

  const missingColumns = required.filter(k => columnOf[k] === undefined);
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

    // Name and stream are what "add" needs and what "fill-coordinates" never touches.
    if (mode === "add" && !name) issues.push("missing-name");
    if (!code) issues.push("missing-code");
    if (mode === "add" && !rtspUrl) issues.push("missing-rtsp");

    const key = code.toLowerCase();
    if (code) {
      // The register check reverses with the mode, and it is the same fact read two ways: in
      // "add" a known code is a collision; in "fill-coordinates" a known code is the match, and an
      // UNKNOWN one is the problem. A row naming a camera we do not have cannot be filled in, and
      // quietly adding it would turn a survey paste into a registration — the file carries no
      // stream for it, so it would create a camera that can never connect.
      const known = takenInRegister.has(key);
      if (known && mode === "add") issues.push("duplicate-in-register");
      if (!known && mode === "fill-coordinates") issues.push("not-in-register");
      // Checked in both modes: one code twice in one file is ambiguous either way. Two rows
      // claiming to survey the same camera do not agree on where it is.
      if (seenInFile.has(key)) issues.push("duplicate-in-file");
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

/**
 * Rows that can actually be committed — nothing blocking for this mode. Warnings do not disqualify.
 *
 * Note the arrow: `.some(isBlocking)` passes Array.prototype's index as the second argument, so a
 * bare reference would hand `1` to the `mode` parameter. The compiler catches it here because the
 * types disagree, which is the only reason `mode` is not optional-by-accident.
 */
export function importableRows(rows: ParsedCameraRow[], mode: CameraImportMode = "add"): ParsedCameraRow[] {
  return rows.filter(r => !r.issues.some(i => isBlocking(i, mode)));
}

export { decodeSpreadsheetBytes, looksLikeXlsx, parseDelimited } from "./rosterImport";
