"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_TILE_URL, MAP_TILE_FILTER, tileLayerOptions } from "@/lib/mapTiles";
import { hasPosition, isAwaitingFirstContact, type Camera } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, CARD_RADIUS, PANEL_SHADOW } from "./PortalShared";

/**
 * THE REGISTER, ON THE MAP.
 *
 * Replaces the grid view this screen used to carry (owner's call, 2026-09-18: 입력소스 그리드
 * 없앤 대신 지도에 카메라들을 위치로 확인할 수 있게). The grid was a worse table — no selection,
 * no sort, no paging, cameras only — and it answered a question the row's own thumbnail already
 * answers. A map answers one the table cannot: where is the fleet, and is anything left uncovered.
 *
 * A VIEW OF THE CURRENT FILTER, which is what makes it a toggle and not the grid again.
 *
 * It was a panel over the screen first, and that was the weaker answer (owner: 그리드랑 표
 * 토글있던것처럼 지도랑 표 이렇게 해서 페이지에 뿌려주는게 더 낫지 않아?). A panel gets a
 * modal's worth of room and, worse, it floats free of the toolbar: it drew the whole register
 * while the table behind it was narrowed to nine offline cameras. As a view it takes the same
 * rows the table has, so 오프라인 + 지도 answers "where are the dead ones" — a question neither
 * instrument answers alone.
 *
 * The grid deserved deleting for a different reason: it claimed to be the list and could not
 * select, sort or page. A map claims to be a map. Nobody sorts one, and the table is one click
 * away with everything it can do intact.
 *
 * The app's map, brought over (owner: 앱에서 쓰고있는 지도 가져와도 돼) — the same Leaflet, the
 * same tile source and the same desaturating filter from lib/mapTiles, so the two maps in this
 * product cannot drift apart and an isolated installation configures both at once. What is NOT
 * brought over is MapView's two thousand lines of live events, district polygons and alert
 * thresholds: none of that is what a register is for.
 *
 * ONLY SURVEYED CAMERAS CAN BE DRAWN, and the ones that cannot are named rather than dropped.
 * Placing an unsurveyed camera at the centre of its zone would turn missing information into
 * wrong information — the same mistake that put ten cameras in five wrong districts when the app
 * guessed attribution from geometry (see HANDOFF-SERVER §9-1). So they get a line and a way to
 * reach their rows.
 */

const T = {
  en: {
    title: "Cameras on the map",
    close: "Close",
    connected: "Connected",
    offline: "Offline",
    error: "Refusing",
    awaiting: "Awaiting first contact",
    noPosition: (n: number) => `${n} not on the map`,
    noPositionWhy: "No latitude and longitude on record, so there is nowhere to draw them. Open them in the table to fill the survey in.",
    showThem: "Show those rows",
    preview: "Preview stream",
    empty: "No camera in this project has coordinates yet, so there is nothing to draw.",
    zoneUnset: "No zone",
    zoneCount: (n: number) => `${n} cam${n === 1 ? "" : "s"}`,
    zoneDown: (n: number) => `${n} down`,
    zoomHint: "Grouped by zone — zoom in for individual cameras.",
    zonePicked: (label: string, n: number) => `${label} · ${n} ringed`,
    clearZone: "Clear",
    counted: (drawn: number, total: number) => `${drawn} of ${total} drawn`,
  },
  ko: {
    title: "지도에서 보기",
    close: "닫기",
    connected: "연결됨",
    offline: "오프라인",
    error: "연결 거부",
    awaiting: "첫 연결 대기",
    noPosition: (n: number) => `지도에 없는 ${n}대`,
    noPositionWhy: "위도·경도가 등록돼 있지 않아 그릴 자리가 없습니다. 표에서 열어 측량값을 채우면 됩니다.",
    showThem: "그 행 보기",
    preview: "스트림 미리보기",
    empty: "이 프로젝트에는 좌표가 등록된 카메라가 아직 없어서 그릴 것이 없습니다.",
    zoneUnset: "구역 미지정",
    zoneCount: (n: number) => `${n}대`,
    zoneDown: (n: number) => `${n} 끊김`,
    zoomHint: "구역별로 묶어 보고 있습니다 — 확대하면 카메라 한 대씩 보입니다.",
    zonePicked: (label: string, n: number) => `${label} ${n}대 묶음`,
    clearZone: "해제",
    counted: (drawn: number, total: number) => `${total}대 중 ${drawn}대 표시`,
  },
} as const;

/**
 * ZOOMED OUT IT IS ZONES, ZOOMED IN IT IS CAMERAS (owner's ask, 2026-09-18: 줌아웃하면 구역별로
 * 카메라 몇 대씩 있는지 보이게 하고 확대하면 카메라들 지금처럼). Sixty dots at city zoom is a
 * smear; "Angmokio 12대" is the fact somebody reads at that scale. 14 is the same breakpoint the
 * app's map clusters at, so the two behave alike.
 */
const ZONE_ZOOM_BREAKPOINT = 14;
/** Where a pill flies you. One past the breakpoint, so the pills give way to the dots as part of
 *  the same movement rather than needing a second zoom — the app's rule too. */
const ZONE_FOCUS_ZOOM = ZONE_ZOOM_BREAKPOINT + 1;

/**
 * GROUPED BY THE REGISTER'S OWN `zone`, NOT by the district geometry.
 *
 * The app groups by district and gets it wrong: it re-guesses from coordinates, and on the ten
 * named cameras here five landed in a neighbour's district (see HANDOFF-SERVER §9-1 — Geylang NC1
 * answered Kallang, 0.83km away). Worse, five of the register's zone names are in no district
 * list at all (Queenstown · Jurong East · Orchard · Bugis · Marina Bay), so those cameras would
 * simply vanish from a district-grouped map — 5 of the 11 hand-registered ones.
 *
 * `zone` is what somebody typed when they installed the camera, it is editable and bulk-movable
 * from this very screen, and it is the answer to "which part of the site is this in". Nothing is
 * inferred and no camera is dropped: a blank zone gets its own pill rather than disappearing.
 *
 * When the backend starts handing down a district id per camera (the decision recorded in §9-1),
 * this grouping can switch to it — one function, and the pills keep their shape.
 */
function groupByZone(cameras: (Camera & { lat: number; lng: number })[], unsetLabel: string) {
  const byZone = new Map<string, { label: string; cams: (Camera & { lat: number; lng: number })[] }>();
  cameras.forEach(cam => {
    const key = (cam.zone ?? "").trim();
    const entry = byZone.get(key) ?? { label: key === "" ? unsetLabel : key, cams: [] };
    entry.cams.push(cam);
    byZone.set(key, entry);
  });
  return [...byZone.entries()].map(([key, { label, cams }]) => ({
    key,
    label,
    cams,
    /* The middle of the cameras themselves, not a district centre we would be borrowing from
       somewhere else. A pill has to sit on the thing it counts. */
    lat: cams.reduce((sum, c) => sum + c.lat, 0) / cams.length,
    lng: cams.reduce((sum, c) => sum + c.lng, 0) / cams.length,
    down: cams.filter(c => c.status !== "online").length,
  }));
}

/**
 * The outline drawn around a picked zone's cameras (owner's ask, 2026-09-18: 구역 선택했을 때
 * 점선으로 해당 카메라들 묶어서 테두리).
 *
 * A convex hull, not a bounding box: a box around cameras strung along one road claims a
 * rectangle of the city that holds nothing, and the point of the outline is to say which cameras
 * are in the group — not to assert a boundary the register does not have. Monotone chain, which
 * is short enough to read and needs no library.
 *
 * Under three points there is no polygon to draw, and the caller falls back to a circle: two
 * cameras would otherwise be a line with no inside, and one would be nothing at all.
 */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (input: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of input) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * The hull, pushed outward and then rounded off.
 *
 * A convex hull runs THROUGH the outermost cameras — the dots sit on the line, which reads as a
 * route between them rather than a boundary around them, and the corners come out as hard spikes.
 * The owner's reference is the other shape: the same group with the line held off the dots and the
 * corners smoothed (2026-09-18, with a before/after of both).
 *
 * Two steps, no geometry library:
 *  1. OFFSET. Each hull vertex moves away from the centroid. The distance is a share of the
 *     group's own size rather than a fixed number of metres — a zone whose cameras sit on one
 *     street and a zone spread over a kilometre both need the line clear of the dots, and a
 *     constant would swallow the first and barely show on the second. Clamped at both ends so a
 *     pair of near-identical coordinates still gets a visible margin.
 *  2. ROUND. Chaikin's corner cutting: every edge gives up its ends at the quarter marks, three
 *     times over. Each pass halves the angle at every corner, and after three the polygon reads as
 *     a curve while still being the polygon Leaflet knows how to draw. No curve primitive needed —
 *     Leaflet's polygon takes points, so the rounding has to live in the points.
 *
 * Longitude is scaled by cos(latitude) throughout: a degree of longitude is shorter than a degree
 * of latitude everywhere but the equator, and offsetting in raw degrees would push the east and
 * west sides further than the north and south ones. At Singapore's latitude that is a 0.03%
 * difference and invisible; the scaling is here because the product is not only deployed there.
 */
function roundedBoundary(points: [number, number][]): [number, number][] {
  const hull = convexHull(points);
  if (hull.length < 3) return hull;

  const centroidLat = hull.reduce((sum, p) => sum + p[0], 0) / hull.length;
  const centroidLng = hull.reduce((sum, p) => sum + p[1], 0) / hull.length;
  const lngScale = Math.max(0.2, Math.cos((centroidLat * Math.PI) / 180));

  /* The group's radius in degrees of latitude, which is the unit the offset is expressed in. */
  const radius = Math.max(...hull.map(p => Math.hypot(p[0] - centroidLat, (p[1] - centroidLng) * lngScale)));
  // 0.00045° of latitude is about 50m, 0.0027° about 300m.
  const pad = Math.min(0.0027, Math.max(0.00045, radius * 0.22));

  const offset = hull.map(([lat, lng]) => {
    const dLat = lat - centroidLat;
    const dLng = (lng - centroidLng) * lngScale;
    const length = Math.hypot(dLat, dLng);
    // A vertex sitting on the centroid has no direction to be pushed in; leave it where it is and
    // let its neighbours carry the shape.
    if (length === 0) return [lat, lng] as [number, number];
    return [lat + (dLat / length) * pad, lng + (dLng / length) * pad / lngScale] as [number, number];
  });

  const smooth = (ring: [number, number][]) => {
    let current = ring;
    for (let pass = 0; pass < 3; pass += 1) {
      const next: [number, number][] = [];
      for (let i = 0; i < current.length; i += 1) {
        const [aLat, aLng] = current[i];
        const [bLat, bLng] = current[(i + 1) % current.length];
        next.push([aLat + (bLat - aLat) * 0.25, aLng + (bLng - aLng) * 0.25]);
        next.push([aLat + (bLat - aLat) * 0.75, aLng + (bLng - aLng) * 0.75]);
      }
      current = next;
    }
    return current;
  };

  /*
   * AND THEN CHECK, because corner cutting pulls the curve INWARD.
   *
   * Chaikin replaces each corner with a chord across it, so the smoothed ring sits inside the
   * polygon it was made from — most of the way round that is invisible, but at a sharp vertex the
   * curve can end up inside the original hull and leave that camera's dot outside the boundary
   * drawn around it. Measured on the Bedok zone at the first attempt: five cameras, one of them
   * outside its own ring, which is worse than the hard-edged hull it replaced.
   *
   * So the padding is not guessed: grow it until every camera is inside, by the standard
   * ray-crossing test. Four attempts at +45% each, then take what we have — a boundary that is
   * slightly tight beats a loop that never ends, and by the fourth the pad is triple the first.
   */
  const inside = (ring: [number, number][], [lat, lng]: [number, number]) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [iLat, iLng] = ring[i];
      const [jLat, jLng] = ring[j];
      if ((iLng > lng) !== (jLng > lng)
        && lat < ((jLat - iLat) * (lng - iLng)) / (jLng - iLng) + iLat) hit = !hit;
    }
    return hit;
  };

  let grown = pad;
  let ring = smooth(offset);
  for (let attempt = 0; attempt < 4 && points.some(point => !inside(ring, point)); attempt += 1) {
    grown *= 1.45;
    ring = smooth(hull.map(([lat, lng]) => {
      const dLat = lat - centroidLat;
      const dLng = (lng - centroidLng) * lngScale;
      const length = Math.hypot(dLat, dLng);
      if (length === 0) return [lat, lng] as [number, number];
      return [lat + (dLat / length) * grown, lng + (dLng / length) * grown / lngScale] as [number, number];
    }));
  }
  return ring;
}

/** Zone names come from a text field somebody types into, and they go into markup built as a
 *  string for Leaflet. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => (
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;"
  ));
}

/** The status colours this screen already uses in its table and its summary cells. */
function statusColor(cam: Camera): string {
  if (cam.status === "online") return "var(--success-400)";
  if (cam.status === "error") return "var(--danger-400)";
  if (isAwaitingFirstContact(cam)) return "var(--gray-300)";
  return "var(--warning-400)";
}

export default function CameraMapView({
  cameras, onInspect, onShowUnpositioned,
}: {
  /** The rows the table would be showing — filters applied. Split by position here. */
  cameras: Camera[];
  onInspect: (cameraId: string) => void;
  /** Narrows the list to the unsurveyed rows, which is where their coordinates get filled in. */
  onShowUnpositioned: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /* Only so the header can say which mode the reader is in — the layers themselves are swapped
     inside Leaflet's own handler, without waiting for React. */
  const [zoom, setZoom] = useState(12);

  /*
   * AS MUCH ROOM AS THE TABLE TAKES.
   *
   * It was `min(62vh, 640px)` and read as a short band under a wide toolbar (owner: 지도가 높이가
   * 너무 짧아 보이는데, 테이블일 때만큼 넓게 공간을 잡아 사용해도 될 것 같아). A viewport
   * fraction is the wrong instrument anyway: what is left for the list depends on what is ABOVE
   * it — the tabs, the summary cells and the toolbar — not on the window's total height. So it is
   * measured, the same way the table's page size is (see useFitRowsPerPage): take this card's own
   * top and fill what remains, less the shell's bottom padding.
   *
   * Remeasured on resize, unlike the page size — a map has no "choice the reader already made"
   * to protect, and a map that keeps its old height through a window resize leaves a white band.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = cardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const BOTTOM_AIR = 40;
      setHeight(Math.max(380, Math.round(window.innerHeight - top - BOTTOM_AIR)));
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); };
  }, []);

  /* Leaflet caches its container's size; grown after init it draws its tiles for the old box and
     leaves the new strip grey. */
  useEffect(() => {
    const map = mapInstanceRef.current as { invalidateSize?: () => void } | null;
    if (height !== null && map?.invalidateSize) map.invalidateSize();
  }, [height]);

  /* Which zone's cameras are ringed. Set by clicking a pill, cleared from the chip in the header
     — and it survives zooming in, which is the point: the ring is how the group stays legible
     once the pills have given way to individual dots. */
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const placed = useMemo(() => cameras.filter(hasPosition), [cameras]);
  const unplaced = cameras.length - placed.length;
  /* Keyed on the coordinates rather than the array, so a re-render from a hover or a language
     change does not yank the view back from wherever the reader has panned to — the same rule
     RedmapMap follows. */
  const positionsKey = placed.map(c => `${c.id}:${c.lat},${c.lng}`).join("|");
  const zones = useMemo(() => groupByZone(placed, t.zoneUnset), [placed, t.zoneUnset]);
  const pickedZone = selectedZone === null ? null : zones.find(z => z.key === selectedZone) ?? null;

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    let map: { remove: () => void } | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      // Leaflet refuses to initialise twice on one node, and React can hand us the same node
      // again after a fast remount. Same guard both app maps use.
      const container = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) delete container._leaflet_id;

      const instance = L.map(mapRef.current, { center: [1.3521, 103.8698], zoom: 12, zoomControl: true });
      if (cancelled) { instance.remove(); return; }
      L.tileLayer(MAP_TILE_URL, tileLayerOptions()).addTo(instance);
      instance.zoomControl.setPosition("topright");

      /* TWO LAYERS BUILT ONCE, SWAPPED ON ZOOM. Rebuilding sixty markers on every wheel notch
         drops frames and makes the map feel broken; a layer group added and removed does not. */
      const dotLayer = L.layerGroup();
      const pillLayer = L.layerGroup();

      placed.forEach(cam => {
        /* A dot, not a pin. Sixty cameras at neighbourhood zoom is a field of markers, and a
           teardrop's point lands below its own centre — which is a lie about where the camera is
           when the dots are this dense. The white ring keeps a dot's edge over dark tiles. */
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:12px;height:12px;border-radius:50%;
                   background:${statusColor(cam)};box-shadow:0 0 0 2px white, 0 1px 3px rgba(24,17,39,0.35);"></span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([cam.lat as number, cam.lng as number], { icon, title: cam.name })
          .addTo(dotLayer)
          .on("click", () => setSelected(cam.id));
      });

      zones.forEach(zone => {
        /* The count, and how many of them are not answering. One figure would make a zone of
           twelve working cameras and a zone of twelve dead ones the same pill — which is the
           thing this view exists to tell apart. Amber only when there is something to be amber
           about; a healthy zone stays plain. */
        /* ONE LINE, NOT TWO. Eighteen zones inside one city at this zoom collide, and a two-line
           pill is twice the ground to collide over — a one-camera Kallang was sitting on top of an
           eight-camera Geylang.
           
           THE BROKEN COUNT CARRIES THE SAME ICON THE 오프라인 CELL DOES, not the bare number it
           had first: an amber "2" after a total is a number whose meaning you have to be told
           (owner: 뱃지 끝에 주황색 글씨가 좀 직관적으로 모를 수 있을 것 같아서). A crossed-out
           camera is the one mark on this screen that already means "not answering", four cards
           up, so the pill borrows it rather than inventing a second vocabulary. lucide's video-off
           path, inlined because this markup is a string Leaflet renders outside React. */
        const downMark = zone.down > 0
          ? `<span style="display:inline-flex;align-items:center;gap:2px;color:var(--warning-500)">
               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                 <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/>
                 <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/>
                 <path d="m2 2 20 20"/>
               </svg>
               <span style="font-size:11px;font-weight:700">${zone.down}</span>
             </span>`
          : "";
        const pill = L.divIcon({
          className: "",
          html: `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:baseline;
                   gap:5px;background:white;border:1px solid var(--gray-200);border-radius:999px;padding:3px 9px;
                   box-shadow:0 2px 8px rgba(24,17,39,0.14);white-space:nowrap;font-family:inherit;cursor:pointer">
                   <span style="font-size:10px;font-weight:600;color:var(--gray-500)">${escapeHtml(zone.label)}</span>
                   <span style="font-size:12px;font-weight:800;color:var(--gray-900);letter-spacing:-0.3px">${t.zoneCount(zone.cams.length)}</span>
                   ${downMark}
                 </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([zone.lat, zone.lng], {
          icon: pill,
          title: zone.down > 0 ? `${zone.label} · ${t.zoneCount(zone.cams.length)} · ${t.zoneDown(zone.down)}` : `${zone.label} · ${t.zoneCount(zone.cams.length)}`,
          /* Where two pills still overlap, the bigger zone wins the top: a one-camera pill hiding
             an eight-camera one is the worse of the two mistakes. Scaled by 1000 because Leaflet
             derives a marker's z from its pixel Y — whichever sits further south wins by
             hundreds, so an offset of "6" never decides anything. */
          zIndexOffset: zone.cams.length * 1000,
        })
          .addTo(pillLayer)
          .on("click", () => {
            /* Into the zone, one notch past the breakpoint, so the pill is replaced by its own
               cameras in a single movement — and ringed, so the group it stood for is still
               readable once it is gone. */
            setSelectedZone(zone.key);
            const bounds = L.latLngBounds(zone.cams.map(c => [c.lat, c.lng] as [number, number]));
            instance.fitBounds(bounds, { padding: [56, 56], maxZoom: ZONE_FOCUS_ZOOM });
          });
      });

      const applyZoom = () => {
        const z = instance.getZoom();
        setZoom(z);
        if (z > ZONE_ZOOM_BREAKPOINT) {
          if (instance.hasLayer(pillLayer)) instance.removeLayer(pillLayer);
          if (!instance.hasLayer(dotLayer)) instance.addLayer(dotLayer);
        } else {
          if (instance.hasLayer(dotLayer)) instance.removeLayer(dotLayer);
          if (!instance.hasLayer(pillLayer)) instance.addLayer(pillLayer);
        }
      };
      instance.on("zoomend", applyZoom);

      // Frame what is actually there. A site can be a campus a few hundred metres across, ten
      // kilometres from the city centre the default view opens on.
      if (placed.length > 0) {
        const bounds = L.latLngBounds(placed.map(c => [c.lat as number, c.lng as number] as [number, number]));
        instance.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
      // After the fit, not before: which layer belongs on screen depends on the zoom the fit chose.
      applyZoom();
      map = instance;
      mapInstanceRef.current = instance;
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      else if (mapInstanceRef.current) (mapInstanceRef.current as { remove: () => void }).remove();
      mapInstanceRef.current = null;
    };
    // positionsKey, not `placed`: see the note on it above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  /*
   * THE RING, redrawn whenever the pick changes.
   *
   * Its own effect and its own layer, so picking a zone does not rebuild sixty markers. Dashed and
   * unfilled: a filled shape reads as an area the product knows the boundary of, and it does not —
   * this is "these cameras, together", nothing more.
   */
  useEffect(() => {
    const map = mapInstanceRef.current as { addLayer?: (l: unknown) => void; removeLayer?: (l: unknown) => void } | null;
    if (!map?.addLayer) return;
    let layer: unknown = null;
    let cancelled = false;
    (async () => {
      if (!pickedZone) return;
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const points = pickedZone.cams.map(c => [c.lat, c.lng] as [number, number]);
      const boundary = roundedBoundary(points);
      const style = {
        color: "var(--primary-400)", weight: 1.6, dashArray: "5 4",
        fill: false, interactive: false,
        /* Leaflet thins a polygon's points at low zoom to save work, which would undo the rounding
           the moment you zoomed out. The shape is a few dozen points; keep every one. */
        smoothFactor: 0,
      };
      layer = boundary.length >= 3
        ? L.polygon(boundary, style)
        /* One or two cameras have no polygon. A circle wide enough to hold them says the same
           thing — a ring around this group — without pretending to a shape, and it is already the
           rounded form the rest of this is working toward. 120m so a single camera's ring is
           visible at the zoom a pill click lands on. */
        : L.circle([pickedZone.lat, pickedZone.lng], { ...style, radius: Math.max(120, 120 * points.length) });
      map.addLayer?.(layer);
    })();
    return () => {
      cancelled = true;
      if (layer && map.removeLayer) map.removeLayer(layer);
    };
  }, [pickedZone, positionsKey]);

  const selectedCamera = selected === null ? null : placed.find(c => c.id === selected) ?? null;

  return (
    /* The same card the table draws, filling the same room — see the measurement above. */
    <div ref={cardRef} style={{
      backgroundColor: "white", border: BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW,
      display: "flex", flexDirection: "column", overflow: "hidden",
      // Before the measurement lands, a sensible box rather than a collapsed one — this is the
      // first paint, and a zero-height map would flash.
      height: height === null ? "560px" : `${height}px`,
    }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: BORDER, flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-600)" }}>{t.counted(placed.length, cameras.length)}</span>
        {/* WHAT THE RING IS AROUND, AND THE WAY OUT OF IT. A dashed shape with nothing naming it
            is a mark the reader has to reverse-engineer, and once the pills are gone there is
            nothing else on screen that says which zone was picked. */}
        {pickedZone && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 4px 3px 9px",
            borderRadius: "999px", border: "1px dashed var(--primary-400)", backgroundColor: "var(--primary-50)",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-400)" }}>
              {t.zonePicked(pickedZone.label, pickedZone.cams.length)}
            </span>
            <button onClick={() => setSelectedZone(null)} title={t.clearZone}
              style={{ display: "flex", padding: "2px", border: "none", background: "none", cursor: "pointer", color: "var(--primary-400)" }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {/* WHICHEVER MODE IS ON SCREEN, THE HEADER EXPLAINS THAT ONE. A status legend over a map
            of zone pills describes marks that are not being drawn, and the pills' own numbers are
            what needs explaining instead — including that zooming in changes what is drawn. */}
        {zoom <= ZONE_ZOOM_BREAKPOINT ? (
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)" }}>{t.zoomHint}</span>
        ) : (
        /* The legend is the four words the dots stand for. Four colours with no key is a puzzle,
           and the table one click away spells them out in a column. */
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {([
            { color: "var(--success-400)", label: t.connected },
            { color: "var(--warning-400)", label: t.offline },
            { color: "var(--danger-400)", label: t.error },
            { color: "var(--gray-300)", label: t.awaiting },
          ]).map(item => (
            <span key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, color: "var(--gray-500)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        )}
      </div>

        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div
            ref={mapRef}
            style={{
              // Read by .leaflet-tile-pane in globals.css, the same way MapView passes it, so an
              // installation sets the filter once through the environment for both maps.
              ["--map-tile-filter" as string]: MAP_TILE_FILTER,
              width: "100%", height: "100%",
              // The tiles arrive after Leaflet's async init; grey rather than white avoids a flash.
              backgroundColor: "var(--gray-100)",
            }}
          />

          {placed.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", pointerEvents: "none" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", textAlign: "center", maxWidth: "380px", lineHeight: 1.5 }}>{t.empty}</p>
            </div>
          )}

          {/* WHAT THE MAP CANNOT SHOW, SAID ON THE MAP. An unsurveyed camera is invisible here by
              nature, so the count sits in the corner with the way to its rows — otherwise the map
              quietly under-reports the fleet and looks complete while doing it. */}
          {unplaced > 0 && (
            <div style={{
              position: "absolute", left: "12px", bottom: "12px", zIndex: 500, maxWidth: "300px",
              backgroundColor: "white", border: BORDER, borderRadius: CARD_RADIUS, padding: "10px 12px", boxShadow: "var(--shadow-popover)",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.noPosition(unplaced)}</p>
              <p style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "3px", lineHeight: 1.45 }}>{t.noPositionWhy}</p>
              <button className="portal-btn-quiet" onClick={onShowUnpositioned}
                style={{ marginTop: "8px", padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: "var(--gray-100)", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.showThem}
              </button>
            </div>
          )}

          {/* The dot that was clicked, as a card rather than a Leaflet popup: a popup is HTML
              built as a string outside React, which is where this product's map words go to die. */}
          {selectedCamera && (
            <div style={{
              /* Clear of Leaflet's attribution strip, which sits in this same corner and has to
                 stay readable — the tile licence is a condition of using the source. */
              position: "absolute", right: "12px", bottom: "30px", zIndex: 500, width: "260px",
              backgroundColor: "white", border: BORDER, borderRadius: CARD_RADIUS, padding: "12px", boxShadow: "var(--shadow-popover)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedCamera.name}</p>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{selectedCamera.code}</p>
                </div>
                <button className="portal-icon-btn" onClick={() => setSelected(null)}
                  style={{ padding: "2px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </button>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "6px", fontSize: "11px", fontWeight: 600, color: "var(--gray-600)" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: statusColor(selectedCamera) }} />
                {selectedCamera.status === "online" ? t.connected
                  : selectedCamera.status === "error" ? t.error
                  : isAwaitingFirstContact(selectedCamera) ? t.awaiting : t.offline}
              </span>
              {selectedCamera.zone && (
                <p style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "4px" }}>{selectedCamera.zone}</p>
              )}
              <button className="portal-btn-quiet" onClick={() => onInspect(selectedCamera.id)}
                style={{ marginTop: "10px", width: "100%", padding: "6px 8px", borderRadius: "6px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.preview}
              </button>
            </div>
        )}
      </div>
    </div>
  );
}
