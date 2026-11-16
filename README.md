# 일본 지진 & EEW 실시간 모니터 (eqm)

일본 기상청(JMA) 강진모니터(kmoni) 실측 프레임 기반 지진 감지 + P2PQuake/Wolfx EEW 릴레이 모니터.

## 아키텍처

- **렌더러** (`src/`): Svelte 5 + Vite 7 + MapLibre GL + Tailwind v4. 서버의 SSE(`/api/events`)를 구독해 그리는 순수 클라이언트 — 감지 판정 없음.
- **서버** (`server/`): Node + express 단일 서비스. kmoni 프레임 1Hz 폴러 + 프레임 버퍼(`frame-buffer.mjs`), 감지 파이프라인(`detect-entry.ts` → esbuild 번들 `detect-core.mjs`), Discord 웹후크, wolfx/p2p WS 피드 릴레이 전부 담당.
- **감지음**: kmoni 실측 계측진도 기반 (shi0 비프 + 계급 상승 시 shiN 샘플).

## 실행

```bash
pnpm install        # pnpm 전용 — npm 사용 금지 (lockfile이 pnpm-lock.yaml 하나)
pnpm dev            # 개발 서버 http://localhost:3000
pnpm build && pnpm start   # 프로덕션 (node server/index.mjs, PORT 기본 3000)
pnpm check          # svelte-check
pnpm test           # vitest
```

## 환경 변수

`.env.example` 참고 — `WEBHOOK_URL`(Discord 감지 리포트)만 있으면 동작. 미설정 시 리포트만 비활성.

## 배포

`scripts/deploy.sh`는 로컬 전용(서버 IP 포함, git 추적 안 함) — 원자적 교체로 오라클 오사카 서버의 systemd 서비스 `eqm`을 재시작.
