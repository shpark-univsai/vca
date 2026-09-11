"use client";

import { useState } from "react";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { useVcaStore, canSetPolicy, currentPortalUser, type FootageRequest, type FootageRequestBasis } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import { BORDER, CARD_BORDER, CONTROL_HEIGHT, PANEL_SHADOW, SummaryStrip, TextField, FilterSelect, ConfirmModal, usePortalEditAccess } from "./PortalShared";
import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * The register of footage handed to people outside the institution.
 *
 * Three states and nothing clever: received → decided → released. The value is not the workflow,
 * it is that the row exists at all. A request arrives whether or not the product has a place for
 * it, and an operator with no place to put it plays the footage back and records the screen —
 * which releases the same video, with every passer-by's face in it, and leaves nothing anyone can
 * point at afterwards.
 *
 * THE CONSOLE DOES NOT REDACT. Obscuring the faces of people who are not the subject is video
 * processing; a browser cannot do it. The release form asks whether it was done and by what, and
 * stores the answer as the releaser's statement — see FootageRequest.redaction. A checkbox that
 * implied this screen had blurred anything would be the most dangerous control in Portal.
 */

const T = {
  en: {
    title: "Footage requests",
    intro: "Requests from outside this institution for recorded video, and what was decided. A release is recorded here whether or not it was granted.",
    newRequest: "Log a request",
    statReceived: "Awaiting a decision", statReceivedWhy: "Filed, not yet approved or refused.",
    statApproved: "Approved, not released", statApprovedWhy: "Decided yes. The file has not left yet.",
    statReleased: "Released", statReleasedWhy: "Video handed over. The row is the record of it.",
    unit: "request", units: "requests",
    empty: "No request has been filed for this project.",
    emptyHint: "When somebody outside the institution asks for recorded video — a case officer, an insurer, a lawyer, or the person who was recorded — log it here before anything is handed over.",
    colRequester: "Requester", colBasis: "Basis", colWindow: "Requested footage", colStatus: "Status", colDecision: "Decision",
    basis: {
      warrant: "Warrant / court order",
      "police-request": "Police request",
      "data-subject": "The recorded person",
      insurance: "Insurance",
      other: "Other",
    } as Record<FootageRequestBasis, string>,
    status: { received: "Awaiting decision", approved: "Approved", refused: "Refused", released: "Released" } as Record<string, string>,
    decide: "Decide", release: "Record release", view: "Open",
    // Intake form
    formTitle: "Log a footage request",
    fRequester: "Requester", fRequesterPh: "Name of the person asking",
    fOrg: "Organisation", fOrgPh: "Force, firm, insurer — or blank if they are the recorded person",
    fBasis: "Basis",
    fReference: "Reference", fReferencePh: "Case, warrant or document number",
    fReferenceNote: "Required for every basis except a request from the recorded person themselves.",
    fFrom: "From", fTo: "To", fWindowNote: "In this project's time zone, which is the site's own clock.",
    fCameras: "Cameras or place", fCamerasPh: "As the requester described it",
    fPurpose: "Stated purpose", fPurposePh: "In the requester's words",
    save: "Log it", cancel: "Cancel",
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
    notRedacted: "not redacted",
    wasRedacted: "redacted",
    rMethodRedaction: "By what", rMethodRedactionPh: "Tool or person who did it",
    rRedactionNote: "This console does not redact. What you record here is your statement about work done elsewhere, and it is written to the activity log as such.",
    rConfirm: "Record it",
    toastLogged: "Request logged", toastDecided: "Decision recorded", toastReleased: "Release recorded",
    ownerOnly: "Deciding and releasing are the owner's. Anyone with console access can log a request.",
  },
  ko: {
    title: "영상 제공 요청",
    intro: "기관 밖에서 녹화 영상을 요구한 건과 그 결정입니다. 내줬든 거절했든 여기에 남습니다.",
    newRequest: "요청 접수",
    statReceived: "결정 대기", statReceivedWhy: "접수됐고 아직 승인도 거절도 되지 않았습니다.",
    statApproved: "승인됨 · 미제공", statApprovedWhy: "내주기로 했지만 아직 나가지 않았습니다.",
    statReleased: "제공됨", statReleasedWhy: "영상이 나갔고, 이 줄이 그 기록입니다.",
    unit: "건", units: "건",
    empty: "이 프로젝트에 접수된 요청이 없습니다.",
    emptyHint: "기관 밖에서 녹화 영상을 요구하면 — 수사관, 보험사, 변호인, 또는 찍힌 본인 — 무엇이든 내주기 전에 여기에 먼저 남기세요.",
    colRequester: "요청인", colBasis: "근거", colWindow: "요청 구간", colStatus: "상태", colDecision: "결정",
    basis: {
      warrant: "영장 / 법원 명령",
      "police-request": "수사기관 협조 요청",
      "data-subject": "찍힌 본인",
      insurance: "보험",
      other: "기타",
    } as Record<FootageRequestBasis, string>,
    status: { received: "결정 대기", approved: "승인됨", refused: "거절됨", released: "제공됨" } as Record<string, string>,
    decide: "결정하기", release: "제공 기록", view: "열기",
    formTitle: "영상 제공 요청 접수",
    fRequester: "요청인", fRequesterPh: "요구하는 사람의 이름",
    fOrg: "소속", fOrgPh: "기관·법인·보험사 — 찍힌 본인이면 비워두세요",
    fBasis: "근거",
    fReference: "문서번호", fReferencePh: "사건번호·영장번호·공문번호",
    fReferenceNote: "찍힌 본인의 요청을 제외한 모든 근거에 필요합니다.",
    fFrom: "시작", fTo: "종료", fWindowNote: "이 프로젝트의 시간대, 즉 현장의 시계 기준입니다.",
    fCameras: "카메라 또는 장소", fCamerasPh: "요청인이 말한 그대로",
    fPurpose: "요청 사유", fPurposePh: "요청인의 표현 그대로",
    save: "접수", cancel: "취소",
    decideTitle: "이 요청을 결정합니다",
    decideNote: "사유", decideNotePh: "왜 내주는지, 또는 왜 거절하는지",
    decideNoteHint: "승인에도 필요합니다. 사유 없는 승인은 나중에 아무도 방어할 수 없는 결정입니다.",
    approve: "승인", refuse: "거절",
    releaseTitle: "제공 기록",
    rMethod: "전달 방법", rMethodPh: "암호화 매체 직접 수령, 보안 전송, …",
    rTo: "수령인", rToPh: "요청인과 다른 사람이면",
    rRedacted: "제공 전 제3자 얼굴을 가렸습니다",
    notRedacted: "비식별 안 함",
    wasRedacted: "비식별함",
    rMethodRedaction: "무엇으로", rMethodRedactionPh: "사용한 도구 또는 수행자",
    rRedactionNote: "이 콘솔은 비식별 처리를 하지 않습니다. 여기 적는 것은 다른 곳에서 한 작업에 대한 본인의 진술이고, 변경 기록에도 그렇게 남습니다.",
    rConfirm: "기록",
    toastLogged: "요청을 접수했습니다", toastDecided: "결정을 기록했습니다", toastReleased: "제공을 기록했습니다",
    ownerOnly: "결정과 제공 기록은 최고관리자의 몫입니다. 접수는 콘솔을 쓰는 누구나 할 수 있습니다.",
  },
};

type Dict = typeof T.en;

const BASES: FootageRequestBasis[] = ["warrant", "police-request", "data-subject", "insurance", "other"];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  received: { bg: "var(--warning-100)", fg: "var(--warning-500)" },
  approved: { bg: "var(--info-100)", fg: "var(--info-500)" },
  refused: { bg: "var(--gray-100)", fg: "var(--gray-600)" },
  released: { bg: "var(--success-100)", fg: "var(--success-400)" },
};

const GRID = "1.2fr 1fr 1.3fr 0.8fr 100px";

export default function ProjectFootageRequestsTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit } = usePortalEditAccess();
  const portalUsers = useVcaStore(s => s.portalUsers);
  const requests = useVcaStore(s => s.footageRequests);
  const addFootageRequest = useVcaStore(s => s.addFootageRequest);
  const decideFootageRequest = useVcaStore(s => s.decideFootageRequest);
  const releaseFootageRequest = useVcaStore(s => s.releaseFootageRequest);

  const me = currentPortalUser(portalUsers);
  // Owner only, like the other institution-level policies. Logging is not gated: the person who
  // takes the phone call is rarely the person who decides, and a request nobody could write down
  // until the owner logged in is a request that gets handled off the record.
  const mayDecide = me ? canSetPolicy(me.permission) : true;

  const [showForm, setShowForm] = useState(false);
  const [deciding, setDeciding] = useState<FootageRequest | null>(null);
  const [releasing, setReleasing] = useState<FootageRequest | null>(null);

  const rows = requests.filter(r => r.projectId === projectId);
  const countOf = (status: string) => rows.filter(r => r.status === status).length;

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

      {/* Only the states that exist, the same rule the Users strip follows: "0 released" is a
          column spent on nothing having happened. */}
      <SummaryStrip cells={[
        { key: "received", count: countOf("received"), label: t.statReceived, why: t.statReceivedWhy, icon: <ShieldAlert size={14} strokeWidth={2.4} /> },
        { key: "approved", count: countOf("approved"), label: t.statApproved, why: t.statApprovedWhy, icon: <FileCheck2 size={14} strokeWidth={2.4} /> },
        { key: "released", count: countOf("released"), label: t.statReleased, why: t.statReleasedWhy, icon: <FileCheck2 size={14} strokeWidth={2.4} /> },
      ].filter(c => c.count > 0).map(c => ({
        key: c.key, icon: c.icon, figure: c.count,
        unit: c.count === 1 ? t.unit : t.units,
        label: c.label, explanation: c.why,
        tone: c.key === "received" ? ("warning" as const) : ("neutral" as const),
      }))} />

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: "12px", boxShadow: PANEL_SHADOW, marginTop: "14px" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{t.empty}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7, marginTop: "6px", maxWidth: "56ch", marginInline: "auto" }}>{t.emptyHint}</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: BORDER, borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
              {[t.colRequester, t.colBasis, t.colWindow, t.colStatus, ""].map((h, i) => (
                <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)" }}>{h}</span>
              ))}
            </div>
            {rows.map((r, i) => {
              const tone = STATUS_TONE[r.status];
              return (
                <div key={r.id} style={{
                  display: "grid", gridTemplateColumns: GRID, columnGap: "12px", padding: "12px 16px",
                  alignItems: "center", borderBottom: i === rows.length - 1 ? "none" : BORDER,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.requesterName}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.requesterOrg || "—"}</p>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "12px", color: "var(--gray-900)" }}>{t.basis[r.basis]}</p>
                    {r.reference && <p style={{ fontSize: "11px", color: "var(--gray-500)", fontFamily: "monospace" }}>{r.reference}</p>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "12px", color: "var(--gray-900)" }}>{r.fromAt} → {r.toAt}</p>
                    <p style={{ fontSize: "11px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cameraNote || "—"}</p>
                  </div>
                  <div>
                    <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", backgroundColor: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
                      {t.status[r.status]}
                    </span>
                    {/* The redaction answer, on the row that released something. It is the first
                        thing anybody reviewing this register looks for, so it does not live one
                        click away. */}
                    {r.status === "released" && (
                      <p style={{ fontSize: "10px", color: r.redaction?.done ? "var(--gray-500)" : "var(--warning-500)", marginTop: "3px" }}>
                        {r.redaction?.done ? t.wasRedacted : t.notRedacted}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {mayDecide && r.status === "received" && (
                      <button className="portal-btn-outline" onClick={() => setDeciding(r)}
                        style={{ height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t.decide}
                      </button>
                    )}
                    {mayDecide && r.status === "approved" && (
                      <button className="portal-btn-outline" onClick={() => setReleasing(r)}
                        style={{ height: "26px", padding: "0 10px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t.release}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {!mayDecide && rows.length > 0 && (
        <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.6, marginTop: "10px" }}>{t.ownerOnly}</p>
      )}

      {showForm && <IntakeForm t={t} projectId={projectId} onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); showToast({ variant: "success", title: t.toastLogged }); }}
        addFootageRequest={addFootageRequest} />}

      {deciding && <DecisionModal t={t} request={deciding} onClose={() => setDeciding(null)}
        onDecide={(approved, note) => { decideFootageRequest(deciding.id, approved, note); setDeciding(null); showToast({ variant: "success", title: t.toastDecided }); }} />}

      {releasing && <ReleaseModal t={t} onClose={() => setReleasing(null)}
        onRelease={rel => { releaseFootageRequest(releasing.id, rel); setReleasing(null); showToast({ variant: "success", title: t.toastReleased }); }} />}
    </div>
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

function IntakeForm({ t, projectId, onClose, onSaved, addFootageRequest }: {
  t: Dict; projectId: string; onClose: () => void; onSaved: () => void;
  addFootageRequest: (r: Omit<FootageRequest, "id" | "status" | "receivedAt" | "receivedBy">) => string;
}) {
  useEscapeKey(onClose);
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
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "520px", width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.formTitle}</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", minHeight: 0 }}>
          <Field label={t.fRequester}><TextField value={requesterName} onChange={setRequesterName} placeholder={t.fRequesterPh} autoFocus /></Field>
          <Field label={t.fOrg}><TextField value={requesterOrg} onChange={setRequesterOrg} placeholder={t.fOrgPh} /></Field>
          <Field label={t.fBasis}>
            <FilterSelect value={basis} onChange={v => setBasis(v as FootageRequestBasis)}
              options={BASES.map(b => ({ value: b, label: t.basis[b] }))} fitContent />
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
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" disabled={!canSave}
            onClick={() => {
              addFootageRequest({
                projectId, requesterName: requesterName.trim(), requesterOrg: requesterOrg.trim(),
                basis, reference: reference.trim() || undefined,
                fromAt: fromAt.trim(), toAt: toAt.trim(),
                cameraNote: cameraNote.trim(), purpose: purpose.trim(),
              });
              onSaved();
            }}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionModal({ t, request, onClose, onDecide }: {
  t: Dict; request: FootageRequest; onClose: () => void; onDecide: (approved: boolean, note: string) => void;
}) {
  useEscapeKey(onClose);
  const [note, setNote] = useState("");
  const canDecide = note.trim() !== "";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14,22,42,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "460px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 4px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.decideTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "6px", lineHeight: 1.6 }}>
            {request.requesterName}{request.requesterOrg ? ` · ${request.requesterOrg}` : ""} — {t.basis[request.basis]}
            {request.reference ? ` · ${request.reference}` : ""}
          </p>
          <p style={{ fontSize: "12px", color: "var(--gray-600)", marginTop: "8px", lineHeight: 1.7 }}>{request.purpose}</p>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <Field label={t.decideNote} hint={t.decideNoteHint}>
            <TextField value={note} onChange={setNote} placeholder={t.decideNotePh} autoFocus />
          </Field>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-outline-danger" disabled={!canDecide} onClick={() => onDecide(false, note)}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: canDecide ? "var(--gray-700)" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canDecide ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.refuse}
          </button>
          <button className="portal-btn-primary" disabled={!canDecide} onClick={() => onDecide(true, note)}
            style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: canDecide ? "var(--primary-400)" : "var(--gray-200)", color: canDecide ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canDecide ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {t.approve}
          </button>
        </div>
      </div>
    </div>
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
  const canRecord = method.trim() !== "" && (!redacted || redactionMethod.trim() !== "");

  return (
    <ConfirmModal
      title={t.releaseTitle}
      body={t.rRedactionNote}
      confirmLabel={t.rConfirm}
      cancelLabel={t.cancel}
      confirmDisabled={!canRecord}
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
        {/* Unchecked by default, and it stays a claim either way. Defaulting it to true would put
            the institution's signature on work nobody confirmed happened. */}
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
