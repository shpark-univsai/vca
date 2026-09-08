"use client";

import { useEffect, useState } from "react";
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
import { useVcaStore, VIP_SIMULATION_CAMERAS, type Camera } from "@/lib/vcaStore";
import { useLanguage } from "@/lib/i18n";

export type NavTab = "DASHBOARD" | "BEST FRAME" | "DATA" | "REDMAP";
const VALID_TABS: NavTab[] = ["DASHBOARD", "BEST FRAME", "DATA", "REDMAP"];

export type SidebarPosition = "left" | "right";
const SIDEBAR_POSITION_KEY = "vca-sidebar-position";

// Simulates VIP detections arriving over time: periodically fires a new VIP hit (random
// registered person + random online camera), records it in the store, and surfaces it as a
// dismiss-after-a-few-seconds toast banner. The banner never auto-jumps the map — only its
// "View on Map" action (via onNavigate) does, so an operator isn't yanked away from what they're
// currently looking at just because a detection came in.
// Drawn from the ~1,000-camera simulation pool (VIP_SIMULATION_CAMERAS), not the store's `cameras`
// state — that pool is deliberately kept small for other features' performance. Computed once
// since the pool is static; no reason to re-filter it on every tick.
const VIP_SIM_ONLINE_CAMERAS = VIP_SIMULATION_CAMERAS.filter(c => c.status === "online");

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
function regularCamerasForPerson(personId: string): Camera[] {
  const pool = VIP_SIM_ONLINE_CAMERAS;
  return [
    pool[hashStringToIndex(personId, pool.length)],
    pool[hashStringToIndex(`${personId}-alt1`, pool.length)],
    pool[hashStringToIndex(`${personId}-alt2`, pool.length)],
  ];
}

function VipAlertTicker({ onNavigate }: { onNavigate: (event: LiveEvent) => void }) {
  const { showToast } = useToast();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 15000 + Math.random() * 15000;
      timer = setTimeout(() => {
        const { persons, addEvent } = useVcaStore.getState();
        const onlineCameras = VIP_SIM_ONLINE_CAMERAS;
        if (persons.length > 0 && onlineCameras.length > 0) {
          const person = persons[Math.floor(Math.random() * persons.length)];
          const regulars = regularCamerasForPerson(person.id);
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
            title: "VIP Detected",
            // Match confidence in the alert itself: it decides whether this is worth acting on
            // right now, and it was already computed above for the event record while the toast —
            // the thing the operator actually sees first — left it out.
            desc: `${person.name} · ${camera.name} · ${confidence}%`,
            actionLabel: "View on Map",
            onAction: () => onNavigate(liveEvent),
          });
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [onNavigate, showToast]);
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
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  // Clicking a district cluster pill (zoomed-out map view) filters the sidebar to just that
  // district's VIP hits — separate from locationFilter (an exact camera/site name match) since
  // a district groups several sites by geographic proximity, not by a shared name substring.
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [pinnedDevice, setPinnedDevice] = useState<Device | null>(null);
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
  const handleNotificationNavigate = (event: LiveEvent) => {
    setSelectedEvent(event);
    setActivePage("DASHBOARD");
  };
  const handleGoAnalyzeFrame = (location: string, at?: { date: string; time: string }) => {
    setBestFrameAnalyzeLocation(location);
    setBestFrameAnalyzeAt(at ?? null);
    setActivePage("BEST FRAME");
  };

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
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
        {!isLoading && activePage === "DATA"   && <DataPage onGoRedmap={() => setActivePage("REDMAP")} onGoAnalyzeFrame={handleGoAnalyzeFrame} />}
        {!isLoading && activePage === "REDMAP" && (
          <RedmapPage
            initialSearchName={redmapAutoSearchName}
            onInitialSearchConsumed={() => setRedmapAutoSearchName(null)}
          />
        )}
      </div>
    </div>
    </ToastProvider>
  );
}
