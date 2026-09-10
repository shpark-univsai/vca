import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { liveEvents, getFacePhoto, DISTRICTS, type EventType, type LiveEvent, type TrackingHop } from "@/lib/mockData";
import {
  isTodaySgt, recentSgtStamp, parseSgtStamp,
  setSiteTimeZoneResolver, FALLBACK_TIME_ZONE,
} from "@/lib/time";
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
   * is that country's, whoever is looking. Set from Portal (Settings' project card for now — see
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

/*
 * There is no camera "source type" here, and there is no per-camera engine list either.
 *
 * Both were carried over from the old console and both are gone (2026-09-09, backend reply C2/C4).
 * The v1 contract covers plain CCTV only — AI cameras, meaning devices that run inference
 * themselves, were dropped from the design on 2026-08-27 and come back as an additive field if
 * they ever ship. So there is no inference-location split, no separate billing, and one channel
 * pool: cameras used = channels used.
 *
 * What actually analyses a stream is a single site-wide analysis module that processes every
 * provisioned camera. A camera is not routed to a server, which is why Camera.serverId below is
 * infrastructure metadata and not a wiring decision.
 */

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
  /** The real Update Server dialog asks for this next to the IP; nothing reaches a server without
   *  it, so an address on its own was never enough to describe one. */
  port?: number;
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
/**
 * A watchlist category, defined by the institution rather than by us.
 *
 * WHY THIS IS NOT AN ENUM. Who buys this is not settled, and the words differ by customer: a police
 * force keeps wanted persons, missing persons and persons of interest; a company keeps barred
 * visitors and restricted counterparties. Fix the names in code and every new customer is a code
 * change — and a translation-dictionary change on top, so the same list splits in two places.
 *
 * WHY THERE ARE NO DEFAULTS. Seeding "Wanted" would make it the standard: the first thing a
 * customer who is not a police force does is delete it, and the second is wonder what else in here
 * was written for somebody else. An empty list with a Create button is the honest starting state.
 *
 * NOT A PRIORITY. Person.priorityLabel stays exactly as it is — a category says what kind of case
 * this is and a priority says how urgent, and among missing persons some are more urgent than
 * others. Folding one into the other loses a distinction the operator has to make.
 *
 * OWNED BY THE TEAM, not the project. One institution's classification scheme is the institution's;
 * scoping it per project would make the same person a different kind of case at each site.
 *
 * HANDOFF NOTE: the API request is a CRUD list under the team —
 *   GET/POST /teams/:id/watchlist-categories, PATCH /watchlist-categories/:id
 * Archive rather than delete, because registered people reference these by id.
 */
export interface WatchlistCategory {
  id: string;
  teamId: string;
  /** What the institution calls it. Shown verbatim — never translated, because it is their word. */
  label: string;
  /**
   * How long a registration under this category lasts by default, in days. Null means the category
   * has no natural end (a permanently barred visitor), and the form then asks why rather than
   * leaving the expiry silently empty.
   */
  defaultValidDays: number | null;
  /** Whether a registration under this category must carry a written basis — a case number, an
   *  official document reference. Some categories are self-evident; most are not. */
  requiresBasis: boolean;
  /** A design-token family name, not a hex value: the institution picks from the palette this
   *  product already has, so a category cannot introduce a colour the rest of the console does not
   *  use — or one that collides with the status colours. */
  color: WatchlistCategoryColor;
  /** Retired rather than deleted. People registered under it still point at this id, and a
   *  category that vanishes would leave their rows naming nothing. */
  archived: boolean;
}

/**
 * Why someone is running a person search.
 *
 * Reading footage of identified people is the most invasive thing this product does, and the one
 * an institution has to be able to answer for afterwards: who looked, when, and what for. The
 * server records the call on its own — confirmed by the backend — but it cannot invent the
 * purpose. Only the person at the screen knows that, so the screen has to ask.
 *
 * Institution-defined for the same reason watchlist categories are: a police control room and a
 * corporate security desk do not share a vocabulary, and a list fixed in code becomes a list
 * somebody works around.
 */
export interface SearchPurpose {
  id: string;
  teamId: string;
  /** The institution's own word for it. Shown verbatim, never translated. */
  label: string;
  /** Whether choosing this purpose requires a written reference — a case number, a document id.
   *  A routine check may need none; a search on someone's behalf usually does. */
  requiresReference: boolean;
  /** Retired rather than deleted, so records that name this purpose still resolve. */
  archived: boolean;
}

/**
 * The purpose in force for this sitting.
 *
 * Asked once on entering a search screen rather than per search. A dialog on every search gets
 * whatever the operator can type fastest — the record then exists and means nothing. Asked once
 * and left visible on screen, it reads as a standing declaration, and that visibility is most of
 * what makes it work.
 *
 * HANDOFF NOTE: this belongs on the wire, not only here. Every person-search request must carry
 * the purpose id, the reference and the note so the server writes them beside the call it is
 * already logging. Kept in the store because there is no request to attach it to yet.
 */
/**
 * One recorded look-up: who searched for whom, under what declared purpose.
 *
 * WHY IT IS NOT THE AUDIT LOG. auditLog answers "who changed the configuration"; this answers "who
 * looked at a person". They have different readers, different retention and different volume — a
 * control room produces these by the hundred and settings changes by the handful, and mixing them
 * buries the ones somebody is meant to sample.
 *
 * THE LABEL IS A SNAPSHOT, not a lookup. A record has to stay readable after the purpose it names
 * is renamed or retired, and an audit entry that resolves to nothing is worse than no entry — so
 * the wording used at the time is copied onto the record and never updated. purposeId is kept
 * beside it for filtering, not for display.
 *
 * HANDOFF NOTE: the server already logs that a search call happened; this is the half only the
 * screen can supply. Two fields it cannot: `ip` — which desk the search came from, the one thing
 * that separates two operators sharing a control-room account — and the authoritative timestamp.
 * Both should come from the server on write rather than be trusted from the client.
 */
export interface SearchAccessRecord {
  id: string;
  projectId: string;
  /** The institution, so an auditor can read across the sites it runs. */
  teamId: string;
  at: string;
  /** The account that ran it. */
  actor: string;
  purposeId: string;
  /** The purpose's wording at the time — see the note above. */
  purposeLabel: string;
  /** Case or document reference, when the purpose required one. */
  reference?: string;
  note?: string;
  /** What was searched for, as the operator entered it. */
  target: string;
  /** Where it was run from — Re-ID, RedFace, RedMap. */
  surface: string;
  /** How many candidates came back. Zero is a result, not a missing value. */
  resultCount?: number;
  /** HANDOFF: set by the server, not the browser. */
  ip?: string;
}

export interface SearchPurposeSelection {
  purposeId: string;
  /** Case or document reference, when the purpose requires one. */
  reference?: string;
  note?: string;
  /** When it was declared — a sitting that started six hours ago is worth re-asking. */
  at: string;
}

/** The palette a category may take. Names, not values — see WatchlistCategory.color. */
/**
 * The colours a watchlist category may be given.
 *
 * Three, not six, and the three missing ones are missing on purpose: danger, warning and
 * success already mean something on the screen these chips appear on. warning-500 is what the
 * registry-health strip uses for a real defect — "photo unreadable", a face no camera can
 * match — so an amber chip beside it teaches the reader that a category IS a defect. danger is
 * the destructive colour every confirmation in Portal uses, and success reads as resolved.
 * A taxonomy is not a severity scale, and borrowing a severity ramp to draw one is how the two
 * stop being tellable apart.
 *
 * Five, because two families were added for exactly this: teal and magenta carry no meaning
 * anywhere else in the product and sit in the palette's empty arcs (see globals.css). That
 * gets a taxonomy back to the five distinguishable labels it had before, without any of them
 * being read as a severity.
 *
 * FIGMA: teal and magenta were defined in globals.css first, which is backwards — the library
 * is the source of truth for colour. They have to be added there with the same values before
 * anything else picks them up.
 */
export const WATCHLIST_CATEGORY_COLORS = ["primary", "info", "teal", "magenta", "gray"] as const;

/**
 * Wider than the list above on purpose. Categories created before the palette was narrowed can
 * still carry a retired name, and a stored value that no longer type-checks is a crash rather
 * than a chip in the wrong colour — categoryTint still resolves all six.
 */
export type WatchlistCategoryColor = "primary" | "info" | "teal" | "magenta" | "gray" | "danger" | "warning" | "success";

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
  /**
   * When any camera last matched this person, or absent if none ever has.
   *
   * THIS IS A REQUEST TO THE BACKEND. It is `max(timestamp)` over the detection events already
   * stored against this person — not a new aggregation, and cheap enough to return on the row
   * rather than behind its own endpoint.
   *
   * It is here because the registry could say everything about itself and nothing about whether it
   * works. A watchlist rots quietly: contracts end, delegations fly home, and the row stays. The
   * column this feeds is sortable, so "who has not been seen since June" is one click rather than
   * a report — and it is a column and not a warning on purpose, because never being detected is
   * not a fault. Some of these people are watched *for*, and a name that never comes up is that
   * list working.
   *
   * Absent, not a sentinel date: "never" and "long ago" are different answers and the table prints
   * them differently.
   */
  lastDetectedAt?: string;
  /**
   * Which category this registration falls under, or absent for an unclassified one.
   *
   * Optional on purpose: an installation with no categories defined yet must still be able to
   * register somebody. A registry that refuses the first entry until an administrator has built a
   * taxonomy is a registry nobody starts using.
   */
  categoryId?: string;
  /**
   * Why this person is on the list — a case number, an official document reference, a sentence.
   * Free text, because what counts as a basis differs by institution and by category.
   *
   * Required when the chosen category says so. Without it, a row that turns out to be wrong has
   * nobody to ask: the registry knows when somebody was added and, now, by whom, but not on what
   * authority.
   */
  basis?: string;
  /** The account that registered this person. The registry recorded the moment and not the hand. */
  registeredBy?: string;
  /**
   * When a new photo was last submitted for this person, if one has been.
   *
   * The way out of "photo unreadable", and the reason that state needed one. The console reported
   * a defect — a face the model could not turn into features — and offered no remedy: an admin
   * could upload a clean photo, save, and the flag, the count and the unmatchable row were all
   * exactly as before, because the flag was a hash of the person's id and nothing could move it.
   *
   * Set by updatePerson whenever photoUrl actually changes. It does NOT mean the new photo is
   * readable — only the model can answer that, and Portal has not asked it yet. It means the
   * question has been re-asked, which is a different and honestly reportable state: the registry
   * health strip counts these separately from the ones nobody has touched.
   *
   * HANDOFF NOTE: the backend replaces this with a real answer. Re-enrolment is
   * POST /v1/vips/{id}/enroll, and its result — readable, or not, and why — belongs on the row.
   * Until then a re-submitted photo stays "awaiting re-enrolment" and is never claimed to work.
   */
  reenrolledAt?: string;
  /**
   * When this registration stops. Absent means it does not — a real answer for some categories and
   * a mistake for most, so the form asks rather than assuming.
   *
   * A watchlist with no expiry keeps processing people after the purpose has ended, which is the
   * first thing an audit asks about. A found child comes off; an arrested suspect comes off.
   *
   * HANDOFF NOTE — THE PART THAT MATTERS. An expiry that only greys a row out is worse than no
   * expiry at all: the operator believes the person was released while the cameras keep matching
   * them. Expiry has to reach the analysis module. The provisioning call that carries the watchlist
   * (PUT /v1/provision/vips in the module contract draft) is where expired people must drop out,
   * and that belongs in the contract rather than in the screen.
   */
  expiresAt?: string;
  /** When somebody took this person off the list, and why. A release, not a delete: the row stays
   *  so the history survives, and so "released" and "expired" stay tellable apart. */
  releasedAt?: string;
  releaseReason?: string;
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
  /** Empty on a fresh installation, and deliberately so — see WatchlistCategory. */
  watchlistCategories: WatchlistCategory[];
  /** Empty on a fresh installation, same reason — see SearchPurpose. */
  searchPurposes: SearchPurpose[];
  /** Null until the operator declares one this sitting. See SearchPurposeSelection. */
  searchPurpose: SearchPurposeSelection | null;
  /** Every look-up, newest first. Empty until the app records one — see SearchAccessRecord. */
  searchAccessLog: SearchAccessRecord[];
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
  renameProject: (projectId: string, name: string) => void;
  /**
   * Deletes a project and everything filed under it.
   *
   * Cascading, not orphaning: cameras, uploads, servers, the watchlist and its groups, roster
   * rows and search-log entries all carry a projectId and mean nothing without it. The audit
   * entries stay — the record of what was done to a site outlives the site, which is the whole
   * point of keeping one — and so do accounts, which belong to the team; the project is removed
   * from each account's list instead.
   */
  removeProject: (projectId: string) => void;
  /**
   * There is deliberately no updateProjectLicense.
   *
   * One existed here with no caller, and two screens cited that absence as proof the design was
   * intentional — but an action nobody calls is not a design, it is a loaded gun on the table.
   * The store is the shape the backend mirrors: leaving a "rewrite this site's channel limit and
   * expiry" mutator in it asks for the endpoint that makes it real, and then the number a
   * contract is priced on is a field an administrator can type into.
   *
   * Channels, plan and term arrive with the licence and are read-only to everything in here.
   * Removed 2026-09-10; see the licence-as-signed-file question in the vendor-admin review.
   */
  updateProjectMail: (projectId: string, updates: Pick<Project, "mailDomain" | "smtp">) => void;
  setProjectTimeZone: (projectId: string, timeZone: string) => void;
  // null clears the override and falls back to the auto-detected value; true/false pins it.
  setNetworkIsolationOverride: (projectId: string, override: boolean | null) => void;
  updateTeamMail: (teamId: string, updates: Pick<Team, "mailDomain" | "smtp">) => void;
  addPerson: (person: Omit<Person, "id">) => void;
  removePerson: (personId: string) => void;
  /**
   * A CSV import, as one act.
   *
   * Not addPerson in a loop. Every mutation trims the audit log to AUDIT_LOG_LIMIT, so importing
   * two hundred names evicted every entry before it — camera removals, permission changes,
   * project renames — and the Activity log's note about older history being "on the server" was
   * not true of any of it, because nothing had been sent anywhere. One entry naming the file,
   * the way removeCameras and setCamerasZone already collapse a bulk action.
   */
  addPersons: (persons: Omit<Person, "id">[], source: string) => number;
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
  addSearchPurpose: (purpose: Omit<SearchPurpose, "id" | "archived">) => string;
  updateSearchPurpose: (purposeId: string, updates: Partial<Omit<SearchPurpose, "id" | "teamId">>) => void;
  archiveSearchPurpose: (purposeId: string) => void;
  /** Declare the purpose for this sitting, or clear it to be asked again. */
  setSearchPurpose: (selection: SearchPurposeSelection | null) => void;
  /**
   * Write one look-up to the access log. Called by the app when a search runs.
   *
   * Takes the purpose's label rather than resolving it, so the record keeps the wording that was
   * on screen at the time — see SearchAccessRecord.
   */
  recordSearchAccess: (record: Omit<SearchAccessRecord, "id">) => void;
  addWatchlistCategory: (category: Omit<WatchlistCategory, "id" | "archived">) => string;
  updateWatchlistCategory: (categoryId: string, updates: Partial<Omit<WatchlistCategory, "id" | "teamId">>) => void;
  /**
   * Retire a category. Not a delete — people registered under it keep the id, and their rows would
   * otherwise name a category that no longer exists.
   */
  archiveWatchlistCategory: (categoryId: string) => void;
  /**
   * Take somebody off the watchlist without erasing that they were on it.
   *
   * Separate from removePerson because the two answer different questions later: a released row
   * says the purpose ended and when, a deleted row says nothing at all. Audited, because "who took
   * this person off and why" is exactly what gets asked afterwards.
   */
  releasePerson: (personId: string, reason: string) => void;
  /**
   * Put a released person back on the watchlist.
   *
   * Release was one-way: the row menu dropped the action once releasedAt was set, saveEdit never
   * cleared it, and no reinstate existed anywhere — so the only undo was delete-and-re-register,
   * which destroys the registration history the release was kept to preserve. The product
   * anticipated a wrongly LISTED person (the release-reason placeholder literally offers "Listed
   * in error") and not a wrongly RELEASED one, which is the same mistake in the other direction.
   *
   * Both dates survive in the audit log, which is where "was this person off the list on the 3rd"
   * is answered. The row itself carries only the current state.
   */
  reinstatePerson: (personId: string, reason: string) => void;
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
  renameTeam: (teamId: string, name: string) => void;
  /** Refuses while the team still has projects — see the implementation. */
  removeTeam: (teamId: string) => void;
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
  /** A roster import, as one act and one audit entry. See addPersons. Returns the employeeIds
   *  it refused as duplicates, in the order given. */
  addRosterEntries: (entries: Omit<RosterEntry, "status" | "code" | "issuedAt">[], source: string) => string[];
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
/**
 * How many audit entries the console keeps in memory.
 *
 * Named rather than repeated as a literal at every mutation, because the Activity screen prints
 * this number to the reader — a capped list that does not say it is capped reads as a complete
 * history, and its oldest row reads as the beginning.
 *
 * HANDOFF NOTE: this is a client-side ceiling on a list held in memory, not a retention policy.
 * The server keeps the real history; see ProjectActivityTab for the query the screen's filters
 * are shaped to become.
 */
export const AUDIT_LOG_LIMIT = 200;

export interface AuditEvent {
  id: string;
  projectId?: string;
  /**
   * Set instead of projectId when the change belongs to the institution rather than to one site —
   * a watchlist category, a search purpose. The Overview shows a project's own entries plus its
   * team's, because a policy change is news at every site it governs and filing it under one of
   * them would be a lie about where it applies.
   */
  teamId?: string;
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
    // Expiring inside the ninety-day window on purpose, so the licence page's "expiring soon"
    // state is on screen somewhere rather than only in the code. Marina Bay stays years out, so
    // the two states can be compared by switching projects.
    licensePlan: "Professional", licenseChannelLimit: 40, licenseExpiresAt: "2026-11-20",
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
/**
 * What a file was uploaded to have done to it.
 *
 * A kind, not a file format, which is why a deepfake check sits beside video and image rather than
 * inside them: the same .mp4 can arrive for either, and what separates them is the question being
 * asked. Video and image are uploaded to be searched for faces; a deepfake submission is uploaded
 * to be judged authentic or not. Different pipeline, different result, different list — the
 * console this replaces made the same split, with a DEEPFAKE tab beside IMAGE and VIDEOS.
 *
 * Kept in the model even though the feature is "probably not needed, for now" (2026-09-09): the
 * screen is drawn so the shape of the answer is decided before anyone builds it.
 */
export type UploadKind = "video" | "image" | "deepfake";

/**
 * What the deepfake check concluded.
 *
 * Three values, not a boolean. A detector that cannot decide is the ordinary case for short,
 * compressed or heavily re-encoded footage, and collapsing that into "authentic" would turn "we do
 * not know" into a clearance — which is the one mistake this feature exists to avoid.
 *
 * HANDOFF NOTE: seeded. The real verdict comes with a score from the model, and the score is what
 * the screen shows beside the word — a verdict without one is an opinion nobody can weigh.
 */
export type DeepfakeVerdict = "authentic" | "manipulated" | "inconclusive";
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
  /** Deepfake submissions only, and only once the check has finished. */
  deepfakeVerdict?: DeepfakeVerdict;
  /** 0-1, the model's confidence in that verdict. Shown beside it: "manipulated" at 0.55 and at
   *  0.98 are the same word and very different news. */
  deepfakeScore?: number;
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
  // Three deepfake submissions, one per verdict, so every state the screen can draw is on screen.
  // The fourth state — still running — is the queued row below them.
  { id: "d1", projectId: "proj-sg", fileName: "press_briefing_clip.mp4", kind: "deepfake", durationSec: 46, sizeBytes: 18_000_000, resolution: "1920×1080", uploadedAt: auditAt(9 * 60), uploadedBy: "Grace Tan", status: "done", deepfakeVerdict: "manipulated", deepfakeScore: 0.94 },
  { id: "d2", projectId: "proj-sg", fileName: "gate_handover_0905.mp4", kind: "deepfake", durationSec: 128, sizeBytes: 61_000_000, resolution: "1920×1080", uploadedAt: auditAt(33 * 60), uploadedBy: "Marcus Lee", status: "done", deepfakeVerdict: "authentic", deepfakeScore: 0.88 },
  { id: "d3", projectId: "proj-sg", fileName: "lobby_reupload.mp4", kind: "deepfake", durationSec: 12, sizeBytes: 3_100_000, resolution: "854×480", uploadedAt: auditAt(58 * 60), uploadedBy: "Wei Chen", status: "done", deepfakeVerdict: "inconclusive", deepfakeScore: 0.41 },
  { id: "d4", projectId: "proj-sg", fileName: "unverified_tipoff.mp4", kind: "deepfake", durationSec: 74, sizeBytes: 29_000_000, resolution: "1280×720", uploadedAt: auditAt(2 * 60), uploadedBy: "Grace Tan", status: "pending" },
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
const PORTAL_CONSOLE_ROLES: PortalPermission[] = ["owner", "admin", "auditor"];

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

/**
 * May change the lists that decide what the audit will find: watchlist categories and search
 * purposes.
 *
 * Owner only, and narrower than canEditPortal on purpose. These two are not settings, they are the
 * constraints the console places on its own operators — what counts as a reason to look somebody
 * up, and whether listing a person needs a written basis. An admin who finds the purpose gate
 * tiresome could add "routine check" and the requirement is gone; that is the same shape as role
 * granting, a power whose use removes the limit on the person using it.
 *
 * Both lists take the same gate. Splitting them would leave an administrator able to loosen one
 * kind of policy and not the other for no reason anybody could state.
 */
export function canSetPolicy(permission: PortalPermission): boolean {
  return permission === "owner";
}

/** May open Portal (any console role). */
export function canEnterPortal(permission: PortalPermission): boolean {
  return PORTAL_CONSOLE_ROLES.includes(permission);
}

/**
 * Whether the account is GRANTED the monitoring app — the permission, not today's answer.
 *
 * Takes the user rather than a permission because it is no longer derivable from the role — that
 * is the entire point of the split. Portal shows this: it is what an administrator granted, and it
 * stays true of a suspended account, whose access was not revoked but paused.
 */
export function canEnterApp(user: Pick<PortalUser, "appAccess">): boolean {
  return user.appAccess;
}

/**
 * Whether the account may open the app RIGHT NOW: granted, and in a state that can sign in.
 *
 * The app's door used to read canEnterApp alone, so `status: "suspended", appAccess: true` — the
 * exact combination one seeded account carries — was turned away by login and let straight in
 * here. An administrator suspending an account mid-shift expects the screen to go, not to keep
 * serving whoever is already in front of it. Separate from canEnterApp because Portal is
 * reporting a grant while the door is deciding an entry, and the two are not the same question.
 *
 * HANDOFF NOTE: the door that matters is the session on the server. This is the screen's copy.
 */
export function canUseAppNow(user: Pick<PortalUser, "appAccess" | "status">): boolean {
  return canEnterApp(user) && user.status === "active";
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
 * The one site the app is currently showing.
 *
 * The app is a single-site screen: an operator watches their own site, and a screen that mixes two
 * sites' detections into one map is one where "respond to this" points at the wrong city. Access
 * can span several sites — a school group's security lead watching two campuses — so the header
 * offers a switch; what it never offers is both at once.
 *
 * Falls back to the first site the account can see, so the app always has a site even before
 * anyone has chosen one. Returns null only when the account can see no site at all.
 */
export function resolveActiveProject(
  activeProjectId: string,
  users: PortalUser[],
  projects: Project[],
): Project | null {
  const visible = projectsVisibleInApp(users, projects);
  return visible.find(p => p.id === activeProjectId) ?? visible[0] ?? null;
}

/**
 * Which site a detection belongs to.
 *
 * Detections carry a cameraId and nothing else about where they belong, so the camera register is
 * what attributes them — the same rule the backend confirmed for the real thing (cameraId → the
 * register's projectId). Two pools have to be searched: the register itself, and the much larger
 * simulation pool the VIP ticker draws from, whose cameras are not register rows.
 *
 * HANDOFF NOTE: module-api v1.10 has no project on detections at all, which is why an operator
 * could see another site's people. Once the proxy filters by the session's projects this becomes a
 * second line of defence rather than the only one — keep it either way: it is also what makes the
 * header's site switch mean something within one session.
 */
export function projectIdForCameraId(cameraId: string, cameras: Camera[]): string | undefined {
  return cameras.find(c => c.id === cameraId)?.projectId
    ?? VIP_SIMULATION_CAMERAS.find(c => c.id === cameraId)?.projectId;
}

/** Detections at this site's cameras. */
export function eventsInProject(events: VcaEvent[], projectId: string, cameras: Camera[]): VcaEvent[] {
  return events.filter(e => projectIdForCameraId(e.cameraId, cameras) === projectId);
}

/** People registered at this site. */
export function personsInProject(persons: Person[], projectId: string): Person[] {
  return persons.filter(p => p.projectId === projectId);
}

/**
 * The people this site is actually watching for right now.
 *
 * personsInProject above answers "whose records belong to this site" — which is what Portal's
 * registry wants, because a released row and an expired one are exactly what the registry has to
 * keep showing. Every screen in the monitoring app wants the other question, and asking the
 * first one there is a fault with consequences: an administrator formally releases somebody in
 * the morning and the operator is still being alerted on them that afternoon, because the row
 * only got a `releasedAt` stamp and nothing read it.
 *
 * The store's own note on Person.expiresAt calls this out — "an expiry that only greys a row out
 * is worse than no expiry at all: the operator believes the person was released while the
 * cameras keep matching them" — and until now that was the actual behaviour on this side of the
 * product too, not just in the module.
 *
 * `releasedAt` needs no clock. `expiresAt` does, so it is passed in rather than read here: a date
 * comparison made during render disagrees between the server's frame and the browser's first
 * one. Callers that have no clock yet pass null, and then only the release filter applies —
 * the narrower answer of the two, never the wider one.
 *
 * HANDOFF NOTE: the same rule has to hold on the wire. Released and expired people must drop out
 * of PUT /v1/provision/vips, or the analysis module keeps matching a face the console says it
 * has stopped watching. The screen filtering them is not the control; the provisioning call is.
 */
export function watchedPersonsInProject(persons: Person[], projectId: string, nowMs: number | null): Person[] {
  const today = nowMs === null ? null : new Date(nowMs).toISOString().slice(0, 10);
  return persons.filter(p => {
    if (p.projectId !== projectId) return false;
    if (p.releasedAt) return false;
    if (today !== null && p.expiresAt && p.expiresAt.slice(0, 10) < today) return false;
    return true;
  });
}

/** This site's cameras. */
export function camerasInProject(cameras: Camera[], projectId: string): Camera[] {
  return cameras.filter(c => c.projectId === projectId);
}

/**
 * Hooks, so a screen scopes itself in one line and cannot forget a piece of it.
 *
 * The pure functions above take their inputs, which is what makes them testable and usable from
 * the api layer; these wrap them for the screens, which all want the same thing: whatever the
 * header is currently pointed at. Every app screen that shows detections, people or cameras reads
 * through one of these — the filter living in one place is what keeps the map, the list and the
 * counts from disagreeing about which site is on screen.
 *
 * Memoised, and that is not an optimisation. A filter returns a new array on every render, and
 * this codebase leans on array identity in two places that then break: BestFramePage reconciles
 * uploads during render by comparing `prev !== next`, and several screens pass a list as a
 * useApiData dependency. Both turn a fresh-every-render array into an endless loop — which is
 * exactly what happened the first time these shipped without useMemo.
 */
export function useActiveProjectId(): string {
  const activeProjectId = useVcaStore(s => s.activeProjectId);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const projects = useVcaStore(s => s.projects);
  return resolveActiveProject(activeProjectId, portalUsers, projects)?.id ?? "";
}

export function useProjectEvents(): VcaEvent[] {
  const events = useVcaStore(s => s.events);
  const cameras = useVcaStore(s => s.cameras);
  const projectId = useActiveProjectId();
  return useMemo(() => eventsInProject(events, projectId, cameras), [events, projectId, cameras]);
}

/**
 * The app's view of the watchlist: this site's people, minus the ones taken off it.
 *
 * Deliberately NOT personsInProject — see watchedPersonsInProject. Portal keeps reading the
 * unfiltered list, because the record of a release is the point of a release.
 */
export function useProjectPersons(): Person[] {
  const persons = useVcaStore(s => s.persons);
  const projectId = useActiveProjectId();
  // Post-mount, like every other clock read: an expiry compared during render cuts at a
  // different instant on the server than in the browser, and the two frames then disagree about
  // who is on the list.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  return useMemo(() => watchedPersonsInProject(persons, projectId, nowMs), [persons, projectId, nowMs]);
}

/**
 * Non-hook form, for imperative code that cannot call a hook — a timer, a seeder, an event
 * handler. Same resolution as useActiveProjectId.
 */
export function getActiveProjectId(): string {
  const s = useVcaStore.getState();
  return resolveActiveProject(s.activeProjectId, s.portalUsers, s.projects)?.id ?? "";
}

export function useProjectCameras(): Camera[] {
  const cameras = useVcaStore(s => s.cameras);
  const projectId = useActiveProjectId();
  return useMemo(() => camerasInProject(cameras, projectId), [cameras, projectId]);
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
/**
 * Who to call when the console cannot help.
 *
 * Every field is optional except the address, because a support desk is not obliged to have a
 * phone. A supplier who handles everything by mail has no number to give, and printing a made-up
 * one is worse than printing none — somebody will dial it. Absent fields are dropped from the
 * sheet rather than shown empty or as "—", which would read as a number that exists and is missing.
 *
 * HANDOFF NOTE: seeded. The real values are deployment configuration, alongside authConfig's
 * supportContact — one installation, one desk, fixed at deploy time.
 */
export interface SupportContact {
  email: string;
  phone?: string;
  hours?: { en: string; ko: string };
}

export const SUPPORT_CONTACT: SupportContact = {
  email: "support@univs.ai",
  phone: "+65 6812 4400",
  /** Local time at the site, which is the only clock the person reading this has. */
  hours: { en: "Mon–Fri, 09:00–18:00 (SGT)", ko: "월–금 09:00–18:00 (SGT)" },
};

/**
 * Who the product thinks is looking at it, until a session exists.
 *
 * Now one of the seeded accounts rather than a name that matches none of them. That sounds like a
 * cosmetic change and is not: every permission helper resolves the signed-in address against the
 * account list, and an address matching nobody falls through to the permissive branch — so the
 * console let you switch a person's app-search off and the app carried on searching, because the
 * viewer was not that person or any person. The rules were writable and unobservable.
 *
 * Grace Tan because she is the seeded owner: Portal keeps working exactly as before (an account
 * with a lesser role would bounce the viewer out of the console entirely), while the app-side
 * flags now belong to somebody real and toggling them in Users & Permissions changes what the
 * monitoring app does.
 *
 * HANDOFF NOTE: this whole constant disappears with the login response. It is the stand-in, not a
 * default — a real build reads the identity off the session and denies by default when it has none
 * (see canSearchInApp, currentPortalUser).
 */
export const SIGNED_IN_USER: SignedInUser = {
  name: "Grace Tan",
  email: "grace.tan@univs.ai",
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
  { id: "user-1", name: "Grace Tan", email: "grace.tan@univs.ai", employeeId: "EMP-2041", teamId: "team-univs", projectIds: ["proj-sg", "proj-riverside"], permission: "owner", appAccess: true, appSearch: true, status: "active", lastLoginAt: "2026-08-25 09:14" },
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
  { id: "srv-1", projectId: "proj-sg", name: "FR 2", ip: "192.168.0.36", port: 8021, type: "Face Recognition", status: "success" },
  { id: "srv-2", projectId: "proj-sg", name: "AI camera 1", ip: "192.168.0.36", port: 8012, type: "AI Camera", status: "success" },
  { id: "srv-3", projectId: "proj-sg", name: "image store 1", ip: "192.168.0.36", port: 8031, type: "Image Store", status: "success" },
  { id: "srv-4", projectId: "proj-sg", name: "database 1", ip: "192.168.0.36", port: 5432, type: "Database", status: "success" },
  { id: "srv-5", projectId: "proj-sg", name: "normal camera 1", ip: "192.168.0.36", port: 8011, type: "Normal Camera", status: "success" },
  { id: "srv-6", projectId: "proj-sg", name: "testServer", ip: "192.168.0.103", port: 8021, type: "Face Recognition", status: "error" },
  { id: "srv-7", projectId: "proj-riverside", name: "campus-fr-1", ip: "192.168.1.20", port: 8021, type: "Face Recognition", status: "success" },
  { id: "srv-8", projectId: "proj-riverside", name: "campus-db-1", ip: "192.168.1.21", port: 5432, type: "Database", status: "success" },
];

const CAMERA_SEEDS: Camera[] = [
  {
    id: "cam-novena", projectId: "proj-sg", code: "CAM-NOV-001", name: "Novena",
    ip: "10.20.4.11", mac: "00:1B:44:11:3A:B7", rtspUrl: "rtsp://10.20.4.11:554/stream1",
    status: "online", location: "Novena, Singapore", zone: "Novena",
    // A server on a handful of the named cameras, not on all sixty — which is the gap the Input
    // Sources summary is there to report.
    //
    // Two of the named cameras are declared AI sources and attach to the AI-camera server; the
    // rest are ordinary CCTV on the normal-camera server. That is the shape of a real deployment,
    // and it is the whole of what the camera itself says about analysis: which engine runs is the
    // server's business, not the camera's.
serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3202, lng: 103.8440, maker: "Hanwha", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-geylang", projectId: "proj-sg", code: "CAM-GEY-001", name: "Geylang NC1",
    ip: "10.20.4.12", mac: "00:1B:44:11:3A:B8", rtspUrl: "rtsp://10.20.4.12:554/stream1",
    status: "online", location: "Geylang NC1, Singapore", zone: "Geylang",
    serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3148, lng: 103.8778, maker: "Hikvision", resolution: "FHD (1920×1080)",
  },
  {
    id: "cam-orchard", projectId: "proj-sg", code: "CAM-ORC-001", name: "Orchard MRT",
    ip: "10.20.4.13", mac: "00:1B:44:11:3A:B9", rtspUrl: "rtsp://10.20.4.13:554/stream1",
    status: "online", location: "Orchard MRT, Singapore", zone: "Orchard",
    serverId: "srv-2",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.3044, lng: 103.8321, maker: "Dahua", resolution: "4K (3840×2160)",
  },
  {
    id: "cam-bugis", projectId: "proj-sg", code: "CAM-BGS-001", name: "Bugis MRT",
    ip: "10.20.4.14", mac: "00:1B:44:11:3A:BA", rtspUrl: "rtsp://10.20.4.14:554/stream1",
    status: "online", location: "Bugis MRT, Singapore", zone: "Bugis",
    serverId: "srv-2",
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
  /**
   * A second project with cameras of its own. Everything above belongs to the smart-city
   * deployment, which meant switching sites in the app's header landed on an empty screen — the
   * project filter had nothing to prove itself against.
   *
   * Six, not sixty: a school campus is not a city. The gate, the two corridors, the hall and the
   * car park are where a school actually puts cameras, and the count is what makes a smaller site
   * read as a smaller site rather than as a filtered version of the big one.
   */
  ...["Main Gate", "East Corridor", "West Corridor", "Assembly Hall", "Car Park", "Rear Gate"]
    .map((spot, i) => ({
      id: `cam-riverside-${i + 1}`,
      projectId: "proj-riverside",
      code: `CAM-RVS-${String(i + 1).padStart(3, "0")}`,
      name: spot,
      ip: `10.40.1.${11 + i}`,
      mac: `00:1B:44:44:0${i}:C${i}`,
      rtspUrl: `rtsp://10.40.1.${11 + i}:554/stream1`,
      // One of the six is down — a site where everything is always green teaches nobody how the
      // offline row looks, and the Rear Gate is exactly the camera a campus forgets about.
      status: (spot === "Rear Gate" ? "offline" : "online") as CameraStatus,
      location: `${spot}, Riverside International School`,
      zone: spot === "Car Park" || spot === "Rear Gate" ? "Perimeter" : "Campus",
      serverId: "srv-7",
      thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
      lat: Math.round((1.3410 + i * 0.0008) * 10000) / 10000,
      lng: Math.round((103.8080 + i * 0.0011) * 10000) / 10000,
      maker: "Hanwha",
      resolution: "FHD (1920×1080)",
    })),
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
/**
 * The day the seed calls today.
 *
 * Fixed rather than `Date.now()`, for the reason every other seed in this file is fixed: the
 * server and the browser must draw the same table on first paint. Everything dated relative to a
 * clock would differ between the two renders and hydration would tear.
 *
 * It is also what "the last seven days" is measured back from, so the reach figures on the VIP page
 * and the dates in its table are answers about the same week. The real API measures from the actual
 * instant, in the project's timezone.
 */
const SEED_TODAY = Date.UTC(2026, 8, 9);

/**
 * A plausible "last seen" for a seeded person: mostly never, otherwise spread back over the months.
 *
 * The distribution is deliberate rather than uniform. This project has sixty cameras and four of
 * them carry an AI engine (see the camera seed and the Input Sources summary), so a hundred-name
 * watchlist that only four cameras can match is *supposed* to leave most rows untouched in a given
 * week. A registry where everybody is seen every week would be the misleading mockup, not this one.
 *
 * Never returns a day before the person was registered — a face cannot be matched by a system it
 * was not yet enrolled in, and a table that printed one would be teaching the reader a wrong rule.
 */
/**
 * A person's own seed, from the whole id.
 *
 * Not the id's length and last character, which was the first attempt: across "person-seed-1" ..
 * "person-seed-100" those vary by three lengths and ten digits, so a hundred people drew about a
 * dozen distinct rolls and every distribution built on it came out in lumps.
 *
 * Shared, because two facts about the same person have to agree. A face the model could not read
 * cannot also have been matched by a camera last Tuesday, and it will be if the two are rolled
 * from different seeds.
 */
function personSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100_000;
  return h;
}

/** Has a photo the model could not turn into features — enrolled, and unmatchable. */
function seededPhotoUnreadable(id: string): boolean {
  return seededRandom(personSeed(id) * 0.023 + 1.9) > 0.87;
}

function seededLastDetectedAt(id: string, registeredAt: string): string | undefined {
  // Unmatchable faces are never matched. Reading this from the same predicate registryHealth uses
  // is the only thing keeping the summary and the table from contradicting each other on the same
  // row — "photo unreadable" over a row that says it was seen on Friday.
  if (seededPhotoUnreadable(id)) return undefined;
  const h = personSeed(id);
  const roll = seededRandom(h * 0.017);
  // 42% have never been matched at all. On a four-camera fleet that is the ordinary case, and it is
  // what makes the sortable column worth having.
  if (roll < 0.42) return undefined;
  const spread = seededRandom(h * 0.041 + 7.3);
  const daysAgo = roll < 0.52 ? Math.floor(spread * 7)          // this week
    : roll < 0.64 ? 7 + Math.floor(spread * 7)                  // the week before
    : roll < 0.80 ? 14 + Math.floor(spread * 16)                // the rest of the month
    : 30 + Math.floor(spread * 150);                            // one to six months ago
  const day = SEED_TODAY - daysAgo * 86_400_000;
  const enrolled = Date.parse(registeredAt);
  if (Number.isFinite(enrolled) && day < enrolled) return undefined;
  return new Date(day).toISOString().slice(0, 10);
}

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
      // Attributed through the camera that detected them, which is the same rule detections use.
      // Without this these rows carried no site at all, so the app — once it started scoping to
      // one site — would have shown an empty VIP list while the detections were still arriving.
      projectId: projectIdForCameraId(cameraIdForLocation(e.location), CAMERAS),
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
    // Two today and one yesterday, so the Overview's "2 today · 1 yesterday" pair has something to
    // report. Fixed dates against SEED_TODAY, like every other seeded date in this file — they read
    // as today only while the mock is looked at on that day, which is the same bargain the
    // registration dates below already make.
    { id: "person-portal-0a", name: "Nadia Rahman", type: "VIP", photoUrl: getFacePhoto("person-portal-0a"), registeredAt: "2026-09-09T09:12:00+08:00", projectId: "proj-sg", priorityLabel: "normal" },
    { id: "person-portal-0b", name: "Terence Goh", type: "VIP", photoUrl: getFacePhoto("person-portal-0b"), registeredAt: "2026-09-09T08:40:00+08:00", projectId: "proj-sg", priorityLabel: "high", groupId: "pgroup-1" },
    { id: "person-portal-0c", name: "Farah Idris", type: "VIP", photoUrl: getFacePhoto("person-portal-0c"), registeredAt: "2026-09-08T16:05:00+08:00", projectId: "proj-sg", priorityLabel: "normal" },
    { id: "person-portal-1", name: "Michael Tan", type: "VIP", photoUrl: getFacePhoto("person-portal-1"), registeredAt: "2026-09-01T14:32:00+08:00", lastDetectedAt: "2026-09-08", projectId: "proj-sg", priorityLabel: "high", groupId: "pgroup-1" },
    { id: "person-portal-2", name: "Sarah Lim", type: "VIP", photoUrl: getFacePhoto("person-portal-2"), registeredAt: "2026-08-30T09:05:00+08:00", lastDetectedAt: "2026-09-03", projectId: "proj-sg", priorityLabel: "normal", groupId: "pgroup-1" },
    { id: "person-portal-3", name: "David Ho", type: "VIP", photoUrl: getFacePhoto("person-portal-3"), registeredAt: "2026-08-28T17:48:00+08:00", lastDetectedAt: "2026-08-29", projectId: "proj-sg", priorityLabel: "very_high", groupId: "pgroup-2" },
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
      lastDetectedAt: seededLastDetectedAt(id, day.toISOString().slice(0, 10)),
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
let watchlistCategorySeq = 0;
let searchPurposeSeq = 0;
let searchAccessSeq = 0;

/**
 * An audit entry for a change to the institution's own policy lists.
 *
 * Filed against the team, not a project — see AuditEvent.teamId. "Who changed the list of
 * acceptable reasons to look somebody up" is the question these entries exist to answer, and it is
 * asked of the institution rather than of one site.
 */
function policyAudit(teamId: string | undefined, message: string): AuditEvent {
  return { id: `audit-${++auditSeq}`, teamId, message, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
}
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
 *     detectedPrev7d: id[],    // the same, for the seven days before that
 *   }
 *
 * The first three are defects with different causes and different fixes (upload a photo, replace a
 * bad photo, merge two rows), which is why they are three lists and not one number. The last two
 * are not defects: they are the reach of the list, and they are here because a watchlist nobody
 * ever matches is the quietest way this product fails.
 *
 * WHY TWO WINDOWS. One number cannot answer the question the figure is for. "9 of 104 seen this
 * week" is a normal week if the VIPs simply did not come, and a dead camera fleet if it was 40
 * last week — the reader cannot tell those apart, and they are the same screen with opposite
 * meanings. The previous window is the cheapest thing that separates them, and it is a second
 * range over the same query rather than a time series: two counts, not a chart.
 *
 * Both windows are seven calendar days in the project's timezone, back to back, so the two are
 * comparable without the client doing arithmetic on timestamps. Ids rather than counts, because
 * the page filters its table to the rows behind the figure.
 *
 * Seeded deterministically, like everything else in this file.
 */
export interface RegistryHealth {
  missingPhoto: string[];
  embeddingFailed: string[];
  /** Photo replaced, waiting on the model's answer. See Person.reenrolledAt. */
  reenrolling: string[];
  duplicates: [string, string][];
  detectedLast7d: string[];
  detectedPrev7d: string[];
}

export function registryHealth(projectId: string, persons: Person[]): RegistryHealth {
  const rows = persons.filter(p => p.projectId === projectId);
  const missingPhoto: string[] = [];
  const embeddingFailed: string[] = [];
  // Re-submitted and waiting on the model. Separated from embeddingFailed rather than dropped
  // from it: the count going down on a save would claim the new photo works, which nothing here
  // knows. See Person.reenrolledAt.
  const reenrolling: string[] = [];
  // Derived from Person.lastDetectedAt rather than rolled here, so the figure in the summary and
  // the date in the table row can never tell different stories about the same person.
  const detectedLast7d: string[] = [];
  const detectedPrev7d: string[] = [];
  rows.forEach((p, i) => {
    // Not seeded: a person with no photoUrl has no enrolled face, full stop. The CSV import is
    // where they come from, and this reads the same field the table draws from — so the figure and
    // the rows behind it can never disagree.
    if (!p.photoUrl) { missingPhoto.push(p.id); return; }
    if (seededPhotoUnreadable(p.id)) {
      if (p.reenrolledAt) reenrolling.push(p.id);
      else embeddingFailed.push(p.id);
    }
    // Only rows with a usable face can have been seen. Letting an unmatchable person appear in
    // the detected list would make the two figures on the page contradict each other.
    else {
      const seenDaysAgo = p.lastDetectedAt
        ? Math.floor((SEED_TODAY - Date.parse(p.lastDetectedAt)) / 86_400_000)
        : Infinity;
      if (seenDaysAgo < 7) detectedLast7d.push(p.id);
      // Whoever was last seen 7-13 days ago was certainly in the previous window, plus a share of
      // the people seen this week who also came the week before. That second group is the part
      // lastDetectedAt cannot answer — it only remembers the most recent match — which is why the
      // API asks the backend for the previous window rather than deriving it here.
      if ((seenDaysAgo >= 7 && seenDaysAgo < 14) || (seenDaysAgo < 7 && seededRandom(i * 7.93 + 2.7) > 0.45)) {
        detectedPrev7d.push(p.id);
      }
    }
  });
  // Pairs, not a count: a duplicate is two rows, and the fix is choosing which one to keep.
  const duplicates: [string, string][] = [];
  for (let i = 0; i + 1 < rows.length && duplicates.length < 2; i += 1) {
    if (seededRandom(i * 8.19 + 3.3) > 0.96) duplicates.push([rows[i].id, rows[i + 1].id]);
  }
  return { missingPhoto, embeddingFailed, reenrolling, duplicates, detectedLast7d, detectedPrev7d };
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
  // watchlists get edited, servers get reconfigured.
  //
  // Every line here names an action Portal can actually perform, and is worded the way that
  // action words itself when it writes its own entry. Four of them did not: "Face recognition
  // enabled on 4 cameras" (per-camera engines were removed on 2026-09-09), "Server FR 2
  // restarted" (no restart control exists), "Retention period changed from 30 to 60 days" (no
  // retention control exists) and "Mail server verified" (saving mail settings verifies
  // nothing). This is the same trap ACCESS_REQUESTS was emptied to avoid — a seeded row that
  // cannot occur teaches whoever reads the screen that the product does something it does not,
  // and the audit log is the one screen a customer reads to find out what happened.
  { id: "audit-5", projectId: "proj-sg", message: "Camera CAM-BLK-019 added to zone August", actor: "Marcus Lee", at: auditAt(320) },
  { id: "audit-6", projectId: "proj-sg", message: "VIP group \"Executive Protection\" created", actor: "Grace Tan", at: auditAt(400) },
  { id: "audit-7", projectId: "proj-sg", message: "Aaron Sim invited as auditor", actor: "Grace Tan", at: auditAt(690) },
  { id: "audit-8", projectId: "proj-sg", message: "4 cameras in Bugis assigned to server FR 2", actor: "Marcus Lee", at: auditAt(1080) },
  { id: "audit-9", projectId: "proj-sg", message: "Server FR 2 updated", actor: "Wei Chen", at: auditAt(1500) },
  { id: "audit-10", projectId: "proj-sg", message: "VIP Sarah Lim's priority raised to High", actor: "Grace Tan", at: auditAt(2160) },
  { id: "audit-11", projectId: "proj-sg", message: "Camera CAM-BDK-001 stream credentials rotated", actor: "Marcus Lee", at: auditAt(2880) },
  { id: "audit-12", projectId: "proj-sg", message: "Registration codes issued to 6 staff", actor: "Grace Tan", at: auditAt(3600) },
  { id: "audit-13", projectId: "proj-sg", message: "Project timezone set to Asia/Singapore", actor: "Grace Tan", at: auditAt(4320) },
  { id: "audit-14", projectId: "proj-sg", message: "Camera CAM-QTN-001 renamed to Queenstown", actor: "Wei Chen", at: auditAt(5760) },
  { id: "audit-15", projectId: "proj-sg", message: "Marcus Lee granted app access", actor: "Grace Tan", at: auditAt(7200) },
  { id: "audit-16", projectId: "proj-sg", message: "VIP watchlist exported to CSV", actor: "Aaron Sim", at: auditAt(8640) },
  { id: "audit-17", projectId: "proj-sg", message: "Project mail settings updated", actor: "Wei Chen", at: auditAt(10080) },
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
  // No seed. An institution defines its own; a shipped default would become the standard.
  watchlistCategories: [],
  searchPurposes: [],
  searchPurpose: null,
  // No seed. These are events, and an installation that has run no searches has none.
  searchAccessLog: [],
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addCamera: (camera) =>
    set(state => ({
      cameras: [...state.cameras, { ...camera, id: `cam-${++cameraSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: camera.projectId, message: `Camera ${camera.name} added`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  updateCamera: (cameraId, updates) =>
    set(state => {
      const cam = state.cameras.find(c => c.id === cameraId);
      if (!cam) return state;
      // Adding and removing a camera both logged; editing one did not — and re-pointing a
      // camera at a different stream is exactly the change an investigation asks about. The
      // seeded log even carries "Camera CAM-NOV-001 RTSP URL updated", so the customer learns
      // to expect a line that was never written.
      const streamChanged = updates.rtspUrl !== undefined && updates.rtspUrl !== cam.rtspUrl;
      return {
        cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, ...updates } : c)),
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: cam.projectId,
          message: streamChanged
            ? `Camera ${updates.name ?? cam.name} stream address changed`
            : `Camera ${updates.name ?? cam.name} updated`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeCamera: (cameraId) =>
    set(state => {
      const cam = state.cameras.find(c => c.id === cameraId);
      const auditEntry: AuditEvent = { id: `audit-${++auditSeq}`, projectId: cam?.projectId, message: `Camera ${cam?.name ?? cameraId} removed`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() };
      return {
        cameras: state.cameras.filter(c => c.id !== cameraId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addProject: (project) =>
    set(state => ({
      projects: [...state.projects, { ...project, id: `proj-${++projectSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, teamId: project.teamId, message: `Project created: ${project.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  renameProject: (projectId, name) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project || project.name === name) return state;
      return {
        projects: state.projects.map(p => (p.id === projectId ? { ...p, name } : p)),
        // Both names in the message. A rename read a year later is unreadable without the old
        // one — "Project renamed to Bugis North" does not say which project that was.
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId,
          message: `Project renamed: ${project.name} → ${name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeProject: (projectId) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return state;
      const personIds = new Set(state.persons.filter(p => p.projectId === projectId).map(p => p.id));
      return {
        projects: state.projects.filter(p => p.id !== projectId),
        cameras: state.cameras.filter(c => c.projectId !== projectId),
        uploads: state.uploads.filter(u => u.projectId !== projectId),
        servers: state.servers.filter(sv => sv.projectId !== projectId),
        persons: state.persons.filter(p => p.projectId !== projectId),
        personGroups: state.personGroups.filter(g => g.projectId !== projectId),
        staffRoster: state.staffRoster.filter(r => r.projectId !== projectId),
        accessRequests: state.accessRequests.filter(r => r.projectId !== projectId),
        // Detections of the people who were on this site's watchlist. personId is optional —
        // an unidentified detection belongs to no person and is left alone.
        events: state.events.filter(e => e.personId === undefined || !personIds.has(e.personId)),
        // searchAccessLog is NOT in the list above, and that is the point.
        //
        // It was, until 2026-09-10 — a project deletion took every "who looked up whom, when, and
        // on what stated grounds" with it. Fourteen lines down this same function keeps the audit
        // log on the grounds that "a deletion that erases the record of everything that led up to
        // it is not a deletion, it is a cover-up". That argument is stronger here, not weaker:
        // this is a face-recognition product, and these rows are the only record that a named
        // person was searched for. Closing a site is exactly when someone would want them gone.
        //
        // The rows keep their projectId, pointing at a project that no longer exists, and their
        // teamId — which SearchAccessRecord carries precisely so an auditor can read across the
        // sites an institution runs.
        //
        // HANDOFF NOTE: two things follow for the server. It must not cascade-delete these with
        // the project either; and no screen reads them once the project is gone, because
        // ProjectSearchLogTab filters by projectId. A team-level view (or a retention policy that
        // says out loud how long they are kept) is the missing half — see the deletion-scope
        // question in the product review.
        //
        // Accounts belong to the team, not the project. Somebody who worked at one site and two
        // others keeps the other two; somebody who worked only here keeps an account with an
        // empty list, which the Users page shows and an administrator can act on. Deleting
        // people because a site closed is not the same decision as closing the site.
        portalUsers: state.portalUsers.map(u => (
          u.projectIds.includes(projectId) ? { ...u, projectIds: u.projectIds.filter(id => id !== projectId) } : u
        )),
        // The audit entries stay, re-filed under the team so they remain readable somewhere.
        // A deletion that erases the record of everything that led up to it is not a deletion,
        // it is a cover-up, and the audit log is the one screen that has to survive this.
        auditLog: [{
          id: `audit-${++auditSeq}`, teamId: project.teamId,
          message: `Project deleted: ${project.name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog.map(a => (
          a.projectId === projectId ? { ...a, projectId: undefined, teamId: project.teamId } : a
        ))].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  // Mail settings write to the audit log the way license changes do — an admin changing where
  // invites are sent is exactly the kind of thing someone has to be able to trace later.
  setProjectTimeZone: (projectId, timeZone) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, timeZone } : p)),
      // Audited: which day a detection is filed under, when a report covers, and what "today"
      // means on every screen all move when this changes.
      auditLog: [
        // ++auditSeq, not Date.now(): two changes inside one millisecond produced duplicate
        // React keys. And sliced like every other writer — this was the one that could grow the
        // log past the ceiling the Activity screen prints.
        { id: `audit-${++auditSeq}`, projectId, message: `Project timezone set to ${timeZone}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() },
        ...state.auditLog,
      ].slice(0, AUDIT_LOG_LIMIT),
    })),

  updateProjectMail: (projectId, updates) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
      auditLog: [{ id: `audit-${++auditSeq}`, projectId, message: `Project mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  // This flips which mailbox invites/resets go through, same audit-worthy weight as updateProjectMail.
  setNetworkIsolationOverride: (projectId, override) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, networkIsolatedOverride: override } : p)),
      auditLog: [{
        id: `audit-${++auditSeq}`, projectId,
        message: override === null ? "Network reachability reset to auto-detection" : `Network reachability manually set to ${override ? "internet-isolated" : "internet-connected"}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  updateTeamMail: (teamId, updates) =>
    set(state => ({
      teams: state.teams.map(o => (o.id === teamId ? { ...o, ...updates } : o)),
      auditLog: [{ id: `audit-${++auditSeq}`, message: `Team mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  addPerson: (person) =>
    set(state => ({
      persons: [...state.persons, { registeredBy: SIGNED_IN_USER.name, ...person, id: `person-${++personSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: person.projectId, message: `VIP ${person.name} registered`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  addPersons: (persons, source) => {
    if (persons.length === 0) return 0;
    set(state => ({
      persons: [...state.persons, ...persons.map(pp => ({ registeredBy: SIGNED_IN_USER.name, ...pp, id: `person-${++personSeq}` }))],
      auditLog: [{
        id: `audit-${++auditSeq}`, projectId: persons[0].projectId,
        message: `${persons.length} ${persons.length === 1 ? "person" : "people"} imported from ${source}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return persons.length;
  },
  removePerson: (personId) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      // The one mutation in this store that wrote no audit entry. Registering, editing, releasing
      // and grouping all logged; erasing an enrolled face record — the single most consequential
      // thing that can be done to this registry, and the one an audit is most likely to ask
      // about — left nothing behind at all.
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: person?.projectId,
        // The name is snapshotted into the message because the row it names is about to stop
        // existing — the same reason the group and camera removals word themselves this way.
        message: `VIP ${person?.name ?? personId} deleted from the watchlist`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        persons: state.persons.filter(p => p.id !== personId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  releasePerson: (personId, reason) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const at = new Date().toISOString();
      return {
        persons: state.persons.map(p => (p.id === personId ? { ...p, releasedAt: at, releaseReason: reason } : p)),
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: person.projectId,
          message: `VIP ${person.name} released — ${reason}`,
          actor: SIGNED_IN_USER.name, at,
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  reinstatePerson: (personId, reason) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person || !person.releasedAt) return {};
      const at = new Date().toISOString();
      // The old release date goes into the message before it is cleared off the row. The row
      // holds the current state; the log holds the history, and "when did this person go back
      // on the list, and how long had they been off it" is only answerable if both are written.
      const wasReleasedOn = person.releasedAt.slice(0, 10);
      return {
        persons: state.persons.map(p => (
          p.id === personId ? { ...p, releasedAt: undefined, releaseReason: undefined } : p
        )),
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: person.projectId,
          message: `VIP ${person.name} reinstated (released ${wasReleasedOn}) — ${reason}`,
          actor: SIGNED_IN_USER.name, at,
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addSearchPurpose: (purpose) => {
    const id = `spurpose-${++searchPurposeSeq}`;
    set(state => ({
      searchPurposes: [...state.searchPurposes, { ...purpose, id, archived: false }],
      auditLog: [policyAudit(purpose.teamId, `Search purpose "${purpose.label}" created`), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updateSearchPurpose: (purposeId, updates) =>
    set(state => ({
      searchPurposes: state.searchPurposes.map(p => (p.id === purposeId ? { ...p, ...updates } : p)),
      auditLog: [policyAudit(
        state.searchPurposes.find(p => p.id === purposeId)?.teamId,
        `Search purpose "${updates.label ?? state.searchPurposes.find(p => p.id === purposeId)?.label ?? purposeId}" changed`,
      ), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  archiveSearchPurpose: (purposeId) =>
    set(state => ({
      searchPurposes: state.searchPurposes.map(p => (p.id === purposeId ? { ...p, archived: true } : p)),
      auditLog: [policyAudit(
        state.searchPurposes.find(p => p.id === purposeId)?.teamId,
        `Search purpose "${state.searchPurposes.find(p => p.id === purposeId)?.label ?? purposeId}" retired`,
      ), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  // Not called from anywhere in src/ yet — the app's purpose gate is deferred to v2, the same
  // as recordSearchAccess (see the note in ProjectSearchLogTab). Kept, not deleted: the store
  // side of that feature is finished and re-deriving it later is the waste.
  setSearchPurpose: (selection) => set({ searchPurpose: selection }),
  recordSearchAccess: (record) =>
    set(state => ({
      // Newest first, and no cap here. The audit log is trimmed to 200 because it is a convenience
      // feed; this one is the record somebody is answerable for, and silently dropping the oldest
      // entries is how a log stops being evidence. Retention belongs to the server.
      searchAccessLog: [{ ...record, id: `saccess-${++searchAccessSeq}` }, ...state.searchAccessLog],
    })),
  addWatchlistCategory: (category) => {
    const id = `wcat-${++watchlistCategorySeq}`;
    set(state => ({
      watchlistCategories: [...state.watchlistCategories, { ...category, id, archived: false }],
      auditLog: [policyAudit(category.teamId, `Watchlist category "${category.label}" created`), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updateWatchlistCategory: (categoryId, updates) =>
    set(state => {
      const before = state.watchlistCategories.find(c => c.id === categoryId);
      if (!before) return {};
      return {
        watchlistCategories: state.watchlistCategories.map(c => (c.id === categoryId ? { ...c, ...updates } : c)),
        auditLog: [policyAudit(before.teamId, `Watchlist category "${updates.label ?? before.label}" changed`), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  archiveWatchlistCategory: (categoryId) =>
    set(state => {
      const before = state.watchlistCategories.find(c => c.id === categoryId);
      if (!before) return {};
      return {
        watchlistCategories: state.watchlistCategories.map(c => (c.id === categoryId ? { ...c, archived: true } : c)),
        auditLog: [policyAudit(before.teamId, `Watchlist category "${before.label}" retired`), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  updatePerson: (personId, updates) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const at = new Date().toISOString();
      // Replacing the face is a different act from correcting a name, and until now the registry
      // could not tell them apart: an admin opened a person flagged "photo unreadable", uploaded
      // a clean picture, saved — and the flag, the count and the unmatchable row were unchanged.
      // See Person.reenrolledAt. It records that the question was re-asked, not that the answer
      // came back good.
      const photoReplaced = updates.photoUrl !== undefined && updates.photoUrl !== person.photoUrl;
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: person.projectId,
        message: photoReplaced
          ? `VIP photo replaced for re-enrolment: ${updates.name ?? person.name}`
          : `VIP updated: ${updates.name ?? person.name}`,
        actor: SIGNED_IN_USER.name, at,
      };
      return {
        persons: state.persons.map(p => (
          p.id === personId ? { ...p, ...updates, ...(photoReplaced ? { reenrolledAt: at } : null) } : p
        )),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addPersonGroup: (group) => {
    const id = `pgroup-${++personGroupSeq}`;
    set(state => ({
      personGroups: [...state.personGroups, { ...group, id }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: group.projectId, message: `VIP group created: ${group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updatePersonGroup: (groupId, updates) =>
    set(state => {
      const group = state.personGroups.find(g => g.id === groupId);
      if (!group) return {};
      return {
        personGroups: state.personGroups.map(g => (g.id === groupId ? { ...g, ...updates } : g)),
        auditLog: [{ id: `audit-${++auditSeq}`, projectId: group.projectId, message: `VIP group updated: ${updates.name ?? group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      // Losing the app takes person search with it. appSearch is a grant on a surface the
      // account can no longer reach, and the row went on showing its "Search on" badge — the
      // most sensitive grant in the product reading as live on somebody who cannot use it.
      // Logged separately, because granting and revoking it is its own audited act.
      const at = new Date().toISOString();
      const searchDropped = !appAccess && user?.appSearch === true;
      const entries: AuditEvent[] = [{
        id: `audit-${++auditSeq}`, projectId: user?.projectIds[0],
        message: `${user?.name ?? userId} may now use ${where} (role: ${permission})`,
        actor: SIGNED_IN_USER.name, at,
      }];
      if (searchDropped) {
        entries.unshift({
          id: `audit-${++auditSeq}`, projectId: user?.projectIds[0],
          message: `Person search revoked with app access: ${user?.name ?? userId}`,
          actor: SIGNED_IN_USER.name, at,
        });
      }
      return {
        portalUsers: state.portalUsers.map(u => (
          u.id === userId ? { ...u, permission, appAccess, ...(appAccess ? null : { appSearch: false }) } : u
        )),
        auditLog: [...entries, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  updatePortalUserProjects: (userId, projectIds) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      if (!user) return state;
      // Named, not counted. "3 projects" a year later says nothing; which site somebody was let
      // into or out of is the whole question an access review asks.
      const nameOf = (id: string) => state.projects.find(p => p.id === id)?.name ?? id;
      const added = projectIds.filter(id => !user.projectIds.includes(id)).map(nameOf);
      const removed = user.projectIds.filter(id => !projectIds.includes(id)).map(nameOf);
      if (added.length === 0 && removed.length === 0) return state;
      const parts = [
        added.length ? `+${added.join(", ")}` : "",
        removed.length ? `−${removed.join(", ")}` : "",
      ].filter(Boolean).join(" ");
      const auditEntry: AuditEvent = {
        id: `audit-${++auditSeq}`, projectId: user.projectIds[0],
        message: `${user.name}'s projects changed: ${parts}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      };
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, projectIds } : u)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
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
      auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [...auditEntries, ...s.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return newUsers.map(u => u.id);
  },
  dismissAccessRequest: (requestId) =>
    set(state => ({ accessRequests: state.accessRequests.filter(r => r.id !== requestId) })),
  addTeam: (team) => {
    const id = `team-${++orgSeq}`;
    set(state => ({
      teams: [...state.teams, { ...team, id }],
      auditLog: [{ id: `audit-${++auditSeq}`, teamId: id, message: `Team created: ${team.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  renameTeam: (teamId, name) =>
    set(state => {
      const team = state.teams.find(o => o.id === teamId);
      if (!team || team.name === name) return state;
      return {
        teams: state.teams.map(o => (o.id === teamId ? { ...o, name } : o)),
        auditLog: [{
          id: `audit-${++auditSeq}`, teamId,
          message: `Team renamed: ${team.name} → ${name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeTeam: (teamId) =>
    set(state => {
      const team = state.teams.find(o => o.id === teamId);
      if (!team) return state;
      // Refused while it still holds projects, and the UI refuses first with a reason on it.
      // Cascading a team would delete several sites at once from a dropdown, which is not a
      // decision anybody should be able to take in one gesture — each project is deleted from
      // its own Settings screen, where what is about to go is listed.
      if (state.projects.some(p => p.teamId === teamId)) return state;
      // And never at the cost of the last owner. updatePortalUserStatus, updatePortalUserPermission,
      // updatePortalUserAccess and removePortalUser all refuse exactly this outcome because there
      // is no recovery path from an installation nobody can grant permissions in — and this
      // action reached it by the side door, by deleting the container the account sits in.
      const survivors = state.portalUsers.filter(u => u.teamId !== teamId);
      const ownersLeft = survivors.filter(u => u.permission === "owner" && u.status === "active").length;
      if (ownersLeft === 0 && state.portalUsers.some(u => u.teamId === teamId && u.permission === "owner" && u.status === "active")) {
        return state;
      }
      return {
        teams: state.teams.filter(o => o.id !== teamId),
        // Accounts filed under a team with no projects have nothing left to open. Removed with
        // it rather than left pointing at a team that is gone.
        portalUsers: state.portalUsers.filter(u => u.teamId !== teamId),
        watchlistCategories: state.watchlistCategories.filter(c => c.teamId !== teamId),
        searchPurposes: state.searchPurposes.filter(sp => sp.teamId !== teamId),
        auditLog: [{
          id: `audit-${++auditSeq}`,
          message: `Team deleted: ${team.name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  /*
   * Infrastructure changes are audited, like everything else that changes a deployment.
   * These three were the only mutations in the store that wrote nothing at all, so the Activity
   * log — the screen an auditor opens to find out what changed — never showed a server being
   * added, re-pointed or removed.
   */
  addServer: (server) =>
    set(state => ({
      servers: [...state.servers, { ...server, id: `srv-${++serverSeq}` }],
      auditLog: [{ id: `audit-${++auditSeq}`, projectId: server.projectId, message: `Server ${server.name} added`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  updateServer: (serverId, updates) =>
    set(state => {
      const server = state.servers.find(s => s.id === serverId);
      if (!server) return state;
      return {
        servers: state.servers.map(s => (s.id === serverId ? { ...s, ...updates } : s)),
        auditLog: [{ id: `audit-${++auditSeq}`, projectId: server.projectId, message: `Server ${updates.name ?? server.name} updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeServer: (serverId) =>
    set(state => {
      const server = state.servers.find(s => s.id === serverId);
      if (!server) return state;
      // Cameras that pointed at it are unassigned, not left holding a dead id. They were: the
      // table then printed an em dash in the "assigned" colour, and re-opening the camera's
      // edit form and saving wrote the dangling id straight back.
      const orphaned = state.cameras.filter(c => c.serverId === serverId).length;
      return {
        servers: state.servers.filter(s => s.id !== serverId),
        cameras: state.cameras.map(c => (c.serverId === serverId ? { ...c, serverId: undefined } : c)),
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: server.projectId,
          message: orphaned > 0
            ? `Server ${server.name} removed — ${orphaned} camera${orphaned === 1 ? "" : "s"} left unassigned`
            : `Server ${server.name} removed`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
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
      return { staffRoster, auditLog: [...auditEntries, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT) };
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [auditEntry, ...s2.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return true;
  },
  addRosterEntries: (entries, source) => {
    const rejected: string[] = [];
    const taken = new Set(get().staffRoster.map(r => r.employeeId.toLowerCase()));
    const accepted: RosterEntry[] = [];
    entries.forEach(e => {
      const key = e.employeeId.toLowerCase();
      // The same duplicate rule addRosterEntry applies, and it has to see rows accepted moments
      // ago in this very call — which is why `taken` grows as we go.
      if (taken.has(key)) { rejected.push(e.employeeId); return; }
      taken.add(key);
      accepted.push({ ...e, status: "not-issued" as const });
    });
    if (accepted.length > 0) {
      set(state => ({
        staffRoster: [...state.staffRoster, ...accepted],
        auditLog: [{
          id: `audit-${++auditSeq}`, projectId: accepted[0].projectId,
          message: `${accepted.length} roster ${accepted.length === 1 ? "entry" : "entries"} imported from ${source}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      }));
    }
    return rejected;
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      return { auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT) };
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

/**
 * Tells lib/time.ts which site's clock to use.
 *
 * Registered here rather than in a screen because everything imports this store, so it runs
 * before anything renders — and it has to be here rather than inside time.ts, which cannot import
 * this file (this file imports it). Every date bucket, hour bucket and clock string in the app
 * resolves through this one function.
 *
 * The seed constants above are computed while this module is still evaluating, so they are already
 * fixed by the time this line runs. That is why time.ts pins its mock stamp loop to the fallback
 * zone instead — see the note there.
 */
setSiteTimeZoneResolver(() => {
  const state = useVcaStore.getState();
  return resolveActiveProject(state.activeProjectId, state.portalUsers, state.projects)?.timeZone
    ?? FALLBACK_TIME_ZONE;
});
