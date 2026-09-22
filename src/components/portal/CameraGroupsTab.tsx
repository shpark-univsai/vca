"use client";

import { useState } from "react";
import {
  cameraGroupsInProject, camerasInProject, useVcaStore, type Camera, type CameraGroup,
} from "@/lib/vcaStore";
import CameraMapView from "./CameraMapView";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TextField,
  ConfirmModal, FieldError, RowActionsMenu, usePortalEditAccess,
} from "./PortalShared";

/**
 * CAMERA GROUPS, ON THE SCREEN THAT HANDS THEM OUT.
 *
 * The owner's question (2026-09-21): 권한을 주기위한 카메라 그룹을 계정, 명부대기, 옆에 탭을
 * 새로 만들어서 그룹핑하게끔 할까? Yes for the LIST, no for the membership — and the split is the
 * point of this file.
 *
 * WHERE THE PRODUCTS PUT IT. Milestone keeps device groups in the device tree, with the devices;
 * Verkada's equivalent (sites) is an org-structure object managed away from the user list. Both
 * put the grouping where the cameras are, because that is where you can see, search and filter
 * them — and ours does too: a group can also be created from the selection on Input Sources,
 * which already has the search, the kind filter and the map.
 *
 * WHAT THIS TAB IS FOR is the question the OTHER screen cannot answer: who holds this group. An
 * access review arrives asking "which accounts can watch the north gate", and until now the only
 * way to answer was to open every account's scope dialog one at a time. That is the reverse
 * lookup every card carries, and it is also where a group is renamed, described, refilled or
 * deleted, because all of those are access changes: deleting one narrows everybody who held it
 * (removeCameraGroup prunes the scopes and says how many in the audit line).
 *
 * CARDS, NOT A TABLE (owner, 2026-09-22, choosing from a reference mockup). A table row is the
 * right shape when its columns are being compared down the page; these are not compared, they are
 * RECOGNISED — "is there already a group like the one I am about to make" is answered by reading a
 * name, a purpose line and a few camera names together, which is a card. The count of accounts
 * holding it stays on every card, because that is this tab's own question.
 *
 * ONLY THE STRUCTURE CAME FROM THE MOCKUP (owner: 그 보낸준 코드의 색깔을 따라갈 필요는없어 우리가
 * 만들어준 컬러와 폰트 시스템과 컨텐츠 자체는 바꾸지않아야하거든). Its per-card indigo and emerald
 * folder icons, its coloured count pills and its explanation sentences are not here: greys by
 * default, our own wording, and no line that the layout already says.
 */

const T = {
  en: {
    empty: "No groups on this project yet.",
    cameras: (n: number) => `${n} camera${n === 1 ? "" : "s"}`,
    camerasNone: "Empty",
    holders: (n: number) => `Held by ${n} account${n === 1 ? "" : "s"}`,
    holdersNone: "Held by nobody",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    cardEdit: "Edit",
    remove: "Delete", cancel: "Cancel",
    goToCameras: "Go to Input Sources",
    newCard: "New group",
    membersSearch: "Search by name or code",
    membersNone: "No camera on this project matches that.",
    andMore: (n: number) => `and ${n} more`,
    noZone: "No zone",
    zonePick: "select all", zoneClear: "clear",
    allPick: "Select all", allClear: "Clear selection",
    inGroupHeading: "In this group",
    inGroupUnknown: "No longer registered",
    inGroupRemove: "Take out of the group",
    viewList: "List", viewMap: "Map",
    drawerNew: "New camera group",
    drawerEdit: (label: string) => `Edit ${label}`,
    createSave: "Create group",
    editSave: "Save",
    createName: "Group name",
    createNamePlaceholder: (example: string) => `e.g. ${example}`,
    createNameExample: (zone: string) => `${zone} and around`,
    createNameExampleNoZone: "Front and back gate",
    descField: "What it is for",
    descOptional: "optional",
    createButton: "New group",
    createdToast: "Camera group created",
    savedToast: "Camera group saved",
    inOtherGroups: (n: number) => `in ${n} other`,
    inOtherGroupsTitle: (names: string) => `Also in: ${names}`,
    pickedCount: (n: number) => `${n} picked`,
    zonePicked: (n: number) => n === 0 ? "none in the group" : `${n} in the group`,
    duplicate: "Another group on this project already has that name.",
    removeTitle: (label: string) => `Delete ${label}?`,
    removeBody: "Every account holding this group loses those cameras, unless another group or an individual camera still covers them. The cameras themselves are untouched.",
    removeWithHolders: (n: number) => `${n} account${n === 1 ? "" : "s"} hold${n === 1 ? "s" : ""} it right now.`,
    removeConfirm: "Delete group",
    removedToast: "Group deleted",
    notOwner: "Only an owner changes camera groups.",
  },
  ko: {
    empty: "이 프로젝트에 아직 그룹이 없습니다.",
    cameras: (n: number) => `${n}대`,
    camerasNone: "비어 있음",
    holders: (n: number) => `${n}개 계정이 가짐`,
    holdersNone: "가진 계정 없음",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    cardEdit: "편집",
    remove: "삭제", cancel: "취소",
    goToCameras: "입력 소스로 가기",
    newCard: "새 그룹",
    membersSearch: "이름이나 코드로 검색",
    membersNone: "그 조건에 맞는 카메라가 이 프로젝트에 없습니다.",
    andMore: (n: number) => `외 ${n}대`,
    noZone: "구역 미지정",
    zonePick: "전체 선택", zoneClear: "해제",
    allPick: "전부 고르기", allClear: "선택 초기화",
    inGroupHeading: "이 그룹에 들어있는 것",
    inGroupUnknown: "등록부에 없는 카메라",
    inGroupRemove: "그룹에서 빼기",
    viewList: "목록", viewMap: "지도",
    drawerNew: "새 카메라 그룹",
    drawerEdit: (label: string) => `${label} 수정`,
    createSave: "그룹 만들기",
    editSave: "저장",
    createName: "그룹 이름",
    createNamePlaceholder: (example: string) => `예: ${example}`,
    createNameExample: (zone: string) => `${zone} 일대`,
    createNameExampleNoZone: "정문·후문",
    descField: "무엇에 쓰는 그룹인지",
    descOptional: "선택",
    createButton: "그룹 만들기",
    createdToast: "카메라 그룹을 만들었습니다",
    savedToast: "카메라 그룹을 저장했습니다",
    inOtherGroups: (n: number) => `다른 그룹 ${n}`,
    inOtherGroupsTitle: (names: string) => `여기에도 있음: ${names}`,
    pickedCount: (n: number) => `${n}대 체크됨`,
    zonePicked: (n: number) => n === 0 ? "그룹에 없음" : `그룹에 ${n}대`,
    duplicate: "이 프로젝트에 같은 이름의 그룹이 이미 있습니다.",
    /* 을(를) 없이 — 조사 두 개를 괄호로 내보이는 문장은 제품이 이름을 모른다는 뜻입니다. */
    removeTitle: (label: string) => `「${label}」 삭제할까요?`,
    removeBody: "이 그룹을 가진 계정은 그 카메라들을 잃습니다 — 다른 그룹이나 개별 카메라로 덮이는 경우는 제외입니다. 카메라 자체는 그대로 있습니다.",
    removeWithHolders: (n: number) => `지금 ${n}개 계정이 갖고 있습니다.`,
    removeConfirm: "그룹 삭제",
    removedToast: "그룹을 삭제했습니다",
    notOwner: "카메라 그룹은 최고관리자만 바꿉니다.",
  },
};

type Dict = typeof T.en;

/**
 * How many member names a card prints before it says 「외 N대」.
 *
 * The cap is what keeps a 3-camera group and a 40-camera group the same height in one grid;
 * without it a long group stretches its row and pushes its neighbours' footers out of line. Six
 * is two rows of three at the width the grid gives a card, and the number is checked by
 * measurement rather than by eye — see the note on the grid below.
 */
const CARD_CHIP_CAP = 6;

/**
 * MAKING A GROUP AND CHANGING ONE, IN A DRAWER OFF THE RIGHT EDGE.
 *
 * The owner asked for the map here (2026-09-21): 입력소스 화면에 넣었던 지도를 여기 카메라
 * 그룹에도 넣어서 지도에서 그룹핑할수있게해줘. A group is assembled the way a site is described,
 * and a site is described by pointing at it.
 *
 * WHY A DRAWER AND NOT THE IN-PAGE PANE IT REPLACED (owner, 2026-09-22: 그룹편집도 이렇게하거든).
 * The pane existed to satisfy an earlier requirement — 그룹테이블이 좁아지면서 기존에 테이블이
 * 어떤게 있는지보고 편집 — by narrowing the table beside it. Cards cannot narrow, so that device
 * is gone; the drawer keeps the requirement a different way, by covering only the right edge and
 * leaving the grid behind it readable.
 *
 * TWO WAYS IN, ONE SELECTION. The list has the search and the zone grouping; the map has the
 * geography. They write the same `picked` set, so twenty ticked in the list and two clicked on the
 * map are twenty-two in the group — the same rule the bulk selection on Input Sources follows, and
 * for the same reason: a second selection would be a second answer to "what is in this group".
 *
 * OVERLAP IS ALLOWED AND SAID OUT LOUD (owner: 카메라들이 중복으로도 그룹핑 될수있을것같구).
 * Nothing in the data model ever forbade it — a duplicate NAME is refused, membership is not —
 * but a checkbox list gives no hint either way, and an administrator who assumes exclusivity will
 * not build the groups they actually need (the gate camera belongs to 정문 and to 야간 순찰 both).
 * So each row says how many other groups hold that camera and names them on hover.
 *
 * NO ESCAPE KEY, AND THE SCRIM DOES NOT CLOSE IT. Both are the ordinary way out of a dialog and
 * both would throw away a half-built group with no undo. ✕ and 취소 are the ways out, and they are
 * gestures the reader chose deliberately.
 */
function GroupDrawer({ group, cameras, otherGroups, t, onSave, onClose }: {
  /** The group being changed, or null while one is being made. */
  group: CameraGroup | null;
  /** The project's register — full cameras, because the map needs the coordinates and the status. */
  cameras: Camera[];
  /** Every other group of this project, for the "also in" count. */
  otherGroups: CameraGroup[];
  t: Dict;
  /** Returns an error key when the name is taken, so the field can say so without closing. */
  onSave: (label: string, description: string, cameraIds: string[]) => "duplicate-label" | null;
  onClose: () => void;
}) {
  const creating = group === null;
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(group?.cameraIds ?? []);
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const matching = needle === ""
    ? cameras
    : cameras.filter(c => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));

  /* Grouped by the register's own zone, like the scope picker: "the north gate ones" is how
     somebody says it, and a camera with no zone keeps its own group rather than disappearing. */
  const byZone = new Map<string, Camera[]>();
  matching.forEach(c => {
    const key = c.zone?.trim() || "";
    byZone.set(key, [...(byZone.get(key) ?? []), c]);
  });
  const zones = [...byZone.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));

  const toggle = (id: string) => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /*
   * THE PLACEHOLDER IS AN EXAMPLE, NOT A DESCRIPTION OF ONE.
   *
   * It read 「사람들이 입으로 부르는 말」 — the KIND of answer wanted, which leaves the reader to
   * invent the shape. The invite form's address field had the same fault and was fixed the same
   * way: show something this field would actually accept. The two groups already on this
   * installation are called 「오차드·부기스 라인」 and 「Geylang 일대」, so a zone plus 일대 is the
   * shape, and taking the zone from THIS project's register means the example is a place the
   * reader can see on the map beside it — and stays right when the register is Mongolian rather
   * than Singaporean. Biggest zone first because that is the one somebody groups; ties broken by
   * name so the placeholder does not move between renders — and counted over the whole register,
   * not over `byZone`, which is the SEARCH RESULT: taking it from there would change the example
   * with every keystroke in the box next to it.
   */
  const zoneSizes = new Map<string, number>();
  cameras.forEach(c => {
    const zone = c.zone?.trim() ?? "";
    if (zone !== "") zoneSizes.set(zone, (zoneSizes.get(zone) ?? 0) + 1);
  });
  const exampleZone = [...zoneSizes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const namePlaceholder = t.createNamePlaceholder(
    exampleZone ? t.createNameExample(exampleZone) : t.createNameExampleNoZone,
  );

  /* ZONES START CLOSED ON A BIG REGISTER — the same rule and the same threshold as the scope
     picker (owner: 실제 현장에서는 연결된 카메라 대수가 1000대이상일 수 있어서). A thousand rows
     inside one scroll box is a list nobody scrolls; a zone is what somebody ticks. Below a
     screenful the list is already the answer, so closing it would only add clicks. */
  const zonesStartOpen = cameras.length <= 40;
  const [openZones, setOpenZones] = useState<string[]>(() => zonesStartOpen ? cameras.map(c => c.zone?.trim() || "") : []);
  const toggleZoneOpen = (zone: string) =>
    setOpenZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  const toggleZoneAll = (ids: string[]) => {
    const allOn = ids.every(id => picked.includes(id));
    setPicked(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  /** The other groups holding a camera — the overlap, named rather than counted on hover. */
  const alsoIn = (cameraId: string) => otherGroups.filter(g => g.cameraIds.includes(cameraId));

  const dirty = creating
    ? label.trim() !== "" && picked.length > 0
    : label.trim() !== "" && (
      label.trim() !== group.label
      || description.trim() !== (group.description ?? "")
      || [...picked].sort().join() !== [...group.cameraIds].sort().join()
    );

  const save = () => {
    if (!dirty) return;
    const refusal = onSave(label.trim(), description, picked);
    if (refusal === "duplicate-label") setLabelError(t.duplicate);
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px",
  };
  const linkButton: React.CSSProperties = {
    border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
    fontSize: "11px", fontWeight: 700, color: "var(--gray-500)",
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 320, display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        backgroundColor: "white", width: "min(672px, 100%)", height: "100%",
        borderLeft: BORDER, boxShadow: "var(--shadow-modal)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: BORDER, display: "flex", alignItems: "center", gap: "10px" }}>
          <p style={{ minWidth: 0, flex: 1, fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {creating ? t.drawerNew : t.drawerEdit(group.label)}
          </p>
          <button type="button" onClick={onClose} className="portal-icon-btn"
            style={{ flexShrink: 0, padding: "4px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={fieldLabel}>{t.createName} *</label>
            <TextField value={label} onChange={v => { setLabel(v); setLabelError(null); }} placeholder={namePlaceholder} autoFocus />
            {labelError && <FieldError>{labelError}</FieldError>}
          </div>

          {/* OPTIONAL, AND NO PLACEHOLDER. A hint like "설명을 입력하세요" is the field's own label
              said twice, and an example would invent a purpose for a group the reader has not
              described yet. 「선택」 beside the label is the whole instruction: most groups are
              recognisable from the name and the camera names, and this line earns its place on a
              site with forty of them, telling 오차드 라인 from 오차드 외곽. */}
          <div>
            <label style={fieldLabel}>
              {t.descField}
              <span style={{ fontWeight: 600, color: "var(--gray-400)", marginLeft: "5px" }}>{t.descOptional}</span>
            </label>
            <TextField value={description} onChange={setDescription} />
          </div>

          {/* THE PICKER. Search and the view switch sit on one strip at the top of the thing they
              act on — a control spanning more than the list it narrows is the misalignment the
              in-page editor was corrected for. 전부 고르기 and 선택 초기화 sit above that strip,
              because they act on the whole selection rather than on what the search left. */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{t.inGroupHeading}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-900)", fontVariantNumeric: "tabular-nums" }}>{picked.length}</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setPicked(cameras.map(c => c.id))} style={linkButton}>{t.allPick}</button>
              {picked.length > 0 && (
                <button type="button" onClick={() => setPicked([])} style={linkButton}>{t.allClear}</button>
              )}
            </div>

            <div style={{ border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", padding: "10px 12px", borderBottom: BORDER, backgroundColor: "var(--gray-50)" }}>
                {view === "list" && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TextField value={query} onChange={setQuery} placeholder={t.membersSearch} />
                  </div>
                )}
                <div style={{ display: "flex", gap: "4px", padding: "3px", backgroundColor: "white", border: BORDER, borderRadius: "9px", flexShrink: 0 }}>
                  {([["list", t.viewList], ["map", t.viewMap]] as const).map(([value, text]) => (
                    <button key={value} type="button" onClick={() => setView(value)}
                      style={{
                        padding: "4px 11px", borderRadius: "7px", cursor: "pointer", fontFamily: "inherit",
                        fontSize: "11.5px", fontWeight: 700, border: "none",
                        backgroundColor: view === value ? "var(--gray-900)" : "transparent",
                        color: view === value ? "white" : "var(--gray-500)",
                      }}>
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {view === "map" ? (
                /* A FIXED HEIGHT, not the container's leftover. The drawer body scrolls, so a map
                   that takes its height from its parent collapses to nothing inside a scroll box —
                   the opposite of the bug that made `fill` necessary in the first place. */
                <div style={{ height: "280px" }}>
                  <CameraMapView
                    cameras={cameras}
                    selectedIds={new Set(picked)}
                    onToggleSelect={toggle}
                    alwaysPicking
                    fill
                  />
                </div>
              ) : zones.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "12px", lineHeight: 1.5 }}>{t.membersNone}</p>
              ) : (
                <div style={{ maxHeight: "280px", overflowY: "auto", padding: "8px" }}>
                  {zones.map(([zone, list]) => {
                    const open = needle !== "" || openZones.includes(zone);
                    return (
                      <div key={zone || "__none"} style={{ marginBottom: "8px" }}>
                        {/* The name opens the zone; the words beside it tick the whole zone. On a
                            big site those are the two things somebody does here, and one header
                            doing both would make ticking a zone cost opening it first. */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 0 4px 2px" }}>
                          <button type="button" onClick={() => toggleZoneOpen(zone)}
                            style={{ display: "flex", alignItems: "center", gap: "5px", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                              style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms", flexShrink: 0 }}>
                              <path d="M3 1.5L7 5l-4 3.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-400)" }}>
                              {zone || t.noZone} · {list.length}
                            </span>
                          </button>
                          <button type="button" onClick={() => toggleZoneAll(list.map(c => c.id))}
                            style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "10.5px", fontWeight: 700, color: "var(--gray-500)" }}>
                            {list.every(c => picked.includes(c.id)) ? t.zoneClear : t.zonePick}
                          </button>
                          {/* A closed zone says how much of it is in the group, or you would open
                              it to find out whether you had already ticked it. */}
                          {!open && (
                            <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                              {t.zonePicked(list.filter(c => picked.includes(c.id)).length)}
                            </span>
                          )}
                        </div>
                        {open && list.map(c => {
                          const on = picked.includes(c.id);
                          const others = alsoIn(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => toggle(c.id)}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "6px 6px", borderRadius: "8px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: on ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)", backgroundColor: on ? "var(--gray-900)" : "white" }}>
                                {on && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                    <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <span style={{ minWidth: 0, fontSize: "12.5px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              <span style={{ flexShrink: 0, fontSize: "10px", fontFamily: "monospace", color: "var(--gray-400)" }}>{c.code}</span>
                              {/* THE OVERLAP, ON THE ROW IT IS ABOUT. Counted here and named on
                                  hover: four group names on a row would push the camera's own
                                  name out. */}
                              {others.length > 0 && (
                                <span title={t.inOtherGroupsTitle(others.map(g => g.label).join(", "))}
                                  style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "var(--gray-400)" }}>
                                  {t.inOtherGroups(others.length)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* WHAT IS IN IT, AS NAMES WITH A WAY OUT. On the map there is no other way to read the
              group back — rings on dots and a count name nothing — and in the list the ticks are
              spread over eighteen zones. Each chip's ✕ takes that camera out, which is the one
              action this block is for. */}
          {picked.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {picked.map(id => {
                const cam = cameras.find(c => c.id === id);
                return (
                  <span key={id} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 6px 4px 9px", borderRadius: "8px", border: BORDER, backgroundColor: "var(--gray-50)", fontSize: "11.5px", color: "var(--gray-900)" }}>
                    {/* A camera the register no longer holds still has to be shown — a group can
                        name one that was removed, and silently dropping it would make the count
                        disagree with the chips under it. */}
                    {cam ? cam.name : t.inGroupUnknown}
                    <button type="button" onClick={() => toggle(id)} title={t.inGroupRemove}
                      style={{ display: "flex", padding: "1px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: BORDER, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          <span style={{ flex: 1, fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>
            {t.pickedCount(picked.length)}
          </span>
          <button type="button" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button type="button" onClick={save} disabled={!dirty}
            style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: dirty ? "var(--gray-900)" : "var(--gray-200)", color: dirty ? "white" : "var(--gray-400)", fontSize: "12.5px", fontWeight: 700, cursor: dirty ? "pointer" : "default", fontFamily: "inherit" }}>
            {creating ? t.createSave : t.editSave}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CameraGroupsTab({ projectId, onGoToCameras }: {
  projectId: string;
  onGoToCameras?: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const allGroups = useVcaStore(s => s.cameraGroups);
  const allCameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const addCameraGroup = useVcaStore(s => s.addCameraGroup);
  const updateCameraGroup = useVcaStore(s => s.updateCameraGroup);
  const removeCameraGroup = useVcaStore(s => s.removeCameraGroup);

  const groups = cameraGroupsInProject(allGroups, projectId);
  const registered = camerasInProject(allCameras, projectId);

  const [removing, setRemoving] = useState<CameraGroup | null>(null);
  const [editing, setEditing] = useState<CameraGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const drawerOpen = editing !== null || creating;

  /** How many accounts name this group in their scope — the answer this tab exists for. */
  const holderCount = (group: CameraGroup) =>
    portalUsers.filter(u => (u.cameraGroupIds ?? []).includes(group.id)).length;

  /* A group can name a camera that has since been removed from the register — pruneCameraGroups
     keeps that out on deletion, so this is a belt on the braces: the list holds the cameras that
     exist, because a scope resolves through the register and not through the stored ids. */
  const liveCameras = (group: CameraGroup) =>
    group.cameraIds.map(id => registered.find(c => c.id === id)).filter((c): c is Camera => !!c);

  return (
    <div>
      {/*
        ONE DOOR INTO THE DRAWER, AND IT IS THE LAST CELL OF THE GRID.
       
        There was a 「그룹 만들기」 button in a header row here as well, 100px above the dashed card
        that does the same thing — the duplicate-button shape the owner caught earlier the same day
        on this screen. The dashed cell wins because of where it sits: making a group is mostly
        deciding whether one like it already exists, so the control belongs AFTER the cards you
        read to decide that, not above them. The empty state keeps its own button, because then
        there are no cards to read and no grid to end.
      */}
      {groups.length === 0 ? (
        /* ONE LINE, THEN THE TWO DOORS. The line used to name both of them in prose — make one
           here, or group them on Input Sources — with both buttons sitting directly under it.
           The buttons are the instruction; the line only says what the state is. */
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, textAlign: "center" }}>{t.empty}</p>
          {mayEdit && (
            <button type="button" onClick={() => setCreating(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.createButton}
            </button>
          )}
          {onGoToCameras && (
            <button onClick={onGoToCameras}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.goToCameras}
            </button>
          )}
        </div>
      ) : (
        /* auto-fill at a 300px floor: three columns on a 1440 window, two at about 1100, one on a
           narrow one — and the cards keep their width instead of stretching to fill a half-empty
           row, which is what `1fr` columns do with three cards in a four-wide grid. */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {groups.map(group => {
            const cams = liveCameras(group);
            const holders = holderCount(group);
            return (
              <div key={group.id} style={{
                backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW,
                padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {/* NO alignItems:start ON THE GRID, AND THE FOOTER IS PUSHED DOWN.
                    Measured before this: one row held cards 138, 123 and 120px tall because only
                    the first group carries a purpose line, so three 「가진 계정」 rules sat at
                    three different heights 15px apart. Repeated things share their edges — the
                    grid stretches every card to its row's tallest, and `marginTop: auto` on the
                    footer keeps the rule at the bottom instead of floating under the chips. */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</p>
                    {/* Only when it was written. A group with no purpose line renders nothing —
                        not an empty row, not a grey 「설명 없음」 standing in for an answer. */}
                    {group.description && (
                      <p style={{ fontSize: "11.5px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "3px" }}>{group.description}</p>
                    )}
                  </div>
                  {/* An empty group is worth seeing rather than reading as a zero: it grants
                      nothing today and will grant whatever somebody puts in it. */}
                  <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 700, color: cams.length === 0 ? "var(--gray-900)" : "var(--gray-600)", padding: "3px 8px", borderRadius: "999px", border: BORDER, backgroundColor: "var(--gray-50)", fontVariantNumeric: "tabular-nums" }}>
                    {cams.length === 0 ? t.camerasNone : t.cameras(cams.length)}
                  </span>
                  <RowActionsMenu actions={[
                    {
                      /* First, because it is the one that changes access rather than wording. */
                      label: t.cardEdit,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : t.notOwner,
                      onClick: () => setEditing(group),
                    },
                    {
                      label: t.remove,
                      danger: true,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : readOnlyReason ?? t.notOwner,
                      onClick: () => setRemoving(group),
                    },
                  ]} />
                </div>

                {/* WHICH CAMERAS, not only how many. A count cannot be checked against what
                    somebody meant to group, and the names are what make the card recognisable. */}
                {cams.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {cams.slice(0, CARD_CHIP_CAP).map(c => (
                      <span key={c.id} style={{ fontSize: "11px", color: "var(--gray-600)", padding: "3px 7px", borderRadius: "6px", backgroundColor: "var(--gray-100)" }}>{c.name}</span>
                    ))}
                    {cams.length > CARD_CHIP_CAP && (
                      <span style={{ fontSize: "11px", color: "var(--gray-400)", padding: "3px 2px" }}>{t.andMore(cams.length - CARD_CHIP_CAP)}</span>
                    )}
                  </div>
                )}

                {/* THE REVERSE LOOKUP, ON EVERY CARD. Counted here rather than named: three names
                    do not fit a card's footer, and the account list is where you go to find out
                    which three. 「가진 계정 없음」 is said rather than shown as 0, because a group
                    nobody holds is a real state worth noticing — it grants nothing to anyone. */}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--gray-100)" }}>
                  <span style={{ fontSize: "11px", color: holders === 0 ? "var(--gray-400)" : "var(--gray-600)" }}>
                    {holders === 0 ? t.holdersNone : t.holders(holders)}
                  </span>
                  <span style={{ fontSize: "10.5px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.createdBy(group.createdBy, group.createdAt.slice(0, 10))}
                  </span>
                </div>
              </div>
            );
          })}

          {/* The last cell of the grid rather than a card that looks like a group: dashed, no
              shadow, one word. It repeats the header button on purpose — at the bottom of a long
              grid the header has scrolled away. */}
          {mayEdit && (
            <button type="button" onClick={() => setCreating(true)}
              style={{
                minHeight: "120px", borderRadius: CARD_RADIUS, border: "1px dashed var(--gray-300)",
                backgroundColor: "transparent", cursor: "pointer", fontFamily: "inherit",
                fontSize: "12px", fontWeight: 700, color: "var(--gray-500)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}>
              <span aria-hidden="true" style={{ fontSize: "14px", lineHeight: 1 }}>+</span>
              {t.newCard}
            </button>
          )}
        </div>
      )}

      {drawerOpen && (
        <GroupDrawer
          group={editing}
          cameras={registered}
          otherGroups={groups.filter(g => g.id !== editing?.id)}
          t={t}
          onSave={(label, description, ids) => {
            if (editing) {
              const refusal = updateCameraGroup(editing.id, { label, description, cameraIds: ids });
              if (refusal) return refusal;
              showToast({ variant: "success", title: t.savedToast, desc: `${label} · ${t.cameras(ids.length)}` });
              setEditing(null);
              return null;
            }
            const refusal = addCameraGroup(projectId, label, ids, description);
            if (refusal) return refusal;
            showToast({ variant: "success", title: t.createdToast, desc: `${label} · ${t.cameras(ids.length)}` });
            setCreating(false);
            return null;
          }}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}

      {removing && (
        <ConfirmModal
          title={t.removeTitle(removing.label)}
          /* The body says what it costs whoever holds it, and the count is only printed when there
             is one — "0 accounts hold it" is a sentence about nothing. */
          body={`${t.removeBody}${holderCount(removing) > 0 ? ` ${t.removeWithHolders(holderCount(removing))}` : ""}`}
          confirmLabel={t.removeConfirm}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            removeCameraGroup(removing.id);
            showToast({ variant: "warning", title: t.removedToast, desc: removing.label });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
