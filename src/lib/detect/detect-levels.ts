/**
 * 감지 판정의 순수 로직 — 진도→계급 변환과 이벤트 최대값 갱신.
 * detector.ts에서 호출 (200줄 규칙 분리).
 */

/** Qiita 감지 로직의 계측진도 → 계급 (1=Weaker … 5=Stronger) */
export function getLevel(jindo: number | null): number {
  if (jindo === null) return 0;
  if (jindo < -1.0) return 1;
  if (jindo < 1.0) return 2;
  if (jindo < 3.0) return 3;
  if (jindo < 4.5) return 4;
  return 5;
}

/**
 * 이벤트 최대 계급/진도 갱신 (감지 기록용 maxJindo 포함).
 * 계급이 올랐고 진도가 기존 재생 후보보다 크면 그 진도를 반환, 아니면 prevSound.
 */
export function updateEventMax(ev: any, jindo: number | null, prevSound: number): number {
  if (jindo === null) return prevSound;
  if (jindo > (ev.maxJindo ?? -99)) ev.maxJindo = jindo;
  const level = getLevel(jindo);
  if (level > ev.maxLevel) {
    ev.maxLevel = level;
    if (jindo > prevSound) return jindo;
  }
  return prevSound;
}
