"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import AccessGate, { denialFor } from "@/components/AccessGate";
import { useOnValueChange } from "@/hooks/useOnValueChange";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MapWrapper from "./MapWrapper";
import BestFramePage from "./BestFramePage";
import DataPage from "./DataPage";
import RedmapPage from "./RedmapPage";
import SkeletonDashboard from "./SkeletonDashboard";
import SkeletonBestFrame from "./SkeletonBestFrame";
import SkeletonData from "./SkeletonData";
import SkeletonRedmap from "./SkeletonRedmap";
import DetectionActivityChart, { DETECTION_CHART_TITLE } from "./DetectionActivityChart";
import SidebarToggleIcon from "./SidebarToggleIcon";
import { ToastProvider, useToast } from "./Toast";
import { LiveEvent, Device, getFacePhoto } from "@/lib/mockData";
import {
  useVcaStore, currentPortalUser, screensFor,
  camerasInProject, getActiveProjectId, useActiveProjectId, watchedPersonsInProject,
  type AppScreen, type Camera,
} from "@/lib/vcaStore";
import { useLanguage } from "@/lib/i18n";

/**
 * See the per-file pattern note in lib/i18n.ts.
 *
 * The ticker's toast was the one alert in the app still in English only — every other toast here
 * already goes through a dictionary. The values inside it (the person's name, the camera) are the
 * install's own data and stay as they are.
 */
const T = {
  en: {
    vipDetected: "VIP detected",
    viewOnMap: "View on map",
    /**
     * The registry's own words for the priority, copied rather than reworded.
     * ProjectVipTab already prints exactly these three for the same field, and a level that reads
     * "High" on the portal and "Elevated" in the alert is two names for one thing.
     */
    priorityText: { normal: "Normal", high: "High", very_high: "Very High" } as Record<"normal" | "high" | "very_high", string>,
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
  },
  ko: {
    vipDetected: "VIP 감지",
    viewOnMap: "지도에서 보기",
    priorityText: { normal: "일반", high: "높음", very_high: "매우 높음" } as Record<"normal" | "high" | "very_high", string>,
    expandSidebar: "사이드바 펼치기",
    collapseSidebar: "사이드바 접기",
  },
} as const;
import { runStateOf } from "@/lib/realtime/cameraStatus";

export type NavTab = "DASHBOARD" | "BEST FRAME" | "DATA" | "REDMAP";
const VALID_TABS: NavTab[] = ["DASHBOARD", "BEST FRAME", "DATA", "REDMAP"];

export type SidebarPosition = "left" | "right";
const SIDEBAR_POSITION_KEY = "vca-sidebar-position";

// Simulates VIP detections arriving over time: periodically fires a new VIP hit (random
// registered person + random online camera), records it in the store, and surfaces it as a
// dismiss-after-a-few-seconds toast banner. The banner never auto-jumps the map — only its
// "View on Map" action (via onNavigate) does, so an operator isn't yanked away from what they're
// currently looking at just because a detection came in.
// The cameras a simulated detection can land on: the site's own register, the running ones.
//
// This used to draw from a separate ~1,000-camera simulation pool. A detection stamped onto a
// camera from that pool named a camera the operator cannot open, cannot see in the device list and
// cannot check in Portal — and the map's ping matched positions against that pool while the device
// list counted the register, so the same site had two camera populations with two different
// counts. One register (decided 2026-09-10).
// Not filtered by position, on purpose.
//
// This used to end in `.filter(hasPosition)`, which said "a camera whose position nobody has
// surveyed cannot produce a detection". That is false. A camera detects people because it is
// pointed at them; whether a surveyor has written down where it stands is a separate fact about
// the register, and it changes nothing about what the lens sees. The filter folded "we cannot draw
// this on the map" into "this cannot detect", and the consequence was a running camera that is
// live in the device list, streaming, and countable in Portal, yet silently incapable of ever
// producing a sighting — an absence that reads as a quiet detection gap rather than a missing
// survey.
//
// The reason it was left in was that releasing it hands a position-less sighting to the map, the
// district roll-up and the map ping, none of which could take absence at the time. All three can
// now:
//   - MapView filters `useProjectCameras()` through hasPosition once, and the 16 geo computations
//     downstream read that narrowed list;
//   - districtIdAt(lat?, lng?) answers `undefined` for a point with no coordinate, and all six
//     district-judgement call sites take that answer;
//   - a trail's gap segment renders as a dashed leg with a "no coordinate" chip instead of a
//     straight line through a place the person was never at.
// So absence travels now, and the filter is what was lying.
function simulationCameras(projectId: string) {
  return camerasInProject(useVcaStore.getState().cameras, projectId)
    .filter(c => runStateOf(c.status) === "running");
}

function hashStringToIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

// A real person mostly keeps showing up at the same one or two spots they actually frequent, not
// bouncing across the city's whole ~1,000-camera network every sighting. Picking a genuinely
// random camera each tick (as this used to) meant virtually every 2nd sighting of the same VIP
// landed on a brand-new camera — which instantly and permanently promotes them to a multi-camera
// "Tracking" row (see addEvent in vcaStore.ts) and never lets them go back. Given only ~16
// registered VIPs cycling through ticks every 15-30s, that meant everyone ended up as "Tracking"
// within an hour and no plain "VIP Detection" sightings survived. Pinning each person to 3
// regular cameras (deterministic from their id, so stable across ticks/reloads) keeps most
// sightings repeating at the same camera (stays a plain VIP row) and bounds any real trail to at
// most those 3 cameras, instead of growing unbounded.
// Plain `Camera`, not a position-narrowed one. The pool is every running camera at the site now
// (see simulationCameras), so a regular camera may be one nobody has surveyed, and a sighting at
// it carries no coordinate. LiveEvent.lat/lng and VcaEvent.lat/lng are already optional, which is
// where that absence goes.
function regularCamerasForPerson(personId: string, pool: Camera[]): Camera[] {
  return [
    pool[hashStringToIndex(personId, pool.length)],
    pool[hashStringToIndex(`${personId}-alt1`, pool.length)],
    pool[hashStringToIndex(`${personId}-alt2`, pool.length)],
  ];
}

function VipAlertTicker({ onNavigate }: { onNavigate: (event: LiveEvent) => void }) {
  const { showToast } = useToast();
  const [lang] = useLanguage();
  /**
   * The two moving parts held in refs, so the timer below can arm ONCE.
   *
   * `onNavigate` is rebuilt on every render of ClientLayout (it closes over the filter setters),
   * and `lang` changed the arming too. The effect's cleanup clears the pending timeout, so every
   * re-render of the layout threw away the wait so far and started a fresh 15-30 seconds: while
   * anybody was using the screen the detection feed stalled, and a shift spent opening and
   * closing the chart or the sidebar — both ClientLayout state — would never see a detection at
   * all. On a console whose whole job is to report what is happening, that failure is invisible:
   * a quiet feed looks exactly like a quiet street.
   *
   * Same pattern MapView uses for its own click handlers, and for the same reason.
   */
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => { onNavigateRef.current = onNavigate; }, [onNavigate]);
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 15000 + Math.random() * 15000;
      timer = setTimeout(() => {
        const { addEvent } = useVcaStore.getState();
        // Scoped to the site on screen, and to the people actually being watched.
        //
        // It read the whole `persons` list, so a person registered at the school turned up on a
        // Singapore camera — the site switch in the header was decoration as far as the alerts
        // were concerned. And it did not read releasedAt or expiresAt at all, which is the thing
        // Person.expiresAt's own note warned about: somebody released this morning still raised
        // an alert this afternoon. watchedPersonsInProject answers both.
        //
        // The camera pool is scoped too. Picking the person's site correctly and then stamping the
        // detection onto a camera from another one would move the bug rather than fix it.
        const projectId = getActiveProjectId();
        const storeNow = useVcaStore.getState();
        const persons = watchedPersonsInProject(storeNow.persons, projectId);
        const onlineCameras = simulationCameras(projectId);
        if (persons.length > 0 && onlineCameras.length > 0) {
          const person = persons[Math.floor(Math.random() * persons.length)];
          const regulars = regularCamerasForPerson(person.id, onlineCameras);
          const r = Math.random();
          const camera = r < 0.6 ? regulars[0] : r < 0.85 ? regulars[1] : regulars[2];
          const confidence = Math.round((68 + Math.random() * 27) * 10) / 10;
          const timestamp = new Date().toISOString();
          const liveEvent: LiveEvent = {
            id: `sim-${timestamp}-${person.id}`,
            name: person.name,
            description: person.description,
            confidence,
            location: camera.name,
            cameraLabel: camera.code,
            timestamp,
            type: "VIP",
            lat: camera.lat,
            lng: camera.lng,
          };
          addEvent({
            cameraId: camera.id,
            type: "VIP Match",
            severity: "warning",
            timestamp,
            personId: liveEvent.id,
            personName: person.name,
            personDescription: person.description,
            personType: "VIP",
            confidence,
            location: camera.name,
            cameraLabel: camera.code,
            lat: camera.lat,
            lng: camera.lng,
            photoUrl: getFacePhoto(liveEvent.id),
          });
          // Read at fire time, not at arm time — the timer is armed once now (see the refs
          // above), so the alert is written in whatever language is on screen when it arrives.
          const alertLang = langRef.current;
          showToast({
            variant: "warning",
            title: T[alertLang].vipDetected,
            // Match confidence in the alert itself: it decides whether this is worth acting on
            // right now, and it was already computed above for the event record while the toast —
            // the thing the operator actually sees first — left it out.
            //
            // PRIORITY AND GROUP RIDE ALONG, because "is this worth turning round for" is the
            // question the toast exists to answer and the name alone does not answer it. Both come
            // off the person object this ticker already picked out of the register — no lookup by
            // name, which is the join this codebase forbids.
            //
            // Priority is ALWAYS printed, including "normal". The registry hides a normal priority
            // as "nothing to say", and that is right on a table you are reading; on an alert that
            // arrives unbidden every 15-30s a fixed shape is what makes it readable at a glance,
            // and a missing word would have to be decoded as "normal" rather than read.
            // `?? "normal"` matches the registry's own default for an unset field.
            //
            // The group is printed only when the person is in one, because most are not. It is the
            // group's NAME, not its priority: PersonGroup carries a priorityLabel of its own and
            // the two can disagree (a "normal" person inside a "high" delegation), and the one
            // that is true of the person in front of the camera is the person's. The group name is
            // what turns "who" into "why they matter" — it is the institution's own word for the
            // list this person is on.
            desc: [
              person.name,
              T[alertLang].priorityText[person.priorityLabel ?? "normal"],
              person.groupId ? storeNow.personGroups.find(g => g.id === person.groupId)?.name : undefined,
              camera.name,
              `${confidence}%`,
            ].filter(Boolean).join(" · "),
            actionLabel: T[alertLang].viewOnMap,
            onAction: () => onNavigateRef.current(liveEvent),
          });
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
    // No dependencies on purpose: `onNavigate` and `lang` are read through the refs above, and
    // `showToast` is already stable (a useCallback over a stable dismiss — see Toast.tsx). A
    // dependency here is a cancelled detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);
  return null;
}

/**
 * One screen refused: the person is moved to a screen they do hold, and told why.
 *
 * NOT a replaced body, which is what this was first. A refusal panel where the screen used to be
 * keeps somebody standing somewhere they cannot use, and leaves them to work out what to press
 * next — the tabs are still there, but "this is broken" and "go and click something else" are not
 * the same thought. Moving them first and explaining second means the app behind the notice is
 * already usable when they dismiss it.
 *
 * NOT a silent redirect either, which is the failure the tab-level version of this already caused
 * once: a menu entry that bounced people without a word read as a broken link, and they asked
 * whoever sent it rather than whoever grants it. The dialog names the screen and names who gives
 * it, and it is a dialog rather than a toast because a toast that expires while somebody is
 * reading is an answer they now have to go looking for.
 *
 * NOT the full AccessGate, which is a different case: that one is an account with no screens at
 * all, where there is nothing to be moved to and nothing behind the notice to use.
 */
/**
 * 은/는 — 받침이 있으면 "은", 없으면 "는".
 *
 * 화면 이름이 목록에서 오므로 문장을 미리 써 둘 수 없고, "레드맵은(는)"처럼 둘 다 적으면
 * 사람이 읽는 문장이 아니라 번역이 덜 끝난 문자열로 읽힌다.
 */
function topicParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return "은";
  return (last - 0xac00) % 28 === 0 ? "는" : "은";
}

/** The tab's own name, so the notice says "Redmap" rather than "REDMAP" — see Navbar.TABS. */
const TAB_LABEL: Record<"en" | "ko", Record<NavTab, string>> = {
  en: { DASHBOARD: "Dashboard", "BEST FRAME": "Best Frame", DATA: "Data", REDMAP: "Redmap" },
  ko: { DASHBOARD: "대시보드", "BEST FRAME": "베스트 프레임", DATA: "데이터", REDMAP: "레드맵" },
};

function ScreenRefusedNotice({ screen, onDismiss }: { screen: string; onDismiss: () => void }) {
  const [lang] = useLanguage();
  const t = {
    en: {
      title: "You do not have access to this screen",
      body: (name: string) => `${name} is granted per account. An administrator gives it in Portal, under Users & Permissions.`,
      moved: "Meanwhile, the screens you do have are open behind this.",
      ok: "Got it",
    },
    ko: {
      title: "이 화면은 권한이 없습니다",
      body: (name: string) => `${name}${topicParticle(name)} 계정마다 따로 지정됩니다. Portal의 사용자 및 권한에서 관리자가 줍니다.`,
      moved: "가진 화면으로 옮겨 두었습니다.",
      ok: "확인",
    },
  }[lang];
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", maxWidth: "380px", width: "100%", padding: "22px", boxShadow: "var(--shadow-modal)" }}>
        <p style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
        <p style={{ fontSize: "13px", color: "var(--gray-500)", lineHeight: 1.6, marginTop: "8px" }}>{t.body(screen)}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "6px" }}>{t.moved}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
          <button onClick={onDismiss}
            style={{ padding: "9px 18px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientLayout() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  /**
   * Which app screens this account holds, and which top-level tabs that leaves standing.
   *
   * DASHBOARD is not in the grant list and never filtered out — it is the app's ground floor and
   * rides on appAccess. DATA stands if ANY of its three sub-screens does; the sub-tabs inside it
   * are filtered by DataPage itself.
   */
  // The selector returns the raw slice and the filtering happens outside it. screensFor() builds a
  // new array every call, and a zustand selector that returns a fresh object on every read compares
  // unequal to itself — React re-renders, re-selects, re-renders, and the page dies with "maximum
  // update depth exceeded". Neither tsc nor next build can see this; only opening the page can.
  const portalUsersForScreens = useVcaStore(s => s.portalUsers);
  const heldScreens = useMemo(() => screensFor(portalUsersForScreens), [portalUsersForScreens]);
  const holds = (screen: AppScreen) => heldScreens.includes(screen);
  const tabAllowed = (tab: NavTab) =>
    tab === "DASHBOARD" ? true
    : tab === "BEST FRAME" ? holds("bestframe")
    : tab === "REDMAP" ? holds("redmap")
    : holds("live") || holds("reid") || holds("redface");
  /**
   * The tab the URL asks for, but only if this account still holds it.
   *
   * setActivePage writes ?tab= on every move, so the address bar remembers where somebody was —
   * and without this check, an operator whose Redmap grant was taken away lands on a refusal
   * screen at every single sign-in, forever, because the last place they went is still in their
   * bookmark. Falling back to the first tab they do hold puts them somewhere usable.
   */
  const requestedTab = (VALID_TABS as string[]).includes(tabParam ?? "") ? (tabParam as NavTab) : "DASHBOARD";
  const initialTab = tabAllowed(requestedTab) ? requestedTab : "DASHBOARD";
  const [activePage, setActivePageState] = useState<NavTab>(initialTab);
  /**
   * The screen somebody was sent away from, held until they have read why.
   *
   * Seeded during the first render rather than from an effect: by the time an effect could run,
   * the tab has already been corrected to one this account holds and the name of the one they
   * asked for is gone. Arriving on a bookmarked screen the account has since lost is the ordinary
   * way to reach this.
   */
  const [refusedScreen, setRefusedScreen] = useState<NavTab | null>(
    () => (tabAllowed(requestedTab) ? null : requestedTab),
  );
  /** Where somebody goes when the screen they asked for is not theirs. Dashboard rides on the
   *  app door, so this always resolves. */
  const firstAllowedTab: NavTab = VALID_TABS.find(tabAllowed) ?? "DASHBOARD";
  /**
   * Moving tab sets `tab=` and leaves every other parameter standing.
   *
   * It used to write `?tab=${tab}` as the ENTIRE query string, and the app has a second parameter:
   * DataPage keeps which of its three sub-screens is open in `sub=` (see its own note — "the
   * sub-tab rides the URL the way the top-level tab already does"). Rebuilding the query from
   * nothing here deleted it, so leaving Data and coming back always landed on Live Monitoring
   * however the person had got there, and the address copied out of the bar reopened the wrong
   * one — the URL was the only record of that choice.
   *
   * It also put the two writers in a race neither can win. DataPage mirrors `sub=` from an effect
   * that rebuilds the query from ITS OWN snapshot of the parameters, so with both sides writing a
   * whole query string the later write erases the earlier side's parameter. Carrying `sub=`
   * through means that, where it is already the right value, DataPage's effect sees nothing to
   * change and does not write at all — which is most of the moves between tabs.
   *
   * NOT the whole of that race: arriving on Data with no `sub=` at all still leaves DataPage a
   * write to make, and it makes it from a snapshot that predates this one — see the HANDOFF NOTE
   * below.
   */
  const setActivePage = (tab: NavTab) => {
    setActivePageState(tab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  /*
   * HANDOFF NOTE (needs DataPage.tsx, which another session holds) — the address bar can still
   * name a tab other than the one on screen.
   *
   * Measured: on `/?tab=DASHBOARD`, clicking Data renders Data and leaves the address at
   * `/?tab=DASHBOARD&sub=live`. This side writes `tab=DATA`; DataPage then mounts, finds no
   * `sub=`, and writes `sub=live` onto the parameters it captured during ITS first render — which
   * still say `tab=DASHBOARD`, because a router.replace() from this side has not re-rendered
   * anything yet. The second write lands last and carries the stale tab with it.
   *
   * So a person on Data can copy an address that reopens Dashboard. That is the whole of the
   * "a link to a Data screen does not open that screen" report: `?tab=DATA` typed in by hand
   * opens Data correctly (measured, first paint and after settling, fresh load and reload). It is
   * the address the app HANDS them that is wrong.
   *
   * The half that belongs here is done — this writer no longer destroys a parameter it does not
   * own. The other half is DataPage's mirror effect building its query from the render's
   * `searchParams` instead of from the live ones; both writers have to merge rather than rebuild,
   * or one of them has to own the whole query.
   *
   * NOT the access gate, which was the first suspicion. `heldScreens` is settled on the very
   * first render — the store is seeded synchronously from a module constant with no persistence,
   * no localStorage and no fetch — so the gate never sees "we do not know yet" and never moves
   * anybody off a tab they hold. No spurious `setRefusedScreen` exists to fix.
   */

  // The app's door, mirroring PortalShell's. An account without appAccess could type `/` and walk
  // straight in — Portal had a guard and this side had none, so the two halves of one permission
  // model were enforced on one half.
  //
  // Draws the gate rather than redirecting. The redirect that used to be here carried a
  // console-only account to Portal and everybody else to login, and in both cases the person saw
  // a screen they had not asked for with nothing saying why — which reads as a fault, not as a
  // decision. The gate names the closed door, states the grants this account does hold, and offers
  // the open one as a button, so going to Portal stays one click away instead of being automatic.
  //
  // HANDOFF NOTE: fail-open on purpose, same as Portal's. `currentPortalUser` answers undefined
  // for an address in no account list, and then nothing is locked. The real door is the server.
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));
  // Which sentence the gate should say, not merely that it should appear: a paused account is a
  // pause, an unactivated one has a code to use, and an ungranted one is a grant somebody has to
  // make. The three need different actions from the person reading it — and the answer comes from
  // denialFor, the same function the Portal door and /gate ask, because this used to be derived
  // here in its own order and told an invited account it was "suspended".
  const appDenial = denialFor(me, "app");
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  // Clicking a district cluster pill (zoomed-out map view) filters the sidebar to just that
  // district's VIP hits — separate from locationFilter (an exact camera/site name match) since
  // a district groups several sites by geographic proximity, not by a shared name substring.
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [pinnedDevice, setPinnedDevice] = useState<Device | null>(null);
  // Everything above points at one site's data — a selected detection, a camera-name filter, a
  // district, a pinned device. The header can switch site under all of them, and none of them was
  // cleared: the map kept another site's face pin and its name/confidence popup, the filters kept
  // narrowing a list they no longer matched, and the pinned marker could not be removed at all,
  // because the only way to unpin is to click the same row again and that row is not in this
  // site's device list.
  const layoutProjectId = useActiveProjectId();
  useOnValueChange(layoutProjectId, () => {
    setSelectedEvent(null);
    setLocationFilter(null);
    setDistrictFilter(null);
    setPinnedDevice(null);
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Default "left" on the server-rendered pass so hydration never mismatches; a client-only
  // effect then applies whatever the user last chose on this browser.
  const [sidebarPosition, setSidebarPositionState] = useState<SidebarPosition>("left");
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(SIDEBAR_POSITION_KEY);
      if (saved === "left" || saved === "right") setSidebarPositionState(saved);
    });
  }, []);
  const setSidebarPosition = (pos: SidebarPosition) => {
    setSidebarPositionState(pos);
    localStorage.setItem(SIDEBAR_POSITION_KEY, pos);
  };
  const [lang] = useLanguage();
  // Closed until asked for. The chart covers the bottom third of the map, and the map is what
  // this screen is for — the two numbers it summarises are already in the sidebar, so opening it
  // is a deliberate "show me today's shape", not the resting state.
  const [showDetectionChart, setShowDetectionChart] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bestFrameFocusLocation, setBestFrameFocusLocation] = useState<string | null>(null);
  const [redmapAutoSearchName, setRedmapAutoSearchName] = useState<string | null>(null);
  /** A captured frame carried to Redmap as the search target — see handleGoRedmapFrame. */
  const [redmapSeedFace, setRedmapSeedFace] = useState<{ url: string; label: string } | null>(null);
  const [bestFrameAnalyzeLocation, setBestFrameAnalyzeLocation] = useState<string | null>(null);
  // Optional moment that goes with the location. RedFace's shared-frame lightbox names one exact
  // frame, so Best Frame should open on that second rather than on the camera's live position;
  // Dashboard's map popup still sends a location alone.
  const [bestFrameAnalyzeAt, setBestFrameAnalyzeAt] = useState<{ date: string; time: string } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);
  /**
   * A grant taken away while somebody is standing on the screen.
   *
   * On an on-premise control desk this is the ordinary case rather than the edge one: the
   * workstation stays signed in for days and only the shift changes, so a screen can be revoked
   * under a person who is looking at it. They are moved to a screen they still hold and told why.
   */
  useEffect(() => {
    if (tabAllowed(activePage)) return;
    setRefusedScreen(activePage);
    setActivePage(firstAllowedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, heldScreens]);
  /**
   * The address bar has to stop naming the refused screen too.
   *
   * The state moved on the first render, so the effect above never fires for a deep link — and
   * without this the URL still reads ?tab=REDMAP over a Dashboard. That address gets bookmarked
   * again, and every refresh re-runs the refusal for a screen the person has already been told
   * about once.
   */
  useEffect(() => {
    if (refusedScreen === null || requestedTab !== refusedScreen) return;
    setActivePage(firstAllowedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /*
   * The jumps between screens, and the rule that governs all of them: a button that leads
   * somewhere this account cannot go is not shown at all.
   *
   * Handed to the children as undefined rather than as a function that refuses, and every child
   * hides its own button when the prop is absent. A visible control that bounces the person who
   * presses it is the bug this product already had once at the menu level; reproducing it at ten
   * jump sites would be worse, because a menu item at least looks like navigation while these
   * look like actions on the thing being examined.
   */
  const handleGoLiveCam = (location: string) => {
    setBestFrameFocusLocation(location);
    setActivePage("BEST FRAME");
  };
  const handleGoRedmapTrace = (personName: string) => {
    setRedmapAutoSearchName(personName);
    setActivePage("REDMAP");
  };
  /**
   * "This person on screen — find them again."
   *
   * The name-based route above only works where the detection has a name. Most do not: a live
   * monitoring card is a photo, a camera and a time, and it used to offer a Redmap button that
   * threw all three away and opened an empty search form. Carrying the frame keeps the one thing
   * worth carrying.
   */
  const handleGoRedmapFrame = (url: string, label: string) => {
    setRedmapSeedFace({ url, label });
    setActivePage("REDMAP");
  };
  /**
   * Acting on an alert — the toast's "View on map", or a row in the notification list.
   *
   * Clears the place filters, and that is the point of this function rather than a side effect of
   * it. Alerts are site-wide on purpose: a district filter narrows the list and the map, never the
   * toast or the bell, so an operator investigating one district still hears about a VIP anywhere
   * on the site. But pressing "View on map" while filtered used to leave the filter on, and then
   * the screen could not show what the press had asked for — the map flew to the detection while
   * the list beside it still held the old district, so the row for the thing being looked at was
   * missing from it.
   *
   * Whoever presses this has chosen this detection over whatever they were narrowing down to. The
   * filter is theirs to set again; a view that cannot display what it was just told to show is
   * not.
   */
  const handleNotificationNavigate = (event: LiveEvent) => {
    setLocationFilter(null);
    setDistrictFilter(null);
    setSelectedEvent(event);
    setActivePage("DASHBOARD");
  };
  const handleGoAnalyzeFrame = (location: string, at?: { date: string; time: string }) => {
    setBestFrameAnalyzeLocation(location);
    setBestFrameAnalyzeAt(at ?? null);
    setActivePage("BEST FRAME");
  };

  // A denial means this account has no app door, so the gate replaces the app entirely rather than
  // covering it: what sits below this line is the map, the sidebar's VIP list with names and
  // faces, and the alert ticker, which does not merely display but writes detections into the
  // shared store on a timer. A door that is closed cannot also serve the room behind it.
  if (me && appDenial) return <AccessGate user={me} denial={appDenial} />;

  return (
    <ToastProvider>
    <VipAlertTicker onNavigate={handleNotificationNavigate} />
    {refusedScreen && <ScreenRefusedNotice screen={TAB_LABEL[lang][refusedScreen]} onDismiss={() => setRefusedScreen(null)} />}
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar
        activeTab={activePage}
        onTabChange={setActivePage}
        allowedTabs={VALID_TABS.filter(tabAllowed)}
        onNotificationSelect={handleNotificationNavigate}
        // Only actually affects the Dashboard tab's Sidebar+Map layout — hidden on the other tabs
        // (via Navbar's own `{onSidebarPositionChange && (...)}` guard) so the Settings dropdown
        // doesn't show a "Sidebar" control that would do nothing while looking at Best Frame/Data/RedMap.
        sidebarPosition={activePage === "DASHBOARD" ? sidebarPosition : undefined}
        onSidebarPositionChange={activePage === "DASHBOARD" ? setSidebarPosition : undefined}
      />
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {isLoading ? (
          <>
            {activePage === "DASHBOARD" && <SkeletonDashboard />}
            {activePage === "BEST FRAME" && <SkeletonBestFrame />}
            {activePage === "DATA" && <SkeletonData />}
            {activePage === "REDMAP" && <SkeletonRedmap />}
          </>
        ) : activePage === "DASHBOARD" && (() => {
          const sidebarEl = (
            <Sidebar
              key="sidebar"
              position={sidebarPosition}
              isCollapsed={sidebarCollapsed}
              onEventSelect={setSelectedEvent}
              selectedEventId={selectedEvent?.id}
              locationFilter={locationFilter}
              onLocationClear={() => setLocationFilter(null)}
              onLocationSelect={(loc) => { setLocationFilter(loc); setDistrictFilter(null); }}
              districtFilter={districtFilter}
              onPinDevice={setPinnedDevice}
              pinnedDeviceId={pinnedDevice?.id ?? null}
              onToggleDetectionChart={() => setShowDetectionChart(v => !v)}
            />
          );
          const isRight = sidebarPosition === "right";
          const mapAreaEl = (
            /* Map area */
            <div key="map" style={{ flex: 1, position: "relative", minWidth: 0 }}>
              <MapWrapper
                selectedEvent={selectedEvent}
                onCameraSelect={(label) => { setLocationFilter((prev) => (prev === label ? null : label)); setDistrictFilter(null); }}
                districtFilter={districtFilter}
                onDistrictSelect={(id) => { setDistrictFilter((prev) => (prev === id ? null : id)); setLocationFilter(null); }}
                pinnedDevice={pinnedDevice}
                onGoLiveCam={holds("bestframe") ? handleGoLiveCam : undefined}
                onGoRedmapTrace={holds("redmap") ? handleGoRedmapTrace : undefined}
                onAnalyzeFrame={holds("bestframe") ? handleGoAnalyzeFrame : undefined}
              />
              {/* Sidebar toggle button - absolutely positioned over the map, on whichever edge
                  is adjacent to the sidebar. Shifted 3px past that edge: the SidebarToggleIcon's
                  pill shape starts at x=3 within its own 34px-wide viewBox (padding for its drop
                  shadow), so 0 left a 3px sliver of the map's gray background showing through.
                  Mirrored (scaleX(-1)) when the sidebar is on the right so the pill still bulges
                  into the map and the triangle still points the correct expand/collapse way. */}
              <div
                onClick={() => setSidebarCollapsed(c => !c)}
                role="button"
                tabIndex={0}
                aria-label={sidebarCollapsed ? T[lang].expandSidebar : T[lang].collapseSidebar}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSidebarCollapsed(c => !c); } }}
                style={{
                  position: "absolute", top: "50%",
                  ...(isRight ? { right: "-3px" } : { left: "-3px" }),
                  transform: isRight ? "translateY(-50%) scaleX(-1)" : "translateY(-50%)",
                  zIndex: 1000,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <SidebarToggleIcon collapsed={sidebarCollapsed} />
              </div>
              {/* Detection activity chart — floating, semi-transparent overlay so the map shows
                  through behind it, rather than a separate opaque section below the map.
                  Toggles from clicking "Today's detections" in the sidebar, or minimizes down
                  into a small floating pill from the chevron on the chart itself. */}
              {showDetectionChart ? (
                <div style={{ position: "absolute", left: "24px", right: "24px", bottom: "24px", zIndex: 900 }}>
                  <DetectionActivityChart onHide={() => setShowDetectionChart(false)} />
                </div>
              ) : (
                <button
                  onClick={() => setShowDetectionChart(true)}
                  className="vca-rise-in"
                  style={{
                    position: "absolute", left: "24px", bottom: "24px", zIndex: 900,
                    display: "flex", alignItems: "center", gap: "8px",
                    backgroundColor: "rgba(255,255,255,0.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    // HANDOFF NOTE (design system): the fill above is the one colour on this
                    // screen with no token behind it. globals.css has four elevation/overlay
                    // roles and none of them is "a glass surface over the map" — the scrims are
                    // dark, and an opaque --gray-0 here would close the window the comment above
                    // asks for. The hairline is the token it always was; the 74% white wants a
                    // --glass-surface added to globals.css, which is a shared file and a design
                    // call, so it is reported rather than invented here.
                    border: "1px solid var(--gray-200)", borderRadius: "999px", padding: "8px 14px",
                    boxShadow: "var(--shadow-popover)", cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 10L8 6L12 10" stroke="var(--gray-900)" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {/* Named after the panel it opens, not after itself — it used to say
                      "Detection topology" over a chart titled "VIP detections today". */}
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.24px", whiteSpace: "nowrap" }}>
                    {DETECTION_CHART_TITLE[lang]}
                  </span>
                </button>
              )}
            </div>
          );
          return isRight ? <>{mapAreaEl}{sidebarEl}</> : <>{sidebarEl}{mapAreaEl}</>;
        })()}
        {/* Best Frame stays mounted once loaded (display:none instead of unmounting) so its
            camera selection / detail view survives switching to another tab and back. */}
        {!isLoading && holds("bestframe") && (
          <div style={{ display: activePage === "BEST FRAME" ? "contents" : "none" }}>
            <BestFramePage
              focusLocation={bestFrameFocusLocation}
              onFocusConsumed={() => setBestFrameFocusLocation(null)}
              onGoRedmapTrace={holds("redmap") ? handleGoRedmapTrace : undefined}
              analyzeFrameLocation={bestFrameAnalyzeLocation}
              analyzeFrameAt={bestFrameAnalyzeAt}
              onAnalyzeFrameConsumed={() => { setBestFrameAnalyzeLocation(null); setBestFrameAnalyzeAt(null); }}
            />
          </div>
        )}
        {!isLoading && activePage === "DATA" && tabAllowed("DATA") && <DataPage
          onGoRedmap={holds("redmap") ? () => setActivePage("REDMAP") : undefined}
          onGoRedmapFrame={holds("redmap") ? handleGoRedmapFrame : undefined}
          onGoAnalyzeFrame={holds("bestframe") ? handleGoAnalyzeFrame : undefined}
        />}
        {!isLoading && activePage === "REDMAP" && holds("redmap") && (
          <RedmapPage
            initialSearchName={redmapAutoSearchName}
            onInitialSearchConsumed={() => setRedmapAutoSearchName(null)}
            initialSeedFace={redmapSeedFace}
            onInitialSeedConsumed={() => setRedmapSeedFace(null)}
          />
        )}
      </div>
    </div>
    </ToastProvider>
  );
}
