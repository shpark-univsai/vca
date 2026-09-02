"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVcaStore, type ProjectType } from "@/lib/vcaStore";
import { BORDER, FilterSelect } from "./PortalShared";

type SignupStep = "account" | "team" | "done";

const STEP_PILLS: { key: SignupStep | "landing"; label: string }[] = [
  { key: "landing", label: "Sign In / Landing" },
  { key: "account", label: "Step 1 — Create Account" },
  { key: "team", label: "Step 2 — Set Up Team" },
  { key: "done", label: "Done — Get Started" },
];

const INDUSTRIES = ["Smart City", "Smart School", "Utilities", "Other"];

function industryToProjectType(industry: string): ProjectType {
  return industry === "Smart School" ? "smart_school" : "smart_city";
}

function isEmailFormatValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function isPasswordValid(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.lower && c.upper && c.number && c.symbol;
}

type Step1Field = "email" | "password" | "confirmPassword" | "fullName";
type Step2Field = "orgName" | "channelCount" | "agreedToS";

function isChannelCountValid(value: string): boolean {
  if (!value.trim()) return true; // optional — empty is fine
  return /^[0-9]+$/.test(value.trim()) && Number(value.trim()) > 0;
}

function FieldError({ text }: { text: string }) {
  if (!text) return null;
  return <p style={{ fontSize: "10px", color: "var(--danger-500)", marginTop: "4px" }}>{text}</p>;
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
        cursor: "pointer", padding: 0, marginBottom: "16px", color: "var(--gray-500)", fontSize: "12px", fontWeight: 700,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M7.5 2.5L3 6L7.5 9.5" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </button>
  );
}

function ProgressPills({ current }: { current: SignupStep }) {
  return (
    <div style={{ display: "flex", gap: "12px", justifyContent: "center", padding: "16px 0" }}>
      {STEP_PILLS.map(p => {
        const active = p.key === current;
        return (
          <span key={p.key} style={{
            fontSize: "10px", fontWeight: 600, padding: "7px 14px", borderRadius: "14px",
            backgroundColor: active ? "var(--primary-400)" : "var(--gray-100)",
            color: active ? "white" : "var(--gray-500)", whiteSpace: "nowrap",
          }}>
            {p.label}
          </span>
        );
      })}
    </div>
  );
}

function StepCard({ children, width = 520 }: { children: React.ReactNode; width?: number }) {
  return (
    <div style={{
      backgroundColor: "white", border: BORDER, borderRadius: "20px",
      width: `${width}px`, maxWidth: "100%", boxSizing: "border-box", padding: "27px 31px 31px",
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>{children}</p>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", height: "40px", padding: "0 13px",
  borderRadius: "10px", border: BORDER, backgroundColor: "white",
  fontSize: "12px", fontWeight: 600, fontFamily: "inherit", color: "var(--gray-900)",
};

export default function PortalSignupWizard() {
  const router = useRouter();
  const portalUsers = useVcaStore(s => s.portalUsers);
  const addTeam = useVcaStore(s => s.addTeam);
  const addPortalUser = useVcaStore(s => s.addPortalUser);

  const [step, setStep] = useState<SignupStep>("account");

  // Step 1
  const [email, setEmail] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [touched, setTouched] = useState<Record<Step1Field, boolean>>({
    email: false, password: false, confirmPassword: false, fullName: false,
  });
  const markTouched = (field: Step1Field) => setTouched(t => ({ ...t, [field]: true }));

  // Step 2
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [channelCount, setChannelCount] = useState("");
  const [agreedToS, setAgreedToS] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [touched2, setTouched2] = useState<Record<Step2Field, boolean>>({
    orgName: false, channelCount: false, agreedToS: false,
  });
  const markTouched2 = (field: Step2Field) => setTouched2(t => ({ ...t, [field]: true }));

  const [createdOrgId, setCreatedOrgId] = useState("");

  const emailFormatValid = isEmailFormatValid(email);
  const passwordValid = isPasswordValid(password);
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;
  const nameValid = fullName.trim().length > 0;
  const step1Valid = emailFormatValid && emailChecked && !emailTaken && passwordValid && confirmValid && nameValid;

  const orgNameValid = orgName.trim().length >= 2;
  const channelCountValid = isChannelCountValid(channelCount);
  const step2Valid = orgNameValid && channelCountValid && agreedToS;

  const emailError = !touched.email ? "" :
    !emailFormatValid ? "Enter a valid email address." :
    emailChecked && emailTaken ? "This email is already registered — try logging in instead." :
    !emailChecked ? "Click “Check Availability” to verify this email." : "";
  const passwordError = touched.password && !passwordValid
    ? "Must be 8+ characters with upper & lower case, a number, and a symbol." : "";
  const confirmError = touched.confirmPassword && confirmPassword.length > 0 && !confirmValid
    ? "Passwords do not match." : "";
  const nameError = touched.fullName && !nameValid ? "Full name is required." : "";

  const orgNameError = touched2.orgName && !orgNameValid ? "Team name is required (min 2 characters)." : "";
  const channelCountError = touched2.channelCount && !channelCountValid ? "Enter a valid number of channels." : "";
  const tosError = touched2.agreedToS && !agreedToS ? "You must agree to the Terms of Service to continue." : "";

  const checkAvailability = () => {
    markTouched("email");
    if (!emailFormatValid) return;
    const taken = portalUsers.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
    setEmailTaken(taken);
    setEmailChecked(true);
  };

  const handleContinueStep1 = () => {
    setTouched({ email: true, password: true, confirmPassword: true, fullName: true });
    if (step1Valid) setStep("team");
  };

  const useSuggestedDomain = () => {
    const domain = email.split("@")[1];
    if (!domain) return;
    const label = domain.split(".")[0];
    setOrgName(label.charAt(0).toUpperCase() + label.slice(1));
  };

  const completeSignup = () => {
    if (!step2Valid) return;
    const teamId = addTeam({ name: orgName.trim(), region: "", industry: industry || undefined });
    addPortalUser({ name: fullName.trim(), email: email.trim(), teamId, projectIds: [], permission: "admin", status: "active" });
    setCreatedOrgId(teamId);
    setStep("done");
  };

  const handleCompleteSignup = () => {
    setTouched2({ orgName: true, channelCount: true, agreedToS: true });
    if (step2Valid) completeSignup();
  };

  const goToFirstProject = () => {
    const type = industryToProjectType(industry);
    router.push(`/portal?newProject=1&type=${type}&teamId=${createdOrgId}`);
  };

  // Lets someone who just wants to look around land on the Projects dashboard (empty-state
  // gallery) instead of being pushed straight into the New Project Wizard.
  const goToDashboard = () => {
    router.push(`/portal?teamId=${createdOrgId}`);
  };

  // Honors the "redirecting automatically" copy — the button below still lets the user skip the wait.
  useEffect(() => {
    if (step !== "done") return;
    const timer = setTimeout(goToFirstProject, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--gray-50)", display: "flex", flexDirection: "column" }}>
      <ProgressPills current={step} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "20px 24px 60px" }}>

        {step === "account" && (
          <StepCard>
            <BackLink label="Back to Login" onClick={() => router.push("/login")} />
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>Step 1 / 2 — Create Admin Account</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>This becomes your login ID and the master admin who receives system notifications.</p>
            <div style={{ height: "4px", backgroundColor: "var(--gray-100)", borderRadius: "2px", marginTop: "16px", marginBottom: "20px" }}>
              <div style={{ height: "4px", width: "50%", backgroundColor: "var(--primary-400)", borderRadius: "2px" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <FieldLabel>Email Address (Login ID) *</FieldLabel>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailChecked(false); setEmailTaken(false); }}
                    onBlur={() => markTouched("email")}
                    placeholder="e.g. hyejin@univs.ai"
                    style={{ ...inputStyle, flex: 1, border: emailError ? "1px solid var(--danger-500)" : inputStyle.border }}
                  />
                  <button
                    onClick={checkAvailability}
                    disabled={!email.trim()}
                    style={{
                      width: "124px", height: "40px", borderRadius: "999px", border: "none", flexShrink: 0,
                      backgroundColor: emailChecked ? (emailTaken ? "var(--danger-100)" : "var(--gray-100)") : "var(--gray-900)",
                      color: emailChecked ? (emailTaken ? "var(--danger-500)" : "var(--success-400)") : "white",
                      fontSize: "12px", fontWeight: 700, cursor: email.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {emailChecked ? (emailTaken ? "✗ Taken" : "✓ Available") : "Check Availability"}
                  </button>
                </div>
                <FieldError text={emailError} />
              </div>

              <div>
                <FieldLabel>Password *</FieldLabel>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => markTouched("password")}
                  placeholder="Letters, numbers & symbols, 8+ characters"
                  style={{ ...inputStyle, border: passwordError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={passwordError} />
                <div style={{ backgroundColor: "var(--primary-100)", borderRadius: "10px", padding: "8px 14px", marginTop: "6px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-400)" }}>Password requirements</p>
                  <p style={{ fontSize: "10px", color: "var(--primary-400)", marginTop: "2px" }}>Upper &amp; lowercase letters · at least 1 number · at least 1 symbol (@#$%) · minimum 8 characters</p>
                </div>
              </div>

              <div>
                <FieldLabel>Confirm Password *</FieldLabel>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched("confirmPassword")}
                  placeholder="Re-enter your password"
                  style={{ ...inputStyle, border: confirmError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={confirmError} />
              </div>

              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onBlur={() => markTouched("fullName")}
                  placeholder="e.g. Hye Kim"
                  style={{ ...inputStyle, border: nameError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={nameError} />
              </div>
            </div>

            <button
              onClick={handleContinueStep1}
              style={{
                width: "100%", height: "48px", marginTop: "24px", borderRadius: "999px", border: "none",
                backgroundColor: "var(--gray-900)", color: "white", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", opacity: step1Valid ? 1 : 0.5,
              }}
            >
              Continue — Set Up Team →
            </button>
          </StepCard>
        )}

        {step === "team" && (
          <StepCard>
            <BackLink label="Back" onClick={() => setStep("account")} />
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>Step 2 / 2 — Set Up Your Team</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>Create the top-level workspace that will contain all your projects.</p>
            <div style={{ height: "4px", backgroundColor: "var(--primary-400)", borderRadius: "2px", marginTop: "16px", marginBottom: "20px" }} />

            <FieldLabel>Team / Company Name *</FieldLabel>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onBlur={() => markTouched2("orgName")}
                placeholder="e.g. Universe Corporation"
                style={{ ...inputStyle, flex: 1, border: orgNameError ? "1px solid var(--danger-500)" : inputStyle.border }}
              />
              <button
                onClick={useSuggestedDomain}
                disabled={!email.split("@")[1]}
                style={{
                  width: "91px", height: "40px", borderRadius: "999px", border: "none", flexShrink: 0,
                  backgroundColor: "var(--primary-100)", color: "var(--primary-400)", fontSize: "12px", fontWeight: 700,
                  cursor: email.split("@")[1] ? "pointer" : "not-allowed",
                }}
              >
                {email.split("@")[1] ? `Use ${email.split("@")[1]}` : "Use domain"}
              </button>
            </div>
            {orgNameError
              ? <FieldError text={orgNameError} />
              : <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "6px" }}>Enter an team name → the system will create your workspace automatically</p>}

            <div style={{ marginTop: "16px" }}>
              <FieldLabel>Primary Industry (optional)</FieldLabel>
              <FilterSelect value={industry} onChange={setIndustry}
                options={[{ value: "", label: "Smart City / Smart School / Utilities / Other" }, ...INDUSTRIES.map(i => ({ value: i, label: i }))]} />
            </div>

            <div style={{ backgroundColor: "var(--primary-100)", borderRadius: "10px", padding: "8px 14px", marginTop: "8px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-400)" }}>💡 The domain you select here will be pre-highlighted as the template on the next [Create Project] screen.</p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <FieldLabel>Estimated Channel Count (optional — for billing reference)</FieldLabel>
              <input
                value={channelCount}
                onChange={e => setChannelCount(e.target.value)}
                onBlur={() => markTouched2("channelCount")}
                placeholder="e.g. 200 (optional — you can skip this for now)"
                style={{ ...inputStyle, border: channelCountError ? "1px solid var(--danger-500)" : inputStyle.border }}
              />
              <FieldError text={channelCountError} />
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "16px", cursor: "pointer" }}
              onClick={() => markTouched2("agreedToS")}>
              <span style={{
                width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
                border: tosError ? "1px solid var(--danger-500)" : agreedToS ? "1px solid var(--primary-400)" : BORDER,
                backgroundColor: agreedToS ? "var(--primary-400)" : "white",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "10px", fontWeight: 600,
              }}>
                {agreedToS && "✓"}
              </span>
              <input type="checkbox" checked={agreedToS} onChange={e => setAgreedToS(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>[Required] I agree to the Terms of Service and Privacy Policy.</span>
            </label>
            <FieldError text={tosError} />

            <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "8px", cursor: "pointer" }}>
              <span style={{
                width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
                border: agreedMarketing ? "1px solid var(--primary-400)" : BORDER, backgroundColor: agreedMarketing ? "var(--primary-400)" : "white",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "10px", fontWeight: 600,
              }}>
                {agreedMarketing && "✓"}
              </span>
              <input type="checkbox" checked={agreedMarketing} onChange={e => setAgreedMarketing(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>[Optional] I&apos;d like to receive product updates and marketing emails.</span>
            </label>

            <button
              onClick={handleCompleteSignup}
              style={{
                width: "100%", height: "48px", marginTop: "24px", borderRadius: "999px", border: "none",
                backgroundColor: "var(--gray-900)", color: "white", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", opacity: step2Valid ? 1 : 0.5,
              }}
            >
              Complete Sign Up — Get Started ✓
            </button>
          </StepCard>
        )}

        {step === "done" && (
          <StepCard width={480}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <span style={{
                width: "56px", height: "56px", borderRadius: "28px", backgroundColor: "var(--primary-100)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-400)", fontSize: "24px", fontWeight: 800,
              }}>
                ✓
              </span>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "20px" }}>🎉 Welcome, {fullName || "there"}!</p>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginTop: "12px", lineHeight: "18px" }}>
                Your team has been created.<br />Let&apos;s start your first AI surveillance project.
              </p>
              <div style={{ width: "100%", backgroundColor: "var(--primary-100)", borderRadius: "10px", padding: "11px 0", marginTop: "24px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-400)", textAlign: "center" }}>→ Redirecting automatically to Create First Project</p>
              </div>
              <button
                onClick={goToFirstProject}
                style={{
                  width: "100%", height: "48px", marginTop: "20px", borderRadius: "999px", border: "none",
                  backgroundColor: "var(--gray-900)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                }}
              >
                Start Creating Your Project
              </button>
              <button
                onClick={goToDashboard}
                style={{
                  width: "100%", height: "40px", marginTop: "10px", borderRadius: "999px", border: "none",
                  backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}
              >
                Skip for now — Go to Dashboard
              </button>
            </div>
          </StepCard>
        )}

      </div>
    </div>
  );
}
