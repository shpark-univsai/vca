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
 * PHOTOGRAPHS COME BESIDE THE FILE, NOT IN IT, AND THE SHEET USUALLY NEED NOT MENTION THEM.
 *
 * A CSV cannot hold an image, so the images are picked in the same step and matched by file name.
 * What the file name is matched AGAINST is where the products differ, and the owner's question is
 * the right one (2026-09-21: 보통 다른 서비스들에서도 이렇게 템플릿에 제목 적게 해? 번거로울것
 * 같은뎅?). Typing a file name per person is the minority shape:
 *
 *   - Verkada's bulk image upload has NO column and no mapping file at all — the image is named
 *     `[email].jpg`, `[user id].jpg` or `[external id].jpg`, 500 per batch, and a file that matches
 *     nobody is an error the operator resolves before proceeding.
 *   - HikCentral's batch enrolment: "The naming rule of photo is: Person Name, Person ID, or
 *     Person Name_ID." A folder or a ZIP, no sheet.
 *   - CloudBadging names each image after the record's ID number.
 *   - ID123 and SAP SuccessFactors are the other camp: the sheet carries the photo file name and
 *     the ZIP must match it exactly, extension included.
 *   - Genetec's CSV carries a filesystem PATH, which is the one shape we cannot copy: a browser
 *     cannot read a path off the operator's disk, only a file they hand it.
 *
 * So the default here is the majority one, and the only field a VIP has is the name: an image
 * called `홍길동.jpg` lands on 홍길동 with nothing typed anywhere. The `사진 파일명` column stays
 * as the OVERRIDE, for the folder that came off a camera as `IMG_0342.jpg` — which is the case the
 * name convention cannot serve and the reason the column is not simply deleted.
 *
 * A name is not a key in this registry (see WARNINGS below), so matching on it would be a guess if
 * one file could land on two people. It cannot: a name repeated inside one file already blocks its
 * second row, so at most one importable row answers to any name.
 *
 * The three things this can say about a face are all NOTES rather than refusals: the sheet named an
 * image that was not picked, two rows named the same image, or nothing matched at all — and that
 * last one is not even said, because most lists are half without photographs. A row with no face
 * still belongs on the list and lands in the registry's 사진 없음 count. WHAT IT WILL NOT DO is
 * enrol one image as two people: the second row keeps its name and loses the photo, because one
 * face registered as two identities alerts twice and the registry counts it as a duplicate
 * enrolment.
 *
 * What this file still cannot judge is whether an image holds a readable face. That is the model's
 * answer, it arrives after enrolment, and a preview that guessed at it would be inventing the one
 * fact this screen exists to collect.
 *
 * Nothing here touches the store. It turns a file into rows plus a per-row verdict; committing them
 * is the caller's job, in one addPersons call.
 */

import { normalizeHeader } from "./rosterImport";

/** Why a row cannot be imported, or needs saying out loud. A row can collect several. */
export type VipImportIssue =
  | "missing-name"
  | "duplicate-in-file"
  | "duplicate-in-registry"
  | "photo-not-found"
  | "photo-used-twice"
  | "photo-ambiguous";

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
const WARNINGS: VipImportIssue[] = ["duplicate-in-registry", "photo-not-found", "photo-used-twice", "photo-ambiguous"];

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
  /** The image file this row asked for BY NAME, as the sheet spelt it, or "" — in which case the
   *  person's own name is what the picked images are matched against. */
  photoFile: string;
  /** The picked image this row got, set by attachVipPhotos. Absent means this person imports with
   *  no face — either the sheet named none, or it named one that was not among the files. */
  photo?: File;
  issues: VipImportIssue[];
}

export type VipColumnKey = "name" | "description" | "photoFile";

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
  // "file" and "파일" are in here on purpose: a sheet with one image column heads it that way as
  // often as it spells out "photo file name", and there is no other file this importer reads.
  photoFile: ["photo", "photofile", "photofilename", "photoname", "image", "imagefile", "imagefilename",
    "picture", "picturefile", "file", "filename", "사진", "사진파일", "사진파일명", "사진이름", "이미지", "이미지파일", "파일", "파일명"],
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
  // NFC for the reason normalizeForMatch gives below: a list assembled on a Mac and a list typed in
  // Windows spell the same Korean name with different bytes, and "the same name twice" has to see
  // through that as well — otherwise one file can carry a person twice and alert twice.
  return name.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
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
    const photoFile = at("photoFile");
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

    return { line, name, description, photoFile, issues };
  })
  // A trailing newline, or a row of nothing but delimiters, is not a record — reporting it as a
  // missing name is the importer complaining about its own parsing. parseDelimited drops the
  // all-empty ones already; this catches a row whose cells are whitespace.
  .filter(r => !(r.name === "" && r.description === "" && r.photoFile === ""));

  return { rows, missingColumns: [], unmappedHeaders, headerDetected };
}

/**
 * The keys a picked image answers to: its own name, and its name without the extension.
 *
 * Case and surrounding space are folded, because a sheet typed by hand says `Hong.JPG` for a file
 * called `hong.jpg` and they are one image. The extension is kept in the first key, so the ID123
 * rule ("the name in the sheet matches the file, extension included") wins where the sheet spelt it
 * out; the extension-less key is what both the looser sheet and the name convention match on.
 *
 * Separators fold too — space, hyphen, underscore, dot — so `hong-gildong.jpg`, `hong_gildong.jpg`
 * and `Hong Gildong.jpg` all answer for a person called Hong Gildong. HikCentral asks for a plus
 * sign between the two halves of a name; folding every separator accepts that spelling and the
 * three obvious others rather than making the operator learn ours. It cannot make two different
 * people collide into one key without those people already having the same name, which blocks its
 * own second row.
 */
/**
 * COMPOSED FIRST, and this is not a nicety — it is the difference between a photograph landing and
 * disappearing in exactly the environment this console ships into.
 *
 * macOS stores Korean file names DECOMPOSED (NFD: ㅎ + ㅏ + ㄴ …), and a zip made in Finder carries
 * them that way. A sheet typed in Excel on Windows holds the same name COMPOSED (NFC: 한). The two
 * are different byte sequences, they compare unequal, and they render identically — so the failure
 * is invisible: the preview lists `한가람.png` under "unused photos" beside a row called 한가람 and
 * the reader has nothing to look at that would tell them why.
 *
 * Measured before fixing (headless Chrome, a Finder-made zip with an NFD name): 0 of 2 rows matched,
 * the file reported as unused, its name on screen indistinguishable from the row's.
 *
 * Normalising both sides to NFC is the whole fix. It goes here rather than at the zip reader so the
 * screen keeps printing the name the archive actually holds; only the comparison is normalised.
 */
function normalizeForMatch(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function foldSeparators(value: string): string {
  return normalizeForMatch(value).replace(/[\s._+-]+/g, "");
}

/**
 * Every spelling one image answers to, MOST SPECIFIC FIRST.
 *
 * The path is a key before the last segment is, which is what lets a sheet settle the one question
 * an archive can pose and a bare file name cannot: `images/a/nadia.jpg` and `images/b/nadia.jpg`
 * are two different faces with one name. A row that writes the path gets its own file; a row that
 * writes `nadia.jpg` gets told there are two (see the ambiguity handling in attachVipPhotos)
 * rather than being handed whichever the file dialog listed first.
 *
 * Order matters and is relied on: the lookup takes the first key that resolves, so a specific
 * answer is never lost to a general one.
 */
function photoKeys(fileName: string): string[] {
  const full = normalizeForMatch(fileName);
  const last = full.split("/").pop() ?? full;
  const stripExtension = (value: string) => {
    const dot = value.lastIndexOf(".");
    return dot > 0 ? value.slice(0, dot) : value;
  };
  const keys = [full, stripExtension(full), last, stripExtension(last), foldSeparators(stripExtension(last))];
  // Deduped, because a file with no folder produces the same string twice and a key that appears
  // twice in one file's list would otherwise look like two files colliding.
  return [...new Set(keys)];
}

/** What a row answers to when the sheet named no file: the person's own name, folded the same way
 *  a file name is, so `홍길동.jpg` and `Hong-Gildong.JPG` both find their person. */
function nameKeys(name: string): string[] {
  return [normalizeForMatch(name), foldSeparators(name)];
}

export interface VipPhotoAttachResult {
  rows: ParsedVipRow[];
  /** Images that were picked and that no row asked for, by file name. Reported because the reader
   *  chose these files deliberately: forty names and thirty-nine photos is a typo they want to
   *  find before the import, not a silent difference of one. */
  unusedFiles: string[];
}

/**
 * Hand the picked images to the rows that named them.
 *
 * Pure, and it replaces rather than mutates, so the preview can be recomputed when the reader adds
 * more files — which is the normal way this is used: pick the sheet, see four rows missing their
 * photo, pick the rest, and the same four lines answer again.
 *
 * Photo issues are recomputed from scratch each time for the same reason: an earlier pass that
 * reported "file not found" must not leave that sentence on a row whose file has since arrived.
 */
export function attachVipPhotos(rows: ParsedVipRow[], files: File[]): VipPhotoAttachResult {
  const byKey = new Map<string, File>();
  /**
   * Keys that more than one image answers to — `nadia.jpg` when the archive holds
   * `images/a/nadia.jpg` and `images/b/nadia.jpg`.
   *
   * THESE ATTACH NOTHING. Handing over the first one is a guess, and the thing being guessed at is
   * which face belongs to a name in a face-recognition watchlist: the wrong one alerts on the
   * wrong person for as long as nobody notices, and nothing on the screen would have said so.
   * Declining and naming both paths costs the operator one rename and tells them the truth.
   *
   * Two copies of the SAME image in two folders would also land here, and they are not compared
   * byte for byte to find out — a length is not proof of sameness, reading both is work for a case
   * far rarer than two people with a common name, and the repair is the same rename either way.
   */
  const ambiguous = new Set<string>();
  files.forEach(f => {
    photoKeys(f.name).forEach(k => {
      const held = byKey.get(k);
      if (!held) byKey.set(k, f);
      else if (held !== f) ambiguous.add(k);
    });
  });

  /** The first key that resolves, and whether it resolved to a crowd. */
  const lookup = (candidates: string[]): { file?: File; ambiguous?: boolean } => {
    for (const key of candidates) {
      if (ambiguous.has(key)) return { ambiguous: true };
      const file = byKey.get(key);
      if (file) return { file };
    }
    return {};
  };

  const used = new Set<File>();
  const photo: (File | undefined)[] = rows.map(() => undefined);
  const extra: VipImportIssue[][] = rows.map(() => []);

  /*
   * TWO PASSES, AND WHAT THE SHEET SAID GOES FIRST.
   *
   * An explicit file name is an instruction; a name match is a convention. In one pass the
   * convention would win whenever its row came first — row 2 called 김하나 would take `하나.jpg`
   * and row 9, which asked for `하나.jpg` by name, would be told its file was never picked. So
   * every named file is handed out before any name is tried.
   */
  rows.forEach((row, i) => {
    if (!row.photoFile) return;
    const { file: match, ambiguous: crowded } = lookup(photoKeys(row.photoFile));
    if (crowded) { extra[i] = ["photo-ambiguous"]; return; }
    if (!match) { extra[i] = ["photo-not-found"]; return; }
    // ONE FACE IS NOT TWO PEOPLE. The first row keeps the image; the rest keep their names and
    // import with no face, which is a state the registry already knows how to show.
    if (used.has(match)) { extra[i] = ["photo-used-twice"]; return; }
    used.add(match);
    photo[i] = match;
  });

  /* NO COLUMN, NO PROBLEM: the person's own name is tried against the picked images, which is all
     the operator has to do in most of the products this was modelled on — name the photos after
     the people. Nothing is said when it finds nothing: a list where half the people have no
     photograph is the normal state of this registry, and a note on every such row would bury the
     rows that DID ask for a file and missed it. */
  rows.forEach((row, i) => {
    if (row.photoFile || !row.name) return;
    const { file: match, ambiguous: crowded } = lookup(nameKeys(row.name));
    /* SAID here, unlike a plain miss. Nothing found is the normal state of half a watchlist; two
       files found is an archive that holds this person's face twice over and a screen that has
       decided not to choose — the reader has to know, or the row looks like one of the ordinary
       ones with no photograph. */
    if (crowded) { extra[i] = ["photo-ambiguous"]; return; }
    if (!match) return;
    if (used.has(match)) { extra[i] = ["photo-used-twice"]; return; }
    used.add(match);
    photo[i] = match;
  });

  const next = rows.map((row, i) => ({
    ...row,
    photo: photo[i],
    // Recomputed from scratch, so a note left by an earlier pick cannot survive the file arriving.
    issues: [...row.issues.filter(is => !is.startsWith("photo-")), ...extra[i]],
  }));

  return { rows: next, unusedFiles: files.filter(f => !used.has(f)).map(f => f.name) };
}

/** Rows that can actually be committed — nothing blocking. Warnings do not disqualify. */
export function importableRows(rows: ParsedVipRow[]): ParsedVipRow[] {
  return rows.filter(r => !r.issues.some(isBlocking));
}

export { decodeSpreadsheetBytes, looksLikeXlsx, parseDelimited } from "./rosterImport";
