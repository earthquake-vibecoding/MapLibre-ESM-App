import { describe, it, expect } from 'vitest';
import { collectLiveEpisode } from './detection-log';

function stn(over: any = {}) {
  return { name: '大阪', region: '大阪府', lonlat: [135.5, 34.7], jindo: 0, ...over };
}

describe('collectLiveEpisode', () => {
  it('감지 없으면 null', () => {
    expect(collectLiveEpisode(new Map())).toBeNull();
  });

  it('단일 관측소 집계 — 시작/최대진도/중심/top', () => {
    const m = new Map([['a', stn({ event: { startTime: 1000, maxJindo: 2.3 } })]]);
    const live = collectLiveEpisode(m)!;
    expect(live.count).toBe(1);
    expect(live.maxJindo).toBe(2.3);
    expect(live.start).toBe(1000);
    expect(live.center).toEqual([135.5, 34.7]);
    expect(live.top).toEqual({ name: '大阪', region: '大阪府', jindo: 2.3 });
  });

  it('복수 관측소 — top은 최대 진도, 중심은 평균, start는 최소', () => {
    const m = new Map([
      ['a', stn({ event: { startTime: 1000, maxJindo: 1.0 } })],
      ['b', stn({ name: '神戸', lonlat: [136.5, 34.7], event: { startTime: 900, maxJindo: 3.1 } })]
    ]);
    const live = collectLiveEpisode(m)!;
    expect(live.count).toBe(2);
    expect(live.maxJindo).toBe(3.1);
    expect(live.start).toBe(900);
    expect(live.center).toEqual([136, 34.7]);
    expect(live.top?.name).toBe('神戸');
  });

  it('event.maxJindo 없으면 stn.jindo 폴백', () => {
    const m = new Map([['a', stn({ jindo: 1.7, event: { startTime: 5 } })]]);
    expect(collectLiveEpisode(m)!.maxJindo).toBe(1.7);
  });
});
