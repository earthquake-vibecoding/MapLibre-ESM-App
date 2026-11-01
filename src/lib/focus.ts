import type { MapController } from './map-controller';
import { isEewCoordValid } from './quake-utils';
import { VIEW } from './config';

export function focusActiveGrids(mapCtl: MapController | null, stationsState: Map<string, any>): boolean {
  if (!mapCtl) return false;
  const activeStations: any[] = [];
  for (const stn of stationsState.values()) {
    if (stn.event && stn.lonlat) {
      activeStations.push(stn);
    }
  }

  if (activeStations.length === 0) return false;

  let totalLon = 0;
  let totalLat = 0;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;

  for (const stn of activeStations) {
    const [lon, lat] = stn.lonlat;
    totalLon += lon;
    totalLat += lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (activeStations.length === 1 || (maxLon - minLon < 0.2 && maxLat - minLat < 0.2)) {
    mapCtl.flyTo({
      center: [totalLon / activeStations.length, totalLat / activeStations.length],
      ...VIEW.clusterFly
    });
  } else {
    mapCtl.fitBounds([
      [minLon - 0.8, minLat - 0.8],
      [maxLon + 0.8, maxLat + 0.8]
    ], {
      padding: 60,
      maxZoom: 6.5,
      duration: 1000
    });
  }
  return true;
}

export function focusOnEew(mapCtl: MapController | null, eew: any): void {
  if (mapCtl && isEewCoordValid(eew)) {
    mapCtl.flyTo({
      center: [eew.Longitude, eew.Latitude],
      ...VIEW.eewFly
    });
  }
}

/** 지진 탭 진입/이력 선택 시: 색칠된 진도 분포(진도 1 회색 포함) 전체가 화면에 들어오도록 자동 확대 */
export function focusOnEarthquake(
  mapCtl: MapController | null,
  item: any,
  areaForecastGeoJSON: any
): void {
  if (!mapCtl) return;
  if (areaForecastGeoJSON?.features) {
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    const checkCoords = (coords: any) => {
      if (typeof coords[0] === 'number') {
        const [lon, lat] = coords;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      } else if (Array.isArray(coords)) {
        for (const c of coords) checkCoords(c);
      }
    };
    for (const f of areaForecastGeoJSON.features) {
      // color !== 'transparent' 인 영역 = 진도 1(회색) 이상 전부
      if (f.properties?.color && f.properties.color !== 'transparent') {
        const geom = f.geometry;
        if (geom?.coordinates) checkCoords(geom.coordinates);
      }
    }
    if (minLon < maxLon && minLat < maxLat) {
      mapCtl.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
        padding: 80,
        maxZoom: VIEW.fitMaxZoom,
        duration: 1200
      });
      return;
    }
  }
  // 색칠 영역이 없으면 전체 뷰로 복귀
  mapCtl.fitFullView(1000);
}

/** 진앙지 이동 버튼 전용: 진원지로 플라이 */
export function focusOnEpicenter(mapCtl: MapController | null, item: any): void {
  if (!mapCtl || !item) return;
  const hyp = item?.earthquake?.hypocenter;
  const isValidHyp = hyp && typeof hyp.latitude === 'number' && typeof hyp.longitude === 'number' &&
    hyp.latitude > 0 && hyp.longitude > 0 &&
    hyp.latitude >= 20 && hyp.latitude <= 55 &&
    hyp.longitude >= 120 && hyp.longitude <= 155;
  if (isValidHyp) {
    mapCtl.flyTo({
      center: [hyp.longitude, hyp.latitude],
      ...VIEW.epicenterFly
    });
  } else {
    mapCtl.fitFullView(1000);
  }
}
