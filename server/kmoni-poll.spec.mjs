import { describe, it, expect } from 'vitest';
import {
  jstStamp, kmoniRealtimeImgUrl, kmoniEewImgUrl, kmoniImgUrl,
  candidateDelays, fetchKmoniGif, fetchLatestJson
} from './kmoni-poll.mjs';

const GIF = Buffer.from('GIF89a0100');
const NOW = Date.UTC(2026, 10, 7, 3, 0, 5); // JST 2026-11-07 12:00:05

describe('jstStamp', () => {
  it('epoch ms → 14자리 JST 스탬프', () => {
    expect(jstStamp(NOW)).toBe('20261107120005');
  });
});

describe('URL 빌더', () => {
  const t = '20261107120005';
  it('realtime 포맷', () => {
    expect(kmoniRealtimeImgUrl(t, 'jma_s'))
      .toBe('http://www.kmoni.bosai.go.jp/data/map_img/RealTimeImg/jma_s/20261107/20261107120005.jma_s.gif');
  });
  it('eew 포맷', () => {
    expect(kmoniEewImgUrl(t, 'EstShindoImg'))
      .toBe('http://www.kmoni.bosai.go.jp/data/map_img/EstShindoImg/eew/20261107/20261107120005.eew.gif');
  });
  it('kmoniImgUrl 디스패치 — realtime 계열 vs eew 계열', () => {
    expect(kmoniImgUrl(t, 'acmap_b')).toContain('RealTimeImg/acmap_b');
    expect(kmoniImgUrl(t, 'jma_s')).toContain('RealTimeImg/jma_s');
    expect(kmoniImgUrl(t, 'PSWaveImg')).toContain('PSWaveImg/eew');
    expect(kmoniImgUrl(t, 'EstShindoImg')).toContain('EstShindoImg/eew');
  });
});

describe('candidateDelays', () => {
  it('중복 제거 + 1000~5000 클램프, 후보 순서 유지', () => {
    expect(candidateDelays(2000)).toEqual([2000, 3000, 1000, 4000, 5000]);
    expect(candidateDelays(6000)).toEqual([5000, 2000, 3000, 4000, 1000]);
    expect(candidateDelays(0)).toEqual([1000, 2000, 3000, 4000, 5000]);
  });
});

describe('fetchKmoniGif', () => {
  const okFetch = async () => ({ ok: true, arrayBuffer: async () => GIF });

  it('첫 성공 후보의 딜레이·스탬프 반환 (base=2000 → 12:00:03)', async () => {
    const r = await fetchKmoniGif(okFetch, NOW, 2000);
    expect(r.delay).toBe(2000);
    expect(r.timeStr).toBe('20261107120003');
  });

  it('첫 후보 실패 시 다음 딜레이 시도, 성공 딜레이 기록', async () => {
    const calls = [];
    const f = async (url) => {
      calls.push(url);
      if (calls.length === 1) return { ok: false };
      return { ok: true, arrayBuffer: async () => GIF };
    };
    const r = await fetchKmoniGif(f, NOW, 2000);
    expect(r.delay).toBe(3000);
    expect(r.timeStr).toBe('20261107120002');
    expect(calls[0]).toContain('20261107120003.jma_s.gif');
    expect(calls[1]).toContain('20261107120002.jma_s.gif');
  });

  it('GIF 매직바이트 불일치/ok:false/던짐 → 전부 실패', async () => {
    expect(await fetchKmoniGif(async () => ({ ok: true, arrayBuffer: async () => Buffer.from('<html>') }), NOW, 2000)).toBeNull();
    expect(await fetchKmoniGif(async () => ({ ok: false }), NOW, 2000)).toBeNull();
    expect(await fetchKmoniGif(async () => { throw new Error('net'); }, NOW, 2000)).toBeNull();
  });
});

describe('fetchLatestJson', () => {
  it('JSON 파싱', async () => {
    const body = await fetchLatestJson(async () => ({ ok: true, text: async () => '{"latest_time":"2026/11/07 12:00:03"}' }));
    expect(body).toEqual({ latest_time: '2026/11/07 12:00:03' });
  });
  it('비JSON/ok:false/던짐 → null', async () => {
    expect(await fetchLatestJson(async () => ({ ok: true, text: async () => 'oops' }))).toBeNull();
    expect(await fetchLatestJson(async () => ({ ok: false }))).toBeNull();
    expect(await fetchLatestJson(async () => { throw new Error('net'); })).toBeNull();
  });
});
