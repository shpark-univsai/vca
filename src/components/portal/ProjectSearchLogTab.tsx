"use client";

import { useMemo, useState } from "react";
import { useVcaStore, type SearchAccessRecord } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import { getComplianceConfig } from "@/lib/complianceConfig";
import {
  BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR,
  ActiveFilterCount, FilterSelect, FIELD_STYLE, SortableHeader, SummaryStrip, sortRows, useTableSort, MEASURE } from "./PortalShared";
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
    emptyHint: "A row appears here each time an operator searches for a person in the app. Nothing is written in advance.",
    colAt: "When", colActor: "Operator", colPurpose: "Purpose", colReference: "Reference",
    colTarget: "Searched for", colSurface: "Screen", colResults: "Results", colIp: "From",
    filterAllPurposes: "All purposes",
    filterFrom: "From", filterTo: "To",
    filterAllActors: "All operators",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,
    clearFilters: "Clear",
    export: "Export CSV",
    statTotal: "look-ups", statTotalLabel: "recorded",
    statNoRef: "no reference", statNoRefUnit: "look-ups",
    statOperators: "operators", statOperatorsLabel: "searched",
    ownerOnly: "Only the owner and auditors read this log.",
    csvAt: "When", csvActor: "Operator", csvPurpose: "Purpose", csvReference: "Reference",
    csvTarget: "Searched for", csvSurface: "Screen", csvResults: "Results", csvIp: "From",
    none: "—",
  },
  ko: {
    intro: "모니터링 앱에서 실행된 인물 조회입니다.",
    introWithPurpose: "모니터링 앱에서 실행된 인물 조회와, 그때 관제요원이 밝힌 목적입니다.",
    empty: "기록된 조회가 없습니다.",
    emptyHint: "앱에서 인물을 조회할 때마다 한 줄씩 쌓입니다. 미리 채워두는 것은 없습니다.",
    colAt: "시각", colActor: "조회자", colPurpose: "목적", colReference: "참조번호",
    colTarget: "조회 대상", colSurface: "화면", colResults: "결과", colIp: "위치",
    filterAllPurposes: "전체 목적",
    filterFrom: "시작일", filterTo: "종료일",
    filterAllActors: "전체 조회자",
    filtersActive: (n: number) => `필터 ${n}`,
    clearFilters: "해제",
    export: "CSV 내보내기",
    statTotal: "건", statTotalLabel: "기록된 조회",
    statNoRef: "참조번호 없음", statNoRefUnit: "건",
    statOperators: "명", statOperatorsLabel: "조회한 사람",
    ownerOnly: "이 기록은 최고관리자와 읽기 전용 관리자가 읽습니다.",
    csvAt: "시각", csvActor: "조회자", csvPurpose: "목적", csvReference: "참조번호",
    csvTarget: "조회 대상", csvSurface: "화면", csvResults: "결과", csvIp: "위치",
    none: "—",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function ProjectSearchLogTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actorFilter, setActorFilter] = useState("ALL");

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
  const actorOptions = useMemo(
    () => [...new Set(projectRecords.map(r => r.actor))].map(a => ({ value: a, label: a })),
    [projectRecords],
  );

  const showIp = projectRecords.some(r => r.ip);
  const columns = [
    "at", "actor",
    ...(purposeAsked ? ["purpose", "reference"] : []),
    "target", "surface", "results",
    ...(showIp ? ["ip"] : []),
  ] as (keyof typeof COLUMN_WIDTH)[];
  const grid = columns.map(c => COLUMN_WIDTH[c]).join(" ");

  const rows = projectRecords
    .filter(r => purposeFilter === "ALL" || r.purposeId === purposeFilter)
    .filter(r => actorFilter === "ALL" || r.actor === actorFilter)
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
      case "actor": return r.actor.toLowerCase();
      case "purpose": return (r.purposeLabel ?? "").toLowerCase();
      case "target": return r.target.toLowerCase();
    }
  });

  const activeFilterCount = [purposeFilter, actorFilter].filter(v => v !== "ALL").length
    + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => { setPurposeFilter("ALL"); setActorFilter("ALL"); setFromDate(""); setToDate(""); };

  /* A look-up with no reference is not a fault — most purposes do not require one — but it is the
     slice a reviewer samples first, so the strip counts it rather than making them filter for it. */
  const noReference = projectRecords.filter(r => !r.reference).length;
  const operatorCount = new Set(projectRecords.map(r => r.actor)).size;

  const exportCsv = () => {
    // The file carries the columns the screen carries. A CSV with two always-blank columns is the
    // same unkept promise one screen further out, and it is the copy that leaves the building.
    const header = [t.csvAt, t.csvActor, ...(purposeAsked ? [t.csvPurpose, t.csvReference] : []), t.csvTarget, t.csvSurface, t.csvResults, ...(showIp ? [t.csvIp] : [])];
    const body = visible.map(r => [
      r.at, r.actor, ...(purposeAsked ? [r.purposeLabel ?? "", r.reference ?? ""] : []), r.target, r.surface,
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
        ]} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        {/* Gone with the columns: a filter whose only option is "all" narrows nothing. */}
        {/* First in the row, because it is the question an auditor arrives with. */}
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)}
            aria-label={t.filterFrom} title={t.filterFrom}
            style={{ ...FIELD_STYLE, height: CONTROL_HEIGHT, width: "150px", padding: "0 10px", fontSize: "12px" }} />
          <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>—</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)}
            aria-label={t.filterTo} title={t.filterTo}
            style={{ ...FIELD_STYLE, height: CONTROL_HEIGHT, width: "150px", padding: "0 10px", fontSize: "12px" }} />
        </span>
        {purposeAsked && (
          <FilterSelect value={purposeFilter} onChange={setPurposeFilter}
            options={[{ value: "ALL", label: t.filterAllPurposes }, ...purposeOptions]} />
        )}
        <FilterSelect value={actorFilter} onChange={setActorFilter}
          options={[{ value: "ALL", label: t.filterAllActors }, ...actorOptions]} />
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
        <span style={{ flex: 1 }} />
        <button className="portal-btn-quiet" onClick={exportCsv} disabled={visible.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px",
            borderRadius: "8px", border: "none", backgroundColor: "transparent",
            color: visible.length === 0 ? "var(--gray-300)" : "var(--gray-600)",
            fontSize: "12px", fontWeight: 600, cursor: visible.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
          <FileOutput size={14} strokeWidth={2.4} />
          {t.export}
        </button>
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: grid,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: BORDER, borderTopLeftRadius: "16px", borderTopRightRadius: "16px",
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
            <span key={i}><SortableHeader label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-500)" }}>{t.empty}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5, marginTop: "6px" }}>{t.emptyHint}</p>
          </div>
        ) : visible.map((r: SearchAccessRecord, i) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: grid, columnGap: TABLE_COLUMN_GAP,
            padding: "10px 16px", alignItems: "center",
            borderBottom: i === visible.length - 1 ? "none" : BORDER,
          }}>
            {/* The instant, in the project's own zone — a look-up is filed under the day it
                happened at the site, not the day it was at the reviewer's desk. This said exactly
                that and then printed r.at.slice(0, 16), a substring of the stored ISO string with
                no conversion at all: SearchAccessRecord.at is server-supplied and therefore UTC,
                so an auditor sampling a Seoul site read every late-evening look-up under the
                previous day. */}
            <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {`${dateKeyIn(new Date(r.at), projectZone)} ${clockMinutesIn(new Date(r.at), projectZone)}`}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.actor}
            </span>
            {purposeAsked && <>
              {/* Absent because this look-up carried none — see SearchAccessRecord.purposeId. */}
              {cell(r.purposeLabel ?? t.none, !r.purposeLabel)}
              {/* Absent, not blank: a reference that was never required reads differently from one
                  that is missing, and only the purpose knows which. */}
              {cell(r.reference ?? t.none, !r.reference)}
            </>}
            {cell(r.target)}
            {cell(r.surface)}
            {cell(r.resultCount === undefined ? t.none : String(r.resultCount), r.resultCount === undefined)}
            {showIp && cell(r.ip ?? t.none, !r.ip)}
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
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px", maxWidth: MEASURE }}>{purposeAsked ? t.introWithPurpose : t.intro}</p>
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "4px" }}>{t.ownerOnly}</p>
    </div>
  );
}
