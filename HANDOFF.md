# VCA 프론트엔드 — 전달 문서

인증(로그인·가입·비밀번호 재설정) 화면이 전부 만들어져 있고, **서버 연동은 아직 하나도
되어 있지 않습니다.** 이 문서는 그것을 확인하는 방법과, 서버가 무엇을 해줘야 하는지를
가리킵니다.

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

## 3. 로그인

**아무 이메일 + 아무 비밀번호**로 통과합니다. 비밀번호는 비어있지 않은지만 봅니다.

시드 계정 중 셋은 실제로 다르게 동작합니다:

| 아이디 | 결과 |
|---|---|
| `grace.tan@univs.ai` | 관리자 → Portal 로 진입 |
| `david.ong@univs.ai` | 정지된 계정 — 로그인 차단 |
| `wei.chen@univs.ai` | 미활성 계정 — 로그인 차단 |

## 4. 실패 화면 보는 방법

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
/forgot-password?demo=throttled       시도 초과 (입력 차단)
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

## 5. 지금 동작하지 않는 것

오해를 막기 위해 명시합니다.

- **비밀번호 검증** — 비어있지 않은지만 봅니다
- **세션** — 토큰도 쿠키도 만들지 않습니다
- **라우트 보호** — 로그인하지 않아도 주소를 치면 대시보드가 열립니다
- **계정 생성** — 가입해도 계정이 만들어지지 않습니다
- **메일 발송** — 아무것도 보내지 않습니다
- **계정 잠금 / 유휴 로그아웃** — 없습니다

코드에서 `HANDOFF NOTE` 로 검색하면 "여기에 어떤 호출이 들어가야 하는지"가 지점마다
주석으로 적혀 있습니다.

## 6. 설정

`.env.example` 을 `.env.local` 로 복사해서 씁니다. 지도 타일 출처, 지원 연락처, API 주소가
거기서 나옵니다. 배포별 인증 스위치는 `src/lib/authConfig.ts` 한 곳입니다.

## 7. 포함되지 않은 것

Portal 관리 화면 일부는 이 사본에서 제외되어 있습니다. 메뉴에는 `Coming soon` 으로
남겨두었습니다.
