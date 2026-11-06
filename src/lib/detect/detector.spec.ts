import { describe, it, expect } from 'vitest';
import { processFrame } from './detector';
import { jindoToScale, getIntensityColor } from '../quake/jma-utils';

// 1px 검정(진도0/투명 아님) 대신 kmoni 배경색(진도 -3) 이미지: 2x1 픽셀 RGBA
function blankFrame(): Uint8ClampedArray {
  return new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]);
}

function feature(px: number, py: number, code = 'stn1', color = 'transparent') {
  return { geometry: null, properties: { code, px, py, color } };
}

describe('processFrame', () => {
  it('detectEnabled=false이면 감지 결과가 전부 비활성', () => {
    const stations = new Map([['stn1', { code: 'stn1', color: 'transparent', event: null, expireTime: null }]]);
    const features = [feature(0, 0, 'stn1', 'rgba(255,0,0,1)')];
    const result = processFrame(blankFrame(), 2, 1, features, stations, false);
    expect(result.soundJindo).toBe(-3);
    expect(result.newEventCenter).toBeNull();
    expect(result.detectedUpdated).toBe(false);
    // 레이어 색 갱신(updated)은 감지 스위치와 무관하게 동작
    expect(result.updated).toBe(true);
  });

  it('빈 프레임 + 감지 켜짐: 이벤트 없음', () => {
    const result = processFrame(blankFrame(), 2, 1, [], new Map(), true);
    expect(result.soundJindo).toBe(-3);
    expect(result.newEventCenter).toBeNull();
    expect(result.updated).toBe(false);
  });
});

describe('jma-utils 단일 테이블 일관성', () => {
  it('jindoToScale ↔ getIntensityColor 상호 일치', () => {
    const cases: [number, number][] = [
      [0.5, 10], [1.5, 20], [2.5, 30], [3.5, 40],
      [4.5, 45], [5.0, 46], [5.5, 50], [6.0, 55], [6.5, 60]
    ];
    for (const [jindo, scale] of cases) {
      expect(jindoToScale(jindo)).toBe(scale);
      expect(getIntensityColor(scale)).not.toBe('transparent');
    }
    expect(jindoToScale(0.4)).toBe(0);
    expect(getIntensityColor(5)).toBe('transparent');
  });

  it('scaleToJmaString 경계값', () => {
    expect(getIntensityColor(60)).toBe('#990099');
    expect(getIntensityColor(55)).toBe('#A00000');
    expect(getIntensityColor(45)).toBe('#FF9900');
  });
});
