"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  DISTRICT_ALERT_THRESHOLD_KEY, DISTRICT_MODERATE_THRESHOLD_KEY,
  DEFAULT_DISTRICT_ALERT_THRESHOLD, DEFAULT_DISTRICT_MODERATE_THRESHOLD,
} from "@/lib/mockData";
import { APP_ACTIONS, canEnterPortal, canUseAppNow, currentPortalUser, holdsAppAction, scopedCameraIds, SIGNED_IN_USER, useProjectCameras, useVcaStore } from "@/lib/vcaStore";
import { EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { useLanguage } from "@/lib/i18n";
import { RADIUS } from "@/components/shared/controls";
// One source for the seven names, shared with the Portal screens that grant them. This page used
// to keep its own copy and it had already drifted: it said "실시간 관제" for a tab the app calls
// 대시보드, so the person reading their own permissions went looking for a tab that is not there.
import { APP_GRANT_LABELS } from "@/lib/appGrants";
import { GRANT_TREE } from "@/components/portal/PortalShared";

// See the per-file pattern note in lib/i18n.ts. SIGNED_IN_USER's role and team are not in here on
// purpose — those are the customer's own words for their org chart, and translating them would put
// a job title on screen that appears nowhere in their records.
const T = {
  en: {
    comingSoon: "Coming soon",
    close: "Close",
    // Not "Password changed". Verbatim from Portal's own change-password modal
    // (PortalSettingsPage), which refuses to claim this for the same reason.
    passwordNotWired: "Not connected yet. A password typed here is not saved.",
    passwordNotSaved: "Password not changed",
    passwordNotSavedBody: "Ask whoever runs your installation to change it for now.",
    done: "Done",
    changePassword: "Change password",
    currentPassword: "Current password",
    verify: "Verify",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords do not match. Please try again.",
    updatePassword: "Update Password",
    thresholdsTitle: "Map alert thresholds",
    thresholdsBody: "Today's VIP-hit count a district needs before its map badge turns red (alert) or navy (moderate).",
    alertRed: "Alert (red)",
    moderateNavy: "Moderate (navy)",
    saveChanges: "Save Changes",
    saved: "Saved",
    settings: "Settings",
    myPage: "My page",
    myGrants: "What this account can open",
    myGrantsWho: "Granted per account. An administrator changes this in Portal, under Users & Permissions.",
    myGrantsOff: (list: string) => `Not granted: ${list}`,
    myCameras: "Cameras you can see",
    myCamerasAll: "Every camera at this site",
    myCamerasSome: (n: number) => `${n} assigned to this account`,
    /* An empty scope is somebody's answer, not a missing one — see scopedCameraIds. It has to
       read as different from "every camera", because on every screen in the app the two look
       the same: a list with nothing in it. */
    myCamerasNone: "No cameras assigned",
    myCamerasGroups: (names: string) => `Through ${names}`,
    profile: "Profile information",
    fullName: "Full name",
    emailAddress: "Email address",
    departmentTeam: "Department / team",
    security: "Sign-in",
    passwordSettings: "Password settings",
    passwordChange: "Password change",
    // HANDOFF NOTE: no "last changed" line is drawn at all until the account record carries a
    // real timestamp — the server has to send it. Do not wire this to a constant (it was fixed at
    // 45 days) and do not wire it to "just now" off a click either: nothing here saves a password,
    // so this session changed nothing to be "just now".
    changedDaysAgo: (n: number) => `Last changed ${n} days ago`,
    change: "Change",
    sessions: "Active login sessions",
    sessionsEnded: (n: number) => `${n} session${n === 1 ? "" : "s"} ended`,
    signOutOthers: "Sign out other sessions",
    onlyDeviceKnown: "Only the browser you are in — other sessions are not visible here yet",
    thisBrowser: "This browser",
    activeNow: "Active now",
    systemPreferences: "System preferences",
    interfaceLanguage: "App interface language",
    interfaceLanguageNote: "The monitoring app only. Portal keeps its own, set from Settings there.",
    thresholdLevels: "Alert levels",
    thresholdSummary: (alert: number, moderate: number) => `Alert ${alert} · Moderate ${moderate}`,
  },
  ko: {
    comingSoon: "준비 중",
    close: "닫기",
    passwordNotWired: "아직 서버에 연결되지 않아, 여기서 입력한 비밀번호는 저장되지 않습니다.",
    passwordNotSaved: "비밀번호는 바뀌지 않았습니다",
    passwordNotSavedBody: "변경은 설치를 담당한 곳으로 요청하세요.",
    done: "확인",
    changePassword: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    verify: "확인",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
    updatePassword: "비밀번호 변경",
    thresholdsTitle: "지도 경보 기준",
    thresholdsBody: "지도의 구역 배지가 빨강(경보) 또는 남색(주의)으로 바뀌는 데 필요한 당일 VIP 감지 수입니다.",
    alertRed: "경보 (빨강)",
    moderateNavy: "주의 (남색)",
    saveChanges: "변경 사항 저장",
    saved: "저장됨",
    settings: "설정",
    myPage: "마이 페이지",
    myGrants: "이 계정이 열 수 있는 것",
    myGrantsWho: "계정마다 따로 지정됩니다. Portal의 사용자 및 권한에서 관리자가 바꿉니다.",
    myGrantsOff: (list: string) => `받지 않은 것: ${list}`,
    myCameras: "보이는 카메라",
    myCamerasAll: "이 현장의 모든 카메라",
    myCamerasSome: (n: number) => `이 계정에 지정된 ${n}대`,
    myCamerasNone: "지정된 카메라가 없습니다",
    myCamerasGroups: (names: string) => `${names} 그룹으로`,
    profile: "프로필 정보",
    fullName: "이름",
    emailAddress: "이메일 주소",
    departmentTeam: "부서 / 팀",
    security: "로그인 수단",
    passwordSettings: "비밀번호 설정",
    passwordChange: "비밀번호 변경",
    changedDaysAgo: (n: number) => `${n}일 전에 변경했습니다`,
    change: "변경",
    sessions: "접속 중인 기기",
    sessionsEnded: (n: number) => `${n}개 세션을 종료했습니다`,
    signOutOthers: "다른 기기 로그아웃",
    onlyDeviceKnown: "지금 쓰는 브라우저만 보입니다 — 다른 접속은 아직 여기서 확인할 수 없습니다",
    thisBrowser: "지금 쓰는 브라우저",
    activeNow: "지금 접속 중",
    systemPreferences: "시스템 환경설정",
    interfaceLanguage: "앱 화면 언어",
    interfaceLanguageNote: "모니터링 앱에만 적용됩니다. Portal은 별도이고, Portal의 설정에서 정합니다.",
    thresholdLevels: "경보 단계",
    thresholdSummary: (alert: number, moderate: number) => `경보 ${alert} · 주의 ${moderate}`,
  },
} as const;

/** Listed in its own script, the way every language picker lists a language. */
const LANGUAGE_OPTIONS = [
  { value: "en" as const, label: "English" },
  { value: "ko" as const, label: "한국어" },
];


// The console's one hairline value — see --line in globals.css, which was defined for exactly
// this and then never reached the app: eight files each declared their own gray-200 rule instead,
// so Portal and the app drew different lines.
const CARD_BORDER = "1px solid var(--line)";

// This browser only. A real list — other devices, their last activity — comes from the backend's
// session store, which is also what makes ending one possible: with stateless tokens alone there
// is nothing to revoke before expiry, and a control offering it would be lying. Shaped as a list
// so the UI is already right when that arrives.
const LOGIN_SESSIONS: { id: string; device: string; where?: string; current: boolean; lastActive?: string }[] = [
  // `where` is OPTIONAL and this row has none. It used to read "Singapore · 1.3521, 103.8198" —
  // a coordinate the browser never measured, on a screen whose whole subject is "is this really
  // me". The device string was "MacBook Pro (Chrome)", which told every operator on Windows a
  // fact about their own machine that was false. What the page can honestly say is that this is
  // the browser it is running in, and it says only that until the session store arrives.
  { id: "current", device: "", current: true },
];

function UserCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10.6669 7.33333L12.0003 8.66667L14.6672 6M10.6669 14V12.6667C10.6669 11.9594 10.3859 11.2811 9.88577 10.781C9.38563 10.281 8.7073 10 8 10H3.99968C3.29238 10 2.61405 10.281 2.11391 10.781C1.61377 11.2811 1.3328 11.9594 1.3328 12.6667V14M8.66672 4.66667C8.66672 6.13943 7.47272 7.33333 5.99984 7.33333C4.52696 7.33333 3.33296 6.13943 3.33296 4.66667C3.33296 3.19391 4.52696 2 5.99984 2C7.47272 2 8.66672 3.19391 8.66672 4.66667Z" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8.22664 14.6335C10.9997 13.6668 13.3328 12.0001 13.3328 8.66667V3.99985C13.3328 3.82304 13.2626 3.65346 13.1376 3.52843C13.0125 3.40341 12.843 3.33316 12.6662 3.33316C11.333 3.33316 9.67317 2.53981 8.50662 1.51977C8.36539 1.3991 8.18575 1.3328 8 1.3328C7.81425 1.3328 7.63461 1.3991 7.49338 1.51977C6.3335 2.53314 4.667 3.33316 3.3338 3.33316C3.15701 3.33316 2.98745 3.40341 2.86244 3.52843C2.73743 3.65346 2.6672 3.82304 2.6672 3.99985V8.66667C2.6672 12.0001 5.0003 13.6668 7.78002 14.6269C7.9237 14.6804 8.08143 14.6827 8.22664 14.6335Z" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
/* Was the padlock inside the three read-only fields. Those are plain lines now, so it moves up
   to the 로그인 수단 card's heading — 16x16, like every other CardHeader icon on this page. */
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
      <path d="M4.08333 6.41662V4.0831C4.08333 3.30949 4.39062 2.56757 4.93761 2.02054C5.48459 1.47352 6.22645 1.1662 7 1.1662C7.77355 1.1662 8.51541 1.47352 9.06239 2.02054C9.60938 2.56757 9.91667 3.30949 9.91667 4.0831V6.41662M2.91667 6.41662H11.0833C11.7277 6.41662 12.25 6.939 12.25 7.58338V11.667C12.25 12.3114 11.7277 12.8338 11.0833 12.8338H2.91667C2.27233 12.8338 1.75 12.3114 1.75 11.667V7.58338C1.75 6.939 2.27233 6.41662 2.91667 6.41662Z" stroke="var(--gray-500)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function MonitorIcon() {
  // 16x16 (viewBox stays 14x14) — every other CardHeader icon on this page is 16x16; this one
  // rendering at 14x14 made "Active Login Sessions" sit visibly smaller/off-center next to its
  // siblings ("Profile Information", "Security & Access Control", etc.).
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
      <path d="M4.66648 12.25H9.33352M7 9.91667V12.25M2.33296 1.75H11.667C12.3114 1.75 12.8338 2.27233 12.8338 2.91667V8.75C12.8338 9.39433 12.3114 9.91667 11.667 9.91667H2.33296C1.68858 9.91667 1.1662 9.39433 1.1662 8.75V2.91667C1.1662 2.27233 1.68858 1.75 2.33296 1.75Z" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6.66667 5.33333H9.33333M8 14V8M8 5.33333V2M11.3333 10.6667H14M12.6667 8V2M12.6667 14V10.6667M2 9.33333H4.66667M3.33333 6.66667V2M3.33333 14V9.33333" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function AlertBellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5C5.79 1.5 4 3.29 4 5.5V8.5L2.5 10.5H13.5L12 8.5V5.5C12 3.29 10.21 1.5 8 1.5Z" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.1"/>
      <path d="M6.5 13C6.5 13.8284 7.17157 14.5 8 14.5C8.82843 14.5 9.5 13.8284 9.5 13" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--gray-600)" strokeLinecap="round" strokeWidth="1.1"/>
    </svg>
  );
}

/** One grant, held or not. Both states are drawn — a list of only what you have cannot answer
 *  "is there a Re-ID screen at all", which is the question somebody asks before phoning. */
function GrantChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", borderRadius: RADIUS.pill,
      backgroundColor: on ? "var(--info-100)" : "var(--gray-50)",
      color: on ? "var(--info-500)" : "var(--gray-400)",
      fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <span>{on ? "✓" : "—"}</span>
      {label}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: RADIUS.card, padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {children}
    </div>
  );
}
function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {icon}
      <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>{title}</span>
    </div>
  );
}
/**
 * A FACT, NOT A FIELD.
 *
 * These three were drawn as filled boxes with a padlock in them, which is what every editable
 * input on this page looks like with one icon added. MEASURED after the two-column change: each
 * box ran 850px wide to hold 「Grace Tan」, so three boxes of mostly empty grey stood where three
 * short lines belong, and the first thing the eye met on an account page was three things it
 * cannot do anything with. A value nobody can change is read, so it reads as text: the label
 * beside it, the value after it, no box and no lock to explain.
 */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", width: "100%" }}>
      <span style={{ flexShrink: 0, minWidth: "96px", fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{label}</span>
      <span style={{ minWidth: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.26px", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}
/**
 * `disabledOptions` exists for options that are on the roadmap but not built. Listing them and
 * letting them be picked is worse than not listing them at all — the setting appears to take and
 * then nothing happens — while dropping them loses the signal that the work is planned. A greyed,
 * unclickable row with "Coming soon" beside it says both things at once.
 */
function DropdownBtn<V extends string>({ value, options, onSelect, disabledValues = [] }: {
  value: V; options: readonly { value: V; label: string }[]; onSelect: (v: V) => void; disabledValues?: readonly V[];
}) {
  const [open, setOpen] = useState(false);
  const [lang] = useLanguage();
  const t = T[lang];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);
  useEscapeKey(() => setOpen(false), open);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: RADIUS.control, padding: "6px 10px", cursor: "pointer" }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.24px" }}>
          {options.find(o => o.value === value)?.label ?? value}
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20, backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: RADIUS.panel, boxShadow: "var(--shadow-popover)", minWidth: "150px", overflow: "hidden" }}>
          {options.map(opt => {
            const unavailable = disabledValues.includes(opt.value);
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                disabled={unavailable}
                onClick={() => { onSelect(opt.value); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", backgroundColor: selected ? "var(--gray-50)" : "white", cursor: unavailable ? "default" : "pointer", fontSize: "12px", fontWeight: selected ? 700 : 500, color: unavailable ? "var(--gray-400)" : "var(--gray-700)" }}
              >
                {opt.label}
                {unavailable && (
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.comingSoon}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function ThresholdField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.26px" }}>{label}</span>
        <input
          /* The input IS the box, so .vca-field goes on it directly (:focus-within matches the
             focused element itself). It cleared `outline` but not the shared ring's halo, so
             focusing drew a --gray-100 glow and left the border grey — invisible on white. */
          className="vca-field"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          style={{ width: "72px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", border: "1px solid var(--gray-200)", borderRadius: RADIUS.control, padding: "6px 8px", outline: "none" }}
        />
      </div>
      <input
        className="vca-threshold-slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        style={{ width: "100%", cursor: "pointer", margin: 0 }}
      />
    </div>
  );
}

function fieldBorder(active: boolean) {
  /* Resting on --line-control, the token every field in the product uses; gray-900 stays for the
     focused one. It was gray-300 at rest — hue 214, the cold slate half of the ramp, against a
     page ground and a line family at 240. */
  return active ? "1px solid var(--gray-900)" : "1px solid var(--line-control)";
}

// Changing a password from Settings shouldn't feel like leaving the app — this stays as an
// in-page modal (same field/validation logic as the auth flow's /password-setup, which is a
// different case: first-time setup, not an already-logged-in user changing theirs) instead of
// navigating to a full standalone route.
function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [step, setStep] = useState<"current" | "new" | "done">("current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<"current" | "new" | "confirm" | null>(null);
  useEscapeKey(onClose);

  // No real account backend to check against yet (same as /login, which accepts any non-empty
  // credentials — see the auth-pages-are-mockups note). Requiring the field to be filled in is
  // the honest stand-in: swap this for a real "verify current password" API call once one exists.
  const canVerifyCurrent = currentPassword.length > 0;
  const handleVerifyCurrent = () => {
    if (!canVerifyCurrent) return;
    setStep("new");
  };

  // Was a third copy of the rule, inline. Three copies is how two screens end up disagreeing
  // about whether "abc12345" is allowed — this now reads the one definition the auth flow uses.
  const formatValid = isPasswordFormatValid(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  // Lit only when the click would actually work. The old form of this was `both fields non-empty`
  // plus a second, differently-worded condition on the button, which agreed by accident.
  const canSubmit = formatValid && confirmPassword.length > 0 && !mismatch;
  const formatBroken = newPassword.length > 0 && !formatValid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Validates what a browser can validate and then has nowhere to send it, so the last step
    // says that instead of a green tick. Same call, same wording as Portal's own change-password
    // modal (PortalSettingsPage): a plausible "Password changed" is indistinguishable from a real
    // one, and the person would walk away believing it.
    //
    // HANDOFF NOTE: submits nowhere. The real call is a POST carrying the current and the new
    // password, and its response is what turns this step back into a success line.
    setStep("done");
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "var(--scrim)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: "440px", maxWidth: "calc(100vw - 48px)", backgroundColor: "white",
        borderRadius: RADIUS.card, padding: "28px", boxShadow: "var(--shadow-modal)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>
        {step === "done" ? (
          /* No tick and no green. The circle said "done" before the sentence did, and it was the
             loudest thing in the modal. */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "12px 0" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--gray-900)" }}>{t.passwordNotSaved}</p>
              <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)" }}>{t.passwordNotSavedBody}</p>
            </div>
            <button
              onClick={onClose}
              style={{ height: "40px", padding: "0 24px", border: "none", borderRadius: RADIUS.control, backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
            >
              {t.done}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.34px" }}>{t.changePassword}</h2>
              <button onClick={onClose} aria-label={t.close} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4L14 14M14 4L4 14" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Said before the typing rather than after it, on both steps — the person should
                learn that this goes nowhere before composing a password and entering it twice,
                not in the notice that follows. Amber, because a quiet grey line is not enough
                weight to stop somebody believing a form that otherwise behaves exactly like a
                working one. Portal's own modal carries the same line. */}
            <p style={{ margin: "-8px 0 0", fontSize: "11px", lineHeight: 1.45, fontWeight: 600, color: "var(--warning-500)" }}>
              {t.passwordNotWired}
            </p>

            {step === "current" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.currentPassword}</label>
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "current"), borderRadius: RADIUS.control }}>
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      onFocus={() => setFocusedField("current")}
                      onBlur={() => setFocusedField(null)}
                      onKeyDown={e => { if (e.key === "Enter") handleVerifyCurrent(); }}
                      placeholder="••••••••"
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                    />
                    <button onClick={() => setShowCurrent(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      {showCurrent ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleVerifyCurrent}
                  disabled={!canVerifyCurrent}
                  style={{
                    height: "48px", width: "100%", border: "none", borderRadius: RADIUS.control,
                    backgroundColor: canVerifyCurrent ? "var(--primary-400)" : "var(--gray-100)",
                    color: canVerifyCurrent ? "white" : "var(--gray-400)",
                    fontSize: "14px", fontWeight: 800, letterSpacing: "-0.28px",
                    cursor: canVerifyCurrent ? "pointer" : "default",
                    transition: "background-color 0.15s, color 0.15s",
                  }}
                >
                  {t.verify}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.newPassword}</label>
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "new"), borderRadius: RADIUS.control }}>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      onFocus={() => setFocusedField("new")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                    />
                    <button onClick={() => setShowNew(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      {showNew ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.confirmPassword}</label>
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "confirm"), borderRadius: RADIUS.control }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField("confirm")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                    />
                    <button onClick={() => setShowConfirm(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                {/* Doubles as the format error, so a disabled button always has its reason on screen. */}
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 600, color: formatBroken ? "var(--danger-400)" : "var(--gray-600)", letterSpacing: "-0.22px" }}>
                  {formatBroken && <ErrorCircleIcon />}
                  {PASSWORD_RULE_TEXT[lang]}
                </p>

                {mismatch && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <ErrorCircleIcon />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
                      {t.mismatch}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    height: "48px", width: "100%", border: "none", borderRadius: RADIUS.control,
                    backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-100)",
                    color: canSubmit ? "white" : "var(--gray-400)",
                    fontSize: "14px", fontWeight: 800, letterSpacing: "-0.28px",
                    cursor: canSubmit ? "pointer" : "default",
                    transition: "background-color 0.15s, color 0.15s",
                  }}
                >
                  {t.updatePassword}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Same in-page-modal treatment as PasswordChangeModal above — editing shouldn't require the
// sliders/inputs to be permanently sprawled out in the card; the summary row + "Change" button
// (matching Password Change's own row) opens this instead. Owns its own draft state so closing
// without saving (X, outside click, Escape) discards any in-progress edits.
function ThresholdModal({ initialAlert, initialModerate, onSave, onClose }: { initialAlert: number; initialModerate: number; onSave: (alert: number, moderate: number) => void; onClose: () => void }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const [draftAlert, setDraftAlert] = useState(initialAlert);
  const [draftModerate, setDraftModerate] = useState(initialModerate);
  const [saved, setSaved] = useState(false);
  useEscapeKey(onClose);

  const dirty = draftAlert !== initialAlert || draftModerate !== initialModerate;
  const handleSave = () => {
    onSave(draftAlert, draftModerate);
    setSaved(true);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "var(--scrim)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: "440px", maxWidth: "calc(100vw - 48px)", backgroundColor: "white",
        borderRadius: RADIUS.card, padding: "28px", boxShadow: "var(--shadow-modal)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.34px" }}>{t.thresholdsTitle}</h2>
          <button onClick={onClose} aria-label={t.close} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1.5 }}>
          {t.thresholdsBody}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ThresholdField label={t.alertRed} value={draftAlert} min={draftModerate + 1} max={300} onChange={setDraftAlert} />
          <ThresholdField label={t.moderateNavy} value={draftModerate} min={1} max={draftAlert - 1} onChange={setDraftModerate} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handleSave}
              disabled={!dirty}
              style={{
                height: "40px", padding: "0 20px", border: "none", borderRadius: RADIUS.control,
                backgroundColor: dirty ? "var(--primary-400)" : "var(--gray-100)",
                color: dirty ? "white" : "var(--gray-400)",
                fontSize: "13px", fontWeight: 700, letterSpacing: "-0.26px",
                cursor: dirty ? "pointer" : "default",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {t.saveChanges}
            </button>
            {saved && <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-400)" }}>{t.saved}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  // This page draws the app's own header, four tabs included, so it is behind the app's door like
  // the app is. It had no guard: an account with no app access saw the header, pressed a tab and
  // was bounced back from "/" — the door was one screen further in than it looked.
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));
  const locked = !!me && !canUseAppNow(me);
  const canGoToPortal = !!me && canEnterPortal(me.permission);
  useEffect(() => {
    if (!locked) return;
    router.replace(canGoToPortal ? "/portal" : "/login");
  }, [locked, canGoToPortal, router]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [sessionsTerminated, setSessionsTerminated] = useState(false);
  const otherSessions = LOGIN_SESSIONS.filter(sn => !sn.current);
  // The real setting, not a local one. This dropdown held its own useState and 한국어 was listed
  // as "coming soon" — meanwhile Portal had a working switcher pinned to its top bar. The switcher
  // was a build-time convenience in a place meant for per-screen controls; language is an account
  // preference, so it belongs here, and here it now writes the store the whole interface reads.
  const [lang, setLang] = useLanguage();
  const t = T[lang];
  // Derived outside the selector: screensFor() builds a new array on every call, and a zustand
  // selector that returns a fresh array re-renders forever.
  const portalUsers = useVcaStore(s => s.portalUsers);
  /*
   * WHICH CAMERAS THIS ACCOUNT SEES, said on the one screen that answers "what can I do here".
   *
   * The app has always ENFORCED the camera scope — `useProjectCameras` runs every list through
   * `camerasVisibleTo`, which resolves the account's groups through their current membership and
   * unions them with any individual cameras — and it has never SAID so anywhere. An operator
   * holding 12 of a site's cameras saw 「12대」 in the system tab with no way to tell whether the
   * site has twelve or whether they have twelve of it (owner, 2026-10-01).
   *
   * The count is the one the app actually draws, not a recount: same hook the lists use, so this
   * line cannot disagree with the screens it describes. The site's own total is deliberately NOT
   * here — what the operator needs is that their view is not all of it, and the installation's
   * size is not theirs to be told.
   */
  const cameraGroups = useVcaStore(s => s.cameraGroups);
  const visibleCameras = useProjectCameras();
  const cameraScope = me ? scopedCameraIds(me, cameraGroups) : null;
  /*
   * ONLY THE GROUPS THAT ACTUALLY HAND OVER A CAMERA HERE.
   *
   * This printed every group label the account holds, and a group is a thing on ONE project: an
   * account left holding 「오차드·부기스 라인」 after that project went elsewhere got a red
   * 「지정된 카메라가 없습니다」 with the group's name directly underneath it — one line stating a
   * limit and the next naming something that contradicts it. Same failure as the camera-count
   * banner fixed in 068cd4f.
   *
   * Intersected against the cameras the app is actually drawing, not against the group's project
   * id: a group can also be empty, or hold only cameras that have since been deleted, and all
   * three of those are the same fact to the reader — this group is not why you can see anything.
   * With none of them left the line is not drawn at all, because the empty version of it would be
   * a sentence about nothing.
   */
  const visibleCameraIds = new Set(visibleCameras.map(c => c.id));
  const scopeGroupNames = (me?.cameraGroupIds ?? [])
    .map(id => cameraGroups.find(g => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g && g.cameraIds.some(cid => visibleCameraIds.has(cid)))
    .map(g => g.label);
  // Only one session is ever listed here (this mock has no other-device data to actually
  // terminate) — the confirmation is honest about that rather than pretending to have revoked
  // something. Auto-clears the same way BestFramePage's highlightCamId does.
  useEffect(() => {
    if (!sessionsTerminated) return;
    const timer = setTimeout(() => setSessionsTerminated(false), 3000);
    return () => clearTimeout(timer);
  }, [sessionsTerminated]);
  // Default on the server-rendered pass so hydration never mismatches; a client-only effect
  // then applies whatever this browser last saved (same pattern as sidebarPosition elsewhere).
  const [alertThreshold, setAlertThresholdState] = useState(DEFAULT_DISTRICT_ALERT_THRESHOLD);
  const [moderateThreshold, setModerateThresholdState] = useState(DEFAULT_DISTRICT_MODERATE_THRESHOLD);
  useEffect(() => {
    queueMicrotask(() => {
      const savedAlert = Number(localStorage.getItem(DISTRICT_ALERT_THRESHOLD_KEY));
      const savedModerate = Number(localStorage.getItem(DISTRICT_MODERATE_THRESHOLD_KEY));
      if (Number.isFinite(savedAlert) && savedAlert > 0) setAlertThresholdState(savedAlert);
      if (Number.isFinite(savedModerate) && savedModerate > 0) setModerateThresholdState(savedModerate);
    });
  }, []);
  const handleSaveThresholds = (alert: number, moderate: number) => {
    setAlertThresholdState(alert);
    setModerateThresholdState(moderate);
    localStorage.setItem(DISTRICT_ALERT_THRESHOLD_KEY, String(alert));
    localStorage.setItem(DISTRICT_MODERATE_THRESHOLD_KEY, String(moderate));
  };

  // Draw nothing while the redirect above is on its way — see ClientLayout for the same rule.
  if (locked) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar activeTab={null} onTabChange={(tab) => router.push(`/?tab=${encodeURIComponent(tab)}`)} />
      <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--gray-50)", display: "flex", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "1440px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Page heading — on the page, not in a card. A card is a container for content you
              can act on; the crumb and the title are neither, and a white box around them reads
              as the first of the panels below rather than the label on all of them. */}
          <div style={{ padding: "0 4px 8px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.settings}</span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{">"}</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", letterSpacing: "-0.24px" }}>{t.myPage}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-900)" }}>{t.myPage}</h1>
          </div>

          {/*
            TWO COLUMNS, NOT THREE (owner, 2026-10-06).

            This was three `flex: 1` siblings — not a grid, so there is no track count to change.
            Three equal thirds meant the two short cards each left most of a 453px column empty:
            beside a 768px Profile card, Security ended at 321px and System preferences at 287px,
            so roughly 930px of column height below them was blank page.

            Stacked in one column they come to 624px against a Profile that is now 652px — 28px of
            dead space instead of 930. The ratio is 13:7 rather than halves because the chip grid
            is what sets Profile's height: at a 688px half it wraps the grants onto 4 rows, at
            894px onto 3, and 3 is as few as they go in either language. Past that the left column
            only takes room away from the right for nothing, so this stops there — 482px for the
            right column, near the 453px the two cards were drawn at.

            minWidth on each is both the floor and the breakpoint: flex line-breaking measures an
            item by its basis clamped to min-width, so 420 + 320 + 16 = 756 is the row width below
            which the two wrap and stack full-width — a window of about 804px. A media query would
            be the other way to say it, and this file has no stylesheet of its own to put one in.

            The min(..., 100%) is not decoration. A flat 420px floor survives the wrap and then
            outgrows the page: at 375px the Profile card measured 420px against a 327px column and
            its right edge was cut off. Against the column itself the floor simply lifts.
          */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
            {/* Profile Information */}
            {/*
              EQUAL COLUMNS NOW, where it was 13:7.

              That ratio was measured against a left card that held the permission chips: the
              wider it ran, the fewer rows the chips wrapped to, and 65% was where they stopped
              falling. The chips have their own card now, so the number it was tuned for is gone.
              Two columns of one subject each — what is true of this account, and what the person
              can change — and they end within 50px of each other without anything being tuned.
            */}
            <div style={{ flex: "1 1 0", minWidth: "min(360px, 100%)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card>
                <CardHeader icon={<UserCheckIcon />} title={t.profile} />
                {/* Left, like everything under it. Centring was invisible in a 453px column and
                    became the card's loudest feature at 688: a centred name over two left-aligned
                    lines reads as two cards that happen to share a border. One edge. */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>{SIGNED_IN_USER.name}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{SIGNED_IN_USER.role}</span>
                  </div>
                  {/* The smallest step, and deliberately NOT the pill: a pill is this console's shape for a
                      state (see the session badge below and shared/ScoreBadge), and the account number
                      is a value. Same shape would make an ID read as a status. */}
                  <div style={{ backgroundColor: "var(--gray-50)", borderRadius: RADIUS.inner, padding: "4px 8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--gray-600)", letterSpacing: "-0.2px" }}>{SIGNED_IN_USER.accountId}</span>
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", width: "100%" }} />
                {/* 이름 줄은 없다. 바로 위 블록이 이미 「Grace Tan」이라고 크게 적고 있고, 그
                    아래 「전체 이름 · Grace Tan」은 같은 글자를 두 번 쓰는 것이다. 남는 둘은
                    위에서 말하지 않는 사실이라 남는다. */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                  <ReadOnlyField label={t.emailAddress} value={SIGNED_IN_USER.email} />
                  <ReadOnlyField label={t.departmentTeam} value={SIGNED_IN_USER.team} />
                </div>
                {/*
                  What this account may open, where the person holding it can read it.
                  
                  The same table exists on the access gate, which only the refused ever see —
                  everybody who signs in successfully had no way to find out what they hold. The
                  cost of that is a phone call to an administrator for every "why can't I see
                  Re-ID", and the administrator has to go and look it up.
                  
                  Read-only, and it says who changes it. This screen is the account's own; the
                  grants are not.
                */}
              </Card>

              {/*
                A CARD OF ITS OWN, because it is not profile and it is not security.

                It sat at the bottom of 프로필 정보, under the name and the address, which put the
                two biggest facts on this page — which screens, which cameras — inside the card
                about who somebody is. Meanwhile a separate card called 「보안 및 접근 권한」 held
                a password. One subject was split across two cards and neither was named after it.
                The page reads in two columns now: what is true of this account on the left, what
                the person can change on the right.
              */}
              <Card>
                <CardHeader icon={<ShieldIcon />} title={t.myGrants} />
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  {/* No heading inside. The card's own title says it, and saying it twice 20px
                      apart is the thing this repo keeps deleting. */}
                  {/*
                    GROUPED BY SCREEN, NOT SEVENTEEN CHIPS IN A ROW (owner, 2026-10-06: 각 화면의
                    기능들이 나열되어있는게 뭔가 한눈에 안들어오는데,, 표로 그려줘야하나..).

                    NOT A TABLE. A table earns its columns when the same column means the same
                    thing on every row; here there would be two — the screen, and what is on in it
                    — which is a definition list wearing borders. What was missing was the
                    grouping, not the grid.

                    The flat list repeated the place in every chip: 「Best Frame」 six times,
                    「Data > Live Monitoring」 three, 「Dashboard」 three. Saying the screen once and
                    the grants beside it is the same information in a third of the words, and it
                    is the shape the administrator already ticks — GRANT_TREE is the tree the
                    permission panel draws, so the two sides of this grant now share a structure as
                    well as a vocabulary.

                    AND THE OFF ONES LEFT THE LIST. A card headed 「이 계정이 열 수 있는 것」 was
                    printing a greyed 「— Best Frame · enrolled photo」 in the same stream as the
                    things it can open. They go last, in one muted line, because knowing what you
                    do NOT have is what you take to an administrator — but it is not an answer to
                    this card's question and it should not be read as one.
                  */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {GRANT_TREE.map(group => {
                      const actionsOf = (row: typeof group.rows[number]) =>
                        [row.action, ...(row.search ? [row.search] : []), ...(row.children ?? [])];
                      const on = group.rows.flatMap(actionsOf).filter(a => holdsAppAction(portalUsers, a));
                      if (on.length === 0) return null;
                      return (
                        <div key={group.caption} style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                          <span style={{ flexShrink: 0, width: "84px", fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>
                            {APP_GRANT_LABELS[lang].groupName[group.caption]}
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minWidth: 0 }}>
                            {on.map(a => (
                              <GrantChip key={a} on
                                label={APP_GRANT_LABELS[lang].rowName[a] ?? APP_GRANT_LABELS[lang].actionName[a]} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const off = APP_ACTIONS.filter(a => !holdsAppAction(portalUsers, a));
                    if (off.length === 0) return null;
                    return (
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1.6 }}>
                        {t.myGrantsOff(off.map(a => APP_GRANT_LABELS[lang].actionName[a]).join(" · "))}
                      </span>
                    );
                  })()}
                  {/* Under the screen chips, because it answers the same question about a
                      different axis: those say WHICH SCREENS, this says WHICH CAMERAS. Both are
                      the administrator's to set, so the one sentence about who changes them
                      covers both and stays last. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-500)" }}>{t.myCameras}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: cameraScope !== null && visibleCameras.length === 0 ? "var(--danger-500)" : "var(--gray-900)" }}>
                      {cameraScope === null ? t.myCamerasAll
                        : visibleCameras.length === 0 ? t.myCamerasNone
                        : t.myCamerasSome(visibleCameras.length)}
                    </span>
                    {/* The groups behind the number, when groups are what gave it. An operator
                        told 「12대」 cannot ask an administrator to change anything; told
                        「시청 주변 그룹으로」 they can name the thing that would have to change. */}
                    {cameraScope !== null && scopeGroupNames.length > 0 && (
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>{t.myCamerasGroups(scopeGroupNames.join(" · "))}</span>
                    )}
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1.5 }}>{t.myGrantsWho}</span>
                </div>
              </Card>
            </div>

            {/* The half the person can act on: the sign-in they hold and the preferences they set. */}
            <div style={{ flex: "1 1 0", minWidth: "min(360px, 100%)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card>
                <CardHeader icon={<LockIcon />} title={t.security} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.24px" }}>{t.passwordSettings}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: RADIUS.control, padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.28px" }}>{t.passwordChange}</span>
                      {/* No second line. It was `changedDaysAgo(PASSWORD_AGE_DAYS)` with the
                          constant fixed at 45, so the console told every operator the same
                          invented fact about their own password; the fix after that drew "방금
                          변경했습니다" once the modal had been through — and the modal saves no
                          password, so nothing had been changed just now either. The console does
                          not know when this password was last changed. See changedDaysAgo's
                          HANDOFF NOTE for what the server has to send. */}
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      style={{ backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: RADIUS.control, padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.24px" }}
                    >
                      {t.change}
                    </button>
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <CardHeader icon={<MonitorIcon />} title={t.sessions} />
                    {/* The control only appears when there is something for it to end. A standing
                        "Terminate All Others" over a list of one asks the operator whether something
                        else is signed in and then answers nothing — and revoking a session needs the
                        backend to hold sessions as state at all, which is not yet confirmed. When
                        the list is one, the line beside the heading says so outright. */}
                    {otherSessions.length > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {sessionsTerminated && (
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--success-400)" }}>
                            {t.sessionsEnded(otherSessions.length)}
                          </span>
                        )}
                        <button
                          onClick={() => setSessionsTerminated(true)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px", color: "var(--danger-400)", textDecoration: "underline", fontWeight: 600 }}
                        >
                          {t.signOutOthers}
                        </button>
                      </div>
                    ) : (
                      /* Not "only this device". The absence of other sessions is not something
                         the front end can see — there is no session store to ask — so claiming it
                         is the same shape as a coordinate nobody measured. It says what it can:
                         this is the one it knows about. */
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)" }}>{t.onlyDeviceKnown}</span>
                    )}
                  </div>
                  {LOGIN_SESSIONS.map(session => (
                    <div key={session.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: RADIUS.control, padding: "12px 14px", width: "100%" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.26px" }}>{session.device || t.thisBrowser}</span>
                          {/* Drawn only when there is one. An empty second line is better than a
                              place that was never measured. */}
                          {session.where && (
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.2px" }}>{session.where}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: session.current ? "var(--success-400)" : "var(--gray-500)", backgroundColor: session.current ? "var(--success-100)" : "var(--gray-100)", borderRadius: RADIUS.pill, padding: "3px 8px" }}>
                        {session.current ? t.activeNow : session.lastActive}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* System Preferences */}
              <Card>
                <CardHeader icon={<SlidersIcon />} title={t.systemPreferences} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.24px" }}>{t.interfaceLanguage}</span>
                    {/* Each language is named in its own script — that is how every language picker
                        lists one, and it is the one label a person who cannot read the current
                        interface still recognises. */}
                    <DropdownBtn value={lang} options={LANGUAGE_OPTIONS} onSelect={setLang} />
                  </div>
                  {/* The two halves keep separate choices, so each says which one it is setting —
                      a bare "Interface language" in two places reads as one setting that does not
                      stick. Mirrors Portal's own note. */}
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1.45 }}>
                    {t.interfaceLanguageNote}
                  </p>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <CardHeader icon={<AlertBellIcon />} title={t.thresholdsTitle} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: RADIUS.control, padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.28px" }}>{t.thresholdLevels}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.2px" }}>{t.thresholdSummary(alertThreshold, moderateThreshold)}</span>
                    </div>
                    <button
                      onClick={() => setShowThresholdModal(true)}
                      style={{ backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: RADIUS.control, padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.24px" }}
                    >
                      {t.change}
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      {showPasswordModal && (
        <PasswordChangeModal onClose={() => setShowPasswordModal(false)} />
      )}
      {showThresholdModal && (
        <ThresholdModal
          initialAlert={alertThreshold}
          initialModerate={moderateThreshold}
          onSave={handleSaveThresholds}
          onClose={() => setShowThresholdModal(false)}
        />
      )}
    </div>
  );
}
