import { create } from "zustand";
import { liveEvents, getFacePhoto, DISTRICTS, type EventType, type LiveEvent, type TrackingHop } from "@/lib/mockData";
import { isTodaySgt, recentSgtStamp, parseSgtStamp } from "@/lib/time";
import { effectiveCodeStatus, generateRegistrationCode, type RosterEntry } from "@/lib/staffRoster";
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

/**
 * "error" is not a worse "offline".
 *
 * Offline is silence — the stream stopped and the camera says nothing. Error is an answer: the
 * device is reachable and refused, which in practice means credentials, a codec the server cannot
 * open, or a URL pointing at the wrong stream. The errands are different (go and look at it vs fix
 * what we typed), so the state is different, and the app treats anything that is not "online" as
 * not live, which is correct for both.
 */
export type CameraStatus = "online" | "offline" | "error";

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
  /**
   * Who to ask about the contract — the supplier's account manager for this customer.
   *
   * On the team rather than the project because one manager holds every project a customer has,
   * and it is the License page's answer to the question every other product answers with a
   * "Change plan" button: this licence is a contract, so the way to change it is a person.
   *
   * HANDOFF NOTE: seeded. The real value comes from whatever the supplier's own records are, not
   * from anything the customer can edit here.
   */
  accountManager?: { name: string; email: string };
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
  /**
   * The zone this project's days and hours are counted in, e.g. "Asia/Singapore".
   *
   * A timezone belongs to a project, not to an account: a site sits in one country and its "today"
   * is that country's, whoever is looking. Set from Portal (My page's project card for now — see
   * the note there about where it should eventually live).
   *
   * Optional, and lib/time.ts still falls back to Singapore when it is absent — every seeded
   * project predates the field, and a missing timezone must not become "UTC" by accident.
   */
  timeZone?: string;
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
/**
 * The AI engines a camera can be assigned.
 *
 * Intrusion Detection was a third member until 2026-09-04 and is gone. It was a label with
 * nothing behind it: the form offered it, CameraStreamModal gave it a colour, and that was the
 * whole feature — EventType is "VIP" | "Tracking", so no intrusion event exists in the system, no
 * screen shows one, and no code read the tag. A checkbox that changes nothing is worse than a
 * missing one, because somebody ticks it and believes the site is watched for intruders.
 */
export type CameraAiFeature = "Re-ID Analysis" | "License Plate Recognition";

export interface Camera {
  id: string;
  projectId: string;
  code: string;
  name: string;
  ip: string;
  mac: string;
  rtspUrl: string;
  status: CameraStatus;
  /**
   * When this camera last reported in. Seeded here, owned by the backend once camera polling lands
   * (confirmed as planned) — it is the figure the Overview's camera table reads as "8 min ago",
   * and the one that tells an operator whether an offline camera just dropped or has been dark
   * since yesterday. Optional: a camera added through Portal has not reported yet.
   */
  lastSeenAt?: string;
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
  model?: string;
  resolution?: string;
  /** Account the stream authenticates with. The password that goes with it is deliberately NOT
   *  here — see the Add Camera form's note. */
  username?: string;
  /** Which of the project's servers processes this camera. Optional: a camera can be registered
   *  before anyone has decided where it runs. */
  serverId?: string;
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
  /**
   * The enrolled face, or absent.
   *
   * Optional because one path produces people without one: a CSV import carries names, not faces.
   * Those rows are on the watchlist and cannot be matched by anything, which is a state the
   * registry has to be able to represent — the import used to paper over it by handing every row
   * a stock portrait, and a screen cannot warn about a problem the data denies having.
   */
  photoUrl?: string;
  /**
   * When this face was enrolled.
   *
   * Either a plain date ("2026-08-30") or a full ISO instant — new registrations record the
   * instant, the seeded rows predate that and only ever had a date. Readers that want the day
   * take the first ten characters; the detail sheet shows a time only when there is one to show,
   * because a time nobody recorded is not a time to display.
   *
   * HANDOFF NOTE: which zone a recorded instant is read back in is the project-level timezone
   * setting that is not wired yet — the detail sheet currently formats in the viewer's zone.
   */
  registeredAt: string;
  description?: string;
  // Which project registered this person — set on everything registered via Portal going
  // forward. Optional since the seed data below predates per-project scoping and stays
  // unscoped (visible everywhere) rather than being retroactively assigned to one project.
  projectId?: string;
  priorityLabel?: "normal" | "high" | "very_high";
  /**
   * The group this person belongs to, if any.
   *
   * One group at most, not a list: a group here is a party that arrives and is watched together (a
   * visiting delegation, an executive detail), and being in two of those at once is not a thing
   * that happens. Absent means an individual registration, which is the ordinary case — the VIP
   * registry's People tab is exactly the rows with none of these.
   */
  groupId?: string;
}

/**
 * A party registered together in the Face DB — a visiting delegation, an executive detail.
 *
 * It carries no member list of its own. Membership lives on Person.groupId, so a person can be
 * registered, moved between groups and removed without a second place having to agree about it, and
 * the count on a group row is derived rather than stored (a stored count is a number that goes
 * wrong the first time somebody deletes a person).
 */
export interface PersonGroup {
  id: string;
  name: string;
  description?: string;
  /** The group's default for its members — the same three levels a Person carries. */
  priorityLabel?: "normal" | "high" | "very_high";
  projectId?: string;
  registeredAt: string;
}


interface VcaStoreState {
  teams: Team[];
  projects: Project[];
  cameras: Camera[];
  persons: Person[];
  personGroups: PersonGroup[];
  events: VcaEvent[];
  uploads: UploadedMedia[];
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
  /**
   * Remove several cameras at once, and log it as one line rather than N. An audit log that records
   * "Camera X removed" twelve times in the same second buries the fact that this was one decision
   * about twelve cameras — which is the thing anyone reading the log later needs to know.
   */
  removeCameras: (cameraIds: string[]) => void;
  /** Register an uploaded recording/snapshot against a project. Returns its id. */
  addUpload: (upload: Omit<UploadedMedia, "id" | "uploadedAt" | "status">) => string;
  removeUpload: (uploadId: string) => void;
  /** Move several cameras into one zone. Same one-entry-per-action reasoning as removeCameras. */
  setCamerasZone: (cameraIds: string[], zone: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProjectLicense: (projectId: string, updates: Pick<Project, "licenseChannelLimit" | "licensePlan" | "licenseExpiresAt">) => void;
  updateProjectMail: (projectId: string, updates: Pick<Project, "mailDomain" | "smtp">) => void;
  setProjectTimeZone: (projectId: string, timeZone: string) => void;
  // null clears the override and falls back to the auto-detected value; true/false pins it.
  setNetworkIsolationOverride: (projectId: string, override: boolean | null) => void;
  updateTeamMail: (teamId: string, updates: Pick<Team, "mailDomain" | "smtp">) => void;
  addPerson: (person: Omit<Person, "id">) => void;
  removePerson: (personId: string) => void;
  /**
   * Edit a registered face — name, tag, priority, note, photo.
   *
   * There was no way to change any of it. A VIP could be registered and removed and nothing in
   * between, so a misspelled name or a priority that turned out to be wrong meant deleting the
   * enrolment and doing it again. `description` was worse than unchangeable: only the bulk CSV
   * import ever set it, so a note could exist on a row and never be written by hand.
   */
  updatePerson: (personId: string, updates: Partial<Omit<Person, "id">>) => void;
  addPersonGroup: (group: Omit<PersonGroup, "id">) => string;
  updatePersonGroup: (groupId: string, updates: Partial<Omit<PersonGroup, "id">>) => void;
  /**
   * Removes the group. `deleteMembers` decides what happens to the people in it — the two answers
   * are both legitimate (the grouping was a mistake / the delegation left), and neither is safe to
   * guess at, so the caller has to say. See the confirmation dialog in ProjectVipTab.
   */
  removePersonGroup: (groupId: string, options?: { deleteMembers?: boolean }) => void;
  setPersonGroup: (personId: string, groupId: string | undefined) => void;
  addEvent: (event: Omit<VcaEvent, "id">) => void;
  markNotificationsRead: () => void;
  addPortalUser: (user: Omit<PortalUser, "id">) => string;
  updatePortalUserPermission: (userId: string, permission: PortalPermission) => void;
  /** Portal role and app access together — the access select moves both, and one call is one audit
   *  line. Refuses a combination that leaves the account unable to reach anything. */
  updatePortalUserAccess: (userId: string, permission: PortalPermission, appAccess: boolean) => void;
  /** Grant or take away person-search in the app. Logged: who may search is worth an audit trail
   *  in a face-recognition installation, and so is the moment it changed. */
  setAppSearch: (userId: string, allowed: boolean) => void;
  /** Which project the monitoring app is watching. Empty until something picks one. */
  activeProjectId: string;
  setActiveProjectId: (projectId: string) => void;
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
  /** Issues (or replaces) this account's invite token and returns it, for the `/password-setup`
   *  link. Replacing invalidates the previous link — a resend is a reissue. */
  issueInviteToken: (userId: string) => string | null;
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
  /**
   * Add one person to a project's roster by hand. The roster is a convenience, not a gate: an
   * administrator sets someone up one at a time here, and the Excel import exists only for doing
   * many at once. Returns false when the employee number is already on the roster — that number is
   * the roster's matching key, so a duplicate would make a code resolve to two people.
   */
  addRosterEntry: (entry: Omit<RosterEntry, "status" | "code" | "issuedAt">) => boolean;
  /** Edit a roster row in place. The employee number is the key, so it is passed separately from
   *  the fields being changed and cannot itself be edited (remove and re-add instead). */
  updateRosterEntry: (employeeId: string, updates: Partial<Omit<RosterEntry, "employeeId" | "status" | "code" | "issuedAt">>) => void;
  issueRegistrationCodes: (employeeIds: string[]) => void;
  reissueRegistrationCode: (employeeId: string) => void;
  /** Someone finished /register with their roster code: burn the code and give them the account it
   *  was issued against. Returns the new user's id, or null if the code was not usable. */
  activateRosterEntry: (employeeId: string) => string | null;
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
    accountManager: { name: "Jihoon Park", email: "jihoon.park@univs.ai" },
  },
  // A second team, so the header's team switcher has somewhere to switch to and every screen that
  // scopes by team is exercised by more than one row. Deliberately unlike the first: a different
  // mail domain, no `smtp` at all (a site whose relay has not been configured yet — the state the
  // Server tab's mail settings exist to fix), and projects with no cameras registered, which is
  // what a team looks like the week it is onboarded.
  {
    id: "team-northgate", name: "Northgate Education Trust", region: "Singapore",
    accountManager: { name: "Mina Seo", email: "mina.seo@univs.ai" },
    mailDomain: "northgate.edu.sg",
  },
];

const PROJECTS: Project[] = [
  {
    id: "proj-sg", teamId: "team-univs", name: "Marina Bay & CBD Surveillance Network", type: "smart_city",
    timeZone: "Asia/Singapore",
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
  // team-northgate's projects. No cameras seeded against these ids on purpose — the camera fixtures
  // below are Singapore-CBD coordinates that the main app's map and Live Monitoring draw from, and
  // dropping a second city's worth of pins in there would change screens nobody asked to change.
  // Zero cameras is also just what a freshly provisioned project is.
  {
    id: "proj-northgate-main", teamId: "team-northgate", name: "Northgate Secondary — Main Campus", type: "smart_school",
    licensePlan: "Professional", licenseChannelLimit: 24, licenseExpiresAt: "2028-03-31",
    computeInstance: "vca.medium", gpuCount: 1, modelVersion: "model_v2_prod", lastMigration: "v2_alert_schema",
    lastBackupAt: auditAt(31 * 60),
    regionName: "Singapore", networkIsolatedDetected: true, regionFlag: "🇸🇬", regionCenterCount: 1, regionSubcenterCount: 0,
  },
  {
    id: "proj-northgate-junior", teamId: "team-northgate", name: "Northgate Junior College", type: "smart_school",
    // "Standard" until 2026-09-04, which is not a tier the licence page knows — PLAN_FEATURES has
    // Starter / Professional / Enterprise, so this project rendered with every feature locked and
    // nothing included. The tiers are the catalogue; the seed was the drift.
    licensePlan: "Starter", licenseChannelLimit: 12, licenseExpiresAt: "2027-12-31",
    computeInstance: "vca.small", gpuCount: 1, modelVersion: "model_v2_prod", lastMigration: "v2_alert_schema",
    lastBackupAt: auditAt(52 * 60),
    regionName: "Singapore", networkIsolatedDetected: false, regionFlag: "🇸🇬", regionCenterCount: 1, regionSubcenterCount: 0,
  },
];

/**
 * A recording or snapshot an administrator uploaded for after-the-fact review — not a camera.
 *
 * It is deliberately NOT a Camera: it has no IP, no RTSP URL, no zone, and it consumes no licensed
 * channel, so putting it in the cameras table would make every column on that table read "—" and
 * the channel count wrong. It gets its own Portal tab, and it surfaces in the app's Best Frame
 * page, whose sidebar already separates a "File" list from the live "Network" list.
 *
 * `id` is the join. Best Frame keys its per-feed data by camera id, so an upload's id has to be the
 * id Best Frame looks up — this is the same id-space that has already bitten us once, when Live
 * Monitoring's camera codes and Re-ID's mock ids turned out never to overlap. One list, in the
 * store, read by both sides.
 */
export type UploadKind = "video" | "image";
/**
 * Where the analysis got to. Nothing moves a new upload past "pending" today, because extracting
 * frames and matching faces is the core's work and there is no endpoint for it yet — see
 * addUpload's note. The seeded rows sit at "done" so the finished state is visible.
 */
export type UploadStatus = "pending" | "analyzing" | "done" | "failed";

export interface UploadedMedia {
  id: string;
  projectId: string;
  /** As given by the person who uploaded it — the only name they will recognise it by. */
  fileName: string;
  kind: UploadKind;
  /** Seconds. Undefined for an image, which has no duration. */
  durationSec?: number;
  sizeBytes?: number;
  /** As read off the file. Sits in the same table cell as a camera's stream address — both answer
   *  "how is this source identified", which is what stops that column being half empty. */
  resolution?: string;
  uploadedAt: string;
  uploadedBy: string;
  status: UploadStatus;
  /** Faces the analysis found. Undefined until it has run — 0 means it ran and found none, which
   *  is a different answer and has to look different on screen. */
  detectionCount?: number;
}

/**
 * Seeded from Best Frame's own hardcoded Video/Image lists (v1-v3, i1). They live here now so the
 * Portal tab that registers uploads and the Best Frame page that plays them read the same array —
 * Best Frame's ids ARE these ids, which is the whole reason this is in the store and not in either
 * screen. Their `status` is "done" because Best Frame already has detections keyed to them.
 */
const UPLOADS: UploadedMedia[] = [
  { id: "v1", projectId: "proj-sg", fileName: "marina_bay_0831_1420.mp4", kind: "video", durationSec: 902, sizeBytes: 418_000_000, resolution: "3840×2160", uploadedAt: auditAt(51 * 60), uploadedBy: "Grace Tan", status: "done", detectionCount: 14 },
  { id: "v2", projectId: "proj-sg", fileName: "cbd_northgate_0829.mp4", kind: "video", durationSec: 187, sizeBytes: 96_000_000, resolution: "2560×1440", uploadedAt: auditAt(74 * 60), uploadedBy: "Grace Tan", status: "done", detectionCount: 6 },
  { id: "v3", projectId: "proj-riverside", fileName: "campus_gate_0828.mp4", kind: "video", durationSec: 341, sizeBytes: 152_000_000, resolution: "1920×1080", uploadedAt: auditAt(96 * 60), uploadedBy: "Marcus Lee", status: "done", detectionCount: 9 },
  { id: "i1", projectId: "proj-sg", fileName: "west_gate_snapshot.jpg", kind: "image", sizeBytes: 2_400_000, resolution: "1920×1080", uploadedAt: auditAt(28 * 60), uploadedBy: "Grace Tan", status: "done", detectionCount: 2 },
];

// Portal-managed accounts — separate from `persons` (the VIP/watchlist registry). A PortalUser is
// someone who can log into this same app; `permission` decides whether they land in the Portal
// back-office shell or straight into the Smart City/School app (see PortalShell/ClientLayout),
// and `projectIds` scopes which project(s) an operator can see once inside the app.
/**
 * What an account can do in the PORTAL — this is a console role, not a product role.
 *
 * The distinction matters because one field used to answer two different questions at once
 * ("can this person open Portal?" and "what may they do in the monitoring app?"), which is why
 * splitting "operator" into manager/viewer never made sense: operator was never a console role,
 * it meant "no console".
 *
 * Console consoles model this as one ladder plus a read-only twin (Cloudflare's Domain
 * Administrator / Domain Administrator Read Only, Vanta's Admin / View-only Admin / Auditor), and
 * scope it by resource rather than inventing more roles — we scope with projectIds.
 *
 * - owner    최고관리자. The only role that can grant or revoke permissions, and the only one that
 *            can remove people. Kept to a named few; the app refuses to leave fewer than one.
 * - admin    관리자. Changes the installation's settings — cameras, VIP registry, roster, license —
 *            but cannot change who has access.
 * - auditor  읽기 전용 관리자. Sees every Portal screen and the audit log, changes nothing. For
 *            handover, inspection, and the customer's security officer.
 * - none     No console access at all.
 *
 * The fourth value used to be called "operator", which read as a console role and was not one — it
 * meant "no console, app instead", so it answered a question this field no longer owns. Whether a
 * person may use the monitoring app is now `appAccess`, an independent flag, because the two are
 * genuinely independent: an administrator who never opens the app, and an app user who is also
 * allowed to look at Portal, are both real and neither could be expressed while one field carried
 * both answers. "none" says only what it says.
 *
 * HANDOFF NOTE: the frontend only decides what to show and what to disable. Every mutating
 * endpoint has to check the caller's role again — see the auth-flow doc, section 07.
 */
export type PortalPermission = "owner" | "admin" | "auditor" | "none";

/** Roles that may open Portal at all. `none` is routed to the app by login. */
export const PORTAL_CONSOLE_ROLES: PortalPermission[] = ["owner", "admin", "auditor"];

/** May change settings (cameras, VIP, roster, license, server). Auditor may not. */
export function canEditPortal(permission: PortalPermission): boolean {
  return permission === "owner" || permission === "admin";
}

/**
 * May grant/revoke access — invite, change a permission, reset a password, suspend, remove.
 * Deliberately narrower than canEditPortal: role granting is the one power that creates more of
 * itself, so it stays with the owner (see the permission-model doc).
 */
export function canManageAccess(permission: PortalPermission): boolean {
  return permission === "owner";
}

/** May open Portal (any console role). */
export function canEnterPortal(permission: PortalPermission): boolean {
  return PORTAL_CONSOLE_ROLES.includes(permission);
}

/**
 * May sign into the monitoring app.
 *
 * Takes the user rather than a permission because it is no longer derivable from the role — that
 * is the entire point of the split.
 */
export function canEnterApp(user: Pick<PortalUser, "appAccess">): boolean {
  return user.appAccess;
}

/**
 * An account has to be able to get in somewhere. Neither flag set is not a restricted account, it
 * is an account nobody can use and nothing on any screen explains — so the two places that can
 * produce that combination (the access select, the invite form) refuse it, and so does the store.
 */
export function hasSomeAccess(permission: PortalPermission, appAccess: boolean): boolean {
  return canEnterPortal(permission) || appAccess;
}

/**
 * The projects the app may show the person using it — their own, and only their own.
 *
 * An account belongs to one team and is scoped to projects inside it (the invite modal only offers
 * that team's projects), so this never crosses a team boundary. Another team's cameras appearing on
 * this wall would be an incident, not a feature.
 *
 * HANDOFF NOTE: same stand-in as the other two — with no session, an address that matches no
 * account falls back to every project so the demo still has something to switch between.
 */
export function projectsVisibleInApp(users: PortalUser[], projects: Project[]): Project[] {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (!me) return projects;
  return projects.filter(p => me.projectIds.includes(p.id));
}

/**
 * Whether the person using the monitoring app may run person searches.
 *
 * HANDOFF NOTE: same stand-in as currentPortalRole — there is no session, so this resolves
 * SIGNED_IN_USER's address against the account list. When the address matches nobody (the default
 * demo identity does not), it answers true so the app stays fully explorable; a real build reads
 * the flag off the session and defaults to denied. Replace the body, not the call sites.
 */
export function canSearchInApp(users: PortalUser[]): boolean {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  return me ? me.appSearch === true : true;
}

/**
 * The role Portal should treat the current visitor as.
 *
 * HANDOFF NOTE: this is the one thing a session would answer for free. With no login response to
 * read, it resolves SIGNED_IN_USER's address against the account list and falls back to the first
 * owner — so the mock behaves like the person who would normally be sitting here. Replace the whole
 * body with the role from the session; the call sites do not change.
 */
/**
 * The signed-in account, when the stand-in identity matches one. Undefined means there is no
 * session to reason about (the demo default), and callers must fail OPEN on that — a gate keyed on
 * "we could not identify you" would lock the demo out of its own console.
 */
export function currentPortalUser(users: PortalUser[]): PortalUser | undefined {
  return users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
}

export function currentPortalRole(users: PortalUser[]): PortalPermission {
  const byEmail = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (byEmail) return byEmail.permission;
  const owner = users.find(u => u.permission === "owner" && u.status === "active");
  return owner ? owner.permission : "admin";
}
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

/**
 * Who to call when the software misbehaves — the supplier's own desk.
 *
 * Deliberately NOT Team.accountManager, which is a different person answering a different
 * question: the account manager holds the contract (channels, term, renewal) and support holds the
 * product (a camera that will not connect, a model that stopped matching). Portal now names both,
 * and naming them separately is the point — an administrator with an offline camera should not be
 * emailing the person who sells them channels.
 *
 * A single constant rather than per-team data: the desk is the supplier's and is the same for every
 * customer. If a site ever gets a dedicated engineer, that belongs on Team beside accountManager.
 *
 * HANDOFF NOTE: seeded. Real values come from whatever the support organisation publishes.
 */
export const SUPPORT_CONTACT = {
  email: "support@univs.ai",
  phone: "+65 6812 4400",
  /** Local time at the site, which is the only clock the person reading this has. */
  hours: { en: "Mon–Fri, 09:00–18:00 (SGT)", ko: "월–금 09:00–18:00 (SGT)" },
} as const;

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
  /**
   * May run person searches in the monitoring app (Data's search screens and Redmap).
   *
   * Kept apart from `permission`, which is a console role: a person can be app-only and still be
   * the one who runs searches, and a Portal admin may have no business searching at all. It is one
   * flag rather than an app role ladder because search is the only weighted action the app actually
   * has — no export, no VIP editing, no camera control lives there (checked 2026-09-04). When more
   * of those arrive, this is the seam to widen.
   *
   * Undefined means not granted. Reconstructing where a person went is the app's most invasive
   * capability, so it is given deliberately, not inherited.
   */
  appSearch?: boolean;
  /**
   * May sign into the monitoring app.
   *
   * Required, not optional: this is one of the two answers to "where can this person go", and an
   * undefined that quietly means false would hand out accounts that can reach nothing. Every
   * construction site has to say it out loud.
   */
  appAccess: boolean;
  status: PortalUserStatus;
  /**
   * Last sign-in, for the Users & Permissions table.
   *
   * A second field used to sit here recording whether the account had MFA, with a column reading
   * it. Nothing in the product could set it: there is no second factor anywhere in the sign-in
   * flow, no enrolment screen, and no code that decided anything from the value — it was a tick
   * mark whose only source was the seed data, telling an administrator their people were protected
   * by something that does not exist. Removed 2026-09-04 along with the column. When MFA is
   * actually built (see the deferral note: phones on site, NTP drift, resetting a lost factor), it
   * comes back with a real source behind it.
   */
  lastLoginAt?: string;
  /**
   * The employee number this person signs in with, where the deployment allows it
   * (authConfig.employeeIdLogin). It lives on the ACCOUNT, not only on the roster row: the roster
   * is a pre-registration name list that rows get deleted from, and resolving a login through it
   * would mean a tidied-up roster silently removes people's ability to sign in.
   *
   * Optional because an account can predate the roster (the first administrator) or come from an
   * invitation by mail, where nobody asked for a number.
   */
  employeeId?: string;
  /**
   * The invite link's token — `/password-setup?token=<this>`. Opaque and single-use: it used to be
   * the account's own id, which is short, guessable and printed all over the Portal UI, so anyone
   * who saw a user id could set that person's password. Cleared once the invite is completed.
   */
  inviteToken?: string;
  /** When the invite token was issued, ISO — an invite that was never accepted has to stop working
   *  on its own. See INVITE_TOKEN_TTL_DAYS. */
  inviteTokenIssuedAt?: string;
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
  { id: "user-1", name: "Grace Tan", email: "grace.tan@univs.ai", employeeId: "EMP-2041", teamId: "team-univs", projectIds: ["proj-sg", "proj-riverside"], permission: "owner", appAccess: true, status: "active", lastLoginAt: "2026-08-25 09:14" },
  { id: "user-2", name: "Marcus Lee", email: "marcus.lee@univs.ai", employeeId: "EMP-2042", teamId: "team-univs", projectIds: ["proj-sg"], permission: "none", appAccess: true, appSearch: true, status: "active", lastLoginAt: "2026-08-24 18:02" },
  // Admin who also works the app — the combination the single-field model could not hold.
  { id: "user-3", name: "Nadia Rahman", email: "nadia.rahman@univs.ai", employeeId: "EMP-2043", teamId: "team-univs", projectIds: ["proj-riverside"], permission: "admin", appAccess: true, status: "active", lastLoginAt: "2026-08-20 11:47" },
  { id: "user-4", name: "Wei Chen", email: "wei.chen@univs.ai", employeeId: "EMP-2044", teamId: "team-univs", projectIds: ["proj-sg"], permission: "none", appAccess: true, status: "invited" },
  { id: "user-5", name: "David Ong", email: "david.ong@univs.ai", employeeId: "EMP-2045", teamId: "team-univs", projectIds: ["proj-sg"], permission: "none", appAccess: true, status: "suspended", lastLoginAt: "2026-06-02 08:30" },
  // The customer's security officer: reads Portal for the audit trail, has no business in the
  // monitoring app. The other new combination.
  { id: "user-6", name: "Aaron Sim", email: "aaron.sim@univs.ai", employeeId: "EMP-2046", teamId: "team-univs", projectIds: ["proj-sg"], permission: "auditor", appAccess: false, status: "active", lastLoginAt: "2026-08-22 16:05" },
];

// Empty on purpose. Three sample requests used to sit here, and no path in the app could produce
// one: /request-access is unreachable (nothing routes to it — see its own note), and the flow is
// switched off for on-premise deployment anyway (authConfig's accessRequest). Seeded rows that
// cannot occur teach whoever reads the screen that the queue means something it does not.
const ACCESS_REQUESTS: AccessRequest[] = [];

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
  // Issued long enough ago that REGISTRATION_CODE_TTL_DAYS has passed: the row still says
  // "unused", and effectiveCodeStatus() is what turns it into "expired". Stored-as-expired is not
  // used in the seeds any more — it could never demonstrate that expiry actually works.
  { employeeId: "EMP-3007", name: "Marcus Ho", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "unused", code: "VXYZ2345", issuedAt: "2026-07-15T09:00:00+08:00" },
  { employeeId: "EMP-3008", name: "Aisha Bakar", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", code: "JKMN6789" },
  { employeeId: "EMP-3009", name: "Ryan Tavares", department: "Field Engineering", projectId: "proj-sg", permission: "admin", status: "not-issued" },
  { employeeId: "EMP-3010", name: "Sana Idris", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "used", code: "CDFG3456" },
  { employeeId: "EMP-3011", name: "Emily Foster", department: "Operations", projectId: "proj-riverside", permission: "admin", status: "not-issued" },
  { employeeId: "EMP-3012", name: "Kevin Ng", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "LMPQ8765" },
  { employeeId: "EMP-3013", name: "Hana Suzuki", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "not-issued" },
  { employeeId: "EMP-3014", name: "Oliver Grant", department: "Operations", projectId: "proj-riverside", permission: "operator", status: "used", code: "RSTU4325" },
  { employeeId: "EMP-3015", name: "Mei Lin Tan", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "WXYZ9876" },
  { employeeId: "EMP-3016", name: "Diego Alvarez", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "unused", code: "ABCD5432", issuedAt: "2026-07-02T09:00:00+08:00" },
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

const CAMERA_SEEDS: Camera[] = [
  {
    id: "cam-novena", projectId: "proj-sg", code: "CAM-NOV-001", name: "Novena",
    ip: "10.20.4.11", mac: "00:1B:44:11:3A:B7", rtspUrl: "rtsp://10.20.4.11:554/stream1",
    status: "online", location: "Novena, Singapore", zone: "Novena",
    // Engines and a server on a handful of the named cameras, not on all sixty.
    //
    // aiFeatures existed only as a type: nothing seeded it, so every camera read "—", the AI
    // Engines column was an empty column, the preview's overlay boxes never drew and the Input
    // Sources summary counted the entire fleet as "no AI engine" — a figure that is technically
    // true and tells you nothing. A real deployment has engines on the cameras that matter and
    // nothing on the rest, so that is what this seeds: four of the eight named cameras run Re-ID,
    // one of them also reads plates, and each carries the server that does the work.
    aiFeatures: ["Re-ID Analysis"], serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3202, lng: 103.8440, maker: "Hanwha", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-geylang", projectId: "proj-sg", code: "CAM-GEY-001", name: "Geylang NC1",
    ip: "10.20.4.12", mac: "00:1B:44:11:3A:B8", rtspUrl: "rtsp://10.20.4.12:554/stream1",
    status: "online", location: "Geylang NC1, Singapore", zone: "Geylang",
    aiFeatures: ["Re-ID Analysis", "License Plate Recognition"], serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3148, lng: 103.8778, maker: "Hikvision", resolution: "FHD (1920×1080)",
  },
  {
    id: "cam-orchard", projectId: "proj-sg", code: "CAM-ORC-001", name: "Orchard MRT",
    ip: "10.20.4.13", mac: "00:1B:44:11:3A:B9", rtspUrl: "rtsp://10.20.4.13:554/stream1",
    status: "online", location: "Orchard MRT, Singapore", zone: "Orchard",
    aiFeatures: ["Re-ID Analysis"], serverId: "srv-2",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.3044, lng: 103.8321, maker: "Dahua", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-bugis", projectId: "proj-sg", code: "CAM-BGS-001", name: "Bugis MRT",
    ip: "10.20.4.14", mac: "00:1B:44:11:3A:BA", rtspUrl: "rtsp://10.20.4.14:554/stream1",
    status: "online", location: "Bugis MRT, Singapore", zone: "Bugis",
    aiFeatures: ["License Plate Recognition"], serverId: "srv-2",
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
  // Reachable and refusing — see the CameraStatus note. Seeded because the state has to be visible
  // somewhere for the table, the filter and the attention strip to be worth building.
  {
    id: "cam-phone-test", projectId: "proj-sg", code: "CAM-TMP-901", name: "Phone test",
    ip: "192.168.0.36", mac: "00:1B:44:11:3A:C1", rtspUrl: "rtsp://192.168.0.36:554/stream1",
    status: "error", location: "Control Room, Singapore", zone: "Marina Bay",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.2830, lng: 103.8600, maker: "Hanwha", resolution: "FHD (1920×1080)",
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
 * Last-signal times, seeded onto the cameras above rather than typed into all 59 of them.
 *
 * Online cameras reported within the last few minutes; offline ones stopped somewhere between a
 * quarter of an hour and half a day ago, which is what makes the column worth reading — a camera
 * dark for eleven hours is a different errand from one that dropped during this shift.
 *
 * Deterministic per camera (the index, not a random), and expressed through auditAt like every
 * other relative timestamp in this file: the value is fixed at module load, so a screen must only
 * render it after mount — which is what the Overview's nowMs gate already does for the audit log.
 */
const CAMERAS: Camera[] = CAMERA_SEEDS.map((c, i) => ({
  ...c,
  lastSeenAt: auditAt(c.status === "online" ? 1 + (i % 5) : 14 + (i * 37) % 700),
}));

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
    // Two of these sit in a group and two do not, so the registry's People tab (individuals only)
    // and its Groups tab both have rows without either being empty.
    //
    // Full instants with an explicit +08:00, not bare days: the Overview panel shows the hour a
    // person was registered, and a date-only string has no hour to show. The offset is written out
    // so the value means one moment regardless of where it is read — the app is Singapore-only
    // (see lib/time.ts) and every reader formats it back through that zone.
    { id: "person-portal-1", name: "Michael Tan", type: "VIP", photoUrl: getFacePhoto("person-portal-1"), registeredAt: "2026-09-01T14:32:00+08:00", projectId: "proj-sg", priorityLabel: "high", groupId: "pgroup-1" },
    { id: "person-portal-2", name: "Sarah Lim", type: "VIP", photoUrl: getFacePhoto("person-portal-2"), registeredAt: "2026-08-30T09:05:00+08:00", projectId: "proj-sg", priorityLabel: "normal", groupId: "pgroup-1" },
    { id: "person-portal-3", name: "David Ho", type: "VIP", photoUrl: getFacePhoto("person-portal-3"), registeredAt: "2026-08-28T17:48:00+08:00", projectId: "proj-sg", priorityLabel: "very_high", groupId: "pgroup-2" },
    { id: "person-portal-4", name: "Rachel Wong", type: "VIP", photoUrl: getFacePhoto("person-portal-4"), registeredAt: "2026-08-25T11:20:00+08:00", projectId: "proj-sg", priorityLabel: "normal" },
  );
  persons.push(...bulkSampleVips());
  return persons;
})();

/**
 * A hundred more registrations for proj-sg, so the registry is the size a real one is.
 *
 * Four hand-written rows told you the screen worked; they told you nothing about what it is like to
 * find one person among a hundred, which is the actual job — the search box, the group filter, the
 * sort and the grid/table switch all only start to matter past a screenful.
 *
 * Generated rather than typed out, and generated DETERMINISTICALLY: no Math.random anywhere, or the
 * server and the client would render different names on first paint and React would tear the tree
 * down. Every field is a function of the index, so the hundredth row is the same row on every
 * machine and in every reload.
 *
 * Names are grouped in ethnically coherent blocks (a Malay given name does not get a Chinese
 * surname) because Singapore's registry would read that way and a list of implausible names is the
 * kind of detail that makes a demo feel fake.
 */
function bulkSampleVips(): Person[] {
  /**
   * Blocks of 25. Three pair a given name with a surname by index; the Malay block is written out
   * in full, because "bin" and "binte" are the father's-name markers for a son and a daughter and
   * pairing them by modulo produced "Nur Aisyah bin Hassan" — a name no registry would hold.
   */
  const blocks: { given: string[]; family: string[]; gender: string }[] = [
    {
      given: ["Wei Ming", "Jia Hui", "Zhi Hao", "Xin Yi", "Kai Jie", "Mei Ling", "Jun Kai", "Hui Ying", "Cheng En", "Shu Fen",
              "Yong Sheng", "Li Wen", "Ze Yang", "Pei Shan", "Guo Wei", "Yan Ting", "Wen Jie", "Si Ying", "Hao Ran", "Xiu Mei",
              "Jing Yi", "Tian Hui", "Bo Wen", "Yu Xuan", "Qi Feng"],
      family: ["Tan", "Lim", "Ng", "Goh", "Chua"],
      gender: "mfmfmfmfmfmfmfmfmfmfffmfm",
    },
    {
      given: ["Nur Aisyah binte Omar", "Muhammad Rizal bin Hassan", "Siti Nadia binte Salleh", "Ahmad Faiz bin Ismail", "Nurul Huda binte Yusof",
              "Hafiz bin Rahman", "Zulaikha binte Karim", "Iskandar bin Mahmud", "Farhana binte Osman", "Ridzuan bin Latif",
              "Syafiqah binte Aziz", "Aidil bin Sulaiman", "Khairul bin Anuar", "Nabilah binte Jamal", "Shahrul bin Bakar",
              "Anisah binte Halim", "Fandi bin Yaacob", "Rohana binte Zainal", "Azman bin Roslan", "Suriani binte Kadir",
              "Danial bin Firdaus", "Maslinda binte Noor", "Hakim bin Zulkifli", "Julia binte Rahim", "Rusdi bin Samad"],
      family: [""],
      gender: "fmfmfmfmfmfmmfmfmfmfmfmfm",
    },
    {
      given: ["Priya", "Arjun", "Deepa", "Ravi", "Kavitha", "Suresh", "Meena", "Vikram", "Lakshmi", "Ganesh",
              "Anitha", "Prakash", "Shanti", "Mohan", "Divya", "Rajesh", "Sunita", "Karthik", "Vasanthi", "Naveen",
              "Malini", "Dinesh", "Padma", "Sanjay", "Revathi"],
      family: ["Raman", "Nair", "Pillai", "Menon", "Krishnan"],
      gender: "fmfmfmfmfmfmfmfmfmfmfmfmf",
    },
    {
      given: ["James", "Emma", "Daniel", "Sophie", "Marcus", "Claire", "Andrew", "Hannah", "Peter", "Laura",
              "Nathan", "Grace", "Oliver", "Chloe", "Simon", "Elise", "Thomas", "Naomi", "Julian", "Beatrice",
              "Adrian", "Fiona", "Lucas", "Miriam", "Victor"],
      family: ["Carter", "Whitfield", "Novak", "Rossi", "Andersen"],
      gender: "mfmfmfmfmfmfmfmfmfmfmfmfm",
    },
  ];
  // Mostly normal. A watchlist where a third of the entries are the top level has no top level.
  const priorities: Person["priorityLabel"][] = [
    "normal", "normal", "normal", "normal", "normal", "normal", "high", "normal", "normal", "very_high",
  ];
  // Two thirds unattached: the People tab is individuals only, so it needs the larger share, and a
  // group of forty is not a party anybody escorts.
  const groups = [undefined, undefined, undefined, undefined, "pgroup-1", undefined, "pgroup-2", undefined, "pgroup-3", "pgroup-4"];
  // One line at most, and only on some — a note on every card would make the grid a wall of text.
  const notes = [undefined, undefined, undefined, "Escorted at all times.", undefined, undefined, "Media-facing; avoid public alerts.", undefined];

  /**
   * A face each.
   *
   * getFacePhoto() hashes an id into FACE_PHOTOS, which holds six pictures — so a hundred people
   * wore six faces, seventeen of them each, and a watchlist whose whole job is telling faces apart
   * showed the same one under seventeen different names.
   *
   * A stable portrait set indexed per person instead, and taken from the set that matches the
   * name's gender so a row does not read as obviously the wrong person. Two counters, so no index
   * is issued twice.
   *
   * Remote URLs, like the FACE_PHOTOS above them: the seed has always fetched its faces, and on an
   * internet-isolated site both fail the same way. Real enrolments carry an uploaded image.
   */
  let menUsed = 0;
  let womenUsed = 0;
  const out: Person[] = [];
  for (let i = 0; i < 100; i++) {
    const block = blocks[Math.floor(i / 25)];
    const given = block.given[i % 25];
    const family = block.family[i % block.family.length];
    const id = `person-seed-${i + 1}`;
    const set = block.gender[i % 25] === "f" ? "women" : "men";
    const portrait = `https://randomuser.me/api/portraits/${set}/${set === "women" ? womenUsed++ : menUsed++}.jpg`;
    // Spread back from 2026-08-24, a couple of registrations most days — which is what makes the
    // "registered today" figure and the date sort mean anything.
    const day = new Date(Date.UTC(2026, 7, 24) - Math.floor(i / 2) * 86_400_000);
    out.push({
      id,
      name: family ? `${given} ${family}` : given,
      type: "VIP",
      photoUrl: portrait,
      registeredAt: day.toISOString().slice(0, 10),
      projectId: "proj-sg",
      priorityLabel: priorities[i % priorities.length],
      groupId: groups[i % groups.length],
      description: notes[i % notes.length],
    });
  }
  return out;
}

let cameraSeq = CAMERAS.length;
let uploadSeq = UPLOADS.length;
let projectSeq = PROJECTS.length;
/**
 * Seeded parties. Members are attached below by groupId rather than listed here — see PersonGroup.
 */
const PERSON_GROUPS: PersonGroup[] = [
  { id: "pgroup-1", name: "City Hall delegation", description: "Quarterly inspection visit", priorityLabel: "high", projectId: "proj-sg", registeredAt: "2026-08-30" },
  { id: "pgroup-2", name: "Executive detail", description: "Standing protection list", priorityLabel: "very_high", projectId: "proj-sg", registeredAt: "2026-08-21" },
  // Two more so the Groups tab has enough rows for its own sort and counts to be worth reading —
  // the bulk registrations below distribute across all four.
  { id: "pgroup-3", name: "Contractor access", description: "Site works, gate 3", priorityLabel: "normal", projectId: "proj-sg", registeredAt: "2026-08-12" },
  { id: "pgroup-4", name: "Press pool", description: "Accredited for the summit week", priorityLabel: "normal", projectId: "proj-sg", registeredAt: "2026-08-05" },
];

let personSeq = PERSONS.length;
let personGroupSeq = PERSON_GROUPS.length;
let eventSeq = SEED_EVENTS.length;
let portalUserSeq = PORTAL_USERS.length;
let orgSeq = TEAMS.length;
let serverSeq = SERVERS.length;
let accessRequestSeq = ACCESS_REQUESTS.length;

function auditAt(minutesAgo: number): string {
  const { date, time } = recentSgtStamp(minutesAgo);
  return parseSgtStamp(date, time).toISOString();
}

/**
 * Seven days of activity per project, and which cameras were unreliable during them.
 *
 * THIS IS A REQUEST TO THE BACKEND, WRITTEN AS DATA. Portal has no time axis today — every figure
 * on the Overview answers "how many are there right now", which is a question an administrator
 * asks once a month, not a reason to open the console daily. The two shapes below are what would
 * change that, and they are drawn here so the aggregation the server needs to expose is a concrete
 * thing rather than a sentence in a meeting:
 *
 *   GET /projects/:id/detections?days=14  → [{ daysAgo, total, vip, vehicle, unknown }]
 *     (fourteen, because the Overview states a week's total against the week before it)
 *   GET /projects/:id/camera-stability?days=7 → [{ cameraId, drops }]
 *
 * Counted per Singapore calendar day (lib/time.ts owns that definition), newest last. `daysAgo` 0
 * is today-so-far, which is why it is normally the shortest bar.
 *
 * Deterministic, like every other seed in this file: a function of the index and the project id's
 * length, never Math.random, or the server and the browser would draw different bars on first
 * paint. See the note at the top of the file.
 */
export interface DailyDetections {
  daysAgo: number;
  total: number;
  vip: number;
  vehicle: number;
  unknown: number;
}

export function dailyDetections(projectId: string, days = 7): DailyDetections[] {
  const base = 900 + projectId.length * 37;
  return Array.from({ length: days }, (_, i) => {
    const daysAgo = days - 1 - i;
    // Seeded off daysAgo, not the array index, so asking for fourteen days and asking for
    // seven return the same numbers for the days they share — a total and the period it is
    // compared against have to come from one series or the comparison is with a different week.
    const swing = seededRandom(daysAgo * 3.7 + projectId.length) * 0.7 + 0.65;
    // Today is partial — the day is not over, so its bar counts only the hours that have happened.
    const dayFactor = daysAgo === 0 ? 0.55 : 1;
    const total = Math.round(base * swing * dayFactor);
    const vip = Math.round(total * (0.014 + seededRandom(daysAgo * 5.1) * 0.01));
    const vehicle = Math.round(total * (0.08 + seededRandom(daysAgo * 6.3) * 0.04));
    return { daysAgo, total, vip, vehicle, unknown: total - vip - vehicle };
  });
}

/**
 * What is wrong with a project's watchlist, and how much of it is actually working.
 *
 * ANOTHER REQUEST TO THE BACKEND, WRITTEN AS DATA. Everything the VIP page can say today it says
 * about itself — how many rows, how many groups, which priorities. None of that answers the
 * question an administrator actually has, which is whether the list they built will catch anybody:
 *
 *   GET /projects/:id/registry-health → {
 *     missingPhoto: id[],      // registered with no face image at all — never matchable.
 *                              //   (the front end already knows these: photoUrl is absent)
 *     embeddingFailed: id[],   // has an image the model could not turn into features
 *     duplicates: [id, id][],  // the same face registered twice; alerts fire twice
 *     detectedLast7d: id[],    // seen by any camera in the window
 *   }
 *
 * The first three are defects with different causes and different fixes (upload a photo, replace a
 * bad photo, merge two rows), which is why they are three lists and not one number. The fourth is
 * not a defect: it is the reach of the list, and it is here because a watchlist nobody ever
 * matches is the quietest way this product fails.
 *
 * Seeded deterministically, like everything else in this file.
 */
export interface RegistryHealth {
  missingPhoto: string[];
  embeddingFailed: string[];
  duplicates: [string, string][];
  detectedLast7d: string[];
}

export function registryHealth(projectId: string, persons: Person[]): RegistryHealth {
  const rows = persons.filter(p => p.projectId === projectId);
  const missingPhoto: string[] = [];
  const embeddingFailed: string[] = [];
  const detectedLast7d: string[] = [];
  rows.forEach((p, i) => {
    // Not seeded: a person with no photoUrl has no enrolled face, full stop. The CSV import is
    // where they come from, and this reads the same field the table draws from — so the figure and
    // the rows behind it can never disagree.
    if (!p.photoUrl) { missingPhoto.push(p.id); return; }
    const roll = seededRandom(i * 4.77 + p.id.length);
    if (roll > 0.88) embeddingFailed.push(p.id);
    // Only rows with a usable face can have been seen. Letting an unmatchable person appear in
    // the detected list would make the two figures on the page contradict each other.
    else if (seededRandom(i * 6.31 + 1.5) > 0.9) detectedLast7d.push(p.id);
  });
  // Pairs, not a count: a duplicate is two rows, and the fix is choosing which one to keep.
  const duplicates: [string, string][] = [];
  for (let i = 0; i + 1 < rows.length && duplicates.length < 2; i += 1) {
    if (seededRandom(i * 8.19 + 3.3) > 0.96) duplicates.push([rows[i].id, rows[i + 1].id]);
  }
  return { missingPhoto, embeddingFailed, duplicates, detectedLast7d };
}

/**
 * Cameras that dropped their stream at least once in the last seven days, worst first, with the
 * drops spread over the days they happened on.
 *
 * `dropsByDay` is oldest-first (index 0 = six days ago, index 6 = today) so it lines up with the
 * detection series above and with the way the Overview draws its week. A camera that dropped four
 * times on one afternoon and one that dropped once a day for four days are the same number and a
 * different errand, which is the whole reason the per-day breakdown is asked for rather than the
 * total alone:
 *
 *   GET /projects/:id/camera-stability?days=7 → [{ cameraId, dropsByDay: number[7] }]
 */
export function unstableCameras(projectId: string, cameras: Camera[], limit = 4): { camera: Camera; drops: number; dropsByDay: number[] }[] {
  return cameras
    .filter(c => c.projectId === projectId)
    .map((c, i) => {
      const dropsByDay = Array.from({ length: 7 }, (_, day) =>
        seededRandom(i * 9.13 + day * 2.7 + c.code.length) > 0.78 ? 1 + Math.floor(seededRandom(i + day * 4.4) * 2) : 0
      );
      return { camera: c, dropsByDay, drops: dropsByDay.reduce((a, b) => a + b, 0) };
    })
    .filter(r => r.drops > 0)
    .sort((a, b) => b.drops - a.drops)
    // Four by default — a pointer at the worst offenders, not an inventory of them. Callers that
    // want the whole fleet's counts (the Overview annotates its camera rows with them) pass a
    // bigger limit rather than recomputing the seed themselves.
    .slice(0, limit);
}

const AUDIT_LOG: AuditEvent[] = [
  { id: "audit-1", projectId: "proj-sg", message: "Camera CAM-NOV-001 RTSP URL updated", actor: "Grace Tan", at: auditAt(20) },
  { id: "audit-2", projectId: "proj-sg", message: "VIP Wei Chen registered", actor: "Marcus Lee", at: auditAt(65) },
  { id: "audit-3", projectId: "proj-sg", message: "David Ong's account suspended", actor: "Grace Tan", at: auditAt(240) },
  { id: "audit-4", projectId: "proj-riverside", message: "Server campus-fr-1 connectivity checked", actor: "Nadia Rahman", at: auditAt(50) },
  // Enough history for the Overview's "all N entries" modal to be worth opening. Three lines on
  // the card and three lines behind it made the modal a longer way of reading the card; a real
  // console's log is weeks deep, and the point of the modal is that the card is a window onto
  // something bigger. Times fan out from an hour ago to nine days, in the order things actually
  // happen in a project: cameras get added and re-pointed, people get invited and promoted,
  // watchlists get edited, servers get restarted.
  { id: "audit-5", projectId: "proj-sg", message: "Camera CAM-BLK-019 added to zone August", actor: "Marcus Lee", at: auditAt(320) },
  { id: "audit-6", projectId: "proj-sg", message: "VIP group \"Executive Protection\" created", actor: "Grace Tan", at: auditAt(400) },
  { id: "audit-7", projectId: "proj-sg", message: "Aaron Sim invited as auditor", actor: "Grace Tan", at: auditAt(690) },
  { id: "audit-8", projectId: "proj-sg", message: "Face recognition enabled on 4 cameras in Bugis", actor: "Marcus Lee", at: auditAt(1080) },
  { id: "audit-9", projectId: "proj-sg", message: "Server FR 2 restarted after firmware update", actor: "Wei Chen", at: auditAt(1500) },
  { id: "audit-10", projectId: "proj-sg", message: "VIP Sarah Lim's priority raised to High", actor: "Grace Tan", at: auditAt(2160) },
  { id: "audit-11", projectId: "proj-sg", message: "Camera CAM-BDK-001 stream credentials rotated", actor: "Marcus Lee", at: auditAt(2880) },
  { id: "audit-12", projectId: "proj-sg", message: "Registration codes issued to 6 staff", actor: "Grace Tan", at: auditAt(3600) },
  { id: "audit-13", projectId: "proj-sg", message: "Retention period changed from 30 to 60 days", actor: "Grace Tan", at: auditAt(4320) },
  { id: "audit-14", projectId: "proj-sg", message: "Camera CAM-QTN-001 renamed to Queenstown", actor: "Wei Chen", at: auditAt(5760) },
  { id: "audit-15", projectId: "proj-sg", message: "Marcus Lee granted app access", actor: "Grace Tan", at: auditAt(7200) },
  { id: "audit-16", projectId: "proj-sg", message: "VIP watchlist exported to CSV", actor: "Aaron Sim", at: auditAt(8640) },
  { id: "audit-17", projectId: "proj-sg", message: "Mail server smtp.univs.ai verified", actor: "Wei Chen", at: auditAt(10080) },
  { id: "audit-18", projectId: "proj-sg", message: "Zone Angmokio created with 3 cameras", actor: "Marcus Lee", at: auditAt(11520) },
  { id: "audit-19", projectId: "proj-sg", message: "License renewed until 2029-03-31", actor: "Grace Tan", at: auditAt(12960) },
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
  uploads: UPLOADS,
  persons: PERSONS,
  personGroups: PERSON_GROUPS,
  events: SEED_EVENTS,
  portalUsers: PORTAL_USERS,
  servers: SERVERS,
  auditLog: AUDIT_LOG,
  accessRequests: ACCESS_REQUESTS,
  staffRoster: STAFF_ROSTER,
  // The app watches one project at a time. Empty here rather than guessed: the header resolves it
  // against the account's own projects on first render, and only that account's projects are ever
  // offered — a team's cameras have no business appearing on another team's wall.
  activeProjectId: "",
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
  removeCameras: (cameraIds) =>
    set(state => {
      const ids = new Set(cameraIds);
      const removed = state.cameras.filter(c => ids.has(c.id));
      if (removed.length === 0) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: removed[0].projectId,
        message: removed.length === 1
          ? `Camera ${removed[0].name} removed`
          : `${removed.length} cameras removed (${removed.map(c => c.code).join(", ")})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        cameras: state.cameras.filter(c => !ids.has(c.id)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  setCamerasZone: (cameraIds, zone) =>
    set(state => {
      const ids = new Set(cameraIds);
      const moved = state.cameras.filter(c => ids.has(c.id));
      if (moved.length === 0) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: moved[0].projectId,
        message: `${moved.length} camera${moved.length === 1 ? "" : "s"} moved to zone "${zone}"`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        cameras: state.cameras.map(c => (ids.has(c.id) ? { ...c, zone } : c)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  addUpload: (upload) => {
    const id = `upload-${++uploadSeq}`;
    // HANDOFF NOTE: status starts at "pending" and nothing moves it. Extracting frames and matching
    // faces is the core's work (media + analysis) and there is no endpoint for it yet, so faking a
    // progress bar that finishes would claim an analysis that never ran. The seeded rows show what
    // "done" looks like. When the endpoint lands, this call posts the file and the row follows
    // whatever the job reports.
    const entry: UploadedMedia = { ...upload, id, uploadedAt: new Date().toISOString(), status: "pending" };
    const auditEntry: AuditEvent = {
      id: `audit-${++auditSeq}`, projectId: upload.projectId,
      message: `${upload.kind === "image" ? "Image" : "Video"} uploaded — ${upload.fileName}`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    };
    set(state => ({
      uploads: [entry, ...state.uploads],
      auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
    }));
    return id;
  },
  removeUpload: (uploadId) =>
    set(state => {
      const upload = state.uploads.find(u => u.id === uploadId);
      if (!upload) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: upload.projectId,
        message: `Upload removed — ${upload.fileName}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        uploads: state.uploads.filter(u => u.id !== uploadId),
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
  setProjectTimeZone: (projectId, timeZone) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, timeZone } : p)),
      // Audited: which day a detection is filed under, when a report covers, and what "today"
      // means on every screen all move when this changes.
      auditLog: [
        { id: `audit-${Date.now()}`, projectId, message: `Project timezone set to ${timeZone}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() },
        ...state.auditLog,
      ],
    })),

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
  updatePerson: (personId, updates) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: person.projectId,
        message: `VIP updated: ${updates.name ?? person.name}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        persons: state.persons.map(p => (p.id === personId ? { ...p, ...updates } : p)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  addPersonGroup: (group) => {
    const id = `pgroup-${++personGroupSeq}`;
    set(state => ({
      personGroups: [...state.personGroups, { ...group, id }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: group.projectId, message: `VIP group created: ${group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
    }));
    return id;
  },
  updatePersonGroup: (groupId, updates) =>
    set(state => {
      const group = state.personGroups.find(g => g.id === groupId);
      if (!group) return {};
      return {
        personGroups: state.personGroups.map(g => (g.id === groupId ? { ...g, ...updates } : g)),
        auditLog: [{ id: `audit-${++auditSeq}`, projectId: group.projectId, message: `VIP group updated: ${updates.name ?? group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, 200),
      };
    }),
  removePersonGroup: (groupId, options) =>
    set(state => {
      const group = state.personGroups.find(g => g.id === groupId);
      const affected = state.persons.filter(p => p.groupId === groupId).length;
      const deleteMembers = options?.deleteMembers === true;
      return {
        personGroups: state.personGroups.filter(g => g.id !== groupId),
        // Two outcomes, both asked for explicitly. Keeping them is the cheap correction for a
        // grouping mistake — the faces stay enrolled and matched, only the party goes. Deleting
        // them is what a delegation leaving actually needs, and doing it one row at a time for
        // twenty-eight people is not a workflow.
        persons: deleteMembers
          ? state.persons.filter(p => p.groupId !== groupId)
          : state.persons.map(p => (p.groupId === groupId ? { ...p, groupId: undefined } : p)),
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: group?.projectId,
          message: `VIP group removed: ${group?.name ?? groupId}`
            + (affected === 0 ? "" : deleteMembers ? ` — ${affected} member(s) deleted with it` : ` — ${affected} member(s) kept as individuals`),
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, 200),
      };
    }),
  setPersonGroup: (personId, groupId) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const to = groupId ? state.personGroups.find(g => g.id === groupId)?.name ?? groupId : null;
      // Logged like every other group change. Who is in a watchlist party is the kind of thing an
      // inspection asks about later, and the three group actions beside this one already log.
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: person.projectId,
        message: to ? `${person.name} added to VIP group: ${to}` : `${person.name} removed from their VIP group`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        persons: state.persons.map(p => (p.id === personId ? { ...p, groupId } : p)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
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
      // Demoting the last owner locks the customer out just as surely as deleting them.
      if (!canManageAccess(permission) && isLastActiveAdmin(state.portalUsers, userId)) return state;
      const user = state.portalUsers.find(u => u.id === userId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: user?.projectIds[0], message: `${user?.name ?? userId}'s permission changed to ${permission}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, permission } : u)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  updatePortalUserAccess: (userId, permission, appAccess) =>
    set(state => {
      if (!hasSomeAccess(permission, appAccess)) return state;
      // Same last-owner guard as a plain role change: taking Portal away from the last owner locks
      // the customer out of their own installation exactly as removing them would.
      if (!canManageAccess(permission) && isLastActiveAdmin(state.portalUsers, userId)) return state;
      const user = state.portalUsers.find(u => u.id === userId);
      const where = canEnterPortal(permission)
        ? (appAccess ? "Portal and the app" : "Portal only")
        : "the app only";
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: user?.projectIds[0],
        message: `${user?.name ?? userId} may now use ${where} (role: ${permission})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, permission, appAccess } : u)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
  setAppSearch: (userId, allowed) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: user?.projectIds[0],
        message: `${allowed ? "Person search granted" : "Person search revoked"}: ${user?.name ?? userId}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, appSearch: allowed } : u)),
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
  issueInviteToken: (userId) => {
    const user = get().portalUsers.find(u => u.id === userId);
    if (!user) return null;
    // HANDOFF NOTE: mockup only. The real token is minted server-side, stored as a hash next to its
    // expiry, and single-use. What matters here is the shape the link takes, so /password-setup can
    // be written against an opaque token instead of the account id it used to carry.
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    set(state => ({
      portalUsers: state.portalUsers.map(u =>
        u.id === userId
          ? { ...u, inviteToken: token, inviteTokenIssuedAt: new Date().toISOString() }
          : u
      ),
    }));
    return token;
  },
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
        u.id === userId
          // The invite link dies with the code: both exist only to get this person to their first
          // password, and one of them having survived the other is how a used link keeps working.
          ? { ...u, setupCode: undefined, setupCodeIssuedAt: undefined, inviteToken: undefined, inviteTokenIssuedAt: undefined }
          : u
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
        // Someone who asked for access to a project is asking to use it, not to administer it.
        permission: "none",
        appAccess: true,
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
        return { ...r, code, issuedAt: new Date().toISOString(), status: "unused" as const };
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
        // A fresh issuedAt restarts the clock: the point of a reissue is that the person still has
        // not registered, so handing them a code that expires on the old one's schedule is no use.
        staffRoster: state.staffRoster.map(r => (r.employeeId === employeeId ? { ...r, code, issuedAt: new Date().toISOString(), status: "unused" as const } : r)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
  /**
   * The end of /register for a roster code. Until this existed the screen said "account created"
   * and created nothing: the code stayed usable, and the person had no account to log into.
   *
   * HANDOFF NOTE: the backend does all of this in one transaction, and it is the transaction that
   * matters — burning the code and creating the account have to succeed or fail together, or a
   * crash in between leaves either a live code with an account behind it or an account nobody can
   * reach. The password belongs in that same call; there is nowhere to put it here.
   */
  activateRosterEntry: (employeeId) => {
    const state = get();
    const entry = state.staffRoster.find(r => r.employeeId === employeeId);
    if (!entry || effectiveCodeStatus(entry) !== "unused") return null;
    const project = state.projects.find(p => p.id === entry.projectId);
    const id = `user-${++portalUserSeq}`;
    // The address is optional on a roster row — a site with no mail has none — and an account
    // without one is normal here: they sign in with the employee number.
    const user: PortalUser = {
      id, name: entry.name, email: entry.email ?? "", employeeId: entry.employeeId,
      teamId: project?.teamId ?? state.teams[0]?.id ?? "",
      projectIds: [entry.projectId],
      // The roster's own permission field is a two-value thing ("admin" | "operator") describing
      // what the person is being hired onto the system as, not a Portal console role. Its
      // "operator" is the app-only shape, which is now spelled as a role of none plus app access.
      //
      // Its "admin" becomes a full admin, NOT the auditor that PortalUsersPage's Access select
      // hands out when it first lets an account into Portal. That looks inconsistent and is not:
      // the select is widening someone's access as a side effect of a different question, so it
      // takes the least it can, whereas an administrator ticking "관리자" on a roster row has
      // answered exactly this question about exactly this person. Auditor here would also be
      // useless — admin is the only role among the two this path can reach that can actually do
      // anything in Portal, so a read-only "admin" would be an option that grants nothing, on the
      // one enrolment path an on-premise site with no mail actually has.
      permission: entry.permission === "admin" ? "admin" : "none",
      appAccess: true,
      status: "active",
    };
    const auditEntry: AuditEvent = {
      id: `audit-${++auditSeq}`, projectId: entry.projectId,
      message: `Account activated with a registration code: ${entry.name} (${entry.employeeId}) — code used`,
      actor: entry.name, at: new Date().toISOString(),
    };
    set(s2 => ({
      portalUsers: [...s2.portalUsers, user],
      staffRoster: s2.staffRoster.map(r => (r.employeeId === employeeId ? { ...r, status: "used" as const } : r)),
      auditLog: [auditEntry, ...s2.auditLog].slice(0, 200),
    }));
    return id;
  },
  // Deleting the row is what kills an unused code (a departing employee's paper code must not stay
  // a working key into the system) — there is no separate "revoke code" action because a roster row
  // with no person behind it has nothing left to protect.
  addRosterEntry: (entry) => {
    const exists = get().staffRoster.some(r => r.employeeId.toLowerCase() === entry.employeeId.toLowerCase());
    if (exists) return false;
    const auditEntry: AuditEvent = {
      id: `audit-${++auditSeq}`, projectId: entry.projectId,
      message: `Roster entry added: ${entry.name} (${entry.employeeId})`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    };
    // status "not-issued": on the roster, no code yet. Issuing is a separate, deliberate action —
    // adding someone to the list is not the same as handing them a way in.
    set(state => ({
      staffRoster: [...state.staffRoster, { ...entry, status: "not-issued" as const }],
      auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
    }));
    return true;
  },
  updateRosterEntry: (employeeId, updates) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      if (!entry) return {};
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: entry.projectId,
        message: `Roster entry updated: ${updates.name ?? entry.name} (${employeeId})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        staffRoster: state.staffRoster.map(r => (r.employeeId === employeeId ? { ...r, ...updates } : r)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, 200),
      };
    }),
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
/**
 * The account being acted on is the last one that can still grant permissions. Suspending,
 * deleting or demoting it would leave an installation where nobody can give anyone access and no
 * supplier account exists to unlock it.
 *
 * Counts owners, not every admin: after the console roles split, an admin cannot grant access, so
 * a room full of admins is still a locked-out installation.
 */
export function isLastActiveAdmin(users: PortalUser[], userId: string): boolean {
  const target = users.find(u => u.id === userId);
  if (!target || !canManageAccess(target.permission) || target.status !== "active") return false;
  return users.filter(u => canManageAccess(u.permission) && u.status === "active").length <= 1;
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
