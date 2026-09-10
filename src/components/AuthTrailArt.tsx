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

/** Camera positions. Four, because the fourth saw nobody — coverage without a sighting is the
 *  ordinary case, and a picture where every camera has a hit would be the flattering lie. */
const CAMERAS: { x: number; y: number; seen: boolean }[] = [
  { x: 132, y: 386, seen: true },
  { x: 268, y: 250, seen: true },
  { x: 424, y: 318, seen: true },
  { x: 388, y: 132, seen: false },
];

/** The trail, through the three that saw the same person, in the order they saw them. */
const TRAIL = CAMERAS.filter(c => c.seen);

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

      {/* Camera positions. The three with a sighting carry the halo; the fourth is a hollow ring —
          a camera that is watching and has nothing to report. */}
      {CAMERAS.map((c, i) => (
        <g key={i}>
          {c.seen ? (
            <>
              <circle cx={c.x} cy={c.y} r={i === 1 ? 24 : 17} fill="var(--primary-400)" opacity="0.12" />
              <circle cx={c.x} cy={c.y} r={i === 1 ? 8 : 6} fill="var(--primary-400)" />
              <circle cx={c.x} cy={c.y} r={i === 1 ? 8 : 6} stroke="var(--gray-0)" strokeWidth="2.5" />
            </>
          ) : (
            <>
              <circle cx={c.x} cy={c.y} r="6" fill="var(--gray-0)" />
              <circle cx={c.x} cy={c.y} r="6" stroke="var(--gray-400)" strokeWidth="2" />
            </>
          )}
        </g>
      ))}

      <rect x="0" y="0" width="560" height="560" fill="url(#vca-auth-fade)" />
    </svg>
  );
}
