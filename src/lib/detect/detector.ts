import { applyMedianFilter } from './noise-filter';
import { getJindoFromColor } from '../quake/jma-utils';
import { DETECT } from '../config';
import { updateEventMax } from './detect-levels';

export interface DetectResult {
  updated: boolean;
  detectedUpdated: boolean;
  newEventCenter: [number, number] | null;
  soundJindo: number;
}

export function processFrame(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  features: any[],
  stationsState: Map<string, any>,
  detectEnabled: boolean
): DetectResult {
  let updated = false;
  let detectedUpdated = false;
  let newEventId: number | null = null; // 이번 프레임에서 새로 생성된 첫 이벤트 — 카메라 중심은 이 이벤트 관측소만으로 계산
  let detectedCenter: [number, number] | null = null;
  let soundJindoToPlay = -3;

  for (const feature of features) {
    const px = feature.properties.px;
    const py = feature.properties.py;
    if (px >= 0 && px < width && py >= 0 && py < height) {
      const idx = (py * width + px) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const a = imageData[idx + 3];

      let newColor = 'transparent';
      let jindo: number | null = null;
      if (a > 0) {
        newColor = `rgba(${r},${g},${b},${a / 255})`;
        jindo = getJindoFromColor(r, g, b);
      }
      if (feature.properties.color !== newColor) {
        feature.properties.color = newColor;
        updated = true;
      }

      if (detectEnabled) {
        const stn = stationsState.get(feature.properties.code);
        if (stn) {
          stn.color = newColor;
          if (jindo !== null) {
            // 노이즈 필터 적용 (3프레임 미디언 필터로 글리치 완전 제거)
            const filteredJindo = applyMedianFilter(stn, jindo);

            let delta = 0;
            if (stn.jindo !== null) {
              delta = filteredJindo - stn.jindo;
            }
            stn.jindo = filteredJindo;
            stn.delta.unshift(delta);
            if (stn.delta.length > DETECT.deltaWindow) stn.delta.pop();

            stn.deltaSum = stn.delta.reduce((acc: number, val: number) => acc + val, 0);
          } else {
            stn.jindo = null;
            stn.delta = [];
            stn.deltaSum = 0;
            stn.rawJindoHistory = []; // 미디언 버퍼도 리셋 — 투명 프레임 후 옛 값이 끼지 않게
          }
        }
      }
    }
  }

  if (!detectEnabled) {
    return { updated, detectedUpdated: false, newEventCenter: null, soundJindo: -3 };
  }

  const stations = Array.from(stationsState.values());
  const nowTick = Date.now();

  for (const stn of stations) {
    // 이상치 필터링: 흔들림 감지 중이 아님 & 최근 데이터 있음 & 10초간 변화량 0.8 미만 & 진도 3(도서는 5약) 이상
    const isIsland = stn.near.length === 0;
    const isAnomaly = !stn.event && stn.deltaSum < DETECT.neighborRise && stn.jindo !== null
      && stn.jindo >= (isIsland ? DETECT.anomalyJindoIsland : DETECT.anomalyJindo);

    if (isAnomaly) continue;

    if (stn.deltaSum > DETECT.riseThreshold) {
      const u = stn.near;
      let targetEvent = stn.event;

      if (!targetEvent) {
        // 주변에 이미 이벤트가 있다면 병합
        const neighborWithEvent = u.find((r: any) => r.event);
        if (neighborWithEvent) {
          targetEvent = neighborWithEvent.event;
        } else {
          // 주변 관측점도 상승했는지 확인
          let rCount = 0;
          for (const neighbor of u) {
            if (neighbor.deltaSum > DETECT.neighborRise) rCount++;
          }

          // 도서지역 강진 예외
          const isIslandAndStrong = isIsland && stn.jindo !== null && stn.jindo >= DETECT.islandStrongJindo;

          // 주변 관측점 확인 (비율 + 최소 개수)
          const neighborRatio = u.length > 0 ? (rCount / u.length) : 0;
          const hasEnoughNeighbors = u.length > 0 && (rCount >= DETECT.neighborMinCount || rCount === u.length)
            && neighborRatio >= DETECT.neighborMinRatio;

          // 최소 진도 기준
          const isFelt = stn.jindo !== null && stn.jindo >= DETECT.feltJindo;

          if (isFelt && (isIslandAndStrong || hasEnoughNeighbors)) {
            targetEvent = {
              id: Math.random(),
              startTime: nowTick,
              maxLevel: 0,
              maxJindo: stn.jindo
            };
            if (newEventId === null) newEventId = targetEvent.id;
            detectedCenter = stn.lonlat;
          }
        }
      } else {
        // 진행 중인 이벤트가 주변 이벤트와 만나면 병합 (더 오래된 이벤트로)
        const otherEventStn = u.find((r: any) => r.event && r.event.id !== targetEvent.id);
        if (otherEventStn && otherEventStn.event.startTime < targetEvent.startTime) {
          targetEvent = otherEventStn.event;
        }
      }

      if (targetEvent) {
        stn.event = targetEvent;
        soundJindoToPlay = updateEventMax(targetEvent, stn.jindo, soundJindoToPlay);
        stn.expireTime = Date.now() + DETECT.expireMs;
        detectedUpdated = true;
      }
    } else if (stn.event && stn.jindo !== null && stn.jindo >= DETECT.sustainJindo) {
      // 감지된 이벤트가 존재하고 흔들림이 지속되는 경우 격자 유지
      soundJindoToPlay = updateEventMax(stn.event, stn.jindo, soundJindoToPlay);
      stn.expireTime = Date.now() + DETECT.expireMs;
      detectedUpdated = true;
    }
  }

  if (newEventId !== null) {
    // 신규 이벤트 관측소만으로 중심 계산 — 만료 대기 중인 옛 이벤트가 섞이면 두 진원 사이로 카메라가 감
    const newEventStations = Array.from(stationsState.values()).filter(s => s.event?.id === newEventId);
    if (newEventStations.length > 0) {
      const sumLon = newEventStations.reduce((acc, s) => acc + s.lonlat[0], 0);
      const sumLat = newEventStations.reduce((acc, s) => acc + s.lonlat[1], 0);
      detectedCenter = [sumLon / newEventStations.length, sumLat / newEventStations.length];
    }
  } else {
    detectedCenter = null;
  }

  return { updated, detectedUpdated, newEventCenter: detectedCenter, soundJindo: soundJindoToPlay };
}
