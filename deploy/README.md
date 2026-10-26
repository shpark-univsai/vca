# VCA 배포 묶음 — 개발서버 1단계 (UV-60)

한 대의 개발서버에 VCA 전체 스택을 `docker compose`로 올린다. 1단계는 **백엔드 + 현재 대시보드**이고,
포털 화면은 W3 반입 후 같은 `frontend` 이미지를 다시 빌드하면 올라온다(compose 변경 없음).

```
브라우저 ──:80──▶ frontend(nginx) ──/api──────▶ proxy:8080 ──▶ sim:8081 (분석 모듈 자리) ──▶ emqx:1883
                     │                             └──/api/auth, /api/portal──▶ admin:8082 ──▶ postgres · emqx · mediamtx API
                     └──/streams──▶ mediamtx:8889 (WebRTC/WHEP)
브라우저 ──:8083(ws)──▶ emqx  (감지·카메라 상태 실시간)
```

## 서버 요구

- Docker Engine 24+ 와 Docker Compose v2 (`docker compose version`)
- 여는 포트: **80** 웹, **8083** MQTT WebSocket, **8554** RTSP 수신, **8189/udp** WebRTC, 선택 **8080**(proxy 직접 호출), 18083(EMQX 콘솔, 기본 로컬 전용)
- 호스트에 열지 않는 것: postgres, admin(8082), MediaMTX 제어 API(9997), MQTT tcp(1883) — 컨테이너 네트워크 안에서만
- 이미지 빌드는 서버에서 한다(gradle·npm이 컨테이너 안에서 돈다). 첫 빌드 5~10분, 이후는 캐시

## 절차

```bash
git clone https://github.com/shpark-univsai/vca.git && cd vca
# 분석 모듈 자리(sim)는 별도 레포 — 모노레포 안에 중첩 클론한다 (vca .gitignore가 이 경로를 제외하므로 커밋되지 않음)
git clone https://github.com/shpark-univsai/vca-mqtt-broker.git backend/vca-mqtt-broker
cd deploy
cp .env.example .env
$EDITOR .env        # VCA_HOST(서버 IP/호스트명), VCA_ADMIN_ENC_KEY, VCA_ADMIN_SEED_PASSWORD, POSTGRES_PASSWORD
docker compose up -d --build
docker compose ps   # admin·proxy·frontend가 healthy/running이면 끝
```

- 웹: `http://<VCA_HOST>/` — 로그인 `admin@univs.ai` / `.env`의 `VCA_ADMIN_SEED_PASSWORD`(첫 로그인 후 변경)
- 첫 기동에 Flyway가 스키마를 만들고(V1 베이스라인 + V2…), 시드가 팀·프로젝트·초기 owner·카메라 8대(test-stream)를 넣는다
- 갱신: `git pull && docker compose up -d --build` — 바뀐 서비스만 다시 빌드·재시작. DB(`pg-data` 볼륨)는 유지되고 새 마이그레이션은 기동 시 적용
  - 이미지는 새로 빌드됐는데 컨테이너가 이전 이미지로 남아 있으면(`docker compose ps`의 Up 시간이 그대로) 한 번 더
    `docker compose up -d --no-build --force-recreate <service>` — 2026-09-10 frontend 갱신에서 실제로 발생(빌드 완료가 up 판단보다 늦게 끝난 경우)
- 로그: `docker compose logs -f admin proxy` / 재설정 코드(SMTP 없음)는 `admin` 로그에 찍힌다(`VCA_ADMIN_MAIL_DEV_LOG=true`)

## .env 항목

| 키 | 뜻 |
|---|---|
| `VCA_HOST` | 브라우저가 도달하는 서버 주소. MediaMTX WebRTC ICE 후보 — 틀리면 영상만 안 나온다 |
| `VCA_ADMIN_ENC_KEY` | 카메라 자격증명·SMTP 비밀번호 암호화 키. **한 번 정하면 바꾸지 않는다** |
| `VCA_ADMIN_SEED_PASSWORD` | 초기 owner 임시 비밀번호 |
| `POSTGRES_PASSWORD` | DB 비밀번호(admin이 같은 값을 쓴다) |
| `VCA_SITE_ID` | MQTT 토픽 `vca/v1/{siteId}/…` (기본 `sg`) |
| `VCA_MODULE_API_BASE_URL` | 실제 분석 모듈 주소. 비우면 `sim` 컨테이너. 실모듈 전환 시 `docker compose up -d --scale sim=0` |
| `HTTP_PORT` `PROXY_PORT` `EMQX_WS_PORT` `RTSP_PORT` `WEBRTC_UDP_PORT` | 호스트 포트. `127.0.0.1:` 접두로 로컬 전용 가능 |
| `VCA_MQTT_WS_URL` | 브라우저 MQTT 주소. 비우면 `ws://{접속 호스트}:8083/mqtt` — `EMQX_WS_PORT`를 바꿨거나 wss를 쓰면 지정 |
| `VCA_COOKIE_SECURE` | TLS 앞단이 생기면 `true` (http에서 true면 로그인 쿠키가 저장되지 않는다) |
| `VCA_ADMIN_MAIL_DEV_LOG` | 재설정 코드를 메일 대신 로그로. 운영 `false` |
| `VCA_ADMIN_SEED_CAMERAS` | 시드 카메라 8대. 실카메라 등록 시 `false` |

## 기획 Next.js 앱을 개발서버 API에 붙이기

브라우저에서 다른 오리진의 API를 부르면 세션 쿠키(SameSite=Lax)가 붙지 않는다. CORS를 열지 말고 **Next.js dev 서버가
같은 오리진으로 중계**하게 한다 — `next.config.js`:

```js
async rewrites() {
  return [
    { source: '/api/:path*', destination: 'http://<VCA_HOST>/api/:path*' },   // 또는 :8080 proxy 직접
    { source: '/streams/:path*', destination: 'http://<VCA_HOST>/streams/:path*' },
  ]
}
```

앱은 `API_BASE_URL=/api`만 쓰고, 실시간은 `ws://<VCA_HOST>:8083/mqtt`(EMQX WebSocket) — 모노레포 Vite SPA의 `src/lib/realtime/mqttClient`가
구독하는 토픽과 같다(`vca/v1/{siteId}/cameras/+/status`, `…/detections`). 반입(W3) 시 이 계층은 백엔드가 연결한다.

## 현재 개발서버 (vca-dev, 2026-09-09 1단계 배포 완료)

| 항목 | 값 |
|---|---|
| 호스트 | `192.168.0.135` (Ubuntu 24.04, 24코어/31GB), SSH 별칭 `vca-dev`(계정 univs, 키 `id_ed25519_vca_dev`) |
| 코드 | `~/platform/vca` (public, https) + `~/platform/vca/backend/vca-mqtt-broker` (private — 서버의 읽기 전용 배포 키 `github.com-vca-broker` 별칭으로 클론) |
| 웹 | **http://192.168.0.135:8088** — 80/8080/5432는 같은 서버의 `gate` 프로젝트가 사용하므로 8088/18080 사용 |
| proxy 직접 | http://192.168.0.135:18080 (기획 Next.js rewrites 대상) |
| MQTT WS | ws://192.168.0.135:8083/mqtt (config.js 기본값과 일치해 `VCA_MQTT_WS_URL` 비움) |
| RTSP / WebRTC | 8554 / 8189udp · EMQX 콘솔 127.0.0.1:18083 |
| 갱신 | `ssh vca-dev 'cd ~/platform/vca && git pull && git -C backend/vca-mqtt-broker pull && cd deploy && docker compose up -d --build'` |

첫 배포에서 배운 것: `VCA_ADMIN_SEED_PASSWORD`가 비밀번호 규칙(8자+영문+숫자+특수문자)에 어긋나면 admin이 기동 직후
종료·재시작을 반복하고 proxy·frontend가 올라오지 않는다 — `docker compose logs admin`에 `password must be at least 8 characters…`.

## 모의 CCTV — BEST FRAME에 실영상 카메라 1대 (UV-61)

실제 분석 모듈이 붙기 전 "동작하는 CCTV"를 보여주는 대역 경로다. `fake-cam2`(보행자 영상 무한 반복 RTSP) → `realcam`(YOLO 사람 추적 →
sim `/ingest` 실관찰 주입 + 박스 번인 스트림 `ann-{cameraId}`) → Admin 카메라 rtspUrl → MediaMTX → BEST FRAME 라이브 타일.
절차는 [backend/vca-mqtt-broker/sim/realcam/DEPLOY.md](../backend/vca-mqtt-broker/sim/realcam/DEPLOY.md) — 요약:

1. 영상·가중치 scp: `deploy/media/cam2.mp4`, `deploy/models/yolov8n.pt`·`face_yolov8n.pt` (git 미추적)
2. Admin에 카메라 등록(Portal Input Sources 또는 API) → `cameraId` → 같은 카메라의 rtspUrl을 `rtsp://127.0.0.1:8554/ann-{cameraId}`로 갱신
3. `.env`에 `REALCAM_CAMS={cameraId}=rtsp://mediamtx:8554/fake-street-src` → `docker compose up -d --build sim fake-cam2 realcam`
4. 확인: `docker compose logs realcam`(fps·tracks), `logs sim | grep ingest`, 브라우저 BEST FRAME → Normal network → 그 카메라

**sim을 재빌드·재기동하면 provisioning이 비어 있다.** sim은 카메라 목록을 메모리에만 들고 Admin은 자기 기동·카메라 변경 때만 push하므로,
sim만 다시 올린 뒤에는 `POST /api/portal/provision/sync`(owner 세션, Portal에서도 가능)를 한 번 호출해야 realcam의 ingest가 404에서 풀리고
카메라가 RUNNING으로 돌아온다 — 2026-09-10 첫 배포에서 실제 발생. 브라우저 확인은 LAN의 실제 브라우저로: BEST FRAME 사이드바 목록은 MQTT
WebSocket(:8083) 상태 메시지로 채워지므로, WebSocket이 막힌 환경(일부 샌드박스 브라우저)에서는 라이브 카메라가 목록에 나타나지 않는다.

realcam 베이스 이미지(ultralytics, 수 GB) 첫 빌드 수 분. 되돌리기: `docker compose rm -sf realcam fake-cam2` + Admin에서 카메라 삭제.

## 운영으로 갈 때 바꿀 것

- TLS 앞단(리버스 프록시) + `VCA_COOKIE_SECURE=true`, `VCA_MQTT_WS_URL=wss://…`
- `VCA_ADMIN_MAIL_DEV_LOG=false` + 팀/프로젝트 SMTP 설정
- `test-stream`·`sim` 제거, `VCA_ADMIN_SEED_CAMERAS=false`, 실카메라·실모듈 주소
- MediaMTX 인증 — [backend/admin/mediamtx.yml](../backend/admin/mediamtx.yml) 주석대로 publish/read 자격증명 제한
- EMQX 익명 접속 제한(현재 개발 기본), 콘솔 비밀번호 변경
- 이미지 태그 고정(`VCA_IMAGE_TAG`)과 레지스트리 푸시 — 지금은 서버에서 직접 빌드

## 로컬 개발과의 관계

로컬 개발은 그대로다 — `backend/admin/docker-compose.yml`(DB·MediaMTX·모의 카메라) + `./gradlew bootRun` ×2 + `node sim.mjs` + `npm run dev`.
이 디렉토리는 서버 배포 전용이며, 같은 Dockerfile을 쓰므로 로컬에서 전체 스택을 시험하려면 `.env`에 다른 포트를 주고
`docker compose -p vcatest up -d --build`로 별도 프로젝트 이름을 쓰면 로컬 컨테이너와 충돌하지 않는다.
