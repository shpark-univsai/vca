"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVcaStore, type ExportRecord, type ExportKind } from "@/lib/vcaStore";
import { PROJECT_TIME_ZONE, clockMinutesIn, dateKeyIn } from "@/lib/time";
import { usePortalLanguage } from "@/lib/i18n";
import { useGrantNames } from "./PortalShared";
import { DateRangeTrigger, dateKeyOf, type DateRangeValue } from "../shared/DateRangePicker";
import {
  CARD_BORDER, CARD_RADIUS, TABLE_RULE, CONTROL_HEIGHT, PANEL_SHADOW, TABLE_COLUMN_GAP, TABLE_HEADER_COLOR, TOOLBAR_GAP,
  ActiveFilterCount, BORDER, Drawer, FilterSelect, PairGrid, PairItem, PanelPrimary, SortableHeader,
  SummaryStrip, TableEmpty, TableSkeleton, TableLoadFailed, sortRows, useTableSort } from "./PortalShared";
import { CheckCircle2, ChevronRight, FileOutput, FileSpreadsheet, Layers, ScanFace, ShieldAlert, SearchCheck, Megaphone } from "lucide-react";
import { RADIUS } from "../shared/controls";

/**
 * 반출 기록 — WHAT LEFT THIS INSTALLATION AS A FILE, WHO TOOK IT, AND ON WHOSE AUTHORITY.
 *
 * The store has been writing `exportLog` since the Portal's four CSV buttons were built and
 * **nothing has ever read it**. That is the failure the look-up log's own header warns about: a
 * record nobody can produce counts, to an auditor, as a record that was never kept. This file is
 * the reader, and it is the screen a Korean customer's 개인정보 보호책임자 asks for by name.
 *
 * ONE TABLE, TWO KINDS OF FILE, AND THAT IS THE WHOLE DESIGN PROBLEM.
 *
 * A camera list leaving as a spreadsheet and a still of somebody's face leaving the building are
 * both answers to "what left here", so they share a table (see ExportRecord). But only the second
 * one is 목적 외 이용 / 제3자 제공 under 법 제18조, and only the second one carries the seven
 * register items of 표준 개인정보 보호지침 제42조제1항 — ① 파일 명칭 ② 요청자 구분 · 제공받는 자
 * ④ 법령상 근거 ⑤ 영상의 범위 ⑥ 형태 ⑦ 담당자. The Portal's CSV buttons predate those fields and
 * record none of them, which is correct and not a gap: a camera list is not somebody's face.
 *
 * So the register items are NOT columns. Seven columns that only one kind of row can fill would
 * print a run of dashes across every list row, and a reader watching that concludes the log is
 * half broken — the same mistake the look-up log's IP column was pulled for. They live behind the
 * row instead, in the panel pattern the camera and account lists already use, and a row that holds
 * none of them simply opens to a short panel. The table keeps the two kinds apart the way it
 * always did: the glyph and word in 「종류」, and the app screen on the second line of 「반출된
 * 것」, which only a frame or a result set has.
 *
 * AND IT IS ALSO WHERE THE MONTHLY REVIEW IS DONE (고시 제8조제2항).
 *
 * The duty does not stop at keeping the record: the access record is checked at least monthly and
 * a download found in it must have its reason confirmed. A console with nowhere to record the
 * confirmation gives the reviewer no way to show the review happened — the same failure as not
 * keeping the record at all, one step further out. So every row opens, and the panel ends with the
 * one thing a reviewer does: 「사유 확인」, which stamps `reviewedBy` and `reviewedAt` on the row.
 *
 * THERE IS NO WAY TO UNDO IT, and that is the point. A reviewer who can clear their own
 * confirmation has not confirmed anything, so the panel offers no edit and no revert — only the
 * stamp, once (see recordExportReviewed's handoff note).
 *
 * NOT GATED ON usePortalEditAccess, deliberately. `canEditPortal` is false for the auditor role,
 * and the monthly review is the auditor's job — gating it would lock out the one person it exists
 * for, which is the same inversion the store refused when it declined to gate the export buttons.
 * What `canEditPortal` guards is configuration (cameras, VIP, roster, licence, server) and this is
 * not configuration: it is a reviewer writing down that they looked. The server decides for real.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 * - No edit, hide or delete on a row, and no way to clear a review. 고시 제8조제3항 — the record
 *   must be safe from alteration. The only two writes this screen makes are both appends: the
 *   review stamp, and the row recording its own CSV.
 * - No masking, no watermark, no hash. 표준지침 제46조's de-identification duty binds on ONE path
 *   of the three — footage handed to the 정보주체 themselves with other identifiable people in
 *   frame. 수사기관 제공 does not (masking damages the evidence) and internal viewing is inside
 *   the purpose it was collected for. So what is needed now is the ② 요청자 구분 field, which is
 *   in the panel; masking becomes necessary only once that field says "subject". A hash in the
 *   register has no statutory basis we could find — it is dispute-preparedness advice, so it is
 *   not built.
 * - No access-request deadline. There is no 열람 요구 route in this version.
 *
 * Shape taken from Okta's System Log (date range above the table, actor as name over address, the
 * object's KIND inlined with the object rather than chipped) and Genetec Clearance's evidence
 * audit (the reason folded into the row's detail rather than given a column it cannot always
 * fill). Rejected: Genetec Security Center's nine-to-thirteen columns and Milestone XProtect's
 * Permission / Source type / User location, which are panel contents here; and Milestone's prose
 * "Message text" as the subject column, which hides who the file was about from a reader scanning.
 *
 * HANDOFF NOTE — WHAT THE SERVER HAS TO OWN. Every row on this screen was written by the browser
 * that did the exporting, and a client that writes its own audit row is a client that can skip
 * writing it. The store says this in full at `recordListExport`: the CSV is assembled in the
 * browser from rows already on the page, so there is no request for the server to observe and no
 * server-recorded row can exist for it. That comment cites `src/lib/evidence.ts:28` for the same
 * conclusion about the evidence bundle — **that file does not exist in this repo** (RedmapPage
 * cites it too), so the reasoning lives only in those two comments. The export has to become a
 * server call that logs before it returns bytes:
 *   POST /v1/projects/{id}/exports  → the register row, then the file
 *   GET  /v1/projects/{id}/exports?from=&to=&kind=&actor=&subject=&review=&cursor=
 *   POST /v1/projects/{id}/exports/{exportId}/review
 * — the GET's parameters are the filters below, which is why they are shaped this way, and the
 * review POST is the one the server must stamp itself: a reviewer's own browser supplying the
 * reviewer's name and the time is a confirmation that confirms nothing.
 */

/*
 * SIX COLUMNS AND A GUTTER.
 *
 * Widths live beside their labels so the grid string and the headings cannot drift apart. Every
 * column is filled by every row, which is the point — the fields that only one kind of row has
 * are in the panel.
 *
 * 시각 LAST, matching both tabs of this screen (owner, 2026-09-28: 변경기록도 조회기록도 시각이
 * 맨 뒤로갔으면 해). Okta, 1Password and Vanta all lead with the timestamp; the owner's rule is
 * measured against this product's own two record tables, and a reader moving between the three
 * tabs matters more than matching a console they are not using.
 */
/* 「점검」 goes between the amount and the stamp, so the row reads 누가 · 무엇을 · 얼마나 ·
   점검됐나 · 언제 — the review sits beside the file it is about rather than at the far edge. */
/* 「구분」 REPLACED 「종류」 IN THIS COLUMN (owner, 2026-10-07). The file's shape — 명단 · 프레임 ·
   분석 결과 — is not what the register divides on; 개인영상정보 관리대장 divides on what the
   handing-over WAS (이용 · 제공 · 열람). The shape is still here, as the second line of the same
   cell, the way the actor cell carries an address under a name. */
const COLUMN_WIDTH = {
  actor: "1fr", kind: "0.95fr", what: "1.3fr", amount: "0.55fr", review: "0.8fr", at: "150px", open: "20px",
} as const;
const COLUMNS = ["actor", "kind", "what", "amount", "review", "at", "open"] as const;
const GRID = COLUMNS.map(c => COLUMN_WIDTH[c]).join(" ");

type ExportSortKey = "at" | "actor" | "kind" | "what" | "review";

/** The three kinds, in the order a reader cares about them: the face first. */
const KINDS: ExportKind[] = ["frame", "results", "list"];

const KIND_ICON: Record<ExportKind, typeof Layers> = {
  frame: ScanFace, results: Layers, list: FileSpreadsheet,
};

const T = {
  en: {
    /* What the rows cannot say. The second sentence is not a disclaimer, it is the answer to the
       question the next reader asks when they find a row naming this screen. */
    foot: "A row is written whenever the console produces a file, and exporting this log is itself one of them.",
    /* TRUE AS WRITTEN, which it was not until 2026-10-07. It said 「Only the owner and auditors
       read this log」 while an admin could open the tab just as easily — no gate exists on the
       rail, at the mount point or inside any of the four record tabs, and this register carries
       subject names and the reasons somebody gave for looking at them.
       RESTRICTING IT IS A DECISION, NOT A BUG FIX, so the sentence was corrected rather than the
       door quietly narrowed: taking a tab away from admins is the owner's call to make. */
    ownerOnly: "Anyone who can enter Portal reads this log — owner, admin and auditor.",
    empty: "Nothing has been exported from this project yet.",
    noMatch: "No exports match these filters.",
    loadFailed: "Could not load the export log.",
    retry: "Try again",
    colActor: "Exported by", colKind: "Disposition", colWhat: "What left", colAmount: "Amount",
    dispInternal: "Internal use", dispThirdParty: "Third-party release", dispSubject: "Subject access",
    /* A row written before this field existed. Not 「내부 이용」 — that would be an answer nobody gave. */
    dispUnknown: "Not recorded",
    colReview: "Checked", colAt: "When",
    kindList: "List", kindFrame: "Frame", kindResults: "Result set",
    /* The Portal tab a reader would go back to — the list's own name on the rail, not the store's
       internal key. */
    /* Every key ExportRecord.list can hold. Three were missing and printed as the raw key —
       「handlingLog」 appeared verbatim in the 「반출된 것」 column of a register a 공공기관 customer
       is inspected against (2026-10-07). A map typed `Record<string, string>` cannot catch that,
       so the test is: this list has one line per member of that union. */
    listName: {
      vips: "VIP registry", searchLog: "Search log", activity: "Activity log",
      roster: "Awaiting sign-up", cameras: "Input sources",
      accessLog: "Access log", exportLog: "Export log", handlingLog: "Handling log",
      vipImportSkipped: "VIP import — skipped rows", rosterImportSkipped: "Staff import — skipped rows",
    } as Record<string, string>,
    unitRows: (n: number) => `${n} row${n === 1 ? "" : "s"}`,
    unitFrames: (n: number) => `${n} frame${n === 1 ? "" : "s"}`,
    filterAllDates: "Any date",
    filterAllKinds: "Every kind",
    filterAllActors: "Anyone",
    filterAllSubjects: "Any subject",
    clearFilters: "Clear",
    export: "Export CSV",
    exportNothingHeld: "Nothing has been exported yet, so there is nothing to export.",
    exportNoMatch: "These filters match no exports. The file carries the rows the table is showing.",
    statTotal: "files", statTotalLabel: "left this project",
    statFaces: "people", statFacesLabel: "had a face leave",
    statUnreviewed: "files", statUnreviewedLabel: "not checked yet",
    publishHeading: "Publication", publishedWhere: "Published in", publishedAtLabel: "Published",
    publishedBy: "Recorded by", publishGazette: "Gazette", publishWebsite: "The body's own site",
    publishKeepUp: "A website posting stays up at least 10 days.",
    publishPending: "Not recorded as published yet.",
    publishOverdue: "More than 30 days have passed with no publication recorded.",
    publishMarkGazette: "Published in the gazette", publishMarkWebsite: "Published on our site",
    statUnpublished: "not published in time", statUnpublishedUnit: "releases",
    statUnpublishedWhy: "A public authority publishes a third-party release within 30 days — gazette or its own site (법 제18조제4항). These passed 30 days with nothing recorded. Mark one from its row once it has been published.",
    statUnreviewedTitle: "Show only these",
    statUnreviewedWhy: "The review runs at least monthly and has to establish why each file left. A file nobody has checked yet is the review's own queue, not a fault.",
    statNoReason: "no reason, not checked", statNoReasonUnit: "files",
    statNoReasonTitle: "Show only these",
    /* The article numbers stay in the comments, the way the access log keeps 고시 제8조. On screen
       they are furniture: a reader who needs the citation is the one person here who already has
       it, and an English console printing hangul statute names reads as untranslated copy. The
       duty behind this one is 고시 제8조제2항 and the masking note's is 표준지침 제46조. */
    statNoReasonWhy: "A frame or a result set left with no reason and no authority on the row, and nobody has established one since. This is the slice the record cannot answer for.",
    /* The panel. Its title names the register, because that is what a compliance officer is
       holding when they arrive — 목적 외 이용·제3자 제공 대장. */
    panelTitle: "Register entry",
    panelFileName: "File name",
    panelRequester: "Requested by",
    panelRecipient: "Given to",
    panelLegalBasis: "Legal basis",
    panelPeriod: "Footage covered",
    panelForm: "Form",
    panelReason: "Reason",
    panelReference: "Reference",
    panelSubject: "Whose face",
    panelSurface: "Screen",
    panelActor: "Exported by",
    panelAt: "When",
    reviewHeading: "Monthly review",
    reviewedBy: "Checked by",
    reviewedAt: "Checked",
    reviewNote: "What was established",
    reviewNotePlaceholder: "What you established about why this file left",
    /* Said because the absence of a 「Reason」 row above is invisible — a field that was never
       recorded leaves no line to read. This is what the reviewer has to resolve. */
    reviewNoReason: "No reason was recorded when this file left.",
    reviewConfirm: "Confirm reason",
    /* On the button, because the stamp cannot be taken back and the reader is one press away from
       finding that out. */
    reviewOnce: "Your name and the time are stamped on the row and cannot be removed.",
    reviewedMark: "Checked",
    requesterSubject: "The data subject",
    requesterPolice: "Investigating authority",
    requesterThirdParty: "Third party",
    formCopy: "Copy", formPrint: "Printout", formScreen: "Viewed on screen",
    /* Only on the path where masking is owed — see the header. Said as a fact about the file, not
       as a warning about the operator: nothing on this screen knows whether anybody else was in
       frame. */
    maskNote: "Footage handed to the data subject must have other identifiable people de-identified. This console cannot do that yet.",
    csvActor: "Exported by", csvActorEmail: "Operator address", csvKind: "Kind",
    csvWhat: "What left", csvSurface: "Screen", csvAmount: "Amount",
    csvFileName: "File name", csvRequester: "Requested by", csvRecipient: "Given to",
    csvLegalBasis: "Legal basis", csvPeriod: "Footage covered", csvForm: "Form",
    csvReason: "Reason", csvReference: "Reference", csvAt: "When",
    csvReviewedBy: "Checked by", csvReviewedAt: "Checked", csvReviewNote: "What was established",
  },
  ko: {
    foot: "콘솔이 파일을 만들 때마다 한 줄이 적히고, 이 기록을 내보내는 것도 그중 한 줄이 됩니다.",
    ownerOnly: "Portal에 들어올 수 있는 계정이면 읽습니다 — 최고관리자·관리자·읽기 전용 관리자.",
    empty: "이 프로젝트에서 반출된 것이 없습니다.",
    noMatch: "조건에 맞는 반출 기록이 없습니다.",
    loadFailed: "반출 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    colActor: "반출한 사람", colKind: "구분", colWhat: "반출된 것", colAmount: "분량",
    dispInternal: "내부 이용", dispThirdParty: "제3자 제공", dispSubject: "본인 열람",
    dispUnknown: "기록 없음",
    colReview: "점검", colAt: "시각",
    kindList: "명단", kindFrame: "프레임", kindResults: "분석 결과",
    listName: {
      vips: "VIP 등록", searchLog: "조회 기록", activity: "변경 기록",
      roster: "가입 대기", cameras: "입력 소스",
      accessLog: "접속 기록", exportLog: "반출 기록", handlingLog: "처리 기록",
      vipImportSkipped: "VIP 가져오기 — 건너뛴 행", rosterImportSkipped: "가입 대기 가져오기 — 건너뛴 행",
    } as Record<string, string>,
    unitRows: (n: number) => `${n}행`,
    unitFrames: (n: number) => `${n}장`,
    filterAllDates: "전체 기간",
    filterAllKinds: "전체 종류",
    filterAllActors: "반출한 사람 전체",
    filterAllSubjects: "대상 인물 전체",
    clearFilters: "해제",
    export: "CSV 내보내기",
    exportNothingHeld: "반출된 것이 없어 내보낼 것이 없습니다.",
    exportNoMatch: "조건에 맞는 반출 기록이 없습니다. 파일에는 표에 보이는 행만 담깁니다.",
    statTotal: "건", statTotalLabel: "반출된 파일",
    statFaces: "명", statFacesLabel: "얼굴이 반출된 사람",
    statUnreviewed: "건", statUnreviewedLabel: "점검 안 한 파일",
    publishHeading: "게재", publishedWhere: "게재한 곳", publishedAtLabel: "게재 시각",
    publishedBy: "기록한 사람", publishGazette: "관보", publishWebsite: "자체 홈페이지",
    publishKeepUp: "홈페이지 게재는 10일 이상 유지해야 합니다.",
    publishPending: "아직 게재 기록이 없습니다.",
    publishOverdue: "제공한 지 30일이 지났는데 게재 기록이 없습니다.",
    publishMarkGazette: "관보에 게재함", publishMarkWebsite: "홈페이지에 게재함",
    statUnpublished: "기한 넘긴 게재", statUnpublishedUnit: "건",
    statUnpublishedWhy: "공공기관은 제3자 제공을 30일 안에 관보나 자체 홈페이지에 게재해야 합니다(법 제18조제4항). 30일이 지났는데 게재 기록이 없는 건들입니다. 게재한 뒤 해당 행에서 표시하세요.",
    statUnreviewedTitle: "이 행만 보기",
    statUnreviewedWhy: "점검은 월 1회 이상 하고, 파일이 왜 나갔는지 확인해야 합니다. 아직 아무도 보지 않은 파일은 결함이 아니라 점검할 목록입니다.",
    statNoReason: "사유 없고 점검도 안 됨", statNoReasonUnit: "건",
    statNoReasonTitle: "이 행만 보기",
    statNoReasonWhy: "프레임이나 분석 결과가 사유와 근거 없이 나갔고, 그 뒤로 아무도 사유를 확인하지 않았습니다. 기록이 답할 수 없는 구간입니다.",
    panelTitle: "대장 항목",
    panelFileName: "파일 명칭",
    panelRequester: "요청자 구분",
    panelRecipient: "제공받는 자",
    panelLegalBasis: "법령상 근거",
    panelPeriod: "영상의 범위",
    panelForm: "형태",
    panelReason: "사유",
    panelReference: "참조번호",
    panelSubject: "대상 인물",
    panelSurface: "화면",
    panelActor: "담당자",
    panelAt: "시각",
    reviewHeading: "점검",
    reviewedBy: "점검자",
    reviewedAt: "점검 시각",
    reviewNote: "확인한 내용",
    reviewNotePlaceholder: "이 파일이 왜 나갔는지 확인한 내용",
    reviewNoReason: "이 파일이 나갈 때 사유가 적히지 않았습니다.",
    reviewConfirm: "사유 확인",
    reviewOnce: "이름과 시각이 행에 찍히고, 지울 수 없습니다.",
    reviewedMark: "확인함",
    requesterSubject: "정보주체 본인",
    requesterPolice: "수사기관",
    requesterThirdParty: "제3자",
    formCopy: "사본", formPrint: "출력물", formScreen: "열람",
    maskNote: "정보주체 본인에게 제공하는 영상은 알아볼 수 있는 다른 사람을 비식별 처리해야 합니다. 이 콘솔은 아직 처리하지 못합니다.",
    csvActor: "반출한 사람", csvActorEmail: "반출자 주소", csvKind: "종류",
    csvWhat: "반출된 것", csvSurface: "화면", csvAmount: "분량",
    csvFileName: "파일 명칭", csvRequester: "요청자 구분", csvRecipient: "제공받는 자",
    csvLegalBasis: "법령상 근거", csvPeriod: "영상의 범위", csvForm: "형태",
    csvReason: "사유", csvReference: "참조번호", csvAt: "시각",
    csvReviewedBy: "점검자", csvReviewedAt: "점검 시각", csvReviewNote: "확인한 내용",
  },
} as const;

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * ExportRecord.at AS IT WAS WRITTEN DOWN, and never through a `new Date()` that can throw.
 *
 * ONE BAD ROW MUST NOT TAKE THE LIST. `dateKeyIn` ends in Intl.DateTimeFormat.format(), which
 * raises RangeError: Invalid time value on a Date built from a string the runtime cannot read —
 * and a throw inside the map that draws the rows is not a broken cell, it is a white screen where
 * the audit record was. On a screen whose whole job is producing evidence, that is the worst
 * failure shape available: the reader cannot tell "nothing left this site" from "one row is
 * malformed", and the first of those is a finding somebody writes down.
 *
 * It cannot happen from the console's own writes — every caller passes
 * `new Date().toISOString()` — but `at` becomes the SERVER's value the moment the GET in the
 * header note lands, and this product's stored times are already a mix: the access log's rows
 * carry a bare wall clock ("2026-10-01 09:12") with no offset on it. Handing that to `new Date()`
 * asks the runtime to guess which clock it was, and the guess differs between the machine that
 * renders this page and the browser that hydrates it, so one row would print two different times.
 *
 * So, the access log's rule, verbatim, which keeps the two tabs the same shape: a string carrying
 * a zone (trailing Z or ±hh:mm) is converted into the project's zone; anything else is printed
 * exactly as stored, and a string that is neither is handed back untouched rather than guessed at.
 *
 * HANDOFF: pick one on the server and this branch goes away.
 */
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/;

function stampOf(at: string, zone: string): string {
  if (ZONED.test(at)) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return `${dateKeyIn(d, zone)} ${clockMinutesIn(d, zone)}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(at);
  return m ? `${m[1]} ${m[2]}` : at;
}

/** The calendar day the row PRINTS, for the range filter. Empty where there is none to read —
 *  see stampOf. An unreadable row then fails the range test instead of killing it. */
function dayOf(at: string, zone: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(stampOf(at, zone));
  return m ? m[1] : "";
}

/**
 * LIST STATE — THE SEAM THE FETCH WRITES TO.
 *
 * A list has four states (see PortalShared: rows · empty · loading · failed) and this tab can
 * only ever be in two of them today, because it reads the in-memory store synchronously: there is
 * no second where the rows are in the air, and no request that can come back 500.
 *
 * WHAT REPLACES THIS: the GET in the header note. `listState` becomes that request's own state and
 * `retryList` becomes the refetch the failed state's button calls. Nothing below changes.
 *
 * The ?listState= override is the only reason this reads the URL, and it is ONE line to delete
 * when the fetch lands. Nothing in Portal writes the parameter, so nobody arrives at it by
 * accident.
 */
type ListState = "ready" | "loading" | "failed";

function useListState(): [ListState, () => void] {
  const override = useSearchParams().get("listState");
  const [state, setState] = useState<ListState>(override === "loading" || override === "failed" ? override : "ready");
  return [state, () => setState("ready")];
}

/**
 * Is the record able to say why this file left?
 *
 * Both fields, not just `reason`: a frame handed to an investigator carries its authority in
 * `legalBasis` and may carry no prose reason at all, and calling that row unexplained would raise
 * a defect against the best-documented export on the screen.
 */
function hasReason(e: ExportRecord): boolean {
  return Boolean(e.reason || e.legalBasis);
}

export default function ProjectExportLogTab({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const [listState, retryList] = useListState();
  const exportLog = useVcaStore(s => s.exportLog);
  const recordListExport = useVcaStore(s => s.recordListExport);
  const recordExportReviewed = useVcaStore(s => s.recordExportReviewed);
  const recordExportPublished = useVcaStore(s => s.recordExportPublished);
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  // The project's zone, not the reviewer's browser — a file is filed under the day it left the
  // site. `at` is an ISO instant, so printing a slice of it would file every late-evening export
  // in Seoul under the previous day.
  const projectZone = project?.timeZone ?? PROJECT_TIME_ZONE;
  /* The app's own names for its five screens, from the grants table — one source, so this screen
     and the permission tree cannot end up calling 베스트 프레임 two different things. It is also
     the only map in Portal that covers all five: the look-up log keeps a local one of four and is
     missing bestframe (noted for its owner, not changed here). */
  const { screen: screenName } = useGrantNames();
  const { sort, toggle: toggleSort } = useTableSort<ExportSortKey>({ key: "at", direction: "desc" });

  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const fromDate = range.start ? dateKeyOf(range.start) : "";
  const toDate = range.end ? dateKeyOf(range.end) : "";
  const [kindFilter, setKindFilter] = useState<"ALL" | ExportKind>("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  /*
   * THE MONTHLY CHECK, AS TWO SLICES OF THE SAME LIST.
   *
   * 고시 제8조제2항 has the access record checked at least monthly and, where a download is found,
   * the reason for it established. The reviewer needs to get at two different things, and they are
   * NOT the same question:
   *
   *   "unreviewed" — nobody has looked at this row yet. A property of the REVIEW, and the
   *     reviewer's own worklist. Neutral: on any site that exports anything this is non-zero
   *     between reviews, and an amber card that is permanently lit is a card the reader stops
   *     seeing (the offline-camera lesson).
   *   "noReason"   — the file left with no reason and no legal basis, and nobody has established
   *     one since. A property of the RECORD, and the one state where the log cannot answer the
   *     question it exists to answer. Amber, because somebody has to resolve it, and it drains as
   *     the review is done rather than staying lit for ever.
   *
   * (Owner's question, this round: should the amber card become 「미확인」? No — it should become
   * the INTERSECTION. 「사유 없음」 alone was raising a defect on rows a reviewer had already
   * accounted for, and 「미확인」 alone is a queue rather than a fault. The two cards now say the
   * two different things, and only the second is amber.)
   *
   * Driven from the strip rather than a fourth dropdown, the way the camera list drives its own
   * gap filters: one question asked once a month, with one answer.
   */
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "unreviewed" | "noReason">("ALL");
  /** Which row's panel is open, by id — the record itself is re-read from the store, so stamping
   *  a review updates the open panel instead of leaving it showing the row as it was. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** What the reviewer has typed but not yet stamped. Cleared when the panel changes rows. */
  const [note, setNote] = useState("");

  /* `!e.projectId` is kept: a list that belongs to no single site (the staff roster, the account
     list) still left THIS installation, and dropping it would make the log quietly incomplete. */
  const projectRecords = useMemo(
    () => exportLog.filter(e => !e.projectId || e.projectId === projectId),
    [exportLog, projectId],
  );

  const kindLabel = (k: ExportKind) => (k === "list" ? t.kindList : k === "frame" ? t.kindFrame : t.kindResults);
  /* The register's own division — see ExportRecord.disposition. Undefined is said as 「기록 없음」
     rather than defaulted to 내부 이용: a row written before the field existed was never asked,
     and filling it in here would put an answer in the register that nobody gave. */
  const dispositionLabel = (d: ExportRecord["disposition"]) =>
    d === "thirdParty" ? t.dispThirdParty : d === "subject" ? t.dispSubject
    : d === "internal" ? t.dispInternal : t.dispUnknown;
  /* What left, as one string — the list's own name, or the person the file is about. Used by the
     cell, by the sort and by the CSV, so the three cannot disagree. */
  const whatLeft = (e: ExportRecord) =>
    e.kind === "list" ? (e.list ? t.listName[e.list] ?? e.list : "") : (e.subject ?? "");
  const amount = (e: ExportRecord) => (e.kind === "frame" ? t.unitFrames(e.rowCount) : t.unitRows(e.rowCount));
  const requesterLabel = (r: NonNullable<ExportRecord["requesterKind"]>) =>
    r === "subject" ? t.requesterSubject : r === "police" ? t.requesterPolice : t.requesterThirdParty;
  const formLabel = (f: NonNullable<ExportRecord["form"]>) =>
    f === "copy" ? t.formCopy : f === "print" ? t.formPrint : t.formScreen;
  /* Never `new Date(at)` straight into a formatter — see stampOf. */
  const stamp = (at: string) => stampOf(at, projectZone);

  /*
   * THE THREE KINDS ARE A CLOSED SET, so the filter offers all three whatever the log holds.
   *
   * Same reasoning the look-up log's screen filter is kept on: ExportKind has exactly three
   * members and the store writes one of them, unlike the operators and subjects below, who are
   * whoever happens to have turned up. And filtering to a kind with no rows is a real question
   * with a real answer — 「프레임은 한 장도 나가지 않았다」 is what a reviewer arrives to confirm,
   * and deriving the options from the rows would remove that question exactly when the answer is
   * 「없음」. It is the one control that still says something on an empty log, which is why it is
   * drawn there.
   */
  const kindOptions = KINDS.map(k => ({ value: k, label: kindLabel(k) }));

  /* Keyed by address, not by name: two operators sharing a name would collapse into one option
     and return both their exports under either. Falls back to the name for the rows the app wrote
     before actorEmail existed. */
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    projectRecords.forEach(e => seen.set(e.actorEmail ?? e.actor, e.actor));
    return [...seen].map(([value, name]) => ({ value, label: value === name ? name : `${name} · ${value}` }));
  }, [projectRecords]);

  /* Who the files were about. A name is all ExportRecord carries — there is no subject id — so
     this groups by the string the app wrote, and two people with the same registered name are one
     option. Noted for the server rather than papered over here (see the report). */
  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    projectRecords.forEach(e => { if (e.subject) seen.add(e.subject); });
    return [...seen].map(value => ({ value, label: value }));
  }, [projectRecords]);

  /*
   * Only over the rows that COULD carry a reason. The Portal's CSV buttons predate the register
   * fields and pass none, so counting list rows here would raise a defect against every one of
   * them that nobody could have avoided — the mistake the look-up log avoids by gating its "no
   * reference" count on whether a purpose was ever asked for.
   *
   * AND only while nobody has established one. A reviewer who looked into an undocumented export
   * and wrote down what they found has repaired the record, which is exactly what the monthly
   * check is for; leaving the row in the amber count afterwards would mean the one thing a
   * reviewer can do never changes anything on screen.
   */
  /**
   * THE AXIS IS THE DISPOSITION (2026-10-07, second pass).
   *
   * This counter read `kind !== "list"` first, so a CSV of 122 registered people could leave with
   * no reason given and never appear here while a single frame did. The first fix pointed it at
   * 「does the file carry personal data」, which was closer but still a guess made from the file.
   *
   * The register's own division answers it exactly: a 제3자 제공 or a 본인 열람 WITHOUT a stated
   * reason and a legal basis is a defect somebody has to answer for, and an 내부 이용 download is
   * not — a console user taking a camera list for their own work owes the register nothing beyond
   * the row itself. See ExportRecord.disposition.
   *
   * `undefined` counts, deliberately: a row that never recorded what kind of handing-over it was
   * is the least explained row in the table, not the most innocent one.
   */
  const needsAReason = (e: ExportRecord) => e.disposition !== "internal";
  const unexplained = (e: ExportRecord) => needsAReason(e) && !hasReason(e) && !e.reviewedAt;
  const noReasonCount = projectRecords.filter(unexplained).length;
  /* EVERY row, not only the frames. A spreadsheet of 122 registered people is a download of
     personal data as much as a still is, and the duty is about the download rather than about
     whether a face was in it. */
  const unreviewedCount = projectRecords.filter(e => !e.reviewedAt).length;
  /*
   * 제3자 제공 that a 공공기관 has not published, past the 30 days 법 제18조제4항 allows.
   *
   * Only counted where the site has SAID it is a public authority — see Project.publicAuthority.
   * On every other installation this is not a duty, and a counter for it would be the screen
   * inventing an obligation. Rows still inside the 30 days are not overdue and are not amber: the
   * clock has not run out, and colouring them would teach the reader to ignore the colour.
   */
  const isPublicAuthority = project?.publicAuthority === true;
  const publishOverdue = (e: ExportRecord) => {
    if (!isPublicAuthority || e.disposition !== "thirdParty" || e.publishedAt) return false;
    const days = (Date.now() - new Date(e.at).getTime()) / 86_400_000;
    return days > 30;
  };
  const publishOverdueCount = projectRecords.filter(publishOverdue).length;
  const faceCount = new Set(projectRecords.filter(e => e.subject).map(e => e.subject)).size;

  const rows = projectRecords
    .filter(e => kindFilter === "ALL" || e.kind === kindFilter)
    .filter(e => actorFilter === "ALL" || (e.actorEmail ?? e.actor) === actorFilter)
    .filter(e => subjectFilter === "ALL" || e.subject === subjectFilter)
    .filter(e => reviewFilter === "ALL"
      || (reviewFilter === "unreviewed" ? !e.reviewedAt : unexplained(e)))
    // Compared in the project's own zone, the same one the rows print. A range picked as
    // "2026-09-15" means that day at the site, not a UTC slice of it that starts nine hours early.
    .filter(e => {
      if (!fromDate && !toDate) return true;
      /* Through dayOf, not `new Date()` — a row with an unreadable stamp would otherwise throw
         here, which means the whole tab dies the moment somebody sets a date. A row with no day
         to read falls outside every bounded range and stays visible while the range is open. */
      const day = dayOf(e.at, projectZone);
      if (!day) return false;
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });

  const visible = sortRows(rows, sort, (e, key) => {
    switch (key) {
      /* The stamp the row PRINTS, like the access log's — raw `at` would sort a full instant
         ("…T05:00:00Z") against a bare wall clock ("2026-10-01 14:00") as text and interleave
         them wrongly, and the reader can only check an order against what they can see. */
      case "at": return stamp(e.at);
      // By the address, so two people with the same name do not interleave.
      case "actor": return `${e.actor}\u0000${e.actorEmail ?? ""}`.toLowerCase();
      // By the printed word, so the grouping a reader sees is the grouping they asked for.
      case "kind": return kindLabel(e.kind).toLowerCase();
      case "what": return whatLeft(e).toLowerCase();
      /* Unchecked rows sort as the empty string, so descending — the table's default direction —
         puts the checked ones first and ascending brings the reviewer's queue to the top. */
      case "review": return e.reviewedAt ? stamp(e.reviewedAt) : "";
    }
  });

  const activeFilterCount = [kindFilter, actorFilter, subjectFilter, reviewFilter].filter(v => v !== "ALL").length
    + (fromDate ? 1 : 0) + (toDate ? 1 : 0);
  const clearFilters = () => {
    setKindFilter("ALL"); setActorFilter("ALL"); setSubjectFilter("ALL");
    setRange({ start: null, end: null }); setReviewFilter("ALL");
  };
  /* Pressing a lit card again clears it, and pressing the other one swaps — two cards selecting
     two slices of one list cannot both be on, and a reader who has to work out which combination
     they are looking at has lost the plot of their own review. */
  const toggleReview = (slice: "unreviewed" | "noReason") =>
    setReviewFilter(cur => (cur === slice ? "ALL" : slice));

  /** The open row, re-read from the store so a review stamped in the panel appears in it. */
  const openRow = openId ? projectRecords.find(e => e.id === openId) : undefined;
  const closePanel = () => { setOpenId(null); setNote(""); };
  const confirmReview = () => {
    if (!openRow) return;
    // The note is optional in the call and usually the point of it: on a row with no reason it is
    // the only place the established reason can be written down. Blank rather than invented when
    // the reviewer typed nothing.
    recordExportReviewed({ exportId: openRow.id, note: note.trim() || undefined });
    setNote("");
  };

  /*
   * NOTHING IS HELD, SO NOTHING IS OFFERED TO NARROW IT.
   *
   * The same call both record tabs next door make: on a project nobody has exported from, a date
   * range, two person filters and four sortable headings over zero rows are controls that answer
   * every press with the table already on screen — and the reader carries that lesson to the
   * screen where the controls do work.
   *
   * KEYED OFF THE LOG, NOT OFF THE TABLE, so a filter that matches nothing never takes away the
   * way back out of itself.
   *
   * The kind filter is the exception and it is not an oversight — see kindOptions.
   */
  const nothingHeld = projectRecords.length === 0;

  /* Empty log or empty filter — the same split the table body makes, said once so the button and
     the empty row cannot drift apart. undefined while there is something to export: a title on a
     live control is a tooltip nobody asked for. */
  const exportBlocked = visible.length > 0 ? undefined
    : nothingHeld ? t.exportNothingHeld : t.exportNoMatch;

  const exportCsv = () => {
    /*
     * THE RECURSION, AND WHAT IS DONE ABOUT IT.
     *
     * Exporting the export log is itself an export, so this button writes a row like every other
     * export button in Portal. It could not at first: `ExportRecord["list"]` had five members and
     * none of them named this screen, and the two wrong ways out were to pass somebody else's key
     * (a forged row, in the one log whose whole value is that its rows are true) or to record
     * nothing (invisible — the exact failure this screen was built to end). The union now carries
     * `"exportLog"`, so neither is needed.
     *
     * The recursion is not a problem to be solved: downloading the log IS one of the downloads the
     * monthly review has to account for, and it is the one that carries every other row with it.
     * A row appears in the table the moment the file is written, which is why the footnote says so
     * — otherwise the next reader finds a row naming this screen and cannot place it.
     */
    /*
     * THE FILE CARRIES EVERY FIELD THE SCREEN CARRIES, columns in the table's own order and the
     * register items after them.
     *
     * More columns than the table has, and deliberately: the register items and the operator's
     * address are all ON the screen — behind the row and on the actor's second line — and the
     * spreadsheet has no panel to hide them in. The bug to avoid is the opposite one, which the
     * look-up log was carrying: a file with FEWER columns than the table, so the record an auditor
     * reads and the file they are handed disagree about which fields the log even has.
     *
     * This file IS the 대장 a 공공기관 is inspected against, so the seven items keep the register's
     * own order rather than being appended as an afterthought. The three review columns come last
     * because they are not part of the register — they are what somebody did about it afterwards —
     * and they go out with the file because a review nobody can produce is a review that did not
     * happen, which is this screen's own founding argument one step further out.
     */
    const header = [
      t.csvActor, t.csvActorEmail, t.csvKind, t.csvWhat, t.csvSurface, t.csvAmount,
      t.csvFileName, t.csvRequester, t.csvRecipient, t.csvLegalBasis, t.csvPeriod, t.csvForm,
      t.csvReason, t.csvReference, t.csvAt,
      t.csvReviewedBy, t.csvReviewedAt, t.csvReviewNote,
    ];
    /* Empty, never a dash and never a guess. A blank cell is "nothing was recorded"; anything
       printed there is this screen claiming something the operator did not say. */
    const body = visible.map(e => [
      e.actor, e.actorEmail ?? "", kindLabel(e.kind), whatLeft(e),
      e.surface ? screenName[e.surface] : "",
      // The number alone: the kind is its own column, so the unit is already said, and a
      // spreadsheet wants to be able to add the column up.
      String(e.rowCount),
      e.fileName ?? "", e.requesterKind ? requesterLabel(e.requesterKind) : "", e.recipient ?? "",
      e.legalBasis ?? "", e.period ?? "", e.form ? formLabel(e.form) : "",
      e.reason ?? "", e.reference ?? "",
      stamp(e.at),
      e.reviewedBy ?? "", e.reviewedAt ? stamp(e.reviewedAt) : "", e.reviewNote ?? "",
    ]);
    const csv = [header, ...body].map(row => row.map(csvEscape).join(",")).join("\n");
    // BOM so Excel reads the Korean headings as UTF-8 rather than the local code page.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? projectId}-exports.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordListExport({ projectId, list: "exportLog", rowCount: body.length });
  };

  return (
    <div>
      {/* No strip on an empty log: three cards reading 0 describe a slice that does not exist, and
          the empty state is the first thing anybody sees on this screen. */}
      {!nothingHeld && (
        <SummaryStrip cells={[
          { key: "total", icon: <FileOutput size={14} strokeWidth={2.4} />, figure: projectRecords.length, unit: t.statTotal, label: t.statTotalLabel, tone: "neutral" },
          /* Drawn at zero as well, and that is the point of it: 「이 사이트에서 얼굴이 나간 적은
             없다」 is the finding a compliance officer comes for, and a card that disappears when
             the answer is none makes them go looking for it in the table. */
          { key: "faces", icon: <ScanFace size={14} strokeWidth={2.4} />, figure: faceCount, unit: t.statFaces, label: t.statFacesLabel, tone: "neutral" },
          /* THE REVIEW'S WORKLIST, and drawn at zero as well. 「점검할 것이 없다」 is what a
             reviewer finishing a month wants to see said, and a card that vanishes when the
             count reaches zero takes the confirmation away at the moment it is earned.
             Neutral, not amber — see reviewFilter. */
          { key: "unreviewed", icon: <SearchCheck size={14} strokeWidth={2.4} />, figure: unreviewedCount,
            unit: t.statUnreviewed, label: t.statUnreviewedLabel, tone: "neutral",
            explanation: t.statUnreviewedWhy,
            onClick: () => toggleReview("unreviewed"), active: reviewFilter === "unreviewed", title: t.statUnreviewedTitle },
          /* Amber, and only when there is something somebody has to do about it — see
             noReasonCount. It drains as the review is done. */
          ...(noReasonCount > 0 ? [{
            key: "noreason", icon: <ShieldAlert size={14} strokeWidth={2.4} />, figure: noReasonCount,
            unit: t.statNoReasonUnit, label: t.statNoReason, tone: "warning" as const,
            explanation: t.statNoReasonWhy,
            onClick: () => toggleReview("noReason"), active: reviewFilter === "noReason", title: t.statNoReasonTitle,
          }] : []),
          /* The same rule the amber card above follows: drawn only when somebody has to act. A
             public authority 30 days past a 제3자 제공 with nothing published is the one state
             this register can call overdue by itself. */
          ...(publishOverdueCount > 0 ? [{
            key: "unpublished", icon: <Megaphone size={14} strokeWidth={2.4} />, figure: publishOverdueCount,
            unit: t.statUnpublishedUnit, label: t.statUnpublished, tone: "warning" as const,
            explanation: t.statUnpublishedWhy,
          }] : []),
        ]} state={listState} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: TOOLBAR_GAP }}>
        {/* First in the row, because it is the question an auditor arrives with — every comparable
            log (Okta, 1Password, Vanta, Datadog) puts the range ahead of the rest. */}
        {!nothingHeld && (
          <span style={{ display: "flex", alignItems: "center", width: "260px", flexShrink: 0 }}>
            <DateRangeTrigger lang={lang} value={range} onApply={setRange} emptyText={t.filterAllDates} />
          </span>
        )}
        {/* Hidden on an empty log, like the range above and the strip above that. This was the one
            control left standing over 「이 프로젝트에서 반출된 것이 없습니다」 — so the screen offered
            to narrow nothing, and picking a kind there left 「조건에 맞는 반출 기록이 없습니다」 in
            place of the finding an auditor came to read. (It is also the state the owner was looking
            at, 2026-10-06.) The three kinds stay a closed set for a log that HAS rows; see the note
            on kindOptions. */}
        {!nothingHeld && (
          <FilterSelect value={kindFilter} onChange={v => setKindFilter(v as "ALL" | ExportKind)}
            active={kindFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllKinds }, ...kindOptions]} />
        )}
        {/* Each appears once it can narrow something. On a log with one exporter this offered
            「전체」 and one name — a control that changes nothing, on the screen where the reader
            most needs to trust what the controls mean. */}
        {actorOptions.length > 1 && (
          <FilterSelect value={actorFilter} onChange={setActorFilter} active={actorFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllActors }, ...actorOptions]} />
        )}
        {/* From ONE subject upward, unlike the actor filter: with a single name in the log and any
            list rows beside it, picking that name still narrows the table to the files about them,
            which is the question this screen exists to answer. */}
        {subjectOptions.length > 0 && (
          <FilterSelect value={subjectFilter} onChange={setSubjectFilter} active={subjectFilter !== "ALL"}
            options={[{ value: "ALL", label: t.filterAllSubjects }, ...subjectOptions]} />
        )}
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} />
        <span style={{ flex: 1 }} />
        {/* WHY THE GREY BUTTON SAYS WHICH KIND OF NOTHING IT IS. "Nothing has ever left this
            project" and "your range matched nothing" send an auditor to opposite conclusions, and
            the first is a finding somebody writes down. Greyed with no sentence, it is what a
            reader assumes.

            On the wrapper as well as the button: a disabled button dispatches no pointer events,
            and browsers differ on whether they still show its own title — the span is hovered
            either way. */}
        <span title={exportBlocked} style={{ display: "inline-flex" }}>
          <button className="portal-btn-quiet" onClick={exportCsv} disabled={visible.length === 0} title={exportBlocked}
            style={{
              display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px",
              borderRadius: RADIUS.control, border: "none", backgroundColor: "transparent",
              color: visible.length === 0 ? "var(--gray-300)" : "var(--gray-600)",
              fontSize: "12px", fontWeight: 600, cursor: visible.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}>
            <FileOutput size={14} strokeWidth={2.4} />
            {t.export}
          </button>
        </span>
      </div>

      <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID,
          columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)",
          borderBottom: TABLE_RULE, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS,
          color: TABLE_HEADER_COLOR,
        }}>
          {([
            { label: t.colActor, key: "actor" as ExportSortKey },
            { label: t.colKind, key: "kind" as ExportSortKey },
            { label: t.colWhat, key: "what" as ExportSortKey },
            /* Not sortable. Comparing a 981-row camera list against a 1-frame still ranks two
               different units against each other, and the number a reviewer wants biggest is not
               the number this would put on top. */
            { label: t.colAmount },
            /* Sortable, because "show me everything nobody has checked" is the review's first
               move and the strip's card only gives it as a filter — sorting puts the unchecked
               rows together inside whatever slice the reviewer has already narrowed to. */
            { label: t.colReview, key: "review" as ExportSortKey },
            { label: t.colAt, key: "at" as ExportSortKey },
            /* The chevron gutter. No heading — it is not a field, it is the way into the row. */
            { label: "" },
          ] as { label: string; key?: ExportSortKey }[]).map((h, i) => (
            /* No key while nothing is held — SortableHeader then draws plain text, which is what a
               column with nothing under it can honestly be. The column keeps its name and stops
               offering to reorder nothing. */
            <span key={i}><SortableHeader label={h.label} sortKey={nothingHeld ? undefined : h.key} sort={sort} onToggle={toggleSort} /></span>
          ))}
        </div>

        {/* Loading is checked BEFORE empty, and that order is the whole point of the branch. "Nothing
            has been exported from this project" read off a request still in the air is a false
            answer that looks exactly like a true one, and on this log it is the answer somebody
            writes into an inspection. */}
        {listState === "loading" ? (
          <TableSkeleton grid={GRID} />
        ) : listState === "failed" ? (
          <TableLoadFailed text={t.loadFailed} retryLabel={t.retry} onRetry={retryList} />
        ) : visible.length === 0 ? (
          /* Two sentences, and the difference is the finding. "Nothing ever left here" is
             something an auditor writes down; "your filters matched nothing" is their own filter
             and they should widen it. */
          <TableEmpty text={nothingHeld ? t.empty : t.noMatch} />
        ) : visible.map((e, i) => {
          /*
           * EVERY ROW OPENS NOW, and it did not before.
           *
           * The chevron used to mean "this row has a register entry", which was a real signal
           * while the panel held nothing else. The review changed that: a row with no register
           * items is exactly the row a reviewer has to open, because the confirmation is the one
           * thing behind it — and a list export is a download of personal data too, so it is in
           * the review's scope as much as a still is. A table where the rows a reviewer must act
           * on are the only ones that do not open would be the worst possible arrangement of the
           * same two facts.
           */
          return (
            <div key={e.id}
              /* The row is the control, the way the camera and account lists already work —
                 rather than a button in a gutter, which would put a second tab stop on every row
                 for the same destination. */
              role="button" tabIndex={0}
              onClick={() => { setOpenId(e.id); setNote(""); }}
              onKeyDown={(ev: React.KeyboardEvent) => {
                if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(e.id); setNote(""); }
              }}
              /* The camera list's own class, so every row reacts to a pointer the way every other
                 openable row in Portal does (owner, on that table: 어쨌든 쟤만 호버가 안 되는 게
                 너무 어색해). */
              className="portal-attention-row"
              style={{
                display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP,
                padding: "10px 16px", alignItems: "center",
                borderBottom: i === visible.length - 1 ? "none" : TABLE_RULE,
                cursor: "pointer", textAlign: "left", font: "inherit",
              }}>
              {/* Name over address, the shape every comparable audit log uses. The name is what a
                  reader recognises; the address is what makes the row name ONE person, and telling
                  two operators of the same name apart is the whole job of this log. */}
              <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.actor}
                </span>
                {e.actorEmail && (
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.actorEmail}
                  </span>
                )}
              </span>

              {/* THE KIND, AS A MARK AND A WORD — not a coloured chip.
                  A frame leaving is not a fault and a list leaving is not a success, and the
                  product's colour vocabulary says amber means somebody has to fix something. Every
                  audit log worth copying agrees: Okta and PlanetScale set the event's type in small
                  grey beside the row, and the one product that tints it (Firecrawl) is the outlier.
                  The glyph is what makes the two kinds scannable down the column. */}
              <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                <span style={{ flexShrink: 0, width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                  {(() => { const Icon = KIND_ICON[e.kind]; return <Icon size={15} strokeWidth={2.1} color="var(--gray-400)" />; })()}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                  {/* 제3자 제공 carries the weight because it is the row an inspector arrives for.
                      내부 이용 stays grey — it is a download to be reviewed, not a 대장 event. */}
                  <span style={{
                    fontSize: "12px", fontWeight: e.disposition === "thirdParty" ? 700 : 600,
                    color: e.disposition === "thirdParty" ? "var(--gray-900)" : "var(--gray-500)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {dispositionLabel(e.disposition)}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {kindLabel(e.kind)}
                  </span>
                </span>
              </span>

              {/* WHAT LEFT — and both kinds get the same weight on the first line.
                  A list's own name and a person's name are both the answer to "what left", so the
                  face does not get smaller type than the camera list; the screen it left from rides
                  underneath, exactly where the actor cell puts an address. That shape is why a
                  frame row cannot read as a footnote to the spreadsheets around it. */}
              <span style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={whatLeft(e)}>
                  {whatLeft(e)}
                </span>
                {e.surface && (
                  <span style={{ fontSize: "11px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {screenName[e.surface]}
                  </span>
                )}
              </span>

              {/* The unit is in the cell because it changes with the kind: 981행 and 1장 are not
                  the same measurement, and a bare "1" beside a bare "981" invites the reader to
                  compare them. */}
              <span style={{ fontSize: "12px", color: "var(--gray-600)", whiteSpace: "nowrap" }}>
                {amount(e)}
              </span>

              {/* SAID ON THE EXCEPTION, NOT ON THE RULE — the activity log's rule for its own
                  「서버 미기록」 mark. A reviewed row carries a mark because somebody did something;
                  an unreviewed one is blank, because that is the ordinary state of a row nobody
                  has got to yet, and badging every one of them would make the badge the
                  background. The count of blanks is in the strip, where a number belongs.

                  Grey, not green. A completed review is a fact, not good news, and the product
                  keeps colour for what asks to be acted on. Who and when ride in the title: the
                  cell is a column a reviewer scans, and two more lines in it would make every
                  checked row taller than the rest. */}
              {e.reviewedAt ? (
                <span title={`${e.reviewedBy ?? ""} · ${stamp(e.reviewedAt)}`}
                  style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0, color: "var(--gray-500)" }}>
                  <CheckCircle2 size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ fontSize: "11px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.reviewedMark}
                  </span>
                </span>
              ) : <span />}

              {/* Monospace, like both tabs next door — a column of stamps only lines up if the
                  digits do. */}
              <span style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {stamp(e.at)}
              </span>

              {/* The way in. Every row has one now — see the note at the top of the map. */}
              <span style={{ display: "flex", justifyContent: "flex-end", color: "var(--gray-300)" }} aria-hidden="true">
                <ChevronRight size={14} strokeWidth={2.4} />
              </span>
            </div>
          );
        })}
      </div>

      {/* One line, both facts (owner's rule for the tab next door: 이거는 한줄로 표기해줘). Two
          stacked greys under a table read as a paragraph somebody has to decide whether to read;
          joined, it is one note about this log — what it does and does not hold, and who sees it.
          Neither half is visible in the rows, which is the test for whether a sentence belongs
          under a table at all. */}
      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45, marginTop: "12px" }}>
        {t.foot} {t.ownerOnly}
      </p>

      {/*
        THE REGISTER ENTRY, BEHIND THE ROW.

        목적 외 이용·제3자 제공 대장, 표준 개인정보 보호지침 제42조제1항 — the seven items in the
        register's own order, then what the row already showed, so the panel reads as one record
        rather than as a list of leftovers.

        EVERY FIELD IS DROPPED WHEN IT IS EMPTY rather than printed with a dash. A dash in a
        register says "this was recorded as nothing"; absence says "this was never recorded", and
        those are different answers to an inspector. The app's frame export is what fills them, and
        on a row exported before it asked, the honest panel is a short one.

        No edit and no delete, by 고시 제8조제3항.
      */}
      {openRow && (
        /* The footer holds the one action, out of the scrolling body so it cannot fall off the
           bottom of a long register — Drawer's own rule. `dirty` guards the typed note against the
           scrim and Escape: a reviewer who has written two sentences about why a file left should
           not lose them to a click aimed at the table behind. */
        <Drawer
          title={t.panelTitle}
          onClose={closePanel}
          width="440px"
          dirty={!openRow.reviewedAt && note.trim().length > 0}
          footer={openRow.reviewedAt ? undefined : (
            <span style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
              {/* On the footer rather than inside the button, because it is a consequence and not
                  a label. Said BEFORE the press: a stamp that cannot be removed is the one thing a
                  reader should know while deciding, not after finding out. */}
              <span style={{ flex: 1, fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.4 }}>
                {t.reviewOnce}
              </span>
              <PanelPrimary onClick={confirmReview} label={t.reviewConfirm} />
            </span>
          )}
        >
          <PairGrid spaced>
            {openRow.fileName && <PairItem label={t.panelFileName}>{openRow.fileName}</PairItem>}
            {openRow.subject && <PairItem label={t.panelSubject}>{openRow.subject}</PairItem>}
            {openRow.surface && <PairItem label={t.panelSurface}>{screenName[openRow.surface]}</PairItem>}
            {openRow.requesterKind && (
              <PairItem label={t.panelRequester}>
                <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)" }}>
                    {requesterLabel(openRow.requesterKind)}
                  </span>
                  {/* Said only on the one path where de-identification is actually owed, and said
                      about the FILE rather than about the operator: nothing on this screen knows
                      whether anybody else was in frame. Grey, not amber — it is the state of this
                      console, not a defect in this row. */}
                  {openRow.requesterKind === "subject" && (
                    <span style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.45 }}>{t.maskNote}</span>
                  )}
                </span>
              </PairItem>
            )}
            {openRow.recipient && <PairItem label={t.panelRecipient}>{openRow.recipient}</PairItem>}
            {openRow.legalBasis && <PairItem label={t.panelLegalBasis}>{openRow.legalBasis}</PairItem>}
            {openRow.period && <PairItem label={t.panelPeriod}>{openRow.period}</PairItem>}
            {openRow.form && <PairItem label={t.panelForm}>{formLabel(openRow.form)}</PairItem>}
            {openRow.reason && <PairItem label={t.panelReason}>{openRow.reason}</PairItem>}
            {openRow.reference && <PairItem label={t.panelReference}>{openRow.reference}</PairItem>}
            {/* ⑦ 담당자 and the instant, last — the two the table already showed, repeated here so
                the panel can be read on its own as the register row it is. */}
            <PairItem label={t.panelActor}>
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)" }}>{openRow.actor}</span>
                {openRow.actorEmail && <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>{openRow.actorEmail}</span>}
              </span>
            </PairItem>
            <PairItem label={t.panelAt}>{stamp(openRow.at)}</PairItem>
          </PairGrid>

          {/*
            THE MONTHLY REVIEW — 고시 제8조제2항.
            
            Below the register and ruled off from it, because it is not part of it: the register
            says what left, this says somebody checked why. Two headings would have been two cards;
            one hairline and a small caption is the separation the settings pages use for the same
            job.
            
            Either it has been done or it has not, and there is no third shape. Done, it is three
            facts and no control — no edit, no revert (see the header). Not done, it is the one
            thing missing from the record and a field to put it in.
          */}
          {/*
            THE 게재, ABOVE THE 점검 AND ONLY WHERE IT IS A DUTY (법 제18조제4항).

            A public authority publishes a third-party release within 30 days. Nothing here does
            the publishing — it happens in a gazette or on the body's own site — so this records
            that somebody did it, the same shape the review below uses. Drawn only on a 제3자 제공
            row of an installation that has said it is a public authority: on a 내부 이용 row or a
            private customer's register it would be a question about a duty that does not exist.
          */}
          {isPublicAuthority && openRow.disposition === "thirdParty" && (
            <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: BORDER }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", color: "var(--gray-500)", marginBottom: "16px" }}>
                {t.publishHeading.toUpperCase()}
              </p>
              {openRow.publishedAt ? (
                <PairGrid spaced>
                  <PairItem label={t.publishedWhere}>
                    {openRow.publishedWhere === "gazette" ? t.publishGazette : t.publishWebsite}
                  </PairItem>
                  <PairItem label={t.publishedAtLabel}>{stamp(openRow.publishedAt)}</PairItem>
                  <PairItem label={t.publishedBy}>{openRow.publishedBy ?? ""}</PairItem>
                  {/* THE 10-DAY CLAUSE, SAID WHERE IT BECOMES A DUTY. 법 제18조제4항 sets two
                      things: publish within 30 days, and a website posting stays up at least ten.
                      The second binds nobody until the website is the answer — on a gazette row it
                      is noise, and in the settings tip, where the switch is turned on, it was part
                      of what made that tip three times the length of its neighbours. This console
                      cannot see the posting, so it states the rule and stops there. */}
                  {openRow.publishedWhere === "website" && (
                    <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>{t.publishKeepUp}</p>
                  )}
                </PairGrid>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ fontSize: "12px", color: publishOverdue(openRow) ? "var(--warning-500)" : "var(--gray-600)", lineHeight: 1.5 }}>
                    {publishOverdue(openRow) ? t.publishOverdue : t.publishPending}
                  </p>
                  {/* Two buttons rather than a picker: the article names exactly two places, and a
                      dropdown of two is a click more for the same answer. */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["gazette", "website"] as const).map(where => (
                      <button key={where} type="button" className="portal-btn-quiet"
                        /* No toast: the block it sits in swaps to the three recorded facts the
                           moment this is pressed, which is the same answer a toast would give and
                           it stays on screen. */
                        onClick={() => recordExportPublished({ exportId: openRow.id, where })}
                        style={{ height: CONTROL_HEIGHT, padding: "0 12px", borderRadius: RADIUS.control, border: "none",
                          backgroundColor: "var(--gray-50)", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit" }}>
                        {where === "gazette" ? t.publishMarkGazette : t.publishMarkWebsite}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: BORDER }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", color: "var(--gray-500)", marginBottom: "16px" }}>
              {t.reviewHeading.toUpperCase()}
            </p>
            {openRow.reviewedAt ? (
              <PairGrid spaced>
                <PairItem label={t.reviewedBy}>{openRow.reviewedBy ?? ""}</PairItem>
                <PairItem label={t.reviewedAt}>{stamp(openRow.reviewedAt)}</PairItem>
                {/* Absent when the reviewer wrote nothing. A heading over an empty box would read
                    as a note that failed to load, and "they confirmed it and said nothing" is
                    what a blank field honestly is. */}
                {openRow.reviewNote && <PairItem label={t.reviewNote}>{openRow.reviewNote}</PairItem>}
              </PairGrid>
            ) : (
              <PairGrid spaced>
                {/* WHY THIS SENTENCE IS NOT REDUNDANT. The register above prints no 「사유」 row
                    at all when none was recorded, and an absent row is invisible — the reviewer
                    would have to notice something that is not there. This is the one thing they
                    have to resolve, so it is said rather than left to be inferred. Only where it
                    is true; a row that carries a reason or a legal basis gets no line. */}
                {!hasReason(openRow) && (
                  <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5 }}>{t.reviewNoReason}</p>
                )}
                <PairItem label={t.reviewNote}>
                  <textarea
                    value={note}
                    onChange={ev => setNote(ev.target.value)}
                    placeholder={t.reviewNotePlaceholder}
                    style={{
                      width: "100%", boxSizing: "border-box", minHeight: "84px", resize: "vertical",
                      border: BORDER, borderRadius: RADIUS.control, padding: "10px 12px",
                      fontFamily: "inherit", fontSize: "13px", lineHeight: 1.5,
                      color: "var(--gray-900)", backgroundColor: "white",
                    }}
                  />
                </PairItem>
              </PairGrid>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
