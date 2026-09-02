/**
 * Registration codes for a staff roster an administrator loads into Portal ahead of time (from
 * Excel — not built yet, see ProjectRosterTab.tsx). This is what makes sign-up possible with no
 * mail at all: a code is issued per person, handed over on paper or face to face, and resolves to
 * exactly one roster row — so the code is both the lookup key and the proof of identity, and the
 * person types nothing the roster already knows. Issuing the code IS the approval, which is why
 * nothing here needs a second admin review.
 *
 * This file holds only the type, constants, and pure helpers. The roster itself is state (Portal
 * issues/reissues/deletes rows), so it lives in vcaStore.ts's `staffRoster` field — see that file
 * for the seed data and the issue/reissue/remove actions. Kept pure here rather than reading
 * useVcaStore.getState() directly, the same reasoning resolveMailConfig() documents in
 * vcaStore.ts: callers pass the slice of state they're already subscribed to.
 *
 * HANDOFF NOTE: the backend must enforce what this file only models:
 *   - a code is single-use — burn it on success, or a person can pass their code to someone else
 *   - a code expires — an unused code for someone who left must not stay valid forever. The UI
 *     now models this (issuedAt + REGISTRATION_CODE_TTL_DAYS), so the number has to match
 *   - reissuing invalidates the previous code
 *   - attempts are rate-limited per address/IP. The code is the only gate, so an unlimited guesser
 *     eventually walks in. The alphabet below is 32 chars over 8 places (~1.1 x 10^12), which is
 *     only safe with a throttle in front of it.
 *
 * ASSUMPTION: the roster is modeled per-project (RosterEntry.projectId), matching every other
 * Portal collection (cameras, servers, persons). Whether it should instead be org-wide (one list
 * shared across a customer's projects) is not settled — see the note on ProjectRosterTab.tsx.
 */
export interface RosterEntry {
  /** The 8-character code, no dashes. Grouped as XXXX-XXXX only when displayed. Absent until an
   *  admin issues one — see `status`. */
  code?: string;
  /** When the code was generated, ISO. This is what makes expiry a fact rather than a label: the
   *  status used to be stored by hand, so nothing in the system could ever turn a live code into an
   *  expired one. Absent on the seeded rows, which is why they stay usable for demos. */
  issuedAt?: string;
  name: string;
  /** The roster's matching key. Names are not unique; employee numbers are. */
  employeeId: string;
  department?: string;
  /** Optional — a company with no mail leaves this empty. */
  email?: string;
  projectId: string;
  permission: "admin" | "operator";
  status: RosterCodeStatus;
}

/**
 * Extended from the original 3-value shape ("unused" | "used" | "expired") to add "not-issued" —
 * Portal needs to represent a roster row before any code has been generated for it at all (that's
 * the normal state right after an Excel import, and what "bulk issue" targets), which the original
 * shape couldn't express since `code` was required.
 */
export type RosterCodeStatus = "not-issued" | "unused" | "used" | "expired";

/** Excludes I, O, 0 and 1 — the characters that get misread off a printout. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REGISTRATION_CODE_LENGTH = 8;

/**
 * How long an issued code stays good for, in days. A code is a slip of paper: it outlives the
 * conversation that handed it over, so an unused one issued to somebody who has since left must
 * stop working on its own.
 *
 * OPEN QUESTION for the backend: 14 days is what this UI assumes and states on the issue screen.
 * Whatever the real number is, it has to be this one — an administrator reads it off the screen and
 * writes it on the printout.
 */
export const REGISTRATION_CODE_TTL_DAYS = 14;

/** Setup codes issued against an existing account (PortalUser.setupCode) age out the same way. One
 *  number, because the two are the same object to the person holding the paper. */
export const SETUP_CODE_TTL_DAYS = REGISTRATION_CODE_TTL_DAYS;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days left before an issued code stops working, floored at 0. Null when there is nothing to
 *  count from, which is the seeded rows and anything the backend has not dated yet. */
export function codeDaysRemaining(
  issuedAt: string | undefined, ttlDays: number = REGISTRATION_CODE_TTL_DAYS, now: number = Date.now(),
): number | null {
  if (!issuedAt) return null;
  const elapsed = now - new Date(issuedAt).getTime();
  if (Number.isNaN(elapsed)) return null;
  return Math.max(0, Math.ceil((ttlDays * DAY_MS - elapsed) / DAY_MS));
}

export function isCodeExpired(
  issuedAt: string | undefined, ttlDays: number = REGISTRATION_CODE_TTL_DAYS, now: number = Date.now(),
): boolean {
  const remaining = codeDaysRemaining(issuedAt, ttlDays, now);
  return remaining !== null && remaining === 0;
}

/**
 * The status to show and act on. A code issued longer ago than the TTL is expired whatever the
 * stored value says, so every screen reads the roster through this rather than through `status`
 * directly — otherwise expiry would exist in one place and not the others.
 */
export function effectiveCodeStatus(entry: RosterEntry, now: number = Date.now()): RosterCodeStatus {
  if (entry.status === "unused" && isCodeExpired(entry.issuedAt, REGISTRATION_CODE_TTL_DAYS, now)) return "expired";
  return entry.status;
}

/** Applies effectiveCodeStatus across a list, so a screen can keep reading `r.status`. */
export function withEffectiveStatus(entries: RosterEntry[], now: number = Date.now()): RosterEntry[] {
  return entries.map(e => {
    const status = effectiveCodeStatus(e, now);
    return status === e.status ? e : { ...e, status };
  });
}

export type CodeLookup =
  | { ok: true; entry: RosterEntry }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/**
 * Resolves a typed code to its roster row. Kept pure so the screen can show who the code belongs to
 * before anyone commits to a password — a person handed the wrong code finds out here rather than
 * after creating an account under someone else's name.
 */
/** Upper-cases and strips anything the code alphabet does not contain, so a dash, a space or a
 *  lower-case transcription all match the stored value. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function resolveRegistrationCode(code: string, roster: RosterEntry[]): CodeLookup {
  const normalized = normalizeCode(code);
  const entry = roster.find(r => r.code === normalized);
  if (!entry) return { ok: false, reason: "unknown" };
  const status = effectiveCodeStatus(entry);
  // A "not-issued" row has no code, so it can never actually be matched above — this branch only
  // exists to keep the return type honest against RosterCodeStatus's 4 values.
  if (status !== "unused") return { ok: false, reason: status === "not-issued" ? "unknown" : status };
  return { ok: true, entry };
}

/** KNVBCLVC -> KNVB-CLVC, the way it is printed. */
export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * Not seededRandom — this only ever runs from a click handler (issue/reissue in Portal), never
 * during render or at module load, so there is no SSR/hydration mismatch risk, and real randomness
 * is the right call for something that gates account creation.
 */
export function generateRegistrationCode(existingCodes: ReadonlySet<string>): string {
  let code: string;
  do {
    code = Array.from({ length: REGISTRATION_CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  } while (existingCodes.has(code));
  return code;
}
