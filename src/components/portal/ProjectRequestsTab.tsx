"use client";

import { useState } from "react";
import {
  useVcaStore, canSetPolicy, currentPortalUser, ERASURE_DEFAULTS,
  type ErasureCategory, type ErasureDisposition, type ErasureRequest,
  type FootageRequest, type FootageRequestBasis,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TextField, FilterSelect, ConfirmModal, usePortalEditAccess } from "./PortalShared";
import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * One register for everything the outside world asks of this project.
 *
 * Two kinds arrive: somebody wanting footage of a person, and that person wanting all of it gone.
 * They were built as two tabs, and that was an artefact of building two features rather than
 * anything true about the work — the person handling them opens the console asking "what is open",
 * not "is anything open under footage, and then is anything open under erasure". Same errand from
 * opposite directions, so: one list, one place, kind as a column.
 *
 * The two logs next door stay separate, and the difference is worth naming. An activity or search
 * log is append-only — you read it and filter it and no row is waiting for anybody. Every row
 * here is an open item with a state somebody has to move. Lists you read and lists you work are
 * different screens even when the data looks similar.
 *
 * WHAT THE CONSOLE DOES NOT DO, in both halves:
 *   · It does not redact. Obscuring third-party faces is video processing; the release form
 *     records the releaser's statement about work done elsewhere.
 *   · It does not delete what is already outside it. An exported evidence file and the recordings
 *     themselves are named as out of reach rather than offered as choices.
 */

const BASES: FootageRequestBasis[] = ["warrant", "police-request", "data-subject", "insurance", "other"];

const CATEGORIES: ErasureCategory[] = [
  "watchlist", "detections", "judgements", "searchLog", "footageReleases", "auditLog", "exports", "recordings",
];

/** The three an institution can choose between. "out-of-reach" is a fact, not an option. */
const CHOOSABLE: ErasureDisposition[] = ["erase", "retain", "undecided"];

const T = {
  en: {
    title: "Requests",
    intro: "What people outside this project have asked for, and what was decided. Footage handed out and data asked to be erased are both recorded here.",
    newFootage: "Log a footage request",
    newErasure: "Log an erasure request",
    filterAll: "All", filterOpen: "Open", filterFootage: "Footage", filterErasure: "Erasure",
    empty: "Nothing has been asked of this project.",
    emptyHint: "When somebody outside asks — a case officer wanting footage, an insurer, a lawyer, or a person asking to be removed — log it here before anything is handed over or deleted.",
    colKind: "Kind", colWho: "Who", colFiled: "Filed", colState: "State", colOpen: "",
    kindFootage: "Footage", kindErasure: "Erasure",
    fStatus: { received: "Awaiting decision", approved: "Approved, not released", refused: "Refused", released: "Released" } as Record<string, string>,
    eStatus: { received: "In progress", completed: "Completed", refused: "Refused" } as Record<string, string>,
    openTab: "Open", openN: (n: number) => `${n} undecided`,
    // Footage detail
    fBasis: {
      warrant: "Warrant / court order", "police-request": "Police request",
      "data-subject": "The recorded person", insurance: "Insurance", other: "Other",
    } as Record<FootageRequestBasis, string>,
    fWindow: "Requested footage", fPurpose: "Stated purpose", fDecision: "Decision", fRelease: "Release",
    decide: "Decide", release: "Record release",
    notRedacted: "not redacted", wasRedacted: "redacted",
    // Footage intake
    fFormTitle: "Log a footage request",
    fRequester: "Requester", fRequesterPh: "Name of the person asking",
    fOrg: "Organisation", fOrgPh: "Force, firm, insurer — or blank if they are the recorded person",
    fBasisLabel: "Basis",
    fReference: "Reference", fReferencePh: "Case, warrant or document number",
    fReferenceNote: "Required for every basis except a request from the recorded person themselves.",
    fFrom: "From", fTo: "To", fWindowNote: "In this project's time zone, which is the site's own clock.",
    fCameras: "Cameras or place", fCamerasPh: "As the requester described it",
    fPurposePh: "In the requester's words",
    // Decision
    decideTitle: "Decide this request",
    decideNote: "Reason", decideNotePh: "Why this is being granted or refused",
    decideNoteHint: "Required for both answers. An approval with no stated reason is one nobody can defend later.",
    approve: "Approve", refuse: "Refuse",
    // Release
    releaseTitle: "Record the release",
    rMethod: "How it was handed over", rMethodPh: "Encrypted media collected in person, secure transfer, …",
    rTo: "Received by", rToPh: "If different from the requester",
    rRedacted: "Faces of other people were obscured before release",
    rMethodRedaction: "By what", rMethodRedactionPh: "Tool or person who did it",
    rRedactionNote: "This console does not redact. What you record here is your statement about work done elsewhere, and it is written to the activity log as such.",
    rConfirm: "Record it",
    // Erasure intake
    eFormTitle: "Log an erasure request",
    eSubject: "Who is asking", eSubjectPh: "Name as they gave it",
    eReference: "How they were identified", eReferencePh: "ID document, case number, registry entry",
    eNotes: "Notes", eNotesPh: "Anything about the request worth keeping",
    // Erasure detail
    eDetailTitle: "What happens to each kind of record",
    eDetailNote: "A request cannot be completed while any row says “not decided”. That is deliberate — an unanswered question closed as answered is one nobody can find again.",
    dispo: { erase: "Erase", retain: "Keep", undecided: "Not decided", "out-of-reach": "Not ours to delete" } as Record<ErasureDisposition, string>,
    cat: {
      watchlist: "Watchlist entry and enrolled photo",
      detections: "Detections naming this person",
      judgements: "Operator verdicts on those detections",
      searchLog: "Record of who looked them up",
      footageReleases: "Footage released about them",
      auditLog: "Activity log entries naming them",
      exports: "Evidence files already exported",
      recordings: "The recorded video itself",
    } as Record<ErasureCategory, string>,
    why: {
      watchlist: "The request itself, and the console already knows how: releasing someone from the registry is an existing, audited action.",
      detections: "Open. Deleting them destroys the record of what the system did about this person; keeping them keeps biometric-derived rows about somebody who asked to be forgotten. Both have a real argument.",
      judgements: "Open, and tied to the detections above — a verdict cannot outlive the detection it is about.",
      searchLog: "Kept, and kept for them. This is who looked this person up and on what grounds; erasing it on their own request destroys their evidence.",
      footageReleases: "Kept. It is the record of video handed to a third party about this person — the thing a complaint by this very person would need.",
      auditLog: "Kept. A deletion that erases the record of everything leading up to it is not a deletion, it is a cover-up.",
      exports: "Already outside this console. Only the row saying who took it remains, and that row is how anybody knows whom to ask for the copy back.",
      recordings: "The recorder's, not the console's. Governed by the retention period on the Settings screen.",
    } as Record<ErasureCategory, string>,
    closeTitle: "Close this request",
    closeNote: "What was done", closeNotePh: "What was removed, what was kept, and what the person was told",
    complete: "Mark completed",
    blocked: (n: number) => `${n} row${n === 1 ? "" : "s"} still say “not decided”. Answer them before completing.`,
    save: "Log it", cancel: "Cancel",
    toastLogged: "Request logged", toastDecided: "Decision recorded", toastReleased: "Release recorded",
    toastPosition: "Position recorded", toastClosed: "Request closed",
    ownerOnly: "Deciding is the owner's. Anyone with console access can log a request.",
  },
  ko: {
    title: "외부 요청",
    intro: "이 프로젝트 밖에서 요구한 것과 그 결정입니다. 내준 영상과 지워달라는 요청이 함께 남습니다.",
    newFootage: "영상 제공 접수",
    newErasure: "삭제 요청 접수",
    filterAll: "전체", filterOpen: "열린 건", filterFootage: "영상 제공", filterErasure: "삭제",
    empty: "이 프로젝트에 들어온 요청이 없습니다.",
    emptyHint: "밖에서 누가 요구하면 — 영상을 원하는 수사관, 보험사, 변호인, 또는 지워달라는 본인 — 무엇을 내주거나 지우기 전에 여기에 먼저 남기세요.",
    colKind: "종류", colWho: "요청인", colFiled: "접수", colState: "상태", colOpen: "",
    kindFootage: "영상 제공", kindErasure: "삭제 요청",
    fStatus: { received: "결정 대기", approved: "승인됨 · 미제공", refused: "거절됨", released: "제공됨" } as Record<string, string>,
    eStatus: { received: "처리 중", completed: "완료", refused: "거절됨" } as Record<string, string>,
    openTab: "열기", openN: (n: number) => `${n}건 미정`,
    fBasis: {
      warrant: "영장 / 법원 명령", "police-request": "수사기관 협조 요청",
      "data-subject": "찍힌 본인", insurance: "보험", other: "기타",
    } as Record<FootageRequestBasis, string>,
    fWindow: "요청 구간", fPurpose: "요청 사유", fDecision: "결정", fRelease: "제공",
    decide: "결정하기", release: "제공 기록",
    notRedacted: "비식별 안 함", wasRedacted: "비식별함",
    fFormTitle: "영상 제공 요청 접수",
    fRequester: "요청인", fRequesterPh: "요구하는 사람의 이름",
    fOrg: "소속", fOrgPh: "기관·법인·보험사 — 찍힌 본인이면 비워두세요",
    fBasisLabel: "근거",
    fReference: "문서번호", fReferencePh: "사건번호·영장번호·공문번호",
    fReferenceNote: "찍힌 본인의 요청을 제외한 모든 근거에 필요합니다.",
    fFrom: "시작", fTo: "종료", fWindowNote: "이 프로젝트의 시간대, 즉 현장의 시계 기준입니다.",
    fCameras: "카메라 또는 장소", fCamerasPh: "요청인이 말한 그대로",
    fPurposePh: "요청인의 표현 그대로",
    decideTitle: "이 요청을 결정합니다",
    decideNote: "사유", decideNotePh: "왜 내주는지, 또는 왜 거절하는지",
    decideNoteHint: "승인에도 필요합니다. 사유 없는 승인은 나중에 아무도 방어할 수 없는 결정입니다.",
    approve: "승인", refuse: "거절",
    releaseTitle: "제공 기록",
    rMethod: "전달 방법", rMethodPh: "암호화 매체 직접 수령, 보안 전송, …",
    rTo: "수령인", rToPh: "요청인과 다른 사람이면",
    rRedacted: "제공 전 제3자 얼굴을 가렸습니다",
    rMethodRedaction: "무엇으로", rMethodRedactionPh: "사용한 도구 또는 수행자",
    rRedactionNote: "이 콘솔은 비식별 처리를 하지 않습니다. 여기 적는 것은 다른 곳에서 한 작업에 대한 본인의 진술이고, 변경 기록에도 그렇게 남습니다.",
    rConfirm: "기록",
    eFormTitle: "삭제 요청 접수",
    eSubject: "요청인", eSubjectPh: "본인이 밝힌 이름",
    eReference: "신원 확인 방법", eReferencePh: "신분증, 사건번호, 등록부 항목",
    eNotes: "비고", eNotesPh: "남겨둘 만한 내용",
    eDetailTitle: "기록 종류별로 무엇을 할 것인가",
    eDetailNote: "한 줄이라도 “미정”이면 완료로 닫을 수 없습니다. 일부러 그렇게 했습니다 — 답하지 않은 질문을 답한 것으로 닫으면 다시 찾을 수 없습니다.",
    dispo: { erase: "지움", retain: "보존", undecided: "미정", "out-of-reach": "콘솔 소관 아님" } as Record<ErasureDisposition, string>,
    cat: {
      watchlist: "명단 등록과 등록 사진",
      detections: "이 사람을 지목한 검출 이력",
      judgements: "그 검출에 대한 관제요원 판단",
      searchLog: "이 사람을 조회한 기록",
      footageReleases: "이 사람에 대해 제공한 영상 기록",
      auditLog: "이 사람을 언급한 변경 기록",
      exports: "이미 내보낸 증거 파일",
      recordings: "녹화 영상 자체",
    } as Record<ErasureCategory, string>,
    why: {
      watchlist: "요청의 본체이고, 콘솔이 할 줄 아는 일입니다 — 명단에서 해제하는 것은 이미 있는 감사되는 동작입니다.",
      detections: "열려 있습니다. 지우면 시스템이 이 사람에 대해 무엇을 했는지의 기록이 사라지고, 남기면 잊혀지길 요청한 사람의 생체정보 파생 기록을 계속 갖게 됩니다. 양쪽 다 근거가 있습니다.",
      judgements: "열려 있고, 위 검출에 묶여 있습니다 — 판단이 그 대상인 검출보다 오래 살 수는 없습니다.",
      searchLog: "보존하고, 그건 이 사람을 위한 것입니다. 누가 어떤 사유로 이 사람을 조회했는지의 기록이라, 본인 요청으로 지우면 본인의 증거가 사라집니다.",
      footageReleases: "보존합니다. 이 사람에 대한 영상이 제3자에게 나간 기록이고, 바로 그 사람이 민원을 낼 때 필요한 것입니다.",
      auditLog: "보존합니다. 그에 이르기까지를 지우는 삭제는 삭제가 아니라 은폐입니다.",
      exports: "이미 콘솔 밖에 있습니다. 남는 것은 누가 가져갔는지의 줄뿐이고, 그 줄이 사본을 누구에게 돌려달라고 할지 아는 유일한 방법입니다.",
      recordings: "레코더의 것이지 콘솔의 것이 아닙니다. 설정 화면의 보관기간이 다룹니다.",
    } as Record<ErasureCategory, string>,
    closeTitle: "이 요청을 닫습니다",
    closeNote: "처리 내용", closeNotePh: "무엇을 지웠고 무엇을 남겼는지, 본인에게 무엇을 알렸는지",
    complete: "완료로 표시",
    blocked: (n: number) => `아직 “미정”인 줄이 ${n}개 있습니다. 완료하기 전에 답해 주세요.`,
    save: "접수", cancel: "취소",
    toastLogged: "요청을 접수했습니다", toastDecided: "결정을 기록했습니다", toastReleased: "제공을 기록했습니다",
    toastPosition: "판단을 기록했습니다", toastClosed: "요청을 닫았습니다",
    ownerOnly: "결정은 최고관리자의 몫입니다. 접수는 콘솔을 쓰는 누구나 할 수 있습니다.",
  },
};

type Dict = typeof T.en;

const STATE_TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: "var(--warning-100)", fg: "var(--warning-500)" },
  progress: { bg: "var(--info-100)", fg: "var(--info-500)" },
  done: { bg: "var(--success-100)", fg: "var(--success-400)" },
  closed: { bg: "var(--gray-100)", fg: "var(--gray-600)" },
};

const DISPO_TONE: Record<ErasureDisposition, { bg: string; fg: string }> = {
  erase: { bg: "var(--danger-100)", fg: "var(--danger-500)" },
  retain: { bg: "var(--info-100)", fg: "var(--info-500)" },
  undecided: { bg: "var(--warning-100)", fg: "var(--warning-500)" },
  "out-of-reach": { bg: "var(--gray-100)", fg: "var(--gray-600)" },
};

const GRID = "88px minmax(0, 1.3fr) 0.7fr 1fr 70px";

/** One row of the merged list, whichever store it came from. */
type Row =
  | { kind: "footage"; id: string; who: string; sub: string; filed: string; req: FootageRequest }
  | { kind: "erasure"; id: string; who: string; sub: string; filed: string; req: ErasureRequest };

type Filter = "all" | "open" | "footage" | "erasure";

export default function ProjectRequestsTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit } = usePortalEditAccess();
  const portalUsers = useVcaStore(s => s.portalUsers);
  const footage = useVcaStore(s => s.footageRequests);
  const erasures = useVcaStore(s => s.erasureRequests);
  const addFootageRequest = useVcaStore(s => s.addFootageRequest);
  const decideFootageRequest = useVcaStore(s => s.decideFootageRequest);
  const releaseFootageRequest = useVcaStore(s => s.releaseFootageRequest);
  const addErasureRequest = useVcaStore(s => s.addErasureRequest);
  const setErasureDisposition = useVcaStore(s => s.setErasureDisposition);
  const closeErasureRequest = useVcaStore(s => s.closeErasureRequest);

  const me = currentPortalUser(portalUsers);
  // Owner only for decisions, like the other institution-level policies. Logging is not gated:
  // the person who takes the phone call is rarely the one who decides, and a request nobody could
  // write down until the owner signed in is a request handled off the record.
  const mayDecide = me ? canSetPolicy(me.permission) : true;

  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showFootageForm, setShowFootageForm] = useState(false);
  const [showErasureForm, setShowErasureForm] = useState(false);
  const [deciding, setDeciding] = useState<FootageRequest | null>(null);
  const [releasing, setReleasing] = useState<FootageRequest | null>(null);
  const [closing, setClosing] = useState<ErasureRequest | null>(null);

  const undecidedCount = (r: ErasureRequest) => Object.values(r.dispositions).filter(d => d === "undecided").length;
  const isOpen = (row: Row) => row.kind === "footage"
    ? row.req.status === "received" || row.req.status === "approved"
    : row.req.status === "received";

  const all: Row[] = [
    ...footage.filter(r => r.projectId === projectId).map((r): Row => ({
      kind: "footage", id: r.id, who: r.requesterName, sub: r.requesterOrg || t.fBasis[r.basis], filed: r.receivedAt, req: r,
    })),
    ...erasures.filter(r => r.projectId === projectId).map((r): Row => ({
      kind: "erasure", id: r.id, who: r.subjectName, sub: r.subjectReference, filed: r.receivedAt, req: r,
    })),
  ].sort((a, b) => b.filed.localeCompare(a.filed));

  const rows = all.filter(r => filter === "all" ? true : filter === "open" ? isOpen(r) : r.kind === filter);
  const opened = all.find(r => r.id === openId) ?? null;
  const openTotal = all.filter(isOpen).length;

  const FILTERS: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t.filterAll, count: all.length },
    { id: "open", label: t.filterOpen, count: openTotal },
    { id: "footage", label: t.filterFootage },
    { id: "erasure", label: t.filterErasure },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, maxWidth: "62ch", flex: 1, minWidth: "260px" }}>{t.intro}</p>
        {mayEdit && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
            <button className="portal-btn-outline" onClick={() => setShowErasureForm(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.newErasure}
            </button>
            <button className="portal-btn-primary" onClick={() => setShowFootageForm(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.newFootage}
            </button>
          </div>
        )}
      </div>

      {all.length > 0 && (
        /* Kind is a filter, not a tab. "What is open" is the question somebody actually arrives
           with, and it does not care which of the two registers the row came from. */
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  height: "28px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit",
                  border: active ? "1px solid var(--gray-900)" : BORDER,
                  backgroundColor: active ? "var(--gray-900)" : "white",
                  color: active ? "white" : "var(--gray-600)",
                  fontSize: "12px", fontWeight: 700,
                }}>
                {f.label}{f.count !== undefined && f.count > 0 ? ` ${f.count}` : ""}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
        {rows.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.empty}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, marginTop: "6px", maxWidth: "58ch", marginInline: "auto" }}>{t.emptyHint}</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
              {[t.colKind, t.colWho, t.colFiled, t.colState, t.colOpen].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
              ))}
            </div>
            {rows.map((row, i) => {
              const open = isOpen(row);
              const undecided = row.kind === "erasure" ? undecidedCount(row.req) : 0;
              const stateLabel = row.kind === "footage" ? t.fStatus[row.req.status] : t.eStatus[row.req.status];
              const tone = !open ? (row.kind === "footage" && row.req.status === "released") || (row.kind === "erasure" && row.req.status === "completed")
                ? STATE_TONE.done : STATE_TONE.closed
                : row.kind === "footage" && row.req.status === "approved" ? STATE_TONE.progress : STATE_TONE.open;
              return (
                <div key={row.id} style={{
                  display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "12px 16px",
                  alignItems: "center", borderBottom: i === rows.length - 1 ? "none" : BORDER,
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>
                    {row.kind === "footage" ? t.kindFootage : t.kindErasure}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.who}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub || "—"}</p>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{row.filed.slice(0, 10)}</span>
                  <div>
                    <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", backgroundColor: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
                      {stateLabel}
                    </span>
                    {undecided > 0 && (
                      <p style={{ fontSize: "10px", color: "var(--warning-500)", marginTop: "3px" }}>{t.openN(undecided)}</p>
                    )}
                    {row.kind === "footage" && row.req.status === "released" && (
                      <p style={{ fontSize: "10px", color: row.req.redaction?.done ? "var(--gray-500)" : "var(--warning-500)", marginTop: "3px" }}>
                        {row.req.redaction?.done ? t.wasRedacted : t.notRedacted}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="portal-btn-outline" onClick={() => setOpenId(row.id === openId ? null : row.id)}
                      style={{ height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {t.openTab}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {opened?.kind === "footage" && (
        <FootageDetail t={t} req={opened.req} mayDecide={mayDecide}
          onDecide={() => setDeciding(opened.req)} onRelease={() => setReleasing(opened.req)} />
      )}
      {opened?.kind === "erasure" && (
        <ErasureDetail t={t} req={opened.req} mayDecide={mayDecide}
          undecided={undecidedCount(opened.req)}
          onSet={(cat, d) => { setErasureDisposition(opened.req.id, cat, d); showToast({ variant: "success", title: t.toastPosition }); }}
          onClose={() => setClosing(opened.req)} />
      )}

      {!mayDecide && all.length > 0 && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "10px" }}>{t.ownerOnly}</p>
      )}

      {showFootageForm && <FootageIntake t={t} projectId={projectId} onClose={() => setShowFootageForm(false)}
        onSaved={id => { setShowFootageForm(false); setOpenId(id); showToast({ variant: "success", title: t.toastLogged }); }}
        add={addFootageRequest} />}
      {showErasureForm && <ErasureIntake t={t} projectId={projectId} onClose={() => setShowErasureForm(false)}
        onSaved={id => { setShowErasureForm(false); setOpenId(id); showToast({ variant: "success", title: t.toastLogged }); }}
        add={addErasureRequest} />}

      {deciding && <DecisionModal t={t} request={deciding} onClose={() => setDeciding(null)}
        onDecide={(approved, note) => { decideFootageRequest(deciding.id, approved, note); setDeciding(null); showToast({ variant: "success", title: t.toastDecided }); }} />}
      {releasing && <ReleaseModal t={t} onClose={() => setReleasing(null)}
        onRelease={rel => { releaseFootageRequest(releasing.id, rel); setReleasing(null); showToast({ variant: "success", title: t.toastReleased }); }} />}
      {closing && <CloseModal t={t} request={closing} onClose={() => setClosing(null)}
        onDone={(completed, note) => { closeErasureRequest(closing.id, completed, note); setClosing(null); showToast({ variant: "success", title: t.toastClosed }); }} />}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginTop: "14px", padding: "18px 20px" }}>
      {children}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 130px) minmax(0, 1fr)", gap: "8px 16px", padding: "8px 0", borderBottom: BORDER }}>
      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>{label}</span>
      <span style={{ fontSize: "12.5px", color: "var(--gray-900)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function FootageDetail({ t, req, mayDecide, onDecide, onRelease }: {
  t: Dict; req: FootageRequest; mayDecide: boolean; onDecide: () => void; onRelease: () => void;
}) {
  return (
    <Panel>
      <Line label={t.fBasisLabel}>{t.fBasis[req.basis]}{req.reference ? ` · ${req.reference}` : ""}</Line>
      <Line label={t.fWindow}>{req.fromAt} → {req.toAt}{req.cameraNote ? ` · ${req.cameraNote}` : ""}</Line>
      <Line label={t.fPurpose}>{req.purpose}</Line>
      {req.decidedAt && (
        <Line label={t.fDecision}>{req.decisionNote} — {req.decidedBy}, {req.decidedAt.slice(0, 10)}</Line>
      )}
      {req.releasedAt && (
        <Line label={t.fRelease}>
          {req.releaseMethod}{req.releasedTo ? ` · ${req.releasedTo}` : ""} — {req.releasedBy}, {req.releasedAt.slice(0, 10)}
          {" · "}{req.redaction?.done ? `${t.wasRedacted} (${req.redaction.method})` : t.notRedacted}
        </Line>
      )}
      {mayDecide && (req.status === "received" || req.status === "approved") && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
          <button className="portal-btn-outline" onClick={req.status === "received" ? onDecide : onRelease}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {req.status === "received" ? t.decide : t.release}
          </button>
        </div>
      )}
    </Panel>
  );
}

function ErasureDetail({ t, req, mayDecide, undecided, onSet, onClose }: {
  t: Dict; req: ErasureRequest; mayDecide: boolean; undecided: number;
  onSet: (cat: ErasureCategory, d: ErasureDisposition) => void; onClose: () => void;
}) {
  return (
    <Panel>
      <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)" }}>{t.eDetailTitle}</p>
      <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.65, marginTop: "6px", maxWidth: "68ch" }}>{t.eDetailNote}</p>
      <div style={{ marginTop: "14px" }}>
        {CATEGORIES.map((cat, i) => {
          const d = req.dispositions[cat];
          const tone = DISPO_TONE[d];
          // Facts are not offered as choices — an exported copy and the recorder's storage are
          // outside this console whatever anybody decides.
          const fixed = ERASURE_DEFAULTS[cat] === "out-of-reach";
          return (
            <div key={cat} style={{
              display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.6fr) 150px",
              gap: "8px 16px", padding: "12px 0", alignItems: "start",
              borderBottom: i === CATEGORIES.length - 1 ? "none" : BORDER,
            }}>
              <p style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.5 }}>{t.cat[cat]}</p>
              <p style={{ fontSize: "11.5px", color: "var(--gray-500)", lineHeight: 1.6 }}>{t.why[cat]}</p>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {fixed || !mayDecide || req.status !== "received" ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", backgroundColor: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
                    {t.dispo[d]}
                  </span>
                ) : (
                  <FilterSelect value={d} onChange={v => onSet(cat, v as ErasureDisposition)}
                    options={CHOOSABLE.map(c => ({ value: c, label: t.dispo[c] }))} fitContent />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {mayDecide && req.status === "received" && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: BORDER }}>
          {undecided > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning-500)", lineHeight: 1.55, flex: 1, minWidth: "200px" }}>{t.blocked(undecided)}</span>
          )}
          <button className="portal-btn-outline" onClick={onClose}
            style={{ marginLeft: "auto", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.closeTitle}
          </button>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", color: "var(--gray-500)", marginBottom: "6px" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.55, marginTop: "6px" }}>{hint}</p>}
    </div>
  );
}

function Modal({ title, children, footer, onClose, wide }: {
  title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: wide ? "520px" : "460px", width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", minHeight: 0 }}>{children}</div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>{footer}</div>
      </div>
    </div>
  );
}

function btn(kind: "ghost" | "primary" | "quiet", enabled: boolean) {
  const base = { height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit" } as const;
  if (kind === "primary") return { ...base, border: "none", backgroundColor: enabled ? "var(--primary-400)" : "var(--gray-200)", color: enabled ? "white" : "var(--gray-400)" };
  return { ...base, border: BORDER, backgroundColor: "white", color: enabled ? "var(--gray-600)" : "var(--gray-400)" };
}

function FootageIntake({ t, projectId, onClose, onSaved, add }: {
  t: Dict; projectId: string; onClose: () => void; onSaved: (id: string) => void;
  add: (r: Omit<FootageRequest, "id" | "status" | "receivedAt" | "receivedBy">) => string;
}) {
  const [requesterName, setRequesterName] = useState("");
  const [requesterOrg, setRequesterOrg] = useState("");
  const [basis, setBasis] = useState<FootageRequestBasis>("police-request");
  const [reference, setReference] = useState("");
  const [fromAt, setFromAt] = useState("");
  const [toAt, setToAt] = useState("");
  const [cameraNote, setCameraNote] = useState("");
  const [purpose, setPurpose] = useState("");

  // A document number is what makes a basis checkable. The recorded person asking for their own
  // footage is the exception — they are the basis, and demanding a case number from them is the
  // institution inventing a hurdle for a right they already have.
  const needsReference = basis !== "data-subject";
  const canSave = requesterName.trim() !== "" && fromAt.trim() !== "" && toAt.trim() !== ""
    && purpose.trim() !== "" && (!needsReference || reference.trim() !== "");

  return (
    <Modal title={t.fFormTitle} onClose={onClose} wide
      footer={<>
        <button className="portal-btn-outline" onClick={onClose} style={btn("ghost", true)}>{t.cancel}</button>
        <button className="portal-btn-primary" disabled={!canSave} style={btn("primary", canSave)}
          onClick={() => onSaved(add({
            projectId, requesterName: requesterName.trim(), requesterOrg: requesterOrg.trim(),
            basis, reference: reference.trim() || undefined,
            fromAt: fromAt.trim(), toAt: toAt.trim(),
            cameraNote: cameraNote.trim(), purpose: purpose.trim(),
          }))}>
          {t.save}
        </button>
      </>}>
      <Field label={t.fRequester}><TextField value={requesterName} onChange={setRequesterName} placeholder={t.fRequesterPh} autoFocus /></Field>
      <Field label={t.fOrg}><TextField value={requesterOrg} onChange={setRequesterOrg} placeholder={t.fOrgPh} /></Field>
      <Field label={t.fBasisLabel}>
        <FilterSelect value={basis} onChange={v => setBasis(v as FootageRequestBasis)}
          options={BASES.map(b => ({ value: b, label: t.fBasis[b] }))} fitContent />
      </Field>
      {needsReference && (
        <Field label={t.fReference} hint={t.fReferenceNote}>
          <TextField value={reference} onChange={setReference} placeholder={t.fReferencePh} />
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label={t.fFrom}><TextField value={fromAt} onChange={setFromAt} placeholder="2026-09-03 14:00" /></Field>
        <Field label={t.fTo}><TextField value={toAt} onChange={setToAt} placeholder="2026-09-03 15:30" /></Field>
      </div>
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.55, marginTop: "-6px" }}>{t.fWindowNote}</p>
      <Field label={t.fCameras}><TextField value={cameraNote} onChange={setCameraNote} placeholder={t.fCamerasPh} /></Field>
      <Field label={t.fPurpose}><TextField value={purpose} onChange={setPurpose} placeholder={t.fPurposePh} /></Field>
    </Modal>
  );
}

function ErasureIntake({ t, projectId, onClose, onSaved, add }: {
  t: Dict; projectId: string; onClose: () => void; onSaved: (id: string) => void;
  add: (r: { projectId: string; subjectName: string; subjectReference: string; notes?: string }) => string;
}) {
  const [subjectName, setSubjectName] = useState("");
  const [subjectReference, setSubjectReference] = useState("");
  const [notes, setNotes] = useState("");
  const canSave = subjectName.trim() !== "" && subjectReference.trim() !== "";

  return (
    <Modal title={t.eFormTitle} onClose={onClose}
      footer={<>
        <button className="portal-btn-outline" onClick={onClose} style={btn("ghost", true)}>{t.cancel}</button>
        <button className="portal-btn-primary" disabled={!canSave} style={btn("primary", canSave)}
          onClick={() => onSaved(add({ projectId, subjectName: subjectName.trim(), subjectReference: subjectReference.trim(), notes: notes.trim() || undefined }))}>
          {t.save}
        </button>
      </>}>
      <Field label={t.eSubject}><TextField value={subjectName} onChange={setSubjectName} placeholder={t.eSubjectPh} autoFocus /></Field>
      {/* Required. An erasure carried out for the wrong person is itself a data incident, and the
          console cannot verify identity — so the least it can do is refuse to record a request
          that does not say how it was verified. */}
      <Field label={t.eReference}><TextField value={subjectReference} onChange={setSubjectReference} placeholder={t.eReferencePh} /></Field>
      <Field label={t.eNotes}><TextField value={notes} onChange={setNotes} placeholder={t.eNotesPh} /></Field>
    </Modal>
  );
}

function DecisionModal({ t, request, onClose, onDecide }: {
  t: Dict; request: FootageRequest; onClose: () => void; onDecide: (approved: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const can = note.trim() !== "";
  return (
    <Modal title={t.decideTitle} onClose={onClose}
      footer={<>
        <button className="portal-btn-outline" onClick={onClose} style={btn("ghost", true)}>{t.cancel}</button>
        <button className="portal-btn-outline-danger" disabled={!can} style={btn("ghost", can)} onClick={() => onDecide(false, note)}>{t.refuse}</button>
        <button className="portal-btn-primary" disabled={!can} style={btn("primary", can)} onClick={() => onDecide(true, note)}>{t.approve}</button>
      </>}>
      <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6 }}>
        {request.requesterName}{request.requesterOrg ? ` · ${request.requesterOrg}` : ""} — {t.fBasis[request.basis]}
        {request.reference ? ` · ${request.reference}` : ""}
      </p>
      <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.7 }}>{request.purpose}</p>
      <Field label={t.decideNote} hint={t.decideNoteHint}>
        <TextField value={note} onChange={setNote} placeholder={t.decideNotePh} autoFocus />
      </Field>
    </Modal>
  );
}

function ReleaseModal({ t, onClose, onRelease }: {
  t: Dict; onClose: () => void;
  onRelease: (r: Pick<FootageRequest, "releaseMethod" | "releasedTo" | "redaction">) => void;
}) {
  const [method, setMethod] = useState("");
  const [releasedTo, setReleasedTo] = useState("");
  const [redacted, setRedacted] = useState(false);
  const [redactionMethod, setRedactionMethod] = useState("");
  const can = method.trim() !== "" && (!redacted || redactionMethod.trim() !== "");

  return (
    <ConfirmModal
      title={t.releaseTitle} body={t.rRedactionNote}
      confirmLabel={t.rConfirm} cancelLabel={t.cancel} confirmDisabled={!can}
      onClose={onClose}
      onConfirm={() => onRelease({
        releaseMethod: method.trim(),
        releasedTo: releasedTo.trim() || undefined,
        redaction: { done: redacted, method: redacted ? redactionMethod.trim() : "" },
      })}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <Field label={t.rMethod}><TextField value={method} onChange={setMethod} placeholder={t.rMethodPh} autoFocus /></Field>
        <Field label={t.rTo}><TextField value={releasedTo} onChange={setReleasedTo} placeholder={t.rToPh} /></Field>
        {/* Unchecked by default, and a claim either way. Defaulting it to true would put the
            institution's signature on work nobody confirmed happened. */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-700)", lineHeight: 1.55 }}>
          <input type="checkbox" checked={redacted} onChange={e => setRedacted(e.target.checked)} style={{ marginTop: "2px" }} />
          {t.rRedacted}
        </label>
        {redacted && (
          <Field label={t.rMethodRedaction}>
            <TextField value={redactionMethod} onChange={setRedactionMethod} placeholder={t.rMethodRedactionPh} />
          </Field>
        )}
      </div>
    </ConfirmModal>
  );
}

function CloseModal({ t, request, onClose, onDone }: {
  t: Dict; request: ErasureRequest; onClose: () => void; onDone: (completed: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const undecided = Object.values(request.dispositions).filter(d => d === "undecided").length;
  const canComplete = note.trim() !== "" && undecided === 0;
  const canRefuse = note.trim() !== "";

  return (
    <ConfirmModal
      title={t.closeTitle}
      body={undecided > 0 ? t.blocked(undecided) : t.eDetailNote}
      confirmLabel={t.complete} cancelLabel={t.cancel} confirmDisabled={!canComplete}
      onClose={onClose} onConfirm={() => onDone(true, note)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Field label={t.closeNote}><TextField value={note} onChange={setNote} placeholder={t.closeNotePh} autoFocus /></Field>
        {/* Refusing stays available: a request from somebody the institution cannot identify, or
            one it is obliged to decline, still needs an answer and a record of it. */}
        <button className="portal-btn-outline" disabled={!canRefuse} onClick={() => onDone(false, note)}
          style={{ alignSelf: "flex-start", height: "28px", padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: canRefuse ? "var(--gray-700)" : "var(--gray-400)", fontSize: "11px", fontWeight: 700, cursor: canRefuse ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {t.refuse}
        </button>
      </div>
    </ConfirmModal>
  );
}
