"use client";

import { useMemo, useState } from "react";
import { KeySquare } from "lucide-react";
import {
  accountsFollowingPreset, presetsForTeam, presetLabel, useVcaStore,
  type AccessPreset, type AppAction,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, AppGrantList,
  TextField, GRANT_TREE,
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
    presetIntro: "Named sets of app grants, so the same job can be given the same screens twice. Editing one reaches every account following it — accounts set individually are not touched.",
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
    presetRetire: "Retire",
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
    presetIntro: "앱 권한을 이름으로 묶어 둔 것입니다. 같은 직무에 같은 화면을 두 번 줄 수 있게 합니다. 하나를 고치면 그것을 따르는 계정 전부에 닿고, 따로 지정한 계정은 건드리지 않습니다.",
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
    presetRetire: "폐기",
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
  return (
    <div>
      {/* NO TITLE. The lit pill on the second tab row reads 앱 권한 프리셋 and this line read it
          again 31px below — the same duplication measured on the camera-groups tab. The intro
          stays for now: its last clause (따로 지정한 계정은 건드리지 않습니다) is the one fact
          nothing else on this screen carries, and it needs a home before the line can go. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
        <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: "1px" }}><KeySquare size={16} strokeWidth={2.2} /></span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{t.presetIntro}</p>
        </div>
      </div>
      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "16px" }}>
        <AccessPresetList t={t} teamId={teamId} canEdit={canEdit} />
      </div>
    </div>
  );
}

/**
 * The team's app-access presets: make one, edit one, retire one.
 *
 * WHY THE FOLLOWER COUNT IS NOT DECORATION. A preset here is living inheritance — editing it
 * changes everybody following it, which is the combination AWS avoids (managed policies cannot be
 * edited) and Genetec avoids (templates are copied, not followed). The store's own comment on
 * updateAccessPreset says doing it anyway is defensible only while the person editing can see who
 * they are about to change, and that if the preview ever comes off the screen the action is no
 * longer safe to offer. So it is rendered before the editor opens and again inside it, and it
 * names the accounts rather than only counting them — "12 accounts" is a number, "Marcus, Wei and
 * ten others" is a room.
 */
function AccessPresetList({ t, teamId, canEdit }: {
  t: (typeof T)["en"] | (typeof T)["ko"];
  teamId: string;
  canEdit: boolean;
}) {
  /* The three we ship are printed as product strings, a customer's own preset as they typed it.
     See AccessPreset.builtinKey — the English console was showing 운영자 / 조사자 / 감독자. */
  const [lang] = usePortalLanguage();
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

  /** Which row is open, and for what. One at a time: two open editors of a living preset is two
   *  people's worth of consequence on one screen with no way to tell them apart. */
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<string | null>(null);

  const closeAll = () => { setEditing(null); setCreating(false); setRetiring(null); };
  const editingPreset = presets.find(pr => pr.id === editing) ?? null;
  const retiringPreset = presets.find(pr => pr.id === retiring) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {presets.length === 0 && !creating && (
        <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.presetEmpty}</p>
      )}

      {/* The editor replaces the table while it is open: one preset being changed is the whole
          screen's subject, and a matrix behind a form invites comparing against a row that is
          already stale. */}
      {editingPreset ? (
        <PresetEditor key={editingPreset.id} t={t} preset={editingPreset} followers={followersOf.get(editingPreset.id) ?? []}
          onCancel={closeAll}
          onSave={patch => {
            updateAccessPreset(editingPreset.id, patch);
            showToast({ variant: "success", title: t.presetSavedToast, desc: patch.label ?? editingPreset.label });
            closeAll();
          }} />
      ) : presets.length > 0 && (
        <>
          <PresetMatrix
            presets={presets}
            lang={lang}
            header={pr => {
              const names = followersOf.get(pr.id) ?? [];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <span title={presetLabel(pr, lang)} style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {presetLabel(pr, lang)}
                  </span>
                  {/* The count, not the names: a column is 104px at its narrowest and a list of
                      names would set the width of the whole table. The names are in the editor. */}
                  <span style={{ fontSize: "11px", color: names.length === 0 ? "var(--gray-400)" : "var(--gray-500)" }}>
                    {names.length === 0 ? t.presetFollowersNone : t.presetFollowers(names.length)}
                  </span>
                  {canEdit && (
                    <span style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                      <button className="portal-btn-quiet" onClick={() => { closeAll(); setEditing(pr.id); }}
                        style={{ height: "24px", padding: "0 8px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t.presetEdit}
                      </button>
                      <button className="portal-btn-quiet" onClick={() => { closeAll(); setRetiring(pr.id); }}
                        style={{ height: "24px", padding: "0 8px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t.presetRetire}
                      </button>
                    </span>
                  )}
                </div>
              );
            }}
          />
          {/* Under the table rather than inside a cell: retiring one is a decision about the
              people following it, and the sentence that says how many needs a line of its own. */}
          {retiringPreset && (
            <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{presetLabel(retiringPreset, lang)} — {t.presetRetireAsk}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.55, marginTop: "4px" }}>{t.presetRetireBody((followersOf.get(retiringPreset.id) ?? []).length)}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button className="portal-btn-outline" onClick={closeAll}
                  style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.presetCancel}
                </button>
                <button onClick={() => {
                    archiveAccessPreset(retiringPreset.id);
                    showToast({ variant: "warning", title: t.presetRetiredToast, desc: retiringPreset.label });
                    closeAll();
                  }}
                  style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-500)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.presetRetireConfirm}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!canEdit ? (
        // Said, not hidden — the same rule the purpose list follows.
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.presetOwnerOnly}</p>
      ) : creating ? (
        <PresetEditor t={t} preset={null} followers={[]}
          onCancel={closeAll}
          onSave={patch => {
            addAccessPreset({
              teamId,
              label: patch.label ?? "",
              description: patch.description ?? "",
              actions: patch.actions ?? [],
            });
            showToast({ variant: "success", title: t.presetCreatedToast, desc: patch.label });
            closeAll();
          }} />
      ) : (
        <button className="portal-btn-outline" onClick={() => { closeAll(); setCreating(true); }}
          style={{ height: CONTROL_HEIGHT, borderRadius: "10px", border: "1px dashed var(--gray-300)", backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + {t.presetNew}
        </button>
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
 * Same GRANT_TREE the permission panel draws, so the order, the grouping and the wording cannot
 * drift between the screen that hands a preset out and the screen that defines it.
 */
function PresetMatrix({ presets, lang, header }: {
  presets: AccessPreset[];
  lang: "en" | "ko";
  /** What sits over each column — the name, its actions, its follower line. */
  header: (preset: AccessPreset) => React.ReactNode;
}) {
  const g = APP_GRANT_LABELS[lang];
  const has = (pr: AccessPreset, a: AppAction) => pr.actions.includes(a);
  const cell = (text: string, on: boolean) => (
    <span style={{
      fontSize: "11.5px", fontWeight: on ? 700 : 500,
      color: on ? "var(--gray-900)" : "var(--gray-300)",
      whiteSpace: "nowrap",
    }}>{text}</span>
  );
  const COLS = `minmax(180px, 1.6fr) repeat(${presets.length}, minmax(104px, 1fr))`;
  const line: React.CSSProperties = {
    display: "grid", gridTemplateColumns: COLS, columnGap: "12px",
    /* 12px of its own inside the card's 16px (owner, 2026-09-28: 글자가 너무 끝에 붙었어).
       Dropping the inner border took the padding with it, and the labels ended up sitting on the
       card's own edge — the column had no air on the side the eye starts from. */
    alignItems: "center", padding: "8px 12px", borderTop: BORDER,
  };
  return (
    /* Scrolls sideways rather than squeezing: a customer can make more presets than fit, and a
       column narrower than its own name is worse than a scrollbar. */
    /* NO BORDER OF ITS OWN (owner, 2026-09-28: 안에 테두리가 크게 있는데 이게 라인이 두 개 있는
       것 같아 보여서 지저분해 보여). The tab already draws a bordered, rounded card around this —
       a second rounded box 16px inside the first is two edges saying one thing. The rows' own
       hairlines are what separates them, which is all a table needs. */
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: `${180 + presets.length * 104 + 40}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, columnGap: "12px", alignItems: "end", padding: "2px 12px 12px" }}>
          <span />
          {presets.map(pr => <div key={pr.id} style={{ minWidth: 0 }}>{header(pr)}</div>)}
        </div>
        {GRANT_TREE.map((group, gi) => (
          <div key={gi}>
            {/* The caption band runs to the card's inner edge — it is the head of a section, not
                a row — while its text keeps the rows' 12px so the two line up. */}
            {group.caption && (
              <div style={{ ...line, margin: "0 -4px", padding: "8px 16px", backgroundColor: "var(--gray-50)" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-400)" }}>
                  {g.groupCaption[group.caption]}
                </span>
              </div>
            )}
            {group.rows.map(row => (
              <div key={row.action}>
                <div style={line}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", minWidth: 0, paddingLeft: group.caption ? "10px" : 0 }}>
                    {g.rowName[row.action] ?? g.actionName[row.action]}
                  </span>
                  {presets.map(pr => (
                    <span key={pr.id}>
                      {row.search
                        ? cell(!has(pr, row.action) ? "\u2014" : has(pr, row.search) ? g.stage.viewSearch : g.stage.view, has(pr, row.action))
                        : cell(has(pr, row.action) ? (row.searchIsAll ? g.stage.searchOnly : "\u2713") : "\u2014", has(pr, row.action))}
                    </span>
                  ))}
                </div>
                {row.child && (
                  <div style={line}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", paddingLeft: "22px", minWidth: 0 }}>
                      {g.rowName[row.child] ?? g.actionName[row.child]}
                    </span>
                    {presets.map(pr => (
                      <span key={pr.id}>{cell(has(pr, row.child!) ? "\u2713" : "\u2014", has(pr, row.child!))}</span>
                    ))}
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
