"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import VerificationCodeInput from "@/components/VerificationCodeInput";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT, RESET_CODE_LENGTH, RESET_CODE_TTL_MIN } from "@/lib/password";
import { getAuthConfig } from "@/lib/authConfig";

const FIELD_BORDER = "1px solid var(--gray-300)";
/** Seconds before "Resend" becomes available again — stops a stuck user from mailing themselves ten
 *  codes, each of which invalidates the last. */
const RESEND_COOLDOWN_SEC = 30;
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

const CODE_FAILURE_TEXT: Record<Exclude<CodeFailure, "throttled">, string> = {
  wrong: "That code is not correct. Check the mail and try again.",
  // The screen states this up front too (see the code step), so the two must not drift — both read
  // RESET_CODE_TTL_MIN. HANDOFF NOTE: the backend has to enforce the same number.
  expired: `That code has expired. Codes last ${RESET_CODE_TTL_MIN} minutes — request a new one.`,
  resendLimit: "You have requested the maximum number of codes. Try again later.",
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
  const demo = useSearchParams().get("demo");
  const authConfig = getAuthConfig();
  const [step, setStep] = useState<Step>(() => {
    if (demo === "code" || demo === "wrong" || demo === "expired" || demo === "throttled" || demo === "resendLimit") return "code";
    if (demo === "password" || demo === "done") return demo === "done" ? "done" : "password";
    return "email";
  });

  // ── step 1: email ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState(demo ? DEMO_EMAIL : "");
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError = emailTouched && !emailValid ? "Enter a valid email address." : "";

  // ── step 2: code ───────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(() => Array(RESET_CODE_LENGTH).fill(""));
  const [codeFailure, setCodeFailure] = useState<CodeFailure | null>(
    demo === "wrong" || demo === "expired" || demo === "throttled" || demo === "resendLimit"
      ? demo
      : null
  );
  const [cooldown, setCooldown] = useState(0);
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
    setEmailTouched(true);
    if (!emailValid) return;
    resetCodeEntry();
    setCooldown(RESEND_COOLDOWN_SEC);
    setStep("code");
  };

  const resend = () => {
    if (cooldown > 0) return;
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
        height: "48px", width: "100%", border: "none", borderRadius: "8px",
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px", margin: "40px 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>

          {/* A deployment with no mail server cannot send anything, so asking for an address would
              collect it and then do nothing — the person waits for a mail that was never going to
              arrive. Say plainly that recovery goes through a person, and name that person. */}
          {(demo === "adminOnly" || authConfig.passwordRecovery === "adminOnly") ? (
            <>
              {heading("Password reset is handled by an administrator", [
                "This system has no outbound mail, so a reset link or code cannot be sent",
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)",
                }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>WHO TO CONTACT</p>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.32px" }}>
                    {authConfig.supportContact ?? "Your security operations team"}
                  </p>
                  <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "2px 0" }} />
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
                    They will issue a new registration code. You set your own password with it, so
                    nobody else ever knows what you choose.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton("Back to log in", true, () => router.push("/login"))}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Already have a code?{" "}
                    <button
                      onClick={() => router.push("/register")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      Activate your account
                    </button>
                  </p>
                </div>
              </div>
            </>
          ) : (
          <>
          {step === "email" && (
            <>
              {heading("Forgot your password?", [
                "Enter the email you registered with",
                "We’ll send you a verification code",
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                  <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Email</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px",
                    border: emailError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                    <PersonFieldIcon />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      onKeyDown={e => { if (e.key === "Enter") sendCode(); }}
                      placeholder="user@email.com"
                      autoFocus
                      style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                    />
                  </div>
                  {emailError && (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
                      <ErrorCircleIcon /> {emailError}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton("Send code", emailValid, sendCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Remembered it? {textButton("Log in", () => router.push("/login"), "primary")}
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
              {heading("Too many attempts", [
                "Code entry is locked for this account for now",
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--danger-100)",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
                    {/* OPEN QUESTION for the backend: how long is the lockout, and does the response
                        say? A countdown is kinder than "try again later", but it also tells a
                        guesser exactly when to come back. */}
                    Wait a few minutes and try again, or ask an administrator to issue a new code
                    for you.
                  </p>
                  <div style={{ height: "1px", backgroundColor: "var(--danger-200)", margin: "2px 0" }} />
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {authConfig.supportContact ?? "Your security operations team"}
                  </p>
                </div>

                {primaryButton("Back to log in", true, () => router.push("/login"))}
              </div>
            </>
          )}

          {step === "code" && codeFailure !== "throttled" && (
            <>
              {/* The deadline replaces "Type it in below", which the boxes already say. Someone who
                  walks to another machine to read the mail needs to know they are on a clock. */}
              {heading("Enter your verification code", [
                `We sent an ${RESET_CODE_LENGTH}-digit code to ${email.trim()}`,
                `It expires in ${RESET_CODE_TTL_MIN} minutes`,
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
                        <ErrorCircleIcon /> {CODE_FAILURE_TEXT[codeFailure]}
                      </p>
                      {/* An expired code cannot be retyped into working, so the way out is offered
                          right here instead of leaving them to find the resend link. */}
                      {codeFailure === "expired" && cooldown === 0 && (
                        <button
                          onClick={resend}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                        >
                          Send a new code
                        </button>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                      {/* The cooldown is spelled out rather than just greying the link, so waiting
                          reads as waiting and not as a dead button. */}
                      Didn&apos;t get the code?{" "}
                      {cooldown > 0
                        ? <span style={{ color: "var(--gray-400)" }}>Resend in {cooldown}s</span>
                        : (
                          /* Not routed through textButton(): the lint rule cannot see that the
                             helper only stores the callback, so handing it a function that focuses
                             a ref reads as a ref access during render. */
                          <button
                            onClick={resend}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                          >
                            Resend
                          </button>
                        )}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton("Next", codeComplete, verifyCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Wrong address? {textButton("Use a different email", () => { resetCodeEntry(); setStep("email"); }, "primary")}
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "password" && (
            <>
              {heading("Set a new password", ["Choose a password you have not used here before"])}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>New password</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === "new"), borderRadius: "8px" }}>
                      <LockFieldIcon />
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onFocus={() => setFocusedField("new")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        autoFocus
                        style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
                      />
                      <button onClick={() => setShowNew(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                        {showNew ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Confirm password</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === "confirm"), borderRadius: "8px" }}>
                      <LockFieldIcon />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField("confirm")}
                        onBlur={() => setFocusedField(null)}
                        onKeyDown={e => { if (e.key === "Enter") savePassword(); }}
                        placeholder="••••••••"
                        style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
                      />
                      <button onClick={() => setShowConfirm(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                        {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </div>
                  </div>
                </div>

                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: formatBroken ? "var(--danger-400)" : "var(--gray-600)", letterSpacing: "-0.24px" }}>
                  {formatBroken && <ErrorCircleIcon />}
                  {PASSWORD_RULE_TEXT}
                </p>

                {mismatch && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <ErrorCircleIcon />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.26px" }}>
                      Passwords do not match. Please try again.
                    </span>
                  </div>
                )}

                {primaryButton("Change password", canSetPassword, savePassword)}
              </div>
            </>
          )}

          {step === "done" && (
            <>
              {heading("Password changed", ["You can now log in with your new password"])}
              {primaryButton("Log in", true, () => router.push("/login"))}
            </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
