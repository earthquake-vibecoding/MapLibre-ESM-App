import { describe, it, expect, beforeAll } from 'vitest';
import { alertFilterPasses } from './alert-filter';
import { ui } from './state.svelte';

// node 환경에 localStorage 스텁 (즐겨찾기 저장소)
const store = new Map<string, string>();
beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const TOKYO: [number, number] = [139.7, 35.7];

function makeState(favs: string[]): Map<string, any> {
  const m = new Map<string, any>();
  m.set('F1', { code: 'F1', lonlat: TOKYO, jindo: null });
  // 도쿄에서 약 89km 북쪽(진도 3)
  m.set('S1', { code: 'S1', lonlat: [139.7, 36.5], jindo: 2.6 });
  // 멀리 떨어진 관측점
  m.set('S2', { code: 'S2', lonlat: [141.0, 40.0], jindo: 6.5 });
  for (const c of favs) (m.get(c) as any).isFav = true;
  return m;
}

describe('alertFilterPasses', () => {
  it('필터 끔 → 항상 통과', () => {
    ui.areaFilter = { enabled: false, minScale: 30, radiusKm: 30 };
    expect(alertFilterPasses(makeState(['F1']))).toBe(true);
  });

  it('즐겨찾기 없음 → 전역 알림 유지(통과)', () => {
    ui.areaFilter = { enabled: true, minScale: 30, radiusKm: 30 };
    store.set('station_favorites', '[]');
    expect(alertFilterPasses(makeState([]))).toBe(true);
  });

  it('반경 내 진도 충족 → 통과 (89km, 반경 100km, 진도 3 이상)', () => {
    ui.areaFilter = { enabled: true, minScale: 30, radiusKm: 100 };
    store.set('station_favorites', JSON.stringify(['F1']));
    expect(alertFilterPasses(makeState(['F1']))).toBe(true);
  });

  it('반경 밖 → 차단 (89km, 반경 30km)', () => {
    ui.areaFilter = { enabled: true, minScale: 30, radiusKm: 30 };
    store.set('station_favorites', JSON.stringify(['F1']));
    expect(alertFilterPasses(makeState(['F1']))).toBe(false);
  });

  it('반경 내지만 진도 미달 → 차단 (진도 4 이상, 흔들림은 진도 3)', () => {
    ui.areaFilter = { enabled: true, minScale: 40, radiusKm: 100 };
    store.set('station_favorites', JSON.stringify(['F1']));
    const state = makeState(['F1']);
    (state.get('S1') as any).jindo = 2.6; // 진도 3
    expect(alertFilterPasses(state)).toBe(false);
  });

  it('흔들림이 진도 7(S2)이어도 즐겨찾기에서 멀면 차단 (반경 30km)', () => {
    ui.areaFilter = { enabled: true, minScale: 10, radiusKm: 30 };
    store.set('station_favorites', JSON.stringify(['F1']));
    expect(alertFilterPasses(makeState(['F1']))).toBe(false);
  });
});
