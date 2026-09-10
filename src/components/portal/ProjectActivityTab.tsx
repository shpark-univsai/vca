"use client";

import { useEffect, useMemo, useState } from "react";
import { useVcaStore, type AuditEvent } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import {
  BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR,
  ActiveFilterCount, FilterSelect, SortableHeader, SummaryStrip, TextField, sortRows, useTableSort,
} from "./PortalShared";
import { FileDown, History, UserCog, CalendarClock } from "lucide-react";

/**
 * What was changed on this project, by whom, and when.
 *
 * This existed as five rows on the Overview and a modal behind them that listed everything with
 * no date range, no actor filter, no search and no export. The Auditor role exists to read this
 * and nothing else, and a police station asked "who deleted that watchlist entry in March" had a
 * scrolling box. Meanwhile the search log — a feature switched off for v1 — already had filters
 * and a CSV. The one that ships was the worse-equipped of the two.
 *
 * Scope matches the Overview card exactly: this project's own entries plus the institution's
 * policy changes, because a watchlist category governs every site the team runs and filing it
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

const GRID = "150px 160px 1fr";

type ActivitySortKey = "at" | "actor";

/** The date-range choices, in days. null is everything the console is holding. */
const RANGES: { value: string; days: number | null }[] = [
  { value: "7", days: 7 },
  { value: "30", days: 30 },
  { value: "90", days: 90 },
  { value: "ALL", days: null },
];

const T = {
  en: {
    intro: "Every change made to this project from the console, newest first. Policy changes made for the whole institution appear here too.",
    empty: "No activity recorded yet.",
    emptyHint: "A row appears here each time somebody changes something on this project — a camera, a watchlist entry, a role, a setting.",
    noMatch: "No activity matches these filters.",
    noMatchHint: "Widen the date range, or clear the operator and search filters.",
    colAt: "When", colActor: "Who", colMessage: "What changed",
    searchPlaceholder: "Search what changed",
    filterAllActors: "Everyone",
    range7: "Last 7 days", range30: "Last 30 days", range90: "Last 90 days", rangeAll: "All held",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,
    clearFilters: "Clear",
    export: "Export CSV",
    statTotal: "changes", statTotalLabel: "in range",
    statActors: "people", statActorsLabel: "made them",
    statLatest: "latest", statLatestNone: "—",
    csvAt: "When", csvActor: "Who", csvMessage: "What changed",
  },
  ko: {
    intro: "콘솔에서 이 프로젝트에 가해진 모든 변경입니다. 기관 전체에 적용되는 정책 변경도 함께 나옵니다.",
    empty: "기록된 변경이 없습니다.",
    emptyHint: "누군가 이 프로젝트에서 무언가를 바꿀 때마다 한 줄씩 쌓입니다 — 카메라, 명단, 역할, 설정.",
    noMatch: "조건에 맞는 기록이 없습니다.",
    noMatchHint: "기간을 넓히거나 담당자·검색 조건을 해제해 보세요.",
    colAt: "시각", colActor: "담당자", colMessage: "변경 내용",
    searchPlaceholder: "변경 내용 검색",
    filterAllActors: "전체",
    range7: "최근 7일", range30: "최근 30일", range90: "최근 90일", rangeAll: "보관분 전체",
    filtersActive: (n: number) => `필터 ${n}`,
    clearFilters: "해제",
    export: "CSV 내보내기",
    statTotal: "건", statTotalLabel: "기간 내 변경",
    statActors: "명", statActorsLabel: "변경한 사람",
    statLatest: "마지막", statLatestNone: "—",
    csvAt: "시각", csvActor: "담당자", csvMessage: "변경 내용",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function ProjectActivityTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const auditLog = useVcaStore(s => s.auditLog);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const projectZone = project?.timeZone ?? PROJECT_TIME_ZONE;
  const { sort, toggle: toggleSort } = useTableSort<ActivitySortKey>({ key: "at", direction: "desc" });
  const [actorFilter, setActorFilter] = useState("ALL");
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

  const rangeDays = RANGES.find(r => r.value === range)?.days ?? null;
  const q = search.trim().toLowerCase();
  const rows = projectEntries
    .filter(a => {
      if (rangeDays === null || nowMs === null) return true;
      return new Date(a.at).getTime() >= nowMs - rangeDays * 86_400_000;
    })
    .filter(a => actorFilter === "ALL" || a.actor === actorFilter)
    .filter(a => !q || a.message.toLowerCase().includes(q));

  const visible = sortRows(rows, sort, (a, key) => (key === "at" ? a.at : a.actor.toLowerCase()));

  // The date range is a filter like the other two, so it counts as one unless it is showing
  // everything — otherwise the chip would read "1 filter" on a screen nobody has narrowed.
  const activeFilterCount = (range === DEFAULT_RANGE ? 0 : 1) + (actorFilter === "ALL" ? 0 : 1) + (q ? 1 : 0);
  const clearFilters = () => { setRange(DEFAULT_RANGE); setActorFilter("ALL"); setSearch(""); };

  const stamp = (at: string) => {
    const d = new Date(at);
    return `${dateKeyIn(d, projectZone)} ${clockMinutesIn(d, projectZone)}`;
  };

  const exportCsv = () => {
    const header = [t.csvAt, t.csvActor, t.csvMessage];
    const body = visible.map((a: AuditEvent) => [stamp(a.at), a.actor, a.message]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    // BOM so Excel reads the Korean columns as UTF-8 rather than the local code page.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? projectId}-activity.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      ]} />

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "320px" }}>
          <TextField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        </div>
        <FilterSelect value={range} onChange={setRange} options={[
          { value: "7", label: t.range7 },
          { value: "30", label: t.range30 },
          { value: "90", label: t.range90 },
          { value: "ALL", label: t.rangeAll },
        ]} />
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
            { label: t.colAt, key: "at" as ActivitySortKey },
            { label: t.colActor, key: "actor" as ActivitySortKey },
            { label: t.colMessage },
          ] as { label: string; key?: ActivitySortKey }[]).map((h, i) => (
            <span key={i}><SortableHeader label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {visible.length === 0 ? (
          /* Two different empty states. "Nothing has happened here" and "nothing matches what you
             asked for" send the reader to different places, and one message for both sends half
             of them to the wrong one. */
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-500)" }}>
              {projectEntries.length === 0 ? t.empty : t.noMatch}
            </p>
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.7, marginTop: "6px" }}>
              {projectEntries.length === 0 ? t.emptyHint : t.noMatchHint}
            </p>
          </div>
        ) : visible.map((a: AuditEvent, i) => (
          <div key={a.id} style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
            padding: "10px 16px", alignItems: "baseline",
            borderBottom: i === visible.length - 1 ? "none" : BORDER,
          }}>
            <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {stamp(a.at)}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.actor}
            </span>
            {/* The message wraps rather than truncating. It is the column the screen exists for,
                and an entry cut off at the ellipsis is an entry nobody can act on. */}
            <span style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.6 }}>
              {a.message}
            </span>
          </div>
        ))}
      </div>

      {/* Both notes at the foot, in one register.

          The first of them opened the screen — a 12px paragraph above the counts, which put a
          sentence describing the list between the reader and the list. Nobody arrives at an
          activity log needing to be told it is an activity log; they arrive looking for one
          entry. What the sentence says is worth keeping (the log carries institution-wide policy
          changes too, which is not guessable from the rows), but it is something you check after
          reading, not before — the same job as the note beside it. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "12px", maxWidth: "80ch" }}>
        {t.intro}
      </p>
    </div>
  );
}
