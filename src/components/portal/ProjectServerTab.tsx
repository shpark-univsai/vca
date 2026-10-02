"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ServerCrash, Unplug, Video } from "lucide-react";
import { useVcaStore, type Server, type ServerType } from "@/lib/vcaStore";
import ProjectApiPanel from "./ProjectApiPanel";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { ipv4Problem, portProblem, FIELD_CHECK_T } from "@/lib/fieldChecks";
import { FormLabel, TablePagination, SummaryStrip, CARD_RADIUS, TABLE_RULE, CARD_BORDER, TextField, BORDER, TABLE_COLUMN_GAP, TOOLBAR_GAP, SearchInput, TableEmpty, TableSkeleton, TableLoadFailed, CONTROL_HEIGHT, PANEL_SHADOW, RowActionsMenu, FilterSelect, SortableHeader, sortRows, useTableSort, usePortalEditAccess, ConfirmModal, FieldError, StatusBadge, ActiveFilterCount, Drawer } from "./PortalShared";

/* The table's columns, in one place. There were two copies of this string — the heading row and
   the data row — and the skeleton would have made a third; a grid that is written out per user is
   a grid that eventually disagrees with itself. */
const SERVER_GRID = "0.8fr 1.4fr 1.1fr 1.1fr 1.2fr 70px";

// Ordered as the deployed Add Server dialog orders them, so an operator who has used that one
// finds each entry where their hand already goes. Its list opens with "All", which this one does
// not repeat: "All" is a filter, and no server is of type all.
const SERVER_TYPES: ServerType[] = ["Face Recognition", "Normal Camera", "AI Camera", "Database", "Image Store"];

/**
 * Display-only names for the five types, keyed by the English identifier the data uses — the same
 * arrangement ProjectLicenseTab makes for its feature names, so translating here never touches a
 * lookup. `얼굴 인식` is the word that screen already uses for the same engine.
 *
 * WHY THESE WERE ENGLISH IN A KOREAN TABLE: the rule is that DATA is not translated, and these
 * looked like data. They are not — they are our own five-item enum, the way a status or a priority
 * is, and every one of those is translated. A row reading `배정된 카메라 35대 · Face Recognition`
 * was the only place in Portal where one row held both languages.
 *
 * The two that name a camera (`AI Camera`, `Normal Camera`) are kept as they are, deliberately:
 * they are what the deployed product calls those nodes, and renaming them to roles (analytics
 * node, recording node) on this screen alone would leave the console and the product saying
 * different words for the same machine. Worth raising with whoever owns the product's naming, not
 * worth quietly diverging.
 */
const SERVER_TYPE_LABELS: Record<ServerType, { en: string; ko: string }> = {
  "Face Recognition": { en: "Face Recognition", ko: "얼굴 인식" },
  "Normal Camera": { en: "Normal Camera", ko: "일반 카메라" },
  "AI Camera": { en: "AI Camera", ko: "AI 카메라" },
  "Database": { en: "Database", ko: "데이터베이스" },
  "Image Store": { en: "Image Store", ko: "이미지 저장소" },
};

/** The types that take camera streams. The other two hold pictures and rows. */
const CAMERA_PROCESSING_TYPES: ServerType[] = ["Face Recognition", "AI Camera", "Normal Camera"];

/*
 * The three words a status column can say. The form no longer offers them (a server's status is not
 * something an administrator types in), so only the table reads this.
 *
 * The header above these used to read 상태(기록) — "status, as recorded" — to admit that nothing on
 * this screen tested anything. The parenthesis is gone because the badge already says it: an
 * un-answered server reads 확인 안 됨, and the 연결 실패 card spells out that somebody recorded the
 * failure rather than the console observing it. No comparable product puts a caveat in a column
 * heading, and the caveat was true of all three words, not of the column.
 */
const STATUS_T = {
  en: { success: "Responding", error: "No answer", unchecked: "Not checked" },
  ko: { success: "정상 응답", error: "응답 없음", unchecked: "확인 안 됨" },
} as const;

/**
 * THE STATUS AS A BADGE, the shape the registry's priority column uses (owner's ask, 2026-09-18:
 * 서버 및 API에서도 상태 컨텐츠에 VIP 맨 앞에 있는 우선순위처럼 뱃지로).
 *
 * A dot beside coloured text is the lightest possible mark and it was doing two jobs badly here:
 * the colour was the only thing separating the three states, and a bare word in the leftmost
 * column read as a heading for the row rather than a value in it. A pill has an edge, so it reads
 * as one object with a state — and it carries the same geometry as the priority pill one screen
 * over (18px tall, 10px/600 text, 999px radius), which is what makes the two screens feel like
 * one product.
 *
 * Every colour is an existing token — either at its defined step, or at that step's strength
 * reduced against white, which is the one derivation this repo allows itself (ZONE_TINT in
 * DataPage.tsx and the two tinted panels in ProjectSidebar/ProjectSwitcher do the same thing).
 * The mark is `currentColor`, so each badge's icon takes its own text colour and no new value
 * enters the palette.
 *
 * THE TWO COLOURED FILLS ARE HALF STRENGTH (owner's ask, 2026-09-18: 뱃지 글자가 잘 안 보인다,
 * 배경을 더 연하게). Half rather than some eyeballed amount because half is a step the palette
 * already demonstrates: color-mix(in srgb, var(--gray-100) 50%, white) resolves in Chrome to
 * rgb(248 250 252), and --gray-50 reads back as #f8fafc — the same colour. Half strength is not
 * a new step, it is the step this ramp already has between 100 and white.
 *
 * Measured in Chrome off the computed styles rather than off the token values I expected to be
 * there, against the white table row the badge actually sits on:
 *
 *                     text on its fill        fill against the white row
 *   정상 응답    2.85:1  ->  3.07:1            1.155  ->  1.074
 *   응답 없음    4.47:1  ->  4.80:1            1.153  ->  1.073
 *   확인 안 됨   7.00:1      (untouched)       1.096      (untouched)
 *
 * 확인 안 됨 is resolved through the same engine rather than seen on the screen: no seeded server
 * has an unrecorded status, so that badge does not render in this project and its pair had to be
 * read off a throwaway element carrying the two variables. The other two were read off the rows.
 *
 * The grey is deliberately NOT lightened, and that is what makes these three a set rather than
 * three applications of one formula. Its text was never the weak one — 7.00:1, the highest of
 * the three — so mixing it toward white would spend the only thing it has (a fill you can see:
 * it would drop to 1.046:1, measured) to fix a problem it does not have. Left alone it sits at
 * 1.096 beside the two new fills at 1.074 and 1.073, so the three badges now weigh the same on
 * the row; before this the coloured pair was the heavier one by 0.06 and the grey read as a
 * different family.
 *
 * WHAT THIS DOES NOT FIX, AND CANNOT: 정상 응답 still fails 4.5:1. --success-400 (#16a34a) on
 * PURE WHITE measures 3.296:1, and that is the ceiling for green text anywhere in this palette —
 * the green ramp stops at 400, so there is no darker step to reach for, and writing one here is
 * exactly what the note at the top of globals.css forbids. Half strength is still worth doing,
 * because it carries the 11px glyph across the glyph's own bar: a non-text state indicator needs
 * 3:1 (WCAG 1.4.11), 2.85 failed that and 3.07 passes it, so the shape that tells the three
 * states apart is now compliant even though the 10px word beside it is not.
 *
 * LIBRARY REQUEST — the success ramp needs a 500, the way danger already has one.
 * `--success-500: #117937` = hsl(141.9 75% 27%): the same hue and saturation as --success-400
 * (hsl(142.1 76% 36%)) to within a fifth of a degree and one percent, with only the lightness
 * moved. Measured 4.77:1 on --success-100 and 5.13:1 on the half-strength fill below, so it
 * clears 4.5:1 with or without this lightening. Until it is in the Figma library this badge is
 * as close as the existing tokens go, and the gap is the ramp's, not this file's.
 */
/* The badge moved to PortalShared — see StatusBadge there. A server that is failing is a fault
   (amber) rather than a decision (red): nobody chose it, and red now means somebody did. */

interface ServerFormValues {
  name: string;
  ip: string;
  /** Held as text, like every other field: a half-typed port is "80", and a number input turns
   *  that into a value the moment it is keyed. Parsed on save. */
  port: string;
  /**
   * UNANSWERED IS A STATE, which is why this is not simply a ServerType.
   *
   * The add form opened with "Face Recognition" already chosen — the first item of the list, put
   * there as a default because a select has to show something. But a server's type decides what a
   * camera may be attached to (see the Add camera form, which narrows its picker by it), and a
   * value nobody chose is indistinguishable on screen from one somebody did: press save in a hurry
   * and the register quietly records a face-recognition node where a database was installed.
   *
   * So the add form opens with no answer and the save button refuses until there is one (owner's
   * call, 2026-09-18 — flagged as needing a decision because it changes what the dialog looks like
   * on open, and the decision was to change it). Editing is untouched: an existing server always
   * has a type, so the select opens on the real answer there.
   */
  type: ServerType | "";
  specification: string;
}

const EMPTY_FORM: ServerFormValues = { name: "", ip: "", port: "", type: "", specification: "" };

/**
 * THE ASTERISKS, AUDITED AGAINST WHAT ACTUALLY BLOCKS SAVE (owner's ask, 2026-09-18: the required
 * markers are wrong). A `*` that does not stop you is a lie, and a field that stops you without
 * one is a trap, so the marker and the `valid` expression below are written to agree field by
 * field. What changed and what did not:
 *
 * 서버 포트 GAINED ONE, and the rule gained the check to back it. `Server.port`'s own comment in
 * vcaStore.ts says it plainly — "nothing reaches a server without it, so an address on its own
 * was never enough to describe one" — and this form's own note beside the IP/port pair says the
 * same thing in the same words. The form nevertheless saved with the box empty, so the screen's
 * two most explicit statements about the field were both contradicted by the one line that
 * decides anything. The port stays OPTIONAL ON THE TYPE (`port?: number`): a record that arrives
 * from somewhere other than this dialog may legitimately not carry one, and the table already
 * renders that case (`server.port ? ip:port : ip`). Required is a rule about what a person may
 * type here, which is not the same question as what the record can hold. Nothing existing is
 * stranded by it — all eight seeded servers carry a port, so no row becomes unsavable on open.
 *
 * 서버 유형 DID NOT gain one, although `Server.type` is the one non-optional field of the four.
 * The control is a FilterSelect that opens on SERVER_TYPES[0] and offers no way to clear itself,
 * so there is no state in which it is missing and a `*` on it could never fire. Marking it would
 * teach the reader that `*` means "the record needs this" on one row and "this will stop you" on
 * the others, which is how the marker stops being worth reading. (The real problem with that
 * field is a different one and not a marker's job: a preselected "Face Recognition" means a
 * hurried operator silently records the wrong type. Fixing that means giving the select an empty
 * opening state — a change to the control, and to what "Add server" does on open, so it is left
 * as a decision rather than smuggled in here.)
 *
 * 사양 has no marker and blocks nothing, which is correct and is why the field survives the
 * column change below: it is a note a person may or may not have, not part of an address.
 */
const MODAL_T = {
  en: {
    serverName: "Server Name *", serverNamePlaceholder: "FR 2",
    serverIp: "Server IP *", serverIpPlaceholder: "192.168.0.36",
    serverPort: "Server Port *", serverPortPlaceholder: "8011",
    serverType: "Server Type",
    serverTypeRequired: "Server Type *",
    serverTypePrompt: "Select a type",
    specification: "Specification", specificationPlaceholder: "8 vCPU · 32GB RAM",
    cancel: "Cancel", save: "Save",
  },
  ko: {
    serverName: "서버 이름 *", serverNamePlaceholder: "FR 2",
    serverIp: "서버 IP *", serverIpPlaceholder: "192.168.0.36",
    serverPort: "서버 포트 *", serverPortPlaceholder: "8011",
    serverType: "서버 유형",
    serverTypeRequired: "서버 유형 *",
    serverTypePrompt: "선택하세요",
    specification: "사양", specificationPlaceholder: "8 vCPU · 32GB RAM",
    cancel: "취소", save: "저장",
  },
} as const;

function ServerFormModal({
  title, initial, onClose, onSubmit,
}: {
  title: string;
  initial: ServerFormValues;
  onClose: () => void;
  onSubmit: (values: ServerFormValues) => void;
}) {
  const [form, setForm] = useState<ServerFormValues>(initial);
  const [lang] = usePortalLanguage();
  const t = MODAL_T[lang];
  /* Present is not the same as usable. The form asked only whether the two required boxes had
     characters in them, so "192.168.0.300" and port 99999 saved as happily as a real address —
     and the row they made looks exactly like a working one until somebody tries to reach it.
     Only the two rules that a standard settles are checked here; see fieldChecks.ts. */
  const ipProblem = ipv4Problem(form.ip);
  const portIssue = portProblem(form.port);
  /* Three boxes have to be filled, not two — see the asterisk audit above MODAL_T. portProblem()
     deliberately passes an empty string ("required is the caller's question, not this one's"), so
     the emptiness check belongs here and the range check stays there. */
  const valid = form.name.trim().length > 0 && form.ip.trim().length > 0
    && form.port.trim().length > 0 && form.type !== "" && !ipProblem && !portIssue;

  return (
    <Drawer title={title} onClose={onClose} width="520px"
      footer={<>
        <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {t.cancel}
        </button>
        <button className="portal-btn-primary" onClick={() => valid && onSubmit(form)} disabled={!valid}
          style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", }}>
          {t.save}
        </button>
      </>}>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <FormLabel as="span">{t.serverName}</FormLabel>
          <TextField value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t.serverNamePlaceholder} />
        </div>
        <div>
          {/* Starred now, and the star is honest: an unanswered type blocks the save (see
              ServerFormValues.type). Before this it was the one field on the form that looked
              answered without anybody answering it. */}
          <FormLabel as="span">{t.serverTypeRequired}</FormLabel>
          <FilterSelect value={form.type} onChange={v => setForm(f => ({ ...f, type: v as ServerType }))}
            options={[
              /* The prompt is an option rather than a placeholder because FilterSelect draws its
                 current value as text: with no entry for "", the closed select would have been
                 blank and read as broken. It cannot be chosen back into — picking it is picking
                 nothing, and the button below already says what nothing costs. */
              ...(form.type === "" ? [{ value: "", label: t.serverTypePrompt }] : []),
              ...SERVER_TYPES.map(ty => ({ value: ty, label: SERVER_TYPE_LABELS[ty][lang] })),
            ]} />
        </div>
        {/* Address and port on one row: between them they are one thing, and nothing reaches a
            server with only half of it. The dialog this mirrors stacks them; keeping them on one
            line is the only place this form departs from it, and it departs by pairing fields the
            other one already asks for back to back. */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
          <div>
            <FormLabel as="span">{t.serverIp}</FormLabel>
            <TextField value={form.ip} onChange={v => setForm(f => ({ ...f, ip: v }))} placeholder={t.serverIpPlaceholder} />
            {ipProblem && <FieldError>{FIELD_CHECK_T[lang][ipProblem]}</FieldError>}
          </div>
          <div>
            <FormLabel as="span">{t.serverPort}</FormLabel>
            <TextField value={form.port} onChange={v => setForm(f => ({ ...f, port: v.replace(/[^0-9]/g, "") }))} placeholder={t.serverPortPlaceholder} />
            {portIssue && <FieldError>{FIELD_CHECK_T[lang][portIssue]}</FieldError>}
          </div>
        </div>
        <div>
          <FormLabel as="span">{t.specification}</FormLabel>
          <TextField value={form.specification} onChange={v => setForm(f => ({ ...f, specification: v }))} placeholder={t.specificationPlaceholder} />
        </div>
      </div>
    </Drawer>
  );
}

const MAIN_T = {
  en: {
    subTabInfra: "Servers", subTabApi: "API",
    confirmDeleteTitle: (name: string) => `Remove ${name}?`,
    confirmDeleteBody: "The server comes off this project. Any camera assigned to it is left unassigned — nothing stops processing that was not already stopped, but nobody is told where those cameras run next.",
    confirmDeleteCameras: (n: number) => (n === 1 ? "1 camera is assigned to it." : `${n} cameras are assigned to it.`),
    gapError: "connection failing",
    gapErrorWhy: "Somebody recorded this server as failing. Nothing here tested it — if that is still true, everything assigned to it has stopped being processed, whatever the cameras themselves say.",
    gapNoCameras: "no cameras assigned",
    gapNoCamerasWhy: "The server is registered and reachable but has nothing pointed at it — capacity that is paid for and idle.",
    /* Same as the VIP tiles: 「1 servers」 at a count of one. */
    gapServerUnit: (n: number) => (n === 1 ? "server" : "servers"),
    gapPerServers: (n: number) => `across ${n} processing server${n === 1 ? "" : "s"}`,
    gapLoadLabel: "cameras to process",
    gapLoadWhy: "Cameras in this project divided across the servers that take streams. An image store and a database are left out of the denominator: no camera is ever assigned to one. This is the figure an argument for another server is made from, not a limit, and nothing here enforces one. What each server is actually carrying is not on this screen until the server reports it.",
    gapShowOnly: "Show only these",
    gapClear: "Show everything again",
    searchPlaceholder: "Search by server name or IP address",
    allTypes: "All types", filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`, addServer: "Add server",
    emptyNoServers: "No servers configured for this project yet.",
    loadFailed: "Could not load the server list.",
    retry: "Try again",
    emptyNoMatch: "No servers match these filters.",
    /* THE PARENTHETICAL STAYS, on both languages, and it is the one column in Portal that earns
       one. The cameras, roster and users tables all head theirs "Status" / "상태" with nothing
       after it, and on the camera table that word is backed by a measurement — "Answered the last
       connection attempt" (healthConnectedWhy). Nothing here probes a server. `Server.status` is a
       stored field the form no longer even offers (see STATUS_T), one of its three values is
       "Not checked", and the summary strip above already has to spell out "Somebody recorded this
       server as failing. Nothing here tested it" (gapErrorWhy) because a bare red "Error" was
       being read as a live result. Dropping the parenthetical for consistency with the other
       tables would make this column claim the observation those tables have and this one does
       not. */
    colStatus: "Status", colName: "Server Name", colIp: "Server IP", colType: "Server Type",
    /* THE FIFTH COLUMN IS THE CAMERA COUNT, NOT 사양 (owner's ask, 2026-09-18: 사양 칸이 전부
       비어 있다). Measured in the browser before touching it: all six rows of proj-sg printed
       "—", because `specification` is undefined on all eight seeded servers and nothing writes
       it but this screen's own form. A column whose value is the same em dash on every row is
       not information, it is a heading standing over nothing.

       Replaced rather than added to. The count is the one fact about a server that the table
       never carried — a row said its name, its address and its type, none of which answer "what
       runs on this thing" — and the delete dialog below has been computing exactly this number
       for its own "are you sure" all along, where only the person about to delete something ever
       saw it. Both now read the same map, so the table and the dialog cannot disagree.

       THE FIELD AND THE FORM STAY. A server's spec is real information the moment the backend
       starts filling it in; what was wrong was a COLUMN spending a sixth of the table's width on
       a value nobody has recorded yet. When the backend sends specs, that is a column to add
       back — with rows behind it. */
    colCameras: "Assigned cameras",
    cameraCount: (n: number) => `${n}`,
    /* Zero is the interesting row, so it gets words. "0" in a column of counts reads as a
       quantity you skim past; a server nothing reports to is the gap the strip above already
       counts as 카메라 미할당 and lets you filter to, and this is the same fact stated on the row
       it belongs to. Set in gray-900/700 rather than a warning colour: --warning-500 on the white
       row measures 3.56:1, which fails 4.5:1 at 12px, and gray-900 is 18.3:1 — the same treatment
       the delete dialog gives its own copy of this count. */
    camerasNone: "No cameras assigned",
    edit: "Edit", remove: "Remove", cancel: "Cancel",
    addServerTitle: "Add server", editServerTitle: "Edit server",
    toastAdded: "Server added", toastUpdated: "Server updated", toastRemoved: "Server removed",
  },
  ko: {
    subTabInfra: "서버", subTabApi: "API",
    confirmDeleteTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    confirmDeleteBody: "이 프로젝트에서 서버가 빠집니다. 여기 배정돼 있던 카메라는 미배정 상태가 됩니다 — 이미 멈춰 있던 것 말고 새로 멈추는 건 없지만, 그 카메라들이 이제 어디서 도는지는 아무도 모릅니다.",
    confirmDeleteCameras: (n: number) => `배정된 카메라 ${n}대.`,
    gapError: "연결 실패",
    gapErrorWhy: "누군가 이 서버를 오류로 기록해 두었습니다. 화면이 확인한 것은 아닙니다 — 아직 사실이라면 카메라 쪽 표시와 무관하게 이 서버에 붙은 것은 전부 처리가 멈춰 있습니다.",
    gapNoCameras: "카메라 미할당",
    gapNoCamerasWhy: "등록되어 있고 연결도 되지만 아무것도 붙어 있지 않습니다. 비용은 나가고 놀고 있는 용량입니다.",
    gapServerUnit: () => "대",
    gapPerServers: (n: number) => `/ 처리 서버 ${n}대`,
    gapLoadLabel: "처리할 카메라",
    gapLoadWhy: "이 프로젝트의 카메라를 스트림을 받는 서버 수로 나눈 값입니다. 이미지 저장소와 데이터베이스는 카메라가 배정되지 않으므로 분모에서 빠집니다. 서버 증설을 설득할 때 쓰는 숫자이고, 한계치가 아니며 여기서 강제하지도 않습니다. 서버별 실제 부하는 서버가 알려주기 전까지 이 화면에 없습니다.",
    gapShowOnly: "이 항목만 보기",
    gapClear: "전체 다시 보기",
    searchPlaceholder: "서버 이름 또는 IP 주소로 검색",
    allTypes: "전체 유형", filtersActive: (n: number) => `필터 ${n}개`, addServer: "서버 추가",
    emptyNoServers: "이 프로젝트에 아직 설정된 서버가 없습니다.",
    loadFailed: "서버 목록을 불러오지 못했습니다.",
    retry: "다시 시도",
    emptyNoMatch: "필터와 일치하는 서버가 없습니다.",
    colStatus: "상태", colName: "서버 이름", colIp: "서버 IP", colType: "서버 유형",
    colCameras: "배정된 카메라",
    cameraCount: (n: number) => `${n}대`,
    camerasNone: "아무 카메라도 없음",
    edit: "수정", remove: "삭제", cancel: "취소",
    addServerTitle: "서버 추가", editServerTitle: "서버 수정",
    toastAdded: "서버 추가됨", toastUpdated: "서버 수정됨", toastRemoved: "서버 삭제됨",
  },
} as const;

type ServerSortKey = "status" | "name" | "ip" | "type";

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * A list has four states (see PortalShared: rows · empty · loading · failed) and this tab can
 * only ever be in two of them today, because it reads the in-memory store synchronously: there
 * is no second where the rows are in the air, and no request that can come back 500.
 *
 * WHAT REPLACES THIS: the GET for this list. `listState` becomes that request's own state —
 * "loading" while it is out, "failed" when it is rejected, "ready" once the rows are in — and
 * `retryList` becomes the refetch the failed state's button calls. Nothing below it changes:
 * the table already branches on these three words.
 *
 * The ?listState= override is the only reason this reads the URL at all. It is here so the two
 * states that are unreachable today can still be opened, seen and reviewed, and it is ONE line
 * to delete when the fetch lands. It is not a setting: nothing in Portal writes this parameter,
 * so nobody arrives at it by accident.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  // Until there is a request there is nothing to ask for again, so retrying can only drop the
  // override and show what the store holds. This call becomes the refetch.
  return [state, () => setState("ready")];
}

export default function ProjectServerTab({ projectId }: { projectId: string }) {
  // Servers and mail are infrastructure. An auditor reads what is deployed and where mail comes
  // from; changing either is not what the role is for.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const [listState, retryList] = useListState();
  const servers = useVcaStore(s => s.servers);
  const cameras = useVcaStore(s => s.cameras);
  const addServer = useVcaStore(s => s.addServer);
  const updateServer = useVcaStore(s => s.updateServer);
  const removeServer = useVcaStore(s => s.removeServer);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = MAIN_T[lang];
  const st = STATUS_T[lang];

  const [subTab, setSubTab] = useState<"infra" | "api">("infra");
  const [showAdd, setShowAdd] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ServerType>("ALL");
  /** Which summary cell the list is narrowed to, if any. */
  const [gapFilter, setGapFilter] = useState<"error" | "noCameras" | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { sort, toggle: toggleSort } = useTableSort<ServerSortKey>({ key: "status", direction: "asc" });

  const projectServers = servers.filter(s => s.projectId === projectId);
  /**
   * The two things worth stating above a list of servers, and the ratio that gives them context.
   *
   * A failed connection is on every row already, but there is no status filter beside the search
   * box — with twenty servers you find the broken one by reading. And a server nothing points at
   * is hardware that was bought, racked and left idle: the exact mirror of the "no server
   * assigned" figure on Input Sources, and invisible from either side until both are stated.
   *
   * Both are read off fields these screens already hold (a server's own status; which serverId the
   * cameras carry), so a figure can never disagree with the rows behind it.
   */
  const projectCameras = cameras.filter(c => c.projectId === projectId);
  /**
   * How many of this project's cameras name each server — counted once for the whole screen.
   *
   * Three places want this number now and they used to derive it three ways: the strip's
   * "카메라 미할당" cell tested a Set of assigned ids, the delete dialog ran its own filter, and
   * the new camera column would have run that filter again once per visible row (a 60-camera
   * pass to print one integer, on every render). One pass, one map, so the tile, the column and
   * the confirmation cannot drift apart — which was the whole reason the strip's own comment
   * gives for reading these figures off stored fields in the first place.
   *
   * `has()` answers the old Set's question exactly: a server is in the map only if at least one
   * camera named it.
   */
  const camerasPerServer = new Map<string, number>();
  for (const cam of projectCameras) {
    if (cam.serverId) camerasPerServer.set(cam.serverId, (camerasPerServer.get(cam.serverId) ?? 0) + 1);
  }
  const erroredServers = projectServers.filter(sv => sv.status === "error");
  const unusedServers = projectServers.filter(sv => !camerasPerServer.has(sv.id));
  /**
   * THE SERVERS THAT ACTUALLY TAKE STREAMS.
   *
   * The ratio card divided the fleet by every server on the project, which on this site meant
   * dividing 62 cameras by six — two of them an image store and a database, machines no camera is
   * ever assigned to. An average whose denominator counts a database is not an average of
   * anything. Three, here, and the figure moves from ~10 per server to ~21, which is the number
   * somebody would take to a meeting.
   */
  const processingServers = projectServers.filter(sv => CAMERA_PROCESSING_TYPES.includes(sv.type));
  const gapServers = {
    error: new Set(erroredServers.map(sv => sv.id)),
    noCameras: new Set(unusedServers.map(sv => sv.id)),
  } as const;

  const q = search.trim().toLowerCase();
  // Errors first by default — "error" sorts before "success" — because a server list is read when
  // something is wrong, not to admire the healthy ones.
  const visibleServers = sortRows(
    projectServers.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.ip.includes(q);
      const matchesType = typeFilter === "ALL" || s.type === typeFilter;
      const matchesGap = !gapFilter || gapServers[gapFilter].has(s.id);
      return matchesSearch && matchesType && matchesGap;
    }),
    sort,
    (server, key) => {
      switch (key) {
        // Errors, then successes, then the ones nobody has answered for.
        case "status": return server.status ?? "unchecked";
        case "name": return server.name.toLowerCase();
        // Padded so 10.20.4.9 sorts after 10.20.4.17 rather than before it — a plain string compare
        // orders addresses by digit, which is the wrong answer for every list of IPs.
        case "ip": return server.ip.split(".").map(part => part.padStart(3, "0")).join(".");
        // The label, not the identifier: a Korean reader sorting this column would otherwise get
        // English alphabetical order, which looks like no order at all.
        case "type": return SERVER_TYPE_LABELS[server.type][lang];
      }
    },
  );

  // Filters/page-size changing the result set can strand the current page past the new last
  // page (e.g. narrowing a search while on page 3) — snap back to page 1 whenever either shifts.
  // Compared during render rather than reset from an effect: an effect paints the stale page once
  // before correcting it, and react-hooks flags the synchronous setState as cascading renders.
  // Same idiom DataPage.tsx uses for its own nav/seed resets.
  const filterKey = `${search}|${typeFilter}|${gapFilter ?? ""}|${rowsPerPage}|${sort.key}|${sort.direction}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(visibleServers.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageServers = visibleServers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  // The row range this page shows was computed here and read nowhere: TablePagination has
  // worked it out for itself since the inline pager moved into PortalShared, and it prints it
  // from its own PAGER_T. The two dictionary entries that fed the old one (showingEntries,
  // rowsPerPage) went with them — a second translation of a sentence the shared component
  // already owns is the thing that ends up worded differently from it.

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setGapFilter(null);
  };
  /* What is actually narrowing the list, so the control that clears it can be absent when there is
     nothing to clear — see the note where it is drawn. */
  const activeFilterCount = (search.trim() ? 1 : 0) + (typeFilter !== "ALL" ? 1 : 0) + (gapFilter ? 1 : 0);

  const createServer = (values: ServerFormValues) => {
    /* The form's own save button is disabled until a type is chosen, and this is the same rule
       written where the record is made — the button is the UI, this is the rule. It also gives the
       type a narrowing the store can accept: ServerFormValues.type carries "" for unanswered. */
    if (values.type === "") return;
    addServer({
      projectId, name: values.name.trim(), ip: values.ip.trim(),
      port: Number(values.port) || undefined,
      type: values.type, specification: values.specification.trim() || undefined,
    });
    setShowAdd(false);
    showToast({ variant: "success", title: t.toastAdded, desc: values.name.trim() });
  };

  const saveEdit = (values: ServerFormValues) => {
    if (!editingServer || values.type === "") return;
    updateServer(editingServer.id, {
      name: values.name.trim(), ip: values.ip.trim(),
      port: Number(values.port) || undefined,
      type: values.type, specification: values.specification.trim() || undefined,
    });
    setEditingServer(null);
    showToast({ variant: "success", title: t.toastUpdated, desc: values.name.trim() });
  };

  // Confirmed, and it says what goes with it. Removing a server orphans every camera assigned
  // to it — the table's camera column now says how many that is, and the dialog repeats it
  // because by then the row is behind the scrim.
  const [confirmingDelete, setConfirmingDelete] = useState<Server | null>(null);
  const handleDelete = (server: Server) => setConfirmingDelete(server);
  const confirmDelete = () => {
    if (!confirmingDelete) return;
    const name = confirmingDelete.name;
    removeServer(confirmingDelete.id);
    setConfirmingDelete(null);
    showToast({ variant: "warning", title: t.toastRemoved, desc: name });
  };

  return (
    <div>
      {/* No page title here: the top bar's crumb already names this page, and printing the same
          word again 20px lower was the page introducing itself twice. What stays is the row of
          things you can do on it. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {(["infra", "api"] as const).map(sub => (
          <button key={sub} onClick={() => setSubTab(sub)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "0 2px 10px", fontSize: "13px", fontWeight: 700,
              color: subTab === sub ? "var(--gray-900)" : "var(--gray-400)",
              borderBottom: subTab === sub ? "2px solid var(--gray-900)" : "2px solid transparent",
            }}>
            {sub === "infra" ? t.subTabInfra : t.subTabApi}
          </button>
        ))}
      </div>

      {subTab === "api" ? <ProjectApiPanel projectId={projectId} /> : (
        <>
          {/*
            The two gaps and the ratio between the fleet and the servers running it, in the shared
            summary strip — the same shape the VIP registry and Input Sources use.

            The ratio is not a defect and takes no click: it is the figure an increase in cameras
            is argued from, and nothing else on this page states it.
          */}
          <SummaryStrip cells={[
            ...([
              { key: "error" as const, servers: erroredServers, label: t.gapError, why: t.gapErrorWhy, icon: <ServerCrash size={14} strokeWidth={2.4} /> },
              { key: "noCameras" as const, servers: unusedServers, label: t.gapNoCameras, why: t.gapNoCamerasWhy, icon: <Unplug size={14} strokeWidth={2.4} /> },
            ].filter(item => item.servers.length > 0).map(item => ({
              key: item.key,
              icon: item.icon,
              figure: item.servers.length,
              unit: t.gapServerUnit(item.servers.length),
              label: item.label,
              explanation: item.why,
              tone: "warning" as const,
              active: gapFilter === item.key,
              title: gapFilter === item.key ? t.gapClear : t.gapShowOnly,
              onClick: () => setGapFilter(gapFilter === item.key ? null : item.key),
            }))),
            {
              key: "load",
              icon: <Video size={14} strokeWidth={2.4} />,
              figure: projectCameras.length,
              unit: t.gapPerServers(processingServers.length),
              label: t.gapLoadLabel,
              explanation: t.gapLoadWhy,
            },
          ]} state={listState} />

          {/* Centred for the same reason as the Input Sources toolbar: the controls carry their own
              height, so anything unstyled dropped in here would draw itself against the top edge. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: TOOLBAR_GAP }}>
            <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
            <FilterSelect value={typeFilter} onChange={v => setTypeFilter(v as typeof typeFilter)}
              options={[{ value: "ALL", label: t.allTypes }, ...SERVER_TYPES.map(ty => ({ value: ty, label: SERVER_TYPE_LABELS[ty][lang] }))]} />
            {/*
              ONLY WHEN THERE IS SOMETHING TO CLEAR (owner, 2026-09-28: 테이블위에 초기화버튼은
              검색이나 필터링 걸기전엔 누를일이 없을것같은뎅 검색이나 필터 걸리면 뜨게끔).

              This was a permanent 초기화 button — a control that does nothing on the screen a
              reader first meets, and it was this list's own invention: every other list in Portal
              already uses ActiveFilterCount, which appears only once a filter is on, says how many
              are on, and clears them when pressed. One fewer bespoke control, and the toolbar now
              reads the same on every list.
            */}
            <ActiveFilterCount count={activeFilterCount} onClear={resetFilters} label={t.filtersActive(activeFilterCount)} />
            {/* `marginLeft: auto` puts this at the right end of the toolbar, which is where every
                other list in Portal keeps the one thing that MAKES something — left of the row is
                how you narrow the list, right of it is what you do to it. Without it this button
                sat wherever the search field and the type filter happened to end (measured at
                1440px: right edge at 869 against a content edge of 1408 — the middle of the row).
                Reset deliberately stays on the left: it is a filter control, not an action. */}
            <button className="portal-btn-primary" onClick={() => setShowAdd(true)} disabled={!mayEdit} title={readOnlyReason}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: mayEdit ? "var(--primary-400)" : "var(--gray-200)", color: mayEdit ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: mayEdit ? "pointer" : "not-allowed", flexShrink: 0, marginLeft: "auto" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addServer}
            </button>
          </div>

          {/* One card whether or not there is anything in it: the column headings are the table,
              and they stay true when the rows underneath are filtered away.

              No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that
              opens past the bottom edge (the last row's menu becomes invisible, not just cut
              off). Header/last-row corners are radiused directly instead. */}
          <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: SERVER_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
              {([
                { label: t.colStatus, key: "status" },
                { label: t.colName, key: "name" },
                { label: t.colIp, key: "ip" },
                { label: t.colType, key: "type" },
                { label: t.colCameras },
                { label: "" },
              ] as { label: string; key?: ServerSortKey }[]).map((h, i) => (
                <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
              ))}
            </div>
            {/* Only the rows change — the headings above and the Add Server button above them
                stand while the answer is on its way.

                Loading is answered before empty. "No servers configured for this project yet" is
                a conclusion somebody acts on (they add one that already exists), and printing it
                over a list still being fetched is exactly that mistake. */}
            {listState === "loading" ? (
              <TableSkeleton grid={SERVER_GRID} rows={4} />
            ) : listState === "failed" ? (
              <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
            ) : visibleServers.length === 0 ? (
              <TableEmpty text={projectServers.length === 0 ? t.emptyNoServers : t.emptyNoMatch} />
            ) : pageServers.map((server, i) => {
              const statusState = server.status === "success" ? "success" as const
                : server.status === "error" ? "error" as const : "unchecked" as const;
              const statusLabel = server.status === "success" ? st.success
                : server.status === "error" ? st.error : st.unchecked;
              const isLast = i === pageServers.length - 1;
              const cameraCount = camerasPerServer.get(server.id) ?? 0;
              return (
                <div key={server.id} style={{
                  display: "grid", gridTemplateColumns: SERVER_GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
                  borderBottom: isLast ? "none" : TABLE_RULE,
                  borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
                }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <StatusBadge tone={statusState === "success" ? "normal" : statusState === "error" ? "fault" : "waiting"} label={statusLabel} />
                  </div>
                  {/* THE SPEC, BACK ON SCREEN. Its own column became 배정된 카메라 on 2026-09-18
                      because it was empty on every seeded row, which left a field the add form
                      still asks for with nowhere to be read — type it, save, and it is only
                      visible by reopening the form. A second line under the name costs no column
                      and appears only where somebody recorded one. */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.name}</p>
                    {server.specification && (
                      <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{server.specification}</p>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)", fontFamily: "monospace" }}>{server.port ? `${server.ip}:${server.port}` : server.ip}</span>
                  <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{SERVER_TYPE_LABELS[server.type][lang]}</span>
                  {/* gray-600 like the address and the type beside it, not the gray-400 the spec
                      column used: that was the weight for a value nobody had recorded, and this
                      one is as much a fact about the row as the other two. Zero goes the other
                      way and gets darker — see camerasNone. */}
                  {cameraCount === 0
                    ? <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>{t.camerasNone}</span>
                    : <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{t.cameraCount(cameraCount)}</span>}
                  <RowActionsMenu actions={[
                    { label: t.edit, onClick: () => setEditingServer(server), disabled: !mayEdit, reason: readOnlyReason },
                    { label: t.remove, onClick: () => handleDelete(server), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                  ]} />
                </div>
              );
            })}
          </div>

          {/* The shared pager (PortalShared.TablePagination). It was forty lines of inline JSX
              here, printing one button per page — fine for six servers, wrong for the VIP registry
              that now uses the same component, so it moved and learned to window. */}
          {/* No pager over rows that are not there: "0 / 0" under a skeleton is a count of
              nothing dressed as a count. */}
          {listState === "ready" && <TablePagination
            total={visibleServers.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPage={setPage}
            onRowsPerPage={setRowsPerPage}
          />}
        </>
      )}

      {confirmingDelete && (
        <ConfirmModal
          title={t.confirmDeleteTitle(confirmingDelete.name)}
          body={t.confirmDeleteBody}
          confirmLabel={t.remove}
          cancelLabel={t.cancel}
          danger
          onConfirm={confirmDelete}
          onClose={() => setConfirmingDelete(null)}
        >
          {/* The same count the row now shows, read off the same map — repeated here on purpose.
              "Are you sure" with no number is a question nobody can answer, and at this moment
              the row it refers to is behind a scrim. It is no longer the ONLY place this number
              appears, which is what made it worth moving into the table. */}
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", marginTop: "12px" }}>
            {t.confirmDeleteCameras(camerasPerServer.get(confirmingDelete.id) ?? 0)}
          </p>
        </ConfirmModal>
      )}
      {showAdd && (
        <ServerFormModal title={t.addServerTitle} initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSubmit={createServer} />
      )}
      {editingServer && (
        <ServerFormModal
          title={t.editServerTitle}
          initial={{
            name: editingServer.name, ip: editingServer.ip, type: editingServer.type,
            port: editingServer.port ? String(editingServer.port) : "",
            specification: editingServer.specification ?? "",
          }}
          onClose={() => setEditingServer(null)}
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}
