/**
 * 미디언 필터(Median Filter).
 * 일시적인 1~2프레임 이미지 노이즈(글리치)로 단일 관측소 진도가 튀는 현상 제거.
 */
export function applyMedianFilter(stn: any, rawJindo: number): number {
  if (!stn.rawJindoHistory) {
    stn.rawJindoHistory = [];
  }

  stn.rawJindoHistory.unshift(rawJindo);

  // 최근 3개 프레임으로 순간적인 노이즈 스파이크 제거
  if (stn.rawJindoHistory.length > 3) {
    stn.rawJindoHistory.pop();
  }

  const sorted = [...stn.rawJindoHistory].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
