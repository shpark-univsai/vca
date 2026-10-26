# 모듈 개발자 가이드 — VCA MQTT 발행 계약

> 대상 독자: 분석 모듈(카메라 프레임 처리·집계) 개발자.
> **이 문서 + [MQTT SPEC](https://github.com/shpark-univsai/vca-mqtt-broker/blob/main/SPEC.md) + [module-api.json](../openapi/module-api.json)을 클로드 세션에 그대로 전달하면 구현에 필요한 계약 정보가 모두 포함되어 있다.**
> 계약 원본은 두 개 — 실시간은 SPEC.md, 조회 API는 module-api.json. 이 문서는 모듈 관점의 실무 요약이며, 충돌 시 계약 원본이 우선한다.

## 당신(모듈)의 역할 — 두 가지

1. **MQTT 발행** — 감지·상태·집계의 변화분을 EMQX 브로커에 발행한다. 구독자는 웹 브라우저(대시보드)
2. **모듈 API 서빙** — 페이징 목록·이력·그래프 조회 HTTP API를 제공한다. 호출자는 VCA 프록시 백엔드

```
[모듈] --MQTT(TCP 1883, QoS 1)--> [EMQX] --WebSocket--> [브라우저]      (실시간 변화분)
[모듈 API :8081] <--HTTP-- [VCA 프록시] <--/api-- [브라우저]             (스냅샷·이력 조회)
```

감지 데이터의 저장·집계는 모듈 책임이다 (VCA 쪽에는 DB가 없다). 두 채널이 내보내는 값은 서로 일관되어야 한다.

## 접속 정보

| 환경 | 주소 | 인증 |
|---|---|---|
| 개발 | `tcp://<브로커 호스트>:1883` (로컬 기동 시 localhost) | 없음 (익명) |
| 운영 | 추후 공지 | JWT 예정 (별도 안내) |

- 클라이언트 라이브러리: Java면 Eclipse Paho 또는 HiveMQ MQTT Client 권장
- 브로커 로컬 기동: `vca/backend/vca-mqtt-broker`에서 `docker compose up -d`

## 발행해야 할 토픽 5종

`{siteId}`는 현재 `sg` 고정. QoS는 모두 1.

| # | 토픽 | retained | 발행 시점 |
|---|---|---|---|
| 1 | `vca/v1/sg/cameras/{cameraId}/status` | **O** | 상태 변화 시 + **모듈 기동 시 전체 카메라 1회씩** |
| 2 | `vca/v1/sg/cameras/{cameraId}/detections` | X | 감지(대상 등장) 발생 시마다 — **v1.1에서 전 카테고리로 확장** |
| 3 | `vca/v1/sg/cameras/{cameraId}/stats` | **O** | 해당 카메라의 당일 감지 수 변화 시 |
| 4 | `vca/v1/sg/stats/summary` | **O** | 카메라 상태·감지 카운터 등 구성 값 변화 시 |
| 5 | `vca/v1/sg/cameras/{cameraId}/bestframe` | **O** | **초당 1회** — 해당 초의 best shot 메타 (v1.1, BEST FRAME 화면) |

### 1. 카메라 상태

```json
// vca/v1/sg/cameras/cam-novena-01/status   (retained)
{
  "cameraId": "cam-novena-01",
  "name": "Novena",
  "status": "RUNNING",
  "locationId": "loc-novena",
  "location": { "lat": 1.3204, "lng": 103.8439 },
  "ts": "2026-08-10T01:18:23Z"
}
```

- `status`: `RUNNING` | `STOPPED` (두 값뿐)
- 카메라가 시스템에서 제거되면 **빈 페이로드를 retained로 발행**해서 지운다

### 2. 감지 이벤트 (v1.1: 전 카테고리 · v1.6: faceUrl/gender/age)

```json
// vca/v1/sg/cameras/cam-westgate-bs1/detections   (non-retained)
{
  "eventId": "evt-01J8Z3K7Q9",
  "cameraId": "cam-westgate-bs1",
  "cameraName": "CAM_WestGate_BS1",
  "locationId": "loc-main-intake",
  "category": "vip",
  "label": "Dr. Alex Wong",
  "groupLabel": "VIP group",
  "confidence": 0.984,
  "vip": { "vipId": "vip-042", "name": "Dr. Alex Wong", "similarity": 0.984 },
  "vehicle": null,
  "attributes": { "top": "White top", "bottom": "Brown bottom", "item": "No backpack" },
  "snapshotUrl": "/api/detections/evt-01J8Z3K7Q9/snapshot",
  "faceUrl": "/api/detections/evt-01J8Z3K7Q9/face",
  "gender": "male",
  "age": 45,
  "location": { "lat": 1.3204, "lng": 103.8439 },
  "detectedAt": "2026-08-10T01:18:23Z"
}
```

- `eventId`: 감지 1건마다 고유. 브라우저가 중복 제거에 사용하므로 **재발행 시에도 같은 감지는 같은 eventId**
- **감지 1건 = 대상의 "등장" 1회.** 같은 대상이 프레임에 연속으로 보이는 동안 재발행하지 않고, 사라졌다 다시 나타나면 새 이벤트 (매 프레임 발행 아님 — 프레임 단위 현황은 5번 bestframe)
- `category`: `vip` | `staff` | `unauthorized` | `vehicle` | `unknown` | `false_positive`(모듈 자체 판정 오탐)
- `vip` 객체는 **등록 인물 매칭 시에만** (category vip·staff) — 그 외 `null`. `vehicle`은 `{ plate, color }`, 인물 외형은 `attributes`
- `label`은 화면 행 제목(인물 이름 / `"Vehicle SGX411"` / 외형 요약), `groupLabel`은 부제(`"Staff (Finance)"`, 차량 색상 등)
- `similarity`/`confidence`: 0~1 실수 (0.726 = 72.6%). 미매칭 카테고리는 `confidence: null`
- `snapshotUrl`: **MQTT 발행 시에는 `/api` 프리픽스를 모듈이 직접 붙인다** (MQTT는 프록시를 거치지 않으므로). REST 응답에서는 반대로 모듈 상대경로 — 아래 모듈 API 절 참고
- **(v1.6, DATA Live Monitoring)** `faceUrl`(얼굴 크롭 — 인물이고 얼굴이 검출된 경우만, 그 외 `null`),
  `gender`(`male`/`female`/`null`), `age`(추정 나이 단일 정수, 미추정 `null`) — 전부 additive라
  기존 소비자와 호환. `snapshotUrl`이 카드의 **전신 이미지**, `faceUrl`이 얼굴 인셋이다.
  `/api` 프리픽스 규칙은 snapshotUrl과 동일

### 5. Best Frame (v1.1 — BEST FRAME 화면)

```json
// vca/v1/sg/cameras/cam-westgate-bs1/bestframe   (retained, 초당 1회)
{
  "frameId": "bf-cam-westgate-bs1-1754990655123",
  "cameraId": "cam-westgate-bs1",
  "cameraName": "CAM_WestGate_BS1",
  "locationId": "loc-main-intake",
  "capturedAt": "2026-08-18T07:04:10Z",
  "imageUrl": "/api/cameras/cam-westgate-bs1/frames/bf-cam-westgate-bs1-1754990655123",
  "objects": [
    { "eventId": "evt-01J8Z3K7Q9", "category": "vip", "label": "Dr. Alex Wong",
      "bbox": { "x": 0.42, "y": 0.31, "w": 0.08, "h": 0.22 } }
  ]
}
```

- **초당 프레임 중 best shot 1장을 선별**해 메타만 발행 — **이미지 본체는 MQTT에 싣지 않는다.** 브라우저가 `imageUrl`(REST)로 가져간다
- `frameId`가 포함된 `imageUrl`은 **불변 URL** — 같은 프레임이면(변화 없으면) 재발행 생략 가능
- `objects` = 이 프레임에 보이는 대상들. `eventId`는 2번 감지 이벤트와 **같은 값** (화면이 박스와 목록 행을 연결하는 키)
- `bbox`: 프레임 크기 대비 **0~1 정규화** (`x`,`y` = 좌상단, `w`,`h` = 폭·높이)
- `imageUrl`도 `/api` 프리픽스 포함해 발행 (snapshotUrl과 동일 규칙)

### 3. 카메라별 당일 감지 수

```json
// vca/v1/sg/cameras/cam-novena-01/stats   (retained)
{
  "cameraId": "cam-novena-01",
  "detectionsToday": 30,
  "ts": "2026-08-10T01:18:23Z"
}
```

- `detectionsToday`: **등록 VIP 감지 건수** 기준 (지도 라벨에 표시되는 숫자)

### 4. 전역 집계

```json
// vca/v1/sg/stats/summary   (retained)
{
  "cameras": { "running": 42, "stopped": 34 },
  "vipDetections":  { "today": 3, "deltaFromYesterday": -4, "deltaRate": -0.015 },
  "faceDetections": { "today": 6, "deltaFromYesterday": -4, "deltaRate": -0.015 },
  "ts": "2026-08-10T01:18:23Z"
}
```

| 필드 | 정의 |
|---|---|
| `vipDetections.today` | 당일 category=`vip` 감지 건수 (감지 1건 = 1) |
| `faceDetections.today` | 당일 인물 감지 건수 = category `vip`+`staff`+`unauthorized` 합 (`vehicle`·`unknown`·`false_positive`는 어느 카운터에도 미포함) |
| `deltaFromYesterday` | `오늘 총계 - 전일 총계`. 부호가 증감 방향 |
| `deltaRate` | `deltaFromYesterday / 전일 총계`. **전일 총계가 0이면 `null`** |

3번 `detectionsToday`도 category=`vip` 기준이다.

## 반드시 지킬 규칙

1. **ID 형식**: `cameraId`, `locationId`는 `^[a-z0-9-]{1,64}$` — 토픽 경로에 들어가므로 `/`, `+`, `#`, 공백 금지. 한번 부여하면 불변 (이름 변경은 `name` 필드로만). 권장: `cam-{위치}-{순번}`, `loc-{지역}`
2. **로케이션**: 모든 카메라는 정확히 하나의 `locationId`에 속한다. status와 detections 페이로드 양쪽에 항상 포함
3. **시각은 항상 ISO-8601 UTC** (`2026-08-10T01:18:23Z`)
4. **"오늘"의 기준은 사이트 로컬(Asia/Singapore) 자정.** 자정에 당일 카운터를 리셋하고, 리셋된 값을 retained로 재발행
5. **retained 규칙**: 상태성 토픽(1·3·4번)은 retained로 발행 — 브라우저가 새로 접속했을 때 마지막 값을 즉시 받는 초기 동기화 수단이다
6. **envelope 금지**: `{ success, data, ... }` 같은 포장 없이 위 JSON 그대로 발행
7. **필드 추가는 자유** (구독자는 모르는 필드를 무시), 필드 삭제·의미 변경은 계약 위반 — 브로커 담당(박상훈)과 협의

## 두 번째 책임: 모듈 API 서빙

대시보드의 페이징 목록·이력·그래프는 VCA 프록시 백엔드가 **모듈 API를 호출해서** 브라우저에 전달한다. 감지 데이터의 저장·집계·조회는 원천인 모듈의 책임이다 (VCA 쪽에는 DB가 없다).

**계약: [`openapi/module-api.json`](../openapi/module-api.json)** — 이 OpenAPI 스펙이 원본이며, 클로드 세션에 그대로 전달하면 서버 구현이 가능하다. 요약:

| 엔드포인트 | 내용 |
|---|---|
| `GET /v1/dashboard/live-analytics` | 당일 감지 VIP 목록 (페이징, `locationId`·`type` 필터, 행마다 감지 이력 시간 오름차순) |
| `GET /v1/vips` | 등록 VIP 목록 (페이징) |
| `GET /v1/vips/{vipId}/detected-cameras` | VIP가 감지된 카메라 (일 단위, 카메라 중복 제거, 없으면 `cameras: []`) |
| `GET /v1/vips/{vipId}/detections` | VIP 감지 이력 = 이동 경로 (일 단위, 시간 오름차순) |
| `GET /v1/vips/{vipId}/photo` | VIP 등록 사진 바이너리 (image/jpeg 또는 png) |
| `GET /v1/locations` | 로케이션 목록 |
| `GET /v1/cameras` | 카메라 목록 (페이징, `status` 필터) |
| `GET /v1/stats/detection-topology` | 시간대별 감지 수 (0~23시 24버킷 + 7일 평균) |
| `GET /v1/cameras/{cameraId}/detections` | **(v1.1)** 카메라별 최근 감지 (페이징, 전 카테고리, `category` 필터, 최신순) — BEST FRAME 타깃 패널 시딩 |
| `GET /v1/cameras/{cameraId}/frames/{frameId}` | **(v1.1)** best frame 이미지 바이너리 — bestframe 발행의 `imageUrl` 대상 |
| `GET /v1/detections/{eventId}/snapshot` | **(v1.1)** 감지 스냅샷 크롭 바이너리 (썸네일·LIVE SNAPSHOT). 최소 당일+전일 서빙 |
| `POST /v1/persons/search` | **(v1.2)** REDMAP 인물 검색 — multipart 얼굴/바디 이미지 + 기간 + 유사도 임계값 → hit 목록 (capturedAt 오름차순, maxResults 상한) |
| `GET /v1/search-hits/{hitId}/face` | **(v1.2)** 검색 hit 얼굴 크롭 바이너리 — 검색 응답 후 최소 1시간 서빙 |
| `GET /v1/search-hits/{hitId}/body` | **(v1.2)** 검색 hit 바디 크롭 바이너리 — 서빙 규칙 동일 |
| `GET /v1/images` | **(v1.3)** 업로드 이미지 목록 (페이징, 최신순) — BEST FRAME Image list |
| `GET /v1/images/{imageId}/targets` | **(v1.3)** 이미지 검출 대상 전체 (정적, 페이징 없음, bbox 0~1) |
| `GET /v1/images/{imageId}/content` · `.../targets/{targetId}/crop` | **(v1.3)** 이미지 원본·대상 크롭 바이너리 |
| `GET /v1/videos` | **(v1.3)** 업로드 비디오 목록 (페이징, analysisStatus: processing/ready/failed) |
| `GET /v1/videos/{videoId}/content` | **(v1.3)** MP4 바이너리 — **HTTP Range(206) 필수**, 브라우저 재생 가능 코덱(H.264) 책임 |
| `GET /v1/videos/{videoId}/thumbnail` | **(v1.3)** 비디오 썸네일 바이너리 |
| `GET /v1/videos/{videoId}/frames?from&to` | **(v1.3)** 시간 구간의 프레임별 대상 (t 오름차순, 대상 있는 프레임만) — 재생 오버레이 동기화 |
| `GET /v1/videos/{videoId}/targets` · `.../targets/{targetId}/crop` | **(v1.3)** 비디오 내 고유 대상 목록(페이징) + 대표 크롭 |
| `POST /v1/targets/track-on-map` | **(v1.4)** Track on Map — 기존 감지 대상 참조(source + targetId)로 당일 추적 검색. 시간 창·유사도는 모듈이 결정해 `applied`로 에코 |
| `GET /v1/cameras/{cameraId}/bestframes?date&hour&minute` | **(v1.5)** 분 단위 베스트 프레임 이력 — 초당 1장·최대 60장, capturedAt 오름차순, categories 포함 |
| `GET /v1/cameras/{cameraId}/bestframes/{frameId}/targets` | **(v1.5)** 프레임 1장의 tracked 대상 (targetId = 감지 eventId, analysis 태그 포함) |
| `GET /v1/videos/{videoId}/bestframes?date&hour&minute` | **(v1.5)** 비디오 베스트 프레임 이력 — recordedAt(촬영 메타) 기준 절대 시각 축 |
| `GET /v1/videos/{videoId}/bestframes/{frameId}/targets` | **(v1.5)** 비디오 프레임 대상 (targetId = v1.3 비디오 대상 targetId) |
| `GET /v1/videos/{videoId}/bestframes/{frameId}/image` | **(v1.5)** 비디오 베스트 프레임 이미지 바이너리 (카메라는 v1.1 frames 라우트 재사용) |
| `GET /v1/detections/{eventId}/face` | **(v1.6)** 감지 얼굴 크롭 바이너리 — 감지 이벤트 faceUrl의 대상. faceUrl null인 이벤트는 404. 보존은 snapshot과 동일 |
| `POST /v1/persons/reid-search` | **(v1.7)** Re-ID 인물 검색 — 이미지 업로드(face/body) 또는 `vipId` 참조 + 필터(기간·유사도·카메라·성별·복장·소지품) 전부 모듈 적용 → 유사도 내림차순 상위 최대 20 (빈 결과 허용, 동기 60초) |
| `POST /v1/targets/associates` | **(v1.8)** RedFace 동반 감지 인물 목록 — primary target 참조(source + targetId=감지 eventId) + 기간 → 같은 프레임에 함께 감지된 인물 상위 최대 30 (coCaptures 내림차순, 빈 결과 허용, 동기 60초) |
| `POST /v1/targets/associate-evidence` | **(v1.8)** Joint Evidence — 페어(targetId + associateId) 동반 감지 집계 요약 (총 횟수·최초/최종·최다 장소·주 시간대 비율·장소별 최근 5건, 동기 60초) |
| `POST /v1/targets/associate-frames` | **(v1.10)** RedFace Shared frames — 페어의 동시 포착 프레임 페이징 목록(최신순, page/size 쿼리 + locationId/bucket 필터). totalElements == coCaptures, imageUrl은 기존 카메라 프레임 라우트 재사용, 두 인물 bbox(0~1, 미검출 null), 동기 60초 |
| `PUT /v1/provision/cameras` | **(v1.9)** 카메라 provisioning — **호출 주체가 VCA Admin 백엔드인 유일한 엔드포인트.** 전체 목록 선언적 멱등 교체: 새 카메라는 분석 시작, 빠진 카메라는 중단 + retained 토픽 삭제 |
| `PUT /v1/provision/vips` | **(v1.11 초안 — 협의 대기)** VIP 원장 provisioning — Admin 호출. 전체 목록 멱등 교체, photoUrl(Admin 내부 URL)에서 사진 수신·임베딩, photoUpdatedAt 변경 시 재임베딩, 빠진 인물은 매칭 제외 |
| `GET /v1/provision/vips/status` | **(v1.11 초안)** 인물별 임베딩 상태(none/pending/ready/failed + 사유) + 중복 얼굴 쌍 — Portal registry-health 원천 |
| `GET /v1/vips/activity` | **(v1.11 초안)** 최근 days일 목격된 인물 요약 — 명단 도달률(detectedLast7d) |
| `PUT /v1/ingest/videos/{videoId}` · `DELETE` | **(v1.11 초안 — 협의 대기)** 업로드 비디오 전달(multipart, Admin 발급 id, 재전송=교체) → 202 processing. 삭제 멱등 |
| `PUT /v1/ingest/images/{imageId}` · `DELETE` | **(v1.11 초안)** 업로드 이미지 전달 — 동기 200 또는 비동기 202 |
| `GET /v1/ingest/status` | **(v1.11 초안)** 업로드 분석 상태 일괄(ids 선택) — Admin 폴링, targetCount(Analysed N faces) |

지킬 규칙:

1. **응답은 데이터 그대로** — envelope 없음 (envelope은 프록시가 씌운다). 오류는 HTTP 상태코드 + `{ "code": "MOD-XXXX", "message": "..." }`
2. **MQTT 발행 값과 일관성** — `eventId`는 MQTT 감지 이벤트와 동일한 값 (브라우저가 두 채널을 이 값으로 병합한다). 카메라 status·locationId·좌표도 MQTT 발행분과 같아야 함
3. **날짜 파라미터** 기본값은 사이트 로컬(Asia/Singapore) 오늘, 응답의 시각 필드는 ISO-8601 UTC
4. **성능 분리** — 조회 서빙이 프레임 분석 성능에 영향을 주지 않도록 분리(프로세스 또는 저장소). 프록시는 5초 타임아웃으로 호출하므로 통상 2초 이내 응답 목표 (예외: v1.2 인물 검색·v1.4 Track on Map·v1.7 Re-ID 검색·v1.8 동반 감지 집계 2종은 60초)
5. **보존 기간** — 최소 당일+전일 데이터는 조회 가능해야 함 (증감 계산·date 파라미터 지원 범위). 장기 보존 정책은 모듈 재량

### (v1.2) REDMAP 인물 검색 — 구현 전 알아둘 것

- **동기 처리 가정** — 검색은 단일 요청/응답이고 프록시가 60초 타임아웃으로 기다린다.
  구현상 60초를 넘길 수 있다면(전체 보존 구간 영상 검색 등) **비동기 job 방식(요청→jobId→폴링)으로
  계약을 바꿔야 하니 구현 착수 전에 계약 담당에게 알려 달라** — v1.2의 유일한 open question이다
- `similarity` 임계값은 face·body 점수에 **공통 적용** — 제공된 이미지 종류별 점수가 임계값 이상인 hit만 반환
- hit 간 경과시간(elapsed) 계산·표시는 프론트 몫 — 모듈은 `capturedAt`만 정확히 주면 된다
- `faceUrl`/`bodyUrl`도 모듈 상대경로 규칙(아래 URL 경로 규칙)을 따른다 — hit 크롭은 검색 응답 후 최소 1시간 서빙
- **차량 번호 검색(REDMAP VEHICLE 모드)은 구현 방식 미확정으로 v1.2 범위에서 제외** — 확정 시 별도 계약으로 추가된다 (UV-34 메모)

### (v1.3) BEST FRAME Video/Image list — 구현 전 알아둘 것

- **업로드는 타 서비스 책임** — 모듈은 업로드된 미디어를 저장·분석하고 이 조회 API로 서빙만 한다.
  업로드 경로/프로토콜은 이 계약 범위 밖 (별도 협의)
- **비디오 재생 방식 = MP4 + 오버레이** — 브라우저 video 태그가 `/videos/{id}/content`를 직접
  재생하고, `/videos/{id}/frames`의 시간 인덱스 대상(bbox)을 currentTime에 동기화해 화면이
  오버레이한다. 따라서:
  - **HTTP Range(206 Partial Content) 지원 필수** — 없으면 시킹·배속이 동작하지 않는다
  - **브라우저 재생 가능한 H.264 MP4 서빙은 모듈 책임** — 원본 코덱이 다르면 분석 시
    트랜스코딩해 보관할 것 (협의 필요 시 계약 담당에게)
- `frames`는 화면이 재생 진행에 따라 구간 단위(기본 60초, 최대 300초)로 나눠 조회한다 —
  전체 영상 인덱스를 한 번에 반환할 필요 없음. 대상이 검출된 분석 프레임만 포함
- `frames.objects[].targetId` = `/videos/{id}/targets`의 targetId — 화면이 오버레이와
  타깃 패널을 이 값으로 연결하므로 반드시 같은 추적 ID를 써야 한다
- analysisStatus가 `ready`가 되기 전에는 content/frames/targets가 조회되지 않아도 된다
  (화면이 processing 항목을 선택 불가로 막는다)

### (v1.4) Track on Map — 구현 전 알아둘 것

- **요청은 대상 참조만** — `{ source: { type: camera|video|image, id }, targetId }`. 이미지 업로드
  없음: targetId는 모듈이 발급한 값(camera는 감지 eventId, video/image는 v1.3 targetId)이므로
  모듈이 보관 중인 대상 임베딩으로 직접 검색한다
- **시간 창·유사도는 모듈 소유 정책** — 대상이 track된 사이트 로컬(Asia/Singapore) **당일 00:00 →
  그 대상의 tracked 시각**, 유사도 **0.9 고정**. 요청에 override 파라미터가 없고, 실제 적용값을
  응답 `applied`(from/to/similarity)로 에코한다 — 화면이 유사도 90%·검색 날짜 표시에 그대로 쓴다
- **기준 대상 자신의 감지를 hits 마지막 항목으로 반드시 포함** — 화면 경로의 종점(LAST SEEN)이
  된다. 당일 추가 목격이 없어도 빈 배열이 아니라 기준 감지 1건을 반환
- hits 형태·규칙은 v1.2 `PersonSearchHit`와 동일 (capturedAt 오름차순, faceUrl/bodyUrl 상대경로,
  크롭 응답 후 최소 1시간 서빙). `target`(label/category/cropUrl)은 화면 "Tracing: …" 라벨용
- 동기 처리·60초 타임아웃은 v1.2 인물 검색과 동일 — 초과 예상 시 비동기 전환을 계약 담당과 협의

### (v1.5) Analyze Frame 베스트 프레임 이력 — 구현 전 알아둘 것

- **분(minute) 단위 창** — date(사이트 로컬, 기본 오늘)·hour(0~23)·minute(0~59)이 지정하는 1분의
  베스트 프레임을 반환한다. **모듈이 내부적으로 초당 몇 장을 보관하든(예: 2~3장) 초당 1장을
  대표로 선정**해 최대 60장, capturedAt 오름차순. 프레임이 없는 초는 항목을 만들지 않는다
- **targetId는 기존 ID 체계 재사용이 핵심 상호운용 규칙** — 카메라 프레임 대상은 **감지
  eventId**(크롭 = `/detections/{eventId}/snapshot`), 비디오 프레임 대상은 **v1.3 비디오 대상
  targetId**(크롭 = 기존 crop 라우트). 화면이 이 값을 Track on Map(v1.4)에 그대로 전달하므로
  반드시 track-on-map이 역참조할 수 있는 값이어야 한다
- **업로드 비디오는 recordedAt(촬영 시작 메타, VideoItem v1.5 필드) 기준 절대 시각 축** —
  요청한 분 창이 클립 구간과 겹치는 초만 반환, recordedAt이 null이면 빈 frames 배열
- `categories`는 프레임에 존재하는 대상 카테고리의 중복 제거 목록 — 화면 타임라인의
  카테고리 레인(왕관/차량) 표시용
- `analysis`(basic/top/bottom/addons)는 표시용 태그 문자열 그룹 — 아는 항목만 채우면 된다
  (분석 전이면 null). 화면 AI Inspection Detail이 그대로 그린다
- 보존: 최소 당일+전일 (공통 규칙) — 화면 날짜 선택지가 이 범위다

### (v1.6) DATA Live Monitoring — 구현 전 알아둘 것

- **새 API는 얼굴 크롭 1종뿐** — 화면 자체는 기존 감지 스트림(MQTT `detections`)과 기존 REST
  (`GET /cameras/{id}/detections`)를 그대로 쓴다. 할 일은 감지 이벤트(MQTT·REST 동일 구조)에
  `faceUrl`·`gender`·`age`를 채우는 것
- 화면은 **인물 카테고리만** 카드로 렌더한다 (vehicle·false_positive는 무시) — 차량 이벤트에는
  세 필드 모두 `null`이면 된다
- 얼굴 미검출 인물은 `faceUrl: null` — 화면이 얼굴 인셋 없이 렌더한다 (오류 아님)

### (v1.7) Re-ID 인물 검색 — 구현 전 알아둘 것

- **검색 대상 지정은 두 방식 중 하나 필수**: ① multipart 이미지(face·body 중 1개 이상)
  ② `vipId` 쿼리 파라미터 — 모듈 보관 등록 사진 임베딩으로 검색 (v1.4처럼 업로드 없는 참조
  방식). vipId가 오면 이미지는 무시
- **필터는 전부 모듈 책임** — 기간(from/to)·similarity 임계값·cameraId·gender·
  apparel(trousers/shorts/skirts/short_sleeve/long_sleeve)·props(bag/hat/glasses).
  apparel/props 배열은 "이 중 하나 이상 해당"(OR). 프론트는 후처리하지 않는다
- 응답은 **유사도 내림차순 상위 maxResults(기본·최대 20)** — 조건에 맞는 매치가 없으면 빈
  `results` (오류 아님). 실제 적용한 기간·임계값은 `applied`로 에코
- **`targetId`는 감지 eventId와 동일 값이어야 한다** — 화면이 이 값으로 ① 팝업 이동 경로
  (v1.4 track-on-map 재호출), ② Analyze Frame 딥링크(카메라+capturedAt의 분), ③ 크롭 조회
  (`/detections/{id}/snapshot`·`/face`)를 전부 해결한다. 새 ID 체계를 만들면 셋 다 깨진다

### (v1.8) RedFace 동반 감지 분석 — 구현 전 알아둘 것

- **화면의 후보 검색은 v1.7 reid-search 재사용** — v1.8의 새 계약은 집계 2종뿐이다.
  primary target 참조는 v1.4와 같은 `{ source, targetId }` 방식 (targetId = 감지 eventId)
- **동료 목록은 기간 내 같은 프레임 동반 감지의 인물 단위 집계** — coCaptures 내림차순
  **상위 최대 30명**만 반환. Zone 분류(>100 / 10~99 / <10)·최소 횟수·정렬·이름 검색은
  화면이 로컬 처리하므로 모듈은 필터 파라미터가 없다. 기간 생략 시 최근 7일 (`applied` 에코)
- **`associateId`는 모듈 발급 인물 키** — 같은 조건에서 같은 인물이면 같은 값이어야 하고
  (상세 조회의 참조 키), 응답 후 최소 1시간 유효. `faceUrl`은 신규 라우트가 아니라 **대표
  동반 감지의 기존 크롭 라우트**(`/detections/{eventId}/face`, 얼굴 미검출 대표면 `/snapshot`)
- **Joint Evidence는 집계 요약** — 원본 이벤트 전량이 아니라 총 횟수·최초/최종 시각·
  최다 동반 장소·주 시간대(비율)·장소별 최근 5건 표본만. 통계는 전수 데이터를 가진 모듈
  책임이고 화면은 문구 조립만 한다. `totalEvents`는 목록의 `coCaptures`와 같은 값이어야 한다
- 시간대 구분(사이트 로컬): morning 05~12 / afternoon 12~17 / evening 17~21 / night 21~05

### (v1.10) RedFace Co-capture evidence 실데이터 — 구현 전 알아둘 것

- **v1.8의 additive 확장 + 신규 1종.** 목록(associates 행)에 `locations`(고유 장소 수)·
  `peakPeriod{bucket,count}`, 집계(evidence)의 `pattern.peakPeriod`에 `count`가 추가됐고,
  페어의 동시 포착 프레임을 페이징으로 주는 `POST /targets/associate-frames`가 신설됐다
- **정합 규칙(검증 포인트)이 촘촘하다** — 목록·집계·프레임이 같은 전수 데이터에서 나와야 한다:
  ① 목록 `coCaptures` == 집계 `totalEvents` == 프레임 `totalElements`(무필터)
  ② 목록 `locations` == 집계 `locations` 그룹 수, 목록 `peakPeriod` == 집계 `pattern.peakPeriod`
  ③ 목록 `topCamera` == 집계 `pattern.topLocation` (카메라·count 동일)
  ④ 프레임의 장소별 건수 합계 == 집계 그룹 count, 프레임 min/max capturedAt == first/lastSeenAt
  ⑤ `locationId`/`bucket` 필터 적용 시 totalElements가 각각 해당 그룹 count·peakPeriod.count와 일치
- **프레임 이미지는 신규 라우트가 아니다** — 기존 `/cameras/{cameraId}/frames/{frameId}`(v1.1)의
  상대경로를 imageUrl로 재사용한다. targetBox/associateBox는 그 프레임 내 두 인물의 0~1 bbox,
  검출 실패 시 null(화면은 박스 없이 렌더)
- bucket 판정은 capturedAt의 사이트 로컬(Asia/Singapore) 시간대 기준 — v1.8과 동일 구분

### (v1.9) 카메라 provisioning — 구현 전 알아둘 것

- **카메라 원장은 VCA Admin DB가 단일 원천**이 된다 (`vca` 모노레포 `docs/design-vca-admin.md`,
  UV-41/UV-42). 모듈은 카메라를 자체 설정하지 않고 Admin 백엔드가 내려주는
  `PUT /v1/provision/cameras`의 목록만 분석한다 — 다른 모든 엔드포인트는 프록시가 호출하지만
  **이것만 Admin 백엔드가 호출**한다
- **선언적 전체 교체 + 멱등** — 부분 patch가 아니라 매번 전체 목록이 온다. 목록에 새로 들어온
  카메라는 RTSP 접속·분석 시작, 빠진 카메라는 원장에서 삭제된 것이므로 분석을 중단하고 해당
  카메라의 **retained 토픽(status·stats·bestframe)을 빈 페이로드로 삭제**한다 (SPEC §1 규칙).
  같은 본문을 재전송해도 결과가 같아야 한다. Admin은 기동 시에도 1회 push하므로 모듈이
  재기동으로 목록을 잃어도 수렴된다
- **`GET /v1/cameras`·`/v1/locations`는 provisioning 수신 후 그 목록 기준의 "분석 중 카메라
  뷰"**가 된다. 수렴 결과 보고는 기존 채널 그대로 — MQTT `cameras/{id}/status` (신규 토픽 없음)
- **rtspUrl은 자격증명이 포함될 수 있는 민감정보** — 모듈 내부에만 보관하고 어떤 조회
  응답·MQTT 발행에도 포함하지 않는다
- 카메라 종류는 단순 CCTV만 — AI Camera·Associated Server 필드는 없다 (도입 시 additive 확장,
  설계 확정 2026-08-27)

### (v1.11 초안 — 협의 대기) VIP 원장 provisioning · 업로드 ingest — 구현 전 알아둘 것

> **이 절은 초안이다.** 계약 확정 전에 모듈 담당과 아래 "협의 질문"을 먼저 맞춘다. 배경: VCA Portal(관리
> 콘솔) 도입으로 "모듈이 모든 정보를 반환한다"는 초기 약속이 **"원장(사람이 등록하는 것)은 Admin,
> 분석 파생은 모듈"**로 재정의되었다 (`vca` 레포 `docs/design-vca-portal.md` §1.1). 카메라(v1.9)가 첫
> 적용이었고, v1.11은 그 패턴을 VIP와 업로드에 확장한다. **기존 조회·서빙 계약(GET /vips, /videos,
> /images 계열)은 전부 그대로** — 원천이 provisioning/ingest로 바뀌는 것뿐이다.

**A. VIP 원장 → `PUT /v1/provision/vips`** (카메라 v1.9와 같은 패턴)
- Portal에서 등록·수정·삭제·그룹 배정이 일어날 때마다 Admin이 **전체 목록**을 내려보낸다. 새 vipId →
  `photoUrl`에서 사진을 받아 임베딩, 빠진 vipId → 매칭 제외 + 임베딩 폐기, `photoUpdatedAt` 변경 → 재임베딩.
  같은 본문 재전송은 결과 동일(멱등). 기동 시 Admin이 1회 push하므로 재기동으로 목록을 잃어도 수렴
- `photoUrl`은 **Admin 내부 절대 URL** — 모듈→Admin 네트워크 도달이 전제. 받은 사진의 사본을 보관해
  기존 `GET /vips/{vipId}/photo`를 계속 서빙한다(브라우저 계약 불변). null = 사진 없음(매칭 불가)
- **vipId 발급 주체 = Admin** (`vip-{슬러그}-{4hex}`). MQTT detections의 `vip.vipId`와 `GET /vips`의 vipId가
  이 값이어야 대시보드·Portal이 같은 사람을 가리킨다
- 임베딩은 비동기여도 된다 — 상태는 `GET /v1/provision/vips/status`(none/pending/ready/failed + 사유)로
  답하고, 같은 얼굴이 두 번 등록됐다고 판정되면 `duplicates`에 vipId 쌍을 실어 준다(합치기는 사람 결정).
  `GET /v1/vips/activity?days=7`은 최근 목격된 인물만 요약 — Portal의 "아무도 안 걸리는 명단" 경고용
- `Vip` 스키마 additive: type/priority/groupId/groupName/projectId/embeddingStatus. v1.11 미구현 모듈은
  생략 가능 — 구독자(프록시·화면)는 없는 필드를 null로 취급

**B. 업로드 → `PUT /v1/ingest/videos/{videoId}` · `/images/{imageId}`** (v1.3 "업로드는 타 서비스 책임"의 구체화)
- Admin이 원본을 저장(원장)하고 **분석용 사본을 multipart로 전달**한다. **id 발급 주체 = Admin**
  (`vid-…`/`img-…`) — 모듈은 이 id로 기존 v1.3/v1.5 조회 계약을 서빙한다. 같은 id 재전송은 교체(멱등)
- 수신 즉시 202 + `analysisStatus: processing` → ready/failed. 상태는 `GET /v1/ingest/status`(Admin 폴링,
  가벼운 뷰)와 기존 목록의 `analysisStatus`로. `targetCount`(검출 대상 수)가 VideoItem/UploadedImage에
  additive로 붙는다 — Portal "Analysed 14 faces"
- **재생 서빙(MP4 Range·트랜스코딩·썸네일·frames)은 v1.3대로 모듈 책임 유지** — 그래서 사본을 보관해야
  한다. 원본이 Admin·모듈 양쪽에 있는 저장 중복은 v1에서 수용
- `DELETE`는 Admin에서 삭제 시 — 사본·분석 결과·프레임 이력 폐기, 없는 id도 200

**협의 질문 (확정 전 답이 필요한 것)**
1. 사진/파일 전달 방식 — A안(현 초안): Admin URL에서 모듈이 pull(사진) / multipart push(업로드). B안: 공유
   스토리지 경로 전달(모듈이 로컬 파일로 읽음 — 저장 중복 없음). 모듈 배치 환경(같은 호스트? 별도 서버?)에 따라 결정
2. 임베딩 실패 사유 어휘 — no_face / multiple_faces / low_quality / unsupported_format / fetch_failed 로 충분한가
3. 중복 판정 임계값과 `duplicates` 산출 비용 — 등록 시점 1회 비교로 충분한가(N² 회피)
4. 업로드 용량 상한(413 MOD-4130)과 지원 컨테이너/코덱 — 화면 안내 문구에 필요
5. 이미지 ingest를 동기(200)로 할지 비동기(202)로 할지 — 모듈 처리 시간 기준
6. **(SPEC 제안, 별건)** 감지 이벤트에 `personType`(VIP|Tracking)·`trackingPath`를 additive로 실을 수 있는가 —
   현재 화면이 "같은 인물 2대 이상 카메라 = Tracking"을 클라이언트에서 추론하고 있어 서버(모듈) 판정으로
   옮기려는 것. 답에 따라 MQTT SPEC v1.7 초안 작성

## 참조 구현 (실행 가능)

`vca-mqtt-broker` 레포의 [`sim/sim.mjs`](https://github.com/shpark-univsai/vca-mqtt-broker/blob/main/sim/sim.mjs)가
**두 역할 모두의 참조 구현**이다 — MQTT 발행 5종 토픽과 **모듈 API 36개 엔드포인트 전부(v1.10 확정분 —
v1.11 초안 6종은 계약 합의 후 반영)**를
계약 그대로 구현한 Node 시뮬레이터. v1.3 비디오는 `sim/assets/`의 실제 H.264 MP4를 Range로
서빙하며, **frames의 bbox 수식이 MP4 속 박스 움직임과 동일**해 재생 오버레이가 영상 속 박스를
따라가는지 눈으로 검증할 수 있다 (수식·재생성 ffmpeg 명령은 sim.mjs 주석 참조). v1.2 인물 검색은 두 경로로 응답한다:
등록 VIP 사진(`/vips/{id}/photo`로 서빙되는 바이트)을 그대로 face로 업로드하면 **그 VIP의
실제 당일 감지 이력**을 반환하고(대시보드와 동일 원본 — 화면 간 교차 검증용), 그 외 이미지는
업로드 바이트 해시 기반 결정적 합성 경로를 반환한다 (같은 이미지 → 같은 결과). 발행 형식이나 응답 조립(행 = VIP별, `detections` 시간 오름차순,
MQTT와 동일 `eventId`, photoUrl 상대경로, 시간대 버킷, bestframe 메타+bbox)이 헷갈릴 때 이 코드가 정답이다.

```bash
cd sim && npm install && npm start   # MQTT 발행 + :8081 모듈 API 서빙
# 테스트 편의 환경변수: INTERVAL_MS(감지 주기), BESTFRAME_MS(bestframe 주기),
#   TOGGLE_P(카메라 상태 토글 확률, 0=고정), STOPPED_EVERY(초기 정지 간격, 0=전부 RUNNING)
```

이 참조 구현 + 실제 프록시 + 실제 대시보드 조합으로 **전 화면 E2E가 검증 완료**된 상태다 —
DASHBOARD(08-12), BEST FRAME(08-18), REDMAP(08-19), Video/Image·Track on Map(08-21),
Analyze Frame·DATA Live Monitoring(08-24), Re-ID Analysis(08-25), RedFace(08-26),
Admin provisioning(08-27), RedFace Co-capture evidence 실데이터(08-27 — 그리드 실값 컬럼·Shared frames 프레임/박스/필터/페이징). 즉 모듈이 이 계약대로만
구현하면 화면 연결에 추가 작업이 없다. 검증 과정에서 확인된 구현 포인트:

- **URL 경로 규칙 (혼동 주의)** — REST 응답의 리소스 URL(`photoUrl`, `snapshotUrl`)은
  **모듈 기준 상대경로**(`/vips/{vipId}/photo`, `/detections/{eventId}/snapshot`)로 반환한다.
  프록시가 `/api/...`로 재작성해서 브라우저에 전달하므로 모듈이 `/api`를 붙이면 안 된다.
  반대로 **MQTT 발행 페이로드**(`snapshotUrl`, bestframe `imageUrl`)는 프록시를 거치지 않으므로
  **모듈이 `/api` 프리픽스를 직접 붙여** 발행한다 (SPEC §3.2·§3.5)
- 이미지 응답(사진·프레임·스냅샷)은 `image/png` 또는 `image/jpeg` 바이너리 + `Content-Type` 헤더
  (프록시가 그대로 통과시킴). 프레임은 불변 URL이라 장기 Cache-Control 안전
- **Staff도 등록 인물 사진을 서빙**해야 한다 — 화면 팝오버의 ENROLLED DB가 category=staff의
  `vip.vipId`로도 `GET /vips/{vipId}/photo`를 호출한다 (`/vips` 목록 포함 여부와 무관)
- `bbox`는 0~1 정규화 (픽셀 좌표 아님) — 화면이 어떤 크기로 렌더하든 그대로 비율 적용된다
- bestframe은 **retained** — 화면이 카메라를 선택하는 순간 마지막 프레임을 즉시 받는 초기화 수단
- `detection-topology`의 `average`는 7일 데이터가 없으면 `null` 허용 (계약의 nullable — 프론트는 null 안전)
- 시간 버킷(`hour`)은 **사이트 로컬(Asia/Singapore) 기준** — UTC로 버킷하면 그래프가 8시간 밀린다

## 구현 검증 방법

### MQTT 발행

브로커를 로컬 기동한 뒤, 발행이 규약대로 나가는지 CLI로 확인할 수 있다:

```bash
# 전체 토픽 구독해서 모듈 발행 내용 확인
docker run --rm --network vca-mqtt-broker_default eclipse-mosquitto:2 \
  mosquitto_sub -h emqx -t 'vca/v1/sg/#' -v
```

- EMQX 대시보드(http://localhost:18083, admin/public)에서 접속 클라이언트·토픽별 트래픽 확인 가능
- 체크리스트:
  - [ ] 기동 직후 전체 카메라 status가 retained로 발행되는가
  - [ ] 새 구독자가 붙었을 때 status/stats/summary/bestframe을 즉시 받는가 (retained 확인)
  - [ ] 감지 이벤트의 eventId가 건마다 고유한가
  - [ ] 자정(SGT) 리셋 후 카운터가 재발행되는가
  - [ ] deltaRate가 전일 0일 때 null인가
  - [ ] (v1.1) bestframe이 초당 1회 발행되고, objects의 eventId가 detections 발행분과 일치하는가
  - [ ] (v1.1) MQTT의 snapshotUrl/imageUrl에 `/api` 프리픽스가 붙어 있는가
  - [ ] (v1.1) category=vip 외 이벤트에서 vip 필드가 null인가 (vehicle/attributes도 카테고리에 맞게)

### 모듈 API

```bash
# 응답이 module-api.json 계약대로 나오는지 직접 확인 (envelope 없어야 정상)
curl "http://localhost:8081/v1/dashboard/live-analytics?page=0&size=20&type=ALL"
```

- 체크리스트:
  - [ ] 응답에 `{success, data}` 포장이 **없는가** (envelope은 프록시 몫)
  - [ ] 행의 `detections[].eventId`가 MQTT 발행분과 같은 값인가
  - [ ] `detections`가 시간 오름차순인가
  - [ ] 미지원 경로가 `{ "code": "MOD-XXXX", "message": ... }` 형태로 오류를 주는가
  - [ ] (v1.1) `/v1/cameras/{id}/detections`가 최신순이고 REST 응답의 snapshotUrl은 모듈 상대경로인가
  - [ ] (v1.1) bestframe `imageUrl`의 frameId로 `/v1/cameras/{id}/frames/{frameId}`가 이미지를 주는가
  - [ ] (v1.1) staff의 `vip.vipId`로도 `/v1/vips/{vipId}/photo`가 사진을 주는가
  - [ ] (v1.2) `/v1/persons/search`에 face·body 둘 다 없으면 400 `MOD-XXXX`를 주는가
  - [ ] (v1.2) hits가 capturedAt 오름차순이고 faceUrl/bodyUrl이 모듈 상대경로인가
  - [ ] (v1.2) 검색 응답 후 1시간 내 hit 크롭 이미지가 조회되는가 (만료 시 404)
  - [ ] (v1.3) `/v1/videos/{id}/content`가 Range 요청에 206 + Content-Range·Accept-Ranges를 주는가
  - [ ] (v1.3) frames가 t 오름차순·대상 있는 프레임만이고, objects[].targetId가 targets와 일치하는가
  - [ ] (v1.3) 목록 URL 필드(imageUrl/contentUrl/thumbnailUrl/cropUrl)가 전부 모듈 상대경로인가
  - [ ] (v1.3) processing 상태 비디오가 목록에 나오되 durationSec/thumbnailUrl이 null인가
  - [ ] (v1.6) 인물 감지에 faceUrl/gender/age가 실리고 차량은 셋 다 null인가 (MQTT는 /api 프리픽스, REST는 상대경로)
  - [ ] (v1.6) faceUrl null인 이벤트의 `/v1/detections/{id}/face`가 404를 주는가
  - [ ] (v1.7) `/v1/persons/reid-search`에 vipId·face·body 모두 없으면 400, 미등록 vipId면 404인가
  - [ ] (v1.7) results가 유사도 내림차순·최대 20건이고 targetId가 감지 eventId와 같은 값인가 (track-on-map 역참조 가능)
  - [ ] (v1.8) associates가 coCaptures 내림차순·최대 30명이고 faceUrl이 기존 감지 크롭 라우트인가
  - [ ] (v1.8) 같은 조건에서 associate-evidence의 totalEvents가 목록 coCaptures와 같고, locations count 합계 = totalEvents인가
  - [ ] (v1.8) 다른 대상의 associateId로 evidence를 조회하면 404인가
  - [ ] (v1.9) `PUT /v1/provision/cameras` 수신 후 `/v1/cameras`가 그 목록과 일치하고, 새 카메라의 status가 RUNNING retained로 발행되는가
  - [ ] (v1.9) 목록에서 빠진 카메라의 retained 토픽(status·stats·bestframe)이 빈 페이로드로 지워지는가
  - [ ] (v1.9) 같은 본문을 두 번 보내도 상태 변화·중복 발행이 없는가 (멱등)
  - [ ] (v1.10) 목록 coCaptures == 집계 totalEvents == 프레임 totalElements이고, 목록 locations/peakPeriod/topCamera가 집계와 일치하는가
  - [ ] (v1.10) 프레임이 capturedAt 내림차순이고 min/max가 first/lastSeenAt과 같으며, 장소별 건수 합계가 집계 그룹 count와 같은가
  - [ ] (v1.10) locationId/bucket 필터의 totalElements가 각각 topLocation.count·peakPeriod.count와 일치하는가 (필터 값이 그 peak일 때)

### 대시보드 E2E

VCA 프록시(`vca/backend/proxy`)를 모듈 API로 향하게 띄우면 화면에서 눈으로 확인된다:

```bash
cd vca/backend/proxy && VCA_MODULE_API_BASE_URL=http://localhost:8081/v1 ./gradlew bootRun
```

대시보드 웹(vca/frontend, `npm run dev`) 접속 후 — MQTT 발행이 실시간으로 목록·지도에 반영되고,
**새로고침하면 모듈 API 스냅샷으로 당일 이력이 복원**되면 두 채널 모두 계약대로 동작하는 것이다.
