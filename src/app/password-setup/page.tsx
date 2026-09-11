"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { canEnterPortal, useVcaStore } from "@/lib/vcaStore";
import { INVITE_TOKEN_TTL_DAYS, isPasswordFormatValid, PASSWORD_RULE_TEXT, TEMP_PASSWORD_VALIDITY_HOURS } from "@/lib/password";
import { isCodeExpired } from "@/lib/staffRoster";
import { getAuthConfig } from "@/lib/authConfig";
import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    deadTitle: "This link no longer works",
    deadBody: (days: number) => `Invitation links expire after ${days} days or once used. Ask for a new one.`,
    whoToContact: "WHO TO CONTACT",
    securityTeam: "Your security operations team",
    backToLogin: "Back to log in",
    paperCodeInstead: "Given a code on paper instead?",
    activateAccount: "Activate your account",
    titleTemp: "Choose your own password",
    titleInvite: "Set your password",
    bodyTemp: "Your temporary password can’t be kept — replace it to continue.",
    bodyInvite: "Choose a password for your account.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords don’t match",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submit: "Set Password",
  },
  ko: {
    deadTitle: "더 이상 사용할 수 없는 링크입니다",
    deadBody: (days: number) => `초대 링크는 ${days}일이 지나거나 한 번 사용하면 만료됩니다. 새 링크를 요청해주세요.`,
    whoToContact: "문의할 곳",
    securityTeam: "보안 관제 담당자",
    backToLogin: "로그인으로 돌아가기",
    paperCodeInstead: "종이로 코드를 받으셨나요?",
    activateAccount: "계정 활성화하기",
    titleTemp: "직접 쓸 비밀번호를 정해주세요",
    titleInvite: "비밀번호를 설정해주세요",
    bodyTemp: "임시 비밀번호는 계속 쓸 수 없습니다. 새 비밀번호로 바꿔주세요.",
    bodyInvite: "계정에 사용할 비밀번호를 정해주세요.",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    submit: "비밀번호 설정",
  },
} as const;

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)";
}

export default function PasswordSetupPage() {
  return (
    <Suspense fallback={null}>
      <PasswordSetupForm />
    </Suspense>
  );
}

/**
 * Whether an administrator-issued temporary password has run out.
 *
 * Hours, not days, so `isCodeExpired` (a day-granularity check for invitations and paper codes)
 * cannot answer it. `TEMP_PASSWORD_VALIDITY_HOURS` is the number Portal shows the administrator to
 * read down the phone, so this screen has to mean the same thing by it — a link that outlives the
 * spoken expiry makes the screen and the phone call disagree.
 *
 * `now` is passed in rather than read here: a null clock (the server-rendered pass, before the
 * client has a time) treats the password as still valid for that one frame, which the submit
 * handler's own linkDead check then catches.
 */
function isTempPasswordExpired(issuedAt: string | undefined, now: number | null): boolean {
  if (!issuedAt || now === null) return false;
  return now - new Date(issuedAt).getTime() > TEMP_PASSWORD_VALIDITY_HOURS * 60 * 60 * 1000;
}

function PasswordSetupForm() {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  // The invite link carries an opaque token minted when the invitation was sent
  // (PortalUser.inviteToken), not the account id it used to carry — a user id is short, guessable
  // and printed all over Portal, so anyone who saw one could set that person's password.
  //
  // HANDOFF NOTE: the token is still generated in the browser and stored in the clear. The real one
  // is minted server-side, stored as a hash beside its expiry, and burned on use.
  const params = useSearchParams();
  const token = params.get("token");
  // Why this screen is being shown. "temp" means the person just logged in with a password an
  // administrator generated and read out to them, so the copy has to say that rather than greet
  // them as a new invitee — they are not setting up an account, they are taking a shared password
  // back into their own hands.
  const forcedByTempPassword = params.get("reason") === "temp";
  // Read after mount, not during render: the temp-password expiry below is a time-dependent
  // decision, and a clock read in render differs between the server pass and the client.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // Deferred to the next tick rather than read in the effect body: the first committed render
    // must not depend on the clock, and setting state synchronously in an effect cascades a
    // render. The one frame before this lands treats the link as live, which handleSubmit's own
    // linkDead check then catches.
    const timer = setTimeout(() => setNowMs(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);
  const updatePortalUserStatus = useVcaStore(s => s.updatePortalUserStatus);
  const clearTemporaryPassword = useVcaStore(s => s.clearTemporaryPassword);
  const clearSetupCode = useVcaStore(s => s.clearSetupCode);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const authConfig = getAuthConfig();

  // Two ways to arrive, and they resolve differently. An invitation is looked up by its token; a
  // forced change after logging in with a temporary password is a redirect this app made itself
  // (login/page.tsx), so it passes the account id and there is no token to expire.
  const target = !token
    ? undefined
    : forcedByTempPassword
      ? portalUsers.find(u => u.id === token)
      : portalUsers.find(u => u.inviteToken === token);
  // An invitation nobody accepted is an open door with nobody watching it. Past the window the link
  // stops working rather than staying valid forever.
  //
  // The temp-password branch takes an account id, which is short, guessable and printed all over
  // Portal — the same reason the invite branch stopped taking one. Resolving an id is therefore
  // not permission to set that person's password: this branch only holds for an account that is
  // ACTUALLY on an administrator-issued temporary password, and only while that password is still
  // within the 24 hours Portal tells the administrator to say out loud. Without these two checks
  // /password-setup?token=user-5&reason=temp set a stranger's password from a logged-out browser.
  const tempPasswordUnusable = forcedByTempPassword && (
    !target?.mustChangePassword
    || isTempPasswordExpired(target.tempPasswordIssuedAt, nowMs)
  );
  const linkDead = !target
    || tempPasswordUnusable
    || (!forcedByTempPassword && isCodeExpired(target.inviteTokenIssuedAt, INVITE_TOKEN_TTL_DAYS));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<"new" | "confirm" | null>(null);

  const formatValid = isPasswordFormatValid(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  // Enabled only when the form would actually succeed — handleSubmit used to bail out silently on a
  // mismatch or a bad format, so the lit button did nothing.
  const canSubmit = formatValid && confirmPassword.length > 0 && !mismatch;
  const formatBroken = newPassword.length > 0 && !formatValid;

  const handleSubmit = () => {
    if (!canSubmit || !target || linkDead) return;
    // Only an invitation ends in an active account. A forced change decides nothing about status:
    // the account is already whatever an administrator last made it, and a password screen is not
    // where a suspension gets lifted.
    if (!forcedByTempPassword) updatePortalUserStatus(target.id, "active");
    // Retires the temporary password: the must-change flag comes off, and Portal's Users table
    // stops flagging this account as one somebody else has the password to.
    clearTemporaryPassword(target.id);
    // Burns the link. Without this the same invitation mail keeps setting this person's password
    // for as long as anyone has it — including whoever the mail was forwarded to.
    clearSetupCode(target.id);
    // canEnterPortal, not permission === "admin": the console is for owner, admin and the
    // read-only auditor, and an auditor sent to the app has no app door to come in by.
    router.push(canEnterPortal(target.permission) ? "/portal" : "/");
  };

  /**
   * A link that no longer resolves — expired, already used, or mistyped. This used to bounce
   * silently to /login, which from the outside looks like a button that did nothing: the person is
   * left clicking the same mail again. It does not distinguish expired from unknown, since the way
   * out is identical and naming which one would confirm to a stranger that the account exists.
   */
  if (linkDead) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
        <AuthHeader />
        <div className="vca-auth-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
          <div style={{
            // No card. Every one of these screens is white on a white page, so a white panel with a
          // 28px radius drew nothing — the radius and the horizontal padding were doing invisible
          // work, and the padding was quietly narrowing the fields to 348px. A card separates
          // content from a DIFFERENT surface; there is no different surface here. Eight of the ten
          // reference logins sit the form straight on the background for the same reason (Stripe's
          // card works because it sits on a gradient, not on white).
          // 400 is the measure now, and it is the field width: in the reference range, and wider
          // than the padding was leaving.
          width: "400px", maxWidth: "400px",
            margin: "auto 0",
            display: "flex", flexDirection: "column", gap: "32px", alignItems: "center",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>
                {t.deadTitle}
              </h1>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.7 }}>
                {t.deadBody(INVITE_TOKEN_TTL_DAYS)}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)" }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.whoToContact}</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
                {authConfig.supportContact ?? t.securityTeam}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              <button
                onClick={() => router.push("/login")}
                style={{
                  height: "52px", width: "100%", border: "none", borderRadius: "8px",
                  backgroundColor: "var(--primary-400)", color: "white",
                  fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px", cursor: "pointer",
                }}
              >
                {t.backToLogin}
              </button>
              {authConfig.registrationCode && (
                <p style={{ margin: 0, textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                  {t.paperCodeInstead}{" "}
                  <button
                    onClick={() => router.push("/register")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                  >
                    {t.activateAccount}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div className="vca-auth-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          // No card. Every one of these screens is white on a white page, so a white panel with a
          // 28px radius drew nothing — the radius and the horizontal padding were doing invisible
          // work, and the padding was quietly narrowing the fields to 348px. A card separates
          // content from a DIFFERENT surface; there is no different surface here. Eight of the ten
          // reference logins sit the form straight on the background for the same reason (Stripe's
          // card works because it sits on a gradient, not on white).
          // 400 is the measure now, and it is the field width: in the reference range, and wider
          // than the padding was leaving.
          width: "400px", maxWidth: "400px",
          margin: "auto 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>
              {forcedByTempPassword ? t.titleTemp : t.titleInvite}
            </h1>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.32px", textAlign: "center", lineHeight: 1.6 }}>
              {forcedByTempPassword
                ? t.bodyTemp
                : t.bodyInvite}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
              {/* New password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.newPassword}</label>
                <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: fieldBorder(focusedField === "new"), borderRadius: "8px" }}>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onFocus={() => setFocusedField("new")}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                  />
                  <button type="button" onClick={() => setShowNew(s => !s)}
                    aria-label={showNew ? t.hidePassword : t.showPassword}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showNew ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
              {/* Confirm password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.confirmPassword}</label>
                <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: fieldBorder(focusedField === "confirm"), borderRadius: "8px" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                  />
                  <button type="button" onClick={() => setShowConfirm(s => !s)}
                    aria-label={showConfirm ? t.hidePassword : t.showPassword}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
            </div>

            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: formatBroken ? "var(--danger-400)" : "var(--gray-600)", letterSpacing: "-0.24px" }}>
              {formatBroken && <ErrorCircleIcon />}
              {PASSWORD_RULE_TEXT[lang]}
            </p>

            {mismatch && (
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <ErrorCircleIcon />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.26px" }}>
                  {t.mismatch}
                </span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                height: "52px", width: "100%", border: "none", borderRadius: "8px",
                backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-100)",
                color: canSubmit ? "white" : "var(--gray-400)",
                fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
                cursor: canSubmit ? "pointer" : "default",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {t.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
