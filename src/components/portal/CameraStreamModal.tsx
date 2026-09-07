"use client";

import { useVcaStore, type Camera } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { BORDER } from "./PortalShared";
import { usePortalLanguage } from "@/lib/i18n";

const AI_OVERLAY_COLORS: Record<string, string> = {
  "Re-ID Analysis": "var(--success-400)",
  "License Plate Recognition": "var(--primary-400)",
};

const T = {
  en: {
    live: "LIVE",
    streamOffline: "Stream offline",
    zone: "Zone",
    location: "Location",
    protocol: "Protocol",
    coordinates: "Coordinates",
    rtspUrl: "RTSP Stream URL",
    mappedAiEngines: "Mapped AI engines",
    noAiEngines: "No AI engines mapped to this camera yet.",
    recentActivity: "Recent activity",
    noRecentDetections: "No recent detections at this camera.",
    close: "Close",
    reconnect: "Reconnect",
    reconnectedTitle: "Reconnected",
    reconnectedDesc: (name: string) => `${name} is back online.`,
  },
  ko: {
    live: "실시간",
    streamOffline: "스트리밍 오프라인",
    zone: "구역",
    location: "위치",
    protocol: "프로토콜",
    coordinates: "좌표",
    rtspUrl: "RTSP 스트림 URL",
    mappedAiEngines: "연결된 AI 엔진",
    noAiEngines: "이 카메라에 연결된 AI 엔진이 아직 없습니다.",
    recentActivity: "최근 활동",
    noRecentDetections: "이 카메라에서 최근 감지된 내역이 없습니다.",
    close: "닫기",
    reconnect: "재연결",
    reconnectedTitle: "재연결됨",
    reconnectedDesc: (name: string) => `${name} 카메라가 다시 연결되었습니다.`,
  },
} as const;

export default function CameraStreamModal({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  useEscapeKey(onClose);
  const events = useVcaStore(s => s.events);
  const setCameraStatus = useVcaStore(s => s.setCameraStatus);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const online = camera.status === "online";
  const recentEvents = events.filter(e => e.cameraId === camera.id).slice(0, 5);
  const aiFeatures = camera.aiFeatures ?? [];

  const reconnect = () => {
    setCameraStatus(camera.id, "online");
    showToast({ variant: "success", title: t.reconnectedTitle, desc: t.reconnectedDesc(camera.name) });
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "640px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: online ? "var(--success-400)" : "var(--gray-400)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{camera.name}</p>
              <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{camera.code}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Preview */}
          <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", aspectRatio: "16 / 9", backgroundColor: "var(--gray-900)" }}>
            <img src={camera.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: online ? 1 : 0.4 }} />
            {online && (
              <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(14,22,42,0.7)", padding: "4px 10px", borderRadius: "999px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--success-400)" }} />
                <span style={{ fontSize: "10px", fontWeight: 600, color: "white" }}>{t.live}</span>
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

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              [t.zone, camera.zone || "—"],
              [t.location, camera.location || "—"],
              [t.protocol, camera.protocol ?? "TCP"],
              [t.coordinates, camera.lat && camera.lng ? `${camera.lat}, ${camera.lng}` : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "8px 10px", borderRadius: "10px", backgroundColor: "var(--gray-50)", border: BORDER }}>
                <p style={{ fontSize: "10px", color: "var(--gray-400)", fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginTop: "2px" }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: "8px 10px", borderRadius: "10px", backgroundColor: "var(--gray-50)", border: BORDER }}>
            <p style={{ fontSize: "10px", color: "var(--gray-400)", fontWeight: 600 }}>{t.rtspUrl}</p>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-600)", fontFamily: "monospace", marginTop: "2px", wordBreak: "break-all" }}>{camera.rtspUrl}</p>
          </div>

          {/* AI features */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "8px" }}>{t.mappedAiEngines}</p>
            {aiFeatures.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noAiEngines}</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {aiFeatures.map(f => (
                  <span key={f} style={{ fontSize: "10px", fontWeight: 600, color: "var(--primary-400)", backgroundColor: "var(--primary-100)", padding: "4px 10px", borderRadius: "999px" }}>{f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity — real detection events tied to this camera */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "8px" }}>{t.recentActivity}</p>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{t.noRecentDetections}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentEvents.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "10px", backgroundColor: "var(--gray-50)", border: BORDER }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{e.personName ?? e.type}</span>
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: "999px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.close}
          </button>
          <button onClick={reconnect} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "999px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M12.25 7A5.25 5.25 0 1 1 10.5 3.15M12.25 1.75V4.67h-2.92" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.reconnect}
          </button>
        </div>
      </div>
    </div>
  );
}
