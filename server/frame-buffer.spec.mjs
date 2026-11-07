import { describe, it, expect } from 'vitest';
import { createFrameBuffer } from './frame-buffer.mjs';

const GIF = Buffer.from('GIF89a0100');
const T0 = Date.UTC(2026, 10, 7, 3, 0, 5); // JST 2026-11-07 12:00:05

function makeBuffer(fetchImpl) {
  let clock = T0;
  return { fb: createFrameBuffer({ fetchImpl, now: () => clock }), tick: (ms) => { clock += ms; } };
}

describe('버퍼 put/get', () => {
  it('정확 키만 반환 — 다른 시각/kind는 미스', () => {
    const { fb } = makeBuffer();
    fb.put('20261107120003', 'jma_s', GIF);
    expect(fb.get('20261107120003', 'jma_s')).not.toBeNull();
    expect(fb.get('20261107120004', 'jma_s')).toBeNull();
    expect(fb.get('20261107120003', 'acmap_s')).toBeNull();
  });

  it('TTL 만료 후 미스', () => {
    const { fb, tick } = makeBuffer();
    fb.put('20261107120003', 'jma_s', GIF);
    tick(15 * 60_000 + 1);
    expect(fb.get('20261107120003', 'jma_s')).toBeNull();
  });

  it('cap 초과 시 가장 오래된 엔트리 퇴출', () => {
    const { fb } = makeBuffer();
    for (let i = 0; i < 505; i++) {
      fb.put(String(i).padStart(14, '0'), 'jma_s', GIF);
    }
    expect(fb.size()).toBeLessThanOrEqual(500);
    expect(fb.get('00000000000000', 'jma_s')).toBeNull();
    expect(fb.get('00000000000504', 'jma_s')).not.toBeNull();
  });

  it('빈 버퍼/비정상 입력 put 무시', () => {
    const { fb } = makeBuffer();
    fb.put('', 'jma_s', GIF);
    fb.put('20261107120003', '', GIF);
    fb.put('20261107120003', 'jma_s', Buffer.alloc(0));
    expect(fb.size()).toBe(0);
  });
});

describe('pollOnce', () => {
  function fetchOk() {
    return async (url) => {
      if (url.includes('latest.json')) {
        return { ok: true, text: async () => '{"latest_time":"2026/11/07 12:00:03"}' };
      }
      return { ok: true, arrayBuffer: async () => GIF };
    };
  }

  it('성공 → jma_s 적재 + latest 캐시 + 딜레이 기록', async () => {
    const { fb } = makeBuffer(fetchOk());
    await fb.pollOnce();
    expect(fb.get('20261107120003', 'jma_s')).not.toBeNull();
    expect(fb.getLatestJson()).toEqual({ latest_time: '2026/11/07 12:00:03' });
    expect(fb.getOptimalDelay()).toBe(2000);
    expect(fb.getConsecutiveFailures()).toBe(0);
  });

  it('적응 — 첫 후보 실패 시 다음 딜레이로 이동해 적재', async () => {
    const fetchShift = async (url) => {
      if (url.includes('latest.json')) return { ok: true, text: async () => '{}' };
      // 12:00:03(딜레이 2s)만 404, 이후 딜레이는 성공으로 만들기 위해 스탬프 검사
      if (url.includes('20261107120003.')) return { ok: false };
      return { ok: true, arrayBuffer: async () => GIF };
    };
    const { fb } = makeBuffer(fetchShift);
    await fb.pollOnce();
    expect(fb.getOptimalDelay()).toBe(3000);
    expect(fb.get('20261107120002', 'jma_s')).not.toBeNull();
  });

  it('실패 → 연속 실패 카운트, 기존 캐시는 유지', async () => {
    const { fb } = makeBuffer(fetchOk());
    await fb.pollOnce();
    const fail = async () => ({ ok: false });
    const failFb = createFrameBuffer({ fetchImpl: fail, now: Date.now });
    await failFb.pollOnce();
    await failFb.pollOnce();
    expect(failFb.getConsecutiveFailures()).toBe(2);
    expect(fb.get('20261107120003', 'jma_s')).not.toBeNull();
  });

  it('latest 캐시 신선도 60s 초과 → null', async () => {
    const { fb, tick } = makeBuffer(fetchOk());
    await fb.pollOnce();
    tick(61_000);
    expect(fb.getLatestJson()).toBeNull();
  });
});
