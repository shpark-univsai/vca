"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { getAuthConfig } from "@/lib/authConfig";
import { PersonFieldIcon, LockFieldIcon, EyeIcon, EyeOffIcon } from "@/components/AuthIcons";
import { useVcaStore } from "@/lib/vcaStore";

const FIELD_BORDER = "1px solid var(--gray-300)";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const authConfig = getAuthConfig();

  const handleSubmit = () => {
    if (!canSubmit) return;
    // No real backend yet — mock the post-login permission branch off the Portal user registry
    // (see project-vca-auth-routing-plan memory) so Portal is reachable straight from login,
    // not only via the VCA app's Navbar "Portal" switch-over item.
    //
    // HANDOFF NOTE: `password` is only checked for non-emptiness above (`canSubmit`) — it's never
    // actually verified against anything, and no session token/cookie gets created here, so no
    // route in the app is actually gated on being logged in. Left alone (rather than adding a mock
    // session/middleware layer here) since src/app/portal/ has its own auth work already in
    // progress — a real login needs to be wired up together with whatever session model that
    // settles on, not built separately here and reconciled later.
    const matchedUser = useVcaStore.getState().portalUsers.find(
      u => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    router.push(matchedUser?.permission === "admin" ? "/portal" : "/");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      {/* Top-aligned, not centred. While this was `alignItems: "center"` the space above the
          illustration was decided by the browser splitting the leftover height — trimming the
          card's padding just handed the same space back as centring margin, so the gap never
          moved. Anchoring to the top makes paddingTop the actual number: 44 here + 20 of card
          padding = 64px above the artwork, about half of the ~130px centring was producing on a
          typical window. Same pattern /password-setup already uses. */}
      <div className="vca-auth-scroll" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
        <div style={{
          width: "480px", maxWidth: "480px", backgroundColor: "white",
          borderRadius: "28px", padding: "20px 36px 36px", margin: "0 0 40px",
          display: "flex", flexDirection: "column", gap: "24px", alignItems: "center",
        }}>
          {/* Exported from the Figma login frame (node 49:21165), then cropped to the artwork
              itself. The 1024px source carries ~186px of transparent padding above the camera,
              which at render size put roughly 50px of dead space inside the image and read as a
              gap nobody asked for. Cropping means the box IS the artwork, so the 24px column gap
              below is the only spacing between it and the title. 227x236 keeps the source's 614:639
              proportion. Decorative, so alt="" keeps a screen reader from announcing it before the
              form. Its rendered size lives in globals.css so the short-window rules can change it —
              an inline height would outrank them. */}
          <img
            className="vca-auth-illustration"
            src="/login-illustration.png"
            alt=""
            width={188}
            height={196}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Log in</h1>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Welcome to VCA</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "32px", width: "100%" }}>
              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Email</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <PersonFieldIcon />
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@email.com"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                  />
                </div>
              </div>
              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Password</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <LockFieldIcon />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Please enter your password"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                  />
                  <button onClick={() => setShowPassword(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "52px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={e => setKeepLoggedIn(e.target.checked)}
                    style={{ width: "20px", height: "20px", accentColor: "var(--primary-400)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>Keep me logged in</span>
                </label>
                {/* /password-setup went straight to the set-a-new-password form, with no proof
                    the visitor owns the account and nothing mailed to anyone. It now asks for the
                    address first and leaves the sending to the backend. */}
                <button
                  onClick={() => router.push("/forgot-password")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                onClick={handleSubmit}
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
                Log in
              </button>
              {/* What to tell someone with no account depends on which ways in this deployment
                  has switched on — see lib/authConfig.ts. Note this stays plain text even when
                  accessRequest is on: a request has to name the project the admin is approving
                  access TO, and this screen has no project context, so the link opened the form in
                  a state it could never submit from ("Project: not specified"). That path only
                  works from the project link that bounced the visitor, which carries ?project=.
                  Once a domain identifies the company before login, this can become a real link.
                  (The Figma frame has no footer line here at all; this keeps one because a
                  first-time visitor does ask the question.) */}
              <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px", lineHeight: 1.6 }}>
                Don&apos;t have an account?<br />
                {authConfig.registrationCode ? (
                  <>
                    Ask your administrator for a registration code, then{" "}
                    <button
                      onClick={() => router.push("/register")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      create your account
                    </button>.
                  </>
                ) : authConfig.accessRequest
                  ? "Open the project link you were sent to request access."
                  : "Ask your administrator to send you an invitation."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
