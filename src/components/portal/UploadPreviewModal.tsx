"use client";

import { useState } from "react";
import { Film as FilmIcon, Image as ImageIcon, Play, ShieldCheck } from "lucide-react";
import { type UploadedMedia } from "@/lib/vcaStore";
import { uploadFileUrl } from "@/lib/uploadBlobs";
import { usePortalLanguage } from "@/lib/i18n";
import { Drawer } from "./PortalShared";

/**
 * A REGISTERED FILE, OPENED — the same move a camera row makes, and the reason the file rows
 * stopped being the one kind of row that did not react to a pointer (owner: 어쨌든 쟤만 호버가
 * 안 되는 게 너무 어색해).
 *
 * PLAY, NOT LIVE. A camera's preview is a stream somebody is watching now; this is a recording
 * that sits still until asked (owner's call: 재생 버튼 눌러서 재생하게끔 해서 실시간이 아니라
 * 영상 재생인 걸 보여주면 될 것 같은데). The play control is what says which of the two this is,
 * so it is the largest thing in the frame and the frame shows nothing until it is pressed.
 *
 * WHAT IT WILL NOT DO IS PRETEND. There is no poster image and no fake progress: an upload row
 * carries no frame, and inventing one would say the analysis has looked at the file (the same
 * reason the table's tile shows a kind icon rather than a stock photo). Where this browser still
 * holds the file — anything picked in this tab since it opened, see lib/uploadBlobs — the video
 * element plays it for real. Where it does not, the control says so and names what is missing:
 * the server's download endpoint. That line is a specification, not an apology.
 */

const T = {
  en: {
    close: "Close",
    play: "Play",
    playImage: "View",
    notHeld: "This browser does not hold the file — it is on the server. Playback needs the download endpoint (HANDOFF §2).",
    uploadedBy: (who: string, when: string) => `${who} · ${when}`,
    analysed: "Analysed",
    pending: "Waiting to be analysed",
    running: "Being analysed",
    failedCheck: "Check failed — no result",
    faces: (n: number) => `${n} face${n === 1 ? "" : "s"} found`,
    verdict: "Deepfake check",
    verdictManipulated: "Manipulated",
    verdictAuthentic: "Authentic",
    verdictInconclusive: "Inconclusive",
    score: (v: number) => `confidence ${Math.round(v * 100)}%`,
    kindVideo: "Video",
    kindImage: "Image",
    kindDeepfake: "Deepfake submission",
    duration: "Length",
    size: "Size",
    resolution: "Resolution",
    unknown: "Not read yet",
  },
  ko: {
    close: "닫기",
    play: "재생",
    playImage: "보기",
    notHeld: "이 브라우저에는 파일이 없습니다 — 서버에 있습니다. 재생은 서버의 내려받기 경로가 붙어야 됩니다(HANDOFF §2).",
    uploadedBy: (who: string, when: string) => `${who} · ${when}`,
    analysed: "분석 완료",
    pending: "분석 대기",
    running: "분석 중",
    failedCheck: "검사 실패 — 결과 없음",
    faces: (n: number) => `얼굴 ${n}개 검출`,
    verdict: "딥페이크 판정",
    verdictManipulated: "조작됨",
    verdictAuthentic: "원본",
    verdictInconclusive: "판정 불가",
    score: (v: number) => `확신도 ${Math.round(v * 100)}%`,
    kindVideo: "영상",
    kindImage: "이미지",
    kindDeepfake: "딥페이크 검사",
    duration: "길이",
    size: "용량",
    resolution: "해상도",
    unknown: "아직 읽지 않음",
  },
} as const;

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string | null {
  if (bytes === undefined) return null;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export default function UploadPreviewModal({ upload, onClose }: { upload: UploadedMedia; onClose: () => void }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  /* Pressed once and then the element takes over. Kept as state rather than autoplaying: a modal
     that starts making noise because somebody clicked a table row is a modal nobody opens twice. */
  const [playing, setPlaying] = useState(false);

  const fileUrl = uploadFileUrl(upload.id);
  const isImage = upload.kind === "image";
  const kindLabel = upload.kind === "image" ? t.kindImage : upload.kind === "deepfake" ? t.kindDeepfake : t.kindVideo;
  const KindIcon = upload.kind === "image" ? ImageIcon : upload.kind === "deepfake" ? ShieldCheck : FilmIcon;

  const facts: { label: string; value: string }[] = [
    ...(isImage ? [] : [{ label: t.duration, value: formatDuration(upload.durationSec) ?? t.unknown }]),
    { label: t.size, value: formatBytes(upload.sizeBytes) ?? t.unknown },
    { label: t.resolution, value: upload.resolution ?? t.unknown },
  ];

  return (
    /* Wider than the panel's default: the stage is a 16:9 frame, and a recording shown 520px wide
       is a thumbnail with controls. */
    <Drawer title={upload.fileName} onClose={onClose} width="672px">
      {/* The name is the panel's heading now, so what is left of that line is the kind of file and
          whose it is. */}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "9px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)", flexShrink: 0 }}>
          <KindIcon size={16} strokeWidth={2.2} />
        </span>
        <p style={{ fontSize: "11px", color: "var(--gray-400)", minWidth: 0 }}>
          {kindLabel} · {t.uploadedBy(upload.uploadedBy, upload.uploadedAt.slice(0, 16).replace("T", " "))}
        </p>
      </div>

      {/* THE STAGE. Dark, 16:9, and empty until asked — a recording at rest. */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", backgroundColor: "var(--gray-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fileUrl && playing && !isImage && (
          <video src={fileUrl} controls autoPlay style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        )}
        {fileUrl && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        )}
        {!(fileUrl && (playing || isImage)) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px", textAlign: "center" }}>
            <button
              onClick={() => { if (fileUrl) setPlaying(true); }}
              disabled={!fileUrl}
              title={fileUrl ? undefined : t.notHeld}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", borderRadius: "999px", border: "none",
                backgroundColor: fileUrl ? "white" : "rgba(255,255,255,0.14)",
                color: fileUrl ? "var(--gray-900)" : "rgba(255,255,255,0.55)",
                fontSize: "13px", fontWeight: 700, cursor: fileUrl ? "pointer" : "not-allowed", fontFamily: "inherit",
              }}>
              <Play size={15} strokeWidth={2.6} />
              {isImage ? t.playImage : t.play}
            </button>
            {/* The reason, written out rather than left as a dead button. */}
            {!fileUrl && (
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, maxWidth: "380px" }}>{t.notHeld}</p>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
        {facts.map(fact => (
          <span key={fact.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>{fact.label}</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "monospace" }}>{fact.value}</span>
          </span>
        ))}
        <span style={{ flex: 1 }} />
        {/* The result, in the same words the row uses — a preview that renamed them would make
            the reader check whether they are the same fact. */}
        <span style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>
            {upload.kind === "deepfake" ? t.verdict : t.analysed}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>
            {/* THREE STATES BEFORE THE RESULT, not two. A failed analysis fell through to
                「분석 중」 here — the drawer told the reader an analysis was running that had
                already given up, and nothing on the panel said otherwise. And on a deepfake
                submission it has to read as the absence of a verdict, not as one. */}
            {upload.status !== "done"
              ? (upload.status === "pending" ? t.pending
                : upload.status === "failed" ? t.failedCheck
                : t.running)
              : upload.kind === "deepfake"
                // 판정 불가 carries no confidence figure, here or in the row: the number is the
                // model's confidence in not knowing, and printing it where "조작 · 확신도 94%"
                // prints makes an absence of an answer look like a measured one.
                ? `${upload.deepfakeVerdict === "manipulated" ? t.verdictManipulated
                    : upload.deepfakeVerdict === "authentic" ? t.verdictAuthentic : t.verdictInconclusive}`
                  + (upload.deepfakeScore !== undefined && upload.deepfakeVerdict !== "inconclusive" ? ` · ${t.score(upload.deepfakeScore)}` : "")
                : upload.detectionCount !== undefined ? t.faces(upload.detectionCount) : t.analysed}
          </span>
        </span>
      </div>
    </Drawer>
  );
}
