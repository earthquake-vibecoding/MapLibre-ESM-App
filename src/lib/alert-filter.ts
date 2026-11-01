import { ui } from './state.svelte';
import { jindoToScale } from './jma-utils';
import { haversineKm } from './grid';
import { loadFavorites } from './station-favorites';

/**
 * 관심 지역 알림 필터: 즐겨찾은 관측소 반경 radiusKm 내에서
 * 계측진도가 minScale(진도 코드) 이상인 관측점이 하나라도 있으면 통과.
 * 필터 끔 또는 즐겨찾기 없음 → 전역 알림(기존 동작) 유지.
 */
export function alertFilterPasses(stationsState: Map<string, any>): boolean {
  const f = ui.areaFilter;
  if (!f.enabled) return true;
  const codes = loadFavorites();
  if (codes.length === 0) return true;

  // 흔들림 중인 관측점만 먼저 모아 조기 탈출 — 즐겨찾기 × 전체 순회 최소화
  const shaking: any[] = [];
  for (const s of stationsState.values()) {
    if (s.jindo != null && jindoToScale(s.jindo) >= f.minScale) shaking.push(s.lonlat);
  }
  if (shaking.length === 0) return false;

  for (const code of codes) {
    const fav = stationsState.get(code);
    if (!fav?.lonlat) continue;
    for (const lonlat of shaking) {
      if (haversineKm(fav.lonlat, lonlat) <= f.radiusKm) return true;
    }
  }
  return false;
}
