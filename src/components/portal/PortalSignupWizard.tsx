"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVcaStore } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { FIELD_STYLE, BORDER, RequiredMark } from "./PortalShared";

type SignupStep = "account" | "team" | "done";

const STEP_PILL_KEYS: (SignupStep | "landing")[] = ["landing", "account", "team", "done"];


const T = {
  en: {
    progress: {
      landing: "Log in",
      account: "Create account",
      team: "Create team",
      done: "Done",
    },
    step1: {
      backToLogin: "Back to sign in",
      title: "Create your account",
      subtitle: "This account becomes your team's admin and receives system notifications.",
      emailLabel: "Email",
      // Placeholders carry no example prefix ("e.g." / "예:") anywhere in the portal: grey text in
      // an empty field already reads as an example, the prefix eats width, and people type it in.
      emailPlaceholder: "name@example.com",
      emailInvalidError: "Enter a valid email address.",
      passwordLabel: "Password",
      passwordPlaceholder: "At least 8 characters",
      passwordError: "Password does not meet the requirements below.",
      passwordReqTitle: "Password requirements",
      passwordReqText: "At least 8 characters · upper and lowercase letters · a number · a symbol (@#$%)",
      confirmLabel: "Confirm password",
      confirmPlaceholder: "Re-enter password",
      confirmError: "Passwords do not match.",
      nameLabel: "Full name",
      namePlaceholder: "Hye Kim",
      nameError: "Enter your full name.",
      continueButton: "Continue",
    },
    step2: {
      back: "Back",
      title: "Create your team",
      subtitle: "Your team holds all of your projects.",
      orgNameLabel: "Team name",
      orgNamePlaceholder: "Universe Corporation",
      useDomain: "Use domain",
      useDomainWithValue: (domain: string) => `Use ${domain}`,
      orgNameError: "Enter a team name of at least 2 characters.",
      orgNameHint: "You can rename it later.",
      domainTemplateHint: "Next, you'll create your first project.",
      channelLabel: "Estimated channels (optional)",
      channelPlaceholder: "200",
      channelError: "Enter a valid number of channels.",
      tosLabel: "I agree to the Terms of Service and Privacy Policy.",
      tosError: "Agree to the Terms of Service to continue.",
      marketingLabel: "I'd like to receive product updates by email.",
      completeButton: "Create team",
    },
    done: {
      title: "Check your email",
      body: (email: string) => `We sent a link to ${email}. Open it to finish setting up your team.`,
      notArrived: "If it hasn't arrived in a few minutes, check your spam folder.",
      backToLogin: "Back to sign in",
    },
  },
  ko: {
    progress: {
      landing: "로그인 / 랜딩",
      account: "1단계 — 계정 생성",
      team: "2단계 — 팀 설정",
      done: "완료 — 시작하기",
    },
    step1: {
      backToLogin: "로그인으로 돌아가기",
      title: "1 / 2단계 — 관리자 계정 생성",
      subtitle: "이 계정이 로그인 ID이자 시스템 알림을 받는 마스터 관리자가 됩니다.",
      emailLabel: "이메일 주소 (로그인 ID)",
      emailPlaceholder: "name@example.com",
      emailInvalidError: "올바른 이메일 주소를 입력해주세요.",
      passwordLabel: "비밀번호",
      passwordPlaceholder: "영문, 숫자, 특수문자 포함 8자 이상",
      passwordError: "영문 대소문자, 숫자, 특수문자를 포함해 8자 이상 입력해주세요.",
      passwordReqTitle: "비밀번호 조건",
      passwordReqText: "영문 대소문자 · 숫자 1개 이상 · 특수문자(@#$%) 1개 이상 · 최소 8자",
      confirmLabel: "비밀번호 확인",
      confirmPlaceholder: "비밀번호를 다시 입력해주세요",
      confirmError: "비밀번호가 일치하지 않습니다.",
      nameLabel: "이름",
      namePlaceholder: "김혜진",
      nameError: "이름을 입력해주세요.",
      continueButton: "계속 — 팀 설정하기 →",
    },
    step2: {
      back: "뒤로",
      title: "2 / 2단계 — 팀 설정",
      subtitle: "모든 프로젝트를 담을 최상위 워크스페이스를 생성합니다.",
      orgNameLabel: "팀 / 회사명",
      orgNamePlaceholder: "유니버스 코퍼레이션",
      useDomain: "도메인 사용",
      useDomainWithValue: (domain: string) => `${domain} 사용`,
      orgNameError: "팀 이름을 입력해주세요 (최소 2자).",
      orgNameHint: "팀 이름을 입력하면 워크스페이스가 자동으로 생성됩니다",
      domainTemplateHint: "다음 단계에서 첫 프로젝트를 만듭니다.",
      channelLabel: "예상 채널 수 (선택 — 청구 참고용)",
      channelPlaceholder: "200 (선택 사항 — 지금은 건너뛰어도 됩니다)",
      channelError: "올바른 채널 수를 입력해주세요.",
      tosLabel: "서비스 이용약관 및 개인정보처리방침에 동의합니다.",
      tosError: "계속하려면 서비스 이용약관에 동의해야 합니다.",
      marketingLabel: "제품 업데이트 소식을 이메일로 받겠습니다.",
      completeButton: "팀 만들기",
    },
    done: {
      title: "메일을 확인해주세요",
      body: (email: string) => `링크를 ${email} 주소로 보냈습니다. 링크를 열면 팀 만들기가 끝납니다.`,
      notArrived: "몇 분 안에 오지 않으면 스팸함을 확인해주세요.",
      backToLogin: "로그인으로 돌아가기",
    },
  },
} as const;



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
  const [lang] = usePortalLanguage();
  const progress = T[lang].progress;
  return (
    <div style={{ display: "flex", gap: "12px", justifyContent: "center", padding: "16px 0" }}>
      {STEP_PILL_KEYS.map(key => {
        const active = key === current;
        return (
          <span key={key} style={{
            fontSize: "10px", fontWeight: 600, padding: "8px 14px", borderRadius: "14px",
            backgroundColor: active ? "var(--primary-400)" : "var(--gray-100)",
            color: active ? "white" : "var(--gray-500)", whiteSpace: "nowrap",
          }}>
            {progress[key]}
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
      width: `${width}px`, maxWidth: "100%", boxSizing: "border-box", padding: "24px 32px 32px",
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>{children}</p>;
}

// Was 40px tall with 13px side padding and a 12px/600 face of its own — every other field in
// Portal is 36px, 12px padding and 13px/400. One shape.
const inputStyle: React.CSSProperties = { ...FIELD_STYLE, color: "var(--gray-900)" };

export default function PortalSignupWizard() {
  const router = useRouter();
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const [step, setStep] = useState<SignupStep>("account");

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [touched, setTouched] = useState<Record<Step1Field, boolean>>({
    email: false, password: false, confirmPassword: false, fullName: false,
  });
  const markTouched = (field: Step1Field) => setTouched(t => ({ ...t, [field]: true }));

  // Step 2
  const [orgName, setOrgName] = useState("");
  const [channelCount, setChannelCount] = useState("");
  const [agreedToS, setAgreedToS] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [touched2, setTouched2] = useState<Record<Step2Field, boolean>>({
    orgName: false, channelCount: false, agreedToS: false,
  });
  const markTouched2 = (field: Step2Field) => setTouched2(t => ({ ...t, [field]: true }));

  const emailFormatValid = isEmailFormatValid(email);
  const passwordValid = isPasswordValid(password);
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;
  const nameValid = fullName.trim().length > 0;
  const step1Valid = emailFormatValid && passwordValid && confirmValid && nameValid;

  const orgNameValid = orgName.trim().length >= 2;
  const channelCountValid = isChannelCountValid(channelCount);
  const step2Valid = orgNameValid && channelCountValid && agreedToS;

  const emailError = touched.email && !emailFormatValid ? t.step1.emailInvalidError : "";
  const passwordError = touched.password && !passwordValid
    ? t.step1.passwordError : "";
  const confirmError = touched.confirmPassword && confirmPassword.length > 0 && !confirmValid
    ? t.step1.confirmError : "";
  const nameError = touched.fullName && !nameValid ? t.step1.nameError : "";

  const orgNameError = touched2.orgName && !orgNameValid ? t.step2.orgNameError : "";
  const channelCountError = touched2.channelCount && !channelCountValid ? t.step2.channelError : "";
  const tosError = touched2.agreedToS && !agreedToS ? t.step2.tosError : "";

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

  /*
   * ONE OUTCOME, WHOEVER TYPED THE ADDRESS.
   *
   * This screen is public, so it cannot say whether an address already has an account — the same
   * leak the login and recovery screens were closed against, and this was the last way in:
   * 「중복 확인」 answered it before a single credential had been submitted, and Continue stayed
   * locked until it was pressed, so the screen made everyone use it.
   *
   * So the team and the account are not made here. Create team sends a link to the address and
   * shows the screen below, and that same screen appears whether the address was free or already
   * taken. The owner of an existing account is the only one who learns anything, in their inbox.
   *
   * Which is why nothing lands in the console any more: there is no account to land in until the
   * link is opened. The screen that link leads to is not drawn — self-signup is off on an
   * on-premise installation, where the first administrators are handed over at install time.
   */
  const completeSignup = () => {
    if (!step2Valid) return;
    setStep("done");
  };

  const handleCompleteSignup = () => {
    setTouched2({ orgName: true, channelCount: true, agreedToS: true });
    if (step2Valid) completeSignup();
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--gray-50)", display: "flex", flexDirection: "column" }}>
      <ProgressPills current={step} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "20px 24px 64px" }}>

        {step === "account" && (
          <StepCard>
            <BackLink label={t.step1.backToLogin} onClick={() => router.push("/login")} />
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>{t.step1.title}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>{t.step1.subtitle}</p>
            <div style={{ height: "4px", backgroundColor: "var(--gray-100)", borderRadius: "2px", marginTop: "16px", marginBottom: "20px" }}>
              <div style={{ height: "4px", width: "50%", backgroundColor: "var(--primary-400)", borderRadius: "2px" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <FieldLabel>{t.step1.emailLabel}<RequiredMark /></FieldLabel>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => markTouched("email")}
                  placeholder={t.step1.emailPlaceholder}
                  style={{ ...inputStyle, border: emailError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={emailError} />
              </div>

              <div>
                <FieldLabel>{t.step1.passwordLabel}<RequiredMark /></FieldLabel>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => markTouched("password")}
                  placeholder={t.step1.passwordPlaceholder}
                  style={{ ...inputStyle, border: passwordError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={passwordError} />
                <div style={{ backgroundColor: "var(--primary-100)", borderRadius: "10px", padding: "8px 14px", marginTop: "6px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-400)" }}>{t.step1.passwordReqTitle}</p>
                  <p style={{ fontSize: "10px", color: "var(--primary-400)", marginTop: "2px" }}>{t.step1.passwordReqText}</p>
                </div>
              </div>

              <div>
                <FieldLabel>{t.step1.confirmLabel}<RequiredMark /></FieldLabel>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched("confirmPassword")}
                  placeholder={t.step1.confirmPlaceholder}
                  style={{ ...inputStyle, border: confirmError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={confirmError} />
              </div>

              <div>
                <FieldLabel>{t.step1.nameLabel}<RequiredMark /></FieldLabel>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onBlur={() => markTouched("fullName")}
                  placeholder={t.step1.namePlaceholder}
                  style={{ ...inputStyle, border: nameError ? "1px solid var(--danger-500)" : inputStyle.border }}
                />
                <FieldError text={nameError} />
              </div>
            </div>

            <button className="portal-btn-primary"
              onClick={handleContinueStep1}
              style={{
                width: "100%", height: "48px", marginTop: "24px", borderRadius: "8px", border: "none",
                backgroundColor: "var(--gray-900)", color: "white", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", opacity: step1Valid ? 1 : 0.5,
              }}
            >
              {t.step1.continueButton}
            </button>
          </StepCard>
        )}

        {step === "team" && (
          <StepCard>
            <BackLink label={t.step2.back} onClick={() => setStep("account")} />
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>{t.step2.title}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>{t.step2.subtitle}</p>
            <div style={{ height: "4px", backgroundColor: "var(--primary-400)", borderRadius: "2px", marginTop: "16px", marginBottom: "20px" }} />

            <FieldLabel>{t.step2.orgNameLabel}<RequiredMark /></FieldLabel>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onBlur={() => markTouched2("orgName")}
                placeholder={t.step2.orgNamePlaceholder}
                style={{ ...inputStyle, flex: 1, border: orgNameError ? "1px solid var(--danger-500)" : inputStyle.border }}
              />
              <button
                onClick={useSuggestedDomain}
                disabled={!email.split("@")[1]}
                style={{
                  minWidth: "91px", height: "40px", borderRadius: "8px", border: "none", flexShrink: 0,
                  padding: "0 12px",
                  backgroundColor: "var(--primary-100)", color: "var(--primary-400)", fontSize: "12px", fontWeight: 700,
                  cursor: email.split("@")[1] ? "pointer" : "not-allowed",
                }}
              >
                {email.split("@")[1] ? t.step2.useDomainWithValue(email.split("@")[1]) : t.step2.useDomain}
              </button>
            </div>
            {orgNameError
              ? <FieldError text={orgNameError} />
              : <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "6px" }}>{t.step2.orgNameHint}</p>}


            <div style={{ backgroundColor: "var(--primary-100)", borderRadius: "10px", padding: "8px 14px", marginTop: "8px" }}>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-400)" }}>{t.step2.domainTemplateHint}</p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <FieldLabel>{t.step2.channelLabel}</FieldLabel>
              <input
                value={channelCount}
                onChange={e => setChannelCount(e.target.value)}
                onBlur={() => markTouched2("channelCount")}
                placeholder={t.step2.channelPlaceholder}
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
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{t.step2.tosLabel}</span>
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
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)" }}>{t.step2.marketingLabel}</span>
            </label>

            <button className="portal-btn-primary"
              onClick={handleCompleteSignup}
              style={{
                width: "100%", height: "48px", marginTop: "24px", borderRadius: "8px", border: "none",
                backgroundColor: "var(--gray-900)", color: "white", fontSize: "14px", fontWeight: 700,
                cursor: "pointer", opacity: step2Valid ? 1 : 0.5,
              }}
            >
              {t.step2.completeButton}
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
              <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "20px" }}>{t.done.title}</p>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginTop: "12px", lineHeight: "18px" }}>
                {t.done.body(email.trim())}
              </p>
              <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "10px", lineHeight: "18px" }}>
                {t.done.notArrived}
              </p>
              <button className="portal-btn-quiet"
                onClick={() => router.push("/login")}
                style={{
                  width: "100%", height: "40px", marginTop: "24px", borderRadius: "8px", border: "none",
                  backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}
              >
                {t.done.backToLogin}
              </button>
            </div>
          </StepCard>
        )}

      </div>
    </div>
  );
}
