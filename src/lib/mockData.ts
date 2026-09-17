import { dateKeyIn, FALLBACK_TIME_ZONE, isTodaySgt, sgtClockTime, sgtDateKey, wallClockToDate, zoneHour } from "@/lib/time";

export const FACE_PHOTOS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=120&q=80",
];

export function getFacePhoto(eventId: string): string {
  // A plain parseInt() only works for purely-numeric ids ("1", "2", ...) — any id with a
  // non-numeric prefix (e.g. a simulated live-alert id) parses to NaN, so FACE_PHOTOS[NaN]
  // comes back undefined and the <img> renders broken. Hash the whole string instead so any
  // id shape maps to a valid, stable photo.
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash * 31 + eventId.charCodeAt(i)) | 0;
  }
  return FACE_PHOTOS[Math.abs(hash) % FACE_PHOTOS.length];
}

// The 17 Singapore district centers used by the Dashboard map's zoomed-out cluster-pill view
// (and, historically, RedmapMap's now-disabled STATUS_ZONES) — shared reference data so both
// the camera-count and today's-VIP-count aggregations bucket detections/cameras the same way.
export interface District { id: string; label: string; lat: number; lng: number; }

export const DISTRICTS: District[] = [
  { id: "amk",  label: "Angmokio",     lat: 1.3691, lng: 103.8454 },
  { id: "sea",  label: "Serangoon",    lat: 1.3554, lng: 103.8679 },
  { id: "geo1", label: "Geylang",      lat: 1.3202, lng: 103.8649 },
  { id: "aug",  label: "August",       lat: 1.3380, lng: 103.8840 },
  { id: "houg", label: "Hougang",      lat: 1.3717, lng: 103.8927 },
  { id: "geo2", label: "Geylang",      lat: 1.3108, lng: 103.8572 },
  { id: "bis",  label: "Bishan",       lat: 1.3517, lng: 103.8490 },
  { id: "bkt",  label: "Bukit",        lat: 1.3522, lng: 103.7786 },
  { id: "tp",   label: "Toa payoh",    lat: 1.3343, lng: 103.8565 },
  { id: "nov",  label: "Novena",       lat: 1.3195, lng: 103.8410 },
  { id: "kal1", label: "Kallang",      lat: 1.3108, lng: 103.8715 },
  { id: "geo3", label: "Geylang",      lat: 1.3158, lng: 103.8920 },
  { id: "bdk",  label: "Bedok",        lat: 1.3250, lng: 103.9291 },
  { id: "tam",  label: "Tampines",     lat: 1.3527, lng: 103.9442 },
  { id: "cen",  label: "Central area", lat: 1.2895, lng: 103.8500 },
  { id: "mar",  label: "Marine",       lat: 1.3020, lng: 103.9090 },
  { id: "kal2", label: "Kallang",      lat: 1.3088, lng: 103.8648 },
];

// Shared by MapView.tsx (aggregating the cluster-pill counts) and Sidebar.tsx (filtering the
// events list to just one district's pins when a pill is clicked) — both need to bucket a given
// lat/lng into the SAME district, or a pill's count and what clicking it shows would disagree.
/**
 * Which district a coordinate belongs to — by NEAREST CENTRE, not by containment.
 *
 * Every district figure in this product stands on this function: the map's district pills, the
 * sidebar's district filter, the counts a customer takes upstairs to argue for more cameras. So
 * the approximation it still makes is worth stating rather than discovering.
 *
 * NEAREST CENTRE IS NOT INSIDE. A camera a street inside Novena but closer to Kallang's centre is
 * counted as Kallang's. There are no boundaries here to test against — DISTRICTS holds one point
 * per district — so "inside" is not a question this data can answer. The server is expected to
 * resolve it with real GIS (confirmed as the expectation 2026-09-11; the backend's own answer is
 * still outstanding, see HANDOFF.md beside contract 4). When a detection arrives carrying a
 * district id, that id wins and this function stops being load-bearing — it is replaced, not
 * cross-checked against. Two answers to one question is how the map and the list come to disagree.
 *
 * Boundary data is per city, not per product: an on-premise Seoul install cannot use Singapore's.
 *
 * The second approximation this carried until 2026-09-11 is gone. It compared raw degrees, which
 * treats a degree of longitude as the same length as a degree of latitude — true enough at
 * Singapore's ~1.35°N (they differ by 0.03%), and that was a fact about the LATITUDE rather than
 * about the code. At Seoul's 37.5°N a degree of longitude is 79% of a degree of latitude, so the
 * same call pulled attribution east–west, and it would have done so silently: the pills would
 * still have shown confident numbers, in the wrong districts, for the customer deciding where to
 * install cameras next. The cosine factor below costs one multiplication and removes the trap.
 */
/** Kilometres between two points, near enough at city scale. Longitude degrees shrink toward the
 *  poles and latitude degrees do not, so Δlng is scaled by cos(lat) to make the two comparable. */
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const lngScale = Math.cos(((aLat + bLat) / 2 * Math.PI) / 180);
  return Math.hypot(aLat - bLat, (aLng - bLng) * lngScale) * 111.29;
}

/**
 * How far from a district's centre a point can be and still belong to it.
 *
 * DERIVED FROM THE DISTRICT LAYOUT, not typed in, because this list is per installation — a
 * hard-coded radius tuned on Singapore would be wrong in the next city the product ships to. The
 * measure is the median distance from each district centre to its nearest neighbour: past that,
 * a point is closer to the gaps between districts than to any district, and calling it a member
 * of the nearest one is a guess dressed as a fact.
 *
 * `nearestDistrict` has no such limit and never did, which is how a detection 6.8 km outside the
 * whole grid (a seed at "Yishun MRT", since moved) was counted into Angmokio's tally. District
 * tallies are the evidence a customer buys cameras on, so a point outside the grid has to read as
 * outside rather than as somebody's number going up.
 *
 * On Singapore's seventeen this comes to about 2.1 km. An earlier version of this comment claimed
 * the answer was insensitive to the choice — that anything from 2.1 to 4.3 km excluded the same
 * two cameras. That was measured on proj-sg alone and is false across the register: at 2.1 km
 * eight cameras fall outside, and six of them (all of Riverside International School, 3.50–3.96 km
 * from Bukit) come back in at 4.0 km. The rule is a fitted constant. Saying so is the point.
 *
 * WHAT THIS ENCODES, AND WHY IT IS STILL THE LEAST-WRONG GUESS.
 *
 * A median is region-agnostic in its NUMBER and not in its ASSUMPTION: it assumes district centres
 * are roughly evenly spaced, so one distance can describe all of them. Singapore's spacing already
 * runs 0.78 km to 7.67 km, and a layout with a dense core and far-flung outer districts (Ulaanbaatar
 * has six central duureg a few km apart and Baganuur 130 km east) makes the median describe the core
 * and cut the outskirts off. Undercounting is as damaging as overcounting here and just as quiet —
 * no number inflates, the pill simply never appears.
 *
 * The obvious repair — give each district its own reach, max(median, its own nearest-neighbour) —
 * was measured and rejected. It flips seven cameras in, and six of them are Riverside's campus,
 * which would then be labelled "Bukit" on the school's own map. Trading a silent undercount for a
 * confident wrong label on a customer-facing screen is the worse of the two, and it does not even
 * hold at the boundary: with two districts the rule degenerates to their separation, which is no
 * limit at all.
 *
 * Neither rule can be right, because the input cannot answer the question — seventeen points carry
 * no boundaries, and no function over them produces one. So this stays a stopgap with its
 * assumption written down, and the fix is contract sentence 8: attribution comes from the register's
 * `Camera.zone`, which the installer already filled in, and this geometry is deleted rather than
 * tuned. Riverside's cameras are zoned "Campus" and "Perimeter" — the right answer was in the
 * register the whole time.
 *
 * One more defect this cannot fix, recorded rather than patched: DISTRICTS is a module constant
 * while cameras are per project, so a school site draws seventeen Singapore administrative
 * districts. The district list has to become per project, and that lands when the server delivers
 * it, not before.
 */
export const DISTRICT_REACH_KM: number = (() => {
  if (DISTRICTS.length < 2) return Infinity;
  const nearest = DISTRICTS.map((a, i) =>
    Math.min(...DISTRICTS.filter((_, j) => j !== i).map(b => kmBetween(a.lat, a.lng, b.lat, b.lng))),
  ).sort((x, y) => x - y);
  const mid = Math.floor(nearest.length / 2);
  return nearest.length % 2 ? nearest[mid] : (nearest[mid - 1] + nearest[mid]) / 2;
})();

/**
 * The district a point belongs to, or undefined — the only district function callers should use.
 *
 * Two ways to belong to none, and both are real: the point may not exist (a sighting on a camera
 * nobody has surveyed — callers used to pass `?? 0`, and `nearestDistrict(0, 0)` answers with a
 * real Singapore district), or it may lie outside the grid (see DISTRICT_REACH_KM).
 */
export function districtIdAt(lat: number | undefined, lng: number | undefined): string | undefined {
  if (lat === undefined || lng === undefined) return undefined;
  const d = nearestDistrict(lat, lng);
  return kmBetween(lat, lng, d.lat, d.lng) <= DISTRICT_REACH_KM ? d.id : undefined;
}

/**
 * The district a REGISTERED CAMERA belongs to. Name first; geometry only breaks ties.
 *
 * Cameras are not detections. A camera carries `zone` — typed in by whoever installed it, editable
 * in the console, bulk-movable — and that value is the answer to "which district is this in".
 * `districtIdAt` was being used here instead, which threw the register away and re-guessed from
 * coordinates. Measured 2026-09-16 on the ten named proj-sg cameras: it was wrong on FIVE.
 *
 *   Geylang NC1  zone Geylang     → answered Kallang  (0.83 km)
 *   Geylang NC2  zone Geylang     → answered Kallang  (1.04 km)
 *   Orchard MRT  zone Orchard     → answered Novena   (1.95 km)
 *   Bugis MRT    zone Bugis       → answered Geylang  (1.14 km)
 *   Phone test   zone Marina Bay  → answered Central area (1.33 km)
 *
 * And it was not quiet: clicking the Kallang pill filters the sidebar to Kallang, and a row in
 * that list reads "Geylang · NC1". District tallies are what a customer takes upstairs to argue
 * for more cameras, so a wrong one buys cameras for the wrong neighbourhood.
 *
 * WHY GEOMETRY STILL APPEARS HERE, AND WHY IT IS SAFE NOW. DISTRICTS has duplicate labels —
 * Geylang three times, Kallang twice, fourteen names over seventeen points. A zone of "Geylang"
 * names all three, so something has to pick one. Geometry picks, but ONLY among points that
 * already share the register's name: it can narrow, never cross. That is the whole difference
 * from `districtIdAt`, which could hand a Geylang camera to Kallang.
 *
 * A zone the district list does not contain answers `undefined` — deliberately. Five of the
 * register's zone values are not in DISTRICTS (Queenstown · Jurong East · Orchard · Marina Bay ·
 * Bugis), and three of those were the false attributions above. Absent is the truthful answer and
 * it is the one that keeps the gap visible: the fix is for the server to deliver the district list
 * in the register's own zone namespace (contract sentence 8), not for this function to guess
 * harder.
 *
 * Detections still go through `districtIdAt`, because a hit carries coordinates and no camera id.
 * That asymmetry is not an oversight — it is the shape of the contract gap, and it closes when
 * `TrackingHop.cameraId` arrives.
 */
export function districtIdForCameraZone(zone: string, lat?: number, lng?: number): string | undefined {
  const named = DISTRICTS.filter(d => d.label === zone);
  if (named.length === 0) return undefined;
  if (named.length === 1) return named[0].id;
  // Same name, several points, and no coordinate to choose with: the first, deliberately. The pill
  // a reader sees is labelled by NAME, and the name is right either way — "Depot Bay 2", zone
  // Kallang and never surveyed, is in Kallang. Dropping it from all of them would undercount a
  // camera whose district the register actually knows.
  if (lat === undefined || lng === undefined) return named[0].id;
  let best = named[0], bestKm = Infinity;
  for (const d of named) {
    const km = kmBetween(lat, lng, d.lat, d.lng);
    if (km < bestKm) { bestKm = km; best = d; }
  }
  return best.id;
}

/**
 * Raw nearest centre, with no limit. Prefer `districtIdAt` — this answers "which is closest",
 * which is not the same question as "which does it belong to", and the difference is the bug
 * DISTRICT_REACH_KM exists to stop.
 */
export function nearestDistrict(lat: number, lng: number): District {
  const lngScale = Math.cos((lat * Math.PI) / 180);
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dLat = d.lat - lat;
    const dLng = (d.lng - lng) * lngScale;
    const dist = dLat ** 2 + dLng ** 2;
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

// User-configurable via My Page → "Map Alert Thresholds" — read from localStorage by MapView.tsx,
// not hardcoded, since different operators may want a different count to count as "alert" vs
// "moderate" for the district cluster pills.
export const DISTRICT_ALERT_THRESHOLD_KEY = "vca-district-alert-threshold";
export const DISTRICT_MODERATE_THRESHOLD_KEY = "vca-district-moderate-threshold";
export const DEFAULT_DISTRICT_ALERT_THRESHOLD = 100;
export const DEFAULT_DISTRICT_MODERATE_THRESHOLD = 20;

// Deterministic pseudo-random in [0,1) — a plain Math.random() would differ between the
// server-rendered and client-hydrated pass and trigger a hydration mismatch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type SidebarTab = "EVENTS" | "SYSTEM";
export type FilterType = "All" | "VIP Detection" | "Tracking";
export type EventType = "VIP" | "Tracking";
export type DeviceStatus = "Live" | "Off";

/** One hop in a Tracking event's multi-camera trail — where and when the same subject was
 * re-identified as it moved between cameras. */
export interface TrackingHop {
  location: string;
  cameraLabel?: string;
  timestamp: string;
  /**
   * Where this hop happened.
   *
   * Carried rather than re-derived. A trail's hops each have their own coordinate at the source
   * (RawVipHit does), and dropping them meant anything that needed to place a hop on a map had to
   * work back from `location` through the camera roster — which falls back to the first camera
   * when a name does not resolve, and silently puts a sighting in a district kilometres away.
   *
   * Optional because the seeds predate it and a hop written before this carries none.
   */
  lat?: number;
  lng?: number;
  /** The VIP confidence this specific hit was originally detected at — kept so a hop that later
   * reverts from a Tracking trail back into a plain VIP row (see vcaStore.ts's addEvent/
   * personHitHistory) can show its real confidence instead of a fabricated 0%. */
  confidence?: number;
}

export interface LiveEvent {
  id: string;
  name: string;
  description?: string;
  confidence: number;
  /** Zone/site name only (e.g. "Geylang") — keep camera-specific info out of this so location
   * filtering and map zone aggregation group same-site cameras together instead of splintering
   * per camera. See cameraLabel for which camera within that site made the detection. */
  location: string;
  cameraLabel?: string;
  /** ISO timestamp — display "time ago" is derived from this via formatTimeAgo(), never stored as a static string. */
  timestamp: string;
  type: EventType;
  /** Present only for type "Tracking" — the multi-camera re-id trail shown instead of a single photo row. */
  path?: TrackingHop[];
  /**
   * Where it happened — absent when the camera has no surveyed position (see Camera.lat).
   *
   * These were required, so every converter wrote `?? 0` and a detection on an unplaced camera
   * became a detection in the Gulf of Guinea. Worse than the pin: `nearestDistrict(0, 0)` cheerfully
   * returns a Singapore district, so the hit was also COUNTED into whichever one happens to be
   * nearest the equator. MapView already tested `lat !== undefined` in four places; the fill made
   * those tests dead code.
   */
  lat?: number;
  lng?: number;
}

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Renders an ISO timestamp as a relative "Xm ago" string for anything under an hour old,
 * computed at render time. Past an hour, a coarse "1h ago"/"2h ago" label stops being useful for
 * "when exactly did this happen" — so it switches to the actual captured clock time instead, with
 * the day whenever that is not today.
 *
 * The day is not optional. A bare clock on a record from another day reads as today: at a site
 * clock of 01:00, a sighting from 23:10 the previous night showed "23:10:00" in a list where the
 * row above it said "5m ago" — twenty-two hours into the future, as far as anyone reading it
 * could tell.
 *
 * Takes the language rather than reading it: this is called from map popups built as HTML strings
 * and from render paths that are not components, so there is no hook to read it with. */
export function formatTimeAgo(timestamp: string, lang: "en" | "ko" = "en"): string {
  const at = new Date(timestamp);
  const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000));
  if (mins < 1) return lang === "ko" ? "방금" : "just now";
  if (mins < 60) return lang === "ko" ? `${mins}분 전` : `${mins}m ago`;
  const clock = sgtClockTime(at);
  if (isTodaySgt(at)) return clock;
  const [, m, d] = sgtDateKey(at).split("-").map(Number);
  return lang === "ko" ? `${m}월 ${d}일 ${clock}` : `${SHORT_MONTHS[m - 1]} ${d} ${clock}`;
}

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60000).toISOString();
}

export interface Device {
  id: string;
  status: DeviceStatus;
  name: string;
  type: string;
  ip: string;
  /** Optional for the same reason Camera's are: a registered camera may have no survey yet, and
   *  it still belongs in the device list. Readers derive nothing from a missing position. */
  lat?: number;
  lng?: number;
  lastSeen: string;
}

export interface MapMarker {
  lat: number;
  lng: number;
  type: EventType;
}

// Raw detections are ALWAYS VIP at the source — there's no separate "Tracking" category
// coming from a camera. "Tracking" is a derived view: once the same VIP has been picked up
// by 2+ distinct cameras, those hits get merged into one trail entry instead of shown as
// separate rows. See deriveLiveEvents() below.
interface RawVipHit {
  id: string;
  name: string;
  confidence: number;
  location: string;
  cameraLabel?: string;
  timestamp: string;
  /** Absent when the camera has no surveyed position — a hit's coordinate IS its camera's, so it
   *  is missing under exactly the same condition (see Camera.lat). Required until now, which is
   *  why no seed could express the case the product has to handle. */
  lat?: number;
  lng?: number;
}

/**
 * Today at a wall-clock hour and minute, on the clock the rest of the mock seeds are written on.
 *
 * `setHours()` wrote these on the MACHINE's clock while every reader measures them against a site
 * clock (isTodaySgt, sgtHour). On a machine in another zone the day's hits therefore landed in the
 * wrong hours and some fell out of "today" entirely: on a UTC machine at 14:00 site time the
 * sidebar counted 25 detections instead of 72, and the activity chart drew the day's peak
 * wherever the offset put it — once in the small hours. Two ends of one measurement, read on two
 * different clocks.
 *
 * Pinned to FALLBACK_TIME_ZONE, which is where the rest of the mock stamp loop lives (see the note
 * in lib/time.ts): these are module-load seeds, written before any site is resolved, so they
 * cannot be written on the site's clock. What this fixes is that they no longer depend on where
 * the person looking at the screen happens to be sitting.
 */
function todayAt(hour: number, minute: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = dateKeyIn(new Date(), FALLBACK_TIME_ZONE);
  return wallClockToDate(day, `${pad(hour)}:${pad(minute)}:00`, FALLBACK_TIME_ZONE).toISOString();
}

// A brand-new, non-overlapping identity pool (not one of the names above) — each tied to exactly
// one fixed location, so none of these can ever accumulate a 2nd distinct camera and get
// deriveLiveEvents()-merged into a "Tracking" trail. That would silently drop them from the VIP
// count the detection chart plots, undoing the point of generating them.
// Locations deliberately reuse the 8 hand-authored cameras above (Novena/Geylang NC1/Orchard MRT/
// Bugis MRT/Tampines Hub/Bedok MRT/Queenstown/Jurong East) with their exact lat/lng — those are
// the only camera `name`s in CAMERAS with no numeric suffix, so they're the only location strings
// cameraIdForSeedHit() in vcaStore.ts can resolve without a cameraLabel beside them. A made-up
// "Serangoon"/"Bishan" used to look fine here and attribute every one of these hits to the wrong
// camera app-wide, via a `?? CAMERAS[0].id` that has since been replaced by a throw (8005bbb) —
// so the same mistake now stops the app on first load instead of misfiling a surveillance
// subject's site. Loud, on purpose; the names still have to match the register.
const DAY_VIP_IDENTITIES: { name: string; location: string; lat: number; lng: number }[] = [
  { name: "Wei Ling Koh",   location: "Queenstown",   lat: 1.2942, lng: 103.8060 },
  { name: "Daniel Ho",      location: "Geylang NC1",  lat: 1.3148, lng: 103.8778 },
  { name: "Aisha Rahman",   location: "Orchard MRT",  lat: 1.3044, lng: 103.8321 },
  { name: "Marcus Lee",     location: "Bugis MRT",    lat: 1.3006, lng: 103.8561 },
  { name: "Nadia Yusof",    location: "Tampines Hub", lat: 1.3528, lng: 103.9440 },
  { name: "Wei Chen Goh",   location: "Bedok MRT",    lat: 1.3240, lng: 103.9302 },
  { name: "Farah Ibrahim",  location: "Queenstown",   lat: 1.2942, lng: 103.8060 },
  { name: "Kevin Tan",      location: "Jurong East",  lat: 1.3329, lng: 103.7436 },
  { name: "Siti Aminah",    location: "Novena",       lat: 1.3202, lng: 103.8440 },
  { name: "Ryan Ng",        location: "Geylang NC1",  lat: 1.3148, lng: 103.8778 },
  { name: "Ling Zhi Wei",   location: "Orchard MRT",  lat: 1.3044, lng: 103.8321 },
  { name: "Arjun Kumar",    location: "Bugis MRT",    lat: 1.3006, lng: 103.8561 },
];

// Same overall day-shape as hourlyDetections' vipCount column below (quiet overnight, busy
// 7am-9pm, peaks near 8am/6pm) but scaled up — 0-2 hits/hour was fine as a decorative curve, but
// once each hit became one real, individually-plotted dot instead of client-side jitter, that was
// too sparse to read as "a day's worth of activity."
const HOURLY_VIP_HIT_TARGETS = [
  2, 1, 1, 1, 1, 2,
  5, 8, 10, 7, 6, 7,
  8, 7, 6, 7, 9, 11,
  12, 9, 6, 4, 3, 2,
];

// Only up to the current hour — later hours today genuinely haven't happened yet, so leaving
// them at zero is correct (not a gap to fill); a real deployment fills them in as the day
// actually progresses, exactly like this will on its own tomorrow.
function generateDayVipHits(): RawVipHit[] {
  // The same clock todayAt writes on, so "up to the current hour" means the current hour of the
  // day these hits are stamped in — not of the machine reading them.
  const nowHour = zoneHour(new Date(), FALLBACK_TIME_ZONE);
  const hits: RawVipHit[] = [];
  for (let hour = 0; hour <= nowHour; hour++) {
    const target = HOURLY_VIP_HIT_TARGETS[hour];
    for (let i = 0; i < target; i++) {
      const seed = hour * 41 + i * 13 + 3;
      const identity = DAY_VIP_IDENTITIES[Math.floor(seededRandom(seed) * DAY_VIP_IDENTITIES.length)];
      const confidence = Math.round((65 + seededRandom(seed * 2.3) * 30) * 10) / 10;
      const minute = Math.floor(seededRandom(seed * 3.7) * 60);
      hits.push({
        id: `dayhit-${hour}-${i}`,
        name: identity.name,
        confidence,
        location: identity.location,
        timestamp: todayAt(hour, minute),
        lat: identity.lat,
        lng: identity.lng,
      });
    }
  }
  return hits;
}

const RAW_VIP_HITS: RawVipHit[] = [
  { id: "1",  name: "Alexander Wright", confidence: 72.6, location: "Novena",         timestamp: minutesAgo(10), lat: 1.3202, lng: 103.8440 },
  { id: "2",  name: "Dr. Sarah Chen",   confidence: 71.5, location: "Bedok MRT",      timestamp: minutesAgo(26), lat: 1.3240, lng: 103.9302 },
  { id: "3",  name: "Dr. Sarah Chen",   confidence: 88.0, location: "Novena",         timestamp: minutesAgo(1),  lat: 1.3202, lng: 103.8440 },
  { id: "4",  name: "Michael Tan",      confidence: 81.3, location: "Orchard MRT",    timestamp: minutesAgo(37), lat: 1.3044, lng: 103.8321 },
  { id: "5",  name: "Michael Tan",      confidence: 76.9, location: "Bugis MRT",      timestamp: minutesAgo(22), lat: 1.3006, lng: 103.8561 },
  { id: "6",  name: "Michael Tan",      confidence: 73.3, location: "Jurong East",    timestamp: minutesAgo(9),  lat: 1.3329, lng: 103.7436 },
  { id: "7",  name: "Priya Nair",       confidence: 77.8, location: "Tampines Hub",   timestamp: minutesAgo(15), lat: 1.3528, lng: 103.9440 },
  /**
   * A TRAIL WITH A STOP THAT CANNOT BE DRAWN — the case nothing in the seeds could produce.
   *
   * Priya Nair passes Tampines Hub, then Depot Bay 2, then Bedok MRT. The middle camera is in the
   * register and has no coordinates (see CAMERA_SEEDS' note on why one seed camera has none), so
   * this hop carries none either. That makes three stops of which the map can place two, and it
   * is what finally exercises the absent-position path end to end: the route's gap, the missing
   * stop number, the district tally that must not count it, and the scope picker's "not on the
   * map" group. None of that had ever rendered.
   *
   * Deliberately the MIDDLE stop. First or last would test a narrower thing — a gap needs a
   * drawable stop on each side to be a gap at all.
   */
  { id: "7b", name: "Priya Nair",       confidence: 80.4, location: "Depot Bay 2",    timestamp: minutesAgo(11) },
  { id: "7c", name: "Priya Nair",       confidence: 83.1, location: "Bedok MRT",      timestamp: minutesAgo(6),  lat: 1.3240, lng: 103.9302 },
  // ONE REGISTER, AND THIS PAIR BROKE IT. `cameraIdForLocation` joined on `location` alone, so
  // "Geylang" + "NC1" never matched the register's "Geylang NC1" — and "NC2" named a camera that
  // did not exist. Both fell through to CAMERAS[0] (Novena): a Geylang trail filed against a
  // Novena camera, and Novena's own panel counting these as its detections. The rule was already
  // written for DAY_VIP_IDENTITIES thirty lines below; this hand-written head predates it.
  // The pair stays as it was — one site, two cameras, which is the Tracking case cameraLabel
  // exists for. What changed is that Geylang NC2 is now in the register and the join reads the
  // label, so these resolve exactly. Coordinates match the register's, not an approximation.
  { id: "8",  name: "James Wilson",     confidence: 72.6, location: "Geylang", cameraLabel: "NC1", timestamp: minutesAgo(12), lat: 1.3148, lng: 103.8778 },
  { id: "9",  name: "James Wilson",     confidence: 68.1, location: "Geylang", cameraLabel: "NC2", timestamp: minutesAgo(4),  lat: 1.3163, lng: 103.8791 },
  { id: "10", name: "Grace Lim",        confidence: 82.4, location: "Orchard MRT",    timestamp: minutesAgo(22), lat: 1.3044, lng: 103.8321 },
  // Same person, same single camera, two separate points in time — demonstrates that a repeat
  // sighting at one camera stays as two distinct VIP rows (not merged into a Tracking trail,
  // since deriveLiveEvents() only switches to Tracking once 2+ DISTINCT cameras are involved).
  // Same fault, no rescue available: "Yishun MRT" is in no register and Yishun is not even one of
  // the seventeen districts, so its coordinate (1.4295, 103.8353) also sat outside the whole grid
  // and the unbounded nearestDistrict was counting it six kilometres away. A camera was not added
  // for it — the register belongs to the customer, and inventing one to satisfy a demo row inverts
  // the dependency the 2026-09-10 decision settled. Moved to Queenstown, which no other seed hit
  // uses, so "same person, same single camera, twice" still reads as its own case on the map.
  { id: "11", name: "Rachel Ong",       confidence: 74.2, location: "Queenstown",     timestamp: minutesAgo(18), lat: 1.2942, lng: 103.8060 },
  { id: "12", name: "Rachel Ong",       confidence: 85.7, location: "Queenstown",     timestamp: minutesAgo(3),  lat: 1.2942, lng: 103.8060 },
  // The rest of today, hour by hour — see generateDayVipHits() above for why this is what makes
  // the detection chart's dots (one per real hit) look like a full day instead of a dozen recent
  // ones clustered in the last hour.
  ...generateDayVipHits(),
];

function cameraKey(hit: RawVipHit): string {
  return `${hit.location}::${hit.cameraLabel ?? ""}`;
}

// Groups raw hits by person; a person with hits at 2+ distinct cameras becomes one
// "Tracking" trail entry (path = every hit, oldest first), everyone else stays a plain VIP row.
function deriveLiveEvents(hits: RawVipHit[]): LiveEvent[] {
  const byName = new Map<string, RawVipHit[]>();
  hits.forEach(hit => {
    const group = byName.get(hit.name) ?? [];
    group.push(hit);
    byName.set(hit.name, group);
  });

  const events: LiveEvent[] = [];
  byName.forEach((personHits, name) => {
    const distinctCameras = new Set(personHits.map(cameraKey));
    if (distinctCameras.size >= 2) {
      const sorted = [...personHits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const latest = sorted[sorted.length - 1];
      events.push({
        id: latest.id,
        name,
        confidence: 0,
        location: latest.location,
        cameraLabel: latest.cameraLabel,
        timestamp: latest.timestamp,
        type: "Tracking",
        // Each hop keeps its own coordinate — see TrackingHop.lat. The raw hit has it; the
        // trail used to throw it away and leave every hop to be placed by name.
        path: sorted.map(h => ({ location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence, lat: h.lat, lng: h.lng })),
        lat: latest.lat,
        lng: latest.lng,
      });
    } else {
      personHits.forEach(hit => events.push({
        id: hit.id, name, confidence: hit.confidence, location: hit.location,
        cameraLabel: hit.cameraLabel, timestamp: hit.timestamp, type: "VIP", lat: hit.lat, lng: hit.lng,
      }));
    }
  });

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export const liveEvents: LiveEvent[] = deriveLiveEvents(RAW_VIP_HITS);

/**
 * The device list used to live here: 19 curated rows plus 981 bulk-generated ones, standing in for
 * a ~1,000-camera deployment.
 *
 * Deleted 2026-09-10. The camera register in the store is the only population now — Portal writes
 * it, the app's System tab, map and availability all read it, and lib/api/dashboard.ts projects it
 * into this Device shape. Three different camera counts used to be on screen at once (59 register,
 * 1,040 register-plus-filler, 1,029 simulation pool), each labelled as the site's; and the padded
 * rows existed in no register, so the offline ones among them named nothing anybody could fix.
 */

// Counts below are DERIVED from liveEvents (the one raw source), not separately hardcoded — this
// is what keeps "Events today" here, the Data tab's list length and RedFace associate counts all
// reporting the same number for the same underlying data.
const eventsTodayCount = liveEvents.length;
// PEOPLE, matching the Sidebar tile that asks this question (useEventCounts' `vipsToday`, renamed
// 2026-09-17): distinct people seen, not rows. `liveEvents.filter(type === "VIP").length` stood
// here, which counts only the people who were NOT collapsed into a Tracking trail — the same
// narrower-than-its-label count the tile was fixed for. Distinct names, because deriveLiveEvents
// groups by name too (see DetectionHit.person for why a name is the weakest acceptable identity,
// and what the server must send instead).
const vipsTodayCount = new Set(liveEvents.map((e) => e.name)).size;

// `delta` and `down` compare against the same time yesterday. There is no `deltaPct` any more:
// each entry carried one (`delta: 4, deltaPct: 1.5`), and the counts these sit under became real
// while the pair stayed seeded, so the tile printed "4 (1.5%)" under 48 — and 4 of 48 is 8.3%.
// See DeltaBadge in Sidebar.tsx for why the percentage was dropped rather than recomputed from
// the shown count. The delta stays: it is a placeholder holding the backend's daily series' seat
// (decided 2026-09-09), and one number the mock cannot support is easier to read as a placeholder
// than two that check out against each other.
export const dashboardStats = {
  // `vipTargets: 12` sat here and nothing read it. Deleted 2026-09-17, which is the opposite
  // call to the rest of this object (`tracking` below, the seeded deltas, `currentDate`) and
  // the difference is where the figure comes from: the person registry is the system of record
  // for who is enrolled, so the Sidebar's "Registered VIPs" tile counts it directly
  // (useEventCounts, `persons.filter(p => p.type === "VIP")`) and measured 121 on screen while
  // this said 12. Same deletion as `aiRunning`/`aiStopped` just below, for the same reason: a
  // count typed in beside a list it is not derived from is how this file ended up with three
  // figures that disagreed with each other.
  //
  // Undefined-but-present was the other option and is worse HERE than it was for the clock
  // below: that pair stays because Navbar still reads it through `??` and removing the keys
  // would be a type error in another file, whereas this has no reader to keep compiling. And
  // `getDashboardStats()` spreads this whole object, so every key here is on the stand-in
  // payload's wire — leaving the name invites the next reader to take the payload's count
  // instead of the registry's, which is the 12-against-121 split coming straight back.
  // `aiRunning: 42` / `aiStopped: 34` used to sit here, read only by the app header. They named
  // something that does not exist — no camera in this product carries per-camera AI state — and
  // the two figures summed to 76, which matched neither the camera list nor the device list. They
  // were the camera run state all along, which `linkedCams`/`offlineCams` below already hold, so
  // the header reads those instead of a second pair that could disagree with them.
  vipsToday:       { count: vipsTodayCount,      delta: 4,  down: true },
  // `tracking` sat here and nothing read it. Deleted 2026-09-17 on the owner's call, asked and
  // answered: "동선을 세는 수는 의미가 없어보여". They are right about what it would have said —
  // a trail is a VIP who moved, so the tile would have been a subset of `vipsToday` right beside
  // it, and two counts of the same people is how a dashboard starts lying quietly. The sidebar
  // row stays two tiles: people, detections. Do not add a third without asking them again.
  eventsToday:     { count: eventsTodayCount,    delta: 3,  down: false },
  // count is overwritten by getDashboardStats() from the actual device list — the 48/48 that used
  // to be typed here disagreed with the list it sat beside. Only the deltas are still seeded:
  // they compare against the same time yesterday, and nothing in the mock holds yesterday.
  //
  // Kept rather than removed, decided 2026-09-09. Portal's Overview trend cards were deleted for
  // exactly this reason, so this looks like the opposite call and is not: those cards were ONLY a
  // trend, so a seeded one left the panel saying nothing true. Here the trend hangs under a count
  // that is now real, and it holds the place the backend's daily series will fill. Do not delete
  // these to match Portal — the difference is deliberate.
  linkedCams:      { count: 0,  delta: 2,  down: false },
  offlineCams:     { count: 0,  delta: 4,  down: true },
  // Overwritten by getDashboardStats() from the camera register, the same list the counts above
  // come from. Zero here rather than a seeded percentage: a figure typed in beside counts it
  // cannot be derived from is how this file ended up with three contradictory numbers before.
  availability: 0,
  /*
   * ── THE HEADER CLOCK, AND WHY THERE IS NO VALUE FOR IT HERE ─────────────────────────────────
   *
   * These held "2026-07-02" and "16:32:15" — a date ten weeks in the past and a wall-clock time,
   * and Navbar renders them as the current date and the current time (Navbar.tsx:169-170, the
   * chip beside the bell). A constant displayed as now is the "방금 확인함" shape: the reader
   * stops asking, because they were told.
   *
   * THIS IS NOT A SEED ANCHOR, which is the thing worth being sure about before touching it.
   * Everything in this file that means "today" is already written on the real clock — todayAt()
   * and generateDayVipHits() both call new Date() — so nothing was dated relative to these two,
   * and deleting them drifts no seeded row out of "today". Their only reader is that chip.
   *
   * Nor are they the seeded deltas thirty lines above, which stay (decided 2026-09-09). A delta
   * says out loud that it is a comparison the mock cannot make yet; a clock says it is now.
   *
   * Undefined rather than deleted, and the difference is a file boundary, not a judgement:
   * Navbar reads `dashboardStats?.currentDate ?? ""`, so undefined already lands on the empty
   * string it wrote for the case where it has no clock yet, while removing the keys outright
   * would be a type error over there. Navbar has the honest machinery — `sgNow`, ticking every
   * second, read through the site's zone (lib/time.ts). Whoever edits it next can drop the two
   * `?? dashboardStats?.current*` fallbacks and then these two lines go with them.
   *
   * It was probably never on screen: Navbar sets `sgNow` in a mount effect, while these arrive
   * through getDashboardStats()'s 250ms mockDelay, so the real clock is always ticking before
   * the fallback has anything to offer. Unobservable is not harmless — `?? CAMERAS[0].id` was
   * unobservable for nine months (8005bbb), because a plausible wrong answer looks exactly like
   * the right one.
   */
  currentDate: undefined as string | undefined,
  currentTime: undefined as string | undefined,
  location: "Singapore",
};

export const mapMarkers: MapMarker[] = [
  { lat: 1.352, lng: 103.820, type: "VIP" },
  { lat: 1.365, lng: 103.833, type: "Tracking" },
  { lat: 1.338, lng: 103.742, type: "Tracking" },
  { lat: 1.344, lng: 103.777, type: "VIP" },
  { lat: 1.359, lng: 103.854, type: "Tracking" },
  { lat: 1.372, lng: 103.845, type: "VIP" },
  { lat: 1.348, lng: 103.855, type: "Tracking" },
  { lat: 1.342, lng: 103.813, type: "VIP" },
  { lat: 1.375, lng: 103.861, type: "Tracking" },
  { lat: 1.330, lng: 103.773, type: "VIP" },
  { lat: 1.388, lng: 103.820, type: "Tracking" },
  { lat: 1.328, lng: 103.821, type: "VIP" },
  { lat: 1.315, lng: 103.765, type: "Tracking" },
  { lat: 1.367, lng: 103.803, type: "VIP" },
  { lat: 1.352, lng: 103.794, type: "Tracking" },
  { lat: 1.347, lng: 103.743, type: "VIP" },
  { lat: 1.322, lng: 103.803, type: "Tracking" },
  { lat: 1.295, lng: 103.842, type: "Tracking" },
  { lat: 1.310, lng: 103.862, type: "VIP" },
  { lat: 1.380, lng: 103.779, type: "Tracking" },
];

export interface HourlyDetection {
  hour: number;
  /** Total person detections across all cameras in this hour. */
  count: number;
  /** How many of those were VIP hits — plotted as dots over the hour's bar. */
  vipCount: number;
}

// Illustrative daily traffic pattern for the Dashboard's detection-activity chart (quiet
// overnight, commute-hour peaks). Independent of liveEvents, same as mapMarkers — a real
// backend would replace this with an actual per-hour aggregation of detection events.
export const hourlyDetections: HourlyDetection[] = [
  { hour: 0,  count: 6,  vipCount: 0 },
  { hour: 1,  count: 4,  vipCount: 0 },
  { hour: 2,  count: 3,  vipCount: 0 },
  { hour: 3,  count: 2,  vipCount: 0 },
  { hour: 4,  count: 3,  vipCount: 0 },
  { hour: 5,  count: 7,  vipCount: 0 },
  { hour: 6,  count: 16, vipCount: 1 },
  { hour: 7,  count: 32, vipCount: 1 },
  { hour: 8,  count: 41, vipCount: 2 },
  { hour: 9,  count: 27, vipCount: 1 },
  { hour: 10, count: 22, vipCount: 0 },
  { hour: 11, count: 25, vipCount: 1 },
  { hour: 12, count: 30, vipCount: 1 },
  { hour: 13, count: 27, vipCount: 1 },
  { hour: 14, count: 23, vipCount: 0 },
  { hour: 15, count: 26, vipCount: 1 },
  { hour: 16, count: 33, vipCount: 1 },
  { hour: 17, count: 42, vipCount: 2 },
  { hour: 18, count: 47, vipCount: 2 },
  { hour: 19, count: 36, vipCount: 1 },
  { hour: 20, count: 25, vipCount: 1 },
  { hour: 21, count: 17, vipCount: 0 },
  { hour: 22, count: 11, vipCount: 0 },
  { hour: 23, count: 8,  vipCount: 0 },
];
