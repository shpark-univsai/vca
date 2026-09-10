"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import { ErrorCircleIcon } from "@/components/AuthIcons";
import { isMailDeliverable, resolveMailConfig, useVcaStore } from "@/lib/vcaStore";
import { getAuthConfig } from "@/lib/authConfig";
import { redirect } from "next/navigation";
import { useLanguage } from "@/lib/i18n";


// See the per-file pattern note in lib/i18n.ts.
const T = {
  en: {
    errName: "Enter your name.",
    errEmail: "Enter a valid email address.",
    errAlreadyHasAccess: "This email already has access to this project — log in instead.",
    errAlreadyRequested: "A request from this email is already waiting for approval.",
    errDomain: (domain: string) => `Use your @${domain} address — invitations can only be sent to that domain.`,
    sentTitle: "Request sent",
    sentReview: "Your administrator will review it.",
    sentInvite: "If it is approved you will get an invitation at",
    backToLogin: "Back to log in",
    title: "Request access",
    subtitle: "You do not have permission for this project yet",
    project: "Project",
    noProject: "Not specified — open the link you were given again",
    name: "Name",
    namePlaceholder: "Alexander Wright",
    email: "Email",
    inviteHereDomain: (domain: string) => `Your invitation will be sent here — use your @${domain} address.`,
    inviteHere: "Your invitation will be sent here.",
    reason: "Reason",
    optional: "(optional)",
    reasonPlaceholder: "What do you need access for?",
    send: "Send request",
    haveAccess: "Already have access?",
    logIn: "Log in",
  },
  ko: {
    errName: "이름을 입력해주세요.",
    errEmail: "올바른 이메일 주소를 입력해주세요.",
    errAlreadyHasAccess: "이 이메일은 이미 이 프로젝트에 접근할 수 있습니다. 로그인해주세요.",
    errAlreadyRequested: "이 이메일로 접수된 요청이 이미 승인을 기다리고 있습니다.",
    errDomain: (domain: string) => `@${domain} 주소를 사용해주세요. 초대는 이 도메인으로만 보낼 수 있습니다.`,
    sentTitle: "요청을 보냈습니다",
    sentReview: "관리자가 검토합니다.",
    sentInvite: "승인되면 다음 주소로 초대가 발송됩니다:",
    backToLogin: "로그인으로 돌아가기",
    title: "접근 요청",
    subtitle: "이 프로젝트에 대한 권한이 아직 없습니다",
    project: "프로젝트",
    noProject: "지정되지 않았습니다 — 받으신 링크를 다시 열어주세요",
    name: "이름",
    namePlaceholder: "홍길동",
    email: "이메일",
    inviteHereDomain: (domain: string) => `이 주소로 초대가 발송됩니다. @${domain} 주소를 사용해주세요.`,
    inviteHere: "이 주소로 초대가 발송됩니다.",
    reason: "사유",
    optional: "(선택)",
    reasonPlaceholder: "어떤 용도로 접근이 필요하신가요?",
    send: "요청 보내기",
    haveAccess: "이미 접근 권한이 있으신가요?",
    logIn: "로그인",
  },
} as const;
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
 *
 * Closed by authConfig.accessRequest, like /signup is by selfSignup. Login only hid the link,
 * which left the route open: typing the URL rendered the form, submitting it wrote a real record
 * into the master's approval queue through a flow the product decided not to have — and the email
 * field answered "this address already has access to this project" to anyone who typed one, which
 * is exactly the account-existence question /login and /forgot-password refuse to answer.
 *
 * HANDOFF NOTE: this closes the screen, not the hole. The backend must refuse the same call.
 */
export default function RequestAccessPage() {
  if (!getAuthConfig().accessRequest) redirect("/login");
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
  const [lang] = useLanguage();
  const t = T[lang];
  // Which project was being opened when the guard turned this person away. Read-only here — they
  // are asking for the thing the link pointed at, not shopping for a project, and letting them
  // choose would mean the master has to second-guess the answer on every approval.
  const projectId = useSearchParams().get("project") ?? "";
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
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
  // Refused here rather than after approval. On an internet-separated network the mail server can
  // only deliver inside its own domain, so an outside address means the master approves, the invite
  // is sent, and it goes nowhere — the requester waits forever on something that already happened.
  // `projects`/`teams` come from the store above, so the hint below follows a domain an
  // admin sets while this page is open.
  const { mailDomain } = resolveMailConfig(projectId, projects, teams);
  const undeliverable = emailValid && !isMailDeliverable(email, mailDomain);

  const nameError = touched.name && !nameValid ? t.errName : "";
  const emailError = !touched.email ? ""
    : !emailValid ? t.errEmail
    : alreadyHasAccess ? t.errAlreadyHasAccess
    : alreadyRequested ? t.errAlreadyRequested
    : undeliverable && mailDomain ? t.errDomain(mailDomain)
    : "";

  const canSubmit = nameValid && emailValid && !alreadyHasAccess && !alreadyRequested && !undeliverable && !!projectId;

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

          {submitted ? (
            /* Says who has it and what happens next, rather than a bare "Submitted". The wait is
               on a person, so the screen should name that person's role and the channel the answer
               arrives on — otherwise the requester has no idea whether to keep the tab open. */
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>{t.sentTitle}</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center", lineHeight: 1.6 }}>
                  {t.sentReview}<br />
                  {t.sentInvite} <strong style={{ color: "var(--gray-800)" }}>{email.trim()}</strong>
                </p>
              </div>
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
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: "40px" }}>{t.title}</h1>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px", textAlign: "center" }}>
                  {t.subtitle}
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
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}>{t.project}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: project ? "var(--gray-900)" : "var(--warning-500)", letterSpacing: "-0.26px", textAlign: "right" }}>
                    {project ? project.name : t.noProject}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                  {/* Name */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.name}</label>
                    <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px",
                      border: nameError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={() => setTouched(t => ({ ...t, name: true }))}
                        placeholder={t.namePlaceholder}
                        style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                      />
                    </div>
                    <FieldError text={nameError} />
                  </div>

                  {/* Email — this is also where the invitation will be sent, so it is worth saying
                      so under the field rather than letting someone use a throwaway address. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.email}</label>
                    <div style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px",
                      border: emailError ? "1px solid var(--danger-400)" : FIELD_BORDER, borderRadius: "8px" }}>
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onBlur={() => setTouched(t => ({ ...t, email: true }))}
                        placeholder="user@email.com"
                        style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-900)", letterSpacing: "-0.35px" }}
                      />
                    </div>
                    {emailError
                      ? <FieldError text={emailError} />
                      : <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.24px" }}>
                          {/* Says the constraint before it is broken. Finding out only on submit
                              means retyping an address you had no way to know was wrong. */}
                          {mailDomain ? t.inviteHereDomain(mailDomain) : t.inviteHere}
                        </p>}
                  </div>

                  {/* Optional, and labelled as such — the master approves or declines on who you
                      are and which project, and a required essay field only delays the request. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>
                      {t.reason} <span style={{ fontWeight: 600, color: "var(--gray-400)" }}>{t.optional}</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={3}
                      placeholder={t.reasonPlaceholder}
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
                      height: "52px", width: "100%", border: "none", borderRadius: "8px",
                      backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-100)",
                      color: canSubmit ? "white" : "var(--gray-400)",
                      fontSize: "16px", fontWeight: 800, letterSpacing: "-0.32px",
                      cursor: canSubmit ? "pointer" : "default",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                  >
                    {t.send}
                  </button>
                  <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                    {t.haveAccess}{" "}
                    <button
                      onClick={() => router.push("/login")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      {t.logIn}
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
