/**
 * 예보구역 폴리곤 → kmoni 픽셀 라스터라이저 (순수 로직, 캔버스 의존 없음).
 *
 * 꼭짓점을 픽셀 좌표로 투영한 뒤 bbox 내 모든 픽셀 중심에 짝수-홀도 레이캐스트
 * point-in-polygon 검사를 적용한다 — 구멍(hole) 링은 even-odd로 자동 제외되고
 * bbox에 걸친 이웃 지역 픽셀이 집계에 오염되지 않는다.
 */

/** kmoni 이미지 그리드 (EstShindoImg / RealTimeImg 공통) */
export const GRID_W = 352;
export const GRID_H = 400;

/** (lon, lat) → 픽셀 좌표 변환기 최소 인터페이스 (테스트 stub 가능) */
export interface PixelProjector {
  toPixelF(lon: number, lat: number): { x: number; y: number } | null;
}

interface Pt {
  x: number;
  y: number;
}

/** GeoJSON Polygon/MultiPolygon에서 링 배열만 추출 (구멍 포함) */
function extractRings(geometry: any): number[][][] {
  if (geometry?.type === 'Polygon') return geometry.coordinates ?? [];
  if (geometry?.type === 'MultiPolygon') return (geometry.coordinates ?? []).flat();
  return [];
}

function projectRing(ring: number[][], proj: PixelProjector): Pt[] {
  const pts: Pt[] = [];
  if (!Array.isArray(ring)) return pts;
  for (const coord of ring) {
    if (!Array.isArray(coord) || typeof coord[0] !== 'number') continue;
    const p = proj.toPixelF(coord[0], coord[1]);
    if (p) pts.push(p);
  }
  return pts;
}

/** 짝수-홀도 레이캐스트 (PNPOLY) — 모든 링을 합산해 구멍을 자동 배제 */
function pointInRings(x: number, y: number, rings: Pt[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const yi = ring[i].y;
      const yj = ring[j].y;
      if (yi > y !== yj > y) {
        const xi = ring[i].x;
        const xj = ring[j].x;
        if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * 피처별 픽셀 소속 인덱스 생성: index[py * w + px] = 피처 인덱스, 미속 픽셀은 -1.
 * 픽셀 중심 (px + 0.5, py + 0.5) 기준으로 판정한다.
 */
export function buildPixelIndex(features: any[], proj: PixelProjector, w = GRID_W, h = GRID_H): Int16Array {
  const index = new Int16Array(w * h).fill(-1);

  features.forEach((feature, fi) => {
    const rings = extractRings(feature?.geometry)
      .map(ring => projectRing(ring, proj))
      .filter(ring => ring.length >= 3);
    if (rings.length === 0) return;

    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (const ring of rings) {
      for (const p of ring) {
        if (p.x < x0) x0 = p.x;
        if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.y > y1) y1 = p.y;
      }
    }
    const bx0 = Math.max(0, Math.floor(x0));
    const by0 = Math.max(0, Math.floor(y0));
    const bx1 = Math.min(w - 1, Math.ceil(x1));
    const by1 = Math.min(h - 1, Math.ceil(y1));

    for (let py = by0; py <= by1; py++) {
      for (let px = bx0; px <= bx1; px++) {
        if (pointInRings(px + 0.5, py + 0.5, rings)) index[py * w + px] = fi;
      }
    }
  });

  return index;
}

/** RGBA 픽셀 → 진도(float). 팔레트 밖 혼색이면 null */
export type PixelDecode = (r: number, g: number, b: number, a: number) => number | null;

/**
 * 프레임 단일 패스 집계: 소속 폴리곤별 최대 진도.
 * 반투명(안티앨리어싱) 픽셀은 minAlpha 미만으로 잘라내 혼색 오염을 막는다.
 */
export function decodeFrameMax(
  index: Int16Array,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  decode: PixelDecode,
  minAlpha = 128
): Map<number, number> {
  const maxJindo = new Map<number, number>();

  for (let i = 0, n = w * h; i < n; i++) {
    const fi = index[i];
    if (fi < 0) continue;
    const o = i * 4;
    if (data[o + 3] < minAlpha) continue;
    const jindo = decode(data[o], data[o + 1], data[o + 2], data[o + 3]);
    if (jindo === null) continue;
    const cur = maxJindo.get(fi);
    if (cur === undefined || jindo > cur) maxJindo.set(fi, jindo);
  }

  return maxJindo;
}
