/**
 * Reading a VIP list out of a spreadsheet file.
 *
 * The registry's bulk upload wrote straight to the store: pick a file, and two hundred people were
 * registered before anything was shown. The camera import had already been through this and came
 * out the other side with a preview — file-level error, per-row verdict, a count of what will go in
 * and a confirm button that names it — so this is that same pair, one library plus one modal, for
 * the file with names in it. Read cameraImport.ts beside this one; the shapes are deliberately the
 * same so the two importers read as one thing.
 *
 * Format and parsing are shared with the roster and camera importers: same delimited-text-only
 * stance, same encoding sniff, same header normalisation. See rosterImport.ts for why .xlsx is out
 * of scope and what the EUC-KR fallback is for.
 *
 * WHAT THIS FILE CANNOT JUDGE, and therefore does not report: anything about a face. A CSV of
 * names carries no photographs, so every row imported here lands in the registry's 사진 없음 count
 * and no camera can match any of them until somebody enrols a face. That is a true consequence of
 * the import, worth saying on the screen — but it is not a defect in the row, so it is not an
 * issue here. Issues are things a row got wrong.
 *
 * Nothing here touches the store. It turns a file into rows plus a per-row verdict; committing them
 * is the caller's job, in one addPersons call.
 */

import { normalizeHeader } from "./rosterImport";

/** Why a row cannot be imported, or needs saying out loud. A row can collect several. */
export type VipImportIssue =
  | "missing-name"
  | "duplicate-in-file"
  | "duplicate-in-registry";

/**
 * Issues that do not block. Everything else refuses its row.
 *
 * A NAME ALREADY IN THE REGISTRY IS A NOTE, NOT A REFUSAL — and this is the one place this
 * importer's rules differ from the camera one's, so it is worth the paragraph.
 *
 * A camera code is the register's key and the id space detections are matched against, so two
 * cameras under one code is a sighting attributed to the wrong street. A person's name is not a key
 * at all: `Person.id` is, `addPersons` (vcaStore.ts) enforces no uniqueness on names, and two
 * people genuinely can be called the same thing. Refusing the row would mean this screen deciding,
 * from a name alone, that two records are one person — which is the judgement the face enrolment
 * exists to make and which a CSV gives us nothing to make it with.
 *
 * So the row imports, and the reader is told per row which name they already have, before pressing
 * the button. If it was the same person twice, they cancel and fix the file; if it was two people,
 * nothing stood in their way.
 *
 * A duplicate WITHIN one file is different and does block its second occurrence: one file listing
 * one name twice is almost always the same person pasted twice, and importing both creates two
 * identical rows that will both match the same face and alert twice. The first occurrence still
 * goes in, so the intent of the file survives.
 */
const WARNINGS: VipImportIssue[] = ["duplicate-in-registry"];

export function isBlocking(issue: VipImportIssue): boolean {
  return !WARNINGS.includes(issue);
}

export interface ParsedVipRow {
  /** 1-based line in the source file, header counted, so an error points at something the person
   *  can find in Excel. */
  line: number;
  name: string;
  /** The memo column, or "" — optional everywhere, which is why its absence is not an issue. */
  description: string;
  issues: VipImportIssue[];
}

export type VipColumnKey = "name" | "description";

export interface VipParseResult {
  rows: ParsedVipRow[];
  /** Required columns the header row named nothing for. Non-empty means the file is the wrong file
   *  rather than a right file with bad rows, and the screen should say that instead of listing
   *  every row as broken. Only ever ["name"], and only ever when the file HAS a header — see
   *  headerDetected. */
  missingColumns: VipColumnKey[];
  /** Headings we could not map, reported so a misspelt column reads as "this was ignored" rather
   *  than silently dropping every memo. */
  unmappedHeaders: string[];
  /**
   * Whether the first line was read as column names or as a person.
   *
   * A file of bare names with no header at all is the commonest thing somebody hands over, and
   * refusing it would be pedantry — so it is accepted, and the first column is read as the name.
   * The flag is reported because that decision is invisible in the preview otherwise: a header
   * spelt in words we do not know ("피보호자,사유") would appear as the first row of the table, and
   * a reader who is not told will import a person called 피보호자.
   */
  headerDetected: boolean;
}

/**
 * Header synonyms, per field. Matched after normalizeHeader, so "Full Name", "full_name" and
 * "이름" all land on the same field.
 *
 * Both languages in one list, for the reason the roster and camera importers give: the sheet was
 * probably made by somebody other than the person importing it, so keying this off the console's
 * UI language would guess wrong about half the time. These are the same words the button's old
 * inline matcher accepted, so no file that imported yesterday stops being readable today.
 */
const HEADER_SYNONYMS: Record<VipColumnKey, string[]> = {
  name: ["name", "fullname", "personname", "vipname", "이름", "성명", "성함", "대상자"],
  description: ["description", "memo", "note", "notes", "remark", "remarks", "메모", "비고", "설명", "사유"],
};

/**
 * The comparison key for "the same name twice".
 *
 * Case and inner spacing are folded, because "HONG GILDONG", "Hong Gildong" and "Hong  Gildong"
 * are one person pasted three ways rather than three people. Nothing else is folded — this only
 * ever raises a note or refuses a repeat inside one file, so being slightly eager is cheap, while
 * folding harder (dropping spaces entirely, say) would start calling different people the same.
 */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Turn parsed cells into VIP rows with a verdict on each.
 *
 * `existingNames` is what this project's registry already holds. Project-scoped on purpose, unlike
 * the camera importer's register-wide code check: a VIP listing belongs to one site, addPersons
 * writes it with that projectId, and two sites holding a person of the same name is not a
 * collision — it is two cities each watching for their own visitor.
 */
export function buildVipImportRows(
  table: { cells: string[]; line: number }[],
  existingNames: string[],
): VipParseResult {
  if (table.length === 0) {
    return { rows: [], missingColumns: ["name"], unmappedHeaders: [], headerDetected: false };
  }

  const mapped = table[0].cells.map(raw => {
    const norm = normalizeHeader(raw);
    return (Object.keys(HEADER_SYNONYMS) as VipColumnKey[]).find(k => HEADER_SYNONYMS[k].includes(norm)) ?? null;
  });
  // A header row if the first line names any column we recognise. One recognised heading is
  // enough: a sheet headed "이름,담당부서" has named a column we know and two we do not, and
  // reading that line as a person would register somebody called 이름.
  const headerDetected = mapped.some(column => column !== null);

  const columnOf: Partial<Record<VipColumnKey, number>> = {};
  const unmappedHeaders: string[] = [];
  if (headerDetected) {
    mapped.forEach((key, i) => {
      // First column wins a duplicate heading — a second "Name" is a stray column, not a correction.
      if (key && columnOf[key] === undefined) columnOf[key] = i;
      else if ((table[0].cells[i] ?? "").trim() !== "") unmappedHeaders.push(table[0].cells[i].trim());
    });
  } else {
    // No header: first column is the name, second is the memo if there is one. This is the shape
    // the template writes, and the shape a pasted column of names arrives in.
    columnOf.name = 0;
    if (table[0].cells.length > 1) columnOf.description = 1;
  }

  /*
   * A HEADED FILE WITH NO NAME COLUMN IS THE WRONG FILE.
   *
   * The old inline matcher fell back to `Math.max(0, indexOf("name"))` here, which is column 0
   * whether or not column 0 holds names — so a sheet headed "메모,이름" imported every memo as a
   * person's name and threw the names away, silently and with a success toast. Refused at the door
   * now, with the missing heading named, which is what the camera importer does with the same
   * problem.
   */
  const missingColumns: VipColumnKey[] = columnOf.name === undefined ? ["name"] : [];
  if (missingColumns.length > 0) return { rows: [], missingColumns, unmappedHeaders, headerDetected };

  const takenInRegistry = new Set(existingNames.map(nameKey));
  const seenInFile = new Set<string>();

  const rows = (headerDetected ? table.slice(1) : table).map(({ cells, line }) => {
    const at = (key: VipColumnKey) => {
      const i = columnOf[key];
      return i === undefined ? "" : (cells[i] ?? "").trim();
    };

    const name = at("name");
    const description = at("description");
    const issues: VipImportIssue[] = [];

    // The only hard requirement in the whole file. addPersons stores a Person and every screen
    // that lists one lists it by name; a nameless row is a listing nobody can read, act on or
    // delete by sight.
    if (!name) issues.push("missing-name");

    const key = nameKey(name);
    if (name) {
      if (takenInRegistry.has(key)) issues.push("duplicate-in-registry");
      // Checked after the registry, and reported alongside it rather than instead of it: a name
      // that is both already listed AND repeated in the file is two separate things to say, and
      // only the second one stops the row.
      if (seenInFile.has(key)) issues.push("duplicate-in-file");
      else seenInFile.add(key);
    }

    return { line, name, description, issues };
  })
  // A trailing newline, or a row of nothing but delimiters, is not a record — reporting it as a
  // missing name is the importer complaining about its own parsing. parseDelimited drops the
  // all-empty ones already; this catches a row whose cells are whitespace.
  .filter(r => !(r.name === "" && r.description === ""));

  return { rows, missingColumns: [], unmappedHeaders, headerDetected };
}

/** Rows that can actually be committed — nothing blocking. Warnings do not disqualify. */
export function importableRows(rows: ParsedVipRow[]): ParsedVipRow[] {
  return rows.filter(r => !r.issues.some(isBlocking));
}

export { decodeSpreadsheetBytes, looksLikeXlsx, parseDelimited } from "./rosterImport";
