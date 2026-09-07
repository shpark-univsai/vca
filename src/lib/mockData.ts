import { sgtClockTime } from "@/lib/time";

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
export function nearestDistrict(lat: number, lng: number): District {
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.lat - lat) ** 2 + (d.lng - lng) ** 2;
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
  lat: number;
  lng: number;
}

/** Renders an ISO timestamp as a relative "Xm ago" string for anything under an hour old,
 * computed at render time. Past an hour, a coarse "1h ago"/"2h ago" label stops being useful for
 * "when exactly did this happen" — so it switches to the actual captured clock time instead.
 *
 * Takes the language rather than reading it: this is called from map popups built as HTML strings
 * and from render paths that are not components, so there is no hook to read it with. The clock
 * time it falls back to needs no translating — digits are digits. */
export function formatTimeAgo(timestamp: string, lang: "en" | "ko" = "en"): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return lang === "ko" ? "방금" : "just now";
  if (mins < 60) return lang === "ko" ? `${mins}분 전` : `${mins}m ago`;
  return sgtClockTime(new Date(timestamp));
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
  lat: number;
  lng: number;
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
  lat: number;
  lng: number;
}

function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// A brand-new, non-overlapping identity pool (not one of the names above) — each tied to exactly
// one fixed location, so none of these can ever accumulate a 2nd distinct camera and get
// deriveLiveEvents()-merged into a "Tracking" trail. That would silently drop them from the VIP
// count the detection chart plots, undoing the point of generating them.
// Locations deliberately reuse the 8 hand-authored cameras above (Novena/Geylang NC1/Orchard MRT/
// Bugis MRT/Tampines Hub/Bedok MRT/Queenstown/Jurong East) with their exact lat/lng — those are
// the only camera `name`s in CAMERAS with no numeric suffix, so they're the only location strings
// cameraIdForLocation() in vcaStore.ts can actually resolve to their real camera instead of
// silently falling back to CAMERAS[0]. A made-up "Serangoon"/"Bishan" etc. would look fine here
// but attribute every one of these hits to the wrong camera app-wide.
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
  const nowHour = new Date().getHours();
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
  { id: "8",  name: "James Wilson",     confidence: 72.6, location: "Geylang", cameraLabel: "NC1", timestamp: minutesAgo(12), lat: 1.3148, lng: 103.8778 },
  { id: "9",  name: "James Wilson",     confidence: 68.1, location: "Geylang", cameraLabel: "NC2", timestamp: minutesAgo(4),  lat: 1.3148, lng: 103.8778 },
  { id: "10", name: "Grace Lim",        confidence: 82.4, location: "Orchard MRT",    timestamp: minutesAgo(22), lat: 1.3044, lng: 103.8321 },
  // Same person, same single camera, two separate points in time — demonstrates that a repeat
  // sighting at one camera stays as two distinct VIP rows (not merged into a Tracking trail,
  // since deriveLiveEvents() only switches to Tracking once 2+ DISTINCT cameras are involved).
  { id: "11", name: "Rachel Ong",       confidence: 74.2, location: "Yishun MRT",     timestamp: minutesAgo(18), lat: 1.4295, lng: 103.8353 },
  { id: "12", name: "Rachel Ong",       confidence: 85.7, location: "Yishun MRT",     timestamp: minutesAgo(3),  lat: 1.4295, lng: 103.8353 },
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
        path: sorted.map(h => ({ location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence })),
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

export const devices: Device[] = [
  { id:"1",  status:"Live", name:"MB1", type:"Normal", ip:"192.168.0.101", lat:1.3517, lng:103.8490, lastSeen:"2m ago"  },
  { id:"2",  status:"Off",  name:"OR2", type:"Normal", ip:"192.168.0.102", lat:1.3026, lng:103.8650, lastSeen:"20m ago" },
  { id:"3",  status:"Live", name:"BJ3", type:"Normal", ip:"192.168.0.103", lat:1.3006, lng:103.8561, lastSeen:"1m ago"  },
  { id:"4",  status:"Live", name:"TP1", type:"Normal", ip:"192.168.0.104", lat:1.3528, lng:103.9440, lastSeen:"5m ago"  },
  { id:"5",  status:"Off",  name:"JE2", type:"Normal", ip:"192.168.0.105", lat:1.3329, lng:103.7436, lastSeen:"1h ago"  },
  { id:"6",  status:"Live", name:"CA3", type:"Normal", ip:"192.168.0.106", lat:1.2895, lng:103.8500, lastSeen:"3m ago"  },
  { id:"7",  status:"Live", name:"SG1", type:"Normal", ip:"192.168.0.107", lat:1.3050, lng:103.8320, lastSeen:"7m ago"  },
  { id:"8",  status:"Off",  name:"CQ2", type:"Normal", ip:"192.168.0.108", lat:1.3554, lng:103.8679, lastSeen:"45m ago" },
  { id:"9",  status:"Live", name:"BS1", type:"Normal", ip:"192.168.0.109", lat:1.3195, lng:103.8410, lastSeen:"2m ago"  },
  { id:"10", status:"Off",  name:"WD3", type:"Normal", ip:"192.168.0.110", lat:1.3717, lng:103.8927, lastSeen:"2h ago"  },
  { id:"11", status:"Off",  name:"AK1", type:"Normal", ip:"192.168.0.111", lat:1.3691, lng:103.8454, lastSeen:"30m ago" },
  { id:"12", status:"Off",  name:"BD2", type:"Normal", ip:"192.168.0.112", lat:1.3250, lng:103.9291, lastSeen:"3h ago"  },
  { id:"13", status:"Live", name:"HB4", type:"Normal", ip:"192.168.0.113", lat:1.3108, lng:103.8715, lastSeen:"1m ago"  },
  { id:"14", status:"Live", name:"KL1", type:"Normal", ip:"192.168.0.114", lat:1.3088, lng:103.8648, lastSeen:"4m ago"  },
  { id:"15", status:"Live", name:"PY2", type:"Normal", ip:"192.168.0.115", lat:1.3343, lng:103.8565, lastSeen:"6m ago"  },
  { id:"16", status:"Live", name:"SE3", type:"Normal", ip:"192.168.0.116", lat:1.3202, lng:103.8649, lastSeen:"9m ago"  },
  { id:"17", status:"Live", name:"YC1", type:"Normal", ip:"192.168.0.117", lat:1.3380, lng:103.8840, lastSeen:"2m ago"  },
  { id:"18", status:"Live", name:"CB2", type:"Normal", ip:"192.168.0.118", lat:1.3158, lng:103.8920, lastSeen:"3m ago"  },
  { id:"19", status:"Live", name:"TQ1", type:"Normal", ip:"192.168.0.119", lat:1.3020, lng:103.9090, lastSeen:"11m ago" },
  // Bulk-generated to simulate a full ~1,000-camera deployment (System tab stats/table, dot
  // pagination, Live Monitoring "All Cameras" view, etc. at real-world scale) — deterministic,
  // not Math.random, so server/client renders match. Kept separate from the 19 curated devices
  // above (some of which — e.g. "KL1" — are referenced by id/name elsewhere in the app).
  ...Array.from({ length: 981 }, (_, i) => {
    const n = i + 20;
    const live = seededRandom(n * 7.31) > 0.08; // ~92% uptime, typical for a mature deployment
    const lat = 1.20 + seededRandom(n * 3.17) * 0.27;   // Singapore's rough lat span
    const lng = 103.62 + seededRandom(n * 5.89) * 0.47; // Singapore's rough lng span
    const minutesAgoVal = live
      ? Math.floor(seededRandom(n * 2.11) * 15) + 1
      : Math.floor(seededRandom(n * 9.73) * 180) + 15;
    return {
      id: String(n),
      status: (live ? "Live" : "Off") as DeviceStatus,
      name: `CAM-${String(n).padStart(4, "0")}`,
      type: "Normal",
      ip: `192.168.${1 + (n >> 8)}.${n % 256}`,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      lastSeen: live ? `${minutesAgoVal}m ago` : minutesAgoVal >= 60 ? `${Math.floor(minutesAgoVal / 60)}h ago` : `${minutesAgoVal}m ago`,
    };
  }),
];

// Counts below are DERIVED from liveEvents/devices (the one raw source each), not separately
// hardcoded — this is what keeps "Events today" here, the Data tab's list length, and RedFace
// associate counts all reporting the same number for the same underlying data. `availability` used
// to be a hardcoded 19 sitting right next to linkedCams/offlineCams counts that implied ~92% —
// three contradictory numbers in one glance. Deriving it from the same `devices` array those counts
// come from keeps all three consistent.
const eventsTodayCount = liveEvents.length;
const watchlistMatchCount = liveEvents.filter((e) => e.type === "VIP").length;
const trackingCount = liveEvents.filter((e) => e.type === "Tracking").length;
const liveDeviceCount = devices.filter((d) => d.status === "Live").length;

// delta/deltaPct/down are all compared against the same time yesterday.
export const dashboardStats = {
  vipTargets: 12,
  aiRunning: 42,
  aiStopped: 34,
  watchlistMatch:  { count: watchlistMatchCount, delta: 4,  deltaPct: 1.5, down: true },
  tracking:        { count: trackingCount,       delta: 4,  deltaPct: 1.5, down: true },
  eventsToday:     { count: eventsTodayCount,    delta: 3,  deltaPct: 2.1, down: false },
  linkedCams:      { count: 48,  delta: 2,  deltaPct: 0.8, down: false },
  offlineCams:     { count: 48,  delta: 4,  deltaPct: 1.5, down: true },
  availability: Math.round((liveDeviceCount / devices.length) * 1000) / 10,
  currentDate: "2026-07-02",
  currentTime: "16:32:15",
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
