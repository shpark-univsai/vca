"use client";

/**
 * THE API SIDE OF THE SERVER SCREEN: keys first, reference second.
 *
 * This tab was four endpoint lines, a base URL and a sentence admitting that issuing and revoking
 * keys did not exist anywhere in Portal (owner, 2026-09-21: 다른서비스들과 다르게 어색하게
 * 들어가있는거). Every comparable console is the other way round:
 *
 *   - VERKADA: Organization Settings has a "Verkada API" tab, and its content is the key list.
 *     `+ New API Key` asks for a name, read-only or read/write, and an expiry; the key is shown
 *     once; ten per organization; organization admins only. The endpoint reference is a separate
 *     documentation site (apidocs.verkada.com), not a page in the console.
 *   - MILESTONE and GENETEC ship their SDK documentation outside the admin client entirely.
 *
 * A console's job with an API is the credential. So the key list is the first card here and the
 * reference is what is left underneath, kept because this product is on-premise: there is no
 * vendor documentation site for an integrator sitting on an isolated network to open.
 *
 * WHAT THIS CANNOT DO IS MINT A WORKING KEY. Only the server that validates a key can issue one.
 * The reveal below says so in the dialog where somebody would otherwise copy a value and wonder
 * why it is refused — the same rule as the mail panel's "saved, not tested".
 */

import { useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import {
  API_KEY_LIMIT, apiKeyState, apiKeysInProject, canManageAccess, currentPortalRole, useVcaStore,
  type ApiKey, type ApiKeyScope,
} from "@/lib/vcaStore";
import { dateKeyIn } from "@/lib/time";
import { PROJECT_TIME_ZONE } from "@/lib/time";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import {
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TextField,
  ConfirmModal, FieldError, RequiredMark, RowActionsMenu, StatusBadge, TableEmpty, Drawer,
} from "./PortalShared";

const ENDPOINTS = [
  { method: "GET", path: "/v1/cameras", desc: { en: "List cameras registered to this project.", ko: "이 프로젝트에 등록된 카메라 목록을 조회합니다." } },
  { method: "GET", path: "/v1/persons", desc: { en: "List VIP registrations.", ko: "VIP 등록 목록을 조회합니다." } },
  { method: "POST", path: "/v1/events", desc: { en: "Push a detection event from an edge server.", ko: "엣지 서버에서 탐지 이벤트를 전송합니다." } },
  { method: "GET", path: "/v1/servers", desc: { en: "List infrastructure nodes and their health.", ko: "인프라 노드와 상태를 조회합니다." } },
];

/** The expiries the dialog offers, in days. `null` is no end date, which is a choice, not a gap. */
const EXPIRY_CHOICES: { days: number | null }[] = [{ days: 30 }, { days: 90 }, { days: 365 }, { days: null }];

const T = {
  en: {
    keysHeading: "API keys",
    keysIntro: "One key per integration, so a key can be taken away without stopping the others.",
    issue: "Issue key",
    limitNote: (n: number, max: number) => `${n} of ${max} in use`,
    limitReached: `A project holds at most ${API_KEY_LIMIT} live keys. Revoke one to make another.`,
    colName: "Name", colKey: "Key", colScope: "Permission", colExpiry: "Expiry", colState: "State",
    scopeRead: "Read-only", scopeWrite: "Read / write",
    stateActive: "Active", stateExpired: "Expired", stateRevoked: "Revoked",
    noExpiry: "No end date",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    revoke: "Revoke",
    revokeTitle: (name: string) => `Revoke ${name}?`,
    revokeBody: "Calls signed with this key start failing immediately. The row stays on the list with today's date, so the record of what it could reach survives.",
    revokeConfirm: "Revoke key",
    cancel: "Cancel",
    revokedToast: "Key revoked",
    notOwner: "Only an owner issues or revokes keys.",
    empty: "No keys yet. An integration cannot call this installation until one is issued.",
    // The issue dialog
    dialogTitle: "Issue an API key",
    fieldName: "Name",
    fieldNamePlaceholder: "Control room dashboard",
    fieldNameHint: "What this key is for. It is the only thing telling two keys apart in the list.",
    fieldScope: "Permission",
    scopeReadDesc: "Reads cameras, registrations and events.",
    scopeWriteDesc: "Also pushes events and changes registrations.",
    fieldExpiry: "Expiry",
    expiryDays: (n: number) => `${n} days`,
    expiryNone: "No end date",
    expiryNoneWarning: "A key with no end date stays valid until somebody remembers to revoke it.",
    issueButton: "Issue",
    refusalDuplicate: "A live key already has this name.",
    refusalLimit: `This project already holds ${API_KEY_LIMIT} live keys.`,
    // The reveal
    revealTitle: "Copy this key now",
    revealBody: "This is the only time it is shown. Portal keeps the first characters so you can recognise it in the list, and nothing else.",
    copy: "Copy", copied: "Copied",
    copyFailed: "The browser would not copy it. Select the text and copy it by hand.",
    revealMock: "Issued by this console only. Until the server side exists, no endpoint will accept it (HANDOFF §API).",
    done: "Done",
    // Reference
    baseUrl: "API base URL",
    baseUrlNote: "This installation's own address. There is no vendor-hosted API: the product is on-premise, so the base URL is whatever host this console is served from.",
    endpoints: "Endpoints",
  },
  ko: {
    keysHeading: "API 키",
    keysIntro: "연동마다 키를 하나씩 두면, 하나를 폐기해도 나머지가 멈추지 않습니다.",
    issue: "키 발급",
    limitNote: (n: number, max: number) => `${max}개 중 ${n}개 사용 중`,
    limitReached: `프로젝트당 유효한 키는 최대 ${API_KEY_LIMIT}개입니다. 하나를 폐기하면 새로 만들 수 있습니다.`,
    colName: "이름", colKey: "키", colScope: "권한", colExpiry: "만료", colState: "상태",
    scopeRead: "읽기 전용", scopeWrite: "읽기 · 쓰기",
    stateActive: "유효", stateExpired: "만료됨", stateRevoked: "폐기됨",
    noExpiry: "만료 없음",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    revoke: "폐기",
    revokeTitle: (name: string) => `${name}을(를) 폐기할까요?`,
    revokeBody: "이 키로 서명한 호출이 즉시 실패합니다. 목록에는 폐기 날짜와 함께 남습니다. 이 키가 무엇까지 볼 수 있었는지가 기록으로 남아야 하기 때문입니다.",
    revokeConfirm: "키 폐기",
    cancel: "취소",
    revokedToast: "키를 폐기했습니다",
    notOwner: "키 발급과 폐기는 최고관리자만 할 수 있습니다.",
    empty: "아직 키가 없습니다. 키가 발급되기 전에는 어떤 연동도 이 설치본을 호출할 수 없습니다.",
    dialogTitle: "API 키 발급",
    fieldName: "이름",
    fieldNamePlaceholder: "관제실 대시보드",
    fieldNameHint: "이 키를 어디에 쓰는지 적습니다. 목록에서 키 둘을 구분하는 유일한 정보입니다.",
    fieldScope: "권한",
    scopeReadDesc: "카메라 · 등록 명단 · 이벤트를 조회합니다.",
    scopeWriteDesc: "조회에 더해 이벤트 전송과 등록 변경까지 합니다.",
    fieldExpiry: "만료",
    expiryDays: (n: number) => `${n}일`,
    expiryNone: "만료 없음",
    expiryNoneWarning: "만료가 없는 키는 누군가 폐기를 기억할 때까지 계속 유효합니다.",
    issueButton: "발급",
    refusalDuplicate: "같은 이름의 유효한 키가 이미 있습니다.",
    refusalLimit: `이 프로젝트에는 이미 유효한 키가 ${API_KEY_LIMIT}개 있습니다.`,
    revealTitle: "이 키를 지금 복사하세요",
    revealBody: "키 전체가 보이는 것은 이번 한 번입니다. Portal은 목록에서 알아볼 수 있을 만큼의 앞부분만 보관하고, 나머지는 갖고 있지 않습니다.",
    copy: "복사", copied: "복사했습니다",
    copyFailed: "브라우저가 복사를 거부했습니다. 값을 직접 선택해서 복사해 주세요.",
    revealMock: "지금은 이 콘솔이 만들어 낸 값입니다. 서버 쪽이 생기기 전까지는 어떤 엔드포인트도 이 키를 받아주지 않습니다(HANDOFF §API).",
    done: "완료",
    baseUrl: "API 기본 URL",
    baseUrlNote: "이 설치본 자신의 주소입니다. 벤더가 호스팅하는 API는 없습니다. 온프레미스 제품이라, 기본 URL은 이 콘솔이 서비스되는 호스트입니다.",
    endpoints: "엔드포인트",
  },
};

type Dict = typeof T.en;

/* The badge moved to PortalShared — see StatusBadge there for why the colour is tied to what the
   state MEANS rather than to this screen. An expired key is a fault (time passed, nobody chose
   it); a revoked one is a decision. They used to be amber and grey. */

const GRID = "1.5fr 1fr 0.85fr 0.9fr 0.7fr 36px";

/**
 * Issue, then reveal. Two stages in one dialog rather than a dialog and a toast: the value is only
 * ever on screen once, and a toast is the one surface a reader cannot go back to.
 */
function IssueKeyModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const issueApiKey = useVcaStore(s => s.issueApiKey);
  const projects = useVcaStore(s => s.projects);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKeyScope>("read");
  const [expiryDays, setExpiryDays] = useState<number | null>(90);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ key: ApiKey; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const zone = projects.find(p => p.id === projectId)?.timeZone ?? PROJECT_TIME_ZONE;
  const valid = name.trim() !== "";

  const submit = () => {
    if (!valid) return;
    // The clock is read here, in a click handler, not during render — see apiKeyState.
    const expiresAt = expiryDays === null
      ? null
      : dateKeyIn(new Date(Date.now() + expiryDays * 86400_000), zone);
    const result = issueApiKey(projectId, { name, scope, expiresAt });
    if ("refusal" in result) {
      setRefusal(result.refusal === "duplicate-name" ? t.refusalDuplicate : t.refusalLimit);
      return;
    }
    setRefusal(null);
    setIssued(result);
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.secret);
      setCopied(true);
    } catch {
      setRefusal(t.copyFailed);
    }
  };

  return (
    <Drawer title={issued ? t.revealTitle : t.dialogTitle} onClose={onClose} width="520px"
      footer={issued ? (
        /* The reveal keeps a button of its own. Leaving this stage drops a value nothing can
           be asked for again, so there has to be one exit a reader takes on purpose — the
           scrim, Escape and the panel's ✕ are all ways out of it by accident. */
        <button className="portal-btn-primary" onClick={onClose}
          style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {t.done}
        </button>
      ) : (<>
        <button className="portal-btn-outline" onClick={onClose}
          style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {t.cancel}
        </button>
        <button className="portal-btn-primary" onClick={submit} disabled={!valid}
          style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {t.issueButton}
        </button>
      </>)}>
      {issued ? (
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginBottom: "12px", lineHeight: 1.5 }}>{t.revealBody}</p>
          <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <code style={{
              flex: 1, minWidth: 0, fontSize: "12px", fontFamily: "monospace", color: "var(--gray-900)",
              backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "8px", padding: "10px",
              wordBreak: "break-all", lineHeight: 1.5,
            }}>
              {issued.secret}
            </code>
            <button onClick={copy}
              style={{ flexShrink: 0, alignSelf: "flex-start", height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {copied ? t.copied : t.copy}
            </button>
          </div>
          {refusal && <div style={{ marginTop: "8px" }}><FieldError>{refusal}</FieldError></div>}
          {/* The one thing a reader cannot find out by trying: this value is not on any server. */}
          <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.5, marginTop: "12px" }}>{t.revealMock}</p>
        </div>
      ) : (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.fieldName}<RequiredMark /></label>
            <TextField value={name} onChange={v => { setName(v); setRefusal(null); }} placeholder={t.fieldNamePlaceholder} />
            <p style={{ fontSize: "10px", color: "var(--gray-400)", lineHeight: 1.5, marginTop: "6px" }}>{t.fieldNameHint}</p>
            {refusal && <FieldError>{refusal}</FieldError>}
          </div>

          {/* Two cards rather than a select: what a key may do is the decision on this dialog
              worth reading twice, and a collapsed list hides the half that matters. */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.fieldScope}<RequiredMark /></label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([["read", t.scopeRead, t.scopeReadDesc], ["readwrite", t.scopeWrite, t.scopeWriteDesc]] as const).map(([value, label, desc]) => (
                <label key={value} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer",
                  padding: "10px 12px", borderRadius: "10px",
                  border: scope === value ? "1px solid var(--primary-400)" : BORDER,
                  backgroundColor: scope === value ? "var(--primary-100)" : "white",
                }}>
                  <input type="radio" name="api-scope" checked={scope === value} onChange={() => setScope(value)}
                    style={{ marginTop: "2px", accentColor: "var(--primary-400)", cursor: "pointer" }} />
                  <span>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{label}</span>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.5 }}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.fieldExpiry}<RequiredMark /></label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {EXPIRY_CHOICES.map(choice => {
                const selected = expiryDays === choice.days;
                return (
                  <button key={String(choice.days)} onClick={() => setExpiryDays(choice.days)}
                    style={{
                      height: "32px", padding: "0 12px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                      border: selected ? "1px solid var(--primary-400)" : BORDER,
                      backgroundColor: selected ? "var(--primary-100)" : "white",
                      color: selected ? "var(--primary-400)" : "var(--gray-600)",
                      fontSize: "12px", fontWeight: 700,
                    }}>
                    {choice.days === null ? t.expiryNone : t.expiryDays(choice.days)}
                  </button>
                );
              })}
            </div>
            {/* Not a refusal. A permanent key is a real choice on a site nobody visits often;
                what it costs is worth one line where the choice is made. */}
            {expiryDays === null && (
              <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.5, marginTop: "8px" }}>{t.expiryNoneWarning}</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function ProjectApiPanel({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const apiKeys = useVcaStore(s => s.apiKeys);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const projects = useVcaStore(s => s.projects);
  const revokeApiKey = useVcaStore(s => s.revokeApiKey);
  const { showToast } = useToast();

  /* Owner only, the way Verkada restricts its API page to organization admins: a key is a way in
     that outlives the account that made it. Everybody else reads the list — knowing which
     integrations can reach the site is exactly what an auditor comes here for. */
  const mayManage = canManageAccess(currentPortalRole(portalUsers));

  /* The clock, after mount. Expiry is a calendar question about the site, and a day computed
     during render differs between the server's HTML and the browser's first pass. */
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  const zone = projects.find(p => p.id === projectId)?.timeZone ?? PROJECT_TIME_ZONE;
  const todayKey = nowMs === null ? null : dateKeyIn(new Date(nowMs), zone);

  // The host this console is served from, not a vendor cloud. Read after mount: `window` does not
  // exist while this renders on the server, and a guessed host corrected a frame later is the
  // mismatch the rest of Portal avoids.
  const [origin, setOrigin] = useState("");
  useEffect(() => { queueMicrotask(() => setOrigin(window.location.origin)); }, []);

  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const keys = apiKeysInProject(apiKeys, projectId);
  const live = keys.filter(k => !k.revokedAt).length;
  const atLimit = live >= API_KEY_LIMIT;

  const stateLabel = (key: ApiKey) => {
    const state = apiKeyState(key, todayKey);
    if (state === "unknown") return null;
    return { state, label: state === "active" ? t.stateActive : state === "expired" ? t.stateExpired : t.stateRevoked };
  };

  return (
    /*
     * SIDE BY SIDE (owner, 2026-09-28: api 화면에 두덩어리를 가로로 두개 배치해서 세로로
     * 볼수있게 바꾸면 어떨까).
     *
     * Stacked, the reference sat below the fold on every window and the page was mostly scrolling.
     * They are different kinds of thing — one is a list that grows as keys are issued, the other
     * is fixed text an integrator copies from — so neither needs the other's width.
     *
     * Flex bases rather than a measured grid: at 1144px the keys take about 718 and the reference
     * 426, and under about 880 the two bases no longer fit and the row wraps back to one column on
     * its own. No ResizeObserver, and nothing to keep in sync with a breakpoint written elsewhere.
     */
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "16px" }}>
      {/* KEYS FIRST, and wider: the console's job with an API is the credential. The reference is
          here only because an on-premise integrator has no documentation site to open. */}
      <div style={{ flex: "3 1 560px", minWidth: 0, backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0 }}>
            <span style={{ display: "flex", color: "var(--gray-400)", flexShrink: 0, marginTop: "1px" }}><KeyRound size={17} strokeWidth={2} /></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.keysHeading}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px", lineHeight: 1.5 }}>{t.keysIntro}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.limitNote(live, API_KEY_LIMIT)}</span>
            <button onClick={() => setIssuing(true)} disabled={!mayManage || atLimit}
              title={!mayManage ? t.notOwner : atLimit ? t.limitReached : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none",
                backgroundColor: mayManage && !atLimit ? "var(--primary-400)" : "var(--gray-200)",
                color: mayManage && !atLimit ? "white" : "var(--gray-400)",
                fontSize: "12px", fontWeight: 700, cursor: mayManage && !atLimit ? "pointer" : "not-allowed", fontFamily: "inherit",
              }}>
              <Plus size={14} strokeWidth={2.6} />
              {t.issue}
            </button>
          </div>
        </div>

        {keys.length === 0 ? (
          <div style={{ borderTop: BORDER }}><TableEmpty text={t.empty} /></div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 20px", backgroundColor: "var(--gray-50)", borderTop: BORDER, borderBottom: BORDER }}>
              {[t.colName, t.colKey, t.colScope, t.colExpiry, t.colState, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
              ))}
            </div>
            {keys.map((key, i) => {
              const badge = stateLabel(key);
              const revoked = !!key.revokedAt;
              return (
                <div key={key.id} style={{
                  display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
                  padding: "10px 20px", alignItems: "center",
                  borderBottom: i === keys.length - 1 ? "none" : BORDER,
                  // Struck through rather than hidden: the row is a record now, and it should not
                  // read like something that still works.
                  opacity: revoked ? 0.6 : 1,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.createdBy(key.createdBy, key.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  {/* The prefix and an ellipsis, which is all the console holds. */}
                  <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {key.prefix}…
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{key.scope === "read" ? t.scopeRead : t.scopeWrite}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: key.expiresAt ? "monospace" : "inherit" }}>
                    {key.expiresAt ?? t.noExpiry}
                  </span>
                  {/* Empty for one frame before the clock is read, rather than a verdict that
                      changes in front of the reader. */}
                  <span>{badge ? <StatusBadge tone={badge.state === "active" ? "normal" : badge.state === "expired" ? "fault" : "stopped"} label={badge.label} /> : null}</span>
                  <RowActionsMenu actions={[{
                    label: t.revoke,
                    danger: true,
                    disabled: !mayManage || revoked,
                    reason: !mayManage ? t.notOwner : undefined,
                    onClick: () => setRevoking(key),
                  }]} />
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* THE REFERENCE, beside it. */}
      <div style={{ flex: "2 1 320px", minWidth: 0, backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "20px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.baseUrl}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "monospace", marginTop: "6px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "8px", padding: "8px 10px", overflowX: "auto" }}>
          {origin}/api/portal/projects/{projectId}
        </p>
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5, marginTop: "6px" }}>{t.baseUrlNote}</p>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "20px", marginBottom: "10px" }}>{t.endpoints}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {ENDPOINTS.map(ep => (
            <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "var(--gray-50)" }}>
              <span style={{
                fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", flexShrink: 0,
                backgroundColor: ep.method === "GET" ? "var(--gray-200)" : "var(--success-100)",
                color: ep.method === "GET" ? "var(--gray-900)" : "var(--success-400)",
              }}>
                {ep.method}
              </span>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--gray-900)" }}>{ep.path}</span>
              <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{ep.desc[lang]}</span>
            </div>
          ))}
        </div>
      </div>

      {issuing && <IssueKeyModal projectId={projectId} onClose={() => setIssuing(false)} />}
      {revoking && (
        <ConfirmModal
          title={t.revokeTitle(revoking.name)}
          body={t.revokeBody}
          confirmLabel={t.revokeConfirm}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            revokeApiKey(revoking.id);
            showToast({ variant: "warning", title: t.revokedToast, desc: revoking.name });
            setRevoking(null);
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  );
}
