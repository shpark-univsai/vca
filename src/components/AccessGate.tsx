"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cctv, Building2, ShieldOff, ArrowRight, LogOut } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { useLanguage, usePortalLanguage } from "@/lib/i18n";
import { getAuthConfig } from "@/lib/authConfig";
import {
  canEnterPortal, SIGNED_IN_USER,
  type PortalPermission, type PortalUser,
} from "@/lib/vcaStore";

/**
 * The one door between signing in and a screen.
 *
 * Both halves of this install are reached from the same login, and until now the branch was a
 * `router.push` nobody could see: an account with a console role landed in Portal whether or not
 * it also had the app, and an account refused at either door was bounced by a redirect that reads
 * as a fault rather than a decision. Two states, one layout:
 *
 * - "choose"  the account holds both doors, so it is asked which one. Nothing is refused here.
 * - "denied"  the door in front of them is closed. Says which grants the account actually holds,
 *             because that is the sentence an administrator needs read back to them, and offers
 *             the door that is open instead of guessing on the person's behalf.
 *
 * HANDOFF NOTE: the identity is still the seeded stand-in (see currentPortalUser) — every state
 * can be viewed at /gate?demo=<key>. The server decides all of this again; this screen only keeps
 * the decision visible.
 */

/** Remembered so the question is asked once per browser, not once per shift. */
export const GATE_CHOICE_KEY = "vca:gateChoice";
export type GateDoor = "portal" | "app";

export function readGateChoice(): GateDoor | null {
  try {
    const saved = localStorage.getItem(GATE_CHOICE_KEY);
    return saved === "portal" || saved === "app" ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Crossing between the two halves updates what "remembered" means — but only for someone who
 * asked to be remembered at all.
 *
 * The gate stores a choice made on one screen at one moment, and left alone that value freezes:
 * an administrator who picks Portal once and then spends every shift in the app is returned to
 * Portal every morning by a decision they made in January. What the setting is meant to hold is
 * the half they were last in, so the two account-menu links that cross over say so.
 *
 * Writes nothing when no choice is stored. An unticked checkbox is "keep asking me", and a
 * cross-over is not a quiet retraction of it.
 */
export function updateGateChoice(door: GateDoor): void {
  try {
    // readGateChoice, not a truthy getItem: the two have to answer the same question. A leftover
    // value this function cannot read ("Portal", a stale schema) is "nothing is remembered" to
    // every reader, and a bare truthy check would quietly heal it into a real preference.
    if (readGateChoice()) localStorage.setItem(GATE_CHOICE_KEY, door);
  } catch { /* private window — nothing was remembered to update */ }
}

/**
 * Why a door is closed. Not one "no access" state, because each takes a different action: a paused
 * account waits for an administrator to lift it, an account that never activated has a code to use,
 * an ungranted one asks for a grant, and an account with neither door is a broken record somebody
 * has to repair.
 */
export type GateDenial = "appNotGranted" | "portalNotGranted" | "notActivated" | "suspended" | "noDoor";

/** Everything the gate needs to judge an account. A subset of PortalUser so callers can pass one. */
export type GateUser = Pick<PortalUser, "name" | "email" | "permission" | "appAccess" | "status">;

/**
 * Why this door is shut for this account, or null if it is open.
 *
 * ONE derivation. There used to be three — the app door, the Portal door and /gate each re-derived
 * it from the same two helpers — and they disagreed: the Portal door read the role and never the
 * status, so a suspended administrator was turned away from the app and handed the roster, the
 * license and the audit log; and an account that had never activated was told it was "suspended",
 * over a table that said "Never activated" two lines below. Three copies of one decision is three
 * places to get it wrong and three places the backend has to be told about.
 *
 * Order matters and says what it means: a missing grant is answered before an account state,
 * because "you were never given this" and "you cannot use it today" are different sentences and
 * the first one outranks. An account with neither grant is neither — it is a record to repair.
 */
export function denialFor(user: GateUser | undefined, door: GateDoor): GateDenial | null {
  // Fail-open, the same as both shells before this existed: an identity we cannot resolve locks
  // nothing, because the door that matters is the server. See the note at the top of this file.
  if (!user) return null;
  const portal = canEnterPortal(user.permission);
  if (!portal && !user.appAccess) return "noDoor";
  const granted = door === "portal" ? portal : user.appAccess;
  if (!granted) return door === "portal" ? "portalNotGranted" : "appNotGranted";
  if (user.status === "suspended") return "suspended";
  if (user.status === "invited") return "notActivated";
  return null;
}

const T = {
  en: {
    chooseTitle: "Where to?",
    remember: "Remember on this workstation",
    appName: "Monitoring app",
    appWhat: "Live cameras, detections, search",
    portalName: "Portal",
    portalWhat: "Cameras, people, license, audit log",
    deniedAppTitle: "This account does not have the monitoring app",
    deniedPortalTitle: "This account does not have Portal",
    suspendedTitle: "This account is suspended",
    notActivatedTitle: "This account has not been activated yet",
    noDoorTitle: "This account has no access",
    suspendedBody: "An administrator paused it. Sign-in resumes once they restore it.",
    notActivatedBody: "Use the registration code your administrator gave you to set a password first.",
    appNotGrantedBody: "An administrator grants app access per account, in Portal under Users & Permissions.",
    portalNotGrantedBody: "Portal is for console roles. An administrator grants it per account.",
    noDoorBody: "Neither door is open, which an administrator has to correct — no screen here can.",
    holds: "This account holds",
    portalRole: "Portal",
    appDoor: "Monitoring app",
    granted: "Granted",
    notGranted: "Not granted",
    accountState: "Account",
    states: { active: "Active", invited: "Never activated", suspended: "Suspended" },
    goPortal: "Go to Portal",
    goApp: "Go to the monitoring app",
    logOut: "Log out",
    activateWithCode: "Activate with a registration code",
    contactNamed: (who: string) => <>For an account or access, contact <strong style={{ color: "var(--gray-600)" }}>{who}</strong>.</>,
    contactGeneric: "For an account or access, contact your security operations team.",
    roles: { owner: "Owner", admin: "Administrator", auditor: "Read-only admin", none: "No console access" },
  },
  ko: {
    chooseTitle: "어디로 가시겠습니까?",
    remember: "이 단말에서 기억하기",
    appName: "모니터링 앱",
    appWhat: "실시간 카메라, 검출, 검색",
    portalName: "Portal",
    portalWhat: "카메라, 사용자, 라이선스, 감사 로그",
    deniedAppTitle: "이 계정에는 모니터링 앱 권한이 없습니다",
    deniedPortalTitle: "이 계정에는 Portal 권한이 없습니다",
    suspendedTitle: "정지된 계정입니다",
    notActivatedTitle: "아직 활성화되지 않은 계정입니다",
    noDoorTitle: "접근 권한이 없는 계정입니다",
    suspendedBody: "관리자가 계정을 정지했습니다. 관리자가 해제하면 다시 로그인할 수 있습니다.",
    notActivatedBody: "관리자에게 받은 등록 코드로 먼저 비밀번호를 설정해주세요.",
    appNotGrantedBody: "앱 접근 권한은 관리자가 Portal의 사용자 및 권한에서 계정별로 부여합니다.",
    portalNotGrantedBody: "Portal은 관리자 역할의 화면입니다. 관리자가 계정별로 부여합니다.",
    noDoorBody: "열린 문이 없습니다. 이 화면에서는 해결할 수 없고 관리자가 고쳐야 합니다.",
    holds: "이 계정의 권한",
    portalRole: "Portal",
    appDoor: "모니터링 앱",
    granted: "있음",
    notGranted: "없음",
    accountState: "계정 상태",
    states: { active: "정상", invited: "미활성", suspended: "정지" },
    goPortal: "Portal로 가기",
    goApp: "모니터링 앱으로 가기",
    logOut: "로그아웃",
    activateWithCode: "등록 코드로 계정 활성화하기",
    contactNamed: (who: string) => <>계정이나 접근 권한은 <strong style={{ color: "var(--gray-600)" }}>{who}</strong>에게 문의해주세요.</>,
    contactGeneric: "계정이나 접근 권한은 보안 관제 담당자에게 문의해주세요.",
    roles: { owner: "최고관리자", admin: "관리자", auditor: "읽기 전용 관리자", none: "권한 없음" },
  },
} as const;

const CARD_BORDER = "1px solid var(--line)";

/** Name and address of whoever is being turned away or asked — the line they read out on the
 *  phone. Kept out of the denial copy so the copy stays about the decision. */
function Identity({ name, email }: { name: string; email: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
      <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.28px" }}>{name}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.26px" }}>{email}</span>
    </div>
  );
}

/** One door, as a card. The accent is on hover only: a chooser that colours one option has
 *  answered the question it is asking. */
function DoorCard({ icon, name, what, onClick }: {
  icon: React.ReactNode; name: string; what: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, display: "flex", flexDirection: "column", gap: "14px", alignItems: "flex-start",
        padding: "20px", textAlign: "left", cursor: "pointer",
        borderRadius: "12px", backgroundColor: "white",
        border: hover ? "1px solid var(--primary-300)" : CARD_BORDER,
        boxShadow: hover ? "var(--shadow-popover)" : "var(--shadow-raised)",
      }}
    >
      {/* Icon and arrow on one line: the arrow marks the card as a way through, and on its own
          row under the copy it read as a list item waiting for a label. */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "40px", height: "40px", borderRadius: "10px",
          backgroundColor: hover ? "var(--primary-100)" : "var(--gray-100)",
          color: hover ? "var(--primary-400)" : "var(--gray-600)",
        }}>
          {icon}
        </div>
        <ArrowRight size={16} strokeWidth={2.5} color={hover ? "var(--primary-400)" : "var(--gray-300)"} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.3px" }}>{name}</span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.26px", lineHeight: 1.5 }}>{what}</span>
      </div>
    </button>
  );
}

/** What the account actually holds, both halves, whichever one was refused. An operator told only
 *  "no access" cannot tell an administrator what to change. */
function Grants({ permission, appAccess, status, t }: {
  permission: PortalPermission; appAccess: boolean; status: PortalUser["status"];
  t: typeof T["en"] | typeof T["ko"];
}) {
  const rows: { label: string; value: string; on: boolean }[] = [
    { label: t.portalRole, value: t.roles[permission], on: canEnterPortal(permission) },
    { label: t.appDoor, value: appAccess ? t.granted : t.notGranted, on: appAccess },
  ];
  // Only when it is not active. A grant reading "granted" beside a door that refuses the person
  // is the table contradicting the screen — and the answer is the account state, not the grant:
  // a suspended app user keeps app access and still cannot open it.
  if (status !== "active") rows.push({ label: t.accountState, value: t.states[status], on: false });
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.holds}</span>
      <div style={{ border: CARD_BORDER, borderRadius: "10px", overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 14px", backgroundColor: "var(--gray-50)",
            borderTop: i === 0 ? "none" : CARD_BORDER,
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{r.label}</span>
            <span style={{
              fontSize: "13px", fontWeight: 700, letterSpacing: "-0.26px",
              // Not gray-400: at 12-13px on gray-50 that was 2.45:1, and "Not granted" is the
              // single word somebody reads down a telephone to an administrator.
              color: r.on ? "var(--gray-900)" : "var(--gray-500)",
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: "52px", width: "100%", border: "none", borderRadius: "8px",
        backgroundColor: "var(--primary-400)", color: "white",
        fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px", cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/**
 * The way out. Goes to /login and nothing more — which is the honest amount for now, and the same
 * thing the two account menus do. It used to go to /login?demo=signedOut, borrowing the developer
 * preview of the sign-out notice: that banner says "you have been signed out of this workstation",
 * and nothing is signed out of anything — there is no session yet, the identity is a constant, and
 * typing / walks straight back in. A product path should not run through `demo=` either.
 */
function LogOutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <QuietButton label={label} icon={<LogOut size={15} strokeWidth={2.4} />} onClick={onClick} />;
}

/** Who to call. On a site with no mail this is the whole recovery path (see authConfig), and the
 *  gate was the one refusal screen in the product not carrying it. */
function SupportLine({ t, contact }: { t: typeof T["en"] | typeof T["ko"]; contact: string | null }) {
  return (
    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px", textAlign: "center", lineHeight: 1.6 }}>
      {contact ? t.contactNamed(contact) : t.contactGeneric}
    </p>
  );
}

function QuietButton({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        height: "44px", width: "100%", borderRadius: "8px", cursor: "pointer",
        border: CARD_BORDER, backgroundColor: "white",
        fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The screen. `denial` absent means the account holds both doors and is being asked which.
 *
 * A denial REQUIRES the account, and the type says so. With both optional, a caller could pass a
 * refusal and no user, and the screen would draw a grants table out of the fallbacks — "no console
 * role, no app" — under the stand-in's real name and address. An invented set of permissions
 * attributed to a named person is the failure that looks like a working screen.
 */
type AccessGateProps =
  | { user?: GateUser; denial?: undefined; inPortal?: boolean }
  | { user: GateUser; denial: GateDenial; inPortal?: boolean };

export default function AccessGate({ user, denial, inPortal = false }: AccessGateProps) {
  const router = useRouter();
  const authConfig = getAuthConfig();
  // Two language settings exist and this screen is drawn under both: /gate and the app door read
  // the app's, and the Portal door has to read Portal's, or an administrator who set the console
  // to Korean is refused in English — on the one screen whose whole job is to be read and repeated
  // to somebody else. Both hooks always run; only the answer is chosen.
  const [appLang] = useLanguage();
  const [portalLang] = usePortalLanguage();
  const lang = inPortal ? portalLang : appLang;
  const t = T[lang];
  // Unticked by default (decided 2026-09-15). It was ticked, on the reasoning that asking every
  // morning is not what anybody wants from a two-door install — true of one person on one browser,
  // and this store is neither. localStorage belongs to the WORKSTATION, and the deployment is
  // control rooms where a terminal is handed over at shift change: a default that remembers means
  // the first person to touch a new terminal silently decides where the next person lands, without
  // either of them being asked. Remembering is worth having, so the box stays — it just has to be
  // somebody choosing it, not the screen choosing for them.
  const [remember, setRemember] = useState(false);

  const name = user?.name ?? SIGNED_IN_USER.name;
  const email = user?.email ?? SIGNED_IN_USER.email;
  const permission = user?.permission ?? "none";
  const appAccess = user?.appAccess ?? false;
  const status = user?.status ?? "active";

  /** Answering the question. The checkbox is the whole of the consent, both ways. */
  const choose = (door: GateDoor) => {
    try {
      if (remember) localStorage.setItem(GATE_CHOICE_KEY, door);
      // Unticking has to be able to undo a previous ticking, or the setting is a one-way door:
      // a stored choice makes login skip this screen, so the only way back to the checkbox is to
      // type /gate — and it used to leave the old value sitting there when you got here.
      else localStorage.removeItem(GATE_CHOICE_KEY);
    } catch { /* private window — nothing is remembered, so the question comes back */ }
    router.replace(door === "portal" ? "/portal" : "/");
  };

  /**
   * Leaving through the door that IS open, from a refusal.
   *
   * updateGateChoice, never a bare write: this screen shows no checkbox, so there is no consent
   * here to record. It used to call the same function as the chooser, which defaults to
   * "remember" — so being turned away from one door silently created a preference nobody was
   * asked about, and did it even for somebody who had unticked the box earlier.
   */
  const leaveTo = (door: GateDoor) => {
    updateGateChoice(door);
    router.replace(door === "portal" ? "/portal" : "/");
  };

  const title = denial === "suspended" ? t.suspendedTitle
    : denial === "notActivated" ? t.notActivatedTitle
    : denial === "appNotGranted" ? t.deniedAppTitle
    : denial === "portalNotGranted" ? t.deniedPortalTitle
    : denial === "noDoor" ? t.noDoorTitle
    : t.chooseTitle;
  const body = denial === "suspended" ? t.suspendedBody
    : denial === "notActivated" ? t.notActivatedBody
    : denial === "appNotGranted" ? t.appNotGrantedBody
    : denial === "portalNotGranted" ? t.portalNotGrantedBody
    : denial === "noDoor" ? t.noDoorBody
    : null;

  // The way out, asked of the same function the arriving door will ask. Derived rather than
  // matched against the denial: the old version read "appNotGranted means Portal is open", which
  // is true of the grant and not of the account — a suspended auditor with no app was refused
  // here and handed a Portal button, and Portal took it, because that door was not reading status
  // either. Whatever denialFor says is open is open.
  const otherDoor: GateDoor | null = !denial ? null
    : denialFor(user, "portal") === null ? "portal"
    : denialFor(user, "app") === null ? "app"
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader scope={inPortal ? "portal" : "app"} />
      <div className="vca-auth-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: denial ? "400px" : "560px", maxWidth: "100%",
          margin: "auto 0",
          display: "flex", flexDirection: "column", gap: "28px", alignItems: "center",
        }}>
          {denial && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "48px", height: "48px", borderRadius: "12px",
              backgroundColor: "var(--gray-100)", color: "var(--gray-500)",
            }}>
              <ShieldOff size={22} strokeWidth={2} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "34px", textAlign: "center" }}>
              {title}
            </h1>
            {body && (
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.5 }}>
                {body}
              </p>
            )}
            <Identity name={name} email={email} />
          </div>

          {denial ? (
            <>
              <Grants permission={permission} appAccess={appAccess} status={status} t={t} />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                {otherDoor === "portal" && <PrimaryButton label={t.goPortal} onClick={() => leaveTo("portal")} />}
                {otherDoor === "app" && <PrimaryButton label={t.goApp} onClick={() => leaveTo("app")} />}
                {/* A code and nowhere to use it is the dead end login already refused to leave
                    people in — this screen had copied its sentence and left the button behind. */}
                {denial === "notActivated" && authConfig.registrationCode && (
                  <PrimaryButton label={t.activateWithCode} onClick={() => router.push("/register")} />
                )}
                <LogOutButton label={t.logOut} onClick={() => router.replace("/login")} />
              </div>
              <SupportLine t={t} contact={authConfig.supportContact} />
            </>
          ) : (
            <>
              <div style={{ width: "100%", display: "flex", gap: "14px", alignItems: "stretch" }}>
                <DoorCard
                  icon={<Cctv size={20} strokeWidth={2} />}
                  name={t.appName} what={t.appWhat}
                  onClick={() => choose("app")}
                />
                <DoorCard
                  icon={<Building2 size={20} strokeWidth={2} />}
                  name={t.portalName} what={t.portalWhat}
                  onClick={() => choose("portal")}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--primary-400)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.remember}</span>
              </label>
              {/* The refusals all carry one, and this is the screen that first shows somebody a
                  name — on a shared terminal it is as likely to be the last person's as your own. */}
              <div style={{ width: "100%", maxWidth: "260px" }}>
                <LogOutButton label={t.logOut} onClick={() => router.replace("/login")} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
