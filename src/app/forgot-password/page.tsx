"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import VerificationCodeInput from "@/components/VerificationCodeInput";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT, RESET_CODE_LENGTH } from "@/lib/password";

const FIELD_BORDER = "1px solid var(--gray-300)";
/** Seconds before "Resend" becomes available again — stops a stuck user from mailing themselves ten
 *  codes, each of which invalidates the last. */
const RESEND_COOLDOWN_SEC = 30;
/** A code the demo rejects so the wrong-code state is reachable without a backend. See the
 *  HANDOFF NOTE on verifyCode. */
const DEMO_REJECTED_CODE = "12345678";

type Step = "email" | "code" | "password" | "done";

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--primary-300)" : FIELD_BORDER;
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
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  // ── step 1: email ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError = emailTouched && !emailValid ? "Enter a valid email address." : "";

  // ── step 2: code ───────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(() => Array(RESET_CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState("");
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
    setCodeError("");
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
      setCodeError("That code is not correct. Check the mail and try again.");
      return;
    }
    setCodeError("");
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

          {step === "code" && (
            <>
              {heading("Enter your verification code", [
                `We sent an ${RESET_CODE_LENGTH}-digit code to ${email.trim()}`,
                "Type it in below",
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
                  <VerificationCodeInput
                    value={digits}
                    onChange={next => { setDigits(next); setCodeError(""); }}
                    error={!!codeError}
                    onSubmit={verifyCode}
                    focusSignal={focusSignal}
                    autoFocus
                  />

                  {codeError ? (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
                      <ErrorCircleIcon /> {codeError}
                    </p>
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
        </div>
      </div>
    </div>
  );
}
