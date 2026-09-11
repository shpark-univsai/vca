"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { BadgeCheck, Timer, Cctv } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import AuthTrailArt from "@/components/AuthTrailArt";
import AuthTrailList from "@/components/AuthTrailList";
import { getAuthConfig } from "@/lib/authConfig";
import { EyeIcon, EyeOffIcon, ErrorCircleIcon } from "@/components/AuthIcons";
import { LOGIN_NOTICES, parseLoginNotice, type LoginFailure } from "@/lib/authErrors";
import { canEnterPortal, useVcaStore } from "@/lib/vcaStore";
import { useLanguage } from "@/lib/i18n";

// See the per-file pattern note in lib/i18n.ts. The failure notices are not in here — they live in
// lib/authErrors.ts beside the contract they belong to.
const T = {
  en: {
    title: "Log in",
    welcome: "Welcome to VCA",
    activateWithCode: "Activate with a registration code",
    securityTeam: "Your security operations team",
    identifierWithId: "Employee number or email",
    identifierEmailOnly: "Email",
    password: "Password",
    rememberId: "Remember my employee number",
    rememberEmail: "Remember my email",
    forgot: "Forgot password?",
    capsLock: "Caps Lock is on",
    haveCode: "Have a registration code?",
    activateAccount: "Activate your account",
    useProjectLink: "Open the project link you were sent to request access.",
    askForInvite: "Ask your administrator to send you an invitation.",
    restrictedNetwork: "This system runs on a restricted internal network.",
    panelHeading: "Sightings joined into one person.",
    panelBody: "Start from a photo, or a few conditions. VCA lays out where they passed, in order.",
    // Taken from the product's own pages, where each is stated with the same wording. Figures, not
    // claims — a control room can check every one of them against its own site.
    panelFacts: [
      { icon: "cert", value: "99.97%", label: "KISA-certified accuracy" },
      { icon: "speed", value: "Under 1s", label: "1:N search response" },
      { icon: "camera", value: "2MP", label: "Your existing cameras" },
    ],
    contactNamed: (who: string) => <>For an account or access, contact <strong style={{ color: "var(--gray-500)" }}>{who}</strong>.</>,
    contactGeneric: "For an account or access, contact your security operations team.",
  },
  ko: {
    title: "로그인",
    welcome: "VCA에 오신 것을 환영합니다",
    activateWithCode: "등록 코드로 활성화하기",
    securityTeam: "보안 관제 담당자",
    identifierWithId: "사번 또는 이메일",
    identifierEmailOnly: "이메일",
    password: "비밀번호",
    rememberId: "사번 기억하기",
    rememberEmail: "이메일 기억하기",
    forgot: "비밀번호를 잊으셨나요?",
    capsLock: "Caps Lock이 켜져 있습니다",
    haveCode: "등록 코드가 있으신가요?",
    activateAccount: "계정 활성화하기",
    useProjectLink: "받으신 프로젝트 링크를 열어 접근을 요청해주세요.",
    askForInvite: "관리자에게 초대를 요청해주세요.",
    restrictedNetwork: "이 시스템은 외부와 분리된 내부 전용 네트워크에서 운영됩니다.",
    panelHeading: "흩어진 목격을 한 사람으로.",
    panelBody: "사진 한 장이나 몇 가지 조건에서 시작해, 지나간 순서를 펼쳐 보여줍니다.",
    panelFacts: [
      { icon: "cert", value: "99.97%", label: "KISA 인증 인식률" },
      { icon: "speed", value: "1초 이내", label: "1:N 검색 응답" },
      { icon: "camera", value: "2MP", label: "기존 카메라 그대로" },
    ],
    contactNamed: (who: string) => <>계정이나 접근 권한은 <strong style={{ color: "var(--gray-500)" }}>{who}</strong>에게 문의해주세요.</>,
    contactGeneric: "계정이나 접근 권한은 보안 관제 담당자에게 문의해주세요.",
  },
} as const;

const FIELD_BORDER = "1px solid var(--gray-300)";
/** One icon per figure. Named in the dictionary and resolved here, so the copy stays copy and the
 *  components stay out of the translation table. */
const FACT_ICONS = {
  cert: BadgeCheck,   // certified, not merely measured — the figure's whole weight is the audit
  speed: Timer,       // a response time, so a clock rather than a lightning bolt
  camera: Cctv,       // the hardware the claim is about: the ordinary camera already on the wall
} as const;

const FIELD_LABEL: React.CSSProperties = {
  fontSize: "13px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.26px",
};
/** Only ever holds the identifier. Never the password, never a session token. */
const REMEMBERED_ID_KEY = "vca.rememberedId";

/**
 * HANDOFF NOTE — viewing every state without a backend.
 *
 *   /login?demo=badCredentials   wrong identifier or password
 *   /login?demo=locked           too many failed attempts
 *   /login?demo=suspended        access withdrawn
 *   /login?demo=pendingApproval  waiting for an administrator
 *   /login?demo=notActivated     issued a registration code, never used it
 *   /login?demo=sessionExpired   signed out by the session timing out
 *   /login?demo=signedOut        signed out deliberately
 *
 * Two of these also happen for real against the seeded accounts, because the mock user list
 * already carries a status: wei.chen@univs.ai (EMP-2044) is "invited" and david.ong@univs.ai
 * (EMP-2045) is "suspended". Until this change both of them signed in perfectly happily, which was
 * a real hole. Either identifier reaches them — EMP-2041 is Grace Tan, an admin, so it lands in
 * Portal; EMP-2042 is an operator and lands in the app.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const [lang] = useLanguage();
  const t = T[lang];
  const demo = useSearchParams().get("demo");
  const [notice, setNotice] = useState<LoginFailure | null>(() => parseLoginNotice(demo));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // The failure notice deliberately refuses to say which of the two was wrong — telling someone
  // the account exists confirms it to anyone guessing. Caps Lock is the one hint that can be given
  // without leaking anything, and on a shared control-room keyboard it is the common cause.
  const [capsLock, setCapsLock] = useState(false);
  // Remembers the identifier only, never the password, and never the session. A control room runs
  // shifts on shared workstations, so "keep me logged in" would hand the next person the previous
  // person's account — the saving it offers is one field, the cost is an unattended session.
  const [rememberId, setRememberId] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Restored after mount rather than during render: the server has no localStorage, so seeding
  // useState from it would make the server and client markup disagree. queueMicrotask keeps the
  // write out of the effect body, which the set-state-in-effect rule forbids.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(REMEMBERED_ID_KEY);
        if (saved) {
          setIdentifier(saved);
          setRememberId(true);
          // React's autoFocus only applies at mount, and at mount this value has not been read
          // yet — so the promise below ("password is the field with something left to do") never
          // happened and focus always sat on the identifier. Moved here, where the answer is
          // actually known.
          passwordRef.current?.focus();
        }
      } catch {
        // Private windows and locked-down browser policies throw on access. Nothing to recover —
        // the field simply starts empty, which is the same as never having saved one.
      }
    });
  }, []);

  const authConfig = getAuthConfig();
  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    try {
      if (rememberId) localStorage.setItem(REMEMBERED_ID_KEY, identifier.trim());
      else localStorage.removeItem(REMEMBERED_ID_KEY);
    } catch {
      // Not being able to remember the identifier is not a reason to block the sign-in.
    }

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
    // Matches an email, or an employee number where the deployment allows it — a site with no mail
    // server often has no per-person address either, and the staff roster keys on employee number.
    //
    // Both come off the ACCOUNT. This used to resolve a number through the staff roster and then
    // match the roster row's name against a user, which never once matched — the seeded roster and
    // the seeded accounts are different people — so every employee-number sign-in fell through to
    // the unknown-identifier path below, admins included. The roster is also the wrong place to ask:
    // it is a pre-registration name list whose rows get deleted, and a login that reads it stops
    // working the moment somebody tidies it up.
    const typed = identifier.trim().toLowerCase();
    const state = useVcaStore.getState();
    const matchedUser = state.portalUsers.find(
      u => u.email.toLowerCase() === typed
        || (authConfig.employeeIdLogin && !!u.employeeId && u.employeeId.toLowerCase() === typed)
    );

    // A known account's status decides whether it may sign in at all, and this is checked before
    // the temporary-password branch — a suspended account holding a temporary password should be
    // turned away, not sent on to set a new one. Both of these used to sail straight through:
    // access withdrawn by an administrator, and an account that never set a password.
    if (matchedUser?.status === "suspended") { setNotice("suspended"); return; }
    if (matchedUser?.status === "invited") { setNotice("notActivated"); return; }
    setNotice(null);

    // HANDOFF NOTE: an identifier matching nothing is still let through, so anyone opening this
    // build can look around without being handed a list of seeded accounts. A real login rejects it
    // with "badCredentials" — that state is built, at /login?demo=badCredentials.

    // An account still on an administrator-issued temporary password does not get in — it gets the
    // set-a-password screen first. Otherwise the temporary one silently becomes the real one, and
    // the account stays on a password a second person read out over the phone.
    //
    // HANDOFF NOTE: the real login response carries this flag; the mock reads it off the Portal
    // user the admin issued it to (Users & Permissions -> Reset password). The backend
    // must enforce it as well — this branch only decides where the browser goes next.
    if (matchedUser?.mustChangePassword) {
      router.push(`/password-setup?token=${matchedUser.id}&reason=temp`);
      return;
    }
    // Every console role lands in Portal — owner, admin and the read-only auditor. "operator"
    // means no console at all, so it goes to the monitoring app.
    router.push(matchedUser && canEnterPortal(matchedUser.permission) ? "/portal" : "/");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "white" }}>
      <AuthHeader />
      {/* Two columns from 900px up: the form on the left, the artwork on its own panel to the
          right. It used to sit stacked above the form, which cost the column ~200px of height on
          the one screen everybody uses every shift — and paying for that took three height
          breakpoints in globals.css, the last of which gave up and hid the image entirely below
          820px. A control-room monitor is short and wide, so the space was there sideways all
          along. Kit, Remote and Productboard all place their imagery this way; none of the ten
          reference logins stack it above the form.
          Below 900px the panel is gone and the form has the width to itself. */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        <div className="vca-auth-scroll" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
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
          // 20px of top padding is left over from when the illustration sat above the title
          // inside this card. It is gone, and the card has no visible edge to sit in from — it is
          // white on white — so the padding was only pushing the title down for nothing.
          margin: "auto 0",
          // 40, not 24. The card centres as one block, so widening the gap between the title and
          // the form lifts the title and drops the form in one move — and the form needs the
          // separation more than it needs to sit close to a greeting.
          display: "flex", flexDirection: "column", gap: "40px", alignItems: "center",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", width: "100%" }}>
            {/* lineHeight was 40px on a 26px title — 14px of dead space under a single line, which pushed
                the subtitle away from the word it belongs to. */}
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "var(--gray-800)", letterSpacing: "-0.52px", lineHeight: 1.2 }}>{t.title}</h1>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.28px" }}>{t.welcome}</p>
          </div>

          {/* A real form, so Enter submits from either field. It did not before: the fields had no
              key handler and nothing wrapped them, which meant an operator signing in every shift
              had to reach for the mouse to finish. It also lets a password manager recognise the
              pair and offer to save it. Every button inside that is not the submit carries
              type="button" — otherwise it would submit too. */}
          <form
            onSubmit={e => { e.preventDefault(); handleSubmit(); }}
            style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}
          >
            {/* 20, not 32. Two fields that belong to one act should read as one block; at 32 the
                identifier and the password looked like separate sections and the column ran long
                enough that the illustration had to be hidden on any screen under 820px tall. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Sits above the fields, not under the button: the reason a sign-in failed changes
                  whether retyping is even worth attempting, so it has to be read before the hands
                  go back to the keyboard. "error" for something the operator can act on here,
                  "info" for a state only an administrator can change. */}
              {notice && (
                <div
                  // role="alert", not "status": these say why a sign-in did not happen, which a
                  // screen reader has to hear when it appears rather than whenever it gets round
                  // to the polite queue.
                  role="alert"
                  style={{
                    display: "flex", gap: "10px", alignItems: "flex-start", width: "100%",
                    padding: "14px 16px", borderRadius: "10px", marginBottom: "4px",
                    backgroundColor: LOGIN_NOTICES[notice].tone === "error" ? "var(--danger-100)" : "var(--info-100)",
                  }}
                >
                  <span style={{ display: "flex", flexShrink: 0, marginTop: "1px" }}>
                    <ErrorCircleIcon />
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.26px" }}>
                      {LOGIN_NOTICES[notice].title[lang]}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px", lineHeight: 1.6 }}>
                      {LOGIN_NOTICES[notice].detail[lang]}
                    </p>
                    {/* A dead end otherwise: this person has a code and nowhere on the screen tells
                        them where to use it. */}
                    {notice === "notActivated" && authConfig.registrationCode && (
                      <button
                        type="button"
                        onClick={() => router.push("/register")}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 0 0", fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                      >
                        {t.activateWithCode}
                      </button>
                    )}
                    {(notice === "locked" || notice === "suspended") && (
                      <p style={{ margin: "6px 0 0", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                        {authConfig.supportContact ?? t.securityTeam}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Identifier — email, or an employee number where that is enabled */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                {/* Quieter than the value it labels. At 14/700 the label carried more weight than
                    what the operator types into it, which is backwards — and every reference login
                    form keeps the label secondary. */}
                <label style={FIELD_LABEL}>
                  {authConfig.employeeIdLogin ? t.identifierWithId : t.identifierEmailOnly}
                </label>
                <div className="vca-auth-field" style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <input
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); setNotice(null); }}
                    placeholder={authConfig.employeeIdLogin ? "EMP-2041 or user@email.com" : "user@email.com"}
                    autoComplete="username"
                    // Focused at mount. If an identifier turns out to have been remembered, the
                    // restore above moves focus to the password — the field with something left
                    // to do — as soon as it knows that.
                    autoFocus
                    style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-900)", letterSpacing: "-0.32px" }}
                  />
                </div>
              </div>
              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                {/* "Forgot password?" sits on the label row, not down beside "Remember me". It
                    belongs where the problem occurs — you discover you have forgotten it while
                    looking at this field — and moving it up leaves the row below carrying one
                    thing instead of two competing ones. Stripe and Lyssna both place it here. */}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
                  <label style={FIELD_LABEL}>{t.password}</label>
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px" }}
                  >
                    {t.forgot}
                  </button>
                </div>
                <div className="vca-auth-field" style={{ display: "flex", alignItems: "center", height: "52px", padding: "0 18px", border: FIELD_BORDER, borderRadius: "8px" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setNotice(null); }}
                    onKeyUp={e => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                    onBlur={() => setCapsLock(false)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    ref={passwordRef}
                    style={{ flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: "16px", color: "var(--gray-900)", letterSpacing: "-0.32px" }}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
                {capsLock && (
                  <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--warning-500)", letterSpacing: "-0.22px" }}>
                    <ErrorCircleIcon /> {t.capsLock}
                  </p>
                )}
              </div>
            </div>

            {/* 52 was arbitrary — it pushed the primary action most of a field-height away from
                the form it completes. Every reference form keeps this to one step of the scale. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
              {/* One item, so no space-between row around it any more — "Forgot password?" moved
                  up to the password label. The box is 16, not 20: at 20 it outweighed the 12px
                  label beside it and read as the most important control on the row. */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={e => setRememberId(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--primary-400)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.24px" }}>
                  {authConfig.employeeIdLogin ? t.rememberId : t.rememberEmail}
                </span>
              </label>

              <button
                type="submit"
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
                {t.title}
              </button>
              {/* Which way in to name depends on what this deployment has switched on — see
                  lib/authConfig.ts. Deliberately not called "Sign up": /register does nothing
                  without a code the administrator issued, so it is an activation step, not open
                  registration, and labelling it as sign-up invites people who cannot proceed. */}
              <p style={{ textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.24px", lineHeight: 1.6 }}>
                {authConfig.registrationCode ? (
                  <>
                    {t.haveCode}{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/register")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 700, color: "var(--primary-400)" }}
                    >
                      {t.activateAccount}
                    </button>
                  </>
                ) : authConfig.accessRequest
                  ? t.useProjectLink
                  : t.askForInvite}
              </p>

              {/* Standing notice, not an error. An operator should be able to tell at a glance that
                  this is the internal system and not something reachable from outside, and be able
                  to read who to call without hunting for it — on a closed network that phone number
                  is the entire account-recovery path. */}
              <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: "16px", marginTop: "4px" }}>
                <p style={{ margin: 0, textAlign: "center", fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.24px", lineHeight: 1.7 }}>
                  {t.restrictedNetwork}<br />
                  {authConfig.supportContact
                    ? t.contactNamed(authConfig.supportContact)
                    : t.contactGeneric}
                </p>
              </div>
            </div>
          </form>
        </div>
        </div>

        {/* The panel says what the drawing is. Left as an image alone it read as decoration
            parked in leftover space, and an abstract drawing with no caption asks the viewer to
            guess.
            The words are descriptive, not promotional — the marketing site's copy is aimed at
            someone deciding whether to buy this, and the person on this screen already has it and
            is starting a shift. So it names the mechanism the drawing shows, in the same plain
            terms the product's own pages use, and claims nothing.
            aria-hidden covers the whole panel: a screen reader should land on the form, and the
            heading here is a caption for a picture it cannot see. */}
        <div className="vca-auth-brand" aria-hidden>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", maxWidth: "640px" }}>
            {/* The trail and the list are the same four cameras, numbered the same — one shows
                where, the other in what order and how long between. The list is the first thing
                dropped when the panel narrows: the drawing carries the idea alone, a list of
                elapsed gaps beside nothing does not. */}
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <AuthTrailArt className="vca-auth-brand-art" />
              <AuthTrailList className="vca-auth-brand-list" />
            </div>
            {/* Measure capped so the two lines wrap into a block instead of running the panel's
                full width — a hundred characters a line is a paragraph, and this is a caption. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center", maxWidth: "360px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.32px", lineHeight: 1.5 }}>
                {t.panelHeading}
              </p>
              {/* Grey, not primary. The purple on this panel belongs to the three marks — that is
                  the whole point of the drawing, and copy in the same colour would take it. */}
              {/* 1.55, not 1.8. At two short lines the wider leading pulled them apart and they
                  stopped reading as one sentence. */}
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.26px", lineHeight: 1.55 }}>
                {t.panelBody}
              </p>

            </div>

            {/* Three figures, quiet, under a hairline.
                This is what "appeal" means for an institution. Every reference login that fills
                this panel is selling to somebody who might churn or upgrade — a feature
                announcement, a testimonial, customer logos. Nobody in a control room chose this
                product and there is nothing to upsell them. What does carry weight in public
                procurement is what the system is certified for and what it runs on, and both are
                checkable rather than persuasive.
                The figures carry the primary colour; the icon and the label beside them stay
                grey. Three short strings is a small enough share that the cameras keep being the
                loudest purple on the panel, and it puts the emphasis on the part that is
                checkable — 99.97%, not the word "accuracy". */}
            {/* One row, never two. Sitting inside the caption's 360px measure it wrapped the
                third figure onto its own line, which read as an afterthought rather than as one
                set of three. Out here it takes the panel's width and the labels are short enough
                to hold. */}
            <div style={{ display: "flex", gap: "34px", justifyContent: "center", flexWrap: "nowrap", paddingTop: "22px", borderTop: "1px solid var(--line)", alignSelf: "stretch" }}>
              {t.panelFacts.map(fact => {
                const Icon = FACT_ICONS[fact.icon];
                return (
                <div key={fact.value} style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "center" }}>
                  {/* Above the figure, and grey — it says which kind of fact this is at a glance
                      without competing with the number, which is the thing worth reading. */}
                  <Icon size={15} strokeWidth={2} color="var(--gray-400)" />
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--primary-400)", letterSpacing: "-0.32px" }}>
                    {fact.value}
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.2px" }}>
                    {fact.label}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
