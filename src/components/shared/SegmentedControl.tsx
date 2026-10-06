"use client";

import React from "react";
import { RADIUS } from "./controls";

/**
 * ONE SEGMENTED CONTROL (owner, 2026-10-06: 그 사람이랑 자동차 토글을 공통으로 거의 모든 화면에서
 * 쓰이거든 근데 사실 이거 대시보드에 왼쪽 패널에 이벤트랑 시스템으로도 쓰이고있는거랑 유사해서
 * 이걸로 통일시켜도될것같은데).
 *
 * There were three of them, drawn three ways — measured before this file existed:
 *   레드맵 사람/차량      track 999px (pill) · segment 999px · active = white + raised shadow
 *   대시보드 EVENTS/SYSTEM track 12px        · segment 10px  · active = --primary-400 fill, white text
 *   상단바 사이드바 좌/우   track 7px         · segment 5px   · active = white + raised shadow
 * One widget, three shapes and two different ideas of what "selected" looks like.
 *
 * SHAPE comes from the rule in ./controls — a segmented track is a control box (8px) and its
 * segments are nested inside it (6px = 8 − 2px of track padding).
 *
 * SELECTED IS WHITE, NOT PURPLE, and that is not a new decision — it is the one RedmapPage already
 * carried: 「Grey, not purple: this marks WHICH MODE is selected, and on a screen whose subject is
 * finding people the VIP colour cannot also mean "you are here". The white fill and the raised
 * shadow already carry the selection; the colour was saying it a third time, in the one hue this
 * product reserves.」 Two of the three were already white; the dashboard's purple was the outlier,
 * and purple is kept for what asks to be pressed.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  /** The label. Takes a node rather than a string so a caller can keep its own responsive span. */
  label: React.ReactNode;
  /** Drawn before the label. Handed the selected state so an icon can take the text's colour. */
  icon?: (active: boolean) => React.ReactNode;
  title?: string;
};

export function SegmentedControl<T extends string>({
  value, onChange, options, fill = false, size = "md", gap, style,
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  /** Segments share the width equally. For a control that spans a panel rather than sitting in a row. */
  fill?: boolean;
  /** "sm" is the 10px-text variant the navbar menu needs; everything in a toolbar row is "md". */
  size?: "sm" | "md";
  /** Space between segments. Defaults to none — the track's fill is what separates them. */
  gap?: string;
  style?: React.CSSProperties;
}) {
  const sm = size === "sm";
  return (
    <div style={{
      display: "flex", alignItems: "center", flexShrink: 0,
      backgroundColor: "var(--gray-100)",
      borderRadius: RADIUS.control,
      /* 2px, and the segments are 6px, so the inner corner sits concentric inside the outer one
         rather than floating in it — outer radius minus padding, which is the one thing every
         design system that publishes a radius rule agrees on. */
      padding: "2px",
      gap: gap ?? "2px",
      boxSizing: "border-box",
      ...style,
    }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.title}
            aria-pressed={active}
            style={{
              flex: fill ? 1 : undefined,
              padding: sm ? "3px 9px" : "0 16px",
              height: sm ? undefined : "32px",
              minHeight: sm ? undefined : undefined,
              borderRadius: RADIUS.inner,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              backgroundColor: active ? "white" : "transparent",
              boxShadow: active ? "var(--shadow-raised)" : "none",
              color: active ? "var(--gray-900)" : "var(--gray-500)",
              fontSize: sm ? "10px" : "13px",
              fontWeight: active ? 800 : 600,
              letterSpacing: sm ? "-0.1px" : "-0.26px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              transition: "background-color 0.15s, box-shadow 0.15s",
            }}>
            {opt.icon?.(active)}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
