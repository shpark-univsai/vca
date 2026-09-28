"use client";

import { Lasso, MousePointerClick } from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_TILE_URL, MAP_TILE_FILTER, tileLayerOptions } from "@/lib/mapTiles";
import { hasPosition, isAwaitingFirstContact, type Camera } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, CARD_RADIUS, PANEL_SHADOW, PICKED_FILL, PICKED_LINE } from "./PortalShared";

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
    pickStart: "Pick cameras",
    pickStop: "Done picking",
    pickHint: (n: number) => n === 0
      /* The zone pill half of this sentence was deleted with the pills. What the dots do is all
         that is left to say, and the bar that makes the group is outside this component. */
      ? "Click a dot to pick that camera. The bar at the bottom makes the group."
      : `${n} picked. The bar at the bottom makes the group.`,
    lasso: "Draw an area",
    /* WHAT THE MODE CANNOT SHOW OF ITSELF goes on the hover, the same division the 「지도에 없는
       N대」 chip below settled on: the crosshair and the pressed button already say the mode is
       on, so only the two things no mark can say are written down — that Alt takes cameras out
       again, and that Shift saves the trip to the button. */
    lassoHow: "Drag a line around the cameras to add them. Hold Alt while dragging to take the enclosed ones out instead. Shift and drag does the same without this button.",
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
    pickStart: "카메라 고르기",
    pickStop: "고르기 끝",
    pickHint: (n: number) => n === 0
      ? "점을 누르면 그 카메라가 들어갑니다. 묶는 것은 아래 막대에서 합니다."
      : `${n}대 골랐습니다. 묶는 것은 아래 막대에서 합니다.`,
    lasso: "영역으로 고르기",
    lassoHow: "카메라들을 둘러 끌면 선택에 들어갑니다. Alt를 누른 채 끌면 감싼 카메라가 선택에서 빠집니다. Shift를 누르고 끌면 이 버튼 없이도 같은 일이 됩니다.",
    preview: "스트림 미리보기",
    empty: "이 프로젝트에는 좌표가 등록된 카메라가 아직 없어서 그릴 것이 없습니다.",
    counted: (drawn: number, total: number) => `${total}대 중 ${drawn}대 표시`,
  },
} as const;

/**
 * A CAMERA'S DOT, AND WHETHER IT IS ONE OF THE PICKED ONES.
 *
 * Picking a zone used to draw a boundary around its cameras — a convex hull, then an offset and
 * rounded version of one. Both were abandoned (owner, 2026-09-18: 이상하게 되는뎅.. 이거 라인
 * 지우고 그냥 동그라미들을 선택된 상태라는 걸 표시해주는 걸로). The reason they kept looking
 * wrong is not the smoothing: three or four points have no shape, so ANY outline drawn through
 * them is a shape the product invented — a kite over Ang Mo Kio that says nothing true about
 * where the zone begins. The register knows which cameras are in a zone; it does not know the
 * zone's border, and drawing one claims it does.
 *
 * So the group is shown on the members instead: the picked zone's dots take a ring, the way a
 * focus ring marks a selection anywhere else. Nothing is claimed beyond "these are the ones", and
 * the header's chip says which zone that is.
 *
 * The other dots are left alone rather than dimmed. Dimming would hide the thing this map is for
 * — an offline camera in a neighbouring zone is still the most important dot on screen.
 */
function dotHtml(fill: string, selected: boolean, line: string | null): string {
  /* The ring is drawn with the same box-shadow the dot already uses for its white edge, so a
     selected dot is the unselected one plus two more rings rather than a different object: white
     at 2px keeps the edge over dark tiles, then primary at 4px, then white again so the ring
     itself has an edge over a dark street. */
  const rings = selected
    ? "0 0 0 2px white, 0 0 0 4px var(--primary-400), 0 0 0 5px rgba(255,255,255,0.9), 0 1px 3px rgba(24,17,39,0.35)"
    : "0 0 0 2px white, 0 1px 3px rgba(24,17,39,0.35)";
  /* border-box so a dot that takes the shared picked line is still the same 12px circle as its
     neighbours — the line is the picked vocabulary, not a size change. */
  const edge = line === null ? "" : `border:${line};box-sizing:border-box;`;
  return `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${fill};${edge}box-shadow:${rings};"></span>`;
}

/**
 * WHAT A DOT'S COLOUR IS ALLOWED TO MEAN, WHICH DEPENDS ON WHO IS ASKING.
 *
 * This map has two callers with two different questions, and the answer to 「연결상태도 계속
 * 보여줘야 할까?」 (owner, 2026-09-22) is different for each. On 입력 소스 the screen's whole
 * subject is whether the cameras are up, so the status colour and the key that decodes it earn
 * their place and nothing changes there. In the PICKER the only question is in or out, and a dot
 * that is one of four status colours AND has to report whether it is selected makes one mark
 * carry two colour codes at once — the same one-signal-too-many the owner rejected on the chips
 * earlier the same day.
 *
 * So while picking, colour says exactly one thing. Every unpicked dot is the same neutral grey
 * and a picked one takes the shared picked pair (PICKED_FILL inside PICKED_LINE) that a picked
 * box wears everywhere else in the portal, on top of the primary ring it already had.
 *
 * THE TRADE, ACCEPTED: while grouping you can no longer notice that a camera has never connected.
 * A group is about place, and the register that answers the other question is one click away.
 */
function dotFace(cam: Camera, selected: boolean, picking: boolean, tint?: string | null): [string, string | null] {
  if (picking) return selected ? [PICKED_FILL, PICKED_LINE] : ["var(--gray-400)", null];
  /* A caller can say what a dot MEANS here — the camera-group overview paints by group instead of
     by status, because on that screen "which group is this in" is the only question being asked.
     Falls through to status when the caller says nothing, which is every other use. */
  return [tint ?? statusColor(cam), null];
}

/** How far the pointer has to travel before a drag is a lasso and not a click on a dot. Measured
 *  against the thing it protects: a dot is 12px across, so a press that wanders two or three
 *  pixels is somebody aiming at one, not somebody drawing a shape. */
const LASSO_MIN_TRAVEL_PX = 6;

/**
 * IS THIS POINT INSIDE THE SHAPE THAT WAS DRAWN — ray casting, no dependency.
 *
 * A horizontal ray from the point crosses the closed path an odd number of times exactly when the
 * point is inside it, which holds for the self-crossing, non-convex shapes a hand actually draws
 * around a road. Both the shape and the point are in container pixels, so this runs after
 * latLngToContainerPoint and never has to reason about projections.
 */
function enclosedBy(shape: { x: number; y: number }[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i], b = shape[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The two things a lasso needs from Leaflet. Declared here because Leaflet is imported
 *  dynamically, so its types are not in scope at the top of this file. */
type LassoMap = {
  dragging?: { enable: () => void; disable: () => void };
  latLngToContainerPoint: (latlng: [number, number]) => { x: number; y: number };
};

/** Zone names come from a text field somebody types into, and they go into markup built as a
 *  string for Leaflet. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => (
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;"
  ));
}

/*
 * THE MAP IS THE ONE SURFACE WHERE COLOUR IS THE ONLY CHANNEL, and it is a documented exception to
 * the four tones in PortalShared rather than an oversight.
 *
 * In a table the words 「오프라인」 and 「연결 거부」 separate two faults and the colour only has to
 * say "a fault"; both are amber there. A dot on a map carries no word, so merging them would take
 * away the only thing that lets an operator see, at a glance, that the dead cameras on the north
 * road are refusing credentials while the ones by the river are unreachable — which is the triage
 * this view exists for. The legend under the map names all four on the spot.
 *
 * The two ends DO follow the tones: a camera that is fine is quiet (it is most of the dots, and a
 * field of green says nothing), and one awaiting its first contact is waiting on an installer.
 */
function statusColor(cam: Camera): string {
  if (cam.status === "online") return "var(--gray-300)";
  if (cam.status === "error") return "var(--danger-400)";
  if (isAwaitingFirstContact(cam)) return "var(--info-500)";
  return "var(--warning-400)";
}

export default function CameraMapView({
  cameras, onInspect, onShowUnpositioned, selectedIds, onToggleSelect, alwaysPicking, fill, overlay, tintOf,
}: {
  /** The rows the table would be showing — filters applied. Split by position here. */
  cameras: Camera[];
  /** Opens the camera's own panel. Absent inside a group editor, which has nothing to open. */
  onInspect?: (cameraId: string) => void;
  /** Narrows the list to the unsurveyed rows, which is where their coordinates get filled in.
   *  Absent where there is no list to narrow — the notice then just states the count. */
  onShowUnpositioned?: () => void;
  /**
   * PICKING IS THE WHOLE POINT HERE, SO IT IS NOT A MODE (owner, 2026-09-21: 입력소스 화면에
   * 넣었던 지도를 여기 카메라 그룹에도 넣어서 지도에서 그룹핑할수있게해줘).
   *
   * On Input Sources the same map does two jobs — look at a camera, or add it to a selection — so
   * a mode button decides which, and clicking a dot outside picking opens the camera. Inside a
   * group editor there is only one job, and leaving the button there would mean a dot press that
   * does nothing until somebody finds the toggle first.
   */
  alwaysPicking?: boolean;
  /**
   * Take the height from whatever box this is put in, instead of measuring the window.
   *
   * The measurement below exists for Input Sources, where this card IS the page's lower half and
   * should fill the window. Inside the camera-group editor it is one column of a panel, and the
   * same measurement made it TALLER THAN ITS CARD — the tiles and the "지도에 없는 N대" notice
   * painted outside the panel's rounded edge (owner: 지도가 넘쳐). A container-driven height is
   * the honest answer there: the parent says how tall, this draws to that.
   */
  fill?: boolean;
  /**
   * THE SAME SELECTION THE TABLE HOLDS (owner, 2026-09-21: 카메라 그룹을 검색하거나 지도에서
   * 선택해서 그룹핑할수있게).
   *
   * One set, shared: search and tick twenty rows in the table, switch to the map, add the two by
   * the gate by clicking them, and the bulk bar above — which is outside this view and already
   * counts the same set — makes the group out of all twenty-two. A second selection living in
   * here would be a second answer to "what am I about to group".
   */
  selectedIds: Set<string>;
  onToggleSelect: (cameraId: string) => void;
  /**
   * SOMETHING THE CALLER WANTS DRAWN ON THE MAP, not above the card.
   *
   * The group editor's selected-camera chips float over the map (owner, 2026-09-22: 지도 위로 뜨는
   * 게 더 좋을 것 같아), and the caller cannot place them from outside: MEASURED, a box positioned
   * against the wrapper this card sits in landed 37px too high, because this card is a header
   * strip plus the map and the wrapper is both. A percentage of the map's area — which is how the
   * cap on such an overlay is written — needs the map's own box as its containing block, and this
   * is the only place that box exists.
   */
  overlay?: React.ReactNode;
  /**
   * What colour this camera's dot should be, when the caller has something better to say than
   * status. Returning null leaves the dot on status colour.
   *
   * Used by the camera-group overview: the dots ARE the answer there, so painting them by group
   * is the screen. Ignored while picking — a picked dot has to read as picked.
   */
  tintOf?: (cameraId: string) => string | null;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];

  /* Clicking a dot means one of two things, so the map says which mode it is in rather than
     guessing from a modifier key nobody would find. Held in a ref as well as state: the marker's
     click handler is attached once when the layer is built (rebuilding sixty markers per render
     is what the two-layer note below is avoiding), so it would close over the first value. */
  /** A stable key for the selection, because the Set is a new object on every render. */
  const selectionKey = [...selectedIds].sort().join(",");
  const [pickingMode, setPickingMode] = useState(false);
  const picking = alwaysPicking || pickingMode;
  const pickingRef = useRef(picking);
  useEffect(() => { pickingRef.current = picking; }, [picking]);
  const onToggleRef = useRef(onToggleSelect);
  useEffect(() => { onToggleRef.current = onToggleSelect; }, [onToggleSelect]);
  /* A ref for the same reason as onToggleSelect's: the marker effects are keyed on positions and
     the selection, and a new function identity every render must not rebuild sixty markers. */
  const tintRef = useRef(tintOf);
  useEffect(() => { tintRef.current = tintOf; }, [tintOf]);
  /* The current selection, for the same reason: a pill's handler is attached once, and adding a
     zone has to skip the cameras already picked or the toggle would take them back out. */
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  /*
   * DRAWING AN AREA IS ITS OWN MODE, BECAUSE A PLAIN DRAG ON A MAP MEANS PAN.
   *
   * The owner asked for it as 「마우스로 라인 그어가면서 그룹 지을 수 있는 거」, and freehand is
   * the right shape rather than a rectangle: cameras follow roads, so a box around a curved
   * street either misses half of it or catches the next street too, and the reader ends up making
   * three boxes for one road.
   *
   * What it cannot do is steal the drag. Pan-on-drag is what every map in the world does, and a
   * product that quietly reassigns it breaks the one gesture the reader arrived knowing. So there
   * are two ways in and both are deliberate: this button, which stays pressed and turns the
   * cursor into a crosshair so the map says which mode it is in, and Shift+drag for the people
   * who already expect a modifier to mean "select a region".
   */
  const [lassoArmed, setLassoArmed] = useState(false);
  /* Picking off means lasso off, and it is DERIVED rather than stored: on 입력 소스 the reader can
     leave the pick mode with the lasso still armed, and a lasso that selects while a dot press
     does not would be two answers to what a press means. Kept as state it would need an effect to
     put it back, which is a render's worth of screen showing a mode that is already over. */
  const lassoMode = picking && lassoArmed;
  const lassoModeRef = useRef(lassoMode);
  useEffect(() => { lassoModeRef.current = lassoMode; }, [lassoMode]);
  /** The gesture in flight, in container pixels. Null between gestures. */
  const [lassoShape, setLassoShape] = useState<{ x: number; y: number }[] | null>(null);
  /** Alt/Option held: the shape takes cameras OUT instead of adding them, so the mark has to say
   *  so while it is being drawn — otherwise the reader learns what it did after it happened. */
  const [lassoRemoves, setLassoRemoves] = useState(false);
  /** Set by a gesture that really enclosed something, and read once by the marker click handler.
   *  A loop that happens to end back on the dot it started from would otherwise fire that dot's
   *  click too and undo one of the cameras the lasso just added. */
  const lassoJustRanRef = useRef(false);
  /** The drawable cameras, for the release handler. It is attached once, so it cannot close over
   *  a render's array. */
  const placedRef = useRef<Camera[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  /** Every drawn dot, by camera id, so the picked zone's can be re-marked in place. Typed loosely
   *  for the same reason mapInstanceRef is: Leaflet is imported dynamically, so its types are not
   *  in scope where this ref is declared. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
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

  /* THE BOX CAN CHANGE WITHOUT THE WINDOW CHANGING. In the group editor this card shares a row
     with a table that narrows and a list that comes and goes, so its width moves while `height`
     stays put — and Leaflet, told nothing, keeps drawing for the old width. Watching the element
     itself covers every cause at once, including the two that have no event: a flex sibling
     appearing and a panel opening. */
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const map = mapInstanceRef.current as { invalidateSize?: () => void } | null;
      map?.invalidateSize?.();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Which zone's cameras are ringed. Set by clicking a pill, cleared from the chip in the header
     — and it survives zooming in, which is the point: the ring is how the group stays legible
     once the pills have given way to individual dots. */
  const placed = useMemo(() => cameras.filter(hasPosition), [cameras]);
  const unplaced = cameras.length - placed.length;
  /* Keyed on the coordinates rather than the array, so a re-render from a hover or a language
     change does not yank the view back from wherever the reader has panned to — the same rule
     RedmapMap follows. */
  const positionsKey = placed.map(c => `${c.id}:${c.lat},${c.lng}`).join("|");
  useEffect(() => { placedRef.current = placed; }, [placed]);

  /*
   * WHILE THE MODE IS ON, LEAFLET MUST NOT PAN AND THE CURSOR MUST SAY SO.
   *
   * dragging.disable() is not optional: without it the map slides under the shape being drawn and
   * the container pixels the shape was collected in stop matching the ones the cameras are at.
   * Shift+drag also had to be taken off Leaflet — see boxZoom in the map's options.
   *
   * The crosshair comes from Leaflet's own `leaflet-crosshair` class rather than a rule of ours,
   * because the cursor has to change on the panes and the markers too, and those already carry
   * `leaflet-interactive`. One class covers all three; an inline cursor on the container covers
   * none of them.
   */
  useEffect(() => {
    const host = mapRef.current;
    const map = mapInstanceRef.current as LassoMap | null;
    if (!host) return;
    if (lassoMode) { host.classList.add("leaflet-crosshair"); map?.dragging?.disable(); }
    else { host.classList.remove("leaflet-crosshair"); map?.dragging?.enable(); }
  }, [lassoMode]);

  /*
   * THE GESTURE ITSELF, ON THE MAP'S OWN NODE RATHER THAN ON AN OVERLAY THAT COVERS IT.
   *
   * An overlay would have been simpler to draw on, and it was the first shape this took — but an
   * overlay that swallows the pointer also swallows the dot clicks, and then every short press
   * has to be re-implemented as a hit test against the markers. Listening on the container keeps
   * Leaflet's own click path intact, which is what makes "a two-pixel drag is still a click"
   * true rather than re-built: below the travel threshold this handler does nothing at all and
   * the marker's existing click handler runs.
   *
   * pointerdown, not mousedown: it fires first, so disabling the drag handler here lands before
   * Leaflet's own mousedown listener would have started a pan.
   */
  useEffect(() => {
    const host = mapRef.current;
    if (!host) return;

    let shape: { x: number; y: number }[] | null = null;
    let travel = 0;
    let removes = false;

    const at = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    const onMove = (e: PointerEvent) => {
      if (shape === null) return;
      const p = at(e);
      /* Distance from where the finger went down, not the length of the wiggle: an accumulated
         path length creeps past any threshold during a slow press that never actually moved. */
      const dx = p.x - shape[0].x, dy = p.y - shape[0].y;
      travel = Math.max(travel, Math.sqrt(dx * dx + dy * dy));
      /* Alt can be taken up or put down mid-drag, and the reader should see the shape change its
         mind with them rather than find out on release. */
      if (e.altKey !== removes) { removes = e.altKey; setLassoRemoves(removes); }
      shape = [...shape, p];
      setLassoShape(shape);
    };

    const onUp = () => {
      finish();
      const drawn = shape;
      shape = null;
      setLassoShape(null);
      const map = mapInstanceRef.current as LassoMap | null;
      /* Panning comes back unless the mode itself is holding it off. */
      if (!lassoModeRef.current) map?.dragging?.enable();
      if (drawn === null || drawn.length < 3 || travel < LASSO_MIN_TRAVEL_PX) return;

      /* Only the drawable cameras can be enclosed. The unsurveyed ones are not on this map at all
         — the 「지도에 없는 N대」 chip is where they are accounted for — so a shape drawn over the
         whole city must leave them exactly as they were. */
      const enclosed = map === null ? [] : placedRef.current.filter(cam => {
        const pt = map.latLngToContainerPoint([cam.lat as number, cam.lng as number]);
        return enclosedBy(drawn, pt.x, pt.y);
      });
      /* A UNION, NEVER A REPLACEMENT. The selection is assembled from several passes — some rows
         ticked in the table, a zone taken whole, then two more by hand — so a shape that cleared
         what was already picked would make every lasso the last word. Alt is the way back out.
         Only the cameras whose state actually changes are toggled, so a shape drawn over ground
         that is already picked is a no-op rather than a flip. */
      const current = selectedIdsRef.current;
      const changing = enclosed.filter(cam => current.has(cam.id) === removes);
      changing.forEach(cam => onToggleRef.current(cam.id));
      if (changing.length > 0) {
        lassoJustRanRef.current = true;
        /* Cleared on the next turn of the loop, after the browser has dispatched whatever click
           this release produced. Left set, it would eat the reader's next real dot press. */
        setTimeout(() => { lassoJustRanRef.current = false; }, 0);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!lassoModeRef.current && !e.shiftKey) return;
      const map = mapInstanceRef.current as LassoMap | null;
      if (map === null) return;
      map.dragging?.disable();
      shape = [at(e)];
      travel = 0;
      removes = e.altKey;
      setLassoRemoves(removes);
      setLassoShape(shape);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };

    host.addEventListener("pointerdown", onDown);
    return () => { host.removeEventListener("pointerdown", onDown); finish(); };
  }, []);

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

      /* boxZoom off because Shift+drag is the lasso's shortcut now, and Leaflet's own Shift+drag
         is a zoom-to-box. Two gestures on one chord means the reader gets whichever one wins. */
      const instance = L.map(mapRef.current, { center: [1.3521, 103.8698], zoom: 12, zoomControl: true, boxZoom: false });
      if (cancelled) { instance.remove(); return; }
      L.tileLayer(MAP_TILE_URL, tileLayerOptions()).addTo(instance);
      instance.zoomControl.setPosition("topright");

      /* TWO LAYERS BUILT ONCE, SWAPPED ON ZOOM. Rebuilding sixty markers on every wheel notch
         drops frames and makes the map feel broken; a layer group added and removed does not. */
      const dotLayer = L.layerGroup();

      markersRef.current.clear();
      placed.forEach(cam => {
        /* A dot, not a pin. Sixty cameras at neighbourhood zoom is a field of markers, and a
           teardrop's point lands below its own centre — which is a lie about where the camera is
           when the dots are this dense. */
        /* BUILT WITH THE SELECTION IT ALREADY HAS, not blank. The ring pass below cannot do it on
           first paint: this build is async (it awaits the Leaflet import), so that effect has
           already run and returned against an empty marker map, and neither of its keys changes
           afterwards. Opening a group of three therefore drew three unmarked dots until the
           reader touched something. Harmless while the dots carried status colour; since they
           carry nothing but picked-or-not it would be a group that cannot be read at all. */
        const [fill, line] = dotFace(cam, selectedIdsRef.current.has(cam.id), !!alwaysPicking, tintRef.current?.(cam.id));
        const icon = L.divIcon({
          className: "",
          html: dotHtml(fill, selectedIdsRef.current.has(cam.id), line),
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const marker = L.marker([cam.lat as number, cam.lng as number], { icon, title: cam.name })
          .addTo(dotLayer)
          .on("click", () => {
            /* A lasso that closed on the dot it opened on gets one click out of the browser as
               well, and honouring it would take back one of the cameras the shape just added. */
            if (lassoJustRanRef.current) { lassoJustRanRef.current = false; return; }
            if (pickingRef.current) onToggleRef.current(cam.id);
            else setSelected(cam.id);
          });
        /* Kept so picking a zone can re-mark these dots without rebuilding the map. Rebuilding
           would re-run the fitBounds below and fight the zoom the pill click just performed. */
        markersRef.current.set(cam.id, marker);
      });

      /*
       * NO ZONE PILLS ANY MORE (owner, 2026-09-22: 지도에 알약으로 보여지는것들을 다 지우고
       * 확대하면 보였던 점들만 보여줄까?).
       *
       * The pill layer drew one rounded label per zone below zoom 14, and it was the source of the
       * defect this file spent the day on: 18 zones inside one city collided 29 times at 629x372
       * and 29 times at 629x290 — the scale, not the box — so no amount of height fixed it. The
       * decluttering that did fix the overlap could only do it by taking something away: on the
       * drawer's map 8 of 18 zones ended up hidden, which is 8 zones you cannot click.
       *
       * Its two jobs were already done elsewhere, which is what makes deleting it the right answer
       * rather than a loss:
       *
       *   the count per zone     the list view's own headers read 「ORCHARD · 3」, for every zone
       *                          at once and with no collisions possible
       *   add a whole zone       the same headers carry 전체 선택, which adds the zone in one press
       *
       * What is left is one layer at every zoom: a dot per camera, in its status colour, ringed
       * when it is in the selection. Fewer marks, one meaning each, and nothing hidden.
       */

      /* The dots are the only layer now, so nothing is swapped on zoom — `zoom` is still tracked
         because the header's legend and hint read it. */
      const applyZoom = () => {
        setZoom(instance.getZoom());
        if (!instance.hasLayer(dotLayer)) instance.addLayer(dotLayer);
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
   * THE RING GOES ON THE DOTS, redrawn whenever the pick changes.
   *
   * Its own effect and its own pass over the markers we kept, so picking a zone does not rebuild
   * the map — a rebuild would re-run the initial fitBounds and undo the zoom the pill click just
   * performed.
   *
   * setIcon rather than a second layer: the mark belongs to the dot, and a separate overlay would
   * have to be kept in step with markers that already know where they are.
   */
  useEffect(() => {
    if (markersRef.current.size === 0) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      placed.forEach(cam => {
        const marker = markersRef.current.get(cam.id);
        if (!marker) return;
        /* One ring, two reasons: a zone picked from a pill, and a camera picked for a group. They
           never overlap in practice (picking a zone clears nothing, but the modes are used one at
           a time) and a second ring style would make the map teach two marks for "this one". */
        const on = selectedIds.has(cam.id);
        const [fill, line] = dotFace(cam, on, !!alwaysPicking, tintRef.current?.(cam.id));
        marker.setIcon(L.divIcon({
          className: "",
          html: dotHtml(fill, on, line),
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }));
      });
    })();
    return () => { cancelled = true; };
    // placed is recreated per render; positionsKey is the value that actually changes. The
    // selection is joined into a string for the same reason: the Set is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey, selectionKey]);

  const selectedCamera = selected === null ? null : placed.find(c => c.id === selected) ?? null;

  return (
    /* The same card the table draws, filling the same room — see the measurement above. */
    <div ref={cardRef} style={{
      backgroundColor: "white",
      /* A CARD ONLY WHEN IT IS ONE. `fill` means this is a column inside somebody else's panel,
         and there it kept its own border, radius and shadow — a rounded box 1px inside a rounded
         box, which is the nesting the owner caught (지도 박스에 라운드가 있어서 큰 박스안에
         라운드가 있으니까 이상해). Input Sources still gets the card; the group editor gets a
         plain pane and the panel around it draws the edge. */
      border: fill ? "none" : BORDER,
      borderRadius: fill ? 0 : CARD_RADIUS,
      boxShadow: fill ? "none" : PANEL_SHADOW,
      display: "flex", flexDirection: "column", overflow: "hidden",
      // Before the measurement lands, a sensible box rather than a collapsed one — this is the
      // first paint, and a zero-height map would flash.
      /* `fill` hands the decision to the parent — see the prop's note. */
      height: fill ? "100%" : height === null ? "560px" : `${height}px`,
      minHeight: fill ? 0 : undefined,
      /* `fill` took the parent's height but not its width, so in a flex parent this card sized to
         its own header and left the rest of the row empty (measured: 838px of 1176 on the camera
         group overview). "Take your size from the box you are in" has to mean both axes. */
      width: fill ? "100%" : undefined,
      minWidth: fill ? 0 : undefined,
    }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: BORDER, flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-600)" }}>{t.counted(placed.length, cameras.length)}</span>
        {/* The dashed zone chip went with the pills: it named the zone a pill click had ringed,
            and nothing rings a zone any more. */}
        {/* PICKING IS A MODE, AND IT SAYS SO. A dot's click means either "show me this camera" or
            "add it to the group", and a modifier key would be a rule nobody discovers. The button
            is the only place that choice is made, and while it is on, the hint says where the
            group actually gets made — the bulk bar, which is outside this component and already
            counts the same selection. MEASURED before writing that sentence: the bar is
            position:fixed at the foot of the viewport (top 820 of 900), not above this card, and
            an arrow pointing the wrong way is worse than none. */}
        {/* Nor the pick button when the caller owns the dots: switching into picking would repaint
            them by picked-or-not and silently throw away the grouping the reader came to see. */}
        {!alwaysPicking && !tintOf && (
        <button onClick={() => setPickingMode(v => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px",
            borderRadius: "999px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700,
            border: picking ? "1px solid var(--gray-900)" : BORDER,
            backgroundColor: picking ? "var(--gray-900)" : "white",
            color: picking ? "white" : "var(--gray-600)",
          }}>
          <MousePointerClick size={12} strokeWidth={2.4} />
          {picking ? t.pickStop : t.pickStart}
        </button>
        )}
        {/* ONLY WHILE PICKING, and pressed rather than labelled twice. A lasso that selected while
            a dot press did not would be two answers to what a press means, so on 입력 소스 this
            appears with the pick mode and in the group editor it is simply always there. The label
            stays one noun in both states: aria-pressed and the fill say which state it is in, and
            a second wording for "off" would be the reader reading what they can see. */}
        {picking && (
          <button onClick={() => setLassoArmed(v => !v)} aria-pressed={lassoMode} title={t.lassoHow}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px", height: "26px", padding: "0 10px",
              borderRadius: "999px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700,
              border: lassoMode ? "1px solid var(--gray-900)" : BORDER,
              backgroundColor: lassoMode ? "var(--gray-900)" : "white",
              color: lassoMode ? "white" : "var(--gray-600)",
            }}>
            <Lasso size={12} strokeWidth={2.4} aria-hidden="true" />
            {t.lasso}
          </button>
        )}
        {picking && !alwaysPicking && !tintOf && (
          <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>{t.pickHint(selectedIds.size)}</span>
        )}
        <span style={{ flex: 1 }} />
        {/* THE LEGEND, AT EVERY ZOOM. It used to swap with 「구역별로 묶어 보고 있습니다 — 확대하면
            카메라 한 대씩 보입니다」 below zoom 14, which was true while the pills were drawn and
            became a false sentence the moment they were deleted: the dots are there from the first
            frame, so there is nothing to zoom in for and one layer needs one key.
            The legend is the four words the dots stand for. Four colours with no key is a puzzle,
            and the table one click away spells them out in a column. */}
        {/* NOT IN THE PICKER. See dotFace: while picking, a dot's colour says picked or not, so a
            key for four statuses would decode a code that is not on the map.
            NOR WHEN THE CALLER PAINTS THE DOTS ITSELF (`tintOf`) — on the camera-group overview
            green means 「Geylang 일대」, and a key reading 「연결됨」 beside it would be the screen
            stating something false about every dot on it. That caller brings its own key. */}
        {!alwaysPicking && !tintOf && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {([
            { color: "var(--gray-300)", label: t.connected },
            { color: "var(--warning-400)", label: t.offline },
            { color: "var(--danger-400)", label: t.error },
            { color: "var(--info-500)", label: t.awaiting },
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

          {/*
            THE SHAPE, WHILE IT IS BEING DRAWN, AND CLOSED FROM THE FIRST MOVE.
           
            A closed polygon rather than the open trace the hand has made so far, because the fill
            is the answer to the only question being asked mid-gesture — which cameras am I about
            to catch. An open line leaves the reader to imagine the closing segment, and a lasso
            around a bend is exactly where that guess goes wrong.
           
            Red when Alt is down, so taking cameras out never looks like putting them in. Above the
            dots and the floating chips, under Leaflet's own controls at 1000, and deaf to the
            pointer — it is a picture of the gesture, not a target for it.

            WIDTH AND HEIGHT ARE SPELLED OUT, because `inset: 0` does not size an <svg>: it is a
            replaced element, so with no width of its own it takes its intrinsic 300x150 and clips
            everything past it. MEASURED before those attributes existed — the polygon was in the
            DOM with the right thirteen points and the right colours, and nothing at all was drawn
            on the map, because the shape sat at x 1024 in a box that ended at 1090.
          */}
          {lassoShape !== null && lassoShape.length > 1 && (
            <svg aria-hidden="true" width="100%" height="100%"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 900, pointerEvents: "none" }}>
              <polygon
                points={lassoShape.map(p => `${p.x},${p.y}`).join(" ")}
                fill={lassoRemoves ? "var(--danger-100)" : PICKED_FILL}
                fillOpacity={0.55}
                stroke={lassoRemoves ? "var(--danger-400)" : "var(--primary-400)"}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {overlay}

          {placed.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", pointerEvents: "none" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", textAlign: "center", maxWidth: "380px", lineHeight: 1.5 }}>{t.empty}</p>
            </div>
          )}

          {/* WHAT THE MAP CANNOT SHOW, SAID ON THE MAP. An unsurveyed camera is invisible here by
              nature, so the count sits in the corner with the way to its rows — otherwise the map
              quietly under-reports the fleet and looks complete while doing it. */}
          {/*
            ONE CHIP, NOT A CARD (owner, 2026-09-22: 지도에 없는 1대 표시가 너무 영역을 많이
            차지하고있어 좀 줄여줘).
           
            It was a 300px panel three elements tall — a count, a two-line explanation and a
            button — parked over the bottom-left corner of a map that is itself an input device.
            Measured in the group drawer: it covered a fifth of a 629×372 map, which is cameras
            you cannot click.
           
            What has to be ON the map is the COUNT: an unsurveyed camera is invisible here by
            nature, so without it the map under-reports the fleet and looks complete doing it.
            The explanation is not — it says what to do about a state the reader has not decided
            to act on yet, so it moves to the chip's hover, where the same sentence is one
            pointer-rest away. The button stays, because it is the one action, but it joins the
            chip's line instead of standing on its own row.
          */}
          {unplaced > 0 && (
            <div title={t.noPositionWhy} style={{
              position: "absolute", left: "10px", bottom: "10px", zIndex: 500,
              display: "flex", alignItems: "center", gap: "8px",
              backgroundColor: "white", border: BORDER, borderRadius: "999px", padding: "4px 6px 4px 10px", boxShadow: "var(--shadow-popover)",
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-900)", whiteSpace: "nowrap" }}>{t.noPosition(unplaced)}</span>
              {/* Only where there is a list to narrow. In a group editor the count still has to be
                  said — a map that silently omits the unsurveyed cameras looks like the whole
                  fleet — but "show them" would point at nothing. */}
              {onShowUnpositioned && (
                <button className="portal-btn-quiet" onClick={onShowUnpositioned}
                  style={{ padding: "2px 8px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-100)", color: "var(--gray-700)", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {t.showThem}
                </button>
              )}
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
              {onInspect && (
                <button className="portal-btn-quiet" onClick={() => onInspect(selectedCamera.id)}
                  style={{ marginTop: "10px", width: "100%", padding: "6px 8px", borderRadius: "6px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.preview}
                </button>
              )}
            </div>
        )}
      </div>
    </div>
  );
}
