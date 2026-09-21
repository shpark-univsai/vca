/**
 * Reading a .zip in the browser, with no library.
 *
 * WHY THIS EXISTS. The bulk importers take a table and, for VIPs, a set of face photographs — and
 * the shape every product that does this hands the operator is one archive (owner, 2026-09-21:
 * "zip압축 파일로 업로드하라고하던데 보통.."):
 *
 *     watchlist_import.zip
 *     ├── data.csv
 *     └── images/
 *         ├── nadia.jpg
 *         └── terence.jpg
 *
 * HikCentral takes a folder or a ZIP of faces; ID123 takes the roster then a photo ZIP whose names
 * the sheet must match. Picking a sheet and then multi-selecting a folder of images works and stays
 * (it is the shorter path when the files are already loose on a desktop), but the archive is what
 * somebody is handed by whoever assembled the list, and asking them to unpack it first is asking
 * them to do the computer's job.
 *
 * WHY NOT A LIBRARY. A zip's own structure is a central directory of fixed-width records, and the
 * only compression in practice is raw deflate — which every browser now inflates natively through
 * DecompressionStream("deflate-raw"). So this is a reader, not an implementation of zip: about a
 * hundred lines against a dependency in a repo that has none for this.
 *
 * WHAT IT REFUSES, by name rather than by throwing: an encrypted archive, a member compressed with
 * anything but store or deflate, ZIP64 (four gigabytes of face photographs is not this flow), and a
 * file whose directory does not parse. Each of those is a sentence the screen can say; a thrown
 * error is not.
 *
 * ENTRY NAMES CARRY THE SAME KOREAN PROBLEM AS THE CSV ITSELF. A zip records whether its names are
 * UTF-8 (general-purpose bit 11); the Windows built-in compressor does not set it and writes CP949,
 * so a photograph called 홍길동.jpg arrives as mojibake and matches nobody. Decoded the way
 * decodeSpreadsheetBytes decodes a sheet — strict UTF-8, then EUC-KR — for exactly that reason.
 */

export interface ZipEntry {
  /** The name as the archive records it, path included ("images/nadia.jpg"). */
  path: string;
  /** The last segment of the path — what a file name is matched on everywhere else. */
  name: string;
  bytes: Uint8Array;
}

export type ZipProblem = "not-zip" | "encrypted" | "unsupported-compression" | "zip64" | "corrupt";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** PK\x03\x04 — shared with .xlsx, which is also a zip. See isSpreadsheetArchive. */
export function looksLikeZip(head: Uint8Array): boolean {
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/**
 * An .xlsx (or .docx, .pptx) rather than a folder somebody zipped.
 *
 * Both are zips, so the signature cannot tell them apart and the extension lies as often as not.
 * These two members are in every OOXML package and in nothing a person assembles by hand.
 */
export function isSpreadsheetArchive(entries: ZipEntry[]): boolean {
  return entries.some(e => e.path === "[Content_Types].xml" || e.path.startsWith("xl/"));
}

function decodeEntryName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The archive's members, or the one word that says why there are none.
 *
 * Directories, the __MACOSX sidecar tree and dot-files are dropped here rather than by every
 * caller: a zip made on a Mac carries a `__MACOSX/._nadia.jpg` beside every real photograph, and a
 * caller that counted members would report twice as many images as the archive shows.
 */
export async function readZipArchive(buffer: ArrayBuffer): Promise<{ entries: ZipEntry[] } | { problem: ZipProblem }> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (buffer.byteLength < 22 || !looksLikeZip(bytes.subarray(0, 4))) return { problem: "not-zip" };

  // The end-of-central-directory record is last, except for a trailing comment of up to 64KB.
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) { eocd = i; break; }
  }
  if (eocd < 0) return { problem: "corrupt" };

  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  // 0xFFFF/0xFFFFFFFF are the "look in the ZIP64 record" sentinels.
  if (entryCount === 0xffff || centralOffset === 0xffffffff) return { problem: "zip64" };
  if (centralOffset >= buffer.byteLength) return { problem: "corrupt" };

  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > buffer.byteLength || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return { problem: "corrupt" };
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const path = decodeEntryName(bytes.subarray(cursor + 46, cursor + 46 + nameLength), (flags & 0x800) !== 0);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) return { problem: "encrypted" };
    const name = path.split("/").pop() ?? path;
    // Dropped, and before the compression check: a directory member is stored with no data, and a
    // Mac's sidecar files would otherwise decide the whole archive is unsupported.
    if (path.endsWith("/") || path.startsWith("__MACOSX/") || name.startsWith(".") || name === "") continue;
    if (method !== 0 && method !== 8) return { problem: "unsupported-compression" };

    // The local header repeats the name and extra field, and its extra field can differ in length
    // from the central one — so the data offset is computed from the local record, not the central.
    if (localOffset + 30 > buffer.byteLength || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) return { problem: "corrupt" };
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > buffer.byteLength) return { problem: "corrupt" };
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    try {
      entries.push({ path, name, bytes: method === 0 ? raw : await inflateRaw(raw) });
    } catch {
      return { problem: "corrupt" };
    }
  }

  return { entries };
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
const TABLE_EXTENSIONS = ["csv", "tsv", "txt"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isImageEntry(entry: ZipEntry): boolean {
  return IMAGE_EXTENSIONS.includes(extensionOf(entry.name));
}

export function isTableEntry(entry: ZipEntry): boolean {
  return TABLE_EXTENSIONS.includes(extensionOf(entry.name));
}

/** An image member as a File, so it travels through the rest of the import as a picked file does. */
export function entryToFile(entry: ZipEntry): File {
  const ext = extensionOf(entry.name);
  const type = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext ? `image/${ext}` : "application/octet-stream";
  // NAMED BY ITS LAST SEGMENT, not its path: `images/nadia.jpg` has to match a row that says
  // `nadia.jpg` or a person called nadia, and a leading folder would make both miss.
  return new File([entry.bytes as BlobPart], entry.name, { type });
}
