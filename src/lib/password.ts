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
 *  rules. */
export const PASSWORD_RULE_TEXT =
  "At least 8 characters, including letters, numbers, and special characters";

/** Length of the emailed verification code, per the design. Digits only: the code gets read off one
 *  screen and typed into another, so letters would raise case and O/0 questions for no gain. */
export const RESET_CODE_LENGTH = 8;
