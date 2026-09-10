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
    /**
     * Off for the first release (decided 2026-09-10), second release turns it back on.
     *
     * Not a change of mind about whether the requirement is right — everything it needs is built
     * and stays built: the purpose list in Portal's settings, the gate on the app's search
     * screens, the access log an auditor reads. This one boolean hides all three, which is the
     * whole reason a deployment switch exists rather than a feature branch.
     *
     * The default in the interface comment above still says on, and that is still correct advice
     * for a deployment that forgot to configure it. This is a scoping decision for our own first
     * ship, not the recommended value.
     */
    requireSearchPurpose: false,
  };
}
