"use client";

import { useEffect, useState } from "react";
import { useVcaStore, UNLIMITED_EXPIRY, PRICE_PER_CHANNEL_PER_YEAR } from "@/lib/vcaStore";
import { BORDER, CARD_BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";

// Cumulative — each tier includes everything the tier before it unlocks. "Attendance / Reports"
// is additionally gated by project type below (Smart School only), independent of plan tier.
// These English strings double as lookup keys/identifiers (object keys, .includes() comparisons,
// SCHOOL_ONLY_FEATURE / ALWAYS_LOCKED_FEATURES membership) as well as the plan tier itself
// (project.licensePlan is one of these same strings) — so they stay in English here. Only the
// rendered label goes through FEATURE_LABELS/T below; the tier name itself is left untranslated
// since it's a data value shared with other screens that don't yet localize it.
const PLAN_FEATURES: Record<string, string[]> = {
  Starter: ["Face Recognition", "License Plate Recognition"],
  Professional: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection"],
  Enterprise: ["Face Recognition", "License Plate Recognition", "Crowd Analysis", "Fire Detection", "RedMap City Tracking", "Advanced Crowd Behavior", "Attendance / Reports"],
};
const ALL_FEATURES = PLAN_FEATURES.Enterprise;
const SCHOOL_ONLY_FEATURE = "Attendance / Reports";
// Shown locked regardless of plan or project type — not tied to a purchasable tier yet.
const ALWAYS_LOCKED_FEATURES = ["Advanced Crowd Behavior", "Fire Detection"];

// Display-only translations for the feature identifiers above — keyed by the same English
// strings used as PLAN_FEATURES values, so translating here never touches the lookup logic.
const FEATURE_LABELS: Record<string, { en: string; ko: string }> = {
  "Face Recognition": { en: "Face Recognition", ko: "얼굴 인식" },
  "License Plate Recognition": { en: "License Plate Recognition", ko: "번호판 인식" },
  "Crowd Analysis": { en: "Crowd Analysis", ko: "혼잡도 분석" },
  "Fire Detection": { en: "Fire Detection", ko: "화재 감지" },
  "RedMap City Tracking": { en: "RedMap City Tracking", ko: "RedMap 시티 트래킹" },
  "Advanced Crowd Behavior": { en: "Advanced Crowd Behavior", ko: "고급 군중 행동 분석" },
  "Attendance / Reports": { en: "Attendance / Reports", ko: "출결 / 리포트" },
};

const T = {
  en: {
    title: "License Management",
    subtitle: "This project's license determines which pages and features are exposed.",
    currentPlan: "CURRENT PLAN",
    notSet: "Not set",
    valid: "Valid",
    expired: "Expired",
    licensePeriod: "LICENSE PERIOD",
    unlimited: "Unlimited",
    yrRemaining: (n: number) => `${n}yr remaining`,
    includedFeatures: "Included Features",
    channelSubscriptions: "Channel Subscriptions",
    comingSoon: "Coming soon",
    requiresSmartSchool: "Requires Smart School license",
    channelSubscriptionCard: "Channel Subscription",
    perChannelPerYear: (price: number) => `$${price}/channel/yr`,
    channelsAndCost: (limit: number, cost: string) => `${limit} channels · $${cost}/yr`,
    noLimitSet: "No limit set",
    overLimit: (used: number, limit: number) => `Over licensed limit (${used} / ${limit})`,
    aiCameras: "AI Cameras",
    normalCameras: "Normal Cameras (CCTV)",
    channelsCount: (n: number) => `${n} channels`,
  },
  ko: {
    title: "라이선스 관리",
    subtitle: "이 프로젝트의 라이선스에 따라 노출되는 페이지와 기능이 결정됩니다.",
    currentPlan: "현재 플랜",
    notSet: "미설정",
    valid: "유효",
    expired: "만료됨",
    licensePeriod: "라이선스 기간",
    unlimited: "무제한",
    yrRemaining: (n: number) => `잔여 ${n}년`,
    includedFeatures: "포함된 기능",
    channelSubscriptions: "채널 구독",
    comingSoon: "출시 예정",
    requiresSmartSchool: "Smart School 라이선스 필요",
    channelSubscriptionCard: "채널 구독",
    perChannelPerYear: (price: number) => `채널당 연 $${price}`,
    channelsAndCost: (limit: number, cost: string) => `${limit}채널 · 연 $${cost}`,
    noLimitSet: "한도 미설정",
    overLimit: (used: number, limit: number) => `라이선스 한도 초과 (${used} / ${limit})`,
    aiCameras: "AI 카메라",
    normalCameras: "일반 카메라 (CCTV)",
    channelsCount: (n: number) => `${n}채널`,
  },
} as const;

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
      <path d="M2.5 6.3L4.8 8.6L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function usageCard(label: string, used: number, limit: number | undefined, t: (typeof T)[keyof typeof T]) {
  return (
    <div key={label} style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{t.channelsCount(used)}</p>
      </div>
      <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
        <div style={{ height: "5px", width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%`, backgroundColor: "var(--gray-900)", borderRadius: "3px" }} />
      </div>
    </div>
  );
}

export default function ProjectLicenseTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
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
      <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px", marginBottom: "20px" }}>{t.subtitle}</p>

      {/* Content clusters on the left with a fixed gap rather than stretching to justify-space-between
          — on a wide monitor that would pull "plan" and "expiry" apart to opposite edges of the card,
          hurting the at-a-glance read. A hairline border + monospace date read as precise/enterprise
          without leaning on shadow, blur, or gradient — those were deliberately stripped from this app's
          cards elsewhere, so this stays flat and restrained rather than decorative. */}
      <div style={{
        backgroundColor: "var(--gray-900)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
        boxShadow: PANEL_SHADOW, marginBottom: "20px", padding: "22px 26px",
        display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap",
      }}>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.6px" }}>{t.currentPlan}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
            <p style={{ fontSize: "24px", fontWeight: 800, color: "white" }}>{project.licensePlan ?? t.notSet}</p>
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", letterSpacing: "0.3px", textTransform: "uppercase",
              backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.8)",
            }}>
              {meta.label}
            </span>
            {project.licenseExpiresAt && nowMs !== null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "10px", fontWeight: 600, padding: "3px 9px", borderRadius: "999px", textTransform: "uppercase",
                backgroundColor: isExpired ? "var(--danger-100)" : "var(--success-100)",
                color: isExpired ? "var(--danger-500)" : "var(--success-400)",
              }}>
                {isExpired ? t.expired : t.valid}
              </span>
            )}
          </div>
        </div>
        <div style={{ width: "1px", height: "36px", backgroundColor: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{t.licensePeriod}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "white", fontFamily: "monospace" }}>
              {isUnlimitedExpiry ? t.unlimited : (project.licenseExpiresAt ?? "—")}
            </p>
            {yearsRemaining ? <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{t.yrRemaining(yearsRemaining)}</span> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>{t.includedFeatures}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {ALL_FEATURES.map(f => {
              const isSchoolOnly = f === SCHOOL_ONLY_FEATURE;
              const isAlwaysLocked = ALWAYS_LOCKED_FEATURES.includes(f);
              const typeAllowed = !isSchoolOnly || project.type === "smart_school";
              const planIncludes = project.licensePlan ? (PLAN_FEATURES[project.licensePlan] ?? []).includes(f) : false;
              const included = !isAlwaysLocked && typeAllowed && planIncludes;
              const featureLabel = FEATURE_LABELS[f]?.[lang] ?? f;
              const label = isAlwaysLocked
                ? `${featureLabel} — ${t.comingSoon}`
                : isSchoolOnly && !typeAllowed ? `${featureLabel} — ${t.requiresSmartSchool}` : featureLabel;
              return (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "flex", color: included ? "var(--gray-900)" : "var(--gray-300)" }}>
                    {included ? <CheckIcon /> : <LockIcon />}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: included ? 700 : 600, color: included ? "var(--gray-900)" : "var(--gray-400)" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>{t.channelSubscriptions}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.channelSubscriptionCard}</p>
                <p style={{ fontSize: "12px", color: "var(--gray-500)", whiteSpace: "nowrap" }}>{t.perChannelPerYear(PRICE_PER_CHANNEL_PER_YEAR)}</p>
              </div>
              <div style={{ height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", marginTop: "10px" }}>
                <div style={{ height: "5px", width: "100%", backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)", borderRadius: "3px" }} />
              </div>
              <p style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "8px" }}>
                {limit ? t.channelsAndCost(limit, subscriptionYearlyCost.toLocaleString()) : t.noLimitSet}
              </p>
              {overLimit && <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "4px" }}>{t.overLimit(projectCameras.length, limit ?? 0)}</p>}
            </div>
            {usageCard(t.aiCameras, aiCameraCount, limit, t)}
            {usageCard(t.normalCameras, normalCameraCount, limit, t)}
          </div>
        </div>
      </div>
    </div>
  );
}
