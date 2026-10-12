"use client";

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
 *     is inserted client-side rather than served: `isLoading` starts `true` (ClientLayout.tsx:406)
 *     but app/page.tsx wraps ClientLayout in a `<Suspense>` with no fallback and ClientLayout
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
const T = {
  en: { loading: "Loading" },
  ko: { loading: "불러오는 중" },
} as const;

function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function Circle({ size, color = "var(--gray-300)" }: { size: string; color?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

function ListItemSkeleton({ nameW, subW }: { nameW: string; subW: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Circle size="40px" color="var(--gray-200)" />
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Bone w={nameW} h="14px" />
            <Bone w={subW} h="10px" color="var(--gray-100)" />
          </div>
        </div>
        <Bone w="42px" h="18px" color="var(--gray-100)" />
      </div>
      <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)", flexShrink: 0 }} />
    </>
  );
}

function SidebarSkeleton() {
  return (
    <div aria-hidden="true" style={{
      width: "380px", flexShrink: 0, height: "100%", backgroundColor: "white", borderRight: "1px solid var(--gray-200)",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "24px", padding: "20px 24px", overflow: "hidden",
    }}>
      {/* The tab toggle, in the shape it will have when it arrives — 8px track, 6px segment, 2px
          padding, matching shared/SegmentedControl. A skeleton drawing a pill makes the control
          change shape at the moment the data lands, which reads as a layout jump. */}
      {/* --gray-200 with the real toggle, so the track does not darken a step in the frame this
          hands over. The bones are already safe: the --gray-200 pair sits inside the white
          selected half, and the unselected half's are --gray-300. */}
      <div style={{ width: "100%", display: "flex", gap: "2px", padding: "2px", backgroundColor: "var(--gray-200)", borderRadius: "var(--radius-control)" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          padding: "8px 16px", backgroundColor: "white", borderRadius: "var(--radius-inner)", boxShadow: "0px 1px 1px rgba(24, 17, 39,0.03)",
        }}>
          <Circle size="12px" color="var(--gray-200)" />
          <Bone w="50px" h="12px" color="var(--gray-200)" radius="3px" />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "8px 16px" }}>
          <Circle size="12px" color="var(--gray-300)" />
          <Bone w="50px" h="12px" color="var(--gray-300)" radius="3px" />
        </div>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex" }}>
            <Circle size="22px" color="var(--gray-200)" />
            <Circle size="22px" color="var(--gray-300)" />
            <div style={{ marginLeft: "-8px" }}><Circle size="22px" color="var(--gray-200)" /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Bone w="16px" h="16px" color="var(--gray-300)" />
            <Bone w="110px" h="14px" />
          </div>
        </div>
        <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)" }} />
      </div>

      <div style={{ width: "100%", display: "flex", gap: "12px" }}>
        {["50px", "55px"].map((w, i) => (
          <div key={i} style={{ flex: 1, backgroundColor: "var(--gray-50)", borderRadius: "var(--radius-panel)", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Bone w={w} h="10px" color="var(--gray-300)" radius="2px" />
            <Bone w="32px" h="20px" />
            <Bone w="40px" h="8px" color="var(--gray-100)" radius="2px" />
          </div>
        ))}
      </div>
      <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)" }} />

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Bone w="90px" h="16px" color="var(--gray-300)" />
          <Bone w="32px" h="18px" color="var(--gray-100)" />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Bone w="42px" h="24px" color="var(--gray-200)" radius="12px" />
          <Bone w="80px" h="24px" color="var(--gray-100)" radius="12px" />
          <Bone w="72px" h="24px" color="var(--gray-100)" radius="12px" />
        </div>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
        {[["80px", "144px"], ["95px", "134px"], ["110px", "124px"], ["80px", "144px"], ["95px", "134px"]].map(([nameW, subW], i) => (
          <ListItemSkeleton key={i} nameW={nameW} subW={subW} />
        ))}
      </div>
    </div>
  );
}

function MapSkeleton() {
  const dots = [
    { left: "18%", top: "20%" }, { left: "30%", top: "42%" }, { left: "42%", top: "26%" },
    { left: "58%", top: "48%" }, { left: "72%", top: "30%" }, { left: "38%", top: "68%" },
    { left: "64%", top: "78%" }, { left: "50%", top: "88%" }, { left: "85%", top: "52%" },
  ];
  const pins = [{ left: "54%", top: "58%" }, { left: "78%", top: "84%" }];
  return (
    <div aria-hidden="true" style={{ flex: 1, position: "relative", backgroundColor: "var(--gray-100)", minWidth: 0 }}>
      <div style={{
        position: "absolute", top: "24px", right: "24px", width: "40px", backgroundColor: "white",
        borderRadius: "8px", boxShadow: "2px 4px 3px rgba(24, 17, 39,0.05)", display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
        <div style={{ width: "40px", height: "1px", backgroundColor: "var(--gray-200)" }} />
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
      </div>
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
  return (
    <div role="status" aria-busy="true" style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", position: "relative" }}>
      {/* First in the DOM so a reader working through the region meets the word before the
          scaffolding it stands for; it still paints on top (absolute + z-index in the class). */}
      <span className="vca-skeleton-loading">{T[lang].loading}</span>
      <SidebarSkeleton />
      <MapSkeleton />
    </div>
  );
}
