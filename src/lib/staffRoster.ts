/**
 * The staff roster an administrator loads into Portal ahead of time (from Excel), and the
 * registration codes issued from it.
 *
 * This is what makes sign-up possible with no mail at all. A code is issued per person, handed over
 * on paper or face to face, and resolves to exactly one roster row — so the code is both the lookup
 * key and the proof of identity, and the person types nothing the roster already knows. Issuing the
 * code IS the approval, which is why nothing here needs a second admin review.
 *
 * HANDOFF NOTE: mock data. The real roster arrives via Excel import in Portal (not built) and lives
 * on the backend, which must also enforce what this file only models:
 *   - a code is single-use — burn it on success, or a person can pass their code to someone else
 *   - a code expires — an unused code for someone who left must not stay valid forever
 *   - reissuing invalidates the previous code
 *   - attempts are rate-limited per address/IP. The code is the only gate, so an unlimited guesser
 *     eventually walks in. The alphabet below is 32 chars over 8 places (~1.1 x 10^12), which is
 *     only safe with a throttle in front of it.
 */
export interface RosterEntry {
  /** The 8-character code, no dashes. Grouped as XXXX-XXXX only when displayed. */
  code: string;
  name: string;
  /** The roster's matching key. Names are not unique; employee numbers are. */
  employeeId: string;
  department?: string;
  /** Optional — a company with no mail leaves this empty. */
  email?: string;
  projectName: string;
  permission: "admin" | "operator";
  status: "unused" | "used" | "expired";
}

/** Excludes I, O, 0 and 1 — the characters that get misread off a printout. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REGISTRATION_CODE_LENGTH = 8;

const ROSTER: RosterEntry[] = [
  { code: "KNVBCLVC", name: "Grace Tan", employeeId: "EMP-2041", department: "Operations", projectName: "Singapore Smart City", permission: "admin", status: "unused" },
  { code: "TRQZ7HMP", name: "Marcus Lee", employeeId: "EMP-2088", department: "Control Room", projectName: "Singapore Smart City", permission: "operator", status: "unused" },
  { code: "XJ4WD2SN", name: "Nadia Rahman", employeeId: "EMP-2119", department: "Field Engineering", projectName: "Riverside District", permission: "operator", status: "unused" },
  { code: "9PLKVT3B", name: "Wei Chen", employeeId: "EMP-2153", department: "Control Room", projectName: "Singapore Smart City", permission: "operator", status: "used" },
];

export type CodeLookup =
  | { ok: true; entry: RosterEntry }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/**
 * Resolves a typed code to its roster row. Kept pure so the screen can show who the code belongs to
 * before anyone commits to a password — a person handed the wrong code finds out here rather than
 * after creating an account under someone else's name.
 */
export function resolveRegistrationCode(code: string): CodeLookup {
  const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "");
  const entry = ROSTER.find(r => r.code === normalized);
  if (!entry) return { ok: false, reason: "unknown" };
  if (entry.status !== "unused") return { ok: false, reason: entry.status };
  return { ok: true, entry };
}

/** KNVBCLVC -> KNVB-CLVC, the way it is printed. */
export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
