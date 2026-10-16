import type { MapController } from './map-controller';
import { MAP_CENTER } from './map-style';

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
      zoom: 6.2,
      speed: 1.2
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
  if (mapCtl && eew && typeof eew.Longitude === 'number' && typeof eew.Latitude === 'number') {
    mapCtl.flyTo({
      center: [eew.Longitude, eew.Latitude],
      zoom: 6.2,
      speed: 1.2
    });
  }
}

export function focusOnEarthquake(
  mapCtl: MapController | null,
  item: any,
  areaForecastGeoJSON: any
): void {
  if (!mapCtl || !item) return;
  const hyp = item?.earthquake?.hypocenter;
  const isValidHyp = hyp && typeof hyp.latitude === 'number' && typeof hyp.longitude === 'number' &&
    hyp.latitude > 0 && hyp.longitude > 0 &&
    hyp.latitude >= 20 && hyp.latitude <= 55 &&
    hyp.longitude >= 120 && hyp.longitude <= 155;
  if (isValidHyp) {
    mapCtl.flyTo({
      center: [hyp.longitude, hyp.latitude],
      zoom: 6.8,
      speed: 1.2,
      duration: 1200
    });
    return;
  }

  if (areaForecastGeoJSON?.features) {
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    let hasValidColor = false;
    for (const f of areaForecastGeoJSON.features) {
      if (f.properties?.color && f.properties.color !== 'transparent') {
        const geom = f.geometry;
        if (geom && geom.coordinates) {
          const checkCoords = (coords: any) => {
            if (typeof coords[0] === 'number') {
              const [lon, lat] = coords;
              if (lon < minLon) minLon = lon;
              if (lon > maxLon) maxLon = lon;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              hasValidColor = true;
            } else if (Array.isArray(coords)) {
              for (const c of coords) checkCoords(c);
            }
          };
          checkCoords(geom.coordinates);
        }
      }
    }
    if (hasValidColor && minLon < maxLon && minLat < maxLat) {
      mapCtl.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
        padding: 80,
        maxZoom: 8,
        duration: 1200
      });
      return;
    }
  }

  mapCtl.flyTo({
    center: MAP_CENTER,
    zoom: 5.2,
    duration: 1000
  });
}
