import type { Metadata } from "next";

/* Portal is the administration console, not the monitoring dashboard, and the browser tab is the
   one place that difference was not being made. The root layout's title applied to every route
   that did not override it, so an administrator with both open saw two tabs both reading
   "UNIVS SMART CITY – VCA Dashboard" and had to click one to find out which was which — the two
   they most need to tell apart, since one shows live faces and the other changes who may look.

   Same thin-layout shape as the pre-auth routes (see login/layout.tsx): the page under this is a
   client component and cannot export metadata itself. */
export const metadata: Metadata = {
  title: "VCA Portal",
  description: "Administration console for VCA.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
