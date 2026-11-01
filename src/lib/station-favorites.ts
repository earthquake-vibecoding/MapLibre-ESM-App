/** 즐겨찾은 관측소 코드 목록 (localStorage) — StationPanel과 알림 필터가 공유 */
export const FAVORITES_KEY = 'station_favorites';
const KEY = FAVORITES_KEY;

export function loadFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(codes: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(codes));
  } catch {
    // quota/private mode — 무시
  }
}
