// Timezone-aware "today"/"hour of day" helpers — this app is Singapore-only (see Navbar's header
// clock), but nearly every place that buckets data by day or hour used to do it with plain
// `Date` methods (`.toDateString()`, `.getHours()`), which read the BROWSER's local timezone, not
// Singapore's. An operator whose machine isn't set to SGT would silently get "today" and
// hour-of-day boundaries computed against their own midnight/hour, not Singapore's — most visible
// right around SGT midnight, where a device in a timezone hours behind could show yesterday's
// last few hours as "today," or vice versa. These centralize the one correct definition (matching
// Navbar's own `Intl.DateTimeFormat` usage) so every date-bucketing call site agrees.

const SGT_TIME_ZONE = "Asia/Singapore";

/**
 * The zone every date and hour in this product is computed in, exported so screens can hand it to
 * Intl directly instead of re-typing the string.
 *
 * One constant because the deployment is one country. It is named for the project rather than for
 * Singapore on purpose: a timezone belongs to a project (a site has a location; an account does
 * not), and the plan is to store it per project and look it up here — confirmed 2026-09-08. When
 * that lands, this becomes a function of a project id and the call sites already read as if it
 * were one.
 */
export const PROJECT_TIME_ZONE = SGT_TIME_ZONE;

const sgtDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SGT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const sgtHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, hour: "2-digit", hour12: false,
});
const sgtMinuteFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, minute: "2-digit",
});

/** Y-M-D key for `d` in Singapore time — use this instead of `.toDateString()` for "is this
 * today" comparisons. */
export function sgtDateKey(d: Date): string {
  return sgtDateKeyFormatter.format(d);
}

/** True if `a` and `b` fall on the same Singapore calendar day. */
export function isSameSgtDay(a: Date, b: Date): boolean {
  return sgtDateKey(a) === sgtDateKey(b);
}

/** True if `d` falls on today's Singapore calendar day (as of `now`, defaulting to the real
 * current time). */
export function isTodaySgt(d: Date, now: Date = new Date()): boolean {
  return isSameSgtDay(d, now);
}

/**
 * Hour of day (0-23) for `d` in an arbitrary zone.
 *
 * For the one caller that has a project in hand and so knows better than the deployment default —
 * the Overview's greeting. Everything else in this file is still fixed to Singapore, because the
 * data it buckets is city-wide and has no project to ask.
 */
export function zoneHour(d: Date, zone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hour12: false }).format(d),
    10,
  ) % 24;
}

/** Hour of day (0-23) for `d` in Singapore time — use this instead of `.getHours()` for
 * hour-of-day bucketing. */
export function sgtHour(d: Date): number {
  // Intl gives "24" for midnight with hour12:false in some engines instead of "00" — normalize.
  return parseInt(sgtHourFormatter.format(d), 10) % 24;
}

/** Minute of hour (0-59) for `d` in Singapore time — use this instead of `.getMinutes()` when
 * placing a point within its hour bucket. */
export function sgtMinute(d: Date): number {
  return parseInt(sgtMinuteFormatter.format(d), 10);
}

const sgtClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

const sgtClockMinutesFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
});

/** "HH:MM" Singapore-time clock string for `d` — the same instant sgtClockTime gives, without the
 * seconds, for stamps where the minute is as precise as the record actually is (a registration,
 * an invitation). Fixed timezone, so a server render and a browser render agree; `toLocaleTimeString`
 * would read the machine's own zone and tear on hydration. */
export function sgtClockMinutes(d: Date): string {
  return sgtClockMinutesFormatter.format(d);
}

/** "HH:MM:SS" Singapore-time clock string for `d` — for showing an actual captured time rather
 * than a relative "Xh ago" label. */
export function sgtClockTime(d: Date): string {
  return sgtClockFormatter.format(d);
}

/** "Now," rounded down to the nearest 10 minutes. A server-render pass and the client-hydration
 * pass moments later read `Date.now()` at two genuinely different instants — rounding this
 * coarsely means both passes almost always land in the same bucket, avoiding a text hydration
 * mismatch on any display seeded from this. */
function coarseNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / 10) * 10);
  return d;
}

/** A mock "recent detection" clock time — `minutesAgo` (+ optional `secondsAgo`) before a coarse,
 * hydration-safe "now," formatted as Singapore-time "HH:MM:SS". Use this instead of a literal
 * hardcoded clock string for canned/seed detection data, so it always reads as plausibly recent
 * relative to the ACTUAL current time instead of silently drifting into the past — or even the
 * future — as real time passes. */
export function recentSgtClockTime(minutesAgo: number, secondsAgo: number = 0): string {
  const t = new Date(coarseNow().getTime() - minutesAgo * 60000 - secondsAgo * 1000);
  return sgtClockTime(t);
}

/** A canned sighting timestamp `minutesAgo` (+ optional `secondsAgo`) before the same coarse,
 * hydration-safe "now" `recentSgtClockTime` uses, as the `{ date, time }` pair mock hit records
 * carry. Seeded sightings written as fixed calendar dates drift further into the past every week
 * until "time since last seen" reads in months; anchoring them to now keeps a demo honest. */
export function recentSgtStamp(minutesAgo: number, secondsAgo: number = 0): { date: string; time: string } {
  const t = new Date(coarseNow().getTime() - minutesAgo * 60000 - secondsAgo * 1000);
  return { date: sgtDateKey(t), time: sgtClockTime(t) };
}

/** Turns a `{ date, time }` Singapore-time pair back into a Date, so the gap between two
 * sightings can be measured from the sightings themselves instead of hand-written beside them —
 * where it drifts out of agreement with the timestamps it's supposed to describe. */
export function parseSgtStamp(date: string, time: string): Date {
  return new Date(`${date}T${time}+08:00`);
}

/** Human duration for a gap between sightings: "1d 55m", "2h 05m", "30m 32s", "45s". Two units at
 * most — a seconds figure on a multi-day gap is noise, and the smaller unit is zero-padded so a
 * column of these doesn't jitter as it ticks. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return h > 0 ? `${d}d ${pad(h)}h` : `${d}d ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
}
