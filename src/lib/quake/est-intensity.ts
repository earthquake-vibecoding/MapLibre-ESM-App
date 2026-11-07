/**
 * EEW 기반 로컬 예상진도 — Si & Midorikawa (1999) 거리감쇠식 (순수 로직).
 * 진앙 좌표·규모·깊이에서 공학기반층 최대속도(PGV600, cm/s)를 산출하고 계측진도로 환산한다.
 * 실측 앵커: 도쿄(도호쿠 M9.0/24km/250km) ≈ 5.3, 구마모토 M7.3 진앙 인근 ≈ 진도 7.
 * S파 도달 대기 없이 EEW 수신 즉시 전체 예측 분포를 색칠 — 보고서(M/깊이) 갱신 때 재계산.
 */
import { getIntensityColor, jindoToScale } from './jma-utils';
import { parseScale } from '../services/chime';

// Si & Midorikawa (1999) 감쇠식 계수
const SM_MAG_COEF = 0.58;
const SM_DEPTH_COEF = 0.0038;
const SM_BASE = -1.29;
const SM_DIST_SITE = 0.0028;  // X + 0.0028·X + 1.881
const SM_DIST_FLOOR = 1.881;
const SM_ANELASTIC = 0.002;   // −0.002·X
const SM_MIN_DIST_KM = 3;     // 진앙 인근 발산 억제

/** 계측진도 환산: I = 2.42·log10(PGV600) + 2.68 */
const JINDO_PGV_COEF = 2.42;
const JINDO_PGV_BASE = 2.68;

export function pgv600At(mag: number, depthKm: number, distKm: number): number {
  const x = Math.max(distKm, SM_MIN_DIST_KM);
  const logPgv = SM_MAG_COEF * mag + SM_DEPTH_COEF * depthKm + SM_BASE
    - Math.log10(x + SM_DIST_SITE * x + SM_DIST_FLOOR) - SM_ANELASTIC * x;
  return Math.pow(10, logPgv);
}

export function pgvToJindo(pgv: number): number {
  return JINDO_PGV_COEF * Math.log10(Math.max(pgv, 1e-6)) + JINDO_PGV_BASE;
}

/** 거리 감쇠를 반영한 예상 계측진도 (진원거리 km 기준) */
export function estJindoAt(mag: number, depthKm: number, distKm: number): number {
  return pgvToJindo(pgv600At(mag, depthKm, distKm));
}

/** 구면 거리 (km) */
export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** 예보구역 대표점 — 첫 외곽 링 꼭짓점 평균 (Polygon/MultiPolygon) */
export function featureCentroid(feature: any): { lon: number; lat: number } | null {
  const geom = feature?.geometry;
  let ring: any[] | null = null;
  if (geom?.type === 'Polygon') ring = geom.coordinates?.[0];
  else if (geom?.type === 'MultiPolygon') ring = geom.coordinates?.[0]?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;

  // 닫는 꼭짓점(첫 점과 동일)은 평균에서 제외 — 대표점 치우침 방지
  const n0 = ring.length;
  if (n0 > 1 && ring[0][0] === ring[n0 - 1][0] && ring[0][1] === ring[n0 - 1][1]) {
    ring = ring.slice(0, -1);
  }

  let sumLon = 0;
  let sumLat = 0;
  let n = 0;
  for (const c of ring) {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
      sumLon += c[0];
      sumLat += c[1];
      n++;
    }
  }
  return n > 0 ? { lon: sumLon / n, lat: sumLat / n } : null;
}

/** EEW 최대예상진도 표기('5弱', '6+', '4' 등) → 계측진도 상한. 모르는 형식은 캡 없음 */
function eventMaxJindo(eew: any): number | null {
  const s = eew?.MaxIntensity;
  if (typeof s !== 'string' || !/^[0-7](?:[-+弱強ab])?$/.test(s.trim())) return null;
  return parseScale(s);
}

/**
 * EEW 현재 상태의 예상진도 마스크 FeatureCollection — 전 영역 즉시 색칠.
 * 감쇠식 진도 → 계급 색, 배너 최대예상진도로 상한 캡. 진도 <0.5는 투명.
 */
export function buildLocalMaskFc(features: any[], eew: any): any {
  const mag = (typeof eew?.Magunitude === 'number' && eew.Magunitude > 0) ? eew.Magunitude : 6.0;
  const depth = (typeof eew?.Depth === 'number' && eew.Depth > 0) ? eew.Depth : 10;
  const lon = eew?.Longitude ?? 0;
  const lat = eew?.Latitude ?? 0;
  const cap = eventMaxJindo(eew);

  const out = features.map((feature) => {
    let color = 'transparent';
    let opacity = 0;
    let maxJindo = -3;
    const c = featureCentroid(feature);
    if (c) {
      const dist = haversineKm(lon, lat, c.lon, c.lat);
      let jindo = estJindoAt(mag, depth, dist);
      if (cap !== null) jindo = Math.min(jindo, cap);
      const scale = jindoToScale(jindo);
      if (scale > 0) {
        color = getIntensityColor(scale);
        opacity = maskOpacity(jindo);
        maxJindo = jindo;
      }
    }
    return { ...feature, properties: { ...feature.properties, color, opacity, maxJindo } };
  });

  return { type: 'FeatureCollection', features: out };
}

/** 계측진도 → 면 투명도 (GIF 마스크와 동일 단계) */
export function maskOpacity(maxJindo: number): number {
  if (maxJindo >= 6.5) return 0.95;       // 진도 7
  if (maxJindo >= 5.5) return 0.90;       // 진도 6약, 6강
  if (maxJindo >= 4.5) return 0.85;       // 진도 5약, 5강
  if (maxJindo >= 3.5) return 0.75;       // 진도 4
  if (maxJindo >= 2.5) return 0.60;       // 진도 3
  if (maxJindo >= 1.5) return 0.45;       // 진도 2
  return 0.30;                            // 진도 1
}
