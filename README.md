# eqm — 일본 지진 · EEW 실시간 모니터

[English](README.en.md)

기상청 강진모니터(kmoni) 실측 프레임을 1Hz로 수신·감지하고, P2PQuake/Wolfx EEW를 릴레이하는 모니터.
서버가 감지·기록·푸시를 전부 수행하고, 화면은 SSE 스트림 하나를 그리기만 한다.

## 동작 개요

- **감지** — 서버가 kmoni 프레임을 초당 1장 수신(프레임 버퍼 캐시) → 픽셀 색을 계측진도로 환산 → 관측소별 상승률 판정. 판정 로직은 클라/서버 공용 코드를 esbuild 번들로 공유.
- **표시** — MapLibre 지도 위 예보구역 색칠, 관측소 점, P/S파 링, EEW 예상진도 마스크.
- **알림** — 감지 비프 + 계급 상승음(kmoni 실측 기반 샘플), EEW 음성, Discord 감지 리포트(시작 POST → 종료 PATCH 2단계), 브라우저 알림.
- **부재 복귀** — 절전/탭 이탈 후 복귀하면 버퍼의 프레임을 25fps 타임랩스로 되감기 재생.
- **기타** — 3개국어(ko/en/ja), 다크 모드, Electron 데스크톱(트레이 상주) 지원.

## 구조

```
src/      Svelte 5 렌더러 — SSE(/api/events) 구독 + 지도/음성/알림 (감지 판정 없음)
server/   Node + express — kmoni 폴러·감지·웹후크·피드 릴레이·API 전부
```

## 실행

[pnpm](https://pnpm.io) 전용 (npm 사용 금지 — lockfile이 `pnpm-lock.yaml` 하나).

```bash
pnpm install
pnpm dev                  # 개발 서버 — http://localhost:3000
pnpm build && pnpm start  # 프로덕션 (node server/index.mjs)
```

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 (감지 번들 포함) |
| `pnpm start` | 서버 실행 (`PORT` 기본 3000) |
| `pnpm check` | svelte-check |
| `pnpm test` | vitest |

## 환경 변수

`.env.example` 참고 — `WEBHOOK_URL`(Discord 감지 리포트) 하나뿐. 미설정 시 리포트만 비활성.
