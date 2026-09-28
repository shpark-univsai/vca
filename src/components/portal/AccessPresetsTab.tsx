"use client";

import { useMemo, useState } from "react";
import {
  accountsFollowingPreset, presetsForTeam, presetLabel, useVcaStore,
  withAppActionDeps, type AccessPreset, type AppAction,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, AppGrantList,
  TextField, GRANT_TREE, PICKED_LINE, PICKED_FILL, type GrantRowDef, type GrantGroupDef,
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
    presetDescField: "What it is for",
    presetDescPlaceholder: "One line. Somebody chooses between these by reading it.",
    presetGrantsField: "What it grants",
    presetNoScreens: "Tick at least one screen \u2014 an account following a preset with none cannot open the app",
    presetFollowers: (n: number) => `${n} account${n === 1 ? "" : "s"} follow this`,
    presetFollowersNone: "No accounts follow this yet",
    presetEditReach: (n: number) => `Saving changes what these ${n} can open, at once.`,
    presetEdit: "Edit",
    presetNoActions: "A preset with nothing ticked cannot be given to anyone.",
    presetUndoRemove: "Undo",
    presetCycleHint: "Click to change",
    presetGroupAll: "All",
    presetGroupSome: "Some",
    presetRetire: "Delete",
    presetRetireAsk: "Retire this preset?",
    presetRetireBody: (n: number) => n === 0
      ? "It stops being offered on the invite form. Nothing else changes."
      : `It stops being offered, and the ${n} account${n === 1 ? "" : "s"} following it become individual \u2014 holding exactly what they hold now. Nobody gains or loses access.`,
    presetRetireConfirm: "Retire",
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
    presetDescField: "무엇을 위한 것인가",
    presetDescPlaceholder: "한 줄. 사람은 이걸 읽고 고릅니다.",
    presetGrantsField: "무엇을 켜는가",
    presetNoScreens: "화면을 하나 이상 골라주세요 — 화면이 없는 프리셋을 따르는 계정은 앱을 열 수 없습니다",
    presetFollowers: (n: number) => `이 프리셋을 따르는 계정 ${n}개`,
    presetFollowersNone: "이 프리셋을 따르는 계정이 아직 없습니다",
    presetEditReach: (n: number) => `저장하면 이 ${n}명이 열 수 있는 화면이 한 번에 바뀝니다.`,
    presetEdit: "편집",
    presetNoActions: "아무것도 고르지 않은 프리셋은 아무에게도 줄 수 없습니다.",
    presetUndoRemove: "되돌리기",
    presetCycleHint: "눌러서 바꾸기",
    presetGroupAll: "전체",
    presetGroupSome: "일부",
    presetRetire: "삭제",
    presetRetireAsk: "이 프리셋을 폐기할까요?",
    presetRetireBody: (n: number) => n === 0
      ? "초대 폼에서 더 이상 제시되지 않습니다. 그 밖에 바뀌는 것은 없습니다."
      : `초대 폼에서 더 이상 제시되지 않고, 이것을 따르던 계정 ${n}개는 지금 가진 것을 그대로 들고 개별 지정으로 바뀝니다. 권한을 얻거나 잃는 사람은 없습니다.`,
    presetRetireConfirm: "폐기",
    presetSave: "저장",
    presetCancel: "취소",
    presetCreate: "만들기",
    presetOwnerOnly: "프리셋은 최고관리자만 바꿀 수 있습니다.",
    presetSavedToast: "프리셋을 저장했습니다",
    presetCreatedToast: "프리셋을 만들었습니다",
    presetRetiredToast: "프리셋을 폐기했습니다",
  },
};

export default function AccessPresetsTab({ teamId, canEdit }: {
  teamId: string;
  /** Owners only — the store's guard is on the actions, this is the screen saying so first. */
  canEdit: boolean;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  /* NO TITLE. The lit tab above already reads 앱 권한 프리셋. Everything else — the buttons, the
     table, the one sentence under it — belongs to the list, which is what holds the draft. */
  return <AccessPresetList t={t} teamId={teamId} canEdit={canEdit} lang={lang} />;
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
function AccessPresetList({ t, teamId, canEdit, lang }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  teamId: string;
  canEdit: boolean;
  lang: "en" | "ko";
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
  const followersOf = useMemo(() => {
    const map = new Map<string, string[]>();
    presets.forEach(pr => map.set(pr.id, accountsFollowingPreset(portalUsers, pr.id).map(u => u.name)));
    return map;
  }, [presets, portalUsers]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  /** The whole table's unsaved state: a name and a grant set per preset, plus the ones struck out. */
  const [draft, setDraft] = useState<Record<string, { label: string; actions: AppAction[] }>>({});
  const [removed, setRemoved] = useState<string[]>([]);

  const startEditing = () => {
    const d: Record<string, { label: string; actions: AppAction[] }> = {};
    presets.forEach(pr => { d[pr.id] = { label: presetLabel(pr, lang), actions: [...pr.actions] }; });
    setDraft(d);
    setRemoved([]);
    setEditing(true);
  };
  const stopEditing = () => { setEditing(false); setDraft({}); setRemoved([]); };

  const setName = (id: string, label: string) =>
    setDraft(d => ({ ...d, [id]: { ...d[id], label } }));
  const setActions = (id: string, actions: AppAction[]) =>
    setDraft(d => ({ ...d, [id]: { ...d[id], actions: withAppActionDeps(actions) } }));

  /** Everything that would be written, so the save button can be dead when nothing changed. */
  const dirty = editing && (removed.length > 0 || presets.some(pr => {
    const d = draft[pr.id];
    if (!d) return false;
    return d.label !== presetLabel(pr, lang)
      || d.actions.length !== pr.actions.length
      || d.actions.some(a => !pr.actions.includes(a));
  }));
  /** A preset with nothing ticked cannot be followed — the invite form refuses to send it. */
  const emptyDraft = editing && presets.some(pr => !removed.includes(pr.id) && (draft[pr.id]?.actions.length ?? 0) === 0);

  const save = () => {
    presets.forEach(pr => {
      if (removed.includes(pr.id)) { archiveAccessPreset(pr.id); return; }
      const d = draft[pr.id];
      if (!d) return;
      const sameLabel = d.label === presetLabel(pr, lang);
      const sameActions = d.actions.length === pr.actions.length && d.actions.every(a => pr.actions.includes(a));
      if (sameLabel && sameActions) return;
      updateAccessPreset(pr.id, { ...(sameLabel ? {} : { label: d.label }), ...(sameActions ? {} : { actions: d.actions }) });
    });
    showToast({ variant: removed.length ? "warning" : "success", title: t.presetSavedToast });
    stopEditing();
  };

  /** How many accounts the pending edit would reach — the warning the store insists on. */
  const reach = editing
    ? presets.filter(pr => draft[pr.id] || removed.includes(pr.id)).reduce((n, pr) => n + (followersOf.get(pr.id) ?? []).length, 0)
    : 0;

  return (
    <div>
      {/* THE ACTIONS, AT THE TOP RIGHT. They were a dashed full-width row under the list and two
          buttons over every column; both put a verb where the eye was reading values. */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginBottom: "14px", minHeight: CONTROL_HEIGHT }}>
        {!canEdit ? (
          // Said, not hidden — the same rule the purpose list follows.
          <p style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.presetOwnerOnly}</p>
        ) : editing ? (
          <>
            {removed.length > 0 && (
              <p style={{ flex: 1, fontSize: "11px", color: "var(--danger-500)", fontWeight: 700, lineHeight: 1.45 }}>
                {t.presetRetireBody(removed.reduce((n, id) => n + (followersOf.get(id) ?? []).length, 0))}
              </p>
            )}
            <button className="portal-btn-outline" onClick={stopEditing}
              style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.presetCancel}
            </button>
            <button className="portal-btn-primary" onClick={save} disabled={!dirty || emptyDraft}
              title={emptyDraft ? t.presetNoActions : undefined}
              style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: dirty && !emptyDraft ? "var(--primary-400)" : "var(--gray-200)", color: dirty && !emptyDraft ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: dirty && !emptyDraft ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {t.presetSave}
            </button>
          </>
        ) : !creating && (
          <>
            {presets.length > 0 && (
              <button className="portal-btn-outline" onClick={startEditing}
                style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.presetEdit}
              </button>
            )}
            <button className="portal-btn-outline" onClick={() => setCreating(true)}
              style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + {t.presetNew}
            </button>
          </>
        )}
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "16px" }}>
        {creating ? (
          <PresetEditor t={t} preset={null} followers={[]}
            onCancel={() => setCreating(false)}
            onSave={patch => {
              addAccessPreset({
                teamId,
                label: patch.label ?? "",
                description: patch.description ?? "",
                actions: patch.actions ?? [],
              });
              showToast({ variant: "success", title: t.presetCreatedToast, desc: patch.label });
              setCreating(false);
            }} />
        ) : presets.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.presetEmpty}</p>
        ) : (
          <PresetMatrix
            presets={presets}
            lang={lang}
            t={t}
            editing={editing}
            draft={draft}
            removed={removed}
            onSetActions={setActions}
            header={pr => {
              const names = followersOf.get(pr.id) ?? [];
              const gone = removed.includes(pr.id);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, opacity: gone ? 0.4 : 1 }}>
                  {editing && !gone ? (
                    <input
                      value={draft[pr.id]?.label ?? ""}
                      onChange={e => setName(pr.id, e.target.value)}
                      style={{ width: "100%", height: "28px", padding: "0 8px", borderRadius: "7px", border: BORDER, fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", fontFamily: "inherit", backgroundColor: "white" }}
                    />
                  ) : (
                    <span title={presetLabel(pr, lang)} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: gone ? "line-through" : undefined }}>
                      {draft[pr.id]?.label || presetLabel(pr, lang)}
                    </span>
                  )}
                  {/* The count, not the names: a column is 104px at its narrowest and a list of
                      names would set the width of the whole table. It stays visible while editing,
                      which is the condition updateAccessPreset's own note puts on this screen. */}
                  <span style={{ fontSize: "11px", color: names.length === 0 ? "var(--gray-400)" : "var(--gray-500)" }}>
                    {names.length === 0 ? t.presetFollowersNone : t.presetFollowers(names.length)}
                  </span>
                  {editing && (
                    <button className="portal-btn-quiet" onClick={() => setRemoved(r => gone ? r.filter(x => x !== pr.id) : [...r, pr.id])}
                      /* alignSelf, because the header is a flex COLUMN and a child with no
                         opinion stretches to the column's width — a 260px 삭제 button over a
                         table (owner, 2026-09-28: 편집 상태일 때 삭제 버튼이 가로로 너무 길어). */
                      style={{ alignSelf: "flex-start", marginTop: "2px", height: "24px", padding: "0 8px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: gone ? "var(--gray-600)" : "var(--danger-500)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {gone ? t.presetUndoRemove : t.presetRetire}
                    </button>
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
function PresetMatrix({ presets, lang, header, editing, draft, removed, onSetActions, t }: {
  presets: AccessPreset[];
  lang: "en" | "ko";
  t: (typeof T)["en"] | (typeof T)["ko"];
  /** What sits over each column — the name, its follower line, its remove button. */
  header: (preset: AccessPreset) => React.ReactNode;
  editing: boolean;
  draft: Record<string, { label: string; actions: AppAction[] }>;
  removed: string[];
  onSetActions: (id: string, actions: AppAction[]) => void;
}) {
  const g = APP_GRANT_LABELS[lang];
  const actionsOf = (pr: AccessPreset) => (editing ? draft[pr.id]?.actions ?? pr.actions : pr.actions);
  const COLS = `minmax(180px, 1.6fr) repeat(${presets.length}, minmax(104px, 1fr))`;
  const line: React.CSSProperties = {
    display: "grid", gridTemplateColumns: COLS, columnGap: "12px",
    alignItems: "center", padding: "8px 12px", borderTop: BORDER,
  };

  /** The states one row can hold, in the order clicking walks them. */
  const statesFor = (row: GrantRowDef): { text: string; on: boolean; has: AppAction[] }[] => {
    const none = { text: "—", on: false, has: [] as AppAction[] };
    if (row.search) return [none, { text: g.stage.view, on: true, has: [row.action] }, { text: g.stage.viewSearch, on: true, has: [row.action, row.search] }];
    if (row.searchIsAll) return [none, { text: g.stage.searchOnly, on: true, has: [row.action] }];
    return [none, { text: "✓", on: true, has: [row.action] }];
  };

  /** Every grant the tab holds, in one list — what the band's own cell switches. */
  const actionsIn = (group: GrantGroupDef): AppAction[] =>
    group.rows.flatMap(r => [r.action, ...(r.search ? [r.search] : []), ...(r.child ? [r.child] : [])]);

  const groupCell = (pr: AccessPreset, group: GrantGroupDef) => {
    const held = actionsOf(pr);
    const gone = removed.includes(pr.id);
    const owned = actionsIn(group);
    const on = owned.filter(a => held.includes(a)).length;
    const state = on === 0 ? "none" : on === owned.length ? "all" : "some";
    const body = (
      <span style={{
        fontSize: "11.5px", fontWeight: state === "none" ? 500 : 700,
        color: state === "none" ? "var(--gray-300)" : "var(--gray-900)", whiteSpace: "nowrap",
      }}>{state === "none" ? "\u2014" : state === "all" ? t.presetGroupAll : t.presetGroupSome}</span>
    );
    if (!editing || gone) return body;
    const apply = () => onSetActions(pr.id, state === "all" ? held.filter(a => !owned.includes(a)) : [...held, ...owned]);
    return (
      <button type="button" onClick={apply} title={t.presetCycleHint}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "24px", padding: "0 8px", borderRadius: "7px",
          border: state === "none" ? "1px dashed var(--gray-300)" : PICKED_LINE,
          backgroundColor: state === "none" ? "white" : PICKED_FILL,
          cursor: "pointer", fontFamily: "inherit",
        }}>
        {body}
      </button>
    );
  };

  const cellFor = (pr: AccessPreset, row: GrantRowDef, child?: AppAction) => {
    const held = actionsOf(pr);
    const gone = removed.includes(pr.id);
    const states = child
      ? [{ text: "—", on: false, has: [] as AppAction[] }, { text: "✓", on: true, has: [child] }]
      : statesFor(row);
    const owned = child ? [child] : [row.action, ...(row.search ? [row.search] : [])];
    const idx = Math.max(0, states.map((st, i) => ({ st, i })).filter(({ st }) => st.has.every(a => held.includes(a))).pop()?.i ?? 0);
    const cur = states[idx];
    const body = (
      <span style={{
        fontSize: "11.5px", fontWeight: cur.on ? 700 : 500,
        color: cur.on ? "var(--gray-900)" : "var(--gray-300)",
        whiteSpace: "nowrap",
      }}>{cur.text}</span>
    );
    if (!editing || gone) return body;
    /* Ticking a child ticks the screen it sits on — the store enforces it either way
       (withAppActionDeps), and a cell that appears to switch on and then does not is worse than
       one that quietly brings its parent with it. */
    const next = states[(idx + 1) % states.length];
    const apply = () => {
      const kept = held.filter(a => !owned.includes(a));
      const added = child && next.on ? [...next.has, row.action] : next.has;
      onSetActions(pr.id, [...kept, ...added]);
    };
    /* A CHIP WHILE EDITING, NOT BARE TEXT (owner, 2026-09-28: 아래 체크랑 보기/검색 이런 것도
       변경할 수 있게 해줘). It was already clickable and cycled correctly — what it did not do was
       LOOK clickable, so the reader had no reason to try. In edit mode the value wears a box: a
       picked one takes the console's picked colours, an empty one a dashed outline, which is the
       same pair the camera picker and the invite form use for chosen / not chosen. */
    return (
      <button type="button" onClick={apply} title={t.presetCycleHint}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "24px", padding: "0 8px", borderRadius: "7px",
          border: cur.on ? PICKED_LINE : "1px dashed var(--gray-300)",
          backgroundColor: cur.on ? PICKED_FILL : "white",
          cursor: "pointer", fontFamily: "inherit",
        }}>
        {body}
      </button>
    );
  };

  return (
    /* Scrolls sideways rather than squeezing: a customer can make more presets than fit, and a
       column narrower than its own name is worse than a scrollbar. */
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: `${180 + presets.length * 104 + 40}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, columnGap: "12px", alignItems: "end", padding: "2px 12px 12px" }}>
          <span />
          {presets.map(pr => <div key={pr.id} style={{ minWidth: 0 }}>{header(pr)}</div>)}
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
            <div style={{ ...line, margin: "0 -4px", padding: "8px 16px", borderTop: gi === 0 ? "none" : BORDER, backgroundColor: "var(--gray-50)" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>
                {g.groupName[group.caption]}
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
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", paddingLeft: "10px" }}>
                      {g.subName[row.subhead]}
                    </span>
                  </div>
                )}
                <div style={line}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", minWidth: 0, paddingLeft: row.indent ? "22px" : "10px" }}>
                    {g.rowName[row.action] ?? g.actionName[row.action]}
                  </span>
                  {presets.map(pr => <span key={pr.id} style={{ opacity: removed.includes(pr.id) ? 0.4 : 1 }}>{cellFor(pr, row)}</span>)}
                </div>
                {row.child && (
                  <div style={line}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", paddingLeft: "22px", minWidth: 0 }}>
                      {g.rowName[row.child] ?? g.actionName[row.child]}
                    </span>
                    {presets.map(pr => <span key={pr.id} style={{ opacity: removed.includes(pr.id) ? 0.4 : 1 }}>{cellFor(pr, row, row.child)}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
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
  const [description, setDescription] = useState(preset?.description ?? "");
  const [actions, setActions] = useState<AppAction[]>(preset?.actions ?? []);
  const toggleAction = (a: AppAction) =>
    setActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  /* At least one action, for the reason the invite form gives: a preset that grants nothing hands
     the "app open, nothing in it" state to everybody who follows it at once, and the gate then
     turns each of them away. */
  const canSave = label.trim().length > 0 && description.trim().length > 0 && actions.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", border: BORDER, borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
      <div>
        <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.presetLabelField}</label>
        <TextField value={label} onChange={setLabel} placeholder={t.presetLabelPlaceholder} autoFocus />
      </div>
      <div>
        <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.presetDescField}</label>
        <TextField value={description} onChange={setDescription} placeholder={t.presetDescPlaceholder} />
      </div>
      <div>
        <label style={{ fontSize: "12px", color: "var(--gray-500)", display: "block", marginBottom: "6px" }}>{t.presetGrantsField}</label>
        {/* White ground for a ticked row, not the default --gray-50: this editor is itself a
            --gray-50 card, and a ticked row on it would be the same colour as the card it sits in
            — the tick would be the only thing saying the row is on. */}
        <AppGrantList actions={actions} locked={false} onToggle={toggleAction} rowFill="white" />
      </div>
      {/* Named again here, with the verb attached. The row above says who follows this; this says
          what pressing Save does to them. */}
      {followers.length > 0 && (
        <p style={{ fontSize: "12px", color: "var(--warning-500)", fontWeight: 700, lineHeight: 1.5 }}>
          {t.presetEditReach(followers.length)}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
        {!canSave && actions.length === 0 && label.trim() && description.trim() && (
          <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{t.presetNoScreens}</span>
        )}
        <button className="portal-btn-outline" onClick={onCancel}
          style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {t.presetCancel}
        </button>
        <button className="portal-btn-primary" onClick={() => canSave && onSave({ label: label.trim(), description: description.trim(), actions })} disabled={!canSave}
          style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {preset ? t.presetSave : t.presetCreate}
        </button>
      </div>
    </div>
  );
}
