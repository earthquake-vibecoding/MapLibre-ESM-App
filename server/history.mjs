// 감지 에피소드 서버 기록 — 클라이언트 detector가 판정한 에피소드를 POST로 받아 data/history-detect.json에 적재.
// Discord 릴레이(webhook.mjs)와 독립: 웹후크가 꺼져도 기록은 항상 남는다 (아키텍처 A: 감지는 클라이언트, 기록은 서버).
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

  function persist() {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ items }));
    } catch (err) {
      // 읽기전용 cwd(Electron 패키지 등) — 메모리 기록만 유지하고 서비스는 계속
      console.warn('[History] persist 실패 (메모리만 유지):', err?.message ?? err);
    }
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

export function createHistoryApp(store) {
  const app = express();
  app.use(express.json({ limit: '8kb' }));

  app.get('/', (req, res) => {
    res.json({ items: store.items() });
  });

  app.post('/detect', (req, res) => {
    const entry = store.add(req.body);
    if (!entry) return res.status(400).json({ error: 'Invalid payload' });
    res.status(201).json({ saved: entry.id });
  });

  return app;
}

export default createHistoryApp(createHistoryStore(path.join(process.cwd(), 'data')));
