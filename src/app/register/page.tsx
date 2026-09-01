"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, LockFieldIcon, EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { isPasswordFormatValid, PASSWORD_RULE_TEXT } from "@/lib/password";

const FIELD_BORDER = "1px solid var(--gray-300)";

function fieldBorder(active: boolean) {
  return active ? "1px solid var(--primary-300)" : FIELD_BORDER;
}

/**
 * Sign-up for a company's own staff, as opposed to /signup, which is the Portal wizard a master uses
 * to create an organization. Reachable only where authConfig.selfSignup is on.
 *
 * There is no email verification step here on purpose. That leaves nothing on this screen proving
 * the person owns the address they typed, so the account cannot be usable on submit — an
 * administrator approves it in Portal first. That is also the only path that works at all for a
 * company with no outbound mail, which is why it is the one built.
 *
 * TODO (deferred, decided later): Portal will hold an imported staff roster, and sign-up will be
 * matched against it — a matched person arrives with the permissions their roster row already
 * carries, which is what makes approval a formality rather than per-person permission work. Where
 * that lands is submitRegistration below. Until then every sign-up is reviewed by hand.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError = emailTouched && email.length > 0 && !emailValid ? "Enter a valid email address." : "";
  const formatValid = isPasswordFormatValid(password);
  const formatBroken = password.length > 0 && !formatValid;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  // Enabled only when the form would actually succeed — a lit button that does nothing on click is
  // worse than a disabled one, and every reason it is disabled is stated on screen.
  const canSubmit = name.trim().length > 0 && emailValid && formatValid && confirmPassword.length > 0 && !mismatch;

  // HANDOFF NOTE: submits nowhere. The real call creates the account in a pending state and raises
  // it for approval in Portal; it must also be refused outright by the backend when self-sign-up is
  // switched off for the deployment, since hiding this screen does not close the route.
  const submitRegistration = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  const textField = (
    label: string, key: string, node: React.ReactNode, error?: string,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px",
        border: error ? "1px solid var(--danger-400)" : fieldBorder(focusedField === key), borderRadius: "8px" }}>
        {node}
      </div>
      {error && (
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
          <ErrorCircleIcon /> {error}
        </p>
      )}
    </div>
  );

  const inputStyle = { flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px", margin: "40px 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>

          {submitted ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>Account requested</h1>
                {/* Says plainly that they cannot log in yet. Without this the natural next move is
                    to try the login screen and read the failure as a broken password. */}
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
                  An administrator has to approve <strong style={{ color: "var(--gray-800)" }}>{email.trim()}</strong> before
                  you can log in. You will not be able to sign in until then.
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                style={{
                  height: "48px", width: "100%", border: "none", borderRadius: "8px",
                  backgroundColor: "var(--primary-400)", color: "white",
                  fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px", cursor: "pointer",
                }}
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px", textAlign: "center" }}>Create your account</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
                  Use your work email<br />
                  An administrator reviews new accounts before they can log in
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {textField("Full name", "name", (
                    <>
                      <PersonFieldIcon />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Grace Tan"
                        autoFocus
                        style={inputStyle}
                      />
                    </>
                  ))}
                  {textField("Email", "email", (
                    <>
                      <PersonFieldIcon />
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => { setFocusedField(null); setEmailTouched(true); }}
                        placeholder="user@email.com"
                        style={inputStyle}
                      />
                    </>
                  ), emailError)}
                  {textField("Password", "password", (
                    <>
                      <LockFieldIcon />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        style={inputStyle}
                      />
                      <button onClick={() => setShowPassword(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                        {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </>
                  ))}
                  {textField("Confirm password", "confirm", (
                    <>
                      <LockFieldIcon />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField("confirm")}
                        onBlur={() => setFocusedField(null)}
                        onKeyDown={e => { if (e.key === "Enter") submitRegistration(); }}
                        placeholder="••••••••"
                        style={inputStyle}
                      />
                      <button onClick={() => setShowConfirm(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                        {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                      </button>
                    </>
                  ))}
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

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", marginTop: "4px" }}>
                  <button
                    onClick={submitRegistration}
                    disabled={!canSubmit}
                    style={{
                      height: "48px", width: "100%", border: "none", borderRadius: "8px",
                      backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-100)",
                      color: canSubmit ? "white" : "var(--gray-400)",
                      fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
                      cursor: canSubmit ? "pointer" : "default",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                  >
                    Create account
                  </button>
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
        </div>
      </div>
    </div>
  );
}
