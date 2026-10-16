import { computeNeighbors } from './grid';

export interface StationLoadResult {
  geojson: any;
  stationsState: Map<string, any>;
}

export async function loadStations(): Promise<StationLoadResult> {
  const res = await fetch('/intensity-points-v1.json');
  const points = await res.json();

  const stationsState = new Map<string, any>();
  const stnArray: any[] = [];
  const features = points.filter((p: any) => p.Location && !p.IsSuspended && p.Point).map((p: any) => {
    const lon = p.Location.longitude;
    const lat = p.Location.latitude;
    const stn = {
      code: p.Code,
      lonlat: [lon, lat],
      jindo: null as number | null,
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
}
