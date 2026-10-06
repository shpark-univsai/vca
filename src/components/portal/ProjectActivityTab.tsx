"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, type AuditEvent } from "@/lib/vcaStore";
import { AUDIT_AREA_LABEL, AUDIT_AREAS, type AuditArea } from "@/lib/auditAreas";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { PROJECT_TABS, type DetailTab } from "./ProjectSidebar";
import { usePortalLanguage } from "@/lib/i18n";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, TABLE_RULE, CONTROL_HEIGHT, PANEL_SHADOW, SearchInput, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR, TOOLBAR_GAP,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, TableEmpty, TableSkeleton, TableLoadFailed, sortRows, useTableSort } from "./PortalShared";
import { FileOutput, History, UserCog, CalendarClock, Settings, KeyRound } from "lucide-react";

/**
 * What was changed on this project, by whom, and when.
 *
 * This existed as five rows on the Overview and a modal behind them that listed everything with
 * no date range, no actor filter, no search and no export. The Auditor role exists to read this
 * and nothing else, and a police station asked "who deleted that VIP registry entry in March" had a
 * scrolling box. Meanwhile the search log — a feature switched off for v1 — already had filters
 * and a CSV. The one that ships was the worse-equipped of the two.
 *
 * Scope matches the Overview card exactly: this project's own entries plus the institution's
 * policy changes, because a VIP registry category governs every site the team runs and filing it
 * under one of them would misplace it. See AuditEvent.teamId.
 *
 * HANDOFF NOTE: the console holds the most recent AUDIT_LOG_LIMIT entries in memory. The screen
 * no longer says so — the line was removed 2026-09-10, because on a store-only log there is no
 * server holding the older history it promised, and a cap is the server's to describe once this
 * is a real query. A real history is the server's, and the filters here are the query it should
 * take:
 *   GET /v1/projects/{id}/audit?from=&to=&actor=&q=&cursor=
 * — newest first, `teamId` entries folded in the same way, one page at a time.
 */

/**
 * FIVE COLUMNS, NOT THREE (owner, 2026-09-28: 조회 기록 테이블엔 상세하게 화면도 알려주고 하는데,
 * 변경 기록에는 변경 내용만 적혀 있어서 불친절해 보여).
 *
 * The rhythm is the search log's, measured rather than guessed: that table renders five columns
 * at 1,302px in this same frame (150px for the stamp, the rest shared), and this one was rendering
 * three with 936px of it spent on one sentence. So: the stamp and the person keep fixed widths,
 * and the three that came out of that sentence share what is left, with the widest share going to
 * the change itself because it is the only one that is a phrase rather than a name.
 */
/* 대상 BEFORE 화면 (owner, 2026-09-28: 순서가 이게 맞아? · 순서는 꼭 그쪽이 정답은 아닐 수
   있어서, 모빈이랑 보고 수정해 줘).

   EIGHT AUDIT LOGS CHECKED (15Five, Fibery, Klaviyo, 1Password, Customer.io, Toggl Track, Aboard,
   Docusign). Five of them do not split the subject out at all — one sentence carries it. Of the
   THREE that do (Fibery: Entity → Event; Aboard: Full name → Action → Attribute; Customer.io:
   Person/Object → Activity Type → Activity Name), all three put the SUBJECT BEFORE THE ACTION.
   None of the eight has a screen column, so they cannot settle 화면 against 대상 — that column is
   ours, and the 조회 기록 table's.

   So the tie-break is the table one tab away: 조회 기록 reads 시각 · 조회자 · 조회 대상 · 화면 ·
   결과. Matching it means the third column is "the thing" and the fourth is "where" in both, for a
   reader who moves between the two tabs. Both orders satisfy the rule the three products agree on. It was not: the 조회 기록 table
   beside this one — the one the owner held up as the model — reads 시각 · 조회자 · 조회 대상 ·
   화면 · 결과, so it names WHO, then WHAT, then WHERE. This table had 화면 before 대상, which put
   the two tables' third columns out of step; a reader moving between the tabs had to re-find the
   column each time. It also matches the owner's own phrasing of the ask — 누가 무엇을 어떻게. */
/* 담당자 · 대상 · 화면 · 변경 내용 · 시각 (owner, 2026-09-28: 변경기록도 조회기록도 시각이 맨
   뒤로갔으면 해). The stamp led the row until now; moved to the end it stops being the first thing
   read on a table whose subject is what changed. */
const GRID = "150px 1.1fr 1fr 1.4fr 150px";
/** Where a fallback row's sentence starts — see the row body. */
const FALLBACK_SPAN = "span 3";

type ActivitySortKey = "at" | "actor" | "area" | "target";

/** The date-range choices, in days. null is everything the console is holding. */
const RANGES: { value: string; days: number | null }[] = [
  { value: "7", days: 7 },
  { value: "30", days: 30 },
  { value: "90", days: 90 },
  { value: "ALL", days: null },
];

const T = {
  en: {
    intro: "Every change made to this project from Portal, newest first. Policy changes made for the whole institution appear here too, and so does an account created by redeeming a registration code.",
    empty: "No activity recorded yet.",
    loadFailed: "Could not load the activity log.",
    retry: "Try again",
    noMatch: "No activity matches these filters.",
    /* "Screen" is the search log's own heading for this axis, not a second word for it. The last
       one keeps the heading the single column always had, because it is still the same question —
       the two before it were carved out of it. */
    /* 「대상」 is "Target", not "What": with "What" the table had two columns opening on the same
       word (What · What changed) and the one holding 「CAM-NOV-001」 read as "what happened" rather
       than "what was acted on". The Korean was never wrong — this was a translation collision. */
    /* 「Changed by」/「Searched by」 — the two tabs of this screen name the same column two
       different ways otherwise (Who · Operator, 담당자 · 조회자), and a reader moving between
       them has to work out whether they mean different people. They do not: both are the account
       that did the thing this table records. Parallel construction says that, and each tab still
       names its own act.

       「담당자」 also meant somebody else already — the vendor's contact person, in the empty
       state and on the licence screen. */
    colAt: "When", colActor: "Changed by", colTarget: "Target", colArea: "Screen", colMessage: "What changed",
    searchPlaceholder: "Search what changed",
    filterAllActors: "Anyone",
    filterAllAreas: "Every screen",
    range7: "Last 7 days", range30: "Last 30 days", range90: "Last 90 days", rangeAll: "All held",
    clearFilters: "Clear",
    export: "Export CSV",
    // Two ways this button can be dead, and on an audit surface they are opposite answers — see
    // the note on the control itself.
    exportNothingHeld: "No activity recorded yet — there is nothing to export.",
    exportNoMatch: "These filters match no entries. The file carries the rows the table is showing.",
    statTotal: "changes", statTotalLabel: "in range",
    statActors: "people", statActorsLabel: "made them",
    statLatest: "latest", statLatestNone: "—",
    csvAt: "When", csvActor: "Changed by", csvTarget: "Target", csvArea: "Screen", csvMessage: "What changed",
    // Said on the exception, not on the rule. Server rows are the ordinary case and badging all
    // of them would make the badge the background — which is how the offline camera ended up the
    // quietest thing on its own screen.
    recordedClient: "Not on the server",
    recordedClientWhy: "This console wrote this row. The server has no record of it — the action it describes is not wired to the API yet.",
    csvRecordedBy: "Recorded by", csvServer: "server", csvClient: "browser",
    csvActorId: "Account", csvBefore: "Was", csvAfter: "Became",
  },
  ko: {
    intro: "포털에서 이 프로젝트에 가해진 모든 변경입니다. 기관 전체에 적용되는 정책 변경과, 등록 코드로 가입해 계정이 만들어진 일도 함께 나옵니다.",
    empty: "기록된 변경이 없습니다.",
    loadFailed: "변경 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    noMatch: "조건에 맞는 기록이 없습니다.",
    colAt: "시각", colActor: "변경한 사람", colTarget: "대상", colArea: "화면", colMessage: "변경 내용",
    searchPlaceholder: "변경 내용 검색",
    /* 「전체」 alone said nothing about what it narrowed — the control beside it reads 「전체 화면」
       and the one in the tab next door reads 「전체 조회자」, so this was the only filter on the
       screen that made the reader open it to find out. Named after the column it filters. */
    filterAllActors: "변경한 사람 전체",
    filterAllAreas: "전체 화면",
    range7: "최근 7일", range30: "최근 30일", range90: "최근 90일", rangeAll: "보관분 전체",
    clearFilters: "해제",
    export: "CSV 내보내기",
    exportNothingHeld: "기록된 변경이 없어 내보낼 것이 없습니다.",
    exportNoMatch: "조건에 맞는 기록이 없습니다. 파일에는 표에 보이는 행만 담깁니다.",
    statTotal: "건", statTotalLabel: "기간 내 변경",
    statActors: "명", statActorsLabel: "변경한 사람",
    statLatest: "마지막", statLatestNone: "—",
    csvAt: "시각", csvActor: "변경한 사람", csvTarget: "대상", csvArea: "화면", csvMessage: "변경 내용",
    recordedClient: "서버 미기록",
    recordedClientWhy: "이 줄은 콘솔이 적었고 서버에는 없습니다. 여기 적힌 동작이 아직 API에 연결되지 않았습니다.",
    csvRecordedBy: "기록 주체", csvServer: "서버", csvClient: "브라우저",
    csvActorId: "계정", csvBefore: "이전 값", csvAfter: "바뀐 값",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * A list has four states (see PortalShared: rows · empty · loading · failed) and this tab can
 * only ever be in two of them today, because it reads the in-memory store synchronously: there
 * is no second where the rows are in the air, and no request that can come back 500.
 *
 * WHAT REPLACES THIS: the GET for this list. `listState` becomes that request's own state —
 * "loading" while it is out, "failed" when it is rejected, "ready" once the rows are in — and
 * `retryList` becomes the refetch the failed state's button calls. Nothing below it changes:
 * the table already branches on these three words.
 *
 * The ?listState= override is the only reason this reads the URL at all. It is here so the two
 * states that are unreachable today can still be opened, seen and reviewed, and it is ONE line
 * to delete when the fetch lands. It is not a setting: nothing in Portal writes this parameter,
 * so nobody arrives at it by accident.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  // Until there is a request there is nothing to ask for again, so retrying can only drop the
  // override and show what the store holds. This call becomes the refetch.
  return [state, () => setState("ready")];
}

export default function ProjectActivityTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [listState, retryList] = useListState();
  const auditLog = useVcaStore(s => s.auditLog);
  const recordListExport = useVcaStore(s => s.recordListExport);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const projectZone = project?.timeZone ?? PROJECT_TIME_ZONE;
  const { sort, toggle: toggleSort } = useTableSort<ActivitySortKey>({ key: "at", direction: "desc" });
  const [actorFilter, setActorFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  /*
   * 30 days is the default, and a default is not a filter somebody set.
   *
   * The chip beside the controls read "1 filter" on a screen nobody had touched, and clearing
   * that filter widened the window to all time instead of returning to the default — so the
   * one control labelled "clear" was the only one that made the list bigger.
   */
  const DEFAULT_RANGE = "30";
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [search, setSearch] = useState("");
  // Post-mount, like every other clock read in Portal: a date range measured during render cuts
  // at a different instant on the server than in the browser, and the two frames disagree about
  // which rows are in it. Until it is known the range filter passes everything through, which is
  // the widest answer and therefore the one that cannot hide a row from the first paint.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);

  // Same scope as the Overview's card — see the note at the top of this file.
  const projectEntries = useMemo(
    () => auditLog.filter(a => a.projectId === projectId || (a.teamId !== undefined && a.teamId === project?.teamId)),
    [auditLog, projectId, project?.teamId],
  );

  /* Built from what is in the log, not from the account list: somebody whose account was removed
     still made the changes they made, and a review looking for them has to be able to pick them. */
  const actorOptions = useMemo(
    () => [...new Set(projectEntries.map(a => a.actor))].sort().map(a => ({ value: a, label: a })),
    [projectEntries],
  );

  const areaLabel = (area: AuditArea) => AUDIT_AREA_LABEL[area][lang];
  /*
   * THE RAIL'S OWN MARK IN FRONT OF THE NAME (owner, 2026-09-28: 화면 앞에 사이드바에 있는
   * 아이콘 넣어줘).
   *
   * Not a new icon set — `PROJECT_TABS` is where the rail draws these, so the mark beside
   * 「입력 소스」 here is the same 16px glyph the reader clicked to get to this screen.
   *
   * EVERY AREA HAS ONE, AND NONE IS BORROWED (owner, 2026-09-28: 설정 · 가입 화면 · 앱의 레드맵,
   * 이거 세 개에만 아이콘이 없는 게 어색하네.. 흠 아이콘을 뺄까..). Dropping them all was the
   * other way out, and it would have cost the column the thing it is for — a category you scan
   * rather than read. The three with no rail row turned out to have marks already: 설정 wears the
   * gear the project screen's settings affordance draws, 가입 화면 wears the key the console uses
   * for a registration code, and 레드맵 wears the app's OWN tab icon. Nothing new was drawn and
   * nothing was taken from a neighbouring row.
   */
  const AREA_TAB: Partial<Record<AuditArea, DetailTab>> = {
    vip: "vip", cameras: "cameras", server: "server",
    accounts: "users", roster: "users",
    presets: "grants", cameraGroups: "grants",
    license: "license", records: "records", requests: "requests",
  };
  const areaIcon = (area: AuditArea) => {
    /* 설정 is not a rail row — it opens from the account menu — but the console already has a mark
       for it: the gear PortalProjectDetailPage draws on its settings affordance (SettingsIcon,
       16px, stroke 2.1). Same glyph at the same weight rather than a second one, and imported from
       lucide rather than from that file, which renders this one (importing back would be a cycle). */
    if (area === "settings") return <Settings size={16} strokeWidth={2.1} color="var(--gray-400)" />;
    /* 가입 화면 — the page a registration code is redeemed on. No menu row anywhere, but the
       console already carries a mark for that code: the key the roster's 코드 일괄 발급 wears. The
       row is "somebody used their code", so the key is what it is ABOUT rather than a borrowed
       screen. */
    if (area === "signup") return <KeyRound size={16} strokeWidth={2.1} color="var(--gray-400)" />;
    /* 레드맵 — an app screen, so it gets the APP's own tab icon, the same way the portal areas get
       the rail's. The app draws these as a CSS mask so the colour is the caller's; drawn the same
       way here, because an <img> would arrive in the file's own black. */
    if (area === "redmap") return (
      <span style={{
        width: "16px", height: "16px", backgroundColor: "var(--gray-400)",
        maskImage: "url(/icons/nav-redmap.svg)", maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center",
        WebkitMaskImage: "url(/icons/nav-redmap.svg)", WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center",
      }} />
    );
    const tab = AREA_TAB[area];
    const Icon = tab ? PROJECT_TABS.find(x => x.id === tab)?.icon : undefined;
    return Icon ? <Icon color="var(--gray-400)" /> : null;
  };

  /* Only the screens this project's log actually has rows for, and in rail order rather than
     alphabetically — the same rule as the actor list above. A filter offering thirteen screens
     when eight of them return nothing is thirteen dead ends. */
  const areaOptions = useMemo(() => {
    const present = new Set(projectEntries.map(a => a.area).filter(Boolean));
    return AUDIT_AREAS.filter(a => present.has(a)).map(a => ({ value: a, label: AUDIT_AREA_LABEL[a][lang] }));
  }, [projectEntries, lang]);

  const rangeDays = RANGES.find(r => r.value === range)?.days ?? null;
  const q = search.trim().toLowerCase();
  const rows = projectEntries
    .filter(a => {
      if (rangeDays === null || nowMs === null) return true;
      return new Date(a.at).getTime() >= nowMs - rangeDays * 86_400_000;
    })
    .filter(a => actorFilter === "ALL" || a.actor === actorFilter)
    .filter(a => areaFilter === "ALL" || a.area === areaFilter)
    /* Over the sentence AND over the three columns — the screen's name is only in the row as a
       key, so searching "라이선스" would find nothing in `message` on a row that says "Licence
       … installed". The sentence stays in the haystack because a fallback row has nothing else. */
    .filter(a => !q || [a.message, a.target, a.action, a.area ? areaLabel(a.area) : ""]
      .some(v => v?.toLowerCase().includes(q)));

  const visible = sortRows(rows, sort, (a, key) => {
    switch (key) {
      case "at": return a.at;
      case "actor": return a.actor.toLowerCase();
      /* Sorted by the printed label, so the grouping a reader sees is the grouping they asked
         for. Rows with no screen sort together at the end under either direction's empty string. */
      case "area": return a.area ? areaLabel(a.area).toLowerCase() : "";
      case "target": return (a.target ?? "").toLowerCase();
    }
  });

  // The date range is a filter like the other two, so it counts as one unless it is showing
  // everything — otherwise the chip would read "1 filter" on a screen nobody has narrowed.
  const activeFilterCount = (range === DEFAULT_RANGE ? 0 : 1) + (actorFilter === "ALL" ? 0 : 1)
    + (areaFilter === "ALL" ? 0 : 1) + (q ? 1 : 0);
  const clearFilters = () => { setRange(DEFAULT_RANGE); setActorFilter("ALL"); setAreaFilter("ALL"); setSearch(""); };

  const stamp = (at: string) => {
    const d = new Date(at);
    return `${dateKeyIn(d, projectZone)} ${clockMinutesIn(d, projectZone)}`;
  };

  const exportCsv = () => {
    /* Same order as the table, and the header now matches what the body actually writes — it read
       「대상, 화면」 over cells that were area-then-target, so a spreadsheet had the two columns
       swapped under their own names. */
    /* 계정, 이전 값, 바뀐 값 go out with the file too.
       The spreadsheet is what gets quoted in a review, and the two things a review asks that a
       display name and a sentence cannot answer are "which account was that" — names repeat and
       change — and "what was it before", which nothing else keeps once it is overwritten. Empty
       for the rows that are events rather than edits; see AuditEvent.before. */
    const header = [t.csvActor, t.csvActorId, t.csvArea, t.csvTarget, t.csvMessage, t.csvBefore, t.csvAfter, t.csvAt, t.csvRecordedBy];
    // The column goes out with the file. A row pulled into a spreadsheet loses the screen's
    // second line, and what gets quoted in a review is the spreadsheet.
    //
    // A FALLBACK ROW PUTS ITS WHOLE SENTENCE IN THE LAST COLUMN and leaves the two new ones
    // empty. The table can span three cells with it; a spreadsheet cannot, and splitting one
    // sentence across three cells by guessing is the parser this change exists to avoid. Empty
    // beats a cell that says something the row never claimed.
    const body = visible.map((a: AuditEvent) => [
      a.actor,
      a.actorEmail ?? a.actorId ?? "",
      a.area ? areaLabel(a.area) : "", a.target ?? "",
      a.area ? (a.action ?? a.message) : a.message,
      a.before ?? "", a.after ?? "",
      stamp(a.at),
      a.recordedBy === "client" ? t.csvClient : t.csvServer,
    ]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    // BOM so Excel reads the Korean columns as UTF-8 rather than the local code page.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? projectId}-activity.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Written down because a list leaving the console is the part an audit asks about, and until
    // now nothing here knew it had happened. Not a gate — see ListExportRecord.
    recordListExport({ projectId, list: "activity", rowCount: body.length });
  };

  /* Empty log or empty filter — the same split the table body below already makes, said once so
     the button and the empty row cannot drift apart. undefined while there is something to export:
     a title on a live control is a tooltip nobody asked for. */
  const exportBlocked = visible.length > 0 ? undefined
    : projectEntries.length === 0 ? t.exportNothingHeld : t.exportNoMatch;

  /*
   * NOTHING IS HELD, SO NOTHING IS OFFERED TO NARROW IT (control audit, 2026-09-29).
   *
   * On a project whose log has never been written to — a freshly provisioned site — this toolbar
   * drew a search box, a date range, an actor filter and four sortable headings over zero rows.
   * Seven live controls, none of which could change anything, above a sentence saying there is
   * nothing here. A control that answers every press with the same empty table teaches the reader
   * that the controls on this screen do not work, which is a lesson they carry to the screen where
   * they do.
   *
   * KEYED OFF THE LOG, NOT OFF THE TABLE. `visible.length === 0` would have hidden the filters the
   * moment a filter matched nothing — taking away the only way back. The question is whether
   * there is anything to narrow at all.
   *
   * WHAT STAYS: the summary strip, the column headings, the empty state, and Export CSV — greyed
   * with the reason on hover, which is the rule across the product (see the note on the button).
   * The headings stay because they say what this log holds; they simply stop claiming to sort.
   */
  const nothingHeld = projectEntries.length === 0;

  const distinctActors = new Set(rows.map(a => a.actor)).size;
  const latest = visible.length > 0
    ? [...rows].sort((a, b) => b.at.localeCompare(a.at))[0]
    : undefined;

  return (
    <div>
      {/* Counts for what the filters currently select, not for the whole log: the point of the
          strip on a filtered screen is to describe the slice being read. */}
      <SummaryStrip cells={[
        { key: "total", icon: <History size={14} strokeWidth={2.4} />, figure: rows.length, unit: t.statTotal, label: t.statTotalLabel },
        { key: "actors", icon: <UserCog size={14} strokeWidth={2.4} />, figure: distinctActors, unit: t.statActors, label: t.statActorsLabel },
        {
          key: "latest", icon: <CalendarClock size={14} strokeWidth={2.4} />,
          figure: latest ? stamp(latest.at).slice(5, 10) : t.statLatestNone,
          label: t.statLatest,
        },
      ]} state={listState} />

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: TOOLBAR_GAP }}>
        {/* All four go together — see nothingHeld. The row itself stays, because Export CSV and
            its reason still belong on it. */}
        {!nothingHeld && <>
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
          <FilterSelect value={range} onChange={setRange} options={[
            { value: "7", label: t.range7 },
            { value: "30", label: t.range30 },
            { value: "90", label: t.range90 },
            { value: "ALL", label: t.rangeAll },
          ]} />
          <FilterSelect value={actorFilter} onChange={setActorFilter}
            options={[{ value: "ALL", label: t.filterAllActors }, ...actorOptions]} />
          {/* Only once more than one screen is in the log. On a project whose every entry came from
              the same place, this control has one real choice and narrows nothing. */}
          {areaOptions.length > 1 && (
            <FilterSelect value={areaFilter} onChange={setAreaFilter}
              options={[{ value: "ALL", label: t.filterAllAreas }, ...areaOptions]} />
          )}
        </>}
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} />
        <span style={{ flex: 1 }} />
        {/* WHY THE GREY BUTTON SAYS WHICH KIND OF NOTHING IT IS. The two reasons this control can
            be dead send an auditor to opposite conclusions — "nothing was ever recorded on this
            project" is a finding somebody writes down, "the range you picked holds nothing" is
            their own filter and they should widen it. Greyed out with no sentence, the first is
            what a reader assumes. The roster's export answers the same question through
            RowActionsMenu's `reason`; this toolbar has no menu to hang a footnote on, so the
            sentence rides on the control.

            On the wrapper as well as the button: a disabled button dispatches no pointer events,
            and browsers differ on whether they still show its own title — the span around it is
            hovered either way. */}
        <span title={exportBlocked} style={{ display: "inline-flex" }}>
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={visible.length === 0} title={exportBlocked}
            style={{
              display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px",
              borderRadius: "8px", border: "none", backgroundColor: "transparent",
              color: visible.length === 0 ? "var(--gray-300)" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 600, cursor: visible.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
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
            { label: t.colActor, key: "actor" as ActivitySortKey },
            /* 화면 before 대상 (owner, 2026-09-29): the row then reads 누가 · 어디서 · 무엇을 ·
               어떻게 · 언제, which narrows from the place to the thing instead of naming a
               camera code before saying which screen it was touched on. */
            { label: t.colArea, key: "area" as ActivitySortKey },
            { label: t.colTarget, key: "target" as ActivitySortKey },
            /* Not sortable, and the only one of the five that is not. Sorting by the predicate
               groups "Removed" beside "Renamed" — an alphabet, not a subject. The two columns
               beside it are the ones a reader groups by, and they sort. */
            { label: t.colMessage },
            { label: t.colAt, key: "at" as ActivitySortKey },
          ] as { label: string; key?: ActivitySortKey }[]).map((h, i) => (
            /* sortKey withheld while nothing is held, which is how SortableHeader draws a plain
               heading — it takes the same three props everywhere else and renders text when there
               is no key. So the column keeps its name and stops offering to reorder nothing. */
            <span key={i}><SortableHeader label={h.label} sortKey={nothingHeld ? undefined : h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {/* Only the rows are replaced — the headings above and the filters above them are still
            true while the answer is on its way.

            Loading before empty, and the order is the whole point: "nothing has happened here"
            printed over a request still in the air is a false answer that reads exactly like a
            true one. */}
        {listState === "loading" ? (
          <TableSkeleton grid={GRID} />
        ) : listState === "failed" ? (
          <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
        ) : visible.length === 0 ? (
          /* Two different empty states. "Nothing has happened here" and "nothing matches what you
             asked for" send the reader to different places, and one message for both sends half
             of them to the wrong one. */
          <TableEmpty text={projectEntries.length === 0 ? t.empty : t.noMatch} />
        ) : visible.map((a: AuditEvent, i) => {
          /* WHO SAW THIS HAPPEN, on the rows where the answer is "only the browser that did it".
             An audit log's whole claim is that an independent party observed the event; a line the
             client wrote is the client's own account of itself, and mixing the two with no mark
             lets the second be quoted as the first.

             Built once and hung under whichever cell ends the row, so the split and the unsplit
             shape cannot drift into carrying different marks.

             HANDOFF NOTE: these are the rows that have to move server-side. The store's
             clientAudit() is the only way the front end writes one and it cannot say "server", so
             this label is exhaustive by construction — every row carrying it is an entry the API
             does not yet record. */
          /* Inline, on the same line as the change it qualifies (owner, 2026-09-29: 그냥 한줄로
             적어줘 / 공간도 있는뎅). It was a block under the text, which gave every client row two
             lines and made the table look like it held two kinds of entry. This column wraps
             anyway, so a long change simply carries the mark to the end of its last line. */
          const clientMark = a.recordedBy === "client" ? (
            <span title={t.recordedClientWhy} style={{ fontSize: "11px", color: "var(--gray-400)", marginLeft: "6px", whiteSpace: "nowrap", cursor: "help" }}>
              {t.recordedClient}
            </span>
          ) : null;
          return (
          <div key={a.id} style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
            padding: "10px 16px", alignItems: "baseline",
            borderBottom: i === visible.length - 1 ? "none" : TABLE_RULE,
          }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.actor}
            </span>
            {/* A ROW IS SPLIT OR IT IS NOT — never half of each.

                An entry that arrived with no `area` is an entry nobody has taught to say where it
                happened: an older row, or a server writing the shape it wrote before this change.
                Dropping its sentence into one of three narrow cells and dashing the other two
                would read as "this change had no screen and no subject", which is a claim about
                the change rather than about what was recorded. So the sentence keeps the width it
                had, across all three, and the row is legible exactly as it was.

                It also means the fallback cannot be mistaken for the ordinary case: a split row
                and an unsplit one do not look alike. */}
            {a.area === undefined ? (
              <>
                <span style={{ gridColumn: FALLBACK_SPAN, fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>
                  {a.message}
                  {clientMark}
                </span>
                <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {stamp(a.at)}
                </span>
              </>
            ) : (
              <>
                {/* The screen, one step quieter than the two beside it: on a list filtered to one
                    screen it repeats down the column, and it is the column a reader scans rather
                    than reads. */}
                <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }} title={areaLabel(a.area)}>
                  {/* 16px, the rail's own size. Fixed box so the labels line up whether or not the
                      area has a mark. */}
                  <span style={{ flexShrink: 0, width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                    {areaIcon(a.area)}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {areaLabel(a.area)}
                  </span>
                </span>
                {/* The thing that changed, in the weight a name gets everywhere else in Portal.
                    Ellipsised, not wrapped: it is a name, and a name broken over two lines makes
                    the row taller without making it clearer. */}
                <span style={{ fontSize: "12px", color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={a.target}>
                  {a.target}
                </span>
                {/* What was done to it wraps rather than truncating. It is the column the screen
                    exists for, and an entry cut off at the ellipsis is an entry nobody can act
                    on. `?? a.message` is the half-shape guard: a row with an area but no action
                    still says something rather than nothing. */}
                <span style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>
                  {a.action ?? a.message}
                  {clientMark}
                  {/* THE PAIR, UNDER THE SENTENCE — and only where the row has one.
                      An edit's two values are what "was this allowed" turns on: 90일 → 30일
                      destroys footage and 30일 → 90일 does not, and the sentence above reads the
                      same either way for half the rows that write it. Rows that record an event
                      rather than an edit (a code issued, a CSV exported, a camera added) have no
                      previous value and get no line — an arrow with a dash on its left would look
                      like a value that used to be empty. */}
                  {a.before !== undefined && a.after !== undefined && (
                    <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "var(--gray-400)" }}>
                      {a.before}
                      <span aria-hidden="true" style={{ margin: "0 5px" }}>→</span>
                      <span style={{ color: "var(--gray-600)", fontWeight: 600 }}>{a.after}</span>
                    </span>
                  )}
                </span>
                {/* Last, and in the same monospace it always had — a column of stamps only lines
                    up if the digits do. */}
                <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {stamp(a.at)}
                </span>
              </>
            )}
          </div>
          );
        })}
      </div>

      {/* Both notes at the foot, in one register.

          The first of them opened the screen — a 12px paragraph above the counts, which put a
          sentence describing the list between the reader and the list. Nobody arrives at an
          activity log needing to be told it is an activity log; they arrive looking for one
          entry. What the sentence says is worth keeping (the log carries institution-wide policy
          changes too, which is not guessable from the rows), but it is something you check after
          reading, not before — the same job as the note beside it. */}
      {/* Full width, not MEASURE (owner, 2026-09-28: 이거 가로폭 위에 표만큼 넓혀 줘). The reading
          measure is for prose somebody sits and reads; this is a two-sentence footnote under a
          full-width table, and held to 38em it wrapped into a narrow block that looked like the
          start of a column that was not there. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px" }}>
        {t.intro}
      </p>
    </div>
  );
}
