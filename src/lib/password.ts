/**
 * The one definition of what counts as an acceptable password. Both places that set one — the
 * invite flow's /password-setup and the reset flow's /forgot-password — had their own copy of this
 * regex set, which is how two screens end up disagreeing about whether "abc12345" is allowed.
 *
 * The backend enforces its own policy; this only decides what the form accepts before submitting,
 * so it has to be kept in step with whatever the backend settles on.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordFormatValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}

/** Shown under the field, so the rule is readable before it is broken rather than after. Wording
 *  matches what /password-setup already shipped with — one rule stated two ways reads as two
 *  rules. Both languages live here for the same reason: four screens print this line, and a rule
 *  translated four times is a rule that ends up worded four ways. */
export const PASSWORD_RULE_TEXT = {
  en: "8+ characters with a letter, number, and symbol",
  ko: "영문, 숫자, 특수문자를 포함한 8자 이상",
} as const;

/** Length of the emailed verification code, per the design. Digits only: the code gets read off one
 *  screen and typed into another, so letters would raise case and O/0 questions for no gain. */
export const RESET_CODE_LENGTH = 8;

/**
 * How long an emailed code stays good for, in minutes. Stated on the code screen rather than only
 * in the expiry error, so the deadline arrives while it can still be met.
 *
 * Shown as a flat number, not a live countdown: the clock that decides is the server's, and a
 * countdown reading "2 minutes left" next to a code the server has already retired is worse than
 * no countdown at all.
 *
 * HANDOFF NOTE: must match whatever the backend actually enforces. If the backend returns its own
 * expiry, use that and delete this.
 */
export const RESET_CODE_TTL_MIN = 10;

/**
 * How long an emailed invitation link stays good for, in days. An invitation that was never
 * accepted is an open door with nobody watching it — the person it was meant for has usually been
 * chased down another way by then.
 *
 * OPEN QUESTION for the backend: 7 days is the assumption this UI states. /password-setup shows the
 * "link no longer valid" screen past it.
 */
export const INVITE_TOKEN_TTL_DAYS = 7;

/**
 * How long an administrator-issued temporary password stays usable. It exists only to carry someone
 * from a phone call to the login screen, so it is short: a temp password that lives for a week is a
 * second, weaker password on the account.
 *
 * OPEN QUESTION for the backend: 24h is the assumption this UI states out loud. Whatever the real
 * expiry is, it has to be this number, because the admin reads it off the screen and repeats it
 * over the phone.
 */
export const TEMP_PASSWORD_VALIDITY_HOURS = 24;

/** Ambiguous glyphs removed. This password is read aloud down an internal phone line or copied onto
 *  paper, so O/0, I/l/1 and S/5 cost a second phone call every time they appear. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZabcdefghjkmnpqrtuvwxyz23456789";
const TEMP_PASSWORD_SYMBOLS = "!@#$%*+=?";
const TEMP_PASSWORD_LENGTH = 12;

/**
 * HANDOFF NOTE — THIS IS MOCKUP CODE AND MUST NOT SURVIVE THE BACKEND.
 *
 * A credential generated in the admin's browser is a credential the server never chose, cannot
 * hash before it exists, and cannot bind to an expiry it enforces. The real flow is: Portal calls
 * the reset endpoint, the *server* generates the password, stores only its hash together with an
 * expiry and a must-change flag, and returns the plaintext exactly once in that one response.
 * Delete this function at that point rather than keeping it as a fallback.
 *
 * Until then it at least draws from the platform CSPRNG rather than Math.random, so nothing in the
 * mockup demonstrates a pattern worth copying, and it satisfies isPasswordFormatValid so the
 * password it hands out is one the set-password screens would also accept.
 */
export function generateTemporaryPassword(): string {
  const pick = (alphabet: string, count: number) => {
    const bytes = new Uint32Array(count);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => alphabet[b % alphabet.length]);
  };
  // Composed, not sampled-and-retried: one guaranteed digit and one guaranteed symbol mean the
  // result always clears the format rule instead of clearing it most of the time.
  const chars = [
    ...pick(TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH - 2),
    ...pick("23456789", 1),
    ...pick(TEMP_PASSWORD_SYMBOLS, 1),
  ];
  // Fisher-Yates over the CSPRNG, so the digit and symbol are not always in the last two places.
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = order[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
