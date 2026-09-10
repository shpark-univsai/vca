"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_TILE_URL, MAP_TILE_FILTER, tileLayerOptions } from "@/lib/mapTiles";
import { useLanguage } from "@/lib/i18n";

// The one word this map draws itself, on the card marking the most recent sighting. Inline rather
// than in a file dictionary: the markup is built as an HTML string for Leaflet, so there is no
// component here to hold a `t`.
const LAST_SEEN = { en: "LAST SEEN", ko: "마지막 검출" } as const;

export interface TrackingHit {
  lat: number;
  lng: number;
  mapLabel: string;
  date: string;
  time: string;
  isAlert: boolean;
  // Both optional — when omitted, every hit is treated as one trail (today's only case: one
  // target's full path). Redmap's person-filter chips can select more than one distinct person's
  // hits at once; those get their own groupId/color so each draws as its own separate trail
  // instead of being stitched into one connected line between unrelated people.
  color?: string;
  groupId?: string;
  // A sighting the operator has pulled out of the trace (see Redmap's per-node X button) still
  // occupies its slot in `hits` — dropping it from the array would shift every index after it,
  // and `activeNode`/`onMarkerClick` both mean "index into `hits`" (see the comment on
  // `visibleGroupIds` below). Marking it hidden instead lets the route/markers skip over it while
  // every other hit keeps the same index it always had.
  hidden?: boolean;
}

// Speech-bubble pointer for a marker's side-tooltip: a slightly larger border-colored triangle
// behind a fill-colored one (1px smaller on each side), so only a thin outline ring shows at the
// tip. Pass the same value for fillColor/borderColor for a solid, borderless arrow.
function bubbleTailHtml(centerY: number, fillColor: string, borderColor: string) {
  return `<div style="position:absolute;left:-9px;top:${centerY - 8}px;width:0;height:0;
        border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:9px solid ${borderColor};"></div>
     <div style="position:absolute;left:-8px;top:${centerY - 7}px;width:0;height:0;
        border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:8px solid ${fillColor};"></div>`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


interface RedmapMapProps {
  hits: TrackingHit[];
  trackingActive: boolean;
  activeNode: number | null;
  onMarkerClick: (index: number) => void;
  // Which person-groups (TrackingHit.groupId) actually draw a trail — lets `hits` stay the full,
  // index-stable list (so `activeNode`/`onMarkerClick` indices keep meaning "index into `hits`")
  // while Redmap's person-filter chips control which of those trails are currently visible.
  // Omitted/null draws every group, same as if this prop didn't exist.
  visibleGroupIds?: string[] | null;
}

export default function RedmapMap({
  hits,
  trackingActive,
  activeNode,
  onMarkerClick,
  visibleGroupIds = null,
}: RedmapMapProps) {
  const [lang] = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const overlayLayersRef = useRef<unknown[]>([]);
  const [zoom, setZoom] = useState(12);
  // Flips once Leaflet's async init resolves — the overlay-drawing effect below reads
  // mapInstanceRef synchronously and bails if it's still null, so without this the landing-state
  // status pills silently never draw (nothing else changes to re-trigger that effect afterward).
  const [mapReady, setMapReady] = useState(false);

  // ── Map init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const container = mapRef.current as any;
      if (container._leaflet_id) delete container._leaflet_id;

      const map = L.map(mapRef.current!, {
        center: [1.3521, 103.8698],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });

      if (cancelled) { map.remove(); return; }

      L.tileLayer(MAP_TILE_URL, tileLayerOptions()).addTo(map);

      map.zoomControl.setPosition("topright");
      map.on("zoomend", () => setZoom(map.getZoom()));
      mapInstanceRef.current = map;
      setZoom(map.getZoom());
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── Frame the sightings ───────────────────────────────────────
  // The view used to open on a fixed city centre at zoom 12 and stay there. A site's cameras can
  // be a school campus a few hundred metres across, ten kilometres from that centre — its trail
  // drew correctly and sat off the edge of the screen. Fits to wherever the hits actually are;
  // with no hits the default view is left alone.
  //
  // Keyed on the coordinates rather than the `hits` array so an unrelated re-render (a hover, a
  // language change) doesn't yank the map back from wherever the operator has panned to.
  const positionsKey = hits.filter(h => !h.hidden).map(h => `${h.lat},${h.lng}`).join("|");
  useEffect(() => {
    if (!mapReady || !positionsKey) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;
    const coords = positionsKey.split("|")
      .map(pair => pair.split(",").map(Number) as [number, number]);
    import("leaflet").then(({ default: L }) => {
      // maxZoom: two sightings from the same camera share one coordinate, and fitting a
      // zero-area bounds would otherwise zoom to the tile server's limit on a single point.
      map.fitBounds(L.latLngBounds(coords), { padding: [80, 80], maxZoom: 16 });
    });
  }, [positionsKey, mapReady]);

  // ── Draw overlays ─────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map) return;

    overlayLayersRef.current.forEach((l) => {
      try { (l as { remove: () => void }).remove(); } catch (_) { /* noop */ }
    });
    overlayLayersRef.current = [];

    import("leaflet").then(({ default: L }) => {

      if (!trackingActive) return;

      // ── TRACKING VIEW ─────────────────────────────────────────
      type RouteNode = { lat: number; lng: number; label: string; date: string; time: string; color: string; hitIndex: number };

      // Normally every hit belongs to one trail (a single target's full path). Redmap's
      // person-filter chips can have more than one distinct person selected at once (see
      // TrackingHit.groupId) — those draw as separate trails, each in its own colour, instead of
      // being stitched into one connected line between unrelated people.
      const allGroupIds = Array.from(new Set(hits.map((h) => h.groupId ?? "__default__")));
      const groupIds = visibleGroupIds ? allGroupIds.filter((gid) => visibleGroupIds.includes(gid)) : allGroupIds;

      // Below this zoom level, nearby nodes crowd together — decluttering kicks in:
      // non-last nodes drop their label card (circle only), and the last node's
      // card moves underneath its circle instead of beside it, clearing the cluster.
      const ZOOM_DECLUTTER_THRESHOLD = 12;
      const isZoomedOut = zoom < ZOOM_DECLUTTER_THRESHOLD;

      groupIds.forEach((groupId) => {
        const groupHits = hits
          .map((h, hitIndex) => ({ h, hitIndex }))
          .filter(({ h }) => (h.groupId ?? "__default__") === groupId && !h.hidden);
        if (groupHits.length === 0) return;
        const color = groupHits[0].h.color ?? "var(--primary-400)";

        // Sightings only. A fixed TRACKING_ORIGIN was prepended to single-target routes — the same
        // hardcoded place and time for every search — and drew as an ordinary node, so a route
        // appeared to begin at a camera that had never seen anyone.
        const nodes: RouteNode[] = groupHits.map(({ h, hitIndex }) => ({
          lat: h.lat, lng: h.lng, label: h.mapLabel, date: h.date, time: h.time, color, hitIndex,
        }));

        const line = L.polyline(nodes.map((n) => [n.lat, n.lng]), {
          color,
          weight: 2,
          opacity: 1,
          lineJoin: "round",
          className: "vca-route-line",
        }).addTo(map);
        overlayLayersRef.current.push(line);

        // Single arrowhead near the end of the line, pointing into the most recent node.
        // Placed at 35% along the final segment (not the midpoint) so it clears the
        // destination circle's glow halo instead of hiding underneath it.
        if (nodes.length >= 2) {
          const a = nodes[nodes.length - 2];
          const b = nodes[nodes.length - 1];
          const t = 0.35;
          const lat = a.lat + (b.lat - a.lat) * t;
          const lng = a.lng + (b.lng - a.lng) * t;
          const bearing = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
          const arrowIcon = L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;transform:rotate(${bearing}deg)">
                     <path d="M7 1L12.5 12H1.5Z" fill="${color}"/>
                   </svg>`,
            iconSize: [14, 14], iconAnchor: [7, 7], className: "",
          });
          const arrowMarker = L.marker([lat, lng], { icon: arrowIcon, interactive: false }).addTo(map);
          // Below every node card. Cards are offset by index*100, so the first node's card sits at
          // 0 — an arrow at 50 drew on top of it, through the label and the timestamp.
          arrowMarker.setZIndexOffset(-1000);
          overlayLayersRef.current.push(arrowMarker);
        }

        nodes.forEach((node, i) => {
          const num = String(i + 1).padStart(2, "0");
          const isLast = i === nodes.length - 1;
          const hitIndex = node.hitIndex;
          const isActive = hitIndex >= 0 && activeNode === hitIndex;
          const size = isLast ? 44 : 36;
          const showCard = isLast || !isZoomedOut;
          const cardBelow = isLast && isZoomedOut;

          const circleHtml = isLast
            ? `<div style="width:${size}px;height:${size}px;aspect-ratio:1/1;flex:none;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:14px;font-weight:700;color:white;box-shadow:0 0 0 10px ${hexToRgba(color, 0.15)}">${num}</div>`
            : `<div style="width:${size}px;height:${size}px;aspect-ratio:1/1;flex:none;border-radius:50%;background:white;border:2px solid ${color};display:flex;align-items:center;justify-content:center;
                          font-family:'SUIT',sans-serif;font-size:13px;font-weight:700;color:${color};
                          transform:${isActive ? "scale(1.15)" : "scale(1)"};transition:transform 0.2s;box-shadow:0 2px 6px rgba(14, 22, 42,0.12)">${num}</div>`;

          if (!showCard) {
            const icon = L.divIcon({ html: circleHtml, iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: "" });
            const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
            marker.setZIndexOffset(i * 100);
            if (hitIndex >= 0) marker.on("click", () => onMarkerClick(hitIndex));
            overlayLayersRef.current.push(marker);
            return;
          }

          // speech-bubble tail: points at the exact geo-anchored circle center (size/2 from the icon's
          // top-left corner — true regardless of the card's own height, since both start flush at y:0).
          const tailCenterY = size / 2;
          const tailHtml = cardBelow
            ? `<div style="position:absolute;left:${size / 2 - 7}px;top:-7px;width:14px;height:14px;
                  background:${color};border-radius:3px;transform:rotate(45deg);"></div>`
            : isLast
              ? bubbleTailHtml(tailCenterY, color, color) // solid arrow, group color, for the "LAST SEEN" card
              : bubbleTailHtml(tailCenterY, "white", "var(--gray-200)");

          const cardHtml = isLast
            ? `<div class="vca-pin-card" style="position:relative;font-family:'SUIT',sans-serif;filter:drop-shadow(0 4px 10px ${hexToRgba(color, 0.25)})">
                 ${tailHtml}
                 <div style="position:relative;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1.5px solid ${color}">
                   <div style="background:${color};color:white;font-size:11px;font-weight:800;padding:6px 12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
                     <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M6 0.5L1.5 6.5H5L4.5 10.5L9.5 4.5H6L6 0.5Z" fill="white"/></svg>
                     ${LAST_SEEN[lang]}
                   </div>
                   <div style="background:white;padding:8px 12px 10px;white-space:nowrap">
                     <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${node.label}</div>
                     <div style="font-size:13px;color:var(--gray-500);margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${node.date.slice(5)} ${node.time}</div>
                   </div>
                 </div>
               </div>`
            : `<div class="vca-pin-card" style="position:relative;background:white;border:1px solid var(--gray-200);border-radius:16px;padding:10px 14px;white-space:nowrap;
                          font-family:'SUIT',sans-serif;box-shadow:0 4px 10px rgba(14, 22, 42,0.08);cursor:${hitIndex >= 0 ? "pointer" : "default"}">
                 ${tailHtml}
                 <div style="font-size:15px;font-weight:800;color:var(--gray-900)">${node.label}</div>
                 <div style="font-size:13px;color:var(--gray-500);margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${node.date.slice(5)} ${node.time}</div>
               </div>`;

          const html = cardBelow
            ? `<div style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:10px">
                 ${circleHtml}
                 ${cardHtml}
               </div>`
            : `<div style="display:inline-flex;align-items:flex-start;gap:10px">
                 ${circleHtml}
                 ${cardHtml}
               </div>`;
          // The circle is always first in DOM order and flush to the top-left corner (align-items:flex-start
          // for the "below" layout), so its center sits at (size/2, size/2) regardless of card direction.
          const icon = L.divIcon({ html, iconSize: [1, 1], iconAnchor: [size / 2, size / 2], className: "" });
          const marker = L.marker([node.lat, node.lng], { icon }).addTo(map);
          marker.setZIndexOffset(i * 100);
          if (hitIndex >= 0) marker.on("click", () => onMarkerClick(hitIndex));
          overlayLayersRef.current.push(marker);
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingActive, activeNode, hits, zoom, mapReady, visibleGroupIds, lang]);

  return (
    <>
      {/* .vca-route-line lives in globals.css. It used to be declared here TOO, with a different
          dash pattern (10 8 / -18) and the same class and @keyframes names as the global one
          (7 6 / -13) — so on this page the two fought, and whichever won per property could leave
          a 13px offset animating an 18px dash cycle. That mismatch restarts the loop mid-dash,
          which reads as the line blinking or stretching rather than flowing. One definition only. */}
      <div
        ref={mapRef}
        style={{
          // Read by .leaflet-tile-pane in globals.css — see MapView for why it is set here.
          ["--map-tile-filter" as string]: MAP_TILE_FILTER,
          width: "100%", height: "100%", position: "relative", backgroundColor: "var(--gray-100)",
        }}
      />
    </>
  );
}
