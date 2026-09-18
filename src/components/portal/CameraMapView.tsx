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
    counted: (drawn: number, total: number) => `${total}대 중 ${drawn}대 표시`,
  },
} as const;

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

  const placed = useMemo(() => cameras.filter(hasPosition), [cameras]);
  const unplaced = cameras.length - placed.length;
  /* Keyed on the coordinates rather than the array, so a re-render from a hover or a language
     change does not yank the view back from wherever the reader has panned to — the same rule
     RedmapMap follows. */
  const positionsKey = placed.map(c => `${c.id}:${c.lat},${c.lng}`).join("|");

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

      placed.forEach(cam => {
        /* A dot, not a pin. Seventeen districts' worth of cameras at city zoom is a field of
           markers, and a teardrop's point lands below its own centre — which is a lie about
           where the camera is when the dots are this dense. The ring is the surrounding tile
           colour so a dot over dark tiles keeps its edge. */
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:12px;height:12px;border-radius:50%;
                   background:${statusColor(cam)};box-shadow:0 0 0 2px white, 0 1px 3px rgba(24,17,39,0.35);"></span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([cam.lat as number, cam.lng as number], { icon, title: cam.name })
          .addTo(instance)
          .on("click", () => setSelected(cam.id));
      });

      // Frame what is actually there. A site can be a campus a few hundred metres across, ten
      // kilometres from the city centre the default view opens on.
      if (placed.length > 0) {
        const bounds = L.latLngBounds(placed.map(c => [c.lat as number, c.lng as number] as [number, number]));
        instance.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
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

  const selectedCamera = selected === null ? null : placed.find(c => c.id === selected) ?? null;

  return (
    /* The same card the table draws, at a height that leaves the toolbar and the summary cells
       above it on screen — a map shorter than this cannot show a city, and a taller one pushes
       its own legend off the bottom. */
    <div style={{
      backgroundColor: "white", border: BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW,
      display: "flex", flexDirection: "column", overflow: "hidden", height: "min(62vh, 640px)", minHeight: "380px",
    }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: BORDER, flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-600)" }}>{t.counted(placed.length, cameras.length)}</span>
        <span style={{ flex: 1 }} />
        {/* The legend is the four words the dots stand for. Four colours with no key is a puzzle,
            and the table one click away spells them out in a column. */}
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
