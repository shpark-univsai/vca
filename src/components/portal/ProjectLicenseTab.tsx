"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useVcaStore, UNLIMITED_EXPIRY, PRICE_PER_CHANNEL_PER_YEAR } from "@/lib/vcaStore";
import { CARD_BORDER, PANEL_SHADOW, TYPE_META } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";

// Cumulative — each tier includes everything the tier before it unlocks. "Attendance / Reports"
// is additionally gated by project type below (Smart School only), independent of plan tier.
// These English strings double as lookup keys/identifiers (object keys, .includes() comparisons,
// SCHOOL_ONLY_FEATURE / ALWAYS_LOCKED_FEATURES membership) as well as the plan tier itself
// (project.licensePlan is one of these same strings) — so they stay in English here. Only the
// rendered label goes through FEATURE_LABELS/T below; the tier name itself is left untranslated
// since it's a data value shared with other screens that don't yet localize it.
/**
 * The capability catalogue, reconciled against what the product actually has (2026-09-04).
 *
 * It had drifted both ways: "Crowd Analysis" was listed as included on every Professional and
 * Enterprise project and exists nowhere in the codebase, "Attendance / Reports" showed as included
 * for a Smart School project and likewise does not exist — while four capabilities that are real
 * were missing from the page entirely (Re-ID Analysis is both a camera engine and a Data tab,
 * Best Frame is a screen you can open). A licence page that
 * claims what is not there and omits what is is worse than no licence page.
 *
 * Every entry below is traceable to something in the app: CameraAiFeature in vcaStore (Re-ID
 * Analysis, License Plate Recognition), NavTab in Navbar (BEST FRAME,
 * REDMAP), DataTab in DataPage (Re-ID Analysis, RedFace), or the VIP registry.
 *
 * "Smart Search" was listed here briefly and taken back out: it is implemented, but DATA_TABS is
 * ["Live Monitoring", "Re-ID Analysis", "RedFace"] — the search lives inside Live Monitoring as a
 * collapsible panel, not a destination of its own, so it is how that screen searches rather than
 * something anybody is sold separately.
 *
 * These English strings double as identifiers (object keys, .includes() comparisons) and
 * project.licensePlan is one of the tier names, so they stay in English. Only the rendered label
 * goes through FEATURE_LABELS.
 */
const PLAN_FEATURES: Record<string, string[]> = {
  Starter: ["Face Recognition", "Best Frame"],
  Professional: ["Face Recognition", "Best Frame", "License Plate Recognition"],
  Enterprise: [
    "Face Recognition", "Best Frame", "License Plate Recognition",
    "Re-ID Analysis", "RedMap City Tracking",
    // Named by the licence, not built yet — see NOT_BUILT_REASON. They stay in the Enterprise list
    // because that list is also the display catalogue: a customer should see what is coming.
    "Fire Detection", "Advanced Crowd Behavior", "Attendance / Reports",
  ],
};
const ALL_FEATURES = PLAN_FEATURES.Enterprise;

/**
 * Shown locked whatever the plan says, with the reason. Being in a tier's list is what the contract
 * covers; being in here is whether the software can do it — and the page has to say the second, or
 * it sells a capability the customer cannot use.
 */
const NOT_BUILT_REASON: Record<string, "comingSoon" | "smartSchoolComingSoon" | "analysisComingSoon"> = {
  "Fire Detection": "comingSoon",
  "Advanced Crowd Behavior": "comingSoon",
  "Attendance / Reports": "smartSchoolComingSoon",
  /**
   * Half-built, and the label says which half. The engine is a real CameraAiFeature — it can be
   * assigned to a camera today and the Input Sources tab shows it — but RedMap's vehicle mode has
   * the inputs and not the results, so somebody who reads "included" and goes looking for plate
   * readings finds none. Neither a tick nor a plain "coming soon" is true here.
   */
  "License Plate Recognition": "analysisComingSoon",
};

// Display-only translations for the feature identifiers above — keyed by the same English
// strings used as PLAN_FEATURES values, so translating here never touches the lookup logic.
const FEATURE_LABELS: Record<string, { en: string; ko: string }> = {
  "Face Recognition": { en: "Face Recognition", ko: "얼굴 인식" },
  "Best Frame": { en: "Best Frame", ko: "베스트 프레임" },
  "License Plate Recognition": { en: "License Plate Recognition", ko: "번호판 인식" },
  "Re-ID Analysis": { en: "Re-ID Analysis", ko: "재식별 분석" },
  "RedMap City Tracking": { en: "RedMap City Tracking", ko: "RedMap 시티 트래킹" },
  "Fire Detection": { en: "Fire Detection", ko: "화재 감지" },
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
    smartSchoolComingSoon: "Smart School · coming soon",
    analysisComingSoon: "assignable to cameras · analysis screen coming soon",
    perChannelPerYear: (price: number) => `$${price}/channel/yr`,
    noLimitSet: "No limit set",
    overLimit: (used: number, limit: number) => `Over licensed limit (${used} / ${limit})`,
    aiCameras: "AI Cameras",
    normalCameras: "Normal Cameras (CCTV)",
    // "Available" said what the number was, not what it lets you do. This column exists to answer
    // "can I install another camera", so it answers it.
    channelsAvailable: "Can add",
    atLimit: "Every licensed channel is in use — no further camera can be connected until the limit is raised.",
    nearLimit: (n: number) => `${n} channel(s) left before this project reaches its licensed limit.`,
    contractNote: "Channels and term are changed by contract, not here.",
    bannerChannels: "Channels",
    bannerContract: "Contract",
    channelsUsedOfLimit: (used: number, limit: number) => `${used} of ${limit} channels`,
    canAddN: (n: number) => `${n} can be added`,
    channelsUnlimited: "No limit set — channels are not capped for this project",
    channelsCostPerYear: (cost: string) => `$${cost}/yr`,
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
    smartSchoolComingSoon: "Smart School · 출시 예정",
    analysisComingSoon: "카메라 지정 가능 · 분석 화면 준비 중",
    perChannelPerYear: (price: number) => `채널당 연 $${price}`,
    noLimitSet: "한도 미설정",
    overLimit: (used: number, limit: number) => `라이선스 한도 초과 (${used} / ${limit})`,
    aiCameras: "AI 카메라",
    normalCameras: "일반 카메라 (CCTV)",
    channelsAvailable: "추가 가능",
    atLimit: "라이선스 채널을 모두 쓰고 있습니다 — 한도를 올리기 전까지 카메라를 더 연결할 수 없습니다.",
    nearLimit: (n: number) => `라이선스 한도까지 ${n}채널 남았습니다.`,
    contractNote: "채널과 기간은 계약으로 변경되며 이 화면에서는 바꿀 수 없습니다.",
    bannerChannels: "채널",
    bannerContract: "계약 문의",
    channelsUsedOfLimit: (used: number, limit: number) => `${limit}채널 중 ${used}채널 사용 중`,
    canAddN: (n: number) => `${n}채널 추가 가능`,
    channelsUnlimited: "한도 미설정 — 이 프로젝트는 채널 수 제한이 없습니다",
    channelsCostPerYear: (cost: string) => `연 $${cost}`,
  },
} as const;

// Lucide, at the sizes and weights these were drawn at — see PortalProjectDetailPage's note.
function LockIcon() { return <Lock size={12} strokeWidth={1.1} />; }
function CheckIcon() { return <Check size={12} strokeWidth={1.6} />; }

/**
 * What the licensed channels are being spent on, in Vimeo's Billing-seats shape: the total, then a
 * flat breakdown under it, then one bar showing the split.
 *
 * It replaces three stacked cards (a full-width "subscription" bar, then AI cameras, then normal
 * cameras) that each drew their own bar against the same denominator, so the reader had to add two
 * of them up to learn anything. The number that was missing from all three is the one that decides
 * whether you can install another camera: how many channels are unused. Vimeo shows the same figure
 * as "Unassigned", and it is the whole reason the breakdown is worth drawing.
 */
function ChannelBreakdown({ aiCount, normalCount, limit, yearlyCost, overLimit, t }: {
  aiCount: number;
  normalCount: number;
  limit: number | undefined;
  yearlyCost: number;
  overLimit: boolean;
  t: (typeof T)[keyof typeof T];
}) {
  const used = aiCount + normalCount;
  const available = limit === undefined ? undefined : Math.max(0, limit - used);
  const pct = (n: number) => (limit ? Math.min(100, (n / limit) * 100) : 0);
  /**
   * Said before the wall, not at it.
   *
   * The card only spoke up once the limit was already exceeded — which means the first time anybody
   * learned they were out of channels was a camera that refused to be added. A tenth of the limit
   * (floor of five, because a tenth of ten is one) is enough notice to raise it through a contract,
   * which is the only way it can be raised.
   */
  const atLimit = available === 0 && !overLimit;
  const nearLimit = limit !== undefined && available !== undefined && available > 0
    && available <= Math.max(5, Math.ceil(limit * 0.1));

  const figures = [
    { label: t.aiCameras, value: aiCount, dot: "var(--gray-900)" },
    { label: t.normalCameras, value: normalCount, dot: "var(--gray-400)" },
    // Only meaningful against a limit. With none set there is nothing to be left over from.
    ...(available === undefined ? [] : [{ label: t.channelsAvailable, value: available, dot: "var(--gray-200)" }]),
  ];

  return (
    <div style={{ backgroundColor: "white", border: overLimit ? "1px solid var(--danger-400)" : CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)" }}>
          {limit ? t.channelsUsedOfLimit(used, limit) : t.noLimitSet}
        </p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", whiteSpace: "nowrap" }}>
          {t.perChannelPerYear(PRICE_PER_CHANNEL_PER_YEAR)}
          {limit ? ` · ${t.channelsCostPerYear(yearlyCost.toLocaleString())}` : ""}
        </p>
      </div>

      {/* One bar, segmented, instead of three bars against the same denominator. */}
      <div style={{ display: "flex", height: "5px", backgroundColor: "var(--gray-100)", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
        <div style={{ width: `${pct(aiCount)}%`, backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)" }} />
        <div style={{ width: `${pct(normalCount)}%`, backgroundColor: overLimit ? "var(--danger-200)" : "var(--gray-400)" }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "14px" }}>
        {figures.map(f => (
          <div key={f.label}>
            <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{f.value}</p>
            <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", backgroundColor: f.dot, flexShrink: 0 }} />
              {f.label}
            </p>
          </div>
        ))}
      </div>

      {limit === undefined && (
        <p style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "12px", lineHeight: 1.6 }}>{t.channelsUnlimited}</p>
      )}
      {overLimit && (
        <p style={{ fontSize: "10px", color: "var(--danger-400)", marginTop: "12px" }}>{t.overLimit(used, limit ?? 0)}</p>
      )}
      {/* Not a coloured border: the rim is kept for the state that is already wrong. These two are
          a heads-up, so they are a line of text in warning ink and nothing more. */}
      {atLimit && (
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning-500)", marginTop: "12px", lineHeight: 1.6 }}>{t.atLimit}</p>
      )}
      {!atLimit && nearLimit && (
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning-500)", marginTop: "12px", lineHeight: 1.6 }}>{t.nearLimit(available!)}</p>
      )}
    </div>
  );
}

export default function ProjectLicenseTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const teams = useVcaStore(s => s.teams);
  const cameras = useVcaStore(s => s.cameras);

  // Read after mount, not during render: the clock is not a pure input, and this is the only thing
  // here that needs it. queueMicrotask keeps the setState out of the effect body — same pattern
  // ClientLayout uses for its localStorage read. Reads as not-expired for the first frame.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  if (!project) return null;

  const meta = TYPE_META[project.type];
  const accountManager = teams.find(o => o.id === project.teamId)?.accountManager;
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
        // Equal columns, no divider. Vimeo, Loom, GitHub and Rows all lay a licence summary out as
        // a row of three or four label-over-value columns; clustering the figures at the left with
        // a rule between them was the minority form and left the right half of a wide banner
        // empty. auto-fit so it folds to two-by-two rather than squeezing on a narrow window.
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "24px", alignItems: "start",
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
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{t.licensePeriod}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "white", fontFamily: "monospace" }}>
              {isUnlimitedExpiry ? t.unlimited : (project.licenseExpiresAt ?? "—")}
            </p>
            {yearsRemaining ? <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{t.yrRemaining(yearsRemaining)}</span> : null}
          </div>
        </div>
        {/* Channels, at a glance. The card below breaks the same number down; this is the figure
            the banner exists to carry, the way Vimeo puts "Storage used 64GB of 7TB" beside the
            plan and still gives storage its own section. */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{t.bannerChannels}</p>
          <div style={{ marginTop: "8px" }}>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "white", fontFamily: "monospace" }}>
              {limit ? `${projectCameras.length} / ${limit}` : String(projectCameras.length)}
            </p>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
              {limit ? t.canAddN(Math.max(0, limit - projectCameras.length)) : t.noLimitSet}
            </p>
          </div>
        </div>

        {/* Where every subscription page puts Change plan / Upgrade / Add seats. This product has no
            such button and should not: the licence is an on-premise contract, not a card on file.
            But the page was silent about that, so an administrator who needed a hundred channels
            and had forty-one found nothing here and no hint of where to go instead. As a column
            like the rest, and terse like the rest — the label says what the contact is for, so the
            paragraph that used to say it shrinks to one line.
            The named contact is Team.accountManager — seeded, and the supplier's record rather
            than anything the customer edits here. */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{t.bannerContract}</p>
          <div style={{ marginTop: "8px" }}>
            {accountManager && (
              <>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{accountManager.name}</p>
                <a href={`mailto:${accountManager.email}`}
                  style={{ display: "inline-block", fontSize: "12px", color: "rgba(255,255,255,0.75)", textDecoration: "underline", textUnderlineOffset: "2px", marginTop: "2px" }}>
                  {accountManager.email}
                </a>
              </>
            )}
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "6px", lineHeight: 1.6 }}>{t.contractNote}</p>
          </div>
        </div>
      </div>

      {/* Channels first, features second, each the full width — the order and shape the design
          settles on. It is also the order the two answer questions in: how much of what you paid
          for is in use is the thing an administrator opens this page for, and which capabilities
          the plan includes is a fact that only changes when the plan does. Side by side they were
          competing for the same glance and the segmented bar had half a page to say something a
          full width says better. */}
      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>{t.channelSubscriptions}</p>
      <div style={{ marginBottom: "20px" }}>
        <ChannelBreakdown
          aiCount={aiCameraCount}
          normalCount={normalCameraCount}
          limit={limit}
          yearlyCost={subscriptionYearlyCost}
          overLimit={overLimit}
          t={t}
        />
      </div>

      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "12px" }}>{t.includedFeatures}</p>
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, padding: "18px 20px", marginBottom: "20px" }}>
        <div>
          {/* Two columns. Seven single-line rows made a tall card with an empty right half — and
              unlike the layout above, this one is not copied from anywhere: none of the billing
              pages worth referencing lists features at all (Rows gives a sentence, GitHub links
              out to a comparison), so the shape is ours to choose. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 20px" }}>
            {ALL_FEATURES.map(f => {
              const notBuilt = NOT_BUILT_REASON[f];
              const planIncludes = project.licensePlan ? (PLAN_FEATURES[project.licensePlan] ?? []).includes(f) : false;
              // A tick means "you can use this". The plan covering it is only half of that.
              const included = !notBuilt && planIncludes;
              const featureLabel = FEATURE_LABELS[f]?.[lang] ?? f;
              const label = notBuilt ? `${featureLabel} — ${t[notBuilt]}` : featureLabel;
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
      </div>
    </div>
  );
}
