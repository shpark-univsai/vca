"use client";

import { useEffect, useRef } from "react";

/**
 * Run `onChange` when `value` actually changes — not on mount, and not when the effect merely
 * re-runs.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────────────────
 *
 * The site-scoping work needed "the header switched site, so throw away what belonged to the old
 * one" in nine places, and every one of them was written the same way:
 *
 *   const firstRef = useRef(true);
 *   useEffect(() => {
 *     if (firstRef.current) { firstRef.current = false; return; }
 *     clearSomething();
 *   }, [projectId, clearSomething]);
 *
 * That guard asks "is this the first run", and it is wrong twice.
 *
 * 1. A ref SURVIVES StrictMode's simulated unmount/remount. React's development mode mounts,
 *    unmounts and remounts every component once; state resets, refs do not. So the second effect
 *    pass sees `firstRef.current === false` and fires — on mount, with the site unchanged. That
 *    is a real, reproducible defect, not a theoretical one: the Dashboard's "View Full Trace on
 *    Redmap" deep-link landed on an empty search form in dev and worked in `next start`, because
 *    the guard wiped the search RedmapPage had just set up. Re-ID, Smart Search and the sidebar's
 *    person filter were all being cleared on mount the same way.
 *
 * 2. It fires on any re-run, whatever changed. These effects list a callback in their deps (the
 *    honest thing to do), and those callbacks are rebuilt when the site's derived data changes —
 *    so a new `siteCameras` identity alone was enough to throw away a finished search the site
 *    switch had nothing to do with.
 *
 * Comparing the previous VALUE fixes both: double invocation is idempotent, and an unrelated
 * re-run compares equal and does nothing.
 *
 * ── Note on the callback ─────────────────────────────────────────────────────────────────────
 *
 * `onChange` is held in a ref, so it does not have to be memoized and cannot itself re-trigger
 * the comparison. Only `value` decides whether the effect body runs.
 *
 * Not for "run once on mount" — that is a plain effect with no dependencies. This is specifically
 * "react to a change", which is the thing the guard above was trying and failing to express.
 */
export function useOnValueChange<T>(value: T, onChange: (previous: T, next: T) => void) {
  const previous = useRef(value);
  const handler = useRef(onChange);
  useEffect(() => { handler.current = onChange; }, [onChange]);
  useEffect(() => {
    if (previous.current === value) return;
    const from = previous.current;
    previous.current = value;
    handler.current(from, value);
  }, [value]);
}
