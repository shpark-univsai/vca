"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Gem, Layers, Mail, MessageSquare, Sprout } from "lucide-react";
import { useVcaStore, isNetworkIsolated, UNLIMITED_EXPIRY } from "@/lib/vcaStore";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TYPE_META, useTypeLabel, usePortalPolicyAccess, MEASURE,
  Drawer, PanelCancel, PanelPrimary, StatusBadge, type StatusTone } from "./PortalShared";
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
    clauseChannels: "Licensed channels",
    // Not "Term": a term is a range, and Project carries licenseExpiresAt and no start date, so
    // this clause has one date to show — the day the licence stops.
    clauseTerm: "Expires",
    clauseScope: "Scope",
    clauseFees: "Fees",
    feesInContract: "Not carried by the licence file. The amount is in the signed agreement.",
    clauseParty: "Account manager",

    // ── The way forward ────────────────────────────────────────
    // Named after what the reader wants, not after the mechanism: nobody opens this screen
    // wanting to "contact" anybody, they open it because the channels are nearly gone or the
    // term is nearly up.
    contactAction: "Ask about this licence",
    contactTitle: "Ask about this licence",
    contactTo: "Goes to",
    contactTopic: "What this is about",
    topicChannels: "More channels",
    topicRenew: "Renew the term",
    contactDraft: "The request",
    contactCopy: "Copy the request",
    contactClose: "Close",
    contactOpenMail: "Open in your mail app",
    contactCopied: "Request copied",
    contactCopyFailed: "Could not copy — select the text and copy it by hand.",
    /* The promise the screen can keep, and it is different at an isolated site. Portal sends
       nothing either way: it writes the request and hands it to you. */
    contactSendsNothing: "Portal does not send this. Copy it into your own mail, or open it in your mail app.",
    contactIsolated: "This site has no route to the internet, so a mail app here cannot deliver it. Copy the request and send it from a machine that can reach outside, or read it over the phone.",
    contactSubjectChannels: (project: string) => `[VCA] ${project} — more licensed channels`,
    contactSubjectRenew: (project: string) => `[VCA] ${project} — licence renewal`,
    /* The draft is the four facts this screen already holds, in the order the document above
       prints them, and one sentence of ask. No invoice figure and no channel count to add to:
       clause 04 says in so many words that this console does not know what anything costs, and a
       request that names a number the console made up is the same fault one screen further out. */
    contactBody: (f: { topic: string; project: string; team: string; plan: string; channels: string; expiry: string }) =>
      `Hello,\n\nWe are writing about the VCA licence on ${f.project}.\n\nRequest: ${f.topic}\n\nTeam: ${f.team}\nPlan: ${f.plan}\nLicensed channels: ${f.channels}\nExpires: ${f.expiry}\n\nCould you tell us what this would involve?`,
    channelsUnitN: (n: number) => `${n} channel${n === 1 ? "" : "s"}`,
    inUseNow: (used: number, avail: number) => `${used} in use · ${avail} free`,
    scopeExcluded: "Not covered",
    channelsCostPerYear: (cost: string) => `$${cost}/yr`,

    // ── Licence file ───────────────────────────────────────────
    fileHeading: "Licence file",
    fileLead: "Channels, term and plan above come from a file Univs.ai signs and issues. Install a new one here when your contract changes.",
    fileOnRecord: (id: string) => `Installed: ${id}`,
    fileNoneOnRecord: "No licence file has been installed on this site.",
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
    clauseChannels: "계약 채널",
    clauseTerm: "만료일",
    clauseScope: "포함 범위",
    clauseFees: "대금",
    feesInContract: "라이선스 파일에 실려 있지 않습니다. 금액은 체결한 계약서에 있습니다.",
    clauseParty: "담당자",

    // ── 문의 경로 ──────────────────────────────────────────────
    contactAction: "라이선스 문의",
    contactTitle: "라이선스 문의",
    contactTo: "받는 사람",
    contactTopic: "문의 내용",
    topicChannels: "채널 추가",
    topicRenew: "기간 갱신",
    contactDraft: "보낼 내용",
    contactCopy: "내용 복사",
    contactClose: "닫기",
    contactOpenMail: "메일 앱에서 열기",
    contactCopied: "복사했습니다",
    contactCopyFailed: "복사하지 못했습니다 — 내용을 직접 선택해 복사하세요.",
    contactSendsNothing: "포털이 대신 보내지 않습니다. 내용을 복사해 직접 보내거나, 메일 앱에서 열어 보내세요.",
    contactIsolated: "이 사이트는 외부 인터넷과 연결되어 있지 않아, 여기서 메일 앱을 열어도 전달되지 않습니다. 내용을 복사해 외부망 단말에서 보내거나 전화로 전달하세요.",
    contactSubjectChannels: (project: string) => `[VCA] ${project} — 채널 추가 문의`,
    contactSubjectRenew: (project: string) => `[VCA] ${project} — 라이선스 갱신 문의`,
    contactBody: (f: { topic: string; project: string; team: string; plan: string; channels: string; expiry: string }) =>
      `안녕하세요,\n\n${f.project}의 VCA 라이선스 관련해 문의드립니다.\n\n문의: ${f.topic}\n\n팀: ${f.team}\n플랜: ${f.plan}\n계약 채널: ${f.channels}\n만료일: ${f.expiry}\n\n진행 방법을 알려주시면 감사하겠습니다.`,
    channelsUnitN: (n: number) => `${n}채널`,
    inUseNow: (used: number, avail: number) => `현재 ${used} 사용 · ${avail} 여유`,
    scopeExcluded: "미포함",
    channelsCostPerYear: (cost: string) => `연 $${cost}`,

    // ── 라이선스 파일 ──────────────────────────────────────────
    fileHeading: "라이선스 파일",
    fileLead: "위의 채널 수와 기간, 플랜은 Univs.ai가 서명해 발급한 파일에서 나옵니다. 계약이 바뀌면 새 파일을 여기서 설치합니다.",
    fileOnRecord: (id: string) => `설치됨: ${id}`,
    fileNoneOnRecord: "이 사이트에 설치된 라이선스 파일이 없습니다.",
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
  /** The licence request panel. Above the guard with every other hook — same rule as the clock. */
  const [contactOpen, setContactOpen] = useState(false);

  if (!project) return null;

  /* Whether a mail app on THIS machine could deliver anything at all. Read through the store's
     own resolver, which is where "the override wins when set, the measurement otherwise" lives —
     an administrator who has told Portal this site is air-gapped should not then be handed a
     mailto: link. */
  const isolatedSite = isNetworkIsolated(project);

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
  const stamp: { label: string; tone: StatusTone } | null =
    nowMs === null ? null
    /* Waiting, not a fault: no expiry on record means no licence file has been installed here
       yet, which is somebody's next step rather than something that broke. */
    : !hasExpiry ? { label: t.notRecorded, tone: "waiting" }
    /* Fault, and the repo settled this once already: ProjectApiPanel badges an expired key
       `fault` and a revoked one `stopped`, which is the split StatusBadge's own note describes —
       red is reserved for what a person did, and a term running out is not that. The word beside
       the mark is what separates 「만료됨」 from 「만료 임박」, and clause 02 still prints the date
       itself in danger red. */
    : isExpired ? { label: t.expired, tone: "fault" }
    /* ONE AMBER STEP, NOT TWO. These two branches carried danger-400 and warning-500 under the
       SAME WORD, so the only thing separating 30 days from 90 was a hue nobody can name. The
       difference survives where it is legible: the banner at the top of this page is red inside
       thirty days and amber outside it, and clause 02's day counter takes the same two colours.
       The stamp says which state the licence is in; those two say how urgent it is. */
    : expiringSoon ? { label: t.expiringSoon, tone: "fault" }
    /* 「정상」 and 「영구」 are quiet, like every other well state in Portal since the badge tones
       were unified — a server that answers, an active account. A lit mark on the one screen with
       nothing wrong with it was the loudest thing on it. */
    : isUnlimitedExpiry ? { label: t.perpetual, tone: "normal" }
    : { label: t.valid, tone: "normal" };


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
          backgroundColor: overLimit ? "var(--danger-100)" : "var(--warning-100)", lineHeight: 1.5,
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
          backgroundColor: expiringUrgently ? "var(--danger-100)" : "var(--warning-100)", lineHeight: 1.5,
          fontSize: "12px", fontWeight: 700,
          color: expiringUrgently ? "var(--danger-500)" : "var(--warning-500)",
        }}>
          {t.expiryNotice(daysRemaining)}
        </p>
      )}

      {/*
        The licence as a document, because that is what it is.

        Everything here was agreed on paper somewhere else and this screen only shows it. Drawn as
        a dashboard it kept promising a control it does not have; somebody reading a usage meter
        and a plan chip looks for the Upgrade button next to them, and there is no such button —
        channels and term change by contract, not by a click in a console.

        THE ONE DOOR IS AT THE FOOT, WHERE THE PARTIES ARE (control audit, 2026-09-29). The page
        having no control at all was the other failure: a licence two channels from full, or six
        weeks from its term ending, is exactly when somebody needs to do something, and the screen
        that says so offered them nowhere to go. What it can honestly offer is not an upgrade
        button but the route the contract already has — the account manager named in the party
        block — so the affordance sits beside that person rather than up in the corner pretending
        to be a purchase.

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
            {/* THE STATE, DRAWN AS A STATE (control audit, 2026-09-29).

                It was a squared box with a 1.5px border and nothing inside it, sitting in the
                top-right corner where every other screen in this console puts its primary action
                — measured at 48×29px, transparent fill, radius 4. So the one thing on the licence
                page that looked pressable was a value, and pressing it did nothing. On a screen
                that had no controls at all, the only control-shaped thing on it was a lie.

                StatusBadge is the console's own vocabulary for "this is what state something is
                in" — pill, tinted fill, no border, one glyph per tone — and it is what the camera
                list, the account list, the API keys and the server tab all draw. Nothing about
                the document idiom needed a private stamp; what the stamp was for (all five states
                decided in one place, none of them a blank space) is in the branch above and is
                unchanged. */}
            {stamp && <StatusBadge tone={stamp.tone} label={stamp.label} />}
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
            <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--gray-400)", marginTop: "10px" }}>
              <span style={{ fontWeight: 700, color: "var(--gray-500)" }}>{t.scopeExcluded}</span>
              {"  "}{pendingRows.map(r => r.label).join(" · ")}
            </p>
          )}
        </Clause>

        {/* NO FIGURE HERE, and there cannot be one.
            This clause printed `$10,000/yr`, computed as channels × a flat constant of 100 that
            lived in vcaStore with no source behind it. Every other clause on this card is real —
            channels, expiry, scope, the contact — so nothing marked this one as a guess, and it
            is the clause an administrator quotes into a renewal request. Money then travels up a
            signing chain with a number this console made up.

            It is not a wiring gap either: `LicensePayload` (lib/licenseFile.ts) carries no fee
            field at all, so the installed licence does not know the price and the server will not
            supply one by being connected. Discounts, tiers, currency and term all live in the
            signed agreement, which is the thing this card is a record OF, not a copy of.

            HANDOFF NOTE: if fees are ever meant to show here, the licence payload needs them —
            amount AND currency AND period. Do not reintroduce a rate constant. */}
        <Clause n={4} label={t.clauseFees} last>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.feesInContract}</p>
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
          {/* THE WAY FORWARD, and it is drawn only where there is one.

              A team with no account manager on record has nobody for this to go to, and a button
              that opens a request addressed to 「—」 is the same empty promise as the box that used
              to sit in the corner. So the row keeps the space-between it always had, and on those
              teams the right-hand side of it stays empty.

              Outline, not the purple primary: this does not buy anything or change anything here.
              It writes the ask and hands it over — see the panel. */}
          {accountManager && (
            <button
              className="portal-btn-outline"
              onClick={() => setContactOpen(true)}
              style={{ ...OUTLINE_BTN, cursor: "pointer" }}
            >
              <MessageSquare size={14} strokeWidth={2.4} />
              {t.contactAction}
            </button>
          )}
        </div>
      </div>

      {contactOpen && accountManager && (
        <LicenseContactPanel
          t={t}
          manager={accountManager}
          isolated={isolatedSite}
          projectName={project.name}
          teamName={projectTeamName ?? project.name}
          plan={project.licensePlan ?? t.notSet}
          channels={limit ? `${t.channelsUnitN(limit)} · ${t.inUseNow(used, available ?? 0)}` : t.noLimitSet}
          expiry={isUnlimitedExpiry ? t.unlimited : (project.licenseExpiresAt ?? t.notRecorded)}
          /* Opens on whichever of the two this licence is actually short of — the same fact the
             banners at the top of the page are already raising. A reader who came down here
             because 「라이선스 한도까지 2채널 남았습니다」 should not have to say so a second time.
             Term first: an expired licence outranks a full one, because a full one still works. */
          initialTopic={isExpired || expiringSoon ? "renew" : "channels"}
          onClose={() => setContactOpen(false)}
        />
      )}

      {/*
        THE LICENCE FILE CARD IS NOT DRAWN (owner, 2026-09-28: 이건 일단 지워줘).

        Not disabled — not drawn, the same call this console made for 프로젝트 삭제. A card that
        offers to install a file the release cannot actually accept is a promise, and a greyed-out
        one still tells the reader the feature is here and they are not allowed to use it, which is
        a different and equally wrong thing.

        `LicenseFileSection` and its copy are kept below, unrendered, because nothing about the
        design was found wanting — the whole card comes back by restoring this one line. What it
        needs first is the server end: where an installed licence file lives and what it replaces.
        Recorded for the backend in HANDOFF-SERVER §10.
      */}
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
/**
 * The bordered look of an outline button, written out.
 *
 * `.portal-btn-outline` only carries the hover transition — the border, the fill and the text
 * colour are the caller's, everywhere else in Portal. The two buttons in this section were passing
 * the class and no border, so they rendered as bare bold text: the install action read as a label
 * sitting in the corner rather than something to press.
 */
const OUTLINE_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "6px",
  height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px",
  border: BORDER, backgroundColor: "white", color: "var(--gray-700)",
  fontSize: "12px", fontWeight: 700, fontFamily: "inherit", flexShrink: 0,
};

/* Kept, not deleted — see the note at its (removed) render site. It comes back by restoring one
   line, and what it waits on is the server end rather than anything about the card. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LicenseFileSection({ projectId, t }: {
  projectId: string;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  /* Owner only (decided 2026-09-14), not canEditPortal like the rest of this console.
     The channel limit and the expiry date come out of this file, and those are CONTRACT terms.
     Under the edit gate, replacing what a site is entitled to sat in the same tray as renaming a
     camera — and an administrator who installs a smaller file takes cameras off the wall without
     anyone agreeing to it. Same reasoning as the VIP-category and search-purpose lists: a power
     whose use changes the limits on the person using it. */
  const { maySetPolicy: mayInstall, reason: refusalReason } = usePortalPolicyAccess();
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
    /* Same 820px column as the document above it, and that is the whole of this style rule.
       Everything else on this tab — the contract card, the limit banner, the expiry banner —
       is a centred 820px block; this one had no cap and stretched to the shell's full width, so
       the page ended with one box twice as wide as the thing it belongs to. It read as a
       different screen stapled to the bottom.

       It stays OUTSIDE the document card, which is the point made where it is rendered: the card
       is the agreement and this is the instrument that delivers it, and a drop zone inside a
       document makes the document look editable. Same column, separate object. */
    <section style={{
      backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW,
      marginTop: "16px", padding: "24px 32px", maxWidth: "820px", marginInline: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
        {/* No measure on this column, unlike the paragraphs inside the panel below. The button
            beside it already sets a right edge, and a second, narrower limit on top of that broke
            one paragraph two lines early while the one under it ran past — two ragged edges in a
            block four lines tall. `text-wrap: pretty` instead, which evens the break rather than
            moving it. */}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", margin: 0 }}>{t.fileHeading}</h3>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, margin: "6px 0 0", textWrap: "pretty" }}>{t.fileLead}</p>
          {/* Only the empty case. "Installing a file replaces these figures" is what the install
              button says by existing; the sentence that was here restated it. What a reader cannot
              see is that this site has NO file at all — an empty box does not say whether it is
              broken or simply not filled in yet. */}
          {project.licenseChannelLimit === undefined && (
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5, margin: "10px 0 0", textWrap: "pretty" }}>
              {t.fileNoneOnRecord}
            </p>
          )}
        </div>
        {!open && (
          <button
            className="portal-btn-outline"
            onClick={() => setOpen(true)}
            disabled={!mayInstall}
            style={{ ...OUTLINE_BTN, color: mayInstall ? "var(--gray-700)" : "var(--gray-300)", cursor: mayInstall ? "pointer" : "not-allowed" }}
          >
            <FileUp size={14} strokeWidth={2.4} />
            {t.fileInstall}
          </button>
        )}
      </div>

      {/* Refusal as readable text, not a tooltip on a disabled control — the same call the row
          menus make, for the same reason: a tooltip on a disabled control is unreliable across
          browsers and this sentence has to be read. */}
      {!mayInstall && !open && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, margin: "12px 0 0" }}>{refusalReason}</p>
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
                lineHeight: 1.45, color: "var(--gray-700)", backgroundColor: "white",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "var(--danger-500)", lineHeight: 1.5, margin: "12px 0 0", maxWidth: MEASURE }}>{error}</p>
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
                <p style={{ fontSize: "12px", color: "var(--warning-500)", lineHeight: 1.5, margin: "12px 0 0", maxWidth: MEASURE }}>{t.fileWarnExpired}</p>
              )}

              {Object.keys(parsed.header).length > 0 && (
                <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, margin: "12px 0 0", maxWidth: MEASURE }}>{t.fileHeaderNote}</p>
              )}
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, margin: "6px 0 0", maxWidth: MEASURE }}>{t.fileServerVerifies}</p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button
              className="portal-btn-outline"
              onClick={close}
              style={{ ...OUTLINE_BTN, color: "var(--gray-600)", cursor: "pointer" }}
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
 * THE LICENCE REQUEST, AND WHAT IT HONESTLY DOES (control audit, 2026-09-29).
 *
 * The audit's finding was that this screen has no way forward: a licence two channels from full,
 * or six weeks from its term ending, is the moment somebody has to act, and the page named the
 * person to act through and gave no way to act.
 *
 * WHAT THIS IS NOT: a purchase, a ticket, or a message this console sends. Portal has no backend
 * behind it (the rest of this console is a front-end the server team builds against) and, more to
 * the point, half the sites this product ships to have no route off their own network. A flow
 * whose last step is a toast reading 「전송되었습니다」 would be a lie at those sites, and the worst
 * kind — the kind that reads exactly like the truth. So nothing here claims to have sent
 * anything. The panel WRITES the request out of what the screen already knows and hands it over:
 * copy it, or open it in a mail app where one can reach outside.
 *
 * The draft is editable on purpose. Everything in it came off the licence document two inches
 * behind the panel, so it is right — but the sentence at the end is somebody else's ask, and a
 * read-only box would make them retype the whole thing to change one line of it.
 *
 * NOTHING IS WRITTEN TO THE AUDIT LOG HERE, and that is deliberate rather than missing. What the
 * console can observe is that a draft was opened and maybe copied; whether a request was ever made
 * is a fact about somebody's mailbox. Recording "asked the account manager for more channels" off
 * a copy button would be a plausible entry nobody can stand behind.
 *
 * HANDOFF NOTE: if the vendor side ever grows a real channel for this (a request queue on the
 * licence issuer), it replaces the footer's copy button — and only then may this screen say a
 * request was sent, and only at sites that can reach it.
 */
function LicenseContactPanel({ t, manager, isolated, projectName, teamName, plan, channels, expiry, initialTopic, onClose }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  manager: { name: string; email: string };
  isolated: boolean;
  projectName: string;
  teamName: string;
  plan: string;
  channels: string;
  expiry: string;
  initialTopic: "channels" | "renew";
  onClose: () => void;
}) {
  const [topic, setTopic] = useState<"channels" | "renew">(initialTopic);
  const topicLabel = topic === "channels" ? t.topicChannels : t.topicRenew;
  const subject = topic === "channels" ? t.contactSubjectChannels(projectName) : t.contactSubjectRenew(projectName);
  const drafted = t.contactBody({ topic: topicLabel, project: projectName, team: teamName, plan, channels, expiry });
  /* Keyed by topic, so switching the two buttons rewrites the draft — but an edited draft is not
     thrown away by a re-render, only by choosing the other topic, which is the reader saying they
     meant to ask something else. */
  const [body, setBody] = useState(drafted);
  const pickTopic = (next: "channels" | "renew") => {
    if (next === topic) return;
    setTopic(next);
    setBody(t.contactBody({
      topic: next === "channels" ? t.topicChannels : t.topicRenew,
      project: projectName, team: teamName, plan, channels, expiry,
    }));
  };

  /*
   * THE ANSWER LANDS ON THE BUTTON, NOT IN A TOAST.
   *
   * A toast was the first shape and it was measured wrong: Portal's toast stack is fixed at the
   * bottom right with z-index 10000, which put a 240×42px card at (1176, 847) directly over this
   * panel's footer, whose ​「닫기」 sits at (1213, 854) — so the confirmation covered both footer
   * buttons for the five seconds it was up, and a hit test on 「닫기」 came back "covered by
   * Request copied". The success message was disabling the panel it was congratulating.
   *
   * The label flip is also the pattern this console already uses wherever a value has to leave
   * the screen by hand (the temporary-password and invite-link boxes in Users), and it answers
   * where the reader is looking: on the thing they just pressed.
   *
   * Success is claimed only once the write RESOLVES. 「복사했습니다」 over a clipboard that refused
   * — no permission, an insecure origin — is how somebody pastes whatever was there before.
   */
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = () => {
    const failed = () => { setCopied(false); setCopyFailed(true); };
    const done = () => {
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    /* No clipboard object at all — an insecure origin, an old browser — is the same answer as a
       write that was refused, and the reader has to be told either way. */
    const write = navigator.clipboard?.writeText(`${subject}\n\n${body}`);
    if (!write) { failed(); return; }
    write.then(done, failed);
  };

  const mailHref = `mailto:${manager.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const label = (text: string) => (
    <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "0.4px", textTransform: "uppercase", margin: "0 0 6px" }}>{text}</p>
  );

  return (
    <Drawer
      title={t.contactTitle}
      onClose={onClose}
      /* The reader has typed into the draft as soon as it differs from what was written for them,
         and the scrim is an ambient target — see Drawer's own note. */
      dirty={body !== drafted}
      footer={<>
        <PanelCancel onClick={onClose} label={t.contactClose} />
        {/* The committing action is COPY, because copying is the only thing on this panel that
            actually happens. At an isolated site it is also the only thing that can. */}
        <PanelPrimary onClick={copy} label={copied ? t.contactCopied : t.contactCopy} />
      </>}
    >
      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* WHO IT GOES TO, first and in full. The party block behind this panel prints the same
            name and address as text rather than as a link, for the reason written there; a request
            addressed to somebody has to show who that is before it shows what it says. */}
        <div>
          {label(t.contactTo)}
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{manager.name}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{manager.email}</p>
        </div>

        <div>
          {label(t.contactTopic)}
          {/* Two choices, both shown. A dropdown would hide the one they did not arrive for, and
              there are only ever two things a licence runs out of. */}
          <div style={{ display: "flex", gap: "8px" }}>
            {([["channels", t.topicChannels], ["renew", t.topicRenew]] as const).map(([value, text]) => (
              <button key={value} type="button" onClick={() => pickTopic(value)}
                style={{
                  height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px",
                  border: topic === value ? "1px solid var(--primary-300)" : BORDER,
                  backgroundColor: topic === value ? "var(--primary-100)" : "white",
                  color: topic === value ? "var(--primary-400)" : "var(--gray-600)",
                  fontSize: "12px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                }}>
                {text}
              </button>
            ))}
          </div>
        </div>

        <div>
          {label(t.contactDraft)}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%", boxSizing: "border-box", minHeight: "260px", resize: "vertical",
              border: BORDER, borderRadius: "8px", padding: "12px 14px",
              fontFamily: "inherit", fontSize: "12px", lineHeight: 1.6,
              color: "var(--gray-700)", backgroundColor: "white",
            }}
          />
        </div>

        {/* The one way this can go wrong, and it has to be readable rather than a flash: the
            request is still on screen and the reader has to get it out by hand. */}
        {copyFailed && (
          <p style={{ fontSize: "12px", color: "var(--danger-500)", lineHeight: 1.5, margin: 0, maxWidth: MEASURE }}>
            {t.contactCopyFailed}
          </p>
        )}

        {/* What the screen promises, said in the site's own terms. Two different sentences,
            because at an air-gapped site the first one would be false. */}
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5, margin: 0, maxWidth: MEASURE }}>
          {isolated ? t.contactIsolated : t.contactSendsNothing}
        </p>

        {/* Offered only where it can work. A mailto: at a site with no route out opens a compose
            window over a message that will sit in an outbox — the reader believes they have sent
            it, which is the failure this whole panel is written around. */}
        {!isolated && (
          <a className="portal-btn-outline" href={mailHref} style={{ ...OUTLINE_BTN, textDecoration: "none", alignSelf: "flex-start" }}>
            <Mail size={14} strokeWidth={2.4} />
            {t.contactOpenMail}
          </a>
        )}
      </div>
    </Drawer>
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
