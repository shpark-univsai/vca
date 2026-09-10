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
 * gaps carry the idea on their own, and letters stand in for camera names so the drawing names no
 * place. Same reason the trail is not the real geography.
 */

const T = {
  en: {
    camera: (n: string) => `Camera ${n}`,
    elapsed: "elapsed",
    lastSeen: "LAST SEEN",
  },
  ko: {
    camera: (n: string) => `카메라 ${n}`,
    elapsed: "경과",
    lastSeen: "마지막 목격",
  },
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
const ROWS: { n: string; letter: string; gap: string | null }[] = [
  { n: "04", letter: "D", gap: "6m" },
  { n: "03", letter: "C", gap: "11m" },
  { n: "02", letter: "B", gap: "4m" },
  { n: "01", letter: "A", gap: null },
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
                {t.camera(row.letter)}
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
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "-0.21px" }}>
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
