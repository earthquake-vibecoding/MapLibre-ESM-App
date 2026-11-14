import { describe, it, expect } from 'vitest';
import { sampleAreaMax, maskOpacity } from './est-shindo';
import { getJindoFromColorStrict } from './jma-utils';

// kmoni 연속 컬러맵 실측색 (2026-11-14 奄美 EEW EstShindoImg 프레임에서 채취)
const J008 = [75, 250, 49];   // 계측진도 0.1
const J080 = [163, 253, 20];  // 계측진도 0.8
const W = 16;
const H = 16;

function rgba(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number] | null): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = paint(x, y);
      if (!c) continue;
      const o = (y * w + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = c[3];
    }
  return out;
}

describe('sampleAreaMax — EstShindoImg 관측점 위치 샘플링', () => {
  it('관측점 픽셀 색 → 면적 코드별 최대진도 집계', () => {
    const data = rgba(W, H, (x, y) => (x === 4 && y === 4 ? [J008[0], J008[1], J008[2], 255] : x === 10 && y === 10 ? [J080[0], J080[1], J080[2], 255] : null));
    const plots = [
      { name: '甲', x: 4, y: 4, lon: 0, lat: 0, area: '100' },
      { name: '乙', x: 10, y: 10, lon: 0, lat: 0, area: '200' }
    ];
    const m = sampleAreaMax(data, W, H, plots);
    expect(m.get('100')!).toBeCloseTo(getJindoFromColorStrict(J008[0], J008[1], J008[2])!, 5);
    expect(m.get('200')!).toBeCloseTo(getJindoFromColorStrict(J080[0], J080[1], J080[2])!, 5);
  });

  it('3×3 이웃 허용 — 프레임 점이 플롯에서 1px 어긋나도 흡수', () => {
    const data = rgba(W, H, (x, y) => (x === 5 && y === 5 ? [J080[0], J080[1], J080[2], 255] : null));
    const m = sampleAreaMax(data, W, H, [{ name: '甲', x: 4, y: 4, lon: 0, lat: 0, area: '100' }]);
    expect(m.get('100')!).toBeCloseTo(getJindoFromColorStrict(J080[0], J080[1], J080[2])!, 5);
  });

  it('투명 픽셀·매칭 없는 관측점 제외, 같은 면적 다중 관측점은 최대값 승자', () => {
    const data = rgba(W, H, (x, y) => (x === 2 && y === 2 ? [J080[0], J080[1], J080[2], 255] : x === 8 && y === 8 ? [J008[0], J008[1], J008[2], 255] : null));
    const plots = [
      { name: '투명점', x: 14, y: 14, lon: 0, lat: 0, area: '100' },  // 색 없음 → 제외
      { name: '면적없음', x: 2, y: 2, lon: 0, lat: 0, area: null },   // 예보구역 근사 실패 → 제외
      { name: '甲', x: 2, y: 2, lon: 0, lat: 0, area: '100' },        // 높은 진도
      { name: '乙', x: 8, y: 8, lon: 0, lat: 0, area: '100' }         // 낮은 진도 — 같은 면적
    ];
    const m = sampleAreaMax(data, W, H, plots);
    expect(m.size).toBe(1);
    expect(m.get('100')!).toBeCloseTo(getJindoFromColorStrict(J080[0], J080[1], J080[2])!, 5);
  });
});

describe('maskOpacity — 계측진도 단계', () => {
  it('진도 계급별 투명도', () => {
    expect(maskOpacity(7)).toBe(0.95);
    expect(maskOpacity(6.5)).toBe(0.95); // 6강도 진도7 단계 투명도
    expect(maskOpacity(5.5)).toBe(0.90);
    expect(maskOpacity(4.5)).toBe(0.85);
    expect(maskOpacity(3.5)).toBe(0.75);
    expect(maskOpacity(2.5)).toBe(0.60);
    expect(maskOpacity(1.5)).toBe(0.45);
    expect(maskOpacity(0.5)).toBe(0.30);
  });
});
