"use client";

import { useEffect, useState } from "react";
import { useVcaStore, type PortalPermission, type PortalUserStatus } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatElapsed } from "@/lib/time";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, RowActionsMenu } from "./PortalShared";

function InviteUserModal({ defaultProjectId, onClose }: { defaultProjectId: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const addPortalUser = useVcaStore(s => s.addPortalUser);
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [permission, setPermission] = useState<PortalPermission>("operator");
  const [projectIds, setProjectIds] = useState<string[]>(defaultProjectId ? [defaultProjectId] : []);

  const toggleProject = (id: string) =>
    setProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  // Every invite goes through the same flow (admin sets no password — the user verifies by email
  // and sets their own) regardless of deployment; only the mail transport changes. Fully offline
  // on-prem projects can't reach an external mail provider, so those route through the project's
  // internal mailbox instead. See the 2026-08-28 backend-meeting decision this mirrors.
  const selectedProjects = projects.filter(p => projectIds.includes(p.id));
  const hasOnPrem = selectedProjects.some(p => p.regionOnPrem);
  const hasCloud = selectedProjects.some(p => !p.regionOnPrem);
  const mailTransportNote = selectedProjects.length === 0
    ? null
    : hasOnPrem && hasCloud
      ? "Invite will be sent by external email for cloud projects, and the on-prem mailbox for offline projects."
      : hasOnPrem
        ? "This project is offline (on-prem) — invite will be sent through its internal mailbox, not external email."
        : "Invite will be sent by external email.";

  const submit = () => {
    if (!name.trim() || !email.trim() || !orgId) return;
    const id = addPortalUser({ name: name.trim(), email: email.trim(), orgId, projectIds, permission, status: "invited" });
    showToast({ variant: "success", title: "Invite sent", desc: `/password-setup?token=${id}` });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Invite user</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@univs.ai" type="email"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Organization</label>
            <select value={orgId} onChange={e => setOrgId(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit", backgroundColor: "white" }}>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Permission level</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["admin", "operator"] as PortalPermission[]).map(perm => (
                <button key={perm} onClick={() => setPermission(perm)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer", textTransform: "capitalize",
                    border: permission === perm ? "1px solid var(--primary-400)" : BORDER,
                    backgroundColor: permission === perm ? "var(--primary-100)" : "white",
                    color: permission === perm ? "var(--primary-400)" : "var(--gray-600)",
                    fontSize: "13px", fontWeight: 700,
                  }}>
                  {perm}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Projects</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {projects.map(p => {
                const active = projectIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleProject(p.id)}
                    style={{
                      padding: "6px 10px", borderRadius: "999px", cursor: "pointer",
                      border: active ? "1px solid var(--primary-400)" : BORDER,
                      backgroundColor: active ? "var(--primary-100)" : "white",
                      color: active ? "var(--primary-400)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {p.name}
                  </button>
                );
              })}
            </div>
            {mailTransportNote && (
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "8px" }}>{mailTransportNote}</p>
            )}
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!name.trim() || !email.trim()}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: (name.trim() && email.trim()) ? "pointer" : "not-allowed", opacity: (name.trim() && email.trim()) ? 1 : 0.5 }}>
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<PortalUserStatus, { bg: string; color: string }> = {
  active: { bg: "var(--gray-100)", color: "var(--success-400)" },
  invited: { bg: "var(--warning-200)", color: "var(--warning-500)" },
  suspended: { bg: "var(--danger-100)", color: "var(--danger-500)" },
};

function StatusBadge({ status }: { status: PortalUserStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", textTransform: "capitalize",
      backgroundColor: bg, color,
    }}>
      {status}
    </span>
  );
}

function MfaBadge({ enabled }: { enabled?: boolean }) {
  if (!enabled) return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>;
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "5px", backgroundColor: "var(--success-100)" }} title="MFA enabled">
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--success-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}

function AccessRequestsPanel({ projectId }: { projectId: string }) {
  const accessRequests = useVcaStore(s => s.accessRequests);
  const approveAccessRequests = useVcaStore(s => s.approveAccessRequests);
  const dismissAccessRequest = useVcaStore(s => s.dismissAccessRequest);
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  // Read after mount, not during render — see ProjectLicenseTab for the same pattern. Only used
  // for the "requested Xm ago" label, so a first-frame mismatch here would just be cosmetic, but
  // staying consistent avoids surprises.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  const requests = accessRequests.filter(r => r.projectId === projectId);
  if (requests.length === 0) return null;

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = requests.length > 0 && requests.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allSelected ? [] : requests.map(r => r.id));

  const approve = (ids: string[]) => {
    const newUserIds = approveAccessRequests(ids);
    setSelected(prev => prev.filter(id => !ids.includes(id)));
    if (newUserIds.length === 1) {
      showToast({ variant: "success", title: "Access approved — invite sent", desc: `/password-setup?token=${newUserIds[0]}` });
    } else if (newUserIds.length > 1) {
      showToast({ variant: "success", title: `${newUserIds.length} users invited`, desc: "Each will receive their own invite link." });
    }
  };

  return (
    <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "16px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: BORDER, backgroundColor: "var(--gray-50)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: "var(--primary-400)" }} />
          </label>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>Access Requests ({requests.length})</p>
        </div>
        {selected.length > 0 && (
          <button onClick={() => approve(selected)}
            style={{ padding: "7px 14px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Approve {selected.length} selected
          </button>
        )}
      </div>
      <div>
        {requests.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 16px", borderTop: i > 0 ? BORDER : "none" }}>
            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)}
              style={{ accentColor: "var(--primary-400)", marginTop: "3px" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{r.name}</p>
                <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>{r.email}</p>
              </div>
              {r.reason && <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{r.reason}</p>}
              <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "4px" }}>
                Requested {nowMs !== null ? `${formatElapsed(nowMs - new Date(r.requestedAt).getTime())} ago` : "…"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button onClick={() => dismissAccessRequest(r.id)}
                style={{ padding: "7px 12px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                Dismiss
              </button>
              <button onClick={() => approve([r.id])}
                style={{ padding: "7px 12px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PortalUsersPageProps {
  /** Scopes the table to users who have access to this project — mirrors Clerk's per-application Users tab. */
  projectId: string;
}

export default function PortalUsersPage({ projectId }: PortalUsersPageProps) {
  const portalUsers = useVcaStore(s => s.portalUsers);
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const updatePortalUserPermission = useVcaStore(s => s.updatePortalUserPermission);
  const removePortalUser = useVcaStore(s => s.removePortalUser);
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const orgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name ?? orgId;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const currentProject = projects.find(p => p.id === projectId);
  const q = search.trim().toLowerCase();
  const scopedUsers = portalUsers
    .filter(u => u.projectIds.includes(projectId))
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>Users &amp; Permissions</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "4px" }}>
            {currentProject ? <>Showing users with access to <strong style={{ color: "var(--gray-600)" }}>{currentProject.name}</strong>.</> : "Grant Portal (admin) or app (operator) access and scope users to projects."}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Invite user
        </button>
      </div>

      <AccessRequestsPanel projectId={projectId} />

      <div style={{ position: "relative", marginBottom: "12px", maxWidth: "320px" }}>
        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px",
            border: searchFocused ? "1px solid var(--primary-400)" : BORDER, outline: "none",
            boxShadow: searchFocused ? "0 0 0 3px var(--primary-100)" : "none",
            fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
          }}
        />
      </div>

      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.3fr 0.9fr 0.5fr 0.9fr 0.8fr 36px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER }}>
          {["User", "Organization", "Projects", "Permission", "MFA", "Last Login", "Status", ""].map(h => (
            <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
          ))}
        </div>
        {scopedUsers.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
              {q ? "No users match this search." : "No users have access to this project yet."}
            </p>
          </div>
        )}
        {scopedUsers.map(u => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.3fr 0.9fr 0.5fr 0.9fr 0.8fr 36px", padding: "12px 16px", alignItems: "center", borderBottom: BORDER }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{u.name}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>{u.email}</p>
            </div>
            <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{orgName(u.orgId)}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {u.projectIds.length === 0
                ? <span style={{ fontSize: "10px", color: "var(--gray-300)" }}>—</span>
                : u.projectIds.map(pid => (
                  <span key={pid} style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px",
                    color: pid === projectId ? "var(--primary-400)" : "var(--gray-600)",
                    backgroundColor: pid === projectId ? "var(--primary-100)" : "var(--gray-100)",
                  }}>
                    {projectName(pid)}
                  </span>
                ))}
            </div>
            <select
              value={u.permission}
              onChange={e => updatePortalUserPermission(u.id, e.target.value as PortalPermission)}
              style={{
                width: "fit-content", padding: "5px 8px", borderRadius: "8px", border: BORDER,
                fontSize: "12px", fontWeight: 700, fontFamily: "inherit", backgroundColor: "white",
                color: u.permission === "admin" ? "var(--primary-400)" : "var(--gray-600)", textTransform: "capitalize", cursor: "pointer",
              }}>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
            </select>
            <MfaBadge enabled={u.mfaEnabled} />
            <span style={{ fontSize: "10px", color: "var(--gray-500)" }}>{u.lastLoginAt ?? "—"}</span>
            <StatusBadge status={u.status} />
            <RowActionsMenu actions={[
              { label: "Remove user", onClick: () => removePortalUser(u.id), danger: true },
            ]} />
          </div>
        ))}
      </div>

      {showInvite && <InviteUserModal defaultProjectId={projectId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
