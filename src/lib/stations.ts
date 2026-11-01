import { computeNeighbors } from './grid';

export interface StationLoadResult {
  geojson: any;
  stationsState: Map<string, any>;
}

export async function loadStations(): Promise<StationLoadResult> {
  try {
    const res = await fetch('/intensity-points-v1.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const points = await res.json();

    const stationsState = new Map<string, any>();
    const stnArray: any[] = [];
    const features = points.filter((p: any) => p.Location && !p.IsSuspended && p.Point).map((p: any) => {
      const lon = p.Location.longitude;
      const lat = p.Location.latitude;
      const stn = {
        code: p.Code,
        name: p.Name as string,
        region: p.Region as string,
        lonlat: [lon, lat],
        jindo: null as number | null,
        near: [] as any[],
        delta: [] as number[],
        deltaSum: 0,
        history: [] as { t: number; j: number | null }[], // 최근 60프레임(≈1분) 진도 추이
        event: null as any,
        expireTime: null as number | null,
        color: 'transparent'
      };
      stationsState.set(p.Code, stn);
      stnArray.push(stn);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          name: p.Name,
          code: p.Code,
          region: p.Region,
          px: p.Point.x,
          py: p.Point.y,
          color: 'transparent'
        }
      };
    });

    computeNeighbors(stnArray);

    return {
      geojson: {
        type: 'FeatureCollection',
        features
      },
      stationsState
    };
  } catch (e) {
    console.error('관측점 데이터 로드 실패 — 빈 데이터로 계속:', e);
    return { geojson: { type: 'FeatureCollection', features: [] }, stationsState: new Map() };
  }
}
