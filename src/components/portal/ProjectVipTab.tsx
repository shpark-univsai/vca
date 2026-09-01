"use client";

import { useRef, useState } from "react";
import { useVcaStore, type Person } from "@/lib/vcaStore";
import { getFacePhoto } from "@/lib/mockData";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER, PANEL_SHADOW, FilterSelect } from "./PortalShared";

const ROLE_LABELS = ["Regular", "Lead", "Captain", "Health", "Special"];
const PRIORITY_LABELS: NonNullable<Person["priorityLabel"]>[] = ["normal", "high", "very_high"];
const PRIORITY_TEXT: Record<NonNullable<Person["priorityLabel"]>, string> = { normal: "Normal", high: "High", very_high: "Very High" };
const PRIORITY_COLOR: Record<NonNullable<Person["priorityLabel"]>, { bg: string; color: string }> = {
  normal: { bg: "var(--gray-100)", color: "var(--gray-600)" },
  high: { bg: "var(--warning-200)", color: "var(--warning-500)" },
  very_high: { bg: "var(--danger-100)", color: "var(--danger-500)" },
};

interface RegisterValues {
  name: string;
  roleLabel: string;
  priorityLabel: NonNullable<Person["priorityLabel"]>;
  photoUrl?: string;
}

function RegisterVipModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (values: RegisterValues) => void }) {
  useEscapeKey(onClose);
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState(ROLE_LABELS[0]);
  const [priorityLabel, setPriorityLabel] = useState<NonNullable<Person["priorityLabel"]>>("normal");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const valid = name.trim().length > 0;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoFileName(file.name);
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>Add New Person</p>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alexander Wright"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: BORDER, fontSize: "13px", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Tag</label>
              <FilterSelect value={roleLabel} onChange={setRoleLabel} options={ROLE_LABELS.map(r => ({ value: r, label: r }))} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Priority</label>
              <FilterSelect
                value={priorityLabel}
                onChange={v => setPriorityLabel(v as typeof priorityLabel)}
                options={PRIORITY_LABELS.map(p => ({ value: p, label: PRIORITY_TEXT[p] }))}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>Face photo</label>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            <button type="button" onClick={() => photoInputRef.current?.click()}
              style={{
                width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: photoPreview ? "10px" : "24px", borderRadius: "10px", border: "1px dashed var(--gray-300)",
                backgroundColor: "var(--gray-50)", cursor: "pointer",
              }}>
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photoFileName}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", flexShrink: 0 }}>Change</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>Upload photo</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: BORDER, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => valid && onSubmit({ name: name.trim(), roleLabel, priorityLabel, photoUrl: photoPreview ?? undefined })} disabled={!valid}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleTag({ label }: { label: string }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "999px", backgroundColor: "var(--gray-100)", color: "var(--gray-600)", textTransform: "uppercase" }}>
      {label}
    </span>
  );
}

function PriorityTag({ priority }: { priority: NonNullable<Person["priorityLabel"]> }) {
  const { bg, color } = PRIORITY_COLOR[priority];
  return (
    <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "999px", backgroundColor: bg, color, textTransform: "uppercase" }}>
      {PRIORITY_TEXT[priority]}
    </span>
  );
}

export default function ProjectVipTab({ projectId }: { projectId: string }) {
  const persons = useVcaStore(s => s.persons);
  const addPerson = useVcaStore(s => s.addPerson);
  const removePerson = useVcaStore(s => s.removePerson);
  const { showToast } = useToast();
  const [showRegister, setShowRegister] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = search.trim().toLowerCase();
  const projectPersons = persons
    .filter(p => p.projectId === projectId)
    .filter(p => !q || p.name.toLowerCase().includes(q));

  const register = (values: RegisterValues) => {
    addPerson({
      name: values.name, type: "VIP", photoUrl: values.photoUrl ?? getFacePhoto(values.name),
      registeredAt: new Date().toISOString().slice(0, 10),
      roleLabel: values.roleLabel, priorityLabel: values.priorityLabel,
      projectId,
    });
    setShowRegister(false);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then(text => {
      const rows = text.split("\n").map(r => r.trim()).filter(Boolean);
      // Tolerate an optional "name,description" header row from spreadsheet exports.
      const dataRows = rows[0]?.toLowerCase().startsWith("name") ? rows.slice(1) : rows;
      let count = 0;
      dataRows.forEach(row => {
        const [name, description] = row.split(",").map(v => v?.trim());
        if (!name) return;
        addPerson({
          name, type: "VIP", photoUrl: getFacePhoto(name),
          registeredAt: new Date().toISOString().slice(0, 10),
          description: description || undefined,
          projectId,
        });
        count++;
      });
      showToast({ variant: count > 0 ? "success" : "warning", title: count > 0 ? "Bulk upload complete" : "No rows imported", desc: count > 0 ? `${count} VIP(s) registered from ${file.name}.` : "Expected CSV rows as \"name,description\"." });
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>VIP Registry</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>Register watchlist individuals for this project&apos;s cameras to detect.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleBulkUpload} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9.33V1.75M7 1.75 4.08 4.67M7 1.75 9.92 4.67M2.33 9.92v1.17c0 .64.53 1.16 1.17 1.16h7c.64 0 1.17-.52 1.17-1.16V9.92" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Bulk Upload
          </button>
          <button onClick={() => setShowRegister(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Register VIP
          </button>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: "16px", maxWidth: "320px" }}>
        <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M12 12L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 30px", borderRadius: "10px",
            border: searchFocused ? "1px solid var(--gray-400)" : BORDER, outline: "none",
            boxShadow: searchFocused ? "0 0 0 3px var(--gray-100)" : "none",
            fontSize: "12px", fontFamily: "inherit", backgroundColor: "white",
          }}
        />
      </div>

      {projectPersons.length === 0 ? (
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--gray-400)" }}>
            {q ? "No VIPs match this search." : "No VIPs registered for this project yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {projectPersons.map(person => (
            <div key={person.id} style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "14px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <img src={person.photoUrl} alt="" style={{ width: "44px", height: "44px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {(person.roleLabel || person.priorityLabel) && (
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    {person.roleLabel && <RoleTag label={person.roleLabel} />}
                    {person.priorityLabel && <PriorityTag priority={person.priorityLabel} />}
                  </div>
                )}
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{person.name}</p>
                {person.description && <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "2px" }}>{person.description}</p>}
                <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "4px" }}>Registered {person.registeredAt}</p>
              </div>
              <button onClick={() => removePerson(person.id)} title="Remove VIP" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex", padding: "4px", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M2.91663 4.08333H11.0833M5.83329 6.41667V9.33333M8.16663 6.41667V9.33333M3.49996 4.08333L4.08329 10.9167C4.08329 11.2261 4.20621 11.5228 4.42501 11.7416C4.6438 11.9604 4.9405 12.0833 5.24996 12.0833H8.74996C9.05942 12.0833 9.35612 11.9604 9.57491 11.7416C9.79371 11.5228 9.91663 11.2261 9.91663 10.9167L10.5 4.08333M5.24996 4.08333V2.33333C5.24996 2.17862 5.31142 2.03025 5.42082 1.92085C5.53022 1.81146 5.67858 1.75 5.83329 1.75H8.16663C8.32134 1.75 8.4697 1.81146 8.5791 1.92085C8.68849 2.03025 8.74996 2.17862 8.74996 2.33333V4.08333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showRegister && <RegisterVipModal onClose={() => setShowRegister(false)} onSubmit={register} />}
    </div>
  );
}
