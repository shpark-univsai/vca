"use client";

import { useState } from "react";
import { Activity, Clock, Crosshair, Link2, Map as MapIcon, MapPin, Network, Play, Scan } from "lucide-react";
import { useVcaStore, type Camera } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER } from "./PortalShared";
import { sgtClockMinutes, sgtDateKey } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";

const AI_OVERLAY_COLORS: Record<string, string> = {
  "Re-ID Analysis": "var(--success-400)",
  "License Plate Recognition": "var(--primary-400)",
};

const T = {
  en: {
    live: "LIVE",
    stillFrame: "LAST FRAME",
    connecting: "CONNECTING",
    playLive: "Play live stream",
    connectingTitle: "Asking for the live stream",
    connectingHint: "The browser cannot open an RTSP stream directly. This plays once the server exposes a transcoded preview for this camera.",
    stopPreview: "Stop",
    streamOffline: "Stream offline",
    zone: "Zone",
    location: "Location",
    protocol: "Protocol",
    coordinates: "Coordinates",
    rtspUrl: "RTSP Stream URL",
    mappedAiEngines: "Mapped AI engines",
    noAiEngines: "No AI engines mapped to this camera yet.",
    lastDetection: "Last detection",
    detectionCount: "Detections on record",
    detectionCountValue: (n: number) => `${n}`,
    noRecentDetections: "None yet",
    close: "Close",
  },
  ko: {
    live: "실시간",
    stillFrame: "최근 프레임",
    connecting: "연결 중",
    playLive: "실시간 스트림 재생",
    connectingTitle: "실시간 스트림을 요청하는 중",
    connectingHint: "브라우저는 RTSP를 직접 열 수 없습니다. 서버가 이 카메라의 변환된 미리보기를 제공하면 여기서 재생됩니다.",
    stopPreview: "중지",
    streamOffline: "스트리밍 오프라인",
    zone: "구역",
    location: "위치",
    protocol: "프로토콜",
    coordinates: "좌표",
    rtspUrl: "RTSP 스트림 URL",
    mappedAiEngines: "연결된 AI 엔진",
    noAiEngines: "이 카메라에 연결된 AI 엔진이 아직 없습니다.",
    lastDetection: "마지막 탐지",
    detectionCount: "기록된 탐지",
    detectionCountValue: (n: number) => `${n}건`,
    noRecentDetections: "이 카메라에서 최근 감지된 내역이 없습니다.",
    close: "닫기",
  },
} as const;

export default function CameraStreamModal({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  useEscapeKey(onClose);
  const events = useVcaStore(s => s.events);
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const online = camera.status === "online";
  /**
   * Whether the reader has asked for the live stream.
   *
   * The frame is a still — the last thumbnail the server sent — and this modal is called Preview,
   * so it needs the control that starts a preview. Pressing it cannot produce video yet: nothing
   * in the browser can open an RTSP stream, and the endpoint that would transcode it does not
   * exist. So it moves to a waiting state that says so, with the URL it would be playing, rather
   * than animating something that is not happening.
   */
  const [playing, setPlaying] = useState(false);
  const cameraEvents = events.filter(e => e.cameraId === camera.id);
  // Newest first, then take the top one — the store's order is not guaranteed to be chronological.
  const lastDetection = cameraEvents.length === 0
    ? null
    : new Date(Math.max(...cameraEvents.map(e => new Date(e.timestamp).getTime())));
  const aiFeatures = camera.aiFeatures ?? [];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "640px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        {/* No rule under the title. The sheet below it is already a stack of ruled rows, and a
            heavier line above them made the header a section of its own — the name of the camera
            does not need to be fenced off from the camera's own facts. The gap does the work. */}
        <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--gray-400)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{camera.name}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{camera.code}</p>
            </div>
          </div>
          <button className="portal-icon-btn" onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* The rule that used to divide these two blocks was carrying the space between them; with
            it gone the header's 20px and the body's 20px stacked into a gap the size of a missing
            element. 8 above and 12 below reads as one block with a title on it, which is what it
            is. */}
        <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Preview */}
          <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", aspectRatio: "16 / 9", backgroundColor: "var(--gray-900)" }}>
            <img src={camera.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: online ? 1 : 0.4 }} />
            {/* The badge says what the frame is: a still until somebody presses play, live once the
                server is streaming. It read "LIVE" over a static thumbnail before, which is the
                one thing this frame is definitely not. */}
            {online && (
              <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(14,22,42,0.7)", padding: "4px 10px", borderRadius: "999px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: playing ? "var(--success-400)" : "var(--gray-400)" }} />
                <span style={{ fontSize: "10px", fontWeight: 600, color: "white" }}>{playing ? t.connecting : t.stillFrame}</span>
              </div>
            )}
            {/* Only on a camera that is up: there is nothing to ask for from one that is dark, and
                a play button that cannot even be tried is worse than none. */}
            {online && !playing && (
              <button
                onClick={() => setPlaying(true)}
                title={t.playLive}
                aria-label={t.playLive}
                style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "rgba(14,22,42,0.25)", cursor: "pointer",
                }}
              >
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "52px", height: "52px", borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.92)", color: "var(--gray-900)",
                  boxShadow: "0 8px 24px rgba(14,22,42,0.3)",
                }}>
                  {/* Nudged right by 2px: a triangle's optical centre is left of its bounding box. */}
                  <Play size={20} strokeWidth={2} fill="currentColor" style={{ marginLeft: "2px" }} />
                </span>
              </button>
            )}
            {online && playing && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px",
                backgroundColor: "rgba(14,22,42,0.72)", padding: "16px", textAlign: "center",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>{t.connectingTitle}</p>
                <p style={{ fontSize: "11px", color: "var(--gray-300)", fontFamily: "monospace", wordBreak: "break-all" }}>{camera.rtspUrl}</p>
                {/* Says what it is waiting for. A spinner alone would imply the wait ends. */}
                <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, maxWidth: "320px" }}>{t.connectingHint}</p>
                <button
                  onClick={() => setPlaying(false)}
                  style={{ marginTop: "4px", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.3)", background: "none", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  {t.stopPreview}
                </button>
              </div>
            )}
            {!online && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>{t.streamOffline}</span>
              </div>
            )}
            {online && aiFeatures.map((feature, i) => (
              <div key={feature} style={{
                position: "absolute", left: `${12 + i * 10}%`, top: `${60 - i * 14}%`,
                border: `2px solid ${AI_OVERLAY_COLORS[feature]}`, backgroundColor: `${AI_OVERLAY_COLORS[feature]}22`,
                padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, color: "white",
              }}>
                {feature}
              </div>
            ))}
          </div>

          {/*
            Pairs, not ruled rows — and not boxes either.

            This has been through both: eleven tinted boxes (a frame around every two words), then
            label-left / value-right rows divided by hairlines. The rules were doing real work in
            that version, because the label and its value sat at opposite ends of a 600px sheet and
            nothing else tied them together.

            Put the label directly above its value and the pairing needs no line at all: proximity
            groups them, and the sheet loses seven rules. Two columns for the short facts, full
            width for the two that are long, and the small grey label reads as the caption it is.
          */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
            {/* An icon in front of each caption. Six captions in two columns is a block of grey
                text where every line looks like every other one; the marks give each pair a
                different shape to find it by.

                11px at stroke 2.2, which renders a 1.0px line — thinner than the 1.4px Portal
                draws everywhere else, and deliberately so. That standard is set against 13-16px
                icons sitting beside 12-13px text; here the mark sits beside an 11px caption, where
                a 12px glyph at 1.4px was both taller than the letters and heavier than their
                stems. Matching the caption means matching its height and its weight.

                The values under the captions are 700, not 600: they are the content of this sheet
                and the captions are the furniture, so the gap between them should be visible in
                weight as well as in colour. */}
            {([
              [t.zone, camera.zone || "—", <MapIcon key="z" size={11} strokeWidth={2.2} />],
              [t.location, camera.location || "—", <MapPin key="l" size={11} strokeWidth={2.2} />],
              [t.protocol, camera.protocol ?? "TCP", <Network key="p" size={11} strokeWidth={2.2} />],
              [t.coordinates, camera.lat !== undefined && camera.lng !== undefined ? `${camera.lat}, ${camera.lng}` : "—", <Crosshair key="c" size={11} strokeWidth={2.2} />],
              [t.lastDetection, lastDetection ? `${sgtDateKey(lastDetection).slice(5)} ${sgtClockMinutes(lastDetection)}` : t.noRecentDetections, <Clock key="t" size={11} strokeWidth={2.2} />],
              [t.detectionCount, t.detectionCountValue(cameraEvents.length), <Activity key="a" size={11} strokeWidth={2.2} />],
            ] as [string, string, React.ReactNode][]).map(([label, value, icon]) => (
              <div key={label} style={{ minWidth: 0 }}>
                <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", lineHeight: "14px", color: "var(--gray-500)" }}>
                  <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}>{icon}</span>
                  {label}
                </p>
                <p style={{ fontSize: "13px", fontWeight: 700, color: value === "—" || value === t.noRecentDetections ? "var(--gray-400)" : "var(--gray-900)", marginTop: "2px", wordBreak: "break-word" }}>{value}</p>
              </div>
            ))}
            {/* Full width: a stream URL does not fit half a sheet. */}
            <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
              <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", lineHeight: "14px", color: "var(--gray-500)" }}>
                <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}><Link2 size={11} strokeWidth={2.2} /></span>
                {t.rtspUrl}
              </p>
              {/* The same face as every other value, not monospace.
                  It was set in mono on the argument that a URL gets compared character by
                  character — true of a hash or an IP column, but this is one value in a sheet of
                  values, and a different typeface for one of them made it read as code pasted into
                  a form. Same size, same weight, same family: a value is a value. */}
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px", wordBreak: "break-all" }}>{camera.rtspUrl}</p>
            </div>
            <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
              <p style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", lineHeight: "14px", color: "var(--gray-500)" }}>
                <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0 }}><Scan size={11} strokeWidth={2.2} /></span>
                {t.mappedAiEngines}
              </p>
              {/* Text, not chips. Every other value on this sheet is 13px/700 in the body face, and
                  the engines were 10px/600 pills in primary — the one field that looked like a
                  different kind of thing, when it is the same kind: a labelled value. Pills earn
                  their keep in a table, where a value repeats down a column and the shape helps you
                  scan it; in a detail sheet read once, they are decoration with a smaller font. */}
              <p style={{ fontSize: "13px", fontWeight: 700, color: aiFeatures.length === 0 ? "var(--gray-400)" : "var(--gray-900)", marginTop: "2px" }}>
                {aiFeatures.length === 0 ? t.noAiEngines : aiFeatures.join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Close, and nothing else.
            There was a Reconnect button here that wrote "online" onto the camera and toasted
            "Angmokio 3 is back online" — a sentence this console cannot know is true. Nothing in
            the browser can make an RTSP stream come back, so the button's only real effect was to
            mark a camera as working while it was still dark, which is worse than no button. The
            page-level one went for the same reason; when the camera API can actually ask a device
            to reconnect, this is where it comes back. */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
