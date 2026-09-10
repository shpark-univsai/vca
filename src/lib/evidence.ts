/**
 * Taking one detection out of the console.
 *
 * Until now the only way to hand a sighting to an investigator, a prosecutor or an internal
 * report was to photograph the screen. A screenshot loses everything that makes the sighting
 * mean anything — which camera, what the site's clock said, what the match score was, who was
 * being looked for, who looked, and on whose say-so it was accepted or rejected. This assembles
 * that instead.
 *
 * WHAT THIS CANNOT DO, and why it does not pretend to:
 *
 * The frame itself is not in the bundle and is not hashed here. The browser holds a copy of an
 * image it fetched over the network; hashing that copy proves the copy, not the capture. An
 * evidentiary hash has to be taken where the frame is written — at the camera or at the server
 * that received it — and travel with the frame from there. A digest computed in this file and
 * labelled "frame hash" would be the most dangerous line in the product: it looks like
 * provenance and is not.
 *
 * So the manifest hashes ITSELF. That is a real and useful thing: it detects a manifest edited
 * after export, which is what you actually want when a file is mailed around. The frame's own
 * digest is left as an explicit null with a note, so nobody reads its absence as an oversight.
 *
 * HANDOFF NOTE — what the server has to own:
 *   1. `frame_sha256`, computed at capture and stored with the frame, never recomputed downstream.
 *   2. The frame bytes themselves, served through an authenticated endpoint so the bundle can
 *      include them rather than a URL that expires or leaks.
 *   3. A signature over the manifest, so it is not just intact but attributable to this install.
 *   4. The extraction record. `recordEvidenceExport` in the store writes it client-side, which is
 *      a note to ourselves, not an audit trail — the export has to be a server call that logs
 *      before it returns bytes. Otherwise the one action worth auditing is the one nobody sees.
 */

export interface EvidenceSubject {
  /** Which screen it was taken from. */
  surface: "redmap" | "bestframe";
  /** The sighting's own id — the same one a judgement is filed against. */
  subjectId: string;
  /** Camera code from the register, when the sighting carries one. */
  cameraCode?: string;
  /** Human-readable place, as the register spells it. */
  location: string;
  /** Site-local date and time — the site's clock, not the reader's. */
  siteDate: string;
  siteTime: string;
  /** The zone those two are counted in, named so the pair is unambiguous elsewhere. */
  timeZone: string;
  /** Match score as the screen showed it, e.g. "99.7%". Absent where nothing was compared. */
  similarity?: string;
  /** Who or what was being searched for. */
  targetLabel: string;
  /** Where the frame lives. A reference, not the frame — see the note above. */
  frameRef: string;
  /** The operator's call on this sighting, if one has been made. */
  verdict?: string;
  verdictBy?: string;
  verdictAt?: string;
}

export interface EvidenceContext {
  projectName: string;
  /** The account that pressed the button. From the session in the real thing. */
  operator: string;
  /** Declared purpose for the look-up, once the app collects one. Null until then. */
  purpose: string | null;
}

export interface EvidenceManifest {
  vca_evidence: "1";
  exported_at: string;
  project: string;
  exported_by: string;
  purpose: string | null;
  detection: {
    id: string;
    surface: string;
    camera_code: string | null;
    location: string;
    site_date: string;
    site_time: string;
    time_zone: string;
    similarity: string | null;
    searched_for: string;
    frame_ref: string;
  };
  operator_judgement: {
    verdict: string;
    by: string;
    at: string;
  } | null;
  integrity: {
    manifest_sha256: string;
    frame_sha256: null;
    notes: string[];
  };
}

/** Hex SHA-256 of a string, via the platform digest. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const INTEGRITY_NOTES = [
  "manifest_sha256 covers this file with the integrity block removed. It detects a manifest altered after export.",
  "frame_sha256 is null on purpose. The frame's digest has to be taken where the frame is captured and stored; a hash computed by the exporting browser would describe its own copy, not the capture.",
  "This bundle is not signed. Nothing here proves which installation produced it.",
];

/**
 * The manifest for one detection.
 *
 * Two-pass on purpose: the body is serialised and hashed first, then the digest is written into
 * a block that was not part of what was hashed. A hash that covered itself could not be checked.
 */
export async function buildEvidenceManifest(
  subject: EvidenceSubject,
  context: EvidenceContext,
  exportedAt: Date = new Date(),
): Promise<EvidenceManifest> {
  const body = {
    vca_evidence: "1" as const,
    exported_at: exportedAt.toISOString(),
    project: context.projectName,
    exported_by: context.operator,
    purpose: context.purpose,
    detection: {
      id: subject.subjectId,
      surface: subject.surface,
      camera_code: subject.cameraCode ?? null,
      location: subject.location,
      site_date: subject.siteDate,
      site_time: subject.siteTime,
      time_zone: subject.timeZone,
      similarity: subject.similarity ?? null,
      searched_for: subject.targetLabel,
      frame_ref: subject.frameRef,
    },
    operator_judgement: subject.verdict && subject.verdictBy && subject.verdictAt
      ? { verdict: subject.verdict, by: subject.verdictBy, at: subject.verdictAt }
      : null,
  };

  const manifest_sha256 = await sha256Hex(JSON.stringify(body));
  return { ...body, integrity: { manifest_sha256, frame_sha256: null, notes: INTEGRITY_NOTES } };
}

/** `vca-evidence-<id>-<yyyymmdd-hhmm>.json`, so a folder of these sorts usefully. */
export function evidenceFilename(subjectId: string, exportedAt: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${exportedAt.getFullYear()}${p(exportedAt.getMonth() + 1)}${p(exportedAt.getDate())}`
    + `-${p(exportedAt.getHours())}${p(exportedAt.getMinutes())}`;
  return `vca-evidence-${subjectId}-${stamp}.json`;
}

/** Hands the file to the browser. Returns what was written, so the caller can log it. */
export function saveManifest(manifest: EvidenceManifest, filename: string): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoked on the next tick rather than immediately: Safari has not always finished reading the
  // blob by the time click() returns, and a revoked URL there produces an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
