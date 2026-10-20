# CLAUDE.md — frontend

Vite + React 19 + TypeScript SPA. 상위 `../CLAUDE.md`의 소유권 경계를 따른다.

## 명령
```bash
npm install          # 최초 1회
npm run msw:init     # 최초 1회 — public/mockServiceWorker.js 생성
npm run gen:api      # OpenAPI(../openapi/openapi.json) → 타입/훅 생성
npm run dev          # 개발 서버 (포트 5173)
npm run build        # 프로덕션 빌드 (tsc + vite build → dist/)
npm run lint         # oxlint
```

## 스택
- 서버 상태: React Query (`@tanstack/react-query`)
- 클라이언트 상태: Zustand
- HTTP: Axios (`src/api/axios-instance.ts` 인스턴스 공유)
- API 훅: orval 자동생성 (`src/api/generated`)
- 목: MSW (`src/mocks`) — `.env.development`의 `VITE_ENABLE_MSW=true`일 때 활성

## 폴더
```
src/
  features/<name>/         # 화면 단위 [기획자]
    <Name>Page.tsx         #   화면 조립 + 데이터 연결 지점
    components/            #   프레젠테이션 (props만)
    api.ts / types.ts      #   (실제로는 generated로 대체)
  components/              # 공유 프레젠테이션 [기획자]
  api/                     # axios 인스턴스 + generated 훅 [백엔드]
  lib/                     # config 등 [백엔드]
  mocks/                   # MSW 핸들러 [기획자→백엔드 다리]
```

## API 호출 규칙
- 모든 호출은 상대경로 `/api/...`. dev는 vite proxy, prod는 nginx가 백엔드로 전달(동일 오리진).
- 프레젠테이션 컴포넌트에서 직접 호출 금지 — 훅으로 받아 props로 내려준다.

## 기획자 화면 코드 반입 (원본 프로젝트 → 이 레포)
기획자는 별도 Next.js 프로젝트에서 화면을 개발한다. 반입 시 원본 코드를 **수정 없이** 가져올 수 있도록 어댑터가 설정되어 있다:
- `@/*` → `src/features/vca/*` (tsconfig paths + vite alias)
- `next/navigation` → `src/features/vca/compat/navigation` (react-router 기반 shim)
- `process.env.NEXT_PUBLIC_*` → vite `define`으로 빌드 타임 치환
- `verbatimModuleSyntax` 미사용 (원본이 type-only import를 구분하지 않음)
- Tailwind v4 (`@tailwindcss/vite`, 기획자 lock과 같은 버전으로 고정 — UV-62). 화면 코드는 Tailwind 클래스를 쓰지 않지만
  `globals.css`의 `@import "tailwindcss"`가 깔아주는 **preflight 리셋을 전제로 디자인**됐다(버튼 배경 투명·글꼴 상속·
  제목/문단 여백 0). 플러그인이 빠지면 그 줄이 조용히 무시되고 브라우저 기본값이 새어 나온다 — 포털 좌측 메뉴의
  안 고른 항목에 버튼 기본 회색 `#EFEFEF`가 깔려 색이 뒤집혀 보였던 원인. 기획자 원본이 Tailwind를 올리면 버전을 맞출 것.

절차: 기획자가 `import/frontend-ui-YYYYMMDD` 브랜치로 push → 태그로 동결 → 직전 태그와의 diff를
경로 매핑(`src/components→features/vca/components`, `src/app/mypage/page.tsx→pages/MyPage.tsx` 등)해서
3-way 적용 → 데이터 연결 주입 지점(ClientLayout·Navbar·Sidebar·DetectionActivityChart·MapView·
BestFramePage의 `vca-bridge` import 부분) 재확인 → tsc + 시뮬레이터 E2E 검증.
BestFramePage의 주입: useBestFrameLive 훅 호출 + 라이브 카메라 목록 동기화 effect + camDataFor()
헬퍼(모든 CAM_DATA 접근이 이 함수를 거침) + 이미지 폴백 3곳(패널 행 아바타 `det.snapshotUrl ?? mock`,
HUD LIVE SNAPSHOT, HUD ENROLLED DB `det.enrolledPhotoUrl` 분기).
BestFramePage v1.3 주입(UV-35): useMediaLive·LiveVideoFeed import + media 훅 호출 +
videoCams/imageCams 동기화 effect 2개 + camDataFor 체인에 media.dataFor 추가 +
CameraCard 피드의 `data.videoUrl ? <LiveVideoFeed> : <img>` 분기. CamData에 optional
videoUrl 필드(types/detection.ts). 비디오 타일 컴포넌트(LiveVideoFeed — 재생+bbox 오버레이)는
vca-bridge 소유의 임시 구현 — 기획자가 정식 타일을 디자인하면 대체.
RedmapPage의 주입(UV-34): searchRedmapPersons import + faceFile/bodyFile/liveTrace state 3개 +
업로드 핸들러 2곳의 setXxxFile + handleSearch 앞부분의 실검색 시도 블록(null이면 mock 폴백) +
handleReset·딥링크 블록의 liveTrace 리셋 + 타임라인 originOffset 게이트 + RedmapMap showOrigin prop.
RedmapMap의 주입: showOrigin?: boolean prop(기본 true) — 실검색 경로에서 mock 시작점 미표시,
originOffset 기반 hitIndex 변환, effect deps에 showOrigin. 마커 effect의 stale 가드(UV-36) —
import("leaflet") 완료 전 결과가 바뀌면 이전 실행 마커가 잔상으로 남는 race 수정(cleanup으로 무효화).
Track on Map 주입(UV-36): BestFramePage — onGoRedmapTrace 시그니처에 optional TrackTargetRef 추가 +
HUD Track on Map 버튼이 대상 참조(sourceType은 videoCams/imageCams 소속으로 판별, sourceId=camId,
targetId=det.id)를 실어 보냄. ClientLayout — redmapTrackTarget state + handleGoRedmapTrace 2번째
인자 + RedmapPage initialTrackTarget prop 전달(consumed 시 함께 클리어). RedmapPage —
trackTargetOnMap import + initialTrackTarget prop + consumedTrackRef 기반 실추적 검색 effect
(mock 딥링크가 먼저 그려지고 응답 도착 시 라이브 결과·유사도 90·당일 날짜로 교체, null이면 mock 유지).
Analyze Frame 주입(UV-37, 계약 v1.5): BestFramePage — analyzeSourceFor() 헬퍼(카메라=지금,
비디오=recordedAt+LiveVideoFeed의 getVideoPlaybackTime, 이미지·메타없음=null) + detailView에
analyzeSource 포함(진입 3곳) + BestFrameDetailPage에 prop 전달. BestFrameDetailPage —
useAnalyzeTimeline 훅 호출 + live 분기(프레임 스트립/메인 이미지·타임스탬프/dets/reelData/
카테고리 레인 lane()/커서 위치/날짜 드롭다운 analyzeDates()/재생 1초·감기 ±1s·±10s tl.step) +
AIInspectionDetail(det.analysis ?? mock ATTRS, snapshotUrl/enrolledPhotoUrl 폴백, eventDate prop,
onGoRedmapTrace에 det 전달→Track on Map 대상 참조) + ReelCard·AlsoCapturedCard 이미지·태그 폴백.
types/detection.ts — Detection에 optional analysis/gender, CamData에 optional recordedAt.
main.tsx — MSW 시작 실패를 비치명으로(catch 후 렌더 — SW 등록이 막히는 임베디드 브라우저 대응).
DATA Live Monitoring 주입(UV-38, 계약 v1.6): DataPage — useLiveMonitoring·TrackTargetRef import +
LiveCardExtras/MonitorItem 타입·trackRefOf() 헬퍼 + MonitorCard p 타입·얼굴 인셋 분기(faceCrop
null=인셋 숨김, string=실크롭, undefined=mock 줌 크롭) + LiveMonitoringTab의 lm 훅 호출·mock
인터벌 lm.live 게이트·feedSrc 분기 + CameraDetailView items 타입·RedMap 버튼 대상 참조 동봉 +
reidToMatchItem face 폴백(faceCrop ?? url) + DetailModal RedMap Trace 래핑 + DataPage onGoRedmap
시그니처 (name?, ref?) + All Cameras 병합 정렬(ms 내림차순 — 카메라별 블록이 아닌 단일 최신순
스트림, mock은 ms 없어 안정 정렬로 기존 순서 유지). ClientLayout — DataPage onGoRedmap: ref
있으면 handleGoRedmapTrace(UV-36 딥링크 재사용), 없으면 기존 플레인 이동.
lib/realtime/types.ts — DetectionEvent에 faceUrl/gender/age.
DATA Re-ID Analysis 주입(UV-39, 계약 v1.7): DataPage — reidAnalysis 브리지 import(searchReid·
useReidRecentTargets·useReidVips·reidTrajectory) + ReIDContent(liveVips/liveRecent 훅,
faceFile/bodyFile state, recentList/vipList/cameraOptions 결정, runSearch — 라이브 우선 mock 폴백,
liveCluster — applied 에코 메타·유사도 내림차순 매치) + SearchFilterState 옵셔널 확장
(faceFile·bodyFile·recentList·vipList·cameraOptions) + SearchPanel(목록 소스 교체, 드롭존 파일
업로드 배선+미리보기, 빈 최근 대상 문구) + VipQuickSelectRow·CameraSelect에 옵션 prop +
DetailModal(라이브 이동 경로 reidTrajectory — targetId 있으면 mock TRAJECTORY 대체, Analyze
Frame 버튼에 capturedMs 동봉) + reidToMatchItem에 targetId/cameraId/capturedMs 통과(Live
Monitoring 팝업도 라이브 경로·시각 딥링크 동작). types/reid.ts — MatchItem 옵셔널 확장.
ClientLayout — bestFrameAnalyzeMs state + handleGoAnalyzeFrame(location, entryMs?) +
BestFramePage analyzeFrameEntryMs prop. BestFramePage — Analyze Frame 딥링크를 렌더 단계
블록에서 effect로 교체(UV-39 버그 수정 2건: prev 초기값=prop이라 첫 마운트 미발화, 라이브
카메라 목록 반영 전 mock 매칭 레이스) + 라이브 카메라 이름 폴백 매칭 + 시딩 전 카메라
플레이스홀더 감지로 진입 보장(autoOpenDetail은 실감지 있을 때만) + prevFocusLocation 초기값
undefined 센티널(동일 잠재 버그).
Re-ID 팝업 RedMap Trace 배선(UV-39 확장): DataPage — matchTrackRefOf() 헬퍼(MatchItem →
TrackTargetRef, targetId=감지 eventId·sourceType camera — 라이브 매치만, mock은 undefined로
플레인 이동) + ReIDContent onGoRedmap 시그니처 (name?, ref?) + DetailModal 호출부 래핑
(detailItem.label || undefined, matchTrackRefOf) — Live Monitoring 팝업(UV-38)과 동일 딥링크.
types/reid.ts — MatchItem에 optional label(matchedVip 이름, Tracing 라벨용).
DATA RedFace 주입(UV-40, 계약 v1.8): DataPage — redfaceAssociates 브리지 import
(fetchRedfaceAssociates·fetchRedfaceEvidence) + RedfaceCandidate/RedfaceNode 옵셔널 확장
(targetId/cameraId/label, associateId/label/topCameraLabel/firstSeen/lastSeen) +
PrimaryTargetPickerModal(후보 검색 = v1.7 reid-search 재사용 — useReidVips/useReidRecentTargets
훅 호출로 Re-ID 탭과 VIP·최근 검색 공유, faceFile/bodyFile state, liveCands state, handleSearch
라이브 우선 mock 폴백, recentList/vipList/cameraOptions 소스 교체, onConfirm에 dateRange 동봉) +
RedFaceContent(primaryTarget에 ref: RedfacePrimaryRef — 라이브 후보·LM 카드에서만, 팝업 기간이
집계 구간, seedCard 딥링크는 LiveCardExtras 캐스트로 eventId/cameraId 사용·기간 기본 7일) +
AssociateGraphView(liveRef effect로 동료 목록 조회 → allTier1/2/3을 count로 분류해 mock 티어
대체, 필터·정렬은 기존 로컬 로직 그대로, 선택 노드 리셋) + DataGridView(topCameraLabel/
firstSeen/lastSeen/label 실값 폴백) + JointEvidencePanel(liveRef+associateId effect로 집계
요약 조회 → view 정규화 객체로 라이브·mock 동일 렌더, 배지 totalEvents, associateId 표시).
Live Monitoring hover RedFace 버튼 = 위 seedCard 딥링크로 라이브 배선 완료 (UV-38 주입의
onNavigateTab 경로 재사용 — 별도 변경 없음).

BEST FRAME 실영상 타일 주입(UV-43, 계약 v0.9.0 Camera.streamUrl): types/detection.ts CamData에
optional streamUrl + BestFramePage CameraCard 피드 분기 확장(videoUrl → streamUrl(CameraStreamFeed,
WHEP 재생·실패 시 bestframe img 폴백) → img). 데이터 공급은 useBestFrameLive(getCameras 1회 조회로
streamUrl 맵 구성 → dataFor에 동봉). 플레이어는 lib/vca-bridge/CameraStreamFeed.tsx(백엔드 소유,
기획자 정식 타일이 대체할 임시 구현) — 시작 400ms 지연(그리드 전환·StrictMode의 순간 마운트가
WHEP 유령 세션을 만들지 않게), requestVideoFrameCallback 첫 프레임 감지, connectionState 워치독,
15초 재시도. vite.config.ts에 /streams 프록시(:8889 MediaMTX) 추가.
DataPage 타입 수정(UV-40 잔여): recentList/vipList 라이브·mock 유니언에서 `in` 내로잉이 TS
미선언 속성 규칙으로 깨지던 것을 isLiveRecentTarget/isLiveVipOption 타입 프레디킷으로 교체
(tsc -b 0 errors — npm run build 전제).

반입 20260827 (UV-44, import-snapshot-20260827 — 100커밋 대규모): DATA 탭 4→3(Smart Search 탭
제거 → Live Monitoring·Re-ID 내 SlidingSearchPanel/LiveSearchSidebar로 내장), RedFace Joint
Evidence → "Co-capture evidence"(Relationship analytics + Shared frames 프레임 그리드) 재설계,
vcaStore 행 분류 규칙 재설계(UV-31 폐기 — 2분 세션 병합 + 24h 활동 창 + 분류 창, BACKEND
HANDOFF 주석 참조), REDMAP Route history 재구축, CSS 변수 토큰화. 주입 병합 결과:
- 유지·재배치: LM 라이브 피드(useLiveMonitoring — LiveMonitorItem에 topColor 등 신필드 빈 값),
  Re-ID 라이브 검색(runSearch가 LiveSearchSidebar onSearch로, derivedApparel/Props 사용,
  recentList/vipList/cameraOptions는 SearchFilterState 경유 — 사이드바 VIP 탭 vips={state.vipList}),
  RedFace 동료 목록 라이브(AssociateGraphView liveRef — 라이브 노드 status는 label 유무로
  VIP/Unknown 매핑, Data grid 이름·Peak location(topCameraLabel)·Span(first/lastSeen) 라이브
  오버라이드), 피커 라이브 후보(클릭 검색 → **디바운스 500ms effect**로 전환 — theirs의 즉시
  반영 모델, pickedTargetObj에 liveCands[0] 참조 부착), RedMap Trace/Track on Map·Analyze Frame
  딥링크(onGoAnalyzeFrame 시그니처 `at?: number | {date; time}` 유니언으로 통일), Navbar 알림
  (Tracking 행 포함 — 새 규칙에서 라이브 VIP는 대부분 Tracking으로 접힘, confidence 0 미표시),
  BestFramePage 실영상 3단 분기·BestFrameDetailPage 초 단위 스크럽 모델에 UV-37 재배치(에이전트
  보고 참조), 차트 라이브 시간대 집계(라이브 모드에선 dot 레이어 억제).
- 소멸(기획 결정 수용): 상세 팝업 이동 경로 타임라인(reidTrajectory 배선 — RedMap Trace가 대체),
  ReelCard 분석 태그 행, redmap showOrigin/originOffset(mock 시작점 자체가 제거됨),
  SearchPanel·CameraSelect·SmartSearchContent(컴포넌트 삭제).
- **UV-45 재주입(계약 v1.10)**: JointEvidencePanel(Co-capture evidence)에 liveRef prop —
  집계(fetchRedfaceEvidence: Peak location/time 카드·First/Last·FRAMES 배지)와 Shared frames
  (fetchRedfaceFrames: 서버 페이징 + Peak 카드 필터를 계약 locationId/bucket 쿼리로) 라이브 배선.
  CooccurEvent에 optional live{targetBox,associateBox}(0~1 bbox, null=미검출), bboxStyle 헬퍼,
  라이트박스는 라이브에서 로드된 페이지 범위로 스텝 클램프. RedfaceNode에 locationsCount/
  peakBucket/peakCount — Data grid Locations·Peak time 컬럼 라이브 실값.
- 브리지 정합: redmapSearch HitResult에 personId/personLabel(단일 정체 'p1'), elapsed duration-only
  포맷, elapsedAlert 제거. reidAnalysis ReidMatchCard에 date/status(field 분리). in-내로잉 이슈는
  isLiveRecentTarget/isLiveVipOption 프레디킷 유지.

인증 주입(UV-47, 계약 0.11.0 /auth 4+1종): 세션은 httpOnly 쿠키(vca_session) — 화면/브리지는
토큰을 다루지 않는다. 브리지 lib/vca-bridge/auth.ts(authLogin/authLogout/fetchAuthMe/
authVerifyPassword/authChangePassword + useAuthProfile 훅)와 RequireAuth.tsx(라우트 가드).
결과 3분류: 'ok' / 'rejected'(ADM-* — 화면에 오류 문구) / 'unavailable'(인증 서버 미가동 —
mock 폴백, 프록시가 VCA-5021/5041로 구분). 주입 지점:
- App.tsx — "/"·"/mypage"를 RequireAuth로 래핑 (명시적 401일 때만 /login 리다이렉트)
- LoginPage — handleSubmit 실로그인(실패 문구 + submitting 상태), unavailable이면 기존
  portalUsers mock 분기 폴백. 오류 행 + 버튼 라벨만 추가 (기획 레이아웃 유지)
- Navbar — useAuthProfile() ?? SIGNED_IN_USER (메뉴 이름·이메일), Log out에 authLogout 선행
- MyPage — 프로필 6곳 me 교체(같은 폴백), PasswordChangeModal 실배선(verify 1단계 =
  POST /auth/password/verify, 변경 = POST /auth/password, serverError 행 2곳 추가)
개발 계정 시드: admin@univs.ai / VcaAdmin1234! (Admin 백엔드 기동 시, VCA_ADMIN_SEED_* 덮어쓰기).
/signup·/portal은 기획 확인 대기 — 실배선 없음.
UV-50(계약 0.13.0): AuthUserProfile에 permission/appAccess/appSearch/status/teamId/projectIds 추가,
email nullable(사번 로그인 계정) — MyPage 이메일 필드는 `me.email ?? employeeId ?? "—"`. 로그인 요청은
`identifier`(이메일|사번). `/api/portal/**` 그룹(teams/projects/users/audit)은 orval 훅만 생성된 상태 —
Portal 화면 배선은 W3(UV-52) 반입 때.
UV-51(계약 0.14.0): /auth/register/lookup·register·invite/redeem·signup, /portal/roster 그룹,
users setup-code·invite-token — 훅만 생성. 반입 시 기획자 register·forgot-password·password-setup
화면의 demo= 쿼리·클라이언트 카운터·generateTemporaryPassword()·issueInviteToken() 목업은 삭제(기획자 지시).
UV-53(계약 0.15.0): /portal/cameras(CRUD·bulk zone/delete — 응답에 모듈 MQTT status 적재값 status/lastSeenAt),
/portal/projects/{id}/camera-connectivity·camera-stability(기획자 README §4-(2) unstableCameras 형태),
/portal/servers(CRUD·check), PortalProject.channelsUsed — 훅만 생성. 반입 시 vcaStore Camera.status/lastSeenAt·
unstableCameras()·servers·projectChannelLimit 소비처가 이 API로 옮겨간다.
UV-56(계약 0.16.0): /portal/projects/{id}/detections(dailyDetections 형태), /auth/password/reset/request·verify·
complete(forgot-password 9 상태 — 에러 코드 ADM-4025 wrong/4026 expired/4027 throttled/4028 resendLimit/4029 adminOnly),
/auth/sessions GET·DELETE others·DELETE {id}(My Page Active login sessions·Terminate All Others) — 훅만 생성.
반입 시 forgot-password의 DEMO_REJECTED_CODE·MAX_RESENDS 카운터, mypage LOGIN_SESSIONS 상수는 이 API로 교체.

첫 로그인 흐름(UV-48, 계약 0.12.0): 기획 확정 — 계정은 담당자가 발급(임시 비밀번호 오프라인
전달, 발급 화면은 Admin(portal) 소관·API는 admin-api /admin/api/users). 프로필에
mustSetPassword — true면 본인 비밀번호 설정 전 메인 진입 불가. 주입 지점:
- LoginPage — 로그인 성공 시 mustSetPassword면 /password-setup, 아니면 "/".
  Forgot password는 "준비 중입니다" 문구만 (셀프 재설정 없음 — 담당자 재발급으로 처리)
- PasswordSetupPage — 실배선: 진입 가드 effect(비로그인→/login, 이미 설정→"/") +
  제출 = POST /auth/password/setup(임시 상태 세션 전용, 현재 비밀번호 불요) → 성공 시 "/"
  (unavailable이면 반입 원본 동작 /login 복귀 유지)
- RequireAuth — mustSetPassword=true 세션의 "/"·"/mypage" 접근을 /password-setup으로 강제

반입 시 규칙 충돌 주의 (원본 레포에 미반영된 백엔드발 변경 — diff 적용 후 반드시 재확인):
- `types/detection.ts` Detection에 optional `snapshotUrl`/`enrolledPhotoUrl` 필드 (라이브 이미지 공급)
- `lib/vcaStore.ts` addEvent — 확정 행 규칙(VIP 누적 + 카메라 전환 기준 Tracking 별개 1행, UV-31)
  구현의 단일 소유자. 라이브 브리지도 이 addEvent를 호출하므로, 반입으로 이전 병합 규칙이
  되돌아오면 mock/라이브 모두 깨진다 — 기획자 원본 레포에 동일 변경 반영을 요청해 둔 상태.

반입 20260909 (UV-52 W3, import-snapshot-20260909 = portal-handoff-v1): Portal 6탭(`components/portal/` 19파일)·인증
화면 4종(forgot-password·register·request-access·signup → `pages/*Page.tsx`)·i18n(`lib/i18n.ts`, 모든 화면 `T` 테이블)·
Navbar 프로젝트 전환·시각 피커 재설계·CommandPalette 삭제·self-host 폰트(`public/fonts`)가 들어옴. 3-way base는 태그
`import-snapshot-20260827`(기획자 원본 레이아웃 `src/…`) — 이번 스냅샷도 같은 계보의 `import/frontend-ui-20260909` 브랜치에
한 커밋으로 동결해 다음 반입의 base가 된다. 충돌 45 hunk(DataPage 16·BestFrameDetail 7…)는 "우리 주입 + 기획 i18n" 양쪽 유지가
원칙 — 해소 규칙은 반입 PR(UV-52) 본문. 라우트: `/portal`(RequireAuth → RequirePortal → PortalPage), `/forgot-password`·`/register`·
`/request-access`·`/signup`(가드 없음, 화면은 아직 mock — 2차 배선 대상). `next/navigation` shim에 `redirect()` 추가(signup).

**Portal 데이터 연결(UV-52) — 화면은 Zustand 스토어만 본다, 스토어를 서버로 채운다**
- `lib/vca-bridge/session.ts` — /auth/me 스냅샷(unknown·ok·rejected·unavailable). `auth.ts`의 fetchAuthMe/authLogin/authLogout이
  기록, `useAuthProfile()`은 이 스냅샷을 구독(각자 /auth/me 부르지 않음, 동시 호출 1회 합침).
- 스탠드인 4곳 본문 교체(`vcaStore.ts` — 기획 지시 "호출부 유지·본문만"): `currentPortalUser`·`currentPortalRole`·
  `projectsVisibleInApp`·`canSearchInApp`이 세션을 읽는다. 세션 없음 = 거부(none·[]·false, fail-closed), 인증 서버 미가동
  ('unavailable')만 기존 mock 신원. `currentPortalUser`는 세션당 객체 1개를 캐시(셀렉터 무한 재렌더 방지).
- `lib/vca-bridge/RequirePortal.tsx` — 세션 permission none이면 "/"로. 진짜 문은 서버(ADM-4030).
- `lib/vca-bridge/portalLive.ts` — `usePortalLive()`가 PortalShell(30초 폴링)·ClientLayout(폴링 없음)에 한 줄 주입.
  hydrate = 목록 7종(teams·projects·cameras·servers·portalUsers·staffRoster·auditLog) + 집계(`liveAggregates[projectId]` =
  detections 14일·camera-stability 7일)를 한 번에 setState. `installLiveActions()`가 스토어의 변경 액션을 API 호출 + 재조회로
  교체(카메라 CRUD/일괄, 프로젝트 생성·라이선스·메일·타임존·망분리, 팀 생성·메일, 계정 발급·권한·앱검색·배정·상태·삭제·
  임시비번·셋업코드·초대토큰, 서버 CRUD, 명부 추가·수정·삭제·코드 발급/재발급). 반환값이 필요한 7개 액션은 타입을
  `X | Promise<X>`로 넓히고 호출부 7곳에 `await` 주입(PortalUsersPage·ProjectRosterTab·RosterImportModal·TeamSwitcher·
  PortalShell·PortalNewProjectWizard·PortalSignupWizard). 명부 코드 원문은 서버가 다시 주지 않으므로 이번 세션 발급분만
  `issuedRosterCodes`로 잠시 보여준다. `dailyDetections()`/`unstableCameras()`는 `liveAggregates`가 있으면 그것을 돌려주고,
  PortalProjectDetailPage의 memo deps에 `liveAggregates` 추가.
- 서버 상태 매핑: unknown(상태 미수신)→offline(기획 확정 "error는 offline에 합침"), error→error. Camera.status 원천은 MQTT 적재.
- **mock 그대로 남은 것(다음 단계)**: VIP persons/groups(W5), uploads(W6), accessRequests(authConfig.accessRequest=false),
  register/forgot-password/request-access 화면의 데모 분기(`?demo=`·DEMO_* 상수) — 배선 시 삭제(기획 지시). 로그인의
  `?demo=`는 이번에 삭제하고 `?reason=sessionExpired|signedOut`(RequireAuth·로그아웃이 실어 보냄)으로 대체.
- LoginPage: 실로그인 후 mustSetPassword → /password-setup, 콘솔 역할 → /portal, 아니면 "/". 서버 거절 코드는
  `loginFailureFromCode()`(ADM-4010 badCredentials·4015 locked·4016 suspended·4017/4019 notActivated·4018 pendingApproval·
  4011 sessionExpired)로 기획 authErrors 7종 notice에 매핑, 매핑 밖은 버튼 위 error 행. "Keep me logged in"은 기획이 제거
  (공유 워크스테이션) → authLogin(…, false). PasswordSetupPage: `?token=` 초대 활성화(`authRedeemInvite` → 4024면 "링크 만료"
  화면) / 토큰 없음·`?reason=temp` = 임시 비밀번호 세션(authSetupPassword → 역할별 진입).

W3 2차(UV-52, 2026-09-10) — 인증 화면 배선 + 앱 프로젝트 이름:
- RegisterPage: `authRegisterLookup`(POST /auth/register/lookup) → 확인 단계(서버가 준 name·employeeId·projectName·permission),
  `authRegister`(POST /auth/register — 코드 소진·계정 생성·비밀번호 한 트랜잭션). ADM-4020 unknown·4021 used·4022 expired는 기획
  CODE_ERRORS 문구, 4023(IP 스로틀)은 throttled 화면. 클라이언트 시도 카운터(MAX_CODE_ATTEMPTS)·mock 조회(resolveRegistrationCode·
  portalUsers.setupCode)·`?demo=` 삭제(기획 지시). Activation에 projectName 추가.
- ForgotPasswordPage: `authResetRequest`(존재 여부 비노출, 서버 resendCooldownSec로 쿨다운) → `authResetVerify`(resetToken을
  상태로만) → `authResetComplete`. ADM-4025 wrong·4026 expired·4027 throttled·4028 resendLimit → 기획 CodeFailure, 4029 → adminOnly
  화면. MAX_RESENDS·DEMO_REJECTED_CODE·DEMO_EMAIL·`?demo=` 삭제. 각 단계에 serverError 행.
- `auth.ts` `ApiOutcome<T>`(ok+data / rejected / unavailable) + 5개 함수. RequestAccessPage는 authConfig.accessRequest=false라
  mock 그대로(서버 계약 없음, ADM-4018 예약).
- 앱 프로젝트 이름: `/auth/me`·로그인 응답에 `projects[{id,name}]`(owner 전체 / 그 외 배정 — UV-58 규칙, admin-api 0.11.0 /
  openapi 0.20.0). `projectsVisibleInApp`은 세션 projects를 원천으로 하고 스토어에 같은 프로젝트가 있으면 그 행을 쓴다 —
  앱 전용 계정(Portal API 403)도 헤더 현장 전환에 이름이 나온다.
- 시드 owner 이름: `VCA_ADMIN_SEED_NAME`(기본 Administrator). 기존 DB의 "John Doe"는 시더가 건드리지 않는다(수동 변경).


반입 20260910 (UV-52 W3 3차, import-snapshot-20260910 = portal-handoff-v2 — 55파일 +9.3k/-2.4k): 기획자가 zip이 아니라
이 레포의 `import/frontend-ui-20260910` 브랜치로 직접 push한다(태그가 전달 신호, 태그 없는 커밋은 작업 중). 3-way base는
`import-snapshot-20260909`. 새 화면: PortalSettingsPage(계정·프로젝트·팀 메일·명단 분류·조회 목적·언어, PortalMyPage 대체 —
원본 삭제), ProjectActivityTab(감사 로그), ProjectSearchLogTab(조회 기록 — complianceConfig로 1차 배포에서는 꺼짐),
WatchlistCategories, AuthTrailArt/AuthTrailList(로그인 우측 아트), `lib/complianceConfig.ts`, `lib/realtime/cameraStatus.ts`.
충돌 54 hunk(DataPage 13·BestFramePage 8…) 해소 규칙은 반입 PR(UV-52) 본문.

**구조 변경 3가지와 우리 쪽 대응**
- **현장(프로젝트) 범위**: 앱 화면이 전부 `useProjectCameras`/`useProjectEvents`/`camerasInProject`로 좁혀졌다.
  `camDataFor()`의 mock 폴백을 전역 `CAM_DATA` → `siteCamData`로 바꿨고, Sidebar/DataPage의 `getDashboardStats`·
  `getDevices`는 기획의 projectId 인자 버전을 쓰되 라이브 오버라이드(`useLiveDevices`·`useLiveDashboardStats`)는 유지.
  **주의**: MQTT `statusToCamera`는 projectId를 모른다 — projectId가 빈 카메라는 범위 필터에 걸려 어느 화면에도 안 나온다.
  `useVcaLiveBridge`가 등록부 행이 있으면 상태·이름·좌표만 갱신하고, 처음 보는 카메라만 현재 현장에 붙인다.
- **Detection.date 필수**: 화면이 시각에 "오늘"을 붙이던 것을 고쳤다. 브리지 3곳(useBestFrameLive·useMediaLive·
  analyzeTimeline)이 ISO instant에서 현장(SGT) 날짜를 넣는다. 업로드 이미지는 계약에 촬영 시각이 없어 빈 값(추측 금지).
- **카메라 상태 seam**: `features/vca/lib/realtime/cameraStatus.ts`는 기획이 만든 단일 조회 지점이고 "여기에 MQTT 클라이언트를
  넣지 말라"는 HANDOFF 주석이 붙어 있다. 스토어의 `camera.status`는 이미 우리 MQTT 브리지가 적재하므로 **본문 교체 없이
  그대로 라이브다**. 화면이 `camera.status`를 직접 읽지 않는 한 이 seam만 보면 된다.

**이번에 추가로 배선한 라이브 액션(portalLive.ts)**: `renameProject`(PUT /portal/projects/{id})·`renameTeam`(PUT /portal/teams/{id})·
`addRosterEntries`(POST /portal/roster 한 번 — 행별 ok, 거절 employeeId 반환. 행마다 호출하면 감사 로그가 밀린다는 기획 지적 반영).
`removeProject`/`removeTeam`은 **서버에 삭제 계약이 없어 mock 그대로** — 폴링이 돌면 서버 목록으로 되돌아온다(후속 과제).

**버그 수정**: 20260909 반입 때 `ClientLayout`의 `usePortalLive({poll:false})`가 VipSimulation의 `return null` **뒤**에 들어가
죽어 있었다(앱 헤더의 현장 목록이 서버로 안 채워짐). ClientLayout 본문 첫 줄로 옮겼다.

**mock으로 남은 것**: VIP persons/groups(W5)·uploads(W6)·accessRequests, 그리고 이번에 새로 생긴 준수 기능 전체 —
searchPurpose(조회 목적)·searchAccess(조회 기록)·watchlistCategory(명단 분류)·releasePerson/reinstatePerson.
서버 계약이 아직 없다. 조회 기록은 UV-59의 `GET /admin/api/search-audit`가 이미 있으니 complianceConfig를 켤 때 잇는다.
