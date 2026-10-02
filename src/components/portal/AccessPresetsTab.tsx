"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import {
  APP_ACTION_CONTENT, accountsFollowingPreset, presetsForTeam, presetLabel, useVcaStore,
  withAppActionDeps, type AccessPreset, type AppAction, type PortalUser,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  FormLabel, BulkBarSubject, BulkBarExit,
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, AppGrantList, FloatingBulkBar, BulkBarDivider,
  TextField, Drawer, PanelCancel, GRANT_TREE, GrantGroupIcon, type GrantRowDef, type GrantGroupDef,
} from "./PortalShared";
import { APP_GRANT_LABELS } from "@/lib/appGrants";

/**
 * APP-ACCESS PRESETS, BESIDE THE ACCOUNTS THEY ARE HANDED TO.
 *
 * Moved here from the settings page (owner, 2026-09-21: 프리셋도 유저가 유연하게 세팅할수있게
 * 카메라 그룹탭처럼 거기에 추가해서 만들어두고 바꿀수있게할까?). It was already fully editable —
 * make, edit, retire — just filed under 설정, where somebody handing out access does not go
 * looking: 아 설정에 있었구나.
 *
 * MOVED, NOT COPIED. Two screens editing the same preset drift the first time one of them gains a
 * field, and living inheritance is the one object in this product where a stale second editor
 * would change other people's access.
 *
 * WHY THIS TAB AND NOT SETTINGS. A preset is an access object exactly like a camera group: one is
 * "which screens", the other is "which cameras", and both are answered on the invite form. The
 * camera-groups tab exists for the reverse lookup — who holds this group — and this tab carries
 * the same one, which is the follower list the store insists on (see updateAccessPreset).
 *
 * The team is the project's owning team rather than the signed-in user's, which is what the rest
 * of this page uses and what the invite form reads with presetsForTeam.
 */
const T = {
  en: {
    presetTitle: "App access presets",
    /*
     * ONE FACT, THE ONE YOU CANNOT SEE (owner, 2026-09-28: 이거 너무 어려워, 설명이).
     *
     * It said three things. Two of them are now on the screen: the table underneath is a set of
     * named bundles, and each column already prints how many accounts follow it. Only the third —
     * that editing a preset changes those accounts where they stand — is invisible, and it is the
     * one that can surprise somebody. Its counterpart is invisible too and matters as much: an
     * account whose grants were set by hand does NOT move when a preset does.
     */
    presetIntro: "Editing a preset changes every account that follows it. Accounts whose permissions were set individually stay as they are.",
    presetEmpty: "No presets yet. Until one exists, every invitation has to pick screens one by one.",
    presetNew: "New preset",
    presetLabelField: "Name",
    presetLabelPlaceholder: "Operator \u00b7 Investigator \u00b7 Supervisor",
    presetGrantsField: "Permissions",
    presetNoScreens: "Tick at least one screen \u2014 an account following a preset with none cannot open the app",
    presetFollowers: (n: number) => `In use · ${n}`,
    presetFollowersNone: "No accounts follow this yet",
    presetFollowersTitle: (label: string) => `Accounts following ${label}`,
    presetClose: "Close",
    presetEditReach: (n: number) => `Saving changes what these ${n} can open, at once.`,
    presetEdit: "Edit",
    presetNoActions: "A preset with nothing ticked cannot be given to anyone.",
    presetUndoRemove: "Undo",
    presetCycleHint: "Click to change",
    presetGroupAll: "All",
    presetGroupSome: "Some",
    presetRetire: "Retire",
    presetRetireAsk: "Retire this preset?",
    presetRetireBody: (n: number) => n === 0
      ? "It stops being offered on the invite form. Nothing else changes."
      : `It stops being offered, and the ${n} account${n === 1 ? "" : "s"} following it become individual \u2014 holding exactly what they hold now. Nobody gains or loses access.`,
    presetRetireConfirm: "Retire",
    presetNamePh: "Name",
    presetColHead: "What it opens",
    presetEditing: "Editing presets",
    presetAllow: "Yes",
    presetDeny: "No",
    presetSave: "Save",
    presetCancel: "Cancel",
    presetCreate: "Create",
    presetOwnerOnly: "Only an owner can change presets.",
    presetSavedToast: "Preset saved",
    presetCreatedToast: "Preset created",
    presetRetiredToast: "Preset retired",
  },
  ko: {
    presetTitle: "앱 권한 프리셋",
    presetIntro: "프리셋을 고치면 그걸 따르는 계정이 모두 같이 바뀝니다. 권한을 직접 지정한 계정은 그대로입니다.",
    presetEmpty: "아직 프리셋이 없습니다. 하나도 없으면 초대할 때마다 화면을 하나씩 골라야 합니다.",
    presetNew: "프리셋 만들기",
    presetLabelField: "이름",
    presetLabelPlaceholder: "운영자 · 조사자 · 감독자",
    presetGrantsField: "권한",
    presetNoScreens: "화면을 하나 이상 골라주세요 — 화면이 없는 프리셋을 따르는 계정은 앱을 열 수 없습니다",
    presetFollowers: (n: number) => `사용중 · ${n}`,
    presetFollowersNone: "미사용",
    presetFollowersTitle: (label: string) => `${label} 프리셋을 따르는 계정`,
    presetClose: "닫기",
    presetEditReach: (n: number) => `저장하면 이 ${n}명이 열 수 있는 화면이 한 번에 바뀝니다.`,
    presetEdit: "편집",
    presetNoActions: "아무것도 고르지 않은 프리셋은 아무에게도 줄 수 없습니다.",
    presetUndoRemove: "되돌리기",
    presetCycleHint: "눌러서 바꾸기",
    presetGroupAll: "전체 허용",
    presetGroupSome: "일부 허용",
    presetRetire: "삭제",
    presetRetireAsk: "이 프리셋을 폐기할까요?",
    presetRetireBody: (n: number) => n === 0
      ? "초대 폼에서 더 이상 제시되지 않습니다. 그 밖에 바뀌는 것은 없습니다."
      : `초대 폼에서 더 이상 제시되지 않고, 이것을 따르던 계정 ${n}개는 지금 가진 것을 그대로 들고 개별 지정으로 바뀝니다. 권한을 얻거나 잃는 사람은 없습니다.`,
    presetRetireConfirm: "폐기",
    presetNamePh: "이름",
    presetColHead: "앱에서 열리는 것",
    presetEditing: "프리셋 편집 중",
    presetAllow: "허용",
    presetDeny: "불가",
    presetSave: "저장",
    presetCancel: "취소",
    presetCreate: "만들기",
    presetOwnerOnly: "프리셋은 최고관리자만 바꿀 수 있습니다.",
    presetSavedToast: "프리셋을 저장했습니다",
    presetCreatedToast: "프리셋을 만들었습니다",
    presetRetiredToast: "프리셋을 폐기했습니다",
  },
};

export default function AccessPresetsTab({ teamId, canEdit, actionsSlot }: {
  teamId: string;
  /** Owners only — the store's guard is on the actions, this is the screen saying so first. */
  canEdit: boolean;
  /** The element on the tab line where 편집 and 프리셋 만들기 land. See PortalUsersPage. */
  actionsSlot?: HTMLElement | null;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  /* NO TITLE. The lit tab above already reads 앱 권한 프리셋. Everything else — the buttons, the
     table, the one sentence under it — belongs to the list, which is what holds the draft. */
  return <AccessPresetList t={t} teamId={teamId} canEdit={canEdit} lang={lang} actionsSlot={actionsSlot} />;
}

/**
 * The team's app-access presets: one table, edited in place.
 *
 * WHY THE FOLLOWER COUNT IS NOT DECORATION. A preset here is living inheritance — editing it
 * changes everybody following it, which is the combination AWS avoids (managed policies cannot be
 * edited) and Genetec avoids (templates are copied, not followed). The store's own comment on
 * updateAccessPreset says doing it anyway is defensible only while the person editing can see who
 * they are about to change. The count sits in every column head, in both modes, which is what
 * keeps that true now that the editing happens in the table.
 *
 * ONE EDIT BUTTON, NOT TWO PER COLUMN (owner, 2026-09-28: 이거 따로따로 편집/폐기 넣지 말고
 * 오른쪽 위에 편집 버튼 누르면 이름 변경할 수 있고 체크 선택/해제할 수 있고 저장 눌러서
 * 변경사항 저장할 수 있게 · 삭제도 그때 가능하게 하고).
 *
 * The old shape put 편집 and 폐기 over every column — six buttons for three presets, above a table
 * whose whole point is reading across. Now the table itself is the editor: names become fields,
 * cells become controls, and one 저장 writes every change at once. Deleting moved inside that
 * gesture too, so the consequence sentence is read while the rest of the edit is still on screen
 * and nothing is destroyed until 저장.
 */
/** The draft key of the column being added. Never a stored id — `save` turns it into one. */
const NEW_ID = "__new";

/** The column being added, shaped as a preset so the matrix needs no second code path. */
const NEW_PRESET: AccessPreset = { id: NEW_ID, teamId: "", label: "", actions: [] };

/** The width the matrix needs for n preset columns. One definition, used by the scroll container
 *  and by the decision of whether a new column can be typed into. */
const tableMinWidth = (n: number) => 160 + n * 188 + 40;

function AccessPresetList({ t, teamId, canEdit, lang, actionsSlot }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  teamId: string;
  canEdit: boolean;
  lang: "en" | "ko";
  actionsSlot?: HTMLElement | null;
}) {
  const { showToast } = useToast();
  // Raw slices out of the selectors, filtering in memos — presetsForTeam and
  // accountsFollowingPreset both build new arrays, and a selector that does that never settles.
  const allPresets = useVcaStore(s => s.accessPresets);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const addAccessPreset = useVcaStore(s => s.addAccessPreset);
  const updateAccessPreset = useVcaStore(s => s.updateAccessPreset);
  const archiveAccessPreset = useVcaStore(s => s.archiveAccessPreset);
  const presets = useMemo(() => presetsForTeam(allPresets, teamId), [allPresets, teamId]);
  /* THE ACCOUNTS, NOT THEIR NAMES. It mapped to names, which was everything a count needed and
     nothing a list needs — 「사용중 · 1」 now opens on the people it is counting, and a person is
     told apart by an address when two of them share a name. */
  const followersOf = useMemo(() => {
    const map = new Map<string, PortalUser[]>();
    presets.forEach(pr => map.set(pr.id, accountsFollowingPreset(portalUsers, pr.id)));
    return map;
  }, [presets, portalUsers]);
  /** The preset whose follower list is open. Read-only — see FollowerList. */
  const [showingFollowers, setShowingFollowers] = useState<AccessPreset | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  /**
   * The whole table's unsaved state: a name, a one-line description and a grant set per preset,
   * plus the ones struck out.
   *
   * THE DESCRIPTION IS HERE NOW, and it had nowhere else to be: the draft carried only a label, so
   * a preset's description could be written once at creation and never changed again. It is not
   * decoration — it is the line under each preset's name in the grant picker on the invite form
   * and the account card, which is what an administrator reads to choose between them.
   */
  const [draft, setDraft] = useState<Record<string, { label: string; actions: AppAction[] }>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  /**
   * The preset being added inside the table, as a column beside the ones it is being compared to
   * (owner, 2026-09-28: 많아질때는 패널 열리는 방식으로 가고 그전까진 표안에서 편집하게하면
   * 어때?). `null` while nothing is being added; `NEW_ID` is a draft key, never a stored id.
   */
  const [adding, setAdding] = useState(false);
  /*
   * Does one more column fit without the table scrolling sideways?
   *
   * Measured, not assumed: the width a card gets depends on the window and on the rail, so a fixed
   * count ("up to five") would be right on one screen and a lie on the next. The arithmetic is
   * PresetMatrix's own minWidth formula, read from the element that actually scrolls, so the
   * answer cannot drift from the thing it is predicting.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => setCardWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columnFits = cardWidth === null ? true : tableMinWidth(presets.length + 1) <= cardWidth;

  const startEditing = (withNew = false) => {
    const d: Record<string, { label: string; actions: AppAction[] }> = {};
    presets.forEach(pr => { d[pr.id] = { label: presetLabel(pr, lang), actions: [...pr.actions] }; });
    if (withNew) d[NEW_ID] = { label: "", actions: [] };
    setDraft(d);
    setRemoved([]);
    setAdding(withNew);
    setEditing(true);
  };
  const stopEditing = () => { setEditing(false); setDraft({}); setRemoved([]); setAdding(false); };

  const setName = (id: string, label: string) =>
    setDraft(d => ({ ...d, [id]: { ...d[id], label } }));
  const setActions = (id: string, actions: AppAction[]) =>
    setDraft(d => ({ ...d, [id]: { ...d[id], actions: withAppActionDeps(actions) } }));

  /** Everything that would be written, so the save button can be dead when nothing changed. */
  const newDraft = adding ? draft[NEW_ID] : undefined;
  const dirty = editing && (removed.length > 0 || !!newDraft?.label.trim() || !!newDraft?.actions.length || presets.some(pr => {
    const d = draft[pr.id];
    if (!d) return false;
    return d.label !== presetLabel(pr, lang)
      || d.actions.length !== pr.actions.length
      || d.actions.some(a => !pr.actions.includes(a));
  }));
  /** A preset with nothing ticked cannot be followed — the invite form refuses to send it. */
  const emptyDraft = editing && (
    presets.some(pr => !removed.includes(pr.id) && (draft[pr.id]?.actions.length ?? 0) === 0)
    /* The new column counts only once somebody has started it. An untouched empty column is not
       an unfinished preset, it is an offer — 저장 must not be dead because of it. */
    || (!!newDraft && (!!newDraft.label.trim() || newDraft.actions.length > 0)
        && (!newDraft.label.trim() || newDraft.actions.length === 0))
  );

  const save = () => {
    presets.forEach(pr => {
      if (removed.includes(pr.id)) { archiveAccessPreset(pr.id); return; }
      const d = draft[pr.id];
      if (!d) return;
      const sameLabel = d.label === presetLabel(pr, lang);
      const sameActions = d.actions.length === pr.actions.length && d.actions.every(a => pr.actions.includes(a));
      if (sameLabel && sameActions) return;
      updateAccessPreset(pr.id, {
        ...(sameLabel ? {} : { label: d.label }),
        ...(sameActions ? {} : { actions: d.actions }),
      });
    });
    /* The new column, last, so it lands at the end of the list the way it sat at the end of the
       table. Only when it was actually started — see emptyDraft. */
    if (newDraft && newDraft.label.trim() && newDraft.actions.length > 0) {
      addAccessPreset({ teamId, label: newDraft.label.trim(), actions: newDraft.actions });
    }
    showToast({ variant: removed.length ? "warning" : "success", title: t.presetSavedToast });
    stopEditing();
  };

  /** How many accounts the pending edit would reach — the warning the store insists on. */
  const reach = editing
    ? presets.filter(pr => draft[pr.id] || removed.includes(pr.id)).reduce((n, pr) => n + (followersOf.get(pr.id) ?? []).length, 0)
    : 0;

  /* Onto the tab line when there is one to land on, otherwise a row of its own — see the note on
     the slot in PortalUsersPage. */
  const actions = (
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginBottom: actionsSlot ? 0 : "14px", minHeight: CONTROL_HEIGHT }}>
        {!canEdit ? (
          // Said, not hidden — the same rule the purpose list follows.
          <p style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.presetOwnerOnly}</p>
        ) : editing ? (
          /*
            NO BUTTONS UP HERE WHILE EDITING (owner, 2026-09-28: 중복이라 별로인가..).
            
            They were here AND in the floating bar, which asks a reader to work out which of two
            identical 저장 buttons is the real one. Shopify's save bar — the pattern the bar below
            is taken from — takes the header's actions away and carries them itself, for exactly
            that reason. What stays here is the one thing the bar has no room for: how many
            accounts a pending 삭제 would reach.
          */
          removed.length > 0 ? (
            <p style={{ flex: 1, fontSize: "11px", color: "var(--danger-500)", fontWeight: 700, lineHeight: 1.45 }}>
              {t.presetRetireBody(removed.reduce((n, id) => n + (followersOf.get(id) ?? []).length, 0))}
            </p>
          ) : null
        ) : (
          /* Still drawn while the create panel is open. The panel is fixed to the right edge with
             a scrim over these, so they are not reachable — but blanking the row moved the table
             up by a row-height the moment the panel opened, which read as the page changing
             underneath rather than a panel opening over it. */
          <>
            {presets.length > 0 && (
              <button className="portal-btn-outline" onClick={() => startEditing()}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Pencil size={13} strokeWidth={2.4} aria-hidden="true" />
                {t.presetEdit}
              </button>
            )}
            {/* A drawn + at the pencil's size, not a text 「+」 (owner, 2026-09-28: 상단 오른쪽
                버튼 두개 아이콘 크기를 맞춰줘). The character rendered at the label's 12px with
                the font's own weight, so the two buttons carried marks of different sizes and
                different stroke weights sitting side by side. */}
            {/*
              IN THE TABLE WHILE A COLUMN STILL FITS, IN A PANEL ONCE IT DOES NOT (owner,
              2026-09-28: 많아질때는 패널 열리는 방식으로 가고 그전까진 표안에서 편집하게하면
              어때?).

              Making a preset is mostly deciding how it differs from the ones that exist, so the
              column beside them is the right place to do it — and the table is already an editor:
              names are fields, cells are controls, one 저장 writes the lot.

              The switch is not a taste: it is the same arithmetic the scroll container uses for
              its own minWidth, so the two cannot disagree. While one more column fits in the
              width on screen, the button adds that column; once it would start off-screen — six
              at a 1440px window, fewer on a narrower one, MEASURED — a column you cannot see is
              not a place to type, and the panel takes over.
            */}
            <button className="portal-btn-outline" onClick={() => (columnFits ? startEditing(true) : setCreating(true))}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
              {t.presetNew}
            </button>
          </>
        )}
      </div>
  );

  return (
    <div>
      {actionsSlot ? createPortal(actions, actionsSlot) : actions}

      {/*
        THE TABLE STAYS UP WHILE THE PANEL IS OPEN (owner, 2026-09-28: 만들기 누르니까 배경이
        바뀌네 · 프리셋을 추가하는만큼, 기존 표에서 보던 순서로 있어야 쉽게 인지하고 선택
        바르게할수있을것같아).
        
        The form used to take the card's place, so opening it emptied the card to a grey block and
        took away the three presets you are adding a fourth one beside. The panel's list is the
        same GRANT_TREE in the same order as the table's rows, which only helps if the table is
        there to read it against — the new preset is chosen by comparing it to the ones that exist.
      */}
      <div ref={cardRef} style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "16px" }}>
        {presets.length === 0 && !adding ? (
          <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.presetEmpty}</p>
        ) : (
          <PresetMatrix
            /* The column being added rides with the stored ones so every row draws it in place —
               it is a preset in the table's eyes and only `save` knows the difference. */
            presets={adding ? [...presets, NEW_PRESET] : presets}
            lang={lang}
            t={t}
            editing={editing}
            draft={draft}
            removed={removed}
            onSetActions={setActions}
            footer={!editing ? undefined : pr => {
              const gone = removed.includes(pr.id);
              return (
                /* No box (owner, 2026-09-28: 삭제버튼은 테두리없이 글자랑 아이콘만 남겨줘).
                   Every cell in the column above it is already a bordered chip, so one more
                   outline at the foot read as a fourth value rather than an action on the three. */
                <button className="portal-btn-quiet"
                  onClick={() => (pr.id === NEW_ID
                    ? (setAdding(false), setDraft(d => { const { [NEW_ID]: _drop, ...rest } = d; return rest; }))
                    : setRemoved(r => gone ? r.filter(x => x !== pr.id) : [...r, pr.id]))}
                  /*
                   * RED AND A BIN ONLY WHERE SOMETHING IS ACTUALLY DESTROYED (owner, 2026-09-28:
                   * 새로 추가하는 열 맨 아래 취소 아이콘이 쓰레기통인데 되돌리기 아이콘으로
                   * 바꿔줘 그리고 빨간색일 필요있을까?).
                   *
                   * The column being added has never been saved, so this button throws away a
                   * draft — the same act as 되돌리기 on a struck-out column, and the opposite of
                   * 삭제. A bin said the wrong thing and the danger colour said the wrong weight:
                   * in this console red marks what cannot be undone, and pressing this loses
                   * nothing anybody else can see.
                   */
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "26px", padding: "0 2px", border: "none", background: "none", color: gone || pr.id === NEW_ID ? "var(--gray-600)" : "var(--danger-500)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {gone || pr.id === NEW_ID
                    ? <Undo2 size={13} strokeWidth={2.4} aria-hidden="true" />
                    : <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />}
                  {pr.id === NEW_ID ? t.presetCancel : gone ? t.presetUndoRemove : t.presetRetire}
                </button>
              );
            }}
            header={pr => {
              const followers = followersOf.get(pr.id) ?? [];
              const gone = removed.includes(pr.id);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, opacity: gone ? 0.4 : 1 }}>
                  {/* 삭제 is at the FOOT of the column — see the footer row at the end of
                      PresetMatrix. */}
                  {editing && !gone ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <input
                      value={draft[pr.id]?.label ?? ""}
                      onChange={e => setName(pr.id, e.target.value)}
                      placeholder={pr.id === NEW_ID ? t.presetNamePh : undefined}
                      autoFocus={pr.id === NEW_ID}
                      /* 128px, not the column's full width (owner, 2026-09-28: 조사자랑 감독자
                         적혀있는 인풋박스가 너무 넓어 좀 좁혀줘). A column runs to 1fr so it can
                         hold 보기 · 검색 in its cells, but the name in it is three letters —
                         stretching the box to the column made an empty field the widest thing on
                         the screen. 128px still takes a name twice as long as any of the three. */
                      style={{ width: "100%", maxWidth: "104px", boxSizing: "border-box", height: "28px", padding: "0 8px", borderRadius: "7px", border: BORDER, fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit", backgroundColor: "white" }}
                    />
                    {/* Not a door while the name beside it is an input: opening a panel over an
                        unsaved edit would put the table's own 저장 behind a scrim. */}
                    {pr.id !== NEW_ID && <UseChip n={followers.length} t={t} plain />}
                    </div>
                  ) : null}
                  {editing && !gone ? null : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      <span title={presetLabel(pr, lang)} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: gone ? "line-through" : undefined }}>
                        {draft[pr.id]?.label || presetLabel(pr, lang)}
                      </span>
                      <UseChip n={followers.length} t={t}
                        onOpen={followers.length > 0 ? () => setShowingFollowers(pr) : undefined} />
                    </div>
                  )}

                </div>
              );
            }}
          />
        )}
      </div>

      {/* UNDER THE TABLE (owner, 2026-09-28: 이 설명은 표 아래 놔도 될 것 같은데). It is the one
          fact the table cannot show, and a reader meets it after seeing what a preset is rather
          than before. While an edit is pending it says how many accounts that edit would reach —
          the same sentence, made specific. */}
      <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "12px" }}>
        {editing && reach > 0 ? t.presetEditReach(reach) : t.presetIntro}
      </p>

      {/*
        THE SAME TWO BUTTONS, WITHIN REACH (owner, 2026-09-28: 저장, 취소를 중앙 아래 플로팅
        버튼으로도 만들어주면 어떨까?).
        
        The pair at the top right is where 편집 was clicked, so it stays — but the grant rows run
        past the fold, and somebody who ticks a cell near 레드맵 has scrolled both of them off the
        screen. A bar pinned to the bottom is what every screen with a long editable body does
        (Shopify's save bar, Figma, Google Docs): the way out of edit mode is never more than a
        glance away from the row being edited.
        
        And it is the console's existing dark pill, not a new one (owner, 2026-09-28: 기존에 까만
        플로팅박스 쓰이고있는 컴포넌트 있을텐데?) — the camera list's selection bar and the VIP
        list's, to the token: --gray-900 at radius 12, 10/12/10/18 padding, the same drop shadow,
        centred by a full-width pointerEvents:none wrapper so it never runs under the rail. Saving
        a preset and acting on ticked cameras are the same kind of moment, so they look the same.
      */}
      {editing && (
        <FloatingBulkBar>
          {/* The bar says what mode you are in, the way the camera list's bar says what the
              selection is — without it a dark pill holding two buttons has no subject. */}
          <BulkBarSubject>{t.presetEditing}</BulkBarSubject>
          <BulkBarDivider />
          <button onClick={save} disabled={!dirty || emptyDraft}
            title={emptyDraft ? t.presetNoActions : undefined}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: dirty && !emptyDraft ? "white" : "var(--gray-700)", color: dirty && !emptyDraft ? "var(--gray-900)" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: dirty && !emptyDraft ? "pointer" : "not-allowed", flexShrink: 0, fontFamily: "inherit" }}>
            {t.presetSave}
          </button>
          <BulkBarExit onClick={stopEditing}>{t.presetCancel}</BulkBarExit>
        </FloatingBulkBar>
      )}

      {showingFollowers && (
        <FollowerList
          preset={showingFollowers}
          /* Read from the store by id rather than from the press — a follower who is cut loose
             while this is open should leave the list, not sit in a snapshot of it. */
          followers={followersOf.get(showingFollowers.id) ?? []}
          t={t} lang={lang}
          onClose={() => setShowingFollowers(null)}
        />
      )}

      {creating && (
        <PresetEditor t={t} preset={null} followers={[]}
          onCancel={() => setCreating(false)}
          onSave={patch => {
            addAccessPreset({
              teamId,
              label: patch.label ?? "",
              actions: patch.actions ?? [],
            });
            showToast({ variant: "success", title: t.presetCreatedToast, desc: patch.label });
            setCreating(false);
          }} />
      )}
    </div>
  );
}

/**
 * THE THREE SIDE BY SIDE, SO THE DIFFERENCE IS THE THING YOU SEE (owner, 2026-09-28: 이거 세로로
 * 세 개 두면 어때? · 구분된 차이를 더 쉽게 알 수 있게 바꾸고 싶어).
 *
 * They were already stacked — three rows, each ending in a long horizontal run of grant names
 * separated by 「·」. Reading what separates 운영자 from 조사자 meant holding one 10-item sentence
 * in your head while scanning the next one. The answer every comparable screen reaches for is a
 * MATRIX: eight web screens checked on Mobbin (Synthesia, Slack, Webflow, Frame.io, Clockwise,
 * folk, Krea AI, NordVPN) and all eight put the capabilities down the left and the options across
 * the top, with a mark in the cell. Not one of them prints a per-option list of what it includes.
 *
 * THE CELL SAYS HOW FAR, NOT JUST WHETHER. On the two screens that have two depths the cell prints
 * 「보기」 or 「보기 · 검색」, because that IS the difference between our first two presets — a ✓ in
 * both cells would have hidden exactly what the owner asked to see.
 *
 * IN EDIT MODE THE CELL IS THE CONTROL. Clicking cycles it through the states that row can hold —
 * for a two-depth screen that is 없음 → 보기 → 보기 · 검색 → 없음. A separate widget per row was
 * considered and dropped: the reader is already pointing at the cell whose value they want to
 * change, and three shapes of control in one column would be harder to read than the values are.
 *
 * Same GRANT_TREE the permission panel draws, so the order, the grouping and the wording cannot
 * drift between the screen that hands a preset out and the screen that defines it.
 */
/*
 * ONE LEFT EDGE FOR EVERY LABEL (owner, 2026-09-28: 이벤트 글자 시작이 대시보드 대에 맞춰줘).
 *
 * The band's text is pushed right by its own icon, so 대시보드 started at 316 while 이벤트 and
 * 시스템 under it started at 303 and the indented 「VIP 감지」 at 315 — three left edges within
 * 13px of each other, which reads as things not lining up rather than as a hierarchy.
 *
 * The first step now lands ON the band's text, and the indents step off from there. The tab is
 * still told apart by its grey ground and its icon, not by a 13px offset nobody can measure.
 *
 * The numbers move together with the band's own left padding (owner: 메뉴 4개도 아이콘 왼쪽 공간
 * 조금더 여유를 주면 좋겠어) — the icon had 7px of grey to its left and now has 15px, so every
 * label steps right by the same 8.
 */
const LABEL_INDENT = "34px";
const LABEL_INDENT_2 = "46px";
const LABEL_INDENT_3 = "58px";

function PresetMatrix({ presets, lang, header, footer, editing, draft, removed, onSetActions, t }: {
  presets: AccessPreset[];
  lang: "en" | "ko";
  t: (typeof T)["en"] | (typeof T)["ko"];
  /** What sits over each column — the name and its follower line. */
  header: (preset: AccessPreset) => React.ReactNode;
  /** What closes each column. Only while editing: it is 삭제. */
  footer?: (preset: AccessPreset) => React.ReactNode;
  editing: boolean;
  draft: Record<string, { label: string; actions: AppAction[] }>;
  removed: string[];
  onSetActions: (id: string, actions: AppAction[]) => void;
}) {
  const g = APP_GRANT_LABELS[lang];
  const actionsOf = (pr: AccessPreset) => (editing ? draft[pr.id]?.actions ?? pr.actions : pr.actions);
  /*
   * VALUE COLUMNS ARE 150px, AND THE SLACK GOES TO THE RIGHT MARGIN (owner, 2026-09-28: 왼쪽에
   * 제목들이랑 오른쪽 항목들이 거리가 있는데 좋은 방법없을까?).
   *
   * Measured: with three presets the columns came out 228px each holding an 18px mark, and the
   * run from the end of 「VIP 감지」 to its own first mark was about 270px of nothing — far enough
   * that following a row meant tracking across blank space, which is the thing a zebra or a
   * vertical rule is usually patched on to fix.
   *
   * Every admin matrix checked on Mobbin (Vanta, StackAI, Confluence, Fresha, Workable, Langdock)
   * keeps its value columns between about 90 and 150px and lets the leftover sit at the right
   * edge. A fixed width also means a preset's cell is the same size whatever the window does, and
   * the trailing `1fr` is the empty track that absorbs the rest.
   */
  /* 188px, widened from 168 (owner, 2026-09-28: 운영자, 조사자, 감독자 사이 간격을 살짝만
     넓혀줘). Widening the TRACK rather than the gap, because `columnGap` is one number for the
     whole grid and raising it would reopen the space between a row's name and its first mark —
     the thing that was just closed. */
  const COLS = `minmax(160px, 220px) repeat(${presets.length}, 188px) minmax(0, 1fr)`;
  const line: React.CSSProperties = {
    display: "grid", gridTemplateColumns: COLS, columnGap: "12px",
    /* 6px, not 8 — measured 41px rows against 28-34px in the six admin matrices checked on
       Mobbin. At seventeen rows the difference is a whole screen. */
    alignItems: "center", padding: "6px 12px", borderTop: BORDER,
  };

  /** The states one row can hold, in the order clicking walks them. */
  /*
   * WHILE EDITING, THE CELL SAYS THE WORD (owner, 2026-09-28: 편집중일땐, 체크 표시옆에 허용이나
   * 가능/불가능, 불가 이런 단어들도 붙여줘서 이해를 도우면 어떨까).
   *
   * Reading a saved table, ✓ and — carry it: the shape of the column is the information and a
   * word in every cell would be seventeen rows of repeated text. But in edit mode each cell is a
   * button that CYCLES, and then a ✓ leaves the other end of the cycle unnamed — you find out
   * what "off" is called by clicking. The word says both states in the same vocabulary the rows
   * above it use.
   */
  /* `mark` is the ✓ / — the cell keeps: the word goes BESIDE it, not instead of it (owner,
     2026-09-28: 편집중일땐 체크 옆에 한글을 추가해달라니까). Off-state words only while editing —
     a saved column of seventeen 불가 would bury the few 허용 it exists to show. */
  type CellState = { text: string; on: boolean; has: AppAction[]; mark?: boolean };
  const statesFor = (row: GrantRowDef): CellState[] => {
    const none: CellState = { text: editing ? t.presetDeny : "", on: false, has: [], mark: true };
    /* Four, because a two-pane screen has three ways to be on — see STAGE_VALUES. 검색만 is last
       in the cycle and holds the search grant WITHOUT the browse one, which is the combination
       the old two-cell control could not express. */
    if (row.search) return [
      none,
      { text: g.stage.view, on: true, has: [row.action] },
      { text: g.stage.viewSearch, on: true, has: [row.action, row.search] },
      { text: g.stage.searchOnly, on: true, has: [row.search] },
    ];
    if (row.searchIsAll) return [none, { text: g.stage.searchOnly, on: true, has: [row.action] }];
    return [none, { text: editing ? t.presetAllow : "", on: true, has: [row.action], mark: true }];
  };

  /** Every grant the tab holds, in one list — what the band's own cell switches. */
  const actionsIn = (group: GrantGroupDef): AppAction[] =>
    group.rows.flatMap(r => [r.action, ...(r.search ? [r.search] : []), ...(r.children ?? [])]);

  /*
   * THE BAND'S CELL IS A CONTROL, SO IT ONLY EXISTS WHILE THERE IS SOMETHING TO CONTROL.
   *
   * It was drawn in both modes, and reading 「전체 허용」 on 베스트 프레임 with the five rows that
   * say the same thing sitting directly under it is the one line on this screen that says nothing
   * you cannot already see — and a bold summary value per column over a list of features is the
   * pricing table's tier row. Six admin matrices were checked on Mobbin and every one of them
   * leaves the group row's cells empty.
   *
   * While EDITING it earns its place: it is the only way to turn a whole tab on in one press,
   * which is what the owner asked it for.
   */
  const groupCell = (pr: AccessPreset, group: GrantGroupDef) => {
    if (!editing) return null;
    const held = actionsOf(pr);
    const gone = removed.includes(pr.id);
    const owned = actionsIn(group);
    const on = owned.filter(a => held.includes(a)).length;
    const state = on === 0 ? "none" : on === owned.length ? "all" : "some";
    /* The band's own cell wears the same pill — see the note on the row cell. 「일부」 is filled
       too but in the lighter ground, so a tab that is half given does not read as a whole one. */
    /* Same rule as the row cell: the word carries it, the box would say "press me". 일부 stays a
       step lighter so a half-given tab never reads as a whole one. */
    const body = (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: "22px", padding: "0 2px",
        fontSize: "11.5px", fontWeight: state === "none" ? 500 : 700,
        color: state === "none" ? "var(--gray-300)" : state === "some" ? "var(--gray-500)" : "var(--gray-900)",
        whiteSpace: "nowrap",
      }}>{state === "none" ? (editing ? t.presetDeny : "\u2014") : state === "all" ? t.presetGroupAll : t.presetGroupSome}</span>
    );
    if (!editing || gone) return body;
    const apply = () => onSetActions(pr.id, state === "all" ? held.filter(a => !owned.includes(a)) : [...held, ...owned]);
    return (
      <button type="button" onClick={apply} title={t.presetCycleHint}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "24px", padding: "0 8px", borderRadius: "7px",
          border: state === "none" ? "1px dashed var(--gray-300)" : BORDER,
          backgroundColor: "white", cursor: "pointer", fontFamily: "inherit",
        }}>
        {body}
      </button>
    );
  };

  const cellFor = (pr: AccessPreset, row: GrantRowDef, child?: AppAction) => {
    const held = actionsOf(pr);
    const gone = removed.includes(pr.id);
    const states = child
      ? [{ text: editing ? t.presetDeny : "", on: false, has: [] as AppAction[], mark: true },
         { text: editing ? t.presetAllow : "", on: true, has: [child], mark: true }]
      : statesFor(row);
    const owned = child ? [child] : [row.action, ...(row.search ? [row.search] : [])];
    /*
     * EXACT MATCH, NOT "CONTAINS" (would have shipped a wrong cell).
     *
     * This used to take the LAST state whose grants were all held, which was right while the
     * states were a ladder — each a superset of the one before. 검색만 broke that: it holds the
     * search grant WITHOUT the browse one, so it is not above 보기·검색, it is beside it. An
     * account holding both grants matched all four states and the cell printed 검색만, naming the
     * one permission that account does not have.
     *
     * So a cell is the state whose grants are exactly the ones held out of this row's own.
     */
    const mine = owned.filter(a => held.includes(a));
    const idx = Math.max(0, states.findIndex(st =>
      st.has.length === mine.length && st.has.every(a => mine.includes(a))));
    const cur = states[idx];
    /*
     * THE HELD CELL HAS AREA (owner, 2026-09-28: 이렇게 연하게 표시되어 있으니까 권한이 없는
     * 거라는 느낌이 너무 안 들어서 운영자, 조사자, 감독자 차이가 덜 느껴지는 것 같은데).
     *
     * Right: both states were the same shape at the same size and differed only in ink — a 11.5px
     * ✓ in gray-900 against a 11.5px — in gray-300. At arm's length from a column of seventeen
     * rows that is not a difference, it is a shade.
     *
     * Of the eight comparison tables checked on Mobbin, the ones that read at a glance are the
     * ones where the granted cell carries AREA, not a heavier glyph: Clockwise tints, Synthesia
     * and Krea fill a disc, NordVPN pairs a filled ✓ with a grey ✗. So a held cell is a filled
     * pill and a missing one is bare — a column now reads as a stack of blocks with gaps in it.
     *
     * Neutral, not purple: at seventeen rows × three columns a tinted fill would put the accent
     * colour over most of the table, and this console keeps purple for what one person just
     * chose. The edit-mode chip stays purple for exactly that reason.
     */
    /* THE PILL IS THE READING SHAPE ONLY (owner, 2026-09-28: 보라색 박스 안에 회색 버튼이
       그대로 있는 게 어색해 보여). While editing the cell is already a chip with its own ground,
       so the grey pill inside it was a second box saying the same thing. Editing gets bare text
       in the chip; reading gets the pill. */
    const boxed = !editing || gone;
    /*
     * NOT A PILL WHEN NOBODY CAN CLICK IT (owner, 2026-09-28: 아니 편집아닐때, 체크에 배경색을
     * 넣으니까 이 상태에도 버튼같아보이네..).
     *
     * Right — a filled rounded rectangle at control height IS the shape of a button on every
     * other row of this console, so the saved table offered seventeen rows of them and none did
     * anything. The area it was there for now comes from a filled DISC, which is what the
     * comparison tables that read at a glance actually use (Synthesia, Krea) and which no reader
     * mistakes for something to press. The worded cells keep their word and lose the box: a
     * 「보기 · 검색」 in gray-900 against a hairline 「—」 is already the widest contrast in the row.
     */
    const mark = !cur.mark ? null : cur.on ? (
      /* Reading: a filled disc. Editing: the bare ✓, because the chip around it already has a
         ground and a disc inside a filled chip is two backgrounds for one fact. */
      <span aria-hidden="true" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: boxed ? "18px" : "14px", height: boxed ? "18px" : "14px", borderRadius: "50%",
        backgroundColor: boxed ? "var(--gray-900)" : "transparent",
        color: boxed ? "white" : "var(--gray-900)", flexShrink: 0,
      }}>
        {/* OPTICALLY CENTRED, NOT BOX-CENTRED (owner, 2026-10-01: 원 안에 체크 표시가 살짝
            오른쪽으로 가 있어서 어색해 보이거든).
            Measured first: the ink's centre sat 0.00px off the disc's centre horizontally and
            0.23px above it, so nothing was misaligned — a tick is just not a symmetrical shape.
            Its long arm runs up and to the right, so the mass reads right-of-centre even when the
            bounding box is exactly centred. The nudge is against the eye, not against the numbers,
            which is why it is a fraction of a pixel rather than a whole one. */}
        <Check size={boxed ? 11 : 12} strokeWidth={3.2} style={{ transform: "translate(-0.5px, 0.5px)" }} />
      </span>
    ) : (
      <Minus size={12} strokeWidth={2.6} aria-hidden="true"
        style={{ color: "var(--gray-300)", flexShrink: 0 }} />
    );
    const body = (
      <span aria-label={cur.mark ? (cur.on ? t.presetAllow : t.presetDeny) : undefined}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px",
          height: "22px", padding: "0 2px",
          fontSize: "11.5px", fontWeight: cur.on ? 700 : 500,
          color: cur.on ? "var(--gray-900)" : "var(--gray-400)",
          whiteSpace: "nowrap",
        }}>
        {mark}
        {cur.text}
      </span>
    );
    if (!editing || gone) return body;
    /* Ticking a child ticks the screen it sits on — the store enforces it either way
       (withAppActionDeps), and a cell that appears to switch on and then does not is worse than
       one that quietly brings its parent with it. */
    const next = states[(idx + 1) % states.length];
    const apply = () => {
      const kept = held.filter(a => !owned.includes(a));
      const added = child && next.on ? [...next.has, row.action] : next.has;
      /*
       * TURNING A SCREEN BACK ON BRINGS ITS CONTENT WITH IT — without this the cycle was a dead
       * end (measured: 보기 → 보기·검색 → 검색만 → 불가 → 불가 → 불가).
       *
       * 모니터링 with neither VIP nor 모르는 사람 is a blank list, so withAppActionDeps drops it
       * on save — which meant stepping off 불가 granted the screen and had it taken away again in
       * the same click, and the cell never moved. AppGrantList's own toggle has done this since
       * the rule was written; the matrix was the caller that did not.
       */
      const content = added.flatMap(a2 => APP_ACTION_CONTENT[a2] ?? []).filter(c => !kept.includes(c) && !added.includes(c));
      onSetActions(pr.id, [...kept, ...added, ...content]);
    };
    /*
     * A CHIP WHILE EDITING, BUT NOT A PURPLE ONE (owner, 2026-09-28: 아래 체크랑 보기/검색 이런
     * 것도 변경할 수 있게 해줘 → 편집상태일때 너무 다 보라색박스라서 보기 불편해).
     *
     * The box is what makes the value look clickable, and it stays. The FILL does not: seventeen
     * rows by three columns is fifty-one cells, so tinting every held one put the accent colour
     * over most of the table — measured on this console's own rule of keeping purple to well
     * under a tenth of a screen, and the wall of it drowned exactly what it was meant to pick out.
     *
     * So held and missing differ the way they do in the saved table, by the mark and the word,
     * and the border alone says "this cell is a control": solid for a value, dashed for none.
     */
    return (
      <button type="button" onClick={apply} title={t.presetCycleHint}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "24px", padding: "0 8px", borderRadius: "7px",
          border: cur.on ? BORDER : "1px dashed var(--gray-300)",
          backgroundColor: "white",
          cursor: "pointer", fontFamily: "inherit",
        }}>
        {body}
      </button>
    );
  };

  return (
    /* Scrolls sideways rather than squeezing: a customer can make more presets than fit, and a
       column narrower than its own name is worse than a scrollbar. */
    /* The vertical scroll lives HERE, not on the page, because the preset names have to stay on
       screen while you read down the rows (owner, 2026-09-29: 표 머리를 스크롤에 붙여두는 쪽).
       
       It cannot be done the usual way — `position: sticky` against the page — because this element
       already sets `overflow-x: auto`, and a box that scrolls in one axis is a scroll container in
       BOTH (the spec computes the visible other axis to auto). A header inside it would stick to
       this box rather than to the page, and this box never scrolled vertically. So the box takes
       the vertical scroll too, and the header sticks to the top of it.
       
       maxHeight, not height: a short table still ends where its rows end and no scrollbar appears.
       The value leaves room for the shell's own chrome above it, measured at a 913px window. */
    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 210px)" }}>
      <div style={{ minWidth: `${tableMinWidth(presets.length)}px` }}>
        {/*
          A HEADER ROW, NOT THREE FLOATING NAMES (owner, 2026-09-28: 프리셋 디자인이 약간
          가격표같다).
          
          Three bold names spaced across white, with nothing ruling them off from the body, is the
          shape of a plan comparison — and the first grey band under them (대시보드) was being read
          as the header's own band. Of six admin permission matrices checked on Mobbin, five set
          the names in a header ROW with a tinted ground or a rule under it, and five label the
          first cell (Vanta 「ACTIONS」, StackAI 「Permission」, Workable 「Hiring team role」).
          The label is what says the left column holds the questions and the right ones the answers.
        */}
        <div style={{ position: "sticky", top: 0, zIndex: 3, backgroundColor: "white", display: "grid", gridTemplateColumns: COLS, columnGap: "12px", alignItems: "end", padding: "10px 12px 10px", borderBottom: BORDER }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t.presetColHead}
          </span>
          {presets.map(pr => <div key={pr.id} style={{ minWidth: 0 }}>{header(pr)}</div>)}
          <span />
        </div>
        {GRANT_TREE.map((group, gi) => (
          <div key={gi}>
            {/*
              A ROW, NOT A BAND (owner, 2026-09-28: 대시보드엔 베스트 프레임이 없는데, 이거
              이렇게 분류하면 안 돼).

              The grey band made 「대시보드」 read as the head of everything under it, and the very
              next row is 베스트 프레임 — which is not in the dashboard, it is a tab BESIDE it. The
              app's menu has four tabs (대시보드 · 베스트 프레임 · 데이터 · 레드맵); two of them
              hold the rows under them and two are rows themselves.

              So the container sits on the same left edge as 베스트 프레임 and 레드맵, because it is
              their peer, and what it holds is indented under it. It has no cells — 대시보드 is not
              a grant, which is the other thing the band was hiding.
            */}
            {/* GREY, SO THE FOUR READ AS THE MENU THEY ARE (owner, 2026-09-28: 아까처럼 큰 메뉴엔
                회색 배경을 넣어주면 더 쉽게 알 수 있을 것 같아). The band went away when the
                table lost its inner border, and without it a tab and a grant were the same kind of
                line. It runs to the card's inner edge — it is the head of a section, not a row —
                while its text keeps the rows' 12px so the column still lines up. */}
            {/* 16px against the band's own -4px bleed lands its grid on the rows' 12px — the value
                  columns MUST share one origin with the rows below, or every chip in the band
                  sits off its column (owner, 2026-09-28: 정렬을 좀 수정해야해). The icon's
                  breathing room is paddingLeft on the label alone, which moves no column. */}
              <div style={{ ...line, margin: "0 -4px", padding: "7px 16px", borderTop: gi === 0 ? "none" : BORDER, backgroundColor: "var(--gray-50)" }}>
              {/*
                NO FOLD (owner, 2026-09-28: 접기가 왜 필요해?).
                
                There was a chevron here for a while, put in because Vanta and StackAI have one.
                They have thirty-odd rows; this table has seventeen in four groups and its largest
                group is five. Folding 베스트 프레임 saved 185px — less than one scroll — and the
                whole job of this screen is comparing three presets across ALL the rows, so a
                control whose only effect is to hide rows works against it. The state was not
                stored either, so every visit started expanded regardless.
              */}
              <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0,
                /* 8, and it is arithmetic, not taste: the band's content starts at the rows' 12px
                   (16px padding against its own -4px bleed), then 8 + a 16px icon + a 10px gap
                   lands its text on LABEL_INDENT's 34 + the rows' 12 = 46. It was 11 and every
                   band sat 3px right of the rows under it — measured 330 against 327. */
                paddingLeft: "8px" }}>
                <GrantGroupIcon caption={group.caption} color="var(--gray-500)" />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>
                  {g.groupName[group.caption]}
                </span>
              </span>
              {/* THE WHOLE TAB IN ONE CELL (owner, 2026-09-28: 회색 배경에도 체크 가능하게 해서
                  그 화면에 모든 기능 허용하게 할 건지 체크하는 걸로 만들어 줘). It reads as a
                  summary in both modes — 전체 / 일부 / — — and in edit mode pressing it turns the
                  tab's rows all on, or all off if they already are. 일부 is never something you
                  set: it is what the rows below say, so the press from there goes to 전체. */}
              {presets.map(pr => <span key={pr.id} style={{ opacity: removed.includes(pr.id) ? 0.4 : 1 }}>{groupCell(pr, group)}</span>)}
            </div>
            {group.rows.map(row => (
              <div key={row.action}>
                {/* A heading inside the tab, with no cells of its own — 이벤트 is a panel, not a
                    grant. See GrantRowDef.subhead. */}
                {row.subhead && (
                  <div style={line}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", paddingLeft: LABEL_INDENT }}>
                      {g.subName[row.subhead]}
                    </span>
                  </div>
                )}
                <div style={line}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", minWidth: 0, paddingLeft: row.indent ? LABEL_INDENT_2 : LABEL_INDENT }}>
                    {g.rowName[row.action] ?? g.actionName[row.action]}
                  </span>
                  {presets.map(pr => <span key={pr.id} style={{ opacity: removed.includes(pr.id) ? 0.4 : 1 }}>{cellFor(pr, row)}</span>)}
                </div>
                {(row.children ?? []).map(c => (
                  <div key={c} style={line}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", paddingLeft: row.indent ? LABEL_INDENT_3 : LABEL_INDENT_2, minWidth: 0 }}>
                      {g.rowName[c] ?? g.actionName[c]}
                    </span>
                    {presets.map(pr => <span key={pr.id} style={{ opacity: removed.includes(pr.id) ? 0.4 : 1 }}>{cellFor(pr, row, c)}</span>)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {/*
          삭제 AT THE FOOT OF ITS OWN COLUMN (owner, 2026-09-28: 삭제버튼..그냥 맨 아래
          넣어줄까..?).
          
          Three places were tried above the table and each one lied about its subject: under the
          follower line it read as an action on that line, and right-aligned in the header it sat
          against the NEXT preset's name. At the foot of the column there is nothing else it could
          belong to — it closes the seventeen cells above it, which is exactly what it removes. It
          is where a pricing table puts the button that acts on a plan.
        */}
        {footer && (
          <div style={{ ...line, borderTop: BORDER, alignItems: "start", padding: "12px" }}>
            <span />
            {presets.map(pr => <div key={pr.id} style={{ minWidth: 0 }}>{footer(pr)}</div>)}
            <span />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 「사용중 1」 BESIDE THE NAME, NOT UNDER IT (owner, 2026-09-28: 이거는 없어두되지않을까? ·
 * 사용중 이런식으로 표시해줄까?).
 *
 * It was a full grey sentence on a second line under every column name — 「이 프리셋을 따르는
 * 계정 1개」 — and that stack, a bold name over a grey line, is precisely the shape of a plan name
 * over its price. Six admin permission matrices were checked on Mobbin (Vanta, StackAI,
 * Confluence, Fresha, Workable, Langdock) and not one puts a second line under a role name; the
 * six pricing tables checked all do.
 *
 * The number stays, because it is the one thing this screen has to say before somebody edits a
 * preset — updateAccessPreset's own rule is that an edit is defensible only while the person
 * making it can see how many accounts it reaches. A chip on the name's own line says it in four
 * characters instead of ten.
 */
/*
 * WHAT CARRIED OVER FROM THE CAMERA-GROUP CARD, AND WHAT DID NOT (2026-10-02).
 *
 * The same fault was here: a number nothing could be done with. 「사용중 · 1」 answered "how many"
 * and left "which one" to a search this console cannot run — the accounts table matches a name and
 * an address, not a preset. So the chip became the door, and the people are named behind it.
 *
 * THE SPLIT DID NOT CARRY, and it would be wrong here. A camera group has a second half because an
 * account that was never narrowed watches its cameras without naming it; a preset has no such
 * half. Following it is the only way to hold it — an account with its own grants holds its own
 * set, not a looser version of this one — so there is one list and one number.
 *
 * NEITHER DID THE 「· 조사자」 BESIDE EACH NAME. On the group card that second value is the axis
 * the card cannot show. Here the column the chip sits under IS that value, and printing it again
 * on every row would be the same word twice.
 *
 * AND NOT A SECOND HOP. A name on the group card opens the account because the card has nothing
 * else to say about it; this panel already carries the address, and a third panel over an edit
 * table would be a step for nothing.
 */
function UseChip({ n, t, plain, onOpen }: {
  n: number;
  t: (typeof T)["en"] | (typeof T)["ko"];
  plain?: boolean;
  /** Set only on the saved table, and only when somebody follows this — see the note above. */
  onOpen?: () => void;
}) {
  const body = (
    <span style={{
      flexShrink: 0, fontSize: "10.5px", fontWeight: 700,
      color: n === 0 ? "var(--gray-400)" : "var(--gray-600)",
      /* NO PILL WHILE EDITING (owner, 2026-09-28: 일약을 벗기자). The number stays — it is the
         blast radius of the edit being made, and updateAccessPreset's own rule is that changing a
         preset is defensible only while the person doing it can see how many accounts it reaches.
         What goes is the box: beside a name INPUT it was a second bordered shape competing with
         the field in a 188px column. Reading the saved table it keeps the pill, which is the same
         vocabulary the cells below it use. */
      ...(plain ? {} : {
        padding: "2px 6px", borderRadius: "999px",
        border: BORDER, backgroundColor: n === 0 ? "white" : "var(--gray-50)",
      }),
      fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
    }}>
      {n === 0 ? t.presetFollowersNone : t.presetFollowers(n)}
    </span>
  );
  if (!onOpen) return body;
  /* The chip itself is the target, not a digit inside it — the shape that already reads as one
     object keeps reading as one object, and the press lands wherever the reader aims. */
  return (
    <button type="button" onClick={onOpen}
      style={{ display: "inline-flex", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}>
      {body}
    </button>
  );
}

/**
 * The accounts following one preset, named. Read-only, for the reason the camera-group card's
 * AccountPeek gives: the panel that changes an account belongs to the 「사용자」 rail row, and two
 * panels writing the same account drift the first time one of them gains a field.
 */
function FollowerList({ preset, followers, t, lang, onClose }: {
  preset: AccessPreset;
  followers: PortalUser[];
  t: (typeof T)["en"] | (typeof T)["ko"];
  lang: "en" | "ko";
  onClose: () => void;
}) {
  return (
    <Drawer title={t.presetFollowersTitle(presetLabel(preset, lang))} width="420px" onClose={onClose}
      footer={<PanelCancel onClick={onClose} label={t.presetClose} />}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {followers.map(u => (
          /* The address under the name, as the accounts table prints it: two people on one site
             can share a name, and the address is what tells them apart. */
          <div key={u.id} style={{ minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

/** The one form, for a new preset and an existing one. */
function PresetEditor({ t, preset, followers, onSave, onCancel }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  preset: AccessPreset | null;
  followers: string[];
  onSave: (patch: Partial<Omit<AccessPreset, "id" | "teamId">>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(preset?.label ?? "");
  const [actions, setActions] = useState<AppAction[]>(preset?.actions ?? []);
  const toggleAction = (a: AppAction) =>
    setActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  /* At least one action, for the reason the invite form gives: a preset that grants nothing hands
     the "app open, nothing in it" state to everybody who follows it at once, and the gate then
     turns each of them away. */
  const canSave = label.trim().length > 0 && actions.length > 0;

  /*
   * A PANEL OFF THE RIGHT EDGE (owner, 2026-09-28: 새로 화면이 바뀌는데 이거를 오른쪽에서
   * 나오는 패널로 바꾸면 어때).
   *
   * It used to replace the table, which took the thing you are adding to off the screen and left
   * 취소 at the bottom of a seventeen-row list as the only way out. Every other editor in this
   * console is a right-hand panel over the list it belongs to, and this one is now the same: the
   * table stays behind, closing needs no scrolling, and there is nothing to go "back" to because
   * nothing was replaced.
   *
   * `dirty` so a stray click on the scrim does not throw away a half-typed preset — the shared
   * Drawer asks first.
   */
  const started = label.trim().length > 0 || actions.length > 0;
  return (
    <Drawer title={preset ? presetLabel(preset, "ko") : t.presetNew} onClose={onCancel} width="520px" dirty={started}
      footer={
        <>
          {!canSave && actions.length === 0 && label.trim() && (
            <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{t.presetNoScreens}</span>
          )}
          <button className="portal-btn-outline" onClick={onCancel}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.presetCancel}
          </button>
          <button className="portal-btn-primary" onClick={() => canSave && onSave({ label: label.trim(), actions })} disabled={!canSave}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {preset ? t.presetSave : t.presetCreate}
          </button>
        </>
      }>
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
      <div>
        <FormLabel as="span">{t.presetLabelField}</FormLabel>
        <TextField value={label} onChange={setLabel} placeholder={t.presetLabelPlaceholder} autoFocus />
      </div>
      <div>
        <FormLabel as="span">{t.presetGrantsField}</FormLabel>
        {/* White ground for a ticked row, not the default --gray-50: this editor is itself a
            --gray-50 card, and a ticked row on it would be the same colour as the card it sits in
            — the tick would be the only thing saying the row is on. */}
        <AppGrantList actions={actions} locked={false} onToggle={toggleAction} />
      </div>
      {/* Named again here, with the verb attached. The row above says who follows this; this says
          what pressing Save does to them. */}
      {followers.length > 0 && (
        <p style={{ fontSize: "12px", color: "var(--warning-500)", fontWeight: 700, lineHeight: 1.5 }}>
          {t.presetEditReach(followers.length)}
        </p>
      )}
    </div>
    </Drawer>
  );
}
