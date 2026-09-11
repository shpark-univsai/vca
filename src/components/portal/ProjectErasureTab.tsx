"use client";

import { useState } from "react";
import {
  useVcaStore, canSetPolicy, currentPortalUser, ERASURE_DEFAULTS,
  type ErasureCategory, type ErasureDisposition, type ErasureRequest,
} from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, TextField, FilterSelect, ConfirmModal, usePortalEditAccess } from "./PortalShared";
import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * "Delete my data", answered category by category.
 *
 * The screen exists because that sentence has no single answer here. This product holds seven
 * kinds of record about a person, and they do not share a fate: the watchlist entry should go,
 * the log of who looked them up should stay — and stay precisely because they asked — and two of
 * them are policy questions nobody in this codebase has standing to settle.
 *
 * So the table does not decide. It shows every category, what is settled and why, and leaves the
 * open ones visibly open. The request cannot be closed as completed while one is still open,
 * which is the whole design: an institution that has not decided finds out here rather than by
 * discovering later that somebody decided by default.
 *
 * Two rows say "not ours". An evidence file already exported is a copy outside this console, and
 * the recordings belong to the recorder. Naming them is the honest move — a screen that offered
 * to delete them would be claiming a reach it does not have.
 */

const CATEGORIES: ErasureCategory[] = [
  "watchlist", "detections", "judgements", "searchLog", "footageReleases", "auditLog", "exports", "recordings",
];

const T = {
  en: {
    title: "Erasure requests",
    intro: "Somebody asking to have their own data removed, and what this institution decided for each kind of record it holds.",
    newRequest: "Log a request",
    empty: "No erasure request has been filed for this project.",
    emptyHint: "When a person asks to be removed — in writing, at a counter, through a lawyer — log it here. The categories below are filled in from the product's own defaults, and the two open questions stay open until somebody answers them.",
    colSubject: "Subject", colFiled: "Filed", colOpen: "Open questions", colStatus: "Status",
    status: { received: "In progress", completed: "Completed", refused: "Refused" } as Record<string, string>,
    open: (n: number) => (n === 0 ? "None" : `${n} undecided`),
    openTab: "Open",
    formTitle: "Log an erasure request",
    fSubject: "Who is asking", fSubjectPh: "Name as they gave it",
    fReference: "How they were identified", fReferencePh: "ID document, case number, registry entry",
    fNotes: "Notes", fNotesPh: "Anything about the request worth keeping",
    save: "Log it", cancel: "Cancel", close: "Close",
    detailTitle: "What happens to each kind of record",
    detailNote: "A request cannot be completed while any row says “not decided”. That is deliberate — an unanswered question closed as answered is one nobody can find again.",
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
    setTo: "Decide",
    closeTitle: "Close this request",
    closeNote: "What was done", closeNotePh: "What was removed, what was kept, and what the person was told",
    complete: "Mark completed", refuse: "Refuse",
    blocked: (n: number) => `${n} row${n === 1 ? "" : "s"} still say “not decided”. Answer them before completing.`,
    toastLogged: "Request logged", toastDecided: "Position recorded", toastClosed: "Request closed",
    ownerOnly: "Deciding is the owner's. Anyone with console access can log a request.",
  },
  ko: {
    title: "삭제 요청",
    intro: "본인의 데이터를 지워달라는 요청과, 이 기관이 보유 기록 종류별로 무엇을 하기로 했는지입니다.",
    newRequest: "요청 접수",
    empty: "이 프로젝트에 접수된 삭제 요청이 없습니다.",
    emptyHint: "누군가 자기를 지워달라고 하면 — 서면으로, 창구에서, 변호인을 통해 — 여기에 남기세요. 아래 범주는 제품의 기본 판단으로 채워지고, 열려 있는 두 질문은 누군가 답할 때까지 열린 채로 둡니다.",
    colSubject: "요청인", colFiled: "접수", colOpen: "미결", colStatus: "상태",
    status: { received: "처리 중", completed: "완료", refused: "거절됨" } as Record<string, string>,
    open: (n: number) => (n === 0 ? "없음" : `${n}건 미정`),
    openTab: "열기",
    formTitle: "삭제 요청 접수",
    fSubject: "요청인", fSubjectPh: "본인이 밝힌 이름",
    fReference: "신원 확인 방법", fReferencePh: "신분증, 사건번호, 등록부 항목",
    fNotes: "비고", fNotesPh: "남겨둘 만한 내용",
    save: "접수", cancel: "취소", close: "닫기",
    detailTitle: "기록 종류별로 무엇을 할 것인가",
    detailNote: "한 줄이라도 “미정”이면 완료로 닫을 수 없습니다. 일부러 그렇게 했습니다 — 답하지 않은 질문을 답한 것으로 닫으면 다시 찾을 수 없습니다.",
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
    setTo: "정하기",
    closeTitle: "이 요청을 닫습니다",
    closeNote: "처리 내용", closeNotePh: "무엇을 지웠고 무엇을 남겼는지, 본인에게 무엇을 알렸는지",
    complete: "완료로 표시", refuse: "거절",
    blocked: (n: number) => `아직 “미정”인 줄이 ${n}개 있습니다. 완료하기 전에 답해 주세요.`,
    toastLogged: "요청을 접수했습니다", toastDecided: "판단을 기록했습니다", toastClosed: "요청을 닫았습니다",
    ownerOnly: "판단은 최고관리자의 몫입니다. 접수는 콘솔을 쓰는 누구나 할 수 있습니다.",
  },
};

type Dict = typeof T.en;

const DISPO_TONE: Record<ErasureDisposition, { bg: string; fg: string }> = {
  erase: { bg: "var(--danger-100)", fg: "var(--danger-500)" },
  retain: { bg: "var(--info-100)", fg: "var(--info-500)" },
  undecided: { bg: "var(--warning-100)", fg: "var(--warning-500)" },
  "out-of-reach": { bg: "var(--gray-100)", fg: "var(--gray-600)" },
};

/** The three an institution can actually choose between. "out-of-reach" is a fact, not a choice. */
const CHOOSABLE: ErasureDisposition[] = ["erase", "retain", "undecided"];

const GRID = "1.3fr 0.9fr 0.8fr 0.8fr 80px";

export default function ProjectErasureTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit } = usePortalEditAccess();
  const portalUsers = useVcaStore(s => s.portalUsers);
  const requests = useVcaStore(s => s.erasureRequests);
  const addErasureRequest = useVcaStore(s => s.addErasureRequest);
  const setErasureDisposition = useVcaStore(s => s.setErasureDisposition);
  const closeErasureRequest = useVcaStore(s => s.closeErasureRequest);

  const me = currentPortalUser(portalUsers);
  const mayDecide = me ? canSetPolicy(me.permission) : true;

  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [closing, setClosing] = useState<ErasureRequest | null>(null);

  const rows = requests.filter(r => r.projectId === projectId);
  const opened = rows.find(r => r.id === openId) ?? null;
  const undecidedCount = (r: ErasureRequest) => Object.values(r.dispositions).filter(d => d === "undecided").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, maxWidth: "62ch", flex: 1, minWidth: "260px" }}>{t.intro}</p>
        {mayEdit && (
          <button className="portal-btn-primary" onClick={() => setShowForm(true)}
            style={{ flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.newRequest}
          </button>
        )}
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW }}>
        {rows.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.empty}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, marginTop: "6px", maxWidth: "58ch", marginInline: "auto" }}>{t.emptyHint}</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
              {[t.colSubject, t.colFiled, t.colOpen, t.colStatus, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
              ))}
            </div>
            {rows.map((r, i) => {
              const open = undecidedCount(r);
              return (
                <div key={r.id} style={{
                  display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "12px 16px",
                  alignItems: "center", borderBottom: i === rows.length - 1 ? "none" : BORDER,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subjectName}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subjectReference || "—"}</p>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{r.receivedAt.slice(0, 10)}</span>
                  <span style={{ fontSize: "12px", fontWeight: open > 0 ? 700 : 400, color: open > 0 ? "var(--warning-500)" : "var(--gray-500)" }}>
                    {t.open(open)}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--gray-700)" }}>{t.status[r.status]}</span>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="portal-btn-outline" onClick={() => setOpenId(r.id === openId ? null : r.id)}
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

      {opened && (
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginTop: "14px", padding: "18px 20px" }}>
          <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--gray-900)" }}>{t.detailTitle}</p>
          <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.65, marginTop: "6px", maxWidth: "68ch" }}>{t.detailNote}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0", marginTop: "14px" }}>
            {CATEGORIES.map((cat, i) => {
              const d = opened.dispositions[cat];
              const tone = DISPO_TONE[d];
              // Facts are not offered as choices. An exported copy and the recorder's storage are
              // outside this console whatever anybody decides, so those two rows show the position
              // without a control — pretending otherwise is the lie this screen is built to avoid.
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
                    {fixed || !mayDecide || opened.status !== "received" ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", backgroundColor: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
                        {t.dispo[d]}
                      </span>
                    ) : (
                      <FilterSelect value={d} onChange={v => { setErasureDisposition(opened.id, cat, v as ErasureDisposition); showToast({ variant: "success", title: t.toastDecided }); }}
                        options={CHOOSABLE.map(c => ({ value: c, label: t.dispo[c] }))} fitContent />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {mayDecide && opened.status === "received" && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: BORDER }}>
              {undecidedCount(opened) > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning-500)", lineHeight: 1.55, flex: 1, minWidth: "200px" }}>
                  {t.blocked(undecidedCount(opened))}
                </span>
              )}
              <button className="portal-btn-outline" onClick={() => setClosing(opened)}
                style={{ marginLeft: "auto", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {t.closeTitle}
              </button>
            </div>
          )}
        </div>
      )}

      {!mayDecide && rows.length > 0 && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "10px" }}>{t.ownerOnly}</p>
      )}

      {showForm && <IntakeForm t={t} projectId={projectId} onClose={() => setShowForm(false)}
        onSaved={id => { setShowForm(false); setOpenId(id); showToast({ variant: "success", title: t.toastLogged }); }}
        addErasureRequest={addErasureRequest} />}

      {closing && <CloseModal t={t} request={closing} onClose={() => setClosing(null)}
        onDone={(completed, note) => { closeErasureRequest(closing.id, completed, note); setClosing(null); showToast({ variant: "success", title: t.toastClosed }); }} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", color: "var(--gray-500)", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function IntakeForm({ t, projectId, onClose, onSaved, addErasureRequest }: {
  t: Dict; projectId: string; onClose: () => void; onSaved: (id: string) => void;
  addErasureRequest: (r: { projectId: string; subjectName: string; subjectReference: string; notes?: string }) => string;
}) {
  useEscapeKey(onClose);
  const [subjectName, setSubjectName] = useState("");
  const [subjectReference, setSubjectReference] = useState("");
  const [notes, setNotes] = useState("");
  const canSave = subjectName.trim() !== "" && subjectReference.trim() !== "";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "480px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.formTitle}</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <Field label={t.fSubject}><TextField value={subjectName} onChange={setSubjectName} placeholder={t.fSubjectPh} autoFocus /></Field>
          {/* Required. An erasure carried out for the wrong person is itself a data incident, and
              the console cannot verify identity — so the least it can do is refuse to record a
              request that does not say how it was verified. */}
          <Field label={t.fReference}><TextField value={subjectReference} onChange={setSubjectReference} placeholder={t.fReferencePh} /></Field>
          <Field label={t.fNotes}><TextField value={notes} onChange={setNotes} placeholder={t.fNotesPh} /></Field>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" disabled={!canSave}
            onClick={() => onSaved(addErasureRequest({ projectId, subjectName: subjectName.trim(), subjectReference: subjectReference.trim(), notes: notes.trim() || undefined }))}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
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
      body={undecided > 0 ? t.blocked(undecided) : t.detailNote}
      confirmLabel={t.complete}
      cancelLabel={t.cancel}
      confirmDisabled={!canComplete}
      onClose={onClose}
      onConfirm={() => onDone(true, note)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Field label={t.closeNote}><TextField value={note} onChange={setNote} placeholder={t.closeNotePh} autoFocus /></Field>
        {/* Refusing is always available: a request from somebody the institution cannot identify,
            or one it is legally obliged to decline, still needs an answer and a record of it. */}
        <button className="portal-btn-outline" disabled={!canRefuse} onClick={() => onDone(false, note)}
          style={{ alignSelf: "flex-start", height: "28px", padding: "0 12px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: canRefuse ? "var(--gray-700)" : "var(--gray-400)", fontSize: "11px", fontWeight: 700, cursor: canRefuse ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {t.refuse}
        </button>
      </div>
    </ConfirmModal>
  );
}

