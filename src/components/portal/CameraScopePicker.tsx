"use client";

import { useMemo, useState } from "react";
import { useVcaStore, hasPosition, type Camera, type PortalUser } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "@/components/Toast";
import { BORDER, CONTROL_HEIGHT, TextField } from "./PortalShared";

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
 *
 * GROUPS FIRST, THEN THE ODD CAMERA (owner, 2026-09-21: 볼수있는 카메라도 그룹지어서 권한을
 * 주고싶거든 물론 카메라 한대만 보는 사람도 있을 순 있지만). A group is the unit somebody says
 * out loud, and it keeps working as the site grows: a camera added to the group next month is
 * granted to everybody holding it. An individual camera is the exception, not the rule, so it
 * sits under the groups — and a camera a group already covers says so instead of pretending to
 * be a separate decision. See CameraGroup for why this is a real object rather than the zone
 * label, and for what Milestone does differently.
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

  const allGroups = useVcaStore(s => s.cameraGroups);
  /* The groups of the projects this account holds. A group belongs to one project, so an account
     on two sites can be given a group from each. */
  const projectGroups = useMemo(() => {
    const projectIds = new Set(user.projectIds);
    return allGroups.filter(g => projectIds.has(g.projectId));
  }, [allGroups, user.projectIds]);

  /** "all" and "some" are the two answers; both fields absent on the account means "all". */
  const narrowed = user.cameraIds !== undefined || user.cameraGroupIds !== undefined;
  const [mode, setMode] = useState<"all" | "some">(narrowed ? "some" : "all");
  const [pickedGroups, setPickedGroups] = useState<string[]>(user.cameraGroupIds ?? []);
  const [picked, setPicked] = useState<string[]>(user.cameraIds ?? (narrowed ? [] : cameras.map(c => c.id)));

  /*
   * A THOUSAND CAMERAS IS THE REAL SITE, NOT THE SEED (owner, 2026-09-21: 실제 현장에서는 연결된
   * 카메라 대수가 1000대이상일 수 있어서). Measured on the seeded register — 62 cameras in 18
   * zones — this dialog rendered 95 buttons and 437 nodes in one 792px scroll box WITH NO SEARCH
   * FIELD AT ALL. At a thousand that is ~1,060 buttons and ~4,600 nodes, and the part that breaks
   * first is not the browser: there is no way to find a camera you know the name of.
   *
   * So two things, and neither is virtualisation: a search box, and zones that start CLOSED once
   * the register is big enough that reading it top to bottom is not how anybody would use it.
   * Closed zones are still granted whole from their header, which is how a big site is actually
   * scoped — by the north gate, not by camera 700.
   */
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  /* The threshold is a screenful. 40 rows is about what this box shows without scrolling past the
     footer, so below it the list IS the answer and closing it would only add clicks. Above it the
     list is a haystack. One rule for both states rather than a second mode to learn. */
  const zonesStartOpen = cameras.length <= 40;
  const [openZones, setOpenZones] = useState<string[]>(() => zonesStartOpen ? cameras.map(c => c.zone?.trim() || "") : []);
  const toggleZoneOpen = (zone: string) =>
    setOpenZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);

  /** Cameras a picked group already brings — shown as included rather than offered again. */
  const coveredByGroup = useMemo(() => {
    const ids = new Set<string>();
    pickedGroups.forEach(id => projectGroups.find(g => g.id === id)?.cameraIds.forEach(c => ids.add(c)));
    return ids;
  }, [pickedGroups, projectGroups]);

  /** What this account will actually see — the union, which is the only number that matters. */
  const resolvedCount = useMemo(() => {
    const ids = new Set(picked);
    coveredByGroup.forEach(id => ids.add(id));
    return [...ids].filter(id => cameras.some(c => c.id === id)).length;
  }, [picked, coveredByGroup, cameras]);

  /* Grouped by the zone the installer wrote, because that is how somebody says the answer out
     loud — "the north gate ones". Cameras with no zone sit in their own group rather than being
     dropped: a gap in the register must not quietly shrink the list somebody is granting from. */
  const zoneGroups = useMemo(() => {
    const map = new Map<string, Camera[]>();
    cameras.forEach(c => {
      const key = c.zone?.trim() || "";
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return [...map.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));
  }, [cameras]);

  /* What the search leaves. Name AND code, because an operator knows one or the other and the
     register prints both. A zone whose own name matches keeps all of its cameras — "north gate"
     is how somebody searches for the whole zone. Empty query: everything, untouched. */
  const shownZones = useMemo(() => {
    if (!needle) return zoneGroups;
    return zoneGroups
      .map(([zone, group]) => {
        if (zone.toLowerCase().includes(needle)) return [zone, group] as [string, Camera[]];
        return [zone, group.filter(c =>
          c.name.toLowerCase().includes(needle) || (c.code ?? "").toLowerCase().includes(needle),
        )] as [string, Camera[]];
      })
      .filter(([, group]) => group.length > 0);
  }, [zoneGroups, needle]);
  const shownCount = useMemo(() => shownZones.reduce((n, [, g]) => n + g.length, 0), [shownZones]);

  const toggleGroupPick = (id: string) =>
    setPickedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggle = (id: string) => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleGroup = (ids: string[]) => {
    const allOn = ids.every(id => picked.includes(id));
    setPicked(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  /* Zero is refused, for the reason the invite form refuses zero screens: it saves an account that
     signs in, opens a screen it was granted, and finds nothing on it — a product that looks broken
     to the person it was made for. Suspending somebody is how you stop them, and it says so. */
  /*
   * "EVERYTHING, TICKED" IS THE ONE ANSWER THAT LIES LATER.
   *
   * An account nobody has narrowed opens this dialog with every camera pre-ticked, so switching to
   * 직접 고르기 and pressing save writes today's whole register as an explicit list — which looks
   * identical to "all cameras" on the day it is saved and excludes every camera installed after
   * it. The invite form states the same rule where it decides NOT to send a camera list.
   *
   * It is not forbidden, because "all but two" is a real scope and this is how somebody builds it.
   * It is SAID, at the moment it would be saved, with the way out named: the first option.
   *
   * Found by the zones-closed change (2026-09-21): with the zones open, at least the ticks were on
   * screen. Closed, the reader saw eighteen zone headers reading "5대 고름" and no reason to think
   * anything was frozen.
   */
  const wouldFreezeAll = mode === "some" && cameras.length > 0 && resolvedCount === cameras.length;
  const canSave = mode === "all" || resolvedCount > 0;
  const sameIds = (a: string[] | undefined, b: string[]) =>
    a !== undefined && [...a].sort().join() === [...b].sort().join();
  const dirty = mode === "all"
    ? narrowed
    : !narrowed || !sameIds(user.cameraIds, picked) || !sameIds(user.cameraGroupIds, pickedGroups);

  const save = () => {
    if (!canSave || !dirty) return;
    setCameraScope(
      user.id,
      mode === "all" ? undefined : picked,
      mode === "all" ? undefined : pickedGroups,
    );
    showToast({
      variant: "success",
      title: t.savedTitle,
      desc: mode === "all" ? t.savedAll(user.name) : t.savedSome(user.name, resolvedCount),
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

          {/* GROUPS FIRST: the unit somebody actually says, and the one that keeps up with the
              site. Greyed under "all" like the camera list below, for the same reason — hiding it
              answers "what would I be choosing from?" with silence. */}
          <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: "12px", opacity: mode === "all" ? 0.5 : 1 }}>
            <p style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)", paddingBottom: "6px" }}>
              {t.groupsHeading}
            </p>
            {projectGroups.length === 0 ? (
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5, paddingBottom: "6px" }}>{t.groupsNone}</p>
            ) : (
              <>
                {projectGroups.map(g => {
                  const on = pickedGroups.includes(g.id);
                  return (
                    <button key={g.id} onClick={mode === "some" ? () => toggleGroupPick(g.id) : undefined} disabled={mode === "all"}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "7px 8px", borderRadius: "8px", border: "none", backgroundColor: "transparent", cursor: mode === "some" ? "pointer" : "default", fontFamily: "inherit" }}>
                      <span style={{ width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0, border: on ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)", backgroundColor: on ? "var(--gray-900)" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span style={{ minWidth: 0, fontSize: "12.5px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                      <span style={{ flexShrink: 0, fontSize: "10px", color: "var(--gray-400)" }}>{t.groupCount(g.cameraIds.length)}</span>
                    </button>
                  );
                })}
                {/* Said where the choice is made, because it is the one thing that separates a
                    group from a list of ids and it cannot be seen by looking at the rows. */}
                <p style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1.5, padding: "4px 8px 0" }}>{t.groupGrows}</p>
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--gray-200)", paddingTop: "12px", opacity: mode === "all" ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", paddingBottom: "6px" }}>
              <p style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)" }}>
                {t.camerasHeading}
              </p>
              {/* The count of what the search left, not of the register — the register's total is
                  already in the sentence at the top and repeating it here would say nothing. */}
              {needle !== "" && (
                <span style={{ fontSize: "10.5px", color: "var(--gray-400)" }}>{t.searchHits(shownCount)}</span>
              )}
            </div>
            {/* THE FIELD THAT WAS MISSING. Disabled under "all" like everything else in this
                block: searching a list you are not choosing from is a control that does nothing. */}
            <div style={{ paddingBottom: "10px" }}>
              <TextField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} disabled={mode === "all"} />
            </div>
            {shownZones.length === 0 && (
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5, padding: "2px 0 6px" }}>{t.searchNone}</p>
            )}
            {shownZones.map(([zone, group]) => {
              const allOn = group.every(c => picked.includes(c.id));
              /* A search opens what it finds: closing a zone that matched would hide the only
                 reason it is on screen. Otherwise the reader's own toggle decides. */
              const open = needle !== "" || openZones.includes(zone);
              return (
                <div key={zone || "__none"} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "4px" }}>
                    {/* TWO CONTROLS, TWO JOBS. The name opens the zone, the words beside it grant
                        it whole — a big site is scoped by the zone, and making the header do only
                        one of those would force a reader to open 18 zones to grant three. */}
                    <button type="button" onClick={() => toggleZoneOpen(zone)}
                      style={{ display: "flex", alignItems: "center", gap: "5px", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                        style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms", flexShrink: 0 }}>
                        <path d="M3 1.5L7 5l-4 3.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)" }}>
                        {zone || t.noZone} · {group.length}
                      </span>
                    </button>
                    {mode === "some" && (
                      <button type="button" onClick={() => toggleGroup(group.map(c => c.id))}
                        style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "10.5px", fontWeight: 700, color: "var(--gray-500)" }}>
                        {allOn ? t.clearGroup : t.pickGroup}
                      </button>
                    )}
                    {/* A closed zone still has to say what it is holding, or the reader has to open
                        it to find out whether it is already granted. */}
                    {!open && mode === "some" && (
                      <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                        {t.zonePicked(group.filter(c => picked.includes(c.id) || coveredByGroup.has(c.id)).length)}
                      </span>
                    )}
                  </div>
                  {open && group.map(c => {
                    const byGroup = coveredByGroup.has(c.id);
                    const on = mode === "all" || byGroup || picked.includes(c.id);
                    return (
                      <button key={c.id} onClick={mode === "some" && !byGroup ? () => toggle(c.id) : undefined} disabled={mode === "all" || byGroup}
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
                        {/* Why it is ticked when nobody ticked it here. Without this the reader
                            unticks a camera, nothing happens, and the checkbox looks broken. */}
                        {byGroup && (
                          <span style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "var(--primary-400)" }}>{t.viaGroup}</span>
                        )}
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
          {wouldFreezeAll ? (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.45 }}>{t.freezeWarning}</span>
          ) : !(canSave && dirty) ? (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>
              {!canSave ? t.refuseEmpty : t.unchanged}
            </span>
          ) : (
            /* THE ONE NUMBER THAT MATTERS, where the decision is confirmed. Groups and individual
               cameras overlap, so neither count answers "how much of the site is this" — the union
               does, and it is what the table will show afterwards. */
            <span style={{ flex: 1, fontSize: "11px", fontWeight: 700, color: "var(--gray-600)", lineHeight: 1.45 }}>
              {mode === "all" ? t.optAll : t.resolved(resolvedCount)}
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
    optSome: "Only the groups and cameras picked below",
    optSomeDesc: "A group keeps up with the site — a camera added to it later is included. An individual camera is not.",
    groupsHeading: "Camera groups",
    groupsNone: "No groups on these projects yet. Select cameras in Input Sources and group them there.",
    groupCount: (n: number) => `${n} camera${n === 1 ? "" : "s"}`,
    groupGrows: "Picking a group grants whatever is in it later, too.",
    viaGroup: "in a group",
    camerasHeading: "Individual cameras",
    resolved: (n: number) => `Sees ${n} camera${n === 1 ? "" : "s"} right now`,
    noZone: "No zone",
    noCoords: "no coordinates",
    pickGroup: "select all",
    clearGroup: "clear",
    searchPlaceholder: "Search by name or code",
    searchHits: (n: number) => `${n} found`,
    searchNone: "No camera on these projects matches that.",
    freezeWarning: "Every camera is ticked. Saved like this the list is frozen, and cameras added later are left out — pick the first option to include them.",
    zonePicked: (n: number) => n === 0 ? "none picked" : `${n} picked`,
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
    optSome: "아래에서 고른 그룹과 카메라만",
    optSomeDesc: "그룹은 현장을 따라갑니다 — 나중에 그룹에 들어온 카메라도 포함됩니다. 개별 카메라는 그렇지 않습니다.",
    groupsHeading: "카메라 그룹",
    groupsNone: "이 프로젝트에 아직 그룹이 없습니다. 입력 소스에서 카메라를 골라 그룹으로 묶으세요.",
    groupCount: (n: number) => `카메라 ${n}대`,
    groupGrows: "그룹을 고르면 나중에 그 그룹에 들어오는 카메라도 함께 주어집니다.",
    viaGroup: "그룹 포함",
    camerasHeading: "개별 카메라",
    resolved: (n: number) => `지금 보는 카메라 ${n}대`,
    noZone: "구역 미지정",
    noCoords: "좌표 없음",
    pickGroup: "전체 선택",
    clearGroup: "해제",
    searchPlaceholder: "이름이나 코드로 검색",
    searchHits: (n: number) => `${n}대`,
    searchNone: "그 조건에 맞는 카메라가 없습니다.",
    freezeWarning: "전부 체크돼 있습니다. 이대로 저장하면 목록이 굳어서 나중에 추가되는 카메라는 빠집니다 — 함께 주려면 위의 첫 번째를 고르세요.",
    zonePicked: (n: number) => n === 0 ? "고른 것 없음" : `${n}대 고름`,
    refuseEmpty: "카메라를 하나 이상 골라주세요 — 하나도 없으면 화면을 열어도 아무것도 없습니다",
    unchanged: "아직 바뀐 것이 없습니다.",
    cancel: "취소",
    apply: "변경",
    savedTitle: "카메라 범위를 바꿨습니다",
    savedAll: (name: string) => `${name}이(가) 담당 프로젝트의 카메라를 전부 볼 수 있습니다.`,
    savedSome: (name: string, n: number) => `${name}이(가) 카메라 ${n}대를 볼 수 있습니다.`,
  },
} as const;
