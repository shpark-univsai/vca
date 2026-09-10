# VCA 프론트엔드 — 전달 문서

기준 스냅샷: **`import-snapshot-20260910`** (2026-09-10)

인증 화면, 관리 콘솔(Portal), 관제 앱이 화면으로는 전부 만들어져 있고, **서버 연동은
아직 하나도 되어 있지 않습니다.** 이 문서는 그것을 확인하는 방법과, 서버가 무엇을
해줘야 하는지를 가리킵니다.

지난 전달(`import-snapshot-20260909`) 이후 바뀐 것만 보시려면:

```bash
git diff import-snapshot-20260909 import-snapshot-20260910
# 54개 파일, +9105 / -2383
```

## 1. 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

인터넷 없이도 전부 동작합니다. 백엔드도 필요 없습니다 — 데이터는 모두 목업입니다.

## 2. 플로우 문서

다이어그램 6개와 서버가 지켜야 할 계약이 여기 있습니다.

**https://claude.ai/code/artifact/f66095d5-40b2-4551-a145-44f133ea2065**

권한 모델(역할·권한 키 매트릭스)은 별도 문서입니다.

**https://claude.ai/code/artifact/228dc3d3-3f22-4a99-a844-ff61e5c0891d**

## 3. 이번 스냅샷에서 새로 생긴 화면

`/portal` 좌측 메뉴와 프로젝트 상세 탭에서 들어갑니다.

| 화면 | 파일 | 무엇 |
|---|---|---|
| 설정 | `PortalSettingsPage.tsx` | 계정·프로젝트·팀 메일(SMTP)·명단 분류·조회 목적·표시 언어 |
| 변경 기록 | `ProjectActivityTab.tsx` | 감사 로그 — 기간·담당자·검색·CSV 내보내기 |
| 조회 기록 | `ProjectSearchLogTab.tsx` | 조회 사유의 읽는 쪽. **1차 배포에서는 꺼져 있습니다** |
| 명단 분류 | `WatchlistCategories.tsx` | 기관이 직접 정의 — 색·기본 유효기간·근거 필수 여부 |

같이 들어온 구조 변경:

- **권한 두 축 분리** — 포털 역할(`permission`)과 앱 접근(`appAccess`)이 별개입니다.
  Auditor는 실제로 읽기 전용으로 동작합니다.
- **타임존은 프로젝트 단위** — `Project.timeZone`. 날짜·"오늘"은 보는 사람이 아니라
  **현장**의 시간대를 따릅니다. (앱 일부에 남아 있는 SGT 고정 호출은 전환 예정)
- **한국어** — 포털·앱 양쪽. 화면 언어는 포털과 앱이 **각각** 기억합니다.
  데이터(카메라 이름·인물명)는 번역하지 않습니다.
- **배포 단위 스위치** — `src/lib/complianceConfig.ts`. 조회 사유 요구 여부 등,
  기관마다 다른 것을 여기 한 곳에서 끕니다.

## 4. 로그인

**아무 이메일 + 아무 비밀번호**로 통과합니다. 비밀번호는 비어있지 않은지만 봅니다.

시드 계정 중 셋은 실제로 다르게 동작합니다:

| 아이디 | 결과 |
|---|---|
| `grace.tan@univs.ai` | 최고관리자(owner) → Portal 로 진입 |
| `david.ong@univs.ai` | 정지된 계정 — 로그인 차단 |
| `wei.chen@univs.ai` | 미활성 계정 — 로그인 차단 |

## 5. 실패 화면 보는 방법

이 상태들은 **정상 조작으로 도달할 수 없습니다.** 그것을 만들어내는 서버 응답이 아직
없기 때문입니다. 주소로 직접 여세요.

### 로그인
```
/login?demo=badCredentials      아이디 또는 비밀번호 불일치
/login?demo=locked              연속 실패로 잠김
/login?demo=suspended           관리자가 접근 회수
/login?demo=pendingApproval     승인 대기
/login?demo=notActivated        코드만 받고 비밀번호 미설정
/login?demo=sessionExpired      세션 만료
/login?demo=signedOut           로그아웃됨
```

### 비밀번호 재설정
```
/forgot-password                     이메일 입력
/forgot-password?demo=code           코드 입력
/forgot-password?demo=wrong          코드 불일치
/forgot-password?demo=expired        만료
/forgot-password?demo=throttled      시도 초과 (입력 차단)
/forgot-password?demo=resendLimit    재발송 한도
/forgot-password?demo=password       새 비밀번호
/forgot-password?demo=done           완료
/forgot-password?demo=adminOnly      메일 서버 없는 배포
```

### 가입 (등록 코드)
```
/register                  아래 코드를 넣어보세요
/register?demo=throttled   시도 초과 (입력 차단)
```

| 코드 | 결과 |
|---|---|
| `BPXW-4762` | 정상 (Priya Nair) |
| `QRST-5678` | 이미 사용된 코드 |
| `VXYZ-2345` | 만료된 코드 |

### 관리자 쪽
```
/portal                      Users & Permissions 탭 → 행 메뉴
/portal?recovery=adminOnly   메일 서버가 없는 상태
```

## 6. 지금 동작하지 않는 것

오해를 막기 위해 명시합니다.

- **비밀번호 검증** — 비어있지 않은지만 봅니다
- **세션** — 토큰도 쿠키도 만들지 않습니다
- **라우트 보호** — 로그인하지 않아도 주소를 치면 대시보드가 열립니다.
  `/portal`도 마찬가지입니다 — 가드가 없고, 화면이 쓰는 신원은 목업 상수입니다.
  화면 안의 권한 분기는 **표시용**이며, 진짜 문은 서버여야 합니다
- **계정 생성** — 가입해도 계정이 만들어지지 않습니다
- **메일 발송** — 아무것도 보내지 않습니다. 팀 메일(SMTP) 화면도 저장만 하고
  릴레이에 접속하지 않습니다
- **계정 잠금 / 유휴 로그아웃** — 없습니다
- **감사 로그** — 브라우저 메모리(store)에만 쌓이고 새로고침하면 사라집니다
- **업로드 영상 분석** — 큐에 `pending`으로 들어간 뒤 **아무것도 진행시키지 않습니다**
- **VIP 얼굴 사진 등록 / CSV 일괄 등록** — 전부 브라우저 안에서만 처리됩니다

코드에서 `HANDOFF` 로 검색하면 "여기에 어떤 호출이 들어가야 하는지"가 **65곳**에
주석으로 적혀 있습니다.

## 7. 설정

`.env.example` 을 `.env.local` 로 복사해서 씁니다. 지도 타일 출처, 지원 연락처,
API 주소가 거기서 나옵니다.

| 파일 | 무엇을 켜고 끄나 |
|---|---|
| `src/lib/authConfig.ts` | 배포별 인증 스위치 (비밀번호 복구 방식 등) |
| `src/lib/complianceConfig.ts` | 조회 사유 요구 여부 등 기관별 준수 항목 |

## 8. 이 스냅샷과 모노레포 `frontend/` 의 관계

이 저장소는 모노레포의 `frontend/` 와 **다른 앱**입니다.

| | 이 스냅샷 | `main:frontend/` |
|---|---|---|
| 빌드 | Next.js 16 | Vite + react-router |
| 데이터 | 목업 store (zustand) | orval 생성 훅 + axios + MSW |
| 실시간 | 없음 | `mqtt` ^5.15.2 |

`import/*` 브랜치는 main 과 조상을 공유하지 않으므로 섞이지 않습니다. 화면을 **있는
그대로** 넘기는 원본이고, 최종적으로 화면 코드가 살 곳은 `frontend/src/features` ·
`components` 입니다 (CODEOWNERS 기준 기획자 소유).

`docs/checklist-frontend-import.md` 의 이식 비용 판정은 **DASHBOARD / BEST FRAME /
DATA / REDMAP 네 화면**을 기준으로 매겨진 것입니다. 이번 스냅샷은 그보다 넓습니다 —
Portal 관리 콘솔 전체와 인증 화면 전부가 들어 있습니다.

### 회신 3번에 대한 정정

2026-09-09 회신 3번이 "앱 대시보드는 브라우저가 EMQX WebSocket을 직접 구독하고 기존
`mqttClient` 가 재접속을 처리한다"고 되어 있는데, **그것은 이 앱이 아니라
`main:frontend/` 입니다** — `mqtt` 의존성이 거기 있고, 이 Next.js 앱에는 mqtt /
websocket 클라이언트가 없습니다(자리를 표시한 주석 한 줄뿐).

카메라가 죽은 것을 몇 초 안에 아는지가 여기 달려 있으므로, **어느 프론트 기준으로
이야기하는지** 부터 맞춰 주세요.
