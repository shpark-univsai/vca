"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
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
  useVcaStore, canUseAppNow, canEnterPortal, currentPortalUser,
  camerasInProject, getActiveProjectId, useActiveProjectId, watchedPersonsInProject,
  type Camera,
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
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
  },
  ko: {
    vipDetected: "VIP 검출",
    viewOnMap: "지도에서 보기",
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
        const persons = watchedPersonsInProject(useVcaStore.getState().persons, projectId, Date.now());
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
          showToast({
            variant: "warning",
            title: T[lang].vipDetected,
            // Match confidence in the alert itself: it decides whether this is worth acting on
            // right now, and it was already computed above for the event record while the toast —
            // the thing the operator actually sees first — left it out.
            desc: `${person.name} · ${camera.name} · ${confidence}%`,
            actionLabel: T[lang].viewOnMap,
            onAction: () => onNavigate(liveEvent),
          });
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
    // `lang` is a dependency because the toast is written in it. Re-arming the timer on a language
    // change costs one skipped interval and keeps the next alert in the language on screen.
  }, [onNavigate, showToast, lang]);
  return null;
}

export default function ClientLayout() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const initialTab = (VALID_TABS as string[]).includes(tabParam ?? "") ? (tabParam as NavTab) : "DASHBOARD";
  const [activePage, setActivePageState] = useState<NavTab>(initialTab);
  const setActivePage = (tab: NavTab) => {
    setActivePageState(tab);
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  };

  // The app's door, mirroring PortalShell's. An account without appAccess could type `/` and walk
  // straight in — Portal had a guard and this side had none, so the two halves of one permission
  // model were enforced on one half.
  //
  // Sends a console-only account to Portal rather than to login: they have somewhere to be, and
  // bouncing them to a sign-in screen they are already past reads as a fault. The store refuses an
  // account with neither door (see hasSomeAccess), but this checks anyway — if that invariant ever
  // broke, redirecting to Portal would bounce back here and the two guards would loop forever.
  //
  // HANDOFF NOTE: fail-open on purpose, same as Portal's. `currentPortalUser` answers undefined
  // for an address in no account list, and then nothing is locked. The real door is the server.
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));
  const locked = !!me && !canUseAppNow(me);
  const canGoToPortal = !!me && canEnterPortal(me.permission);
  useEffect(() => {
    if (!locked) return;
    router.replace(canGoToPortal ? "/portal" : "/login");
  }, [locked, canGoToPortal, router]);
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
  const firstLayoutSiteRef = useRef(true);
  useEffect(() => {
    if (firstLayoutSiteRef.current) { firstLayoutSiteRef.current = false; return; }
    setSelectedEvent(null);
    setLocationFilter(null);
    setDistrictFilter(null);
    setPinnedDevice(null);
  }, [layoutProjectId]);
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
  const handleNotificationNavigate = (event: LiveEvent) => {
    setSelectedEvent(event);
    setActivePage("DASHBOARD");
  };
  const handleGoAnalyzeFrame = (location: string, at?: { date: string; time: string }) => {
    setBestFrameAnalyzeLocation(location);
    setBestFrameAnalyzeAt(at ?? null);
    setActivePage("BEST FRAME");
  };

  // Locked means this account has no app door, and the redirect above is already on its way. Draw
  // nothing while it goes: the redirect alone decided where to send them and left the whole app
  // mounted in the meantime — the map, the sidebar's VIP list with names and faces, and the alert
  // ticker, which does not merely display but writes detections into the shared store on a timer.
  // A door that is closed cannot also serve the room behind it for a second first.
  if (locked) return null;

  return (
    <ToastProvider>
    <VipAlertTicker onNavigate={handleNotificationNavigate} />
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar
        activeTab={activePage}
        onTabChange={setActivePage}
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
              onDistrictClear={() => setDistrictFilter(null)}
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
                onGoLiveCam={handleGoLiveCam}
                onGoRedmapTrace={handleGoRedmapTrace}
                onAnalyzeFrame={handleGoAnalyzeFrame}
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
                    border: "1px solid rgba(226,232,240,0.6)", borderRadius: "999px", padding: "8px 14px",
                    boxShadow: "0 8px 32px rgba(14,22,42,0.12)", cursor: "pointer",
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
        {!isLoading && (
          <div style={{ display: activePage === "BEST FRAME" ? "contents" : "none" }}>
            <BestFramePage
              focusLocation={bestFrameFocusLocation}
              onFocusConsumed={() => setBestFrameFocusLocation(null)}
              onGoRedmapTrace={handleGoRedmapTrace}
              analyzeFrameLocation={bestFrameAnalyzeLocation}
              analyzeFrameAt={bestFrameAnalyzeAt}
              onAnalyzeFrameConsumed={() => { setBestFrameAnalyzeLocation(null); setBestFrameAnalyzeAt(null); }}
            />
          </div>
        )}
        {!isLoading && activePage === "DATA"   && <DataPage onGoRedmap={() => setActivePage("REDMAP")} onGoRedmapFrame={handleGoRedmapFrame} onGoAnalyzeFrame={handleGoAnalyzeFrame} />}
        {!isLoading && activePage === "REDMAP" && (
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
