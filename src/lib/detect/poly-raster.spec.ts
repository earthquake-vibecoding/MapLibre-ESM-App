import { describe, it, expect } from 'vitest';
import { buildPixelIndex, decodeFrameMax, type PixelProjector } from './poly-raster';

// 테스트용 항등 투영: (lon, lat)을 픽셀 좌표로 그대로 쓴다
const identity: PixelProjector = {
  toPixelF: (lon, lat) => ({ x: lon, y: lat })
};

function square(x0: number, y0: number, x1: number, y1: number): number[][][] {
  return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
}

function countIndex(index: Int16Array, fi: number): number {
  let n = 0;
  for (const v of index) if (v === fi) n++;
  return n;
}

describe('buildPixelIndex', () => {
  it('정사각형 폴리곤: 내부 픽셀만 인덱싱 (픽셀 중심 기준)', () => {
    const features = [{ geometry: { type: 'Polygon', coordinates: square(10, 10, 20, 20) } }];
    const index = buildPixelIndex(features, identity, 30, 30);

    expect(countIndex(index, 0)).toBe(100); // px 10..19 × py 10..19
    // 경계 바깥 픽셀은 미속
    expect(index[9 * 30 + 9]).toBe(-1);
    expect(index[20 * 30 + 20]).toBe(-1);
    // 내부 픽셀은 소속
    expect(index[15 * 30 + 15]).toBe(0);
  });

  it('구멍(hole) 링은 even-odd로 제외된다', () => {
    const outer = square(0, 0, 30, 30);
    const hole = square(10, 10, 20, 20);
    const features = [{ geometry: { type: 'Polygon', coordinates: [outer[0], hole[0]] } }];
    const index = buildPixelIndex(features, identity, 30, 30);

    expect(countIndex(index, 0)).toBe(900 - 100);
    expect(index[15 * 30 + 15]).toBe(-1); // 구멍 내부
    expect(index[5 * 30 + 5]).toBe(0);    // 구멍 밖 내부
  });

  it('MultiPolygon 두 조각이 같은 피처로 집계된다', () => {
    const features = [{
      geometry: { type: 'MultiPolygon', coordinates: [square(0, 0, 5, 5), square(10, 10, 15, 15)] }
    }];
    const index = buildPixelIndex(features, identity, 20, 20);

    expect(countIndex(index, 0)).toBe(50); // 5×5 + 5×5
  });

  it('그리드 밖으로 삐져나온 폴리곤은 그리드 안쪽만 인덱싱된다', () => {
    const features = [{ geometry: { type: 'Polygon', coordinates: square(-5, -5, 10, 10) } }];
    const index = buildPixelIndex(features, identity, 20, 20);

    expect(countIndex(index, 0)).toBe(100); // px 0..9 × py 0..9
    expect(index[0]).toBe(0);
  });
});

describe('decodeFrameMax', () => {
  it('폴리곤별 최대 진도 집계, null 디코드/저알파 픽셀은 무시', () => {
    const features = [
      { geometry: { type: 'Polygon', coordinates: square(0, 0, 4, 4) } },
      { geometry: { type: 'Polygon', coordinates: square(10, 0, 14, 4) } }
    ];
    const index = buildPixelIndex(features, identity, 20, 10);
    const data = new Uint8ClampedArray(20 * 10 * 4);

    const paint = (px: number, py: number, r: number, g: number, b: number, a: number) => {
      const o = (py * 20 + px) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
    };

    // decode가 1/2/3을 돌려주는 색 세 가지
    const decode = (r: number) => (r === 10 ? 1 : r === 20 ? 2 : r === 30 ? 3 : null);

    paint(1, 1, 10, 0, 0, 255);   // 진도 1
    paint(2, 2, 20, 0, 0, 255);   // 진도 2
    paint(1, 2, 30, 0, 0, 255);   // 진도 3 → 폴리곤0 최대
    paint(2, 1, 40, 0, 0, 255);   // null 디코드 → 무시
    paint(3, 1, 10, 0, 0, 100);   // 저알파 → 무시
    paint(11, 1, 10, 0, 0, 255);  // 폴리곤1: 진도 1

    const maxes = decodeFrameMax(index, data, 20, 10, decode);
    expect(maxes.get(0)).toBe(3);
    expect(maxes.get(1)).toBe(1);
    expect(maxes.size).toBe(2);
  });
});
