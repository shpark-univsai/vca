"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Pencil } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  SIGNED_IN_USER, currentPortalUser, useVcaStore,
  type SearchPurpose, type SearchPurposeSelection,
} from "@/lib/vcaStore";

/**
 * Asks why a person search is being run, once per sitting, and then keeps the answer on screen.
 *
 * Two parts because they do two jobs. The gate is a hard stop — the search screens do not render
 * behind it — because a purpose that can be skipped is a purpose nobody states. The bar is the
 * quieter half and probably the more effective one: a declaration sitting in view for the whole
 * sitting is what makes an operator think twice, more than any dialog they clicked through.
 *
 * The purposes themselves are the institution's, defined in the console. Nothing is seeded, so a
 * fresh installation that has not defined any cannot be blocked by this — see `usePurposeGate`.
 */

const T = {
  en: {
    gateTitle: "Why are you searching?",
    gateBody: "Person searches are recorded with the reason they were run. This applies to the whole sitting — you can change it at any time.",
    purpose: "Purpose",
    choose: "Choose a purpose",
    reference: "Case or document reference",
    referenceHint: "Required for this purpose",
    note: "Note",
    notePlaceholder: "Anything worth recording alongside",
    start: "Start searching",
    who: "Recorded as",
    barPrefix: "Search purpose",
    change: "Change",
    undefinedTitle: "No search purposes defined",
    undefinedBody: "An administrator defines them in the console. Until then searches run without a stated purpose.",
  },
  ko: {
    gateTitle: "무엇을 위해 검색하시나요?",
    gateBody: "인물 검색은 실행한 사유와 함께 기록됩니다. 이 사유는 이번 사용 동안 계속 적용되고, 언제든 바꿀 수 있습니다.",
    purpose: "사유",
    choose: "사유를 선택해주세요",
    reference: "사건번호 또는 공문번호",
    referenceHint: "이 사유에는 필수입니다",
    note: "메모",
    notePlaceholder: "함께 남길 내용이 있다면",
    start: "검색 시작",
    who: "기록되는 이름",
    barPrefix: "조회 목적",
    change: "변경",
    undefinedTitle: "정의된 검색 사유가 없습니다",
    undefinedBody: "관리자가 콘솔에서 정의합니다. 그때까지는 사유 없이 검색이 실행됩니다.",
  },
} as const;

/**
 * Whether the search screens should be held behind the gate right now.
 *
 * Answers false when the installation has not switched the requirement on, when the institution
 * has defined no purposes to choose from, or when one is already declared. The middle case
 * matters: a requirement with an empty list is a locked door with no key, and the honest failure
 * is to let the search happen and say the list is empty rather than to strand the operator.
 */
export function usePurposeGate(): {
  blocked: boolean;
  purposes: SearchPurpose[];
  selection: SearchPurposeSelection | null;
} {
  const required = getComplianceConfig().requireSearchPurpose;
  const all = useVcaStore(s => s.searchPurposes);
  const selection = useVcaStore(s => s.searchPurpose);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const me = currentPortalUser(portalUsers);
  const purposes = useMemo(
    () => all.filter(p => !p.archived && (!me || p.teamId === me.teamId)),
    [all, me],
  );
  return { blocked: required && purposes.length > 0 && !selection, purposes, selection };
}

const FIELD_BORDER = "1px solid var(--gray-300)";
const LABEL: React.CSSProperties = {
  fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.24px",
};

/** The blocking form. Rendered instead of the search screen, not over it. */
export function SearchPurposeGate({ purposes }: { purposes: SearchPurpose[] }) {
  const [lang] = useLanguage();
  const t = T[lang];
  const setSearchPurpose = useVcaStore(s => s.setSearchPurpose);
  const [purposeId, setPurposeId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const chosen = purposes.find(p => p.id === purposeId);
  const needsReference = !!chosen?.requiresReference;
  const canStart = !!chosen && (!needsReference || reference.trim().length > 0);

  const start = () => {
    if (!canStart) return;
    setSearchPurpose({
      purposeId,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      at: new Date().toISOString(),
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "72px 24px" }}>
      <div style={{ width: "480px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <ShieldCheck size={22} strokeWidth={2.2} color="var(--gray-700)" />
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.44px" }}>
            {t.gateTitle}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.26px", lineHeight: 1.7 }}>
            {t.gateBody}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={LABEL}>{t.purpose}</span>
            <select
              value={purposeId}
              onChange={e => setPurposeId(e.target.value)}
              style={{
                height: "42px", padding: "0 10px", border: FIELD_BORDER, borderRadius: "8px",
                fontSize: "14px", color: purposeId ? "var(--gray-900)" : "var(--gray-400)",
                background: "white", fontFamily: "inherit", outline: "none",
              }}
            >
              <option value="">{t.choose}</option>
              {purposes.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {needsReference && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={LABEL}>{t.reference}</span>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                autoFocus
                style={{ height: "42px", padding: "0 12px", border: FIELD_BORDER, borderRadius: "8px", fontSize: "14px", outline: "none", color: "var(--gray-900)" }}
              />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)" }}>{t.referenceHint}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={LABEL}>{t.note}</span>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              style={{ height: "42px", padding: "0 12px", border: FIELD_BORDER, borderRadius: "8px", fontSize: "14px", outline: "none", color: "var(--gray-900)" }}
            />
          </div>

          {/* Named before the fact, not after. Knowing the record carries your name is the point. */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>
            <span>{t.who}</span>
            <strong style={{ color: "var(--gray-700)" }}>{SIGNED_IN_USER.name}</strong>
          </div>

          <button
            onClick={start}
            disabled={!canStart}
            style={{
              height: "44px", border: "none", borderRadius: "8px",
              backgroundColor: canStart ? "var(--primary-400)" : "var(--gray-100)",
              color: canStart ? "white" : "var(--gray-400)",
              fontSize: "14px", fontWeight: 800, letterSpacing: "-0.28px",
              cursor: canStart ? "pointer" : "default",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {t.start}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The standing declaration. Thin by design — it has to survive being looked at all day. */
export function SearchPurposeBar() {
  const [lang] = useLanguage();
  const t = T[lang];
  const { purposes, selection } = usePurposeGate();
  const setSearchPurpose = useVcaStore(s => s.setSearchPurpose);
  const [confirmChange, setConfirmChange] = useState(false);
  useEscapeKey(() => setConfirmChange(false), confirmChange);

  if (!selection) return null;
  const purpose = purposes.find(p => p.id === selection.purposeId);
  if (!purpose) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
      padding: "7px 16px", backgroundColor: "var(--gray-50)", borderBottom: "1px solid var(--line)",
    }}>
      <ShieldCheck size={13} strokeWidth={2.4} color="var(--gray-500)" />
      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.22px" }}>
        {t.barPrefix}
      </span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.24px" }}>
        {purpose.label}
      </span>
      {selection.reference && (
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", letterSpacing: "-0.22px" }}>
          · {selection.reference}
        </span>
      )}
      <button
        onClick={() => { setSearchPurpose(null); setConfirmChange(false); }}
        style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: "11px", fontWeight: 700, color: "var(--gray-600)", letterSpacing: "-0.22px",
        }}
      >
        <Pencil size={11} strokeWidth={2.4} /> {t.change}
      </button>
    </div>
  );
}

/** Shown where the bar would be when the institution has defined nothing to choose from. */
export function SearchPurposeUndefinedNotice() {
  const [lang] = useLanguage();
  const t = T[lang];
  const required = getComplianceConfig().requireSearchPurpose;
  const purposes = useVcaStore(s => s.searchPurposes);
  if (!required || purposes.some(p => !p.archived)) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
      padding: "7px 16px", backgroundColor: "var(--warning-100)", borderBottom: "1px solid var(--warning-200)",
    }}>
      <ShieldCheck size={13} strokeWidth={2.4} color="var(--warning-500)" />
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-800)", letterSpacing: "-0.24px" }}>
        {t.undefinedTitle}
      </span>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-600)", letterSpacing: "-0.22px" }}>
        {t.undefinedBody}
      </span>
    </div>
  );
}
