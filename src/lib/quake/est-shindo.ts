/**
 * EEW 예상진도 마스크 — kmoni EstShindoImg(eew) 프레임을 관측점 플롯 위치에서 샘플링해
 * 예보구역 코드별 최대진도로 집계한다.
 *
 * kmoni는 예상진도를 관측점 플롯 좌표(intensity-points-v1.json의 Point.x/y)에 점으로 찍는다
 * (2026-11-14 奄美 EEW 프레임 실측 — 폴리곤 래스터라이저는 남서 제도 인셋 배치 때문에 정합 불가).
 * 관측점 파일엔 예보구역 코드가 없고 JMA 관측소 목록(JMAstations.json)과 명명 체계도 달라
 * 좌표 최근접 관측소로 예보구역을 근사한다.
 * 프레임은 EEW 발표 중에만 발행되고, 실패/빈 프레임(서버 1×1 폴백 포함)이면 null —
 * 호출부가 setSource를 생략해 직전 마스크를 유지한다.
 */
import { getIntensityColor, getJindoFromColorStrict, jindoToScale } from './jma-utils';
import type { MapController } from '../map/map-controller';
import { TIMING } from '../config';
import { dbg } from '../debug';

const MASK_SOURCE = 'est-shindo-mask-area';
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

export interface PlotPoint {
  name: string;
  x: number;      // 프레임 플롯 픽셀
  y: number;
  lon: number;
  lat: number;
  area: string | null; // 최근접 JMA 관측소의 예보구역 코드
}

/** 관측점 3×3 이웃 최대 진도 → 예보구역 코드별 집계 (순수 로직 — 스펙 대상) */
export function sampleAreaMax(data: Uint8ClampedArray, w: number, h: number, plots: PlotPoint[]): Map<string, number> {
  const areaMax = new Map<string, number>();
  for (const p of plots) {
    if (!p.area) continue;
    let best: number | null = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const o = (y * w + x) * 4;
        if (data[o + 3] < 128) continue;
        const j = getJindoFromColorStrict(data[o], data[o + 1], data[o + 2]);
        if (j !== null && (best === null || j > best)) best = j;
      }
    }
    if (best === null) continue;
    if (best > (areaMax.get(p.area) ?? -3)) areaMax.set(p.area, best);
  }
  return areaMax;
}

class EstShindoMask {
  private areaForecastGeoJSON: any = null;
  private plots: PlotPoint[] = [];
  private isInitialized = false;

  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. 예보구역 GeoJSON + 관측점 플롯 + JMA 관측소(예보구역 근사용)
      const [geoRes, pointsRes, stationRes] = await Promise.all([
        fetch('/area_forecast.json'),
        fetch('/intensity-points-v1.json'),
        fetch('/JMAstations.json')
      ]);
      this.areaForecastGeoJSON = await geoRes.json();
      const rawPlots: any[] = await pointsRes.json();
      const stations: any[] = await stationRes.json();

      const plots: PlotPoint[] = rawPlots
        .filter((p: any) => p.Point && p.Location && typeof p.Point.x === 'number')
        .map((p: any) => ({
          name: p.Name, x: p.Point.x, y: p.Point.y,
          lon: p.Location.longitude, lat: p.Location.latitude, area: null
        }));

      // 2. 관측점 → 최근접 JMA 관측소의 예보구역 코드 (프레임 내 좌표계와 무관한 lon/lat 매칭)
      const stLon: number[] = [];
      const stLat: number[] = [];
      const stArea: string[] = [];
      for (const st of stations) {
        if (!st.area?.code || !st.lat || !st.lon) continue;
        stLon.push(parseFloat(st.lon));
        stLat.push(parseFloat(st.lat));
        stArea.push(st.area.code);
      }
      for (const p of plots) {
        let best = Infinity;
        const cosLat = Math.cos((p.lat * Math.PI) / 180);
        for (let i = 0; i < stLon.length; i++) {
          const d = (stLat[i] - p.lat) ** 2 + ((stLon[i] - p.lon) * cosLat) ** 2;
          if (d < best) { best = d; p.area = stArea[i]; }
        }
      }
      this.plots = plots;

      // 3. GIF 픽셀 파싱용 오프스크린 캔버스
      if (typeof document !== 'undefined') {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize EstShindoMask:', err);
    }
  }

  /**
   * GIF → 관측점별 최대 진도 → 예보구역 코드별 집계.
   * 3×3 이웃 최대 — 프레임 점이 플롯 좌표에서 1~2px 어긋난 것도 흡수한다.
   */
  private processEstShindoGif(gifUrl: string): Promise<Map<string, number> | null> {
    return new Promise((resolve) => {
      if (!this.isInitialized || !this.offscreenCtx || !gifUrl) {
        resolve(null);
        return;
      }

      // GIF 로드가 걸리면 영원히 pending 되는 것 방지
      const timeoutId = setTimeout(() => resolve(null), TIMING.estGifGuardMs);
      const done = () => clearTimeout(timeoutId);

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        done();
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (w <= 2 || h <= 2) {
            resolve(null); // 서버 fallback 1×1 투명 GIF — 직전 마스크 유지
            return;
          }

          const ctx = this.offscreenCtx!;
          this.offscreenCanvas!.width = w;
          this.offscreenCanvas!.height = h;
          ctx.drawImage(img, 0, 0);
          resolve(sampleAreaMax(ctx.getImageData(0, 0, w, h).data, w, h, this.plots));
        } catch (err) {
          console.error('Error parsing EstShindo GIF pixels:', err);
          resolve(null);
        }
      };

      img.onerror = () => {
        done();
        resolve(null);
      };

      img.src = gifUrl;
    });
  }

  async getMaskedGeoJSON(gifUrl: string): Promise<any> {
    await this.init(); // 최초 호출에서 lazy 초기화 (이후 재호출은 no-op)
    if (!this.areaForecastGeoJSON) return null;

    const areaMax = await this.processEstShindoGif(gifUrl);
    if (!areaMax) return null;

    let colored = 0;
    const features = this.areaForecastGeoJSON.features.map((feature: any) => {
      const mj = areaMax.get(feature.properties?.code) ?? -3;
      const scale = jindoToScale(mj);
      if (scale > 0) colored++;
      const color = scale > 0 ? getIntensityColor(scale) : 'transparent';
      return {
        ...feature,
        properties: { ...feature.properties, color, opacity: maskOpacity(mj), maxJindo: mj }
      };
    });

    dbg(`예상진도 마스크: 색칠 ${colored}/${features.length}면적`);
    return { type: 'FeatureCollection', features };
  }
}

export function maskOpacity(maxJindo: number): number {
  if (maxJindo >= 6.5) return 0.95;       // 진도 7
  if (maxJindo >= 5.5) return 0.90;       // 진도 6약, 6강
  if (maxJindo >= 4.5) return 0.85;       // 진도 5약, 5강
  if (maxJindo >= 3.5) return 0.75;       // 진도 4
  if (maxJindo >= 2.5) return 0.60;       // 진도 3
  if (maxJindo >= 1.5) return 0.45;       // 진도 2
  return 0.30;                            // 진도 1
}

const estShindoMask = new EstShindoMask();

export async function updateMaskLayer(mapCtl: MapController | null, gifUrl: string): Promise<void> {
  if (!gifUrl || !mapCtl) return;
  try {
    const maskedGeoJSON = await estShindoMask.getMaskedGeoJSON(gifUrl);
    if (maskedGeoJSON) mapCtl.setSource(MASK_SOURCE, maskedGeoJSON);
  } catch (err) {
    console.warn('Failed to update EstShindo mask layer:', err);
  }
}

/** EEW 비활성 — 마스크 소스를 비워 지도 잔상 제거 (멱등) */
export function clearMaskLayer(mapCtl: MapController): void {
  mapCtl.setSource(MASK_SOURCE, EMPTY_FC);
}
