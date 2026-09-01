"use client";

import { useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { formatCode, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, FilterSelect, RowActionsMenu } from "./PortalShared";

// "Issued" is shown to admins for what the type calls "unused" — from an admin's point of view the
// interesting fact is "I handed this out, nobody's used it yet," not the code's own internal state.
const STATUS_META: Record<RosterCodeStatus, { label: string; bg: string; color: string }> = {
  "not-issued": { label: "Not issued", bg: "var(--gray-100)", color: "var(--gray-500)" },
  unused: { label: "Issued", bg: "var(--warning-200)", color: "var(--warning-500)" },
  used: { label: "Used", bg: "var(--gray-100)", color: "var(--success-400)" },
  expired: { label: "Expired", bg: "var(--danger-100)", color: "var(--danger-500)" },
};

function StatusBadge({ status }: { status: RosterCodeStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px", backgroundColor: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8S4 3 8 3s6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Masked until clicked, and clicking is what's worth an audit trail — an admin who can see a still-
// live code is an admin who can hand it to the wrong person. Used/expired codes never get a reveal
// control at all: they're dead values, so there's nothing left to protect or show (see PROMPT's
// "사용된 코드는 영구히 숨긴다" — extended here to expired for the same reason, not just used).
function RosterCodeCell({ entry, onReveal }: { entry: RosterEntry; onReveal: () => void }) {
  const [revealed, setRevealed] = useState(false);

  if (entry.status === "not-issued") {
    return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>;
  }
  if (entry.status !== "unused") {
    return <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--gray-300)" }}>••••-••••</span>;
  }
  if (!revealed) {
    return (
      <button
        onClick={() => { setRevealed(true); onReveal(); }}
        style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: "monospace", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}
      >
        ••••-••••
        <span style={{ display: "flex", color: "var(--gray-400)" }}><EyeIcon /></span>
      </button>
    );
  }
  return (
    <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
      {formatCode(entry.code ?? "")}
    </span>
  );
}

function IssueConfirmModal({
  entry, onClose, onConfirm,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onClose);
  const hasCode = !!entry.code;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {hasCode ? "Reissue registration code?" : "Issue registration code?"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.6 }}>
            {hasCode
              ? `${entry.name}'s current code will stop working immediately. Anyone still holding the old printout will need the new one instead.`
              : `A new registration code will be generated for ${entry.name}.`}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {hasCode ? "Reissue code" : "Issue code"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({
  entry, onClose, onConfirm,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Remove {entry.name} from the roster?</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.6 }}>
            {entry.code && entry.status === "unused"
              ? "Their unused registration code is removed with them and can no longer be used to sign up."
              : "This only removes the roster row — it does not affect an account that already signed up."}
          </p>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// Print-only handout sheet — the actual deliverable of this screen. The `visibility` flip (rather
// than `display:none` on everything else) is the standard trick for "print just this one subtree
// regardless of what else the page layout is" — it works without this component needing to know
// anything about PortalShell's chrome outside it.
function PrintSheet({ entries, projectName, onClose }: { entries: RosterEntry[]; projectName: string; onClose: () => void }) {
  useEscapeKey(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "white", zIndex: 500, overflowY: "auto" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #roster-print-sheet, #roster-print-sheet * { visibility: visible; }
          #roster-print-sheet { position: absolute; top: 0; left: 0; width: 100%; }
          .roster-print-toolbar { display: none; }
          .roster-print-slip { break-inside: avoid; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>
      <div className="roster-print-toolbar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
        borderBottom: BORDER, position: "sticky", top: 0, backgroundColor: "white", zIndex: 1,
      }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Handout sheet preview</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{entries.length} slip(s) — cut along the dashed lines.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Close
          </button>
          <button onClick={() => window.print()} style={{ padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Print
          </button>
        </div>
      </div>
      <div id="roster-print-sheet" style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
        {entries.map(entry => (
          <div key={entry.employeeId} className="roster-print-slip" style={{ border: "1px dashed var(--gray-300)", borderRadius: "10px", padding: "18px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{projectName}</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "4px" }}>{entry.name}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace", color: "var(--gray-900)", marginTop: "10px", letterSpacing: "1px" }}>
              {formatCode(entry.code ?? "")}
            </p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px", lineHeight: 1.6 }}>
              Go to the registration page and enter this code to set up your account.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_FILTER_OPTIONS: { value: "ALL" | RosterCodeStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "not-issued", label: "Not issued" },
  { value: "unused", label: "Issued" },
  { value: "used", label: "Used" },
  { value: "expired", label: "Expired" },
];

export default function ProjectRosterTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const staffRoster = useVcaStore(s => s.staffRoster);
  const issueRegistrationCodes = useVcaStore(s => s.issueRegistrationCodes);
  const reissueRegistrationCode = useVcaStore(s => s.reissueRegistrationCode);
  const removeRosterEntry = useVcaStore(s => s.removeRosterEntry);
  const logRosterCodeViewed = useVcaStore(s => s.logRosterCodeViewed);
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<"ALL" | RosterCodeStatus>("ALL");
  const [issuingEntry, setIssuingEntry] = useState<RosterEntry | null>(null);
  const [removingEntry, setRemovingEntry] = useState<RosterEntry | null>(null);
  const [showPrintSheet, setShowPrintSheet] = useState(false);

  const projectName = project?.name ?? projectId;
  const projectRoster = staffRoster.filter(r => r.projectId === projectId);
  const visibleRoster = projectRoster.filter(r => statusFilter === "ALL" || r.status === statusFilter);
  const notIssuedCount = projectRoster.filter(r => r.status === "not-issued").length;
  const printableEntries = projectRoster.filter(r => r.status === "unused" && r.code);

  const bulkIssue = () => {
    const employeeIds = projectRoster.filter(r => r.status === "not-issued").map(r => r.employeeId);
    if (employeeIds.length === 0) return;
    issueRegistrationCodes(employeeIds);
    showToast({ variant: "success", title: "Codes issued", desc: `${employeeIds.length} registration code(s) issued.` });
  };

  const confirmIssueOrReissue = () => {
    if (!issuingEntry) return;
    if (issuingEntry.code) {
      reissueRegistrationCode(issuingEntry.employeeId);
      showToast({ variant: "success", title: "Code reissued", desc: `${issuingEntry.name}'s previous code is no longer valid.` });
    } else {
      issueRegistrationCodes([issuingEntry.employeeId]);
      showToast({ variant: "success", title: "Code issued", desc: issuingEntry.name });
    }
    setIssuingEntry(null);
  };

  const confirmRemove = () => {
    if (!removingEntry) return;
    removeRosterEntry(removingEntry.employeeId);
    showToast({ variant: "warning", title: "Removed from roster", desc: removingEntry.name });
    setRemovingEntry(null);
  };

  const exportCsv = () => {
    const header = ["Name", "Employee ID", "Department", "Permission", "Status", "Code"];
    const rows = projectRoster.map(r => [
      r.name, r.employeeId, r.department ?? "", r.permission === "admin" ? "Admin" : "Operator",
      STATUS_META[r.status].label,
      // Only a still-usable code is worth exporting — a used/expired one can't get anyone signed up.
      r.status === "unused" && r.code ? formatCode(r.code) : "",
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-staff-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: "Export complete", desc: `${projectRoster.length} row(s) exported to CSV.` });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Staff Roster</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>
            Issue registration codes for offline sign-up — no mail required. See who hasn&apos;t joined yet.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
          <button disabled title="Coming soon"
            style={{ padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: "not-allowed" }}>
            Import from Excel
          </button>
          <button onClick={exportCsv}
            style={{ padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Export CSV
          </button>
          <button onClick={() => setShowPrintSheet(true)} disabled={printableEntries.length === 0}
            style={{
              padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white",
              color: printableEntries.length === 0 ? "var(--gray-300)" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 700, cursor: printableEntries.length === 0 ? "not-allowed" : "pointer",
            }}>
            Print handout sheet
          </button>
          <button onClick={bulkIssue} disabled={notIssuedCount === 0}
            style={{
              padding: "10px 16px", borderRadius: "999px", border: "none",
              backgroundColor: notIssuedCount === 0 ? "var(--gray-200)" : "var(--primary-400)",
              color: notIssuedCount === 0 ? "var(--gray-400)" : "white",
              fontSize: "12px", fontWeight: 700, cursor: notIssuedCount === 0 ? "not-allowed" : "pointer",
            }}>
            Issue codes to {notIssuedCount} unassigned
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "16px", maxWidth: "220px" }}>
        <FilterSelect value={statusFilter} onChange={v => setStatusFilter(v as typeof statusFilter)} options={STATUS_FILTER_OPTIONS} />
      </div>

      {visibleRoster.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {statusFilter === "ALL" ? "No staff in this project's roster yet." : "No staff match this filter."}
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 0.8fr 1fr 1.1fr 36px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
            {["Name", "Employee ID", "Department", "Permission", "Status", "Code", ""].map(h => (
              <span key={h} style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{h.toUpperCase()}</span>
            ))}
          </div>
          {visibleRoster.map((entry, i) => {
            const isLast = i === visibleRoster.length - 1;
            return (
              <div key={entry.employeeId} style={{
                display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 0.8fr 1fr 1.1fr 36px", padding: "12px 16px", alignItems: "center",
                borderBottom: isLast ? "none" : BORDER,
                borderBottomLeftRadius: isLast ? "12px" : undefined, borderBottomRightRadius: isLast ? "12px" : undefined,
              }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{entry.name}</p>
                <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{entry.employeeId}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{entry.department ?? "—"}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{entry.permission === "admin" ? "Admin" : "Operator"}</span>
                <div><StatusBadge status={entry.status} /></div>
                <RosterCodeCell entry={entry} onReveal={() => logRosterCodeViewed(entry.employeeId)} />
                <RowActionsMenu actions={[
                  { label: entry.code ? "Reissue code" : "Issue code", onClick: () => setIssuingEntry(entry) },
                  { label: "Remove from roster", onClick: () => setRemovingEntry(entry), danger: true },
                ]} />
              </div>
            );
          })}
        </div>
      )}

      {issuingEntry && (
        <IssueConfirmModal entry={issuingEntry} onClose={() => setIssuingEntry(null)} onConfirm={confirmIssueOrReissue} />
      )}
      {removingEntry && (
        <RemoveConfirmModal entry={removingEntry} onClose={() => setRemovingEntry(null)} onConfirm={confirmRemove} />
      )}
      {showPrintSheet && (
        <PrintSheet entries={printableEntries} projectName={projectName} onClose={() => setShowPrintSheet(false)} />
      )}
    </div>
  );
}
