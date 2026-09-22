"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useVcaStore } from "@/lib/vcaStore";
import { REGISTRATION_CODE_TTL_DAYS, formatCode, type RosterEntry, type RosterCodeStatus } from "@/lib/staffRoster";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useToast } from "../Toast";
import { TextField, FIELD_STYLE, BORDER, Drawer } from "./PortalShared";

const T = {
  en: {
    statusNotIssued: "Not issued",
    statusIssued: "Issued",
    statusUsed: "Used",
    statusExpired: "Expired",
    reissueTitle: "Reissue registration code?",
    issueTitle: "Issue registration code?",
    reissueBody: (name: string) => `${name}'s current code stops working immediately.`,
    issueBody: (name: string) => `A new registration code will be generated for ${name}.`,
    codeExpiryNote: (days: number) => `The new code expires in ${days} days.`,
    cancel: "Cancel",
    reissueConfirm: "Reissue code",
    issueConfirm: "Issue code",
    removeTitle: (name: string) => `Remove ${name} from the roster?`,
    removeBodyWithCode: "Their unused registration code is removed with them and can no longer be used to sign up.",
    removeBodyNoCode: "This only removes the roster row — it does not affect an account that already signed up.",
    remove: "Remove",
    handoutPreviewTitle: "Code slips",
    handoutSlipCount: (n: number) => `${n} slip(s) — cut along the dashed lines.`,
    close: "Close",
    print: "Print",
    handoutInstruction: "Go to the registration page and enter this code to set up your account.",
    filterAllStatuses: "All statuses",
    pageTitle: "Staff Roster",
    pageDesc: "Issue registration codes for offline sign-up — no mail required. See who hasn't joined yet.",
    importRoster: "Import CSV",
    addPerson: "Add person",
    editEntry: "Edit",
    modalAddTitle: "Add to roster",
    modalEditTitle: "Edit roster entry",
    fieldName: "Name",
    fieldNamePlaceholder: "Full name",
    fieldEmployeeId: "Employee number",
    fieldEmployeeIdPlaceholder: "EMP-3021",
    fieldEmployeeIdLocked: "Cannot be changed — remove and add again instead.",
    fieldDepartment: "Department",
    fieldDepartmentPlaceholder: "Control Room",
    fieldEmail: "Email",
    fieldEmailOptional: "Optional",
    fieldEmailPlaceholder: "Leave empty where there is no mail",
    fieldPermission: "Permission",
    duplicateId: "That employee number is already on a roster.",
    save: "Save",
    addNote: "Adding someone here does not give them a way in — issue their code afterwards.",
    toastAddedTitle: "Added to roster",
    toastUpdatedTitle: "Roster entry updated",
    exportCsv: "Export CSV",
    printHandout: "Print code slips",
    issueCodesTo: (n: number) => `Issue codes to ${n} unassigned`,
    emptyAll: "No staff in this project's roster yet.",
    emptyFiltered: "No staff match this filter.",
    colName: "Name",
    colEmployeeId: "Employee ID",
    colDepartment: "Department",
    colPermission: "Permission",
    colStatus: "Status",
    colCode: "Code",
    codeReveal: "Show the code",
    codeHide: "Hide the code again",
    admin: "Portal admin",
    operator: "App user",
    // The two roster options mint two very different accounts (see activateRosterEntry), and
    // "Operator" said nothing about which. The hint under each button is the Access value the
    // account actually comes out with, in the same words the Users table uses.
    accessBoth: "Portal + App",
    accessAppOnly: "App only",
    adminHint: "Access: Portal + App",
    operatorHint: "Access: the app only",
    reissueCodeAction: "Reissue code",
    issueCodeAction: "Issue code",
    removeFromRoster: "Remove from roster",
    toastCodesIssuedTitle: "Codes issued",
    toastCodesIssuedDesc: (n: number) => `${n} registration code(s) issued.`,
    toastCodeReissuedTitle: "Code reissued",
    toastCodeReissuedDesc: (name: string) => `${name}'s previous code is no longer valid.`,
    toastCodeIssuedTitle: "Code issued",
    toastRemovedTitle: "Removed from roster",
    toastExportTitle: "Export complete",
    toastExportDesc: (n: number) => `${n} row(s) exported to CSV.`,
    csvHeaderName: "Name",
    csvHeaderEmployeeId: "Employee ID",
    csvHeaderDepartment: "Department",
    csvHeaderEmail: "Email",
    csvHeaderPermission: "Permission",
    csvHeaderStatus: "Status",
    csvHeaderCode: "Code",
  },
  ko: {
    statusNotIssued: "미발급",
    statusIssued: "발급됨",
    statusUsed: "사용됨",
    statusExpired: "만료됨",
    reissueTitle: "등록 코드를 재발급하시겠습니까?",
    issueTitle: "등록 코드를 발급하시겠습니까?",
    /* 두 문장을 하나로 (사용자: 너무 길어 · 핵심만). 「이전 출력물을 가진 사람은 새 코드가
       필요합니다」는 앞 문장의 결과를 되풀이한 것이고, 코드가 무효라는 말이 이미 그 뜻이다. */
    reissueBody: (name: string) => `${name}님의 지금 코드는 즉시 무효가 됩니다.`,
    issueBody: (name: string) => `${name}님을 위한 새 등록 코드가 생성됩니다.`,
    /* 「사용 여부와 관계없이」와 「출력물에 날짜를 적어 두세요」를 뺐다 — 앞은 만료의 정의이고
       뒤는 이 창이 묻는 결정과 무관한 조언이다. */
    codeExpiryNote: (days: number) => `새 코드는 ${days}일 후 만료됩니다.`,
    cancel: "취소",
    reissueConfirm: "코드 재발급",
    issueConfirm: "코드 발급",
    removeTitle: (name: string) => `${name}님을 명부에서 삭제하시겠습니까?`,
    removeBodyWithCode: "미사용 등록 코드도 함께 삭제되며, 더 이상 가입에 사용할 수 없습니다.",
    removeBodyNoCode: "명부 항목만 삭제되며, 이미 가입된 계정에는 영향을 주지 않습니다.",
    remove: "삭제",
    handoutPreviewTitle: "코드 슬립",
    handoutSlipCount: (n: number) => `${n}장 — 점선을 따라 잘라주세요.`,
    close: "닫기",
    print: "인쇄",
    handoutInstruction: "등록 페이지로 이동하여 이 코드를 입력하면 계정을 설정할 수 있습니다.",
    filterAllStatuses: "전체 상태",
    pageTitle: "직원 명부",
    pageDesc: "메일 없이 오프라인 가입을 위한 등록 코드를 발급합니다. 아직 가입하지 않은 직원을 확인하세요.",
    importRoster: "CSV 가져오기",
    addPerson: "사람 추가",
    editEntry: "편집",
    modalAddTitle: "명부에 추가",
    modalEditTitle: "명부 수정",
    fieldName: "이름",
    fieldNamePlaceholder: "전체 이름",
    fieldEmployeeId: "사번",
    fieldEmployeeIdPlaceholder: "EMP-3021",
    fieldEmployeeIdLocked: "사번은 바꿀 수 없습니다 — 지우고 다시 추가하세요.",
    fieldDepartment: "부서",
    fieldDepartmentPlaceholder: "관제실",
    fieldEmail: "이메일",
    fieldEmailOptional: "선택",
    fieldEmailPlaceholder: "메일이 없는 곳은 비워 두세요",
    fieldPermission: "권한",
    duplicateId: "이미 명부에 있는 사번입니다.",
    save: "저장",
    addNote: "여기에 추가한다고 들어올 수 있게 되지는 않습니다 — 코드는 그다음에 발급합니다.",
    // 토스트 제목은 한 어미로. 이 파일의 제목들이 "…했습니다" · "…완료" · "…됨" 세 갈래였고,
    // 그중 셋(코드 발급·재발급·명부 삭제)은 사용자 화면의 같은 행 메뉴에서 잇달아 뜹니다. 제품이
    // 쓰는 짧은 "됨"에 맞춥니다 — 카메라 탭 "카메라 추가됨", 서버 탭 "서버 추가됨"과 같은 형태.
    // 단서를 단 문장은 어미를 바꾸지 않습니다(toastCodeReissuedDesc).
    toastAddedTitle: "명부에 추가됨",
    toastUpdatedTitle: "명부 항목 수정됨",
    exportCsv: "CSV 내보내기",
    printHandout: "코드 슬립 인쇄",
    issueCodesTo: (n: number) => `미발급 ${n}명에게 코드 발급`,
    emptyAll: "이 프로젝트의 명부에 등록된 직원이 없습니다.",
    emptyFiltered: "이 필터와 일치하는 직원이 없습니다.",
    colName: "이름",
    colEmployeeId: "사번",
    colDepartment: "부서",
    colPermission: "권한",
    colStatus: "상태",
    colCode: "코드",
    codeReveal: "코드 보기",
    codeHide: "코드 다시 가리기",
    admin: "Portal 관리자",
    operator: "앱 사용자",
    accessBoth: "Portal + 앱",
    accessAppOnly: "앱만",
    adminHint: "접근: Portal + 앱",
    operatorHint: "접근: 앱만",
    reissueCodeAction: "코드 재발급",
    issueCodeAction: "코드 발급",
    removeFromRoster: "명부에서 삭제",
    toastCodesIssuedTitle: "코드 발급됨",
    toastCodesIssuedDesc: (n: number) => `등록 코드 ${n}개 발급됨`,
    toastCodeReissuedTitle: "코드 재발급됨",
    // 제목과 달리 이 줄은 결과가 아니라 단서입니다 — 이전 코드를 들고 있는 사람이 못 들어온다는
    // 사실을 알려야 하므로 문장 그대로 둡니다.
    toastCodeReissuedDesc: (name: string) => `${name}님의 이전 코드는 더 이상 사용할 수 없습니다.`,
    toastCodeIssuedTitle: "코드 발급됨",
    toastRemovedTitle: "명부에서 삭제됨",
    toastExportTitle: "내보내기 완료",
    toastExportDesc: (n: number) => `${n}개 행이 CSV로 내보내졌습니다.`,
    csvHeaderName: "이름",
    csvHeaderEmployeeId: "사번",
    csvHeaderDepartment: "부서",
    csvHeaderEmail: "이메일",
    csvHeaderPermission: "권한",
    csvHeaderStatus: "상태",
    csvHeaderCode: "코드",
  },
} as const;

// Both branches of T carry identical keys with only the literal string values differing between
// languages, so `T[lang]` widens to a union of the two — components take that union rather than
// pinning to the "en" branch specifically, or TS rejects passing a "ko"-selected value in.
type Translations = (typeof T)["en"] | (typeof T)["ko"];

// "Issued" is shown to admins for what the type calls "unused" — from an admin's point of view the
// interesting fact is "I handed this out, nobody's used it yet," not the code's own internal state.
//
// Two of these four tones were off the Portal's chip scale, and both errors pushed colour at rows
// that do not need it.
//
// "Issued" was the only chip in the console on a -200 background; every other chip — STATE_TONE in
// the requests tab, TYPE_META in PortalShared, the VIP category tones — fills with the -100 step and
// writes in the -400/-500 one. On a site that has just been set up, "code handed out, not used yet"
// is almost every row, so the one chip mixed a step darker than the rest was making the table's
// most ordinary state its loudest thing. That is the mistake the VIP registry already wrote down:
// an amber pill on 119 of 123 rows was not a warning, it was the table's background.
//
// "Used" mixed families outright — a grey fill under green text, which nothing else in Portal does.
// Of the two ways to settle it, neutral is the right one rather than success-100/-400: a code that
// has been used is finished, not an achievement, and it is the one status on this screen that will
// never need an administrator again. The camera table reached the same conclusion for the same
// reason — four states, only the two that want attention coloured, "Online" left in plain grey.
// gray-600 rather than "not-issued"'s gray-500 keeps the two quiet states apart in a scan and
// matches what the requests tab gives its own terminal state, `closed`.
function getStatusMeta(t: Translations): Record<RosterCodeStatus, { label: string; bg: string; color: string }> {
  return {
    "not-issued": { label: t.statusNotIssued, bg: "var(--gray-100)", color: "var(--gray-500)" },
    unused: { label: t.statusIssued, bg: "var(--warning-100)", color: "var(--warning-500)" },
    used: { label: t.statusUsed, bg: "var(--gray-100)", color: "var(--gray-600)" },
    expired: { label: t.statusExpired, bg: "var(--danger-100)", color: "var(--danger-500)" },
  };
}

function StatusBadge({ status, meta }: { status: RosterCodeStatus; meta: Record<RosterCodeStatus, { label: string; bg: string; color: string }> }) {
  const m = meta[status];
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, padding: "4px 8px", borderRadius: "999px", backgroundColor: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/*
 * Masked until clicked, and clicking is what's worth an audit trail — an admin who can see a still-
 * live code is an admin who can hand it to the wrong person. Used/expired codes never get a reveal
 * control at all: they're dead values, so there's nothing left to protect or show (see PROMPT's
 * "사용된 코드는 영구히 숨긴다" — extended here to expired for the same reason, not just used).
 *
 * AND IT GOES BACK (owner, 2026-09-21: 코드가 가려졌다가 다시보이고 다시 가릴수있게 해줘). Reveal
 * used to be one-way, so a code read once stayed on screen for the rest of the session — on a
 * shared control-room display that is the opposite of masking it in the first place. The same
 * button hides it again, and the audit line is written on each REVEAL only: every look is a look,
 * and putting it away is not one.
 */
function RosterCodeCell({ entry, onReveal, t }: { entry: RosterEntry; onReveal: () => void; t: Translations }) {
  const [revealed, setRevealed] = useState(false);

  if (entry.status === "not-issued") {
    return <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>;
  }
  if (entry.status !== "unused") {
    return <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--gray-300)" }}>••••-••••</span>;
  }
  /* One button in both states, so the row does not change height or shift when it flips and the
     control stays under the same pointer. Lucide's pair, like the password fields' show/hide
     toggle — this is the same "reveal a hidden value" affordance. */
  return (
    <button
      onClick={() => {
        if (revealed) { setRevealed(false); return; }
        setRevealed(true);
        onReveal();
      }}
      title={revealed ? t.codeHide : t.codeReveal}
      aria-label={revealed ? t.codeHide : t.codeReveal}
      aria-pressed={revealed}
      style={{ display: "flex", alignItems: "center", gap: "6px", border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: "monospace", fontSize: "12px", fontWeight: revealed ? 700 : 600, color: revealed ? "var(--gray-900)" : "var(--gray-500)" }}
    >
      {revealed ? formatCode(entry.code ?? "") : "••••-••••"}
      {/* THE ICON SHOWS THE STATE, NOT THE ACTION — the way this product's own password fields do
          it (mypage and register both render `shown ? Eye : EyeOff`, four places). It was the
          other way round here and read as backwards, which it was: with the code on screen beside
          a crossed-out eye, the cell said "hidden" and showed the value. The button's aria-label
          still says what pressing it DOES, because that is what a label is for. */}
      <span style={{ display: "flex", color: "var(--gray-400)" }}>
        {revealed ? <Eye size={14} strokeWidth={2.4} /> : <EyeOff size={14} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

/**
 * Add or edit one roster row.
 *
 * The roster is a shortcut for setting many people up at once, not the only way in — so a person
 * can be entered here by hand, one at a time, and the Excel import is what saves repeating it.
 * Everything the import would carry is on this form: name, employee number, department, an optional
 * address, and the role the account will get when they register.
 *
 * The employee number is the roster's matching key (a code resolves to exactly one row), so it can
 * be typed when adding and is read-only afterwards — silently rewriting it would point an already
 * printed code at a different person.
 */
function RosterEntryModal({ entry, projectId, onClose, t }: {
  entry: RosterEntry | null;
  projectId: string;
  onClose: () => void;
  t: Translations;
}) {
  const addRosterEntry = useVcaStore(s => s.addRosterEntry);
  const updateRosterEntry = useVcaStore(s => s.updateRosterEntry);
  const { showToast } = useToast();
  const editing = !!entry;

  const [name, setName] = useState(entry?.name ?? "");
  const [employeeId, setEmployeeId] = useState(entry?.employeeId ?? "");
  const [department, setDepartment] = useState(entry?.department ?? "");
  const [email, setEmail] = useState(entry?.email ?? "");
  const [permission, setPermission] = useState<"admin" | "operator">(entry?.permission ?? "operator");
  const [duplicate, setDuplicate] = useState(false);

  const canSubmit = name.trim().length > 0 && employeeId.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      updateRosterEntry(entry.employeeId, {
        name: name.trim(),
        department: department.trim() || undefined,
        email: email.trim() || undefined,
        permission,
      });
      showToast({ variant: "success", title: t.toastUpdatedTitle, desc: name.trim() });
      onClose();
      return;
    }
    const ok = addRosterEntry({
      name: name.trim(),
      employeeId: employeeId.trim(),
      department: department.trim() || undefined,
      email: email.trim() || undefined,
      projectId,
      permission,
    });
    if (!ok) { setDuplicate(true); return; }
    showToast({ variant: "success", title: t.toastAddedTitle, desc: `${name.trim()} (${employeeId.trim()})` });
    onClose();
  };

  const label = (text: string, hint?: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "6px" }}>
      {text}
      {hint && <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)" }}>{hint}</span>}
    </label>
  );
  const inputStyle = FIELD_STYLE;

  return (
    <Drawer
      title={editing ? t.modalEditTitle : t.modalAddTitle}
      onClose={onClose}
      width="520px"
      footer={
        <>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={submit} disabled={!canSubmit}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: canSubmit ? "var(--primary-400)" : "var(--gray-200)", color: canSubmit ? "white" : "var(--gray-400)",
              fontSize: "13px", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
            {t.save}
          </button>
        </>
      }
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          {label(t.fieldName)}
          <TextField value={name} onChange={setName} placeholder={t.fieldNamePlaceholder} autoFocus />
        </div>
        <div>
          {label(t.fieldEmployeeId)}
          <input
            value={employeeId}
            onChange={e => { setEmployeeId(e.target.value); setDuplicate(false); }}
            placeholder={t.fieldEmployeeIdPlaceholder}
            disabled={editing}
            style={{ ...inputStyle, backgroundColor: editing ? "var(--gray-50)" : "white", color: editing ? "var(--gray-500)" : "var(--gray-900)" }}
          />
          {editing && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--gray-400)" }}>{t.fieldEmployeeIdLocked}</p>}
          {duplicate && <p style={{ margin: "6px 0 0", fontSize: "11px", fontWeight: 700, color: "var(--danger-400)" }}>{t.duplicateId}</p>}
        </div>
        <div>
          {label(t.fieldDepartment, t.fieldEmailOptional)}
          <TextField value={department} onChange={setDepartment} placeholder={t.fieldDepartmentPlaceholder} />
        </div>
        <div>
          {label(t.fieldEmail, t.fieldEmailOptional)}
          <TextField value={email} onChange={setEmail} placeholder={t.fieldEmailPlaceholder} />
        </div>
        <div>
          {label(t.fieldPermission)}
          {/* Two buttons rather than a select: the answer is one of two and both fit on screen.
              Each carries the access it grants under the name — this is the one screen where the
              choice is made on paper terms and read back weeks later off a printed slip. */}
          <div style={{ display: "flex", gap: "8px" }}>
            {(["operator", "admin"] as const).map(p => {
              const active = permission === p;
              return (
                <button key={p} onClick={() => setPermission(p)}
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                    border: active ? "1px solid var(--gray-900)" : BORDER,
                    backgroundColor: active ? "var(--gray-100)" : "white",
                    color: active ? "var(--gray-900)" : "var(--gray-600)",
                    fontSize: "13px", fontWeight: 700,
                  }}>
                  {p === "admin" ? t.admin : t.operator}
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: active ? "var(--gray-600)" : "var(--gray-500)", marginTop: "3px" }}>
                    {p === "admin" ? t.adminHint : t.operatorHint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {!editing && <p style={{ margin: 0, fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45 }}>{t.addNote}</p>}
      </div>
    </Drawer>
  );
}

function IssueConfirmModal({
  entry, onClose, onConfirm, t,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
  t: Translations;
}) {
  useEscapeKey(onClose);
  const hasCode = !!entry.code;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>
            {hasCode ? t.reissueTitle : t.issueTitle}
          </p>
          {/* THE TWO LINES ARE ONE ANSWER, THE TITLE IS THE QUESTION (owner: 이 두줄 사이간격
              좁혀주고 그위에 질문에서부터는 더 떨어트려줘). At 8px under the title and 6px between
              themselves they read as three evenly spaced lines — a list, which is not what this
              is. 14px away from the question and 3px apart makes the pair one block: what this
              costs, in two facts.
              The second line is said before the code exists, not after: the administrator is
              about to print it and hand it over, and the deadline is only useful while they
              still have the paper. */}
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "14px", lineHeight: 1.5 }}>
            {hasCode ? t.reissueBody(entry.name) : t.issueBody(entry.name)}
          </p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "3px", lineHeight: 1.5 }}>
            {t.codeExpiryNote(REGISTRATION_CODE_TTL_DAYS)}
          </p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-primary" onClick={onConfirm}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {hasCode ? t.reissueConfirm : t.issueConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({
  entry, onClose, onConfirm, t,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onConfirm: () => void;
  t: Translations;
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "400px", width: "100%", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.removeTitle(entry.name)}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px", lineHeight: 1.5 }}>
            {entry.code && entry.status === "unused" ? t.removeBodyWithCode : t.removeBodyNoCode}
          </p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button className="portal-btn-danger" onClick={onConfirm}
            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.remove}
          </button>
        </div>
      </div>
    </div>
  );
}

// Print-only handout sheet — the actual deliverable of this screen. The `visibility` flip (rather
// than `display:none` on everything else) is the standard trick for "print just this one subtree
// regardless of what else the page layout is" — it works without this component needing to know
// anything about PortalShell's chrome outside it.
function PrintSheet({ entries, projectName, onClose, t }: { entries: RosterEntry[]; projectName: string; onClose: () => void; t: Translations }) {
  useEscapeKey(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "white", zIndex: 500, overflowY: "auto" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #roster-print-sheet, #roster-print-sheet * { visibility: visible; }
          #roster-print-sheet { position: absolute; top: 0; left: 0; width: 100%; }
          .roster-print-toolbar { display: none; }
          .roster-print-slip { break-inside: avoid; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>
      <div className="roster-print-toolbar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px",
        borderBottom: BORDER, position: "sticky", top: 0, backgroundColor: "white", zIndex: 1,
      }}>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.handoutPreviewTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{t.handoutSlipCount(entries.length)}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.close}
          </button>
          <button className="portal-btn-primary" onClick={() => window.print()} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--primary-400)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.print}
          </button>
        </div>
      </div>
      <div id="roster-print-sheet" style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
        {entries.map(entry => (
          <div key={entry.employeeId} className="roster-print-slip" style={{ border: "1px dashed var(--gray-300)", borderRadius: "10px", padding: "20px" }}>
            <p style={{ fontSize: "12px", color: "var(--gray-400)" }}>{projectName}</p>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "4px" }}>{entry.name}</p>
            <p style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace", color: "var(--gray-900)", marginTop: "10px", letterSpacing: "1px" }}>
              {formatCode(entry.code ?? "")}
            </p>
            <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px", lineHeight: 1.5 }}>
              {t.handoutInstruction}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Download the project's roster as the CSV the importer reads back.
 *
 * Lifted out of the page body when the roster tab was folded into Users & Permissions — the button
 * moved, the file it writes did not. Takes the entries rather than reading the store so the caller
 * decides the scope (the whole project's roster, used rows included, not just who is still waiting).
 */
export function exportRosterCsv(entries: RosterEntry[], projectName: string, t: Translations): number {
  const statusMeta = getStatusMeta(t);
  const header = [t.csvHeaderName, t.csvHeaderEmployeeId, t.csvHeaderDepartment, t.csvHeaderEmail, t.csvHeaderPermission, t.csvHeaderStatus, t.csvHeaderCode];
  const rows = entries.map(r => [
    r.name, r.employeeId, r.department ?? "", r.email ?? "", r.permission === "admin" ? t.admin : t.operator,
    statusMeta[r.status].label,
    // Only a still-usable code is worth exporting — a used/expired one can't get anyone signed up.
    r.status === "unused" && r.code ? formatCode(r.code) : "",
  ]);
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName}-staff-roster.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return entries.length;
}


/**
 * The roster's own pieces, re-exported for the merged Users & Permissions page.
 *
 * The two screens became one (a roster row and the account it turns into are the same person at two
 * points of one lifecycle), and the merged table lives in PortalUsersPage. The modals, the code cell
 * and this file's dictionary did not need to move to get there — they are self-contained and take
 * everything they need as props, so they are shared from where they were written rather than copied
 * or dragged across.
 */
export {
  T as ROSTER_T,
  getStatusMeta as getRosterStatusMeta,
  StatusBadge as RosterStatusBadge,
  RosterCodeCell,
  RosterEntryModal,
  IssueConfirmModal,
  RemoveConfirmModal,
  PrintSheet,
};
export type { Translations as RosterTranslations };
