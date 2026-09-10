/**
 * Reading a staff roster out of a spreadsheet file.
 *
 * FORMAT: delimited text (CSV/TSV), not .xlsx. An .xlsx file is a zip of XML parts and needs a
 * parser the size of every other dependency in this project put together — for one button, next to
 * an Export CSV button that already writes exactly the shape this reads. So the round trip is
 * export -> edit in Excel -> "Save as CSV UTF-8" -> import, and `looksLikeXlsx` below exists so the
 * person who drags the .xlsx in anyway gets told that in one sentence instead of a screen of
 * mojibake. If real .xlsx becomes a requirement, only `readSpreadsheetFile` changes.
 *
 * Nothing here touches the store. It turns a file into rows plus a per-row verdict; committing them
 * is the caller's job, one addRosterEntry at a time.
 */


/** Why a row cannot be imported. A row can collect several. */
export type ImportIssue =
  | "missing-name"
  | "missing-employee-id"
  | "duplicate-in-file"
  | "duplicate-in-roster"
  | "bad-permission"
  | "bad-email";

export interface ParsedRow {
  /** 1-based line number in the source file, so the error list points at something the person can
   *  find in Excel. Counts the header row, and counts a quoted field's embedded newlines. */
  line: number;
  name: string;
  employeeId: string;
  department?: string;
  email?: string;
  permission: "admin" | "operator";
  /** Empty means importable. */
  issues: ImportIssue[];
}

export type ColumnKey = "name" | "employeeId" | "department" | "email" | "permission";

export interface ParseResult {
  rows: ParsedRow[];
  /** Which of the two required columns the header row did not offer. Non-empty = nothing to import;
   *  the file is the wrong file, not a file with bad rows. */
  missingColumns: ColumnKey[];
  /** Headers we could not map to a field, reported so a misspelled column reads as "this column was
   *  ignored" rather than silently dropping everyone's department. */
  unmappedHeaders: string[];
}

/**
 * Header synonyms, per field. Matched after normalisation (case, spaces, punctuation and the
 * fullwidth forms Excel likes to leave behind all removed), so "Employee ID", "employee_id",
 * "사원 번호" and "사번" all land on the same field.
 *
 * Both languages in one list rather than a dictionary lookup: the file was not necessarily made by
 * the person importing it, and a Korean roster gets imported from an English-language Portal often
 * enough that keying this off the UI language would be the wrong guess half the time.
 */
const HEADER_SYNONYMS: Record<ColumnKey, string[]> = {
  name: ["name", "fullname", "staffname", "employeename", "이름", "성명", "직원명", "사원명"],
  employeeId: ["employeeid", "employeeno", "employeenumber", "staffid", "id", "사번", "사원번호", "직원번호", "사원코드"],
  department: ["department", "dept", "team", "부서", "소속", "팀"],
  email: ["email", "mail", "emailaddress", "이메일", "메일", "전자우편"],
  permission: ["permission", "role", "accesslevel", "권한", "역할", "등급"],
};

/**
 * Both spellings of both values. The roster used to call the app-only option "Operator" / "운영자"
 * and now calls it "App user" / "앱 사용자" — a roster exported before that rename is still a file
 * somebody is about to import, so the old words stay readable forever.
 */
const PERMISSION_VALUES: Record<string, "admin" | "operator"> = {
  admin: "admin", administrator: "admin", owner: "admin", portalapp: "admin", portaladmin: "admin",
  관리자: "admin", 어드민: "admin", 운영관리자: "admin", 포털앱: "admin", 포털관리자: "admin",
  operator: "operator", user: "operator", member: "operator", staff: "operator",
  appuser: "operator", apponly: "operator", app: "operator",
  운영자: "operator", 오퍼레이터: "operator", 사용자: "operator", 일반: "operator",
  앱사용자: "operator", 앱만: "operator", 앱: "operator",
};

/** Exported because the camera importer matches its own headings the same way — one rule for
 *  what counts as "the same column name" across both files. */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .toLowerCase()
    // Everything that is not a letter or a digit in any script — spaces, underscores, dots,
    // parentheses, the fullwidth punctuation a Korean Excel leaves in a header.
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * A file Excel saved as .xlsx (or the old .xls), rather than as CSV.
 *
 * Checked by content, not only by extension: the extension is the common case but a file renamed to
 * .csv is the confusing one, and both .xlsx (a zip — "PK\x03\x04") and .xls (an OLE2 compound file)
 * have a signature worth two bytes of reading.
 */
export function looksLikeXlsx(fileName: string, head: Uint8Array): boolean {
  if (/\.xlsx?$/i.test(fileName)) return true;
  if (head[0] === 0x50 && head[1] === 0x4b) return true; // PK — zip, i.e. xlsx
  if (head[0] === 0xd0 && head[1] === 0xcf) return true; // OLE2 — legacy xls
  return false;
}

/**
 * Decode the file's bytes to text.
 *
 * UTF-8 first, EUC-KR second. Excel for Windows still writes CP949 when a Korean user picks plain
 * "CSV" instead of "CSV UTF-8", and that file decoded as UTF-8 is not slightly wrong, it is every
 * Korean name replaced by U+FFFD. `fatal: true` turns that into a throw we can catch, which is the
 * whole reason to do it in this order — a lenient UTF-8 decode never fails, it just quietly ruins
 * the data.
 */
export function decodeSpreadsheetBytes(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("euc-kr").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

/**
 * RFC4180-ish reader: quoted fields, "" for a literal quote inside one, CRLF or LF line endings,
 * and embedded newlines inside quotes. Written out rather than split(",") because a department
 * field with a comma in it is not an exotic input, it is Tuesday.
 *
 * Returns the delimiter's cells plus the source line each row started on.
 */
export function parseDelimited(text: string): { cells: string[]; line: number }[] {
  // Tab-separated if the first line has tabs and no commas — that is what "paste from Excel" and a
  // .tsv export both look like.
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delimiter = !firstLine.includes(",") && firstLine.includes("\t") ? "\t" : ",";

  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const endField = () => { cells.push(field.trim()); field = ""; };
  const endRow = () => {
    endField();
    // A trailing newline, or a row of nothing but delimiters, is not a record.
    if (cells.some(c => c !== "")) rows.push({ cells, line: rowStartLine });
    cells = [];
    rowStartLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { endField(); continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { line++; endRow(); rowStartLine = line; continue; }
    field += ch;
  }
  if (field !== "" || cells.length > 0) endRow();

  return rows;
}

/**
 * Turn parsed cells into roster rows with a verdict on each.
 *
 * `existingEmployeeIds` must be every id in the store, not just this project's: addRosterEntry
 * refuses a duplicate across the whole roster, so scoping this to the current project would show a
 * green preview for rows the store then silently rejects.
 */
export function buildImportRows(
  table: { cells: string[]; line: number }[],
  existingEmployeeIds: string[],
): ParseResult {
  if (table.length === 0) return { rows: [], missingColumns: ["name", "employeeId"], unmappedHeaders: [] };

  const [header, ...body] = table;
  const columnOf: Partial<Record<ColumnKey, number>> = {};
  const unmappedHeaders: string[] = [];

  header.cells.forEach((raw, i) => {
    const norm = normalizeHeader(raw);
    const key = (Object.keys(HEADER_SYNONYMS) as ColumnKey[])
      .find(k => HEADER_SYNONYMS[k].includes(norm));
    // First column wins a duplicate heading — a second "Name" is a stray column, not a correction.
    if (key && columnOf[key] === undefined) columnOf[key] = i;
    else if (raw.trim() !== "") unmappedHeaders.push(raw.trim());
  });

  const missingColumns = (["name", "employeeId"] as ColumnKey[]).filter(k => columnOf[k] === undefined);
  if (missingColumns.length > 0) return { rows: [], missingColumns, unmappedHeaders };

  const takenInRoster = new Set(existingEmployeeIds.map(id => id.toLowerCase()));
  const seenInFile = new Set<string>();

  const rows = body.map(({ cells, line }) => {
    const at = (key: ColumnKey) => {
      const i = columnOf[key];
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };

    const name = at("name");
    const employeeId = at("employeeId");
    const department = at("department");
    const email = at("email");
    const permissionRaw = at("permission");

    const issues: ImportIssue[] = [];
    if (!name) issues.push("missing-name");
    if (!employeeId) issues.push("missing-employee-id");

    const key = employeeId.toLowerCase();
    if (employeeId) {
      if (takenInRoster.has(key)) issues.push("duplicate-in-roster");
      else if (seenInFile.has(key)) issues.push("duplicate-in-file");
      else seenInFile.add(key);
    }

    // Blank permission is not an error: least privilege is the safe reading of an empty cell, and
    // the preview shows the resolved value so the default is visible rather than assumed. A value
    // that is present but unrecognised IS an error — it means something the file's author intended.
    let permission: "admin" | "operator" = "operator";
    if (permissionRaw) {
      const resolved = PERMISSION_VALUES[normalizeHeader(permissionRaw)];
      if (resolved) permission = resolved;
      else issues.push("bad-permission");
    }

    // Deliberately loose. This address is where a registration code may be mailed, and the only
    // thing worth refusing here is a cell that plainly is not an address — a stricter pattern
    // rejects valid addresses and teaches people to leave the column out.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("bad-email");

    return { line, name, employeeId, department: department || undefined, email: email || undefined, permission, issues };
  });

  return { rows, missingColumns: [], unmappedHeaders };
}

