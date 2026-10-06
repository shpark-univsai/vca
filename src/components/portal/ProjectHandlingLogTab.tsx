"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, type DetectionHandling, type DetectionHandlingState } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import { DateRangeTrigger, dateKeyOf, type DateRangeValue } from "../shared/DateRangePicker";
import {
  CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, MEASURE, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR, TABLE_RULE, TOOLBAR_GAP,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, TableEmpty, TableLoadFailed, TableSkeleton, sortRows, useTableSort } from "./PortalShared";
import { Check, CheckCircle2, FileOutput, ListChecks, UserCheck } from "lucide-react";

/**
 * 처리 기록 — WHAT THE SHIFT DEALT WITH, WHO DEALT WITH IT, AND WHAT THEY DID ABOUT IT.
 *
 * The app learned to acknowledge, take and close a detection, and the store has been writing
 * `detectionHandlings` ever since — with **nothing reading them**. To answer the question a
 * handover opens with, 「어제 야간에 누가 뭘 봤나」, somebody had to hover the app's event rows one
 * at a time. That is the same failure the look-up log's header names: a record nobody can produce
 * counts, to an auditor, as a record that was never kept. This file is the reader.
 *
 * A HANDLING IS NOT A JUDGEMENT, and the whole copy of this screen turns on that.
 * `DetectionJudgement` (elsewhere in the store, currently switched off) answers "is this the right
 * person"; this answers "has anybody dealt with it". So no word here may read as 오탐: nothing is
 * confirmed, corrected or found wrong. 확인 means somebody LOOKED, 종결 means it was HANDLED, and
 * the two states are kept apart on purpose — a correctly matched VIP still needs somebody to walk
 * over, and a false positive still needs closing so the next shift does not re-open it.
 *
 * ONE ROW PER EVENT, REPLACED IN PLACE (see DetectionHandling). The row is WHERE IT GOT TO, not a
 * history of stages — so this screen cannot show who acknowledged a detection before somebody else
 * closed it. That information does not exist, in the store or anywhere else, and a column implying
 * it does would be the worst thing an evidence screen can print. Said once under the table rather
 * than drawn as a timeline nobody can fill. HANDOFF: the server has to own the stages (one row per
 * action, appended, with the actor taken from the session) for this screen to gain a trail; what it
 * can honestly draw today is a state.
 *
 * NOT FILTERED BY PROJECT, and that is the one thing a reader cannot work out from the rows. A
 * handling is recorded against an app event and the app's modules carry no project concept yet, so
 * `projectId` is read for the project's clock and never for the row set — filtering here would
 * print an empty table beside a tab counting 5. Same call the access log makes, same sentence
 * under the table.
 *
 * WHAT IS HERE IS ONLY WHAT SOMEBODY TOUCHED. A detection nobody has dealt with has no row,
 * because a handling is the record of the work and not of the detection. 「5건 처리」 could
 * otherwise be read as 「어젯밤 감지는 5건」, which is a plausible false answer — the untouched
 * backlog is in the app's own events list, behind its 미처리 filter, and this screen says so
 * instead of estimating it.
 *
 * WHAT WAS TAKEN FROM THE PRODUCTS THAT ALREADY DO THIS:
 *  - Milestone XProtect's alarm list keeps State / Assigned to / Comment as peer columns, and its
 *    comment "relates to the actions you have taken". Kept, as 처리 · 담당 · 처리 내용 — the note
 *    is a column and not a detail, because a closed row without its note answers nothing.
 *  - PagerDuty's one real handover question is "what is acknowledged and not resolved" — and its
 *    own API says a resolved incident has no assignee at all. Kept: the amber card is exactly that
 *    slice, and the state sort ranks it first.
 *  - Genetec Security Center's activity trails audit who acknowledged an alarm, which is how basic
 *    the action is there. Kept as the reason this log exists at all.
 * AND WHAT WAS NOT:
 *  - Genetec's trail of distinct actions (acknowledged · forcibly acknowledged · forwarded ·
 *    snoozed) and Milestone's Activities section. Rejected, not deferred: there is one row per
 *    event here, so a trail would be a table of invented stages. The absence is written under the
 *    table in one clause.
 *  - Milestone's Priority column and its configurable column picker. No field for the first, and
 *    the second is a control that answers with the table already on screen.
 *  - Milestone's alarm states (New / In progress / On hold / Closed). Rejected: 「On hold」 and
 *    「New」 are states this product cannot reach — nothing in the app writes them — and a filter
 *    offering a state no row can hold teaches the reader the console does something it does not.
 *  - Linear's and Opsgenie's per-row assignee avatars. An avatar is a face in a console that gates
 *    faces behind usePortalFaceAccess, for a column whose job is a name.
 */

/**
 * FIVE TRACKS, AND THE CSV WRITES THE SAME FIVE PLUS THE OPERATOR'S ADDRESS.
 *
 * Widths live beside the labels, the way both sibling logs write it: a second hardcoded grid
 * string drifts away from the headings it is supposed to describe.
 *
 * 처리 내용 IS THE WIDEST COLUMN because it is the point of the row. Every other cell says that
 * something happened; this one says what. It was 1fr in the first pass and clipped
 * 「Approached at the concourse, identity confirmed, escorted to the office.」 to four words, which
 * is a log that has the answer and will not show it.
 *
 * NO ASSIGNEE COLUMN. Only one state in three carries an assignee, so a column for it would be
 * empty on most rows — the run of dashes this repo pulls columns for. It rides under the state
 * word instead, which is where the app's own row mark prints it.
 *
 * 시각 LAST, like all four tabs of this screen (owner, 2026-09-28).
 */
const COLUMN_WIDTH = {
  subject: "1fr", state: "0.95fr", note: "1.7fr", actor: "1.15fr", at: "150px",
} as const;
const COLUMNS = ["subject", "state", "note", "actor", "at"] as const;
const GRID = COLUMNS.map(c => COLUMN_WIDTH[c]).join(" ");

type HandlingSortKey = "at" | "subject" | "state" | "actor";

/** The three states, in the order the app offers them. A closed set — see stateOptions. */
const STATES: DetectionHandlingState[] = ["acknowledged", "assigned", "closed"];

/**
 * UNFINISHED FIRST. Used for sorting by 처리, so one click puts the handover's own question at the
 * top: the rows somebody looked at and nothing since. The printed word would sort
 * 「담당 지정 · 종결 · 확인」 alphabetically and scatter exactly those rows.
 */
const STATE_RANK: Record<DetectionHandlingState, number> = { acknowledged: 0, assigned: 1, closed: 2 };

const STATE_ICON: Record<DetectionHandlingState, typeof Check> = {
  acknowledged: Check, assigned: UserCheck, closed: CheckCircle2,
};

/**
 * ONE COLOUR ON THIS SCREEN, AND IT IS THE APP'S COLOUR FOR THE SAME THING.
 *
 * The app's row mark spends `--success-400` on closed and nothing on anything else, so the two
 * screens have to agree or an operator and an administrator will be looking at the same detection
 * in two different vocabularies. Acknowledged and assigned stay grey: somebody looked, which is
 * not an outcome.
 *
 * On the GLYPH only, not on the word. The colour marks where the work finished; a green word
 * would read as 「good」, and a closure is a fact rather than good news — a false positive closed
 * as a false positive is the same green tick as a VIP escorted to the office.
 *
 * No purple anywhere. Nothing on this screen asks to be pressed.
 */
const STATE_GLYPH_COLOR: Record<DetectionHandlingState, string> = {
  acknowledged: "var(--gray-500)", assigned: "var(--gray-400)", closed: "var(--success-400)",
};

const T = {
  en: {
    /* The four things the rows cannot say, in the order a reader checks them AFTER reading — which
       is why none of them is a subtitle. */
    intro: "A handling is recorded against a detection in the monitoring app, and detections are not divided by project, so these rows are the whole installation's.",
    notHere: "A detection nobody has touched has no row here; those are in the monitoring app's events list.",
    oneRow: "Each detection keeps one row, showing where it got to — the steps before that are not kept.",
    ownerOnly: "Only the owner and auditors read this log.",
    empty: "Nothing has been dealt with yet.",
    noMatch: "No records match these filters.",
    loadFailed: "Could not load the handling log.",
    retry: "Try again",
    colSubject: "Subject", colState: "Handling", colNote: "What was done",
    colActor: "Handled by", colAt: "When handled",
    /* The app's own words, so the two screens call the same thing by the same name (Sidebar's
       handling strip: Acknowledge · Assign · Close). */
    state: { acknowledged: "Acknowledged", assigned: "Assigned", closed: "Closed" } as Record<DetectionHandlingState, string>,
    /* Beside the assignee's name under 「Assigned」. The name alone would read as a second operator
       on the row, next to the one who assigned it. */
    assignedTo: (name: string) => `to ${name}`,
    filterAllDates: "Any date",
    filterAllStates: "Any handling",
    filterOpen: "Not closed",
    filterAllOperators: "Anyone",
    export: "Export CSV",
    exportNothingHeld: "Nothing has been dealt with yet, so there is nothing to export.",
    exportNoMatch: "These filters match no records. The file carries the rows the table is showing.",
    /* The unit names what was counted and the label says what state it is in, so neither repeats
       the other: 「3 detections · dealt with」, never 「3 closed · closed」. */
    statTotal: "detections", statTotalLabel: "dealt with",
    statClosed: "closed",
    statAssigned: "assigned",
    statAcknowledged: "only acknowledged",
    statAcknowledgedWhy: "Somebody looked and nothing has happened since: nobody took it and nothing was written down. This is the slice a handover has to pass on.",
    statAssignedWhy: "Somebody is on it. The person it was handed to is on the row.",
    showOnly: "Show only these",
    csvSubject: "Subject", csvState: "Handling", csvAssignee: "Assigned to",
    csvNote: "What was done", csvActor: "Handled by", csvActorEmail: "Operator address",
    csvAt: "When handled",
  },
  ko: {
    intro: "처리는 모니터링 앱의 감지에 기록되고, 감지는 프로젝트로 나뉘지 않습니다. 그래서 이 목록은 설치본 전체의 것입니다.",
    notHere: "아무도 손대지 않은 감지는 여기 없습니다. 그것은 모니터링 앱의 감지 목록에 있습니다.",
    oneRow: "감지마다 한 줄이고, 그 줄은 어디까지 갔는지를 보여줍니다. 그 전 단계는 남지 않습니다.",
    ownerOnly: "이 기록은 최고관리자와 읽기 전용 관리자가 읽습니다.",
    empty: "처리한 감지가 없습니다.",
    noMatch: "조건에 맞는 기록이 없습니다.",
    loadFailed: "처리 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    colSubject: "대상 인물", colState: "처리", colNote: "처리 내용",
    colActor: "처리한 사람", colAt: "처리 시각",
    state: { acknowledged: "확인", assigned: "담당 지정", closed: "종결" } as Record<DetectionHandlingState, string>,
    assignedTo: (name: string) => `${name}에게`,
    filterAllDates: "전체 기간",
    filterAllStates: "처리 전체",
    filterOpen: "종결 안 됨",
    filterAllOperators: "처리한 사람 전체",
    export: "CSV 내보내기",
    exportNothingHeld: "처리한 감지가 없어 내보낼 것이 없습니다.",
    exportNoMatch: "조건에 맞는 기록이 없습니다. 파일에는 표에 보이는 행만 담깁니다.",
    statTotal: "건", statTotalLabel: "처리한 감지",
    statClosed: "종결",
    statAssigned: "담당 지정",
    statAcknowledged: "확인만 됨",
    statAcknowledgedWhy: "누군가 보기만 했고 그 뒤로 아무 일도 없습니다. 담당도 없고 적힌 것도 없습니다. 교대 때 넘겨야 하는 구간입니다.",
    statAssignedWhy: "누군가 가고 있습니다. 넘겨받은 사람은 행에 적혀 있습니다.",
    showOnly: "이 행만 보기",
    csvSubject: "대상 인물", csvState: "처리", csvAssignee: "담당",
    csvNote: "처리 내용", csvActor: "처리한 사람", csvActorEmail: "처리자 주소",
    csvAt: "처리 시각",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * DetectionHandling.at AS IT WAS WRITTEN DOWN, and never through a `new Date()` that can throw.
 *
 * THIS TABLE HOLDS BOTH SHAPES AT ONCE, which is why the guard is not theoretical here. The night
 * shift's rows are seeded as a bare wall clock ("2026-10-01 02:55") because the night happens
 * before an administrator opens the console; every row the app writes live arrives as
 * `new Date().toISOString()`. Handing the first shape to `new Date()` asks the runtime to guess
 * which clock it was, and the guess differs between the machine that renders this page and the
 * browser that hydrates it — one row would print two different times.
 *
 * AND ONE BAD ROW MUST NOT TAKE THE LIST. `dateKeyIn` ends in Intl.DateTimeFormat.format(), which
 * raises RangeError on a Date the runtime cannot read, and a throw inside the map that draws the
 * rows is not a broken cell — it is a white screen where the record was. On an evidence screen
 * that is the worst failure available: the reader cannot tell 「아무것도 처리되지 않았다」 from
 * 「한 줄이 깨졌다」, and the first of those is something somebody writes down at a handover.
 *
 * So, the export log's rule verbatim: a string carrying a zone (trailing Z or ±hh:mm) is converted
 * into the project's zone, anything else is printed exactly as stored, and a string that is
 * neither is handed back untouched rather than guessed at.
 *
 * HANDOFF: pick one shape on the server and this branch goes away.
 */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/;

function stampOf(at: string, zone: string): string {
  if (ZONED.test(at)) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return `${dateKeyIn(d, zone)} ${clockMinutesIn(d, zone)}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(at);
  return m ? `${m[1]} ${m[2]}` : at;
}

/** The calendar day the row PRINTS, for the range filter. Empty where there is none to read, so an
 *  unreadable row fails the range test instead of killing the whole tab. */
function dayOf(at: string, zone: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(stampOf(at, zone));
  return m ? m[1] : "";
}

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * The same seam both sibling logs keep, for the same reason: a list has four states (rows · empty ·
 * loading · failed) and this tab can only reach two of them while it reads the in-memory store
 * synchronously. `listState` becomes the GET's own state and `retryList` becomes its refetch;
 * nothing below changes, because the table already branches on these three words.
 *
 * The ?listState= override exists so the two unreachable states can be opened and reviewed, and it
 * is one line to delete. Nothing in Portal writes that parameter, so nobody arrives at it.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  return [state, () => setState("ready")];
}

export default function ProjectHandlingLogTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [listState, retryList] = useListState();
  /* The whole installation's rows. See the header — no projectId filter, deliberately. */
  const handlings = useVcaStore(s => s.detectionHandlings);
  const recordListExport = useVcaStore(s => s.recordListExport);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  /* Read for the clock only. A handover reads the night in the site's own hours, so a live row
     written at 23:40 local must not file itself under the following day. */
  const projectZone = project?.timeZone ?? PROJECT_TIME_ZONE;
  const { sort, toggle: toggleSort } = useTableSort<HandlingSortKey>({ key: "at", direction: "desc" });

  /* The range the question arrives with — 「어제 야간」 — and first in the row, the order every
     comparable log uses and the order the other three tabs settled on. No minDate: nothing in the
     store says how long a handling is kept, and clamping the calendar to the footage retention
     would hide rows the server still holds. */
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const fromDate = range.start ? dateKeyOf(range.start) : "";
  const toDate = range.end ? dateKeyOf(range.end) : "";
  const [stateFilter, setStateFilter] = useState<"ALL" | "OPEN" | DetectionHandlingState>("ALL");
  const [operatorFilter, setOperatorFilter] = useState("ALL");

  /*
   * A CLOSED SET, so the three states are offered whatever the log holds — the same call the
   * look-up log's 「화면」 filter and the access log's 「결과」 filter make. DetectionHandlingState
   * has exactly three members and the app writes one of them, and 「확인만 된 건은 하나도 없다」 is
   * a real question with a real answer: deriving the options from the rows would take the question
   * away at the moment the answer is 「없음」.
   *
   * 종결 안 됨 sits above the three because it is what a handover actually asks for, and assembling
   * it by hand means reading two of the three and adding them up.
   */
  const stateOptions = useMemo(() => [
    { value: "OPEN", label: t.filterOpen },
    ...STATES.map(s => ({ value: s, label: t.state[s] })),
  ], [t]);

  /* Keyed by address, not by name: two operators sharing a name would collapse into one option and
     quietly return both their rows under either. Falls back to the name for a row written before
     actorEmail existed — the option still works, it just identifies less. */
  const operatorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    handlings.forEach(h => seen.set(h.actorEmail ?? h.actor, h.actor));
    return [...seen].map(([value, name]) => ({ value, label: value === name ? name : `${name} · ${value}` }));
  }, [handlings]);

  const rows = handlings
    .filter(h => stateFilter === "ALL"
      || (stateFilter === "OPEN" ? h.state !== "closed" : h.state === stateFilter))
    .filter(h => operatorFilter === "ALL" || (h.actorEmail ?? h.actor) === operatorFilter)
    /* Compared on the same calendar day the row PRINTS — see stampOf. A range picked as
       "2026-09-30" means that day as the log wrote it, not a UTC slice of it that starts nine
       hours early. Through dayOf, never `new Date()`: a row with an unreadable stamp would
       otherwise throw here, which means the tab dies the moment somebody sets a date. */
    .filter(h => {
      if (!fromDate && !toDate) return true;
      const day = dayOf(h.at, projectZone);
      if (!day) return false;
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });

  const visible = sortRows(rows, sort, (h, key) => {
    switch (key) {
      /* The stamp the row PRINTS, like both tabs next door. Raw `at` would sort a full instant
         ("…T05:00:00Z") against a bare wall clock ("2026-10-01 02:55") as text and interleave the
         seeded night with the live rows wrongly — and the reader can only check an order against
         what they can see. */
      case "at": return stampOf(h.at, projectZone);
      case "subject": return h.subject.toLowerCase();
      /* A rank, not the word — see STATE_RANK. */
      case "state": return STATE_RANK[h.state];
      // By the address, so two operators with the same name do not interleave.
      case "actor": return `${h.actor}\u0000${h.actorEmail ?? ""}`.toLowerCase();
    }
  });

  const activeFilterCount = [stateFilter, operatorFilter].filter(v => v !== "ALL").length
    + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => {
    setStateFilter("ALL"); setOperatorFilter("ALL"); setRange({ start: null, end: null });
  };
  /* Pressing a lit card again clears it, and pressing another swaps — three cards selecting three
     slices of one list cannot be on at once, and a reader working out which combination they are
     looking at has lost the plot of their own handover. */
  const toggleState = (slice: DetectionHandlingState) =>
    setStateFilter(cur => (cur === slice ? "ALL" : slice));

  const closedCount = handlings.filter(h => h.state === "closed").length;
  const assignedCount = handlings.filter(h => h.state === "assigned").length;
  const acknowledgedCount = handlings.filter(h => h.state === "acknowledged").length;

  /* Nothing held, so nothing is offered to narrow it — except the state filter, which still says
     what this log can be asked (see stateOptions). Keyed off the LOG and not off the table, so a
     filter matching nothing never takes away the way back out of itself. */
  const nothingHeld = handlings.length === 0;

  /* Empty log or empty filter — the same split the table body makes, said once so the button and
     the empty row cannot drift apart. undefined while there is something to export.

     ALSO DEAD WHILE THE LIST IS NOT READY: a file built from rows the screen has just said it
     could not load is a file nobody can account for, and this is the copy that leaves the
     building. No sentence in that case — the skeleton already says the list is still coming. */
  const exportDisabled = listState !== "ready" || visible.length === 0;
  const exportBlocked = listState !== "ready" || visible.length > 0 ? undefined
    : nothingHeld ? t.exportNothingHeld : t.exportNoMatch;

  const exportCsv = () => {
    /*
     * THE FILE CARRIES EVERY COLUMN THE TABLE CARRIES, in the table's own order.
     *
     * Two columns more, and both of them are already ON the screen rather than new: the assignee,
     * which rides under the state word, and the operator's address, which rides under their name.
     * A spreadsheet has no second line to hide them in, and the bug to avoid is the opposite one
     * the look-up log was carrying — a file with FEWER columns than the table, so the record an
     * auditor reads and the file they are handed disagree about which fields the log even has.
     *
     * 처리 내용 goes out whole. It is the point of the row, and a handover summary that drops it
     * carries five rows saying somebody did something unspecified.
     */
    const header = [
      t.csvSubject, t.csvState, t.csvAssignee, t.csvNote,
      t.csvActor, t.csvActorEmail, t.csvAt,
    ];
    /* Empty, never a dash and never a guess. A blank cell is "nothing was recorded"; anything
       printed there is this screen claiming something the operator did not say. */
    const body = visible.map(h => [
      h.subject, t.state[h.state], h.assignee ?? "", h.note ?? "",
      h.actor, h.actorEmail ?? "", stampOf(h.at, projectZone),
    ]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    /* BOM, like all three sibling logs' files. Every heading above is Korean in a Korean console,
       and Excel reads a CSV without one as the system code page. */
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    /* NOT named after the project, because the rows are not the project's — see the header.
       handling-log-proj-sg.csv would be a filename making a claim the contents do not make. */
    a.download = "handling-log.csv";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    /* Same rule as the sibling logs: a log leaving as a file is an export, and the monthly
       review has to be able to find it. */
    recordListExport({ projectId, list: "handlingLog", rowCount: visible.length });
  };

  return (
    <div>
      {/* No strip on an empty log: four cards reading 0 describe slices of a list that does not
          exist, and the empty state is the first thing anybody sees on this screen. */}
      {!nothingHeld && (
        /*
         * THE STRIP IS THE HANDOVER, READ IN ONE LINE.
         *
         * 처리한 감지 is the size of the shift's work; the three after it are what became of it,
         * and each one is a filter, so any slice is one click from the top of the page.
         *
         * 확인만 됨 IS THE ONLY AMBER CARD, and it is the question this screen was built for:
         * somebody looked, and then what? Nobody took it and nothing was written down, so it is
         * the one slice the record cannot answer for — and it drains as the next shift deals with
         * the rows rather than staying lit for ever, which is the test the export log's review
         * cards are held to. 담당 지정 stays neutral: somebody is on it is a fact, not a defect.
         *
         * 종결 and 담당 지정 are drawn at zero as well, because 「종결된 건이 하나도 없다」 is a
         * finding a handover wants said out loud. 확인만 됨 appears only when there is something,
         * since its whole job is to be noticed.
         *
         * NO 「미처리」 CARD. The count of detections nobody has touched is not in this list and
         * cannot be derived from it — see the header — and a card estimating it would be the
         * plausible false number this screen exists to replace. The app's events list owns it.
         */
        <SummaryStrip state={listState} cells={[
          { key: "total", icon: <ListChecks size={14} strokeWidth={2.4} />, figure: handlings.length,
            unit: t.statTotal, label: t.statTotalLabel, tone: "neutral" },
          { key: "closed", icon: <CheckCircle2 size={14} strokeWidth={2.4} />, figure: closedCount,
            label: t.statClosed, tone: "neutral",
            onClick: () => toggleState("closed"), active: stateFilter === "closed", title: t.showOnly },
          { key: "assigned", icon: <UserCheck size={14} strokeWidth={2.4} />, figure: assignedCount,
            label: t.statAssigned, tone: "neutral", explanation: t.statAssignedWhy,
            onClick: () => toggleState("assigned"), active: stateFilter === "assigned", title: t.showOnly },
          ...(acknowledgedCount > 0 ? [{
            key: "acknowledged", icon: <Check size={14} strokeWidth={2.4} />, figure: acknowledgedCount,
            label: t.statAcknowledged, tone: "warning" as const, explanation: t.statAcknowledgedWhy,
            onClick: () => toggleState("acknowledged"), active: stateFilter === "acknowledged", title: t.showOnly,
          }] : []),
        ]} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: TOOLBAR_GAP }}>
        {!nothingHeld && (
          <span style={{ display: "flex", alignItems: "center", width: "260px", flexShrink: 0 }}>
            <DateRangeTrigger lang={lang} value={range} onApply={setRange} emptyText={t.filterAllDates} />
          </span>
        )}
        {/* With the range above it: on a log nobody has written to there is nothing to narrow, and
            a closed-set select is the one control that does not disappear on its own for want of
            options. */}
        {!nothingHeld && (
          <FilterSelect value={stateFilter} onChange={v => setStateFilter(v as typeof stateFilter)}
            active={stateFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllStates }, ...stateOptions]} />
        )}
        {/* Appears once it can narrow something. On a log with one operator this offered 「전체」
            and one name — a control that changes nothing, on a screen whose whole value is that
            the reader can trust what the controls mean. */}
        {operatorOptions.length > 1 && (
          <FilterSelect value={operatorFilter} onChange={setOperatorFilter} active={operatorFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllOperators }, ...operatorOptions]} />
        )}
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} />
        <span style={{ flex: 1 }} />
        {/* EXPORT IS THE ONLY THING THIS SCREEN DOES TO A ROW. No kebab and no bulk bar: a
            handling is written by the operator who did the work, and an administrator editing or
            removing one afterwards would leave a record of the work that the work did not make.
            Reopening a detection exists, and it is in the app beside the row it belongs to.

            The grey button says which kind of nothing it is: 「아무도 아무것도 안 했다」 and
            「필터에 걸린 게 없다」 send a reader to opposite conclusions, and the first is what
            somebody writes into a handover. On the wrapper as well as the button — a disabled
            button dispatches no pointer events. */}
        <span title={exportBlocked} style={{ display: "inline-flex" }}>
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={exportDisabled} title={exportBlocked}
            style={{
              display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px",
              borderRadius: "8px", border: "none", backgroundColor: "transparent",
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
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS,
          color: TABLE_HEADER_COLOR,
        }}>
          {([
            { label: t.colSubject, key: "subject" as HandlingSortKey },
            { label: t.colState, key: "state" as HandlingSortKey },
            /* Not sortable. Sorting prose alphabetically groups nothing a reader asked for, and
               「처리 내용이 있는 것만」 is already the 종결 filter: closing takes a note and
               acknowledging does not. */
            { label: t.colNote },
            { label: t.colActor, key: "actor" as HandlingSortKey },
            { label: t.colAt, key: "at" as HandlingSortKey },
          ] as { label: string; key?: HandlingSortKey }[]).map((h, i) => (
            /* No key while nothing is held — SortableHeader then draws plain text, which is what a
               column with nothing under it can honestly be. */
            <span key={i}><SortableHeader label={h.label} sortKey={nothingHeld ? undefined : h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {/* Loading is checked BEFORE empty, and that order is the whole point of the branch.
            「처리한 감지가 없습니다」 read off a request still in the air is a false answer that
            looks exactly like a true one — and on this screen it is the answer somebody carries
            into a shift handover. */}
        {listState === "loading" ? (
          <TableSkeleton grid={GRID} />
        ) : listState === "failed" ? (
          <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
        ) : visible.length === 0 ? (
          /* Two sentences, and the difference is the finding. 「아무것도 처리되지 않았다」 is
             something a reader writes down; 「필터에 걸린 게 없다」 is their own filter. */
          <TableEmpty text={nothingHeld ? t.empty : t.noMatch} />
        ) : visible.map((h: DetectionHandling, i) => {
          const Glyph = STATE_ICON[h.state];
          return (
            /* NO ROW CLICK AND NO PANEL. There is no second level behind a handling: the four
               fields a row has are the four it has, and every one of them is in the table. A
               chevron opening a drawer that repeats the row is the way a reader learns the
               product has more to say than it does. */
            <div key={h.id} style={{
              display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
              padding: "10px 16px", alignItems: "center",
              borderBottom: i === visible.length - 1 ? "none" : TABLE_RULE,
            }}>
              {/* WHO IT WAS ABOUT, in the row's heaviest type — 「무엇을」 of 「누가 뭘 봤나」.
                  A closed row still has to say what it was about, which is why the store carries
                  the name on the handling rather than leaving it on the event. */}
              <span title={h.subject} style={{
                fontSize: "12px", fontWeight: 700, color: "var(--gray-900)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {h.subject}
              </span>

              {/* THE STATE AS A MARK AND A WORD — not a coloured chip.
                  Acknowledging is not a fault and closing is not a success, and in this product an
                  amber or green fill means somebody has to act or something went well. The glyph
                  carries the one colour (see STATE_GLYPH_COLOR), which is also the only thing
                  making the three states scannable down the column.

                  THE ASSIGNEE RIDES UNDERNEATH, where the app's own row mark prints it. 「누가」 is
                  the question, and a name under 「담당 지정」 answers it without a column that
                  would be blank on two rows in three. */}
              <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  <span style={{ flexShrink: 0, display: "flex" }} aria-hidden="true">
                    <Glyph size={14} strokeWidth={2.4} color={STATE_GLYPH_COLOR[h.state]} />
                  </span>
                  <span style={{
                    fontSize: "12px", fontWeight: 600, color: "var(--gray-700)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.state[h.state]}
                  </span>
                </span>
                {/* Only where the store holds one. `assignee` is set on 담당 지정 and nowhere
                    else, so there is no dash to print and no line to draw. */}
                {h.assignee && (
                  /* Titled, because this is the line a narrow window eats first: under about
                     900px 「Marcus Lee에게」 ellipsises to 「Marcus …」, and a name is the one
                     thing on this row that cannot be read from its first word. */
                  <span title={h.assignee} style={{
                    fontSize: "11px", color: "var(--gray-500)", paddingLeft: "20px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.assignedTo(h.assignee)}
                  </span>
                )}
              </span>

              {/* WHAT WAS DONE — the point of the row, in the widest column, and in the row's own
                  reading weight rather than as a footnote. A closed row without its note answers
                  nothing, which is why closing takes one in the app and acknowledging does not.

                  Two lines, then ellipsised with the whole thing in the title: notes are one or
                  two sentences and a row that grows to five lines breaks the scan the table is
                  for. Blank on a row that has none — which is the honest content of an
                  acknowledgement, and the state beside it already says so. */}
              <span title={h.note ?? undefined} style={{
                fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.4,
                display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                overflow: "hidden", wordBreak: "break-word",
              }}>
                {h.note ?? ""}
              </span>

              {/* NAME OVER ADDRESS, the shape all three sibling logs use. The name is what a reader
                  recognises; the address is what makes the row name ONE person, and telling two
                  operators of the same name apart is the whole job of a record somebody is held
                  to. The store takes both from the session, never from a field the operator
                  types. */}
              <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.actor}
                </span>
                {h.actorEmail && (
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.actorEmail}
                  </span>
                )}
              </span>

              {/* Monospace, like all three tabs next door — a column of stamps only lines up if the
                  digits do. */}
              <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                {stampOf(h.at, projectZone)}
              </span>
            </div>
          );
        })}
      </div>

      {/* One paragraph, in one register, at the foot — the move all three sibling logs made. Nobody
          arrives at this screen needing to be told what it is; they arrive with one question. These
          are the four things the rows cannot say: that the list is the whole installation's, that
          an untouched detection is not in it, that a row is a state and not a trail, and who is
          expected to be reading. All four are checked after reading, which is why none of them is
          a subtitle. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px", maxWidth: MEASURE }}>
        {t.intro} {t.notHere} {t.oneRow} {t.ownerOnly}
      </p>
    </div>
  );
}
