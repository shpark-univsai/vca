"use client";

import { useState } from "react";

/**
 * A photo that came from the server, and the space it leaves when it does not arrive.
 *
 * WHY THIS EXISTS. Every <img> in the product was a bare tag with no `onError`, so a crop the
 * server could not serve fell back to the browser's own broken-image glyph: a different drawing in
 * every browser, pinned to the top-left of a box that then looks empty. Fifteen of them in one
 * results row (owner, 2026-10-12) reads as "the app is broken" rather than "these pictures are
 * missing", and the row's own information — camera code, time, score — is still true and still
 * there. So the failure is drawn, at the same size and radius, in the product's own neutrals.
 *
 * WHAT IT IS NOT. This is not the withheld-photo tile (`FacePhoto` in portal/PortalShared). That
 * one says "you are not allowed to see this" and carries a reason; this one says "this did not
 * load". Same family of shapes on purpose, different sentence.
 *
 * ONE SILENT RETRY. These installs are on-premise, where a camera host dropping for a second is
 * ordinary. A single retry costs nothing and recovers most of them. It is silent because a
 * 「다시 시도」 button on each of fifteen tiles is noise, not help — and only for http(s) sources,
 * since a cache-busting parameter would destroy a data: or blob: URL.
 *
 * NOT AN ERROR COLOUR. Fifteen red tiles would read as an alarm on a screen whose alarms mean
 * something else. The placeholder is the same neutral the empty drop zones use.
 */
export function Photo({ src, alt = "", kind = "face", style, className, onClick, title }: {
  src?: string;
  alt?: string;
  /** Which silhouette the placeholder draws. "frame" is for a whole captured frame or a camera
   *  thumbnail, where a face glyph would claim the picture was of a person. */
  kind?: "face" | "body" | "frame";
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const retryable = !!src && /^https?:/i.test(src);
  const resolved = attempt > 0 && retryable
    ? `${src}${src!.includes("?") ? "&" : "?"}r=${attempt}`
    : src;

  if (!src || failed) {
    return (
      <span
        className={className}
        onClick={onClick}
        title={title}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "var(--gray-100)", color: "var(--gray-400)",
          boxSizing: "border-box", overflow: "hidden",
          ...style,
        }}
      >
        <PlaceholderGlyph kind={kind} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      /* ALSO CHECK ON MOUNT, not just onError.
         React attaches its error listener after hydration, so an image that already failed before
         then — which is exactly what happens on a server-rendered page whose photo host is
         unreachable — fires its error event into nobody and the fallback never runs. Measured on
         Portal's Overview: three 36px crops showed the browser's broken-image glyph while every
         client-rendered photo on the same site fell back correctly. `complete` with a zero
         naturalWidth is the state of an <img> that has finished and has no picture. */
      ref={el => {
        if (el && el.complete && el.naturalWidth === 0) {
          if (attempt === 0 && retryable) setAttempt(1);
          else setFailed(true);
        }
      }}
      src={resolved}
      alt={alt}
      className={className}
      onClick={onClick}
      title={title}
      onError={() => {
        if (attempt === 0 && retryable) setAttempt(1);
        else setFailed(true);
      }}
      style={{ display: "block", objectFit: "cover", ...style }}
    />
  );
}

/** Sized from the box it lands in rather than fixed, so a 26px avatar and a 400px frame both get a
 *  glyph that reads as a mark on the surface instead of filling it or vanishing in it. */
function PlaceholderGlyph({ kind }: { kind: "face" | "body" | "frame" }) {
  const common = { width: "36%", height: "36%", maxWidth: 28, maxHeight: 28, minWidth: 10, minHeight: 10 } as const;
  if (kind === "frame") {
    return (
      <svg viewBox="0 0 24 24" fill="none" style={common} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 15.5l4.2-3.6a1.5 1.5 0 0 1 2 0L13 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="15.5" cy="9.5" r="1.4" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "body") {
    return (
      <svg viewBox="0 0 24 24" fill="none" style={common} aria-hidden>
        <circle cx="12" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v7M12 15l-3 5M12 15l3 5M7.5 10.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" style={common} aria-hidden>
      <circle cx="12" cy="11.5" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.3" cy="10" r="1.1" fill="currentColor" />
      <circle cx="14.7" cy="10" r="1.1" fill="currentColor" />
      <path d="M9 14.4c.8.8 1.8 1.2 3 1.2s2.2-.4 3-1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
