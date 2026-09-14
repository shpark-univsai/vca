"use client";

import { useLanguage } from "@/lib/i18n";

/**
 * The sighting list that sits beside AuthTrailArt on the login panel — the same four cameras, as
 * Redmap's own numbered timeline. Together they read as one object: the trail says where, the list
 * says in what order and how long between.
 *
 * What the real timeline has and this deliberately does not: face thumbnails and calendar dates.
 * A pre-auth screen showing a person's photo beside a camera name and a timestamp is a detection
 * record, and this is a decoration — nobody should have to work out whether it is real. Elapsed
 * gaps carry the idea on their own. Same reason the trail is not the real geography.
 *
 * The names are positions inside a building, not places on a map: a gate, a passage, a hall, an
 * exit — and not compass points, because the drawing beside this list puts the last sighting at
 * the bottom left, where "north exit" would be a name arguing with its own picture. That keeps
 * the original rule — the drawing names no real site, and no deployment's camera
 * list is on a screen anyone can reach without signing in — while dropping "Camera A/B/C/D",
 * which read as a placeholder nobody had filled in yet. It also does the work the letters could
 * not: four positions in that order are a person crossing a building and leaving by the north
 * side, which is what the panel is illustrating.
 */

const T = {
  en: { elapsed: "elapsed", lastSeen: "LAST SEEN" },
  ko: { elapsed: "경과",   lastSeen: "마지막 목격" },
} as const;

/**
 * Newest first, the way the real timeline reads — the last sighting is the one being looked for.
 * Gaps only; no absolute times.
 *
 * Minutes, not days. The first draft had the newest sighting a day and an hour after the one
 * before it, which reads as a trail that went cold — someone found out where the person was
 * yesterday. That is the opposite of what this screen is showing. Four sightings inside twenty
 * minutes says the search caught up with them, which is the case worth putting on the panel.
 */
const ROWS: { n: string; name: { en: string; ko: string }; gap: string | null }[] = [
  { n: "04", name: { en: "Rear Exit",      ko: "후문" },       gap: "6m" },
  { n: "03", name: { en: "Main Concourse", ko: "중앙 대합실" }, gap: "11m" },
  { n: "02", name: { en: "Transit Hall",   ko: "환승 통로" },  gap: "4m" },
  { n: "01", name: { en: "West Gate",      ko: "서문" },       gap: null },
];

export default function AuthTrailList({ className }: { className?: string }) {
  const [lang] = useLanguage();
  const t = T[lang];
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", width: "170px" }}>
      {ROWS.map((row, i) => {
        const first = i === 0;
        return (
          <div key={row.n} style={{ display: "flex", gap: "12px" }}>
            {/* Rail: a ring per sighting and the line between them. The line is drawn on the row,
                not around the column, so the last ring has nothing hanging below it. */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: first ? "30px" : "26px", height: first ? "30px" : "26px",
                borderRadius: "50%", flexShrink: 0,
                border: `1.5px solid ${first ? "var(--primary-400)" : "var(--gray-300)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: first ? "11px" : "10px", fontWeight: 700,
                color: first ? "var(--primary-400)" : "var(--gray-400)",
              }}>
                {row.n}
              </div>
              {i < ROWS.length - 1 && (
                <div style={{ width: "1.5px", flex: 1, minHeight: "34px", backgroundColor: "var(--gray-200)" }} />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px", paddingBottom: "16px", minWidth: 0 }}>
              <span style={{
                fontSize: "12px", fontWeight: 700, letterSpacing: "-0.24px",
                color: first ? "var(--gray-800)" : "var(--gray-500)",
              }}>
                {row.name[lang]}
              </span>
              {first && (
                <span style={{
                  alignSelf: "flex-start", fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em",
                  color: "var(--primary-400)", backgroundColor: "var(--primary-100)",
                  borderRadius: "999px", padding: "3px 7px",
                }}>
                  {t.lastSeen}
                </span>
              )}
              {row.gap && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.2px" }}>
                  <span style={{ color: "var(--gray-500)", fontWeight: 700 }}>{row.gap}</span> {t.elapsed}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
