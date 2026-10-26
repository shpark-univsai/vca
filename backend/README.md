# backend/

백엔드 코드 위치. 담당: 백엔드 개발자.

## 구성

| 디렉토리 | 내용 |
|---|---|
| `proxy/` | **VCA 프록시 백엔드** (Spring Boot 4, Java 21, WebFlux). 브라우저 `/api` 요청을 모듈 API로 중계 — envelope 변환, 오류 매핑, 타임아웃. DB 없음 (데이터 저장·집계는 모듈 책임) |
| `vca-mqtt-broker/` | EMQX 브로커 구성 — **별도 레포** ([GitHub](https://github.com/shpark-univsai/vca-mqtt-broker), 중첩 클론이라 vca 저장소에는 커밋되지 않음) |

전체 구조와 프록시 변환 규칙: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
계약: [openapi/openapi.json](../openapi/openapi.json) (브라우저↔프록시) · [openapi/module-api.json](../openapi/module-api.json) (프록시↔모듈)

## 프록시 실행

```bash
cd proxy
./gradlew bootRun    # 포트 8080, 모듈 API 기본 http://localhost:8081/v1
```

- 모듈 API 주소 변경: 환경변수 `VCA_MODULE_API_BASE_URL`
- 헬스체크: `GET /actuator/health`
- 프론트 dev 서버(vite)는 `/api`를 `localhost:8080`으로 프록시하도록 이미 설정되어 있다
