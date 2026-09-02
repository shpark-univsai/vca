/**
 * Where the base map comes from.
 *
 * This product is deployed on-premise, and those networks are usually cut off from the internet —
 * a public tile server is simply unreachable there, and Leaflet renders an empty grey grid with no
 * error. So the tile source has to be an installation setting rather than a constant in two
 * components, which is what it was.
 *
 * Set NEXT_PUBLIC_MAP_TILE_URL (and the matching attribution) per installation. Typical answers:
 *   - the customer's own GIS server:  https://gis.internal/wmts/{z}/{x}/{y}.png
 *   - tiles shipped with the install: /tiles/{z}/{x}/{y}.png   (files under public/tiles)
 *
 * The default below is the public OpenStreetMap tile server, which is for demos and development
 * only — OSM's tile usage policy does not permit a deployed product to lean on it. Every real
 * installation is expected to override it.
 */
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL;
export const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || DEFAULT_ATTRIBUTION;

/**
 * Only meaningful for a URL template containing {s}. OSM's own server does not use subdomains any
 * more, so this is empty by default; a source that needs them declares them itself.
 */
export const MAP_TILE_SUBDOMAINS = (process.env.NEXT_PUBLIC_MAP_TILE_SUBDOMAINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export const MAP_MAX_ZOOM = Number(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM) || 19;

/** The options object both maps pass to L.tileLayer, so they cannot drift apart again. */
export function tileLayerOptions() {
  return {
    attribution: MAP_TILE_ATTRIBUTION,
    maxZoom: MAP_MAX_ZOOM,
    ...(MAP_TILE_SUBDOMAINS.length > 0 ? { subdomains: MAP_TILE_SUBDOMAINS } : {}),
  };
}
