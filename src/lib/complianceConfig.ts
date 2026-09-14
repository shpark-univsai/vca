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
   * Whether the console keeps a record of person look-ups — who searched for whom, and when.
   *
   * Separate from requireSearchPurpose on purpose, because they are two questions and the answers
   * come apart: an institution can want the record without wanting to stop an operator mid-search
   * to type a reason. Asking is friction the operator feels on every look-up; recording costs them
   * nothing and is what an audit actually opens with.
   *
   * On without the purpose gate, entries simply carry no purpose — see SearchAccessRecord.
   */
  searchAccessLog: boolean;
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
  /**
   * Whether the institution classifies its listings.
   *
   * On, every registration picks a category the institution defined — and the category decides how
   * long the listing lasts by default and whether it must carry a written basis. That is how a
   * police force keeps wanted persons and missing persons under different rules in one registry.
   *
   * Off, a listing is a listing: a name, a reason, an expiry date. Off is the right default for a
   * site with one kind of listing, and for a product nobody can yet explain the taxonomy of to a
   * customer in one sentence — an unexplained classification is one that gets filled in wrongly.
   */
  vipCategories: boolean;
  /**
   * Whether an operator can record a verdict on a detection — "yes, this is them" / "no, wrong
   * person" — against a sighting in Redmap or an associate in RedFace.
   *
   * The point of it is the defence: a route somebody has been through and agreed with looks
   * exactly like a route nobody has opened, unless the agreement is written down. It needs a
   * server to be that, though — a verdict has to outlive the tab it was recorded in, and carry
   * who and when to anyone who asks later.
   */
  detectionJudgement: boolean;
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
     * On (decided 2026-09-14). The record is the half of the requirement that carries its weight,
     * and the server side already exists — the backend built the look-up audit with a year of
     * retention and stores only a hash of a searched image, not the image. Leaving our end silent
     * meant a register nobody was writing in.
     *
     * The purpose gate above stays off: asking every operator to state a reason before every
     * search is friction we are not confident the first deployments want. Recording without
     * asking answers "who looked somebody up" and leaves "why" for when a customer asks for it.
     */
    searchAccessLog: true,
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
    /**
     * Off for the first release (decided 2026-09-14). Not a judgement on the idea: the reason is
     * that we cannot yet say in one sentence what a category is FOR, and a field the product
     * cannot explain is a field the customer fills in wrongly.
     *
     * What it hides: the category select and the "manage categories" action in the registration
     * form, the category column in the table and the CSV, and the Settings rail entry. What stays:
     * the basis field (now always optional — no category is saying it is required) and the expiry
     * date, which is the one an audit actually asks about.
     *
     * Turning it on restores all of it; the categories and their colours are still in the store.
     */
    vipCategories: false,
    /**
     * Off for the first release (decided 2026-09-14), because right now the record does not
     * survive a refresh — judgements live in the store and nothing persists them. The screen
     * printed "checked by <name> at <time>" over a fact the next page load forgets, which is
     * worse than not offering the button: the operator believes the check was kept.
     *
     * Turning it on takes a server that accepts a verdict (contract gap, no endpoint yet). What
     * this hides is the write: the confirm/exclude buttons in Redmap's trace nodes and RedFace's
     * associate rows. Every verdict display is already conditional on a verdict existing, so with
     * no way to record one those branches simply never render.
     */
    detectionJudgement: false,
  };
}
