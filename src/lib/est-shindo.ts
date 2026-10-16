import { getJindoFromColor, getIntensityColor } from './jma-utils';
import { PolyProj, buildLUT } from './polyfit';
import type { MapController } from './map-controller';

class EstShindoMask {
  private areaForecastGeoJSON: any = null;
  private pointsData: any[] = [];
  private lut = new Map<string, { x: number; y: number }[]>();
  private isInitialized = false;
  private proj = new PolyProj();

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
      this.pointsData = await pointsRes.json();

      // 2. 2D 다항 회귀 모델 학습
      this.proj.train(this.pointsData);

      // 3. 예보구역 폴리곤 Lookup Table
      if (this.areaForecastGeoJSON?.features) {
        this.lut = buildLUT(this.areaForecastGeoJSON.features, this.proj);
      }

      // 4. GIF 픽셀 파싱용 오프스크린 캔버스
      if (typeof document !== 'undefined') {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 352;
        this.offscreenCanvas.height = 400;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize EstShindoMask:', err);
    }
  }

  async processEstShindoGif(gifUrl: string): Promise<Map<string, { maxJindo: number; color: string }>> {
    const resultMap = new Map<string, { maxJindo: number; color: string }>();

    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.offscreenCtx || !gifUrl) return resultMap;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const ctx = this.offscreenCtx!;
          ctx.clearRect(0, 0, 352, 400);
          ctx.drawImage(img, 0, 0, 352, 400);

          const data = ctx.getImageData(0, 0, 352, 400).data;

          for (const [code, pixels] of this.lut.entries()) {
            let maxJindo = -3;

            for (const p of pixels) {
              const idx = (p.y * 352 + p.x) * 4;
              const a = data[idx + 3];
              if (a < 10) continue;

              const jindo = getJindoFromColor(data[idx], data[idx + 1], data[idx + 2]);
              if (jindo > maxJindo) {
                maxJindo = jindo;
              }
            }

            const scale = jindoToScale(maxJindo);
            const color = scale > 0 ? getIntensityColor(scale) : 'transparent';
            resultMap.set(code, { maxJindo, color });
          }

          resolve(resultMap);
        } catch (err) {
          console.error('Error parsing EstShindo GIF pixels:', err);
          resolve(resultMap);
        }
      };

      img.onerror = () => {
        resolve(resultMap);
      };

      img.src = gifUrl;
    });
  }

  async getMaskedGeoJSON(gifUrl: string): Promise<any> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.areaForecastGeoJSON) return null;

    const areaIntensityMap = await this.processEstShindoGif(gifUrl);

    return {
      type: 'FeatureCollection',
      features: this.areaForecastGeoJSON.features.map((feature: any) => {
        const code = feature.properties?.code;
        const info = areaIntensityMap.get(code);

        const color = info && info.color !== 'transparent' ? info.color : 'transparent';
        const opacity = maskOpacity(info);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            color,
            opacity,
            maxJindo: info ? info.maxJindo : -3
          }
        };
      })
    };
  }
}

function jindoToScale(maxJindo: number): number {
  if (maxJindo >= 6.5) return 60;
  if (maxJindo >= 6.0) return 55;
  if (maxJindo >= 5.5) return 50;
  if (maxJindo >= 5.0) return 46;
  if (maxJindo >= 4.5) return 45;
  if (maxJindo >= 3.5) return 40;
  if (maxJindo >= 2.5) return 30;
  if (maxJindo >= 1.5) return 20;
  if (maxJindo >= 0.5) return 10;
  return 0;
}

function maskOpacity(info?: { color: string; maxJindo: number }): number {
  if (!info || info.color === 'transparent') return 0.0;

  const mj = info.maxJindo;
  if (mj >= 6.5) return 0.95;       // 진도 7
  if (mj >= 5.5) return 0.90;       // 진도 6약, 6강
  if (mj >= 4.5) return 0.85;       // 진도 5약, 5강
  if (mj >= 3.5) return 0.75;       // 진도 4
  if (mj >= 2.5) return 0.60;       // 진도 3
  if (mj >= 1.5) return 0.45;       // 진도 2
  if (mj >= 0.5) return 0.30;       // 진도 1
  return 0.20;
}

export const estShindoMask = new EstShindoMask();

export async function updateMaskLayer(mapCtl: MapController | null, gifUrl: string): Promise<void> {
  if (!gifUrl || !mapCtl) return;
  try {
    const maskedGeoJSON = await estShindoMask.getMaskedGeoJSON(gifUrl);
    if (maskedGeoJSON) mapCtl.setSource('est-shindo-mask-area', maskedGeoJSON);
  } catch (err) {
    console.warn('Failed to update EstShindo mask layer:', err);
  }
}
