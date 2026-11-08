// 서버 감지 코어 엔트리 — esbuild로 server/detect-core.mjs로 번들 (package.json build:detect).
// processFrame·에피소드 집계는 클라이언트와 동일 코드 — DOM 의존 0.
// state.svelte의 $state 룬은 --inject:server/state-shim.js --define:$state=__stateShim으로 일반 객체화.
import { processFrame } from '../src/lib/detect/detector';
import { computeNeighbors } from '../src/lib/detect/grid';
import {
  collectLiveEpisode,
  accumulateExpiredEvent,
  finishDetectionEpisode
} from '../src/lib/detect/detection-log';
import { jindoToScale, getJindoString, getIntensityColor } from '../src/lib/quake/jma-utils';
import { ui } from '../src/lib/state.svelte';
import { WEBHOOK } from '../src/lib/config';

export { processFrame, collectLiveEpisode, accumulateExpiredEvent, finishDetectionEpisode, WEBHOOK };

/** 관측소 초기화 — 클라이언트 stations.ts loadStations와 동일 구조/순서 (SSE j[] 인덱스 정렬 보장) */
export function initDetectCore(points: any[]) {
  ui.locale = 'ko'; // 서버 라벨(웹후크 scaleLabel) 한국어 고정 — node navigator(en-US) 자동감지 무시
  const stationsState = new Map<string, any>();
  const stnArray: any[] = [];
  const features = points
    .filter((p: any) => p.Location && !p.IsSuspended && p.Point)
    .map((p: any) => {
      const lon = p.Location.longitude;
      const lat = p.Location.latitude;
      const stn = {
        code: p.Code,
        name: p.Name as string,
        region: p.Region as string,
        lonlat: [lon, lat],
        jindo: null as number | null,
        rawJindoHistory: [] as number[],
        near: [] as any[],
        delta: [] as number[],
        deltaSum: 0,
        event: null as any,
        expireTime: null as number | null,
        color: 'transparent'
      };
      stationsState.set(p.Code, stn);
      stnArray.push(stn);
      return {
        type: 'Feature',
        geometry: null,
        properties: { name: p.Name, code: p.Code, region: p.Region, px: p.Point.x, py: p.Point.y, color: 'transparent' }
      };
    });
  computeNeighbors(stnArray);
  return { features, stationsState };
}

/** 웹후크 에피소드 바디 — 클라이언트 services/webhook.ts episodeBody와 동일 */
export function makeEpisodeBody(
  start: number,
  end: number,
  count: number,
  center: [number, number] | null,
  maxJindo: number,
  top: { name: string; region: string; jindo: number } | null
) {
  const scale = jindoToScale(maxJindo);
  return {
    start,
    end,
    count,
    center,
    maxJindo: Math.round(maxJindo * 10) / 10,
    scaleLabel: getJindoString(scale),
    color: getIntensityColor(scale),
    top
  };
}
