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
    renameTitle: (label: string) => `${label} 이름 바꾸기`,
    renameBody: "이 이름이 카메라 권한을 줄 때 고르는 이름입니다. 사람들이 입으로 부르는 말로 두는 게 좋습니다.",
    renameField: "그룹 이름",
    renameSave: "이름 바꾸기",
    renameDuplicate: "이 프로젝트에 같은 이름의 그룹이 이미 있습니다.",
    renamedToast: "그룹 이름을 바꿨습니다",
    removeTitle: (label: string) => `${label}을(를) 삭제할까요?`,
    removeBody: "이 그룹을 가진 계정은 그 카메라들을 잃습니다 — 다른 그룹이나 개별 카메라로 덮이는 경우는 제외입니다. 카메라 자체는 그대로 있습니다.",
    removeWithHolders: (n: number) => `지금 ${n}개 계정이 갖고 있습니다.`,
    removeConfirm: "그룹 삭제",
    removedToast: "그룹을 삭제했습니다",
    notOwner: "카메라 그룹은 최고관리자만 바꿉니다.",
  },
};

type Dict = typeof T.en;

const GRID = "1.4fr 0.6fr 1.6fr 1fr 36px";

export default function CameraGroupsTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const allGroups = useVcaStore(s => s.cameraGroups);
  const allCameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const renameCameraGroup = useVcaStore(s => s.renameCameraGroup);
  const removeCameraGroup = useVcaStore(s => s.removeCameraGroup);

  const groups = cameraGroupsInProject(allGroups, projectId);
  const registered = camerasInProject(allCameras, projectId);

  const [renaming, setRenaming] = useState<CameraGroup | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CameraGroup | null>(null);

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
          <TableEmpty text={t.empty} />
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
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</span>
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
