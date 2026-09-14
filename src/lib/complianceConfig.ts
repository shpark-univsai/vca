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
  /**
   * Whether the console keeps a register of requests that came from outside the project — footage
   * handed to a third party, and people asking to be erased.
   *
   * On for an institution that has to answer "who did you give this to, and on what grounds"
   * with a record rather than a memory. Off where those requests are handled on paper or by mail
   * and the console is not the book of record — writing them here as well would produce a second,
   * partial copy that disagrees with the real one, which is worse than not keeping it.
   */
  externalRequests: boolean;
  /**
   * Whether a listing can be ended without being deleted.
   *
   * On, a row leaves the registry two ways: released (the listing's purpose ended, and the record
   * of it stays, with a reason and a date) or deleted (nothing stays). Off, there is only delete.
   *
   * On for an institution that has to answer "when did this person come off the list, and on
   * whose word" — the release date is the answer and a deleted row has none. Off where a listing
   * simply stops being maintained and nobody is asked about it afterwards, because a second verb
   * for "take them off" is one more thing to explain for a distinction that site never makes.
   */
  personRelease: boolean;
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
    /**
     * Off for the first release (decided 2026-09-11), and for the same shape of reason as the
     * line above: the screens are built and stay built, and one boolean decides whether this
     * release carries them.
     *
     * The register was built from the product review rather than from anybody asking for it, and
     * the first deployments handle these requests outside the console. Shipping it now would put
     * a book of record in front of people who keep the real book somewhere else — two registers
     * that disagree is the failure this avoids, not a missing feature.
     *
     * What it hides is complete: the rail entry, the tab body, and the ?tab=requests route. The
     * seeded rows stay in the store, so turning it on shows a populated screen rather than an
     * empty one nobody can judge.
     */
    externalRequests: false,
    /**
     * Off for the first release (decided 2026-09-14), second release turns it back on. Same shape
     * of reason as the two above: built, staying built, one boolean deciding whether this release
     * carries it.
     *
     * What it hides: the row menu's release/reinstate action and the "Released" segment above the
     * list. The one seeded released person stays in the store and is therefore not on screen
     * while this is off — deliberate, and the same trade the register above makes: turning the
     * switch on shows a populated screen rather than an empty one nobody can judge.
     */
    personRelease: false,
  };
}
