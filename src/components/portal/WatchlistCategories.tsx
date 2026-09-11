"use client";

import { useState } from "react";
import { useVcaStore, WATCHLIST_CATEGORY_COLORS, type WatchlistCategory, type WatchlistCategoryColor } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER, CONTROL_HEIGHT, ConfirmModal, TextField } from "./PortalShared";

/**
 * Watchlist categories are a TEAM's policy, not a project's.
 *
 * They lived inside ProjectVipTab, which meant the one screen that defines what a listing means
 * could only be opened from inside a project — so a team waiting for its first site could set up
 * its search purposes and its mail, and not this. That is backwards: deciding what your
 * institution's categories ARE is the preparation you can do before any camera arrives.
 *
 * The VIP registry still opens it from the register form's category picker, where it belongs as
 * a shortcut; Settings now owns it as the place it lives.
 */
const T: Record<"en" | "ko", CategoryDict> = {
  en: {
    basisLabel: "Basis for listing",
    cancel: "Cancel",
    catArchive: "Retire",
    catArchiveNote: "Retired categories cannot be chosen again. People already listed under them keep the label.",
    catArchived: "Retired",
    catColor: "Colour",
    catCreate: "Create",
    catEdit: "Edit",
    catEmpty: "No categories yet. People can still be registered; they are listed as unclassified.",
    catLabelField: "Name",
    catLabelPlaceholder: "What your organisation calls it",
    catModalIntro: "The words are yours, not ours.",
    catModalTitle: "Watchlist categories",
    catNew: "New category",
    catOwnerOnly: "Only the owner can change this list.",
    catRequiresBasis: "Require a basis when listing under this",
    catSave: "Save",
    catValidDays: "Default duration (days)",
    catValidDaysNone: "No default end date",
    close: "Close",
    catRetireTitle: (label: string) => `Retire "${label}"?`,
    catRetireBody: "It stops being offered when somebody is registered. People already listed under it keep the label, and nothing on this screen brings it back.",
    catRetireCount: (n: number) => (n === 1 ? "1 person is listed under it." : `${n} people are listed under it.`),
  },
  ko: {
    basisLabel: "등록 근거",
    cancel: "취소",
    catArchive: "사용 중지",
    catArchiveNote: "중지한 분류는 다시 고를 수 없습니다. 이미 등록된 사람의 표시는 그대로 남습니다.",
    catArchived: "중지됨",
    catColor: "색",
    catCreate: "만들기",
    catEdit: "수정",
    catEmpty: "아직 분류가 없습니다. 그래도 등록은 됩니다 — 미분류로 올라갑니다.",
    catLabelField: "이름",
    catLabelPlaceholder: "기관에서 부르는 이름",
    catModalIntro: "쓰는 말은 저희 것이 아니라 기관의 것입니다.",
    catModalTitle: "관심인물 분류",
    catNew: "분류 만들기",
    catOwnerOnly: "이 목록은 최고관리자만 바꿀 수 있습니다.",
    catRequiresBasis: "이 분류로 등록할 때 근거를 필수로",
    catSave: "저장",
    catValidDays: "기본 유효기간 (일)",
    catValidDaysNone: "기본 만료일 없음",
    close: "닫기",
    catRetireTitle: (label: string) => `"${label}"을(를) 중지할까요?`,
    catRetireBody: "앞으로 등록할 때 이 분류가 목록에 뜨지 않습니다. 이미 등록된 사람의 표시는 그대로 남고, 이 화면에서 되돌릴 방법은 없습니다.",
    catRetireCount: (n: number) => `이 분류로 등록된 사람 ${n}명.`,
  },
};

interface CategoryDict {
  basisLabel: string; cancel: string; catArchive: string; catArchiveNote: string;
  catArchived: string; catColor: string; catCreate: string; catEdit: string; catEmpty: string;
  catLabelField: string; catLabelPlaceholder: string; catModalIntro: string; catModalTitle: string;
  catNew: string; catOwnerOnly: string; catRequiresBasis: string; catSave: string;
  catValidDays: string; catValidDaysNone: string; close: string;
  catRetireTitle: (label: string) => string;
  catRetireBody: string;
  catRetireCount: (n: number) => string;
}

/**
 * Where an institution defines its own watchlist categories.
 *
 * Opens empty, and says so. There is no shipped default and no example row: a seeded "Wanted"
 * would read as the standard and the first thing a customer who is not a police force does is
 * delete it — then wonder what else in the product was written for somebody else.
 *
 * Colours come from a fixed list of design tokens rather than a picker. A category is a label in a
 * console, not a brand: an arbitrary hex would let one sit outside the palette, or land on the same
 * green the validity stamp uses two screens over.
 */
export function WatchlistCategoryModal({ teamId, categories, canEdit, onClose }: {
  teamId: string;
  categories: WatchlistCategory[];
  /** Owner only — see canSetPolicy. Everyone else reads the list. */
  canEdit: boolean;
  onClose: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const persons = useVcaStore(s => s.persons);
  const addWatchlistCategory = useVcaStore(s => s.addWatchlistCategory);
  const updateWatchlistCategory = useVcaStore(s => s.updateWatchlistCategory);
  const archiveWatchlistCategory = useVcaStore(s => s.archiveWatchlistCategory);
  /**
   * null when the form is closed, "new" when it is creating, a category id when it is editing.
   *
   * One form for both, because they collect exactly the same four things. Editing was the
   * missing half: updateWatchlistCategory existed in the store, audit entry and all, and nothing
   * called it — so a category could be created and retired but a typo in its label was permanent
   * and the only way out was to retire the row and make another one beside it.
   */
  const [editing, setEditing] = useState<string | null>(null);
  /** Confirmed, because the comment on the button says it cannot be undone from this screen —
   *  and there is nothing anywhere that un-retires a category. */
  const [retiring, setRetiring] = useState<WatchlistCategory | null>(null);
  const [label, setLabel] = useState("");
  const [validDays, setValidDays] = useState("");
  const [requiresBasis, setRequiresBasis] = useState(true);
  const [color, setColor] = useState<WatchlistCategoryColor>("gray");
  useEscapeKey(onClose);

  const reset = () => { setEditing(null); setLabel(""); setValidDays(""); setRequiresBasis(true); setColor("gray"); };
  const startEdit = (c: WatchlistCategory) => {
    setEditing(c.id);
    setLabel(c.label);
    setValidDays(c.defaultValidDays === null ? "" : String(c.defaultValidDays));
    setRequiresBasis(c.requiresBasis);
    setColor(c.color);
  };
  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed || editing === null) return;
    // Blank means no default, which is a different thing from zero days.
    const defaultValidDays = validDays.trim() === "" ? null : Math.max(1, Number(validDays));
    if (editing === "new") {
      addWatchlistCategory({ teamId, label: trimmed, color, requiresBasis, defaultValidDays });
    } else {
      // Only the four fields the form owns. Not `archived` — retiring is its own button, and a
      // save that quietly un-retired a category would be a surprise.
      updateWatchlistCategory(editing, { label: trimmed, color, requiresBasis, defaultValidDays });
    }
    reset();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "520px", width: "100%", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.catModalTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, marginTop: "6px" }}>{t.catModalIntro}</p>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {categories.length === 0 && editing === null && (
            <p style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.7, padding: "12px 0" }}>{t.catEmpty}</p>
          )}
          {categories.map(c => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
              border: BORDER, borderRadius: "10px", opacity: c.archived ? 0.55 : 1,
            }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", flexShrink: 0, backgroundColor: categoryTint(c.color).dot }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.label}
              </span>
              <span style={{ fontSize: "11px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                {c.defaultValidDays === null ? t.catValidDaysNone : `${c.defaultValidDays}d`}
                {c.requiresBasis ? ` · ${t.basisLabel}` : ""}
              </span>
              {c.archived ? (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.catArchived}</span>
              ) : !canEdit ? null : (<>
                <button className="portal-btn-quiet" onClick={() => startEdit(c)}
                  style={{ flexShrink: 0, height: "26px", padding: "0 10px", borderRadius: "7px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.catEdit}
                </button>
                {/* Retiring keeps its box. It is the one action here that cannot be undone from
                    this screen, and it should not read as the same weight as renaming. */}
                <button className="portal-btn-outline" onClick={() => setRetiring(c)}
                  style={{ flexShrink: 0, height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.catArchive}
                </button>
              </>)}
            </div>
          ))}

          {!canEdit ? (
            /* Said, not hidden — a reader who cannot find the button should learn the list has an
               owner rather than conclude the console is broken. */
            <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.catOwnerOnly}</p>
          ) : editing !== null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", border: BORDER, borderRadius: "10px", backgroundColor: "var(--gray-50)" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.catLabelField}</label>
                <TextField value={label} onChange={setLabel} placeholder={t.catLabelPlaceholder} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.catValidDays}</label>
                <TextField value={validDays} onChange={v => setValidDays(v.replace(/[^0-9]/g, ""))} placeholder={t.catValidDaysNone} inputMode="numeric" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.catColor}</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {WATCHLIST_CATEGORY_COLORS.map(name => (
                    <button key={name} onClick={() => setColor(name)} title={name}
                      style={{
                        width: "28px", height: "28px", borderRadius: "8px", cursor: "pointer",
                        backgroundColor: categoryTint(name).bg,
                        border: color === name ? "2px solid var(--gray-900)" : "1px solid var(--gray-200)",
                      }}>
                      <span style={{ display: "block", width: "10px", height: "10px", borderRadius: "3px", margin: "0 auto", backgroundColor: categoryTint(name).dot }} />
                    </button>
                  ))}
                </div>
              </div>
              {/* Default on, because most categories need one and the cost of the wrong default is
                  asymmetric: a required basis somebody skips is a nag, a missing basis on a row
                  that turns out wrong is a question nobody can answer. */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-600)" }}>
                <input type="checkbox" checked={requiresBasis} onChange={e => setRequiresBasis(e.target.checked)} />
                {t.catRequiresBasis}
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button className="portal-btn-outline" onClick={reset}
                  style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.cancel}
                </button>
                <button className="portal-btn-primary" onClick={submit} disabled={!label.trim()}
                  style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: label.trim() ? "var(--primary-400)" : "var(--gray-200)", color: label.trim() ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: label.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {editing === "new" ? t.catCreate : t.catSave}
                </button>
              </div>
            </div>
          ) : (
            <button className="portal-btn-outline" onClick={() => setEditing("new")}
              style={{ height: CONTROL_HEIGHT, borderRadius: "10px", border: `1px dashed var(--gray-300)`, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + {t.catNew}
            </button>
          )}
          {categories.some(c => c.archived) && (
            <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6 }}>{t.catArchiveNote}</p>
          )}
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.close}
          </button>
        </div>
      </div>

      {retiring && (
        <ConfirmModal
          title={t.catRetireTitle(retiring.label)}
          body={t.catRetireBody}
          confirmLabel={t.catArchive}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => { archiveWatchlistCategory(retiring.id); setRetiring(null); }}
          onClose={() => setRetiring(null)}
        >
          {/* How many rows keep pointing at it. Retiring a category nobody uses and retiring the
              one half the registry is filed under are the same click and different decisions. */}
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginTop: "12px" }}>
            {t.catRetireCount(persons.filter(pp => pp.categoryId === retiring.id).length)}
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/**
 * A category colour name resolved to the two values a chip needs.
 *
 * Token families only — the list is fixed in the store — so a category can never introduce a
 * colour the console does not already use.
 */
export function categoryTint(color: WatchlistCategoryColor): { bg: string; fg: string; dot: string } {
  switch (color) {
    case "primary": return { bg: "var(--primary-100)", fg: "var(--primary-400)", dot: "var(--primary-400)" };
    case "info":    return { bg: "var(--info-100)",    fg: "var(--info-500)",    dot: "var(--info-500)" };
    case "teal":    return { bg: "var(--teal-100)",    fg: "var(--teal-500)",    dot: "var(--teal-500)" };
    case "magenta": return { bg: "var(--magenta-100)", fg: "var(--magenta-500)", dot: "var(--magenta-500)" };
    // The three below are no longer offered — see WATCHLIST_CATEGORY_COLORS — but categories
    // created before that still carry them, and a chip that cannot resolve its colour is worse
    // than one drawn in a colour we would not pick again.
    case "danger":  return { bg: "var(--danger-100)",  fg: "var(--danger-500)",  dot: "var(--danger-400)" };
    case "warning": return { bg: "var(--warning-100)", fg: "var(--warning-500)", dot: "var(--warning-500)" };
    case "success": return { bg: "var(--success-100)", fg: "var(--success-400)", dot: "var(--success-400)" };
    default:        return { bg: "var(--gray-100)",    fg: "var(--gray-700)",    dot: "var(--gray-400)" };
  }
}
