import { ui } from './state.svelte';
import { processFrame } from './detector';
import { getJindoString, jindoToScale } from './jma-utils';
import { soundService } from './services/sound';
import { notificationService } from './services/notification.svelte';
import { alertFilterPasses } from './alert-filter';
import { dbg } from './debug';
import { TIMING, VIEW } from './config';
import type { MapController } from './map-controller';

// 감지 활성화 플래그 — app-init이 ?detect=true를 강제 세팅하므로 'false'로 명시한 경우에만 끔
const DETECT_ENABLED =
  typeof window === 'undefined' || new URLSearchParams(window.location.search).get('detect') !== 'false';

// 마지막 이미지 요청 식별자 — 늦게 도착한 이전 로드의 onload가 최신 프레임을 덮지 않게 함
let latestImgReq = 0;

export interface RealtimeHost {
  readonly geojson: any | null;
  readonly stationsState: Map<string, any>;
  readonly mapCtl: MapController | null;
  updateEstShindoMask(): void;
  updateDetectedEvents(): void;
}

export async function fetchLatestTime(host: RealtimeHost): Promise<void> {
  try {
    const response = await fetch('/api/latest-time');
    if (response.ok) {
      const text = await response.text();
      const trimmed = text ? text.trim() : '';
      if (trimmed && trimmed.startsWith('{')) {
        try {
          const data = JSON.parse(trimmed);
          if (data && data.latest_time) {
            ui.latestTime = data.latest_time;

            // 강진 모니터 데이터 지연 대응: 타임스탬프에서 지정 초를 뺀다.
            const dateObj = new Date(data.latest_time.replace(/\//g, '-'));
            dateObj.setSeconds(dateObj.getSeconds() - TIMING.kmoniLagS);

            const pad = (n: number) => n.toString().padStart(2, '0');
            const timeStr = `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}${pad(dateObj.getSeconds())}`;

            processRealtimeImage(timeStr, host);
          }
        } catch {
          // Ignore malformed JSON gracefully
        }
      }
    }
  } catch {
    // Ignore network errors gracefully
  }
}

function processRealtimeImage(time: string, host: RealtimeHost): void {
  const geojson = host.geojson;
  if (!geojson) return;

  const dataType = ui.realtimeDataType;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const reqId = ++latestImgReq;
  img.src = `/api/realtime-img?time=${time}&type=${dataType}`;
  ui.currentGifUrl = img.src;
  ui.acmapGifUrl = `/api/acmap-img?time=${time}&type=${dataType}`;
  ui.estshindoGifUrl = `/api/estshindo-img?time=${time}`;

  if (ui.activeTab === 'est_shindo_region') {
    host.updateEstShindoMask();
  }

  img.onload = () => {
    if (reqId !== latestImgReq) return; // 더 최신 프레임 요청이 있으면 폐기
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const result = processFrame(imageData, canvas.width, canvas.height, geojson.features, host.stationsState, DETECT_ENABLED);

    if (result.soundJindo > -3) {
      const pass = alertFilterPasses(host.stationsState);
      dbg(`감지 jindo=${result.soundJindo.toFixed(1)} 필터=${pass ? '통과' : '차단'}`);
      if (pass) {
        soundService.playShakeDetected(result.soundJindo);
        // soundJindo는 계측진도 — 진도 코드로 환산 후 표기 (코드 미달이면 소수 표기)
        const scale = jindoToScale(result.soundJindo);
        notificationService.notifyShakingDetection(scale > 0 ? getJindoString(scale) : result.soundJindo.toFixed(1));
      }
    }

    if (result.newEventCenter) {
      host.mapCtl?.flyTo({ center: result.newEventCenter, ...VIEW.detectionFly, essential: true });
    }

    if (result.updated) {
      host.mapCtl?.setSource('points', geojson);
    }

    if (result.detectedUpdated) {
      host.updateDetectedEvents();
    }
  };
}
