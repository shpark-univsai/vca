import { create } from "zustand";
import { liveEvents, getFacePhoto, DISTRICTS, type EventType, type LiveEvent, type TrackingHop } from "@/lib/mockData";
import { isTodaySgt, recentSgtStamp, parseSgtStamp } from "@/lib/time";
import { generateRegistrationCode, type RosterEntry } from "@/lib/staffRoster";
import { generateTemporaryPassword } from "@/lib/password";

// Deterministic pseudo-random in [0,1) — same formula as mockData.ts's own seededRandom — used
// below to bulk-generate cameras without Math.random(), which would differ between the
// server-rendered and client-hydrated pass and trigger a hydration mismatch.
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Thin accessor kept so call sites elsewhere in Portal don't need to know the license shape —
// currently a single combined channel pool (AI and normal cameras share one quota; the License
// tab breaks usage down by type, but the limit itself isn't split).
export function projectChannelLimit(project: Pick<Project, "licenseChannelLimit">): number | undefined {
  return project.licenseChannelLimit;
}

export const UNLIMITED_EXPIRY = "Unlimited";

// Flat per-channel subscription rate used both on Overview's CHANNELS cell and the License tab's
// contract breakdown — one constant so the two never drift apart.
export const PRICE_PER_CHANNEL_PER_YEAR = 100;

export type CameraStatus = "online" | "offline";

/**
 * How VCA reaches a user's mailbox. VCA does not host mail — it is an SMTP *sender*, handing the
 * message to the customer's own mail server (Exchange / Zimbra / Postfix), which is what the user
 * reads in their internal webmail. That is what makes an invite link workable on an
 * internet-separated network: both the webmail and VCA sit inside it.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  /** The From: address messages are sent as, e.g. "vca-noreply@company.local". */
  fromAddress: string;
  username?: string;
  useTls?: boolean;
}

export interface Team {
  id: string;
  name: string;
  region: string;
  /**
   * The mail domain accounts here live on, e.g. "company.local". Requests and invites to an address
   * outside it cannot be delivered by that mail server, so the forms refuse them up front rather
   * than leaving a requester waiting on an invite that can never arrive.
   */
  mailDomain?: string;
  smtp?: SmtpConfig;
  // Set at signup (Step 2 — "Primary Industry"); pre-highlights the matching template on the
  // New Project Wizard that follows signup. Optional since existing/legacy orgs won't have it.
  industry?: string;
}

export type ProjectType = "smart_city" | "smart_school";

export interface Project {
  id: string;
  teamId: string;
  name: string;
  type: ProjectType;
  // Set/edited from the project's License tab in Portal — governs how many camera channels this
  // project is provisioned for and when that provisioning expires. One shared pool (AI and normal
  // cameras draw from the same quota) — the License tab shows AI vs. normal as a usage breakdown
  // of this single number, not two separate limits. Optional so projects created before this
  // existed (or without a license configured yet) still type-check.
  licenseChannelLimit?: number;
  licensePlan?: string;
  // A date string, or the literal "Unlimited" for a plan with no expiry.
  licenseExpiresAt?: string;
  // System/infrastructure info shown on Portal's Overview tab — mirrors what an ops-facing admin
  // dashboard needs alongside the business KPIs above. Optional so existing/seeded projects
  // without this configured still type-check.
  computeInstance?: string;
  gpuCount?: number;
  modelVersion?: string;
  lastMigration?: string;
  lastBackupAt?: string;
  regionName?: string;
  // Whether THIS project's site sits on an internet-isolated network — not a hosting-model flag.
  // Every deployment is on-premise (decided 2026-09-02, see getAuthConfig()'s doc comment); that
  // settled whether VCA is ever offered as cloud-hosted SaaS (no), but it didn't settle whether a
  // given on-prem site can still reach the internet, which varies per customer site and is what
  // this pair actually tracks. true = air-gapped, mail can only go through that site's internal
  // mailbox; false = the site has outbound internet, external email works normally.
  //
  // Split into a detected value and an optional override rather than one flag, because a real
  // server would detect this by pinging out and a firewall/security policy can make that check
  // return a false positive/negative — so the resolved value has to be overridable by an admin,
  // not just server-reported. Read through isNetworkIsolated(), never directly, so "override wins
  // when set, detected value otherwise" is decided in one place.
  networkIsolatedDetected?: boolean;
  networkIsolatedOverride?: boolean | null;
  /**
   * Overrides the team's mail settings for this one project. Optional because the normal
   * case is a company running a single mail server: filling this per project would mean retyping
   * the same host ten times for ten projects. But network isolation is resolved PER PROJECT, not
   * per team (see isNetworkIsolated()), and the seed data already has one team holding both an
   * internet-isolated and an internet-reachable
   * project — so mail genuinely differs between projects (internal-only server vs normal external
   * relay), and the override earns its place. Read through resolveMailConfig(), never directly, so
   * the fallback is decided in one spot instead of re-implemented per screen.
   */
  mailDomain?: string;
  smtp?: SmtpConfig;
  regionFlag?: string;
  regionCenterCount?: number;
  regionSubcenterCount?: number;
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


interface VcaStoreState {
  teams: Team[];
  projects: Project[];
  cameras: Camera[];
  persons: Person[];
  events: VcaEvent[];
  portalUsers: PortalUser[];
  servers: Server[];
  auditLog: AuditEvent[];
  accessRequests: AccessRequest[];
  staffRoster: RosterEntry[];
  // Notifications (header bell) only care about VIP-match events from this point forward —
  // events seeded at load are historical and start out already "read".
  lastReadNotifAt: string;
  setCameraStatus: (cameraId: string, status: CameraStatus) => void;
  addCamera: (camera: Omit<Camera, "id">) => void;
  updateCamera: (cameraId: string, updates: Partial<Omit<Camera, "id" | "projectId">>) => void;
  removeCamera: (cameraId: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProjectLicense: (projectId: string, updates: Pick<Project, "licenseChannelLimit" | "licensePlan" | "licenseExpiresAt">) => void;
  updateProjectMail: (projectId: string, updates: Pick<Project, "mailDomain" | "smtp">) => void;
  // null clears the override and falls back to the auto-detected value; true/false pins it.
  setNetworkIsolationOverride: (projectId: string, override: boolean | null) => void;
  updateTeamMail: (teamId: string, updates: Pick<Team, "mailDomain" | "smtp">) => void;
  addPerson: (person: Omit<Person, "id">) => void;
  removePerson: (personId: string) => void;
  addEvent: (event: Omit<VcaEvent, "id">) => void;
  markNotificationsRead: () => void;
  addPortalUser: (user: Omit<PortalUser, "id">) => string;
  updatePortalUserPermission: (userId: string, permission: PortalPermission) => void;
  updatePortalUserProjects: (userId: string, projectIds: string[]) => void;
  updatePortalUserStatus: (userId: string, status: PortalUserStatus) => void;
  /**
   * Issue a temporary password for an account and return the plaintext, once. Returns null when
   * there is no such user, so the caller shows nothing rather than an empty credential box.
   *
   * HANDOFF NOTE: the plaintext is generated and returned here only because there is no backend.
   * The real call is a POST to the reset endpoint that returns the password the *server* generated
   * — see generateTemporaryPassword()'s note. Nothing but the issuing modal may ever read the
   * return value, and it is deliberately not stored: the store keeps the timestamp and the
   * must-change flag, never the password itself, so no later screen can redisplay it.
   */
  issueTemporaryPassword: (userId: string) => string | null;
  /** Called once the user has set a password of their own — retires the temporary one. */
  clearTemporaryPassword: (userId: string) => void;
  /**
   * Issue a setup code for an account and return it. The alternative to a temporary password for
   * the same job: handing someone their first way in. Use it when a password cannot be passed on
   * safely — nobody to read it out to, or a handover where the supplier should not end up holding a
   * credential that works.
   *
   * A reissue replaces the previous code, so the old slip of paper stops working.
   */
  issueSetupCode: (userId: string) => string | null;
  /** Called once the code has been redeemed, or when revoking an unused one. */
  clearSetupCode: (userId: string) => void;
  removePortalUser: (userId: string) => void;
  requestAccess: (request: Omit<AccessRequest, "id" | "requestedAt">) => void;
  approveAccessRequests: (requestIds: string[]) => string[];
  dismissAccessRequest: (requestId: string) => void;
  addTeam: (team: Omit<Team, "id">) => string;
  addServer: (server: Omit<Server, "id">) => void;
  updateServer: (serverId: string, updates: Partial<Omit<Server, "id" | "projectId">>) => void;
  removeServer: (serverId: string) => void;
  // Registration-code actions for the staff roster — see staffRoster.ts for the type/alphabet and
  // ProjectRosterTab.tsx for the screen. Keyed by employeeId (the roster's own matching key), not a
  // generated id, since these never need one of their own.
  issueRegistrationCodes: (employeeIds: string[]) => void;
  reissueRegistrationCode: (employeeId: string) => void;
  removeRosterEntry: (employeeId: string) => void;
  logRosterCodeViewed: (employeeId: string) => void;
}

// A lightweight admin activity feed for Portal's Overview tab ("Recent Activity") — who did what,
// and when, scoped to a project. Not a general-purpose audit trail: only the handful of actions an
// admin most needs a record of (camera status/roster changes, license updates, VIP registrations,
// user permission changes) call `logAudit`, matching what the Figma "최근 관리자 작업 이력" reference
// tracks. `projectId` is optional because a user-permission change isn't tied to one project.
export interface AuditEvent {
  id: string;
  projectId?: string;
  message: string;
  actor: string;
  at: string;
}

const TEAMS: Team[] = [
  {
    id: "team-univs", name: "City of Singapore — Smart Infrastructure Office", region: "Singapore",
    mailDomain: "smartcity.gov.sg",
    smtp: { host: "mail.smartcity.gov.sg", port: 587, fromAddress: "vca-noreply@smartcity.gov.sg", useTls: true },
  },
];

const PROJECTS: Project[] = [
  {
    id: "proj-sg", teamId: "team-univs", name: "Marina Bay & CBD Surveillance Network", type: "smart_city",
    licensePlan: "Enterprise", licenseChannelLimit: 100, licenseExpiresAt: "2029-06-04",
    computeInstance: "vca.large", gpuCount: 4, modelVersion: "model_v2_prod", lastMigration: "v2_alert_schema",
    lastBackupAt: auditAt(19 * 60),
    regionName: "Singapore", networkIsolatedDetected: false, regionFlag: "🇸🇬", regionCenterCount: 1, regionSubcenterCount: 2,
  },
  {
    id: "proj-riverside", teamId: "team-univs", name: "Riverside International School", type: "smart_school",
    licensePlan: "Professional", licenseChannelLimit: 40, licenseExpiresAt: "2027-09-01",
    computeInstance: "vca.medium", gpuCount: 2, modelVersion: "model_v2_prod", lastMigration: "v2_alert_schema",
    lastBackupAt: auditAt(7 * 60),
    regionName: "Singapore", networkIsolatedDetected: true, regionFlag: "🇸🇬", regionCenterCount: 1, regionSubcenterCount: 0,
  },
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
  teamId: string;
  projectIds: string[];
  permission: PortalPermission;
  status: PortalUserStatus;
  // Security/audit columns shown in Portal's Users & Permissions table. Optional so existing/seeded
  // users (none of which have this configured) still type-check.
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  // Set when this account is completing an invite via /password-setup — lets that page confirm
  // it's finishing the right person's signup and land them straight in the app afterward instead
  // of bouncing through /login. Cleared once the invite is completed (status becomes "active").
  inviteToken?: string;
  /**
   * When an administrator last issued a temporary password for this account (the recovery path for
   * a deployment with no outbound mail — see authConfig's passwordRecovery: "adminOnly"). Kept so
   * the Users table can show, at a glance, who is still sitting on a credential a second person has
   * seen. Cleared the moment they set their own.
   */
  tempPasswordIssuedAt?: string;
  /**
   * Forces the set-a-new-password step at the next login instead of letting them in. A temporary
   * password is known to whoever read it out, so an account that keeps one is an account with a
   * shared password.
   */
  mustChangePassword?: boolean;
  /**
   * A single-use code that lets this person set their own password, used where a temporary password
   * cannot be handed over — the first administrator at an on-premise handover, or anyone the
   * administrator cannot safely read a password out to.
   *
   * Unlike a temporary password this IS stored, and the difference is the point: a temporary
   * password is a working credential, so keeping it would mean keeping something that can sign in.
   * A setup code cannot sign in at all — it only unlocks the set-a-password screen, and it burns on
   * use — so it has to be stored to be verifiable.
   *
   * HANDOFF NOTE: the backend stores a hash, not this. It must also expire codes and rate-limit
   * attempts; the code is the only thing standing in front of an account.
   */
  setupCode?: string;
  setupCodeIssuedAt?: string;
}

// Someone who found a project link but has no access yet, asking a Portal admin to grant it —
// the "링크 공유받은 경우" branch of the invite flow (as opposed to being invited directly). Approving
// one turns it into an invited PortalUser; there's deliberately no "rejected" state to persist —
// per the reviewed UX pattern (Miro/MS Teams-style request inboxes), an admin just dismisses it
// and the requester sees a neutral "no access yet" screen on their next visit, nothing punitive.
export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  projectId: string;
  reason?: string;
  requestedAt: string;
}

const PORTAL_USERS: PortalUser[] = [
  { id: "user-1", name: "Grace Tan", email: "grace.tan@univs.ai", teamId: "team-univs", projectIds: ["proj-sg", "proj-riverside"], permission: "admin", status: "active", mfaEnabled: true, lastLoginAt: "2026-08-25 09:14" },
  { id: "user-2", name: "Marcus Lee", email: "marcus.lee@univs.ai", teamId: "team-univs", projectIds: ["proj-sg"], permission: "operator", status: "active", mfaEnabled: true, lastLoginAt: "2026-08-24 18:02" },
  { id: "user-3", name: "Nadia Rahman", email: "nadia.rahman@univs.ai", teamId: "team-univs", projectIds: ["proj-riverside"], permission: "operator", status: "active", mfaEnabled: false, lastLoginAt: "2026-08-20 11:47" },
  { id: "user-4", name: "Wei Chen", email: "wei.chen@univs.ai", teamId: "team-univs", projectIds: ["proj-sg"], permission: "operator", status: "invited" },
  { id: "user-5", name: "David Ong", email: "david.ong@univs.ai", teamId: "team-univs", projectIds: ["proj-sg"], permission: "operator", status: "suspended", mfaEnabled: false, lastLoginAt: "2026-06-02 08:30" },
];

const ACCESS_REQUESTS: AccessRequest[] = [
  { id: "req-1", name: "Daniel Foo", email: "daniel.foo@univs.ai", projectId: "proj-sg", reason: "Covering the night shift this week and need to check camera status.", requestedAt: auditAt(45) },
  { id: "req-2", name: "Siti Aminah", email: "siti.aminah@univs.ai", projectId: "proj-sg", reason: "New hire on the ops team, was told to request access here.", requestedAt: auditAt(3 * 60) },
  { id: "req-3", name: "Marcus Lee", email: "marcus.lee2@univs.ai", projectId: "proj-riverside", requestedAt: auditAt(26 * 60) },
];

// Mock stand-in for an Excel-imported staff roster (see ProjectRosterTab.tsx — the real import
// isn't built yet). Mix of all four code statuses on purpose, across both projects, so the tab's
// status filter has something in every bucket from first load.
const STAFF_ROSTER: RosterEntry[] = [
  { employeeId: "EMP-3001", name: "James Whitfield", department: "Control Room", projectId: "proj-sg", permission: "admin", status: "not-issued" },
  { employeeId: "EMP-3002", name: "Priya Nair", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "unused", code: "BPXW4762" },
  { employeeId: "EMP-3003", name: "Daniel Cruz", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", code: "HKLM9234" },
  { employeeId: "EMP-3004", name: "Farah Ismail", department: "Operations", projectId: "proj-sg", permission: "operator", status: "not-issued" },
  { employeeId: "EMP-3005", name: "Tom Reyes", department: "Field Engineering", projectId: "proj-sg", permission: "operator", status: "used", code: "QRST5678" },
  { employeeId: "EMP-3006", name: "Lena Brooks", department: "Field Engineering", projectId: "proj-sg", permission: "operator", status: "not-issued" },
  { employeeId: "EMP-3007", name: "Marcus Ho", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "expired", code: "VXYZ2345" },
  { employeeId: "EMP-3008", name: "Aisha Bakar", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", code: "JKMN6789" },
  { employeeId: "EMP-3009", name: "Ryan Tavares", department: "Field Engineering", projectId: "proj-sg", permission: "admin", status: "not-issued" },
  { employeeId: "EMP-3010", name: "Sana Idris", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "used", code: "CDFG3456" },
  { employeeId: "EMP-3011", name: "Emily Foster", department: "Operations", projectId: "proj-riverside", permission: "admin", status: "not-issued" },
  { employeeId: "EMP-3012", name: "Kevin Ng", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "LMPQ8765" },
  { employeeId: "EMP-3013", name: "Hana Suzuki", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "not-issued" },
  { employeeId: "EMP-3014", name: "Oliver Grant", department: "Operations", projectId: "proj-riverside", permission: "operator", status: "used", code: "RSTU4325" },
  { employeeId: "EMP-3015", name: "Mei Lin Tan", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "WXYZ9876" },
  { employeeId: "EMP-3016", name: "Diego Alvarez", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "expired", code: "ABCD5432" },
  { employeeId: "EMP-3017", name: "Chloe Bennett", department: "Operations", projectId: "proj-riverside", permission: "operator", status: "not-issued" },
  { employeeId: "EMP-3018", name: "Yusuf Karim", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "EFGH6543" },
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
  // Portal-scoped sample data for the Overview tab's "Recently Registered VIPs" panel — the
  // auto-generated entries above predate per-project scoping (see the Person.projectId comment)
  // and are invisible there, so that panel has nothing to show for proj-sg without these.
  persons.push(
    { id: "person-portal-1", name: "Michael Tan", type: "VIP", photoUrl: getFacePhoto("person-portal-1"), registeredAt: "2026-09-01", projectId: "proj-sg", roleLabel: "Lead", priorityLabel: "high" },
    { id: "person-portal-2", name: "Sarah Lim", type: "VIP", photoUrl: getFacePhoto("person-portal-2"), registeredAt: "2026-08-30", projectId: "proj-sg", roleLabel: "Regular", priorityLabel: "normal" },
    { id: "person-portal-3", name: "David Ho", type: "VIP", photoUrl: getFacePhoto("person-portal-3"), registeredAt: "2026-08-28", projectId: "proj-sg", roleLabel: "Special", priorityLabel: "very_high" },
    { id: "person-portal-4", name: "Rachel Wong", type: "VIP", photoUrl: getFacePhoto("person-portal-4"), registeredAt: "2026-08-25", projectId: "proj-sg", roleLabel: "Regular", priorityLabel: "normal" },
  );
  return persons;
})();

let cameraSeq = CAMERAS.length;
let projectSeq = PROJECTS.length;
let personSeq = PERSONS.length;
let eventSeq = SEED_EVENTS.length;
let portalUserSeq = PORTAL_USERS.length;
let orgSeq = TEAMS.length;
let serverSeq = SERVERS.length;
let accessRequestSeq = ACCESS_REQUESTS.length;

function auditAt(minutesAgo: number): string {
  const { date, time } = recentSgtStamp(minutesAgo);
  return parseSgtStamp(date, time).toISOString();
}

const AUDIT_LOG: AuditEvent[] = [
  { id: "audit-1", projectId: "proj-sg", message: "Camera CAM-NOV-001 RTSP URL updated", actor: "Grace Tan", at: auditAt(20) },
  { id: "audit-2", projectId: "proj-sg", message: "VIP Wei Chen registered", actor: "Marcus Lee", at: auditAt(65) },
  { id: "audit-3", projectId: "proj-sg", message: "David Ong's account suspended", actor: "Grace Tan", at: auditAt(240) },
  { id: "audit-4", projectId: "proj-riverside", message: "Server campus-fr-1 connectivity checked", actor: "Nadia Rahman", at: auditAt(50) },
];
let auditSeq = AUDIT_LOG.length;

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

export const useVcaStore = create<VcaStoreState>((set, get) => ({
  teams: TEAMS,
  projects: PROJECTS,
  cameras: CAMERAS,
  persons: PERSONS,
  events: SEED_EVENTS,
  portalUsers: PORTAL_USERS,
  servers: SERVERS,
  auditLog: AUDIT_LOG,
  accessRequests: ACCESS_REQUESTS,
  staffRoster: STAFF_ROSTER,
  lastReadNotifAt: LATEST_SEED_TIMESTAMP,
  setCameraStatus: (cameraId, status) =>
    set(state => {
      const cam = state.cameras.find(c => c.id === cameraId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: cam?.projectId, message: `Camera ${cam?.code ?? cameraId} marked ${status}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, status } : c)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  addCamera: (camera) =>
    set(state => ({
      cameras: [...state.cameras, { ...camera, id: `cam-${++cameraSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: camera.projectId, message: `Camera ${camera.name} added`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    })),
  updateCamera: (cameraId, updates) =>
    set(state => ({ cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, ...updates } : c)) })),
  removeCamera: (cameraId) =>
    set(state => {
      const cam = state.cameras.find(c => c.id === cameraId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: cam?.projectId, message: `Camera ${cam?.name ?? cameraId} removed`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        cameras: state.cameras.filter(c => c.id !== cameraId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  addProject: (project) =>
    set(state => ({ projects: [...state.projects, { ...project, id: `proj-${++projectSeq}` }] })),
  updateProjectLicense: (projectId, updates) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
      auditLog: [{ id: `audit-${++auditSeq}`, projectId, message: `License updated to ${updates.licensePlan} (${updates.licenseChannelLimit} channels)`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    })),
  // Mail settings write to the audit log the way license changes do — an admin changing where
  // invites are sent is exactly the kind of thing someone has to be able to trace later.
  updateProjectMail: (projectId, updates) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
      auditLog: [{ id: `audit-${++auditSeq}`, projectId, message: `Project mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    })),
  // This flips which mailbox invites/resets go through, same audit-worthy weight as updateProjectMail.
  setNetworkIsolationOverride: (projectId, override) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, networkIsolatedOverride: override } : p)),
      auditLog: [{
        id: `audit-${++auditSeq}`, projectId,
        message: override === null ? "Network reachability reset to auto-detection" : `Network reachability manually set to ${override ? "internet-isolated" : "internet-connected"}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }, ...state.auditLog].slice(0, 200),
    })),
  updateTeamMail: (teamId, updates) =>
    set(state => ({
      teams: state.teams.map(o => (o.id === teamId ? { ...o, ...updates } : o)),
      auditLog: [{ id: `audit-${++auditSeq}`, message: `Team mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    })),
  addPerson: (person) =>
    set(state => ({
      persons: [...state.persons, { ...person, id: `person-${++personSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: person.projectId, message: `VIP ${person.name} registered`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    })),
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
  addPortalUser: (user) => {
    const id = `user-${++portalUserSeq}`;
    set(state => ({ portalUsers: [...state.portalUsers, { ...user, id }] }));
    return id;
  },
  updatePortalUserPermission: (userId, permission) =>
    set(state => {
      // Demoting the last administrator locks the customer out just as surely as deleting them.
      if (permission !== "admin" && isLastActiveAdmin(state.portalUsers, userId)) return state;
      const user = state.portalUsers.find(u => u.id === userId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: user?.projectIds[0], message: `${user?.name ?? userId}'s permission changed to ${permission}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, permission } : u)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  updatePortalUserProjects: (userId, projectIds) =>
    set(state => ({ portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, projectIds } : u)) })),
  updatePortalUserStatus: (userId, status) =>
    set(state => {
      // Safety net behind the UI, which already refuses to offer these. Both layers are wanted: the
      // UI so the administrator is told why, this so a stray call cannot lock the customer out.
      if (status !== "active" && isLastActiveAdmin(state.portalUsers, userId)) return state;
      return { portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, status } : u)) };
    }),
  issueTemporaryPassword: (userId) => {
    const user = get().portalUsers.find(u => u.id === userId);
    if (!user) return null;
    const password = generateTemporaryPassword();
    // Logged, and worded so the log says what actually happened. Setting someone else's credential
    // is the one recovery path where a second person knows the password, so "who did this, to
    // whom, when" is the only thing standing behind it afterwards. The password itself is of
    // course never written here.
    const auditEntry: AuditEvent = {
      id: `audit-${++auditSeq}`, projectId: user.projectIds[0],
      message: `Temporary password issued for ${user.name} (${user.email}) — previous password invalidated`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    };
    // Status is deliberately left alone. An invited user who never got their mail can be handed a
    // temporary password too, and flipping them to "active" here would claim they had completed a
    // signup they have not started — they are still invited until they set their own password.
    set(state => ({
      portalUsers: state.portalUsers.map(u =>
        u.id === userId
          ? { ...u, tempPasswordIssuedAt: new Date().toISOString(), mustChangePassword: true }
          : u
      ),
      auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
    }));
    return password;
  },
  clearTemporaryPassword: (userId) =>
    set(state => ({
      portalUsers: state.portalUsers.map(u =>
        u.id === userId
          ? { ...u, tempPasswordIssuedAt: undefined, mustChangePassword: false }
          : u
      ),
    })),
  issueSetupCode: (userId) => {
    const user = get().portalUsers.find(u => u.id === userId);
    if (!user) return null;
    // Unique across both pools: /register accepts a code from either, so a collision would send
    // someone to the wrong identity.
    const taken = new Set<string>([
      ...get().portalUsers.map(u => u.setupCode).filter((c): c is string => !!c),
      ...get().staffRoster.map(r => r.code).filter((c): c is string => !!c),
    ]);
    const code = generateRegistrationCode(taken);
    const auditEntry = {
      id: `audit-${++auditSeq}`,
      message: `Setup code issued for ${user.email}`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    };
    // mustChangePassword is not set: there is no password to change yet. The code is what stands
    // between this account and its first password, and /register enforces that.
    set(state => ({
      portalUsers: state.portalUsers.map(u =>
        u.id === userId
          ? { ...u, setupCode: code, setupCodeIssuedAt: new Date().toISOString() }
          : u
      ),
      auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
    }));
    return code;
  },
  clearSetupCode: (userId) =>
    set(state => ({
      portalUsers: state.portalUsers.map(u =>
        u.id === userId ? { ...u, setupCode: undefined, setupCodeIssuedAt: undefined } : u
      ),
    })),
  removePortalUser: (userId) =>
    set(state => {
      if (isLastActiveAdmin(state.portalUsers, userId)) return state;
      const user = state.portalUsers.find(u => u.id === userId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: user?.projectIds[0], message: `User ${user?.name ?? userId} removed`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        portalUsers: state.portalUsers.filter(u => u.id !== userId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  requestAccess: (request) =>
    set(state => ({
      accessRequests: [...state.accessRequests, { ...request, id: `req-${++accessRequestSeq}`, requestedAt: new Date().toISOString() }],
    })),
  approveAccessRequests: (requestIds) => {
    const state = get();
    const toApprove = state.accessRequests.filter(r => requestIds.includes(r.id));
    const newUsers: PortalUser[] = toApprove.map(r => {
      const project = state.projects.find(p => p.id === r.projectId);
      return {
        id: `user-${++portalUserSeq}`,
        name: r.name,
        email: r.email,
        teamId: project?.teamId ?? state.teams[0]?.id ?? "",
        projectIds: [r.projectId],
        permission: "operator",
        status: "invited",
      };
    });
    const auditEntries: AuditEvent[] = toApprove.map(r => ({
      id: `audit-${++auditSeq}`, projectId: r.projectId,
      message: `Access request approved for ${r.name} — invited`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    }));
    set(s => ({
      portalUsers: [...s.portalUsers, ...newUsers],
      accessRequests: s.accessRequests.filter(r => !requestIds.includes(r.id)),
      auditLog: [...auditEntries, ...s.auditLog].slice(0, 200),
    }));
    return newUsers.map(u => u.id);
  },
  dismissAccessRequest: (requestId) =>
    set(state => ({ accessRequests: state.accessRequests.filter(r => r.id !== requestId) })),
  addTeam: (team) => {
    const id = `team-${++orgSeq}`;
    set(state => ({ teams: [...state.teams, { ...team, id }] }));
    return id;
  },
  addServer: (server) =>
    set(state => ({ servers: [...state.servers, { ...server, id: `srv-${++serverSeq}` }] })),
  updateServer: (serverId, updates) =>
    set(state => ({ servers: state.servers.map(s => (s.id === serverId ? { ...s, ...updates } : s)) })),
  removeServer: (serverId) =>
    set(state => ({ servers: state.servers.filter(s => s.id !== serverId) })),
  // Only ever touches rows that (a) were asked for and (b) don't already have a code — reissuing
  // one is a separate, explicit action, not something a repeated bulk-issue click should do.
  issueRegistrationCodes: (employeeIds) =>
    set(state => {
      const existingCodes = new Set(state.staffRoster.map(r => r.code).filter((c): c is string => !!c));
      const auditEntries: AuditEvent[] = [];
      const staffRoster = state.staffRoster.map(r => {
        if (!employeeIds.includes(r.employeeId) || r.code) return r;
        const code = generateRegistrationCode(existingCodes);
        existingCodes.add(code);
        auditEntries.push({
          id: `audit-${++auditSeq}`, projectId: r.projectId,
          message: `Registration code issued for ${r.name} (${r.employeeId})`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        });
        return { ...r, code, status: "unused" as const };
      });
      return { staffRoster, auditLog: [...auditEntries, ...state.auditLog].slice(0, 200) };
    }),
  // For a lost sheet of paper — the old code must stop working immediately, which a fresh
  // generateRegistrationCode() call already guarantees just by overwriting `code`.
  reissueRegistrationCode: (employeeId) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      if (!entry) return {};
      const existingCodes = new Set(state.staffRoster.map(r => r.code).filter((c): c is string => !!c));
      const code = generateRegistrationCode(existingCodes);
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: entry.projectId,
        message: `Registration code reissued for ${entry.name} (${entry.employeeId}) — previous code invalidated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        staffRoster: state.staffRoster.map(r => (r.employeeId === employeeId ? { ...r, code, status: "unused" as const } : r)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  // Deleting the row is what kills an unused code (a departing employee's paper code must not stay
  // a working key into the system) — there is no separate "revoke code" action because a roster row
  // with no person behind it has nothing left to protect.
  removeRosterEntry: (employeeId) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: entry?.projectId,
        message: `Roster entry removed: ${entry?.name ?? employeeId} (${employeeId})${entry?.code ? " — unused code invalidated" : ""}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        staffRoster: state.staffRoster.filter(r => r.employeeId !== employeeId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  // No roster mutation here — this is purely a "who looked at this code" trail, called when an
  // admin clicks to unmask one in ProjectRosterTab.
  logRosterCodeViewed: (employeeId) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      if (!entry) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: entry.projectId,
        message: `Registration code viewed for ${entry.name} (${entry.employeeId})`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return { auditLog: [auditEntry, ...state.auditLog].slice(0, 200) };
    }),
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

/**
 * The one place the team → project fallback is decided. Screens ask this instead of
 * reaching for `project.mailDomain` themselves; otherwise each one re-implements the fallback and
 * they drift apart — the invite modal would refuse an address the request form accepted.
 *
 * Pure, taking the two lists rather than reading getState(): a component that read state directly
 * in here would not re-render when an admin edits the mail settings, so callers pass the slices
 * they are already subscribed to.
 *
 * Returns nulls rather than throwing when nothing is configured yet. That is a real state — a fresh
 * project before an admin has filled the mail section in — and callers should say "not configured"
 * rather than pretend a domain.
 */
/**
 * Is this the only administrator who can still sign in?
 *
 * It matters because granting permissions is an administrator-only power, and this deployment is
 * on-premise with the top administrator on the customer's side — so if the last one is suspended,
 * deleted or demoted, nobody inside the customer can grant anything and the supplier has no
 * account to fix it with. There is no recovery path, which is why the actions that would cause it
 * are refused rather than warned about.
 *
 * Counts only accounts that can actually sign in: an invited or suspended administrator is not
 * standing by to help.
 */
export function isLastActiveAdmin(users: PortalUser[], userId: string): boolean {
  const target = users.find(u => u.id === userId);
  if (!target || target.permission !== "admin" || target.status !== "active") return false;
  return users.filter(u => u.permission === "admin" && u.status === "active").length <= 1;
}

export function resolveMailConfig(
  projectId: string,
  projects: Project[],
  teams: Team[],
): { mailDomain: string | null; smtp: SmtpConfig | null } {
  const project = projects.find(p => p.id === projectId);
  const team = project ? teams.find(o => o.id === project.teamId) : undefined;
  return {
    mailDomain: project?.mailDomain ?? team?.mailDomain ?? null,
    smtp: project?.smtp ?? team?.smtp ?? null,
  };
}

/** Whether a project's site should be treated as internet-isolated (mail can only go through its
 *  internal mailbox). An admin's manual override always wins when set — that's the point of it,
 *  since the auto-detected ping result can be a false positive/negative behind a firewall — and
 *  the detected value is the fallback otherwise. Read through this everywhere instead of either
 *  field directly, so this precedence lives in one place. */
export function isNetworkIsolated(project: Project): boolean {
  return project.networkIsolatedOverride ?? project.networkIsolatedDetected ?? false;
}

/** True when `email` can actually be delivered on `mailDomain`. A null domain means nothing is
 *  configured, so it cannot rule anything out and does not block — a form should not refuse an
 *  address on the strength of a setting nobody has filled in. */
export function isMailDeliverable(email: string, mailDomain: string | null): boolean {
  if (!mailDomain) return true;
  return email.trim().toLowerCase().endsWith(`@${mailDomain.toLowerCase()}`);
}
