import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { liveEvents, registrySeedEvents, getFacePhoto, DISTRICTS, districtIdAt, type EventType, type LiveEvent, type TrackingHop } from "@/lib/mockData";
import type { AuditArea } from "@/lib/auditAreas";
/* Value import, and safe: appGrants takes only TYPES from this module, so nothing of it
   survives to the bundle and there is no cycle at run time. */
import { APP_GRANT_LABELS } from "@/lib/appGrants";
import {
  isTodaySgt, recentSgtStamp, parseSgtStamp,
  setSiteTimeZoneResolver, FALLBACK_TIME_ZONE,
} from "@/lib/time";
import { effectiveCodeStatus, generateRegistrationCode, type RosterEntry } from "@/lib/staffRoster";
import { generateTemporaryPassword } from "@/lib/password";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { dateKeyIn } from "@/lib/time";

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

// PRICE_PER_CHANNEL_PER_YEAR was here — a flat 100 multiplied by the channel count and printed as
// "$10,000/yr" in the fees clause of the licence card. It had no source: LicensePayload carries no
// fee field, so nothing in the product ever knew a price. Removed rather than moved. The comment
// also claimed Overview's CHANNELS cell used it; it did not, and had not for some time.

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
   * Whether the live view and the saved frames carry the viewer's name and the time on them.
   *
   * ABSENT MEANS ON (2026-09-23, owner: 혹시 이것도 뺄 수 있게 포탈에 설정을 넣어야 할까 → 넣되
   * 기본은 켜짐). A watermark cannot stop a screenshot — no browser can, and a phone camera beats
   * every native trick — so what it buys is not prevention but attribution: a still that leaks
   * says whose session it was taken from. Default-off would mean nobody turns it on, and the one
   * screen that most needs it (a face on a live feed) is the one people photograph.
   *
   * It is switchable because of the control room: a wall display is watched by a shift, not by the
   * account whose session drives it, so the name on it would be a claim about the wrong person.
   * Per project, like `timeZone`, because the policy belongs to the site — and turning it OFF is
   * audited, since removing a traceability control is itself a decision somebody made.
   */
  evidenceWatermark?: boolean;
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
  /**
   * How long recordings are kept at this site, in days.
   *
   * A number that ends up in an ordinance, a contract and a privacy notice, and until now the
   * product had nowhere to put it — so it lived in whoever set up the recorder. The audit log
   * seed even carried "Retention period changed from 30 to 60 days" for a control that did not
   * exist; that line was removed as a fabrication, and this is the control it was pretending to
   * describe.
   *
   * Optional and unset by default. There is no safe default to pick: 30 days is a guess, and a
   * guessed retention is either an illegal over-hold or a deletion nobody agreed to. Unset reads
   * as "not decided" on screen, which is the truth for a site nobody has configured.
   *
   * HANDOFF NOTE: recording the policy is NOT enforcing it. Nothing in this front end deletes a
   * frame, and it never will — the recorder and the server own expiry. What this value has to do
   * is reach them: the console is where a customer states the number, and the deletion job is
   * where it takes effect. Until that call exists, the screen says so out loud rather than
   * letting "saved" read as "footage is now being deleted on this schedule".
   */
  retentionDays?: number;
  /**
   * How many days a VIP listing lasts at this site, unless the registrar shortens it or a category
   * says otherwise. Absent means the site has not decided, and then the deployment default in
   * complianceConfig applies (see vipRetentionDays() below).
   *
   * NOT the same kind of value as `retentionDays` beside it, and the difference is worth stating:
   * recording retention is a number this console only WRITES DOWN — nothing here deletes video.
   * This one ACTS. It fills the end date on every registration, and an expired listing stops
   * raising detections in the app (watchedPersonsInProject). So the screen may promise something
   * for this one, where for the other it may not.
   */
  vipRetentionDays?: number;
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

/**
 * Normal or AI, which is the FIRST thing the previous product's Add New Camera screen asked.
 *
 * It matters because a camera's kind decides which server it can report to: an AI camera runs the
 * analysis on the device and reports results, so it belongs to the AI Camera node; a normal camera
 * hands over a stream for something else to analyse, so it belongs to a Normal Camera or a Face
 * Recognition node. Those server types already existed here (see ServerType) with nothing on the
 * camera side to pair them with, so nothing stopped a plain camera being attached to the AI node —
 * a combination the estate cannot actually run.
 *
 * Optional on the type, not on the form: rows carried over from an install that never asked have
 * no answer, and "normal" written in by default would be this file inventing the field's value for
 * somebody else's camera. Readers treat absent as normal and say so where it shows.
 */
export type CameraKind = "normal" | "ai";

export interface Camera {
  id: string;
  projectId: string;
  code: string;
  name: string;
  /** See CameraKind. Absent on rows registered before the field existed. */
  kind?: CameraKind;
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
  /**
   * The last frame the server captured. OPTIONAL — a camera registered through Portal has none.
   *
   * It was required, so the add form filled it with a stock photo of an office corridor on the
   * same line that wrote `status: "offline"`, and the cards then captioned it 최근 프레임. An
   * installer saw a picture under "last frame" and read it as the cabling working. Same shape as
   * lat/lng above: a required field made the code invent a value, so the fix is in the type.
   */
  thumbnail?: string;
  /**
   * Where it is, when somebody has surveyed it. ABSENT IS A REAL STATE, not zero.
   *
   * These were required, so the two doors that register cameras both wrote `?? 0` for a camera
   * whose position nobody had measured yet — and 0,0 is a real coordinate in the Gulf of Guinea.
   * The Add form's own comment already warned about exactly this ("a camera silently placed in
   * the Gulf of Guinea rather than a form saying the number is wrong") and then the CSV import
   * did it anyway, for every row an installer had RTSP URLs but no survey for.
   *
   * The import is right to accept those rows — see cameraImport's note on why refusing them is
   * backwards. What it cannot do is invent a position. So absence is representable here, and
   * every map filters on `hasPosition` rather than drawing a pin in the Atlantic.
   */
  lat?: number;
  lng?: number;
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

/**
 * A KEY SOMEBODY'S INTEGRATION SIGNS ITS CALLS WITH.
 *
 * The API tab of the Server screen was four endpoint lines and a sentence admitting that issuing
 * and revoking keys did not exist. Every comparable console is the other way round: Verkada's
 * Organization Settings has a Verkada API tab whose whole content is the key list (+ New API Key,
 * with a name, read-only or read/write, an expiry, shown once, ten per organization, org admins
 * only) and the endpoint reference lives on a separate documentation site. A console's job with an
 * API is the credential, not the reference.
 *
 * WHAT THIS RECORD DOES NOT HOLD IS THE KEY. `prefix` is the leading characters, which is what a
 * list can show to tell two keys apart; the secret exists once, in the dialog that issued it. A
 * console that could show a key again would be a console worth stealing.
 *
 * `expiresAt` is a date or null, and null means no end date rather than unanswered — the dialog
 * makes the reader pick, so absence here is a choice somebody made.
 */
export interface ApiKey {
  id: string;
  projectId: string;
  name: string;
  scope: ApiKeyScope;
  /** The visible leading characters. The rest is never stored anywhere in the front end. */
  prefix: string;
  createdAt: string;
  createdBy: string;
  /** A date (YYYY-MM-DD), or null for a key with no end date. */
  expiresAt: string | null;
  /** Set when somebody revokes it. A revoked key stays on the list: the record of who could call
   *  what, and until when, is the reason an audit reads this screen at all. */
  revokedAt?: string;
}

export type ApiKeyScope = "read" | "readwrite";

/**
 * A NAMED SET OF CAMERAS, kept so that access can be given by the handful rather than one at a
 * time (owner, 2026-09-21: 볼수있는 카메라도 그룹지어서 권한을 주고싶거든 물론 카메라 한대만
 * 보는 사람도 있을 순 있지만).
 *
 * WHY NOT ZONE. The camera register already carries a `zone`, and reusing it was rejected on
 * 2026-09-16 for a reason that still holds: a zone is a label maintained for the map and the
 * daily ops list, so the day somebody corrects a camera's zone, an account's access moves with
 * it and nobody chose that. A group exists FOR access — it is created, named and audited as an
 * access object — so a change to it is a decision about access by definition.
 *
 * LIVING, NOT A BULK STAMP. Milestone's device groups are the other choice: there, "permissions
 * set via the group are not stored for the group but on the individual devices", so a camera
 * added to a group afterwards is NOT granted to the roles that hold it — a documented management
 * trap. Here a scope holds GROUP IDS, so adding a camera to a group does widen everyone who holds
 * that group. That is what a group is for, and the screen says so where the choice is made.
 *
 * Project-scoped: a group is a set of this site's cameras, and two sites do not share one.
 */
export interface CameraGroup {
  id: string;
  projectId: string;
  /** The customer's own word, never translated — see VipCategory.label. */
  label: string;
  /**
   * One line on what the group is for, written by whoever made it. OPTIONAL and absent by
   * default (2026-09-22): the name is already the way people say it out loud and the card lists
   * the member cameras, so most groups are recognisable without this. It earns its place on a
   * site with forty of them, where 「오차드 라인」 and 「오차드 외곽」 need telling apart. A group
   * with none renders nothing — no empty line, no placeholder standing in for an answer.
   *
   * The customer's own words, like `label`: never translated.
   */
  description?: string;
  cameraIds: string[];
  createdAt: string;
  createdBy: string;
}

/** Ten per project, the same ceiling Verkada puts on an organization. */
export const API_KEY_LIMIT = 10;

export type ApiKeyRefusal = "over-limit" | "duplicate-name";

/**
 * Which of the three states a key is in, or null-safe "not yet known".
 *
 * `todayKey` is passed in for the reason isExpired takes it: a day computed during render differs
 * between the server's HTML and the browser's first pass. Before the clock is read this answers
 * "unknown" and the screen prints the date with no verdict, rather than a verdict that changes in
 * front of the reader.
 */
export function apiKeyState(key: ApiKey, todayKey: string | null): "revoked" | "expired" | "active" | "unknown" {
  if (key.revokedAt) return "revoked";
  if (todayKey === null) return "unknown";
  if (key.expiresAt && key.expiresAt.slice(0, 10) < todayKey) return "expired";
  return "active";
}

export function apiKeysInProject(keys: ApiKey[], projectId: string): ApiKey[] {
  return keys.filter(k => k.projectId === projectId);
}

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
  /** Absent until somebody records one. Nothing on this screen reaches a server, so a node that
   *  was only just registered has no answer here — and "success" written in by default would be
   *  the screen inventing the one fact the reader came for. */
  status?: ServerStatus;
}

/**
 * Registered, and never heard from.
 *
 * `status: "offline"` answers "is it reachable now" and cannot tell apart a camera that went dark
 * this morning from one typed into Portal ten minutes ago. Those are opposite errands: the first
 * is a fault somebody has to go and fix, the second is the normal state every camera passes
 * through between being registered and its first report, and on installation day it is most of
 * the fleet. Counting them together makes the alarm say "58 offline" on the day nothing is wrong.
 *
 * `lastSeenAt` already carries the distinction — it is absent until a camera reports in — so this
 * needs no new field and no new value in CameraStatus. `error` is deliberately excluded: something
 * answered and refused, which means the address was reached.
 */
export function isAwaitingFirstContact(camera: Pick<Camera, "status" | "lastSeenAt">): boolean {
  return camera.status === "offline" && !camera.lastSeenAt;
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

// Person = the VIP registry. Portal owns registration/CRUD for this (see
// PortalVipRegistryTab) — VCA's own screens only ever read it, never write to it.
/**
 * A VIP registry category, defined by the institution rather than by us.
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
 *   GET/POST /teams/:id/vip-categories, PATCH /vip-categories/:id
 * Archive rather than delete, because registered people reference these by id.
 */
export interface VipCategory {
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
  color: VipCategoryColor;
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
 * Institution-defined for the same reason VIP registry categories are: a police control room and a
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
  /** The account that ran it, as a display name. */
  actor: string;
  /**
   * The address that name belongs to. NOT decoration — it is what makes the row identify somebody.
   *
   * A name alone cannot: two people called 김민수 produce rows an auditor cannot tell apart, and
   * "who looked this person up" is the one question this log exists to answer. Every comparable
   * audit log prints both (1Password, Dropbox, Vanta, Okta), and the filter keys off this rather
   * than the name for the same reason.
   *
   * HANDOFF NOTE: the server should carry a stable account id alongside this. An address can be
   * reassigned to a new employee, and a record from two years ago then names the wrong person —
   * which is exactly the failure a log kept as evidence must not have. The id is for identity, the
   * address is for reading; this mock has only the second.
   */
  actorEmail: string;
  /**
   * The stated purpose, when the installation asks for one.
   *
   * Optional, and that is a policy setting rather than a gap: with complianceConfig's
   * requireSearchPurpose off nobody was asked, so there is no purpose to record and writing one
   * in would be inventing a claim the operator never made. The log still answers the question an
   * audit opens with — who looked somebody up, and when.
   */
  purposeId?: string;
  /** The purpose's wording at the time — see the note above. */
  purposeLabel?: string;
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

/**
 * A person's call on one detection: this is them, or it is not.
 *
 * Kept apart from the audit log on purpose. The audit log records what an administrator did to
 * the system; this records what an operator concluded about a face, which is a different kind of
 * fact with a different reader. An auditor asks the first "who changed the retention period"; a
 * prosecutor, an ML engineer and the next shift all ask the second.
 *
 * It was component state until 2026-09-10 — a Set in the Redmap page — so a judgement lived until
 * the next search cleared it and was never attributed to anybody. Three things needed it to be a
 * record instead: a defence that a human reviewed the match, a signal for the model about what it
 * got wrong, and a handover so the next shift does not re-decide the same false positive.
 *
 * Both verdicts, not just the rejection. "Nobody has looked at this yet" and "somebody looked and
 * it is right" are different states, and a screen with only an exclude button cannot tell them
 * apart — which is exactly the question a shift handover asks.
 *
 * HANDOFF NOTE: lives in the store, so it survives moving around the app and does NOT survive a
 * refresh — the whole mock store is in memory. The server owns these: they are evidence, and the
 * write needs the operator's identity from the session rather than the browser's word for it.
 */
export type DetectionVerdict = "confirmed" | "false_positive";

export interface DetectionJudgement {
  id: string;
  /** Which screen the call was made on — the same subject id can exist on more than one. */
  surface: "redmap" | "redface";
  /** The sighting or node judged. Stable across searches: these are seeded record ids. */
  subjectId: string;
  /** Who the search was about, so a verdict belongs to an investigation and not to nothing. */
  targetLabel: string;
  verdict: DetectionVerdict;
  actor: string;
  at: string;
}

/** The one on a subject, or undefined if nobody has judged it. */
export function judgementFor(
  list: DetectionJudgement[],
  surface: DetectionJudgement["surface"],
  subjectId: string,
): DetectionJudgement | undefined {
  return list.find(j => j.surface === surface && j.subjectId === subjectId);
}

/**
 * A whole list taken out of Portal as a file.
 *
 * A DIFFERENT THING FROM the app's old evidence export (removed 2026-09-28): that was one
 * sighting, this is everybody. The VIP registry CSV carries every listed person's name, group,
 * basis, who registered them, expiry and last detection; the search-log CSV carries the audit
 * trail itself, IP addresses included.
 *
 * NO GATE GOES WITH THIS, and that is a decision rather than an omission. Two reasons:
 *
 * First, blocking it would block the auditor. That role exists to read "every Portal screen and
 * the audit log … for handover, inspection, and the customer's security officer" — taking the
 * records away from the person whose job is reading them inverts the role.
 *
 * Second, these five are a reformat of what is already on the screen. A blocked button leaves
 * screenshots and copy-paste, so the button is an inconvenience rather than a control.
 *
 * What was missing is not a door but a record — the console could not say a list had left it.
 *
 * HANDOFF NOTE: the browser writing its own
 * audit row is a note to ourselves; a client that writes it can skip writing it. These exports
 * have to go through the server, which logs before it returns the file.
 */
export interface ListExportRecord {
  id: string;
  /** The project whose log this lands in. Absent for a list that belongs to no single site. */
  projectId?: string;
  /** Which list left — the tab a reader would go back to. */
  list: "vips" | "searchLog" | "activity" | "roster" | "cameras";
  /** How many rows went, so the row says how much left without opening the file. */
  rowCount: number;
  actor: string;
  at: string;
}

export interface SearchPurposeSelection {
  purposeId: string;
  /** Case or document reference, when the purpose requires one. */
  reference?: string;
  note?: string;
  /** When it was declared — a sitting that started six hours ago is worth re-asking. */
  at: string;
}

/** The palette a category may take. Names, not values — see VipCategory.color. */
/**
 * The colours a VIP registry category may be given.
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
export const VIP_CATEGORY_COLORS = ["primary", "info", "teal", "magenta", "gray"] as const;

/**
 * Wider than the list above on purpose. Categories created before the palette was narrowed can
 * still carry a retired name, and a stored value that no longer type-checks is a crash rather
 * than a chip in the wrong colour — categoryTint still resolves all six.
 */
export type VipCategoryColor = "primary" | "info" | "teal" | "magenta" | "gray" | "danger" | "warning" | "success";

export interface Person {
  id: string;
  name: string;
  type: EventType;
  /**
   * The enrolled face, or absent.
   *
   * Optional because one path produces people without one: a CSV import carries names, not faces.
   * Those rows are on the VIP registry and cannot be matched by anything, which is a state the
   * registry has to be able to represent — the import used to paper over it by handing every row
   * a stock portrait, and a screen cannot warn about a problem the data denies having.
   */
  photoUrl?: string;
  /**
   * MORE OF THE SAME FACE. The enrolment set beyond the representative photo above.
   *
   * One picture is one angle under one light. A face recognition model matches better when it has
   * several of the same person — a straight-on shot, a slight turn, indoors and out — which is why
   * every product that enrols faces asks for more than one where it can (owner, 2026-09-18: 사실
   * 여러 장 있으면 더 좋긴 하잖아?).
   *
   * `photoUrl` stays what it is: the one face the table, the cards and the detail panel draw. This
   * is the rest of the set, and it is optional — a row registered from one photograph is a normal
   * row, not an incomplete one.
   *
   * WHAT IT IS NOT: a gallery of sightings. Everything in here is a picture somebody uploaded
   * deliberately to enrol this person, never a frame a camera captured — those live on the
   * detections and mean something else entirely.
   */
  enrolmentPhotoUrls?: string[];
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
   * works. A VIP registry rots quietly: contracts end, delegations fly home, and the row stays. The
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
   * When this registration stops. THREE STATES, and the third is the one that matters:
   *
   * - a date  — the listing stops then
   * - `null`  — somebody was asked and answered "no end date". A real answer for some categories.
   * - absent  — NOBODY WAS ASKED. Not an answer; a question still open on this row.
   *
   * The last two used to be the same stored value, and that collapse is what made the registry
   * unable to say anything useful about its own oldest rows. A row registered before this field
   * existed and a row where somebody deliberately chose "no end date" read identically, so the
   * console could neither warn about the first nor leave the second alone.
   *
   * ONE FIELD WITH THREE STATES, not a date plus a `noExpiry` flag. Two fields can disagree —
   * a row carrying both a date and "no expiry" is representable and means nothing — and somebody
   * would have to decide which wins, in every reader, forever. Three states in one field cannot
   * be inconsistent. `null` also survives JSON where an absent key does not, so the distinction
   * reaches the backend rather than dying at the wire.
   *
   * WHAT AN UNANSWERED ROW DOES: it keeps being matched. Deciding for it — filling in a date
   * because it has none — would stop cameras matching somebody without anybody choosing that, and
   * a listing that goes quiet on its own is the failure this whole field exists to prevent. The
   * console makes these rows visible instead and a person answers them. See registryHealth.
   *
   * A VIP registry with no expiry keeps processing people after the purpose has ended, which is the
   * first thing an audit asks about. A found child comes off; an arrested suspect comes off.
   *
   * HANDOFF NOTE — THE PART THAT MATTERS. An expiry that only greys a row out is worse than no
   * expiry at all: the operator believes the person was released while the cameras keep matching
   * them. Expiry has to reach the analysis module. The provisioning call that carries the VIP registry
   * (PUT /v1/provision/vips in the module contract draft) is where expired people must drop out,
   * and that belongs in the contract rather than in the screen.
   */
  expiresAt?: string | null;
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
  /** Empty on a fresh installation, and deliberately so — see VipCategory. */
  vipCategories: VipCategory[];
  /** Empty on a fresh installation, same reason — see SearchPurpose. */
  searchPurposes: SearchPurpose[];
  accessPresets: AccessPreset[];
  /** Null until the operator declares one this sitting. See SearchPurposeSelection. */
  searchPurpose: SearchPurposeSelection | null;
  /** Every look-up, newest first. Empty until the app records one — see SearchAccessRecord. */
  searchAccessLog: SearchAccessRecord[];
  /** Operator calls on individual detections — see DetectionJudgement. */
  detectionJudgements: DetectionJudgement[];
  /** Every list taken out of the console as a file — see ListExportRecord. */
  listExports: ListExportRecord[];
  /** Outside requests for recorded footage — see FootageRequest. Empty until one is filed. */
  footageRequests: FootageRequest[];
  /** Requests to be erased — see ErasureRequest. Empty until one is filed. */
  erasureRequests: ErasureRequest[];
  events: VcaEvent[];
  uploads: UploadedMedia[];
  portalUsers: PortalUser[];
  servers: Server[];
  cameraGroups: CameraGroup[];
  apiKeys: ApiKey[];
  auditLog: AuditEvent[];
  accessRequests: AccessRequest[];
  staffRoster: RosterEntry[];
  // Notifications (header bell) only care about VIP-match events from this point forward —
  // events seeded at load are historical and start out already "read".
  lastReadNotifAt: string;
  setCameraStatus: (cameraId: string, status: CameraStatus) => void;
  /**
   * Register one camera, or say why not.
   *
   * IT USED TO RETURN NOTHING AND REFUSE NOTHING. The bulk path has enforced the channel limit
   * and code collisions since it was written (see addCameras), and this one just appended — so
   * the same licence meant a hundred channels through a file and no limit at all through the
   * form, and the form closed with a success toast either way. "필수값을 다 적었는데 등록이 안
   * 되는 경우도 있을 것 같은데?" (owner, 2026-09-18) is exactly right, and the honest answer is
   * that the screen must be able to hear a refusal — the real API certainly has them.
   *
   * Returns null when the camera went in, or the reason it did not.
   */
  addCamera: (camera: Omit<Camera, "id">) => CameraAddRefusal | null;
  /**
   * Register many cameras at once — installation day, from the installer's own spreadsheet.
   *
   * One store call rather than addCamera in a loop, for the reason addRosterEntries exists: each
   * mutation trims the audit log, so a file of three hundred cameras would erase every entry
   * before it. And one line in the log is the truth anyway — this was one decision about three
   * hundred cameras, not three hundred decisions.
   *
   * THE CHANNEL LIMIT IS ENFORCED HERE, not only on the screen. A licence granting 100 channels
   * has to mean 100 whichever way cameras arrive; a limit that only the Add form respects is a
   * limit that an import walks straight past. Cameras beyond the remaining allowance are refused
   * and returned, so the caller can say which ones did not make it rather than reporting a
   * success that silently dropped the tail of the file.
   *
   * Returns the codes it refused: over the limit, or colliding with a code already registered.
   */
  addCameras: (cameras: Omit<Camera, "id">[], source: string) => string[];
  /**
   * Put surveyed coordinates onto cameras that are ALREADY registered, matched by code.
   *
   * The other half of the rule the coordinate decision rests on (HANDOFF-SERVER §9-2): a bulk
   * import may defer the survey, so there has to be a way to close it later. The import screen's
   * "fill in coordinates" mode is that way — export the register, put the two columns in, drop it
   * back. Nothing else on the row is touched: the same file re-read as an "add" would rewrite
   * names, stream URLs and credentials, which is why the mode is a question the operator answers
   * rather than something inferred from whether the code exists.
   *
   * One call and one audit line, for the reason addCameras is one call: a file of three hundred
   * rows would otherwise trim the log with its own entries.
   *
   * Returns the codes it could not place — a code matching no camera in this project. Those are
   * refusals, not notes: a row reported as filled when nothing was found is a lie about the
   * register.
   */
  fillCameraPositions: (projectId: string, entries: { code: string; lat: number; lng: number }[], source: string) => string[];
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
   * Cascading, not orphaning: cameras, uploads, servers, the VIP registry and its groups, roster
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
  /**
   * Installs a licence file the vendor issued. This is the "arrive with the licence" above.
   *
   * Not the removed mutator under another name, and the difference is the whole point: that one
   * took three numbers an administrator typed, this one takes an artifact somebody else signed and
   * copies out what it says. The console still cannot choose a channel count — it can only accept
   * one. Which is why this is the only writer of those three fields in the product, and why the
   * screen shows what would change before it calls.
   *
   * HANDOFF NOTE: the server verifies the signature and is the authority on whether a file is
   * genuine — the public key is compiled into the server binary, not configured, so that a
   * customer cannot point it at a key of their own. This action stands in for applying whatever
   * the server accepted (POST /v1/projects/{id}/licence; shape in lib/licenseFile.ts). When that
   * endpoint exists, the values written here come from its response, not from the browser's parse.
   */
  installLicenseFile: (projectId: string, licence: {
    licenseId: string;
    plan: string;
    channelLimit: number;
    /** A date, or UNLIMITED_EXPIRY for a perpetual term. */
    expiresAt: string;
  }) => void;
  /** One call per subject: recording again replaces the previous verdict rather than stacking. */
  recordJudgement: (j: Pick<DetectionJudgement, "surface" | "subjectId" | "targetLabel" | "verdict">) => void;
  /** Back to "nobody has looked at this". Not the same as marking it a false positive. */
  clearJudgement: (surface: DetectionJudgement["surface"], subjectId: string) => void;
  /** Write down that a whole list left as a file. See ListExportRecord — a record, not a gate. */
  recordListExport: (e: Pick<ListExportRecord, "projectId" | "list" | "rowCount">) => void;
  /** File a new request. Returns its id. */
  addFootageRequest: (r: Omit<FootageRequest, "id" | "status" | "receivedAt" | "receivedBy">) => string;
  /** Approve or refuse. A note is required either way — see decideFootageRequest's own comment. */
  decideFootageRequest: (id: string, approved: boolean, note: string) => void;
  /** Record that the file actually left, and on what terms. */
  releaseFootageRequest: (id: string, release: Pick<FootageRequest, "releaseMethod" | "releasedTo" | "redaction">) => void;
  /** File an erasure request. Dispositions start from ERASURE_DEFAULTS. Returns its id. */
  addErasureRequest: (r: Pick<ErasureRequest, "projectId" | "subjectName" | "subjectReference" | "notes">) => string;
  /** Take a position on one category for one request. */
  setErasureDisposition: (id: string, category: ErasureCategory, disposition: ErasureDisposition) => void;
  /** Close it out. Refused to close while any category is still undecided — see the store note. */
  closeErasureRequest: (id: string, completed: boolean, note: string) => void;
  updateProjectMail: (projectId: string, updates: Pick<Project, "mailDomain" | "smtp">) => void;
  setProjectTimeZone: (projectId: string, timeZone: string) => void;
  setEvidenceWatermark: (projectId: string, on: boolean) => void;
  /** null clears it back to "not decided". See Project.retentionDays. */
  setProjectRetention: (projectId: string, days: number | null) => void;
  /** null clears it back to "not decided", and then the deployment default applies. See
   *  Project.vipRetentionDays — unlike recording retention, this number does something. */
  setProjectVipRetention: (projectId: string, days: number | null) => void;
  // null clears the override and falls back to the auto-detected value; true/false pins it.
  setNetworkIsolationOverride: (projectId: string, override: boolean | null) => void;
  /**
   * Make a key, or say why not.
   *
   * Returns the secret ONCE, to the caller that asked for it, and keeps only the prefix. Nothing
   * in the store, in an audit line or in a toast carries the rest of it.
   *
   * HANDOFF: the real issue happens on the server, which is the only place that can mint a value
   * its own validator will accept. This generates one so the screen can show the shape and the
   * once-only reveal; the panel says so in as many words.
   */
  issueApiKey: (projectId: string, draft: { name: string; scope: ApiKeyScope; expiresAt: string | null }) =>
    { refusal: ApiKeyRefusal } | { key: ApiKey; secret: string };
  revokeApiKey: (keyId: string) => void;
  updateTeamMail: (teamId: string, updates: Pick<Team, "mailDomain" | "smtp">) => void;
  /**
   * `expiresAt` has three states here, not two, and the third is the point:
   *
   * - a date — this listing ends then
   * - `null`  — somebody was asked and answered "no end date". Kept as given.
   * - absent  — nobody was asked. The installation's retention rule fills it in.
   *
   * The rule used to live in the registration form, which meant it applied to people registered
   * one at a time and to nobody else. A CSV import — how a real roster actually arrives — wrote
   * rows with no expiry at all, so how long a face was kept depended on which door it came
   * through. A policy that one screen implements is not a policy.
   */
  addPerson: (person: Omit<Person, "id" | "expiresAt"> & { expiresAt?: string | null }) => void;
  removePerson: (personId: string) => void;
  /**
   * Put a deleted listing back exactly as it was — the undo behind the toast.
   *
   * Takes the whole object, not an id, because the row is gone by the time anybody clicks: the
   * caller holds the copy it removed. The SAME id goes back, which is the point — a re-registered
   * person would be a new record with a new id, and the audit trail would show a deletion followed
   * by an unrelated registration instead of a mistake and its correction.
   */
  restorePerson: (person: Person) => void;
  /** The undo for removePersons — the whole batch, same ids. */
  restorePersons: (persons: Person[]) => void;
  /**
   * A CSV import, as one act.
   *
   * Not addPerson in a loop. Every mutation trims the audit log to AUDIT_LOG_LIMIT, so importing
   * two hundred names evicted every entry before it — camera removals, permission changes,
   * project renames — and the Activity log's note about older history being "on the server" was
   * not true of any of it, because nothing had been sent anywhere. One entry naming the file,
   * the way removeCameras and setCamerasZone already collapse a bulk action.
   */
  addPersons: (persons: (Omit<Person, "id" | "expiresAt"> & { expiresAt?: string | null })[], source: string) => number;
  /**
   * Edit a registered face — name, tag, priority, note, photo.
   *
   * There was no way to change any of it. A VIP could be registered and removed and nothing in
   * between, so a misspelled name or a priority that turned out to be wrong meant deleting the
   * enrolment and doing it again. `description` was worse than unchangeable: only the bulk CSV
   * import ever set it, so a note could exist on a row and never be written by hand.
   */
  updatePerson: (personId: string, updates: Partial<Omit<Person, "id">>) => void;
  /**
   * Set the end date on several listings at once. `null` means "no end date", the same answer the
   * form's cleared field gives.
   *
   * Not a convenience. A registry that has accumulated hundreds of rows nobody set an expiry on
   * cannot be cleared one row at a time, and a console that only warns about them is a console
   * that nags. This is the way the warning becomes finishable.
   *
   * One audit entry for the whole act, the way removeCameras and addPersons already collapse a
   * bulk action — two hundred separate lines would evict every entry before them.
   */
  setPersonsExpiry: (personIds: string[], expiresAt: string | null) => void;
  /** Move several listings into one group, or out of every group with `null`. */
  setPersonsGroup: (personIds: string[], groupId: string | null) => void;
  /** Set the same priority on several listings. */
  setPersonsPriority: (personIds: string[], priorityLabel: NonNullable<Person["priorityLabel"]>) => void;
  /**
   * Delete several listings as one act — and hand back what was deleted, so the caller can offer
   * an undo the way the single delete does.
   *
   * One audit entry naming the count, like removeCameras: two hundred lines would evict the rest
   * of the log, and "47 listings deleted" is the line somebody can actually read a year later.
   */
  removePersons: (personIds: string[]) => Person[];
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
  /* No updateSearchPurpose, and that is the design rather than a gap — see the note on
     archiveSearchPurpose. */
  archiveSearchPurpose: (purposeId: string) => void;
  /** Declare the purpose for this sitting, or clear it to be asked again. */
  setSearchPurpose: (selection: SearchPurposeSelection | null) => void;
  /**
   * Write one look-up to the access log. Called by the app when a search runs.
   *
   * Takes the purpose's label rather than resolving it, so the record keeps the wording that was
   * on screen at the time — see SearchAccessRecord.
   */
  recordSearchAccess: (record: Omit<SearchAccessRecord, "id" | "at" | "actor" | "actorEmail" | "teamId">) => void;
  addVipCategory: (category: Omit<VipCategory, "id" | "archived">) => string;
  updateVipCategory: (categoryId: string, updates: Partial<Omit<VipCategory, "id" | "teamId">>) => void;
  /**
   * Retire a category. Not a delete — people registered under it keep the id, and their rows would
   * otherwise name a category that no longer exists.
   */
  archiveVipCategory: (categoryId: string) => void;
  /**
   * Take somebody off the VIP registry without erasing that they were on it.
   *
   * Separate from removePerson because the two answer different questions later: a released row
   * says the purpose ended and when, a deleted row says nothing at all. Audited, because "who took
   * this person off and why" is exactly what gets asked afterwards.
   */
  releasePerson: (personId: string, reason: string) => void;
  /**
   * Put a released person back on the VIP registry.
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
  /**
   * Put an account on a preset, copying that preset's grants onto it now.
   *
   * Also the way back from custom, and the reason the confirmation that precedes it matters: the
   * manual adjustments are overwritten, not merged.
   */
  applyGrantPreset: (userId: string, presetId: string) => void;
  /** Create a preset for a team. Returns its id so the caller can select it straight away. */
  addAccessPreset: (preset: Omit<AccessPreset, "id" | "archived">) => string;
  /**
   * Edit a preset in place — and everybody following it receives the change.
   *
   * Living inheritance over an editable bundle is the combination AWS avoids (managed policies
   * cannot be edited) and Genetec avoids (templates are copied, not followed). Doing it anyway is
   * defensible only while the person editing can see who they are about to change, which is what
   * accountsFollowingPreset exists for. If that preview ever comes off the screen, this action is
   * no longer safe to offer.
   */
  updateAccessPreset: (presetId: string, updates: Partial<Omit<AccessPreset, "id" | "teamId">>) => void;
  /**
   * Retire a preset. Accounts following it become custom, holding exactly what they held.
   *
   * No guard forbidding retirement while accounts follow it: such a guard would make a preset
   * permanent the moment it is used, which is how registries fill with names nobody dares touch.
   */
  archiveAccessPreset: (presetId: string) => void;
  /**
   * Cut an account loose from its preset, keeping exactly what it currently holds.
   *
   * Nothing changes on screen at the moment of switching, which is the point — "custom" is a
   * statement about where the values come from from now on, not a new set of values.
   */
  startCustomGrants: (userId: string) => void;
  /**
   * Turn one screen or verb on or off on a custom account.
   *
   * EVERY CHANGE IS ITS OWN AUDIT LINE. A preset name alone would swallow the manual tuning that
   * came after it, which is the half an access review is actually asking about — the same reason
   * updatePortalUserAccess already logs a dropped search grant separately from the access change
   * that caused it.
   */
  /** Turn one of the five actions on or off. Detaches the account from its preset on the way. */
  setAppGrant: (userId: string, action: AppAction, allowed: boolean) => void;
  /**
   * Narrow this account to a set of cameras, or hand it all of them again with `undefined`.
   *
   * `undefined` and `[]` are different answers and both are kept: all, and none. The audit line
   * says which of the three happened, because "scoped to 4 cameras" and "scoped to none" are not
   * the same event to whoever reads the log afterwards.
   */
  setCameraScope: (userId: string, cameraIds: string[] | undefined, cameraGroupIds?: string[] | undefined) => void;
  /** Make a group out of the cameras somebody has selected. Returns null, or why not. */
  addCameraGroup: (projectId: string, label: string, cameraIds: string[], description?: string) => "duplicate-label" | null;
  /**
   * The group's name, its purpose line and its membership, changed together — because the editor
   * that changes them is one drawer with one save, and three calls would write three audit lines
   * for one decision. Only the fields passed are touched. Refuses a name another group on the
   * project already holds, the same rule `addCameraGroup` applies.
   */
  updateCameraGroup: (groupId: string, patch: { label?: string; description?: string; cameraIds?: string[] }) => "duplicate-label" | null;
  /** Deletes the group and takes it out of every scope that held it. */
  removeCameraGroup: (groupId: string) => void;
  /** Which project the monitoring app is watching. Empty until something picks one. */
  activeProjectId: string;
  setActiveProjectId: (projectId: string) => void;
  updatePortalUserProjects: (userId: string, projectIds: string[]) => void;
  updatePortalUserStatus: (userId: string, status: PortalUserStatus) => void;
  /**
   * Close several accounts at once — a contractor's people rotating off a site.
   *
   * Suspend, never delete. Suspension is reversible and keeps the person on the list, which is
   * what an administrator doing a clear-out actually wants: the accounts stop working today, and
   * the ones that turn out to still be needed come back without being re-invited. Deleting in
   * bulk would also delete the record that they were ever here.
   *
   * One call, one audit line, for the reason addRosterEntries and removeCameras exist: twenty
   * separate entries in the same second bury the fact that this was one decision about twenty
   * people, which is the thing anyone reading the log later needs.
   *
   * The last-active-administrator rule is applied per id, exactly as the single-user path does —
   * a bulk action must not be the way around a guard the individual action enforces. Ids it
   * refused come back so the screen can say who is still active and why.
   */
  suspendPortalUsers: (userIds: string[]) => string[];
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
  /** Mints one invited account per request and returns the new ids, in the order the requests sit
   *  in the store — the callers pair them with their own copy of that list by index. All or
   *  nothing: returns `[]` without creating anything if any of the requests names a project this
   *  store no longer holds, because the account's team is only knowable through it. */
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
   *  was issued against. Returns the new user's id, or null if the code was not usable — which
   *  includes the row naming a project this store no longer holds, since that project is the only
   *  route to the team the account would belong to. Null mutates nothing: the code stays live. */
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
   * a VIP registry category, a search purpose. The Overview shows a project's own entries plus its
   * team's, because a policy change is news at every site it governs and filing it under one of
   * them would be a lie about where it applies.
   */
  teamId?: string;
  /**
   * THE THREE COLUMNS, SPLIT AT THE SOURCE (owner, 2026-09-28: 어느 화면에서 어떤 게 변경되었는지
   * 한눈에 보이게 누가 무엇을 어떻게를 열로 구분 지어 줘).
   *
   * The screen the change was made on, the thing that changed, and what was done to it. The
   * search log has carried its equivalents apart since it was built — operator, target, screen —
   * and this log was the one that shipped with everything folded into one sentence.
   *
   * WHY NOT PARSE `message`. Every row here is written by one of the call sites below, in free
   * prose, and there are more than eighty of them. A parser over that is a rule set that passes
   * today and is quietly wrong the next time somebody adds a wording — and the failure is not an
   * error, it is a row filed under the wrong screen in the log an audit reads. So the split is
   * made where the sentence is written, by the code that already knows all three parts.
   *
   * OPTIONAL, AND STAYING OPTIONAL. `message` remains required and is still written in full, so
   * a row that arrives without these — an older entry, or a server that has not been taught them
   * yet — still renders as the one sentence it always was, across the three columns. A row is
   * never shown half-split; see ProjectActivityTab.
   */
  area?: AuditArea;
  /** WHAT — the thing's own name: a camera code, a person, an account, a preset, a file. */
  target?: string;
  /** HOW — what was done to it, in the past tense, starting with a capital. */
  action?: string;
  /**
   * The whole change as one sentence. Still required, and still the only thing the CSV's old
   * column and the search box read, because it is the one field every row is guaranteed to have.
   */
  message: string;
  actor: string;
  at: string;
  /**
   * Who saw the action happen — and therefore whether this row can be offered as evidence.
   *
   * "server" — the server observed the action and recorded it. Can be offered as audit evidence.
   * "client" — the browser reported it. The server did not see the action. Lost when the tab
   *   closes, forgeable by editing the store, and what it records is intent rather than
   *   observation.
   *
   * REQUIRED, deliberately. Optional would have let all 68 existing row-writing sites keep
   * compiling and silently settle into one value, and that value is itself a claim — "this is
   * evidence" — made about rows nobody checked. The type forces every writer to say which it is,
   * and the frontend has exactly one honest answer.
   *
   * Which is why "server" appears in this file only inside the AUDIT_LOG seed, the stand-in for
   * rows a server wrote. Everything the running app writes goes through `clientAudit`, whose
   * signature makes "server" unsayable. A browser that can claim the server saw something
   * produces an audit log that is not an audit log.
   */
  recordedBy: "server" | "client";
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
    /* EIGHT CHANNELS FOR SIX CAMERAS, so "nearly full" is a state somebody can see.
       It was forty, which put the licence so far ahead of the fleet that the registry's 남은 채널
       cell — the one that appears only when the headroom is small (see CHANNELS_LOW) — could never
       render on any seeded site. Same reason the register keeps one refusing camera and one
       unsurveyed one: a state that exists in the code and nowhere on screen is a state nobody can
       check. Two channels left on a school that has filled the gate, both corridors, the hall, the
       car park and the rear gate is also just what a small site looks like. */
    licensePlan: "Professional", licenseChannelLimit: 8, licenseExpiresAt: "2026-11-20",
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

// Portal-managed accounts — separate from `persons` (the VIP registry). A PortalUser is
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
 * May look at a registered face.
 *
 * Decided 2026-09-15 (Q2·B). "May not change it" and "may look at it" are different questions, and
 * the auditor role answered both with one word. That role exists for acceptance, inspection and
 * security review — work that is done against counts, dates and who did what — and a face
 * photograph is biometric-derived material that none of those errands needs. The rest of the
 * registry stays open to them: names, groups, priorities, expiry, the whole history.
 *
 * Not a privacy flourish. On a police deployment the register is a list of suspects, and a
 * contractor brought in to sign off on an installation has no business leaving with their faces.
 *
 * Shaped like the other gates (a permission in, a boolean out) so it can move into a capability
 * checkbox unchanged when custom roles land — see the roles design note.
 */
export function canViewFaces(permission: PortalPermission): boolean {
  return canEditPortal(permission);
}

/**
 * May change the lists that decide what the audit will find: VIP registry categories and search
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

/**
 * THE DETECTIONS THIS ACCOUNT MAY SEE, which is not the same set as the project's.
 *
 * A camera scope narrowed the app's camera LISTS and nothing else: `useProjectCameras` went
 * through camerasVisibleTo, so a guard scoped to two cameras saw two cameras in the sidebar — and
 * every VIP hit from all sixty-two in the feed, the map, the chart and the notification bell. The
 * scope named which cameras somebody may watch, and the watching happens through the detections.
 *
 * Portal deliberately does NOT go through here, the same way it does not go through
 * camerasVisibleTo: an administrator reads the whole site's activity, including cameras they are
 * not scoped to watch.
 *
 * TWO LIMITS, both worth stating rather than hiding:
 *
 *   1. A TRACKING EVENT IS FILTERED BY ITS OWN CAMERA, not by its trail. `TrackingHop` carries a
 *      `cameraLabel` and no camera id (see the type), so a hop cannot be resolved against a scope
 *      without matching cameras by name — which is the exact mistake this codebase has already
 *      paid for twice. So a visible trail can still draw a hop on a camera outside the scope.
 *      Trimming the path instead would be worse: a trail with a hop removed draws a straight line
 *      between the two that remain and claims a journey that never happened.
 *   2. The dashboard's VIP simulation picks from VIP_SIMULATION_CAMERAS, a pool outside the
 *      register, so those ids are in nobody's scope and their events drop out for any narrowed
 *      account. That is the honest answer for a camera the register does not have, and it costs
 *      the default demo nothing: every seeded account has `cameraIds === undefined`.
 *
 * HANDOFF: filtering a list in the browser is not control. The server has to scope the event feed,
 * the search results and the streams the same way, or a narrowed account still receives everything
 * and only the screen is polite about it.
 */
export function eventsVisibleTo(events: VcaEvent[], projectId: string, cameras: Camera[], users: PortalUser[], groups: CameraGroup[] = []): VcaEvent[] {
  const inProject = eventsInProject(events, projectId, cameras);
  // Same stand-in rule as camerasVisibleTo: an identity that resolves to nobody sees everything,
  // so the mock stays explorable. A real build reads the scope off the session.
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (!me) return inProject;
  const allowed = scopedCameraIds(me, groups);
  if (allowed === null) return inProject;
  return inProject.filter(e => allowed.has(e.cameraId));
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
/**
 * The end date the installation's retention rule gives a listing starting today, or undefined
 * where it has no rule.
 *
 * Exported because the registration form shows this value before anything is saved — the field
 * arrives filled in, and what the registrar does is shorten it or clear it. Both sides read this
 * function so the date on screen and the date stored cannot drift apart.
 */
/**
 * The retention rule in force at a site: its own setting, or the deployment default where the site
 * has not set one. `null` means there is no rule and a listing registered without an answer stays
 * unanswered — which is honest, rather than inventing a date nobody chose.
 */
export function vipRetentionDays(project: Project | undefined): number | null {
  return project?.vipRetentionDays ?? getComplianceConfig().vipDefaultValidDays;
}

export function defaultVipExpiry(days: number | null): string | undefined {
  return days === null ? undefined : new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Resolves addPerson's three-state `expiresAt` into the three-state stored value.
 *
 * `null` is now KEPT rather than flattened to undefined. It used to be thrown away, which is what
 * made "answered: no end date" and "never asked" the same row as far as every reader was
 * concerned. See the declaration on Person.expiresAt.
 *
 * Absent still means the installation's retention rule fills it in — that is the door-level policy
 * and it applies to whoever comes in without an answer. An installation with no rule configured
 * leaves the row unanswered, which is honest: nobody was asked and there is nothing to apply.
 */
function settledExpiry(given: string | null | undefined, days: number | null): string | null | undefined {
  if (given === null) return null;
  return given ?? defaultVipExpiry(days);
}

/**
 * The calendar day a registration belongs to, in the site's own zone.
 *
 * `Person.registeredAt` arrives in two shapes and always has: the seeds carry a local instant
 * ("2026-09-09T09:12:00+08:00") and anything registered through Portal carries `new Date()
 * .toISOString()`, which is UTC. Screens were slicing the first ten characters off whichever one
 * they got and comparing that to a day computed in the project's zone — so on a UTC+8 site every
 * registration made between local midnight and 08:00 carried YESTERDAY's UTC date, and the
 * Overview's "N today" counted it under "yesterday" instead. The first of the month lost its
 * morning the same way.
 *
 * Parsing first and formatting in the zone makes the two shapes answer the same question. A
 * date-only value (the group rows use one) parses as UTC midnight, which lands on the same day in
 * any zone east of Greenwich and is the day it names either way.
 *
 * HANDOFF NOTE: the server should send one shape. An instant in UTC is the right one — a stored
 * local time cannot be re-bucketed when a site's zone is corrected.
 */
export function registeredDayIn(registeredAt: string, timeZone: string): string {
  return dateKeyIn(new Date(registeredAt), timeZone);
}

/**
 * Who this site is watching.
 *
 * AN EXPIRED LISTING IS STILL WATCHED, and that is a decision (owner's call, 2026-09-18: 만료는
 * 안내이고 대조 중단은 사람이 정한다). Do not put the date back in this filter.
 *
 * It used to drop anybody whose end date had passed, which made a date the thing that silently
 * stopped a face being matched. Two reasons that is wrong here:
 *
 * 1. **It is a silent failure.** The person stays on the list, looking registered, and no camera
 *    ever matches them again. Nothing on any screen says why. On a police deployment that is a
 *    wanted face missed because of a number in a field.
 * 2. **The console does not get to enforce retention.** Contract 8 already settled this shape for
 *    recording retention — the console writes the number down, the recorder and the server delete.
 *    A matching cutoff is the same kind of claim about machines this browser does not talk to.
 *
 * So expiry is ADVISORY: the strip says "등록 만료된 VIP N명" and the row says how long ago it
 * lapsed, and a person decides — extend it, or remove them. `releasedAt` is the opposite and stays
 * in the filter: that IS a person's decision, already taken.
 */
export function watchedPersonsInProject(persons: Person[], projectId: string): Person[] {
  return persons.filter(p => p.projectId === projectId && !p.releasedAt);
}

/** This site's cameras. */
/**
 * Whether this camera can be drawn — and therefore whether it can be picked on a map.
 *
 * Every caller that plots cameras has to ask, because a camera with no survey is a real camera
 * that simply is not anywhere yet. Callers that need the pickable set (a scope picker's map half)
 * use this too, and must show the rest somewhere else: a camera nobody can reach on the map is
 * one nobody can grant, and that has to be visible rather than quietly absent.
 */
/**
 * Why a single camera registration was refused.
 *
 * "over-limit" — the licence has no channel left. The same rule the import enforces.
 * "duplicate-code" — the register is one id space, and a code is what a detection is filed
 *   against; two cameras answering to one code is how a sighting lands on the wrong street.
 * "duplicate-stream" — this project already polls that exact RTSP URL. Scoped to the project on
 *   purpose: two sites on separate private networks legitimately both have a camera at
 *   10.20.4.11, and a global check would refuse the second site's whole fleet. The IP alone is
 *   NOT a duplicate either — a four-channel encoder is one address and four stream paths, which
 *   is a normal way to register four cameras.
 */
export type CameraAddRefusal = "over-limit" | "duplicate-code" | "duplicate-stream";

export function hasPosition<T extends { lat?: number; lng?: number }>(c: T): c is T & { lat: number; lng: number } {
  return typeof c.lat === "number" && typeof c.lng === "number";
}

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
  // Raw slices out of the selectors, filtering in the memo — the same rule useProjectCameras
  // states: a selector that builds a new array every call never settles.
  const users = useVcaStore(s => s.portalUsers);
  const groups = useVcaStore(s => s.cameraGroups);
  const projectId = useActiveProjectId();
  return useMemo(() => eventsVisibleTo(events, projectId, cameras, users, groups), [events, projectId, cameras, users, groups]);
}

/**
 * The app's view of the VIP registry: this site's people, minus the ones taken off it.
 *
 * Deliberately NOT personsInProject — see watchedPersonsInProject. Portal keeps reading the
 * unfiltered list, because the record of a release is the point of a release.
 */
export function useProjectPersons(): Person[] {
  const persons = useVcaStore(s => s.persons);
  const projectId = useActiveProjectId();
  /* No clock any more. It was here because the filter compared an end date, which had to be read
     post-mount so the server's frame and the browser's first one agreed about who was on the list.
     Expiry left the filter (see watchedPersonsInProject), and with it the whole hydration problem
     — release is a stored fact, and a stored fact reads the same in both frames. */
  return useMemo(() => watchedPersonsInProject(persons, projectId), [persons, projectId]);
}

/**
 * Non-hook form, for imperative code that cannot call a hook — a timer, a seeder, an event
 * handler. Same resolution as useActiveProjectId.
 */
export function getActiveProjectId(): string {
  const s = useVcaStore.getState();
  return resolveActiveProject(s.activeProjectId, s.portalUsers, s.projects)?.id ?? "";
}

/**
 * The cameras of a project that this account may watch.
 *
 * Portal deliberately does NOT go through here — an administrator manages every camera on the
 * site, including the ones they are not scoped to watch, and `camerasInProject` stays the
 * unrestricted answer for it.
 *
 * Same stand-in rule as canSearchInApp: an identity that resolves to nobody sees everything, so
 * the mock stays explorable. A real build reads the scope off the session.
 */
export function camerasVisibleTo(cameras: Camera[], projectId: string, users: PortalUser[], groups: CameraGroup[] = []): Camera[] {
  const inProject = camerasInProject(cameras, projectId);
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (!me) return inProject;
  const allowed = scopedCameraIds(me, groups);
  if (allowed === null) return inProject;
  return inProject.filter(c => allowed.has(c.id));
}

/**
 * The camera ids an account is limited to, or null for "every camera".
 *
 * ONE PLACE RESOLVES THE TWO FIELDS, so a screen cannot read half the scope. Groups are resolved
 * through their current membership — that is the whole difference between a group and a frozen
 * list of ids (see CameraGroup) — and the two sets are unioned: somebody can hold two groups and
 * one extra camera, which is the normal shape of a real scope.
 *
 * Absent-and-absent is the only "everything". An empty array is an answer somebody gave.
 */
export function scopedCameraIds(user: PortalUser, groups: CameraGroup[]): Set<string> | null {
  if (user.cameraIds === undefined && user.cameraGroupIds === undefined) return null;
  const ids = new Set(user.cameraIds ?? []);
  (user.cameraGroupIds ?? []).forEach(groupId => {
    groups.find(g => g.id === groupId)?.cameraIds.forEach(id => ids.add(id));
  });
  return ids;
}

/** The groups of one project, which is the only place a group means anything. */
export function cameraGroupsInProject(groups: CameraGroup[], projectId: string): CameraGroup[] {
  return groups.filter(g => g.projectId === projectId);
}

export function useProjectCameras(): Camera[] {
  const cameras = useVcaStore(s => s.cameras);
  // Raw slice out of the selector, filtering in the memo — a selector that builds a new array
  // every call never settles. This page has been killed by that twice.
  const users = useVcaStore(s => s.portalUsers);
  const groups = useVcaStore(s => s.cameraGroups);
  const projectId = useActiveProjectId();
  return useMemo(() => camerasVisibleTo(cameras, projectId, users, groups), [cameras, projectId, users, groups]);
}

/**
 * Whether the person using the monitoring app may run a search ON ONE SCREEN.
 *
 * IT TAKES A SCREEN NOW (2026-09-23). It used to answer once for the whole app, off a single
 * `personSearch` grant, which made "may search on 모니터링 but not on Re-ID" impossible to say and
 * left the 모니터링 permission row with nowhere to show its own search state.
 *
 * The two screens with no unsearched state answer with their screen grant, because on them the
 * search IS the screen: RedFace shows nothing but search results, and Redmap draws nothing until
 * somebody is found. Reading `redface`/`trail` here rather than inventing a second grant is what
 * keeps the permission list from carrying a control that can never be off while the screen is on.
 *
 * HANDOFF NOTE: same stand-in as currentPortalRole — there is no session, so this resolves
 * SIGNED_IN_USER's address against the account list. When the address matches nobody (the default
 * demo identity does not), it answers true so the app stays fully explorable; a real build reads
 * the flag off the session and defaults to denied. Replace the body, not the call sites.
 */
export function canSearchIn(users: PortalUser[], screen: AppScreen): boolean {
  switch (screen) {
    case "live": return holdsAppAction(users, "liveMonitoringSearch");
    case "reid": return holdsAppAction(users, "reidSearch");
    case "redface": return holdsAppAction(users, "redface");
    case "redmap": return holdsAppAction(users, "trail");
    /* Best Frame has no search box — it is the same detections read backwards in time. */
    case "bestframe": return false;
  }
}

/**
 * Whether the signed-in account holds one action.
 *
 * Same stand-in rule as currentPortalRole: there is no session, so this resolves SIGNED_IN_USER's
 * address against the account list, and an address that matches nobody answers true so the mock
 * stays explorable. A real build reads the session and denies by default. Replace the body, not
 * the call sites.
 */
export function holdsAppAction(users: PortalUser[], action: AppAction): boolean {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  return me ? (me.appActions ?? []).includes(action) : true;
}

/**
 * Whether this account may open one app screen. Same stand-in rule as canSearchInApp above — an
 * identity that resolves to nobody answers true, so the mock stays explorable and a real build
 * reads the session and denies by default.
 */
export function canSeeScreen(users: PortalUser[], screen: AppScreen): boolean {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  return me ? screensForActions(me.appActions ?? []).includes(screen) : true;
}

/** The screens this account holds, in the app's own tab order. Empty is a real answer. */
export function screensFor(users: PortalUser[]): AppScreen[] {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (!me) return APP_SCREENS;
  return screensForActions(me.appActions ?? []);
}

/** The grants a preset hands out, as the fields they are stored in. */
/**
 * The product strings for the two presets we ship, keyed by `builtinKey` — the same arrangement
 * SERVER_TYPE_LABELS and the licence tab's FEATURE_LABELS make, so the lookup never touches the
 * data. A preset the customer made has no key and keeps its own label.
 */
/*
 * EACH DESCRIPTION SAYS WHAT ITS OWN ROWS SAY. Rewritten when the grant became five actions
 * (2026-09-21): Operator reads "watches what is happening now" while granting `history`, which is
 * last week's frames — a line the reader can now catch, because the row under it is literally
 * called 지난 기록 열람. The grants themselves are unchanged (they are the same pair the old
 * preset held: live plus Best Frame); it is the sentence that was approximate.
 *
 * The two are a LADDER, 조사자 being 운영자 plus finding a person and following them, which is what
 * makes them pickable at a glance — and it is also why custom exists: the off-ladder combinations
 * are real and nothing here should pretend they are not.
 *
 * 감독자 WAS A THIRD RUNG AND IS GONE (owner, 2026-09-28). The only grant that separated it from
 * 조사자 was 증거 내보내기, and that left the app the same day — the app has nothing left that a
 * supervisor may do and an investigator may not, because supervising lives in the PORTAL role
 * (`portalRole`), not in what the app opens. Two identical columns in the preset table would have
 * been a distinction the product cannot back up. The three accounts that followed it now follow
 * 조사자, which is the same sixteen grants they already held.
 */
export const PRESET_BUILTIN_LABELS: Record<NonNullable<AccessPreset["builtinKey"]>, { label: { en: string; ko: string }; description: { en: string; ko: string } }> = {
  operator: {
    label: { en: "Operator", ko: "운영자" },
    description: { en: "Watches the cameras, live and after the fact", ko: "실시간 화면과 지난 기록을 봅니다" },
  },
  investigator: {
    label: { en: "Investigator", ko: "조사자" },
    description: { en: "Operator, plus finding a person and following their route", ko: "운영자가 하는 일에 인물 검색과 동선 추적을 더합니다" },
  },
};

/** What to print for a preset's name: ours translated, the customer's as typed. */
export function presetLabel(preset: AccessPreset, lang: "en" | "ko"): string {
  return preset.builtinKey ? PRESET_BUILTIN_LABELS[preset.builtinKey].label[lang] : preset.label;
}

export function presetDescription(preset: AccessPreset, lang: "en" | "ko"): string {
  return preset.builtinKey ? PRESET_BUILTIN_LABELS[preset.builtinKey].description[lang] : preset.description;
}

export function grantsOfPreset(preset: AccessPreset): Pick<PortalUser, "appActions"> {
  return { appActions: [...preset.actions] };
}

/**
 * Changing one of an account's grants individually detaches it from its preset.
 *
 * `updateAccessPreset` states the invariant and enforces it in the other direction: editing a
 * preset recomputes every follower, "because a preset account that kept its old grants would be
 * following a preset in name only". So an account left on `grantMode: "preset"` after somebody
 * edits one of its grants is wrong twice over. The row reads "Operator" while the account no
 * longer holds Operator's set; and the next edit to that preset silently reverts the
 * administrator's change, because the follower recompute overwrites it. Neither failure raises
 * anything — the screen just stops matching the words on it.
 *
 * WHY THIS LIVES HERE AS WELL AS IN THE CALLER — it is not a replacement for either one.
 *
 * This covers "a grant changed": the row's own search toggle wrote `appSearch` straight onto a
 * preset account, and a rule every call site has to remember is a rule that holds until the next
 * call site. PortalUsersPage's custom-grant form covers a case this one CANNOT, and the two are
 * not redundant — that was measured, not assumed. `setAppGrant` is only called for grants that
 * actually changed, so switching an account from a preset to custom while leaving every grant as
 * it was calls it zero times. Without the caller's own `startCustomGrants`, that save reported
 * success and did nothing: the account stayed on the preset and the table's source column went on
 * reading "감독자". Removing the call site because "the store handles it now" reintroduces exactly
 * that, and it is the silent kind — the form says saved.
 *
 * So: the store guarantees the invariant whenever a value moves, and the caller announces the
 * mode change when no value moves. Deleting either leaves a hole.
 *
 * `presetId` is deliberately kept. It records where the account started, which is what lets the
 * way back read as one sentence ("back to Operator") instead of eleven toggles — see the field's
 * own comment. Detaching is about where the values come from from now on, not about erasing
 * where they came from, which is the same line `archiveAccessPreset` draws.
 *
 * Returns both halves because the detach is its own audited act: the state patch, and the audit
 * row that says it happened. A caller that applied the patch and dropped the row would leave the
 * access review unable to explain why an account stopped following its preset.
 */
function detachedFromPreset(user: PortalUser): { patch: Partial<PortalUser>; audit: AuditEvent[] } {
  if (user.grantMode !== "preset") return { patch: {}, audit: [] };
  return {
    patch: { grantMode: "custom" },
    audit: [clientAudit({
      projectId: user.projectIds[0],
      area: "accounts", target: user.name, action: "App grants detached from preset, set individually", message: `App grants for ${user.name} detached from preset and set individually`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    })],
  };
}

/** This team's presets, retired ones dropped. An empty list is a real state — see the invite form. */
export function presetsForTeam(presets: AccessPreset[], teamId: string): AccessPreset[] {
  return presets.filter(p => p.teamId === teamId && !p.archived);
}

/**
 * How many accounts a change to this preset would reach.
 *
 * An editable preset with living inheritance is the combination both AWS (managed policies are
 * not editable) and Genetec (templates are copied, not followed) chose to avoid. Doing it anyway
 * is defensible only if the person editing can see who they are about to change, so this exists to
 * make that preview possible rather than optional.
 */
export function accountsFollowingPreset(users: PortalUser[], presetId: string): PortalUser[] {
  return users.filter(u => u.grantMode === "preset" && u.presetId === presetId);
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

/**
 * The app screens a grant can name. FIVE, and the list is the app's own, not a tidy invention:
 * the top-level tabs are DASHBOARD / BEST FRAME / DATA / REDMAP (Navbar.TABS) and DATA holds three
 * of its own (DataPage.DataTab). Five of those six are grantable.
 *
 * DASHBOARD IS NOT HERE, deliberately. It is the app's ground floor — the map, the site's own
 * state, the thing every other screen is reached from — and an account admitted through the door
 * with nowhere to land is a door onto nothing. It rides on appAccess.
 *
 * Person search and evidence export are NOT in this list either. They are verbs that cut across
 * screens (search lives in Data AND Redmap; export hangs off a sighting), and folding a verb into
 * a screen list produces a flat checkbox column that lies about what it grants.
 */
export type AppScreen = "live" | "bestframe" | "redmap" | "reid" | "redface";

/** Order is the app's own tab order, so any list built from it reads the way the app does. */
/**
 * Every screen, in the order the grants ladder runs: what is happening now, then what happened
 * before, then the two that reconstruct a person's path.
 *
 * The order is not cosmetic — this array is what every list of grants renders in (the invite
 * modal, My page) and what `screensFor` filters against, so it is also the order a stored
 * `appScreens` comes out in. Alphabetical or arbitrary order made the preset descriptions
 * ("Operator + finds what happened before") disagree with the list underneath them.
 */
export const APP_SCREENS: AppScreen[] = ["live", "bestframe", "redmap", "reid", "redface"];

/**
 * WHAT AN ACCOUNT MAY DO IN THE APP — five actions, and the screens follow from them.
 *
 * The grant was five SCREENS plus two verbs, which mixed two different questions: what somebody
 * may do, and where they do it. Search appears on three screens, so the same permission was being
 * asked twice, and a custom grant ended up looking identical to a preset with the same seven rows
 * (owner, 2026-09-16: 커스텀이 프리셋이랑 똑같다, 더 세부적이었으면 · 2026-09-21: 기능들을 더
 * 세부적으로 나눠서 선택할수있게).
 *
 * The products split it this way too: a Milestone role carries per-device verbs (view live,
 * playback, export, smart search), not a list of windows. `trail` is its own action for the same
 * reason Milestone keeps "Smart search" and Avigilon keeps "Appearance Search" separate: it reads
 * across every camera in scope to reconstruct one person's movement, which is a different weight
 * from watching a camera.
 *
 *   liveView              the dashboard's events panel — registered people, as they pass
 *   systemStatus          the dashboard's system panel — cameras and servers, nobody's data
 *   history               frames and records from before now
 *   liveMonitoring        everybody who walks past, strangers included
 *   liveMonitoringSearch    └ and may search there
 *   reid                  what the server joins up live out of those detections
 *   reidSearch              └ and may search there
 *   redface               face search. THE SCREEN IS THE SEARCH, so there is no second step
 *   trail                 one person's route on the map. Also search-only
 *   export                  └ and may take what Redmap found out as a file
 *
 * SCREENS ARE DERIVED, never stored: see screensForActions. A screen is a place, and a place with
 * nothing you may do in it is not a grant worth keeping.
 */
export type AppAction =
  | "systemStatus"
  | "liveView"
  /**
   * 데이터 → 실시간 관제. SEPARATE FROM `liveView` ON PURPOSE (2026-09-23, owner: 이걸 같이 보면
   * 안 되는 게, 데이터의 모니터링에서는 모르는 사람도 모두 감지하고 촬영하고 있어서).
   *
   * The dashboard's VIP detections are about people the customer registered. Live Monitoring is
   * about EVERYBODY who walks past, including faces nobody enrolled — so granting one used to
   * grant the other, and an account that should only see VIP alerts could watch and film strangers.
   * Same privacy line `systemStatus` is drawn on, and the heavier side of it.
   */
  /**
   * 대시보드 > 이벤트의 동선 줄. A SECOND DEPTH ON THE EVENTS PANEL (2026-09-28, owner: 대시보드에
   * 트레킹 기능도 볼 수 있게 할 건지 넣어줘야 해).
   *
   * The events panel carries two kinds of row: a registered person walking past (`liveView`) and
   * one person's movement joined across cameras. The second used to ride on `trail` — the Redmap
   * grant — so the only way to take it off the landing screen was to take Redmap away too, and no
   * row on the permission list said the dashboard was involved at all.
   *
   * Its own action, and a child of `liveView` because that is where it is drawn: the panel has to
   * be open for the rows to be in it. Redmap stays separate — watching a trail appear on the
   * landing screen and opening the map to trace somebody are different weights.
   */
  | "dashboardTrail"
  | "liveMonitoring"
  | "monitoringVip"
  | "monitoringUnknown"
  /**
   * SEARCHING ON 모니터링, AS A SECOND STEP ON THE SAME SCREEN (2026-09-23, owner: 검색할 수 있게
   * 할 건가 그 권한을 표시해 주는 건데 검색에 대한 권한이 있는지 표시가 없다고 느껴져).
   *
   * There used to be one `personSearch` grant doing two unrelated jobs: it OPENED RedFace, and it
   * switched on the search box of three other screens. So a reader looking at the 모니터링 row
   * could not tell whether that account may search there — the row had no place to say it, and the
   * description punted to another row by name. Worse, the coupling made a real case ungrantable:
   * "may search on 모니터링 but not on Re-ID" could not be expressed at all.
   *
   * Now each screen that has BOTH depths carries its own second step, and the two screens that
   * have only one depth carry none (see `redface` and `trail`).
   */
  | "liveMonitoringSearch"
  /**
   * 베스트 프레임의 실시간 카메라 격자 (2026-09-28, owner: 베스트 프레임에 실시간 CCTV를 볼 수
   * 있는지도 추가해 줘).
   *
   * That screen holds two things and had one grant. `history` is the detections — the same faces
   * read backwards in time — and this is the wall of live tiles above them. They are different
   * weights: watching what a camera is looking at RIGHT NOW is not the same as reading what it
   * caught yesterday, and an installation can reasonably give one without the other.
   *
   * NOT a child of `history`: neither needs the other, and the tab opens for either one. See
   * screensForActions.
   */
  | "liveWall"
  /**
   * WHICH SUBJECTS A SCREEN MAY SHOW (2026-09-28, owner: 베스트 프레임 안에서 VIP랑 차량,
   * unknown 이렇게 세 개 분류해서 확인할 수 있게 할 건지 · 데이터 > 모니터링에서 VIP랑 모르는
   * 사람 두 종류를 볼 수 있는데 그것도 권한 부여해서).
   *
   * Per screen rather than once for the whole app, which was the other way and was rejected: an
   * installation can reasonably let somebody read strangers out of the recorded set while keeping
   * them off the live monitoring wall, and one global switch cannot say that.
   *
   * 「모르는 사람」 is the one that carries weight. It is a face nobody enrolled, filmed and kept,
   * and an account that never needs to see one should not be shown one — the same line
   * `liveMonitoring` was split from `liveView` on.
   *
   * The Best Frame three have NO parent: that tab opens on either of its two rows (see
   * screensForActions), so there is no single action they hang from. Holding one with neither row
   * is inert rather than wrong — the tab does not open, so nothing is shown.
   */
  | "bestframeVip"
  | "bestframeVehicle"
  | "bestframeUnknown"
  | "history"
  /**
   * 데이터 → Re-ID 분석. Split from `trail` (2026-09-23, owner: 레드맵이랑 Re-ID 분석은 별개
   * 메뉴야 · 둘로 쪼개줘). One grant used to open both: a table of where one person appeared, and
   * a map drawing their route. They are separate menus in the app and separate jobs — an
   * investigator who should read sightings out of a table does not automatically need the map.
   * `trail` keeps the map, which is what its name always described.
   */
  | "reid"
  /** Searching on Re-ID 분석. Its own step for the same reason as `liveMonitoringSearch`. */
  | "reidSearch"
  /**
   * 데이터 → RedFace. THE SCREEN IS THE SEARCH, so it has no second step.
   *
   * RedFace only ever shows the result of a face search — there is no unsearched state to open
   * into (the tab's own gate says so: "a screen that only exists to show search results has
   * nothing to show without the permission"). A separate 「검색」 step under it would be a step
   * that can never be off while the screen is on, which is a control that lies about having two
   * states. Same for `trail`.
   */
  | "redface"
  | "trail";
/* `personSearch` used to be here and was deleted 2026-09-23 once its last reader was gone. It was
   one grant doing two jobs — opening RedFace and switching on three screens' search boxes — and it
   is now `redface` plus the two per-screen steps. Kept as a note rather than a member: a retired
   action left in the type is how a dead grant comes back to life in a seed. */

/**
 * ORDERED BY HOW MUCH THEY REVEAL ABOUT A PERSON, not by where they sit in the app.
 *
 * The owner's reason for splitting these at all is the second half of why (2026-09-21): 이렇게
 * 나누는건 업무를 나누는것도 있겟지만 개인정보 보호를 위해서 권한을 쪼개서 주는것도 이유.
 * So the list runs from the one view that contains no personal data at all to the two that
 * identify somebody and take their picture out of the building:
 *
 *   systemStatus            cameras and servers, up or down. NOBODY'S DATA IS IN IT.
 *   liveView                detections of REGISTERED people, happening now
 *   history                 the same, from before now
 *   liveMonitoring          everybody, registered or not — the heavier side of the same line
 *   liveMonitoringSearch    turns "someone was here" into "this person was here", on that screen
 *   reid / reidSearch       the same pair, on Re-ID 분석
 *   redface                 face search, which is the whole of that screen
 *   trail                   joins those into one person's route across the site
 *   export                  takes what the route found out of the console as a file
 *
 * A SECOND STEP IS NOT A WEAKER COPY OF ITS SCREEN. Watching and identifying are different
 * weights: an operator may legitimately need to see that somebody walked past without being able
 * to ask who it was. That distinction is what the split makes grantable (owner, 2026-09-23: 아 근데
 * 모니터링은 되는데 검색은 권한이 없는 사람이 생길 수 있겠다).
 *
 * `systemStatus` exists because the dashboard has two panels and only one of them is about
 * people: an IT operator who keeps 62 cameras online needs the SYSTEM panel and has no business
 * in the VIP feed (owner: 시스템 현황패널만 볼수있는 쪽일수도있고).
 *
 * SEEING THE PHOTOGRAPHS IS THE OBVIOUS NEXT ONE AND IT IS NOT HERE YET, deliberately. Portal
 * already separates "may read the registry" from "may look at the faces" (canViewFaces), and the
 * same line inside the app would be the strongest privacy control this product could offer: a
 * name, a place and a time can be legitimate to see while the photograph is not.
 *
 * It is absent because it cannot be added honestly in one sitting. Counted: 44 <img> renderers
 * across the app draw a face — Sidebar 4, MapView 4 (inside Leaflet HTML strings), DataPage 25,
 * RedmapPage 5, Best Frame 4, Navbar 2 — and a control covering forty of them is worse than none,
 * because the console would state that photographs are hidden while four screens still show them.
 * The way in is the two sources every one of those reads (`getFacePhoto` and `Person.photoUrl`),
 * gated once each, with a placeholder rather than a broken image. That is its own piece of work.
 */
/*
 * IN THE APP'S OWN MENU ORDER (2026-09-23, owner: 제일 위로 올려줘, 처음 랜딩 화면에서 볼 수
 * 있으니까). The app opens on 대시보드, so its two panels come first — 이벤트 before 시스템,
 * because the events panel is what the landing screen shows. Then 베스트 프레임, then the three
 * 데이터 sub-tabs in their own order, then 레드맵. A reader can check this list against the app's
 * menu bar top to bottom.
 */
export const APP_ACTIONS: AppAction[] = [
  "liveView", "dashboardTrail", "systemStatus",
  "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown",
  "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch",
  "reid", "reidSearch",
  "redface",
  "trail",
];

/**
 * WHICH GRANT IS A SECOND STEP ON ANOTHER ONE'S SCREEN, and which one it belongs to.
 *
 * A child cannot be held without its parent — not as a UI convenience but because it would name a
 * capability on a screen the account cannot open. `withAppActionDeps` is what enforces it, and it
 * is the one place that knows; a caller that builds an action set by hand passes it through.
 */
export const APP_ACTION_PARENT: Partial<Record<AppAction, AppAction>> = {
  dashboardTrail: "liveView",
  monitoringVip: "liveMonitoring",
  monitoringUnknown: "liveMonitoring",
  /* `liveMonitoringSearch` and `reidSearch` USED TO HANG OFF THEIR SCREEN and no longer do.
     While they did, 「검색만」 was not expressible: dropping the browse grant dropped the search
     with it. The two are now siblings — one opens the unsearched pane, the other opens the search
     — and `screensForActions` opens the tab for either. */
  /*
   * `export` IS GONE (owner, 2026-09-28: 내보내기 기능이 꼭 필요한가야.. → ① 앱에서 빼고 외부
   * 요청으로 일원화).
   *
   * It was a step on 레드맵, then briefly a grant across two screens once Best Frame gained the
   * same button. The question underneath was whether the app should have the door at all, and the
   * answer was no: the file carried no frame (`frame_sha256` null by design), said in its own
   * integrity notes that nothing in it proves which installation produced it, and went out with
   * `purpose: null` because the app never asked. Portal's 외부 요청 already releases material with
   * a legal basis, the requester's stated purpose, a decision note, the handover method, who
   * received it and whether third-party faces were obscured.
   *
   * One audited door instead of two, and the ungoverned one was the one that left.
   */
};

/**
 * A SCREEN WHOSE CONTENT IS ENTIRELY TYPED NEEDS AT LEAST ONE OF THE TYPES (owner, 2026-09-28:
 * 모니터링에 보기만 켜진 상태면 vip인식한거랑 모르는 사람 얼굴 찍힌걸 볼수없는거지? 그럼 그냥
 * 빈화면일텐데?).
 *
 * Yes — measured: DataPage filters `camDetailItems` by these two and nothing else, so 모니터링
 * with neither of them open the screen onto an empty list. The grant said "may open 모니터링" and
 * the screen said nothing at all.
 *
 * So the two are not optional extras under the screen; together they ARE the screen. Holding the
 * parent with neither is not a narrower permission, it is a broken one, and this is the table that
 * makes it unreachable.
 *
 * 베스트 프레임's three types (VIP · 차량 · 모르는 사람) have the same hole and are deliberately
 * NOT here: there the types sit beside two screens rather than under one, so which screen they
 * would take down with them is a decision, not a deduction.
 */
export const APP_ACTION_CONTENT: Partial<Record<AppAction, AppAction[]>> = {
  liveMonitoring: ["monitoringVip", "monitoringUnknown"],
};

/** Drops any child grant whose parent is not held, and any parent left with no content. Always run
 *  it before storing an action set. */
export function withAppActionDeps(actions: AppAction[]): AppAction[] {
  const held = new Set(actions);
  for (const [child, parent] of Object.entries(APP_ACTION_PARENT) as [AppAction, AppAction][]) {
    if (held.has(child) && !held.has(parent)) held.delete(child);
  }
  for (const [parent, content] of Object.entries(APP_ACTION_CONTENT) as [AppAction, AppAction[]][]) {
    if (held.has(parent) && !content.some(c => held.has(c))) {
      held.delete(parent);
      /* And with the screen goes its step — `liveMonitoringSearch` is a capability ON 모니터링. */
      for (const [child, p] of Object.entries(APP_ACTION_PARENT) as [AppAction, AppAction][]) {
        if (p === parent) held.delete(child);
      }
    }
  }
  return APP_ACTIONS.filter(a => held.has(a));
}

/**
 * Which screens these actions open.
 *
 * ONE MAPPING, HERE. Every screen in the app hosts one of the five actions; `redmap` and `reid`
 * both host the trail, which is why they arrive together. A reader who wants to know why a screen
 * is missing for somebody gets the answer from the action that is missing, not from a checkbox
 * nobody can account for.
 */
/**
 * WHETHER THE APP'S DASHBOARD OPENS. Its own rule, because the dashboard is not an `AppScreen` —
 * it is the app's landing page and it was gated by nothing at all (`tab === "DASHBOARD" ? true`
 * in ClientLayout), riding on the app door alone.
 *
 * That was a hole the permission screen could not see: the dashboard carries the live VIP feed,
 * today's detection count and the map of detections, so an account granted only, say, evidence
 * export still watched live activity there while the grant screen implied live viewing was
 * controlled (owner, 2026-09-21: 실시간 보기는 대시보드에도 데이터 모니터링 탭에도 해당하는
 * 내용이라서 그걸 모두 포함인건지..).
 *
 * It is live activity, so it belongs to `liveView` — and the grant rows say both places out loud
 * now. The camera scope already applied here (eventsVisibleTo), which is what made the gap worth
 * closing rather than accepting: the screen was honest about WHICH cameras and silent about
 * whether somebody may watch at all.
 */
export function dashboardOpensFor(actions: AppAction[]): boolean {
  return actions.includes("liveView") || actions.includes("systemStatus");
}

/**
 * The dashboard's two panels, gated one at a time.
 *
 * All-or-nothing on the dashboard was the wrong cut (owner: 아에 대시보드 내용 못보고 다른
 * 페이지로 랜딩되어야할수도있는거지 — and the other half of the same message: the SYSTEM panel on
 * its own is a legitimate landing). The EVENTS panel, the map pins and the VIP counts are
 * detections; the SYSTEM panel is cameras and servers. Two different questions, two grants.
 */
export function dashboardPanelsFor(actions: AppAction[]): { events: boolean; system: boolean } {
  return { events: actions.includes("liveView"), system: actions.includes("systemStatus") };
}

/**
 * Whether ONE camera is inside this account's scope — for the places that hold a camera id rather
 * than a list, the live alert being the one that matters (owner: 어떤 특정 카메라만 볼수있는
 * 경우엔 지도에 한 카메라의 데이터만 보게하고 토스트알럿도 그 카메라에 찍힌 vip만 떠야하거든).
 *
 * The map and the feed were already narrowed, because both read through eventsVisibleTo. A toast
 * has no list to filter: it arrives one detection at a time, so it asks about one camera.
 */
export function cameraInScope(cameraId: string, users: PortalUser[], groups: CameraGroup[]): boolean {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  if (!me) return true;
  const ids = scopedCameraIds(me, groups);
  return ids === null || ids.has(cameraId);
}

/**
 * The actions the signed-in account holds, for the components that need more than one of them.
 *
 * Same stand-in rule as everywhere else in this file: an identity that resolves to nobody holds
 * everything, so the mock stays explorable, and a real build reads the session.
 */
export function actionsOfSignedIn(users: PortalUser[]): AppAction[] {
  const me = users.find(u => u.email.toLowerCase() === SIGNED_IN_USER.email.toLowerCase());
  return me ? (me.appActions ?? []) : [...APP_ACTIONS];
}

/** The dashboard's panels for the signed-in account, as a hook for the app's own screens. */
export function useDashboardPanels(): { events: boolean; system: boolean } {
  const users = useVcaStore(s => s.portalUsers);
  return useMemo(() => dashboardPanelsFor(actionsOfSignedIn(users)), [users]);
}

export function screensForActions(actions: AppAction[]): AppScreen[] {
  const has = (a: AppAction) => actions.includes(a);
  return APP_SCREENS.filter(screen => {
    switch (screen) {
      /* EITHER STEP OPENS IT (owner, 2026-09-28: 데이터 > 모니터링에서 보기만하는 경우, 검색만
         하는경우 있을것같은데, 권한이 보기,검색 묶여있넹?).
         
         Right — and the two really are different screens inside one tab: before a search the pane
         is CameraDetailView, everybody who walked past; after one it is SmartSearchResults, only
         the person asked for. So 검색만 is not a narrower version of 보기, it is the other pane —
         and the tighter permission of the two, since it never shows the crowd. */
      case "live": return has("liveMonitoring") || has("liveMonitoringSearch");
      /* Either one opens the tab: the wall and the records are two things on one screen. */
      case "bestframe": return has("history") || has("liveWall");
      case "redface": return has("redface");
      case "reid": return has("reid") || has("reidSearch");
      case "redmap": return has("trail");
    }
  });
}

/**
 * How an account's app grants are decided: by following a preset, or by its own set.
 *
 * Stored, not a UI mode. Which one an account is in outlives the dialog that set it — a preset
 * account keeps receiving changes made to the preset, and that is the whole difference. A screen
 * that only remembered "the administrator clicked custom" would forget the relationship the next
 * time anybody opened it.
 */
export type GrantMode = "preset" | "custom";

/**
 * A named bundle of app grants, defined by the customer.
 *
 * DATA, NOT A CONSTANT, and on the same shelf as SearchPurpose and VipCategory — for the same
 * reason those two are: the vocabulary is the institution's. A control room that calls its people
 * 상황실장 and 판독관 should not be handed "Investigator" and told that is what they are.
 *
 * Team-scoped like SearchPurpose. One installation holds several teams, and a neighbouring team's
 * preset list leaks that organisation's job titles to people who have no business reading them.
 *
 * Presets grant nothing new. They name a combination of grants somebody could already hand out one
 * at a time, so `canManageAccess` — whoever may change the individual grants — may also name a
 * combination of them. Putting this behind canSetPolicy would mean calling the owner every time a
 * new job exists.
 */
export interface AccessPreset {
  id: string;
  teamId: string;
  /** The customer's own word. Never translated — see VipCategory.label. */
  label: string;
  /**
   * SET ONLY ON THE THREE WE SHIP, and the reason it exists (owner, 2026-09-21, on the English
   * console: 영어인데 한국어가 남아있어).
   *
   * `label` is customer data and data is not translated, which is right for a preset somebody
   * created. But the three seeded ones were written by us, so on the English console they read as
   * a Korean string nobody could account for. A key on the shipped ones lets the screen print a
   * product string for them (PRESET_BUILTIN_LABELS) while a customer's own preset keeps its
   * literal name in whatever language they typed.
   *
   * DROPPED THE MOMENT SOMEBODY RENAMES IT. Once the customer has named it, it is theirs and the
   * translation would overwrite their word — see updateAccessPreset.
   */
  builtinKey?: "operator" | "investigator";
  /** One line saying what this is for. Required: a list of names with no descriptions cannot be
   *  chosen from, which is the whole failure mode of removing the pre-selected default. */
  description: string;
  /** What this preset hands out. Screens follow from it — see APP_ACTIONS. */
  actions: AppAction[];
  /**
   * Retired rather than deleted, like an archived SearchPurpose. Accounts that followed it are
   * moved to "custom", which changes nobody's access — detaching copies nothing because following
   * a preset means already holding its grants.
   */
  archived?: boolean;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  teamId: string;
  projectIds: string[];
  permission: PortalPermission;
  /**
   * Which app screens this account may open. Undefined or empty means none.
   *
   * Nothing is inherited from the role: a Portal owner with app access and no screens sees no
   * screens. The door and what is behind it are two questions, and the console answers both out
   * loud rather than deducing one from the other.
   *
   * An account with the door and no screens is a real state the console has to handle rather than
   * prevent everywhere — bulk CSV invitations and server-made accounts never pass the screen that
   * makes zero impossible. See GateDenial "noScreens".
   */
  /**
   * What this account may do in the app. The screens it opens are derived from this
   * (screensForActions), and `appSearch`/`appExport` were folded in as two of the five.
   *
   * Absent is not "everything" here, unlike a camera scope: an account with the app door open and
   * no actions is the state the gate refuses, on purpose, because somebody bulk-invited it and
   * nobody has said yet what it is for. See AccessGate's "noScreens".
   */
  appActions?: AppAction[];
  /**
   * Which cameras of its projects this account may watch. UNDEFINED MEANS ALL OF THEM.
   *
   * Absent is the default and it is not the same as empty. Every account that exists today has no
   * value here and sees everything its projects hold, which is what it has always done — a new
   * optional field must not silently narrow anybody. `[]` is a real state meaning none, the same
   * way `appScreens: []` is, and the gate has to handle it rather than the forms preventing it
   * everywhere: bulk CSV invitations and server-made accounts do not pass a picker.
   *
   * ORTHOGONAL TO grantMode. A preset says which screens a job opens; which cameras it opens them
   * on is a fact about the site, not about the job, and the same job has different cameras at
   * different installations. So this is editable in preset mode too and a preset never carries it.
   *
   * Camera ids, not zones. A zone is a label an installer typed and can retype; scoping by it
   * would silently widen somebody's access the day a camera's zone is corrected — the same class
   * of mistake as joining detections to cameras by name.
   *
   * HANDOFF NOTE: the front end filtering a list is not the control. The server must scope the
   * streams and the search results it returns, or an account narrowed here still receives
   * everything and only the screen is hiding it.
   */
  cameraIds?: string[];
  /**
   * Camera GROUPS this account may watch, resolved to their members at read time.
   *
   * Two fields rather than one flattened list, because they answer differently to a change: a
   * group picks up the camera somebody adds to it next week, an individual id does not. Flattening
   * groups into `cameraIds` at save time would be Milestone's bulk stamp — see CameraGroup for why
   * this is the living kind instead.
   *
   * "EVERY CAMERA" IS BOTH FIELDS ABSENT. One of them being set is a narrowed account, and the
   * visible set is the union of the two (camerasVisibleTo). An empty array in either is still a
   * real answer ("no groups", "no individual cameras"), which is why absence is the only thing
   * that means everything.
   */
  cameraGroupIds?: string[];
  /**
   * Whether this account follows a preset or carries its own set, and which preset.
   *
   * `presetId` stays meaningful in "custom" too — it records where the account started, which is
   * what makes returning to the preset a sentence anybody can read ("back to Operator") rather
   * than a list of eleven toggles.
   */
  grantMode?: GrantMode;
  presetId?: string;
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
   * Set when this account was made or promoted to owner by the RECOVERY PATH, not by a person
   * with the power to grant. Absent on every normal account.
   *
   * HANDOFF: the server sets this, and only the server can — the browser has no way to know an
   * account came back through a console on the host. It is what the "clean this up" notice on the
   * Overview reads, and the notice is the point: a recovered owner is a door that was opened from
   * outside the product's own rules, and it should not quietly become the installation's normal
   * state. Clear it when a second, normally-granted owner exists.
   *
   * Portal never writes this. There is no screen that could, and an account able to mark itself
   * recovered would be a way to wear the badge without the event having happened.
   */
  recoveredAt?: string;
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
/**
 * Somebody outside the institution asking for footage.
 *
 * Not the same thing as AccessRequest below, which is a person asking for a console account.
 * This is a police officer with a case number, an insurer, a lawyer, or the person who was
 * recorded asking for their own footage — and the answer to all of them is a copy of recorded
 * video leaving the institution.
 *
 * WHY THIS SCREEN EXISTS AT ALL. The request arrives whether or not the product has a place for
 * it, and without one the operator does the obvious thing: plays the footage back and records the
 * screen, or exports the whole clip with every passer-by's face in it. Both are worse than the
 * thing this replaces — a system that offers no safe route does not prevent the release, it only
 * stops being able to describe it afterwards.
 *
 * WHAT THE CONSOLE DOES AND DOES NOT DO. It records the request, the decision and the release. It
 * does NOT redact: blurring the faces of everyone who is not the subject is video processing, and
 * a browser cannot do it and must not claim to. `redaction` below records who did it and how, as
 * a statement by the person releasing the file — which is exactly what the register of a paper
 * process holds, and is honest about being a claim rather than a verified fact.
 *
 * NOT THE SAME RECORD AS the app's old evidence export (removed 2026-09-28), and it must not
 * become one. That one was a single
 * detection's metadata pulled out of Redmap by an operator; this is a window of recorded video
 * going to somebody outside. They answer different questions and neither is a subset of the
 * other — one request can involve several extractions, and most extractions answer no request at
 * all. If a future version lets a request cite specific detections, the citation is a reference:
 * the extraction stays the record of what left, and this stays the record of who asked and what
 * was decided. Writing "who took what, when" in both places is how two logs end up disagreeing,
 * and an audit reads a disagreement as a missing record. Raised by the session working the app
 * side while this was being built.
 *
 * HANDOFF NOTE: the server owns the rest. Producing the redacted file, storing it against this
 * record, and enforcing that a release cannot be marked done without one. Until then this is a
 * register the institution fills in — which is still the difference between a release nobody can
 * account for and one that has a row.
 */
/**
 * Somebody asking to have their own data removed.
 *
 * The hard part is not the workflow, it is that "delete my data" has no single answer here. This
 * product holds seven different kinds of record about a person and they do not all deserve the
 * same fate — some must go, some must stay precisely BECAUSE the person asked, and two are
 * genuinely undecided policy questions that nobody should guess at.
 *
 * So this screen does not decide. It lays out every category the product actually holds, states
 * what is settled and why, and leaves the unsettled ones visibly unsettled. An institution fills
 * in the rest, and the gap is on screen instead of in somebody's head.
 *
 * THE TWO THAT ARE NOT OURS TO ANSWER are marked out-of-reach rather than undecided, which is a
 * different admission: an evidence file already exported is a copy outside this console, and the
 * recordings themselves belong to the recorder. The console can say who holds them. It cannot
 * reach them, and a screen that offered to would be lying.
 */
export type ErasureDisposition =
  /** Removed when this request is carried out. */
  | "erase"
  /** Kept on purpose, with a reason the institution can state out loud. */
  | "retain"
  /** A policy question nobody has answered. Left visible rather than defaulted. */
  | "undecided"
  /** Not the console's to delete. Named so its absence is not read as an oversight. */
  | "out-of-reach";

export type ErasureCategory =
  | "watchlist" | "detections" | "searchLog" | "judgements"
  | "exports" | "footageReleases" | "auditLog" | "recordings";

/**
 * What the product holds, and where each category stands before anybody decides.
 *
 * The defaults are not guesses — each one is a position already taken elsewhere in this codebase,
 * and the two `undecided` are the ones the product review flagged as genuinely open. Changing a
 * default here is changing the institution's stance, which is why they are written once, with
 * their reasons, rather than repeated in a screen.
 */
export const ERASURE_DEFAULTS: Record<ErasureCategory, ErasureDisposition> = {
  // The ask itself, and the console already knows how to do it — releasing someone from the
  // registry is an existing, audited action.
  watchlist: "erase",
  // Open. Deleting them destroys the record of what the system did about this person; keeping
  // them keeps biometric-derived rows about somebody who asked to be forgotten. Both directions
  // have a real argument and the product has no standing to pick one.
  detections: "undecided",
  // Kept, and kept FOR them. This is the log of who looked this person up and on what stated
  // grounds — the record that protects the subject. Erasing it on the subject's own request
  // destroys their evidence, which is why removeProject stopped deleting it too.
  searchLog: "retain",
  // Open, and tied to the detections above: a verdict about a detection cannot outlive it.
  judgements: "undecided",
  // Already outside. The file left the console; only the row saying who took it remains, and
  // that row is how anybody knows to go ask for the copy back.
  exports: "out-of-reach",
  // Kept. It is the record of video handed to a third party about this person — the one thing a
  // complaint by this very person would need.
  footageReleases: "retain",
  // Kept, for the reason written at removeProject: a deletion that erases the record of
  // everything leading up to it is not a deletion, it is a cover-up.
  auditLog: "retain",
  // The recorder's, not the console's. Governed by the retention period, not by this screen.
  recordings: "out-of-reach",
};

export type ErasureRequestStatus = "received" | "completed" | "refused";

export interface ErasureRequest {
  id: string;
  projectId: string;
  /** Who is asking to be erased, as they identified themselves. */
  subjectName: string;
  /** How they were identified — an ID document, a case number, a registry entry. */
  subjectReference: string;
  receivedAt: string;
  receivedBy: string;
  status: ErasureRequestStatus;
  /** Per-category positions for THIS request. Seeded from ERASURE_DEFAULTS, overridable, and an
   *  "undecided" left as it is means the request cannot be closed — which is the point. */
  dispositions: Record<ErasureCategory, ErasureDisposition>;
  notes?: string;
  closedAt?: string;
  closedBy?: string;
  closingNote?: string;
}

export type FootageRequestStatus = "received" | "approved" | "refused" | "released";

/** What entitles the requester to ask. Named, because "we gave it to the police" is not a basis. */
export type FootageRequestBasis = "warrant" | "police-request" | "data-subject" | "insurance" | "other";

export interface FootageRequest {
  id: string;
  projectId: string;
  /** Who is asking, and for which organisation. Free text: the console cannot know their register. */
  requesterName: string;
  requesterOrg: string;
  basis: FootageRequestBasis;
  /** Case, warrant or document number. Required for every basis except a data subject's own. */
  reference?: string;
  /** What was asked for — the site's own clock, and the place in the institution's words. */
  fromAt: string;
  toAt: string;
  cameraNote: string;
  /** Why they say they need it. The requester's words, kept as given. */
  purpose: string;
  status: FootageRequestStatus;
  receivedAt: string;
  receivedBy: string;
  /** Set when the decision is made. A refusal without a reason is not a decision anyone can review. */
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  /** Set when the file actually leaves. */
  releasedAt?: string;
  releasedBy?: string;
  /** How it was handed over — encrypted media, secure transfer, collected in person. */
  releaseMethod?: string;
  /** Who physically received it, if that is a different person from the requester. */
  releasedTo?: string;
  /**
   * Whether third-party faces were obscured before release, and by what.
   *
   * A claim by the releaser, not something this product verified — see the note above. Recorded
   * because a release with no answer here is the one a regulator asks about first.
   */
  redaction?: { done: boolean; method: string };
}

/**
 * Five requests on the Marina Bay site, so the register opens with something to read.
 *
 * Chosen to cover the states the screen actually behaves differently in rather than to look busy:
 * one release that went out, one still undecided, one refused; one erasure closed and one that
 * CANNOT be closed because two categories are still undecided. That last row is the point of the
 * screen — an erasure request with an open category refuses to close, and a register seeded only
 * with tidy finished rows would never show it.
 *
 * Not translated, like every other seed: these are records an institution wrote, not UI copy.
 */
const SEED_FOOTAGE_REQUESTS: FootageRequest[] = [
  {
    id: "fr-seed-1", projectId: "proj-sg",
    requesterName: "Insp. Daniel Koh", requesterOrg: "Police — Central Division",
    basis: "warrant", reference: "WRT-2026-0918",
    fromAt: "2026-09-03 22:10", toAt: "2026-09-03 23:40",
    cameraNote: "Bayfront Ave / Marina Link — entrance cameras",
    purpose: "Aggravated theft at the Bayfront underpass; suspect left on foot towards Marina Link.",
    status: "released",
    receivedAt: "2026-09-04T01:22:00.000Z", receivedBy: "Grace Tan",
    decidedAt: "2026-09-04T06:40:00.000Z", decidedBy: "Grace Tan",
    decisionNote: "Warrant checked against the issuing court's reference. Window narrowed to the 90 minutes named in it.",
    releasedAt: "2026-09-05T02:05:00.000Z", releasedBy: "Aaron Sim",
    releaseMethod: "Encrypted drive, collected in person",
    releasedTo: "Sgt. Rahim Yusof (Central Division)",
    redaction: { done: true, method: "Third-party faces blurred by the recorder's export tool before handover" },
  },
  {
    id: "fr-seed-2", projectId: "proj-sg",
    requesterName: "Claire Devi", requesterOrg: "Pacific Assurance — Claims",
    basis: "insurance", reference: "CLM-88214",
    fromAt: "2026-09-08 07:30", toAt: "2026-09-08 08:15",
    cameraNote: "Raffles Quay junction, kerbside camera",
    purpose: "Vehicle damage claim; the policyholder says the collision happened at the kerb outside the office tower.",
    status: "received",
    receivedAt: "2026-09-09T08:12:00.000Z", receivedBy: "Aaron Sim",
  },
  {
    id: "fr-seed-3", projectId: "proj-sg",
    requesterName: "Marcus Tay", requesterOrg: "(individual)",
    basis: "data-subject",
    fromAt: "2026-08-29 00:00", toAt: "2026-08-29 23:59",
    cameraNote: "All CBD cameras",
    purpose: "Asked for a full day of footage of himself to support a workplace grievance.",
    status: "refused",
    receivedAt: "2026-08-31T03:40:00.000Z", receivedBy: "Grace Tan",
    decidedAt: "2026-09-01T07:15:00.000Z", decidedBy: "Grace Tan",
    decisionNote: "A whole day across every camera would hand over hundreds of uninvolved people. Offered instead to narrow it to a time and place he can name; no reply yet.",
  },
];

const SEED_ERASURE_REQUESTS: ErasureRequest[] = [
  {
    id: "er-seed-1", projectId: "proj-sg",
    subjectName: "Priya Nair", subjectReference: "NRIC last 4: 812J · letter dated 2026-09-02",
    receivedAt: "2026-09-05T04:30:00.000Z", receivedBy: "Grace Tan",
    status: "received",
    dispositions: { ...ERASURE_DEFAULTS },
    notes: "Says she was added to the watchlist after a dispute at a tenant event and wants everything about her removed.",
  },
  {
    id: "er-seed-2", projectId: "proj-sg",
    subjectName: "Hafiz Rahman", subjectReference: "Contractor pass CT-4471, ended 2026-07-31",
    receivedAt: "2026-08-12T02:10:00.000Z", receivedBy: "Aaron Sim",
    status: "completed",
    dispositions: { ...ERASURE_DEFAULTS, detections: "erase", judgements: "erase" },
    closedAt: "2026-08-20T09:05:00.000Z", closedBy: "Grace Tan",
    closingNote: "Contract ended; no open matter names him. Detections and the verdicts on them erased together — a verdict about a detection cannot outlive it. Search log and release records kept, and he was told why.",
  },
];

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  projectId: string;
  reason?: string;
  requestedAt: string;
}

const PORTAL_USERS: PortalUser[] = [
  { id: "user-1", name: "Grace Tan", email: "grace.tan@univs.ai", employeeId: "EMP-2041", teamId: "team-univs", projectIds: ["proj-sg", "proj-riverside"], permission: "owner", appAccess: true, appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], grantMode: "preset", presetId: "preset-investigator", status: "active", lastLoginAt: "2026-08-25 09:14" },
  { id: "user-2", name: "Marcus Lee", email: "marcus.lee@univs.ai", employeeId: "EMP-2042", teamId: "team-univs", projectIds: ["proj-sg"], permission: "none", appAccess: true, appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], grantMode: "preset", presetId: "preset-investigator", status: "active", lastLoginAt: "2026-08-24 18:02" },
  // Admin who also works the app — the combination the single-field model could not hold.
  { id: "user-3", name: "Nadia Rahman", email: "nadia.rahman@univs.ai", employeeId: "EMP-2043", teamId: "team-univs", projectIds: ["proj-riverside"], permission: "admin", appAccess: true, appActions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"], grantMode: "preset", presetId: "preset-operator", status: "active", lastLoginAt: "2026-08-20 11:47" },
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

// Mock stand-in for an Excel-imported staff roster. Three code statuses across both projects, so
// the tab's status filter has something in every bucket from first load.
//
// NO CODELESS ROWS ANY MORE (2026-09-23, owner: 자동 발급이 되니까 없어야지). Seven rows used to sit
// at "not-issued" — on the list with no code — and the console can no longer produce that state:
// 「등록 코드로 추가」 issues on save, and the CSV import issues for every row it accepts. Seeding a
// state the product cannot reach is the same mistake ACCESS_REQUESTS records above: it teaches
// whoever reads the screen that the list means something it does not, and here it also left two
// buttons on screen (the row's 「코드 발급」 and the toolbar's 「코드 N개 발급」) for work that never
// exists.
//
// The TYPE still allows it and so does the server contract — a row handed over by the server with
// no code is possible, and then those two buttons are how it gets one. The console just never
// writes one itself.
/*
 * THE ROWS CARRY THE GRANTS THE PANEL WOULD HAVE WRITTEN (2026-09-28).
 *
 * A row created through 등록 코드로 추가 now answers four questions, so seeds that answer none of
 * them would show every row in 가입 대기 as 「권한 없음」 — a console that looks broken on first
 * open, describing a state the product no longer produces.
 *
 * EMP-3008 and EMP-3010 are LEFT WITHOUT ON PURPOSE. That is the Excel import's row: the
 * spreadsheet has a 「권한」 column with two values and no column for app grants, so nobody
 * answered the question and the person would arrive at an app with no screens. The table says so
 * in red, before the code is handed over, which is the whole reason that state is drawn.
 */
const STAFF_ROSTER: RosterEntry[] = [
  { employeeId: "EMP-3001", name: "James Whitfield", department: "Control Room", projectId: "proj-sg", permission: "admin", status: "unused", accessMode: "both", portalRole: "admin", grantMode: "preset", presetId: "preset-investigator", appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], code: "FQ4M7XB2", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3002", name: "Priya Nair", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "unused", accessMode: "appOnly", grantMode: "preset", presetId: "preset-operator", appActions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"], code: "BPXW4762" },
  { employeeId: "EMP-3003", name: "Daniel Cruz", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", accessMode: "appOnly", grantMode: "preset", presetId: "preset-operator", appActions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"], code: "HKLM9234" },
  { employeeId: "EMP-3004", name: "Farah Ismail", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", accessMode: "appOnly", grantMode: "preset", presetId: "preset-investigator", appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], code: "TN8R3KD5", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3005", name: "Tom Reyes", department: "Field Engineering", projectId: "proj-sg", permission: "operator", status: "used", accessMode: "appOnly", grantMode: "preset", presetId: "preset-operator", appActions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"], code: "QRST5678" },
  { employeeId: "EMP-3006", name: "Lena Brooks", department: "Field Engineering", projectId: "proj-sg", permission: "operator", status: "unused", accessMode: "appOnly", grantMode: "preset", presetId: "preset-operator", appActions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"], code: "YC6V9HJ4", issuedAt: "2026-09-20T09:00:00+08:00" },
  // Issued long enough ago that REGISTRATION_CODE_TTL_DAYS has passed: the row still says
  // "unused", and effectiveCodeStatus() is what turns it into "expired". Stored-as-expired is not
  // used in the seeds any more — it could never demonstrate that expiry actually works.
  { employeeId: "EMP-3007", name: "Marcus Ho", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "unused", accessMode: "appOnly", grantMode: "preset", presetId: "preset-investigator", appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], code: "VXYZ2345", issuedAt: "2026-07-15T09:00:00+08:00" },
  { employeeId: "EMP-3008", name: "Aisha Bakar", department: "Operations", projectId: "proj-sg", permission: "operator", status: "unused", code: "JKMN6789" },
  { employeeId: "EMP-3009", name: "Ryan Tavares", department: "Field Engineering", projectId: "proj-sg", permission: "admin", status: "unused", accessMode: "both", portalRole: "admin", grantMode: "preset", presetId: "preset-investigator", appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], code: "MZ2K5QP7", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3010", name: "Sana Idris", department: "Control Room", projectId: "proj-sg", permission: "operator", status: "used", code: "CDFG3456" },
  { employeeId: "EMP-3011", name: "Emily Foster", department: "Operations", projectId: "proj-riverside", permission: "admin", status: "unused", accessMode: "both", portalRole: "admin", grantMode: "preset", presetId: "preset-investigator", appActions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"], code: "RB9T4LN6", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3012", name: "Kevin Ng", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "LMPQ8765" },
  { employeeId: "EMP-3013", name: "Hana Suzuki", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "unused", code: "DX7J2WF8", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3014", name: "Oliver Grant", department: "Operations", projectId: "proj-riverside", permission: "operator", status: "used", code: "RSTU4325" },
  { employeeId: "EMP-3015", name: "Mei Lin Tan", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "WXYZ9876" },
  { employeeId: "EMP-3016", name: "Diego Alvarez", department: "Field Engineering", projectId: "proj-riverside", permission: "operator", status: "unused", code: "ABCD5432", issuedAt: "2026-07-02T09:00:00+08:00" },
  { employeeId: "EMP-3017", name: "Chloe Bennett", department: "Operations", projectId: "proj-riverside", permission: "operator", status: "unused", code: "GK3P8SV5", issuedAt: "2026-09-20T09:00:00+08:00" },
  { employeeId: "EMP-3018", name: "Yusuf Karim", department: "Control Room", projectId: "proj-riverside", permission: "operator", status: "unused", code: "EFGH6543" },
];

/**
 * Seeded keys, so the screen has the three states in it: one working, one that ran out, one
 * somebody pulled.
 *
 * Fixed dates and fixed prefixes, like every other seed here — a prefix generated at module load
 * would differ between the server's render and the browser's, which is the mismatch that cost a
 * morning on the VIP tab. The secrets these prefixes belong to never existed.
 */
const API_KEYS: ApiKey[] = [
  { id: "apikey-1", projectId: "proj-sg", name: "Control room dashboard", scope: "read", prefix: "vca_a41c9f2b", createdAt: "2026-08-14T10:22:00+08:00", createdBy: "Grace Tan", expiresAt: "2027-08-14" },
  { id: "apikey-2", projectId: "proj-sg", name: "Nightly export job", scope: "readwrite", prefix: "vca_7d0e5a13", createdAt: "2026-06-02T09:05:00+08:00", createdBy: "Marcus Lee", expiresAt: "2026-09-01" },
  { id: "apikey-3", projectId: "proj-sg", name: "Integrator trial", scope: "read", prefix: "vca_11b8c6d4", createdAt: "2026-05-20T15:40:00+08:00", createdBy: "Grace Tan", expiresAt: null, revokedAt: "2026-07-01T14:03:00+08:00" },
  { id: "apikey-4", projectId: "proj-riverside", name: "Campus attendance sync", scope: "read", prefix: "vca_c93f0ae7", createdAt: "2026-07-11T08:15:00+08:00", createdBy: "Nadia Rahman", expiresAt: "2027-07-11" },
];

/**
 * Seeded groups, so the permission screens have something real to hand out.
 *
 * Fixed ids and fixed dates like every other seed here. The membership is written as camera ids
 * that exist in CAMERAS above; a group naming a camera that was deleted is exactly the state
 * `pruneCameraGroups` keeps out.
 */
const CAMERA_GROUPS: CameraGroup[] = [
  /* ONE OF THE THREE CARRIES A PURPOSE LINE, ON PURPOSE. `description` is optional and a card with
     none renders nothing, so both states have to exist in the seed or the screen only ever shows
     one of them — and the one it would show is the empty one. */
  { id: "cgroup-1", projectId: "proj-sg", label: "오차드·부기스 라인", description: "중심 상업지구 보행로와 MRT 출입구", cameraIds: ["cam-orchard", "cam-bugis", "cam-novena"], createdAt: "2026-09-02T10:00:00+08:00", createdBy: "Grace Tan" },
  { id: "cgroup-2", projectId: "proj-sg", label: "Geylang 일대", cameraIds: ["cam-geylang", "cam-geylang-2"], createdAt: "2026-09-02T10:04:00+08:00", createdBy: "Grace Tan" },
  { id: "cgroup-3", projectId: "proj-riverside", label: "정문·후문", cameraIds: [], createdAt: "2026-09-05T09:10:00+08:00", createdBy: "Nadia Rahman" },
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
    lat: 1.3202, lng: 103.8440, maker: "Hanwha", resolution: "4K (3840×2160)", kind: "normal" as CameraKind },
  {
    id: "cam-geylang", projectId: "proj-sg", code: "CAM-GEY-001", name: "Geylang NC1",
    ip: "10.20.4.12", mac: "00:1B:44:11:3A:B8", rtspUrl: "rtsp://10.20.4.12:554/stream1",
    status: "online", location: "Geylang NC1, Singapore", zone: "Geylang",
    serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3148, lng: 103.8778, maker: "Hikvision", resolution: "FHD (1920×1080)", kind: "normal" as CameraKind },
  {
    // NC1 IMPLIES NC2, and a seed trail was already naming it. "Geylang" + "NC2" resolved to
    // nothing and fell through to the first camera in the register, so James Wilson's two-camera
    // trail was filed against Novena. The register is the one population (2026-09-10), so the
    // fix is the camera existing rather than the trail being rewritten — the two-cameras-at-one-
    // site case is why TrackingHop carries cameraLabel and why hopCameraKey exists at all.
    // Same site as NC1, ~180m along the road: close enough to be the same zone, far enough that
    // the trail between them is a real two-point route rather than one pin drawn twice.
    id: "cam-geylang-2", projectId: "proj-sg", code: "CAM-GEY-002", name: "Geylang NC2",
    ip: "10.20.4.22", mac: "00:1B:44:11:3A:C2", rtspUrl: "rtsp://10.20.4.22:554/stream1",
    status: "online", location: "Geylang NC2, Singapore", zone: "Geylang",
    serverId: "srv-1",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3163, lng: 103.8791, maker: "Hikvision", resolution: "FHD (1920×1080)", kind: "normal" as CameraKind },
  {
    id: "cam-orchard", projectId: "proj-sg", code: "CAM-ORC-001", name: "Orchard MRT",
    ip: "10.20.4.13", mac: "00:1B:44:11:3A:B9", rtspUrl: "rtsp://10.20.4.13:554/stream1",
    status: "online", location: "Orchard MRT, Singapore", zone: "Orchard",
    serverId: "srv-2",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.3044, lng: 103.8321, maker: "Dahua", resolution: "4K (3840×2160)", kind: "ai" as CameraKind },
  {
    id: "cam-bugis", projectId: "proj-sg", code: "CAM-BGS-001", name: "Bugis MRT",
    ip: "10.20.4.14", mac: "00:1B:44:11:3A:BA", rtspUrl: "rtsp://10.20.4.14:554/stream1",
    status: "online", location: "Bugis MRT, Singapore", zone: "Bugis",
    serverId: "srv-2",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3006, lng: 103.8561, maker: "Hanwha", resolution: "FHD (1920×1080)", kind: "ai" as CameraKind },
  {
    id: "cam-tampines", projectId: "proj-sg", code: "CAM-TPS-001", name: "Tampines Hub",
    ip: "10.20.4.15", mac: "00:1B:44:11:3A:BB", rtspUrl: "rtsp://10.20.4.15:554/stream1",
    status: "online", location: "Tampines Hub, Singapore", zone: "Tampines",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.3528, lng: 103.9440, maker: "Hikvision", resolution: "4K (3840×2160)", serverId: "srv-1", kind: "normal" as CameraKind },
  {
    id: "cam-bedok", projectId: "proj-sg", code: "CAM-BDK-001", name: "Bedok MRT",
    ip: "10.20.4.16", mac: "00:1B:44:11:3A:BC", rtspUrl: "rtsp://10.20.4.16:554/stream1",
    status: "offline", location: "Bedok MRT, Singapore", zone: "Bedok",
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    lat: 1.3240, lng: 103.9302, maker: "Dahua", resolution: "FHD (1920×1080)", serverId: "srv-1", kind: "normal" as CameraKind },
  {
    id: "cam-queenstown", projectId: "proj-sg", code: "CAM-QTN-001", name: "Queenstown",
    ip: "10.20.4.17", mac: "00:1B:44:11:3A:BD", rtspUrl: "rtsp://10.20.4.17:554/stream1",
    status: "online", location: "Queenstown, Singapore", zone: "Queenstown",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    lat: 1.2942, lng: 103.8060, maker: "Hanwha", resolution: "4K (3840×2160)", serverId: "srv-5", kind: "normal" as CameraKind },
  // Reachable and refusing — see the CameraStatus note. Seeded because the state has to be visible
  // somewhere for the table, the filter and the attention strip to be worth building.
  {
    id: "cam-phone-test", projectId: "proj-sg", code: "CAM-TMP-901", name: "Phone test",
    ip: "192.168.0.36", mac: "00:1B:44:11:3A:C1", rtspUrl: "rtsp://192.168.0.36:554/stream1",
    status: "error", location: "Control Room, Singapore", zone: "Marina Bay",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    lat: 1.2830, lng: 103.8600, maker: "Hanwha", resolution: "FHD (1920×1080)",
    /* THE ONE ROW WITH NO SERVER, on purpose. The form now demands one, but a register carried
       over from an older install has rows that predate the rule — the same reason the coordinate
       one keeps its blank (see Depot Bay 2). Without it the 서버 column could never render its
       empty state, and the next person to read this file would take the column for mandatory. */
  },
  {
    id: "cam-jurong-east", projectId: "proj-sg", code: "CAM-JRE-001", name: "Jurong East",
    ip: "10.20.4.18", mac: "00:1B:44:11:3A:BE", rtspUrl: "rtsp://10.20.4.18:554/stream1",
    status: "offline", location: "Jurong East, Singapore", zone: "Jurong East",
    thumbnail: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
    lat: 1.3329, lng: 103.7436, maker: "Hikvision", resolution: "FHD (1920×1080)", serverId: "srv-2", kind: "ai" as CameraKind },
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
        /*
         * EVERY CAMERA REPORTS TO A SERVER, because the form now refuses to register one without
         * saying which (2026-09-18). This pool had none at all, so the register's 서버 column
         * printed "—" on fifty-odd of sixty-two rows and read as a column nobody fills in —
         * which is how it nearly got deleted as "a value identical on every row".
         *
         * The three that take a stream, by ServerType: Face Recognition, AI Camera, Normal
         * Camera. Not the image store and not the database, which is where results land rather
         * than where a camera reports — the picker refuses those too.
         *
         * Deterministic per camera, like everything else in this generator. Weighted toward the
         * face-recognition node because that is what this deployment is for.
         */
        serverId: ["srv-1", "srv-1", "srv-5", "srv-1", "srv-2", "srv-1", "srv-5"][idx % 7],
        /* Paired with the server above, not rolled separately: the one on the AI node is the AI
           camera. A seed that breaks its own rule is a seed that teaches the rule wrong. */
        kind: (["normal", "normal", "normal", "normal", "ai", "normal", "normal"] as CameraKind[])[idx % 7],
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
      // A face-recognition node analyses the stream, so these are plain cameras. See CameraKind.
      kind: "normal" as CameraKind,
      thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
      lat: Math.round((1.3410 + i * 0.0008) * 10000) / 10000,
      lng: Math.round((103.8080 + i * 0.0011) * 10000) / 10000,
      maker: "Hanwha",
      resolution: "FHD (1920×1080)",
    })),
  /**
   * ONE CAMERA WITH NO POSITION, and it goes last on purpose.
   *
   * Camera.lat/lng became optional because all three doors that register a camera can leave them
   * empty — the CSV import says so out loud ("the map placement is the thing that gets filled in
   * later, not the camera"). But every seeded camera had coordinates, so nothing in the product
   * ever rendered the absent case: not the map's filter, not a route's missing stop, not a scope
   * picker's "not on the map" group. A state the seeds never produce is a state QA never sees,
   * and this repo has already lost one that way — ee4b04c built a "not on the map" column that
   * showed nothing but 0 until 7af49e0 deleted it.
   *
   * LAST IN THE ARRAY, not first. CAMERAS[0] used to be the silent fallback for an unresolved
   * name (see cameraIdForSeedHit), and a camera with no position sitting at index 0 would have
   * turned that fault into a worse one. The fallback is gone now, but the ordering dependency is
   * worth not re-creating.
   *
   * Offline, because a camera nobody has surveyed is usually a camera nobody has finished
   * installing. Its zone is filled in — the register knows where it belongs organisationally,
   * which is exactly the split this state is about: a place in the list, no place on the map.
   */
  {
    id: "cam-depot-2", projectId: "proj-sg", code: "CAM-DEP-002", name: "Depot Bay 2",
    ip: "10.20.9.42", mac: "00:1B:44:11:5D:22", rtspUrl: "rtsp://10.20.9.42:554/stream1",
    status: "offline", location: "Depot Bay 2", zone: "Kallang",
    serverId: "srv-1",
    thumbnail: "",
    maker: "Hanwha", resolution: "FHD (1920×1080)", kind: "normal" as CameraKind },
];

/**
 * Last-signal times, seeded onto the cameras above rather than typed into all 59 of them.
 *
 * Online cameras reported within the last few minutes. Offline ones spread from a few hours to
 * about a fortnight, because that spread IS the information — nine cameras that all dropped this
 * morning is a network fault and nine that have been dark for two weeks is a fleet nobody is
 * maintaining, and a count of nine says neither. The registry's 오프라인 cell reads the worst of
 * them and prints it ("가장 오래 12일"), which it could not do while every offline camera in the
 * seed had answered within half a day.
 *
 * Deterministic per camera (the index, not a random), and expressed through auditAt like every
 * other relative timestamp in this file: the value is fixed at module load, so a screen must only
 * render it after mount — which is what the Overview's nowMs gate already does for the audit log.
 */
const CAMERAS: Camera[] = CAMERA_SEEDS.map((c, i) => ({
  ...c,
  lastSeenAt: auditAt(c.status === "online" ? 1 + (i % 5) : 60 * (3 + (i * 37) % 300)),
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

/**
 * The register entry a seed detection names. Throws if there is none.
 *
 * THREE THINGS WERE WRONG HERE, and only the first one was visible as code.
 *
 * 1. `?? CAMERAS[0].id`. A location naming no camera was filed against whatever sat first in the
 *    register, and two readers take that id: the event's own `cameraId` — which `eventsInProject`
 *    turns into a SITE BOUNDARY — and the derived `Person.projectId`. So a failed string match
 *    decided which site a watched person belonged to, in a product where another project is
 *    another customer. It stayed hidden for two reasons: CAMERAS[0] is Novena in proj-sg, which
 *    is where those rows plausibly belonged anyway, and the one screen that could have shown it
 *    (CameraStreamModal's per-camera detection count) shows counts and a last-seen time, never
 *    the detections' own locations. Novena's panel was counting three foreign detections and its
 *    timestamp did not visibly move because Novena had a real recent one of its own.
 *
 * 2. It joined on `location` alone, ignoring `cameraLabel`. A hit at "Geylang" + "NC1" could
 *    never match the register's "Geylang NC1" — the two halves of the name were sitting right
 *    there. Joining the pair is what makes this resolvable at all.
 *
 * 3. THE LOOKUP HAD NO PROJECT SCOPE, and that is the cross-tenant path. Camera CODES are unique
 *    (generateCameraCode guarantees it); names guarantee nothing, and the register already holds
 *    fifteen suffix-less names across two projects — "Main Gate", "Car Park", "Rear Gate" and
 *    the rest belong to the school. A seed that said "Car Park" would have filed a Singapore
 *    detection against Riverside, with no error and a plausible-looking result. Scoped to the
 *    project the seeds belong to, that cannot happen.
 *
 * It throws rather than returning undefined because the input is STATIC. These seeds are checked
 * in: what resolves in dev resolves in prod, so there is no runtime state to degrade gracefully
 * for — a failure here is a committed bug, and the app refusing to start is how the next person
 * who adds a location line finds out. Returning undefined was considered and rejected: `cameraId`
 * is required on VcaEvent and it is the site boundary, and unlike a missing coordinate (a real
 * state — see Camera.lat) "a detection with no camera" does not exist.
 */
const SEED_PROJECT_ID = "proj-sg";
function cameraIdForSeedHit(hit: { location: string; cameraLabel?: string }): string {
  const scoped = CAMERAS.filter(c => c.projectId === SEED_PROJECT_ID);
  const fullName = hit.cameraLabel ? `${hit.location} ${hit.cameraLabel}` : hit.location;
  const camera = scoped.find(c => c.name === fullName)
    ?? (hit.cameraLabel ? undefined : scoped.find(c => c.name === hit.location));
  if (!camera) {
    throw new Error(
      `Seed detection names no registered camera in ${SEED_PROJECT_ID}: "${fullName}". ` +
      `Seeds bind to the register (2026-09-10) — add the camera or use an existing name.`,
    );
  }
  return camera.id;
}

// Seeded from mockData's liveEvents — the ONE raw event list — so the store starts already
// consistent with what the Dashboard/Sidebar show, instead of inventing a second baseline.
const SEED_EVENTS: VcaEvent[] = liveEvents.map((e) => ({
  id: `evt-seed-${e.id}`,
  cameraId: cameraIdForSeedHit(e),
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
 * VIP registry that only four cameras can match is *supposed* to leave most rows untouched in a given
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

/**
 * When this person was put on the list, spread deterministically per person.
 *
 * It used to be `?? "2026-01-01"` — one literal for everyone the registry derives from live
 * events, which is fourteen of the fifteen. Three screens read it and all three went wrong: the
 * overview's 오늘 / 어제 / 이번 달 등록 counts were structurally zero, the table's sort had nothing
 * to sort by, and an auditor reading a column of identical dates concludes the whole watchlist was
 * bulk-imported on New Year's Day. It is also the first question an audit asks — since when has
 * this face been watched — and it leaves the building in the CSV export.
 *
 * Seeded, not invented: the spread is a function of the person's own id, so it is stable across
 * reloads and every screen agrees. Six months back to a fortnight ago, which keeps every row
 * earlier than the detections seededLastDetectedAt hands it — that function refuses to place a
 * sighting before its registration, and a registration date later than "today" would silently
 * empty it.
 */
function seededRegisteredAt(id: string): string {
  const h = personSeed(id);
  const daysAgo = 14 + Math.floor(seededRandom(h * 0.031 + 3.7) * 166);
  return new Date(SEED_TODAY - daysAgo * 86_400_000).toISOString().slice(0, 10);
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
  /*
   * AN INSTANT, NOT A DAY. This returned `.slice(0, 10)` — a date with no time — and the registry
   * could only ever say "seen on the 8th", which is not what a sighting is: a camera matched
   * somebody at a moment, and the moment is the useful half (owner's ask, 2026-09-18: 마지막 탐지에
   * 시각까지).
   *
   * Seeded like everything else here, so it is stable across reloads and the server's frame agrees
   * with the browser's first one. Between 07:00 and 22:00 local, because a city camera matching a
   * registered face at 04:00 is a different story than the seed means to tell.
   */
  const hour = 7 + Math.floor(seededRandom(h * 0.053 + 11.1) * 15);
  const minute = Math.floor(seededRandom(h * 0.067 + 2.9) * 60);
  return new Date(day + (hour * 60 + minute) * 60_000).toISOString();
}

const PERSON_REGISTRY_INFO: Record<string, { registeredAt: string; description: string }> = {
  "Alexander Wright": { registeredAt: "2026-03-14", description: "Corporate Security — Executive Protection" },
  "Priya Nair":        { registeredAt: "2026-05-02", description: "VIP registry — Frequent Visitor" },
};

export const PERSONS: Person[] = (() => {
  const seen = new Set<string>();
  const persons: Person[] = [];
  // registrySeedEvents, not liveEvents: the register must hold the same rows at 01:00 and at
  // 19:00, and liveEvents is cut off at the current hour. See registrySeedEvents in mockData.
  registrySeedEvents.forEach((e) => {
    // Tracking events are anonymous re-id trails, not identified individuals — they don't
    // belong in the Person registry.
    if (e.type === "Tracking" || seen.has(e.name)) return;
    seen.add(e.name);
    const info = PERSON_REGISTRY_INFO[e.name];
    persons.push({
      id: `person-${e.id}`,
      name: e.name,
      type: e.type,
      photoUrl: getFacePhoto(e.id),
      registeredAt: info?.registeredAt ?? seededRegisteredAt(`person-${e.id}`),
      description: info?.description,
      // Attributed through the camera that detected them, which is the same rule detections use.
      // Without this these rows carried no site at all, so the app — once it started scoping to
      // one site — would have shown an empty VIP list while the detections were still arriving.
      projectId: projectIdForCameraId(cameraIdForSeedHit(e), CAMERAS),
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
    /*
     * Four of these carry an expiry and the rest do not, which is the point rather than an
     * oversight — see Person.expiresAt's three states.
     *
     * Until now not one seeded person had the field, so the Overview's "listings expired" and
     * "expiring soon" items could not render: both counts were structurally zero and the customer
     * was shown a warning system that had never once fired. These four make all three states
     * visible at once — one already past, two inside the notice window, one answered "no end
     * date" — and everybody else stays unanswered, which is what the third count is for.
     *
     * Fixed dates, like SEED_TODAY above. Computing them from the clock at module load would
     * differ between the server's render and the browser's first one, which is the hydration
     * mismatch this file already avoids everywhere it reads time.
     */
    { id: "person-portal-0a", name: "Nadia Rahman", type: "VIP", photoUrl: getFacePhoto("person-portal-0a"), registeredAt: "2026-09-09T09:12:00+08:00", projectId: "proj-sg", priorityLabel: "normal", expiresAt: null },
    { id: "person-portal-0b", name: "Terence Goh", type: "VIP", photoUrl: getFacePhoto("person-portal-0b"), registeredAt: "2026-09-09T08:40:00+08:00", projectId: "proj-sg", priorityLabel: "high", groupId: "pgroup-1" },
    { id: "person-portal-0c", name: "Farah Idris", type: "VIP", photoUrl: getFacePhoto("person-portal-0c"), registeredAt: "2026-09-08T16:05:00+08:00", projectId: "proj-sg", priorityLabel: "normal" },
    /* The one expired listing, and it is the OLDEST registration on the site on purpose (owner's
       note, 2026-09-18: "만료 13일이 지난게 등록일기준으로 맨 마지막에 있어야 현실 실제
       데이터같을 것 같아"). With a retention period the expiries arrive in registration order, so
       an expired row sitting among this week's registrations reads as fabricated.
       Registered 2025-09-05, expires 2026-09-05 — exactly 365 days, which is the deployment
       default — so today it is 13 days past. Sorted by 등록일 descending it lands on the last page,
       where the listings that are running out actually are. */
    { id: "person-portal-1", name: "Michael Tan", type: "VIP", photoUrl: getFacePhoto("person-portal-1"), registeredAt: "2025-09-05T14:32:00+08:00", lastDetectedAt: "2026-09-08T18:42:00+08:00", projectId: "proj-sg", priorityLabel: "high", groupId: "pgroup-1", expiresAt: "2026-09-05" },
    { id: "person-portal-2", name: "Sarah Lim", type: "VIP", photoUrl: getFacePhoto("person-portal-2"), registeredAt: "2026-08-30T09:05:00+08:00", lastDetectedAt: "2026-09-03T09:17:00+08:00", projectId: "proj-sg", priorityLabel: "normal", groupId: "pgroup-1", expiresAt: "2026-09-28" },
    { id: "person-portal-3", name: "David Ho", type: "VIP", photoUrl: getFacePhoto("person-portal-3"), registeredAt: "2026-08-28T17:48:00+08:00", lastDetectedAt: "2026-08-29T13:05:00+08:00", projectId: "proj-sg", priorityLabel: "very_high", groupId: "pgroup-2", expiresAt: "2026-10-10" },
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
  // Mostly normal. A VIP registry where a third of the entries are the top level has no top level.
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
   * wore six faces, seventeen of them each, and a VIP registry whose whole job is telling faces apart
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
let vipCategorySeq = 0;
let searchPurposeSeq = 0;
let searchAccessSeq = 0;

/**
 * An audit entry for a change to the institution's own policy lists.
 *
 * Filed against the team, not a project — see AuditEvent.teamId. "Who changed the list of
 * acceptable reasons to look somebody up" is the question these entries exist to answer, and it is
 * asked of the institution rather than of one site.
 */
function policyAudit(
  teamId: string | undefined,
  message: string,
  /* WHAT and HOW, for the three columns the activity table now splits into. `area` is fixed:
     categories and purposes are both edited on the settings sheet, which is also why they are
     filed against the team rather than against one project. */
  target: string,
  action: string,
): AuditEvent {
  return clientAudit({ teamId, area: "settings", target, action, message, actor: SIGNED_IN_USER.name, at: new Date().toISOString() });
}
let eventSeq = SEED_EVENTS.length;
let portalUserSeq = PORTAL_USERS.length;
let orgSeq = TEAMS.length;
let serverSeq = SERVERS.length;
let apiKeySeq = API_KEYS.length;
let cameraGroupSeq = CAMERA_GROUPS.length;

/**
 * DROP DELETED CAMERAS OUT OF EVERY CAMERA SCOPE.
 *
 * `PortalUser.cameraIds` is a list of ids, so a deleted camera left a dead id behind in it
 * forever: the table's `12 / 62` counted a camera that no longer exists, and the day an id space
 * is reused that scope silently points at a different street. (Cameras cannot change project —
 * `updateCamera` omits `projectId` — so deletion is the only way a scope can go stale.)
 *
 * An emptied list is KEPT AS `[]`, not turned back into `undefined`. Absent means "every camera",
 * and widening somebody's access because the one camera they were scoped to was deleted is the
 * kind of silent grant this field exists to prevent. `[]` is a real state the gate already knows:
 * an account with no cameras sees no cameras, which is what somebody chose when they picked one.
 *
 * Returns the same array when nothing changed, so a delete that touches no scope does not make
 * every account re-render.
 */
function pruneCameraGroupMembers(groups: CameraGroup[], removedIds: Set<string>): CameraGroup[] {
  let changed = false;
  const next = groups.map(g => {
    const kept = g.cameraIds.filter(id => !removedIds.has(id));
    if (kept.length === g.cameraIds.length) return g;
    changed = true;
    return { ...g, cameraIds: kept };
  });
  return changed ? next : groups;
}

function pruneCameraScopes(users: PortalUser[], removedIds: Set<string>): { users: PortalUser[]; touched: number } {
  let touched = 0;
  const next = users.map(u => {
    if (u.cameraIds === undefined) return u;
    const kept = u.cameraIds.filter(id => !removedIds.has(id));
    if (kept.length === u.cameraIds.length) return u;
    touched += 1;
    return { ...u, cameraIds: kept };
  });
  return touched === 0 ? { users, touched } : { users: next, touched };
}

/** The sentence a camera removal adds to its audit line when it also narrowed somebody's scope. */
function scopeNote(touched: number): string {
  return touched === 0 ? "" : ` · removed from ${touched} account${touched === 1 ? "'s" : "s'"} camera scope`;
}
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
 * What is wrong with a project's VIP registry, and how much of it is actually working.
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
 * are not defects: they are the reach of the list, and they are here because a VIP registry nobody
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
/**
 * Whether the expiry question is still open on this row — nobody answered it, as opposed to
 * somebody answering "no end date".
 *
 * One predicate, exported, because four screens ask this and a registry where the summary card
 * and the table disagree about which rows are unanswered is worse than one that never asks.
 * See Person.expiresAt for the three states.
 */
export function isExpiryUnanswered(person: Person): boolean {
  return person.expiresAt === undefined;
}

/**
 * Whether this listing's date has passed, judged on the site's calendar.
 *
 * DAYS, NOT INSTANTS, and the same day the row prints. The two screens that ask this used to
 * disagree for up to a day — the Overview counted a listing expired the moment its date began
 * while the table still read "0 days left" — so somebody clicking the red banner arrived at a
 * table with nothing expired in it. One predicate now, for the same reason isExpiryUnanswered is
 * one: a registry whose summary and table disagree about which rows are over is worse than one
 * that never says.
 *
 * `todayKey` is passed in rather than read here. A day computed during render differs between the
 * server's frame and the browser's first one, and every clock-reading value in this product is
 * taken after mount for that reason. A caller with no clock yet passes null and gets false — the
 * narrower answer, never the wider one.
 */
export function isExpired(person: Person, todayKey: string | null): boolean {
  if (todayKey === null || !person.expiresAt) return false;
  return person.expiresAt.slice(0, 10) < todayKey;
}

export interface RegistryHealth {
  missingPhoto: string[];
  /**
   * Listings nobody has set an expiry on — not "no end date", which is an answer, but no answer.
   *
   * These keep being matched. They are counted so a person can go and answer them, which is the
   * only honest move available: filling a date in for them would stop cameras matching somebody
   * without anybody choosing that.
   */
  expiryUnanswered: string[];
  /**
   * Listings whose date has passed.
   *
   * Counted so the Overview's red line has somewhere to lead. It had nowhere: pressing it opened
   * the registry unfiltered, and there was no way to see only the rows it was talking about among
   * a hundred others.
   *
   * These are already out of the matching set — watchedPersonsInProject drops them — so this is
   * not an alarm about cameras. It is a queue: each row needs somebody to say whether the purpose
   * continues (renew the date) or ended (take the row off). Renewing is a real answer and is
   * audited; it is not a way of hiding the count.
   */
  expired: string[];
  embeddingFailed: string[];
  /** Photo replaced, waiting on the model's answer. See Person.reenrolledAt. */
  reenrolling: string[];
  duplicates: [string, string][];
  detectedLast7d: string[];
  detectedPrev7d: string[];
}

export function registryHealth(projectId: string, persons: Person[], todayKey: string | null = null): RegistryHealth {
  const rows = persons.filter(p => p.projectId === projectId);
  const missingPhoto: string[] = [];
  const expiryUnanswered: string[] = [];
  const expired: string[] = [];
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
    // Before the photo checks below and outside their else-branch: whether somebody answered the
    // expiry question has nothing to do with whether the face is readable, and a row can be both
    // unanswered and unmatchable. Released rows are excluded — the listing already ended, and
    // asking for an end date on it is asking about something that is over.
    if (!p.releasedAt && isExpiryUnanswered(p)) expiryUnanswered.push(p.id);
    // Released rows are excluded here too: a listing somebody ended does not also need ending.
    if (!p.releasedAt && isExpired(p, todayKey)) expired.push(p.id);
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
  return { missingPhoto, expiryUnanswered, expired, embeddingFailed, reenrolling, duplicates, detectedLast7d, detectedPrev7d };
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

// recordedBy "server" on every row, and not because a server wrote them — this array is built in
// the browser like everything else here. It is what these rows STAND FOR: camera RTSP changes,
// account suspensions, licence renewals are all actions a server performs and therefore observes,
// so the seed that stands in for a server's history has to carry the mark a server's history
// carries. That the mock assembles them client-side is a fact about the mock, not about the
// action. This is the only place in this file "server" is written; see `clientAudit`.
const AUDIT_LOG: AuditEvent[] = [
  { id: "audit-1", projectId: "proj-sg", area: "cameras", target: "CAM-NOV-001", action: "RTSP URL updated", message: "Camera CAM-NOV-001 RTSP URL updated", actor: "Grace Tan", at: auditAt(20), recordedBy: "server" },
  { id: "audit-2", projectId: "proj-sg", area: "vip", target: "Wei Chen", action: "Registered", message: "VIP Wei Chen registered", actor: "Marcus Lee", at: auditAt(65), recordedBy: "server" },
  { id: "audit-3", projectId: "proj-sg", area: "accounts", target: "David Ong", action: "Account suspended", message: "David Ong's account suspended", actor: "Grace Tan", at: auditAt(240), recordedBy: "server" },
  { id: "audit-4", projectId: "proj-riverside", area: "server", target: "campus-fr-1", action: "Connectivity checked", message: "Server campus-fr-1 connectivity checked", actor: "Nadia Rahman", at: auditAt(50), recordedBy: "server" },
  // Enough history for the Overview's "all N entries" modal to be worth opening. Three lines on
  // the card and three lines behind it made the modal a longer way of reading the card; a real
  // console's log is weeks deep, and the point of the modal is that the card is a window onto
  // something bigger. Times fan out from an hour ago to nine days, in the order things actually
  // happen in a project: cameras get added and re-pointed, people get invited and promoted,
  // VIP registries get edited, servers get reconfigured.
  //
  // Every line here names an action Portal can actually perform, and is worded the way that
  // action words itself when it writes its own entry. Four of them did not: "Face recognition
  // enabled on 4 cameras" (per-camera engines were removed on 2026-09-09), "Server FR 2
  // restarted" (no restart control exists), "Retention period changed from 30 to 60 days" (no
  // retention control exists) and "Mail server verified" (saving mail settings verifies
  // nothing). This is the same trap ACCESS_REQUESTS was emptied to avoid — a seeded row that
  // cannot occur teaches whoever reads the screen that the product does something it does not,
  // and the audit log is the one screen a customer reads to find out what happened.
  { id: "audit-5", projectId: "proj-sg", area: "cameras", target: "CAM-BLK-019", action: "Added to zone August", message: "Camera CAM-BLK-019 added to zone August", actor: "Marcus Lee", at: auditAt(320), recordedBy: "server" },
  { id: "audit-6", projectId: "proj-sg", area: "vip", target: "Executive Protection", action: "Group created", message: "VIP group \"Executive Protection\" created", actor: "Grace Tan", at: auditAt(400), recordedBy: "server" },
  { id: "audit-7", projectId: "proj-sg", area: "accounts", target: "Aaron Sim", action: "Invited as auditor", message: "Aaron Sim invited as auditor", actor: "Grace Tan", at: auditAt(690), recordedBy: "server" },
  { id: "audit-8", projectId: "proj-sg", area: "cameras", target: "4 cameras in Bugis", action: "Assigned to server FR 2", message: "4 cameras in Bugis assigned to server FR 2", actor: "Marcus Lee", at: auditAt(1080), recordedBy: "server" },
  { id: "audit-9", projectId: "proj-sg", area: "server", target: "FR 2", action: "Updated", message: "Server FR 2 updated", actor: "Wei Chen", at: auditAt(1500), recordedBy: "server" },
  { id: "audit-10", projectId: "proj-sg", area: "vip", target: "Sarah Lim", action: "Priority raised to High", message: "VIP Sarah Lim's priority raised to High", actor: "Grace Tan", at: auditAt(2160), recordedBy: "server" },
  { id: "audit-11", projectId: "proj-sg", area: "cameras", target: "CAM-BDK-001", action: "Stream credentials rotated", message: "Camera CAM-BDK-001 stream credentials rotated", actor: "Marcus Lee", at: auditAt(2880), recordedBy: "server" },
  { id: "audit-12", projectId: "proj-sg", area: "roster", target: "6 staff", action: "Registration codes issued", message: "Registration codes issued to 6 staff", actor: "Grace Tan", at: auditAt(3600), recordedBy: "server" },
  { id: "audit-13", projectId: "proj-sg", area: "settings", target: "Time zone", action: "Set to Asia/Singapore", message: "Project timezone set to Asia/Singapore", actor: "Grace Tan", at: auditAt(4320), recordedBy: "server" },
  { id: "audit-14", projectId: "proj-sg", area: "cameras", target: "CAM-QTN-001", action: "Renamed to Queenstown", message: "Camera CAM-QTN-001 renamed to Queenstown", actor: "Wei Chen", at: auditAt(5760), recordedBy: "server" },
  { id: "audit-15", projectId: "proj-sg", area: "accounts", target: "Marcus Lee", action: "Granted app access", message: "Marcus Lee granted app access", actor: "Grace Tan", at: auditAt(7200), recordedBy: "server" },
  { id: "audit-16", projectId: "proj-sg", area: "vip", target: "VIP registry", action: "Exported to CSV", message: "VIP registry exported to CSV", actor: "Aaron Sim", at: auditAt(8640), recordedBy: "server" },
  { id: "audit-17", projectId: "proj-sg", area: "server", target: "Mail settings", action: "Updated", message: "Project mail settings updated", actor: "Wei Chen", at: auditAt(10080), recordedBy: "server" },
  { id: "audit-18", projectId: "proj-sg", area: "cameras", target: "Zone Angmokio", action: "Created with 3 cameras", message: "Zone Angmokio created with 3 cameras", actor: "Marcus Lee", at: auditAt(11520), recordedBy: "server" },
  { id: "audit-19", projectId: "proj-sg", area: "license", target: "Project licence", action: "Renewed until 2029-03-31", message: "License renewed until 2029-03-31", actor: "Grace Tan", at: auditAt(12960), recordedBy: "server" },
];
let auditSeq = AUDIT_LOG.length;

/**
 * The only way this frontend builds an audit row.
 *
 * `recordedBy` is deliberately NOT a parameter. The browser has no honest way to set it to
 * "server" — it did not see the action, it asked for it — so rather than trusting every call site
 * to remember that, the type makes the dishonest value unsayable here. The seed array above is
 * the one place "server" is written, because those rows stand in for rows a server wrote.
 *
 * HANDOFF NOTE: the 68 call sites this replaces are, as a set, the handoff list. Every one of
 * them is an action the server should be recording as it happens, and until it does, the row the
 * Activity screen shows is the browser's own note to itself: gone when the tab closes, editable
 * by anyone with a console open, and a record of what was asked for rather than of what occurred.
 * Converting one of them means moving the write to the server, not passing a different string.
 */
function clientAudit(fields: Omit<AuditEvent, "id" | "recordedBy">): AuditEvent {
  return { id: `audit-${++auditSeq}`, recordedBy: "client", ...fields };
}

let presetSeq = 0;
let judgementSeq = 0;
let exportSeq = 0;
let footageSeq = 0;
let erasureSeq = 0;

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
/** Exported so the live wall collapses bursts on the same window this uses — one rule, one
 *  number. Two screens answering "is this the same visit?" differently is how they drift. */
export const VIP_SESSION_WINDOW_MS = 2 * 60 * 1000;

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

// lat/lng optional for the same reason LiveEvent's are: a hit on a camera nobody has placed has
// no place either, and filling it with 0 both drew it in the Atlantic and counted it into a
// district. Readers that plot or measure filter on hasPosition.
//
// `confidence` is optional for exactly the same reason, and it was the last `?? 0` left in this
// function's neighbourhood. A hit whose confidence nobody recorded has no confidence, and 0 is not
// that: it prints as "0%" wherever a hit is shown, which claims the system matched this person at
// no confidence at all. Both fields it flows into are already optional (TrackingHop.confidence,
// VcaEvent.confidence), so the fills here were inventing a number to satisfy this line and nothing
// else. The one deliberate `?? 0` that remains is at the LiveEvent boundary in
// vcaEventsToLiveEvents, where the field is required by a type this file does not own — the map
// reads that 0 back as "no figure" rather than printing it (see MapView's confidenceFigure).
interface LiveHit { location: string; cameraLabel?: string; timestamp: string; confidence?: number; lat?: number; lng?: number }

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
      // The hop's own coordinate, not the event's. `e.lat` is where this person was seen LAST,
      // so using it for every hop collapsed a trail across three districts onto the newest one.
      // A hop written before TrackingHop carried coordinates has none; it falls back to the
      // event's, which is the old behaviour and the best guess available for it.
      // NO SUBSTITUTION. A hop with no coordinate does not borrow the event's — the event's is
      // where this person was seen LAST, so lending it to an earlier hop puts that stop at the
      // newest camera. 57b7282 fixed exactly this for the route drawing and the same line
      // survived here. Absent stays absent; readers that place or count filter on it.
      hits.push(...e.personPath.map(p => ({ location: p.location, cameraLabel: p.cameraLabel, timestamp: p.timestamp, confidence: p.confidence, lat: p.lat, lng: p.lng })));
    } else {
      hits.push({ location: e.location ?? "", cameraLabel: e.cameraLabel, timestamp: e.timestamp, confidence: e.confidence, lat: e.lat, lng: e.lng });
    }
  });
  return hits
    .filter(h => nowMs - new Date(h.timestamp).getTime() <= VIP_ACTIVITY_WINDOW_MS)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * One invite token.
 *
 * Extracted because two paths mint them — a single invitation and an approved access request — and
 * the second one used not to. An account created without a token has no way in at all:
 * /password-setup finds accounts by `inviteToken` and nothing else, so it was a row in the table
 * that could never become a person.
 *
 * HANDOFF NOTE: mockup only. The real token is minted server-side, stored as a hash next to its
 * expiry, and single-use. What matters here is the shape the link takes, so /password-setup can be
 * written against an opaque token instead of the account id it used to carry.
 */
function mintInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export const useVcaStore = create<VcaStoreState>((set, get) => ({
  teams: TEAMS,
  projects: PROJECTS,
  cameras: CAMERAS,
  uploads: UPLOADS,
  persons: PERSONS,
  personGroups: PERSON_GROUPS,
  // No seed. An institution defines its own; a shipped default would become the standard.
  vipCategories: [],
  searchPurposes: [],
  /*
   * Seeded, and that is a claim about the product rather than demo furniture: an installation with
   * no presets makes every invitation a seven-checkbox exercise, and the first administrator to
   * meet that screen learns to tick everything.
   *
   * The names follow the vocabulary the comparable products ship with — Genetec's own privilege
   * templates are Operator / Investigator / Supervisor, and its documentation defines Supervisor
   * as "the same privileges as Investigator, plus …", which is the cumulative ladder below.
   *
   * WHERE THE LADDER BREAKS is Verkada's line, not ours: its roles divide on how far back you can
   * see (Live-Only Viewer "no access to historical video" against Site Viewer "live and recorded
   * footage"), and our screens already fall on that seam — Live is now, the other four are the
   * past, export is out of the building.
   *
   * The customer renames and recomposes all of it. This is a starting point, not a taxonomy.
   */
  accessPresets: [
    {
      id: "preset-operator", teamId: "team-univs", builtinKey: "operator", label: "운영자",
      description: "지금 일어나는 일을 본다",
      actions: ["systemStatus", "liveView", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown"],
    },
    {
      id: "preset-investigator", teamId: "team-univs", builtinKey: "investigator", label: "조사자",
      description: "운영자가 하는 일에 인물 검색과 동선 추적을 더합니다",
      actions: ["systemStatus", "liveView", "dashboardTrail", "liveMonitoring", "monitoringVip", "monitoringUnknown", "liveMonitoringSearch", "liveWall", "history", "bestframeVip", "bestframeVehicle", "bestframeUnknown", "reid", "reidSearch", "redface", "trail"],
    },
  ],
  searchPurpose: null,
  // No seed. These are events, and an installation that has run no searches has none.
  searchAccessLog: [],
  detectionJudgements: [],
  listExports: [],
  // Empty on purpose, like the access requests below it: a seeded release would teach whoever
  // reads this screen that the product has already handed footage to somebody.
  footageRequests: SEED_FOOTAGE_REQUESTS,
  erasureRequests: SEED_ERASURE_REQUESTS,
  events: SEED_EVENTS,
  portalUsers: PORTAL_USERS,
  servers: SERVERS,
  cameraGroups: CAMERA_GROUPS,
  apiKeys: API_KEYS,
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
      const auditEntry: AuditEvent = clientAudit({ projectId: cam?.projectId, area: "cameras", target: `${cam?.code ?? cameraId}`, action: `Marked ${status}`, message: `Camera ${cam?.code ?? cameraId} marked ${status}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() });
      return {
        cameras: state.cameras.map(c => (c.id === cameraId ? { ...c, status } : c)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addCameras: (cameras, source) => {
    const state = get();
    const projectId = cameras[0]?.projectId;
    if (projectId === undefined) return [];
    const project = state.projects.find(p => p.id === projectId);
    const limit = project ? projectChannelLimit(project) : undefined;
    const used = state.cameras.filter(c => c.projectId === projectId).length;
    // Undefined limit is "not licensed", the same reading the Cameras tab uses — a project with
    // no channel count recorded cannot take cameras from a file any more than from the form.
    const allowance = limit === undefined ? 0 : Math.max(0, limit - used);

    const taken = new Set(state.cameras.map(c => c.code.trim().toLowerCase()));
    const refused: string[] = [];
    const accepted: Camera[] = [];
    cameras.forEach(cam => {
      const key = cam.code.trim().toLowerCase();
      if (taken.has(key)) { refused.push(cam.code); return; }
      if (accepted.length >= allowance) { refused.push(cam.code); return; }
      taken.add(key);
      accepted.push({ ...cam, id: `cam-${++cameraSeq}` });
    });

    if (accepted.length > 0) {
      set(st => ({
        cameras: [...st.cameras, ...accepted],
        auditLog: [clientAudit({
          projectId,
          area: "cameras", target: `${accepted.length} camera${accepted.length === 1 ? "" : "s"}`, action: `Imported from ${source}`, message: `${accepted.length} camera${accepted.length === 1 ? "" : "s"} imported from ${source}`
            + (refused.length > 0 ? ` (${refused.length} refused)` : ""),
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
      }));
    }
    return refused;
  },
  fillCameraPositions: (projectId, entries, source) => {
    const state = get();
    const byCode = new Map(
      state.cameras.filter(c => c.projectId === projectId).map(c => [c.code.trim().toLowerCase(), c.id]),
    );
    const refused: string[] = [];
    const placed = new Map<string, { lat: number; lng: number }>();
    entries.forEach(entry => {
      const id = byCode.get(entry.code.trim().toLowerCase());
      if (id === undefined) { refused.push(entry.code); return; }
      // Last line wins a repeated code, which is what a spreadsheet's own reading of itself is.
      placed.set(id, { lat: entry.lat, lng: entry.lng });
    });
    if (placed.size > 0) {
      set(st => ({
        cameras: st.cameras.map(c => {
          const position = placed.get(c.id);
          return position ? { ...c, ...position } : c;
        }),
        auditLog: [clientAudit({
          projectId,
          area: "cameras", target: `${placed.size} camera${placed.size === 1 ? "" : "s"}`, action: `Coordinates filled from ${source}`, message: `Coordinates filled for ${placed.size} camera${placed.size === 1 ? "" : "s"} from ${source}`
            + (refused.length > 0 ? ` (${refused.length} not found)` : ""),
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
      }));
    }
    return refused;
  },
  addCamera: (camera) => {
    const state = get();
    // The same three checks the file path makes, in the same order — see CameraAddRefusal.
    const project = state.projects.find(p => p.id === camera.projectId);
    const limit = project ? projectChannelLimit(project) : undefined;
    const used = state.cameras.filter(c => c.projectId === camera.projectId).length;
    if (limit === undefined || used >= limit) return "over-limit";
    const codeKey = camera.code.trim().toLowerCase();
    if (state.cameras.some(c => c.code.trim().toLowerCase() === codeKey)) return "duplicate-code";
    const streamKey = camera.rtspUrl.trim().toLowerCase();
    if (streamKey !== "" && state.cameras.some(c => c.projectId === camera.projectId && c.rtspUrl.trim().toLowerCase() === streamKey)) {
      return "duplicate-stream";
    }
    set(st => ({
      cameras: [...st.cameras, { ...camera, id: `cam-${++cameraSeq}` }],
      auditLog: [clientAudit({ projectId: camera.projectId, area: "cameras", target: camera.name, action: "Added", message: `Camera ${camera.name} added`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return null;
  },
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
        auditLog: [clientAudit({
          projectId: cam.projectId,
          area: "cameras",
          target: updates.name ?? cam.name,
          action: streamChanged ? "Stream address changed" : "Updated",
          message: streamChanged
            ? `Camera ${updates.name ?? cam.name} stream address changed`
            : `Camera ${updates.name ?? cam.name} updated`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeCamera: (cameraId) =>
    set(state => {
      const cam = state.cameras.find(c => c.id === cameraId);
      const scopes = pruneCameraScopes(state.portalUsers, new Set([cameraId]));
      const auditEntry: AuditEvent = clientAudit({ projectId: cam?.projectId, area: "cameras", target: `${cam?.name ?? cameraId}`, action: `Removed${scopeNote(scopes.touched)}`, message: `Camera ${cam?.name ?? cameraId} removed${scopeNote(scopes.touched)}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() });
      return {
        cameras: state.cameras.filter(c => c.id !== cameraId),
        cameraGroups: pruneCameraGroupMembers(state.cameraGroups, new Set([cameraId])),
        portalUsers: scopes.users,
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeCameras: (cameraIds) =>
    set(state => {
      const ids = new Set(cameraIds);
      const removed = state.cameras.filter(c => ids.has(c.id));
      if (removed.length === 0) return {};
      const scopes = pruneCameraScopes(state.portalUsers, ids);
      const auditEntry: AuditEvent = clientAudit({
        projectId: removed[0].projectId,
        area: "cameras",
        target: removed.length === 1 ? removed[0].name : `${removed.length} cameras (${removed.map(c => c.code).join(", ")})`,
        action: `Removed${scopeNote(scopes.touched)}`,
        message: (removed.length === 1
          ? `Camera ${removed[0].name} removed`
          : `${removed.length} cameras removed (${removed.map(c => c.code).join(", ")})`) + scopeNote(scopes.touched),
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        cameras: state.cameras.filter(c => !ids.has(c.id)),
        cameraGroups: pruneCameraGroupMembers(state.cameraGroups, ids),
        portalUsers: scopes.users,
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setCamerasZone: (cameraIds, zone) =>
    set(state => {
      const ids = new Set(cameraIds);
      const moved = state.cameras.filter(c => ids.has(c.id));
      if (moved.length === 0) return {};
      const auditEntry: AuditEvent = clientAudit({
        projectId: moved[0].projectId,
        area: "cameras", target: `${moved.length} camera${moved.length === 1 ? "" : "s"}`, action: `Moved to zone "${zone}"`, message: `${moved.length} camera${moved.length === 1 ? "" : "s"} moved to zone "${zone}"`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
    const auditEntry: AuditEvent = clientAudit({
      projectId: upload.projectId,
      area: "cameras", target: upload.fileName, action: `${upload.kind === "image" ? "Image" : "Video"} uploaded`, message: `${upload.kind === "image" ? "Image" : "Video"} uploaded — ${upload.fileName}`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    });
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
      const auditEntry: AuditEvent = clientAudit({
        projectId: upload.projectId,
        area: "cameras", target: upload.fileName, action: "Upload removed", message: `Upload removed — ${upload.fileName}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        uploads: state.uploads.filter(u => u.id !== uploadId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addProject: (project) =>
    set(state => ({
      projects: [...state.projects, { ...project, id: `proj-${++projectSeq}` }],
      auditLog: [clientAudit({ teamId: project.teamId, area: "settings", target: project.name, action: "Project created", message: `Project created: ${project.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  renameProject: (projectId, name) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project || project.name === name) return state;
      return {
        projects: state.projects.map(p => (p.id === projectId ? { ...p, name } : p)),
        // Both names in the message. A rename read a year later is unreadable without the old
        // one — "Project renamed to Bugis North" does not say which project that was.
        auditLog: [clientAudit({
          projectId,
          area: "settings", target: project.name, action: `Renamed to ${name}`, message: `Project renamed: ${project.name} → ${name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  installLicenseFile: (projectId, licence) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return state;
      /**
       * The audit line names the file, not just the numbers.
       *
       * "Channels changed to 100" is the sentence the removed mutator would have written, and it
       * is missing the only part that matters here — who said so. A licence id is traceable back
       * to the vendor's issuance record, so a year later this line answers "on what authority"
       * rather than just "what". The old values ride along for the same reason a rename carries
       * both names.
       */
      const before = project.licenseChannelLimit === undefined
        ? "none recorded"
        : `${project.licensePlan ?? "—"}, ${project.licenseChannelLimit}ch, ${project.licenseExpiresAt ?? "—"}`;
      return {
        projects: state.projects.map(p => (p.id === projectId ? {
          ...p,
          licensePlan: licence.plan,
          licenseChannelLimit: licence.channelLimit,
          licenseExpiresAt: licence.expiresAt,
        } : p)),
        auditLog: [clientAudit({
          projectId,
          area: "license", target: licence.licenseId, action: `Installed — ${before} → ${licence.plan}, ${licence.channelLimit}ch, expires ${licence.expiresAt}`, message: `Licence ${licence.licenseId} installed (${before} → ${licence.plan}, ${licence.channelLimit}ch, ${licence.expiresAt})`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeProject: (projectId) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return state;
      return {
        projects: state.projects.filter(p => p.id !== projectId),
        cameras: state.cameras.filter(c => c.projectId !== projectId),
        uploads: state.uploads.filter(u => u.projectId !== projectId),
        servers: state.servers.filter(sv => sv.projectId !== projectId),
        persons: state.persons.filter(p => p.projectId !== projectId),
        personGroups: state.personGroups.filter(g => g.projectId !== projectId),
        staffRoster: state.staffRoster.filter(r => r.projectId !== projectId),
        accessRequests: state.accessRequests.filter(r => r.projectId !== projectId),
        // The detections made BY this site's cameras — the same rule eventsInProject uses to
        // decide what a screen shows, so what gets deleted and what could still be seen cannot
        // drift apart. `state.cameras` is read before the line above replaces it.
        //
        // This used to match VIP registry people instead, and never deleted anything: it compared
        // `Person.id` against `VcaEvent.personId`, and personId is not a person. Both writers
        // (SEED_EVENTS, ClientLayout's addEvent) put the SIGHTING's own id there, so the two id
        // spaces never overlapped, `has()` was always false, and the condition was always true.
        // A closed site kept every detection it had ever made, invisibly — no screen can render
        // them once the cameras are gone, so nothing ever looked wrong.
        //
        // Scoping by camera also widens what goes, on purpose. A detection is something a camera
        // recorded about a member of the public; when the site closes, the reason for holding it
        // is gone, and that is true of the unidentified ones too — arguably most true of them,
        // since nobody ever established who they were. That is the opposite call from
        // searchAccessLog below, and the asymmetry is the point: the search log records what an
        // OPERATOR did and is kept as accountability; these rows record where a PERSON was, and
        // keeping them past the purpose is the thing this product has to be careful about.
        events: state.events.filter(e => projectIdForCameraId(e.cameraId, state.cameras) !== projectId),
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
        auditLog: [clientAudit({
          teamId: project.teamId,
          area: "settings", target: project.name, action: "Project deleted", message: `Project deleted: ${project.name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog.map(a => (
          a.projectId === projectId ? { ...a, projectId: undefined, teamId: project.teamId } : a
        ))].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  // Mail settings write to the audit log the way license changes do — an admin changing where
  // invites are sent is exactly the kind of thing someone has to be able to trace later.
  setEvidenceWatermark: (projectId, on) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, evidenceWatermark: on } : p)),
      /* Audited in both directions, and the OFF line is the one that matters: it is the record that
         somebody removed the mark that ties a leaked still to a session. */
      auditLog: [
        clientAudit({
          projectId,
          area: "settings",
          target: "Viewer watermark",
          action: on ? "Turned on" : "Turned OFF — leaked stills no longer name the session",
          message: on ? "Viewer watermark turned on" : "Viewer watermark turned OFF — leaked stills no longer name the session",
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }),
        ...state.auditLog,
      ].slice(0, AUDIT_LOG_LIMIT),
    })),

  setProjectTimeZone: (projectId, timeZone) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, timeZone } : p)),
      // Audited: which day a detection is filed under, when a report covers, and what "today"
      // means on every screen all move when this changes.
      auditLog: [
        // ++auditSeq, not Date.now(): two changes inside one millisecond produced duplicate
        // React keys. And sliced like every other writer — this was the one that could grow the
        // log past the ceiling the Activity screen prints.
        clientAudit({ projectId, area: "settings", target: "Time zone", action: `Set to ${timeZone}`, message: `Project timezone set to ${timeZone}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }),
        ...state.auditLog,
      ].slice(0, AUDIT_LOG_LIMIT),
    })),

  recordJudgement: ({ surface, subjectId, targetLabel, verdict }) =>
    set(state => ({
      detectionJudgements: [
        {
          id: `judge-${++judgementSeq}`,
          surface, subjectId, targetLabel, verdict,
          // The signed-in stand-in, like every other actor field in this mock. The real one comes
          // from the session — a browser naming its own operator is not evidence of anything.
          actor: SIGNED_IN_USER.name,
          at: new Date().toISOString(),
        },
        // Replace rather than append: one subject holds one current verdict. The history of
        // changed minds belongs on the server, where an earlier call cannot be quietly dropped.
        ...state.detectionJudgements.filter(j => !(j.surface === surface && j.subjectId === subjectId)),
      ],
    })),
  addErasureRequest: (r) => {
    const id = `erasure-${++erasureSeq}`;
    const at = new Date().toISOString();
    set(state => ({
      erasureRequests: [
        { ...r, id, status: "received" as const, receivedAt: at, receivedBy: SIGNED_IN_USER.name,
          dispositions: { ...ERASURE_DEFAULTS } },
        ...state.erasureRequests,
      ],
      auditLog: [clientAudit({
        projectId: r.projectId,
        area: "requests", target: r.subjectName, action: "Erasure request received", message: `Erasure request received: ${r.subjectName}`,
        actor: SIGNED_IN_USER.name, at,
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  setErasureDisposition: (id, category, disposition) =>
    set(state => {
      const req = state.erasureRequests.find(r => r.id === id);
      if (!req || req.status !== "received") return state;
      // Every change is logged, with the category and both positions. The value of this screen is
      // that an institution can show what it decided and when — a disposition that changed
      // silently would make the register worth less than the paper it replaced.
      return {
        erasureRequests: state.erasureRequests.map(r => (r.id === id
          ? { ...r, dispositions: { ...r.dispositions, [category]: disposition } }
          : r)),
        auditLog: [clientAudit({
          projectId: req.projectId,
          area: "requests", target: req.subjectName, action: `Erasure policy: ${category} ${req.dispositions[category]} → ${disposition}`, message: `Erasure policy set for ${req.subjectName}: ${category} ${req.dispositions[category]} → ${disposition}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  /**
   * Cannot be closed while a category is still undecided.
   *
   * That refusal IS the feature. A request closed with two open questions is a request somebody
   * answered by not answering, and the person who asked has no way to know which way it went.
   * The screen says which categories are blocking; this makes sure a stray call cannot skip it.
   */
  closeErasureRequest: (id, completed, note) =>
    set(state => {
      const req = state.erasureRequests.find(r => r.id === id);
      if (!req || req.status !== "received" || note.trim() === "") return state;
      if (completed && Object.values(req.dispositions).includes("undecided")) return state;
      const at = new Date().toISOString();
      return {
        erasureRequests: state.erasureRequests.map(r => (r.id === id ? {
          ...r, status: (completed ? "completed" : "refused") as ErasureRequestStatus,
          closedAt: at, closedBy: SIGNED_IN_USER.name, closingNote: note.trim(),
        } : r)),
        auditLog: [clientAudit({
          projectId: req.projectId,
          area: "requests", target: req.subjectName, action: `Erasure request ${completed ? "completed" : "refused"}`, message: `Erasure request ${completed ? "completed" : "refused"}: ${req.subjectName}`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addFootageRequest: (r) => {
    const id = `footage-${++footageSeq}`;
    const at = new Date().toISOString();
    set(state => ({
      footageRequests: [
        { ...r, id, status: "received" as const, receivedAt: at, receivedBy: SIGNED_IN_USER.name },
        ...state.footageRequests,
      ],
      auditLog: [clientAudit({
        projectId: r.projectId,
        area: "requests", target: `${r.requesterName} (${r.requesterOrg})`, action: "Footage request received", message: `Footage request received from ${r.requesterName} (${r.requesterOrg})`,
        actor: SIGNED_IN_USER.name, at,
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  /**
   * A note is required for both answers, not just refusals.
   *
   * An approval with no stated reason is the one a regulator reads as "we hand these out", and it
   * is also the one the person who approved it cannot defend two years later when they no longer
   * remember the case. The screen enforces it; this is the layer that means a stray call cannot
   * write a decision nobody can account for.
   */
  decideFootageRequest: (id, approved, note) =>
    set(state => {
      const req = state.footageRequests.find(r => r.id === id);
      if (!req || req.status !== "received" || note.trim() === "") return state;
      const at = new Date().toISOString();
      return {
        footageRequests: state.footageRequests.map(r => (r.id === id ? {
          ...r,
          status: (approved ? "approved" : "refused") as FootageRequestStatus,
          decidedAt: at, decidedBy: SIGNED_IN_USER.name, decisionNote: note.trim(),
        } : r)),
        auditLog: [clientAudit({
          projectId: req.projectId,
          area: "requests", target: `${req.requesterName} (${req.requesterOrg})`, action: `Footage request ${approved ? "approved" : "refused"}`, message: `Footage request ${approved ? "approved" : "refused"}: ${req.requesterName} (${req.requesterOrg})`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  releaseFootageRequest: (id, release) =>
    set(state => {
      const req = state.footageRequests.find(r => r.id === id);
      // Only an approved request can be released. Refused and already-released ones are closed,
      // and a release with no decision behind it is the thing this register exists to prevent.
      if (!req || req.status !== "approved") return state;
      const at = new Date().toISOString();
      return {
        footageRequests: state.footageRequests.map(r => (r.id === id ? {
          ...r, ...release,
          status: "released" as const, releasedAt: at, releasedBy: SIGNED_IN_USER.name,
        } : r)),
        // The redaction claim goes in the log line. "Released" on its own does not answer the
        // question anybody asks afterwards, which is whose faces were in the file.
        auditLog: [clientAudit({
          projectId: req.projectId,
          area: "requests", target: `${release.releasedTo || req.requesterName}`, action: "Footage released", message: `Footage released to ${release.releasedTo || req.requesterName}`
            + ` · ${release.redaction?.done ? `redacted (${release.redaction.method})` : "not redacted"}`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  recordListExport: ({ projectId, list, rowCount }) =>
    set(state => {
      const at = new Date().toISOString();
      const LIST_NAME: Record<ListExportRecord["list"], string> = {
        vips: "VIP registry", searchLog: "search access log", activity: "activity log",
        roster: "staff roster", cameras: "camera list",
      };
      /* The screen the button was pressed on, so an export lands under the list it emptied rather
         than all five landing under one name. Both records read the same `list` key, so they
         cannot disagree about which screen that was. */
      const LIST_AREA: Record<ListExportRecord["list"], AuditArea> = {
        vips: "vip", searchLog: "records", activity: "records",
        roster: "roster", cameras: "cameras",
      };
      return {
        // Append, never replace — the same rule as evidenceExports. Exporting the same list twice
        // is two files in the world, and the second one is often the one that left the building.
        listExports: [
          { id: `listexport-${++exportSeq}`, projectId, list, rowCount, actor: SIGNED_IN_USER.name, at },
          ...state.listExports,
        ],
        // The row count is in the line because it is what tells a reader whether this was somebody
        // checking one page or the whole registry leaving.
        //
        // recordedBy "client" is PERMANENT here, not a mock artifact waiting on a backend. The CSV
        // is assembled in the browser from rows already on the page and handed straight to the
        // user — there is no request for the server to observe, so no server-recorded row can
        // exist for it. See src/lib/evidence.ts:28, which reached the same conclusion for the
        // evidence bundle: the export has to be a server call that logs before it returns bytes,
        // otherwise the one action worth auditing is the one nobody sees.
        auditLog: [clientAudit({
          projectId,
          area: LIST_AREA[list], target: LIST_NAME[list], action: `Exported as a file — ${rowCount} row(s)`, message: `${LIST_NAME[list]} exported as a file — ${rowCount} row(s)`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  clearJudgement: (surface, subjectId) =>
    set(state => ({
      detectionJudgements: state.detectionJudgements.filter(
        j => !(j.surface === surface && j.subjectId === subjectId),
      ),
    })),
  setProjectRetention: (projectId, days) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return state;
      const before = project.retentionDays;
      if (before === (days ?? undefined)) return state;
      return {
        projects: state.projects.map(p => (p.id === projectId ? { ...p, retentionDays: days ?? undefined } : p)),
        // Audited, and the old value goes in the line. "Changed to 60" cannot answer "what were
        // we keeping in March", which is the question a complaint or a court asks.
        auditLog: [clientAudit({
          projectId,
          area: "settings",
          target: "Retention period",
          action: days === null
            ? `Cleared (was ${before ?? "unset"} days)`
            : `Changed from ${before ?? "unset"} to ${days} days`,
          message: days === null
            ? `Retention period cleared (was ${before ?? "unset"} days)`
            : `Retention period changed from ${before ?? "unset"} to ${days} days`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  /*
   * Mirrors setProjectRetention, including the audit line carrying the OLD value — "changed to 90"
   * cannot answer "how long were we keeping faces in March", and for this number that question has
   * a person attached to it.
   *
   * Only NEW registrations move. Changing the rule does not rewrite the end date of anybody
   * already on the list: those dates were the basis somebody registered them under, and a policy
   * edit that silently extended a thousand listings would be the console deciding to keep people
   * longer without anyone choosing it. Shortening them would be worse — a listing could lapse
   * retroactively, which is a deletion nobody ordered. The bulk "만료일 지정" action is how an
   * administrator moves existing rows, deliberately and audited.
   */
  setProjectVipRetention: (projectId, days) =>
    set(state => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return state;
      const before = project.vipRetentionDays;
      if (before === (days ?? undefined)) return state;
      return {
        projects: state.projects.map(p => (p.id === projectId ? { ...p, vipRetentionDays: days ?? undefined } : p)),
        auditLog: [clientAudit({
          projectId,
          area: "settings",
          target: "VIP listing period",
          action: days === null
            ? `Cleared (was ${before ?? "unset"} days)`
            : `Changed from ${before ?? "unset"} to ${days} days`,
          message: days === null
            ? `VIP listing period cleared (was ${before ?? "unset"} days)`
            : `VIP listing period changed from ${before ?? "unset"} to ${days} days`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  updateProjectMail: (projectId, updates) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, ...updates } : p)),
      auditLog: [clientAudit({ projectId, area: "server", target: "Mail settings", action: "Updated", message: `Project mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  // This flips which mailbox invites/resets go through, same audit-worthy weight as updateProjectMail.
  setNetworkIsolationOverride: (projectId, override) =>
    set(state => ({
      projects: state.projects.map(p => (p.id === projectId ? { ...p, networkIsolatedOverride: override } : p)),
      auditLog: [clientAudit({
        projectId,
        area: "settings",
        target: "Network reachability",
        action: override === null ? "Reset to auto-detection" : `Manually set to ${override ? "internet-isolated" : "internet-connected"}`,
        message: override === null ? "Network reachability reset to auto-detection" : `Network reachability manually set to ${override ? "internet-isolated" : "internet-connected"}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  addCameraGroup: (projectId, label, cameraIds, description) => {
    const trimmed = label.trim();
    const state = get();
    // A name is how a group is handed out on the permission screen, so two groups called the same
    // thing is a scope nobody can read back.
    const taken = cameraGroupsInProject(state.cameraGroups, projectId)
      .some(g => g.label.trim().toLowerCase() === trimmed.toLowerCase());
    if (taken) return "duplicate-label";
    const group: CameraGroup = {
      id: `cgroup-${++cameraGroupSeq}`,
      projectId,
      label: trimmed,
      /* Absent rather than "" when nothing was written — an empty string is a description that
         exists and says nothing, and every reader of this field would then need the same guard. */
      ...(description?.trim() ? { description: description.trim() } : {}),
      cameraIds: [...cameraIds],
      createdAt: new Date().toISOString(),
      createdBy: SIGNED_IN_USER.name,
    };
    set(st => ({
      cameraGroups: [...st.cameraGroups, group],
      auditLog: [clientAudit({
        projectId, area: "cameraGroups", target: trimmed, action: `Created with ${cameraIds.length} camera(s)`, message: `Camera group "${trimmed}" created with ${cameraIds.length} camera(s)`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return null;
  },
  updateCameraGroup: (groupId, patch) => {
    const state = get();
    const group = state.cameraGroups.find(g => g.id === groupId);
    if (!group) return null;

    const nextLabel = patch.label === undefined ? group.label : patch.label.trim();
    if (nextLabel === "") return null;
    if (nextLabel.toLowerCase() !== group.label.toLowerCase()) {
      // Same rule as creation: the name is what an administrator picks from when granting camera
      // access, so two groups called the same thing is a scope nobody can read back.
      const taken = cameraGroupsInProject(state.cameraGroups, group.projectId)
        .some(g => g.id !== groupId && g.label.trim().toLowerCase() === nextLabel.toLowerCase());
      if (taken) return "duplicate-label";
    }

    const nextDescription = patch.description === undefined
      ? group.description
      : (patch.description.trim() || undefined);
    const nextIds = patch.cameraIds === undefined ? group.cameraIds : [...patch.cameraIds];

    const renamed = nextLabel !== group.label;
    const redescribed = nextDescription !== group.description;
    const added = nextIds.filter(id => !group.cameraIds.includes(id)).length;
    const removed = group.cameraIds.filter(id => !nextIds.includes(id)).length;
    if (!renamed && !redescribed && added === 0 && removed === 0) return null;

    /* ONE LINE, NAMING WHAT ACTUALLY MOVED. The membership half is an ACCESS change, not a
       tidy-up: everybody holding this group gains or loses those cameras the moment it is saved
       — that is what makes a group a group — so the count of affected accounts rides along. The
       name and the purpose line move nobody's access and say so by not carrying that count. */
    const holders = state.portalUsers.filter(u => (u.cameraGroupIds ?? []).includes(groupId)).length;
    const parts: string[] = [];
    if (renamed) parts.push(`renamed to "${nextLabel}"`);
    if (redescribed) parts.push(nextDescription ? "description set" : "description cleared");
    if (added > 0 || removed > 0) parts.push(`cameras +${added} / -${removed}, affecting ${holders} account(s)`);

    set(st => ({
      cameraGroups: st.cameraGroups.map(g => (g.id === groupId
        ? { ...g, label: nextLabel, cameraIds: nextIds, ...(nextDescription ? { description: nextDescription } : { description: undefined }) }
        : g)),
      auditLog: [clientAudit({
        projectId: group.projectId,
        area: "cameraGroups", target: group.label, action: `${parts.join("; ")}`, message: `Camera group "${group.label}" ${parts.join("; ")}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return null;
  },
  removeCameraGroup: (groupId) =>
    set(state => {
      const group = state.cameraGroups.find(g => g.id === groupId);
      if (!group) return {};
      /* Taken out of every scope that held it, for the reason pruneCameraScopes gives about
         deleted cameras: a dead id in a scope counts toward a figure nobody can explain. An
         account left with no groups and no cameras holds `[]`, which is "none" — not "everything".
         Narrowing on a delete is the safe direction; widening is not. */
      let touched = 0;
      const users = state.portalUsers.map(u => {
        if (!(u.cameraGroupIds ?? []).includes(groupId)) return u;
        touched += 1;
        return { ...u, cameraGroupIds: (u.cameraGroupIds ?? []).filter(id => id !== groupId) };
      });
      return {
        cameraGroups: state.cameraGroups.filter(g => g.id !== groupId),
        portalUsers: touched === 0 ? state.portalUsers : users,
        auditLog: [clientAudit({
          projectId: group.projectId,
          area: "cameraGroups", target: group.label, action: `Deleted${touched === 0 ? "" : ` · removed from ${touched} account(s)`}`, message: `Camera group "${group.label}" deleted${touched === 0 ? "" : ` · removed from ${touched} account(s)`}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  issueApiKey: (projectId, draft) => {
    const state = get();
    const mine = apiKeysInProject(state.apiKeys, projectId);
    // Live keys only. A revoked one is a record, not a key, and counting it would stop a site
    // making its tenth after somebody tidied up.
    if (mine.filter(k => !k.revokedAt).length >= API_KEY_LIMIT) return { refusal: "over-limit" };
    // A name is how these are told apart in a list of ten — two "integration" rows and nobody
    // knows which one the revoke button is about to take down.
    const taken = mine.some(k => !k.revokedAt && k.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
    if (taken) return { refusal: "duplicate-name" };

    /* 32 bytes of the browser's own randomness, hex, with a readable prefix. Math.random is not
       used for this even in a mock: a value shaped like a credential teaches whoever copies this
       code where the credential comes from. */
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const secret = `vca_${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;
    const key: ApiKey = {
      id: `apikey-${++apiKeySeq}`,
      projectId,
      name: draft.name.trim(),
      scope: draft.scope,
      prefix: secret.slice(0, 12),
      createdAt: new Date().toISOString(),
      createdBy: SIGNED_IN_USER.name,
      expiresAt: draft.expiresAt,
    };
    set(st => ({
      apiKeys: [key, ...st.apiKeys],
      auditLog: [clientAudit({
        projectId,
        // The prefix, never the secret. An audit log is read by more people than the dialog was.
        area: "server", target: key.name, action: `API key issued — ${key.prefix}…, ${draft.scope === "read" ? "read-only" : "read/write"}${draft.expiresAt ? `, expires ${draft.expiresAt}` : ", no expiry"}`, message: `API key "${key.name}" issued (${key.prefix}…, ${draft.scope === "read" ? "read-only" : "read/write"}${draft.expiresAt ? `, expires ${draft.expiresAt}` : ", no expiry"})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return { key, secret };
  },
  revokeApiKey: (keyId) =>
    set(state => {
      const key = state.apiKeys.find(k => k.id === keyId);
      if (!key || key.revokedAt) return {};
      return {
        // Kept, with a date on it. Deleting the row would delete the answer to "what could that
        // integration read last quarter", which is the question an audit brings here.
        apiKeys: state.apiKeys.map(k => (k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k)),
        auditLog: [clientAudit({
          projectId: key.projectId,
          area: "server", target: key.name, action: `API key revoked — ${key.prefix}…`, message: `API key "${key.name}" revoked (${key.prefix}…)`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  updateTeamMail: (teamId, updates) =>
    set(state => ({
      teams: state.teams.map(o => (o.id === teamId ? { ...o, ...updates } : o)),
      auditLog: [clientAudit({ area: "settings", target: "Team mail settings", action: "Updated", message: `Team mail settings updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  addPerson: (person) =>
    set(state => ({
      // The rule of the site this person is being registered at, not a global one: two projects on
      // one installation can hold people to different periods.
      persons: [...state.persons, { registeredBy: SIGNED_IN_USER.name, ...person, expiresAt: settledExpiry(person.expiresAt, vipRetentionDays(state.projects.find(pr => pr.id === person.projectId))), id: `person-${++personSeq}` }],
      auditLog: [clientAudit({ projectId: person.projectId, area: "vip", target: person.name, action: "Registered", message: `VIP ${person.name} registered`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  addPersons: (persons, source) => {
    if (persons.length === 0) return 0;
    set(state => ({
      persons: [...state.persons, ...persons.map(pp => ({ registeredBy: SIGNED_IN_USER.name, ...pp, expiresAt: settledExpiry(pp.expiresAt, vipRetentionDays(state.projects.find(pr => pr.id === pp.projectId))), id: `person-${++personSeq}` }))],
      auditLog: [clientAudit({
        projectId: persons[0].projectId,
        area: "vip", target: `${persons.length} ${persons.length === 1 ? "person" : "people"}`, action: `Imported from ${source}`, message: `${persons.length} ${persons.length === 1 ? "person" : "people"} imported from ${source}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return persons.length;
  },
  setPersonsExpiry: (personIds, expiresAt) =>
    set(state => {
      const ids = new Set(personIds);
      if (ids.size === 0) return state;
      // Named by count and by the answer given, not by the ids: "47 listings" a year later says
      // what happened, a list of ids says nothing anybody can read.
      const auditEntry: AuditEvent = clientAudit({
        projectId: state.persons.find(p => ids.has(p.id))?.projectId,
        area: "vip",
        target: `${ids.size} VIP listing(s)`,
        action: expiresAt === null ? "Set to no end date" : `Set to expire ${expiresAt}`,
        message: expiresAt === null
          ? `${ids.size} VIP listing(s) set to no end date`
          : `${ids.size} VIP listing(s) set to expire ${expiresAt}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        persons: state.persons.map(p => (ids.has(p.id) ? { ...p, expiresAt } : p)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removePerson: (personId) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      // The one mutation in this store that wrote no audit entry. Registering, editing, releasing
      // and grouping all logged; erasing an enrolled face record — the single most consequential
      // thing that can be done to this registry, and the one an audit is most likely to ask
      // about — left nothing behind at all.
      const auditEntry: AuditEvent = clientAudit({
        projectId: person?.projectId,
        // The name is snapshotted into the message because the row it names is about to stop
        // existing — the same reason the group and camera removals word themselves this way.
        area: "vip", target: `${person?.name ?? personId}`, action: "Deleted from the registry", message: `VIP ${person?.name ?? personId} deleted from the VIP registry`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        persons: state.persons.filter(p => p.id !== personId),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  restorePerson: (person) =>
    set(state => {
      // Already back — two clicks on the same toast, or the row re-registered by hand in between.
      if (state.persons.some(p => p.id === person.id)) return state;
      return {
        // Back where it was in the list rather than appended: the reader is watching the row they
        // just deleted, and having it reappear at the bottom of a hundred looks like a different
        // row arriving.
        persons: [...state.persons, person].sort((a, b) => a.id.localeCompare(b.id)),
        auditLog: [clientAudit({
          projectId: person.projectId,
          // Both lines stay in the log. An undo is not an erasure of the delete — an audit that
          // shows only the net effect cannot answer "was this person ever off the list".
          area: "vip", target: person.name, action: "Restored to the registry (deletion undone)", message: `VIP ${person.name} restored to the VIP registry (deletion undone)`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setPersonsGroup: (personIds, groupId) =>
    set(state => {
      const ids = new Set(personIds);
      if (ids.size === 0) return state;
      const groupName = groupId === null ? null : state.personGroups.find(g => g.id === groupId)?.name ?? groupId;
      return {
        persons: state.persons.map(p => (ids.has(p.id) ? { ...p, groupId: groupId ?? undefined } : p)),
        auditLog: [clientAudit({
          projectId: state.persons.find(p => ids.has(p.id))?.projectId,
          area: "vip",
          target: `${ids.size} VIP listing(s)`,
          action: groupName === null ? "Removed from their group" : `Moved to group ${groupName}`,
          message: groupName === null
            ? `${ids.size} VIP listing(s) removed from their group`
            : `${ids.size} VIP listing(s) moved to group ${groupName}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setPersonsPriority: (personIds, priorityLabel) =>
    set(state => {
      const ids = new Set(personIds);
      if (ids.size === 0) return state;
      return {
        persons: state.persons.map(p => (ids.has(p.id) ? { ...p, priorityLabel } : p)),
        auditLog: [clientAudit({
          projectId: state.persons.find(p => ids.has(p.id))?.projectId,
          area: "vip", target: `${ids.size} VIP listing(s)`, action: `Priority set to ${priorityLabel}`, message: `${ids.size} VIP listing(s) set to priority ${priorityLabel}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removePersons: (personIds) => {
    const ids = new Set(personIds);
    const removed = get().persons.filter(p => ids.has(p.id));
    if (removed.length === 0) return [];
    set(state => ({
      persons: state.persons.filter(p => !ids.has(p.id)),
      auditLog: [clientAudit({
        projectId: removed[0].projectId,
        area: "vip", target: `${removed.length} VIP listing(s)`, action: "Deleted from the registry", message: `${removed.length} VIP listing(s) deleted from the VIP registry`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    // The caller needs the rows to put them back — see restorePersons.
    return removed;
  },
  /** The undo for removePersons. Same id, same object, and its own audit line. */
  restorePersons: (persons) =>
    set(state => {
      const have = new Set(state.persons.map(p => p.id));
      const back = persons.filter(p => !have.has(p.id));
      if (back.length === 0) return state;
      return {
        persons: [...state.persons, ...back].sort((a, b) => a.id.localeCompare(b.id)),
        auditLog: [clientAudit({
          projectId: back[0].projectId,
          area: "vip", target: `${back.length} VIP listing(s)`, action: "Restored to the registry (deletion undone)", message: `${back.length} VIP listing(s) restored to the VIP registry (deletion undone)`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  releasePerson: (personId, reason) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const at = new Date().toISOString();
      return {
        persons: state.persons.map(p => (p.id === personId ? { ...p, releasedAt: at, releaseReason: reason } : p)),
        auditLog: [clientAudit({
          projectId: person.projectId,
          area: "vip", target: person.name, action: `Released — ${reason}`, message: `VIP ${person.name} released — ${reason}`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [clientAudit({
          projectId: person.projectId,
          area: "vip", target: person.name, action: `Reinstated (released ${wasReleasedOn}) — ${reason}`, message: `VIP ${person.name} reinstated (released ${wasReleasedOn}) — ${reason}`,
          actor: SIGNED_IN_USER.name, at,
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  addSearchPurpose: (purpose) => {
    const id = `spurpose-${++searchPurposeSeq}`;
    set(state => ({
      searchPurposes: [...state.searchPurposes, { ...purpose, id, archived: false }],
      auditLog: [policyAudit(purpose.teamId, `Search purpose "${purpose.label}" created`, purpose.label, "Search purpose created"), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  /**
   * Retire and replace — there is no edit, on purpose.
   *
   * A purpose is not a label on a thing, it is what an operator SAID they were looking somebody
   * up for, and every row in the access log names one. Rename "Criminal investigation" and every
   * past search made under it now reads as the new words: the record of what was claimed changes
   * after the fact, without anybody's search changing. That is the one thing this log exists to
   * prevent, and it is why removeProject keeps the log when a site is deleted.
   *
   * The screen already promises this out loud — "retired purposes cannot be chosen again; past
   * searches that name them still resolve" — which only holds while the words stay put.
   *
   * An `updateSearchPurpose` action existed with no caller until 2026-09-14. Deleted rather than
   * left for somebody to wire: an action sitting in the store is an invitation, and the cost of
   * accepting it is silent. VIP categories keep their update for the opposite reason — a category
   * groups people, and no audit row quotes it.
   */
  archiveSearchPurpose: (purposeId) =>
    set(state => ({
      searchPurposes: state.searchPurposes.map(p => (p.id === purposeId ? { ...p, archived: true } : p)),
      auditLog: [policyAudit(
        state.searchPurposes.find(p => p.id === purposeId)?.teamId,
        `Search purpose "${state.searchPurposes.find(p => p.id === purposeId)?.label ?? purposeId}" retired`,
        state.searchPurposes.find(p => p.id === purposeId)?.label ?? purposeId,
        "Search purpose retired",
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
      //
      // The caller passes what only it knows — what was searched for, on which screen, how many
      // came back. When, who and which institution are filled here: four call sites assembling
      // the same three fields is four chances to assemble them differently.
      searchAccessLog: [{
        ...record,
        id: `saccess-${++searchAccessSeq}`,
        at: new Date().toISOString(),
        actor: SIGNED_IN_USER.name,
        actorEmail: SIGNED_IN_USER.email,
        teamId: state.projects.find(p => p.id === record.projectId)?.teamId ?? "",
      }, ...state.searchAccessLog],
    })),
  addVipCategory: (category) => {
    const id = `wcat-${++vipCategorySeq}`;
    set(state => ({
      vipCategories: [...state.vipCategories, { ...category, id, archived: false }],
      auditLog: [policyAudit(category.teamId, `VIP category "${category.label}" created`, category.label, "VIP category created"), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updateVipCategory: (categoryId, updates) =>
    set(state => {
      const before = state.vipCategories.find(c => c.id === categoryId);
      if (!before) return {};
      return {
        vipCategories: state.vipCategories.map(c => (c.id === categoryId ? { ...c, ...updates } : c)),
        auditLog: [policyAudit(before.teamId, `VIP category "${updates.label ?? before.label}" changed`, updates.label ?? before.label, "VIP category changed"), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  archiveVipCategory: (categoryId) =>
    set(state => {
      const before = state.vipCategories.find(c => c.id === categoryId);
      if (!before) return {};
      return {
        vipCategories: state.vipCategories.map(c => (c.id === categoryId ? { ...c, archived: true } : c)),
        auditLog: [policyAudit(before.teamId, `VIP category "${before.label}" retired`, before.label, "VIP category retired"), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      const auditEntry: AuditEvent = clientAudit({
        projectId: person.projectId,
        area: "vip",
        target: updates.name ?? person.name,
        action: photoReplaced ? "Photo replaced for re-enrolment" : "Registry entry updated",
        message: photoReplaced
          ? `VIP photo replaced for re-enrolment: ${updates.name ?? person.name}`
          : `VIP updated: ${updates.name ?? person.name}`,
        actor: SIGNED_IN_USER.name, at,
      });
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
      auditLog: [clientAudit({ projectId: group.projectId, area: "vip", target: group.name, action: "Group created", message: `VIP group created: ${group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updatePersonGroup: (groupId, updates) =>
    set(state => {
      const group = state.personGroups.find(g => g.id === groupId);
      if (!group) return {};
      return {
        personGroups: state.personGroups.map(g => (g.id === groupId ? { ...g, ...updates } : g)),
        auditLog: [clientAudit({ projectId: group.projectId, area: "vip", target: `${updates.name ?? group.name}`, action: "Group updated", message: `VIP group updated: ${updates.name ?? group.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [clientAudit({
          projectId: group?.projectId,
          area: "vip", target: `${group?.name ?? groupId}`, action: "Group removed", message: `VIP group removed: ${group?.name ?? groupId}`
            + (affected === 0 ? "" : deleteMembers ? ` — ${affected} member(s) deleted with it` : ` — ${affected} member(s) kept as individuals`),
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setPersonGroup: (personId, groupId) =>
    set(state => {
      const person = state.persons.find(p => p.id === personId);
      if (!person) return {};
      const to = groupId ? state.personGroups.find(g => g.id === groupId)?.name ?? groupId : null;
      // Logged like every other group change. Who is in a VIP registry party is the kind of thing an
      // inspection asks about later, and the three group actions beside this one already log.
      const auditEntry: AuditEvent = clientAudit({
        projectId: person.projectId,
        area: "vip",
        target: person.name,
        action: to ? `Added to VIP group: ${to}` : "Removed from their VIP group",
        message: to ? `${person.name} added to VIP group: ${to}` : `${person.name} removed from their VIP group`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
      const newHit: LiveHit = { location: event.location, cameraLabel: event.cameraLabel, timestamp: event.timestamp, confidence: event.confidence, lat: event.lat, lng: event.lng };

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
          // lat/lng included: a hop is a sighting and has its own place. Dropping them here left
          // the read below to substitute the event's own coordinate for every hop, which put a
          // whole trail at its newest sighting — see personHitHistory.
          personPath: history.map(h => ({ location: h.location, cameraLabel: h.cameraLabel, timestamp: h.timestamp, confidence: h.confidence, lat: h.lat, lng: h.lng })),
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
      const auditEntry: AuditEvent = clientAudit({ projectId: user?.projectIds[0], area: "accounts", target: `${user?.name ?? userId}`, action: `Portal role changed to ${permission}`, message: `${user?.name ?? userId}'s permission changed to ${permission}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() });
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
      /**
       * CLOSING THE APP DOOR NO LONGER ERASES WHAT IS BEHIND IT.
       *
       * This used to set `appSearch: false, appExport: false, appScreens: []` whenever app access
       * went away. The motive was real — the row went on showing a "Search on" badge for somebody
       * who could not reach the app, and the most sensitive grant in the product read as live on
       * an account that could not use it. But the fix destroyed the data to correct a label, and
       * it cost more than it bought:
       *
       *   - Turning the app back on produced an account holding NOTHING while `grantMode` still
       *     said "preset". The row read "Operator" and the gate refused with "noScreens" — a
       *     preset follower with none of the preset's screens.
       *   - Nobody could be restored. A preset account could in principle be recomputed, but a
       *     custom account's individual set was gone for good, so the administrator's only route
       *     back was to pick eleven toggles again from memory.
       *   - The erasure was itself unreadable. The users table now shows where each account's
       *     grants come from, and two seeded accounts read "no screens" — with the values wiped
       *     there is no way to tell "never granted" from "app was switched off and on again".
       *     Clearing did not remove a false fact; it removed the history.
       *
       * So the grants stay, and `appAccess` is what answers "can this person do it". The table
       * reads the two together (`appSearch && appAccess`), which is the honest form of the
       * question the column was always asking. Same rule as coordinates: do not invent a value
       * for something unknown, and do not delete a known one to make a label agree.
       */
      const at = new Date().toISOString();
      const entries: AuditEvent[] = [clientAudit({
        projectId: user?.projectIds[0],
        area: "accounts", target: `${user?.name ?? userId}`, action: `May now use ${where} (role: ${permission})`, message: `${user?.name ?? userId} may now use ${where} (role: ${permission})`,
        actor: SIGNED_IN_USER.name, at,
      })];
      return {
        portalUsers: state.portalUsers.map(u => (
          u.id === userId ? { ...u, permission, appAccess } : u
        )),
        auditLog: [...entries, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
  addAccessPreset: (preset) => {
    const id = `preset-${++presetSeq}`;
    set(state => ({
      accessPresets: [...state.accessPresets, { ...preset, id }],
      auditLog: [clientAudit({
        area: "presets", target: preset.label, action: "Created", message: `Access preset "${preset.label}" created`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  updateAccessPreset: (presetId, updates) =>
    set(state => {
      const preset = state.accessPresets.find(p => p.id === presetId);
      if (!preset) return state;
      /* RENAMED BY THE CUSTOMER MEANS IT IS THEIRS NOW. `builtinKey` makes the screen print our
         translated name instead of the stored label, so keeping the key after somebody renames
         one of the three we ship would show our word where they wrote theirs. Dropped on any
         label change, and only on a label change — editing the grants leaves the name alone. */
      const renamed = updates.label !== undefined && updates.label.trim() !== preset.label;
      const next = { ...preset, ...updates, ...(renamed ? { builtinKey: undefined } : null) };
      const followers = state.portalUsers.filter(u => u.grantMode === "preset" && u.presetId === presetId);
      return {
        accessPresets: state.accessPresets.map(p => (p.id === presetId ? next : p)),
        // Everybody on it moves with it. Recomputed rather than left to drift: a preset account
        // that kept its old grants would be following a preset in name only.
        portalUsers: state.portalUsers.map(u => (
          u.grantMode === "preset" && u.presetId === presetId ? { ...u, ...grantsOfPreset(next) } : u
        )),
        auditLog: [clientAudit({
          area: "presets", target: next.label, action: `Changed — ${followers.length} account(s) updated`, message: `Access preset "${next.label}" (${presetId}) changed — ${followers.length} account(s) updated`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  archiveAccessPreset: (presetId) =>
    set(state => {
      const preset = state.accessPresets.find(p => p.id === presetId);
      if (!preset) return state;
      const followers = state.portalUsers.filter(u => u.grantMode === "preset" && u.presetId === presetId);
      return {
        accessPresets: state.accessPresets.map(p => (p.id === presetId ? { ...p, archived: true } : p)),
        // Nobody's access changes: they already hold what the preset grants, and "custom" only
        // says where the values come from from now on.
        portalUsers: state.portalUsers.map(u => (
          u.grantMode === "preset" && u.presetId === presetId ? { ...u, grantMode: "custom" as GrantMode } : u
        )),
        auditLog: [clientAudit({
          area: "presets", target: preset.label, action: `Retired — ${followers.length} account(s) moved to custom`, message: `Access preset "${preset.label}" (${presetId}) retired — ${followers.length} account(s) moved to custom`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  applyGrantPreset: (userId, presetId) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      const preset = state.accessPresets.find(p => p.id === presetId);
      if (!user || !preset) return state;
      // THE LABEL IS A SNAPSHOT. The id alone would make this line lie the day somebody renames
      // the preset, and an audit entry that resolves to a different name than the one the
      // administrator chose is worse than no entry — the same rule SearchAccessRecord follows.
      const auditEntry: AuditEvent = clientAudit({
        projectId: user.projectIds[0],
        area: "accounts", target: user.name, action: `App grants set from preset "${preset.label}"`, message: `App grants for ${user.name} set from preset "${preset.label}" (${preset.id})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        portalUsers: state.portalUsers.map(u => (
          u.id === userId ? { ...u, ...grantsOfPreset(preset), grantMode: "preset" as GrantMode, presetId } : u
        )),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  startCustomGrants: (userId) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      if (!user) return state;
      const auditEntry: AuditEvent = clientAudit({
        projectId: user.projectIds[0],
        area: "accounts", target: user.name, action: "App grants detached from preset, set individually", message: `App grants for ${user.name} detached from preset and set individually`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        // The values are already what they should be — following a preset means holding its
        // grants. Detaching copies nothing because there is nothing to copy.
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, grantMode: "custom" as GrantMode } : u)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setCameraScope: (userId, cameraIds, cameraGroupIds) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      if (!user) return state;
      const groupCount = cameraGroupIds?.length ?? 0;
      const groupNames = (cameraGroupIds ?? [])
        .map(id => state.cameraGroups.find(g => g.id === id)?.label)
        .filter(Boolean).join(", ");
      // The groups by NAME, because "2 groups" in an audit log is not an answer to "what could
      // that account see in March" — the membership will have moved by the time anybody asks.
      /* The same three cases twice: once as the sentence the old single column printed, once as
         the predicate the 「어떻게」 column prints beside the account's name. Written side by side
         so a fourth case cannot be added to one and forgotten in the other. */
      const scopeAction = cameraIds === undefined && cameraGroupIds === undefined
        ? "Camera scope cleared — every camera on their projects"
        : (cameraIds?.length ?? 0) === 0 && groupCount === 0
        ? "Camera scope set to none"
        : `Camera scope set to ${groupCount > 0 ? `${groupCount} group(s) [${groupNames}]` : ""}${groupCount > 0 && (cameraIds?.length ?? 0) > 0 ? " + " : ""}${(cameraIds?.length ?? 0) > 0 ? `${cameraIds?.length} camera(s)` : ""}`;
      const message = cameraIds === undefined && cameraGroupIds === undefined
        ? `Camera scope for ${user.name} cleared — every camera on their projects`
        : (cameraIds?.length ?? 0) === 0 && groupCount === 0
        ? `Camera scope for ${user.name} set to none`
        : `Camera scope for ${user.name} set to ${groupCount > 0 ? `${groupCount} group(s) [${groupNames}]` : ""}${groupCount > 0 && (cameraIds?.length ?? 0) > 0 ? " + " : ""}${(cameraIds?.length ?? 0) > 0 ? `${cameraIds?.length} camera(s)` : ""}`;
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? { ...u, cameraIds, cameraGroupIds } : u)),
        auditLog: [clientAudit({
          projectId: user.projectIds[0],
          area: "accounts", target: user.name, action: scopeAction, message,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setAppGrant: (userId, action, allowed) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      if (!user) return state;
      // Built once, before the grant row: the detach happened first, so it takes the lower id and
      // sits below the change in the newest-first log. Calling it twice would also spend an id on
      // a row nobody keeps.
      const detach = detachedFromPreset(user);
      const next = { ...user, ...detach.patch };
      const held = new Set(user.appActions ?? []);
      if (allowed) {
        held.add(action);
        /* Granting a child grants its screen. Ticking 「모니터링에서 검색」 on an account that
           cannot open 모니터링 would store a capability on a screen it never reaches — the panel
           should not offer that, but the store is what has to be true either way. */
        const parent = APP_ACTION_PARENT[action];
        if (parent) held.add(parent);
      } else {
        held.delete(action);
      }
      /* Written in APP_ACTIONS order, so two accounts holding the same set store it identically
         and a diff between them is about access rather than about insertion order. Through
         withAppActionDeps, so revoking a screen takes its steps with it rather than leaving a
         search grant on a screen that no longer opens. */
      next.appActions = withAppActionDeps([...held]);
      const auditEntry: AuditEvent = clientAudit({
        projectId: user.projectIds[0],
        area: "accounts", target: user.name,
        /* The app's own name for the screen — 「대시보드 > 이벤트」 — not the grant key. The key is
           what `message` has always printed, and an administrator reading the log has no way to
           turn `liveView` back into a tab they can point at. Same table the grant list and /mypage
           read, so the row and the tick box say one thing. */
        action: `${allowed ? "Granted" : "Revoked"} app access to ${APP_GRANT_LABELS.en.actionName[action]}`,
        message: `${allowed ? "Granted" : "Revoked"} app ${action} for ${user.name}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        portalUsers: state.portalUsers.map(u => (u.id === userId ? next : u)),
        auditLog: [auditEntry, ...detach.audit, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  setAppSearch: (userId, allowed) =>
    set(state => {
      const user = state.portalUsers.find(u => u.id === userId);
      if (!user) return state;
      const detach = detachedFromPreset(user);
      const auditEntry: AuditEvent = clientAudit({
        projectId: user.projectIds[0],
        area: "accounts", target: user.name, action: `Person search ${allowed ? "granted" : "revoked"}`, message: `${allowed ? "Person search granted" : "Person search revoked"}: ${user.name}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      /* THE QUICK BLOCK REACHES EVERY SEARCH, AND THAT IS FOUR GRANTS NOW (2026-09-23).
         Kept as its own store call rather than folded into setAppGrant: the row menu's 인물 검색
         차단 is the one grant an administrator flips without opening the grants panel, and its
         audit line says so in words rather than as "revoked app liveMonitoringSearch".

         Blocking takes all four — the two search steps AND the two screens that are nothing but a
         search — because a block that left RedFace open would be a menu item that does not do what
         it says. Granting is DELIBERATELY NARROWER: it gives back the two steps only, and never
         opens RedFace or 레드맵, because those are screens and this menu item is not a door to
         screens. The asymmetry is the honest one; the panel is where screens get opened. */
      const held = new Set(user.appActions ?? []);
      const steps: AppAction[] = ["liveMonitoringSearch", "reidSearch"];
      if (allowed) for (const a of steps) held.add(a);
      else for (const a of [...steps, "redface" as AppAction, "trail" as AppAction]) held.delete(a);
      return {
        portalUsers: state.portalUsers.map(u => (
          u.id === userId ? { ...u, appActions: withAppActionDeps([...held]), ...detach.patch } : u
        )),
        auditLog: [auditEntry, ...detach.audit, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      const auditEntry: AuditEvent = clientAudit({
        projectId: user.projectIds[0],
        area: "accounts", target: user.name, action: `Projects changed: ${parts}`, message: `${user.name}'s projects changed: ${parts}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
  suspendPortalUsers: (userIds) => {
    const state = get();
    const refused: string[] = [];
    // Evaluated against a list that shrinks as we go: suspending four of five administrators must
    // still leave the fifth, and checking every id against the ORIGINAL list would let all five
    // through — each one individually "not the last" at the moment it was checked.
    let projected = state.portalUsers;
    userIds.forEach(id => {
      const target = projected.find(u => u.id === id);
      if (!target || target.status === "suspended") { refused.push(id); return; }
      if (isLastActiveAdmin(projected, id)) { refused.push(id); return; }
      projected = projected.map(u => (u.id === id ? { ...u, status: "suspended" as const } : u));
    });
    const changed = userIds.filter(id => !refused.includes(id));
    if (changed.length > 0) {
      set(st => ({
        portalUsers: st.portalUsers.map(u => (changed.includes(u.id) ? { ...u, status: "suspended" as const } : u)),
        auditLog: [clientAudit({
          area: "accounts", target: `${changed.length} account${changed.length === 1 ? "" : "s"}`, action: "Suspended in one action", message: `${changed.length} account${changed.length === 1 ? "" : "s"} suspended in one action`
            + (refused.length > 0 ? ` (${refused.length} left active)` : ""),
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...st.auditLog].slice(0, AUDIT_LOG_LIMIT),
      }));
    }
    return refused;
  },
  issueTemporaryPassword: (userId) => {
    const user = get().portalUsers.find(u => u.id === userId);
    if (!user) return null;
    const password = generateTemporaryPassword();
    // Logged, and worded so the log says what actually happened. Setting someone else's credential
    // is the one recovery path where a second person knows the password, so "who did this, to
    // whom, when" is the only thing standing behind it afterwards. The password itself is of
    // course never written here.
    const auditEntry: AuditEvent = clientAudit({
      projectId: user.projectIds[0],
      area: "accounts", target: `${user.name} (${user.email})`, action: "Temporary password issued — previous password invalidated", message: `Temporary password issued for ${user.name} (${user.email}) — previous password invalidated`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    });
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
    const token = mintInviteToken();
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
    const auditEntry = clientAudit({
      area: "accounts", target: user.email, action: "Setup code issued", message: `Setup code issued for ${user.email}`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    });
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
      const auditEntry: AuditEvent = clientAudit({ projectId: user?.projectIds[0], area: "accounts", target: `${user?.name ?? userId}`, action: "Removed", message: `User ${user?.name ?? userId} removed`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() });
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
    /*
     * ── THE TEAM COMES OFF THE PROJECT, OR NOBODY IS APPROVED ─────────────────────────────────
     *
     * This line read `project?.teamId ?? state.teams[0]?.id ?? ""`, which is the same shape as
     * the `?? CAMERAS[0].id` that went nine months unnoticed in the seed join (8005bbb): a
     * request naming a project this store does not hold got an account filed under whichever
     * team happens to sit first in the list. With one team seeded that is always the right
     * answer, so no screen could ever reveal it — and on an installation with two customers it
     * files an account, a project id and a working /password-setup link under the WRONG
     * customer. The team is this product's tenancy boundary, so there is no more expensive field
     * in the object to guess at.
     *
     * An AccessRequest carries no team of its own (see the interface — name, email, projectId,
     * reason), so the project it names is the only route to one. When that project is gone the
     * team is not knowable here, and the answer is to create nothing rather than to invent
     * something plausible. PortalUser.teamId stays required on purpose: an account with no team
     * would drop out of every team-scoped list in Portal while still being able to sign in,
     * which is worse than not creating it. Absence belongs in the type when the value is
     * genuinely unknown to everyone; here it is known to the server and unknowable only to a
     * call that has lost its project.
     *
     * ALL OR NOTHING, and that is not squeamishness — it is what keeps the caller honest.
     * PortalUsersPage pairs the ids returned here with its own filtered copy of the same list BY
     * INDEX (its comment spells the assumption out) and mints one invite link per pair. Skipping
     * one request mid-list would shift every id after it and put a working sign-in link under
     * another person's name and address — a worse failure than the one being fixed. So either
     * every requested id is approved and the result stays 1:1 with the input, or nothing is
     * approved and this returns empty.
     *
     * Unreachable today, which is the point: removeProject deletes the accessRequests of the
     * project it closes, so nothing in the console can make an orphaned request. A fallback that
     * costs nothing while it is unreachable lies the first time it is not, and the lie is
     * invisible because it looks like a measurement.
     *
     * HANDOFF NOTE: the refusal is silent on screen. The rows stay in the queue, which is true —
     * they were not approved — but nothing says why, because a `string[]` has nowhere to carry a
     * reason. If the backend can produce a request whose project is gone, this needs a reason on
     * the way out and a line on the screen; the queue is in PortalUsersPage and
     * PortalProjectDetailPage.
     */
    const approvable: { request: AccessRequest; project: Project }[] = [];
    for (const r of toApprove) {
      const project = state.projects.find(p => p.id === r.projectId);
      if (!project) return [];
      approvable.push({ request: r, project });
    }
    const newUsers: PortalUser[] = approvable.map(({ request: r, project }) => ({
      id: `user-${++portalUserSeq}`,
      name: r.name,
      email: r.email,
      teamId: project.teamId,
      projectIds: [r.projectId],
      // Someone who asked for access to a project is asking to use it, not to administer it.
      permission: "none",
      appAccess: true,
      status: "invited",
      // A TOKEN, MINTED HERE. Approving used to create the account and stop, so every approved
      // person was unreachable: /password-setup looks accounts up by inviteToken and there was
      // none. The single-invite path minted one separately, which hid the hole — approve one
      // request and the toast carried a working link, approve five and none of them existed.
      inviteToken: mintInviteToken(),
      inviteTokenIssuedAt: new Date().toISOString(),
    }));
    const auditEntries: AuditEvent[] = toApprove.map(r => clientAudit({
      projectId: r.projectId,
      area: "accounts", target: r.name, action: "Access request approved — invited", message: `Access request approved for ${r.name} — invited`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
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
      auditLog: [clientAudit({ teamId: id, area: "settings", target: team.name, action: "Team created", message: `Team created: ${team.name}`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    }));
    return id;
  },
  renameTeam: (teamId, name) =>
    set(state => {
      const team = state.teams.find(o => o.id === teamId);
      if (!team || team.name === name) return state;
      return {
        teams: state.teams.map(o => (o.id === teamId ? { ...o, name } : o)),
        auditLog: [clientAudit({
          teamId,
          area: "settings", target: team.name, action: `Renamed to ${name}`, message: `Team renamed: ${team.name} → ${name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        vipCategories: state.vipCategories.filter(c => c.teamId !== teamId),
        searchPurposes: state.searchPurposes.filter(sp => sp.teamId !== teamId),
        auditLog: [clientAudit({
          area: "settings", target: team.name, action: "Team deleted", message: `Team deleted: ${team.name}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
      auditLog: [clientAudit({ projectId: server.projectId, area: "server", target: server.name, action: "Added", message: `Server ${server.name} added`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
    })),
  updateServer: (serverId, updates) =>
    set(state => {
      const server = state.servers.find(s => s.id === serverId);
      if (!server) return state;
      return {
        servers: state.servers.map(s => (s.id === serverId ? { ...s, ...updates } : s)),
        auditLog: [clientAudit({ projectId: server.projectId, area: "server", target: `${updates.name ?? server.name}`, action: "Updated", message: `Server ${updates.name ?? server.name} updated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString() }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditLog: [clientAudit({
          projectId: server.projectId,
          area: "server",
          target: server.name,
          action: orphaned > 0
            ? `Removed — ${orphaned} camera${orphaned === 1 ? "" : "s"} left unassigned`
            : "Removed",
          message: orphaned > 0
            ? `Server ${server.name} removed — ${orphaned} camera${orphaned === 1 ? "" : "s"} left unassigned`
            : `Server ${server.name} removed`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
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
        auditEntries.push(clientAudit({
          projectId: r.projectId,
          area: "roster", target: `${r.name} (${r.employeeId})`, action: "Registration code issued", message: `Registration code issued for ${r.name} (${r.employeeId})`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }));
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
      const auditEntry: AuditEvent = clientAudit({
        projectId: entry.projectId,
        area: "roster", target: `${entry.name} (${entry.employeeId})`, action: "Registration code reissued — previous code invalidated", message: `Registration code reissued for ${entry.name} (${entry.employeeId}) — previous code invalidated`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
    /*
     * THE ROSTER ROW'S PROJECT IS THE ONLY ROUTE TO A TEAM, SO NO PROJECT MEANS NO ACCOUNT.
     *
     * `teamId` read `project?.teamId ?? state.teams[0]?.id ?? ""` — the `?? CAMERAS[0].id` shape
     * from 8005bbb, one field further in. A roster row pointing at a project this store does not
     * hold minted a REAL account, active on first use and possibly `permission: "admin"`, filed
     * under whichever team sits first in the list. With one team seeded the guess is always
     * right, so nothing reveals it; with two customers on one installation it puts an
     * administrator inside the wrong customer's tenancy, where the wrong people can see and
     * manage them. A RosterEntry carries employeeId, name, department, projectId and permission
     * and no team of its own, so when the project is gone the team is not knowable here.
     *
     * Refusing, not inventing, and not throwing. `null` is this action's existing word for "the
     * code was not usable" (see the declaration), and refusing this way mutates nothing: the code
     * is not burned and the row stays "unused", so an administrator can still see the row and the
     * person can still register once the project situation is fixed. Throwing is what
     * cameraIdForSeedHit does, and it is right there because that runs at module load in front of
     * a developer; this runs under somebody's fingers on /register, where a crash loses the
     * password they just typed and tells them nothing they can act on.
     *
     * PortalUser.teamId stays required. This is the case where the repo's own rule — a required
     * field that forces the code to invent a value is a type problem — does not apply: the value
     * is not unknown in general, it is unknowable only to a call whose project has vanished, and
     * an account with no team at all would be invisible to every team-scoped list in Portal while
     * still being able to sign in. See removeProject: accounts belong to the team, not the
     * project, which is exactly why one has to have a team.
     *
     * Unreachable today: removeProject deletes the staffRoster rows of the project it closes, so
     * nothing in the console leaves an orphaned row behind. That is what kept the fallback
     * invisible, not what made it safe.
     *
     * HANDOFF NOTE: the other half of this is in /register, and it is not in this file.
     * `savePassword` (src/app/register/page.tsx) calls this and ignores the return, then shows
     * the "done" step — so a refusal here reads on screen as a successful registration. That was
     * already true of the `effectiveCodeStatus` refusal above it. The real call is one
     * transaction on the server, and the screen has to say what it answered.
     */
    const project = state.projects.find(p => p.id === entry.projectId);
    if (!project) return null;
    const id = `user-${++portalUserSeq}`;
    // The address is optional on a roster row — a site with no mail has none — and an account
    // without one is normal here: they sign in with the employee number.
    const mode = entry.accessMode ?? (entry.permission === "admin" ? "both" : "appOnly");
    const role = entry.portalRole ?? (entry.permission === "admin" ? "admin" : "none");
    const user: PortalUser = {
      id, name: entry.name, email: entry.email ?? "", employeeId: entry.employeeId,
      projectIds: [entry.projectId],
      /*
       * THE ROW'S OWN ANSWERS WHEN IT HAS THEM, THE TWO-VALUE FIELD WHEN IT DOES NOT.
       *
       * A row written by the 등록 코드 panel carries the same four answers the mail invite
       * collects (scope, console role, app grants, team). A row that came out of the Excel import
       * carries only `permission`, because that is all a spreadsheet column can hold — so it falls
       * back to the old mapping, which is what every row used to get.
       *
       * WHAT THIS FIXES: before the four fields existed this minted `appAccess: true` with no
       * `appActions` at all, so the person redeemed their code, signed in, and the app refused
       * them with `noScreens` — while 등록 대기 had been telling the administrator they were an
       * 「앱 사용자」. On an on-premise site with no mail this is the only enrolment path there is.
       *
       * An imported row still arrives with nothing granted, and that is honest rather than fixed
       * here: nobody answered the question, and inventing an answer would hand out screens no
       * administrator chose. The roster table says so on the row instead, before the code is used.
       *
       * ON THE FALLBACK PATH, "admin" BECOMES A FULL ADMIN, not the auditor that PortalUsersPage's
       * Access select hands out when it first lets an account into Portal. That looks inconsistent
       * and is not: the select is widening someone's access as a side effect of a different
       * question, so it takes the least it can, whereas the 「권한」 column of an imported roster
       * saying 관리자 has answered exactly this question about exactly this person. Auditor would
       * also be useless here — admin is the only role this path can reach that can do anything in
       * Portal at all.
       */
      teamId: entry.teamId ?? project.teamId,
      permission: mode === "appOnly" ? "none" : role,
      appAccess: mode !== "portalOnly",
      /* Through withAppActionDeps, so a row that somehow carries a step without its screen cannot
         mint an account holding a capability on a screen it may not open. */
      appActions: mode === "portalOnly" ? undefined : withAppActionDeps(entry.appActions ?? []),
      grantMode: entry.grantMode,
      presetId: entry.presetId,
      status: "active",
    };
    const auditEntry: AuditEvent = clientAudit({
      projectId: entry.projectId,
      area: "signup", target: `${entry.name} (${entry.employeeId})`, action: "Account activated with a registration code", message: `Account activated with a registration code: ${entry.name} (${entry.employeeId}) — code used`,
      actor: entry.name, at: new Date().toISOString(),
    });
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
    const auditEntry: AuditEvent = clientAudit({
      projectId: entry.projectId,
      area: "roster", target: `${entry.name} (${entry.employeeId})`, action: "Entry added", message: `Roster entry added: ${entry.name} (${entry.employeeId})`,
      actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
    });
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
        auditLog: [clientAudit({
          projectId: accepted[0].projectId,
          area: "roster", target: `${accepted.length} roster ${accepted.length === 1 ? "entry" : "entries"}`, action: `Imported from ${source}`, message: `${accepted.length} roster ${accepted.length === 1 ? "entry" : "entries"} imported from ${source}`,
          actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
        }), ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      }));
    }
    return rejected;
  },
  updateRosterEntry: (employeeId, updates) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      if (!entry) return {};
      const auditEntry: AuditEvent = clientAudit({
        projectId: entry.projectId,
        area: "roster", target: `${updates.name ?? entry.name} (${employeeId})`, action: "Entry updated", message: `Roster entry updated: ${updates.name ?? entry.name} (${employeeId})`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
      return {
        staffRoster: state.staffRoster.map(r => (r.employeeId === employeeId ? { ...r, ...updates } : r)),
        auditLog: [auditEntry, ...state.auditLog].slice(0, AUDIT_LOG_LIMIT),
      };
    }),
  removeRosterEntry: (employeeId) =>
    set(state => {
      const entry = state.staffRoster.find(r => r.employeeId === employeeId);
      const auditEntry: AuditEvent = clientAudit({
        projectId: entry?.projectId,
        area: "roster", target: `${entry?.name ?? employeeId} (${employeeId})`, action: `Entry removed${entry?.code ? " — unused code invalidated" : ""}`, message: `Roster entry removed: ${entry?.name ?? employeeId} (${employeeId})${entry?.code ? " — unused code invalidated" : ""}`,
        actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
      const auditEntry: AuditEvent = clientAudit({
        projectId: entry.projectId,
        area: "roster", target: `${entry.name} (${entry.employeeId})`, action: "Registration code viewed", message: `Registration code viewed for ${entry.name} (${entry.employeeId})`, actor: SIGNED_IN_USER.name, at: new Date().toISOString(),
      });
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
      // THE ONE REMAINING FILL, AND IT IS NOT A DECISION MADE HERE. `LiveEvent.confidence` is a
      // required `number` (mockData.ts), so a hit whose confidence nobody recorded cannot cross
      // this boundary as an absence — it has to arrive as something, and 0 is the value the rest
      // of the app already reads as "no figure was recorded" (both producers write it on a
      // Tracking row for exactly that reason). Readers must not print it: the map's
      // confidenceFigure drops the number instead of rendering "0%". Making the field optional is
      // the real fix and it reaches mockData.ts plus Sidebar and Navbar, which is why it is
      // written down here rather than done from this file.
      confidence: e.confidence ?? 0,
      location: e.location ?? "",
      cameraLabel: e.cameraLabel,
      path: e.personPath,
      timestamp: e.timestamp,
      type: e.personType,
      lat: e.lat,
      lng: e.lng,
    }));
}

export interface DetectionHit {
  id: string;
  timestamp: string;
  location: string;
  /**
   * Where the hit happened, so a caller can place it without working back from `location`.
   *
   * Added for the dashboard map's district pills, which were counting `type === "VIP"` rows and
   * therefore dropping every VIP who had moved between cameras — those collapse into one
   * "Tracking" row (see the note below) and vanished from the count. Rather than the map
   * re-deriving hits a fourth way, the derivation carries what the map needs.
   *
   * Optional for the same reason TrackingHop's are: an older event may carry none.
   */
  lat?: number;
  lng?: number;
  /**
   * Who this hit was, so a caller can count PEOPLE rather than hits.
   *
   * Added for the same district pills as lat/lng, and for the same reason: the number on the pill
   * was a hit count while the label beside it said VIP, so "VIP 4 · 6 cams" over a district where
   * two people had been seen four times read as four people. The distinction is the whole point of
   * this derivation's own comment below — it exists because two screens asked "how many" and meant
   * different things — and the pill had no way to ask the first question.
   *
   * `personName`, NOT `personId` — and that is not a preference.
   *
   * `VcaEvent.personId` looks like the right field and is not one: both writers put the SIGHTING's
   * id in it (`SEED_EVENTS` uses `e.id`, ClientLayout's addEvent uses `liveEvent.id`), so it is
   * unique per detection. Counting distinct values of it returns the number of detections wearing
   * the word "people" — the first version of this pill did exactly that and reported "7 people"
   * over seven sightings of two.
   *
   * A name is a weaker identity than an id: two people called the same thing merge into one and
   * the headcount comes out low while looking entirely reasonable. The mock's names are distinct,
   * so it is right today. SERVER CONTRACT: a detection must carry a stable per-person id, and the
   * path to ban is resolving a person by name — not merely the value to check.
   *
   * Optional because an older event may carry no name at all; a caller counting distinct people
   * should fall back to the hit's own id, so an unidentified hit counts as one person rather than
   * merging with every other unidentified one.
   */
  person?: string;
  /**
   * Which camera saw it — the camera's own label/code, as the event recorded it.
   *
   * Carried rather than matched. The first version of the district line counted cameras by
   * comparing a hit's coordinates against the register's, and reported "1 person on 0 of its
   * cameras" — somebody was seen, so zero cameras is not a possible answer. The seeds' hit
   * coordinates are hand-authored and do not land exactly on a camera's (the zoomed-in ping layer
   * says as much about itself), so coordinate equality was never going to work, and loosening it
   * to "nearest camera" would attribute a sighting to a camera that did not make it.
   *
   * Optional because an older event may carry no label; a caller counting distinct cameras should
   * skip the ones without, and say so, rather than fold them into one unnamed camera.
   */
  camera?: string;
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
      hits.push({ id: e.id, timestamp: e.timestamp, location: e.location, lat: e.lat, lng: e.lng, person: e.personName, camera: e.cameraLabel });
    } else if (e.personType === "Tracking" && e.personPath) {
      e.personPath.forEach((hop, i) => {
        // Each hop's own coordinate — a trail crossing three districts is three hits in three
        // places, not three in the last one.
        // Every hop is the same person — that is what makes a trail a trail. Carrying the event's
        // person onto each hop is what lets the pill count a VIP who crossed four cameras as one.
        // Same rule as personHitHistory above, and this one matters most: these hits feed the
        // district VIP tallies, and those numbers are the evidence a customer buys cameras on.
        // Lending the event's coordinate here credits an unplaced sighting to whichever district
        // the person was last seen in — the LAPD crime map put 1,380 ungeocodable addresses next
        // to City Hall and raised that district's rate. districtIdAt answers "nowhere" instead.
        if (hop.location) hits.push({ id: `${e.id}-${i}`, timestamp: hop.timestamp, location: hop.location, lat: hop.lat, lng: hop.lng, person: e.personName, camera: hop.cameraLabel });
      });
    }
  });
  return hits.filter(h => isTodaySgt(new Date(h.timestamp)));
}

/**
 * One district's figures: how many people were seen there today, and on how many cameras.
 *
 * Lives beside todaysDetectionHits, and for the same reason that function exists — two screens
 * ask this and must not answer differently. The map's picked-district pill computed it locally
 * first; the moment the sidebar needed the same sentence that would have been a second
 * derivation, and the map and the list disagreeing about one district is exactly the class of bug
 * this file keeps collecting.
 *
 * PEOPLE are counted by `person` (the person's name — see DetectionHit.person for why it is not
 * `personId`, and what the server has to send instead), falling back to the hit's own id so an
 * unidentified sighting counts as one person rather than merging with every other one.
 *
 * CAMERAS come from what the hit carries: its camera label, or failing that its own coordinate,
 * which is where the camera that recorded it stands. Never by looking a camera up — matching hit
 * coordinates against the register answered "1 person on 0 cameras", and relaxing that to
 * "nearest camera" would credit a sighting to a camera that did not make it.
 */
export function districtTally(hits: DetectionHit[], districtId: string): { people: number; cameras: number } {
  // districtIdAt, not nearestDistrict: the second one answers with the closest district however
  // far away the point is, so a detection outside the grid was credited to whichever district
  // happened to be nearest. This was the last of six call sites still asking the unbounded
  // question — and it is the one both the map and the sidebar read, so leaving it would have made
  // the tally count points the map's own fills no longer do.
  const here = hits.filter(h => districtIdAt(h.lat, h.lng) === districtId);
  return {
    people: new Set(here.map(h => h.person ?? h.id)).size,
    cameras: new Set(
      here.map(h => h.camera ?? `${(h.lat as number).toFixed(4)},${(h.lng as number).toFixed(4)}`)
    ).size,
  };
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
 * deleting or demoting it would leave an installation where nobody can give anyone access.
 *
 * Counts owners, not every admin: after the console roles split, an admin cannot grant access, so
 * a room full of admins is still a locked-out installation.
 *
 * THIS GUARD PREVENTS AN ACCIDENT. IT IS NOT A RECOVERY PATH, and the difference matters:
 * it stops somebody clicking the installation into a corner, and does nothing at all for the
 * account that is simply lost — the person left, the laptop went, the password is gone.
 *
 * Requiring two owners was considered and rejected (2026-09-15). Two owners lowers the odds and
 * builds no path: lose both and the installation is in exactly the same place, with no way back
 * that the product itself offers. A second owner is worth having; it is not the answer to this.
 *
 * ── THE RECOVERY PATH: THE SUPPLIER REISSUES. WE BUILD NOTHING. ───────────────────────────────
 *
 * DECIDED 2026-09-17, and this section used to specify the opposite. What stood here was a
 * finished design for a host-only command — `docker compose exec admin vca-admin recover-owner
 * <email>` — modelled on Keycloak's `kc.sh bootstrap-admin`, Confluence's password restore and
 * Grafana's CLI reset. It was never delivered to the backend, and it is now **rejected, not
 * pending**. A lost owner phones the supplier that installed the system and the supplier issues
 * the owner a temporary password again, using the mechanism that already exists.
 *
 * FOUR THINGS NOT TO REBUILD, because each of them was written down here as the plan at some
 * point: the `recover-owner` command; a printed or sealed recovery key; forcing an installation to
 * keep two owner accounts (considered and rejected 2026-09-15 — see the paragraph above, it lowers
 * the odds and builds no path); and any self-service or network-reachable owner recovery. The last
 * one is the only part of the old reasoning that survives unchanged: a recovery route reachable
 * from HTTP is a back door with a friendly name.
 *
 * `PortalUser.recoveredAt` and Portal's `recoveredOwner` banner (PortalShell) were outputs of that
 * command. The contract ask for the field is withdrawn. Nothing lies today — no writer sets it, so
 * the banner draws nothing — but it is dead weight on a rejected mechanism and clearing it is ours
 * to do, not a contract item.
 *
 * WHAT IS STILL TRUE AND WORTH KEEPING. DefaultAdminSeeder in the admin service promotes the seed
 * account back to owner at boot when no active owner is left, and it has three gaps:
 *
 *   1. It only promotes an account that still exists (`findByEmail(...).ifPresent`). If the seed
 *      account was deleted, the run is a silent no-op — the branch that creates one fires only on
 *      a completely empty user table.
 *   2. It does not touch the password. The deploy guide tells the installer to change it at first
 *      login, so promoting that account gets nobody in.
 *   3. It writes `log.warn` and nothing else.
 *
 * Gap 2 is why the supplier's act is a REISSUE rather than a promotion: boot promotion alone opens
 * no door. Gap 3 still matters — an owner regaining access is precisely the event an audit asks
 * about, and that row must be written by the SERVER. The frontend cannot fake it and should not
 * try: `clientAudit` takes `Omit<AuditEvent, "id" | "recordedBy">`, so `"server"` is unsayable
 * from the browser by construction. A browser-authored "the owner was recovered" is a note to
 * self, not an audit trail.
 *
 * THE OPEN QUESTION IS NOT TECHNICAL. The approver moved from the customer to us: whoever answers
 * that phone hands over owner access. So the question that needs an answer before this path is
 * real is "what establishes that the caller is entitled to act for the owner?" — without one, this
 * is owner access for the price of a phone call. Bosch's signed authorization letter exists for
 * exactly this. It is the one item on the supplier-admin agenda.
 *
 * Do NOT solve this with email. `authConfig.passwordRecovery` already has two conditions because
 * some sites have no mail at all — and this decision is NOT grounds to flip it, which governs
 * every user rather than the owner.
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
