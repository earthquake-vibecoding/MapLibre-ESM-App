/**
 * 실제 샘플 알림음 (옛 프로젝트 /snd/shi0-6 + 소방청 J-Alert 컷 shi7 — 내용물은 MP3, 브라우저가 스니핑해서 재생).
 * shi0 = 흔들림 감지 비프, shi1-6 = 진도계급 알림 (5-/5+ → shi5, 6-/6+ → shi6), shi7 = 진도 7 전용.
 * 재생 실패 시 false 반환 → 호출부가 신스(chime)로 폴백.
 */

import { parseScale } from './chime';

const FILES = ['shi0.wav', 'shi1.wav', 'shi2.wav', 'shi3.wav', 'shi4.wav', 'shi5.wav', 'shi6.wav', 'shi7.wav'];
const cache = new Map<number, HTMLAudioElement>();
const failed = new Set<number>();
let lastPlay = 0;

export function shindoSampleIndex(scale: number | string | undefined): number {
  const n = parseScale(scale);
  // 7은 전용 사이렌(shi7), 그 외 floor: 5-/5+ → 5(shi5), 6-/6+ → 6(shi6)
  return n >= 7 ? 7 : Math.min(6, Math.max(0, Math.floor(n)));
}

function playIdx(idx: number, vol = 1): boolean {
  if (failed.has(idx)) return false;

  // 원본 newShi 비프 쓰로틀 120ms
  const now = performance.now();
  if (now - lastPlay < 120) return true;
  lastPlay = now;

  let audio = cache.get(idx);
  if (!audio) {
    audio = new Audio(`/snd/${FILES[idx]}`);
    audio.preload = 'auto';
    audio.addEventListener('error', () => failed.add(idx));
    cache.set(idx, audio);
  }
  audio.currentTime = 0;
  audio.volume = vol;
  audio.play().catch(() => undefined);
  return true;
}

/** 진도계급 알림음 (shi1-7, shi7 로드 실패 시 shi6 폴백) */
export function playShindoSample(scale: number | string | undefined, vol = 1): boolean {
  const idx = shindoSampleIndex(scale);
  if (playIdx(idx, vol)) return true;
  return idx === 7 ? playIdx(6, vol) : false;
}

/** 흔들림 감지 비프 (shi0) */
export function playDetectionSample(vol = 1): boolean {
  return playIdx(0, vol);
}
