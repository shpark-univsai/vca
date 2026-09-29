"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, type SearchAccessRecord } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { DateRangeTrigger, dateKeyOf, type DateRangeValue } from "../shared/DateRangePicker";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, TABLE_RULE, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR, TOOLBAR_GAP,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, TableEmpty, TableSkeleton, TableLoadFailed, sortRows, useTableSort} from "./PortalShared";
import { Eye, FileOutput, ShieldAlert } from "lucide-react";

/**
 * Who looked up whom, and why they said they were doing it.
 *
 * This is the read half of the purpose requirement. Collecting a reason and never showing it to
 * anybody is not a control — an audit treats a record nobody can produce the same as a record that
 * was never kept — and the auditor role already existed here with nothing to open.
 *
 * Deliberately not the audit log. That one answers "who changed the configuration", is trimmed to
 * the last 200 entries and is read in passing on the Overview. This is the record somebody is
 * answerable for: it is sampled rather than skimmed, it is filtered by purpose and by operator, and
 * it leaves as a file.
 *
 * Shape follows PlanetScale's audit log (actor / action / IP / date with a filter chip per actor),
 * with the export Zoho puts on theirs — what an auditor is handed at the end is a file, not a URL.
 */

// Eight tracks, matching the eight columns the CSV writes. The table had seven and quietly
// dropped "Screen" — so the record an auditor reads on this page and the file they are handed
// disagreed about which fields the log even has.
/**
 * The columns are assembled rather than written out, because two of them only exist when
 * something outside this screen is true.
 *
 * A column that cannot be filled is not a placeholder, it is a promise the screen cannot keep —
 * and it gets worse once rows arrive, because then the reader watches entries land with that cell
 * dashed on every one of them and concludes the log is half broken. Purpose and Reference depend
 * on requireSearchPurpose; the IP depends on a server that is not there yet (the browser does not
 * know its own public address — see SearchAccessRecord.ip).
 *
 * Widths live next to their labels so the two cannot drift apart, which is what a second
 * hardcoded grid string would eventually do.
 */
const COLUMN_WIDTH = {
  at: "150px", actor: "1fr", purpose: "1fr", reference: "0.9fr",
  target: "1fr", surface: "0.8fr", results: "0.7fr", ip: "0.9fr",
} as const;

type LogSortKey = "at" | "actor" | "purpose" | "target";

const T = {
  en: {
    intro: "Every person look-up run from the monitoring app.",
    introWithPurpose: "Every person look-up run from the monitoring app, with the purpose the operator declared.",
    empty: "No look-ups recorded yet.",
    loadFailed: "Could not load the look-up log.",
    retry: "Try again",
    noMatch: "No look-ups match these filters.",
    // The app's own names for its screens. An unknown code is printed as-is rather than guessed
    // at — a wrong screen name in an audit row is worse than a code the reader can look up.
    surfaceName: { live: "Live monitoring", reid: "Re-ID", redmap: "Redmap", redface: "RedFace" } as Record<string, string>,
    colAt: "When", colActor: "Searched by", colPurpose: "Purpose", colReference: "Reference",
    /* The last column holds SearchAccessRecord.ip, an address string the server writes. It was
       headed "From" / "위치" — the Korean said "location", which an IP is not: it names a machine
       on a network, and reading a place out of it is an inference somebody else has to make. On a
       log that gets quoted in a review, a heading that has already drawn the conclusion is the
       heading that gets quoted. Both languages renamed together — fixing only the Korean is how
       the two sides end up saying different things. */
    colTarget: "Searched for", colSurface: "Screen", colResults: "Results", colIp: "IP address",
    filterAllPurposes: "All purposes",
    filterAllDates: "Any date",
    filterAllSurfaces: "Every screen",
    filterAllActors: "Anyone",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,
    clearFilters: "Clear",
    export: "Export CSV",
    // Two ways this button can be dead, and on this tab they are opposite answers — see the note
    // on the control itself.
    exportNothingHeld: "No look-ups recorded yet — there is nothing to export.",
    exportNoMatch: "These filters match no look-ups. The file carries the rows the table is showing.",
    statTotal: "look-ups", statTotalLabel: "recorded",
    statNoRef: "no reference", statNoRefUnit: "look-ups",
    statOperators: "operators", statOperatorsLabel: "searched",
    ownerOnly: "Only the owner and auditors read this log.",
    csvAt: "When", csvActor: "Searched by", csvPurpose: "Purpose", csvReference: "Reference",
    csvActorEmail: "Operator address",
    csvTarget: "Searched for", csvSurface: "Screen", csvResults: "Results", csvIp: "IP address",
    none: "—",
  },
  ko: {
    intro: "모니터링 앱에서 실행된 인물 조회입니다.",
    introWithPurpose: "모니터링 앱에서 실행된 인물 조회와, 그때 관제요원이 밝힌 목적입니다.",
    empty: "기록된 조회가 없습니다.",
    loadFailed: "조회 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    noMatch: "조건에 맞는 조회 기록이 없습니다.",
    surfaceName: { live: "모니터링", reid: "Re-ID", redmap: "레드맵", redface: "RedFace" } as Record<string, string>,
    colAt: "시각", colActor: "조회한 사람", colPurpose: "목적", colReference: "참조번호",
    colTarget: "조회 대상", colSurface: "화면", colResults: "결과", colIp: "IP 주소",
    filterAllPurposes: "전체 목적",
    filterAllDates: "전체 기간",
    filterAllSurfaces: "전체 화면",
    filterAllActors: "조회한 사람 전체",
    filtersActive: (n: number) => `필터 ${n}`,
    clearFilters: "해제",
    export: "CSV 내보내기",
    exportNothingHeld: "기록된 조회가 없어 내보낼 것이 없습니다.",
    exportNoMatch: "조건에 맞는 조회가 없습니다. 파일에는 표에 보이는 행만 담깁니다.",
    statTotal: "건", statTotalLabel: "기록된 조회",
    statNoRef: "참조번호 없음", statNoRefUnit: "건",
    statOperators: "명", statOperatorsLabel: "조회한 사람",
    ownerOnly: "이 기록은 최고관리자와 읽기 전용 관리자가 읽습니다.",
    csvAt: "시각", csvActor: "조회한 사람", csvPurpose: "목적", csvReference: "참조번호",
    csvActorEmail: "조회자 주소",
    csvTarget: "조회 대상", csvSurface: "화면", csvResults: "결과", csvIp: "IP 주소",
    none: "—",
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

export default function ProjectSearchLogTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [listState, retryList] = useListState();
  const searchAccessLog = useVcaStore(s => s.searchAccessLog);
  const recordListExport = useVcaStore(s => s.recordListExport);
  // The project's zone, not the reviewer's browser and not siteTimeZone() — see the note on the
  // timestamp cell below.
  const projectZone = useVcaStore(s => s.projects.find(p => p.id === projectId)?.timeZone) ?? PROJECT_TIME_ZONE;
  const { sort, toggle: toggleSort } = useTableSort<LogSortKey>({ key: "at", direction: "desc" });
  const purposeAsked = getComplianceConfig().requireSearchPurpose;
  /**
   * The IP column appears once anything can fill it.
   *
   * Not tied to a config switch like the purpose columns are, because this is not a policy — it is
   * a server that has not arrived. SearchAccessRecord.ip is written by the backend and a browser
   * cannot know its own public address, so today every row would carry a dash under a heading that
   * promises where somebody was sitting.
   */
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  /**
   * The range an auditor is asking about.
   *
   * Every comparable log opens with one — 1Password, Vanta, Okta and Dropbox all put a date range
   * ahead of the other filters, because nobody reads an audit log from the top; they arrive with a
   * day or a week in mind. This log had a filter for who and none for when, which is the wrong way
   * round: the operator is usually the thing being looked FOR, and the date is what narrows the
   * haystack first.
   *
   * Empty means unbounded on that side, so one field alone is a useful question ("anything since
   * Monday").
   */
  /*
   * THE APP'S OWN PICKER (owner, 2026-09-29: 이 컴포넌트는 너무 작아 — 앱에서 쓰이는 날짜 피커
   * 컴포넌트 갖다가 써줘).
   *
   * These were two bare `<input type="date">`, which draw the BROWSER's control — the only place
   * in Portal where that happened, and in an English console it still printed 「연도. 월. 일.」
   * because the picker follows the operating system rather than the page. The monitoring app has
   * carried a proper range picker since it was built; it now lives in components/shared so both
   * halves use it.
   *
   * The range is held as Dates for the picker and read back as calendar-day strings for the
   * filter, which is unchanged: it compares the day in the PROJECT's zone, not a UTC slice of it.
   * `dateKeyOf` rather than toISOString for exactly that reason.
   */
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const fromDate = range.start ? dateKeyOf(range.start) : "";
  const toDate = range.end ? dateKeyOf(range.end) : "";
  const [actorFilter, setActorFilter] = useState("ALL");
  /* 화면 필터 (owner, 2026-09-29: 조회기록 날짜 검색 옆에 사람으로 필터링할 일은 적을것
     같은데, 화면으로 필터링할일이 더 많지않을까?).

     The table has had a 「화면」 column since it was built and no way to narrow by it, while the
     tab next door — the same screen's other half — has had a screen filter all along. And the
     owner is right about the order: an auditor arrives asking 「모니터링에서 누가 뭘 찾았나」 far
     more often than they arrive with one person's name. */
  const [surfaceFilter, setSurfaceFilter] = useState("ALL");

  const projectRecords = useMemo(
    () => searchAccessLog.filter(r => r.projectId === projectId),
    [searchAccessLog, projectId],
  );

  /* Built from what is in the log rather than from the purpose list: a retired purpose still has
     records under it, and an auditor filtering for it must be able to find them. */
  /* Records with no purpose do not appear here — an installation that never asked has nothing to
     filter by, and the control disappears rather than offering one empty choice. */
  const purposeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    projectRecords.forEach(r => { if (r.purposeId && r.purposeLabel) seen.set(r.purposeId, r.purposeLabel); });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [projectRecords]);
  /* Keyed by address rather than by name: two operators sharing a name would collapse into one
     option and quietly return both their look-ups under either. */
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    projectRecords.forEach(r => seen.set(r.actorEmail, r.actor));
    return [...seen].map(([value, name]) => ({ value, label: `${name} · ${value}` }));
  }, [projectRecords]);

  /*
   * THE FOUR SCREENS A SEARCH CAN COME FROM, always — not the ones this log happens to hold.
   *
   * It was derived from the rows at first, following the rule the actor filter uses. Wrong here,
   * and for two reasons. The surfaces are a CLOSED set (the app has four places to search from,
   * and `recordSearchAccess` writes one of them), unlike operators, who are whoever happens to
   * have looked. And filtering to a screen with no rows is a real question with a real answer:
   * 「RedFace에서는 아무도 찾지 않았다」 is what a reviewer comes to confirm — deriving the options
   * from the data removes that question exactly when the answer is 「없음」.
   *
   * It is also why the control is drawn on an empty log: the screen says what it can be asked.
   */
  const surfaceOptions = useMemo(
    () => (["live", "reid", "redmap", "redface"] as const).map(value => ({ value, label: t.surfaceName[value] ?? value })),
    [t],
  );

  const showIp = projectRecords.some(r => r.ip);
  /* 시각이 맨 뒤 (owner, 2026-09-28: 변경기록도 조회기록도 시각이 맨 뒤로갔으면 해) — the two
     tabs of this screen keep the same column order as each other. */
  const columns = [
    "actor",
    ...(purposeAsked ? ["purpose", "reference"] : []),
    "target", "surface", "results",
    ...(showIp ? ["ip"] : []),
    "at",
  ] as (keyof typeof COLUMN_WIDTH)[];
  const grid = columns.map(c => COLUMN_WIDTH[c]).join(" ");

  const rows = projectRecords
    .filter(r => purposeFilter === "ALL" || r.purposeId === purposeFilter)
    .filter(r => surfaceFilter === "ALL" || r.surface === surfaceFilter)
    .filter(r => actorFilter === "ALL" || r.actorEmail === actorFilter)
    // Compared in the project's own zone, the same one the rows print. A range picked as
    // "2026-09-15" means that day at the site, not a UTC slice of it that starts nine hours early.
    .filter(r => {
      if (!fromDate && !toDate) return true;
      const day = dateKeyIn(new Date(r.at), projectZone);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });
  const visible = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "at": return r.at;
      // Sorted by the address, so two people with the same name do not interleave.
      case "actor": return `${r.actor}\u0000${r.actorEmail}`.toLowerCase();
      case "purpose": return (r.purposeLabel ?? "").toLowerCase();
      case "target": return r.target.toLowerCase();
    }
  });

  const activeFilterCount = [purposeFilter, surfaceFilter, actorFilter].filter(v => v !== "ALL").length
    + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => { setPurposeFilter("ALL"); setSurfaceFilter("ALL"); setActorFilter("ALL"); setRange({ start: null, end: null }); };

  /* A look-up with no reference is not a fault — most purposes do not require one — but it is the
     slice a reviewer samples first, so the strip counts it rather than making them filter for it. */
  const noReference = projectRecords.filter(r => !r.reference).length;
  const operatorCount = new Set(projectRecords.map(r => r.actor)).size;

  /* Empty log or empty filter — the same split the table body below makes, said once so the
     button and the empty row cannot drift apart. undefined while there is something to export: a
     title on a live control is a tooltip nobody asked for. */
  const exportBlocked = visible.length > 0 ? undefined
    : projectRecords.length === 0 ? t.exportNothingHeld : t.exportNoMatch;

  /*
   * NOTHING IS HELD, SO NOTHING IS OFFERED TO NARROW IT (control audit, 2026-09-29).
   *
   * Same call as the tab next door, and for the same reason: on a project nobody has searched
   * from, this toolbar drew a date range and four sortable headings over zero rows — controls
   * that answer every press with the table already on screen.
   *
   * ONE EXCEPTION, AND IT IS NOT AN OVERSIGHT: the 「화면」 filter stays. Its options are a CLOSED
   * set the app defines rather than a list read off the rows (see surfaceOptions), and filtering
   * to a screen with no look-ups is a real question with a real answer — 「RedFace에서는 아무도
   * 찾지 않았다」 is what a reviewer comes here to confirm. It is the one control on an empty log
   * that still says something.
   *
   * KEYED OFF THE LOG, NOT OFF THE TABLE, so a filter that matches nothing never removes the way
   * back out of itself.
   */
  const nothingHeld = projectRecords.length === 0;

  const exportCsv = () => {
    // The file carries the columns the screen carries. A CSV with two always-blank columns is the
    // same unkept promise one screen further out, and it is the copy that leaves the building.
    const header = [t.csvAt, t.csvActor, t.csvActorEmail, ...(purposeAsked ? [t.csvPurpose, t.csvReference] : []), t.csvTarget, t.csvSurface, t.csvResults, ...(showIp ? [t.csvIp] : [])];
    const body = visible.map(r => [
      r.at, r.actor, r.actorEmail, ...(purposeAsked ? [r.purposeLabel ?? "", r.reference ?? ""] : []), r.target,
      t.surfaceName[r.surface] ?? r.surface,
      r.resultCount === undefined ? "" : String(r.resultCount), ...(showIp ? [r.ip ?? ""] : []),
    ]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-log-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Written down because a list leaving the console is the part an audit asks about, and until
    // now nothing here knew it had happened. Not a gate — see ListExportRecord.
    recordListExport({ projectId, list: "searchLog", rowCount: body.length });
  };

  const cell = (value: string, muted?: boolean) => (
    <span style={{ fontSize: "12px", color: muted ? "var(--gray-300)" : "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {value}
    </span>
  );

  return (
    <div>
      {/*
        NO "the app does not write this yet" BANNER. It was here and both of its sentences had
        stopped being true.
        
        It said the app never calls recordSearchAccess — it does, from four places (Data's live and
        Re-ID searches, Redmap's search and its deep link), wired when the look-up record was
        turned on. And it said a purpose is collected on screen but not kept; with
        requireSearchPurpose off the app does not ask for one at all.
        
        It was written before either of those was decided and nothing sent it away. An empty log
        was being explained by a warning that described a version of this product that no longer
        exists, and the explanation was louder than the empty state's own words — which are
        accurate: rows appear when somebody searches, and nothing is seeded.
      */}

      {projectRecords.length > 0 && (
        <SummaryStrip cells={[
          { key: "total", icon: <Eye size={14} strokeWidth={2.4} />, figure: projectRecords.length, unit: t.statTotal, label: t.statTotalLabel, tone: "neutral" },
          // Only where a reference could have been given. With no purpose collected, "no
          // reference" would count every row and raise a defect nobody could have avoided.
          ...(purposeAsked && noReference > 0 ? [{
            key: "noref", icon: <ShieldAlert size={14} strokeWidth={2.4} />, figure: noReference,
            unit: t.statNoRefUnit, label: t.statNoRef, tone: "warning" as const,
          }] : []),
          { key: "operators", icon: <Eye size={14} strokeWidth={2.4} />, figure: operatorCount, unit: t.statOperators, label: t.statOperatorsLabel, tone: "neutral" },
        ]} state={listState} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: TOOLBAR_GAP }}>
        {/* Gone with the columns: a filter whose only option is "all" narrows nothing. */}
        {/* First in the row, because it is the question an auditor arrives with. */}
        {!nothingHeld && <>
          <span style={{ display: "flex", alignItems: "center", width: "260px", flexShrink: 0 }}>
            <DateRangeTrigger lang={lang} value={range} onApply={setRange} emptyText={t.filterAllDates} />
          </span>
          {purposeAsked && (
            <FilterSelect value={purposeFilter} onChange={setPurposeFilter}
              options={[{ value: "ALL", label: t.filterAllPurposes }, ...purposeOptions]} />
          )}
        </>}
        {/* Before the person, because it is the more common question — and after the date, which
            is the one an auditor arrives with. */}
        <FilterSelect value={surfaceFilter} onChange={setSurfaceFilter}
          options={[{ value: "ALL", label: t.filterAllSurfaces }, ...surfaceOptions]} />
        {/* Same rule as the screen filter beside it: on a log nobody has written to, this offered
            「전체」 and nothing else — a control that narrows nothing, on the one screen where the
            reader most needs to trust what the controls mean. */}
        {actorOptions.length > 1 && (
          <FilterSelect value={actorFilter} onChange={setActorFilter}
            options={[{ value: "ALL", label: t.filterAllActors }, ...actorOptions]} />
        )}
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
        <span style={{ flex: 1 }} />
        {/* WHY THE GREY BUTTON SAYS WHICH KIND OF NOTHING IT IS. "Nobody has looked anybody up
            here" and "your date range matched nothing" are the same two sentences the empty table
            below already separates, and the export is where the difference leaves the building: an
            auditor handed nothing concludes the log is empty. The roster's export answers this
            through RowActionsMenu's `reason`; this toolbar has no menu to hang a footnote on, so
            the sentence rides on the control.

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
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: grid,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS,
          color: TABLE_HEADER_COLOR,
        }}>
          {(columns.map(c => ({
            at: { label: t.colAt, key: "at" as LogSortKey },
            actor: { label: t.colActor, key: "actor" as LogSortKey },
            purpose: { label: t.colPurpose, key: "purpose" as LogSortKey },
            reference: { label: t.colReference },
            target: { label: t.colTarget, key: "target" as LogSortKey },
            surface: { label: t.colSurface },
            results: { label: t.colResults },
            ip: { label: t.colIp },
          }[c])) as { label: string; key?: LogSortKey }[]).map((h, i) => (
            /* No key while nothing is held — SortableHeader then draws the heading as text, which
               is what a column with nothing under it can honestly be. */
            <span key={i}><SortableHeader label={h.label} sortKey={nothingHeld ? undefined : h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {/* The rows are the only part that changes: the column headings above and the filters
            above them stay put, because they are still true while the answer is on its way.

            Loading is checked BEFORE empty, and that order is the point of the whole branch. An
            empty state over data that has not arrived is a sentence the screen cannot support —
            "no look-ups recorded yet" read off a request still in the air is exactly the kind of
            plausible false answer an audit log must never give. */}
        {listState === "loading" ? (
          <TableSkeleton grid={grid} />
        ) : listState === "failed" ? (
          <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
        ) : visible.length === 0 ? (
          /* Two sentences, and on this tab the difference is the whole point. "Nobody has looked
             anybody up here" and "your date range and actor filter matched nothing" send an
             auditor to opposite conclusions, and the first one is an answer they might write down.
             The other five list tabs already separate these; the audit log was the one that did
             not. */
          <TableEmpty text={projectRecords.length === 0 ? t.empty : t.noMatch} />
        ) : visible.map((r: SearchAccessRecord, i) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: grid, columnGap: TABLE_COLUMN_GAP,
            padding: "10px 16px", alignItems: "center",
            borderBottom: i === visible.length - 1 ? "none" : TABLE_RULE,
          }}>
            {/* The instant, in the project's own zone — a look-up is filed under the day it
                happened at the site, not the day it was at the reviewer's desk. This said exactly
                that and then printed r.at.slice(0, 16), a substring of the stored ISO string with
                no conversion at all: SearchAccessRecord.at is server-supplied and therefore UTC,
                so an auditor sampling a Seoul site read every late-evening look-up under the
                previous day. */}
            {/* Name over address, the shape every comparable audit log uses. The name is what a
                reader recognises and the address is what makes the row name ONE person — two
                operators with the same name produce rows nobody can tell apart, and telling them
                apart is the whole job of this log. */}
            <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.actor}
              </span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.actorEmail}
              </span>
            </span>
            {purposeAsked && <>
              {/* Absent because this look-up carried none — see SearchAccessRecord.purposeId. */}
              {cell(r.purposeLabel ?? t.none, !r.purposeLabel)}
              {/* Absent, not blank: a reference that was never required reads differently from one
                  that is missing, and only the purpose knows which. */}
              {cell(r.reference ?? t.none, !r.reference)}
            </>}
            {cell(r.target)}
            {cell(t.surfaceName[r.surface] ?? r.surface)}
            {cell(r.resultCount === undefined ? t.none : String(r.resultCount), r.resultCount === undefined)}
            {showIp && cell(r.ip ?? t.none, !r.ip)}
            <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {`${dateKeyIn(new Date(r.at), projectZone)} ${clockMinutesIn(new Date(r.at), projectZone)}`}
            </span>
          </div>
        ))}
      </div>

      {/* Both notes at the foot, in one register — the same move the activity log already made.

          The first of them opened the screen, a 13px paragraph in the position a title would hold,
          with no title above it to be subordinate to. Nobody arrives at a search log needing to be
          told it is a search log; they arrive looking for one look-up, and three of the sentence's
          nouns are column headings six inches below it. The half worth keeping is the half the rows
          cannot show — that these are look-ups run in the MONITORING APP, so an auditor who finds
          nothing here knows to try the activity log rather than conclude nobody did anything.
          That is something you check after reading, not before.

          The second is not a permission notice — an auditor reading it has every right to be here —
          it is the answer to "is anybody actually looking at this", which is the question that
          decides whether the purpose field does any work at all. */}
      {/* One line (owner, 2026-09-29: 이거는 한줄로 표기해줘). Two stacked greys under a table
          read as a paragraph somebody has to decide whether to read; joined, it is one fact about
          this log — what it holds and who sees it. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px" }}>
        {(purposeAsked ? t.introWithPurpose : t.intro)} {t.ownerOnly}
      </p>
    </div>
  );
}
