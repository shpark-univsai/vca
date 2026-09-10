/**
 * Reading a license file that the vendor issued.
 *
 * A license is a signed artifact, not a form. Univs.ai produces it on an offline signing machine
 * and hands it over as a file (or, at a site where carrying a file out is a policy violation, as
 * text read off a screen); this installation takes it in and starts honouring the channel count,
 * term and features written inside it. That is the whole reason `updateProjectLicense` is gone
 * from the store — see the note where it used to be. Channels and term arrive here or not at all.
 *
 * WHAT THIS MODULE DOES NOT DO: verify the signature.
 *
 * That is deliberate and it is not a gap to be filled in later by this file. The public key that
 * decides whether a license is genuine is compiled into the server binary, precisely so that it is
 * not a value the customer's own console can be pointed at a different key. A browser telling the
 * reader "signature valid" would be a claim made by the side that has no standing to make it, and
 * would read as the verdict when the server's answer is the verdict. So the screen parses the file
 * far enough to say *what it appears to contain* — a preview the reader can check against the
 * contract before installing anything — and the server decides whether it is real.
 *
 * HANDOFF NOTE: the endpoint this feeds is
 *
 *   POST /v1/projects/{id}/license      body: { armored: string }
 *   → 200 { licenseId, plan, channels, expiresAt, features[], installId, keyId, appliedAt }
 *   → 422 { reason: "bad_signature" | "unknown_key" | "malformed" | "wrong_install"
 *                 | "already_applied" | "expired_before_install", detail?: string }
 *
 * The server verifies, stores, and returns what it accepted. The reasons above are the states the
 * screen already draws — if the server needs different ones, the screen's copy changes with them.
 */

/** The claims a license carries. Mirrors the payload the vendor's issuer signs. */
export interface LicensePayload {
  schema: number;
  licenseId: string;
  issuer: string;
  issuedAt: string;
  customer: { name: string; contractRef?: string };
  binding: { mode: "install_id" | "unbound"; installId?: string };
  term: { startsAt: string; expiresAt: string | null; perpetual: boolean; supportExpiresAt?: string };
  plan: string;
  features: string[];
  limits: { channels: number; projects?: number; users?: number; watchlistEntries?: number };
  policy?: { overLimit?: string; graceDays?: number; clockAnomaly?: string };
}

/**
 * What the file says, plus the header lines a human wrote on the outside of the envelope.
 *
 * `header` is outside the signature. It exists so somebody looking at an email attachment can tell
 * what it is without decoding anything, and it is worth showing for exactly that reason — but the
 * screen has to say that editing it changes nothing, or the reader will trust the wrong half.
 */
export interface ParsedLicense {
  payload: LicensePayload;
  header: Record<string, string>;
  keyId?: string;
  /** The armored text exactly as it arrived. What gets posted; never re-serialised from `payload`. */
  armored: string;
}

export type LicenseParseError =
  | { kind: "empty" }
  | { kind: "noArmor" }
  | { kind: "notJws" }
  | { kind: "badBase64" }
  | { kind: "badJson" }
  | { kind: "missingClaims"; fields: string[] }
  | { kind: "unsupportedSchema"; schema: number };

export type LicenseParseResult =
  | { ok: true; license: ParsedLicense }
  | { ok: false; error: LicenseParseError };

const BEGIN = "-----BEGIN VCA LICENSE-----";
const END = "-----END VCA LICENSE-----";

/** The schema this build knows how to read. A newer file needs a newer install, not a guess. */
const SUPPORTED_SCHEMA = 1;

function decodeBase64Url(segment: string): string | null {
  // JWS uses base64url; atob wants base64. Pad to a multiple of four — a segment whose length is
  // 1 mod 4 cannot be padded into anything valid, which is a malformed file rather than an edge.
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 1) return null;
  try {
    const binary = atob(pad === 0 ? b64 : b64 + "=".repeat(4 - pad));
    // The payload is UTF-8 and customer names are not ASCII — "City of Singapore" survives a naive
    // read, "서울특별시" does not. Round-trip through TextDecoder rather than using atob's output.
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Pull the license out of whatever the reader pasted or dropped.
 *
 * Tolerant about the envelope and strict about the contents. People paste with the armor, without
 * it, with the mail client's quote marks in front of every line, and with the line breaks eaten;
 * none of that is the customer's mistake and refusing it teaches them to fight the box. What is
 * NOT tolerated is a payload missing claims the screen would then have to invent a display for.
 */
export function parseLicenseFile(input: string): LicenseParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: { kind: "empty" } };

  const header: Record<string, string> = {};
  let body = raw;

  const begin = raw.indexOf(BEGIN);
  const end = raw.indexOf(END);
  if (begin !== -1 && end !== -1 && end > begin) {
    body = raw.slice(begin + BEGIN.length, end);
  } else if (begin !== -1 || end !== -1) {
    // Half an envelope means a truncated copy-paste, which is worth naming: the reader's fix is to
    // copy again, not to look for a different file.
    return { ok: false, error: { kind: "noArmor" } };
  }

  // Strip mail-client quoting, then split header lines (`Key: value`) from the base64 body. The
  // blank line between them is the convention, but it does not survive every mail client either,
  // so the split is by line shape rather than by the blank.
  const lines = body
    .split(/\r?\n/)
    .map(l => l.replace(/^[>|\s]+/, "").trim())
    .filter(Boolean);

  const bodyParts: string[] = [];
  for (const line of lines) {
    const m = /^([A-Za-z][A-Za-z-]*):\s*(.+)$/.exec(line);
    // A JWS segment can contain no colon, so a line with one is a header — except that the whole
    // compact form is three dot-joined segments, which never matches the pattern above anyway.
    if (m && !line.includes(".")) header[m[1]] = m[2];
    else bodyParts.push(line);
  }

  const compact = bodyParts.join("");
  if (!compact) return { ok: false, error: { kind: "notJws" } };

  const segments = compact.split(".");
  if (segments.length !== 3 || segments.some(s => !s)) {
    return { ok: false, error: { kind: "notJws" } };
  }

  const headerJson = decodeBase64Url(segments[0]);
  const payloadJson = decodeBase64Url(segments[1]);
  if (headerJson === null || payloadJson === null) {
    return { ok: false, error: { kind: "badBase64" } };
  }

  let jwsHeader: { kid?: string; alg?: string };
  let payload: LicensePayload;
  try {
    jwsHeader = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: { kind: "badJson" } };
  }

  // Only the claims the screen actually prints. A file missing any of these would render a license
  // document with holes in it, and a document with holes is worse than a refusal that says which.
  const missing = ([
    ["licenseId", payload?.licenseId],
    ["plan", payload?.plan],
    ["limits.channels", payload?.limits?.channels],
    ["term", payload?.term],
    ["customer.name", payload?.customer?.name],
  ] as const)
    .filter(([, v]) => v === undefined || v === null || v === "")
    .map(([k]) => k);
  if (missing.length) return { ok: false, error: { kind: "missingClaims", fields: missing } };

  if (payload.schema !== undefined && payload.schema !== SUPPORTED_SCHEMA) {
    return { ok: false, error: { kind: "unsupportedSchema", schema: payload.schema } };
  }

  return {
    ok: true,
    license: {
      payload,
      header,
      keyId: jwsHeader?.kid ?? header["Key-Id"],
      armored: raw,
    },
  };
}

/** One row of "what changes if this is installed". */
export interface LicenseDiffRow {
  field: "plan" | "channels" | "expiry";
  before: string | null;
  after: string;
  changed: boolean;
}

/**
 * What installing this file would change, against what the project holds today.
 *
 * Shown before anything is applied. Applying a license blind is how a site ends up with a channel
 * count nobody chose and no way to tell when it changed — the same failure the vendor-side issuer
 * guards with its own confirm step, from the other end of the same file.
 */
export function diffLicense(
  license: LicensePayload,
  current: { plan?: string; channels?: number; expiresAt?: string },
  unlimitedLabel: string,
): LicenseDiffRow[] {
  const afterExpiry = license.term.perpetual || license.term.expiresAt === null
    ? unlimitedLabel
    : license.term.expiresAt;
  const rows: LicenseDiffRow[] = [
    { field: "plan", before: current.plan ?? null, after: license.plan, changed: current.plan !== license.plan },
    {
      field: "channels",
      before: current.channels === undefined ? null : String(current.channels),
      after: String(license.limits.channels),
      changed: current.channels !== license.limits.channels,
    },
    {
      field: "expiry",
      before: current.expiresAt ?? null,
      after: afterExpiry,
      changed: current.expiresAt !== afterExpiry,
    },
  ];
  return rows;
}

/**
 * A license that is already past its term when it arrives.
 *
 * Worth catching in the screen rather than letting the server return it, because the fix is not on
 * this side: the file has to be reissued. Reported as a warning and not a refusal — the server is
 * still the one that decides, and a clock this side of the wire may itself be the thing that is
 * wrong (a site whose CMOS battery died reads its own license as expired).
 */
export function licenseAlreadyExpired(license: LicensePayload, nowMs: number): boolean {
  if (license.term.perpetual || !license.term.expiresAt) return false;
  const t = new Date(license.term.expiresAt).getTime();
  return Number.isFinite(t) && t < nowMs;
}
