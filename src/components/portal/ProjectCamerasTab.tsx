"use client";

import { useEffect, useRef, useState } from "react";
import CameraImportModal from "./CameraImportModal";
import CameraMapView from "./CameraMapView";
import UploadPreviewModal from "./UploadPreviewModal";
import { CircleAlert, Cpu, FileInput, Gauge, FileOutput, MapPin, ServerOff, Table2, Film as FilmIcon, Image as ImageIcon, MapPinOff, ShieldCheck, Unplug, Video as VideoIcon, VideoOff } from "lucide-react";
import { useVcaStore, hasPosition, isAwaitingFirstContact, projectChannelLimit, type Camera, type CameraAddRefusal, type CameraKind, type ServerType, type CameraStatus, type UploadedMedia, type UploadStatus, SIGNED_IN_USER } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePortalLanguage } from "@/lib/i18n";
import { formatElapsed } from "@/lib/time";
import { forgetUploadFile, rememberUploadFile } from "@/lib/uploadBlobs";
import { ipv4Problem, FIELD_CHECK_T } from "@/lib/fieldChecks";
import { useToast } from "../Toast";
import { useFitRowsPerPage, TablePagination, PICKED_FILL, PICKED_LINE, CARD_RADIUS, BORDER, TABLE_COLUMN_GAP, TOOLBAR_GAP, SearchInput, CONTROL_HEIGHT, PANEL_SHADOW, TableEmpty, RowActionsMenu, FilterSelect, TextField, SortableHeader, SummaryStrip, Drawer, sortRows, useTableSort, ActiveFilterCount, usePortalEditAccess, ConfirmModal, FieldError, RequiredMark, type RowAction } from "./PortalShared";
import CameraStreamModal from "./CameraStreamModal";

const T = {
  en: {
    exportCsv: "Export CSV",
    importCsv: "Import CSV",
    viewTable: "Table",
    openMap: "Map",
    openMapWhy: "Where this project's cameras are, drawn from their coordinates.",
    addCamera: "Add camera",
    /* ONE NAME PER STATE, and these four are it. The summary cards used to say "connected /
       offline / refusing the connection / awaiting first contact" while the table and the filter
       said "Online / Offline / Error / Not yet connected" — so clicking a card that counted
       "refusing the connection" landed on rows labelled "Error", and three of the four states had
       two names depending on where you read them. The card wording won: it is the one that says
       what happened rather than how bad it is ("Error" is a severity, not a state). */
    online: "Connected",
    offline: "Offline",
    statusError: "Refusing the connection",
    atLimitReason: (limit: number) => `All ${limit} licensed channels are in use. Raising the limit is a contract change — see the Licence screen.`,
    atLimitBanner: (limit: number) => `All ${limit} licensed channels are in use. No further source can be connected until the limit is raised.`,
    noLicenceReason: "No channel count is recorded for this project, so there is nothing to connect against. A channel count arrives with the licence.",
    noLicenceBanner: "This project has no licensed channel count recorded. Sources cannot be connected until it does — the count comes from the contract, not from this console.",
    zeroChannelReason: "This project's licence carries no channels. Connecting a source needs a licence with at least one.",
    zeroChannelBanner: "This project's licence carries zero channels, so no source can be connected. That is a licence to correct rather than a limit to raise.",
    errIp: "That does not look like an address.",
    // Said when the button is pressed, not while somebody is still filling the form in. Ten fields
    // on a scrolling sheet: by the time the reader reaches the button the empty one is off the top
    // of the modal, so the marks alone do not answer "why did nothing happen".
    saveRefused: "Something above is empty or not in the right form — the fields are marked.",
    errRequired: "Required.",
    errRtsp: "A stream address starts with rtsp://",
    errLat: "Latitude runs from -90 to 90.",
    errLng: "Longitude runs from -180 to 180.",
    // offlineSuffix and onlineCountLabel were here and nothing ever rendered them — the summary
    // strip builds its cells from healthOffline/healthConnected plus healthOfFleet. Two spare
    // ways of saying a number that is already said on screen is what a copy review keeps filing
    // bugs against, so they are gone rather than kept in step with the live pair.
    confirmDeleteCamTitle: (name: string) => `Remove ${name}?`,
    confirmDeleteCamBody: "The camera comes off this project along with its zone, its server assignment and its place on the map. Recorded detections stay.",
    /* NAMES WHAT THE NUMBER COUNTS, not a state. "connected" under a figure reads as the status
       of one camera — the same word this table's status column puts on a row — so the cell looked
       like a state with a number stuck to it (owner, 2026-09-18: 연결됨은 저 숫자를 설명하는 말이
       아닌 것 같아). "Connected cameras" is the tally.
       NOT "detecting", which is what the owner reached for and what this figure cannot support:
       the register knows the last connection attempt answered, and nothing more. The app's own
       "running" is literally `status === "online"` renamed (see realtime/cameraStatus.runStateOf),
       so writing 감지 중 here would be the same fact wearing a bigger claim. Per-camera analysis
       state has to come from the server before any screen can say it. */
    healthConnected: "connected cameras",
    healthConnectedWhy: "Answered the last connection attempt. It says the stream is reachable, not that anything is looking at it.",
    healthOfFleet: (total: number) => `of ${total}`,
    healthAwaiting: "awaiting first contact",
    healthAwaitingWhy: "Registered here, never heard from. Not a fault — this is where every camera sits between being added and its first report. On installation day it is most of the fleet.",
    statusAwaiting: "Awaiting first contact",
    healthOffline: "offline",
    healthOldestOffline: (hours: number) => hours >= 24 ? `longest ${Math.floor(hours / 24)}d` : `longest ${hours}h`,
    lastAnswered: (elapsed: string) => `${elapsed} ago`,
    neverAnswered: "no answer yet",
    healthOfflineWhy: "No answer at all — the address is unreachable. Usually power, cable or network rather than the camera itself.",
    healthError: "refusing the connection",
    healthErrorWhy: "The camera answered and turned us away. Almost always the wrong credentials or a stream path that has changed.",
    healthChannelsLeft: "channels left",
    healthChannelsLeftWhy: "Of the channels this site's licence grants, this many are still free. Registering a camera takes one, whether it is typed in or imported, and at zero the form refuses.",
    healthNoServer: "no server assigned",
    assignServerAction: "Assign a server",
    healthNoServerWhy: "Nothing is pulling this camera's stream, so it records nothing and matches nobody — the video is discarded as it is produced. The status column still says connected, because the address answers; that is what makes this easy to miss. Assign a server on the camera's row.",
    healthNoPosition: "no coordinates yet",
    healthNoPositionWhy: "The register has the zone but not the latitude and longitude, so this camera is drawn nowhere on the map and nothing it detects can be counted toward a zone. Not a camera fault — the survey line is the part that is missing, and somebody on site fills it in.",
    healthShowOnly: "Show only these",
    healthClear: "Show everything again",
    /* THREE, IN THE ORDER PEOPLE ACTUALLY TYPE. It listed four — name, code, RTSP URL, IP — which
       is the field reciting its implementation. The code is generated, never typed, so nobody
       searches by one they remember (owner: 코드 검색은 몰라서 못할 것 같은데); it stays in the
       copy because the one reader who HAS a code — from a CSV or a ticket saying "CAM-BLK-026
       offline" — needs to know it will match, but it goes last. The RTSP URL is rarer still and
       comes out of the sentence entirely; the box still matches it. */
    searchPlaceholder: "Search by name, IP address, or code",
    filterAllZones: "All zones",
    filterAllStatus: "All status",
    filtersActive: (n: number) => `${n} filter${n === 1 ? "" : "s"}`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "All",
    kindTabCamera: "Cameras",
    kindTabVideo: "Videos",
    kindTabImage: "Images",
    kindTabDeepfake: "Deepfake",
    sourceDeepfake: "Deepfake check",
    verdictAuthentic: "Authentic",
    verdictManipulated: "Manipulated",
    verdictInconclusive: "Inconclusive",
    verdictScore: (n: number) => `${Math.round(n * 100)}%`,
    /* PARALLEL WITH THE ITEM ABOVE IT. Both are uploads; what differs is what happens next, so
       the label carries the purpose and keeps the verb. "의뢰" (a request lodged with somebody)
       read as a different kind of act from its two siblings, which are just things you add
       (owner, 2026-09-18: 딥페이크 검사 의뢰 이 문장 좀 어색해). */
    deepfakeFileOption: "Upload for deepfake check",
    deepfakeUploadTitle: "Deepfake check",
    deepfakeUploadHint: "MP4, MOV, JPG, PNG. Judged authentic or manipulated — this does not search the file for faces.",
    colSource: "Source",
    sourceCamera: "Camera",
    sourceVideo: "Video",
    sourceImage: "Image",
    colAddress: "Connection info",
    colResolution: "Resolution",
    statusPending: "Queued",
    statusAnalyzing: "Analysing",
    statusDone: "Analysed",
    statusFailed: "Failed",
    detectionsFound: (n: number) => `${n} face${n === 1 ? "" : "s"}`,
    addSource: "Add source",
    addCameraOption: "Camera (RTSP)",
    uploadFileOption: "Upload video or image",
    uploadTitle: "Upload footage",
    uploadDrop: "Drag a file here",
    uploadHint: "MP4, MOV, JPG, PNG. Analysed for faces and shown in Best Frame.",
    uploadChoose: "Choose file",
    toastUploadedTitle: "Uploaded",
    previewUploadAction: "Play file",
    removeUploadAction: "Remove upload",
    toastUploadRemovedTitle: "Upload removed",
    emptyNoSources: "Nothing registered for this project yet.",
    fieldIp: "IP address",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "Model",
    fieldModelPlaceholder: "XNP-6400R",
    fieldUsername: "User ID",
    fieldUsernamePlaceholder: "Stream account",
    fieldPassword: "Password",
    fieldPasswordPlaceholder: "Stream password",
    fieldPasswordEditHint: "Leave blank to keep the current password.",
    fieldServerNoneAvailable: "This project has no server registered yet — add one under Servers & API. A camera can be registered before then.",
    passwordNotStoredHint: "Sent to the server with the camera and never read back — it is not kept in this browser.",
    fieldServer: "Associated server",
    fieldServerNone: "Select a server",
    fieldLat: "Latitude",
    fieldLng: "Longitude",
    // No clearFilters label: ActiveFilterCount is a chip that clears on its own ×, and this
    // string was never rendered. A wording nobody reads drifts from the ones they do.
    selectedCount: (n: number) => `${n} selected`,
    bulkClearSelection: "Clear selection",
    bulkMoveToZone: "Move to zone",
    bulkGroup: "Group these",
    groupModalTitle: (n: number) => `Group ${n} camera${n === 1 ? "" : "s"}`,
    groupModalBody: "A group is how camera access is handed out on Users & Permissions. Whoever holds this group sees whatever is in it — including cameras added to it later.",
    groupNameLabel: "Group name",
    groupNamePlaceholder: "North gate",
    groupCreate: "Create group",
    groupDuplicate: "A group on this project already has that name.",
    groupCreatedTitle: "Camera group created",
    groupCreatedDesc: (label: string, n: number) => `${label} · ${n} camera${n === 1 ? "" : "s"}`,
    bulkDelete: "Remove",
    bulkDeleteConfirm: (n: number) => `Remove ${n} camera${n === 1 ? "" : "s"}?`,
    bulkDeleteBody: "They stop being monitored immediately and their channels are freed. Recordings already made are not deleted.",
    bulkDeletedTitle: (n: number) => `${n} camera${n === 1 ? "" : "s"} removed`,
    bulkMovedTitle: (n: number, zone: string) => `${n} camera${n === 1 ? "" : "s"} moved to ${zone}`,
    // Same words as the VIP table's checkbox — one control, one label. "shown" is in both
    // because both only ever select the rows on screen.
    selectAllLabel: "Select all rows shown",
    colCamera: "Camera",
    colSourceName: "Source",
    colFileName: "File",
    colServer: "Server",
    colZone: "Zone",
    // No colRtspStream: this table's address column prints the IP and the resolution (see
    // colAddress and the row that fills it), so a heading naming the stream URL was both unused
    // and untrue. One column, one name.
    colStatus: "Status",
    emptyFiltered: "No cameras match these filters.",
    previewAction: "Preview stream",
    editAction: "Edit",
    removeAction: "Remove",
    // TWO LEVELS, TWO NOUNS, AND NO MORE THAN THAT. The collection is Input Sources — cameras,
    // footage, images, deepfake submissions — so the tab, the sidebar and the one primary button
    // (a menu) say "source". What that menu creates is a KIND, and this modal is the camera
    // branch: every field in it is a camera's (IP, maker, model, RTSP, coordinates), and it can
    // make nothing else. So it says camera (owner's note, 2026-09-18: "소스추가가 아니라 카메라
    // 추가 아닐까?").
    //
    // The five-name walk this replaced is the thing to stay away from: 입력 소스 (sidebar) →
    // 카메라 추가 (overview) → 소스 추가 (tab) → 입력 장치 추가 (modal) → 기기 추가 + 기기 이름
    // (fields). Source / camera / input device / device inside one flow. "입력 장치" was still on
    // the edit title until now — the same leftover, one noun further along.
    addModalTitle: "Add camera",
    editModalTitle: "Edit camera",
    fieldDeviceName: "Camera name",
    fieldDeviceNamePlaceholder: "Novena",
    fieldLocation: "Location",
    fieldLocationPlaceholder: "Entrance",
    fieldZone: "Zone",
    fieldZonePlaceholder: "Front Gate",
    fieldRtspUrl: "Connection — RTSP URL",
    fieldSourceType: "Source type",
    kindNormal: "Normal camera",
    kindAi: "AI camera",
    kindNormalWhy: "Hands over a stream for a Face Recognition or Normal Camera node to analyse.",
    kindAiWhy: "Runs the analysis on the device and reports results, so it reports to an AI Camera node.",
    fieldServerNoneForKind: "This project has no server that takes this kind of camera yet.",
    fieldMaker: "Maker",
    cancel: "Cancel",
    // One word, both languages. Every other save in Portal is "Save" / "저장" — the server form,
    // the roster, the categories — and this was the only 변경사항 저장 among nine plain 저장.
    saveChanges: "Save",
    addDevice: "Add",
    addAnother: "Add, then next camera",
    addAnotherWhy: "Registers this camera and keeps the form open for the next one. What a batch shares — maker, model, credentials, server, zone — stays filled in.",
    addedSoFar: (n: number) => `${n} added`,
    addAnotherAtLimit: "No channel left on the licence.",
    refusedOverLimit: "The licence has no channel left, so this camera was not registered. Free a channel or ask for more, then try again.",
    refusedDuplicateCode: "A camera is already registered under this code. Change the name — the code is derived from it.",
    refusedDuplicateStream: "This project already polls that RTSP URL. Two rows on one stream count the same detections twice, so this one was not registered.",
    closeAfterBatch: "Done",
    confirmOfflineTitle: "Mark camera offline?",
    confirmOfflineBody: (name: string) => `${name} will show as offline for everyone monitoring this project — make sure the stream is actually down before confirming.`,
    markOffline: "Mark offline",
    undoOfflineMark: "Undo offline mark",
    toastCameraAddedTitle: "Camera added",
    toastCameraAddedDesc: (name: string) => `${name} registered. No connection confirmed yet.`,
    toastCameraUpdatedTitle: "Camera updated",
    toastMarkedOfflineTitle: "Marked offline",
    toastOfflineMarkUndoneTitle: "Offline mark removed",
    toastCameraRemovedTitle: "Camera removed",
    toastExportTitle: "Export complete",
    toastExportDesc: (n: number) => `${n} camera(s) exported to CSV.`,
    csvHeaderName: "Name",
    csvHeaderCode: "Code",
    csvHeaderKind: "Source type",
    csvHeaderZone: "Zone",
    csvHeaderLocation: "Location",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "Status",
  },
  ko: {
    exportCsv: "CSV 내보내기",
    importCsv: "CSV 가져오기",
    viewTable: "테이블",
    openMap: "지도",
    openMapWhy: "등록된 좌표로 이 프로젝트의 카메라 위치를 그립니다.",
    addCamera: "카메라 추가",
    online: "연결됨",
    offline: "오프라인",
    statusError: "연결 거부",
    atLimitReason: (limit: number) => `라이선스 채널 ${limit}개를 모두 쓰고 있습니다. 한도를 올리는 것은 계약 변경입니다 — 라이선스 화면을 보세요.`,
    atLimitBanner: (limit: number) => `라이선스 채널 ${limit}개를 모두 쓰고 있습니다. 한도를 올리기 전에는 소스를 더 연결할 수 없습니다.`,
    noLicenceReason: "이 프로젝트에 기록된 채널 수가 없어서, 연결의 근거가 될 값이 없습니다. 채널 수는 라이선스와 함께 들어옵니다.",
    noLicenceBanner: "이 프로젝트에는 라이선스 채널 수가 기록되어 있지 않습니다. 기록되기 전에는 소스를 연결할 수 없습니다 — 그 수는 계약에서 나오지, 이 콘솔에서 정해지지 않습니다.",
    zeroChannelReason: "이 프로젝트의 라이선스에 채널이 0개입니다. 소스를 연결하려면 채널이 있는 라이선스가 필요합니다.",
    zeroChannelBanner: "이 프로젝트의 라이선스에 채널이 0개라 소스를 연결할 수 없습니다. 한도를 올릴 문제가 아니라 라이선스를 바로잡을 문제입니다.",
    errIp: "주소 형식이 아닙니다.",
    saveRefused: "위에 비어 있거나 형식이 맞지 않는 항목이 있습니다 — 해당 칸에 표시했습니다.",
    errRequired: "필수 항목입니다.",
    errRtsp: "스트림 주소는 rtsp:// 로 시작합니다.",
    errLat: "위도는 -90에서 90 사이입니다.",
    errLng: "경도는 -180에서 180 사이입니다.",
    confirmDeleteCamTitle: (name: string) => `${name}을(를) 삭제할까요?`,
    confirmDeleteCamBody: "이 프로젝트에서 카메라가 빠지고, 존·서버 배정·지도 위 위치도 함께 사라집니다. 기록된 탐지는 남습니다.",
    healthConnected: "연결된 카메라",
    healthConnectedWhy: "마지막 연결 시도에 응답했습니다. 스트림에 닿는다는 뜻이지, 누가 보고 있다는 뜻은 아닙니다.",
    healthOfFleet: (total: number) => `/ ${total}대`,
    healthAwaiting: "첫 연결 대기",
    healthAwaitingWhy: "여기 등록만 되고 아직 한 번도 응답한 적이 없습니다. 고장이 아니라, 모든 카메라가 등록과 첫 보고 사이에 거치는 자리입니다. 설치 당일에는 대부분이 여기 있습니다.",
    statusAwaiting: "첫 연결 대기",
    healthOffline: "오프라인",
    healthOldestOffline: (hours: number) => hours >= 24 ? `가장 오래 ${Math.floor(hours / 24)}일` : `가장 오래 ${hours}시간`,
    lastAnswered: (elapsed: string) => `${elapsed} 전 마지막 응답`,
    neverAnswered: "아직 응답 없음",
    healthOfflineWhy: "응답이 아예 없습니다. 주소에 닿지 않는 상태로, 대개 카메라보다 전원·케이블·네트워크 문제입니다.",
    healthError: "연결 거부",
    healthErrorWhy: "카메라가 응답은 했지만 접속을 거절했습니다. 거의 항상 계정 정보가 틀렸거나 스트림 경로가 바뀐 경우입니다.",
    healthChannelsLeft: "남은 채널",
    healthChannelsLeftWhy: "이 현장의 라이선스가 준 채널 중 아직 비어 있는 수입니다. 카메라를 한 대 등록하면 하나가 줄고, 직접 등록이든 일괄 가져오기든 같습니다. 0이 되면 폼이 거절합니다.",
    healthNoServer: "서버 미지정",
    assignServerAction: "서버 지정",
    healthNoServerWhy: "이 카메라의 스트림을 아무도 끌어가지 않습니다. 그래서 녹화도 탐지도 없고, 영상은 만들어지는 대로 버려집니다. 주소는 응답하니 상태 열에는 「연결됨」으로 보이고, 그래서 놓치기 쉽습니다. 해당 행에서 연결 서버를 지정하세요.",
    healthNoPosition: "좌표 미등록",
    healthNoPositionWhy: "구역은 적혀 있지만 위도·경도가 없습니다. 그래서 지도 어디에도 그려지지 않고, 이 카메라가 잡은 탐지는 어느 구역으로도 집계되지 않습니다. 카메라 고장이 아니라 등록부에 측량값이 빠진 것이라, 현장에서 좌표를 재서 채워 넣으면 됩니다.",
    healthShowOnly: "이 항목만 보기",
    healthClear: "전체 다시 보기",
    searchPlaceholder: "이름, IP 주소, 코드로 검색",
    filterAllZones: "전체 구역",
    filterAllStatus: "전체 상태",
    filtersActive: (n: number) => `필터 ${n}개`,

    // Source kinds — cameras and uploaded footage share one table
    kindTabAll: "전체",
    kindTabCamera: "카메라",
    kindTabVideo: "영상",
    kindTabImage: "이미지",
    kindTabDeepfake: "딥페이크",
    sourceDeepfake: "딥페이크 검사",
    verdictAuthentic: "진짜",
    verdictManipulated: "조작됨",
    verdictInconclusive: "판정 불가",
    verdictScore: (n: number) => `${Math.round(n * 100)}%`,
    deepfakeFileOption: "딥페이크 검사 업로드",
    deepfakeUploadTitle: "딥페이크 검사",
    deepfakeUploadHint: "MP4, MOV, JPG, PNG. 진짜인지 조작인지 판정합니다 — 얼굴을 찾지는 않습니다.",
    colSource: "종류",
    sourceCamera: "카메라",
    sourceVideo: "영상",
    sourceImage: "이미지",
    colAddress: "연결 정보",
    colResolution: "해상도",
    statusPending: "대기",
    statusAnalyzing: "분석 중",
    statusDone: "분석 완료",
    statusFailed: "실패",
    detectionsFound: (n: number) => `얼굴 ${n}개`,
    addSource: "소스 추가",
    addCameraOption: "카메라 (RTSP)",
    uploadFileOption: "영상·이미지 업로드",
    uploadTitle: "영상 업로드",
    uploadDrop: "여기에 파일을 놓으세요",
    uploadHint: "MP4, MOV, JPG, PNG. 얼굴을 분석해 베스트 프레임에서 볼 수 있습니다.",
    uploadChoose: "파일 선택",
    toastUploadedTitle: "업로드됨",
    previewUploadAction: "파일 재생",
    removeUploadAction: "업로드 삭제",
    toastUploadRemovedTitle: "업로드가 삭제됨",
    emptyNoSources: "이 프로젝트에 등록된 소스가 없습니다.",
    fieldIp: "IP 주소",
    fieldIpPlaceholder: "10.20.4.11",
    fieldModel: "모델",
    fieldModelPlaceholder: "XNP-6400R",
    fieldUsername: "사용자 ID",
    fieldUsernamePlaceholder: "스트림 계정",
    fieldPassword: "비밀번호",
    fieldPasswordPlaceholder: "스트림 비밀번호",
    fieldPasswordEditHint: "비워두면 기존 비밀번호를 그대로 사용합니다.",
    fieldServerNoneAvailable: "이 프로젝트에 등록된 서버가 아직 없습니다 — 서버 및 API에서 추가하세요. 그 전에도 카메라는 등록할 수 있습니다.",
    passwordNotStoredHint: "카메라와 함께 서버로 전송되며 다시 읽어오지 않습니다 — 브라우저에는 남지 않습니다.",
    fieldServer: "연결 서버",
    fieldServerNone: "선택하세요",
    fieldLat: "위도",
    fieldLng: "경도",
    selectedCount: (n: number) => `${n}대 선택됨`,
    bulkClearSelection: "선택 해제",
    bulkMoveToZone: "구역 이동",
    bulkGroup: "그룹으로 묶기",
    groupModalTitle: (n: number) => `카메라 ${n}대를 그룹으로`,
    groupModalBody: "그룹은 사용자 및 권한에서 카메라 권한을 줄 때 쓰는 단위입니다. 이 그룹을 가진 사람은 그룹에 든 것을 보게 되고, 나중에 그룹에 추가되는 카메라도 함께 보게 됩니다.",
    groupNameLabel: "그룹 이름",
    groupNamePlaceholder: "북문 일대",
    groupCreate: "그룹 만들기",
    groupDuplicate: "이 프로젝트에 같은 이름의 그룹이 이미 있습니다.",
    groupCreatedTitle: "카메라 그룹을 만들었습니다",
    groupCreatedDesc: (label: string, n: number) => `${label} · 카메라 ${n}대`,
    bulkDelete: "삭제",
    bulkDeleteConfirm: (n: number) => `카메라 ${n}대를 삭제할까요?`,
    bulkDeleteBody: "즉시 모니터링이 중단되고 채널이 반환됩니다. 이미 저장된 녹화는 삭제되지 않습니다.",
    bulkDeletedTitle: (n: number) => `카메라 ${n}대가 삭제됨`,
    bulkMovedTitle: (n: number, zone: string) => `카메라 ${n}대를 ${zone}(으)로 이동함`,
    selectAllLabel: "보이는 행 전체 선택",
    colCamera: "카메라",
    colSourceName: "소스",
    colFileName: "파일",
    colServer: "서버",
    colZone: "구역",
    colStatus: "상태",
    emptyFiltered: "이 필터와 일치하는 카메라가 없습니다.",
    previewAction: "스트림 미리보기",
    editAction: "수정",
    removeAction: "삭제",
    addModalTitle: "카메라 추가",
    editModalTitle: "카메라 수정",
    fieldDeviceName: "카메라 이름",
    fieldDeviceNamePlaceholder: "Novena",
    fieldLocation: "위치",
    fieldLocationPlaceholder: "입구",
    fieldZone: "구역",
    fieldZonePlaceholder: "정문 구역",
    fieldRtspUrl: "연결 — RTSP URL",
    fieldSourceType: "소스 종류",
    kindNormal: "일반 카메라",
    kindAi: "AI 카메라",
    kindNormalWhy: "스트림을 넘겨서 얼굴인식 또는 일반 카메라 서버가 분석합니다.",
    kindAiWhy: "장치에서 분석해 결과를 보고하므로 AI 카메라 서버에 붙습니다.",
    fieldServerNoneForKind: "이 프로젝트에는 이 종류의 카메라를 받는 서버가 아직 없습니다.",
    fieldMaker: "제조사",
    cancel: "취소",
    saveChanges: "저장",
    addDevice: "추가",
    addAnother: "추가하고 다음 카메라",
    addAnotherWhy: "이 카메라를 등록하고 폼을 열어 둔 채 다음 대로 넘어갑니다. 한 묶음이 공유하는 값 — 제조사·모델·계정·연결 서버·구역 — 은 채워진 채로 남습니다.",
    addedSoFar: (n: number) => `${n}대 등록됨`,
    addAnotherAtLimit: "라이선스에 남은 채널이 없습니다.",
    refusedOverLimit: "라이선스에 남은 채널이 없어 등록하지 않았습니다. 채널을 비우거나 추가한 뒤 다시 시도하세요.",
    refusedDuplicateCode: "이 코드로 이미 등록된 카메라가 있습니다. 이름을 바꿔주세요 — 코드는 이름에서 만듭니다.",
    refusedDuplicateStream: "이 프로젝트가 이미 그 RTSP 주소를 보고 있습니다. 한 스트림에 두 행이면 같은 탐지를 두 번 세게 되므로 등록하지 않았습니다.",
    closeAfterBatch: "완료",
    confirmOfflineTitle: "카메라를 오프라인으로 표시하시겠습니까?",
    confirmOfflineBody: (name: string) => `${name} 카메라가 이 프로젝트를 모니터링하는 모든 사용자에게 오프라인으로 표시됩니다. 확인하기 전에 실제로 스트림이 끊겼는지 확인하세요.`,
    markOffline: "오프라인으로 표시",
    undoOfflineMark: "오프라인 표시 취소",
    toastCameraAddedTitle: "카메라 추가됨",
    // Not "연결되었습니다". The same call writes status: "offline" and attempts no connection —
    // the row it creates says 최초 응답 대기 while the toast said the opposite.
    toastCameraAddedDesc: (name: string) => `${name}을(를) 등록했습니다. 아직 연결을 확인하지 못했습니다.`,
    toastCameraUpdatedTitle: "카메라 정보 수정됨",
    toastMarkedOfflineTitle: "오프라인으로 표시됨",
    toastOfflineMarkUndoneTitle: "오프라인 표시 취소됨",
    toastCameraRemovedTitle: "카메라 삭제됨",
    toastExportTitle: "내보내기 완료",
    toastExportDesc: (n: number) => `카메라 ${n}대가 CSV로 내보내졌습니다.`,
    csvHeaderName: "이름",
    csvHeaderCode: "코드",
    csvHeaderKind: "소스 종류",
    csvHeaderZone: "구역",
    csvHeaderLocation: "위치",
    csvHeaderRtspUrl: "RTSP URL",
    csvHeaderStatus: "상태",
  },
} as const;

/**
 * How far the stuck header overhangs the content on each side, to swallow the shadow the cards
 * underneath cast outside their own boxes. 8px covers PANEL_SHADOW's 6px blur with a pixel to
 * spare, and lands well inside the shell's 32px gutter.
 */
const EDGE_BLEED = 8;

/**
 * How few free channels counts as "nearly full", and therefore worth a cell.
 *
 * Five, because that is about one afternoon's worth of registrations — enough warning to ask for
 * more channels before a batch stops halfway, and not so early that the cell is on screen for
 * months. It is a display threshold only: nothing is refused until the licence is actually full.
 */
const CHANNELS_LOW = 5;

// CSS position:sticky kept fighting PortalShell's padded scroll container — the header either
// left a gap a scrolled-past row showed through, or (once patched with a negative-margin/padding
// trick to close that gap) sat taller than every other tab's header, since sticky reserves that
// same padded box in normal flow even before it engages. Measuring the real scrolling ancestor in
// JS and switching to position:fixed while "stuck" sidesteps both: no ancestor padding/stacking
// ambiguity (fixed paints in the root stacking context), and the spacer below is sized to the
// header's own actual height, not a padded approximation.
function useStickyHeader<T extends HTMLElement>() {
  const contentRef = useRef<T>(null);
  const [stuck, setStuck] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; padTop: number } | null>(null);
  const [height, setHeight] = useState(0);
  /* The header's own left and width, taken while it is still in normal flow.
     They used to come from the scrolling ancestor, which worked while that ancestor WAS the capped,
     centred content box. The scroller is full width now (see PortalShell: the wheel has to work in
     the margins too), so measuring it would stretch the fixed copy to the window. The element's own
     box is the content column by definition. */
  const boxRef = useRef<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent) {
      const overflowY = getComputedStyle(scrollParent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;
    const sp = scrollParent;

    const update = () => {
      const spRect = sp.getBoundingClientRect();
      const spStyle = getComputedStyle(sp);
      const padLeft = parseFloat(spStyle.paddingLeft) || 0;
      const padRight = parseFloat(spStyle.paddingRight) || 0;
      const padTop = parseFloat(spStyle.paddingTop) || 0;
      // The fixed box pins the header to where it sits at scrollTop 0, so it must engage on the
      // very first pixel of scroll. Waiting until the header's own offset (the container's
      // top padding) is passed let it scroll up that far and then snap back down when it engaged.
      const nextStuck = sp.scrollTop > 0;
      // Measure the header only while it is still in normal flow. Once fixed, offsetHeight also
      // counts the padTop below, which the container's own padding already provides — a spacer
      // sized to that pushes every row down by that much the moment the header engages.
      if (!nextStuck) {
        setHeight(el.offsetHeight);
        // offsetWidth, not the rect's: the rect can carry a fractional width from the centred
        // wrapper, and a half-pixel makes the fixed copy's edges miss the cards below by a hair.
        boxRef.current = { left: el.getBoundingClientRect().left, width: el.offsetWidth };
      }
      setStuck(nextStuck);
      // top sits at the container's own border edge (not +padTop) so the fixed box's background
      // covers the container's top-padding strip too — otherwise that strip shows whatever
      // scrolled-content happens to align there once scrolled deep enough to clear it (bleed-
      // through). padTop is applied as inline padding below instead, so the header's own content
      // still visually lands at the same y it occupied in normal flow — no jump when it engages.
      // clientWidth, not the bounding rect's width: the rect includes the scrollbar gutter, so the
      // moment this tab's content grew long enough to scroll — which is the moment the header
      // engages — the fixed box became a scrollbar-width wider than the cards below it and its
      // left and right edges stopped lining up with them.
      // top and the top padding still come from the scroller — that is what the header is pinned
      // against. left and width come from the header's own box.
      const box = boxRef.current;
      setRect({
        left: box ? box.left : spRect.left + padLeft,
        top: spRect.top,
        width: box ? box.width : sp.clientWidth - padLeft - padRight,
        padTop,
      });
    };
    update();
    sp.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(sp);
    return () => {
      sp.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return { contentRef, stuck, rect, height };
}

// Badge icons for the metric cards, at the size the Overview's badges use.

// DEFAULT_THUMBNAIL was here — a stock office corridor stamped onto every camera registered
// through Portal and then captioned 최근 프레임. Removed with its call sites; Camera.thumbnail is
// optional now and an unphotographed camera draws an empty frame.
type CameraSortKey = "name" | "server" | "resolution" | "zone" | "status";

/**
 * One row type for both kinds of input source.
 *
 * A camera and an uploaded recording are different objects with different fields, but they answer
 * the same question for an administrator — "what is feeding analysis on this project" — so they
 * share a table, the way the previous product's INPUT screen did. What that screen got wrong is
 * worth not repeating: it had a CONNECTION INFO column that was blank on every file row and a
 * RESOLUTION column blank on every camera row, and a "TOTAL CAMERAS 4" header sitting above seven
 * rows. Here the two are one `address` field (an IP for a camera, a resolution for a file — both
 * are "how this source is identified"), and the metrics above the table count the two separately,
 * because only cameras consume a licensed channel.
 */
/**
 * Sort order for the status column, as a rank rather than the raw value.
 *
 * Sorting on the strings put uploads above cameras, because "done" happens to precede "offline"
 * alphabetically — an accident of spelling deciding what an administrator sees first on a tab whose
 * main job is the camera fleet. The rank says what the order is for: cameras before files, and
 * within each group whatever needs attention before whatever does not.
 *
 * The two groups still read as two axes on screen (green/grey for a connection, blue/grey for an
 * analysis); this only settles which row comes first when they share a list.
 */
const STATUS_RANK: Record<CameraStatus | UploadStatus, number> = {
  // An error outranks silence: a camera that refuses a connection is a camera somebody can fix
  // from this screen, and one that has simply stopped answering usually is not.
  error: 0,
  offline: 1,
  online: 2,
  failed: 3,
  pending: 4,
  analyzing: 5,
  done: 6,
};

type SourceKind = "camera" | "video" | "image" | "deepfake";
type SourceRow =
  | { kind: "camera"; id: string; name: string; camera: Camera }
  | { kind: "video" | "image" | "deepfake"; id: string; name: string; upload: UploadedMedia };

const MAKERS = ["Hanwha", "Hikvision", "Dahua"];
// No resolution chooser, and no status chooser — see CameraFormValues.
// No Source Type chooser: the v1 contract is plain CCTV only, so there is nothing to choose
// between (backend reply C2, 2026-09-09). See the note above Camera in the store.

interface CameraFormValues {
  /** Normal or AI — the first thing the previous product's form asked, and what decides which
   *  servers the picker below can offer. See CameraKind in the store. */
  kind: CameraKind;
  name: string;
  ip: string;
  location: string;
  zone: string;
  rtspUrl: string;
  maker: string;
  model: string;
  username: string;
  /**
   * Held in the form only. It is never written to the store and never read back into the form on
   * edit — a stream credential in browser state is a credential in every future persistence layer
   * and in any state dump. The real call posts it with the camera and the server keeps only its own
   * copy; editing shows an empty box, which is what "unchanged" looks like everywhere else.
   */
  password: string;
  serverId: string;
  lat: string;
  lng: string;
  /*
   * NOT HERE, deliberately (2026-09-15): resolution and status used to be two selects at the foot
   * of this form, and neither was a question the person filling it in could answer.
   *
   * Status was offered only on ADD, so an operator declared a camera online or offline before
   * anything had been plugged in — and that answer went straight into the Overview's "51 of 60
   * connected". The same fix the server form took this morning. A camera added here now starts
   * offline, the way one added by the setup wizard already did: nothing has reached this address.
   *
   * Resolution is the device's own answer — an RTSP stream states it the moment it connects — and
   * the field it wrote was read in exactly one place, a line on the grid card. Camera.resolution
   * stays on the type for the server to fill; this form stops guessing it.
   */
}

const EMPTY_FORM: CameraFormValues = {
  // Most cameras are plain ones, so the common answer is pre-selected — this is a two-way choice
  // with a clear default, not a question with no answer.
  kind: "normal",
  name: "", ip: "", location: "", zone: "", rtspUrl: "",
  maker: MAKERS[0], model: "", username: "", password: "",
  serverId: "", lat: "", lng: "",
};

// Camera codes are an internal identifier (shown in the table, used in mock RTSP paths) — the
// reference popup this modal now matches doesn't surface a code field, so it's derived from the
// name instead of typed in by the operator.
function generateCameraCode(name: string, existing: string[]): string {
  /*
   * No Latin letters in the name means no prefix at all — "CAM-001", not "CAM-CAM-001".
   * The fallback used to be the literal string "CAM", so a Korean-named fleet came out as
   * CAM-CAM-001, CAM-CAM-002 … and the segment that exists to tell cameras apart told you
   * nothing about any of them.
   */
  const letters = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const prefix = letters || null;
  /*
   * The sequence comes from the codes that exist, not from how many cameras there are.
   *
   * Counting produced collisions the moment anything had been deleted: five cameras, add
   * "Alpha Gate" -> CAM-ALP-006, delete an older one, add "Alpine Road" -> CAM-ALP-006 again.
   * Two cameras sharing the code that the table, the CSV export and every audit message
   * identify them by.
   *
   * Scoped to the prefix, so the numbers stay short and readable per family rather than being
   * one global counter.
   */
  const stem = prefix ? `CAM-${prefix}-` : "CAM-";
  const used = new Set(existing);
  let n = existing.filter(c => c.startsWith(stem)).length + 1;
  let code = `${stem}${String(n).padStart(3, "0")}`;
  while (used.has(code)) {
    n += 1;
    code = `${stem}${String(n).padStart(3, "0")}`;
  }
  return code;
}

function CameraFormModal({
  title, initial, isEdit, servers, onClose, onSubmit, onSubmitAndAnother, addedInSitting = 0, atLimit = false,
  submitRefusal = null, onTouched, t,
}: {
  title: string;
  initial: CameraFormValues;
  isEdit: boolean;
  /** This project's servers, for the Associated server picker — with their type, because which
   *  ones a camera may report to depends on its kind (see serversForKind). Empty is a valid state:
   *  a project can have cameras before it has anywhere to run them. */
  servers: { id: string; name: string; type: ServerType }[];
  onClose: () => void;
  onSubmit: (values: CameraFormValues) => void;
  /** Registers and stays open for the next one. Absent on the edit form — there is no "and
   *  another" when the subject is one existing camera. */
  onSubmitAndAnother?: (values: CameraFormValues) => void;
  /** How many this sitting has registered, for the line beside the buttons. */
  addedInSitting?: number;
  /** No channel left on the licence: both save buttons refuse, and the reason is written out. */
  atLimit?: boolean;
  /** Why the LAST press did not register anything — the store's answer, already in words. The
   *  form stays open carrying it, because everything the reader typed is still the best draft of
   *  the camera they meant to add. */
  submitRefusal?: string | null;
  /** Clears that message as soon as a field changes: a refusal about the address they have since
   *  corrected is a message arguing with a form that no longer says what it complained about. */
  onTouched?: () => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  const [form, setForm] = useState<CameraFormValues>(initial);
  // This modal takes its dictionary as a prop, but the shared format messages are keyed by
  // language rather than copied into every file's T — so it reads the language itself.
  const [lang] = usePortalLanguage();
  /*
   * Coordinates and the address are checked, not swallowed.
   *
   * `Number(values.lat) || 0` turned a typo into 0,0 — a camera silently placed in the Gulf of
   * Guinea rather than a form saying the number is wrong. The IP took any string at all, and
   * the RTSP field took one with no scheme.
   *
   * Deliberately loose where looseness is right: IP is optional (a camera can be registered
   * before its address is known) and only refused when what is typed plainly is not one.
   */
  const latNum = form.lat.trim() === "" ? null : Number(form.lat);
  const lngNum = form.lng.trim() === "" ? null : Number(form.lng);
  const latError = latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90);
  const lngError = lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180);
  /* Two questions, because one of them was doing the other's job. The charset test refuses
     "camera 3" and a pasted sentence; it said nothing at all about "192.168.0.300", which is
     made only of characters it allows. A malformed address is the likelier typo of the two. */
  const ipCharsBad = form.ip.trim() !== "" && !/^[0-9a-zA-Z.:_-]+$/.test(form.ip.trim());
  const ipShape = ipv4Problem(form.ip);
  const ipError = ipCharsBad || ipShape !== null;
  const rtspError = form.rtspUrl.trim() !== "" && !/^rtsp:\/\/.+/i.test(form.rtspUrl.trim());
  /*
   * The two the form cannot do without, held apart from the format checks above.
   *
   * A name and a stream address were the only silent half of this form: every other refusal wrote
   * a line under its field, and these two just killed the button. Ten fields and no mark on either
   * of them, so the reader's next move is to guess.
   */
  const blank = (v: string) => v.trim().length === 0;
  const nameMissing = blank(form.name);
  const rtspMissing = blank(form.rtspUrl);
  const ipMissing = blank(form.ip);
  const modelMissing = blank(form.model);
  const usernameMissing = blank(form.username);
  /* Demanded when the camera is created and not when it is edited — the password is never stored
     (see CameraFormValues), so the edit form opens with an empty box, and treating that as missing
     would make renaming a camera cost a trip to the installer's password list. Blank on an edit
     means "keep the one the server has", which is what the line under the field says. */
  const passwordMissing = !isEdit && blank(form.password);
  /* Only once there is one to pick. This is an on-premises product: a site can be handed its
     camera list before we have installed its server, and a required field with an empty menu is a
     door with no handle. The hint under the field says so rather than the form silently letting it
     pass. */
  /*
   * THE SERVERS THIS KIND OF CAMERA CAN REPORT TO.
   *
   * An AI camera analyses on the device and reports results, so it belongs to the AI Camera node;
   * a normal camera hands over a stream, so it belongs to a Face Recognition or Normal Camera
   * node. Offering all of them let somebody attach a plain camera to the AI node — a pairing the
   * estate cannot run, and one nothing on this screen would ever have complained about.
   *
   * Switching the kind re-checks what is already chosen: a server that no longer fits is cleared
   * rather than left in place looking accepted (see pickKind).
   */
  const serversForKind = servers.filter(sv => form.kind === "ai"
    ? sv.type === "AI Camera"
    : sv.type === "Face Recognition" || sv.type === "Normal Camera");
  const serverMissing = serversForKind.length > 0 && form.serverId === "";
  const pickKind = (kind: CameraKind) => setForm(f => {
    const stillFits = servers.some(sv => sv.id === f.serverId && (kind === "ai"
      ? sv.type === "AI Camera"
      : sv.type === "Face Recognition" || sv.type === "Normal Camera"));
    return { ...f, kind, serverId: stillFits ? f.serverId : "" };
  });
  /*
   * COORDINATES ARE REQUIRED, and this is the field whose absence costs the most.
   *
   * Settled 2026-09-18, from how the existing service actually works: a camera's latitude and
   * longitude are what put it in a district, and a district's VIP figure is the detections of
   * every camera in it. So a camera with no coordinates is not merely absent from the map — its
   * detections are absent from every district total, and no screen says "this number was counted
   * without three cameras". A silent undercount of the figure the customer reads is worse than a
   * form that refuses to save.
   *
   * It was the one pair the previous product left optional (owner's note with its Add New Camera
   * screenshot: 마지막 값 두 개 빼고는 필수였다), which is exactly how the register ended up with
   * unsurveyed rows. Two other doors make them too — the CSV import and the provisioning wizard —
   * and a rule enforced at one of three doors is not a rule. See HANDOFF-SERVER §사람이 정해야
   * 할 것 2, now answered.
   *
   * Absence, not zero: an empty box is missing, and 0,0 is a real point in the Gulf of Guinea.
   * The latError/lngError checks above keep that distinction.
   */
  const latMissing = form.lat.trim().length === 0;
  const lngMissing = form.lng.trim().length === 0;
  const valid = !nameMissing && !rtspMissing && !ipMissing && !modelMissing && !usernameMissing
    && !passwordMissing && !serverMissing && !latMissing && !lngMissing
    && !latError && !lngError && !ipError && !rtspError;
  /*
   * Refused on the press, not while somebody is still typing.
   *
   * An empty form that starts red the moment it opens is arguing with a person who has not said
   * anything yet, which is why the format checks here only speak once their field is non-empty.
   * The button stays greyed — it still will not save — but it stays pressable so the press has
   * somewhere to land. That is the signup wizard's rule, written out over .portal-btn-primary in
   * globals.css: a disabled button cannot tell you why it is disabled.
   */
  const [refused, setRefused] = useState(false);
  /* Bumped on every "and keep going", and used as a key on the name field so the field remounts
     and takes focus — where the next camera's first keystroke belongs. */
  const [round, setRound] = useState(0);

  /*
   * WHAT A BATCH SHARES STAYS, WHAT IDENTIFIES ONE CAMERA CLEARS.
   *
   * Twelve cameras going in at one site are the same maker and model, reached with the same
   * installer credential, pointed at the same server, standing in the same zone. Clearing those
   * would make the second camera as much typing as the first, which is the whole reason this
   * button exists. What cannot carry over is what tells one camera from another: its name, its
   * address, its stream path and — since the coordinates are now what puts it in a district —
   * its position. Carrying a position over would put twelve cameras on one spot.
   */
  const nextInBatch = () => {
    setForm(f => ({ ...f, name: "", ip: "", rtspUrl: "", lat: "", lng: "" }));
    setRefused(false);
    setRound(r => r + 1);
  };

  const field = (
    key: "name" | "ip" | "location" | "zone" | "rtspUrl" | "model" | "username" | "password" | "lat" | "lng",
    /* A node, not a string: the required fields carry the shared red marker after their text. The
       asterisk used to be typed into the label sentence itself, which made it grey like the label
       and put the same marker in two dictionaries to keep in sync. */
    label: React.ReactNode,
    placeholder: string,
    opts?: { type?: string; inputMode?: "decimal"; error?: string; remountKey?: number; autoFocus?: boolean },
  ) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      {/* TextField, not a bare input: it carries the shared height and the shared focus ring, so a
          field and the select next to it in this same form stop being two different controls. */}
      <TextField
        key={opts?.remountKey}
        value={form[key]}
        onChange={v => { onTouched?.(); setForm(f => ({ ...f, [key]: v })); }}
        placeholder={placeholder}
        type={opts?.type}
        inputMode={opts?.inputMode}
        autoFocus={opts?.autoFocus}
        autoComplete={key === "password" ? "new-password" : undefined}
      />
      {/* Under the field it belongs to. The submit button greys out either way, but a disabled
          button with no reason is a form that has stopped talking to you. */}
      {opts?.error && <FieldError>{opts.error}</FieldError>}
    </div>
  );

  const selectField = (label: React.ReactNode, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{label}</label>
      <FilterSelect value={value} onChange={onChange} options={options} />
    </div>
  );


  return (
    /* The panel's own body scrolls. It was the backdrop that scrolled before, because the
       FilterSelects on this form open as absolutely positioned lists and an overflow on the sheet
       cut them off at its edge — the list measures the room under its trigger and opens upward
       when there is none, so the panel can scroll without eating them. */
    <Drawer title={title} onClose={onClose} width="520px"
      footer={
        /* Readable text beside the dead button rather than a tooltip on it — the call the licence
           tab's install button already makes, for the same reason: a tooltip on a disabled control
           is unreliable across browsers and this sentence has to be read. */
        /* A COLUMN, because three buttons and a sentence do not fit on one line. They shared a
           wrapping row and the sentence pushed 취소 up onto its own line, leaving the three
           buttons split across two rows in no particular order. The message gets the line above
           and the buttons keep theirs. */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {submitRefusal ? (
            /* Outranks the "something above is empty" line: the form IS filled in — the register
               refused it, which is a different sentence and the only one that explains why the
               camera is not in the list. */
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--danger-500)", lineHeight: 1.45, margin: 0 }}>
              {submitRefusal}
            </p>
          ) : refused && !valid ? (
            <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45, margin: 0 }}>
              {t.saveRefused}
            </p>
          ) : atLimit ? (
            <p style={{ fontSize: "11px", color: "var(--gray-500)", lineHeight: 1.45, margin: 0 }}>
              {t.addAnotherAtLimit}
            </p>
          ) : addedInSitting > 0 ? (
            /* The form staying open looks identical whether the last one saved or not. The toast
               says so and is gone in four seconds; this reader is still typing. */
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--success-500)", lineHeight: 1.45, margin: 0 }}>
              {t.addedSoFar(addedInSitting)}
            </p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
          {/* NO BOX ON THE WAY OUT (owner: 취소는 박스라인을 없애면 어때). Three bordered buttons
              in a row are three equals, and one of them does nothing to the form — the borders
              were spending attention on the least consequential control. Bare text, outline,
              filled: leaving, the batch, the save. The same ladder the toolbar above already
              climbs, where the secondary actions carry no box either. */}
          <button className="portal-btn-quiet" onClick={onClose} style={{ padding: "10px 12px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-500)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {/* 닫기 once something has gone in: 취소 would claim it can undo the four cameras
                already registered. Same distinction the bulk bar draws. */}
            {addedInSitting > 0 ? t.closeAfterBatch : t.cancel}
          </button>
          {/* SECONDARY, AND ONLY WHEN ADDING. Between one camera and a hundred (which is the CSV's
              job) sits the batch somebody types in, and for that the expensive part is reopening
              the form. Left of the primary so the ordinary single add stays the rightmost, biggest
              target — Salesforce's "Save & New" and Google's "저장 후 다른 항목 추가" sit there too.
              
              THE LABEL NAMES WHAT COMES NEXT. It read "추가하고 계속" first, and 계속 does not say
              what continues — the form? the wizard? the day? (owner: 추가하고 계속이라는 버튼으로
              바로 이해할 수 있는 건가?) Naming the next object is what the established labels all
              do: Save & New, Save and add another, Create another. */}
          {onSubmitAndAnother && (
            <button className="portal-btn-outline" title={t.addAnotherWhy}
              onClick={() => { if (!valid) { setRefused(true); return; } onSubmitAndAnother(form); nextInBatch(); }}
              disabled={atLimit}
              style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: atLimit ? "var(--gray-300)" : "var(--gray-700)", fontSize: "13px", fontWeight: 700, cursor: atLimit ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {t.addAnother}
            </button>
          )}
          <button className="portal-btn-primary" onClick={() => (valid ? onSubmit(form) : setRefused(true))}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: valid ? "var(--primary-400)" : "var(--gray-200)", color: valid ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {isEdit ? t.saveChanges : t.addDevice}
          </button>
          </div>
        </div>
      }>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* FIRST, because it changes what the rest of the form means — and because it is where
            the previous product asked it. Two boxes rather than a select: there are exactly two
            answers, they are chosen once, and a select would hide one of them behind a click.
            Each says what it is under its name — "AI camera" is not self-explanatory to somebody
            holding an installer's invoice. */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.fieldSourceType}<RequiredMark /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {([
              { value: "normal" as CameraKind, label: t.kindNormal, why: t.kindNormalWhy },
              { value: "ai" as CameraKind, label: t.kindAi, why: t.kindAiWhy },
            ]).map(option => {
              const on = form.kind === option.value;
              return (
                <button key={option.value} type="button" onClick={() => pickKind(option.value)} title={option.why}
                  style={{
                    textAlign: "left", padding: "9px 12px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                    /* The shared picked box (PICKED_LINE/PICKED_FILL). This one was drawn by hand
                       in primary-400 on primary-50 with purple TEXT — the same shape as every other
                       two-way picker in Portal but one step louder, and the purple lettering made a
                       chosen option look like a link. The label goes back to gray-900, which is
                       what the other pickers give the one that is on. */
                    border: on ? PICKED_LINE : BORDER,
                    backgroundColor: on ? PICKED_FILL : "white",
                    color: on ? "var(--gray-900)" : "var(--gray-600)",
                    display: "flex", alignItems: "center", gap: "7px",
                  }}>
                  {option.value === "ai" ? <Cpu size={14} strokeWidth={2.4} /> : <VideoIcon size={14} strokeWidth={2.4} />}
                  <span style={{ fontSize: "12px", fontWeight: 700 }}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {field("name", <>{t.fieldDeviceName}<RequiredMark /></>, t.fieldDeviceNamePlaceholder, {
          error: refused && nameMissing ? t.errRequired : undefined,
          // Remounted per batch round so autoFocus fires again — see nextInBatch.
          remountKey: round, autoFocus: round > 0,
        })}
        {field("ip", <>{t.fieldIp}<RequiredMark /></>, t.fieldIpPlaceholder, {
          error: ipShape ? FIELD_CHECK_T[lang][ipShape] : ipCharsBad ? t.errIp : refused && ipMissing ? t.errRequired : undefined,
        })}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {selectField(<>{t.fieldMaker}<RequiredMark /></>, form.maker, MAKERS.map(m => ({ value: m, label: m })), v => setForm(f => ({ ...f, maker: v })))}
          {field("model", <>{t.fieldModel}<RequiredMark /></>, t.fieldModelPlaceholder, {
            error: refused && modelMissing ? t.errRequired : undefined,
          })}
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("username", <>{t.fieldUsername}<RequiredMark /></>, t.fieldUsernamePlaceholder, {
              error: refused && usernameMissing ? t.errRequired : undefined,
            })}
            {field("password", <>{t.fieldPassword}<RequiredMark /></>, t.fieldPasswordPlaceholder, {
              type: "password",
              error: refused && passwordMissing ? t.errRequired : undefined,
            })}
          </div>
          {/* Says where the password goes, because an empty box on the edit form otherwise reads
              as "we lost it" rather than "we never had it". */}
          <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "6px", lineHeight: 1.45 }}>
            {isEdit ? `${t.fieldPasswordEditHint} ${t.passwordNotStoredHint}` : t.passwordNotStoredHint}
          </p>
        </div>

        {/* The malformed case wins over the empty one: they cannot both be true, and rtspError
            is the more specific thing to say. */}
        {field("rtspUrl", <>{t.fieldRtspUrl}<RequiredMark /></>, "rtsp://10.20.4.11:554/stream1", {
          error: rtspError ? t.errRtsp : refused && rtspMissing ? t.errRequired : undefined,
        })}

        <div>
          {selectField(
            <>{t.fieldServer}<RequiredMark /></>,
            form.serverId,
            [{ value: "", label: t.fieldServerNone }, ...serversForKind.map(sv => ({ value: sv.id, label: sv.name }))],
            v => setForm(f => ({ ...f, serverId: v })),
          )}
          {servers.length === 0
            ? <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "6px", lineHeight: 1.45 }}>{t.fieldServerNoneAvailable}</p>
            : serversForKind.length === 0
              /* There are servers, just none of this kind — a different sentence from "no server
                 yet", and the one that tells the reader their next move is on the other screen. */
              ? <p style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "6px", lineHeight: 1.45 }}>{t.fieldServerNoneForKind}</p>
              : refused && serverMissing ? <FieldError>{t.errRequired}</FieldError> : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {field("lat", <>{t.fieldLat}<RequiredMark /></>, "0.0", { inputMode: "decimal", error: latError ? t.errLat : refused && latMissing ? t.errRequired : undefined })}
          {field("lng", <>{t.fieldLng}<RequiredMark /></>, "0.0", { inputMode: "decimal", error: lngError ? t.errLng : refused && lngMissing ? t.errRequired : undefined })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {field("location", t.fieldLocation, t.fieldLocationPlaceholder)}
          {field("zone", t.fieldZone, t.fieldZonePlaceholder)}
        </div>

      </div>
    </Drawer>
  );
}

/**
 * Confirms one direction, because there is only one. This took a `nextStatus` and carried a second
 * set of strings for going the other way — "Reconnect camera?", "This attempts to reconnect ... and
 * marks it online" — which described an attempt that never happened; see markCameraOffline for why
 * that direction is gone. A dialog with one outcome does not need to be told which outcome it is.
 */
function ConfirmStatusModal({
  camera, onClose, onConfirm, t,
}: {
  camera: Camera;
  onClose: () => void;
  onConfirm: () => void;
  t: (typeof T)["en"] | (typeof T)["ko"];
}) {
  useEscapeKey(onClose);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: BORDER, maxWidth: "380px", width: "100%", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.confirmOfflineTitle}</p>
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "8px" }}>{t.confirmOfflineBody(camera.name)}</p>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="portal-btn-outline" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            {t.cancel}
          </button>
          <button onClick={onConfirm}
            style={{
              padding: "10px 16px", borderRadius: "8px", border: "none",
              backgroundColor: "var(--danger-400)", color: "white",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
            }}>
            {t.markOffline}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Status colours for an upload. Deliberately not the camera palette: green/grey there means a live
 * connection is up or down, and an analysis that has finished is not the same kind of fact as a
 * stream that is alive. Blue for done, grey for waiting, red for failed — so a glance at the column
 * tells you which of the two questions a row is answering.
 */
const UPLOAD_STATUS_TONE: Record<UploadStatus, { dot: string; text: string; label: "statusPending" | "statusAnalyzing" | "statusDone" | "statusFailed" }> = {
  pending:   { dot: "var(--gray-300)",  text: "var(--gray-500)",  label: "statusPending" },
  analyzing: { dot: "var(--info-500)",  text: "var(--info-500)",  label: "statusAnalyzing" },
  done:      { dot: "var(--info-500)",  text: "var(--info-500)",  label: "statusDone" },
  failed:    { dot: "var(--danger-400)", text: "var(--danger-400)", label: "statusFailed" },
};

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "";
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * @param openCameraId  A camera to open the detail modal on as soon as this tab mounts — set by the
 *   Overview's camera panel, whose rows now open the camera rather than dumping the reader at the
 *   top of this list. Cleared through onCameraOpened so a later visit to the tab opens plain.
 */
export default function ProjectCamerasTab({ projectId, openCameraId, onCameraOpened, openGapFilter, onGapFilterOpened }: {
  projectId: string;
  openCameraId?: string | null;
  onCameraOpened?: () => void;
  /**
   * Arrive with the no-coordinate filter already on, sent by the Overview's errand strip.
   *
   * Same reason as ProjectVipTab's openHealthFilter: the line above says "six cameras are not on
   * the map", and landing on all sixty leaves the reader to find which six. Which six IS the
   * content of the line.
   */
  openGapFilter?: boolean;
  onGapFilterOpened?: () => void;
}) {
  const project = useVcaStore(s => s.projects.find(p => p.id === projectId));
  const cameras = useVcaStore(s => s.cameras);
  const uploads = useVcaStore(s => s.uploads);
  const servers = useVcaStore(s => s.servers);
  const addUpload = useVcaStore(s => s.addUpload);
  const recordListExport = useVcaStore(s => s.recordListExport);
  const removeUpload = useVcaStore(s => s.removeUpload);
  const addCamera = useVcaStore(s => s.addCamera);
  const updateCamera = useVcaStore(s => s.updateCamera);
  const removeCamera = useVcaStore(s => s.removeCamera);
  const removeCameras = useVcaStore(s => s.removeCameras);
  const setCamerasZone = useVcaStore(s => s.setCamerasZone);
  const setCameraStatus = useVcaStore(s => s.setCameraStatus);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const { contentRef: stickyRef, stuck, rect, height: stickyHeight } = useStickyHeader<HTMLDivElement>();

  const [showAdd, setShowAdd] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  // Holds just the id — the live Camera object is looked up from `cameras` below on every render,
  // so actions taken inside the modal (e.g. Reconnect) are reflected immediately instead of
  // showing a stale snapshot captured at the moment the modal opened.
  const [inspectingCameraId, setInspectingCameraId] = useState<string | null>(null);
  /* The file row's equivalent of the camera preview. Same gesture, different subject: one is a
     stream somebody is watching, the other a recording that waits to be played. */
  const [inspectingUploadId, setInspectingUploadId] = useState<string | null>(null);
  /**
   * Opens the camera the Overview's panel handed over, once, and tells the parent it is done so a
   * later visit to this tab opens plain. Effect rather than initial state: this component stays
   * mounted while the tab is open, so a second click on a second camera has to reach it too.
   */
  useEffect(() => {
    if (!openCameraId) return;
    const id = openCameraId;
    // In a microtask, not straight from the effect body: setting state synchronously there makes
    // React render this tree twice before it paints, and the lint rule that catches cascading
    // renders is right to flag it. The same trick the Overview uses for its post-mount clock.
    queueMicrotask(() => {
      setInspectingCameraId(id);
      onCameraOpened?.();
    });
  }, [openCameraId, onCameraOpened]);
  const [confirmingStatusCam, setConfirmingStatusCam] = useState<Camera | null>(null);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  // "awaiting" is not a CameraStatus — it is offline plus a never-reported clock. The filter
  // carries it anyway because it is what a reader actually wants to narrow to on install day.
  const [statusFilter, setStatusFilter] = useState<"ALL" | "online" | "offline" | "error" | "awaiting">("ALL");
  /**
   * Which "installed but doing nothing" gap the list is narrowed to, if any — set by the summary
   * strip above the table.
   *
   * Its own state rather than another value on statusFilter, even though the cell that sets it
   * sits in the same strip: statusFilter is also bound to the select beside the search box, whose
   * options are all connection states, so a value that select cannot draw would leave it reading
   * "All status" over a narrowed table. And it is not a connection state to begin with — a camera
   * with no coordinates can be online, offline or never-contacted, and it stays whichever of those
   * it is while the gap is being fixed.
   */
  /* TWO GAPS, NOT ONE. Both are "registered and not doing its job", and they are different jobs to
     fix — a surveyor fills in coordinates, an installer assigns a server. Hotjar splits the same
     pair the same way (Not installed / No data received). */
  const [gapFilter, setGapFilter] = useState<"noPosition" | "noServer" | null>(null);
  /* queueMicrotask for the reason ProjectVipTab spells out at its own copy of this: the parent
     clears the flag in the same commit, and StrictMode renders this tree twice before it paints. */
  useEffect(() => {
    if (!openGapFilter) return;
    queueMicrotask(() => {
      setGapFilter("noPosition");
      onGapFilterOpened?.();
    });
  }, [openGapFilter, onGapFilterOpened]);
  // Which kind of source the table is showing. A tab row, not another select in the filter strip:
  // it is the top-level cut of the list, and the counts belong on it.
  const [kindTab, setKindTab] = useState<"ALL" | SourceKind>("ALL");
  /** Which purpose the upload sheet was opened for: null when closed. The sheet is the same one
   *  either way — the same files go in — and only the question being asked of them differs, which
   *  is what the wording and the resulting row's kind follow. */
  const [uploadPurpose, setUploadPurpose] = useState<"media" | "deepfake" | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // An auditor reads this fleet; they do not add to it, re-point it or delete from it.
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const [hoveredAddItem, setHoveredAddItem] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const projectCameras = cameras.filter(c => c.projectId === projectId);
  /*
   * The licensed ceiling, enforced rather than only drawn.
   *
   * The Licence screen states "no further camera can be connected until the limit is raised"
   * and the Overview's bar turns red past it — and nothing checked. A hundred-channel project
   * took a hundred and one cameras, so the one number the customer pays per unit of was the
   * one number the console did not hold.
   *
   * Uploads are not channels and are not counted: a channel is a live stream being processed.
   *
   * HANDOFF NOTE: this is the UI half. The provisioning call has to refuse it too, or a client
   * that never opened Portal is unbounded.
   */
  const channelLimit = project ? projectChannelLimit(project) : undefined;
  const channelsUsed = projectCameras.length;
  /**
   * No recorded limit is "not licensed", not "unlimited".
   *
   * `channelLimit !== undefined && ...` read an absent licence as permission for any number of
   * cameras, and the wizard that creates projects (`addProject`) writes no licence fields at
   * all — so every site made from it accepted an unbounded fleet. The four seeded projects all
   * carry a limit, which is why this never showed.
   *
   * The product already argues the other way everywhere else: a project is a licensed site, and
   * PortalEmptyState says in as many words that a self-serve project is "a contract shell with
   * no contract" that nobody could put a camera in. This makes the code agree with that.
   *
   * HANDOFF NOTE: the front end refusing is the polite half. The provisioning call has to refuse
   * too — a client that never opens Portal is otherwise unbounded, and whether the count belongs
   * to the installation or to each project is still open.
   */
  const channelLimitUnrecorded = channelLimit === undefined;
  const atChannelLimit = !channelLimitUnrecorded && channelsUsed >= channelLimit;
  /**
   * Zero channels is not "the limit is full", even though the arithmetic agrees (0 >= 0).
   *
   * A licence that grants nothing produced "all 0 licensed channels are in use", which invites
   * the wrong fix — nobody can free a channel that was never granted. It should not happen (the
   * issuer refuses a zero-channel licence), but a screen that reads as nonsense on a value the
   * screen itself can receive is worth two strings. Flagged by the session that built the
   * licence-file intake.
   */
  const zeroChannelLicence = channelLimit === 0;
  const cannotAddSource = channelLimitUnrecorded || atChannelLimit;
  /** What is left to register. Undefined limit is "not licensed", which the banner handles. */
  const channelsLeft = channelLimit === undefined ? 0 : Math.max(0, channelLimit - channelsUsed);
  const projectUploads = uploads.filter(u => u.projectId === projectId);
  const projectServers = servers.filter(sv => sv.projectId === projectId);
  /*
   * ONLY THE SERVERS A CAMERA CAN ACTUALLY BE ATTACHED TO — and the form narrows it again by the
   * camera's kind (see serversForKind there).
   *
   * The picker offered every server on the project, which on this site means it offered
   * "image store 1" and "database 1" — a camera is not connected to a database. A required field
   * whose menu contains wrong answers is worse than an optional one: it makes somebody choose,
   * and every option is equally plausible to a reader who does not know the estate.
   *
   * The three that take a stream, by ServerType. Image Store and Database are where results land,
   * not where a camera reports. Note the full list stays for the TABLE — a camera already
   * attached to something unusual must still show what it says, or the column would print "—"
   * for a value the register holds.
   */
  const cameraCapableServers = projectServers.filter(sv =>
    sv.type === "Face Recognition" || sv.type === "AI Camera" || sv.type === "Normal Camera");

  useEffect(() => {
    if (!addMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addMenuOpen]);
  const zones = Array.from(new Set(projectCameras.map(c => c.zone).filter(Boolean)));
  const { sort, toggle: toggleSort } = useTableSort<CameraSortKey>({ key: "status", direction: "asc" });
  // Search is not counted. It is visible as text in its own box and clearing it is obvious, whereas
  // a select that says "Offline" looks like a heading until you look twice.
  /**
   * Three ways a camera can be on this list and be doing nothing at all.
   *
   * Every one of them is online, thumbnailed and unremarkable in the table — which is exactly why
   * they need stating: a camera with no engine detects nothing, one with no server has no compute
   * to do it on, and one with no coordinates never appears on the app's map, so the control room
   * cannot see it exists. All three are read off fields the table already holds, so the figures
   * and the rows behind them cannot disagree.
   *
   * Offline and error are deliberately not here: the status filter beside the search box already
   * carries both counts, and a summary that repeats a control is a summary the reader learns to
   * skip.
   */

  const activeFilterCount = [zoneFilter, statusFilter].filter(v => v !== "ALL").length + (gapFilter === null ? 0 : 1);
  // Selected camera ids. Held as a Set of ids rather than of rows so a selection survives the list
  // being re-sorted or re-filtered underneath it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [groupingSelection, setGroupingSelection] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const addCameraGroup = useVcaStore(s => s.addCameraGroup);
  /*
   * Escape for the bulk delete, which is inline JSX rather than a component and so cannot call
   * useEscapeKey for itself. It had a working backdrop click and a dead Escape key, which is the
   * exact drift the shared hook exists to prevent — and this is the bulk delete. The upload
   * dialog was the other one; it is a Drawer now and brings its own.
   */
  useEscapeKey(
    () => setConfirmingBulkDelete(false),
    confirmingBulkDelete,
  );

  const clearFilters = () => { setZoneFilter("ALL"); setStatusFilter("ALL"); setGapFilter(null); };

  const q = search.trim().toLowerCase();
  const matchingCameras = projectCameras.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.rtspUrl.toLowerCase().includes(q) || c.ip.includes(q);
    const matchesZone = zoneFilter === "ALL" || c.zone === zoneFilter;
    const matchesStatus = statusFilter === "ALL"
      ? true
      : statusFilter === "awaiting" ? isAwaitingFirstContact(c)
      : statusFilter === "offline" ? c.status === "offline" && !isAwaitingFirstContact(c)
      : c.status === statusFilter;
    const matchesGap = gapFilter === null
      || (gapFilter === "noPosition" ? !hasPosition(c) : !c.serverId);
    return matchesSearch && matchesZone && matchesStatus && matchesGap;
  });
  const matchingUploads = projectUploads.filter(u => {
    const matchesSearch = !q || u.fileName.toLowerCase().includes(q);
    // Zone and AI-engine are camera properties. A file has neither, so any of those filters being
    // set means the person is looking at cameras and files should drop out — hiding them is the
    // honest answer, not showing them as if they had passed a filter they cannot be judged by.
    // A gap filter is a camera question too — a file has no engine, no server and no coordinates,
    // and showing files while one is on would be showing rows that cannot be judged by it.
    const cameraOnlyFilterSet = zoneFilter !== "ALL" || gapFilter !== null;
    // Status filter is shared but its values are not: "online"/"offline" describe a connection and
    // a file has none, so the same reasoning applies.
    return matchesSearch && !cameraOnlyFilterSet && statusFilter === "ALL";
  });

  // Cameras and uploads become one row list before sorting, so a sort is a sort of the table and
  // not of two stacked tables.
  const allRows: SourceRow[] = [
    ...matchingCameras.map((c): SourceRow => ({ kind: "camera", id: c.id, name: c.name, camera: c })),
    ...matchingUploads.map((u): SourceRow => ({ kind: u.kind, id: u.id, name: u.fileName, upload: u })),
  ].filter(r => kindTab === "ALL" || r.kind === kindTab);

  // Offline first by default. The table's job here is "what needs attention", and a fleet sorted
  // alphabetically buries the three cameras that are down among the ninety-seven that are not.
  const visibleRows = sortRows(allRows, sort, (r, key) => {
    if (r.kind === "camera") {
      const c = r.camera;
      switch (key) {
        case "name": return c.name.toLowerCase();
        // Unassigned sinks to the bottom of the ascending pass rather than sorting under an
        // empty string at the top — a camera on no server is the interesting row, and the reader
        // reaches it by sorting the other way.
        case "server": return projectServers.find(sv => sv.id === c.serverId)?.name.toLowerCase();
        case "resolution": return c.resolution?.toLowerCase();
        case "zone": return c.zone?.toLowerCase();
        case "status": return STATUS_RANK[c.status];
      }
    }
    // A file has no maker and no zone — undefined sinks it to the bottom of those sorts rather
    // than inventing a value that would put it in a position it has not earned.
    switch (key) {
      case "name": return r.upload.fileName.toLowerCase();
      case "resolution": return undefined;
      case "status": return STATUS_RANK[r.upload.status];
      default: return undefined;
    }
  });
  /*
   * PAGED. 69 sources on the seeded site and a real fleet is hundreds — the list ran off the
   * bottom with no way to say where in it you were, the same thing the VIP registry was paged for
   * (owner's ask). Same shared component, same default of 25.
   *
   * `visibleRows` stays the full filtered set: the counts, the select-all and the CSV export are
   * about everything the filters admit, not about the page somebody happens to be looking at.
   */
  const [page, setPage] = useState(1);
  /* Measured, not fixed — see useFitRowsPerPage. 69px is this table's row height, measured, and
     it is the registry's too — the two tables now show the same 48px tile (owner's note,
     2026-09-18: "vip 화면 테이블 높이로 맞춰줘"). */
  const { listRef, rowsPerPage, setRowsPerPage, perPageOptions } = useFitRowsPerPage(69);
  const pagingKey = `${kindTab}|${search}|${statusFilter}|${zoneFilter}`;
  const [lastPagingKey, setLastPagingKey] = useState(pagingKey);
  if (lastPagingKey !== pagingKey) { setLastPagingKey(pagingKey); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visibleRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // The grid view and the camera-only actions (batch reconnect, CSV export) still work on cameras.
  const visibleCameras = visibleRows.filter((r): r is Extract<SourceRow, { kind: "camera" }> => r.kind === "camera").map(r => r.camera);

  // Maker, zone and AI engines are camera facts. On a files-only tab they would be a column of
  // dashes on every row — which is exactly the fault in the screen this replaces — so the tab drops
  // them instead of printing them empty. On the combined tab they stay, because a mixed list has
  // rows that fill them.
  const showCameraColumns = kindTab === "ALL" || kindTab === "camera";
  /*
   * The 종류 column only earns its place on the mixed tab. On any single-kind tab every row says
   * the same word — 62 rows of "카메라", or four of "딥페이크" — and the tab above already says
   * which kind you picked. Same rule the zone and server columns follow one line up: a column
   * whose value is identical on every row is not information.
   */
  const showKindColumn = kindTab === "ALL";
  /*
   * ONE TRACK PER CELL, which it was not.
   *
   * The camera variants carried a spare fr track between 상태 and the 70px actions column —
   * left over from the AI-engines column that was deleted. Nothing filled it, so a camera row's
   * ⋯ menu sat in that spare track while a FILE row, which had one cell more, pushed its menu
   * into the 70px one: two rows in one table with their last column in different places (owner:
   * 마지막 꺼만 ... 항목이 달라서 어색해). Counting the cells is the fix, not nudging widths.
   */
  const GRID = showCameraColumns
    ? (showKindColumn
        ? "28px 48px 1.4fr 0.7fr 0.7fr 0.7fr 1.2fr 1fr 70px"
        : "28px 48px 1.6fr 0.75fr 0.75fr 1.3fr 1fr 70px")
    : (showKindColumn
        ? "28px 48px 2fr 0.8fr 1.2fr 0.9fr 70px"
        : "28px 48px 2.2fr 1.3fr 1fr 70px");

  // Only rows that are actually on screen count as selected. Filtering to Offline while three
  // online cameras are ticked would otherwise leave a delete button armed with rows the person
  // can no longer see.
  const visibleSelectedIds = visibleCameras.filter(c => selectedIds.has(c.id)).map(c => c.id);
  const allVisibleSelected = visibleCameras.length > 0 && visibleSelectedIds.length === visibleCameras.length;
  const toggleRow = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelectedIds(prev => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleCameras.forEach(c => next.delete(c.id));
    else visibleCameras.forEach(c => next.add(c.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = () => {
    const count = visibleSelectedIds.length;
    removeCameras(visibleSelectedIds);
    clearSelection();
    setConfirmingBulkDelete(false);
    showToast({ variant: "success", title: t.bulkDeletedTitle(count) });
  };
  const bulkMoveToZone = (zone: string) => {
    const count = visibleSelectedIds.length;
    setCamerasZone(visibleSelectedIds, zone);
    clearSelection();
    showToast({ variant: "success", title: t.bulkMovedTitle(count, zone) });
  };

  const onlineCount = projectCameras.filter(c => c.status === "online").length;
  // Counted, not derived from the total: with a third state, "everything that is not online" is
  // two different errands and one number would hide the smaller one.
  /* Split off the ones nothing has ever reached. Before this, registering a camera added a number
     to a warning cell — so installation day, when fifty are typed in and none is wired yet, read
     as fifty faults. See isAwaitingFirstContact(). */
  /* Read after mount, never during render — see oldestOfflineDays. */
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => { queueMicrotask(() => setNowMs(Date.now())); }, []);
  const awaitingCount = projectCameras.filter(isAwaitingFirstContact).length;
  const offlineRows = projectCameras.filter(c => c.status === "offline" && !isAwaitingFirstContact(c));
  const offlineCount = offlineRows.length;
  /*
   * HOW LONG THE WORST ONE HAS BEEN DARK.
   *
   * "9 오프라인" reads the same whether all nine dropped five minutes ago — a network blip that
   * will clear itself — or three have been dark a fortnight because somebody unplugged them.
   * Those are different errands and the count cannot tell them apart. lastSeenAt is already in
   * the register, so the strip can say which one this is.
   *
   * Post-mount only, and null until then: this is a clock read, and a figure that differs between
   * the server's render and the browser's first one is the hydration mismatch this codebase keeps
   * paying for (see the registry's 일괄 업로드 오류 cell, fixed today). Absent for the first frame
   * is the correct answer, not a guess.
   */
  const oldestOfflineHours = nowMs === null || offlineRows.length === 0 ? null : offlineRows.reduce((worst, c) => {
    if (!c.lastSeenAt) return worst;
    const hours = Math.floor((nowMs - Date.parse(c.lastSeenAt)) / 3_600_000);
    return Number.isFinite(hours) && hours > worst ? hours : worst;
  }, 0);
  const errorCount = projectCameras.filter(c => c.status === "error").length;
  /* Registered here, nowhere on the map. Read through hasPosition rather than a truthiness test:
     0 is a real coordinate, and `!c.lat` would file the one camera actually sitting on a meridian
     as unsurveyed — which is the same confusion between "absent" and "zero" that put unsurveyed
     cameras in the Gulf of Guinea in the first place. */
  const noPositionCount = projectCameras.filter(c => !hasPosition(c)).length;
  /*
   * REGISTERED, REACHABLE, AND WATCHED BY NOBODY.
   *
   * A camera with no server is not a camera we cannot look at — it is a camera whose video is
   * being thrown away as it is produced. Nothing pulls the stream, so there is no recording, no
   * detection, and nothing to go back to later. And the status column says 연결됨 about it, which
   * is true and is the whole problem: the good half is visible and the useless half is not.
   *
   * Counted here for the same reason 좌표 미등록 is: the only way to find these rows was to scan
   * a column of em dashes. Four products solve it the same way — a count with a denominator
   * (Deel), the count as the filter (Rox "Needs Attention (5)"), and the row itself naming what is
   * missing rather than showing a blank (YNAB, Pin, Hotjar).
   */
  const noServerCount = projectCameras.filter(c => !c.serverId).length;
  // Anything not yet analysed — queued or mid-run. Both are "not done", and an administrator does
  // the same thing about either: wait, or find out why.


  // `password` is read off the form and dropped here on purpose — see CameraFormValues. Everything
  // else the form collects is stored.
  /*
   * HOW MANY WENT IN WITHOUT THE FORM CLOSING.
   *
   * Twelve cameras at one site is the ordinary case and the CSV is the answer for a hundred, but
   * between the two there is a range where opening the form twelve times is the whole job (owner's
   * ask, 2026-09-18: csv로 가져오진 못하고 여러 대 등록할 경우에 하기 좋게). The counter is shown
   * beside the buttons because the form staying open looks the same whether the last one saved or
   * not — the toast says so too, but a toast is gone in four seconds and this reader is typing.
   */
  const [addedInSitting, setAddedInSitting] = useState(0);
  /* What the store said no to, if it did. Cleared the moment the form is touched again — see
     CameraFormModal's submitRefusal prop. */
  const [addRefusal, setAddRefusal] = useState<CameraAddRefusal | null>(null);
  const refusalText = (r: CameraAddRefusal) =>
    r === "over-limit" ? t.refusedOverLimit
      : r === "duplicate-code" ? t.refusedDuplicateCode
      : t.refusedDuplicateStream;
  const createCamera = (values: CameraFormValues, keepOpen = false) => {
    // Refused here as well as disabled above: the button is the UI, this is the rule.
    if (cannotAddSource) return;
    const refusal = addCamera({
      projectId, kind: values.kind, name: values.name.trim(), code: generateCameraCode(values.name.trim(), cameras.map(c => c.code)), rtspUrl: values.rtspUrl.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, model: values.model.trim() || undefined,
      username: values.username.trim() || undefined, serverId: values.serverId || undefined,
      // Offline, not a claim. Portal has not reached this address and will not until camera
      // polling lands — the same starting state the setup wizard's first camera gets.
      // NO THUMBNAIL. It used to be stamped with DEFAULT_THUMBNAIL — a stock photo of an office
      // corridor — and the cards then label it 최근 프레임. Portal has never reached the camera at
      // this point (the row is written `status: "offline"` on the very same line), so an installer
      // sees a picture under "last frame" and reads it as the cabling working.
      ip: values.ip.trim(), mac: "", status: "offline",
      // Blank means not surveyed, not the equator. See Camera.lat.
      ...(values.lat.trim() === "" || values.lng.trim() === ""
        ? { lat: undefined, lng: undefined }
        : { lat: Number(values.lat), lng: Number(values.lng) }),
    });
    /* A REFUSAL KEEPS THE FORM OPEN AND SAYS WHY. It used to close on a success toast whatever
       happened, which is the failure mode that matters: the register is short one camera and
       nothing on screen disagrees with the person who thinks they just added it. */
    if (refusal) { setAddRefusal(refusal); return; }
    setAddRefusal(null);
    if (keepOpen) setAddedInSitting(n => n + 1);
    else setShowAdd(false);
    showToast({ variant: "success", title: t.toastCameraAddedTitle, desc: t.toastCameraAddedDesc(values.name.trim()) });
  };

  const saveEdit = (values: CameraFormValues) => {
    if (!editingCamera) return;
    updateCamera(editingCamera.id, {
      kind: values.kind,
      name: values.name.trim(), rtspUrl: values.rtspUrl.trim(), ip: values.ip.trim(),
      location: values.location.trim(), zone: values.zone.trim() || values.location.trim(),
      maker: values.maker, model: values.model.trim() || undefined,
      username: values.username.trim() || undefined, serverId: values.serverId || undefined,
      // Blank means not surveyed, not the equator. See Camera.lat.
      ...(values.lat.trim() === "" || values.lng.trim() === ""
        ? { lat: undefined, lng: undefined }
        : { lat: Number(values.lat), lng: Number(values.lng) }),
    });
    setEditingCamera(null);
    showToast({ variant: "success", title: t.toastCameraUpdatedTitle, desc: values.name.trim() });
  };

  /**
   * Marking a camera offline is a human report. There is no "mark it back online".
   *
   * This was a two-way toggle. Its other direction was called "Reconnect", wrote `online` onto the
   * record and toasted "Reconnected" — a past-tense claim about a device this console had never
   * spoken to. Nothing in a browser can revive an RTSP stream, so the click's only real effect was
   * to make a dark camera look live: the Overview's offline count dropped, the "needs attention"
   * banner item disappeared and the red offline mark in the breadcrumb cleared, for everyone
   * watching, on the strength of nobody having checked anything. The confirm dialog tried to soften
   * it with "this attempts to reconnect", which was untrue the same way — nothing was attempted
   * either; there was no request, no RTSP handshake and nothing waiting for an answer.
   *
   * CameraStreamModal deleted its copy of this button for exactly these reasons, and its comment
   * says "the page-level one went for the same reason". It had not gone. This is that removal.
   *
   * What survives is the half a person can honestly witness: somebody stood in front of a monitor,
   * saw the feed was dark, and said so. That is a report about what a human saw, not a command to a
   * device, so the action is named for what it does to the RECORD and the toast says "Marked
   * offline" rather than "Disconnected" — this console does not disconnect anything either.
   *
   * The way back is an undo of that report, not a recovery of the camera, and it is offered only
   * for marks made in this session (`manualOfflineMarks`): only the person who made a mark can know
   * it was the wrong row. An offline flag from anywhere else is not this screen's to clear — it has
   * no way to find out whether that camera came back, and writing `online` on a hunch is precisely
   * the false success the Reconnect button was. The undo restores the value the record held before
   * the mark rather than assuming `online`, so it can never invent a state the record never had.
   *
   * HANDOFF NOTE: a real reconnect control needs a camera API that can ask a device to come back —
   * POST /api/portal/cameras/{id}/reconnect, answering with the outcome of the attempt (reached /
   * refused / timed out) and not with an ack, and the status in the store written from that answer
   * rather than from the click. It is the same shape as the connectivity poll in the HANDOFF note
   * further down and wants the same decision: whichever of the two lands is what makes "online" a
   * fact instead of a wish. Until one of them exists, the button cannot honestly exist either.
   */
  // Cameras a person marked offline during this visit, against the status the record carried
  // before the mark. Session-scoped on purpose — see above.
  const [manualOfflineMarks, setManualOfflineMarks] = useState<Record<string, CameraStatus>>({});

  const markCameraOffline = (cam: Camera) => {
    setManualOfflineMarks(prev => ({ ...prev, [cam.id]: cam.status }));
    setCameraStatus(cam.id, "offline");
    showToast({ variant: "default", title: t.toastMarkedOfflineTitle, desc: cam.name });
  };

  const undoOfflineMark = (cam: Camera) => {
    const previous = manualOfflineMarks[cam.id];
    if (previous === undefined) return;
    setManualOfflineMarks(prev => { const next = { ...prev }; delete next[cam.id]; return next; });
    setCameraStatus(cam.id, previous);
    showToast({ variant: "default", title: t.toastOfflineMarkUndoneTitle, desc: cam.name });
  };

  /**
   * The row menu's status item: one entry, or none at all.
   *
   * Offered only against a record that currently claims the camera is live, because that is the
   * only claim a person watching a monitor can contradict. An "error" row already says the camera
   * refused the connection and an "awaiting first contact" row has never claimed anything, so
   * there is nothing there for a human report to correct — and the old toggle, whose result was
   * unconditionally `online`, turned both of those into "Online" on one click: a four-state column
   * driven by a two-state switch.
   */
  const statusMenuActions = (cam: Camera): RowAction[] => {
    if (cam.status === "online") {
      return [{ label: t.markOffline, onClick: () => setConfirmingStatusCam(cam), disabled: !mayEdit, reason: readOnlyReason }];
    }
    if (manualOfflineMarks[cam.id] !== undefined) {
      return [{ label: t.undoOfflineMark, onClick: () => undoOfflineMark(cam), disabled: !mayEdit, reason: readOnlyReason }];
    }
    return [];
  };

  // Confirmed, like the bulk delete beside it. One route to an irreversible action should not
  // be safer than another route to the same action — ticking a row and pressing Delete asked
  // you to confirm, and the row's own ⋯ → Remove did it on the first click.
  const [confirmingDeleteCam, setConfirmingDeleteCam] = useState<Camera | null>(null);
  const handleDelete = (cam: Camera) => setConfirmingDeleteCam(cam);
  const confirmDeleteCam = () => {
    if (!confirmingDeleteCam) return;
    const name = confirmingDeleteCam.name;
    removeCamera(confirmingDeleteCam.id);
    setConfirmingDeleteCam(null);
    showToast({ variant: "warning", title: t.toastCameraRemovedTitle, desc: name });
  };

  /**
   * Asks for a reconnect. Does not claim one happened.
   *
   * This used to write `online` onto every offline camera and say "8 cameras reconnected" — with no
   * RTSP attempt, no server call and nothing checking the result. The screen went 51 → 59 online,
   * the Overview's "things to do" line about offline cameras disappeared, and all eight were still
   * down. A button that reports a success it did not verify is worse than no button.
   *
   * So it reports the request and leaves the status alone. Whether a camera came back is the
   * camera's answer, and the backend that polls it is confirmed as planned — when it lands, this
   * gets a call and the copy already tells the truth.
   */
  // No Refresh button here. It said "Reconnect All" first — a command Portal cannot give — and
  // then "Refresh", which is a thing this page could do but not yet a thing it does: nothing is
  // fetched, so it toasted and stopped. A control worth having comes with a last-updated time
  // beside it ("Updated 12s ago ↻"), and which form it takes depends on how the camera API
  // delivers status: a server that pushes leaves nothing for a button to do, a client that polls
  // wants both halves. Decided with the backend, built then.

  // Reads only what the browser can tell us without decoding the file: its name, size and whether
  // it is video or image. Duration and resolution come from the server once it has opened the file
  // — guessing them here would put numbers on screen that nothing measured.
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(f => f.type.startsWith("video/") || f.type.startsWith("image/"));
    accepted.forEach(f => {
      const id = addUpload({
        projectId,
        fileName: f.name,
        kind: uploadPurpose === "deepfake" ? "deepfake" : f.type.startsWith("image/") ? "image" : "video",
        sizeBytes: f.size,
        uploadedBy: SIGNED_IN_USER.name,
      });
      /* The browser already has this file, so the preview can play it for real rather than
         explaining why it cannot — see lib/uploadBlobs for why the URL is not store state. */
      rememberUploadFile(id, f);
    });
    if (accepted.length === 0) return;
    // Land on the tab the files went to, not on ALL: the person just asked a question about these
    // files and the answer is on that list.
    setKindTab(uploadPurpose === "deepfake" ? "deepfake" : "ALL");
    setUploadPurpose(null);
    showToast({ variant: "success", title: t.toastUploadedTitle, desc: accepted.map(f => f.name).join(", ") });
  };

  /**
   * NO "checked N minutes ago" LABEL, and that is the point rather than an omission.
   *
   * There was one, and it was false. `lastPolledAt` was the moment the page mounted and the
   * refresh button's entire body was `setLastPolledAt(Date.now())` — so the words counted time
   * since a fetch that never happened, over figures that came from the store and did not move.
   * Leave a page open for ten minutes and the numbers stood still while the label walked to
   * "10 minutes ago", which reads as "these were checked then" and was not true of anything.
   *
   * A wrong fact is worse than a missing one: a reader who is told nothing goes and looks, and a
   * reader who is told "just now" stops asking.
   *
   * The refresh button went with it. Its whole body was that one setState, so pressing it moved
   * the label and nothing else — a control that mimes its own action. This product puts screens in
   * front of the backend to say what it needs, but a button wired to nothing is not a
   * specification, it is furniture; the note below is the specification.
   *
   * HANDOFF NOTE: pressing refresh is where the fetch goes —
   * GET /api/portal/projects/{id}/camera-connectivity, answer into the store. Portal polls rather
   * than subscribing: decided by the backend on 2026-09-09 (reply D1), because the module
   * publishes status over MQTT and the server keeps the latest value loaded, so a poll is always
   * the current answer and costs almost nothing. Bring the staleness label back with the fetch —
   * once a real request stamps the clock, "checked N minutes ago" measures something, and a
   * refresh button without it is a button pressed on a hunch.
   */

  const [showImport, setShowImport] = useState(false);
  /* Table or map, on the tabs that hold cameras. The map is a view of the SAME filtered rows —
     see CameraMapView for why that is what makes this a legitimate toggle and the deleted grid
     not one. */
  const [view, setView] = useState<"table" | "map">("table");

  const exportCsv = () => {
    const header = [t.csvHeaderName, t.csvHeaderCode, t.csvHeaderKind, t.csvHeaderZone, t.csvHeaderLocation, t.csvHeaderRtspUrl, t.csvHeaderStatus];
    const rows = projectCameras.map(c => [
      // Three states, not two. A camera refusing the connection is not "a worse offline" —
      // the store's own note says so — and exporting it as Offline hands an auditor a file
      // that disagrees with the screen it came from.
      c.name, c.code,
      // Absent reads as the ordinary kind, the same way the table's column reads it.
      c.kind === "ai" ? t.kindAi : t.kindNormal,
      c.zone, c.location, c.rtspUrl,
      c.status === "online" ? t.online : c.status === "error" ? t.statusError : isAwaitingFirstContact(c) ? t.statusAwaiting : t.offline,
    ]);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "project"}-cameras.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ variant: "success", title: t.toastExportTitle, desc: t.toastExportDesc(projectCameras.length) });
    // Written down because a list leaving the console is the part an audit asks about, and until
    // now nothing here knew it had happened. Not a gate — see ListExportRecord.
    recordListExport({ projectId, list: "cameras", rowCount: projectCameras.length });
  };

  return (
    <div>
      {/* Spacer holds the scroll height the fixed header vacates once stuck — sized to the
          header's own measured height, so this tab's top spacing matches every other tab exactly
          (unlike the earlier CSS sticky attempt, which reserved a taller padded box). */}
      {stuck && <div style={{ height: stickyHeight }} />}
      <div ref={stickyRef} style={stuck && rect ? {
        position: "fixed", top: rect.top, zIndex: 20,
        // Wider than the content by EDGE_BLEED on each side, and padded back in by the same amount
        // (box-sizing is border-box), so the children still start and end where they do unstuck.
        //
        // That overhang is the fix for a shadow that appeared at both ends of this header the
        // moment the page scrolled: the rows card underneath carries PANEL_SHADOW, whose 6px blur
        // spreads a little outside its own box, and a cover exactly the card's width covered the
        // card but not its bleed — so the scrolled-away card's shadow was still visible as a soft
        // vertical smudge down the left and right edges of the stuck block. The overhang lands in
        // the shell's gutter, which is this same grey, so nothing else changes.
        left: rect.left - EDGE_BLEED, width: rect.width + EDGE_BLEED * 2,
        paddingLeft: EDGE_BLEED, paddingRight: EDGE_BLEED,
        // No paddingBottom: the block's last child is the table's column-header card, so any
        // padding under it paints a grey strip between that header and the rows scrolling behind,
        // splitting the one card in two and stranding a sliver of a half-scrolled row below it.
        // Ending flush at the card's bottom edge lets rows pass directly under the header.
        // Matches the content area behind it: this block's whole job is to hide the rows passing
        // under it, so it has to be the exact colour of the page it covers. It was white, from when
        // the content column was white — against the primary-50 ground the shell uses now, the page
        // appeared to grow a paler band across the top the moment it scrolled.
        backgroundColor: "var(--primary-50)", paddingTop: rect.padTop,
      } : undefined}>

      {/* Metrics — the same MetricCard the Overview uses, rather than the one bordered box with
          internal rules this used to be. Same job one screen over should not be a different
          component.

          Two, not three. The third counted uploaded files — how many analysed, how many queued —
          and neither figure earned a third of this header. The queue is a dead end today: nothing
          in the app moves an upload past "pending", because analysis is the core's work and has no
          endpoint yet, so the figure was a permanent 0 (or, after an upload, a number that never
          cleared). The totals are on the video / image tabs below anyway, with each file's own
          state in its row. */}
      {/* No metric strip here.
          It carried channel usage and the online/offline split — both of which are cards on the
          Overview, one click up the rail, and neither of which is what this screen is for. The
          tabs below already count what the list holds, the status filter is where an offline count
          is acted on rather than read, and a non-zero offline count raises a line in the Overview's
          "things to do". Two figures repeated from the previous screen were pushing the table they
          describe half a fold down. */}
      {/* Top-level cut of the list, with counts on the tabs. An underlined tab row rather than a
          fourth select in the filter strip below: which kind of source you are looking at is a
          different question from how you are narrowing that kind, and the counts belong where the
          choice is made. Same arrangement the previous product's INPUT screen used. */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", borderBottom: BORDER, marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "20px" }}>
        {([
          { id: "ALL", label: t.kindTabAll, count: projectCameras.length + projectUploads.length },
          { id: "camera", label: t.kindTabCamera, count: projectCameras.length },
          { id: "video", label: t.kindTabVideo, count: projectUploads.filter(u => u.kind === "video").length },
          { id: "image", label: t.kindTabImage, count: projectUploads.filter(u => u.kind === "image").length },
          // Its own tab, not a filter inside Videos: a deepfake submission is a different errand
          // with a different answer, and mixed into the footage list its verdict column would be
          // empty on every other row.
          { id: "deepfake", label: t.kindTabDeepfake, count: projectUploads.filter(u => u.kind === "deepfake").length },
        ] as { id: "ALL" | SourceKind; label: string; count: number }[]).map(tab => {
          const active = kindTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setKindTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}
            >
              {tab.label}
              <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>{tab.count}</span>
            </button>
          );
        })}
      </div>
        {/* THE VIEW SWITCH, at the far end of the tab row rather than down in the toolbar. It
            answers the tabs' kind of question — which shape of this list — and is set once and
            left, while the toolbar below is touched on the way to a particular row.
            Only where the rows are cameras: a video file has no coordinates, so there is nothing
            for a map to draw on the 영상 / 이미지 / 딥페이크 tabs. */}
        {showCameraColumns && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px", padding: "3px", flexShrink: 0 }}>
            {(["table", "map"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} title={v === "map" ? t.openMapWhy : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "4px 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                  backgroundColor: view === v ? "white" : "transparent", boxShadow: view === v ? PANEL_SHADOW : "none",
                  fontSize: "10px", fontWeight: 700, color: view === v ? "var(--gray-900)" : "var(--gray-400)",
                }}>
                {/* Both halves carry a mark or neither would: one icon facing a bare word makes
                    the pill look like a button beside a label rather than two of the same thing. */}
                {v === "table" ? <Table2 size={11} strokeWidth={2.6} /> : <MapPin size={11} strokeWidth={2.6} />}
                {v === "table" ? t.viewTable : t.openMap}
              </button>
            ))}
          </div>
        )}
      </div>

      {/*
        Is the fleet up? — which is the question somebody opens this screen with, and the one the
        list alone takes a scroll to answer.

        It is not the counts the old console put here (TOTAL / NORMAL / AI / INACTIVE, four cards
        directly above tabs that said the same four numbers). Nor is it the gaps it carried until
        2026-09-09: "56 cameras with no server assigned", 56 of 60, is not a fault report, it is a
        description of the deployment, and clicking it filtered away four rows.

        These three figures live nowhere else on the screen. They are in the status filter's list —
        which is a closed dropdown, so the answer to "is anything wrong" cost a click to find, and
        that is exactly why the page read as a bare list. Same numbers, said out loud.

        The cells drive that same filter rather than one of their own, so pressing "8 offline" and
        picking Offline from the dropdown are one state, not two that can disagree.
      */}
      {/* Above the strip, because it changes what the numbers below it mean: at the ceiling the
          fleet count stops being "how many we have" and becomes "how many we may have". A
          disabled button whose tooltip nobody hovers is the same silence as no rule at all. */}
      {(atChannelLimit || channelLimitUnrecorded) && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px",
          padding: "12px 14px", borderRadius: "10px",
          backgroundColor: "var(--warning-100)", border: "1px solid var(--warning-200)",
        }}>
          <span style={{ display: "flex", flexShrink: 0, marginTop: "1px", color: "var(--warning-500)" }}>
            <CircleAlert size={15} strokeWidth={2.2} />
          </span>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--warning-500)", lineHeight: 1.5 }}>
            {channelLimitUnrecorded ? t.noLicenceBanner : zeroChannelLicence ? t.zeroChannelBanner : t.atLimitBanner(channelLimit)}
          </p>
        </div>
      )}
      {(kindTab === "ALL" || kindTab === "camera") && <SummaryStrip cells={[
        ...[
          {
            key: "online" as const, count: onlineCount, label: t.healthConnected, why: t.healthConnectedWhy,
            unit: t.healthOfFleet(projectCameras.length), tone: "neutral" as const,
            icon: <VideoIcon size={14} strokeWidth={2.4} />,
          },
          {
            key: "offline" as const, count: offlineCount, label: t.healthOffline, why: t.healthOfflineWhy,
            unit: undefined, tone: "warning" as const,
            icon: <VideoOff size={14} strokeWidth={2.4} />,
            /* Grey and arrowless, in the slot the Overview's trend uses: this is context for the
               figure, not a second verdict beside it. Hours under a day and days above it, because
               "가장 오래 0일" says nothing the count did not — and a camera dark for eleven hours
               is a different errand from one dark for twelve days. */
            trend: oldestOfflineHours !== null && oldestOfflineHours >= 1
              ? { direction: "flat" as const, text: t.healthOldestOffline(oldestOfflineHours) }
              : undefined,
          },
          {
            key: "error" as const, count: errorCount, label: t.healthError, why: t.healthErrorWhy,
            unit: undefined, tone: "warning" as const,
            icon: <CircleAlert size={14} strokeWidth={2.4} />,
          },
          {
            // Neutral, not warning: nothing is wrong with a camera that was registered this morning.
            key: "awaiting" as const, count: awaitingCount, label: t.healthAwaiting, why: t.healthAwaitingWhy,
            unit: undefined, tone: "neutral" as const,
            icon: <Unplug size={14} strokeWidth={2.4} />,
          },
        ]
          // A cell reading "0 refusing the connection" is a click that returns an empty table. The
          // connected cell stays whatever it says: zero of sixty connected is the loudest thing this
          // strip could ever report.
          .filter(item => item.key === "online" || item.count > 0)
          .map(item => ({
            key: item.key,
            icon: item.icon,
            figure: item.count,
            unit: item.unit,
            trend: "trend" in item ? item.trend : undefined,
            label: item.label,
            // Offline and refusing-the-connection are two words apart and two different callouts —
            // one is an electrician, the other is a password. The underline is where that goes.
            explanation: item.why,
            tone: item.tone,
            active: statusFilter === item.key,
            title: statusFilter === item.key ? t.healthClear : t.healthShowOnly,
            onClick: () => setStatusFilter(statusFilter === item.key ? "ALL" : item.key),
          })),
        /*
         * Neutral, for the reason the VIP tab's re-enrolment cell is neutral: amber on this page
         * means a defect somebody has to go and repair, and this camera may be streaming
         * perfectly. What is missing is a line in the register — an amber card here would have a
         * control room raising a hardware ticket for a device that is fine, and sending an
         * electrician where a surveyor is wanted.
         *
         * Hidden at zero like the fault cells above rather than pinned like the connected one: a
         * strip that permanently carries "0 no coordinates yet" teaches the reader to skip the
         * row. That is not a hypothetical here — a "not on the map" column built on this page
         * once showed nothing but 0 for want of a camera to count, and was deleted for it. The
         * register carries one now (see Camera.lat in the store), so the state is reachable.
         */
        /*
         * THE ONE CARD THAT APPEARS WHEN A NUMBER GETS SMALL, not when it gets big.
         *
         * Every other errand cell here shows up at one or more and hides at zero. Channels run the
         * other way: a site with ninety free channels has nothing to think about, and one with two
         * is about to have a registration refused mid-batch — which became likely the moment
         * 「추가하고 계속」 existed. Owner's call (2026-09-18): show it only when the headroom is
         * small, rather than carrying a "62 / 100" cell that is furniture on every other day.
         *
         * Zero is left to the amber banner above, which says the whole sentence — a cell reading
         * "0 남은 채널" beside it would be the same news twice, and the banner is the one that
         * explains what to do about it.
         */
        ...(channelLimit !== undefined && channelsLeft > 0 && channelsLeft <= CHANNELS_LOW ? [{
          key: "channels",
          /* Not the CircleAlert the refusal cell uses one card away: two amber cards with one
             glyph read as two of the same thing. A gauge is what a capacity running out looks
             like everywhere else. */
          icon: <Gauge size={14} strokeWidth={2.4} />,
          figure: channelsLeft,
          unit: t.healthOfFleet(channelLimit),
          label: t.healthChannelsLeft,
          explanation: t.healthChannelsLeftWhy,
          tone: "warning" as const,
          // No onClick: this is not a filter. There are no "channel" rows to narrow the table to,
          // and a card that looks pressable and does nothing is worse than a card that does not.
        }] : []),
        ...(noServerCount > 0 ? [{
          key: "noServer",
          icon: <ServerOff size={14} strokeWidth={2.4} />,
          figure: noServerCount,
          unit: t.healthOfFleet(projectCameras.length),
          label: t.healthNoServer,
          explanation: t.healthNoServerWhy,
          /* Amber, unlike 좌표 미등록's neutral. A camera missing its survey still records and
             still matches; one missing its server is producing nothing at all, which is a fault
             somebody has to fix today. */
          tone: "warning" as const,
          active: gapFilter === "noServer",
          title: gapFilter === "noServer" ? t.healthClear : t.healthShowOnly,
          onClick: () => setGapFilter(gapFilter === "noServer" ? null : "noServer"),
        }] : []),
        ...(noPositionCount > 0 ? [{
          key: "noPosition",
          icon: <MapPinOff size={14} strokeWidth={2.4} />,
          figure: noPositionCount,
          label: t.healthNoPosition,
          explanation: t.healthNoPositionWhy,
          tone: "neutral" as const,
          active: gapFilter === "noPosition",
          title: gapFilter === "noPosition" ? t.healthClear : t.healthShowOnly,
          onClick: () => setGapFilter(gapFilter === "noPosition" ? null : "noPosition"),
        }] : []),
      ]} />}
      {/* Search & filters */}
      {/* alignItems center, not the default stretch: every control in this row sets its own height
          (CONTROL_HEIGHT), so stretch looked fine until a bare <span> joined them — the selection
          count stretched to the row's 36px and drew its text at the top of that box, sitting a
          third of a line above the Delete button beside it. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: TOOLBAR_GAP }}>
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        <FilterSelect
          value={zoneFilter}
          onChange={setZoneFilter}
          options={[{ value: "ALL", label: t.filterAllZones }, ...zones.map(z => ({ value: z, label: z }))]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
          /* Counts on the options, the way the VIP registry's filters carry theirs. This is where
             the offline figure earns its place — next to the control that acts on it. */
          options={[
            { value: "ALL", label: t.filterAllStatus },
            { value: "online", label: `${t.online} (${onlineCount})` },
            { value: "offline", label: `${t.offline} (${offlineCount})` },
            { value: "awaiting", label: `${t.statusAwaiting} (${awaitingCount})` },
            // Only when there is one to filter to. An option reading "Error (0)" invites a click
            // that returns an empty table.
            ...(errorCount > 0 ? [{ value: "error", label: `${t.statusError} (${errorCount})` }] : []),
          ]}
        />
        <ActiveFilterCount count={activeFilterCount} onClear={clearFilters} label={t.filtersActive(activeFilterCount)} />
        {/*
          The tools, at the right end of the toolbar.

          They were a row of their own above the tabs, which is where they ended up when the page
          title was deleted — and a strip of buttons with nothing to its left reads as chrome that
          happens to be floating there. The toolbar is the anchor: left of it is how you narrow and
          view the list, right of it is what you do to it, which is the arrangement the reference
          uses (search and filters left, Import / Add right) and the one this row already had in
          miniature with its bulk actions.

          `marginLeft: auto` is what actually puts it there, and it was missing — this comment
          described the arrangement while the group sat wherever the filters happened to end
          (measured at 1440px: the purple button's right edge at 1126 against a content edge of
          1408, so it read as floating mid-row). Not `justifyContent: space-between` on the
          toolbar: this row wraps, and on a narrow window space-between spreads whatever lands on
          the last line. An auto margin pushes only this group, and collapses to nothing once the
          row wraps.
        */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "auto" }}>
          {/*
            Secondary actions carry no box.

            They were bordered buttons at 10px, which was the wrong fix for the right complaint:
            the toolbar felt loud, so the type was shrunk — but what draws the eye on a control is
            the border and the fill, not the letters, so the row stayed loud and only got harder to
            read. Take the box away and the action recedes on its own; then the label can be the
            same size as the table it sits above.

            Zapier's table footer is the reference — New record / Import / Export / Download as
            borderless icon-and-text, with the one filled button kept for the action that makes
            something. Hover brings a tint back, so the target is still findable by pointing.
          */}
          {/* Beside Export, and before it: the first thing a new site does is put a list in,
              and the round trip this reads is the one Export writes. Behind the same edit gate
              as adding a camera — this is the same act, three hundred times. */}
          {mayEdit && (
            <button className="portal-btn-quiet" onClick={() => setShowImport(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <FileInput size={14} strokeWidth={2.4} />
              {t.importCsv}
            </button>
          )}
          <button className="portal-btn-quiet" onClick={exportCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 10px", borderRadius: "8px", border: "none", backgroundColor: "transparent", color: "var(--gray-600)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <FileOutput size={14} strokeWidth={2.4} />
              {t.exportCsv}
            </button>
          {/* One primary action for both kinds, because "add a source" is one intention with two
              answers — a menu is what keeps the header from growing a second primary button that
              competes with this one. */}
          <div ref={addMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            {/* Export stays. A read-only account still needs the fleet list as a file — that is
                most of what the role is for. Adding is what goes. */}
            <button className="portal-btn-primary" onClick={() => setAddMenuOpen(o => !o)}
              disabled={!mayEdit || cannotAddSource}
              title={!mayEdit ? readOnlyReason : channelLimitUnrecorded ? t.noLicenceReason : zeroChannelLicence ? t.zeroChannelReason : atChannelLimit ? t.atLimitReason(channelLimit ?? 0) : undefined}
              style={{ display: "flex", alignItems: "center", gap: "6px", height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: (mayEdit && !cannotAddSource) ? "var(--primary-400)" : "var(--gray-200)", color: (mayEdit && !cannotAddSource) ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: (mayEdit && !cannotAddSource) ? "pointer" : "not-allowed" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 2.9V11.1M2.9 7H11.1" stroke="currentColor" strokeWidth="1.22" strokeLinecap="round"/></svg>
              {t.addSource}
            </button>
            {addMenuOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 60,
                backgroundColor: "white", border: BORDER, borderRadius: "10px", boxShadow: "var(--shadow-popover)",
                minWidth: "200px", padding: "4px",
              }}>
                {[
                  { label: t.addCameraOption, onClick: () => setShowAdd(true) },
                  { label: t.uploadFileOption, onClick: () => setUploadPurpose("media") },
                  { label: t.deepfakeFileOption, onClick: () => setUploadPurpose("deepfake") },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setAddMenuOpen(false); item.onClick(); }}
                    onMouseEnter={() => setHoveredAddItem(item.label)}
                    onMouseLeave={() => setHoveredAddItem(null)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: "6px",
                      border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                      backgroundColor: hoveredAddItem === item.label ? "var(--gray-100)" : "transparent",
                      fontSize: "12px", fontWeight: 600, color: "var(--gray-900)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        What you can do with a selection: a bar that appears at the foot of the window.

        These four controls used to be appended to the toolbar, which meant the row reflowed the
        moment you ticked a box — the filters you had just set jumped left, and on a narrow window
        the whole strip wrapped to two lines. Selection is a mode, and a mode gets its own surface:
        the counts on the left say what you are acting on, the actions sit on the right, and
        nothing above moves. Same pattern as the reference's bottom bar.

        A centred pill rather than a full-width band: `position: fixed` is relative to the window,
        and a band across it would run under the rail, which belongs to no page.
      */}
      {visibleSelectedIds.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "24px", zIndex: 40, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{
            pointerEvents: "auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
            backgroundColor: "var(--gray-900)", borderRadius: "12px", padding: "10px 12px 10px 18px",
            boxShadow: "0 12px 32px rgba(24,17,39,0.28)", maxWidth: "calc(100% - 48px)",
          }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "white", flexShrink: 0 }}>
              {t.selectedCount(visibleSelectedIds.length)}
            </span>
            <span style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--gray-700)" }} />
            {/* Selecting rows is still allowed — it is how you count a subset. The two things
                that change them are what a read-only account loses, and the bar says so rather
                than showing two dead buttons. */}
            {mayEdit ? (<>
              <FilterSelect
                fitContent
                value=""
                onChange={zone => { if (zone) bulkMoveToZone(zone); }}
                options={[{ value: "", label: t.bulkMoveToZone }, ...zones.map(z => ({ value: z, label: z }))]}
              />
              {/* GROUPING IS A BULK ACTION, because the selection IS the group. Somebody who
                  wants "the north gate ones" ticks them here and names them, rather than picking
                  the same twelve again inside a permission dialog. See CameraGroup. */}
              <button
                onClick={() => setGroupingSelection(true)}
                style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-900)", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}
              >
                {t.bulkGroup}
              </button>
              <button
                onClick={() => setConfirmingBulkDelete(true)}
                style={{ height: CONTROL_HEIGHT, padding: "0 14px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-400)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
              >
                {t.bulkDelete}
              </button>
            </>) : (
              <span style={{ fontSize: "12px", color: "var(--gray-400)", flexShrink: 0 }}>{readOnlyReason}</span>
            )}
            {/* The way out of the mode, and the reason the bar can be this assertive: nothing here
                is reachable by accident, and one click puts the page back. */}
            <button
              onClick={clearSelection}
              style={{ border: "none", background: "none", padding: "0 8px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", fontFamily: "inherit", flexShrink: 0 }}
            >
              {t.bulkClearSelection}
            </button>
          </div>
        </div>
      )}

      {/* Table's own column header stays fixed with everything above it — only the data rows
          scroll underneath. Rendered here (still inside the fixed/sticky block) as the top half of
          the card; the data rows below are the bottom half, in normal flow, meeting it with no
          border between them so the two halves read as one continuous card. */}
      {view === "table" && (
      <div ref={listRef} style={{ backgroundColor: "white", border: BORDER, borderBottom: "none", borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS, boxShadow: PANEL_SHADOW }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", backgroundColor: "var(--gray-50)", borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}>
            {/* The thumbnail, address and AI-engine columns carry no sortKey — a picture has no
                order, an address sorts by whatever the IP happens to start with, and AI engines is
                a set per camera rather than one value. */}
            {/* No minHeight on the HEADER's box. The row version sets one because a row is tall
                enough to spare it; here it made the heading strip 49px for a 15px checkbox, which
                reads as a heavier band than the rows under it (owner's note: "테이블 헤더 높이가
                이상하게 두꺼워"). The negative margin still widens the target sideways. */}
            <label style={{ display: "flex", alignItems: "center", margin: "0 -6px", padding: "0 6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                aria-label={t.selectAllLabel}
                style={{ accentColor: "var(--gray-900)", cursor: "pointer", width: "15px", height: "15px", margin: 0 }}
              />
            </label>
            {([
              { label: "" },
              /* THE HEADER FOLLOWS WHAT IS UNDER IT. This column holds the row's identity —
                 a camera's name with its code beneath, a file's name with its length and size —
                 and it was headed 카메라 on every tab, including the mixed one where half the
                 rows are files (owner: 이게 카메라 이름인거지?). A file row under a column headed
                 "카메라" makes the reader check whether they are reading the right table.
                 소스 on the mixed tab, because that is the noun this screen is named after; 파일
                 where the rows are only files; 카메라 where they are only cameras. */
              { label: showCameraColumns ? (showKindColumn ? t.colSourceName : t.colCamera) : t.colFileName, key: "name" },
              ...(showKindColumn ? [{ label: t.colSource }] : []),
              ...(showCameraColumns ? [{ label: t.colServer, key: "server" as CameraSortKey }, { label: t.colZone, key: "zone" as CameraSortKey }] : []),
              /* A file has no connection. On the tabs whose rows are all files this cell holds a
                 resolution and nothing else, so that is what the heading says — same correction
                 as the name column beside it. On the mixed tab it stays 연결 정보: there it
                 carries a camera's address and a file's resolution, which is the one thing both
                 kinds answer — how this source is identified. */
              { label: showCameraColumns ? t.colAddress : t.colResolution },
              { label: t.colStatus, key: "status" },
              { label: "" },
            ] as { label: string; key?: CameraSortKey }[]).map((h, i) => (
              <SortableHeader key={i} label={h.label} sortKey={h.key} sort={sort} onToggle={toggleSort} />
            ))}
          </div>
        </div>
      )}
      </div>

      {/* THE MAP TAKES THE LIST'S PLACE, not the screen's. Same rows the table would draw, so
          every filter above still applies — which is the whole argument for a toggle here (see
          CameraMapView). */}
      {view === "map" ? (
        <CameraMapView
          cameras={visibleCameras}
          onInspect={setInspectingCameraId}
          /* The table's own selection, so a group can be assembled half by search and half by
             pointing at the map. The bulk bar above this view counts the same set. */
          selectedIds={selectedIds}
          onToggleSelect={toggleRow}
          /* Straight to the rows that cannot be drawn. Back to the table too: their coordinates
             get filled in from a row, and a map is not where that happens. */
          onShowUnpositioned={() => { setKindTab("camera"); setGapFilter("noPosition"); setView("table"); }}
        />
      ) : visibleRows.length === 0 ? (
        <div style={{
          backgroundColor: "white", boxShadow: PANEL_SHADOW,
          // The bottom half of the card the column headings above opened, so it takes no top
          // border and only the bottom corners — the same edges the rows draw.
          borderLeft: BORDER, borderRight: BORDER, borderBottom: BORDER,
          borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS,
        }}>
          <TableEmpty text={projectCameras.length + projectUploads.length === 0 ? t.emptyNoSources : t.emptyFiltered} />
        </div>
      ) : (
        // No overflow:hidden on the container — it would clip a RowActionsMenu dropdown that opens
        // past the bottom edge (the last row's menu becomes invisible, not just cut off).
        // Header/last-row corners are radiused directly instead. Top border/radius omitted — the
        // fixed column-header block above already draws that edge, and the two must read as one card.
        <div style={{ backgroundColor: "white", borderLeft: BORDER, borderRight: BORDER, borderBottom: BORDER, boxShadow: PANEL_SHADOW }}>
          {pageRows.map((row, i) => {
            const isLast = i === pageRows.length - 1;
            const rowStyle: React.CSSProperties = {
              display: "grid", gridTemplateColumns: GRID, columnGap: TABLE_COLUMN_GAP, padding: "10px 16px", alignItems: "center",
              borderBottom: isLast ? "none" : BORDER,
              borderBottomLeftRadius: isLast ? CARD_RADIUS : undefined, borderBottomRightRadius: isLast ? CARD_RADIUS : undefined,
            };
            /**
             * The whole row opens the camera, and lights up under the pointer.
             *
             * Three separate things in the row already opened it — the thumbnail, the name, the
             * menu's Preview — while the eighty per cent of the row between them did nothing, and
             * nothing about the row said it could be clicked at all. A table whose rows lead
             * somewhere should say so before it is clicked.
             *
             * The controls inside stop the event: a checkbox is a selection, not a visit, and the
             * ⋯ menu opening the camera behind its own dropdown would be absurd.
             */
            /* BOTH KINDS OF ROW OPEN, because both have somewhere to go. A file row used to be
               the one row in the table that did not react to a pointer at all (owner: 어쨌든 쟤만
               호버가 안 되는 게 너무 어색해), which read as a row that had failed to load rather
               than one with nothing behind it. It does have something behind it: the recording. */
            const openRow = () => row.kind === "camera"
              ? setInspectingCameraId(row.camera.id)
              : setInspectingUploadId(row.upload.id);
            const rowInteraction = {
              className: "portal-attention-row",
              role: "button",
              tabIndex: 0,
              style: { ...rowStyle, cursor: "pointer" },
              onClick: openRow,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(); }
              },
            };
            const stopRowClick = { onClick: (e: React.MouseEvent) => e.stopPropagation() };
            // The whole cell is the target, not the 13px box — same fix the VIP registry got
            // (2026-09-18). The label makes the padding clickable without a handler of its own,
            // and stopRowClick stays on it so ticking a row does not also open the row.
            const checkbox = (
              <label
                {...stopRowClick}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-start",
                  height: "100%", minHeight: "32px", margin: "0 -6px", padding: "0 6px", cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                  aria-label={row.name}
                  style={{ accentColor: "var(--gray-900)", cursor: "pointer", width: "15px", height: "15px", margin: 0 }}
                />
              </label>
            );

            if (row.kind !== "camera") {
              const u = row.upload;
              const tone = UPLOAD_STATUS_TONE[u.status];
              // Only once the check has finished — a queued submission has no verdict and keeps the
              // ordinary pipeline word.
              const verdict = u.status === "done" ? u.deepfakeVerdict : undefined;
              // Red for the one answer that is news. Authentic is the expected result and
              // inconclusive is the absence of a result; colouring either would make three
              // verdicts read as three alarms.
              const verdictDot = verdict === "manipulated" ? "var(--danger-400)"
                : verdict === "authentic" ? "var(--gray-900)" : "var(--gray-300)";
              return (
                <div key={row.id} {...rowInteraction}>
                  {checkbox}
                  {/* A file has no live thumbnail to show, so the tile carries its kind instead of
                      a frame we do not have. Inventing a poster image would imply the analysis had
                      already looked at it. */}
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "8px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)" }}>
                    {u.kind === "image" ? <ImageIcon size={18} strokeWidth={1.87} />
                      : u.kind === "deepfake" ? <ShieldCheck size={18} strokeWidth={1.87} />
                      : <FilmIcon size={18} strokeWidth={1.87} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fileName}</p>
                    <p style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                      {[formatDuration(u.durationSec), formatBytes(u.sizeBytes)].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {showKindColumn && (
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gray-600)" }}>
                    {u.kind === "image" ? <ImageIcon size={13} strokeWidth={2.58} />
                      : u.kind === "deepfake" ? <ShieldCheck size={13} strokeWidth={2.58} />
                      : <FilmIcon size={13} strokeWidth={2.58} />}
                    {u.kind === "image" ? t.sourceImage : u.kind === "deepfake" ? t.sourceDeepfake : t.sourceVideo}
                  </span>
                  )}
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-300)" }}>—</span>}
                  <span style={{ fontSize: "10px", color: "var(--gray-600)", fontFamily: "monospace" }}>{u.resolution ?? "—"}</span>
                  {/* THE ANALYSIS STATE IS THIS ROW'S 상태, not an extra column after it. It used
                      to print an em dash under 상태 and put the real answer in the next cell —
                      which is the camera rows' actions column, so every file row's ⋯ ended up one
                      track further right than every camera row's. A file has a status; it is just
                      not a connection. */}
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: verdict ? verdictDot : tone.dot, flexShrink: 0 }} />
                    {/* A finished deepfake row says the verdict here instead of "Analysed". The
                        pipeline word is only news while the answer is missing; once it is there,
                        printing both makes the reader step over "Analysed" to reach it. */}
                    {!verdict && <span style={{ fontSize: "12px", fontWeight: 700, color: tone.text }}>{t[tone.label]}</span>}
                    {u.status === "done" && u.kind !== "deepfake" && u.detectionCount !== undefined && (
                      <span style={{ fontSize: "10px", color: "var(--gray-400)" }}>{t.detectionsFound(u.detectionCount)}</span>
                    )}
                    {/* A deepfake row's result is a judgement, not a count — and the score travels
                        with it, because "manipulated" at 41% and at 94% are the same word and very
                        different news. Only "manipulated" is coloured: authentic is the expected
                        answer and inconclusive is an absence of one, and painting either would
                        make three verdicts look like three alarms. */}
                    {verdict && (
                      <>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: verdict === "manipulated" ? "var(--danger-400)" : "var(--gray-900)" }}>
                          {verdict === "manipulated" ? t.verdictManipulated
                            : verdict === "authentic" ? t.verdictAuthentic
                            : t.verdictInconclusive}
                        </span>
                        {u.deepfakeScore !== undefined && (
                          <span style={{ fontSize: "10px", color: "var(--gray-400)", whiteSpace: "nowrap" }}>{t.verdictScore(u.deepfakeScore)}</span>
                        )}
                      </>
                    )}
                  </span>
                  {/* In its own span, the way the camera row wraps its menu, so both rows end
                      with one cell and the two ⋯ columns line up. */}
                  {/* In its own span, the way the camera row wraps its menu, so both rows end
                      with one cell and the two ⋯ columns line up. stopRowClick for the same
                      reason the camera row uses it: opening the preview behind its own dropdown
                      would be absurd. */}
                  <span {...stopRowClick}>
                    <RowActionsMenu actions={[
                      // Named first, like the camera row's Preview: the thumbnail-sized tile is
                      // not a control anyone is told about, and a row that opens should say so.
                      { label: t.previewUploadAction, onClick: () => setInspectingUploadId(u.id) },
                      { label: t.removeUploadAction, onClick: () => { forgetUploadFile(u.id); removeUpload(u.id); showToast({ variant: "warning", title: t.toastUploadRemovedTitle, desc: u.fileName }); }, danger: true, disabled: !mayEdit, reason: readOnlyReason },
                    ]} />
                  </span>
                </div>
              );
            }

            const cam = row.camera;
            const awaiting = isAwaitingFirstContact(cam);
            const statusLabel = cam.status === "online" ? t.online
              : cam.status === "error" ? t.statusError
              : awaiting ? t.statusAwaiting
              : t.offline;
            // Four states, and only two of them coloured — the reasoning is on the cell below.
            const statusText = cam.status === "error" ? "var(--danger-400)"
              : cam.status === "offline" && !awaiting ? "var(--warning-500)"
              : "var(--gray-500)";
            const statusWeight = statusText === "var(--gray-500)" ? 600 : 700;
            const statusDot = cam.status === "online" ? "var(--success-400)"
              : cam.status === "error" ? "var(--danger-400)"
              : awaiting ? "var(--gray-300)"
              : "var(--warning-400)";
            return (
              <div key={row.id} {...rowInteraction}>
                {checkbox}
                {/* 48px, the same tile the registry's face column uses: two tables one click
                    apart whose rows are 61px and 69px read as two different tables, and the
                    height follows the picture (owner's note: "vip 화면 테이블 높이로 맞춰줘"). */}
                <button {...stopRowClick} onClick={() => setInspectingCameraId(cam.id)} style={{ width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--gray-100)", border: "none", cursor: "pointer", padding: 0 }}>
                  {cam.thumbnail
                    ? <img src={cam.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", backgroundColor: "var(--gray-100)" }} />}
                </button>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.name}</p>
                  <p style={{ fontSize: "10px", color: "var(--gray-400)", fontFamily: "monospace" }}>{cam.code}</p>
                </div>
                {showKindColumn && (
                /* Which kind, not just "camera". An AI camera is a different device with a
                   different server behind it (see CameraKind), and the column that names the row's
                   kind is where that belongs. A row registered before the field existed reads as
                   the ordinary kind rather than as a blank. */
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gray-600)" }}>
                  {cam.kind === "ai" ? <Cpu size={13} strokeWidth={2.58} /> : <VideoIcon size={13} strokeWidth={2.58} />}
                  {cam.kind === "ai" ? t.kindAi : t.sourceCamera}
                </span>
                )}
                {/* The server, where the maker used to be. A make is settled at purchase and is
                    not what anybody scans a list for; the server is the answer to "why is this one
                    doing nothing", and until now it appeared on no screen at all — not in this
                    table and not on the camera's own sheet, where it now sits with the maker. */}
                {showCameraColumns && (
                  /* AN EM DASH SAYS "NOTHING HERE"; THIS SAYS WHAT IS MISSING AND HOW TO FIX IT.
                     The blank was the only way to find a camera nobody is pulling — while the
                     status column said 연결됨 about the same row. Four products name the gap in
                     the cell instead (YNAB "This needs a category", Pin "Missing email", Rox
                     "Enrichment failed"), and Hotjar puts the repair link directly under it
                     ("Install tracking code"), which is the half that turns a warning into a
                     next step. Same shape here. */
                  cam.serverId
                    ? (
                      <span style={{ fontSize: "12px", color: "var(--gray-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {projectServers.find(sv => sv.id === cam.serverId)?.name ?? "—"}
                      </span>
                    )
                    : (
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px", minWidth: 0 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0,
                          height: "18px", padding: "0 8px", borderRadius: "999px",
                          backgroundColor: "var(--warning-100)", color: "var(--warning-500)",
                          fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap",
                        }}>
                          <ServerOff size={11} strokeWidth={2.6} />
                          {t.healthNoServer}
                        </span>
                        {/* The repair, where the problem is. stopRowClick because the row itself
                            opens the preview, and this is not that. Behind the edit gate: a
                            read-only account can see the gap and cannot close it. */}
                        {mayEdit && (
                          <button {...stopRowClick} onClick={() => setEditingCamera(cam)}
                            style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "10px", fontWeight: 700, color: "var(--primary-400)", textDecoration: "underline" }}>
                            {t.assignServerAction}
                          </button>
                        )}
                      </span>
                    )
                )}
                {showCameraColumns && <span style={{ fontSize: "12px", color: "var(--gray-600)" }}>{cam.zone}</span>}
                {/* The IP, not the RTSP URL — and resolution under it, in the same column a file
                    fills with its resolution alone. (Two separate columns left one of them blank on
                    every row of the other kind.)

                    It printed the full stream address until 2026-09-09, which is forty characters
                    of scheme, host, port and path in a cell narrow enough to cut it after about
                    twenty-five: every row ended in an ellipsis and no two rows differed anywhere
                    you could see. The address that identifies a camera at a glance is the host, so
                    that is what is printed. The full URL is still searchable and still on the
                    camera's own sheet, where there is room to read it. */}
                {/* 11px monospace, not 10. These are the only cells on the page read a character
                    at a time — an address is checked digit by digit against a switch or a label on
                    a wall — and they were the smallest text in the table. Monospace runs narrow, so
                    11 here sits at about the width of the 12px column beside it. */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "11px", color: "var(--gray-500)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cam.ip}</p>
                  <p style={{ fontSize: "11px", color: "var(--gray-600)", fontFamily: "monospace" }}>{cam.resolution ?? "—"}</p>
                </div>
                {/* A chip that is read, not a control that is pressed.
                    This cell was a <button> styled `background: none; border: none; padding: 0` —
                    indistinguishable from the plain text in the cells either side of it, and yet a
                    click on it changed a status everyone monitoring the project can see. Nothing
                    announced it as pressable, so the only way to find out was to hit it by
                    accident, and what it wrote was unconditionally `online` even on the rows that
                    were not merely offline. What a person may still do to a status lives in that
                    row's ⋯ menu now, beside Edit and Remove, under a label that names it.

                    Grey for online, and that is the correction rather than a loss of signal. Online
                    rendered as success-400 at weight 700 across 51 of 59 rows: a green that covers
                    a table is not a signal, it is the table's background — the same conclusion the
                    deepfake verdicts above reached ("colouring either would make three verdicts
                    read as three alarms") and the one ProjectVipTab reached about an amber pill on
                    119 of 123 rows. It also left the eight rows worth finding as the faintest thing
                    on screen, at gray-400. So the expected state is quiet and the exceptions carry
                    the colour: amber for a camera that stopped answering, red for one refusing the
                    connection — still the sharper of the two, because a refusal is something typed
                    wrong that somebody can fix from this screen. A camera that has never reported
                    stays grey: that is not a fault, it is where every camera sits between being
                    added and its first report (see isAwaitingFirstContact).

                    The dot keeps its colour on all four, because the dot is what an eye runs down a
                    column on and 6px of green is a mark rather than a wash. */}
                {/* WHAT WE CAN HONESTLY SAY ABOUT WHY (owner's ask: 연결 상태에 따라 사유도
                    알 수 있으면 적어주면 좋겠어). The cause of a refusal — wrong credentials, a
                    stream path that moved — is the server's to report and nothing in the browser
                    knows it; inventing one would be worse than silence, and the class of cause is
                    already under the summary cell's dotted label. What the register DOES know is
                    when the camera last answered, and that is the half of "why" that separates a
                    network blip from a camera somebody unplugged a fortnight ago. A row that has
                    never answered says so instead — see isAwaitingFirstContact.
                    Post-mount only (nowMs): an elapsed figure rendered during the server pass and
                    again in the browser is a hydration mismatch. */}
                <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, backgroundColor: statusDot }} />
                    <span style={{ fontSize: "12px", fontWeight: statusWeight, color: statusText }}>{statusLabel}</span>
                  </span>
                  {awaiting ? (
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", paddingLeft: "12px" }}>{t.neverAnswered}</span>
                  ) : nowMs !== null && cam.lastSeenAt ? (
                    <span style={{ fontSize: "10px", color: "var(--gray-400)", paddingLeft: "12px", whiteSpace: "nowrap" }}>
                      {t.lastAnswered(formatElapsed(nowMs - Date.parse(cam.lastSeenAt), lang))}
                    </span>
                  ) : null}
                </span>
                {/* Preview first: it is the item somebody reaches for most and the only one that
                    answers "is this camera actually seeing anything". The thumbnail opens the same
                    modal, but a thumbnail is not a control anyone is told about — a named item in
                    the menu is. */}
                <span {...stopRowClick}>
                {/* Preview stays open to everybody — looking at a camera is the auditor's job.
                    Only the items that change something take the gate. */}
                <RowActionsMenu actions={[
                  { label: t.previewAction, onClick: () => setInspectingCameraId(cam.id) },
                  { label: t.editAction, onClick: () => setEditingCamera(cam), disabled: !mayEdit, reason: readOnlyReason },
                  ...statusMenuActions(cam),
                  { label: t.removeAction, onClick: () => handleDelete(cam), danger: true, disabled: !mayEdit, reason: readOnlyReason },
                ]} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Same drop-zone shape Redmap's image upload already uses — dashed border on a gray-50 field
          with a Choose button — so the two upload surfaces in the product are one pattern. Accepts
          video as well as image, which is the only real difference. */}
      {uploadPurpose && (
        <Drawer title={uploadPurpose === "deepfake" ? t.deepfakeUploadTitle : t.uploadTitle}
          onClose={() => setUploadPurpose(null)} width="520px">
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); acceptFiles(e.dataTransfer.files); }}
              style={{
                borderRadius: "12px", border: `1px dashed ${dragging ? "var(--gray-900)" : "var(--gray-300)"}`,
                backgroundColor: dragging ? "var(--gray-100)" : "var(--gray-50)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "12px", padding: "32px 24px", textAlign: "center",
              }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "var(--gray-100)", color: "var(--gray-500)" }}>
                <FilmIcon size={22} strokeWidth={1.53} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>{t.uploadDrop}</span>
                <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.5 }}>{uploadPurpose === "deepfake" ? t.deepfakeUploadHint : t.uploadHint}</span>
              </div>
              <button className="portal-btn-primary" onClick={() => uploadInputRef.current?.click()}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "var(--gray-900)", color: "white", fontSize: "13px", fontWeight: 700 }}>
                {t.uploadChoose}
              </button>
              <input ref={uploadInputRef} type="file" multiple accept="video/*,image/*"
                onChange={e => { acceptFiles(e.target.files); e.target.value = ""; }}
                style={{ display: "none" }} />
            </div>
            {/* No "the analysis is not connected yet" line here any more (2026-09-09). It was a
                sentence about the state of the build, printed inside the product — and the row's
                own status already says "Queued", which is both true now and still true once the
                endpoint lands and a real job waits its turn. The note would have had to be
                deleted on the day the backend arrived; the status will not. The dependency is
                recorded where it belongs, in the HANDOFF note on addUpload in vcaStore. */}
          </div>
        </Drawer>
      )}


      {/* Under the list, like the VIP registry's — and outside the sticky block, which is only
          the tabs, the toolbar and the column headings. */}
      {view === "table" && <TablePagination
        total={visibleRows.length}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        onPage={setPage}
        onRowsPerPage={setRowsPerPage}
        perPageOptions={perPageOptions}
      />}

      {showAdd && (
        <CameraFormModal
          title={t.addModalTitle}
          initial={EMPTY_FORM}
          isEdit={false}
          servers={cameraCapableServers}
          onClose={() => { setShowAdd(false); setAddedInSitting(0); setAddRefusal(null); }}
          submitRefusal={addRefusal === null ? null : refusalText(addRefusal)}
          onTouched={() => setAddRefusal(null)}
          onSubmit={createCamera}
          onSubmitAndAnother={values => createCamera(values, true)}
          addedInSitting={addedInSitting}
          atLimit={cannotAddSource}
          t={t}
        />
      )}
      {editingCamera && (
        <CameraFormModal
          title={t.editModalTitle}
          isEdit
          initial={{
            // Absent on a row registered before the field existed — read as the ordinary kind,
            // which is also what the column says about it. See CameraKind.
            kind: editingCamera.kind ?? "normal",
            name: editingCamera.name, ip: editingCamera.ip, rtspUrl: editingCamera.rtspUrl,
            location: editingCamera.location, zone: editingCamera.zone,
            maker: editingCamera.maker ?? MAKERS[0], model: editingCamera.model ?? "",

            username: editingCamera.username ?? "",
            // Always blank. The store has no password to put here, which is the point.
            password: "",
            serverId: editingCamera.serverId ?? "",
            lat: String(editingCamera.lat ?? ""), lng: String(editingCamera.lng ?? ""),

          }}
          servers={cameraCapableServers}
          onClose={() => setEditingCamera(null)}
          onSubmit={saveEdit}
          t={t}
        />
      )}
      {inspectingCameraId && cameras.find(c => c.id === inspectingCameraId) && (
        <CameraStreamModal camera={cameras.find(c => c.id === inspectingCameraId) as Camera} onClose={() => setInspectingCameraId(null)} />
      )}
      {confirmingDeleteCam && (
        <ConfirmModal
          title={t.confirmDeleteCamTitle(confirmingDeleteCam.name)}
          body={t.confirmDeleteCamBody}
          confirmLabel={t.removeAction}
          cancelLabel={t.cancel}
          danger
          onConfirm={confirmDeleteCam}
          onClose={() => setConfirmingDeleteCam(null)}
        />
      )}
      {confirmingStatusCam && (
        <ConfirmStatusModal
          camera={confirmingStatusCam}
          onClose={() => setConfirmingStatusCam(null)}
          onConfirm={() => { markCameraOffline(confirmingStatusCam); setConfirmingStatusCam(null); }}
          t={t}
        />
      )}
      {/* Confirmed, not undoable-with-a-toast: removing cameras in bulk takes a whole set of feeds
          off monitoring at once, and there is no restore. Says what actually happens and what does
          not, because "are you sure?" alone leaves people guessing about the recordings. */}
      {inspectingUploadId && projectUploads.some(u => u.id === inspectingUploadId) && (
        <UploadPreviewModal
          upload={projectUploads.find(u => u.id === inspectingUploadId) as UploadedMedia}
          onClose={() => setInspectingUploadId(null)}
        />
      )}
      {showImport && <CameraImportModal projectId={projectId} onClose={() => setShowImport(false)} />}


      {/* Naming it is the whole dialog: the members are the selection, and the sentence says
          what holding this group will mean for somebody. */}
      {groupingSelection && (
        <ConfirmModal
          title={t.groupModalTitle(selectedIds.size)}
          body={t.groupModalBody}
          confirmLabel={t.groupCreate}
          cancelLabel={t.cancel}
          confirmDisabled={groupName.trim() === ""}
          onConfirm={() => {
            const label = groupName.trim();
            const refusal = addCameraGroup(projectId, label, [...selectedIds]);
            if (refusal === "duplicate-label") { setGroupError(t.groupDuplicate); return; }
            showToast({ variant: "success", title: t.groupCreatedTitle, desc: t.groupCreatedDesc(label, selectedIds.size) });
            setGroupingSelection(false);
            setGroupName("");
            setGroupError(null);
            clearSelection();
          }}
          onClose={() => { setGroupingSelection(false); setGroupName(""); setGroupError(null); }}
        >
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", display: "block", marginBottom: "6px" }}>{t.groupNameLabel}<RequiredMark /></label>
            <TextField value={groupName} onChange={v => { setGroupName(v); setGroupError(null); }} placeholder={t.groupNamePlaceholder} />
            {groupError && <FieldError>{groupError}</FieldError>}
          </div>
        </ConfirmModal>
      )}
      {confirmingBulkDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmingBulkDelete(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "400px", width: "100%", boxShadow: "var(--shadow-modal)", padding: "20px" }}>
            <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.bulkDeleteConfirm(visibleSelectedIds.length)}</p>
            <p style={{ fontSize: "12px", color: "var(--gray-600)", lineHeight: 1.5, marginTop: "8px" }}>{t.bulkDeleteBody}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button className="portal-btn-outline" onClick={() => setConfirmingBulkDelete(false)}
                style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.cancel}
              </button>
              <button onClick={bulkDelete}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "var(--danger-500)", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {t.bulkDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
