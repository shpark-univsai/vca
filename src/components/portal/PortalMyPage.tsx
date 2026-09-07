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
    roles: { owner: "Owner", admin: "Admin", auditor: "Auditor", none: "No portal access" } as Record<string, string>,
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
    roles: { owner: "최고관리자", admin: "관리자", auditor: "감사자", none: "포털 접근 없음" } as Record<string, string>,
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
 * (name, address, role, doors) is plain read-only text, never a field that looks editable and then
 * is not — which is also why it carries no note explaining that: the rows have no controls on
 * them, so there is nothing to explain.
 */
export default function PortalMyPage() {
  const [lang, setLang] = useLanguage();
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const me = currentPortalUser(portalUsers);
  const myTeam = me ? teams.find(tm => tm.id === me.teamId) : undefined;

  const accountRows: { label: string; value: string }[] = [
    { label: t.name, value: me?.name ?? SIGNED_IN_USER.name },
    { label: t.email, value: me?.email ?? SIGNED_IN_USER.email },
    ...(me ? [
      { label: t.portalRole, value: t.roles[me.permission] ?? me.permission },
      { label: t.appAccess, value: canEnterApp(me) ? t.appYes : t.appNo },
      ...(myTeam ? [{ label: t.team, value: myTeam.name }] : []),
    ] : []),
  ];

  return (
    /**
     * Capped and centred, the way the licence page is: both are a short column of label-and-value
     * rows rather than a table, and stretched across a monitor a value ends up a hand's width from
     * its label. `margin-inline: auto` splits the spare width evenly and lets the two margins
     * shrink together to nothing as the window narrows — no media query.
     *
     * Narrower than the licence page's 900px because there is less in each row here; it is the same
     * rule, not the same number.
     */
    <div style={{ maxWidth: "720px", marginInline: "auto" }}>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>{t.subtitle}</p>

      {/* Rows built as a list so the last one can drop its divider — a rule at the foot of the
          card would just be a line above the padding. Which rows exist depends on whether the
          signed-in address matches an account: with no match there is nothing to say about a role
          or a door, so those rows are absent rather than filled with a disclaimer. */}
      <Card>
        <CardTitle>{t.accountTitle}</CardTitle>
        {accountRows.map((r, i) => (
          <Row key={r.label} label={r.label} value={r.value} divider={i < accountRows.length - 1} />
        ))}
      </Card>

      <Card>
        <CardTitle>{t.displayTitle}</CardTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", paddingTop: "12px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)" }}>{t.language}</p>
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
function Row({ label, value, divider }: { label: string; value: string; divider: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px",
      borderBottom: divider ? BORDER : "none", padding: "12px 0",
    }}>
      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
