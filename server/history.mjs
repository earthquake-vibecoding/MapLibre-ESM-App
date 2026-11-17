// 감지 에피소드 서버 기록 — detect-runner.mjs가 판정한 에피소드를 data/history-detect.json에 적재.
// Discord 릴레이(webhook.mjs)와 독립: 웹후크가 꺼져도 기록은 항상 남는다 (감지·기록 모두 서버 소관).
// 적재는 서버 내부(detect-runner) 전용 — HTTP 쓰기 엔드포인트는 무인증 위조 경로라 두지 않는다.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { validateDetect } from './webhook.mjs';

const MAX_ENTRIES_DEFAULT = 100;

/** 순수 저장소 — 파일 로드/적재/상한 관리. dir은 cwd 기준(배포: WorkingDirectory/data) */
export function createHistoryStore(dir, maxEntries = MAX_ENTRIES_DEFAULT) {
  const file = path.join(dir, 'history-detect.json');
  let items = [];
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (Array.isArray(json?.items)) {
      items = json.items.filter(e => e && typeof e.id === 'number').slice(0, maxEntries);
    }
  } catch {
    // 최초 실행/손상 파일 — 빈 배열로 시작
  }

  // 이벤트 루프 블로킹 없이 비동기 기록 — 실패 시 메모리 기록만 유지하고 서비스는 계속
  function persist() {
    fs.promises.mkdir(dir, { recursive: true })
      .then(() => fs.promises.writeFile(file, JSON.stringify({ items })))
      .catch((err) => {
        // 읽기전용 cwd(Electron 패키지 등) — 메모리 기록만 유지하고 서비스는 계속
        console.warn('[History] persist 실패 (메모리만 유지):', err?.message ?? err);
      });
  }

  return {
    items: () => items,
    add(body) {
      const v = validateDetect(body);
      if (!v) return null;
      const entry = { id: v.start, ...v };
      items = [entry, ...items.filter(e => e.id !== entry.id)].slice(0, maxEntries);
      persist();
      return entry;
    },
  };
}

/** GET 전용 — 목록 조회. 쓰기는 서버 내부(detect-runner → getHistoryStore)로만 들어온다 */
export function createHistoryApp(store) {
  const app = express();

  app.get('/', (req, res) => {
    res.json({ items: store.items() });
  });

  return app;
}

let sharedStore = null;
/** 싱글턴 저장소 — 감지 러너가 서버 내부에서 직접 적재할 때 사용 (HTTP 경유 폐지) */
export function getHistoryStore() {
  if (!sharedStore) sharedStore = createHistoryStore(path.join(process.cwd(), 'data'));
  return sharedStore;
}

export default createHistoryApp(getHistoryStore());
