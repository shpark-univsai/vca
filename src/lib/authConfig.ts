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
  /**
   * A visitor bounced from a project link asks for access; an admin approves in Portal.
   *
   * Off, and not because it is unbuilt — /request-access and Portal's approval queue both exist.
   * It is off because on-premise-only deployment (decided 2026-09-02) leaves it without a person
   * to serve: an outsider cannot reach a closed network to follow the link in the first place, and
   * anyone who can reach it is already staff, who arrive through the roster's registration codes or
   * an invitation. The screen also asks a visitor for their name and email, which is a question you
   * only ask someone the installation has never heard of.
   *
   * Kept as an explicit false rather than deleted, the same way selfSignup is: the absence should
   * read as a decision. The case that WOULD survive here is a different feature — an operator who
   * already has an account asking for one more project — and that one needs no mail at all, because
   * the request lands in Portal rather than in an inbox. If that is ever wanted, reshape
   * /request-access around a signed-in user instead of switching this flag back on.
   */
  accessRequest: boolean;
  /** A visitor creates their own account against this domain, no invitation. Not built, and with
   *  on-premise-only deployment there is no case for it — an installation belongs to one company
   *  and its staff arrive through the roster. Kept as an explicit false rather than removed, so the
   *  absence reads as a decision. */
  selfSignup: boolean;
  /** Registration by a per-person code the administrator issues from the staff roster and hands
   *  over on paper. The only path that works with no outbound mail at all. See /register. */
  registrationCode: boolean;
  /**
   * How a forgotten password is recovered.
   * - "emailCode": the 8-digit code flow at /forgot-password. Needs outbound mail.
   * - "adminOnly": no self-service. A company with no mail at all has no way to send a code, so an
   *   administrator hands over a way back in from Portal (Users & Permissions -> row actions ->
   *   "Reset password"): a temporary password read out by phone or in person, or a setup code on
   *   paper. /forgot-password says so instead of asking for an address, and Portal hides its
   *   mail-dependent actions. Both halves are built.
   */
  passwordRecovery: "emailCode" | "adminOnly";
  /**
   * Who to reach when nobody can get in — printed at the foot of the login screen and on the
   * password screen when recovery is "adminOnly". This is the whole recovery path in a deployment
   * with no mail, so a wrong or missing value strands people.
   *
   * Null renders a generic line rather than a made-up extension: an invented contact is worse than
   * none, because someone will try it.
   */
  supportContact: string | null;
  /** Accept an employee number as well as an email at the login prompt. Deployments with no mail
   *  often have no per-person address either, and the roster keys on employee number anyway. */
  employeeIdLogin: boolean;
}

/**
 * HANDOFF NOTE: hardcoded for now, but the shape of the answer is settled. Deployment is
 * on-premise only (decided 2026-09-02) — one installation per company — so this is build/env
 * configuration fixed at deploy time, NOT a per-hostname lookup. No unauthenticated tenant-config
 * endpoint is needed, and nothing here should be made async in anticipation of one.
 *
 * Wire it to environment variables (NEXT_PUBLIC_*) so an installation can be configured without a
 * rebuild of the app source. This stays the only call site.
 */
export function getAuthConfig(): AuthConfig {
  return {
    inviteByEmail: true,
    accessRequest: false,
    selfSignup: false,
    registrationCode: true,
    passwordRecovery: "emailCode",
    supportContact: null,
    employeeIdLogin: true,
  };
}

/**
 * Whether this installation can put mail on the wire at all.
 *
 * Two flags above describe the same underlying fact — there either is an SMTP relay reachable from
 * this network or there is not — and every mail-dependent affordance should ask this rather than
 * pick one of them. If the two ever disagree the deployment is misconfigured, so the stricter
 * answer wins: offering a button that silently sends nothing is the failure that strands people.
 */
export function hasOutboundMail(config: AuthConfig = getAuthConfig()): boolean {
  return config.inviteByEmail && config.passwordRecovery === "emailCode";
}
