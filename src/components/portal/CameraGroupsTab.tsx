"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, Plus, RotateCcw } from "lucide-react";
import {
  cameraGroupsInProject, camerasInProject, hasPosition, useVcaStore, type Camera, type CameraGroup,
} from "@/lib/vcaStore";
import CameraMapView from "./CameraMapView";
import { usePortalLanguage } from "@/lib/i18n";
import { useToast } from "../Toast";
import {
  FormLabel,
  BORDER, CARD_BORDER, CARD_RADIUS, CONTROL_HEIGHT, PANEL_SHADOW, TextField,
  ConfirmModal, Drawer, FieldError, PanelCancel, PanelPrimary, RequiredMark, RowActionsMenu, usePortalEditAccess,
} from "./PortalShared";

/**
 * CAMERA GROUPS, ON THE SCREEN THAT HANDS THEM OUT.
 *
 * The owner's question (2026-09-21): 권한을 주기위한 카메라 그룹을 계정, 명부대기, 옆에 탭을
 * 새로 만들어서 그룹핑하게끔 할까? Yes for the LIST, no for the membership — and the split is the
 * point of this file.
 *
 * WHERE THE PRODUCTS PUT IT. Milestone keeps device groups in the device tree, with the devices;
 * Verkada's equivalent (sites) is an org-structure object managed away from the user list. Both
 * put the grouping where the cameras are, because that is where you can see, search and filter
 * them — and ours does too: a group can also be created from the selection on Input Sources,
 * which already has the search, the kind filter and the map.
 *
 * WHAT THIS TAB IS FOR is the question the OTHER screen cannot answer: who holds this group. An
 * access review arrives asking "which accounts can watch the north gate", and until now the only
 * way to answer was to open every account's scope dialog one at a time. That is the reverse
 * lookup every card carries, and it is also where a group is renamed, described, refilled or
 * deleted, because all of those are access changes: deleting one narrows everybody who held it
 * (removeCameraGroup prunes the scopes and says how many in the audit line).
 *
 * CARDS, NOT A TABLE (owner, 2026-09-22, choosing from a reference mockup). A table row is the
 * right shape when its columns are being compared down the page; these are not compared, they are
 * RECOGNISED — "is there already a group like the one I am about to make" is answered by reading a
 * name, a purpose line and a few camera names together, which is a card. The count of accounts
 * holding it stays on every card, because that is this tab's own question.
 *
 * ONLY THE STRUCTURE CAME FROM THE MOCKUP (owner: 그 보낸준 코드의 색깔을 따라갈 필요는없어 우리가
 * 만들어준 컬러와 폰트 시스템과 컨텐츠 자체는 바꾸지않아야하거든). Its per-card indigo and emerald
 * folder icons, its coloured count pills and its explanation sentences are not here: greys by
 * default, our own wording, and no line that the layout already says.
 */

const T = {
  en: {
    empty: "No groups on this project yet.",
    cameras: (n: number) => `${n} camera${n === 1 ? "" : "s"}`,
    camerasNone: "Empty",
    holders: (n: number) => `Held by ${n} account${n === 1 ? "" : "s"}`,
    holdersNone: "Held by nobody",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    cardEdit: "Edit",
    remove: "Delete", cancel: "Cancel",
    goToCameras: "Go to Input Sources",
    membersSearch: "Search by name or code",
    membersNone: "No camera on this project matches that.",
    andMore: (n: number) => `and ${n} more`,
    noZone: "No zone",
    zonePick: "select all", zoneClear: "clear",
    zoneInGroup: "In this group",
    back: "Back",
    allPick: "Select all", allClear: "Clear selection",
    pickHeading: "Select cameras",
    inGroupUnknown: "No longer registered",
    inGroupRemove: "Take out of the group",
    viewList: "List", viewMap: "Map",
    drawerNew: "New camera group",
    drawerEdit: (label: string) => `Edit ${label}`,
    createSave: "Create group",
    editSave: "Save",
    createName: "Group name",
    createNamePlaceholder: (example: string) => `e.g. ${example}`,
    createNameExample: (zone: string) => `${zone} and around`,
    createNameExampleNoZone: "Front and back gate",
    descField: "Description",
    descOptional: "optional",
    viewLabel: "How to view groups",
    viewCards: "Cards",
    legendUngrouped: "Not in a group",
    createButton: "New group",
    createdToast: "Camera group created",
    savedToast: "Camera group saved",
    inOtherGroups: (n: number) => `in ${n} other`,
    inOtherGroupsTitle: (names: string) => `Also in: ${names}`,
    pickedCount: (n: number) => `${n} picked`,
    duplicate: "Another group on this project already has that name.",
    removeTitle: (label: string) => `Delete ${label}?`,
    removeBody: "Every account holding this group loses those cameras, unless another group or an individual camera still covers them. The cameras themselves are untouched.",
    removeWithHolders: (n: number) => `${n} account${n === 1 ? "" : "s"} hold${n === 1 ? "s" : ""} it right now.`,
    removeConfirm: "Delete group",
    removedToast: "Group deleted",
    notOwner: "Only an owner changes camera groups.",
  },
  ko: {
    empty: "이 프로젝트에 아직 그룹이 없습니다.",
    cameras: (n: number) => `${n}대`,
    camerasNone: "비어 있음",
    holders: (n: number) => `${n}개 계정이 가짐`,
    holdersNone: "가진 계정 없음",
    createdBy: (who: string, when: string) => `${who} · ${when}`,
    cardEdit: "편집",
    remove: "삭제", cancel: "취소",
    goToCameras: "입력 소스로 가기",
    membersSearch: "이름이나 코드로 검색",
    membersNone: "그 조건에 맞는 카메라가 이 프로젝트에 없습니다.",
    andMore: (n: number) => `외 ${n}대`,
    noZone: "구역 미지정",
    zonePick: "전체 선택", zoneClear: "해제",
    zoneInGroup: "이 그룹의 카메라",
    back: "뒤로",
    allPick: "모두 선택", allClear: "선택 초기화",
    /* 「이 그룹에 들어있는 것」이었다 (사용자: 좀더 쉽고 직관적인 단어로). 그 말은 무엇이
       담겼는지를 설명하려 했는데, 이 줄이 머리에 붙어 있는 것은 고르는 칸이고 옆의 숫자가
       이미 몇 개 담겼는지 말한다. 시안도 「카메라 선택」을 쓴다. */
    pickHeading: "카메라 선택",
    inGroupUnknown: "등록부에 없는 카메라",
    inGroupRemove: "그룹에서 빼기",
    viewList: "목록", viewMap: "지도",
    drawerNew: "새 카메라 그룹",
    drawerEdit: (label: string) => `${label} 수정`,
    createSave: "그룹 만들기",
    editSave: "저장",
    createName: "그룹 이름",
    createNamePlaceholder: (example: string) => `예: ${example}`,
    createNameExample: (zone: string) => `${zone} 일대`,
    createNameExampleNoZone: "정문·후문",
    descField: "그룹 설명",
    descOptional: "선택",
    viewLabel: "그룹 보는 방법",
    viewCards: "카드",
    legendUngrouped: "그룹 없음",
    createButton: "그룹 만들기",
    createdToast: "카메라 그룹을 만들었습니다",
    savedToast: "카메라 그룹을 저장했습니다",
    inOtherGroups: (n: number) => `다른 그룹 ${n}`,
    inOtherGroupsTitle: (names: string) => `여기에도 있음: ${names}`,
    pickedCount: (n: number) => `${n}대 체크됨`,
    duplicate: "이 프로젝트에 같은 이름의 그룹이 이미 있습니다.",
    /* 을(를) 없이 — 조사 두 개를 괄호로 내보이는 문장은 제품이 이름을 모른다는 뜻입니다. */
    removeTitle: (label: string) => `「${label}」 삭제할까요?`,
    removeBody: "이 그룹을 가진 계정은 그 카메라들을 잃습니다 — 다른 그룹이나 개별 카메라로 덮이는 경우는 제외입니다. 카메라 자체는 그대로 있습니다.",
    removeWithHolders: (n: number) => `지금 ${n}개 계정이 갖고 있습니다.`,
    removeConfirm: "그룹 삭제",
    removedToast: "그룹을 삭제했습니다",
    notOwner: "카메라 그룹은 최고관리자만 바꿉니다.",
  },
};

type Dict = typeof T.en;

/**
 * How many member names a card prints before it says 「외 N대」.
 *
 * The cap is what keeps a 3-camera group and a 40-camera group from being wildly different
 * heights. At one card per row (see the grid below) a row of names is the card's full width, not
 * a third of it, so the cap rises with it: 18 is three rows of six at the width a full-width card
 * gives a name, measured rather than guessed.
 */
/** One frozen empty set, so the map's selection effects do not see a new Set every render. */
const EMPTY_SELECTION: Set<string> = new Set();

const CARD_CHIP_CAP = 18;

/*
 * THE COLOURS A GROUP CAN WEAR ON THE MAP.
 *
 * Six, from the tokens this product already defines — no new shades are mixed here, per the design
 * system's own rule. They are the strongest step of each hue so a 12px dot still reads at
 * neighbourhood zoom, and they are walked in order, so a group keeps its colour as long as the
 * list order holds. Past six they repeat, and the legend is what disambiguates — which is why the
 * legend carries the name and the map does not.
 */
const GROUP_COLORS = [
  "var(--primary-400)",
  "var(--success-400)",
  "var(--warning-500)",
  "var(--info-500)",
  "var(--danger-400)",
  "var(--primary-300)",
];

/**
 * The picker's first section when a group is being CHANGED: the cameras it already holds. Not a
 * zone key — no zone can be named this, because a zone key is the register's own trimmed string
 * and this one is not a string any register produces.
 */
const IN_GROUP = "\u0000in-group";

/**
 * THE GROUP EDITOR, WIRED TO THE STORE AND OPENABLE FROM ANYWHERE (owner, 2026-09-22: 사용자 초대
 * 패널에서 카메라 범위 옆에 그룹 수정/추가 버튼 만들어서 편집해서 추가할 수 있게 하면 어떨까).
 *
 * The panel itself is `GroupDrawer`; this is the part the camera-groups tab used to keep inline —
 * the store calls, the duplicate-name refusal and the toast. Pulled out so the invite panel can
 * open the very same editor over itself: somebody handing out camera access is exactly the person
 * who finds that the group they want does not exist yet, and sending them to another tab would
 * throw away the invite they were half-way through writing. Toggl Track does the same thing with
 * 「+ Create a new project」 inside its project picker.
 *
 * `onSaved` carries the group that was written, so a caller can tick what it just created.
 */
export function CameraGroupEditor({ projectId, group, onClose, onSaved, nested }: {
  projectId: string;
  /** The group to change, or null to make one. */
  group: CameraGroup | null;
  onClose: () => void;
  onSaved?: (groupId: string) => void;
  /** True when another panel is underneath this one — see GroupDrawer's own note. */
  nested?: boolean;
}) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const allGroups = useVcaStore(s => s.cameraGroups);
  const allCameras = useVcaStore(s => s.cameras);
  const addCameraGroup = useVcaStore(s => s.addCameraGroup);
  const updateCameraGroup = useVcaStore(s => s.updateCameraGroup);
  const groups = cameraGroupsInProject(allGroups, projectId);

  return (
    <GroupDrawer
      nested={nested}
      group={group}
      cameras={camerasInProject(allCameras, projectId)}
      otherGroups={groups.filter(g => g.id !== group?.id)}
      t={t}
      onSave={(label, description, ids) => {
        if (group) {
          const refusal = updateCameraGroup(group.id, { label, description, cameraIds: ids });
          if (refusal) return refusal;
          showToast({ variant: "success", title: t.savedToast, desc: `${label} · ${t.cameras(ids.length)}` });
          onSaved?.(group.id);
          onClose();
          return null;
        }
        const refusal = addCameraGroup(projectId, label, ids, description);
        if (refusal) return refusal;
        /* The store hands back a refusal, not the row, so the new group is looked up by the name
           it was just refused a duplicate of — read straight from the store rather than from the
           subscribed value, which is still the pre-save render's array. */
        const made = cameraGroupsInProject(useVcaStore.getState().cameraGroups, projectId)
          .find(g => g.label.trim().toLowerCase() === label.trim().toLowerCase());
        showToast({ variant: "success", title: t.createdToast, desc: `${label} · ${t.cameras(ids.length)}` });
        if (made) onSaved?.(made.id);
        onClose();
        return null;
      }}
      onClose={onClose}
    />
  );
}

/**
 * MAKING A GROUP AND CHANGING ONE, IN A DRAWER OFF THE RIGHT EDGE.
 *
 * The owner asked for the map here (2026-09-21): 입력소스 화면에 넣었던 지도를 여기 카메라
 * 그룹에도 넣어서 지도에서 그룹핑할수있게해줘. A group is assembled the way a site is described,
 * and a site is described by pointing at it.
 *
 * WHY A DRAWER AND NOT THE IN-PAGE PANE IT REPLACED (owner, 2026-09-22: 그룹편집도 이렇게하거든).
 * The pane existed to satisfy an earlier requirement — 그룹테이블이 좁아지면서 기존에 테이블이
 * 어떤게 있는지보고 편집 — by narrowing the table beside it. Cards cannot narrow, so that device
 * is gone; the drawer keeps the requirement a different way, by covering only the right edge and
 * leaving the grid behind it readable.
 *
 * TWO WAYS IN, ONE SELECTION. The list has the search and the zone grouping; the map has the
 * geography. They write the same `picked` set, so twenty ticked in the list and two clicked on the
 * map are twenty-two in the group — the same rule the bulk selection on Input Sources follows, and
 * for the same reason: a second selection would be a second answer to "what is in this group".
 *
 * OVERLAP IS ALLOWED AND SAID OUT LOUD (owner: 카메라들이 중복으로도 그룹핑 될수있을것같구).
 * Nothing in the data model ever forbade it — a duplicate NAME is refused, membership is not —
 * but a checkbox list gives no hint either way, and an administrator who assumes exclusivity will
 * not build the groups they actually need (the gate camera belongs to 정문 and to 야간 순찰 both).
 * So each row says how many other groups hold that camera and names them on hover.
 *
 * THE SCRIM AND ESCAPE BOTH CLOSE IT (owner, 2026-09-22: 왼쪽 딤드된 부분 클릭해도 닫을수있게
 * 해줘야할것같은데). A dimmed area is a dismiss target everywhere else, so a panel that ignores it
 * reads as stuck; and once the scrim dismisses, the keyboard needs the same gesture or the panel is
 * mouse-only. The cost is stated rather than designed around: either one discards a half-built
 * group. The shared Drawer holds the same rule — this editor keeps its own shell only because its
 * body is a picker with a map in it, not because it closes differently.
 */
function GroupDrawer({ group, cameras, otherGroups, t, onSave, onClose, nested }: {
  /** The group being changed, or null while one is being made. */
  group: CameraGroup | null;
  /** The project's register — full cameras, because the map needs the coordinates and the status. */
  cameras: Camera[];
  /** Every other group of this project, for the "also in" count. */
  otherGroups: CameraGroup[];
  t: Dict;
  /** Returns an error key when the name is taken, so the field can say so without closing. */
  onSave: (label: string, description: string, cameraIds: string[]) => "duplicate-label" | null;
  onClose: () => void;
  /**
   * True when this panel opened OVER another one — from the invite panel's camera scope, where a
   * chip's pencil leads here (owner, 2026-09-22: 카메라 그룹 수정 클릭하면 패널창이 수정창으로
   * 바뀌는데 이러면 뒤로가기 버튼이 타이틀 옆에 생겨야 할 것 같아, 아래 뒤로가기나 이런 것도
   * 있어야 하고).
   *
   * Stacked, the panel occupies exactly the same rectangle as the one it covers, so nothing on
   * screen says the invite is still there behind it. It then draws a ← beside the title and its
   * footer says 뒤로 instead of 취소 — the same action either way, named for where it lands.
   */
  nested?: boolean;
}) {
  const creating = group === null;
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(group?.cameraIds ?? []);
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const matching = needle === ""
    ? cameras
    : cameras.filter(c => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));

  /* Grouped by the register's own zone, like the scope picker: "the north gate ones" is how
     somebody says it, and a camera with no zone keeps its own group rather than disappearing. */
  const byZone = new Map<string, Camera[]>();
  matching.forEach(c => {
    const key = c.zone?.trim() || "";
    byZone.set(key, [...(byZone.get(key) ?? []), c]);
  });
  const zones = [...byZone.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));

  const toggle = (id: string) => setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /*
   * THE PLACEHOLDER IS AN EXAMPLE, NOT A DESCRIPTION OF ONE.
   *
   * It read 「사람들이 입으로 부르는 말」 — the KIND of answer wanted, which leaves the reader to
   * invent the shape. The invite form's address field had the same fault and was fixed the same
   * way: show something this field would actually accept. The two groups already on this
   * installation are called 「오차드·부기스 라인」 and 「Geylang 일대」, so a zone plus 일대 is the
   * shape, and taking the zone from THIS project's register means the example is a place the
   * reader can see on the map beside it — and stays right when the register is Mongolian rather
   * than Singaporean. Biggest zone first because that is the one somebody groups; ties broken by
   * name so the placeholder does not move between renders — and counted over the whole register,
   * not over `byZone`, which is the SEARCH RESULT: taking it from there would change the example
   * with every keystroke in the box next to it.
   */
  const zoneSizes = new Map<string, number>();
  cameras.forEach(c => {
    const zone = c.zone?.trim() ?? "";
    if (zone !== "") zoneSizes.set(zone, (zoneSizes.get(zone) ?? 0) + 1);
  });
  const exampleZone = [...zoneSizes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const namePlaceholder = t.createNamePlaceholder(
    exampleZone ? t.createNameExample(exampleZone) : t.createNameExampleNoZone,
  );

  /*
   * A BIG REGISTER IS A LIST OF ZONES, AND A ZONE OPENS UNDER ITSELF (owner, 2026-09-22: 카메라
   * 리스트 스크롤 안 해도 되게 해줘 · 이게 기본적으로 구역(위치) 중심인 거잖아, 이걸로 먼저
   * 보여주는 게 좋겠지?).
   *
   * Zones start closed — a thousand rows in one scroll box is a list nobody scrolls, and a zone
   * is what somebody ticks.
   *
   * THEY USED TO DRILL IN, AND THAT IS THE PART THAT WAS WRONG (owner, 2026-10-02: 누르면 아래로
   * 열릴 것 같이 생겼는데 새로 열려서 어색해). Opening a zone filtered the list down to that one
   * zone, so pressing 「Bedok · 5」 took the other seventeen rows out of the document — measured,
   * 18 rows to 1. The row is shaped like an accordion (a chevron, a name, a count), and the shape
   * is a promise about what the press does; stepping into a screen is a different gesture and it
   * is drawn differently. It was done to keep the box from scrolling when two zones are open,
   * which is a smaller cost than losing your place: the list is a scroll box, scrolling is what it
   * is for, and every other zone stays exactly where the reader left it.
   *
   * So: more than one zone open at a time, each opening in place. Same as the scope picker, which
   * has always worked this way.
   *
   * Below a screenful none of this applies — the flat list IS the answer at that size, and
   * making somebody open a zone to reach four cameras would be a click for nothing. Same
   * threshold as the scope picker (owner: 실제 현장에서는 연결된 카메라 대수가 1000대이상일 수
   * 있어서).
   */
  const flatZones = cameras.length <= 40;
  /*
   * WHAT IS ALREADY IN THE GROUP IS WHAT THE EDITOR OPENS ON (owner, 2026-09-22: 카메라 그룹
   * 편집할 때 이미 선택된 카메라들은 체크 표시한 상태로 열려 있음 해).
   *
   * The ticks were always there — `picked` starts from the group's own members — but on a big
   * register the list opens as nineteen closed zones, so an editor could not see any of them
   * without guessing which zones to step into. Opening on the group's members shows the ticks
   * first and leaves adding to 「모든 구역으로」.
   *
   * The section's MEMBERSHIP is frozen at open (`group.cameraIds`), not read from `picked`:
   * computed live, a row would disappear the moment you unticked it, so taking a camera out by
   * mistake would also take away the way to put it back. Frozen, unticking just unticks.
   *
   * It is the one thing OPEN when the editor opens; the zones under it are closed, and opening
   * one no longer closes this.
   */
  const [initialPicked] = useState<string[]>(() => group?.cameraIds ?? []);
  const inGroupSection = !flatZones && initialPicked.length > 0;
  const [openZones, setOpenZones] = useState<string[]>(inGroupSection ? [IN_GROUP] : []);
  const toggleZoneOpen = (zone: string) =>
    setOpenZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  const toggleZoneAll = (ids: string[]) => {
    const allOn = ids.every(id => picked.includes(id));
    setPicked(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  /** The other groups holding a camera — the overlap, named rather than counted on hover. */
  const alsoIn = (cameraId: string) => otherGroups.filter(g => g.cameraIds.includes(cameraId));

  const dirty = creating
    ? label.trim() !== "" && picked.length > 0
    : label.trim() !== "" && (
      label.trim() !== group.label
      || description.trim() !== (group.description ?? "")
      || [...picked].sort().join() !== [...group.cameraIds].sort().join()
    );

  /* Handed to the shared Drawer, which is what asks before discarding — the scrim and Escape
     both take that route there, and ✕ and 취소 stay immediate because they are aimed. */

  const save = () => {
    if (!dirty) return;
    const refusal = onSave(label.trim(), description, picked);
    if (refusal === "duplicate-label") setLabelError(t.duplicate);
  };

  /* The two whole-selection controls, marked (owner: 전부고르기랑 초기화앞에 각각 텍스트랑
     어울리는 아이콘 넣어줘). CheckCheck for 모두 선택 — the double tick is the one mark that
     already means "all of them ticked" — and RotateCcw for 선택 초기화, which is the reset arrow
     rather than an ✕: an ✕ on this screen closes things and takes cameras out of chips, and a
     third meaning for it would be a third vocabulary. */
  const linkButton: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "4px",
    border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
    fontSize: "11px", fontWeight: 700, color: "var(--gray-500)",
  };

  /*
   * WHAT IS IN IT, AS NAMES WITH A WAY OUT.
   *
   * On the map there is no other way to read the group back — rings on dots and a count name
   * nothing — and in the list the ticks are spread over eighteen zones. Each chip's ✕ takes that
   * camera out, which is the one action this block is for, and the only way to remove a camera
   * the reader can no longer find among the dots. The camera with no coordinates is the extreme
   * case and the clearest proof: it has no dot at all, so its chip is the only handle on it.
   *
   * MAP VIEW ONLY (owner, 2026-09-22: 아래 칩들이 있어야할까?).
   *
   * In list view they said the same thing twice: the ticked rows are right there with their
   * names, and clicking a row takes that camera out — so the chips repeated five names the reader
   * had just ticked, and the ✕ duplicated the tick.
   *
   * On the MAP they are the only way to read the group back. A ringed dot names nothing and the
   * count names nothing, so without them the reader has clicked five points and has no receipt.
   *
   * The one case this gives up: in list view a CLOSED zone hides its ticks. The zone row used to
   * carry 「그룹에 N대」 for exactly that, and the owner took it out (2026-09-22: 있음없음은
   * 없어도되지않을까) — what answers it now is the footer's running count and the search, which
   * opens every zone that matches. If that turns out to be too little, the fix is on the closed
   * zone's own row, not a second copy of the membership.
   *
   * Never capped with 「외 N대」: every chip carries the ✕ that takes that camera out, and a chip
   * you cannot see is a camera you cannot remove. Which is why the cap below is on the BOX and
   * not on the number of chips — past it the box scrolls and every camera is still reachable.
   *
   * ON THE MAP, NOT UNDER IT (owner, 2026-09-22: 지금은 지도에서 카메라 선택하면 칩들이 아래
   * 뜨는데 지도 위로 뜨는 게 더 좋을 것 같아).
   *
   * Under the map they were a row that grew downwards, so the receipt for picking cameras was
   * paid for by the map you pick them on: at 62 cameras it was a 300px wall, and even at five it
   * pushed the map up every time the reader added one. Floating, the map keeps its full height
   * whatever is picked — MEASURED at 508px with nothing picked and 508px with all 62.
   *
   * HOW MUCH OF THE MAP AN OVERLAY MAY TAKE, following the precedent set by the 「지도에 없는
   * N대」 chip in CameraMapView: that one measures 0.8% of the map, and the 300px card it replaced
   * was a fifth of it, which was rejected as "cameras you cannot click". So this box is capped at
   * 44% of the map's width by 24% of its height — 10.56% of its area at worst, and MEASURED at
   * exactly that with all 62 picked (276.75 x 121.97 in a 629 x 508 map; three chips take 6.45%)
   * — past the cap it scrolls inside itself instead of growing. Top-left is
   * the only free corner: Leaflet's zoom control holds the top-right, the unsurveyed-camera chip
   * the bottom-left and the tile attribution the bottom-right.
   *
   * IT DOES KEEP THE POINTER, which costs one thing: a lasso cannot be STARTED on top of the box.
   * That is the trade for a scrollbar the reader can drag and an ✕ they can press, and it leaves
   * the other 90% of the map to start on.
   */
  /** Handed to the map rather than placed beside it, so that the cap above is a share of the
   *  MAP's box — see CameraMapView's `overlay` prop for the 37px of header that made it a prop. */
  const pickedChips = picked.length === 0 ? null : (
    <div style={{
      position: "absolute", left: "10px", top: "10px", zIndex: 700,
      maxWidth: "44%", maxHeight: "24%", overflowY: "auto",
      display: "flex", flexWrap: "wrap", gap: "6px",
      padding: "6px", backgroundColor: "white", border: BORDER,
      borderRadius: CARD_RADIUS, boxShadow: "var(--shadow-popover)",
    }}>
      {picked.map(id => {
        const cam = cameras.find(c => c.id === id);
        return (
          <span key={id} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 6px 4px 9px", borderRadius: "8px", border: BORDER, backgroundColor: "var(--gray-50)", fontSize: "11.5px", color: "var(--gray-900)" }}>
            {/* A camera the register no longer holds still has to be shown — a group can name one
                that was removed, and silently dropping it would make the count disagree with the
                chips. */}
            {cam ? cam.name : t.inGroupUnknown}
            <button type="button" onClick={() => toggle(id)} title={t.inGroupRemove}
              style={{ display: "flex", padding: "1px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </span>
        );
      })}
    </div>
  );

  return (
    /*
      THE SHARED PANEL, NOT A COPY OF IT. This shell was written out by hand — scrim, width,
      left border, modal shadow, the ruleless 16/20 header, the ← and its own escape and
      dirty guard — before `Drawer` existed, and the copy then had to be kept level with it by
      hand. Two copies of "what closes a panel" is the one difference a reader feels: a drawer
      that discards a half-built group where every other drawer asks first.

      WIDTH IS THE ONLY THING THIS PANEL STILL ASKS FOR (owner, 2026-09-22: 카메라 그룹 수정은
      패널 너비가 더 넓어지는데 사용자 초대는 좁네..?). Over the 520px invite panel it takes 520,
      because a panel that grows when you step into it reads as the window changing size rather
      than as one more layer. Opened from the camera-groups tab it keeps 672: nothing is
      underneath it there, and the list's four columns and the map both have more room to spend.
    */
    <Drawer
      title={creating ? t.drawerNew : t.drawerEdit(group.label)}
      onClose={onClose}
      /* Stacked, the panel covers exactly the rectangle it opened over, so the arrow is what
         says there is something behind it. Same action as ✕ either way. */
      onBack={nested ? onClose : undefined}
      width={nested ? "520px" : "672px"}
      dirty={dirty}
      footer={
        <>
          <span style={{ flex: 1, fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>
            {t.pickedCount(picked.length)}
          </span>
          {/* The shared pair, so this panel and every other one end the same way — see
              PanelCancel/PanelPrimary for what was measured against twenty reference panels. */}
          <PanelCancel onClick={onClose} label={nested ? t.back : t.cancel} />
          <PanelPrimary onClick={save} disabled={!dirty} label={creating ? t.createSave : t.editSave} />
        </>
      }
    >
        {/*
          THE BODY DOES NOT SCROLL; THE MAP TAKES WHAT IS LEFT (owner, 2026-09-22: 지도가 좀
          작아보여).
         
          It was one scrolling column with the map pinned at 280px, and at 18 zones that height
          put the zone pills on top of each other — Hougang over Bishan over Toa payoh — which is
          the same failure the in-page editor had at 394px WIDE, now vertical. A map you cannot
          read is not an input device. Worse, a 61-camera selection put a 300px wall of chips
          under it, so the one element that needed the room was the one being squeezed.
         
          So the column owns the height instead of the scrollbar: the two fields and the chips
          keep their natural size, the picker takes the rest, and each of the two lists that can
          outgrow it scrolls inside itself.
         
          THE SCROLLBAR COMES BACK ON A SHORT WINDOW, THOUGH. Measured on a 760px one with the
          body set to `hidden`: everything still fit, but only by squeezing the map to 232px —
          SMALLER than the 280 this change was made to fix. So the picker keeps a floor and the
          body may overflow past it: a tall window spends the slack on the map, a short one keeps
          the map readable and scrolls instead.
        */}
        {/* `minHeight: 100%` because the SHARED panel owns the scrollbar now and this is the
            column inside it: without it the column is only as tall as its content, and the
            picker's `flex: 1 1 auto` would have nothing to grow into — the map would sit at its
            384px floor on every window instead of spending the slack. */}
        <div style={{ minHeight: "100%", boxSizing: "border-box", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <FormLabel as="span">{t.createName}<RequiredMark /></FormLabel>
            <TextField value={label} onChange={v => { setLabel(v); setLabelError(null); }} placeholder={namePlaceholder} autoFocus />
            {labelError && <FieldError>{labelError}</FieldError>}
          </div>

          {/* OPTIONAL, AND NO PLACEHOLDER. A hint like "설명을 입력하세요" is the field's own label
              said twice, and an example would invent a purpose for a group the reader has not
              described yet. 「선택」 beside the label is the whole instruction: most groups are
              recognisable from the name and the camera names, and this line earns its place on a
              site with forty of them, telling 오차드 라인 from 오차드 외곽. */}
          <div>
            <FormLabel as="span">
              {t.descField}
              <span style={{ fontWeight: 600, color: "var(--gray-400)", marginLeft: "5px" }}>{t.descOptional}</span>
            </FormLabel>
            <TextField value={description} onChange={setDescription} />
          </div>

          {/* THE PICKER. Search and the view switch sit on one strip at the top of the thing they
              act on — a control spanning more than the list it narrows is the misalignment the
              in-page editor was corrected for. 모두 선택 and 선택 초기화 sit above that strip,
              because they act on the whole selection rather than on what the search left. */}
          {/* THE WRAPPER GROWS ONLY IN MAP VIEW. Shrinking the bordered box inside it was not
              enough: this column kept `flex: 1 1 auto` and swallowed the slack itself, so a search
              that cut the list to 80px left 407px of nothing under it and pushed the selected
              cameras that far down — measured, and the white space the owner was pointing at. */}
          <div style={view === "map"
            ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }
            : { flex: "0 0 auto", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)" }}>{t.pickHeading}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-900)", fontVariantNumeric: "tabular-nums" }}>{picked.length}</span>
              {/* 초기화 SITS WITH THE NUMBER IT CLEARS (owner: 초기화는 카메라 선택 숫자 옆에
                  뜨게해줘). It was at the right end beside 모두 선택, where the two read as one
                  control with two halves — and the one that empties the selection belongs against
                  the count of it, which is also why it is absent when that count is 0. 모두 선택
                  stays at the far end: it acts on the register, not on what is picked. */}
              {picked.length > 0 && (
                <button type="button" onClick={() => setPicked([])} style={{ ...linkButton, marginLeft: "4px" }}>
                  <RotateCcw size={12} strokeWidth={2.4} aria-hidden="true" />
                  {t.allClear}
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setPicked(cameras.map(c => c.id))} style={linkButton}>
                <CheckCheck size={13} strokeWidth={2.4} aria-hidden="true" />
                {t.allPick}
              </button>
              {/*
                THE VIEW SWITCH IS A LEVEL ABOVE THE SEARCH (owner: 목록 지도 토글도 저 위치가
                맞는지 봐줘).
               
                It sat at the right of the strip inside the picker, which is where the owner asked
                for it this morning — 목록/지도 토글은 검색바 오른쪽으로 옮겨줘 — and that was right
                while the strip held the search in both views. It does not any more: the search only
                exists in list view, so switching to the map left a tinted bar holding one lonely
                control. Choosing WHICH picker is also a question above "search inside the list".
               
                Here the strip becomes search-only and disappears with it in map view, and the
                switch sits with the other controls that act on the whole picker.
               
                A white lozenge on a grey track rather than a bordered box: one fewer line, and the
                segmented control every reference panel uses looks like this.

                AND THE CONSOLE'S OWN ONE, TO THE TOKEN. It was drawn near this shape but not on
                it — a --gray-100 track with no line, radius 9/7, 11.5px, and a selected shadow
                written out as a literal rgba — while 입력 소스 and VIP 등록 both use --gray-50 +
                BORDER, radius 10/8, 10px and PANEL_SHADOW. One gesture, "show me this
                differently", in two sizes on two screens is the kind of difference a reader
                cannot name and still notices.
              */}
              <div style={{ display: "flex", alignItems: "center", padding: "3px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", flexShrink: 0 }}>
                {([["list", t.viewList], ["map", t.viewMap]] as const).map(([value, text]) => (
                  <button key={value} type="button" onClick={() => setView(value)}
                    style={{
                      padding: "4px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                      fontSize: "10px", fontWeight: 700, border: "none",
                      backgroundColor: view === value ? "white" : "transparent",
                      color: view === value ? "var(--gray-900)" : "var(--gray-400)",
                      boxShadow: view === value ? PANEL_SHADOW : "none",
                    }}>
                    {text}
                  </button>
                ))}
              </div>
            </div>

            {/*
              THE FLOOR IS THE MAP'S, NOT THE BOX'S (owner, 2026-09-22: 아래 빈여백은 없게 박스를
              줄여주고 그럼 아래 선택된 카메라들이 다 보일것같아).
             
              384px — the 44px strip plus a 340px map — is what holds the seeded register's
              eighteen zone pills apart, and a map shorter than that is the thing this floor
              exists to prevent. A LIST has no such need: it is as tall as its rows, and holding
              it at 384 left white space under a short one and pushed the selected cameras out of
              sight. So the floor applies in map view only, and in list view the box takes its
              content up to a screenful and scrolls past that.
            */}
            <div style={view === "map"
              ? { flex: "1 1 auto", minHeight: "384px", border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: "hidden", display: "flex", flexDirection: "column" }
              : { flex: "0 0 auto", border: CARD_BORDER, borderRadius: CARD_RADIUS, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* The strip keeps its tint and loses its rule: a 1px line between two greys that
                  already differ is the line the references do not draw. */}
              {view === "list" && (
                <div style={{ padding: "10px 12px", backgroundColor: "var(--gray-50)" }}>
                  <TextField value={query} onChange={setQuery} placeholder={t.membersSearch} />
                </div>
              )}
              {view === "map" ? (
                /* Fills the picker, which fills the column. It can do that because the body does
                   not scroll in map view — inside a scroll box a parent-sized map collapses to
                   nothing, which is why this was once pinned at 280px. */
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CameraMapView
                    cameras={cameras}
                    selectedIds={new Set(picked)}
                    onToggleSelect={toggle}
                    alwaysPicking
                    fill
                    overlay={pickedChips}
                  />
                </div>
              ) : zones.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--gray-400)", padding: "12px", lineHeight: 1.5 }}>{t.membersNone}</p>
              ) : (
                /*
                  AS TALL AS THE PANEL LEAVES IT (owner, 2026-09-22: 목차 리스트 스크롤 적게
                  할 수 있게 아래로 넓혀줘).
                 
                  It was a flat 420px, which on a 900px window left the panel's lower third empty
                  and still scrolled the list — the two costs at once. The list is the only thing
                  under it now that the chips are map-only, so it takes what the two fields and
                  the footer do not: `100vh` less the measured 340px of chrome above and below.
                  The ceiling keeps a very tall window from stretching one 61-row list to 900px,
                  and the floor keeps a short one readable and lets the body scroll instead —
                  same trade the map floor above makes.
                */
                <div style={{ maxHeight: "clamp(240px, calc(100vh - 340px), 660px)", overflowY: "auto", padding: "8px" }}>
                  {/* Searching crosses zones — a code is typed to find one camera, not to find
                      out which zone it is in — so a needle shows every zone that matches with
                      its rows open, whichever zones the reader had opened by hand. */}
                  {(() => {
                    /* Searching is a register-wide question, so a needle drops the section and
                       shows the real zones that match — including cameras already in the group,
                       ticked where they live. */
                    if (needle !== "" || flatZones) return zones;
                    /* Every zone, always. Nothing here narrows the list — opening a zone adds
                       rows under it and takes none away. See the note on `openZones`. */
                    return inGroupSection
                      ? [[IN_GROUP, cameras.filter(c => initialPicked.includes(c.id))], ...zones] as [string, Camera[]][]
                      : zones;
                  })().map(([zone, list]) => {
                    const collapsible = needle === "" && !flatZones;
                    const open = !collapsible || openZones.includes(zone);
                    const pickedHere = list.filter(c => picked.includes(c.id)).length;
                    return (
                      /* 4px between zone rows, not 8: measured, nineteen zones came to 543px
                         inside a 777px body whose fields and strip already spend 277 — 43px over,
                         so the panel scrolled while the list itself had room. Halving the gap
                         gives back 72px and the whole site fits with nothing scrolling. A closed
                         zone is a 26px row, and an open one is that row plus its cameras — the
                         gap separates them from the next zone's name either way. */
                      <div key={zone || "__none"} style={{ marginBottom: "4px" }}>
                        {/* The name opens the zone; the words beside it tick the whole zone. On a
                            big site those are the two things somebody does here, and one header
                            doing both would make ticking a zone cost opening it first. */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 0 4px 2px" }}>
                          <button type="button" onClick={() => { if (collapsible) toggleZoneOpen(zone); }}
                            style={{ display: "flex", alignItems: "center", gap: "5px", border: "none", background: "none", padding: 0, cursor: collapsible ? "pointer" : "default", fontFamily: "inherit" }}>
                            {/* Right when closed, down when open — it points at the thing it
                                opened. It used to turn 180° and point back, which was honest while
                                the press replaced the list and is a lie now that it expands one.
                                No tooltip: a reader who can see the arrow turn does not need a
                                sentence saying it turned. */}
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                              style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms", flexShrink: 0, opacity: collapsible ? 1 : 0 }}>
                              <path d="M3 1.5L7 5l-4 3.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {/* THE ZONE NAME IS THE DARKEST THING ON ITS ROW (owner: 맨앞에 있는 연한글씨가
                                구역명인거잖아 꽤 중요한 정보같은데 너무 희미해). It was gray-400
                                while 전체 선택 beside it is gray-500 — the row's action was
                                darker than the row's identity, which is the order somebody scans
                                in reversed. The count stays light: it qualifies the name. */}
                            {/* The section is not a zone, so it is not uppercased with them:
                                uppercase is this list's mark for "a place on the site". */}
                            <span style={zone === IN_GROUP
                              ? { fontSize: "11.5px", fontWeight: 700, color: "var(--gray-900)" }
                              : { fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gray-900)" }}>
                              {zone === IN_GROUP ? t.zoneInGroup : zone || t.noZone}
                              <span style={{ fontWeight: 600, color: "var(--gray-400)" }}> · {list.length}</span>
                            </span>
                          </button>
                          <button type="button" onClick={() => toggleZoneAll(list.map(c => c.id))}
                            style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "11.5px", fontWeight: 700, color: "var(--gray-500)" }}>
                            {pickedHere === list.length ? t.zoneClear : t.zonePick}
                          </button>
                          {/*
                              PART OF A ZONE IS A STATE, AND IT HAD NO SHAPE (owner, 2026-10-02:
                              위치별 카메라가 몇 개가 있는데 그중 몇 개가 선택된 상태라도 변경될
                              때 알려줘야 할 것 같아). None / some / all are three answers and this
                              row drew two: 전체 선택 stands beside an untouched zone and beside a
                              zone with two of five ticked, so the half-picked state could only be
                              found by opening eighteen zones one at a time.

                              Only the middle state is written. 0 is said by this line's absence —
                              「0」 repeated down seventeen untouched zones is noise, not an answer
                              — and all-picked is already said by 해제, which appears only then.

                              NOT 「BEDOK · 2/5」: the ·5 after the name is the register's count and
                              has been since this list was written, and a fraction would change
                              what a number already on screen means. A separate phrase after the
                              action keeps the two apart — and it is the footer's own phrase,
                              `pickedCount`, said of one zone instead of the whole drawer: a second
                              word for the same fact would make a reader ask what the difference
                              is.

                              It stays while the zone is open, because this is the line that has to
                              move when a tick inside changes or 전체 선택 is pressed.
                          */}
                          {pickedHere > 0 && pickedHere < list.length && (
                            <span style={{ fontSize: "11px", color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>
                              {t.pickedCount(pickedHere)}
                            </span>
                          )}
                        </div>
                        {open && list.map(c => {
                          const on = picked.includes(c.id);
                          const others = alsoIn(c.id);
                          return (
                            /*
                             * A GRID, NOT A FLEX ROW (owner: 목록으로 보여질때도 열을 좀 더
                             * 구분해줘). Laid out as flex, the code sat immediately after each
                             * name, so it landed in a different place on every row — 「Orchard
                             * MRT CAM-ORC-001」 then 「Tampines Hub CAM-TAM-004」 — and the overlap
                             * mark after it moved too. Fixed tracks put the code and the mark in
                             * columns you can read down, which is what a list of sixty rows is
                             * for. The name keeps 1fr and still truncates; the two right-hand
                             * tracks are the widest their content gets (a code is 11 monospace
                             * characters, 「다른 그룹 N」 is six glyphs and a digit).
                             */
                            <button key={c.id} type="button" onClick={() => toggle(c.id)}
                              style={{ width: "100%", display: "grid", gridTemplateColumns: "16px minmax(0, 1fr) 96px 68px", alignItems: "center", columnGap: "10px", textAlign: "left", padding: "7px 6px", borderRadius: "8px", border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ width: "16px", height: "16px", borderRadius: "5px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: on ? "1px solid var(--gray-900)" : "1px solid var(--gray-300)", backgroundColor: on ? "var(--gray-900)" : "white" }}>
                                {on && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                    <path d="M2 5.2l2 2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              {/* A touch larger than the 12.5/10 it was (owner: 그 아래 목록일때
                                  텍스트 조금 살짝만 키워줘) — this is the list somebody reads
                                  sixty rows of, and it sits in a 672px drawer with room for it. */}
                              <span style={{ minWidth: 0, fontSize: "13.5px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.code}</span>
                              {/* THE OVERLAP, ON THE ROW IT IS ABOUT. Counted here and named on
                                  hover: four group names on a row would push the camera's own name
                                  out. The cell is emitted whether or not there is a mark — a grid
                                  must emit as many cells as it has tracks, and dropping this one
                                  on the rows without an overlap would pull the code out of its
                                  column on those rows only. */}
                              <span title={others.length > 0 ? t.inOtherGroupsTitle(others.map(g => g.label).join(", ")) : undefined}
                                style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                                {others.length > 0 ? t.inOtherGroups(others.length) : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
    </Drawer>
  );
}

export default function CameraGroupsTab({ projectId, onGoToCameras, actionsSlot }: {
  projectId: string;
  onGoToCameras?: () => void;
  /** The element on the tab line where 그룹 만들기 lands. See PortalUsersPage. */
  actionsSlot?: HTMLElement | null;
}) {
  const [lang] = usePortalLanguage();
  const t: Dict = T[lang];
  const { showToast } = useToast();
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const allGroups = useVcaStore(s => s.cameraGroups);
  const allCameras = useVcaStore(s => s.cameras);
  const portalUsers = useVcaStore(s => s.portalUsers);
  const removeCameraGroup = useVcaStore(s => s.removeCameraGroup);

  const groups = cameraGroupsInProject(allGroups, projectId);
  const registered = camerasInProject(allCameras, projectId);

  const [removing, setRemoving] = useState<CameraGroup | null>(null);
  const [editing, setEditing] = useState<CameraGroup | null>(null);
  const [creating, setCreating] = useState(false);
  /* 카드 / 지도 (owner, 2026-09-28: 그룹을 보는 방법을 지도랑 카드랑 두가지로 볼수있게해서
     지도에 현재 그룹이 어떻게 묶여져있는지 표시서 그룹명 표시해줘). Not persisted: which way you
     were looking last is not a setting, and a tab that opens in a mode you did not choose is
     worse than one that always opens the same way. */
  const [view, setView] = useState<"cards" | "map">("cards");
  const drawerOpen = editing !== null || creating;

  /** How many accounts name this group in their scope — the answer this tab exists for. */
  const holderCount = (group: CameraGroup) =>
    portalUsers.filter(u => (u.cameraGroupIds ?? []).includes(group.id)).length;

  /* A group can name a camera that has since been removed from the register — pruneCameraGroups
     keeps that out on deletion, so this is a belt on the braces: the list holds the cameras that
     exist, because a scope resolves through the register and not through the stored ids. */
  const liveCameras = (group: CameraGroup) =>
    group.cameraIds.map(id => registered.find(c => c.id === id)).filter((c): c is Camera => !!c);

  return (
    <div>
      {/*
        ONE DOOR INTO THE DRAWER, AT THE TOP RIGHT (owner, 2026-09-28: 카메라 그룹 추가도
        다른화면에서처럼 추가하기 엑션 버튼을 오른쪽 상단에 위치시켜줘).
        
        It was the last cell of the grid — a dashed card after the ones you read to decide whether
        a group like it exists. That reasoning held while the grid was three columns wide; at one
        card per row the dashed cell became a full-width empty band at the bottom of the page, and
        it put this screen's create button somewhere no other screen in the console puts one.
        Top right is where 프리셋 만들기, 프로젝트 추가 and 서버 추가 all sit, so it goes there and
        the dashed cell goes away. The empty state keeps its own button — there is no list yet.
      */}
      {groups.length > 0 && mayEdit && (() => {
        const bar = (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginBottom: actionsSlot ? 0 : "14px", minHeight: CONTROL_HEIGHT }}>
            {/*
              THE CONSOLE'S VIEW SWITCH, NOT A PAIR OF BUTTONS. One control showing both states,
              rather than a button that names the mode you are not in — that part was right. The
              SHAPE was borrowed from the grant rows' 보기 / 보기·검색, and those are a different
              kind of thing: a value being set on a row, inside a row, which is why they are joined
              cells that each draw their own line.

              This one asks what 입력 소스 and VIP 등록 ask — which shape of this list — and it sits
              in the same place on the tab line that theirs do. So it is theirs: a white lozenge on
              a --gray-50 track. It was 36px joined buttons at 12px, which beside those two made
              the one gesture read as three different controls across the console.

              It keeps the radiogroup roles the other two have yet to get: two radios is what this
              is, and a screen reader saying "선택됨" is the state the white lozenge shows.
            */}
            <span role="radiogroup" aria-label={t.viewLabel}
              style={{ display: "inline-flex", alignItems: "center", padding: "3px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", flexShrink: 0 }}>
              {(["cards", "map"] as const).map(v => {
                const on = view === v;
                return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setView(v)}
                    style={{
                      padding: "4px 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: "10px", fontWeight: 700,
                      backgroundColor: on ? "white" : "transparent",
                      color: on ? "var(--gray-900)" : "var(--gray-400)",
                      boxShadow: on ? PANEL_SHADOW : "none",
                    }}>
                    {v === "cards" ? t.viewCards : t.viewMap}
                  </button>
                );
              })}
            </span>
            <button type="button" onClick={() => setCreating(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0, height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-700)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
              {t.createButton}
            </button>
          </div>
        );
        return actionsSlot ? createPortal(bar, actionsSlot) : bar;
      })()}
      {groups.length === 0 ? (
        /* ONE LINE, THEN THE TWO DOORS. The line used to name both of them in prose — make one
           here, or group them on Input Sources — with both buttons sitting directly under it.
           The buttons are the instruction; the line only says what the state is. */
        <div style={{ backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.6, textAlign: "center" }}>{t.empty}</p>
          {mayEdit && (
            <button type="button" onClick={() => setCreating(true)}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--gray-900)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.createButton}
            </button>
          )}
          {onGoToCameras && (
            <button onClick={onGoToCameras}
              style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.goToCameras}
            </button>
          )}
        </div>
      ) : view === "map" ? (
        /*
         * THE SAME GROUPS, SEEN AS PLACES.
         *
         * A card says a group holds eleven cameras; only the map says whether they are the eleven
         * along one road or eleven scattered across the site with nothing in common. That is what
         * a reader is actually checking before handing a group out as a permission.
         *
         * THE NAMES ARE IN A LEGEND, NOT ON THE MAP, and this file has already paid for that
         * lesson once: the zone pills that floated over CameraMapView were removed because 18
         * labels inside one city collided 29 times, at two different heights — the scale, not the
         * box. Group labels would collide the same way the moment two groups overlap, which is
         * exactly when a reader most needs to tell them apart. The dots carry the grouping, the
         * legend carries the names, and nothing overlaps anything.
         */
        <div style={{ height: "calc(100vh - 260px)", minHeight: "420px", display: "flex", alignItems: "stretch" }}>
          <CameraMapView
            fill
            cameras={registered}
            selectedIds={EMPTY_SELECTION}
            onToggleSelect={() => {}}
            tintOf={cameraId => {
              const i = groups.findIndex(g => g.cameraIds.includes(cameraId));
              return i === -1 ? "var(--gray-300)" : GROUP_COLORS[i % GROUP_COLORS.length];
            }}
            overlay={
              /* THE LEGEND COUNTS DOTS, NOT MEMBERS. A group of eleven with one camera never
                 surveyed draws ten dots, and a legend saying eleven would have the reader hunting
                 for a dot that is not there. The cameras without coordinates are already named by
                 the map's own 「지도에 없는 N대」 notice, which is where that fact belongs. */
              <div style={{
/* Bottom RIGHT: the map already puts its 「지도에 없는 N대」 notice at the bottom left,
                   and the two boxes were sitting on top of each other (measured on screen). */
                position: "absolute", right: "12px", bottom: "12px", zIndex: 500,
                maxWidth: "min(46%, 280px)", maxHeight: "60%", overflowY: "auto",
                display: "flex", flexDirection: "column", gap: "6px",
                padding: "10px 12px", borderRadius: "10px", border: BORDER,
                backgroundColor: "white", boxShadow: "var(--shadow-popover)",
              }}>
                {groups.map((g, i) => (
                  <span key={g.id} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11.5px", color: "var(--gray-700)" }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, width: "10px", height: "10px", borderRadius: "50%", backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                    <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                    <span style={{ flexShrink: 0, color: "var(--gray-500)", fontVariantNumeric: "tabular-nums" }}>{liveCameras(g).filter(hasPosition).length}</span>
                  </span>
                ))}
                {/* Said only when there are any — a legend row for a colour no dot wears is noise. */}
                {registered.some(c => hasPosition(c) && !groups.some(g => g.cameraIds.includes(c.id))) && (
                  <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11.5px", color: "var(--gray-500)", paddingTop: "4px", borderTop: "1px solid var(--gray-100)" }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "var(--gray-300)" }} />
                    {t.legendUngrouped}
                    <span style={{ flexShrink: 0, color: "var(--gray-400)", fontVariantNumeric: "tabular-nums" }}>
                      {registered.filter(c => hasPosition(c) && !groups.some(g => g.cameraIds.includes(c.id))).length}
                    </span>
                  </span>
                )}
              </div>
            }
          />
        </div>
      ) : (
        /*
         * ONE CARD PER ROW, EVERY CARD THE SAME WIDTH (owner, 2026-09-28: 카메라 여러대를 한
         * 그룹으로 묶을 가능성이 높아 카드 가로폭을 일정하고 최대로 해서 넓혀줘).
         *
         * It was auto-fill at a 300px floor — three columns on a wide window, which meant a card
         * 300-ish px wide held six camera names and said 「+34개 더」 about the rest. The whole
         * point of the card is which cameras are in the group, and a group is expected to hold
         * many, so the width the names need is the width the card gets.
         *
         * A single column also removes the reflow: at three columns the same card was 300px on
         * one window and 460px on another, so what it could show depended on the window.
         */
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {groups.map(group => {
            const cams = liveCameras(group);
            const holders = holderCount(group);
            return (
              <div key={group.id} style={{
                backgroundColor: "white", border: CARD_BORDER, borderRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW,
                padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {/* NO alignItems:start ON THE GRID, AND THE FOOTER IS PUSHED DOWN.
                    Measured before this: one row held cards 138, 123 and 120px tall because only
                    the first group carries a purpose line, so three 「가진 계정」 rules sat at
                    three different heights 15px apart. Repeated things share their edges — the
                    grid stretches every card to its row's tallest, and `marginTop: auto` on the
                    footer keeps the rule at the bottom instead of floating under the chips. */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</p>
                    {/* Only when it was written. A group with no purpose line renders nothing —
                        not an empty row, not a grey 「설명 없음」 standing in for an answer. */}
                    {group.description && (
                      <p style={{ fontSize: "11.5px", color: "var(--gray-500)", lineHeight: 1.5, marginTop: "3px" }}>{group.description}</p>
                    )}
                  </div>
                  {/* An empty group is worth seeing rather than reading as a zero: it grants
                      nothing today and will grant whatever somebody puts in it. */}
                  <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 700, color: cams.length === 0 ? "var(--gray-900)" : "var(--gray-600)", padding: "3px 8px", borderRadius: "999px", border: BORDER, backgroundColor: "var(--gray-50)", fontVariantNumeric: "tabular-nums" }}>
                    {cams.length === 0 ? t.camerasNone : t.cameras(cams.length)}
                  </span>
                  <RowActionsMenu actions={[
                    {
                      /* First, because it is the one that changes access rather than wording. */
                      label: t.cardEdit,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : t.notOwner,
                      onClick: () => setEditing(group),
                    },
                    {
                      label: t.remove,
                      danger: true,
                      disabled: !mayEdit,
                      reason: mayEdit ? undefined : readOnlyReason ?? t.notOwner,
                      onClick: () => setRemoving(group),
                    },
                  ]} />
                </div>

                {/* WHICH CAMERAS, not only how many. A count cannot be checked against what
                    somebody meant to group, and the names are what make the card recognisable. */}
                {cams.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {cams.slice(0, CARD_CHIP_CAP).map(c => (
                      <span key={c.id} style={{ fontSize: "11px", color: "var(--gray-600)", padding: "3px 7px", borderRadius: "6px", backgroundColor: "var(--gray-100)" }}>{c.name}</span>
                    ))}
                    {cams.length > CARD_CHIP_CAP && (
                      <span style={{ fontSize: "11px", color: "var(--gray-400)", padding: "3px 2px" }}>{t.andMore(cams.length - CARD_CHIP_CAP)}</span>
                    )}
                  </div>
                )}

                {/* THE REVERSE LOOKUP, ON EVERY CARD. Counted here rather than named: three names
                    do not fit a card's footer, and the account list is where you go to find out
                    which three. 「가진 계정 없음」 is said rather than shown as 0, because a group
                    nobody holds is a real state worth noticing — it grants nothing to anyone. */}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--gray-100)" }}>
                  <span style={{ fontSize: "11px", color: holders === 0 ? "var(--gray-400)" : "var(--gray-600)" }}>
                    {holders === 0 ? t.holdersNone : t.holders(holders)}
                  </span>
                  <span style={{ fontSize: "10.5px", color: "var(--gray-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.createdBy(group.createdBy, group.createdAt.slice(0, 10))}
                  </span>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {drawerOpen && (
        <CameraGroupEditor
          projectId={projectId}
          group={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}

      {removing && (
        <ConfirmModal
          title={t.removeTitle(removing.label)}
          /* The body says what it costs whoever holds it, and the count is only printed when there
             is one — "0 accounts hold it" is a sentence about nothing. */
          body={`${t.removeBody}${holderCount(removing) > 0 ? ` ${t.removeWithHolders(holderCount(removing))}` : ""}`}
          confirmLabel={t.removeConfirm}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            removeCameraGroup(removing.id);
            showToast({ variant: "warning", title: t.removedToast, desc: removing.label });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
