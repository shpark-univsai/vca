"use client";

/**
 * A match score, drawn the same way everywhere it appears.
 *
 * WHY IT MOVED HERE. This lived inside DataPage and had exactly one caller, while nine other
 * places drew a score by hand — so the same 92% read as green on Re-ID's header, grey on the
 * Best Frame wall, and purple on Redmap, at four different sizes and five different weights.
 * A score is one of two or three things an operator reads off a detection in a glance; it cannot
 * mean "high" by its colour on one screen and nothing on the next.
 *
 * THE THRESHOLDS ARE THE MEANING, and they are stated once here rather than at each call site:
 * 90 and above is a match worth acting on and is the only state that takes a colour; 85 and
 * above is readable but not asserted; below that is grey and quiet. No screen gets to pick its
 * own cut-offs — if the model's useful threshold changes it changes in one place.
 *
 * `size` is the one thing a caller may set, because a dense wall tile and a detail header are
 * genuinely different reading distances. The colour, the weight, the shape and the mono digits
 * are not negotiable: monospace so a column of scores lines up, and 999px so it reads as a chip
 * beside the other chips on the row.
 */
export default function ScoreBadge({ score, size = 10 }: {
  score: number;
  /** 10 on a dense row (the default), 12–13 where the score is the point of the panel. */
  size?: 10 | 12 | 13;
}) {
  const high = score >= 90, mid = score >= 85;
  return (
    <span style={{
      fontSize: `${size}px`, fontWeight: 800, fontFamily: "monospace",
      color: high ? "var(--success-400)" : mid ? "var(--gray-600)" : "var(--gray-500)",
      backgroundColor: high ? "var(--success-100)" : "var(--gray-100)",
      padding: size >= 12 ? "3px 8px" : "2px 6px", borderRadius: "999px",
      whiteSpace: "nowrap",
    }}>
      {/* ONE DECIMAL, ALWAYS. `{score}%` printed 99.7 with its decimal and 85.0 without, because
          a trailing zero is not a digit JavaScript keeps — so a column read 99.7 / 85 / 78.2 and
          the decimal points did not line up. Monospace is here to make that column scannable;
          leaving the precision to the data defeats it. Rounded rather than truncated, and the
          thresholds (90 / 85) are compared against the raw value, so a 89.96 still reads as the
          grey it is. */}
      {score.toFixed(1)}%
    </span>
  );
}
