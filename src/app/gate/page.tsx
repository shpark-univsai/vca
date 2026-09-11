"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AccessGate, { type GateDenial } from "@/components/AccessGate";
import { useVcaStore, currentPortalUser, canEnterPortal, canUseAppNow } from "@/lib/vcaStore";

/**
 * The branch login lands on when an account holds both doors.
 *
 * Every state is also viewable directly, the same way the login failures are (see authErrors):
 *
 *   /gate                        the choice — two doors, as the seeded identity actually has
 *   /gate?demo=appNotGranted     console role, no app
 *   /gate?demo=portalNotGranted  app only, typed /portal
 *   /gate?demo=suspended         granted both, paused by an administrator
 *   /gate?demo=noDoor            neither — a record an administrator has to repair
 */
const DEMO_DENIALS: GateDenial[] = ["appNotGranted", "portalNotGranted", "suspended", "noDoor"];

/** The account each demo state describes, so the grants table and the exits are consistent with
 *  the headline rather than showing the seeded owner's permissions under a refusal. */
const DEMO_USERS: Record<GateDenial, { name: string; email: string; permission: "owner" | "admin" | "auditor" | "none"; appAccess: boolean; status: "active" | "invited" | "suspended" }> = {
  appNotGranted: { name: "Aaron Sim", email: "aaron.sim@univs.ai", permission: "auditor", appAccess: false, status: "active" },
  portalNotGranted: { name: "Marcus Lee", email: "marcus.lee@univs.ai", permission: "none", appAccess: true, status: "active" },
  suspended: { name: "David Ong", email: "david.ong@univs.ai", permission: "none", appAccess: true, status: "suspended" },
  noDoor: { name: "Wei Chen", email: "wei.chen@univs.ai", permission: "none", appAccess: false, status: "active" },
};

function GateBody() {
  const demo = useSearchParams().get("demo");
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));

  const demoDenial = DEMO_DENIALS.find(d => d === demo);
  if (demoDenial) return <AccessGate user={DEMO_USERS[demoDenial]} denial={demoDenial} />;

  // A real arrival. Anyone who cannot open both halves does not get a choice to make, so the
  // screen states what is closed instead of offering a door that would turn them away.
  if (me) {
    const portal = canEnterPortal(me.permission);
    const app = canUseAppNow(me);
    if (!portal && !app) return <AccessGate user={me} denial={me.status === "suspended" ? "suspended" : "noDoor"} />;
    if (!app) return <AccessGate user={me} denial={me.appAccess ? "suspended" : "appNotGranted"} />;
    if (!portal) return <AccessGate user={me} denial="portalNotGranted" />;
  }
  return <AccessGate user={me} />;
}

export default function GateRoute() {
  return (
    <Suspense>
      <GateBody />
    </Suspense>
  );
}
