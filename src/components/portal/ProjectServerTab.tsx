"use client";

import { useEffect, useState } from "react";
import { Globe, Mail, RotateCcw, ServerCrash, Unplug, Video} from "lucide-react";
import { resolveMailConfig, isNetworkIsolated, useVcaStore, type Server, type ServerType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { SummaryStrip, CARD_BORDER, CARD_RADIUS, TextField, BORDER, TABLE_COLUMN_GAP, CONTROL_HEIGHT, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, Switch, usePortalEditAccess, ConfirmModal } from "./PortalShared";

const SERVER_TYPES: ServerType[] = ["AI Camera", "Normal Camera", "Face Recognition", "Image Store", "Database"];

// Shared between ServerFormModal and the main table (both need the same two status words) —
// kept as its own tiny dict rather than duplicated, same way SERVER_TYPES/API_ENDPOINTS are
// shared top-level constants in this file.
const STATUS_T = {
  en: { success: "Success", error: "Error" },
  ko: { success: "성공", error: "오류" },
} as const;

interface ServerFormValues {
  name: string;
  ip: string;
  /** Held as text, like every other field: a half-typed port is "80", and a number input turns
   *  that into a value the moment it is keyed. Parsed on save. */
  port: string;
  type: ServerType;
  specification: string;
  status: "success" | "error";
}

const EMPTY_FORM: ServerFormValues = { name: "", ip: "", port: "", type: SERVER_TYPES[0], specification: "", status: "success" };

const MODAL_T = {
  en: {
    serverName: "Server Name *", serverNamePlaceholder: "FR 2",
    serverIp: "Server IP *", serverIpPlaceholder: "192.168.0.36",
    serverPort: "Server Port", serverPortPlaceholder: "8011",
    serverType: "Server Type", status: "Status (recorded, not measured)",
    statusHint: "Nothing here checks the server. This is what an administrator last wrote down, and the error counts on this page are the sum of these answers — not of anything reached over the network.",
    specification: "Specification", specificationPlaceholder: "8 vCPU · 32GB RAM",
    cancel: "Cancel", save: "Save",
  },
  ko: {
    serverName: "서버 이름 *", serverNamePlaceholder: "FR 2",
    serverIp: "서버 IP *", serverIpPlaceholder: "192.168.0.36",
    serverPort: "서버 포트", serverPortPlaceholder: "8011",
    serverType: "서버 유형", status: "상태(측정값 아닌 기록)",
    statusHint: "이 화면은 서버를 확인하지 않습니다. 관리자가 마지막으로 적어둔 값이고, 이 페이지의 오류 건수도 그 답들을 더한 것이지 망 너머에서 얻은 것이 아닙니다.",
    specification: "사양", specificationPlaceholder: "8 vCPU · 32GB RAM",
    cancel: "취소", save: "저장",
  },
} as const;

function ServerFormModal({
  title, initial, onClose, onSubmit,
}: {
  title: string;
  initial: ServerFormValues;
  onClose: () => void;
  onSubmit: (values: ServerFormValues) => void;
}) {
  useEscapeKey(onClose);
  const [form, setForm] = useState<ServerFormValues>(initial);
  const valid = form.name.trim().length > 0 && form.ip.trim().length > 0;
  const [lang] = usePortalLanguage();
  const t = MODAL_T[lang];
  const st = STATUS_T[lang];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.serverName}</label>
            <TextField value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t.serverNamePlaceholder} />
          </div>
          {/* Address and port on one row: between them they are one thing, and nothing reaches a
              server with only half of it. */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.serverIp}</label>
              <TextField value={form.ip} onChange={v => setForm(f => ({ ...f, ip: v }))} placeholder={t.serverIpPlaceholder} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.serverPort}</label>
              <TextField value={form.port} onChange={v => setForm(f => ({ ...f, port: v.replace(/[^0-9]/g, "") }))} placeholder={t.serverPortPlaceholder} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.serverType}</label>
              <FilterSelect value={form.type} onChange={v => setForm(f => ({ ...f, type: v as ServerType }))}
                options={SERVER_TYPES.map(ty => ({ value: ty, label: ty }))} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.status}</label>
              <FilterSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v as "success" | "error" }))}
                options={[{ value: "success", label: st.success }, { value: "error", label: st.error }]} />
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "-4px" }}>{t.statusHint}</p>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.specification}</label>
            <TextField value={form.specification} onChange={v => setForm(f => ({ ...f, specification: v }))} placeholder={t.specificationPlaceholder} />
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

const API_ENDPOINTS = [
  { method: "GET", path: "/v1/cameras", desc: { en: "List cameras registered to this project.", ko: "이 프로젝트에 등록된 카메라 목록을 조회합니다." } },
  { method: "GET", path: "/v1/persons", desc: { en: "List VIP/watchlist registrations.", ko: "VIP/관심인물 등록 목록을 조회합니다." } },
  { method: "POST", path: "/v1/events", desc: { en: "Push a detection event from an edge server.", ko: "엣지 서버에서 탐지 이벤트를 전송합니다." } },
  { method: "GET", path: "/v1/servers", desc: { en: "List infrastructure nodes and their health.", ko: "인프라 노드와 상태를 조회합니다." } },
];

const API_DOC_T = {
  en: {
    baseUrl: "API Base URL",
    endpoints: "Endpoints",
    baseUrlNote: "This installation's own address. There is no vendor-hosted API — the product is on-premise, so the base URL is whatever host this console is served from.",
    noKeys: "API keys are not issued or revoked from Portal yet. Until they are, treat these endpoints as documentation rather than as something you can call today.",
  },
  ko: {
    baseUrl: "API 기본 URL",
    endpoints: "엔드포인트",
    baseUrlNote: "이 설치본 자신의 주소입니다. 벤더가 호스팅하는 API는 없습니다 — 온프레미스 제품이라, 기본 URL은 이 콘솔이 서비스되는 호스트입니다.",
    noKeys: "API 키 발급과 폐기는 아직 포털에 없습니다. 생기기 전까지 이 엔드포인트들은 지금 호출할 수 있는 것이 아니라 문서로 보시면 됩니다.",
  },
} as const;

function ApiDocumentation({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = API_DOC_T[lang];
  // After mount: window does not exist while this renders on the server, and a guessed host
  // corrected a frame later is the hydration mismatch the rest of Portal avoids.
  const [origin, setOrigin] = useState("");
  useEffect(() => { queueMicrotask(() => setOrigin(window.location.origin)); }, []);
  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.baseUrl}</p>
      {/*
        The host this console is served from, not a vendor cloud.
       
        It printed https://api.univs.ai/portal/{id} — a URL on the supplier's own domain, on a
        product that is on-premise only (decided 2026-09-02, no cloud hosting) and that on some
        sites runs on a network with no route to the internet at all. An address the customer's
        own installation cannot reach is not a base URL, it is a wrong answer.
       
        Read at render rather than baked in: this screen cannot know the deployment's hostname,
        and the browser showing it is by definition sitting on one.
      */}
      <p style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", marginTop: "6px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "8px", padding: "8px 10px", overflowX: "auto" }}>
        {origin}/api/portal/projects/{projectId}
      </p>
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "6px" }}>{t.baseUrlNote}</p>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "20px", marginBottom: "10px" }}>{t.endpoints}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {API_ENDPOINTS.map(ep => (
          <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "var(--gray-50)" }}>
            <span style={{
              fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", flexShrink: 0,
              backgroundColor: ep.method === "GET" ? "var(--gray-200)" : "var(--success-100)",
              color: ep.method === "GET" ? "var(--gray-900)" : "var(--success-400)",
            }}>
              {ep.method}
            </span>
            <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--gray-900)" }}>{ep.path}</span>
            <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{ep.desc[lang]}</span>
          </div>
        ))}
      </div>
      {/* Said plainly: there is no key issue/revoke anywhere in Portal, so a reader who takes
          this list as an invitation to integrate finds out later and by failing. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "14px" }}>{t.noKeys}</p>
    </div>
  );
}

/**
 * Outgoing mail. VCA does not host mailboxes — it hands messages to the customer's own mail server
 * (Exchange / Zimbra / Postfix), which is what users read in their internal webmail. On an
 * internet-separated network that is what makes an invite link workable at all: the webmail and VCA
 * both sit inside it, so the link resolves.
 *
 * Only two things send mail today — account invitations and password resets — and both go to the
 * person they concern, so there is no recipient list to configure here. VIP-detection and daily
 * report mail were discussed and deliberately left out of this version; when they arrive they need
 * recipients and conditions, which is a separate screen, not another field here.
 *
 * PROVISIONAL (2026-08-28): the backend developer is still looking into how SMTP is actually
 * configured on their side, so the field set below — host / port / from-address / TLS — is this
 * screen's guess at the shape, not a settled contract. `mailDomain` is NOT provisional: accounts
 * live on one domain and /request-access already refuses addresses outside it. Expect the SMTP
 * fields to change (auth credentials, a connection test, a per-event sender) and keep them in one
 * block so that change stays local.
 *
 * Settings inherit from the team and can be overridden per project. The inherited case is
 * the normal one (one company, one mail server), and the override exists because network
 * isolation (see isNetworkIsolated(), set below in NetworkStatus) is resolved per PROJECT, not
 * per team: one team really can hold an internet-isolated project routing through an internal
 * server alongside an internet-reachable project that does not. Every deployment is on-premise
 * (see getAuthConfig()'s doc comment) — that's a separate axis from whether a given site can
 * reach the internet, which is what this override is actually keyed on.
 */
// Lucide — see PortalProjectDetailPage's note. Globe rather than Lucide's own Network for the one
// below: the drawing it replaces was a globe with meridians, and what that card is about is whether
// this site can reach the outside world, not the shape of its internal topology.
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
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.6 }}>{t.switchDesc}</p>
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
        <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "8px", lineHeight: 1.6 }}>{t.overrideWhy}</p>
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
    whatVcaSends: "VCA가 발송하는 메일",
    accountInvitation: "계정 초대", accountInvitationValue: "승인 시 초대받은 주소로 발송",
    passwordReset: "비밀번호 재설정", passwordResetValue: "요청 시 계정 본인 주소로 발송",
  },
} as const;

function MailSettings({ projectId }: { projectId: string }) {
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
  const portValid = Number.isInteger(portNumber) && portNumber > 0 && portNumber < 65536;
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
            <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "8px", lineHeight: 1.6 }}>
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

const MAIN_T = {
  en: {
    subTabInfra: "Infrastructure", subTabMail: "Mail & Network", subTabApi: "API Documentation",
    confirmDeleteTitle: (name: string) => `Remove ${name}?`,
    confirmDeleteBody: "The server comes off this project. Any camera assigned to it is left unassigned — nothing stops processing that was not already stopped, but nobody is told where those cameras run next.",
    confirmDeleteCameras: (n: number) => (n === 1 ? "1 camera is assigned to it." : `${n} cameras are assigned to it.`),
    gapError: "connection failing",
    gapErrorWhy: "Somebody recorded this server as failing. Nothing here tested it — if that is still true, everything assigned to it has stopped being processed, whatever the cameras themselves say.",
    gapNoCameras: "no cameras assigned",
    gapNoCamerasWhy: "The server is registered and reachable but has nothing pointed at it — capacity that is paid for and idle.",
    gapServerUnit: "servers",
    gapPerServers: (n: number) => `across ${n} server${n === 1 ? "" : "s"}`,
    gapLoadLabel: "cameras to process",
    gapLoadWhy: "Cameras in this project divided across its servers. The figure an argument for another server is made from — it is not a limit, and nothing here enforces one.",
    gapShowOnly: "Show only these",
    gapClear: "Show everything again",
    searchPlaceholder: "Search by server name or IP address",
    allTypes: "All types", reset: "Reset", addServer: "Add server",
    emptyNoServers: "No servers configured for this project yet.",
    emptyNoMatch: "No servers match these filters.",
    colStatus: "Status (recorded)", colName: "Server Name", colIp: "Server IP", colType: "Server Type", colSpec: "Specification",
    edit: "Edit", remove: "Remove", cancel: "Cancel",
    showingEntries: (start: number, end: number, total: number) => `Showing ${start} to ${end} of ${total} entries`,
    rowsPerPage: "Rows per page:",
    addServerTitle: "Add server", editServerTitle: "Edit server",
    toastAdded: "Server added", toastUpdated: "Server updated", toastRemoved: "Server removed",
  },
  ko: {
    subTabInfra: "인프라", subTabMail: "메일 및 네트워크", subTabApi: "API 문서",
    confirmDeleteTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    confirmDeleteBody: "이 프로젝트에서 서버가 빠집니다. 여기 배정돼 있던 카메라는 미배정 상태가 됩니다 — 이미 멈춰 있던 것 말고 새로 멈추는 건 없지만, 그 카메라들이 이제 어디서 도는지는 아무도 모릅니다.",
    confirmDeleteCameras: (n: number) => `배정된 카메라 ${n}대.`,
    gapError: "연결 실패",
    gapErrorWhy: "누군가 이 서버를 오류로 기록해 두었습니다. 화면이 확인한 것은 아닙니다 — 아직 사실이라면 카메라 쪽 표시와 무관하게 이 서버에 붙은 것은 전부 처리가 멈춰 있습니다.",
    gapNoCameras: "카메라 미할당",
    gapNoCamerasWhy: "등록되어 있고 연결도 되지만 아무것도 붙어 있지 않습니다. 비용은 나가고 놀고 있는 용량입니다.",
    gapServerUnit: "대",
    gapPerServers: (n: number) => `/ 서버 ${n}대`,
    gapLoadLabel: "처리할 카메라",
    gapLoadWhy: "이 프로젝트의 카메라를 서버 수로 나눈 값입니다. 서버 증설을 설득할 때 쓰는 숫자이고, 한계치가 아니며 여기서 강제하지도 않습니다.",
    gapShowOnly: "이 항목만 보기",
    gapClear: "전체 다시 보기",
    searchPlaceholder: "서버 이름 또는 IP 주소로 검색",
    allTypes: "전체 유형", reset: "초기화", addServer: "서버 추가",
    emptyNoServers: "이 프로젝트에 아직 설정된 서버가 없습니다.",
    emptyNoMatch: "필터와 일치하는 서버가 없습니다.",
    colStatus: "상태(기록)", colName: "서버 이름", colIp: "서버 IP", colType: "서버 유형", colSpec: "사양",
    edit: "수정", remove: "삭제", cancel: "취소",
    showingEntries: (start: number, end: number, total: number) => `전체 ${total}건 중 ${start}–${end}건 표시`,
    rowsPerPage: "페이지당 행 수:",
    addServerTitle: "서버 추가", editServerTitle: "서버 수정",
    toastAdded: "서버 추가됨", toastUpdated: "서버 수정됨", toastRemoved: "서버 삭제됨",
  },
} as const;

type ServerSortKey = "status" | "name" | "ip" | "type";

export default function ProjectServerTab({ projectId }: { projectId: string }) {
  // Servers and mail are infrastructure. An auditor reads what is deployed and where mail comes
  // from; changing either is not what the role is for.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const servers = useVcaStore(s => s.servers);
  const cameras = useVcaStore(s => s.cameras);
  const addServer = useVcaStore(s => s.addServer);
  const updateServer = useVcaStore(s => s.updateServer);
  const removeServer = useVcaStore(s => s.removeServer);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = MAIN_T[lang];
  const st = STATUS_T[lang];

  const [subTab, setSubTab] = useState<"infra" | "mail" | "api">("infra");
  const [showAdd, setShowAdd] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ServerType>("ALL");
  /** Which summary cell the list is narrowed to, if any. */
  const [gapFilter, setGapFilter] = useState<"error" | "noCameras" | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { sort, toggle: toggleSort } = useTableSort<ServerSortKey>({ key: "status", direction: "asc" });

  const projectServers = servers.filter(s => s.projectId === projectId);
  /**
   * The two things worth stating above a list of servers, and the ratio that gives them context.
   *
   * A failed connection is on every row already, but there is no status filter beside the search
   * box — with twenty servers you find the broken one by reading. And a server nothing points at
   * is hardware that was bought, racked and left idle: the exact mirror of the "no server
   * assigned" figure on Input Sources, and invisible from either side until both are stated.
   *
   * Both are read off fields these screens already hold (a server's own status; which serverId the
   * cameras carry), so a figure can never disagree with the rows behind it.
   */
  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const assignedServerIds = new Set(projectCameras.map(c => c.serverId).filter(Boolean));
  const erroredServers = projectServers.filter(sv => sv.status === "error");
  const unusedServers = projectServers.filter(sv => !assignedServerIds.has(sv.id));
  const gapServers = {
    error: new Set(erroredServers.map(sv => sv.id)),
    noCameras: new Set(unusedServers.map(sv => sv.id)),
  } as const;

  const q = search.trim().toLowerCase();
  // Errors first by default — "error" sorts before "success" — because a server list is read when
  // something is wrong, not to admire the healthy ones.
  const visibleServers = sortRows(
    projectServers.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.ip.includes(q);
      const matchesType = typeFilter === "ALL" || s.type === typeFilter;
      const matchesGap = !gapFilter || gapServers[gapFilter].has(s.id);
      return matchesSearch && matchesType && matchesGap;
    }),
    sort,
    (server, key) => {
      switch (key) {
        case "status": return server.status;
        case "name": return server.name.toLowerCase();
        // Padded so 10.20.4.9 sorts after 10.20.4.17 rather than before it — a plain string compare
        // orders addresses by digit, which is the wrong answer for every list of IPs.
        case "ip": return server.ip.split(".").map(part => part.padStart(3, "0")).join(".");
        case "type": return server.type;
      }
    },
  );

  // Filters/page-size changing the result set can strand the current page past the new last
  // page (e.g. narrowing a search while on page 3) — snap back to page 1 whenever either shifts.
  // Compared during render rather than reset from an effect: an effect paints the stale page once
  // before correcting it, and react-hooks flags the synchronous setState as cascading renders.
  // Same idiom DataPage.tsx uses for its own nav/seed resets.
  const filterKey = `${search}|${typeFilter}|${gapFilter ?? ""}|${rowsPerPage}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(visibleServers.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageServers = visibleServers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const rangeStart = visibleServers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(visibleServers.length, currentPage * rowsPerPage);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setGapFilter(null);
  };

  const createServer = (values: ServerFormValues) => {
    addServer({
      projectId, name: values.name.trim(), ip: values.ip.trim(),
      port: Number(values.port) || undefined,
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: t.toastAdded, desc: values.name.trim() });
  };

  const saveEdit = (values: ServerFormValues) => {
    if (!editingServer) return;
    updateServer(editingServer.id, {
      name: values.name.trim(), ip: values.ip.trim(),
      port: Number(values.port) || undefined,
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setEditingServer(null);
    showToast({ variant: "success", title: t.toastUpdated, desc: values.name.trim() });
  };

  // Confirmed, and it says what goes with it. Removing a server orphans every camera assigned
  // to it, which is not visible from this table at all.
  const [confirmingDelete, setConfirmingDelete] = useState<Server | null>(null);
  const handleDelete = (server: Server) => setConfirmingDelete(server);
  const confirmDelete = () => {
    if (!confirmingDelete) return;
    const name = confirmingDelete.name;
    removeServer(confirmingDelete.id);
    setConfirmingDelete(null);
    showToast({ variant: "warning", title: t.toastRemoved, desc: name });
  };

  return (
    <div>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {(["infra", "mail", "api"] as const).map(sub => (
          <button key={sub} onClick={() => setSubTab(sub)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0 2px 10px", fontSize: "13px", fontWeight: 700,
              color: subTab === sub ? "var(--gray-900)" : "var(--gray-400)",
              borderBottom: subTab === sub ? "2px solid var(--gray-900)" : "2px solid transparent",
            }}>
            {sub === "infra" ? t.subTabInfra : sub === "mail" ? t.subTabMail : t.subTabApi}
          </button>
        ))}
      </div>

      {subTab === "api" ? <ApiDocumentation projectId={projectId} />
        : subTab === "mail" ? <MailSettings projectId={projectId} /> : (
        <>
          {/*
            The two gaps and the ratio between the fleet and the servers running it, in the shared
            summary strip — the same shape the VIP registry and Input Sources use.

            The ratio is not a defect and takes no click: it is the figure an increase in cameras
            is argued from, and nothing else on this page states it.
          */}
          <SummaryStrip cells={[
            ...([
              { key: "error" as const, servers: erroredServers, label: t.gapError, why: t.gapErrorWhy, icon: <ServerCrash size={14} strokeWidth={2.4} /> },
              { key: "noCameras" as const, servers: unusedServers, label: t.gapNoCameras, why: t.gapNoCamerasWhy, icon: <Unplug size={14} strokeWidth={2.4} /> },
            ].filter(item => item.servers.length > 0).map(item => ({
              key: item.key,
              icon: item.icon,
              figure: item.servers.length,
              unit: t.gapServerUnit,
              label: item.label,
              explanation: item.why,
              tone: "warning" as const,
              active: gapFilter === item.key,
              title: gapFilter === item.key ? t.gapClear : t.gapShowOnly,
              onClick: () => setGapFilter(gapFilter === item.key ? null : item.key),
            }))),
            {
              key: "load",
              icon: <Video size={14} strokeWidth={2.4} />,
              figure: projectCameras.length,
              unit: t.gapPerServers(projectServers.length),
              label: t.gapLoadLabel,
              explanation: t.gapLoadWhy,
            },
          ]} />

          {/* Centred for the same reason as the Input Sources toolbar: the controls carry their own
              height, so anything unstyled dropped in here would draw itself against the top edge. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </span>
              {/* This one drew no focus state of its own and fell through to the global outline —
                  TextField brings the same ring every other search box has. */}
              <TextField value={search} onChange={setSearch} placeholder={t.searchPlaceholder}
                style={{ padding: "0 12px 0 32px" }} />
            </div>
            <FilterSelect value={typeFilter} onChange={v => setTypeFilter(v as typeof typeFilter)}
              options={[{ value: "ALL", label: t.allTypes }, ...SERVER_TYPES.map(ty => ({ value: ty, label: ty }))]} />
            {/* The only control on this row without a mark of its own — the select had its chevron
                and Add Server its plus, so Reset read as a word somebody had left there. lucide
                rather than a hand-drawn path, at the 1.4 stroke every Portal icon now uses. */}
            <button className="portal-btn-quiet" onClick={resetFilters}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
              <RotateCcw size={14} strokeWidth={2.4} />
              {t.reset}
            </button>
            <button className="portal-btn-primary" onClick={() => setShowAdd(true)} disabled={!mayEdit} title={readOnlyReason}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addServer}
            </button>
          </div>

          {visibleServers.length === 0 ? (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
                {projectServers.length === 0 ? t.emptyNoServers : t.emptyNoMatch}
              </p>
            </div>
          ) : (
            // No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that
            // opens past the bottom edge (the last row's menu becomes invisible, not just cut
            // off). Header/last-row corners are radiused directly instead.
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
              <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
                {([
                  { label: t.colStatus, key: "status" },
                  { label: t.colName, key: "name" },
                  { label: t.colIp, key: "ip" },
                  { label: t.colType, key: "type" },
                  { label: t.colSpec },
                  { label: "" },
                ] as { label: string; key?: ServerSortKey }[]).map((h, i) => (
                  <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
                ))}
              </div>
              {pageServers.map((server, i) => {
                const ok = server.status === "success";
                const isLast = i === pageServers.length - 1;
                return (
                  <div key={server.id} style={{
                    display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                    borderBottom: isLast ? "none" : BORDER,
                    borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ok ? "var(--success-400)" : "var(--danger-400)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: ok ? "var(--success-400)" : "var(--danger-400)" }}>{ok ? st.success : st.error}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{server.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{server.port ? `${server.ip}:${server.port}` : server.ip}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{server.type}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{server.specification ?? "—"}</span>
                    <RowActionsMenu actions={[
                      { label: t.edit, onClick: () => setEditingServer(server), disabled: !mayEdit, reason: readOnlyReason },
                      { label: t.remove, onClick: () => handleDelete(server), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                    ]} />
                  </div>
                );
              })}
            </div>
          )}

          {visibleServers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                {t.showingEntries(rangeStart, rangeEnd, visibleServers.length)}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ width: "28px", height: "28px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: currentPage === 1 ? "var(--gray-300)" : "var(--gray-600)", cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 2.9L4.5 7l4.5 4.1" stroke="currentColor" strokeWidth="1.63" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    style={{
                      width: "28px", height: "28px", borderRadius: "8px", border: "none", cursor: "pointer",
                      backgroundColor: n === currentPage ? "var(--gray-900)" : "transparent",
                      color: n === currentPage ? "white" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ width: "28px", height: "28px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: currentPage === totalPages ? "var(--gray-300)" : "var(--gray-600)", cursor: currentPage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 2.9L9.5 7l-4.5 4.1" stroke="currentColor" strokeWidth="1.63" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.rowsPerPage}</span>
                <FilterSelect value={String(rowsPerPage)} onChange={v => setRowsPerPage(Number(v))}
                  options={[10, 25, 50].map(n => ({ value: String(n), label: String(n) }))} />
              </div>
            </div>
          )}
        </>
      )}

      {confirmingDelete && (
        <ConfirmModal
          title={t.confirmDeleteTitle(confirmingDelete.name)}
          body={t.confirmDeleteBody}
          confirmLabel={t.remove}
          cancelLabel={t.cancel}
          danger
          onConfirm={confirmDelete}
          onClose={() => setConfirmingDelete(null)}
        >
          {/* The count the table does not show. A server row says nothing about what runs on it,
              so "are you sure" with no number is a question nobody can answer. */}
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginTop: "12px" }}>
            {t.confirmDeleteCameras(projectCameras.filter(c => c.serverId === confirmingDelete.id).length)}
          </p>
        </ConfirmModal>
      )}
      {showAdd && (
        <ServerFormModal title={t.addServerTitle} initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSubmit={createServer} />
      )}
      {editingServer && (
        <ServerFormModal
          title={t.editServerTitle}
          initial={{
            name: editingServer.name, ip: editingServer.ip, type: editingServer.type,
            port: editingServer.port ? String(editingServer.port) : "",
            specification: editingServer.specification ?? "", status: editingServer.status,
          }}
          onClose={() => setEditingServer(null)}
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}
