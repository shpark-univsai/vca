"use client";

import { useMemo, useState } from "react";
import { KeySquare } from "lucide-react";
import {
  accountsFollowingPreset, presetsForTeam, presetLabel, useVcaStore,
  APP_ACTIONS, type AccessPreset, type AppAction,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, AppGrantList,
  TextField, useGrantNames,
} from "./PortalShared";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {presets.length === 0 && !creating && (
        <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{t.presetEmpty}</p>
      )}

      {presets.map(pr => {
        const names = followersOf.get(pr.id) ?? [];
        if (editing === pr.id) {
          return (
            <PresetEditor key={pr.id} t={t} preset={pr} followers={names}
              onCancel={closeAll}
              onSave={patch => {
                updateAccessPreset(pr.id, patch);
                showToast({ variant: "success", title: t.presetSavedToast, desc: patch.label ?? pr.label });
                closeAll();
              }} />
          );
        }
        return (
          <div key={pr.id} style={{ padding: "12px", border: BORDER, borderRadius: "10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{presetLabel(pr, lang)}</span>
              {canEdit && retiring !== pr.id && (
                <>
                  <button className="portal-btn-quiet" onClick={() => { closeAll(); setEditing(pr.id); }}
                    style={{ flexShrink: 0, height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.presetEdit}
                  </button>
                  <button className="portal-btn-quiet" onClick={() => { closeAll(); setRetiring(pr.id); }}
                    style={{ flexShrink: 0, height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.presetRetire}
                  </button>
                </>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "3px" }}>{pr.description}</p>
            <PresetGrantSummary preset={pr} />
            {/* The count sits on the row, not only inside the editor. Somebody deciding whether to
                open this at all is already deciding how many people to touch. */}
            <p style={{ fontSize: "11px", color: names.length === 0 ? "var(--gray-400)" : "var(--gray-500)", marginTop: "6px" }}>
              {names.length === 0 ? t.presetFollowersNone : `${t.presetFollowers(names.length)} — ${names.join(", ")}`}
            </p>
            {retiring === pr.id && (
              <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", backgroundColor: "var(--gray-50)" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.presetRetireAsk}</p>
                {/* The consequence in this installation's numbers, not in general. */}
                <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.55, marginTop: "4px" }}>{t.presetRetireBody(names.length)}</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                  <button className="portal-btn-outline" onClick={closeAll}
                    style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.presetCancel}
                  </button>
                  <button onClick={() => {
                      archiveAccessPreset(pr.id);
                      showToast({ variant: "warning", title: t.presetRetiredToast, desc: pr.label });
                      closeAll();
                    }}
                    style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-500)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {t.presetRetireConfirm}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

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
        <AppGrantList actions={actions} locked={false} onToggle={toggleAction} />
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

/** The actions a preset hands out, in one line, for the collapsed row. */
function PresetGrantSummary({ preset }: { preset: AccessPreset }) {
  const names = useGrantNames();
  // In APP_ACTIONS order, so two presets holding the same set read identically.
  const parts = APP_ACTIONS.filter(a => preset.actions.includes(a)).map(a => names.action[a]);
  return (
    <p style={{ fontSize: "11px", color: "var(--gray-600)", lineHeight: 1.5, marginTop: "5px" }}>
      {parts.join(" · ")}
    </p>
  );
}
