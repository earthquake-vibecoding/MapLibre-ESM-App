import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHistoryStore, createHistoryApp } from './history.mjs';

const tmpDirs = [];
function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'eqm-hist-'));
  tmpDirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const body = {
  start: Date.UTC(2026, 10, 7, 3, 0, 0),
  end: Date.UTC(2026, 10, 7, 3, 0, 25),
  count: 3,
  maxJindo: 2.3,
  scaleLabel: '3',
  color: '#00BFFF',
  center: [140.5, 36.1]
};

describe('createHistoryStore', () => {
  it('추가/최신순/상한/중복 제거', () => {
    const s = createHistoryStore(tmpDir(), 2);
    expect(s.add(body)?.id).toBe(body.start);
    s.add({ ...body, start: 2000 });
    s.add({ ...body, start: 3000 });
    expect(s.items().map(e => e.id)).toEqual([3000, 2000]); // 상한 2 — 오래된 것 잘림
    s.add({ ...body, start: 2000 }); // 중복(id 동일) → 맨 앞으로, 개수 유지
    expect(s.items().map(e => e.id)).toEqual([2000, 3000]);
  });

  it('무효 바디 거부', () => {
    const s = createHistoryStore(tmpDir(), 5);
    expect(s.add({})).toBeNull();
    expect(s.add(null)).toBeNull();
    expect(s.items().length).toBe(0);
  });

  it('파일 영속 — 새 스토어가 재로드', async () => {
    const dir = tmpDir();
    createHistoryStore(dir, 5).add(body);
    await new Promise(r => setTimeout(r, 50)); // 비동기 persist 완료 대기
    expect(createHistoryStore(dir, 5).items().length).toBe(1);
  });
});

describe('history HTTP 엔드포인트', () => {
  it('GET / 목록, POST /detect는 폐지(404)', async () => {
    const store = createHistoryStore(tmpDir(), 100);
    store.add(body);
    const app = createHistoryApp(store);
    const srv = app.listen(0);
    const base = `http://localhost:${srv.address().port}`;
    const list = await fetch(base).then(r => r.json());
    expect(list.items.length).toBe(1);
    const post = await fetch(`${base}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    expect(post.status).toBe(404); // 무인증 쓰기 엔드포인트 — 존재하지 않음
    srv.close();
  });
});
