"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  DISTRICT_ALERT_THRESHOLD_KEY, DISTRICT_MODERATE_THRESHOLD_KEY,
  DEFAULT_DISTRICT_ALERT_THRESHOLD, DEFAULT_DISTRICT_MODERATE_THRESHOLD,
} from "@/lib/mockData";
import { canEnterPortal, canUseAppNow, currentPortalUser, SIGNED_IN_USER, useVcaStore } from "@/lib/vcaStore";
import { EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. SIGNED_IN_USER's role and team are not in here on
// purpose — those are the customer's own words for their org chart, and translating them would put
// a job title on screen that appears nowhere in their records.
const T = {
  en: {
    comingSoon: "Coming soon",
    close: "Close",
    passwordChanged: "Password changed",
    passwordChangedBody: "Your password has been updated.",
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
    pageDesc: "Centrally manage your admin profile, security settings, and monitoring preferences.",
    profile: "Profile information",
    fullName: "Full name",
    emailAddress: "Email address",
    departmentTeam: "Department / team",
    security: "Security & access control",
    passwordSettings: "Password settings",
    passwordChange: "Password change",
    changedJustNow: "Last changed just now",
    changedDaysAgo: (n: number) => `Last changed ${n} days ago`,
    change: "Change",
    sessions: "Active login sessions",
    sessionsEnded: (n: number) => `${n} session${n === 1 ? "" : "s"} ended`,
    signOutOthers: "Sign out other sessions",
    onlyThisDevice: "Only this device",
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
    passwordChanged: "비밀번호가 변경되었습니다",
    passwordChangedBody: "새 비밀번호로 바뀌었습니다.",
    done: "확인",
    changePassword: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    verify: "확인",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
    updatePassword: "비밀번호 변경",
    thresholdsTitle: "지도 경보 기준",
    thresholdsBody: "지도의 구역 배지가 빨강(경보) 또는 남색(주의)으로 바뀌는 데 필요한 당일 VIP 검출 수입니다.",
    alertRed: "경보 (빨강)",
    moderateNavy: "주의 (남색)",
    saveChanges: "변경 사항 저장",
    saved: "저장됨",
    settings: "설정",
    myPage: "마이 페이지",
    pageDesc: "관리자 프로필, 보안 설정, 관제 환경설정을 한곳에서 관리합니다.",
    profile: "프로필 정보",
    fullName: "이름",
    emailAddress: "이메일 주소",
    departmentTeam: "부서 / 팀",
    security: "보안 및 접근 권한",
    passwordSettings: "비밀번호 설정",
    passwordChange: "비밀번호 변경",
    changedJustNow: "방금 변경했습니다",
    changedDaysAgo: (n: number) => `${n}일 전에 변경했습니다`,
    change: "변경",
    sessions: "접속 중인 기기",
    sessionsEnded: (n: number) => `${n}개 세션을 종료했습니다`,
    signOutOthers: "다른 기기 로그아웃",
    onlyThisDevice: "이 기기뿐입니다",
    activeNow: "지금 접속 중",
    systemPreferences: "시스템 환경설정",
    interfaceLanguage: "앱 화면 언어",
    interfaceLanguageNote: "모니터링 앱에만 적용됩니다. 포털은 별도이고, 포털의 설정에서 정합니다.",
    thresholdLevels: "경보 단계",
    thresholdSummary: (alert: number, moderate: number) => `경보 ${alert} · 주의 ${moderate}`,
  },
} as const;

/** Listed in its own script, the way every language picker lists a language. */
const LANGUAGE_OPTIONS = [
  { value: "en" as const, label: "English" },
  { value: "ko" as const, label: "한국어" },
];

/** How long ago the mock says the password was last set. Seeded, like LOGIN_SESSIONS. */
const PASSWORD_AGE_DAYS = 45;

const CARD_BORDER = "1px solid var(--gray-200)";

// This browser only. A real list — other devices, their last activity — comes from the backend's
// session store, which is also what makes ending one possible: with stateless tokens alone there
// is nothing to revoke before expiry, and a control offering it would be lying. Shaped as a list
// so the UI is already right when that arrives.
const LOGIN_SESSIONS: { id: string; device: string; where: string; current: boolean; lastActive?: string }[] = [
  { id: "current", device: "MacBook Pro (Chrome)", where: "Singapore · 1.3521, 103.8198", current: true },
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
function LockIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
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
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: "8px", padding: "10px 12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.26px" }}>{value}</span>
        <LockIconSm />
      </div>
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
        style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.24px" }}>
          {options.find(o => o.value === value)?.label ?? value}
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20, backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(14, 22, 42,0.08)", minWidth: "150px", overflow: "hidden" }}>
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
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          style={{ width: "72px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "6px 8px", outline: "none" }}
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
  return active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)";
}

// Changing a password from Settings shouldn't feel like leaving the app — this stays as an
// in-page modal (same field/validation logic as the auth flow's /password-setup, which is a
// different case: first-time setup, not an already-logged-in user changing theirs) instead of
// navigating to a full standalone route.
function PasswordChangeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
    setStep("done");
    onSuccess();
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "rgba(14,22,42,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: "440px", maxWidth: "calc(100vw - 48px)", backgroundColor: "white",
        borderRadius: "16px", padding: "28px", boxShadow: "0 12px 40px rgba(14,22,42,0.2)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>
        {step === "done" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "12px 0" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "var(--success-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5L9.5 17L19 6" stroke="var(--success-400)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--gray-900)" }}>{t.passwordChanged}</p>
              <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)" }}>{t.passwordChangedBody}</p>
            </div>
            <button
              onClick={onClose}
              style={{ height: "40px", padding: "0 24px", border: "none", borderRadius: "8px", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
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

            {step === "current" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.currentPassword}</label>
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "current"), borderRadius: "8px" }}>
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      onFocus={() => setFocusedField("current")}
                      onBlur={() => setFocusedField(null)}
                      onKeyDown={e => { if (e.key === "Enter") handleVerifyCurrent(); }}
                      placeholder="••••••••"
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
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
                    height: "48px", width: "100%", border: "none", borderRadius: "8px",
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
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "new"), borderRadius: "8px" }}>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      onFocus={() => setFocusedField("new")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
                    />
                    <button onClick={() => setShowNew(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                      {showNew ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.26px" }}>{t.confirmPassword}</label>
                  <div style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 18px", border: fieldBorder(focusedField === "confirm"), borderRadius: "8px" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField("confirm")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
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
                    height: "48px", width: "100%", border: "none", borderRadius: "8px",
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
        position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "rgba(14,22,42,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: "440px", maxWidth: "calc(100vw - 48px)", backgroundColor: "white",
        borderRadius: "16px", padding: "28px", boxShadow: "0 12px 40px rgba(14,22,42,0.2)",
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
                height: "40px", padding: "0 20px", border: "none", borderRadius: "8px",
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
  const [passwordJustChanged, setPasswordJustChanged] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [sessionsTerminated, setSessionsTerminated] = useState(false);
  const otherSessions = LOGIN_SESSIONS.filter(sn => !sn.current);
  // The real setting, not a local one. This dropdown held its own useState and 한국어 was listed
  // as "coming soon" — meanwhile Portal had a working switcher pinned to its top bar. The switcher
  // was a build-time convenience in a place meant for per-screen controls; language is an account
  // preference, so it belongs here, and here it now writes the store the whole interface reads.
  const [lang, setLang] = useLanguage();
  const t = T[lang];
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
          {/* Header card */}
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.settings}</span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>{">"}</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", letterSpacing: "-0.24px" }}>{t.myPage}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-900)" }}>{t.myPage}</h1>
            <p style={{ margin: "8px 0 0", fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.26px" }}>
              {t.pageDesc}
            </p>
          </div>

          {/* 3-column grid */}
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {/* Profile Information */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<UserCheckIcon />} title={t.profile} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>{SIGNED_IN_USER.name}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{SIGNED_IN_USER.role}</span>
                  </div>
                  <div style={{ backgroundColor: "var(--gray-50)", borderRadius: "4px", padding: "4px 8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--gray-600)", letterSpacing: "-0.2px" }}>{SIGNED_IN_USER.accountId}</span>
                  </div>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <ReadOnlyField label={t.fullName} value={SIGNED_IN_USER.name} />
                  <ReadOnlyField label={t.emailAddress} value={SIGNED_IN_USER.email} />
                  <ReadOnlyField label={t.departmentTeam} value={SIGNED_IN_USER.team} />
                </div>
              </Card>
            </div>

            {/* Security & Access Control */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<ShieldIcon />} title={t.security} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "0.006px" }}>{t.passwordSettings}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.28px" }}>{t.passwordChange}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.2px" }}>
                        {passwordJustChanged ? t.changedJustNow : t.changedDaysAgo(PASSWORD_AGE_DAYS)}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      style={{ backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.24px" }}
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
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)" }}>{t.onlyThisDevice}</span>
                    )}
                  </div>
                  {LOGIN_SESSIONS.map(session => (
                    <div key={session.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: "10px", padding: "12px 14px", width: "100%" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.26px" }}>{session.device}</span>
                          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.2px" }}>{session.where}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: session.current ? "var(--success-400)" : "var(--gray-500)", backgroundColor: session.current ? "var(--success-100)" : "var(--gray-100)", borderRadius: "4px", padding: "3px 8px" }}>
                        {session.current ? t.activeNow : session.lastActive}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* System Preferences */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
                <CardHeader icon={<SlidersIcon />} title={t.systemPreferences} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "0.006px" }}>{t.interfaceLanguage}</span>
                    {/* Each language is named in its own script — that is how every language picker
                        lists one, and it is the one label a person who cannot read the current
                        interface still recognises. */}
                    <DropdownBtn value={lang} options={LANGUAGE_OPTIONS} onSelect={setLang} />
                  </div>
                  {/* The two halves keep separate choices, so each says which one it is setting —
                      a bare "Interface language" in two places reads as one setting that does not
                      stick. Mirrors Portal's own note. */}
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1.6 }}>
                    {t.interfaceLanguageNote}
                  </p>
                </div>
                <div style={{ height: "1px", backgroundColor: "var(--gray-200)", width: "100%" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <CardHeader icon={<AlertBellIcon />} title={t.thresholdsTitle} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--gray-50)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.28px" }}>{t.thresholdLevels}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.2px" }}>{t.thresholdSummary(alertThreshold, moderateThreshold)}</span>
                    </div>
                    <button
                      onClick={() => setShowThresholdModal(true)}
                      style={{ backgroundColor: "white", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)", letterSpacing: "-0.24px" }}
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
        <PasswordChangeModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => setPasswordJustChanged(true)}
        />
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
