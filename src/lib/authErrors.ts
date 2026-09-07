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

/** Both languages live beside each other here rather than in the login screen's own dictionary:
 *  this list is the error contract, and a notice whose English and Korean drift apart is two
 *  different contracts. Read as `LOGIN_NOTICES[key].title[lang]`. */
type Localized = { en: string; ko: string };

export interface LoginNotice {
  /** "error" reads as something went wrong; "info" as a neutral state of affairs. */
  tone: "error" | "info";
  title: Localized;
  /** Second line. Says what to do next, never just what went wrong. */
  detail: Localized;
}

export const LOGIN_NOTICES: Record<LoginFailure, LoginNotice> = {
  // Deliberately does not say which of the two was wrong. Telling someone the account exists but
  // the password is wrong confirms the account exists to anyone who guesses an address.
  badCredentials: {
    tone: "error",
    title: { en: "That does not match an account", ko: "일치하는 계정이 없습니다" },
    detail: {
      en: "Check the employee number or email and the password, then try again.",
      ko: "사번 또는 이메일과 비밀번호를 확인한 뒤 다시 시도해주세요.",
    },
  },
  locked: {
    tone: "error",
    title: { en: "This account is locked", ko: "잠긴 계정입니다" },
    detail: {
      en: "Too many failed attempts. An administrator has to unlock it before you can sign in.",
      ko: "로그인 실패가 반복되었습니다. 관리자가 잠금을 풀어야 다시 로그인할 수 있습니다.",
    },
  },
  suspended: {
    tone: "error",
    title: { en: "This account is suspended", ko: "정지된 계정입니다" },
    detail: {
      en: "Access was withdrawn by an administrator. Contact them if you think this is wrong.",
      ko: "관리자가 접근 권한을 회수했습니다. 잘못된 조치라고 생각되면 관리자에게 문의해주세요.",
    },
  },
  pendingApproval: {
    tone: "info",
    title: { en: "This account is waiting for approval", ko: "승인을 기다리는 계정입니다" },
    detail: {
      en: "An administrator has to approve it before you can sign in. You will not be notified automatically.",
      ko: "관리자가 승인해야 로그인할 수 있습니다. 승인되어도 따로 알림은 가지 않습니다.",
    },
  },
  // Someone who was issued a registration code but never used it. Sending them to /login is a dead
  // end unless the screen says where to actually go.
  notActivated: {
    tone: "info",
    title: { en: "This account has not been activated yet", ko: "아직 활성화되지 않은 계정입니다" },
    detail: {
      en: "Use the registration code your administrator gave you to set a password first.",
      ko: "관리자에게 받은 등록 코드로 먼저 비밀번호를 설정해주세요.",
    },
  },
  sessionExpired: {
    tone: "info",
    title: { en: "You were signed out", ko: "로그아웃되었습니다" },
    detail: {
      en: "The session expired. Sign in again to continue.",
      ko: "접속 시간이 만료되었습니다. 다시 로그인해주세요.",
    },
  },
  signedOut: {
    tone: "info",
    title: { en: "Signed out", ko: "로그아웃되었습니다" },
    detail: {
      en: "You have been signed out of this workstation.",
      ko: "이 워크스테이션에서 로그아웃되었습니다.",
    },
  },
};

/** Reads /login?demo=locked etc. Returns null for anything unrecognised. */
export function parseLoginNotice(value: string | null): LoginFailure | null {
  return value && value in LOGIN_NOTICES ? (value as LoginFailure) : null;
}
