"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, type AccessEventKind, type AccessRecord } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import { DateRangeTrigger, dateKeyOf, type DateRangeValue } from "../shared/DateRangePicker";
import {
  CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR, TABLE_RULE, TOOLBAR_GAP,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, TableEmpty, TableLoadFailed, TableSkeleton, sortRows, useTableSort} from "./PortalShared";
import { FileOutput, Lock, LogIn, LogOut, ShieldX } from "lucide-react";
import { RADIUS } from "../shared/controls";

/**
 * Who got in, who tried and failed, and from which machine.
 *
 * 접속 기록 — the one log a Korean deployment is REQUIRED to keep (개인정보의 안전성 확보조치
 * 기준 제8조). The tab next door answers "who looked somebody up" and the one before it answers
 * "what changed"; this one answers only the door.
 *
 * NOT FILTERED BY PROJECT, and that is the single thing about this screen a reader cannot work
 * out from the rows. A person signs in to the INSTALLATION, not to a site (see AccessRecord), so
 * `projectId` is read for the project's clock and for the retention figure and never for the
 * row set. Filtering it here would print an empty table beside a tab counting 8.
 *
 * NOTHING ON THIS SCREEN MAY REMOVE A ROW (고시 제8조제3항, 위변조 방지). There is no row menu,
 * no hide, no delete, and no "clean up" — export is the only thing a reader may do with these
 * rows, and that is deliberate rather than unbuilt. A later hand adding a kebab to this table
 * breaks the obligation the table exists to satisfy.
 *
 * WHAT WAS TAKEN FROM THE PRODUCTS THAT ALREADY DO THIS:
 *  - Okta's System Log makes the OUTCOME its own scanned column, and a lockout is its own value
 *    (LOCKED_OUT) rather than something the reader derives by counting failures. Both kept: the
 *    outcome is a column, and AccessEventKind already separates `lockedOut` from `refused`.
 *  - Mercury's Company Security list is the row shape — one quiet glyph plus a word for the
 *    event, the machine as a plain column, an export beside the filters. Kept.
 *  - 1Password's Activity Log puts Date / Actor / Events as peer filter chips. Kept, in this
 *    repo's own FilterSelect + ActiveFilterCount vocabulary.
 *  - Genetec's Activity trails treats the "initiator machine" as a first-class column rather
 *    than a detail-pane footnote. Kept — the IP sits in the table, not behind a row click.
 * AND WHAT WAS NOT:
 *  - Proton's Security logs draw Location / ISP / Device columns that are permanently empty
 *    without the paid add-on. That is the exact failure this repo bans: a dashed cell on every
 *    row teaches the reader the log is broken. Every column here is one the seed can fill.
 *  - Proton (and 15Five) also resolve the address into a city. Dropped: an IP names a machine on
 *    a network, and reading a place out of it is an inference somebody else has to make — the
 *    same reason the look-up log's heading was renamed from 「위치」 to 「IP 주소」.
 *  - Genetec's twenty-column report pane (initiator application, entity version, …) and
 *    Milestone's expand-a-row detail: nothing here has a second level to open.
 *  - Milestone's audit log records logins but NOT failed attempts or logouts. Not a reference —
 *    it is the gap this screen exists to close.
 */

/*
 * WHAT THIS LOG IS AND IS NOT — and why two columns are missing on purpose (법률 검토 2026-10-01).
 *
 * 고시 제2조 counts five things as 접속기록: 계정 · 접속일시 · 접속지 정보 · 처리한 정보주체 정보
 * · 수행업무. This table carries the first three and names the door; the last two live in the
 * three lists built for them — 조회 기록 (who was looked up), 변경 기록 (what was changed), 반출
 * 기록 (what left). The obligation is met by the four lists TOGETHER.
 *
 * So the answer is a sentence under the table, not two more headings. A 「처리한 정보주체」 column
 * on this screen could only ever be dashed, and a column that cannot be filled is a promise the
 * screen cannot keep. The note on AccessRecord in vcaStore.ts is the long version of this.
 */

/*
 * MONTHLY REVIEW (고시 제8조제2항) — WHY THERE IS NO "last reviewed" LINE.
 *
 * The log has to be reviewed at least once a month, and a line saying when it last was would be
 * worth having. There is no field for it: nothing in the store records a review, so any date
 * printed here would be invented, and an invented compliance date is the worst possible thing
 * for this screen to say. HANDOFF: send `lastReviewedAt` + who reviewed, and this footer gains
 * one clause. A download found during that review has its reason confirmed in 반출 기록, not
 * here — there is deliberately no download column on this screen.
 */

/*
 * RETENTION IS TWO YEARS FOR THIS PRODUCT, not the base one year.
 *
 * Faces are processed by technical means to identify individuals, which makes them 생체인식정보
 * (시행령 제18조) and therefore 민감정보, and 고시 제8조제1항 puts a 민감정보 system on the longer
 * period. The 5만명 threshold is irrelevant — the other condition is already met. So a screen
 * that printed "1 year" would be wrong, and a value set below this floor is worth saying out
 * loud: the number comes from Project.accessLogRetentionMonths, which Settings owns, and this
 * screen only reads it.
 *
 * Note this is NOT the three-year period that 권한 부여·변경·말소 records carry. Different list,
 * different clock; the two are not mixed into this table.
 */
const RETENTION_FLOOR_MONTHS = 24;

/**
 * Five tracks, and the CSV writes the same five plus the account address.
 *
 * The widths live next to the labels for the reason the look-up log writes out: a second
 * hardcoded grid string drifts away from the headings it is supposed to describe.
 *
 * The IP is the one conditional column, and not because of a policy switch — AccessRecord.ip is
 * the server's to write and a browser cannot know its own public address. It appears when
 * something can fill it and is absent, rather than dashed, when nothing can.
 */
const COLUMN_WIDTH = {
  /* The account column is the widest because it is the only one carrying two lines, and the
     second of them — what was typed — is the part a narrow window eats first. Door is the
     cheapest: it holds one of two short phrases. */
  account: "1.35fr", outcome: "132px", door: "0.8fr", ip: "0.8fr", at: "150px",
} as const;

type LogSortKey = "at" | "account" | "outcome";

/** Worst first. Used for sorting by outcome, so one click groups every failure at one end. */
const OUTCOME_RANK: Record<AccessEventKind, number> = { lockedOut: 0, refused: 1, signIn: 2, signOut: 3 };

const FAILED: AccessEventKind[] = ["refused", "lockedOut"];

/**
 * THE OUTCOME IS THE COLUMN THIS SCREEN IS SCANNED BY, so it is the only place colour is spent.
 *
 * Grey for the two ordinary outcomes, danger for a refusal, and the lockout is the one row in
 * this product that earns a filled danger pill — it is the single row a reviewer opens this
 * screen to find, and it should be visible from across the table without reading a word.
 * A sign-out is the quietest row here (no fill at all): it is the only outcome nobody reviews.
 *
 * No purple anywhere on this screen. Nothing here asks to be pressed.
 */
const OUTCOME_STYLE: Record<AccessEventKind, { bg: string; fg: string; weight: number }> = {
  signIn: { bg: "var(--gray-100)", fg: "var(--gray-600)", weight: 600 },
  signOut: { bg: "transparent", fg: "var(--gray-400)", weight: 600 },
  refused: { bg: "var(--danger-100)", fg: "var(--danger-500)", weight: 700 },
  lockedOut: { bg: "var(--danger-500)", fg: "var(--gray-0)", weight: 700 },
};

const OUTCOME_ICON: Record<AccessEventKind, typeof LogIn> = {
  signIn: LogIn, signOut: LogOut, refused: ShieldX, lockedOut: Lock,
};

const T = {
  en: {
    /* The half of this a reader cannot see in the rows: these are the whole installation's, on a
       screen that sits inside one project. */
    intro: "Every sign-in and every failed attempt at this installation, not only at this project.",
    /* The two of 고시 제2조's five items this log does not hold, and where they are. Said once,
       because the alternative is two columns that are dashed on every row. */
    notHeld: "What was looked up, changed or taken out is in the search, activity and export logs.",
    retentionSet: (n: number) => `Records are kept for ${n} months.`,
    retentionShort: (n: number) => `Records are kept for ${n} months, short of the ${RETENTION_FLOOR_MONTHS} required.`,
    retentionUnset: `How long records are kept has not been set; ${RETENTION_FLOOR_MONTHS} months is the minimum.`,
    ownerOnly: "Only the owner and auditors read this log.",
    empty: "Nothing recorded yet.",
    noMatch: "No records match these filters.",
    loadFailed: "Could not load the access log.",
    retry: "Try again",
    colAccount: "Account", colOutcome: "Outcome", colDoor: "Door", colIp: "IP address", colAt: "When",
    outcome: { signIn: "Signed in", signOut: "Signed out", refused: "Refused", lockedOut: "Locked out" } as Record<AccessEventKind, string>,
    door: { portal: "Portal", app: "Monitoring app" } as Record<string, string>,
    noAccount: "No matching account",
    /* A count over the whole log, for the identifier on this row. Said in full words because
       「×3」 beside a refusal could be read as three of anything. */
    failedTimes: (n: number) => `${n} failed attempts`,
    filterAllDates: "Any date",
    filterAllDoors: "Either door",
    filterAllOutcomes: "Any outcome",
    filterFailed: "Failed attempts",
    filterNotFailed: "Excluding failed attempts",
    filterAllPeople: "Anyone",
    export: "Export CSV",
    exportNothingHeld: "Nothing is recorded yet — there is nothing to export.",
    exportNoMatch: "These filters match no records. The file carries the rows the table is showing.",
    /* The unit names what was counted and the label says what state it was in, so neither
       repeats the other: 「3 sign-ins · recorded」, not 「3 sign-ins · signed in」. The last two
       carry no unit at all — 「1 lockout · locked out」 would be the same word twice. */
    statSignIn: "recorded", statSignInUnit: (n: number) => (n === 1 ? "sign-in" : "sign-ins"),
    statRefused: "refused", statRefusedUnit: (n: number) => (n === 1 ? "attempt" : "attempts"),
    statLocked: "locked out",
    statUnknown: "matched no account",
    showRefused: "Show only refused attempts",
    showLocked: "Show only the lockouts",
    showUnknown: "Show only identifiers that matched no account",
    csvAccount: "Account", csvAccountEmail: "Account address", csvIdentifier: "Identifier entered",
    csvOutcome: "Outcome", csvDoor: "Door", csvIp: "IP address", csvAt: "When",
  },
  ko: {
    intro: "이 설치본 전체의 접속과 실패한 시도입니다. 이 프로젝트만이 아닙니다.",
    notHeld: "누구를 조회했는지, 무엇을 바꿨거나 꺼냈는지는 조회 기록·변경 기록·반출 기록에 있습니다.",
    retentionSet: (n: number) => `기록은 ${n}개월 보관합니다.`,
    retentionShort: (n: number) => `기록은 ${n}개월 보관합니다. 법정 최소 ${RETENTION_FLOOR_MONTHS}개월보다 짧습니다.`,
    retentionUnset: `보관 기간이 설정되지 않았습니다. 법정 최소는 ${RETENTION_FLOOR_MONTHS}개월입니다.`,
    ownerOnly: "이 기록은 최고관리자와 읽기 전용 관리자가 읽습니다.",
    empty: "기록이 없습니다.",
    noMatch: "조건에 맞는 기록이 없습니다.",
    loadFailed: "접속 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    colAccount: "계정", colOutcome: "결과", colDoor: "접속 경로", colIp: "IP 주소", colAt: "시각",
    outcome: { signIn: "로그인", signOut: "로그아웃", refused: "거절", lockedOut: "잠김" } as Record<AccessEventKind, string>,
    door: { portal: "포털", app: "모니터링 앱" } as Record<string, string>,
    noAccount: "계정 없음",
    failedTimes: (n: number) => `실패 ${n}회`,
    filterAllDates: "전체 기간",
    filterAllDoors: "접속 경로 전체",
    filterAllOutcomes: "결과 전체",
    filterFailed: "실패만",
    filterNotFailed: "실패 제외",
    filterAllPeople: "계정 전체",
    export: "CSV 내보내기",
    exportNothingHeld: "기록이 없어 내보낼 것이 없습니다.",
    exportNoMatch: "조건에 맞는 기록이 없습니다. 파일에는 표에 보이는 행만 담깁니다.",
    statSignIn: "로그인", statSignInUnit: () => "건",
    statRefused: "거절", statRefusedUnit: () => "건",
    statLocked: "잠김",
    statUnknown: "계정 없음",
    showRefused: "거절된 시도만 봅니다",
    showLocked: "잠긴 기록만 봅니다",
    showUnknown: "계정에 맞지 않은 식별자만 봅니다",
    csvAccount: "계정", csvAccountEmail: "계정 주소", csvIdentifier: "입력한 식별자",
    csvOutcome: "결과", csvDoor: "접속 경로", csvIp: "IP 주소", csvAt: "시각",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * AccessRecord.at AS IT WAS WRITTEN DOWN, not re-read through a timezone.
 *
 * The rows carry "2026-10-01 09:12" — a wall clock with no offset on it. Handing that to
 * `new Date()` asks the runtime to guess which clock it was, and the guess differs between the
 * machine that renders this page and the browser that hydrates it, so one row would print two
 * different times. The look-up log next door converts because its `at` is a full instant; this
 * one is not, and a minute invented on an access log is a minute that gets quoted in a review.
 *
 * So: a string carrying a zone (trailing Z or ±hh:mm) is converted into the project's zone;
 * anything else is printed exactly as stored.
 *
 * HANDOFF: pick one and the branch goes away. If the server sends instants, this screen also
 * needs an INSTALLATION-wide zone rather than the project's — the log is not per site, so on a
 * two-site installation the project's clock is the wrong clock for half the rows.
 */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/;

function stampOf(at: string, zone: string): { day: string; time: string } {
  if (ZONED.test(at)) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return { day: dateKeyIn(d, zone), time: clockMinutesIn(d, zone) };
  }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(at);
  return m ? { day: m[1], time: m[2] } : { day: at, time: "" };
}

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * Same seam as the look-up log, for the same reason: a list has four states (rows · empty ·
 * loading · failed) and this tab can only reach two of them while it reads the store
 * synchronously. `listState` becomes the GET's own state and `retryList` becomes its refetch;
 * nothing below here changes, because the table already branches on these three words.
 *
 * The ?listState= override exists so the two unreachable states can be opened and reviewed, and
 * it is one line to delete. Nothing in Portal writes that parameter, so nobody arrives at it.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  return [state, () => setState("ready")];
}

export default function ProjectAccessLogTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [listState, retryList] = useListState();
  /* The whole installation's rows. See the note at the top of this file — no projectId filter. */
  const accessLog = useVcaStore(s => s.accessLog);
  const recordListExport = useVcaStore(s => s.recordListExport);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const projectZone = project?.timeZone ?? PROJECT_TIME_ZONE;
  /* READ ONLY. Settings owns this value; an access log that offered to shorten its own retention
     would be a control on the one screen that must not be able to shorten anything. */
  const retentionMonths = project?.accessLogRetentionMonths;
  const { sort, toggle: toggleSort } = useTableSort<LogSortKey>({ key: "at", direction: "desc" });

  /* The range a reviewer arrives with — first in the row, the same order every comparable log
     uses (1Password, Okta, Dropbox) and the same order the tab next door settled on.
     NO minDate. retentionFloor() is built from Project.retentionDays, which is how long FOOTAGE
     is kept — a different number from this log's own retention, and clamping the calendar to it
     would hide rows the server still holds. Unbounded, the popover's 「전체 기간」 and its month
     arrows both reach past the 24-month floor, which is what this filter has to cover. */
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const fromDate = range.start ? dateKeyOf(range.start) : "";
  const toDate = range.end ? dateKeyOf(range.end) : "";
  const [doorFilter, setDoorFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [personFilter, setPersonFilter] = useState("ALL");

  /* Keyed by address, not by name: two people sharing a name would collapse into one option and
     quietly return both their rows under either. The last entry is not an account at all — see
     the note on the unmatched row below. */
  const personOptions = useMemo(() => {
    const seen = new Map<string, string>();
    accessLog.forEach(r => { if (r.actorEmail) seen.set(r.actorEmail, r.actor ?? r.actorEmail); });
    const options = [...seen].map(([value, name]) => ({ value, label: `${name} · ${value}` }));
    /* An identifier that matched nothing has no account to be filtered by, and it is the row
       somebody probing addresses leaves behind — so it gets its own choice rather than being
       reachable only by reading every row. */
    if (accessLog.some(r => !r.actorEmail)) options.push({ value: "NO_ACCOUNT", label: t.noAccount });
    return options;
  }, [accessLog, t]);

  /*
   * A CLOSED SET, so these two controls are drawn even on an empty log — the same call the
   * look-up log's 「화면」 filter makes. The doors are the two the product has and the outcomes
   * are the four AccessEventKind defines, so "nobody was refused at the app door" is a real
   * question with a real answer, and deriving the options from the rows would remove the
   * question exactly when the answer is 「없음」.
   *
   * 실패만 / 실패 제외 are the two a reviewer actually asks for, so they sit above the individual
   * outcomes rather than being assembled by ticking two boxes. 실패 제외 is also the answer to
   * the legal advice that failures be hidden by default: they are NOT hidden — finding the run
   * that ended in a lockout is why this screen gets opened — but the reader can put them away.
   */
  const doorOptions = useMemo(
    () => (["portal", "app"] as const).map(value => ({ value, label: t.door[value] })),
    [t],
  );
  const outcomeOptions = useMemo(() => [
    { value: "FAILED", label: t.filterFailed },
    { value: "lockedOut", label: t.outcome.lockedOut },
    { value: "refused", label: t.outcome.refused },
    { value: "NOT_FAILED", label: t.filterNotFailed },
    { value: "signIn", label: t.outcome.signIn },
    { value: "signOut", label: t.outcome.signOut },
  ], [t]);

  const showIp = accessLog.some(r => r.ip);
  /* 시각이 맨 뒤 — the four tabs of this screen keep one column order (owner, 2026-09-28). */
  const columns = ["account", "outcome", "door", ...(showIp ? ["ip"] : []), "at"] as (keyof typeof COLUMN_WIDTH)[];
  const grid = columns.map(c => COLUMN_WIDTH[c]).join(" ");

  /*
   * HOW MANY TIMES EACH IDENTIFIER FAILED, over the whole log.
   *
   * This is the only thing on the screen that is derived, and it is deliberately the WEAKEST
   * possible claim: a count of failed rows carrying that identifier. It is not 「3번 틀려서
   * 잠겼다」 — the rows do not support that sentence. The seeded burst has its lockout at 18:55
   * and two further refusals at 18:59 and 19:03, so the lockout is not the end of the run, and a
   * screen that printed "locked after N attempts" would be stating something plausible and
   * false. The count tells the reader the run has a size; the ordering of a burst is the
   * server's to explain.
   */
  const failuresByIdentifier = useMemo(() => {
    const counts = new Map<string, number>();
    accessLog.forEach(r => {
      if (!FAILED.includes(r.kind)) return;
      counts.set(r.identifier, (counts.get(r.identifier) ?? 0) + 1);
    });
    return counts;
  }, [accessLog]);

  const rows = accessLog
    .filter(r => doorFilter === "ALL" || r.door === doorFilter)
    .filter(r => {
      if (outcomeFilter === "ALL") return true;
      if (outcomeFilter === "FAILED") return FAILED.includes(r.kind);
      if (outcomeFilter === "NOT_FAILED") return !FAILED.includes(r.kind);
      return r.kind === outcomeFilter;
    })
    .filter(r => {
      if (personFilter === "ALL") return true;
      if (personFilter === "NO_ACCOUNT") return !r.actorEmail;
      return r.actorEmail === personFilter;
    })
    /* Compared on the same calendar day the row PRINTS — see stampOf. A range picked as
       "2026-09-30" means that day as the log wrote it, not a UTC slice of it. */
    .filter(r => {
      if (!fromDate && !toDate) return true;
      const { day } = stampOf(r.at, projectZone);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });

  const visible = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "at": { const { day, time } = stampOf(r.at, projectZone); return `${day} ${time}`; }
      /* By the address under the name, so two people with the same name do not interleave; a row
         with no account sorts by what was typed, which is all it has. */
      case "account": return `${r.actor ?? r.identifier}\u0000${r.actorEmail ?? r.identifier}`.toLowerCase();
      /* A rank, not the label: sorting by the printed word would order 「거절·로그아웃·로그인·
         잠김」 alphabetically and scatter the failures. Ascending puts the lockout first. */
      case "outcome": return OUTCOME_RANK[r.kind];
    }
  });

  const activeFilterCount = [doorFilter, outcomeFilter, personFilter].filter(v => v !== "ALL").length
    + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => {
    setDoorFilter("ALL"); setOutcomeFilter("ALL"); setPersonFilter("ALL"); setRange({ start: null, end: null });
  };

  const signInCount = accessLog.filter(r => r.kind === "signIn").length;
  const refusedCount = accessLog.filter(r => r.kind === "refused").length;
  const lockedCount = accessLog.filter(r => r.kind === "lockedOut").length;
  const unknownCount = accessLog.filter(r => !r.actorEmail).length;

  /* Empty log or empty filter — the same split the table body makes, said once so the button and
     the empty row cannot drift apart. undefined while there is something to export.

     ALSO DEAD WHILE THE LIST IS NOT READY. A file built from rows the screen has just said it
     could not load would be a file nobody can account for, and it is the copy that leaves the
     building. No sentence on it in that case: "the list is still loading" is already on screen
     as the skeleton, and a tooltip restating it is copy the reader can see. */
  const exportDisabled = listState !== "ready" || visible.length === 0;
  const exportBlocked = listState !== "ready" || visible.length > 0 ? undefined
    : accessLog.length === 0 ? t.exportNothingHeld : t.exportNoMatch;

  /* Nothing held, so nothing is offered to narrow it — except the two closed-set filters above,
     which still say what this log can be asked. Keyed off the LOG and not off the table, so a
     filter that matches nothing never removes the way back out of itself. */
  const nothingHeld = accessLog.length === 0;

  const exportCsv = () => {
    /*
     * THE FILE CARRIES EVERY COLUMN THE TABLE CARRIES. The look-up log's table quietly dropped
     * 「화면」 from its own CSV, so the record an auditor read on screen and the file they were
     * handed disagreed about which fields the log even has. The conditional IP is conditional in
     * both places, from the same `showIp`.
     *
     * ONE COLUMN MORE THAN THE TABLE, and on purpose: the account ADDRESS. The table shows the
     * name over what was typed, which is the right pair to read; a spreadsheet is what gets
     * quoted in a review, and the question a review asks that a display name cannot answer is
     * "which account was that". Both sibling logs send the address out for the same reason.
     */
    const header = [t.csvAccount, t.csvAccountEmail, t.csvIdentifier, t.csvOutcome, t.csvDoor, ...(showIp ? [t.csvIp] : []), t.csvAt];
    const body = visible.map(r => {
      const { day, time } = stampOf(r.at, projectZone);
      return [
        /* Empty, not "unknown": a row that matched no account has no name, and writing one in is
           the one thing this log must never do. The identifier column beside it is what that row
           actually holds. */
        r.actor ?? "", r.actorEmail ?? "", r.identifier,
        t.outcome[r.kind], t.door[r.door] ?? r.door,
        ...(showIp ? [r.ip ?? ""] : []),
        `${day} ${time}`.trim(),
      ];
    });
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    /* BOM, like the activity log's file. Every heading above is Korean in a Korean console, and
       Excel reads a CSV without one as the system code page. */
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    /* NOT named after the project. The rows are the installation's, so access-log-proj-sg.csv
       would be a filename making a claim about the contents that the contents do not make. */
    a.download = "access-log.csv";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    /* Taking a log out is itself an export, and this is the one that must not be the unrecorded
       one: 고시 제8조제2항 has the monthly review confirm the reason for any download it finds,
       so a download of the log the review reads cannot be invisible to it. */
    recordListExport({ projectId, list: "accessLog", rowCount: visible.length });
  };

  return (
    <div>
      {accessLog.length > 0 && (
        /*
         * THE STRIP IS HOW THE LOCKOUT IS FOUND WITHOUT COUNTING ROWS BY EYE.
         *
         * A reviewer opens this screen for one thing: the burst of failures that ended in a
         * lockout. Three cells do the counting and each one is a filter, so the run is two
         * clicks from the top of the page — and the one that matters is also the one row in the
         * table drawn in filled danger.
         *
         * AMBER, NOT RED, in the strip: SummaryStrip's vocabulary is "a defect somebody has to
         * fix" (warning) against "a fact" (neutral), and that is the right register for a count.
         * Danger lives on the row itself, where it marks one event rather than a total.
         *
         * 로그인 and 거절 are drawn whatever the figures say, because 「거절 0」 is an answer a
         * reviewer wants; 잠김 and 계정 없음 appear only when there is something, since their
         * whole job is to be noticed.
         *
         * Those two are counted off the ROWS, so once this list is fetched they appear as the
         * answer lands rather than sitting there as two skeletons. That is the right way round:
         * an empty amber card is a defect the screen has not seen yet.
         */
        <SummaryStrip state={listState} cells={[
          { key: "signin", icon: <LogIn size={14} strokeWidth={2.4} />, figure: signInCount, unit: t.statSignInUnit(signInCount), label: t.statSignIn, tone: "neutral" },
          {
            key: "refused", icon: <ShieldX size={14} strokeWidth={2.4} />, figure: refusedCount,
            unit: t.statRefusedUnit(refusedCount), label: t.statRefused, tone: refusedCount > 0 ? "warning" : "neutral",
            onClick: refusedCount > 0 ? () => setOutcomeFilter("refused") : undefined,
            active: outcomeFilter === "refused",
            title: refusedCount > 0 ? t.showRefused : undefined,
          },
          ...(lockedCount > 0 ? [{
            key: "locked", icon: <Lock size={14} strokeWidth={2.4} />, figure: lockedCount,
            label: t.statLocked, tone: "warning" as const,
            onClick: () => setOutcomeFilter("lockedOut"),
            active: outcomeFilter === "lockedOut",
            title: t.showLocked,
          }] : []),
          ...(unknownCount > 0 ? [{
            key: "unknown", icon: <ShieldX size={14} strokeWidth={2.4} />, figure: unknownCount,
            label: t.statUnknown, tone: "warning" as const,
            onClick: () => setPersonFilter("NO_ACCOUNT"),
            active: personFilter === "NO_ACCOUNT",
            title: t.showUnknown,
          }] : []),
        ]} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: TOOLBAR_GAP }}>
        {!nothingHeld && (
          <span style={{ display: "flex", alignItems: "center", width: "260px", flexShrink: 0 }}>
            <DateRangeTrigger lang={lang} value={range} onApply={setRange} emptyText={t.filterAllDates} />
          </span>
        )}
        {/* With the range and the strip — a log nobody has written to has nothing to narrow, and
            the two closed-set selects were the only controls left standing over its empty state. */}
        {!nothingHeld && <>
          <FilterSelect value={doorFilter} onChange={setDoorFilter} active={doorFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllDoors }, ...doorOptions]} />
          <FilterSelect value={outcomeFilter} onChange={setOutcomeFilter} active={outcomeFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllOutcomes }, ...outcomeOptions]} />
        </>}
        {/* Same rule the tab next door follows: on a log nobody has written to, this offered
            「전체」 and nothing else — a control that narrows nothing. */}
        {personOptions.length > 1 && (
          <FilterSelect value={personFilter} onChange={setPersonFilter} active={personFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllPeople }, ...personOptions]} />
        )}
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} />
        <span style={{ flex: 1 }} />
        {/* EXPORT IS THE ONLY THING THIS SCREEN DOES TO A ROW (고시 제8조제3항) — there is no
            kebab beside it and no bulk bar under it, because nothing here may edit, hide or
            delete an entry.

            The grey button says which kind of nothing it is: "nobody has signed in here" and
            "your filters matched nothing" send a reviewer to opposite conclusions, and the export
            is where that difference leaves the building. On the wrapper as well as the button, a
            disabled button dispatches no pointer events. */}
        <span title={exportBlocked} style={{ display: "inline-flex" }}>
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={exportDisabled} title={exportBlocked}
            style={{
              display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px",
              borderRadius: RADIUS.control, border: "none", backgroundColor: "transparent",
              color: exportDisabled ? "var(--gray-300)" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 600, cursor: exportDisabled ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}>
            <FileOutput size={14} strokeWidth={2.4} />
            {t.export}
          </button>
        </span>
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: grid,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS,
          color: TABLE_HEADER_COLOR,
        }}>
          {(columns.map(c => ({
            account: { label: t.colAccount, key: "account" as LogSortKey },
            outcome: { label: t.colOutcome, key: "outcome" as LogSortKey },
            door: { label: t.colDoor },
            ip: { label: t.colIp },
            at: { label: t.colAt, key: "at" as LogSortKey },
          }[c])) as { label: string; key?: LogSortKey }[]).map((h, i) => (
            /* No key while nothing is held — SortableHeader then draws the heading as text, which
               is what a column with nothing under it can honestly be. */
            <span key={i}><SortableHeader label={h.label} sortKey={nothingHeld ? undefined : h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {/* Loading is checked BEFORE empty, and that order is the point of the branch. "Nothing
            recorded yet" read off a request still in the air is exactly the plausible false
            answer an access log must never give — a reviewer could write it down. */}
        {listState === "loading" ? (
          <TableSkeleton grid={grid} />
        ) : listState === "failed" ? (
          <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
        ) : visible.length === 0 ? (
          /* Two sentences, and here the difference is the whole point: "nobody has signed in"
             and "your filters matched nothing" are opposite conclusions. */
          <TableEmpty text={accessLog.length === 0 ? t.empty : t.noMatch} />
        ) : visible.map((r: AccessRecord, i) => {
          const style = OUTCOME_STYLE[r.kind];
          const Glyph = OUTCOME_ICON[r.kind];
          const { day, time } = stampOf(r.at, projectZone);
          const failures = FAILED.includes(r.kind) ? (failuresByIdentifier.get(r.identifier) ?? 0) : 0;
          return (
            <div key={r.id} style={{
              display: "grid", gridTemplateColumns: grid, columnGap: TABLE_COLUMN_GAP,
              padding: "10px 16px", alignItems: "center",
              borderBottom: i === visible.length - 1 ? "none" : TABLE_RULE,
              /* The one row in this table with weight on its edge. An inset shadow rather than a
                 border-left, so the lockout's cells stay aligned with every other row's. */
              boxShadow: r.kind === "lockedOut" ? "inset 2px 0 0 var(--danger-500)" : undefined,
            }}>
              {/* NAME OVER WHAT WAS TYPED — the shape every comparable audit log uses, with the
                  second line carrying AccessRecord.identifier rather than the address. The two
                  are usually the same string, and where they are not the difference is the
                  interesting part: EMP-2043 signing in as Nadia Rahman is a fact the address
                  would have hidden.

                  WITH NO ACCOUNT MATCHED the typed string takes the first line, in monospace, and
                  says so underneath. It does not get a name, a placeholder name or an avatar: an
                  identifier nobody here uses, tried over and over, is exactly what this log
                  exists to show, and dressing it as a person would be a claim about somebody. */}
              <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                <span style={{
                  fontSize: "12px", fontWeight: 700, color: r.actor ? "var(--gray-900)" : "var(--gray-700)",
                  fontFamily: r.actor ? "inherit" : "monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.actor ?? r.identifier}
                </span>
                <span style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.actor ? r.identifier : t.noAccount}
                  </span>
                  {/* How big the run is, so nobody counts rows. See failuresByIdentifier for what
                      this number does and does not claim. */}
                  {failures > 1 && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-600)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {t.failedTimes(failures)}
                    </span>
                  )}
                </span>
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px", justifySelf: "start",
                height: "20px", padding: style.bg === "transparent" ? "0" : "0 8px", borderRadius: RADIUS.pill,
                backgroundColor: style.bg, color: style.fg,
                fontSize: "11px", fontWeight: style.weight, whiteSpace: "nowrap",
              }}>
                <Glyph size={12} strokeWidth={2.4} aria-hidden="true" />
                {t.outcome[r.kind]}
              </span>
              {/* Titled, because this is the cell a narrow window clips: 「모니터링 앱」 ellipsises
                  to 「모니터링 …」 under about 1000px, and the two values are too close to read
                  from a prefix. The other text cells are either monospace numbers or wide enough. */}
              <span title={t.door[r.door] ?? r.door} style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.door[r.door] ?? r.door}
              </span>
              {/* Only drawn when the log carries addresses at all — never a column of dashes. */}
              {showIp && (
                <span style={{ fontSize: "12px", color: r.ip ? "var(--gray-600)" : "var(--gray-300)", fontFamily: r.ip ? "monospace" : "inherit", whiteSpace: "nowrap" }}>
                  {r.ip ?? "—"}
                </span>
              )}
              <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                {`${day} ${time}`.trim()}
              </span>
            </div>
          );
        })}
      </div>

      {/* One paragraph, in one register, at the foot — the move both sibling logs made. Nobody
          arrives at an access log needing to be told it is an access log; they arrive looking for
          one row. These are the four things the rows cannot say: that the log is the whole
          installation's, which two of 고시 제2조's five items live elsewhere, how long a row
          survives, and who is expected to be reading. All four are checked after reading, not
          before — which is why none of them is a subtitle. */}
      {/* Full width, not MEASURE — see the same note on 처리 기록, and the owner's 2026-09-28
          decision the 변경 기록 tab carries. 38em of 11px text is about 418px, which turned a
          footnote under a full-width table into a tall narrow column. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px" }}>
        {t.intro} {t.notHeld}{" "}
        {retentionMonths === undefined ? t.retentionUnset
          : retentionMonths < RETENTION_FLOOR_MONTHS ? t.retentionShort(retentionMonths)
          : t.retentionSet(retentionMonths)}{" "}
        {t.ownerOnly}
      </p>
    </div>
  );
}
