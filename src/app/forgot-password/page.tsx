"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import VerificationCodeInput from "@/components/VerificationCodeInput";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT, RESET_CODE_LENGTH, RESET_CODE_TTL_MIN } from "@/lib/password";
import { getAuthConfig } from "@/lib/authConfig";
import { josa, useLanguage, type AppLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    errIdentifier: "Enter an employee number or email address.",
    errEmail: "Enter a valid email address.",
    adminTitle: "Contact your administrator",
    adminSub: "This system can’t send reset emails",
    whoToContact: "WHO TO CONTACT",
    adminRemedies: "They’ll give you a temporary password or a setup code.",
    backToLogin: "Back to log in",
    haveCode: "Already have a code?",
    activateAccount: "Activate your account",
    emailTitle: "Forgot your password?",
    emailSub: "We’ll send a verification code to your registered email",
    identifierWithId: "Employee number or email",
    identifierEmailOnly: "Email",
    noAddressNote: "No email address on your account? Only an administrator can reset it —",
    noAddressFallback: "contact your security operations team",
    sendCode: "Send code",
    rememberedIt: "Remembered it?",
    logIn: "Log in",
    throttledTitle: "Too many attempts",
    throttledSub: "Code entry is locked for now",
    throttledBody: "Try again in a few minutes, or contact your administrator.",
    codeTitle: "Enter your verification code",
    codeSentTo: (address: string) => `Code sent to ${address}`,
    codeSentToAccount: "Code sent to the email on this account",
    expiresIn: (min: number) => `Expires in ${min} minutes`,
    sendNewCode: "Send a new code",
    noCode: "Didn’t get the code?",
    resendIn: (sec: number) => `Resend in ${sec}s`,
    resend: "Resend",
    next: "Next",
    wrongOne: "Wrong one?",
    wrongAddress: "Wrong address?",
    startOver: "Start over",
    useDifferentEmail: "Use a different email",
    passwordTitle: "Set a new password",
    passwordSub: "Choose one you haven’t used before",
    newPassword: "New password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    confirmPassword: "Confirm password",
    mismatch: "Passwords don’t match",
    changePassword: "Change password",
    doneTitle: "Password changed",
    doneSub: "Log in with your new password",
  },
  ko: {
    errIdentifier: "사번 또는 이메일 주소를 입력해주세요.",
    errEmail: "올바른 이메일 주소를 입력해주세요.",
    adminTitle: "관리자에게 문의해주세요",
    adminSub: "이 시스템은 재설정 메일을 보낼 수 없습니다",
    whoToContact: "문의할 곳",
    adminRemedies: "임시 비밀번호나 설정 코드를 받게 됩니다.",
    backToLogin: "로그인으로 돌아가기",
    haveCode: "이미 코드를 받으셨나요?",
    activateAccount: "계정 활성화하기",
    emailTitle: "비밀번호를 잊으셨나요?",
    emailSub: "등록된 이메일로 인증 코드를 보내드립니다",
    identifierWithId: "사번 또는 이메일",
    identifierEmailOnly: "이메일",
    noAddressNote: "계정에 이메일 주소가 없나요? 관리자만 재설정할 수 있습니다 —",
    noAddressFallback: "보안 관제 담당자에게 문의해주세요",
    sendCode: "코드 보내기",
    rememberedIt: "기억나셨나요?",
    logIn: "로그인",
    throttledTitle: "시도 횟수를 초과했습니다",
    throttledSub: "코드 입력이 잠시 차단되었습니다",
    throttledBody: "몇 분 뒤에 다시 시도하시거나 관리자에게 문의해주세요.",
    codeTitle: "인증 코드를 입력해주세요",
    codeSentTo: (address: string) => `${address}${josa(address, "으로", "로")} 코드를 보냈습니다`,
    codeSentToAccount: "계정에 등록된 이메일로 코드를 보냈습니다",
    expiresIn: (min: number) => `${min}분 후 만료됩니다`,
    sendNewCode: "새 코드 보내기",
    noCode: "코드를 받지 못하셨나요?",
    resendIn: (sec: number) => `${sec}초 후 재발송`,
    resend: "재발송",
    next: "다음",
    wrongOne: "잘못 입력하셨나요?",
    wrongAddress: "주소가 잘못되었나요?",
    startOver: "처음부터 다시",
    useDifferentEmail: "다른 이메일 사용하기",
    passwordTitle: "새 비밀번호를 설정해주세요",
    passwordSub: "이전에 쓰지 않은 비밀번호로 정해주세요",
    newPassword: "새 비밀번호",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    confirmPassword: "비밀번호 확인",
    mismatch: "비밀번호가 일치하지 않습니다",
    changePassword: "비밀번호 변경",
    doneTitle: "비밀번호가 변경되었습니다",
    doneSub: "새 비밀번호로 로그인해주세요",
  },
} as const;

const FIELD_BORDER = "1px solid var(--gray-300)";
/** Seconds before "Resend" becomes available again — stops a stuck user from mailing themselves ten
 *  codes, each of which invalidates the last. */
const RESEND_COOLDOWN_SEC = 30;
/**
 * How many codes one attempt at recovery gets. Past this the answer is not another code: something
 * else is wrong — the mail is going somewhere they cannot read — and more codes only invalidate the
 * one that may yet arrive.
 *
 * HANDOFF NOTE: counted in this component, so it resets on reload. The real limit is per account
 * and lives on the server, which also has to return `resendLimit`; this number has to match it.
 */
const MAX_RESENDS = 3;
/** A code the demo rejects so the wrong-code state is reachable without a backend. See the
 *  HANDOFF NOTE on verifyCode. */
const DEMO_REJECTED_CODE = "12345678";

type Step = "email" | "code" | "password" | "done";

/**
 * Every way code entry can fail. They are separate states because the operator's next move differs
 * for each — retype, request a new one, or stop and telephone someone — and a single "invalid code"
 * leaves them guessing. On a closed network guessing wrong costs a phone call either way.
 *
 * HANDOFF NOTE: this is the error contract the verify endpoint has to satisfy. Each state can be
 * opened directly with /forgot-password?demo=<key>.
 */
type CodeFailure = "wrong" | "expired" | "throttled" | "resendLimit";

const CODE_FAILURE_TEXT: Record<Exclude<CodeFailure, "throttled">, Record<AppLanguage, string>> = {
  wrong: {
    en: "Incorrect code. Check and try again.",
    ko: "코드가 맞지 않습니다. 확인 후 다시 시도해주세요.",
  },
  // The screen states this up front too (see the code step), so the two must not drift — both read
  // RESET_CODE_TTL_MIN. HANDOFF NOTE: the backend has to enforce the same number.
  expired: {
    en: "Code expired. Request a new one.",
    ko: "만료된 코드입니다. 새 코드를 요청해주세요.",
  },
  resendLimit: {
    en: "Too many codes requested. Try again later.",
    ko: "코드를 너무 많이 요청했습니다. 잠시 후 다시 시도해주세요.",
  },
};

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--gray-900)" : FIELD_BORDER;
}

/**
 * Reset in three steps on one screen: prove you can read the mailbox, then set the new password
 * here. This replaces an emailed reset *link*, because the mail is read on the customer's internal
 * mail server and a link only works if that mailbox is opened on a machine that can also reach VCA
 * — which is not established. A code carries between two machines; a link does not. It also keeps
 * the reset token out of URLs, where it survives in mail forwards, proxy logs and browser history.
 *
 * Before this existed, "Forgot password?" on the login screen went straight to /password-setup, so
 * anyone could open the set-a-new-password form without proving they own the account, and nothing
 * was ever sent to anybody.
 */
/**
 * HANDOFF NOTE — viewing every state without a backend.
 *
 * None of these can be reached by using the screen normally, because the responses that would
 * produce them do not exist yet. Open them directly instead; this is the list of states the reset
 * endpoints have to be able to produce:
 *
 *   /forgot-password                 ask for the address
 *   /forgot-password?demo=code       code entry
 *   /forgot-password?demo=wrong      code rejected
 *   /forgot-password?demo=expired    code too old
 *   /forgot-password?demo=throttled  too many attempts, entry locked
 *   /forgot-password?demo=resendLimit  asked for too many codes (also reachable for real, by
 *                                    pressing Resend past MAX_RESENDS)
 *   /forgot-password?demo=password   set the new password
 *   /forgot-password?demo=done       finished
 *   /forgot-password?demo=adminOnly  deployment with no mail server at all
 *
 * Delete this parameter once the endpoints are real.
 */
const DEMO_EMAIL = "grace.tan@univs.ai";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordFlow />
    </Suspense>
  );
}

function ForgotPasswordFlow() {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  const demo = useSearchParams().get("demo");
  const authConfig = getAuthConfig();
  const [step, setStep] = useState<Step>(() => {
    if (demo === "code" || demo === "wrong" || demo === "expired" || demo === "throttled" || demo === "resendLimit") return "code";
    if (demo === "password" || demo === "done") return demo === "done" ? "done" : "password";
    return "email";
  });

  // ── step 1: who ────────────────────────────────────────────────────────────
  // Accepts an employee number as well as an email, matching the login prompt. Someone who signs in
  // with a number and has no address of their own would otherwise be locked out of recovery
  // entirely — the code still goes to whatever address the account carries.
  const [identifier, setIdentifier] = useState(demo ? DEMO_EMAIL : "");
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const typedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
  // An employee number is whatever the roster uses, so the only thing worth checking here is that
  // something was typed and it is not a half-finished email. Whether it exists is the server's
  // business, and deliberately not answered on screen.
  const looksLikeId = identifier.trim().length >= 3 && !identifier.includes("@");
  const identifierValid = authConfig.employeeIdLogin ? (typedEmail || looksLikeId) : typedEmail;
  const identifierError = identifierTouched && !identifierValid
    ? (authConfig.employeeIdLogin ? t.errIdentifier : t.errEmail)
    : "";

  // ── step 2: code ───────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(() => Array(RESET_CODE_LENGTH).fill(""));
  const [codeFailure, setCodeFailure] = useState<CodeFailure | null>(
    demo === "wrong" || demo === "expired" || demo === "throttled" || demo === "resendLimit"
      ? demo
      : null
  );
  const [cooldown, setCooldown] = useState(0);
  const [resends, setResends] = useState(0);
  // Bumped to send focus back to the first box after a resend.
  const [focusSignal, setFocusSignal] = useState(0);
  const code = digits.join("");
  const codeComplete = code.length === RESET_CODE_LENGTH;

  // ── step 3: new password ───────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<"new" | "confirm" | null>(null);
  const formatValid = isPasswordFormatValid(newPassword);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  // Enabled only when the form would actually succeed. Checking non-emptiness alone leaves the
  // button lit while the passwords disagree, and clicking it then does nothing at all — the click
  // has to either work or be visibly unavailable.
  const canSetPassword = formatValid && confirmPassword.length > 0 && !mismatch;
  // The rule line doubles as the format error, so a disabled button always has a reason on screen.
  const formatBroken = newPassword.length > 0 && !formatValid;

  // Ticks the resend cooldown down. One timeout per second rather than an interval, so the cleanup
  // has nothing to leak when the step changes mid-count.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resetCodeEntry = () => {
    setDigits(Array(RESET_CODE_LENGTH).fill(""));
    setCodeFailure(null);
  };

  // Deliberately does NOT check whether the account exists, and moves to the code step either way.
  // This screen is public, so branching on "no such user" would let anyone test addresses to find
  // out who has an account here. The backend simply sends nothing when there is no match, and an
  // attacker learns only that they cannot guess an 8-digit code.
  const sendCode = () => {
    setIdentifierTouched(true);
    if (!identifierValid) return;
    resetCodeEntry();
    setCooldown(RESEND_COOLDOWN_SEC);
    setStep("code");
  };

  const resend = () => {
    if (cooldown > 0) return;
    if (resends + 1 > MAX_RESENDS) {
      setDigits(Array(RESET_CODE_LENGTH).fill(""));
      setCodeFailure("resendLimit");
      // Held down as well as refused. Without a cooldown the link stayed live under the notice
      // that had just said no, so it could be pressed again and again with nothing happening —
      // which reads as a broken link rather than a limit.
      setCooldown(RESEND_COOLDOWN_SEC);
      return;
    }
    setResends(n => n + 1);
    resetCodeEntry();
    setCooldown(RESEND_COOLDOWN_SEC);
    setFocusSignal(n => n + 1);
  };

  // HANDOFF NOTE: there is no verify endpoint yet, so this cannot actually check the code. It
  // accepts any 8 digits except DEMO_REJECTED_CODE, which exists only so the wrong-code state is
  // reachable in the mockup. Replace the whole body with the backend call: on a rejection set
  // codeError from the response (the backend, not this screen, has to decide how many attempts an
  // address gets before the code is burned), and on success advance to "password" carrying whatever
  // short-lived token it returns.
  const verifyCode = () => {
    if (!codeComplete) return;
    if (code === DEMO_REJECTED_CODE) {
      setCodeFailure("wrong");
      return;
    }
    setCodeFailure(null);
    setStep("password");
  };

  const savePassword = () => {
    if (!canSetPassword || !formatValid || mismatch) return;
    // HANDOFF NOTE: submits nowhere. The real call needs the verified-code token from verifyCode.
    setStep("done");
  };

  const primaryButton = (label: string, enabled: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        height: "52px", width: "100%", border: "none", borderRadius: "8px",
        backgroundColor: enabled ? "var(--primary-400)" : "var(--gray-100)",
        color: enabled ? "white" : "var(--gray-400)",
        fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
        cursor: enabled ? "pointer" : "default",
        transition: "background-color 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );

  const textButton = (label: string, onClick: () => void, tone: "primary" | "gray" = "gray") => (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 0,
        fontSize: "12px", fontWeight: 700,
        color: tone === "primary" ? "var(--primary-400)" : "var(--gray-600)",
      }}
    >
      {label}
    </button>
  );

  const heading = (title: string, lines: string[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
      <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>{title}</h1>
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
        {lines.map((line, i) => (
          <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
        ))}
      </p>
    </div>
  );

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

          {/* A deployment with no mail server cannot send anything, so asking for an address would
              collect it and then do nothing — the person waits for a mail that was never going to
              arrive. Say plainly that recovery goes through a person, and name that person. */}
          {(demo === "adminOnly" || authConfig.passwordRecovery === "adminOnly") ? (
            <>
              {heading(t.adminTitle, [t.adminSub])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)",
                }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.whoToContact}</p>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
                    {authConfig.supportContact ?? "Your security operations team"}
                  </p>
                  <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "2px 0" }} />
                  {/* Both of Portal's no-mail options, in the order it offers them. This used to name
                      only the registration code while Portal's own notice named only the temporary
                      password, so the two halves of one conversation described different remedies. */}
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
                    {t.adminRemedies}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton(t.backToLogin, true, () => router.push("/login"))}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {t.haveCode}{" "}
                    <button
                      onClick={() => router.push("/register")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      {t.activateAccount}
                    </button>
                  </p>
                </div>
              </div>
            </>
          ) : (
          <>
          {step === "email" && (
            <>
              {/* One line, not three. The field below already says what to type into it, and the
                  step after this one says a code was sent — the subtitle only has to promise it. */}
              {heading(t.emailTitle, [t.emailSub])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                  <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>
                    {authConfig.employeeIdLogin ? t.identifierWithId : t.identifierEmailOnly}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px",
                    border: identifierError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                    <input
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      onBlur={() => setIdentifierTouched(true)}
                      onKeyDown={e => { if (e.key === "Enter") sendCode(); }}
                      placeholder={authConfig.employeeIdLogin ? "EMP-2041 or user@email.com" : "user@email.com"}
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-900)", letterSpacing: "-0.32px" }}
                    />
                  </div>
                  {identifierError ? (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
                      <ErrorCircleIcon /> {identifierError}
                    </p>
                  ) : authConfig.employeeIdLogin ? (
                    // A number resolves to whatever address the account carries — and a site with no
                    // per-person mail leaves that empty. Saying so here is the only warning that can
                    // be given, because the next screen cannot admit that nothing was sent without
                    // also telling a stranger whether the account exists.
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px", lineHeight: 1.6 }}>
                      {t.noAddressNote}{" "}
                      {authConfig.supportContact ?? t.noAddressFallback}.
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton(t.sendCode, identifierValid, sendCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {t.rememberedIt} {textButton(t.logIn, () => router.push("/login"), "primary")}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Too many wrong codes is a wall, not an inline hint: leaving the boxes usable invites
              a tenth attempt that cannot succeed. The others stay inline because retrying or
              requesting a fresh code still works from here. */}
          {step === "code" && codeFailure === "throttled" && (
            <>
              {heading(t.throttledTitle, [t.throttledSub])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--danger-100)",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
                    {/* OPEN QUESTION for the backend: how long is the lockout, and does the response
                        say? A countdown is kinder than "try again later", but it also tells a
                        guesser exactly when to come back. */}
                    {t.throttledBody}
                  </p>
                  <div style={{ height: "1px", backgroundColor: "var(--danger-200)", margin: "2px 0" }} />
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {authConfig.supportContact ?? "Your security operations team"}
                  </p>
                </div>

                {primaryButton(t.backToLogin, true, () => router.push("/login"))}
              </div>
            </>
          )}

          {step === "code" && codeFailure !== "throttled" && (
            <>
              {/* The deadline replaces "Type it in below", which the boxes already say. Someone who
                  walks to another machine to read the mail needs to know they are on a clock. */}
              {heading(t.codeTitle, [
                // Echoes the address only when they typed one — they already know it, so there is
                // nothing to leak. An employee number resolves to an address the screen has no
                // business printing, so it says where it went without saying where that is.
                typedEmail
                  ? t.codeSentTo(identifier.trim())
                  : t.codeSentToAccount,
                t.expiresIn(RESET_CODE_TTL_MIN),
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
                  <VerificationCodeInput
                    value={digits}
                    onChange={next => { setDigits(next); setCodeFailure(null); }}
                    error={!!codeFailure}
                    onSubmit={verifyCode}
                    focusSignal={focusSignal}
                    autoFocus
                  />

                  {codeFailure ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px", textAlign: "center" }}>
                        <ErrorCircleIcon /> {CODE_FAILURE_TEXT[codeFailure][lang]}
                      </p>
                      {/* An expired code cannot be retyped into working, so the way out is offered
                          right here instead of leaving them to find the resend link. */}
                      {codeFailure === "expired" && cooldown === 0 && (
                        <button
                          onClick={resend}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                        >
                          {t.sendNewCode}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                      {/* The cooldown is spelled out rather than just greying the link, so waiting
                          reads as waiting and not as a dead button. */}
                      {t.noCode}{" "}
                      {cooldown > 0
                        ? <span style={{ color: "var(--gray-400)" }}>{t.resendIn(cooldown)}</span>
                        : (
                          /* Not routed through textButton(): the lint rule cannot see that the
                             helper only stores the callback, so handing it a function that focuses
                             a ref reads as a ref access during render. */
                          <button
                            onClick={resend}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                          >
                            {t.resend}
                          </button>
                        )}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton(t.next, codeComplete, verifyCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {authConfig.employeeIdLogin ? t.wrongOne : t.wrongAddress}{" "}
                    {textButton(
                      authConfig.employeeIdLogin ? t.startOver : t.useDifferentEmail,
                      () => { resetCodeEntry(); setStep("email"); },
                      "primary",
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "password" && (
            <>
              {heading(t.passwordTitle, [t.passwordSub])}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.newPassword}</label>
                    <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: fieldBorder(focusedField === "new"), borderRadius: "8px" }}>
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onFocus={() => setFocusedField("new")}
                        onBlur={() => setFocusedField(null)}
                        onKeyDown={e => { if (e.key === "Enter") savePassword(); }}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        autoFocus
                        style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-700)", letterSpacing: "-0.32px" }}
                      />
                      <button type="button" onClick={() => setShowNew(s => !s)}
                        aria-label={showNew ? t.hidePassword : t.showPassword}
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                        {showNew ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.confirmPassword}</label>
                    <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: fieldBorder(focusedField === "confirm"), borderRadius: "8px" }}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField("confirm")}
                        onBlur={() => setFocusedField(null)}
                        onKeyDown={e => { if (e.key === "Enter") savePassword(); }}
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

                {primaryButton(t.changePassword, canSetPassword, savePassword)}
              </div>
            </>
          )}

          {step === "done" && (
            <>
              {heading(t.doneTitle, [t.doneSub])}
              {primaryButton(t.logIn, true, () => router.push("/login"))}
            </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
