/**
 * Every way a sign-in attempt can fail, and what the screen says for each.
 *
 * These exist as a set because the backend has to return something the frontend can distinguish.
 * A single "login failed" leaves the operator with no idea whether to retype the password, wait,
 * or telephone an administrator — and on a closed network with no self-service recovery, guessing
 * wrong means a call to security operations either way. Handing the backend developer this list is
 * the point: it is the error contract the login endpoint has to satisfy.
 *
 * HANDOFF NOTE: nothing here is wired to a real response yet. Each state can be viewed by opening
 * /login?demo=<key> — see the demo query below.
 */
export type LoginFailure =
  | "badCredentials"
  | "locked"
  | "suspended"
  | "pendingApproval"
  | "notActivated"
  | "sessionExpired"
  | "signedOut";

export interface LoginNotice {
  /** "error" reads as something went wrong; "info" as a neutral state of affairs. */
  tone: "error" | "info";
  title: string;
  /** Second line. Says what to do next, never just what went wrong. */
  detail: string;
}

export const LOGIN_NOTICES: Record<LoginFailure, LoginNotice> = {
  // Deliberately does not say which of the two was wrong. Telling someone the account exists but
  // the password is wrong confirms the account exists to anyone who guesses an address.
  badCredentials: {
    tone: "error",
    title: "That does not match an account",
    detail: "Check the employee number or email and the password, then try again.",
  },
  locked: {
    tone: "error",
    title: "This account is locked",
    detail: "Too many failed attempts. An administrator has to unlock it before you can sign in.",
  },
  suspended: {
    tone: "error",
    title: "This account is suspended",
    detail: "Access was withdrawn by an administrator. Contact them if you think this is wrong.",
  },
  pendingApproval: {
    tone: "info",
    title: "This account is waiting for approval",
    detail: "An administrator has to approve it before you can sign in. You will not be notified automatically.",
  },
  // Someone who was issued a registration code but never used it. Sending them to /login is a dead
  // end unless the screen says where to actually go.
  notActivated: {
    tone: "info",
    title: "This account has not been activated yet",
    detail: "Use the registration code your administrator gave you to set a password first.",
  },
  sessionExpired: {
    tone: "info",
    title: "You were signed out",
    detail: "The session expired. Sign in again to continue.",
  },
  signedOut: {
    tone: "info",
    title: "Signed out",
    detail: "You have been signed out of this workstation.",
  },
};

/** Reads /login?demo=locked etc. Returns null for anything unrecognised. */
export function parseLoginNotice(value: string | null): LoginFailure | null {
  return value && value in LOGIN_NOTICES ? (value as LoginFailure) : null;
}
