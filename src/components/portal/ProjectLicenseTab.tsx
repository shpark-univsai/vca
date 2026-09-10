"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gem, Layers, Sprout } from "lucide-react";
import { useVcaStore, UNLIMITED_EXPIRY, PRICE_PER_CHANNEL_PER_YEAR } from "@/lib/vcaStore";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TYPE_META, useTypeLabel, usePortalEditAccess } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  parseLicenseFile, diffLicense, licenseAlreadyExpired,
  type ParsedLicense, type LicenseParseError,
} from "@/lib/licenseFile";

// Cumulative — each tier includes everything the tier before it unlocks.
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
 * Every entry below is traceable to something in the app: NavTab in Navbar (BEST FRAME, REDMAP),
 * DataTab in DataPage (Re-ID Analysis, RedFace), or the VIP registry.
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
   * Half-built, and the label says which half. RedMap's vehicle mode has the inputs and not the
   * results, so somebody who reads "included" and goes looking for plate readings finds none.
   * Neither a tick nor a plain "coming soon" is true here.
   *
   * It used to be assignable to a camera as well, which made this line contradict the Input
   * Sources tab — four cameras claimed to be running an engine this page filed under COMING SOON.
   * Per-camera engines are gone (2026-09-09): analysis belongs to the server, not the camera.
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
    unlimited: "Unlimited",
    yrRemaining: (n: number) => `${n}yr remaining`,
    monthsRemaining: (n: number) => `${n} month${n === 1 ? "" : "s"} remaining`,
    daysRemaining: (n: number) => `${n} day${n === 1 ? "" : "s"} remaining`,
    expiringSoon: "Expiring soon",
    perpetual: "Perpetual",
    notRecorded: "No expiry on record",
    expiryNotice: (n: number) => `This licence expires in ${n} day${n === 1 ? "" : "s"}. Renewing is a contract change, so start it with whoever signs.`,
    smartSchoolOnly: "Smart School only",
    analysisComingSoon: "readings not available yet",
    perChannelPerYear: (price: number) => `$${price}/channel/yr`,
    noLimitSet: "No limit set",
    overLimit: (used: number, limit: number) => `Over licensed limit (${used} / ${limit})`,
    expiredOn: "expired",
    atLimit: "Every licensed channel is in use — no further camera can be connected until the limit is raised.",
    nearLimit: (n: number) => `${n} channel(s) left before this project reaches its licensed limit.`,
    contractNote: "Channels and term are changed by contract, not here.",
    clauseChannels: "Licensed channels",
    // Not "Term": a term is a range, and Project carries licenseExpiresAt and no start date, so
    // this clause has one date to show — the day the licence stops.
    clauseTerm: "Expires",
    clauseScope: "Scope",
    clauseFees: "Fees",
    clauseParty: "Account manager",
    channelsUnitN: (n: number) => `${n} channel${n === 1 ? "" : "s"}`,
    inUseNow: (used: number, avail: number) => `${used} in use · ${avail} free`,
    scopeExcluded: "Not covered",
    channelsCostPerYear: (cost: string) => `$${cost}/yr`,

    // ── Licence file ───────────────────────────────────────────
    fileHeading: "Licence file",
    fileLead: "Channels, term and plan above come from a file Univs.ai signs and issues. Install a new one here when your contract changes.",
    fileOnRecord: (id: string) => `Installed: ${id}`,
    fileNoneOnRecord: "No licence file has been installed on this site.",
    fileNoneHint: "The figures above were configured before licence files existed. Installing a file replaces them with what the file says.",
    fileInstall: "Install a licence file",
    fileCancel: "Cancel",
    fileDropLabel: "Drop the .lic file here, or paste its text",
    filePastePlaceholder: "-----BEGIN VCA LICENSE-----",
    fileChoose: "Choose file",
    fileReview: "Review",
    fileApply: "Install this licence",
    fileApplied: (id: string) => `Licence ${id} installed`,
    fileWhatChanges: "What this changes",
    fileNoChange: "unchanged",
    fileFieldPlan: "Plan",
    fileFieldChannels: "Channels",
    fileFieldExpiry: "Expiry",
    fileIssuedTo: "Issued to",
    fileLicenceId: "Licence",
    fileKeyId: "Signing key",
    fileHeaderNote: "The lines above the signed block are a human-readable label. The server reads only the signed part — editing the label changes nothing.",
    fileServerVerifies: "This preview is what the file appears to contain. Whether it is genuine is decided by the server, which holds the key.",
    fileWarnExpired: "This licence's term has already ended. Installing it will not extend anything — ask for a reissued file. (If this site's clock is wrong, that would also produce this message.)",
    fileErrEmpty: "Nothing to read. Drop a file or paste its text.",
    fileErrNoArmor: "This looks like part of a licence file. Copy the whole thing, including the BEGIN and END lines.",
    fileErrNotJws: "This is not a licence file. A licence is one long line of three dot-separated parts between the BEGIN and END lines.",
    fileErrBadBase64: "The signed part of this file is damaged — it did not survive being copied. Ask for the file itself rather than pasted text.",
    fileErrBadJson: "The signed part of this file could not be read. Ask for it to be reissued.",
    fileErrMissing: (fields: string) => `This file is missing what a licence has to say: ${fields}. Ask for it to be reissued.`,
    fileErrSchema: (n: number) => `This licence was written for a newer version of VCA (format ${n}). Upgrade this installation, or ask for a file in the current format.`,
  },
  ko: {
    notSet: "미설정",
    valid: "유효",
    expired: "만료됨",
    unlimited: "무제한",
    yrRemaining: (n: number) => `잔여 ${n}년`,
    monthsRemaining: (n: number) => `${n}개월 남음`,
    daysRemaining: (n: number) => `${n}일 남음`,
    expiringSoon: "만료 임박",
    perpetual: "무기한",
    notRecorded: "만료일 미기록",
    expiryNotice: (n: number) => `라이선스가 ${n}일 뒤 만료됩니다. 갱신은 계약 변경이라 결재선을 타야 하니 미리 시작하세요.`,
    smartSchoolOnly: "Smart School 전용",
    analysisComingSoon: "판독 결과는 아직 없음",
    perChannelPerYear: (price: number) => `채널당 연 $${price}`,
    noLimitSet: "한도 미설정",
    overLimit: (used: number, limit: number) => `라이선스 한도 초과 (${used} / ${limit})`,
    expiredOn: "만료됨",
    atLimit: "라이선스 채널을 모두 쓰고 있습니다 — 한도를 올리기 전까지 카메라를 더 연결할 수 없습니다.",
    nearLimit: (n: number) => `라이선스 한도까지 ${n}채널 남았습니다.`,
    contractNote: "채널과 기간은 계약으로 변경되며 이 화면에서는 바꿀 수 없습니다.",
    clauseChannels: "계약 채널",
    clauseTerm: "만료일",
    clauseScope: "포함 범위",
    clauseFees: "대금",
    clauseParty: "담당자",
    channelsUnitN: (n: number) => `${n}채널`,
    inUseNow: (used: number, avail: number) => `현재 ${used} 사용 · ${avail} 여유`,
    scopeExcluded: "미포함",
    channelsCostPerYear: (cost: string) => `연 $${cost}`,

    // ── 라이선스 파일 ──────────────────────────────────────────
    fileHeading: "라이선스 파일",
    fileLead: "위의 채널 수와 기간, 플랜은 Univs.ai가 서명해 발급한 파일에서 나옵니다. 계약이 바뀌면 새 파일을 여기서 설치합니다.",
    fileOnRecord: (id: string) => `설치됨: ${id}`,
    fileNoneOnRecord: "이 사이트에 설치된 라이선스 파일이 없습니다.",
    fileNoneHint: "위 값들은 라이선스 파일이 생기기 전에 설정된 것입니다. 파일을 설치하면 파일에 적힌 값으로 대체됩니다.",
    fileInstall: "라이선스 파일 설치",
    fileCancel: "취소",
    fileDropLabel: ".lic 파일을 여기에 놓거나, 내용을 붙여넣으세요",
    filePastePlaceholder: "-----BEGIN VCA LICENSE-----",
    fileChoose: "파일 선택",
    fileReview: "확인",
    fileApply: "이 라이선스를 설치",
    fileApplied: (id: string) => `라이선스 ${id}를 설치했습니다`,
    fileWhatChanges: "무엇이 바뀌는가",
    fileNoChange: "그대로",
    fileFieldPlan: "플랜",
    fileFieldChannels: "채널",
    fileFieldExpiry: "만료",
    fileIssuedTo: "발급 대상",
    fileLicenceId: "라이선스",
    fileKeyId: "서명 키",
    fileHeaderNote: "서명된 블록 위의 줄들은 사람이 읽으라고 붙인 설명입니다. 서버는 서명된 부분만 읽습니다 — 설명을 고쳐도 아무것도 바뀌지 않습니다.",
    fileServerVerifies: "이 미리보기는 파일이 담고 있다고 말하는 내용입니다. 진짜인지는 키를 가진 서버가 판단합니다.",
    fileWarnExpired: "이 라이선스의 기간은 이미 끝났습니다. 설치해도 아무것도 연장되지 않으니 재발급을 요청하세요. (이 사이트의 시계가 틀려도 같은 문구가 나옵니다.)",
    fileErrEmpty: "읽을 것이 없습니다. 파일을 놓거나 내용을 붙여넣으세요.",
    fileErrNoArmor: "라이선스 파일의 일부로 보입니다. BEGIN과 END 줄을 포함해서 전체를 복사해주세요.",
    fileErrNotJws: "라이선스 파일이 아닙니다. 라이선스는 BEGIN과 END 줄 사이에 점으로 나뉜 세 부분이 한 줄로 들어 있습니다.",
    fileErrBadBase64: "이 파일의 서명된 부분이 손상됐습니다 — 복사되는 과정에서 깨졌습니다. 붙여넣기 대신 파일 자체를 받아주세요.",
    fileErrBadJson: "이 파일의 서명된 부분을 읽지 못했습니다. 재발급을 요청하세요.",
    fileErrMissing: (fields: string) => `라이선스가 반드시 담아야 할 것이 빠져 있습니다: ${fields}. 재발급을 요청하세요.`,
    fileErrSchema: (n: number) => `이 라이선스는 더 새로운 버전의 VCA용으로 만들어졌습니다(형식 ${n}). 이 설치를 업그레이드하거나, 현재 형식의 파일을 요청하세요.`,
  },
} as const;

/**
 * How each plan is marked: an icon in the tier's own colour before its name.
 *
 * Chatbase's plan list is the reference — every tier carries a small coloured glyph, so the tiers
 * are told apart by shape and hue before the word is read. Adapted to the palette this product
 * actually has, with one rule the reference did not need: a tier's colour may not be success,
 * warning or danger, because the validity stamp two inches to the right is drawn in exactly those
 * and two green things on one line meaning different kinds of thing is worse than no colour.
 *
 * So the ladder runs in the accent and the neutrals, and weight descends with the tier: Enterprise
 * takes the product's own purple, Professional a solid neutral, Starter an outline. An unknown
 * plan string falls back to the Starter treatment rather than throwing — licensePlan is a free
 * string in the model and a plan nobody has named yet should still render.
 */
const PLAN_META: Record<string, { color: string; bg: string; border?: string; Icon: typeof Gem }> = {
  Enterprise:   { color: "var(--primary-400)", bg: "var(--primary-100)", Icon: Gem },
  Professional: { color: "var(--gray-900)",    bg: "var(--gray-100)",    Icon: Layers },
  Starter:      { color: "var(--gray-500)",    bg: "transparent", border: "1px solid var(--gray-300)", Icon: Sprout },
};
const planMetaFor = (plan?: string) => (plan && PLAN_META[plan]) || PLAN_META.Starter;

// Lucide, at the size and weight this was drawn at — see PortalProjectDetailPage's note. The
// padlock that used to sit beside it went with the list of locked features: what a licence does
// not cover is now a named line, not a row of shut doors.
function CheckIcon() { return <Check size={12} strokeWidth={2.8} />; }

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
  const typeLabel = useTypeLabel();
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

  const planMeta = planMetaFor(project.licensePlan);
  const projectTeam = teams.find(o => o.id === project.teamId);
  const projectTeamName = projectTeam?.name;
  const accountManager = projectTeam?.accountManager;
  const projectCameras = cameras.filter(c => c.projectId === projectId);
  const limit = project.licenseChannelLimit;
  const overLimit = !!limit && projectCameras.length > limit;

  const isUnlimitedExpiry = project.licenseExpiresAt === UNLIMITED_EXPIRY;
  const hasExpiry = !!project.licenseExpiresAt;
  const isExpired = !isUnlimitedExpiry && !!project.licenseExpiresAt && nowMs !== null && new Date(project.licenseExpiresAt).getTime() < nowMs;
  /**
   * How long is left, in days, and the two thresholds read off it.
   *
   * It was years only, as `Math.max(1, Math.round(...))` — which printed "1yr remaining" over a
   * licence expiring next Tuesday, because anything under six months rounds to zero and the max
   * put it back to one. A contract running out is the one thing on this page somebody has to act
   * on before it happens, and the page was rounding the warning away.
   *
   * Ninety days because renewing a licence is a purchase order, not a click: it goes through
   * whoever signs, and a fortnight's notice is not notice. Thirty is when it stops being a note
   * and starts being a problem, which is the amber-to-red line below.
   *
   * The counter switches to days at sixty, one step earlier: "2 months" and "2 months" are the
   * same words for eight weeks and nine, and inside a quarter the number of days is the thing
   * being planned against.
   */
  const daysRemaining = !isUnlimitedExpiry && !isExpired && project.licenseExpiresAt && nowMs !== null
    ? Math.ceil((new Date(project.licenseExpiresAt).getTime() - nowMs) / 86_400_000)
    : null;
  const expiringSoon = daysRemaining !== null && daysRemaining <= 90;
  const expiringUrgently = daysRemaining !== null && daysRemaining <= 30;
  const remainingText = daysRemaining === null ? null
    : daysRemaining <= 60 ? t.daysRemaining(daysRemaining)
    : daysRemaining < 365 ? t.monthsRemaining(Math.round(daysRemaining / 30))
    : t.yrRemaining(Math.round(daysRemaining / 365));

  /**
   * The one place the licence's state is decided.
   *
   * Ordered worst-first so the answer is the first true thing: expired outranks expiring, and both
   * outrank a date that is simply far away. Null only before the clock is known — for one frame,
   * where a guessed stamp would be corrected in front of the reader.
   */
  const stamp: { label: string; color: string } | null =
    nowMs === null ? null
    : !hasExpiry ? { label: t.notRecorded, color: "var(--gray-400)" }
    : isExpired ? { label: t.expired, color: "var(--danger-400)" }
    : expiringUrgently ? { label: t.expiringSoon, color: "var(--danger-400)" }
    : expiringSoon ? { label: t.expiringSoon, color: "var(--warning-500)" }
    : isUnlimitedExpiry ? { label: t.perpetual, color: "var(--success-400)" }
    : { label: t.valid, color: "var(--success-400)" };

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
        One card for one contract, on the same white ground as every other page.

        The head of this card was gray-900 — the only dark surface in Portal, borrowed from the
        pricing-page idiom (a tinted hero carrying the plan name at 26px). Two things were wrong
        with it here. It made the licence tab look like a different product from the tab beside
        it, which is the complaint the settings page had just been fixed for. And it put the
        largest type on the page on the least useful fact: the plan name is what was signed once,
        while the figure somebody opens this page for is how much of it is in use.

        So the figure is the hero now and the plan is a chip beside the status, and the sections
        below use the same small-caps headings and the same label-above-value pairs the settings
        card uses — one kit, two pages.
      */}
      {/* Alerts sit OUTSIDE the document, above it.
          A contract does not warn you that you are near its limit — the console does. Putting
          these inside the record would have the paper commenting on itself. */}
      {(overLimit || atLimit || nearLimit) && (
        <p style={{
          display: "block", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
          maxWidth: "820px", marginInline: "auto",
          backgroundColor: overLimit ? "var(--danger-100)" : "var(--warning-100)", lineHeight: 1.6,
          fontSize: "12px", fontWeight: 700,
          color: overLimit ? "var(--danger-500)" : "var(--warning-500)",
        }}>
          {overLimit ? t.overLimit(used, limit ?? 0) : atLimit ? t.atLimit : t.nearLimit(available!)}
        </p>
      )}
      {/* No consequence clause.
   
          This said "cameras stop being processed on the expiry date" until 2026-09-10, and
          nothing in the product does that — there is no enforcement anywhere, and the licence
          value it would key off is a plain mutable field. So the screen was threatening an
          operator with something we had not built.
   
          It is also the wrong thing to promise. Deciding what expiry does is open (see the
          vendor-admin review), and the argument there runs the other way for a public-safety
          product: the loss from under-enforcing is a late invoice, the loss from over-enforcing
          is a surveillance system dark during an incident at a school or a station. Whatever is
          settled, a renewal banner is not where it should first appear.
   
          HANDOFF NOTE: when the backend defines expiry behaviour, the sentence to add here is
          what actually happens — and if the answer is "nothing stops", this banner is already
          correct as written. */}
      {expiringSoon && daysRemaining !== null && (
        <p style={{
          display: "block", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
          maxWidth: "820px", marginInline: "auto",
          backgroundColor: expiringUrgently ? "var(--danger-100)" : "var(--warning-100)", lineHeight: 1.6,
          fontSize: "12px", fontWeight: 700,
          color: expiringUrgently ? "var(--danger-500)" : "var(--warning-500)",
        }}>
          {t.expiryNotice(daysRemaining)}
        </p>
      )}

      {/*
        The licence as a document, because that is what it is.

        Everything here was agreed on paper somewhere else and this screen only shows it — which is
        why the page has no actions and ends with "changed by contract, not here". Drawn as a
        dashboard it kept promising a control it does not have; somebody reading a usage meter and
        a plan chip looks for the Upgrade button next to them. A record does not owe anybody a
        button, so the form settles the question the disclaimer was left to answer.

        Borrowed from the conventions of a contract, not from paper: a titled head with the status
        stamped beside it, numbered clauses, term-and-value in two columns with a rule between each,
        a party block at the foot. No cream ground, no serif, no seal — the design system's own
        type and palette, arranged the way an agreement is arranged.

        Capped at 820px and centred. Every other tab runs the full width because it holds a table,
        and a document is not a table — a clause read across 1,400px of monitor is the one measure
        this page must not have.

        Centred rather than left-aligned, which is what it was first: flush left at 820px it read
        as a full-width card that had failed to stretch, because its left edge lined up with every
        other tab and its right edge did not. Centred, the same width reads as a page on a desk —
        every document reader puts one there — and the margins are the point rather than a gap.
      */}
      <div style={{
        backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW,
        overflow: "hidden", marginBottom: "20px", maxWidth: "820px", marginInline: "auto",
      }}>
        {/* The head names the document and stamps its state, the way the first page of an
            agreement does. */}
        <div style={{ padding: "28px 32px", borderBottom: "2px solid var(--gray-900)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            {/*
              The head names the SUBJECT, not the page.

              It said "Licence", which is the word the breadcrumb 20px above already says — so the
              line carried no information and read as filler, which is exactly the "page introducing
              itself twice" this file warns against elsewhere. A contract's first line is not
              "Contract"; it is what the contract is for. So: the plan, and under it the project it
              covers.

              Those two were clauses 01 and 02 a moment ago and are gone from the list with this —
              the head states the subject and the clauses state the terms, and neither repeats the
              other.
            */}
            <div style={{ minWidth: 0 }}>
              <p style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {/* The tier's own mark, in a tinted square rather than loose beside the word: a
                    bare glyph at this size reads as punctuation, and the square gives the colour
                    enough area to register as a grade. */}
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  width: "30px", height: "30px", borderRadius: "8px",
                  backgroundColor: planMeta.bg, border: planMeta.border ?? "none", color: planMeta.color,
                }}>
                  <planMeta.Icon size={16} strokeWidth={2.1} />
                </span>
                <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", lineHeight: "28px" }}>
                  {project.licensePlan ?? t.notSet}
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: TYPE_META[project.type].color, backgroundColor: TYPE_META[project.type].bg, padding: "3px 8px", borderRadius: "999px" }}>
                  {typeLabel(project.type)}
                </span>
              </p>
              <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px" }}>
                {project.name}{projectTeamName ? ` · ${projectTeamName}` : ""}
              </p>
            </div>
            {/* The stamp. Squared off, not a pill: a pill is a chip in a product and this is the
                mark on a document — and it is the one place the status is stated, so it sits beside
                the title rather than in a row of chips further down.

                All five states are decided here rather than as they arise, so none of them is a
                blank space later. "No expiry recorded" used to render nothing at all, which reads
                as a valid licence to anybody who does not know the stamp exists; and a perpetual
                licence read VALID, which is true and says less than it could. */}
            {stamp && (
              <span style={{
                /* Sentence case. Caps are the convention on a rubber stamp and they read as
                   shouting on a screen — and the longest state here is "No expiry on record",
                   which in caps is a shout nobody needs. The box already says "stamp"; the letters
                   only have to say the word. */
                flexShrink: 0, fontSize: "11px", fontWeight: 700,
                padding: "5px 10px", borderRadius: "4px",
                border: `1.5px solid ${stamp.color}`, color: stamp.color,
              }}>
                {stamp.label}
              </span>
            )}
          </div>
        </div>

        {/* The clauses. Numbered because they are a fixed, ordered set — the same four terms in
            the same order for every project, which is what makes a number worth printing.

            Padding on the group, not on the first and last clause: the ends of a schedule stand
            further off its rules than the clauses stand off each other, and putting it here keeps
            every clause's own padding identical so the rules between them stay evenly spaced.

            The whole schedule is set loose on purpose. A contract is read once, slowly, one clause
            at a time — the density that suits a table of sixty cameras is the wrong density for
            five clauses somebody is checking against a signed page. */}
        <div style={{ padding: "20px 0" }}>
        <Clause n={1} label={t.clauseChannels}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>
            {limit ? t.channelsUnitN(limit) : t.noLimitSet}
          </p>
          {/* What was bought is the clause; what is in use today is not. It is printed under the
              clause in the console's own voice — smaller, grey, with the meter — so the reader can
              see the difference between the agreement and the fleet. */}
          {limit ? (
            <>
              <p style={{ fontSize: "12px", color: overLimit ? "var(--danger-500)" : "var(--gray-500)", marginTop: "3px" }}>
                {t.inUseNow(used, available ?? 0)}
              </p>
              <div style={{ display: "flex", height: "5px", backgroundColor: "var(--gray-200)", borderRadius: "3px", overflow: "hidden", marginTop: "8px", maxWidth: "260px" }}>
                <div style={{ width: `${pct(used)}%`, backgroundColor: overLimit ? "var(--danger-400)" : "var(--primary-400)" }} />
              </div>
            </>
          ) : null}
        </Clause>

        <Clause n={2} label={t.clauseTerm}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: isExpired ? "var(--danger-500)" : "var(--gray-900)", fontFamily: "monospace", letterSpacing: "-0.01em" }}>
            {isUnlimitedExpiry ? t.unlimited : (project.licenseExpiresAt ?? "—")}
          </p>
          {project.licenseExpiresAt && nowMs !== null && !isUnlimitedExpiry && (
            <p style={{ fontSize: "12px", marginTop: "3px", color: expiringUrgently ? "var(--danger-500)" : expiringSoon ? "var(--warning-500)" : "var(--gray-500)" }}>
              {isExpired ? t.expiredOn : remainingText}
            </p>
          )}
        </Clause>

        <Clause n={3} label={t.clauseScope}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "6px 20px" }}>
            {includedRows.map(r => (
              <p key={r.key} style={{ display: "flex", alignItems: "baseline", gap: "7px", fontSize: "13px", fontWeight: 600, color: "var(--gray-900)" }}>
                <span style={{ display: "flex", color: "var(--gray-900)", flexShrink: 0, transform: "translateY(1px)" }}><CheckIcon /></span>{r.label}
              </p>
            ))}
          </div>
          {/* What the agreement does NOT cover, named rather than listed with padlocks. A reader
              asking "does this cover plates" needs the answer, and the answer is one line. */}
          {pendingRows.length > 0 && (
            <p style={{ fontSize: "12px", lineHeight: 1.7, color: "var(--gray-400)", marginTop: "10px" }}>
              <span style={{ fontWeight: 700, color: "var(--gray-500)" }}>{t.scopeExcluded}</span>
              {"  "}{pendingRows.map(r => r.label).join(" · ")}
            </p>
          )}
        </Clause>

        <Clause n={4} label={t.clauseFees} last>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>
            {limit ? t.channelsCostPerYear(subscriptionYearlyCost.toLocaleString()) : "—"}
          </p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "3px" }}>{t.perChannelPerYear(PRICE_PER_CHANNEL_PER_YEAR)}</p>
        </Clause>
        </div>

        {/* The party block, where an agreement puts its signatures. Not a fake signature — the
            person and the way to reach them, which is what this record can honestly carry. */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", padding: "28px 32px", borderTop: "1px solid var(--gray-900)", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px", textTransform: "uppercase" }}>{t.clauseParty}</p>
            {/* Name and address, both as text. It was a mailto link on the name, which underlines
                a person and hides the address behind them — the reader who wants to write has to
                trust a link to know where it goes, and the reader who wants to phone or forward the
                address gets nothing. A record shows what it holds. */}
            {accountManager ? (
              <p style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginTop: "5px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{accountManager.name}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{accountManager.email}</span>
              </p>
            ) : (
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-400)", marginTop: "5px" }}>—</p>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, maxWidth: "300px", textAlign: "right" }}>{t.contractNote}</p>
        </div>
      </div>

      {/* Outside the document, deliberately.
          The card above is the agreement — what was bought, printed the way a contract prints. The
          file is the instrument that delivers it, and putting a drop zone inside a document makes
          the document look editable, which is the one thing this page has spent its whole design
          saying it is not. */}
      <LicenseFileSection projectId={projectId} t={t} />
    </div>
  );
}

/**
 * Where a licence file comes in.
 *
 * The counterpart to the vendor's issuer: they sign a file, somebody carries it here, this takes
 * it. Until this existed the channel count on a site had no way of arriving at all — a project
 * created today gets no limit, and a site with no limit cannot connect a camera, so the first day
 * of every installation was a dead end. That is the hole this closes.
 *
 * Three states in one place rather than a wizard: what is installed, what you are about to
 * install, and what that would change. A licence is one artifact and one decision, and the reader
 * needs the before and after side by side at the moment they decide — a step-by-step flow puts the
 * old values on a screen they have already left.
 */
function LicenseFileSection({ projectId, t }: {
  projectId: string;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const installLicenseFile = useVcaStore(s => s.installLicenseFile);
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedLicense | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Same reason as the tab above: the clock is not a pure input. Only used to warn about a licence
  // that is already past its term, so a first frame without it simply omits the warning.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  if (!project) return null;

  const describeError = (e: LicenseParseError): string => {
    switch (e.kind) {
      case "empty": return t.fileErrEmpty;
      case "noArmor": return t.fileErrNoArmor;
      case "notJws": return t.fileErrNotJws;
      case "badBase64": return t.fileErrBadBase64;
      case "badJson": return t.fileErrBadJson;
      case "missingClaims": return t.fileErrMissing(e.fields.join(", "));
      case "unsupportedSchema": return t.fileErrSchema(e.schema);
    }
  };

  const read = (value: string) => {
    setText(value);
    if (!value.trim()) { setParsed(null); setError(null); return; }
    const result = parseLicenseFile(value);
    if (result.ok) { setParsed(result.license); setError(null); }
    else { setParsed(null); setError(describeError(result.error)); }
  };

  const readFile = (file: File) => {
    file.text().then(read).catch(() => setError(t.fileErrBadJson));
  };

  const close = () => { setOpen(false); setText(""); setParsed(null); setError(null); };

  const apply = () => {
    if (!parsed) return;
    const p = parsed.payload;
    installLicenseFile(projectId, {
      licenseId: p.licenseId,
      plan: p.plan,
      channelLimit: p.limits.channels,
      expiresAt: p.term.perpetual || !p.term.expiresAt ? UNLIMITED_EXPIRY : p.term.expiresAt,
    });
    showToast({ variant: "success", title: t.fileApplied(p.licenseId) });
    close();
  };

  const diff = parsed
    ? diffLicense(parsed.payload, {
        plan: project.licensePlan,
        channels: project.licenseChannelLimit,
        expiresAt: project.licenseExpiresAt,
      }, t.unlimited)
    : null;
  const expiredOnArrival = parsed && nowMs !== null && licenseAlreadyExpired(parsed.payload, nowMs);

  const fieldLabel = { plan: t.fileFieldPlan, channels: t.fileFieldChannels, expiry: t.fileFieldExpiry };

  return (
    <section style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW, marginTop: "16px", padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", margin: 0 }}>{t.fileHeading}</h3>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, margin: "6px 0 0", maxWidth: "62ch" }}>{t.fileLead}</p>
          {/* What is on record today. A site configured before licence files existed has numbers
              with no file behind them, and saying so is more useful than an empty line — it tells
              the reader why installing a file will change figures they thought were settled. */}
          <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.7, margin: "10px 0 0" }}>
            {project.licenseChannelLimit === undefined ? t.fileNoneOnRecord : t.fileNoneHint}
          </p>
        </div>
        {!open && (
          <button
            className="portal-btn-outline"
            onClick={() => setOpen(true)}
            disabled={!mayEdit}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", flexShrink: 0, cursor: mayEdit ? "pointer" : "not-allowed" }}
          >
            {t.fileInstall}
          </button>
        )}
      </div>

      {/* Refusal as readable text, not a tooltip on a disabled control — the same call the row
          menus make, for the same reason: a tooltip on a disabled control is unreliable across
          browsers and this sentence has to be read. */}
      {!mayEdit && !open && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, margin: "12px 0 0" }}>{readOnlyReason}</p>
      )}

      {open && (
        <div style={{ marginTop: "20px", borderTop: BORDER, paddingTop: "20px" }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            style={{
              border: `1px dashed ${dragging ? "var(--gray-900)" : "var(--gray-300)"}`,
              borderRadius: "12px",
              backgroundColor: dragging ? "var(--gray-50)" : "transparent",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-600)", margin: 0 }}>{t.fileDropLabel}</p>
              <button
                className="portal-btn-quiet"
                onClick={() => fileInput.current?.click()}
                style={{ height: "28px", padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
              >
                {t.fileChoose}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".lic,.txt,text/plain"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }}
                style={{ display: "none" }}
              />
            </div>
            {/* Paste is the primary path, not a fallback. At an internet-isolated site the file may
                not be allowed to cross the boundary at all, and what arrives is text read out of an
                internal mailbox or off another screen. */}
            <textarea
              value={text}
              onChange={e => read(e.target.value)}
              placeholder={t.filePastePlaceholder}
              spellCheck={false}
              style={{
                width: "100%", boxSizing: "border-box", minHeight: "96px", resize: "vertical",
                border: BORDER, borderRadius: "8px", padding: "10px 12px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px",
                lineHeight: 1.6, color: "var(--gray-700)", backgroundColor: "white",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "var(--danger-500)", lineHeight: 1.7, margin: "12px 0 0", maxWidth: "70ch" }}>{error}</p>
          )}

          {parsed && diff && (
            <div style={{ marginTop: "16px" }}>
              <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr)", gap: "6px 16px", margin: 0, fontSize: "12px" }}>
                <dt style={{ color: "var(--gray-500)" }}>{t.fileLicenceId}</dt>
                <dd style={{ margin: 0, color: "var(--gray-900)", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{parsed.payload.licenseId}</dd>
                <dt style={{ color: "var(--gray-500)" }}>{t.fileIssuedTo}</dt>
                <dd style={{ margin: 0, color: "var(--gray-700)" }}>{parsed.payload.customer.name}</dd>
                {parsed.keyId && (<>
                  <dt style={{ color: "var(--gray-500)" }}>{t.fileKeyId}</dt>
                  <dd style={{ margin: 0, color: "var(--gray-700)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{parsed.keyId}</dd>
                </>)}
              </dl>

              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px", textTransform: "uppercase", margin: "18px 0 8px" }}>{t.fileWhatChanges}</p>
              <div style={{ border: BORDER, borderRadius: "8px", overflow: "hidden" }}>
                {diff.map((row, i) => (
                  <div
                    key={row.field}
                    style={{
                      display: "grid", gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr) 16px minmax(0, 1fr)",
                      gap: "12px", alignItems: "baseline", padding: "10px 14px",
                      borderBottom: i === diff.length - 1 ? "none" : BORDER,
                      backgroundColor: row.changed ? "var(--warning-100)" : "transparent",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{fieldLabel[row.field]}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>{row.before ?? "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{row.changed ? "→" : ""}</span>
                    <span style={{ fontSize: "12px", fontWeight: row.changed ? 700 : 400, color: row.changed ? "var(--gray-900)" : "var(--gray-400)", fontVariantNumeric: "tabular-nums" }}>
                      {row.changed ? row.after : t.fileNoChange}
                    </span>
                  </div>
                ))}
              </div>

              {expiredOnArrival && (
                <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.7, margin: "12px 0 0", maxWidth: "70ch" }}>{t.fileWarnExpired}</p>
              )}

              {Object.keys(parsed.header).length > 0 && (
                <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, margin: "12px 0 0", maxWidth: "70ch" }}>{t.fileHeaderNote}</p>
              )}
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: "70ch" }}>{t.fileServerVerifies}</p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button
              className="portal-btn-outline"
              onClick={close}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              {t.fileCancel}
            </button>
            <button
              className="portal-btn-primary"
              onClick={apply}
              disabled={!parsed}
              style={{
                height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none",
                backgroundColor: parsed ? "var(--primary-400)" : "var(--gray-200)",
                color: parsed ? "white" : "var(--gray-400)",
                fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
                cursor: parsed ? "pointer" : "not-allowed",
              }}
            >
              {t.fileApply}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * One numbered clause: its number and name on the left, its content on the right.
 *
 * The two-column term-and-value shape an agreement's schedule uses, with a rule under each clause
 * so the eye can find where one ends. The label column is fixed rather than a fraction — clauses
 * line up down the page only if the gutter is the same on every row, and a fraction moves it every
 * time the window does.
 */
function Clause({ n, label, last, children }: { n: number; label: string; last?: boolean; children: React.ReactNode }) {
  return (
    /* The last clause drops its rule: the party block below already opens with a heavier one, and
       two lines with 16px of nothing between them is a mistake, not a division.

       32px at the sides, matching the shell's own gutter — a document has margins, and at 20px the
       clauses sat as close to the paper's edge as a table's cells do. */
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 168px) minmax(0, 1fr)", gap: "0 24px", padding: "24px 32px", borderBottom: last ? "none" : BORDER }}>
      <p style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
        {/* Tabular figures and a fixed slot, so 1 and 5 leave their labels on the same left edge. */}
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-300)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {String(n).padStart(2, "0")}
        </span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>{label}</span>
      </p>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
