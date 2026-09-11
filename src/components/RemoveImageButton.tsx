"use client";

/**
 * Detach control for an already-attached face/body image. Two placements:
 * - `overlay` sits in the top-right corner of the image preview itself
 * - `inline` sits beside the label inside a chip, where there's no image to sit on top of
 *
 * Both stop propagation. Every one of these lives inside something whose own click opens the
 * file picker ("click to change"), so without that, detaching an image would immediately reopen
 * the picker on top of the result.
 */
export default function RemoveImageButton({ onRemove, label, variant = "overlay" }: {
  onRemove: () => void;
  /** Describes what gets removed, e.g. "Remove face image" — this button has no visible text. */
  label: string;
  variant?: "overlay" | "inline";
}) {
  const overlay = variant === "overlay";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      style={{
        ...(overlay
          ? { position: "absolute" as const, top: "6px", right: "6px", zIndex: 1 }
          : {}),
        width: "18px", height: "18px", flexShrink: 0, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", border: "none", cursor: "pointer",
        backgroundColor: overlay ? "var(--label-plate)" : "var(--gray-200)",
        color: overlay ? "white" : "var(--gray-600)",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
