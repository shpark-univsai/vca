"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AccessGate, { denialFor, type GateDenial, type GateUser } from "@/components/AccessGate";
import { useVcaStore, currentPortalUser } from "@/lib/vcaStore";

/**
 * The branch login lands on when an account holds both doors.
 *
 * Every state is also viewable directly, the same way the login failures are (see authErrors):
 *
 *   /gate                        the choice — two doors, as the seeded identity actually has
 *   /gate?demo=appNotGranted     console role, no app
 *   /gate?demo=portalNotGranted  app only, typed /portal
 *   /gate?demo=notActivated      invited, never used the registration code
 *   /gate?demo=suspended         granted, paused by an administrator
 *   /gate?demo=noDoor            neither — a record an administrator has to repair
 */
const DEMO_DENIALS: GateDenial[] = ["appNotGranted", "portalNotGranted", "notActivated", "suspended", "noDoor"];

/**
 * The account each demo state describes, so the grants table and the exits agree with the
 * headline. Four of these are the seeded roster exactly — Aaron Sim really is an auditor with no
 * app, Wei Chen really is invited — because a demo that contradicts Users & Permissions about a
 * named person is worse than no demo.
 *
 * `noDoor` is the exception and has to be: neither grant is a combination the store refuses to
 * create (see hasSomeAccess), so no seeded account can carry it. It gets a name that is in no
 * roster rather than borrowing a real one, which is what it used to do — the same Wei Chen the
 * console lists with app access appeared here with none.
 */
const DEMO_USERS: Record<GateDenial, GateUser> = {
  appNotGranted: { name: "Aaron Sim", email: "aaron.sim@univs.ai", permission: "auditor", appAccess: false, status: "active" },
  portalNotGranted: { name: "Marcus Lee", email: "marcus.lee@univs.ai", permission: "none", appAccess: true, status: "active" },
  notActivated: { name: "Wei Chen", email: "wei.chen@univs.ai", permission: "none", appAccess: true, status: "invited" },
  suspended: { name: "David Ong", email: "david.ong@univs.ai", permission: "none", appAccess: true, status: "suspended" },
  noDoor: { name: "(no roster entry)", email: "unknown@univs.ai", permission: "none", appAccess: false, status: "active" },
};

function GateBody() {
  const demo = useSearchParams().get("demo");
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));

  const demoDenial = DEMO_DENIALS.find(d => d === demo);
  if (demoDenial) return <AccessGate user={DEMO_USERS[demoDenial]} denial={demoDenial} />;

  // Both doors asked of the one function the doors themselves use, so this screen cannot disagree
  // with where it sends people. It used to re-derive the answer here in a different order, and did
  // disagree: the same account was told "no open doors" at /gate and "suspended" at /.
  const portalDenial = denialFor(me, "portal");
  const appDenial = denialFor(me, "app");
  if (!me || (!portalDenial && !appDenial)) return <AccessGate user={me} />;

  // Exactly one shut: say which, and the open one becomes the button.
  const only = portalDenial && appDenial ? null : (portalDenial ?? appDenial);
  if (only) return <AccessGate user={me} denial={only} />;

  // Both shut. Where the two reasons differ, the account's state is the one to lead with — it is
  // what closes a door that WAS granted, and it is the one an administrator can lift.
  const state = [appDenial, portalDenial].find(d => d === "suspended" || d === "notActivated");
  return <AccessGate user={me} denial={state ?? appDenial ?? portalDenial!} />;
}

export default function GateRoute() {
  return (
    <Suspense>
      <GateBody />
    </Suspense>
  );
}
