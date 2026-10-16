import { getIntensityColor, getJindoString } from './jma-utils';

function norm(s: string): string {
  return s ? s.replace(/県|府|都|道| /g, '') : '';
}

function matchAreaCode(
  name: string,
  areaNameToCode: Map<string, string>,
  stationToAreaCode: Map<string, string>
): string | null {
  let code = areaNameToCode.get(name) || stationToAreaCode.get(name);
  if (code) return code;

  const normName = norm(name);
  for (const [aName, aCode] of areaNameToCode.entries()) {
    if (norm(aName) === normName || normName.includes(norm(aName)) || norm(aName).includes(normName)) {
      return aCode;
    }
  }
  return null;
}

export function buildAreaScaleMap(
  quakeData: any,
  areaNameToCode: Map<string, string>,
  stationToAreaCode: Map<string, string>
): Map<string, number> {
  const points = quakeData?.points || quakeData?.earthquake?.points;
  const areas = quakeData?.areas;
  const areaScaleMap = new Map<string, number>();

  // 1. 관측지점 기반 진도 (P2PQuake 551 등)
  if (Array.isArray(points) && points.length > 0) {
    for (const p of points) {
      // 예상/관측 진도가 1 이상 (scale >= 10)일 때만 색칠
      if (!p || typeof p.scale !== 'number' || p.scale < 10) continue;
      const addr = p.addr;
      if (!addr) continue;

      const code = matchAreaCode(addr, areaNameToCode, stationToAreaCode);
      if (code && p.scale > (areaScaleMap.get(code) || 0)) {
        areaScaleMap.set(code, p.scale);
      }
    }
  }

  // 2. EEW / 긴급지진속보 예보구역 기반 예상 진도 (P2PQuake 556 등)
  if (Array.isArray(areas) && areas.length > 0) {
    for (const a of areas) {
      const scale = a.scaleFrom || a.scaleTo || a.scale || 0;
      // 예상 진도 1 이상 (scale >= 10)일 때만 색칠
      if (scale < 10) continue;

      const areaName = a.name || a.prefName;
      if (!areaName) continue;

      const code = matchAreaCode(areaName, areaNameToCode, stationToAreaCode);
      if (code && scale > (areaScaleMap.get(code) || 0)) {
        areaScaleMap.set(code, scale);
      }
    }
  }

  return areaScaleMap;
}

export function buildStationFeatures(points: any[], stationMap: Map<string, any>): any[] {
  const stationFeatures: any[] = [];
  if (!Array.isArray(points) || points.length === 0 || stationMap.size === 0) return stationFeatures;

  for (const pt of points) {
    if (!pt || typeof pt.scale !== 'number' || pt.scale < 10) continue;
    const key = (pt.pref || '') + pt.addr;
    const st = stationMap.get(key) || stationMap.get(pt.addr);
    if (st) {
      stationFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [st.lon, st.lat] },
        properties: {
          name: pt.addr,
          pref: pt.pref || st.pref || '',
          scale: pt.scale,
          jindoStr: getJindoString(pt.scale),
          color: getIntensityColor(pt.scale),
          affi: st.affi || '기상청',
          lat: st.lat,
          lon: st.lon
        }
      });
    }
  }
  return stationFeatures;
}

export interface AreaIntensityDeps {
  quakeData: any;
  areaForecastGeoJSON: any;
  areaNameToCode: Map<string, string>;
  stationToAreaCode: Map<string, string>;
  stationMap: Map<string, any>;
  isEarthquakeTab: boolean;
}

export function applyAreaIntensity(map: any, deps: AreaIntensityDeps): void {
  const { quakeData, areaForecastGeoJSON, areaNameToCode, stationToAreaCode, stationMap, isEarthquakeTab } = deps;
  if (!map || !map.getSource('area-forecast') || !areaForecastGeoJSON) return;

  const areaScaleMap = buildAreaScaleMap(quakeData, areaNameToCode, stationToAreaCode);

  for (const f of areaForecastGeoJSON.features) {
    const code = f.properties?.code;
    const scale = areaScaleMap.get(code);
    if (scale && scale >= 10) {
      f.properties.color = getIntensityColor(scale);
      f.properties.opacity = isEarthquakeTab ? 0.88 : 0.65;
    } else {
      f.properties.color = 'transparent';
      f.properties.opacity = 0;
    }
  }

  map.getSource('area-forecast').setData({
    type: 'FeatureCollection',
    features: [...areaForecastGeoJSON.features]
  });

  // 관측소 개별 지점 마커 데이터 업데이트
  const points = quakeData?.points || quakeData?.earthquake?.points;
  const stationFeatures = buildStationFeatures(points, stationMap);

  if (map.getSource('quake-stations')) {
    map.getSource('quake-stations').setData({
      type: 'FeatureCollection',
      features: stationFeatures
    });
  }
}
