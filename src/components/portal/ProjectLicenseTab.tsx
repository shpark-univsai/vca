"use client";

import { useEffect, useState } from "react";
import { useVcaStore, UNLIMITED_EXPIRY, PRICE_PER_CHANNEL_PER_YEAR } from "@/lib/vcaStore";
import { BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";

// Cumulative — each tier includes everything the tier before it unlocks. "Attendance / Reports"
// is additionally gated by project type below (Smart School only), independent of plan tier.
const PLAN_FEATURES: Record<string, string[]> = {
  Starter: ["Face Recognition", "License Plate Recognition"],
  Professional: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection"],
  Enterprise: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection", "RedMap City Tracking", "Advanced Crowd Behavior", "Attendance / Reports"],
};
const ALL_FEATURES = PLAN_FEATURES.Enterprise;
const SCHOOL_ONLY_FEATURE = "Attendance / Reports";

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M4 5.5V3.8a2 2 0 0 1 4 0V5.5" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.3L4.8 8.6L9.5 3.5" stroke="var(--success-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function usageCard(label: string, used: number, limit: number | undefined) {
  return (
    <div key={label} style={{ backgroundColor: "white", border: BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{used} channels</p>
      </div>
      <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
        <div style={{ height: "5px", width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%`, backgroundColor: "var(--gray-900)", borderRadius: "3px" }} />
      </div>
    </div>
  );
}

export default function ProjectLicenseTab({ projectId }: { projectId: string }) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);

  // Read after mount, not during render: the clock is not a pure input, and this is the only thing
  // here that needs it. queueMicrotask keeps the setState out of the effect body — same pattern
  // ClientLayout uses for its localStorage read. Reads as not-expired for the first frame.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  if (!project) return null;

  const meta = TYPE_META[project.type];
  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const aiCameraCount = projectCameras.filter(c => (c.aiFeatures ?? []).length > 0).length;
  const normalCameraCount = projectCameras.length - aiCameraCount;
  const limit = project.licenseChannelLimit;
  const overLimit = !!limit && projectCameras.length > limit;

  const isUnlimitedExpiry = project.licenseExpiresAt === UNLIMITED_EXPIRY;
  const isExpired = !isUnlimitedExpiry && !!project.licenseExpiresAt && nowMs !== null && new Date(project.licenseExpiresAt).getTime() < nowMs;
  const yearsRemaining = !isUnlimitedExpiry && !isExpired && project.licenseExpiresAt && nowMs !== null
    ? Math.max(1, Math.round((new Date(project.licenseExpiresAt).getTime() - nowMs) / (365 * 24 * 60 * 60 * 1000)))
    : null;

  const subscriptionYearlyCost = (limit ?? 0) * PRICE_PER_CHANNEL_PER_YEAR;

  return (
    <div>
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>License Management</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>This project&apos;s license determines which pages and features are exposed.</p>

      <div style={{ backgroundColor: "var(--gray-900)", borderRadius: "12px", boxShadow: PANEL_SHADOW, marginBottom: "20px", padding: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.4px" }}>CURRENT PLAN</p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "white", marginTop: "6px" }}>{meta.label} — {project.licensePlan ?? "Not set"}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          {project.licenseExpiresAt && nowMs !== null && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              fontSize: "10px", fontWeight: 600, padding: "3px 9px", borderRadius: "999px", textTransform: "uppercase",
              backgroundColor: isExpired ? "var(--danger-100)" : "var(--success-100)",
              color: isExpired ? "var(--danger-500)" : "var(--success-400)",
            }}>
              {isExpired ? "Expired" : "Valid"}
            </span>
          )}
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.6)", marginTop: "10px" }}>EXPIRES ON</p>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "white", marginTop: "2px" }}>
            {isUnlimitedExpiry ? "Unlimited" : (project.licenseExpiresAt ?? "—")}{yearsRemaining ? ` (${yearsRemaining}yr)` : ""}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>Included Features</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ALL_FEATURES.map(f => {
              const isSchoolOnly = f === SCHOOL_ONLY_FEATURE;
              const typeAllowed = !isSchoolOnly || project.type === "smart_school";
              const planIncludes = project.licensePlan ? (PLAN_FEATURES[project.licensePlan] ?? []).includes(f) : false;
              const included = typeAllowed && planIncludes;
              const label = isSchoolOnly && !typeAllowed ? `${f} — Requires Smart School license` : f;
              return (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: included ? "var(--success-100)" : "var(--gray-50)" }}>
                  <span style={{ display: "flex", color: included ? "var(--success-400)" : "var(--gray-400)" }}>
                    {included ? <CheckIcon /> : <LockIcon />}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: included ? "var(--gray-900)" : "var(--gray-400)" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>Channel Subscriptions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>Channel Subscription</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>${PRICE_PER_CHANNEL_PER_YEAR}/channel/yr</p>
              </div>
              <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
                <div style={{ height: "5px", width: "100%", backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)", borderRadius: "3px" }} />
              </div>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "8px" }}>
                {limit ? `${limit} channels · $${subscriptionYearlyCost.toLocaleString()}/yr` : "No limit set"}
              </p>
              {overLimit && <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "4px" }}>Over licensed limit ({projectCameras.length} / {limit})</p>}
            </div>
            {usageCard("AI Cameras", aiCameraCount, limit)}
            {usageCard("Normal Cameras (CCTV)", normalCameraCount, limit)}
          </div>
        </div>
      </div>
    </div>
  );
}
