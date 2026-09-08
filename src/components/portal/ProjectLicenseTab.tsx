"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Lock, UserRound, Video } from "lucide-react";
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
    notSet: "Not set",
    valid: "Valid",
    expired: "Expired",
    // Not "LICENSE PERIOD": a period is a range, and Project carries licenseExpiresAt and no
    // start date, so this column has one date to show. It is the day the licence stops.
    licenseExpiry: "EXPIRES",
    unlimited: "Unlimited",
    yrRemaining: (n: number) => `${n}yr remaining`,
    includedFeatures: "Included Features",
    pendingHeading: "Coming soon",
    smartSchoolOnly: "Smart School only",
    analysisComingSoon: "assignable to cameras",
    perChannelPerYear: (price: number) => `$${price}/channel/yr`,
    noLimitSet: "No limit set",
    overLimit: (used: number, limit: number) => `Over licensed limit (${used} / ${limit})`,
    aiCameras: "AI Cameras",
    normalCameras: "Normal Cameras (CCTV)",
    // "Available" said what the number was, not what it lets you do. This column exists to answer
    // "can I install another camera", so it answers it.
    channelsAvailable: "Can add",
    channelsInUse: "licensed channels in use",
    perChannelLabel: "Per channel",
    yearlyTotalLabel: "Per year",
    atLimit: "Every licensed channel is in use — no further camera can be connected until the limit is raised.",
    nearLimit: (n: number) => `${n} channel(s) left before this project reaches its licensed limit.`,
    contractNote: "Channels and term are changed by contract, not here.",
    bannerContract: "Contract",
    canAddN: (n: number) => `${n} can be added`,
    channelsUnlimited: "No limit set — channels are not capped for this project",
    channelsCostPerYear: (cost: string) => `$${cost}/yr`,
  },
  ko: {
    notSet: "미설정",
    valid: "유효",
    expired: "만료됨",
    licenseExpiry: "만료일",
    unlimited: "무제한",
    yrRemaining: (n: number) => `잔여 ${n}년`,
    includedFeatures: "포함된 기능",
    pendingHeading: "출시 예정",
    smartSchoolOnly: "Smart School 전용",
    analysisComingSoon: "카메라 지정 가능",
    perChannelPerYear: (price: number) => `채널당 연 $${price}`,
    noLimitSet: "한도 미설정",
    overLimit: (used: number, limit: number) => `라이선스 한도 초과 (${used} / ${limit})`,
    aiCameras: "AI 카메라",
    normalCameras: "일반 카메라 (CCTV)",
    channelsAvailable: "추가 가능",
    channelsInUse: "라이선스 채널 사용 중",
    perChannelLabel: "채널당",
    yearlyTotalLabel: "연간",
    atLimit: "라이선스 채널을 모두 쓰고 있습니다 — 한도를 올리기 전까지 카메라를 더 연결할 수 없습니다.",
    nearLimit: (n: number) => `라이선스 한도까지 ${n}채널 남았습니다.`,
    contractNote: "채널과 기간은 계약으로 변경되며 이 화면에서는 바꿀 수 없습니다.",
    bannerContract: "계약 문의",
    canAddN: (n: number) => `${n}채널 추가 가능`,
    channelsUnlimited: "한도 미설정 — 이 프로젝트는 채널 수 제한이 없습니다",
    channelsCostPerYear: (cost: string) => `연 $${cost}`,
  },
} as const;

// Lucide, at the sizes and weights these were drawn at — see PortalProjectDetailPage's note.
function CheckIcon() { return <Check size={12} strokeWidth={2.8} />; }
function LockIcon() { return <Lock size={11} strokeWidth={3.05} />; }

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

  const used = projectCameras.length;
  const available = limit === undefined ? undefined : Math.max(0, limit - used);
  const atLimit = available === 0 && !overLimit;
  const nearLimit = limit !== undefined && available !== undefined && available > 0
    && available <= Math.max(5, Math.ceil(limit * 0.1));
  const pct = (n: number) => (limit ? Math.min(100, (n / limit) * 100) : 0);

  /**
   * Included first, locked after.
   *
   * The catalogue order interleaved them — a tick, a tick, a padlock, two more ticks — so what the
   * project actually has took reading the whole list to work out. What it has is the answer; what
   * it does not is the footnote. Sorted stably, so the catalogue order survives inside each half.
   */
  const featureRows = ALL_FEATURES.map(f => {
    const notBuilt = NOT_BUILT_REASON[f];
    const planIncludes = project.licensePlan ? (PLAN_FEATURES[project.licensePlan] ?? []).includes(f) : false;
    // A tick means "you can use this". The plan covering it is only half of that.
    const included = !notBuilt && planIncludes;
    const featureLabel = FEATURE_LABELS[f]?.[lang] ?? f;
    /**
     * The suffix only says what the group heading does not.
     *
     * Under a "Coming soon" heading, "Fire Detection — coming soon" says it twice. The two that
     * qualify it further keep a suffix: one is gated on a project type as well, and one has an
     * engine you can assign today with no screen to read the result on — which the heading
     * actively contradicts, so it has to be spelled out.
     */
    const suffix = notBuilt === "smartSchoolComingSoon" ? t.smartSchoolOnly
      : notBuilt === "analysisComingSoon" ? t.analysisComingSoon
      : null;
    return { key: f, included, label: suffix ? `${featureLabel} — ${suffix}` : featureLabel };
  });
  const includedRows = featureRows.filter(r => r.included);
  const pendingRows = featureRows.filter(r => !r.included);

  const groupHeading = (text: string, first: boolean) => (
    <p style={{
      fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px",
      textTransform: "uppercase", marginTop: first ? 0 : "24px", marginBottom: "10px",
    }}>{text}</p>
  );

  const featureGrid = (rows: { key: string; label: string }[], included: boolean) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 20px" }}>
      {rows.map(({ key, label }) => (
        <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          {/* A fixed 12px slot so a tick and a padlock leave their labels on the same left edge.
              The padlock reads as "not yours yet" rather than strictly "pay to unlock", which is
              what this group is: some of it is a higher plan, some is not built. The heading above
              it says which, and a padlock is the one glyph nobody has to be taught. */}
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "12px", marginTop: "3px", flexShrink: 0, lineHeight: 1,
            color: included ? "var(--gray-900)" : "var(--gray-300)",
          }}>
            {included ? <CheckIcon /> : <LockIcon />}
          </span>
          <span style={{ fontSize: "12px", lineHeight: 1.5, fontWeight: included ? 700 : 400, color: included ? "var(--gray-900)" : "var(--gray-500)" }}>{label}</span>
        </div>
      ))}
    </div>
  );

  /** Icon + label on the left, value on the right — the shape the reference's rows use. */
  const detailRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "40px", padding: "0 20px", borderTop: BORDER }}>
      <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    /**
     * Full content width, like every other tab.
     *
     * This was capped at 900px and centred, on the reasoning that a card of label-and-value rows
     * reads badly stretched across a monitor. That was true when the tab was one narrow column,
     * and it stopped being true once the banner went to four even columns and the features to two
     * — the card lays itself out in columns now, so width buys legibility rather than spending it.
     * The shell's own cap and gutters are what keep the page from running edge to edge, and they
     * are the same on every tab, which is the point: no tab should be a different width from its
     * neighbours for a reason the reader cannot see.
     */
    <div>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      {/*
        One card for one contract.
        This was a dark banner, a channel card and a feature list — three blocks for a single thing,
        each with its own heading. Remote's subscription page is the arrangement borrowed here: a
        tinted hero carrying the figure the page is opened for, icon-and-value rows under it, and a
        ruled footer for the two numbers nobody reads first.

        Two things from that reference are deliberately left out. Its hero number is money, which
        works for a bill that arrives monthly and not for a licence fixed for three years — the
        figure an administrator comes here for is how much of what they bought is in use, so that
        is the hero and the money is in the footer. And its generative artwork stays out: this app
        took shadows and card borders off its cards on purpose, and decoration would walk that back.
      */}
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, overflow: "hidden", marginBottom: "20px" }}>
        <div style={{
          // gray-900, not the primary step. Purple at full strength across the widest block on the
          // page spent the accent on a background; the palette guidance keeps it to a tenth of a
          // screen, and here the only purple left is the Smart City chip's own text. Over the limit
          // still swaps the whole ground, because that state should be legible from across a room.
          backgroundColor: overLimit ? "var(--danger-400)" : "var(--gray-900)",
          // More air above and below than at the sides: this block is the hero, and on a dark
          // ground a tight top and bottom edge reads as a band rather than as a card's head.
          padding: "28px 20px",
        }}>
          {/* The plan is the title. It was set as a 10px eyebrow over a 32px channel count, which
              made the figure the name of the card — but the figure changes as cameras are added and
              the plan is what the customer signed. The count is still the thing the page is opened
              for, so it keeps the emphasis on the line below rather than the size above it. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "26px", fontWeight: 800, color: "white", lineHeight: 1.15 }}>
              {project.licensePlan ?? t.notSet}
            </p>
            <span style={{ fontSize: "10px", fontWeight: 700, color: meta.color, backgroundColor: "white", padding: "2px 8px", borderRadius: "999px" }}>
              {meta.label}
            </span>
            {project.licenseExpiresAt && nowMs !== null && (
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase",
                backgroundColor: isExpired ? "var(--danger-100)" : "var(--success-100)",
                color: isExpired ? "var(--danger-500)" : "var(--success-400)",
              }}>
                {isExpired ? t.expired : t.valid}
              </span>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginTop: "10px" }}>
            {limit ? (
              <>
                <span style={{ fontSize: "17px", fontWeight: 800, color: "white" }}>{used} / {limit}</span>
                {"  "}{t.channelsInUse} · {t.canAddN(available ?? 0)}
              </>
            ) : (
              <>
                <span style={{ fontSize: "17px", fontWeight: 800, color: "white" }}>{used}</span>
                {"  "}{t.channelsUnlimited}
              </>
            )}
          </p>
          {/* The breakdown stays a single segmented bar: AI cameras and plain CCTV share one
              denominator, so three bars would hide the relationship the number is about. On a
              coloured ground the two segments are the same white at two strengths — a second hue
              here would be a third colour competing inside one figure. */}
          {limit ? (
            <div style={{ display: "flex", height: "6px", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: "3px", overflow: "hidden", marginTop: "14px" }}>
              <div style={{ width: `${pct(aiCameraCount)}%`, backgroundColor: "white" }} />
              <div style={{ width: `${pct(normalCameraCount)}%`, backgroundColor: "rgba(255,255,255,0.55)" }} />
            </div>
          ) : null}
          {/* Warnings become a light pill rather than coloured text: warning-500 on this purple is
              unreadable, and dropping it to white would throw away the one thing the colour was
              carrying. The pill keeps the token and puts a legible ground under it. */}
          {(overLimit || atLimit || nearLimit) && (
            <p style={{
              display: "inline-block", marginTop: "12px", padding: "4px 10px", borderRadius: "999px",
              backgroundColor: "white", lineHeight: 1.6,
              fontSize: "11px", fontWeight: 700,
              color: overLimit ? "var(--danger-500)" : "var(--warning-500)",
            }}>
              {overLimit ? t.overLimit(used, limit ?? 0) : atLimit ? t.atLimit : t.nearLimit(available!)}
            </p>
          )}
        </div>

        {detailRow(<Video size={14} strokeWidth={2.4} />, `${t.aiCameras} · ${t.normalCameras}`, `${aiCameraCount} · ${normalCameraCount}`)}
        {detailRow(
          <CalendarClock size={14} strokeWidth={2.4} />,
          t.licenseExpiry,
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontFamily: "monospace" }}>{isUnlimitedExpiry ? t.unlimited : (project.licenseExpiresAt ?? "—")}</span>
            {yearsRemaining ? <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>{t.yrRemaining(yearsRemaining)}</span> : null}
          </span>,
        )}
        {detailRow(
          <UserRound size={14} strokeWidth={2.4} />,
          t.bannerContract,
          accountManager
            ? <a href={`mailto:${accountManager.email}`} style={{ color: "var(--gray-900)", textDecoration: "underline", textUnderlineOffset: "3px" }}>{accountManager.name}</a>
            : <span style={{ color: "var(--gray-300)" }}>—</span>,
        )}

        {/* Features as a section of the same card, not a card of their own.
            One contract is one card, and a second card holding ten short lines beside it was the
            odd object on the page. No plan page worth copying wraps a single plan's feature list
            in its own box either — Framer just lists them inside the plan card, and the comparison
            tables (Slite, Lyssna, Front, Homerun) are borderless rows under small-caps section
            headings, which is the shape used here. */}
        <div style={{ padding: "18px 20px", borderTop: BORDER }}>
          {groupHeading(t.includedFeatures, true)}
          {featureGrid(includedRows, true)}
          {pendingRows.length > 0 && (
            <>
              {groupHeading(t.pendingHeading, false)}
              {featureGrid(pendingRows, false)}
            </>
          )}
        </div>

        {/* The money, below the rule — it is fixed for the length of the contract, so it is the
            thing on this card nobody opens the page to check. */}
        <div style={{ display: "flex", gap: "20px", padding: "14px 20px", borderTop: BORDER, backgroundColor: "var(--gray-50)", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--gray-500)" }}>{t.perChannelLabel}</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px" }}>{t.perChannelPerYear(PRICE_PER_CHANNEL_PER_YEAR)}</p>
          </div>
          {limit ? (
            <div>
              <p style={{ fontSize: "11px", color: "var(--gray-500)" }}>{t.yearlyTotalLabel}</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px" }}>{t.channelsCostPerYear(subscriptionYearlyCost.toLocaleString())}</p>
            </div>
          ) : null}
          <span style={{ flex: 1 }} />
          <p style={{ fontSize: "11px", color: "var(--gray-500)", maxWidth: "280px", lineHeight: 1.6, alignSelf: "center" }}>{t.contractNote}</p>
        </div>
      </div>
    </div>
  );
}
