/**
 * The login panel's artwork: what this product does, drawn without saying where.
 *
 * Three versions came before it. A glossy 3D camera on a violet gradient was the visual language
 * of a landing page, on the screen an operator opens to start a shift. A desaturated city grid
 * fixed the tone and committed the opposite error — the deployments are a city AND a school and
 * the list keeps growing, so a street grid is wrong on a campus and will be wrong again on the
 * next kind of site. Then plain dots on a plan grid, joined by a line that climbed left to right:
 * that is a chart. Points on a uniform grid trending upward is the most familiar graph there is,
 * and "our numbers go up" is not the sentence this product has to say.
 *
 * So: no grid, and a path that changes direction. A chart needs axes and a trend; this has
 * neither. What is left is four cameras and the trail of one person between them, which is the one
 * thing that stays true whether the site is a city, a campus or a factory floor.
 *
 * Drawn in the app's own language: the trail is the dashed inferred path Redmap draws (see
 * .vca-route-line in globals.css), and the marks are the purple the map reserves for where the
 * system is looking.
 *
 * Fixed values rather than generated, so a server render and the browser draw the same thing.
 * Decorative: the caller marks it aria-hidden, so a screen reader lands on the form.
 */

/**
 * The ground: a plan grid.
 *
 * Three grounds were tried and this is the one that stays. A street map with curved roads and a
 * road hierarchy does read as a map — that is exactly what makes it wrong here. The deployments
 * are a city AND a school and the list keeps growing, so a street map is right on one site and
 * wrong on the next. A plan grid is what any space looks like before you say which space it is,
 * and it does not compete with the four cameras standing on it.
 *
 * It read as a chart's backdrop once, but that was the grid together with a line climbing left to
 * right. The trail changes direction now and every mark is a camera, so the grid is free to be
 * what it is: a floor.
 *
 * 40 fine, every fifth heavier — the convention a floor plan or a site plan already uses.
 */
const FINE = Array.from({ length: 14 }, (_, i) => (i + 1) * 40);
const HEAVY = [200, 400];

/**
 * The sightings, in the order the cameras saw them.
 *
 * Right, then down and back to the left. The direction has to break at least once — a sequence
 * that only ever goes one way reads as a trend no matter what the marks look like, and a person
 * walking through a site does not travel in a straight line.
 */
const CAMERAS: { x: number; y: number }[] = [
  { x: 215, y: 160 },
  { x: 470, y: 96 },
  { x: 352, y: 350 },
  { x: 89, y: 360 },
];

/** The icon's own box is 20 wide; its drawing sits around this point, which is what a transform
 *  has to centre on. */
const GLYPH_C = 9.7;
const GLYPH_CY = 10.4;

function CameraGlyph({ x, y, size, color = "var(--primary-400)" }: { x: number; y: number; size: number; color?: string }) {
  const k = size / 20;
  return (
    <g
      transform={`translate(${x - GLYPH_C * k} ${y - GLYPH_CY * k}) scale(${k})`}
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d="M13.9585 10H16.9851C17.1271 10.0001 17.2667 10.0364 17.3907 10.1056C17.5147 10.1748 17.619 10.2745 17.6936 10.3953C17.7683 10.5161 17.8108 10.654 17.8172 10.7958C17.8236 10.9377 17.7936 11.0788 17.7301 11.2058L16.0351 14.5967C15.9709 14.7252 15.8745 14.8348 15.7553 14.9151C15.6361 14.9953 15.4982 15.0434 15.355 15.0546C15.2118 15.0659 15.0681 15.0399 14.9379 14.9792C14.8076 14.9185 14.6953 14.8252 14.6118 14.7083L12.8418 12.2333" />
      <path d="M14.2548 7.54373C14.4523 7.6426 14.6025 7.81584 14.6723 8.02539C14.7422 8.23493 14.726 8.46363 14.6273 8.66123L12.0389 13.8371C11.99 13.935 11.9222 14.0223 11.8395 14.094C11.7568 14.1657 11.6608 14.2204 11.557 14.255C11.4531 14.2896 11.3434 14.3034 11.2343 14.2956C11.1251 14.2878 11.0185 14.2586 10.9206 14.2096L3.00812 10.2496C2.43339 9.96007 1.99674 9.45471 1.79372 8.84407C1.59069 8.23342 1.63781 7.56722 1.92478 6.99123L3.07478 4.66623C3.21812 4.38058 3.41632 4.12597 3.65806 3.91693C3.89981 3.70788 4.18037 3.54851 4.48372 3.44791C4.78706 3.34731 5.10726 3.30746 5.42601 3.33062C5.74476 3.35378 6.05583 3.4395 6.34145 3.5829L14.2548 7.54373Z" />
      <path d="M1.6665 15.8333H4.79984C5.11045 15.8355 5.41548 15.7508 5.68052 15.5888C5.94556 15.4269 6.16007 15.1941 6.29984 14.9167L7.49984 12.5" />
      <path d="M1.6665 17.5003V14.167" />
      <path d="M5.8335 7.5H5.84079" />
    </g>
  );
}

export default function AuthTrailArt({ className }: { className?: string }) {
  const path = CAMERAS.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  // Arrow partway along the first leg, so it sits on the line rather than under a camera. Same
  // device MapView puts on a tracking route.
  const [a, b] = CAMERAS;
  const ax = a.x + (b.x - a.x) * 0.46;
  const ay = a.y + (b.y - a.y) * 0.46;
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;

  return (
    <svg className={className} viewBox="0 0 560 560" fill="none" role="presentation">
      <defs>
        {/* Fades the ground into the panel so it stops rather than being cut off. Only the ground
            is faded — the cameras and the trail keep their full weight wherever they sit. */}
        <radialGradient id="vca-auth-fade" cx="50%" cy="48%" r="68%">
          <stop offset="72%" stopColor="var(--gray-50)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--gray-50)" stopOpacity="0.92" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="560" height="560" fill="var(--gray-50)" />
      <g stroke="var(--gray-200)" strokeWidth="1">
        {FINE.map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="560" />)}
        {FINE.map(v => <line key={`h${v}`} x1="0" y1={v} x2="560" y2={v} />)}
      </g>
      <g stroke="var(--gray-300)" strokeWidth="1.5">
        {HEAVY.map(v => <line key={`V${v}`} x1={v} y1="0" x2={v} y2="560" />)}
        {HEAVY.map(v => <line key={`H${v}`} x1="0" y1={v} x2="560" y2={v} />)}
      </g>
      <rect x="0" y="0" width="560" height="560" fill="url(#vca-auth-fade)" />

      {/* The trail. Dashed because it is inferred, not recorded — the system did not follow anyone,
          it matched four sightings after the fact, and a solid line would claim more than that.
          Flowing, with the app's own class rather than a second animation: .vca-route-line is what
          Redmap draws a tracking route with, and it owns the dash pattern too, so no dasharray is
          set here — one definition of what a route looks like in motion. */}
      <path className="vca-route-line" d={path} stroke="var(--primary-300)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d={`M${ax - 6} ${ay + 5} L${ax} ${ay - 6} L${ax + 6} ${ay + 5} Z`}
            fill="var(--primary-300)" transform={`rotate(${angle} ${ax} ${ay})`} />

      {/* The cameras. A soft disc behind each one so the glyph reads against the trail crossing
          under it, and so the marks carry weight without a hard fill the strokes would fight.
          The last is larger: it is the most recent sighting, which is the one an operator is
          looking for, and it is how Redmap already draws the end of a route. */}
      {CAMERAS.map((c, i) => {
        const last = i === CAMERAS.length - 1;
        return (
          <g key={i}>
            {/* The last sighting is filled, the rest are washes.
                The list beside this map gives its 04 a solid ring and a LAST SEEN chip, and the
                map answered with a camera barely larger than the others — the same row carried
                two different weights. Filled here, so whichever half the eye lands on first, the
                most recent sighting is the one it finds. That is also the one an operator is
                looking for: where are they now.

                Three discs rather than a stroked ring. A hard outline drew a border around the
                camera and read as a control — something to click — where the point is only that
                this one is louder than the others. Rings of tint say the same thing with no edge,
                and it is what the app's own map does around a live ping. */}
            {/* Behind the static discs, so only what expands past them shows — a ring leaving
                the camera rather than a flash over it. */}
            {last && <circle className="vca-auth-pulse" cx={c.x} cy={c.y} r="58" fill="var(--primary-400)" />}
            {last && <circle cx={c.x} cy={c.y} r="58" fill="var(--gray-50)" />}
            {last && <circle cx={c.x} cy={c.y} r="58" fill="var(--primary-100)" />}
            {/* The earlier sightings are quieter than they were — smaller halo, lighter purple,
                smaller camera. The point of the drawing is where the person is NOW, and three
                marks at nearly the last one's weight made the eye pick between four equals.
                Weak, not faint: they still have to read as cameras, because a trail between three
                anonymous dots and one camera is a different picture. */}
            <circle cx={c.x} cy={c.y} r={last ? 42 : 28} fill={last ? "var(--primary-100)" : "var(--gray-50)"} />
            <circle cx={c.x} cy={c.y} r={last ? 42 : 28} fill="var(--primary-400)" opacity={last ? 0.13 : 0.06} />
            {last && <circle cx={c.x} cy={c.y} r="27" fill="var(--primary-400)" />}
            <CameraGlyph
              x={c.x} y={c.y}
              size={last ? 40 : 29}
              color={last ? "var(--gray-0)" : "var(--primary-300)"}
            />
            {/* Numbered, so the trail here and the list there are one object rather than two
                drawings that happen to share a colour. */}
            <text
              x={c.x + (last ? 44 : 21)} y={c.y - (last ? 38 : 17)}
              fontFamily="'SUIT', system-ui, sans-serif" fontSize={last ? 20 : 13} fontWeight={800}
              fill="var(--primary-400)" opacity={last ? 1 : 0.4}
            >
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
