/**
 * Policy switches an installation turns on, as opposed to the entry paths in authConfig.ts.
 *
 * Separate file on purpose: authConfig answers "which ways in exist here", and mixing a
 * record-keeping obligation into that list makes both harder to read. What these have in common is
 * that they are decided by the customer's rules, not by us, and fixed at deploy time.
 *
 * IMPORTANT: like authConfig, this only decides what the UI asks for. A switch here does not
 * enforce anything — the backend has to refuse a search that arrives without a purpose, or the
 * requirement is a suggestion.
 */
export interface ComplianceConfig {
  /**
   * Whether a person search must carry a stated purpose.
   *
   * On for institutions that keep a viewing record for identified-person footage — a city control
   * centre or a police station, where reading who looked at whom and why is an obligation rather
   * than a nicety. Off for a site with no such rule, where asking every operator to declare a
   * purpose is friction that buys nothing.
   *
   * OPEN QUESTION for legal: which rule this actually implements, and whether the record has to
   * carry anything this UI does not collect. The default is on, because a deployment that forgot
   * to configure it should over-record rather than under-record.
   */
  requireSearchPurpose: boolean;
}

/**
 * HANDOFF NOTE: hardcoded, same as getAuthConfig(). Wire it to a NEXT_PUBLIC_* variable so an
 * installation is configured without rebuilding, and keep this the only call site.
 */
export function getComplianceConfig(): ComplianceConfig {
  return {
    requireSearchPurpose: true,
  };
}
