import { create } from "zustand";
import { liveEvents, getFacePhoto, DISTRICTS, type EventType, type LiveEvent, type TrackingHop } from "@/lib/mockData";
import { isTodaySgt } from "@/lib/time";

// Deterministic pseudo-random in [0,1) — same formula as mockData.ts's own seededRandom — used
// below to bulk-generate cameras without Math.random(), which would differ between the
// server-rendered and client-hydrated pass and trigger a hydration mismatch.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type CameraStatus = "online" | "offline";

export interface Organization {
  id: string;
  name: string;
  region: string;
  // Set at signup (Step 2 — "Primary Industry"); pre-highlights the matching template on the
  // New Project Wizard that follows signup. Optional since existing/legacy orgs won't have it.
  industry?: string;
}

export type ProjectType = "smart_city" | "smart_school";

export interface Project {
  id: string;
  orgId: string;
  name: string;
  type: ProjectType;
  // Set/edited from the project's License tab in Portal — governs how many camera channels this
  // project is provisioned for and when that provisioning expires. Optional so projects created
  // before this existed (or without a license configured yet) still type-check.
  licenseChannelLimit?: number;
  licensePlan?: string;
  licenseExpiresAt?: string;
}

// Matches existing app-wide terminology ("Re-ID Analysis" tab in DataPage, "License plate" search
// in RedmapPage/DataPage) rather than abbreviations like "LPR" that don't appear anywhere else in
// this codebase's UI copy.
export type CameraAiFeature = "Re-ID Analysis" | "License Plate Recognition" | "Intrusion Detection";

export interface Camera {
  id: string;
  projectId: string;
  code: string;
  name: string;
  ip: string;
  mac: string;
  rtspUrl: string;
  status: CameraStatus;
  location: string;
  zone: string;
  thumbnail: string;
  lat: number;
  lng: number;
  // Which AI analysis engines are mapped to this camera's stream — set from Portal's Camera
  // Management screen. Optional so existing/seeded cameras (none of which have this configured)
  // still type-check; an empty/missing list just means no engine is mapped yet.
  aiFeatures?: CameraAiFeature[];
  // RTSP transport protocol, set from Portal's Add/Edit Camera form. Optional/cosmetic — nothing
  // downstream branches on this yet since there's no real stream to actually transport.
  protocol?: "TCP" | "UDP";
  // Hardware details shown in Portal's Cameras table — set from the Add/Edit Camera form.
  // Optional/cosmetic, same as protocol: nothing downstream branches on these.
  maker?: string;
  resolution?: string;
}

// Infrastructure nodes shown in Portal's Server & API Management tab — separate from `Camera`
// (a stream source) since a project's servers back the pipeline (recognition workers, image
// stores, databases) rather than capturing footage themselves.
export type ServerType = "AI Camera" | "Normal Camera" | "Face Recognition" | "Image Store" | "Database";
export type ServerStatus = "success" | "error";

export interface Server {
  id: string;
  projectId: string;
  name: string;
  ip: string;
  type: ServerType;
  specification?: string;
  status: ServerStatus;
}

export type EventSeverity = "critical" | "warning" | "info";

export interface VcaEvent {
  id: string;
  cameraId: string;
  type: string;
  severity: EventSeverity;
  timestamp: string;
  // Detection-result fields — optional so DataPage's existing addEvent({cameraId, type, severity,
  // timestamp}) call still type-checks; populated when the event comes from a person match (VIP/
  // Tracking hit) rather than a generic system event.
  personId?: string;
  personName?: string;
  personDescription?: string;
  personType?: EventType;
  confidence?: number;
  location?: string;
  cameraLabel?: string;
  personPath?: TrackingHop[];
  lat?: number;
  lng?: number;
  photoUrl?: string;
}

// Person = the VIP/watchlist registry. Portal owns registration/CRUD for this (see
// PortalVipRegistryTab) — VCA's own screens only ever read it, never write to it.
export interface Person {
  id: string;
  name: string;
  type: EventType;
  photoUrl: string;
  registeredAt: string;
  description?: string;
  // Which project registered this person — set on everything registered via Portal going
  // forward. Optional since the seed data below predates per-project scoping and stays
  // unscoped (visible everywhere) rather than being retroactively assigned to one project.
  projectId?: string;
  // Free-text classification tags set from Portal's Register VIP form — shown as colored badges
  // on the VIP Registry card. Optional so existing/seeded persons (none of which have this
  // configured) still type-check.
  roleLabel?: string;
  priorityLabel?: "normal" | "high" | "very_high";
}

// A cross-component "please navigate" signal — the global command palette (mounted at the
// ClientLayout level) uses this to reach into DataPage's Data-tab children (LiveMonitoringTab,
// SmartSearchContent), each of which is otherwise pure local state with no external control hook.
// `requestId` always increments, even when `tab`/`cameraCode`/etc. repeat, so a listener comparing
// "did requestId change" fires again even when asked to jump to the exact same place twice in a
// row.
export interface DataNavRequest {
  tab: "Live Monitoring" | "Re-ID Analysis" | "Smart Search" | "RedFace";
  cameraCode?: string;
  vipIndex?: number;
  recentTargetIndex?: number;
  requestId: number;
}

interface VcaStoreState {
  organizations: Organization[];
  projects: Project[];
  cameras: Camera[];
  persons: Person[];
  events: VcaEvent[];
  portalUsers: PortalUser[];
  servers: Server[];
  // Notifications (header bell) only care about VIP-match events from this point forward —
  // events seeded at load are historical and start out already "read".
  lastReadNotifAt: string;
  dataNavRequest: DataNavRequest | null;
  setCameraStatus: (cameraId: string, status: CameraStatus) => void;
  addCamera: (camera: Omit<Camera, "id">) => void;
  updateCamera: (cameraId: string, updates: Partial<Omit<Camera, "id" | "projectId">>) => void;
  removeCamera: (cameraId: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProjectLicense: (projectId: string, updates: Pick<Project, "licenseChannelLimit" | "licensePlan" | "licenseExpiresAt">) => void;
  addPerson: (person: Omit<Person, "id">) => void;
  removePerson: (personId: string) => void;
  addEvent: (event: Omit<VcaEvent, "id">) => void;
  markNotificationsRead: () => void;
  requestDataNav: (req: Omit<DataNavRequest, "requestId">) => void;
  addPortalUser: (user: Omit<PortalUser, "id">) => void;
  updatePortalUserPermission: (userId: string, permission: PortalPermission) => void;
  updatePortalUserProjects: (userId: string, projectIds: string[]) => void;
  removePortalUser: (userId: string) => void;
  addOrganization: (org: Omit<Organization, "id">) => string;
  addServer: (server: Omit<Server, "id">) => void;
  updateServer: (serverId: string, updates: Partial<Omit<Server, "id" | "projectId">>) => void;
  removeServer: (serverId: string) => void;
}

const ORGANIZATIONS: Organization[] = [
  { id: "org-univs", name: "City of Singapore — Smart Infrastructure Office", region: "Singapore" },
];

const PROJECTS: Project[] = [
  { id: "proj-sg", orgId: "org-univs", name: "Marina Bay & CBD Surveillance Network", type: "smart_city", licensePlan: "Enterprise", licenseChannelLimit: 100, licenseExpiresAt: "2029-06-04" },
  { id: "proj-riverside", orgId: "org-univs", name: "Riverside International School", type: "smart_school", licensePlan: "Professional", licenseChannelLimit: 40, licenseExpiresAt: "2027-09-01" },
];

// Portal-managed accounts — separate from `persons` (the VIP/watchlist registry). A PortalUser is
// someone who can log into this same app; `permission` decides whether they land in the Portal
// back-office shell or straight into the Smart City/School app (see PortalShell/ClientLayout),
// and `projectIds` scopes which project(s) an operator can see once inside the app.
export type PortalPermission = "admin" | "operator";
export type PortalUserStatus = "active" | "invited" | "suspended";

// Who is signed in. Stands in for the login response — login is still a no-op that routes on an
// email lookup, so there is no session to read this from yet. One object rather than the same
// name, email and id typed into the navbar menu and My Page separately: those drifted apart once
// already, and when a real auth store lands this is the single place it replaces.
export interface SignedInUser {
  name: string;
  email: string;
  /** Operator-facing account id, shown on the profile card. */
  accountId: string;
  role: string;
  team: string;
}

export const SIGNED_IN_USER: SignedInUser = {
  name: "John Doe",
  email: "johndoe@email.com",
  accountId: "VCA-ADMIN-8821",
  role: "Smart City Operations Manager",
  team: "Operational Control Team Alpha",
};

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  orgId: string;
  projectIds: string[];
  permission: PortalPermission;
  status: PortalUserStatus;
  // Security/audit columns shown in Portal's Users & Permissions table. Optional so existing/seeded
  // users (none of which have this configured) still type-check.
  mfaEnabled?: boolean;
  lastLoginAt?: string;
}

const PORTAL_USERS: PortalUser[] = [
  { id: "user-1", name: "Grace Tan", email: "grace.tan@univs.ai", orgId: "org-univs", projectIds: ["proj-sg", "proj-riverside"], permission: "admin", status: "active", mfaEnabled: true, lastLoginAt: "2026-08-25 09:14" },
  { id: "user-2", name: "Marcus Lee", email: "marcus.lee@univs.ai", orgId: "org-univs", projectIds: ["proj-sg"], permission: "operator", status: "active", mfaEnabled: true, lastLoginAt: "2026-08-24 18:02" },
  { id: "user-3", name: "Nadia Rahman", email: "nadia.rahman@univs.ai", orgId: "org-univs", projectIds: ["proj-riverside"], permission: "operator", status: "active", mfaEnabled: false, lastLoginAt: "2026-08-20 11:47" },
  { id: "user-4", name: "Wei Chen", email: "wei.chen@univs.ai", orgId: "org-univs", projectIds: ["proj-sg"], permission: "operator", status: "invited" },
  { id: "user-5", name: "David Ong", email: "david.ong@univs.ai", orgId: "org-univs", projectIds: ["proj-sg"], permission: "operator", status: "suspended", mfaEnabled: false, lastLoginAt: "2026-06-02 08:30" },
];

const SERVERS: Server[] = [
  { id: "srv-1", projectId: "proj-sg", name: "FR 2", ip: "192.168.0.36", type: "Face Recognition", status: "success" },
  { id: "srv-2", projectId: "proj-sg", name: "AI camera 1", ip: "192.168.0.36", type: "AI Camera", status: "success" },
  { id: "srv-3", projectId: "proj-sg", name: "image store 1", ip: "192.168.0.36", type: "Image Store", status: "success" },
  { id: "srv-4", projectId: "proj-sg", name: "database 1", ip: "192.168.0.36", type: "Database", status: "success" },
  { id: "srv-5", projectId: "proj-sg", name: "normal camera 1", ip: "192.168.0.36", type: "Normal Camera", status: "success" },
  { id: "srv-6", projectId: "proj-sg", name: "testServer", ip: "192.168.0.103", type: "Face Recognition", status: "error" },
  { id: "srv-7", projectId: "proj-riverside", name: "campus-fr-1", ip: "192.168.1.20", type: "Face Recognition", status: "success" },
  { id: "srv-8", projectId: "proj-riverside", name: "campus-db-1", ip: "192.168.1.21", type: "Database", status: "success" },
];

const CAMERAS: Camera[] = [
  {
    id: "cam-novena", projectId: "proj-sg", code: "CAM-NOV-001", name: "Novena",
    ip: "10.20.4.11", mac: "00:1B:44:11:3A:B7", rtspUrl: "rtsp://10.20.4.11:554/stream1",
    status: "online", location: "Novena, Singapore", zone: "Novena",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3202, lng: 103.8440, maker: "Hanwha", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-geylang", projectId: "proj-sg", code: "CAM-GEY-001", name: "Geylang NC1",
    ip: "10.20.4.12", mac: "00:1B:44:11:3A:B8", rtspUrl: "rtsp://10.20.4.12:554/stream1",
    status: "online", location: "Geylang NC1, Singapore", zone: "Geylang",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3148, lng: 103.8778, maker: "Hikvision", resolution: "FHD (1920×1080)",
  },
  {
    id: "cam-orchard", projectId: "proj-sg", code: "CAM-ORC-001", name: "Orchard MRT",
    ip: "10.20.4.13", mac: "00:1B:44:11:3A:B9", rtspUrl: "rtsp://10.20.4.13:554/stream1",
    status: "online", location: "Orchard MRT, Singapore", zone: "Orchard",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.3044, lng: 103.8321, maker: "Dahua", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-bugis", projectId: "proj-sg", code: "CAM-BGS-001", name: "Bugis MRT",
    ip: "10.20.4.14", mac: "00:1B:44:11:3A:BA", rtspUrl: "rtsp://10.20.4.14:554/stream1",
    status: "online", location: "Bugis MRT, Singapore", zone: "Bugis",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3006, lng: 103.8561, maker: "Hanwha", resolution: "FHD (1920×1080)",
  },
  {
    id: "cam-tampines", projectId: "proj-sg", code: "CAM-TPS-001", name: "Tampines Hub",
    ip: "10.20.4.15", mac: "00:1B:44:11:3A:BB", rtspUrl: "rtsp://10.20.4.15:554/stream1",
    status: "online", location: "Tampines Hub, Singapore", zone: "Tampines",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3528, lng: 103.9440, maker: "Hikvision", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-bedok", projectId: "proj-sg", code: "CAM-BDK-001", name: "Bedok MRT",
    ip: "10.20.4.16", mac: "00:1B:44:11:3A:BC", rtspUrl: "rtsp://10.20.4.16:554/stream1",
    status: "offline", location: "Bedok MRT, Singapore", zone: "Bedok",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3240, lng: 103.9302, maker: "Dahua", resolution: "FHD (1920×1080)",
  },
  {
    id: "cam-queenstown", projectId: "proj-sg", code: "CAM-QTN-001", name: "Queenstown",
    ip: "10.20.4.17", mac: "00:1B:44:11:3A:BD", rtspUrl: "rtsp://10.20.4.17:554/stream1",
    status: "online", location: "Queenstown, Singapore", zone: "Queenstown",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.2942, lng: 103.8060, maker: "Hanwha", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-jurong-east", projectId: "proj-sg", code: "CAM-JRE-001", name: "Jurong East",
    ip: "10.20.4.18", mac: "00:1B:44:11:3A:BE", rtspUrl: "rtsp://10.20.4.18:554/stream1",
    status: "offline", location: "Jurong East, Singapore", zone: "Jurong East",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3329, lng: 103.7436, maker: "Hikvision", resolution: "FHD (1920×1080)",
  },
  // Bulk-generated, deterministic (seededRandom, not Math.random — see above) — one small batch
  // per district so the Dashboard map's zoomed-out cluster pills have real, non-zero counts to
  // aggregate instead of showing mostly-empty districts. Kept in the 50-60 total camera range on
  // purpose: DataPage's LiveMonitoringTab seeds 120 live-feed items per camera and ticks one
  // addEvent per online camera every few seconds, so going into the hundreds would make that
  // "All Cameras" view and the per-tick store updates too heavy.
  ...DISTRICTS.flatMap((district, di) => {
    const thumbnails = [
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    ];
    const camCount = Math.floor(seededRandom(di * 4.13 + 9) * 7); // 0–6 cameras in this district
    const MAKERS = ["Hanwha", "Hikvision", "Dahua"];
    const RESOLUTIONS = ["FHD (1920×1080)", "4K (3840×2160)"];
    return Array.from({ length: camCount }, (_, j) => {
      const idx = di * 6 + j; // stable per-camera seed base, unique across all districts
      const isOnline = seededRandom(idx * 8.17 + 2) > 0.1; // ~90% online
      const jitterLat = (seededRandom(idx * 3.31 + 3) - 0.5) * 0.02; // ±0.01°, ~±1km
      const jitterLng = (seededRandom(idx * 5.71 + 4) - 0.5) * 0.02;
      const maker = MAKERS[Math.floor(seededRandom(idx * 6.53 + 5) * MAKERS.length)];
      const resolution = RESOLUTIONS[Math.floor(seededRandom(idx * 7.91 + 6) * RESOLUTIONS.length)];
      return {
        id: `cam-bulk-${idx}`,
        projectId: "proj-sg",
        code: `CAM-BLK-${String(idx).padStart(3, "0")}`,
        name: `${district.label} ${j + 1}`,
        ip: `10.30.${1 + (idx >> 8)}.${idx % 256}`,
        mac: `00:1B:44:22:${String(10 + (idx % 90)).padStart(2, "0")}:${String(idx % 100).padStart(2, "0")}`,
        rtspUrl: `rtsp://10.30.${1 + (idx >> 8)}.${idx % 256}:554/stream1`,
        status: (isOnline ? "online" : "offline") as CameraStatus,
        location: district.label,
        zone: district.label,
        thumbnail: thumbnails[idx % thumbnails.length],
        lat: Math.round((district.lat + jitterLat) * 10000) / 10000,
        lng: Math.round((district.lng + jitterLng) * 10000) / 10000,
        maker, resolution,
      };
    });
  }),
];
/**
 * The project's camera codes, in roster order. Mock datasets that need to name a camera draw from
 * here rather than inventing their own labels: Re-ID's grid used to carry "NC-1".."NC-4", which
 * meant its camera filter listed names that appeared nowhere else in the app and could never match
 * a real camera. One id space, so a camera means the same thing on every screen.
 */
export const CAMERA_CODES = CAMERAS.map(c => c.code);


// A separate, much larger camera pool that only the VIP-detection simulator (VipAlertTicker in
// ClientLayout.tsx) picks from — NOT part of the `cameras` store state above, and not rendered as
// a device list anywhere. Deliberately kept out of `CAMERAS`: that array is capped around 50-60 on
// purpose (see the comment there) because LiveMonitoringTab seeds 120 feed items per camera and
// ticks an addEvent per online camera every 4s, so a 1,000-entry `cameras` store would make that
// feature very heavy. This pool exists purely so the Dashboard's VIP simulation feels like it's
// running across the smart city's real ~1,000-camera deployment, without that cost.
export const VIP_SIMULATION_CAMERAS: Camera[] = DISTRICTS.flatMap((district, di) => {
  const thumbnails = [
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
  ];
  const camCount = 58 + Math.floor(seededRandom(di * 7.77 + 50000) * 6); // ~58-63 per district, ~1,000 total across 17 districts
  return Array.from({ length: camCount }, (_, j) => {
    const idx = 50000 + di * 100 + j; // large offset keeps ids/seeds distinct from CAMERAS's own bulk pool
    const isOnline = seededRandom(idx * 8.17 + 2) > 0.1; // ~90% online, same ratio as the small pool
    const jitterLat = (seededRandom(idx * 3.31 + 3) - 0.5) * 0.02;
    const jitterLng = (seededRandom(idx * 5.71 + 4) - 0.5) * 0.02;
    return {
      id: `cam-sim-${idx}`,
      projectId: "proj-sg",
      code: `CAM-SIM-${String(idx).padStart(5, "0")}`,
      name: `${district.label} ${j + 1}`,
      ip: `10.40.${1 + (idx >> 8)}.${idx % 256}`,
      mac: `00:1B:44:33:${String(10 + (idx % 90)).padStart(2, "0")}:${String(idx % 100).padStart(2, "0")}`,
      rtspUrl: `rtsp://10.40.${1 + (idx >> 8)}.${idx % 256}:554/stream1`,
      status: (isOnline ? "online" : "offline") as CameraStatus,
      location: district.label,
      zone: district.label,
      thumbnail: thumbnails[idx % thumbnails.length],
      lat: Math.round((district.lat + jitterLat) * 10000) / 10000,
      lng: Math.round((district.lng + jitterLng) * 10000) / 10000,
    };
  });
});

function cameraIdForLocation(location: string): string {
  return CAMERAS.find(c => c.name === location)?.id ?? CAMERAS[0].id;
}

// Seeded from mockData's liveEvents — the ONE raw event list — so the store starts already
// consistent with what the Dashboard/Sidebar show, instead of inventing a second baseline.
const SEED_EVENTS: VcaEvent[] = liveEvents.map((e) => ({
  id: `evt-seed-${e.id}`,
  cameraId: cameraIdForLocation(e.location),
  type: e.type === "VIP" ? "VIP Match" : "Tracking Detection",
  severity: e.type === "VIP" ? "warning" : "info",
  timestamp: e.timestamp,
  personId: e.id,
  personName: e.name,
  personDescription: e.description,
  personType: e.type,
  confidence: e.confidence,
  location: e.location,
  cameraLabel: e.cameraLabel,
  personPath: e.path,
  lat: e.lat,
  lng: e.lng,
  photoUrl: getFacePhoto(e.id),
}));

// Registration metadata for the VIP registry — not present on the raw mockData events (those are
// detections, not registrations), so it's seeded here per known name until Portal's real API lands.
const PERSON_REGISTRY_INFO: Record<string, { registeredAt: string; description: string }> = {
  "Alexander Wright": { registeredAt: "2026-03-14", description: "Corporate Security — Executive Protection" },
  "Priya Nair":        { registeredAt: "2026-05-02", description: "VIP Watchlist — Frequent Visitor" },
};

export const PERSONS: Person[] = (() => {
  const seen = new Set<string>();
  const persons: Person[] = [];
  liveEvents.forEach((e) => {
    // Tracking events are anonymous re-id trails, not identified individuals — they don't
    // belong in the Person/VIP registry.
    if (e.type === "Tracking" || seen.has(e.name)) return;
    seen.add(e.name);
    const info = PERSON_REGISTRY_INFO[e.name];
    persons.push({
      id: `person-${e.id}`,
      name: e.name,
      type: e.type,
      photoUrl: getFacePhoto(e.id),
      registeredAt: info?.registeredAt ?? "2026-01-01",
      description: info?.description,
    });
  });
  return persons;
})();

let cameraSeq = CAMERAS.length;
let projectSeq = PROJECTS.length;
let personSeq = PERSONS.length;
let eventSeq = SEED_EVENTS.length;
let portalUserSeq = PORTAL_USERS.length;
let orgSeq = ORGANIZATIONS.length;
let serverSeq = SERVERS.length;

// Latest seed timestamp — anything at or before this is historical, so the bell starts with
// nothing unread instead of surfacing all 12 seed VIP hits as "new" on first load.
const LATEST_SEED_TIMESTAMP = SEED_EVENTS.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), "");

// ── BACKEND HANDOFF: everything from here down to personHitHistory()/addEvent()'s classification
// branch (search "distinctRecentCameras") is a CLIENT-SIDE STAND-IN for a decision a real
// recognition engine should be making. Today the frontend infers "is this a plain VIP sighting or
// a multi-camera Tracking trail" itself, per new event, from nothing but timestamps/camera keys
// in whatever's already in the store — the three window constants below (VIP_SESSION_WINDOW_MS,
// VIP_ACTIVITY_WINDOW_MS, TRACKING_CLASSIFICATION_WINDOW_MS) are its whole "business logic".
// Once a real backend supplies detections with their own classification already decided (e.g. a
// `personType`/"Tracking" flag and a ready-made multi-camera path per event), this entire
// merge/classify block should be DELETED, not adapted — addEvent should just append whatever the
// server already decided, the same way the `if (!event.personName || !event.location)` branch
// right below already does for generic non-person events. Keeping it until then, rather than
// ripping it out early, is what let this session simulate realistic-looking VIP/Tracking activity
// with no backend at all — but it's the single biggest "client is doing the server's job" piece
// in this codebase and shouldn't be extended further or copied elsewhere.
//
// A real recognition engine re-fires repeatedly while the same person lingers in one camera's
// frame — that's one continuous sighting, not N separate visits, so those re-fires should update
// the existing history row (bump its "last seen" time) rather than spam the list with duplicates.
// Only a gap LONGER than this counts as the person genuinely leaving and reappearing later, which
// still logs as a brand-new row (this window is intentionally short — a few minutes apart is a
// real second visit, not the same dwell).
const VIP_SESSION_WINDOW_MS = 2 * 60 * 1000;

// A cross-camera match from a day ago shouldn't permanently pin someone as "Tracking" forever —
// without a recency bound, every registered person eventually gets seen at 2+ distinct cameras
// at some point given enough live ticks, and once that happens they can never move back to a
// plain "VIP Detection" row even if every hit since has been at the same single camera. Bounding
// classification to a rolling recent window lets that trail actually go stale, matching the
// "24 hours" framing this Tracking feature was designed around.
const VIP_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

// The 24h window above bounds how much history is kept at all, but a SINGLE cross-camera hit
// anywhere in that whole day used to be enough to lock someone into "Tracking" for the rest of
// it — given enough live ticks, every registered person eventually takes that one alt-camera hit
// at some point, and once they do, they stay classified as "Tracking" long after they've settled
// back into being seen at just one camera again. That's a one-way ratchet that empties out the
// plain "VIP Detection" rows entirely after a few hours of a session running, not something that
// only shows up after a real 24 hours. Classification (VIP vs. Tracking) instead looks only at
// this much shorter, ACTUAL-recent window — someone reverts to a plain VIP row once their
// cross-camera activity itself goes quiet, even while their fuller day-long trail is still kept
// (and still shown) via VIP_ACTIVITY_WINDOW_MS above.
const TRACKING_CLASSIFICATION_WINDOW_MS = 20 * 60 * 1000;

interface LiveHit { location: string; cameraLabel?: string; timestamp: string; confidence: number; lat: number; lng: number }

function hitCameraKey(h: { cameraLabel?: string; location?: string }): string {
  return `${h.location ?? ""}::${h.cameraLabel ?? ""}`;
}

// Same grouping rule as mockData.ts's deriveLiveEvents (2+ distinct cameras -> one collapsed
// Tracking row), but applied incrementally so it also covers events added live via addEvent, not
// just the static seed data. A person's full hit history lives disassembled across their current
// event rows — a Tracking row's `personPath` for older hits, plain VIP rows for anything not yet
// promoted — and gets rebuilt every time a new hit comes in for them. Only hits within
// VIP_ACTIVITY_WINDOW_MS of `nowMs` count — older ones age out of both the classification and the
// rebuilt history/path entirely.
function personHitHistory(events: VcaEvent[], personName: string, nowMs: number): LiveHit[] {
  const hits: LiveHit[] = [];
  events.filter(e => e.personName === personName).forEach(e => {
    if (e.personType === "Tracking" && e.personPath) {
      hits.push(...e.personPath.map(p => ({ location: p.location, cameraLabel: p.cameraLabel, timestamp: p.timestamp, confidence: p.confidence ?? 0, lat: e.lat ?? 0, lng: e.lng ?? 0 })));
    } else {
      hits.push({ location: e.location ?? "", cameraLabel: e.cameraLabel, timestamp: e.timestamp, confidence: e.confidence ?? 0, lat: e.lat ?? 0, lng: e.lng ?? 0 });
    }
  });
  return hits
    .filter(h => nowMs - new Date(h.timestamp).getTime() <= VIP_ACTIVITY_WINDOW_MS)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export const useVcaStore = create<VcaStoreState>((set) => ({
  organizations: ORGANIZATIONS,
  projects: PROJECTS,
  cameras: CAMERAS,
  persons: PERSONS,
  events: SEED_EVENTS,
  portalUsers: PORTAL_USERS,
  servers: SERVERS,
  lastReadNotifAt: LATEST_SEED_TIMESTAMP,
  dataNavRequest: null,
  setCameraStatus: (cameraId, status) =>
    set(state => ({ cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, status } : c)) })),
  addCamera: (camera) =>
    set(state => ({ cameras: [...state.cameras, { ...camera, id: `cam-${++cameraSeq}` }] })),
  updateCamera: (cameraId, updates) =>
    set(state => ({ cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, ...updates } : c)) })),
  removeCamera: (cameraId) =>
    set(state => ({ cameras: state.cameras.filter(c => c.id !== cameraId) })),
  addProject: (project) =>
    set(state => ({ projects: [...state.projects, { ...project, id: `proj-${++projectSeq}` }] })),
  updateProjectLicense: (projectId, updates) =>
    set(state => ({ projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)) })),
  addPerson: (person) =>
    set(state => ({ persons: [...state.persons, { ...person, id: `person-${++personSeq}` }] })),
  removePerson: (personId) =>
    set(state => ({ persons: state.persons.filter(p => p.id !== personId) })),
  addEvent: (event) =>
    set(state => {
      if (!event.personName || !event.location) {
        return { events: [{ ...event, id: `evt-${++eventSeq}` }, ...state.events].slice(0, 500) };
      }

      const personName = event.personName;
      const otherEvents = state.events.filter(e => e.personName !== personName);
      const history = personHitHistory(state.events, personName, new Date(event.timestamp).getTime());
      const newHit: LiveHit = { location: event.location, cameraLabel: event.cameraLabel, timestamp: event.timestamp, confidence: event.confidence ?? 0, lat: event.lat ?? 0, lng: event.lng ?? 0 };

      // Session-merge against only the MOST RECENT prior hit, and only if it's the same camera —
      // a return visit after being seen elsewhere in between must NOT merge into that older
      // same-camera hit, since the person genuinely left and came back (that gap is exactly what
      // makes it a trackable path rather than one long dwell).
      const last = history[history.length - 1];
      if (last && hitCameraKey(last) === hitCameraKey(newHit) &&
          Math.abs(new Date(newHit.timestamp).getTime() - new Date(last.timestamp).getTime()) <= VIP_SESSION_WINDOW_MS) {
        history[history.length - 1] = newHit;
      } else {
        history.push(newHit);
      }

      const newestMs = new Date(history[history.length - 1].timestamp).getTime();
      const recentHistory = history.filter(h => newestMs - new Date(h.timestamp).getTime() <= TRACKING_CLASSIFICATION_WINDOW_MS);
      const distinctRecentCameras = new Set(recentHistory.map(hitCameraKey));
      let personEvents: VcaEvent[];
      if (distinctRecentCameras.size >= 2) {
        // 2+ distinct cameras — collapse this person's entire history into one Tracking row
        // (replaces whatever VIP/Tracking rows they had before), same rule as mockData.ts's
        // deriveLiveEvents for the static seed data.
        const latest = history[history.length - 1];
        personEvents = [{
          ...event,
          id: `evt-${++eventSeq}`,
          personType: "Tracking",
          location: latest.location,
          cameraLabel: latest.cameraLabel,
          timestamp: latest.timestamp,
          lat: latest.lat,
          lng: latest.lng,
          confidence: 0,
          personPath: history.map(h => ({ location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence })),
        }];
      } else {
        // Still only ever seen at one camera — one VIP row per (session-merged) hit.
        personEvents = history.map(h => ({
          ...event,
          id: `evt-${++eventSeq}`,
          personType: "VIP",
          location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence, lat: h.lat, lng: h.lng,
        }));
      }

      return { events: [...personEvents, ...otherEvents].slice(0, 500) };
    }),
  markNotificationsRead: () => set({ lastReadNotifAt: new Date().toISOString() }),
  requestDataNav: (req) =>
    set(state => ({ dataNavRequest: { ...req, requestId: (state.dataNavRequest?.requestId ?? 0) + 1 } })),
  addPortalUser: (user) =>
    set(state => ({ portalUsers: [...state.portalUsers, { ...user, id: `user-${++portalUserSeq}` }] })),
  updatePortalUserPermission: (userId, permission) =>
    set(state => ({ portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, permission } : u)) })),
  updatePortalUserProjects: (userId, projectIds) =>
    set(state => ({ portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, projectIds } : u)) })),
  removePortalUser: (userId) =>
    set(state => ({ portalUsers: state.portalUsers.filter(u => u.id !== userId) })),
  addOrganization: (org) => {
    const id = `org-${++orgSeq}`;
    set(state => ({ organizations: [...state.organizations, { ...org, id }] }));
    return id;
  },
  addServer: (server) =>
    set(state => ({ servers: [...state.servers, { ...server, id: `srv-${++serverSeq}` }] })),
  updateServer: (serverId, updates) =>
    set(state => ({ servers: state.servers.map(s => (s.id === serverId ? { ...s, ...updates } : s)) })),
  removeServer: (serverId) =>
    set(state => ({ servers: state.servers.filter(s => s.id !== serverId) })),
}));

// Converts store events back into the Dashboard/Sidebar's LiveEvent shape. Only events carrying
// person-match info (personType set) are person detections — generic camera/system events (e.g.
// a bare online/offline ping) have nothing to show here and are skipped.
export function vcaEventsToLiveEvents(events: VcaEvent[]): LiveEvent[] {
  return events
    .filter((e): e is VcaEvent & { personType: EventType } => e.personType !== undefined)
    .map((e) => ({
      id: e.personId ?? e.id,
      name: e.personName ?? "Unknown",
      description: e.personDescription,
      confidence: e.confidence ?? 0,
      location: e.location ?? "",
      cameraLabel: e.cameraLabel,
      path: e.personPath,
      timestamp: e.timestamp,
      type: e.personType,
      lat: e.lat ?? 0,
      lng: e.lng ?? 0,
    }));
}

export interface DetectionHit {
  id: string;
  timestamp: string;
  location: string;
}

// A "Tracking" row is a VIEW: the same underlying VIP re-identifications, just collapsed into
// one row for the Sidebar once someone's been cross-camera-matched (see addEvent above). Counting
// rows (1 per person, however many hops their trail has) answers "how many people showed up in my
// feed today" — counting HITS (every hop unrolled) answers "how many individual recognition
// events actually happened today." The Dashboard's "Today's detections" stat and its
// "VIP Detection Today" chart both want the second question, and used to answer it two different
// ways (row-count vs. hit-count) — sharing this one derivation keeps them from silently drifting
// apart again.
export function todaysDetectionHits(events: VcaEvent[]): DetectionHit[] {
  const hits: DetectionHit[] = [];
  events.forEach(e => {
    if (e.personType === "VIP" && e.location) {
      hits.push({ id: e.id, timestamp: e.timestamp, location: e.location });
    } else if (e.personType === "Tracking" && e.personPath) {
      e.personPath.forEach((hop, i) => {
        if (hop.location) hits.push({ id: `${e.id}-${i}`, timestamp: hop.timestamp, location: hop.location });
      });
    }
  });
  return hits.filter(h => isTodaySgt(new Date(h.timestamp)));
}
