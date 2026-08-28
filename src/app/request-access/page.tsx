"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { PersonFieldIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { useVcaStore } from "@/lib/vcaStore";

const FIELD_BORDER = "1px solid var(--gray-300)";

/**
 * "Request access" — the entry point for someone who followed a link into a project they have no
 * permission for. It sits out here beside /login and /password-setup, NOT inside Portal: Portal is
 * the admin surface, and the person filling this in is by definition someone who cannot get into
 * it. The other half of this flow — the master's queue of incoming requests, and approving them
 * individually or in bulk — already lives in Portal's Users & Permissions.
 *
 * Nothing routes here yet. Reaching it requires a route guard noticing "no permission", and no
 * route in the app is gated at all until the session model lands (see the handoff note in
 * src/app/login/page.tsx). The screen is built now so that wiring is the only step left.
 */
export default function RequestAccessPage() {
  return (
    <Suspense fallback={null}>
      <RequestAccessForm />
    </Suspense>
  );
}

function isEmailFormatValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function RequestAccessForm() {
  const router = useRouter();
  // Which project was being opened when the guard turned this person away. Read-only here — they
  // are asking for the thing the link pointed at, not shopping for a project, and letting them
  // choose would mean the master has to second-guess the answer on every approval.
  const projectId = useSearchParams().get("project") ?? "";
  const projects = useVcaStore(s => s.projects);
  const project = projects.find(p => p.id === projectId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false });
  const [submitted, setSubmitted] = useState(false);

  const nameValid = name.trim().length > 0;
  const emailValid = isEmailFormatValid(email);

  // Two states worth catching before creating a record, because both leave the requester waiting
  // on an approval that will never come: they already have access, or they already asked.
  const existingUser = useVcaStore(s => s.portalUsers).find(
    u => u.email.toLowerCase() === email.trim().toLowerCase(),
  );
  const alreadyHasAccess = !!existingUser && !!projectId && existingUser.projectIds.includes(projectId);
  const alreadyRequested = useVcaStore(s => s.accessRequests).some(
    r => r.email.toLowerCase() === email.trim().toLowerCase() && r.projectId === projectId,
  );

  const nameError = touched.name && !nameValid ? "Enter your name." : "";
  const emailError = !touched.email ? ""
    : !emailValid ? "Enter a valid email address."
    : alreadyHasAccess ? "This email already has access to this project — log in instead."
    : alreadyRequested ? "A request from this email is already waiting for approval."
    : "";

  const canSubmit = nameValid && emailValid && !alreadyHasAccess && !alreadyRequested && !!projectId;

  const handleSubmit = () => {
    setTouched({ name: true, email: true });
    if (!canSubmit) return;
    useVcaStore.getState().requestAccess({
      name: name.trim(),
      email: email.trim(),
      projectId,
      reason: reason.trim() || undefined,
    });
    setSubmitted(true);
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

          {submitted ? (
            /* Says who has it and what happens next, rather than a bare "Submitted". The wait is
               on a person, so the screen should name that person's role and the channel the answer
               arrives on — otherwise the requester has no idea whether to keep the tab open. */
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Request sent</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
                  Your administrator will review it.<br />
                  If it is approved you will get an invitation at <strong style={{ color: "var(--gray-800)" }}>{email.trim()}</strong>.
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
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>Request access</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center" }}>
                  You do not have permission for this project yet
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>

                {/* The project reads as a fact of the request, not a field — hence the filled row
                    rather than an input. When the link carries no project the form cannot produce
                    an approvable request, so it says that instead of failing on submit. */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  padding: "12px 14px", borderRadius: "8px",
                  backgroundColor: project ? "var(--gray-50)" : "var(--warning-100)",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>Project</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: project ? "var(--gray-900)" : "var(--warning-500)", letterSpacing: "-0.26px", textAlign: "right" }}>
                    {project ? project.name : "Not specified — open the link you were given again"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {/* Name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Name</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px",
                      border: nameError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                      <PersonFieldIcon />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => setTouched(t => ({ ...t, name: true }))}
                        placeholder="Your full name"
                        style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                      />
                    </div>
                    <FieldError text={nameError} />
                  </div>

                  {/* Email — this is also where the invitation will be sent, so it is worth saying
                      so under the field rather than letting someone use a throwaway address. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>Email</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "48px", padding: "8px",
                      border: emailError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                      <PersonFieldIcon />
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onBlur={() => setTouched(t => ({ ...t, email: true }))}
                        placeholder="user@email.com"
                        style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                      />
                    </div>
                    {emailError
                      ? <FieldError text={emailError} />
                      : <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.24px" }}>
                          Your invitation will be sent here.
                        </p>}
                  </div>

                  {/* Optional, and labelled as such — the master approves or declines on who you
                      are and which project, and a required essay field only delays the request. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>
                      Reason <span style={{ fontWeight: 600, color: "var(--gray-400)" }}>(optional)</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={3}
                      placeholder="What do you need access for?"
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "12px", border: FIELD_BORDER, borderRadius: "8px",
                        outline: "none", resize: "none", fontSize: "14px", color: "var(--gray-900)",
                        letterSpacing: "-0.35px", fontFamily: "inherit", lineHeight: 1.6,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
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
                    Send request
                  </button>
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    Already have access?{" "}
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

function FieldError({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--danger-400)", letterSpacing: "-0.24px" }}>
      <ErrorCircleIcon /> {text}
    </p>
  );
}
