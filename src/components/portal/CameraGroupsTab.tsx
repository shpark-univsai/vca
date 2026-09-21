"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import {
  cameraGroupsInProject, camerasInProject, useVcaStore, type CameraGroup,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TextField,
  ConfirmModal, FieldError, RowActionsMenu, TableEmpty, usePortalEditAccess,
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
    intro: "A named set of cameras, handed out as one on an account's camera scope. Group membership is edited on Input Sources, where the cameras are.",
    empty: "No groups on this project yet. Select cameras on Input Sources and press “Group these”.",
    colName: "Group", colCameras: "Cameras", colHolders: "Accounts holding it", colCreated: "Created",
    cameras: (n: number) => `${n} camera${n === 1 ? "" : "s"}`,
    camerasNone: "Empty",
    holdersNone: "Nobody",
    holders: (names: string) => names,
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    rename: "Rename", remove: "Delete", cancel: "Cancel",
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
    intro: "이름 붙인 카메라 묶음입니다. 계정의 카메라 범위에서 한 덩어리로 줍니다. 그룹에 어떤 카메라가 들어가는지는 카메라가 있는 입력 소스에서 정합니다.",
    empty: "이 프로젝트에 아직 그룹이 없습니다. 입력 소스에서 카메라를 고르고 「그룹으로 묶기」를 누르세요.",
    colName: "그룹", colCameras: "카메라", colHolders: "이 그룹을 가진 계정", colCreated: "만든 사람",
    cameras: (n: number) => `${n}대`,
    camerasNone: "비어 있음",
    holdersNone: "없음",
    holders: (names: string) => names,
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    rename: "이름 바꾸기", remove: "삭제", cancel: "취소",
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
 * EDITING MEMBERSHIP IN PLACE, which is the one thing this screen does that Input Sources does
 * better for CREATING a group.
 *
 * The creation path stays where the cameras are: tick rows in the table, click dots on the map,
 * press a zone pill, then "Group these". That is the right place to ASSEMBLE a set, because it has
 * the search, the filters, the map and the status of every camera.
 *
 * Fixing an existing group is a different errand: the reader is already here, holding the group,
 * and usually changing one or two members. Sending them to another screen and back for that is
 * the friction — so this is a list with a search box, the same zone-grouped shape the camera-scope
 * picker uses, and it writes through setCameraGroupMembers (which audits how many accounts the
 * change reaches, because it reaches them immediately).
 */
function MemberEditor({ group, cameras, t, onSave, onClose }: {
  group: CameraGroup;
  cameras: { id: string; name: string; code: string; zone?: string }[];
  t: Dict;
  onSave: (cameraIds: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(group.cameraIds);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matching = needle === ""
    ? cameras
    : cameras.filter(c => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));

  /* Grouped by the register's own zone, like the scope picker: "the north gate ones" is how
     somebody says it, and a camera with no zone keeps its own group rather than disappearing. */
  const byZone = new Map<string, typeof cameras>();
  matching.forEach(c => {
    const key = c.zone?.trim() || "";
    byZone.set(key, [...(byZone.get(key) ?? []), c]);
  });
  const zones = [...byZone.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));

  const toggle = (id: string) => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const dirty = [...picked].sort().join() !== [...group.cameraIds].sort().join();

  /* ZONES START CLOSED ON A BIG REGISTER — the same rule and the same threshold as the scope
     picker (owner: 실제 현장에서는 연결된 카메라 대수가 1000대이상일 수 있어서). A thousand rows
     inside a 42vh box is a list nobody scrolls; a zone is what somebody ticks. Below a screenful
     the list is already the answer, so closing it would only add clicks. */
  const zonesStartOpen = cameras.length <= 40;
  const [openZones, setOpenZones] = useState<string[]>(() => zonesStartOpen ? cameras.map(c => c.zone?.trim() || "") : []);
  const toggleZoneOpen = (zone: string) =>
    setOpenZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  const toggleZoneAll = (ids: string[]) => {
    const allOn = ids.every(id => picked.includes(id));
    setPicked(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  return (
    <ConfirmModal
      title={t.membersTitle(group.label)}
      body={t.membersBody}
      confirmLabel={t.membersSave}
      cancelLabel={t.cancel}
      confirmDisabled={!dirty}
      bodyScrolls
      onConfirm={() => onSave(picked)}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField value={query} onChange={setQuery} placeholder={t.membersSearch} />
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", whiteSpace: "nowrap" }}>{t.membersCount(picked.length)}</span>
        </div>
        <div style={{ maxHeight: "42vh", overflowY: "auto", border: BORDER, borderRadius: "10px", padding: "8px" }}>
          {zones.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "10px", lineHeight: 1.5 }}>{t.membersNone}</p>
          ) : zones.map(([zone, list]) => (
            <div key={zone || "__none"} style={{ marginBottom: "8px" }}>
              {/* The name opens the zone; the words beside it tick the whole zone. On a big site
                  those are the two things somebody does here, and one header doing both would
                  make ticking a zone cost opening it first. A search opens what it found. */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 0 4px 2px" }}>
                <button type="button" onClick={() => toggleZoneOpen(zone)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                    style={{ transform: (needle !== "" || openZones.includes(zone)) ? "rotate(90deg)" : "none", transition: "transform 120ms", flexShrink: 0 }}>
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
                {/* A closed zone says how much of it is in the group, or you would open it to find
                    out whether you had already ticked it. */}
                {!(needle !== "" || openZones.includes(zone)) && (
                  <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                    {t.zonePicked(list.filter(c => picked.includes(c.id)).length)}
                  </span>
                )}
              </div>
              {(needle !== "" || openZones.includes(zone)) && list.map(c => {
                const on = picked.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
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
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </ConfirmModal>
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

  /** The accounts whose scope names this group — the answer this tab exists for. */
  const holdersOf = (group: CameraGroup) =>
    portalUsers.filter(u => (u.cameraGroupIds ?? []).includes(group.id));

  /* A group can name a camera that has since been removed from the register — pruneCameraGroups
     keeps that out on deletion, so this is a belt on the braces: the count says how many of its
     cameras exist, because a scope resolves through the register and not through the list. */
  const liveCount = (group: CameraGroup) =>
    group.cameraIds.filter(id => registered.some(c => c.id === id)).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
        <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: "1px" }}><Boxes size={17} strokeWidth={2} /></span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.heading}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.5 }}>{t.intro}</p>
        </div>
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        {groups.length === 0 ? (
          /* A sentence that names another screen needs the way to it. The empty state used to
             say "select cameras on Input Sources" and leave the reader to find the sidebar. */
          <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, textAlign: "center", maxWidth: "46ch" }}>{t.empty}</p>
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

      {editing && (
        <MemberEditor
          group={editing}
          cameras={registered}
          t={t}
          onSave={ids => {
            setCameraGroupMembers(editing.id, ids);
            showToast({ variant: "success", title: t.membersSavedToast, desc: `${editing.label} · ${t.cameras(ids.length)}` });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
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
