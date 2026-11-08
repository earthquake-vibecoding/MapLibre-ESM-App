/**
 * SSE frame 이벤트 적용 — 서버 감지 전환으로 클라이언트는 판정하지 않고 푸시를 반영만 한다.
 * (구 realtime-img: latest-time 폴링 → 프레임 fetch → 캔버스 디코드 → processFrame — 전부 서버 detect-runner.mjs로 이전)
 * 사운드/알림은 개인 설정이라 여기서 재생.
 */
import { ui } from '../state.svelte';
import { getJindoString, jindoToScale } from '../quake/jma-utils';
import { soundService } from '../services/sound';
import { notificationService } from '../services/notification.svelte';
import { appendDetectionEntry } from './detection-log';
import { clearDetectedEvents } from './grid';
import { dbg } from '../debug';
import { VIEW } from '../config';
import type { MapController } from '../map/map-controller';

/** 서버 detect-runner.mjs가 1Hz로 방송하는 frame 이벤트 페이로드 */
export interface FrameEvent {
  time: string; // 14자리 JST
  delayMs: number;
  gif: string; // jma_s 프레임 base64 — 지도/GifView 표시용
  j: number[]; // 관측소 순서 계측진도×10 (-30 = 데이터 없음)
  c: number[]; // 관측소 순서 픽셀색 0xRRGGBB (-1 = 투명) — kmoni 연속 컬러맵 유지
  ev: { c: string; m: number; s: number }[]; // 이벤트 활성 관측소 (code, maxJindo×10, startTime)
  sound: number | null; // 이번 프레임 계급 상승 최대 계측진도
  center: [number, number] | null; // 신규 이벤트 중심
  ended: any | null; // 에피소드 종료 엔트리
}

export interface RealtimeHost {
  readonly geojson: any | null;
  readonly stationsState: Map<string, any>;
  readonly mapCtl: MapController | null;
  updateDetectedEvents(): void;
}

let lastFrame: FrameEvent | null = null;

/** 14자리 JST → 표시용 'YYYY/MM/DD HH:MM:SS' (로컬TZ 변환 금지 — kmoni JST 그대로) */
function formatJst(t: string): string {
  return `${t.slice(0, 4)}/${t.slice(4, 6)}/${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`;
}

/** 지표(jma_s=푸시 b64)/지중(jma_b=URL on-demand) 표시 소스 */
function currentGifSrc(e: FrameEvent): string {
  return ui.realtimeDataType === 'jma_s'
    ? `data:image/gif;base64,${e.gif}`
    : `/api/realtime-img?time=${e.time}&type=jma_b`;
}

export function applyFrameEvent(e: FrameEvent, host: RealtimeHost): void {
  const geojson = host.geojson;
  if (!geojson) return;
  lastFrame = e;

  ui.latestTime = formatJst(e.time);
  ui.currentGifUrl = currentGifSrc(e);
  ui.acmapGifUrl = `/api/acmap-img?time=${e.time}&type=${ui.realtimeDataType}`;
  ui.estshindoGifUrl = `/api/estshindo-img?time=${e.time}`;

  const evByCode = new Map(e.ev.map(v => [v.c, v]));
  const features = geojson.features;
  let visualChanged = false;

  for (let i = 0; i < features.length && i < e.j.length; i++) {
    const f = features[i];
    const stn = host.stationsState.get(f.properties.code);
    if (!stn) continue;

    const color = e.c[i] >= 0 ? `rgba(${(e.c[i] >> 16) & 255},${(e.c[i] >> 8) & 255},${e.c[i] & 255},1)` : 'transparent';
    if (f.properties.color !== color || stn.color !== color) {
      f.properties.color = color;
      stn.color = color;
      visualChanged = true;
    }

    const jindo = e.j[i] === -30 ? null : e.j[i] / 10;
    if (jindo !== null) {
      // delta/deltaSum — detector.ts와 동일 계산 (서버는 미디언 필터 적용된 jindo만 보냄)
      if (stn.jindo !== null) {
        stn.delta.unshift(jindo - stn.jindo);
        if (stn.delta.length > 10) stn.delta.pop();
        stn.deltaSum = stn.delta.reduce((acc: number, v: number) => acc + v, 0);
      }
      stn.jindo = jindo;
    } else if (stn.jindo !== null || stn.delta.length > 0) {
      stn.jindo = null;
      stn.delta = [];
      stn.deltaSum = 0;
      stn.rawJindoHistory = [];
    }

    // 이벤트 상태는 서버가 판정 — ev 목록과 대조해 반영/해제
    const evData = evByCode.get(stn.code);
    if (evData) {
      if (!stn.event || stn.event.startTime !== evData.s) {
        stn.event = { id: stn.code, startTime: evData.s, maxLevel: 0, maxJindo: evData.m / 10 };
        visualChanged = true;
      } else if (evData.m / 10 > (stn.event.maxJindo ?? -99)) {
        stn.event.maxJindo = evData.m / 10;
      }
    } else if (stn.event) {
      stn.event = null;
      visualChanged = true;
    }
  }

  if (visualChanged) {
    host.mapCtl?.setSource('points', geojson);
    host.updateDetectedEvents();
  }

  if (e.sound !== null) {
    dbg(`감지 jindo=${e.sound.toFixed(1)}`);
    soundService.playShakeDetected(e.sound);
    const scale = jindoToScale(e.sound);
    notificationService.notifyShakingDetection(scale > 0 ? getJindoString(scale) : e.sound.toFixed(1));
  }

  if (e.center) {
    host.mapCtl?.flyTo({ center: e.center, ...VIEW.detectionFly, essential: true });
  }

  if (e.ended) {
    appendDetectionEntry(e.ended);
    host.mapCtl?.fitFullView(800);
    clearDetectedEvents();
    host.updateDetectedEvents();
  }
}

/** jma_s↔jma_b 전환 시 — 마지막 프레임을 재적용해 표시 소스만 갱신 */
export function reapplyLastFrame(host: RealtimeHost): void {
  if (lastFrame && host.geojson) applyFrameEvent(lastFrame, host);
}
