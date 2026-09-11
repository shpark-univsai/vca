"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cctv, Building2, ShieldOff, ArrowRight, LogOut } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { useLanguage } from "@/lib/i18n";
import {
  canEnterPortal, canUseAppNow, SIGNED_IN_USER,
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

/** Remembered so the choice is asked once per browser, not once per shift. Both shells link to
 *  the other half from their account menu, so this closes nothing permanently. */
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
 * Why a door is closed. Not one "no access" state, because the three take different actions:
 * a paused account waits for an administrator, an ungranted one asks for a grant, and an account
 * with neither door is a broken record somebody has to repair.
 */
export type GateDenial = "appNotGranted" | "portalNotGranted" | "suspended" | "noDoor";

const T = {
  en: {
    chooseTitle: "Where to?",
    remember: "Remember this choice",
    appName: "Monitoring app",
    appWhat: "Live cameras, detections, search",
    portalName: "Portal",
    portalWhat: "Cameras, people, license, audit log",
    deniedAppTitle: "This account does not have the monitoring app",
    deniedPortalTitle: "This account does not have Portal",
    suspendedTitle: "This account is suspended",
    noDoorTitle: "This account has no access",
    suspendedBody: "An administrator paused it. Sign-in resumes once they restore it.",
    appNotGrantedBody: "An administrator grants app access per account.",
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
    signOut: "Sign out",
    roles: { owner: "Owner", admin: "Administrator", auditor: "Auditor", none: "No console access" },
  },
  ko: {
    chooseTitle: "어디로 가시겠습니까?",
    remember: "이 선택 기억하기",
    appName: "모니터링 앱",
    appWhat: "실시간 카메라, 검출, 검색",
    portalName: "Portal",
    portalWhat: "카메라, 사용자, 라이선스, 감사 로그",
    deniedAppTitle: "이 계정에는 모니터링 앱 권한이 없습니다",
    deniedPortalTitle: "이 계정에는 Portal 권한이 없습니다",
    suspendedTitle: "정지된 계정입니다",
    noDoorTitle: "접근 권한이 없는 계정입니다",
    suspendedBody: "관리자가 계정을 정지했습니다. 관리자가 해제하면 다시 로그인할 수 있습니다.",
    appNotGrantedBody: "앱 접근 권한은 관리자가 계정별로 부여합니다.",
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
    signOut: "로그아웃",
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
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "-0.24px" }}>{t.holds}</span>
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
              color: r.on ? "var(--gray-900)" : "var(--gray-400)",
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

/** The screen. `denial` absent means the account holds both doors and is being asked which. */
export default function AccessGate({ user, denial }: {
  /** The signed-in account. Undefined only where the stand-in identity matches no seeded row —
   *  the same fail-open case both shells already carry. */
  user?: Pick<PortalUser, "name" | "email" | "permission" | "appAccess" | "status">;
  denial?: GateDenial;
}) {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  const [remember, setRemember] = useState(false);

  const name = user?.name ?? SIGNED_IN_USER.name;
  const email = user?.email ?? SIGNED_IN_USER.email;
  const permission = user?.permission ?? "none";
  const appAccess = user?.appAccess ?? false;
  const status = user?.status ?? "active";

  const go = (door: GateDoor) => {
    if (remember) {
      try { localStorage.setItem(GATE_CHOICE_KEY, door); } catch { /* private window — ask again */ }
    }
    router.replace(door === "portal" ? "/portal" : "/");
  };

  const title = denial === "suspended" ? t.suspendedTitle
    : denial === "appNotGranted" ? t.deniedAppTitle
    : denial === "portalNotGranted" ? t.deniedPortalTitle
    : denial === "noDoor" ? t.noDoorTitle
    : t.chooseTitle;
  const body = denial === "suspended" ? t.suspendedBody
    : denial === "appNotGranted" ? t.appNotGrantedBody
    : denial === "portalNotGranted" ? t.portalNotGrantedBody
    : denial === "noDoor" ? t.noDoorBody
    : null;

  // The way out, and only where it is genuinely open. A suspended account has no open door even
  // where both are granted, so it is offered none — being sent to Portal and turned away there
  // would be the same silent bounce this screen exists to replace.
  const otherDoor: GateDoor | null = denial === "suspended" || denial === "noDoor" ? null
    : denial === "appNotGranted" && canEnterPortal(permission) ? "portal"
    : denial === "portalNotGranted" && !!user && canUseAppNow(user) ? "app"
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div className="vca-auth-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: denial ? "400px" : "560px", maxWidth: "100%",
          margin: "auto 0", padding: "40px 20px",
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
                {otherDoor === "portal" && <PrimaryButton label={t.goPortal} onClick={() => go("portal")} />}
                {otherDoor === "app" && <PrimaryButton label={t.goApp} onClick={() => go("app")} />}
                <QuietButton
                  label={t.signOut}
                  icon={<LogOut size={15} strokeWidth={2.4} />}
                  onClick={() => router.replace("/login?demo=signedOut")}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ width: "100%", display: "flex", gap: "14px", alignItems: "stretch" }}>
                <DoorCard
                  icon={<Cctv size={20} strokeWidth={2} />}
                  name={t.appName} what={t.appWhat}
                  onClick={() => go("app")}
                />
                <DoorCard
                  icon={<Building2 size={20} strokeWidth={2} />}
                  name={t.portalName} what={t.portalWhat}
                  onClick={() => go("portal")}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
