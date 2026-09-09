"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { todaysDetectionHits, useProjectEvents, useProjectCameras } from "@/lib/vcaStore";
import { sgtHour, sgtMinute } from "@/lib/time";
import { useLanguage, type AppLanguage } from "@/lib/i18n";

const CHART_HEIGHT = 160;
const FALLBACK_WIDTH = 900; // used only until the container's real width is measured
const HOUR_TICKS = [0, 4, 8, 12, 16, 20];
// Centered window (hours) for the trend line's moving average — deliberately not the same number
// the bars show: bars are the exact, possibly-spiky raw per-hour count; the line is a smoothed
// read on where things are trending, which is only a meaningfully different signal if it's
// actually averaged over a few neighboring hours instead of re-plotting the same raw count.
const MOVING_AVERAGE_WINDOW_HOURS = 3;

function hourLabel(hour: number, lang: AppLanguage = "en"): string {
  // Korean reads the 24-hour clock here rather than 오전/오후 — the axis is a dozen labels on one
  // line, and a two-character prefix on each is what pushes them into overlapping.
  if (lang === "ko") return `${hour}시`;
  if (hour === 0) return "12AM";
  if (hour === 12) return "12PM";
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
}

function xForHour(hour: number, width: number): number {
  return (hour / 23) * width;
}

// Catmull-Rom -> cubic-bezier smoothing so the trend line flows through every point instead
// of a jagged polyline.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="var(--gray-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Figma node 178:14623 ("all camreas") — exact vector data fetched from the node's asset export.
function CameraIconFigma() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13.9583 10H16.985C17.127 10.0001 17.2666 10.0364 17.3906 10.1056C17.5146 10.1748 17.6189 10.2745 17.6935 10.3953C17.7681 10.5161 17.8107 10.654 17.817 10.7958C17.8234 10.9377 17.7935 11.0788 17.73 11.2058L16.035 14.5967C15.9707 14.7252 15.8743 14.8348 15.7552 14.9151C15.636 14.9953 15.4981 15.0434 15.3549 15.0546C15.2117 15.0659 15.068 15.0399 14.9377 14.9792C14.8075 14.9185 14.6952 14.8252 14.6117 14.7083L12.8417 12.2333" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.255 7.54373C14.4525 7.6426 14.6027 7.81584 14.6726 8.02539C14.7424 8.23493 14.7262 8.46363 14.6275 8.66123L12.0392 13.8371C11.9902 13.935 11.9225 14.0223 11.8398 14.094C11.7571 14.1657 11.661 14.2204 11.5572 14.255C11.4533 14.2896 11.3437 14.3034 11.2345 14.2956C11.1253 14.2878 11.0187 14.2586 10.9209 14.2096L3.00836 10.2496C2.43364 9.96007 1.99699 9.45471 1.79396 8.84407C1.59093 8.23342 1.63806 7.56722 1.92503 6.99123L3.07503 4.66623C3.21836 4.38058 3.41656 4.12597 3.65831 3.91693C3.90006 3.70788 4.18061 3.54851 4.48396 3.44791C4.78731 3.34731 5.1075 3.30746 5.42625 3.33062C5.74501 3.35378 6.05608 3.4395 6.34169 3.5829L14.255 7.54373Z" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66667 15.8333H4.8C5.11061 15.8355 5.41564 15.7508 5.68068 15.5888C5.94573 15.4269 6.16023 15.1941 6.3 14.9167L7.5 12.5" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66675 17.4993V14.166" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83333 7.5H5.84063" stroke="var(--gray-600)" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRightIconFigma({ rotate }: { rotate: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rotate}deg)`, transition: "transform 0.15s" }}>
      <path d="M6 12L10 8L6 4" stroke="var(--gray-600)" strokeLinecap="round"/>
    </svg>
  );
}
// Exact stops from the Figma source (node 154:18811): lavender on the left, deep blue at the
// midpoint, cyan on the right.
const GRADIENT_STOPS: [string, string][] = [["0%", "#dbb7ff"], ["50.5%", "#0047ff"], ["100%", "#52d5ff"]];
const DOT_COLOR = "#0047ff";
const DOT_RADIUS_PX = 2.5;

// See the per-file pattern note in lib/i18n.ts.
/** Exported because the collapsed pill on the Dashboard opens this panel — the button and the
 *  panel it opens have to carry the same name, or they read as two different things. */
export const DETECTION_CHART_TITLE = { en: "VIP detections today", ko: "오늘 VIP 검출" } as const;

const T = {
  en: { allCameras: "All cameras", title: DETECTION_CHART_TITLE.en, minimize: "Minimize chart" },
  ko: { allCameras: "전체 카메라", title: DETECTION_CHART_TITLE.ko, minimize: "차트 접기" },
} as const;
// null = citywide totals (no camera filter) — kept distinct from a real camera's `id` so "no
// filter" can never collide with an actual id string.
type CameraFilter = string | null;

export default function DetectionActivityChart({ onHide }: { onHide?: () => void } = {}) {
  // The viewBox width tracks the container's actual rendered width (instead of a fixed 900 that
  // the SVG then stretches to fit) so the x/y scale is always exactly 1:1 — no more, no less —
  // keeping the chart's height fixed while still fully avoiding the stretched-circle/warped-line
  // distortion that non-uniform scaling caused.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [lang] = useLanguage();
  const t = T[lang];
  // The chart sits over the map, counting the same detections the map is drawing — so it scopes
  // to the same site, or the curve would describe a city the pins are not in.
  const cameras = useProjectCameras();
  const events = useProjectEvents();
  const [selectedCameraId, setSelectedCameraId] = useState<CameraFilter>(null);
  const selectedCameraLabel = selectedCameraId === null
    ? t.allCameras
    : cameras.find(c => c.id === selectedCameraId)?.name ?? t.allCameras;
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  // Match on the camera's exact name, not just its site — the 8 hand-authored cameras (bare
  // names like "Novena") are real, individually-attributed devices, but the bulk-generated ones
  // in this dropdown (e.g. "Novena 3") never actually have any hit recorded against them
  // specifically. Falling back to a site-level (name-prefix) match here used to make every
  // camera at a site show the SAME chart as picking "All cameras" restricted to that site — this
  // way, picking one of those bulk cameras honestly shows empty/near-empty instead of quietly
  // substituting the whole site's activity.
  const selectedCameraName = selectedCameraId
    ? cameras.find(c => c.id === selectedCameraId)?.name ?? null
    : null;

  // Every dot on this chart is one real detection hit from today, via the same
  // todaysDetectionHits() the Dashboard's "Today's detections" stat uses (see Sidebar.tsx) — so
  // this chart's total always adds up to that stat exactly, instead of the two silently using
  // different counting rules (that stat counts rows, one per person, while hits here need to
  // unroll each Tracking row's whole multi-camera history — see todaysDetectionHits' own comment).
  const todayVipEvents = useMemo(() => {
    const hits = todaysDetectionHits(events);
    if (!selectedCameraName) return hits;
    return hits.filter(h => h.location === selectedCameraName);
  }, [events, selectedCameraName]);

  const hourlyCounts = useMemo(() => {
    const counts = new Array(24).fill(0);
    todayVipEvents.forEach(e => { counts[sgtHour(new Date(e.timestamp))]++; });
    return counts;
  }, [todayVipEvents]);

  const yMax = useMemo(() => Math.max(2, Math.ceil(Math.max(...hourlyCounts, 1) * 1.2)), [hourlyCounts]);
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8].map(f => Math.round(yMax * f));
  const yForCount = (count: number) => CHART_HEIGHT - (count / yMax) * CHART_HEIGHT;

  const movingAverage = useMemo(() => {
    const half = Math.floor(MOVING_AVERAGE_WINDOW_HOURS / 2);
    return hourlyCounts.map((_, i) => {
      const window = hourlyCounts.slice(Math.max(0, i - half), Math.min(24, i + half + 1));
      return window.reduce((a, b) => a + b, 0) / window.length;
    });
  }, [hourlyCounts]);

  const linePoints = movingAverage.map((avg, hour) => ({ x: xForHour(hour, width), y: yForCount(avg) }));
  const linePath = smoothPath(linePoints);
  // Area fill: the trend line's own path, closed along the top edge — so the wash only ever
  // covers the region above the line, following its curve, instead of a flat rectangle.
  const areaPath = linePoints.length > 0
    ? `${linePath} L ${linePoints[linePoints.length - 1].x},0 L ${linePoints[0].x},0 Z`
    : "";

  // Dots aren't placed on the line itself (each keeps its own real hour+minute on x), but their
  // vertical spread must live on the SAME count scale the line and bars use — otherwise the line
  // ends up floating off on its own scale, detached from the cloud of dots it's meant to be the
  // average of. So each hour's dots are stacked evenly between the baseline and that hour's own
  // bar top (= yForCount(count), the exact real value), putting the whole cluster in the same
  // vertical band the line passes through as it smooths across hours.
  const dotsByHour = useMemo(() => {
    const buckets = new Map<number, typeof todayVipEvents>();
    todayVipEvents.forEach(e => {
      const h = sgtHour(new Date(e.timestamp));
      (buckets.get(h) ?? buckets.set(h, []).get(h)!).push(e);
    });
    return Array.from(buckets.entries()).flatMap(([hour, evts]) => {
      const count = evts.length;
      const top = CHART_HEIGHT - (count / yMax) * CHART_HEIGHT;
      return evts.map((e, i) => {
        const minute = sgtMinute(new Date(e.timestamp));
        const y = CHART_HEIGHT - ((i + 1) / count) * (CHART_HEIGHT - top);
        return { x: xForHour(hour + minute / 60, width), y, id: e.id };
      });
    });
  }, [todayVipEvents, width, yMax]);

  return (
    <div className="vca-rise-in" style={{
      backgroundColor: "rgba(255,255,255,0.4)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      borderRadius: "11px", border: "1px solid rgba(226,232,240,0.6)", boxShadow: "0 8px 32px rgba(14,22,42,0.12)",
      padding: "18px 22px 14px", display: "flex", flexDirection: "column", gap: "12px",
    }}>
      {/* Whole header row is the click target to minimize (except the camera filter, which
          stops propagation) — a wide horizontal hit area reads as a control much more clearly
          than a small icon tucked next to the title. The chevron sits at the far right, in its
          own visible pill, as the visual cue for that behavior. */}
      <div
        onClick={onHide}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", cursor: onHide ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.32px", whiteSpace: "nowrap" }}>
            {t.title}
          </span>

          <div style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {/* Camera filter — Figma node 178:14623 ("all camreas") */}
            <button
              onClick={() => setCameraPickerOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                width: "160px", padding: "8px 12px", borderRadius: "8px", border: "none",
                backgroundColor: "white", cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                <CameraIconFigma />
                <span style={{
                  fontSize: "14px", fontWeight: 600, color: "var(--gray-800)", letterSpacing: "-0.28px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {selectedCameraLabel}
                </span>
              </span>
              <ChevronRightIconFigma rotate={cameraPickerOpen ? 270 : 90} />
            </button>

            {cameraPickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, width: "160px", backgroundColor: "white",
                border: "1px solid var(--gray-200)", borderRadius: "8px", boxShadow: "0 8px 20px rgba(14,22,42,0.12)",
                zIndex: 10, overflow: "hidden",
              }}>
                {([{ id: null as CameraFilter, name: t.allCameras }, ...cameras.map(c => ({ id: c.id as CameraFilter, name: c.name }))]).map(opt => (
                  <button
                    key={opt.id ?? "all"}
                    onClick={() => { setSelectedCameraId(opt.id); setCameraPickerOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", cursor: "pointer",
                      backgroundColor: opt.id === selectedCameraId ? "var(--primary-100)" : "white",
                      fontSize: "13px", fontWeight: opt.id === selectedCameraId ? 700 : 500,
                      color: opt.id === selectedCameraId ? "var(--primary-400)" : "var(--gray-700)",
                    }}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Now that the camera filter sits by the title, this chevron is the only thing left in
            the corner — no longer needs the divider that used to separate it from the filter's
            own chevron right next to it. */}
        <span
          aria-label={t.minimize}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "28px", height: "28px", flexShrink: 0,
          }}
        >
          <ChevronDownIcon />
        </span>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${CHART_HEIGHT}px`, paddingBottom: "1px" }}>
          {[...yTicks].reverse().map((tick, i) => (
            <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", lineHeight: 1 }}>{tick}</span>
          ))}
        </div>

        <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} style={{ overflow: "visible", display: "block" }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              <linearGradient id="areaWash" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              {/* Vertical fade: transparent at the chart's top, opaque down at the line — used as
                  an alpha mask so the wash below only ever shows through near the curve. */}
              <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.5" />
              </linearGradient>
              <mask id="areaFadeMask">
                <path d={areaPath} fill="url(#areaFade)" />
              </mask>
            </defs>

            {/* Soft color wash — clipped to the area path (line's curve, closed at the top), so
                it only ever appears above the line and fades out toward the top of the chart. */}
            <g mask="url(#areaFadeMask)">
              <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="url(#areaWash)" />
            </g>

            {yTicks.map((tick, i) => (
              <line key={i} x1={0} y1={yForCount(tick)} x2={width} y2={yForCount(tick)} stroke="var(--gray-200)" strokeWidth={1} />
            ))}

            {/* Baseline volume bars — one per hour, the exact real count (capped visually to 30%
                of the chart's height purely as a style choice: muted bars sitting behind the
                prominent line, same yMax scale, not a different number). */}
            {hourlyCounts.map((count, hour) => {
              const barWidth = (width / 24) * 0.55;
              const x = xForHour(hour, width) - barWidth / 2;
              const barHeight = Math.max(2, (count / yMax) * CHART_HEIGHT * 0.3);
              return (
                <rect key={hour} x={x} y={CHART_HEIGHT - barHeight} width={barWidth} height={barHeight} rx={1} fill="var(--gray-300)" />
              );
            })}

            {/* Real detections, one dot each — see dotsByHour above for why their position isn't
                tied to the average line. */}
            {dotsByHour.map(d => (
              <circle key={d.id} cx={d.x} cy={d.y} r={DOT_RADIUS_PX} fill={DOT_COLOR} opacity={0.85} />
            ))}

            <path d={linePath} fill="none" stroke="url(#trendGradient)" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "24px" }}>
        {HOUR_TICKS.map(hour => (
          <span key={hour} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>
            {hourLabel(hour, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}
