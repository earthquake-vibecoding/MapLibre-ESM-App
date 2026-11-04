import { Marker } from 'maplibre-gl';
import { getIntensityColor } from './jma-utils';

/** 판경계 라벨 — 좌표는 plate-boundaries.json 경계선 위의 실제 점 */
const TECTONIC_LABELS: { name: string; lonlat: [number, number] }[] = [
  { name: '쿠릴 해구', lonlat: [147.34, 42.69] },
  { name: '일본해구', lonlat: [144.2, 39.37] },
  { name: '사가미 해곽', lonlat: [139.92, 34.71] },
  { name: '난카이 해곽', lonlat: [134.69, 32.2] },
  { name: '이즈-오가사와라 해구', lonlat: [142.22, 30.71] },
  { name: '류큐 해구', lonlat: [126.89, 27.15] }
];

/** 판경계 한글 라벨 — symbol 텍스트는 글리프 폰트(CDN)가 필요해 HTML Marker 사용 */
export function addTectonicLabels(map: any): void {
  for (const { name, lonlat } of TECTONIC_LABELS) {
    const el = document.createElement('div');
    el.className =
      'text-[10px] leading-none font-medium text-orange-600 dark:text-orange-300/90 whitespace-nowrap select-none pointer-events-none';
    el.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.35)';
    el.textContent = name;
    new Marker({ element: el }).setLngLat(lonlat).addTo(map);
  }
}

/**
 * 역사 대지진 — 진원지는 공식 발표 근사값 (고지진은 추정치).
 * maxScale = JMA 최대관측진도 코드 (46=5강, 50=6약, 55=6강, 60=진도7).
 * 1919년 이후는 JMA 진도DB 실측값(2026-11-04 조회, 구계급 5/6은 5강/6강 코드로 기록),
 * 그 이전(노비·호에이)은 추정치로 estimated 표기.
 */
const HISTORICAL_QUAKES: { name: string; year: number; mag: number; lonlat: [number, number]; maxScale: number; estimated?: boolean }[] = [
  { name: '호에이 지진', year: 1707, mag: 8.6, lonlat: [135.9, 33.0], maxScale: 55, estimated: true },
  { name: '노비 지진', year: 1891, mag: 8.0, lonlat: [136.6, 35.6], maxScale: 60, estimated: true },
  { name: '쇼와 산리쿠 해역 지진', year: 1933, mag: 8.1, lonlat: [144.5, 39.25], maxScale: 46 },
  { name: '도난카이 지진', year: 1944, mag: 7.9, lonlat: [136.2, 33.6], maxScale: 55 },
  { name: '난카이 지진', year: 1946, mag: 8.0, lonlat: [134.8, 32.9], maxScale: 46 },
  { name: '후쿠이 지진', year: 1948, mag: 7.1, lonlat: [136.23, 36.08], maxScale: 55 },
  { name: '다고 지진', year: 1927, mag: 7.3, lonlat: [134.87, 35.63], maxScale: 55 },
  { name: '도카치 해역 지진', year: 2003, mag: 8.0, lonlat: [144.08, 41.78], maxScale: 50 },
  { name: '관동대지진', year: 1923, mag: 7.9, lonlat: [139.7, 35.4], maxScale: 55 },
  { name: '니가타현 주에츠 지진', year: 2004, mag: 6.8, lonlat: [138.87, 37.29], maxScale: 60 },
  { name: '한신·아와지 대지진', year: 1995, mag: 7.3, lonlat: [135.08, 34.59], maxScale: 60 },
  { name: '후쿠오카현 서쪽 해역 지진', year: 2005, mag: 7.0, lonlat: [130.17, 33.72], maxScale: 50 },
  { name: '도호쿠 대지진', year: 2011, mag: 9.0, lonlat: [142.37, 38.3], maxScale: 60 },
  { name: '쿠마모토 지진', year: 2016, mag: 7.3, lonlat: [130.76, 32.75], maxScale: 60 },
  { name: '홋카이도 도부 지진', year: 2018, mag: 6.7, lonlat: [141.99, 42.69], maxScale: 60 },
  { name: '노토반도 지진', year: 2024, mag: 7.6, lonlat: [137.27, 37.5], maxScale: 60 },
  { name: '히유가나다 지진', year: 2024, mag: 7.1, lonlat: [131.65, 31.8], maxScale: 50 }
];

interface QuakeInfo {
  name: string;
  year: number;
  mag: number;
  maxScale: number;
  estimated?: boolean;
}

function quakeMarkerEl({ name, year, mag, maxScale, estimated }: QuakeInfo): HTMLElement {
  const px = Math.round(Math.min(15, Math.max(8, 8 + (mag - 6.7) * 2.5)));
  const el = document.createElement('div');
  el.className = 'flex flex-col items-center select-none pointer-events-none';
  const dot = document.createElement('span');
  dot.className = 'rounded-full ring-1 ring-black/20 dark:ring-white/25';
  dot.style.width = px + 'px';
  dot.style.height = px + 'px';
  dot.style.background = getIntensityColor(maxScale);
  if (estimated) dot.style.opacity = '0.45'; // 추정 진도 — 실측과 구분
  const label = document.createElement('span');
  label.className = 'mt-0.5 text-[9px] leading-none font-bold text-zinc-600 dark:text-zinc-300/90 whitespace-nowrap';
  label.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.35)';
  label.textContent = `${name} M${mag.toFixed(1)} (${year})${estimated ? ' 추정' : ''}`;
  el.appendChild(dot);
  el.appendChild(label);
  return el;
}

/** 역사 대지진 마커 — 원 크기는 규모 비례 */
export function addHistoricalQuakes(map: any): void {
  for (const q of HISTORICAL_QUAKES) {
    new Marker({ element: quakeMarkerEl(q) }).setLngLat(q.lonlat).addTo(map);
  }
}
