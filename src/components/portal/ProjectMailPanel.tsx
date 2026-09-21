"use client";

/**
 * A SITE'S MAIL AND WHETHER IT CAN REACH THE INTERNET.
 *
 * This lived as a tab of the Server & API screen, beside a list of recording and analytics nodes,
 * and it was the wrong room (owner, 2026-09-21: 서버엔 api화면에서는 다른 서비스들과 다르게
 * 어색하게 들어가있는거 있음). Two reasons, one from the products and one from our own console:
 *
 *   - MILESTONE keeps the mail server and the network settings in Tools → Options, a system
 *     settings dialog, while the recording servers are their own node in the tree. Two places.
 *     Genetec does the same split (email under the System task, servers and roles elsewhere).
 *   - OUR OWN settings screen already held Team mail — SMTP host, port, from address, TLS — and
 *     its own hint pointed at the server tab for the per-project override. One subject, two
 *     screens, one of them named after machines.
 *
 * So the panel moved to Settings, directly under the team default it overrides. Nothing about the
 * behaviour changed: the network override still decides the invite transport (InviteUserModal
 * reads it through isNetworkIsolated), and a project with no mail anywhere still says so.
 */

import { useState } from "react";
import { Globe, Mail } from "lucide-react";
import { isNetworkIsolated, resolveMailConfig, useVcaStore } from "@/lib/vcaStore";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { portProblem } from "@/lib/fieldChecks";
import { BORDER, CARD_BORDER, CARD_RADIUS, PANEL_SHADOW, Switch, usePortalEditAccess } from "./PortalShared";

function MailIcon() { return <Mail size={18} strokeWidth={1.87} />; }

function NetworkIcon() { return <Globe size={18} strokeWidth={1.87} />; }

const NETWORK_T = {
  en: {
    heading: "Network reachability",
    desc: "Decides whether invites go out by external email or this project's internal mailbox.",
    isolated: "Isolated", connected: "Connected",
    autoDetected: "Auto-detected via outbound ping:",
    noResponse: "No response (isolated)", reachable: "Reachable",
    switchLabel: "Internet-isolated",
    switchDesc: "Off means this site can reach the internet, so invites go out by external email. On routes them through the project's internal mailbox instead.",
    followingDetection: "Following auto-detection.",
    overriddenIsolated: "Set manually to isolated, overriding auto-detection.",
    overriddenConnected: "Set manually to connected, overriding auto-detection.",
    revertToDetection: "Use auto-detection",
    overrideWhy: "A firewall or security policy can make the ping check unreliable, so the switch always wins over what was detected.",
  },
  ko: {
    heading: "네트워크 연결 상태",
    desc: "초대장이 외부 이메일로 발송될지, 이 프로젝트의 내부 메일함으로 발송될지를 결정합니다.",
    isolated: "격리됨", connected: "연결됨",
    autoDetected: "외부 핑(ping)을 통한 자동 감지:",
    noResponse: "응답 없음(격리됨)", reachable: "연결 가능",
    switchLabel: "인터넷 격리",
    switchDesc: "꺼두면 이 사이트가 인터넷에 도달할 수 있다는 뜻이고, 초대장이 외부 이메일로 나갑니다. 켜면 프로젝트의 내부 메일함으로 발송됩니다.",
    followingDetection: "자동 감지 결과를 따르는 중입니다.",
    overriddenIsolated: "자동 감지를 무시하고 격리로 직접 설정했습니다.",
    overriddenConnected: "자동 감지를 무시하고 연결로 직접 설정했습니다.",
    revertToDetection: "자동 감지 사용",
    overrideWhy: "방화벽이나 보안 정책 때문에 핑 확인이 부정확할 수 있어, 이 스위치가 감지 결과보다 항상 우선합니다.",
  },
} as const;

/**
 * Whether this project's site can reach the internet — decides the invite-mail transport in
 * InviteUserModal (PortalUsersPage.tsx) and whether the "using team default" mail banner below
 * even applies. A real deployment would detect this by an outbound ping, but a firewall or
 * security policy can make that check return a false positive/negative — so the resolved value
 * always has an admin override on top, per isNetworkIsolated()'s precedence. This card is the one
 * place that override is set; everywhere else only reads the result.
 */
function NetworkStatus({ projectId }: { projectId: string }) {
  const projects = useVcaStore(s => s.projects);
  const setNetworkIsolationOverride = useVcaStore(s => s.setNetworkIsolationOverride);
  const [lang] = usePortalLanguage();
  const t = NETWORK_T[lang];

  const project = projects.find(p => p.id === projectId);
  if (!project) return null;

  const detected = project.networkIsolatedDetected ?? false;
  const overrideValue = project.networkIsolatedOverride ?? null;
  const hasOverride = overrideValue !== null;
  const effective = isNetworkIsolated(project);

  // No toast here — the status badge above and the toggle's own selected state already give
  // immediate visual feedback, and a toast on every checkbox/toggle click was noisier than useful
  // for a setting an admin might flip back and forth while diagnosing a mail-delivery issue.
  const setOverride = (value: boolean | null) => {
    setNetworkIsolationOverride(projectId, value);
  };

  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}><NetworkIcon /></span>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.heading}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
              {t.desc}
            </p>
          </div>
        </div>
        <span style={{
          fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", textTransform: "uppercase", flexShrink: 0,
          backgroundColor: effective ? "var(--gray-200)" : "var(--success-100)",
          color: effective ? "var(--gray-700)" : "var(--success-400)",
        }}>
          {effective ? t.isolated : t.connected}
        </span>
      </div>

      <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: detected ? "var(--gray-400)" : "var(--success-400)", flexShrink: 0 }} />
        <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>
          {t.autoDetected} <span style={{ fontWeight: 700, color: "var(--gray-700)" }}>{detected ? t.noResponse : t.reachable}</span>
        </p>
      </div>

      {/* One switch for the state itself, instead of a checkbox that revealed a second control.
          "Override auto-detection" asked the reader to opt into the idea of overriding before they
          could say the thing they came to say, and named the mechanism rather than the setting —
          nobody arrives here wanting to override something, they arrive knowing the site is
          isolated. Flipping the switch IS the override now.

          Three states are still reachable, because the third one is not a position of the switch:
          the switch shows the effective value, and a line underneath says whether that value came
          from detection or from a person, with the way back to detection offered only when there
          is something to go back from. */}
      <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: BORDER }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.switchLabel}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.5 }}>{t.switchDesc}</p>
          </div>
          <div style={{ marginTop: "2px" }}>
            <Switch checked={effective} onChange={setOverride} label={t.switchLabel} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
          <p style={{ fontSize: "12px", color: hasOverride ? "var(--gray-700)" : "var(--gray-400)" }}>
            {!hasOverride
              ? t.followingDetection
              : overrideValue ? t.overriddenIsolated : t.overriddenConnected}
          </p>
          {hasOverride && (
            <button onClick={() => setOverride(null)}
              style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
              {t.revertToDetection}
            </button>
          )}
        </div>
        <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px", lineHeight: 1.5 }}>{t.overrideWhy}</p>
      </div>
    </div>
  );
}

const MAIL_T = {
  en: {
    usingDefault: (name: string) => `Using ${name}'s default mail server`,
    theTeam: "the team",
    bannerDesc: "Set up a dedicated SMTP server if this project needs its own, like an on-prem site with no internet access.",
    setUpSmtp: "Set up SMTP",
    inEffect: "In effect for this project",
    domain: "Domain", smtpHost: "SMTP host", sentFrom: "Sent from", source: "Source",
    thisProject: "This project", inheritedFrom: (name: string) => `Inherited from ${name}`,
    notConfigured: "No mail server configured. Invitations and password resets cannot be sent until one is set here or on the team.",
    useDifferentServer: "Use a different mail server for this project",
    useDifferentServerDesc: "For a site with no internet, routing through its own internal server.",
    provisionalNotice: "These SMTP fields are provisional — the exact settings the server needs are still being confirmed. The mail domain below is final.",
    mailDomain: "Mail domain", mailDomainPlaceholder: "company.local",
    mailDomainHint: "Accounts must have an address on this domain — requests and invites to anything else are refused.",
    smtpHostPlaceholder: "mail.company.local",
    port: "Port", portPlaceholder: "587", portError: "1–65535",
    fromAddressPlaceholder: "vca-noreply@company.local",
    fromAddressError: (domain: string) => `Must be an address on ${domain}.`,
    fromAddressHint: "The From: address recipients will see.",
    useTls: "Use TLS", save: "Save",
    toastUsingTeam: "Using team mail settings",
    toastSaved: "Mail settings saved",
    toastSavedDesc: (addr: string) => `Invites will be sent from ${addr}. Nothing has been sent through this relay yet — send one invite and confirm it arrives before you rely on it.`,
    panelHeading: "This project",
    whatVcaSends: "What VCA sends",
    accountInvitation: "Account invitation", accountInvitationValue: "To the invited address, on approval",
    passwordReset: "Password reset", passwordResetValue: "To the account's own address, on request",
  },
  ko: {
    usingDefault: (name: string) => `${name}의 기본 메일 서버 사용 중`,
    theTeam: "팀",
    bannerDesc: "이 프로젝트에 전용 메일 서버가 필요하다면 별도로 설정하세요. 인터넷이 연결되지 않은 온프레미스 사이트가 그런 경우입니다.",
    setUpSmtp: "SMTP 설정",
    inEffect: "이 프로젝트에 적용 중인 설정",
    domain: "도메인", smtpHost: "SMTP 호스트", sentFrom: "발신 주소", source: "출처",
    thisProject: "이 프로젝트", inheritedFrom: (name: string) => `${name}에서 상속됨`,
    notConfigured: "메일 서버가 설정되어 있지 않습니다. 여기 또는 팀에 메일 서버를 설정하기 전까지 초대장과 비밀번호 재설정 메일을 보낼 수 없습니다.",
    useDifferentServer: "이 프로젝트에 다른 메일 서버 사용",
    useDifferentServerDesc: "인터넷이 없는 사이트에서 자체 내부 서버로 보낼 때 켭니다.",
    provisionalNotice: "아래 SMTP 항목은 잠정적인 값입니다 — 서버에 필요한 정확한 설정은 아직 확인 중입니다. 메일 도메인 항목은 확정된 값입니다.",
    mailDomain: "메일 도메인", mailDomainPlaceholder: "company.local",
    mailDomainHint: "계정은 반드시 이 도메인의 주소를 사용해야 합니다 — 그 외 주소로의 요청과 초대는 거부됩니다.",
    smtpHostPlaceholder: "mail.company.local",
    port: "포트", portPlaceholder: "587", portError: "1–65535",
    fromAddressPlaceholder: "vca-noreply@company.local",
    fromAddressError: (domain: string) => `${domain} 주소여야 합니다.`,
    fromAddressHint: "수신자에게 표시될 발신(From) 주소입니다.",
    useTls: "TLS 사용", save: "저장",
    toastUsingTeam: "팀 메일 설정 사용 중",
    toastSaved: "메일 설정 저장됨",
    toastSavedDesc: (addr: string) => `초대장은 ${addr}에서 발송됩니다. 아직 이 릴레이로 보낸 적은 없습니다. 초대를 한 통 보내 도착하는지 확인한 뒤에 쓰세요.`,
    panelHeading: "이 프로젝트",
    whatVcaSends: "VCA가 발송하는 메일",
    accountInvitation: "계정 초대", accountInvitationValue: "승인 시 초대받은 주소로 발송",
    passwordReset: "비밀번호 재설정", passwordResetValue: "요청 시 계정 본인 주소로 발송",
  },
} as const;

export default function ProjectMailPanel({ projectId }: { projectId: string }) {
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
  const updateProjectMail = useVcaStore(s => s.updateProjectMail);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = MAIL_T[lang];

  const project = projects.find(p => p.id === projectId);
  const team = project ? teams.find(o => o.id === project.teamId) : undefined;
  const inherited = resolveMailConfig(projectId, projects, teams);
  const overridden = !!project?.mailDomain || !!project?.smtp;

  const [override, setOverride] = useState(overridden);
  const [domain, setDomain] = useState(project?.mailDomain ?? "");
  const [host, setHost] = useState(project?.smtp?.host ?? "");
  const [port, setPort] = useState(String(project?.smtp?.port ?? 587));
  const [fromAddress, setFromAddress] = useState(project?.smtp?.fromAddress ?? "");
  const [useTls, setUseTls] = useState(project?.smtp?.useTls ?? true);

  if (!project) return null;

  const portNumber = Number(port);
  const portValid = portProblem(port) === null && port.trim() !== "";
  // The From: address has to live on the domain being configured, or the receiving server will
  // reject or spam-file it — worth catching here rather than discovering it when invites stop
  // arriving.
  const fromMatchesDomain = !domain || !fromAddress || fromAddress.trim().toLowerCase().endsWith(`@${domain.trim().toLowerCase()}`);
  const canSave = mayEdit
    && (!override || (domain.trim() !== "" && host.trim() !== "" && portValid && fromAddress.trim() !== "" && fromMatchesDomain));

  const save = () => {
    if (!canSave) return;
    if (!override) {
      updateProjectMail(projectId, { mailDomain: undefined, smtp: undefined });
      showToast({ variant: "success", title: t.toastUsingTeam });
      return;
    }
    updateProjectMail(projectId, {
      mailDomain: domain.trim(),
      smtp: { host: host.trim(), port: portNumber, fromAddress: fromAddress.trim(), useTls },
    });
    // Saved, not verified — nothing here connects to the relay. On an on-prem site the invite
    // mail is how staff get accounts, so a typo'd host means invitations vanish with no sign on
    // this screen; the toast says so rather than letting "saved" read as "working".
    //
    // HANDOFF NOTE: a test send is the fix — POST /api/portal/projects/{id}/mail/test, and this
    // toast becomes a real result instead of a caveat.
    showToast({ variant: "success", title: t.toastSaved, desc: t.toastSavedDesc(fromAddress.trim()) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* WHOSE SETTINGS THESE ARE. On the server screen the tab name answered that; here the card
          above it is the team's default carrying the same four field names, so without this line a
          reader coming down the page cannot tell which values apply to what. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "4px 2px 0" }}>
        <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--gray-900)" }}>{t.panelHeading}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</p>
      </div>

      <NetworkStatus projectId={projectId} />

      {/* A project that hasn't overridden anything is quietly relying on the team default — easy to
          miss until an on-prem site's invites silently fail because that default can't reach it.
          Surface it as an actionable banner rather than only inside the read-only card below. */}
      {!override && inherited.mailDomain && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-300)", borderRadius: "12px", padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ display: "flex", color: "var(--warning-500)", flexShrink: 0 }}><MailIcon /></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                {t.usingDefault(team?.name ?? t.theTeam)}
              </p>
              <p style={{ fontSize: "12px", color: "var(--gray-600)", marginTop: "2px" }}>
                {t.bannerDesc}
              </p>
            </div>
          </div>
          <button className="portal-btn-primary" onClick={() => setOverride(true)} disabled={!mayEdit} title={readOnlyReason}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--gray-900)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed", flexShrink: 0, whiteSpace: "nowrap" }}>
            {t.setUpSmtp}
          </button>
        </div>
      )}

      {/* What is in force right now, before any of the editing below. Only relevant once this project
          is actually using its own server — the banner above already covers the "inheriting the team
          default" case, so repeating those same values in a second card here would be redundant. A
          project with nothing configured anywhere is still a real problem worth surfacing regardless
          of override state, so that case bypasses the override check. */}
      {(override || !inherited.mailDomain) && (
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.inEffect}</p>
          {inherited.mailDomain ? (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <SettingRow label={t.domain} value={inherited.mailDomain} />
              <SettingRow label={t.smtpHost} value={inherited.smtp ? `${inherited.smtp.host}:${inherited.smtp.port}` : "—"} />
              <SettingRow label={t.sentFrom} value={inherited.smtp?.fromAddress ?? "—"} />
              <SettingRow label={t.source} value={overridden ? t.thisProject : t.inheritedFrom(team?.name ?? t.theTeam)} />
            </div>
          ) : (
            /* A project with no mail configured cannot invite anyone, so this says so plainly rather
               than showing empty fields that look merely unfilled. */
            <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "8px", lineHeight: 1.5 }}>
              {t.notConfigured}
            </p>
          )}
        </div>
      )}

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
          <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)}
            style={{ marginTop: "3px", accentColor: "var(--gray-900)", cursor: "pointer" }} />
          <span>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.useDifferentServer}</span>
            <span style={{ display: "block", fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
              {t.useDifferentServerDesc}
            </span>
          </span>
        </label>

        {override && (
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Says out loud that these fields are not settled, so nobody hands them to a customer
                as the configuration contract before the backend confirms it. */}
            <p style={{
              margin: 0, fontSize: "10px", fontWeight: 600, color: "var(--warning-500)",
              backgroundColor: "var(--warning-100)", padding: "8px 10px", borderRadius: "8px", lineHeight: 1.5,
            }}>
              {t.provisionalNotice}
            </p>
            <MailField label={t.mailDomain} value={domain} onChange={setDomain} placeholder={t.mailDomainPlaceholder}
              hint={t.mailDomainHint} />
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <MailField label={t.smtpHost} value={host} onChange={setHost} placeholder={t.smtpHostPlaceholder} />
              </div>
              <div style={{ width: "120px" }}>
                <MailField label={t.port} value={port} onChange={setPort} placeholder={t.portPlaceholder}
                  error={port !== "" && !portValid ? t.portError : ""} />
              </div>
            </div>
            <MailField label={t.sentFrom} value={fromAddress} onChange={setFromAddress} placeholder={t.fromAddressPlaceholder}
              error={!fromMatchesDomain ? t.fromAddressError(domain.trim()) : ""}
              hint={fromMatchesDomain ? t.fromAddressHint : ""} />
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={useTls} onChange={e => setUseTls(e.target.checked)}
                style={{ accentColor: "var(--gray-900)", cursor: "pointer" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)" }}>{t.useTls}</span>
            </label>
          </div>
        )}

        {/* Nothing to save while unchecked and already on the team default — that's a no-op click.
            Stays visible if unchecking just turned OFF a previously-saved override, since that's a
            real change (revert to default) that still needs to be committed. */}
        {(override || overridden) && (
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={save} disabled={!canSave} title={mayEdit ? undefined : readOnlyReason}
              style={{
                padding: "10px 16px", borderRadius: "8px", border: "none",
                backgroundColor: canSave ? "var(--gray-900)" : "var(--gray-200)",
                color: canSave ? "white" : "var(--gray-400)",
                fontSize: "13px", fontWeight: 700, cursor: canSave ? "pointer" : "default",
              }}>
              {t.save}
            </button>
          </div>
        )}
      </div>

      {/* Named so nobody has to guess what a mail change affects. The two events are the whole list
          on purpose — see the note on this component. */}
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.whatVcaSends}</p>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <SettingRow label={t.accountInvitation} value={t.accountInvitationValue} />
          <SettingRow label={t.passwordReset} value={t.passwordResetValue} />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", width: "130px", flexShrink: 0, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function MailField({ label, value, onChange, placeholder, hint, error }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: "38px", padding: "0 10px", borderRadius: "8px", outline: "none",
          border: error ? "1px solid var(--danger-400)" : BORDER,
          fontSize: "13px", color: "var(--gray-900)", fontFamily: "inherit",
        }}
      />
      {error
        ? <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--danger-400)" }}>{error}</span>
        : hint ? <span style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1.5 }}>{hint}</span> : null}
    </div>
  );
}
