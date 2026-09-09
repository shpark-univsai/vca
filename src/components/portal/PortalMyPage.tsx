"use client";

import { Building2, Clock, Globe, Languages, LayoutGrid, LogIn, Mail, MapPin, Shield, User } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/lib/i18n";
import { useVcaStore, currentPortalUser, canEnterApp, SIGNED_IN_USER } from "@/lib/vcaStore";
import { CARD_BORDER, PANEL_SHADOW, FilterSelect, TYPE_META } from "./PortalShared";
import { PROJECT_TIME_ZONE } from "@/lib/time";

const T = {
  en: {
    accountTitle: "Account",
    name: "Name",
    email: "Email address",
    portalRole: "Portal role",
    appAccess: "App access",
    appYes: "Has the monitoring app",
    appNo: "Portal only",
    team: "Team",
    projectTitle: "Project",
    projectName: "Name",
    projectType: "Type",
    projectTeam: "Team",
    projectRegion: "Region",
    projectTimeZone: "Time zone",
    timeZoneNote: "Days, hours and \"today\" on every screen are counted in this zone — for everyone who opens this project, wherever they are.",
    displayTitle: "Display",
    language: "Interface language",
    roles: { owner: "Owner", admin: "Admin", auditor: "Auditor", none: "No portal access" } as Record<string, string>,
  },
  ko: {
    accountTitle: "계정",
    name: "이름",
    email: "이메일",
    portalRole: "포털 역할",
    appAccess: "앱 접근",
    appYes: "모니터링 앱 사용",
    appNo: "포털만",
    team: "팀",
    projectTitle: "프로젝트",
    projectName: "이름",
    projectType: "유형",
    projectTeam: "팀",
    projectRegion: "지역",
    projectTimeZone: "시간대",
    timeZoneNote: "모든 화면의 날짜와 시각, \"오늘\"의 기준이 이 시간대로 계산됩니다 — 어디서 열든, 누가 열든 이 프로젝트에 대해서는 같습니다.",
    displayTitle: "표시",
    language: "화면 언어",
    roles: { owner: "최고관리자", admin: "관리자", auditor: "감사자", none: "포털 접근 없음" } as Record<string, string>,
  },
} as const;

/**
 * The zones this product is actually deployed in, not every zone the browser knows.
 *
 * A list of 400 IANA names is a search problem; these are the countries VCA sells into plus UTC as
 * the escape hatch for a site that reports in it. Each label carries the offset because "Asia/
 * Jakarta" means nothing to somebody choosing between it and "Asia/Bangkok" — they are the same
 * clock, and a reader picking a timezone is picking an offset with a city's name on it.
 * Add to this list rather than switching to a full picker; a wrong timezone here is silently wrong
 * data everywhere, so a short list of the right answers beats a long list of all of them.
 */
const TIME_ZONE_OPTIONS = [
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Jakarta", label: "Jakarta (UTC+7)" },
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (UTC+8)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "UTC", label: "UTC" },
];

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
export default function PortalMyPage({ projectId }: { projectId: string }) {
  const [lang, setLang] = useLanguage();
  const t = T[lang];
  const portalUsers = useVcaStore(s => s.portalUsers);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  const setProjectTimeZone = useVcaStore(s => s.setProjectTimeZone);
  const project = projects.find(p => p.id === projectId);
  const projectTeam = project ? teams.find(tm => tm.id === project.teamId) : undefined;
  const me = currentPortalUser(portalUsers);
  const myTeam = me ? teams.find(tm => tm.id === me.teamId) : undefined;

  const accountPairs: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: t.name, value: me?.name ?? SIGNED_IN_USER.name, icon: <User size={11} strokeWidth={2.2} /> },
    { label: t.email, value: me?.email ?? SIGNED_IN_USER.email, icon: <Mail size={11} strokeWidth={2.2} /> },
    ...(me ? [
      { label: t.portalRole, value: t.roles[me.permission] ?? me.permission, icon: <Shield size={11} strokeWidth={2.2} /> },
      { label: t.appAccess, value: canEnterApp(me) ? t.appYes : t.appNo, icon: <LogIn size={11} strokeWidth={2.2} /> },
      ...(myTeam ? [{ label: t.team, value: myTeam.name, icon: <Building2 size={11} strokeWidth={2.2} /> }] : []),
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
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      {/* Rows built as a list so the last one can drop its divider — a rule at the foot of the
          card would just be a line above the padding. Which rows exist depends on whether the
          signed-in address matches an account: with no match there is nothing to say about a role
          or a door, so those rows are absent rather than filled with a disclaimer. */}
      <Card>
        <CardTitle>{t.accountTitle}</CardTitle>
        <Pairs>
          {accountPairs.map(r => <Pair key={r.label} label={r.label} icon={r.icon}>{r.value}</Pair>)}
        </Pairs>
      </Card>

      {/*
        The project, and the one setting that belongs to it.

        This card is on the account screen because Portal has no project-settings screen yet, and
        it is fenced off as "Project" so nobody reads a site's timezone as a personal preference —
        it is not one. A timezone belongs to the place: the site sits in one country and its "today"
        is that country's, whoever is looking and from where. That is also why the note under the
        select says so out loud, and why this changing is written to the audit log.

        HANDOFF: when a project-settings screen exists (its natural home, alongside retention and
        the licence), this card moves there whole and My page goes back to being the account only.
      */}
      {project && (
        <Card>
          <CardTitle>{t.projectTitle}</CardTitle>
          <Pairs>
            <Pair label={t.projectName} icon={<MapPin size={11} strokeWidth={2.2} />}>{project.name}</Pair>
            <Pair label={t.projectType} icon={<LayoutGrid size={11} strokeWidth={2.2} />}>{TYPE_META[project.type].label}</Pair>
            {projectTeam && <Pair label={t.projectTeam} icon={<Building2 size={11} strokeWidth={2.2} />}>{projectTeam.name}</Pair>}
            {projectTeam?.region && <Pair label={t.projectRegion} icon={<Globe size={11} strokeWidth={2.2} />}>{projectTeam.region}</Pair>}
            {/* The one editable pair on the card, in the same shape as the four above it: the
                control sits where a value would, rather than being pushed to the far right of a
                ruled row. A setting is a value you can change, and it should look like the values
                it sits with. */}
            <Pair label={t.projectTimeZone} icon={<Clock size={11} strokeWidth={2.2} />}>
              <FilterSelect
                value={project.timeZone ?? PROJECT_TIME_ZONE}
                onChange={zone => setProjectTimeZone(project.id, zone)}
                options={TIME_ZONE_OPTIONS}
                fitContent
              />
            </Pair>
          </Pairs>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "14px" }}>{t.timeZoneNote}</p>
        </Card>
      )}

      <Card>
        <CardTitle>{t.displayTitle}</CardTitle>
        <Pairs>
          <Pair label={t.language} icon={<Languages size={11} strokeWidth={2.2} />}>
            {/* Each language named in its own script — the one label a person who cannot read the
                current interface still recognises. */}
            <FilterSelect
              value={lang}
              onChange={v => setLang(v as AppLanguage)}
              options={LANGUAGE_OPTIONS}
              fitContent
            />
          </Pair>
        </Pairs>
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

/**
 * Two columns of label-above-value pairs, the shape the camera sheet uses.
 *
 * It was one ruled row per fact, label left and value right — five rules in the first card alone,
 * and on a 720px column the value ended up a hand's width from the word naming it. Stacking the
 * pair puts the two together, and two columns halve the height, so the rules have nothing left to
 * separate: whitespace does it.
 */
function Pairs({ children }: { children: React.ReactNode }) {
  return (
    /* Two, fixed — not auto-fit. Letting the track count follow the width gave the project card
       three columns and the account card two on the same screen, so two cards on one page laid
       their pairs out on different grids. The camera sheet this comes from is two as well. */
    <div className="portal-pairs" style={{ display: "grid", gap: "16px 20px", marginTop: "16px" }}>
      {children}
    </div>
  );
}

/**
 * One fact, or one setting.
 *
 * 11px icon at stroke 2.2 — a 1.0px line, thinner than the 1.4px Portal draws elsewhere, because
 * this mark sits beside an 11px caption rather than 13px text and has to match its weight as well
 * as its height. Same reasoning as the camera sheet, where this pattern comes from.
 */
function Pair({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", lineHeight: "14px", color: "var(--gray-500)" }}>
        <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}>{icon}</span>
        {label}
      </p>
      {typeof children === "string"
        ? <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px", wordBreak: "break-word" }}>{children}</p>
        : <div style={{ marginTop: "4px" }}>{children}</div>}
    </div>
  );
}
