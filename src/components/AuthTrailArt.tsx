/**
 * The login panel's artwork: what this product does, drawn without saying where.
 *
 * Two versions came before it and both made the same mistake in different ways. A glossy 3D
 * camera on a violet gradient was the visual language of a landing page, on the screen an operator
 * opens to start a shift. Replacing it with a desaturated city grid fixed the tone and then
 * committed the other error — the deployments are a city AND a school, and the list keeps growing.
 * A street grid is wrong on a campus, and will be wrong again on the next kind of site.
 *
 * What does not change is the product: a camera recognises a person, and the same person turns up
 * at another camera, and that is how a question gets answered. So the drawing is that and nothing
 * else — a few camera positions, a trail linking the ones that saw the same person, and one that
 * saw nobody. No streets, no buildings, no rooms. The ground is a plan grid, which is what any
 * space looks like before you say which space it is.
 *
 * Drawn in the app's own language: the trail is the dashed inferred path Redmap draws (see
 * .vca-route-line in globals.css), and the marks are the purple the map reserves for where the
 * system is looking. Grey everywhere else, so the primary colour stays the small share of the
 * screen this product's own rule asks for.
 *
 * Fixed values rather than generated, so a server render and the browser draw the same thing.
 * Decorative: the caller marks it aria-hidden, so a screen reader lands on the form.
 */

/**
 * The sightings, in the order the cameras saw them.
 *
 * There was a fifth mark here — a hollow ring, a camera watching with nothing to report. The
 * reasoning was sound (coverage without a sighting is the ordinary case) and it still came out
 * wrong: the caption below the drawing does not mention it, so the first person to see it asked
 * what it was. An unexplained mark is not a second idea, it is noise. One drawing, one thing.
 *
 * Four rather than three, spread across the frame — with the ring gone the top half was empty
 * grid and the trail sat in a corner.
 */
const CAMERAS: { x: number; y: number }[] = [
  { x: 108, y: 392 },
  { x: 232, y: 268 },
  { x: 368, y: 312 },
  { x: 462, y: 168 },
];

const TRAIL = CAMERAS;

/** Plan grid. 40px fine, every fifth line heavier — the convention any floor plan or site plan
 *  uses, which is exactly why it reads as "a space" without naming one. */
const FINE = Array.from({ length: 14 }, (_, i) => (i + 1) * 40);

export default function AuthTrailArt({ className }: { className?: string }) {
  const path = TRAIL.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  // Arrow on the first leg, placed a third along it so it sits on the line rather than under a
  // mark. Same device MapView puts on a tracking route.
  const a = TRAIL[0];
  const b = TRAIL[1];
  const ax = a.x + (b.x - a.x) * 0.42;
  const ay = a.y + (b.y - a.y) * 0.42;
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;

  return (
    <svg className={className} viewBox="0 0 560 560" fill="none" role="presentation">
      <defs>
        <radialGradient id="vca-auth-fade" cx="50%" cy="48%" r="66%">
          <stop offset="66%" stopColor="var(--gray-50)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--gray-50)" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="560" height="560" fill="var(--gray-50)" />

      {/* Ground */}
      <g stroke="var(--gray-200)" strokeWidth="1">
        {FINE.map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="560" />)}
        {FINE.map(v => <line key={`h${v}`} x1="0" y1={v} x2="560" y2={v} />)}
      </g>
      <g stroke="var(--gray-300)" strokeWidth="1.5">
        {[200, 400].map(v => <line key={`V${v}`} x1={v} y1="0" x2={v} y2="560" />)}
        {[200, 400].map(v => <line key={`H${v}`} x1="0" y1={v} x2="560" y2={v} />)}
      </g>

      {/* The trail. Dashed because it is inferred, not recorded — the system did not follow anyone,
          it matched three sightings after the fact, and a solid line would claim more than that. */}
      <path d={path} stroke="var(--primary-300)" strokeWidth="2.5" strokeDasharray="9 7"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d={`M${ax - 6} ${ay + 5} L${ax} ${ay - 6} L${ax + 6} ${ay + 5} Z`}
            fill="var(--primary-300)" transform={`rotate(${angle} ${ax} ${ay})`} />

      {/* The sightings, each marked with a camera rather than a dot.
          Plain dots joined by a rising line read as a chart — points on a grid trending upward is
          the most familiar graph there is, and that is the wrong sentence for this product. A
          camera on each node says what the marks are before the caption gets a chance to.
          The last one is larger: it is the most recent sighting, which is the one an operator is
          looking for, and it is how Redmap already draws the end of a route. */}
      {CAMERAS.map((c, i) => {
        const last = i === CAMERAS.length - 1;
        const r = last ? 19 : 15;
        const k = (last ? 19 : 15) / 11;   // glyph drawn in an 11-unit box, scaled to the disc
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={last ? 32 : 26} fill="var(--primary-400)" opacity="0.10" />
            <circle cx={c.x} cy={c.y} r={r} fill="var(--primary-400)" />
            <circle cx={c.x} cy={c.y} r={r} stroke="var(--gray-0)" strokeWidth="2" />
            {/* A bullet camera on a bracket, filled rather than stroked — at this size strokes
                turn to mush and a silhouette holds. Drawn around the origin so one transform
                places and scales it. */}
            <g transform={`translate(${c.x} ${c.y}) scale(${k})`} fill="var(--gray-0)">
              <path d="M-5.2 -1.9 L3.1 -3.6 a1.5 1.5 0 0 1 1.9 1.45 l0 2.1 a1.5 1.5 0 0 1 -1.9 1.45 L-5.2 1.7 a1.8 1.8 0 0 1 0 -3.6 Z" />
              <rect x="-0.7" y="1.9" width="1.4" height="2.2" rx="0.4" />
              <rect x="-2.9" y="4.1" width="5.8" height="1.3" rx="0.65" />
              <circle cx="-3.1" cy="-0.1" r="1.15" fill="var(--primary-400)" />
            </g>
          </g>
        );
      })}

      <rect x="0" y="0" width="560" height="560" fill="url(#vca-auth-fade)" />
    </svg>
  );
}
