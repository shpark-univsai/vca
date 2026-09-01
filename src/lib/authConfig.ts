/**
 * Which ways in are switched on for this deployment.
 *
 * Companies get separate domains so their accounts and data stay separate, but the screens are the
 * same everywhere — what differs is which entry paths are available. A company on an
 * internet-isolated network cannot use anything that depends on outbound mail, while a subscription
 * customer may want people to sign themselves up. So every path is built, and a deployment turns on
 * the ones that fit.
 *
 * IMPORTANT: this only decides what the UI offers. Hiding a button does not close a route — anyone
 * can type /signup — so the backend has to refuse the corresponding call as well. Treat these flags
 * as a mirror of the backend's policy, never as the enforcement of it.
 */
export interface AuthConfig {
  /** Admin invites by mail; the recipient sets a password from the link. Needs outbound mail. */
  inviteByEmail: boolean;
  /** A visitor bounced from a project link asks for access; an admin approves. Needs outbound mail
   *  to notify, and the approval lands in Portal. */
  accessRequest: boolean;
  /** A visitor creates their own account against this domain, no invitation. Not built yet — the
   *  screen does not exist, so leaving this false is the only honest setting today. */
  selfSignup: boolean;
  /**
   * How a forgotten password is recovered.
   * - "emailCode": the 8-digit code flow at /forgot-password. Needs outbound mail.
   * - "adminOnly": no self-service. A company with no mail at all has no way to send a code, so an
   *   administrator has to set the password and hand it over in person. NOT BUILT — /forgot-password
   *   would need to say so instead of asking for an address.
   */
  passwordRecovery: "emailCode" | "adminOnly";
}

/**
 * HANDOFF NOTE: hardcoded until it is settled where this comes from. The two deployment shapes want
 * different answers and the choice is still being discussed:
 *   - separate install per company (on-premise) → build/env configuration, fixed at deploy time
 *   - one install serving many domains (subscription) → looked up per hostname before login, which
 *     means an unauthenticated endpoint the login screen can call
 * Both end up here, so this is the only call site that has to change.
 */
export function getAuthConfig(): AuthConfig {
  return {
    inviteByEmail: true,
    accessRequest: true,
    selfSignup: false,
    passwordRecovery: "emailCode",
  };
}
