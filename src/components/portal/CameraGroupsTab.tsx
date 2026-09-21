"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import {
  cameraGroupsInProject, camerasInProject, useVcaStore, type Camera, type CameraGroup,
} from "@/lib/vcaStore";
import CameraMapView from "./CameraMapView";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TextField,
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
 * them — and ours does too: a group is created from the selection on Input Sources, which already
 * has the search, the kind filter and the map. Rebuilding a camera picker here would be a second
 * place to do the same thing, and the two would drift.
 *
 * WHAT THIS TAB IS FOR is the question the OTHER screen cannot answer: who holds this group. An
 * access review arrives asking "which accounts can watch the north gate", and until now the only
 * way to answer was to open every account's scope dialog one at a time. That is the reverse lookup
 * this table is, and it is also where a group is renamed or deleted, because both of those are
 * access changes: deleting one narrows everybody who held it (removeCameraGroup prunes the scopes
 * and says how many in the audit line).
 */

const T = {
  en: {
    heading: "Camera groups",
    intro: "A named set of cameras, handed out as one on an account's camera scope. Pick them from the list or on the map, and one camera may sit in several groups.",
    empty: "No groups on this project yet. Make one here, or select cameras on Input Sources and group them there.",
    colName: "Group", colCameras: "Cameras", colHolders: "Accounts holding it", colCreated: "Created",
    cameras: (n: number) => `${n} camera${n === 1 ? "" : "s"}`,
    camerasNone: "Empty",
    holdersNone: "Nobody",
    holders: (names: string) => names,
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    rename: "Rename", remove: "Delete", cancel: "Cancel", back: "Back",
    goToCameras: "Go to Input Sources",
    editMembers: "Edit cameras",
    membersTitle: (label: string) => `Cameras in ${label}`,
    membersBody: "Ticked cameras are in the group. Everybody holding it sees whatever is ticked here, including what gets ticked later.",
    membersSearch: "Search by name or code",
    membersSave: "Save cameras",
    membersNone: "No camera on this project matches that.",
    membersCount: (n: number) => `${n} ticked`,
    membersSavedToast: "Group cameras saved",
    andMore: (n: number) => `and ${n} more`,
    noZone: "No zone",
    zonePick: "select all", zoneClear: "clear",
    viewList: "List", viewMap: "Map",
    createTitle: "New camera group",
    createSave: "Create group",
    createName: "Group name",
    createNamePlaceholder: "The way people say it out loud",
    createButton: "New group",
    createdToast: "Camera group created",
    overlapNote: "A camera can be in several groups at once. Adding it here does not take it out of another.",
    inOtherGroups: (n: number) => `in ${n} other`,
    inOtherGroupsTitle: (names: string) => `Also in: ${names}`,
    pickedCount: (n: number) => `${n} picked`,
    mapHint: "Click a dot to add or remove it. Zone pills add the whole zone.",
    zonePicked: (n: number) => n === 0 ? "none in the group" : `${n} in the group`,
    renameTitle: (label: string) => `Rename ${label}`,
    renameBody: "The name is what an administrator picks from when granting camera access, so it should read the way somebody says it out loud.",
    renameField: "Group name",
    renameSave: "Rename",
    renameDuplicate: "Another group on this project already has that name.",
    renamedToast: "Group renamed",
    removeTitle: (label: string) => `Delete ${label}?`,
    removeBody: "Every account holding this group loses those cameras, unless another group or an individual camera still covers them. The cameras themselves are untouched.",
    removeWithHolders: (n: number) => `${n} account${n === 1 ? "" : "s"} hold${n === 1 ? "s" : ""} it right now.`,
    removeConfirm: "Delete group",
    removedToast: "Group deleted",
    notOwner: "Only an owner changes camera groups.",
  },
  ko: {
    heading: "카메라 그룹",
    intro: "이름 붙인 카메라 묶음입니다. 계정의 카메라 범위에서 한 덩어리로 줍니다. 목록에서 찾거나 지도에서 눌러 넣고, 한 카메라가 여러 그룹에 들어가도 됩니다.",
    empty: "이 프로젝트에 아직 그룹이 없습니다. 여기서 만들거나, 입력 소스에서 카메라를 골라 묶을 수 있습니다.",
    colName: "그룹", colCameras: "카메라", colHolders: "이 그룹을 가진 계정", colCreated: "만든 사람",
    cameras: (n: number) => `${n}대`,
    camerasNone: "비어 있음",
    holdersNone: "없음",
    holders: (names: string) => names,
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    rename: "이름 바꾸기", remove: "삭제", cancel: "취소", back: "뒤로",
    goToCameras: "입력 소스로 가기",
    editMembers: "카메라 편집",
    membersTitle: (label: string) => `${label}의 카메라`,
    membersBody: "체크된 카메라가 그룹에 들어갑니다. 이 그룹을 가진 사람은 여기 체크된 것을 보게 되고, 나중에 체크되는 것도 함께 보게 됩니다.",
    membersSearch: "이름이나 코드로 검색",
    membersSave: "카메라 저장",
    membersNone: "그 조건에 맞는 카메라가 이 프로젝트에 없습니다.",
    membersCount: (n: number) => `${n}대 체크됨`,
    membersSavedToast: "그룹의 카메라를 저장했습니다",
    andMore: (n: number) => `외 ${n}대`,
    noZone: "구역 미지정",
    zonePick: "전체 선택", zoneClear: "해제",
    viewList: "목록", viewMap: "지도",
    createTitle: "새 카메라 그룹",
    createSave: "그룹 만들기",
    createName: "그룹 이름",
    createNamePlaceholder: "사람들이 입으로 부르는 말",
    createButton: "그룹 만들기",
    createdToast: "카메라 그룹을 만들었습니다",
    overlapNote: "카메라는 여러 그룹에 동시에 들 수 있습니다. 여기서 넣어도 다른 그룹에서 빠지지 않습니다.",
    inOtherGroups: (n: number) => `다른 그룹 ${n}`,
    inOtherGroupsTitle: (names: string) => `여기에도 있음: ${names}`,
    pickedCount: (n: number) => `${n}대 체크됨`,
    mapHint: "점을 눌러 넣거나 뺍니다. 구역 알약을 누르면 그 구역이 통째로 들어갑니다.",
    zonePicked: (n: number) => n === 0 ? "그룹에 없음" : `그룹에 ${n}대`,
    renameTitle: (label: string) => `${label} 이름 바꾸기`,
    renameBody: "이 이름이 카메라 권한을 줄 때 고르는 이름입니다. 사람들이 입으로 부르는 말로 두는 게 좋습니다.",
    renameField: "그룹 이름",
    renameSave: "이름 바꾸기",
    renameDuplicate: "이 프로젝트에 같은 이름의 그룹이 이미 있습니다.",
    renamedToast: "그룹 이름을 바꿨습니다",
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

const GRID = "1.4fr 0.6fr 1.6fr 1fr 36px";

/**
 * ONE EDITOR FOR BOTH — MAKING A GROUP AND CHANGING ONE, WITH THE LIST AND THE MAP SIDE BY SIDE.
 *
 * The owner asked for the map here (2026-09-21): 입력소스 화면에 넣었던 지도를 여기 카메라
 * 그룹에도 넣어서 지도에서 그룹핑할수있게해줘. That overrides the earlier note in this file, which
 * argued creation should stay on Input Sources because that is where the map is. The map is a
 * component, so "where the map is" was never the real constraint — the real one is that a group is
 * assembled the way the site is described, and a site is described by pointing at it.
 *
 * TWO WAYS IN, ONE SELECTION. The list has the search and the zone grouping; the map has the
 * geography. They write the same `picked` set, so twenty ticked in the list and two clicked on the
 * map are twenty-two in the group — the same rule the bulk selection on Input Sources follows, and
 * for the same reason: a second selection would be a second answer to "what is in this group".
 *
 * OVERLAP IS ALLOWED AND SAID OUT LOUD (owner: 카메라들이 중복으로도 그룹핑 될수있을것같구).
 * Nothing in the data model ever forbade it — `addCameraGroup` refuses a duplicate NAME and says
 * nothing about members — but a checkbox list gives no hint either way, and an administrator who
 * assumes exclusivity will not build the groups they actually need (the gate camera belongs to
 * 정문 and to 야간 순찰 both). So each row says how many other groups hold that camera and names
 * them on hover, and the note above the list says adding here takes nothing away.
 *
 * NOT ConfirmModal: that shell is capped at 400px, which is not a map. Its own dialog, at the
 * width the two-pane picker uses.
 */
function GroupEditor({ group, cameras, otherGroups, t, onSave, onClose }: {
  /** The group being changed, or null while one is being made. */
  group: CameraGroup | null;
  /** The project's register — full cameras, because the map needs the coordinates and the status. */
  cameras: Camera[];
  /** Every other group of this project, for the "also in" count. */
  otherGroups: CameraGroup[];
  t: Dict;
  /** Returns an error key when the name is taken, so the field can say so without closing. */
  onSave: (label: string, cameraIds: string[]) => "duplicate-label" | null;
  onClose: () => void;
}) {
  /* No useEscapeKey: Escape closes the thing on top, and nothing is on top of this any more —
     pressing it with a half-built group would throw the work away with no undo. */
  const creating = group === null;
  const [label, setLabel] = useState(group?.label ?? "");
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
    : [...picked].sort().join() !== [...(group?.cameraIds ?? [])].sort().join() ;

  const save = () => {
    if (!dirty) return;
    const refusal = onSave(label.trim(), picked);
    if (refusal === "duplicate-label") setLabelError(t.renameDuplicate);
  };

  return (
    /*
     * ON THE PAGE, NOT IN A POPUP (owner, 2026-09-21: 카메라 그룹에 만들기 버튼 눌러서 뜨는
     * 팝업화면을 바닥에 뿌려줘).
     *
     * A dialog was the wrong container for this one. The thing being assembled is a set of
     * cameras out of a register that can run past a thousand, and the two ways of picking them
     * both want room: the map had 46vh of a sheet capped at 90vh, and the list had a scroll box
     * inside a scroll box. A popup also says "answer this and get back", and building a group is
     * not that — it is work somebody does with the table they came from still in mind.
     *
     * So it takes over the tab's own area, the way the tab itself takes over the accounts list,
     * and leaves by its own back button. No scrim, no escape-to-close: there is nothing stacked
     * over to dismiss, and Escape with a half-built group would throw the work away.
     */
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
        {/* THE WAY BACK IS A CONTROL, not a corner X. A page needs a back; a dialog needs a
            close, and this is no longer a dialog. */}
        <button type="button" onClick={onClose}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "5px", height: CONTROL_HEIGHT, padding: "0 10px 0 8px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M7 1.5L3 5l4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.back}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)" }}>
            {creating ? t.createTitle : t.membersTitle(group.label)}
          </p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "2px" }}>{t.membersBody}</p>
        </div>
        {/*
         * SAVE AT THE TOP, WHERE IT CANNOT FALL OFF.
         *
         * Measured with the save at the foot of the panel: in list mode its bottom edge sat at
         * 916px on a 900px window — it OPENED off screen and had to be scrolled to. The map mode
         * was no better by design, only by luck (899 of 900).
         *
         * Klaviyo's geofence editor is the reference and it does exactly this: a full-page editor
         * with Exit and Save pinned top right, because the thing being edited (a map, a long
         * list) has no fixed height and anything below it inherits that. Felt, Hex and Google
         * Workspace's group builder all keep the commit control out of the scrolling area too.
         *
         * The count rides along, because it is the one number this screen sets and it belongs
         * beside the button that writes it.
         */}
        <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>{t.pickedCount(picked.length)}</span>
        <button type="button" onClick={save} disabled={!dirty}
          style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: dirty ? "var(--gray-900)" : "var(--gray-200)", color: dirty ? "white" : "var(--gray-400)", fontSize: "12.5px", fontWeight: 700, cursor: dirty ? "pointer" : "default", fontFamily: "inherit" }}>
          {creating ? t.createSave : t.membersSave}
        </button>
      </div>
      <div style={{ backgroundColor: "white", borderRadius: CARD_RADIUS, border: CARD_BORDER, boxShadow: PANEL_SHADOW, display: "flex", flexDirection: "column" }}>

        {creating && (
          <div style={{ padding: "16px 20px 0" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.createName}</label>
            <TextField value={label} onChange={v => { setLabel(v); setLabelError(null); }} placeholder={t.createNamePlaceholder} autoFocus />
            {labelError && <FieldError>{labelError}</FieldError>}
          </div>
        )}

        <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: "10px" }}>
          {/* TWO WAYS IN, NOT TWO SELECTIONS. Switching does not reset anything — the count in the
              footer is the same set on both sides, which is what makes switching safe to do
              halfway through. */}
          <div style={{ display: "flex", gap: "4px", padding: "3px", backgroundColor: "var(--gray-100)", borderRadius: "9px" }}>
            {([["list", t.viewList], ["map", t.viewMap]] as const).map(([value, text]) => (
              <button key={value} type="button" onClick={() => setView(value)}
                style={{
                  padding: "5px 12px", borderRadius: "7px", cursor: "pointer", fontFamily: "inherit",
                  fontSize: "11.5px", fontWeight: 700, border: "none",
                  backgroundColor: view === value ? "white" : "transparent",
                  color: view === value ? "var(--gray-900)" : "var(--gray-500)",
                  boxShadow: view === value ? "var(--shadow-card)" : "none",
                }}>
                {text}
              </button>
            ))}
          </div>
          {view === "list" && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextField value={query} onChange={setQuery} placeholder={t.membersSearch} />
            </div>
          )}
          {view === "map" && (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{t.mapHint}</span>
          )}
        </div>

        {/* THE ONE SENTENCE THAT STOPS A WRONG ASSUMPTION. Said above the list rather than on a
            row, because it is about the rule and not about any one camera. */}
        <p style={{ padding: "10px 20px 0", fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.overlapNote}</p>

        {/* The PAGE scrolls now, not a box inside a box. The list keeps its own frame so the zone
            groups read as one object, and the map gets a real height instead of 46vh of a sheet. */}
        <div style={{ padding: "12px 20px" }}>
          {view === "map" ? (
            <div style={{ height: "56vh", minHeight: "420px" }}>
              <CameraMapView
                cameras={cameras}
                selectedIds={new Set(picked)}
                onToggleSelect={toggle}
                alwaysPicking
              />
            </div>
          ) : zones.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "10px", lineHeight: 1.5 }}>{t.membersNone}</p>
          ) : (
            <div style={{ border: BORDER, borderRadius: "10px", padding: "8px" }}>
              {zones.map(([zone, list]) => {
                const open = needle !== "" || openZones.includes(zone);
                return (
                  <div key={zone || "__none"} style={{ marginBottom: "8px" }}>
                    {/* The name opens the zone; the words beside it tick the whole zone. On a big
                        site those are the two things somebody does here, and one header doing both
                        would make ticking a zone cost opening it first. */}
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
                      {/* A closed zone says how much of it is in the group, or you would open it to
                          find out whether you had already ticked it. */}
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
                          {/* THE OVERLAP, ON THE ROW IT IS ABOUT. Counted here and named on hover:
                              four group names on a row would push the camera's own name out. */}
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
  const renameCameraGroup = useVcaStore(s => s.renameCameraGroup);
  const setCameraGroupMembers = useVcaStore(s => s.setCameraGroupMembers);
  const removeCameraGroup = useVcaStore(s => s.removeCameraGroup);

  const groups = cameraGroupsInProject(allGroups, projectId);
  const registered = camerasInProject(allCameras, projectId);

  const [renaming, setRenaming] = useState<CameraGroup | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CameraGroup | null>(null);
  const [editing, setEditing] = useState<CameraGroup | null>(null);
  const [creating, setCreating] = useState(false);

  /** The accounts whose scope names this group — the answer this tab exists for. */
  const holdersOf = (group: CameraGroup) =>
    portalUsers.filter(u => (u.cameraGroupIds ?? []).includes(group.id));

  /* A group can name a camera that has since been removed from the register — pruneCameraGroups
     keeps that out on deletion, so this is a belt on the braces: the count says how many of its
     cameras exist, because a scope resolves through the register and not through the list. */
  const liveCount = (group: CameraGroup) =>
    group.cameraIds.filter(id => registered.some(c => c.id === id)).length;

  /*
   * THE EDITOR TAKES THE WHOLE AREA (owner: 팝업화면을 바닥에 뿌려줘) — it is not drawn over the
   * table, it replaces it, the same way this tab replaces the accounts list. Two subjects on one
   * screen with one set of controls over both is what the tab switch exists to avoid, and a map
   * needs the room the table was using.
   */
    {/* ONE EDITOR, TWO ERRANDS. `editing` holds the group being changed; `creating` is the same
        screen with the name field on and no group behind it. Two components would have drifted
        the first time the list or the map changed. */}
  if (editing || creating) {
    return (
      <GroupEditor
        group={editing}
        cameras={registered}
        otherGroups={groups.filter(g => g.id !== editing?.id)}
        t={t}
        onSave={(label, ids) => {
          if (editing) {
            setCameraGroupMembers(editing.id, ids);
            showToast({ variant: "success", title: t.membersSavedToast, desc: `${editing.label} · ${t.cameras(ids.length)}` });
            setEditing(null);
            return null;
          }
          const refusal = addCameraGroup(projectId, label, ids);
          if (refusal) return refusal;
          showToast({ variant: "success", title: t.createdToast, desc: `${label} · ${t.cameras(ids.length)}` });
          setCreating(false);
          return null;
        }}
        onClose={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
        <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: "1px" }}><Boxes size={17} strokeWidth={2} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.heading}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.5 }}>{t.intro}</p>
        </div>
        {/* MAKING ONE STARTS HERE NOW, not only on Input Sources. Disabled for a reader who cannot
            change access — the row menu already refuses, and a button that opens a dialog whose
            save is refused is worse than a button that says no. */}
        {mayEdit && (
          <button type="button" onClick={() => setCreating(true)}
            style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.createButton}
          </button>
        )}
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        {groups.length === 0 ? (
          /* A sentence that names another screen needs the way to it. The empty state used to
             say "select cameras on Input Sources" and leave the reader to find the sidebar. */
          <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, textAlign: "center", maxWidth: "46ch" }}>{t.empty}</p>
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
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
              {[t.colName, t.colCameras, t.colHolders, t.colCreated, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
              ))}
            </div>
            {groups.map((group, i) => {
              const holders = holdersOf(group);
              const count = liveCount(group);
              const isLast = i === groups.length - 1;
              return (
                <div key={group.id} style={{
                  display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
                  padding: "10px 16px", alignItems: "center",
                  borderBottom: isLast ? "none" : BORDER,
                }}>
                  {/* WHICH CAMERAS, not only how many. A count cannot be checked against what
                      somebody meant to group, and the three names under the label are usually
                      enough to recognise it — the rest is one click away in 카메라 편집. */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</p>
                    {count > 0 && (
                      <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[
                          ...group.cameraIds
                            .map(id => registered.find(c => c.id === id)?.name)
                            .filter(Boolean)
                            .slice(0, 3),
                          ...(count > 3 ? [t.andMore(count - 3)] : []),
                        ].join(", ")}
                      </p>
                    )}
                  </div>
                  {/* An empty group is worth seeing rather than reading as a zero: it grants
                      nothing today and will grant whatever somebody puts in it. */}
                  {count === 0
                    ? <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.camerasNone}</span>
                    : <span style={{ fontSize: "12px", color: "var(--gray-600)", fontVariantNumeric: "tabular-nums" }}>{t.cameras(count)}</span>}
                  {/* THE REVERSE LOOKUP. Named, not counted: "3 accounts" sends the reader back to
                      the account list to find out which three. */}
                  {holders.length === 0
                    ? <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>{t.holdersNone}</span>
                    : <span title={holders.map(u => u.email).join(", ")} style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.holders(holders.map(u => u.name).join(", "))}
                      </span>}
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.createdBy(group.createdBy, group.createdAt.slice(0, 10))}
                  </span>
                  <RowActionsMenu actions={[
                    {
                      /* First, because it is the one that changes access rather than wording. */
                      label: t.editMembers,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : t.notOwner,
                      onClick: () => setEditing(group),
                    },
                    {
                      label: t.rename,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : t.notOwner,
                      onClick: () => { setRenaming(group); setNameDraft(group.label); setNameError(null); },
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
              );
            })}
          </>
        )}
      </div>

      {renaming && (
        <ConfirmModal
          title={t.renameTitle(renaming.label)}
          body={t.renameBody}
          confirmLabel={t.renameSave}
          cancelLabel={t.cancel}
          confirmDisabled={nameDraft.trim() === "" || nameDraft.trim() === renaming.label}
          onConfirm={() => {
            const taken = groups.some(g => g.id !== renaming.id && g.label.trim().toLowerCase() === nameDraft.trim().toLowerCase());
            if (taken) { setNameError(t.renameDuplicate); return; }
            renameCameraGroup(renaming.id, nameDraft);
            showToast({ variant: "success", title: t.renamedToast, desc: nameDraft.trim() });
            setRenaming(null);
          }}
          onClose={() => setRenaming(null)}
        >
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.renameField} *</label>
            <TextField value={nameDraft} onChange={v => { setNameDraft(v); setNameError(null); }} />
            {nameError && <FieldError>{nameError}</FieldError>}
          </div>
        </ConfirmModal>
      )}


      {removing && (
        <ConfirmModal
          title={t.removeTitle(removing.label)}
          /* The body says what it costs whoever holds it, and the count is only printed when there
             is one — "0 accounts hold it" is a sentence about nothing. */
          body={`${t.removeBody}${holdersOf(removing).length > 0 ? ` ${t.removeWithHolders(holdersOf(removing).length)}` : ""}`}
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
