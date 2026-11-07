import { getIntensityColor, getJindoFromColorStrict, jindoToScale } from './jma-utils';
import { PolyProj } from '../detect/polyfit';
import { buildPixelIndex, decodeFrameMax, GRID_H, GRID_W, type PixelProjector } from '../detect/poly-raster';
import type { MapController } from '../map/map-controller';
import { TIMING } from '../config';
import { dbg } from '../debug';

const MASK_SOURCE = 'est-shindo-mask-area';
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

class EstShindoMask {
  private areaForecastGeoJSON: any = null;
  private proj = new PolyProj();
  /** 픽셀→피처 인덱스 캐시 (이미지 크기별) */
  private indexCache = new Map<string, Int16Array>();
  private isInitialized = false;

  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. 예보구역 GeoJSON & 진도 지점 데이터
      const [geoRes, pointsRes] = await Promise.all([
        fetch('/area_forecast.json'),
        fetch('/intensity-points-v1.json')
      ]);
      this.areaForecastGeoJSON = await geoRes.json();
      const pointsData = await pointsRes.json();

      // 2. 2D 다항 회귀 모델 학습 후 기본 그리드(352×400) 픽셀 인덱스 구축
      this.proj.train(pointsData);
      this.indexCache.set(
        `${GRID_W}x${GRID_H}`,
        buildPixelIndex(this.areaForecastGeoJSON.features, this.proj, GRID_W, GRID_H)
      );

      // 3. GIF 픽셀 파싱용 오프스크린 캔버스 (크기는 프레임마다 실측값으로)
      if (typeof document !== 'undefined') {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize EstShindoMask:', err);
    }
  }

  /** 이미지 크기에 맞는 픽셀 인덱스 (352×400 외 크기는 기본 투영을 스케일해서 재라스터화) */
  private getIndex(w: number, h: number): Int16Array {
    const key = `${w}x${h}`;
    let idx = this.indexCache.get(key);
    if (idx) return idx;

    const scaled: PixelProjector = {
      toPixelF: (lon, lat) => {
        const p = this.proj.toPixelF(lon, lat);
        return p ? { x: (p.x * w) / GRID_W, y: (p.y * h) / GRID_H } : null;
      }
    };
    idx = buildPixelIndex(this.areaForecastGeoJSON.features, scaled, w, h);
    this.indexCache.set(key, idx);
    return idx;
  }

  /**
   * GIF → 피처 인덱스별 최대 진도. 실패/빈 프레임(서버 1×1 fallback 포함)이면
   * null — 호출부가 setSource를 생략해 직전 마스크를 유지한다.
   */
  private processEstShindoGif(gifUrl: string): Promise<Map<number, number> | null> {
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
          const data = ctx.getImageData(0, 0, w, h).data;

          resolve(decodeFrameMax(this.getIndex(w, h), data, w, h, getJindoFromColorStrict));
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

    const maxMap = await this.processEstShindoGif(gifUrl);
    if (!maxMap) return null;

    let colored = 0;
    let maxJindo = -3;
    const features = this.areaForecastGeoJSON.features.map((feature: any, fi: number) => {
      const mj = maxMap.get(fi) ?? -3;
      const scale = jindoToScale(mj);
      if (scale > 0) {
        colored++;
        if (mj > maxJindo) maxJindo = mj;
      }
      const color = scale > 0 ? getIntensityColor(scale) : 'transparent';
      return {
        ...feature,
        properties: { ...feature.properties, color, opacity: maskOpacity(mj), maxJindo: mj }
      };
    });

    dbg(`마스크 갱신: 색칠 ${colored}/${features.length}, 최대 진도 ${maxJindo}`);
    return { type: 'FeatureCollection', features };
  }
}

function maskOpacity(maxJindo: number): number {
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
