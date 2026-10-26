# VCA 실시간 아키텍처 개요

> 대상 독자: VCA에 참여하는 모든 개발자 (기획자/프론트, 모듈, 백엔드).
> 이 문서는 전체 그림과 채널 경계를 정의한다. 세부 계약은 아래 두 문서가 원본이다:
> - **MQTT 계약**: [`backend/vca-mqtt-broker/SPEC.md`](../backend/vca-mqtt-broker/SPEC.md) ([GitHub](https://github.com/shpark-univsai/vca-mqtt-broker/blob/main/SPEC.md))
> - **REST 계약**: [`openapi/openapi.json`](../openapi/openapi.json)
>
> 역할별 실무 가이드: [모듈 개발자](guide-module-developer.md) · [프론트 개발자](guide-frontend-developer.md)

## 전체 구조

```
                    발행 (MQTT TCP 1883)              구독 (MQTT over WS 8083 / WSS 8084)
[분석 모듈] ─────────────────────────────> [EMQX 브로커] ─────────────────────────────> [브라우저 SPA]
    │                                                                                      │
    │ 모듈 API (module-api.json, envelope 없음)                                             │ REST /api (openapi.json, envelope)
    └───────────────<─── [프록시 백엔드 (Spring Boot)] ───<────────────────────────────────┘
```

- **실시간(변화분)**: 모듈 → EMQX → 브라우저. 계약: MQTT SPEC
- **스냅샷·이력**: 브라우저 → 프록시 백엔드 → 모듈 API. **DB는 우리 쪽에 없다** — 감지 데이터의 저장·집계·조회는 원천인 모듈이 책임지고(단일 진실 원천), 프록시는 envelope 변환·오류 매핑·(추후) 인증·캐싱만 담당하는 얇은 계층이다

| 구성 요소 | 역할 | 담당 | 저장소 |
|---|---|---|---|
| 분석 모듈 | 카메라 프레임 처리, MQTT 발행 + **모듈 API 서빙** (저장·집계 포함) | 모듈 개발자 | (모듈 저장소) |
| EMQX 브로커 | MQTT 메시지 중계. 브라우저 직결 (WebSocket) | 백엔드 (박상훈) | [vca-mqtt-broker](https://github.com/shpark-univsai/vca-mqtt-broker) |
| 프록시 백엔드 | 브라우저 `/api` → 모듈 API 중계. envelope 변환, 오류 매핑, 타임아웃, (추후) JWT·캐싱 | 백엔드 (박상훈) | `vca/backend/proxy/` |
| 프론트 SPA | 화면. Vite + React 19 + TS | 화면=기획자, 데이터 연결=백엔드 | `vca/frontend/` |

### 프록시 변환 규칙

두 REST 계약은 경로·파라미터·데이터 스키마가 동일하다 (`module-api.json` = `openapi.json` - envelope). 프록시의 일은:

1. `GET /api/{path}?{query}` → `GET {MODULE_API_BASE}/{path}?{query}` 그대로 전달
2. 모듈 2xx JSON → `{ "success": true, "code": "OK", "message": null, "data": <모듈 응답> }`
3. 모듈 오류(`{ code, message }` + HTTP 상태) → 같은 상태코드로 `{ "success": false, "code": <모듈 code>, "message": ..., "data": null }`
4. 모듈 연결 실패 → 502 `VCA-5020`, 타임아웃(5초) → 504 `VCA-5040`, 그 외 프록시 내부 오류 → 500 `VCA-5000`
5. 예외: `/api/vips/{vipId}/photo`는 이미지 바이너리를 envelope 없이 스트리밍

## 채널 경계 — 어떤 데이터가 어디로 오는가

판단 기준: **화면을 보고 있는 동안 저절로 바뀌어야 하는 값 → MQTT. 사용자 행동(클릭·페이징)의 응답이거나 과거 데이터 → REST.**

| 데이터 | 채널 |
|---|---|
| 카메라 상태 변화 (Running/Stopped) | MQTT `cameras/{id}/status` (retained) |
| 새 VIP 감지 이벤트 | MQTT `cameras/{id}/detections` |
| 지도 카메라 라벨의 감지 수 | MQTT `cameras/{id}/stats` (retained) |
| 상단·EVENTS 탭 카운터 (당일 VIP / 당일 전체 얼굴, 전일 대비 증감) | MQTT `stats/summary` (retained) |
| Live Analytics 목록 (페이징, 로케이션/타입 필터) | REST `GET /dashboard/live-analytics` |
| 등록 VIP 목록 (Registered VIP Targets 모달) | REST `GET /vips` |
| VIP별 당일 감지 카메라 (모달 행 클릭 → 지도 점) | REST `GET /vips/{vipId}/detected-cameras` |
| VIP 감지 이력 = 이동 경로 (Live Analytics 행 클릭) | REST `GET /vips/{vipId}/detections` |
| 로케이션 목록 (Select Location 모달) | REST `GET /locations` |
| 카메라 목록 (SYSTEM 탭, 페이징) | REST `GET /cameras` |
| Detection Topology & Average 그래프 | REST `GET /stats/detection-topology` — 주기적 재조회(권장 60초), 실시간 push 아님 |

## 핵심 패턴: 스냅샷 + 델타

실시간 목록/지도는 두 채널의 조합으로 만들어진다:

```
MQTT 구독 먼저 → REST 스냅샷 조회 → 이후 MQTT 델타를 스냅샷 위에 병합
```

- 구독을 먼저 걸어야 조회-구독 틈새의 이벤트 유실이 없다. 스냅샷과 델타가 겹치는 감지는 `eventId`로 중복 제거
- Live Analytics: `vipId` 기준 upsert. 행 타입은 `detections.length`로 판정 (1 = VIP, ≥2 = Tracking)
- 이 병합 로직은 전부 `frontend/src/lib`(백엔드 담당)에 구현되며, 화면 컴포넌트는 병합 결과를 props/훅으로만 받는다
- 상세 병합 규칙(로케이션 필터, VIP 지도 점 갱신 포함): MQTT SPEC §5

## 공통 식별자·규약 (두 계약이 공유)

| 항목 | 규칙 |
|---|---|
| `cameraId`, `locationId` | `^[a-z0-9-]{1,64}$` — MQTT 토픽 경로에 들어가므로 `/` `+` `#` 공백 금지. 불변 |
| 로케이션 | 1개 이상의 카메라를 묶는 지역 그룹. 모든 카메라는 정확히 하나의 로케이션 소속 |
| 시각 | ISO-8601 UTC. "오늘" 카운터의 리셋은 사이트 로컬(Asia/Singapore) 자정 |
| `similarity` | 0~1 실수. 퍼센트 표시는 프론트 책임 |
| envelope | REST만 `{ success, data, message, code }`. MQTT 페이로드에는 envelope 없음 (사실 그 자체만) |
| 페이징 | `{ content, page, size, totalElements }`, page는 0부터 |

## 주요 결정 이력

| 결정 | 이유 | 기록 |
|---|---|---|
| 브로커 = EMQX 5.x | JWT 인증 내장, 토픽 ACL, WebSocket 기본, 관리 대시보드 | UV-22 |
| 브라우저 → 브로커 직결 (서버 중계 없음) | 지연 최소화, 서버 부담 제거. 운영 시 WSS+JWT+ACL로 보호 | UV-22 |
| 통신 규약은 브로커 담당이 정의·통보 | 별도 합의 절차 없음. 모듈·프론트는 SPEC을 따른다 | UV-23 |
| 그래프는 REST 주기 재조회 | 대시보드 체감상 실시간 push 불필요 | UV-23 |
| 집계는 모듈이 계산 (카운터·증감·전일 대비) | 프론트 계산은 새로고침 시 어긋남 | UV-23 |
| 백엔드는 DB 없는 프록시, 데이터 저장·조회는 모듈 API | 모듈은 집계를 위해 어차피 저장함 — 사본 DB를 두면 이중 관리·불일치 위험. 단일 진실 원천 유지 | UV-27 |

## 개발 환경

```bash
# 브로커 기동 (vca/backend/vca-mqtt-broker)
docker compose up -d
# 포트: 1883(TCP) 8083(WS) 8084(WSS) 18083(대시보드, admin/public)

# 프론트 (vca/frontend)
npm run gen:api   # openapi.json → 타입/훅 재생성
npm run dev
```

인증: 개발 단계는 익명 허용. 운영 전환 시 JWT + ACL (MQTT SPEC §6, 별도 문서 예정).

## 배포 (개발서버, UV-60)

전체 스택은 [deploy/docker-compose.yml](../deploy/docker-compose.yml) 한 벌 — frontend(nginx) · proxy · admin · postgres · EMQX · MediaMTX(+test-stream) · 모듈 sim.
서버에서 이미지를 빌드하며(`backend/admin`·`backend/proxy`·`vca-mqtt-broker/sim` Dockerfile), 절차·포트·환경변수는 [deploy/README.md](../deploy/README.md).
호스트에 여는 것은 80(웹)·8083(MQTT WS)·8554(RTSP)·8189/udp(WebRTC)·선택 8080(proxy)만이고 admin·DB·MediaMTX API·MQTT tcp는 컨테이너 네트워크 안에 둔다.

## 작업 이력

모든 작업은 Jira [UNIVS-VCA (UV)](https://univsai.atlassian.net/projects/UV) 프로젝트에 티켓으로 기록한다.
