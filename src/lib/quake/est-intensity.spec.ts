import { describe, it, expect } from 'vitest';
import { estJindoAt, pgvToJindo, haversineKm, featureCentroid, buildLocalMaskFc } from './est-intensity';
import { jindoToScale } from './jma-utils';

describe('감쇠식 (Si & Midorikawa)', () => {
  it('실측 앵커: 도쿄(도호쿠 M9.0/24km/250km) → 진도 5弱〜5強', () => {
    const j = estJindoAt(9.0, 24, 250);
    expect(j).toBeGreaterThanOrEqual(4.5);
    expect(j).toBeLessThan(6.0);
  });

  it('실측 앵커: 구마모토 M7.3 진앙 인근 → 진도 7', () => {
    const j = estJindoAt(7.3, 10, 5);
    expect(jindoToScale(j)).toBe(70);
  });

  it('거리가 멀수록 진도 단조 감소', () => {
    const near = estJindoAt(6.5, 10, 30);
    const mid = estJindoAt(6.5, 10, 100);
    const far = estJindoAt(6.5, 10, 300);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it('pgvToJindo: PGV 1 cm/s → 진도 2대, 100 cm/s → 6 후반', () => {
    expect(pgvToJindo(1)).toBeCloseTo(2.68, 1);
    expect(pgvToJindo(100)).toBeGreaterThan(6.5);
  });
});

describe('기하 유틸', () => {
  it('haversineKm: 오사카-도쿄 약 395km', () => {
    const d = haversineKm(135.5, 34.69, 139.77, 35.68);
    expect(d).toBeGreaterThan(370);
    expect(d).toBeLessThan(420);
  });

  it('featureCentroid: 첫 외곽 링의 꼭짓점 평균', () => {
    const fc = featureCentroid({
      geometry: { type: 'Polygon', coordinates: [[[139, 35], [141, 35], [141, 37], [139, 37], [139, 35]]] }
    });
    expect(fc).toEqual({ lon: 140, lat: 36 });
    // MultiPolygon은 첫 폴리곤의 첫 링
    const fm = featureCentroid({
      geometry: { type: 'MultiPolygon', coordinates: [[[[139, 35], [141, 35], [141, 37], [139, 37], [139, 35]]]] }
    });
    expect(fm).toEqual({ lon: 140, lat: 36 });
  });
});

describe('buildLocalMaskFc', () => {
  // 진앙 (140, 36) 부근 + 멀리 떨어진 영역 (143 부근)
  const near = { geometry: { type: 'Polygon', coordinates: [[[139.9, 35.9], [140.1, 35.9], [140.1, 36.1], [139.9, 36.1], [139.9, 35.9]]] } };
  const far = { geometry: { type: 'Polygon', coordinates: [[[143.0, 36.0], [143.2, 36.0], [143.2, 36.2], [143.0, 36.2], [143.0, 36.0]]] } };
  const eew = { Magunitude: 7.0, Depth: 10, Longitude: 140, Latitude: 36 };

  it('EEW 수신 즉시 전체 분포 색칠 (S파 게이트 없음) — 원거리도 진도 낮게 색칠', () => {
    const fc = buildLocalMaskFc([near, far], eew);
    expect(fc.features[0].properties.color).not.toBe('transparent');
    const farScale = jindoToScale(fc.features[1].properties.maxJindo);
    expect(fc.features[1].properties.color).not.toBe('transparent');
    expect(farScale).toBeLessThan(jindoToScale(fc.features[0].properties.maxJindo)); // 원거리 진도가 더 낮음
  });

  it('MaxIntensity 캡: 배너 표기 이상으로 색칠되지 않음', () => {
    const fc = buildLocalMaskFc([near], { ...eew, MaxIntensity: '3' });
    expect(jindoToScale(fc.features[0].properties.maxJindo)).toBeLessThanOrEqual(30);
  });

  it('중심점을 못 구하는 피처는 투명 유지', () => {
    const bad = { geometry: { type: 'Polygon', coordinates: [] } };
    const fc = buildLocalMaskFc([bad], eew);
    expect(fc.features[0].properties.color).toBe('transparent');
  });
});
