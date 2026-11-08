import type { MapController } from './map/map-controller';
import { isEewCoordValid, isHypocenterValid } from './quake/quake-utils';
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
      [minLon - VIEW.clusterBoundsPad, minLat - VIEW.clusterBoundsPad],
      [maxLon + VIEW.clusterBoundsPad, maxLat + VIEW.clusterBoundsPad]
    ], { ...VIEW.clusterFit });
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
        ...VIEW.quakeFit,
        maxZoom: VIEW.fitMaxZoom
      });
      return;
    }
  }
  // 색칠 영역이 없으면(진원정도 단독 보고·points 매칭 실패 등): 진원이 유효하면 진원으로 플라이, 아니면 전체 뷰
  if (isHypocenterValid(item)) {
    const hyp = item.earthquake.hypocenter;
    mapCtl.flyTo({ center: [hyp.longitude, hyp.latitude], ...VIEW.epicenterFly });
  } else {
    mapCtl.fitFullView(1000);
  }
}

/** 진앙지 이동 버튼 전용: 진원지로 플라이 */
export function focusOnEpicenter(mapCtl: MapController | null, item: any): void {
  if (!mapCtl || !item) return;
  if (isHypocenterValid(item)) {
    const hyp = item.earthquake.hypocenter;
    mapCtl.flyTo({ center: [hyp.longitude, hyp.latitude], ...VIEW.epicenterFly });
  } else {
    mapCtl.fitFullView(1000);
  }
}

/** 해외지진 행 클릭: 진원 X 표시 + 광역 플라이 */
export function focusOverseasQuake(mapCtl: MapController | null, q: { lonlat: [number, number] }): void {
  if (!mapCtl) return;
  mapCtl.setSource('overseas-epicenter', {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: q.lonlat } }]
  });
  mapCtl.flyTo({ center: q.lonlat, ...VIEW.overseasFly });
}
