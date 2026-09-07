"use client";

import { useLanguage, type AppLanguage } from "@/lib/i18n";
import { useVcaStore, currentPortalUser, canEnterApp, SIGNED_IN_USER } from "@/lib/vcaStore";
import { BORDER, CARD_BORDER, PANEL_SHADOW, FilterSelect } from "./PortalShared";

const T = {
  en: {
    title: "My page",
    subtitle: "Your account in this console, and how it is displayed.",
    accountTitle: "Account",
    name: "Name",
    email: "Email address",
    portalRole: "Portal role",
    appAccess: "App access",
    appYes: "Has the monitoring app",
    appNo: "Portal only",
    team: "Team",
    displayTitle: "Display",
    language: "Interface language",
    languageHint: "Applies to Portal and to the monitoring app.",
    readOnlyNote: "Name, address and role are set by an administrator on the Users & Permissions page.",
    roles: { owner: "Owner", admin: "Admin", auditor: "Auditor", none: "No portal access" } as Record<string, string>,
    noAccount: "This address is not on any account list in this install, so there is nothing to show but the name you are signed in with.",
  },
  ko: {
    title: "마이페이지",
    subtitle: "이 콘솔에서의 내 계정과 표시 설정입니다.",
    accountTitle: "계정",
    name: "이름",
    email: "이메일",
    portalRole: "포털 역할",
    appAccess: "앱 접근",
    appYes: "모니터링 앱 사용",
    appNo: "포털만",
    team: "팀",
    displayTitle: "표시",
    language: "화면 언어",
    languageHint: "포털과 모니터링 앱에 함께 적용됩니다.",
    readOnlyNote: "이름·이메일·역할은 관리자가 사용자 및 권한 페이지에서 설정합니다.",
    roles: { owner: "최고관리자", admin: "관리자", auditor: "감사자", none: "포털 접근 없음" } as Record<string, string>,
    noAccount: "이 이메일이 이 설치의 계정 목록에 없어서, 로그인한 이름 외에 보여줄 것이 없습니다.",
  },
} as const;

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
];

/**
 * Portal's own account screen.
 *
 * Not the app's My page. The app has one at /mypage, and it is about the app — map alert
 * thresholds, sign-in sessions. This is the same idea for the console: who you are HERE, what this
 * console lets you do, and the one preference that is genuinely a preference.
 *
 * Everything on it is either read off the store or actually writes it. What an administrator sets
 * (name, address, role, doors) is shown as read-only text with a line saying where it is set, not
 * as a field that looks editable and then is not.
 */
export default function PortalMyPage() {
  const [lang, setLang] = useLanguage();
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const me = currentPortalUser(portalUsers);
  const myTeam = me ? teams.find(tm => tm.id === me.teamId) : undefined;

  return (
    <div style={{ maxWidth: "720px" }}>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>{t.subtitle}</p>

      <Card>
        <CardTitle>{t.accountTitle}</CardTitle>
        <Row label={t.name} value={me?.name ?? SIGNED_IN_USER.name} />
        <Row label={t.email} value={me?.email ?? SIGNED_IN_USER.email} />
        {me ? (
          <>
            <Row label={t.portalRole} value={t.roles[me.permission] ?? me.permission} />
            <Row label={t.appAccess} value={canEnterApp(me) ? t.appYes : t.appNo} />
            {myTeam && <Row label={t.team} value={myTeam.name} />}
          </>
        ) : (
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, paddingTop: "12px" }}>{t.noAccount}</p>
        )}
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, paddingTop: "14px" }}>{t.readOnlyNote}</p>
      </Card>

      <Card>
        <CardTitle>{t.displayTitle}</CardTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", paddingTop: "12px" }}>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)" }}>{t.language}</p>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>{t.languageHint}</p>
          </div>
          {/* Each language named in its own script — the one label a person who cannot read the
              current interface still recognises. */}
          <FilterSelect
            value={lang}
            onChange={v => setLang(v as AppLanguage)}
            options={LANGUAGE_OPTIONS}
            fitContent
          />
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW,
      padding: "20px", marginBottom: "12px",
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{children}</p>;
}

/** Label left, value right, one per line — the same read-only pairing the licence card uses. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px",
      borderBottom: BORDER, padding: "12px 0",
    }}>
      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
