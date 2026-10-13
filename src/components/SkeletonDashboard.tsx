"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * ── The shape shared by all four Skeleton* components ────────────────────────────────────────
 * Written out once here; the other three carry a one-line pointer back to this note.
 *
 * Until now these blocks made their claim with movement and nothing else. Measured on a held-open
 * skeleton in the browser: 53 fills between 1.047:1 and 1.482:1 against the surface behind them,
 * 13 of them at 1.096:1, against 3:1 for non-text contrast — and no text anywhere in the subtree,
 * so a screen reader found the loading screen indistinguishable from an empty one. Stopping the
 * pulse under `prefers-reduced-motion` (globals.css) was right, and it left the claim resting on
 * a fill almost nobody can see. A frozen skeleton reading as "there is nothing here" is a screen
 * asserting something untrue.
 *
 * So the answer is a name and a word, not a darker grey:
 *
 * `role="status" aria-busy="true"` on the region, with the visible word as its only text.
 *   - Not `aria-busy` on a bare div: with no role the element is a generic, an accessible name on
 *     it is dropped, and "may want to wait until modifications are complete" has nothing to
 *     attach to. The attribute needs to sit on something exposed as an object.
 *   - Not `role="progressbar"`: a progressbar promises a value, and there is no progress here to
 *     report. Any aria-valuenow would be a number we made up, which is the exact failure this
 *     repo keeps finding — a plausible value is worse than none.
 *   - Not `role="alert"`: assertive interrupts, and a screen filling in is not an interruption.
 *     At the measured duration the interruption would also land after the content had arrived.
 *   - `role="status"` carries aria-live="polite" and aria-atomic="true" implicitly, and the region
 *     is inserted client-side rather than served: `isLoading` starts `true` in ClientLayout but
 *     app/page.tsx wraps ClientLayout in a `<Suspense>` with no fallback and ClientLayout
 *     reads useSearchParams(), so the whole tree suspends on the server. Measured against a real
 *     production build: the HTML for `/` is 6,495 bytes and contains zero occurrences of
 *     `vca-skeleton-pulse`; the skeleton appears at ~300ms on a cold load. An inserted polite
 *     region is the case that can be announced — but a region added together with its own text is
 *     announced inconsistently across screen readers, so that is not claimed here as verified.
 *     What is verified is the node and its properties, and one word of real text in the
 *     accessibility tree where the tree previously held nothing at all.
 *     The cost of `polite` is that a queued word can land a moment after the content it described
 *     has arrived. Worth it: it costs one stale word, and it is the half that starts working on
 *     its own the day the 700ms timer becomes a fetch — the case where a skeleton can hang
 *     indefinitely, which today it cannot (that timeout is the only thing that ends the state,
 *     and `setIsLoading` appears exactly once in the repo).
 *   - The scaffolding is `aria-hidden` so the region's announced text and its accessible name are
 *     the one word, not that word trailing 53 empty generics. Verified: a bone comes back from the
 *     a11y tree ignored, reason `ariaHiddenSubtree`.
 *
 * The word is the visible half of the same fix: real text at a real contrast is a signal someone
 * who has asked for less movement can actually see. Styling and placement live in
 * `.vca-skeleton-loading` (globals.css) so all four screens say it in the same place, in grey,
 * with no animation of its own.
 *
 * It appears and disappears with the skeleton, with no delay and no fade-in, and that is measured
 * rather than assumed: the skeleton is on screen for ~725ms in a production build (721 / 726 /
 * 733ms over three runs; 785–1810ms in dev, which is dev overhead, not the product). One word is
 * readable in that window. A common trick — hold the label back 300ms so a fast load never
 * flashes it — would leave ~400ms, and it would have to be timed by an animation or a transition,
 * which is the one thing that must not carry this signal: `prefers-reduced-motion` would switch
 * the delay off or the label on at a different moment for exactly the reader this exists for. So
 * the label has no entrance. Both motion states render it pixel-identically (verified).
 *
 * `T` is local to each of the four files, which is this repo's shape and already these files' own
 * shape — Bone and Circle are copied verbatim into all four rather than shared.
 */

/**
 * ── What this skeleton is measuring itself against (2026-10-13) ──────────────────────────────
 *
 * Every band below is the real Dashboard's own band, measured in the browser at 1512×950 with the
 * loading timer held open, then re-measured on the loaded screen. The sections carry Sidebar.tsx's
 * own paddings (12/20/6 · 16/20/0 · 20/20/12 · 10/16) instead of one 20px 24px box with a 24px
 * gap, because the old shape put every row of the panel 4px to the right and up to 34px too high,
 * and ended the list 180px above where the real list ends.
 *
 * Two things the old version could not do at all:
 *   - The panel can be on the RIGHT (ClientLayout stores the choice in localStorage). The skeleton
 *     always drew it on the left, so a reload with the sidebar on the right threw the whole 380px
 *     panel 1,132px across the screen the moment loading ended.
 *   - The real list is `flex:1` with the pagination bar pinned under it. The skeleton's five rows
 *     stopped mid-panel and left 180px of blank white below them.
 *
 * COLLAPSED is deliberately not a case here: `sidebarCollapsed` is plain `useState(false)` in
 * ClientLayout with nothing persisting it, so a reload — the only moment this screen exists — is
 * always the expanded panel. Verified in the browser: collapse the rail, reload, it comes back
 * open. A collapsed variant would be a 60px rail nobody can ever see.
 */
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

/** The key ClientLayout writes. Read-only here, and the same two-step as the real screen below. */
const SIDEBAR_POSITION_KEY = "vca-sidebar-position";
type SidebarPosition = "left" | "right";

/**
 * Mirrors ClientLayout's own reader exactly — "left" on the first pass, then whatever this browser
 * last chose, applied in a microtask. Same default and same timing on purpose: both flip in the
 * same commit, so the skeleton is never on the opposite side from the screen it hands over to.
 */
function useSidebarPosition(): SidebarPosition {
  const [position, setPosition] = useState<SidebarPosition>("left");
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(SIDEBAR_POSITION_KEY);
      if (saved === "left" || saved === "right") setPosition(saved);
    });
  }, []);
  return position;
}

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function Circle({ size, color = "var(--gray-300)" }: { size: string; color?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

/** One of the two figures in the bordered band — icon+label, the number, the delta chip under it.
 *  19.5 + 8 + 30 + 2 + 16 = 75.5, which is what StatCol measures, so the band is 101.5 either way. */
function StatColSkeleton({ labelW }: { labelW: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "19.5px" }}>
        <Bone w="16px" h="16px" color="var(--gray-300)" radius="3px" />
        <Bone w={labelW} h="13px" color="var(--gray-300)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <Bone w="40px" h="30px" />
        <Bone w="56px" h="16px" color="var(--gray-100)" radius="var(--radius-pill)" />
      </div>
    </div>
  );
}

/** A detection row: 74px of content over a hairline, inset 16px like the real divider. */
function EventRowSkeleton({ nameW, placeW }: { nameW: string; placeW: string }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ height: "74px", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Bone w="54px" h="54px" radius="var(--radius-control)" />
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "20px" }}>
              <Bone w={nameW} h="14px" />
              <Bone w="47px" h="19px" color="var(--gray-100)" radius="var(--radius-pill)" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", height: "18px" }}>
              <Bone w="12px" h="12px" color="var(--gray-200)" radius="2px" />
              <Bone w={placeW} h="12px" color="var(--gray-100)" />
              <Bone w="44px" h="12px" color="var(--gray-100)" />
            </div>
          </div>
        </div>
        {/* The type badge's own seat: `alignSelf:flex-start` + 10px down, which is where the real
            row's badge column starts (it keeps a 38px slot under it for the handling mark). */}
        <div style={{ alignSelf: "flex-start", marginTop: "10px" }}>
          <Bone w="33px" h="15px" color="var(--gray-100)" />
        </div>
      </div>
      <div style={{ height: "1px", backgroundColor: "var(--gray-200)", margin: "0 16px" }} />
    </div>
  );
}

// Enough rows to reach the pagination bar at 950px tall and be clipped by it, the way the real
// list is — a short list would put a white gap where rows carry on.
const ROWS: [string, string][] = [
  ["80px", "68px"], ["95px", "58px"], ["110px", "74px"], ["80px", "62px"],
  ["95px", "70px"], ["110px", "56px"], ["80px", "66px"], ["95px", "72px"],
];

function SidebarSkeleton({ position }: { position: SidebarPosition }) {
  return (
    <div aria-hidden="true" style={{
      width: "380px", flexShrink: 0, height: "100%", backgroundColor: "white",
      // Whichever edge faces the map, same as Sidebar's own `position === "right"` branch.
      ...(position === "right" ? { borderLeft: "1px solid var(--line)" } : { borderRight: "1px solid var(--line)" }),
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* The tab toggle, in the shape it will have when it arrives — 8px track, 6px segment, 2px
          padding, 32px segments, matching shared/SegmentedControl. A skeleton drawing a pill makes
          the control change shape at the moment the data lands, which reads as a layout jump. */}
      {/* --gray-200 with the real toggle, so the track does not darken a step in the frame this
          hands over. The bones are already safe: the --gray-200 pair sits inside the white
          selected half, and the unselected half's are --gray-300. */}
      <div style={{ padding: "12px 20px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "2px", padding: "2px", backgroundColor: "var(--gray-200)", borderRadius: "var(--radius-control)" }}>
          <div style={{
            flex: 1, height: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            backgroundColor: "white", borderRadius: "var(--radius-inner)", boxShadow: "var(--shadow-raised)",
          }}>
            <Circle size="12px" color="var(--gray-200)" />
            <Bone w="50px" h="12px" color="var(--gray-200)" radius="3px" />
          </div>
          <div style={{ flex: 1, height: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <Circle size="12px" color="var(--gray-300)" />
            <Bone w="50px" h="12px" color="var(--gray-300)" radius="3px" />
          </div>
        </div>
      </div>

      {/* Registered VIPs + the two figures under it (EventsSummary) */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "24px", marginBottom: "16px" }}>
          {/* 24px faces overlapping by 10, which is AvatarStack's own stack: 52px wide for three. */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <Circle size="24px" color="var(--gray-200)" />
            <div style={{ marginLeft: "-10px" }}><Circle size="24px" color="var(--gray-300)" /></div>
            <div style={{ marginLeft: "-10px" }}><Circle size="24px" color="var(--gray-200)" /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bone w="140px" h="16px" />
            <Bone w="20px" h="16px" color="var(--gray-300)" />
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "16px", padding: "12px 0", minHeight: "78px", boxSizing: "border-box",
          borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        }}>
          <StatColSkeleton labelW="94px" />
          <div style={{ width: "1px", backgroundColor: "var(--gray-200)", alignSelf: "stretch", flexShrink: 0 }} />
          <StatColSkeleton labelW="108px" />
        </div>
      </div>

      {/* Live analytics + the filter chips */}
      <div style={{ padding: "20px 20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "24px", marginBottom: "12px" }}>
          <Bone w="96px" h="16px" color="var(--gray-300)" />
          <Bone w="36px" h="14px" color="var(--gray-100)" />
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <Bone w="30px" h="26px" color="var(--gray-200)" radius="var(--radius-pill)" />
          <Bone w="103px" h="26px" color="var(--gray-100)" radius="var(--radius-pill)" />
          <Bone w="78px" h="26px" color="var(--gray-100)" radius="var(--radius-pill)" />
        </div>
      </div>

      {/* The list takes the rest, so the bar below it lands where the real one lands. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {ROWS.map(([nameW, placeW], i) => (
          <EventRowSkeleton key={i} nameW={nameW} placeW={placeW} />
        ))}
      </div>

      {/* Pagination bar — pinned, 47px with its top hairline. */}
      <div style={{
        padding: "10px 16px", borderTop: "1px solid var(--line)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "white",
      }}>
        <Bone w="51px" h="12px" color="var(--gray-200)" />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Bone w="54px" h="12px" color="var(--gray-100)" />
          <Bone w="32px" h="24px" color="var(--gray-100)" radius="var(--radius-control)" />
          <Bone w="13px" h="12px" color="var(--gray-100)" />
          <Bone w="26px" h="26px" color="var(--gray-100)" radius="var(--radius-control)" />
          <Bone w="26px" h="26px" color="var(--gray-100)" radius="var(--radius-control)" />
        </div>
      </div>
    </div>
  );
}

function MapSkeleton({ position }: { position: SidebarPosition }) {
  const dots = [
    { left: "18%", top: "20%" }, { left: "30%", top: "42%" }, { left: "42%", top: "26%" },
    { left: "58%", top: "48%" }, { left: "72%", top: "30%" }, { left: "38%", top: "68%" },
    { left: "64%", top: "78%" }, { left: "50%", top: "88%" }, { left: "85%", top: "52%" },
  ];
  const pins = [{ left: "54%", top: "58%" }, { left: "78%", top: "84%" }];
  const isRight = position === "right";
  return (
    <div aria-hidden="true" style={{ flex: 1, position: "relative", backgroundColor: "var(--gray-100)", minWidth: 0 }}>
      {/* Leaflet's own corner: 10px in from the top and the outer edge, 40px wide, two 40px cells
          split by a --gray-200 hairline (see .leaflet-control-zoom in globals.css). It sat at 24px
          before, which moved the whole control 14px diagonally when the map arrived. */}
      <div style={{
        position: "absolute", top: "10px", right: "10px", width: "40px", backgroundColor: "white",
        borderRadius: "var(--radius-control)", boxShadow: "4px 4px 3px rgba(24, 17, 39,0.05)",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ width: "40px", height: "40px", borderBottom: "1px solid var(--gray-200)", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
      </div>
      {/* The collapse handle's seat. SidebarToggleIcon is a white pill 28×56 — flat against the
          panel, rounded into the map — inside a 34×62 box the real screen offsets by -3px for the
          shadow. It is the one piece of map chrome with no entrance of its own, so without it the
          seam between panel and map is a different shape before and after the handover. No
          triangle: that is content, and this is a skeleton. */}
      <div style={{
        /* The real box is 62 tall with the pill drawn at y=1..57 inside it, so the pill's own
           centre sits 2px above the box's centre — hence the -2, not a nudge by eye. */
        position: "absolute", top: "50%", transform: "translateY(calc(-50% - 2px))",
        ...(isRight ? { right: 0 } : { left: 0 }),
        width: "28px", height: "56px", backgroundColor: "white",
        borderRadius: isRight ? "12px 0 0 12px" : "0 12px 12px 0",
      }} />
      {dots.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "8px", height: "8px",
          borderRadius: "50%", backgroundColor: "var(--gray-300)",
        }} />
      ))}
      {pins.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "32px", height: "32px",
          borderRadius: "50%", backgroundColor: "var(--gray-400)", opacity: 0.35,
        }} />
      ))}
    </div>
  );
}

// Fits inside ClientLayout's tab-content area, below the real Navbar (which always renders,
// loading or not) — matches SkeletonBestFrame/SkeletonData/SkeletonRedmap's own convention.
export default function SkeletonDashboard() {
  const [lang] = useLanguage();
  const position = useSidebarPosition();
  const sidebar = <SidebarSkeleton key="sidebar" position={position} />;
  const map = <MapSkeleton key="map" position={position} />;
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", position: "relative" }}>
      {/* First in the DOM so a reader working through the region meets the word before the
          scaffolding it stands for; it still paints on top (absolute + z-index in the class). */}
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      {/* Same order the real screen builds: map first when the panel is on the right. */}
      {position === "right" ? <>{map}{sidebar}</> : <>{sidebar}{map}</>}
    </div>
  );
}
