// Timezone-aware "today"/"hour of day" helpers. Nearly every place that buckets data by day or
// hour used to do it with plain `Date` methods (`.toDateString()`, `.getHours()`), which read the
// BROWSER's local timezone. An operator whose machine is not set to the site's zone silently gets
// "today" and hour-of-day boundaries computed against their own midnight — most visible right
// around midnight, where a device hours behind shows yesterday's last hours as "today". These
// centralize the one correct definition so every date-bucketing call site agrees.
//
// UPDATED 2026-09-09 — the zone now follows the site being viewed, not Singapore.
//
// The backend confirmed the shape: every instant crosses the wire as UTC (`...Z`) and the client
// converts; the only place the server uses site time is the day boundary of its daily aggregates.
// A timezone belongs to a project — a site has a location, an account does not — and
// `Project.timeZone` (IANA) already carries it.
//
// The `sgt` prefix on the exports below is now historical: they follow whatever site is on screen.
// Renaming them is a safe mechanical follow-up across ~122 call sites; the behaviour is here.

/** Used when no site is resolved yet, and for the mock stamp loop below. */
export const FALLBACK_TIME_ZONE = "Asia/Singapore";

/** Kept for the Portal screens that already read this as their default when a project carries no
 *  zone of its own. Same value as FALLBACK_TIME_ZONE. */
export const PROJECT_TIME_ZONE = FALLBACK_TIME_ZONE;

/**
 * How this module finds the site's zone.
 *
 * Injected rather than imported: the store imports this file, so this file cannot import the
 * store. `vcaStore.ts` registers the resolver at the end of its own module, which runs before any
 * screen renders.
 *
 * The resolver answers "the site the monitoring app is pointed at". A Portal screen showing one
 * specific project's times should pass that project's zone explicitly instead — as
 * PortalProjectDetailPage already does — because the console can be looking at a project other
 * than the one the app has selected.
 */
let resolveSiteZone: () => string = () => FALLBACK_TIME_ZONE;

export function setSiteTimeZoneResolver(resolver: () => string): void {
  resolveSiteZone = resolver;
}

/** The zone every date, hour and clock string below is computed in. */
export function siteTimeZone(): string {
  return resolveSiteZone();
}

// Intl.DateTimeFormat construction is not free and these run inside render paths and list loops,
// so formatters are built once per (zone, shape) instead of per call.
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, zone: string, shape: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${shape}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: zone, ...options });
    formatterCache.set(key, f);
  }
  return f;
}

// ── Primitives, explicit about their zone ──────────────────────
/**
 * Y-M-D key for `d` in an arbitrary zone.
 *
 * Exported for the same reason zoneHour is: Portal has a specific project in hand and so knows
 * better than siteTimeZone(), which answers "the site the monitoring app is pointed at" — a
 * different selection from the one the console is showing. sgtDateKey() on a Portal screen
 * prints the app's day over the console's project.
 */
export function dateKeyIn(d: Date, zone: string): string {
  return formatter("en-CA", zone, "dateKey", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function hourIn(d: Date, zone: string): number {
  // Intl gives "24" for midnight with hour12:false in some engines instead of "00" — normalize.
  return parseInt(formatter("en-GB", zone, "hour", { hour: "2-digit", hour12: false }).format(d), 10) % 24;
}
function minuteIn(d: Date, zone: string): number {
  return parseInt(formatter("en-GB", zone, "minute", { minute: "2-digit" }).format(d), 10);
}
function clockIn(d: Date, zone: string): string {
  return formatter("en-GB", zone, "clock", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
}
/** HH:MM for `d` in an arbitrary zone. Exported alongside dateKeyIn, same reason. */
export function clockMinutesIn(d: Date, zone: string): string {
  return formatter("en-GB", zone, "clockMin", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Y-M-D key for `d` in the site's time — use this instead of `.toDateString()` for "is this
 * today" comparisons. */
export function sgtDateKey(d: Date): string {
  return dateKeyIn(d, siteTimeZone());
}

/** True if `a` and `b` fall on the same calendar day at the site. */
export function isSameSgtDay(a: Date, b: Date): boolean {
  return sgtDateKey(a) === sgtDateKey(b);
}

/** True if `d` falls on today's calendar day at the site (as of `now`, defaulting to the real
 * current time). This is the day boundary the backend's daily aggregates also cut on. */
export function isTodaySgt(d: Date, now: Date = new Date()): boolean {
  return isSameSgtDay(d, now);
}

/** Hour of day (0-23) for `d` in an arbitrary zone — for a caller that has a specific project in
 * hand and so knows better than the site currently on screen (the Overview's greeting). */
export function zoneHour(d: Date, zone: string): number {
  return hourIn(d, zone);
}

/** Hour of day (0-23) for `d` in the site's time — use this instead of `.getHours()` for
 * hour-of-day bucketing. */
export function sgtHour(d: Date): number {
  return hourIn(d, siteTimeZone());
}

/** Minute of hour (0-59) for `d` in the site's time — use this instead of `.getMinutes()` when
 * placing a point within its hour bucket. */
export function sgtMinute(d: Date): number {
  return minuteIn(d, siteTimeZone());
}

/** "HH:MM" clock string at the site for `d` — the same instant sgtClockTime gives, without the
 * seconds, for stamps where the minute is as precise as the record actually is (a registration,
 * an invitation). Resolved from the site rather than the machine, so a server render and a browser
 * render agree; `toLocaleTimeString` would read the viewer's own zone and tear on hydration. */
export function sgtClockMinutes(d: Date): string {
  return clockMinutesIn(d, siteTimeZone());
}

/** "HH:MM:SS" clock string at the site for `d` — for showing an actual captured time rather
 * than a relative "Xh ago" label. */
export function sgtClockTime(d: Date): string {
  return clockIn(d, siteTimeZone());
}

/**
 * How coarse a mock stamp is, in minutes.
 *
 * Exported because it is a limit on what mock data can be asked: a screen cannot claim "detected
 * within the last two minutes" from stamps rounded to ten. See coarseNow below for why they are.
 */
export const MOCK_STAMP_GRANULARITY_MIN = 10;

/** "Now," rounded down to the nearest 10 minutes. A server-render pass and the client-hydration
 * pass moments later read `Date.now()` at two genuinely different instants — rounding this
 * coarsely means both passes almost always land in the same bucket, avoiding a text hydration
 * mismatch on any display seeded from this. */
function coarseNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / MOCK_STAMP_GRANULARITY_MIN) * MOCK_STAMP_GRANULARITY_MIN);
  return d;
}

/**
 * ── The mock stamp loop ────────────────────────────────────────
 *
 * These three (recentSgtClockTime · recentSgtStamp · parseSgtStamp) stay pinned to
 * FALLBACK_TIME_ZONE, and that is deliberate.
 *
 * They are one closed loop: seeds are written as `{date, time}` wall-clock pairs at module load —
 * which happens before any site is resolved — and read back later by parseSgtStamp to measure the
 * gap between two sightings. If the writer used the fallback and the reader used the site's zone,
 * every seeded gap would shift by the offset between them and the elapsed times on screen would
 * be wrong. Pinning both ends keeps the loop honest with itself.
 *
 * The cost is that a seeded sighting's absolute clock label reads in the fallback zone at a site
 * in another one. That is mock data and goes when real detections arrive — at which point these
 * three go with it. Live data is unaffected: it carries a real instant and renders through
 * sgtClockTime, which follows the site.
 */
export function recentSgtClockTime(minutesAgo: number, secondsAgo: number = 0): string {
  const t = new Date(coarseNow().getTime() - minutesAgo * 60000 - secondsAgo * 1000);
  return clockIn(t, FALLBACK_TIME_ZONE);
}

/** A canned sighting timestamp `minutesAgo` (+ optional `secondsAgo`) before the same coarse,
 * hydration-safe "now" `recentSgtClockTime` uses, as the `{ date, time }` pair mock hit records
 * carry. Seeded sightings written as fixed calendar dates drift further into the past every week
 * until "time since last seen" reads in months; anchoring them to now keeps a demo honest. */
export function recentSgtStamp(minutesAgo: number, secondsAgo: number = 0): { date: string; time: string } {
  const t = new Date(coarseNow().getTime() - minutesAgo * 60000 - secondsAgo * 1000);
  return { date: dateKeyIn(t, FALLBACK_TIME_ZONE), time: clockIn(t, FALLBACK_TIME_ZONE) };
}

/** Turns a `{ date, time }` pair from recentSgtStamp back into a Date, so the gap between two
 * sightings can be measured from the sightings themselves instead of hand-written beside them —
 * where it drifts out of agreement with the timestamps it's supposed to describe. Reads the pair in
 * the zone recentSgtStamp wrote it in; see the note above. */
export function parseSgtStamp(date: string, time: string): Date {
  return wallClockToDate(date, time, FALLBACK_TIME_ZONE);
}

/**
 * A wall-clock date+time in a named zone, as an instant.
 *
 * Not `new Date(\`${date}T${time}+08:00\`)` any more — a fixed offset is only right for one zone,
 * and it is wrong twice a year for any zone with daylight saving. Reads the offset the zone
 * actually had at that moment: interpret the wall clock as UTC, ask what that instant looks like
 * in the zone, and correct by the difference. Twice, because the first correction can cross a DST
 * boundary and change the offset that applies.
 */
export function wallClockToDate(date: string, time: string, zone: string): Date {
  const asIfUtc = new Date(`${date}T${time}Z`);
  let guess = new Date(asIfUtc.getTime() - zoneOffsetMs(asIfUtc, zone));
  guess = new Date(asIfUtc.getTime() - zoneOffsetMs(guess, zone));
  return guess;
}

/** How far ahead of UTC `zone` was at the instant `at`, in milliseconds. */
function zoneOffsetMs(at: Date, zone: string): number {
  const parts = formatter("en-GB", zone, "offsetParts", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? "0");
  // Intl can render midnight as hour 24; Date.UTC rolls that into the next day, which is correct.
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

/** The unit letters, per language. Korean does not read "2h 05m". */
const ELAPSED_UNITS = {
  en: { d: "d", h: "h", m: "m", s: "s" },
  ko: { d: "일", h: "시간", m: "분", s: "초" },
} as const;

/** Human duration for a gap between sightings: "1d 55m", "2h 05m", "30m 32s", "45s" — or
 * "1일 55분", "2시간 05분" in Korean. Two units at most: a seconds figure on a multi-day gap is
 * noise, and the smaller unit is zero-padded so a column of these doesn't jitter as it ticks.
 *
 * Takes the language rather than reading it, like formatTimeAgo: some callers build HTML strings
 * and have no hook to read it with. Defaults to English so an un-migrated caller keeps working.
 *
 * A NEGATIVE gap is not zero. A camera or server clock running ahead of this one produces a
 * sighting in the future, and clamping that to "0s" dressed a clock-skew problem up as "just
 * now" — the one reading an operator cannot act on. It says so instead. */
export function formatElapsed(ms: number, lang: "en" | "ko" = "en"): string {
  const u = ELAPSED_UNITS[lang];
  if (ms < -1000) return lang === "ko" ? "시각 어긋남" : "clock ahead";
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return h > 0 ? `${d}${u.d} ${pad(h)}${u.h}` : `${d}${u.d} ${pad(m)}${u.m}`;
  if (h > 0) return `${h}${u.h} ${pad(m)}${u.m}`;
  if (m > 0) return `${m}${u.m} ${pad(sec)}${u.s}`;
  return `${sec}${u.s}`;
}
