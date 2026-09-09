// Dashboard domain — stats, live events, devices, map markers.
// Currently returns the static mock data from lib/mockData.ts.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { dashboardStats, liveEvents, devices, mapMarkers, DISTRICTS, hourlyDetections, formatTimeAgo, type Device, type HourlyDetection } from "@/lib/mockData";
import { useVcaStore, camerasInProject, type Camera } from "@/lib/vcaStore";
import { runStateOf } from "@/lib/realtime/cameraStatus";
import { mockDelay } from "./client";

/**
 * Portal is the system of record for cameras, so the app's device list has to read what Portal
 * writes. It did not: this module returned `devices` from mockData — a separate 1,000-entry array
 * — while Portal added, removed and took cameras offline in the store. Two raw sources for one
 * thing, which is why a camera registered in Portal never appeared in the app's System tab, and
 * why the camera-id mismatch kept resurfacing.
 *
 * Now there is one owner and one filler. Every camera the store holds is projected here; the mock
 * array supplies only the remainder, so the deployment still reads at its real ~1,000-camera scale
 * for the table, the stats and the pagination. When the backend owns the list, the store's half
 * becomes the fetch and the filler is deleted — nothing else has to move.
 *
 * `useVcaStore.getState()` rather than a hook: this is a module function standing in for a
 * request, same as reading the mock array was. The screens that call it pass the store's cameras
 * as a dependency, so a change in Portal re-runs the "request".
 */
function cameraToDevice(camera: Camera): Device {
  return {
    id: camera.id,
    // Read through the status seam, not off the camera — lib/realtime/cameraStatus.ts is the one
    // place that decides what "running" means, and the one place the backend swaps at intake.
    status: runStateOf(camera.status) === "running" ? "Live" : "Off",
    name: camera.name,
    // The store carries no equivalent. Device.type is display-only and every mock row says the
    // same thing, so nothing is lost until a real camera type arrives from the backend.
    type: "Normal",
    ip: camera.ip,
    lat: camera.lat,
    lng: camera.lng,
    // English to match the filler rows, which are pre-formatted strings. The whole column is
    // English today — translating half of it would just make the list disagree with itself.
    lastSeen: camera.lastSeenAt ? formatTimeAgo(camera.lastSeenAt) : "—",
  };
}

/**
 * The mock filler stands for cameras nobody has registered in Portal yet, and it is a thousand
 * Singapore-district positions — so it belongs to the smart-city site and to no other. Without
 * naming that, filtering by site either hid the whole deployment or handed a school campus a
 * thousand cameras it does not have.
 *
 * Delete this along with the filler when the backend owns the list.
 */
const FILLER_PROJECT_ID = "proj-sg";

function deploymentDevices(projectId?: string): Device[] {
  const all = useVcaStore.getState().cameras;
  const registered = (projectId ? camerasInProject(all, projectId) : all).map(cameraToDevice);
  if (projectId && projectId !== FILLER_PROJECT_ID) return registered;
  const registeredIds = new Set(registered.map(d => d.id));
  return [...registered, ...devices.filter(d => !registeredIds.has(d.id))];
}

export async function getDashboardStats(projectId?: string) {
  // Availability was computed at module load from the static array, so it disagreed with the
  // camera counts the moment those started coming from the store. Same list, same figure.
  const all = deploymentDevices(projectId);
  const live = all.filter(d => d.status === "Live").length;
  // A site with no cameras registered yet has no availability to report — 0/0 is NaN, and a donut
  // reading "NaN%" is worse than one reading nothing.
  const availability = all.length === 0 ? 0 : Math.round((live / all.length) * 1000) / 10;
  return mockDelay({
    ...dashboardStats,
    linkedCams: { ...dashboardStats.linkedCams, count: live },
    offlineCams: { ...dashboardStats.offlineCams, count: all.length - live },
    availability,
  });
}

export async function getLiveEvents() {
  return mockDelay(liveEvents);
}

export async function getDevices(projectId?: string) {
  return mockDelay(deploymentDevices(projectId));
}

export async function getMapMarkers() {
  return mockDelay(mapMarkers);
}

// The district boundaries/labels a deployment groups its cameras into for the map's cluster
// pills — real reference data a backend would own, unlike `nearestDistrict()` (a pure geometry
// helper that stays a plain sync import since there's nothing to fetch for it).
export async function getDistricts() {
  return mockDelay(DISTRICTS);
}

// Deterministic pseudo-random in [0,1) — same formula used elsewhere in the mock layer, so a
// given camera always scales to the same reproducible fraction of the citywide series instead of
// a different one on every refetch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Stand-in for a real per-camera aggregation query. A single camera only ever sees a fraction of
// the citywide total; this fakes that fraction from the camera's id so switching back to the same
// camera reproduces the same-looking curve. A real backend replaces this whole function body with
// an actual "detections WHERE camera_id = ?" aggregation — the `cameraId` parameter below is the
// real, permanent part of the contract; only what happens inside when it's set is fake.
function mockCameraScale(cameraId: string): number {
  const seed = cameraId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 0.12 + seededRandom(seed) * 0.22;
}

// cameraId omitted (or undefined) = citywide totals, exactly like every other resource here.
// Passing one is expected to return that camera's own hourly series, not the citywide one scaled
// on the client — DetectionActivityChart used to do that scaling itself, which meant the "per
// camera" view wasn't actually asking the backend for anything camera-specific.
export async function getHourlyDetections(cameraId?: string): Promise<HourlyDetection[]> {
  if (!cameraId) return mockDelay(hourlyDetections);
  const scale = mockCameraScale(cameraId);
  const scaled = hourlyDetections.map(h => ({
    hour: h.hour,
    count: Math.round(h.count * scale),
    vipCount: Math.round(h.vipCount * scale),
  }));
  return mockDelay(scaled);
}
