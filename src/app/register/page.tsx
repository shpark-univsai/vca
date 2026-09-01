"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import VerificationCodeInput from "@/components/VerificationCodeInput";
import { LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";
import {
  REGISTRATION_CODE_LENGTH, RosterEntry, resolveRegistrationCode,
} from "@/lib/staffRoster";

type Step = "code" | "confirm" | "password" | "done";

const CODE_ERRORS: Record<"unknown" | "used" | "expired", string> = {
  unknown: "We don’t recognise that code. Check it against the sheet you were given.",
  used: "That code has already been used. Ask your administrator to issue a new one.",
  expired: "That code has expired. Ask your administrator to issue a new one.",
};

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--primary-300)" : "1px solid var(--gray-300)";
}

/**
 * Sign-up for a company's own staff, as opposed to /signup, which is the Portal wizard a master uses
 * to create an organization.
 *
 * Built for deployments with no outbound mail, so there is no emailed link and no emailed code. An
 * administrator loads the staff roster into Portal and hands each person a registration code on
 * paper; the code resolves to exactly one roster row, which is what proves identity here. Because
 * that row already carries the person's name, project and permission, the only things asked for are
 * the code and a password — asking again for what the roster knows would add typos and no security.
 *
 * Issuing the code is the approval, so nothing here waits for a second review.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");

  const [digits, setDigits] = useState<string[]>(() => Array(REGISTRATION_CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState("");
  const [entry, setEntry] = useState<RosterEntry | null>(null);
  const code = digits.join("");
  const codeComplete = code.length === REGISTRATION_CODE_LENGTH;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const formatValid = isPasswordFormatValid(password);
  const formatBroken = password.length > 0 && !formatValid;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const canSetPassword = formatValid && confirmPassword.length > 0 && !mismatch;

  const restart = () => {
    setDigits(Array(REGISTRATION_CODE_LENGTH).fill(""));
    setCodeError("");
    setEntry(null);
    setStep("code");
  };

  // HANDOFF NOTE: resolves against mock roster data in lib/staffRoster.ts. The real call goes to the
  // backend, which must throttle attempts — the code is the only gate on this screen.
  const submitCode = () => {
    if (!codeComplete) return;
    const result = resolveRegistrationCode(code);
    if (!result.ok) {
      setCodeError(CODE_ERRORS[result.reason]);
      return;
    }
    setCodeError("");
    setEntry(result.entry);
    setStep("confirm");
  };

  // HANDOFF NOTE: creates nothing. The real call sets the password, activates the account against
  // this roster row, and burns the code so it cannot be used a second time.
  const savePassword = () => {
    if (!canSetPassword) return;
    setStep("done");
  };

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

  const passwordField = (
    label: string, key: string, value: string, setValue: (v: string) => void,
    shown: boolean, toggle: () => void, onEnter?: () => void,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: fieldBorder(focusedField === key), borderRadius: "8px" }}>
        <LockFieldIcon />
        <input
          type={shown ? "text" : "password"}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocusedField(key)}
          onBlur={() => setFocusedField(null)}
          onKeyDown={e => { if (e.key === "Enter") onEnter?.(); }}
          placeholder="••••••••"
          autoFocus={key === "password"}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-700)", letterSpacing: "-0.35px" }}
        />
        <button onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
          {shown ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
  );

  const detailRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.26px", textAlign: "right" }}>{value}</span>
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

          {step === "code" && (
            <>
              {heading("Enter your registration code", [
                `Your administrator gave you an ${REGISTRATION_CODE_LENGTH}-character code`,
                "It identifies you, so there is nothing else to fill in",
              ])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
                  <VerificationCodeInput
                    value={digits}
                    onChange={next => { setDigits(next); setCodeError(""); }}
                    error={!!codeError}
                    onSubmit={submitCode}
                    charset="alnum"
                    groupAfter={4}
                    autoFocus
                  />
                  {codeError && (
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px", textAlign: "center" }}>
                      <ErrorCircleIcon /> {codeError}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton("Continue", codeComplete, submitCode)}
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Already have an account?{" "}
                    <button
                      onClick={() => router.push("/login")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      Log in
                    </button>
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "confirm" && entry && (
            <>
              {heading("Is this you?", ["Check this against your own details before continuing"])}

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                {/* Showing what the code resolved to, before a password exists. Someone handed the
                    wrong sheet finds out here instead of after creating an account in another
                    person's name — and there is no way back once the code is burned. */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: "10px",
                  padding: "20px", borderRadius: "12px", backgroundColor: "var(--gray-50)",
                }}>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.36px" }}>{entry.name}</p>
                  <div style={{ height: "1px", backgroundColor: "var(--gray-200)" }} />
                  {detailRow("Employee ID", entry.employeeId)}
                  {entry.department && detailRow("Department", entry.department)}
                  {detailRow("Project", entry.projectName)}
                  {detailRow("Permission", entry.permission === "admin" ? "Administrator" : "Operator")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {primaryButton("Yes, continue", true, () => setStep("password"))}
                  <button
                    onClick={restart}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}
                  >
                    This isn&apos;t me — enter a different code
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "password" && entry && (
            <>
              {heading("Set your password", [`You are setting up the account for ${entry.name}`])}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
                  {passwordField("Password", "password", password, setPassword, showPassword, () => setShowPassword(s => !s))}
                  {passwordField("Confirm password", "confirm", confirmPassword, setConfirmPassword, showConfirm, () => setShowConfirm(s => !s), savePassword)}
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

                {primaryButton("Create account", canSetPassword, savePassword)}
              </div>
            </>
          )}

          {step === "done" && entry && (
            <>
              {heading("Account created", [`You can now log in as ${entry.name}`])}
              {primaryButton("Log in", true, () => router.push("/login"))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
