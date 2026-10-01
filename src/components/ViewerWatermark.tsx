"use client";

import { useSyncExternalStore } from "react";
import { currentPortalUser, useVcaStore, useActiveProjectId, SIGNED_IN_USER } from "@/lib/vcaStore";
import { dateKeyIn, clockMinutesIn, siteTimeZone } from "@/lib/time";

/**
 * THE MINUTE HAND, AS AN EXTERNAL SYSTEM RATHER THAN A STATE HOOK.
 *
 * The stamp needs the current minute: absent on the server's frame, present from the browser's
 * first painted one. A clock read during render and corrected in an effect is the hydration
 * mismatch this repo has paid for twice, and `setNow(new Date())` in an effect body is a setState
 * in an effect — which react-hooks/set-state-in-effect rejects, rightly. A clock IS an external
 * system, and React has a hook for subscribing to one, so this is that system.
 *
 * getServerSnapshot returns null, and React uses it for the hydrating client render too, so the
 * server's HTML and the first client frame agree on "nothing yet" — the same guard the old
 * `now === null` gate gave, without the effect. The snapshot is a COUNT OF WHOLE MINUTES rather
 * than a Date on purpose: getSnapshot has to return a value that is `===` its previous result or
 * React re-renders without end, and `new Date()` is a new object every call.
 */
const MINUTE_MS = 60_000;
const minuteClock = {
  /* Polled twice a minute, so a minute rolling over reaches the screen within 30s of doing it. A
     second-by-second clock would repaint sixty times a minute over a video for no gain: the
     question a leaked still answers is "when, roughly", and the audit log carries the exact time.
     One interval per mounted stamp, running whether or not the site has the watermark on — a hook
     cannot be subscribed conditionally, and a 30s no-op timer is cheaper than the alternatives. */
  subscribe(onChange: () => void) {
    const t = setInterval(onChange, 30_000);
    return () => clearInterval(t);
  },
  getSnapshot: (): number | null => Math.floor(Date.now() / MINUTE_MS),
  getServerSnapshot: (): number | null => null,
};

/**
 * WHOSE SESSION THIS PICTURE CAME FROM, WRITTEN ON THE PICTURE.
 *
 * Asked for after the owner's question 「혹시 기본적으로 스크린캡쳐를 막아두지?」 — and the honest
 * answer is that nothing on the web can stop a capture. There is no browser API for it, a native
 * client's OS trick (SetWindowDisplayAffinity, NSWindowSharingNone) is not available to a web page,
 * and a phone pointed at the screen defeats every one of them anyway. So this does not prevent;
 * it ATTRIBUTES. A still that leaves the building carries the account it was taken from and the
 * minute it was on screen, which is what makes a leak traceable and, more to the point, what makes
 * somebody think twice. Milestone, Genetec and Avigilon all put the operator's identity on the
 * view for the same reason.
 *
 * Deliberately NOT a security boundary: anyone with devtools can delete this node. Writing it down
 * so nobody mistakes what was bought — the audit trail (조회 기록 · 검색 기록) is the record, and
 * this is the deterrent that makes a screenshot say who took it.
 *
 * SITTING OVER MEDIA ONLY. The caller puts it inside a positioned box that holds a frame or a
 * stream. It never covers a control: `pointer-events: none` means a click goes through to whatever
 * is underneath, so a dot on a map or a button under the corner still works.
 */
/**
 * The sentence itself, so the screen and a file that burns it in cannot drift apart.
 *
 * Frame export (베스트 프레임 상세) draws this same stamp onto the canvas it hands over. It was
 * reassembling the string from the same three parts, which is one edit away from a file whose
 * stamp reads differently from the view it was taken from — and on a stamp kept for attribution,
 * the two disagreeing is the whole failure.
 */
export function viewerStampText(who: string, at: Date, zone: string): string {
  return `${who} · ${dateKeyIn(at, zone)} ${clockMinutesIn(at, zone)}`;
}

export default function ViewerWatermark({ corner = "bottom-left" }: {
  /** Which corner of the media box. The default is the one Leaflet and our own overlays leave free. */
  corner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}) {
  const projects = useVcaStore(s => s.projects);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const projectId = useActiveProjectId();
  const project = projects.find(p => p.id === projectId);
  /* Absent means ON — see Project.evidenceWatermark. A site that has never been asked the question
     is a site whose stills should still say where they came from. */
  const on = project?.evidenceWatermark !== false;

  const me = currentPortalUser(portalUsers);
  const who = me?.name ?? SIGNED_IN_USER.name;

  /*
   * The minute, not the second, and it ticks.
   *
   * A frozen timestamp would date the page load rather than the moment on screen, which is the
   * wrong claim on a view somebody keeps open all shift. See minuteClock above for why the clock
   * sits outside React and why this is a minute count rather than a Date.
   */
  const minute = useSyncExternalStore(minuteClock.subscribe, minuteClock.getSnapshot, minuteClock.getServerSnapshot);

  /* Nothing until the first client render: a time computed during the server's render differs from
     the browser's first frame, which is the hydration mismatch this repo has paid for twice. */
  if (!on || minute === null) return null;
  const now = new Date(minute * MINUTE_MS);

  const zone = project?.timeZone ?? siteTimeZone();
  const stamp = viewerStampText(who, now, zone);

  const place: React.CSSProperties =
    corner === "bottom-left" ? { bottom: "8px", left: "8px" }
    : corner === "bottom-right" ? { bottom: "8px", right: "8px" }
    : corner === "top-left" ? { top: "8px", left: "8px" }
    : { top: "8px", right: "8px" };

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute", ...place, zIndex: 5, pointerEvents: "none",
        padding: "3px 7px", borderRadius: "6px",
        /* Its own dark plate rather than plain text: a frame can be a night scene or a white wall,
           and text alone disappears into one of the two. The plate is the scrim token, so it reads
           as chrome over media the way the map's own overlays do. */
        backgroundColor: "var(--scrim)",
        color: "white", opacity: 0.72,
        fontSize: "10px", fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        /* Selection off, so dragging across a frame does not pick the stamp up instead. Not a
           protection — see the note at the top. */
        userSelect: "none",
      }}
    >
      {stamp}
    </span>
  );
}
