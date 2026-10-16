import { applyMedianFilter } from './noise-filter';
import { getJindoFromColor } from './jma-utils';

export interface DetectResult {
  updated: boolean;
  detectedUpdated: boolean;
  newEventCenter: [number, number] | null;
  soundJindo: number;
}

// Qiita logic: Weaker(1), Weak(2), Medium(3), Strong(4), Stronger(5)
function getLevel(jindo: number | null): number {
  if (jindo === null) return 0;
  if (jindo < -1.0) return 1;
  if (jindo < 1.0) return 2;
  if (jindo < 3.0) return 3;
  if (jindo < 4.5) return 4;
  return 5;
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
  let newEventDetected = false;
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
            if (stn.delta.length > 10) stn.delta.pop();

            stn.deltaSum = stn.delta.reduce((acc: number, val: number) => acc + val, 0);
          } else {
            stn.jindo = null;
            stn.delta = [];
            stn.deltaSum = 0;
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
    const isAnomaly = !stn.event && stn.deltaSum < 0.8 && stn.jindo !== null && stn.jindo >= (isIsland ? 4.5 : 3.0);

    if (isAnomaly) continue;

    if (stn.deltaSum > 1.2) {
      const u = stn.near;
      let targetEvent = stn.event;

      if (!targetEvent) {
        // 주변에 이미 이벤트가 있다면 병합
        const neighborWithEvent = u.find((r: any) => r.event);
        if (neighborWithEvent) {
          targetEvent = neighborWithEvent.event;
        } else {
          // 주변 관측점도 상승했는지 확인 (임계값 0.8)
          let rCount = 0;
          for (const neighbor of u) {
            if (neighbor.deltaSum > 0.8) rCount++;
          }

          // 도서지역 강진 예외
          const isIslandAndStrong = isIsland && stn.jindo !== null && stn.jindo >= 4.2;

          // 주변 관측점 확인 (비율 60% 이상 및 조건 충족)
          const neighborRatio = u.length > 0 ? (rCount / u.length) : 0;
          const hasEnoughNeighbors = u.length > 0 && (rCount >= 2 || rCount === u.length) && neighborRatio >= 0.6;

          // 최소 진도 기준 (-0.5 이상)
          const isFelt = stn.jindo !== null && stn.jindo >= -0.5;

          if (isFelt && (isIslandAndStrong || hasEnoughNeighbors)) {
            targetEvent = {
              id: Math.random(),
              startTime: nowTick,
              maxLevel: 0
            };
            newEventDetected = true;
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

        const currentLevel = getLevel(stn.jindo);
        if (currentLevel > targetEvent.maxLevel) {
          targetEvent.maxLevel = currentLevel;
          if (stn.jindo !== null && stn.jindo > soundJindoToPlay) {
            soundJindoToPlay = stn.jindo;
          }
        }

        // 검출 종료 시간 갱신 (진도에 따라 유동적으로 연장)
        stn.expireTime = Date.now() + 10000;
        detectedUpdated = true;
      }
    } else if (stn.event && stn.jindo !== null && stn.jindo >= -0.5) {
      // 감지된 이벤트가 존재하고 흔들림이 지속되는 경우 격자 유지
      const currentLevel = getLevel(stn.jindo);
      if (currentLevel > stn.event.maxLevel) {
        stn.event.maxLevel = currentLevel;
        if (stn.jindo !== null && stn.jindo > soundJindoToPlay) {
          soundJindoToPlay = stn.jindo;
        }
      }

      stn.expireTime = Date.now() + 10000;
      detectedUpdated = true;
    }
  }

  if (newEventDetected) {
    const newlyTriggered = Array.from(stationsState.values()).filter(s => s.event !== null);
    if (newlyTriggered.length > 0) {
      const sumLon = newlyTriggered.reduce((acc, s) => acc + s.lonlat[0], 0);
      const sumLat = newlyTriggered.reduce((acc, s) => acc + s.lonlat[1], 0);
      detectedCenter = [sumLon / newlyTriggered.length, sumLat / newlyTriggered.length];
    }
  } else {
    detectedCenter = null;
  }

  return { updated, detectedUpdated, newEventCenter: detectedCenter, soundJindo: soundJindoToPlay };
}
