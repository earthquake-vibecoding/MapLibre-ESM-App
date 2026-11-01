import { isActiveEEW, parseJSTTime } from './quake-utils';
import { WAVE } from './config';

export interface SeismicTable {
  [depth: string]: { distance: number; pTime: number; sTime: number }[];
}

export function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
  if (radiusInKm <= 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  const coords = { latitude: center[1], longitude: center[0] };
  const distanceX = radiusInKm / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
  const distanceY = radiusInKm / 110.574;

  const ret: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ret]
      },
      properties: {}
    }]
  };
}

function radiusFromTjma(seismicData: SeismicTable, elapsedTime: number, depth: number, type: 'p' | 's'): number {
  if (!seismicData || Object.keys(seismicData).length === 0) return 0;

  const depths = Object.keys(seismicData).map(Number).sort((a, b) => a - b);
  if (depths.length === 0) return 0;

  let closestDepth = depths[0];
  let minDiffDepth = Infinity;
  for (const d of depths) {
    const diff = Math.abs(d - depth);
    if (diff < minDiffDepth) {
      minDiffDepth = diff;
      closestDepth = d;
    }
  }

  const table = seismicData[closestDepth.toString()];
  if (!table || table.length === 0) return 0;

  let closestDist = 0;

  for (let i = 0; i < table.length; i++) {
    const point = table[i];
    const time = type === 'p' ? point.pTime : point.sTime;
    if (time <= elapsedTime) {
      closestDist = point.distance;
    } else {
      if (i > 0) {
        const prev = table[i - 1];
        const prevTime = type === 'p' ? prev.pTime : prev.sTime;
        const fraction = (elapsedTime - prevTime) / (time - prevTime);
        return prev.distance + fraction * (point.distance - prev.distance);
      }
      break;
    }
  }

  return closestDist;
}

export interface WaveState {
  active: boolean;
  pFc: any;
  sFc: any;
  pFade: number;
  sFade: number;
}

export async function fetchSeismicData(): Promise<SeismicTable> {
  try {
    const res = await fetch('/api/seismic-data');
    const data = await res.json();
    if (data && typeof data === 'object' && Object.keys(data).length > 0) return data;
  } catch (e) {
    console.warn('Failed to load seismic data from API, trying fallback:', e);
  }
  try {
    const res = await fetch('/tjma.json');
    const data = await res.json();
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      console.log('Successfully loaded seismic data from fallback /tjma.json');
      return data;
    }
  } catch (err) {
    console.error('Failed to load seismic data fallback /tjma.json', err);
  }
  return {};
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

export function computeWaveState(
  eew: any,
  seismicData: SeismicTable,
  now: number
): WaveState {
  const active = !!(eew && isActiveEEW(eew));
  if (!active) {
    return { active: false, pFc: EMPTY_FC, sFc: EMPTY_FC, pFade: 0, sFade: 0 };
  }

  let elapsedSeconds = 0;
  let depth = 10;
  let center: [number, number] = [0, 0];

  if (eew.isSimulation) {
    elapsedSeconds = (now - (eew.simulationStartTime || now)) / 1000 + (eew.simulatedElapsed || 5);
  } else {
    const origin = parseJSTTime(eew.OriginTime || eew.AnnouncedTime);
    elapsedSeconds = (now - origin) / 1000;
  }
  depth = (typeof eew.Depth === 'number' && eew.Depth > 0) ? eew.Depth : 10;
  center = [eew.Longitude || 0, eew.Latitude || 0];
  const mag = (typeof eew.Magunitude === 'number' && eew.Magunitude > 0) ? eew.Magunitude : 6.0;

  if (elapsedSeconds <= 0) {
    return { active: true, pFc: EMPTY_FC, sFc: EMPTY_FC, pFade: 0, sFade: 0 };
  }

  let pRadius = 0;
  let sRadius = 0;

  if (Object.keys(seismicData).length > 0) {
    pRadius = radiusFromTjma(seismicData, elapsedSeconds, depth, 'p');
    sRadius = radiusFromTjma(seismicData, elapsedSeconds, depth, 's');
  }

  if (!pRadius || pRadius <= 0) {
    const pDistance = WAVE.fallbackPKmsPerS * elapsedSeconds;
    pRadius = pDistance > depth ? Math.sqrt(pDistance * pDistance - depth * depth) : pDistance;
  }
  if (!sRadius || sRadius <= 0) {
    const sDistance = WAVE.fallbackSKmsPerS * elapsedSeconds;
    sRadius = sDistance > depth ? Math.sqrt(sDistance * sDistance - depth * depth) : sDistance;
  }

  let maxSRadius: number = WAVE.maxRadiusDefault;
  for (const [magUnder, radius] of WAVE.maxRadiusByMag) {
    if (mag < magUnder) {
      maxSRadius = radius;
      break;
    }
  }

  const maxPRadius = maxSRadius * 1.25;
  const pFade = Math.max(0, 1 - Math.pow(pRadius / maxPRadius, 2));
  const sFade = Math.max(0, 1 - Math.pow(sRadius / maxSRadius, 2));

  const pFc = (pRadius < maxPRadius && pFade > 0.01) ? createGeoJSONCircle(center, pRadius, 36) : EMPTY_FC;
  const sFc = (sRadius < maxSRadius && sFade > 0.01) ? createGeoJSONCircle(center, sRadius, 36) : EMPTY_FC;

  return { active: true, pFc, sFc, pFade, sFade };
}
