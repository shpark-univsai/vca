"use client";

import { useMemo, useState } from "react";
import { useVcaStore, hasPosition, type Camera, type PortalUser } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "@/components/Toast";
import { BORDER, CONTROL_HEIGHT } from "./PortalShared";

/**
 * Which cameras an account may watch.
 *
 * A LIST, NOT A MAP. Fifteen comparable products were checked and none of them grants access by
 * drawing on a map: the map is an input device, the list is the record. A scope you can only see
 * as a shape on a map cannot be read back, cannot be diffed against last month's, and cannot be
 * printed for an access review — which is what somebody actually does with it.
 *
 * ORTHOGONAL TO THE PRESET. A preset says which screens a job opens; which cameras it opens them
 * on is a fact about the site. The same job has different cameras at different installations, so
 * this is reachable in preset mode too and no preset ever carries it. See PortalUser.cameraIds.
 *
 * THE DEFAULT IS ALL, AND IT STAYS ALL UNTIL SOMEBODY NARROWS IT. `undefined` is not "nothing
 * chosen yet" here — it is the answer "every camera on their projects", which is what every
 * existing account holds. Ticking every box is NOT the same thing: that freezes today's list, and
 * a camera added next week would be invisible to them with nobody having decided that.
 */
export default function CameraScopePicker({ user, cameras, onClose }: {
  user: PortalUser;
  /** The cameras of the projects this account holds — the only ones a scope can name. */
  cameras: Camera[];
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const { showToast } = useToast();
  const setCameraScope = useVcaStore(s => s.setCameraScope);

  /** "all" and "some" are the two answers; `undefined` on the account means "all". */
  const [mode, setMode] = useState<"all" | "some">(user.cameraIds === undefined ? "all" : "some");
  const [picked, setPicked] = useState<string[]>(user.cameraIds ?? cameras.map(c => c.id));

  /* Grouped by the zone the installer wrote, because that is how somebody says the answer out
     loud — "the north gate ones". Cameras with no zone sit in their own group rather than being
     dropped: a gap in the register must not quietly shrink the list somebody is granting from. */
  const groups = useMemo(() => {
    const map = new Map<string, Camera[]>();
    cameras.forEach(c => {
      const key = c.zone?.trim() || "";
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return [...map.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));
  }, [cameras]);

  const toggle = (id: string) => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleGroup = (ids: string[]) => {
    const allOn = ids.every(id => picked.includes(id));
    setPicked(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  /* Zero is refused, for the reason the invite form refuses zero screens: it saves an account that
     signs in, opens a screen it was granted, and finds nothing on it — a product that looks broken
     to the person it was made for. Suspending somebody is how you stop them, and it says so. */
  const canSave = mode === "all" || picked.length > 0;
  const dirty = mode === "all"
    ? user.cameraIds !== undefined
    : user.cameraIds === undefined || [...picked].sort().join() !== [...user.cameraIds].sort().join();

  const save = () => {
    if (!canSave || !dirty) return;
    setCameraScope(user.id, mode === "all" ? undefined : picked);
    showToast({
      variant: "success",
      title: t.savedTitle,
      desc: mode === "all" ? t.savedAll(user.name) : t.savedSome(user.name, picked.length),
    });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "480px", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.title}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "6px" }}>{t.intro(user.name)}</p>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
          {([["all", t.optAll, t.optAllDesc], ["some", t.optSome, t.optSomeDesc]] as const).map(([value, label, desc]) => {
            const on = mode === value;
            return (
              <button key={value} onClick={() => setMode(value)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left",
                  padding: "10px 12px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                  border: on ? "1px solid var(--gray-900)" : BORDER,
                  backgroundColor: on ? "var(--gray-100)" : "white",
                }}>
                <span style={{ width: "14px", height: "14px", borderRadius: "999px", flexShrink: 0, marginTop: "2px", border: on ? "4px solid var(--gray-900)" : "1px solid var(--gray-300)" }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</span>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "2px" }}>{desc}</span>
                </span>
              </button>
            );
          })}

          {/* The list stays on screen under "all" as well, greyed. Hiding it answers "which
              cameras does all mean?" with silence, and this is the one question the reader came
              with — the same reason the grant rows stay visible in preset mode. */}
          <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: "12px", opacity: mode === "all" ? 0.5 : 1 }}>
            {groups.map(([zone, group]) => {
              const allOn = group.every(c => picked.includes(c.id));
              return (
                <div key={zone || "__none"} style={{ marginBottom: "10px" }}>
                  <button
                    onClick={mode === "some" ? () => toggleGroup(group.map(c => c.id)) : undefined}
                    disabled={mode === "all"}
                    style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "none", padding: "0 0 4px", cursor: mode === "some" ? "pointer" : "default", fontFamily: "inherit" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)" }}>
                      {zone || t.noZone} · {group.length}
                    </span>
                    {mode === "some" && (
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--gray-500)" }}>{allOn ? t.clearGroup : t.pickGroup}</span>
                    )}
                  </button>
                  {group.map(c => {
                    const on = mode === "all" || picked.includes(c.id);
                    return (
                      <button key={c.id} onClick={mode === "some" ? () => toggle(c.id) : undefined} disabled={mode === "all"}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "7px 8px", borderRadius: "8px", border: "none", backgroundColor: "transparent", cursor: mode === "some" ? "pointer" : "default", fontFamily: "inherit" }}>
                        <span style={{ width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0, border: on ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)", backgroundColor: on ? "var(--gray-900)" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {on && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span style={{ minWidth: 0, fontSize: "12.5px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        {/* Said, not coloured. A camera nobody surveyed is a gap in the register,
                            not a fault — and this list is where somebody notices it. */}
                        {!hasPosition(c) && (
                          <span style={{ flexShrink: 0, fontSize: "10px", color: "var(--gray-400)" }}>{t.noCoords}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "16px 20px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          {/* The dead button says why, in the two sentences that are actually different: nothing
              has moved, or this would leave them with no camera at all. */}
          {!(canSave && dirty) && (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>
              {!canSave ? t.refuseEmpty : t.unchanged}
            </span>
          )}
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={save} disabled={!(canSave && dirty)}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canSave && dirty ? "var(--primary-400)" : "var(--gray-200)", color: canSave && dirty ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave && dirty ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

const T = {
  en: {
    title: "Cameras",
    intro: (name: string) => `Which cameras ${name} may watch in the monitoring app. Portal is unaffected — an administrator manages every camera on the site.`,
    optAll: "Every camera on their projects",
    optAllDesc: "Including cameras added later. This is what an account holds unless somebody narrows it.",
    optSome: "Only the cameras picked below",
    optSomeDesc: "A camera added later is not included until somebody adds it here.",
    noZone: "No zone",
    noCoords: "no coordinates",
    pickGroup: "select all",
    clearGroup: "clear",
    refuseEmpty: "Pick at least one camera — an account with none opens a screen with nothing on it",
    unchanged: "Nothing changed yet.",
    cancel: "Cancel",
    apply: "Change",
    savedTitle: "Cameras updated",
    savedAll: (name: string) => `${name} can watch every camera on their projects.`,
    savedSome: (name: string, n: number) => `${name} can watch ${n} camera${n === 1 ? "" : "s"}.`,
  },
  ko: {
    title: "카메라 범위",
    intro: (name: string) => `${name}이(가) 관제 앱에서 볼 수 있는 카메라입니다. Portal은 영향받지 않습니다 — 관리자는 현장의 모든 카메라를 관리합니다.`,
    optAll: "담당 프로젝트의 카메라 전부",
    optAllDesc: "나중에 추가되는 카메라도 포함합니다. 아무도 좁히지 않으면 계정은 이 상태입니다.",
    optSome: "아래에서 고른 카메라만",
    optSomeDesc: "나중에 추가되는 카메라는 여기에 넣기 전까지 포함되지 않습니다.",
    noZone: "구역 미지정",
    noCoords: "좌표 없음",
    pickGroup: "전체 선택",
    clearGroup: "해제",
    refuseEmpty: "카메라를 하나 이상 골라주세요 — 하나도 없으면 화면을 열어도 아무것도 없습니다",
    unchanged: "아직 바뀐 것이 없습니다.",
    cancel: "취소",
    apply: "변경",
    savedTitle: "카메라 범위를 바꿨습니다",
    savedAll: (name: string) => `${name}이(가) 담당 프로젝트의 카메라를 전부 볼 수 있습니다.`,
    savedSome: (name: string, n: number) => `${name}이(가) 카메라 ${n}대를 볼 수 있습니다.`,
  },
} as const;
