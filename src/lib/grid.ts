/** 두 관측점 거리(km) — haversine */
export function haversineKm(a: number[], b: number[]): number {
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function computeNeighbors(stnArray: any[]): void {
  // 이웃 관측소 계산 (농어가/도서지역 대응 20km~30km 적응형)
  for (let i = 0; i < stnArray.length; i++) {
    const nearDists: { stn: any; dist: number }[] = [];
    for (let j = 0; j < stnArray.length; j++) {
      if (i === j) continue;
      const dist = haversineKm(stnArray[i].lonlat, stnArray[j].lonlat);
      if (dist <= 30) {
        nearDists.push({ stn: stnArray[j], dist });
      }
    }
    nearDists.sort((a, b) => a.dist - b.dist);
    stnArray[i].near = nearDists.filter((item, idx) => item.dist <= 20 || idx < 3).map(item => item.stn);
  }
}

export interface DetectedGrids {
  features: any[];
  gridCount: number;
}

export function buildDetectedFeatures(stationsState: Map<string, any>): DetectedGrids {
  const originLon = 120;
  const originLat = 20;
  const latStep = 90 / 111.32; // ~0.808 deg per ~90km

  const activeGrids = new Map<string, { color: string; maxJindo: number; gridX: number; gridY: number }>();

  for (const stn of stationsState.values()) {
    if (stn.event) {
      const lat = stn.lonlat[1];
      const lon = stn.lonlat[0];
      const gridY = Math.floor((lat - originLat) / latStep);
      const cellLat = originLat + (gridY + 0.5) * latStep;
      const lonStepAtLat = 90 / (111.32 * Math.cos(cellLat * Math.PI / 180));
      const gridX = Math.floor((lon - originLon) / lonStepAtLat);
      const cellId = `${gridX}-${gridY}`;

      const current = activeGrids.get(cellId);
      const stnJindo = stn.jindo !== null ? stn.jindo : -3;

      if (!current || stnJindo > current.maxJindo) {
        activeGrids.set(cellId, { color: stn.color, maxJindo: stnJindo, gridX, gridY });
      }
    }
  }

  const features: any[] = [];
  for (const data of activeGrids.values()) {
    const { gridX, gridY } = data;
    const minLat = originLat + gridY * latStep;
    const maxLat = originLat + (gridY + 1) * latStep;
    const cellLat = originLat + (gridY + 0.5) * latStep;
    const lonStepAtLat = 90 / (111.32 * Math.cos(cellLat * Math.PI / 180));
    const minLon = originLon + gridX * lonStepAtLat;
    const maxLon = originLon + (gridX + 1) * lonStepAtLat;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat]
        ]]
      },
      properties: {
        color: data.color
      }
    });
  }

  return { features, gridCount: activeGrids.size };
}

export function clearDetectedEvents(): void {
  try {
    localStorage.removeItem('eq_detected_stations');
  } catch {
    // ignore
  }
}

export function saveDetectedEvents(stationsState: Map<string, any>): void {
  if (typeof localStorage === 'undefined') return;
  const activeStations: any[] = [];
  for (const stn of stationsState.values()) {
    if (stn.event) {
      activeStations.push({
        code: stn.code,
        jindo: stn.jindo,
        color: stn.color,
        event: stn.event
      });
    }
  }

  if (activeStations.length > 0) {
    try {
      localStorage.setItem('eq_detected_stations', JSON.stringify({
        timestamp: Date.now(),
        stations: activeStations
      }));
    } catch {
      // quota/private mode — 저장 실패는 치명적이지 않음
    }
  } else {
    clearDetectedEvents();
  }
}

export function loadDetectedEvents(stationsState: Map<string, any>): { restored: boolean; restoredCount: number } {
  if (typeof localStorage === 'undefined') return { restored: false, restoredCount: 0 };
  try {
    const raw = localStorage.getItem('eq_detected_stations');
    if (!raw) return { restored: false, restoredCount: 0 };
    const data = JSON.parse(raw);
    if (!data || !data.timestamp || !Array.isArray(data.stations)) {
      return { restored: false, restoredCount: 0 };
    }

    const elapsed = Date.now() - data.timestamp;
    // 5분(300,000ms) 이내의 저장 데이터만 유효
    if (elapsed > 300000) {
      localStorage.removeItem('eq_detected_stations');
      return { restored: false, restoredCount: 0 };
    }

    const remainingTimeout = Math.max(3000, 15000 - elapsed);
    let restoredAny = false;
    let restoredCount = 0;

    for (const saved of data.stations) {
      const stn = stationsState.get(saved.code);
      if (stn) {
        stn.jindo = saved.jindo;
        stn.color = saved.color || '#f59e0b';
        stn.event = saved.event;
        restoredAny = true;

        if (stn.lonlat) {
          restoredCount++;
        }

        stn.expireTime = Date.now() + remainingTimeout;
      }
    }

    return { restored: restoredAny, restoredCount };
  } catch (e) {
    console.warn('Failed to load saved detected events', e);
    return { restored: false, restoredCount: 0 };
  }
}
