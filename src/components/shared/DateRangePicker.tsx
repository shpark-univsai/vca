"use client";

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * The app's date-range picker, lifted out of DataPage so the Portal can use it too.
 *
 * Deliberately NOT wired to a language hook: the app reads `useLanguage()` from lib/i18n and the
 * Portal reads `usePortalLanguage()`, and a component that imported either one would drag that
 * side's provider into the other side's tree. The caller passes `lang` and the small label table
 * below is the component's own — the only words it owns are its chrome (apply / cancel / preset
 * names / weekday initials), so it stays self-contained instead of borrowing a screen's T.
 */
export type PickerLanguage = "en" | "ko";

const BORDER = "1px solid var(--line)";
/* The date trigger is a control, so its edge is the control token — see --line-control in
   globals.css. The popover it opens is a surface and keeps the hairline above. */
const CONTROL_BORDER = "1px solid var(--line-control)";

const T: Record<PickerLanguage, { apply: string; cancel: string; startDate: string; endDate: string; allDates: string; kept: (d: string) => string }> = {
  en: { apply: "Apply", cancel: "Cancel", startDate: "Start date", endDate: "End date", allDates: "All dates",
        kept: (d: string) => `This site keeps footage back to ${d}. Earlier days are gone, not empty.` },
  ko: { apply: "적용", cancel: "취소", startDate: "시작일", endDate: "종료일", allDates: "전체 기간",
        kept: (d: string) => `이 현장은 ${d}까지 보관합니다. 그 이전은 없는 것이 아니라 지워진 것입니다.` },
};

export type DateRangeValue = { start: Date | null; end: Date | null };

// The range bounds are Date objects at LOCAL midnight, while every stored date is a "YYYY-MM-DD"
// string that `new Date()` parses as UTC midnight. Comparing the two directly pushed the newest
// day out of its own range: east of UTC, today-as-UTC-midnight lands after today-as-local-midnight.
// Comparing the calendar days as strings has no timezone in it at all.
export const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dateWithinRange = (date: string, range: DateRangeValue) =>
  (!range.start || date >= dateKeyOf(range.start)) && (!range.end || date <= dateKeyOf(range.end));

export function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const numDays = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= numDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// "All time" used to resolve to {start:null, end:null} — identical to a date range nobody has
// touched yet. filterReidData() treats THAT untouched shape as "default to last 7 days" (so a
// Search click before the operator picks anything doesn't scan all-time by accident), which
// meant clicking "All time" silently got downgraded to last-7-days too — same silent-no-results
// bug for every REID_DATA date (they're fixed at 2026-07-27~08-10 and drift further outside any
// real "last 7 days" window every day this demo runs). A real, non-null sentinel range lets "All
// time" mean what it says while leaving the untouched/default-fallback case alone.
export const ALL_TIME_START = new Date(2000, 0, 1);
export const ALL_TIME_END = new Date(2100, 0, 1);
const QUICK_RANGES: { label: Record<PickerLanguage, string>; range: () => DateRangeValue }[] = [
  { label: { en: "Today", ko: "오늘" }, range: () => { const t = new Date(); t.setHours(0,0,0,0); return { start: t, end: t }; } },
  { label: { en: "Last 7 days", ko: "최근 7일" }, range: () => { const t = new Date(); t.setHours(0,0,0,0); const s = new Date(t); s.setDate(s.getDate() - 6); return { start: s, end: t }; } },
  { label: { en: "This month", ko: "이번 달" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "Last 3 months", ko: "최근 3개월" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 3, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "Last 6 months", ko: "최근 6개월" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), t.getMonth() - 6, 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }; } },
  { label: { en: "This year", ko: "올해" }, range: () => { const t = new Date(); return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31) }; } },
  { label: { en: "All dates", ko: "전체 기간" }, range: () => ({ start: ALL_TIME_START, end: ALL_TIME_END }) },
];

const WEEKDAY_LABELS: Record<PickerLanguage, string[]> = {
  en: ["Su","Mo","Tu","We","Th","Fr","Sa"],
  ko: ["일","월","화","수","목","금","토"],
};

function DateMonthCalendar({ lang, year, month, tempStart, tempEnd, onPick, onPrev, onNext, showPrev, showNext, minDate }: {
  minDate?: Date | null;
  lang: PickerLanguage;
  year: number; month: number; tempStart: Date|null; tempEnd: Date|null;
  onPick: (d: Date) => void; onPrev?: () => void; onNext?: () => void; showPrev: boolean; showNext: boolean;
}) {
  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "numeric" });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", width:"224px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"24px" }}>
        <button onClick={onPrev} disabled={!showPrev} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showPrev ? "pointer" : "default", visibility: showPrev ? "visible" : "hidden", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize:"13px", fontWeight:700, color:"var(--gray-900)" }}>{monthLabel}</span>
        <button onClick={onNext} disabled={!showNext} style={{ width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center",
          background:"none", border:"none", cursor: showNext ? "pointer" : "default", visibility: showNext ? "visible" : "hidden", color:"var(--gray-700)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center" }}>
        {WEEKDAY_LABELS[lang].map(w => <span key={w} style={{ fontSize:"10px", color:"var(--gray-400)", height:"24px", display:"flex", alignItems:"center" }}>{w}</span>)}
      </div>
      {/* Ring instead of a background swap for hover — a background would have to fight (and look
          different depending on) whichever state color is already showing (selected/in-range/
          plain), where an inset ring reads the same "you're pointing at this one" way regardless. */}
      <style>{`.vca-daterange-day:hover { box-shadow: inset 0 0 0 1.5px var(--gray-400); }`}</style>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", justifyItems:"center", rowGap:"2px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ width:"28px", height:"28px" }} />;
          const isStart = !!tempStart && isSameDay(d, tempStart);
          const isEnd = !!tempEnd && isSameDay(d, tempEnd);
          const inRange = !!tempStart && !!tempEnd && d > tempStart && d < tempEnd;
          const today = isSameDay(d, new Date());
          /* Past the retention window: not clickable, and visibly so. A day the recorder no longer
             holds has to look different from a day with nothing in it — otherwise "look somewhere
             else" and "nothing happened" are the same empty result. */
          const gone = !!minDate && d < minDate;
          return (
            <button key={i} onClick={() => { if (!gone) onPick(d); }} disabled={gone} className={gone ? undefined : "vca-daterange-day"} style={{
              width:"28px", height:"28px", borderRadius:"50%", border: today && !isStart && !isEnd ? "1px solid var(--gray-900)" : "none",
              /* SELECTION IS GREY HERE TOO (the rule in BestFrameDetailPage:201-219, commit
                 78fcfcb: grey marks what is selected, purple means a person). The chosen days and
                 the band between them were purple, which made a date range read as the same kind
                 of thing as a traced person. One line, and it lands on all four screens that
                 share this picker. `--gray-100` for the band rather than a tint of gray-900,
                 because the band is a backdrop the day numbers have to stay readable on. */
              backgroundColor: isStart || isEnd ? "var(--gray-900)" : inRange ? "var(--gray-100)" : "transparent",
              color: gone ? "var(--gray-300)" : isStart || isEnd ? "white" : "var(--gray-900)",
              fontSize:"12px", fontWeight: isStart || isEnd ? 700 : 500, cursor: gone ? "not-allowed" : "pointer",
              boxSizing:"border-box",
            }}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePopover({ lang, anchorRef, value, onApply, onClose, single, minDate }: {
  lang: PickerLanguage;
  anchorRef: React.RefObject<HTMLElement | null>; value: DateRangeValue;
  onApply: (v: DateRangeValue) => void; onClose: () => void;
  /** The oldest day still held — see retentionFloor() in vcaStore. */
  minDate?: Date | null;
  /** One day, not a span: the quick ranges go away and a click closes the answer. */
  single?: boolean;
}) {
  const t = T[lang];
  const base = value.start ?? new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [tempStart, setTempStart] = useState<Date|null>(value.start);
  const [tempEnd, setTempEnd] = useState<Date|null>(value.end);
  const [pos, setPos] = useState<{ top:number; left:number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
  }, [anchorRef]);

  /*
   * Below the trigger is only the DEFAULT. Measured in the browser: opened from the VIP registry's
   * bulk bar — which is pinned to the bottom of the window — the calendar ran off the bottom edge
   * and the days could not be clicked at all. So once it has painted, measure it: if it does not
   * fit below, flip it above the trigger, and keep it inside the right edge either way.
   */
  useLayoutEffect(() => {
    if (!pos || !boxRef.current || !anchorRef.current) return;
    const box = boxRef.current.getBoundingClientRect();
    const anchor = anchorRef.current.getBoundingClientRect();
    const GAP = 8, EDGE = 8;
    let top = pos.top, left = pos.left;
    if (anchor.bottom + GAP + box.height > window.innerHeight - EDGE) {
      // Above, unless there is even less room up there — then pin it to the top edge.
      top = Math.max(EDGE, anchor.top - GAP - box.height);
    }
    left = Math.max(EDGE, Math.min(left, window.innerWidth - box.width - EDGE));
    if (Math.abs(top - pos.top) > 0.5 || Math.abs(left - pos.left) > 0.5) setPos({ top, left });
  }, [pos, anchorRef]);

  const pick = (d: Date) => {
    if (single) { setTempStart(d); setTempEnd(d); return; }
    if (!tempStart || tempEnd) { setTempStart(d); setTempEnd(null); }
    else if (d < tempStart) { setTempStart(d); setTempEnd(null); }
    else { setTempEnd(d); }
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;

  if (!pos) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:999 }} />
      <div ref={boxRef} style={{ position:"fixed", top:pos.top, left:pos.left, zIndex:1000, backgroundColor:"white",
        border:BORDER, borderRadius:"12px", boxShadow:"0 8px 24px rgba(24, 17, 39,0.16)",
        padding:"12px", display:"flex", gap:"16px" }}>
        {!single && <div style={{ display:"flex", flexDirection:"column", gap:"4px", width:"140px", borderRight:BORDER, paddingRight:"12px" }}>
          {/* Shared by every date filter in the app (Live Monitoring, Re-ID Analysis, RedFace) —
              this popover is the one place they all render QUICK_RANGES from, so a hover state
              added here shows up everywhere at once instead of needing to be repeated per screen. */}
          <style>{`.vca-daterange-preset:hover { background-color:var(--gray-100) !important; }`}</style>
          {QUICK_RANGES.map(q => (
            <button key={q.label.en} className="vca-daterange-preset" onClick={() => {
              const r = q.range();
              /* A preset that reaches past the floor is clamped rather than hidden: 「최근 6개월」
                 on a 30-day site still means "as far back as there is". */
              const start = minDate && r.start && r.start < minDate ? minDate : r.start;
              setTempStart(start); setTempEnd(r.end);
              if (start) { setViewYear(start.getFullYear()); setViewMonth(start.getMonth()); }
            }} style={{ textAlign:"left", padding:"8px", borderRadius:"8px", border:"none", backgroundColor:"transparent", cursor:"pointer",
              fontSize:"13px", color:"var(--gray-900)", fontWeight:600, transition:"background-color 0.15s" }}>
              {q.label[lang]}
            </button>
          ))}
        </div>}
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ display:"flex", gap:"24px" }}>
            {/* The back arrow stops at the floor's month — walking further shows only dead days. */}
            <DateMonthCalendar lang={lang} year={viewYear} month={viewMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              minDate={minDate}
              showPrev={!minDate || new Date(viewYear, viewMonth, 1) > minDate} showNext={false} onPrev={prevMonth} />
            <DateMonthCalendar lang={lang} year={secondYear} month={secondMonth} tempStart={tempStart} tempEnd={tempEnd} onPick={pick}
              minDate={minDate}
              showPrev={false} showNext={true} onNext={nextMonth} />
          </div>
          {/* WHY the greyed days are greyed. Without it a calendar that refuses half its months
              reads as broken; with it, it reads as a site that keeps N days. */}
          <div style={{ display:"flex", alignItems:"center", justifyContent: minDate ? "space-between" : "flex-end", gap:"12px" }}>
            {minDate && (
              <p style={{ margin:0, fontSize:"11px", lineHeight:1.45, color:"var(--gray-500)", maxWidth:"330px" }}>
                {t.kept(fmtDate(minDate))}
              </p>
            )}
            <span style={{ display:"flex", gap:"8px", flexShrink:0 }}>
            <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:"8px", border:BORDER,
              backgroundColor:"white", color:"var(--gray-900)", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>{t.cancel}</button>
            <button onClick={() => onApply({ start: tempStart, end: tempEnd })} style={{ padding:"8px 16px", borderRadius:"8px", border:"none",
              backgroundColor:"var(--primary-400)", color:"white", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>{t.apply}</button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export function DateRangeTrigger({ lang, value, onApply, mode = "merged", size = "md", emptyText, showIcon = true, minDate }: {
  lang: PickerLanguage;
  value: DateRangeValue; onApply: (v: DateRangeValue) => void; mode?: "split"|"merged"|"single"; size?: "md"|"sm"; emptyText?: string; showIcon?: boolean;
  /**
   * The oldest day still held at this site — `retentionFloor(project)` in vcaStore, or null where
   * the site has not said. Days before it cannot be picked and the popover says why.
   */
  minDate?: Date | null;
}) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const compact = size === "sm";
  const single = mode === "single";
  const isEmpty = !value.start && !value.end;
  // The "All time" preset resolves to a real (non-null) sentinel range now, not {null,null} — see
  // the comment on QUICK_RANGES — so it needs its own check here to still collapse to a plain
  // "All time" label instead of falling through to the raw "2000.01.01 – 2100.01.01" dates.
  const isAllTime = !!value.start && !!value.end
    && value.start.getTime() === ALL_TIME_START.getTime() && value.end.getTime() === ALL_TIME_END.getTime();

  // Same shape as CameraSelect (white fill, always-visible border, fixed height) so the two
  // sit as one consistent "filter control" language instead of two different-looking pickers
  // side by side in the same form.
  const boxStyle: React.CSSProperties = compact
    ? { flex:1, display:"flex", alignItems:"center", gap:"6px", height:"34px", padding:"0 8px", border: open ? "1px solid var(--primary-300)" : CONTROL_BORDER, borderRadius:"6px", backgroundColor:"white", cursor:"pointer" }
    : { flex:1, display:"flex", alignItems:"center", gap:"8px", height:"36px", padding:"0 12px", border: open ? "1px solid var(--primary-300)" : CONTROL_BORDER, borderRadius:"8px", backgroundColor:"white", cursor:"pointer" };
  const textStyle = (has: boolean): React.CSSProperties => ({
    /* A filled-in date is an active value, which the note right below already says should be
       dark like any other — and the recorded rule is that purple means a person, not a chosen
       thing. The two lines disagreed; this one was the odd one. Empty stays the muted grey. */
    fontSize: compact ? "12px" : "13px", fontWeight:600, color: has ? "var(--gray-900)" : "var(--gray-400)",
  });
  // The collapsed emptyText state ("Last 7 days") is a REAL default already in effect on the
  // search, not an unfilled placeholder like "Start date" — so it shouldn't read in the same
  // muted placeholder gray as an actually-empty field. Dark, same as any other active value.
  const emptyTextStyle: React.CSSProperties = { fontSize: compact ? "12px" : "13px", fontWeight:600, color:"var(--gray-900)" };

  const startLabel = value.start ? fmtDate(value.start) : t.startDate;
  const endLabel = value.end ? fmtDate(value.end) : t.endDate;
  const toggle = () => setOpen(o => !o);

  return (
    <div ref={ref} style={{ position:"relative", display:"flex", gap:"8px", width:"100%" }}>
      {single ? (
        // One day. The box holds one date and the popover applies it on the first click, so there
        // is no half-picked state to explain — see DateRangePopover's `single`.
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            {showIcon && <CalendarIconSm size={compact ? 12 : 14} />}
            <span style={value.start ? textStyle(true) : { ...textStyle(false), color:"var(--gray-500)" }}>
              {value.start ? fmtDate(value.start) : (emptyText ?? t.endDate)}
            </span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--gray-600)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      ) : (isEmpty && emptyText) || isAllTime ? (
        // Collapses to one box regardless of split/merged — always show the chevron here, since
        // without it this reads as a plain label instead of something clickable.
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            {showIcon && <CalendarIconSm size={compact ? 12 : 14} />}
            <span style={emptyTextStyle}>{isAllTime ? t.allDates : emptyText}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--gray-600)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      ) : mode === "split" ? (
        <>
          <div onClick={toggle} style={boxStyle}>{showIcon && <CalendarIconSm size={compact ? 12 : 14} />}<span style={textStyle(!!value.start)}>{startLabel}</span></div>
          <div onClick={toggle} style={boxStyle}>{showIcon && <CalendarIconSm size={compact ? 12 : 14} />}<span style={textStyle(!!value.end)}>{endLabel}</span></div>
        </>
      ) : (
        <div onClick={toggle} style={{ ...boxStyle, justifyContent:"space-between" }}>
          <span style={{ display:"flex", alignItems:"center", gap: compact ? "6px" : "8px" }}>
            {showIcon && <CalendarIconSm size={compact ? 12 : 14} />}
            <span style={textStyle(!!value.start)}>{startLabel}</span>
            <span style={{ color:"var(--gray-400)", fontSize: compact ? "10px" : "13px" }}>–</span>
            <span style={textStyle(!!value.end)}>{endLabel}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--gray-600)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {open && <DateRangePopover lang={lang} anchorRef={ref} value={value} single={single} minDate={minDate} onApply={(v) => { onApply(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Lives here because the trigger box draws it; DataPage imports it back for RedFace's target
// picker. Color/size match DefaultFaceIconSm/FullBodyIconSm (the "Search by image" icons sitting
// beside it there) so the filter icons read as the same icon language — size defaults to that
// same var(--gray-400) muted tone; callers pass a bigger size where they sit near those larger
// icons.
export function CalendarIconSm({ size = 14, color = "var(--gray-400)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="21 14 14 14" fill="none">
      <path d="M31.2 14.5107C31.2495 14.5109 31.2897 14.5511 31.2898 14.6006V15.5771H33.3328C33.9713 15.5771 34.4888 16.0949 34.489 16.7334V26.333C34.489 26.9717 33.9715 27.4893 33.3328 27.4893H22.6667C22.0281 27.4891 21.5105 26.9716 21.5105 26.333V16.7334C21.5107 16.095 22.0283 15.5773 22.6667 15.5771H24.7107V14.6006C24.7107 14.551 24.7509 14.5107 24.8005 14.5107C24.85 14.5109 24.8903 14.5511 24.8904 14.6006V15.5771H31.1101V14.6006C31.1102 14.551 31.1503 14.5107 31.2 14.5107ZM21.6902 26.333C21.6902 26.8722 22.1275 27.3094 22.6667 27.3096H33.3328C33.8721 27.3096 34.3093 26.8723 34.3093 26.333V18.957H21.6902V26.333ZM23.7332 25.1768C23.7828 25.1768 23.824 25.217 23.824 25.2666C23.8239 25.3162 23.7828 25.3564 23.7332 25.3564C23.6837 25.3562 23.6434 25.3161 23.6433 25.2666C23.6433 25.2171 23.6837 25.177 23.7332 25.1768ZM25.8669 25.1768C25.9165 25.1769 25.9568 25.217 25.9568 25.2666C25.9567 25.3162 25.9165 25.3564 25.8669 25.3564C25.8173 25.3564 25.7771 25.3162 25.7771 25.2666C25.7771 25.217 25.8173 25.1768 25.8669 25.1768ZM27.9998 25.1768C28.0494 25.1768 28.0896 25.217 28.0896 25.2666C28.0896 25.3162 28.0494 25.3564 27.9998 25.3564C27.9502 25.3563 27.91 25.3162 27.9099 25.2666C27.9099 25.217 27.9502 25.1769 27.9998 25.1768ZM30.1335 25.1768C30.183 25.177 30.2234 25.2171 30.2234 25.2666C30.2233 25.3161 30.183 25.3562 30.1335 25.3564C30.0839 25.3564 30.0428 25.3162 30.0427 25.2666C30.0427 25.217 30.0839 25.1768 30.1335 25.1768ZM23.7332 23.043C23.7828 23.043 23.824 23.0841 23.824 23.1338C23.8237 23.1833 23.7827 23.2236 23.7332 23.2236C23.6838 23.2234 23.6435 23.1831 23.6433 23.1338C23.6433 23.0843 23.6837 23.0432 23.7332 23.043ZM25.8669 23.043C25.9165 23.0431 25.9568 23.0842 25.9568 23.1338C25.9566 23.1832 25.9164 23.2235 25.8669 23.2236C25.8174 23.2236 25.7773 23.1833 25.7771 23.1338C25.7771 23.0841 25.8173 23.043 25.8669 23.043ZM27.9998 23.043C28.0494 23.043 28.0896 23.0841 28.0896 23.1338C28.0894 23.1833 28.0493 23.2236 27.9998 23.2236C27.9503 23.2235 27.9101 23.1832 27.9099 23.1338C27.9099 23.0842 27.9502 23.0431 27.9998 23.043ZM30.1335 23.043C30.183 23.0432 30.2234 23.0843 30.2234 23.1338C30.2232 23.1831 30.1829 23.2234 30.1335 23.2236C30.084 23.2236 30.043 23.1833 30.0427 23.1338C30.0427 23.0841 30.0839 23.043 30.1335 23.043ZM32.2664 23.043C32.316 23.043 32.3562 23.0842 32.3562 23.1338C32.356 23.1832 32.3158 23.2236 32.2664 23.2236C32.2169 23.2236 32.1768 23.1832 32.1765 23.1338C32.1765 23.0841 32.2167 23.043 32.2664 23.043ZM27.9998 20.9102C28.0494 20.9102 28.0895 20.9504 28.0896 21C28.0896 21.0497 28.0494 21.0898 27.9998 21.0898C27.9502 21.0897 27.9099 21.0496 27.9099 21C27.91 20.9505 27.9502 20.9103 27.9998 20.9102ZM30.1335 20.9102C30.183 20.9104 30.2233 20.9506 30.2234 21C30.2234 21.0495 30.183 21.0896 30.1335 21.0898C30.0839 21.0898 30.0427 21.0497 30.0427 21C30.0428 20.9504 30.0839 20.9102 30.1335 20.9102ZM32.2664 20.9102C32.3159 20.9102 32.3561 20.9505 32.3562 21C32.3562 21.0496 32.316 21.0898 32.2664 21.0898C32.2167 21.0898 32.1765 21.0496 32.1765 21C32.1766 20.9504 32.2168 20.9102 32.2664 20.9102ZM22.6667 15.7568C22.1276 15.757 21.6904 16.1943 21.6902 16.7334V18.7773H34.3093V16.7334C34.3091 16.1942 33.8719 15.7568 33.3328 15.7568H31.2898V16.7334C31.2898 16.783 31.2495 16.8241 31.2 16.8242C31.1503 16.8242 31.1101 16.783 31.1101 16.7334V15.7568H24.8904V16.7334C24.8904 16.783 24.85 16.824 24.8005 16.8242C24.7509 16.8242 24.7107 16.7831 24.7107 16.7334V15.7568H22.6667Z" fill={color} stroke={color} strokeWidth="0.8867"/>
    </svg>
  );
}
