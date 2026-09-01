"use client";

import { useState } from "react";
import { resolveMailConfig, useVcaStore, type Server, type ServerType } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, RowActionsMenu } from "./PortalShared";

const SERVER_TYPES: ServerType[] = ["AI Camera", "Normal Camera", "Face Recognition", "Image Store", "Database"];

interface ServerFormValues {
  name: string;
  ip: string;
  type: ServerType;
  specification: string;
  status: "success" | "error";
}

const EMPTY_FORM: ServerFormValues = { name: "", ip: "", type: SERVER_TYPES[0], specification: "", status: "success" };

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

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FR 2"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server IP *</label>
            <input value={form.ip} onChange={e => setForm(f => ({ ...f, ip: e.target.value }))} placeholder="e.g. 192.168.0.36"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Server Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ServerType }))}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white", cursor: "pointer" }}>
                {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as "success" | "error" }))}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white", cursor: "pointer" }}>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Specification</label>
            <input value={form.specification} onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} placeholder="e.g. 8 vCPU · 32GB RAM"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => valid && onSubmit(form)} disabled={!valid}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const API_ENDPOINTS = [
  { method: "GET", path: "/v1/cameras", desc: "List cameras registered to this project." },
  { method: "GET", path: "/v1/persons", desc: "List VIP/watchlist registrations." },
  { method: "POST", path: "/v1/events", desc: "Push a detection event from an edge server." },
  { method: "GET", path: "/v1/servers", desc: "List infrastructure nodes and their health." },
];

function ApiDocumentation({ projectId }: { projectId: string }) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px", maxWidth: "640px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>API Base URL</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", marginTop: "6px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "8px", padding: "8px 10px" }}>
        https://api.univs.ai/portal/{projectId}
      </p>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "20px", marginBottom: "10px" }}>Endpoints</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {API_ENDPOINTS.map(ep => (
          <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "var(--gray-50)" }}>
            <span style={{
              fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", flexShrink: 0,
              backgroundColor: ep.method === "GET" ? "var(--primary-100)" : "var(--success-100)",
              color: ep.method === "GET" ? "var(--primary-400)" : "var(--success-400)",
            }}>
              {ep.method}
            </span>
            <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--gray-900)" }}>{ep.path}</span>
            <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{ep.desc}</span>
          </div>
        ))}
      </div>
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
 * Settings inherit from the organization and can be overridden per project. The inherited case is
 * the normal one (one company, one mail server), and the override exists because `regionOnPrem`
 * sits on the project: one organization really can hold an on-prem project routing through an
 * internal server alongside a cloud project that does not.
 */
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2.5 4.5L8 9L13.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MailSettings({ projectId }: { projectId: string }) {
  const projects = useVcaStore(s => s.projects);
  const organizations = useVcaStore(s => s.organizations);
  const updateProjectMail = useVcaStore(s => s.updateProjectMail);
  const { showToast } = useToast();

  const project = projects.find(p => p.id === projectId);
  const org = project ? organizations.find(o => o.id === project.orgId) : undefined;
  const inherited = resolveMailConfig(projectId, projects, organizations);
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
  const canSave = !override || (domain.trim() !== "" && host.trim() !== "" && portValid && fromAddress.trim() !== "" && fromMatchesDomain);

  const save = () => {
    if (!canSave) return;
    if (!override) {
      updateProjectMail(projectId, { mailDomain: undefined, smtp: undefined });
      showToast({ variant: "success", title: "Using organization mail settings" });
      return;
    }
    updateProjectMail(projectId, {
      mailDomain: domain.trim(),
      smtp: { host: host.trim(), port: portNumber, fromAddress: fromAddress.trim(), useTls },
    });
    showToast({ variant: "success", title: "Mail settings saved", desc: `Invites will be sent from ${fromAddress.trim()}` });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" }}>

      {/* A project that hasn't overridden anything is quietly relying on the org default — easy to
          miss until an on-prem site's invites silently fail because that default can't reach it.
          Surface it as an actionable banner rather than only inside the read-only card below. */}
      {!override && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-300)", borderRadius: "12px", padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ display: "flex", color: "var(--warning-500)", flexShrink: 0 }}><MailIcon /></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                Using {org?.name ?? "the organization"}&apos;s default mail server
              </p>
              <p style={{ fontSize: "12px", color: "var(--gray-600)", marginTop: "2px" }}>
                Set up a dedicated SMTP server if this project needs its own — e.g. an on-prem site with no internet access.
              </p>
            </div>
          </div>
          <button onClick={() => setOverride(true)}
            style={{ padding: "8px 14px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            Set up SMTP
          </button>
        </div>
      )}

      {/* What is in force right now, before any of the editing below. Without it an admin cannot
          tell whether this project is inheriting or overriding, and both look like "filled in". */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>In effect for this project</p>
        {inherited.mailDomain ? (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <SettingRow label="Domain" value={inherited.mailDomain} />
            <SettingRow label="SMTP host" value={inherited.smtp ? `${inherited.smtp.host}:${inherited.smtp.port}` : "—"} />
            <SettingRow label="Sent from" value={inherited.smtp?.fromAddress ?? "—"} />
            <SettingRow label="Source" value={overridden ? "This project" : `Inherited from ${org?.name ?? "organization"}`} />
          </div>
        ) : (
          /* A project with no mail configured cannot invite anyone, so this says so plainly rather
             than showing empty fields that look merely unfilled. */
          <p style={{ fontSize: "12px", color: "var(--warning-500)", marginTop: "8px", lineHeight: 1.6 }}>
            No mail server configured. Invitations and password resets cannot be sent until one is
            set here or on the organization.
          </p>
        )}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
          <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)}
            style={{ marginTop: "3px", accentColor: "var(--primary-400)", cursor: "pointer" }} />
          <span>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>Use a different mail server for this project</span>
            <span style={{ display: "block", fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
              Leave off to follow the organization&apos;s settings. Turn on for an on-prem project that
              routes through its own internal server.
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
              These SMTP fields are provisional — the exact settings the server needs are still
              being confirmed. The mail domain below is final.
            </p>
            <MailField label="Mail domain" value={domain} onChange={setDomain} placeholder="company.local"
              hint="Accounts must have an address on this domain — requests and invites to anything else are refused." />
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <MailField label="SMTP host" value={host} onChange={setHost} placeholder="mail.company.local" />
              </div>
              <div style={{ width: "120px" }}>
                <MailField label="Port" value={port} onChange={setPort} placeholder="587"
                  error={port !== "" && !portValid ? "1–65535" : ""} />
              </div>
            </div>
            <MailField label="Sent from" value={fromAddress} onChange={setFromAddress} placeholder="vca-noreply@company.local"
              error={!fromMatchesDomain ? `Must be an address on ${domain.trim()}.` : ""}
              hint={fromMatchesDomain ? "The From: address recipients will see." : ""} />
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={useTls} onChange={e => setUseTls(e.target.checked)}
                style={{ accentColor: "var(--primary-400)", cursor: "pointer" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)" }}>Use TLS</span>
            </label>
          </div>
        )}

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={save} disabled={!canSave}
            style={{
              padding: "9px 16px", borderRadius: "8px", border: "none",
              backgroundColor: canSave ? "var(--gray-900)" : "var(--gray-200)",
              color: canSave ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: canSave ? "pointer" : "default",
            }}>
            Save
          </button>
        </div>
      </div>

      {/* Named so nobody has to guess what a mail change affects. The two events are the whole list
          on purpose — see the note on this component. */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>What VCA sends</p>
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <SettingRow label="Account invitation" value="To the invited address, on approval" />
          <SettingRow label="Password reset" value="To the account's own address, on request" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", width: "96px", flexShrink: 0 }}>{label}</span>
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

export default function ProjectServerTab({ projectId }: { projectId: string }) {
  const servers = useVcaStore(s => s.servers);
  const addServer = useVcaStore(s => s.addServer);
  const updateServer = useVcaStore(s => s.updateServer);
  const removeServer = useVcaStore(s => s.removeServer);
  const { showToast } = useToast();

  const [subTab, setSubTab] = useState<"infra" | "mail" | "api">("infra");
  const [showAdd, setShowAdd] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ServerType>("ALL");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const projectServers = servers.filter(s => s.projectId === projectId);
  const q = search.trim().toLowerCase();
  const visibleServers = projectServers.filter(s => {
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.ip.includes(q);
    const matchesType = typeFilter === "ALL" || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Filters/page-size changing the result set can strand the current page past the new last
  // page (e.g. narrowing a search while on page 3) — snap back to page 1 whenever either shifts.
  // Compared during render rather than reset from an effect: an effect paints the stale page once
  // before correcting it, and react-hooks flags the synchronous setState as cascading renders.
  // Same idiom DataPage.tsx uses for its own nav/seed resets.
  const filterKey = `${search}|${typeFilter}|${rowsPerPage}`;
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
  };

  const createServer = (values: ServerFormValues) => {
    addServer({
      projectId, name: values.name.trim(), ip: values.ip.trim(),
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: "Server added", desc: values.name.trim() });
  };

  const saveEdit = (values: ServerFormValues) => {
    if (!editingServer) return;
    updateServer(editingServer.id, {
      name: values.name.trim(), ip: values.ip.trim(),
      type: values.type, specification: values.specification.trim() || undefined, status: values.status,
    });
    setEditingServer(null);
    showToast({ variant: "success", title: "Server updated", desc: values.name.trim() });
  };

  const handleDelete = (server: Server) => {
    removeServer(server.id);
    showToast({ variant: "warning", title: "Server removed", desc: server.name });
  };

  return (
    <div>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Server &amp; API Management</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "16px" }}>Configure core infrastructure nodes, outgoing mail, and view API documentation.</p>

      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {(["infra", "mail", "api"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0 2px 10px", fontSize: "13px", fontWeight: 700,
              color: subTab === t ? "var(--primary-400)" : "var(--gray-400)",
              borderBottom: subTab === t ? "2px solid var(--primary-400)" : "2px solid transparent",
            }}>
            {t === "infra" ? "Infrastructure" : t === "mail" ? "Mail Server" : "API Documentation"}
          </button>
        ))}
      </div>

      {subTab === "api" ? <ApiDocumentation projectId={projectId} />
        : subTab === "mail" ? <MailSettings projectId={projectId} /> : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search server name or IP…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white" }}
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              style={{ padding: "9px 10px", borderRadius: "10px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white", color: "var(--gray-600)", cursor: "pointer" }}>
              <option value="ALL">All types</option>
              {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={resetFilters}
              style={{ padding: "9px 14px", borderRadius: "10px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              Reset
            </button>
            <button onClick={() => setShowAdd(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Add server
            </button>
          </div>

          {visibleServers.length === 0 ? (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
                {projectServers.length === 0 ? "No servers configured for this project yet." : "No servers match these filters."}
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER }}>
                {["Status", "Server Name", "Server IP", "Server Type", "Specification", ""].map(h => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
                ))}
              </div>
              {pageServers.map(server => {
                const ok = server.status === "success";
                return (
                  <div key={server.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px", padding: "12px 16px", alignItems: "center", borderBottom: BORDER }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ok ? "var(--success-400)" : "var(--danger-400)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: ok ? "var(--success-400)" : "var(--danger-400)" }}>{ok ? "Success" : "Error"}</span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{server.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{server.ip}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{server.type}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{server.specification ?? "—"}</span>
                    <RowActionsMenu actions={[
                      { label: "Edit", onClick: () => setEditingServer(server) },
                      { label: "Remove", onClick: () => handleDelete(server), danger: true },
                    ]} />
                  </div>
                );
              })}
            </div>
          )}

          {visibleServers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                Showing {rangeStart} to {rangeEnd} of {visibleServers.length} entries
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ width: "28px", height: "28px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: currentPage === 1 ? "var(--gray-300)" : "var(--gray-600)", cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 2.9L4.5 7l4.5 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    style={{
                      width: "28px", height: "28px", borderRadius: "8px", border: "none", cursor: "pointer",
                      backgroundColor: n === currentPage ? "var(--primary-400)" : "transparent",
                      color: n === currentPage ? "white" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ width: "28px", height: "28px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: currentPage === totalPages ? "var(--gray-300)" : "var(--gray-600)", cursor: currentPage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 2.9L9.5 7l-4.5 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>Rows per page:</span>
                <select value={rowsPerPage} onChange={e => setRowsPerPage(Number(e.target.value))}
                  style={{ padding: "6px 8px", borderRadius: "8px", border: BORDER, fontSize: "12px", fontFamily: "inherit", backgroundColor: "white", color: "var(--gray-600)", cursor: "pointer" }}>
                  {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <ServerFormModal title="Add server" initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSubmit={createServer} />
      )}
      {editingServer && (
        <ServerFormModal
          title="Edit server"
          initial={{
            name: editingServer.name, ip: editingServer.ip, type: editingServer.type,
            specification: editingServer.specification ?? "", status: editingServer.status,
          }}
          onClose={() => setEditingServer(null)}
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}
