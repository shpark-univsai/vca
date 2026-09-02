import { redirect } from "next/navigation";
import { getAuthConfig } from "@/lib/authConfig";
import PortalSignupWizard from "@/components/portal/PortalSignupWizard";

/**
 * Creating an organisation from nothing — the one call that arrives with no permission at all and
 * leaves a top-level administrator behind. On an on-premise installation (decided 2026-09-02) it
 * has no case: the installation belongs to one company, whose first administrators are handed over
 * at install time. Whoever reached this screen first would otherwise become the master admin.
 *
 * Nothing linked here, which is why it went unnoticed — but a route with no link is still a route.
 * Gated on the flag rather than deleted so the wizard stays viewable for a subscription-style
 * deployment: flip selfSignup and it comes back.
 *
 * HANDOFF NOTE: this closes the screen, not the hole. The backend must refuse the same call — see
 * the auth-flow doc, section 06 — and refuse it whenever a top-level administrator already exists.
 */
export default function SignupPage() {
  if (!getAuthConfig().selfSignup) redirect("/login");
  return <PortalSignupWizard />;
}
