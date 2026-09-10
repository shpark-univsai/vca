/**
 * The login panel's artwork: the product's own picture of itself.
 *
 * What it replaced was a glossy 3D camera on a violet gradient — the visual language of a landing
 * page selling software, on the screen an operator opens at the start of every shift. It also ran
 * against this product's own rule of keeping the primary colour to a tenth of a screen: it was the
 * most saturated surface anywhere in the product, sitting on the first one anybody sees.
 *
 * This is drawn in the language the app already speaks: a desaturated street grid with a few
 * purple marks on it, which is exactly what the monitoring map looks like (see MAP_TILE_FILTER —
 * the real tiles are pushed to greyscale for the same reason). Nothing here is a photograph or an
 * asset, so there is no Figma round trip and nothing to keep in sync.
 *
 * Deliberately NOT the real geography. A pre-auth screen that draws the deployment's actual
 * districts tells anyone who reaches the login page where the cameras are. The grid below is
 * invented, and fixed rather than generated, so a server render and the browser draw the same
 * thing — no seeded randomness, no hydration tear.
 *
 * Decorative: the caller marks it aria-hidden, so a screen reader lands on the form.
 */

/** Blocks, as [x, y, w, h]. Written out rather than derived from the roads: an even fill reads as
 *  a table, and a city does not have one. Sizes vary and two slots are left open. */
const BLOCKS: [number, number, number, number][] = [
  [16, 20, 58, 62], [104, 20, 96, 62], [230, 20, 106, 40], [230, 68, 106, 14],
  [368, 20, 86, 62], [486, 20, 58, 34],
  [16, 112, 58, 96], [104, 112, 96, 44], [104, 170, 96, 38],
  [230, 112, 106, 96], [368, 112, 86, 60], [486, 112, 58, 96],
  [16, 238, 58, 94], [104, 238, 96, 94], [230, 238, 44, 94], [288, 238, 48, 60],
  [368, 238, 86, 94], [486, 238, 58, 60],
  [16, 378, 58, 68], [104, 378, 96, 68], [230, 378, 106, 68],
  [368, 378, 86, 44], [486, 378, 58, 68],
];

/** Where the marks sit. Four, on road edges rather than mid-block — a camera watches a street. */
const PINS: [number, number][] = [[214, 222], [352, 348], [88, 348], [470, 96]];

export default function AuthMapArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 560 560" fill="none" role="presentation">
      <defs>
        {/* Fades the grid into the panel at the edges so the drawing stops rather than being cut
            off. Starts late and never reaches full opacity: an earlier, heavier ramp washed the
            middle out and the whole thing read as a watermark instead of a map. */}
        <radialGradient id="vca-auth-fade" cx="50%" cy="48%" r="68%">
          <stop offset="72%" stopColor="var(--gray-50)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--gray-50)" stopOpacity="0.92" />
        </radialGradient>
      </defs>

      {/* The ground IS the roads. Light between filled blocks is how a street map reads, and it
          means the grid needs no drawn lines — the first version painted white roads on a
          near-white ground and they only showed where they happened to cross a block. */}
      <rect x="0" y="0" width="560" height="560" fill="var(--gray-50)" />

      {/* Blocks, filled and opaque. Two greys, and the darker one falls on a third of them so a
          block's neighbour usually differs — that variation is what stops a grid reading as graph
          paper. */}
      {BLOCKS.map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x} y={y} width={w} height={h} rx="3"
          fill={(x + y) % 3 === 0 ? "var(--gray-300)" : "var(--gray-200)"}
        />
      ))}

      {/* A park and water along the bottom — the two things a grid of blocks needs so it stops
          looking like a spreadsheet. Both in grey: the palette has no green, and inventing one
          here would put a colour on screen that appears nowhere else in the product. */}
      <rect x="288" y="306" width="48" height="26" rx="10" fill="var(--gray-100)" />
      <path d="M0 496 C 120 480, 210 520, 330 500 C 430 484, 500 510, 560 496 L560 560 L0 560 Z"
            fill="var(--gray-300)" />
      <path d="M0 496 C 120 480, 210 520, 330 500 C 430 484, 500 510, 560 496"
            stroke="var(--gray-400)" strokeWidth="1.5" opacity="0.45" />

      {/* The expressway. The one drawn line, because it cuts across blocks rather than running
          between them — and it is what tells the eye where to enter the picture. */}
      <line x1="-20" y1="150" x2="580" y2="430" stroke="var(--gray-50)" strokeWidth="16" />
      <line x1="-20" y1="150" x2="580" y2="430" stroke="var(--gray-300)" strokeWidth="1" />

      {/* The marks, and the only colour on the drawing — grey city, purple where the system is
          looking. Tight halos: at the first size they read as fuzzy blobs rather than points, and
          a point is the thing a camera position is. */}
      {PINS.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 0 ? 22 : 15} fill="var(--primary-400)" opacity="0.13" />
          <circle cx={x} cy={y} r={i === 0 ? 7.5 : 5.5} fill="var(--primary-400)" />
          <circle cx={x} cy={y} r={i === 0 ? 7.5 : 5.5} stroke="var(--gray-0)" strokeWidth="2.5" />
        </g>
      ))}

      <rect x="0" y="0" width="560" height="560" fill="url(#vca-auth-fade)" />
    </svg>
  );
}
