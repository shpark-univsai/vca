"use client";

import { useMemo, useState } from "react";
import { useVcaStore, type SearchAccessRecord } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import {
  BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, sortRows, useTableSort,
} from "./PortalShared";
import { Eye, FileDown, ShieldAlert } from "lucide-react";

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
const GRID = "150px 1fr 1fr 0.9fr 0.8fr 0.8fr 0.7fr 0.9fr";

type LogSortKey = "at" | "actor" | "purpose" | "target";

const T = {
  en: {
    intro: "Every person look-up run from the monitoring app, with the purpose the operator declared.",
    empty: "No look-ups recorded yet.",
    emptyHint: "A row appears here each time an operator searches for a person in the app. Nothing is written in advance.",
    notWired: "The app does not write to this log yet — the purpose is collected on screen but not stored. Until it is, this stays empty however much searching happens.",
    colAt: "When", colActor: "Operator", colPurpose: "Purpose", colReference: "Reference",
    colTarget: "Searched for", colSurface: "Screen", colResults: "Results", colIp: "From",
    filterAllPurposes: "All purposes",
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
    intro: "모니터링 앱에서 실행된 인물 조회와, 그때 관제요원이 밝힌 목적입니다.",
    empty: "기록된 조회가 없습니다.",
    emptyHint: "앱에서 인물을 조회할 때마다 한 줄씩 쌓입니다. 미리 채워두는 것은 없습니다.",
    notWired: "앱이 아직 이 기록을 쓰지 않습니다 — 목적은 화면에서 받지만 저장되지 않습니다. 연결 전까지는 아무리 조회해도 비어 있습니다.",
    colAt: "시각", colActor: "조회자", colPurpose: "목적", colReference: "참조번호",
    colTarget: "조회 대상", colSurface: "화면", colResults: "결과", colIp: "위치",
    filterAllPurposes: "전체 목적",
    filterAllActors: "전체 조회자",
    filtersActive: (n: number) => `필터 ${n}`,
    clearFilters: "해제",
    export: "CSV 내보내기",
    statTotal: "건", statTotalLabel: "기록된 조회",
    statNoRef: "참조번호 없음", statNoRefUnit: "건",
    statOperators: "명", statOperatorsLabel: "조회한 사람",
    ownerOnly: "이 기록은 최고관리자와 감사자가 읽습니다.",
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
  // The project's zone, not the reviewer's browser and not siteTimeZone() — see the note on the
  // timestamp cell below.
  const projectZone = useVcaStore(s => s.projects.find(p => p.id === projectId)?.timeZone) ?? PROJECT_TIME_ZONE;
  const { sort, toggle: toggleSort } = useTableSort<LogSortKey>({ key: "at", direction: "desc" });
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");

  const projectRecords = useMemo(
    () => searchAccessLog.filter(r => r.projectId === projectId),
    [searchAccessLog, projectId],
  );

  /* Built from what is in the log rather than from the purpose list: a retired purpose still has
     records under it, and an auditor filtering for it must be able to find them. */
  const purposeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    projectRecords.forEach(r => seen.set(r.purposeId, r.purposeLabel));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [projectRecords]);
  const actorOptions = useMemo(
    () => [...new Set(projectRecords.map(r => r.actor))].map(a => ({ value: a, label: a })),
    [projectRecords],
  );

  const rows = projectRecords
    .filter(r => purposeFilter === "ALL" || r.purposeId === purposeFilter)
    .filter(r => actorFilter === "ALL" || r.actor === actorFilter);
  const visible = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "at": return r.at;
      case "actor": return r.actor.toLowerCase();
      case "purpose": return r.purposeLabel.toLowerCase();
      case "target": return r.target.toLowerCase();
    }
  });

  const activeFilterCount = [purposeFilter, actorFilter].filter(v => v !== "ALL").length;
  const clearFilters = () => { setPurposeFilter("ALL"); setActorFilter("ALL"); };

  /* A look-up with no reference is not a fault — most purposes do not require one — but it is the
     slice a reviewer samples first, so the strip counts it rather than making them filter for it. */
  const noReference = projectRecords.filter(r => !r.reference).length;
  const operatorCount = new Set(projectRecords.map(r => r.actor)).size;

  const exportCsv = () => {
    const header = [t.csvAt, t.csvActor, t.csvPurpose, t.csvReference, t.csvTarget, t.csvSurface, t.csvResults, t.csvIp];
    const body = visible.map(r => [
      r.at, r.actor, r.purposeLabel, r.reference ?? "", r.target, r.surface,
      r.resultCount === undefined ? "" : String(r.resultCount), r.ip ?? "",
    ]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-log-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cell = (value: string, muted?: boolean) => (
    <span style={{ fontSize: "12px", color: muted ? "var(--gray-300)" : "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {value}
    </span>
  );

  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--gray-500)", lineHeight: 1.7, marginBottom: "12px", maxWidth: "64ch" }}>{t.intro}</p>

      {/* The gap between collecting a purpose and keeping it, said where somebody would otherwise
          conclude the log is broken. It goes away when the app calls recordSearchAccess. */}
      {projectRecords.length === 0 && (
        <p style={{
          display: "flex", alignItems: "flex-start", gap: "8px", maxWidth: "fit-content",
          padding: "10px 14px", borderRadius: "10px", marginBottom: "12px",
          backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
          fontSize: "12px", fontWeight: 700, lineHeight: 1.6,
        }}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: "2px" }}><ShieldAlert size={14} strokeWidth={2.4} /></span>
          {t.notWired}
        </p>
      )}

      {projectRecords.length > 0 && (
        <SummaryStrip cells={[
          { key: "total", icon: <Eye size={14} strokeWidth={2.4} />, figure: projectRecords.length, unit: t.statTotal, label: t.statTotalLabel, tone: "neutral" },
          ...(noReference > 0 ? [{
            key: "noref", icon: <ShieldAlert size={14} strokeWidth={2.4} />, figure: noReference,
            unit: t.statNoRefUnit, label: t.statNoRef, tone: "warning" as const,
          }] : []),
          { key: "operators", icon: <Eye size={14} strokeWidth={2.4} />, figure: operatorCount, unit: t.statOperators, label: t.statOperatorsLabel, tone: "neutral" },
        ]} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        <FilterSelect value={purposeFilter} onChange={setPurposeFilter}
          options={[{ value: "ALL", label: t.filterAllPurposes }, ...purposeOptions]} />
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
          <FileDown size={14} strokeWidth={2.4} />
          {t.export}
        </button>
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "16px", boxShadow: PANEL_SHADOW }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: BORDER, borderTopLeftRadius: "16px", borderTopRightRadius: "16px",
          color: TABLE_HEADER_COLOR,
        }}>
          {([
            { label: t.colAt, key: "at" as LogSortKey },
            { label: t.colActor, key: "actor" as LogSortKey },
            { label: t.colPurpose, key: "purpose" as LogSortKey },
            { label: t.colReference },
            { label: t.colTarget, key: "target" as LogSortKey },
            { label: t.colSurface },
            { label: t.colResults },
            { label: t.colIp },
          ] as { label: string; key?: LogSortKey }[]).map((h, i) => (
            <span key={i}><SortableHeader label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-500)" }}>{t.empty}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.7, marginTop: "6px" }}>{t.emptyHint}</p>
          </div>
        ) : visible.map((r: SearchAccessRecord, i) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
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
            {cell(r.purposeLabel)}
            {/* Absent, not blank: a reference that was never required reads differently from one
                that is missing, and only the purpose knows which. */}
            {cell(r.reference ?? t.none, !r.reference)}
            {cell(r.target)}
            {cell(r.surface)}
            {cell(r.resultCount === undefined ? t.none : String(r.resultCount), r.resultCount === undefined)}
            {cell(r.ip ?? t.none, !r.ip)}
          </div>
        ))}
      </div>

      {/* Who this log is for, stated once. It is not a permission notice — an auditor reading it
          has every right to be here — it is the answer to "is anybody actually looking at this",
          which is the question that decides whether the purpose field does any work at all. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "12px" }}>{t.ownerOnly}</p>
    </div>
  );
}
