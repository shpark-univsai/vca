"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, ErrorCircleIcon } from "@/components/AuthIcons";

const FIELD_BORDER = "1px solid var(--gray-300)";

/**
 * Asks for the address and hands the request to the backend, which mails a reset link through the
 * customer's own mail server. This step did not exist: "Forgot password?" on the login screen went
 * straight to /password-setup, so anyone could open the set-a-new-password form without proving
 * they own the account, and nothing was ever sent to anybody.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError = touched && !emailValid ? "Enter a valid email address." : "";

  // Deliberately does NOT check whether the account exists. This screen is public, so branching on
  // "no such user" would let anyone test addresses to find out who has an account here. The
  // confirmation is worded to be true either way, and the backend simply sends nothing when there
  // is no match.
  const handleSubmit = () => {
    setTouched(true);
    if (!emailValid) return;
    setSent(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "36px", margin: "40px 0",
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>

          {sent ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Check your mail</h1>
                {/* "If an account exists" rather than "we sent it": the screen must read the same
                    whether or not that address has an account here. */}
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
                  If an account exists for <strong style={{ color: "var(--gray-800)" }}>{email.trim()}</strong>,
                  a reset link is on its way to that mailbox.
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.24px", textAlign: "center", lineHeight: 1.6 }}>
                  Open it from your company webmail. If it does not arrive, ask your administrator
                  to send a reset.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
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
                {/* Retry without going back and forth — a mistyped address is the most likely
                    reason someone is still on this screen. */}
                <button
                  onClick={() => { setSent(false); setTouched(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}
                >
                  Use a different address
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Reset password</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center" }}>
                  We will mail you a link to set a new one
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                  <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Email</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px",
                    border: emailError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                    <PersonFieldIcon />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                      onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
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
                  <button
                    onClick={handleSubmit}
                    disabled={!emailValid}
                    style={{
                      height: "48px", width: "100%", border: "none", borderRadius: "8px",
                      backgroundColor: emailValid ? "var(--primary-400)" : "var(--gray-100)",
                      color: emailValid ? "white" : "var(--gray-400)",
                      fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
                      cursor: emailValid ? "pointer" : "default",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                  >
                    Send reset link
                  </button>
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Remembered it?{" "}
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
