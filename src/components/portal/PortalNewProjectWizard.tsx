"use client";

import { useState } from "react";
import { useVcaStore, type ProjectType } from "@/lib/vcaStore";
import { BORDER } from "./PortalShared";

const TEMPLATES: { type: ProjectType; icon: string; title: string; description: string }[] = [
  { type: "smart_city", icon: "/icons/portal-smart-city.png", title: "Smart City", description: "Urban road network & public area monitoring" },
  { type: "smart_school", icon: "/icons/portal-smart-school.png", title: "Smart School", description: "Face recognition attendance & campus blind spots" },
];

interface PortalNewProjectWizardProps {
  teamId: string;
  onDeployed: (projectId: string) => void;
  defaultType?: ProjectType;
}

export default function PortalNewProjectWizard({ teamId, onDeployed, defaultType = "smart_city" }: PortalNewProjectWizardProps) {
  const addProject = useVcaStore(s => s.addProject);
  const [selectedType, setSelectedType] = useState<ProjectType>(defaultType);
  const [name, setName] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");

  const deploy = () => {
    if (!name.trim() || !teamId) return;
    const existingIds = new Set(useVcaStore.getState().projects.map(p => p.id));
    addProject({ name: name.trim(), teamId, type: selectedType });
    const created = useVcaStore.getState().projects.find(p => !existingIds.has(p.id));
    onDeployed(created?.id ?? "");
  };

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px" }}>
      <span style={{
        display: "flex", alignItems: "center", gap: "6px",
        border: "1px solid var(--primary-200)", backgroundColor: "white", borderRadius: "13px",
        padding: "6px 14px", fontSize: "10px", fontWeight: 600, color: "var(--primary-400)",
      }}>
        ● New Project Setup
      </span>

      <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", marginTop: "18px", textAlign: "center" }}>
        Set Up Your New AI Monitoring Project
      </p>
      <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", textAlign: "center", maxWidth: "560px" }}>
        Welcome to the VCA Portal console. To get started, choose a solution template and fill in your project details.
      </p>

      <div style={{
        backgroundColor: "white", border: BORDER, borderRadius: "20px",
        width: "640px", maxWidth: "100%", boxSizing: "border-box", padding: "27px 32px 32px",
        marginTop: "28px",
      }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "12px" }}>1. Choose a Solution Template</p>
        <div style={{ display: "flex", gap: "16px" }}>
          {TEMPLATES.map(t => {
            const selected = selectedType === t.type;
            return (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                style={{
                  position: "relative", flex: 1, textAlign: "left", cursor: "pointer",
                  border: selected ? "1px solid var(--primary-400)" : BORDER,
                  backgroundColor: selected ? "var(--primary-50)" : "white",
                  borderRadius: "14px", padding: "10px 15px 14px", minHeight: "110px",
                }}
              >
                {selected && (
                  <span style={{
                    position: "absolute", top: "-8px", right: "-8px",
                    width: "24px", height: "24px", borderRadius: "50%",
                    backgroundColor: "var(--primary-400)", display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 4px rgba(90,61,251,0.3)",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                <div style={{ width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", backgroundColor: "var(--gray-50)" }}>
                  <img src={t.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginTop: "10px" }}>{t.title}</p>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginTop: "4px", lineHeight: "16px" }}>{t.description}</p>
              </button>
            );
          })}
        </div>

        <div style={{ height: "1px", backgroundColor: "var(--gray-100)", margin: "16px 0" }} />

        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>2. Project Name</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Guri City Smart School - Phase 3"
          style={{
            width: "100%", boxSizing: "border-box", height: "44px", padding: "0 13px",
            borderRadius: "10px", border: BORDER, backgroundColor: "white",
            fontSize: "13px", fontWeight: 600, fontFamily: "inherit", marginBottom: "16px",
          }}
        />

        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>3. Video Channel Stream (RTSP)</p>
        <div style={{ display: "flex", gap: "16px" }}>
          <input
            value={rtspUrl}
            onChange={e => setRtspUrl(e.target.value)}
            placeholder="Enter your rtsp:// address"
            style={{
              flex: 1, boxSizing: "border-box", height: "44px", padding: "0 13px",
              borderRadius: "10px", border: BORDER, backgroundColor: "white",
              fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
            }}
          />
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "84px", height: "44px", borderRadius: "10px", backgroundColor: "var(--gray-900)",
            color: "white", fontSize: "10px", fontWeight: 600, flexShrink: 0,
          }}>
            RTSP 1CH
          </span>
        </div>

        <button
          onClick={deploy}
          disabled={!name.trim()}
          style={{
            width: "100%", height: "52px", marginTop: "16px", borderRadius: "999px", border: "none",
            backgroundColor: "var(--primary-400)", color: "white", fontSize: "14px", fontWeight: 700,
            cursor: name.trim() ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5,
          }}
        >
          Deploy &amp; Start Monitoring
        </button>
      </div>

      <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "24px", textAlign: "center" }}>
        You&apos;ll be redirected to the monitoring dashboard automatically after deployment
      </p>
    </div>
  );
}
